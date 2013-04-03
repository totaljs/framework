// Copyright Peter Širka, Web Site Design s.r.o. (www.petersirka.sk)
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

var fs = require('fs');
var ph = require('path');
var zlib = require('zlib');
var utils = require('./utils');
var padding = 120;

function Backup() {
	this.file = [];
	this.directory = [];
	this.path = '';
	this.fileName = '';

	this.read = { key: '', value: '', status: 0 };

	this.complete = function() {};
	this.filter = function(path) {
		return true;
	};
};

function Walker() {
	this.pending = [];
	this.pendingDirectory = [];
	this.directory = [];
	this.file = [];
	this.complete = null;
};

Walker.prototype.walk = function(path) {
	var self = this;
	fs.readdir(path, function(err, arr) {

		if (err)
			return self.next();

		if (arr.length === 0)
			self.directory.push(path);

		arr.forEach(function(o) {
			self.pending.push(ph.join(path, o));
		});

		self.next();
	});
};

Walker.prototype.stat = function(path) {	
	var self = this;

	fs.stat(path, function(err, stats) {

		if (err)
			return self.next();

		if (stats.isDirectory())
			self.pendingDirectory.push(path);
		else
			self.file.push(path);

		self.next();
	});
};

Walker.prototype.next = function() {
	var self = this;

	if (self.pending.length > 0) {
		var item = self.pending.shift();
		self.stat(item);
		return;
	}

	if (self.pendingDirectory.length > 0) {
		var directory = self.pendingDirectory.shift();
		self.walk(directory);
		return;
	}

	self.file.sort(function(a, b) {
		return a.localeCompare(b);
	});

	self.complete(self.directory, self.file);
};

Backup.prototype.backup = function(path, fileName, callback, filter) {

	if (fs.existsSync(fileName))
		fs.unlinkSync(fileName);

	var walker = new Walker();
	var self = this;

	self.fileName = fileName;
	self.path = path;

	if (callback)
		self.complete = callback;

	if (filter)
		self.filter = filter;

	walker.complete = function(directory, files) {
		self.directory = directory;
		self.file = files;
		self.$compress();
	};

	walker.walk(path);
};

Backup.prototype.$compress = function() {

	var self = this;
	var length = self.path.length;

	if (self.directory.length > 0) {

		self.directory.forEach(function(o) {
			if (self.filter(o.substring(length)))
				fs.appendFileSync(self.fileName, (o.replace(self.path, '').replace(/\\/g, '/') + '/').padRight(padding) + ':#\n');
		});

		self.directory = [];
	}

	var fileName = self.file.shift();

	if (typeof(fileName) === 'undefined') {
		self.complete(null, self.fileName);
		return;
	}

	if (!self.filter(fileName.substring(length))) {
		self.$compress();
		return;
	}

	var buffer = '';

	fs.readFile(fileName, function(err, data) {
		zlib.gzip(data, function(err, data) {

			if (err)
				return;

			var name = fileName.replace(self.path, '').replace(/\\/g, '/');
			fs.appendFile(self.fileName, name.padRight(padding) + ':' + data.toString('base64') + '\n', function(err) {
				self.$compress();
			});
		});
	});
};

Backup.prototype.restoreKey = function(data) {

	var self = this;
	var read = self.read;

	if (read.status === 1) {
		self.restoreValue(data);
		return;
	}

	var index = data.indexOf(':');

	if (index === -1) {
		read.key += data;
		return;
	}

	read.status = 1;
	read.key = data.substring(0, index);
	self.restoreValue(data.substring(index + 1));
};

Backup.prototype.restoreValue = function(data) {

	var self = this;
	var read = self.read;

	if (read.status !== 1) {
		self.restoreKey(data);
		return;
	}

	var index = data.indexOf('\n');
	if (index === -1) {
		read.value += data;
		return;
	}

	read.value += data.substring(0, index);

	self.restoreFile(read.key.replace(/\s/g, ''), read.value.replace(/\s/g, ''));

	read.status = 0;
	read.value = '';
	read.key = '';

	self.restoreKey(data.substring(index + 1));
};

Backup.prototype.restore = function(fileName, path, callback, filter) {

	if (!fs.existsSync(fileName)) {
		if (callback)
			callback(new Error('Backup file not found.'), path);
		return;
	}

	var self = this;
	self.createDirectory(path, true);

	var stream = fs.createReadStream(fileName);	
	var key = '';
	var value = '';
	var status = 0;

	self.path = path;

	stream.on('data', function(buffer) {

		var data = buffer.toString('utf8');
		self.restoreKey(data);

	});

	if (callback) {
		stream.on('end', function() {
			callback(null, path);
		});
	}

	stream.resume();
};

Backup.prototype.restoreFile = function(key, value) {
	var self = this;

	if (!self.filter(key))
		return;

	if (value === '#') {
		self.createDirectory(key);
		return;
	}

	var path = key;
	var index = key.lastIndexOf('/');

	if (index !== -1) {
		path = key.substring(0, index).trim();
		if (path.length > 0)
			self.createDirectory(path);
	}

	zlib.gunzip(new Buffer(value, 'base64'), function(err, data) {
		fs.writeFileSync(ph.join(self.path, key), data);
	});
};

Backup.prototype.createDirectory = function(path, root) {

	if (path[0] === '/')
		path = path.substring(1);

	if (path[path.length - 1] === '/')
		path = path.substring(0, path.length - 1);

	var arr = path.split('/');
	var directory = '';
	var self = this;

	arr.forEach(function(name) {

		directory += (directory.length > 0 ? '/' : '') + name;

		var dir = ph.join(self.path, directory);

		if (root)
			dir = '/' + dir;

		if (fs.existsSync(dir))
			return;

		fs.mkdirSync(dir);
	});
};

// ===========================================================================
// EXPORTS
// ===========================================================================

exports.backup = function(path, fileName, callback, filter) {
	var backup = new Backup();
	backup.backup(path, fileName, callback, filter);
};

exports.restore = function(fileName, path, callback, filter) {
	var backup = new Backup();
	backup.restore(fileName, path, callback, filter);	
};

exports.Backup = Backup;