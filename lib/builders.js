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

var utils = require('./utils'),
	schema = {},
	schemaPrimary = {};

function ParameterBuilder() {
	this.params = {};
	this.schema = null;
};

function QueryBuilder () {
	this.builder = [];
	this.params = {};
	this.paramIndexer = utils.random(10000);
	this.schema = null;
};

function OrderBuilder() {
 	this.builder = [];
};

function ErrorBuilder(onResource) {
	this.builder = [];
	this.onResource = onResource || null;
	this.length = 0;
};

function UrlBuilder() {
	this.builder = {};
};

function PageBuilder(items, page, max) {
	this.isNext = false;
	this.isPrev = false;
	this.items = items;
	this.count = 0;
	this.itemSkip = 0;
	this.itemTake = 0;
	this.page = 0;
	this.max = 0;
	this.visible = false;
	this.refresh(items, page, max);
};

exports.schema = function(name, obj, primaryKey, insert) {

	if (typeof(obj) === 'undefined')
		return schema[name] || null;

	if (typeof(primaryKey) !== 'undefined')
		exports.primaryKey(name, primaryKey, insert);

	schema[name] = obj;
};

exports.primaryKey = function(schema, name, insert) {

	if (typeof(name) === 'undefined')
		return schemaPrimary[schema] || null;

	schemaPrimary[schema] = { name: name, insert: insert || false };
	return exports;
};

exports.orderByAsc = function(name) {
	return new OrderBuilder().asc(name);
};

exports.orderByDesc = function(name) {
	return new OrderBuilder().desc(name);
};

exports.orderBy = function(name, desc) {
	return new OrderBuilder().order(name, desc);
};

// ======================================================
// PROTOTYPES
// ======================================================

QueryBuilder.prototype.addOperator = function(name) {
	var self = this;

	if (self.builder.length > 0)
		self.builder.push(name);

	return self;
};

QueryBuilder.prototype.addValue = function(name, operator, value, raw) {
	var self = this;
	
	if (raw) {
		self.builder.push(name + operator + value);
		return self;
	}

	var param = 'param' + self.paramIndexer;
	self.builder.push(name + operator + '{{' + param + '}}');
	self.params[param] = value;
	self.paramIndexer++;

	return self;
};

QueryBuilder.prototype.addQuery = function(value) {

	var self = this;
	var params = [];

	for (var i = 1; i < arguments.length; i++) {
		var param = 'param' + self.paramIndexer;
		self.params[param] = arguments[i];
		self.paramIndexer++;
		params.push(param);
	};

	self.builder.push(value.format.apply(value, params));
	return self;
};

QueryBuilder.prototype.addParameter = function(name, value) {
	var self = this;
	self.params[name] = value;
	return self;	
};

QueryBuilder.prototype.add = function(value) {
	var self = this;
	self.builder.push(value);
	return self;
};

QueryBuilder.prototype.addBuilder = function(builder) {
	var self = this;

	if (builder instanceof QueryBuilder) {

		builder.builder.forEach(function(o) {
			self.builder.push(o);
		});

		Object.keys(builder.params).forEach(function(name) {
			self.params[name] = builder.params[name];
		});

	} else if (builder instanceof ParameterBuilder) {
		Object.keys(builder.params).forEach(function(o) {
			self.params[o] = value[o];
		});
	}

	return self;
};

QueryBuilder.prototype.clear = function() {
	var self = this;
	self.params = {};
	self.builder = [];
	return self;
};

QueryBuilder.prototype.hasParameter = function() {
	return Object.keys(this.params).length > 0;
};

QueryBuilder.prototype.hasValue = function() {
	return this.builder.length > 0;
};

QueryBuilder.prototype.toString = function() {
	return builder.join('');
};

OrderBuilder.prototype.asc = function(name) {
	var self = this;
	self.builder.push({ type: 'asc', name: name });
	return self;
};

OrderBuilder.prototype.desc = function(name) {
	var self = this;
	self.builder.push({ type: 'desc', name: name });
	return self;
};

OrderBuilder.prototype.order = function(name, desc) {
	var self = this;
	return desc ? self.desc(name) : self.asc(name);
};

OrderBuilder.prototype.clear = function() {
	var self = this;
	self.builder = [];
	return self;
};

OrderBuilder.prototype.hasValue = function() {
	return this.builder.length > 0;
}

ParameterBuilder.prototype.add = function(name, value) {
	var self = this;

	if (typeof(name) === 'object') {

		Object.keys(name).forEach(function(o) {
			self.params[o] = name[o];
		});

		return self;
	}

	self.params[name] = value;
	return self;
};

ParameterBuilder.prototype.read = function(name) {
	return this.params[name];
};

ParameterBuilder.prototype.update = function(name, value) {
	return this.add(name, value);
};

ParameterBuilder.prototype.clear = function() {
	var self = this;
	self.params = {};
	return self;
};

ParameterBuilder.prototype.hasValue = function() {
	var self = this;
	return Object.keys(self.params).length > 0;
};

ErrorBuilder.prototype.add = function(name, error) {
	var self = this;

	if (name instanceof ErrorBuilder) {

		name.builder.forEach(function(o) {
			self.builder.push(o);
		});
		
		self.length = self.builder.length;
		return self;
	};

	self.builder.push({ name : name, error: error || '@' });
	self.length = self.builder.length;
	return self;
};

ErrorBuilder.prototype.remove = function(name) {
	var self = this;
	self.builder = self.builder.remove(function(o) {
		return o.name === name;
	});
	self.length = self.builder.length;
	return self;
};

ErrorBuilder.prototype.hasError = function() {
	return this.length > 0;
};

ErrorBuilder.prototype.clear = function() {
	var self = this;
	self.builder = [];
	self.length = 0;
	return self;
};

ErrorBuilder.prototype.json = function() {

	var self = this;

	if (self.onResource !== null) {
		self.builder.forEach(function(o) {
			if (o.error[0] === '@') {
				if (o.error.length === 1) {
					o.error = self.onResource(o.name);
				}
				else
					o.error = self.onResource(o.error.substring(1));
			}
		});
	}

	return self.builder;
};


PageBuilder.prototype.refresh = function (items, page, max) {
	var self = this;

	self.count = Math.floor(items / max) + (items % max > 0 ? 1 : 0);
	self.page = page - 1;
	
	if (self.page < 0)
		self.page = 0;

	self.items = items;
	self.itemSkip = self.page * max;
	self.itemTake = max;
	self.max = max;
	self.visible = self.count > 1;
	self.isPrev = self.page > 0;
	self.isNext = self.page < self.count - 1;
	self.visible = self.count > 1;
	self.page++;

	return self;
};

PageBuilder.prototype.render = function(fn, max) {
	var self = this;

	if (typeof(max) === 'undefined') {		
		for (var i = 1; i < self.count + 1; i++)
			fn(i);
		return;
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

	for (var i = pageFrom; i < pageTo + 1; i++)
		fn(i);

	return self;
};


UrlBuilder.prototype.add = function(name, value) {
	var self = this;
	self.builder[name] = value;
	return self;
};

UrlBuilder.prototype.remove = function(name) {
	var self = this;
	delete self[name];
	return self;
};

UrlBuilder.prototype.read = function(name) {
	return this[name];
};

UrlBuilder.prototype.toString = function() {

	var self = this;
	var builder = [];

	Object.keys(self.builder).forEach(function(o) {
		builder.push(o + '=' + encodeURIComponent(self.builder[o] || ''));
	});

	return builder.join('&');
};

UrlBuilder.prototype.hasValue = function(arr) {

	if (typeof(arr) === 'undefined')
		return false;

	var self = this;

	if (typeof(arr) === 'string')
		arr = [arr];

	for (var i = 0; i < arr.length; i++) {
		var val = self.builder[arr[i]];
		if (typeof(val) === 'undefined' || val === null)
			return false;
	}

	return true;
};

UrlBuilder.prototype.toOne = function(arr, divider) {
	
	var self = this;
	var builder = [];

	arr.forEach(function(o) {
		builder.push(self.builder[o] || '');
	});

	return builder.join(divider);
};

// ======================================================
// EXPORTS
// ======================================================

exports.version = "0.0.4";
exports.QueryBuilder = QueryBuilder;
exports.OrderBuilder = OrderBuilder;
exports.ParameterBuilder = ParameterBuilder;
exports.ErrorBuilder = ErrorBuilder;
exports.PageBuilder = PageBuilder;
exports.UrlBuilder = UrlBuilder;