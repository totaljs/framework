/**
 * @module NoSQL Embedded Database
 * @author Peter Širka <petersirka@gmail.com>
 * @copyright Peter Širka 2012-2015
 * @version 3.0.4
 */

'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var events = require('events');

var VERSION = 'v3.0.3';
var STATUS_UNKNOWN = 0;
var STATUS_READING = 1;
var STATUS_WRITING = 2;
var STATUS_LOCKING = 3;
var STATUS_PENDING = 4;
var EXTENSION = '.nosql';
var EXTENSION_VIEW = '.nosql';
var EXTENSION_BINARY = '.nosql-binary';
var EXTENSION_TMP = '.nosql-tmp';
var EXTENSION_CHANGES = '.changelog';
var EXTENSION_STORED = '.nosql-stored';
var EXTENSION_META = '.meta';
var MAX_WRITESTREAM = 2;
var MAX_READSTREAM = 4;
var MAX_BUFFER_SIZE = 1024 * 40;
var BINARY_HEADER_LENGTH = 2000;
var NEWLINE = '\n';
var STRING = 'string';
var FUNCTION = 'function';
var UNDEFINED = 'undefined';
var BOOLEAN = 'boolean';

if (typeof(setImmediate) === UNDEFINED) {
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

	if (typeof(directory) === BOOLEAN) {
		changes = directory;
		directory = null;
	}

	this.isReady = false;
	this.status_prev = STATUS_UNKNOWN;
	this.status = STATUS_UNKNOWN;
	this.changes = changes === undefined ? true : changes === true;

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
	this.filenameStored = filename + EXTENSION_STORED;
	this.filenameMeta = filename + EXTENSION_META;

	this.name = path.basename(filename);

	this.directory = path.dirname(filename);
	this.views = new Views(this);

	this.meta = {
		version: VERSION,
		views: {},
		stored: {},
		description: '',
		created: new Date(),
		custom: null
	};

	this.binary = (directory || '').length === 0 ? null : new Binary(this, directory);
	this.changelog = new Changelog(this, this.filenameChanges);
	this.file = new FileReader(this);
	this.stored = new Stored(this, this.filenameStored);

	this._metaLoad();
}

/*
	@db {Database}
*/
function Views(db) {
	this.views = {};
	this.db = db;
	this.directory = db.directory;
	this.emit = db.emit;
}

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
}

/*
	@db {Database}
*/
function Stored(db, filename) {
	this.filename = filename;
	this.db = db;
	this.stored = {};
	this.cache = {};
	this.isReaded = false;
}

/*
	@db {Database}
	@directory {String}
*/
function Binary(db, directory) {
	this.db = db;
	this.directory = directory;
	this.exists = false;
}

/*
	@db {Database}
	@filename {String}
*/
function Changelog(db, filename) {
	this.filename = filename;
	this.db = db;
}

/*
	@db {Database}
*/
function FileReader(db) {
	this.db = db;
}

/*
	PROTOTYPES
*/

Database.prototype = {

	get created() {

		var dt = this.meta.created;
		if (util.isDate(dt))
			return dt;

		if (dt === null || dt === undefined)
			return null;

		return new Date(Date.parse(dt.toString()));
	}
};

Database.prototype.__proto__ = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: Database,
		enumberable: false
	}
});

/*
	Insert data into database
	@arr {Array of Object}
	@fnCallback {Function(err, count)} callback
	@changes {String} :: optional, insert description
	return {Database}
*/
Database.prototype.insert = function(arr, fnCallback, changes) {

	var self = this;

	if (typeof(fnCallback) === STRING) {
		changes = fnCallback;
		fnCallback = null;
	}

	if (!(arr instanceof Array))
		arr = [arr];

	var length = arr.length;

	if (self.status === STATUS_LOCKING|| self.status === STATUS_PENDING || self.countWrite >= MAX_WRITESTREAM) {

		for (var i = 0; i < length; i++)
			self.pendingWrite.push({ json: arr[i], changes: changes });

		if (fnCallback)
			fnCallback(null, -1);

		return self;
	}

	var builder = [];
	var builderChanges = [];

	for (var i = 0; i < length; i++) {

		var doc = arr[i];

		if (doc.json === undefined) {
			builder.push(doc);

			if (changes)
				builderChanges.push(changes);

			continue;
		}

		builder.push(doc.json);

		if (doc.changes)
			builderChanges.push(doc.changes);
	}

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
			setImmediate(function() { fnCallback(null, length); });
		}

		builder = null;
		builderChanges = null;
		arr = null;

		var keys = Object.keys(self.meta.views);
		var length = keys.length;
		for (var i = 0; i < length; i++)
			self.views.refresh(keys[i]);

	}, self);

	return self;
};

Database.prototype.$$insert = function(arr, changes) {
	var self = this;
	return function(callback) {
		self.insert(arr, callback, changes);
	};
};

/*
	Read data from database
	@fnMap {Function} :: params: @doc {Object}, IMPORTANT: you must return {Object}
	@fnCallback {Function(err, array/number)}
	@itemSkip {Number} :: optional, default 0
	@itemTake {Number} :: optional, defualt 0
	@isScalar {Boolean} :: optional, default is false
	return {Database}
*/
Database.prototype.read = function(fnMap, fnCallback, itemSkip, itemTake, isScalar, name) {

	var self = this;
	var skip = itemSkip || 0;
	var take = itemTake || 0;

	if (self.status === STATUS_LOCKING || self.status === STATUS_PENDING || self.countRead >= MAX_READSTREAM) {

		self.pendingRead.push(function() {
			self.read(fnMap, fnCallback, itemSkip, itemTake, isScalar);
		});

		return self;
	}

	if (fnCallback === undefined) {
		fnCallback = fnMap;
		fnMap = function(doc) { return doc; };
	}

	if (typeof(fnMap) === STRING)
		fnMap = filterPrepare(fnMap);

	if (fnMap === null)
		fnMap = function(doc) { return doc; };

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

		if (err)
			return;

		var item = fnMap(doc);
		if (item === false || item === null || item === undefined)
			return;

		count++;

		if (skip > 0 && count <= skip)
			return;

		if (!isScalar)
			selected.push(item === true ? doc : item);

		if (take > 0 && selected.length === take)
			resume = false;
	};

	self.file.open(self.filename, MAX_BUFFER_SIZE, function(buffer) {
		onBuffer(buffer, fnItem, fnBuffer);
		return resume;
	}, function() {
		self.countRead--;
		self.next();
		setImmediate(function() {
			self.emit(name || 'read', false, isScalar ? count : selected.length);
			fnCallback(null, isScalar ? count : selected);
		});
	});

	return self;
};

/*
	Read all documents from database
	@fnMap {Function} :: IMPORTANT: you must return {Object}
	@fnCallback {Function(err, array)}
	@itemSkip {Number} :: optional, default 0
	@itemTake {Number} :: optional, default 0
	return {Database}
*/
Database.prototype.all = function(fnMap, fnCallback, itemSkip, itemTake) {
	return this.read(fnMap, fnCallback, itemSkip, itemTake, false, 'all');
};

Database.prototype.$$all = function(fnMap, itemSkip, itemTake) {
	var self = this;
	return function(callback) {
		return self.all(fnMap, callback, itemSkip, itemTake);
	};
};

/*
	Read one document from database
	@fnMap {Function} :: must return {Object}
	@fnCallback {Function(err, doc)}
	return {Database}
*/
Database.prototype.one = function(fnMap, fnCallback) {

	var cb = function(err, selected) {
		fnCallback(err, selected ? selected[0] || null : null);
	};

	return this.read(fnMap, cb, 0, 1, false, 'one');
};

Database.prototype.$$one = function(fnMap) {
	var self = this;
	return function(callback) {
		return self.one(fnMap, callback);
	};
};

/*
	Read TOP "x" documents from database
	@fnMap {Function} :: IMPORTANT: you must return {Object}
	@fnCallback {Function} :: params: @doc {Array of Object}
	return {Database}
*/
Database.prototype.top = function(max, fnMap, fnCallback) {
	return this.read(fnMap, fnCallback, 0, max, false, 'top');
};

Database.prototype.$$top = function(max, fnMap) {
	var self = this;
	return function(callback) {
		return self.top(max, fnMap);
	};
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

Database.prototype.$$count = function(fnFilter) {
	var self = this;
	return function(callback) {
		return self.count(fnFilter, fnMap);
	};
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

	var length = self.pendingEach.length;

	for (var i = 0; i < length; i++)
		operation.push(self.pendingEach[i]);

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

		var length = operation.length;
		for (var i = 0; i < length; i++) {
			try
			{
				operation[i].item(doc, count, 'each-buffer');
			} catch (e) {
				self.emit('error', e);
			}
		}

		count++;
	};

	self.emit('each', true, 0);

	self.file.open(self.filename, MAX_BUFFER_SIZE, function(buffer) {
		onBuffer(buffer, fnItem, fnBuffer);
		return true;
	}, function() {
		self.countRead--;
		self.next();
		setImmediate(function() {
			self.emit('each', false, count);
			var length = operation.length;
			for (var i = 0; i < length; i++) {
				var fn = operation[i];
				if (fn.callback)
					fn.callback();
			}
		});
	});

	return self;
};

/*
	Read and sort documents from database (SLOWLY)
	@fnMap {Function} :: IMPORTANT: you must return {Object}
	@fnSort {Function} :: ---> array.sort()
	@itemSkip {Number}, default 0 (if itemSkip = 0 and itemTake = 0 then return all documents)
	@itemTake {Number}, default 0 (if itemSkip = 0 and itemTake = 0 then return all documents)
	@fnCallback {Function(err, selected, count)} :: params: @doc {Object}, @count {Number}
	return {Database}
*/
Database.prototype.sort = function(fnMap, fnSort, fnCallback, itemSkip, itemTake) {

	var self = this;
	var selected = [];
	var count = 0;

	if (typeof(fnMap) === STRING)
		fnMap = filterPrepare(fnMap);

	itemTake = itemTake || 0;
	itemSkip = itemSkip || 0;

	var onCallback = function() {

		selected.sort(fnSort);

		if (itemSkip > 0 || itemTake > 0)
			selected = selected.slice(itemSkip, itemSkip + itemTake);

		fnCallback(null, selected, count);
	};

	var onItem = function(doc) {

		var item = fnMap(doc);
		if (item === false || item === null || item === undefined)
			return;

		count++;
		selected.push(item === true ? doc : item);
	};

	self.each(onItem, onCallback);
	return self;
};

Database.prototype.$$sort = function(fnMap, fnSort, itemSkip, itemTake) {
	var self = this;
	return function(callback) {
		self.sort(fnMap, fnSort, callback, itemSkip, itemTake);
	};
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

	if (fnCallback === undefined)
		fnCallback = null;

	if (type === STRING) {
		changes = fnCallback;
		fnCallback = null;
	}

	self.pendingClear.push(function() {

		if (changes)
			self.changelog.insert(changes);

		if (fnCallback)
			fnCallback();
	});

	if (self.status !== STATUS_UNKNOWN)
		return self;

	self.status = STATUS_LOCKING;

	var operation = [];
	var length = self.pendingClear.length;

	for (var i = 0; i < length; i++) {
		var fn = self.pendingClear[i];
		if (fn !== null)
			operation.push(fn);
	}

	self.emit('clear', true, false);
	self.pendingClear = [];

	fs.exists(self.filename, function(exists) {

		if (!exists) {

			self.next();

			setImmediate(function() {
				self.emit('clear', false, true);

				var length = operation.length;
				for (var i = 0; i < length; i++) {
					var fn = operation[i];
					if (fn)
						fn();
				}

			});

			return;
		}

		fs.unlink(self.filename, function(err) {

			if (err)
				self.emit('error', err, 'clear');

			self.next();

			setImmediate(function() {
				self.emit('clear', false, err === null);

				var length = operation.length;
				for (var i = 0; i < length; i++) {
					var fn = operation[i];
					if (fn)
						fn();
				}
			});
		});
	});

	return self;
};

Database.prototype.$$clear = function(changes) {
	var self = this;
	return function(callback) {
		self.clear(callback, changes);
	};
};

/*
	Drop database
	@fnCallback {Function} :: optional, params: @dropped {Boolean}
	return {Database}
*/
Database.prototype.drop = function(fnCallback) {

	var self = this;

	if (fnCallback === undefined)
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
					if (fn)
						fn(null);
				});
			});

			return;
		}

		fn.unlink(self.filenameMeta, noop);
		fs.unlink(self.filename, function(err) {

			if (err)
				self.emit('error', err, 'drop');

			self.next();

			setImmediate(function() {
				self.emit('drop', false, err === null);
				operation.forEach(function(fn) {
					if (fn)
						fn(null, err === null);
				});
			});
		});
	});

	return self;
};

Database.prototype.drop = function() {
	var self = this;
	return function(callback) {
		self.drop(callback);
	};
};


function noop() {};

/*
	Internal function :: remove all files (views, binary)
	!!! SYNC !!!
*/
Database.prototype._drop = function() {
	var self = this;

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

	if (typeof(fnCallback) === STRING) {
		changes = fnCallback;
		fnCallback = null;
	}

	if (fnUpdate !== undefined)
		self.pendingLock.push(updatePrepare(fnUpdate, fnCallback, changes, type || 'update'));

	if (self.status !== STATUS_UNKNOWN)
		return self;

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

				if (o.changes !== undefined)
					changes.push(o.changes);

				if (o.callback)
					(function(cb,count) { setImmediate(function() { cb(null, count); }); })(o.callback, o.count);

			});

			if (changes.length > 0)
				self.changelog.insert(changes);

			self.next();

		});
	};

	var can = true;

	// write to temporary
	var fnWrite = function(json, valid) {

		if (can) {
			can = false;
			fs.appendFile(self.filenameTemp, '');
		}

		if (lines.length > 25 || valid) {

			if (lines.length === 0) {
				if (completed && countWrite <= 0)
					fnRename();
				return;
			}

			countWrite++;
			fs.appendFile(self.filenameTemp, lines.join(NEWLINE) + NEWLINE, function() {
				countWrite--;
				if (completed && countWrite <= 0)
					fnRename();
			});

			lines = [];
		}

		if (typeof(json) === STRING)
			lines.push(json);
	};

	var fnBuffer = function(buffer) {
		current += buffer;
		return current;
	};

	var fnItem = function(err, doc, json) {

		// clear buffer;
		current = '';
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

	self.file.open(self.filename, MAX_BUFFER_SIZE, function(buffer) {
		onBuffer(buffer.toString(), fnItem, fnBuffer);
		return true;
	}, function(success) {

		if (!success) {

			self.emit('update/remove', false, countUpdate, countRemove);
			var changes = [];
			operation.forEach(function(o) {
				if (o.changes !== undefined)
					changes.push(o.changes);
				if (o.callback)
					(function(cb,count) { setImmediate(function() { cb(null, count); }); })(o.callback, o.count);
			});

			if (changes.length > 0)
				self.changelog.insert(changes);

			self.next();
			return;
		}

		completed = true;
		fnWrite(null, true);
	});

	return self;
};

Database.prototype.$$update = function(fnUpdate, changes, type) {
	var self = this;
	return function(callback) {
		self.update(fnUpdate, callback, changes, type);
	};
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

	if (fnUpdate !== undefined)
		self.pendingLock.push(updatePrepare(fnUpdate, fnCallback, changes, 'update'));

	return self;
};

Database.prototype.$$prepare = function(fnUpdate, changes) {
	var self = this;
	return function(callback) {
		self.prepare(fnUpdate, callback, changes);
	};
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

	if (typeof(fnFilter) === STRING)
		fnFilter = filterPrepare(fnFilter);

	var filter = function(item) {

		if (fnFilter(item) === true)
			return null;

		return item;
	};

	self.update(filter, fnCallback, changes, 'remove');
	return self;
};

Database.prototype.$$remove = function(fnFilter, changes) {
	var self = this;
	return function(callback) {
		self.remove(fnFilter, callback, changes);
	}
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

Database.prototype.description = function(value) {
	var self = this;

	if (value === undefined)
		return self.meta.description;

	self.meta.description = (value || '').toString();
	self._metaSave();
	return self;
};

Database.prototype.custom = function(value) {
	var self = this;

	if (value === undefined)
		return self.meta.custom;

	self.meta.custom = value;
	self._metaSave();
	return self;
};

Database.prototype._metaSave = function() {
	var self = this;

	if (self.meta.created === undefined)
		self.meta.created = new Date();

	fs.writeFile(self.filenameMeta, JSON.stringify(self.meta), noop);
	return self;
};

Database.prototype._metaLoad = function(callback) {

	var self = this;

	fs.readFile(self.filenameMeta, function(err, data) {

		var isReady = self.isReady;
		self.isReady = true;

		if (err) {

			if (!isReady) {
				self.emit('ready');
				self.emit('load');
			}

			if (callback)
				callback(false, self.meta);

			return;
		}

		self.meta = JSON.parse(data.toString('utf8'));

		var keys = Object.keys(self.meta.views);
		var length = keys.length;

		for (var i = 0; i < length; i++)
			self.meta.views[keys[i]].isReady = true;

		if (!isReady) {
			self.emit('ready');
			self.emit('load');
		}

		if (callback)
			callback(true, self.meta);

	});

	return self;
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
	@fnMap {Function} :: optional, IMPORTANT: you must return {Object}
*/
Views.prototype.all = function(name, fnCallback, itemSkip, itemTake, fnMap) {

	var self = this;
	var view = self.views[name];

	if (view === undefined) {
		view = self.getView(name);
		self.views[name] = view;
	}

	var type = typeof(itemSkip);

	if (type === FUNCTION || type === STRING) {
		fnMap = itemSkip;
		itemSkip = 0;
		itemTake = 0;
	} else {
		type = typeof(itemTake);
		if (type === FUNCTION || type === STRING) {
			fnMap = itemTake;
			itemTake = 0;
		}
	}

	if (typeof(fnMap) === STRING)
		fnMap = filterPrepare(fnMap);

	if (typeof(fnMap) !== FUNCTION)
		fnMap = function(o) { return o; };

	view.read(fnMap, fnCallback, itemSkip, itemTake);
	return self.db;
};

Views.prototype.$$all = function(name, itemSkip, itemTake, fnMap) {
	var self = this;
	return function(callback) {
		self.all(name, callback, itemSkip, itemTake, fnMap);
	};
};

/*
	Read documents from view
	@name {String}
	@top {Number}
	@fnCallback {Function} :: params: @doc {Array of Object}
	@fnMap {Function} :: optional, IMPORTANT: you must return {Object}
	return {Database}
*/
Views.prototype.top = function(name, top, fnCallback, fnMap) {

	var self = this;
	var view = self.views[name];

	if (view === undefined) {
		view = self.getView(name);
		self.views[name] = view;
	}

	if (typeof(fnMap) === STRING)
		fnMap = filterPrepare(fnMap);

	if (typeof(fnMap) !== FUNCTION)
		fnMap = function(o) { return o; };

	view.read(fnMap, fnCallback, 0, top, true);
	return self.db;
};

Views.prototype.$$top = function(name, top, fnMap) {
	var self = this;
	return function(callback) {
		self.top(name, top, callback, fnMap);
	};
};

/*
	Read one document from view
	@name {String}
	@fnMap {Function} :: optional, IMPORTANT: you must return {Object}
	@fnCallback {Function} :: params: @doc {Object}
	return {Database}
*/
Views.prototype.one = function(name, fnMap, fnCallback) {

	var self = this;
	var view = self.views[name];

	if (view === undefined) {
		view = self.getView(name);
		self.views[name] = view;
	}

	if (fnCallback === undefined) {
		fnCallback = fnMap;
		fnMap = null;
	}

	if (typeof(fnMap) === STRING)
		fnMap = filterPrepare(fnMap);

	if (typeof(fnMap) !== FUNCTION)
		fnMap = function(o) { return o; };

	view.read(fnMap, fnCallback, 0, 1, true);
	return self.db;
};

Views.prototype.$$one = function(name, fnMap) {
	var self = this;
	return function(callback) {
		self.one(name, fnMap, callback);
	};
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

	if (typeof(fnCallback) === STRING) {
		changes = fnCallback;
		fnCallback = null;
	}

	if (view === undefined) {
		view = self.getView(name);
		self.views[name] = view;
	}

	delete self.db.meta.views[name];
	self.db._metaSave();

	self.db.emit('view/drop', true, name);

	view.operation(function(cb) {
		fs.exists(view.filename, function(exists) {

			self.db.emit('view/drop', false, name);

			if (changes)
				self.db.changelog.insert(changes);

			if (!exists) {

				if (fnCallback)
					fnCallback(null, true);

				if (cb)
					cb();

				return;
			}

			fs.unlink(view.filename, function(err) {

				if (err)
					self.db.emit('error', err, 'view/drop');

				if (fnCallback)
					fnCallback(err, true);

				if (cb)
					cb();
			});
		});
	});

	return self.db;
};

Views.prototype.$$drop = function(name, fnCallback, changes) {
	var self = this;
	return function(callback) {
		self.drop(name, callback, changes);
	}
};

Views.prototype.refresh = function(name, fnCallback) {

	var self = this;
	var schema = self.db.meta.views[name];

	schema.isReady = false;

	var fnSort = schema['sort'] || '';
	var fnMap = schema['map'];

	if (fnSort.length === 0)
		fnSort = null;
	else
		fnSort = eval('(' + fnSort + ')');

	fnMap = eval('(' + fnMap + ')');

	var selected = [];
	var count = 0;

	self.db.emit('view/refresh', true, name, '');

	var onCallback = function() {

		if (fnSort)
			selected.sort(fnSort);

		var view = self.views[name];

		if (view === undefined) {
			view = self.getView(name);
			self.views[name] = view;
		}

		var filename = self.getFileName(name);

		view.operation(function(cb) {

			var fnAppend = function() {
				appendFile(filename, selected, function() {

					self.db.emit('view/refresh', false, name, count);
					schema.isReady = true;

					if (fnCallback)
						setImmediate(function() { fnCallback(null, count); });

					if (cb)
						cb();

				}, self.db);
			};

			fs.exists(filename, function(exists) {

				if (!exists) {
					fnAppend();
					return;
				}

				fs.unlink(filename, function(err) {

					if (!err) {
						fnAppend();
						return;
					}

					self.db.emit('error', err, 'view/refresh');

					if (cb)
						cb();
				});
			});

		});
	};

	var onItem = function(doc) {

		var item = fnMap(doc) || null;
		if (item === null)
			return;

		count++;
		selected.push(item);

	};

	self.db.each(onItem, onCallback);
};

Views.prototype.$$refresh = function(name) {
	var self = this;
	return function(callback) {
		self.refresh(name, callback);
	};
};

/*
	Create view
	@name {String}
	@fnMap {Function} :: IMPORTANT: you must return {Boolean}
	@fnSort {Function} :: ---> array.sort()
	@fnCallback {Function} :: params: @count {Number}
	@changes {Function} :: optional, create description
	return {Views}
*/
Views.prototype.create = function(name, fnMap, fnSort, fnCallback, changes) {

	var self = this;

	if (typeof(fnCallback) === STRING) {
		changes = fnCallback;
		fnCallback = null;
	}

	if (typeof(fnMap) === STRING)
		fnMap = filterPrepare(fnMap);

	self.db.meta.views[name] = {
		map: fnMap.toString(),
		sort: (fnSort || '').toString(),
		isReady: false
	};

	self.db._metaSave();
	self.db.emit('view/create', true, name, 0);

	if (changes)
		self.db.changelog.insert(changes);

	self.refresh(name, fnCallback);
	return self;
};

Views.prototype.$$create = function(name, fnMap, fnSort, changes) {
	var self = this;
	return function(callback) {
		self.create(name, fnMap, fnSort, callback, changes);
	};
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
	@fnMap {Function} :: IMPORTANT: you must return {Object}
	@fnCallback {Function} :: params: @selected {Array of Object}, @count {Number}
	@itemSkip {Number} :: optional, default 0
	@itemTake {Number} :: optional, default 0
	@skipCount {Boolean} :: optional, default false
	return {View}
*/
View.prototype.read = function(fnMap, fnCallback, itemSkip, itemTake, skipCount, isScalar) {

	var self = this;
	var skip = itemSkip || 0;
	var take = itemTake || 0;

	skipCount = skipCount || false;

	if (self.status === STATUS_LOCKING || self.countRead >= MAX_READSTREAM) {

		self.pendingRead.push(function() {
			self.read(fnMap, fnCallback, itemSkip, itemTake, isScalar);
		});

		return self;
	}

	self.status = STATUS_READING;

	if (typeof(fnMap) === STRING)
		fnMap = filterPrepare(fnMap);

	if (fnMap === null)
		fnMap = function(o) { return o; };

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

		if (!resume)
			return;

		// clear buffer;
		current = '';

		if (err)
			return;

		var item = fnMap(doc);
		if (item === false || item === null || item === undefined)
			return;

		count++;

		if (skip > 0 && count <= skip)
			return;

		if (!isScalar)
			selected.push(item === true ? doc : item);

		if (take > 0 && selected.length === take)
			resume = false;
	};

	self.file.open(self.filename, MAX_BUFFER_SIZE, function(buffer) {

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
			fnCallback(null, selected, count);
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

	if (fnCallback !== undefined)
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
// STORED PROTOTYPE
// ========================================================================

/*
	Create a new stored function
	@name {String}
	@fn {Function}
	@fnCallback {Function} :: optional
	@changes {String} :: optional
	return {Database}
*/
Stored.prototype.create = function(name, fn, fnCallback, changes) {

	if (typeof(fnCallback) === STRING) {
		var tmp = changes;
		changes = fnCallback;
		fnCallback = tmp;
	}

	var self = this;

	self.db.meta.stored[name] = fn.toString();
	self.db._metaSave(fnCallback);

	delete self.cache[name];

	if (changes)
		self.db.changelog.insert(changes);

	self.db.emit('stored/create', name);

	return self.db;
};

Stored.prototype.$$create = function(name, fn, changes) {
	var self = this;
	return function(callback) {
		self.create(name, fn, callback, changes);
	};
};


/*
	Remove a stored function
	@name {String}
	@fnCallback {Function} :: optional
	@changes {String} :: optional
	return {Database}
*/
Stored.prototype.remove = function(name, fnCallback, changes) {

	var self = this;

	if (typeof(fnCallback) === STRING) {
		var tmp = changes;
		changes = fnCallback;
		fnCallback = tmp;
	}

	if (changes)
		self.db.changelog.insert(changes);

	delete self.cache[name];
	delete self.db.meta.stored[name];

	self.db._metaSave(fnCallback);

	return self.db;
};

Stored.prototype.$$remove = function(name, changes) {
	var self = this;
	return function(callback) {
		self.remove(name, callback, changes);
	};
};

/*
	Clear all stored functions
	@fnCallback {Function} :: optional
	@changes {String} :: optional
	return {Database}
*/
Stored.prototype.clear = function(fnCallback, changes) {

	var self = this;

	if (typeof(fnCallback) === STRING) {
		var tmp = changes;
		changes = fnCallback;
		fnCallback = tmp;
	}

	if (changes)
		self.db.changelog.insert(changes);

	self.cache = {};
	self.db.meta.stored = {};
	self.db._metaSave(fnCallback);

	return self.db;
};

Stored.prototype.$$clear = function(changes) {
	var self = this;
	return function(callback) {
		self.clear(callback, changes);
	};
};

/*
	Execute a stored function
	@name {String}
	@params {Object} :: params
	@fnCallback {Function} :: optional
	@changes {String} :: optional
	return {Stored}
*/
Stored.prototype.execute = function(name, params, fnCallback, changes) {

	var self = this;
	var type = typeof(params);

	if (type === FUNCTION) {
		changes = fnCallback;
		fnCallback = params;
		params = null;
	}

	if (typeof(fnCallback) === STRING) {
		var tmp = changes;
		changes = fnCallback;
		fnCallback = tmp;
	}

	if (changes)
		self.db.changelog.insert(changes);

	var fn = self.db.meta.stored[name];

	if (fn === undefined) {

		if (fnCallback)
			fnCallback();

		return;
	}

	var cache = self.cache[name];
	self.db.emit('stored', name);

	if (fn === undefined) {

		if (fnCallback)
			fnCallback();

		return;
	}

	if (cache === undefined) {
		fn = eval('(' + fn + ')');
		self.cache[name] = fn;
	} else
		fn = cache;

	if (fnCallback === undefined)
		fnCallback = function() {};

	fn.call(self.db, self.db, fnCallback, params || null);
	return self;
};

Stored.prototype.$$execute = function(name, params, changes) {
	var self = this;
	return function(callback) {
		self.execute(name, params, callback, changes);
	};
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

	if (typeof(buffer) === STRING)
		buffer = new Buffer(buffer, 'base64');

	if (buffer.resume)
		return this.insert_stream(null, name, type, buffer, callback, changes);

	if (typeof(fnCallback) === STRING) {
		changes = fnCallback;
		fnCallback = null;
	}

	var self = this;
	var size = buffer.length;
	var dimension = { width: 0, height: 0 };

	self.check();

	if (name.indexOf('.gif') !== -1)
		dimension = dimensionGIF(buffer);
	else if (name.indexOf('.png') !== -1)
		dimension = dimensionPNG(buffer);
	else if (name.indexOf('.jpg') !== -1)
		dimension = dimensionJPG(buffer);

	var header = new Buffer(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify({ name: name, size: size, type: type, width: dimension.width, height: dimension.height }));

	var id = new Date().getTime().toString() + Math.random().toString(36).substring(10);
	var key = self.db.name + '#' + id;
	var stream = fs.createWriteStream(path.join(self.directory, key + EXTENSION_BINARY));

	stream.write(header, 'binary');
	stream.end(buffer);
	stream = null;

	if (changes)
		self.db.changelog.insert(changes);

	if (fnCallback)
		fnCallback(null, id, header);

	return id;
};

Binary.prototype.insert_stream = function(id, name, type, stream, fnCallback, changes) {

	self.check();

	var header = new Buffer(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify({ name: name, size: size, type: type, width: 0, height: 0 }));

	if (!id)
		id = new Date().getTime().toString() + Math.random().toString(36).substring(10);

	var key = self.db.name + '#' + id;
	var stream = fs.createWriteStream(path.join(self.directory, key + EXTENSION_BINARY));

	stream.write(header, 'binary');
	stream.pipe(stream);
	stream = null;

	if (changes)
		self.db.changelog.insert(changes);

	if (fnCallback)
		fnCallback(null, id, header);

	return id;
};

Binary.prototype.$$insert = function(name, type, buffer, changes) {
	var self = this;
	return function(callback) {
		self.insert(name, type, buf, callback, changes);
	};
};

/*
	Update binary file
	@id {String}
	@name {String} :: filename without path
	@type {String} :: content type
	@buffer {Buffer} :: binary data or base64
	@fnCallback {Function} :: optional, params: @id {String}, @header {Object}
	@changes {String} :: optional, insert description
	return {String} :: return ID - identificator
*/
Binary.prototype.update = function(id, name, type, buffer, fnCallback, changes) {

	if (typeof(buffer) === STRING)
		buffer = new Buffer(buffer, 'base64');

	if (buffer.resume)
		return this.insert_stream(id, name, type, buffer, callback, changes);

	if (typeof(fnCallback) === STRING) {
		changes = fnCallback;
		fnCallback = null;
	}

	var self = this;
	var size = buffer.length;
	var dimension = { width: 0, height: 0 };
	var key = id;

	self.check();

	if (key.indexOf('#') === -1)
		key = self.db.name + '#' + key;

	if (name.indexOf('.gif') !== -1)
		dimension = dimensionGIF(buffer);
	else if (name.indexOf('.png') !== -1)
		dimension = dimensionPNG(buffer);
	else if (name.indexOf('.jpg') !== -1)
		dimension = dimensionJPG(buffer);

	var header = new Buffer(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify({ name: name, size: size, type: type, width: dimension.width, height: dimension.height }));

	var stream = fs.createWriteStream(path.join(self.directory, key + EXTENSION_BINARY));

	stream.write(header, 'binary');
	stream.end(buffer);
	stream = null;

	if (changes)
		self.db.changelog.insert(changes);

	if (fnCallback)
		fnCallback(null, id, header);

	return id;
};

Binary.prototype.$$update = function(id, name, type, buffer, changes) {
	var self = this;
	return function(callback) {
		self.update(id, name, type, update, callback, changes);
	};
};

/*
	Read binary file
	@id {String} :: identificator
	@callback {Function} :: params: @err {Error}, @readStream {Stream}, @header {Object} / header.name {String}, header.size {Number}, header.type {String}
	return {Database}
*/
Binary.prototype.read = function(id, callback) {

	var self = this;

	self.check();

	if (id.indexOf('#') === -1)
		id = self.db.name + '#' + id;

	var filename = path.join(self.directory, id + EXTENSION_BINARY);
	var stream = fs.createReadStream(filename, { start: 0, end: BINARY_HEADER_LENGTH - 1, encoding: 'binary' });

	stream.on('error', function(err) {
		callback(err, null, null);
	});

	stream.on('data', function(buffer) {
		var json = new Buffer(buffer, 'binary').toString('utf8').replace(/^[\s]+|[\s]+$/g, '');
		stream = fs.createReadStream(filename, { start: BINARY_HEADER_LENGTH });
		callback(null, stream, JSON.parse(json));
	});

	return self.db;
};

Binary.prototype.$$read = function(id) {
	var self = this;
	return function(callback) {
		self.read(id, callback);
	};
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
	var key = id;

	self.check();

	if (key.indexOf('#') === -1)
		key = self.db.name + '#' + key;

	var filename = path.join(self.directory, key + EXTENSION_BINARY);

	if (typeof(fnCallback) === STRING) {
		changes = fnCallback;
		fnCallback = null;
	}

	fs.exists(filename, function(exists) {

		if (changes)
			self.db.changelog.insert(changes);

		if (!exists) {

			if (fnCallback)
				fnCallback(null, false);

			return;
		}

		fs.unlink(filename, function(err) {
			if (fnCallback)
				fnCallback(err, true);
		});
	});

	return self.db;
};

Binary.prototype.$$remove = function(id, changes) {
	var self = this;
	return function(callback) {
		self.remove(id, callback, changes);
	};
};

/**
 * Check a directory existence
 * @return {Binary}
 */
Binary.prototype.check = function() {

	var self = this;

	if (self.exists)
		return self;

	self.exists = true;

	if (fs.existsSync(self.directory))
		return self;

	fs.mkdirSync(self.directory);
	return self;
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

	if (description === undefined)
		return self.db;

	if (!(description instanceof Array))
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
			fnCallback(null, []);
			return;
		}

		fs.readFile(self.filename, function(err, data) {

			if (err) {
				fnCallback(err, []);
				return;
			}

			var lines = data.toString('utf8').split('\n');

			if (lines[lines.length - 1] === '')
				lines.pop();

			fnCallback(null, lines);
		});
	});

	return self.db;
};

Changelog.prototype.$$read = function() {
	var self = this;
	return function(callback) {
		self.read(callback);
	}
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

			if (fnCallback)
				fnCallback(false);

			return;
		}

		fs.unlink(self.filename, function(err, data) {
			if (err) {
				if (fnCallback)
					fnCallback(err, false);
				return;
			}

			if (fnCallback)
				fnCallback(null, true);
		});

	});
	return self.db;
};

Changelog.prototype.$$clear = function() {
	var self = this;
	return function(callback) {
		self.clear(callback);
	}
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
			data = data.replace(/\s+$/g, '');
			if (data[data.length - 1] !== NEWLINE)
				data += NEWLINE;
			fnBuffer(data);
			next(true);
			return;
		}

		try {
			cancel = !fnBuffer(data);
		} catch (err) {
			cancel = true;
		}

		setImmediate(function() {
			next(cancel, position, size);
		});

	});
};

// ========================================================================
// INTERNAL
// ========================================================================

/*
	Append multiple documents to file
	@filename {String}
	@arr {Array of Object}
	@fnCallback {Function}
*/
function appendFile(filename, arr, fnCallback, db) {

	if (arr.length === 0) {
		fnCallback();
		return;
	}

	var lines = '';

	arr.slice(0, 30).forEach(function(o) {
		lines += JSON.stringify(o) + NEWLINE;
	});

	fs.appendFile(filename, lines, function(err) {

		if (err)
			db.emit('error', err);

		appendFile(filename, arr.slice(30), fnCallback, db);
	});
}

/*
	Eval string and return function
	@fnFilter {String}
	return {Function}
*/
function filterPrepare(fnFilter) {
	if (fnFilter.length === 0)
		return function() { return true; };
	return eval('(function(doc){' + (fnFilter.indexOf('return ') === -1 ? 'return ' : '') + fnFilter + '})');
}

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

	if (json) {
		try
		{
			fnItem(null, JSON.parse(json), json);
		} catch (ex) {
			fnItem(ex, null, json);
		}
	}

	onBuffer(buffer.substring(index + 1), fnItem, fnBuffer);
}

/*
	Create default object for updating database (internal function)
	@fnUpdate {Function}
	@fnCallback {Function}
	@type {String}
*/
function updatePrepare(fnUpdate, fnCallback, changes, type) {

	if (typeof(fnUpdate) === STRING)
		fnUpdate = filterPrepare(fnUpdate);

	return { filter: fnUpdate, callback: fnCallback, count: 0, type: type, changes: changes };
}

// INTERNAL

var sof = {
	0xc0: true,
	0xc1: true,
	0xc2: true,
	0xc3: true,
	0xc5: true,
	0xc6: true,
	0xc7: true,
	0xc9: true,
	0xca: true,
	0xcb: true,
	0xcd: true,
	0xce: true,
	0xcf: true
};

function u16(buf, o) {
	return buf[o] << 8 | buf[o + 1];
}

function u32(buf, o) {
	return buf[o] << 24 | buf[o + 1] << 16 | buf[o + 2] << 8 | buf[o + 3];
}

function dimensionGIF(buffer) {
	return { width: buffer[6], height: buffer[8] };
};

// MIT
// Written by TJ Holowaychuk
// visionmedia
function dimensionJPG(buffer) {

	var len = buffer.length;
	var o = 0;

	var jpeg = 0xff == buffer[0] && 0xd8 == buffer[1];

	if (!jpeg)
		return;

	o += 2;

	while (o < len) {
		while (0xff != buffer[o]) o++;
		while (0xff == buffer[o]) o++;

		if (!sof[buffer[o]]) {
			o += u16(buffer, ++o);
			continue;
		}

		var w = u16(buffer, o + 6);
		var h = u16(buffer, o + 4);

		return { width: w, height: h };
	}
};

// MIT
// Written by TJ Holowaychuk
// visionmedia
function dimensionPNG(buffer) {
	return { width: u32(buffer, 16), height: u32(buffer, 16 + 4) };
};

exports.database = Database;
exports.load = exports.open = exports.nosql = exports.init = function(filename, directory, changes) {
	return new Database(filename, directory, changes);
};