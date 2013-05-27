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

'use strict';

var utils = require('./utils');
var schema = {};
var schemaPrimary = {};

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

	if (typeof(primaryKey) === 'undefined')
		primaryKey = Object.keys(obj)[0];

	if (typeof(primaryKey) !== 'undefined')
		exports.primaryKey(name, primaryKey, insert);

	schema[name] = obj;
	return obj;
};

/*
	Create schema object
    @name {String}
    return {Object}
*/
exports.defaults = function(name) {

	var obj = exports.schema(name);

	if (obj === null)
		return null;

	var item = utils.extend({}, obj, true);
	var properties = Object.keys(item);

	properties.forEach(function(property) {

		var value = item[property];
		var def = null;
		var type = typeof(value);

		if (type === 'function') {

			if (value === Number) {
				item[property] = 0;
				return;
			}

			if (value === Boolean) {
				item[property] = false;
				return;
			}

			if (value === String) {
				item[property] = null;
				return;
			}

			if (value === Date) {
				item[property] = new Date();
				return;
			}

			item[property] = value();
			return;
		}

		if (type === 'number') {
			item[property] = 0;
			return;
		}

		if (type === 'boolean') {
			item[property] = false;
			return;
		}

		if (type !== 'string') {
			item[property] = null;
			return;
		}

		value = value.toLowerCase();

		if (value.contains('bool')) {
			item[property] = false;
			return;
		}

		if (value.contains(['text', 'varchar', 'nvarchar', 'binary', 'data', 'base64'])) {
			item[property] = null;
			return;
		}

		if (value.contains(['date', 'time'])) {
			item[property] = new Date();
			return;
		}

		if (value.contains(['int', 'number', 'decimal', 'byte', 'float', 'double'])) {
			item[property] = 0;
			return;
		}

		item[property] = null;
	});

	return item;
};

/*
	Prepare model to schema
    @name {String}
    @model {Object}
    return {Object}
*/
exports.prepare = function(name, model) {

	var obj = exports.schema(name);

	if (obj === null)
		return null;

	var item = utils.extend({}, obj, true);
	var properties = Object.keys(item);

	properties.forEach(function(property) {

		var val = model[property] || '';
		var value = item[property];
		var def = null;
		var type = typeof(value);
		var typeval = typeof(val);

		if (typeval === 'function')
			val = val();

		if (type === 'function') {

			if (value === Number) {
				item[property] = utils.parseFloat(val);
				return;
			}

			if (value === Boolean) {
				var tmp = val.toString();
				item[property] = tmp === 'true' || tmp === '1';
				return;
			}

			if (value === String) {
				item[property] = val.toString();
				return;
			}

			if (value === Date) {

				var tmp = null;

				switch (typeval) {
					case 'object':
						if (utils.isDate(val))
							tmp = val;
						else
							tmp = null;
						break;
					case 'number':
						tmp = new Date(val);
						break;

					case 'string':
						if (val === '')
							tmp = null;
						else
							tmp = val.parseDate();
						break;
				}

				if (typeof(tmp) === 'object' && tmp.toString() === 'Invalid Date')
					tmp = null;

				item[property] = tmp;
				return;
			}

			item[property] = null;
			return;
		}

		if (type === 'number') {
			item[property] = utils.parseFloat(val);
			return;
		}

		if (type === 'boolean') {
			var tmp = val.toString();
			item[property] = tmp === 'true' || tmp === '1';
			return;
		}

		if (type !== 'string') {
			item[property] = val.toString();
			return;
		}

		value = value.toLowerCase();

		if (value.contains('bool')) {
			var tmp = val.toString();
			item[property] = tmp === 'true' || tmp === '1';
			return;
		}

		if (value.contains(['text', 'varchar', 'nvarchar'])) {
			var tmp = val.toString();
			item[property] = tmp === 'true' || tmp === '1';
			return;
		}

		if (value.contains(['date', 'time'])) {

			if (typeval === 'date')
				return item[property] = val;

			if (typeval === 'string')
				return item[property] = val.parseDate();

			if (typeval === 'number')
				return item[property] = new Date(val);

			item[property] = null;
			return;
		}

		if (value.contains(['int', 'byte'])) {
			item[property] = utils.parseInt(val);
			return;
		}

		if (value.contains(['decimal', 'number', 'float', 'double'])) {
			item[property] = utils.parseFloat(val);
			return;
		}

		item[property] = null;
	});

	return item;
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

// ======================================================
// PROTOTYPES
// ======================================================

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
	@name {String} :: optional, default undefined
    return {Boolean}
*/
ErrorBuilder.prototype.hasError = function(name) {
	var self = this;

	if (name) {
		return self.builder.find(function(o) {
			return o.name === name;
		}) !== null;
	}

	return self.builder.length > 0;
};

/*
	Read error message
	@name {String}
	return {String}
*/
ErrorBuilder.prototype.read = function(name) {

	var error = this.builder.find(function(o) {
		return o.name === name;
	});

	if (error !== null)
		return error.error;

	return null;
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

	if (self.onResource === null)
		return self;

	self.builder.forEach(function(o) {

		if (o.error[0] !== '@')
			return;

		if (o.error.length === 1)
			o.error = self.onResource(o.name);
		else
			o.error = self.onResource(o.error.substring(1));
	});

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

	if (typeof(name) === 'object') {
		Object.keys(name).forEach(function(o) {
			self.builder[o] = name[o];
		});
		return;
	}

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

exports.ErrorBuilder = ErrorBuilder;
exports.PageBuilder = PageBuilder;
exports.UrlBuilder = UrlBuilder;