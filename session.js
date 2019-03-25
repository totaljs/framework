require('./index');

const COOKIEOPTIONS = { httponly: true, security: 'lax' };
const Fs = require('fs');
const filename = 'sessions{0}.txt';

function Session(name) {
	var t = this;
	var timeoutsave = null;

	t.name = name || '';
	t.items = new Map();
	t.$savecallback = ERROR('session.save');

	// t.onremove = function(item)
	// t.onrelease = function(item)
	// t.ondata = function(item, next(err, data))

	t.$save = function() {
		timeoutsave && clearTimeout(timeoutsave);
		timeoutsave = setTimeout(t.$saveforce, 1000 * 10); // 10 seconds
	};

	t.$saveforce = function() {
		var storage = [];
		for (var m of t.items.values()) {
			if (m.expire > NOW)
				storage.push(m.sessionid + ';' + (m.id || '') + ';' + m.expire.getTime() + ';' + (m.used ? m.used.getTime() : '') + ';' + (m.note || ''));
			else {
				self.onremove && self.onremove(m);
				t.items.delete(m.sessionid);
			}
		}
		Fs.writeFile(PATH.databases(filename.format((t.name && t.name !== 'default' ? ('_' + t.name) : ''))), storage.join('\n'), t.$savecallback);
		timeoutsave = null;
	};
}

Session.prototype.find = function(filter, callback) {

	var self = this;
	var keys = Object.keys(filter);
	var arr = [];
	var is = false;

	for (var m of self.items.values()) {
		if (m && m.expire >= NOW) {
			if (m.data) {
				is = true;
				for (var j = 0; j < keys.length; j++) {
					var key = keys[j];
					if (m.data[key] !== filter[key]) {
						is = false;
						break;
					}
				}
				is && arr.push(m);
			}
		} else {
			self.onremove && self.onremove(m);
			self.items.delete(m.sessionid);
			self.$save();
		}
	}

	callback(null, arr);
};

Session.prototype.list = function(id, callback) {

	var self = this;
	var arr = [];

	for (var m of self.items.values()) {
		if (m && m.expire >= NOW) {
			if (m.id === id)
				arr.push(m);
		} else {
			self.onremove && self.onremove(m);
			self.items.delete(m.sessionid);
			self.$save();
		}
	}

	callback(null, arr);
};

Session.prototype.has = function(sessionid, callback) {
	callback(null, this.items.has(sessionid));
};

Session.prototype.has2 = function(id, callback) {
	for (var m of this.items.values()) {
		if (m && m.expire >= NOW && m.id === id) {
			callback(null, true);
			return;
		}
	}
	callback(null, false);
};

Session.prototype.getcookie = function(req, opt, callback) {

	// opt.name {String} A cookie name
	// opt.expire {String} Expiration
	// opt.key {String} Encrypt key
	// opt.extendcookie {Boolean} Extends cookie expiration (default: true)
	// opt.removecookie {Boolean} Removes cookie if isn't valid (default: true)

	if (req.req)
		req = req.req;

	var token = req.cookie(opt.name);
	if (!token || token.length < 20) {

		// remove cookies
		if (opt.removecookie !== false)
			req.res.cookie(opt.name, '', '-1 day');

		callback();
		return;
	}

	// IMPORTANT: "req.res" can be null cause of WebSocket

	var value = DECRYPTREQ(req, token, opt.key);
	if (value && typeof(value) === 'string') {
		value = value.split(';');
		if (req.res && opt.expire && opt.extendcookie !== false)
			req.res.cookie(opt.name, token, opt.expire, COOKIEOPTIONS);
		this.get(value[0], opt.expire, function(err, data, meta) {
			if ((err || !data)) {
				if (req.res && opt.removecookie !== false)
					req.res.cookie(opt.name, '', '-1 day');
			} else
				req.sessionid = meta.sessionid;
			callback(err, data, meta);
		});
	} else {
		// remove cookies
		if (req.res && opt.removecookie !== false)
			req.res.cookie(opt.name, '', '-1 day');
		callback();
	}
};

Session.prototype.usage = function() {
	var o = {};
	o.used = 0;
	o.free = 0;
	for (var m of this.items.values()) {
		if (m.data)
			o.used++;
		else
			o.free++;
	}
	o.count = o.used + o.free;
	return o;
};

Session.prototype.release = function(sessionid, expire, callback) {

	if (sessionid && sessionid.sessionid)
		sessionid = sessionid.sessionid;

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = null;
	}

	// refreshes all
	if (sessionid == null) {
		for (var m of self.items.values()) {
			self.onrelease && self.onrelease(m);
			m.data = null;
		}
		return;
	}

	var self = this;
	var item = self.items.get(sessionid);
	if (item) {
		self.onrelease && self.onrelease(item);
		item.data = null;
	}

	if (callback) {
		if (item)
			self.get(sessionid, expire, callback);
		else
			callback();
	}
};

Session.prototype.release2 = function(id, expire, callback) {

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
			self.onrelease && self.onrelease(m);
			m.data = null;
			count++;
			if (expire)
				m.expire = expire;
		}
	}
	callback && callback(null, count);
};

Session.prototype.releaseunused = function(lastusage, callback) {

	var self = this;
	var count = 0;

	lastusage = NOW.add(lastusage[0] === '-' ? lastusage : ('-' + lastusage));
	for (var m of self.items.values()) {
		if (!m.used || m.used <= lastusage) {
			self.onrelease && self.onrelease(m);
			m.data = null;
			count++;
		}
	}

	callback && callback(null, count);
};

Session.prototype.setcookie = function(res, opt, callback) {

	// opt.name {String} A cookie name
	// opt.sessionid {String} A unique session ID
	// opt.id {String} Optional, custom ID
	// opt.expire {String} Expiration
	// opt.strict {Boolean} Strict comparing of cookie according to IP (default: false)
	// opt.key {String} Encrypt key
	// opt.data {Object} A session data
	// opt.note {String} A simple note for this session
	// opt.options {String} A cookie options (default: undefined)

	if (res.res)
		res = res.res;

	if (!opt.sessionid)
		opt.sessionid = UID();


	this.set(opt.sessionid, opt.id, opt.data, opt.expire, function(err, item, meta) {
		if (err) {
			callback && callback(err);
		} else {
			var data = opt.sessionid + ';' + (opt.id || '');
			var token = ENCRYPTREQ(res.req, data, opt.key, opt.strict);
			res.cookie(opt.name, token, opt.expire, opt.options || COOKIEOPTIONS);
			res.req.sessionid = opt.sessionid;
			callback && callback(null, item, meta);
		}
	}, opt.note);
};

Session.prototype.set2 = function(id, data, expire, callback, note) {

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = '';
	}

	var self = this;
	var updated = 0;

	for (var m of self.items.values()) {
		if (m && m.id === id && m.data) {
			m.data = data;
			if (expire)
				m.expire = NOW.add(expire);
			if (note)
				m.note = note;
			updated++;
		}
	}

	callback && callback(null, updated);
	updated && self.$save();
};

Session.prototype.set = function(sessionid, id, data, expire, callback, note) {

	if (typeof(id) === 'object') {
		note = callback;
		callback = expire;
		expire = data;
		data = id;
		id = '';
	}

	var self = this;
	var obj = {};
	obj.sessionid = sessionid;
	obj.id = id == null ? '' : (id + '');
	obj.expire = NOW.add(expire);
	obj.data = data;
	obj.note = note;
	self.items.set(sessionid, obj);
	callback && callback(null, data, obj);
	self.$save();
};

Session.prototype.get2 = function(id, callback) {
	var self = this;
	var output = [];
	for (var m of self.items.values()) {
		if (m && m.id === id && m.expire >= NOW) {
			m.used = NOW;
			output.push(m);
		}
	}
	callback && callback(null, output);
};

Session.prototype.get = function(sessionid, expire, callback) {

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = null;
	}

	var self = this;
	var item = self.items.get(sessionid);
	if (item) {
		if (item.expire < NOW) {
			self.onremove && self.onremove(item);
			self.items.delete(sessionid);
			item = null;
			self.$save();
		} else if (expire)
			item.expire = NOW.add(expire);
	}

	// we need to load data
	if (item) {
		if (item.data == null && self.ondata) {
			self.ondata(item, function(err, data) {
				item.data = data;
				callback(err, data, item, true);
				item.used = NOW;
			});
			return;
		}
	}

	callback(null, item ? item.data : null, item);

	if (item)
		item.used = NOW;
};

Session.prototype.count = function(filter, callback) {

	if (!callback) {
		callback = filter;
		filter = null;
	}

	if (filter) {
		this.find(filter, function(err, items) {
			callback(null, { count: items.length });
		});
	} else {
		var o = {};
		o.used = 0;
		o.free = 0;
		for (var m of this.items.values()) {
			if (m.data)
				o.used++;
			else
				o.free++;
		}
		o.count = o.used + o.free;
		callback(null, o);
	}
};

Session.prototype.remove2 = function(id, callback) {
	var self = this;
	for (var m of self.items.values()) {
		if (m && m.id === id) {
			callback && callback(null, m);
			self.onremove && self.onremove(m);
			self.items.delete(m.sessionid);
		}
	}
	self.$save();
};

Session.prototype.remove = function(sessionid, callback) {

	if (sessionid && sessionid.sessionid)
		sessionid = sessionid.sessionid;

	var self = this;
	var item = self.items.get(sessionid);

	if (item) {
		self.items.delete(sessionid);
		self.$save();
	}

	callback && callback(null, item);
	self.onremove && self.onremove(item);
};

Session.prototype.clear = function(lastusage, callback) {

	if (typeof(lastusage) === 'function') {
		callback = lastusage;
		lastusage = null;
	}

	var self = this;
	var count = 0;

	if (lastusage) {
		lastusage = NOW.add(lastusage[0] === '-' ? lastusage : ('-' + lastusage));

		for (var m of self.items.values()) {
			if (!m.used || m.used <= lastusage) {
				self.onremove && self.onremove(m);
				self.items.delete(m.sessionid);
				count++;
			}
		}

	} else {
		count = self.items.length;

		if (self.onremove) {
			for (var m of self.items.values())
				self.onremove(m);
		}

		self.items.clear();
	}

	callback && callback(null, count);
	self.$save();
};

Session.prototype.release = function() {
	var self = this;
	var is = false;
	for (var m of self.items.values()) {
		if (m.expire < NOW) {
			self.onremove && self.onremove(m);
			self.items.delete(m.sessionid);
			is = true;
		}
	}
	is && self.$save();
};

Session.prototype.load = function(callback) {

	var self = this;
	var removed = 0;
	var data = [];

	try {
		data = Fs.readFileSync(PATH.databases(filename.format((self.name && self.name !== 'default' ? ('_' + self.name) : '')))).toString('utf8').split('\n');
	} catch (e) {}

	for (var i = 0; i < data.length; i++) {
		var item = data[i].split(';');
		var obj = {};
		obj.sessionid = item[0];
		obj.id = item[1];
		obj.expire = new Date(+item[2]);
		obj.used = item[3] ? new Date(+item[3]) : null;
		obj.note = item[4];
		obj.data = null;
		if (obj.expire > NOW)
			self.items.set(obj.sessionid, obj);
		else
			removed++;
	}

	removed && self.$save();
	callback && callback();
};

global.SESSION = function(name) {

	if (!name)
		name = 'default';

	if (F.sessions[name])
		return F.sessions[name];
	var session = new Session(name);
	session.load();
	return F.sessions[name] = session;
};