var fs = require('fs');

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
		
		var cache = self.cache;
		
		if (cache.length == 0)
			return;

		var expire = new Date();
		var tmp = [];

		cache.forEach(function(o) {
			if (expire < o.expire && !o.isRemoved)
				tmp.push(o);
		});

		if (tmp.length != cache.length)
			self.cache = tmp;

		self.app.emit('service', self.runner++, self);
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
		var o = find(self.cache, name);
		if (o != null)
			o.isRemoved = true;
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