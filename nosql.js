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
 * @version 2.9.2
 */

'use strict';

const Fs = require('fs');
const Path = require('path');

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
const EXTENSION_BACKUP = '.nosql-backup';
const EXTENSION_META = '.meta';
const EXTENSION_COUNTER = '-counter2';
const BINARY_HEADER_LENGTH = 2000;
const NEWLINE = '\n';
const EMPTYARRAY = [];
const REG_CLEAN = /^[\s]+|[\s]+$/g;
const INMEMORY = {};
const CLUSTER_TIMEOUT = 150;
const CLUSTER_LOCK = { TYPE: 'nosql-lock' };
const CLUSTER_UNLOCK = { TYPE: 'nosql-unlock' };
const CLUSTER_META = { TYPE: 'nosql-meta' };
const CLUSTER_LOCK_COUNTER = { TYPE: 'nosql-counter-lock' };
const CLUSTER_UNLOCK_COUNTER = { TYPE: 'nosql-counter-unlock' };
const FLAGS_READ = ['get'];
const COUNTER_MMA = [0, 0];
const COMPARER = global.Intl ? global.Intl.Collator().compare : function(a, b) {
	return a.removeDiacritics().localeCompare(b.removeDiacritics());
};

Object.freeze(EMPTYARRAY);

function Database(name, filename) {
	var self = this;
	var http = filename.substring(0, 6);
	self.readonly = http === 'http:/' || http === 'https:';
	self.filename = self.readonly ? filename.format('') : filename + EXTENSION;
	self.filenameCounter = self.readonly ? filename.format('counter', '-') : filename + EXTENSION + EXTENSION_COUNTER;
	self.filenameTemp = filename + EXTENSION_TMP;
	self.filenameLog = self.readonly ? '' : filename + EXTENSION_LOG;
	self.filenameBackup = self.readonly ? '' : filename + EXTENSION_BACKUP;
	self.filenameMeta = filename + EXTENSION_META;
	self.directory = Path.dirname(filename);
	self.filenameBackup2 = framework_utils.join(self.directory, name + '_backup' + EXTENSION);
	self.name = name;
	self.pending_update = [];
	self.pending_append = [];
	self.pending_reader = [];
	self.pending_reader_view = [];
	self.pending_remove = [];
	self.views = {};
	self.step = 0;
	self.pending_drops = false;
	self.pending_views = false;
	self.binary = self.readonly ? null : new Binary(self, self.directory + '/' + self.name + '-binary/');
	self.counter = new Counter(self);
	self.inmemory = {};
	self.inmemorylastusage;
	self.metadata;
	self.$meta();
	self.$timeoutmeta;
	self.$events = {};
	self.$free = true;
	self.locked = false;
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
	CLUSTER_LOCK.id = F.id;
	CLUSTER_UNLOCK.id = F.id;
	CLUSTER_META.id = F.id;
	CLUSTER_LOCK_COUNTER.id = F.id;
	CLUSTER_UNLOCK_COUNTER.id = F.id;
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

	stream.on('data', U.streamer('\n', function(item, index) {
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

function next_operation(self, type, builder) {
	builder && builder.$sortinline();
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
	self.pending_append.push({ doc: JSON.stringify(json), builder: builder });
	setImmediate(next_operation, self, 1);
	self.emit('insert', json);
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
			!err && self.refresh();
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
		builder.$log && builder.$log();
		builder.$callback && builder.$callback(errorhandling(err, builder));
		builder.$callback = null;
	});

	stream.on('end', function() {
		builder.$log && builder.$log();
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
		setImmediate(next_operation, self, 6, builder);
	} else {
		self.pending_reader.push({ builder: builder, count: 0, counter: 0 });
		setImmediate(next_operation, self, 4, builder);
	}

	return builder;
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
		setImmediate(next_operation, self, 6, builder);
	} else {
		self.pending_reader.push({ builder: builder, count: 0 });
		setImmediate(next_operation, self, 4, builder);
	}

	return builder;
};

Database.prototype.top = function(max, view) {
	var self = this;
	var builder = new DatabaseBuilder(self);
	builder.take(max);

	if (view) {
		self.pending_reader_view.push({ builder: builder, count: 0, counter: 0, view: view });
		setImmediate(next_operation, self, 6, builder);
	} else {
		self.pending_reader.push({ builder: builder, count: 0, counter: 0 });
		setImmediate(next_operation, self, 4, builder);
	}

	return builder;
};

Database.prototype.view = function(name) {
	var builder = new DatabaseBuilder(this);
	this.views[name] = {};
	this.views[name] = builder;
	this.views[name].$filename = this.filename.replace(/\.nosql/, '#' + name + '.nosql');
	return builder;
};

Database.prototype.lock = function() {
	this.locked = true;
	return this;
};

Database.prototype.unlock = function() {
	this.locked = false;
	next_operation(this, 0);
	return this;
};

Database.prototype.next = function(type) {

	// 9: renaming file (by updating/removing)
	if (this.locked || (type && this.step === 9))
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

	if (this.step !== type) {
		this.step = 0;
		setImmediate(next_operation, this, 0);
	}
};

Database.prototype.refresh = function() {
	if (this.views) {
		this.pending_views = true;
		setImmediate(next_operation, this, 5);
	} else if (F.cluster)
		this.$unlock();
	return this;
};

Database.prototype.$lock = function() {
	if (this.lockwait === 2)
		return false;
	CLUSTER_LOCK.name = this.name;
	process.send(CLUSTER_LOCK);
	if (this.lockwait === 1)
		return true;
	if (this.lockwait === 2)
		return false;
	this.lockwait = 1;
	setTimeout(locker_timeout, CLUSTER_TIMEOUT, this);
	return true;
};

function locker_timeout(self) {
	self.lockwait = 2;
	self.next(0);
}

Database.prototype.$unlock = function() {
	if (!this.lockwait)
		return;
	this.lockwait = 0;
	CLUSTER_UNLOCK.name = this.name;
	process.send(CLUSTER_UNLOCK);
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

		Fs.writeFile(filename, builder.join(NEWLINE) + NEWLINE, NOOP);
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
		Fs.writeFile(self.filenameMeta, JSON.stringify(self.metadata), function() {
			if (F.isCluster) {
				CLUSTER_META.name = self.name;
				process.send(CLUSTER_META);
			}
		});
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

	if (self.locked || !self.pending_append.length) {
		self.next(0);
		return;
	}

	if (F.isCluster && self.$lock())
		return;

	self.pending_append.splice(0).limit(20, function(items, next) {
		var json = [];

		for (var i = 0, length = items.length; i < length; i++)
			json.push(items[i].doc);

		Fs.appendFile(self.filename, json.join(NEWLINE) + NEWLINE, function(err) {
			for (var i = 0, length = items.length; i < length; i++) {
				items[i].builder.$log && items[i].builder.log();
				var callback = items[i].builder.$callback;
				callback && callback(err, 1);
			}
			next();
		});

	}, () => setImmediate(next_append, self));
};

function next_append(self) {
	self.next(0);
	// $unlock() is in refresh()
	setImmediate(views_refresh, self);
}

Database.prototype.$append_inmemory = function() {
	var self = this;
	self.step = 1;

	if (self.locked || !self.pending_append.length) {
		self.next(0);
		return self;
	}

	var items = self.pending_append.splice(0);

	return self.$inmemory('#', function() {

		for (var i = 0, length = items.length; i < length; i++) {
			self.inmemory['#'].push(JSON.parse(items[i].doc, jsonparser));
			items[i].builder.$log && items[i].builder.log();
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

	if (self.locked || !self.pending_update.length) {
		self.next(0);
		return self;
	}

	if (F.isCluster && self.$lock())
		return;

	var reader = Fs.createReadStream(self.filename);
	var writer = Fs.createWriteStream(self.filenameTemp);

	var filter = self.pending_update.splice(0);
	var length = filter.length;
	var change = false;

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {

		if (value[0] !== '{')
			return;

		var doc = JSON.parse(value.substring(0, value.length - 1), jsonparser);

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			var builder = item.builder;
			var output = builder.compare(doc, index, true);

			if (output) {
				builder.$backup && builder.$backupdoc(output);
				if (item.keys) {
					for (var j = 0, jl = item.keys.length; j < jl; j++) {
						var val = item.doc[item.keys[j]];
						if (val !== undefined) {
							if (typeof(val) === 'function')
								output[item.keys[j]] = val(output[item.keys[j]], output);
							else
								output[item.keys[j]] = val;
						}
					}
				} else
					output = typeof(item.doc) === 'function' ? item.doc(output) : item.doc;

				self.emit(item.keys ? 'modify' : 'update', output);
				item.count++;
				change = true;
				doc = output;
			}
		}

		writer.write(JSON.stringify(doc) + NEWLINE);
	}));

	var finish = function() {

		// No change
		if (!change) {
			Fs.unlink(self.filenameTemp, function() {

				for (var i = 0; i < length; i++) {
					var item = filter[i];
					if (item.insert && !item.count)
						self.insert(item.insert).$callback = item.builder.$callback;
					else {
						item.builder.$log && item.builder.log();
						item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count);
					}
				}

				self.next(0);
				F.cluster && self.$unlock();
			});
			return;
		}

		self.renaming = true;

		// Maybe is reading?
		if (self.step && self.step !== 9) {
			self.next(0);
			return setTimeout(finish, 100);
		}

		self.step = 9;

		Fs.rename(self.filenameTemp, self.filename, function(err) {

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				if (item.insert && !item.count)
					self.insert(item.insert).$callback = item.builder.$callback;
				else {
					item.builder.$log && item.builder.log();
					item.builder.$callback && item.builder.$callback(errorhandling(err, item.builder, item.count), item.count);
				}
			}

			setImmediate(function() {
				self.renaming = false;
				self.next(0);
				if (change)
					setImmediate(views_refresh, self);
				else if (F.isCluster)
					self.$unlock();
			});
		});
	};


	CLEANUP(writer, finish);
	CLEANUP(reader, () => writer.end());
	return self;
};

function views_refresh(self) {
	self.refresh();
}

Database.prototype.$update_inmemory = function() {

	var self = this;
	self.step = 2;

	if (self.locked || !self.pending_update.length) {
		self.next(0);
		return self;
	}

	var filter = self.pending_update.splice(0);
	var length = filter.length;
	var change = false;

	return self.$inmemory('#', function() {

		var data = self.inmemory['#'];

		for (var j = 0, jl = data.length; j < jl; j++) {
			var doc = data[j];
			for (var i = 0; i < length; i++) {

				var item = filter[i];
				var builder = item.builder;
				var output = builder.compare(doc, j);

				if (output) {

					builder.$backup && builder.$backupdoc(doc);

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

					self.emit(item.keys ? 'modify' : 'update', doc);
					item.count++;
					change = true;
				}
			}
		}

		self.$save('#');

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			if (item.insert && !item.count)
				self.insert(item.insert).$callback = item.builder.$callback;
			else {
				item.count && self.emit(item.keys ? 'modify' : 'update', item.doc);
				item.builder.$log && item.builder.log();
				item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count);
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

	if (self.locked || !self.pending_reader.length) {
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

	if (self.locked || !self.pending_reader_view.length) {
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
				err && F.error(err, 'NoSQL database: ' + self.name);
				self.$reader2(filename, items, callback, err ? null : response);
			});
			return self;
		}
	} else
		reader = Fs.createReadStream(filename);

	var filter = items;
	var length = filter.length;
	var first = true;

	for (var i = 0; i < length; i++) {
		if (!filter[i].builder.$first)
			first = false;
		filter[i].scalarcount = 0;
	}

	if (first && length > 1)
		first = false;

	reader && reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {

		if (value[0] !== '{')
			return;

		var json = JSON.parse(value.substring(0, value.length - 1), jsonparser);
		var val;

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			var builder = item.builder;
			var output = builder.compare(json, index);
			if (!output)
				continue;

			item.count++;

			if (!builder.$inlinesort && ((builder.$skip && builder.$skip >= item.count) || (builder.$take && builder.$take <= item.counter)))
				continue;

			item.counter++;

			if (item.type)
				continue;

			switch (builder.$scalar) {
				case 'count':
					item.scalar = item.scalar ? item.scalar + 1 : 1;
					break;
				case 'sum':
					val = output[builder.$scalarfield] || 0;
					item.scalar = item.scalar ? item.scalar + val : val;
					break;
				case 'min':
					val = output[builder.$scalarfield] || 0;
					if (val != null) {
						if (item.scalar) {
							if (item.scalar > val)
								item.scalar = val;
						} else
							item.scalar = val;
					}
					break;
				case 'max':
					val = output[builder.$scalarfield];
					if (val != null) {
						if (item.scalar) {
							if (item.scalar < val)
								item.scalar = val;
						} else
							item.scalar = val;
					}
					break;
				case 'avg':
					val = output[builder.$scalarfield];
					if (val != null) {
						item.scalar = item.scalar ? item.scalar + val : val;
						item.scalarcount++;
					}
					break;
				case 'group':
					!item.scalar && (item.scalar = {});
					val = output[builder.$scalarfield];
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

			if (first && reader.destroy) {
				reader.destroy();
				return false;
			}
		}
	}));

	var finish = function() {
		for (var i = 0; i < length; i++) {
			var item = filter[i];
			var builder = item.builder;
			var output;

			if (builder.$scalar || !builder.$sort) {

				if (builder.$scalar)
					output = builder.$scalar === 'avg' ? item.scalar / item.scalarcount : item.scalar;
				else if (builder.$first)
					output = item.response ? item.response[0] : undefined;
				else
					output = item.response || EMPTYARRAY;

				builder.$callback2(errorhandling(null, builder, output), item.type === 1 ? item.count : output, item.count);
				continue;
			}

			if (item.count) {
				if (builder.$sort.name) {
					if (!builder.$inlinesort || builder.$take !== item.response.length)
						item.response.quicksort(builder.$sort.name, builder.$sort.asc);
				} else if (builder.$sort === EMPTYOBJECT)
					item.response.random();
				else
					item.response.sort(builder.$sort);

				if (builder.$skip && builder.$take)
					item.response = item.response.splice(builder.$skip, builder.$take);
				else if (builder.$skip)
					item.response = item.response.splice(builder.$skip);
				else if (!builder.$inlinesort && builder.$take)
					item.response = item.response.splice(0, builder.$take);
			}

			if (builder.$first)
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

function nosqlinlinesorter(item, builder, doc) {

	if (!item.response) {
		item.response = [doc];
		return;
	}

	var length = item.response.length;
	if (length < builder.$limit) {
		item.response.push(doc);
		length + 1 >= builder.$limit && item.response.quicksort(builder.$sort.name, builder.$sort.asc);
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
	var b = doc[builder.$sort.name];
	var beg = 0;
	var length = arr.length;
	var tmp = length - 1;

	var sort = nosqlsortvalue(arr[tmp][builder.$sort.name], b, builder.$sort);
	if (!sort)
		return;

	tmp = arr.length / 2 >> 0;
	sort = nosqlsortvalue(arr[tmp][builder.$sort.name], b, builder.$sort);
	if (!sort)
		beg = tmp + 1;

	for (var i = beg; i < length; i++) {
		var item = arr[i];
		var sort = nosqlsortvalue(item[builder.$sort.name], b, builder.$sort);
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

	return self.$inmemory(name, function() {

		var data = self.inmemory[name];
		var val;

		for (var j = 0, jl = data.length; j < jl; j++) {
			var json = data[j];
			for (var i = 0; i < length; i++) {
				var item = filter[i];
				var builder = item.builder;
				var output = builder.compare(U.clone(json), j);
				if (!output)
					continue;

				item.count++;

				if (!builder.$sort && ((builder.$skip && builder.$skip >= item.count) || (builder.$take && builder.$take <= item.counter)))
					continue;

				item.counter++;

				if (item.type)
					continue;

				switch (builder.$scalar) {
					case 'count':
						item.scalar = item.scalar ? item.scalar + 1 : 1;
						break;
					case 'sum':
						val = json[builder.$scalarfield] || 0;
						item.scalar = item.scalar ? item.scalar + val : val;
						break;
					case 'min':
						val = json[builder.$scalarfield] || 0;
						if (val != null) {
							if (item.scalar) {
								if (item.scalar > val)
									item.scalar = val;
							} else
								item.scalar = val;
						}
						break;
					case 'max':
						val = json[builder.$scalarfield];
						if (val != null) {
							if (item.scalar) {
								if (item.scalar < val)
									item.scalar = val;
							} else
								item.scalar = val;
						}
						break;
					case 'avg':
						val = json[builder.$scalarfield];
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
						val = output[builder.$scalarfield];
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

			if (builder.$scalar || !builder.$sort) {

				if (builder.$scalar)
					output = builder.$scalar === 'avg' ? item.scalar / item.counter : item.scalar;
				else if (builder.$first)
					output = item.response ? item.response[0] : undefined;
				else
					output = item.response || EMPTYARRAY;

				builder.$callback2(errorhandling(null, builder, output), item.type === 1 ? item.count : output, item.count);
				continue;
			}

			if (item.count) {
				if (builder.$sort.name)
					item.response.quicksort(builder.$sort.name, builder.$sort.asc);
				else if (builder.$sort === EMPTYOBJECT)
					item.response.random();
				else
					item.response.sort(builder.$sort);

				if (builder.$skip && builder.$take)
					item.response = item.response.splice(builder.$skip, builder.$take);
				else if (builder.$skip)
					item.response = item.response.splice(builder.$skip);
				else if (builder.$take)
					item.response = item.response.splice(0, builder.$take);
			}

			if (builder.$first)
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

	if (self.locked || !self.pending_views) {
		F.isCluster && self.$unlock();
		self.next(0);
		return;
	}

	self.pending_views = false;

	var views = Object.keys(self.views);
	var length = views.length;

	if (!length) {
		F.isCluster && self.$unlock();
		self.next(0);
		return self;
	}

	if (F.isCluster && self.$lock())
		return;

	var response = [];

	for (var i = 0; i < length; i++)
		response.push({ response: [], name: views[i], builder: self.views[views[i]], count: 0, counter: 0 });

	var reader = Fs.createReadStream(self.filename);

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {

		if (value[0] !== '{')
			return;

		var json = JSON.parse(value.substring(0, value.length - 1), jsonparser);

		for (var j = 0; j < length; j++) {
			var item = self.views[views[j]];
			var output = item.compare(json, index);

			if (!output)
				continue;

			response[j].count++;

			if (!item.$sort && ((item.$skip && item.$skip >= response[j].count) || (item.$take && item.$take < response[j].counter)))
				continue;

			response[j].counter++;
			!item.type && response[j].response.push(output);
		}
	}));

	CLEANUP(reader, function() {
		response.wait(function(item, next) {

			var builder = item.builder;

			if (builder.$sort) {
				if (builder.$sort.name)
					item.response.quicksort(builder.$sort.name, builder.$sort.asc);
				else if (builder.$sort === EMPTYOBJECT)
					item.response.random();
				else
					item.response.sort(builder.$sort);
				if (builder.$skip && builder.$take)
					item.response = item.response.splice(builder.$skip, builder.$take);
				else if (builder.$skip)
					item.response = item.response.splice(builder.$skip);
				else if (builder.$take)
					item.response = item.response.splice(0, builder.$take);
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
		}, function() {
			F.isCluster && self.$unlock();
			self.next(0);
		}, 5);
	});
};

Database.prototype.$views_inmemory = function() {

	var self = this;
	self.step = 5;

	if (self.locked || !self.pending_views) {
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

	for (var i = 0; i < length; i++)
		response.push({ response: [], name: views[i], builder: self.views[views[i]], count: 0, counter: 0 });

	return self.$inmemory('#', function() {
		var data = self.inmemory['#'];

		for (var j = 0, jl = data.length; j < jl; j++) {
			var json = data[j];
			for (var i = 0; i < length; i++) {
				var item = self.views[views[i]];
				var output = item.compare(json, j);
				if (!output)
					continue;
				response[i].count++;
				if (!item.$sort && ((item.$skip && item.$skip >= response[i].count) || (item.$take && item.$take < response[i].counter)))
					continue;
				response[i].counter++;
				!item.type && response[i].response.push(output);
			}
		}

		for (var j = 0, jl = response.length; j < jl; j++) {

			var item = response[j];
			var builder = item.builder;

			if (builder.$sort) {
				if (builder.$sort.name)
					item.response.quicksort(builder.$sort.name, builder.$sort.asc);
				else if (builder.$sort === EMPTYOBJECT)
					item.response.random();
				else
					item.response.sort(builder.$sort);
				if (builder.$skip && builder.$take)
					item.response = item.response.splice(builder.$skip, builder.$take);
				else if (builder.$skip)
					item.response = item.response.splice(builder.$skip);
				else if (builder.$take)
					item.response = item.response.splice(0, builder.$take);
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

	if (F.isCluster && self.$lock())
		return;

	reader && reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {

		if (value[0] !== '{')
			return;

		var json = JSON.parse(value.substring(0, value.length - 1), jsonparser);
		var removed = false;

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			var builder = item.builder;
			var output = builder.compare(json, index);
			if (output) {
				builder.$backup && builder.$backupdoc(output);
				removed = true;
				json = output;
				break;
			}
		}

		if (removed) {
			for (var i = 0; i < length; i++) {
				var item = filter[i];
				item.backup && item.backup.write(value);
				item.count++;
			}
			self.emit('remove', json);
			change = true;
		} else
			writer.write(value);
	}));

	var finish = function() {

		// No change
		if (!change) {
			Fs.unlink(self.filenameTemp, function() {
				for (var i = 0; i < length; i++) {
					var item = filter[i];
					item.builder.$log && item.builder.log();
					item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count);
				}
				self.next(0);
				F.cluster && self.$unlock();
			});
			return;
		}

		self.renaming = true;

		// Maybe is reading?
		if (self.step && self.step !== 9) {
			self.next(0);
			return setTimeout(finish, 100);
		}

		self.step = 9;
		Fs.rename(self.filenameTemp, self.filename, function() {

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				item.builder.$log && item.builder.log();
				item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count);
			}

			setImmediate(function() {
				self.renaming = false;
				self.next(0);
				if (change)
					setImmediate(views_refresh, self);
				else if (F.cluster)
					self.$unlock();
			});
		});
	};

	CLEANUP(writer, finish);
	CLEANUP(reader, () => writer.end());
};

Database.prototype.$remove_inmemory = function() {

	var self = this;
	self.step = 3;

	if (self.locked || !self.pending_remove.length) {
		self.next(0);
		return self;
	}

	var filter = self.pending_remove.splice(0);
	var length = filter.length;
	var change = false;

	return self.$inmemory('#', function() {

		var data = self.inmemory['#'];
		var arr = [];

		for (var j = 0, jl = data.length; j < jl; j++) {
			var json = data[j];
			var removed = false;

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				var builder = item.builder;
				if (builder.compare(json, j)) {
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
				self.emit('remove', json);
			} else
				arr.push(json);
		}

		if (change) {
			self.inmemory['#'] = arr;
			self.$save('#');
		}

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			item.builder.$log && item.builder.log();
			item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count);
		}

		self.next(0);
		change && setImmediate(views_refresh, self);
	});
};

Database.prototype.$drop = function() {
	var self = this;
	self.step = 7;

	if (self.locked || !self.pending_drops) {
		self.next(0);
		return;
	}

	if (F.isCluster && self.$lock())
		return;

	self.pending_drops = false;
	var remove = [self.filename, self.filenameTemp];
	Object.keys(self.views).forEach(key => remove.push(self.views[key].$filename));

	try {
		Fs.readdirSync(self.binary.directory).forEach(function(filename) {
			filename.startsWith(self.name + '#') && filename.endsWith(EXTENSION_BINARY) && remove.push(framework_utils.join(self.binary.directory, filename));
		});
	} catch (e) {}

	remove.wait((filename, next) => Fs.unlink(filename, next), function() {
		F.isCluster && self.$unlock();
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
	// this.$log;
}

DatabaseBuilder2.prototype.log = function(msg, user) {
	var self = this;
	if (msg) {
		F.datetime = new Date();
		self.$log = (self.$log ? self.$log : '') + F.datetime.format('yyyy-MM-dd HH:mm:ss') + ' | ' + (user ? user.padRight(20) + ' | ' : '') + msg + NEWLINE;
	} else if (self.$log) {
		self.db.filenameLog && Fs.appendFile(self.db.filenameLog, self.$log, NOOP);
		self.$log = '';
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
	// this.$log;
}

DatabaseBuilder.prototype.log = function(msg, user) {
	var self = this;
	if (msg) {
		F.datetime = new Date();
		self.$log = (self.$log ? self.$log : '') + F.datetime.format('yyyy-MM-dd HH:mm:ss') + ' | ' + (user ? user.padRight(20) + ' | ' : '') + msg + NEWLINE;
	} else if (self.$log) {
		self.db.filenameLog && Fs.appendFile(self.db.filenameLog, self.$log, NOOP);
		self.$log = '';
	}
	return self;
};

DatabaseBuilder.prototype.$callback2 = function(err, response, count) {
	var self = this;

	if (err || !self.$join) {
		self.$log && self.log();
		return self.$callback(err, response, count);
	}

	if (self.$joincount) {
		setImmediate(() => self.$callback2(err, response, count));
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

	self.$log && self.log();
	self.$callback(err, response, count);
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
	this.$first = true;
	return this.take(1);
};

DatabaseBuilder.prototype.make = function(fn) {
	fn.call(this, this);
	return this;
};

DatabaseBuilder.prototype.compare = function(doc, index) {

	var can = true;
	var wasor = false;
	var prevscope = 0;

	for (var i = 0, length = this.$filter.length; i < length; i++) {

		var filter = this.$filter[i];
		if (wasor && filter.scope)
			continue;

		if (prevscope && !filter.scope && !wasor)
			return;

		prevscope = filter.scope;

		var res = filter.filter(doc, i, filter);

		if (res === true) {
			can = true;
			if (filter.scope)
				wasor = true;
			continue;
		} else if (filter.scope) {
			can = false;
			wasor = false;
			continue;
		}

		return;
	}

	if (!can)
		return;

	if (this.$prepare)
		return this.$prepare(doc, index);

	if (!this.$fields)
		return doc;

	var obj = {};

	for (var i = 0, length = this.$fields.length; i < length; i++) {
		var prop = this.$fields[i];
		obj[prop] = doc[prop];
	}

	return obj;
};

DatabaseBuilder.prototype.filter = function(fn) {
	this.$filter.push({ scope: this.$scope, filter: fn });
	return this;
};

DatabaseBuilder.prototype.scalar = function(type, name) {
	this.$scalar = type;
	this.$scalarfield = name;
	return this;
};

DatabaseBuilder.prototype.contains = function(name) {
	this.$filter.push({ scope: this.$scope, filter: compare_notempty, name: name });
	return this;
};

DatabaseBuilder.prototype.empty = function(name) {
	this.$filter.push({ scope: this.$scope, filter: compare_empty, name: name });
	return this;
};

DatabaseBuilder.prototype.backup = function(user) {
	if (this.db.filenameBackup)
		this.$backup = typeof(user) === 'string' ? user : 'unknown';
	else
		this.$backup = null;
	return this;
};

DatabaseBuilder.prototype.$backupdoc = function(doc) {
	this.db.filenameBackup && Fs.appendFile(this.db.filenameBackup, F.datetime.format('yyyy-MM-dd HH:mm') + ' | ' + this.$backup.padRight(20) + ' | ' + JSON.stringify(doc) + NEWLINE, NOOP);
	return this;
};

DatabaseBuilder.prototype.where = function(name, operator, value) {

	var fn;

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	var date = framework_utils.isDate(value);

	switch (operator) {
		case '=':
			fn = date ? compare_eq_date : compare_eq;
			break;
		case '<':
			fn = date ? compare_gt_date : compare_gt;
			break;
		case '<=':
			fn = date ? compare_eqgt_date : compare_eqgt;
			break;
		case '>':
			fn = date ? compare_lt_date : compare_lt;
			break;
		case '>=':
			fn = date ? compare_eqlt_date : compare_eqlt;
			break;
		case '<>':
		case '!=':
			fn = date ? compare_not_date : compare_not;
			operator = '!=';
			break;
	}

	this.$filter.push({ scope: this.$scope, filter: fn, name: name, value: value, operator: operator, ticks: date ? value.getTime() : 0 });
	return this;
};

DatabaseBuilder.prototype.month = function(name, operator, value) {

	var fn;

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	switch (operator) {
		case '=':
			fn = compare_eq_dtmonth;
			break;
		case '<':
			fn = compare_gt_dtmonth;
			break;
		case '<=':
			fn = compare_eqgt_dtmonth;
			break;
		case '>':
			fn = compare_lt_dtmonth;
			break;
		case '>=':
			fn = compare_eqlt_dtmonth;
			break;
		case '<>':
		case '!=':
			fn = compare_not_dtmonth;
			break;
	}

	this.$filter.push({ scope: this.$scope, filter: fn, name: name, value: value });
	return this;
};

DatabaseBuilder.prototype.day = function(name, operator, value) {

	var fn;

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	switch (operator) {
		case '=':
			fn = compare_eq_dtday;
			break;
		case '<':
			fn = compare_gt_dtday;
			break;
		case '<=':
			fn = compare_eqgt_dtday;
			break;
		case '>':
			fn = compare_lt_dtday;
			break;
		case '>=':
			fn = compare_eqlt_dtday;
			break;
		case '<>':
		case '!=':
			fn = compare_not_dtday;
			break;
	}

	this.$filter.push({ scope: this.$scope, filter: fn, name: name, value: value });
	return this;
};

DatabaseBuilder.prototype.year = function(name, operator, value) {

	var fn;

	if (value === undefined) {
		value = operator;
		operator = '=';
	}

	switch (operator) {
		case '=':
			fn = compare_eq_dtyear;
			break;
		case '<':
			fn = compare_gt_dtyear;
			break;
		case '<=':
			fn = compare_eqgt_dtyear;
			break;
		case '>':
			fn = compare_lt_dtyear;
			break;
		case '>=':
			fn = compare_eqlt_dtyear;
			break;
		case '<>':
		case '!=':
			fn = compare_not_dtyear;
			break;
	}

	this.$filter.push({ scope: this.$scope, filter: fn, name: name, value: value });
	return this;
};

DatabaseBuilder.prototype.like = DatabaseBuilder.prototype.search = function(name, value, where) {

	var fn;

	if (!where)
		where = '*';

	switch (where) {
		case 'beg':
			fn = compare_likebeg;
			break;
		case 'end':
			fn = compare_likeend;
			break;
		case '*':
			fn = compare_like;
			if (value instanceof Array) {
				for (var i = 0, length = value.length; i < length; i++)
					value[i] = value[i].toLowerCase();
			} else
				value = value.toLowerCase();
			break;
	}

	this.$filter.push({ scope: this.$scope, name: name, filter: fn, value: value, operator: where === 'beg' ? 10 : where === 'end' ? 11 : 12 });
	return this;
};

DatabaseBuilder.prototype.take = function(count) {
	this.$take = count;
	return this;
};

DatabaseBuilder.prototype.limit = function(count) {
	this.$take = count;
	return this;
};

DatabaseBuilder.prototype.page = function(page, limit) {
	this.$skip = page * limit;
	this.$take = limit;
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

	this.$skip = page2 * limit2;
	this.$take = limit2;
	return this;
};

DatabaseBuilder.prototype.skip = function(count) {
	this.$skip = count;
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
	this.$sort = EMPTYOBJECT;
	return this;
};

DatabaseBuilder.prototype.sort = function(name, desc) {

	if (typeof(name) === 'function') {
		this.$sort = name;
		return this;
	}

	this.$sort = { name: name, asc: desc ? false : true };
	return this;
};

DatabaseBuilder.prototype.$sortinline = function() {
	this.$inlinesort = this.$take && this.$sort && this.$sort !== EMPTYOBJECT;
	this.$limit = (this.$take || 0) + (this.$skip || 0);
	return this;
};

DatabaseBuilder.prototype.in = function(name, value) {
	if (!(value instanceof Array))
		value = [value];
	this.$filter.push({ scope: this.$scope, name: name, filter: compare_in, value: value });
	return this;
};

DatabaseBuilder.prototype.notin = function(name, value) {
	if (!(value instanceof Array))
		value = [value];
	this.$filter.push({ scope: this.$scope, name: name, filter: compare_notin, value: value });
	return this;
};

DatabaseBuilder.prototype.between = function(name, a, b) {
	this.$filter.push({ scope: this.$scope, name: name, filter: compare_between, a: a, b: b });
	return this;
};

DatabaseBuilder.prototype.or = function() {
	this.$scope = 1;
	return this;
};

DatabaseBuilder.prototype.end = function() {
	this.$scope = 0;
	return this;
};

DatabaseBuilder.prototype.and = function() {
	this.$scope = 0;
	return this;
};

DatabaseBuilder.prototype.done = function() {
	this.$filter = null;
	this.$sort = null;
	return this;
};

DatabaseBuilder.prototype.cache = function() {
	// this.$cache_key = '$nosql_' + key;
	// this.$cache_expire = expire;
	OBSOLETE('DatabaseBuilder.cache()', 'NoSQL database supports in-memory mode.');
	return this;
};

DatabaseBuilder.prototype.fields = function() {
	if (!this.$fields)
		this.$fields = [];
	for (var i = 0, length = arguments.length; i < length; i++)
		this.$fields.push(arguments[i]);
	return this;
};

DatabaseBuilder.prototype.prepare = function(fn) {
	this.$prepare = fn;
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
	self.locked = false;
	var filename = self.db.filename + '-counter';
	if (!self.db.readonly) {
		try {
			var val = Fs.statSync(filename);
			val && val.isFile() && self.convert2(filename);
		} catch (e) {}
	}
}

Counter.prototype.convert2 = function(filename) {
	var reader = Fs.createReadStream(filename);
	var writer = Fs.createWriteStream(filename + '2');
	var self = this;
	self.type = 100;
	reader.on('data', framework_utils.streamer(NEWLINE, function(value) {
		var arr = value.split(';');
		var years = {};
		for (var i = 1, length = arr.length; i < length; i++) {
			var item = arr[i];
			var year = item.substring(0, 4);
			!years[year] && (years[year] = ['sum' + year + arr[0]]);
			years[year].push(item.substring(4, 6) + '01' + item.substring(6).trim());
		}
		arr = Object.keys(years);
		for (var i = 0, length = arr.length; i < length; i++) {
			var year = arr[i];
			var item = years[year];
			writer.write(item.join(';') + NEWLINE);
		}
	}));

	reader.on('end', function() {
		writer.end();
		console.log(F.datetime.format('yyyy-MM-dd HH:mm:ss') + ' :: Converted NoSQL embedded counter for database "{0}" to version "2" (IMPORTANT: backwards incompatible)'.format(self.db.name));
	});

	writer.on('finish', function() {
		Fs.rename(filename, filename + '-backup', function() {
			self.type = 0;
		});
	});

	return self;
};

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

		reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {

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
	return this.stats(top, year, month, day, callback, 'max');
};

Counter.prototype.stats_min = function(top, year, month, day, callback) {
	return this.stats(top, year, month, day, callback, 'min');
};

Counter.prototype.stats = Counter.prototype.stats_sum = function(top, year, month, day, callback, type, reader) {

	var self = this;

	if (self.type && reader === undefined) {
		setTimeout(() => self.stats(top, year, month, day, callback, type), 200);
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
					self.stats(top, year, month, day, callback, type, response);
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

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {

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

function counter_parse_stats_avg(group, top, key, count, opt, filter) {

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

	if (self.type || self.locked) {
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

	if (F.isCluster) {
		CLUSTER_LOCK_COUNTER.name = self.name;
		process.send(CLUSTER_LOCK_COUNTER);
	}

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

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {

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
			if (F.isCluster) {
				CLUSTER_UNLOCK_COUNTER.name = self.name;
				process.send(CLUSTER_UNLOCK_COUNTER);
			}
			counter && self.$events.stats && setImmediate(() => self.emit('stats', counter));
		});
	});

	return self;
};

Counter.prototype.clear = function(callback) {
	var self = this;

	if (self.type || self.locked) {
		setTimeout(() => self.clear(callback), 200);
		return self;
	}

	if (F.isCluster) {
		CLUSTER_LOCK_COUNTER.name = self.name;
		process.send(CLUSTER_LOCK_COUNTER);
	}

	self.type = 3;

	Fs.unlink(self.db.filename + EXTENSION_COUNTER, function() {

		if (F.isCluster) {
			CLUSTER_UNLOCK_COUNTER.name = self.name;
			process.send(CLUSTER_UNLOCK_COUNTER);
		}

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

function compare_eq(doc, index, item) {
	return item.value === doc[item.name];
}

function compare_lt(doc, index, item) {
	return item.value < doc[item.name];
}

function compare_gt(doc, index, item) {
	return item.value > doc[item.name];
}

function compare_eqlt(doc, index, item) {
	return item.value <= doc[item.name];
}

function compare_eqgt(doc, index, item) {
	return item.value >= doc[item.name];
}

function compare_not(doc, index, item) {
	return item.value !== doc[item.name];
}

function compare_eq_date(doc, index, item) {
	var val = doc[item.name];
	return val ? item.ticks === (val instanceof Date ? val : new Date(val)).getTime() : false;
}

function compare_lt_date(doc, index, item) {
	var val = doc[item.name];
	return val ? item.value < (val instanceof Date ? val : new Date(val)) : false;
}

function compare_gt_date(doc, index, item) {
	var val = doc[item.name];
	return val ? item.value > (val instanceof Date ? val : new Date(val)) : false;
}

function compare_eqlt_date(doc, index, item) {
	var val = doc[item.name];
	return val ? item.value <= (val instanceof Date ? val : new Date(val)) : false;
}

function compare_eqgt_date(doc, index, item) {
	var val = doc[item.name];
	return val ? item.value >= (val instanceof Date ? val : new Date(val)) : false;
}

function compare_not_date(doc, index, item) {
	var val = doc[item.name];
	return val ? item.value !== (val instanceof Date ? val : new Date(val)) : false;
}

function compare_likebeg(doc, index, item) {
	var val = doc[item.name];
	return val ? val.startsWith(item.value) : false;
}

function compare_likeend(doc, index, item) {
	var val = doc[item.name];
	return val ? val.endsWith(item.value) : false;
}

function compare_like(doc, index, item) {
	var val = doc[item.name];

	if (!val || !val.toLowerCase)
		return false;

	if (item.value instanceof Array) {
		for (var i = 0, length = item.value.length; i < length; i++) {
			if (val.toLowerCase().indexOf(item.value[i]) !== -1)
				return true;
		}
		return false;
	}

	return val.toLowerCase().indexOf(item.value) !== -1;
}

function compare_between(doc, index, item) {
	var val = doc[item.name];
	return val >= item.a && val <= item.b;
}

function compare_in(doc, index, item) {
	var val = doc[item.name];
	if (val instanceof Array) {
		for (var i = 0, length = val.length; i < length; i++) {
			if (item.value.indexOf(val[i]) !== -1)
				return true;
		}
		return false;
	}
	return item.value.indexOf(val) !== -1;
}

function compare_notin(doc, index, item) {
	var val = doc[item.name];
	if (val instanceof Array) {
		for (var i = 0, length = val.length; i < length; i++) {
			if (item.value.indexOf(val[i]) !== -1)
				return false;
		}
		return true;
	}
	return item.value.indexOf(val) === -1;
}

function compare_notempty(doc, index, item) {
	var val = doc[item.name];
	return val instanceof Array ? (val.length ? true : false) : (val ? true : false);
}

function compare_empty(doc, index, item) {
	var val = doc[item.name];
	return val instanceof Array ? (val.length ? false : true) : (val ? false : true);
}

function compare_datetype(type, eqtype, val, doc) {

	if (!doc)
		return false;
	else if (!doc.getTime) {
		doc = new Date(doc);
		if (isNaN(doc))
			return false;
	}

	switch (type) {
		case 'month':
			doc = doc.getMonth() + 1;
			break;
		case 'day':
			doc = doc.getDate();
			break;
		case 'year':
			doc = doc.getFullYear();
			break;
	}

	return eqtype === '=' ? val === doc : eqtype === '>' ? val > doc : eqtype === '<' ? val < doc : eqtype === '>=' ? val >= doc : eqtype === '<=' ? val <= doc : val !== doc;
}

function compare_eq_dtmonth(doc, index, item) {
	return compare_datetype('month', '=', item.value, doc[item.name]);
}

function compare_lt_dtmonth(doc, index, item) {
	return compare_datetype('month', '<', item.value, doc[item.name]);
}

function compare_gt_dtmonth(doc, index, item) {
	return compare_datetype('month', '>', item.value, doc[item.name]);
}

function compare_eqlt_dtmonth(doc, index, item) {
	return compare_datetype('month', '<=', item.value, doc[item.name]);
}

function compare_eqgt_dtmonth(doc, index, item) {
	return compare_datetype('month', '>=', item.value, doc[item.name]);
}

function compare_not_dtmonth(doc, index, item) {
	return compare_datetype('month', '!=', item.value, doc[item.name]);
}

function compare_eq_dtyear(doc, index, item) {
	return compare_datetype('year', '=', item.value, doc[item.name]);
}

function compare_lt_dtyear(doc, index, item) {
	return compare_datetype('year', '<', item.value, doc[item.name]);
}

function compare_gt_dtyear(doc, index, item) {
	return compare_datetype('year', '>', item.value, doc[item.name]);
}

function compare_eqlt_dtyear(doc, index, item) {
	return compare_datetype('year', '<=', item.value, doc[item.name]);
}

function compare_eqgt_dtyear(doc, index, item) {
	return compare_datetype('year', '>=', item.value, doc[item.name]);
}

function compare_not_dtyear(doc, index, item) {
	return compare_datetype('year', '!=', item.value, doc[item.name]);
}

function compare_eq_dtday(doc, index, item) {
	return compare_datetype('day', '=', item.value, doc[item.name]);
}

function compare_lt_dtday(doc, index, item) {
	return compare_datetype('day', '<', item.value, doc[item.name]);
}

function compare_gt_dtday(doc, index, item) {
	return compare_datetype('day', '>', item.value, doc[item.name]);
}

function compare_eqlt_dtday(doc, index, item) {
	return compare_datetype('day', '<=', item.value, doc[item.name]);
}

function compare_eqgt_dtday(doc, index, item) {
	return compare_datetype('day', '>=', item.value, doc[item.name]);
}

function compare_not_dtday(doc, index, item) {
	return compare_datetype('day', '!=', item.value, doc[item.name]);
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
