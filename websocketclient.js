if (!global.framework_utils)
	global.framework_utils = require('./utils');

const Crypto = require('crypto');
const Https = require('https');
const Http = require('http');
const Url = require('url');
const Zlib = require('zlib');
const REG_WEBSOCKET_ERROR = /ECONNRESET|EHOSTUNREACH|EPIPE|is closed/i;

function WebSocketClient() {
	this.current = {};
	this.type = 2;
	this.$events = {};
	this.encode = true;
}

WebSocketClient.prototype.connect = function(url, opt) {

	var self = this;
	var options = {};
	var key = Crypto.randomBytes(16).toString('base64');

	self.url = url;
	url = Url.parse(url);

	var isSecure = url.protocol === 'wss:';

	options.port = url.port || (isSecure ? 443 : 80);
	options.host = url.hostname;
	options.path = url.path;
	options.query = url.query;
	options.headers = {};
	options.headers['Sec-WebSocket-Version'] = '13';
	options.headers['Sec-WebSocket-Key'] = key;
	//options.headers['Sec-Websocket-Extensions'] = 'client_max_window_bits';
	// options.headers['Sec-WebSocket-Protocol'];
	// options.headers['Sec-WebSocket-Origin']
	options.headers.Connection = 'Upgrade';
	options.headers.Upgrade = 'websocket';

	self.req = (isSecure ? Https : Http).get(options);
	self.req.$main = self;

	self.req.on('error', function(e) {
		self.$events.error && self.emit('error', e);
	})

	self.req.on('response', function(response) {
		self.$events.error && self.emit('error', new Error('Unexpected server response.'));
		self.free();
	});

	self.req.on('upgrade', function(response, socket, head) {

		self.socket = socket;
		self.socket.$websocket = self;

		var digest = Crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary').digest('base64');

		if (response.headers['sec-websocket-accept'] !== digest) {
			socket.destroy();
			self.$events.error && self.emit('error', new Error('Invalid server key.'));
			self.free();
			return;
		}

		self.socket.setTimeout(0);
		self.socket.setNoDelay();
		self.socket.on('data', websocket_ondata);
		self.socket.on('error', websocket_onerror);
		self.socket.on('close', websocket_close);
		self.socket.on('end', websocket_close);
		self.$events.open && self.emit('open');

		// @TODO: COMPRESSION
	});

};

function websocket_ondata(chunk) {
	this.$websocket.$ondata(chunk);
}

function websocket_onerror(e) {
	this.$websocket.$onerror(e);
}

function websocket_close() {
	this.$websocket.$onclose();
}

WebSocketClient.prototype.emit = function(name, a, b, c, d, e, f, g) {
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

WebSocketClient.prototype.on = function(name, fn) {
	if (this.$events[name])
		this.$events[name].push(fn);
	else
		this.$events[name] = [fn];
	return this;
};

WebSocketClient.prototype.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

WebSocketClient.prototype.removeListener = function(name, fn) {
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

WebSocketClient.prototype.removeAllListeners = function(name) {
	if (name === true)
		this.$events = EMPTYOBJECT;
	else if (name)
		this.$events[name] = undefined;
	else
		this.$events = {};
	return this;
};

WebSocketClient.prototype.free = function() {
	var self = this;
	self.socket && self.socket.destroy();
	self.socket = null;
	self.req && self.req.abort();
	self.req = null;
	return self;
};

/**
 * Internal handler written by Jozef Gula
 * @param {Buffer} data
 * @return {Framework}
 */
WebSocketClient.prototype.$ondata = function(data) {

	if (this.isClosed)
		return;

	var current = this.current;
	if (data) {
		if (current.buffer) {
			CONCAT[0] = current.buffer;
			CONCAT[1] = data;
			current.buffer = Buffer.concat(CONCAT);
		} else
			current.buffer = data;
	}

	if (!this.$parse())
		return;

	if (!current.final && current.type !== 0x00)
		current.type2 = current.type;

	var tmp;

	// @TODO: add a check for mixin types (text/binary)
	switch (current.type === 0x00 ? current.type2 : current.type) {
		case 0x01:

			if (this.type === 1) {
				this.close('Invalid data type.');
				return;
			}

			// text
			if (this.inflate) {
				current.final && this.parseInflate();
			} else {
				tmp = this.$readbody();
				if (current.body)
					current.body += tmp;
				else
					current.body = tmp;
				current.final && this.$decode();
			}

			break;

		case 0x02:

			// binary

			if (this.type !== 1) {
				this.close('Invalid data type.');
				return;
			}

			if (this.inflate) {
				current.final && this.parseInflate();
			} else {
				tmp = this.$readbody();
				if (current.body) {
					CONCAT[0] = current.body;
					CONCAT[1] = tmp;
					current.body = Buffer.concat(CONCAT);
				} else
					current.body = tmp;
				current.final && this.$decode();
			}

			break;

		case 0x08:
			// close
			this.close();
			break;

		case 0x09:
			// ping, response pong
			this.socket.write(U.getWebSocketFrame(0, '', 0x0A));
			this.current.buffer = null;
			this.current.inflatedata = null;
			this.$ping = true;
			break;

		case 0x0a:
			// pong
			this.$ping = true;
			this.current.buffer = null;
			this.current.inflatedata = null;
			break;
	}

	if (current.buffer) {
		current.buffer = current.buffer.slice(current.length, current.buffer.length);
		current.buffer.length && this.$ondata();
	}
};

function buffer_concat(buffers, length) {
	var buffer = U.createBufferSize(length);
	var offset = 0;
	for (var i = 0, n = buffers.length; i < n; i++) {
		buffers[i].copy(buffer, offset);
		offset += buffers[i].length;
	}
	return buffer;
}

// MIT
// Written by Jozef Gula
// Optimized by Peter Sirka
WebSocketClient.prototype.$parse = function() {

	var self = this;
	var current = self.current;

	if (!current.buffer || current.buffer.length <= 2 || ((current.buffer[1] & 0x80) >> 7) !== 1)
		return;

	var length = U.getMessageLength(current.buffer, F.isLE);
	var index = (current.buffer[1] & 0x7f);

	index = (index === 126) ? 4 : (index === 127 ? 10 : 2);

	var mlength = index + 4 + length;
	if (mlength > this.length) {
		this.close('Maximum request length exceeded.');
		return;
	}

	// Check length of data
	if (current.buffer.length < mlength)
		return;

	current.length = mlength;
	current.type = current.buffer[0] & 0x0f;
	current.final = ((current.buffer[0] & 0x80) >> 7) === 0x01;

	// Ping & Pong
	if (current.type !== 0x09 && current.type !== 0x0A) {
		current.mask = U.createBufferSize(4);
		current.buffer.copy(current.mask, 0, index, index + 4);

		if (this.inflate) {
			var buf = U.createBufferSize(length);
			current.buffer.copy(buf, 0, index + 4, index + 4 + length);

			for (var i = 0; i < length; i++)
				buf[i] = buf[i] ^ this.current.mask[i % 4];

			// Does the buffer continue?
			buf.$continue = current.final === false;
			this.inflatepending.push(buf);
		} else {
			current.data = U.createBufferSize(length);
			current.buffer.copy(current.data, 0, index + 4, index + 4 + length);
		}
	}

	return true;
};

WebSocketClient.prototype.$readbody = function() {
	var length = this.current.data.length;
	if (this.type === 1) {
		var binary = U.createBufferSize(length);
		for (var i = 0; i < length; i++)
			binary[i] = this.current.data[i] ^ this.current.mask[i % 4];
		return binary;
	} else {
		var output = '';
		for (var i = 0; i < length; i++)
			output += String.fromCharCode(this.current.data[i] ^ this.current.mask[i % 4]);
		return output;
	}
};

WebSocketClient.prototype.$decode = function() {
	var data = this.current.body;
	switch (this.type) {

		case 1: // BINARY
			this.emit('message', new Uint8Array(data).buffer);
			break;

		case 3: // JSON
			if (data instanceof Buffer)
				data = data.toString(ENCODING);
			this.encode && (data = $decodeURIComponent(data));
			data.isJSON() && this.emit('message', F.onParseJSON(data, this.req));
			break;

		default: // TEXT
			if (data instanceof Buffer)
				data = data.toString(ENCODING);
			this.emit('message', this.encode ? $decodeURIComponent(data) : data);
			break;
	}

	this.current.body = null;
};

WebSocketClient.prototype.parseInflate = function() {
	var self = this;

	if (self.inflatelock)
		return;

	var buf = self.inflatepending.shift();
	if (buf) {
		self.inflatechunks = [];
		self.inflatechunkslength = 0;
		self.inflatelock = true;
		self.inflate.write(buf);
		!buf.$continue && self.inflate.write(U.createBuffer(WEBSOCKET_COMPRESS));
		self.inflate.flush(function() {

			if (!self.inflatechunks)
				return;

			var data = buffer_concat(self.inflatechunks, self.inflatechunkslength);

			self.inflatechunks = null;
			self.inflatelock = false;

			if (data.length > self.length) {
				self.close('Maximum request length exceeded.');
				return;
			}

			if (self.current.body) {
				CONCAT[0] = self.current.body;
				CONCAT[1] = data;
				self.current.body = Buffer.concat(CONCAT);
			} else
				self.current.body = data;

			!buf.$continue && self.$decode();
			self.parseInflate();
		});
	}
};

WebSocketClient.prototype.$onerror = function(err) {

	if (this.isClosed)
		return;

	if (REG_WEBSOCKET_ERROR.test(err.stack)) {
		this.isClosed = true;
		this.$onclose();
	} else
		this.$events.error && this.emit('error', err);
};

WebSocketClient.prototype.$onclose = function() {
	if (this._isClosed)
		return;

	this.isClosed = true;
	this._isClosed = true;

	if (this.inflate) {
		this.inflate.removeAllListeners();
		this.inflate = null;
		this.inflatechunks = null;
	}

	if (this.deflate) {
		this.deflate.removeAllListeners();
		this.deflate = null;
		this.deflatechunks = null;
	}

	this.$events.close && this.emit('close');
	this.socket.removeAllListeners();
};

/**
 * Sends a message
 * @param {String/Object} message
 * @param {Boolean} raw The message won't be converted e.g. to JSON.
 * @return {WebSocketClient}
 */
WebSocketClient.prototype.send = function(message, raw, replacer) {

	if (this.isClosed)
		return this;

	if (this.type !== 1) {
		var data = this.type === 3 ? (raw ? message : JSON.stringify(message, replacer)) : (message || '').toString();
		if (this.encode && data)
			data = encodeURIComponent(data);
		if (this.deflate) {
			this.deflatepending.push(U.createBuffer(data));
			this.sendDeflate();
		} else
			this.socket.write(U.getWebSocketFrame(0, data, 0x01));
	} else if (message) {
		if (this.deflate) {
			this.deflatepending.push(U.createBuffer(message));
			this.sendDeflate();
		} else
			this.socket.write(U.getWebSocketFrame(0, new Int8Array(message), 0x02));
	}

	return this;
};

WebSocketClient.prototype.sendDeflate = function() {
	var self = this;

	if (self.deflatelock)
		return;

	var buf = self.deflatepending.shift();
	if (buf) {
		self.deflatechunks = [];
		self.deflatechunkslength = 0;
		self.deflatelock = true;
		self.deflate.write(buf);
		self.deflate.flush(function() {
			if (!self.deflatechunks)
				return;
			var data = buffer_concat(self.deflatechunks, self.deflatechunkslength);
			data = data.slice(0, data.length - 4);
			self.deflatelock = false;
			self.deflatechunks = null;
			self.socket.write(U.getWebSocketFrame(0, data, self.type === 1 ? 0x02 : 0x01, true));
			self.sendDeflate();
		});
	}
};

/**
 * Ping message
 * @return {WebSocketClient}
 */
WebSocketClient.prototype.ping = function() {
	if (!this.isClosed) {
		this.socket.write(U.getWebSocketFrame(0, '', 0x09));
		this.$ping = false;
	}
	return this;
};

/**
 * Close connection
 * @param {String} message Message.
 * @param {Number} code WebSocket code.
 * @return {WebSocketClient}
 */
WebSocketClient.prototype.close = function(message, code) {
	if (!this.isClosed) {
		this.isClosed = true;
		this.socket.end(U.getWebSocketFrame(code || 1000,  message ? encodeURIComponent(message) : '', 0x08));
	}
	return this;
};

var ws = new WebSocketClient();

ws.on('message', function(message) {
	console.log(message);
});

ws.on('open', function() {
	console.log('OPEN');
	var self = this;
	setTimeout(function() {
		self.send('FET');
	}, 1000);
});

ws.on('error', console.log);

ws.connect('ws://127.0.0.1:8000/');