var fs = require('fs');
var utils = require('./utils');

function CacheItem(id, expire, value) {
	this.id = id;
	this.expire = expire;
	this.value = value;
	this.isRemoved = false;
};

function Cache(application) {
	this.cache = [];
	this.app = application;
	this.runner = 0;

	function recycle() {
		
		var expire = new Date();

		self.cache.removeAsync(function(o) {
			return (expire < o.expire && !o.isRemoved);
		}, function (arr) {
			self.cache = arr;
			self.app.emit('service', self.runner++, self);
		});

	}

	this.init = function() {
		setInterval(recycle, 1000 * 60);
	};	

	this.write = function(name, value, expire) {
		
		var cache = self.cache;
		var obj = find(cache, name);

		if (obj == null) {
			obj = new CacheItem(name, expire, value);
			cache.push(obj);
			return value;
		}

		obj.value = value;
		obj.expire = expire;
		
		return value;
	};

	this.fileWrite = function(fileName, value) {
		fs.writeFileSync(fileName, value);
		return value;
	};

	this.fileRead = function(fileName, expireMinute, onEmpty) {

		if (!fs.existsSync(fileName))
			return onEmpty(fileName);

		var stats = fs.statSync(fileName);
		var now = new Date();
		
		if (stats.mtime.add('mm', expireMinute) < now)
			return onEmpty(fileName);

		return fs.readFileSync(fileName).toString();
	};

	this.read = function(name) {
		var value = find(self.cache, name);
		if (value == null)
			return null;

		return value.value;
	};

	this.remove = function(name) {
		self.cache.findAsync(function(obj) {
			return obj.id == name;
		}, function (obj) {
			obj.isRemoved = true;
		});
	};	

	function find(arr, name) {
		for (var i = 0; i < arr.length; i++) {
			var o = arr[i];
			if (o.id === name && !o.isRemoved)
				return o;
		}
		return null;
	};

	var self = this;
};

exports.init = function(application) {
	return new Cache(application);
};