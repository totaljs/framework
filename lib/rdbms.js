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

var urlParser = require('url');
var qs = require('querystring');
var http = require('http');
var https = require('https');
var builders = require('./builders');
var utils = require('./utils');
var errors = ['Schema not defined.', 'Primary key not defined.', 'Parameter builder must be QueryBuilder type.', 'Parameter builder must be OrderBuilder type.', 'Timeout'];

/*	
	@url {String}
	@connectionString {String}
    @autolock {Boolean}
*/
function SQLServer(url, connectionString, autolock) {
	this.url = url;
	this.autolock = autolock || true;
	this.connectionString = connectionString;
};

/*
	@url {String}
	@connectionString {String}
*/
function MySQL(url, connectionString) {
	this.url = url;
	this.connectionString = connectionString;
};

/*	
	@fileName {String}
	@mode {String} :: optional, 'OPEN_READONLY', 'OPEN_READWRITE', 'OPEN_CREATE', default: OPEN_READWRITE | OPEN_CREATE
	@debug {Boolean} :: optional, default false (if true sqlite3 use verbose())
*/
function SQLite(fileName, mode, debug) {
	this.db = null;
	this.isOpened = false;
	this.fileName = fileName;
	this.mode = mode || '';
	this.debug = debug;
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
	if (index === 0)
		index = name.indexOf('/');

	return name.substring(index + 1);
}

/*	
	Send request to server
	@url {String}
	@connectionString {String}
    @query {String}
    @params {Object}
    @type {String}
    @callback {Function}
    @cache {Number} :: minutes
*/
function connect(url, connectionString, query, params, type, callback, cache) {

	var uri = urlParser.parse(url);
	var headers = {};

	headers['Content-Type'] = 'application/x-www-form-urlencoded';
	var options = { protocol: uri.protocol, auth: uri.auth, method: 'POST', hostname: uri.hostname, port: uri.port, path: uri.pathname, agent:false, headers: headers };

	var response = function (res) {
		var buffer = '';

		res.on('data', function(chunk) {
			buffer += chunk.toString('utf8');
		})

		res.on('end', function() {
			
			var value = buffer.isJSON() ? JSON.parse(buffer) : buffer;
			var error = null;

			if (res.statusCode > 200) {
				error = new Error(value.error || buffer);
				value = null;
			}

			callback(error, value);
		});
	};

	var con = options.protocol === 'https:' ? https : http;
	var req = callback ? con.request(options, response) : con.request(options);

	req.on('error', function(err) {
		callback(err, null);
	});

	req.setTimeout(exports.timeout, function() {
		callback(new Error(errors[4]), null);
	});

	var param = {};

    if (params !== null) {

    	var isParam = params instanceof builders.QueryBuilder || params instanceof builders.ParameterBuilder;

    	if (!isParam && typeof(params) === 'object') {
    		params = new builders.ParameterBuilder().add(params);
    		isParam = true;
    	}

		if (isParam) {

			Object.keys(params.params).forEach(function(o) {

				var value = params.params[o]; 
				var type = '';
				var t = null;
				var max = 0;

				if (params.schema !== null) {

					var schema = params.schema[o];
					var schemaType = typeof(schema);

					if (schemaType !== 'undefined') {

						if (schemaType === 'function') {
							if (schemaType === String)
								type = 'string';
							else if (schemaType === Number)
								type = 'number';
							else if (schemaType === Boolean)
								type = 'bool';
							else if (schemaType instanceof Date)
								type = 'date';
							else if (schemaType instanceof Buffer)
								type = 'base64';
						} else {
							type = schema;
							if (type.indexOf('string') > -1) {
								type = 'string';
								var index = schema.indexOf('(');
								if (index > 0) {
									max = parseInt(schema.substring(index + 1, schema.indexOf(')')));
									if (max > 0 && value.length > max)
										value = value.substring(0, max);
								}
							}
						}
					}
				}

				if (type === '') {
					t = typeof(value);
					type = 'string';

					if (t === 'number') {
						value = value.toString();
						if (value.indexOf('.') > 0)
							type = 'float';
						else
							type = 'int';
					}					
					else if (t === 'boolean')
						type = 'bool';
					else if (value instanceof Date)
						type = 'datetime';
					else if (value instanceof Buffer)
						type = 'base64';
				}

				switch(type.toLowerCase()) {
					case 'string':
						break;
					case 'int':
					case 'int32':
					case 'integer':
						type = 'int';
						value = value.toString();
						break;
					case 'decimal':
					case 'float':
					case 'double':
						value = value.toString();
						break;
					case 'byte':
						type = 'byte';
						value = value.toString();
						break;
					case 'short':
					case 'int16':
						type = 'short';
						value = value.toString();
						break;
					case 'short':
					case 'int63':
						type = 'short';
						value = value.toString();
						break;
					case 'base64':
					case 'binary':
						type = 'base64';
						
						if (value instanceof Buffer)
							value = value.toString('base64');

						break;
					case 'bool':
					case 'boolean':
						type = 'bool';
						value = value ? 'true' : 'false';
						break;
					case 'date':
					case 'datetime':
					case 'time':
						type = 'datetime';
   						value = [value.getUTCFullYear(), (value.getUTCMonth() + 1).toString().padLeft(2), value.getUTCDate().toString().padLeft(2)].join('-') + 'T' + [value.getUTCHours().toString().padLeft(2), value.getUTCMinutes().toString().padLeft(2), value.getUTCSeconds().toString().padLeft(2)].join(':') + 'Z';
						break;
				}

				param[o] = type + '#' + (value || '');
			});
		};
	}

	param['__query'] = query;
	param['__connectionstring'] = connectionString;

	if (type.length > 7) {
		param['__contenttype'] = type;
		type = 'scalar';
	}

	if (cache > 0)
		param['__cache'] = cache;

	param['__type'] = type || 'reader';

	if (exports.debug) {
		console.log(query);
		console.log(params);
		console.log('--------------------------------------------');
	}

	req.end(qs.stringify(param));
};

// ======================================================
// PROTOTYPES
// ======================================================

/*
	Send request to server
	@sql {String}
    @params {Object}
    @type {String}
    @callback {Function}
    @cache {Number} :: minutes (optional, default: 0)
*/
SQLServer.prototype.connect = function(sql, params, type, callback, cache) {
	var self = this;
	connect(self.url, self.connectionString, sql, params, type, callback, cache);
	return self;
};

/*
	Execute
	@sql {String}
    @params {Object}
    @callback {Function}
    return {SQLServer}
*/
SQLServer.prototype.execute = function(sql, params, callback) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'execute', callback);
	return self;
};

/*	
	Scalar
	@sql {String}
    @params {Object}
    @callback {Function}
    @cache {Number} :: minutes (optional, default: 0)
    return {SQLServer}
*/
SQLServer.prototype.scalar = function(sql, params, callback, cache) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'scalar', callback, cache);
	return self;
};

/*
	Reader
	@sql {String}
    @params {Object}
    @callback {Function}
    @cache {Number} :: minutes (optional, default: 0)
    return {SQLServer}
*/
SQLServer.prototype.reader = function(sql, params, callback, cache) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'reader', callback, cache);
	return self;
};

/*
	Count
	@sql {String}
	@builder {QueryBuilder}
    @callback {Function}
    @cache {Number} :: minutes (optional, default: 0)
    return {SQLServer}
*/
SQLServer.prototype.count = function(schema, builder, callback, cache) {
	
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
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;
	}

	self.scalar('SELECT COUNT(*) FROM ' + prepareSchema(schema) + (self.autolock ? ' WITH (NOLOCK)' : '') + where, builder, callback, cache);
	return self;
};

/*
	Find by primary key
	@schema {String}
	@value {Object}
    @callback {Function}
    @without {String array} :: Without columns name
    @cache {Number} :: minutes (optional, default: 0)
    return {SQLServer}
*/
SQLServer.prototype.findPK = function(schema, value, callback, without, cache) {

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
	var query = 'SELECT TOP 1 ' + columns + ' FROM ' + prepareSchema(schema) + (self.autolock ? ' WITH (NOLOCK)' : '') + ' WHERE ' + primary.name + '={' + primary.name + '}';

	var param = {};
	param[primary.name] = value;

	self.connect(query, param, 'reader', callback, cache);
	return self;
};

/*
	Find all
	@schema {String}
	@builder {QueryBuilder}
	@order {OrderBuilder}
	@take {Number}
	@skip {Number}
    @callback {Function}
    @without {String array} :: Without columns name
    @cache {Number} :: minutes (optional, default: 0)
    return {SQLServer}
*/
SQLServer.prototype.findAll = function(schema, builder, order, take, skip, callback, without, cache) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null) {
		throw new Error(errors[0]);
	}

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
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;
	}

	if (order !== null) {
		if (!(order instanceof builders.OrderBuilder))
			throw new Error(errors[3]);

		order.builder.forEach(function(o) {
			if (o.type == 'desc')
				sort += (sort.length > 0 ? ', ' : '') + o.name + ' DESC';
		});
	}

	var columns = column.join(', ');
	var query = '';

	if (take === 0 && skip === 0)
		query = 'SELECT ' + columns + ' FROM ' + prepareSchema(schema) + (self.autolock ? ' WITH (NOLOCK)' : '') + where + (sort.length > 0 ? ' ORDER BY ' + sort : '');
	else {
		
		if (sort.length === 0)
			sort = first;

		query = 'SELECT TOP ' + take + ' ' + columns + ' FROM (SELECT ROW_NUMBER() OVER (ORDER BY ' + sort + ') As rowindex, ' + column + ' FROM ' + prepareSchema(schema) + (self.autolock ? ' WITH (NOLOCK)' : '') + where + ') AS _query WHERE _query.rowindex>' + skip + ' ORDER BY _query.rowindex';
	}

	self.connect(query, builder, 'reader', callback, cache);
	return self;
};

/*
	Find TOP
	@top {Number}
	@schema {String}
	@builder {QueryBuilder}
	@order {OrderBuilder}
    @callback {Function}
    @without {String array} :: Without columns name
    @cache {Number} :: minutes (optional, default: 0)
    return {SQLServer}
*/
SQLServer.prototype.findTop = function(top, schema, builder, order, callback, without, cache) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var column = [];
	without = without || [];

	Object.keys(obj).forEach(function(o, index) {
		if (without.indexOf(o) === -1)
			column.push(o);
	});

	var where = '';
	var sort = '';

	if (builder !== null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue())
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;		
	}

	if (order !== null) {
		if (!(order instanceof builders.OrderBuilder))
			throw new Error(errors[3]);

		order.builder.forEach(function(o) {
			if (o.type == 'desc')
				sort += (sort.length > 0 ? ', ' : '') + o.name + ' DESC';
		});
	}

	var columns = column.join(', ');
	var query = 'SELECT TOP ' + top + ' ' + columns + ' FROM ' + prepareSchema(schema) + (self.autolock ? ' WITH (NOLOCK)' : '') + where + (sort.length > 0 ? ' ORDER BY ' + sort : '');

	self.connect(query, builder, 'reader', callback, cache);
	return self;
};

/*
	Insert record
	@schema {String}
	@value {Object}
    @callback {Function}
    @without {String array} :: Without columns name
    return {SQLServer}
*/
SQLServer.prototype.insert = function(schema, value, callback, without) {

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
			parameterBuilder.add(o, value[o]);			
		}
	});

	var query = 'INSERT INTO ' + prepareSchema(schema) + (self.autolock ? ' WITH (ROWLOCK) ' : '') + '(' + column.join(',') + ') VALUES(' + values.join(',') + '); SELECT @@IDENTITY';
	self.connect(query, parameterBuilder, 'scalar', callback);
	return self;
};

/*
	Update record
	@schema {String}
	@value {Object}
    @callback {Function}
    @without {String array} :: Without columns name
    return {SQLServer}
*/
SQLServer.prototype.update = function(schema, value, callback, without) {

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

		parameterBuilder.add(o, value[o]);
	});

	var query = 'UPDATE ' + prepareSchema(schema) + (self.autolock ? ' WITH (ROWLOCK) ' : '') + 'SET ' + values.join(',') + ' WHERE ' + primary.name + '={' + primary.name + '}';
	self.connect(query, parameterBuilder, 'execute', callback);
	return self;
};

/*
	Delete record
	@schema {String}
	@value {Object}
    @callback {Function}
    return {SQLServer}
*/
SQLServer.prototype.delete = function(schema, value, callback) {

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

	var query = 'DELETE FROM ' + prepareSchema(schema) + (self.autolock ? ' WITH (ROWLOCK) ' : '') + ' WHERE ' + primary.name + '={' + primary.name + '}';
	self.connect(query, parameterBuilder, 'execute', callback);
	return self;
};

// ====================================
// MySQL prototypes
// ====================================

/*	
	Find by primary key
	@schema {String}
	@value {Object}
    @callback {Function}
    @without {String array} :: Without columns name
    @cache {Number} :: minutes (optional, default: 0)
    return {MySQL}
*/
MySQL.prototype.findPK = function(schema, value, callback, without, cache) {

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

	self.connect(query, param, 'reader', callback, cache);
	return self;
};

/*
	Send request to server
	@sql {String}
    @params {Object}
    @type {String}
    @callback {Function}
    @cache {Number} :: minutes (optional, default: 0)
    return {MySQL}
*/
MySQL.prototype.connect = function(sql, params, type, callback, cache) {
	var self = this;
	connect(self.url, self.connectionString, sql, params, type, callback, cache);
	return self;
};

/*
	Execute
	@sql {String}
    @params {Object}
    @callback {Function}
    return {MySQL}
*/
MySQL.prototype.execute = function(sql, params, callback) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'execute', callback);
	return self;
};

/*
	Scalar
	@sql {String}
    @params {Object}
    @callback {Function}
    @cache {Number} :: minutes (optional, default: 0)
    return {MySQL}
*/
MySQL.prototype.scalar = function(sql, params, callback, cache) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'scalar', callback, cache);
	return self;
};

/*
	Reader
	@sql {String}
    @params {Object}
    @callback {Function}
    @cache {Number} :: minutes (optional, default: 0)
    return {MySQL}
*/
MySQL.prototype.reader = function(sql, params, callback, cache) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'reader', callback, cache);
	return self;
};

/*
	Count
	@sql {String}
	@builder {QueryBuilder}
    @callback {Function}
    @cache {Number} :: minutes (optional, default: 0)
    return {MySQL}
*/
MySQL.prototype.count = function(schema, builder, callback, cache) {
	
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
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;
	}

	self.scalar('SELECT COUNT(*) FROM ' + prepareSchema(schema) + where, builder, callback, cache);
	return self;
};

/*
	Find all
	@top {Number}
	@schema {String}
	@builder {QueryBuilder}
	@order {OrderBuilder}
    @callback {Function}
    @without {String array} :: Without columns name
    @cache {Number} :: minutes (optional, default: 0)
    return {MySQL}
*/
MySQL.prototype.findAll = function(schema, builder, order, take, skip, callback, without, cache) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null) {
		throw new Error(errors[0]);
	}

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
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;		
	}

	if (order !== null) {
		if (!(order instanceof builders.OrderBuilder))
			throw new Error(errors[3]);

		order.builder.forEach(function(o) {
			if (o.type == 'desc')
				sort += (sort.length > 0 ? ', ' : '') + o.name + ' DESC';
		});
	}

	var columns = column.join(', ');
	var query = '';

	if (take === 0 && skip === 0)
		query = 'SELECT ' + columns + ' FROM ' + prepareSchema(schema) + where + (sort.length > 0 ? ' ORDER BY ' + sort : '');
	else 	
		query = 'SELECT ' + columns + ' FROM ' + prepareSchema(schema) + where + (sort.length > 0 ? ' ORDER BY ' + sort : '') + ' LIMIT ' + take + ',' + skip;

	self.connect(query, builder, 'reader', callback, cache);
	return self;
};

/*
	Find all
	@top {Number}
	@schema {String}
	@builder {QueryBuilder}
	@order {OrderBuilder}
    @callback {Function}
    @without {String array} :: Without columns name
    @cache {Number} :: minutes (optional, default: 0)
    return {MySQL}
*/
MySQL.prototype.findTop = function(top, schema, builder, order, callback, without, cache) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var column = [];
	without = without || [];

	Object.keys(obj).forEach(function(o, index) {
		if (without.indexOf(o) === -1)
			column.push(o);
	});

	var where = '';
	var sort = '';

	if (builder !== null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue())
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;
	}

	if (order !== null) {
		if (!(order instanceof builders.OrderBuilder))
			throw new Error(errors[3]);

		order.builder.forEach(function(o) {
			if (o.type == 'desc')
				sort += (sort.length > 0 ? ', ' : '') + o.name + ' DESC';
		});
	}

	var columns = column.join(', ');
	var query = 'SELECT ' + columns + ' FROM ' + prepareSchema(schema) + where + (sort.length > 0 ? ' ORDER BY ' + sort : '') + ' LIMIT ' + top;

	self.connect(query, builder, 'reader', callback, cache);
	return self;
};

/*
	Insert record
	@schema {String}
	@value {Object}
    @callback {Function}
    @without {String array} :: Without columns name
    return {MySQL}
*/
MySQL.prototype.insert = function(schema, value, callback, without) {

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
			parameterBuilder.add(o, value[o]);			
		}
	});

	var query = 'INSERT INTO ' + prepareSchema(schema) + '(' + column.join(',') + ') VALUES(' + values.join(',') + '); SELECT LAST_INSERT_ID();';
	self.connect(query, parameterBuilder, 'scalar', callback);
	return self;
};

/*
	Update record
	@schema {String}
	@value {Object}
    @callback {Function}
    @without {String array} :: Without columns name
    return {MySQL}
*/
MySQL.prototype.update = function(schema, value, callback, without) {

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

		parameterBuilder.add(o, value[o]);
	});

	var query = 'UPDATE ' + prepareSchema(schema) + 'SET ' + values.join(',') + ' WHERE ' + primary.name + '={' + primary.name + '}';
	self.connect(query, parameterBuilder, 'execute', callback);
	return self;
};

/*
	Delete record
	@schema {String}
	@value {Object}
    @callback {Function}
    return {MySQL}
*/
MySQL.prototype.delete = function(schema, value, callback) {

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
	self.connect(query, parameterBuilder, 'execute', callback);
	return self;
};

// ====================================
// SQLite prototypes
// ====================================

/*
	Debug mode events
	on('trace')
	on('profile')
*/
SQLite.prototype.on = function(name, fn) {
	var self = this;
	self.open();
	self.db.on(name, fn);
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

	var sqlite3 = self.debug ? require('sqlite3').verbose() : require('sqlite3');
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
    @callback {Function}
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

	var prepare = self.db.prepare(self.make(sql), params, function(err) {

		if (err)
			return callback(err, null);

		self.db.run(this.sql, params, function(err) {
			var obj = this;
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
    @callback {Function}
    return {SQLite}
*/
SQLite.prototype.scalar = function(sql, params, callback) {
	return this.get(sql, params, callback);
};

/*
	Get single row result
	@sql {String}
    @params {Object}
    @callback {Function}
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
    @callback {Function}
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
    @callback {Function}
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
			where = ' WHERE ' + builder.builder.join(' ');

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
    @callback {Function}
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
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;		
	}

	if (order !== null) {
		if (!(order instanceof builders.OrderBuilder))
			throw new Error(errors[3]);

		order.builder.forEach(function(o) {
			if (o.type == 'desc')
				sort += (sort.length > 0 ? ', ' : '') + o.name + ' DESC';
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

SQLite.prototype.findTop = function(top, schema, builder, order, callback, without) {
	return this.findAll(schema, builder, order, top, 0, callback, without);
};

/*	
	Find by primary key
	@schema {String}
	@value {Object}
    @callback {Function}
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
    @callback {Function}
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
			parameterBuilder.add(o, value[o]);			
		}
	});

	var query = 'INSERT INTO ' + prepareSchema(schema) + '(' + column.join(',') + ') VALUES(' + values.join(',') + ')';
	self.execute(query, parameterBuilder, function(err, data) {
		if (err === null)
			value[primary.name] = data.id;
		callback(err, value, data.changes);
	});

	return self;
};

/*
	Update record
	@schema {String}
	@value {Object}
    @callback {Function}
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

		parameterBuilder.add(o, value[o]);
	});

	var query = 'UPDATE ' + prepareSchema(schema) + ' SET ' + values.join(',') + ' WHERE ' + primary.name + '={' + primary.name + '}';

	self.execute(query, parameterBuilder, function(err, data) {
		callback(err, value, data.changes);
	});

	return self;
};

/*
	Delete record
	@schema {String}
	@value {Object}
    @callback {Function}
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
		callback(err, value, data.changes);
	});

	return self;
};

// ======================================================
// EXPORTS
// ======================================================

exports.debug = false;
exports.timeout = 10000;
exports.SQLServer = SQLServer;
exports.MySQL = MySQL;
exports.SQLite = SQLite;