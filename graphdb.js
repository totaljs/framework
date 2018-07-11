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

/*
HEADER: VERSION @Int8, COMPRESSION @Int8, SCAN @Int8, CLASSINDEX @Int8, RELATIONINDEX @Int8, SIZE @UInt16BE, COUNT @UInt32BE, NAME @StringUTF8
CLASSES RAW JSON
--- 3x TYPES OF RECORD ---
"Node"    : TYPE (0)    @Int8, RELATIONID @UInt32BE, PARENTID @UInt32BE, SIZE_IN_THE_BUFFER @UInt16BE, DATA @StringUTF8
"Links"   : TYPE (254)  @Int8, RELATIONID @UInt32BE, PARENTID @UInt32BE, COUNT_IN_THE_BUFFER @UInt16BE, [TYPE @Int8 CONNECTION @Int8 + SIBLINGID @UInt32BE]
"Removed" : TYPE (255)  @Int8
*/

const DEFSIZE = 500;
const Fs = require('fs');
const VERSION = 1;
const EMPTYBUFFER = U.createBufferSize(1);
const BUFFERSIZE = 10;
const INFOSIZE = 50;
const METASIZE = 10240;
const HEADERSIZE = INFOSIZE + METASIZE;
const DELAY = 100;
const DatabaseBuilder = framework_nosql.DatabaseBuilder;
const REGDATE = /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d+Z"/g;
const REGKEY = /"[a-z-0-9]+":/gi;
const REGTUNESCAPE = /%7C|%0D|%0A/g;
const REGTESCAPETEST = /\||\n|\r/;
const REGTESCAPE = /\||\n|\r/g;
const MAXREADERS = 3;
const BOOLEAN = { '1': 1, 'true': 1, 'on': 1 };

const NODE_REMOVED = 255;
const NODE_LINKS = 254;

function GraphDB(name, size) {

	F.path.verify('databases');

	var t = this;
	t.name = name;
	t.filename = F.path.databases(name + '.db');
	t.$ready = false;
	t.$size = size || DEFSIZE;

	t.header = {};
	t.stat = null;
	t.bufferappend = [];
	t.bufferupdate = [];
	t.bufferremove = [];
	t.pending = {};
	t.removed = EMPTYARRAY;
	t.$events = {};
	t.$classes = {};
	t.$relations = {};
	t.writing = false;
	t.reading = 0;
	t.cleaning = false;

	t.$cb_writeupdate = function(err) {

		if (err) {
			if (t.$events.error)
				t.emit('error', err);
			else
				F.error(err, 'GraphDB: ' + t.name);
		}

		t.stat.mtime = NOW;
		t.writing = false;
		t.flush();
	};

	t.$cb_writeappend = function(err, size) {

		if (err) {
			if (t.$events.error)
				t.emit('error', err);
			else
				F.error(err, 'GraphDB: ' + t.name);
		}

		t.writing = false;
		t.stat.size += size;
		t.stat.atime = NOW;
		t.header.count += (size / t.header.size) >> 0;
		t.flushheader();
		t.flush();
	};

	t.$cb_get = function(id, callback, type) {
		t.get(id, callback, type);
	};

	t.$cb_read2 = function(id, callback) {
		t.read2(id, callback);
	};

	t.$cb_browse = function(beg, end, callback, done) {
		t.browse(beg, end, callback, done);
	};

	t.$cb_insert = function(type, value, callback, id) {
		t.insert(type, value, callback, id);
	};

	t.$cb_write = function(id, prepare, callback) {
		t.write(id, prepare, callback);
	};

	t.$cb_join = function(type, id, toid, callback) {
		t.join(type, id, toid, callback);
	};

	t.$cb_pushlinkid = function(id, toid, type, relation, callback, parentid) {
		pushLinkId(t, id, toid, type, relation, callback, parentid);
	};

	t.$cb_getlinkid = function(id, callback) {
		t.getLinkId(id, callback);
	};

	t.$cb_setlinkid = function(id, linkid, callback) {
		t.setLinkId(id, linkid, callback);
	};

	t.$cb_remove = function(id, callback) {
		t.remove(id, callback);
	};

	t.$cb_clean = function(arr, callback) {
		t.clean(arr, callback);
	};

	t.$cb_graph = function(id, options, callback, builder) {
		t.graph(id, options, callback, builder);
	};

	t.$cb_class = function(name, declaration, indexer) {
		t.class(name, declaration, indexer);
	};

	t.$cb_relation = function(name, both, indexer) {
		t.relation(name, both, indexer);
	};

	t.$cb_find = function(type, builder, reverse) {
		if (reverse)
			t.find2(type, builder);
		else
			t.find(type, builder);
	};

	F.path.verify('databases');
	t.open();
}

var GP = GraphDB.prototype;

function extendclass(self, type, old) {

	if (self.$ready && self.reading < MAXREADERS) {

		var size = self.header.size * self.header.buffersize;
		var index = 0;
		var now = Date.now();
		var cls = self.$classes[type];

		F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" extending class "{1}" (beg)'.format(self.name, cls.name));

		old = parseSchema(old);
		self.reading++;

		var errhandling = F.error();

		var reader = function() {

			var buf = U.createBufferSize(size);
			var offset = HEADERSIZE + (index * self.header.size);
			var current = index;

			index += self.header.buffersize;

			Fs.read(self.fd, buf, 0, buf.length, offset, function(err, size) {

				if (err || !size) {
					self.reading--;
					self.flushmeta();
					F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" extending class "{1}" (end, {2}s)'.format(self.name, cls.name, (((Date.now() - now) / 1000) >> 0)));
					return;
				}

				while (true) {

					var buffer = buf.slice(0, self.header.size);
					if (!buffer.length)
						break;

					current++;

					switch (buffer[0]) {
						case NODE_REMOVED:
						case NODE_LINKS:
							break;
						case type:
							var docsize = buffer.readUInt16BE(9);
							if (docsize) {
								var data = parseData(old, buffer.slice(11, docsize + 11).toString('utf8').split('|'));
								self.insert(type, data, errhandling, current);
							}
							break;
					}

					buf = buf.slice(self.header.size);
				}

				setImmediate(reader);
			});
		};

		setImmediate(reader);
	} else
		setTimeout(extendclass, DELAY, self, type, old);
}

GP.errorhandling = function(err, type) {
	console.log('GraphDB "{0}" --> "{1}" error: {2}'.format(name, err, type));
	this.$events.error && this.emit('error', err);
};

GP.class = function(name, declaration, indexer) {

	var self = this;
	if (self.$ready || indexer) {

		var meta = parseSchema(declaration);
		var cls = self.$classes[name];

		meta.name = name;

		if (cls) {
			if (cls.raw !== meta.raw) {
				meta.index = cls.index;
				self.$classes[cls.index] = self.$classes[name] = meta;
				extendclass(self, meta.index, cls.raw, meta.raw);
			}
		} else {

			var index = indexer;
			if (indexer == null) {
				self.header.classindex++;
				index = self.header.classindex;
			}

			meta.index = index;
			self.$classes[index] = self.$classes[name] = meta;

			if (indexer == null)
				self.$flushmeta();
		}

	} else
		setTimeout(self.$cb_class, DELAY, name, declaration, indexer);

	return self;
};

GP.classes = function(callback) {
	var self = this;
	var items = [];
	for (var i = 0; i < self.header.classindex; i++) {
		var item = self.$classes[i + 1];
		item && items.push(item.name);
	}
	callback(null, items);
	return self;
};

GP.relation = function(name, both, indexer) {

	var self = this;
	if (self.$ready || indexer) {

		var rel = self.$relations[name];
		if (rel) {

			if (both === true && !rel.relation)
				self.$flushmeta();

		} else {

			rel = {};

			var index = indexer;
			if (indexer == null) {
				self.header.relationindex++;
				index = self.header.relationindex;
			}

			rel.index = index;
			rel.name = name;
			rel.relation = both ? 1 : 0;
			self.$relations[index] = self.$relations[name] = rel;

			if (indexer == null)
				self.$flushmeta();
		}

	} else
		setTimeout(self.$cb_relation, DELAY, name, both, indexer);

	return self;
};

GP.relations = function(callback) {
	var self = this;
	var items = [];
	for (var i = 0; i < self.header.relationindex; i++) {
		var item = self.$relations[i + 1];
		item && items.push(item.name);
	}
	callback(null, items);
	return self;
};

GP.scan = function(callback) {

	var self = this;
	var remove = [];
	var now = Date.now();

	F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" scanning (beg)'.format(self.name));

	var next = function(index) {
		var buf = U.createBufferSize(1);
		Fs.read(self.fd, buf, 0, buf.length, HEADERSIZE + ((index - 1) * self.header.size), function(err, size) {
			if (size) {
				buf[0] === NODE_REMOVED && remove.push(index);
				if (index % 5 === 0)
					setImmediate(() => next(index + 1));
				else
					next(index + 1);
			} else {
				callback && callback(null, remove);
				F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" scanning (end, {1}s)'.format(self.name, (((Date.now() - now) / 1000) >> 0)));
			}
		});
	};

	next(1);
	return self;
};

GP.clean = function(callback) {

	var self = this;

	if (!self.$ready || self.cleaning) {
		setTimeout(self.$cb_clean, DELAY, callback);
		return self;
	}

	self.cleaning = true;

	self.scan(function(err, arr) {

		if (!arr.length) {
			callback && callback(null, 0);
			return;
		}

		F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" cleaning (beg)'.format(self.name));

		var removed = 0;
		var cache = {};
		var now = Date.now();

		for (var i = 0; i < arr.length; i++)
			cache[arr[i]] = 1;

		var done = function() {
			for (var i = 0; i < arr.length; i++) {
				if (self.bufferremove.indexOf(arr[i]) === -1)
					self.bufferremove.push(arr[i]);
			}
			self.header.scan = false;
			self.writing = false;
			self.flushheader();
			callback && callback(null, removed);
			F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" cleaning (end, {1}s)'.format(self.name, (((Date.now() - now) / 1000) >> 0)));
			self.emit('clean', removed);
		};

		var next = function(index) {
			var buf = U.createBufferSize(self.header.size);
			var position = HEADERSIZE + ((index - 1) * self.header.size);

			Fs.read(self.fd, buf, 0, buf.length, position, function(err, size) {

				if (err || !size) {
					done();
					return;
				}

				if (buf[0] !== NODE_LINKS) {
					next(index + 1);
					return;
				}

				var id = buf.readUInt32BE(1);

				// Are removed links?
				if (cache[id] && buf[0] === NODE_REMOVED) {
					next(index + 1);
					return;
				}

				var count = buf.readUInt16BE(9); // 2b
				var buffer = U.createBufferSize(self.header.size);
				var off = 11;
				var buffercount = 0;
				var is = false;

				for (var i = 0; i < count; i++) {
					var pos = 11 + (i * 6);
					var conn = buf.readUInt32BE(pos + 2);
					if (cache[conn]) {
						removed++;
						is = true;
					} else {
						buffer.writeUInt8(buf[pos], off);
						buffer.writeUInt8(buf[pos + 1], off + 1);
						buffer.writeUInt32BE(buf.readUInt32BE(pos + 2), off + 2);
						buffercount++;
						off += 6;
					}
				}

				if (is) {

					buffer.writeUInt8(buf[0], 0); // type, 1b
					buffer.writeUInt32BE(buf.readUInt32BE(1), 1); // link, 4b
					buffer.writeUInt16BE(buffercount, 6); // count, 2b

					// WRITE
					Fs.write(self.fd, buffer, 0, buffer.length, position, function(err) {
						err && self.errorhandling(err, 'clean.write');
						next(index + 1);
					});

				} else {
					if (size)
						next(index + 1);
					else
						done();
				}
			});
		};

		next(1);

	});
	return self;
};

GP.count = function(callback) {
	callback(null, this.header.count);
	return this;
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

GP.open = function() {
	var self = this;
	Fs.stat(self.filename, function(err, stat) {
		if (err) {
			Fs.open(self.filename, 'w', function(err, fd) {
				self.fd = fd;
				self.flushheader(function() {
					Fs.close(self.fd, function() {
						self.open();
					});
				}, fd);
			});
		} else {
			self.stat = stat;
			self.$open();
		}
	});
	return self;
};

GP.resize = function(docSize, callback) {
	var self = this;
	var now = Date.now();
	F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" resizing (beg)'.format(self.name));
	Fs.open(self.filename + '-tmp', 'w', function(err, fd) {
		self.flushheader(function() {

			var index = HEADERSIZE;
			var offset = HEADERSIZE;

			var next = function(done) {
				var buf = U.createBufferSize(self.header.size);
				Fs.read(self.fd, buf, 0, buf.length, index, function(err, size) {
					if (size) {
						var w = U.createBufferSize(docSize);
						w.fill(buf, 0, buf.length);
						index += self.header.size;
						Fs.write(fd, w, 0, w.length, offset, function(err, size) {
							err && self.errorhandling(err, 'resize.write');
							offset += size;
							next(done);
						});
					} else
						done();
				});
			};

			next(function() {
				Fs.close(fd, function() {
					Fs.close(self.fd, function() {
						Fs.rename(self.filename + '-tmp', self.filename, function(err) {
							F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" resizing (end, {1}s)'.format(self.name, (((Date.now() - now) / 1000) >> 0)));
							err && self.errorhandling(err, 'resize.rename');
							callback && callback(err);
						});
					});
				});
			});

		}, fd);
	});
	return self;
};

GP.ready = function(callback) {
	var self = this;
	if (self.$ready)
		callback();
	else
		self.on('ready', callback);
	return self;
};

GP.flushheader = function(callback, fd) {

	var self = this;
	var buf = U.createBufferSize(INFOSIZE);

	buf.writeUInt8(VERSION, 0); // 1b
	buf.writeUInt8(0, 1); // 1b, COMPRESSION 1: true, 0: false
	buf.writeUInt8(self.header.scan ? 1 : 0, 2); // 1b, SCAN REMOVED DOCUMENTS 1: true, 0: false
	buf.writeUInt8(self.header.classindex ? self.header.classindex : 0, 3); // 1b
	buf.writeUInt8(self.header.relationindex ? self.header.relationindex : 0, 4); // 1b
	buf.writeUInt16BE(self.$size, 5); // 2b
	buf.writeUInt32BE(self.header.count || 0, 8); // 4b
	buf.writeUInt32BE(self.header.removed || 0, 12); // 4b

	var str = 'Total.js GraphDB';
	buf.fill(str, 13, str.length + 13);

	Fs.write(fd || self.fd, buf, 0, buf.length, 0, function(err) {
		err && self.errorhandling(err, 'flushheader.write');
		if (fd)
			self.flushmeta(callback, fd);
		else
			callback && callback();
	});

	return self;
};

GP.$flushmeta = function() {
	var self = this;
	self.$flushmetadelay && clearImmediate(self.$flushmetadelay);
	self.$flushmetadelay = setImmediate(self => self.flushmeta(), self);
};

GP.flushmeta = function(callback, fd) {

	var self = this;
	var buf = U.createBufferSize(METASIZE);
	var meta = {};
	self.$flushmetadelay = null;

	meta.c = []; // classes
	meta.r = []; // relations

	if (self.header.classindex) {
		for (var i = 0; i < self.header.classindex; i++) {
			var item = self.$classes[i + 1];
			item && meta.c.push({ i: i + 1, n: item.name, r: item.raw });
		}
		var b = U.createBufferSize(1);
		b.writeUInt8(self.header.classindex);
		Fs.write(fd || self.fd, b, 0, 1, 3, NOOP);
	}

	if (self.header.relationindex) {
		for (var i = 0; i < self.header.relationindex; i++) {
			var item = self.$relations[i + 1];
			item && meta.r.push({ i: i + 1, n: item.name, r: item.relation });
		}
		var b = U.createBufferSize(1);
		b.writeUInt8(self.header.relationindex);
		Fs.write(fd || self.fd, b, 0, 1, 4, NOOP);
	}

	var data = JSON.stringify(meta);
	buf.fill(data, 0, data.length);

	Fs.write(fd || self.fd, buf, 0, buf.length, INFOSIZE, function(err) {
		err && self.errorhandling(err, 'flushmeta.write');
		callback && callback();
	});

	return self;
};

GP.$open = function() {
	var self = this;
	Fs.open(self.filename, 'r+', function(err, fd) {
		self.fd = fd;
		var buf = U.createBufferSize(INFOSIZE);
		Fs.read(self.fd, buf, 0, buf.length, 0, function() {

			self.header.version = buf[0];
			self.header.compress = buf[1] === 1;
			self.header.scan = buf[2] === 1;
			self.header.classindex = buf[3];
			self.header.relationindex = buf[4];
			self.header.size = buf.readUInt16BE(5);
			self.header.count = buf.readUInt32BE(8);
			self.header.buffersize = ((1024 / self.header.size) * BUFFERSIZE) >> 0;

			if (self.header.buffersize < 1)
				self.header.buffersize = 1;

			self.index = self.header.count + 1;

			buf = U.createBufferSize(METASIZE);
			Fs.read(self.fd, buf, 0, buf.length, INFOSIZE, function() {

				var data = buf.slice(0, buf.indexOf(EMPTYBUFFER)).toString('utf8').parseJSON();
				if (data) {
					// registering classes
					if (data.r instanceof Array) {
						for (var i = 0; i < data.c.length; i++) {
							var item = data.c[i];
							self.class(item.n, item.r, item.i);
						}
					}
					// registering relations
					if (data.r instanceof Array) {
						for (var i = 0; i < data.r.length; i++) {
							var item = data.r[i];
							self.relation(item.n, item.r, item.i);
						}
					}
				}

				if (self.$size > self.header.size) {
					self.resize(self.$size, () => self.open());
				} else {
					self.$ready = true;
					self.flush();
					self.emit('ready');
				}
			});
		});
	});
};

GP.close = function() {
	var self = this;
	self.fd && Fs.close(self.fd);
	self.fd = null;
	return self;
};

GP.insert = function(type, value, callback, id) {

	var self = this;

	if (typeof(type) === 'object') {
		callback = value;
		value = type;
		type = 0;
	}

	if (value instanceof Array) {
		callback && callback(new Error('GraphDB: You can\'t insert an array.'));
		return self;
	} else if (value == null) {
		callback && callback(new Error('GraphDB: Value can\'t be nullable.'));
		return self;
	} else if (typeof(value) !== 'object') {
		callback && callback(new Error('GraphDB: A value must be object only.'));
		return self;
	} else if (type > 253) {
		callback && callback(new Error('GraphDB: Illegal class value "{0}"'.format(type)));
		return self;
	}

	if (self.$ready) {

		var val;

		if (type) {
			var schema = self.$classes[type];
			if (!schema) {
				callback && callback(new Error('GraphDB: Schema "{0}" not found.'.format(name)));
				return self;
			}
			val = U.createBuffer(stringifyData(schema, value));
			type = schema.index;
		} else
			val = U.createBuffer(stringify(value));

		if (val.length > self.header.size - 11) {
			callback(new Error('GraphDB: Data too long.'));
			return self;
		}

		var insert = id == null;
		var recovered = false;

		if (insert) {
			if (self.bufferremove && self.bufferremove.length) {
				id = self.bufferremove.shift();
				insert = false;
				recovered = true;
			} else
				id = self.index++;
		}

		var res = insert ? U.createBufferSize(self.header.size).fill(val, 11, val.length + 11) : U.createBufferSize(self.header.size - 9).fill(val, 2, val.length + 2);

		if (insert) {
			res.writeUInt8(type, 0);
			res.writeUInt32BE(0, 1); // RELATIONID
			res.writeUInt32BE(0, 5); // PARENTID
		}

		res.writeUInt16BE(val.length, insert ? 9 : 0);

		if (insert) {
			self.bufferappend.push(res);
			self.$events.insert && self.emit('insert', id, value);
		} else {

			self.bufferupdate.push({ buf: res, pos: id - 1, type: type, recovered: recovered });

			// because of seeking on HDD
			if (self.bufferupdate.length > 1)
				self.bufferupdate.quicksort('pos');

			self.$events.update && self.emit('update', id, value);
		}

		self.flush();
		callback && callback(null, id);
	} else
		setTimeout(self.$cb_insert, DELAY, type, value, callback, id);

	return self;
};

GP.getLinkId = function(id, callback) {
	var self = this;
	var pos = HEADERSIZE + ((id - 1) * self.header.size);
	var tmp = U.createBufferSize(4);
	Fs.read(self.fd, tmp, 0, tmp.length, pos + 1, function(err, size) {
		callback(err, size && tmp[0] !== NODE_REMOVED ? tmp.readUInt32BE(0) : null);
	});
	return self;
};

GP.setLinkId = function(id, linkid, callback) {
	var self = this;
	var pos = HEADERSIZE + ((id - 1) * self.header.size);
	var buf = U.createBufferSize(4);
	buf.writeUInt32BE(linkid);
	Fs.write(self.fd, buf, 0, buf.length, pos + 1, function(err) {
		err && self.errorhandling(err, 'setLinkId.write');
		callback && callback(err);
	});

	return self;
};

function pushLinkId(self, id, toid, type, initializer, callback, parentid) {

	var pos = HEADERSIZE + ((id - 1) * self.header.size);
	var buf = U.createBufferSize(self.header.size);
	var max = (self.header.size - 11) / 6 >> 0; // 6b --> TYPE 1b + RELATION 1b + ID 4b

	if (id == null) {

		id = self.index++;

		buf.writeUInt8(NODE_LINKS); // type, 1b
		buf.writeUInt32BE(parentid || 0, 1); // link, 4b
		buf.writeUInt32BE(id, 5); // parent, 4b
		buf.writeUInt16BE(1, 9); // count, 2b

		buf.writeUInt8(type, 11); // TYPE
		buf.writeUInt8(initializer ? 1 : 0, 12); // RELATION TYPE
		buf.writeUInt32BE(toid, 13);

		self.bufferappend.push(buf);
		self.flush();

		callback && callback(null, id);

	} else {

		Fs.read(self.fd, buf, 0, buf.length, pos, function(err) {

			if (err) {
				callback(err);
				return;
			} else if (buf[0] !== NODE_LINKS) {
				callback(new Error('GraphDB: Invalid value for linking.'));
				return;
			}

			var count = buf.readUInt16BE(9);
			if (count + 1 >= max) {
				// we need to create a new record because existing buffer is full
				pushLinkId(self, null, toid, type, initializer, function(err, id) {
					// we return a new id
					callback && callback(err, id);
				}, id);
			} else {
				buf.writeUInt16BE(count + 1, 9); // count, 2b
				var off = 11 + (count * 6);
				buf.writeUInt8(type, off);
				buf.writeUInt8(initializer ? 1 : 0, off + 1);
				buf.writeUInt32BE(toid, off + 2);
				Fs.write(self.fd, buf, 0, buf.length, pos, function(err) {
					callback && callback(err, id);
				});
			}
		});
	}

	return self;
}

GP.join = function(type, fromid, toid, callback) {

	var self = this;

	if (self.$ready && !self.pending[fromid] && !self.pending[toid]) {

		var relation = self.$relations[type];
		if (relation == null) {
			callback(new Error('GraphDB: relation "{0}" not found'.format(type)));
			return self;
		}

		self.pending[fromid] = 1;
		self.pending[toid] = 1;

		var async = [];
		var aid = 0;
		var bid = 0;

		async.push(function(next) {
			self.getLinkId(fromid, function(err, id) {
				aid = err ? null : id;
				next();
			});
		});

		async.push(function(next) {
			self.getLinkId(toid, function(err, id) {
				bid = err ? null : id;
				next();
			});
		});

		async.push(function(next) {

			if (aid == null) {
				async.length = 0;
				next = null;
				callback(new Error('GraphDB node (from) with "id:{0}" doesn\'t exist'.format(fromid)));
			} else if (bid == null) {
				async.length = 0;
				next = null;
				callback(new Error('GraphDB node (to) with "id:{0}" doesn\'t exist'.format(toid)));
			} else
				next();

			if (next == null) {
				delete self.pending[fromid];
				delete self.pending[toid];
			}
		});

		// relation: 1/true - they know each other
		// relation: 0 - "toid" doesn't know "fromid"

		async.push(function(next) {

			pushLinkId(self, aid == 0 ? null : aid, toid, relation.index, true, function(err, id) {
				if (aid !== id) {
					aid = id;
					self.setLinkId(fromid, id, next);
				} else
					next();
			});
		});

		async.push(function(next) {
			pushLinkId(self, bid == 0 ? null : bid, fromid, relation.index, false, function(err, id) {
				if (bid !== id) {
					bid = id;
					self.setLinkId(toid, id, next);
				} else
					next();
			});
		});

		async.async(function() {
			delete self.pending[fromid];
			delete self.pending[toid];
			callback && callback(null, aid, bid);
		});

	} else
		setTimeout(self.$cb_join, DELAY, type, fromid, toid, callback);

	return self;
};

GP.setDataType = function(id, type, callback) {
	var self = this;
	var pos = HEADERSIZE + ((id - 1) * self.header.size);
	var buf = U.createBufferSize(1);
	buf.writeUInt8(type);
	Fs.write(self.fd, buf, 0, buf.length, pos, function(err) {
		callback && callback(err);
	});
	return self;
};

GP.flush = function() {

	var self = this;

	if (!self.$ready || self.writing)
		return self;

	if (self.bufferupdate.length) {
		self.writing = true;
		var doc = self.bufferupdate.shift();
		var offset = HEADERSIZE + (doc.pos * self.header.size);
		if (doc.recovered) {
			var buf = U.createBufferSize(1);
			buf.writeUInt8(doc.type);
			Fs.write(self.fd, buf, 0, buf.length, offset, function(err) {
				if (err) {
					if (self.$events.error)
						self.emit('error', err);
					else
						F.error(err, 'GraphDB: ' + self.name);
				}
				Fs.write(self.fd, doc.buf, 0, doc.buf.length, offset + 9, self.$cb_writeupdate);
			});
		} else
			Fs.write(self.fd, doc.buf, 0, doc.buf.length, offset + 9, self.$cb_writeupdate);
		return self;
	} else if (!self.bufferappend.length)
		return self;

	var buf = self.bufferappend.splice(0, self.header.buffersize);
	var data = Buffer.concat(buf);
	self.writing = true;
	Fs.write(self.fd, data, 0, data.length, self.stat.size, self.$cb_writeappend);
	return self;
};

GP.remove = function(id, callback) {
	var self = this;

	if (!self.$ready || self.pending[id]) {
		setTimeout(self.$cb_remove, DELAY, id, callback);
		return self;
	}

	self.pending[id] = 1;

	var removed = [];

	var done = function() {
		removed.wait(function(id, next) {
			self.setDataType(id, NODE_REMOVED, function() {
				self.$events.remove && self.emit('remove', id);
				next();
			});
		}, function() {
			delete self.pending[id];
			callback && callback(null, removed.length);
		});
	};

	var find = function(id, level) {
		var buf = U.createBufferSize(5);
		Fs.read(self.fd, buf, 0, buf.length, HEADERSIZE + ((id - 1) * self.header.size), function(err, size) {

			if (!size || buf[0] === NODE_REMOVED) {
				done();
				return;
			}

			removed.push(id);

			var link = buf.readUInt32BE(1);
			if (link)
				find(link, level + 1);
			else {
				// Doesn't have any relations, it's free
				if (level === 0)
					self.bufferremove.push(id);
				done();
			}
		});
	};

	find(id, 0);
	return self;
};

GP.update = function(id, value, callback) {
	var self = this;
	self.read(id, function(err, doc, linkid, cls) {
		if (err || !doc)
			callback(err, null);
		else
			self.insert(cls, typeof(value) === 'function' ? value(doc) : doc, callback, id);
	});
	return self;
};

GP.update2 = function(cls, id, value, callback) {
	var self = this;
	self.insert(cls, value, callback, id);
	return self;
};

GP.modify = function(id, value, callback) {
	var self = this;
	self.read(id, function(err, doc) {

		var data = framework_builders.isSchema(value) ? value.$clean() : value;
		var keys = Object.keys(data);
		var is = false;

		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			switch (key[0]) {
				case '+':
				case '-':
				case '*':
				case '/':
					var tmp = key.substring(1);
					if (typeof(doc[tmp]) === 'number') {
						if (key[0] === '+') {
							doc[tmp] += data[key];
							is = true;
						} else if (key[0] === '-') {
							doc[tmp] -= data[key];
							is = true;
						} else if (key[0] === '*') {
							doc[tmp] *= data[key];
							is = true;
						} else if (key[0] === '/') {
							doc[tmp] = doc[tmp] / data[key];
							is = true;
						}
					}
					break;
				default:
					if (doc[key] != undefined) {
						doc[key] = data[key];
						is = true;
					}
					break;
			}
		}

		if (is)
			self.insert(0, doc, callback, id);
		else
			callback(null, id);
	});

	return self;
};

GP.get = GP.read = function(id, callback, type, relation) {
	var self = this;
	if (self.$ready && self.reading < MAXREADERS) {

		self.reading++;
		var buf = U.createBufferSize(self.header.size);
		Fs.read(self.fd, buf, 0, buf.length, HEADERSIZE + ((id - 1) * self.header.size), function(err, size) {

			self.reading--;
			var linkid = buf.readUInt32BE(1);

			switch (buf[0]) {
				case NODE_REMOVED:
					// 255: REMOVED DOCUMENT
					callback(null, null, 0);
					return;

				case NODE_LINKS:

					// 254: LINKS
					var count = buf.readUInt16BE(9); // 2b
					var links = [];

					for (var i = 0; i < count; i++) {
						var pos = 11 + (i * 6);
						if (type == null && relation == null)
							links.push({ RELATION: buf[pos], TYPE: buf[pos + 1], ID: buf.readUInt32BE(pos + 2), INDEX: i });
						else if ((type == null || (type == buf[pos]) && (relation == null || (relation == buf[pos + 1]))))
							links.push(buf.readUInt32BE(pos + 2));
					}
					callback(err, links, linkid);
					return;

				default:
					if (size) {
						var data = buf.slice(11, buf.readUInt16BE(9) + 11);
						if (buf[0] == 0)
							callback(err, (eval('({' + data.toString('utf8') + '})')), linkid, buf[0]);
						else {
							var schema = self.$classes[buf[0]];
							if (schema)
								callback(err, parseData(schema, data.toString('utf8').split('|')), linkid, schema.name);
							else
								callback(new Error('GraphDB: Class not found.'), null, 0, 0);
						}
					} else
						callback(null, null, 0, 0);
					return;
			}
		});
	} else
		setTimeout(self.$cb_get, DELAY, id, callback, type, relation);

	return self;
};

GP.find = function(type, builder) {
	var self = this;
	var builder = new DatabaseBuilder(self);
	if (self.$ready && self.reading < MAXREADERS)
		setImmediate($find, self, type, builder);
	else
		setTimeout(self.$cb_find, DELAY, type, builder);
	return builder;
};

GP.find2 = function(type, builder) {
	var self = this;
	var builder = new DatabaseBuilder(self);
	if (self.$ready && self.reading < MAXREADERS)
		setImmediate($find, self, type, builder, true);
	else
		setTimeout(self.$cb_find, DELAY, type, builder, true);
	return builder;
};

function $find(self, type, builder, reverse) {

	self.reading++;

	var index = reverse ? (self.header.count - 1) : 0;
	var size = self.header.size * self.header.buffersize;
	var filter = {};

	filter.builder = builder;
	filter.scalarcount = 0;
	filter.filter = builder.makefilter();
	filter.compare = builder.compile();
	filter.index = 0;
	filter.count = 0;
	filter.counter = 0;
	filter.first = builder.$options.first && !builder.$options.sort;

	var classes = null;

	if (type) {

		var cls;
		classes = {};

		if (type instanceof Array) {
			for (var i = 0; i < type.length; i++) {
				cls = self.$classes[type[i]];
				if (cls)
					classes[cls.index] = 1;
			}
		} else {
			cls = self.$classes[type];
			if (cls)
				classes[cls.index] = 1;
		}
	}

	var reader = function() {

		var buf = U.createBufferSize(size);
		var offset = HEADERSIZE + (index * self.header.size);

		if (reverse)
			index -= self.header.buffersize;
		else
			index += self.header.buffersize;

		Fs.read(self.fd, buf, 0, buf.length, offset, function(err, size) {

			if (err || !size) {
				self.reading--;
				framework_nosql.callback(filter);
				return;
			}

			while (true) {

				var buffer = buf.slice(0, self.header.size);
				if (!buffer.length)
					break;

				switch (buffer[0]) {
					case NODE_REMOVED:
					case NODE_LINKS:
						break;
					default:
						if (!classes || classes[buffer[0]]) {
							var docsize = buffer.readUInt16BE(9);
							if (docsize) {

								filter.index++;

								var data = buffer.slice(11, docsize + 11).toString('utf8');
								var doc;

								if (buffer[0] == 0)
									doc = (eval('({' + data + '})'));
								else {
									var schema = self.$classes[buffer[0]];
									if (schema) {
										doc = parseData(schema, data.split('|'));
										doc.CLASS = schema.name;
									}
								}

								if ((doc && framework_nosql.compare(filter, doc) === false) || (reverse && filter.done)) {
									self.reading--;
									framework_nosql.callback(filter);
									return;
								}
							}
						}
						break;
				}

				buf = buf.slice(self.header.size);
			}

			setImmediate(reader);
		});
	};

	setImmediate(reader);
}

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

	if (!self.$ready || self.reading >= MAXREADERS) {
		setTimeout(self.$cb_graph, DELAY, id, options, callback, filter);
		return filter;
	}

	self.reading++;

	self.read(id, function(err, doc, linkid, cls) {

		if (err || !doc) {
			self.reading--;
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
						relations[rel.index] = rel.relation;
				}
			} else {
				rel = self.$relations[options.relation];
				if (rel)
					relations[rel.index] = rel.relation;
			}
		}

		if (options.class) {

			var cls;
			classes = {};

			if (options.class instanceof Array) {
				for (var i = 0; i < options.class.length; i++) {
					cls = self.$classes[options.class[i]];
					if (cls)
						classes[cls.index] = 1;
				}
			} else {
				cls = self.$classes[options.class];
				if (cls)
					classes[cls.index] = cls.class + 1;
			}
		}

		filter.prepare();

		var pending = [];
		var tmp = {};
		var count = 1;
		var sort = false;

		tmp[id] = 1;

		doc.ID = id;
		doc.INDEX = 0;
		doc.LEVEL = 0;
		doc.NODES = [];

		if (cls)
			doc.CLASS = cls;

		var reader = function(parent, id, depth) {

			if ((options.depth && depth > options.depth) || (tmp[id])) {
				process();
				return;
			}

			self.read(id, function(err, links, linkid) {

				if (linkid && !tmp[linkid]) {
					pending.push({ id: linkid, parent: parent, depth: depth });
					sort = true;
				}

				// because of seeking on HDD
				links.quicksort('id');

				var fil;

				links.wait(function(item, next) {

					var key = item.ID + '-' + item.RELATION;

					if (tmp[key] || (relations && relations[item.RELATION] == null) || (!options.all && relations && !item.TYPE && relations[item.RELATION] === item.TYPE))
						return next();

					tmp[key] = 1;

					self.read(item.ID, function(err, doc, linkid, cls) {

						if (doc && (!classes || classes[cls])) {

							count++;
							doc.ID = item.ID;
							doc.INDEX = item.INDEX;
							doc.LEVEL = depth + 1;
							doc.NODES = [];

							var rel = self.$relations[item.RELATION];

							if (rel) {
								// doc.RELATION = rel.relation;
								doc.RELATION = rel.name;
							}

							if (cls)
								doc.CLASS = cls;

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

				self.reading--;
				callback(null, doc, count);
			}
		};

		linkid && pending.push({ id: linkid, parent: doc, depth: 0 });
		process();

	}, options.type);

	return filter;
};

function stringify(obj) {
	var val = JSON.stringify(obj).replace(REGKEY, stringifykey).replace(REGDATE, stringifydate);
	return val.substring(1, val.length - 1);
}

function stringifykey(text) {
	return text.substring(1, text.length - 2) + ':';
}

function stringifydate(text) {
	return 'new Date(' + new Date(text.substring(1, text.length - 2)).getTime() + ')';
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