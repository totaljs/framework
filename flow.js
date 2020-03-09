// Copyright 2012-2020 (c) Peter Širka <petersirka@gmail.com>
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
 * @module FrameworkFlowStream
 * @version 3.4.0
 */

if (!global.framework_utils)
	global.framework_utils = require('./utils');

const D = '__';

function Message() {}

Message.prototype = {

	get user() {
		return this.controller ? this.controller.user : null;
	},

	get session() {
		return this.controller ? this.controller.session : null;
	},

	get sessionid() {
		return this.controller && this.controller ? this.controller.req.sessionid : null;
	},

	get language() {
		return (this.controller ? this.controller.language : '') || '';
	},

	get ip() {
		return this.controller ? this.controller.ip : null;
	},

	get id() {
		return this.controller ? this.controller.id : null;
	},

	get req() {
		return this.controller ? this.controller.req : null;
	},

	get res() {
		return this.controller ? this.controller.res : null;
	},

	get params() {
		return this.controller ? this.controller.params : null;
	},

	get files() {
		return this.controller ? this.controller.files : null;
	},

	get body() {
		return this.controller ? this.controller.body : null;
	},

	get query() {
		return this.controller ? this.controller.query : null;
	},

	get headers() {
		return this.controller && this.controller.req ? this.controller.req.headers : null;
	},

	get ua() {
		return this.controller && this.controller.req ? this.controller.req.ua : null;
	}
};

var MP = Message.prototype;

MP.emit = function(name, a, b, c, d, e, f, g) {

	var self = this;

	if (!self.$events)
		return self;

	var evt = self.$events[name];
	if (evt) {
		var clean = false;
		for (var i = 0, length = evt.length; i < length; i++) {
			if (evt[i].$once)
				clean = true;
			evt[i].call(self, a, b, c, d, e, f, g);
		}
		if (clean) {
			evt = evt.remove(n => n.$once);
			self.$events[name] = evt.length ? evt : undefined;
		}
	}
	return self;
};

MP.on = function(name, fn) {
	var self = this;
	if (!self.$events)
		self.$events = {};
	if (self.$events[name])
		self.$events[name].push(fn);
	else
		self.$events[name] = [fn];
	return self;
};

MP.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

MP.removeListener = function(name, fn) {
	var self = this;
	if (self.$events) {
		var evt = self.$events[name];
		if (evt) {
			evt = evt.remove(n => n === fn);
			self.$events[name] = evt.length ? evt : undefined;
		}
	}
	return self;
};

MP.removeAllListeners = function(name) {
	if (this.$events) {
		if (name === true)
			this.$events = {};
		else if (name)
			this.$events[name] = undefined;
		else
			this.$events = {};
	}
	return this;
};

MP.clone = function() {
	var self = this;
	var obj = new Message();
	obj.$events = self.$events;
	obj.duration = self.duration;
	obj.repo = self.repo;
	obj.main = self.main;
	obj.count = self.count;
	obj.data = self.data;
	obj.used = self.used;
	obj.processed = 0;
	return obj;
};

MP.send = function(outputindex) {

	var self = this;
	var outputs;
	var count = 0;

	if (outputindex == null) {
		if (self.schema.connections) {
			outputs = Object.keys(self.schema.connections);
			for (var i = 0; i < outputs.length; i++)
				count += self.send(outputs[i]);
		}
		return count;
	}

	var meta = self.main.meta;
	var now = Date.now();

	outputs = self.schema.connections ? (self.schema.connections[outputindex] || EMPTYARRAY) : EMPTYARRAY;

	if (self.processed === 0) {
		self.processed = 1;
		self.schema.stats.pending--;
		self.schema.stats.output++;
		self.schema.stats.duration = now - self.duration2;
	}

	if (!self.main.$can(false, self.toid, outputindex))
		return count;

	for (var i = 0; i < outputs.length; i++) {
		var output = outputs[i];

		if (output.disabled || output.paused)
			continue;

		var schema = meta.flow[output.id];
		if (schema && schema.component && self.main.$can(true, output.id, output.index)) {
			var next = meta.components[schema.component];
			if (next && next.message) {
				var inputindex = output.index;
				var message = self.clone();
				message.used++;
				message.from = self.to;
				message.fromid = self.toid;
				message.fromindex = outputindex;
				message.fromcomponent = self.schema.component;
				message.fromschema = self.toschema;
				message.to = next;
				message.toid = output.id;
				message.toindex = inputindex;
				message.tocomponent = schema.component;
				message.toschema = message.schema = schema;
				message.cache = schema.cache;
				message.options = schema.options;
				message.duration2 = now;
				schema.stats.input++;
				schema.stats.pending++;
				self.$events.message && self.emit('message', message);
				self.main.$events.message && self.main.emit('message', message);
				setImmediate(sendmessage, next, message);
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

	self.$events.end && self.emit('end', self);
	self.main.$events.end && self.main.emit('end', self);

	self.repo = null;
	self.main = null;
	self.from = null;
	self.to = null;
	self.fromschema = null;
	self.toschema = null;
	self.data = null;
	self.options = null;
	self.duration = null;
	self.duration2 = null;
	self.$events = null;
};

function Flow(name) {
	var t = this;
	t.name = name;
	t.meta = {};
	t.meta.components = {};
	t.meta.messages = 0;
	t.meta.flow = {};
	t.meta.cache = {};
	t.$events = {};
	new framework_utils.EventEmitter2(t);
}

var FP = Flow.prototype;

FP.register = function(name, declaration) {
	var self = this;

	if (typeof(declaration) === 'string')
		declaration = new Function('instance', declaration);

	var cache;
	var prev = self.meta.components[name];
	if (prev) {
		cache = prev.cache;
		prev.connected = false;
		prev.disabled = true;
		prev.destroy = null;
		prev.disconnect && prev.disconnect();
	}

	var curr = { id: name, main: self, connected: true, disabled: false, cache: cache || {} };
	declaration(curr);
	self.meta.components[name] = curr;
	self.$events.register && self.emit('register', name, curr);
	curr.install && !prev && curr.install();
	curr.connect && curr.connect();
	curr.destroy = function() {
		self.unregister(name);
	};
	return self;
};

FP.destroy = function() {
	var self = this;
	self.unregister();
	setTimeout(function() {
		self.emit('destroy');
		self.meta = null;
		self.$events = null;
	}, 500);
	delete F.flows[self.name];
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
		curr.destroy = null;
		curr.cache = null;
		curr.disconnect && curr.disconnect();
		curr.uninstall && curr.uninstall();
		delete self.meta.components[name];
	}
	return self;
};

FP.use = function(schema, callback) {
	var self = this;

	if (typeof(schema) === 'string')
		schema = schema.parseJSON(true);

	// schema.COMPONENT_ID.component = 'condition';
	// schema.COMPONENT_ID.options = {};
	// schema.COMPONENT_ID.connections = { '0': [{ id: 'COMPONENT_ID', index: '2' }] }

	var err = new ErrorBuilder();

	if (schema) {

		var keys = Object.keys(schema);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (key === 'paused')
				continue;

			var instance = schema[key];
			if (!instance.component)
				continue;

			var component = self.meta.components[instance.component];
			schema[key].stats = { pending: 0, input: 0, output: 0, duration: 0 };
			schema[key].cache = {};

			if (!component)
				err.push(key, '"' + instance.component + '" component not found.');

			component.options && component.options.call(schema[key], schema[key].options);
		}

		self.meta.flow = schema;
	} else
		err.push('schema', 'Flow schema is invalid.');

	self.$events.schema && self.emit('schema', schema);
	callback && callback(err.length ? err : null);
	return self;
};

function sendmessage(instance, message, event) {

	if (event) {
		message.$events.message && message.emit('message', message);
		message.main.$events.message && message.main.emit('message', message);
	}

	instance.message(message);
}

FP.$can = function(isinput, id, index) {
	var self = this;
	if (!self.meta.flow.paused)
		return true;
	var key = (isinput ? 'input' : 'output') + D + id + D + index;
	if (!self.meta.flow.paused[key])
		return true;
};

// path = ID__INPUTINDEX
FP.trigger = function(path, data, controller, events) {
	path = path.split(D);
	var self = this;
	var inputindex = path.length === 1 ? 0 : path[1];
	var schema = self.meta.flow[path[0]];
	if (schema && schema.component) {
		var instance = self.meta.components[schema.component];
		if (instance && instance.message && self.$can(true, path[0], path[1])) {

			var message = new Message();

			message.$events = events || {};
			message.duration = message.duration2 = Date.now();
			message.controller = controller;

			message.used = 1;
			message.repo = {};
			message.main = self;
			message.data = data;
			message.count = self.meta.messages++;

			message.from = null;
			message.fromid = null;
			message.fromindex = null;
			message.fromcomponent = null;
			message.fromschema = null;

			message.to = instance;
			message.toid = path[0];
			message.toindex = inputindex;
			message.tocomponent = instance.id;
			message.toschema = message.schema = schema;
			message.cache = instance.cache;

			message.options = schema.options;
			message.processed = 0;

			schema.stats.input++;
			schema.stats.pending++;
			setImmediate(sendmessage, instance, message, true);
			return message;
		}
	}
};

FP.trigger2 = function(path, data, controller) {
	var self = this;
	var keys = Object.keys(self.meta.flow);
	var events = {};
	var obj;

	path = path.split(D);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var flow = self.meta.flow[key];
		if (flow.component === path[0])
			obj = self.trigger(key + D + (path.length === 1 ? 0 : path[1]), data, controller, events);
	}

	return obj;
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