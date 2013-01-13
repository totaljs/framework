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
var builders = require('./builders');

var errors = ['Schema not defined.', 'Primary key not defined.', 'Parameter builder must be QueryBuilder type.', 'Parameter builder must be OrderBuilder type.'];

function SQLServer(url, connectionString, autolock) {
	this.url = url;
	this.autolock = autolock || true;
	this.connectionString = connectionString;
};

function MySQL(url, connectionString) {
	this.url = url;
	this.connectionString = connectionString;
};

// ======================================================
// FUNCTIONS
// ======================================================

function connect(url, connectionString, query, params, type, callback, cache) {

	var uri = urlParser.parse(url);
	var headers = {};

	headers['Content-Type'] = 'application/x-www-form-urlencoded';

	var options = { protocol: uri.protocol, auth: uri.auth, method: 'POST', hostname: uri.hostname, port: uri.port, path: uri.pathname, agent:false, headers: headers };

	var response = function (res) {
		var buffer = [];

		res.on('data', function(chunk) {
			buffer.push(chunk.toString('utf8'));
		})

		res.on('end', function() {
			var value = JSON.parse(buffer.join(''));
			callback(value);
		});
	};

	var req = callback ? http.request(options, response) : http.request(options);
	var param = {};

    if (params != null) {

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

				if (params.schema != null) {
					t = params.schema[o];
					if (typeof(t) === 'function') {
						if (t === String)
							type = 'string';
						else if (t === Number)
							type = 'number';
						else if (t === Boolean)
							type = 'bool';
						else if (t instanceof Date)
							type = 'date';
						else if (t instanceof Buffer)
							type = 'base64';
					}

					if (t.indexOf('string') > -1) { 
						var index = t.indexOf('(');
						if (index > 0) {
							max = parseInt(t.substring(index + 1, t.indexOf(')')));
							type = 'string';
						}
					}
				}

				if (type === '') {
					t = typeof(value);

					if (t === 'string') {
						type = 'string';
						if (max > 0 && value.length > max)
							value = value.substring(0, max);
					}
					else if (t === 'number') {
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

				switch(t.toString().toLowerCase()) {
					case 'string':
						t = 'string';
						break;
					case 'int':
					case 'int32':
					case 'integer':
						t = 'int';
						value = value.toString();
						break;
					case 'decimal':
					case 'float':
					case 'double':
						value = value.toString();
						break;
					case 'byte':
						t = 'byte';
						value = value.toString();
						break;
					case 'short':
					case 'int16':
						t = 'short';
						value = value.toString();
						break;
					case 'short':
					case 'int63':
						t = 'short';
						value = value.toString();
						break;
					case 'base64':
					case 'binary':
						t = 'base64';
						
						if (value instanceof Buffer)
							value = value.toString('base64');

						break;
					case 'bool':
					case 'boolean':
						t = 'bool';
						value = value ? 'true' : 'false';
						break;
					case 'date':
					case 'datetime':
					case 'time':
						t = 'datetime';
						value = value.toUTCString();
						break;
				}				

				param[o] = type + '#' + value;
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

	req.end(qs.stringify(param));
};

// ======================================================
// PROTOTYPES
// ======================================================

SQLServer.prototype.connect = function(sql, params, type, callback, cache) {
	var self = this;
	connect(self.url, self.connectionString, sql, params, type, callback, cache);
	return self;
};

SQLServer.prototype.execute = function(sql, params, callback) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'execute', callback);
	return self;
};

SQLServer.prototype.scalar = function(sql, params, callback, cache) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'scalar', callback, cache);
	return self;
};

SQLServer.prototype.reader = function(sql, params, callback, cache) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'reader', callback, cache);
	return self;
};

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
	var query = 'SELECT TOP 1 ' + columns + ' FROM ' + schema + (self.autolock ? ' WITH (NOLOCK)' : '') + ' WHERE ' + primary.name + '={{' + primary.name + '}}';

	var param = {};
	param[primary.name] = value;

	self.connect(query, param, 'reader', callback, cache);
	return self;
};

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

	if (builder != null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue)
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;		
	}

	if (order != null) {
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
		query = 'SELECT ' + columns + ' FROM ' + schema + (self.autolock ? ' WITH (NOLOCK)' : '') + where + (sort.length > 0 ? ' ORDER BY ' + sort : '');
	else {
		
		if (sort.length === 0)
			sort = first;

		query = 'SELECT TOP ' + take + ' ' + columns + ' FROM (SELECT ROW_NUMBER() OVER (ORDER BY ' + sort + ') As rowindex, ' + column + ' FROM ' + schema + (self.autolock ? ' WITH (NOLOCK)' : '') + where + ') AS _query WHERE _query.rowindex>' + skip + ' ORDER BY _query.rowindex';
	}

	self.connect(query, builder, 'reader', callback, cache);
	return self;
};

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

	if (builder != null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue)
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;		
	}

	if (order != null) {
		if (!(order instanceof builders.OrderBuilder))
			throw new Error(errors[3]);

		order.builder.forEach(function(o) {
			if (o.type == 'desc')
				sort += (sort.length > 0 ? ', ' : '') + o.name + ' DESC';
		});
	}

	var columns = column.join(', ');
	var query = 'SELECT TOP ' + top + ' ' + columns + ' FROM ' + schema + (self.autolock ? ' WITH (NOLOCK)' : '') + where + (sort.length > 0 ? ' ORDER BY ' + sort : '');

	self.connect(query, builder, 'reader', callback, cache);
	return self;
};

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

	if (primary != null) {
		if (!primary.insert)
			without.push(primary.name);
	}

	Object.keys(obj).forEach(function(o, index) {
		if (without.indexOf(o) === -1) {
			column.push(o);
			values.push('{{' + o + '}}');
			parameterBuilder.add(o, value[o]);			
		}
	});

	var query = 'INSERT INTO ' + schema + (self.autolock ? ' WITH (ROWLOCK) ' : '') + '(' + column.join(',') + ') VALUES(' + values.join(',') + '); SELECT @@IDENTITY';
	self.connect(query, parameterBuilder, 'scalar', callback);
	return self;
};

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
			values.push(o + '={{' + o + '}}');

		parameterBuilder.add(o, value[o]);
	});

	var query = 'UPDATE ' + schema + (self.autolock ? ' WITH (ROWLOCK) ' : '') + 'SET ' + values.join(',') + ' WHERE ' + primary.name + '={{' + primary.name + '}}';
	self.connect(query, parameterBuilder, 'execute', callback);
	return self;
};

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

	var query = 'DELETE FROM ' + schema + (self.autolock ? ' WITH (ROWLOCK) ' : '') + ' WHERE ' + primary.name + '={{' + primary.name + '}}';
	self.connect(query, parameterBuilder, 'execute', callback);
	return self;
};

// MySQL

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
	var query = 'SELECT ' + columns + ' FROM ' + schema + ' WHERE ' + primary.name + '={{' + primary.name + '}} LIMIT 1';

	var param = {};
	param[primary.name] = value;

	self.connect(query, param, 'reader', callback, cache);
	return self;
};

MySQL.prototype.connect = function(sql, params, type, callback, cache) {
	var self = this;
	connect(self.url, self.connectionString, sql, params, type, callback, cache);
	return self;
};

MySQL.prototype.execute = function(sql, params, callback) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'execute', callback);
	return self;
};

MySQL.prototype.scalar = function(sql, params, callback, cache) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'scalar', callback, cache);
	return self;
};

MySQL.prototype.reader = function(sql, params, callback, cache) {
	var self = this;

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.connect(sql, params, 'reader', callback, cache);
	return self;
};


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

	if (builder != null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue)
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;		
	}

	if (order != null) {
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
		query = 'SELECT ' + columns + ' FROM ' + schema + where + (sort.length > 0 ? ' ORDER BY ' + sort : '');
	else 	
		query = 'SELECT ' + columns + ' FROM ' + schema + where + (sort.length > 0 ? ' ORDER BY ' + sort : '') + ' LIMIT ' + take + ',' + skip;

	self.connect(query, builder, 'reader', callback, cache);
	return self;
};

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

	if (builder != null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue)
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;		
	}

	if (order != null) {
		if (!(order instanceof builders.OrderBuilder))
			throw new Error(errors[3]);

		order.builder.forEach(function(o) {
			if (o.type == 'desc')
				sort += (sort.length > 0 ? ', ' : '') + o.name + ' DESC';
		});
	}

	var columns = column.join(', ');
	var query = 'SELECT ' + columns + ' FROM ' + schema + where + (sort.length > 0 ? ' ORDER BY ' + sort : '') + ' LIMIT ' + top;

	self.connect(query, builder, 'reader', callback, cache);
	return self;
};

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

	if (primary != null) {
		if (!primary.insert)
			without.push(primary.name);
	}

	Object.keys(obj).forEach(function(o, index) {
		if (without.indexOf(o) === -1) {
			column.push(o);
			values.push('{{' + o + '}}');
			parameterBuilder.add(o, value[o]);			
		}
	});

	var query = 'INSERT INTO ' + schema + '(' + column.join(',') + ') VALUES(' + values.join(',') + '); SELECT LAST_INSERT_ID();';
	self.connect(query, parameterBuilder, 'scalar', callback);
	return self;
};

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
			values.push(o + '={{' + o + '}}');

		parameterBuilder.add(o, value[o]);
	});

	var query = 'UPDATE ' + schema + 'SET ' + values.join(',') + ' WHERE ' + primary.name + '={{' + primary.name + '}}';
	self.connect(query, parameterBuilder, 'execute', callback);
	return self;
};

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

	var query = 'DELETE FROM ' + schema + ' WHERE ' + primary.name + '={{' + primary.name + '}}';
	self.connect(query, parameterBuilder, 'execute', callback);
	return self;
};

// ======================================================
// EXPORTS
// ======================================================

exports.SQLServer = SQLServer;
exports.MySQL = MySQL;
