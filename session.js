// Copyright 2019-2020 (c) Peter Širka <petersirka@gmail.com>
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

/**
 * @module FrameworkSession
 * @version 3.4.0
 */

require('./index');

const COOKIEOPTIONS = { httponly: true, security: 'lax' };
const Fs = require('fs');
const filename = 'sessions{0}.txt';

function Session(name, ondata) {

	if (typeof(name) === 'function') {
		ondata = name;
		name = null;
	}

	var t = this;
	var timeoutsave = null;

	t.name = name || '';
	t.items = new Map();
	t.$sync = true;
	t.$savecallback = ERROR('session.save');
	t.ondata = ondata;
	t.pending = {};
	t.ddos = {};
	t.ddosis = false;

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
				storage.push(encodeURIComponent(m.sessionid) + ';' + (m.id ? encodeURIComponent(m.id) : '') + ';' + m.expire.getTime() + ';' + (m.used ? m.used.getTime() : '') + ';' + (m.created ? m.created.getTime() : '') + ';' + (m.note ? encodeURIComponent(m.note) : '') + ';' + (m.settings ? encodeURIComponent(m.settings) : ''));
			else {
				t.onremove && t.onremove(m);
				t.items.delete(m.sessionid);
			}
		}
		Fs.writeFile(PATH.databases(filename.format((t.name && t.name !== 'default' ? ('_' + t.name) : ''))), storage.join('\n'), t.$savecallback);
		timeoutsave = null;
	};
}

const SessionProto = Session.prototype;

SessionProto.listlive = function(callback) {

	var self = this;
	var arr = [];

	for (var m of self.items.values()) {
		if (m && !m.released && m.data && m.expire >= NOW)
			arr.push(m);
	}

	callback(null, arr);
};

SessionProto.list = function(id, callback) {

	var self = this;
	var arr = [];

	for (var m of self.items.values()) {
		if (m && m.expire >= NOW) {
			if (m.id === id)
				arr.push(m);
		} else {
			self.onremove && self.onremove(m);
			self.items.delete(m.sessionid);

			if (F.isCluster && self.$sync)
				cluster_send({ method: 'remove', NAME: self.name, sessionid: m.sessionid });

			if (!F.id || F.id === '0')
				self.$save();
		}
	}

	callback(null, arr);
};

SessionProto.has = function(sessionid, callback) {
	callback(null, this.items.has(sessionid));
};

SessionProto.has2 = function(id, callback) {
	for (var m of this.items.values()) {
		if (m && m.expire >= NOW && m.id === id) {
			callback(null, true);
			return;
		}
	}
	callback(null, false);
};

SessionProto.contains = function(sessionid, callback) {
	var self = this;
	var item = self.items.get(sessionid);
	if (item && item.expire >= NOW && item.data && !item.released)
		callback(null, item.data, item);
	else
		callback();
};

SessionProto.contains2 = function(id, callback) {
	for (var m of this.items.values()) {
		if (m && m.expire >= NOW && m.id === id && m.data && !m.released) {
			callback(null, m.data, m);
			return;
		}
	}
	callback(null);
};

SessionProto.getcookie = function(req, opt, callback, param) {

	// opt.name {String} A cookie name
	// opt.expire {String} Expiration
	// opt.key {String} Encrypt key
	// opt.extendcookie {Boolean} Extends cookie expiration (default: true)
	// opt.removecookie {Boolean} Removes cookie if isn't valid (default: true)
	// opt.options {Object} A cookie options (default: undefined)
	// opt.ddos {Number} Enable DDOS attempts

	if (req.req)
		req = req.req;

	var self = this;

	// DDOS Protection
	if (opt.ddos && self.ddos[req.ip] > opt.ddos) {
		callback(null, null, null, null, param);
		return;
	}

	var token = req.cookie(opt.name);
	if (!token || token.length < 20) {

		// remove cookies
		if (token && opt.removecookie !== false)
			req.res.cookie(opt.name, '', '-1 day');

		callback(null, null, null, null, param);
		return;
	}

	// IMPORTANT: "req.res" can be null cause of WebSocket
	var value = DECRYPTREQ(req, token, opt.key);
	if (value && typeof(value) === 'string') {
		value = value.split(';');
		if (req.res && opt.expire && opt.extendcookie !== false)
			req.res.cookie(opt.name, token, opt.expire, opt.options || COOKIEOPTIONS);
		self.get(value[0], opt.expire, function(err, data, meta, init) {
			if ((err || !data)) {

				if (opt.ddos) {
					if (self.ddos[req.ip])
						self.ddos[req.ip]++;
					else {
						self.ddos[req.ip] = 1;
						self.ddosis = true;
					}
				}

				if (req.res && opt.removecookie !== false)
					req.res.cookie(opt.name, '', '-1 day');

			} else
				req.sessionid = meta.sessionid;
			callback(err, data, meta, init, param);
		});
	} else {
		// remove cookies
		if (req.res && opt.removecookie !== false)
			req.res.cookie(opt.name, '', '-1 day');

		if (opt.ddos) {
			if (self.ddos[req.ip])
				self.ddos[req.ip]++;
			else {
				self.ddos[req.ip] = 1;
				self.ddosis = true;
			}
		}

		callback(null, null, null, null, param);
	}
};

SessionProto.gettoken = function(req, opt, callback, param) {

	// opt.token {String} a token
	// opt.expire {String} Expiration
	// opt.key {String} Encrypt key
	// opt.ddos {Number} Enable DDOS attempts

	var self = this;

	if (req.req)
		req = req.req;

	// DDOS Protection
	if (opt.ddos && self.ddos[req.ip] > opt.ddos) {
		callback(null, null, null, null, param);
		return;
	}

	var token = opt.token;
	if (!token || token.length < 20) {
		callback(null, null, null, null, param);
		return;
	}

	// IMPORTANT: "req.res" can be null cause of WebSocket
	var value = DECRYPTREQ(req, token, opt.key);
	if (value && typeof(value) === 'string') {
		value = value.split(';');
		self.get(value[0], opt.expire, function(err, data, meta, init) {
			if (!err && data)
				req.sessionid = meta.sessionid;
			else if (opt.ddos) {
				if (self.ddos[req.ip])
					self.ddos[req.ip]++;
				else {
					self.ddos[req.ip] = 1;
					self.ddosis = true;
				}
			}
			callback(err, data, meta, init, param);
		});
	} else {
		if (opt.ddos) {
			if (self.ddos[req.ip])
				self.ddos[req.ip]++;
			else {
				self.ddos[req.ip] = 1;
				self.ddosis = true;
			}
		}
		callback(null, null, null, null, param);
	}
};

SessionProto.usage = function() {
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

SessionProto.release = function(sessionid, expire, callback) {

	if (sessionid && sessionid.sessionid)
		sessionid = sessionid.sessionid;

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = null;
	}

	var self = this;

	// We can't release data when the session doesn't have ".ondata" delegate implemented
	if (!self.ondata)
		return;

	if (F.isCluster && F.id !== '0' && self.$sync)
		cluster_send({ NAME: self.name, type: 'release', sessionid: sessionid, expire: expire });

	// refreshes all
	if (sessionid == null) {
		var count = 0;
		for (var m of self.items.values()) {
			if (m.data) {
				m.released = true;
				self.onrelease && self.onrelease(m);
				m.data = null;
				count++;
			}
		}
		callback && callback(null, count);
		return;
	}

	var item = self.items.get(sessionid);
	if (item) {
		item.released = true;
		self.onrelease && self.onrelease(item);
		item.data = null;
	}

	if (callback) {
		// @TODO: WTF? Why is "get" used when the item is released???
		// if (item)
		// 	self.get(sessionid, expire, callback);
		// else
		callback(null, item ? 1 : 0);
	}
};

SessionProto.release2 = function(id, expire, callback) {

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = null;
	}

	var self = this;

	// We can't release data when the session doesn't have ".ondata" delegate implemented
	if (!self.ondata)
		return;

	var count = 0;
	var exiration = expire ? NOW.add(expire) : null;

	for (var m of self.items.values()) {
		if (m && m.id === id && m.data) {
			m.released = true;
			self.onrelease && self.onrelease(m);
			m.data = null;
			count++;
			if (exiration)
				m.expire = exiration;
		}
	}

	if (F.isCluster && F.id !== '0' && self.$sync)
		cluster_send({ NAME: self.name, type: 'release2', id: id, expire: expire });

	callback && callback(null, count);
};

SessionProto.releaseunused = function(lastusage, callback) {

	var self = this;
	var count = 0;

	var lu = NOW.add(lastusage[0] === '-' ? lastusage : ('-' + lastusage));
	for (var m of self.items.values()) {
		if (m.data && (!m.used || m.used <= lu)) {
			m.released = true;
			self.onrelease && self.onrelease(m);
			m.data = null;
			count++;
		}
	}

	if (F.isCluster && F.id !== '0')
		self.$sync && cluster_send({ NAME: self.name, type: 'releaseunused', lastusage: lastusage });

	callback && callback(null, count);
};

SessionProto.setcookie = function(res, opt, callback) {

	// opt.name {String} A cookie name
	// opt.sessionid {String} A unique session ID
	// opt.id {String} Optional, custom ID
	// opt.expire {String} Expiration
	// opt.strict {Boolean} Strict comparing of cookie according to IP (default: false)
	// opt.key {String} Encrypt key
	// opt.data {Object} A session data
	// opt.note {String} A simple note for this session
	// opt.settings {String} Settings data for the session
	// opt.options {Object} A cookie options (default: undefined)

	if (res.res)
		res = res.res;

	if (!opt.sessionid)
		opt.sessionid = UID();

	this.set(opt.sessionid, opt.id, opt.data, opt.expire, opt.note, opt.settings, function(err, item, meta) {
		if (err) {
			callback && callback(err);
		} else {
			var data = opt.sessionid + ';' + (opt.id || '');
			var token = ENCRYPTREQ(res.req, data, opt.key, opt.strict);
			res.cookie(opt.name, token, opt.expire, opt.options || COOKIEOPTIONS);
			res.req.sessionid = opt.sessionid;
			callback && callback(null, item, meta);
		}
	});
};

SessionProto.settoken = function(res, opt, callback) {

	// opt.name {String} A cookie name
	// opt.sessionid {String} A unique session ID
	// opt.id {String} Optional, custom ID
	// opt.expire {String} Expiration
	// opt.strict {Boolean} Strict comparing of cookie according to IP (default: false)
	// opt.key {String} Encrypt key
	// opt.data {Object} A session data
	// opt.note {String} A simple note for this session
	// opt.settings {String} Settings data for the session

	if (res.res)
		res = res.res;

	if (!opt.sessionid)
		opt.sessionid = UID();

	this.set(opt.sessionid, opt.id, opt.data, opt.expire, opt.note, opt.settings, function(err, item, meta) {
		if (err) {
			callback && callback(err);
		} else {
			var data = opt.sessionid + ';' + (opt.id || '');
			var token = ENCRYPTREQ(res.req, data, opt.key, opt.strict);
			res.req.sessionid = opt.sessionid;
			callback && callback(null, token, item, meta);
		}
	});
};

SessionProto.set2 = function(id, data, expire, note, settings, callback) {

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = '';
	} else if (typeof(note) === 'function') {
		callback = note;
		note = null;
	} else if (typeof(settings) === 'function') {
		callback = settings;
		settings = null;
	}

	var self = this;
	var updated = 0;

	for (var m of self.items.values()) {
		if (m && m.id === id && m.data) {
			m.data = data;
			if (expire)
				m.expire = NOW.add(expire);
			if (note != null)
				m.note = note;
			if (settings != null)
				m.settings = settings;
			updated++;
		}
	}

	callback && callback(null, updated);

	if (F.isCluster && self.$sync)
		cluster_send({ method: 'set2', NAME: self.name, id: id, data: data, expire: expire, note: note, settings: settings });

	if (updated && (!F.id || F.id === '0'))
		self.$save();
};

SessionProto.set = function(sessionid, id, data, expire, note, settings, callback) {

	if (typeof(id) === 'object') {
		callback = settings;
		settings = note;
		note = expire;
		expire = data;
		data = id;
		id = '';
	}

	if (typeof(note) === 'function') {
		callback = note;
		note = null;
	} else if (typeof(settings) === 'function') {
		callback = settings;
		settings = null;
	}

	var self = this;
	var obj = {};
	obj.sessionid = sessionid;
	obj.id = id == null ? '' : (id + '');
	obj.expire = NOW.add(expire);
	obj.data = data;
	obj.note = note || '';
	obj.created = NOW;
	obj.settings = settings || '';
	self.items.set(sessionid, obj);

	if (F.isCluster && self.$sync)
		cluster_send({ method: 'set', NAME: self.name, sessionid: sessionid, id: obj.id, data: data, expire: expire, note: note, settings: settings });

	if (!F.id || F.id === '0')
		self.$save();

	callback && callback(null, data, obj);
};

SessionProto.get2 = function(id, callback) {
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

SessionProto.get = function(sessionid, expire, callback) {

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

			if (F.isCluster && self.$sync)
				cluster_send({ method: 'remove', NAME: self.name, sessionid: sessionid });

			if (!F.id || F.id === '0')
				self.$save();

		} else if (expire)
			item.expire = NOW.add(expire);
	}

	// we need to load data
	if (item) {
		if (item.data == null && self.ondata) {

			if (self.pending[item.id]) {
				self.pending[item.id].push(callback);
				return;
			}

			self.pending[item.id] = [];
			self.ondata(item, function(err, data) {

				if (item.released)
					item.released = false;

				item.data = data;
				callback(err, data, item, true);
				item.used = NOW;
				var pending = self.pending[item.id];
				for (var i = 0; i < pending.length; i++)
					pending[i](err, data, item);
				delete self.pending[item.id];
			});

			return;
		}
	}

	callback(null, item ? item.data : null, item);

	if (item)
		item.used = NOW;
};

SessionProto.update2 = function(id, data, expire, note, settings, callback) {

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = null;
	} else if (typeof(note) === 'function') {
		callback = note;
		note = null;
	} else if (typeof(settings) === 'function') {
		callback = settings;
		settings = null;
	}

	var self = this;
	var updated = 0;

	if (expire)
		expire = NOW.add(expire);

	for (var m of self.items.values()) {
		if (m && m.id === id) {
			if (m.data)
				m.data = data;
			if (note != null)
				m.note = note;
			if (settings != null)
				m.settings = settings;
			if (expire)
				m.expire = expire;
			if (m.data || expire)
				updated++;
		}
	}

	if (F.isCluster && self.$sync)
		cluster_send({ method: 'update2', NAME: self.name, id: id, data: data, expire: expire, note: note, settings: settings });

	if (updated && (!F.id || F.id === '0'))
		self.$save();

	callback && callback(null, updated);
};

SessionProto.update = function(sessionid, data, expire, note, settings, callback) {

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = null;
	} else if (typeof(note) === 'function') {
		callback = note;
		note = null;
	} else if (typeof(settings) === 'function') {
		callback = settings;
		settings = null;
	}

	var self = this;
	var item = self.items.get(sessionid);
	if (item) {

		if (item.data)
			item.data = data;

		if (note != null)
			item.note = note;

		if (settings != null)
			item.settings = settings;

		if (expire)
			item.expire = NOW.add(expire);

		if (F.isCluster && self.$sync)
			cluster_send({ method: 'update', NAME: self.name, sessionid: sessionid, data: data, expire: expire, note: note, settings: settings });

		if ((item.data || expire) && (!F.id || F.id === '0'))
			self.$save();

		if (callback) {
			if (item.data)
				callback(null, data, item);
			else
				callback();
		}

	} else if (callback)
		callback();
};

SessionProto.count = function(id, callback) {

	if (!callback) {
		callback = id;
		id = null;
	}

	var o = {};
	o.used = 0;
	o.free = 0;

	for (var m of this.items.values()) {
		if (id && m.id !== id)
			continue;
		if (m.data)
			o.used++;
		else
			o.free++;
	}

	o.count = o.used + o.free;
	callback(null, o);
};

SessionProto.remove2 = function(id, callback) {
	var self = this;
	var count = 0;

	for (var m of self.items.values()) {
		if (m && m.id === id) {
			self.onremove && self.onremove(m);
			self.items.delete(m.sessionid);
			count++;
		}
	}

	if (F.isCluster && self.$sync)
		cluster_send({ method: 'remove2', NAME: self.name, id: id });

	if (!F.id || F.id === '0')
		self.$save();

	callback && callback(null, count);
};

SessionProto.remove = function(sessionid, callback) {

	if (sessionid && sessionid.sessionid)
		sessionid = sessionid.sessionid;

	var self = this;
	var item = self.items.get(sessionid);

	if (item) {
		self.items.delete(sessionid);

		if (F.isCluster && self.$sync)
			cluster_send({ method: 'remove', NAME: self.name, sessionid: sessionid });

		if (!F.id || F.id === '0')
			self.$save();
	}

	callback && callback(null, item);
	self.onremove && self.onremove(item);
};

SessionProto.clear = function(lastusage, callback) {

	if (typeof(lastusage) === 'function') {
		callback = lastusage;
		lastusage = null;
	}

	var self = this;
	var count = 0;

	if (lastusage) {
		var lu = NOW.add(lastusage[0] === '-' ? lastusage : ('-' + lastusage));
		for (var m of self.items.values()) {
			if (!m.used || m.used <= lu) {
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

	if (F.isCluster && self.$sync)
		cluster_send({ method: 'clear', NAME: self.name, lastusage: lastusage });

	if (!F.id || F.id === '0')
		self.$save();

	callback && callback(null, count);
};

SessionProto.clean = function() {
	var self = this;
	var is = false;
	for (var m of self.items.values()) {
		if (m.expire < NOW) {
			self.onremove && self.onremove(m);
			self.items.delete(m.sessionid);
			is = true;
		}
	}

	if (is) {
		if (F.isCluster && self.$sync)
			cluster_send({ method: 'clean', NAME: self.name });

		if (!F.id || F.id === '0')
			self.$save();
	}
};

SessionProto.load = function(callback) {

	var self = this;
	var removed = 0;
	var data = [];

	try {
		data = Fs.readFileSync(PATH.databases(filename.format((self.name && self.name !== 'default' ? ('_' + self.name) : '')))).toString('utf8').split('\n');
	} catch (e) {}

	for (var i = 0; i < data.length; i++) {
		var item = data[i].split(';');
		var obj = {};
		obj.sessionid = decodeURIComponent(item[0]);
		obj.id = item[1] ? decodeURIComponent(item[1]) : '';
		obj.expire = new Date(+item[2]);
		obj.used = item[3] ? new Date(+item[3]) : null;
		obj.created = item[4] ? new Date(+item[4]) : null;
		obj.note = item[5] ? decodeURIComponent(item[5]) : '';
		obj.settings = item[6] ? decodeURIComponent(item[6]) : '';
		obj.data = null;
		if (obj.expire > NOW)
			self.items.set(obj.sessionid, obj);
		else
			removed++;
	}

	if (removed && (!F.id || F.id === '0'))
		self.$save();

	callback && callback();
};

function cluster_send(obj) {
	obj.TYPE = 'session';
	obj.ID = F.id;
	process.send(obj);
}

exports.Session = Session;