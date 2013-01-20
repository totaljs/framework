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

var events = require('events');

function CacheItem(id, expire, value) {
	this.id = id;
	this.expire = expire;
	this.value = value;
	this.isRemoved = false;
};

function Cache(application) {
	this.repository = {};
	this.app = application;
	this.runner = 0;
};

// ======================================================
// PROTOTYPES
// ======================================================

Cache.prototype = new events.EventEmitter;

Cache.prototype.init = function() {
	var self = this;
	setInterval(function() { self.recycle(); }, 1000 * 60);
	return self;
};

Cache.prototype.recycle = function() {
	
	var self = this;
	var repository = self.repository;
	var keys = Object.keys(repository);

	if (keys.length > 0) {
	
		var expire = new Date();
		
		keys.forEachAsync(function(o) {

			if (repository[o].expire < expire)
				delete repository[o];

		}, function() {
			self.emit('service', self.runner++);
		});
		return;

	}

	self.emit('service', self.runner++);
};

Cache.prototype.write = function(name, value, expire) {
	var self = this;

	if (typeof(expire) === 'undefined')
		expire = new Date().add('m', 5);

	self.repository[name] = { value: value, expire: expire };
	return value;
};

Cache.prototype.read = function(name) {
	var self = this;	
	var value = self.repository[name] || null;
	
	if (value === null)
		return null;
	else
		return value.value;

	return self;
};

Cache.prototype.remove = function(name) {
	var self = this;
	var value = self.repository[name] || null;
	
	delete self.repository[name];
	return value;
};

// ======================================================
// EXPORTS
// ======================================================

exports.init = function(application) {
	return new Cache(application);
};