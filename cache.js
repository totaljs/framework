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

var events = require('events');

/*
	Cache item class
	@id {String}
	@expire {Date}
	@value {Object}
*/
function CacheItem(id, expire, value) {
	this.id = id;
	this.expire = expire;
	this.value = value;
	this.isRemoved = false;
};

/*
	Cache class
	@application {Framework}
*/
function Cache(application) {
	this.repository = {};
	this.app = application;
	this.count = 1;
	this.interval = null;
};

// ======================================================
// PROTOTYPES
// ======================================================

Cache.prototype = new events.EventEmitter;

/*
	Cache init
	return {Cache}
*/
Cache.prototype.init = function(interval) {
	var self = this;

	self.interval = setInterval(function() {
		self.recycle();
	}, interval || 1000 * 60);

	return self;
};

Cache.prototype.stop = function() {
	var self = this;
	clearTimeout(self.interval);
	return self;
};

Cache.prototype.clear = function() {
	var self = this;
	self.repository = {};
	return self;
};

/*
	Internal function
	return {Cache}
*/
Cache.prototype.recycle = function() {

	var self = this;
	var repository = self.repository;
	var keys = Object.keys(repository);

	if (keys.length === 0) {
		self.emit('service', self.count++);
		return self;
	}

	var expire = new Date();

	keys.forEach(function(o) {
		if (repository[o].expire < expire)
			delete repository[o];
	});

	self.emit('service', self.count++);
	return self;
};

/*
	Add item to cache
	@name {String}
	@value {Object}
	@expire {Date}
	return @value
*/
Cache.prototype.write = function(name, value, expire) {
	var self = this;

	if (typeof(expire) === 'undefined')
		expire = new Date().add('m', 5);

	self.repository[name] = { value: value, expire: expire };
	return value;
};

/*
	Read item from cache
	@name {String}
	return {Object}
*/
Cache.prototype.read = function(name) {
	var self = this;
	var value = self.repository[name] || null;

	if (value === null)
		return null;

	return value.value;
};

/*
	Update cache item expiration
	@name {String}
	@expire {Date}
	return {Cache}
*/
Cache.prototype.setExpires = function(name, expire) {
	var self = this;
	var obj = self.repository[name];

	if (typeof(obj) === 'undefined')
		return self;

	obj.expire = expire;
	return self;
};

/*
	Remove item from cache
	@name {String}
	return {Object} :: return value;
*/
Cache.prototype.remove = function(name) {
	var self = this;
	var value = self.repository[name] || null;

	delete self.repository[name];
	return value;
};

/*
	Remove all
	@search {String}
	return {Number}
*/
Cache.prototype.removeAll = function(search) {
	var self = this;
	var count = 0;

	Object.keys(self.repository).forEach(function(o) {
		if (o.indexOf(search) !== -1) {
			self.remove(o);
			count++;
		}
	});

	return count;
};

/*
	Cache function value
	@name {String}
	@fnCache {Function} :: params, @value {Object}, @expire {Date}
	@fnCallback {Function} :: params, @value {Object}
	return {Cache}
*/
Cache.prototype.fn = function(name, fnCache, fnCallback) {

	var self = this;
	var value = self.read(name);

	if (value !== null) {
		fnCallback(value);
		return self;
	}

	fnCache(function(value, expire) {
		self.write(name, value, expire);
		fnCallback(value);
	});

	return self;
};

// ======================================================
// EXPORTS
// ======================================================

/*
	Init cache
	@application {Framework}
	return {Cache}
*/
exports.init = function(application) {
	return new Cache(application);
};