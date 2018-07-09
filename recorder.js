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
 * @module FrameworkRecorder
 * @version 1.0.0
 */

const Fs = require('fs');
const EMPTYBUFFER = U.createBufferSize(1);
const DEFSIZE = 1000;
const ERRREADY = 'Recorder "{0}" is not ready.';

function Recorder(name, size) {

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
				F.error(err, 'Recorder: ' + t.name);
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
				F.error(err, 'Recorder: ' + t.name);
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

	t.$cb_browse = function(beg, end, callback, done) {
		t.browse(beg, end, callback, done);
	};

	t.$cb_insert = function(value, callback, id) {
		t.insert(value, callback, id);
	};

	F.path.verify('databases');
	t.open();
}

var RP = Recorder.prototype;

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
	var header = U.createBuffer('{"name":"Total.js RecorderDB","version":"1.0","size":' + (self.$size || DEFSIZE) + ',"count":' + (self.header ? self.header.count : 0) + '}');
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

		// - 3 because of "type" (1 byte) + "length of value" (2 bytes) = 3 bytes
		var res = U.createBufferSize(self.header.size).fill(val, 4, val.length + 4);
		res.writeInt8(type);
		res.writeInt16BE(val.length, 1);

		if (insert) {
			self.bufferappend.push(res);
			self.$events.insert && self.emit('insert', id, value);
		} else {
			self.bufferupdate.push({ buf: res, pos: id });
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

RP.flush = function() {

	var self = this;

	if (!self.$ready || self.writing)
		return self;

	if (self.bufferupdate.length) {
		self.writing = true;
		var doc = self.bufferupdate.shift();
		Fs.write(self.fd, doc.buf, 0, doc.buf.length, 200 + (doc.pos * self.header.size), self.$cb_writeupdate);
		return self;
	} else if (!self.bufferappend.length)
		return self;

	var buf = self.bufferappend.splice(0, 15);
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

RP.get = RP.read = function(id, callback) {
	var self = this;
	if (self.$ready) {
		var buf = U.createBufferSize(self.header.size);
		Fs.read(self.fd, buf, 0, buf.length, 200 + ((id - 1) * self.header.size), function(err, size) {
			var data = size ? buf.slice(4, buf.readInt16BE(1) + 4).toString('utf8') : null;
			switch (buf[0]) {
				case 4: // JSON
					callback(err, data ? data.parseJSON(true) : null);
					break;
				case 3: // BOOLEAN
					callback(err, data ? data === 'true' : false);
					break;
				case 2: // NUMBER
					callback(err, data ? +data : 0);
					break;
				case 1: // STRING
				default:
					callback(err, data ? data : '');
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
	return new Recorder(name, size);
};