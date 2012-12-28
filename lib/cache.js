var fs = require('fs');
var utils = require('./utils');

function CacheItem(id, expire, value) {
	this.id = id;
	this.expire = expire;
	this.value = value;
	this.isRemoved = false;
};

function Cache(application) {
	this.repository = [];
	this.app = application;
	this.runner = 0;

	function recycle() {
		
		var repository = self.repository;
		
		if (repository.length == 0)
			return;

		var expire = new Date();
		repository.removeAsync(function(o) {
			return (expire < o.expire && !o.isRemoved);
		}, function (arr) {
			self.repository = arr;
			self.onRecycle(self.runner);
			self.app.emit('service', self.runner++, self);
		});
	};

	// handler function(runner) {};
	this.onRecycle = null;

	this.init = function() {
		setInterval(recycle, 1000 * 60);
		return self;
	};	

	this.write = function(name, value, expire, cb) {		
		var repository = self.repository;
		find(repository, name, function(obj) {

			if (obj == null) {
				obj = new CacheItem(name, expire, value);
				repository.push(obj);
				cb(value);
				return;
			}

			obj.id = name;
			obj.value = value;
			obj.expire = expire;
			cb(value);
		});
	};

	this.fileWrite = function(fileName, value) {
		fs.writeFile(fileName, value);
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

	this.read = function(name, cb) {
		find(self.repository, name, function(o) {
			cb(o == null ? null : o.value);
		});
	};

	this.remove = function(name, cb) {
		find(self.repository, name, function(o) {
			
			if (o == null) {
				cb(null);
				return;
			}

			o.isRemoved = true;
			cb(o.value);
		});
	};	

	function find(arr, name, cb) {
		arr.findAsync(function(o) {
			return o.id === name && !o.isRemoved;
		}, cb);
	};

	var self = this;
};

exports.init = function(application) {
	return new Cache(application);
};