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
HEADER: VERSION @Int8, COMPRESSION @Int8, REMOVED @Int8, SIZE @UInt16BE, COUNT @UInt32BE, NAME @StringUTF8
--- 3x TYPES OF RECORD ---
"Node"    : TYPE (0-4) @Int8, SIBLINGID @UInt32BE, SIZE_IN_THE_BUFFER @UInt16BE, DATA @StringUTF8
"Links"   : TYPE (5)   @Int8, SIBLINGID @UInt32BE, COUNT_IN_THE_BUFFER @UInt16BE, [TYPE @Int8 CONNECTION @Int8 + SIBLINGID @UInt32BE]
"Removed" : TYPE (7)   @Int8
*/

// @TODO:
// - check?? if the link doesn't exist
// - removing documents and links (problem)

const Fs = require('fs');
const VERSION = 1;
const EMPTYBUFFER = U.createBufferSize(1);
const DEFSIZE = 150;
const BUFFERSIZE = 100;
const HEADERSIZE = 50;
const DELAY = 100;
const ERRREADY = 'GraphDB "{0}" storage is not ready.';
const DatabaseBuilder = framework_nosql.DatabaseBuilder;

const NODE_REMOVED = 7;
const NODE_LINKS = 5;

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
	t.buffercleaner = [];
	t.pending = {};
	t.removed = EMPTYARRAY;
	t.$events = {};

	t.writing = false;
	t.reading = false;
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

	t.$cb_insert = function(value, callback, id) {
		t.insert(value, callback, id);
	};

	t.$cb_write = function(id, prepare, callback) {
		t.write(id, prepare, callback);
	};

	t.$cb_link = function(id, toid, type, callback) {
		t.link(id, toid, type, callback);
	};

	t.$cb_pushlinkid = function(id, toid, type, relation, callback, parentid) {
		t.pushLinkId(id, toid, type, relation, callback, parentid);
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

	t.$cb_cleaner = function() {
		var ids = t.buffercleaner.splice(0);
		t.$cleaner = null;
		ids.length && t.clean(ids);
	};

	F.path.verify('databases');
	t.open();
}

var GP = GraphDB.prototype;

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
				self.bufferremove = remove;
				callback && callback(null, self.bufferremove);
				F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" scanning (end, {1}s)'.format(self.name, (((Date.now() - now) / 1000) >> 0)));
			}
		});
	};

	next(1);
	return self;
};

GP.clean = function(arr, callback) {

	var self = this;

	if (!self.$ready || self.cleaning) {
		setTimeout(self.$cb_clean, DELAY, arr, callback);
		return self;
	}

	self.cleaning = true;

	var removed = 0;
	var cache = {};
	var now = Date.now();

	F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" cleaning (beg)'.format(self.name));

	for (var i = 0; i < arr.length; i++)
		cache[arr[i]] = 1;

	var done = function() {
		for (var i = 0; i < arr.length; i++) {
			if (self.bufferremove.indexOf(arr[i]) === -1)
				self.bufferremove.push(arr[i]);
		}
		self.writing = false;
		self.flushheader();
		callback && callback(null, removed);
		F.config['nosql-logger'] && PRINTLN('GraphDB "{0}" cleaning (end, {1}s)'.format(self.name, (((Date.now() - now) / 1000) >> 0)));
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

			var count = buf.readUInt16BE(6); // 2b
			var buffer = U.createBufferSize(self.header.size);
			var off = 9;
			var buffercount = 0;
			var is = false;

			for (var i = 0; i < count; i++) {
				var pos = 9 + (i * 6);
				var conn = buf.readUInt32BE(pos + 2);
				if (cache[conn]) {
					removed++;
					is = true;
				} else {
					buffer.writeInt8(buf[pos], off);
					buffer.writeInt8(buf[pos + 1], off + 1);
					buffer.writeUInt32BE(buf.readUInt32BE(pos + 2), off + 2);
					buffercount++;
					off += 6;
				}
			}

			if (is) {

				buffer.writeInt8(buf[0], 0); // type, 1b
				buffer.writeUInt32BE(buf.readUInt32BE(1), 1); // link, 4b
				buffer.writeUInt16BE(buffercount, 6); // count, 2b

				// WRITE
				Fs.write(self.fd, buffer, 0, buffer.length, position, function(err) {
					err && console.log(err);
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
				});
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
	Fs.open(self.filename + '-tmp', 'w', function(err, fd) {
		self.flushheader(function() {

			var index = HEADERSIZE;
			var offset = HEADERSIZE;

			var next = function(done) {
				var buf = U.createBufferSize(self.header.size);
				Fs.read(self.fd, buf, 0, buf.length, index, function(err, size) {
					if (size) {
						var w = U.createBufferSize(docSize);
						buf = buf.slice(0, buf.indexOf(EMPTYBUFFER));
						w.fill(buf, 0, buf.length);
						index += self.header.size;
						Fs.write(fd, w, 0, w.length, offset, function(err, size) {
							err && self.$events.error && self.emit('error', err);
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
							err && self.$events.error && self.emit('error', err);
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
	var buf = U.createBufferSize(HEADERSIZE);

	buf.writeInt8(VERSION, 0); // 1b
	buf.writeInt8(0, 1); // 1b, COMPRESSION 1: true, 0: false
	buf.writeInt8(self.bufferremove.length ? 1 : 0, 2); // 1b, SCAN REMOVED DOCUMENTS 1: true, 0: false
	buf.writeUInt16BE(self.$size, 3); // 2b
	buf.writeUInt32BE(self.header.count || 0, 6); // 4b
	buf.writeUInt32BE(self.header.removed || 0, 10); // 4b

	var str = 'Total.js GraphDB';
	buf.fill(str, 12, str.length + 12);

	Fs.write(fd || self.fd, buf, 0, buf.length, 0, function(err) {
		err && console.log(err);
		callback && callback();
	});

	return self;
};

GP.$open = function() {
	var self = this;
	Fs.open(self.filename, 'r+', function(err, fd) {
		self.fd = fd;
		var buf = U.createBufferSize(HEADERSIZE);
		Fs.read(self.fd, buf, 0, buf.length, 0, function() {
			self.header.version = buf[0];
			self.header.compress = buf[1] === 1;
			self.header.scan = buf[2] === 1;
			self.header.size = buf.readUInt16BE(3);
			self.header.count = buf.readUInt32BE(6);
			self.index = self.header.count + 1;
			if (self.$size > self.header.size) {
				self.resize(self.$size, function() {
					self.open();
				});
			} else {
				if (self.header.count && self.header.scan) {
					self.scan();
					self.$ready = true;
					self.emit('ready');
				} else {
					self.$ready = true;
					self.flush();
					self.emit('ready');
				}
			}
		});
	});
};

GP.close = function() {
	var self = this;
	self.fd && Fs.close(self.fd);
	self.fd = null;
	return self;
};

GP.insert = function(value, callback, id) {

	var self = this;

	if (value instanceof Array)
		throw new Error('GraphDB: You can\'t insert an array.');

	if (value == null)
		throw new Error('GraphDB: Value can\'t be nullable.');

	if (typeof(value) !== 'object')
		throw new Error('GraphDB: A value must be object only.');

	if (self.$ready) {

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

		var type = 0;
		var val = U.createBuffer(stringify(value));

		// 1b TYPE, 4b CONNECTIONSID, 2b DATA-SIZE, DATA
		var res = insert ? U.createBufferSize(self.header.size).fill(val, 8, val.length + 8) : U.createBufferSize(self.header.size - 5).fill(val, 3, val.length + 3);

		if (insert) {
			res.writeInt8(type, 0);
			res.writeUInt32BE(0, 1);
		}

		res.writeUInt16BE(val.length, insert ? 5 : 0);

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
		return id;
	}

	if (callback)
		setTimeout(self.$cb_insert, DELAY, value, callback, id);
	else
		throw new Error(ERRREADY.format(self.name));
};

GP.getLinkId = function(id, callback) {
	var self = this;
	var pos = HEADERSIZE + ((id - 1) * self.header.size);
	var tmp = U.createBufferSize(5);
	Fs.read(self.fd, tmp, 0, tmp.length, pos, function(err, size) {
		callback(err, size && tmp[0] !== NODE_REMOVED ? tmp.readUInt32BE(1) : null);
	});
	return self;
};

GP.setLinkId = function(id, linkid, callback) {
	var self = this;
	var pos = HEADERSIZE + ((id - 1) * self.header.size);
	var buf = U.createBufferSize(4);
	buf.writeUInt32BE(linkid);
	Fs.write(self.fd, buf, 0, buf.length, pos + 1, function(err) {
		err && self.$events.error && self.emit('error', err);
		callback && callback(err);
	});

	return self;
};

GP.pushLinkId = function(id, toid, type, relation, callback, parentid) {

	var self = this;
	var pos = HEADERSIZE + ((id - 1) * self.header.size);
	var buf = U.createBufferSize(self.header.size);
	var max = (self.header.size - 9) / 5 >> 0;

	if (id == null) {

		id = self.index++;

		buf.writeInt8(5); // type, 1b
		buf.writeUInt32BE(parentid || 0, 1); // link, 4b
		buf.writeUInt16BE(1, 6); // count, 2b

		buf.writeInt8(type, 9); // TYPE
		buf.writeInt8(typeof(relation) === 'boolean' ? relation ? 1 : 0 : relation, 10); // RELATION TYPE
		buf.writeUInt32BE(toid, 11);

		self.bufferappend.push(buf);
		self.flush();

		callback && callback(null, id);

	} else {

		Fs.read(self.fd, buf, 0, buf.length, pos, function(err) {

			if (err) {
				callback(err);
				return;
			} else if (buf[0] !== 5) {
				callback(new Error('GraphDB: Invalid value for linking.'));
				return;
			}

			var count = buf.readUInt16BE(6);
			if (count + 1 >= max) {
				// we need to create a new record because existing buffer is full
				self.pushLinkId(0, toid, type, relation, function(err, id) {
					// we return a new id
					callback && callback(err, id);
				}, id);
			} else {
				buf.writeUInt16BE(count + 1, 6);
				var off = 9 + (count * 6);
				buf.writeInt8(type, off);
				buf.writeInt8(typeof(relation) === 'boolean' ? relation ? 1 : 0 : relation, off + 1);
				buf.writeUInt32BE(toid, off + 2);
				Fs.write(self.fd, buf, 0, buf.length, pos, function(err) {
					callback && callback(err, id);
				});
			}
		});
	}

	return self;
};

GP.link = function(fromid, toid, type, relation, callback) {

	var self = this;

	if (self.$ready && !self.pending[fromid] && !self.pending[toid]) {

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
			self.pushLinkId(aid == 0 ? null : aid, toid, type, 1, function(err, id) {
				if (aid !== id) {
					aid = id;
					self.setLinkId(fromid, id, next);
				} else
					next();
			});
		});

		async.push(function(next) {
			self.pushLinkId(bid == 0 ? null : bid, fromid, type, relation, function(err, id) {
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
		setTimeout(self.$cb_link, DELAY, fromid, toid, type, callback);

	return self;
};

GP.setDataType = function(id, type, callback) {
	var self = this;
	var pos = HEADERSIZE + ((id - 1) * self.header.size);
	var buf = U.createBufferSize(1);
	buf.writeInt8(type);
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
			buf.writeInt8(0);
			Fs.write(self.fd, buf, 0, buf.length, offset, function(err) {
				if (err) {
					if (self.$events.error)
						self.emit('error', err);
					else
						F.error(err, 'GraphDB: ' + self.name);
				}
				Fs.write(self.fd, doc.buf, 0, doc.buf.length, offset + 5, self.$cb_writeupdate);
			});
		} else
			Fs.write(self.fd, doc.buf, 0, doc.buf.length, offset + 5, self.$cb_writeupdate);
		return self;
	} else if (!self.bufferappend.length)
		return self;

	var buf = self.bufferappend.splice(0, BUFFERSIZE);
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

	var buf = U.createBufferSize(5);

	Fs.read(self.fd, buf, 0, buf.length, HEADERSIZE + ((id - 1) * self.header.size), function(err, size) {

		if (!size) {
			delete self.pending[id];
			callback && callback(null, 0);
			return;
		}

		if (buf[0] === NODE_REMOVED) {
			// Removed
			delete self.pending[id];
			callback && callback(null, 0);
			return;
		}

		var linkid = buf.readUInt32BE(1);

		// @TODO: missing children linkid
		self.setDataType(id, NODE_REMOVED, function() {
			delete self.pending[id];
			self.$events.remove && self.emit('remove', id);
			callback && callback(null, 1);
			if (linkid) {
				self.setDataType(linkid, NODE_REMOVED, function() {
					self.buffercleaner.push(id);
					self.buffercleaner.push(linkid);
					self.bufferremove.length && self.buffercleaner.push.apply(self.buffercleaner, self.bufferremove);
					self.$cleaner && clearTimeout(self.$cleaner);
					self.$cleaner = setTimeout(self.$cb_cleaner, 5000);
				});
			} else
				self.bufferremove.push(id);
		});
	});

	return self;
};

GP.update = function(id, value, callback) {
	var self = this;
	self.insert(value, callback, id - 1);
	return self;
};

GP.get = GP.read = function(id, callback, type, relation) {
	var self = this;
	if (self.$ready) {

		var buf = U.createBufferSize(self.header.size);
		Fs.read(self.fd, buf, 0, buf.length, HEADERSIZE + ((id - 1) * self.header.size), function(err, size) {

			var linkid = buf.readUInt32BE(1);

			switch (buf[0]) {

				case NODE_REMOVED:
					// 7: REMOVED DOCUMENT
					callback(null, null, 0);
					return;

				case 5: // LINKS

					var count = buf.readUInt16BE(6); // 2b
					var links = [];

					for (var i = 0; i < count; i++) {
						var pos = 9 + (i * 6);
						if (type == null && relation == null)
							links.push({ TYPE: buf[pos], RELATION: buf[pos + 1], ID: buf.readUInt32BE(pos + 2), INDEX: i });
						else if ((type == null || (type == buf[pos]) && (relation == null || (relation == buf[pos + 1]))))
							links.push(buf.readUInt32BE(pos + 2));
					}

					callback(err, links, linkid);
					return;

				case 0:
					if (size) {
						var data = buf.slice(8, buf.readUInt16BE(5) + 8);
						callback(err, data ? (eval('({' + data.toString('utf8') + '})')) : null, linkid);
					} else
						callback(null, null, 0);
					return;
			}
		});
	} else
		setTimeout(self.$cb_get, DELAY, id, callback, type, relation);
	return self;
};

GP.graph = function(id, options, callback) {

	if (typeof(options) === 'function') {
		callback = options;
		options = EMPTYOBJECT;
	} else if (!options)
		options = EMPTYOBJECT;

	var self = this;

	if (!self.$ready || self.reading) {
		setTimeout(self.$cb_graph, DELAY, id, options, callback);
		return self;
	}

	self.reading = true;

	self.read(id, function(err, doc, linkid) {

		if (err || !doc) {
			self.reading = false;
			callback(err, null, 0);
			return;
		}

		// options.depth
		// options.type
		// options.relation

		var pending = [];
		var tmp = {};
		var count = 1;
		var sort = false;

		tmp[id] = 1;

		doc.ID = id;
		doc.INDEX = 0;
		doc.LEVEL = 0;
		doc.NODES = [];

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

				tmp[linkid] = 1;

				// because of seeking on HDD
				links.quicksort('id');

				links.wait(function(item, next) {

					if ((options.type != null && item.TYPE !== options.type) || (options.relation != null && item.RELATION !== options.relation) || tmp[item.ID])
						return next();

					tmp[item.ID] = 1;

					self.read(item.ID, function(err, doc, linkid) {

						count++;

						doc.ID = item.ID;
						doc.INDEX = item.INDEX;
						doc.LEVEL = depth;
						doc.NODES = [];
						doc.RELATION = item.RELATION;
						doc.TYPE = item.TYPE;
						parent.NODES.push(doc);

						if (linkid && !tmp[linkid]) {
							pending.push({ id: linkid, parent: doc, depth: depth });
							sort = true;
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
				reader(item.parent, item.id, item.depth + 1);
			} else {
				self.reading = false;
				callback(null, doc, count);
			}
		};

		linkid && pending.push({ id: linkid, parent: doc, depth: 0 });
		process();

	}, options.type);

	return self;
};

GP.browse = function(beg, end, callback, done) {
	var self = this;

	if (typeof(beg) === 'function') {
		done = end;
		callback = beg;
		end = Number.MAX_SAFE_INTEGER;
		beg = 1;
	} else if (typeof(end) === 'function') {
		done = callback;
		callback = end;
		end = Number.MAX_SAFE_INTEGER;
	}

	if (self.$ready && !self.reading) {
		var counter = 1;
		self.reading = true;
		var reader = function() {
			var buf = U.createBufferSize(self.header.size);
			Fs.read(self.fd, buf, 0, buf.length, HEADERSIZE + ((beg - 1) * self.header.size), function(err, size) {


				if (err || !size) {
					self.reading = false;
					done && done();
					return;
				}

				var output;

				switch (buf[0]) {
					case NODE_REMOVED:
					case NODE_LINKS:
						break;
					case 1:
					case 0:
						output = callback(err, (eval('({' + buf.slice(8, buf.readUInt16BE(5) + 8).toString('utf8') + '})')), buf.readUInt32BE(1), counter);
						break;
				}

				if (output === false || beg >= end) {
					self.reading = false;
					done && done();
				} else {
					counter++;
					beg++;
					reader();
				}
			});
		};
		reader();
	} else
		setTimeout(self.$cb_browse, DELAY, beg, end, callback, done);
	return self;
};

function stringify(obj) {
	var val = JSON.stringify(obj).replace(/"[a-z-0-9]+":/gi, stringifyhelper);
	return val.substring(1, val.length - 1);
}

function stringifyhelper(text) {
	return text.substring(1, text.length - 2) + ':';
}

exports.load = function(name, size) {
	return new GraphDB(name, size);
};