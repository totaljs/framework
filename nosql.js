// Copyright 2012-2020 (c) Peter Širka <petersirka@gmail.com>
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
 * @version 3.4.4
 */

'use strict';

const Readable = require('stream').Readable;
const Fs = require('fs');
const Path = require('path');
const NoSQLStream = require('./nosqlstream');
const REG_FIELDS_CLEANER = /"|`|\||'|\s/g;

if (!global.framework_utils)
	global.framework_utils = require('./utils');

if (!global.framework_image)
	global.framework_image = require('./image');

if (!global.framework_nosql)
	global.framework_nosql = exports;

if (!global.framework_builders)
	global.framework_builders = require('./builders');

const EXTENSION = '.nosql';
const EXTENSION_TABLE = '.table';
const EXTENSION_TABLE_BACKUP = '.table-backup';
const EXTENSION_BINARY = '.nosql-binary';
const EXTENSION_LOG = '.nosql-log';
const EXTENSION_MAPREDUCE = '.nosql-mapreduce';
const EXTENSION_BACKUP = '.nosql-backup';
const EXTENSION_META = '.meta';
const EXTENSION_COUNTER = '-counter2';
const BINARY_HEADER_LENGTH = 2000;
const COUNTER_MMA = [0, 0];
const DIRECTORYLENGTH = 9;
const FLAGS_READ = ['get'];
const INMEMORY = {};
const JSONBOOL = '":true ';
const NEWLINE = '\n';
const REGBOOL = /":true/g; // for updates of boolean types
const REGCHINA = /[\u3400-\u9FBF]/;
const REGCLEAN = /^[\s]+|[\s]+$/g;
const REGTESCAPE = /\||\n|\r/g;
const REGTUNESCAPE = /%7C|%0D|%0A/g;
const REGTESCAPETEST = /\||\n|\r/;
const IMAGES = { gif: 1, jpg: 1, jpeg: 1, png: 1, svg: 1 };
const BINARYREADDATA = { start: BINARY_HEADER_LENGTH };
const BINARYREADDATABASE64 = { start: BINARY_HEADER_LENGTH, encoding: 'base64' };
const BINARYREADMETA = { start: 0, end: BINARY_HEADER_LENGTH - 1, encoding: 'binary' };
const BOOLEAN = { '1': 1, 'true': 1, 'on': 1 };
const TABLERECORD = { '+': 1, '-': 1, '*': 1 };
const CLUSTERMETA = {};
const UNKNOWN = 'unknown';
const MKDIR = { recursive: true };

const COMPARER = global.Intl ? global.Intl.Collator().compare : function(a, b) {
	return a.removeDiacritics().localeCompare(b.removeDiacritics());
};

const NEWLINEBUF = Buffer.from('\n', 'utf8');
const CACHE = {};

var JSONBUFFER = process.argv.findIndex(n => n.endsWith('nosqlworker.js')) === -1 ? 20 : 40;
var FORK;
var FORKCALLBACKS;

function clusterlock(db, method) {
	Fs.open(db.filenameLock, 'wx', function(err, fd) {

		if (err) {
			setTimeout(clusterlock, 100, db, method);
			return;
		}

		Fs.write(fd, F.id.toString(), function(err) {
			err && F.error('NoSQLStream.lock.write()', err);
			Fs.close(fd, function(err) {
				err && F.error('NoSQLStream.lock.close()', err);
				db.locked = true;
				db[method]();
			});
		});
	});
}

function clusterunlock(db) {
	if (db.locked) {
		db.locked = false;
		Fs.unlink(db.filenameLock, NOOP);
	}
}

function promise(fn) {
	var self = this;
	return new Promise(function(resolve, reject) {
		self.callback(function(err, result) {
			if (err)
				reject(err);
			else
				resolve(fn == null ? result : fn(result));
		});
	});
}

exports.kill = function(signal) {
	FORK && TRY(() => FORK && FORK.kill && FORK.kill(signal || 'SIGTERM'));
};

exports.pid = function() {
	return FORK ? FORK.pid : 0;
};

exports.worker = function() {

	if (FORK || F.isCluster)
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
							item.builder && item.builder.$callback && item.builder.$callback(err, EMPTYOBJECT, EMPTYOBJECT);
							break;
						case 'clean':
						case 'clear':
							item.callback && item.callback(err);
							break;
						case 'stream':
							item.callback && item.callback(err, EMPTYOBJECT, 0);
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
				obj && obj.builder.$callback && obj.builder.$callback(msg.err, msg.response, msg.repository);
				break;
			case 'remove':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.builder.$callback && obj.builder.$callback(msg.err, msg.response, msg.repository);
				break;
			case 'backup':
			case 'restore':
			case 'counter.read':
			case 'counter.stats':
			case 'counter.clear':
			case 'storage.stats':
			case 'storage.clear':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.callback && obj.callback(msg.err, msg.response);
				break;
			case 'stream':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.callback && obj.callback(msg.err, msg.repository || {}, msg.count);
				break;
			case 'storage.scan':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.callback && obj.callback(msg.err, msg.response, msg.repository);
				break;
			case 'callback':
				var obj = FORKCALLBACKS[msg.id];
				obj && obj.callback && obj.callback(msg.err);
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
		obj.t = instance instanceof Table;

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
		obj.t = instance instanceof Table;

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
		CMD.t = obj.t;
		if (callback !== false) {
			CMD.id = Math.random().toString(32).substring(2);
			FORKCALLBACKS[CMD.id] = obj;
		}
		FORK.send(CMD);
	}

	var DP = Database.prototype;
	var CP = Counter.prototype;
	var SP = Storage.prototype;

	TP.once = TP.on = TP.emit = TP.removeListener = TP.removeAllListeners = DP.once = DP.on = DP.emit = DP.removeListener = DP.removeAllListeners = CP.on = CP.once = CP.emit = CP.removeListener = CP.removeAllListeners = function() {
		PRINTLN('ERROR --> NoSQL events are not supported in fork mode.');
	};

	TP.listing = TP.list = DP.listing = DP.list = function(builder) {
		if (builder instanceof DatabaseBuilder)
			builder.db = this;
		else
			builder = new DatabaseBuilder(this);
		builder.$options.listing = true;
		builder.$take = builder.$options.take = 100;
		return send(this, 'find').builder = builder;
	};

	TP.find = DP.find = function(builder) {
		if (builder instanceof DatabaseBuilder)
			builder.db = this;
		else
			builder = new DatabaseBuilder(this);
		return send(this, 'find').builder = builder;
	};

	TP.find2 = DP.find2 = function(builder) {
		if (builder instanceof DatabaseBuilder)
			builder.db = this;
		else
			builder = new DatabaseBuilder(this);
		return send(this, 'find2').builder = builder;
	};

	TP.top = DP.top = function(max) {
		var builder = new DatabaseBuilder(this);
		builder.take(max);
		return send(this, 'find').builder = builder;
	};

	TP.one = DP.one = function() {
		var builder = new DatabaseBuilder(this);
		builder.first();
		return send(this, 'one').builder = builder;
	};

	TP.insert = DP.insert = function(doc, unique) {

		var self = this;
		var builder;

		if (doc.$$schema)
			doc = doc.$clean();

		if (unique) {
			builder = self.one();

			var callback;

			builder.callback(function(err, d) {
				if (d)
					callback && callback(null, 0);
				else {
					var tmp = self.insert(doc);
					tmp.callback(callback);
					tmp.$options.log = builder.$options.log;
				}
			});

			builder.callback = function(fn) {
				callback = fn;
				return builder;
			};

			return builder;
		}

		return send(self, 'insert', doc).builder = new DatabaseBuilder2(self);
	};

	TP.count = DP.count = function() {
		var builder = new DatabaseBuilder(this);
		return send(this, 'count').builder = builder;
	};

	DP.view = function() {
		throw new Error('NoSQL Views are not supported.');
	};

	TP.update = DP.update = function(doc, insert) {
		var val = doc.$$schema ? doc.$clean() : doc;
		if (typeof(val) === 'function')
			val = val.toString();
		return send(this, 'update', val, insert).builder = new DatabaseBuilder(this);
	};

	TP.modify = DP.modify = function(doc, insert) {
		var val = doc.$$schema ? doc.$clean() : doc;
		if (typeof(val) === 'function')
			val = val.toString();
		return send(this, 'modify', val, insert).builder = new DatabaseBuilder(this);
	};

	DP.restore = function(filename, callback) {
		var obj = send(this, 'restore', filename);
		obj.callback = callback;
		return this;
	};

	DP.backup = function(filename, callback) {
		var obj = send(this, 'backup', filename);
		obj.callback = callback;
		return this;
	};

	DP.refresh = function() {
		return this;
	};

	DP.drop = function() {
		notify(this, 'drop');
		return this;
	};

	TP.clear = DP.clear = function(callback) {
		send(this, 'clear').callback = callback;
		return this;
	};

	TP.clean = DP.clean = function(callback) {
		send(this, 'clean').callback = callback;
		return this;
	};

	TP.ready = DP.ready = function(callback) {
		callback && callback();
		return this;
	};

	TP.remove = DP.remove = function(filename) {
		return send(this, 'remove', filename).builder = new DatabaseBuilder(this);
	};

	TP.stream = DP.stream = function(fn, repository, callback) {

		if (typeof(repository) === 'function')  {
			callback = repository;
			repository = undefined;
		}

		send(this, 'stream', fn.toString(), repository).callback = callback;
		return this;
	};

	CP.min = function(id, count) {
		notify(this.db, 'counter.min', id, count);
		return this;
	};

	CP.max = function(id, count) {
		notify(this.db, 'counter.max', id, count);
		return this;
	};

	CP.sum = CP.inc = CP.hit = function(id, count) {
		notify(this.db, 'counter.hit', id, count);
		return this;
	};

	CP.remove = function(id) {
		notify(this.db, 'counter.remove', id);
		return this;
	};

	CP.read = function(options, callback) {
		send(this.db, 'counter.read', options).callback = callback;
		return this;
	};

	CP.stats = CP.stats_sum = function(top, year, month, day, type, callback) {

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

	CP.clear = function(callback) {
		send(this.db, 'counter.clear').callback = callback;
		return this;
	};

	SP.insert = function(doc) {
		notify(this.db, 'storage.insert', doc.$$schema ? doc.$clean() : doc);
		return this;
	};

	SP.scan = function(beg, end, mapreduce, callback) {

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

	SP.mapreduce = function(name, fn) {
		send(this.db, 'storage.mapreduce', name, fn);
		return this;
	};

	SP.stats = function(name, callback) {

		if (typeof(name) === 'function') {
			callback = name;
			name = undefined;
		}

		send(this.db, 'storage.stats', name).callback = callback;
		return this;
	};

	SP.clear = function(beg, end, callback) {

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
};

function Table(name, filename, readonly, specific) {
	var t = this;
	t.filename = readonly ? filename : filename + (specific ? '' : EXTENSION_TABLE);
	t.filenameBackup = readonly ? '' : filename + EXTENSION_TABLE_BACKUP;
	t.filenameCounter = readonly ? '' : filename + (specific ? '' : EXTENSION_TABLE) + EXTENSION_COUNTER;
	t.filenameMeta = readonly ? '' : filename + (specific ? '' : EXTENSION_TABLE) + '-meta';
	t.directory = Path.dirname(filename);
	t.filenameLock = t.filename + '-lock';
	t.name = name;
	t.$name = '$' + name;
	t.pending_reader = [];
	t.pending_reader2 = [];
	t.pending_update = [];
	t.pending_append = [];
	t.pending_reader = [];
	t.pending_remove = [];
	t.pending_streamer = [];
	t.pending_clean = [];
	t.pending_clear = [];
	t.pending_locks = [];
	t.$events = {};

	t.step = 0;
	t.ready = false;
	t.$free = true;
	t.$writting = false;
	t.$reading = false;
	t.$allocations = true;

	t.counter = readonly ? null : new Counter(t);
	t.$meta();

	var schema = CONF['table_' + name] || CONF['table.' + name];

	Fs.createReadStream(t.filename, { end: 1200 }).once('data', function(chunk) {

		if (schema) {
			t.parseSchema(schema.replace(/;|,/g, '|').trim().split('|'));
			schema = t.stringifySchema();
		}

		t.parseSchema(chunk.toString('utf8').split('\n', 1)[0].split('|'));
		t.ready = true;

		if (schema && t.stringifySchema() !== schema) {
			t.$header = Buffer.byteLength(t.stringifySchema()) + 1;
			t.extend(schema);
		} else
			t.$header = Buffer.byteLength(schema ? schema : t.stringifySchema()) + 1;

		t.next(0);

	}).on('error', function(e) {
		if (schema) {
			t.parseSchema(schema.replace(/;|,/g, '|').trim().split('|'));
			var bschema = t.stringifySchema();
			t.$header = Buffer.byteLength(bschema) + 1;
			Fs.writeFileSync(t.filename, bschema + NEWLINE, 'utf8');
			t.ready = true;
			t.next(0);
		} else {
			t.readonly = true;
			t.pending_reader.length && (t.pending_reader = []);
			t.pending_update.length && (t.pending_update = []);
			t.pending_append.length && (t.pending_append = []);
			t.pending_reader.length && (t.pending_reader = []);
			t.pending_remove.length && (t.pending_remove = []);
			t.pending_streamer.length && (t.pending_streamer = []);
			t.pending_locks.length && (t.pending_locks = []);
			t.pending_clean.length && (t.pending_clean = []);
			t.pending_clear.length && (t.pending_clear = []);
			t.throwReadonly(e);
		}
	});
}

function Database(name, filename, readonly, specific) {

	var self = this;
	var http = filename.substring(0, 6);
	self.readonly = http === 'http:/' || http === 'https:';
	self.filename = self.readonly ? filename.format('') : readonly ? filename : filename + (specific ? '' : EXTENSION);
	self.directory = Path.dirname(filename);

	if (!readonly) {
		self.filenameLock = self.filename + '-lock';
		self.filenameCounter = self.readonly ? filename.format('counter', '-') : filename + (specific ? '' : EXTENSION) + EXTENSION_COUNTER;
		self.filenameLog = self.readonly || readonly ? '' : filename + EXTENSION_LOG;
		self.filenameBackup = self.readonly || readonly ? '' : filename + EXTENSION_BACKUP;
		self.filenameStorage = self.readonly || readonly ? '' : filename + '-storage/{0}' + (specific ? '' : EXTENSION);
		self.filenameMeta = filename + EXTENSION_META;
		self.filenameBackup2 = framework_utils.join(self.directory, name + '_backup' + (specific ? '' : EXTENSION));
		self.inmemory = {};
		self.inmemorylastusage;
		// self.metadata;
		self.$meta();
	}

	self.name = name;
	self.pending_update = [];
	self.pending_append = [];
	self.pending_reader = [];
	self.pending_remove = [];
	self.pending_reader2 = [];
	self.pending_streamer = [];
	self.pending_clean = [];
	self.pending_clear = [];
	self.pending_locks = [];
	self.step = 0;
	self.pending_drops = false;
	self.pending_reindex = false;
	self.binary = self.readonly || readonly ? null : new Binary(self, self.directory + '/' + self.name + '-binary/');
	self.storage = self.readonly || readonly ? null : new Storage(self, self.directory + '/' + self.name + '-storage/');
	self.counter = readonly ? null : new Counter(self);
	self.$timeoutmeta;
	self.$events = {};
	self.$free = true;
	self.$writting = false;
	self.$reading = false;
}

const TP = Table.prototype;
const DP = Database.prototype;

TP.memory = DP.memory = function(count, size) {
	var self = this;
	count && (self.buffercount = count + 1);      // def: 15 - count of stored documents in memory while reading/writing
	size && (self.buffersize = size * 1024);      // def: 32 - size of buffer in kB
	return self;
};

TP.view = DP.view = function() {
	throw new Error('NoSQL Views are not supported in this version.');
};

TP.emit = DP.emit = function(name, a, b, c, d, e, f, g) {
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

TP.on = DP.on = function(name, fn) {

	if (!fn.$once)
		this.$free = false;

	if (this.$events[name])
		this.$events[name].push(fn);
	else
		this.$events[name] = [fn];
	return this;
};

TP.once = DP.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

TP.removeListener = DP.removeListener = function(name, fn) {
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

TP.removeAllListeners = DP.removeAllListeners = function(name) {
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
exports.DatabaseStorage = Storage;
exports.DatabaseTable = Table;

exports.load = function(name, filename, specific) {
	return new Database(name, filename, undefined, specific);
};

exports.table = function(name, filename, specific) {
	return new Table(name, filename, undefined, specific);
};

exports.memory = exports.inmemory = function(name) {
	return INMEMORY[name] = true;
};

TP.get = DP.get = function(name) {
	return this.meta(name);
};

TP.set = DP.set = function(name, value) {
	return this.meta(name, value);
};

TP.meta = DP.meta = function(name, value, nosave) {
	var self = this;

	if (value === undefined)
		return self.metadata ? self.metadata[name] : undefined;

	if (!self.metadata)
		self.metadata = {};

	self.metadata[name] = value;
	clearTimeout(self.timeoutmeta);

	if (!nosave)
		self.timeoutmeta = setTimeout(() => self.$meta(true), 500);

	if (F.isCluster && !nosave) {
		CLUSTERMETA.ID = F.id;
		CLUSTERMETA.TYPE = (self instanceof Table ? 'table' : 'nosql') + '-meta';
		CLUSTERMETA.name = self.name;
		CLUSTERMETA.key = name;
		CLUSTERMETA.value = value;
		process.send(CLUSTERMETA);
	}

	return self;
};

TP.backups = DP.backups = function(filter, callback) {

	if (callback === undefined) {
		callback = filter;
		filter = null;
	}

	var self = this;
	var isTable = self instanceof Table;

	if (isTable && !self.ready) {
		setTimeout((self, filter, callback) => self.backups(filter, callback), 500, self, filter, callback);
		return self;
	}

	var stream = Fs.createReadStream(self.filenameBackup);
	var output = [];
	var tmp = {};

	tmp.keys = self.$keys;

	stream.on('data', U.streamer(NEWLINEBUF, function(item, index) {
		var end = item.indexOf('|', item.indexOf('|') + 2);
		var meta = item.substring(0, end);
		var arr = meta.split('|');
		var dv = arr[0].trim().replace(' ', 'T') + ':00.000Z';
		tmp.line = item.substring(end + 1).trim();
		if (isTable)
			tmp.line = tmp.line.split('|');
		var obj = { id: index + 1, date: dv.parseDate(), user: arr[1].trim(), data: self instanceof Table ? self.parseData(tmp) : tmp.line.parseJSON(true) };
		if (!filter || filter(obj))
			output.push(obj);
	}), stream);

	CLEANUP(stream, () => callback(null, output));

	return self;
};

function next_operation(self, type) {
	self.next(type);
}

DP.ready = function(fn) {
	var self = this;
	fn.call(self);
	return self;
};

DP.insert = function(doc, unique) {

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
	var json = doc.$$schema ? doc.$clean() : doc;
	self.pending_append.push({ doc: JSON.stringify(json).replace(REGBOOL, JSONBOOL), raw: doc, builder: builder });
	setImmediate(next_operation, self, 1);
	self.$events.insert && self.emit('insert', json);
	return builder;
};

DP.upsert = function(doc) {
	return this.insert(doc, true);
};

DP.update = function(doc, insert) {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	var data = doc.$$schema ? doc.$clean() : doc;
	builder.$options.readertype = 1;
	if (typeof(data) === 'string')
		data = new Function('doc', 'repository', 'arg', data.indexOf('return ') === -1 ? ('return (' + data + ')') : data);
	self.pending_update.push({ builder: builder, doc: data, insert: insert === true ? data : insert });
	setImmediate(next_operation, self, 2);
	return builder;
};

DP.modify = function(doc, insert) {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	var data = doc.$$schema ? doc.$clean() : doc;
	var keys = Object.keys(data);
	var inc = null;

	builder.$options.readertype = 1;

	if (keys.length) {
		var tmp;
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			switch (key[0]) {
				case '!':
				case '+':
				case '-':
				case '*':
				case '/':
					!inc && (inc = {});
					tmp = key.substring(1);
					inc[tmp] = key[0];
					doc[tmp] = doc[key];
					doc[key] = undefined;
					keys[i] = tmp;
					break;
				case '$':
					tmp = key.substring(1);
					doc[tmp] = new Function('val', 'doc', 'repository', 'arg', doc[key].indexOf('return ') === -1 ? ('return (' + doc[key] + ')') : doc[key]);
					doc[key] = undefined;
					keys[i] = tmp;
					break;
			}
		}
		self.pending_update.push({ builder: builder, doc: data, keys: keys, inc: inc, insert: insert === true ? data : insert });
		setImmediate(next_operation, self, 2);
	}

	return builder;
};

DP.restore = function(filename, callback) {
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
				self.binary.$refresh();
				self.refresh();
				self.storage && self.storage.refresh();
			}
			self.$events.change && self.emit('change', 'restore');
			callback && callback(err, response);
		});

	});
	return self;
};

DP.backup = function(filename, callback) {

	var self = this;
	self.readonly && self.throwReadonly();

	var list = [];
	var pending = [];

	pending.push(function(next) {
		F.path.exists(self.filename, function(e) {
			e && list.push(Path.join(CONF.directory_databases, self.name + EXTENSION));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(F.path.databases(self.name + EXTENSION_META), function(e) {
			e && list.push(Path.join(CONF.directory_databases, self.name + EXTENSION_META));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(self.filenameBackup, function(e) {
			e && list.push(Path.join(CONF.directory_databases, self.name + EXTENSION_BACKUP));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(self.filenameCounter, function(e) {
			e && list.push(Path.join(CONF.directory_databases, self.name + EXTENSION + EXTENSION_COUNTER));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(self.filenameLog, function(e) {
			e && list.push(Path.join(CONF.directory_databases, self.name + EXTENSION_LOG));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(F.path.databases(self.name + '-binary'), function(e, size, file) {
			e && !file && list.push(Path.join(CONF.directory_databases, self.name + '-binary'));
			next();
		});
	});

	pending.push(function(next) {
		F.path.exists(F.path.databases(self.name + '-storage'), function(e, size, file) {
			e && !file && list.push(Path.join(CONF.directory_databases, self.name + '-storage'));
			next();
		});
	});

	pending.push(function(next) {
		var filename = Path.join(CONF.directory_databases, self.name + EXTENSION_MAPREDUCE);
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

DP.backup2 = function(filename, remove) {

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

DP.drop = function() {
	var self = this;
	self.readonly && self.throwReadonly();
	self.pending_drops = true;
	setImmediate(next_operation, self, 7);
	return self;
};

DP.free = function(force) {
	var self = this;
	if (!force && !self.$free)
		return self;
	self.counter.removeAllListeners(true);
	self.binary.removeAllListeners(true);
	self.removeAllListeners(true);
	self.binary = null;
	self.counter = null;
	delete F.databases[self.name];
	return self;
};

DP.release = function() {
	var self = this;
	self.inmemory = {};
	self.inmemorylastusage = undefined;
	return self;
};

TP.clear = DP.clear = function(callback) {
	var self = this;
	self.readonly && self.throwReadonly();
	self.pending_clear.push(callback || NOOP);
	setImmediate(next_operation, self, 12);
	return self;
};

TP.clean = DP.clean = function(callback) {
	var self = this;
	self.readonly && self.throwReadonly();
	self.pending_clean.push(callback || NOOP);
	setImmediate(next_operation, self, 13);
	return self;
};

TP.lock = DP.lock = function(callback) {
	var self = this;
	self.readonly && self.throwReadonly();
	self.pending_locks.push(callback || NOOP);
	setImmediate(next_operation, self, 14);
	return self;
};

DP.remove = function() {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	self.pending_remove.push(builder);
	builder.$options.readertype = 1;
	setImmediate(next_operation, self, 3);
	return builder;
};

DP.listing = DP.list = function(builder) {
	var self = this;
	if (builder)
		builder.db = self;
	else
		builder = new DatabaseBuilder(self);
	builder.$options.listing = true;
	builder.$take = builder.$options.take = 100;
	self.pending_reader.push(builder);
	setImmediate(next_operation, self, 4);
	return builder;
};

DP.find = function(builder) {
	var self = this;
	if (builder instanceof DatabaseBuilder)
		builder.db = self;
	else
		builder = new DatabaseBuilder(self);
	self.pending_reader.push(builder);
	setImmediate(next_operation, self, 4);
	return builder;
};

DP.find2 = function(builder) {
	var self = this;
	if (builder instanceof DatabaseBuilder)
		builder.db = self;
	else {
		builder = new DatabaseBuilder(self);
		builder.$options.notall = true;
	}

	if (self.readonly)
		return self.find(builder);
	self.pending_reader2.push(builder);
	setImmediate(next_operation, self, 11);
	return builder;
};

DP.stream = function(fn, repository, callback) {
	var self = this;

	if (typeof(repository) === 'function') {
		callback = repository;
		repository = null;
	}

	self.pending_streamer.push({ fn: fn, callback: callback, repository: repository || {} });
	setImmediate(next_operation, self, 10);
	return self;
};

DP.throwReadonly = function(e) {
	throw new Error('Database "{0}" is readonly.'.format(this.name) + (e ? '\n' + e.toString() : ''));
};

DP.scalar = function(type, field) {
	return this.find().scalar(type, field);
};

DP.count = function() {
	var self = this;
	var builder = new DatabaseBuilder(self);
	builder.$options.readertype = 1;
	self.pending_reader.push(builder);
	setImmediate(next_operation, self, 4);
	return builder;
};

DP.one = DP.read = function() {
	var self = this;
	var builder = new DatabaseBuilder(self);
	builder.first();
	self.pending_reader.push(builder);
	setImmediate(next_operation, self, 4);
	return builder;
};

DP.one2 = DP.read2 = function() {
	var self = this;
	var builder = new DatabaseBuilder(self);
	builder.first();
	self.pending_reader2.push(builder);
	setImmediate(next_operation, self, 11);
	return builder;
};

DP.top = function(max) {
	var self = this;
	var builder = new DatabaseBuilder(self);
	builder.take(max);
	self.pending_reader.push(builder);
	setImmediate(next_operation, self, 4);
	return builder;
};

//  1 append
//  2 update
//  3 remove
//  4 reader
//  5 views
//  6 reader views
//  7 drop
//  8 backup
//  9 restore
// 10 streamer
// 11 reader reverse
// 12 clear
// 13 clean
// 14 locks

const NEXTWAIT = { 7: true, 8: true, 9: true, 12: true, 13: true, 14: true };

DP.next = function(type) {

	if (type && NEXTWAIT[this.step])
		return;

	if (F.isCluster && type === 0 && this.locked)
		clusterunlock(this);

	if (!this.$writting && !this.$reading) {

		if (this.step !== 12 && this.pending_clear.length) {
			if (!this.readonly && F.isCluster)
				clusterlock(this, '$clear');
			else if (INMEMORY[this.name])
				this.$clear_inmemory();
			else
				this.$clear();
			return;
		}

		if (this.step !== 13 && this.pending_clean.length) {
			if (!this.readonly && F.isCluster)
				clusterlock(this, '$clean');
			else
				this.$clean();
			return;
		}

		if (this.step !== 7 && !this.pending_reindex && this.pending_drops) {
			this.$drop();
			return;
		}

		if (this.step !== 14 && this.pending_locks.length) {
			this.$lock();
			return;
		}
	}

	if (!this.$writting) {

		if (this.step !== 1 && !this.pending_reindex && this.pending_append.length) {
			if (INMEMORY[this.name])
				this.$append_inmemory();
			else
				this.$append();
			return;
		}

		if (this.step !== 2 && !this.$writting && this.pending_update.length) {
			if (!this.readonly && F.isCluster)
				clusterlock(this, '$update');
			else if (INMEMORY[this.name])
				this.$update_inmemory();
			else
				this.$update();
			return;
		}

		if (this.step !== 3 && !this.$writting && this.pending_remove.length) {
			if (!this.readonly && F.isCluster)
				clusterlock(this, '$remove');
			if (INMEMORY[this.name])
				this.$remove_inmemory();
			else
				this.$remove();
			return;
		}

	}

	if (!this.$reading) {

		if (this.step !== 4 && this.pending_reader.length) {
			this.$reader();
			return;
		}

		if (this.step !== 11 && this.pending_reader2.length) {
			this.$reader3();
			return;
		}

		if (this.step !== 10 && this.pending_streamer.length) {
			this.$streamer();
			return;
		}
	}

	if (this.step !== type) {
		this.step = 0;
		setImmediate(next_operation, this, 0);
	}
};

// ======================================================================
// FILE OPERATIONS
// ======================================================================

// InMemory saving
DP.$save = function() {
	var self = this;
	setTimeout2('nosql.' + self.name, function() {
		var data = self.inmemory['#'] || EMPTYARRAY;
		var builder = [];
		for (var i = 0, length = data.length; i < length; i++)
			builder.push(JSON.stringify(data[i]).replace(REGBOOL, JSONBOOL));
		Fs.writeFile(self.filename, builder.join(NEWLINE) + NEWLINE, F.errorcallback);
	}, 50, 100);
	return self;
};

DP.$inmemory = function(callback) {

	var self = this;
	var view = '#';

	self.readonly && self.throwReadonly();

	// Last usage
	self.inmemorylastusage = global.F ? global.NOW : undefined;

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
			if (item) {
				try {
					item = JSON.parse(item.trim(), jsonparser);
					item && self.inmemory[view].push(item);
				} catch (e) {}
			}
		}

		callback();
	});

	return self;
};

TP.$meta = DP.$meta = function(write) {

	var self = this;

	if (write) {
		self.readonly && self.throwReadonly();
		Fs.writeFile(self.filenameMeta, JSON.stringify(self.metadata), F.errorcallback);
		return self;
	}

	if (self.readonly)
		return self;

	try {
		self.metadata = JSON.parse(Fs.readFileSync(self.filenameMeta).toString('utf8'), jsonparser);
	} catch (err) {}

	return self;
};

DP.$append = function() {
	var self = this;
	self.step = 1;

	if (!self.pending_append.length) {
		self.next(0);
		return;
	}

	self.$writting = true;

	self.pending_append.splice(0).limit(JSONBUFFER, function(items, next) {

		var json = '';
		for (var i = 0, length = items.length; i < length; i++) {
			json += items[i].doc + NEWLINE;
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
	self.$writting = false;
	self.next(0);
	self.$events.change && self.emit('change', 'insert');
}

DP.$append_inmemory = function() {
	var self = this;
	self.step = 1;

	if (!self.pending_append.length) {
		self.next(0);
		return self;
	}

	var items = self.pending_append.splice(0);

	return self.$inmemory(function() {

		for (var i = 0, length = items.length; i < length; i++) {
			self.inmemory['#'].push(JSON.parse(items[i].doc, jsonparser));
			items[i].builder.$options.log && items[i].builder.log();
			var callback = items[i].builder.$callback;
			callback && callback(null, 1);
		}

		self.$save();
		setImmediate(next_append, self);
	});
};

DP.$update = function() {

	var self = this;
	self.step = 2;

	if (!self.pending_update.length) {
		self.next(0);
		return self;
	}

	self.$writting = true;

	var filter = self.pending_update.splice(0);
	var filters = new NoSQLReader();
	var fs = new NoSQLStream(self.filename);
	var change = false;

	for (var i = 0; i < filter.length; i++)
		filters.add(filter[i].builder, true);

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	var update = function(docs, doc, dindex, f, findex) {

		var rec = fs.docsbuffer[dindex];
		var fil = filter[findex];
		var e = fil.keys ? 'modify' : 'update';
		var old = self.$events[e] ? CLONE(doc) : 0;

		if (f.first)
			f.canceled = true;

		if (fil.keys) {
			for (var j = 0; j < fil.keys.length; j++) {
				var key = fil.keys[j];
				var val = fil.doc[key];
				if (val !== undefined) {
					if (typeof(val) === 'function')
						doc[key] = val(doc[key], doc, f.filter.repository, f.filter.arg);
					else if (fil.inc && fil.inc[key]) {
						switch (fil.inc[key]) {
							case '!':
								doc[key] = !doc[key];
								break;
							case '+':
								doc[key] = (doc[key] || 0) + val;
								break;
							case '-':
								doc[key] = (doc[key] || 0) - val;
								break;
							case '*':
								doc[key] = (doc[key] || 0) + val;
								break;
							case '/':
								doc[key] = (doc[key] || 0) / val;
								break;
						}
					} else
						doc[key] = val;
				}
			}
		} else
			docs[dindex] = typeof(fil.doc) === 'function' ? (fil.doc(doc, f.filter.repository, f.filter.arg) || doc) : fil.doc;

		self.$events[e] && self.emit(e, doc, old);
		f.builder.$options.backup && f.builder.$backupdoc(rec.doc);
	};

	var updateflush = function(docs, doc, dindex) {

		doc = docs[dindex];

		var rec = fs.docsbuffer[dindex];
		var upd = JSON.stringify(doc).replace(REGBOOL, JSONBOOL);
		if (upd === rec.doc)
			return;

		!change && (change = true);
		var was = true;

		if (rec.doc.length === upd.length) {
			var b = Buffer.byteLength(upd);
			if (rec.length === b) {
				fs.write(upd + NEWLINE, rec.position);
				was = false;
			}
		}

		if (was) {
			var tmp = fs.remchar + rec.doc.substring(1) + NEWLINE;
			fs.write(tmp, rec.position);
			fs.write2(upd + NEWLINE);
		}
	};

	fs.ondocuments = function() {
		filters.compare2(JSON.parse('[' + fs.docs + ']', jsonparser), update, updateflush);
	};

	fs.$callback = function() {

		fs = null;
		self.$writting = false;
		self.next(0);

		for (var i = 0; i < filters.builders.length; i++) {
			var item = filters.builders[i];
			var fil = filter[i];
			if (fil.insert && !item.counter) {
				item.builder.$insertcallback && item.builder.$insertcallback(fil.insert, item.filter ? item.filter.repository : EMPTYOBJECT);
				var tmp = self.insert(fil.insert);
				tmp.$callback = item.builder.$callback;
				tmp.$options.log = item.builder.$options.log;
				item.builder.$callback = null;
			} else {
				item.builder.$options.log && item.builder.log();
				item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.counter), item.counter, item.count, item.filter ? item.filter.repository : EMPTYOBJECT);
			}
		}

		if (change) {
			self.$events.change && self.emit('change', 'update');
			!F.databasescleaner[self.name] && (F.databasescleaner[self.name] = 1);
		}
	};

	fs.openupdate();
	return self;
};

DP.$update_inmemory = function() {

	var self = this;
	self.step = 2;

	if (!self.pending_update.length) {
		self.next(0);
		return self;
	}

	var filter = self.pending_update.splice(0);
	var change = false;
	var filters = new NoSQLReader();

	for (var i = 0; i < filter.length; i++)
		filters.add(filter[i].builder, true);

	return self.$inmemory(function() {

		var old;

		var update = function(docs, doc, dindex, f, findex) {

			var fil = filter[findex];
			var e = fil.keys ? 'modify' : 'update';

			if (!old)
				old = self.$events[e] ? CLONE(doc) : 0;

			if (f.first)
				f.canceled = true;

			if (fil.keys) {
				for (var j = 0; j < fil.keys.length; j++) {
					var key = fil.keys[j];
					var val = fil.doc[key];
					if (val !== undefined) {
						if (typeof(val) === 'function')
							doc[key] = val(doc[key], doc);
						else if (fil.inc && fil.inc[key]) {
							switch (fil.inc[key]) {
								case '!':
									doc[key] = !doc[key];
									break;
								case '+':
									doc[key] = (doc[key] || 0) + val;
									break;
								case '-':
									doc[key] = (doc[key] || 0) - val;
									break;
								case '*':
									doc[key] = (doc[key] || 0) + val;
									break;
								case '/':
									doc[key] = (doc[key] || 0) / val;
									break;
							}
						} else
							doc[key] = val;
					}
				}
			} else
				docs[dindex] = typeof(fil.doc) === 'function' ? fil.doc(doc, f.filter.repository) : fil.doc;

			self.$events[e] && self.emit(e, doc, old);
			f.builder.$options.backup && f.builder.$backupdoc(old);
			return 1;
		};

		var updateflush = function(docs, doc) {
			!change && (change = true);
			self.$events.update && self.emit('update', doc, old);
			old = null;
		};

		filters.compare2(self.inmemory['#'], update, updateflush);

		change && self.$save();

		for (var i = 0; i < filters.builders.length; i++) {
			var item = filters.builders[i];
			if (item.insert && !item.counter) {
				item.builder.$insertcallback && item.builder.$insertcallback(item.insert, item.filter.repository || EMPTYOBJECT);
				var tmp = self.insert(item.insert);
				tmp.$callback = item.builder.$callback;
				tmp.$options.log = item.builder.$options.log;
				item.builder.$callback = null;
			} else {
				item.builder.$options.log && item.builder.log();
				item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.counter), item.counter, item.count, item.filter.repository);
			}
		}

		setImmediate(function() {
			self.next(0);
			change && self.$events.change && self.emit('change', 'update');
		});
	});
};

DP.$reader = function() {

	var self = this;
	self.step = 4;

	if (!self.pending_reader.length) {
		self.next(0);
		return self;
	}

	var list = self.pending_reader.splice(0);
	if (INMEMORY[self.name]) {
		self.$reader2_inmemory(list, () => self.next(0));
	} else {
		self.$reading = true;
		self.$reader2(self.filename, list, function() {
			self.$reading = false;
			self.next(0);
		});
	}

	return self;
};

function listing(builder, item) {
	var skip = builder.$options.skip || 0;
	var take = builder.$options.take || 0;
	return { page: ((skip / take) + 1), pages: item.count ? Math.ceil(item.count / take) : 0, limit: take, count: item.count, items: item.response || [] };
}

DP.$reader2 = function(filename, items, callback, reader) {

	var self = this;

	if (self.readonly) {
		if (reader === undefined) {
			U.download(filename, FLAGS_READ, function(err, response) {
				err && F.error(err, 'NoSQL database download: ' + self.name);
				self.$reader2(filename, items, callback, err ? null : response);
			});
			return self;
		}
	}

	var fs = new NoSQLStream(self.filename);
	var filters = new NoSQLReader(items);

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	fs.ondocuments = function() {
		return filters.compare(JSON.parse('[' + fs.docs + ']', jsonparser));
	};

	fs.$callback = function() {
		filters.done();
		fs = null;
		callback();
	};

	if (reader)
		fs.openstream(reader);
	else
		fs.openread();

	return self;
};

DP.$reader3 = function() {

	var self = this;
	self.step = 11;

	if (!self.pending_reader2.length) {
		self.next(0);
		return self;
	}

	self.$reading = true;

	var fs = new NoSQLStream(self.filename);
	var filters = new NoSQLReader(self.pending_reader2.splice(0));

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	fs.ondocuments = function() {
		return filters.compare(JSON.parse('[' + fs.docs + ']', jsonparser));
	};

	fs.$callback = function() {
		filters.done();
		self.$reading = false;
		fs = null;
		self.next(0);
	};

	fs.openreadreverse();
	return self;
};

DP.$streamer = function() {

	var self = this;
	self.step = 10;

	if (!self.pending_streamer.length) {
		self.next(0);
		return self;
	}

	self.$reading = true;

	var filter = self.pending_streamer.splice(0);
	var length = filter.length;
	var count = 0;
	var fs = new NoSQLStream(self.filename);

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	fs.ondocuments = function() {
		var docs = JSON.parse('[' + fs.docs + ']', jsonparser);
		for (var j = 0; j < docs.length; j++) {
			var json = docs[j];
			count++;
			for (var i = 0; i < length; i++)
				filter[i].fn(json, filter[i].repository, count);
		}
	};

	fs.$callback = function() {
		for (var i = 0; i < length; i++)
			filter[i].callback && filter[i].callback(null, filter[i].repository, count);
		self.$reading = false;
		self.next(0);
		fs = null;
	};

	fs.openread();
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

DP.$reader2_inmemory = function(items, callback) {
	var self = this;
	return self.$inmemory(function() {
		var filters = new NoSQLReader(items);
		filters.clone = true;
		filters.compare(self.inmemory['#']);
		filters.done();
		callback();
	});
};

DP.$remove = function() {

	var self = this;
	self.step = 3;

	if (!self.pending_remove.length) {
		self.next(0);
		return;
	}

	self.$writting = true;

	var fs = new NoSQLStream(self.filename);
	var filter = self.pending_remove.splice(0);
	var filters = new NoSQLReader(filter);
	var change = false;

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	var remove = function(docs, d, dindex, f) {
		var rec = fs.docsbuffer[dindex];
		f.builder.$options.backup && f.builder.$backupdoc(rec.doc);
		return 1;
	};

	var removeflush = function(docs, d, dindex) {
		var rec = fs.docsbuffer[dindex];
		!change && (change = true);
		self.$events.remove && self.emit('remove', d);
		fs.write(fs.remchar + rec.doc.substring(1) + NEWLINE, rec.position);
	};

	fs.ondocuments = function() {
		filters.compare2(JSON.parse('[' + fs.docs + ']', jsonparser), remove, removeflush);
	};

	fs.$callback = function() {
		filters.done();
		fs = null;
		self.$writting = false;
		self.next(0);
		if (change) {
			self.$events.change && self.emit('change', 'remove');
			!F.databasescleaner[self.name] && (F.databasescleaner[self.name] = 1);
		}
	};

	fs.openupdate();
};

DP.$clear = function() {

	var self = this;
	self.step = 12;

	if (!self.pending_clear.length) {
		self.next(0);
		return;
	}

	var filter = self.pending_clear.splice(0);
	Fs.unlink(self.filename, function() {
		for (var i = 0; i < filter.length; i++)
			filter[i]();
		self.$events.change && self.emit('change', 'clear');
		self.next(0);
	});
};

DP.$clean = function() {

	var self = this;
	self.step = 13;

	if (!self.pending_clean.length) {
		self.next(0);
		return;
	}

	var filter = self.pending_clean.splice(0);
	var length = filter.length;
	var now = Date.now();

	F.databasescleaner[self.name] = undefined;
	CONF.nosql_logger && PRINTLN('NoSQL embedded "{0}" cleaning (beg)'.format(self.name));

	var fs = new NoSQLStream(self.filename);
	var writer = Fs.createWriteStream(self.filename + '-tmp');

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	fs.divider = NEWLINE;

	fs.ondocuments = function() {
		fs.docs && writer.write(fs.docs + NEWLINE);
	};

	fs.$callback = function() {
		writer.end();
	};

	writer.on('finish', function() {
		Fs.rename(self.filename + '-tmp', self.filename, function() {
			CONF.nosql_logger && PRINTLN('NoSQL embedded "{0}" cleaning (end, {1}s)'.format(self.name, (((Date.now() - now) / 1000) >> 0)));
			for (var i = 0; i < length; i++)
				filter[i]();
			self.$events.clean && self.emit('clean');
			self.next(0);
			fs = null;
		});
	});

	fs.openread();
};

DP.$lock = function() {

	var self = this;
	self.step = 14;

	if (!self.pending_locks.length) {
		self.next(0);
		return;
	}

	var filter = self.pending_locks.splice(0);
	filter.wait(function(fn, next) {
		fn.call(self, next);
	}, function() {
		self.next(0);
	});
};

DP.$remove_inmemory = function() {

	var self = this;
	self.step = 3;

	if (!self.pending_remove.length) {
		self.next(0);
		return self;
	}

	var change = false;
	var filters = new NoSQLReader(self.pending_remove.splice(0));

	return self.$inmemory(function() {
		var cache = self.inmemory['#'].slice(0);

		var remove = function(docs, d, dindex, f) {
			f.builder.$options.backup && f.builder.$backupdoc(d);
			return 1;
		};

		var removeflush = function(docs, d) {
			!change && (change = true);
			self.$events.remove && self.emit('remove', d);
			var data = self.inmemory['#'];
			var index = data.indexOf(d);
			if (index !== -1)
				self.inmemory['#'].splice(index, index + 1);
		};

		filters.compare2(cache, remove, removeflush);
		change && self.$save();
		filters.done();
		self.next(0);
		change && self.$events.change && self.emit('change', 'remove');
	});
};

DP.$clear_inmemory = function() {

	var self = this;
	self.step = 12;

	if (!self.pending_clear.length) {
		self.next(0);
		return self;
	}

	var filter = self.pending_clear.splice(0);
	return self.$inmemory(function() {
		self.inmemory['#'] = [];
		self.$save();
		for (var i = 0; i < length; i++)
			filter[i](null);
		self.next(0);
	});
};

DP.$drop = function() {
	var self = this;
	self.step = 7;

	if (!self.pending_drops) {
		self.next(0);
		return;
	}

	self.pending_drops = false;
	var remove = [self.filename];

	try {
		Fs.readdirSync(self.binary.directory).forEach(function(filename) {
			filename.startsWith(self.name + '#') && filename.endsWith(EXTENSION_BINARY) && remove.push(framework_utils.join(self.binary.directory, filename));
		});
	} catch (e) {}

	remove.wait((filename, next) => Fs.unlink(filename, next), function() {
		self.next(0);
		self.free(true);
		self.$events.change && self.emit('change', 'drop');
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

DatabaseBuilder2.prototype.promise = promise;

DatabaseBuilder2.prototype.log = function(msg, user) {
	var self = this;
	if (msg) {
		NOW = new Date();
		self.$options.log = (self.$options.log ? self.$options.log : '') + NOW.toUTC().format('yyyy-MM-dd HH:mm:ss') + ' | ' + (user ? user.padRight(20) + ' | ' : '') + msg + NEWLINE;
	} else if (self.$options.log) {
		self.db.filenameLog && Fs.appendFile(self.db.filenameLog, self.$options.log, F.errorcallback);
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
	this.$first = false;
	this.$scope = 0;
	this.$callback = NOOP;
	this.$code = [];
	this.$args = {};
	this.$options = {};
	this.$repository = {};
	this.$counter = 0;
	this.$keys = [];
}

DatabaseBuilder.prototype.promise = promise;

DatabaseBuilder.prototype.reset = function() {
	var self = this;
	var reader = self.$nosqlreader;
	if (reader) {
		for (var i = 0; i < reader.builders.length; i++) {
			var item = reader.builders[i];
			if (item.builder === self) {
				item.response = null;
				item.scalar = null;
				item.counter = 0;
				item.count = 0;
				item.scalarcount = 0;
			}
		}
	}
	return self;
};

DatabaseBuilder.prototype.makefilter = function() {
	return { repository: this.$repository, options: this.$options, arg: this.$args, fn: this.$functions };
};

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
		NOW = new Date();
		self.$options.log = (self.$options.log ? self.$options.log : '') + NOW.toUTC().format('yyyy-MM-dd HH:mm:ss') + ' | ' + (user ? user.padRight(20) + ' | ' : '') + msg + NEWLINE;
	} else if (self.$options.log) {
		self.db.filenameLog && Fs.appendFile(self.db.filenameLog, self.$options.log, F.errorcallback);
		self.$options.log = '';
	}
	return self;
};

DatabaseBuilder.prototype.$callbackjoin = function(callback) {
	var self = this;
	Object.keys(self.$join).wait(function(key, next) {

		var join = self.$join[key];
		var response = self.$response;
		var unique = new Set();

		if (response instanceof Array && response.length) {
			for (var i = 0; i < response.length; i++) {
				var item = response[i];
				var val = item[join.b];
				if (val !== undefined) {
					if (val instanceof Array) {
						for (var j = 0; j < val.length; j++)
							unique.add(val[j]);
					} else
						unique.add(val);
				}
			}
		} else if (response) {
			var val = response[join.b];
			if (val !== undefined)
				unique.add(val);
		}

		var db = join.instance ? join.instance : (self.db instanceof Table ? TABLE(join.name) : NOSQL(join.name));

		if (join.scalartype) {
			join.items = [];
			join.count = unique.size;
			for (var m of unique.values()) {
				(function(val) {
					var builder = db.scalar(join.scalartype, join.scalarfield).callback(function(err, response) {
						join.items.push({ id: val, response: response });
						join.count--;
						if (join.count === 0) {
							join.count = -1;
							next();
						}
					});

					if (join.builder.$counter) {
						builder.$counter = join.builder.$counter;
						builder.$code = join.builder.$code.slice(0);
						U.extend_headers2(builder.$options, join.builder.$options);
						builder.$repository = join.builder.$repository;
						builder.$args = CLONE(join.builder.$args);
					}

					builder.$take = join.builder.$take;
					builder.$skip = join.builder.$skip;
					builder.$filter = join.builder.$filter;
					builder.$scope = join.builder.$scope;
					builder.where(join.a, val);

				})(m);
			}
		} else {

			if (unique.size) {

				join.builder.$options.fields && join.builder.$options.fields.push(join.a);
				join.builder.$callback = function(err, docs) {
					join.items = docs;
					next();
				};

				db.find(join.builder).in(join.a, Array.from(unique));

			} else {
				join.items = join.builder.$options.first ? null : [];
				next();
			}
		}

	}, callback, 2);

	return self;
};

DatabaseBuilder.prototype.$callback2 = function(err, response, count, repository) {
	var self = this;

	if (err || !self.$join) {
		self.$options.log && self.log();
		self.$done && setImmediate(self.$done);
		self.$callback && self.$callback(err, response, count, repository);
		return;
	}

	self.$response = response;
	self.$callbackjoin(function() {

		var keys = Object.keys(self.$join);
		var jl = keys.length;

		if (response instanceof Array) {
			for (var i = 0, length = response.length; i < length; i++) {
				var item = response[i];
				for (var j = 0; j < jl; j++) {
					var join = self.$join[keys[j]];
					item[join.field] = join.scalartype ? findScalar(join.items, item[join.b]) : join.first ? findItem(join.items, join.a, item[join.b]) : findItems(join.items, join.a, item[join.b]);
				}
			}
		} else if (response) {
			for (var j = 0; j < jl; j++) {
				var join = self.$join[keys[j]];
				response[join.field] = join.scalartype ? findScalar(join.items, item[join.b]) : join.first ? findItem(join.items, join.a, response[join.b]) : findItems(join.items, join.a, response[join.b]);
			}
		}

		self.$options.log && self.log();
		self.$done && setImmediate(self.$done);
		self.$callback && self.$callback(err, response, count, repository);
	});

	return self;
};

function findItem(items, field, value) {
	for (var i = 0, length = items.length; i < length; i++) {
		if (value instanceof Array) {
			for (var j = 0; j < value.length; j++) {
				if (items[i][field] === value[j])
					return items[i];
			}
		} else if (items[i][field] === value)
			return items[i];
	}
}

function findScalar(items, value) {
	var sum = null;
	for (var i = 0, length = items.length; i < length; i++) {
		var item = items[i];
		if (value instanceof Array) {
			for (var j = 0; j < value.length; j++) {
				if (item.id === value[j]) {
					sum = sum == null ? item.response : (sum + item.response);
					break;
				}
			}
		} else if (item.id === value)
			sum = sum == null ? item.response : (sum + item.response);
	}
	return sum;
}

function findItems(items, field, value) {
	var arr = [];
	for (var i = 0, length = items.length; i < length; i++) {
		if (value instanceof Array) {
			for (var j = 0; j < value.length; j++) {
				if (items[i][field] === value[j]) {
					arr.push(items[i]);
					break;
				}
			}
		} else if (items[i][field] === value)
			arr.push(items[i]);
	}
	return arr;
}

DatabaseBuilder.prototype.join = function(field, name) {
	var self = this;

	if (!self.$join)
		self.$join = {};

	var table = self.db instanceof Table;
	var instance;

	if (name instanceof Database) {
		instance = name;
		name = name.name;
		table = false;
	} else if (name instanceof Table) {
		instance = name;
		table = true;
		name = name.name;
	}

	var key = name + '.' + field;
	var join = self.$join[key];
	if (join)
		return join;

	var item = self.$join[key] = {};
	item.field = field;
	item.name = name;
	item.table = table;
	item.instance = instance;
	item.builder = join = new DatabaseBuilder(self.db);

	join.on = function(a, b) {

		if (self.$options.fields)
			self.$options.fields.push(b);

		self.$join[key].a = a;
		self.$join[key].b = b;

		self.$keys && self.$keys.push(b);
		return join;
	};

	join.first = function() {
		item.first = true;
		return join;
	};

	join.scalar = function(type, field) {
		item.scalartype = type;
		item.scalarfield = field;
		return join;
	};

	join.callback = function(a, b) {
		self.callback(a, b);
		return join;
	};

	return join;
};

DatabaseBuilder.prototype.first = function() {
	this.$options.first = true;
	return this.take(1);
};

DatabaseBuilder.prototype.make = function(fn, id) {
	if (id) {
		this.$options.id = id;
		this.$iscache = !!CACHE[this.db.name + '_' + id];
	}
	fn.call(this, this);
	return this;
};

DatabaseBuilder.prototype.rule = function(rule, params) {
	var self = this;

	if (typeof(rule) === 'string') {
		var fn = CACHE[self.$rule];
		if (!fn)
			fn = CACHE[self.$rule] = new Function('doc', 'param', 'return ' + rule);
		self.$rule = fn;
	} else
		self.$rule = rule;

	self.$params = params;
	return self;
};

DatabaseBuilder.prototype.filter = function(fn) {
	var self = this;

	if (!self.$functions)
		self.$functions = [];

	var index = self.$functions.push(fn) - 1;

	if (!self.$iscache) {
		var code = '$is=!!fn[{0}].call($F,doc,index,repository);'.format(index);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}

	self.$counter++;
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

	if (!self.$iscache) {
		var code = '$is=doc.{0} instanceof Array?!!doc.{0}.length:!!doc.{0};'.format(name);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}

	self.$counter++;
	return self;
};

DatabaseBuilder.prototype.empty = function(name) {
	var self = this;

	if (!self.$iscache) {
		var code = '$is=doc.{0} instanceof Array?!doc.{0}.length:!doc.{0};'.format(name);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}

	self.$counter++;
	return self;
};

DatabaseBuilder.prototype.map = function(name, code) {
	var self = this;
	if (!self.$iscache) {
		var data = { name: name, code: code };
		if (self.$options.mappers)
			self.$options.mappers.push(data);
		else
			self.$options.mappers = [data];
	}
	return self;
};

DatabaseBuilder.prototype.backup = function(user) {
	if (this.db.filenameBackup)
		this.$options.backup = typeof(user) === 'string' ? user : UNKNOWN;
	else
		this.$options.backup = null;
	return this;
};

DatabaseBuilder.prototype.$backupdoc = function(doc) {
	this.db.filenameBackup && Fs.appendFile(this.db.filenameBackup, NOW.toUTC().format('yyyy-MM-dd HH:mm') + ' | ' + this.$options.backup.padRight(20) + ' | ' + (typeof(doc) === 'string' ? doc : JSON.stringify(doc)) + NEWLINE, F.errorcallback);
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
	self.$args[key] = date ? value.getTime() : value;

	if (!self.$iscache) {
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
	}

	return self;
};

DatabaseBuilder.prototype.query = function(code) {
	var self = this;
	if (!self.$iscache) {
		code = '$is=(' + code + ');';
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}

	self.$counter++;
	return self;
};

DatabaseBuilder.prototype.arg = function(key, value) {
	this.$args[key] = value;
	return this;
};

DatabaseBuilder.prototype.month = function(name, operator, value) {
	var self = this;
	var key = 'dm' + (self.$counter++);

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	self.$args[key] = value;

	if (!self.$iscache) {
		var code = compare_datetype('month', name, key, operator);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}
	return self;
};

DatabaseBuilder.prototype.day = function(name, operator, value) {
	var self = this;
	var key = 'dd' + (self.$counter++);

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	self.$args[key] = value;

	if (!self.$iscache) {
		var code = compare_datetype('day', name, key, operator);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}
	return self;
};

DatabaseBuilder.prototype.year = function(name, operator, value) {
	var self = this;
	var key = 'dy' + (self.$counter++);

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	self.$args[key] = value;

	if (!self.$iscache) {
		var code = compare_datetype('year', name, key, operator);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}

	return self;
};

DatabaseBuilder.prototype.hour = function(name, operator, value) {
	var self = this;
	var key = 'dh' + (self.$counter++);

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	self.$args[key] = value;

	if (!self.$iscache) {
		var code = compare_datetype('hour', name, key, operator);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}

	return self;
};

DatabaseBuilder.prototype.minute = function(name, operator, value) {
	var self = this;
	var key = 'dh' + (self.$counter++);

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	self.$args[key] = value;

	if (!self.$iscache) {
		var code = compare_datetype('minute', name, key, operator);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}

	return self;
};

DatabaseBuilder.prototype.like = DatabaseBuilder.prototype.search = function(name, value, where) {

	var self = this;
	var code;
	var key = 'l' + (self.$counter++);

	if (!self.$iscache) {
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
				code = '$is=false;if(doc.{0}){if(doc.{0} instanceof Array){for(var $i=0;$i<doc.{0}.length;$i++){if(doc.{0}[$i].toLowerCase().indexOf(arg.{1})!==-1){$is=true;break;}}}else{$is=doc&&doc.{0}?(doc.{0} + \'\').toLowerCase().indexOf(arg.{1})!==-1:false}}';
				if (value instanceof Array)
					value = value.join(' ');
				value = value.toLowerCase();
				break;
		}

		self.$args[key] = value;

		if (self.$scope)
			code = 'if(!$is){' + code + '}';

		self.$code.push(code.format(name, key));
		!self.$scope && self.$code.push('if(!$is)return;');
	} else {
		if (!where || where === '*') {
			if (value instanceof Array)
				value = value.join(' ');
			value = value.toLowerCase();
		}
		self.$args[key] = value;
	}

	return self;
};

DatabaseBuilder.prototype.regexp = function(name, value) {
	var self = this;
	if (!self.$iscache) {
		var code = '$is=false;if(doc.{0}&&doc.{0}.toLowerCase){$is=({1}).test(doc.{0})}';
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code.format(name, value.toString()));
		!self.$scope && self.$code.push('if(!$is)return;');
	}
	return self;
};

DatabaseBuilder.prototype.fulltext = function(name, value, weight) {

	var self = this;
	var key = 'l' + (self.$counter++);
	var key2 = 'l' + (self.$counter++);

	if (value instanceof Array) {
		for (var i = 0; i < value.length; i++)
			value[i] = value[i].toLowerCase();
	} else {
		if (REGCHINA.test(value))
			value = value.split('');
		else
			value = value.toLowerCase().split(' ');
	}

	self.$args[key] = value;

	var count = 1;

	if (weight)
		count = ((value.length / 100) * weight) >> 0;

	self.$args[key2] = count || 1;

	if (!self.$iscache) {
		var code = '$is=false;if(doc.{0}&&doc.{0}.toLowerCase){var $a=arg.{2},$b=doc.{0}.toLowerCase();for(var $i=0;$i<arg.{1}.length;$i++){if($b.indexOf(arg.{1}[$i])!==-1){$a--;if(!$a){$is=true;break}}}}';
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code.format(name, key, key2));
		!self.$scope && self.$code.push('if(!$is)return;');
	}

	return self;
};

DatabaseBuilder2.prototype.stringify = DatabaseBuilder.prototype.stringify = function() {

	var self = this;
	var obj = {};

	obj.options = self.$options;
	obj.code = self.$code;
	obj.args = self.$args;
	obj.insert = self.$insertcallback ? self.$insertcallback.toString() : null;

	if (self.$functions) {
		obj.functions = [];
		for (var i = 0; i < self.$functions.length; i++)
			obj.functions.push(self.$functions[i].toString());
	}

	if (self.$repository)
		obj.repository = self.$repository;

	return JSON.stringify(obj);
};

DatabaseBuilder2.prototype.parse = DatabaseBuilder.prototype.parse = function(data) {

	data = JSON.parse(data, jsonparser);
	this.$options = data.options;
	this.$code = data.code;
	this.$args = data.args;
	this.$take = data.options.take;
	this.$skip = data.options.skip;
	this.$repository = data.repository;
	this.$insertcallback = data.insert ? eval('(' + data.insert + ')') : null;

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
	if (limit)
		this.$take = this.$options.take = limit;
	this.$skip = this.$options.skip = page * this.$take;
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
	var self = this;
	self.$options.sort = { name: name, asc: desc ? false : true };
	return self;
};

DatabaseBuilder.prototype.repository = function(key, value) {
	var self = this;
	if (key === undefined)
		return self.$repository;
	if (value === undefined)
		return self.$repository[key];
	self.$repository[key] = value;
	return self;
};

DatabaseBuilder.prototype.compile = function(noTrimmer) {

	var self = this;
	var opt = self.$options;
	var key = opt.id ? (self.db ? self.db.name : UNKNOWN) + '_' + opt.id : null;
	var cache = key ? CACHE[key] : null;

	self.$inlinesort = !!(opt.take && opt.sort && opt.sort !== null);
	self.$limit = (opt.take || 0) + (opt.skip || 0);

	if (key && cache) {
		self.$mappers = cache.mitems;
		self.$mappersexec = cache.mexec;
		return cache.filter;
	}

	var raw = self.$code.join('');
	var code = 'var R=repository=$F.repository,options=$F.options,arg=$F.arg,fn=$F.fn,$is=false,$tmp;' + raw + (self.$code.length && raw.substring(raw.length - 7) !== 'return;' ? 'if(!$is)return;' : '') + (noTrimmer ? 'return doc' : 'if(options.fields){var $doc={};for(var $i=0;$i<options.fields.length;$i++){var prop=options.fields[$i];$doc[prop]=doc[prop]}if(options.sort)$doc[options.sort.name]=doc[options.sort.name];return $doc}else if(options.fields2){var $doc={};var $keys=Object.keys(doc);for(var $i=0;$i<$keys.length;$i++){var prop=$keys[$i];!options.fields2[prop]&&($doc[prop]=doc[prop])}return $doc}else{return doc}');

	if (!key) {
		key = (self.db ? self.db.name : UNKNOWN) + '_' + raw.hash();
		cache = CACHE[key];
		if (cache) {
			self.$mappers = cache.mitems;
			self.$mappersexec = cache.mexec;
			self.$each = cache.each;
			return cache.filter;
		}
	}

	if (opt.mappers) {
		var tmp = '';
		self.$mappers = [];
		for (var i = 0; i < opt.mappers.length; i++) {
			var m = opt.mappers[i];
			tmp += ('doc.{0}=item.builder.$mappers[{1}](doc,item.filter.repository,item.filter.repository);'.format(m.name, i));
			opt.fields && opt.fields.push(m.name);
			self.$mappers.push(new Function('doc', 'repository', 'R', m.code.lastIndexOf('return ') === -1 ? ('return ' + m.code) : m.code));
		}
		self.$mappersexec = new Function('doc', 'item', tmp);
	}

	if (opt.each)
		self.$each = new Function('item', 'doc', 'repository', 'R', opt.each.join(''));

	var cache = {};
	cache.rule = self.$rule;
	cache.params = self.$params;
	cache.filter = new Function('doc', '$F', 'index', code);
	cache.mexec = self.$mappersexec;
	cache.mitems = self.$mappers;
	cache.each = self.$each;
	CACHE[key] = cache;
	return cache.filter;
};

DatabaseBuilder.prototype.in = function(name, value) {
	var self = this;
	var key = 'in' + (self.$counter++);
	self.$args[key] = value instanceof Array ? value : [value];
	if (!self.$iscache) {
		var code = 'if($is)$is=false;$tmp=doc.{0};if($tmp instanceof Array){for(var $i=0;$i<$tmp.length;$i++){if(arg.{1}.indexOf($tmp[$i])!==-1){$is=true;break}}}else{if(arg.{1}.indexOf($tmp)!==-1)$is=true}'.format(name, key);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}
	return self;
};

DatabaseBuilder.prototype.notin = function(name, value) {
	var self = this;
	var key = 'in' + (self.$counter++);
	self.$args[key] = value instanceof Array ? value : [value];
	if (!self.$iscache) {
		var code = '$is=true;$tmp=doc.{0};if($tmp instanceof Array){for(var $i=0;$i<$tmp.length;$i++){if(arg.{1}.indexOf($tmp[$i])!==-1){$is=false;break}}}else{if(arg.{1}.indexOf($tmp)!==-1)$is=false}'.format(name, key);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}
	return self;
};

DatabaseBuilder.prototype.between = function(name, a, b) {
	var self = this;
	var keya = 'ba' + (self.$counter++);
	var keyb = 'bb' + (self.$counter++);

	self.$args[keya] = a;
	self.$args[keyb] = b;

	if (!self.$iscache) {
		var code = '$is=doc.{0}>=arg.{1}&&doc.{0}<=arg.{2};'.format(name, keya, keyb);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}
	return self;
};

DatabaseBuilder.prototype.or = function() {
	var self = this;
	if (!self.$iscache) {
		self.$code.push('$is=false;');
		self.$scope = 1;
	}
	return self;
};

DatabaseBuilder.prototype.end = function() {
	var self = this;
	if (!self.$iscache) {
		self.$scope = 0;
		self.$code.push('if(!$is)return;');
	}
	return self;
};

DatabaseBuilder.prototype.and = function() {
	var self = this;
	if (!self.$iscache) {
		self.$code.push('$is=false;');
		self.$scope = 0;
	}
	return self;
};

DatabaseBuilder.prototype.done = function() {
	this.$options = {};
	this.$code = [];
	return this;
};

DatabaseBuilder.prototype.fields = function() {
	var self = this;
	var opt = self.$options;
	var arr = arguments.length === 1 ? arguments[0].split(',') : arguments;
	for (var i = 0, length = arr.length; i < length; i++) {
		var name = arr[i];
		if (name[0] === '-') {
			!opt.fields2 && (opt.fields2 = {});
			opt.fields2[name.substring(1)] = 1;
		} else {
			!opt.fields && (opt.fields = []);
			opt.fields.push(name);
		}
	}
	return self;
};

DatabaseBuilder.prototype.prepare = function(fn) {
	var self = this;

	if (!self.$functions)
		self.$functions = [];

	var index = self.$functions.push(fn) - 1;

	if (!self.$iscache) {
		var code = '$tmp=fn[{0}].call($F,U.clone(doc),index,repository);if(typeof($tmp)==\'boolean\'){$is=$tmp}else{doc=$tmp;$is=$tmp!=null}'.format(index);
		if (self.$scope)
			code = 'if(!$is){' + code + '}';
		self.$code.push(code);
		!self.$scope && self.$code.push('if(!$is)return;');
	}

	return self;
};

DatabaseBuilder.prototype.each = function(fn) {
	var self = this;

	if (!self.$functions)
		self.$functions = [];

	var index = self.$functions.push(fn) - 1;

	if (!self.$iscache) {
		var code = 'item.filter.fn[{0}].call(item,doc,item.filter.repository,item.filter.repository);'.format(index);
		if (self.$options.each)
			self.$options.each.push(code);
		else
			self.$options.each = [code];
	}

	return self;
};

function Counter(db) {
	var t = this;
	t.TIMEOUT = 30000;
	t.db = db;
	t.cache;
	t.filenameLock = db.filenameCounter + '-lock';
	t.key = (db instanceof Table ? 'table' : 'nosql') + db.name.hash();
	t.type = 0; // 1 === saving, 2 === reading
	t.$events = {};
	t.$cb_save = function() {
		t.tid = undefined;
		if (F.isCluster)
			clusterlock(t, '$save');
		else
			t.$save();
	};
}

const CP = Counter.prototype;

CP.emit = function(name, a, b, c, d, e, f, g) {
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

CP.on = function(name, fn) {

	if (!fn.$once)
		this.db.$free = false;

	if (this.$events[name])
		this.$events[name].push(fn);
	else
		this.$events[name] = [fn];

	return this;
};

CP.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

CP.removeListener = function(name, fn) {
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

CP.removeAllListeners = function(name) {
	if (name === true)
		this.$events = EMPTYOBJECT;
	else if (name)
		this.$events[name] = undefined;
	else
		this.$events = {};
	return this;
};

CP.empty = function(key, value) {
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

CP.min = function(id, count) {

	var self = this;

	if (id instanceof Array) {
		for (var i = 0, length = id.length; i < length; i++)
			self.min(id[i], count);
		return self;
	}

	var key = 'mma' + NOW.getFullYear() + '' + id;

	if (self.cache && self.cache[key]) {
		var arr = self.cache[key];
		if (arr[0] > count) // min
			arr[0] = count;
		if (arr[1] < count) // max
			arr[1] = count;
	} else
		self.empty(key, count);

	self.save();
	this.$events.min && self.emit('min', id, count || 1);
	return self;
};

CP.max = function(id, count) {

	var self = this;

	if (id instanceof Array) {
		for (var i = 0, length = id.length; i < length; i++)
			self.min(id[i], count);
		return self;
	}

	var key = 'mma' + NOW.getFullYear() + '' + id;
	if (self.cache && self.cache[key]) {
		var arr = self.cache[key];
		if (arr[0] > count) // min
			arr[0] = count;
		if (arr[1] < count) // max
			arr[1] = count;
	} else
		self.empty(key, count);


	self.save();
	self.$events.max && self.emit('max', id, count || 1);
	return self;
};

CP.inc = CP.hit = function(id, count) {

	var self = this;

	if (id instanceof Array) {
		for (var i = 0, length = id.length; i < length; i++)
			self.min(id[i], count);
		return self;
	}

	var key = 'sum' + NOW.getFullYear() + '' + id;
	if (self.cache && self.cache[key])
		self.cache[key] += count || 1;
	else
		self.empty(key, count || 1);

	self.save();
	this.$events.sum && self.emit('sum', id, count || 1);
	this.$events.hits && self.emit('hit', id, count || 1);
	return self;
};

CP.remove = function(id) {
	var self = this;

	!self.cache && (self.cache = {});

	if (id instanceof Array)
		id.forEach(n => self.cache[n] = null);
	else
		self.cache[id] = null;

	self.save();
	self.emit('remove', id);
	return self;
};

CP.count = function(id, callback) {

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

CP.maximum = function(id, callback) {

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

CP.minimum = function(id, callback) {

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

CP.yearly = CP.yearly_sum = function(id, callback) {

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

CP.monthly = CP.monthly_sum = function(id, callback) {

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

CP.daily = CP.daily_sum = function(id, callback) {

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

CP.yearly_max = function(id, callback) {

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

CP.monthly_max = function(id, callback) {

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

CP.daily_max = function(id, callback) {

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

CP.yearly_min = function(id, callback) {

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

CP.monthly_min = function(id, callback) {

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

CP.daily_min = function(id, callback) {

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

CP.read = function(options, callback, reader) {

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
	} else {
		F.stats.performance.open++;
		reader = Fs.createReadStream(self.db.filenameCounter);
	}

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

CP.stats_max = function(top, year, month, day, callback) {
	return this.stats(top, year, month, day, 'max', callback);
};

CP.stats_min = function(top, year, month, day, callback) {
	return this.stats(top, year, month, day, 'min', callback);
};

CP.stats = CP.stats_sum = function(top, year, month, day, type, callback, reader) {

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
	} else {
		F.stats.performance.open++;
		reader = Fs.createReadStream(self.db.filenameCounter);
	}

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

CP.save = function() {
	var self = this;
	!self.tid && (self.tid = setTimeout(self.$cb_save, self.TIMEOUT));
	return self;
};

CP.reset = function(countertype, counterid, date, callback) {

	var self = this;

	if (self.type) {
		setTimeout((countertype, counterid, date, callback) => self.reset(countertype, counterid, date, callback), 200, countertype, counterid, date, callback);
		return self;
	}

	if (date)
		date = date.split('-');

	var allow = null;

	if (countertype) {
		if (!(countertype instanceof Array))
			countertype = [countertype];
		allow = {};
		for (var i = 0; i < countertype.length; i++)
			allow[countertype[i]] = 1;
	}

	self.db.readonly && self.db.throwReadonly();
	F.stats.performance.open++;

	var filename = self.db.filenameCounter;
	var reader = Fs.createReadStream(filename);
	var writer = Fs.createWriteStream(filename + '-tmp');
	var counter = 0;

	self.type = 4;

	reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value) {

		var id = value.substring(0, value.indexOf('='));
		// 0 === typeYEARid=COUNT
		// N === MMdd=COUNT

		var arr = value.trim().split(';');
		var type = id.substring(0, 3);
		var year = id.substring(3, 7);

		if (counterid && counterid !== id.substring(7)) {
			writer.write(arr.join(';') + NEWLINE);
			return;
		}

		if (allow && !allow[type]) {
			if (type === 'mma' && !allow.min && !allow.max) {
				writer.write(arr.join(';') + NEWLINE);
				return;
			}
		}

		if (date) {
			if (date[0] !== year) {
				writer.write(arr.join(';') + NEWLINE);
				return;
			}
		}

		var values = [];

		for (var i = 1; i < arr.length; i++) {

			var stat = arr[i].split('=');
			var statcount;

			if (type === 'mma') {
				statcount = stat[1].split('X');
				statcount[0] = +statcount[0];
				statcount[1] = +statcount[1];
			} else
				statcount = +stat[1];

			if (date && ((date[1] && stat[0].substring(0, 2) !== date[1]) || (date[2] && stat[0].substring(2, 4) !== date[2]))) {
				if (type === 'mma')
					values.push(statcount[0], statcount[1]);
				else
					values.push(statcount);
				continue;
			}

			if (allow && type === 'mma') {
				if (allow.min) {
					stat[1] = '0X' + statcount[1];
					arr[i] = stat.join('=');
					values.push(statcount[1]);
					continue;
				} else if (allow.max) {
					stat[1] = statcount[0] + 'X0';
					arr[i] = stat.join('=');
					values.push(statcount[0]);
					continue;
				} else {
					// reset entire mma
					values.push(0);
				}
			}

			stat[1] = type === 'mma' ? '0X0' : '0';

			if (stat[1] === '0X0' || stat[1] === '0') {
				arr.splice(i, 1);
				i--;
			} else
				arr[i] = stat.join('=');
		}

		var min = null;
		var max = null;
		var sum = 0;

		for (var i = 0; i < values.length; i++) {
			var val = values[i];

			if (min == null)
				min = val;
			else if (min > val)
				min = val;

			if (max == null)
				max = val;
			else if (max < val)
				max = val;

			sum += val;
		}

		var tmp = arr[0].split('=');
		tmp[1] = (type === 'mma' ? ((min || 0) + 'X' + (max || 0)) : ((sum || 0) + ''));
		arr[0] = tmp.join('=');

		if (arr.length > 1)
			writer.write(arr.join(';') + NEWLINE);

		counter++;
	}));

	var flush = () => writer.end();

	reader.on('error', flush);
	reader.on('end', flush);

	CLEANUP(writer, function() {
		Fs.rename(filename + '-tmp', filename, function() {
			F.isCluster && clusterunlock(self);
			clearTimeout(self.timeout);
			self.timeout = 0;
			self.type = 0;
			counter && self.$events.stats && setImmediate(() => self.emit('stats', counter));
			callback && callback(null, counter);
		});
	});

	return self;
};

CP.$save = function() {

	var self = this;

	self.tid && clearTimeout(self.tid);
	self.db.readonly && self.db.throwReadonly();

	if (self.type) {
		setTimeout(() => self.save(), 200);
		return self;
	}

	F.stats.performance.open++;

	var filename = self.db.filenameCounter;
	var reader = Fs.createReadStream(filename);
	var writer = Fs.createWriteStream(filename + '-tmp');
	var dt = NOW.format('MMdd') + '=';
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

	reader.on('data', framework_utils.streamer(NEWLINEBUF, function(value) {

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
			F.isCluster && clusterunlock(self);
			clearTimeout(self.timeout);
			self.timeout = 0;
			self.type = 0;
			counter && self.$events.stats && setImmediate(() => self.emit('stats', counter));
		});
	});

	return self;
};

CP.clear = function(callback) {
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

function Binary(db, directory, ext) {
	var t = this;
	t.db = db;
	t.ext = ext || EXTENSION_BINARY;
	t.directory = directory;
	t.$events = {};
	t.metafile = directory + 'meta.json';
	t.meta = { $version: 1, updated: NOW };
	t.cachekey = 'nobin_' + db.name + '_';
	t.logger = directory + '/files.log';
	t.$refresh();
}

Binary.prototype.$refresh = function() {
	this.meta.index = 0;
	this.meta.count = 0;
	this.meta.free = [];
	try {
		var json = Fs.readFileSync(this.metafile, 'utf8').toString();
		if (json.length) {
			var config = JSON.parse(json, jsonparser);
			this.meta.index = config.index;
			this.meta.count = config.count;
			this.meta.free = config.free || [];
			this.meta.updated = config.updated || NOW;
		}
	} catch(e) {}
};

Binary.prototype.$save = function() {
	var self = this;
	self.check();
	self.meta.updated = NOW;
	Fs.writeFile(self.metafile, JSON.stringify(self.meta), F.error());
	return self;
};

Binary.prototype.$directoryindex = function(index) {
	return Math.floor(index / 1000) + 1;
};

Binary.prototype.$directory = function(index, dir) {
	var self = this;
	var id = (dir ? index : self.$directoryindex(index)).toString().padLeft(DIRECTORYLENGTH, '0');
	var length = id.length;
	var directory = '';

	for (var i = 0; i < length; i++)
		directory += (i % 3 === 0 && i > 0 ? '-' : '') + id[i];

	return Path.join(self.directory, directory);
};

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

Binary.prototype.insert = function(name, buffer, custom, callback) {

	var self = this;
	var type = framework_utils.getContentType(framework_utils.getExtension(name));

	if (buffer && !(buffer instanceof Buffer)) {
		if (typeof(buffer) === 'function') {
			callback = buffer;
			buffer = custom = null;
		} else if (!buffer.resume) {
			callback = custom;
			custom = buffer;
			buffer = null;
		}

		if (typeof(custom) === 'function') {
			callback = custom;
			custom = null;
		}

	} else if (typeof(custom) === 'function') {
		callback = custom;
		custom = null;
	}

	if (name.length > 80)
		name = name.substring(0, 80) + name.substring(name.lastIndexOf('.'));

	if (!buffer) {
		F.stats.performance.open++;
		var reader = Fs.createReadStream(name);
		CLEANUP(reader);
		return self.insertstream(null, framework_utils.getName(name), type, reader, callback, custom);
	}

	if (typeof(buffer) === 'string')
		buffer = Buffer.from(buffer, 'base64');
	else if (buffer.resume)
		return self.insertstream(null, name, type, buffer, callback, custom);

	var size = buffer.length;
	var dimension;
	var ext = framework_utils.getExtension(name);

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

	var time = NOW.format('yyyyMMdd');
	var h = { name: name, size: size, type: type, date: time };

	if (custom)
		h.custom = custom;

	if (dimension) {
		if (dimension.width)
			h.width = dimension.width;

		if (dimension.height)
			h.height = dimension.height;
	}

	var header = Buffer.alloc(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify(h));

	var id;

	if (self.meta.free.length && (!F.id || F.id === '0')) {
		id = self.meta.free.shift();
	} else {
		self.meta.index++;
		id = self.meta.index;
	}

	self.meta.count++;
	F.isCluster && cluster_send({ TYPE: 'filestorage', NAME: self.db.name, method: 'add', index: self.meta.index, count: self.meta.count });

	var path = self.$directory(id);
	self.check(path);

	if (!F.id || F.id === '0')
		self.$save();

	var filename = id.toString().padLeft(DIRECTORYLENGTH, '0');
	var stream = Fs.createWriteStream(Path.join(path, filename + self.ext));

	stream.write(header, 'binary');
	stream.end(buffer);
	CLEANUP(stream);

	id = 'B' + time + 'T' + filename;
	callback && callback(null, id, h);
	self.$events.insert && self.emit('insert', id, h);
	return id;
};

Binary.prototype.insertstream = function(id, name, type, stream, callback, custom) {

	var self = this;
	var time = NOW.format('yyyyMMdd');
	var h = { name: name, size: 0, type: type, date: time };

	if (custom)
		h.custom = custom;

	var header = Buffer.alloc(BINARY_HEADER_LENGTH);

	header.fill(' ');
	header.write(JSON.stringify(h));

	var isnew = false;
	var cacheid = id;

	if (id) {
		// check if it's new implementation
		if (id > 0) {
			isnew = true;
		} else if (id[0] === 'B' || id[0] === 'b') {
			isnew = true;
			id = +id.substring(id.length - DIRECTORYLENGTH);
		}
	} else {
		isnew = true;
		if (self.meta.free.length && (!F.id || F.id === '0')) {
			id = self.meta.free.shift();
		} else {
			self.meta.index++;
			id = self.meta.index;
		}
		self.meta.count++;
		F.isCluster && cluster_send({ TYPE: 'filestorage', NAME: self.db.name, method: 'add', index: self.meta.index, count: self.meta.count });
		if (!F.id || F.id === '0')
			self.$save();
	}

	var filepath;
	var filename;

	if (isnew) {
		var path = self.$directory(id);
		self.check(path);
		filename = id.toString().padLeft(DIRECTORYLENGTH, '0');
		filepath = Path.join(path, filename + self.ext);
	} else
		filepath = framework_utils.join(self.directory, self.db.name + '#' + id + self.ext);

	var writer = Fs.createWriteStream(filepath);
	writer.write(header, 'binary');

	var ext = framework_utils.getExtension(name);
	var dimension = null;

	IMAGES[ext] && stream.once('data', function(buffer) {
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
	});

	stream.pipe(writer);

	if (isnew)
		id = 'B' + time + 'T' + filename;

	CLEANUP(writer, function() {

		if (dimension) {
			if (dimension.width)
				h.width = dimension.width;
			if (dimension.height)
				h.height = dimension.height;
		}

		h.size = writer.bytesWritten;

		Fs.open(filepath, 'r+', function(err, fd) {
			if (!err) {
				var header = Buffer.alloc(BINARY_HEADER_LENGTH);
				header.fill(' ');
				header.write(JSON.stringify(h));
				Fs.write(fd, header, 0, header.length, 0, () => Fs.close(fd, NOOP));
			}
		});

		callback && callback(null, cacheid || id, h);
		self.$events.insert && self.emit('insert', cacheid || id, h);
	});

	return cacheid || id;
};

Binary.prototype.makedirectory = function(id) {

	var val = (HASH(id, true) % 10000) + '';
	var diff = 4 - val.length;

	if (diff > 0) {
		for (var i = 0; i < diff; i++)
			val = '0' + val;
	}

	if (diff.length > 4)
		val = val.substring(0, 4);

	return Path.join(this.directory, val);
};

Binary.prototype.append = Binary.prototype.save = function(id, name, filename, callback, custom) {

	if (typeof(filename) === 'function' || filename == null) {
		custom = callback;
		callback = filename;
		filename = name;
		name = U.getName(filename);
	}

	var self = this;
	var directory = self.makedirectory(id);
	var filenameto = Path.join(directory, id + '.file');
	var cachekey = self.cachekey + directory;

	var index = name.lastIndexOf('/');
	if (index !== -1)
		name = name.substring(index + 1);

	if (F.temporary.other[cachekey]) {
		self.saveforce(id, name, filename, filenameto, callback, custom);
	} else {
		Fs.mkdir(directory, MKDIR, function(err) {
			if (err)
				callback(err);
			else {
				F.temporary.other[cachekey] = 1;
				self.saveforce(id, name, filename, filenameto, callback, custom);
			}
		});
	}

	return self;
};

Binary.prototype.saveforce = function(id, name, filename, filenameto, callback, custom) {

	if (!callback)
		callback = NOOP;

	F.stats.performance.open++;
	var isbuffer = filename instanceof Buffer;
	var self = this;
	var header = Buffer.alloc(BINARY_HEADER_LENGTH, ' ');
	var reader = isbuffer ? null : filename instanceof Readable ? filename : Fs.createReadStream(filename);
	var writer = Fs.createWriteStream(filenameto);

	var ext = U.getExtension(name);
	var meta = { name: name, size: 0, width: 0, height: 0, ext: ext, custom: custom, type: U.getContentType(ext) };
	var tmp;

	writer.write(header, 'binary');

	if (IMAGES[meta.ext]) {
		reader.once('data', function(buffer) {
			switch (meta.ext) {
				case 'gif':
					tmp = framework_image.measureGIF(buffer);
					break;
				case 'png':
					tmp = framework_image.measurePNG(buffer);
					break;
				case 'jpg':
				case 'jpeg':
					tmp = framework_image.measureJPG(buffer);
					break;
				case 'svg':
					tmp = framework_image.measureSVG(buffer);
					break;
			}
		});
	}

	if (isbuffer)
		writer.end(filename);
	else
		reader.pipe(writer);

	CLEANUP(writer, function() {

		Fs.open(filenameto, 'r+', function(err, fd) {

			if (err) {
				// Unhandled error
				callback(err);
				return;
			}

			if (tmp) {
				meta.width = tmp.width;
				meta.height = tmp.height;
			}

			meta.size = writer.bytesWritten - BINARY_HEADER_LENGTH;

			self.total++;
			self.size += meta.size;

			if (meta.name.length > 250)
				meta.name = meta.name.substring(0, 250);

			header.write(JSON.stringify(meta));

			// Update header
			Fs.write(fd, header, 0, header.length, 0, function(err) {
				if (err) {
					callback(err);
					Fs.close(fd, NOOP);
				} else {
					meta.id = id;
					meta.date = NOW = new Date();
					meta.type = 'save';
					Fs.appendFile(self.logger, JSON.stringify(meta) + '\n', NOOP);
					Fs.close(fd, () => callback(null, meta));
				}
			});
		});
	});
};

Binary.prototype.update = function(id, name, buffer, custom, callback) {

	var type = framework_utils.getContentType(framework_utils.getExtension(name));
	var self = this;
	var isfn = typeof(buffer) === 'function';

	if (buffer && !(buffer instanceof Buffer)) {
		if (typeof(buffer) === 'function') {
			callback = buffer;
			buffer = custom = null;
		} else if (!buffer.resume) {
			callback = custom;
			custom = buffer;
			buffer = null;
		}
	} else if (typeof(custom) === 'function') {
		callback = custom;
		custom = null;
	}

	if (name.length > 80)
		name = name.substring(0, 80) + name.substring(name.lastIndexOf('.'));

	if (!buffer) {

		if (isfn) {
			callback = buffer;
			buffer = undefined;
		}

		F.stats.performance.open++;
		var reader = Fs.createReadStream(name);
		CLEANUP(reader);
		return self.insertstream(id, framework_utils.getName(name), type, reader, callback, custom);
	}

	if (typeof(buffer) === 'string')
		buffer = Buffer.from(buffer, 'base64');

	if (buffer.resume)
		return self.insertstream(id, name, type, buffer, callback, custom);

	var isnew = false;
	var time = NOW.format('yyyyMMdd');
	var size = buffer.length;
	var ext = framework_utils.getExtension(name);
	var dimension;
	var filepath;
	var filename;
	var cacheid = id;

	// check if it's new implementation
	if (id > 0)
		isnew = true;
	else if (id[0] === 'B' || id[0] === 'b') {
		isnew = true;
		id = +id.substring(id.length - DIRECTORYLENGTH);
	}

	if (isnew) {
		var path = self.$directory(id);
		self.check(path);
		filename = id.toString().padLeft(DIRECTORYLENGTH, '0');
		filepath = Path.join(path, filename + self.ext);
	} else {
		self.check();
		filepath = framework_utils.join(self.directory, self.db.name + '#' + id + self.ext);
	}

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

	var h = { name: name, size: size, type: type, date: time };

	if (custom)
		h.custom = custom;

	if (dimension) {
		if (dimension.width)
			h.width = dimension.width;

		if (dimension.height)
			h.height = dimension.height;
	}

	var header = Buffer.alloc(BINARY_HEADER_LENGTH);

	header.fill(' ');
	header.write(JSON.stringify(h));

	var stream = Fs.createWriteStream(filepath);
	stream.write(header, 'binary');
	stream.end(buffer);
	CLEANUP(stream);
	callback && callback(null, cacheid, h);
	self.$events.insert && self.emit('insert', cacheid, h);
	return cacheid;
};

Binary.prototype.readmeta = function(id, callback, count) {

	var self = this;

	if (count > 3) {
		callback(new Error('File not found.'));
		return self;
	}

	var version = 0;

	if (id > 0)
		version = 1;
	else if (id[0] === 'B' || id[0] === 'b') {
		id = +id.substring(id.length - DIRECTORYLENGTH);
		version = 1;
	} else if (self.ext === '.file')
		version = 2;
	else if (id.indexOf('#') === -1)
		id = self.db.name + '#' + id;

	var filename;

	if (version === 1)
		filename = Path.join(self.$directory(id), id.toString().padLeft(DIRECTORYLENGTH, '0') + self.ext);
	else if (version === 2)
		filename = Path.join(self.makedirectory(id), id + self.ext);
	else
		filename = framework_utils.join(self.directory, id + self.ext);

	F.stats.performance.open++;
	var stream = Fs.createReadStream(filename, BINARYREADMETA);
	stream.on('error', err => callback(err));
	stream.on('data', function(buffer) {
		var json = buffer.toString('utf8').replace(REGCLEAN, '');
		if (json) {
			callback(null, JSON.parse(json, jsonparser));
			CLEANUP(stream);
		} else
			setTimeout(readfileattempt, 100, self, id, callback, count || 1);
	});

	return self;
};

Binary.prototype.res = function(res, options, checkcustom, notmodified) {

	var self = this;
	var req = res.req;

	if (RELEASE && req.$key && F.temporary.notfound[req.$key] !== undefined) {
		res.throw404();
		return res;
	}

	var version = 0;
	var id = options.id || '';

	if (id > 0)
		version = 1;
	else if (id[0] === 'B' || id[0] === 'b') {
		id = +id.substring(id.length - DIRECTORYLENGTH);
		version = 1;
	} else if (self.ext === '.file')
		version = 2;
	else if (id.indexOf('#') === -1)
		id = self.db.name + '#' + id;

	var filename;

	if (version === 1)
		filename = Path.join(self.$directory(id), id.toString().padLeft(DIRECTORYLENGTH, '0') + self.ext);
	else if (version === 2)
		filename = Path.join(self.makedirectory(id), id + self.ext);
	else
		filename = framework_utils.join(self.directory, id + self.ext);

	F.stats.performance.open++;
	var stream = Fs.createReadStream(filename, BINARYREADMETA);

	stream.on('error', function() {
		if (RELEASE)
			F.temporary.notfound[F.createTemporaryKey(req)] = true;
		res.throw404();
	});

	stream.on('data', function(buffer) {
		var json = buffer.toString('utf8').replace(REGCLEAN, '');
		if (json) {

			var obj;

			try {
				obj = JSON.parse(json, jsonparser);
			} catch (e) {
				console.log('FileStorage Error:', filename, e);
				if (RELEASE)
					F.temporary.notfound[F.createTemporaryKey(req)] = true;
				res.throw404();
				return;
			}

			if (checkcustom && checkcustom(obj) == false) {
				if (RELEASE)
					F.temporary.notfound[F.createTemporaryKey(req)] = true;
				res.throw404();
				return;
			}

			var utc = obj.date ? new Date(+obj.date.substring(0, 4), +obj.date.substring(4, 6), +obj.date.substring(6, 8)).toUTCString() : '';

			if (!options.download && req.headers['if-modified-since'] === utc) {
				res.extention = U.getExtension(obj.name);
				notmodified(res, utc);
			} else {

				if (RELEASE && req.$key && F.temporary.path[req.$key]) {
					res.$file();
					return res;
				}

				res.options.type = obj.type;
				res.options.stream = Fs.createReadStream(filename, BINARYREADDATA);
				res.options.lastmodified = true;

				if (options.download) {
					res.options.download = options.download === true ? obj.name : typeof(options.download) === 'function' ? options.download(obj.name, obj.type) : options.download;
				} else {
					!options.headers && (options.headers = {});
					options.headers['Last-Modified'] = utc;
				}

				res.options.headers = options.headers;
				res.options.done = options.done;

				if (options.image) {
					res.options.make = options.make;
					res.options.cache = options.cache !== false;
					res.$image();
				} else {
					res.options.compress = options.nocompress ? false : true;
					res.$stream();
				}
			}
		} else {
			if (RELEASE)
				F.temporary.notfound[F.createTemporaryKey(req)] = true;
			res.throw404();
		}
	});
};

Binary.prototype.read = function(id, callback, count) {

	var self = this;

	if (count > 3) {
		callback(new Error('File not found.'));
		return self;
	}

	var version = 0;

	if (id > 0)
		version = 1;
	else if (id[0] === 'B' || id[0] === 'b') {
		id = +id.substring(id.length - DIRECTORYLENGTH);
		version = 1;
	} else if (self.ext === '.file')
		version = 2;
	else if (id.indexOf('#') === -1)
		id = self.db.name + '#' + id;

	var filename;

	if (version === 1)
		filename = Path.join(self.$directory(id), id.toString().padLeft(DIRECTORYLENGTH, '0') + self.ext);
	else if (version === 2)
		filename = Path.join(self.makedirectory(id), id + self.ext);
	else
		filename = framework_utils.join(self.directory, id + self.ext);

	F.stats.performance.open++;
	var stream = Fs.createReadStream(filename, BINARYREADMETA);
	stream.on('error', err => callback(err));
	stream.on('data', function(buffer) {
		var json = buffer.toString('utf8').replace(REGCLEAN, '');
		if (json) {
			var meta = JSON.parse(json, jsonparser);
			stream = Fs.createReadStream(filename, BINARYREADDATA);
			callback(null, stream, meta);
			CLEANUP(stream);
		} else
			setTimeout(readfileattempt, 100, self, id, callback, count || 1);
	});

	return self;
};

Binary.prototype.readbase64 = function(id, callback, count) {

	var self = this;

	if (count > 3) {
		callback(new Error('File not found.'));
		return self;
	}

	var version = 0;

	if (id > 0)
		version = 1;
	else if (id[0] === 'B' || id[0] === 'b') {
		id = +id.substring(id.length - DIRECTORYLENGTH);
		version = 1;
	} else if (self.ext === '.file')
		version = 2;
	else if (id.indexOf('#') === -1)
		id = self.db.name + '#' + id;

	var filename;

	if (version === 1)
		filename = Path.join(self.$directory(id), id.toString().padLeft(DIRECTORYLENGTH, '0') + self.ext);
	else if (version === 2)
		filename = Path.join(self.makedirectory(id), id + self.ext);
	else
		filename = framework_utils.join(self.directory, id + self.ext);

	F.stats.performance.open++;
	var stream = Fs.createReadStream(filename, BINARYREADMETA);
	stream.on('error', err => callback(err));
	stream.on('data', function(buffer) {
		var json = buffer.toString('utf8').replace(REGCLEAN, '');
		if (json) {
			var meta = JSON.parse(json, jsonparser);
			stream = Fs.createReadStream(filename, BINARYREADDATABASE64);
			callback(null, stream, meta);
			CLEANUP(stream);
		} else
			setTimeout(readfileattempt, 100, self, id, callback, count || 1);
	});

	return self;
};

function readfileattempt(self, id, callback, count) {
	self.read(id, callback, count + 1);
}

Binary.prototype.remove = function(id, callback) {

	var self = this;
	var cacheid = id;
	var version = 0;
	var filename;

	if (id > 0)
		version = 1;
	else if (id[0] === 'B' || id[0] === 'b') {
		version = 1;
		id = +id.substring(id.length - DIRECTORYLENGTH);
	} else if (self.ext === '.file')
		version = 2;
	else if (id.indexOf('#') === -1)
		id = self.db.name + '#' + id;

	if (version === 1) {
		var path = self.$directory(id);
		filename = Path.join(path, id.toString().padLeft(DIRECTORYLENGTH, '0') + self.ext);
	} else if (version === 2)
		filename = Path.join(self.makedirectory(id), id + self.ext);
	else
		filename = framework_utils.join(self.directory, id + self.ext);

	Fs.unlink(filename, function(err) {

		if (version === 1 && !err) {

			self.meta.count--;

			F.isCluster && cluster_send({ TYPE: 'filestorage', NAME: self.db.name, method: 'remove', count: self.meta.count, id: id });

			if (!F.id || F.id === '0') {
				self.meta.free.push(id);
				self.$save();
			}
		}

		if (!err && version === 2)
			Fs.appendFile(self.logger, JSON.stringify({ type: 'remove', id: id, date: new Date() }) + '\n', NOOP);

		callback && callback(null, err ? false : true);
	});

	self.$events.remove && self.emit('remove', cacheid);
	return self;
};

Binary.prototype.check = function(path) {

	var self = this;
	var key = self.cachekey + (path == null ? 'root' : path.substring(path.length - (DIRECTORYLENGTH + 2)));

	if (F.temporary.other[key])
		return self;

	if (path != null && !F.temporary.other[self.cachekey + 'root'])
		self.check();

	F.temporary.other[key] = true;

	try {
		Fs.mkdirSync(path ? path : self.directory);
	} catch (err) {}

	return self;
};

Binary.prototype.clear = function(callback) {

	var self = this;

	Fs.readdir(self.directory, function(err, response) {

		if (err)
			return callback(err);

		var pending = [];
		var directories =[];
		var key = self.db.name + '#';
		var l = key.length;
		var target = framework_utils.join(self.directory);

		for (var i = 0, length = response.length; i < length; i++) {
			var p = response[i];
			if (p.substring(0, l) === key)
				pending.push(target + '/' + p);
			else if (p[3] === '-' && p[7] === '-')
				directories.push(target + '/' + p);
		}

		pending.push(target + '/meta.json');
		pending.push(self.logger);
		self.$events.clear && self.emit('clear', pending.length);
		pending.length && F.unlink(pending, F.errorhandling);
		directories.wait(function(path, next) {
			Fs.readdir(path, function(err, files) {
				for (var i = 0; i < files.length; i++)
					files[i] = path + '/' + files[i];
				F.unlink(files, () => Fs.unlink(path, next));
			});
		}, function() {
			F.isCluster && cluster_send({ TYPE: 'filestorage', NAME: self.db.name, method: 'refresh' });
			callback && callback();
		});
	});

	return self;
};

Binary.prototype.browse = function(directory, callback) {
	var self = this;

	if (typeof(directory) === 'function') {
		Fs.readdir(self.directory, function(err, files) {
			var dirs = [];
			if (files && files.length) {
				for (var i = 0; i < files.length; i++) {
					var p = files[i];
					if (p[3] === '-' && p[7] === '-' || p.length === 4)
						dirs.push(p);
				}
			}
			directory(null, dirs);
		});
	} else {

		var version = directory.length === 4 ? 2 : 1;

		Fs.readdir(Path.join(self.directory, directory), function(err, response) {

			var target = framework_utils.join(self.directory, directory);
			var output = [];
			var le = self.ext.length;

			response.wait(function(item, next) {

				Fs.stat(target + '/' + item, function(err, stat) {

					if (err)
						return next();

					F.stats.performance.open++;
					var stream = Fs.createReadStream(target + '/' + item, BINARYREADMETA);

					stream.on('data', function(buffer) {
						var json = Buffer.from(buffer, 'binary').toString('utf8').replace(REGCLEAN, '').parseJSON(true);
						if (json) {
							var id = item.substring(0, item.length - le);
							if (version === 2) {
								json.id = id;
							} else {
								json.id = 'B' + json.date + 'T' + id;
								json.index = +id.substring(id.length - DIRECTORYLENGTH);
							}
							json.ctime = stat.ctime;
							json.mtime = stat.mtime;
							output.push(json);
						}
					});

					CLEANUP(stream, next);

				});

			}, () => callback(null, output), 2);

		});
	}

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
		var le = self.ext.length;

		pending.wait(function(item, next) {
			Fs.stat(target + '/' + item, function(err, stat) {

				if (err)
					return next();

				F.stats.performance.open++;
				var stream = Fs.createReadStream(target + '/' + item, BINARYREADMETA);
				stream.on('data', function(buffer) {
					var json = Buffer.from(buffer, 'binary').toString('utf8').replace(REGCLEAN, '').parseJSON(true);
					if (json) {
						json.id = item.substring(l, item.length - le);
						json.ctime = stat.ctime;
						json.mtime = stat.mtime;
						output.push(json);
					}
				});

				CLEANUP(stream, next);

			});

		}, function() {
			if (self.meta.count) {
				self.browse(function(err, directories) {
					directories.wait(function(item, next) {
						self.browse(item, function(err, files) {
							files.length && output.push.apply(output, files);
							next();
						});
					}, () => callback(null, output));
				});
			} else
				callback(null, output);
		}, 2);
	});

	return self;
};

function Storage(db, directory) {
	var t = this;
	t.db = db;
	t.directory = directory;
	t.pending = [];
	t.locked_writer = 0;
	t.locked_reader = false;
	t.exists = false;
	if (!FORK) {
		t.$mapreducefile = Path.join(db.directory, db.name + EXTENSION_MAPREDUCE);
		t.$mapreduce = [];
		t.refresh();
	}
}

const SP = Storage.prototype;

SP.refresh = function() {
	try {
		this.$mapreduce = Fs.readFileSync(this.$mapreducefile).toString('utf8').parseJSON(true);
	} catch (e) {}
	return this;
};

SP.check = function() {

	var self = this;
	if (self.exists)
		return self;

	self.exists = true;

	try {
		Fs.mkdirSync(self.directory);
	} catch (err) {}

	return self;
};

SP.insert = function(doc) {

	var self = this;

	if (doc == null) {
		if (self.pending.length) {
			var dt = NOW.format('yyyyMMdd');
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

	if (framework_builders.isSchema(doc))
		doc = doc.$clean();

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
	Fs.appendFile(self.db.filenameStorage.format(NOW.format('yyyyMMdd')), JSON.stringify(doc) + NEWLINE, function(err) {
		self.locked_writer = false;
		self.locked_reader = false;
		self.pending.length && self.insert();
		err && F.error(err, 'NoSQL storage insert: ' + self.db.name);
	});

	return self;
};

SP.stats = function(name, fn) {
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

SP.mapreduce = function(name, fn, def) {

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

SP.$mapreducesave = function() {
	var self = this;
	Fs.writeFile(self.$mapreducefile, JSON.stringify(self.$mapreduce, (k, v) => k !== 'reduce' ? v : undefined), F.errorcallback);
	return self;
};

SP.listing = function(beg, end, callback) {

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

SP.find = function(beg, end, threads) {
	var self = this;

	if (!threads)
		threads = 1;

	var builder = new DatabaseBuilder(self);

	self.listing(beg, end, function(err, storage) {

		var filters = new NoSQLReader([builder]);
		var count = (storage.length / threads) >> 0;
		var opt = { cwd: F.directory };
		var filename = module.filename.replace(/\.js$/, '') + 'crawler.js';
		var counter = 0;
		var finish = threads;

		for (var i = 0; i < threads; i++) {
			var fork = require('child_process').fork(filename, EMPTYARRAY, opt);
			var files = (i === threads - 1) ? storage : storage.splice(0, count);
			fork.send({ TYPE: 'init', files: files, builder: builder.stringify() });
			fork.on('message', function(msg) {
				counter += msg.count;
				msg.response && msg.response.length && filters.compare(msg.response);
				finish--;
				if (finish === 0) {
					filters.builders[0].count = counter;
					filters.done();
				}
			});
		}
	});

	return builder;
};

SP.count = function(beg, end, threads) {
	var builder = this.find(beg, end, threads);
	builder.$options.readertype = 1;
	return builder;
};

SP.scalar = function(beg, end, type, field, threads) {
	return this.find(beg, end, threads).scalar(type, field);
};

SP.scan = function(beg, end, mapreduce, callback, reverse) {
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

		var today = +NOW.format('yyyyMMdd');
		var process = function(item, next, index) {

			if (self.locked_read) {
				setTimeout(process, 100, item, next, index);
				return;
			}

			var reader = new NoSQLStream(item.filename);
			stats.current = item.date;
			stats.index = index;

			if (self.buffersize)
				reader.buffersize = self.buffersize;

			if (self.buffercount)
				reader.buffercount = self.buffercount;

			reader.ondocuments = function() {
				var docs = JSON.parse('[' + reader.docs + ']', jsonparser);
				for (var j = 0; j < docs.length; j++) {
					stats.documents++;
					var json = docs[j];
					var end = mapreduce(json, repository, stats) === false;
					if (end) {
						stats.canceled = true;
						return false;
					}
				}
			};

			reader.$callback = function() {
				stats.processed++;
				if (item.date === today) {
					self.locked_writer--;
					if (self.locked_writer <= 0 && self.pending.length)
						self.insert();
				}
				setImmediate(next);
			};

			reader.openread();
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

SP.clear = function(beg, end, callback) {
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

		files.wait((item, next) => remove(item.filename, next), function() {
			remove(self.$mapreducefile, () => callback && callback(null, count));
		});

	});
	return self;
};

TP.ready = function(fn) {
	var self = this;
	if (self.ready)
		fn.call(self);
	else {
		setTimeout(function(self, fn) {
			self.ready(fn);
		}, 100, self, fn);
	}
	return self;
};

TP.insert = function(doc, unique) {

	var self = this;
	var builder;

	if (framework_builders.isSchema(doc))
		doc = doc.$clean();

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
	self.pending_append.push({ doc: doc, builder: builder });
	setImmediate(next_operation, self, 1);
	self.$events.insert && self.emit('insert', doc);
	return builder;
};

TP.update = function(doc, insert) {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	builder.$options.readertype = 1;
	if (typeof(doc) === 'string')
		doc = new Function('doc', 'repository', 'arg', doc.indexOf('return ') === -1 ? ('return (' + doc + ')') : doc);
	self.pending_update.push({ builder: builder, doc: doc, count: 0, insert: insert === true ? doc : insert });
	setImmediate(next_operation, self, 2);
	return builder;
};

TP.modify = function(doc, insert) {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	var data = framework_builders.isSchema(doc) ? doc.$clean() : doc;
	var keys = Object.keys(data);
	if (keys.length) {
		var inc = null;
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			switch (key[0]) {
				case '!':
				case '+':
				case '-':
				case '*':
				case '/':
					!inc && (inc = {});
					var tmp = key.substring(1);
					inc[tmp] = key[0];
					doc[tmp] = doc[key];
					doc[key] = undefined;
					keys[i] = tmp;
					break;
				case '$':
					tmp = key.substring(1);
					doc[tmp] = new Function('value', 'doc', 'repository', 'arg', doc[key].indexOf('return ') === -1 ? ('return (' + doc[key] + ')') : doc[key]);
					doc[key] = undefined;
					keys[i] = tmp;
					break;
			}
		}
		builder.$options.readertype = 1;
		self.pending_update.push({ builder: builder, doc: data, count: 0, keys: keys, inc: inc, insert: insert === true ? data : insert });
		setImmediate(next_operation, self, 2);
	}
	return builder;
};

TP.remove = function() {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	self.pending_remove.push(builder);
	builder.$options.readertype = 1;
	setImmediate(next_operation, self, 3);
	return builder;
};

TP.listing = TP.list = function(builder) {
	var self = this;
	self.readonly && self.throwReadonly();
	if (builder)
		builder.db = self;
	else
		builder = new DatabaseBuilder(self);
	builder.$options.listing = true;
	builder.$take = builder.$options.take = 100;
	self.pending_reader.push(builder);
	setImmediate(next_operation, self, 4);
	return builder;
};

TP.find = function(builder) {
	var self = this;
	self.readonly && self.throwReadonly();
	if (builder)
		builder.db = self;
	else
		builder = new DatabaseBuilder(self);
	self.pending_reader.push(builder);
	setImmediate(next_operation, self, 4);
	return builder;
};

TP.find2 = function(builder) {
	var self = this;
	if (builder)
		builder.db = self;
	else {
		builder = new DatabaseBuilder(self);
		builder.$options.notall = true;
	}

	self.pending_reader2.push(builder);
	setImmediate(next_operation, self, 11);
	return builder;
};

TP.stream = function(fn, repository, callback) {
	var self = this;
	self.readonly && self.throwReadonly();

	if (typeof(repository) === 'function') {
		callback = repository;
		repository = null;
	}

	self.pending_streamer.push({ fn: fn, callback: callback, repository: repository || {} });
	setImmediate(next_operation, self, 10);
	return self;
};

TP.extend = function(schema, callback) {
	var self = this;
	self.readonly && self.throwReadonly();
	self.lock(function(next) {

		var olds = self.$schema;
		var oldk = self.$keys;
		var oldl = self.$size;
		var oldh = Buffer.byteLength(self.stringifySchema() + NEWLINE);

		self.parseSchema(schema.replace(/;|,/g, '|').trim().split('|'));

		var meta = self.stringifySchema() + NEWLINE;
		var news = self.$schema;
		var newk = self.$keys;
		self.$schema = olds;
		self.$keys = oldk;

		var count = 0;
		var fs = new NoSQLStream(self.filename);
		var data = {};
		var tmp = self.filename + '-tmp';
		var writer = Fs.createWriteStream(tmp);

		if (self.buffersize)
			fs.buffersize = self.buffersize;

		if (self.buffercount)
			fs.buffercount = self.buffercount;

		writer.write(meta, 'utf8');
		writer.on('finish', function() {
			Fs.rename(tmp, self.filename, function() {
				next();
				callback && callback();
			});
		});

		data.keys = self.$keys;
		fs.start = oldh;
		fs.divider = '\n';

		if (oldl)
			self.linesize = oldl;

		var size = self.$size;

		fs.ondocuments = function() {

			var lines = fs.docs.split(fs.divider);
			var items = [];

			self.$schema = olds;
			self.$keys = oldk;
			self.$size = oldl;

			for (var a = 0; a < lines.length; a++) {
				data.line = lines[a].split('|');
				data.index = count++;
				var doc = self.parseData(data);
				items.push(doc);
			}

			self.$schema = news;
			self.$keys = newk;

			self.$size = size;
			var buffer = '';
			for (var i = 0; i < items.length; i++)
				buffer += self.stringify(items[i], true) + NEWLINE;
			buffer && writer.write(buffer, 'utf8');
		};

		fs.$callback = function() {
			self.$schema = news;
			self.$keys = newk;
			self.$header = Buffer.byteLength(meta);
			writer.end();
			fs = null;
		};

		fs.openread();
	});

	return self;
};


TP.throwReadonly = function() {
	throw new Error('Table "{0}" doesn\'t contain any schema'.format(this.name));
};

TP.scalar = function(type, field) {
	return this.find().scalar(type, field);
};

TP.count = function() {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	builder.$options.readertype = 1;
	self.pending_reader.push(builder);
	setImmediate(next_operation, self, 4);
	return builder;
};

TP.one = TP.read = function() {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	builder.first();
	self.pending_reader.push(builder);
	setImmediate(next_operation, self, 4);
	return builder;
};

TP.one2 = TP.read2 = function() {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	builder.first();
	self.pending_reader2.push(builder);
	setImmediate(next_operation, self, 11);
	return builder;
};

TP.top = function(max) {
	var self = this;
	self.readonly && self.throwReadonly();
	var builder = new DatabaseBuilder(self);
	builder.take(max);
	self.pending_reader.push(builder);
	setImmediate(next_operation, self, 4);
	return builder;
};

TP.next = function(type) {

	if (!this.ready || (type && NEXTWAIT[this.step]))
		return;

	if (F.isCluster && type === 0 && this.locked)
		clusterunlock(this);

	if (!this.$writting && !this.$reading) {

		if (this.step !== 12 && this.pending_clear.length) {
			if (!this.readonly && F.isCluster)
				clusterlock(this, '$clear');
			else
				this.$clear();
			return;
		}

		if (this.step !== 13 && this.pending_clean.length) {
			if (!this.readonly && F.isCluster)
				clusterlock(this, '$clean');
			else
				this.$clean();
			return;
		}

		if (this.step !== 7 && !this.pending_reindex && this.pending_drops) {
			this.$drop();
			return;
		}

		if (this.step !== 14 && this.pending_locks.length) {
			this.$lock();
			return;
		}
	}

	if (!this.$writting) {

		if (this.step !== 1 && !this.pending_reindex && this.pending_append.length) {
			this.$append();
			return;
		}

		if (this.step !== 2 && !this.$writting && this.pending_update.length) {
			if (!this.readonly && F.isCluster)
				clusterlock(this, '$update');
			else
				this.$update();
			return;
		}

		if (this.step !== 3 && !this.$writting && this.pending_remove.length) {
			if (!this.readonly && F.isCluster)
				clusterlock(this, '$remove');
			else
				this.$remove();
			return;
		}
	}

	if (!this.$reading) {

		if (this.step !== 4 && this.pending_reader.length) {
			this.$reader();
			return;
		}

		if (this.step !== 11 && this.pending_reader2.length) {
			this.$reader3();
			return;
		}

		if (this.step !== 10 && this.pending_streamer.length) {
			this.$streamer();
			return;
		}
	}

	if (this.step !== type) {
		this.step = 0;
		setImmediate(next_operation, this, 0);
	}
};

TP.$append = function() {
	var self = this;
	self.step = 1;

	if (!self.pending_append.length) {
		self.next(0);
		return;
	}

	self.$writting = true;

	self.pending_append.splice(0).limit(JSONBUFFER, function(items, next) {

		var data = '';

		for (var i = 0, length = items.length; i < length; i++)
			data += self.stringify(items[i].doc, true) + NEWLINE;

		Fs.appendFile(self.filename, data, function(err) {
			err && F.error(err, 'Table insert: ' + self.name);
			for (var i = 0, length = items.length; i < length; i++) {
				items[i].builder.$options.log && items[i].builder.log();
				var callback = items[i].builder.$callback;
				callback && callback(err, 1);
			}
			next();
		});

	}, () => setImmediate(next_append, self));
};

TP.$reader = function() {

	var self = this;

	self.step = 4;

	if (!self.pending_reader.length) {
		self.next(0);
		return self;
	}

	self.$reading = true;

	var fs = new NoSQLStream(self.filename);
	var filters = new NoSQLReader(self.pending_reader.splice(0));
	var data = {};
	var indexer = 0;

	fs.array = true;
	fs.start = self.$header;
	fs.linesize = self.$size;
	fs.divider = '\n';

	data.keys = self.$keys;

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	fs.ondocuments = function() {

		var lines = fs.docs;
		var arr = [];

		for (var j = 0; j < lines.length; j++) {
			data.line = lines[j].split('|');
			data.index = indexer++;
			arr.push(self.parseData(data));
		}

		return filters.compare(arr);
	};

	fs.$callback = function() {
		filters.done();
		fs = null;
		self.$reading = false;
		self.next(0);
	};

	fs.openread();
	return self;
};

TP.$reader3 = function() {

	var self = this;

	self.step = 11;

	if (!self.pending_reader2.length) {
		self.next(0);
		return self;
	}

	self.$reading = true;

	var fs = new NoSQLStream(self.filename);
	var filters = new NoSQLReader(self.pending_reader2.splice(0));
	var data = {};
	var indexer = 0;

	fs.array = true;
	fs.start = self.$header;
	fs.linesize = self.$size;
	fs.divider = '\n';
	data.keys = self.$keys;

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	fs.ondocuments = function() {

		var lines = fs.docs;
		var arr = [];

		for (var j = 0; j < lines.length; j++) {
			data.line = lines[j].split('|');
			if (TABLERECORD[data.line[0]]) {
				data.index = indexer++;
				arr.push(self.parseData(data));
			}
		}

		return filters.compare(arr);
	};

	fs.$callback = function() {
		filters.done();
		fs = null;
		self.$reading = false;
		self.next(0);
	};

	fs.openreadreverse();
	return self;
};

TP.$update = function() {

	var self = this;
	self.step = 2;

	if (!self.pending_update.length) {
		self.next(0);
		return self;
	}

	self.$writting = true;

	var fs = new NoSQLStream(self.filename);
	var filter = self.pending_update.splice(0);
	var filters = new NoSQLReader();
	var change = false;
	var indexer = 0;
	var data = { keys: self.$keys };

	for (var i = 0; i < filter.length; i++)
		filters.add(filter[i].builder, true);

	fs.array = true;
	fs.start = self.$header;
	fs.linesize = self.$size;
	fs.divider = '\n';

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	var update = function(docs, doc, dindex, f, findex) {

		var rec = fs.docsbuffer[dindex];
		var fil = filter[findex];
		var e = fil.keys ? 'modify' : 'update';
		var old = self.$events[e] ? CLONE(doc) : 0;

		if (f.first)
			f.canceled = true;

		if (fil.keys) {
			for (var j = 0; j < fil.keys.length; j++) {
				var key = fil.keys[j];
				var val = fil.doc[key];
				if (val !== undefined) {
					if (typeof(val) === 'function')
						doc[key] = val(doc[key], doc, f.filter.repository, f.filter.arg);
					else if (fil.inc && fil.inc[key]) {
						switch (fil.inc[key]) {
							case '!':
								doc[key] = doc[key] == null ? true : !doc[key];
								break;
							case '+':
								doc[key] = (doc[key] || 0) + val;
								break;
							case '-':
								doc[key] = (doc[key] || 0) - val;
								break;
							case '*':
								doc[key] = (doc[key] || 0) + val;
								break;
							case '/':
								doc[key] = (doc[key] || 0) / val;
								break;
						}
					} else
						doc[key] = val;
				}
			}
		} else
			docs[dindex] = typeof(fil.doc) === 'function' ? (fil.doc(doc, f.filter.repository, f.filter.arg) || doc) : fil.doc;

		self.$events[e] && self.emit(e, doc, old);
		f.builder.$options.backup && f.builder.$backupdoc(rec.doc);
	};

	var updateflush = function(docs, doc, dindex) {

		doc = docs[dindex];

		var rec = fs.docsbuffer[dindex];
		var upd = self.stringify(doc, null, rec.length);

		if (upd === rec.doc)
			return;

		!change && (change = true);

		var b = Buffer.byteLength(upd);
		if (rec.length === b) {
			fs.write(upd + NEWLINE, rec.position);
		} else {
			var tmp = fs.remchar + rec.doc.substring(1) + NEWLINE;
			fs.write(tmp, rec.position);
			fs.write2(upd + NEWLINE);
		}
	};

	fs.ondocuments = function() {

		var lines = fs.docs;
		var arr = [];

		for (var a = 0; a < lines.length; a++) {
			data.line = lines[a].split('|');
			data.length = lines[a].length;
			data.index = indexer++;
			arr.push(self.parseData(data, EMPTYOBJECT));
		}

		filters.compare2(arr, update, updateflush);
	};

	fs.$callback = function() {

		fs = null;
		self.$writting = false;
		self.next(0);

		for (var i = 0; i < filters.builders.length; i++) {
			var item = filters.builders[i];
			var fil = filter[i];
			if (fil.insert && !item.count) {
				item.builder.$insertcallback && item.builder.$insertcallback(fil.insert, item.filter ? item.filter.repository : EMPTYOBJECT);
				var tmp = self.insert(fil.insert);
				tmp.$callback = item.builder.$callback;
				tmp.$options.log = item.builder.$options.log;
				item.builder.$callback = null;
			} else {
				item.builder.$options.log && item.builder.log();
				item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.counter), item.counter, item.count, item.filter ? item.filter.repository : EMPTYOBJECT);
			}
		}

		if (change) {
			self.$events.change && self.emit('change', 'update');
			!F.databasescleaner[self.$name] && (F.databasescleaner[self.$name] = 1);
		}
	};

	fs.openupdate();
	return self;
};

TP.$remove = function() {

	var self = this;
	self.step = 3;

	if (!self.pending_remove.length) {
		self.next(0);
		return;
	}

	self.$writting = true;

	var fs = new NoSQLStream(self.filename);
	var filter = self.pending_remove.splice(0);
	var filters = new NoSQLReader(filter);
	var change = false;
	var indexer = 0;

	fs.array = true;
	fs.start = self.$header;
	fs.linesize = self.$size;
	fs.divider = '\n';

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	var data = { keys: self.$keys };

	var remove = function(docs, d, dindex, f) {
		var rec = fs.docsbuffer[dindex];
		f.builder.$options.backup && f.builder.$backupdoc(rec.doc);
		return 1;
	};

	var removeflush = function(docs, d, dindex) {
		var rec = fs.docsbuffer[dindex];
		!change && (change = true);
		self.$events.remove && self.emit('remove', d);
		fs.write(fs.remchar + rec.doc.substring(1) + NEWLINE, rec.position);
	};

	fs.ondocuments = function() {

		var lines = fs.docs;
		var arr = [];

		for (var a = 0; a < lines.length; a++) {
			data.line = lines[a].split('|');
			data.index = indexer++;
			arr.push(self.parseData(data));
		}

		filters.compare2(arr, remove, removeflush);
	};

	fs.$callback = function() {
		filters.done();
		fs = null;
		self.$writting = false;
		self.next(0);
		if (change) {
			self.$events.change && self.emit('change', 'remove');
			!F.databasescleaner[self.$name] && (F.databasescleaner[self.$name] = 1);
		}
	};

	fs.openupdate();
};

TP.$clean = function() {

	var self = this;
	self.step = 13;

	if (!self.pending_clean.length) {
		self.next(0);
		return;
	}

	var filter = self.pending_clean.splice(0);
	var length = filter.length;
	var now = Date.now();

	F.databasescleaner[self.$name] = undefined;
	CONF.nosql_logger && PRINTLN('NoSQL Table "{0}" cleaning (beg)'.format(self.name));

	var fs = new NoSQLStream(self.filename);
	var writer = Fs.createWriteStream(self.filename + '-tmp');

	writer.write(self.stringifySchema() + NEWLINE);

	fs.start = self.$header;
	fs.linesize = self.$size;
	fs.divider = NEWLINE;

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	fs.ondocuments = function() {
		fs.docs && writer.write(fs.docs + NEWLINE);
	};

	fs.$callback = function() {
		writer.end();
	};

	writer.on('finish', function() {
		Fs.rename(self.filename + '-tmp', self.filename, function() {
			CONF.nosql_logger && PRINTLN('NoSQL Table "{0}" cleaning (end, {1}s)'.format(self.name, (((Date.now() - now) / 1000) >> 0)));
			for (var i = 0; i < length; i++)
				filter[i]();
			self.$events.clean && self.emit('clean');
			self.next(0);
			fs = null;
		});
	});

	fs.openread();
};

TP.$clear = function() {

	var self = this;
	self.step = 12;

	if (!self.pending_clear.length) {
		self.next(0);
		return;
	}

	var filter = self.pending_clear.splice(0);
	Fs.unlink(self.filename, function() {
		for (var i = 0; i < filter.length; i++)
			filter[i]();

		Fs.appendFile(self.filename, self.stringifySchema() + NEWLINE, function() {
			self.$events.change && self.emit('change', 'clear');
			self.next(0);
		});
	});
};

TP.$lock = function() {

	var self = this;
	self.step = 14;

	if (!self.pending_locks.length) {
		self.next(0);
		return;
	}

	var filter = self.pending_locks.splice(0);
	filter.wait(function(fn, next) {
		fn.call(self, next);
	}, function() {
		self.next(0);
	});
};

TP.$streamer = function() {

	var self = this;
	self.step = 10;

	if (!self.pending_streamer.length) {
		self.next(0);
		return self;
	}

	self.$reading = true;

	var filter = self.pending_streamer.splice(0);
	var length = filter.length;
	var count = 0;
	var fs = new NoSQLStream(self.filename);
	var data = {};

	data.keys = self.$keys;

	fs.array = true;
	fs.start = self.$header;
	fs.divider = '\n';

	if (self.buffersize)
		fs.buffersize = self.buffersize;

	if (self.buffercount)
		fs.buffercount = self.buffercount;

	fs.ondocuments = function() {
		var lines = fs.docs;
		for (var a = 0; a < lines.length; a++) {
			data.line = lines[a].split('|');
			data.index = count++;
			var doc = self.parseData(data);
			for (var i = 0; i < length; i++)
				filter[i].fn(doc, filter[i].repository, count);
		}
	};

	fs.$callback = function() {
		for (var i = 0; i < length; i++)
			filter[i].callback && filter[i].callback(null, filter[i].repository, count);
		self.$reading = false;
		self.next(0);
		fs = null;
	};

	fs.openread();
	return self;
};

TP.allocations = function(enable) {
	this.$allocations = enable;
	return this;
};

TP.parseSchema = function() {
	var self = this;
	var arr = arguments[0] instanceof Array ? arguments[0] : arguments;
	var sized = true;

	self.$schema = {};
	self.$keys = [];
	self.$size = 2;

	for (var i = 0; i < arr.length; i++) {
		var arg = arr[i].split(':');
		var type = 0;
		var T = (arg[1] || '').toLowerCase().trim();
		var size = 0;

		var index = T.indexOf('(');
		if (index != -1) {
			size = +T.substring(index + 1, T.lastIndexOf(')'));
			T = T.substring(0, index);
		}

		switch (T) {
			case 'number':
				type = 2;
				!size && (size = 16);
				break;
			case 'boolean':
			case 'bool':
				type = 3;
				size = 1;
				break;
			case 'date':
				type = 4;
				size = 13;
				break;
			case 'object':
				type = 5;
				size = 0;
				sized = false;
				break;
			case 'string':
			default:
				type = 1;
				if (!size)
					sized = false;
				break;
		}
		var name = arg[0].trim();
		self.$schema[name] = { type: type, pos: i, size: size };
		self.$keys.push(name);
		self.$size += size + 1;
	}

	if (sized) {
		self.$allocations = false;
		self.$size++; // newline
	} else
		self.$size = 0;

	return self;
};

TP.stringifySchema = function() {

	var self = this;
	var data = [];

	for (var i = 0; i < self.$keys.length; i++) {

		var key = self.$keys[i];
		var meta = self.$schema[key];
		var type = 'string';

		switch (meta.type) {
			case 2:

				type = 'number';

				// string
				if (self.$size && meta.size !== 16)
					type += '(' + (meta.size) + ')';

				break;

			case 3:
				type = 'boolean';
				break;
			case 4:
				type = 'date';
				break;
			case 5:
				type = 'object';
				break;
			default:
				// string
				if (meta.size)
					type += '(' + (meta.size) + ')';
				break;
		}

		data.push(key + ':' + type);
	}

	return data.join('|');
};

TP.parseData = function(data, cache) {

	var self = this;
	var obj = {};
	var esc = data.line[0] === '*';
	var val, alloc;

	if (cache && !self.$size && data.keys.length === data.line.length - 2)
		alloc = data.line[data.line.length - 1].length;

	for (var i = 0; i < data.keys.length; i++) {
		var key = data.keys[i];

		if (cache && cache !== EMPTYOBJECT && cache[key] != null) {
			obj[key] = cache[key];
			continue;
		}

		var meta = self.$schema[key];
		if (meta == null)
			continue;

		var pos = meta.pos + 1;
		var line = data.line[pos];

		if (self.$size) {
			for (var j = line.length - 1; j > -1; j--) {
				if (line[j] !== ' ') {
					line = line.substring(0, j + 1);
					break;
				}
			}
		}

		switch (meta.type) {
			case 1: // String
				obj[key] = line;
				if (esc && obj[key])
					obj[key] = obj[key].replace(REGTUNESCAPE, regtescapereverse);
				if (self.$size && obj[key].indexOf('\\u') !== -1)
					obj[key] = obj[key].fromUnicode();
				break;
			case 2: // Number
				val = +line;
				obj[key] = val < 0 || val > 0 ? val : 0;
				break;
			case 3: // Boolean
				val = line;
				obj[key] = BOOLEAN[val] == 1;
				break;
			case 4: // Date
				val = line;
				obj[key] = val ? new Date(val[10] === 'T' ? val : +val) : null;
				break;
			case 5: // Object
				val = line;
				if (esc && val)
					val = val.replace(REGTUNESCAPE, regtescapereverse);
				if (self.$size && obj[key].indexOf('\\u') !== -1)
					obj[key] = obj[key].fromUnicode();
				obj[key] = val ? val.parseJSON(true) : null;
				break;
		}
	}

	alloc >= 0 && (obj.$$alloc = { size: alloc, length: data.length });
	return obj;
};

TP.stringify = function(doc, insert, byteslen) {

	var self = this;
	var output = '';
	var esc = false;
	var size = 0;

	for (var i = 0; i < self.$keys.length; i++) {
		var key = self.$keys[i];
		var meta = self.$schema[key];
		var val = doc[key];

		switch (meta.type) {
			case 1: // String

				if (self.$size) {
					switch (typeof(val)) {
						case 'number':
							val = val + '';
							break;
						case 'boolean':
							val = val ? '1' : '0';
							break;
						case 'object':
							var is = !!val;
							val = JSON.stringify(val);
							if (!is)
								val = val.toUnicode();
							break;
						case 'string':
							val = val.toUnicode();
							break;
					}

					if (val.length > meta.size)
						val = val.substring(0, meta.size);
					else
						val = val.padRight(meta.size, ' ');

					// bytes
					var diff = meta.size - Buffer.byteLength(val);
					if (diff > 0) {
						for (var j = 0; j < diff; j++)
							val += ' ';
					}

				} else {
					val = val ? val : '';
					if (meta.size && val.length > meta.sized)
						val = val.substring(0, meta.size);
					size += 4;
				}

				break;
			case 2: // Number
				val = (val || 0) + '';
				if (self.$size) {
					if (val.length < meta.size)
						val = val.padRight(meta.size, ' ');
				} else
					size += 2;
				break;

			case 3: // Boolean
				val = (val == true ? '1' : '0');
				break;

			case 4: // Date
				val = val ? val instanceof Date ? val.getTime() : val : '';
				if (self.$size)
					val = (val + '').padRight(meta.size, ' ');
				else if (!val)
					size += 10;
				break;

			case 5: // Object
				val = val ? JSON.stringify(val) : '';
				size += 4;
				break;
		}

		if (!esc && (meta.type === 1 || meta.type === 5)) {
			val += '';
			if (REGTESCAPETEST.test(val)) {
				esc = true;
				val = val.replace(REGTESCAPE, regtescape);
			}
		}

		output += '|' + val;
	}

	if (self.$size && (insert || byteslen)) {
		output += '|';
	} else if (doc.$$alloc) {
		var l = output.length;
		var a = doc.$$alloc;
		if (l <= a.length) {
			var s = (a.length - l) - 1;
			if (s > 0) {
				output += '|'.padRight(s, '.');
				if (byteslen) {
					var b = byteslen - Buffer.byteLength(output);
					if (b > 0) {
						b--;
						for (var i = 0; i < b; i++)
							output += '.';
					} else {
						var c = s - b;
						if (c > 0)
							output = output.substring(0, (output.length + b) - 1);
					}
				}
			} else if (s === 0)
				output += '|';
			else
				insert = true;
		} else
			insert = true;
	} else
		insert = true;

	if (insert && size && self.$allocations)
		output += '|'.padRight(size, '.');

	return (esc ? '*' : '+') + output;
};

function regtescapereverse(c) {
	switch (c) {
		case '%0A':
			return '\n';
		case '%0D':
			return '\r';
		case '%7C':
			return '|';
	}
	return c;
}

function regtescape(c) {
	switch (c) {
		case '\n':
			return '%0A';
		case '\r':
			return '%0D';
		case '|':
			return '%7C';
	}
	return c;
}

TP.free = function(force) {
	var self = this;
	if (!force && !self.$free)
		return self;
	self.removeAllListeners(true);
	delete F.databases[self.$name];
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
		case 'hour':
			type = 'getHour()';
			break;
		case 'minute':
			type = 'getMinute()';
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

function NoSQLReader(builder) {
	var self = this;
	self.builders = [];
	self.canceled = 0;
	builder && self.add(builder);
}

NoSQLReader.prototype.add = function(builder, noTrimmer) {
	var self = this;
	if (builder instanceof Array) {
		for (var i = 0; i < builder.length; i++)
			self.add(builder[i]);
	} else {
		var item = {};
		item.scalarcount = 0;
		item.all = 0;
		item.count = 0;
		item.counter = 0;
		item.builder = builder;

		if (builder.$rule) {
			builder.$inlinesort = !!(builder.$options.take && builder.$options.sort && builder.$options.sort !== null);
			builder.$limit = (builder.$options.take || 0) + (builder.$options.skip || 0);
			item.rule = builder.$rule;
			item.params = builder.$params;
			item.fields = builder.$options.fields;
			item.fields2 = builder.$options.fields2 ? Object.keys(builder.$options.fields2) : null;
			item.sort = builder.$options.sort;
		} else {
			item.filter = builder.makefilter();
			item.compare = builder.compile(noTrimmer);
		}

		item.first = builder.$options.first && !builder.$options.sort;

		builder.$nosqlreader = self;
		self.builders.push(item);
	}
	return self;
};

NoSQLReader.prototype.compare2 = function(docs, custom, done) {
	var self = this;

	for (var i = 0; i < docs.length; i++) {

		var doc = docs[i];
		if (doc === EMPTYOBJECT)
			continue;

		if (self.builders.length === self.canceled)
			return false;

		var is = false;

		for (var j = 0; j < self.builders.length; j++) {

			var item = self.builders[j];
			if (item.canceled)
				continue;

			var output = item.compare ? item.compare(doc, item.filter, item.all++) : (item.rule(doc, item.params, item.all++) ? doc : null);
			if (!output)
				continue;

			if (item.rule) {
				if (item.fields) {

					var clean = {};

					for (var $i = 0; $i < item.fields.length; $i++) {
						var prop = item.fields[$i];
						clean[prop] = output[prop];
					}

					if (item.sort)
						clean[item.sort.name] = output[item.sort.name];

					output = clean;
				} else if (item.fields2) {
					for (var $i = 0; $i < item.fields2.length; $i++)
						delete output[item.fields2[$i]];
				}
			}

			// WTF?
			// item.is = false;

			item.count++;

			if ((item.builder.$options.skip && item.builder.$options.skip >= item.count) || (item.builder.$options.take && item.builder.$options.take <= item.counter))
				continue;

			!is && (is = true);

			item.counter++;
			item.builder.$each && item.builder.$each(item, doc);

			var canceled = item.canceled;
			var c = custom(docs, output, i, item, j);

			if (item.first) {
				item.canceled = true;
				self.canceled++;
			} else if (!canceled && item.canceled)
				self.canceled++;

			if (c === 1)
				break;
			else
				continue;
		}

		is && done && done(docs, doc, i, self.builders);
	}
};

NoSQLReader.prototype.compare = function(docs) {

	var self = this;

	for (var i = 0; i < docs.length; i++) {

		var doc = self.clone ? U.clone(docs[i]) : docs[i];

		if (self.builders.length === self.canceled)
			return false;

		for (var j = 0; j < self.builders.length; j++) {

			var item = self.builders[j];
			if (item.canceled)
				continue;

			var output = item.compare ? item.compare(doc, item.filter, item.all++) : (item.rule(doc, item.params, item.all++) ? doc : null);
			if (!output)
				continue;

			if (item.rule) {
				if (item.fields) {

					var clean = {};

					for(var $i = 0; $i < item.fields.length; $i++) {
						var prop = item.fields[$i];
						clean[prop] = output[prop];
					}

					if (item.sort)
						clean[item.sort.name] = output[item.sort.name];

					output = clean;
				} else if (item.fields2) {
					for (var $i = 0; $i < item.fields2.length; $i++)
						delete output[item.fields2[$i]];
				}
			}

			var b = item.builder;
			item.count++;

			if (!b.$inlinesort && ((b.$options.skip && b.$options.skip >= item.count) || (b.$options.take && b.$options.take <= item.counter)))
				continue;

			item.counter++;

			if (b.$options.notall && !b.$inlinesort && !item.done)
				item.done = b.$options.take && b.$options.take <= item.counter;

			if (b.$options.readertype)
				continue;

			b.$each && b.$each(item, output);
			b.$mappersexec && b.$mappersexec(output, item);

			var val;

			switch (b.$options.scalar) {
				case 'count':
					item.scalar = item.scalar ? item.scalar + 1 : 1;
					break;
				case 'sum':
					val = output[b.$options.scalarfield] || 0;
					item.scalar = item.scalar ? item.scalar + val : val;
					break;
				case 'min':
					val = output[b.$options.scalarfield] || 0;
					if (val != null) {
						if (item.scalar) {
							if (item.scalar > val)
								item.scalar = val;
						} else
							item.scalar = val;
					}
					break;
				case 'max':
					val = output[b.$options.scalarfield];
					if (val != null) {
						if (item.scalar) {
							if (item.scalar < val)
								item.scalar = val;
						} else
							item.scalar = val;
					}
					break;
				case 'avg':
					val = output[b.$options.scalarfield];
					if (val != null) {
						item.scalar = item.scalar ? item.scalar + val : val;
						item.scalarcount++;
					}
					break;
				case 'group':
					!item.scalar && (item.scalar = {});
					val = output[b.$options.scalarfield];
					if (val != null) {
						if (item.scalar[val])
							item.scalar[val]++;
						else
							item.scalar[val] = 1;
					}
					break;
				default:
					if (b.$inlinesort)
						nosqlinlinesorter(item, b, output);
					else if (item.response)
						item.response.push(output);
					else
						item.response = [output];
					break;
			}

			if (item.first || item.done) {
				item.canceled = true;
				self.canceled++;
			}
		}
	}
};

NoSQLReader.prototype.reset = function() {
	var self = this;
	for (var i = 0; i < self.builders.length; i++) {
		var item = self.builders[i];
		item.canceled = false;
		item.response = null;
		item.scalar = null;
		item.counter = 0;
		item.count = 0;
		item.scalarcount = 0;
	}
	self.canceled = 0;
	return self;
};

NoSQLReader.prototype.callback = function(item) {

	var self = this;
	var builder = item.builder;
	var output;
	var opt = builder.$options;

	if (item.canceled) {
		item.canceled = false;
		if (self.canceled)
			self.canceled--;
	}

	if (opt.scalar || !opt.sort) {
		if (opt.scalar)
			output = opt.scalar === 'avg' ? item.scalar / item.scalarcount : item.scalar;
		else if (opt.first)
			output = item.response ? item.response[0] : undefined;
		else if (opt.listing)
			output = listing(builder, item);
		else
			output = item.response || [];

		builder.$callback2(errorhandling(null, builder, output), opt.readertype === 1 ? item.counter : output, item.count, item.filter ? item.filter.repository : item.params);
		return self;
	}

	if (item.count) {

		if (opt.sort === null)
			item.response.random();
		else if (opt.sort.name) {
			if (!builder.$inlinesort || opt.take !== item.response.length)
				item.response.quicksort(opt.sort.name, opt.sort.asc);
		}

		if (opt.skip && opt.take)
			item.response = item.response.splice(opt.skip, opt.take);
		else if (opt.skip)
			item.response = item.response.splice(opt.skip);
		else if (!builder.$inlinesort && opt.take)
			item.response = item.response.splice(0, opt.take);
	}

	if (opt.first)
		output = item.response ? item.response[0] : undefined;
	else if (opt.listing)
		output = listing(builder, item);
	else
		output = item.response || [];

	builder.$callback2(errorhandling(null, builder, output), opt.readertype === 1 ? item.counter : output, item.count, item.filter ? item.filter.repository : item.params);
	return self;
};

NoSQLReader.prototype.done = function() {
	var self = this;
	for (var i = 0; i < self.builders.length; i++)
		self.callback(self.builders[i]);
	self.canceled = 0;
	return self;
};

// Converting values
var convert = function(value, type) {

	if (type === undefined || type === String)
		return value;

	if (type === Number)
		return value.trim().parseFloat();

	if (type === Date) {
		value = value.trim();
		if (value.indexOf(' ') !== -1)
			return NOW.add('-' + value);
		if (value.length < 8) {
			var tmp;
			var index = value.indexOf('-');
			if (index !== -1) {
				tmp = value.split('-');
				value = NOW.getFullYear() + '-' + (tmp[0].length > 1 ? '' : '0') + tmp[0] + '-' + (tmp[1].length > 1 ? '' : '0') + tmp[1];
			} else {
				index = value.indexOf('.');
				if (index !== -1) {
					tmp = value.split('.');
					value = NOW.getFullYear() + '-' + (tmp[1].length > 1 ? '' : '0') + tmp[0] + '-' + (tmp[0].length > 1 ? '' : '0') + tmp[1];
				} else {
					index = value.indexOf(':');
					if (index !== -1) {
						// hours
					} else if (value.length <= 4) {
						value = +value;
						return value || 0;
					}
				}
			}
		}

		return value.trim().parseDate();
	}

	if (type === Boolean)
		return value.trim().parseBoolean();

	return value;
};

DatabaseBuilder.prototype.gridfields = function(fields, allowed) {

	var self = this;

	if (typeof(fields) !== 'string') {
		if (allowed)
			self.options.fields = allowed.slice(0);
		return self;
	}

	fields = fields.replace(REG_FIELDS_CLEANER, '').split(',');

	if (!self.options.fields)
		self.options.fields = [];

	var count = 0;

	for (var i = 0; i < fields.length; i++) {
		var field = fields[i];
		var can = !allowed;
		if (!can) {
			for (var j = 0; j < allowed.length; j++) {
				if (allowed[j] === field) {
					can = true;
					break;
				}
			}
		}
		if (can) {
			self.options.fields.push(self.options.dbname === 'pg' ? ('"' + fields[i] + '"') : fields[i]);
			count++;
		}
	}

	if (!count)
		self.options.fields = allowed.slice(0);

	return self;
};

// Grid filtering
DatabaseBuilder.prototype.gridfilter = function(name, obj, type, key) {

	var builder = this;
	var value = obj[name];
	var arr, val;

	if (!key)
		key = name;

	// Between
	var index = value.indexOf(' - ');
	if (index !== -1) {

		arr = value.split(' - ');

		for (var i = 0, length = arr.length; i < length; i++) {
			var item = arr[i].trim();
			arr[i] = convert(item, type);
		}

		if (type === Date) {
			if (typeof(arr[0]) === 'number') {
				arr[0] = new Date(arr[0], 1, 1, 0, 0, 0);
				arr[1] = new Date(arr[1], 11, 31, 23, 59, 59);
			} else
				arr[1] = arr[1].extend('23:59:59');
		}

		return builder.between(key, arr[0], arr[1]);
	}

	// Multiple values
	index = value.indexOf(',');
	if (index !== -1) {

		var arr = value.split(',');

		if (type === undefined || type === String) {
			builder.or();
			for (var i = 0, length = arr.length; i < length; i++) {
				var item = arr[i].trim();
				builder.search(key, item);
			}
			builder.end();
			return builder;
		}

		for (var i = 0, length = arr.length; i < length; i++)
			arr[i] = convert(arr[i], type);

		return builder.in(key, arr);
	}

	if (type === undefined || type === String)
		return builder.search(key, value);

	if (type === Date) {

		if (value === 'yesterday')
			val = NOW.add('-1 day');
		else if (value === 'today')
			val = NOW;
		else
			val = convert(value, type);

		if (typeof(val) === 'number') {
			if (val > 1000)
				return builder.year(key, val);
			else
				return builder.month(key, val);
		}

		if (!(val instanceof Date) || !val.getTime())
			val = NOW;

		return builder.between(key, val.extend('00:00:00'), val.extend('23:59:59'));
	}

	return builder.where(key, convert(value, type));
};

// Grid sorting
DatabaseBuilder.prototype.gridsort = function(sort) {
	var builder = this;
	var index = sort.lastIndexOf('_');
	if (index === -1)
		index = sort.lastIndexOf(' ');
	builder.sort(sort.substring(0, index), sort[index + 1] === 'd');
	return builder;
};

DatabaseBuilder.prototype.autofill = function($, allowedfields, skipfilter, defsort, maxlimit, localized) {

	if (typeof(defsort) === 'number') {
		maxlimit = defsort;
		defsort = null;
	}

	var self = this;
	var query = $.query || $.options;
	var schema = $.schema;
	var skipped;
	var allowed;
	var key;
	var tmp;

	if (skipfilter) {
		key = 'NDB_' + skipfilter;
		skipped = CACHE[key];
		if (!skipped) {
			tmp = skipfilter.split(',').trim();
			var obj = {};
			for (var i = 0; i < tmp.length; i++)
				obj[tmp[i]] = 1;
			skipped = CACHE[key] = obj;
		}
	}

	if (allowedfields) {
		key = 'NDB_' + allowedfields;
		allowed = CACHE[key];
		if (!allowed) {
			var obj = {};
			var arr = [];
			var filter = [];

			if (localized)
				localized = localized.split(',');

			tmp = allowedfields.split(',').trim();
			for (var i = 0; i < tmp.length; i++) {
				var k = tmp[i].split(':').trim();
				obj[k[0]] = 1;

				if (localized && localized.indexOf(k[0]) !== -1)
					arr.push(k[0] + '§');
				else
					arr.push(k[0]);

				k[1] && filter.push({ name: k[0], type: (k[1] || '').toLowerCase() });
			}
			allowed = CACHE[key] = { keys: arr, meta: obj, filter: filter };
		}
	}

	var fields = query.fields;
	var fieldscount = 0;
	var opt = self.$options;

	if (!opt.fields)
		opt.fields = [];

	if (fields) {
		fields = fields.replace(REG_FIELDS_CLEANER, '').split(',');
		for (var i = 0; i < fields.length; i++) {
			var field = fields[i];
			if (allowed && allowed.meta[field]) {
				opt.fields.push(fields[i]);
				fieldscount++;
			} else if (schema.schema[field]) {
				if (skipped && skipped[field])
					continue;
				opt.fields.push(field);
				fieldscount++;
			}
		}
	}

	if (!fieldscount) {
		if (allowed) {
			for (var i = 0; i < allowed.keys.length; i++)
				opt.fields.push(allowed.keys[i]);
		}
		if (schema.fields) {
			for (var i = 0; i < schema.fields.length; i++) {
				if (skipped && skipped[schema.fields[i]])
					continue;
				opt.fields.push(schema.fields[i]);
			}
		}
	}

	if (allowed && allowed.filter) {
		for (var i = 0; i < allowed.filter.length; i++) {
			tmp = allowed.filter[i];
			self.gridfilter(tmp.name, query, tmp.type);
		}
	}

	if (schema.fields) {
		for (var i = 0; i < schema.fields.length; i++) {
			var name = schema.fields[i];
			if ((!skipped || !skipped[name]) && query[name]) {
				var field = schema.schema[name];
				var type = 'string';
				switch (field.type) {
					case 2:
						type = 'number';
						break;
					case 4:
						type = 'boolean';
						break;
					case 5:
						type = 'date';
						break;
				}
				self.gridfilter(name, query, type);
			}
		}
	}

	if (query.sort) {
		var index = query.sort.lastIndexOf('_');
		if (index !== -1) {
			var name = query.sort.substring(0, index);
			var can = true;

			if (skipped && skipped[name])
				can = false;

			if (can && allowed && !allowed.meta[name])
				can = false;

			if (can && !allowed) {
				if (!schema.schema[name])
					can = false;
			} else if (!can)
				can = !!schema.schema[name];

			if (can)
				self.sort(name, query.sort[index + 1] === 'd');
			else if (defsort)
				self.gridsort(defsort);

		} else if (defsort)
			self.gridsort(defsort);

	} else if (defsort)
		self.gridsort(defsort);

	maxlimit && self.paginate(query.page, query.limit, maxlimit || 50);
	return self;
};

function cluster_send(obj) {
	obj.ID = F.id;
	process.send(obj);
}

exports.NoSQLReader = NoSQLReader;