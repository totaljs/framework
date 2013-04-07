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
var encoding = 'utf8';

/*
	Database
	@filename {String}
*/
function Database(filename) {
	this.pending = [];
	this.filename = filename;
	this.filenameTemp = filename + '.tmp';
	this.isLocked = false;
	this.isScalar = false;
	this.skip = false;
	this.count = 0;
	this.current = '';
};

/*
	Write data to database
	@obj {Object}
	@fnCallback {Function} :: optional, params: @err {Error}, @obj {Object}
	return {Database}
*/
Database.prototype.write = function(obj, fnCallback) {

	var self = this;

	if (self.isLocked) {
		self.pending.push(function() {
			self.write(obj, fnCallback);
		});
		return self;
	}

	self.isLocked = true;
	fs.appendFile(self.filename, JSON.stringify(obj) + '\n', { encoding: encoding }, function(err) {
		self.isLocked = false;
		fnCallback && fnCallback(err, obj);
		self.next();
	});

	return self;
};

/*
	Write bulk data to database
	@arr {Array of Object}
	@fnCallback {Function} :: optional, params: @err {Error}, @count {Number}
	return {Database}
*/
Database.prototype.writeBulk = function(arr, fnCallback) {
	var self = this;

	if (self.isLocked) {
		self.pending.push(function() {
			self.writeBulk(arr, fnCallback);
		});
		
		return self;
	}

	self.isLocked = true;

	var builder = [];

	arr.forEach(function(o) {
		builder.push(JSON.stringify(o));
	});

	fs.appendFile(self.filename, builder.join('\n') + '\n', { encoding: encoding }, function(err) {
		self.isLocked = false;
		fnCallback && fnCallback(err, arr.length);
		self.next();
	});

	return self;
};

Database.prototype.cancel = function() {
	var self = this;
	self.skip = true;
	return self;
};

/*
	Internal function
	@data {String}
	@fnFilter {Function}
	@fnCallback {Function}
*/
Database.prototype.readValue = function(data, fnFilter, fnCallback) {

	var self = this;

	if (self.skip)
		return;

	var index = data.indexOf('\n');

	if (index === -1) {
		self.current += data;
		return;
	}

	self.current += data.substring(0, index);
	
	var obj = JSON.parse(self.current); 

	if (fnFilter(obj)) {

		self.count++;

		if (!self.isScalar)
			fnCallback(obj, self.count);
	}

	self.current = '';
	self.readValue(data.substring(index + 1), fnFilter, fnCallback);
};

/*
	Read data from database
	@fnFilter {Function} :: params: @obj {Object}, return TRUE | FALSE
	@fnCallback {Function} :: params: @err {Error}, @selected {Array of Object}
	@itemSkip {Number} :: optional
	@itemTake {Number} :: optional
	@isScalar {Boolean} :: optional, default is false 
	return {Database}
*/
Database.prototype.read = function(fnFilter, fnCallback, itemSkip, itemTake, isScalar) {
	
	var self = this;

	if (self.isLocked) {
		self.pending.push(function() {
			self.read(fnFilter, fnCallback, itemSkip, itemTake, isScalar);
		});
		return self;
	}

	var reader = fs.createReadStream(self.filename);

	if (typeof(fnCallback) === 'undefined') {		
		fnCallback = fnFilter;
		fnFilter = function() { return true; };
	}

	if (typeof(fnFilter) === 'string')
		fnFilter = eval('(function(doc){' + (fnFilter.indexOf('return ') === -1 ? 'return ' : '') + fnFilter + '})');

	var selected = [];

	self.skip = false;
	self.isScalar = isScalar;
	self.isLocked = true;
	self.current = '';

	var skip = itemSkip || 0;
	var take = itemTake || 0;

	var fnItem = function(o, count) {

		if (skip > 0 && count < skip)
			return;

		selected.push(o);

		if (take > 0 && selected.length === take)
			self.skip = true;
	};

	reader.on('data', function(buffer) {
		var data = buffer.toString();
		self.readValue(data, fnFilter, fnItem);
	});

	reader.on('end', function() {
		self.isLocked = false;
		self.next();
		fnCallback(null, self.isScalar ? self.count : selected);
	});

	reader.on('error', function(err) {
		self.isLocked = false;
		self.next();
		fnCallback(err, self.isScalar ? self.count : []);
	});

	return self;
};

/*
	Read data from database
	@fnCallback {Function} :: params: @err {Error}, @obj {Object}, @offset {Number}
	return {Database}
*/
Database.prototype.each = function(fnCallback) {
	
	var self = this;

	if (self.isLocked) {
		self.pending.push(function() {
			self.each(fnCallback);
		});
		return self;
	}

	var fnItem = function(o, count) {
		fnCallback(null, o, count);
	};

	var fnFilter = function(o) {
		return true;
	};

	var reader = fs.createReadStream(self.filename);

	self.skip = false;
	self.isScalar = false;
	self.isLocked = true;
	self.current = '';

	reader.on('data', function(buffer) {
		var data = buffer.toString();
		self.readValue(data, fnFilter, fnItem);
	});

	reader.on('end', function() {
		self.isLocked = false;
		self.next();
	});

	reader.on('error', function(err) {
		self.isLocked = false;
		self.next();
	});

	return self;
};

/*
	Read data from database
	@fnFilter {Function} :: must return {Boolean};
	@fnCallback {Function} :: params: @err {Error}, @obj {Array of Object}
	@itemSkip {Number} :: optional, default 0
	@itemTake {Number} :: optional, default 0
	return {Database}
*/
Database.prototype.all = function(fnFilter, fnCallback, itemSkip, itemTake) {
	return this.read(fnFilter, fnCallback, itemSkip, itemTake);
};

/*
	Read data from database
	@fnFilter {Function} :: must return {Boolean};
	@fnCallback {Function} :: params: @err {Error}, @obj {Object}
	return {Database}
*/
Database.prototype.one = function(fnFilter, fnCallback) {

	var cb = function(err, selected) {
		fnCallback(err, selected[0] || null);
	};

	return this.read(fnFilter, cb, 0, 1);
};

/*
	Read data from database
	@max {Number}
	@fnFilter {Function} :: must return {Boolean};
	@fnCallback {Function} :: params: @err {Error}, @obj {Array of Object}
	return {Database}
*/
Database.prototype.top = function(max, fnFilter, fnCallback) {
	return this.read(fnFilter, fnCallback, 0, max);
};

/*
	Scalar
	@fnFilter {Function} :: params: @obj {Object}, return TRUE | FALSE
	@fnCallback {Function} :: params: @err {Error}, @count {Number}
	return {Database}
*/
Database.prototype.scalar = function(fnFilter, fnCallback) {
	return this.read(fnFilter, fnCallback, 0, 0, true);
};

/*
	Internal function
	@data {String}
	@fnFilter {Function}
	@fnWrite {Function}
*/
Database.prototype.removeValue = function(data, fnFilter, fnWrite) {

	var self = this;
	var index = data.indexOf('\n');

	if (index === -1) {
		self.current += data;
		return;
	}

	self.current += data.substring(0, index);
	
	var obj = JSON.parse(self.current); 

	if (!fnFilter(obj))
		fnWrite(obj);
	else
		self.count++;

	self.current = '';
	self.removeValue(data.substring(index + 1), fnFilter, fnWrite);
};

/*
	Remove data from database
	@fnFilter {Function} :: params: @obj {Object}, return TRUE | FALSE
	@fnCallback {Function} :: params: @err {Error}, @countRemoved {Number}
	return {Database}
*/
Database.prototype.remove = function(fnFilter, fnCallback) {

	var self = this;

	if (self.isLocked) {
		self.pending.push(function() {
			self.remove(fnFilter, fnCallback);
		});
		return self;
	}

	if (typeof(fnFilter) === 'string')
		fnFilter = eval('(function(doc){' + (fnFilter.indexOf('return ') === -1 ? 'return ' : '') + fnFilter + '})');

	var reader = fs.createReadStream(self.filename);
	var writer = fs.createWriteStream(self.filenameTemp, '');

	self.isLocked = true;
	self.isScalar = false;
	self.count = 0;
	self.current = '';

	var fnWrite = function(obj) {
		writer.write(JSON.stringify(obj) + '\n');
	};

	reader.on('data', function(buffer) {
		var data = buffer.toString();
		self.removeValue(data, fnFilter, fnWrite);
	});

	reader.on('end', function() {
		fs.rename(self.filenameTemp, self.filename, function(err) {
			self.isLocked = false;
			self.next();
			fnCallback && fnCallback(null, self.count);
		});
	});

	reader.on('error', function(err) {
		self.isLocked = false;
		self.next();
		fnCallback(err, self.count);
	});

	return self;
};

/*
	Internal function
*/
Database.prototype.next = function() {

	var self = this;
	if (self.pending.length === 0)
		return;

	var fn = self.pending.shift();
	fn();
};

exports.database = Database;
exports.load = exports.open = exports.nosql = function(filename) {
	return new Database(filename);
}