// Copyright 2012-2015 (c) Peter Širka <petersirka@gmail.com>
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
 * @version 1.9.1
 */

'use strict';

var UNDEFINED = 'undefined';
var FUNCTION = 'function';
var OBJECT = 'object';
var STRING = 'string';
var NUMBER = 'number';
var BOOLEAN = 'boolean';
var REQUIRED = 'The field "@" is required.';
var DEFAULT_SCHEMA = 'default';

var schemas = {};
var transforms = { pagination: {}, error: {}, objectbuilder: {}, transformbuilder: {} };

function SchemaBuilder(name) {
	this.name = name;
	this.collection = {};
}

/**
 * Get a schema
 * @param {String} name
 * @return {Object}
 */
SchemaBuilder.prototype.get = function(name) {
	return this.collection[name];
};

/**
 * Register a new schema
 * @param {String} name Schema name.
 * @param {Object} obj Schema definition.
 * @param {String Array} properties Properties to validate.
 * @param {Function(propertyName, value, path, schemaName)} validator
 * @return {SchemaBuilderEntity}
 */
SchemaBuilder.prototype.add = function(name, obj, properties, validator) {
	var self = this;

	if (typeof(obj) === UNDEFINED)
		obj = {};

	var keys = Object.keys(obj);
	if (!properties)
		properties = keys;

	self.collection[name] = new SchemaBuilderEntity(self, name, {}, validator, properties);

	for (var i = 0, length = keys.length; i < length; i++) {
		var key = keys[i];
		self.collection[name].define(key, obj[key]);
	}

	return self.collection[name];
};

/**
 * Register a new schema
 * @alias
 * @return {SchemBuilderEntity}
 */
SchemaBuilder.prototype.create = function() {
	var self = this;
	return self.add.apply(self, arguments);
};

SchemaBuilder.prototype.Create = function() {
	var self = this;
	return self.add.apply(self, arguments);
};

/**
 * Remove an exist schema or group of schemas
 * @param {String} name Schema name, optional.
 * @return {SchemaBuilder}
 */
SchemaBuilder.prototype.remove = function(name) {
	var self = this;

	if (name === undefined) {
		delete schemas[name];
		self.collection = null;
		return;
	}

	var schema = self.collection[name];
	if (schema)
		schema.remove();
	schema = null;
	return self;
};

SchemaBuilder.prototype.destroy = function(name) {
	return this.remove(name);
};

function SchemaBuilderEntity(parent, name, obj, validator, properties) {
	this.parent = parent;
	this.name = name;
	this.primary;
	this.trim = true;
	this.schema = obj;
	this.properties = properties === undefined ? Object.keys(obj) : properties;
	this.resourcePrefix;
	this.resourceName;
	this.transforms;
	this.composes;
	this.operations;
	this.rules;
	this.constants;
	this.onPrepare;
	this.onDefault;
	this.onValidation = validator ? validator : framework.onValidation;
	this.onSave;
	this.onGet;
	this.onRemove;
	this.onQuery;
	this.onError;
	this.gcache = {};
}

/**
 * Define type in schema
 * @param {String/String Array} name
 * @param {Object/String} type
 * @param {Boolean} required Is required? Default: false.
 * @param {Number/String} custom Custom tag for search.
 * @return {SchemaBuilder}
 */
SchemaBuilderEntity.prototype.define = function(name, type, required, custom) {

	var self = this;
	if (name instanceof Array) {
		for (var i = 0, length = name.length; i < length; i++)
			self.define(name[i], type, required, custom);
		return self;
	}

	if (required !== undefined && typeof(required) !== BOOLEAN) {
		custom = required;
		required = false;
	}

	if (type instanceof SchemaBuilderEntity)
		type = type.name;

	self.schema[name] = self.$parse(name, type, required, custom);

	if (!required)
		return self;

	if (self.properties === undefined || self.properties === null)
		self.properties = [];

	if (self.properties.indexOf(name) !== -1)
		return self;

	self.properties.push(name);
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
 * @return {Array or Object} Returns Array (with property names) if the model is undefined otherwise returns Object Name/Value.
 */
SchemaBuilderEntity.prototype.filter = function(custom, model, reverse) {
	var self = this;

	if (typeof(model) === BOOLEAN) {
		var tmp = reverse;
		reverse = model;
		model = tmp;
	}

	var output = model === undefined ? [] : {};
	var type = typeof(custom);
	var isSearch = type === STRING ? custom[0] === '*' || custom[0] === '%' : false;
	var isReg = false;

	if (isSearch)
		custom = custom.substring(1);
	else if (type === OBJECT)
		isReg = framework_utils.isRegExp(custom);

	for (var prop in self.schema) {

		var schema = self.schema[prop];
		if (!schema)
			continue;

		var tv = typeof(schema.custom);

		if (isSearch) {
			if (tv === STRING) {
				if (schema.custom.indexOf(custom) === -1) {
					if (!reverse)
						continue;
				} else if (reverse)
					continue;
			} else
				continue;
		} else if (isReg) {
			if (tv === STRING) {
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

	if (type === FUNCTION) {

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

	if (type === OBJECT)
		return result;

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

	if (lower.contains([STRING, 'text', 'varchar', 'nvarchar'])) {

		result.type = 3;

		var beg = lower.indexOf('(');
		if (beg === -1)
			return result;

		var size = lower.substring(beg + 1, lower.length - 1).parseInt();
		result.length = size;
		result.raw = lower.substring(0, beg);
		return result;
	}

	if (lower.contains(['int', 'byte'])) {
		result.type = 1;
		return result;
	}

	if (lower.contains(['decimal', NUMBER, 'float', 'double'])) {
		result.type = 2;
		return result;
	}

	if (lower.contains('bool', BOOLEAN)) {
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

		if (typeof(type) !== STRING)
			continue;

		var isArray = type[0] === ']';
		if (isArray)
			type = type.substring(1, type.length - 1);

		var m = self.parent.get(type);

		if (typeof(m) === undefined)
			continue;

		dependencies.push({ name: name, isArray: isArray, schema: m });
	}

	return dependencies;
};

/**
 * Set schema validation
 * @param {String Array} properties Properties to validate, optional.
 * @param {Function(propertyName, value, path, entityName, model)} fn A validation function.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setValidation = function(properties, fn) {
	var self = this;

	if (fn === undefined && properties instanceof Array) {
		self.properties = properties;
		return self;
	}

	if (typeof(properties) !== FUNCTION) {
		self.properties = properties;
		self.onValidation = fn;
	} else
		self.onValidation = properties;

	return self;
};

SchemaBuilderEntity.prototype.setValidate = function(properties, fn) {
	return this.setValidation(properties, fn);
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
 * @param {Function(error, model, helper, next(value))} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setSave = function(fn) {
	var self = this;
	self.onSave = fn;
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
 * @param {Function(error, model, helper, next(value))} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setGet = function(fn) {
	var self = this;
	self.onGet = fn;
	return self;
};

/**
 * Set query handler
 * @param {Function(error, helper, next(value))} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setQuery = function(fn) {
	var self = this;
	self.onQuery = fn;
	return self;
};

/**
 * Set remove handler
 * @param {Function(error, helper, next(value))} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setRemove = function(fn) {
	var self = this;
	self.onRemove = fn;
	return self;
};

/**
 * Set properties to validate
 * @param {String Array} properties
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.setProperties = function(properties) {
	var self = this;
	self.properties = properties;
	return self;
};

/**
 * Add a new rule for the schema
 * @param {String} name Rule name, optional.
 * @param {Object} value
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.addRule = function(name, value) {
	var self = this;

	if (value === undefined) {
		value = name;
		name = 'default';
	}

	if (!self.rules)
		self.rules = {};

	self.rules[name] = value;
	return self;
};

/**
 * Add a new constant for the schema
 * @param {String} name Constant name, optional.
 * @param {Object} value
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.constant = function(name, value) {
	var self = this;

	if (value === undefined)
		return self.constants ? self.constants[name] : undefined;

	if (!self.constants)
		self.constants = {};

	self.constants[name] = value;
	return self;
};

/**
 * Add a new transformation for the entity
 * @param {String} name Transform name, optional.
 * @param {Function(errorBuilder, model, helper, next([output]), entityName)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.addTransform = function(name, fn) {
	var self = this;

	if (typeof(name) === FUNCTION) {
		fn = name;
		name = 'default';
	}

	if (!self.transforms)
		self.transforms = {};

	self.transforms[name] = fn;
	return self;
};

/**
 * Add a new operation for the entity
 * @param {String} name Operation name, optional.
 * @param {Function(errorBuilder, [model], helper, next([output]), entityName)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.addOperation = function(name, fn) {
	var self = this;

	if (typeof(name) === FUNCTION) {
		fn = name;
		name = 'default';
	}

	if (!self.operations)
		self.operations = {};

	self.operations[name] = fn;
	return self;
};

/**
 * Add a new workflow for the entity
 * @param {String} name Workflow name, optional.
 * @param {Function(errorBuilder, model, helper, next([output]), schemaName)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.addWorkflow = function(name, fn) {
	var self = this;

	if (typeof(name) === FUNCTION) {
		fn = name;
		name = 'default';
	}

	if (!self.workflows)
		self.workflows = {};

	self.workflows[name] = fn;
	return self;
};

/**
 * Add a new composer for the entity
 * @param {String} name Composer name, optional.
 * @param {Function(errorBuilder, output, model, helper, next([output]), entityName)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.addCompose = function(name, fn) {
	var self = this;

	if (typeof(name) === FUNCTION) {
		fn = name;
		name = 'default';
	}

	if (!self.composes)
		self.composes = {};

	self.composes[name] = fn;
	return self;
};

/**
 * Add a new composer for the entity
 * @param {String} name Transform name, optional.
 * @param {Function(errorBuilder, output, model, helper, next([output]), entityName)} fn
 */
SchemaBuilderEntity.prototype.addComposer = function(name, fn) {
	return this.addCompose(name, fn);
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
 * Get a rule
 * @param {String} name
 * @return {Object}
 */
SchemaBuilderEntity.prototype.rule = function(name, value) {
	var self = this;

	if (value)
		return self.addRule(name, value);

	if (self.rules === undefined)
		return undefined;

	if (name === undefined)
		name = 'default';

	return self.rules[name];
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
	self.onValidation = null;
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
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.save = function(model, helper, callback, skip) {

	if (typeof(callback) === BOOLEAN) {
		skip = callback;
		callback = helper;
		helper = undefined;
	} else if (callback === undefined) {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== FUNCTION)
		callback = function(){};

	var self = this;
	var $type = 'save';

	self.$prepare(model, function(err, model) {

		if (err) {
			callback(err, model);
			return;
		}

		var builder = new ErrorBuilder();

		if (!isGenerator(self, $type, self.onSave)) {
			self.onSave(builder, model, helper, function(result) {
				self.$process(arguments, model, $type, undefined, builder, result, callback);
			}, skip !== true);
			return self;
		}

		callback.success = false;

		async.call(self, self.onSave)(function(err) {
			if (!err || callback.success)
				return;
			callback.success = true;
			builder.push(err);
			if (self.onError)
				self.onError(builder, model, $type);
			callback(builder);
		}, builder, model, helper, function(result) {

			if (callback.success)
				return;

			if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
				if (result instanceof Error || result instanceof ErrorBuilder)
					builder.push(result);
				result = arguments[1];
			}

			var has = builder.hasError();
			if (has && self.onError)
				self.onError(builder, model, $type);

			callback.success = true;
			callback(has ? builder : null, result === undefined ? model : result);
		}, skip !== true);

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
SchemaBuilderEntity.prototype.get = function(helper, callback) {

	if (callback === undefined) {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== FUNCTION)
		callback = function(){};

	var self = this;
	var builder = new ErrorBuilder();
	var output = self.default();
	var $type = 'get';

	if (!isGenerator(self, $type, self.onGet)) {
		self.onGet(builder, output, helper, function(result) {
			self.$process(arguments, output, $type, undefined, builder, result, callback);
		});
		return self;
	}

	callback.success = false;
	async.call(self, self.onGet)(function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;
		builder.push(err);

		if (self.onError)
			self.onError(builder, model, $type);

		callback(builder);
	}, builder, output, helper, function(result) {

		if (callback.success)
			return;

		if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
			if (result instanceof Error || result instanceof ErrorBuilder)
				builder.push(result);
			result = arguments[1];
		}
		callback.success = true;

		var has = builder.hasError();
		if (has && self.onError)
			self.onError(builder, model, $type);

		callback(has ? builder : null, result === undefined ? output : result);
	});

	return self;
};

/**
 * Execute onRemove delegate
 * @param {Object} helper A helper object, optional.
 * @param {Function(err, result)} callback
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.remove = function(helper, callback) {

	if (callback === undefined) {
		callback = helper;
		helper = undefined;
	}

	var self = this;
	var builder = new ErrorBuilder();
	var $type = 'remove';

	if (!isGenerator(self, $type, self.onRemove)) {
		self.onRemove(builder, helper, function(result) {
			self.$process(arguments, undefined, $type, undefined, builder, result, callback);
		});
		return self;
	}

	callback.success = false;
	async.call(self, self.onRemove)(function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;
		builder.push(err);

		if (self.onError)
			self.onError(builder, model, $type);

		callback(builder);
	}, builder, helper, function(result) {

		if (callback.success)
			return;

		if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
			if (result instanceof Error || result instanceof ErrorBuilder)
				builder.push(result);
			result = arguments[1];
		}

		var has = builder.hasError();
		if (has && self.onError)
			self.onError(builder, model, $type);

		callback.success = true;
		callback(has ? builder : null, result === undefined ? helper : result);
	});

	return self;
};

/**
 * Execute onQuery delegate
 * @param {Object} helper A helper object, optional.
 * @param {Function(err, result)} callback
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.query = function(helper, callback) {

	if (callback === undefined) {
		callback = helper;
		helper = undefined;
	}

	var self = this;
	var builder = new ErrorBuilder();
	var $type = 'query';

	if (!isGenerator(self, $type, self.onQuery)) {
		self.onQuery(builder, helper, function(result) {
			self.$process(arguments, undefined, $type, undefined, builder, result, callback);
		});
		return self;
	}

	callback.success = false;

	async.call(self, self.onQuery)(function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;
		builder.push(err);
		if (self.onError)
			self.onError(builder, model, $type);
		callback(builder);
	}, builder, helper, function(result) {

		if (callback.success)
			return;

		if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
			if (result instanceof Error || result instanceof ErrorBuilder)
				builder.push(result);
			result = arguments[1];
		}

		var has = builder.hasError();
		if (has && self.onError)
			self.onError(builder, model, $type);

		callback.success = true;
		callback(builder.hasError() ? builder : null, result);
	});

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
SchemaBuilderEntity.prototype.validate = function(model, resourcePrefix, resourceName, builder) {

	var self = this;
	var fn = self.onValidation;

	if (builder === undefined)
		builder = new ErrorBuilder();

	if (fn === undefined || fn === null) {
		fn = framework.onValidation;
		if (fn === undefined || fn === null)
			return builder;
	}

	if (self.resourcePrefix)
		builder.resourcePrefix = self.resourcePrefix;

	if (self.resourceName)
		builder.resourceName = self.resourceName;

	if (resourceName)
		builder.resourceName = resourceName;

	if (resourcePrefix)
		builder.resourcePrefix = resourcePrefix;

	// self._setStateToModel(model, 1, 1);
	//return framework_utils.validate.call(self, model, self.name, fn, builder, undefined, self.name, self.parent.collection);
	return framework_utils.validate_builder.call(self, model, builder, self.name, self.parent.collection, self.name);
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

	if (obj.$save)
		return obj;

	var self = this;

	obj.$async = function(callback, index) {
		if (callback === undefined)
			callback = NOOP;
		obj.$$async = [];
		obj.$$result = [];
		obj.$callback = callback;
		setImmediate(function() {
			obj.$$async.async(function() {
				var result = obj.$$result;
				delete obj.$$result;
				delete obj.$$async;
				callback(null, index !== undefined ? result[index] : result);
			});
		});
		return obj;
	};

	obj.$save = function(helper, callback) {

		if (!obj.$$async) {
			self.save(obj, helper, callback);
			return obj;
		}

		obj.$$async.push(function(next) {
			self.save(obj, helper, function(err, result) {

				if (obj.$$result)
					obj.$$result.push(err ? null : result);

				if (!err)
					return next();
				next = null;
				var result = obj.$$result;
				delete obj.$$result;
				delete obj.$$async;
				obj.$callback(err, result);
			});
		});

		return obj;
	};

	obj.$remove = function(helper, callback) {

		if (!obj.$$async) {
			self.remove(helper, callback);
			return obj;
		}

		obj.$$async.push(function(next) {
			self.remove(obj, helper, function(err, result) {

				if (obj.$$result)
					obj.$$result.push(err ? null : result);

				if (!err)
					return next();
				next = null;
				var result = obj.$$result;
				delete obj.$$result;
				delete obj.$$async;
				obj.$callback(err, result);
			});
		});

		return obj;
	};

	obj.$default = function() {
		return self.default();
	};

	obj.$destroy = function() {
		obj = null;
	};

	obj.$transform = function(name, helper, callback) {

		if (!obj.$$async) {
			self.transform(name, obj, helper, callback);
			return obj;
		}

		obj.$$async.push(function(next) {
			self.transform(name, obj, helper, function(err, result) {

				if (obj.$$result)
					obj.$$result.push(err ? null : result);

				if (!err)
					return next();

				next = null;
				var result = obj.$$result;
				delete obj.$$result;
				delete obj.$$async;
				obj.$callback(err, result);
			});
		});

		return obj;
	};

	obj.$compose = function(name, helper, callback) {

		if (!obj.$$async) {
			self.compose(name, obj, helper, callback);
			return obj;
		}

		obj.$$async.push(function(next) {
			self.compose(name, obj, helper, function(err, result) {

				if (obj.$$result)
					obj.$$result.push(err ? null : result);

				if (!err)
					return next();
				next = null;
				var result = obj.$$result;
				delete obj.$$result;
				delete obj.$$async;
				obj.$callback(err, result);
			});
		});

		return obj;
	};

	obj.$workflow = function(name, helper, callback) {

		if (!obj.$$async) {
			self.workflow(name, obj, helper, callback);
			return obj;
		}

		obj.$$async.push(function(next) {
			self.workflow(name, obj, helper, function(err, result) {

				if (obj.$$result)
					obj.$$result.push(err ? null : result);

				if (!err)
					return next();
				next = null;
				var result = obj.$$result;
				delete obj.$$result;
				delete obj.$$async;
				obj.$callback(err, result);
			});
		});

		return obj;
	};

	obj.$operation = function(name, helper, callback) {

		if (!obj.$$async) {
			self.operation(name, obj, helper, callback);
			return obj;
		}

		obj.$$async.push(function(next) {
			self.operation(name, obj, helper, function(err, result) {

				if (obj.$$result)
					obj.$$result.push(err ? null : result);

				if (!err)
					return next();
				next = null;
				var result = obj.$$result;
				delete obj.$$result;
				delete obj.$$async;
				obj.$callback(err, result);
			});
		});

		return obj;
	};

	obj.$clean = function() {
		return self.clean(obj);
	};

	obj.$clone = function() {
		return self.$make(JSON.parse(JSON.stringify(obj)));
	};

	obj.$prepare = function() {
		return self.prepare(obj);
	};

	obj.$schema = function() {
		return self;
	};

	obj.$validate = function(resourcePrefix, resourceName, builder) {
		return self.validate(obj, resourcePrefix, resourceName, builder);
	};

	obj.$rule = function(name) {
		return self.rule(name);
	};

	obj.$constant = function(name) {
		return self.constant(name);
	};

	return obj;
};

SchemaBuilderEntity.prototype.$prepare = function(obj, callback) {

	var self = this;

	if (typeof(obj.$save) === FUNCTION) {
		callback(null, obj);
		return self;
	}

	self.make(obj, function(err, model) {
		callback(err, model);
	});

	return self;
};

/**
 * Create a default object according the schema
 * @return {Object}
 */
SchemaBuilderEntity.prototype.default = function() {

	var self = this;
	var obj = self.schema;

	if (obj === null)
		return null;

	var defaults = self.onDefault;
	var item = framework_utils.extend({}, obj, true);

	for (var property in item) {

		var type = item[property];

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
				item[property] = type.isArray ? [] : new Date();
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
		}
	}

	return self.$make(item);
};

SchemaBuilderEntity.prototype.make = SchemaBuilderEntity.prototype.load = function(model, callback) {

	var self = this;
	var output = self.prepare(model);

	if (self.onValidation === undefined) {
		if (callback)
			callback(null, output);
		return output;
	}

	var builder = self.validate(output);
	if (builder.hasError()) {

		if (self.onError)
			self.onError(builder, model, 'make');

		if (callback)
			callback(builder, null);
		return output;
	}

	if (callback)
		callback(null, output);
	return output;
};

function autotrim(context, value) {
	if (context.trim)
		return value.trim();
	return value;
}

/**
 * Prepare model according to schema
 * @param {Object} model
 * @param {String Array} dependencies INTERNAL.
 * @return {Object}
 */
SchemaBuilderEntity.prototype.prepare = function(model, dependencies) {

	var self = this;
	var obj = self.schema;

	if (obj === null)
		return null;

	if (model === null || model === undefined)
		return self.default();

	var onPrepare = function(name, value, index) {
		if (!self.onPrepare)
			return value;
		var val = self.onPrepare(name, value, index, model);
		return val === undefined ? value : val;
	};

	var tmp;
	var entity;
	var item = framework_utils.extend({}, obj, true);
	var defaults = self.onDefault;

	for (var property in item) {

		var val = model[property];

		// IS PROTOTYPE? The problem was in e.g. "search" property, because search is in String prototypes.
		if (!model.hasOwnProperty(property))
			val = undefined;

		if (val === undefined && defaults)
			val = defaults(property, false, self.name);

		if (val === undefined)
			val = '';

		var type = item[property];
		var typeval = typeof(val);

		if (typeval === FUNCTION)
			val = val();

		if (!type.isArray) {
			switch (type.type) {
				// undefined
				case 0:
					break;
				// number: integer
				case 1:
					item[property] = onPrepare(property, framework_utils.parseInt(val));
					break;
				// number: float
				case 2:
					item[property] = onPrepare(property, framework_utils.parseFloat(val));
					break;
				// string
				case 3:
					tmp = val === undefined || val === null ? '' : autotrim(self, val.toString());
					if (type.length&& type.length < tmp.length)
						tmp = tmp.substring(0, type.length);
					item[property] = onPrepare(property, tmp);
					break;
				// boolean
				case 4:
					tmp = val ? val.toString().toLowerCase() : null;
					item[property] = onPrepare(property, tmp === 'true' || tmp === '1' || tmp === 'on');
					break;
				// date
				case 5:

					tmp = null;

					if (typeval === STRING) {
						if (val === '')
							tmp = null;
						else
							tmp = val.trim().parseDate();
					} else if (typeval === OBJECT) {
						if (framework_utils.isDate(val))
							tmp = val;
						else
							tmp = null;
					} else if (typeval === NUMBER) {
						tmp = new Date(val);
					}

					if (tmp !== null && typeof(tmp) === OBJECT && tmp.toString() === 'Invalid Date')
						tmp = null;

					if (tmp)
						item[property] = onPrepare(property, tmp);
					else
						item[property] = (defaults ? isUndefined(defaults(property, false, self.name), null) : null);

					break;

				// object
				case 6:
					item[property] = onPrepare(property, model[property]);
					break;

				// schema
				case 7:
					entity = self.parent.get(type.raw);
					if (entity) {
						item[property] = entity.prepare(val);
						if (dependencies)
							dependencies.push({ name: type.raw, value: onPrepare(property, item[property]) });
					}
					else
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

			tmp = model[property][j];
			typeval = typeof(tmp);

			switch (type.type) {
				case 0:
					tmp = onPrepare(property, tmp, j);
					break;

				case 1:
					tmp = onPrepare(property, framework_utils.parseInt(tmp), j);
					break;

				case 2:
					tmp = onPrepare(property, framework_utils.parseFloat(tmp), j);
					break;

				case 3:
					tmp = tmp === undefined || tmp === null ? '' : autotrim(self, tmp.toString());
					if (type.length && tmp.length < tmp.length)
						tmp = tmp.substring(0, type.length);
					tmp = onPrepare(property, tmp, j);
					break;

				case 4:
					if (tmp)
						tmp = tmp.toString().toLowerCase();
					tmp = onPrepare(property, tmp === 'true' || tmp === '1' || tmp === 'on', j);
					break;

				case 5:

					if (typeval === STRING) {
						if (tmp === '')
							tmp = null;
						else
							tmp = tmp.trim().parseDate();
					} else if (typeval === OBJECT) {
						if (framework_utils.isDate(tmp))
							tmp = tmp;
						else
							tmp = null;
					} else if (typeval === NUMBER) {
						tmp = new Date(tmp);
					}

					if (tmp !== null && typeof(tmp) === OBJECT && tmp.toString() === 'Invalid Date')
						tmp = null;

					if (tmp)
						tmp = onPrepare(property, tmp, j);
					else
						tmp = undefined;

					break;

				case 6:
					tmp = onPrepare(property, tmp, j);
					break;

				case 7:

					entity = self.parent.get(type.raw);
					if (entity) {
						tmp = entity.prepare(tmp, dependencies);
						if (dependencies)
							dependencies.push({ name: type.raw, value: onPrepare(property, tmp, j) });
					}
					else
						tmp = null;

					tmp = onPrepare(property, tmp, j);
					break;
			}

			if (tmp === undefined)
				continue;

			item[property].push(tmp);
		}
	}

	// self._setStateToModel(model, 0, 1);
	return self.$make(item);
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
SchemaBuilderEntity.prototype.transform = function(name, model, helper, callback, skip) {

	var self = this;

	if (typeof(name) !== STRING) {
		callback = helper;
		helper = model;
		model = name;
		name = 'default';
	}

	if (typeof(callback) === BOOLEAN) {
		skip = callback;
		callback = helper;
		helper = undefined;
	} else if (callback === undefined) {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== FUNCTION)
		callback = function(){};

	var trans = self.transforms ? self.transforms[name] : undefined;

	if (!trans) {
		callback(new ErrorBuilder().add('', 'Transform not found.'));
		return self;
	}

	var $type = 'transform';

	if (skip === true) {
		var builder = new ErrorBuilder();
		trans.call(self, builder, model, helper, function(result) {
			self.$process(arguments, model, $type, name, builder, result, callback);
		}, skip !== true);
		return self;
	}

	self.$prepare(model, function(err, model) {

		if (err) {
			callback(err, model);
			return;
		}

		var builder = new ErrorBuilder();

		if (!isGenerator(self, 'transform.' + name, trans)) {
			trans.call(self, builder, model, helper, function(result) {
				self.$process(arguments, model, $type, name, builder, result, callback);
			}, self.name);
			return;
		}

		callback.success = false;
		async.call(self, trans)(function(err) {
			if (!err || callback.success)
				return;
			callback.success = true;
			builder.push(err);

			if (self.onError)
				self.onError(builder, model, $type, name);

			callback(builder);
		}, builder, model, helper, function(result) {

			if (callback.success)
				return;

			if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
				if (result instanceof Error || result instanceof ErrorBuilder)
					builder.push(result);
				result = arguments[1];
			}

			var has = builder.hasError();
			if (has && self.onError)
				self.onError(builder, model, $type, name);

			callback.success = true;
			callback(has ? builder : null, result === undefined ? model : result);
		}, skip !== true);

	});

	return self;
};

/**
 * Compose an object
 * @param {String} name
 * @param {Object} model
 * @param {Object} helper A helper object, optional.
 * @param {Function(errorBuilder, output, model)} callback
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.compose = function(name, model, helper, callback, skip) {

	var self = this;

	if (typeof(name) !== STRING) {
		callback = helper;
		helper = model;
		model = name;
		name = 'default';
	}

	if (typeof(callback) === BOOLEAN) {
		skip = callback;
		callback = helper;
		helper = undefined;
	} else if (callback === undefined) {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== FUNCTION)
		callback = function(){};

	var compose = self.composes ? self.composes[name] : undefined;

	if (!compose) {
		callback(new ErrorBuilder().add('', 'Composer not found.'));
		return self;
	}

	var $type = 'compose';

	if (skip === true) {
		var builder = new ErrorBuilder();
		compose.call(self, builder, model, helper, function(result) {
			self.$process(arguments, model, $type, name, builder, result, callback);
		}, skip !== true);
		return self;
	}

	self.$prepare(model, function(err, model) {

		if (err) {
			callback(err, model);
			return;
		}

		var output = self.default();
		var builder = new ErrorBuilder();

		if (!isGenerator(self, 'compose.' + name, compose)) {
			compose.call(self, builder, output, model, helper, function(result) {
				self.$process(arguments, model, $type, name, builder, result, callback);
			}, skip !== true);
			return;
		}

		callback.success = false;
		async.call(self, compose)(function(err) {
			if (!err || callback.success)
				return;
			callback.success = true;
			builder.push(err);
			if (self.onError)
				self.onError(builder, model, $type, name);
			callback(builder);
		}, builder, model, helper, function(result) {

			if (callback.success)
				return;

			if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
				if (result instanceof Error || result instanceof ErrorBuilder)
					builder.push(result);
				result = arguments[1];
			}

			var has = builder.hasError();
			if (has && self.onError)
				self.onError(builder, model, $type, name);

			callback.success = true;
			callback(has ? builder : null, result === undefined ? model : result);
		}, skip !== true);
	});

	return self;
};

SchemaBuilderEntity.prototype.$process = function(arg, model, type, name, builder, result, callback) {

	var self = this;

	if (arg.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
		if (result instanceof Error || result instanceof ErrorBuilder)
			builder.push(result);
		result = arg[1];
	}

	var has = builder.hasError();
	if (has && self.onError)
		self.onError(builder, model, type, name);

	callback(has ? builder : null, result === undefined ? model : result, model);
	return self;
}

/**
 * Run a workflow
 * @param {String} name
 * @param {Object} model
 * @param {Object} helper A helper object, optional.
 * @param {Function(errorBuilder, output, model)} callback
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntity.prototype.workflow = function(name, model, helper, callback, skip) {

	var self = this;

	if (typeof(name) !== STRING) {
		callback = helper;
		helper = model;
		model = name;
		name = 'default';
	}

	if (typeof(callback) === BOOLEAN) {
		skip = callback;
		callback = helper;
		helper = undefined;
	} else if (callback === undefined) {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== FUNCTION)
		callback = function(){};

	var workflow = self.workflows ? self.workflows[name] : undefined;

	if (!workflow) {
		callback(new ErrorBuilder().add('', 'Workflow not found.'));
		return self;
	}

	var $type = 'workflow';

	if (skip === true) {
		var builder = new ErrorBuilder();
		workflow.call(self, builder, model, helper, function(result) {
			self.$process(arguments, model, $type, name, builder, result, callback);
		}, skip !== true);
		return self;
	}

	self.$prepare(model, function(err, model) {

		if (err) {
			callback(err, model);
			return;
		}

		var builder = new ErrorBuilder();
		if (!isGenerator(self, 'workflow.' + name, workflow)) {
			workflow.call(self, builder, model, helper, function(result) {
				self.$process(arguments, model, $type, name, builder, result, callback);
			}, skip !== true);
			return;
		}

		callback.success = false;
		async.call(self, workflow)(function(err) {
			if (!err || callback.success)
				return;
			callback.success = true;
			builder.push(err);
			if (self.onError)
				self.onError(builder, model, $type, name);
			callback(builder);
		}, builder, model, helper, function(result) {

			if (callback.success)
				return;

			if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
				if (result instanceof Error || result instanceof ErrorBuilder)
					builder.push(result);
				result = arguments[1];
			}

			var has = builder.hasError();
			if (has && self.onError)
				self.onError(builder, model, $type, name);

			callback.success = true;
			callback(has ? builder : null, result === undefined ? model : result);
		}, skip !== true);
	});

	return self;
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
SchemaBuilderEntity.prototype.operation = function(name, model, helper, callback, skip) {

	var self = this;

	var th = typeof(helper);
	var tc = typeof(callback);

	if (tc === UNDEFINED) {
		if (th === FUNCTION) {
			callback = helper;
			helper = model;
			model = undefined;
		} else if (th === UNDEFINED) {
			helper = model;
			model = undefined;
		}
	} else if (th === UNDEFINED) {
		helper = model;
		model = undefined;
	} else if (tc === BOOLEAN) {
		skip = callback;
		callback = helper;
		helper = undefined;
	}

	if (typeof(helper) === FUNCTION) {
		callback = helper;
		helper = undefined;
	}

	if (typeof(callback) !== FUNCTION)
		callback = function(){};

	var operation = self.operations ? self.operations[name] : undefined;

	if (!operation) {
		callback(new ErrorBuilder().add('', 'Operation not found.'));
		return self;
	}

	var builder = new ErrorBuilder();
	var $type = 'operation';

	if (!isGenerator(self, 'operation.' + name, operation)) {
		operation.call(self, builder, model, helper, function(result) {
			self.$process(arguments, model, $type, name, builder, result, callback);
		}, skip !== true);
		return self;
	}

	callback.success = false;
	async.call(self, operation)(function(err) {
			if (!err || callback.success)
				return;
			callback.success = true;
			builder.push(err);
			if (self.onError)
				self.onError(builder, model, $type, name);
			callback(builder);
	}, builder, model, helper, function(result) {

		if (callback.success)
			return;

		if (arguments.length === 2 || (result instanceof Error || result instanceof ErrorBuilder)) {
			if (result instanceof Error || result instanceof ErrorBuilder)
				builder.push(result);
			result = arguments[1];
		}

		var has = builder.hasError();
		if (has && self.onError)
			self.onError(builder, model, $type, name);

		callback.success = true;
		callback(has ? builder : null, result);
	}, skip !== true);

	return self;
};

/**
 * Clean model (remove state of all schemas in model).
 * @param {Object} model
 * @param {Boolean} isCopied Internal argument.
 * @return {Object}
 */
SchemaBuilderEntity.prototype.clean = function(m, isCopied) {

	if (m === null || m === undefined)
		return m;

	var model;

	if (!isCopied)
		model = framework_utils.copy(m);
	else
		model = m;

	var self = this;

	delete model['$$result'];
	delete model['$$async'];
	delete model['$clone'];
	delete model['$async'];
	delete model['$callback'];
	delete model['$transform'];
	delete model['$workflow'];
	delete model['$operation'];
	delete model['$destroy'];
	delete model['$save'];
	delete model['$remove'];
	delete model['$clean'];
	delete model['$prepare'];
	delete model['$default'];
	delete model['$schema'];
	delete model['$validate'];
	delete model['$compose'];
	delete model['$rule'];
	delete model['$constant'];

	for (var key in model) {
		var value = model[key];

		if (value === null)
			continue;

		if (typeof(value) !== OBJECT)
			continue;

		if (value instanceof Array) {
			for (var j = 0, sublength = value.length; j < sublength; j++) {

				var item = value[j];
				if (item === null)
					continue;

				if (typeof(item) !== OBJECT)
					continue;

				value[j] = self.clean(item, true);
			}

			continue;
		}

		model[key] = self.clean(value, true);
	}

	return model;
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
	this.resourceName = framework.config['default-errorbuilder-resource-name'] || 'default';
	this.resourcePrefix = framework.config['default-errorbuilder-resource-prefix'] || '';
	this.isResourceCustom = false;
	this.count = 0;
	this.replacer = [];
	this.isPrepared = false;
	this.contentType = 'application/json';

	if (onResource === undefined)
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
	this.items = items;
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

/**
 * Create schema
 * @param {String} name chema name.
 * @param {Object} obj Schema definition.
 * @param {SchemaDefaults} defaults Schema defaults.
 * @param {SchemaValidator} validator Schema validator.
 * @return {Object}
 */
exports.schema = function(name, obj, defaults, validator, properties) {

	if (obj === undefined) {

		if (schemas[name] === undefined)
			schemas[name] = new SchemaBuilder(name);

		return schemas[name];
	}

	if (schemas[DEFAULT_SCHEMA] === undefined)
		schemas[DEFAULT_SCHEMA] = new SchemaBuilder(DEFAULT_SCHEMA);

	if (typeof(defaults) !== FUNCTION)
		defaults = undefined;

	if (typeof(validator) !== FUNCTION)
		validator = undefined;

	if (!(properties instanceof Array))
		properties = undefined;

	var schema = schemas[DEFAULT_SCHEMA].add(name, obj, properties, validator);

	if (defaults)
		schema.setDefault(defaults);

	return obj;
};

exports.load = function(group, name, model) {

	if (!group)
		group = DEFAULT_SCHEMA;

	if (schemas[group] === undefined)
		schemas[group] = new SchemaBuilder(group);

	var schema;

	if (name) {
		schema = schemas[group].get(name);
		if (!schema)
			throw new Error('Schema ' + group + '.' + name + ' not found.');
	}

	return model ? schema.make(model) : name ? schema : schemas[group];
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

exports.getschema = function(group, name) {

	if (!name) {
		name = group;
		group = DEFAULT_SCHEMA;
	}

	var g = schemas[group];
	if (g === undefined)
		return;

	var s = g.get(name);
	if (s)
		return s;

	return;
};

exports.newschema = function(group, name, model) {

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

	return model ? schema.make(model) : name ? schema : schemas[group];
};

/**
 * Remove a schema
 * @param {String} name
 */
exports.remove = function(name) {
	delete schemas[name];
};

/**
 * Default handler
 * @callback SchemaDefaults
 * @param {String} name Property name.
 * @param {Booelan} isDefault Is default (true) or prepare (false)?
 * @return {Object} Property value.
 */

/**
 * Validator handler
 * @callback SchemaValidator
 * @param {String} name Property name.
 * @param {Object} value Property value.
 * @return {Boolean} Is valid?
 */

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
 * @param {Function or Array} fn Validator Handler or Property names as array for validating.
 * @param {String Array} properties Valid only these properties, optional.
 * @return {Function or Array}
 */
exports.validation = function(name, properties, fn) {

	if (schemas[DEFAULT_SCHEMA] === undefined)
		return [];

	var schema = schemas[DEFAULT_SCHEMA].get(name);
	if (schema === undefined)
		return [];

	if (fn instanceof Array && typeof(properties) === FUNCTION) {
		var tmp = fn;
		fn = properties;
		properties = tmp;
	}

	if (typeof(fn) === FUNCTION) {

		schema.onValidation = fn;

		if (properties === undefined)
			schema.properties = Object.keys(schema.schema);
		else
			schema.properties = properties;

		return true;
	}

	if (fn === undefined) {
		var validator = schema.properties;
		if (validator === undefined)
			return Object.keys(schema.schema);
		return validator || [];
	}

	schema.onValidation = fn;
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
		if (!self.isPrepared)
			self.prepare();
		return self._transform();
	},

	get error() {
		var self = this;
		if (!self.isPrepared)
			self.prepare();
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
	self.resourceName = name || 'default';
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
	self.resourceName = name || 'default';
	return self._resource();
};

ErrorBuilder.prototype.setPrefix = function(name) {
	var self = this;
	self.isResourceCustom = true;
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

	self.onResource = function(name) {
		var self = this;
		if (typeof(framework) !== UNDEFINED)
			return framework.resource(self.resourceName, self.resourcePrefix + name);
		return '';
	};

	return self;
};

/**
 * Add an error
 * @param {String} name  Property name.
 * @param {String or Error} error Error message.
 * @param {String} path  Current path (in object).
 * @param {Number} index Array Index, optional.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.add = function(name, error, path, index) {
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
			self.add(name[i], undefined, path, index);
		return self;
	}

	if (error instanceof Array) {
		for (var i = 0, length = error.length; i < length; i++)
			self.add(name, error[i], path, index);
		return self;
	}

	if (typeof(name) === OBJECT) {
		path = error;
		error = name;
		name = '';
	}

	if ((name === undefined || name === null) && (error === undefined || error === null))
		return self;

	if (error === undefined)
		error = '@';

	if (error === undefined || error === null)
		return self;

	if (error instanceof Error)
		error = error.toString();

	self.items.push({
		name: name,
		error: typeof(error) === STRING ? error : (error || '').toString() || '@',
		path: path,
		index: index
	});

	self.count = self.items.length;
	return self;
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
	return this.add(name, error, path, index);
};

/**
 * Remove error
 * @param {String} name Property name.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.remove = function(name) {
	var self = this;

	self.items = self.items.remove(function(o) {
		return o.name === name;
	});

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

	if (name) {
		return self.items.find(function(o) {
			return o.name === name;
		}) !== null;
	}

	return self.items.length > 0;
};

/**
 * Read an error
 * @param {String} name Property name.
 * @return {String}
 */
ErrorBuilder.prototype.read = function(name) {

	var self = this;

	if (!self.isPrepared)
		self.prepare();

	var error = self.items.find(function(o) {
		return o.name === name;
	});

	if (error !== null)
		return error.error;

	return null;
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
	var items;
	if (beautify !== null)
		items = this.prepare()._transform();
	else
		items = this.items;
	if (beautify)
		return JSON.stringify(items, replacer, '\t');
	return JSON.stringify(items, replacer);
};

/**
 * Serialize ErrorBuilder to JSON
 * @param {Boolean} beautify Beautify JSON.
 * @return {String}
 */
ErrorBuilder.prototype.JSON = function(beautify, replacer) {
	return this.json(beautify, replacer);
};

ErrorBuilder.prototype.output = function() {
	return this.prepare()._transform();
};

/**
 * Internal: Prepare error messages with onResource()
 * @private
 * @return {ErrorBuidler}
 */
ErrorBuilder.prototype._prepare = function() {

	var self = this;

	if (self.onResource === null)
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

		if (o.error === undefined || o.error.length === 0)
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
		return self.json(null);

	var current = transforms['error'][transformName];

	if (current === undefined)
		return self.items;

	return current.call(self);
};

/**
 * To string
 * @return {String}
 */
ErrorBuilder.prototype.toString = function() {

	var self = this;

	if (!self.isPrepared)
		self.prepare();

	var errors = self.items;
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
	var self = this;
	self.transformName = name;
	return self;
};

/**
 * Transform
 * @param {String} name
 * @return {Object}
 */
ErrorBuilder.prototype.transform = function(name) {
	var self = this;
	return self.prepare()._transform(name);
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

	if (lengthBuilder === 0 || lengthKeys === 0)
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
 * @return {ErrorBuidler}
 */
ErrorBuilder.prototype.prepare = function() {
	var self = this;

	if (self.isPrepared)
		return self;

	self._prepare()._prepareReplace();
	self.isPrepared = true;

	return self;
};

/**
 * STATIC: Create transformation
 * @param {String} name
 * @param {Function(errorBuilder)} fn
 * @param {Boolean} isDefault Default transformation for all error builders.
 */
ErrorBuilder.addTransform = function(name, fn, isDefault) {
	transforms['error'][name] = fn;
	if (isDefault)
		ErrorBuilder.setDefaultTransform(name);
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
	if (name === undefined)
		delete transforms['error_default'];
	else
		transforms['error_default'] = name;
};

/**
 * STATIC: Create transformation
 * @param {String} name
 * @param {Function(pagination)} fn
 * @param {Boolean} isDefault Default transformation for all paginations.
 */
Pagination.addTransform = function(name, fn, isDefault) {
	transforms['pagination'][name] = fn;
	if (isDefault)
		Pagination.setDefaultTransform(name);
};

/**
 * STATIC: Create transformation
 * @param {String} name
 * @param {Function(pagination)} fn
 */
Pagination.setDefaultTransform = function(name) {
	if (name === undefined)
		delete transforms['pagination_default'];
	else
		transforms['pagination_default'] = name;
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

	self.count = Math.floor(items / max) + (items % max > 0 ? 1 : 0);
	self.page = page - 1;

	if (self.page < 0)
		self.page = 0;

	self.items = items;
	self.skip = self.page * max;
	self.take = max;
	self.max = max;
	self.isPrev = self.page > 0;
	self.isNext = self.page < self.count - 1;
	self.isFirst = self.count > 1;
	self.isLast = self.count > 1;
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

	if (current === undefined)
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

	return {
		url: format.format(page, self.items, self.count),
		page: page,
		selected: false,
		enabled: self.isPrev
	};
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

	return {
		url: format.format(page, self.items, self.count),
		page: page,
		selected: false,
		enabled: self.isNext
	};
};

/**
 * Get a last page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.last = function(format) {

	var self = this;
	var page = self.count;

	if (self.isPrev)
		page = self.page - 1;

	format = format || self.format;

	return {
		url: format.format(page, self.items, self.count),
		page: page,
		selected: false,
		enabled: self.count > 0
	};
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

	return {
		url: format.format(page, self.items, self.count),
		page: page,
		selected: false,
		enabled: self.count > 0
	};
};

/**
 * Create a pagination object
 * @param {Number} max Max pages in collection (optional).
 * @param {String} format Custom format (optional).
 * @return {Object Array} Example: [{ url: String, page: Number, selected: Boolean }]
 */
Pagination.prototype.prepare = function(max, format) {

	var self = this;

	if (self.transformName)
		return transforms['pagination'][self.transformName].apply(self, arguments);

	var builder = [];
	format = format || self.format;

	if (typeof(max) === STRING) {
		var tmp = format;
		format = max;
		max = tmp;
	}

	if (max === undefined || max === null) {
		for (var i = 1; i < self.count + 1; i++)
			builder.push({
				url: format.format(i, self.items, self.count),
				page: i,
				selected: i === self.page,
				enabled: true
			});
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
	}

	if (pageFrom < 0)
		pageFrom = 1;

	for (var i = pageFrom; i < pageTo + 1; i++)
		builder.push({
			url: format.format(i, self.items, self.count),
			page: i,
			selected: i === self.page,
			enabled: true
		});

	return builder;
};

Pagination.prototype.render = function(max, format) {
	return this.prepare(max, format);
};

/**
 * Add parameter
 * @param {String} name
 * @param {Object} value
 * return {UrlBuilder}
 */
UrlBuilder.prototype.add = function(name, value) {
	var self = this;

	if (typeof(name) !== OBJECT) {
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

	if (typeof(url) === BOOLEAN) {
		var tmp = skipEmpty;
		skipEmpty = url;
		url = tmp;
	}

	var self = this;
	var builder = [];

	Object.keys(self.builder).forEach(function(o) {

		var value = self.builder[o];
		if (value === undefined || value === null)
			value = '';
		else
			value = value.toString();

		if (skipEmpty && value === '')
			return;

		builder.push(o + '=' + encodeURIComponent(value));
	});

	if (typeof(url) === STRING) {
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
		if (val === undefined || val === null)
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

	keys.forEach(function(o) {
		builder.push(self.builder[o] || '');
	});

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
	if (!current)
		return obj;

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
 * STATIC: Create transformation
 * @param {String} name
 * @param {Function} fn
 * @param {Boolean} isDefault Default transformation for all ObjectBuilder.
 */
TransformBuilder.addTransform = function(name, fn, isDefault) {
	transforms['transformbuilder'][name] = fn;
	if (isDefault)
		TransformBuilder.setDefaultTransform(name);
};

/**
 * STATIC: Create transformation
 * @param {String} name
 * @param {Function} fn
 */
TransformBuilder.setDefaultTransform = function(name) {
	if (name === undefined)
		delete transforms['transformbuilder_default'];
	else
		transforms['transformbuilder_default'] = name;
};

// ======================================================
// EXPORTS
// ======================================================

exports.SchemaBuilder = SchemaBuilder;
exports.ErrorBuilder = ErrorBuilder;
exports.Pagination = Pagination;
exports.UrlBuilder = UrlBuilder;
exports.TransformBuilder = TransformBuilder;
global.ErrorBuilder = ErrorBuilder;
global.TransformBuilder = TransformBuilder;