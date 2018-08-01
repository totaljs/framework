// Copyright 2012-2018 (c) Peter Širka <petersirka@gmail.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

/**
 * @module FrameworkGraphDB
 * @version 1.0.0
 */

const Fs = require('fs');
const Zlib = require('zlib');

const ZLIBOPTIONS = { level: Zlib.constants.Z_FULL_FLUSH, memLevel: Zlib.constants.Z_BEST_COMPRESSION, strategy: Zlib.constants.Z_DEFAULT_STRATEGY };
const VERSION = 1;
const DOCUMENTSIZE = 1000;
const PAGESIZE = 20;
const PAGELIMIT = 50;
const DATAOFFSET = 17;
const EMPTYBUFFER = U.createBufferSize(1);
const HEADERSIZE = 7000;
const DELAY = 100;
const REGTUNESCAPE = /%7C|%0D|%0A/g;
const REGTESCAPETEST = /\||\n|\r/;
const REGTESCAPE = /\||\n|\r/g;
const BOOLEAN = { '1': 1, 'true': 1, 'on': 1 };
const DatabaseBuilder = framework_nosql.DatabaseBuilder;

// STATES
const STATE_UNCOMPRESSED = 1;
const STATE_COMPRESSED = 2;
const STATE_REMOVED = 255;

// META
const META_PAGE_ADD = 100;
const META_CLASSESRELATIONS = 101;
const META_PAGE_ADD3 = 102;
const META_RELATIONPAGEINDEX = 103;

// OPERATIONS
const NEXT_READY = 1;
const NEXT_INSERT = 2;
const NEXT_RELATION = 3;
const NEXT_UPDATE = 4;
const NEXT_FIND = 5;
const NEXT_REMOVE = 6;
const NEXT_RESIZE = 7;
const NEXT_CONTINUE = 100;

// TYPES
const TYPE_CLASS = 1;
const TYPE_RELATION = 2;
const TYPE_RELATION_DOCUMENT = 3;

var IMPORTATOPERATIONS = 0;

function GraphDB(name) {

	F.path.verify('databases');

	var self = this;
	self.name = name;
	self.filename = F.path.databases(name + '.gdb');
	self.filenameBackup = self.filename.replace(/\.gdb$/, '.gdp-backup');
	self.ready = false;

	self.$classes = {};
	self.$relations = {};
	self.$events = {};

	self.header = {};

	self.pending = {};
	self.pending.insert = [];
	self.pending.find = [];
	self.pending.update = [];
	self.pending.remove = [];
	self.pending.relation = [];
	self.pending.meta = [];

	self.states = {};
	self.states.resize = false;
	self.states.insert = false;
	self.states.read = false;
	self.states.remove = false;
	self.states.update = false;

	F.path.verify('databases');
	// t.open();

	self.cb_error = function(err) {
		err && console.log(err);
	};

	self.cb_next = function(value) {
		self.next(value);
	};

	F.grapdbinstance = true;
	self.open();
}

var GP = GraphDB.prototype;

// ==== DB:HEADER (7000b)
// name (30b)             = from: 0
// version (1b)           = from: 30
// pages (4b)             = from: 31
// pagesize (2b)          = from: 35
// pagelimit (2b)         = from: 37
// documents (4b)         = from: 39
// documentsize (2b)      = from: 43
// classindex (1b)        = from: 45
// relationindex (1b)     = from: 46
// relationnodeindex      = from: 47
// classes + relations    = from: 51

// ==== DB:PAGE (20b)
// type (1b)              = from: 0
// index (1b)             = from: 1
// documents (2b)         = from: 2
// freeslots (1b)         = from: 4
// parentindex (4b)       = from: 5

// ==== DB:DOCUMENT (SIZE)
// type (1b)              = from: 0
// index (1b)             = from: 1
// state (1b)             = from: 2
// pageindex (4b)         = from: 3
// relationindex (4b)     = from: 7  (it's for relations between two documents in TYPE_RELATION page)
// parentindex (4b)       = from: 11
// size/count (2b)        = from: 15
// data                   = from: 17

// Creates new page
function addPage(self, type, index, parentindex, callback) {

	// @type
	// 1: classes
	// 2: relations
	// 3: relations private

	// @index
	// index of value

	// Add a new page
	self.header.pages++;

	var indexer = self.header.pages;
	var buffer = [];
	var page = U.createBufferSize(self.header.pagesize);

	// console.log('CREATING PAGE:', TYPES[type], indexer, type, index);

	page.writeUInt8(type, 0);             // type (1:class, 2:relation, 3:private)
	page.writeUInt8(index, 1);            // index
	page.writeUInt16LE(0, 2);             // documents
	page.writeUInt8(0, 4);                // freeslots
	page.writeUInt32LE(parentindex, 5);   // parentindex

	buffer.push(page);

	for (var i = 0; i < self.header.pagelimit; i++) {
		var doc = U.createBufferSize(self.header.documentsize);
		doc.writeUInt8(type, 0);
		doc.writeUInt8(index, 1);
		doc.writeUInt8(STATE_REMOVED, 2);
		doc.writeUInt32LE(self.header.pages, 3);
		doc.writeUInt32LE(0, 7);    // continuerindex
		doc.writeUInt32LE(0, 11);   // parentindex
		doc.writeUInt16LE(0, 15);   // size/count
		buffer.push(doc);
	}

	buffer = Buffer.concat(buffer);

	var offset = offsetPage(self, indexer);

	Fs.write(self.fd, buffer, 0, buffer.length, offset, function(err) {
		err && self.error(err, 'createPage.write');
		!err && updMeta(self, type === TYPE_RELATION_DOCUMENT ? META_PAGE_ADD3 : META_PAGE_ADD);
		callback && callback(err, indexer);
	});

	return indexer;
}

function addNodeFree(self, meta, callback) {

	if (!meta.type.findfreeslots) {
		addNode(self, meta, callback);
		return;
	}

	findDocumentFree(self, meta.type.pageindex, function(err, documentindex, pageindex) {

		if (!documentindex) {
			meta.type.findfreeslots = false;
			addNode(self, meta, callback);
			return;
		}

		var buffer = U.createBufferSize(self.header.documentsize);
		buffer.writeUInt8(meta.typeid, 0);                       // type
		buffer.writeUInt8(meta.type.index, 1);                   // index
		buffer.writeUInt32LE(pageindex, 3);                      // pageindex
		buffer.writeUInt8(meta.state || STATE_UNCOMPRESSED, 2);  // state
		buffer.writeUInt32LE(meta.relationindex || 0, 7);        // relationindex
		buffer.writeUInt32LE(meta.parentindex || 0, 11);         // parentindex
		buffer.writeUInt16LE(meta.size, 15);
		meta.data && meta.data.copy(buffer, DATAOFFSET);

		Fs.write(self.fd, buffer, 0, buffer.length, offsetDocument(self, documentindex), function() {
			meta.type.locked = false;
			callback(null, documentindex, pageindex);
		});
	});
}

function addNode(self, meta, callback) {

	// meta.typeid (1 CLASS, 2 RELATION)
	// meta.type (link to type class/relation)
	// meta.state
	// meta.parentindex
	// meta.relationindex
	// meta.size
	// meta.buffer

	var buf = U.createBufferSize(self.header.pagesize);
	var offset = offsetPage(self, meta.type.pageindex);

	meta.type.locked = true;

	Fs.read(self.fd, buf, 0, buf.length, offset, function(err) {

		if (err)
			throw err;

		if (buf[0] !== meta.typeid)
			throw new Error('Not a class page');

		if (!meta.type.private && buf[1] !== meta.type.index)
			throw new Error('Not same class type');

		// type          : buf[0]
		// index         : buf[1]
		// documents     : buf.readUInt16LE(2)
		// freeslots     : buf[4]
		// parentindex   : readUInt32LE(5)

		var buffer = U.createBufferSize(self.header.documentsize);
		buffer.writeUInt8(buf[0], 0);                      // type
		buffer.writeUInt8(meta.type.index, 1);             // index
		buffer.writeUInt32LE(meta.type.pageindex, 3);      // pageindex
		buffer.writeUInt8(meta.state || STATE_UNCOMPRESSED, 2);  // state
		buffer.writeUInt32LE(meta.relationindex || 0, 7);  // relationindex
		buffer.writeUInt32LE(meta.parentindex || 0, 11);   // parentindex
		buffer.writeUInt16LE(meta.size, 15);
		meta.data && meta.data.copy(buffer, DATAOFFSET);

		var documents = buf.readUInt16LE(2);
		var documentsbuf = U.createBufferSize(2);

		documents++;
		documentsbuf.writeUInt16LE(documents);

		Fs.write(self.fd, documentsbuf, 0, documentsbuf.length, offset + 2, function(err) {

			err && console.log('addNode.write.meta', err);
			Fs.write(self.fd, buffer, 0, buffer.length, offset + self.header.pagesize + ((documents - 1) * self.header.documentsize), function(err) {

				err && console.log('addNode.write.data', err);

				// type (1b)              = from: 0
				// index (1b)             = from: 1
				// state (1b)             = from: 2
				// pageindex (4b)         = from: 3
				// continuerindex (4b)    = from: 7
				// parentindex (4b)       = from: 11
				// size/count (2b)        = from: 15
				// data                   = from: 17

				// We must create a new page
				if (documents + 1 > self.header.pagelimit) {
					addPage(self, meta.typeid, meta.type.index, meta.type.pageindex, function(err, index) {

						var documentindex = getDocumentIndex(self, meta.type.pageindex, documents);
						meta.type.documentindex = documentindex;
						meta.type.pageindex = index;
						meta.type.locked = false;

						// Problem with classes
						// meta.type.index = 0;

						if (meta.type.private)
							self.header.relationpageindex = index;

						updMeta(self, meta.type.private ? META_RELATIONPAGEINDEX : META_CLASSESRELATIONS);
						callback(null, documentindex, index);
					});
				} else {
					var documentindex = getDocumentIndex(self, meta.type.pageindex, documents);
					meta.type.locked = false;
					meta.type.documentindex = documentindex;
					callback(null, documentindex, meta.type.pageindex);
				}
			});
		});
	});
}

function addDocument(self, cls, value, callback) {

	// meta.typeid (1 CLASS, 2 RELATION)
	// meta.type (link to type class/relation)
	// meta.state
	// meta.parentindex
	// meta.relationindex
	// meta.size
	// meta.data

	var meta = {};
	meta.type = cls;
	meta.typeid = TYPE_CLASS;
	meta.state = 1;
	meta.parentindex = 0;
	meta.relationindex = 0;
	meta.data = U.createBuffer(stringifyData(cls.schema, value));
	meta.size = meta.data.length;

	var limit = self.header.documentsize - DATAOFFSET;

	if (meta.data.length > limit) {
		Zlib.deflate(meta.data, ZLIBOPTIONS, function(err, buf) {
			if (err || buf.length > limit)
				callback(new Error('GraphDB: Data too long'), 0);
			else {
				meta.state = STATE_COMPRESSED;
				meta.data = buf;
				meta.size = buf.length;
				addNodeFree(self, meta, callback);
			}
		});
	} else
		addNodeFree(self, meta, callback);
}

function addRelation(self, relation, indexA, indexB, callback) {

	// Workflow:
	// Has "A" relation nodes?
	// Has "B" relation nodes?
	// Create "A" relation with "B"
	// Create "B" relation with "A"
	// Register relation to global relations

	var tasks = [];
	var relA = null;
	var relB = null;

	var tmprelation = { index: relation.index, pageindex: 0, documentindex: 0, locked: false, private: true };

	tasks.push(function(next) {
		self.read(indexA, function(err, doc, relid) {
			if (doc) {
				relA = relid;
				next();
			} else {
				tasks = null;
				next = null;
				callback(new Error('GraphDB: Node (A) "{0}" not exists.'.format(indexA)));
			}
		});
	});

	tasks.push(function(next) {
		self.read(indexB, function(err, doc, relid) {
			if (doc) {
				relB = relid;
				next();
			} else {
				tasks = null;
				next = null;
				callback(new Error('GraphDB: Node (B) "{0}" not exists.'.format(indexB)));
			}
		});
	});

	tasks.push(function(next) {

		if (relA == 0) {
			next();
			return;
		}

		checkRelation(self, relation, relA, indexB, function(err, is) {
			if (is) {
				tasks = null;
				next = null;
				callback(new Error('GraphDB: Same relation already exists between nodes (A) "{0}" and (B) "{1}".'.format(indexA, indexB)));
			} else
				next();
		});
	});

	// Obtaining indexA a relation document
	tasks.push(function(next) {

		if (F.isKilled)
			return;

		IMPORTATOPERATIONS++;

		if (relA)
			next();
		else {
			addRelationDocument(self, relation, indexA, function(err, index) {
				relA = index;
				next();
			}, true);
		}
	});

	// Obtaining indexB a relation document
	tasks.push(function(next) {

		if (F.isKilled)
			return;

		if (relB)
			next();
		else {
			addRelationDocument(self, relation, indexB, function(err, index) {
				relB = index;
				next();
			}, true);
		}
	});

	// Push "indexB" relation to "indexA"
	tasks.push(function(next) {
		tmprelation.documentindex = relA;
		tmprelation.pageindex = self.header.relationpageindex;
		pushRelationDocument(self, relA, tmprelation, indexB, true, function(err, index) {
			// Updated relation, document was full
			if (relA !== index) {
				relA = index;
				updDocumentRelation(self, indexA, relA, next);
			} else
				next();
		}, true);
	});

	tasks.push(function(next) {
		tmprelation.documentindex = relB;
		tmprelation.pageindex = self.header.relationpageindex;
		pushRelationDocument(self, relB, tmprelation, indexA, false, function(err, index) {
			// Updated relation, document was full
			if (relB !== index) {
				relB = index;
				updDocumentRelation(self, indexB, relB, next);
			} else
				next();
		}, true);
	});

	tasks.push(function(next) {
		// console.log('PUSH COMMON', relation.documentindex, indexA);
		pushRelationDocument(self, relation.documentindex, relation, indexA, true, next);
	});

	tasks.async(function() {
		IMPORTATOPERATIONS--;
		// console.log('REL ====', relA, relB);
		callback(null, true);
	});
}

function remRelation(self, relation, indexA, indexB, callback) {

	var tasks = [];
	var relA = null;
	var relB = null;

	tasks.push(function(next) {
		self.read(indexA, function(err, doc, relid) {
			if (doc) {
				relA = relid;
				next();
			} else {
				tasks = null;
				next = null;
				callback(new Error('GraphDB: Node (A) "{0}" not exists.'.format(indexA)));
			}
		});
	});

	tasks.push(function(next) {
		self.read(indexB, function(err, doc, relid) {
			if (doc) {
				relB = relid;
				next();
			} else {
				tasks = null;
				next = null;
				callback(new Error('GraphDB: Node (B) "{0}" not exists.'.format(indexB)));
			}
		});
	});

	tasks.async(function() {

		if (F.isKilled)
			return;

		IMPORTATOPERATIONS++;
		remRelationLink(self, relA, indexB, function(err, countA) {
			remRelationLink(self, relB, indexA, function(err, countB) {
				remRelationLink(self, relation.documentindex, indexA, function(err, countC) {
					IMPORTATOPERATIONS--;
					callback(null, (countA + countB + countC) > 1);
				});
			});
		});
	});
}

function remRelationLink(self, index, documentindex, callback, nochild, counter) {

	var buf = U.createBufferSize(self.header.documentsize);
	var offset = offsetDocument(self, index);

	!counter && (counter = 0);

	Fs.read(self.fd, buf, 0, buf.length, offset, function() {

		// type (1b)              = from: 0
		// index (1b)             = from: 1
		// state (1b)             = from: 2
		// pageindex (4b)         = from: 3
		// relationindex (4b)     = from: 7  (it's for relations between two documents in TYPE_RELATION page)
		// parentindex (4b)       = from: 11
		// size/count (2b)        = from: 15
		// data                   = from: 17

		if ((buf[0] !== TYPE_RELATION && buf[0] !== TYPE_RELATION_DOCUMENT) || (buf[2] === STATE_REMOVED)) {
			callback(null, counter);
			return;
		}

		var relid = buf.readUInt32LE(7);
		var count = buf.readUInt16LE(15);
		var arr = [];
		var is = false;

		for (var i = 0; i < count; i++) {
			var off = DATAOFFSET + (i * 6);
			var obj = {};
			obj.INDEX = buf[off];
			obj.INIT = buf[off + 1];
			obj.ID = buf.readUInt32LE(off + 2);
			if (obj.ID === documentindex && obj.INIT === 1)
				is = true;
			else
				arr.push(obj);
		}

		if (is) {
			count = arr.length;
			for (var i = 0; i < count; i++) {
				var off = DATAOFFSET + (i * 6);
				var obj = arr[i];
				buf.writeUInt8(obj.INDEX, off);
				buf.writeUInt8(obj.INIT, off + 1);
				buf.writeUInt32LE(obj.ID, off + 2);
			}
			buf.writeUInt16LE(count, 15);
			buf.fill(EMPTYBUFFER, DATAOFFSET + ((count + 1) * 6));
			Fs.write(self.fd, buf, 0, buf.length, offset, function() {
				counter++;
				if (relid && !nochild)
					setImmediate(remRelationLink, self, relid, documentindex, callback, null, counter);
				else
					callback(null, counter);
			});
		} else if (relid && !nochild)
			setImmediate(remRelationLink, self, relid, documentindex, callback, null, counter);
		else
			callback(null, counter);
	});
}

// Traverses all RELATIONS documents and remove specific "documentindex"
function remRelationAll(self, index, documentindex, callback, counter) {

	var buf = U.createBufferSize(self.header.pagelimit * self.header.documentsize);
	var offset = offsetDocument(self, index);

	!counter && (counter = 0);

	Fs.read(self.fd, buf, 0, buf.length, offset, function(err, size) {

		if (err || !size) {
			callback(null, counter);
			return;
		}

		// type (1b)              = from: 0
		// index (1b)             = from: 1
		// state (1b)             = from: 2
		// pageindex (4b)         = from: 3
		// relationindex (4b)     = from: 7  (it's for relations between two documents in TYPE_RELATION page)
		// parentindex (4b)       = from: 11
		// size/count (2b)        = from: 15
		// data                   = from: 17

		var removed = [];

		while (true) {

			if (!buf.length)
				break;

			index++;

			var data = buf.slice(0, self.header.documentsize);

			if ((data[0] !== TYPE_RELATION && data[0] !== TYPE_RELATION_DOCUMENT) || (data[2] === STATE_REMOVED)) {
				buf = buf.slice(self.header.documentsize);
				continue;
			}

			var count = data.readUInt16LE(15);
			var arr = [];
			var is = false;

			for (var i = 0; i < count; i++) {
				var off = DATAOFFSET + (i * 6);
				var obj = {};
				obj.INDEX = data[off];
				obj.INIT = data[off + 1];
				obj.ID = data.readUInt32LE(off + 2);
				if (obj.ID === documentindex)
					is = true;
				else
					arr.push(obj);
			}

			if (is) {

				var newcount = arr.length;

				for (var i = 0; i < newcount; i++) {
					var off = DATAOFFSET + (i * 6);
					var obj = arr[i];
					data.writeUInt8(obj.INDEX, off);
					data.writeUInt8(obj.INIT, off + 1);
					data.writeUInt32LE(obj.ID, off + 2);
				}

				data.writeUInt16LE(newcount, 15);
				data.fill(EMPTYBUFFER, DATAOFFSET + ((newcount + 1) * 6));

				removed.push({ index: index - 1, buf: data });
			}

			buf = buf.slice(self.header.documentsize);
		}

		if (!removed.length) {
			setImmediate(remRelationAll, self, index, documentindex, callback, counter);
			return;
		}

		counter += removed.length;
		removed.wait(function(item, next) {
			Fs.write(self.fd, item.buf, 0, item.buf.length, offsetDocument(self, item.index), next);
		}, function() {
			setImmediate(remRelationAll, self, index, documentindex, callback, counter);
		});

	});
}

function addRelationDocument(self, relation, index, callback, between) {

	// meta.typeid (1 CLASS, 2 RELATION, 3 PRIVATE RELATION)
	// meta.type (link to type class/relation)
	// meta.state
	// meta.parentindex
	// meta.relationindex
	// meta.size
	// meta.data

	var meta = {};
	meta.typeid = between ? TYPE_RELATION_DOCUMENT : TYPE_RELATION;
	meta.type = between ? { index: 0, pageindex: self.header.relationpageindex, documentindex: index, locked: false, private: true } : relation;
	meta.state = 1;
	meta.parentindex = 0;
	meta.relationindex = 0;
	meta.size = 0;

	// Creates a new node
	addNode(self, meta, function(err, relationindex) {

		// Updates exiting document by updating relation index
		updDocumentRelation(self, index, relationindex, function(err) {
			// Returns a new relation index
			callback(err, relationindex);
		});
	});
}

function findDocumentFree(self, pageindex, callback, ready) {

	var offset = offsetPage(self, pageindex);
	var buf = U.createBufferSize(self.header.pagesize);

	Fs.read(self.fd, buf, 0, buf.length, offset, function() {

		// ==== DB:PAGE (20b)
		// type (1b)              = from: 0
		// index (1b)             = from: 1
		// documents (2b)         = from: 2
		// freeslots (1b)         = from: 4
		// parentindex (4b)       = from: 5

		var relid = buf.readUInt32LE(5);
		if (!relid) {
			if (!ready) {
				callback(null, 0);
				return;
			}
		}

		// First page is the last page saved in meta therefore is needed to perform recursive with "ready"
		if (!ready) {
			findDocumentFree(self, relid, callback, true);
			return;
		}

		var documents = buf.readUInt16LE(2);
		if (documents >= self.header.pagelimit) {
			// Finds in parent if exists
			if (relid)
				findDocumentFree(self, relid, callback, true);
			else
				callback(null, 0);
			return;
		}

		// Finds a free document slot
		var index = getDocumentIndex(self, pageindex) - 1;
		var buffer = U.createBufferSize(self.header.pagelimit * self.header.documentsize);

		Fs.read(self.fd, buffer, 0, buffer.length, offset + self.header.pagesize, function() {
			while (true) {
				index++;
				var data = buffer.slice(0, self.header.documentsize);
				if (!data.length)
					break;

				if (data[2] === STATE_REMOVED) {

					if (F.isKilled)
						return;

					updPageMeta(self, pageindex, function(err, buf) {
						buf.writeUInt16LE(documents + 1, 2);
						setImmediate(callback, null, index, pageindex);
					});
					buffer = buffer.slice(self.header.documentsize);
					return;
				}
			}

			if (relid)
				findDocumentFree(self, relid, callback, true);
			else
				callback(null, 0);

		});
	});
}

// Finds a free space for new relation in "pushRelationDocument"
function findRelationDocument(self, relid, callback) {

	if (!relid) {
		callback(null, 0);
		return;
	}

	var offset = offsetDocument(self, relid);
	var buf = U.createBufferSize(self.header.documentsize);

	Fs.read(self.fd, buf, 0, buf.length, offset, function(err, size) {

		if (err || !size) {
			callback(err, 0);
			return;
		}

		var count = buf.readUInt16LE(15);
		if (count + 1 > self.header.relationlimit) {
			// Checks if the relation index has next relation

			if (relid === buf.readUInt32LE(7))
				return;

			relid = buf.readUInt32LE(7);
			if (relid)
				setImmediate(findRelationDocument, self, relid, callback);
			else
				callback(null, 0);
		} else {
			// Free space for this relation
			callback(null, relid);
		}
	});
}

// Pushs "documentindex" to "index" document (document with all relations)
function pushRelationDocument(self, index, relation, documentindex, initializator, callback, between, recovered) {

	var offset = offsetDocument(self, index);
	var buf = U.createBufferSize(self.header.documentsize);

	Fs.read(self.fd, buf, 0, buf.length, offset, function() {

		// type (1b)              = from: 0
		// index (1b)             = from: 1
		// state (1b)             = from: 2
		// pageindex (4b)         = from: 3
		// relationindex (4b)     = from: 7  (it's for relations between two documents in TYPE_RELATION page)
		// parentindex (4b)       = from: 11
		// size/count (2b)        = from: 15
		// data                   = from: 17

		var count = buf.readUInt16LE(15);
		if (count + 1 > self.header.relationlimit) {
			findRelationDocument(self, buf.readUInt32LE(7), function(err, newindex) {

				// Is some relation document exist?
				if (newindex && !recovered) {
					pushRelationDocument(self, newindex, relation, documentindex, initializator, callback, between, true);
					return;
				}

				// meta.typeid (1 CLASS, 2 RELATION)
				// meta.type (link to type class/relation)
				// meta.state
				// meta.parentindex
				// meta.relationindex
				// meta.size
				// meta.buffer

				var meta = {};
				meta.typeid = relation.private ? TYPE_RELATION_DOCUMENT : TYPE_RELATION;
				meta.type = relation;
				meta.state = STATE_UNCOMPRESSED;
				meta.parentindex = 0;
				meta.relationindex = index;
				meta.size = 0;

				addNode(self, meta, function(err, docindex, pageindex) {
					relation.pageindex = pageindex;
					relation.documentindex = docindex;
					updDocumentRelation(self, relation.documentindex, index, function() {
						updDocumentParent(self, index, relation.documentindex, function() {
							pushRelationDocument(self, relation.documentindex, relation, documentindex, initializator, callback, between);
						});
					});
				});
			});

		} else {

			var buffer = U.createBufferSize(6);
			buffer.writeUInt8(relation.index, 0);
			buffer.writeUInt8(initializator ? 1 : 0, 1);
			buffer.writeUInt32LE(documentindex, 2);
			buffer.copy(buf, DATAOFFSET + (count * 6));
			buf.writeUInt16LE(count + 1, 15);

			if (buf[2] === STATE_REMOVED) {
				// We must update counts of documents in the page meta
				var pageindex = Math.ceil(index / self.header.pagelimit);
				updPageMeta(self, pageindex, function(err, buf) {

					// type (1b)              = from: 0
					// index (1b)             = from: 1
					// documents (2b)         = from: 2
					// freeslots (1b)         = from: 4
					// parentindex (4b)       = from: 5

					buf.writeUInt16LE(buf.readUInt16LE(2) + 1, 2);
					setImmediate(function() {
						Fs.write(self.fd, buf, 0, buf.length, offset, function(err) {
							err && self.error(err, 'pushRelationDocument.read.write');
							callback(null, index);
						});
					});
				});

				buf.writeUInt8(STATE_UNCOMPRESSED, 2);

			} else {
				// DONE
				Fs.write(self.fd, buf, 0, buf.length, offset, function(err) {
					err && self.error(err, 'pushRelationDocument.read.write');
					callback(null, index);
				});
			}
		}

	});
}

function updDocumentRelation(self, index, relationindex, callback) {

	if (index === relationindex)
		throw new Error('FET');

	var offset = offsetDocument(self, index);
	var buf = U.createBufferSize(4);
	buf.writeUInt32LE(relationindex);
	Fs.write(self.fd, buf, 0, buf.length, offset + 7, callback);
}

function updDocumentParent(self, index, parentindex, callback) {
	var offset = offsetDocument(self, index);
	var buf = U.createBufferSize(4);
	buf.writeUInt32LE(parentindex);
	Fs.write(self.fd, buf, 0, buf.length, offset + 11, callback);
}

function updPageMeta(self, index, fn) {
	var offset = offsetPage(self, index);
	var buf = U.createBufferSize(self.header.pagesize);
	Fs.read(self.fd, buf, 0, buf.length, offset, function() {
		fn(null, buf);
		Fs.write(self.fd, buf, 0, buf.length, offset, self.cb_error);
	});
}

function remDocument(self) {
	if (!self.ready || self.states.remove || !self.pending.remove.length || F.isKilled)
		return;
	self.states.remove = true;
	var doc = self.pending.remove.shift();
	IMPORTATOPERATIONS++;
	remRelationAll(self, doc.id, doc.id, function() {
		remDocumentAll(self, doc.id, function(err, count) {
			IMPORTATOPERATIONS--;
			self.states.remove = false;
			doc.callback && doc.callback(err, count);
			setImmediate(self.cb_next, NEXT_REMOVE);
		});
	});
}

function remDocumentAll(self, index, callback, count) {

	var offset = offsetDocument(self, index);
	var buf = U.createBufferSize(17);

	// type (1b)              = from: 0
	// index (1b)             = from: 1
	// state (1b)             = from: 2
	// pageindex (4b)         = from: 3
	// relationindex (4b)     = from: 7  (it's for relations between two documents in TYPE_RELATION page)
	// parentindex (4b)       = from: 11
	// size/count (2b)        = from: 15
	// data                   = from: 17

	if (!count)
		count = 0;

	Fs.read(self.fd, buf, 0, buf.length, offset, function() {

		var relid = buf.readUInt32LE(7);

		if (buf[2] === STATE_REMOVED) {
			if (relid)
				remDocumentAll(self, relid, callback, count);
			else
				callback(null, count);
			return;
		}

		buf.writeUInt8(STATE_REMOVED, 2);
		buf.writeUInt16LE(0, 15);

		if (buf[0] === TYPE_CLASS)
			self.$classes[buf[1]].findfreeslots = true;

		var pageindex = buf.readUInt32LE(3);

		Fs.write(self.fd, buf, 0, buf.length, offset, function() {

			// Updates "documents" in the current page
			updPageMeta(self, pageindex, function(err, buf) {

				// type (1b)              = from: 0
				// index (1b)             = from: 1
				// documents (2b)         = from: 2
				// freeslots (1b)         = from: 4
				// parentindex (4b)       = from: 5

				var documents = buf.readUInt16LE(2);
				buf.writeUInt16LE(documents > 0 ? documents - 1 : documents, 2);
				count++;

				setImmediate(function() {
					if (relid)
						remDocumentAll(self, relid, callback, count);
					else
						callback(null, count);
				});
			});
		});
	});
}

function offsetPage(self, index) {
	return HEADERSIZE + ((index - 1) * (self.header.pagesize + (self.header.pagelimit * self.header.documentsize)));
}

function offsetDocument(self, index) {
	var page = Math.ceil(index / self.header.pagelimit);
	var offset = page * self.header.pagesize;
	return HEADERSIZE + offset + ((index - 1) * self.header.documentsize);
}

function getIndexPage(self, offset) {
	return ((offset - HEADERSIZE) / (self.header.pagesize + (self.header.pagelimit * self.header.documentsize)));
}

function getDocumentIndex(self, pageindex, count) {
	return ((pageindex - 1) * self.header.pagelimit) + (count || 1);
}

function checkRelation(self, relation, indexA, indexB, callback) {

	self.read(indexA, function(err, docs, relid) {

		if (docs) {
			for (var i = 0; i < docs.length; i++) {
				var doc = docs[i];
				if (doc.ID === indexB && (relation.both || doc.INIT)) {
					callback(null, true);
					return;
				}
			}
		}

		if (relid)
			setImmediate(checkRelation, self, relation, relid, indexB, callback);
		else
			callback(null, false);
	});
}

function updMeta(self, type) {
	var buf;
	switch (type) {

		case META_PAGE_ADD:
			buf = U.createBufferSize(4);
			buf.writeUInt32LE(self.header.pages);
			Fs.write(self.fd, buf, 0, buf.length, 31, self.cb_error);
			break;

		case META_PAGE_ADD3:
			buf = U.createBufferSize(4);
			buf.writeUInt32LE(self.header.pages, 0);
			Fs.write(self.fd, buf, 0, buf.length, 31, function() {
				buf.writeUInt32LE(self.header.relationpageindex, 0);
				Fs.write(self.fd, buf, 0, buf.length, 47, self.cb_error);
			});
			break;

		case META_RELATIONPAGEINDEX:
			buf = U.createBufferSize(4);
			buf.writeUInt32LE(self.header.relationpageindex, 0);
			Fs.write(self.fd, buf, 0, buf.length, 47, self.cb_error);
			break;

		case META_CLASSESRELATIONS:

			var obj = {};
			obj.c = []; // classes
			obj.r = []; // relations

			for (var i = 0; i < self.header.classindex; i++) {
				var item = self.$classes[i + 1];
				obj.c.push({ n: item.name, i: item.index, p: item.pageindex, r: item.schema.raw, d: item.documentindex });
			}

			for (var i = 0; i < self.header.relationindex; i++) {
				var item = self.$relations[i + 1];
				obj.r.push({ n: item.name, i: item.index, p: item.pageindex, b: item.both ? 1 :0, d: item.documentindex });
			}

			buf = U.createBufferSize(HEADERSIZE - 45);
			buf.writeUInt8(self.header.classindex, 0);
			buf.writeUInt8(self.header.relationindex, 1);
			buf.writeUInt32LE(self.header.relationpageindex, 2);
			buf.write(JSON.stringify(obj), 6);
			Fs.write(self.fd, buf, 0, buf.length, 45, self.cb_error);
			break;
	}
}

function insDocument(self) {

	if (!self.ready || self.states.insert || !self.pending.insert.length || F.isKilled)
		return;

	var doc = self.pending.insert.shift();
	if (doc) {

		var cls = self.$classes[doc.name];
		if (cls == null) {
			doc.callback(new Error('GraphDB: Class "{0}" not found.'.format(doc.name)));
			return;
		}

		if (cls.locked || !cls.ready) {
			self.pending.insert.push(doc);
			setTimeout(self.cb_next, DELAY, NEXT_INSERT);
			return;
		}

		self.states.insert = true;

		addDocument(self, cls, doc.value, function(err, id) {
			// setTimeout(insDocument, 100, self);
			self.states.insert = false;
			setImmediate(insDocument, self);
			doc.callback(err, id);
		});
	}
}

function updDocument(self) {

	if (!self.ready || self.states.update || !self.pending.update.length || F.isKilled)
		return;

	var upd = self.pending.update.shift();
	if (upd) {
		self.states.update = true;

		var offset = offsetDocument(self, upd.id);
		var buf = U.createBufferSize(self.header.documentsize);

		Fs.read(self.fd, buf, 0, buf.length, offset, function(err, size) {

			if (err) {
				self.states.update = false;
				upd.callback(err);
				setImmediate(self.cb_next, NEXT_UPDATE);
				return;
			}

			if (!size) {
				upd.callback(null, 0);
				self.states.update = false;
				setImmediate(self.cb_next, NEXT_UPDATE);
				return;
			}

			var save = function(err) {
				self.states.update = false;
				!err && Fs.write(self.fd, buf, 0, buf.length, offset, self.cb_error);
				upd.callback(err, err ? 0 : 1);
				setImmediate(self.cb_next, NEXT_UPDATE);
			};

			var data = buf.slice(DATAOFFSET, buf.readUInt16LE(15) + DATAOFFSET);
			var limit = self.header.documentsize - DATAOFFSET;
			var schema = self.$classes[buf[1]].schema;
			var doc;

			if (buf[2] === STATE_COMPRESSED) {
				Zlib.inflate(data, ZLIBOPTIONS, function(err, buffer) {
					doc = parseData(schema, buffer.toString('utf8').split('|'));
					buffer = U.createBuffer(stringifyData(schema, upd.fn(doc, upd.value)));
					if (buffer.length > limit) {
						Zlib.deflate(buffer, ZLIBOPTIONS, function(err, buffer) {
							if (buffer.length <= limit) {
								buf.writeUInt16LE(buffer.length, 15);
								buf.writeUInt8(STATE_COMPRESSED, 2);
								buffer.copy(buf, DATAOFFSET);
								save();
							} else
								save(new Error('GraphDB: Data too long'));
						});
					} else {
						buf.writeUInt16LE(buffer.length, 15);
						buf.writeUInt8(STATE_UNCOMPRESSED, 2);
						buffer.copy(buf, DATAOFFSET);
						save();
					}
				});
			} else {
				doc = parseData(schema, data.toString('utf8').split('|'));
				var o = stringifyData(schema, upd.fn(doc, upd.value));
				var buffer = U.createBuffer(o);
				if (buffer.length > limit) {
					Zlib.deflate(buffer, ZLIBOPTIONS, function(err, buffer) {
						if (buffer.length <= limit) {
							buf.writeUInt16LE(buffer.length, 15);
							buf.writeUInt8(STATE_COMPRESSED, 2);
							buffer.copy(buf, DATAOFFSET);
							save();
						} else
							save(new Error('GraphDB: Data too long'));
					});
				} else {
					buf.writeUInt16LE(buffer.length, 15);
					buf.writeUInt8(STATE_UNCOMPRESSED, 2);
					buffer.copy(buf, DATAOFFSET);
					save();
				}
			}
		});
	}
}

function insRelation(self) {

	if (!self.ready || self.states.relation)
		return;

	var doc = self.pending.relation.shift();
	if (doc) {

		var rel = self.$relations[doc.name];
		if (rel == null) {
			doc.callback(new Error('GraphDB: Relation "{0}" not found.'.format(doc.name)));
			return;
		}

		if (rel.locked || !rel.ready) {
			self.pending.relation.push(doc);
			setTimeout(insRelation, DELAY, self);
			return;
		}

		self.states.relation = true;

		if (doc.connect) {
			addRelation(self, rel, doc.indexA, doc.indexB, function(err, id) {
				self.states.relation = false;
				doc.callback(err, id);
				setImmediate(insRelation, self);
			});
		} else {
			remRelation(self, rel, doc.indexA, doc.indexB, function(err, id) {
				self.states.relation = false;
				doc.callback(err, id);
				setImmediate(insRelation, self);
			});
		}
	}
}

GP.create = function(filename, documentsize, callback) {
	var self = this;
	Fs.unlink(filename, function() {
		var buf = U.createBufferSize(HEADERSIZE);
		buf.write('Total.js GraphDB embedded', 0);
		buf.writeUInt8(VERSION, 30);          // version
		buf.writeUInt32LE(0, 31);             // pages
		buf.writeUInt16LE(PAGESIZE, 35);      // pagesize
		buf.writeUInt16LE(PAGELIMIT, 37);     // pagelimit
		buf.writeUInt32LE(0, 39);             // documents
		buf.writeUInt16LE(documentsize, 43);  // documentsize
		buf.writeUInt8(0, 45);                // classindex
		buf.writeUInt8(0, 46);                // relationindex
		buf.writeUInt8(0, 47);                // relationpageindex
		buf.write('{"c":[],"r":[]}', 51);     // classes and relations
		Fs.open(filename, 'w', function(err, fd) {
			Fs.write(fd, buf, 0, buf.length, 0, function(err) {
				err && self.error(err, 'create');
				Fs.close(fd, function() {
					callback && callback();
				});
			});
		});
	});
	return self;
};

GP.open = function() {
	var self = this;
	Fs.stat(self.filename, function(err, stat) {
		if (err) {
			// file not found
			self.create(self.filename, DOCUMENTSIZE, () => self.open());
		} else {
			self.header.size = stat.size;
			Fs.open(self.filename, 'r+', function(err, fd) {
				self.fd = fd;
				err && self.error(err, 'open');
				var buf = U.createBufferSize(HEADERSIZE);
				Fs.read(self.fd, buf, 0, buf.length, 0, function() {

					self.header.pages = buf.readUInt32LE(31);
					self.header.pagesize = buf.readUInt16LE(35);
					self.header.pagelimit = buf.readUInt16LE(37);
					self.header.documents = buf.readUInt32LE(39);
					self.header.documentsize = buf.readUInt16LE(43);

					var size = F.config['graphdb.' + self.name] || DOCUMENTSIZE;
					if (size > self.header.documentsize) {
						setTimeout(function() {
							self.next(NEXT_RESIZE);
						}, DELAY);
					}

					self.header.relationlimit = ((self.header.documentsize - DATAOFFSET) / 6) >> 0;
					self.header.classindex = buf[45];
					self.header.relationindex = buf[46];
					self.header.relationpageindex = buf.readUInt32LE(47);

					var data = buf.slice(51, buf.indexOf(EMPTYBUFFER, 51)).toString('utf8');
					var meta = data.parseJSON(true);

					for (var i = 0; i < meta.c.length; i++) {
						var item = meta.c[i];
						self.class(item.n, item.r, item);
					}

					for (var i = 0; i < meta.r.length; i++) {
						var item = meta.r[i];
						self.relation(item.n, item.b === 1, item);
					}

					!self.header.relationpageindex && addPage(self, TYPE_RELATION_DOCUMENT, 0, 0, function(err, index) {
						self.header.relationpageindex = index;
					});

					self.ready = true;
					self.next(NEXT_READY);
				});
			});
		}
	});
	return self;
};

GP.next = function(type) {

	var self = this;
	var tmp;

	switch (type) {
		case NEXT_READY:
			for (var i = 0; i < self.pending.meta.length; i++) {
				tmp = self.pending.meta[i];
				if (tmp.type === TYPE_CLASS)
					self.class(tmp.name, tmp.data);
				else
					self.relation(tmp.name, tmp.data);
			}
			self.emit('ready');
			break;

		case NEXT_RESIZE:

			clearTimeout(self.$resizedelay);
			self.$resizedelay = setTimeout(function() {
				if (!self.states.resize) {
					self.ready = false;
					self.states.resize = true;
					var size = (F.config['graphdb.' + self.name] || DOCUMENTSIZE);
					var meta = { documentsize: size > self.header.documentsize ? size : self.header.documentsize };
					var keys = Object.keys(self.$classes);

					for (var i = 0; i < keys.length; i++) {
						var key = keys[i];
						var cls = self.$classes[key];
						if (cls.$resize) {
							!meta.classes && (meta.classes = {});
							meta.classes[cls.index] = cls.$resize;
							cls.$resize = null;
						}
					}
					self.resize(meta, function() {
						self.states.resize = false;
						self.ready = true;
						setImmediate(self.cb_next, NEXT_CONTINUE);
					});
				}
			}, DELAY);

			break;

		case NEXT_INSERT:
			insDocument(self);
			break;
		case NEXT_RELATION:
			insRelation(self);
			break;
		case NEXT_UPDATE:
			updDocument(self);
			break;
		case NEXT_REMOVE:
			remDocument(self);
			break;
		case NEXT_FIND:
			if (self.pending.find.length) {
				tmp = self.pending.find.shift();
				$find(self, tmp.name, tmp.builder, tmp.reverse);
			}
			break;
	}
};

GP.class = function(name, meta, data) {

	var self = this;

	if (!self.ready && !data) {
		self.pending.meta.push({ name: name, data: meta, type: 1 });
		return self;
	}

	var item = self.$classes[name];
	var save = false;

	if (item == null) {

		item = {};
		item.locked = false;

		if (data) {
			item.ready = true;
			item.name = name;
			item.index = data.i;
			item.pageindex = data.p;
			item.documentindex = data.d;
			item.findfreeslots = true;
		} else {
			self.header.classindex++;
			item.name = name;
			item.index = self.header.classindex;
			item.ready = false;
			item.pageindex = addPage(self, TYPE_CLASS, item.index, 0, function() {
				item.ready = true;
			});
			item.documentindex = getDocumentIndex(self, item.pageindex);
			save = true;
		}

		item.schema = parseSchema(meta);
		self.$classes[item.name] = self.$classes[item.index] = item;

	} else {
		var newschema = parseSchema(meta);
		var raw = item.schema.raw;
		if (raw !== newschema.raw) {
			item.$resize = newschema;
			self.next(NEXT_RESIZE);
		}
	}

	save && updMeta(self, META_CLASSESRELATIONS);
	return self;
};

GP.relation = function(name, both, data) {

	var self = this;

	if (!self.ready && !data) {
		self.pending.meta.push({ name: name, data: both, type: 2 });
		return self;
	}

	var self = this;
	var item = self.$relations[name];
	var save = false;

	if (item == null) {

		item = {};
		item.ready = true;
		item.locked = false;

		if (data) {
			item.name = name;
			item.index = data.i;
			item.pageindex = data.p;
			item.documentindex = data.d;
			item.both = both;
		} else {
			self.header.relationindex++;
			item.name = name;
			item.index = self.header.relationindex;
			item.ready = false;
			item.both = both;
			item.pageindex = addPage(self, TYPE_RELATION, item.index, 0, function() {
				item.ready = true;
			});
			item.documentindex = getDocumentIndex(self, item.pageindex);
			save = true;
		}

		self.$relations[item.name] = self.$relations[item.index] = item;

	} else {
		// compare
	}

	save && updMeta(self, META_CLASSESRELATIONS);
	return self;
};

GP.emit = function(name, a, b, c, d, e, f, g) {
	var evt = this.$events[name];
	if (evt) {
		var clean = false;
		for (var i = 0, length = evt.length; i < length; i++) {
			if (evt[i].$once)
				clean = true;
			evt[i].call(this, a, b, c, d, e, f, g);
		}
		if (clean) {
			evt = evt.remove(n => n.$once);
			if (evt.length)
				this.$events[name] = evt;
			else
				this.$events[name] = undefined;
		}
	}
	return this;
};

GP.on = function(name, fn) {
	if (this.$ready && (name === 'ready' || name === 'load')) {
		fn();
		return this;
	}
	if (!fn.$once)
		this.$free = false;
	if (this.$events[name])
		this.$events[name].push(fn);
	else
		this.$events[name] = [fn];
	return this;
};

GP.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

GP.removeListener = function(name, fn) {
	var evt = this.$events[name];
	if (evt) {
		evt = evt.remove(n => n === fn);
		if (evt.length)
			this.$events[name] = evt;
		else
			this.$events[name] = undefined;
	}
	return this;
};

GP.removeAllListeners = function(name) {
	if (name === true)
		this.$events = EMPTYOBJECT;
	else if (name)
		this.$events[name] = undefined;
	else
		this.$events[name] = {};
	return this;
};

GP.resize = function(meta, callback) {

	// meta.documentsize
	// meta.classes

	var self = this;
	var filename = self.filename + '-tmp';

	self.create(filename, meta.documentsize, function(err) {

		if (err)
			throw err;

		Fs.open(filename, 'r+', function(err, fd) {

			var offset = HEADERSIZE;
			var newoffset = HEADERSIZE;
			var size = self.header.pagesize + (self.header.pagelimit * self.header.documentsize);
			var newsize = self.header.pagesize + (self.header.pagelimit * meta.documentsize);
			var pageindex = 0;
			var totaldocuments = 0;

			var finish = function() {

				var buf = U.createBufferSize(HEADERSIZE);
				Fs.read(fd, buf, 0, buf.length, 0, function() {

					// ==== DB:HEADER (7000b)
					// name (30b)             = from: 0
					// version (1b)           = from: 30
					// pages (4b)             = from: 31
					// pagesize (2b)          = from: 35
					// pagelimit (2b)         = from: 37
					// documents (4b)         = from: 39
					// documentsize (2b)      = from: 43
					// classindex (1b)        = from: 45
					// relationindex (1b)     = from: 46
					// relationnodeindex      = from: 47
					// classes + relations    = from: 51

					// buf.

					buf.writeUInt32LE(pageindex > 0 ? (pageindex - 1) : 0, 31);
					buf.writeUInt32LE(totaldocuments, 39);
					buf.writeUInt16LE(meta.documentsize, 43);

					var obj = {};
					obj.c = []; // classes
					obj.r = []; // relations

					for (var i = 0; i < self.header.classindex; i++) {
						var item = self.$classes[i + 1];
						var schema = meta.classes[i + 1];
						obj.c.push({ n: item.name, i: item.index, p: item.pageindex, r: schema ? schema.raw : item.schema.raw, d: item.documentindex });
					}

					for (var i = 0; i < self.header.relationindex; i++) {
						var item = self.$relations[i + 1];
						obj.r.push({ n: item.name, i: item.index, p: item.pageindex, b: item.both ? 1 :0, d: item.documentindex });
					}

					buf.writeUInt8(self.header.classindex, 45);
					buf.writeUInt8(self.header.relationindex, 46);
					buf.writeUInt32LE(self.header.relationpageindex, 47);
					buf.write(JSON.stringify(obj), 51);

					Fs.write(fd, buf, 0, buf.length, 0, function() {
						// console.log(pageindex, meta.documentsize, totaldocuments);
						Fs.close(fd, function() {
							Fs.close(self.fd, function() {
								Fs.copyFile(self.filename, self.filename.replace(/\.gdb$/, NOW.format('_yyyyMMddHHmm') + '.gdp'), function() {
									Fs.rename(self.filename + '-tmp', self.filename, function() {
										callback(null);
									});
								});
							});
						});
					});
				});
			};

			var readvalue = function(docbuf, callback) {
				var data = docbuf.slice(DATAOFFSET, docbuf.readUInt16LE(15) + DATAOFFSET);
				if (docbuf[2] === STATE_COMPRESSED)
					Zlib.inflate(data, ZLIBOPTIONS, (err, data) => callback(data ? data.toString('utf8') : ''));
				else
					callback(data.toString('utf8'));
			};

			var writevalue = function(value, callback) {
				var maxsize = meta.documentsize - DATAOFFSET;
				var data = U.createBuffer(value);
				if (data.length > maxsize) {
					Zlib.deflate(data, ZLIBOPTIONS, (err, data) => callback((!data || data.length > maxsize) ? EMPTYBUFFER : data));
				} else
					callback(data);
			};

			var process = function() {

				pageindex++;

				// ==== DB:PAGE (20b)
				// type (1b)              = from: 0
				// index (1b)             = from: 1
				// documents (2b)         = from: 2
				// freeslots (1b)         = from: 4
				// parentindex (4b)       = from: 5

				// ==== DB:DOCUMENT (SIZE)
				// type (1b)              = from: 0
				// index (1b)             = from: 1
				// state (1b)             = from: 2
				// pageindex (4b)         = from: 3
				// relationindex (4b)     = from: 7  (it's for relations between two documents in TYPE_RELATION page)
				// parentindex (4b)       = from: 11
				// size/count (2b)        = from: 15
				// data                   = from: 17

				var buf = U.createBufferSize(size);

				Fs.read(self.fd, buf, 0, buf.length, offset, function(err, size) {

					if (!size) {
						finish();
						return;
					}

					var newbuf = U.createBufferSize(newsize);

					// Copies page info
					newbuf.fill(buf, 0, self.header.pagesize);
					buf = buf.slice(self.header.pagesize);

					var index = self.header.pagesize;
					var documents = 0;

					(self.header.pagelimit).async(function(i, next) {

						// Unexpected problem
						if (!buf.length) {
							next();
							return;
						}

						var docbuf = buf.slice(0, self.header.documentsize);
						var typeid = docbuf[0];
						var indexid = docbuf[1];

						if (docbuf[2] !== STATE_REMOVED) {
							totaldocuments++;
							documents++;
						}

						if (docbuf[2] !== STATE_REMOVED && meta.classes && typeid === TYPE_CLASS && meta.classes[indexid]) {
							readvalue(docbuf, function(value) {

								// parseData
								// stringifyData
								value = stringifyData(meta.classes[indexid], parseData(self.$classes[indexid].schema, value.split('|')));

								writevalue(value, function(value) {

									if (value === EMPTYBUFFER) {
										// BIG PROBLEM
										docbuf.writeUInt16LE(0, 15);
										docbuf.writeUInt8(STATE_REMOVED, 2);
										documents--;
									} else {
										docbuf.writeUInt16LE(value.length, 15);
										docbuf.fill(value, DATAOFFSET, DATAOFFSET + value.length);
									}

									newbuf.fill(docbuf, index, index + self.header.documentsize);
									index += meta.documentsize;
									buf = buf.slice(self.header.documentsize);
									next();
								});

							});
						} else {
							newbuf.fill(docbuf, index, index + self.header.documentsize);
							index += meta.documentsize;
							buf = buf.slice(self.header.documentsize);
							next();
						}

					}, function() {

						// Update count of documents
						if (newbuf.readUInt16LE(2) !== documents)
							newbuf.writeUInt16LE(documents, 2);

						Fs.write(fd, newbuf, 0, newbuf.length, newoffset, function() {
							offset += size;
							newoffset += newsize;
							setImmediate(process);
						});
					});

				});
			};

			process();
		});
	});
	return self;
};


function $update(doc, value) {
	return value;
}

function $modify(doc, value) {
	var keys = Object.keys(value);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];

		switch (key[0]) {
			case '+':
			case '-':
			case '*':
			case '/':
				var tmp = key.substring(1);
				if (typeof(doc[tmp]) === 'number') {
					if (key[0] === '+')
						doc[tmp] += value[key];
					else if (key[0] === '-')
						doc[tmp] -= value[key];
					else if (key[0] === '*')
						doc[tmp] *= value[key];
					else if (key[0] === '/')
						doc[tmp] = doc[tmp] / value[key];
				}
				break;
			default:
				if (doc[key] != undefined)
					doc[key] = value[key];
				break;
		}
	}
	return doc;
}

GP.remove = function(id, callback) {
	var self = this;
	var rem = { id: id, callback: callback || NOOP };
	self.pending.remove.push(rem);
	self.next(NEXT_REMOVE);
	return self;
};

GP.update = function(id, value, callback) {
	var self = this;
	var upd = { id: id, value: value, fn: typeof(value) === 'function' ? value : $update, callback: callback || NOOP };
	self.pending.update.push(upd);
	self.next(NEXT_UPDATE);
	return self;
};

GP.modify = function(id, value, callback) {
	var self = this;
	var upd = { id: id, value: value, fn: $modify, callback: callback || NOOP };
	self.pending.update.push(upd);
	self.next(NEXT_UPDATE);
	return self;
};

GP.insert = function(name, value, callback) {
	var self = this;
	self.pending.insert.push({ name: name, value: value, callback: callback || NOOP });
	self.next(NEXT_INSERT);
	return self;
};

GP.cursor = function(type, name, callback) {

	var self = this;
	var index;
	var tmp;

	switch (type) {
		case TYPE_CLASS:
			tmp = self.$classes[name];
			index = tmp.pageindex;
			break;
		case TYPE_RELATION:
			tmp = self.$relations[name];
			index = tmp.pageindex;
			break;
	}

	var offset = offsetPage(self, index);
	var buf = U.createBufferSize(PAGESIZE);

	Fs.read(self.fd, buf, 0, buf.length, offset, function(err) {

		if (err) {
			callback(err);
			return;
		}

		if (buf[0] !== TYPE_CLASS) {
			callback(new Error('Invalid page type'));
			return;
		}

		if (buf[1] !== tmp.index) {
			callback(new Error('Invalid type index'));
			return;
		}

		var data = {};
		data.count = buf.readUInt16LE(2);
		data.parent = buf.readUInt32LE(5);
		data.offset = offset;
		data.type = buf[0];
		data.index = buf[1];
		data.freeslots = buf[4];

		data.next = function(callback) {

			if (data.parent == 0) {
				callback(new Error('This is the last page'), data);
				return;
			}

			offset = offsetPage(self, data.parent);
			Fs.read(self.fd, buf, 0, buf.length, offset, function(err) {
				data.count = buf.readUInt16LE(2);
				data.parent = buf.readUInt32LE(5);
				data.offset = offset;
				data.type = buf[0];
				data.index = buf[1];
				data.freeslots = buf[4];
				data.INDEX = getIndexPage(self, offset) + 1;
				callback(err, data);
			});
		};

		data.documents = function(callback) {

			if (!data.count) {
				callback(null, EMPTYARRAY);
				return;
			}

			var index = getIndexPage(self, data.offset) * self.header.pagelimit;
			var buffer = U.createBufferSize(self.header.pagelimit * self.header.documentsize);
			var offset = data.offset + self.header.pagesize;
			var decompress = [];

			index += self.header.pagelimit + 1;

			Fs.read(self.fd, buffer, 0, buffer.length, offset, function(err) {

				if (err) {
					callback(err, EMPTYARRAY);
					return;
				}

				var arr = [];
				while (true) {

					if (!buffer.length)
						break;

					index--;
					var data = buffer.slice(buffer.length - self.header.documentsize);
					// index++;
					// var data = buffer.slice(0, self.header.documentsize);
					if (!data.length)
						break;

					// type (1b)              = from: 0
					// index (1b)             = from: 1
					// state (1b)             = from: 2
					// pageindex (4b)         = from: 3
					// continuerindex (4b)    = from: 7
					// parentindex (4b)       = from: 11
					// size/count (2b)        = from: 15
					// data                   = from: 17

					if (data[2] !== STATE_REMOVED) {
						var raw = data.slice(DATAOFFSET, data.readUInt16LE(15) + DATAOFFSET);
						if (type === TYPE_CLASS) {
							// Document is compressed
							if (data[2] === STATE_COMPRESSED) {
								var obj = {};
								obj.CLASS = tmp.name;
								obj.ID = index;
								obj.BUFFER = raw;
								decompress.push({ CLASS: tmp, ID: index, BUFFER: raw, index: arr.push(null) });
							} else {
								var obj = parseData(tmp.schema, raw.toString('utf8').split('|'));
								obj.CLASS = tmp.name;
								obj.ID = index;
								arr.push(obj);
							}
						}
					}

					buffer = buffer.slice(0, buffer.length - self.header.documentsize);
					// buffer = buffer.slice(self.header.documentsize);
				}

				if (decompress.length) {
					decompress.wait(function(item, next) {
						Zlib.inflate(item.BUFFER, ZLIBOPTIONS, function(err, data) {
							var obj = parseData(item.CLASS.schema, data.toString('utf8').split('|'));
							obj.CLASS = item.CLASS.name;
							obj.ID = item.ID;
							arr[item.index] = obj;
							setImmediate(next);
						});
					}, () => callback(null, arr));
				} else
					callback(null, arr);
			});
		};

		callback(null, data);
	});
};

GP.read = function(index, callback) {
	var self = this;
	var buf = U.createBufferSize(self.header.documentsize);
	Fs.read(self.fd, buf, 0, buf.length, offsetDocument(self, index), function(err) {

		if (err) {
			callback(err);
			return;
		}

		if (buf[2] === STATE_REMOVED) {
			callback(null, buf[0] === TYPE_CLASS ? null : EMPTYARRAY);
			return;
		}

		var tmp;

		switch(buf[0]) {
			case TYPE_CLASS:
				tmp = self.$classes[buf[1]];
				if (tmp) {
					var data = buf.slice(DATAOFFSET, buf.readUInt16LE(15) + DATAOFFSET);
					if (buf[2] === STATE_COMPRESSED) {
						Zlib.inflate(data, ZLIBOPTIONS, function(err, data) {
							data = parseData(tmp.schema, data.toString('utf8').split('|'));
							data.ID = index;
							data.CLASS = tmp.name;
							callback(null, data, buf.readUInt32LE(7), buf.readUInt32LE(11));
						});
					} else {
						data = parseData(tmp.schema, data.toString('utf8').split('|'));
						data.ID = index;
						data.CLASS = tmp.name;
						callback(null, data, buf.readUInt32LE(7), buf.readUInt32LE(11));
					}
				} else
					callback(new Error('GraphDB: invalid document'), null);
				break;
			case TYPE_RELATION:
				tmp = self.$relations[buf[1]];
				if (tmp) {

					var count = buf.readUInt16LE(15);
					var arr = [];
					for (var i = 0; i < count; i++) {
						var off = DATAOFFSET + (i * 6);
						arr.push({ RELATION: tmp.name, ID: buf.readUInt32LE(off + 2), INIT: buf[1], INDEX: i });
					}

					callback(null, arr, buf.readUInt32LE(7), buf.readUInt32LE(11), 'RELATION');

				} else
					callback(new Error('GraphDB: invalid document'), null);
				break;

			case TYPE_RELATION_DOCUMENT:

				var count = buf.readUInt16LE(15);
				var arr = [];

				for (var i = 0; i < count; i++) {
					var off = DATAOFFSET + (i * 6);
					tmp = self.$relations[buf[off]];
					arr.push({ RELATION: tmp.name, ID: buf.readUInt32LE(off + 2), INIT: buf[off + 1], INDEX: i });
				}

				callback(null, arr, buf.readUInt32LE(7), buf.readUInt32LE(11), 'PRIVATE');
				break;

			default:
				callback(null, null);
				break;
		}
	});
};

GP.connect = function(name, indexA, indexB, callback) {
	var self = this;
	self.pending.relation.push({ name: name, indexA: indexA, indexB: indexB, callback: callback, connect: true });
	self.next(NEXT_RELATION);
	return self;
};

GP.disconnect = function(name, indexA, indexB, callback) {
	var self = this;
	self.pending.relation.push({ name: name, indexA: indexA, indexB: indexB, callback: callback });
	self.next(NEXT_RELATION);
	return self;
};

GP.find = function(cls) {
	var self = this;
	var builder = new DatabaseBuilder(self);
	self.pending.find.push({ name: cls, builder: builder });
	setImmediate(self.cb_next, NEXT_FIND);
	return builder;
};

GP.find2 = function(cls) {
	var self = this;
	var builder = new DatabaseBuilder(self);
	self.pending.find.push({ name: cls, builder: builder, reverse: true });
	setImmediate(self.cb_next, NEXT_FIND);
	return builder;
};

GP.scalar = function(cls, type, field) {
	var self = this;
	var builder = new DatabaseBuilder(self);
	builder.scalar(type, field);
	self.pending.find.push({ name: cls, builder: builder });
	setImmediate(self.cb_next, NEXT_FIND);
	return builder;
};

GP.count = function(cls) {
	return this.scalar(cls, 'count', 'ID');
};

function GraphDBFilter(db) {
	var t = this;
	t.db = db;
	t.levels = null;
}

GraphDBFilter.prototype.level = function(num) {
	var self = this;
	if (self.levels == null)
		self.levels = {};
	return self.levels[num] = new DatabaseBuilder(self.db);
};

GraphDBFilter.prototype.prepare = function() {

	var self = this;

	if (!self.levels)
		return self;

	var arr = Object.keys(self.levels);

	for (var i = 0; i < arr.length; i++) {
		var key = arr[i];
		var builder = self.levels[key];
		var filter = {};
		filter.builder = builder;
		filter.scalarcount = 0;
		filter.filter = builder.makefilter();
		filter.compare = builder.compile();
		filter.index = 0;
		filter.count = 0;
		filter.counter = 0;
		filter.first = builder.$options.first && !builder.$options.sort;
		self.levels[key] = filter;
	}

	return self;
};

GP.graph = function(id, options, callback, filter) {

	if (typeof(options) === 'function') {
		callback = options;
		options = EMPTYOBJECT;
	} else if (!options)
		options = EMPTYOBJECT;

	var self = this;

	if (!filter)
		filter = new GraphDBFilter(self);


	self.read(id, function(err, doc, linkid) {

		if (err || !doc) {
			callback(err, null, 0);
			return;
		}

		// options.depth (Int)
		// options.relation (String or String Array)
		// options.class (String or String Array)

		var relations = null;
		var classes = null;

		if (options.relation) {

			var rel;
			relations = {};

			if (options.relation instanceof Array) {
				for (var i = 0; i < options.relation.length; i++) {
					rel = self.$relations[options.relation[i]];
					if (rel)
						relations[rel.name] = rel.both ? 1 : 0;
				}
			} else {
				rel = self.$relations[options.relation];
				if (rel)
					relations[rel.name] = rel.both ? 1 : 0;
			}
		}

		if (options.class) {

			var clstmp;
			classes = {};

			if (options.class instanceof Array) {
				for (var i = 0; i < options.class.length; i++) {
					clstmp = self.$classes[options.class[i]];
					if (clstmp)
						classes[clstmp.name] = 1;
				}
			} else {
				clstmp = self.$classes[options.class];
				if (clstmp)
					classes[clstmp.name] = clstmp.index + 1;
			}
		}

		filter.prepare();

		var pending = [];
		var tmp = {};
		var count = 1;
		var sort = false;

		tmp[id] = 1;

		doc.INDEX = 0;
		doc.LEVEL = 0;
		doc.NODES = [];

		var reader = function(parent, id, depth) {

			if ((options.depth && depth >= options.depth) || (tmp[id])) {
				process();
				return;
			}

			tmp[id] = 1;

			self.read(id, function(err, links, linkid) {

				if (linkid && !tmp[linkid]) {
					pending.push({ id: linkid, parent: parent, depth: depth });
					sort = true;
				}

				// because of seeking on HDD
				links.quicksort('ID');

				var fil;

				links.wait(function(item, next) {

					var key = item.ID + '-' + item.RELATION;

					if (tmp[key] || (relations && relations[item.RELATION] == null) || (!options.all && !item.INIT && !relations) || (relations && relations[item.RELATION] === item.TYPE))
						return next();

					tmp[key] = 1;

					self.read(item.ID, function(err, doc, linkid) {

						if (doc && (!classes || classes[doc.CLASS])) {

							count++;

							doc.INDEX = item.INDEX;
							doc.LEVEL = depth + 1;
							doc.NODES = [];

							var rel = self.$relations[item.RELATION];

							if (rel) {
								// doc.RELATION = rel.relation;
								doc.RELATION = rel.name;
							}

							fil = filter.levels ? filter.levels[depth + 1] : null;

							if (fil) {
								!fil.response && (fil.response = parent.NODES);
								if (!framework_nosql.compare(fil, doc))
									linkid = null;
							} else
								parent.NODES.push(doc);

							if (linkid && !tmp[linkid]) {
								pending.push({ id: linkid, parent: doc, depth: depth + 1 });
								sort = true;
							}
						}

						next();
					});

				}, process);
			});
		};

		var process = function() {

			if (pending.length) {

				// because of seeking on HDD
				if (sort && pending.length > 1) {
					pending.quicksort('id');
					sort = false;
				}

				var item = pending.shift();
				reader(item.parent, item.id, item.depth);

			} else {

				if (filter.levels) {
					var keys = Object.keys(filter.levels);
					for (var i = 0; i < keys.length; i++) {
						var f = filter.levels[keys[i]];
						framework_nosql.callback(f);
					}
				}

				callback(null, doc, count);
			}
		};

		linkid && pending.push({ id: linkid, parent: doc, depth: 0 });
		process();

	}, options.type);

	return filter;
};

function $find(self, cls, builder, reverse) {

	var filter = {};

	filter.builder = builder;
	filter.scalarcount = 0;
	filter.filter = builder.makefilter();
	filter.compare = builder.compile();
	filter.index = 0;
	filter.count = 0;
	filter.counter = 0;
	filter.first = builder.$options.first && !builder.$options.sort;

	var tmp = self.$classes[cls];
	if (!tmp) {
		framework_nosql.callback(filter, 'GraphDB: Class "{0}" is not registered.'.format(cls));
		setImmediate(self.cb_next, NEXT_FIND);
		return;
	}

	var read = function(err, data) {

		if (err || (!data.count && !data.parent)) {
			framework_nosql.callback(filter);
			return;
		}

		data.documents(function(err, docs) {
			for (var i = 0; i < docs.length; i++) {
				var doc = docs[i];
				filter.index++;
				if ((doc && framework_nosql.compare(filter, doc) === false) || (reverse && filter.done)) {
					framework_nosql.callback(filter);
					data.next = null;
					data.documents = null;
					data = null;
					setImmediate(self.cb_next, NEXT_FIND);
					return;
				}
			}
			data.next(read);
		});
	};

	self.cursor(1, tmp.name, read);
}

function parseSchema(schema) {

	var obj = {};
	var arr = schema.split('|').trim();

	obj.meta = {};
	obj.keys = [];
	obj.raw = schema;

	for (var i = 0; i < arr.length; i++) {
		var arg = arr[i].split(':');
		var type = 0;
		switch ((arg[1] || '').toLowerCase().trim()) {
			case 'number':
				type = 2;
				break;
			case 'boolean':
			case 'bool':
				type = 3;
				break;
			case 'date':
				type = 4;
				break;
			case 'object':
				type = 5;
				break;
			case 'string':
			default:
				type = 1;
				break;
		}
		var name = arg[0].trim();
		obj.meta[name] = { type: type, pos: i };
		obj.keys.push(name);
	}

	return obj;
}

function stringifyData(schema, doc) {

	var output = '';
	var esc = false;
	var size = 0;

	for (var i = 0; i < schema.keys.length; i++) {
		var key = schema.keys[i];
		var meta = schema.meta[key];
		var val = doc[key];

		switch (meta.type) {
			case 1: // String
				val = val ? val : '';
				size += 4;
				break;
			case 2: // Number
				val = (val || 0);
				size += 2;
				break;
			case 3: // Boolean
				val = (val == true ? '1' : '0');
				break;
			case 4: // Date
				// val = val ? val.toISOString() : '';
				val = val ? val.getTime() : '';
				!val && (size += 13);
				break;
			case 5: // Object
				val = val ? JSON.stringify(val) : '';
				size += 4;
				break;
		}

		if (!esc && (meta.type === 1 || meta.type === 5)) {
			val += '';
			if (REGTESCAPETEST.test(val)) {
				esc = true;
				val = val.replace(REGTESCAPE, regtescape);
			}
		}

		output += '|' + val;
	}

	return (esc ? '*' : '+') + output;
}

function parseData(schema, lines, cache) {

	var obj = {};
	var esc = lines === '*';
	var val;

	for (var i = 0; i < schema.keys.length; i++) {
		var key = schema.keys[i];

		if (cache && cache !== EMPTYOBJECT && cache[key] != null) {
			obj[key] = cache[key];
			continue;
		}

		var meta = schema.meta[key];
		if (meta == null)
			continue;

		var pos = meta.pos + 1;

		switch (meta.type) {
			case 1: // String
				obj[key] = lines[pos];
				if (esc && obj[key])
					obj[key] = obj[key].replace(REGTUNESCAPE, regtescapereverse);
				break;
			case 2: // Number
				val = +lines[pos];
				obj[key] = val < 0 || val > 0 ? val : 0;
				break;
			case 3: // Boolean
				val = lines[pos];
				obj[key] = BOOLEAN[val] == 1;
				break;
			case 4: // Date
				val = lines[pos];
				obj[key] = val ? new Date(val[10] === 'T' ? val : +val) : null;
				break;
			case 5: // Object
				val = lines[pos];
				if (esc && val)
					val = val.replace(REGTUNESCAPE, regtescapereverse);
				obj[key] = val ? val.parseJSON(true) : null;
				break;
		}
	}

	return obj;
}

function regtescapereverse(c) {
	switch (c) {
		case '%0A':
			return '\n';
		case '%0D':
			return '\r';
		case '%7C':
			return '|';
	}
	return c;
}

function regtescape(c) {
	switch (c) {
		case '\n':
			return '%0A';
		case '\r':
			return '%0D';
		case '|':
			return '%7C';
	}
	return c;
}

exports.load = function(name, size) {
	return new GraphDB(name, size);
};

exports.getImportantOperations = function() {
	return IMPORTATOPERATIONS;
};