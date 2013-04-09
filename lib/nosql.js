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
var path = require('path');
var util = require('util');
var events = require('events');
var encoding = 'utf8';

var STATUS_UNKNOWN = 0;
var STATUS_READING = 1;
var STATUS_WRITING = 2;
var STATUS_LOCKING = 3;
var STATUS_PENDING = 4;
var NEWLINE = '\n';

var EXTENSION = '.nosql';
var EXTENSION_VIEW = '.nosql-view';
var EXTENSION_TMP = '.nosql-tmp';

var MAX_WRITESTREAM = 2;
var MAX_READSTREAM  = 4;

if (typeof(setImmediate) === 'undefined') {
	setImmediate = function(cb) {
		process.nextTick(cb);
	};
}

/*
	Database
	@filename {String}
*/
function Database(filename) {
	this.status_prev = STATUS_UNKNOWN;
	this.status = STATUS_UNKNOWN;

	this.countRead = 0;
	this.countWrite = 0;

	this.pendingRead = [];
	this.pendingEach = [];
	this.pendingLock = [];
	this.pendingDrop = [];
	this.pendingWrite = [];

	this.isPending = false;

	this.filename = filename + EXTENSION;
	this.filenameTemp = filename + EXTENSION_TMP;
	
	this.directory = path.dirname(filename);
	this.view = new Views(this);
};

/*
	@db {Database}
*/
function Views(db) {
	this.views = {};
	this.db = db;
	this.directory = db.directory;
	this.emit = db.emit;
};

/*
	@db {Database}
	@name {String}
	@filename {String} :: database filename
*/
function View(db, name, filename) {
	this.db = db;
	this.status = STATUS_UNKNOWN;
	this.countRead = 0;
	this.pendingRead = [];
	this.pendingOperation = [];
	this.filename = filename;
	this.name = name;
	this.emit = db.emit;
};

/*
	PROTOTYPES
*/

Database.prototype = new events.EventEmitter;

/*
	Insert data into database
	@arr {Array of Object}
	@fnCallback {Function} :: optional, params: @count {Number}
	return {Database}
*/
Database.prototype.insert = function(arr, fnCallback) {

	var self = this;

	if (!util.isArray(arr))
		arr = [arr];

	if (self.status === STATUS_LOCKING|| self.status === STATUS_PENDING || self.countWrite >= MAX_WRITESTREAM) {

		arr.forEach(function(o) {
			self.pendingWrite.push(o);
		});
				
		if (fnCallback)
			fnCallback(-1);

		return self;
	}

	var builder = [];

	arr.forEach(function(doc) {
		builder.push(doc);
	});

	if (builder.length === 0) {
		self.next();
		return;
	}

	self.emit('insert', true, builder.length);

	self.status = STATUS_WRITING;
	self.countWrite++;

	appendFile(self.filename, arr, function() {

		self.countWrite--;		
		self.emit('insert', false, builder.length);
		self.next();

		if (fnCallback)
			setImmediate(function() { fnCallback(doc); });

	});

	return self;
};

/*
	Read data from database
	@fnFilter {Function} :: params: @doc {Object}, IMPORTANT: you must return {Boolean}
	@fnCallback {Function} :: params: @selected {Array of Object} or {Number} if is scalar
	@itemSkip {Number} :: optional, default 0
	@itemTake {Number} :: optional, defualt 0
	@isScalar {Boolean} :: optional, default is false 
	return {Database}
*/
Database.prototype.read = function(fnFilter, fnCallback, itemSkip, itemTake, isScalar, name) {
	
	var self = this;
	var skip = itemSkip || 0;
	var take = itemTake || 0;

	if (self.status === STATUS_LOCKING || self.status === STATUS_PENDING || self.countRead >= MAX_READSTREAM) {
		
		self.pendingRead.push(function() {
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
		fnFilter = filterPrepare(fnFilter);

	if (fnFilter === null)
		fnFilter = function() { return true; };

	self.emit(name || 'read', true, 0);

	// opened streams
	self.countRead++;
	self.status = STATUS_READING;

	var selected = [];
	var current = '';
	var count = 0;
	var isCanceled = false;

	var fnCancel = function() {
		isCanceled = true;
	};

	var fnBuffer = function(buffer) {
		current += buffer;
		return current;
	};

	var fnItem = function(err, doc, cancel) {

		if (isCanceled)
			return;

		// clear buffer;
		current = '';

		if (err || !fnFilter(doc))
			return;

		count++;

		if (skip > 0 && count <= skip)
			return;

		if (!isScalar)
			selected.push(doc);

		if (take > 0 && selected.length === take)
			cancel();
	};

	reader.on('data', function(buffer) {
		
		if (isCanceled)
			return;
		
		onBuffer(buffer.toString(), fnItem, fnBuffer, fnCancel);
	});

	reader.on('end', function() {
		self.countRead--;
		self.next();

		setImmediate(function() {
			self.emit(name || 'read', false, isScalar ? count : selected.length);
			fnCallback(isScalar ? count : selected);
		});
	});

	reader.on('error', function(err) {

		if (err.errno !== 34)
			self.emit('error', err, 'read-stream');

		self.countRead--;
		self.next();

		setImmediate(function() {
			self.emit(name || 'read', false, 0);
			fnCallback(isScalar ? count : []);
		});
	});

	return self;
};

/*
	Read all documents from database
	@fnFilter {Function} :: IMPORTANT: you must return {Boolean}
	@fnCallback {Function} :: params: @doc {Array of Object}
	@itemSkip {Number} :: optional, default 0
	@itemTake {Number} :: optional, default 0
	return {Database}
*/
Database.prototype.all = function(fnFilter, fnCallback, itemSkip, itemTake) {
	return this.read(fnFilter, fnCallback, itemSkip, itemTake, false, 'all');
};

/*
	Read one document from database
	@fnFilter {Function} :: must return {Boolean}
	@fnCallback {Function} :: params: @doc {Object}
	return {Database}
*/
Database.prototype.one = function(fnFilter, fnCallback) {

	var cb = function(selected) {
		fnCallback(selected[0] || null);
	};

	return this.read(fnFilter, cb, 0, 1, false, 'one');
};

/*
	Read TOP "x" documents from database
	@fnFilter {Function} :: IMPORTANT: you must return {Boolean}
	@fnCallback {Function} :: params: @doc {Object}
	return {Database}
*/
Database.prototype.top = function(max, fnFilter, fnCallback) {
	return this.read(fnFilter, fnCallback, 0, max, false, 'top');
};

/*
	Count documents
	@fnFilter {Function} :: params: @doc {Object}, IMPORTANT: you must return {Boolean}
	@fnCallback {Function} :: params: @count {Number}
	return {Database}
*/
Database.prototype.count = function(fnFilter, fnCallback) {
	return this.read(fnFilter, fnCallback, 0, 0, true, 'count');
};

/*
	Read each document from database
	@fnDocument {Function} :: params: @doc {Object}, @offset {Number}
	@fnCallback {Function} :: optional
	return {Database}
*/
Database.prototype.each = function(fnDocument, fnCallback) {
	
	var self = this;

	if (self.status === STATUS_LOCKING || self.status === STATUS_PENDING || self.countRead >= MAX_READSTREAM) {

		if (fnDocument)
			self.pendingEach.push({ item: fnDocument, callback: fnCallback });

		return self;
	}

	var operation = [];

	if (fnDocument)
		operation.push({ item: fnDocument, callback: fnCallback });

	self.pendingEach.forEach(function(fn) {
		operation.push(fn);
	});

	if (operation.length === 0) {
		self.next();
		return self;
	}

	var reader = fs.createReadStream(self.filename);

	// opened streams
	self.countRead++;
	self.status = STATUS_READING;

	var current = '';
	var count = 0;

	self.pendingEach = [];

	var fnBuffer = function(buffer) {
		current += buffer;
		return current;
	};

	var fnItem = function(err, doc, cancel) {

		// clear buffer;
		current = '';

		if (err) {
			self.emit('error', err);
			return;
		}

		operation.forEach(function(fn) {
			try
			{
			
				fn.item(doc, count);
			
			} catch (e) {
				self.emit('error', e);
			}
		});

		count++;
	};

	self.emit('each', true, 0);

	reader.on('data', function(buffer) {
		onBuffer(buffer.toString(), fnItem, fnBuffer);
	});

	reader.on('end', function() {

		self.countRead--;
		self.next();

		setImmediate(function() { 
			self.emit('each', false, count);
			operation.forEach(function(fn) {
				if (fn.callback)
					fn.callback();
			});
		});

	});

	reader.on('error', function(err) {

		if (err.errno !== 34)
			self.emit('error', err, 'each-stream');

		self.countRead--;
		self.next();

		setImmediate(function() { 
			self.emit('each', false, 0);
			operation.forEach(function(fn) {
				if (fn.callback)
					fn.callback();
			});
		});

	});

	return self;
};

/*
	Read and sort documents from database (SLOWLY)
	@fnFilter {Function} :: IMPORTANT: you must return {Boolean}
	@fnSort {Function} :: ---> array.sort()
	@itemSkip {Number}
	@itemTake {Number}
	@fnCallback {Function} :: params: @doc {Object}, @count {Number}
	return {Database}
*/
Database.prototype.sort = function(fnFilter, fnSort, itemSkip, itemTake, fnCallback) {

	var self = this;
	var selected = [];
	var count = 0;

	if (typeof(fnFilter) === 'string')
		fnFilter = filterPrepare(fnFilter);

	itemTake = itemTake || 30;
	itemSkip = itemSkip || 0;

	var onCallback = function() {
		selected.sort(fnSort);

		if (itemSkip > 0 || itemTake > 0)
			selected = selected.slice(itemSkip, itemSkip + itemTake);

		fnCallback(selected, count);
	};

	var onItem = function(doc) {

		if (!fnFilter(doc))
			return;

		count++;
		selected.push(doc);
	};

	self.each(onItem, onCallback);
	return self;
};

/*
	Drop database
	@fnCallback {Function} :: params: @dropped {Boolean}
	return {Database}
*/
Database.prototype.drop = function(fnCallback) {

	var self = this;

	if (typeof(fnCallback) === 'undefined')
		fnCallback = null;

	self.pendingDrop.push(fnCallback);

	if (self.status !== STATUS_UNKNOWN)
		return self;

	self.status = STATUS_LOCKING;

	var operation = [];
	
	self.pendingDrop.forEach(function(o) {
		if (o !== null)
			operation.push(o);
	});

	self.emit('drop', true, false);
	self.pendingDrop = [];

	fs.exists(self.filename, function(exists) {

		if (!exists) {
			
			self.next();

			setImmediate(function() { 
				self.emit('drop', false, true);
				operation.forEach(function(fn) {
					fn && fn();
				});
			});			
			
			return;
		}

		fs.unlink(self.filename, function(err) {
			
			if (err)
				self.emit('error', err, 'drop');

			self.next();

			setImmediate(function() { 
				self.emit('drop', false, err === null);
				operation.forEach(function(fn) {
					fn && fn(err === null);
				});
			});
		});
	});

	return self;
};

/*
	Update multiple documents
	@fnUpdate {Function} :: params: @doc {Object} and IMPORTANT: you must return updated @doc;
	@fnCallback {Function} :: optional, params: @count {Number}
	@type {String} :: internal, optional
	return {Database}
*/
Database.prototype.update = function(fnUpdate, fnCallback, type) {
	var self = this;

	if (typeof(fnUpdate) !== 'undefined')
		self.pendingLock.push(updatePrepare(fnUpdate, fnCallback, type || 'update'));
		
	if (self.status !== STATUS_UNKNOWN) {
		return self;
	}

	var operation = [];

	self.pendingLock.forEach(function(fn) {
		operation.push(fn);
	});

	if (operation.length === 0) {
		self.next();
		return;
	}

	self.status = STATUS_LOCKING;

	fs.renameSync(self.filename, self.filenameTemp);

	var reader = fs.createReadStream(self.filenameTemp);
	var current = '';
	var operationLength = operation.length;
	var lines = [];

	var countRemove = 0;
	var countUpdate = 0;
	
	self.emit('update/remove', true, 0, 0);
	self.pendingLock = [];

	var fnWrite = function(json, valid) {

		if (lines.length > 25 || valid) {
			fs.appendFile(self.filename, lines.join(NEWLINE) + NEWLINE, function() {});
			lines = [];
		}

		if (typeof(json) === 'string')
			lines.push(json);
	};

	var fnBuffer = function(buffer) {
		current += buffer;
		return current;
	};

	var fnItem = function(err, doc, cancel, json) {

		// clear buffer;
		current = '';

		var skip = false;
		var value = null;

		for (var i = 0; i < operationLength; i++) {
			
			var fn = operation[i];
			value = fn.filter(doc) || null;

			if (value === null)
				break;
		}

		if (value === null) {
			self.emit('remove', doc);
			countRemove++;
			return;
		}

		var updated = JSON.stringify(value);
		if (updated !== json) {
			self.emit('update', value);
			countUpdate++;
		}

		fnWrite(updated);
	};

	reader.on('data', function(buffer) {
		onBuffer(buffer.toString(), fnItem, fnBuffer);
	});

	reader.on('end', function() {

		fnWrite(null, lines.length > 0);

		operation.forEach(function(o) {

			if (o.type === 'update') {
				o.count = countUpdate;
				return;
			}

			if (o.type === 'remove')
				o.count = countRemove;
		});

		fs.unlink(self.filenameTemp, function(err) {

			if (err)
				self.emit('error', err, 'update/remove-rename-file');

			self.emit('update/remove', false, countUpdate, countRemove);

			operation.forEach(function(o) {
				if (o.callback)
					(function(cb,count) { setImmediate(function() { cb(count); }); })(o.callback, o.count);
			});
			
			self.next();
		});

		self.next();
	});

	reader.on('error', function(err) {

		if (err.errno !== 34)
			self.emit('error', err, 'update/remove-stream');

		self.emit('update/remove', false, countUpdate, countRemove);

		operation.forEach(function(o) {
			if (o.callback)
				(function(cb, o) { setImmediate(function() { cb(); }); })(o.callback, o.count);
		});

		self.next();
	});

	return self;
};

/*
	Update multiple documents
	@fnUpdate {Function} :: params: @doc {Object} and IMPORTANT: you must return updated @doc;
	@fnCallback {Function} :: optional, params: @count {Number}
	return {Database}
*/
Database.prototype.prepare = function(fnUpdate, fnCallback) {
	var self = this;

	if (typeof(fnUpdate) !== 'undefined')
		self.pendingLock.push(updatePrepare(fnUpdate, fnCallback, 'update'));

	return self;
};

/*
	Remove data from database
	@fnFilter {Function} :: params: @obj {Object}, IMPORTANT: you must return {Boolean}
	@fnCallback {Function} :: params: @count {Number}
	return {Database}
*/
Database.prototype.remove = function(fnFilter, fnCallback) {

	var self = this;

	if (typeof(fnFilter) === 'string')
		fnFilter = filterPrepare(fnFilter);

	var filter = function(item) {

		if (fnFilter(item))
			return null;

		return item;
	};

	self.update(filter, fnCallback, 'delete');
	return self;
};

Database.prototype.pause = function() {	
	var self = this;

	self.isPending = true;

	if (self.status === STATUS_UNKNOWN) {
		self.status = STATUS_PENDING;
		self.emit('pause/resume', true);
	}

	return self;
};

Database.prototype.resume = function() {
	var self = this;
	self.isPending = false;
	self.emit('pause/resume', false);
	self.next();
	return self;
};

/*
	Internal function
*/
Database.prototype.next = function() {

	var self = this;

	if (self.isPending) {
		if (self.status !== STATUS_PENDING) {
			self.status = STATUS_PENDING;
			self.emit('pause');
		}
		return;
	}
	
	self.status_prev = self.status;
	self.status = STATUS_UNKNOWN;

	// ReadStream is open, ... waiting for close
	if (self.countRead > 0) {
		self.status = STATUS_READING;
		return;
	}

	// WriteStream is open, ... waiting for close
	if (self.countWrite > 0) {
		self.status = STATUS_WRITING;
		return;
	}

	if (self.pendingWrite.length > 0) {
		self.insert(self.pendingWrite);
		self.pendingWrite = [];
		return;
	}

	// large operation (truncate file)
	if (self.pendingLock.length > 0) {
		self.update();
		return;
	}

	if (self.pendingEach.length > 0) {
		self.each();
		return;
	}

	// read data
	if (self.pendingRead.length > 0) {
		var max = self.pendingRead.length;

		if (max > MAX_READSTREAM)
			max = MAX_READSTREAM;

		for (var i = 0; i < max; i++)
			self.pendingRead.shift()();

		return;
	}

	if (self.pendingDrop.length > 0) {
		self.drop();
		return;
	}

	setImmediate(function() {
		self.emit('complete', self.status_prev);
	});
};

// ========================================================================
// VIEWS
// ========================================================================

/*
	Read documents from view
	@name {String}
	@fnCallback {Function} :: params: @doc {Object}, @count {Number}
	@itemSkip {Number} :: optional, default 0
	@itemTake {Number} :: optional, default 0
	@fnFilter {Function} :: optional, IMPORTANT: you must return {Boolean}
*/
Views.prototype.all = function(name, fnCallback, itemSkip, itemTake, fnFilter) {

	var self = this;
	var view = self.views[name];

	if (typeof(view) === 'undefined') {
		view = new View(self.db, name, path.join(self.directory, name + EXTENSION_VIEW));
		self.views[name] = view;
	}

	if (typeof(fnFilter) === 'string')
		fnFilter = filterPrepare(fnFilter);

	if (typeof(fnFilter) !== 'function')
		fnFilter = function(o) { return true; };

	view.read(fnFilter, fnCallback, itemSkip, itemTake);
	return self.db;
};

/*
	Read documents from view
	@name {String}
	@top {Number}
	@fnCallback {Function} :: params: @doc {Object}
	@fnFilter {Function} :: optional, IMPORTANT: you must return {Boolean}
	return {Database}
*/
Views.prototype.top = function(name, top, fnCallback, fnFilter) {

	var self = this;
	var view = self.views[name];

	if (typeof(view) === 'undefined') {
		view = new View(self.db, name, path.join(self.directory, name + EXTENSION_VIEW));
		self.views[name] = view;
	}

	if (typeof(fnFilter) === 'string')
		fnFilter = filterPrepare(fnFilter);

	if (typeof(fnFilter) !== 'function')
		fnFilter = function(o) { return true; };

	view.read(fnFilter, fnCallback, 0, top, true);
	return self.db;
};

/*
	Read one document from view
	@name {String}
	@fnFilter {Function} :: optional, IMPORTANT: you must return {Boolean}
	@fnCallback {Function} :: params: @doc {Object}
	return {Database}
*/
Views.prototype.one = function(name, fnFilter, fnCallback) {

	var self = this;
	var view = self.views[name];

	if (typeof(view) === 'undefined') {
		view = new View(self.db, name, path.join(self.directory, name + EXTENSION_VIEW));
		self.views[name] = view;
	}

	if (typeof(fnCallback) === 'undefined') {
		fnCallback = fnFilter;
		fnFilter = null;
	}

	if (typeof(fnFilter) === 'string')
		fnFilter = filterPrepare(fnFilter);

	if (typeof(fnFilter) !== 'function')
		fnFilter = function(o) { return true; };

	view.read(fnFilter, fnCallback, 0, 1, true);
	return self.db;
};

/*
	Drop view
	@name {String}
	@fnCallback {Function} :: params: @dropped {Boolean}
	return {Database}
*/
Views.prototype.drop = function(name, fnCallback) {

	var self = this;
	var view = self.views[name];

	if (typeof(view) === 'undefined') {
		view = new View(self.db, name, path.join(self.directory, name + EXTENSION_VIEW));
		self.views[name] = view;
	}

	self.emit('view.drop', true, name);
	view.operation(function(cb) {
		fs.exists(view.filename, function(exists) {

			self.emit('view.drop', false, name);

			if (!exists) {
				fnCallback(true);
				cb && cb();
				return;
			}

			fs.unlink(view.filename, function(err) {
				
				if (err)
					self.emit('error', err, 'view.drop');

				fnCallback(true);
				cb && cb();
			});
		});
	});

	return self.db;
};

/*
	Create view
	@name {String}
	@fnFilter {Function} :: IMPORTANT: you must return {Boolean}
	@fnSort {Function} :: ---> array.sort()
	@fnCallback {Function} :: params: @count {Number}
	@fnUpdate {Function} :: optional, IMPORTANT: you must return updated document
	return {Database}
*/
Views.prototype.create = function(name, fnFilter, fnSort, fnCallback, fnUpdate) {

	var self = this;
	var selected = [];
	var count = 0;

	if (typeof(fnFilter) === 'string')
		fnFilter = filterPrepare(fnFilter);

	self.emit('view.create', true, name, 0);

	var onCallback = function() {
		selected.sort(fnSort);
		var view = self.views[name];
		
		if (typeof(view) === 'undefined') {
			view = new View(self.db, name, path.join(self.directory, name + EXTENSION_VIEW));
			self.views[name] = view;
		}

		var filename = path.join(self.directory, name + EXTENSION_VIEW);
		view.operation(function(cb) {
			appendFile(filename, selected, function() {
				self.emit('view.create', false, name, count);
				setImmediate(function() { fnCallback(count); });
				cb && cb();
			});
		});
	};

	var onItem = function(doc) {

		if (!fnFilter(doc))
			return;
		
		if (fnUpdate)
			doc = fnUpdate(doc) || null;

		if (doc !== null) {
			count++;
			selected.push(doc);
		}
	};

	self.db.each(onItem, onCallback);
	return self.db;
};

// ========================================================================
// VIEW
// ========================================================================

/*
	Read documents from view
	@fnFilter {Function} :: IMPORTANT: you must return {Boolean}
	@fnCallback {Function} :: params: @selected {Array of Object}, @count {Number}
	@itemSkip {Number} :: optional, default 0
	@itemTake {Number} :: optional, default 0
	@skipCount {Boolean} :: optional, default false
	return {View}
*/
View.prototype.read = function(fnFilter, fnCallback, itemSkip, itemTake, skipCount) {
	
	var self = this;
	var skip = itemSkip || 0;
	var take = itemTake || 0;

	skipCount = skipCount || false;

	if (self.status === STATUS_LOCKING || self.countRead >= MAX_READSTREAM) {
		
		self.pendingRead.push(function() {
			self.read(fnFilter, fnCallback, itemSkip, itemTake, isScalar);
		});

		return self;
	}

	self.status = STATUS_READING;

	var reader = fs.createReadStream(self.filename);

	if (typeof(fnFilter) === 'string')
		fnFilter = filterPrepare(fnFilter);

	if (fnFilter === null)
		fnFilter = function() { return true; };

	self.db.emit('view', true, self.name, 0);
	self.countRead++;

	var selected = [];
	var current = '';
	var count = 0;
	var isCanceled = false;

	var fnCancel = function() {
		isCanceled = true;
	};

	var fnBuffer = function(buffer) {
		current += buffer;
		return current;
	};

	var fnItem = function(err, doc, cancel) {

		// clear buffer;
		current = '';

		if (err || !fnFilter(doc))
			return;

		count++;
		
		if (isCanceled)
			return;

		if (skip > 0 && count <= skip)
			return;

		selected.push(doc);

		if (take > 0 && selected.length === take)
			cancel();
	};

	reader.on('data', function(buffer) {

		if (skipCount && isCanceled) {
			count = -1;
			return;
		}

		onBuffer(buffer.toString(), fnItem, fnBuffer, fnCancel);
	});

	reader.on('end', function() {
		
		self.countRead--;
		self.next();

		setImmediate(function() {
			self.emit('view', false, self.name, count);
			fnCallback(selected, count);
		});

	});

	reader.on('error', function(err) {

		if (err.errno !== 34)
			self.db.emit('error', err, 'view-stream');

		self.countRead--;
		self.next();
		
		setImmediate(function() {
			self.emit('view', false, self.name, 0);
			fnCallback([], count);
		});

	});

	return self;
};

/*
	View internal operation
	@fnCallback {Function}
	return {View}
*/
View.prototype.operation = function(fnCallback) {

	var self = this;

	if (typeof(fnCallback) !== 'undefined')
		self.pendingOperation.push(fnCallback);

	if (self.status !== STATUS_UNKNOWN)
		return self;

	self.status = STATUS_LOCKING;
	var operation = self.pendingOperation.shift();

	operation(function() {
		self.next();
	});

	return self;
};

/*
	Internal function
*/
View.prototype.next = function() {

	var self = this;

	self.status = STATUS_UNKNOWN;

	// ReadStream is open, ... waiting for close
	if (self.countRead > 0) {
		self.status = STATUS_READING;
		return;
	}

	if (self.pendingOperation.length > 0) {
		self.operation();
		return;
	}

	// read data
	if (self.pendingRead.length > 0) {

		var max = self.pendingRead.length;

		if (max > MAX_READSTREAM)
			max = MAX_READSTREAM;

		for (var i = 0; i < max; i++)
			self.pendingRead.shift()();

		return;
	}
};

// ========================================================================
// INTERNAL
// ========================================================================

/*
	Eval string and return function
	@fnFilter {String}
	return {Function}
*/
function filterPrepare(fnFilter) {
	 return eval('(function(doc){' + (fnFilter.indexOf('return ') === -1 ? 'return ' : '') + fnFilter + '})')
};

/*
	Buffer reader (internal function)
	@buffer {String}
	@fnItem {Function}
	@fnBuffer {Function}
	@fnCancel {Function}
*/
function onBuffer(buffer, fnItem, fnBuffer, fnCancel) {

	var index = buffer.indexOf(NEWLINE);
	
	if (index === -1) {
		fnBuffer(buffer);
		return;
	}

	var json = fnBuffer(buffer.substring(0, index));

	try
	{
		fnItem(null, JSON.parse(json), fnCancel, json);
	} catch (ex) {
		fnItem(ex, null, fnCancel, json);
	}

	onBuffer(buffer.substring(index + 1), fnItem, fnBuffer, fnCancel);
};

/*
	Append multiple documents to file
	@filename {String}
	@arr {Array of Object}
	@fnCallback {Function}
*/
function appendFile(filename, arr, fnCallback) {

	if (arr.length === 0) {
		fnCallback();
		return;
	}

	var lines = '';

	arr.slice(0, 30).forEach(function(o) {
		lines += JSON.stringify(o) + NEWLINE;
	});

	fs.appendFile(filename, lines, function(err) {
		appendFile(filename, arr.slice(30), fnCallback);
	});
};

/*
	Create default object for updating database (internal function)
	@fnUpdate {Function}
	@fnCallback {Function}
	@type {String}
*/
function updatePrepare(fnUpdate, fnCallback, type) {

	if (typeof(fnUpdate) === 'string')
		fnUpdate = filterPrepare(fnUpdate);

	return { filter: fnUpdate, callback: fnCallback, count: 0, type: type };
};

exports.database = Database;
exports.load = exports.open = exports.nosql = function(filename) {
	return new Database(filename);
}