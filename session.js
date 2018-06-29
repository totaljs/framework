const Sessions = {};

global.SESSION = function(group) {
	return Sessions[group] ? Sessions[group] : (Sessions[group] = new Session(group));
};

function Session(group) {
	var t = this;
	t.group = group;
	t.data = {};
	t.$events = {};
	t.expire = F.config['default-session'];
}

var SP = Session.prototype;

SP.set = function(id, data) {
	var self = this;
	var session = data;
	session.$id = id;
	session.$expire = NOW.add(self.expire).getTime();
	self.data[id] = session;
	self.$events.set && self.emit('set', session);
	return id;
};

SP.list = function() {
	var self = this;
	var arr = Object.keys(self.data);
	var online = [];
	for (var i = 0; i < arr.length; i++) {
		var item = self.data[arr[i]];
		item.$expire && online.push(item);
	}
	return online;
};

SP.count = function() {
	return this.list().length;
};

SP.get = function(key, noextend) {
	var item = this.data[key];
	if (item && item.$expire) {
		!noextend && (item.$expire = NOW.add(this.expire));
		return item;
	}
};

SP.remove = function(key) {

	var self = this;
	var item;

	if (key instanceof Object) {
		key.$expire = 0;
		item = key;
	} else if (self.data[key]) {
		item = self.data[key];
		delete self.data[key];
	}

	item && self.$events.remove && self.emit('remove', key);
	return self;
};

SP.clear = function() {
	var self = this;
	self.$events.clear && self.emit('clear');
	self.data = {};
	return self;
};

SP.clean = function() {
	var self = this;
	var arr = Object.keys(self.data);
	var time = NOW.getTime();
	for (var i = 0; i < arr.length; i++) {
		var key = arr[i];
		var obj = self.data[key];
		if (!obj.$expire || obj.$expire < time) {
			obj.$expire && self.$events.expire && self.emit('expire', obj);
			delete self.data[key];
		}
	}
	return self;
};

SP.emit = function(name, a, b, c, d, e, f, g) {
	var evt = this.$events[name];
	if (evt) {
		var clean = false;
		for (var i = 0, length = evt.length; i < length; i++) {
			if (evt[i].$once)
				clean = true;
			evt[i].call(this, a, b, c, d, e, f, g);
		}
		if (clean) {
			evt = evt.remove(n => n.$once);
			if (evt.length)
				this.$events[name] = evt;
			else
				this.$events[name] = undefined;
		}
	}
	return this;
};

SP.on = function(name, fn) {

	if (!fn.$once)
		this.$free = false;

	if (this.$events[name])
		this.$events[name].push(fn);
	else
		this.$events[name] = [fn];
	return this;
};

SP.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

SP.removeListener = function(name, fn) {
	var evt = this.$events[name];
	if (evt) {
		evt = evt.remove(n => n === fn);
		if (evt.length)
			this.$events[name] = evt;
		else
			this.$events[name] = undefined;
	}
	return this;
};

SP.removeAllListeners = function(name) {
	if (name === true)
		this.$events = EMPTYOBJECT;
	else if (name)
		this.$events[name] = undefined;
	else
		this.$events[name] = {};
	return this;
};

ON('service', function(interval) {
	if (interval % 5 === 0) {
		var arr = Object.keys(Sessions);
		for (var i = 0; i < arr.length; i++)
			Sessions[arr[i]].clean();
	}
});

F.session = global.SESSION;
exports.Session = Session;