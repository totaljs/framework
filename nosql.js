/**
 * @author Peter Širka <petersirka@gmail.com>
 * @copyright Peter Širka 2012-2016
 * @version 4.0.0
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

const EXTENSION = '.nosql';
const EXTENSION_BINARY = '.nosql-binary';
const EXTENSION_TMP = '.nosql-tmp';
const EXTENSION_META = '.meta';
const BINARY_HEADER_LENGTH = 2000;
const NEWLINE = '\n';
const EMPTYARRAY = [];
const REG_CLEAN = /^[\s]+|[\s]+$/g;

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
	this.iscache = false;
	this.metadata;
	this.$meta();
	this.$timeoutmeta;
}

exports.load = function(name, filename) {
	return new Database(name, filename);
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
	self.pending_append.push({ doc: JSON.stringify(doc.$clean ? doc.$clean() : doc), builder: builder });
	self.next(1);
	return builder;
};

Database.prototype.update = function(doc) {
	var self = this;
	var builder = new DatabaseBuilder();
	self.pending_update.push({ builder: builder, doc: doc, count: 0 });
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
		if (builder.$callback)
			builder.$callback(errorhandling(err, builder));
		builder.$callback = null;
	});

	stream.on('end', function() {
		if (builder.$callback)
			builder.$callback(errorhandling(null, builder, true), true);
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
	delete framework.databases[self.name];
	return self;
};

Database.prototype.modify = function(doc) {
	var self = this;
	var builder = new DatabaseBuilder();
	var data = doc.$clean ? doc.$clean() : doc;
	var keys = Object.keys(data);

	if (!keys.length)
		return builder;

	self.pending_update.push({ builder: builder, doc: doc, count: 0, keys: keys });
	setImmediate(() => self.next(2));
	return builder;
};

Database.prototype.remove = function(filename) {
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
		self.pending_reader_view.push({ builder: builder, count: 0, view: view });
		setImmediate(() => self.next(6));
	} else {
		self.pending_reader.push({ builder: builder, count: 0, view: view });
		setImmediate(() => self.next(4));
	}

	return builder;
};

Database.prototype.max = function(name, view) {
	var self = this;
	var builder = new DatabaseBuilder();

	if (view) {
		self.pending_reader_view.push({ builder: builder, count: 0, view: view });
		setImmediate(() => self.next(6));
	} else {
		self.pending_reader.push({ builder: builder, count: 0, view: view });
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
		self.pending_reader_view.push({ builder: builder, count: 0, view: view });
		setImmediate(() => self.next(6));

	} else {
		self.pending_reader.push({ builder: builder, count: 0, view: view });
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
		self.$append();
		return self;
	}

	if (self.step !== 2 && self.pending_update.length) {
		self.$update();
		return self;
	}

	if (self.step !== 3 && self.pending_remove.length) {
		self.$remove();
		return self;
	}

	if (self.step !== 5 && self.pending_views) {
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
	if (self.iscache)
		framework.cache.removeAll('$nosql');
	if (!self.views)
		return self;
	self.pending_views = true;
	setImmediate(() => self.next(5));
	return self;
};

// ======================================================================
// FILE OPERATIONS
// ======================================================================

Database.prototype.$meta = function(write) {

	var self = this;

	if (write) {
		Fs.writeFile(self.filenameMeta, JSON.stringify(self.metadata), NOOP);
		return self;
	}

	try {
		self.metadata = JSON.parse(Fs.readFileSync(self.filenameMeta).toString('utf8'));
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
				if (callback)
					callback(err, 1);
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
		var json = JSON.parse(value.trim());
		for (var i = 0; i < length; i++) {

			var item = filter[i];
			var builder = item.builder;
			var output = builder.compare(json, index);
			var doc = json;

			if (output) {
				if (item.keys) {
					for (var j = 0, jl = item.keys.length; j < jl; j++) {
						var val = item.doc[item.keys[j]];
						if (typeof(val) === 'function')
							doc[item.keys[j]] = val(doc[item.keys[j]]);
						else
							doc[item.keys[j]] = val;
					}
				} else
					doc = typeof(item.doc) === 'function' ? item.doc(doc) : item.doc;
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
				if (item.builder.$callback)
					item.builder.$callback(errorhandling(err, item.builder, item.count), item.count);
			}

			setImmediate(function() {
				self.next(0);
				if (change)
					setImmediate(() => self.refresh());
			});
		});
	});

	CLEANUP(reader, () => writer.end());
	return self;
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

	while (true) {
		var item = list[index++];
		if (!item)
			break;

		var key = item.builder.$cache_key;
		if (!key)
			continue;

		var data = framework.cache.get(key);
		if (!data)
			continue;

		item.builder.$callback(errorhandling(err, item.builder, data.items), data.items, data.count);
		index--;
		list.splice(index, 1);
	}

	if (!list.length) {
		self.next(0);
		return self;
	}

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
		var name = self.views[item.view].$filename;
		if (item.builder.$cache_key) {
			var data = framework.cache.get(item.builder.$cache_key);
			if (data) {
				item.builder.$callback(errorhandling(err, item.builder, data.items), data.items, data.count);
				continue;
			}
		}

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
		var json = JSON.parse(value.trim());
		for (var i = 0; i < length; i++) {

			var item = filter[i];
			var builder = item.builder;
			var output = builder.compare(json, index);

			if (!output)
				continue;

			item.count++;

			if (!builder.$sort) {
				if (builder.$skip && builder.$skip > index)
					continue;
				if (builder.$take && builder.$take < item.count)
					continue;
			}

			if (item.response) {
				item.response.push(output);
				continue;
			}

			item.response = [output];
		}
	}));

	CLEANUP(reader, function() {

		for (var i = 0; i < length; i++) {
			var item = filter[i];
			var builder = item.builder;
			var output;

			if (!builder.$sort) {
				if (builder.$first)
					output = item.response ? item.response[0] : undefined;
				else
					output = item.response || EMPTYARRAY;

				if (builder.$cache_key)
					framework.cache.add(builder.$cache_key, { items: output, count: item.count }, builder.$cache_expire);

				builder.$callback(errorhandling(null, builder, output), output, item.count);
				continue;
			}

			if (item.count) {
				if (builder.$sort.name)
					item.response.orderBy(builder.$sort.name, builder.$sort.asc);
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

			if (builder.$cache_key)
				framework.cache.add(builder.$cache_key, { items: output, count: item.count }, builder.$cache_expire);

			builder.$callback(errorhandling(null, builder, output), output, item.count);
			builder.done();
		}

		callback();
	});

	return self;
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
		response.push({ response: [], name: views[i], builder: self.views[views[i]], count: 0 });

	var reader = Fs.createReadStream(self.filename);
	reader.on('data', framework_utils.streamer(NEWLINE, function(value, index) {
		var json = JSON.parse(value.trim());
		for (var j = 0; j < length; j++) {
			var item = self.views[views[j]];
			var output = item.compare(json, index);

			if (!output)
				continue;

			response[j].count++;

			if (!item.$sort) {
				if (item.$skip && item.$skip > index)
					continue;
				if (item.$take && item.$take < response[j].count)
					continue;
			}

			response[j].response.push(output);
		}
	}));

	CLEANUP(reader, function() {
		response.wait(function(item, next) {

			var builder = item.builder;
			var output;

			if (builder.$sort) {
				if (builder.$sort.name)
					item.response.orderBy(builder.$sort.name, builder.$sort.asc);
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
				}, next);
			});
		}, 5);
	});

	return self;
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
		for (var i = 0; i < length; i++) {

			var item = filter[i];
			var builder = item.builder;
			var output = builder.compare(json, index);

			if (!output) {
				writer.write(value);
				return;
			}

			if (item.backup)
				item.backup.write(value);

			item.count++;
			change = true;
		}
	}));

	CLEANUP(writer, function() {
		Fs.rename(self.filenameTemp, self.filename, function(err) {

			for (var i = 0; i < length; i++) {
				var item = filter[i];
				if (item.builder.$callback)
					item.builder.$callback(errorhandling(null, item.builder, item.count), item.count);
			}

			setImmediate(function() {
				self.next(0);
				if (change)
					setImmediate(() => self.refresh());
			});
		});
	});

	CLEANUP(reader, () => writer.end());
	return self;
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
			if (filename.startsWith(self.name + '#') && filename.endsWith(EXTENSION_BINARY))
				remove.push(framework_utils.join(self.binary.directory, filename));
		});
	} catch (e) {}

	remove.wait((filename, next) => Fs.unlink(filename, next), () => self.next(0), 5);
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
	this.$callback = NOOP;
}

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
	this.skip(value * limit)
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
	this.$cache_key = '$nosql_' + key;
	this.$cache_expire = expire;
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

function Binary(db, directory) {
	this.db = db;
	this.directory = directory;
	this.exists = false;
}

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

	var h = { name: name, size: size, type: type, width: dimension.width, height: dimension.height };
	var header = new Buffer(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify(h));

	var id = new Date().format('yyMMddHHmm') + 'T' + framework_utils.GUID(5);
	var key = self.db.name + '#' + id;
	var stream = Fs.createWriteStream(Path.join(self.directory, key + EXTENSION_BINARY));

	stream.write(header, 'binary');
	stream.end(buffer);
	CLEANUP(stream);

	if (callback)
		callback(null, id, h);

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

	if (callback)
		callback(null, id, h);

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

	var h = { name: name, size: size, type: type, width: dimension.width, height: dimension.height };
	var header = new Buffer(BINARY_HEADER_LENGTH);
	header.fill(' ');
	header.write(JSON.stringify(h));

	var stream = Fs.createWriteStream(framework_utils.join(self.directory, id + EXTENSION_BINARY));
	stream.write(header, 'binary');
	stream.end(buffer);
	CLEANUP(stream);

	if (callback)
		callback(null, id, h);

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

	return self.db;
};

Binary.prototype.remove = function(id, callback) {

	var self = this;
	var key = id;

	self.check();

	if (key.indexOf('#') === -1)
		key = self.db.name + '#' + key;

	var filename = framework_utils.join(self.directory, key + EXTENSION_BINARY);

	Fs.unlink(filename, function(err) {
		if (callback)
			callback(null, err ? false : true);
	});

	return self.db;
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
		return item.value === new Date(val);
	return false;
}

function compare_lt_date(doc, index, item) {
	var val = doc[item.name];
	if (val)
		return item.value < new Date(val);
	return false;
}

function compare_gt_date(doc, index, item) {
	var val = doc[item.name];
	if (val)
		return item.value > new Date(val);
	return false;
}

function compare_eqlt_date(doc, index, item) {
	var val = doc[item.name];
	if (val)
		return item.value <= new Date(val);
	return false;
}

function compare_eqgt_date(doc, index, item) {
	var val = doc[item.name];
	if (val)
		return item.value >= new Date(val);
	return false;
}

function compare_not_date(doc, index, item) {
	var val = doc[item.name];
	if (val)
		return item.value !== new Date(val);
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

	if (!val)
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

function errorhandling(err, builder, response) {
	if (err)
		return err;
	var is = response instanceof Array;
	if (!response || (is && !response.length))
		return builder.$callback_emptyerror ? new ErrorBuilder().push(builder.$callback_emptyerror) : null;
	return null;
}