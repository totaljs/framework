require('./index');

const COOKIEOPTIONS = { httponly: true, security: 'lax' };
const sessions = {};
const Fs = require('fs');
const filename = 'sessions{0}.txt';

function Session(name) {
	var t = this;
	var timeoutsave = null;

	t.name = name || '';
	t.items = new Map();
	t.$savecallback = ERROR('session.save');

	// t.onremove = function(item)
	// t.ondata = function(item, next(err, data))

	t.$save = function() {
		timeoutsave && clearTimeout(timeoutsave);
		timeoutsave = setTimeout(t.$saveforce, 1000 * 10); // 10 seconds
	};

	t.$saveforce = function() {
		var storage = [];
		for (var m of t.items.values()) {
			if (m.expire > NOW)
				storage.push(m.uid + ';' + (m.id || '') + ';' + m.expire.getTime());
			else {
				self.onremove && self.onremove(m);
				t.items.delete(m.uid);
			}
		}
		Fs.writeFile(PATH.databases(filename.format((t.name ? ('_' + t.name) : ''))), storage.join('\n'), t.$savecallback);
		timeoutsave = null;
	};
}

Session.prototype.find = function(filter, callback) {

	var self = this;
	var keys = Object.keys(filter);
	var arr = [];
	var is = false;

	for (var m of self.items.values()) {
		if (m && m.data && m.expire >= NOW) {
			is = true;
			for (var j = 0; j < keys.length; j++) {
				var key = keys[j];
				if (m.data[key] !== filter[key]) {
					is = false;
					break;
				}
			}
			is && arr.push(m);
		} else {
			self.onremove && self.onremove(m);
			self.items.delete(m.uid);
			self.$save();
		}
	}

	callback(null, arr);
};

Session.prototype.has = function(uid, callback) {
	callback(null, this.items.has(uid));
};

Session.prototype.getcookie = function(req, opt, callback) {

	// opt.name {String} A cookie name
	// opt.expire {String} Expiration
	// opt.key {String} Encrypt key
	// opt.extendcookie {Boolean} Extends cookie expiration (default: true)

	if (req.req)
		req = req.req;

	var token = req.cookie(opt.name);
	if (!token || token.length < 20) {
		callback();
		return;
	}

	var value = DECRYPTREQ(req, token, opt.key);
	if (value) {
		value = value.split(';');
		if (opt.expire && opt.extendcookie !== false)
			req.res.cookie(opt.name, token, opt.expire, COOKIEOPTIONS);
		this.get(value[0], opt.expire, callback);
	} else
		callback();
};

Session.prototype.refresh = function(uid, expire, callback) {
	if (typeof(expire) === 'function') {
		callback = expire;
		expire = null;
	}
	var self = this;
	var item = self.items.get(uid);
	if (item)
		item.data = null;
	if (callback) {
		if (item)
			self.get(uid, expire, callback);
		else
			callback();
	}
};

Session.prototype.refresh2 = function(id, expire, callback) {

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = null;
	}

	var self = this;
	var count = 0;

	if (expire)
		expire = NOW.add(expire);

	for (var m of self.items.values()) {
		if (m && m.id === id) {
			m.data = null;
			count++;
			if (expire)
				m.expire = expire;
		}
	}
	callback && callback(null, count);
};

Session.prototype.setcookie = function(res, opt, callback) {

	// opt.name {String} A cookie name
	// opt.uid {String} A unique session ID
	// opt.id {String} Optional, custom ID
	// opt.expire {String} Expiration
	// opt.strict {Boolean} Strict comparing of cookie according to IP (default: false)
	// opt.key {String} Encrypt key
	// opt.data {Object} A session data

	if (res.res)
		res = res.res;

	this.set(opt.uid, opt.id, opt.data, opt.expire, function(err, item, meta) {
		if (err) {
			callback && callback(err);
		} else {
			var data = opt.uid + ';' + (opt.id || '');
			var token = ENCRYPTREQ(res.req, data, opt.key, opt.strict);
			res.cookie(opt.name, token, opt.expire, COOKIEOPTIONS);
			callback && callback(null, item, meta);
		}
	});
};

Session.prototype.set2 = function(id, data, expire, callback) {

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = '';
	}

	var self = this;
	var updated = 0;

	for (var m of self.items.values()) {
		if (m && m.id === id) {
			m.data = data;
			if (expire)
				m.expire = NOW.add(expire);
			updated++;
		}
	}

	callback && callback(null, updated);
	updated && self.$save();
};

Session.prototype.set = function(uid, id, data, expire, callback) {

	if (typeof(id) === 'object') {
		callback = expire;
		expire = data;
		data = id;
		id = '';
	}

	var self = this;
	var obj = {};
	obj.uid = uid;
	obj.id = id == null ? '' : (id + '');
	obj.expire = NOW.add(expire);
	obj.data = data;
	self.items.set(uid, obj);
	callback && callback(null, data, obj);
	self.$save();
};

Session.prototype.get = function(uid, expire, callback) {

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = null;
	}

	var self = this;
	var item = self.items.get(uid);
	if (item) {
		if (item.expire < NOW) {
			self.onremove && self.onremove(item);
			self.items.delete(uid);
			item = null;
			self.$save();
		} else if (expire) {
			item.expire = NOW.add(expire);
			self.items.set(uid, item);
		}
	}

	// we need to load data
	if (item && item.data == null) {
		if (self.ondata) {
			self.ondata(item, function(err, data) {
				item.data = data;
				callback(err, data, item);
			});
			return;
		}
	}

	callback(null, item ? item.data : null, item);
};

Session.prototype.count = function(filter, callback) {

	if (!callback) {
		callback = filter;
		filter = null;
	}

	if (filter) {
		this.find(filter, function(err, items) {
			callback(null, items.length);
		});
	} else
		callback(null, this.items.length);
};

Session.prototype.remove2 = function(id, callback) {
	var self = this;
	for (var m of self.items.values()) {
		if (m && m.id === id) {
			callback && callback(null, m);
			self.onremove && self.onremove(m);
			self.items.delete(m.uid);
		}
	}
	self.$save();
};

Session.prototype.remove = function(uid, callback) {
	var self = this;
	var item = self.items.get(uid);

	if (item) {
		self.items.delete(uid);
		self.$save();
	}

	callback && callback(null, item);
	self.onremove && self.onremove(item);
};

Session.prototype.clear = function(callback) {
	var self = this;
	self.items.clear();
	callback && callback();
	self.$save();
};

Session.prototype.load = function(callback) {

	var self = this;
	var removed = 0;
	var data = [];

	try {
		data = Fs.readFileSync(PATH.databases(filename.format((self.name ? ('_' + self.name) : '')))).toString('utf8').split('\n');
	} catch (e) {}

	for (var i = 0; i < data.length; i++) {
		var item = data[i].split(';');
		var obj = {};
		obj.uid = item[0];
		obj.id = item[1];
		obj.expire = new Date(+item[2]);
		obj.data = null;
		if (obj.expire > NOW)
			self.items.set(obj.uid, obj);
		else
			removed++;
	}

	removed && self.$save();
	callback && callback();
};

global.SESSION = function(name) {
	if (sessions[name])
		return sessions[name];
	var session = new Session(name);
	session.load();
	return sessions[name] = session;
};