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

var builders = require('./builders');
var utils = require('./utils');
var errors = ['Schema is not defined.', 'Primary key is not defined.', 'Parameter builder must be QueryBuilder type.', 'Parameter builder must be OrderBuilder type.'];

/*
	Constructor
	@fileName {String}
	@mode {String} :: optional, 'OPEN_READONLY', 'OPEN_READWRITE', 'OPEN_CREATE', default: OPEN_READWRITE | OPEN_CREATE
*/
function SQLite(fileName, mode) {
	this.db = null;
	this.isOpened = false;
	this.fileName = fileName;
	this.mode = mode || '';
};

// ======================================================
// FUNCTIONS
// ======================================================

/*
	Prepare schema name
	@name {String}
	return {String}
*/
function prepareSchema(name) {
	var index = name.indexOf('#');
	if (index === -1)
		index = name.indexOf('/');
	return name.substring(index + 1);
}

// ====================================
// SQLite prototypes
// ====================================

/*
	https://github.com/developmentseed/node-sqlite3/wiki/Control-Flow
	@fn {Function}
	@transaction {Boolean}
	return {SQLite}
*/
SQLite.prototype.serialize = function(fn, transaction) {
	var self = this;

	if (typeof(fn) === 'boolean') {
		transaction = fn;
		fn = null;
	}

	self.open();
	self.db.serialize(fn);

	if (transaction)
		self.transaction(true);

	return self;
};

/*
	https://github.com/developmentseed/node-sqlite3/wiki/Control-Flow
	@fn {Function}
	@transaction {Boolean}
	return {SQLite}
*/
SQLite.prototype.parallelize = function(fn, transaction) {
	var self = this;

	if (typeof(fn) === 'boolean') {
		transaction = fn;
		fn = null;
	}

	self.open();

	if (transaction)
		self.transaction(false);

	self.db.parallelize(fn);
	return self;
};

/*
	https://github.com/developmentseed/node-sqlite3/wiki/API
	@sql {String}
	@params {Object}
	@cb {Function}
	return {SQLite}
*/
SQLite.prototype.prepare = function(sql, params, cb) {
	var self = this;
	self.open();	
	self.db.prepare(sql, params, cb);
	return self;
};

/*
	Events
	on('trace')
	on('profile')
	return {SQLite}
*/
SQLite.prototype.on = function(name, fn) {
	var self = this;
	self.open();
	self.db.on(name, fn);
	return self;
};

/*
	Set transaction
	@begin {Boolean or String}
	return {SQLite}
*/
SQLite.prototype.transaction = function(begin) {
	var self = this;
	self.open();
	
	if (typeof(begin) === 'boolean') {
		
		if (begin)
			self.db.run('BEGIN TRANSACTION');
		else
			self.db.run('COMMIT TRANSACTION');

		return self;
	}

	self.db.run(begin.toString().toUpperCase() + ' TRANSACTION');
	return self;
};

/*
	Set pragma journal mode
	@type {String} :: DELETE | TRUNCATE | PERSIST | MEMORY | WAL | OFF, default MEMORY
	return {SQLite}
*/
SQLite.prototype.setJournal = function(type) {
	var self = this;
	type = type || 'MEMORY';
	self.open();
	self.db.run('PRAGMA journal_mode=' + type);
	return self;
};

/*
	Set pragma journal mode
	@type {String} :: WAL, MEMORY
	@default {Boolean} :: optional, default true
	return {SQLite}
*/
SQLite.prototype.setCache = function(size, def) {
	var self = this;
	size = size || 2000;
	self.open();
	self.db.run('PRAGMA ' + (def || true ? 'default_' : '') + 'cache_size=' + size);
	return self;
};

/*
	Get SQLite database object
*/
SQLite.prototype.database = function() {
	var self = this;
	self.open();
	return self.db;
};

/*
	Open SQLite database
    return {SQLite}
*/
SQLite.prototype.open = function() {
	var self = this;

	if (self.isOpened)
		return self;

	var sqlite3 = require('sqlite3');
	self.db = new sqlite3.cached.Database(self.fileName, sqlite3[self.mode]);
	self.isOpened = true;
	return self;
};

/*
	Close SQLite database
    return {SQLite}
*/
SQLite.prototype.close = function() {
	var self = this;

	if (!self.isOpened)
		return self;

	return self;
};

/*
	Execute
	@sql {String}
    @params {Object}
    @callback {Function} :: function(err, data)
    return {SQLite}
*/
SQLite.prototype.execute = function(sql, params, callback) {
	
	var self = this;
	self.open();

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	params = self.make(params);
	var prepare = self.db.prepare(self.make(sql), params, function(err, a) {

		if (err) {
			if (callback)
				return callback(err, null);
			return;
		}

		self.db.run(this.sql, params, function(err) {
			var obj = this;
			if (callback)
				callback.call(self, err, err === null ? { id: obj.lastID, changes: obj.changes } : null);
		});
		
	});

	return self;
};

/*
	SQLite run command
	@sql {String}
    @params {Object}
    return {SQLite}
*/
SQLite.prototype.run = function(sql, params) {
	var self = this;
	self.open();
	self.db.run(sql, params);
	return self;
};

/*
	Get single row result
	@sql {String}
    @params {Object}
    @callback {Function} :: function(err, data)
    return {SQLite}
*/
SQLite.prototype.scalar = function(sql, params, callback) {
	return this.get(sql, params, callback);
};

/*
	Get single row result
	@sql {String}
    @params {Object}
    @callback {Function} :: function(err, data)
    return {SQLite}
*/
SQLite.prototype.get = function(sql, params, callback) {
	
	var self = this;
	self.open();

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.db.get(self.make(sql), self.make(params), function(err, data) {
		callback.call(self, err, err === null ? data || null : null);
	});

	return self;
};

/*
	Prepare params and SQL query
	@value {String or Object}
    return {String or Value}
*/
SQLite.prototype.make = function(value) {

	var type = typeof(value);

	if (value === null || type === 'undefined')
		return {};

	if (type === 'string')
		return value.replace(/\{/g, '$').replace(/\}/g, '');

	var isParam = value instanceof builders.QueryBuilder || value instanceof builders.ParameterBuilder;
	if (isParam)
		value = value.params;

	var arg = {};
	var self = this;

	Object.keys(value).forEach(function(o) {
		var val = value[o];

		if (utils.isDate(val))
			val = val.format('yyyy-MM-dd HH:mm:ss');

		arg['$' + o] = val;
	});

	return arg;
};

/*
	Reader
	@sql {String}
    @params {Object}
    @callback {Function} :: function(err, data)
    return {SQLite}
*/
SQLite.prototype.reader = function(sql, params, callback) {
	
	var self = this;
	self.open();

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.db.all(self.make(sql), self.make(params), function(err, data) {
		callback.call(self, err, err === null ? data || [] : null);
	});

	return self;
};

/*
	Count
	@sql {String}
	@builder {QueryBuilder}
    @callback {Function} :: function(err, count)
    return {SQLite}
*/
SQLite.prototype.count = function(schema, builder, callback) {
	
	var self = this;
	var obj = builders.schema(schema);

	if (obj === null)
		throw new Error(errors[0]);

	if (typeof(builder) === 'function' && typeof(callback) === 'undefined') {
		callback = builder;
		builder = null;
	}

	var where = '';

	if (builder !== null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue())
			where = ' WHERE ' + builder.toString();

		builder.schema = obj;
	}

	self.scalar('SELECT COUNT(*) As value FROM ' + prepareSchema(schema) + where, builder, function(err, data) {
		callback(err, err === null ? data.value : 0);
	});
	return self;
};

/*
	Find all
	@schema {String}
	@builder {QueryBuilder}
	@order {OrderBuilder}
	@take {Number}
	@skip {Number}
    @callback {Function} :: function(err, data)
    @without {String array} :: Without columns name
    return {SQLServer}
*/
SQLite.prototype.findAll = function(schema, builder, order, take, skip, callback, without) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var column = [];
	var first = '';

	take = take || 0;
	skip = skip || 0;
	without = without || [];

	Object.keys(obj).forEach(function(o, index) {
		if (without.indexOf(o) === -1) {
			if (index == 0)
				first = o;
			column.push(o);
		}
	});

	var where = '';
	var sort = '';

	if (builder !== null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue())
			where = ' WHERE ' + builder.toString();

		builder.schema = obj;
	}

	if (order !== null) {
		if (!(order instanceof builders.OrderBuilder))
			throw new Error(errors[3]);

		order.builder.forEach(function(o) {
			sort += (sort.length > 0 ? ', ' : '') + o.name + (o.type === 'desc' ? ' DESC' : ' ASC');
		});
	}

	var columns = column.join(', ');
	var query = query = 'SELECT ' + columns + ' FROM ' + prepareSchema(schema) + where + (sort.length > 0 ? ' ORDER BY ' + sort : '');

	if (take !== 0 && skip !== 0)
		query += ' LIMIT ' + take + ' OFFSET ' + skip;
	else if (take !== 0)
		query += ' LIMIT ' + take;
	else if (skip !== 0)
		query += ' OFFSET ' + take;

	self.reader(query, builder, callback);
	return self;
};

/*
	All
	@schema {String}
	@builder {QueryBuilder}
	@order {OrderBuilder}
    @callback {Function} :: function(err, data)
    @without {String array} :: Without columns name
    return {SQLServer}
*/
SQLite.prototype.all = function(schema, order, callback, without) {
	
	if (typeof(order) === 'function') {
		without = callback;
		callback = order;
		order = null;
	}

	return this.findAll(schema, null, order, 0, 0, callback, without);
};

/*
	Find top
	@schema {String}
	@builder {QueryBuilder}
	@order {OrderBuilder}
	@take {Number}
	@skip {Number}
    @callback {Function} :: function(err, data)
    @without {String array} :: Without columns name
    return {SQLServer}
*/
SQLite.prototype.findTop = function(top, schema, builder, order, callback, without) {
	
	if (typeof(order) === 'function') {
		without = callback;
		callback = order;
		order = null;
	}

	return this.findAll(schema, builder, order, top, 0, callback, without);
};

/*
	Find one
	@schema {String}
	@builder {QueryBuilder}
	@order {OrderBuilder}
	@take {Number}
	@skip {Number}
    @callback {Function} :: function(err, data)
    @without {String array} :: Without columns name
    return {SQLServer}
*/
SQLite.prototype.findOne = function(schema, builder, order, callback, without) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	if (typeof(order) === 'function') {
		without = callback;
		callback = order;
		order = null;
	}

	var column = [];
	var first = '';
	without = without || [];

	Object.keys(obj).forEach(function(o, index) {
		if (without.indexOf(o) === -1) {
			if (index == 0)
				first = o;
			column.push(o);
		}
	});

	var where = '';
	var sort = '';

	if (builder !== null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue())
			where = ' WHERE ' + builder.toString();

		builder.schema = obj;
	}

	if (order !== null) {
		if (!(order instanceof builders.OrderBuilder))
			throw new Error(errors[3]);

		order.builder.forEach(function(o) {
			sort += (sort.length > 0 ? ', ' : '') + o.name + (o.type === 'desc' ? ' DESC' : ' ASC');
		});
	}

	var columns = column.join(', ');
	var query = query = 'SELECT ' + columns + ' FROM ' + prepareSchema(schema) + where + (sort.length > 0 ? ' ORDER BY ' + sort : '') + ' LIMIT 1';
	self.get(query, builder, callback);
	return self;
};

/*
	Find by primary key
	@schema {String}
	@value {Object}
    @callback {Function} :: function(err, data)
    @without {String array} :: Without columns name
    return {SQLite}
*/
SQLite.prototype.findPK = function(schema, value, callback, without) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null) {
		throw new Error(errors[0]);
	}

	var primary = builders.primaryKey(schema);

	if (primary == null)
		throw new Error(errors[1]);

	var column = [];

	without = without || [];

	Object.keys(obj).forEach(function(o) {
		if (without.indexOf(o) === -1) {
			column.push(o);
		}
	});

	var columns = column.join(', ');
	var query = 'SELECT ' + columns + ' FROM ' + prepareSchema(schema) + ' WHERE ' + primary.name + '={' + primary.name + '} LIMIT 1';

	var param = {};
	param[primary.name] = value;

	self.get(query, param, callback);
	return self;
};

/*
	Insert record
	@schema {String}
	@value {Object}
    @callback {Function} :: function(err, data, changes)
    @without {String array} :: Without columns name
    return {SQLite}
*/
SQLite.prototype.insert = function(schema, value, callback, without) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var column = [];
	var values = [];
	without = without || [];

	var primary = builders.primaryKey(schema);
	var parameterBuilder = new builders.ParameterBuilder();
	parameterBuilder.schema = obj;

	if (primary !== null) {
		if (!primary.insert)
			without.push(primary.name);
	}

	Object.keys(obj).forEach(function(o, index) {
		if (without.indexOf(o) === -1) {
			column.push(o);
			values.push('{' + o + '}');
			value[o] = trim(value[o]);
			parameterBuilder.add(o, self.prepareType(obj[o], value[o]));
		}
	});

	var query = 'INSERT INTO ' + prepareSchema(schema) + '(' + column.join(',') + ') VALUES(' + values.join(',') + ')';
	self.execute(query, parameterBuilder, function(err, data) {

		if (err === null) {
			value[primary.name] = data.id;
			callback && callback(err, value, data.changes);
		} else
			callback(err, null);

	});

	return self;
};

/*
	Update record
	@schema {String}
	@value {Object}
    @callback {Function} :: function(err, data, changes)
    @without {String array} :: Without columns name
    return {SQLite}
*/
SQLite.prototype.update = function(schema, value, callback, without) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var column = [];
	var values = [];
	without = without || [];

	var primary = builders.primaryKey(schema);
	var parameterBuilder = new builders.ParameterBuilder();
	parameterBuilder.schema = obj;

	if (primary === null)
		throw new Error(errors[1]);

	without.push(primary.name);

	Object.keys(obj).forEach(function(o, index) {

		if (without.indexOf(o) === -1)
			values.push(o + '={' + o + '}');

		value[o] = trim(value[o]);
		parameterBuilder.add(o, self.prepareType(obj[o], value[o]));
	});

	var query = 'UPDATE ' + prepareSchema(schema) + ' SET ' + values.join(',') + ' WHERE ' + primary.name + '={' + primary.name + '}';

	self.execute(query, parameterBuilder, function(err, data) {
		if (callback)
			callback(err, value, data.changes);
	});

	return self;
};

/*
	Delete record
	@schema {String}
	@value {Object}
    @callback {Function} :: function(err, data, changes)
    return {SQLite}
*/
SQLite.prototype.delete = function(schema, value, callback) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var primary = builders.primaryKey(schema);
	var parameterBuilder = new builders.ParameterBuilder();
	parameterBuilder.schema = obj;

	if (primary === null)
		throw new Error(errors[1]);

	parameterBuilder.add(primary.name, value[primary.name]);

	var query = 'DELETE FROM ' + prepareSchema(schema) + ' WHERE ' + primary.name + '={' + primary.name + '}';

	self.execute(query, parameterBuilder, function(err, data) {
		if (callback)
			callback(err, value, data.changes);
	});

	return self;
};

/*
	Create table
	@schema {String}
	@callback {Function} :: @callback(boolean)
	@temporary {Boolean} :: optional, default false
    return {SQLite}
*/
SQLite.prototype.schemaCreate = function(schema, callback, temporary) {
	var self = this;
	var name = prepareSchema(schema);

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var builder = '';
	var primary = builders.primaryKey(schema);

	Object.keys(obj).forEach(function(o) {

		var type = typeof(obj[o]);
		var value = obj[o];

		if (builder.length > 0)
			builder += ',';

		if (type === 'function') {

			if (value === Number)
				builder += o + ' INTEGER';
			else if (value === String)
				builder += ' TEXT';
			else if (value === Boolean)
				builder += ' BOOLEAN';
			else if (value === Date)
				builder += ' DATETIME';

		} else {

			value = value.toString();
			var index = value.indexOf('(');
			var size = 0;

			if (index !== -1) {
				size = parseInt(value.substring(index + 1, value.length - 1));
				value = value.substring(0, index);
			}

			switch (value.toLowerCase()) {
				case 'text':
				case 'string':
				case 'varchar':
				case 'nvarchar':
					builder += o + ' TEXT' + (size > 0 ? '(' + size + ')' : '');
					break;
				case 'int':
				case 'integer':
				case 'number':
				case 'decimal':
					builder += o + ' INTEGER';
					break;
				case 'bool':
				case 'boolean':
					builder += o + ' BOOLEAN';
					break;
				case 'date':
				case 'time':
				case 'datetime':
					builder += o + ' DATETIME';
					break;
			}

		}

		if (primary.name === o)
			builder += ' PRIMARY KEY NOT NULL';
		
	});

	builder = 'CREATE' + (temporary ? ' TEMP ' : ' ') + 'TABLE ' + name + ' (' + builder + ')';
	self.scalar("SELECT COUNT(*) As count FROM sqlite_master WHERE type='table' AND name='" + name + "'", function(err, data) {

		if (err)
			throw err;

		if (data.count === 0) {
			if (callback) {
				self.run(builder, function(err) {
					callback(err === null);
				});
			}
			else
				self.run(builder);

			return;
		}

		if (callback)
			callback(false);
	});

	return self;
};

/*
	Delete table
	@schema {String}
	@callback {Function} :: @callback(boolean)	
    return {SQLite}
*/
SQLite.prototype.schemaDrop = function(schema, callback) {
	var self = this;
	var name = prepareSchema(schema);

	var builder = 'DROP TABLE ' + name;
	self.scalar("SELECT COUNT(*) As count FROM sqlite_master WHERE type='table' AND name='" + name + "'", function(err, data) {

		if (err)
			throw err;

		if (data.count > 0) {

			if (callback) {
				self.run(builder, function(err) {
					callback(err === null);
				});
			}
			else
				self.run(builder);

			return;
		}

		if (callback)
			callback(false);
	});
};

/*
	Prepare value type by the schema
	@type {String}
	@value {String or Number or Boolean or Buffer}
    return {Value}
*/
SQLite.prototype.prepareType = function(type, value) {

	var name = type.toString();
	var index = name.indexOf('(');
	if (index === -1)
		return value;

	var size = utils.parseInt(name.substring(index + 1, name.length - 1));
	if (size === 0)
		return value;

	name = name.substring(0, index);

	switch (name) {
		case 'text':
		case 'string':
		case 'varchar':
		case 'nvarchar':
			return value.toString().maxLength(size, '...');
	}
	return value;
};

function trim(value) {
	if (typeof(value) === 'string')
		return value.trim();
	return value;
}


// ======================================================
// EXPORTS
// ======================================================

exports.init = function(fileName, mode) {
	return new SQLite(fileName, mode);
};

exports.database = exports.SQLite = exports.sqlite = SQLite;
