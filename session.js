const Sessions = {};
const Fs = require('fs');

global.SESSION = function(group) {
	return Sessions[group] ? Sessions[group] : (Sessions[group] = new Session(group));
};

function Session(group) {
	var t = this;
	t.data = {};
	t.group = group.crc32(true);
	t.filename = F.path.temp((F.id ? 'i-' + F.id + '_' : '') + 'framework_sessions_' + group.crc32(true) + '.jsoncache');
	t.load();
}

var SP = Session.prototype;

SP.load = function() {
	var self = this;
	try {
		self.data = Fs.readFileSync(self.filename).toString('utf8').parseJSON(true);
	} catch (e) {}
	return self;
};

SP.save = function() {
	var self = this;
	setTimeout2('session_' + self.group, function() {
		Fs.writeFile(self.filename, JSON.stringify(self.data), F.error());
	}, 1000, 10);
	return self;
};

SP.key = function() {
	return this.group + 'X' + GUID(10);
};

SP.set = function(data, expire) {

	var self = this;
	var id = self.key();
	var session = self.data[id];

	if (!session)
		session = self.data[id] = {};

	session.data = data;
	session.id = id;
	session.expire = (expire || NOW.add('5 minutes')).getTime();

	self.$events.set && self.emit('set', session);
	self.save();
	return id;
};

SP.list = function() {
	var self = this;
	var arr = Object.keys(self.data);
	var online = [];
	for (var i = 0; i < arr.length; i++)
		online.push(self.data[arr[i]]);
	return online;
};

SP.count = function() {
	return Object.keys(this.data).length;
};

SP.get = function(key) {
	return this.data[key] ? this.data[key].data : null;
};

SP.meta = function(key) {
	return this.data[key] ? this.data[key] : null;
};

SP.rem = function(key) {
	var self = this;
	if (self.data[key]) {
		self.$events.remove && self.emit('remove', self.data[key]);
		delete self.data[key];
		self.save();
	}
	return self;
};

SP.clear = function() {
	var self = this;
	var arr = Object.keys(self.data);
	var count = 0;
	var time = NOW.getTime();
	for (var i = 0; i < arr.length; i++) {
		var key = arr[key];
		var obj = self.data[key];
		if (obj.expire < time) {
			self.$events.expire && self.emit('expire', obj);
			delete self.data[key];
			count++;
		}
	}
	count && self.save();
	return self;
};

ON('service', function(interval) {
	if (interval % 5 === 0) {
		var arr = Object.keys(Sessions);
		for (var i = 0; i < arr.length; i++)
			Sessions[arr[i]].clear();
	}
});

F.session = global.SESSION;
global.Session = Session;
exports.Session = Session;