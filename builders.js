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
 * @module FrameworkBuilders
 * @version 3.4.4
 */

'use strict';

const REQUIRED = 'The field "@" is invalid.';
const DEFAULT_SCHEMA = 'default';
const SKIP = { $$schema: 1, $$async: 1, $$repository: 1, $$controller: 1, $$workflow: 1, $$parent: 1, $$keys: 1 };
const REGEXP_CLEAN_EMAIL = /\s/g;
const REGEXP_CLEAN_PHONE = /\s|\.|-|\(|\)/g;
const REGEXP_NEWOPERATION = /^(async\s)?function(\s)?\([a-zA-Z$\s]+\)|^function anonymous\(\$|^\([a-zA-Z$\s]+\)|^function\*\(\$|^\([a-zA-Z$\s]+\)/;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const Qs = require('querystring');
const MSG_OBSOLETE_NEW = 'You used older declaration of this delegate and you must rewrite it. Read more in docs.';
const BOOL = { true: 1, on: 1, '1': 1 };
const REGEXP_FILTER = /[a-z0-9-_]+:(\s)?(\[)?(String|Number|Boolean|Date)(\])?/i;

var schemas = {};
var schemasall = {};
var schemacache = {};
var operations = {};
var tasks = {};
var transforms = { pagination: {}, error: {}, restbuilder: {} };
var restbuilderupgrades = [];

function SchemaBuilder(name) {
	this.name = name;
	this.collection = {};
}

const SchemaBuilderProto = SchemaBuilder.prototype;

function SchemaOptions(error, model, options, callback, controller, name, schema) {
	this.error = error;
	this.value = this.model = model;
	this.options = options || EMPTYOBJECT;
	this.callback = this.next = callback;
	this.controller = (controller instanceof SchemaOptions || controller instanceof OperationOptions) ? controller.controller : controller;
	this.name = name;
	this.schema = schema;
}

function TaskBuilder($) {
	var t = this;
	t.value = {};
	t.tasks = {};
	if ($ instanceof SchemaOptions || $ instanceof OperationOptions) {
		t.error = $.error;
		t.controller = $.controller;
	} else {
		if ($ instanceof Controller || $ instanceof WebSocketClient)
			t.controller = $;
		else if ($ instanceof ErrorBuilder)
			t.error = $;
	}
}

TaskBuilder.prototype = {

	get user() {
		return this.controller ? this.controller.user : null;
	},

	get session() {
		return this.controller ? this.controller.session : null;
	},

	get sessionid() {
		return this.controller && this.controller ? this.controller.req.sessionid : null;
	},

	get language() {
		return (this.controller ? this.controller.language : '') || '';
	},

	get ip() {
		return this.controller ? this.controller.ip : null;
	},

	get id() {
		return this.controller ? this.controller.id : null;
	},

	get req() {
		return this.controller ? this.controller.req : null;
	},

	get res() {
		return this.controller ? this.controller.res : null;
	},

	get params() {
		return this.controller ? this.controller.params : null;
	},

	get files() {
		return this.controller ? this.controller.files : null;
	},

	get body() {
		return this.controller ? this.controller.body : null;
	},

	get query() {
		return this.controller ? this.controller.query : null;
	},

	get model() {
		return this.value;
	},

	set model(val) {
		this.value = val;
	},

	get headers() {
		return this.controller && this.controller.req ? this.controller.req.headers : null;
	},

	get ua() {
		return this.controller && this.controller.req ? this.controller.req.ua : null;
	},

	get filter() {
		var ctrl = this.controller;
		if (ctrl && !ctrl.$filter)
			ctrl.$filter = ctrl.$filterschema ? CONVERT(ctrl.query, ctrl.$filterschema) : ctrl.query;
		return ctrl ? ctrl.$filter : EMPTYOBJECT;
	}
};

const TaskBuilderProto = TaskBuilder.prototype;

SchemaOptions.prototype = {

	get user() {
		return this.controller ? this.controller.user : null;
	},

	get session() {
		return this.controller ? this.controller.session : null;
	},

	get keys() {
		return this.model.$$keys;
	},

	get parent() {
		return this.model.$$parent;
	},

	get repo() {
		if (this.controller)
			return this.controller.repository;
		if (!this.model.$$repository)
			this.model.$$repository = {};
		return this.model.$$repository;
	},

	get sessionid() {
		return this.controller && this.controller ? this.controller.req.sessionid : null;
	},

	get language() {
		return (this.controller ? this.controller.language : '') || '';
	},

	get ip() {
		return this.controller ? this.controller.ip : null;
	},

	get id() {
		return this.controller ? this.controller.id : null;
	},

	get req() {
		return this.controller ? this.controller.req : null;
	},

	get res() {
		return this.controller ? this.controller.res : null;
	},

	get params() {
		return this.controller ? this.controller.params : null;
	},

	get files() {
		return this.controller ? this.controller.files : null;
	},

	get body() {
		return this.controller ? this.controller.body : null;
	},

	get query() {
		return this.controller ? this.controller.query : null;
	},

	get headers() {
		return this.controller && this.controller.req ? this.controller.req.headers : null;
	},

	get ua() {
		return this.controller && this.controller.req ? this.controller.req.ua : null;
	},

	get filter() {
		var ctrl = this.controller;
		if (ctrl && !ctrl.$filter)
			ctrl.$filter = ctrl.$filterschema ? CONVERT(ctrl.query, ctrl.$filterschema) : ctrl.query;
		return ctrl ? ctrl.$filter : EMPTYOBJECT;
	}
};

var SchemaOptionsProto = SchemaOptions.prototype;

SchemaOptionsProto.cancel = function() {
	var self = this;
	self.callback = self.next = null;
	self.error = null;
	self.controller = null;
	self.model = null;
	self.options = null;
	return self;
};

SchemaOptionsProto.extend = function(data) {
	var self = this;
	var ext = self.schema.extensions[self.name];
	if (ext) {
		for (var i = 0; i < ext.length; i++)
			ext[i](self, data);
		return true;
	}
};

SchemaOptionsProto.redirect = function(url) {
	this.callback(new F.callback_redirect(url));
	return this;
};

SchemaOptionsProto.clean = function() {
	return this.model.$clean();
};

SchemaOptionsProto.$async = function(callback, index) {
	return this.model.$async(callback, index);
};

SchemaOptionsProto.$workflow = function(name, helper, callback, async) {
	return this.model.$workflow(name, helper, callback, async);
};

SchemaOptionsProto.$transform = function(name, helper, callback, async) {
	return this.model.$transform(name, helper, callback, async);
};

SchemaOptionsProto.$operation = function(name, helper, callback, async) {
	return this.model.$operation(name, helper, callback, async);
};

SchemaOptionsProto.$hook = function(name, helper, callback, async) {
	return this.model.$hook(name, helper, callback, async);
};

SchemaOptionsProto.$save = function(helper, callback, async) {
	return this.model.$save(helper, callback, async);
};

SchemaOptionsProto.$insert = function(helper, callback, async) {
	return this.model.$insert(helper, callback, async);
};

SchemaOptionsProto.$update = function(helper, callback, async) {
	return this.model.$update(helper, callback, async);
};

SchemaOptionsProto.$patch = function(helper, callback, async) {
	return this.model.$patch(helper, callback, async);
};

SchemaOptionsProto.$query = function(helper, callback, async) {
	return this.model.$query(helper, callback, async);
};

SchemaOptionsProto.$delete = SchemaOptionsProto.$remove = function(helper, callback, async) {
	return this.model.$remove(helper, callback, async);
};

SchemaOptionsProto.$get = SchemaOptionsProto.$read = function(helper, callback, async) {
	return this.model.$get(helper, callback, async);
};

SchemaOptionsProto.push = function(type, name, helper, first) {
	return this.model.$push(type, name, helper, first);
};

SchemaOptionsProto.next = function(type, name, helper) {
	return this.model.$next(type, name, helper);
};

SchemaOptionsProto.output = function() {
	return this.model.$output();
};

SchemaOptionsProto.stop = function() {
	return this.model.$stop();
};

SchemaOptionsProto.response = function(index) {
	return this.model.$response(index);
};

SchemaOptionsProto.DB = function() {
	return F.database(this.error);
};

SchemaOptionsProto.successful = function(callback) {
	var self = this;
	return function(err, a, b, c) {
		if (err)
			self.invalid(err);
		else
			callback.call(self, a, b, c);
	};
};

SchemaOptionsProto.success = function(a, b) {

	if (a && b === undefined && typeof(a) !== 'boolean') {
		b = a;
		a = true;
	}

	this.callback(SUCCESS(a === undefined ? true : a, b));
	return this;
};

SchemaOptionsProto.done = function(arg) {
	var self = this;
	return function(err, response) {
		if (err) {

			if (self.error !== err)
				self.error.push(err);

			self.callback();
		} else if (arg)
			self.callback(SUCCESS(err == null, arg === true ? response : arg));
		else
			self.callback(SUCCESS(err == null));
	};
};

SchemaOptionsProto.invalid = function(name, error, path, index) {
	var self = this;

	if (arguments.length) {
		self.error.push(name, error, path, index);
		self.callback();
		return self;
	}

	return function(err) {
		self.error.push(err);
		self.callback();
	};
};

SchemaOptionsProto.repository = function(name, value) {
	return this.model && this.model.$repository ? this.model.$repository(name, value) : value;
};

SchemaOptionsProto.noop = function() {
	this.callback(NoOp);
	return this;
};

/**
 *
 * Get a schema
 * @param {String} name
 * @return {Object}
 */
SchemaBuilderProto.get = function(name) {
	return this.collection[name];
};

/**
 * Create a new schema
 * @alias
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderProto.create = function(name) {
	this.collection[name] = new SchemaBuilderEntity(this, name);
	return this.collection[name];
};

/**
 * Removes an existing schema or group of schemas
 * @param {String} name Schema name, optional.
 * @return {SchemaBuilder}
 */
SchemaBuilderProto.remove = function(name) {
	if (name) {
		var schema = this.collection[name];
		schema && schema.destroy();
		schema = null;
		delete schemasall[name.toLowerCase()];
		delete this.collection[name];
	} else {
		exports.remove(this.name);
		this.collection = null;
	}
};

SchemaBuilderProto.destroy = function(name) {
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
	this.inherits = [];
	this.verifications = null;
	this.resourcePrefix;
	this.extensions = {};
	this.resourceName;
	this.transforms;
	this.workflows;
	this.hooks;
	this.operations;
	this.constants;
	this.onPrepare;
	this.$onPrepare; // Array of functions for inherits
	this.onDefault;
	this.$onDefault; // Array of functions for inherits
	this.onValidate = F.onValidate;
	this.onSave;
	this.onInsert;
	this.onUpdate;
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

const SchemaBuilderEntityProto = SchemaBuilderEntity.prototype;

SchemaBuilderEntityProto.allow = function() {
	var self = this;

	if (!self.fields_allow)
		self.fields_allow = [];

	var arr = arguments;

	if (arr.length === 1)
		arr = arr[0].split(',').trim();

	for (var i = 0, length = arr.length; i < length; i++) {
		if (arr[i] instanceof Array)
			arr[i].forEach(item => self.fields_allow.push(item));
		else
			self.fields_allow.push(arr[i]);
	}
	return self;
};

SchemaBuilderEntityProto.before = function(name, fn) {
	var self = this;
	if (!self.preparation)
		self.preparation = {};
	self.preparation[name] = fn;
	return self;
};

SchemaBuilderEntityProto.required = function(name, fn) {

	var self = this;

	if (!name)
		return self;

	if (name.indexOf(',') !== -1) {
		var arr = name.split(',');
		for (var i = 0; i < arr.length; i++)
			self.required(arr[i].trim(), fn);
		return self;
	}

	if (fn === false) {
		self.properties && (self.properties = self.properties.remove(name));
		return self;
	}

	var prop = self.schema[name];
	if (!prop)
		throw new Error('Property "{0}" doesn\'t exist in "{1}" schema.'.format(name, self.name));

	prop.can = typeof(fn) === 'function' ? fn : null;

	if (!prop.required) {
		prop.required = true;
		if (self.properties) {
			self.properties.indexOf(name) === -1 && self.properties.push(name);
		} else
			self.properties = [name];
	}

	return self;
};

SchemaBuilderEntityProto.clear = function() {
	var self = this;

	self.schema = {};
	self.properties = [];
	self.fields = [];
	self.verifications = null;

	if (self.preparation)
		self.preparation = null;

	if (self.dependencies)
		self.dependencies = null;

	if (self.fields_allow)
		self.fields_allow = null;

	return self;
};

SchemaBuilderEntityProto.middleware = function(fn) {
	var self = this;
	if (!self.middlewares)
		self.middlewares = [];
	self.middlewares.push(fn);
	return self;
};

function runmiddleware(opt, schema, callback, index, processor) {

	if (!index)
		index = 0;

	var fn = schema.middlewares[index];

	if (fn == null) {
		callback.call(schema, opt);
		return;
	}

	if (processor) {
		fn(opt, processor);
		return;
	}

	processor = function(stop) {
		if (!stop)
			runmiddleware(opt, schema, callback, index + 1, processor);
	};

	fn(opt, processor);
}

/**
 * Define type in schema
 * @param {String|String[]} name
 * @param {Object/String} type
 * @param {Boolean} [required=false] Is required? Default: false.
 * @param {Number|String} [custom] Custom tag for search.
 * @return {SchemaBuilder}
 */
SchemaBuilderEntityProto.define = function(name, type, required, custom) {

	if (name instanceof Array) {
		for (var i = 0, length = name.length; i < length; i++)
			this.define(name[i], type, required, custom);
		return this;
	}

	var rt = typeof(required);

	if (required !== undefined && rt === 'string') {
		custom = required;
		required = false;
	}

	if (type == null) {
		// remove
		delete this.schema[name];
		this.properties = this.properties.remove(name);
		if (this.dependencies)
			this.dependencies = this.dependencies.remove(name);
		this.fields = Object.keys(this.schema);
		return this;
	}

	if (type instanceof SchemaBuilderEntity)
		type = type.name;

	var a = this.schema[name] = this.$parse(name, type, required, custom);
	switch (this.schema[name].type) {
		case 7:
			if (this.dependencies)
				this.dependencies.push(name);
			else
				this.dependencies = [name];
			break;
	}

	this.fields = Object.keys(this.schema);

	if (a.type === 7)
		required = true;

	if (required)
		this.properties.indexOf(name) === -1 && this.properties.push(name);
	else
		this.properties = this.properties.remove(name);

	return function(val) {
		a.def = val;
		return this;
	};
};

SchemaBuilderEntityProto.verify = function(name, fn, cache) {
	var self = this;

	if (!self.verifications)
		self.verifications = [];

	var cachekey;

	if (cache)
		cachekey = self.name + '_verify_' + name + '_';

	self.verifications.push({ name: name, fn: fn, cache: cache, cachekey: cachekey });
	return self;
};

SchemaBuilderEntityProto.inherit = function(group, name) {

	if (!name) {
		name = group;
		group = DEFAULT_SCHEMA;
	}

	var self = this;

	exports.getschema(group, name, function(err, schema) {

		if (err)
			throw err;

		self.primary = schema.primary;
		self.inherits.push(schema);

		if (!self.resourceName && schema.resourceName)
			self.resourceName = schema.resourceName;

		if (!self.resourcePrefix && schema.resourcePrefix)
			self.resourcePrefix = schema.resourcePrefix;

		copy_inherit(self, 'schema', schema.schema);
		copy_inherit(self, 'meta', schema.meta);
		copy_inherit(self, 'transforms', schema.transforms);
		copy_inherit(self, 'workflows', schema.workflows);
		copy_inherit(self, 'hooks', schema.hooks);
		copy_inherit(self, 'operations', schema.operations);
		copy_inherit(self, 'constants', schema.constants);

		if (schema.middlewares) {
			self.middlewares = [];
			for (var i = 0; i < schema.middlewares.length; i++)
				self.middlewares.push(schema.middlewares[i]);
		}

		if (schema.verifications) {
			self.verifications = [];
			for (var i = 0; i < schema.verifications.length; i++)
				self.verifications.push(schema.verifications[i]);
		}

		schema.properties.forEach(function(item) {
			if (self.properties.indexOf(item) === -1)
				self.properties.push(item);
		});

		if (schema.preparation) {
			self.preparation = {};
			Object.keys(schema.preparation).forEach(function(key) {
				self.preparation[key] = schema.preparation[key];
			});
		}

		if (schema.onPrepare) {
			if (!self.$onPrepare)
				self.$onPrepare = [];
			self.$onPrepare.push(schema.onPrepare);
		}

		if (schema.onDefault) {
			if (!self.$onDefault)
				self.$onDefault = [];
			self.$onDefault.push(schema.onDefault);
		}

		if (self.onValidate === F.onValidate && self.onValidate !== schema.onValidate)
			self.onValidate = schema.onValidate;

		if (!self.onSave && schema.onSave)
			self.onSave = schema.onSave;

		if (!self.onInsert && schema.onInsert)
			self.onInsert = schema.onInsert;

		if (!self.onUpdate && schema.onUpdate)
			self.onUpdate = schema.onUpdate;

		if (!self.onGet && schema.onGet)
			self.onGet = schema.onGet;

		if (!self.onRemove && schema.onRemove)
			self.onRemove = schema.onRemove;

		if (!self.onQuery && schema.onQuery)
			self.onQuery = schema.onQuery;

		if (!self.onError && schema.onError)
			self.onError = schema.onError;

		self.fields = Object.keys(self.schema);
	});

	return self;
};

function copy_inherit(schema, field, value) {

	if (!value)
		return;

	if (value && !schema[field]) {
		schema[field] = framework_utils.clone(value);
		return;
	}

	Object.keys(value).forEach(function(key) {
		if (schema[field][key] === undefined)
			schema[field][key] = framework_utils.clone(value[key]);
	});
}

/**
 * Set primary key
 * @param {String} name
 */
SchemaBuilderEntityProto.setPrimary = function(name) {
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
SchemaBuilderEntityProto.filter = function(custom, model, reverse) {

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

	for (var prop in this.schema) {

		var schema = this.schema[prop];
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
	if (beg !== -1) {
		result.length = lower.substring(beg + 1, lower.length - 1).parseInt();
		result.raw = lower.substring(0, beg);
	}
	return result;
}

SchemaBuilderEntityProto.$parse = function(name, value, required, custom) {

	var type = typeof(value);
	var result = {};

	result.raw = value;
	result.type = 0;
	result.length = 0;
	result.required = required ? true : false;
	result.validate = typeof(required) === 'function' ? required : null;
	result.can = null;
	result.isArray = false;
	result.custom = custom || '';

	//  0 = undefined
	//  1 = integer
	//  2 = float
	//  3 = string
	//  4 = boolean
	//  5 = date
	//  6 = object
	//  7 = custom object
	//  8 = enum
	//  9 = keyvalue
	// 10 = custom object type
	// 11 = number2
	// 12 = object as filter

	if (value === null)
		return result;

	if (value === '[]') {
		result.isArray = true;
		return result;
	}

	if (type === 'function') {

		if (value === UID) {
			result.type = 3;
			result.length = 20;
			result.raw = 'string';
			result.subtype = 'uid';
			return result;
		}

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

		if (value instanceof SchemaBuilderEntity)
			result.type = 7;
		else {
			result.type = 10;
			if (!this.asyncfields)
				this.asyncfields = [];
			this.asyncfields.push(name);
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

	if (value.indexOf(',') !== -1) {
		// multiple
		result.type = 12;
		return result;
	}

	if ((/^(string|text)+(\(\d+\))?$/).test(lower)) {
		result.type = 3;
		return parseLength(lower, result);
	}

	if ((/^(capitalize2)+(\(\d+\))?$/).test(lower)) {
		result.type = 3;
		result.subtype = 'capitalize2';
		return parseLength(lower, result);
	}

	if ((/^(capitalize|camelcase|camelize)+(\(\d+\))?$/).test(lower)) {
		result.type = 3;
		result.subtype = 'capitalize';
		return parseLength(lower, result);
	}

	if ((/^(lower|lowercase)+(\(\d+\))?$/).test(lower)) {
		result.subtype = 'lowercase';
		result.type = 3;
		return parseLength(lower, result);
	}

	if (lower.indexOf('base64') !== -1) {
		result.type = 3;
		result.raw = 'string';
		result.subtype = 'base64';
		return result;
	}

	if ((/^(upper|uppercase)+(\(\d+\))?$/).test(lower)) {
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

	if (lower === 'number2') {
		result.type = 11;
		return result;
	}

	if (['int', 'integer', 'byte'].indexOf(lower) !== -1) {
		result.type = 1;
		return result;
	}

	if (['decimal', 'number', 'float', 'double'].indexOf(lower) !== -1) {
		result.type = 2;
		return result;
	}

	if (['bool', 'boolean'].indexOf(lower) !== -1) {
		result.type = 4;
		return result;
	}

	if (['date', 'time', 'datetime'].indexOf(lower) !== -1) {
		result.type = 5;
		return result;
	}

	result.type = 7;
	return result;
};

SchemaBuilderEntityProto.getDependencies = function() {
	var dependencies = [];

	for (var name in this.schema) {

		var type = this.schema[name];
		if (typeof(type) !== 'string')
			continue;

		var isArray = type[0] === ']';
		if (isArray)
			type = type.substring(1, type.length - 1);

		var m = this.parent.get(type);
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
SchemaBuilderEntityProto.setValidate = function(properties, fn) {

	if (fn === undefined && properties instanceof Array) {
		this.properties = properties;
		return this;
	}

	if (typeof(properties) !== 'function') {
		this.properties = properties;
		this.onValidate = fn;
	} else
		this.onValidate = properties;

	return this;
};

SchemaBuilderEntityProto.setPrefix = function(prefix) {
	this.resourcePrefix = prefix;
	return this;
};

SchemaBuilderEntityProto.setResource = function(name) {
	this.resourceName = name;
	return this;
};

/**
 * Set the default values for schema
 * @param {Function(propertyName, isntPreparing, entityName)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.setDefault = function(fn) {
	this.onDefault = fn;
	return this;
};

/**
 * Set the prepare
 * @param {Function(name, value)} fn Must return a new value.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.setPrepare = function(fn) {
	this.onPrepare = fn;
	return this;
};

/**
 * Set save handler
 * @param {Function(error, model, helper, next(value), controller)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.setSave = function(fn, description, filter) {

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}

	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	this.onSave = fn;
	this.meta.save = description || null;
	this.meta.savefilter = filter;
	!fn.$newversion && OBSOLETE('Schema("{0}").setSave()'.format(this.name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.setSaveExtension = function(fn) {
	var key = 'save';
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

/**
 * Set insert handler
 * @param {Function(error, model, helper, next(value), controller)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.setInsert = function(fn, description, filter) {

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}

	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	this.onInsert = fn;
	this.meta.insert = description || null;
	this.meta.insertfilter = filter;
	!fn.$newversion && OBSOLETE('Schema("{0}").setInsert()'.format(this.name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.setInsertExtension = function(fn) {
	var key = 'insert';
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

/**
 * Set update handler
 * @param {Function(error, model, helper, next(value), controller)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.setUpdate = function(fn, description, filter) {

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}

	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	this.onUpdate = fn;
	this.meta.update = description || null;
	this.meta.updatefilter = filter;
	!fn.$newversion && OBSOLETE('Schema("{0}").setUpdate()'.format(this.name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.setUpdateExtension = function(fn) {
	var key = 'update';
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

/**
 * Set patch handler
 * @param {Function(error, model, helper, next(value), controller)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.setPatch = function(fn, description, filter) {

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}
	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	this.onPatch = fn;
	this.meta.patch = description || null;
	this.meta.patchfilter = filter;
	!fn.$newversion && OBSOLETE('Schema("{0}").setPatch()'.format(this.name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.setPatchExtension = function(fn) {
	var key = 'patch';
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

/**
 * Set error handler
 * @param {Function(error)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.setError = function(fn) {
	this.onError = fn;
	return this;
};

/**
 * Set getter handler
 * @param {Function(error, model, helper, next(value), controller)} fn
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.setGet = SchemaBuilderEntityProto.setRead = function(fn, description, filter) {

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}

	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	this.onGet = fn;
	this.meta.get = this.meta.read = description || null;
	this.meta.getfilter = this.meta.readfilter = filter;
	!fn.$newversion && OBSOLETE('Schema("{0}").setGet()'.format(this.name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.setGetExtension = SchemaBuilderEntityProto.setReadExtension = function(fn) {
	var key = 'read';
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

/**
 * Set query handler
 * @param {Function(error, helper, next(value), controller)} fn
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.setQuery = function(fn, description, filter) {

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}

	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	this.onQuery = fn;
	this.meta.query = description || null;
	this.meta.queryfilter = filter;

	!fn.$newversion && OBSOLETE('Schema("{0}").setQuery()'.format(this.name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.setQueryExtension = function(fn) {
	var key = 'query';
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

/**
 * Set remove handler
 * @param {Function(error, helper, next(value), controller)} fn
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.setRemove = function(fn, description, filter) {

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}

	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	this.onRemove = fn;
	this.meta.remove = description || null;
	this.meta.removefilter = filter;
	!fn.$newversion && OBSOLETE('Schema("{0}").setRemove()'.format(this.name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.setRemoveExtension = function(fn) {
	var key = 'remove';
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

/**
 * Add a new constant for the schema
 * @param {String} name Constant name, optional.
 * @param {Object} value
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.constant = function(name, value, description) {

	OBSOLETE('Constants will be removed from schemas.');

	if (value === undefined)
		return this.constants ? this.constants[name] : undefined;

	!this.constants && (this.constants = {});
	this.constants[name] = value;
	this.meta['constant#' + name] = description || null;
	return this;
};

/**
 * Add a new transformation for the entity
 * @param {String} name Transform name, optional.
 * @param {Function(errorBuilder, model, helper, next([output]), controller)} fn
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.addTransform = function(name, fn, description, filter) {

	if (typeof(name) === 'function') {
		fn = name;
		name = 'default';
	}

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}

	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	!this.transforms && (this.transforms = {});
	this.transforms[name] = fn;
	this.meta['transform#' + name] = description || null;
	this.meta['transformfilter#' + name] = filter;
	!fn.$newversion && OBSOLETE('Schema("{0}").addTransform("{1}")'.format(this.name, name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.addTransformExtension = function(name, fn) {
	var key = 'transform.' + name;
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

/**
 * Add a new operation for the entity
 * @param {String} name Operation name, optional.
 * @param {Function(errorBuilder, [model], helper, next([output]), controller)} fn
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.addOperation = function(name, fn, description, filter) {

	if (typeof(name) === 'function') {
		fn = name;
		name = 'default';
	}

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}

	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	!this.operations && (this.operations = {});
	this.operations[name] = fn;
	this.meta['operation#' + name] = description || null;
	this.meta['operationfilter#' + name] = filter;
	!fn.$newversion && OBSOLETE('Schema("{0}").addOperation("{1}")'.format(this.name, name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.addOperationExtension = function(name, fn) {
	var key = 'operation.' + name;
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

/**
 * Add a new workflow for the entity
 * @param {String} name Workflow name, optional.
 * @param {Function(errorBuilder, model, helper, next([output]), controller)} fn
 * @param {String} description Optional.
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.addWorkflow = function(name, fn, description, filter) {

	if (typeof(name) === 'function') {
		fn = name;
		name = 'default';
	}

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}

	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	!this.workflows && (this.workflows = {});
	this.workflows[name] = fn;
	this.meta['workflow#' + name] = description || null;
	this.meta['workflowfilter#' + name] = filter;
	!fn.$newversion && OBSOLETE('Schema("{0}").addWorkflow("{1}")'.format(this.name, name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.addWorkflowExtension = function(name, fn) {
	var key = 'workflow.' + name;
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

SchemaBuilderEntityProto.addHook = function(name, fn, description, filter) {

	if (!this.hooks)
		this.hooks = {};

	if (typeof(description) === 'string' && REGEXP_FILTER.test(description)) {
		filter = description;
		description = null;
	}

	fn.$newversion = REGEXP_NEWOPERATION.test(fn.toString());
	!this.hooks[name] && (this.hooks[name] = []);
	this.hooks[name].push({ owner: F.$owner(), fn: fn });
	this.meta['hook#' + name] = description || null;
	this.meta['hookfilter#' + name] = filter;
	!fn.$newversion && OBSOLETE('Schema("{0}").addHook("{1}")'.format(this.name, name), MSG_OBSOLETE_NEW);
	return this;
};

SchemaBuilderEntityProto.addHookExtension = function(name, fn) {
	var key = 'hook.' + name;
	if (this.extensions[key])
		this.extensions[key].push(fn);
	else
		this.extensions[key] = [fn];
	return this;
};

/**
 * Find an entity in current group
 * @param {String} name
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.find = function(name) {
	return this.parent.get(name);
};

/**
 * Destroys current entity
 */
SchemaBuilderEntityProto.destroy = function() {
	delete this.parent.collection[this.name];
	delete this.properties;
	delete this.schema;
	delete this.onDefault;
	delete this.$onDefault;
	delete this.onValidate;
	delete this.onSave;
	delete this.onInsert;
	delete this.onUpdate;
	delete this.onRead;
	delete this.onGet;
	delete this.onRemove;
	delete this.onQuery;
	delete this.workflows;
	delete this.operations;
	delete this.transforms;
	delete this.meta;
	delete this.newversion;
	delete this.properties;
	delete this.hooks;
	delete this.constants;
	delete this.onPrepare;
	delete this.$onPrepare;
	delete this.onError;
	delete this.gcache;
	delete this.dependencies;
	delete this.fields;
	delete this.fields_allow;
};

/**
 * Execute onSave delegate
 * @param {Object} model
 * @param {Object} options Custom options object, optional
 * @param {Function(err, result)} callback
 * @param {Controller} controller
 * @param {Boolean} skip Skips preparing and validation, optional
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.save = function(model, options, callback, controller, skip) {
	return this.execute('onSave', model, options, callback, controller, skip);
};

/**
 * Execute onInsert delegate
 * @param {Object} model
 * @param {Object} options Custom options object, optional
 * @param {Function(err, result)} callback
 * @param {Controller} controller
 * @param {Boolean} skip Skips preparing and validation, optional
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.insert = function(model, options, callback, controller, skip) {
	return this.execute('onInsert', model, options, callback, controller, skip);
};

/**
 * Execute onUpdate delegate
 * @param {Object} model
 * @param {Object} options Custom options object, optional
 * @param {Function(err, result)} callback
 * @param {Controller} controller
 * @param {Boolean} skip Skips preparing and validation, optional
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.update = function(model, options, callback, controller, skip) {
	return this.execute('onUpdate', model, options, callback, controller, skip);
};

SchemaBuilderEntityProto.patch = function(model, options, callback, controller, skip) {
	return this.execute('onPatch', model, options, callback, controller, skip);
};

SchemaBuilderEntityProto.execute = function(TYPE, model, options, callback, controller, skip) {

	if (typeof(callback) === 'boolean') {
		skip = callback;
		callback = options;
		options = undefined;
	} else if (typeof(options) === 'function') {
		callback = options;
		options = undefined;
	}

	if (typeof(controller) === 'boolean') {
		var tmp = skip;
		skip = controller;
		controller = tmp;
	}

	if (typeof(callback) !== 'function')
		callback = function(){};

	var self = this;
	var $type;

	switch (TYPE) {
		case 'onInsert':
			$type = 'insert';
			break;
		case 'onUpdate':
			$type = 'update';
			break;
		case 'onPatch':
			$type = 'patch';
			break;
		default:
			$type = 'save';
			break;
	}

	if (!self[TYPE])
		return callback(new Error('Operation "{0}/{1}" not found'.format(self.name, $type)));

	self.$prepare(model, function(err, model) {

		if (err) {
			callback(err, model);
			return;
		}

		if (controller instanceof SchemaOptions || controller instanceof OperationOptions)
			controller = controller.controller;

		if (model && !controller && model.$$controller)
			controller = model.$$controller;

		var builder = new ErrorBuilder();
		var $now;

		if (CONF.logger)
			$now = Date.now();

		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

		if (!isGenerator(self, $type, self[TYPE])) {
			if (self[TYPE].$newversion) {
				var opt = new SchemaOptions(builder, model, options, function(res) {
					CONF.logger && F.ilogger(self.getLoggerName($type), controller, $now);
					self.$process(arguments, model, $type, undefined, builder, res, callback, controller);
				}, controller, $type, self);

				if (self.middlewares && self.middlewares.length)
					runmiddleware(opt, self, self[TYPE]);
				else
					self[TYPE](opt);

			} else
				self[TYPE](builder, model, options, function(res) {
					CONF.logger && F.ilogger(self.getLoggerName($type), controller, $now);
					self.$process(arguments, model, $type, undefined, builder, res, callback, controller);
				}, controller, skip !== true);
			return self;
		}

		callback.success = false;

		var onError = function(err) {
			if (!err || callback.success)
				return;

			callback.success = true;

			if (builder !== err)
				builder.push(err);

			self.onError && self.onError(builder, model, $type);
			callback(builder);
		};

		var onCallback = function(res) {

			CONF.logger && F.ilogger(self.getLoggerName($type, name), controller, $now);

			if (callback.success)
				return;

			if (arguments.length === 2 || (res instanceof Error || res instanceof ErrorBuilder)) {
				if ((res instanceof Error || res instanceof ErrorBuilder) && builder !== res)
					builder.push(res);
				res = arguments[1];
			}

			var has = builder.is;
			has && self.onError && self.onError(builder, model, $type);
			callback.success = true;
			callback(has ? builder : null, res === undefined ? model : res);
		};

		if (self[TYPE].$newversion) {
			var opt = new SchemaOptions(builder, model, options, onCallback, controller, $type, self);
			if (self.middlewares && self.middlewares.length)
				runmiddleware(opt, self, () => async.call(self, self[TYPE])(onError, opt));
			else
				async.call(self, self[TYPE])(onError, opt);
		} else
			async.call(self, self[TYPE])(onError, builder, model, options, onCallback, controller, skip !== true);

	}, controller ? controller.req : null);

	return self;
};


function isGenerator(obj, name, fn) {
	return obj.gcache[name] ? obj.gcache[name] : obj.gcache[name] = fn.toString().substring(0, 9) === 'function*';
}

/**
 * Execute onGet delegate
 * @param {Object} options Custom options object, optional
 * @param {Function(err, result)} callback
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.get = SchemaBuilderEntityProto.read = function(options, callback, controller) {

	if (typeof(options) === 'function') {
		callback = options;
		options = undefined;
	}

	if (typeof(callback) !== 'function')
		callback = function(){};

	var self = this;
	var builder = new ErrorBuilder();
	var $now;

	self.resourceName && builder.setResource(self.resourceName);
	self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

	if (controller instanceof SchemaOptions || controller instanceof OperationOptions)
		controller = controller.controller;

	if (self.meta.getfilter && controller) {
		controller.$filterschema = self.meta.getfilter;
		controller.$filter = null;
	}

	if (CONF.logger)
		$now = Date.now();

	var output = self.default();
	var $type = 'get';

	if (!isGenerator(self, $type, self.onGet)) {
		if (self.onGet.$newversion) {
			var opt = new SchemaOptions(builder, output, options, function(res) {
				CONF.logger && F.ilogger(self.getLoggerName($type), controller, $now);
				self.$process(arguments, output, $type, undefined, builder, res, callback, controller);
			}, controller, $type, self);

			if (self.middlewares && self.middlewares.length)
				runmiddleware(opt, self, self.onGet);
			else
				self.onGet(opt);
		} else
			self.onGet(builder, output, options, function(res) {
				CONF.logger && F.ilogger(self.getLoggerName($type), controller, $now);
				self.$process(arguments, output, $type, undefined, builder, res, callback, controller);
			}, controller);
		return self;
	}

	callback.success = false;

	var onError = function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;

		if (builder !== err)
			builder.push(err);

		self.onError && self.onError(builder, output, $type);
		callback(builder);
	};

	var onCallback = function(res) {

		CONF.logger && F.ilogger(self.getLoggerName($type), controller, $now);

		if (callback.success)
			return;

		if (arguments.length === 2 || (res instanceof Error || res instanceof ErrorBuilder)) {
			if ((res instanceof Error || res instanceof ErrorBuilder) && builder !== res)
				builder.push(res);
			res = arguments[1];
		}

		callback.success = true;
		var has = builder.is;
		has && self.onError && self.onError(builder, output, $type);
		callback(has ? builder : null, res === undefined ? output : res);
	};

	if (self.onGet.$newversion) {
		var opt = new SchemaOptions(builder, output, options, onCallback, controller, $type, self);
		if (self.middlewares && self.middlewares.length)
			runmiddleware(opt, self, () => async.call(self, self.onGet)(onError, opt));
		else
			async.call(self, self.onGet)(onError, opt);
	} else
		async.call(self, self.onGet)(onError, builder, output, options, onCallback, controller);

	return self;
};

/**
 * Execute onRemove delegate
 * @param {Object} options Custom options object, optional
 * @param {Function(err, result)} callback
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.remove = function(options, callback, controller) {

	if (typeof(options) === 'function') {
		callback = options;
		options = undefined;
	}

	var self = this;
	var builder = new ErrorBuilder();
	var $type = 'remove';
	var $now;

	if (!self.onRemove)
		return callback(new Error('Operation "{0}/{1}" not found'.format(self.name, $type)));

	if (controller instanceof SchemaOptions || controller instanceof OperationOptions)
		controller = controller.controller;

	if (self.meta.removefilter && controller) {
		controller.$filterschema = self.meta.removefilter;
		controller.$filter = null;
	}

	if (CONF.logger)
		$now = Date.now();

	self.resourceName && builder.setResource(self.resourceName);
	self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

	if (!isGenerator(self, $type, self.onRemove)) {
		if (self.onRemove.$newversion) {

			var opt = new SchemaOptions(builder, controller ? controller.body : undefined, options, function(res) {
				CONF.logger && F.ilogger(self.getLoggerName($type), controller, $now);
				self.$process(arguments, undefined, $type, undefined, builder, res, callback, controller);
			}, controller, $type, self);

			if (self.middlewares && self.middlewares.length)
				runmiddleware(opt, self, self.onRemove);
			else
				self.onRemove(opt);
		} else
			self.onRemove(builder, options, function(res) {
				CONF.logger && F.ilogger(self.getLoggerName($type), controller, $now);
				self.$process(arguments, undefined, $type, undefined, builder, res, callback, controller);
			}, controller);
		return self;
	}

	callback.success = false;

	var onError = function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;

		if (builder !== err)
			builder.push(err);

		self.onError && self.onError(builder, EMPTYOBJECT, $type);
		callback(builder);
	};

	var onCallback = function(res) {

		CONF.logger && F.ilogger(self.getLoggerName($type, name), controller, $now);

		if (callback.success)
			return;

		if (arguments.length === 2 || (res instanceof Error || res instanceof ErrorBuilder)) {
			if ((res instanceof Error || res instanceof ErrorBuilder) && builder !== res)
				builder.push(res);
			res = arguments[1];
		}

		var has = builder.is;
		has && self.onError && self.onError(builder, EMPTYOBJECT, $type);
		callback.success = true;
		callback(has ? builder : null, res === undefined ? options : res);
	};

	if (self.onRemove.$newversion) {
		var opt = new SchemaOptions(builder, undefined, options, onCallback, controller, $type, self);
		if (self.middlewares && self.middlewares.length)
			runmiddleware(opt, self, () => async.call(self, self.onRemove)(onError, opt));
		else
			async.call(self, self.onRemove)(onError, opt);
	} else
		async.call(self, self.onRemove)(onError, builder, options, onCallback, controller);

	return self;
};

/**
 * Execute onQuery delegate
 * @param {Object} options Custom options object, optional
 * @param {Function(err, result)} callback
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.query = function(options, callback, controller) {

	if (typeof(options) === 'function') {
		callback = options;
		options = undefined;
	}

	if (controller instanceof SchemaOptions || controller instanceof OperationOptions)
		controller = controller.controller;

	var self = this;
	var builder = new ErrorBuilder();
	var $type = 'query';
	var $now;

	if (self.meta.queryfilter && controller) {
		controller.$filterschema = self.meta.queryfilter;
		controller.$filter = null;
	}

	self.resourceName && builder.setResource(self.resourceName);
	self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

	if (CONF.logger)
		$now = Date.now();

	if (!isGenerator(self, $type, self.onQuery)) {
		if (self.onQuery.$newversion) {
			var opt = new SchemaOptions(builder, undefined, options, function(res) {
				CONF.logger && F.ilogger(self.getLoggerName($type), controller, $now);
				self.$process(arguments, undefined, $type, undefined, builder, res, callback, controller);
			}, controller, $type, self);

			if (self.middlewares && self.middlewares.length)
				runmiddleware(opt, self, self.onQuery);
			else
				self.onQuery(opt);

		} else
			self.onQuery(builder, options, function(res) {
				CONF.logger && F.ilogger(self.getLoggerName($type), controller, $now);
				self.$process(arguments, undefined, $type, undefined, builder, res, callback, controller);
			}, controller);
		return self;
	}

	callback.success = false;

	var onError = function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;

		if (builder !== err)
			builder.push(err);

		self.onError && self.onError(builder, EMPTYOBJECT, $type);
		callback(builder);
	};

	var onCallback = function(res) {

		CONF.logger && F.ilogger(self.getLoggerName($type), controller, $now);

		if (callback.success)
			return;

		if (arguments.length === 2 || (res instanceof Error || res instanceof ErrorBuilder)) {
			if ((res instanceof Error || res instanceof ErrorBuilder) && builder !== res)
				builder.push(res);
			res = arguments[1];
		}

		var has = builder.is;
		has && self.onError && self.onError(builder, EMPTYOBJECT, $type);
		callback.success = true;
		callback(builder.is ? builder : null, res);
	};

	if (self.onQuery.$newversion) {
		var opt = new SchemaOptions(builder, undefined, options, onCallback, controller, $type, self);
		if (self.middlewares && self.middlewares.length)
			runmiddleware(opt, self, () => async.call(self, self.onQuery)(onError, opt));
		else
			async.call(self, self.onQuery)(onError, opt);
	} else
		async.call(self, self.onQuery)(onError, builder, options, onCallback, controller);

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
SchemaBuilderEntityProto.validate = function(model, resourcePrefix, resourceName, builder, filter, path, index) {

	var self = this;

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

	framework_utils.validate_builder.call(self, model, builder, self, '', index, filter, path);
	return builder;
};

/**
 * Create a default object according the schema
 * @alias SchemaBuilderEntity.default()
 * @return {Object}
 */
SchemaBuilderEntityProto.create = function() {
	return this.default();
};

SchemaBuilderEntityProto.Create = function() {
	return this.default();
};

/**
 * Makes extensible object
 * @param {Object} obj
 * @return {Object}
 */
SchemaBuilderEntityProto.$make = function(obj) {
	return obj;
};

SchemaBuilderEntityProto.$prepare = function(obj, callback) {
	if (obj && typeof(obj.$save) === 'function')
		callback(null, obj);
	else
		this.make(obj, (err, model) => callback(err, model));
	return this;
};

/**
 * Create a default object according the schema
 * @return {SchemaInstance}
 */
SchemaBuilderEntityProto.default = function() {

	var obj = this.schema;
	if (obj === null)
		return null;

	var item = new this.CurrentSchemaInstance();
	var defaults = this.onDefault || this.$onDefault ? true : false;

	for (var property in obj) {

		var type = obj[property];

		if (defaults) {
			var def = this.$ondefault(property, true, this.name);
			if (def !== undefined) {
				item[property] = def;
				continue;
			}
		}

		if (type.def !== undefined) {
			item[property] = typeof(type.def) === 'function' ? type.def() : type.def;
			continue;
		}

		switch (type.type) {
			// undefined
			// object
			// object: convertor
			case 0:
			case 6:
			case 12:
				item[property] = type.isArray ? [] : null;
				break;
			// numbers: integer, float
			case 1:
			case 2:
				item[property] = type.isArray ? [] : 0;
				break;
			// numbers: default "null"
			case 10:
				item[property] = type.isArray ? [] : null;
				break;
			// string
			case 3:
				item[property] = type.isArray ? [] : type.subtype === 'email' ? '@' : '';
				break;
			// boolean
			case 4:
				item[property] = type.isArray ? [] : false;
				break;
			// date
			case 5:
				item[property] = type.isArray ? [] : NOW;
				break;
			// schema
			case 7:

				if (type.isArray) {
					item[property] = [];
				} else {
					var tmp = this.parent.collection[type.raw] || GETSCHEMA(type.raw);
					if (tmp) {
						item[property] = tmp.default();
					} else {
						F.error(new Error('Schema: "' + property + '.' + type.raw + '" not found in "' + this.parent.name + '".'));
						item[property] = null;
					}
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

function SchemaOptionsVerify(controller, builder) {
	var t = this;
	t.controller = (controller instanceof SchemaOptions || controller instanceof OperationOptions) ? controller.controller : controller;
	t.callback = t.next = t.success = function(value) {
		if (value !== undefined)
			t.model[t.name] = value;
		t.cache && CACHE(t.cachekey, { value: t.model[t.name] }, t.cache);
		t.$next();
	};
	t.invalid = function(err) {
		if (err) {
			builder.push(err);
			t.cache && CACHE(t.cachekey, { error: err }, t.cache);
		}
		t.model[t.name] = null;
		t.$next();
	};
}

SchemaOptionsVerify.prototype = {

	get user() {
		return this.controller ? this.controller.user : null;
	},

	get session() {
		return this.controller ? this.controller.session : null;
	},

	get sessionid() {
		return this.controller && this.controller ? this.controller.req.sessionid : null;
	},

	get language() {
		return (this.controller ? this.controller.language : '') || '';
	},

	get ip() {
		return this.controller ? this.controller.ip : null;
	},

	get id() {
		return this.controller ? this.controller.id : null;
	},

	get req() {
		return this.controller ? this.controller.req : null;
	},

	get res() {
		return this.controller ? this.controller.res : null;
	},

	get params() {
		return this.controller ? this.controller.params : null;
	},

	get files() {
		return this.controller ? this.controller.files : null;
	},

	get body() {
		return this.controller ? this.controller.body : null;
	},

	get query() {
		return this.controller ? this.controller.query : null;
	},

	get headers() {
		return this.controller && this.controller.req ? this.controller.req.headers : null;
	},

	get ua() {
		return this.controller && this.controller.req ? this.controller.req.ua : null;
	}
};

/**
 * Create schema instance
 * @param {function|object} model
 * @param [filter]
 * @param [callback]
 * @returns {SchemaInstance}
 */
SchemaBuilderEntityProto.make = function(model, filter, callback, argument, novalidate, workflow, req) {

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

	var verifications = [];
	var output = self.prepare(model, null, req, verifications);

	if (workflow)
		output.$$workflow = workflow;

	if (novalidate) {
		callback && callback(null, output, argument);
		return output;
	}

	var builder = self.validate(output, undefined, undefined, undefined, filter);

	if (builder.is) {
		self.onError && self.onError(builder, model, 'make');
		callback && callback(builder, null, argument);
		return output;
	} else {

		if (self.verifications)
			verifications.unshift({ model: output, entity: self });

		if (!verifications.length) {
			callback && callback(null, output, argument);
			return output;
		}

		var options = new SchemaOptionsVerify(req, builder);

		verifications.wait(function(item, next) {

			item.entity.verifications.wait(function(verify, resume) {

				options.value = item.model[verify.name];

				// Empty values are skipped
				if (options.value == null || options.value === '') {
					resume();
					return;
				}

				var cachekey = verify.cachekey;

				if (cachekey) {
					cachekey += options.value + '';
					var cachevalue = F.cache.get2(cachekey);
					if (cachevalue) {
						if (cachevalue.error)
							builder.push(cachevalue.error);
						else
							item.model[verify.name] = cachevalue.value;
						resume();
						return;
					}
				}

				options.cache = verify.cache;
				options.cachekey = cachekey;
				options.entity = item.entity;
				options.model = item.model;
				options.name = verify.name;
				options.$next = resume;
				verify.fn(options);

			}, next, 3); // "3" means count of imaginary "threads" - we will see how it will work

		}, function() {
			if (builder.is) {
				self.onError && self.onError(builder, model, 'make');
				callback && callback(builder, null, argument);
			} else
				callback && callback(null, output, argument);
		});

	}
};

SchemaBuilderEntityProto.load = SchemaBuilderEntityProto.make; // Because JSDoc doesn't work with double asserting

function autotrim(context, value) {
	return context.trim ? value.trim() : value;
}

SchemaBuilderEntityProto.$onprepare = function(name, value, index, model, req) {

	var val = value;

	if (this.$onPrepare) {
		for (var i = 0, length = this.$onPrepare.length; i < length; i++) {
			var tmp = this.$onPrepare[i](name, val, index, model, req);
			if (tmp !== undefined)
				val = tmp;
		}
	}

	if (this.onPrepare)
		val = this.onPrepare(name, val, index, model, req);

	if (this.preparation && this.preparation[name])
		val = this.preparation[name](val, model, index, req);

	return val === undefined ? value : val;
};

SchemaBuilderEntityProto.$ondefault = function(property, create, entity) {

	var val;

	if (this.onDefault) {
		val = this.onDefault(property, create, entity);
		if (val !== undefined)
			return val;
	}

	if (this.$onDefault) {
		for (var i = 0, length = this.$onDefault.length; i < length; i++) {
			val = this.$onDefault[i](property, create, entity);
			if (val !== undefined)
				return val;
		}
	}
};

/**
 * Prepare model according to schema
 * @param {Object} model
 * @param {String|Array} [dependencies] INTERNAL.
 * @return {SchemaInstance}
 */
SchemaBuilderEntityProto.prepare = function(model, dependencies, req, verifications) {

	var self = this;
	var obj = self.schema;

	if (obj === null)
		return null;

	if (model == null)
		return self.default();

	var tmp;
	var entity;
	var item = new self.CurrentSchemaInstance();
	var defaults = self.onDefault || self.$onDefault ? true : false;
	var keys = req && req.$patch ? [] : null;

	for (var property in obj) {

		var val = model[property];

		if (req && req.$patch && val === undefined) {
			delete item[property];
			continue;
		}

		var type = obj[property];
		keys && keys.push(property);

		// IS PROTOTYPE? The problem was in e.g. "search" property, because search is in String prototypes.
		if (!hasOwnProperty.call(model, property))
			val = undefined;

		var def = type.def && typeof(type.def) === 'function';

		if (val === undefined) {
			if (type.def !== undefined)
				val = def ? type.def() : type.def;
			else if (defaults)
				val = self.$ondefault(property, false, self.name);
		}

		if (val === undefined)
			val = '';

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
					item[property] = self.$onprepare(property, framework_utils.parseInt(val, def ? type.def() : type.def), undefined, model, req);
					break;
				// number: float
				case 2:
					item[property] = self.$onprepare(property, framework_utils.parseFloat(val, def ? type.def() : type.def), undefined, model, req);
					break;

				// string
				case 3:

					var tv = typeof(val);

					if (val == null || tv === 'object')
						tmp = '';
					else if (tv === 'string')
						tmp = autotrim(self, val);
					else
						tmp = autotrim(self, val.toString());

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
							tmp = tmp.replace(REGEXP_CLEAN_EMAIL, '');
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
						case 'capitalize2':
							tmp = tmp.capitalize(true);
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
						case 'base64':
							if (tmp && !type.required && !tmp.isBase64())
								tmp = '';
							break;
					}

					if (!tmp && type.def !== undefined)
						tmp = def ? type.def() : type.def;

					item[property] = self.$onprepare(property, tmp, undefined, model, req);
					break;

				// boolean
				case 4:
					tmp = val ? val.toString().toLowerCase() : null;
					if (type.def && (tmp == null || tmp === ''))
						tmp = def ? type.def() : type.def;
					item[property] = self.$onprepare(property, typeof(tmp) === 'string' ? !!BOOL[tmp] : tmp == null ? false : tmp, undefined, model, req);
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
						tmp = self.$onprepare(property, tmp, undefined, model, req);
					else {
						if (type.def !== undefined)
							tmp = def ? type.def() : type.def;
						else
							tmp = (defaults ? isUndefined(self.$ondefault(property, false, self.name), null) : null);
					}

					item[property] = tmp;
					break;

				// object
				case 6:
					// item[property] = self.$onprepare(property, model[property], undefined, model, req);
					item[property] = self.$onprepare(property, val, undefined, model, req);
					if (item[property] === undefined)
						item[property] = null;
					break;

				// enum
				case 8:
					// tmp = self.$onprepare(property, model[property], undefined, model, req);
					tmp = self.$onprepare(property, val, undefined, model, req);
					if (type.subtype === 'number' && typeof(tmp) === 'string')
						tmp = tmp.parseFloat(null);
					item[property] = tmp != null && type.raw.indexOf(tmp) !== -1 ? tmp : undefined;
					if (item[property] == null && type.def)
						item[property] = type.def;
					break;

				// keyvalue
				case 9:
					// tmp = self.$onprepare(property, model[property], undefined, model, req);
					tmp = self.$onprepare(property, val, undefined, model, req);
					item[property] = tmp != null ? type.raw[tmp] : undefined;
					if (item[property] == null && type.def)
						item[property] = type.def;
					break;

				// schema
				case 7:

					if (!val) {
						val = (type.def === undefined ? defaults ? isUndefined(self.$ondefault(property, false, self.name), null) : null : (def ? type.def() : type.def));
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

					entity = GETSCHEMA(type.raw);
					if (entity) {

						item[property] = entity.prepare(val, undefined, req, verifications);
						item[property].$$parent = item;
						item[property].$$controller = req;

						if (entity.verifications)
							verifications.push({ model: item[property], entity: entity });

						dependencies && dependencies.push({ name: type.raw, value: self.$onprepare(property, item[property], undefined, model, req) });
					} else
						item[property] = null;

					break;

				case 10:
					item[property] = type.raw(val == null ? '' : val.toString());
					if (item[property] === undefined)
						item[property] = null;
					break;

				// number: nullable
				case 11:
					item[property] = self.$onprepare(property, typeval === 'number' ? val : typeval === 'string' ? parseNumber(val) : null, undefined, model, req);
					break;

				// object: convertor
				case 12:
					item[property] = self.$onprepare(property, val && typeval === 'object' && !(val instanceof Array) ? CONVERT(val, type.raw) : null, undefined, model, req);
					break;

			}
			continue;
		}

		// ARRAY:
		if (!(val instanceof Array)) {
			item[property] = (type.def === undefined ? defaults ? isUndefined(self.$ondefault(property, false, self.name), EMPTYARRAY) : [] : (def ? type.def() : type.def));
			continue;
		}

		item[property] = [];
		for (var j = 0, sublength = val.length; j < sublength; j++) {

			// tmp = model[property][j];
			tmp = val[j];
			typeval = typeof(tmp);

			switch (type.type) {
				case 0:
					tmp = self.$onprepare(property, tmp, j, model, req);
					break;

				case 1:
					tmp = self.$onprepare(property, framework_utils.parseInt(tmp), j, model, req);
					break;

				case 2:
					tmp = self.$onprepare(property, framework_utils.parseFloat(tmp), j, model, req);
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
						case 'capitalize2':
							tmp = tmp.capitalize(true);
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
						case 'base64':
							if (tmp && !type.required && !tmp.isBase64())
								continue;
							break;
					}

					tmp = self.$onprepare(property, tmp, j, model, req);
					break;

				case 4:
					if (tmp)
						tmp = tmp.toString().toLowerCase();
					tmp = self.$onprepare(property, BOOL[tmp], j, model, req);
					break;

				case 5:

					if (typeval === 'string') {
						if (tmp)
							tmp = tmp.trim().parseDate();
					} else if (typeval === 'number')
						tmp = new Date(tmp);

					if (framework_utils.isDate(tmp))
						tmp = self.$onprepare(property, tmp, j, model, req);
					else
						tmp = undefined;

					break;

				case 6:
					tmp = self.$onprepare(property, tmp, j, model, req);
					break;

				case 7:

					entity = self.parent.collection[type.raw] || GETSCHEMA(type.raw);

					if (entity) {
						tmp = entity.prepare(tmp, dependencies, req, verifications);
						tmp.$$parent = item;
						tmp.$$controller = req;
						dependencies && dependencies.push({ name: type.raw, value: self.$onprepare(property, tmp, j, model, req) });
					} else
						throw new Error('Schema "{0}" not found'.format(type.raw));

					tmp = self.$onprepare(property, tmp, j, model, req);

					if (entity.verifications && tmp)
						verifications.push({ model: tmp, entity: entity });

					break;

				case 11:
					tmp = self.$onprepare(property, typeval === 'number' ? tmp : typeval === 'string' ? parseNumber(tmp) : null, j, model, req);
					if (tmp == null)
						continue;
					break;

				case 12:
					tmp = self.$onprepare(property, tmp ? CONVERT(tmp, type.raw) : null, j, model, req);
					if (tmp == null)
						continue;
					break;
			}

			if (tmp !== undefined)
				item[property].push(tmp);
		}
	}

	if (self.fields_allow) {
		for (var i = 0, length = self.fields_allow.length; i < length; i++) {
			var name = self.fields_allow[i];
			var val = model[name];
			if (val !== undefined) {
				item[name] = val;
				keys && keys.push(name);
			}
		}
	}

	if (keys)
		item.$$keys = keys;

	return item;
};

function parseNumber(str) {
	if (!str)
		return null;
	if (str.indexOf(',') !== -1)
		str = str.replace(',', '.');
	var num = +str;
	return isNaN(num) ? null : num;
}

/**
 * Transform an object
 * @param {String} name
 * @param {Object} model
 * @param {Object} options Custom options object, optional.
 * @param {Function(errorBuilder, output, model)} callback
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @param {Object} controller Optional
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.transform = function(name, model, options, callback, skip, controller) {
	return this.$execute('transform', name, model, options, callback, skip, controller);
};

SchemaBuilderEntityProto.transform2 = function(name, options, callback, controller) {

	if (typeof(options) === 'function') {
		controller = callback;
		callback = options;
		options = undefined;
	}

	!callback && (callback = function(){});
	return this.transform(name, this.create(), options, callback, true, controller);
};

SchemaBuilderEntityProto.$process = function(arg, model, type, name, builder, response, callback, controller) {

	var self = this;

	if (arg.length > 1 || (response instanceof Error || response instanceof ErrorBuilder)) {
		if ((response instanceof Error || response instanceof ErrorBuilder || typeof(response) === 'string') && builder !== response)
			builder.push(response);
		response = arg[1];
	}

	var has = builder.is;
	has && self.onError && self.onError(builder, model, type, name);

	if (response !== NoOp) {
		if (controller && response instanceof SchemaInstance && !response.$$controller)
			response.$$controller = controller;
		callback(has ? builder : null, response === undefined ? model : response, model);
	} else
		callback = null;

	return self;
};

SchemaBuilderEntityProto.$process_hook = function(model, type, name, builder, result, callback) {
	var self = this;
	var has = builder.is;
	has && self.onError && self.onError(builder, model, type, name);
	callback(has ? builder : null, model, result);
	return self;
};

/**
 * Run a workflow
 * @param {String} name
 * @param {Object} model
 * @param {Object} options Custom options object, optional.
 * @param {Function(errorBuilder, output, model)} callback
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @param {Object} controller Optional
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.workflow = function(name, model, options, callback, skip, controller) {
	return this.$execute('workflow', name, model, options, callback, skip, controller);
};

SchemaBuilderEntityProto.workflow2 = function(name, options, callback, controller) {

	if (typeof(options) === 'function') {
		controller = callback;
		callback = options;
		options = undefined;
	}

	!callback && (callback = function(){});
	return this.workflow(name, this.create(), options, callback, true, controller);
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
SchemaBuilderEntityProto.hook = function(name, model, options, callback, skip, controller) {

	var self = this;

	if (typeof(name) !== 'string') {
		callback = options;
		options = model;
		model = name;
		name = 'default';
	}

	if (typeof(callback) === 'boolean') {
		skip = callback;
		callback = options;
		options = undefined;
	} else if (typeof(options) === 'function') {
		callback = options;
		options = undefined;
	}

	if (typeof(callback) !== 'function')
		callback = function(){};

	var hook = self.hooks ? self.hooks[name] : undefined;

	if (!hook || !hook.length) {
		callback(null, model, EMPTYARRAY);
		return self;
	}

	if (controller instanceof SchemaOptions || controller instanceof OperationOptions)
		controller = controller.controller;

	if (model && !controller && model.$$controller)
		controller = model.$$controller;

	var $type = 'hook';

	if (skip === true || model instanceof SchemaInstance) {

		var builder = new ErrorBuilder();
		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

		var output = [];
		var $now;

		if (CONF.logger)
			$now = Date.now();

		async_wait(hook, function(item, next) {
			if (item.fn.$newversion) {

				var opt = new SchemaOptions(builder, model, options, function(result) {
					output.push(result == undefined ? model : result);
					next();
				}, controller, 'hook.' + name, self);

				if (self.middlewares && self.middlewares.length)
					runmiddleware(opt, self, item.fn);
				else
					item.fn.call(self, opt);

			} else
				item.fn.call(self, builder, model, options, function(result) {
					output.push(result == undefined ? model : result);
					next();
				}, controller, skip !== true);
		}, function() {
			CONF.logger && F.ilogger(self.getLoggerName($type, name), controller, $now);
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
		var $now;

		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

		if (CONF.logger)
			$now = Date.now();

		async_wait(hook, function(item, next, index) {

			if (!isGenerator(self, 'hook.' + name + '.' + index, item.fn)) {
				if (item.fn.$newversion) {
					item.fn.call(self, new SchemaOptions(builder, model, options, function(res) {
						CONF.logger && F.ilogger(self.getLoggerName($type, name), controller, $now);
						output.push(res === undefined ? model : res);
						next();
					}, controller, 'hook.' + name, self));
				} else {
					item.fn.call(self, builder, model, options, function(res) {
						CONF.logger && F.ilogger(self.getLoggerName($type, name), controller, $now);
						output.push(res === undefined ? model : res);
						next();
					}, controller, skip !== true);
				}
				return;
			}

			callback.success = false;

			if (item.fn.$newversion) {
				var opt = new SchemaOptions(builder, model, options, function(res) {
					CONF.logger && F.ilogger(self.getLoggerName($type, name), controller, $now);
					output.push(res == undefined ? model : res);
					next();
				}, controller, 'hook.' + name, self);

				async.call(self, item.fn)(function(err) {
					if (!err)
						return;
					if (builder !== err)
						builder.push(err);
					next();
				}, opt);

			} else {
				async.call(self, item.fn)(function(err) {
					if (!err)
						return;
					if (builder !== err)
						builder.push(err);
					next();
				}, builder, model, options, function(res) {
					CONF.logger && F.ilogger(self.getLoggerName($type, name), controller, $now);
					output.push(res == undefined ? model : res);
					next();
				}, controller, skip !== true);
			}

		}, () => self.$process_hook(model, $type, name, builder, output, callback), 0);
	}, controller ? controller.req : null);

	return self;
};

SchemaBuilderEntityProto.hook2 = function(name, options, callback, controller) {

	if (typeof(options) === 'function') {
		controller = callback;
		callback = options;
		options = undefined;
	}

	if (!callback)
		callback = function(){};

	return this.hook(name, this.create(), options, callback, true, controller);
};

SchemaBuilderEntityProto.$execute = function(type, name, model, options, callback, skip, controller) {
	var self = this;

	if (typeof(name) !== 'string') {
		callback = options;
		options = model;
		model = name;
		name = 'default';
	}

	if (typeof(callback) === 'boolean') {
		skip = callback;
		callback = options;
		options = undefined;
	} else if (typeof(options) === 'function') {
		callback = options;
		options = undefined;
	}

	if (typeof(callback) !== 'function')
		callback = function(){};

	var ref = self[type + 's'];
	var item = ref ? ref[name] : undefined;
	var $now;

	if (!item) {
		callback(new ErrorBuilder().push('', type.capitalize() + ' "{0}" not found.'.format(name)));
		return self;
	}

	if (CONF.logger)
		$now = Date.now();

	if (controller instanceof SchemaOptions || controller instanceof OperationOptions)
		controller = controller.controller;

	if (model && !controller && model.$$controller)
		controller = model.$$controller;

	var opfilter = self.meta[type + 'filter#' + name];
	if (opfilter && controller) {
		controller.$filterschema = opfilter;
		controller.$filter = null;
	}

	var key = type + '.' + name;

	if (skip === true || model instanceof SchemaInstance) {
		var builder = new ErrorBuilder();
		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);
		if (item.$newversion) {

			var opt = new SchemaOptions(builder, model, options, function(res) {
				CONF.logger && F.ilogger(self.getLoggerName(type, name), controller, $now);
				self.$process(arguments, model, type, name, builder, res, callback, controller);
			}, controller, key, self);

			if (self.middlewares && self.middlewares.length)
				runmiddleware(opt, self, item);
			else
				item.call(self, opt);

		} else
			item.call(self, builder, model, options, function(res) {
				CONF.logger && F.ilogger(self.getLoggerName(type, name), controller, $now);
				self.$process(arguments, model, type, name, builder, res, callback, controller);
			}, controller, skip !== true);
		return self;
	}

	self.$prepare(model, function(err, model) {

		if (err) {
			callback(err, model);
			return;
		}

		if (controller && model instanceof SchemaInstance && !model.$$controller)
			model.$$controller = controller;

		var builder = new ErrorBuilder();

		self.resourceName && builder.setResource(self.resourceName);
		self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

		var key = type + '.' + name;

		if (!isGenerator(self, key, item)) {
			if (item.$newversion) {
				var opt = new SchemaOptions(builder, model, options, function(res) {
					CONF.logger && F.ilogger(self.getLoggerName(type, name), controller, $now);
					self.$process(arguments, model, type, name, builder, res, callback, controller);
				}, controller, key, self);

				if (self.middlewares && self.middlewares.length)
					runmiddleware(opt, self, item);
				else
					item.call(self, opt);

			} else
				item.call(self, builder, model, options, function(res) {
					CONF.logger && F.ilogger(self.getLoggerName(type, name), controller, $now);
					self.$process(arguments, model, type, name, builder, res, callback, controller);
				}, controller);
			return;
		}

		callback.success = false;

		var onError = function(err) {
			if (!err || callback.success)
				return;
			callback.success = true;
			if (builder !== err)
				builder.push(err);
			self.onError && self.onError(builder, model, type, name);
			callback(builder);
		};

		var onCallback = function(res) {

			CONF.logger && F.ilogger(self.getLoggerName(type, name), controller, $now);

			if (callback.success)
				return;

			if (arguments.length === 2 || (res instanceof Error || res instanceof ErrorBuilder)) {
				if ((res instanceof Error || res instanceof ErrorBuilder) && builder !== res)
					builder.push(res);
				res = arguments[1];
			}

			var has = builder.is;
			has && self.onError && self.onError(builder, model, type, name);
			callback.success = true;
			callback(has ? builder : null, res === undefined ? model : res);
		};

		if (item.$newversion) {
			var opt = new SchemaOptions(builder, model, options, onCallback, controller, key, self);
			if (self.middlewares && self.middlewares.length)
				runmiddleware(opt, self, () => async.call(self, item)(onError, opt));
			else
				async.call(self, item)(onError, opt);
		} else
			async.call(self, item)(onError, builder, model, options, onCallback, controller);
	}, controller ? controller.req : null);

	return self;
};

SchemaBuilderEntityProto.getLoggerName = function(type, name) {
	return this.name + '.' + type + (name ? ('(\'' + name + '\')') : '()');
};

/**
 * Run a workflow
 * @param {String} name
 * @param {Object} model
 * @param {Object} options Custom options object, optional.
 * @param {Function(errorBuilder, output, model)} callback
 * @param {Boolean} skip Skips preparing and validation, optional.
 * @param {Object} controller Optional
 * @return {SchemaBuilderEntity}
 */
SchemaBuilderEntityProto.operation = function(name, model, options, callback, skip, controller) {

	var self = this;

	var th = typeof(options);
	var tc = typeof(callback);

	if (tc === 'undefined') {
		if (th === 'function') {
			callback = options;
			options = model;
			model = undefined;
		} else if (th === 'undefined') {
			options = model;
			model = undefined;
		}
	} else if (th === 'undefined') {
		options = model;
		model = undefined;
	} else if (tc === 'boolean') {
		skip = callback;
		callback = options;
		options = undefined;
	}

	if (typeof(options) === 'function') {
		callback = options;
		options = undefined;
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
	var $now;

	self.resourceName && builder.setResource(self.resourceName);
	self.resourcePrefix && builder.setPrefix(self.resourcePrefix);

	if (controller instanceof SchemaOptions || controller instanceof OperationOptions)
		controller = controller.controller;

	if (model && !controller && model.$$controller)
		controller = model.$$controller;

	if (CONF.logger)
		$now = Date.now();

	var key = $type + '.' + name;

	if (!isGenerator(self, key, operation)) {
		if (operation.$newversion) {
			operation.call(self, new SchemaOptions(builder, model, options, function(res) {
				CONF.logger && F.ilogger(self.getLoggerName($type, name), controller, $now);
				self.$process(arguments, model, $type, name, builder, res, callback, controller);
			}, controller, key, self));
		} else
			operation.call(self, builder, model, options, function(res) {
				CONF.logger && F.ilogger(self.getLoggerName($type, name), controller, $now);
				self.$process(arguments, model, $type, name, builder, res, callback, controller);
			}, controller, skip !== true);
		return self;
	}

	callback.success = false;

	var onError = function(err) {
		if (!err || callback.success)
			return;
		callback.success = true;
		if (builder !== err)
			builder.push(err);
		self.onError && self.onError(builder, model, $type, name);
		callback(builder);
	};

	var onCallback = function(res) {

		CONF.logger && F.ilogger(self.getLoggerName($type, name), controller, $now);

		if (callback.success)
			return;

		if (arguments.length === 2 || (res instanceof Error || res instanceof ErrorBuilder)) {
			if ((res instanceof Error || res instanceof ErrorBuilder) && builder !== res)
				builder.push(res);
			res = arguments[1];
		}

		var has = builder.is;
		has && self.onError && self.onError(builder, model, $type, name);
		callback.success = true;
		callback(has ? builder : null, res);
	};

	if (operation.$newversion)
		async.call(self, operation)(onError, new SchemaOptions(builder, model, options, onCallback, controller, key, self));
	else
		async.call(self, operation)(onError, builder, model, options, onCallback, controller, skip !== true);

	return self;
};

SchemaBuilderEntityProto.operation2 = function(name, options, callback, controller) {

	if (typeof(options) === 'function') {
		controller = callback;
		callback = options;
		options = undefined;
	}

	!callback && (callback = function(){});
	return this.operation(name, this.create(), options, callback, true, controller);
};

/**
 * Clean model (remove state of all schemas in model).
 * @param {Object} m Model.
 * @param {Boolean} isCopied Internal argument.
 * @return {Object}
 */
SchemaBuilderEntityProto.clean = function(m) {
	return clone(m);
};

// For async operations, because SUCCESS() returns singleton instance everytime
function copy(obj) {
	return F.isSuccess(obj) ? { success: obj.success, value: obj.value } : obj;
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
			if (obj[i] instanceof SchemaInstance)
				o[i] = obj[i].$clean();
			else
				o[i] = clone(obj[i]);
		}

		return o;
	}

	o = {};

	for (var m in obj) {

		if (SKIP[m])
			continue;

		var val = obj[m];

		if (val instanceof Array) {
			o[m] = clone(val);
			continue;
		}

		if (val instanceof SchemaInstance) {
			o[m] = val.$clean();
			continue;
		}

		var type = typeof(val);
		if (type !== 'object' || val instanceof Date) {
			if (type !== 'function')
				o[m] = val;
			continue;
		}

		// Because here can be a problem with MongoDB.ObjectID
		// I assume plain/simple model
		if (val && val.constructor === Object)
			o[m] = clone(obj[m]);
		else
			o[m] = val;
	}

	return o;
}

/**
 * Returns prototype of instances
 * @returns {Object}
 */
SchemaBuilderEntityProto.instancePrototype = function() {
	return this.CurrentSchemaInstance.prototype;
};

SchemaBuilderEntityProto.cl = function(name, value) {
	var o = this.schema[name];
	if (o && (o.type === 8 || o.type === 9)) {
		if (value)
			o.raw = value;
		return o.raw;
	}
};

SchemaBuilderEntityProto.props = function() {

	var self = this;
	var keys = Object.keys(self.schema);
	var prop = {};

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var meta = self.schema[key];
		var obj = {};

		if (meta.required)
			obj.required = meta.required;

		if (meta.length)
			obj.length = meta.length;

		if (meta.isArray)
			meta.array = true;

		switch (meta.type) {
			case 1:
			case 2:
			case 11:
				obj.type = 'number';
				break;
			case 3:
				obj.type = 'string';
				switch (meta.subtype) {
					case 'uid':
						obj.type = 'uid';
						delete obj.length;
						break;
					default:
						obj.subtype = meta.subtype;
						break;
				}
				break;

			case 4:
				obj.type = 'boolean';
				break;
			case 5:
				obj.type = 'date';
				break;
			case 7:
				obj.type = 'schema';
				obj.name = meta.raw;
				break;
			case 8:
				obj.type = 'enum';
				obj.items = meta.raw;
				break;
			case 9:
				// obj.type = 'keyvalue';
				obj.type = 'enum'; // because it returns keys only
				obj.items = Object.keys(meta.raw);
				break;
			// case 6:
			// case 0:
			// case 10:
			default:
				obj.type = 'object';
				break;
		}

		prop[key] = obj;
	}

	return prop;
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
	!callback && (callback = function(){});

	var a = self.$$async = {};

	a.callback = callback;
	a.index = index;
	a.indexer = 0;
	a.response = [];
	a.fn = [];
	a.op = [];
	a.pending = 0;

	a.next = function() {
		a.running = true;
		var fn = a.fn ? a.fn.shift() : null;
		if (fn) {
			a.pending++;
			fn.fn(a.done, a.indexer++);
			fn.async && a.next();
		}
	};

	a.done = function() {
		a.running = false;
		a.pending--;
		if (a.fn.length)
			setImmediate(a.next);
		else if (!a.pending && a.callback)
			a.callback(null, a.index != null ? a.response[a.index] : a.response);
	};

	setImmediate(a.next);
	return self;
};

function async_wait(arr, onItem, onCallback, index) {
	var item = arr[index];
	if (item)
		onItem(item, () => async_wait(arr, onItem, onCallback, index + 1), index);
	else
		onCallback();
}

Object.defineProperty(SchemaInstance.prototype, '$parent', {
	get: function() {
		return this.$$parent;
	},
	set: function(value) {
		this.$$parent = value;
	}
});

SchemaInstance.prototype.$response = function(index) {
	var a = this.$$async;
	if (a) {

		if (index == null)
			return a.response;

		if (typeof(index) === 'string') {

			if (index === 'prev')
				return a.response[a.response.length - 1];

			index = a.op.indexOf(index);

			if (index !== -1)
				return a.response[index];

		} else
			return a.response[index];
	}
};

SchemaInstance.prototype.$repository = function(name, value) {

	if (this.$$repository === undefined) {
		if (value === undefined)
			return undefined;
		this.$$repository = {};
	}

	if (value !== undefined) {
		this.$$repository[name] = value;
		return value;
	}

	return this.$$repository[name];
};

SchemaInstance.prototype.$index = function(index) {
	var a = this.$$async;
	if (a) {
		if (typeof(index) === 'string')
			a.index = (a.index || 0).add(index);
		a.index = index;
	}
	return this;
};

SchemaInstance.prototype.$callback = function(callback) {
	var a = this.$$async;
	if (a)
		a.callback = callback;
	return this;
};

SchemaInstance.prototype.$output = function() {
	var a = this.$$async;
	if (a)
		a.index = true;
	return this;
};

SchemaInstance.prototype.$stop = function() {
	this.async.length = 0;
	return this;
};

const PUSHTYPE1 = { save: 1, insert: 1, update: 1, patch: 1 };
const PUSHTYPE2 = { query: 1, get: 1, read: 1, remove: 1 };

SchemaInstance.prototype.$push = function(type, name, helper, first, async, callback) {

	var self = this;
	var fn;

	if (PUSHTYPE1[type]) {
		fn = function(next, indexer) {
			self.$$schema[type](self, helper, function(err, result) {
				var a = self.$$async;
				a.response && (a.response[indexer] = err ? null : copy(result));
				if (a.index === true)
					a.index = indexer;
				callback && callback(err, a.response[indexer]);
				if (!err)
					return next();
				next = null;
				a.callback(err, a.response);
			}, self.$$controller);
		};

	} else if (PUSHTYPE2[type]) {
		fn = function(next, indexer) {
			self.$$schema[type](helper, function(err, result) {
				var a = self.$$async;
				a.response && (a.response[indexer] = err ? null : copy(result));
				if (a.index === true)
					a.index = indexer;
				callback && callback(err, a.response[indexer]);
				if (!err)
					return next();
				next = null;
				a.callback(err, a.response);
			}, self.$$controller);
		};
	} else {
		fn = function(next, indexer) {
			self.$$schema[type](name, self, helper, function(err, result) {
				var a = self.$$async;
				a.response && (a.response[indexer] = err ? null : copy(result));
				if (a.index === true)
					a.index = indexer;
				callback && callback(err, a.response[indexer]);
				if (!err)
					return next();
				next = null;
				a.callback(err, a.response);
			}, self.$$controller);
		};
	}

	var a = self.$$async;
	var obj = { fn: fn, async: async, index: a.length };
	var key = type === 'workflow' || type === 'transform' || type === 'operation' || type === 'hook' ? (type + '.' + name) : type;

	if (first) {
		a.fn.unshift(obj);
		a.op.unshift(key);
	} else {
		a.fn.push(obj);
		a.op.push(key);
	}

	return self;
};

SchemaInstance.prototype.$next = function(type, name, helper, async) {
	return this.$push(type, name, helper, true, async);
};

SchemaInstance.prototype.$exec = function(name, helper, callback) {

	if (typeof(helper) === 'function') {
		callback = helper;
		helper = undefined;
	}

	var group = this.$$schema.parent.name;
	var key = group !== 'default' ? group + '/' + this.$$schema.name : this.$$schema.name;
	var workflow = F.workflows[key + '#' + name] || F.workflows[name];

	if (workflow)
		workflow(this, helper, callback || NOOP);
	else
		callback && callback(new ErrorBuilder().push('Workflow "' + name + '" not found in workflows.'));

	return this;
};

SchemaInstance.prototype.$controller = function(controller) {
	this.$$controller = controller;
	return this;
};

SchemaInstance.prototype.$save = function(helper, callback, async) {

	if (this.$$async && !this.$$async.running) {
		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}

		this.$push('save', null, helper, null, async, callback);

	} else
		this.$$schema.save(this, helper, callback, this.$$controller);
	return this;
};

SchemaInstance.prototype.$insert = function(helper, callback, async) {

	if (this.$$async && !this.$$async.running) {

		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}

		this.$push('insert', null, helper, null, async, callback);

	} else
		this.$$schema.insert(this, helper, callback, this.$$controller);
	return this;
};

SchemaInstance.prototype.$update = function(helper, callback, async) {
	if (this.$$async && !this.$$async.running) {
		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}
		this.$push('update', null, helper, null, async, callback);
	} else
		this.$$schema.update(this, helper, callback, this.$$controller);
	return this;
};

SchemaInstance.prototype.$patch = function(helper, callback, async) {
	if (this.$$async && !this.$$async.running) {
		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}
		this.$push('patch', null, helper, null, async, callback);
	} else
		this.$$schema.patch(this, helper, callback, this.$$controller);
	return this;
};

SchemaInstance.prototype.$query = function(helper, callback, async) {

	if (this.$$async && !this.$$async.running) {

		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}

		this.$push('query', null, helper, null, async, callback);
	} else
		this.$$schema.query(this, helper, callback, this.$$controller);

	return this;
};

SchemaInstance.prototype.$read = SchemaInstance.prototype.$get = function(helper, callback, async) {

	if (this.$$async && !this.$$async.running) {

		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}

		this.$push('get', null, helper, null, async, callback);
	} else
		this.$$schema.get(this, helper, callback, this.$$controller);

	return this;
};

SchemaInstance.prototype.$delete = SchemaInstance.prototype.$remove = function(helper, callback, async) {

	if (this.$$async && !this.$$async.running) {

		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}

		this.$push('remove', null, helper, null, async, callback);

	} else
		this.$$schema.remove(helper, callback, this.$$controller);

	return this;
};

SchemaInstance.prototype.$default = function() {
	return this.$$schema.default();
};

SchemaInstance.prototype.$destroy = function() {
	return this.$$schema.destroy();
};

SchemaInstance.prototype.$transform = function(name, helper, callback, async) {

	if (this.$$async && !this.$$async.running) {

		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}

		this.$push('transform', name, helper, null, async, callback);

	} else
		this.$$schema.transform(name, this, helper, callback, undefined, this.$$controller);

	return this;
};

SchemaInstance.prototype.$workflow = function(name, helper, callback, async) {

	if (this.$$async && !this.$$async.running) {

		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}

		this.$push('workflow', name, helper, null, async, callback);

	} else
		this.$$schema.workflow(name, this, helper, callback, undefined, this.$$controller);

	return this;
};

SchemaInstance.prototype.$hook = function(name, helper, callback, async) {

	if (this.$$async && !this.$$async.running) {

		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}

		this.$push('hook', name, helper, null, async, callback);

	} else
		this.$$schema.hook(name, this, helper, callback, undefined, this.$$controller);

	return this;
};

SchemaInstance.prototype.$operation = function(name, helper, callback, async) {

	if (this.$$async && !this.$$async.running) {

		if (typeof(helper) === 'function') {
			async = callback;
			callback = helper;
			helper = null;
		} else if (callback === true) {
			var a = async;
			async = true;
			callback = a;
		}

		this.$push('operation', name, helper, null, async, callback);
	} else
		this.$$schema.operation(name, this, helper, callback, undefined, this.$$controller);

	return this;
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
	this.transformName = transforms.error_default;
	this.onResource = onResource;
	this.resourceName = CONF.default_errorbuilder_resource_name;
	this.resourcePrefix = CONF.default_errorbuilder_resource_prefix || '';
	this.isResourceCustom = false;
	this.count = 0;
	this.replacer = [];
	this.isPrepared = false;
	this.contentType = 'application/json';
	this.status = CONF.default_errorbuilder_status || 200;

	// Hidden: when the .push() contains a classic Error instance
	// this.unexpected;

	// A default path for .push()
	// this.path;

	!onResource && this._resource();
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

global.EACHSCHEMA = exports.eachschema = function(group, fn) {

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

global.$$$ = global.GETSCHEMA = exports.getschema = function(group, name, fn, timeout) {

	if (!name || typeof(name) === 'function') {
		timeout = fn;
		fn = name;
	} else
		group = group + '/' + name;

	if (schemacache[group])
		group = schemacache[group];
	else {
		if (group.indexOf('/') === -1)
			group = DEFAULT_SCHEMA + '/' + group;
		group = schemacache[group] = group.toLowerCase();
	}

	if (fn)
		framework_utils.wait(() => !!schemasall[group], err => fn(err, schemasall[group]), timeout || 20000);
	else
		return schemasall[group];
};

exports.findschema = function(groupname) {
	return schemasall[groupname.toLowerCase()];
};

exports.newschema = function(group, name) {

	if (!group)
		group = DEFAULT_SCHEMA;

	if (!schemas[group])
		schemas[group] = new SchemaBuilder(group);

	var o = schemas[group].create(name);
	var key = group + '/' + name;

	o.owner = F.$owner();
	schemasall[key.toLowerCase()] = o;

	return o;
};

/**
 * Remove a schema
 * @param {String} group Optional
 * @param {String} name
 */
exports.remove = function(group, name) {
	if (name) {

		var g = schemas[group || DEFAULT_SCHEMA];
		g && g.remove(name);
		var key = ((group || DEFAULT_SCHEMA) + '/' + name).toLowerCase();
		delete schemasall[key];

	} else {

		delete schemas[group];

		var lower = group.toLowerCase();

		Object.keys(schemasall).forEach(function(key) {
			if (key.substring(0, group.length) === lower)
				delete schemasall[key];
		});
	}
};

global.EACHOPERATION = function(fn) {
	var keys = Object.keys(operations);
	for (var i = 0, length = keys.length; i < length; i++)
		fn(keys[i]);
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
	model = schema.prepare(model);
	return schema === undefined ? null : schema.validate(model, resourcePrefix, resourceName);
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
	return schema === undefined ? null : schema.default();
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
	return schema === undefined ? null : schema.prepare(model);
};

function isUndefined(value, def) {
	return value === undefined ? (def === EMPTYARRAY ? [] : def) : value;
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
	},

	get is() {
		return this.items.length > 0;
	},

	get length() {
		return this.items.length;
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
	return global.F ? F.resource(self.resourceName || 'default', name) : '';
};

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

const ERRORBUILDERWHITE = { ' ': 1, ':': 1, ',': 1 };

/**
 * Add an error (@alias for add)
 * @param {String} name  Property name.
 * @param {String or Error} error Error message.
 * @param {String} path  Current path (in object).
 * @param {Number} index Array Index, optional.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.push = function(name, error, path, index, prefix) {

	this.isPrepared = false;

	if (name instanceof ErrorBuilder) {
		if (name !== this && name.is) {
			for (var i = 0, length = name.items.length; i < length; i++)
				this.items.push(name.items[i]);
			this.count = this.items.length;
		}
		return this;
	}

	if (name instanceof Array) {
		for (var i = 0, length = name.length; i < length; i++)
			this.push(name[i], undefined, path, index, prefix);
		return this;
	}

	if (error instanceof Array) {
		for (var i = 0, length = error.length; i < length; i++)
			this.push(name, error[i], path, index, prefix);
		return this;
	}

	if (typeof(name) === 'object') {
		path = error;
		error = name;
		name = '';
	}

	if (error === null || (!name && !error))
		return this;

	// Status code
	if (error > 0) {
		this.status = error;
		error = '@';
	} else if (path > 0) {
		this.status = path;
		path = undefined;
	}

	if (this.path && !path)
		path = this.path;

	if (!error && typeof(name) === 'string') {
		var m = name.length;
		if (m > 15)
			m = 15;

		error = '@';

		for (var i = 0; i < m; i++) {
			if (ERRORBUILDERWHITE[name[i]]) {
				error = name;
				name = '';
				break;
			}
		}
	}

	if (error instanceof Error) {
		// Why? The answer is in controller.callback(); It's a reason for throwing 500 - internal server error
		this.unexpected = true;
		error = error.toString();
	}

	this.items.push({ name: name, error: typeof(error) === 'string' ? error : error.toString(), path: path, index: index, prefix: prefix });
	this.count = this.items.length;
	return this;
};

ErrorBuilder.assign = function(arr) {
	var builder = new ErrorBuilder();
	for (var i = 0; i < arr.length; i++) {
		if (arr[i].error)
			builder.items.push(arr[i]);
	}
	builder.count = builder.items.length;
	return builder.count ? builder : null;
};

/**
 * Remove error
 * @param {String} name Property name.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.remove = function(name) {
	this.items = this.items.remove('name', name);
	this.count = this.items.length;
	return this;
};

/**
 * Has error?
 * @param {String}  name Property name (optional).
 * @return {Boolean}
 */
ErrorBuilder.prototype.hasError = function(name) {
	return name ? this.items.findIndex('name', name) !== -1 : this.items.length > 0;
};

/**
 * Read an error
 * @param {String} name Property name.
 * @return {String}
 */
ErrorBuilder.prototype.read = function(name) {
	!this.isPrepared && this.prepare();
	var error = this.items.findItem('name', name);
	return error ? error.error : null;
};

/**
 * Clear error collection
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.clear = function() {
	this.items = [];
	this.count = 0;
	return this;
};

/**
 * Replace text in message
 * @param {String} search Text to search.
 * @param {String} newvalue Text to replace.
 * @return {ErrorBuilder}
 */
ErrorBuilder.prototype.replace = function(search, newvalue) {
	this.isPrepared = false;
	this.replacer[search] = newvalue;
	return this;
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

	if (!this.onResource)
		return this;

	var arr = this.items;
	for (var i = 0, length = arr.length; i < length; i++) {

		var o = arr[i];

		if (o.error[0] !== '@')
			continue;

		if (o.error.length === 1)
			o.error = this.onResource(o.prefix ? o.prefix : (this.resourcePrefix + o.name));
		else
			o.error = this.onResource(o.error.substring(1));

		if (!o.error)
			o.error = REQUIRED.replace('@', o.name);
	}

	return this;
};

/**
 * Execute a transform
 * @private
 * @return {Object}
 */
ErrorBuilder.prototype._transform = function(name) {
	var transformName = name || this.transformName;
	if (transformName) {
		var current = transforms['error'][transformName];
		return current ? current.call(this) : this.items;
	}
	return this.items;
};

ErrorBuilder.prototype.output = function(isResponse) {

	if (!this.transformName)
		return isResponse ? this.json() : this.items;

	var current = transforms['error'][this.transformName];
	if (current) {
		this.prepare();
		return current.call(this, isResponse);
	}

	return isResponse ? this.json() : this.items;
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

	this.page = Math.max(1, +page) - 1;

	if (this.page <= 0)
		this.page = 0;

	this.items = Math.max(0, +items);
	this.max = Math.max(1, +max);
	this.skip = this.page * this.max;
	this.count = Math.ceil(this.items / this.max);
	this.take = Math.min(this.max, (this.items - this.skip));

	this.lastPage = this.count;
	this.firstPage = 1;
	this.prevPage = this.page ? this.page : 1;
	this.nextPage = this.page + 2 < this.count - 1 ? this.page + 2 : this.count;

	this.isPrev = this.page > 0;
	this.isNext = this.page < this.count - 1;

	this.isFirst = this.page === 0;
	this.isLast = this.page === this.count - 1;

	this.visible = this.count > 1;
	this.page++;

	return this;
};

/**
 * Set transformation for current Pagination
 * @param {String} name
 * @return {Pagination}
 */
Pagination.prototype.setTransform = function(name) {
	this._transform = name;
	return this;
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

	var transformName = name || this.transformName;
	if (!transformName)
		throw new Error('A transformation of Pagination not found.');

	var current = transforms['pagination'][transformName];
	if (!current)
		return this.render();

	var param = [];
	for (var i = 1; i < arguments.length; i++)
		param.push(arguments[i]);

	return current.apply(this, param);
};

/**
 * Get a previous page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.prev = function(format) {
	var page = 0;

	format = format || this.format;

	if (this.isPrev)
		page = this.page - 1;
	else
		page = this.count;

	return new Page(format.format(page, this.items, this.count), page, false, this.isPrev);
};

/**
 * Get a next page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.next = function(format) {
	var page = 0;

	format = format || this.format;

	if (this.isNext)
		page = this.page + 1;
	else
		page = 1;

	return new Page(format.format(page, this.items, this.count), page, false, this.isNext);
};

/**
 * Get a last page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.last = function(format) {
	var page = this.count;
	format = format || this.format;
	return new Page(format.format(page, this.items, this.count), page, false, this.count > 0);
};

/**
 * Get a first page
 * @param {String} format Custom format (optional).
 * @return {Object} Example: { url: String, page: Number, selected: Boolean }
 */
Pagination.prototype.first = function(format) {
	var page = 1;
	format = format || this.format;
	return new Page(format.format(page, this.items, this.count), page, false, this.count > 0);
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

	if (typeof(name) !== 'object') {
		this.builder[name] = value;
		return this;
	}

	var arr = Object.keys(name);

	for (var i = 0, length = arr.length; i < length; i++)
		this.builder[arr[i]] = name[arr[i]];

	return this;
};

/**
 * Remove parameter
 * @param {String} name
 * @return {UrlBuilder}
 */
UrlBuilder.prototype.remove = function(name) {
	delete this.builder[name];
	return this;
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
	this.builder = {};
	return this;
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

	if (typeof(keys) === 'string')
		keys = [keys];

	for (var i = 0; i < keys.length; i++) {
		var val = this.builder[keys[i]];
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

function RESTBuilder(url) {

	this.$url = url;
	this.$headers = { 'user-agent': 'Total.js/v' + F.version_header, accept: 'application/json, text/plain, text/plain, text/xml' };
	this.$method = 'get';
	this.$timeout = 10000;
	this.$type = 0; // 0 = query, 1 = json, 2 = urlencode, 3 = raw
	this.$schema;
	this.$length = 0;
	this.$transform = transforms['restbuilder_default'];
	this.$files = null;
	this.$persistentcookies = false;

	// this.$flags;
	// this.$data = {};
	// this.$nodnscache = true;
	// this.$cache_expire;
	// this.$cache_nocache;
	// this.$redirect

	// Auto Total.js Error Handling
	this.$errorbuilderhandling = true;
}

RESTBuilder.make = function(fn) {
	var instance = new RESTBuilder();
	fn && fn(instance);
	return instance;
};

RESTBuilder.url = function(url) {
	return new RESTBuilder(url);
};

RESTBuilder.GET = function(url, data) {
	var builder = new RESTBuilder(url);
	data && builder.raw(data);
	return builder;
};

RESTBuilder.POST = function(url, data) {
	var builder = new RESTBuilder(url);
	builder.$method = 'post';
	builder.$type = 1;
	data && builder.raw(data);
	return builder;
};

RESTBuilder.PUT = function(url, data) {
	var builder = new RESTBuilder(url);
	builder.$method = 'put';
	builder.$type = 1;
	builder.put(data);
	return builder;
};

RESTBuilder.DELETE = function(url, data) {
	var builder = new RESTBuilder(url);
	builder.$method = 'delete';
	builder.$type = 1;
	data && builder.raw(data);
	return builder;
};

RESTBuilder.PATCH = function(url, data) {
	var builder = new RESTBuilder(url);
	builder.$method = 'patch';
	builder.$type = 1;
	data && builder.raw(data);
	return builder;
};

RESTBuilder.HEAD = function(url) {
	var builder = new RESTBuilder(url);
	builder.$method = 'head';
	return builder;
};

RESTBuilder.upgrade = function(fn) {
	restbuilderupgrades.push(fn);
};

/**
 * STATIC: Creates a transformation
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

var RESTP = RESTBuilder.prototype;

RESTP.promise = function(fn) {
	var self = this;
	return new Promise(function(resolve, reject) {
		self.exec(function(err, result) {
			if (err)
				reject(err);
			else
				resolve(fn == null ? result : fn(result));
		});
	});
};

RESTP.proxy = function(value) {
	this.$proxy = value;
	return this;
};

RESTP.setTransform = function(name) {
	this.$transform = name;
	return this;
};

RESTP.url = function(url) {
	if (url === undefined)
		return this.$url;
	this.$url = url;
	return this;
};

RESTP.file = function(name, filename, buffer) {
	var obj = { name: name, filename: filename, buffer: buffer };
	if (this.$files)
		this.$files.push(obj);
	else
		this.$files = [obj];
	return this;
};

RESTP.maketransform = function(obj, data) {
	if (this.$transform) {
		var fn = transforms['restbuilder'][this.$transform];
		return fn ? fn(obj, data) : obj;
	}
	return obj;
};

RESTP.timeout = function(number) {
	this.$timeout = number;
	return this;
};

RESTP.maxlength = function(number) {
	this.$length = number;
	this.$flags = null;
	return this;
};

RESTP.auth = function(user, password) {
	this.$headers['authorization'] = 'Basic ' + Buffer.from(user + ':' + password).toString('base64');
	return this;
};

RESTP.convert = function(convert) {
	this.$convert = convert;
	return this;
};

RESTP.schema = function(group, name) {
	this.$schema = exports.getschema(group, name);
	if (!this.$schema)
		throw Error('RESTBuilder: Schema "{0}" not found.'.format(name ? (group + '/' + name) : group));
	return this;
};

RESTP.noDnsCache = function() {
	this.$nodnscache = true;
	this.$flags = null;
	return this;
};

RESTP.noCache = function() {
	this.$nocache = true;
	return this;
};

RESTP.make = function(fn) {
	fn.call(this, this);
	return this;
};

RESTP.xhr = function() {
	this.$headers['X-Requested-With'] = 'XMLHttpRequest';
	return this;
};

RESTP.method = function(method, data) {
	this.$method = method.charCodeAt(0) < 97 ? method.toLowerCase() : method;
	this.$flags = null;
	data && this.raw(data);
	return this;
};

RESTP.referer = RESTP.referrer = function(value) {
	this.$headers['Referer'] = value;
	return this;
};

RESTP.origin = function(value) {
	this.$headers['Origin'] = value;
	return this;
};

RESTP.robot = function() {
	if (this.$headers['User-Agent'])
		this.$headers['User-Agent'] += ' Bot';
	else
		this.$headers['User-Agent'] = 'Bot';
	return this;
};

RESTP.mobile = function() {
	if (this.$headers['User-Agent'])
		this.$headers['User-Agent'] += ' iPhone';
	else
		this.$headers['User-Agent'] = 'iPhone';
	return this;
};

RESTP.put = RESTP.PUT = function(data) {
	if (this.$method !== 'put') {
		this.$flags = null;
		this.$method = 'put';
		this.$type = 1;
	}
	data && this.raw(data);
	return this;
};

RESTP.delete = RESTP.DELETE = function(data) {
	if (this.$method !== 'delete') {
		this.$flags = null;
		this.$method = 'delete';
		this.$type = 1;
	}
	data && this.raw(data);
	return this;
};

RESTP.get = RESTP.GET = function(data) {
	if (this.$method !== 'get') {
		this.$flags = null;
		this.$method = 'get';
	}
	data && this.raw(data);
	return this;
};

RESTP.post = RESTP.POST = function(data) {
	if (this.$method !== 'post') {
		this.$flags = null;
		this.$method = 'post';
		this.$type = 1;
	}
	data && this.raw(data);
	return this;
};

RESTP.head = RESTP.HEAD = function() {
	if (this.$method !== 'head') {
		this.$flags = null;
		this.$method = 'head';
	}
	return this;
};

RESTP.patch = RESTP.PATCH = function(data) {
	if (this.$method !== 'patch') {
		this.$flags = null;
		this.$method = 'patch';
		this.$type = 1;
	}
	data && this.raw(data);
	return this;
};

RESTP.json = function(data) {

	if (this.$type !== 1)
		this.$flags = null;

	data && this.raw(data);
	this.$type = 1;

	if (this.$method === 'get')
		this.$method = 'post';

	return this;
};

RESTP.urlencoded = function(data) {

	if (this.$type !== 2)
		this.$flags = null;

	if (this.$method === 'get')
		this.$method = 'post';

	this.$type = 2;
	data && this.raw(data);
	return this;
};

RESTP.accept = function(ext) {

	var type;

	if (ext.length > 8)
		type = ext;
	else
		type = framework_utils.getContentType(ext);

	if (this.$headers.Accept !== type)
		this.$flags = null;

	this.$flags = null;
	this.$headers.Accept = type;

	return this;
};

RESTP.xml = function(data, replace) {

	if (this.$type !== 3)
		this.$flags = null;

	if (this.$method === 'get')
		this.$method = 'post';

	this.$type = 3;

	if (replace)
		this.$replace = true;

	data && this.raw(data);
	return this;
};

RESTP.redirect = function(value) {
	this.$redirect = value;
	return this;
};

RESTP.raw = function(value) {
	this.$data = value && value.$clean ? value.$clean() : value;
	return this;
};

RESTP.plain = function() {
	this.$plain = true;
	return this;
};

RESTP.cook = function(value) {
	this.$flags = null;
	this.$persistentcookies = value !== false;
	return this;
};

RESTP.cookies = function(obj) {
	this.$cookies = obj;
	return this;
};

RESTP.cookie = function(name, value) {
	!this.$cookies && (this.$cookies = {});
	this.$cookies[name] = value;
	return this;
};

RESTP.header = function(name, value) {
	this.$headers[name] = value;
	return this;
};

RESTP.type = function(value) {
	this.$headers['Content-Type'] = value;
	return this;
};

function execrestbuilder(instance, callback) {
	instance.exec(callback);
}

RESTP.callback = function(callback) {
	setImmediate(execrestbuilder, this, callback);
	return this;
};

RESTP.cache = function(expire) {
	this.$cache_expire = expire;
	return this;
};

RESTP.insecure = function() {
	this.$insecure = true;
	return this;
};

RESTP.set = function(name, value) {
	if (!this.$data)
		this.$data = {};
	if (typeof(name) !== 'object') {
		this.$data[name] = value;
	} else {
		var arr = Object.keys(name);
		for (var i = 0, length = arr.length; i < length; i++)
			this.$data[arr[i]] = name[arr[i]];
	}
	return this;
};

RESTP.rem = function(name) {
	if (this.$data && this.$data[name])
		this.$data[name] = undefined;
	return this;
};

RESTP.stream = function(callback) {
	var self = this;
	var flags = self.$flags ? self.$flags : [self.$method];

	if (!self.$flags) {
		!self.$nodnscache && flags.push('dnscache');
		self.$persistentcookies && flags.push('cookies');
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

RESTP.keepalive = function() {
	var self = this;
	self.$keepalive = true;
	return self;
};

RESTP.flags = function() {
	var self = this;
	!self.$flags && (self.$flags = []);
	for (var i = 0; i < arguments.length; i++)
		self.$flags(arguments[i]);
	return self;
};

RESTP.exec = function(callback) {

	if (!callback)
		callback = NOOP;

	var self = this;

	if (self.$files && self.$method === 'get')
		self.$method = 'post';

	self.$callback = callback;

	if (restbuilderupgrades.length) {
		for (var i = 0; i < restbuilderupgrades.length; i++)
			restbuilderupgrades[i](self);
	}

	var flags = self.$flags ? self.$flags : [self.$method];
	var key;

	if (!self.$flags) {

		!self.$nodnscache && flags.push('dnscache');
		self.$persistentcookies && flags.push('cookies');
		self.$length && flags.push('<' + self.$length);
		self.$redirect === false && flags.push('noredirect');
		self.$proxy && flags.push('proxy ' + self.$proxy);
		self.$keepalive && flags.push('keepalive');
		self.$insecure && flags.push('insecure');

		if (self.$files) {
			flags.push('upload');
		} else {
			switch (self.$type) {
				case 1:
					flags.push('json');
					break;
				case 3:
					flags.push('xml');
					break;
			}
		}

		self.$flags = flags;
	}

	if (self.$cache_expire && !self.$nocache) {
		key = '$rest_' + (self.$url + flags.join(',') + (self.$data ? Qs.stringify(self.$data) : '')).hash();
		var data = F.cache.read2(key);
		if (data) {
			var evt = new framework_utils.EventEmitter2();
			setImmediate(exec_removelisteners, evt);
			callback(null, self.maketransform(this.$schema ? this.$schema.make(data.value) : data.value, data), data);
			return evt;
		}
	}

	self.$callback_key = key;
	return U.request(self.$url, flags, self.$data, exec_callback, self.$cookies, self.$headers, undefined, self.$timeout, self.$files, self);
};

function exec_callback(err, response, status, headers, hostname, cookies, self) {

	var callback = self.$callback;
	var key = self.$callback_key;
	var type = err ? '' : headers['content-type'] || '';
	var output = new RESTBuilderResponse();

	if (type) {
		var index = type.lastIndexOf(';');
		if (index !== -1)
			type = type.substring(0, index).trim();
	}

	var ishead = response === headers;

	if (ishead)
		response = '';

	if (ishead) {
		output.value = status < 400;
	} else if (self.$plain) {
		output.value = response;
	} else {
		switch (type.toLowerCase()) {
			case 'text/xml':
			case 'application/xml':
				output.value = response ? response.parseXML(self.$replace ? true : false) : {};
				break;
			case 'application/x-www-form-urlencoded':
				output.value = response ? F.onParseQuery(response) : {};
				break;
			case 'application/json':
			case 'text/json':
				output.value = response ? response.parseJSON(true) : null;
				break;
			default:
				output.value = response && response.isJSON() ? response.parseJSON(true) : null;
				break;
		}
	}

	if (output.value == null)
		output.value = EMPTYOBJECT;

	output.response = response;
	output.status = status;
	output.headers = headers;
	output.hostname = hostname;
	output.cache = false;
	output.datetime = NOW;

	var val;

	if (self.$schema) {

		if (err)
			return callback(err, EMPTYOBJECT, output);

		val = self.maketransform(output.value, output);

		if (self.$errorbuilderhandling) {
			// Is the response Total.js ErrorBuilder?
			if (val instanceof Array && val.length && val[0] && val[0].error) {
				err = ErrorBuilder.assign(val);
				if (err)
					val = EMPTYOBJECT;
				if (err) {
					callback(err, EMPTYOBJECT, output);
					return;
				}
			}
		}

		self.$schema.make(val, function(err, model) {
			!err && key && output.status === 200 && F.cache.add(key, output, self.$cache_expire);
			callback(err, err ? EMPTYOBJECT : model, output);
			output.cache = true;
		});

	} else {
		!err && key && output.status === 200 && F.cache.add(key, output, self.$cache_expire);

		val = self.maketransform(output.value, output);

		if (self.$errorbuilderhandling) {
			// Is the response Total.js ErrorBuilder?
			if (val instanceof Array && val.length && val[0] && val[0].error) {
				err = ErrorBuilder.assign(val);
				if (err)
					val = EMPTYOBJECT;
			}
		}

		if (self.$convert && val && val !== EMPTYOBJECT)
			val = CONVERT(val, self.$convert);

		callback(err, val, output);
		output.cache = true;
	}
}

function exec_removelisteners(evt) {
	evt.removeAllListeners();
}

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
}

global.NEWTASK = function(name, fn, filter) {
	if (fn == null) {
		delete tasks[name];
	} else {
		tasks[name] = {};
		tasks[name].$owner = F.$owner();
		tasks[name].$filter = filter;
		var append = function(key, fn) {
			tasks[name][key] = fn;
		};
		fn(append);
	}
};

function taskrunner(obj, name, callback) {
	obj.exec(name, callback);
}

global.TASK = function(taskname, name, callback, options) {
	var obj = new TaskBuilder(options);
	obj.taskname = taskname;

	if (obj.controller) {
		obj.controller.$filterschema = null;
		obj.controller.$filter = null;
	}

	name && setImmediate(taskrunner, obj, name, callback);
	return obj;
};

global.NEWOPERATION = function(name, fn, repeat, stop, binderror, filter) {

	if (typeof(repeat) === 'string') {
		filter = repeat;
		repeat = null;
	}

	if (typeof(stop) === 'string') {
		filter = stop;
		stop = null;
	}

	if (typeof(binderror) === 'string') {
		filter = binderror;
		binderror = null;
	}

	// @repeat {Number} How many times will be the operation repeated after error?
	// @stop {Boolean} Stop when the error is thrown
	// @binderror {Boolean} Binds error when chaining of operations
	// @filter {Object}

	// Remove operation
	if (fn == null) {
		delete operations[name];
	} else {
		operations[name] = fn;
		operations[name].$owner = F.$owner();
		operations[name].$newversion = REGEXP_NEWOPERATION.test(fn.toString());
		operations[name].$repeat = repeat;
		operations[name].$stop = stop !== false;
		operations[name].$binderror = binderror === true;
		operations[name].$filter = filter;
		if (!operations[name].$newversion)
			OBSOLETE('NEWOPERATION("{0}")'.format(name), MSG_OBSOLETE_NEW);
	}
};

function getLoggerNameOperation(name) {
	return 'OPERATION(\'' + name + '\')';
}

function NoOp() {}

global.OPERATION = function(name, value, callback, param, controller) {

	if (typeof(value) === 'function') {
		controller = param;
		param = callback;
		callback = value;
		value = EMPTYOBJECT;
	}

	if (param instanceof Controller || param instanceof OperationOptions || param instanceof SchemaOptions || param instanceof TaskBuilder || param instanceof AuthOptions || param instanceof WebSocketClient) {
		controller = param;
		param = undefined;
	}

	if (controller && controller.controller)
		controller = controller.controller;

	var fn = operations[name];

	var error = new ErrorBuilder();
	var $now;

	if (CONF.logger)
		$now = Date.now();

	if (fn) {

		if (fn.$filter && controller) {
			controller.$filterschema = fn.$filter;
			controller.$filter = null;
		}

		if (fn.$newversion) {
			var self = new OperationOptions(error, value, param, controller);
			self.$repeat = fn.$repeat;
			self.callback = function(value) {

				CONF.logger && F.ilogger(getLoggerNameOperation(name), controller, $now);
				if (arguments.length > 1) {
					if (value instanceof Error || (value instanceof ErrorBuilder && value.is)) {
						self.error.push(value);
						value = EMPTYOBJECT;
					} else
						value = arguments[1];
				} else if (value instanceof Error || (value instanceof ErrorBuilder && value.is)) {
					self.error.push(value);
					value = EMPTYOBJECT;
				}

				if (self.error.items.length && self.$repeat) {
					self.error.clear();
					self.$repeat--;
					fn(self);
				} else {
					if (callback) {
						if (value === NoOp)
							callback = null;
						else
							callback(self.error.is ? self.error : null, value, self.options);
					}
				}
				return self;
			};
			fn(self);
		} else
			fn(error, value, function(value) {
				CONF.logger && F.ilogger(getLoggerNameOperation(name), controller, $now);
				if (callback) {
					if (value instanceof Error) {
						error.push(value);
						value = EMPTYOBJECT;
					}
					if (value !== NoOp)
						callback(error.is ? error : null, value, param);
				}
			});
	} else {
		error.push('Operation "{0}" not found.'.format(name));
		callback && callback(error, EMPTYOBJECT, param);
	}
};

global.RUN = function(name, value, callback, param, controller, result) {

	if (typeof(value) === 'function') {
		result = controller;
		controller = param;
		param = callback;
		callback = value;
		value = EMPTYOBJECT;
	}

	if (param instanceof global.Controller || (param && param.isWebSocket)) {
		result = controller;
		controller = param;
		param = EMPTYOBJECT;
	} else if (param instanceof OperationOptions || param instanceof SchemaOptions || param instanceof TaskBuilder || param instanceof AuthOptions) {
		result = controller;
		controller = param.controller;
	}

	if (!result) {
		if (typeof(param) === 'string') {
			result = param;
			param = EMPTYOBJECT;
		} else if (typeof(controller) === 'string') {
			result = controller;
			controller = null;
		}
	}

	if (typeof(name) === 'string')
		name = name.split(',').trim();

	var error = new ErrorBuilder();
	var opt = new OperationOptions(error, value, param, controller);

	opt.meta = {};
	opt.meta.items = name;
	opt.response = {};
	opt.errors = error;

	opt.callback = function(value) {

		CONF.logger && F.ilogger(getLoggerNameOperation(opt.name), controller, opt.duration);

		if (arguments.length > 1) {
			if (value instanceof Error || (value instanceof ErrorBuilder && value.is)) {
				opt.error.push(value);
				value = EMPTYOBJECT;
			} else
				value = arguments[1];
		} else if (value instanceof Error || (value instanceof ErrorBuilder && value.is)) {
			opt.error.push(value);
			value = EMPTYOBJECT;
		}

		if (opt.error.items.length && opt.$repeat > 0) {
			opt.error.clear();
			opt.$repeat--;
			opt.repeated++;
			setImmediate(opt => opt.$current(opt), opt);
		} else {

			if (opt.error.items.length) {
				if (opt.$current.$binderror)
					value = opt.error.output(false);
			}

			if (opt.error.items.length && opt.$current.$stop) {
				error.push(opt.error);
				name = null;
				opt.next = null;
				callback(error, opt.response, opt);
			} else {

				// Because "controller_json_workflow_multiple()" returns error instead of results
				// error.push(opt.error);

				if (result && (result === opt.meta.current || result === opt.name))
					opt.output = value;

				opt.response[opt.name] = value;
				opt.meta.prev = opt.meta.current;
				opt.$next();
			}
		}
	};

	name.wait(function(key, next, index) {

		var fn = operations[key];
		if (!fn) {
			// What now?
			// F.error('Operation "{0}" not found'.format(key), 'RUN()');
			return next();
		}

		opt.repeated = 0;
		opt.error = new ErrorBuilder();
		opt.error.path = 'operation: ' + key;
		opt.meta.index = index;
		opt.name = opt.meta.current = key;
		opt.$repeat = fn.$repeat;
		opt.$current = fn;
		opt.$next = next;
		opt.meta.next = name[index];

		if (CONF.logger)
			opt.duration = Date.now();

		fn(opt);

	}, () => callback(error.items.length ? error : null, result ? opt.output : opt.response, opt));
};

function OperationOptions(error, value, options, controller) {

	if (!controller && options instanceof global.Controller) {
		controller = options;
		options = EMPTYOBJECT;
	} else if (options === undefined)
		options = EMPTYOBJECT;

	this.controller = controller;
	this.model = this.value = value;
	this.error = error;
	this.options = options;
}

OperationOptions.prototype = {

	get user() {
		return this.controller ? this.controller.user : null;
	},

	get session() {
		return this.controller ? this.controller.session : null;
	},

	get sessionid() {
		return this.controller && this.controller ? this.controller.req.sessionid : null;
	},

	get language() {
		return (this.controller ? this.controller.language : '') || '';
	},

	get ip() {
		return this.controller ? this.controller.ip : null;
	},

	get id() {
		return this.controller ? this.controller.id : null;
	},

	get req() {
		return this.controller ? this.controller.req : null;
	},

	get res() {
		return this.controller ? this.controller.res : null;
	},

	get params() {
		return this.controller ? this.controller.params : null;
	},

	get files() {
		return this.controller ? this.controller.files : null;
	},

	get body() {
		return this.controller ? this.controller.body : null;
	},

	get query() {
		return this.controller ? this.controller.query : null;
	},

	get headers() {
		return this.controller && this.controller.req ? this.controller.req.headers : null;
	},

	get ua() {
		return this.controller && this.controller.req ? this.controller.req.ua : null;
	},

	get filter() {
		var ctrl = this.controller;
		if (ctrl && !ctrl.$filter)
			ctrl.$filter = ctrl.$filterschema ? CONVERT(ctrl.query, ctrl.$filterschema) : ctrl.query;
		return ctrl ? ctrl.$filter : EMPTYOBJECT;
	}

};

const OperationOptionsProto = OperationOptions.prototype;

SchemaOptionsProto.tasks = OperationOptionsProto.tasks = function(taskname, name, callback, options) {
	return taskname ? TASK(taskname, name, callback, options || this) : new TaskBuilder(this);
};

OperationOptionsProto.cancel = function() {
	var self = this;
	self.callback = null;
	self.error = null;
	self.controller = null;
	self.options = null;
	self.model = self.value = null;
	return self;
};

OperationOptionsProto.noop = function(nocustomresponse) {
	var self = this;
	!nocustomresponse && self.controller && self.controller.custom();
	self.callback(NoOp);
	return self;
};

OperationOptionsProto.successful = function(callback) {
	var self = this;
	return function(err, a, b, c) {
		if (err)
			self.invalid(err);
		else
			callback.call(self, a, b, c);
	};
};

OperationOptionsProto.redirect = function(url) {
	this.callback(new F.callback_redirect(url));
	return this;
};

OperationOptionsProto.DB = function() {
	return F.database(this.error);
};

OperationOptionsProto.done = function(arg) {
	var self = this;
	return function(err, response) {
		if (err) {
			self.error.push(err);
			self.callback();
		} else {
			if (arg)
				self.callback(SUCCESS(err == null, arg === true ? response : arg));
			else
				self.callback(SUCCESS(err == null));
		}
	};
};

OperationOptionsProto.success = function(a, b) {

	if (a && b === undefined && typeof(a) !== 'boolean') {
		b = a;
		a = true;
	}

	this.callback(SUCCESS(a === undefined ? true : a, b));
	return this;
};

OperationOptionsProto.invalid = function(name, error, path, index) {

	var self = this;

	if (arguments.length) {
		self.error.push(name, error, path, index);
		self.callback();
		return self;
	}

	return function(err) {
		self.error.push(err);
		self.callback();
	};
};

function AuthOptions(req, res, flags, callback) {
	this.req = req;
	this.res = res;
	this.flags = flags || [];
	this.processed = false;
	this.$callback = callback;
}

AuthOptions.prototype = {

	get language() {
		return this.req.language || '';
	},

	get ip() {
		return this.req.ip;
	},

	get params() {
		return this.req.params;
	},

	get files() {
		return this.req.files;
	},

	get body() {
		return this.req.body;
	},

	get query() {
		return this.req.query;
	},

	get headers() {
		return this.req.headers;
	},

	get ua() {
		return this.req ? this.req.ua : null;
	}
};

const AuthOptionsProto = AuthOptions.prototype;

AuthOptionsProto.roles = function() {
	for (var i = 0; i < arguments.length; i++)
		this.flags.push('@' + arguments[i]);
	return this;
};

SchemaOptionsProto.cookie = OperationOptionsProto.cookie = TaskBuilderProto.cookie = AuthOptionsProto.cookie = function(name, value, expire, options) {
	var self = this;
	if (value === undefined)
		return self.req.cookie(name);
	if (value === null)
		expire = '-1 day';
	self.res.cookie(name, value, expire, options);
	return self;
};

AuthOptionsProto.invalid = function(user) {
	this.next(false, user);
};

AuthOptionsProto.done = function(response) {
	var self = this;
	return function(is, user) {
		self.next(is, response ? response : user);
	};
};

AuthOptionsProto.success = function(user) {
	this.next(true, user);
};

AuthOptionsProto.next = AuthOptionsProto.callback = function(is, user) {

	if (this.processed)
		return;

	// @is "null" for callbacks(err, user)
	// @is "true"
	// @is "object" is as user but "user" must be "undefined"

	if (is instanceof Error || is instanceof ErrorBuilder) {
		// Error handling
		is = false;
	} else if (is == null && user) {
		// A callback error handling
		is = true;
	} else if (user == null && is && is !== true) {
		user = is;
		is = true;
	}

	this.processed = true;
	this.$callback(is, user, this);
};

AuthOptions.wrap = function(fn) {
	if (REGEXP_NEWOPERATION.test(fn.toString())) {
		var fnnew = function(req, res, flags, next) {
			fn(new AuthOptions(req, res, flags, next));
		};
		fnnew.$newversion = true;
		return fnnew;
	}
	return fn;
};

global.CONVERT = function(value, schema) {
	var key = schema;
	if (key.length > 50)
		key = key.hash();
	var fn = F.convertors2 && F.convertors2[key];
	return fn ? fn(value) : convertorcompile(schema, value, key);
};

function convertorcompile(schema, data, key) {
	var prop = schema.split(',');
	var cache = [];
	for (var i = 0, length = prop.length; i < length; i++) {
		var arr = prop[i].split(':');
		var obj = {};

		var type = arr[1].toLowerCase().trim();
		var size = 0;
		var isarr = type[0] === '[';
		if (isarr)
			type = type.substring(1, type.length - 1);

		var index = type.indexOf('(');
		if (index !== -1) {
			size = +type.substring(index + 1, type.length - 1).trim();
			type = type.substring(0, index);
		}

		obj.name = arr[0].trim();
		obj.size = size;
		obj.type = type;
		obj.array = isarr;

		switch (type) {
			case 'string':
				obj.fn = $convertstring;
				break;
			case 'number':
				obj.fn = $convertnumber;
				break;
			case 'number2':
				obj.fn = $convertnumber2;
				break;
			case 'boolean':
				obj.fn = $convertboolean;
				break;
			case 'date':
				obj.fn = $convertdate;
				break;
			case 'uid':
				obj.fn = $convertuid;
				break;
			case 'upper':
				obj.fn = (val, obj) => $convertstring(val, obj).toUpperCase();
				break;
			case 'lower':
				obj.fn = (val, obj) => $convertstring(val, obj).toLowerCase();
				break;
			case 'capitalize':
				obj.fn = (val, obj) => $convertstring(val, obj).capitalize();
				break;
			case 'capitalize2':
				obj.fn = (val, obj) => $convertstring(val, obj).capitalize(true);
				break;
			case 'base64':
				obj.fn = val => typeof(val) === 'string' ? val.isBase64() ? val : '' : '';
				break;
			case 'email':
				obj.fn = function(val, obj) {
					var tmp = $convertstring(val, obj);
					return tmp.isEmail() ? tmp : '';
				};
				break;
			case 'zip':
				obj.fn = function(val, obj) {
					var tmp = $convertstring(val, obj);
					return tmp.isZIP() ? tmp : '';
				};
				break;
			case 'phone':
				obj.fn = function(val, obj) {
					var tmp = $convertstring(val, obj);
					return tmp.isPhone() ? tmp : '';
				};
				break;
			case 'url':
				obj.fn = function(val, obj) {
					var tmp = $convertstring(val, obj);
					return tmp.isURL() ? tmp : '';
				};
				break;
			case 'json':
				obj.fn = function(val, obj) {
					var tmp = $convertstring(val, obj);
					return tmp.isJSON() ? tmp : '';
				};
				break;
			case 'object':
				return val => val;
			case 'search':
				obj.fn = (val, obj) => $convertstring(val, obj).toSearch();
				break;
			default:
				obj.fn = val => val;
				break;
		}

		if (isarr) {
			obj.fn2 = obj.fn;
			obj.fn = function(val, obj) {
				if (!(val instanceof Array))
					val = val == null || val == '' ? [] : [val];
				var output = [];
				for (var i = 0, length = val.length; i < length; i++) {
					var o = obj.fn2(val[i], obj);
					switch (obj.type) {
						case 'email':
						case 'phone':
						case 'zip':
						case 'json':
						case 'url':
						case 'uid':
						case 'date':
							o && output.push(o);
							break;
						default:
							output.push(o);
							break;
					}
				}
				return output;
			};
		}

		cache.push(obj);
	}

	var fn = function(data) {
		var output = {};
		for (var i = 0, length = cache.length; i < length; i++) {
			var item = cache[i];
			output[item.name] = item.fn(data[item.name], item);
		}
		return output;
	};
	if (!F.convertors2)
		F.convertors2 = {};
	F.convertors2[key] = fn;
	return fn(data);
}

function $convertstring(value, obj) {
	return value == null ? '' : typeof(value) !== 'string' ? obj.size ? value.toString().max(obj.size) : value.toString() : obj.size ? value.max(obj.size) : value;
}

function $convertnumber(value) {
	if (value == null)
		return 0;
	if (typeof(value) === 'number')
		return value;
	var num = +value.toString().replace(',', '.');
	return isNaN(num) ? 0 : num;
}

function $convertnumber2(value) {
	if (value == null)
		return null;
	if (typeof(value) === 'number')
		return value;
	var num = +value.toString().replace(',', '.');
	return isNaN(num) ? null : num;
}

function $convertboolean(value) {
	return value == null ? false : value === true || value == '1' || value === 'true' || value === 'on';
}

function $convertuid(value) {
	return value == null ? '' : typeof(value) === 'string' ? value.isUID() ? value : '' : '';
}

function $convertdate(value) {

	if (value == null)
		return null;

	if (value instanceof Date)
		return value;

	switch (typeof(value)) {
		case 'string':
		case 'number':
			return value.parseDate();
	}

	return null;
}

// ======================================================
// EXPORTS
// ======================================================

exports.SchemaBuilder = SchemaBuilder;
exports.RESTBuilder = RESTBuilder;
exports.ErrorBuilder = ErrorBuilder;
exports.Pagination = Pagination;
exports.Page = Page;
exports.UrlBuilder = UrlBuilder;
exports.SchemaOptions = SchemaOptions;
exports.OperationOptions = OperationOptions;
exports.RESTBuilderResponse = RESTBuilderResponse;
exports.AuthOptions = AuthOptions;
global.RESTBuilder = RESTBuilder;
global.RESTBuilderResponse = RESTBuilderResponse;
global.ErrorBuilder = ErrorBuilder;
global.Pagination = Pagination;
global.Page = Page;
global.UrlBuilder = global.URLBuilder = UrlBuilder;
global.SchemaBuilder = SchemaBuilder;
global.TaskBuilder = TaskBuilder;

// Uninstall owners
exports.uninstall = function(owner) {

	if (!owner)
		return;

	Object.keys(operations).forEach(function(key) {
		if (operations[key].$owner === owner)
			delete operations[key];
	});

	exports.eachschema(function(group, name, schema) {
		schema.owner === owner && schema.destroy();
	});
};

TaskBuilderProto.invalid = function(err, msg) {
	var self = this;
	if (!self.$done) {
		!self.error && (self.error = new ErrorBuilder());
		self.error.push(err, msg);
		self.done();
	}
	return self;
};

TaskBuilderProto.push = function(name, fn) {
	var self = this;
	self.tasks[name] = fn;
	return self;
};

TaskBuilderProto.next = function() {
	var self = this;
	if (!self.$done) {
		self.current && self.controller && CONF.logger && F.ilogger((self.name || 'tasks') + '.' + self.current, self.controller, self.$now);
		self.prev = self.current;
		for (var i = 0; i < arguments.length; i++) {
			self.current = arguments[i];
			var task = self.tasks[self.current] || (self.taskname ? tasks[self.taskname] && tasks[self.taskname][self.current] : null);
			if (task == null)
				continue;
			else {
				task.call(self, self);
				return self;
			}
		}
		self.done();
	}
	return self;
};

TaskBuilderProto.next2 = function(name) {
	var self = this;
	return function(err) {
		if (err)
			self.invalid(err);
		else {
			if (name == null)
				self.done();
			else
				self.next(name);
		}
	};
};

TaskBuilderProto.done = function(data) {
	var self = this;
	self.$callback && self.$callback(self.error && self.error.is ? self.error : null, data || self.value);
	self.$done = true;
	return self;
};

TaskBuilderProto.done2 = function(send_value) {
	var self = this;
	return function(err, data) {
		if (err)
			self.invalid(err);
		else
			self.done(send_value ? data : null);
	};
};

TaskBuilderProto.success = function(data) {
	return this.done(SUCCESS(true, data));
};

TaskBuilderProto.success2 = function(send_value) {
	var self = this;
	return function(err, data) {
		if (err)
			self.invalid(err);
		else
			self.done(SUCCESS(true, send_value ? data : null));
	};
};

TaskBuilderProto.callback = function(fn) {
	var self = this;
	self.$callback = fn;
	return self;
};

TaskBuilderProto.exec = function(name, callback) {
	var self = this;

	if (callback)
		self.$callback = callback;

	if (CONF.logger)
		self.$now = Date.now();

	self.next(name);
	return self;
};