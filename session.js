const Fs = require('fs');

function Session() {
	var t = this;
	t.items = null;
	t.load();
	t.saveforce = function() {
		Fs.writeFile(PATH.databases('sessions.json'), JSON.stringify(t.items), ERROR());
	};
}

Session.prototype.getcookie = function(opt) {

	// opt.req
	// opt.key
	// opt.strict
	// opt.value

	var self = this;
	var cookie = opt.req.cookie(opt.cookie);

	if (!cookie || cookie.length < 15) {
		opt.callback(null, null);
		return;
	}

	var value = DECRYPTREQ(opt.req, cookie, opt.key);
	if (value) {
		opt.id = value.id;
		opt.sessionid = value.sessionid;
		self.get(opt);
	} else
		opt.callback(null, null);
};

Session.prototype.setcookie = function(opt) {

	// opt.req
	// opt.key
	// opt.strict

	var self = this;
	var obj = {};

	if (opt.id)
		obj.id = opt.id;

	if (opt.sessionid)
		obj.sessionid = opt.sessionid;

	var callback = opt.callback;

	opt.callback = function(err) {
		if (err)
			callback(err);
		else
			callback(null, ENCRYPTREQ(opt.req, obj, opt.key || '', opt.strict));
	};

	self.set(opt);
};

Session.prototype.rem = function(opt) {

	var self = this;
	var count = 0;

	if (opt.id && self.items[opt.id]) {
		count++;
		delete self.items[opt.id];
	}

	if (opt.sessionid && self.items[opt.sessionid]) {
		count++;
		delete self.items[opt.sessionid];
	}

	opt.callback && opt.callback(null, count);
};

Session.prototype.set = function(opt) {

	// opt.id
	// opt.sessionid
	// opt.value

	var self = this;
	var obj = {};

	if (opt.id)
		obj.id = opt.id;

	if (opt.sessionid)
		obj.sessionid = opt.sessionid;

	obj.expire = typeof(obj.expire) === 'string' ? NOW.add(obj.expire) : obj.expire instanceof Date ? obj.expire.getTime() : 0;
	obj.value = opt.value;

	if (opt.id)
		self.items[opt.id] = obj;

	if (opt.sessionid)
		self.items[opt.sessionid] = obj;

	opt.callback && opt.callback(null, obj);
};

Session.prototype.get = function(opt) {

	// opt.id
	// opt.sessionid
	// opt.value

	var self = this;
	var meta = self.items[opt.id || opt.sessionid];

	if (opt.callback) {

		if (meta) {
			opt.callback(null, meta.value, meta);
			if (opt.expire) {
				meta.expire = opt.expire;
				self.set(meta);
			}
		} else
			opt.callback(null, null);
	}
};

Session.prototype.clear = function(callback) {

	var self = this;
	var keys = Object.keys(self.items);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var item = self.items[key];
		if (item == null || item.expire < NOW) {
			delete self.items[key];
		}
	}

	callback && callback();
};

Session.prototype.load = function() {
	var self = this;
	try {
		var data = Fs.readFileSync(PATH.databases('sessions_' + self.name + '.json'));
		self.items = data.toString('utf8').parseJSON(true) || {};
	} catch (e) {}
};

Session.prototype.save = function() {
	var self = this;
	clearTimeout(self.timeout);
	self.timeout = setTimeout(self.saveforce, 20000);
};

global.SESSION = new Session();
