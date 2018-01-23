// Copyright 2012-2018 (c) Peter Širka <petersirka@gmail.com>
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
 * @module WebSocketClient
 * @version 2.9.0
 */

if (!global.framework_utils)
	global.framework_utils = require('./utils');

const Crypto = require('crypto');
const Https = require('https');
const Http = require('http');
const Url = require('url');
const Zlib = require('zlib');
const ENCODING = 'utf8';
const REG_WEBSOCKET_ERROR = /ECONNRESET|EHOSTUNREACH|EPIPE|is closed/i;
const WEBSOCKET_COMPRESS = U.createBuffer([0x00, 0x00, 0xFF, 0xFF]);
const WEBSOCKET_COMPRESS_OPTIONS = { windowBits: Zlib.Z_DEFAULT_WINDOWBITS };
const CONCAT = [null, null];

function WebSocketClient() {
	this.current = {};
	this.$events = {};
	this.pending = [];
	this.reconnect = 0;
	this.closed = true;

	// type: json, text, binary
	this.options = { type: 'json', compress: true, reconnect: 3000, encodedecode: true };
	this.cookies = {};
	this.headers = {};
}

WebSocketClient.prototype.connect = function(url, protocol, origin) {

	var self = this;
	var options = {};
	var key = Crypto.randomBytes(16).toString('base64');

	self.url = url;
	self.origin = origin;
	self.protocol = protocol;

	url = Url.parse(url);

	var isSecure = url.protocol === 'wss:';

	options.port = url.port || (isSecure ? 443 : 80);
	options.host = url.hostname;
	options.path = url.path;
	options.query = url.query;
	options.headers = {};
	options.headers['Sec-WebSocket-Version'] = '13';
	options.headers['Sec-WebSocket-Key'] = key;
	options.headers['Sec-Websocket-Extensions'] = (self.options.compress ? 'permessage-deflate, ' : '') + 'client_max_window_bits';
	protocol && (options.headers['Sec-WebSocket-Protocol'] = protocol);
	origin && (options.headers['Sec-WebSocket-Origin'] = origin);
	options.headers.Connection = 'Upgrade';
	options.headers.Upgrade = 'websocket';

	var keys = Object.keys(self.headers);
	for (var i = 0, length = keys.length; i < length; i++)
		options.headers[keys[i]] = self.headers[keys[i]];

	keys = Object.keys(self.cookies);
	if (keys.length) {
		var tmp = [];
		for (var i = 0, length = keys.length; i < length; i++)
			tmp.push(keys[i] + '=' + self.headers[keys[i]]);
		options.headers['Cookie'] = tmp.join(', ');
	}

	self.req = (isSecure ? Https : Http).get(options);
	self.req.$main = self;

	self.req.on('error', function(e) {
		self.$events.error && self.emit('error', e);
	});

	self.req.on('response', function() {
		self.$events.error && self.emit('error', new Error('Unexpected server response.'));
		self.free();
	});

	self.req.on('upgrade', function(response, socket) {

		self.socket = socket;
		self.socket.$websocket = self;

		var compress = (response.headers['sec-websocket-extensions'] || '').indexOf('-deflate') !== -1;
		var digest = Crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary').digest('base64');

		if (response.headers['sec-websocket-accept'] !== digest) {
			socket.destroy();
			self.closed = true;
			self.$events.error && self.emit('error', new Error('Invalid server key.'));
			self.free();
			return;
		}

		self.closed = false;
		self.socket.setTimeout(0);
		self.socket.setNoDelay();
		self.socket.on('data', websocket_ondata);
		self.socket.on('error', websocket_onerror);
		self.socket.on('close', websocket_close);
		self.socket.on('end', websocket_close);

		if (compress) {
			self.inflatepending = [];
			self.inflatelock = false;
			self.inflate = Zlib.createInflateRaw(WEBSOCKET_COMPRESS_OPTIONS);
			self.inflate.$websocket = self;
			self.inflate.on('error', F.error());
			self.inflate.on('data', websocket_inflate);
			self.deflatepending = [];
			self.deflatelock = false;
			self.deflate = Zlib.createDeflateRaw(WEBSOCKET_COMPRESS_OPTIONS);
			self.deflate.$websocket = self;
			self.deflate.on('error', F.error());
			self.deflate.on('data', websocket_deflate);
		}

		self.$events.open && self.emit('open');
	});
};

function websocket_ondata(chunk) {
	this.$websocket.$ondata(chunk);
}

function websocket_onerror(e) {
	this.$websocket.$onerror(e);
}

function websocket_close() {
	var ws = this.$websocket;
	ws.closed = true;
	ws.$onclose();
	ws.options.reconnect && setTimeout(function(ws) {
		ws.reconnect++;
		ws.connect(ws.url, ws.protocol, ws.origin);
	}, ws.options.reconnect, ws);
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

	switch (current.type === 0x00 ? current.type2 : current.type) {
		case 0x01:

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
			this.socket.write(U.getWebSocketFrame(0, 'PONG', 0x0A));
			current.buffer = null;
			current.inflatedata = null;
			break;

		case 0x0A:
			// pong
			current.buffer = null;
			current.inflatedata = null;
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

	// check end message
	if (!current.buffer || current.buffer.length <= 2 || ((current.buffer[0] & 0x80) >> 7) !== 1)
		return;

	// webSocked - Opcode
	current.type = current.buffer[0] & 0x0f;

	// is final message?
	current.final = ((current.buffer[0] & 0x80) >> 7) === 0x01;

	// does frame contain mask?
	current.isMask = ((current.buffer[1] & 0xfe) >> 7) === 0x01;

	// data length
	var length = U.getMessageLength(current.buffer, F.isLE);
	// index for data

	var index = current.buffer[1] & 0x7f;
	index = ((index === 126) ? 4 : (index === 127 ? 10 : 2)) + (current.isMask ? 4 : 0);

	// total message length (data + header)
	var mlength = index + length;

	// Check length of data
	if (current.buffer.length < mlength)
		return;

	current.length = mlength;

	// Not Ping & Pong
	if (current.type !== 0x09 && current.type !== 0x0A) {

		// does frame contain mask?
		if (current.isMask) {
			current.mask = U.createBufferSize(4);
			current.buffer.copy(current.mask, 0, index - 4, index);
		}

		if (this.inflate) {

			var buf = U.createBufferSize(length);
			current.buffer.copy(buf, 0, index, mlength);

			// does frame contain mask?
			if (current.isMask) {
				for (var i = 0; i < length; i++)
					buf[i] = buf[i] ^ current.mask[i % 4];
			}

			// Does the buffer continue?
			buf.$continue = current.final === false;
			this.inflatepending.push(buf);
		} else {
			current.data = U.createBufferSize(length);
			current.buffer.copy(current.data, 0, index, mlength);
		}
	}

	return true;
};

WebSocketClient.prototype.$readbody = function() {

	var current = this.current;
	var length = current.data.length;
	var buf;

	if (current.type === 1) {

		buf = U.createBufferSize(length);
		for (var i = 0; i < length; i++)  {
			if (current.isMask)
				buf[i] = current.data[i] ^ current.mask[i % 4];
			else
				buf[i] = current.data[i];
		}

		return buf.toString('utf8');

	} else {

		buf = U.createBufferSize(length);
		for (var i = 0; i < length; i++) {
			// does frame contain mask?
			if (current.isMask)
				buf[i] = current.data[i] ^ current.mask[i % 4];
			else
				buf[i] = current.data[i];
		}
		return buf;
	}

};

WebSocketClient.prototype.$decode = function() {
	var data = this.current.body;

	switch (this.options.type) {

		case 'binary': // BINARY
			this.emit('message', new Uint8Array(data).buffer);
			break;

		case 'json': // JSON
			if (data instanceof Buffer)
				data = data.toString(ENCODING);
			this.options.encodedecode && (data = $decodeURIComponent(data));
			data.isJSON() && this.emit('message', F.onParseJSON(data, this.req));
			break;

		default: // TEXT
			if (data instanceof Buffer)
				data = data.toString(ENCODING);
			this.emit('message', this.options.encodedecode ? $decodeURIComponent(data) : data);
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

	var t = this.options.type;

	if (t !== 'binary') {
		var data = t === 'json' ? (raw ? message : JSON.stringify(message, replacer)) : (message || '').toString();
		if (this.options.encodedecode && data)
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
			if (self.deflatechunks) {
				var data = buffer_concat(self.deflatechunks, self.deflatechunkslength);
				data = data.slice(0, data.length - 4);
				self.deflatelock = false;
				self.deflatechunks = null;
				self.socket.write(U.getWebSocketFrame(0, data, self.type === 1 ? 0x02 : 0x01, true));
				self.sendDeflate();
			}
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

function websocket_inflate(data) {
	this.$websocket.inflatechunks.push(data);
	this.$websocket.inflatechunkslength += data.length;
}

function websocket_deflate(data) {
	this.$websocket.deflatechunks.push(data);
	this.$websocket.deflatechunkslength += data.length;
}

/**
 * Close connection
 * @param {String} message Message.
 * @param {Number} code WebSocket code.
 * @return {WebSocketClient}
 */
WebSocketClient.prototype.close = function(message, code) {
	if (!this.isClosed) {
		this.isClosed = true;
		this.socket.end(U.getWebSocketFrame(code || 1000,  message ? (this.options.encodedecode ? encodeURIComponent(message) : message) : '', 0x08));
	}
	return this;
};

function $decodeURIComponent(value) {
	try
	{
		return decodeURIComponent(value);
	} catch (e) {
		return value;
	}
}

exports.create = function() {
	return new WebSocketClient();
};