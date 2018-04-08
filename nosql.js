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
 * @module NoSQL
 * @version 3.0.0
 */

'use strict';

const Fs = require('fs');
const Path = require('path');
const Zlib = require('zlib');

if (!global.framework_utils)
	global.framework_utils = require('./utils');

if (!global.framework_image)
	global.framework_image = require('./image');

if (!global.framework_nosql)
	global.framework_nosql = exports;

if (!global.framework_builders)
	global.framework_builders = require('./builders');

const EXTENSION = '.nosql';
const EXTENSION_BINARY = '.nosql-binary';
const EXTENSION_TMP = '.nosql-tmp';
const EXTENSION_LOG = '.nosql-log';
const EXTENSION_MAPREDUCE = '.nosql-mapreduce';
const EXTENSION_BACKUP = '.nosql-backup';
const EXTENSION_META = '.meta';
const EXTENSION_COUNTER = '-counter2';
const BINARY_HEADER_LENGTH = 2000;
const NEWLINE = '\n';
const EMPTYARRAY = [];
const REG_CLEAN = /^[\s]+|[\s]+$/g;
const INMEMORY = {};
const FLAGS_READ = ['get'];
const COUNTER_MMA = [0, 0];
const REGNUMBER = /^\d+$/;
const REGINDEXCHAR = /[a-z]{1,2}/;

const COMPARER = global.Intl ? global.Intl.Collator().compare : function(a, b) {
	return a.removeDiacritics().localeCompare(b.removeDiacritics());
};

const NEWLINEBUF = framework_utils.createBuffer('\n', 'utf8');
const CACHE = {};

var JSONBUFFER = process.argv.findIndex(n => n.endsWith('nosqlworker.js')) === -1 ? 20 : 40;
var FORK;
var FORKCALLBACKS;

Object.freeze(EMPTYARRAY);

exports.kill = function(signal) {
	FORK && TRY(() => FORK && FORK.kill && FORK.kill(signal || 'SIGTERM'));
};

exports.pid = function() {
	return FORK ? FORK.pid : 0;
};

exports.worker = function() {

	if (FORK)
		return;

	// Clears unhandled callbacks
	ON('service', function() {

		var keys = Object.keys(FORKCALLBACKS);
		if (!keys.length)
			return;

		var time = Date.now();

		for (var i = 0, length = keys.length; i < length; i++) {
			var key = keys[i];
			var item = FORKCALLBACKS[key];
			if (item && item.time) {
				var diff = time - item.time;
				if (diff >= 60000) {

					delete FORKCALLBACKS[key];
					var err = new Error('NoSQL worker timeout.');
					switch (item.type) {
						case 'find':
							item.builder && item.builder.$callback2(err, EMPTYARRAY, 0, EMPTYOBJECT);
							break;
						case 'count':
							item.builder && item.builder.$callback2(err, EMPTYOBJECT, 0, EMPTYOBJECT);
							break;
						case 'insert':
						case 'update':
						case 'remove':
							item.builder && item.builder.$callback(err, EMPTYOBJECT, EMPTYOBJECT);
							break;
						default:
							item.callback && item.callback(err, EMPTYOBJECT, EMPTYOBJECT);
							break;
					}
				}
			}
		}
	});

	FORKCALLBACKS = {};
	FORK = require('child_process').fork(module.filename.replace(/\.js$/, '') + 'worker.js', [], { cwd: F.directory });

	FORK.send({ TYPE: 'init', directory: F.path.root() });
	FORK.on('message', function(msg) {
		switch (msg.TYPE) {
			case 'find':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.builder.$callback2(msg.err, msg.response, msg.count, msg.repository);
				break;
			case 'count':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.builder.$callback2(msg.err, msg.response, msg.count, msg.repository);
				break;
			case 'insert':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.builder.$callback && obj.builder.$callback(msg.err, msg.response, msg.repository);
				break;
			case 'update':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.builder.$callback(msg.err, msg.response, msg.repository);
				break;
			case 'remove':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.builder.$callback(msg.err, msg.response, msg.repository);
				break;
			case 'backup':
			case 'restore':
			case 'counter.read':
			case 'counter.stats':
			case 'counter.clear':
			case 'storage.stats':
			case 'storage.clear':
			case 'indexes.clear':
			case 'indexes.reindex':
			case 'indexes.get':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.callback && obj.callback(msg.err, msg.response);
				break;
			case 'storage.scan':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.callback && obj.callback(msg.err, msg.response, msg.repository);
				break;
		}
		delete FORKCALLBACKS[msg.id];
	});

	var CMD = {};

	function send(instance, type) {
		var obj = {};
		obj.type = type;
		obj.name = instance.name;
		obj.time = Date.now();
		if (arguments.length > 2) {
			obj.arg = [];
			for (var i = 2; i < arguments.length; i++)
				obj.arg.push(arguments[i]);
		}
		setImmediate(send2, obj);
		return obj;
	}

	function notify(instance, type) {
		var obj = {};
		obj.type = type;
		obj.name = instance.name;
		obj.time = Date.now();
		if (arguments.length > 2) {
			obj.arg = [];
			for (var i = 2; i < arguments.length; i++)
				obj.arg.push(arguments[i]);
		}
		setImmediate(send2, obj, false);
		return obj;
	}

	function send2(obj, callback) {
		CMD.TYPE = obj.type;
		CMD.arg = obj.arg;
		CMD.data = obj.builder ? obj.builder.stringify() : null;
		CMD.name = obj.name;
		if (callback !== false) {
			CMD.id = Math.random().toString(32).substring(2);
			FORKCALLBACKS[CMD.id] = obj;
		}
		FORK.send(CMD);
	}

	var DP = Database.prototype;
	var CP = Counter.prototype;

	DP.once = DP.on = DP.emit = DP.removeListener = DP.removeAllListeners = CP.on = CP.once = CP.emit = CP.removeListener = CP.removeAllListeners = function() {
		console.log('ERROR --> NoSQL events are not supported in fork mode.');
	};

	Database.prototype.find = function(view) {
		return send(this, 'find', view).builder = new DatabaseBuilder(this);
	};

	Database.prototype.top = function(max, view) {
		var builder = new DatabaseBuilder(this);
		builder.take(max);
		return send(this, 'find', view).builder = builder;
	};

	Database.prototype.one = function(view) {
		var builder = new DatabaseBuilder(this);
		builder.first();
		return send(this, 'one', view).builder = builder;
	};

	Database.prototype.insert = function(doc, unique) {

		var self = this;
		var builder;

		if (unique) {
			builder = self.one();

			var callback;

			builder.callback(function(err, d) {
				if (d)
					callback && callback(null, 0);
				else
					self.insert(doc).callback(callback);
			});

			builder.callback = function(fn) {
				callback = fn;
				return builder;
			};

			return builder;
		}

		return send(self, 'insert', framework_builders.isSchema(doc) ? doc.$clean() : doc).builder = new DatabaseBuilder2(self);
	};

	Database.prototype.count = function(view) {
		var builder = new DatabaseBuilder(this);
		return send(this, 'count', view).builder = builder;
	};

	Database.prototype.view = function(name) {
		var builder = new DatabaseBuilder(this);
		builder.id('$view_' + name);
		return send(this, 'view', name).builder = builder;
	};

	Database.prototype.update = function(doc, insert) {
		return send(this, 'update', framework_builders.isSchema(doc) ? doc.$clean() : doc, insert).builder = new DatabaseBuilder(this);
	};

	Database.prototype.modify = function(doc, insert) {
		return send(this, 'modify', framework_builders.isSchema(doc) ? doc.$clean() : doc, insert).builder = new DatabaseBuilder(this);
	};

	Database.prototype.restore = function(filename, callback) {
		var obj = send(this, 'restore', filename);
		obj.callback = callback;
		return this;
	};

	Database.prototype.backup = function(filename, callback) {
		var obj = send(this, 'backup', filename);
		obj.callback = callback;
		return this;
	};

	Database.prototype.refresh = function() {
		notify(this, 'refresh');
		return this;
	};

	Database.prototype.drop = function() {
		notify(this, 'drop');
		return this;
	};

	Database.prototype.clear = Database.prototype.remove = function(filename) {
		return send(this, 'remove', filename).builder = new DatabaseBuilder(this);
	};

	Counter.prototype.min = function(id, count) {
		notify(this.db, 'counter.min', id, count);
		return this;
	};

	Counter.prototype.max = function(id, count) {
		notify(this.db, 'counter.max', id, count);
		return this;
	};

	Counter.prototype.sum = Counter.prototype.inc = Counter.prototype.hit = function(id, count) {
		notify(this.db, 'counter.hit', id, count);
		return this;
	};

	Counter.prototype.remove = function(id) {
		notify(this.db, 'counter.remove', id);
		return this;
	};

	Counter.prototype.read = function(options, callback) {
		send(this.db, 'counter.read', options).callback = callback;
		return this;
	};

	Counter.prototype.stats = Counter.prototype.stats_sum = function(top, year, month, day, type, callback) {

		if (typeof(day) == 'function') {
			callback = day;
			day = null;
		} else if (typeof(month) == 'function') {
			callback = month;
			month = null;
		} else if (typeof(year) === 'function') {
			callback = year;
			year = month = null;
		}

		send(this.db, 'counter.stats', top, year, month, day, type).callback = callback;
		return this;
	};

	Counter.prototype.clear = function(callback) {
		send(this.db, 'counter.clear').callback = callback;
		return this;
	};

	Storage.prototype.insert = function(doc) {
		notify(this.db, 'storage.insert', doc);
		return this;
	};

	Storage.prototype.scan = function(beg, end, mapreduce, callback) {

		if (typeof(beg) === 'function') {
			mapreduce = beg;
			callback = end;
			beg = null;
			end = null;
		} else if (typeof(end) === 'function') {
			callback = mapreduce;
			mapreduce = end;
			end = null;
		}

		send(this.db, 'storage.scan', beg, end, mapreduce.toString()).callback = callback;
		return this;
	};

	Storage.prototype.mapreduce = function(name, fn) {
		send(this.db, 'storage.mapreduce', name, fn);
		return this;
	};

	Storage.prototype.stats = function(name, callback) {

		if (typeof(name) === 'function') {
			callback = name;
			name = undefined;
		}

		send(this.db, 'storage.stats', name).callback = callback;
		return this;
	};

	Storage.prototype.clear = function(beg, end, callback) {

		if (typeof(beg) === 'function') {
			callback = end;
			beg = null;
			end = null;
		} else if (typeof(end) === 'function') {
			callback = end;
			end = null;
		}

		send(this.db, 'storage.clear', beg, end).callback = callback;
		return this;
	};

	Indexes.prototype.create = function(name, properties, type) {
		notify(this.db, 'indexes.create', name, properties, type);
		return this;
	};

	Indexes.prototype.get = Indexes.prototype.read = function(name, value, callback) {
		send(this.db, 'indexes.get', name, value).callback = callback;
		return this;
	};

	Indexes.prototype.find = function(name, value) {
		return send(this.db, 'indexes.find', name, value).builder = new DatabaseBuilder(this.db);
	};

	Indexes.prototype.clear = function(callback) {
		send(this.db, 'indexes.clear').callback = callback;
		return this;
	};

	Indexes.prototype.reindex = function(callback) {
		send(this.db, 'indexes.reindex').callback = callback;
		return this;
	};

};

function Database(name, filename, readonly) {
	var self = this;
	var http = filename.substring(0, 6);
	self.readonly = http === 'http:/' || http === 'https:';
	self.filename = self.readonly ? filename.format('') : filename + EXTENSION;

	if (!readonly) {
		self.filenameCounter = self.readonly ? filename.format('counter', '-') : filename + EXTENSION + EXTENSION_COUNTER;
		self.filenameLog = self.readonly || readonly === true ? '' : filename + EXTENSION_LOG;
		self.filenameBackup = self.readonly || readonly === true ? '' : filename + EXTENSION_BACKUP;
		self.filenameStorage = self.readonly || readonly === true ? '' : filename + '-storage/{0}' + EXTENSION;
		self.filenameIndexes = self.readonly || readonly === true ? '' : filename + '-indexes/{0}' + EXTENSION;
		self.filenameMeta = filename + EXTENSION_META;
		self.filenameBackup2 = framework_utils.join(self.directory, name + '_backup' + EXTENSION);
		self.inmemory = {};
		self.inmemorylastusage;
		// self.metadata;
		self.$meta();
	}

	self.filenameTemp = filename + EXTENSION_TMP;
	self.directory = Path.dirname(filename);
	self.name = name;
	self.pending_update = [];
	self.pending_append = [];
	self.pending_reader = [];
	self.pending_streamer = [];
	self.pending_remove = [];
	self.pending_reader_view = readonly ? EMPTYARRAY : [];
	self.views = {};
	self.step = 0;
	self.pending_drops = false;
	self.pending_views = false;
	self.binary = self.readonly || readonly === true ? null : new Binary(self, self.directory + '/' + self.name + '-binary/');
	self.storage = self.readonly || readonly === true ? null : new Storage(self, self.directory + '/' + self.name + '-storage/');
	self.indexes = self.readonly || readonly === true ? null : new Indexes(self, self.directory + '/' + self.name + '-indexes/');
	self.counter = readonly === true ? null : new Counter(self);

	self.$timeoutmeta;
	self.$events = {};
	self.$free = true;
	self.renaming = false;
}

Database.prototype.emit = function(name, a, b, c, d, e, f, g) {
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

Database.prototype.on = function(name, fn) {

	if (!fn.$once)
		this.$free = false;

	if (this.$events[name])
		this.$events[name].push(fn);
	else
		this.$events[name] = [fn];
	return this;
};

Database.prototype.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

Database.prototype.removeListener = function(name, fn) {
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

Database.prototype.removeAllListeners = function(name) {
	if (name === true)
		this.$events = EMPTYOBJECT;
	else if (name)
		this.$events[name] = undefined;
	else
		this.$events[name] = {};
	return this;
};

exports.Database = Database;
exports.DatabaseBuilder = DatabaseBuilder;
exports.DatabaseBuilder2 = DatabaseBuilder2;
exports.DatabaseCounter = Counter;
exports.DatabaseBinary = Binary;

exports.load = function(name, filename) {
	return new Database(name, filename);
};

exports.memory = exports.inmemory = function(name, view) {
	if (view)
		name += '#' + view;
	return INMEMORY[name] = true;
};

Database.prototype.get = function(name) {
	return this.meta(name);
};

Database.prototype.set = function(name, value) {
	return this.meta(name, value);
};

Database.prototype.meta = function(name, value) {
	var self = this;
	if (value === undefined)
		return self.metadata ? self.metadata[name] : undefined;
	if (!self.metadata)
		self.metadata = {};
	self.metadata[name] = value;
	clearTimeout(self.timeoutmeta);
	self.timeoutmeta = setTimeout(() => self.$meta(true), 500);
	return self;
};

Database.prototype.backups = function(filter, callback) {

	if (callback === undefined) {
		callback = filter;
		filter = null;
	}

	var self = this;
	var stream = Fs.createReadStream(self.filenameBackup);
	var output = [];

	stream.on('data', U.streamer(NEWLINEBUF, function(item, index) {
		var end = item.indexOf('|', item.indexOf('|') + 2);
		var meta = item.substring(0, end);
		var arr = meta.split('|');
		var dv = arr[0].trim().replace(' ', 'T') + ':00.000Z';
		var obj = { id: index + 1, date: dv.parseDate(), user: arr[1].trim(), data: item.substring(end + 1).trim().parseJSON(true) };
		if (!filter || filter(obj))
			output.push(obj);
	}), stream);

	CLEANUP(stream, () => callback(null, output));

	return self;
};

function next_operation(self, type) {
	self.next(type);
}

Database.prototype.insert = function(doc, unique) {

	var self = this;
	var builder;

	self.readonly && self.throwReadonly();

	if (unique) {
		builder = self.one();
		var callback;

		builder.callback(function(err, d) {
			if (d)
				callback && callback(null, 0);
			else
				self.insert(doc).callback(callback);
		});

		builder.callback = function(fn) {
			callback = fn;
			return builder;
		};

		return builder;
	}

	builder = new DatabaseBuilder2(self);
	var json = framework_builders.isSchema(doc) ? doc.$clean() : doc;
	self.pending_append.push({ doc: JSON.stringify(json), raw: doc, builder: builder });
	setImmediate(next_operation, self, 1);
	self.$events.insert && self.emit('insert', json);
	return builder;
};

Database.prototype.upsert = function(doc) {
	return this.insert(doc, true);
};

Database.prototype.update = function(doc, insert) {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	var data = framework_builders.isSchema(doc) ? doc.$clean() : doc;
	self.pending_update.push({ builder: builder, doc: data, count: 0, insert: insert === true ? data : insert });
	setImmediate(next_operation, self, 2);
	return builder;
};

Database.prototype.modify = function(doc, insert) {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	var data = framework_builders.isSchema(doc) ? doc.$clean() : doc;
	var keys = Object.keys(data);

	if (!keys.length)
		return builder;

	self.pending_update.push({ builder: builder, doc: data, count: 0, keys: keys, insert: insert === true ? data : insert });
	setImmediate(next_operation, self, 2);
	return builder;
};

Database.prototype.restore = function(filename, callback) {
	var self = this;
	self.readonly && self.throwReadonly();
	U.wait(() => !self.type, function(err) {

		if (err)
			throw new Error('Database can\'t be restored because it\'s busy.');

		self.type = 9;

		F.restore(filename, F.path.root(), function(err, response) {
			self.type = 0;

			if (!err) {
				self.$meta();
				self.refresh();
				self.storage && self.storage.refresh();
			}

			callback && callback(err, response);
		});

	});
	return self;
};

Database.prototype.backup = function(filename, callback) {

	var self = this;
	self.readonly && self.throwReadonly();

	var list = [];
	var pending = [];

	pending.push(function(next) {
		F.path.exists(self.filename, function(e) {
			e && list.push(Path.join(F.config['directory-databases'], self.name + EXTENSION));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(F.path.databases(self.name + EXTENSION_META), function(e) {
			e && list.push(Path.join(F.config['directory-databases'], self.name + EXTENSION_META));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(self.filenameBackup, function(e) {
			e && list.push(Path.join(F.config['directory-databases'], self.name + EXTENSION_BACKUP));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(self.filenameCounter, function(e) {
			e && list.push(Path.join(F.config['directory-databases'], self.name + EXTENSION + EXTENSION_COUNTER));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(self.filenameLog, function(e) {
			e && list.push(Path.join(F.config['directory-databases'], self.name + EXTENSION_LOG));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(F.path.databases(self.name + '-binary'), function(e, size, file) {
			e && !file && list.push(Path.join(F.config['directory-databases'], self.name + '-binary'));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(F.path.databases(self.name + '-storage'), function(e, size, file) {
			e && !file && list.push(Path.join(F.config['directory-databases'], self.name + '-storage'));
			next();
		});
	});

	pending.push(function(next) {
		var filename = Path.join(F.config['directory-databases'], self.name + EXTENSION_MAPREDUCE);
		F.path.exists(F.path.root(filename), function(e) {
			e && list.push(filename);
			next();
		});
	});

	pending.async(function() {
		if (list.length)
			F.backup(filename, list, callback);
		else
			callback(new Error('No files for backuping.'));
	});

	return self;
};

Database.prototype.backup2 = function(filename, remove) {

	if (typeof(filename) === 'boolean') {
		remove = filename;
		filename = '';
	}

	var self = this;
	self.readonly && self.throwReadonly();

	if (remove)
		return self.remove(filename || '');

	var builder = new DatabaseBuilder2(self);
	var stream = Fs.createReadStream(self.filename);

	stream.pipe(Fs.createWriteStream(filename || self.filenameBackup2));

	stream.on('error', function(err) {
		builder.$options.log && builder.log();
		builder.$callback && builder.$callback(errorhandling(err, builder));
		builder.$callback = null;
	});

	stream.on('end', function() {
		builder.$options.log && builder.log();
		builder.$callback && builder.$callback(errorhandling(null, builder, true), true);
		builder.$callback = null;
	});

	return builder;
};

Database.prototype.drop = function() {
	var self = this;
	self.readonly && self.throwReadonly();
	self.pending_drops = true;
	setImmediate(next_operation, self, 7);
	return self;
};

Database.prototype.free = function(force) {
	var self = this;
	if (!force && !self.$free)
		return self;
	self.counter.removeAllListeners(true);
	self.binary.removeAllListeners(true);
	self.removeAllListeners(true);
	self.indexes = null;
	self.binary = null;
	self.counter = null;
	delete F.databases[self.name];
	return self;
};

Database.prototype.release = function() {
	var self = this;
	self.inmemory = {};
	self.inmemorylastusage = undefined;
	return self;
};

Database.prototype.clear = Database.prototype.remove = function(filename) {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	var backup = filename === undefined ? undefined : filename || self.filenameBackup2;

	if (backup)
		backup = new Backuper(backup);

	self.pending_remove.push({ builder: builder, count: 0, backup: backup });
	setImmediate(next_operation, self, 3);
	return builder;
};

Database.prototype.find = function(view) {
	var self = this;
	var builder = new DatabaseBuilder(self);

	if (view) {
		self.pending_reader_view.push({ builder: builder, count: 0, counter: 0, view: view });
		setImmediate(next_operation, self, 6);
	} else {
		self.pending_reader.push({ builder: builder, count: 0, counter: 0 });
		setImmediate(next_operation, self, 4);
	}

	return builder;
};

Database.prototype.load = function(take, skip, callback) {
	var self = this;

	if (typeof(take) === 'function') {
		callback = take;
		take = 0;
		skip = 0;
	} else if (typeof(skip) === 'function') {
		callback = skip;
		skip = 0;
	}

	self.pending_loader.push({ take: take, skip: skip, callback: callback, counter: 0, count: 0, response: [] });
	setImmediate(next_operation, self, 10);
	return self;
};

Database.prototype.streamer = function(fn, callback) {
	var self = this;
	self.pending_streamer.push({ fn: fn, callback: callback, repository: {} });
	setImmediate(next_operation, self, 10);
	return self;
};

Database.prototype.throwReadonly = function() {
	throw new Error('Database "{0}" is readonly.'.format(this.name));
};

Database.prototype.scalar = function(type, field, view) {
	return this.find(view).scalar(type, field);
};

Database.prototype.count = function(view) {
	var self = this;
	var builder = new DatabaseBuilder(self);

	if (view) {
		self.pending_reader_view.push({ builder: builder, count: 0, view: view, type: 1 });
		setImmediate(next_operation, self, 6);
	} else {
		self.pending_reader.push({ builder: builder, count: 0, type: 1 });
		setImmediate(next_operation, self, 4);
	}

	return builder;
};

Database.prototype.one = function(view) {
	var self = this;
	var builder = new DatabaseBuilder(self);
	builder.first();

	if (view) {
		self.pending_reader_view.push({ builder: builder, count: 0, view: view });
		setImmediate(next_operation, self, 6);
	} else {
		self.pending_reader.push({ builder: builder, count: 0 });
		setImmediate(next_operation, self, 4);
	}

	return builder;
};

Database.prototype.top = function(max, view) {
	var self = this;
	var builder = new DatabaseBuilder(self);
	builder.take(max);

	if (view) {
		self.pending_reader_view.push({ builder: builder, count: 0, counter: 0, view: view });
		setImmediate(next_operation, self, 6);
	} else {
		self.pending_reader.push({ builder: builder, count: 0, counter: 0 });
		setImmediate(next_operation, self, 4);
	}

	return builder;
};

Database.prototype.view = function(name) {
	var builder = new DatabaseBuilder(this);
	this.views[name] = {};
	this.views[name] = builder;
	this.views[name].$filename = this.filename.replace(/\.nosql/, '#' + name + '.nosql');
	builder.id('$view_' + name);
	return builder;
};

Database.prototype.next = function(type) {

	// 9: renaming file (by updating/removing)
	if (type && this.step === 9)
		return;

	if (this.renaming) {
		!type && (this.step = 0);
		return;
	}

	if (this.step < 2) {
		if (this.step !== 2 && this.pending_update.length) {
			if (INMEMORY[this.name])
				this.$update_inmemory();
			else
				this.$update();
			return;
		}

		if (this.step !== 3 && this.pending_remove.length) {
			if (INMEMORY[this.name])
				this.$remove_inmemory();
			else
				this.$remove();
			return;
		}
	}

	if (this.step !== 6 && this.pending_reader_view.length) {
		this.$readerview();
		return;
	}

	if (this.step !== 4 && this.pending_reader.length) {
		this.$reader();
		return;
	}

	if (this.step !== 1 && this.pending_append.length) {
		if (INMEMORY[this.name])
			this.$append_inmemory();
		else
			this.$append();
		return;
	}

	if (this.step !== 7 && this.pending_drops) {
		this.$drop();
		return;
	}

	if (this.step !== 5 && this.pending_views) {
		if (INMEMORY[this.name])
			this.$views_inmemory();
		else
			this.$views();
		return;
	}

	if (this.step !== 10 && this.pending_streamer.length) {
		this.$streamer();
		return;
	}

	if (this.step !== type) {
		this.step = 0;
		setImmediate(next_operation, this, 0);
	}
};

Database.prototype.refresh = function() {
	if (this.views) {
		this.pending_views = true;
		setImmediate(next_operation, this, 5);
	}
	return this;
};

// ======================================================================
// FILE OPERATIONS
// ======================================================================

// InMemory saving
Database.prototype.$save = function(view) {
	var self = this;
	setTimeout2('nosql.' + self.name + '.' + view, function() {
		var data = self.inmemory[view] || EMPTYARRAY;
		var builder = [];
		for (var i = 0, length = data.length; i < length; i++)
			builder.push(JSON.stringify(data[i]));

		var filename = self.filename;
		if (view !== '#')
			filename = filename.replace(/\.nosql/, '#' + view + '.nosql');

		Fs.writeFile(filename, builder.join(NEWLINE) + NEWLINE, F.error());
	}, 50, 100);
	return self;
};

Database.prototype.$inmemory = function(view, callback) {

	var self = this;
	self.readonly && self.throwReadonly();

	// Last usage
	self.inmemorylastusage = global.F ? global.F.datetime : undefined;

	if (self.inmemory[view])
		return callback();

	var filename = self.filename;
	if (view !== '#')
		filename = filename.replace(/\.nosql/, '#' + view + '.nosql');

	self.inmemory[view] = [];

	Fs.readFile(filename, function(err, data) {
		if (err)
			return callback();
		var arr = data.toString('utf8').split('\n');
		for (var i = 0, length = arr.length; i < length; i++) {
			var item = arr[i];
			if (!item)
				continue;
			try {
				item = JSON.parse(item.trim(), jsonparser);
				item && self.inmemory[view].push(item);
			} catch (e) {}
		}

		callback();
	});

	return self;
};

Database.prototype.$meta = function(write) {

	var self = this;

	if (write) {
		self.readonly && self.throwReadonly();
		Fs.writeFile(self.filenameMeta, JSON.stringify(self.metadata), F.error());
		return self;
	}

	if (self.readonly)
		return self;

	try {
		self.metadata = JSON.parse(Fs.readFileSync(self.filenameMeta).toString('utf8'), jsonparser);
	} catch (err) {}

	return self;
};

Database.prototype.$append = function() {
	var self = this;
	self.step = 1;

	if (!self.pending_append.length) {
		self.next(0);
		return;
	}

	self.pending_append.splice(0).limit(JSONBUFFER, function(items, next) {

		var json = '';
		for (var i = 0, length = items.length; i < length; i++) {
			json += items[i].doc + NEWLINE;

			if (self.indexes && self.indexes.indexes.length)
				self.indexes.insert(items[i].raw);
		}

		Fs.appendFile(self.filename, json, function(err) {

			err && F.error(err, 'NoSQL insert: ' + self.name);

			for (var i = 0, length = items.length; i < length; i++) {
				items[i].builder.$options.log && items[i].builder.log();
				var callback = items[i].builder.$callback;
				callback && callback(err, 1);
			}

			next();
		});

	}, () => setImmediate(next_append, self));
};

function next_append(self) {
	self.next(0);
	setImmediate(views_refresh, self);
}

Database.prototype.$append_inmemory = function() {
	var self = this;
	self.step = 1;

	if (!self.pending_append.length) {
		self.next(0);
		return self;
	}

	var items = self.pending_append.splice(0);

	return self.$inmemory('#', function() {

		for (var i = 0, length = items.length; i < length; i++) {
			self.inmemory['#'].push(JSON.parse(items[i].doc, jsonparser));
			items[i].builder.$options.log && items[i].builder.log();
			var callback = items[i].builder.$callback;
			callback && callback(null, 1);
		}

		self.$save('#');
		setImmediate(next_append, self);
	});
};

Database.prototype.$update = function() {

	var self = this;
	self.step = 2;

	if (!self.pending_update.length) {
		self.next(0);
		return self;
	}

	var reader = Fs.createReadStream(self.filename);
	var writer = Fs.createWriteStream(self.filenameTemp);

	var filter = self.pending_update.splice(0);
	var length = filter.length;
	var change = false;

	for (var i = 0; i < length; i++) {
		var fil = filter[i];
		fil.compare = fil.builder.compile();
		fil.filter = { repository: fil.builder.$repository, options: fil.builder.$options, arg: fil.builder.$params, fn: fil.builder.$functions };
	}

	var buf = '[';
	var bufcount = 0;
	var indexer = 0;

	var processing = function(docs) {

		for (var a = 0; a < docs.length; a++) {

			indexer++;

			var doc = docs[a];
			var is = false;
			var copy = self.indexes && self.indexes.indexes.length ? CLONE(doc) : null;

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				var builder = item.builder;

				item.filter.index = indexer;
				var output = item.compare(doc, item.filter, indexer);

				if (output) {
					builder.$options.backup && builder.$backupdoc(output);
					if (item.keys) {
						for (var j = 0, jl = item.keys.length; j < jl; j++) {
							var val = item.doc[item.keys[j]];
							if (val !== undefined) {
								if (typeof(val) === 'function')
									output[item.keys[j]] = val(output[item.keys[j]], output);
								else
									output[item.keys[j]] = val;
							} else
								output[item.keys[j]] = undefined;
						}
					} else
						output = typeof(item.doc) === 'function' ? item.doc(output) : item.doc;

					var e = item.keys ? 'modify' : 'update';
					self.$events[e] && self.emit(e, output);
					item.count++;
					if (!change)
						change = true;
					doc = output;
					is = true;
				}
			}

			if (is && self.indexes && self.indexes.indexes.length)
				self.indexes.update(doc, copy);

			writer.write(JSON.stringify(doc) + NEWLINE);
		}
	};

	reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value) {

		if (value[0] !== '{')
			return;

		buf += (bufcount ? ',' : '') + value.substring(0, value.length - 1);
		bufcount++;

		if (bufcount % JSONBUFFER === 0) {
			bufcount = 0;
			processing(JSON.parse(buf + ']', jsonparser));
			buf = '[';
		}

	}));

	var finish = function() {

		// No change
		if (!change) {
			Fs.unlink(self.filenameTemp, function() {

				for (var i = 0; i < length; i++) {
					var item = filter[i];
					if (item.insert && !item.count) {
						item.builder.$insertcallback && item.builder.$insertcallback(item.insert);
						self.insert(item.insert).$callback = item.builder.$callback;
					} else {
						item.builder.$options.log && item.builder.log();
						item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count, item.filter.repository);
					}
				}

				self.next(0);
			});
			return;
		}

		self.renaming = true;

		// Maybe is reading?
		if (self.step && self.step !== 9 && self.step !== 2) {
			self.next(0);
			return setTimeout(finish, 100);
		}

		self.step = 9;

		Fs.rename(self.filenameTemp, self.filename, function(err) {

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				if (item.insert && !item.count) {
					item.builder.$insertcallback && item.builder.$insertcallback(item.insert);
					self.insert(item.insert).$callback = item.builder.$callback;
				} else {
					item.builder.$options.log && item.builder.log();
					item.builder.$callback && item.builder.$callback(errorhandling(err, item.builder, item.count), item.count, item.filter.repository);
				}
			}

			setImmediate(function() {
				self.renaming = false;
				self.next(0);
				change && setImmediate(views_refresh, self);
			});
		});
	};

	CLEANUP(reader, function() {

		if (bufcount) {
			bufcount = 0;
			processing(JSON.parse(buf + ']', jsonparser));
			buf = null;
		}

		writer.end();
	});

	CLEANUP(writer, finish);

	return self;
};

function views_refresh(self) {
	self.refresh();
}

Database.prototype.$update_inmemory = function() {

	var self = this;
	self.step = 2;

	if (!self.pending_update.length) {
		self.next(0);
		return self;
	}

	var filter = self.pending_update.splice(0);
	var length = filter.length;
	var change = false;

	for (var i = 0; i < length; i++) {
		var fil = filter[i];
		fil.compare = fil.builder.compile();
		fil.filter = { repository: fil.builder.$repository, options: fil.builder.$options, arg: fil.builder.$params, fn: fil.builder.$functions };
	}

	return self.$inmemory('#', function() {

		var data = self.inmemory['#'];

		for (var a = 0, al = data.length; a < al; a++) {

			var doc = data[a];
			var is = false;

			for (var i = 0; i < length; i++) {

				var item = filter[i];
				var builder = item.builder;
				item.filter.index = j;
				var output = item.compare(doc, item.filter, j);
				if (output) {

					builder.$options.backup && builder.$backupdoc(doc);

					if (item.keys) {
						for (var j = 0, jl = item.keys.length; j < jl; j++) {
							var val = item.doc[item.keys[j]];
							if (val === undefined)
								continue;
							if (typeof(val) === 'function')
								doc[item.keys[j]] = val(doc[item.keys[j]], doc);
							else
								doc[item.keys[j]] = val;
						}
					} else
						doc = typeof(item.doc) === 'function' ? item.doc(doc) : item.doc;

					var e = item.keys ? 'modify' : 'update';
					self.$events[e] && self.emit(e, doc);
					item.count++;
					if (!change)
						change = true;
					is = true;
				}
			}

			if (is && self.indexes && self.indexes.indexes.length)
				self.indexes.update(doc);
		}

		self.$save('#');

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			if (item.insert && !item.count) {
				item.builder.$insertcallback && item.builder.$insertcallback(item.insert);
				self.insert(item.insert).$callback = item.builder.$callback;
			} else {
				var e = item.keys ? 'modify' : 'update';
				item.count && self.$events[e] && self.emit(e, item.doc);
				item.builder.$options.log && item.builder.log();
				item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count, item.filter.repository);
			}
		}

		setImmediate(function() {
			self.next(0);
			change && setImmediate(views_refresh, self);
		});
	});
};

Database.prototype.$reader = function() {

	var self = this;
	self.step = 4;

	if (!self.pending_reader.length) {
		self.next(0);
		return self;
	}

	var list = self.pending_reader.splice(0);
	if (INMEMORY[self.name])
		self.$reader2_inmemory('#', list, () => self.next(0));
	else
		self.$reader2(self.filename, list, () => self.next(0));

	return self;
};

Database.prototype.$readerview = function() {

	var self = this;
	self.step = 6;

	if (!self.pending_reader_view.length) {
		self.next(0);
		return self;
	}

	var group = {};
	var skip = true;

	for (var i = 0, length = self.pending_reader_view.length; i < length; i++) {
		var item = self.pending_reader_view[i];
		var name = INMEMORY[self.name] || INMEMORY[self.name + '#' + item.view] ? item.view : self.views[item.view].$filename;

		skip = false;

		if (group[name])
			group[name].push(item);
		else
			group[name] = [item];
	}

	self.pending_reader_view = [];

	if (skip) {
		self.next(0);
		return self;
	}

	Object.keys(group).wait(function(item, next) {
		if (INMEMORY[self.name] || INMEMORY[self.name + '#' + item])
			self.$reader2_inmemory(item, group[item], next);
		else
			self.$reader2(item, group[item], next);
	}, () => self.next(0), 5);

	return self;
};

Database.prototype.$reader2 = function(filename, items, callback, reader) {

	var self = this;

	if (self.readonly) {
		if (reader === undefined) {
			U.download(filename, FLAGS_READ, function(err, response) {
				err && F.error(err, 'NoSQL database download: ' + self.name);
				self.$reader2(filename, items, callback, err ? null : response);
			});
			return self;
		}
	} else
		reader = Fs.createReadStream(filename);

	var filter = items;
	var length = filter.length;
	var first = true;
	var canceled = false;
	var indexer = 0;

	for (var i = 0; i < length; i++) {
		var fil = filter[i];
		if (!fil.builder.$options.first)
			first = false;
		fil.scalarcount = 0;
		fil.compare = fil.builder.compile();
		fil.filter = { repository: fil.builder.$repository, options: fil.builder.$options, arg: fil.builder.$params, fn: fil.builder.$functions };
	}

	var processing = function(docs) {

		var val;

		for (var j = 0; j < docs.length; j++) {
			var json = docs[j];
			indexer++;
			for (var i = 0; i < length; i++) {
				var item = filter[i];
				var builder = item.builder;
				item.filter.index = indexer;
				var output = item.compare(json, item.filter, indexer);
				if (!output)
					continue;

				item.count++;

				if (!builder.$inlinesort && ((builder.$options.skip && builder.$options.skip >= item.count) || (builder.$options.take && builder.$options.take <= item.counter)))
					continue;

				item.counter++;

				if (item.type)
					continue;

				switch (builder.$options.scalar) {
					case 'count':
						item.scalar = item.scalar ? item.scalar + 1 : 1;
						break;
					case 'sum':
						val = output[builder.$options.scalarfield] || 0;
						item.scalar = item.scalar ? item.scalar + val : val;
						break;
					case 'min':
						val = output[builder.$options.scalarfield] || 0;
						if (val != null) {
							if (item.scalar) {
								if (item.scalar > val)
									item.scalar = val;
							} else
								item.scalar = val;
						}
						break;
					case 'max':
						val = output[builder.$options.scalarfield];
						if (val != null) {
							if (item.scalar) {
								if (item.scalar < val)
									item.scalar = val;
							} else
								item.scalar = val;
						}
						break;
					case 'avg':
						val = output[builder.$options.scalarfield];
						if (val != null) {
							item.scalar = item.scalar ? item.scalar + val : val;
							item.scalarcount++;
						}
						break;
					case 'group':
						!item.scalar && (item.scalar = {});
						val = output[builder.$options.scalarfield];
						if (val != null) {
							if (item.scalar[val])
								item.scalar[val]++;
							else
								item.scalar[val] = 1;
						}
						break;
					default:
						if (builder.$inlinesort)
							nosqlinlinesorter(item, builder, output);
						else if (item.response)
							item.response.push(output);
						else
							item.response = [output];
						break;
				}

				if (first && !canceled) {
					canceled = true;
					return;
				}
			}
		}
	};

	if (first && length > 1)
		first = false;

	var buf = '[';
	var bufcount = 0;

	reader && reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value) {

		if (value[0] !== '{')
			return;

		buf += (bufcount ? ',' : '') + value.substring(0, value.length - 1);
		bufcount++;

		if (bufcount % JSONBUFFER === 0) {
			bufcount = 0;
			processing(JSON.parse(buf + ']', jsonparser));
			buf = '[';
		}

		if (canceled) {
			reader.destroy && reader.destroy();
			return false;
		}

	}));

	var finish = function() {

		bufcount && processing(JSON.parse(buf + ']', jsonparser));

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			var builder = item.builder;
			var output;

			if (builder.$options.scalar || !builder.$options.sort) {

				if (builder.$options.scalar)
					output = builder.$options.scalar === 'avg' ? item.scalar / item.scalarcount : item.scalar;
				else if (builder.$options.first)
					output = item.response ? item.response[0] : undefined;
				else
					output = item.response || EMPTYARRAY;

				builder.$callback2(errorhandling(null, builder, output), item.type === 1 ? item.count : output, item.count);
				continue;
			}

			if (item.count) {
				if (builder.$options.sort.name) {
					if (!builder.$inlinesort || builder.$options.take !== item.response.length)
						item.response.quicksort(builder.$options.sort.name, builder.$options.sort.asc);
				} else if (builder.$options.sort === null)
					item.response.random();
				else
					item.response.sort(builder.$options.sort);

				if (builder.$options.skip && builder.$options.take)
					item.response = item.response.splice(builder.$options.skip, builder.$options.take);
				else if (builder.$options.skip)
					item.response = item.response.splice(builder.$options.skip);
				else if (!builder.$inlinesort && builder.$options.take)
					item.response = item.response.splice(0, builder.$options.take);
			}

			if (builder.$options.first)
				output = item.response ? item.response[0] : undefined;
			else
				output = item.response || EMPTYARRAY;

			builder.$callback2(errorhandling(null, builder, output), item.type === 1 ? item.count : output, item.count);
			builder.done();
		}
		callback();
	};

	if (reader)
		CLEANUP(reader, finish);
	else
		finish();

	return self;
};

Database.prototype.$streamer = function() {

	var self = this;
	self.step = 10;

	if (!self.pending_streamer.length) {
		self.next(0);
		return self;
	}

	var filter = self.pending_streamer.splice(0);
	var reader = Fs.createReadStream(self.filename);
	var length = filter.length;
	var count = 0;

	var processing = function(docs) {
		for (var j = 0; j < docs.length; j++) {
			var json = docs[j];
			count++;
			for (var i = 0; i < length; i++)
				filter[i].fn(json, filter[i].repository, count);
		}
	};

	var buf = '[';
	var bufcount = 0;

	reader && reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value) {

		if (value[0] !== '{')
			return;

		buf += (bufcount ? ',' : '') + value.substring(0, value.length - 1);
		bufcount++;

		if (bufcount % JSONBUFFER === 0) {
			bufcount = 0;
			processing(JSON.parse(buf + ']', jsonparser));
			buf = '[';
		}

	}));

	var finish = function() {
		bufcount && processing(JSON.parse(buf + ']', jsonparser));
		for (var i = 0; i < length; i++)
			filter[i].callback && filter[i].callback(null, filter[i].repository, count);
		self.next(0);
	};

	if (reader)
		CLEANUP(reader, finish);
	else
		finish();

	return self;
};

Database.prototype.$loader2 = function() {

	var self = this;
	self.step = 10;

	if (!self.pending_loader.length) {
		self.next(0);
		return self;
	}

	var filter = self.pending_loader.splice(0);
	var length = filter.length;
	var canceled = false;
	var skip = null;

	for (var i = 0; i < length; i++)
		skip = skip == null ? filter[i].skip : skip > filter[i].skip ? filter[i].skip : skip;

	if (skip) {
		for (var i = 0; i < length; i++)
			filter[i].count = skip - 1;
	}

	var reader = Fs.createReadStream(self.filename);

	var processing = function(docs) {

		for (var j = 0; j < docs.length; j++) {

			var json = docs[j];
			var cancel = length;

			for (var i = 0; i < length; i++) {
				var item = filter[i];

				if (item.take && item.counter >= item.take) {
					cancel--;
					continue;
				}

				item.count++;

				if (item.skip && item.skip > item.count)
					continue;

				item.counter++;
				item.response.push(json);
			}

			if (!cancel) {
				canceled = true;
				return;
			}
		}
	};

	var buf = '[';
	var bufcount = 0;

	reader && reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value) {

		if (value[0] !== '{')
			return;

		var len = value.length - 1;

		if (self.$documentsize == null)
			self.$documentsize = len;
		else if (self.$documentsize > len)
			self.$documentsize = len;

		buf += (bufcount ? ',' : '') + value.substring(0, len);
		bufcount++;

		if (bufcount % JSONBUFFER === 0) {
			bufcount = 0;
			processing(JSON.parse(buf + ']', jsonparser));
			buf = '[';
		}

		if (canceled) {
			reader.destroy && reader.destroy();
			return false;
		}

	}, skip));

	var finish = function() {
		bufcount && processing(JSON.parse(buf + ']', jsonparser));
		for (var i = 0; i < length; i++) {
			var item = filter[i];
			item.callback(null, item.response);
		}
		self.next(0);
	};

	if (reader)
		CLEANUP(reader, finish);
	else
		finish();

	return self;
};

function nosqlinlinesorter(item, builder, doc) {

	if (!item.response) {
		item.response = [doc];
		return;
	}

	var length = item.response.length;
	if (length < builder.$limit) {
		item.response.push(doc);
		length + 1 >= builder.$limit && item.response.quicksort(builder.$options.sort.name, builder.$options.sort.asc);
	} else
		nosqlresort(item.response, builder, doc);
}

function nosqlsortvalue(a, b, sorter) {
	var type = typeof(a);
	if (type === 'number')
		return sorter.asc ? a > b : a < b;
	else if (type === 'string') {
		var c = COMPARER(a, b);
		return sorter.asc ? c === 1 : c === -1;
	} else if (type === 'boolean')
		// return sorter.asc ? a > b : a < b;
		return sorter.asc ? (a && !b) : (!a && b);
	else if (a instanceof Date)
		return sorter.asc ? a > b : a < b;
	return false;
}

function nosqlresort(arr, builder, doc) {
	var b = doc[builder.$options.sort.name];
	var beg = 0;
	var length = arr.length;
	var tmp = length - 1;

	var sort = nosqlsortvalue(arr[tmp][builder.$options.sort.name], b, builder.$options.sort);
	if (!sort)
		return;

	tmp = arr.length / 2 >> 0;
	sort = nosqlsortvalue(arr[tmp][builder.$options.sort.name], b, builder.$options.sort);
	if (!sort)
		beg = tmp + 1;

	for (var i = beg; i < length; i++) {
		var item = arr[i];
		var sort = nosqlsortvalue(item[builder.$options.sort.name], b, builder.$options.sort);
		if (!sort)
			continue;
		for (var j = length - 1; j > i; j--)
			arr[j] = arr[j - 1];
		arr[i] = doc;
		return;
	}
}

Database.prototype.$reader2_inmemory = function(name, items, callback) {

	var self = this;
	var filter = items;
	var length = filter.length;

	for (var i = 0; i < length; i++) {
		var fil = filter[i];
		fil.compare = fil.builder.compile();
		fil.filter = { repository: fil.builder.$repository, options: fil.builder.$options, arg: fil.builder.$params, fn: fil.builder.$functions };
	}

	return self.$inmemory(name, function() {

		var data = self.inmemory[name];
		var val;

		for (var j = 0, jl = data.length; j < jl; j++) {
			var json = data[j];
			for (var i = 0; i < length; i++) {
				var item = filter[i];
				var builder = item.builder;
				item.filter.index = j;
				var output = item.compare(U.clone(json), item.filter, j);
				if (!output)
					continue;

				item.count++;

				if (!builder.$options.sort && ((builder.$options.skip && builder.$options.skip >= item.count) || (builder.$options.take && builder.$options.take <= item.counter)))
					continue;

				item.counter++;

				if (item.type)
					continue;

				switch (builder.$options.scalar) {
					case 'count':
						item.scalar = item.scalar ? item.scalar + 1 : 1;
						break;
					case 'sum':
						val = json[builder.$options.scalarfield] || 0;
						item.scalar = item.scalar ? item.scalar + val : val;
						break;
					case 'min':
						val = json[builder.$options.scalarfield] || 0;
						if (val != null) {
							if (item.scalar) {
								if (item.scalar > val)
									item.scalar = val;
							} else
								item.scalar = val;
						}
						break;
					case 'max':
						val = json[builder.$options.scalarfield];
						if (val != null) {
							if (item.scalar) {
								if (item.scalar < val)
									item.scalar = val;
							} else
								item.scalar = val;
						}
						break;
					case 'avg':
						val = json[builder.$options.scalarfield];
						if (val != null) {
							item.scalar = item.scalar ? item.scalar + val : 0;
							if (item.scalarcount)
								item.scalarcount++;
							else
								item.scalarcount = 1;
						}
						break;
					case 'group':
						!item.scalar && (item.scalar = {});
						val = output[builder.$options.scalarfield];
						if (val != null) {
							if (item.scalar[val])
								item.scalar[val]++;
							else
								item.scalar[val] = 1;
						}
						break;

					default:
						if (item.response)
							item.response.push(output);
						else
							item.response = [output];
						break;
				}
			}
		}

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			var builder = item.builder;
			var output;

			if (builder.$options.scalar || !builder.$options.sort) {

				if (builder.$options.scalar)
					output = builder.$options.scalar === 'avg' ? item.scalar / item.counter : item.scalar;
				else if (builder.$options.first)
					output = item.response ? item.response[0] : undefined;
				else
					output = item.response || EMPTYARRAY;

				builder.$callback2(errorhandling(null, builder, output), item.type === 1 ? item.count : output, item.count);
				continue;
			}

			if (item.count) {
				if (builder.$options.sort.name)
					item.response.quicksort(builder.$options.sort.name, builder.$options.sort.asc);
				else if (builder.$options.sort === EMPTYOBJECT)
					item.response.random();
				else
					item.response.sort(builder.$options.sort);

				if (builder.$options.skip && builder.$options.take)
					item.response = item.response.splice(builder.$options.skip, builder.$options.take);
				else if (builder.$options.skip)
					item.response = item.response.splice(builder.$options.skip);
				else if (builder.$options.take)
					item.response = item.response.splice(0, builder.$options.take);
			}

			if (builder.$options.first)
				output = item.response ? item.response[0] : undefined;
			else
				output = item.response || EMPTYARRAY;

			builder.$callback2(errorhandling(null, builder, output), item.type === 1 ? item.count : output, item.count);
			builder.done();
		}

		callback();
	});
};

Database.prototype.$views = function() {

	var self = this;
	self.step = 5;

	if (!self.pending_views) {
		self.next(0);
		return;
	}

	self.pending_views = false;

	var views = Object.keys(self.views);
	var length = views.length;

	if (!length) {
		self.next(0);
		return self;
	}

	var response = [];

	for (var i = 0; i < length; i++) {
		var builder = self.views[views[i]];
		response.push({ response: [], name: views[i], compare: builder.compile(), filter: { repository: builder.$repository, options: builder.$options, arg: builder.$params, fn: builder.$functions }, builder: builder, count: 0, counter: 0, repository: {} });
	}

	var reader = Fs.createReadStream(self.filename);

	var buf = '[';
	var bufcount = 0;
	var indexer = 0;

	var processing = function(docs) {
		for (var i = 0; i < docs.length; i++) {
			var json = docs[i];
			for (var j = 0; j < length; j++) {
				var item = self.views[views[j]];
				var res = response[j];
				res.filter.index = indexer;
				var output = res.compare(json, res.filter, indexer);
				if (!output)
					continue;
				res.count++;
				if (!res.filter.options.sort && ((res.filter.options.skip && res.filter.options.skip >= res.count) || (res.filter.options.take && res.filter.options.take <= res.counter)))
					continue;
				res.counter++;
				!item.type && res.response.push(output);
			}
		}
	};

	reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value) {

		indexer++;

		if (value[0] !== '{')
			return;

		buf += (bufcount ? ',' : '') + value.substring(0, value.length - 1);
		bufcount++;

		if (bufcount % JSONBUFFER === 0) {
			bufcount = 0;
			processing(JSON.parse(buf + ']', jsonparser));
			buf = '[';
		}

	}));

	CLEANUP(reader, function() {

		if (bufcount) {
			processing(JSON.parse(buf + ']', jsonparser));
			bufcount = 0;
			buf = null;
		}

		response.wait(function(item, next) {

			var builder = item.builder;

			if (builder.$options.sort) {
				if (builder.$options.sort.name)
					item.response.quicksort(builder.$options.sort.name, builder.$options.sort.asc);
				else if (builder.$options.sort === EMPTYOBJECT)
					item.response.random();
				else
					item.response.sort(builder.$options.sort);
				if (builder.$options.skip && builder.$options.take)
					item.response = item.response.splice(builder.$options.skip, builder.$options.take);
				else if (builder.$options.skip)
					item.response = item.response.splice(builder.$options.skip);
				else if (builder.$options.take)
					item.response = item.response.splice(0, builder.$options.take);
			}

			var filename = builder.$filename;
			Fs.unlink(filename, function() {
				item.response.limit(20, function(items, next) {
					var builder = [];
					for (var i = 0, length = items.length; i < length; i++)
						builder.push(JSON.stringify(items[i]));
					Fs.appendFile(filename, builder.join(NEWLINE) + NEWLINE, next);
				}, function() {
					// clears in-memory
					self.inmemory[item.name] = undefined;
					next();
				});
			});
		}, () => self.next(0), 5);
	});
};

Database.prototype.$views_inmemory = function() {

	var self = this;
	self.step = 5;

	if (!self.pending_views) {
		self.next(0);
		return self;
	}

	self.pending_views = false;

	var views = Object.keys(self.views);
	var length = views.length;

	if (!length) {
		self.next(0);
		return self;
	}

	var response = [];

	for (var i = 0; i < length; i++) {
		var builder = self.views[views[i]];
		response.push({ response: [], name: views[i], compare: builder.compile(), filter: { repository: builder.$repository, options: builder.$options, arg: builder.$params, fn: builder.$functions }, builder: builder, count: 0, counter: 0, repository: {} });
	}

	return self.$inmemory('#', function() {
		var data = self.inmemory['#'];

		for (var j = 0, jl = data.length; j < jl; j++) {
			var json = data[j];
			for (var i = 0; i < length; i++) {
				var item = self.views[views[i]];
				var res = response[i];
				res.filter.index = j;
				var output = res.compare(json, res.filter, j);
				if (!output)
					continue;
				res.count++;
				if (!item.$options.sort && ((item.$options.skip && item.$options.skip >= res.count) || (item.$options.take && item.$options.take <= res.counter)))
					continue;
				res.counter++;
				!item.type && res.response.push(output);
			}
		}

		for (var j = 0, jl = response.length; j < jl; j++) {

			var item = response[j];
			var builder = item.builder;

			if (builder.$options.sort) {
				if (builder.$options.sort.name)
					item.response.quicksort(builder.$options.sort.name, builder.$options.sort.asc);
				else if (builder.$options.sort === EMPTYOBJECT)
					item.response.random();
				else
					item.response.sort(builder.$options.sort);
				if (builder.$options.skip && builder.$options.take)
					item.response = item.response.splice(builder.$options.skip, builder.$options.take);
				else if (builder.$options.skip)
					item.response = item.response.splice(builder.$options.skip);
				else if (builder.$options.take)
					item.response = item.response.splice(0, builder.$options.take);
			}

			self.inmemory[item.name] = item.response;
			self.$save(item.name);
		}

		self.next(0);
	});
};

Database.prototype.$remove = function() {

	var self = this;
	self.step = 3;

	if (!self.pending_remove.length) {
		self.next(0);
		return;
	}

	var reader = Fs.createReadStream(self.filename);
	var writer = Fs.createWriteStream(self.filenameTemp);

	var filter = self.pending_remove.splice(0);
	var length = filter.length;
	var change = false;
	var buf = [];
	var bufcount = 0;
	var indexer = 0;

	for (var i = 0; i < length; i++) {
		var fil = filter[i];
		fil.compare = fil.builder.compile();
		fil.filter = { repository: fil.builder.$repository, options: fil.builder.$options, arg: fil.builder.$params, fn: fil.builder.$functions };
	}

	var processing = function(docs, raw) {

		for (var j = 0; j < docs.length; j++) {

			indexer++;
			var removed = false;
			var json = docs[j];

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				var builder = item.builder;
				item.filter.index = indexer;

				var output = item.compare(json, item.filter, indexer);
				if (output) {
					builder.$options.backup && builder.$backupdoc(output);
					removed = true;
					json = output;
					break;
				}
			}

			if (removed) {
				for (var i = 0; i < length; i++) {
					var item = filter[i];
					item.backup && item.backup.write(raw[j] + NEWLINE);
					item.count++;
				}
				self.$events.remove && self.emit('remove', json);
				change = true;
			} else
				writer.write(raw[j] + NEWLINE);
		}
	};

	reader && reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value) {

		if (value[0] !== '{')
			return;

		buf.push(value.substring(0, value.length - 1));
		bufcount++;

		if (bufcount % JSONBUFFER === 0) {
			bufcount = 0;
			processing(JSON.parse('[' + buf.join(',') + ']', jsonparser), buf);
			buf = [];
		}

	}));

	var finish = function() {

		// No change
		if (!change) {
			Fs.unlink(self.filenameTemp, function() {
				for (var i = 0; i < length; i++) {
					var item = filter[i];
					item.builder.$options.log && item.builder.log();
					item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count, item.filter.repository);
				}
				self.next(0);
			});
			return;
		}

		self.renaming = true;

		// Maybe is reading?
		if (self.step && self.step !== 9 && self.step !== 3) {
			self.next(0);
			return setTimeout(finish, 100);
		}

		self.step = 9;
		Fs.rename(self.filenameTemp, self.filename, function() {

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				item.builder.$options.log && item.builder.log();
				item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count, item.filter.repository);
			}

			setImmediate(function() {
				self.renaming = false;
				self.next(0);
				change && setImmediate(views_refresh, self);
			});
		});
	};

	CLEANUP(writer, finish);

	CLEANUP(reader, function() {

		if (bufcount) {
			bufcount = 0;
			processing(JSON.parse('[' + buf.join(',') + ']', jsonparser), buf);
			buf = null;
		}

		writer.end();
	});
};

Database.prototype.$remove_inmemory = function() {

	var self = this;
	self.step = 3;

	if (!self.pending_remove.length) {
		self.next(0);
		return self;
	}

	var filter = self.pending_remove.splice(0);
	var length = filter.length;
	var change = false;

	for (var i = 0; i < length; i++) {
		var fil = filter[i];
		fil.compare = fil.builder.compile();
		fil.filter = { repository: fil.builder.$repository, options: fil.builder.$options, arg: fil.builder.$params, fn: fil.builder.$functions };
	}

	return self.$inmemory('#', function() {

		var data = self.inmemory['#'];
		var arr = [];

		for (var j = 0, jl = data.length; j < jl; j++) {
			var json = data[j];
			var removed = false;

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				item.filter.index = j;
				if (item.compare(json, item.filter, j)) {
					removed = true;
					break;
				}
			}

			if (removed) {
				for (var i = 0; i < length; i++) {
					var item = filter[i];
					item.backup && item.backup.write(JSON.stringify(json));
					item.count++;
				}
				change = true;
				self.$events.remove && self.emit('remove', json);
			} else
				arr.push(json);
		}

		if (change) {
			self.inmemory['#'] = arr;
			self.$save('#');
		}

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			item.builder.$options.log && item.builder.log();
			item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count);
		}

		self.next(0);
		change && setImmediate(views_refresh, self);
	});
};

Database.prototype.$drop = function() {
	var self = this;
	self.step = 7;

	if (!self.pending_drops) {
		self.next(0);
		return;
	}

	self.pending_drops = false;
	var remove = [self.filename, self.filenameTemp];
	Object.keys(self.views).forEach(key => remove.push(self.views[key].$filename));

	try {
		Fs.readdirSync(self.binary.directory).forEach(function(filename) {
			filename.startsWith(self.name + '#') && filename.endsWith(EXTENSION_BINARY) && remove.push(framework_utils.join(self.binary.directory, filename));
		});
	} catch (e) {}

	remove.wait((filename, next) => Fs.unlink(filename, next), function() {
		self.next(0);
		self.free(true);
	}, 5);

	Object.keys(self.inmemory).forEach(function(key) {
		self.inmemory[key] = undefined;
	});
};

function DatabaseBuilder2(db) {
	this.$callback = NOOP;
	this.db = db;
	this.$options = {};
}

DatabaseBuilder2.prototype.log = function(msg, user) {
	var self = this;
	if (msg) {
		F.datetime = new Date();
		self.$options.log = (self.$options.log ? self.$options.log : '') + F.datetime.format('yyyy-MM-dd HH:mm:ss') + ' | ' + (user ? user.padRight(20) + ' | ' : '') + msg + NEWLINE;
	} else if (self.$options.log) {
		self.db.filenameLog && Fs.appendFile(self.db.filenameLog, self.$options.log, F.error());
		self.$options.log = '';
	}
	return self;
};

DatabaseBuilder2.prototype.callback = function(fn, emptyerror) {

	if (typeof(fn) === 'string') {
		var tmp = emptyerror;
		emptyerror = fn;
		fn = tmp;
	}

	this.$callback = fn;
	this.$callback_emptyerror = emptyerror;
	return this;
};

function DatabaseBuilder(db) {
	this.db = db;
	this.$take = 0;
	this.$skip = 0;
	this.$filter = [];
	// this.$sort;
	this.$first = false;
	this.$scope = 0;
	// this.$fields;
	// this.$join;
	// this.$joincount;
	this.$callback = NOOP;
	// this.$scalar;
	// this.$scalarfield;
	// this.$done; --> internal for indexes

	this.$code = [];
	this.$params = {};
	this.$options = {};
	this.$repository = {};
	this.$counter = 0;
}

DatabaseBuilder.prototype.id = function(id) {
	this.$options.id = id;
	return this;
};

DatabaseBuilder.prototype.insert = function(fn) {
	this.$insertcallback = fn;
	return this;
};

DatabaseBuilder.prototype.log = function(msg, user) {
	var self = this;
	if (msg) {
		F.datetime = new Date();
		self.$options.log = (self.$options.log ? self.$options.log : '') + F.datetime.format('yyyy-MM-dd HH:mm:ss') + ' | ' + (user ? user.padRight(20) + ' | ' : '') + msg + NEWLINE;
	} else if (self.$options.log) {
		self.db.filenameLog && Fs.appendFile(self.db.filenameLog, self.$options.log, F.error());
		self.$options.log = '';
	}
	return self;
};

DatabaseBuilder.prototype.$callback2 = function(err, response, count, repository) {
	var self = this;

	if (err || !self.$join) {
		self.$options.log && self.log();
		self.$done && setImmediate(self.$done);
		return self.$callback(err, response, count, repository);
	}

	if (self.$joincount) {
		setImmediate(() => self.$callback2(err, response, count, repository));
		return self;
	}

	var keys = Object.keys(self.$join);
	var jl = keys.length;

	if (response instanceof Array) {
		for (var i = 0, length = response.length; i < length; i++) {
			var item = response[i];
			for (var j = 0; j < jl; j++) {
				var join = self.$join[keys[j]];
				item[join.field] = join.scalar ? scalar(join.items, join.scalar, join.scalarfield, join.a, join.b != null ? item[join.b] : undefined) : join.first ? findItem(join.items, join.a, item[join.b], join.scalar, join.scalarfield) : findItems(join.items, join.a, item[join.b]);
			}
		}
	} else if (response) {
		for (var j = 0; j < jl; j++) {
			var join = self.$join[keys[j]];
			response[join.field] = join.scalar ? scalar(join.items, join.scalar, join.scalarfield, join.a, join.b != null ? response[join.b] : undefined) : join.first ? findItem(join.items, join.a, response[join.b], join.scalar, join.scalarfield) : findItems(join.items, join.a, response[join.b]);
		}
	}

	self.$options.log && self.log();
	self.$callback(err, response, count, repository);
	self.$done && setImmediate(self.$done);
	return self;
};

function scalar(items, type, field, where, value) {

	if (type === 'count' && !where)
		return items.length;

	var val = type !== 'min' && type !== 'max' ? type === 'group' ? {} : 0 : null;
	var count = 0;

	for (var i = 0, length = items.length; i < length; i++) {
		var item = items[i];

		if (where && item[where] !== value)
			continue;

		switch (type) {
			case 'count':
				val++;
				break;
			case 'sum':
				val += item[field] || 0;
				break;
			case 'avg':
				val += item[field] || 0;
				count++;
				break;
			case 'min':
				val = val === null ? item[field] : (val > item[field] ? item[field] : val);
				break;
			case 'group':
				if (val[item[field]])
					val[item[field]]++;
				else
					val[item[field]] = 1;
				break;
			case 'max':
				val = val === null ? item[field] : (val < item[field] ? item[field] : val);
				break;
		}
	}

	if (type === 'avg')
		val = val / count;

	return val || 0;
}

function findItem(items, field, value) {
	for (var i = 0, length = items.length; i < length; i++) {
		if (items[i][field] === value)
			return items[i];
	}
}

function findItems(items, field, value) {
	var arr = [];
	for (var i = 0, length = items.length; i < length; i++) {
		if (items[i][field] === value)
			arr.push(items[i]);
	}
	return arr;
}

DatabaseBuilder.prototype.join = function(field, name, view) {
	var self = this;

	if (!self.$join) {
		self.$join = {};
		self.$joincount = 0;
	}

	var key = name + '.' + (view || '') + '.' + field;
	var join = self.$join[key];
	if (join)
		return join;

	self.$join[key] = {};
	self.$join[key].field = field;
	self.$join[key].pending = true;
	self.$joincount++;

	join = NOSQL(name).find(view);

	join.on = function(a, b) {
		self.$join[key].a = a;
		self.$join[key].b = b;
		return join;
	};

	join.$where = self.where;

	join.where = function(a, b, c) {
		return c === undefined && typeof(b) === 'string' ? join.on(a, b) : join.$where(a, b, c);
	};

	join.scalar = function(type, field) {
		self.$join[key].scalar = type;
		self.$join[key].scalarfield = field;
		return join;
	};

	join.first = function() {
		self.$join[key].first = true;
		return join;
	};

	join.callback(function(err, docs) {
		self.$join[key].pending = false;
		self.$join[key].items = docs;
		self.$joincount--;
	});

	setImmediate(function() {
		join.$fields && join.fields(self.$join[key].b);
		join.$fields && self.$join[key].scalarfield && join.fields(self.$join[key].scalarfield);
	});

	return join;
};

DatabaseBuilder.prototype.first = function() {
	this.$options.first = true;
	return this.take(1);
};

DatabaseBuilder.prototype.make = function(fn) {
	fn.call(this, this);
	return this;
};

DatabaseBuilder.prototype.filter = function(fn) {
	var self = this;

	if (!self.$functions)
		self.$functions = [];

	var index = self.$functions.push(fn) - 1;
	var code = '$is=!!fn[{0}].call($F,doc,index,repository);'.format(index);

	if (self.$scope)
		code = 'if(!$is){' + code + '}';

	self.$code.push(code);
	!self.$scope && self.$code.push('if(!$is)return;');
	return self;
};

DatabaseBuilder.prototype.scalar = function(type, name) {
	var self = this;
	var opt = self.$options;
	opt.scalar = type;
	opt.scalarfield = name;
	return this;
};

DatabaseBuilder.prototype.contains = function(name) {
	var self = this;
	var code = '$is=doc.{0} instanceof Array?!!doc.{0}.length:!!doc.{0};'.format(name);
	if (self.$scope)
		code = 'if(!$is){' + code + '}';
	self.$code.push(code);
	!self.$scope && self.$code.push('if(!$is)return;');
	return self;
};

DatabaseBuilder.prototype.empty = function(name) {
	var self = this;
	var code = '$is=doc.{0} instanceof Array?!doc.{0}.length:!doc.{0};'.format(name);
	if (self.$scope)
		code = 'if(!$is){' + code + '}';
	self.$code.push(code);
	!self.$scope && self.$code.push('if(!$is)return;');
	return self;
};

DatabaseBuilder.prototype.backup = function(user) {
	if (this.db.filenameBackup)
		this.$options.backup = typeof(user) === 'string' ? user : 'unknown';
	else
		this.$options.backup = null;
	return this;
};

DatabaseBuilder.prototype.$backupdoc = function(doc) {
	this.db.filenameBackup && Fs.appendFile(this.db.filenameBackup, F.datetime.format('yyyy-MM-dd HH:mm') + ' | ' + this.$options.backup.padRight(20) + ' | ' + JSON.stringify(doc) + NEWLINE, F.error());
	return this;
};

DatabaseBuilder.prototype.where = function(name, operator, value) {

	var self = this;
	var key = 'w' + (self.$counter++);
	var code;

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	var date = framework_utils.isDate(value);
	self.$params[key] = date ? value.getTime() : value;

	switch (operator) {
		case '=':
			operator = '==';
			break;
		case '<>':
			operator = '!=';
			break;
	}

	code = (date ? '$is=(doc.{0} instanceof Date?doc.{0}:new Date(doc.{0})).getTime(){2}arg.{1};' : '$is=doc.{0}{2}arg.{1};');

	if (self.$scope)
		code = 'if(!$is){' + code + '}';

	self.$code.push(code.format(name, key, operator));
	!self.$scope && self.$code.push('if(!$is)return;');
	return self;
};

DatabaseBuilder.prototype.month = function(name, operator, value) {
	var self = this;
	var key = 'dm' + (self.$counter++);

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	self.$params[key] = value;

	var code = compare_datetype('month', name, key, operator);
	if (self.$scope)
		code = 'if(!$is){' + code + '}';
	self.$code.push(code);
	!self.$scope && self.$code.push('if(!$is)return;');
	return self;
};

DatabaseBuilder.prototype.day = function(name, operator, value) {
	var self = this;
	var key = 'dd' + (self.$counter++);

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	self.$params[key] = value;

	var code = compare_datetype('day', name, key, operator);
	if (self.$scope)
		code = 'if(!$is){' + code + '}';
	self.$code.push(code);
	!self.$scope && self.$code.push('if(!$is)return;');
	return self;
};

DatabaseBuilder.prototype.year = function(name, operator, value) {
	var self = this;
	var key = 'dy' + (self.$counter++);

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	self.$params[key] = value;

	var code = compare_datetype('year', name, key, operator);
	if (self.$scope)
		code = 'if(!$is){' + code + '}';
	self.$code.push(code);
	!self.$scope && self.$code.push('if(!$is)return;');
	return self;
};

DatabaseBuilder.prototype.like = DatabaseBuilder.prototype.search = function(name, value, where) {

	var self = this;
	var code;
	var key = 'l' + (self.$counter++);

	if (!where)
		where = '*';

	switch (where) {
		case 'beg':
			code = '$is=doc.{0}?doc.{0}.startsWith(arg.{1}):false;';
			break;
		case 'end':
			code = '$is=doc.{0}?doc.{0}.endsWith(arg.{1}):false;';
			break;
		case '*':
			code = '$is=false;if(doc.{0}&&doc.{0}.toLowerCase){if(doc.{0} instanceof Array){for(var $i=0;$i<doc.{0}.length;$i++){if(doc.{0}.toLowerCase().indexOf(arg.{1})!==-1){$is=true;break;}}}else{$is=doc.{0}.toLowerCase().indexOf(arg.{1})!==-1}}';
			if (value instanceof Array) {
				for (var i = 0, length = value.length; i < length; i++)
					value[i] = value[i].toLowerCase();
			} else
				value = value.toLowerCase();
			break;
	}

	self.$params[key] = value;
	if (self.$scope)
		code = 'if(!$is){' + code + '}';
	self.$code.push(code.format(name, key));
	!self.$scope && self.$code.push('if(!$is)return;');
	return this;
};

DatabaseBuilder2.prototype.stringify = DatabaseBuilder.prototype.stringify = function() {
	var obj = {};
	obj.options = this.$options;
	obj.code = this.$code;
	obj.params = this.$params;
	if (this.$functions) {
		obj.functions = [];
		for (var i = 0; i < this.$functions.length; i++)
			obj.functions.push(this.$functions[i].toString());
	}

	if (this.$repository)
		obj.repository = this.$repository;

	return JSON.stringify(obj);
};

DatabaseBuilder2.prototype.parse = DatabaseBuilder.prototype.parse = function(data) {
	data = JSON.parse(data, jsonparser);
	this.$options = data.options;
	this.$code = data.code;
	this.$params = data.params;
	this.$take = data.options.take;
	this.$skip = data.options.skip;
	this.$repository = data.repository;

	if (data.functions) {
		for (var i = 0; i < data.functions.length; i++)
			data.functions[i] = eval('(' + data.functions[i] + ')');
		this.$functions = data.functions;
	}

	return this;
};

DatabaseBuilder.prototype.take = function(count) {
	this.$take = this.$options.take = count;
	return this;
};

DatabaseBuilder.prototype.limit = function(count) {
	this.$take = this.$options.take = count;
	return this;
};

DatabaseBuilder.prototype.page = function(page, limit) {
	this.$take = this.$options.take = limit;
	this.$skip = this.$options.skip = page * limit;
	return this;
};

DatabaseBuilder.prototype.paginate = function(page, limit, maxlimit) {

	var limit2 = +(limit || 0);
	var page2 = (+(page || 0)) - 1;

	if (page2 < 0)
		page2 = 0;

	if (maxlimit && limit2 > maxlimit)
		limit2 = maxlimit;

	if (!limit2)
		limit2 = maxlimit;

	this.$skip = this.$options.skip = page2 * limit2;
	this.$take = this.$options.take = limit2;
	return this;
};

DatabaseBuilder.prototype.skip = function(count) {
	this.$take = this.$options.skip = count;
	return this;
};

DatabaseBuilder.prototype.callback = function(fn, emptyerror) {

	if (typeof(fn) === 'string') {
		var tmp = emptyerror;
		emptyerror = fn;
		fn = tmp;
	}

	this.$callback = fn;
	this.$callback_emptyerror = emptyerror;
	return this;
};

DatabaseBuilder.prototype.random = function() {
	this.$options.sort = null;
	return this;
};

DatabaseBuilder.prototype.sort = function(name, desc) {
	this.$options.sort = { name: name, asc: desc ? false : true };
	return this;
};

DatabaseBuilder.prototype.repository = function(key, value) {
	if (key === undefined)
		return this.$repository;
	if (value === undefined)
		return this.$repository[key];
	this.$repository[key] = value;
	return this;
};

DatabaseBuilder.prototype.compile = function() {
	var self = this;
	var raw = self.$code.join('');
	var code = 'var repository=$F.repository;var options=$F.options;var arg=$F.arg;var fn=$F.fn;var $is=false;var $tmp;' + raw + (self.$code.length && raw.substring(raw.length - 7) !== 'return;' ? 'if(!$is)return;' : '') + 'if(!options.fields)return doc;var $doc={};for(var $i=0;$i<options.fields.length;$i++){var prop=options.fields[$i];$doc[prop]=doc[prop];}return $doc;';
	var opt = self.$options;
	self.$inlinesort = !!(opt.take && opt.sort && opt.sort !== null);
	self.$limit = (opt.take || 0) + (opt.skip || 0);
	var key = opt.id ? self.db.name + '_' + opt.id : code.hash();
	return CACHE[key] ? CACHE[key] : (CACHE[key] = new Function('doc', '$F', 'index', code));
};

DatabaseBuilder.prototype.in = function(name, value) {
	var self = this;
	var key = 'in' + (self.$counter++);
	self.$params[key] = value instanceof Array ? value : [value];
	var code = '$tmp=doc.{0};if($tmp instanceof Array){for(var $i=0;$i<$tmp.length;$i++){if(arg.{1}.indexOf($tmp[$i])!==-1){$is=true;break}}}else{if(arg.{1}.indexOf($tmp)!==-1)$is=true}'.format(name, key);
	if (self.$scope)
		code = 'if(!$is){' + code + '}';
	self.$code.push(code);
	!self.$scope && self.$code.push('if(!$is)return;');
	return self;
};

DatabaseBuilder.prototype.notin = function(name, value) {
	var self = this;
	var key = 'in' + (self.$counter++);
	self.$params[key] = value instanceof Array ? value : [value];
	var code = '$is=true;$tmp=doc.{0};if($tmp instanceof Array){for(var $i=0;$i<$tmp.length;$i++){if(arg.{1}.indexOf($tmp[$i])!==-1){$is=false;break}}}else{if(arg.{1}.indexOf($tmp)!==-1)$is=false}'.format(name, key);
	if (self.$scope)
		code = 'if(!$is){' + code + '}';
	self.$code.push(code);
	!self.$scope && self.$code.push('if(!$is)return;');
	return self;
};

DatabaseBuilder.prototype.between = function(name, a, b) {
	var self = this;
	var keya = 'ba' + (self.$counter++);
	var keyb = 'bb' + (self.$counter++);
	var code = '$is=doc.{0}>=arg.{1}&&doc.{0}<=arg.{2};'.format(name, keya, keyb);
	if (self.$scope)
		code = 'if(!$is){' + code + '}';
	self.$params[keya] = a;
	self.$params[keyb] = b;
	self.$code.push(code);
	!self.$scope && self.$code.push('if(!$is)return;');
	return self;
};

DatabaseBuilder.prototype.or = function() {
	this.$code.push('$is=false;');
	this.$scope = 1;
	return this;
};

DatabaseBuilder.prototype.end = function() {
	this.$scope = 0;
	this.$code.push('if(!$is)return;');
	return this;
};

DatabaseBuilder.prototype.and = function() {
	this.$code.push('$is=false;');
	this.$scope = 0;
	return this;
};

DatabaseBuilder.prototype.done = function() {
	this.$options = {};
	this.$code = [];
	return this;
};

DatabaseBuilder.prototype.cache = function() {
	// this.$cache_key = '$nosql_' + key;
	// this.$cache_expire = expire;
	OBSOLETE('DatabaseBuilder.cache()', 'NoSQL database supports in-memory mode.');
	return this;
};

DatabaseBuilder.prototype.fields = function() {
	var self = this;
	var opt = self.$options;
	if (!opt.fields)
		opt.fields = [];
	for (var i = 0, length = arguments.length; i < length; i++)
		opt.fields.push(arguments[i]);
	return self;
};

DatabaseBuilder.prototype.code = function(code) {
	var self = this;

	if (typeof(code) === 'function') {
		code = code.toString();
		code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'));
	}

	code = code.trim();

	if (self.$scope)
		code = 'if(!$is){' + code + '}';

	self.$code.push(code + ';');
	!self.$scope && self.$code.push('if(!$is)return;');

	return self;
};

DatabaseBuilder.prototype.prepare = function(fn) {
	var self = this;

	if (!self.$functions)
		self.$functions = [];

	var index = self.$functions.push(fn) - 1;
	var code = '$tmp=fn[{0}].call($F,U.clone(doc),index,repository);if(typeof($tmp)==\'boolean\'){$is=$tmp}else{doc=$tmp;$is=$tmp!=null}'.format(index);

	if (self.$scope)
		code = 'if(!$is){' + code + '}';

	self.$code.push(code);
	!self.$scope && self.$code.push('if(!$is)return;');
	return this;
};

function Counter(db) {
	var self = this;
	self.TIMEOUT = 30000;
	self.db = db;
	self.cache;
	self.key = 'nosql' + db.name.hash();
	self.type = 0; // 1 === saving, 2 === reading
	self.$events = {};
}

Counter.prototype.emit = function(name, a, b, c, d, e, f, g) {
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

Counter.prototype.on = function(name, fn) {

	if (!fn.$once)
		this.db.$free = false;

	if (this.$events[name])
		this.$events[name].push(fn);
	else
		this.$events[name] = [fn];

	return this;
};

Counter.prototype.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

Counter.prototype.removeListener = function(name, fn) {
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

Counter.prototype.removeAllListeners = function(name) {
	if (name === true)
		this.$events = EMPTYOBJECT;
	else if (name)
		this.$events[name] = undefined;
	else
		this.$events = {};
	return this;
};

Counter.prototype.empty = function(key, value) {
	var self = this;
	!self.cache && (self.cache = {});

	// key[2] = su[m]
	// max
	// min
	// mma
	// avg

	self.cache[key] = key[2] === 'm' ? value : [value, value];
	return self;
};

Counter.prototype.min = function(id, count) {

	var self = this;

	if (id instanceof Array) {
		for (var i = 0, length = id.length; i < length; i++)
			self.min(id[i], count);
		return self;
	}

	var key = 'mma' + F.datetime.getFullYear() + '' + id;

	if (!self.cache || !self.cache[key])
		self.empty(key, count);
	else {
		var arr = self.cache[key];
		if (arr[0] > count) // min
			arr[0] = count;
		if (arr[1] < count) // max
			arr[1] = count;
	}

	setTimeout2(self.key, () => self.save(), self.TIMEOUT, 5);
	this.$events.min && self.emit('min', id, count || 1);
	return self;
};

Counter.prototype.max = function(id, count) {

	var self = this;

	if (id instanceof Array) {
		for (var i = 0, length = id.length; i < length; i++)
			self.min(id[i], count);
		return self;
	}

	var key = 'mma' + F.datetime.getFullYear() + '' + id;
	if (!self.cache || !self.cache[key])
		self.empty(key, count);
	else {
		var arr = self.cache[key];
		if (arr[0] > count) // min
			arr[0] = count;
		if (arr[1] < count) // max
			arr[1] = count;
	}

	setTimeout2(self.key, () => self.save(), self.TIMEOUT, 5);
	this.$events.max && self.emit('max', id, count || 1);
	return self;
};

Counter.prototype.inc = Counter.prototype.hit = function(id, count) {

	var self = this;

	if (id instanceof Array) {
		for (var i = 0, length = id.length; i < length; i++)
			self.min(id[i], count);
		return self;
	}

	var key = 'sum' + F.datetime.getFullYear() + '' + id;
	if (!self.cache || !self.cache[key])
		self.empty(key, count || 1);
	else
		self.cache[key] += count || 1;

	setTimeout2(self.key, () => self.save(), self.TIMEOUT, 5);
	this.$events.sum && self.emit('sum', id, count || 1);
	this.$events.hits && self.emit('hit', id, count || 1);
	return self;
};

Counter.prototype.remove = function(id) {
	var self = this;

	!self.cache && (self.cache = {});

	if (id instanceof Array)
		id.forEach(n => self.cache[n] = null);
	else
		self.cache[id] = null;

	setTimeout2(self.key, () => self.save(), self.TIMEOUT, 5);
	self.emit('remove', id);
	return self;
};

Counter.prototype.count = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 0;
	options.id = id;
	options.type = 'sum';
	return this.read(options, callback);
};

Counter.prototype.maximum = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 0;
	options.id = id;
	options.type = 'mma';
	options.type2 = 'max';
	return this.read(options, callback);
};

Counter.prototype.minimum = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 0;
	options.id = id;
	options.type = 'mma';
	options.type2 = 'min';
	return this.read(options, callback);
};

Counter.prototype.yearly = Counter.prototype.yearly_sum = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 1;
	options.id = id;
	options.type = 'sum';
	return this.read(options, callback);
};

Counter.prototype.monthly= Counter.prototype.monthly_sum = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 2;
	options.id = id;
	options.type = 'sum';
	return this.read(options, callback);
};

Counter.prototype.daily = Counter.prototype.daily_sum = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 3;
	options.id = id;
	options.type = 'sum';
	return this.read(options, callback);
};

Counter.prototype.yearly_max = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 1;
	options.id = id;
	options.type = 'mma';
	options.type2 = 'max';
	return this.read(options, callback);
};

Counter.prototype.monthly_max = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 2;
	options.id = id;
	options.type = 'mma';
	options.type2 = 'max';
	return this.read(options, callback);
};

Counter.prototype.daily_max = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 3;
	options.id = id;
	options.type = 'mma';
	options.type2 = 'max';
	return this.read(options, callback);
};

Counter.prototype.yearly_min = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 1;
	options.id = id;
	options.type = 'mma';
	options.type2 = 'min';
	return this.read(options, callback);
};

Counter.prototype.monthly_min = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 2;
	options.id = id;
	options.type = 'mma';
	options.type2 = 'min';
	return this.read(options, callback);
};

Counter.prototype.daily_min = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	var options = {};
	options.subtype = 3;
	options.id = id;
	options.type = 'mma';
	options.type2 = 'min';
	return this.read(options, callback);
};

Counter.prototype.read = function(options, callback, reader) {

	var self = this;

	if (self.type && reader === undefined) {
		setTimeout(() => self.read(options, callback), 200);
		return self;
	}

	self.type = 2;

	if (self.db.readonly) {
		if (reader === undefined) {
			U.download(self.db.filenameCounter, FLAGS_READ, function(err, response) {
				self.read(options, callback, err ? null : response);
			});
			return self;
		}
	} else
		reader = Fs.createReadStream(self.db.filenameCounter);

	// 0 == options.subtype: summarize
	// 1 == options.subtype: full

	var keys = {};
	var single = false;
	var all = options.id ? false : true;
	var output = all && !options.subtype ? null : {};

	if (typeof(options.id) === 'string') {
		options.id = [options.id];
		single = true;
	}

	if (options.id) {
		for (var i = 0, length = options.id.length; i < length; i++)
			keys[options.type + options.id[i]] = true;
	}

	if (reader) {

		reader.on('error', function() {
			self.type = 0;
			callback(null, single ? (options.subtype ? EMPTYARRAY : 0) : (all ? EMPTYARRAY : output));
		});

		reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value, index) {

			var index = value.indexOf('=');
			var key = value.substring(7, index);
			var type = value.substring(0, 3);

			if (options.type !== type)
				return;

			var tmp;
			var year = value.substring(3, 7);

			if (all || options.id === true || keys[type + key]) {
				switch (options.subtype) {
					case 0:
						var val = value.substring(index + 1, value.indexOf(';'));
						switch (options.type2 || options.type) {
							case 'max':
								var a = counter_minmax(options, val);
								if (all) {
									if (output == null)
										output = a;
									else if (output < a)
										output = a;
								} else
									output[key] = a;
								break;
							case 'min':
								var a = counter_minmax(options, val);
								if (all) {
									if (output == null)
										output = a;
									else if (output > a)
										output = a;
								} else
									output[key] = a;
								break;
							case 'sum':
								if (all)
									output = (output || 0) + (+val);
								else
									output[key] = +val;
								break;
						}
						break;
					case 1:
						if (all)
							counter_parse_years_all(output, value, year, options);
						else {
							tmp = counter_parse_years(value, year, options);
							if (output[key])
								output[key].push.apply(output[key], tmp);
							else
								output[key] = tmp;
						}
						break;
					case 2:
						if (all)
							counter_parse_months_all(output, value, year, options);
						else {
							tmp = counter_parse_months(value, year, options);
							if (output[key])
								output[key].push.apply(output[key], tmp);
							else
								output[key] = tmp;
						}
						break;
					case 3:
						if (all)
							counter_parse_days_all(output, value, year, options);
						else {
							tmp = counter_parse_days(value, year, options);
							if (output[key])
								output[key].push.apply(output[key], tmp);
							else
								output[key] = tmp;
						}
						break;
				}
			}
		}));
	}

	var finish = function() {
		self.type = 0;
		// Array conversation
		if (all && options.subtype) {
			var tmp = [];
			var keys;
			switch (options.subtype) {
				case 3: // daily
					keys = Object.keys(output);
					for (var i = 0, length = keys.length; i < length; i++) {
						var key = keys[i];
						tmp.push({ id: key, year: +key.substring(0, 4), month: +key.substring(4, 6), day: +key.substring(6, 8), value: output[key] });
					}
					break;
				case 2: // monthly
					keys = Object.keys(output);
					for (var i = 0, length = keys.length; i < length; i++) {
						var key = keys[i];
						tmp.push({ id: key, year: +key.substring(0, 4), month: +key.substring(4, 6), value: output[key] });
					}
					break;
				case 1: // yearly
					keys = Object.keys(output);
					for (var i = 0, length = keys.length; i < length; i++) {
						var key = keys[i];
						tmp.push({ id: key, year: +key.substring(0, 4), value: output[key] });
					}
					break;
			}
			output = tmp;
		}

		callback(null, single ? (options.subtype ? output[options.id[0]] || EMPTYARRAY : output[options.id[0]] || 0) : output);
	};

	if (reader)
		reader.on('end', finish);
	else
		finish();

	return self;
};

Counter.prototype.stats_max = function(top, year, month, day, callback) {
	return this.stats(top, year, month, day, 'max', callback);
};

Counter.prototype.stats_min = function(top, year, month, day, callback) {
	return this.stats(top, year, month, day, 'min', callback);
};

Counter.prototype.stats = Counter.prototype.stats_sum = function(top, year, month, day, type, callback, reader) {

	var self = this;

	if (self.type && reader === undefined) {
		setTimeout(() => self.stats(top, year, month, day, type, callback), 200);
		return self;
	}

	self.type = 3;

	if (self.db.readonly) {
		if (reader === undefined) {
			U.download(self.db.filenameCounter, FLAGS_READ, function(err, response) {
				if (err) {
					self.type = 0;
					callback && callback(err, []);
				} else
					self.stats(top, year, month, day, type, callback, response);
			});
			return self;
		}
	} else
		reader = Fs.createReadStream(self.db.filenameCounter);

	if (typeof(day) == 'function') {
		callback = day;
		day = null;
	} else if (typeof(month) == 'function') {
		callback = month;
		month = null;
	} else if (typeof(year) === 'function') {
		callback = year;
		year = month = null;
	}

	var date = null;
	var output = [];

	if (!type)
		type = 'sum';

	if (year) {
		if (day) {
			date = month.padLeft(2, '0') + day.padLeft(2, '0');
			date = new RegExp(';' + date + '=[0-9X\\.]+', 'g');
		} else if (month) {
			date = month.padLeft(2, '0') + '\\d{2}';
			date = new RegExp(';' + date + '=[0-9X\\.]+', 'g');
		}
	}

	reader.on('error', function() {
		self.type = 0;
		callback && callback(null, output);
	});

	if (year > 0)
		year = year.toString();

	var opt = {};

	if (type !== 'sum') {
		opt.type = 'mma';
		opt.type2 = type;
	} else
		opt.type = type;

	reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value, index) {

		var index = value.indexOf('=');
		if (value.substring(0, 3) !== opt.type || (year && value.substring(3, 7) !== year))
			return;

		var count = null;

		if (date) {
			var matches = value.match(date);
			if (!matches)
				return;
			count = counter_parse_stats(matches, opt);
		} else {
			var val = value.substring(index + 1, value.indexOf(';', index));
			count = opt.type2 ? counter_minmax(opt, val) : +val;
		}

		count != null && counter_parse_stats_avg(output, top, value.substring(7, index), count, type, undefined, year == null && month == null && day == null);
	}));

	reader.on('end', function() {
		self.type = 0;
		output.sort(counter_sort_sum);
		callback && callback(null, output);
	});

	return self;
};

function counter_sort_sum(a, b) {
	return a.count > b.count ? -1 : a.count === b.count ? 0 : 1;
}

function counter_sort_min(a, b) {
	return a.count > b.count ? 1 : a.count === b.count ? 0 : -1;
}

function counter_parse_stats_avg(group, top, key, count, opt) {

	var length = group.length;

	if (length < top) {
		for (var i = 0; i < length; i++) {
			if (group[i].id === key) {
				group[i].count += count;
				return;
			}
		}

		group.push({ id: key, count: count });
		if (group.length === top) {
			switch (opt.type2 || opt.type) {
				case 'max':
				case 'sum':
					group.sort(counter_sort_sum);
					break;
				case 'min':
					group.sort(counter_sort_min);
					break;
			}
		}
		return;
	}

	for (var i = 0; i < length; i++) {
		if (group[i].id === key) {
			group[i].count += count;
			return;
		}
	}

	for (var i = 0; i < length; i++) {
		var item = group[i];

		if (opt.type === 'min') {
			if (item.count < count)
				continue;
		} else if (item.count > count)
			continue;

		for (var j = length - 1; j > i; j--) {
			group[j].id = group[j - 1].id;
			group[j].count = group[j - 1].count;
		}

		item.id = key;
		item.count = count;
		return;
	}
}

function counter_parse_stats(matches, opt) {

	var value = null;

	for (var i = 0, length = matches.length; i < length; i++) {
		var item = matches[i];
		var val = item.substring(item.indexOf('=', 3) + 1);

		switch (opt.type2 || opt.type) {
			case 'max':
				var a = counter_minmax(opt, val);
				if (value == null)
					value = a;
				else if (value < a)
					value = a;
				break;
			case 'min':
				var a = counter_minmax(opt, val);
				if (value == null)
					value = a;
				else if (value > a)
					value = a;
				break;
			case 'sum':
				value += +val;
				break;
		}
	}

	return value;
}

function counter_minmax(opt, val) {
	var index = val.indexOf('X');
	switch (opt.type2) {
		case 'min':
			return +val.substring(0, index);
		case 'max':
			return +val.substring(index + 1);
		case 'avg':
			return ((+val.substring(0, index)) + (+val.substring(index + 1))) / 2;
	}
}

function counter_parse_years(value, year, opt) {

	var arr = value.trim().split(';');
	var tmp = {};

	for (var i = 1, length = arr.length; i < length; i++) {
		var val = arr[i].substring(5);
		if (tmp[year]) {
			switch (opt.type2 || opt.type) {
				case 'max':
					var a = counter_minmax(opt, val);
					if (tmp[year].value < a)
						tmp[year].value = a;
					break;
				case 'min':
					var a = counter_minmax(opt, val);
					if (tmp[year].value > a)
						tmp[year].value = a;
					break;
				case 'sum':
					tmp[year].value += +val;
					break;
			}
		} else
			tmp[year] = { id: year, year: +year, value: opt.type2 ? counter_minmax(opt, val) : +val };
	}

	var output = [];
	var keys = Object.keys(tmp);
	for (var i = 0, length = keys.length; i < length; i++)
		output.push(tmp[keys[i]]);

	return output;
}

function counter_parse_months(value, year, opt) {

	var arr = value.trim().split(';');
	var tmp = {};

	for (var i = 1, length = arr.length; i < length; i++) {
		var val = arr[i].substring(5);
		var key = year + arr[i].substring(0, 2);

		if (tmp[key]) {
			switch (opt.type2 || opt.type) {
				case 'max':
					var a = counter_minmax(opt, val);
					if (tmp[key].value < a)
						tmp[key].value = a;
					break;
				case 'min':
					var a = counter_minmax(opt, val);
					if (tmp[key].value > a)
						tmp[key].value = a;
					break;
				case 'sum':
					tmp[key].value += +val;
					break;
			}
		} else
			tmp[key] = { id: key, year: +year, month: +key.substring(4), value: opt.type2 ? counter_minmax(opt, val) : +val };
	}

	var output = [];
	var keys = Object.keys(tmp);
	for (var i = 0, length = keys.length; i < length; i++)
		output.push(tmp[keys[i]]);

	return output;
}

function counter_parse_days(value, year, opt) {

	var arr = value.trim().split(';');
	var tmp = {};

	for (var i = 1, length = arr.length; i < length; i++) {
		var val = arr[i].substring(5);
		var key = year + arr[i].substring(0, 4);

		if (tmp[key]) {
			switch (opt.type2 || opt.type) {
				case 'max':
					var a = counter_minmax(opt, val);
					if (tmp[key].value < a)
						tmp[key].value = a;
					break;
				case 'min':
					var a = counter_minmax(opt, val);
					if (tmp[key].value > a)
						tmp[key].value = a;
					break;
				case 'sum':
					tmp[key].value += +val;
					break;
			}
		} else
			tmp[key] = { id: key, year: +year, month: +key.substring(4, 6), day: +key.substring(6), value: opt.type2 ? counter_minmax(opt, val) : +val };
	}

	var output = [];
	var keys = Object.keys(tmp);
	for (var i = 0, length = keys.length; i < length; i++)
		output.push(tmp[keys[i]]);
	return output;
}

function counter_parse_years_all(output, value, year, opt) {
	var arr = value.trim().split(';');
	for (var i = 1, length = arr.length; i < length; i++) {

		var val = arr[i].substring(5);

		if (!output[year]) {
			output[year] = opt.type2 ? counter_minmax(opt, val) : +val;
			continue;
		}

		switch (opt.type2 || opt.type) {
			case 'max':
				var a = counter_minmax(opt, val);
				if (output[year] < a)
					output[year] = a;
				break;
			case 'min':
				var a = counter_minmax(opt, val);
				if (output[year] > a)
					output[year] = a;
				break;
			case 'sum':
				output[year] += +val;
				break;
		}
	}
}

function counter_parse_months_all(output, value, year, opt) {
	var arr = value.trim().split(';');

	for (var i = 1, length = arr.length; i < length; i++) {
		var val = arr[i].substring(5);
		var key = year + arr[i].substring(0, 2);

		if (!output[key]) {
			output[key] = opt.type2 ? counter_minmax(opt, val) : +val;
			continue;
		}

		switch (opt.type2 || opt.type) {
			case 'max':
				var a = counter_minmax(opt, val);
				if (output[year] < a)
					output[year] = a;
				break;
			case 'min':
				var a = counter_minmax(opt, val);
				if (output[year] > a)
					output[year] = a;
				break;
			case 'sum':
				output[key] += +val;
				break;
		}
	}
}

function counter_parse_days_all(output, value, year, opt) {
	var arr = value.trim().split(';');
	for (var i = 1, length = arr.length; i < length; i++) {
		var val = arr[i].substring(5);
		var key = year + arr[i].substring(0, 4);

		if (!output[key]) {
			output[key] = opt.type2 ? counter_minmax(opt, val) : +val;
			continue;
		}

		switch (opt.type2 || opt.type) {
			case 'max':
				var a = counter_minmax(opt, val);
				if (output[year] < a)
					output[year] = a;
				break;
			case 'min':
				var a = counter_minmax(opt, val);
				if (output[year] > a)
					output[year] = a;
				break;
			case 'sum':
				output[key] += +val;
				break;
		}
	}
}

Counter.prototype.save = function() {

	var self = this;
	self.db.readonly && self.db.throwReadonly();

	if (self.type) {
		setTimeout(() => self.save(), 200);
		return self;
	}

	var filename = self.db.filename + EXTENSION_COUNTER;
	var reader = Fs.createReadStream(filename);
	var writer = Fs.createWriteStream(filename + '-tmp');
	var dt = F.datetime.format('MMdd') + '=';
	var cache = self.cache;
	var counter = 0;

	self.cache = null;
	self.type = 1;

	var flush = function() {
		var keys = Object.keys(cache);
		for (var i = 0, length = keys.length; i < length; i++) {
			var item = cache[keys[i]];
			if (item != null) {
				var val = (item instanceof Array ? (item[0] + 'X' + item[1]) : item);
				writer.write(keys[i] + '=' + val + ';' + dt + val + NEWLINE);
				counter++;
			}
		}
		writer.end();
	};

	reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value, index) {

		var id = value.substring(0, value.indexOf('='));
		var count = cache[id];

		if (count === null)
			return;

		if (count === undefined) {
			writer.write(value);
			return;
		}

		// 0 === typeYEARid=COUNT
		// N === MMdd=COUNT

		var arr = value.trim().split(';');
		var is = false;
		var index = arr[0].indexOf('=');
		var type = id.substring(0, 3);

		// Update summarization
		switch (type) {
			case 'mma': // min, max, avg
				var tmp = arr[0].substring(index + 1);
				var tmpi = tmp.indexOf('X');
				COUNTER_MMA[0] = +tmp.substring(0, tmpi);
				COUNTER_MMA[1] = +tmp.substring(tmpi + 1);
				if (COUNTER_MMA[0] > count[0]) // min
					COUNTER_MMA[0] = count[0];
				if (COUNTER_MMA[1] < count[1]) // max
					COUNTER_MMA[1] = count[1];
				arr[0] = arr[0].substring(0, index + 1) + COUNTER_MMA[0] + 'X' + COUNTER_MMA[1];
				break;
			case 'max':
				arr[0] = arr[0].substring(0, index + 1) + Math.max(+arr[0].substring(index + 1), count);
				break;
			case 'min':
				arr[0] = arr[0].substring(0, index + 1) + Math.min(+arr[0].substring(index + 1), count);
				break;
			case 'sum':
				arr[0] = arr[0].substring(0, index + 1) + (+arr[0].substring(index + 1) + count);
				break;
		}

		for (var i = 1, length = arr.length; i < length; i++) {

			var item = arr[i];
			var curr = item.substring(0, 5); // MMdd

			if (curr === dt) {
				is = true;
				switch (type) {
					case 'mma':
						var tmp = item.substring(5);
						var tmpi = tmp.indexOf('X');
						COUNTER_MMA[0] = +tmp.substring(0, tmpi);
						COUNTER_MMA[1] = +tmp.substring(tmpi + 1);
						if (COUNTER_MMA[0] > count[0]) // min
							COUNTER_MMA[0] = count[0];
						if (COUNTER_MMA[1] < count[1]) // max
							COUNTER_MMA[1] = count[1];
						arr[i] = curr + COUNTER_MMA[0] + 'X' + COUNTER_MMA[1];
						break;
					case 'sum':
						arr[i] = curr + (+item.substring(5) + count);
						break;
				}
				break;
			}
		}

		cache[id] = undefined;
		!is && arr.push(dt + (count instanceof Array ? (count[0] + 'X' + count[1]) : count));
		writer.write(arr.join(';') + NEWLINE);
		counter++;
	}));

	reader.on('error', flush);
	reader.on('end', flush);

	CLEANUP(writer, function() {
		Fs.rename(filename + '-tmp', filename, function() {
			clearTimeout(self.timeout);
			self.timeout = 0;
			self.type = 0;
			counter && self.$events.stats && setImmediate(() => self.emit('stats', counter));
		});
	});

	return self;
};

Counter.prototype.clear = function(callback) {
	var self = this;

	if (self.type) {
		setTimeout(() => self.clear(callback), 200);
		return self;
	}

	self.type = 3;

	Fs.unlink(self.db.filename + EXTENSION_COUNTER, function() {
		self.type = 0;
		self.emit('clear');
		callback && callback();
	});

	return self;
};

function Binary(db, directory) {
	this.db = db;
	this.directory = directory;
	this.exists = false;
	this.$events = {};
}

Binary.prototype.emit = function(name, a, b, c, d, e, f, g) {
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

Binary.prototype.on = function(name, fn) {

	if (!fn.$once)
		this.db.$free = false;

	if (this.$events[name])
		this.$events[name].push(fn);
	else
		this.$events[name] = [fn];
	return this;
};

Binary.prototype.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

Binary.prototype.removeListener = function(name, fn) {
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

Binary.prototype.removeAllListeners = function(name) {
	if (name === true)
		this.$events = EMPTYOBJECT;
	else if (name)
		this.$events[name] = undefined;
	else
		this.$events = {};
	return this;
};

Binary.prototype.insert = function(name, buffer, callback) {

	var self = this;
	var type = framework_utils.getContentType(framework_utils.getExtension(name));
	var isfn = typeof(buffer) === 'function';

	if (isfn || !buffer) {

		if (isfn) {
			callback = buffer;
			buffer = undefined;
		}

		var reader = Fs.createReadStream(name);
		CLEANUP(reader);
		return self.insert_stream(null, framework_utils.getName(name), type, reader, callback);
	}

	if (typeof(buffer) === 'string')
		buffer = framework_utils.createBuffer(buffer, 'base64');
	else if (buffer.resume)
		return self.insert_stream(null, name, type, buffer, callback);

	var size = buffer.length;
	var dimension;
	var ext = framework_utils.getExtension(name);

	self.check();

	switch (ext) {
		case 'gif':
			dimension = framework_image.measureGIF(buffer);
			break;
		case 'png':
			dimension = framework_image.measurePNG(buffer);
			break;
		case 'jpg':
		case 'jpeg':
			dimension = framework_image.measureJPG(buffer);
			break;
		case 'svg':
			dimension = framework_image.measureSVG(buffer);
			break;
	}

	if (!dimension)
		dimension = { width: 0, height: 0 };

	var h = { name: name, size: size, type: type, width: dimension.width, height: dimension.height, created: F.created };
	var header = framework_utils.createBufferSize(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify(h));

	var id = F.datetime.format('yyMMddHHmm') + 'T' + framework_utils.GUID(5);
	var key = self.db.name + '#' + id;
	var stream = Fs.createWriteStream(Path.join(self.directory, key + EXTENSION_BINARY));

	stream.write(header, 'binary');
	stream.end(buffer);
	CLEANUP(stream);
	callback && callback(null, id, h);
	self.$events.insert && self.emit('insert', id, h);
	return id;
};

Binary.prototype.insert_stream = function(id, name, type, stream, callback) {

	var self = this;
	self.check();

	var h = { name: name, size: 0, type: type, width: 0, height: 0 };
	var header = framework_utils.createBufferSize(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify(h));

	if (!id)
		id = F.datetime.format('yyMMddHHmm') + 'T' + framework_utils.GUID(5);

	var key = self.db.name + '#' + id;
	var writer = Fs.createWriteStream(framework_utils.join(self.directory, key + EXTENSION_BINARY));

	writer.write(header, 'binary');
	stream.pipe(writer);
	CLEANUP(writer);
	callback && callback(null, id, h);
	self.$events.insert && self.emit('insert', id, h);
	return id;
};

Binary.prototype.update = function(id, name, buffer, callback) {

	var type = framework_utils.getContentType(framework_utils.getExtension(name));
	var isfn = typeof(buffer) === 'function';
	if (isfn || !buffer) {

		if (isfn) {
			callback = buffer;
			buffer = undefined;
		}

		var reader = Fs.createReadStream(name);
		CLEANUP(reader);
		return self.insert_stream(id, framework_utils.getName(name), type, reader, callback);
	}

	if (typeof(buffer) === 'string')
		buffer = framework_utils.createBuffer(buffer, 'base64');

	if (buffer.resume)
		return this.insert_stream(id, name, type, buffer, callback);

	var self = this;
	var size = buffer.length;
	var dimension;
	var ext = framework_utils.getExtension(name);

	self.check();

	switch (ext) {
		case 'gif':
			dimension = framework_image.measureGIF(buffer);
			break;
		case 'png':
			dimension = framework_image.measurePNG(buffer);
			break;
		case 'jpg':
		case 'jpeg':
			dimension = framework_image.measureJPG(buffer);
			break;
		case 'svg':
			dimension = framework_image.measureSVG(buffer);
			break;
	}

	if (!dimension)
		dimension = { width: 0, height: 0 };

	var h = { name: name, size: size, type: type, width: dimension.width, height: dimension.height, created: F.datetime };
	var header = framework_utils.createBufferSize(BINARY_HEADER_LENGTH);
	var key = self.db.name + '#' + id;

	header.fill(' ');
	header.write(JSON.stringify(h));

	var stream = Fs.createWriteStream(framework_utils.join(self.directory, key + EXTENSION_BINARY));
	stream.write(header, 'binary');
	stream.end(buffer);
	CLEANUP(stream);
	callback && callback(null, id, h);
	self.$events.insert && self.emit('insert', id, h);
	return id;
};

Binary.prototype.read = function(id, callback) {

	var self = this;

	self.check();

	if (id.indexOf('#') === -1)
		id = self.db.name + '#' + id;

	var filename = framework_utils.join(self.directory, id + EXTENSION_BINARY);
	var stream = Fs.createReadStream(filename, { start: 0, end: BINARY_HEADER_LENGTH - 1, encoding: 'binary' });

	stream.on('error', err => callback(err));
	stream.on('data', function(buffer) {
		var json = framework_utils.createBuffer(buffer, 'binary').toString('utf8').replace(REG_CLEAN, '');
		stream = Fs.createReadStream(filename, { start: BINARY_HEADER_LENGTH });
		callback(null, stream, JSON.parse(json, jsonparser));
		CLEANUP(stream);
	});

	return self;
};

Binary.prototype.remove = function(id, callback) {

	var self = this;
	var key = id;

	self.check();

	if (key.indexOf('#') === -1)
		key = self.db.name + '#' + key;

	var filename = framework_utils.join(self.directory, key + EXTENSION_BINARY);
	Fs.unlink(filename, (err) => callback && callback(null, err ? false : true));
	self.$events.remove && self.emit('remove', id);
	return self;
};

Binary.prototype.check = function() {

	var self = this;
	if (self.exists)
		return self;

	self.exists = true;

	try {
		Fs.mkdirSync(self.directory);
	} catch (err) {}

	return self;
};

Binary.prototype.clear = function(callback) {
	var self = this;

	Fs.readdir(self.directory, function(err, response) {

		if (err)
			return callback(err);

		var pending = [];
		var key = self.db.name + '#';
		var l = key.length;
		var target = framework_utils.join(self.directory);

		for (var i = 0, length = response.length; i < length; i++)
			response[i].substring(0, l) === key && pending.push(target + '/' + response[i]);

		self.$events.clear && self.emit('clear', pending.length);
		F.unlink(pending, callback);
	});

	return self;
};

Binary.prototype.all = function(callback) {
	var self = this;

	self.check();

	Fs.readdir(self.directory, function(err, response) {

		if (err)
			return callback(err, EMPTYARRAY);

		var pending = [];
		var key = self.db.name + '#';
		var l = key.length;

		for (var i = 0, length = response.length; i < length; i++)
			response[i].substring(0, l) === key && pending.push(response[i]);

		var target = framework_utils.join(self.directory);
		var output = [];
		var le = EXTENSION_BINARY.length;

		pending.wait(function(item, next) {
			Fs.stat(target + '/' + item, function(err, stat) {

				if (err)
					return next();

				var stream = Fs.createReadStream(target + '/' + item, { start: 0, end: BINARY_HEADER_LENGTH - 1, encoding: 'binary' });

				stream.on('data', function(buffer) {
					var json = framework_utils.createBuffer(buffer, 'binary').toString('utf8').replace(REG_CLEAN, '').parseJSON(true);
					if (json) {
						json.id = item.substring(l, item.length - le);
						json.ctime = stat.ctime;
						json.mtime = stat.mtime;
						output.push(json);
					}
				});

				CLEANUP(stream, next);

			});
		}, () => callback(null, output), 2);
	});

	return self;
};

function Indexes(db, directory) {
	this.db = db;
	this.directory = directory;
	this.indexes = [];
	this.changes = [];
	this.flushing = false;
	this.instances = {};
	this.reindexing = false;
}

Indexes.prototype.create = function(name, properties, type) {

	if (typeof(properties) === 'string') {
		type = properties;
		properties = null;
	}

	!this.indexes.findItem('name', name) && this.indexes.push({ name: name, properties: properties ? properties : [name], type: type });
	return this;
};

Indexes.prototype.$index = function(index, value) {

	var key = '';
	var number = false;
	var num = value.length > 1 ?  2 : 3;

	for (var i = 0; i < value.length; i++) {
		var val = value[i];

		switch (typeof(val)) {
			case 'number':
				if (index.type === 'reverse') {
					val = val.toString();
					val = val.substring(val.length - num).padLeft(num);
				} else
					val = val.toString().substring(0, num).padLeft(num);
				number = true;
				break;
			case 'boolean':
				val = val ? '1' : '0';
				break;
			case 'string':
				if (REGNUMBER.test(val)) {
					val = +val;
					if (index.type === 'reverse') {
						val = val.toString();
						val = val.substring(val.length - num).padLeft(num);
					} else
						val = val.toString().substring(0, num).padLeft(num);
					number = true;
				} else {
					if (val.isUID()) {
						val = val.substring(4, 6) + val.substring(2, 4) + val.substring(0, 2);
						number = true;
					} else {
						val = val.toLowerCase().removeDiacritics().match(REGINDEXCHAR);
						if (val) {
							val = val.toString();
							if (index.type === 'reverse')
								val = val.substring(val.length - 2);
							else
								val = val.substring(0, 2);
						}
					}
				}
				break;
			case 'object':
				val = val instanceof Date ? (val.getFullYear().toString().substring(2) + val.format('MM')) : '';
				break;
		}

		if (val == null)
			continue;

		if (val)
			key += val;
	}

	return key ? (index.name + '_' + (number && value.length === 1 ? key : key)) : null;
};

Indexes.prototype.get = Indexes.prototype.read = function(name, value, callback) {

	var self = this;
	var index = self.indexes.findItem('name', name);

	if (!index) {
		callback(new Error('Index not found.'));
		return self;
	}

	if (!(value instanceof Array))
		value = [value];

	var key = self.$index(index, value);
	if (!key) {
		callback(new Error('Bad value for generating index.'));
		return self;
	}

	if (self.changes.length) {
		var change = self.findchanges(index, key, value);
		if (change) {
			callback(null, CLONE(change.doc));
			return self;
		}
	}

	if (self.instances[key]) {
		self.instances[key].PENDING++;
	} else {
		self.instances[key] = new Database(key, self.directory + key, true);
		self.instances[key].PENDING = 0;
	}

	var builder = self.instances[key].one();

	for (var i = 0; i < index.properties.length; i++)
		builder.where(index.properties[i], value[i]);

	builder.callback(function(err, response) {

		if (self.instances[key].PENDING)
			self.instances[key].PENDING--;
		else
			delete self.instances[key];

		callback(err, response);
	});

	return self;
};

Indexes.prototype.find = function(name, value) {

	var self = this;
	var index = self.indexes.findItem('name', name);

	if (!index)
		throw new Error('Index not found.');

	if (!(value instanceof Array))
		value = [value];

	var key = self.$index(index, value);
	if (!key)
		throw new Error('Bad value for generating index.');

	if (self.instances[key]) {
		self.instances[key].PENDING++;
	} else {
		self.instances[key] = new Database(key, self.directory + key, true);
		self.instances[key].PENDING = 0;
	}

	var builder = self.instances[key].find();

	builder.$done = function() {
		if (self.instances[key].PENDING)
			self.instances[key].PENDING--;
		else
			delete self.instances[key];
	};

	return builder;
};

Indexes.prototype.clear = function(callback) {
	var self = this;
	Fs.readdir(self.directory, function(err, files) {

		if (err) {
			callback();
			return;
		}

		files.wait(function(item, next) {
			Fs.unlink(Path.join(self.directory, item), next);
		}, callback);
	});
	return self;
};

Indexes.prototype.reindex = function(callback) {
	var self = this;

	if (self.reindexing) {
		callback(new Error('Reindex is running.'));
		return self;
	}

	self.reindexing = true;
	self.clear(function() {
		var chunker = U.chunker(self.db.name + '_reindex', 10000);
		self.db.streamer(function(doc) {
			chunker.write(doc);
		}, function(err, repository, count) {
			chunker.end();
			chunker.each(function(docs, next) {
				self.db.$events.indexing && self.db.emit('indexing', chunker.percentage, chunker.count);
				for (var i = 0; i < docs.length; i++)
					self.insert(docs[i], true);
				self.$reindexingnext = next;
			}, function() {
				self.reindexing = false;
				callback && callback(null, count);
			});
		});
	});

	return self;
};

Indexes.prototype.check = function() {

	var self = this;
	if (self.exists)
		return self;

	self.exists = true;

	try {
		Fs.mkdirSync(self.directory);
	} catch (err) {}

	return self;
};

Indexes.prototype.makeindex = function(index, doc) {

	var arr = [];

	for (var i = 0; i < index.properties.length; i++) {
		var val = doc[index.properties[i]];
		arr.push(val);
	}

	return arr;
};

Indexes.prototype.findchanges = function(index, key, values) {
	var self = this;
	for (var i = 0, length = self.changes.length; i < length; i++) {
		var item = self.changes[i];
		if (item.key !== key || item.value.length !== values.length)
			continue;

		var is = true;

		for (var j = 0; j < values.length; j++) {
			if (values[j] !== item.value[j]) {
				is = false;
				break;
			}
		}

		if (is)
			return item;
	}
};

Indexes.prototype.insert = function(doc, reindex) {

	var self = this;

	for (var i = 0; i < self.indexes.length; i++) {

		var index = self.indexes[i];
		var values = self.makeindex(index, doc);

		if (values.length) {
			var key = self.$index(index, values);
			if (!key)
				continue;

			if (!reindex) {
				var item = self.findchanges(index, key, values);
				if (item) {
					item.doc = doc;
					return self;
				}
			}

			self.changes.push({ insert: true, key: key, doc: doc, name: index.name, value: values });
		}
	}

	self.changes.length && self.flush();
	return self;
};

Indexes.prototype.update = function(doc, old) {
	var self = this;

	for (var i = 0; i < self.indexes.length; i++) {

		var index = self.indexes[i];
		var values = self.makeindex(index, doc);

		if (values.length) {
			var key = self.$index(index, values);
			if (!key)
				continue;
			var item = self.findchanges(index, key, values);
			if (item)
				item.doc = doc;
			else {
				var oldvalues = self.makeindex(index, old);
				var oldkey = self.$index(index, oldvalues);
				self.changes.push({ update: true, key: key, doc: doc, name: index.name, properties: index.properties, value: values });
				if (oldkey !== key && oldkey)
					self.changes.push({ remove: true, key: oldkey, name: index.name, properties: index.properties, value: oldvalues });
			}
		}
	}

	self.changes.length && self.flush();
	return self;
};


Indexes.prototype.remove = function(doc) {
	var self = this;

	for (var i = 0; i < self.indexes.length; i++) {

		var index = self.indexes[i];
		var values = self.makeindex(index, doc);

		if (values.length) {
			var key = self.$index(index, values);
			if (!key)
				continue;

			var item = self.findchanges(index, key, values);
			if (!item)
				self.changes.push({ remove: true, key: key, name: index.name, properties: index.properties, value: values });
		}
	}

	self.changes.length && self.flush();
	return self;
};

Indexes.prototype.flush = function() {

	var self = this;

	if (self.flushing)
		return self;

	self.check();
	self.flushing = true;

	var count = 0;

	var fn = function() {

		if (count > 0)
			return;

		self.flushing = false;
		self.$free();

		if (!self.changes.length) {
			if (self.$reindexingnext) {
				self.$reindexingnext();
				self.$reindexingnext = null;
			}
		}

		self.changes.length && setImmediate(() => self.flush());
	};

	var arr = self.changes.splice(0);

	for (var i = 0; i < arr.length; i++) {

		var item = arr[i];

		if (self.instances[item.key]) {
			self.instances[item.key].PENDING++;
		} else {
			self.instances[item.key] = new Database(item.key, self.directory + item.key, true);
			self.instances[item.key].PENDING = 0;
		}

		if (item.update) {
			count++;
			var builder = self.instances[item.key].update(item.doc, item.doc).callback(function() {
				if (self.instances[item.key].PENDING)
					self.instances[item.key].PENDING--;
				count--;
				fn();
			});

			for (var j = 0; j < item.properties.length; j++)
				builder.where(item.properties[j], item.value[j]);

		} else if (item.insert) {
			count++;
			self.instances[item.key].insert(item.doc).callback(function() {
				if (self.instances[item.key].PENDING)
					self.instances[item.key].PENDING--;
				count--;
				fn();
			});

		} else {
			count++;
			var builder = self.instances[item.key].remove().callback(function() {
				if (self.instances[item.key].PENDING)
					self.instances[item.key].PENDING--;
				count--;
				fn();
			});

			for (var j = 0; j < item.properties.length; j++)
				builder.where(item.properties[j], item.value[j]);
		}
	}
};

Indexes.prototype.$free = function() {
	var self = this;
	var keys = Object.keys(self.instances);
	for (var i = 0; i < keys.length; i++) {
		var db = self.instances[keys[i]];
		if (!db && db.PENDING)
			delete self.instances[keys[i]];
	}
	return self;
};

function Storage(db, directory) {
	this.db = db;
	this.directory = directory;
	this.pending = [];
	this.locked_writer = 0;
	this.locked_reader = false;
	this.exists = false;
	if (!FORK) {
		this.$mapreducefile = Path.join(db.directory, db.name + EXTENSION_MAPREDUCE);
		this.$mapreduce = [];
		this.refresh();
	}
}

Storage.prototype.refresh = function() {
	try {
		this.$mapreduce = Fs.readFileSync(this.$mapreducefile).toString('utf8').parseJSON(true);
	} catch (e) {}
	return this;
};

Storage.prototype.check = function() {

	var self = this;
	if (self.exists)
		return self;

	self.exists = true;

	try {
		Fs.mkdirSync(self.directory);
	} catch (err) {}

	return self;
};

Storage.prototype.insert = function(doc) {

	var self = this;

	if (doc == null) {
		if (self.pending.length) {
			var dt = F.datetime.format('yyyyMMdd');
			self.locked_reader = true;
			self.check();
			Fs.appendFile(self.db.filenameStorage.format(dt), self.pending.join(NEWLINE) + NEWLINE, function(err) {
				err && F.error(err, 'NoSQL storage insert: ' + self.db.name);
				self.locked_reader = false;
			});
			self.pending = [];
		}
		return self;
	}

	self.locked_reader = true;

	if (self.$mapreduce.length) {
		for (var i = 0, length = self.$mapreduce.length; i < length; i++) {
			var mr = self.$mapreduce[i];
			mr.ready && mr.reduce(doc, mr.repository);
		}
		self.$mapreducesave();
	}

	if (self.locked_writer) {
		self.pending.push(JSON.stringify(doc));
		return self;
	}

	self.check();
	self.locked_writer = true;
	Fs.appendFile(self.db.filenameStorage.format(F.datetime.format('yyyyMMdd')), JSON.stringify(doc) + NEWLINE, function(err) {
		self.locked_writer = false;
		self.locked_reader = false;
		self.pending.length && self.insert();
		err && F.error(err, 'NoSQL storage insert: ' + self.db.name);
	});

	return self;
};

Storage.prototype.stats = function(name, fn) {
	if (fn == null) {
		var obj = {};
		for (var i = 0; i < this.$mapreduce.length; i++) {
			var item = this.$mapreduce[i];
			obj[item.name] = FORK ? item.repository : U.clone(item.repository);
		}
		name(null, obj);
	} else {
		var item = this.$mapreduce.findItem('name', name);
		fn(item ? null : new Error('Stats of MapReduce "{0}" not found.'.format(name)), item ? (FORK ? item.repository : CLONE(item.repository)) : null);
	}
	return this;
};

Storage.prototype.mapreduce = function(name, fn, def) {

	var self = this;

	if (!self.$mapreduce)
		self.$mapreduce = [];

	var item = self.$mapreduce.findItem('name', name);

	if (item) {
		item.reduce = fn;
	} else {
		item = {};
		item.name = name;
		item.repository = def || {};
		item.reduce = fn;
		item.ready = false;
		self.$mapreduce.push(item);
	}

	// Scan storage for this new mapreduce record
	!item.ready && self.scan(item.reduce, function(err, repository) {
		item.repository = repository;
		item.ready = true;
		self.$mapreducesave();
	}, true);

	return self;
};

Storage.prototype.$mapreducesave = function() {
	var self = this;
	Fs.writeFile(self.$mapreducefile, JSON.stringify(self.$mapreduce, (k, v) => k !== 'reduce' ? v : undefined), F.error());
	return self;
};

Storage.prototype.listing = function(beg, end, callback) {

	var tmp;
	if (beg) {

		if (typeof(beg) === 'string') {
			beg = beg.toString().split('-');
			if (beg[1] && beg[1].length < 2)
				beg[1] = '0' + beg[1];
			if (beg[2] && beg[2].length < 2)
				beg[2] = '0' + beg[2];
			beg = +beg.join('');
		}

		tmp = beg.toString().length;
		if (tmp === 4)
			beg *= 10000;
		else if (tmp === 6)
			beg *= 100;
	}

	if (end) {

		if (typeof(end) === 'string') {
			end = end.toString().split('-');
			if (end[1] && end[1].length < 2)
				end[1] = '0' + end[1];
			if (end[2] && end[2].length < 2)
				end[2] = '0' + end[2];
			end = +end.join('');
		}

		tmp = end.toString().length;
		if (tmp === 4)
			end *= 10000;
		else if (tmp === 6)
			end *= 100;
	}

	var self = this;

	U.ls(self.directory, function(files) {
		var storage = [];
		for (var i = 0, length = files.length; i < length; i++) {
			var item = files[i];
			var skip = item.length - EXTENSION.length;
			var date = +item.substring(skip - 8, skip);
			if ((beg && beg > date) || (end && end < date))
				continue;
			storage.push({ filename: item, date: date });
		}
		callback(null, storage);
	}, (path, is) => is ? false : path.endsWith(EXTENSION));

	return self;
};

Storage.prototype.scan = function(beg, end, mapreduce, callback, reverse) {
	var self = this;

	if (typeof(beg) === 'function') {
		reverse = mapreduce;
		mapreduce = beg;
		callback = end;
		beg = null;
		end = null;
	} else if (typeof(end) === 'function') {
		reverse = callback;
		callback = mapreduce;
		mapreduce = end;
		end = null;
	}

	if (typeof(callback) === 'boolean') {
		reverse = callback;
		callback = null;
	}

	self.listing(beg, end, function(err, storage) {

		var repository = {};
		var stats = {};

		// Desc
		storage.quicksort('date', reverse == true);

		stats.files = storage.length;
		stats.documents = 0;
		stats.duration = Date.now();
		stats.processed = 0;
		stats.canceled = false;

		var today = +F.datetime.format('yyyyMMdd');
		var process = function(item, next, index) {

			if (self.locked_read) {
				setTimeout(process, 100, item, next, index);
				return;
			}

			var reader = Fs.createReadStream(item.filename);
			stats.current = item.date;
			stats.index = index;

			var buf = '[';
			var bufcount = 0;
			var canceled = false;

			var processing = function(docs) {
				for (var j = 0; j < docs.length; j++) {
					stats.documents++;
					var json = docs[j];
					var end = mapreduce(json, repository, stats) === false;
					if (end) {
						canceled = true;
						return;
					}
				}
			};

			reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value) {

				if (value[0] !== '{')
					return;

				buf += (bufcount ? ',' : '') + value.substring(0, value.length - 1);
				bufcount++;

				if (bufcount % JSONBUFFER === 0) {
					bufcount = 0;
					processing(JSON.parse(buf + ']', jsonparser));
					buf = '[';
				}

				if (canceled) {
					stats.canceled = true;
					reader.destroy && reader.destroy();
					return false;
				}

			}));

			var finish = function() {

				if (bufcount) {
					bufcount = 0;
					processing(JSON.parse(buf + ']', jsonparser));
					buf = null;
				}

				stats.processed++;

				if (item.date === today) {
					self.locked_writer--;
					if (self.locked_writer <= 0 && self.pending.length)
						self.insert();
				}

				setImmediate(next);
			};

			reader.on('error', finish);

			if (reader)
				CLEANUP(reader, finish);
			else
				finish();
		};

		storage.wait(function(item, next, index) {
			if (stats.canceled) {
				setImmediate(next);
			} else {

				if (item.date === today) {
					if (self.locked_read) {
						setTimeout(process, 100, item, next, index);
						return;
					}
				}

				if (item.date === today)
					self.locked_writer++;

				process(item, next, index);
			}
		}, function() {
			stats.duration = Date.now() - stats.duration;
			callback && callback(null, repository, stats);
		});

	});

	return self;
};

Storage.prototype.clear = function(beg, end, callback) {
	var self = this;

	if (typeof(beg) === 'function') {
		callback = end;
		beg = null;
		end = null;
	} else if (typeof(end) === 'function') {
		callback = end;
		end = null;
	}

	self.listing(beg, end, function(err, files) {

		var count = 0;

		var remove = function(filename, callback, attemp) {
			Fs.unlink(filename, function(err) {
				if (err) {
					if (err.toString().indexOf('no such file') === -1) {
						if (attemp > 5)
							callback();
						else
							setTimeout(() => remove(filename, callback, (attemp || 0) + 1), 100);
					} else
						callback();
				} else {
					count++;
					callback();
				}
			});
		};

		files.wait((filename, next) => remove(filename, next), function() {
			remove(self.$mapreducefile, () => callback && callback(null, count));
		});

	});
	return self;
};

function Backuper(filename) {
	this.filename = filename;
	this.items = [];
	this.is = false;
	this.callback;
}

Backuper.prototype.write = function(value) {
	this.items.push(value);
	this.flush();
	return this;
};

Backuper.prototype.flush = function() {
	var self = this;

	if (self.is)
		return self;

	if (!self.items.length)
		return self;

	var value = self.items.join('');
	self.is = true;

	Fs.appendFile(self.filename, value, function() {
		self.is = false;
		self.flush();
	});

	self.items = [];
	return self;
};

// ======================================================
// Helper functions
// ======================================================

function compare_datetype(type, key, arg, operator) {

	// 0 doc
	// 1 arg
	// 2 operator
	// 3 type

	key = 'doc.' + key;
	arg = 'arg.' + arg;

	switch (operator) {
		case '=':
			operator = '==';
			break;
		case '<>':
			operator = '!=';
			break;
	}

	switch (type) {
		case 'day':
			type = 'getDate()';
			break;
		case 'month':
			type = 'getMonth()+1';
			break;
		case 'year':
			type = 'getFullYear()';
			break;
	}

	return '$is=false;$tmp={0};if($tmp){if(!$tmp.getTime){$tmp=new Date($tmp);if(isNaN($tmp))$tmp=0;}if($tmp)$is=($tmp.{3}){2}{1};}'.format(key, arg, operator, type);
}

function errorhandling(err, builder, response) {
	if (err)
		return err;
	var is = response instanceof Array;
	if (!response || (is && !response.length))
		return builder.$callback_emptyerror ? new ErrorBuilder().push(builder.$callback_emptyerror) : null;
	return null;
}

function jsonparser(key, value) {
	return typeof(value) === 'string' && value.isJSONDate() ? new Date(value) : value;
}
