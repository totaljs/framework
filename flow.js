if (!global.framework_utils)
	global.framework_utils = require('./utils');

function Message() {}

var MP = Message.prototype;

MP.clone = function() {
	var self = this;
	var obj = new Message();
	obj.duration = self.duration;
	obj.repo = self.repo;
	obj.main = self.main;
	obj.prev = self.prev;
	obj.id = self.id;
	obj.data = self.data;
	obj.prev = self.main.meta.flow[self.instanceid];
	obj.count = self.count;
	obj.processed = 0;
	return obj;
};

MP.send = function(output) {

	var self = this;
	var outputs;
	var count = 0;

	if (output == null) {
		if (self.schema.connections) {
			outputs = Object.keys(self.schema.connections);
			for (var i = 0; i < outputs.length; i++)
				count += self.send(outputs[i]);
		}
		return count;
	}

	var meta = self.main.meta;
	var now = Date.now();

	outputs = self.schema.connections ? (self.schema.connections[output] || EMPTYARRAY) : EMPTYARRAY;

	if (self.processed === 0) {
		self.processed = 1;
		self.schema.stats.pending--;
		self.schema.stats.output++;
		self.schema.stats.duration = now - self.duration2;
	}

	for (var i = 0; i < outputs.length; i++) {
		var output = outputs[i];
		var schema = meta.flow[output.id];
		if (schema && schema.component) {
			var next = meta.components[schema.component];
			if (next && next.message) {
				var inputindex = +output.index;
				var message = self.clone();
				message.count++;
				message.input = inputindex;
				message.output = output;
				message.instance = next;
				message.options = schema.options;
				message.schema = schema;
				message.duration2 = now;
				schema.stats.input++;
				schema.stats.pending++;
				next.message(message);
				count++;
			}
		}
	}

	return count;
};

MP.replace = function(data) {
	this.data = data;
	return this;
};

MP.destroy = function() {
	var self = this;

	if (self.processed === 0) {
		self.processed = 1;
		self.schema.stats.pending--;
		self.schema.stats.output++;
		self.schema.stats.duration = Date.now() - self.duration2;
	}

	self.repo = null;
	self.main = null;
	self.prev = null;
	self.data = null;
	self.prev = null;
	self.schema = null;
	self.options = null;
	self.duration = null;
	self.duration2 = null;
	self.instance = null;
};

function Flow(name) {
	var t = this;
	t.name = name;
	t.meta = {};
	t.meta.components = {};
	t.meta.flow = {};
	t.meta.messages = 0;
	t.$events = {};
	new framework_utils.EventEmitter2(t);
}

var FP = Flow.prototype;

FP.register = function(name, declaration) {
	var self = this;

	if (typeof(declaration) === 'string')
		declaration = new Function('instance', declaration);

	var prev = self.meta.components[name];
	if (prev) {
		prev.connected = false;
		prev.disabled = true;
		prev.disconnect && prev.disconnect();
	}

	var curr = { id: name, main: self, connected: true, disabled: false };
	declaration(curr);
	self.meta.components[name] = curr;
	self.$events.register && self.emit('register', name, curr);
	curr.install && !prev && curr.install();
	curr.connect && curr.connect();
	return self;
};

FP.unregister = function(name) {

	var self = this;

	if (name == null) {
		var keys = Object.keys(self.meta.components);
		for (var i = 0; i < keys.length; i++)
			self.unregister(self.meta.components[keys[i]]);
		return self;
	}

	var curr = self.meta.components[name];
	if (curr) {
		self.$events.unregister && self.emit('unregister', name, curr);
		curr.connected = false;
		curr.disabled = true;
		curr.disconnect && curr.disconnect();
		curr.uninstall && curr.uninstall();
		delete self.meta.components[name];
	}
	return self;
};

FP.use = function(schema, callback) {
	var self = this;

	if (typeof(schema) === 'string')
		schema = schema.parseJSON();

	// schema.COMPONENT_ID.component = 'condition';
	// schema.COMPONENT_ID.options = {};
	// schema.COMPONENT_ID.connections = { '0': [{ id: 'COMPONENT_ID', index: '2' }] }

	var err = new ErrorBuilder();
	var keys = Object.keys(schema);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var instance = schema[key];
		schema[key].stats = { pending: 0, input: 0, output: 0, duration: 0 };
		var component = self.meta.components[instance.component];
		if (!component)
			err.push(key, '"' + instance.component + '" component not found.');
	}

	self.meta.flow = schema;
	callback && callback(err.length ? err : null);
	return self;
};

// path = ID__INPUTINDEX
FP.trigger = function(path, data) {
	path = path.split('__');
	var self = this;
	var inputindex = +path[1];
	var schema = self.meta.flow[path[0]];
	if (schema && schema.component) {
		var instance = self.meta.components[schema.component];
		if (instance && instance.message) {
			var message = new Message();
			message.duration = message.duration2 = Date.now();
			message.count = 1;
			message.repo = {};
			message.main = self;
			message.data = data;
			message.prev = null;
			message.id = self.meta.messages++;
			message.input = inputindex;
			message.output = -1;
			message.instance = instance;
			message.options = instance.options;
			message.schema = schema;
			message.processed = 0;
			schema.stats.input++;
			schema.stats.pending++;
			instance.message(message);
			return true;
		}
	}
};

FP.clear = function() {
	var self = this;
	self.meta.flow = {};
	return self;
};

FP.make = function(fn) {
	var self = this;
	fn.call(self, self);
	return self;
};

exports.make = function(name) {
	return new Flow(name);
};