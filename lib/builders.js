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

var utils = require('./utils');
var schema = {};
var schemaPrimary = {};

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

/*
    @onResource {Function} :: function(name, key) return {String}
*/
function ErrorBuilder(onResource) {
	this.builder = [];
	this.onResource = onResource || null;
	this.length = 0;
};

function UrlBuilder() {
	this.builder = {};
};

/*
    @items {Number}
    @page {Number}
    @max {Number}
*/
function PageBuilder(items, page, max) {
	this.isNext = false;
	this.isPrev = false;
	this.items = items;
	this.count = 0;
	this.skip = 0;
	this.take = 0;
	this.page = 0;
	this.max = 0;
	this.visible = false;
	this.refresh(items, page, max);
};

/*
	Create object schema
    @name {String}
    @obj {Number}
    @primaryKey {Boolean}
    @insert {Boolean} :: optional (insert primary key?)
    return {Object}
*/
exports.schema = function(name, obj, primaryKey, insert) {

	if (typeof(obj) === 'undefined')
		return schema[name] || null;

	if (typeof(primaryKey) !== 'undefined')
		exports.primaryKey(name, primaryKey, insert);

	schema[name] = obj;
	return obj;
};

/*
	Set primary key
    @schema {String}
    @name {String}
    @insert {Boolean} :: optional (insert primary key?)
    return {Exports}
*/
exports.primaryKey = function(schema, name, insert) {

	if (typeof(name) === 'undefined')
		return schemaPrimary[schema] || null;

	schemaPrimary[schema] = { name: name, insert: insert || false };
	return exports;
};

/*
	Order by ASC
    @name {String}
    return {OrderBuilder}
*/
exports.orderByAsc = function(name) {
	return new OrderBuilder().asc(name);
};

/*
	Order by Desc
    @name {String}
    return {OrderBuilder}
*/
exports.orderByDesc = function(name) {
	return new OrderBuilder().desc(name);
};

/*
	Order by Desc
    @name {String}
    @desc {Boolean}
    return {OrderBuilder}
*/
exports.orderBy = function(name, desc) {
	return new OrderBuilder().order(name, desc);
};

// ======================================================
// PROTOTYPES
// ======================================================

/*
	Add operator (AND, OR)
    @name {String}
    return {QueryBuilder}
*/
QueryBuilder.prototype.addOperator = function(name) {
	var self = this;

	if (self.builder.length > 0)
		self.builder.push(name);

	return self;
};

/*
	Add value
    @name {String}
    @operator {String}
    @value {Object}
    @raw {Boolean} :: optional, default false
    return {QueryBuilder}
*/
QueryBuilder.prototype.addValue = function(name, operator, value, raw) {
	var self = this;
		
	if (raw) {		
		self.builder.push(name + operator + (value || '').toString());
		return self;
	}

	var param = 'param' + self.paramIndexer;
	self.builder.push(name + operator + '{' + param + '}');
	self.params[param] = value;
	self.paramIndexer++;

	return self;
};

/*
	Add query
    @value {String} :: podporuje parametrický formát: string.format('WHERE Id={0} AND Price>{1}'), example: addBetween
    return {QueryBuilder}
*/
QueryBuilder.prototype.addQuery = function(value) {

	var self = this;
	var params = [];

	for (var i = 1; i < arguments.length; i++) {
		var param = 'param' + self.paramIndexer;
		self.params[param] = arguments[i];
		self.paramIndexer++;
		params.push('{' + param + '}');
	};

	self.builder.push(value.format.apply(value, params));
	return self;
};

/*
	Add BETWEEN
    @value {String} :: podporuje parametrický formát: string.format('WHERE Id={0} AND Price>{1}')
    return {QueryBuilder}
*/
QueryBuilder.prototype.addBetween = function(name, a, b) {
	return this.addQuery(name + ' BETWEEN {0} AND {1}', a, b);
};

/*
	Add parameter
	@name {String}
    @value {Object}
    return {QueryBuilder}
*/
QueryBuilder.prototype.addParameter = function(name, value) {
	var self = this;
	self.params[name] = value;
	return self;	
};

/*
	Add value
    @value {String}
    return {QueryBuilder}
*/
QueryBuilder.prototype.add = function(value) {
	var self = this;
	self.builder.push(value);
	return self;
};

/*
	Add builder
    @builder {QueryBuilder}
    return {QueryBuilder}
*/
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
			self.params[o] = builder.params[o];
		});
	}

	return self;
};

/*
	Clear QueryBuilder
    return {QueryBuilder}
*/
QueryBuilder.prototype.clear = function() {
	var self = this;
	self.params = {};
	self.builder = [];
	return self;
};

/*
    return {Boolean}
*/
QueryBuilder.prototype.hasParameter = function() {
	return Object.keys(this.params).length > 0;
};

/*
    return {Boolean}
*/
QueryBuilder.prototype.hasValue = function() {
	return this.builder.length > 0;
};

/*
	Join builder to String
    return {String}
*/
QueryBuilder.prototype.toString = function(appendWhere) {
	var self = this;
	return (appendWhere && self.builder.length > 0 ? ' WHERE ' : '') + self.builder.join(' ');
};

/*
	Order by ASC
	@name {String}	
    return {OrderBuilder}
*/
OrderBuilder.prototype.asc = function(name) {
	var self = this;
	self.builder.push({ type: 'asc', name: name });
	return self;
};

/*
	Order by DESC
	@name {String}	
    return {OrderBuilder}
*/
OrderBuilder.prototype.desc = function(name) {
	var self = this;
	self.builder.push({ type: 'desc', name: name });
	return self;
};

/*
	Order by
	@name {String}
	@desc {Boolean}
    return {OrderBuilder}
*/
OrderBuilder.prototype.order = function(name, desc) {
	var self = this;
	return desc ? self.desc(name) : self.asc(name);
};

/*
	Clear order by
    return {OrderBuilder}
*/
OrderBuilder.prototype.clear = function() {
	var self = this;
	self.builder = [];
	return self;
};

/*
    return {Boolean}
*/
OrderBuilder.prototype.hasValue = function() {
	return this.builder.length > 0;
}

/*
	Add a new parameter
    @name {String}
    @value {Object}
    return {ParameterBuilder}
*/
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

/*
	Read parameter
    @name {String}
    return {Object}
*/
ParameterBuilder.prototype.read = function(name) {
	return this.params[name];
};

/*
	Update parameter value
    @name {String}
    value {Object}
    return {ParameterBuilder}
*/
ParameterBuilder.prototype.update = function(name, value) {
	return this.add(name, value);
};

/*
	Clear all parameters
    return {ParameterBuilder}
*/
ParameterBuilder.prototype.clear = function() {
	var self = this;
	self.params = {};
	return self;
};

/*
    return {Boolean}
*/
ParameterBuilder.prototype.hasValue = function() {
	var self = this;
	return Object.keys(self.params).length > 0;
};

/*
	Add a new error
	@name {String or ErrorBuilder}
	@error {String} :: default value @ (for resources)
    return {ErrorBuilder}
*/
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

/*
	Remove error
	@name {String}
    return {ErrorBuilder}
*/
ErrorBuilder.prototype.remove = function(name) {
	var self = this;
	self.builder = self.builder.remove(function(o) {
		return o.name === name;
	});
	self.length = self.builder.length;
	return self;
};

/*
    return {Boolean}
*/
ErrorBuilder.prototype.hasError = function() {
	return this.builder.length > 0;
};

/*
	Clear ErrorBuilder
    return {ErrorBuilder}
*/
ErrorBuilder.prototype.clear = function() {
	var self = this;
	self.builder = [];
	self.length = 0;
	return self;
};

/*
	Serialize ErrorBuilder to JSON format
    return {String}
*/
ErrorBuilder.prototype.json = function() {
	return JSON.stringify(this.prepare().builder);
};

/*
	Serialize ErrorBuilder to JSON format
    return {String}
*/
ErrorBuilder.prototype.JSON = function() {
	return JSON.stringify(this.prepare().builder);
};

/*
	Prepare builder with Resources
    return {ErrorBuilder}
*/
ErrorBuilder.prototype.prepare = function() {
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

	return self;
};

/*
	Refresh PageBuilder
	@items {Number}
	@page {Number}
	@max {Number}
    return {PageBuilder}
*/
PageBuilder.prototype.refresh = function(items, page, max) {
	var self = this;

	self.count = Math.floor(items / max) + (items % max > 0 ? 1 : 0);
	self.page = page - 1;
	
	if (self.page < 0)
		self.page = 0;

	self.items = items;
	self.skip = self.page * max;
	self.take = max;
	self.max = max;
	self.visible = self.count > 1;
	self.isPrev = self.page > 0;
	self.isNext = self.page < self.count - 1;
	self.visible = self.count > 1;
	self.page++;

	return self;
};

/*
	Render PageBuilder
	@fn {Function} :: function(pageIndex)
	@max {Number} :: optional, default undefined
    return {Array}
*/
PageBuilder.prototype.render = function(fn, max) {

	var self = this;
	var builder = [];

	if (typeof(max) === 'undefined') {
		for (var i = 1; i < self.count + 1; i++)
			builder.push(fn(i, i === self.page));
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

	for (var i = pageFrom; i < pageTo + 1; i++)
		builder.push(fn(i, i === self.page));

	return builder;
};

/*
	Add parameter to UrlBuilder
	@name {String}
	@value {String}
    return {UrlBuilder}
*/
UrlBuilder.prototype.add = function(name, value) {
	var self = this;
	self.builder[name] = value;
	return self;
};

/*
	Remove parameter from UrlBuilder
	@name {String}
    return {UrlBuilder}
*/
UrlBuilder.prototype.remove = function(name) {
	var self = this;
	delete self.builder[name];
	return self;
};

/*
	Read parameter
	@name {String}
    return {Object}
*/
UrlBuilder.prototype.read = function(name) {
	return this.builder[name] || null;
};

/*
	Remove all keys
    return {UrlBuilder}
*/
UrlBuilder.prototype.clear = function() {
	var self = this;
	self.builder = {};
	return self;
}

/*
	Create URL
    return {String}
*/
UrlBuilder.prototype.toString = function() {

	var self = this;
	var builder = [];

	Object.keys(self.builder).forEach(function(o) {
		builder.push(o + '=' + encodeURIComponent(self.builder[o] || ''));
	});

	return builder.join('&');
};

/*
	Has UrlBuilder values?
	@keys {String or String array}
    return {Boolean}
*/
UrlBuilder.prototype.hasValue = function(keys) {

	if (typeof(keys) === 'undefined')
		return false;

	var self = this;

	if (typeof(keys) === 'string')
		keys = [keys];

	for (var i = 0; i < keys.length; i++) {
		var val = self.builder[keys[i]];
		if (typeof(val) === 'undefined' || val === null)
			return false;
	}

	return true;
};

/*
	Render parameter
	@keys {String array} :: what parameter
	@divider {String}
    return {String}
*/
UrlBuilder.prototype.toOne = function(keys, divider) {
	
	var self = this;
	var builder = [];

	keys.forEach(function(o) {
		builder.push(self.builder[o] || '');
	});

	return builder.join(divider);
};

// ======================================================
// EXPORTS
// ======================================================

exports.asc = function(name) {
	return new OrderBuilder().asc(name);
};

exports.desc = function(name) {
	return new OrderBuilder().desc(name);
};

exports.QueryBuilder = QueryBuilder;
exports.OrderBuilder = OrderBuilder;
exports.ParameterBuilder = ParameterBuilder;
exports.ErrorBuilder = ErrorBuilder;
exports.PageBuilder = PageBuilder;
exports.UrlBuilder = UrlBuilder;