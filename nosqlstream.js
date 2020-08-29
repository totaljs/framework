// Copyright 2018-2020 (c) Peter Širka <petersirka@gmail.com>
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
 * @module NoSQL Stream
 * @version 1.2.0
 */

require('./index');

const Fs = require('fs');
const BUFFERSIZE = 1024 * 32;
const BUFFERDOCS = 15;
const NEWLINEBUFFER = Buffer.from('\n', 'utf8');
const DEFSTATS = { size: 0 };

function NoSQLStream(filename) {
	this.filename = filename;
	this.fd = null;
	this.stats = DEFSTATS;
	this.type = null;
	this.bytesread = 0;
	this.ticks = 0;
	this.position = 0;
	this.cache = [null, null];
	this.buffer = null;
	this.divider = ',';
	this.remchar = '-';
	this.buffercount = BUFFERDOCS;
	this.buffersize = BUFFERSIZE;
	this.linesize = 0;
	this.start = 0;
	this.indexer = 0;
	// this.canceled = false;
	// this.docs = '';
	// this.docscount = 0;
}

const NoSQLStreamProto = NoSQLStream.prototype;

// Because of performance
NoSQLStreamProto.readhelpers = function() {

	var self = this;

	self.cb_read = function() {
		self.read();
	};

	self.cb_readbuffer = function(err, size, chunk) {

		self.position += size;

		var beg = 0;

		if (self.buffer) {
			self.cache[0] = self.buffer;
			self.cache[1] = chunk;

			beg = self.buffer.length - 1;

			if (beg < 0)
				beg = 0;

			self.buffer = Buffer.concat(self.cache);

		} else
			self.buffer = chunk;

		var index = self.buffer.lastIndexOf(NEWLINEBUFFER);
		if (index === -1) {
			self.read();
			return;
		}

		var tmp = self.buffer.toString('utf8', 0, index).split('\n');
		for (var i = 0; i < tmp.length; i++) {
			if (tmp[i][0] !== self.remchar) {
				if (self.array)
					self.docs.push(tmp[i]);
				else
					self.docs += (self.docs ? self.divider : '') + tmp[i];
				self.docscount++;
				self.indexer++;
			}
		}

		self.buffer = self.buffer.slice(index + 1);

		if (self.ondocuments() === false)
			self.canceled = true;

		self.docs = self.array ? [] : '';
		self.docscount = 0;
		self.ticks++;

		if (self.ticks % 5 === 0)
			setImmediate(self.cb_readticks);
		else
			self.read();
	};

	self.cb_readticks = function() {
		self.read();
	};

	self.cb_readreverse = function() {
		self.readreverse2();
	};

	self.cb_readreversebuffer = function(err, size, chunk) {

		self.bytesread += size;

		if (self.buffer) {
			self.cache[0] = chunk;
			self.cache[1] = self.buffer;
			self.buffer = Buffer.concat(self.cache);
		} else
			self.buffer = chunk;

		var index = self.buffer.indexOf(NEWLINEBUFFER);
		if (index === -1) {
			self.readreverse2();
			return;
		}

		var tmp = self.buffer.toString('utf8', index).trim().split('\n');
		for (var i = 0; i < tmp.length; i++) {
			if (tmp[i][0] !== self.remchar) {
				if (self.array)
					self.docs.push(tmp[i]);
				else
					self.docs += (self.docs ? self.divider : '') + tmp[i];
				self.docscount++;
				self.indexer++;
			}
		}

		if (self.ondocuments() === false)
			self.canceled = true;

		// self.buffer = self.buffer.slice(0, index + 1);
		self.buffer = self.buffer.slice(0, index + 1);
		self.docs = self.array ? [] : '';
		self.docscount = 0;
		self.ticks++;

		if (self.ticks % 5 === 0)
			setImmediate(self.cb_readreverseticks);
		else
			self.readreverse2();
	};

	self.cb_readreverseticks = function() {
		self.readreverse2();
	};

	self.cb_readstream = function(chunk) {

		if (self.canceled)
			return;

		var beg = 0;

		if (self.buffer) {

			self.cache[0] = self.buffer;
			self.cache[1] = chunk;
			self.buffer = Buffer.concat(self.cache);
			beg = self.cache[0].length - 1;

			if (beg < 0)
				beg = 0;
		} else
			self.buffer = chunk;

		var index = self.buffer.lastIndexOf(NEWLINEBUFFER);
		if (index === -1)
			return;

		var tmp = self.buffer.toString('utf8', 0, index).split('\n');
		for (var i = 0; i < tmp.length; i++) {
			if (tmp[i][0] !== self.remchar) {
				if (self.array)
					self.docs.push(tmp[i]);
				else
					self.docs += (self.docs ? self.divider : '') + tmp[i];
				self.docscount++;
				self.indexer++;
			}
		}

		self.buffer = self.buffer.slice(index + 1);

		if (self.ondocuments() === false)
			self.canceled = true;

		if (self.canceled) {
			self.stream.destroy && self.stream.destroy();
		} else {
			self.docs = self.array ? [] : '';
			self.docscount = 0;
			self.ticks++;
		}
	};

};

// Because of performance
NoSQLStreamProto.writehelpers = function() {

	var self = this;

	self.cb_writeAddUpdAdd = function(err, size) {
		if (err) {
			console.log('ERROR --> NoSQLstream.writer (add)', err);
			self.canceled = true;
			self.bufferstacknew.length = 0;
			self.bufferstack.length = 0;
			self.writing = false;
		} else {
			self.positionappend += size;
			var item = self.bufferstack.shift();
			Fs.write(self.fd, item.data, item.position, 'utf8', self.cb_writeAddUpdUpd);
		}
	};

	self.cb_writeAddUpdUpd = function(err) {

		self.writing = false;

		if (err) {
			console.log('ERROR --> NoSQLstream.writer (upd)', err);
			self.canceled = true;
			self.bufferstack.length = 0;
			self.bufferstacknew.length = 0;
		} else
			self.$write();
	};

	self.cb_writeAdd = function(err, size) {

		self.writing = false;
		self.positionappend += size;

		if (err) {
			console.log('ERROR --> NoSQLstream.writer (add)', err);
			self.canceled = true;
		} else
			self.$write();
	};

	self.cb_writeUpd = function(err) {

		self.writing = false;

		if (err) {
			console.log('ERROR --> NoSQLstream.writer (upd)', err);
			self.canceled = true;
		} else
			self.$write();
	};

	self.cb_flush = function() {
		self.flush();
	};

	self.cb_readwritebuffer2 = function(err, size, chunk) {

		self.position += size;

		var beg = 0;
		var index;

		if (self.buffer) {
			self.cache[0] = self.buffer;
			self.cache[1] = chunk;

			beg = self.buffer.length - 1;

			if (beg < 0)
				beg = 0;

			self.buffer = Buffer.concat(self.cache);
		} else
			self.buffer = chunk;

		if (self.linesize) {
			while (self.buffer.length >= self.linesize) {

				var tmp = self.buffer.toString('utf8', 0, self.linesize - 1);

				if (self.array)
					self.docs.push(tmp);
				else
					self.docs += (self.docs ? self.divider : '') + tmp;

				self.docsbuffer.push({ length: self.linesize - 1, doc: tmp, position: self.positionupdate });
				self.docscount++;

				if (self.docsbuffer.length >= self.buffercount) {

					if (self.ondocuments() === false)
						self.canceled = true;

					self.docsbuffer = [];
					self.docs = self.array ? [] : '';

					if (self.canceled)
						break;
				}

				self.positionupdate += self.linesize;
				self.buffer = self.buffer.slice(self.linesize);
			}

		} else {

			index = self.buffer.indexOf(NEWLINEBUFFER, beg);
			while (index !== -1) {
				var tmp = self.buffer.toString('utf8', 0, index);

				if (tmp[0] !== self.remchar) {

					if (self.array)
						self.docs.push(tmp);
					else
						self.docs += (self.docs ? self.divider : '') + tmp;

					self.docsbuffer.push({ length: index, doc: tmp, position: self.positionupdate });
					self.docscount++;
					if (self.docsbuffer.length >= self.buffercount) {
						if (self.ondocuments() === false)
							self.canceled = true;
						self.docsbuffer = [];
						self.docs = self.array ? [] : '';
						if (self.canceled)
							break;
					}
				}

				self.positionupdate += Buffer.byteLength(tmp, 'utf8') + 1;
				self.buffer = self.buffer.slice(index + 1);
				index = self.buffer.indexOf(NEWLINEBUFFER);
				if (index === -1)
					break;
			}
		}

		if (self.bufferstack.length || self.bufferstacknew.length)
			setImmediate(self.cb_writeticks);
		else
			self.readupdate();
	};

	self.cb_readwritebuffer = function(err, size, chunk) {

		self.position += size;

		var beg = 0;
		var index;

		if (self.buffer) {
			self.cache[0] = self.buffer;
			self.cache[1] = chunk;
			beg = self.buffer.length - 1;
			if (beg < 0)
				beg = 0;
			self.buffer = Buffer.concat(self.cache);
		} else
			self.buffer = chunk;


		var index = self.buffer.lastIndexOf(NEWLINEBUFFER);
		if (index === -1) {
			self.readupdate();
			return;
		}

		var tmp = self.buffer.toString('utf8', 0, index).split('\n');
		for (var i = 0; i < tmp.length; i++) {
			var size = Buffer.byteLength(tmp[i], 'utf8');
			if (tmp[i][0] !== self.remchar) {
				if (self.array)
					self.docs.push(tmp[i]);
				else
					self.docs += (self.docs ? self.divider : '') + tmp[i];
				self.docsbuffer.push({ length: size, doc: tmp[i], position: self.positionupdate });
				self.docscount++;
				self.indexer++;
			}
			self.positionupdate += size + 1;
		}

		if (self.ondocuments() === false)
			self.canceled = true;

		self.docsbuffer = [];
		self.docs = self.array ? [] : '';
		self.buffer = self.buffer.slice(index + 1);

		if (self.bufferstack.length || self.bufferstacknew.length)
			setImmediate(self.cb_writeticks);
		else
			self.readupdate();
	};

	self.cb_writeticks = function() {
		if (self.bufferstack.length || self.bufferstacknew.length)
			setImmediate(self.cb_writeticks);
		else
			self.readupdate();
	};
};

NoSQLStreamProto.openread = function() {
	var self = this;
	self.type = 'r';
	self.position = self.start;
	self.open();
	return self;
};

NoSQLStreamProto.openreadreverse = function() {
	var self = this;
	self.type = 'r';
	self.position = self.start;
	self.$reverse = true;
	self.open();
	return self;
};

NoSQLStreamProto.openupdate = function() {
	var self = this;
	self.type = 'r+';
	F.stats.performance.open++;
	Fs.open(self.filename, self.type, function(err, fd) {

		if (err) {
			self.$callback(err);
			return;
		}

		Fs.fstat(fd, function(err, stats) {

			self.docs = self.array ? [] : '';
			self.docscount = 0;

			if (err) {
				Fs.close(fd, NOOP);
				self.$callback(err);
				return;
			}

			self.docs = self.array ? [] : '';
			self.docscount = 0;
			self.fd = fd;
			self.stats = stats;
			self.position = self.start;
			self.positionappend = self.stats.size;
			self.positionupdate = self.start;
			self.bufferstack = [];
			self.bufferstacknew = [];
			self.docsbuffer = [];
			self.writehelpers();
			self.readupdate();
		});
	});

	return self;
};

// For e.g. files on URL address
NoSQLStreamProto.openstream = function(stream) {

	var self = this;

	var close = function() {
		if (self.docscount) {
			self.ondocuments();
			self.docscount = 0;
			self.docs = self.array ? [] : '';
		}
		self.$callback && self.$callback();
		self.$callback = null;
	};

	self.docs = self.array ? [] : '';
	self.docscount = 0;
	self.readhelpers();
	self.stream = stream;
	self.stream.on('error', close);
	self.stream.on('end', close);
	self.stream.on('data', self.cb_readstream);
	return self;
};

NoSQLStreamProto.open = function() {
	var self = this;
	F.stats.performance.open++;
	Fs.open(self.filename, self.type, function(err, fd) {

		if (err) {
			self.$callback(err);
			return;
		}

		Fs.fstat(fd, function(err, stats) {
			self.docs = self.array ? [] : '';
			self.docscount = 0;
			self.fd = fd;
			self.stats = stats;
			self.position = self.start;

			if (err) {
				Fs.close(fd, NOOP);
				self.$callback(err);
				return;
			}

			self.readhelpers();

			if (self.$reverse)
				self.readreverse();
			else
				self.read();
		});
	});
};

NoSQLStreamProto.close = function() {

	var self = this;

	if (self.fd) {

		self.stream = null;

		Fs.close(self.fd, function(err) {
			err && F.error(err);
			self.$callback && self.$callback();
		});

		if (self.buffer) {
			self.buffer = null;
			self.cache[0] = null;
			self.cache[1] = null;
			self.bytesread = 0;
		}

		self.canceled = false;
		self.fd = null;
		self.type = null;
		self.docscache = null;
		self.docs = null;

	} else if (self.$callback)
		self.$callback && self.$callback();

	return self;
};

NoSQLStreamProto.write = function(doc, position) {
	var self = this;
	self.bufferstack.push({ position: position, data: doc });
	!self.writing && self.$write();
	return self;
};

NoSQLStreamProto.write2 = function(doc) {
	var self = this;
	self.bufferstacknew.push(Buffer.from(doc));
	!self.writing && self.$write();
	return self;
};

NoSQLStreamProto.$write = function() {
	var self = this;
	if (self.bufferstacknew.length && self.bufferstack.length) {
		self.writing = true;
		var buf = self.bufferstacknew.splice(0, 5);
		buf = buf.length > 1 ? Buffer.concat(buf) : buf[0];
		Fs.write(self.fd, buf, 0, buf.length, self.positionappend, self.cb_writeAddUpdAdd);
	} else if (self.bufferstacknew.length) {
		self.writing = true;
		var buf = self.bufferstacknew.splice(0, 5);
		buf = buf.length > 1 ? Buffer.concat(buf) : buf[0];
		Fs.write(self.fd, buf, 0, buf.length, self.positionappend, self.cb_writeAdd);
	} else if (self.bufferstack.length) {
		self.writing = true;
		var item = self.bufferstack.shift();
		Fs.write(self.fd, item.data, item.position, 'utf8', self.cb_writeUpd);
	}
};

NoSQLStreamProto.flush = function() {
	var self = this;
	if (self.writing)
		setTimeout(self.cb_flush, 100);
	else
		self.close();
	return self;
};

NoSQLStreamProto.read = function() {

	var self = this;
	var size = self.stats.size - self.position;


	if (!self.fd || size <= 0 || self.canceled) {

		if (!self.canceled && self.buffer && self.buffer.length) {
			self.cb_readbuffer(null, 1, NEWLINEBUFFER);
			self.buffer = Buffer.alloc(0);
			return;
		}

		if (self.docscount) {
			self.ondocuments();
			self.docscount = 0;
			self.docs = self.array ? [] : '';
		}

		self.close();

	} else {
		size = size < self.buffersize ? size : self.buffersize;
		var buffer = Buffer.alloc(size);
		Fs.read(self.fd, buffer, 0, size, self.position, self.cb_readbuffer);
	}
};

NoSQLStreamProto.readreverse = function() {
	var self = this;
	self.position = self.stats.size;
	self.readreverse2();
	return self;
};

NoSQLStreamProto.readreverse2 = function() {
	var self = this;

	if (!self.fd || self.position <= self.start || self.canceled) {

		if (!self.canceled && self.buffer && self.buffer.length) {
			self.cb_readreversebuffer(null, 1, NEWLINEBUFFER);
			self.buffer = Buffer.alloc(0);
			return;
		}

		if (self.docscount) {
			self.ondocuments();
			self.docs = self.array ? [] : '';
			self.docscount = 0;
		}

		self.close();

	} else {
		var size = self.stats.size - self.bytesread;
		size = size < self.buffersize ? size : self.buffersize;
		self.position -= size;
		var buffer = Buffer.alloc(size);
		Fs.read(self.fd, buffer, 0, size, self.position, self.cb_readreversebuffer);
	}
};

NoSQLStreamProto.readupdate = function() {

	var self = this;
	var size = self.stats.size - self.position;

	if (!self.fd || size <= 0 || self.canceled) {

		if (!self.canceled && self.buffer && self.buffer.length) {
			self.positionappend++;
			self.cb_readwritebuffer(null, 1, NEWLINEBUFFER);
			self.buffer = Buffer.alloc(0);
			return;
		}

		if (self.docsbuffer.length) {
			self.ondocuments();
			self.docsbuffer = [];
			self.docs = self.array ? [] : '';
		}

		self.flush();
	} else {
		size = size < self.buffersize ? size : self.buffersize;
		var buffer = Buffer.alloc(size);
		Fs.read(self.fd, buffer, 0, size, self.position, self.cb_readwritebuffer);
	}
};

module.exports = NoSQLStream;