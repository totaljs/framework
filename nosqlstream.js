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
 * @module NoSQL Stream
 * @version 1.0.0
 */

require('./index');

const Fs = require('fs');
const BUFFERSIZE = 1024 * 32;
const BUFFERDOCS = 15;
const NEWLINEBUFFER = framework_utils.createBuffer('\n', 'utf8');
const NEWLINE = '\n';
const DEFSTATS = { size: 0 };

function NoSQLStream(filename) {
	this.filename = filename;
	this.fd = null;
	this.stats = DEFSTATS;
	this.type = null;
	this.bytesread = 0;
	this.position = 0;
	this.cache = [null, null];
	this.buffer = null;
	// this.canceled = false;
	// this.docs = '';
	// this.docscount = 0;
	// this.docscache = '';
	// this.indexer = 0;
	// this.fdwrite = null;
}

NoSQLStream.prototype.openread = function(callback) {
	var self = this;
	self.type = 'r';
	self.position = 0;
	self.open(callback);
	return self;
};

NoSQLStream.prototype.openupdate = function(callback) {
	var self = this;
	self.type = 'r';
	self.open(function(err) {

		// File may not exist
		if (err) {
			callback();
			return;
		}

		self.position = 0;
		self.bufferstack = [];
		self.changed = false;

		Fs.open(self.filename + '-tmp', 'w', function(err, fd) {

			if (err) {
				self.close(NOOP);
				throw err;
			}

			self.fdwrite = fd;
			callback && callback();
		});
	});

	return self;
};

NoSQLStream.prototype.openinsert = function(callback) {
	var self = this;
	self.type = 'a';
	self.open(callback);
	return self;
};

// For e.g. files on URL address
NoSQLStream.prototype.openstream = function(stream, callback) {
	var self = this;

	self.docs = '';
	self.docscache = '';
	self.docscount = 0;

	self.stream = stream;
	self.stream.on('end', function() {
		if (self.docscount) {
			self.ondocuments();
			self.docscount = 0;
			self.docs = '';
			self.docscache = '';
		}
		callback && callback();
	});

	self.stream.on('data', function(chunk) {

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

		var index = self.buffer.indexOf(NEWLINEBUFFER, beg);
		while (index !== -1) {

			var tmp = self.buffer.toString('utf8', 0, index).trim();

			self.docs += (self.docs ? ',' : '') + tmp;
			self.docscount++;
			self.indexer++;

			if (self.docscount >= BUFFERDOCS) {

				if (self.ondocuments() === false)
					self.canceled = true;

				self.docs = '';
				self.docscount = 0;

				if (self.canceled) {
					self.close();
					self.stream.destroy && self.stream.destroy();
					return;
				}

			}

			self.buffer = self.buffer.slice(index + 1);
			index = self.buffer.indexOf(NEWLINEBUFFER);
			if (index === -1)
				break;
		}
	});

	return self;
};

NoSQLStream.prototype.open = function(callback) {
	var self = this;
	Fs.open(self.filename, self.type, function(err, fd) {

		if (err) {
			callback && callback.call(err);
			return;
		}

		Fs.fstat(fd, function(err, stats) {

			self.docs = '';
			self.docscache = '';
			self.docscount = 0;
			self.fd = fd;
			self.stats = stats;

			// Appending
			if (self.type === 'a')
				self.position = stats.size;
			else
				self.position = 0;

			callback && callback(err);
		});
	});
};

NoSQLStream.prototype.close = function(callback) {

	var self = this;

	if (self.fd) {

		self.stream = null;

		Fs.close(self.fd, function(err) {
			err && F.error(err);
			callback && callback();
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

	} else if (callback)
		callback();

	return self;
};

NoSQLStream.prototype.write = function(docs) {
	var self = this;
	self.bufferstack.push(docs);
	!self.writing && self.$write();
	return self;
};

NoSQLStream.prototype.$write = function() {
	var self = this;
	self.writing = true;
	//var buf = framework_utils.createBuffer(self.bufferstack.shift(), 'utf8');
	Fs.write(self.fdwrite, self.bufferstack.shift(), 'utf8', function() {
		self.bufferstack.length && self.$write();
		self.writing = false;
	});
};

NoSQLStream.prototype.flush = function(callback) {
	var self = this;
	if (self.writing) {
		setTimeout((self, callback) => self.flush(callback), 100, self, callback);
	} else {
		self.close(function(err) {

			if (err) {
				callback(err);
				return;
			}

			Fs.close(self.fdwrite, function(err) {
				if (err)
					callback(err);
				else {
					if (self.changed)
						Fs.rename(self.filename + '-tmp', self.filename, callback);
					else
						Fs.unlink(self.filename + '-tmp', callback);
				}
			});

		});
	}
	return self;
};

NoSQLStream.prototype.read = function(callback, noclose) {

	var self = this;
	var size = self.stats.size - self.position;

	if (!self.fd || size <= 0 || self.canceled) {

		if (self.docscount) {
			self.ondocuments();
			self.docscount = 0;
			self.docs = '';

			if (self.fdwrite)
				self.docscache = '';

		}

		if (noclose)
			callback && callback();
		else
			self.close(err => callback && callback(err));

		return;
	}

	size = size < BUFFERSIZE ? size : BUFFERSIZE;
	var buffer = framework_utils.createBufferSize(size);
	Fs.read(self.fd, buffer, 0, size, self.position, function(err, size, chunk) {

		self.bytesread += size;
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


		var index = self.buffer.indexOf(NEWLINEBUFFER, beg);
		while (index !== -1) {

			var tmp = self.buffer.toString('utf8', 0, index);
			self.docs += (self.docs ? ',' : '') + tmp;
			self.docscount++;
			self.indexer++;

			if (self.fdwrite)
				self.docscache += tmp + NEWLINE;

			if (self.docscount >= BUFFERDOCS) {

				if (self.ondocuments() === false)
					self.canceled = true;

				self.docs = '';
				self.docscount = 0;

				if (self.fdwrite)
					self.docscache = '';

				if (self.canceled) {
					self.read(callback, noclose);
					return;
				}

			}

			self.buffer = self.buffer.slice(index + 1);
			index = self.buffer.indexOf(NEWLINEBUFFER);
			if (index === -1)
				break;
		}

		self.read(callback, noclose);
	});
};

NoSQLStream.prototype.readreverse = function(callback, noclose, repeat) {

	var self = this;

	if (repeat == null)
		self.position = self.stats.size;

	if (!self.fd || self.position <= 0 || self.canceled) {

		if (self.docscount) {
			self.ondocuments();
			self.docs = '';
			self.docscount = 0;
		}

		if (noclose)
			callback && callback();
		else
			self.close(err => callback && callback(err));

		return;
	}

	var size = self.stats.size - self.bytesread;
	size = size < BUFFERSIZE ? size : BUFFERSIZE;

	self.position -= size;

	var buffer = framework_utils.createBufferSize(size);

	Fs.read(self.fd, buffer, 0, size, self.position, function(err, size, chunk) {

		self.bytesread += size;

		if (self.buffer) {
			self.cache[0] = chunk;
			self.cache[1] = self.buffer;
			self.buffer = Buffer.concat(self.cache);
		} else
			self.buffer = chunk;

		var index = self.buffer.lastIndexOf(NEWLINEBUFFER, self.buffer.length - 2);

		while (index !== -1) {

			self.docs += (self.docs ? ',' : '') + self.buffer.toString('utf8', index);
			self.docscount++;

			if (self.docscount >= BUFFERDOCS) {
				if (self.ondocuments() === false)
					self.canceled = true;
				self.docs = '';
				self.docscount = 0;
			}

			if (self.canceled) {
				self.readreverse(callback, noclose, true);
				return;
			}

			self.buffer = self.buffer.slice(0, index);
			index = self.buffer.lastIndexOf(NEWLINEBUFFER, self.buffer.length - 2);
			if (index === -1)
				break;
		}

		if (self.position === 0 && self.buffer.length) {
			self.docs += (self.docs ? ',' : '') + self.buffer.toString('utf8');
			self.docscount++;
			if (self.docscount >= BUFFERDOCS) {
				self.ondocuments();
				self.docs = '';
				self.docscount = 0;
			}
		}

		self.readreverse(callback, noclose, true);
	});
};

NoSQLStream.prototype.append = function(data, callback) {
	var self = this;
	Fs.write(self.fd, data, 'utf8', function(err) {
		callback && callback(err);
	});
	return self;
};

module.exports = NoSQLStream;