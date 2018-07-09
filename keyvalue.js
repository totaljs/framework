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
 * @module FrameworkKeyValue
 * @version 1.0.0
 */

const Fs = require('fs');
const EMPTYBUFFER = U.createBufferSize(1);
const DEFSIZE = 2000;
const ERRREADY = 'Key/Value "{0}" storage is not ready.';

function KeyValue(name, size) {

	F.path.verify('databases');

	var t = this;
	t.name = name;
	t.filename = F.path.databases(name + '.db');
	t.filenameMeta = t.filename + '-meta';
	t.$ready = false;
	t.$size = size;
	t.header = null;
	t.stat = null;
	t.changes = 0;
	t.bufferappend = [];
	t.bufferupdate = [];
	t.$events = {};

	t.$cb_writeupdate = function(err) {

		if (err) {
			if (t.$events.error)
				t.emit('error', err);
			else
				F.error(err, 'Key-Value: ' + t.name);
		}

		t.stat.mtime = NOW;
		t.writing = false;
		t.flush();
		t.flushmeta();
	};

	t.$cb_writeappend = function(err, size) {

		if (err) {
			if (t.$events.error)
				t.emit('error', err);
			else
				F.error(err, 'Key-Value: ' + t.name);
		}

		t.writing = false;
		t.stat.size += size;
		t.stat.atime = NOW;
		t.header.count += (size / t.header.size) >> 0;
		t.flushheader();
		t.flush();
	};

	t.$cb_get = function(id, callback) {
		t.get(id, callback);
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

	F.path.verify('databases');
	t.open();
}

var RP = KeyValue.prototype;

RP.count = function(callback) {
	callback(null, this.header.count);
	return this;
};

RP.emit = function(name, a, b, c, d, e, f, g) {
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

RP.on = function(name, fn) {
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

RP.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

RP.removeListener = function(name, fn) {
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

RP.removeAllListeners = function(name) {
	if (name === true)
		this.$events = EMPTYOBJECT;
	else if (name)
		this.$events[name] = undefined;
	else
		this.$events[name] = {};
	return this;
};

RP.open = function() {
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
			Fs.readFile(self.filenameMeta, function(err, data) {
				self.meta = err ? {} : data.parseJSON(true);
				!self.meta && (self.meta = { changes: 0 });
				self.changes = self.meta.changes;
				self.stat = stat;
				self.$open();
			});
		}
	});
	return self;
};

RP.resize = function(docSize, callback) {
	var self = this;
	Fs.open(self.filename + '-tmp', 'w', function(err, fd) {
		self.flushheader(function() {

			var index = 200;
			var offset = 200;

			var next = function(done) {
				var buf = U.createBufferSize(self.header.size);
				Fs.read(self.fd, buf, 0, buf.length, index, function(err, size) {
					if (size) {
						var w = U.createBufferSize(docSize);
						buf = buf.slice(0, buf.indexOf(EMPTYBUFFER));
						w.fill(buf, 0, buf.length);
						index += self.header.size;
						Fs.write(fd, w, 0, w.length, offset, function(err, size) {
							offset += size;
							next(done);
						});
					} else
						done();
				});
			};

			next(function() {
				// done
				Fs.close(fd, function() {
					Fs.close(self.fd, function() {
						Fs.rename(self.filename + '-tmp', self.filename, function(err) {
							callback && callback(err);
						});
					});
				});
			});

		}, fd);
	});
	return self;
};

RP.ready = function(callback) {
	var self = this;
	if (self.$ready)
		callback();
	else
		self.on('ready', callback);
	return self;
};

RP.flushmeta = function(callback) {
	var self = this;
	if (self.meta.changes !== self.changes) {
		if (self.changes > 1000000000)
			self.changes = 1;
		self.meta.changes = self.changes;
		Fs.writeFile(self.filenameMeta, JSON.stringify(self.meta), function() {
			callback && callback();
		});
	}
	return self;
};

RP.flushheader = function(callback, fd) {
	var self = this;
	var buf = U.createBufferSize(200);
	var header = U.createBuffer('{"name":"Total.js KeyValue DB","version":"1.0","size":' + (self.$size || DEFSIZE) + ',"count":' + (self.header ? self.header.count : 0) + '}');
	buf.fill(header, 0, header.length);
	Fs.write(fd || self.fd, buf, 0, buf.length, 0, function(err) {
		err && console.log(err);
		callback && callback();
	});
	return self;
};

RP.$open = function() {
	var self = this;
	Fs.open(self.filename, 'r+', function(err, fd) {
		self.fd = fd;
		var buf = U.createBufferSize(200);
		Fs.read(self.fd, buf, 0, 100, 0, function() {
			self.header = buf.slice(0, buf.indexOf(EMPTYBUFFER)).toString('utf8').trim().parseJSON(true);
			self.index = self.header.count + 1;
			if (self.$size !== self.header.size) {
				self.resize(self.$size, function() {
					self.open();
				});
			} else {
				self.$ready = true;
				self.flush();
				self.emit('ready');
			}
		});
	});
};

RP.close = function() {
	var self = this;
	self.fd && Fs.close(self.fd);
	self.fd = null;
	return self;
};

RP.insert = function(value, callback, id) {

	var self = this;
	if (self.$ready) {

		var insert = id == null;

		if (insert) {
			if (self.meta.removed && self.meta.removed.length) {
				id = self.removed.shift();
				insert = false;
			} else
				id = self.index++;
		}

		var type = 1;

		switch (typeof(value)) {
			case 'number':
				type = 2;
				break;
			case 'boolean':
				type = 3;
				break;
			case 'object':
				type = 4;
				break;
		}

		var val = U.createBuffer(type === 4 ? JSON.stringify(value) : value);

		// 1b TYPE, 4b CONNECTIONSID, 2b DATA-SIZE, DATA
		var res = insert ? U.createBufferSize(self.header.size).fill(val, 8, val.length + 8) : U.createBufferSize(self.header.size - 5).fill(val, 3, val.length + 3);

		if (insert) {
			res.writeInt8(type, 0);
			res.writeInt32BE(0, 1);
		}

		res.writeInt16BE(val.length, insert ? 5 : 0);

		if (insert) {
			self.bufferappend.push(res);
			self.$events.insert && self.emit('insert', id, value);
		} else {
			self.bufferupdate.push({ buf: res, pos: id, type: type });
			self.$events.update && self.emit('update', id, value);
		}

		self.flush();
		callback && callback(null, id);
		return id;
	}

	if (callback)
		setTimeout(self.$cb_insert, 100, value, callback, id);
	else
		throw new Error(ERRREADY.format(self.name));
};

RP.getLinkId = function(id, callback) {
	var self = this;
	var pos = 200 + ((id - 1) * self.header.size);
	var tmp = U.createBufferSize(4);
	Fs.read(self.fd, tmp, 0, tmp.length, pos + 1, (err) => callback(err, tmp.readInt32BE(0)));
	return self;
};

RP.setLinkId = function(id, linkid, callback) {
	var self = this;
	var pos = 200 + ((id - 1) * self.header.size);
	var buf = U.createBufferSize(4);
	buf.writeInt32BE(linkid);
	Fs.write(self.fd, buf, 0, buf.length, pos + 1, function(err, size) {
		callback && callback(err);
	});
	return self;
};

RP.pushLinkId = function(id, toid, type, callback, parentid) {

	var self = this;
	var pos = 200 + ((id - 1) * self.header.size);
	var buf = U.createBufferSize(self.header.size);
	var max = (self.header.size - 9) / 5 >> 0;

	if (id == null) {

		id = self.index++;

		buf.writeInt8(5); // type, 1b
		buf.writeInt32BE(parentid || 0, 1); // link, 4b
		buf.writeInt16BE(1, 6); // count, 2b

		// TYPE, ID
		buf.writeInt8(type, 9);
		buf.writeInt32BE(toid, 10);

		self.bufferappend.push(buf);
		self.flush();
		callback && callback(null, id);

	} else {

		Fs.read(self.fd, buf, 0, buf.length, pos, function(err) {

			if (err) {
				callback(err);
				return;
			} else if (buf[0] !== 5) {
				callback(new Error('Invalid value type for linking.'));
				return;
			}

			var count = buf.readInt16BE(6);
			if (count + 1 >= max) {
				// we need to create new record because existing buffer is full
				self.pushLinkId(0, toid, type, function(err, id) {
					// we return new id
					callback && callback(err, id);
				}, id);
				return;
			}

			buf.writeInt16BE(count + 1, 6);

			var off = 9 + (count * 5);
			buf.writeInt8(type, off);
			buf.writeInt32BE(toid, off + 1);

			Fs.write(self.fd, buf, 0, buf.length, pos, function(err) {
				callback && callback(err, id);
			});
		});
	}

	return self;
};

RP.link = function(fromid, toid, type, callback) {
	var self = this;
	if (self.$ready) {

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
				callback(new Error('Value (from) with "{0}" id does not exist'.format(fromid)));
			} else if (bid == null) {
				async.length = 0;
				next = null;
				callback(new Error('Value (to) with "{0}" id does not exist'.format(toid)));
			} else
				next();
		});

		async.push(function(next) {
			self.pushLinkId(aid == 0 ? null : aid, toid, type, function(err, id) {
				if (aid !== id)
					self.setLinkId(fromid, id, next);
				else
					next();
			});
		});

		async.push(function(next) {
			self.pushLinkId(bid == 0 ? null : bid, fromid, type, function(err, id) {
				if (bid !== id)
					self.setLinkId(toid, id, next);
				else
					next();
			});
		});

		async.async(function() {
			console.log('DONE');
			callback && callback(null);
		});

	} else
		setTimeout(self.$cb_link, 100, fromid, toid, type, callback);

	return self;
};

RP.flush = function() {

	var self = this;

	if (!self.$ready || self.writing)
		return self;

	if (self.bufferupdate.length) {
		self.writing = true;
		var doc = self.bufferupdate.shift();
		var offset = 200 + (doc.pos * self.header.size);
		Fs.write(self.fd, doc.buf, 0, doc.buf.length, offset + 5, self.$cb_writeupdate);
		return self;
	} else if (!self.bufferappend.length)
		return self;

	var buf = self.bufferappend.splice(0, 10);
	var data = Buffer.concat(buf);
	self.writing = true;
	Fs.write(self.fd, data, 0, data.length, self.stat.size, self.$cb_writeappend);
	return self;
};

RP.remove = function(id) {
	var self = this;
	if (self.meta.removed)
		self.meta.removed.push(id);
	else
		self.meta.removed = [id];
	self.changes++;
	self.flushmeta();
	self.$events.remove && self.emit('remove', id);
	return self;
};

RP.update = function(id, value, callback) {
	var self = this;
	self.insert(value, callback, id - 1);
	return self;
};

RP.traverse = function(id, type, callback) {
	var self = this;
	self.read(id, function(err, doc, linkid) {
		console.log(arguments);
	});
	return self;
};

RP.get = RP.read = function(id, callback) {
	var self = this;
	if (self.$ready) {
		var buf = U.createBufferSize(self.header.size);
		Fs.read(self.fd, buf, 0, buf.length, 200 + ((id - 1) * self.header.size), function(err, size) {
			var linkid = buf.readInt32BE(1);
			var data = buf[0] !== 5 ? (size ? buf.slice(8, buf.readInt16BE(5) + 8).toString('utf8') : null) : null;
			switch (buf[0]) {
				case 5: // LINKS

					var count = buf.readInt16BE(6); // 2b
					var links = [];

					for (var i = 0; i < count; i++) {
						var pos = 9 + (i * 5);
						links.push({ type: buf[pos], id: buf.readInt32BE(pos + 1) });
					}

					callback(err, links, linkid);
					break;
				case 4: // JSON
					callback(err, data ? data.parseJSON(true) : null, linkid);
					break;
				case 3: // BOOLEAN
					callback(err, data ? data === 'true' : false, linkid);
					break;
				case 2: // NUMBER
					callback(err, data ? +data : 0, linkid);
					break;
				case 1: // STRING
				default:
					callback(err, data ? data : '', linkid);
					break;
			}
		});
	} else
		setTimeout(self.$cb_get, 100, id, callback);
	return self;
};

RP.browse = function(beg, end, callback, done) {
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

	if (self.$ready) {
		var counter = 1;
		var reader = function() {
			var buf = U.createBufferSize(self.header.size);
			Fs.read(self.fd, buf, 0, buf.length, 200 + ((beg - 1) * self.header.size), function(err, size) {

				if (err || !size) {
					done && done();
					return;
				}

				size = buf.readInt16BE(1) + 4;

				var output;
				var data = buf.slice(4, size).toString('utf8');

				switch (buf[0]) {
					case 5: // LINKS
						break;
					case 4: // JSON
						output = callback(err, data.parseJSON(true), counter);
						break;
					case 3: // BOOLEAN
						output = callback(err, data === 'true', counter);
						break;
					case 2: // NUMBER
						output = callback(err, +data, counter);
						break;
					case 1: // STRING
					default:
						output = callback(err, data, counter);
						break;
				}

				if (output === false || beg >= end) {
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
		setTimeout(self.$cb_browse, 100, beg, end, callback, done);
	return self;
};

exports.load = function(name, size) {
	return new KeyValue(name, size);
};