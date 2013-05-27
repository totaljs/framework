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

'use strict';

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
var EXTENSION_VIEW = '.nosql';
var EXTENSION_BINARY = '.nosql-binary';
var EXTENSION_TMP = '.nosql-tmp';
var EXTENSION_CHANGES = '.changes';

var MAX_WRITESTREAM = 2;
var MAX_READSTREAM = 4;
var MAX_BUFFER_SIZE = 1024 * 4;
var BINARY_HEADER_LENGTH = 2000;

if (typeof(setImmediate) === 'undefined') {
	global.setImmediate = function(cb) {
		process.nextTick(cb);
	};
}

/*
	Database
	@filename {String}
	@directory {String} :: for storing binary data
	@changes {Boolean} :: optional, default true
*/
function Database(filename, directory, changes) {

	if (typeof(directory) === 'boolean') {
		changes = directory;
		directory = null;
	}

	this.status_prev = STATUS_UNKNOWN;
	this.status = STATUS_UNKNOWN;
	this.changes = typeof(changes) === 'undefined' ? true : changes === true;

	this.countRead = 0;
	this.countWrite = 0;

	this.pendingRead = [];
	this.pendingEach = [];
	this.pendingLock = [];
	this.pendingDrop = [];
	this.pendingWrite = [];
	this.pendingClear = [];

	this.isPending = false;

	if (filename.indexOf(EXTENSION) !== -1)
		filename = filename.replace(EXTENSION, '');

	this.filename = filename + EXTENSION;
	this.filenameTemp = filename + EXTENSION_TMP;
	this.filenameChanges = filename + EXTENSION_CHANGES;
	this.name = path.basename(filename);

	this.directory = path.dirname(filename);
	this.view = new Views(this);

	this.binary = (directory || '').length === 0 ? null : new Binary(this, directory);
	this.changelog = new Changelog(this, this.filenameChanges);
	this.file = new FileReader(this);
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
	this.file = new FileReader(db);
};

/*
	@db {Database}
	@directory {String}
*/
function Binary(db, directory) {
	this.db = db;
	this.directory = directory;

	if (directory.length === 0)
		return;

	if (fs.existsSync(directory))
		return;

	fs.mkdirSync(directory);
};

/*
	@db {Database}
	@filename {String}
*/
function Changelog(db, filename) {
	this.filename = filename;
	this.db = db;
};

/*
	@db {Database}
*/
function FileReader(db) {
	this.db = db;
};

/*
	PROTOTYPES
*/

Database.prototype = new events.EventEmitter;

/*
	Insert data into database
	@arr {Array of Object}
	@fnCallback {Function} :: optional, params: @count {Number}
	@changes {String} :: optional, insert description
	return {Database}
*/
Database.prototype.insert = function(arr, fnCallback, changes) {

	var self = this;

	if (typeof(fnCallback) === 'string') {
		changes = fnCallback;
		fnCallback = null;
	}

	if (!util.isArray(arr))
		arr = [arr];

	if (self.status === STATUS_LOCKING|| self.status === STATUS_PENDING || self.countWrite >= MAX_WRITESTREAM) {

		arr.forEach(function(o) {
			self.pendingWrite.push({ json: o, changes: changes });
		});

		if (fnCallback)
			fnCallback(-1);

		return self;
	}

	var builder = [];
	var builderChanges = [];

	arr.forEach(function(doc) {

		if (typeof(doc.json) === 'undefined') {
			builder.push(doc);

			if (changes)
				builderChanges.push(changes);

			return;
		}

		builder.push(doc.json);

		if (doc.changes)
			builderChanges.push(doc.changes);
	});

	if (builder.length === 0) {
		self.next();
		return;
	}

	self.emit('insert', true, builder.length);

	self.status = STATUS_WRITING;
	self.countWrite++;

	appendFile(self.filename, builder, function() {

		self.countWrite--;
		self.emit('insert', false, builder.length);
		self.next();

		self.changelog.insert(builderChanges);

		if (fnCallback) {
			var length = builder.length;
			setImmediate(function() { fnCallback(length); });
		}

		builder = null;
		builderChanges = null;
		arr = null;
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
	var resume = true;

	var fnBuffer = function(buffer) {
		current += buffer;
		return current;
	};

	var fnItem = function(err, doc) {

		if (!resume)
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
			resume = false;
	};

	var reader = self.file.open(self.filename, MAX_BUFFER_SIZE, function(buffer) {

		onBuffer(buffer, fnItem, fnBuffer);
		return resume;

	}, function() {
		self.countRead--;
		self.next();

		setImmediate(function() {
			self.emit(name || 'read', false, isScalar ? count : selected.length);
			fnCallback(isScalar ? count : selected);
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
	@fnCallback {Function} :: params: @doc {Array of Object}
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

	var fnItem = function(err, doc) {

		// clear buffer;
		current = '';

		if (err) {
			self.emit('error', err, 'each-buffer');
			return;
		}

		operation.forEach(function(fn) {
			try
			{

				fn.item(doc, count, 'each-buffer');

			} catch (e) {
				self.emit('error', e);
			}
		});

		count++;
	};

	self.emit('each', true, 0);

	var reader = self.file.open(self.filename, MAX_BUFFER_SIZE, function(buffer) {

		onBuffer(buffer, fnItem, fnBuffer);
		return true;

	}, function() {
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

	return self;
};

/*
	Read and sort documents from database (SLOWLY)
	@fnFilter {Function} :: IMPORTANT: you must return {Boolean}
	@fnSort {Function} :: ---> array.sort()
	@itemSkip {Number}, default 0 (if itemSkip = 0 and itemTake = 0 then return all documents)
	@itemTake {Number}, default 0 (if itemSkip = 0 and itemTake = 0 then return all documents)
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
	Clear database
	@fnCallback {Function} :: optional
	@changes {String} :: optional, clear description
	return {Database}
*/
Database.prototype.clear = function(fnCallback, changes) {

	var self = this;
	var type = typeof(fnCallback);

	if (type === 'undefined')
		fnCallback = null;

	if (type === 'string') {
		changes = fnCallback;
		fnCallback = null;
	}

	self.pendingClear.push(function() {

		if (changes)
			self.changelog.insert(changes);

		fnCallback && fnCallback();
	});

	if (self.status !== STATUS_UNKNOWN)
		return self;

	self.status = STATUS_LOCKING;

	var operation = [];

	self.pendingClear.forEach(function(o) {
		if (o !== null)
			operation.push(o);
	});

	self.emit('clear', true, false);
	self.pendingClear = [];

	fs.exists(self.filename, function(exists) {

		if (!exists) {

			self.next();

			setImmediate(function() {
				self.emit('clear', false, true);
				operation.forEach(function(fn) {
					fn && fn();
				});
			});

			return;
		}

		fs.unlink(self.filename, function(err) {

			if (err)
				self.emit('error', err, 'clear');

			self.next();

			setImmediate(function() {
				self.emit('clear', false, err === null);
				operation.forEach(function(fn) {
					fn && fn(err === null);
				});
			});
		});
	});

	return self;
};

/*
	Drop database
	@fnCallback {Function} :: optional, params: @dropped {Boolean}
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

	self._drop();

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
	Internal function :: remove all files (views, binary)
	!!! SYNC !!!
*/
Database.prototype._drop = function() {
	var self = this;
	var noop = function() {};

	fs.readdirSync(self.directory).forEach(function(filename) {

		var isView = filename.indexOf(self.name + '#') !== -1 && filename.indexOf(EXTENSION_VIEW) !== -1;

		if (isView) {
			fs.unlink(path.join(self.directory, filename), noop);
			return;
		}

		var isChange = self.name + EXTENSION_CHANGES === filename;

		if (isChange) {
			fs.unlink(path.join(self.directory, filename), noop);
			return;
		}

	});

	if (self.binary === null)
		return self;

	fs.readdirSync(self.binary.directory).forEach(function(filename) {
		if (filename.indexOf(self.name + '#') === -1 || filename.indexOf(EXTENSION_BINARY) === -1)
			return;
		fs.unlink(path.join(self.binary.directory, filename), noop);
	});

	return self;
};

/*
	Update multiple documents
	@fnUpdate {Function} :: params: @doc {Object} and IMPORTANT: you must return updated @doc;
	@fnCallback {Function} :: optional, params: @count {Number}
	@changes {String} :: optional, changes description
	@type {String} :: internal, optional
	return {Database}
*/
Database.prototype.update = function(fnUpdate, fnCallback, changes, type) {
	var self = this;

	if (typeof(fnCallback) === 'string') {
		changes = fnCallback;
		fnCallback = null;
	}

	if (typeof(fnUpdate) !== 'undefined')
		self.pendingLock.push(updatePrepare(fnUpdate, fnCallback, changes, type || 'update'));

	if (self.status !== STATUS_UNKNOWN) {
		return self;
	}

	var operation = [];

	self.pendingLock.forEach(function(fn) {
		operation.push(fn);
	});

	if (operation.length === 0) {
		self.next();
		return self;
	}

	self.status = STATUS_LOCKING;

	var current = '';
	var operationLength = operation.length;
	var lines = [];

	var countRemove = 0;
	var countUpdate = 0;
	var countWrite = 0;
	var completed = false;

	self.emit('update/remove', true, 0, 0);
	self.pendingLock = [];

	// rename updated file
	var fnRename = function() {
		operation.forEach(function(o) {

			if (o.type === 'update') {
				o.count = countUpdate;
				return;
			}

			if (o.type === 'remove')
				o.count = countRemove;
		});

		fs.rename(self.filenameTemp, self.filename, function(err) {

			if (err)
				self.emit('error', err, 'update/rename-file');

			self.emit('update/remove', false, countUpdate, countRemove);

			var changes = [];
			operation.forEach(function(o) {

				if (typeof(o.changes) !== 'undefined')
					changes.push(o.changes);

				if (o.callback)
					(function(cb,count) { setImmediate(function() { cb(count); }); })(o.callback, o.count);

			});

			if (changes.length > 0)
				self.changelog.insert(changes);

			self.next();

		});
	};

	// write to temporary
	var fnWrite = function(json, valid) {

		if (lines.length > 25 || valid) {
			countWrite++;
			fs.appendFile(self.filenameTemp, lines.join(NEWLINE) + NEWLINE, function() {
				countWrite--;
				if (completed && countWrite <= 0)
					fnRename();
			});
			lines = [];
		}

		if (typeof(json) === 'string')
			lines.push(json);
	};

	var fnBuffer = function(buffer) {
		current += buffer;
		return current;
	};

	var fnItem = function(err, doc, json) {

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

	var reader = self.file.open(self.filename, MAX_BUFFER_SIZE, function(buffer) {

		onBuffer(buffer.toString(), fnItem, fnBuffer);
		return true;

	}, function(success) {

		if (!success) {
			self.next();
			return;
		}

		completed = true;
		fnWrite(null, true);
	});

	return self;
};

/*
	Update multiple documents
	@fnUpdate {Function} :: params: @doc {Object} and IMPORTANT: you must return updated @doc;
	@fnCallback {Function} :: optional, params: @count {Number}
	@changes {String} :: optional, changes description
	return {Database}
*/
Database.prototype.prepare = function(fnUpdate, fnCallback, changes) {
	var self = this;

	if (typeof(fnUpdate) !== 'undefined')
		self.pendingLock.push(updatePrepare(fnUpdate, fnCallback, changes, 'update'));

	return self;
};

/*
	Remove data from database
	@fnFilter {Function} :: params: @obj {Object}, IMPORTANT: you must return {Boolean}
	@fnCallback {Function} :: params: @count {Number}
	@changes {String} :: optional, changes description
	return {Database}
*/
Database.prototype.remove = function(fnFilter, fnCallback, changes) {

	var self = this;

	if (typeof(fnFilter) === 'string')
		fnFilter = filterPrepare(fnFilter);

	var filter = function(item) {

		if (fnFilter(item))
			return null;

		return item;
	};

	self.update(filter, fnCallback, changes, 'remove');
	return self;
};

Database.prototype.pause = function() {
	var self = this;

	if (self.isPending === true)
		return self;

	self.isPending = true;

	if (self.status === STATUS_UNKNOWN) {
		self.status = STATUS_PENDING;
		self.emit('pause/resume', true);
	}

	return self;
};

Database.prototype.resume = function() {
	var self = this;

	if (!self.isPending)
		return self;

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

	if (self.pendingClear.length > 0) {
		self.clear();
		return;
	}

	setImmediate(function() {
		self.emit('complete', self.status_prev);
	});
};

// ========================================================================
// VIEWS PROTOTYPE
// ========================================================================

/*
	Read documents from view
	@name {String}
	@fnCallback {Function} :: params: @doc {Array of Object}, @count {Number}
	@itemSkip {Number} :: optional, default 0
	@itemTake {Number} :: optional, default 0
	@fnFilter {Function} :: optional, IMPORTANT: you must return {Boolean}
*/
Views.prototype.all = function(name, fnCallback, itemSkip, itemTake, fnFilter) {

	var self = this;
	var view = self.views[name];

	if (typeof(view) === 'undefined') {
		view = self.getView(name);
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
	@fnCallback {Function} :: params: @doc {Array of Object}
	@fnFilter {Function} :: optional, IMPORTANT: you must return {Boolean}
	return {Database}
*/
Views.prototype.top = function(name, top, fnCallback, fnFilter) {

	var self = this;
	var view = self.views[name];

	if (typeof(view) === 'undefined') {
		view = self.getView(name);
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
		view = self.getView(name);
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
	@changes {Function} :: optional, drop description
	return {Database}
*/
Views.prototype.drop = function(name, fnCallback, changes) {

	var self = this;
	var view = self.views[name];

	if (typeof(fnCallback) === 'string') {
		changes = fnCallback;
		fnCallback = null;
	}

	if (typeof(view) === 'undefined') {
		view = self.getView(name);
		self.views[name] = view;
	}

	self.db.emit('view/drop', true, name);

	view.operation(function(cb) {
		fs.exists(view.filename, function(exists) {

			self.db.emit('view/drop', false, name);

			if (changes)
				self.db.changelog.insert(changes);

			if (!exists) {
				fnCallback && fnCallback(true);
				cb && cb();
				return;
			}

			fs.unlink(view.filename, function(err) {

				if (err)
					self.db.emit('error', err, 'view/drop');

				fnCallback && fnCallback(true);
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
	@changes {Function} :: optional, create description
	return {Database}
*/
Views.prototype.create = function(name, fnFilter, fnSort, fnCallback, fnUpdate, changes) {

	var self = this;
	var selected = [];
	var count = 0;

	if (typeof(fnCallback) === 'string') {
		changes = fnCallback;
		fnCallback = null;
		fnUpdate = null;
	} else if (typeof(fnUpdate) === 'string') {
		changes = fnUpdate;
		fnUpdate = null;
	}

	if (typeof(fnFilter) === 'string')
		fnFilter = filterPrepare(fnFilter);

	self.db.emit('view/create', true, name, 0);

	var onCallback = function() {
		selected.sort(fnSort);
		var view = self.views[name];

		if (typeof(view) === 'undefined') {
			view = self.getView(name);
			self.views[name] = view;
		}

		var filename = self.getFileName(name);

		view.operation(function(cb) {

			var fnAppend = function() {
				appendFile(filename, selected, function() {

					self.db.emit('view/create', false, name, count);

					if (changes)
						self.db.changelog.insert(changes);

					fnCallback && setImmediate(function() { fnCallback(count); });
					cb && cb();

				});
			};

			fs.exists(filename, function(exists) {

				if (!exists) {
					fnAppend();
					return;
				}

				fs.unlink(filename, function(err) {

					if (err) {
						self.db.emit('error', err, 'view/create');
						cb & cb();
						return;
					}

					fnAppend();
				})
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

/*
	Create view object
	@name {String}
	return {View}
*/
Views.prototype.getView = function(name) {
	var self = this;
	return new View(self.db, name, self.getFileName(name));
};

/*
	Create view filename
	@name {String}
	return {String}
*/
Views.prototype.getFileName = function(name) {
	var self = this;
	return path.join(self.directory, self.db.name + '#' + name + EXTENSION_VIEW);
};

// ========================================================================
// VIEW PROTOTYPE
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

	if (typeof(fnFilter) === 'string')
		fnFilter = filterPrepare(fnFilter);

	if (fnFilter === null)
		fnFilter = function() { return true; };

	self.db.emit('view', true, self.name, 0);
	self.countRead++;

	var selected = [];
	var current = '';
	var count = 0;
	var resume = true;

	var fnBuffer = function(buffer) {
		current += buffer;
		return current;
	};

	var fnItem = function(err, doc) {

		// clear buffer;
		current = '';

		if (err || !fnFilter(doc))
			return;

		count++;

		if (!resume)
			return;

		if (skip > 0 && count <= skip)
			return;

		selected.push(doc);

		if (take > 0 && selected.length === take)
			resume = false;
	};

	var reader = self.file.open(self.filename, MAX_BUFFER_SIZE, function(buffer) {

		if (skipCount && !resume) {
			count = -1;
			return false;
		}

		onBuffer(buffer, fnItem, fnBuffer);
		return resume;

	}, function() {

		self.countRead--;
		self.next();

		setImmediate(function() {
			self.emit('view', false, self.name, count);
			fnCallback(selected, count);
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
// BINARY PROTOTYPE
// ========================================================================

/*
	Insert binary file
	@name {String} :: filename without path
	@type {String} :: content type
	@buffer {Buffer} :: binary data or base64
	@fnCallback {Function} :: optional, params: @id {String}, @header {Object}
	@changes {String} :: optional, insert description
	return {String} :: return ID - identificator
*/
Binary.prototype.insert = function(name, type, buffer, fnCallback, changes) {

	if (typeof(buffer) === 'string')
		buffer = new Buffer(buffer, 'base64');

	if (typeof(fnCallback) === 'string') {
		changes = fnCallback;
		fnCallback = null;
	}

	var self = this;
	var size = buffer.length;
	var header = JSON.stringify({ name: name, size: size, type: type });

	size = (BINARY_HEADER_LENGTH - header.length) + 1;
	header += new Array(size).join(' ');

	var id = self.db.name + '#' + new Date().getTime().toString() + Math.random().toString(36).substring(10);
	var stream = fs.createWriteStream(path.join(self.directory, id + EXTENSION_BINARY));

	stream.write(header);
	stream.end(buffer);
	stream = null;

	if (changes)
		self.db.changelog.insert(changes);

	fnCallback && fnCallback(id, header);
	return id;
};

/*
	Read binary file
	@id {String} :: identificator
	@callback {Function} :: params: @err {Error}, @readStream {Stream}, @header {Object} / header.name {String}, header.size {Number}, header.type {String}
	return {Database}
*/
Binary.prototype.read = function(id, callback) {

	var self = this;

	var filename = path.join(self.directory, id + EXTENSION_BINARY);
	var stream = fs.createReadStream(filename, { start: 0, end: BINARY_HEADER_LENGTH - 1 });

	stream.on('error', function(err) {
		callback(err, null, null);
	});

	stream.on('data', function(buffer) {
		var json = buffer.toString('utf8').replace(/^[\s]+|[\s]+$/g, '');
		stream = fs.createReadStream(filename, { start: BINARY_HEADER_LENGTH });
		callback(null, stream, JSON.parse(json));
	});

	return self.db;
};

/*
	Remove binary file
	@id {String} :: identificator
	@fnCallback {Function} :: params: @removed {Boolean}
	@changes {String} :: optional, remove description
	return {Database}
*/
Binary.prototype.remove = function(id, fnCallback, changes) {
	var self = this;
	var filename = path.join(self.directory, id + EXTENSION_BINARY);

	if (typeof(fnCallback) === 'string') {
		changes = fnCallback;
		fnCallback = null;
	}

	fs.exists(filename, function(exists) {

		if (changes)
			self.db.changelog.insert(changes);

		if (!exists) {
			fnCallback && fnCallback(false);
			return;
		}

		fs.unlink(filename, function() {
			fnCallback && fnCallback(true);
		});
	});

	return self.db;
};

// ========================================================================
// CHANGELOG PROTOTYPE
// ========================================================================

/*
	Append change to changelog
	@description {String}
	return {Database}
*/
Changelog.prototype.insert = function(description) {

	var self = this;

	if (!self.db.changes)
		return self.db;

	if (typeof(description) === 'undefined')
		return self.db;

	if (!util.isArray(description))
		description = [description || ''];

	if (description.length === 0)
		return self.db;

	var lines = '';
	var dd = new Date();

	var y = dd.getFullYear();
	var M = (dd.getMonth() + 1).toString();
	var d = dd.getDate().toString();
	var h = dd.getHours().toString();
	var m = dd.getMinutes().toString();
	var s = dd.getSeconds().toString();

	if (M.length === 1)
		M = '0' + M;

	if (d.length === 1)
		d = '0' + d;

	if (m.length === 1)
		m = '0' + m;

	if (h.length === 1)
		h = '0' + h;

	if (s.length === 1)
		s = '0' + s;

	var dt = y + '-' + M + '-' + d + ' ' + h + ':' + m + ':' + s;

	description.forEach(function(line) {
		lines += dt + ' | ' + line + NEWLINE;
		self.db.emit('change', line);
	});

	fs.appendFile(self.filename, lines, function(err) {});
	return self.db;
};

/*
	Read changelog
	fnCallback {Function}
*/
Changelog.prototype.read = function(fnCallback) {

	var self = this;

	fs.exists(self.filename, function(exist) {

		if (!exist) {
			fnCallback([]);
			return;
		}

		fs.readFile(self.filename, function(err, data) {
			if (err) {
				fnCallback([]);
				return;
			}

			var lines = data.toString('utf8').split('\n');

			if (lines[lines.length - 1] === '')
				lines.pop();

			fnCallback(lines);
		});

	});

	return self.db;
};

/*
	Clear changelog
	fnCallback {Function} :: optional
	return {Database}
*/
Changelog.prototype.clear = function(fnCallback) {
	var self = this;
	fs.exists(self.filename, function(exist) {

		if (!exist) {
			fnCallback && fnCallback(false);
			return;
		}

		fs.unlink(self.filename, function(err, data) {

			if (err) {
				fnCallback && fnCallback(false);
				return;
			}

			fnCallback && fnCallback(true);
		});

	});
	return self.db;
};

// ========================================================================
// READER PROTOTYPE
// ========================================================================

FileReader.prototype.open = function(filename, size, fnBuffer, fnCallback) {
	var self = this;
	fs.open(filename, 'r', function(err, fd) {

	    if (err) {
	        fnCallback(false);
	        return;
	    }

	    size = size || 1024;

		var next = function next(cancel, position) {

			if (cancel) {
				fs.close(fd);
				fd = null;
				fnCallback(true);
				return;
			}

			self.read(fd, position + size, size, fnBuffer, next);
		};

	    self.read(fd, 0, size, fnBuffer, next);
	});
};

FileReader.prototype.read = function(fd, position, size, fnBuffer, next) {
    var buffer = new Buffer(size);

    fs.read(fd, buffer, 0, size, position, function(err, num) {

    	var cancel = num !== size;
    	var data = buffer.toString('utf8', 0, num);

    	if (cancel) {
    		fnBuffer(data);
    		next(true);
    		return;
    	}

    	try {
    		cancel = !fnBuffer(data);
    	} catch (err) {
    		cancel = true;
    	}

    	next(cancel, position, size);
    });
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
	if (fnFilter.length === 0)
		return function() { return true; };
	return eval('(function(doc){' + (fnFilter.indexOf('return ') === -1 ? 'return ' : '') + fnFilter + '})')
};

/*
	Buffer reader (internal function)
	@buffer {String}
	@fnItem {Function}
	@fnBuffer {Function}
*/
function onBuffer(buffer, fnItem, fnBuffer) {

	var index = buffer.indexOf(NEWLINE);

	if (index === -1) {
		fnBuffer(buffer);
		return;
	}

	var json = fnBuffer(buffer.substring(0, index));

	try
	{
		fnItem(null, JSON.parse(json), json);
	} catch (ex) {
		fnItem(ex, null, json);
	}

	onBuffer(buffer.substring(index + 1), fnItem, fnBuffer);
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
function updatePrepare(fnUpdate, fnCallback, changes, type) {

	if (typeof(fnUpdate) === 'string')
		fnUpdate = filterPrepare(fnUpdate);

	return { filter: fnUpdate, callback: fnCallback, count: 0, type: type, changes: changes };
};

exports.database = Database;
exports.load = exports.open = exports.nosql = exports.init = function(filename, directory, changes) {
	return new Database(filename, directory, changes);
};
