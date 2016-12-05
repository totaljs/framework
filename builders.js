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
 * @module FrameworkBuilders
 * @version 2.3.0
 */

'use strict';

const REQUIRED = 'The field "@" is required.';
const DEFAULT_SCHEMA = 'default';
const SKIP = { $$schema: true, $$result: true, $$callback: true, $$async: true, $$index: true, $$repository: true, $$can: true, $$controller: true };
const REGEXP_CLEAN_EMAIL = /\s/g;
const REGEXP_CLEAN_PHONE = /\s|\.|\-|\(|\)/g;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const Qs = require('querystring');

var schemas = {};
var transforms = { pagination: {}, error: {}, transformbuilder: {}, restbuilder: {} };

function SchemaBuilder(name) {
	this.name = name;
	this.collection = {};
}

/**
 *
 * Get a schema
 * @param {String} name
 * @return {Object}
 */
SchemaBuilder.prototype.get = function(name) {
	return this.collection[name];
};

/**
 * Create a new schema
 * @alias
 * @return {SchemaBuilderEntity}
 */
SchemaBuilder.prototype.create = function(name) {
	var self = this;
	self.collection[name] = new SchemaBuilderEntity(self, name);
	return self.collection[name];
};

/**
 * Remove an exist schema or group of schemas
 * @param {String} name Schema name, optional.
 * @return {SchemaBuilder}
 */
SchemaBuilder.prototype.remove = function(name) {
	var self = this;

	if (!name) {
		delete schemas[name];
		self.collection = null;
		return;
	}

	var schema = self.collection[name];
	schema && schema.remove();
	schema = null;
	return self;
};

SchemaBuilder.prototype.destroy = function(name) {
	return this.remove(name);
};

function SchemaBuilderEntity(parent, name) {
	this.parent = parent;
	this.name = name;
	this.primary;
	this.trim = true;
	this.schema = {};
	this.meta = {};
	this.properties = [];
	this.resourcePrefix;
	this.resourceName;
	this.transforms;
	this.workflows;
	this.hooks;
	this.operations;
	this.constants;
	this.onPrepare;
	this.onDefault;
	this.onValidate = framework.onValidate;
	this.onSave;
	this.onGet;
	this.onRemove;
	this.onQuery;
	this.onError;
	this.gcache = {};
	this.dependencies;
	this.fields;
	this.fields_allow;
	this.CurrentSchemaInstance = function(){};
	this.CurrentSchemaInstance.prototype = new SchemaInstance();
	this.CurrentSchemaInstance.prototype.$$schema = this;
}

SchemaBuilderEntity.prototype.allow = function(name) {
	var self = this;

	if (!self.fields_allow)
		self.fields_allow = [];

	for (var i = 0, length = arguments.length; i < length; i++) {
		if (arguments[i] instanceof Array)
			arguments[i].forEach(item => self.fields_allow.push(item));
		else
			self.fields_allow.push(arguments[i]);
	}
	return self;
};

/**
 * Define type in schema
 * @param {String|String[]} name
 * @param {Object/String} type
 * @param {Boolean} [required=false] Is required? Default: false.
 * @param {Number|String} [custom] Custom tag for search.
 * @return {SchemaBuilder}
 */
SchemaBuilderEntity.prototype.define = function(name, type, required, custom) {

	var self = this;
	if (name instanceof Array) {
		for (var i = 0, length = name.length; i < length; i++)
			self.define(name[i], type, required, custom);
		return self;
	}

	if (required !== undefined && typeof(required) !== 'boolean') {
		custom = required;
		required = false;
	}

	if (type instanceof SchemaBuilderEntity)
		type = type.name;

	self.schema[name] = self.$parse(name, type, required, custom);
	switch (self.schema[name].type) {
		case 7:
			if (!self.dependencies)
				self.dependencies = [];
			self.dependencies.push(name);
			break;
	}

	self.fields = Object.keys(self.schema);

	if (!required)
		return self;

	if (self.properties == null)
		self.properties = [];

	self.properties.indexOf(name) === -1 && self.properties.push(name);
	return self;
};

/**
 * Set primary key
 * @param {String} name
 */
SchemaBuilderEntity.prototype.setPrimary = function(name) {
	this.primary = name;
	return this;
};

/**
 * Filters current names of the schema via custom attribute
 * @param {Number/String} custom
 * @param {Object} model Optional
 * @param {Boolean} reverse Reverse results.
 * @return {Array|Object} Returns Array (with property names) if the model is undefined otherwise returns Object Name/Value.
 */
SchemaBuilderEntity.prototype.filter = function(custom, model, reverse) {
	var self = this;

	if (typeof(model) === 'boolean') {
		var tmp = reverse;
		reverse = model;
		model = tmp;
	}

	var output = model === undefined ? [] : {};
	var type = typeof(custom);
	var isSearch = type === 'string' ? custom[0] === '*' || custom[0] === '%' : false;
	var isReg = false;

	if (isSearch)
		custom = custom.substring(1);
	else if (type === 'object')
		isReg = framework_utils.isRegExp(custom);

	for (var prop in self.schema) {

		var schema = self.schema[prop];
		if (!schema)
			continue;

		var tv = typeof(schema.custom);

		if (isSearch) {
			if (tv === 'string') {
				if (schema.custom.indexOf(custom) === -1) {
					if (!reverse)
						continue;
				} else if (reverse)
					continue;
			} else
				continue;
		} else if (isReg) {
			if (tv === 'string') {
				if (!custom.test(schema.current)) {
					if (!reverse)
						continue;
				} else if (reverse)
					continue;
			} else
				continue;
		} else if (schema.custom !== custom) {
			if (!reverse)
				continue;
		} else if (reverse)
			continue;

		if (model === undefined)
			output.push(prop);
		else
			output[prop] = model[prop];
	}

	return output;
};

function parseLength(lower, result) {
	result.raw = 'string';
	var beg = lower.indexOf('(');
	if (beg === -1)
		return result;
	result.length = lower.substring(beg + 1, lower.length - 1).parseInt();
	result.raw = lower.substring(0, beg);
	return result;
}

SchemaBuilderEntity.prototype.$parse = function(name, value, required, custom) {

	var type = typeof(value);
	var result = {};

	result.raw = value;
	result.type = 0;
	result.length = 0;
	result.required = required ? true : false;
	result.isArray = false;
	result.custom = custom || '';

	// 0 = undefined
	// 1 = integer
	// 2 = float
	// 3 = string
	// 4 = boolean
	// 5 = date
	// 6 = object
	// 7 = custom object

	if (value === null)
		return result;

	if (value === '[]') {
		result.isArray = true;
		return result;
	}

	if (type === 'function') {

		if (value === Number) {
			result.type = 2;
			return result;
		}

		if (value === String) {
			result.type = 3;
			return result;
		}

		if (value === Boolean) {
			result.type = 4;
			return result;
		}

		if (value === Date) {
			result.type = 5;
			return result;
		}

		if (value === Array) {
			result.isArray = true;
			return result;
		}

		if (value === Object) {
			result.type = 6;
			return result;
		}

		return result;
	}

	if (type === 'object') {
		if (value instanceof Array) {
			result.type = 8; // enum
			result.subtype = typeof(value[0]);
		} else
			result.type = 9; // keyvalue
		return result;
	}

	if (value[0] === '[') {
		value = value.substring(1, value.length - 1);
		result.isArray = true;
		result.raw = value;
	}

	var lower = value.toLowerCase();

	if (lower === 'object') {
		result.type = 6;
		return result;
	}

	if (lower === 'array') {
		result.isArray = true;
		return result;
	}

	if (lower.contains(['string', 'text', 'varchar', 'nvarchar'])) {
		result.type = 3;
		return parseLength(lower, result);
	}

	if (lower.indexOf('capitalize') !== -1 || lower.indexOf('camel') !== -1) {
		result.type = 3;
		result.subtype = 'capitalize';
		return parseLength(lower, result);
	}

	if (lower.indexOf('lower') !== -1) {
		result.subtype = 'lowercase';
		result.type = 3;
		return parseLength(lower, result);
	}

	if (lower.indexOf('upper') !== -1) {
		result.subtype = 'uppercase';
		result.type = 3;
		return parseLength(lower, result);
	}

	if (lower === 'uid') {
		result.type = 3;
		result.length = 20;
		result.raw = 'string';
		result.subtype = 'uid';
		return result;
	}

	if (lower === 'email') {
		result.type = 3;
		result.length = 120;
		result.raw = 'string';
		result.subtype = 'email';
		return result;
	}

	if (lower === 'json') {
		result.type = 3;
		result.raw = 'string';
		result.subtype = 'json';
		return result;
	}

	if (lower === 'url') {
		result.type = 3;
		result.length = 500;
		result.raw = 'string';
		result.subtype = 'url';
		return result;
	}

	if (lower === 'zip') {
		result.type = 3;
		result.length = 10;
		result.raw = 'string';
		result.subtype = 'zip';
		return result;
	}

	if (lower === 'phone') {
		result.type = 3;
		result.length = 20;
		result.raw = 'string';
		result.subtype = 'phone';
		return result;
	}

	if (lower.contains(['int', 'byte'])) {
		result.type = 1;
		return result;
	}

	if (lower.contains(['decimal', 'number', 'float', 'double'])) {
		result.type = 2;
		return result;
	}

	if (lower.indexOf('bool') !== -1) {
		result.type = 4;
		return result;
	}

	if (lower.contains(['date', 'time'])) {
		result.type = 5;
		return result;
	}

	result.type = 7;
	return result;
};

SchemaBuilderEntity.prototype.getDependencies = function() {
	var self = this;
	var dependencies = [];

	for (var name in self.schema) {

		var type = self.schema[name];

		if (typeof(type) !== 'string')
			continue;

		var isArray = type[0] === ']';
		if (isArray)
			type = type.substring(1, type.length - 1);

		var m = self.parent.get(type);
		m && dependencies.push({ name: name, isArray: isArray, schema: m });
	}

	return dependencies;
};

/**
 * Set schema validation
 * @param {String|Array} properties Properties to validate, optional.
 * @param {Function(propertyName, value, path, entityName, model)} fn A validation function.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setValidate = function(properties, fn) {
	var self = this;

	if (fn === undefined && properties instanceof Array) {
		self.properties = properties;
		return self;
	}

	if (typeof(properties) !== 'function') {
		self.properties = properties;
		self.onValidate = fn;
	} else
		self.onValidate = properties;

	return self;
};

SchemaBuilderEntity.prototype.setPrefix = function(prefix) {
	this.resourcePrefix = prefix;
	return this;
};

SchemaBuilderEntity.prototype.setResource = function(name) {
	this.resourceName = name;
	return this;
};

/**
 * Set the default values for schema
 * @param {Function(propertyName, isntPreparing, entityName)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setDefault = function(fn) {
	var self = this;
	self.onDefault = fn;
	return self;
};

/**
 * Set the prepare
 * @param {Function(name, value)} fn Must return a new value.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setPrepare = function(fn) {
	var self = this;
	self.onPrepare = fn;
	return self;
};

/**
 * Set save handler
 * @param {Function(error, model, helper, next(value), controller)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setSave = function(fn, description) {
	var self = this;
	self.onSave = fn;
	self.meta.save = description;
	return self;
};


/**
 * Set error handler
 * @param {Function(error)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setError = function(fn) {
	var self = this;
	self.onError = fn;
	return self;
};

/**
 * Set getter handler
 * @param {Function(error, model, helper, next(value), controller)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setGet = SchemaBuilderEntity.prototype.setRead = function(fn, description) {
	var self = this;
	self.onGet = fn;
	self.meta.get = description;
	return self;
};

/**
 * Set query handler
 * @param {Function(error, helper, next(value), controller)} fn
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setQuery = function(fn, description) {
	var self = this;
	self.onQuery = fn;
	self.meta.query = description;
	return self;
};

/**
 * Set remove handler
 * @param {Function(error, helper, next(value), controller)} fn
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setRemove = function(fn, description) {
	var self = this;
	self.onRemove = fn;
	self.meta.remove = description;
	return self;
};

/**
 * Add a new constant for the schema
 * @param {String} name Constant name, optional.
 * @param {Object} value
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.constant = function(name, value, description) {
	var self = this;

	if (value === undefined)
		return self.constants ? self.constants[name] : undefined;

	if (!self.constants)
		self.constants = {};

	self.constants[name] = value;
	self.meta['constant#' + name] = description;
	return self;
};

/**
 * Add a new transformation for the entity
 * @param {String} name Transform name, optional.
 * @param {Function(errorBuilder, model, helper, next([output]), controller)} fn
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.addTransform = function(name, fn, description) {
	var self = this;

	if (typeof(name) === 'function') {
		fn = name;
		name = 'default';
	}

	if (!self.transforms)
		self.transforms = {};

	self.transforms[name] = fn;
	self.meta['transform#' + name] = description;
	return self;
};

/**
 * Add a new operation for the entity
 * @param {String} name Operation name, optional.
 * @param {Function(errorBuilder, [model], helper, next([output]), controller)} fn
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.addOperation = function(name, fn, description) {
	var self = this;

	if (typeof(name) === 'function') {
		fn = name;
		name = 'default';
	}

	if (!self.operations)
		self.operations = {};

	self.operations[name] = fn;
	self.meta['operation#' + name] = description;
	return self;
};

/**
 * Add a new workflow for the entity
 * @param {String} name Workflow name, optional.
 * @param {Function(errorBuilder, model, helper, next([output]), controller)} fn
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.addWorkflow = function(name, fn, description) {
	var self = this;

	if (typeof(name) === 'function') {
		fn = name;
		name = 'default';
	}

	if (!self.workflows)
		self.workflows = {};

	self.workflows[name] = fn;
	self.meta['workflow#' + name] = description;
	return self;
};

SchemaBuilderEntity.prototype.addHook = function(name, fn, description) {

	var self = this;

	if (!self.hooks)
		self.hooks = {};

	if (!self.hooks[name])
		self.hooks[name] = [];

	self.hooks[name].push({ owner: framework.$owner(), fn: fn });
	self.meta['hook#' + name] = description;
	return self;
};

/**
 * Find an entity in current group
 * @param {String} name
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.find = function(name) {
	return this.parent.get(name);
};

/**
 * Destroy current entity
 */
SchemaBuilderEntity.prototype.destroy = function() {
	var self = this;
	delete self.parent.collection[self.name];
	self.properties = null;
	self.schema = null;
	self.onDefault = null;
	self.onValidate = null;
	self.onSave = null;
	self.onRead = null;
	self.onRemove = null;
	self.onQuery = null;
	self.workflows = null;
	self.transforms = null;
};

/**
 * Execute onSave delegate
 * @param {Object} model
 * @param {Object} helper A helper object, optional.
 * @param {Function(err, result)} callback
 * @param {Controller} controller
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.save = function(model, helper, callback, controller, skip) {

	if (typeof(callback) === 'boolean') {
		skip = callback;
		callback = helper;
		helper = undefined;
	} else if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	if (typeof(controller) === 'boolean') {
		var tmp = skip;
		skip = controller;
		controller = tmp;
	}

	if (typeof(callback) !== 'function')
		callback = function(){};

	var self = this;
	var $type = 'save';

	self.$prepare(model, function(err, model) {

		if (err) {
			callback(err, model);
			return;
		}

		var builder = new ErrorBuilder();
		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);
		if (!isGenerator(self, $type, self.onSave)) {
			self.onSave(builder, model, helper, function(result) {
				self.$process(arguments, model, $type, undefined, builder, result, callback);
			}, controller, skip !== true);
			return self;
		}

		callback.success = false;
		async.call(self, self.onSave)(function(err) {
			if (!err || callback.success)
				return;
			callback.success = true;
			builder.push(err);
			self.onError && self.onError(builder, model, $type);
			callback(builder);
		}, builder, model, helper, function(result) {

			if (callback.success)
				return;

			if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
				if ((result instanceof Error || result instanceof ErrorBuilder) && builder !== result)
					builder.push(result);
				result = arguments[1];
			}

			var has = builder.hasError();
			has && self.onError && self.onError(builder, model, $type);
			callback.success = true;
			callback(has ? builder : null, result === undefined ? model : result);
		}, controller, skip !== true);

	});

	return self;
};

function isGenerator(obj, name, fn) {
	if (obj.gcache[name])
		return obj.gcache[name];
	return obj.gcache[name] = fn.toString().substring(0, 9) === 'function*';
}

/**
 * Execute onGet delegate
 * @param {Object} helper A helper object, optional.
 * @param {Function(err, result)} callback
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.get = SchemaBuilderEntity.prototype.read = function(helper, callback, controller) {

	if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== 'function')
		callback = function(){};

	var self = this;
	var builder = new ErrorBuilder();

	self.resourceName && builder.setResource(self.resourceName);
	self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

	var output = self.default();
	var $type = 'get';

	if (!isGenerator(self, $type, self.onGet)) {
		self.onGet(builder, output, helper, function(result) {
			self.$process(arguments, output, $type, undefined, builder, result, callback);
		}, controller);
		return self;
	}

	callback.success = false;
	async.call(self, self.onGet)(function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;
		builder.push(err);
		self.onError && self.onError(builder, model, $type);
		callback(builder);
	}, builder, output, helper, function(result) {

		if (callback.success)
			return;

		if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
			if ((result instanceof Error || result instanceof ErrorBuilder) && builder !== result)
				builder.push(result);
			result = arguments[1];
		}

		callback.success = true;
		var has = builder.hasError();
		has && self.onError && self.onError(builder, model, $type);
		callback(has ? builder : null, result === undefined ? output : result);
	}, controller);

	return self;
};

/**
 * Execute onRemove delegate
 * @param {Object} helper A helper object, optional.
 * @param {Function(err, result)} callback
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.remove = function(helper, callback, controller) {

	if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	var self = this;
	var builder = new ErrorBuilder();
	var $type = 'remove';

	self.resourceName && builder.setResource(self.resourceName);
	self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

	if (!isGenerator(self, $type, self.onRemove)) {
		self.onRemove(builder, helper, function(result) {
			self.$process(arguments, undefined, $type, undefined, builder, result, callback);
		}, controller);
		return self;
	}

	callback.success = false;
	async.call(self, self.onRemove)(function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;
		builder.push(err);
		self.onError && self.onError(builder, model, $type);
		callback(builder);
	}, builder, helper, function(result) {

		if (callback.success)
			return;

		if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
			if ((result instanceof Error || result instanceof ErrorBuilder) && builder !== result)
				builder.push(result);
			result = arguments[1];
		}

		var has = builder.hasError();
		has && self.onError && self.onError(builder, model, $type);
		callback.success = true;
		callback(has ? builder : null, result === undefined ? helper : result);
	}, controller);

	return self;
};

/**
 * Execute onQuery delegate
 * @param {Object} helper A helper object, optional.
 * @param {Function(err, result)} callback
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.query = function(helper, callback, controller) {

	if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	var self = this;
	var builder = new ErrorBuilder();
	var $type = 'query';

	self.resourceName && builder.setResource(self.resourceName);
	self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

	if (!isGenerator(self, $type, self.onQuery)) {
		self.onQuery(builder, helper, function(result) {
			self.$process(arguments, undefined, $type, undefined, builder, result, callback);
		}, controller);
		return self;
	}

	callback.success = false;

	async.call(self, self.onQuery)(function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;
		builder.push(err);
		self.onError && self.onError(builder, model, $type);
		callback(builder);
	}, builder, helper, function(result) {

		if (callback.success)
			return;

		if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
			if ((result instanceof Error || result instanceof ErrorBuilder) && builder !== result)
				builder.push(result);
			result = arguments[1];
		}

		var has = builder.hasError();
		has && self.onError && self.onError(builder, model, $type);
		callback.success = true;
		callback(builder.hasError() ? builder : null, result);
	}, controller);

	return self;
};

/**
 * Validate a schema
 * @param {Object} model Object to validate.
 * @param {String} resourcePrefix Prefix for resource key.
 * @param {String} resourceName Resource filename.
 * @param {ErrorBuilder} builder ErrorBuilder, INTERNAL.
 * @return {ErrorBuilder}
 */
SchemaBuilderEntity.prototype.validate = function(model, resourcePrefix, resourceName, builder, filter, path, index) {

	var self = this;
	var fn = self.onValidate;

	if (builder === undefined) {
		builder = new ErrorBuilder();
		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);
	}

	if (self.resourcePrefix)
		builder.resourcePrefix = self.resourcePrefix;

	if (self.resourceName)
		builder.resourceName = self.resourceName;

	if (resourceName)
		builder.resourceName = resourceName;

	if (resourcePrefix)
		builder.resourcePrefix = resourcePrefix;

	if (filter)
		filter = self.filter(filter);

	if (path)
		path += '.';
	else
		path = '';

	framework_utils.validate_builder.call(self, model, builder, self.name, self.parent.collection, self.name, index, filter, path);

	if (!self.dependencies)
		return builder;

	for (var i = 0, length = self.dependencies.length; i < length; i++) {
		var key = self.dependencies[i];
		var schema = self.schema[key];
		var s = self.parent.collection[schema.raw];

		if (!s) {
			framework.error(new Error('Schema "' + schema.raw + '" not found (validation).'));
			continue;
		}

		if (!schema.isArray) {
			(model[key] != null || schema.required) && s.validate(model[key], resourcePrefix, resourceName, builder, filter, path + key, j);
			continue;
		}

		var arr = model[key];
		for (var j = 0, jl = arr.length; j < jl; j++)
			(model[key][j] != null || schema.required) && s.validate(model[key][j], resourcePrefix, resourceName, builder, filter, path + key + '[' + j + ']', j);
	}

	return builder;
};

/**
 * Create a default object according the schema
 * @alias SchemaBuilderEntity.default()
 * @return {Object}
 */
SchemaBuilderEntity.prototype.create = function() {
	return this.default();
};

SchemaBuilderEntity.prototype.Create = function() {
	return this.default();
};

/**
 * Makes extensible object
 * @param {Object} obj
 * @return {Object}
 */
SchemaBuilderEntity.prototype.$make = function(obj) {
	return obj; // TODO remove
};

SchemaBuilderEntity.prototype.$prepare = function(obj, callback) {
	var self = this;
	if (obj && typeof(obj.$save) === 'function')
		callback(null, obj);
	else
		self.make(obj, (err, model) => callback(err, model));
	return self;
};

/**
 * Create a default object according the schema
 * @return {SchemaInstance}
 */
SchemaBuilderEntity.prototype.default = function() {

	var self = this;
	var obj = self.schema;

	if (obj === null)
		return null;

	var defaults = self.onDefault;
	var item = new self.CurrentSchemaInstance();

	for (var property in obj) {

		var type = obj[property];

		if (defaults) {
			var def = defaults(property, true, self.name);
			if (def !== undefined) {
				item[property] = def;
				continue;
			}
		}

		switch (type.type) {
			// undefined
			// object
			case 0:
			case 6:
				item[property] = type.isArray ? [] : null;
				break;
			// numbers: integer, float
			case 1:
			case 2:
				item[property] = type.isArray ? [] : 0;
				break;
			// string
			case 3:
				item[property] = type.isArray ? [] : '';
				break;
			// boolean
			case 4:
				item[property] = type.isArray ? [] : false;
				break;
			// date
			case 5:
				item[property] = type.isArray ? [] : F.datetime;
				break;
			// schema
			case 7:

				if (type.isArray) {
					item[property] = [];
				} else {
					var tmp = self.find(type.raw);
					if (!tmp) {
						framework.error(new Error('Schema: "' + property + '.' + type.raw + '" not found in "' + self.parent.name + '".'));
						item[property] = null;
					} else
						item[property] = tmp.default();
				}
				break;
			// enum + keyvalue
			case 8:
			case 9:
				item[property] = undefined;
				break;
		}
	}

	return item;
};

/**
 * Create schema instance
 * @param {function|object} model
 * @param [filter]
 * @param [callback]
 * @returns {SchemaInstance}
 */
SchemaBuilderEntity.prototype.make = function(model, filter, callback) {

	var self = this;

	if (typeof(model) === 'function') {
		model.call(self, self);
		return self;
	}

	if (typeof(filter) === 'function') {
		var tmp = callback;
		callback = filter;
		filter = tmp;
	}

	var output = self.prepare(model);
	var builder = self.validate(output, undefined, undefined, undefined, filter);
	if (builder.hasError()) {
		self.onError && self.onError(builder, model, 'make');
		callback && callback(builder, null);
		return output;
	}

	callback && callback(null, output);
	return output;
};

SchemaBuilderEntity.prototype.load = SchemaBuilderEntity.prototype.make; // Because JSDoc is not works with double asserting

function autotrim(context, value) {
	return context.trim ? value.trim() : value;
}

SchemaBuilderEntity.prototype.$onprepare = function(name, value, index, model) {
	if (!this.onPrepare)
		return value;
	var val = this.onPrepare(name, value, index, model);
	return val === undefined ? value : val;
};

/**
 * Prepare model according to schema
 * @param {Object} model
 * @param {String|Array} [dependencies] INTERNAL.
 * @return {SchemaInstance}
 */
SchemaBuilderEntity.prototype.prepare = function(model, dependencies) {

	var self = this;
	var obj = self.schema;

	if (obj === null)
		return null;

	if (model == null)
		return self.default();

	var tmp;
	var entity;
	var item = new self.CurrentSchemaInstance();
	var defaults = self.onDefault;

	for (var property in obj) {

		var val = model[property];

		// IS PROTOTYPE? The problem was in e.g. "search" property, because search is in String prototypes.
		if (!hasOwnProperty.call(model, property))
			val = undefined;

		if (val === undefined && defaults)
			val = defaults(property, false, self.name);

		if (val === undefined)
			val = '';

		var type = obj[property];
		var typeval = typeof(val);

		if (typeval === 'function')
			val = val();

		if (!type.isArray) {
			switch (type.type) {
				// undefined
				case 0:
					break;
				// number: integer
				case 1:
					item[property] = self.$onprepare(property, framework_utils.parseInt(val), undefined, model);
					break;
				// number: float
				case 2:
					item[property] = self.$onprepare(property, framework_utils.parseFloat(val), undefined, model);
					break;

				// string
				case 3:
					tmp = val == null ? '' : autotrim(self, val.toString());
					if (type.length && type.length < tmp.length)
						tmp = tmp.substring(0, type.length);

					switch (type.subtype) {
						case 'uid':
							if (tmp && !type.required && !tmp.isUID())
								tmp = '';
							break;
						case 'email':
							tmp = tmp.toLowerCase().replace(REGEXP_CLEAN_EMAIL, '');
							if (tmp && !type.required && !tmp.isEmail())
								tmp = '';
							break;
						case 'url':
							if (tmp && !type.required && !tmp.isURL())
								tmp = '';
							break;
						case 'zip':
							if (tmp && !type.required && !tmp.isZIP())
								tmp = '';
							break;
						case 'phone':
							tmp = tmp.replace(REGEXP_CLEAN_PHONE, '');
							if (tmp && !type.required && !tmp.isPhone())
								tmp = '';
							break;
						case 'capitalize':
							tmp = tmp.capitalize();
							break;
						case 'lowercase':
							tmp = tmp.toLowerCase();
							break;
						case 'uppercase':
							tmp = tmp.toUpperCase();
							break;
						case 'json':
							if (tmp && !type.required && !tmp.isJSON())
								tmp = '';
							break;
					}

					item[property] = self.$onprepare(property, tmp, undefined, model);
					break;

				// boolean
				case 4:
					tmp = val ? val.toString().toLowerCase() : null;
					item[property] = self.$onprepare(property, tmp === 'true' || tmp === '1' || tmp === 'on', undefined, model);
					break;

				// date
				case 5:

					tmp = null;

					if (typeval === 'string') {
						if (val)
							tmp = val.trim().parseDate();
					} else if (typeval === 'number')
						tmp = new Date(val);
					else
						tmp = val;

					if (framework_utils.isDate(tmp))
						tmp = self.$onprepare(property, tmp, undefined, model)
					else
						tmp = (defaults ? isUndefined(defaults(property, false, self.name), null) : null);

					item[property] = tmp;
					break;

				// object
				case 6:
					item[property] = self.$onprepare(property, model[property], undefined, model);
					break;

				// enum
				case 8:
					tmp = self.$onprepare(property, model[property], undefined, model);
					if (type.subtype === 'number' && typeof(tmp) === 'string')
						tmp = tmp.parseFloat(null);
					item[property] = tmp != null && type.raw.indexOf(tmp) !== -1 ? tmp : undefined;
					break;

				// keyvalue
				case 9:
					tmp = self.$onprepare(property, model[property], undefined, model);
					item[property] = tmp != null ? type.raw[tmp] : undefined;
					break;

				// schema
				case 7:

					if (!val) {
						val = (defaults ? isUndefined(defaults(property, false, self.name), null) : null);
						// val = defaults(property, false, self.name);
						if (val === null) {
							item[property] = null;
							break;
						}
					}

					if (val && typeof(val.$schema) === 'function') {
						tmp = val.$schema();
						if (tmp && tmp.name && tmp.name === type.raw) {
							item[property] = val;
							break;
						}
					}

					entity = self.parent.get(type.raw);
					if (entity) {
						item[property] = entity.prepare(val, undefined);
						dependencies && dependencies.push({ name: type.raw, value: self.$onprepare(property, item[property], undefined, model) });
					} else
						item[property] = null;
					break;
			}
			continue;
		}

		// ARRAY:
		if (!(val instanceof Array)) {
			item[property] = (defaults ? isUndefined(defaults(property, false, self.name), []) : []);
			continue;
		}

		item[property] = [];
		for (var j = 0, sublength = val.length; j < sublength; j++) {

			// tmp = model[property][j];
			tmp = val[j];
			typeval = typeof(tmp);

			switch (type.type) {
				case 0:
					tmp = self.$onprepare(property, tmp, j, model);
					break;

				case 1:
					tmp = self.$onprepare(property, framework_utils.parseInt(tmp), j, model);
					break;

				case 2:
					tmp = self.$onprepare(property, framework_utils.parseFloat(tmp), j, model);
					break;

				case 3:
					tmp = tmp == null ? '' : autotrim(self, tmp.toString());
					if (type.length && tmp.length < tmp.length)
						tmp = tmp.substring(0, type.length);

					switch (type.subtype) {
						case 'uid':
							if (tmp && !type.required && !tmp.isUID())
								continue;
							break;
						case 'url':
							if (tmp && !type.required && !tmp.isURL())
								continue;
							break;
						case 'email':
							tmp = tmp.toLowerCase().replace(REGEXP_CLEAN_EMAIL, '');
							if (tmp && !type.required && !tmp.isEmail())
								continue;
							break;
						case 'phone':
							tmp = tmp.replace(REGEXP_CLEAN_PHONE, '');
							if (tmp && !type.required && !tmp.isPhone())
								continue;
							break;
						case 'capitalize':
							tmp = tmp.capitalize();
							break;
						case 'lowercase':
							tmp = tmp.toLowerCase();
							break;
						case 'uppercase':
							tmp = tmp.toUpperCase();
							break;
						case 'json':
							if (tmp && !type.required && !tmp.isJSON())
								continue;
							break;
					}

					tmp = self.$onprepare(property, tmp, j, model);
					break;

				case 4:
					if (tmp)
						tmp = tmp.toString().toLowerCase();
					tmp = self.$onprepare(property, tmp === 'true' || tmp === '1' || tmp === 'on', j, model);
					break;

				case 5:

					if (typeval === 'string') {
						if (tmp)
							tmp = tmp.trim().parseDate();
					} else if (typeval === 'number')
						tmp = new Date(tmp);

					if (framework_utils.isDate(tmp))
						tmp = self.$onprepare(property, tmp, j, model);
					else
						tmp = undefined;

					break;

				case 6:
					tmp = self.$onprepare(property, tmp, j, model);
					break;

				case 7:
					entity = self.parent.get(type.raw);
					if (entity) {
						tmp = entity.prepare(tmp, dependencies);
						if (dependencies)
							dependencies.push({ name: type.raw, value: self.$onprepare(property, tmp, j, model) });
					} else
						tmp = null;

					tmp = self.$onprepare(property, tmp, j, model);
					break;
			}

			if (tmp === undefined)
				continue;

			item[property].push(tmp);
		}
	}

	if (self.fields_allow) {
		for (var i = 0, length = self.fields_allow.length; i < length; i++) {
			var name = self.fields_allow[i];
			var val = model[name];
			if (val !== undefined)
				item[name] = val;
		}
	}

	return item;
};

/**
 * Transform an object
 * @param {String} name
 * @param {Object} model
 * @param {Object} helper A helper object, optional.
 * @param {Function(errorBuilder, output, model)} callback
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.transform = function(name, model, helper, callback, skip, controller) {

	var self = this;

	if (typeof(name) !== 'string') {
		callback = helper;
		helper = model;
		model = name;
		name = 'default';
	}

	if (typeof(callback) === 'boolean') {
		skip = callback;
		callback = helper;
		helper = undefined;
	} else if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== 'function')
		callback = function(){};

	var trans = self.transforms ? self.transforms[name] : undefined;

	if (!trans) {
		callback(new ErrorBuilder().push('', 'Transform "{0}" not found.'.format(name)));
		return self;
	}

	var $type = 'transform';

	if (skip === true) {
		var builder = new ErrorBuilder();
		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);
		trans.call(self, builder, model, helper, function(result) {
			self.$process(arguments, model, $type, name, builder, result, callback);
		}, controller, skip !== true);
		return self;
	}

	self.$prepare(model, function(err, model) {

		if (err) {
			callback(err, model);
			return;
		}

		var builder = new ErrorBuilder();

		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

		if (!isGenerator(self, 'transform.' + name, trans)) {
			trans.call(self, builder, model, helper, function(result) {
				self.$process(arguments, model, $type, name, builder, result, callback);
			}, controller);
			return;
		}

		callback.success = false;
		async.call(self, trans)(function(err) {
			if (!err || callback.success)
				return;
			callback.success = true;
			builder.push(err);
			self.onError && self.onError(builder, model, $type, name);
			callback(builder);
		}, builder, model, helper, function(result) {

			if (callback.success)
				return;

			if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
				if ((result instanceof Error || result instanceof ErrorBuilder) && builder !== result)
					builder.push(result);
				result = arguments[1];
			}

			var has = builder.hasError();
			has && self.onError && self.onError(builder, model, $type, name);
			callback.success = true;
			callback(has ? builder : null, result === undefined ? model : result);
		}, controller, skip !== true);

	});

	return self;
};

SchemaBuilderEntity.prototype.transform2 = function(name, helper, callback, controller) {

	if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	if (!callback)
		callback = function(){};

	return this.transform(name, this.create(), helper, callback, true, controller);
};

SchemaBuilderEntity.prototype.$process = function(arg, model, type, name, builder, result, callback) {

	var self = this;

	if (arg.length > 1 || (result instanceof Error || result instanceof ErrorBuilder)) {
		if ((result instanceof Error || result instanceof ErrorBuilder || typeof(result) === 'string') && builder !== result)
			builder.push(result);
		result = arg[1];
	}

	var has = builder.hasError();
	has && self.onError && self.onError(builder, model, type, name);
	callback(has ? builder : null, result === undefined ? model : result, model);
	return self;
};

SchemaBuilderEntity.prototype.$process_hook = function(model, type, name, builder, result, callback) {
	var self = this;
	var has = builder.hasError();
	has && self.onError && self.onError(builder, model, type, name);
	callback(has ? builder : null, model);
	return self;
};

/**
 * Run a workflow
 * @param {String} name
 * @param {Object} model
 * @param {Object} helper A helper object, optional.
 * @param {Function(errorBuilder, output, model)} callback
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.workflow = function(name, model, helper, callback, skip, controller) {

	var self = this;

	if (typeof(name) !== 'string') {
		callback = helper;
		helper = model;
		model = name;
		name = 'default';
	}

	if (typeof(callback) === 'boolean') {
		skip = callback;
		callback = helper;
		helper = undefined;
	} else if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== 'function')
		callback = function(){};

	var workflow = self.workflows ? self.workflows[name] : undefined;
	if (!workflow) {
		callback(new ErrorBuilder().push('', 'Workflow "{0}" not found.'.format(name)));
		return self;
	}

	var $type = 'workflow';

	if (skip === true) {
		var builder = new ErrorBuilder();
		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);
		workflow.call(self, builder, model, helper, function(result) {
			self.$process(arguments, model, $type, name, builder, result, callback);
		}, controller, skip !== true);
		return self;
	}

	self.$prepare(model, function(err, model) {

		if (err) {
			callback(err, model);
			return;
		}

		var builder = new ErrorBuilder();

		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

		if (!isGenerator(self, 'workflow.' + name, workflow)) {
			workflow.call(self, builder, model, helper, function(result) {
				self.$process(arguments, model, $type, name, builder, result, callback);
			}, controller, skip !== true);
			return;
		}

		callback.success = false;
		async.call(self, workflow)(function(err) {
			if (!err || callback.success)
				return;
			callback.success = true;
			builder.push(err);
			self.onError && self.onError(builder, model, $type, name);
			callback(builder);
		}, builder, model, helper, function(result) {

			if (callback.success)
				return;

			if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
				if ((result instanceof Error || result instanceof ErrorBuilder) && builder !== result)
					builder.push(result);
				result = arguments[1];
			}

			var has = builder.hasError();
			has && self.onError && self.onError(builder, model, $type, name);
			callback.success = true;
			callback(has ? builder : null, result === undefined ? model : result);
		}, controller, skip !== true);
	});

	return self;
};

SchemaBuilderEntity.prototype.workflow2 = function(name, helper, callback, controller) {

	if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	if (!callback)
		callback = function(){};

	return this.workflow(name, this.create(), helper, callback, true, controller);
};

/**
 * Run hooks
 * @param {String} name
 * @param {Object} model
 * @param {Object} helper A helper object, optional.
 * @param {Function(errorBuilder, output, model)} callback
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.hook = function(name, model, helper, callback, skip, controller) {

	var self = this;

	if (typeof(name) !== 'string') {
		callback = helper;
		helper = model;
		model = name;
		name = 'default';
	}

	if (typeof(callback) === 'boolean') {
		skip = callback;
		callback = helper;
		helper = undefined;
	} else if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== 'function')
		callback = function(){};

	var hook = self.hooks ? self.hooks[name] : undefined;

	if (!hook || !hook.length) {
		callback(null, model);
		return self;
	}

	var $type = 'hook';

	if (skip === true) {
		var builder = new ErrorBuilder();

		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

		var output = [];

		async_wait(hook, function(item, next) {
			item.fn.call(self, builder, model, helper, function(result) {
				output.push(result == undefined ? model : result);
				next();
			}, controller, skip !== true);
		}, function() {
			self.$process_hook(model, $type, name, builder, output, callback);
		}, 0);

		return self;
	}

	self.$prepare(model, function(err, model) {

		if (err) {
			callback(err, model);
			return;
		}

		var builder = new ErrorBuilder();
		var output = [];

		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

		async_wait(hook, function(item, next, index) {

			if (!isGenerator(self, 'hook.' + name + '.' + index, item.fn)) {
				item.fn.call(self, builder, model, helper, function(result) {
					output.push(result == undefined ? model : result);
					next();
				}, controller, skip !== true);
				return;
			}

			callback.success = false;

			async.call(self, item.fn)(function(err) {
				if (!err)
					return;
				builder.push(err);
				next();
			}, builder, model, helper, function(result) {
				output.push(result == undefined ? model : result);
				next();
			}, controller, skip !== true);

		}, function() {
			self.$process_hook(model, $type, name, builder, output, callback);
		}, 0);
	});

	return self;
};

SchemaBuilderEntity.prototype.hook2 = function(name, helper, callback, controller) {

	if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	if (!callback)
		callback = function(){};

	return this.hook(name, this.create(), helper, callback, true, controller);
};

/**
 * Run an operation
 * @param {String} name
 * @param {Object} model A model object, optional, priority: 2.
 * @param {Object} helper A helper object, optional, priority: 1.
 * @param {Function(errorBuilder, output)} callback
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.operation = function(name, model, helper, callback, skip, controller) {

	var self = this;

	var th = typeof(helper);
	var tc = typeof(callback);

	if (tc === 'undefined') {
		if (th === 'function') {
			callback = helper;
			helper = model;
			model = undefined;
		} else if (th === 'undefined') {
			helper = model;
			model = undefined;
		}
	} else if (th === 'undefined') {
		helper = model;
		model = undefined;
	} else if (tc === 'boolean') {
		skip = callback;
		callback = helper;
		helper = undefined;
	}

	if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== 'function')
		callback = function(){};

	var operation = self.operations ? self.operations[name] : undefined;

	if (!operation) {
		callback(new ErrorBuilder().push('', 'Operation "{0}" not found.'.format(name)));
		return self;
	}

	var builder = new ErrorBuilder();
	var $type = 'operation';

	self.resourceName && builder.setResource(self.resourceName);
	self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

	if (!isGenerator(self, 'operation.' + name, operation)) {
		operation.call(self, builder, model, helper, function(result) {
			self.$process(arguments, model, $type, name, builder, result, callback);
		}, controller, skip !== true);
		return self;
	}

	callback.success = false;
	async.call(self, operation)(function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;
		builder.push(err);
		self.onError && self.onError(builder, model, $type, name);
		callback(builder);
	}, builder, model, helper, function(result) {

		if (callback.success)
			return;

		if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
			if ((result instanceof Error || result instanceof ErrorBuilder) && builder !== result)
				builder.push(result);
			result = arguments[1];
		}

		var has = builder.hasError();
		has && self.onError && self.onError(builder, model, $type, name);
		callback.success = true;
		callback(has ? builder : null, result);
	}, controller, skip !== true);

	return self;
};

SchemaBuilderEntity.prototype.operation2 = function(name, helper, callback, controller) {

	if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	if (!callback)
		callback = function(){};

	return this.operation(name, this.create(), helper, callback, true, controller);
};

/**
 * Clean model (remove state of all schemas in model).
 * @param {Object} m Model.
 * @param {Boolean} isCopied Internal argument.
 * @return {Object}
 */
SchemaBuilderEntity.prototype.clean = function(m) {
	return clone(m);
};

// For async operations, because SUCCESS() returns singleton instance everytime
function copy(obj) {
	return framework.isSuccess(obj) ? { success: obj.success, value: obj.value } : obj;
}

function clone(obj) {

	if (!obj)
		return obj;

	var type = typeof(obj);
	if (type !== 'object' || obj instanceof Date)
		return obj;

	var length;
	var o;

	if (obj instanceof Array) {

		length = obj.length;
		o = new Array(length);

		for (var i = 0; i < length; i++) {
			type = typeof(obj[i]);
			if (type !== 'object' || obj[i] instanceof Date) {
				if (type !== 'function')
					o[i] = obj[i];
				continue;
			}
			o[i] = clone(obj[i]);
		}

		return o;
	}

	o = {};

	for (var m in obj) {

		if (SKIP[m])
			continue;

		var val = obj[m];

		if (val instanceof SchemaInstance) {
			o[m] = clone(val);
			continue;
		}

		var type = typeof(val);
		if (type !== 'object' || val instanceof Date) {
			if (type !== 'function')
				o[m] = val;
			continue;
		}

		o[m] = clone(obj[m]);
	}

	return o;
}

/**
 * Returns prototype of instances
 * @returns {Object}
 */
SchemaBuilderEntity.prototype.instancePrototype = function() {
	return this.CurrentSchemaInstance.prototype;
};

/**
 * SchemaInstance
 * @constructor
 */
function SchemaInstance() {
}

/**
 * @type {SchemaBuilderEntity}
 */
SchemaInstance.prototype.$$schema = null;

SchemaInstance.prototype.$async = function(callback, index) {
	var self = this;

	if (!callback)
		callback = function(){};

	self.$$async = [];
	self.$$result = [];
	self.$$index = index;
	self.$$callback = callback;
	self.$$can = true;

	setImmediate(function() {
		self.$$can = false;
		async_queue(self.$$async, function() {
			self.$$callback(null, self.$$index !== undefined ? self.$$result[self.$$index] : self.$$result);
			self.$$callback = null;
		});
	});

	return self;
};

SchemaInstance.prototype.$repository = function(name, value) {

	var self = this;

	if (self.$$repository === undefined) {
		if (value === undefined)
			return undefined;
		self.$$repository = {};
	}

	if (value !== undefined) {
		self.$$repository[name] = value;
		return value;
	}

	return self.$$repository[name];
};

SchemaInstance.prototype.$index = function(index) {
	if (typeof(index) === 'string')
		this.$$index = (this.$$index || 0).add(index);
	this.$$index = index;
	return this;
};

SchemaInstance.prototype.$callback = function(callback) {
	this.$$callback = callback;
	return this;
};

SchemaInstance.prototype.$output = function() {
	this.$$index = this.$$result.length;
	return this;
};

SchemaInstance.prototype.$push = function(type, name, helper, first) {

	var self = this;
	var fn;

	if (type === 'save' || type === 'remove') {

		helper = name;
		name = undefined;

		fn = function(next) {
			self.$$schema[type](self, helper, function(err, result) {
				self.$$result && self.$$result.push(err ? null : copy(result));
				if (!err)
					return next();
				next = null;
				self.$$async = null;
				self.$$callback(err, self.$$result);
				self.$$callback = null;
			}, self.$$controller);
		};

	} else if (type === 'query' || type === 'get' || type === 'read') {

		helper = name;
		name = undefined;

		fn = function(next) {
			self.$$schema[type](helper, function(err, result) {
				self.$$result && self.$$result.push(err ? null : copy(result));
				if (!err)
					return next();
				next = null;
				self.$$async = null;
				self.$$callback(err, self.$$result);
				self.$$callback = null;
			}, self.$$controller);
		};

	} else {

		fn = function(next) {
			self.$$schema[type](name, self, helper, function(err, result) {
				self.$$result && self.$$result.push(err ? null : copy(result));
				if (!err)
					return next();
				next = null;
				self.$$async = null;
				self.$$callback(err, self.$$result);
				self.$$callback = null;
			}, self.$$controller);
		};

	}

	if (first)
		self.$$async.unshift(fn);
	else
		self.$$async.push(fn);

	return self;
};

SchemaInstance.prototype.$next = function(type, name, helper) {
	return this.$push(type, name, helper, true);
};

SchemaInstance.prototype.$exec = function(name, helper, callback) {
	var self = this;

	if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	var group = self.$$schema.parent.name;
	var key = group !== 'default' ? group + '/' + self.$$schema.name : self.$$schema.name;
	var workflow = framework.workflows[key + '#' + name] || framework.workflows[name];

	if (workflow)
		workflow(self, helper || EMPTYOBJECT, callback || NOOP);
	else
		callback && callback(new ErrorBuilder().push('Workflow "' + name + '" not found in workflows.'));

	return self;
};

SchemaInstance.prototype.$save = function(helper, callback) {
	var self = this;

	if (self.$$can && self.$$async)
		self.$push('save', helper);
	else
		self.$$schema.save(self, helper, callback, self.$$controller);

	return self;
};

SchemaInstance.prototype.$query = function(helper, callback) {
	var self = this;

	if (self.$$can && self.$$async)
		self.$push('query', helper);
	else
		self.$$schema.query(self, helper, callback, self.$$controller);

	return self;
};

SchemaInstance.prototype.$read = SchemaInstance.prototype.$get = function(helper, callback) {
	var self = this;

	if (self.$$can && self.$$async)
		self.$push('get', helper);
	else
		self.$$schema.get(self, helper, callback, self.$$controller);

	return self;
};

SchemaInstance.prototype.$remove = function(helper, callback) {
	var self = this;

	if (self.$$can && self.$$async)
		self.$push('remove', helper);
	else
		self.$$schema.remove(helper, callback, self.$$controller);

	return self;
};

SchemaInstance.prototype.$default = function() {
	return this.$$schema.default();
};

SchemaInstance.prototype.$destroy = function() {
	return this.$$schema.destroy();
};

SchemaInstance.prototype.$transform = function(name, helper, callback) {
	var self = this;

	if (self.$$can && self.$$async)
		self.$push('transform', name, helper);
	else
		self.$$schema.transform(name, self, helper, callback, undefined, self.$$controller);

	return self;
};

SchemaInstance.prototype.$workflow = function(name, helper, callback) {
	var self = this;

	if (self.$$can && self.$$async)
		self.$push('workflow', name, helper);
	else
		self.$$schema.workflow(name, self, helper, callback, undefined, self.$$controller);

	return self;
};

SchemaInstance.prototype.$hook = function(name, helper, callback) {
	var self = this;

	if (self.$$can && self.$$async)
		self.$push('hook', name, helper);
	else
		self.$$schema.hook(name, self, helper, callback, undefined, self.$$controller);

	return self;
};

SchemaInstance.prototype.$operation = function(name, helper, callback) {
	var self = this;

	if (self.$$can && self.$$async)
		self.$push('operation', name, helper);
	else
		self.$$schema.operation(name, self, helper, callback, undefined, self.$$controller);

	return self;
};

SchemaInstance.prototype.$clean = SchemaInstance.prototype.$plain = function() {
	return this.$$schema.clean(this);
};

SchemaInstance.prototype.$clone = function() {
	return framework_utils.extend(new this.$$schema.CurrentSchemaInstance(), this, true);
};

SchemaInstance.prototype.$prepare = function() {
	return this.$$schema.prepare(this);
};

SchemaInstance.prototype.$schema = function() {
	return this.$$schema;
};

SchemaInstance.prototype.$validate = function(resourcePrefix, resourceName, builder) {
	return this.$$schema.validate(this, resourcePrefix, resourceName, builder);
};

SchemaInstance.prototype.$constant = function(name) {
	return this.$$schema.constant(name);
};

/**
 * ErrorBuilder
 * @class
 * @classdesc Object validation.
 * @param {ErrorBuilderOnResource} onResource Resource handler.
 * @property {Number} count Count of errors.
 */
function ErrorBuilder(onResource) {

	this.items = [];
	this.transformName = transforms['error_default'];
	this.onResource = onResource;
	this.resourceName = framework.config['default-errorbuilder-resource-name'];
	this.resourcePrefix = framework.config['default-errorbuilder-resource-prefix'] || '';
	this.isResourceCustom = false;
	this.count = 0;
	this.replacer = [];
	this.isPrepared = false;
	this.contentType = 'application/json';

	// Hidden: when the .push() contains a classic Error instance
	// this.unexpected;

	if (!onResource)
		this._resource();
}

/**
 * @callback ErrorBuilderOnResource
 * @param {String} name Filename of resource.
 * @param {String} key Resource key.
 * @return {String}
 */

/**
 * UrlBuilder
 * @class
 * @classdesc CRUD parameters in URL.
 */
function UrlBuilder() {
	this.builder = {};
}

exports.isSchema = function(obj) {
	return obj instanceof SchemaInstance;
};

exports.eachschema = function(group, fn) {

	if (fn === undefined) {
		fn = group;
		group = undefined;
	}

	var groups = group ? [group] : Object.keys(schemas);
	for (var i = 0, length = groups.length; i < length; i++) {
		var schema = schemas[groups[i]];
		if (!schema)
			continue;
		var collection = Object.keys(schema.collection);
		for (var j = 0, jl = collection.length; j < jl; j++)
			fn(schema.name, schema.collection[collection[j]].name, schema.collection[collection[j]]);
	}
};

exports.getschema = function(group, name, fn, timeout) {

	if (!name || typeof(name) === 'function') {
		fn = name;
		name = group;
		group = DEFAULT_SCHEMA;
	}

	if (fn)
		return framework_utils.wait(n => schemas[group], err => fn(err, schemas[group]), timeout || 20000);

	var g = schemas[group];
	return g ? g.get(name) : undefined;
};

exports.newschema = function(group, name) {

	if (!group)
		group = DEFAULT_SCHEMA;

	if (schemas[group] === undefined)
		schemas[group] = new SchemaBuilder(group);

	var schema;

	if (name) {
		schema = schemas[group].get(name);
		if (!schema)
			schema = schemas[group].create(name);
	}

	return schema;
};

/**
 * Remove a schema
 * @param {String} name
 */
exports.remove = function(name) {
	delete schemas[name];
};

/**
 * Check if property value is joined to other class
 * @private
 * @param {String} value Property value from Schema definition.
 * @return {Boolean}
 */
exports.isJoin = function(collection, value) {
	if (!value)
		return false;
	if (value[0] === '[')
		return true;
	if (collection === undefined)
		return false;
	return collection[value] !== undefined;
};

/**
 * Create validation
 * @param {String} name Schema name.
 * @param {Function|Array} fn Validator Handler or Property names as array for validating.
 * @param {String|Array} properties Valid only these properties, optional.
 * @return {Function|Array}
 */
exports.validation = function(name, properties, fn) {

	if (schemas[DEFAULT_SCHEMA] === undefined)
		return EMPTYARRAY;

	var schema = schemas[DEFAULT_SCHEMA].get(name);
	if (schema === undefined)
		return EMPTYARRAY;

	if (fn instanceof Array && typeof(properties) === 'function') {
		var tmp = fn;
		fn = properties;
		properties = tmp;
	}

	if (typeof(fn) === 'function') {
		schema.onValidate = fn;
		if (properties)
			schema.properties = properties;
		else
			schema.properties = Object.keys(schema.schema);
		return true;
	}

	if (!fn) {
		var validator = schema.properties;
		if (validator === undefined)
			return Object.keys(schema.schema);
		return validator || [];
	}

	schema.onValidate = fn;
	return fn;
};

/**
 * Validate model
 * @param {String} name Schema name.
 * @param {Object} model Object for validating.
 * @return {ErrorBuilder}
 */
exports.validate = function(name, model, resourcePrefix, resourceName) {

	var schema = schemas[DEFAULT_SCHEMA];
	if (schema === undefined)
		return null;

	schema = schema.get(name);
	if (schema === undefined)
		return null;

	return schema.validate(model, resourcePrefix, resourceName);
};

/**
 * Create default object according to schema
 * @param  {String} name Schema name.
 * @return {Object}
 */
exports.create = function(name) {
	return exports.defaults(name);
};

/**
 * Create default object according to schema
 * @param  {String} name Schema name.
 * @return {Object}
 */
exports.defaults = function(name) {
	if (schemas[DEFAULT_SCHEMA] === undefined)
		return null;
	var schema = schemas[DEFAULT_SCHEMA].get(name);
	if (schema === undefined)
		return null;
	return schema.default();
};

/**
 * Prepare object according to schema
 * @param {String} name Schema name.
 * @param {Object} model Object to prepare.
 * @return {Object} Prepared object.
 */
exports.prepare = function(name, model) {
	if (schemas[DEFAULT_SCHEMA] === undefined)
		return null;
	var schema = schemas[DEFAULT_SCHEMA].get(name);
	if (schema === undefined)
		return null;
	return schema.prepare(model);
};

function isUndefined(value, def) {
	if (value === undefined)
		return def;
	return value;
}

// ======================================================
// PROTOTYPES
// ======================================================

ErrorBuilder.prototype = {

	get errors() {
		var self = this;
		!self.isPrepared && self.prepare();
		return self._transform();
	},

	get error() {
		var self = this;
		!self.isPrepared && self.prepare();
		return self._transform();
	}
};

/**
 * Resource setting
 * @param {String} name Resource name.
 * @param {String} prefix Resource prefix.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.resource = function(name, prefix) {
	var self = this;
	self.isResourceCustom = true;
	self.resourceName = name;
	self.resourcePrefix = prefix || '';
	return self._resource();
};

ErrorBuilder.prototype.setContentType = function(type) {
	this.contentType = type;
	return this;
};

ErrorBuilder.prototype.setResource = function(name) {
	var self = this;
	self.isResourceCustom = true;
	self.resourceName = name;
	return self._resource();
};

ErrorBuilder.prototype.setPrefix = function(name) {
	var self = this;
	self.resourcePrefix = name || '';
	return self._resource();
};

/**
 * Internal: Resource wrapper
 * @private
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype._resource = function() {
	var self = this;
	self.onResource = self._resource_handler;
	return self;
};

ErrorBuilder.prototype._resource_handler = function(name) {
	var self = this;
	return typeof(framework) !== 'undefined' ? framework.resource(self.resourceName || 'default', self.resourcePrefix + name) : '';
}

ErrorBuilder.prototype.exception = function(message) {
	this.items.push({ name: '', error: message });
	return this;
};

/**
 * Add an error
 * @param {String} name  Property name.
 * @param {String|Error} error Error message.
 * @param {String} path  Current path (in object).
 * @param {Number} index Array Index, optional.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.add = function(name, error, path, index) {
	return this.push(name, error, path, index);
};

/**
 * Add an error (@alias for add)
 * @param {String} name  Property name.
 * @param {String or Error} error Error message.
 * @param {String} path  Current path (in object).
 * @param {Number} index Array Index, optional.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.push = function(name, error, path, index) {
	var self = this;
	self.isPrepared = false;

	if (name instanceof ErrorBuilder) {
		if (name.hasError()) {
			for (var i = 0, length = name.items.length; i < length; i++)
				self.items.push(name.items[i]);
			self.count = self.items.length;
		}
		return self;
	}

	if (name instanceof Array) {
		for (var i = 0, length = name.length; i < length; i++)
			self.push(name[i], undefined, path, index);
		return self;
	}

	if (error instanceof Array) {
		for (var i = 0, length = error.length; i < length; i++)
			self.push(name, error[i], path, index);
		return self;
	}

	if (typeof(name) === 'object') {
		path = error;
		error = name;
		name = '';
	}

	if (!name && !error)
		return self;

	if (error === null)
		return self;

	if (!error)
		error = '@';

	if (error instanceof Error) {
		// Why? The answer is in controller.callback(); It's a reason for throwing 500 - internal server error
		self.unexpected = true;
		error = error.toString();
	}

	self.items.push({
		name: name,
		error: typeof(error) === 'string' ? error : error.toString(),
		path: path,
		index: index
	});

	self.count = self.items.length;
	return self;
};

/**
 * Remove error
 * @param {String} name Property name.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.remove = function(name) {
	var self = this;
	self.items = self.items.remove('name', name);
	self.count = self.items.length;
	return self;
};

/**
 * Has error?
 * @param {String}  name Property name (optional).
 * @return {Boolean}
 */
ErrorBuilder.prototype.hasError = function(name) {
	var self = this;
	return name ? self.items.findIndex('name', name) !== -1 : self.items.length > 0;
};

/**
 * Read an error
 * @param {String} name Property name.
 * @return {String}
 */
ErrorBuilder.prototype.read = function(name) {
	var self = this;
	!self.isPrepared && self.prepare();
	var error = self.items.findItem('name', name);
	return error ? error.error : null;
};

/**
 * Clear error collection
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.clear = function() {
	var self = this;
	self.items = [];
	self.count = 0;
	return self;
};

/**
 * Replace text in message
 * @param {String} search Text to search.
 * @param {String} newvalue Text to replace.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.replace = function(search, newvalue) {
	var self = this;
	self.isPrepared = false;
	self.replacer[search] = newvalue;
	return self;
};

/**
 * Serialize ErrorBuilder to JSON
 * @param {Boolean} beautify Beautify JSON.
 * @param {Function(key, value)} replacer JSON replacer.
 * @return {String}
 */
ErrorBuilder.prototype.json = function(beautify, replacer) {
	var items = this.prepare().items;
	return beautify ? JSON.stringify(items, replacer, '\t') : JSON.stringify(items, replacer);
};

ErrorBuilder.prototype.plain = function() {
	var items = this.prepare().items;
	var output = '';
	for (var i = 0, length = items.length; i < length; i++)
		output += (output ? ', ' : '') + items[i].error;
	return output;
};

/**
 * Serialize ErrorBuilder to JSON
 * @param {Boolean} beautify Beautify JSON.
 * @return {String}
 */
ErrorBuilder.prototype.JSON = function(beautify, replacer) {
	return this.json(beautify, replacer);
};

/**
 * Internal: Prepare error messages with onResource()
 * @private
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype._prepare = function() {

	var self = this;

	if (!self.onResource)
		return self;

	var errors = self.items;
	var length = errors.length;

	for (var i = 0; i < length; i++) {

		var o = errors[i];
		if (o.error[0] !== '@')
			continue;

		if (o.error.length === 1)
			o.error = self.onResource(o.name);
		else
			o.error = self.onResource(o.error.substring(1));

		if (!o.error)
			o.error = REQUIRED.replace('@', o.name);
	}

	return self;
};

/**
 * Execute a transform
 * @private
 * @return {Object}
 */
ErrorBuilder.prototype._transform = function(name) {

	var self = this;
	var transformName = name || self.transformName;

	if (!transformName)
		return self.items;

	var current = transforms['error'][transformName];
	if (!current)
		return self.items;

	return current.call(self);
};

ErrorBuilder.prototype.output = function() {
	var self = this;

	if (!this.transformName)
		return this.json();

	var current = transforms['error'][this.transformName];
	if (!current)
		return this.json();

	this.prepare();
	return current.call(this);
};

/**
 * To string
 * @return {String}
 */
ErrorBuilder.prototype.toString = function() {

	!this.isPrepared && this.prepare();

	var errors = this.items;
	var length = errors.length;
	var builder = [];

	for (var i = 0; i < length; i++)
		builder.push(errors[i].error || errors[i].name);

	return builder.join('\n');

};

/**
 * Set transformation for current ErrorBuilder
 * @param {String} name
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.setTransform = function(name) {
	this.transformName = name;
	return this;
};

/**
 * Transform
 * @param {String} name
 * @return {Object}
 */
ErrorBuilder.prototype.transform = function(name) {
	return this.prepare()._transform(name);
};

/**
 * Internal: Prepare error messages with onResource()
 * @private
 * @return {ErrorBuidler}
 */
ErrorBuilder.prototype._prepareReplace = function() {

	var self = this;
	var errors = self.items;
	var lengthBuilder = errors.length;
	var keys = Object.keys(self.replacer);
	var lengthKeys = keys.length;

	if (!lengthBuilder || !lengthKeys)
		return self;

	for (var i = 0; i < lengthBuilder; i++) {
		var o = errors[i];
		for (var j = 0; j < lengthKeys; j++) {
			var key = keys[j];
			o.error = o.error.replace(key, self.replacer[key]);
		}
	}

	return self;
};

/**
 * Internal: Prepare error messages with onResource()
 * @private
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.prepare = function() {
	if (this.isPrepared)
		return this;
	this._prepare()._prepareReplace();
	this.isPrepared = true;
	return this;
};

/**
 * STATIC: Create transformation
 * @param {String} name
 * @param {Function(ErrorBuilder)} fn
 * @param {Boolean} isDefault Default transformation for all error builders.
 */
ErrorBuilder.addTransform = function(name, fn, isDefault) {
	transforms['error'][name] = fn;
	isDefault && ErrorBuilder.setDefaultTransform(name);
};

/**
 * STATIC: Remove transformation
 * @param {String} name
 */
ErrorBuilder.removeTransform = function(name) {
	delete transforms['error'][name];
};

/**
 * STATIC: Create transformation
 * @param {String} name
 * @param {Function(errorBuilder)} fn
 */
ErrorBuilder.setDefaultTransform = function(name) {
	if (name)
		transforms['error_default'] = name;
	else
		delete transforms['error_default'];
};

/**
 * Pagination
 * @class
 * @param {Number} items Count of items.
 * @param {Number} page Current page.
 * @param {Number} max Max items on page.
 * @param {String} format URL format for links (next, back, go to). Example: ?page={0} --- {0} = page, {1} = items count, {2} = page count
 * @property {Number} isNext Is next page?
 * @property {Number} isPrev Is previous page?
 * @property {Number} count Page count.
 * @property {Boolean} visible Is more than one page?
 * @property {String} format Format URL. Example: ?page={0} --- {0} = page, {1} = items count, {2} = page count
 */
function Pagination(items, page, max, format) {
	this.isNext = false;
	this.isPrev = false;
	this.isFirst = false;
	this.isLast = false;
	this.nextPage = 0;
	this.prevPage = 0;
	this.lastPage = 0;
	this.firstPage = 0;
	this.items = Math.max(0, +items);
	this.count = 0;
	this.skip = 0;
	this.take = 0;
	this.page = 0;
	this.max = 0;
	this.visible = false;
	this.format = format || '?page={0}';
	this.refresh(items, page, max);
	this.transformName = transforms['pagination_default'];
}

function Page(url, page, selected, enabled) {
	this.url = url;
	this.page = page;
	this.selected = selected;
	this.enabled = enabled;
}

Page.prototype.html = function(body, cls) {
	var classname = cls ? cls : '';
	if (this.selected)
		classname += (classname ? ' ' : '') + 'selected';
	return '<a href="' + this.url + '"' + (classname ? (' class="' + classname + '"') : '') + '>' + (body || this.page) + '</a>';
};

/**
 * STATIC: Create transformation
 * @param {String} name
 * @param {Function(pagination)} fn
 * @param {Boolean} isDefault Default transformation for all paginations.
 */
Pagination.addTransform = function(name, fn, isDefault) {
	transforms['pagination'][name] = fn;
	isDefault && Pagination.setDefaultTransform(name);
};

/**
 * STATIC: Create transformation
 * @param {String} name
 * @param {Function(pagination)} fn
 */
Pagination.setDefaultTransform = function(name) {
	if (name)
		transforms['pagination_default'] = name;
	else
		delete transforms['pagination_default'];
};

/**
 * STATIC: Remove transformation
 * @param {String} name
 */
Pagination.removeTransform = function(name) {
	delete transforms['pagination'][name];
};

/**
 * Refresh pagination
 * @param {Number} items Count of items.
 * @param {Number} page Current page.
 * @param {Number} max Max items on page.
 * @return {Pagination}
 */
Pagination.prototype.refresh = function(items, page, max) {
	var self = this;

	self.page = Math.max(1, +page) - 1;

	if (self.page <= 0)
		self.page = 0;

	self.items = Math.max(0, +items);
	self.max = Math.max(1, +max);
	self.skip = self.page * self.max;
	self.count = Math.ceil(self.items / self.max);
	self.take = Math.min(self.max, (self.items - self.skip));

	self.lastPage = self.count;
	self.firstPage = 1;
	self.prevPage = self.page ? self.page : 1;
	self.nextPage = self.page + 2 < self.count - 1 ? self.page + 2 : self.count;

	self.isPrev = self.page > 0;
	self.isNext = self.page < self.count - 1;

	self.isFirst = self.page === 0;
	self.isLast = self.page === self.count - 1;

	self.visible = self.count > 1;
	self.page++;

	return self;
};

/**
 * Set transformation for current Pagination
 * @param {String} name
 * @return {Pagination}
 */
Pagination.prototype.setTransform = function(name) {
	var self = this;
	self._transform = name;
	return self;
};

/**
 * Execute a transform
 * @private
 * @param {String} name A transformation name.
 * @param {Object} argument1 Optional.
 * @param {Object} argument2 Optional.
 * @param {Object} argument3 Optional.
 * @param {Object} argument4 Optional.
 * @param {Object} argument..n Optional.
 * @return {Object}
 */
Pagination.prototype.transform = function(name) {

	var self = this;
	var transformName = name || self.transformName;

	if (!transformName)
		throw new Error('A transformation of Pagination not found.');

	var current = transforms['pagination'][transformName];
	if (!current)
		return self.render();

	var param = [];
	for (var i = 1; i < arguments.length; i++)
		param.push(arguments[i]);

	return current.apply(self, param);
};

/**
 * Get a previous page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.prev = function(format) {
	var self = this;
	var page = 0;

	format = format || self.format;

	if (self.isPrev)
		page = self.page - 1;
	else
		page = self.count;

	return new Page(format.format(page, self.items, self.count), page, false, self.isPrev);
};

/**
 * Get a next page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.next = function(format) {
	var self = this;
	var page = 0;

	format = format || self.format;

	if (self.isNext)
		page = self.page + 1;
	else
		page = 1;

	return new Page(format.format(page, self.items, self.count), page, false, self.isNext);
};

/**
 * Get a last page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.last = function(format) {
	var self = this;
	var page = self.count;
	format = format || self.format;
	return new Page(format.format(page, self.items, self.count), page, false, self.count > 0);
};

/**
 * Get a first page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.first = function(format) {
	var self = this;
	var page = 1;
	format = format || self.format;
	return new Page(format.format(page, self.items, self.count), page, false, self.count > 0);
};

/**
 * Create a pagination object
 * @param {Number} max Max pages in collection (optional).
 * @param {String} format Custom format (optional).
 * @return {Object Array} Example: [{ url: String, page: Number, selected: Boolean }]
 */
Pagination.prototype.prepare = function(max, format, type) {

	var self = this;

	if (self.transformName)
		return transforms['pagination'][self.transformName].apply(self, arguments);

	var builder = [];
	format = format || self.format;

	if (typeof(max) === 'string') {
		var tmp = format;
		format = max;
		max = tmp;
	}

	var isHTML = type === 'html';

	if (max == null) {
		for (var i = 1; i < self.count + 1; i++) {
			var page = new Page(format.format(i, self.items, self.count), i, i === self.page, true);
			builder.push(isHTML ? page.html() : page);
		}
		return builder;
	}

	var half = Math.floor(max / 2);
	var pages = self.count;

	var pageFrom = self.page - half;
	var pageTo = self.page + half;
	var plus = 0;

	if (pageFrom <= 0) {
		plus = Math.abs(pageFrom);
		pageFrom = 1;
		pageTo += plus;
	}

	if (pageTo >= pages) {
		pageTo = pages;
		pageFrom = pages - max;
		if (pageFrom <= 0)
			pageFrom = 1;
	}

	for (var i = pageFrom; i < pageTo + 1; i++) {
		var page = new Page(format.format(i, self.items, self.count), i, i === self.page, true);
		builder.push(isHTML ? page.html() : page);
	}

	return builder;
};

Pagination.prototype.render = function(max, format) {
	return this.prepare(max, format);
};

Pagination.prototype.html = function(max, format) {
	return this.prepare(max, format, 'html').join('');
};

Pagination.prototype.json = function(max, format) {
	return JSON.stringify(this.prepare(max, format));
};

UrlBuilder.make = function(fn) {
	var b = new UrlBuilder();
	fn.call(b, b);
	return b;
};

/**
 * Add parameter
 * @param {String} name
 * @param {Object} value
 * return {UrlBuilder}
 */
UrlBuilder.prototype.add = function(name, value) {
	var self = this;

	if (typeof(name) !== 'object') {
		self.builder[name] = value;
		return self;
	}

	var arr = Object.keys(name);

	for (var i = 0, length = arr.length; i < length; i++)
		self.builder[arr[i]] = name[arr[i]];

	return self;
};

/**
 * Remove parameter
 * @param {String} name
 * @return {UrlBuilder}
 */
UrlBuilder.prototype.remove = function(name) {
	var self = this;
	delete self.builder[name];
	return self;
};

/**
 * Read value
 * @param {String} name
 * @return {Object}
 */
UrlBuilder.prototype.read = function(name) {
	return this.builder[name] || null;
};

/**
 * Clear parameter collection
 * @return {UrlBuilder}
 */
UrlBuilder.prototype.clear = function() {
	var self = this;
	self.builder = {};
	return self;
};

/**
 * Create URL
 * @return {String}
 */
UrlBuilder.prototype.toString = function(url, skipEmpty) {

	if (typeof(url) === 'boolean') {
		var tmp = skipEmpty;
		skipEmpty = url;
		url = tmp;
	}

	var self = this;
	var builder = [];

	Object.keys(self.builder).forEach(function(o) {

		var value = self.builder[o];
		if (value == null)
			value = '';
		else
			value = value.toString();

		if (skipEmpty && value === '')
			return;

		builder.push(o + '=' + encodeURIComponent(value));
	});

	if (typeof(url) === 'string') {
		if (url[url.length - 1] !== '?')
			url += '?';
	} else
		url = '';

	return url + builder.join('&');
};

/**
 * Has these parameters?
 * @param {String Array} keys Keys.
 * @return {Boolean}
 */
UrlBuilder.prototype.hasValue = function(keys) {

	if (keys === undefined)
		return false;

	var self = this;

	if (typeof(keys) === 'string')
		keys = [keys];

	for (var i = 0; i < keys.length; i++) {
		var val = self.builder[keys[i]];
		if (val == null)
			return false;
	}

	return true;
};

/**
 * Render parameters
 * @param {String Array} keys Keys.
 * @param {String} delimiter Delimiter (default &).
 * @return {String}
 */
UrlBuilder.prototype.toOne = function(keys, delimiter) {
	var self = this;
	var builder = [];
	keys.forEach(key => builder.push(self.builder[key] || ''));
	return builder.join(delimiter || '&');
};

function TransformBuilder() {}

TransformBuilder.transform = function(name, obj) {

	var index = 2;

	if (obj === undefined) {
		obj = name;
		name = transforms['transformbuilder_default'];
		index = 1;
	}

	var current = transforms['transformbuilder'][name];
	if (!current) {
		F.error('Transformation "' + name + '" not found.', 'TransformBuilder.transform()');
		return obj;
	}

	var sum = arguments.length - index;
	if (sum <= 0)
		return current.call(obj, obj);

	var arr = new Array(sum + 1)
	var indexer = 1;
	arr[0] = obj;
	for (var i = index; i < arguments.length; i++)
		arr[indexer++] = arguments[i];
	return current.apply(obj, arr);
};

/**
 * STATIC: Create a transformation
 * @param {String} name
 * @param {Function} fn
 * @param {Boolean} isDefault Default transformation for all TransformBuilders.
 */
TransformBuilder.addTransform = function(name, fn, isDefault) {
	transforms['transformbuilder'][name] = fn;
	isDefault && TransformBuilder.setDefaultTransform(name);
};

TransformBuilder.setDefaultTransform = function(name) {
	if (name)
		transforms['transformbuilder_default'] = name;
	else
		delete transforms['transformbuilder_default'];
};

function async_queue(arr, callback) {
	var item = arr.shift();
	if (!item)
		return callback();
	item(() => async_queue(arr, callback));
};

function async_wait(arr, onItem, onCallback, index) {
	var item = arr[index];
	if (item)
		onItem(item, () => async_wait(arr, onItem, onCallback, index + 1), index);
	else
		onCallback();
}

function RESTBuilder(url) {
	this.$url = url;
	this.$headers = { 'User-Agent': 'Total.js/v' + framework.version_header, Accept: 'application/json, text/plain, text/plain, text/xml' };
	this.$method = 'get';
	this.$timeout = 10000;
	this.$type = 0; // 0 = query, 1 = json, 2 = urlencode, 3 = raw
	this.$schema;
	this.$length = 0;
	this.$transform = transforms['restbuilder_default'];

	// this.$flags;
	// this.$data = {};
	// this.$nodnscache = true;
	// this.$cache_expire;
	// this.$cache_nocache;
}

RESTBuilder.make = function(fn) {
	var instance = new RESTBuilder();
	fn(instance);
	return instance;
};

/**
 * STATIC: Create a transformation
 * @param {String} name
 * @param {Function} fn
 * @param {Boolean} isDefault Default transformation for all RESTBuilders.
 */
RESTBuilder.addTransform = function(name, fn, isDefault) {
	transforms['restbuilder'][name] = fn;
	isDefault && RESTBuilder.setDefaultTransform(name);
};

RESTBuilder.setDefaultTransform = function(name) {
	if (name)
		transforms['restbuilder_default'] = name;
	else
		delete transforms['restbuilder_default'];
};

RESTBuilder.prototype.setTransform = function(name) {
	this.$transform = name;
	return this;
};

RESTBuilder.prototype.url = function(url) {
	this.$url = url;
	return this;
};

RESTBuilder.prototype.maketransform = function(obj, data) {
	if (!this.$transform)
		return obj;
	var fn = transforms['restbuilder'][this.$transform];
	return fn ? fn(obj, data) : obj;
};

RESTBuilder.prototype.$trasnformname

RESTBuilder.prototype.timeout = function(number) {
	this.$timeout = number;
	return this;
};

RESTBuilder.prototype.maxlength = function(number) {
	this.$length = number;
	this.$flags = null;
	return this;
};

RESTBuilder.prototype.auth = function(user, password) {
	this.$headers['authorization'] = 'Basic ' + new Buffer(user + ':' + password).toString('base64');
	return this;
};

RESTBuilder.prototype.schema = function(group, schema) {
	this.$schema = exports.getschema(group, name);
	return this;
};

RESTBuilder.prototype.noDnsCache = function() {
	this.$nodnscache = true;
	this.$flags = null;
	return this;
};

RESTBuilder.prototype.noCache = function() {
	this.$nocache = true;
	return this;
};

RESTBuilder.prototype.make = function(fn) {
	fn.call(this, this);
	return this;
};

RESTBuilder.prototype.xhr = function() {
	this.$headers['X-Requested-With'] = 'XMLHttpRequest';
	return this;
};

RESTBuilder.prototype.method = function(method) {
	this.$method = method.toLowerCase();
	this.$flags = null;
	return this;
};

RESTBuilder.prototype.referer = RESTBuilder.prototype.referrer = function(value) {
	this.$headers['Referer'] = value;
	return this;
};

RESTBuilder.prototype.origin = function(value) {
	this.$headers['Origin'] = value;
	return this;
};

RESTBuilder.prototype.put = function(data) {
	if (this.$method !== 'put') {
		this.$flags = null;
		this.$method = 'put';
		this.$type = 1;
	}
	data && this.raw(data);
	return this;
};

RESTBuilder.prototype.delete = function(data) {
	if (this.$method !== 'delete') {
		this.$flags = null;
		this.$method = 'delete';
		this.$type = 1;
	}
	data && this.raw(data);
	return this;
};

RESTBuilder.prototype.get = function(data) {
	if (this.$method !== 'get') {
		this.$flags = null;
		this.$method = 'get';
	}
	data && this.raw(data);
	return this;
};

RESTBuilder.prototype.post = function(data) {
	if (this.$method !== 'post') {
		this.$flags = null;
		this.$method = 'post';
		this.$type = 1;
	}
	data && this.raw(data);
	return this;
};

RESTBuilder.prototype.json = function(data) {

	if (this.$type !== 1)
		this.$flags = null;

	data && this.raw(data);
	this.$type = 1;

	if (this.$method === 'get')
		this.$method = 'post';

	return this;
};

RESTBuilder.prototype.urlencoded = function(data) {

	if (this.$type !== 2)
		this.$flags = null;

	if (this.$method === 'get')
		this.$method = 'post';

	this.$type = 2;
	data && this.raw(data);
	return this;
};

RESTBuilder.prototype.accept = function(ext) {
	var type = framework_utils.getContentType(ext);
	if (this.$headers['Accept'] !== type)
		this.$flags = null;
	this.$headers['Accept'] = type;
	return this;
};

RESTBuilder.prototype.xml = function(data) {

	if (this.$type !== 3)
		this.$flags = null;

	if (this.$method === 'get')
		this.$method = 'post';

	this.$type = 3;
	data && this.raw(data);
	return this;
};

RESTBuilder.prototype.raw = function(value) {
	this.$data = value && value.$clean ? value.$clean() : value;
	return this;
};

RESTBuilder.prototype.cookie = function(name, value) {
	if (!this.$cookies)
		this.$cookies = {};
	this.$cookies[name] = value;
	return this;
};

RESTBuilder.prototype.header = function(name, value) {
	this.$headers[name] = value;
	return this;
};

RESTBuilder.prototype.cache = function(expire) {
	this.$cache_expire = expire;
	return this;
};

RESTBuilder.prototype.set = function(name, value) {

	if (!this.$data)
		this.$data = {};

	if (typeof(name) !== 'object') {
		this.$data[name] = value;
		return this;
	}

	var arr = Object.keys(name);
	for (var i = 0, length = arr.length; i < length; i++)
		this.$data[arr[i]] = name[arr[i]];

	return this;
};

RESTBuilder.prototype.rem = function(name) {
	if (this.$data && this.$data[name])
		this.$data[name] = undefined;
	return this;
};

RESTBuilder.prototype.stream = function(callback) {
	var self = this;
	var flags = self.$flags ? self.$flags : [self.$method];
	var key;

	if (!self.$flags) {

		!self.$nodnscache && flags.push('dnscache');

		switch (self.$type) {
			case 1:
				flags.push('json');
				break;
			case 3:
				flags.push('xml');
				break;
		}

		self.$flags = flags;
	}

	return U.download(self.$url, flags, self.$data, callback, self.$cookies, self.$headers, undefined, self.$timeout);
};

RESTBuilder.prototype.exec = function(callback) {

	if (!callback)
		callback = NOOP;

	var self = this;
	var flags = self.$flags ? self.$flags : [self.$method];
	var key;

	if (!self.$flags) {

		!self.$nodnscache && flags.push('dnscache');
		self.$length && flags.push('<' + self.$length);

		switch (self.$type) {
			case 1:
				flags.push('json');
				break;
			case 3:
				flags.push('xml');
				break;
		}

		self.$flags = flags;
	}

	if (self.$cache_expire && !self.$nocache) {
		key = '$rest_' + (self.$url + flags.join(',') + (self.$data ? Qs.stringify(self.$data) : '')).hash();
		var data = framework.cache.read2(key);
		if (data) {
			var evt = new events.EventEmitter();

			setImmediate(function() {
				evt.removeAllListeners();
				evt = null;
			});

			callback(null, self.maketransform(this.$schema ? this.$schema.make(data.json) : data.json, data), data);
			return evt;
		}
	}

	return U.request(self.$url, flags, self.$data, function(err, response, status, headers, hostname) {

		var output = new RESTBuilderResponse();
		output.json = response.isJSON() ? framework.onParseJSON(response) : null;
		output.response = response;
		output.status = status;
		output.headers = headers;
		output.hostname = hostname;
		output.cache = false;
		output.datetime = F.datetime;

		if (self.$schema) {

			if (err)
				return callback(err, null, output);

			self.$schema.make(parsed, function(err, model) {
				!err && key && framework.cache.add(key, output, self.$cache_expire);
				callback(err, err ? null : self.maketransform(output.json, output), output);
				output.cache = true;
			});

			return;
		}

		!err && key && framework.cache.add(key, output, self.$cache_expire);
		callback(err, self.maketransform(output.json, output), output);
		output.cache = true;

	}, self.$cookies, self.$headers, undefined, self.$timeout);
};

function RESTBuilderResponse() {}

RESTBuilderResponse.prototype.cookie = function(name) {
	var self = this;

	if (self.cookies)
		return $decodeURIComponent(self.cookies[name] || '');

	var cookie = self.headers['cookie'];
	if (!cookie)
		return '';

	self.cookies = {};

	var arr = cookie.split(';');

	for (var i = 0, length = arr.length; i < length; i++) {
		var line = arr[i].trim();
		var index = line.indexOf('=');
		if (index !== -1)
			self.cookies[line.substring(0, index)] = line.substring(index + 1);
	}

	return $decodeURIComponent(self.cookies[name] || '');
};

// Handle errors of decodeURIComponent
function $decodeURIComponent(value) {
	try
	{
		return decodeURIComponent(value);
	} catch (e) {
		return value;
	}
};

// ======================================================
// EXPORTS
// ======================================================

exports.SchemaBuilder = SchemaBuilder;
exports.RESTBuilder = RESTBuilder;
exports.ErrorBuilder = ErrorBuilder;
exports.Pagination = Pagination;
exports.Page = Page;
exports.UrlBuilder = UrlBuilder;
exports.TransformBuilder = TransformBuilder;
global.RESTBuilder = RESTBuilder;
global.ErrorBuilder = ErrorBuilder;
global.TransformBuilder = TransformBuilder;
global.Pagination = Pagination;
global.Page = Page;
global.UrlBuilder = global.URLBuilder = UrlBuilder;
global.SchemaBuilder = SchemaBuilder;

exports.restart = function() {
	schemas = {};
	Object.keys(transforms).forEach(function(key) {
		if (key.indexOf('_') === -1)
			transforms[key] = {};
	});
};
