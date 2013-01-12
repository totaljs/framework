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

function ParameterBuilder() {
	this.params = {};
};

function QueryBuilder () {
	this.builder = [];
	this.params = {};
	this.paramIndexer = utils.random(10000);
};

 function OrderBuilder() {
 	this.builder = [];
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
	builder.push(value);
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

// ======================================================
// EXPORTS
// ======================================================

exports.version = "0.0.1";
exports.QueryBuilder = QueryBuilder;
exports.OrderBuilder = OrderBuilder;
exports.ParameterBuilder = ParameterBuilder;
