// Copyright 2012-2016 (c) Peter Širka <petersirka@gmail.com>
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
 * @version 2.3.0
 */

'use strict';

const Fs = require('fs');
const Path = require('path');
const Events = require('events');

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
const EXTENSION_META = '.meta';
const BINARY_HEADER_LENGTH = 2000;
const NEWLINE = '\n';
const EMPTYARRAY = [];
const REG_CLEAN = /^[\s]+|[\s]+$/g;
const INMEMORY = {};

Object.freeze(EMPTYARRAY);

function Database(name, filename) {
	this.filename = filename + EXTENSION;
	this.filenameTemp = filename + EXTENSION_TMP;
	this.filenameMeta = filename + EXTENSION_META;
	this.directory = Path.dirname(filename);
	this.filenameBackup = framework_utils.join(this.directory, name + '_backup' + EXTENSION);
	this.name = name;
	this.pending_update = [];
	this.pending_append = [];
	this.pending_reader = [];
	this.pending_reader_view = [];
	this.pending_remove = [];
	this.views = {};
	this.step = 0;
	this.pending_drops = false;
	this.pending_views = false;
	this.binary = new Binary(this, this.directory + '/' + this.name + '-binary/');
	this.counter = new Counter(this);
	this.inmemory = {};
	this.inmemorylastusage;
	this.metadata;
	this.$meta();
	this.$timeoutmeta;
}

Database.prototype.__proto__ = Object.create(Events.EventEmitter.prototype, {
	constructor: {
		value: Database,
		enumberable: false
	}
});

exports.load = function(name, filename) {
	return new Database(name, filename);
};

exports.memory = exports.inmemory = function(name, view) {
	if (view)
		name += '#' + view;
	return INMEMORY[name] = true;
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

Database.prototype.insert = function(doc) {
	var self = this;
	var builder = new DatabaseBuilder2();
	var json = framework_builders.isSchema(doc) ? doc.$clean() : doc;
	self.pending_append.push({ doc: JSON.stringify(json), builder: builder });
	setImmediate(() => self.next(1));
	self.emit('insert', json);
	return builder;
};

Database.prototype.upsert = function(doc) {
	var self = this;
	var builder = self.one();
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
};

Database.prototype.update = function(doc, insert) {
	var self = this;
	var builder = new DatabaseBuilder();
	self.pending_update.push({ builder: builder, doc: framework_builders.isSchema(doc) ? doc.$clean() : doc, count: 0, insert: insert });
	setImmediate(() => self.next(2));
	return builder;
};

Database.prototype.modify = function(doc, insert) {
	var self = this;
	var builder = new DatabaseBuilder();
	var data = framework_builders.isSchema(doc) ? doc.$clean() : doc;
	var keys = Object.keys(data);

	if (!keys.length)
		return builder;

	self.pending_update.push({ builder: builder, doc: framework_builders.isSchema(doc) ? doc.$clean() : doc, count: 0, keys: keys, insert: insert });
	setImmediate(() => self.next(2));
	return builder;
};

Database.prototype.backup = function(filename, remove) {

	if (typeof(filename) === 'boolean') {
		remove = filename;
		filename = '';
	}

	var self = this;
	if (remove)
		return self.remove(filename || '');

	var builder = new DatabaseBuilder2();
	var stream = Fs.createReadStream(self.filename);

	stream.pipe(Fs.createWriteStream(filename || self.filenameBackup));

	stream.on('error', function(err) {
		builder.$callback && builder.$callback(errorhandling(err, builder));
		builder.$callback = null;
	});

	stream.on('end', function() {
		builder.$callback && builder.$callback(errorhandling(null, builder, true), true);
		builder.$callback = null;
	});

	return builder;
};

Database.prototype.drop = function() {
	var self = this;
	self.pending_drops = true;
	setImmediate(() => self.next(7));
	return self;
};

Database.prototype.free = function() {
	var self = this;
	self.removeAllListeners();
	delete framework.databases[self.name];
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
	var builder = new DatabaseBuilder();
	var backup = filename === undefined ? undefined : filename || self.filenameBackup;

	if (backup)
		backup = new Backuper(backup);

	self.pending_remove.push({ builder: builder, count: 0, backup: backup });
	setImmediate(() => self.next(3));
	return builder;
};

Database.prototype.find = function(view) {
	var self = this;
	var builder = new DatabaseBuilder();

	if (view) {
		self.pending_reader_view.push({ builder: builder, count: 0, counter: 0, view: view });
		setImmediate(() => self.next(6));
	} else {
		self.pending_reader.push({ builder: builder, count: 0, counter: 0, view: view });
		setImmediate(() => self.next(4));
	}

	return builder;
};

Database.prototype.scalar = function(type, field, view) {
	return this.find(view).scalar(type, field);
};

Database.prototype.count = function(view) {
	var self = this;
	var builder = new DatabaseBuilder();

	if (view) {
		self.pending_reader_view.push({ builder: builder, count: 0, view: view, type: 1 });
		setImmediate(() => self.next(6));
	} else {
		self.pending_reader.push({ builder: builder, count: 0, view: view, type: 1 });
		setImmediate(() => self.next(4));
	}

	return builder;
};

Database.prototype.one = function(view) {
	var self = this;
	var builder = new DatabaseBuilder();
	builder.first();

	if (view) {
		self.pending_reader_view.push({ builder: builder, count: 0, view: view });
		setImmediate(() => self.next(6));
	} else {
		self.pending_reader.push({ builder: builder, count: 0, view: view });
		setImmediate(() => self.next(4));
	}

	return builder;
};

Database.prototype.top = function(max, view) {
	var self = this;
	var builder = new DatabaseBuilder();
	builder.take(max);

	if (view) {
		self.pending_reader_view.push({ builder: builder, count: 0, counter: 0, view: view });
		setImmediate(() => self.next(6));
	} else {
		self.pending_reader.push({ builder: builder, count: 0, counter: 0, view: view });
		setImmediate(() => self.next(4));
	}

	return builder;
};

Database.prototype.view = function(name) {
	var builder = new DatabaseBuilder();
	this.views[name] = {};
	this.views[name] = builder;
	this.views[name].$filename = this.filename.replace(/\.nosql/, '#' + name + '.nosql');
	return builder;
};

Database.prototype.next = function(type) {
	var self = this;

	if (type && self.step)
		return self;

	if (self.step !== 6 && self.pending_reader_view.length) {
		self.$readerview();
		return self;
	}

	if (self.step !== 4 && self.pending_reader.length) {
		self.$reader();
		return self;
	}

	if (self.step !== 1 && self.pending_append.length) {
		if (INMEMORY[self.name])
			self.$append_inmemory();
		else
			self.$append();
		return self;
	}

	if (self.step !== 2 && self.pending_update.length) {
		if (INMEMORY[self.name])
			self.$update_inmemory();
		else
			self.$update();
		return self;
	}

	if (self.step !== 3 && self.pending_remove.length) {
		if (INMEMORY[self.name])
			self.$remove_inmemory();
		else
			self.$remove();
		return self;
	}

	if (self.step !== 5 && self.pending_views) {
		if (INMEMORY[self.name])
			self.$views_inmemory();
		else
			self.$views();
		return self;
	}

	if (self.step !== 7 && self.pending_drops) {
		self.$drop();
		return self;
	}

	if (self.step !== type) {
		self.step = 0;
		setImmediate(() => self.next(0));
	}

	return self;
};

Database.prototype.refresh = function() {
	var self = this;
	if (!self.views)
		return self;
	self.pending_views = true;
	setImmediate(() => self.next(5));
	return self;
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
	}, 50);
	return self;
};

Database.prototype.$inmemory = function(view, callback) {
	var self = this;

	// Last usage
	self.inmemorylastusage = global.framework ? global.framework.datetime : undefined;

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
			} catch (e) {};
		}

		callback();
	});

	return self;
};

Database.prototype.$meta = function(write) {

	var self = this;

	if (write) {
		Fs.writeFile(self.filenameMeta, JSON.stringify(self.metadata), NOOP);
		return self;
	}

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
		return self;
	}

	self.pending_append.splice(0).limit(20, function(items, next) {
		var json = [];

		for (var i = 0, length = items.length; i < length; i++)
			json.push(items[i].doc);

		Fs.appendFile(self.filename, json.join(NEWLINE) + NEWLINE, function(err) {
			for (var i = 0, length = items.length; i < length; i++) {
				var callback = items[i].builder.$callback;
				callback && callback(err, 1);
			}
			next();
		});

	}, function() {
		setImmediate(function() {
			self.next(0);
			setImmediate(() => self.refresh());
		});
	});

	return self;
};

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
			var callback = items[i].builder.$callback;
			callback && callback(null, 1);
		}

		self.$save('#');

		setImmediate(function() {
			self.next(0);
			setImmediate(() => self.refresh());
		});
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

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {
		var doc = JSON.parse(value.trim());
		for (var i = 0; i < length; i++) {

			var item = filter[i];
			var builder = item.builder;
			var output = builder.compare(doc, index);

			if (output) {
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

		writer.write(JSON.stringify(doc) + NEWLINE);
	}));

	CLEANUP(writer, function() {
		Fs.rename(self.filenameTemp, self.filename, function(err) {

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				if (item.insert && !item.count)
					self.insert(item.insert).$callback = item.builder.$callback;
				else
					item.builder.$callback && item.builder.$callback(errorhandling(err, item.builder, item.count), item.count);
			}

			setImmediate(function() {
				self.next(0);
				change && setImmediate(() => self.refresh());
			});
		});
	});

	CLEANUP(reader, () => writer.end());
	return self;
};

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

	return self.$inmemory('#', function() {

		var data = self.inmemory['#'];

		for (var j = 0, jl = data.length; j < jl; j++) {
			var doc = data[j];
			for (var i = 0; i < length; i++) {

				var item = filter[i];
				var builder = item.builder;
				var output = builder.compare(doc, j);

				if (output) {
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
				item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count);
			}
		}

		setImmediate(function() {
			self.next(0);
			change && setImmediate(() => self.refresh());
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

	var index = 0;
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

Database.prototype.$reader2 = function(filename, items, callback) {

	var self = this;
	var reader = Fs.createReadStream(filename);
	var filter = items;
	var length = filter.length;

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {
		var json = JSON.parse(value.trim(), jsonparser);
		var val;
		for (var i = 0; i < length; i++) {

			var item = filter[i];
			var builder = item.builder;
			var output = builder.compare(json, index);

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
					item.scalar = item.scalar ? Math.min(item.scalar, val) : val;
					break;
				case 'max':
					val = json[builder.$scalarfield] || 0;
					item.scalar = item.scalar ? Math.max(item.scalar, val) : val;
					break;
				case 'avg':
					val = json[builder.$scalarfield] || 0;
					item.scalar = item.scalar ? item.scalar + val : val;
					break;
				case 'group':
					val = json[builder.$scalarfield];
					if (!item.scalar)
						item.scalar = {};
					if (item.scalar[val])
						item.scalar[val]++;
					else
						item.scalar[val] = 1;
					break;
				default:
					if (item.response)
						item.response.push(output);
					else
						item.response = [output];
					break;
			}
		}
	}));

	CLEANUP(reader, function() {

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

	return self;
};

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
						item.scalar = item.scalar ? Math.min(item.scalar, val) : val;
						break;
					case 'max':
						val = json[builder.$scalarfield] || 0;
						item.scalar = item.scalar ? Math.max(item.scalar, val) : val;
						break;
					case 'avg':
						val = json[builder.$scalarfield] || 0;
						item.scalar = item.scalar ? item.scalar + val : 0;
						break;
					case 'group':
						val = json[builder.$scalarfield];
						if (!item.scalar)
							item.scalar = {};
						if (item.scalar[val])
							item.scalar[val]++;
						else
							item.scalar[val] = 1;
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
	var writers = [];

	for (var i = 0; i < length; i++)
		response.push({ response: [], name: views[i], builder: self.views[views[i]], count: 0, counter: 0 });

	var reader = Fs.createReadStream(self.filename);

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {
		var json = JSON.parse(value.trim());
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
		}, () => self.next(0), 5);
	});

	return self;
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
		return self;
	}

	var reader = Fs.createReadStream(self.filename);
	var writer = Fs.createWriteStream(self.filenameTemp);

	var filter = self.pending_remove.splice(0);
	var length = filter.length;
	var change = false;

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {

		var json = JSON.parse(value.trim());
		var is = false;
		var removed = false;

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			var builder = item.builder;
			if (builder.compare(json, index)) {
				removed = true;
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

	CLEANUP(writer, function() {
		Fs.rename(self.filenameTemp, self.filename, function(err) {

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count);
			}

			setImmediate(function() {
				self.next(0);
				change && setImmediate(() => self.refresh());
			});
		});
	});

	CLEANUP(reader, () => writer.end());
	return self;
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

	return self.$inmemory('#', function() {

		var data = self.inmemory['#'];
		var arr = [];

		for (var j = 0, jl = data.length; j < jl; j++) {
			var json = data[j];
			var is = false;
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
			item.builder.$callback && item.builder.$callback(errorhandling(null, item.builder, item.count), item.count);
		}

		self.next(0);
		change && setImmediate(() => self.refresh());
	});
};

Database.prototype.$drop = function() {
	var self = this;
	self.step = 7;

	if (!self.pending_drops) {
		self.next(0);
		return self;
	}

	self.pending_drops = false;
	var remove = [self.filename, self.filenameTemp];
	Object.keys(self.views).forEach(key => remove.push(self.views[key].$filename));

	try {
		Fs.readdirSync(self.binary.directory).forEach(function(filename) {
			filename.startsWith(self.name + '#') && filename.endsWith(EXTENSION_BINARY) && remove.push(framework_utils.join(self.binary.directory, filename));
		});
	} catch (e) {}

	remove.wait((filename, next) => Fs.unlink(filename, next), () => self.next(0), 5);

	Object.keys(self.inmemory).forEach(function(key) {
		self.inmemory[key] = undefined;
	});

	return self;
};

function DatabaseBuilder2() {
	this.$callback = NOOP;
}

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

function DatabaseBuilder() {
	this.$take = 0;
	this.$skip = 0;
	this.$filter = [];
	this.$sort;
	this.$first = false;
	this.$scope = 0;
	this.$fields;
	this.$join;
	this.$joincount;
	this.$callback = NOOP;
	this.$scalar;
	this.$scalarfield;
}

DatabaseBuilder.prototype.$callback2 = function(err, response, count) {
	var self = this;

	if (err || !self.$join)
		return self.$callback(err, response, count);

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
	} else if (response)
		response[join.field] = join.scalar ? scalar(join.items, join.scalar, join.scalarfield, join.a, join.b != null ? response[join.b] : undefined) : join.first ? findItem(join.items, join.a, response[join.b]) : findItems(join.items, join.a, response[join.b]);

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
				val = val === null ? item[field] : Math.min(val, item[field]);
				break;
			case 'group':
				if (val[item[field]])
					val[item[field]]++;
				else
					val[item[field]] = 1;
				break;
			case 'max':
				val = val === null ? item[field] : Math.max(val, item[field]);
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

	var key = name + '.' + (view || '');
	if (self.$join[key])
		return join;

	self.$join[key] = {};
	self.$join[key].field = field;
	self.$join[key].pending = true;
	self.$joincount++;

	var join = NOSQL(name).find(view);

	join.where = function(a, b) {
		self.$join[key].a = a;
		self.$join[key].b = b;
		return join;
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

	for (var i = 0, length = this.$filter.length; i < length; i++) {
		var filter = this.$filter[i];

		if (wasor && filter.scope)
			continue;

		var res = filter.filter(doc, i, filter);

		if (res === true) {
			can = true;
			if (filter.scope)
				wasor = true;
			continue;
		}

		if (filter.scope) {
			can = false;
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
			break;
	}

	this.$filter.push({ scope: this.$scope, filter: fn, name: name, value: value });
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

	this.$filter.push({ scope: this.$scope, name: name, filter: fn, value: value });
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
	this.skip(page * limit)
	return this.take(limit);
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

DatabaseBuilder.prototype.cache = function(key, expire) {
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
}

DatabaseBuilder.prototype.prepare = function(fn) {
	this.$prepare = fn;
	return this;
};

function Counter(db) {
	this.TIMEOUT = 30000;
	this.db = db;
	this.cache;
	this.timeout;
	this.type = 0; // 1 === saving, 2 === reading
}

Counter.prototype.__proto__ = Object.create(Events.EventEmitter.prototype, {
	constructor: {
		value: Counter,
		enumberable: false
	}
});

Counter.prototype.inc = Counter.prototype.hit = function(id, count) {

	var self = this;

	if (id instanceof Array) {
		id.forEach(n => self.hit(n, count));
		return self;
	}

	if (!self.cache)
		self.cache = {};

	if (self.cache[id])
		self.cache[id] += count || 1;
	else
		self.cache[id] = count || 1;

	if (!self.timeout)
		self.timeout = setTimeout(() => self.save(), self.TIMEOUT);

	self.emit('hit', id, count || 1);
	return self;
};

Counter.prototype.remove = function(id) {
	var self = this;

	if (!self.cache)
		self.cache = {};

	if (id instanceof Array)
		id.forEach(n => self.cache[n] = null);
	else
		self.cache[id] = null;

	if (!self.timeout)
		self.timeout = setTimeout(() => self.save(), self.TIMEOUT);

	self.emit('remove', id);
	return self;
};

Counter.prototype.count = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	return this.read(id, 0, callback);
};

Counter.prototype.yearly = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	return this.read(id, 1, callback);
};

Counter.prototype.monthly = function(id, callback) {

	if (typeof(id) === 'function') {
		callback = id;
		id = null;
	}

	return this.read(id, 2, callback);
};

Counter.prototype.read = function(id, type, callback) {

	var self = this;

	if (self.type) {
		setTimeout(() => self.read(id, type, callback), 200);
		return self;
	}

	// 0 == type: summarize
	// 1 == type: full

	var filename = self.db.filename + '-counter';
	var reader = Fs.createReadStream(filename);
	var keys = {};
	var single = false;
	var all = id ? false : true;
	var output = all && !type ? 0 : {};

	if (typeof(id) === 'string') {
		id = [id];
		single = true;
	}

	id && id.forEach(id => keys[id] = true);
	self.type = 2;

	reader.on('error', function() {
		self.type = 0;
		callback(null, single ? (type ? output : 0) : (all ? EMPTYARRAY : output));
	});

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {
		var index = value.indexOf('=');
		var key = value.substring(0, index);
		if (all || keys[key])
			switch (type) {
				case 0:
					if (all)
						output += +value.substring(index + 1, value.indexOf(';'));
					else
						output[key] = +value.substring(index + 1, value.indexOf(';'));
					break;
				case 1:
					if (all)
						counter_parse_years_all(output, value);
					else
						output[key] = counter_parse_years(value);
					break;
				case 2:
					if (all)
						counter_parse_months_all(output, value);
					else
						output[key] = counter_parse_months(value);
					break;
			}
	}));

	reader.on('end', function() {
		self.type = 0;

		// Array conversation
		if (all && type) {
			var tmp = [];
			if (type === 2)
				Object.keys(output).forEach(key => tmp.push({ id: key, year: +key.substring(0, 4), month: +key.substring(4, 6), value: output[key] }));
			else
				Object.keys(output).forEach(key => tmp.push({ year: +key, value: output[key] }));
			output = tmp;
		}

		callback(null, single ? (type ? output[id[0]] || EMPTYOBJECT : output[id[0]] || 0) : output);
	});

	return self;
};

Counter.prototype.stats = function(top, year, month, callback) {

	var self = this;

	if (self.type) {
		setTimeout(() => self.stats(top, year, month, callback), 200);
		return self;
	}

	if (typeof(month) == 'function') {
		callback = month;
		month = null;
	} else if (typeof(year) === 'function') {
		callback = year;
		year = month = null;
	}

	var filename = self.db.filename + '-counter';
	var reader = Fs.createReadStream(filename);
	var date;
	var output = [];

	self.type = 3;

	if (year != null) {
		date = year.toString();
		if (month != null) {
			date += month.padLeft(2, '0');
			date = new RegExp(';' + date + '=\\d+', 'g');
		} else
			date = new RegExp(';' + date + '\\d+=\\d+', 'g');
	}

	reader.on('error', function() {
		self.type = 0;
		callback && callback(null, output);
	});

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {
		var index = value.indexOf('=');
		var count;
		if (date) {
			var matches = value.match(date);
			if (!matches)
				return;
			count = counter_parse_stats(matches);
		} else
			count = +value.substring(index + 1, value.indexOf(';', index));
		counter_parse_stats_avg(output, top, value.substring(0, index), count);
	}));

	reader.on('end', function() {
		self.type = 0;
		callback && callback(null, output);
	});

	return self;
};

function counter_parse_stats_avg(group, top, key, count) {

	if (group.length < top) {
		group.push({ id: key, count: count });
		group.length === top && group.sort((a, b) => a.count > b.count ? -1 : a.count === b.count ? 0 : 1);
		return;
	}

	for (var i = 0, length = group.length; i < length; i++) {
		var item = group[i];
		if (item.count > count)
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

function counter_parse_stats(matches) {

	var value = 0;

	for (var i = 0, length = matches.length; i < length; i++) {
		var item = matches[i];
		var val = +item.substring(item.indexOf('=', 5) + 1);
		if (val > 0)
			value += val;
	}

	return value;
}

function counter_parse_years(value) {

	var arr = value.trim().split(';');
	var tmp = {};
	var output = [];

	for (var i = 1, length = arr.length; i < length; i++) {
		var val = +arr[i].substring(7);
		var key = arr[i].substring(0, 4);
		tmp[key] = val;
	}

	var keys = Object.keys(tmp);
	for (var i = 0, length = keys.length; i < length; i++)
	 	output.push({ year: +keys[i], value: tmp[keys[i]] });

	return output;
}

function counter_parse_months(value) {

	var arr = value.trim().split(';');
	var tmp = [];

	for (var i = 1, length = arr.length; i < length; i++) {
		var val = +arr[i].substring(7);
		var key = arr[i].substring(0, 6);
		tmp.push({ id: key, year: +arr[i].substring(0, 4), month: +arr[i].substring(4, 6), value: val });
	}

	return tmp;
}

function counter_parse_years_all(output, value) {
	var arr = value.trim().split(';');
	for (var i = 1, length = arr.length; i < length; i++) {
		var val = +arr[i].substring(7);
		var key = arr[i].substring(0, 4);
		if (output[key])
			output[key] += val;
		else
			output[key] = val;
	}
}

function counter_parse_months_all(output, value) {
	var arr = value.trim().split(';');
	for (var i = 1, length = arr.length; i < length; i++) {
		var val = +arr[i].substring(7);
		var key = arr[i].substring(0, 6);
		if (output[key])
			output[key] += val;
		else
			output[key] = val;
	}
}

Counter.prototype.save = function() {
	var self = this;

	if (self.type) {
		setTimeout(() => self.save(), 200);
		return self;
	}

	var filename = self.db.filename + '-counter';
	var reader = Fs.createReadStream(filename);
	var writer = Fs.createWriteStream(filename + '-tmp');
	var dt = F.datetime.format('yyyyMM') + '=';
	var cache = self.cache;

	self.cache = null;
	self.type = 1;

	var flush = function() {
		var keys = Object.keys(cache);
		for (var i = 0, length = keys.length; i < length; i++) {
			var item = cache[keys[i]];
			item && writer.write(keys[i] + '=' + item + ';' + dt + item + NEWLINE);
		}
		writer.end();
	};

	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {

		var id = value.substring(0, value.indexOf('='));

		if (!cache[id]) {
			cache[id] !== null && writer.write(value);
			return;
		}

		// 0 === id=COUNT
		// N === yyyyMM=COUNT
		var hits = cache[id];
		var arr = value.trim().split(';');
		var is = false;
		var index = arr[0].indexOf('=');

		// Update summarize
		arr[0] = arr[0].substring(0, index + 1) + (+arr[0].substring(index + 1) + hits);

		for (var i = 1, length = arr.length; i < length; i++) {

			var item = arr[i];
			var curr = item.substring(0, 7);

			if (curr === dt) {
				is = true;
				arr[i] = curr + (+item.substring(7) + hits);
				break;
			}
		}

		cache[id] = undefined;

		!is && arr.push(dt + hits);
		writer.write(arr.join(';') + NEWLINE);
	}));

	reader.on('error', flush);
	reader.on('end', flush);

	CLEANUP(writer, function() {
		Fs.rename(filename + '-tmp', filename, function(err) {
			clearTimeout(self.timeout);
			self.timeout = 0;
			self.type = 0;
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

	Fs.unlink(self.db.filename + '-counter', function() {
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
}

Binary.prototype.__proto__ = Object.create(Events.EventEmitter.prototype, {
	constructor: {
		value: Binary,
		enumberable: false
	}
});

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
		buffer = new Buffer(buffer, 'base64');
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
	var header = new Buffer(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify(h));

	var id = new Date().format('yyMMddHHmm') + 'T' + framework_utils.GUID(5);
	var key = self.db.name + '#' + id;
	var stream = Fs.createWriteStream(Path.join(self.directory, key + EXTENSION_BINARY));

	stream.write(header, 'binary');
	stream.end(buffer);
	CLEANUP(stream);
	callback && callback(null, id, h);
	self.emit('insert', id, h);
	return id;
};

Binary.prototype.insert_stream = function(id, name, type, stream, callback) {

	var self = this;
	self.check();

	var h = { name: name, size: 0, type: type, width: 0, height: 0 };
	var header = new Buffer(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify(h));

	if (!id)
		id = new Date().format('yyMMddHHmm') + 'T' + framework_utils.GUID(5);

	var key = self.db.name + '#' + id;
	var writer = Fs.createWriteStream(framework_utils.join(self.directory, key + EXTENSION_BINARY));

	writer.write(header, 'binary');
	stream.pipe(writer);
	CLEANUP(writer);
	callback && callback(null, id, h);
	self.emit('insert', id, h);
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
		buffer = new Buffer(buffer, 'base64');

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
	var header = new Buffer(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify(h));

	var stream = Fs.createWriteStream(framework_utils.join(self.directory, id + EXTENSION_BINARY));
	stream.write(header, 'binary');
	stream.end(buffer);
	CLEANUP(stream);
	callback && callback(null, id, h);
	self.emit('insert', id, h);
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
		var json = new Buffer(buffer, 'binary').toString('utf8').replace(REG_CLEAN, '');
		stream = Fs.createReadStream(filename, { start: BINARY_HEADER_LENGTH });
		callback(null, stream, JSON.parse(json));
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
	self.emit('remove', id);
	return self;
};

Binary.prototype.check = function() {

	var self = this;
	if (self.exists)
		return self;

	self.exists = true;

	try {
		Fs.mkdirSync(self.directory);
	} catch (err) {};

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

		self.emit('clear', pending.length);
		framework.unlink(pending, callback);
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

			var stream = Fs.createReadStream(target + '/' + item, { start: 0, end: BINARY_HEADER_LENGTH - 1, encoding: 'binary' });

			stream.on('data', function(buffer) {
				var json = new Buffer(buffer, 'binary').toString('utf8').replace(REG_CLEAN, '').parseJSON();
				if (json) {
					json.id = item.substring(l, item.length - le);
					output.push(json);
				}
			});

			CLEANUP(stream, next);
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
	var val = doc[item.name]
	if (val)
		return item.value === (val instanceof Date ? val : new Date(val));
	return false;
}

function compare_lt_date(doc, index, item) {
	var val = doc[item.name];
	if (val)
		return item.value < (val instanceof Date ? val : new Date(val));
	return false;
}

function compare_gt_date(doc, index, item) {
	var val = doc[item.name];
	if (val)
		return item.value > (val instanceof Date ? val : new Date(val));
	return false;
}

function compare_eqlt_date(doc, index, item) {
	var val = doc[item.name];
	if (val)
		return item.value <= (val instanceof Date ? val : new Date(val));
	return false;
}

function compare_eqgt_date(doc, index, item) {
	var val = doc[item.name];
	if (val)
		return item.value >= (val instanceof Date ? val : new Date(val));
	return false;
}

function compare_not_date(doc, index, item) {
	var val = doc[item.name];
	if (val)
		return item.value !== (val instanceof Date ? val : new Date(val));
	return false;
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
};

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

function scalar_group(obj) {
	var keys = Object.keys(obj);
	var output = [];
	for (var i = 0, length = keys.length; i < length; i++)
		output.push({ key: keys[i], count: obj[i] });
	return output;
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