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
 * @module FrameworkMail
 * @version 2.9.4
 */

'use strict';

const Net = require('net');
const Tls = require('tls');
const Fs = require('fs');

const CRLF = '\r\n';
const REG_ESMTP = /\besmtp\b/i;
const REG_STATE = /\d+/;
const REG_WINLINE = /\r\n/g;
const REG_NEWLINE = /\n/g;
const REG_AUTH = /(AUTH LOGIN|AUTH PLAIN)/i;
const EMPTYARRAY = [];

var INDEXSENDER = 0;
var INDEXATTACHMENT = 0;

if (!global.framework_utils)
	global.framework_utils = require('./utils');

const BUF_CRLF = framework_utils.createBuffer(CRLF);
const CONCAT = [null, null];

/**
 * Mailer
 * @class
 * @property {Boolean} debug Debug mode (true/false).
 */
function Mailer() {
	this.debug = false;
	this.Message = Message;
	this.Mail = Message;
	this.connections = {};
	this.$events = {};
}

Mailer.prototype.emit = function(name, a, b, c, d, e, f, g) {
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

Mailer.prototype.on = function(name, fn) {
	if (this.$events[name])
		this.$events[name].push(fn);
	else
		this.$events[name] = [fn];
	return this;
};

Mailer.prototype.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

Mailer.prototype.removeListener = function(name, fn) {
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

Mailer.prototype.removeAllListeners = function(name) {
	if (name)
		this.$events[name] = undefined;
	else
		this.$events = {};
	return this;
};

/**
 * Create Mail Message
 * @param {String} subject
 * @param {String} body
 * @return {MailMessage}
 */
Mailer.prototype.create = function(subject, body) {
	return new Message(subject, body);
};

/**
 * Message send callback
 * @callback ResolveMxCallback
 * @param {Error} err Error handling.
 * @param {Socket} socket Net socket.
 */

/**
 * Mail Message
 * @param {String} subject
 * @param {String} body
 * @property {String} subject
 * @property {String} body
 */
function Message(subject, body) {
	this.subject = subject || '';
	this.body = body || '';
	this.files;
	this.addressTo = [];
	this.addressReply;
	this.addressCC;
	this.addressBCC;
	this.addressFrom = { name: '', address: '' };
	this.closed = false;
	this.tls = false;
	this.$callback;
	// Supports (but it's hidden):
	// this.headers;
	// this.$unsubscribe;
}

Message.prototype.unsubscribe = function(url) {
	var tmp = url.substring(0, 6);
	this.$unsubscribe = tmp === 'http:/' || tmp === 'https:' ? '<' + url + '>' : '<mailto:' + url + '>';
	return this;
};

Message.prototype.callback = function(fn) {
	this.$callback = fn;
	return this;
};

Message.prototype.sender = function(address, name) {
	return this.from(address, name);
};

Message.prototype.from = function(address, name) {

	if (address[address.length - 1] === '>') {
		var index = address.indexOf('<');
		name = address.substring(0, index - 1);
		address = address.substring(index + 1, address.length - 1);
	}

	this.addressFrom.name = name || '';
	this.addressFrom.address = address;
	return this;
};

Message.prototype.to = function(address, name, clear) {

	if (typeof(name) === 'boolean') {
		clear = name;
		name = undefined;
	}

	if (address[address.length - 1] === '>') {
		var index = address.indexOf('<');
		name = address.substring(0, index - 1);
		address = address.substring(index + 1, address.length - 1);
	}

	if (clear)
		this.addressTo = [];

	if (name)
		this.addressTo.push({ email: address, name: name });
	else
		this.addressTo.push(address);

	return this;
};

Message.prototype.cc = function(address, name, clear) {

	if (typeof(name) === 'boolean') {
		clear = name;
		name = undefined;
	}

	if (address[address.length - 1] === '>') {
		var index = address.indexOf('<');
		name = address.substring(0, index - 1);
		address = address.substring(index + 1, address.length - 1);
	}

	if (clear || !this.addressCC)
		this.addressCC = [];

	if (name)
		this.addressCC.push({ email: address, name: name });
	else
		this.addressCC.push(address);

	return this;
};

Message.prototype.bcc = function(address, clear) {
	if (clear || !this.addressBCC)
		this.addressBCC = [];
	this.addressBCC.push(address);
	return this;
};

Message.prototype.reply = function(address, clear) {
	if (clear || !this.addressReply)
		this.addressReply = [];
	this.addressReply.push(address);
	return this;
};

Message.prototype.attachment = function(filename, name) {
	!name && (name = framework_utils.getName(filename));
	var extension = framework_utils.getExtension(name);
	!this.files && (this.files = []);
	this.files.push({ name: name, filename: filename, type: framework_utils.getContentType(extension), extension: extension });
	return this;
};

/**
 * Clears a timeout for sending emails (if the email is sent through the F.onMail)
 * @return {Message}
 */
Message.prototype.manually = function() {
	this.$sending && clearImmediate(this.$sending);
	return this;
};

/**
 * Adds an inline attachment.
 * Inline attachments are exactly like normal attachments except that they are represented with the 'Content-ID' (cid)
 * which can be referenced in the email's html body. For example an inline attachments (image) with a contentId of 'AB435BH'
 * can be used inside the html body as "<img src='cid:AB435BH'>". An enabled web client then can render and show the embedded image.
 *
 * @param {String} filename Filename with extension (e.g. '/local/path/123.jpg')
 * @param {String} name the optional filename (e.g. '123.jpg')
 * @param {String} contentId the Content-ID (e.g. 'AB435BH'), must be unique across the email
 * @returns {Message}
 */
Message.prototype.attachmentInline = function(filename, name, contentId) {
	!name && (name = framework_utils.getName(filename));
	!this.files && (this.files = []);
	var extension = framework_utils.getExtension(name);
	this.files.push({ name: name, filename: filename, type: framework_utils.getContentType(extension), disposition: 'inline', contentId: contentId, extension: extension });
	return this;
};

Message.prototype.send2 = function(callback) {
	var opt = F.temporary['mail-settings'];
	if (!opt) {
		var config = F.config['mail-smtp-options'];
		config && (opt = config);
		F.temporary['mail-settings'] = opt || {};
	}
	mailer.send(F.config['mail-smtp'], opt, this, callback);
	return this;
};

Message.prototype.send = function(smtp, options, callback) {
	mailer.send(smtp, options, this, callback);
	return this;
};

Mailer.prototype.switchToTLS = function(obj, options) {

	var self = this;

	obj.tls = true;
	obj.socket.removeAllListeners();

	var opt = framework_utils.copy(options.tls, { socket: obj.socket, host: obj.socket.$host, ciphers: 'SSLv3' });
	obj.socket2 = Tls.connect(opt, () => self.$send(obj, options, true));

	obj.socket2.on('error', function(err) {
		mailer.destroy(obj);
		self.closed = true;
		self.callback && self.callback(err);
		self.callback = null;
		if (obj.try || err.stack.indexOf('ECONNRESET') !== -1)
			return;
		mailer.$events.error && mailer.emit('error', err, obj);
	});

	obj.socket2.on('clientError', function(err) {
		mailer.destroy(obj);
		self.callback && self.callback(err);
		self.callback = null;
		mailer.$events.error && !obj.try && mailer.emit('error', err, obj);
	});

	obj.socket2.on('connect', () => !options.secure && self.$send(obj, options));
};

Mailer.prototype.destroy = function(obj) {

	if (obj.destroyed)
		return this;

	obj.destroyed = true;
	obj.closed = true;

	if (obj.socket) {
		obj.socket.removeAllListeners();
		obj.socket.end();
		obj.socket.destroy();
		obj.socket = null;
	}

	if (obj.socket2) {
		obj.socket2.removeAllListeners();
		obj.socket2.end();
		obj.socket2.destroy();
		obj.socket2 = null;
	}

	delete this.connections[obj.id];
	return this;
};

const ATTACHMENT_SO = { encoding: 'base64' };

Mailer.prototype.$writeattachment = function(obj) {

	var attachment = obj.files ? obj.files.shift() : false;
	if (!attachment) {
		mailer.$writeline(obj, '--' + obj.boundary + '--', '', '.');
		obj.messagecallback && obj.messagecallback(null, obj.instance);
		obj.messagecallback = null;
		return this;
	}

	var name = attachment.name;
	var stream = Fs.createReadStream(attachment.filename, ATTACHMENT_SO);
	var message = [];
	var extension = attachment.extension;
	var isCalendar = extension === 'ics';

	message.push('--' + obj.boundary);

	if (!isCalendar) {
		if (attachment.contentId) {
			message.push('Content-Disposition: inline; filename="' + name + '"');
			message.push('Content-ID: <' + attachment.contentId + '>');
		} else
			message.push('Content-Disposition: attachment; filename="' + name + '"');
	}

	message.push('Content-Type: ' + attachment.type + ';' + (isCalendar ? ' charset="utf-8"; method=REQUEST' : ''));
	message.push('Content-Transfer-Encoding: base64');
	message.push(CRLF);
	mailer.$writeline(obj, message.join(CRLF));

	stream.$mailer = mailer;
	stream.$mailerobj = obj;
	stream.on('data', writeattachment_data);

	CLEANUP(stream, function() {
		mailer.$writeline(obj, CRLF);
		mailer.$writeattachment(obj);
	});

	return this;
};

function writeattachment_data(chunk) {

	var length = chunk.length;
	var count = 0;
	var beg = 0;

	while (count < length) {

		count += 68;

		if (count > length)
			count = length;

		this.$mailer.$writeline(this.$mailerobj, chunk.slice(beg, count).toString('base64'));
		beg = count;
	}
}

Mailer.prototype.try = function(smtp, options, callback) {
	return this.send(smtp, options, undefined, callback);
};

Mailer.prototype.send2 = function(messages, callback) {

	var opt = F.temporary['mail-settings'];

	if (!opt) {
		var config = F.config['mail-smtp-options'];
		if (config) {
			if (typeof(config) === 'object')
				opt = config;
			else
				opt = config.toString().parseJSON();
		}

		if (!opt)
			opt = {};

		F.temporary['mail-settings'] = opt;
	}

	return this.send(F.config['mail-smtp'], opt, messages, callback);
};

Mailer.prototype.send = function(smtp, options, messages, callback) {

	if (options instanceof Array) {
		callback = messages;
		messages = options;
		options = {};
	} else if (typeof(options) === 'function') {
		callback = options;
		options = {};
	}

	var self = this;
	var id = 'abcdefghijkl' + (INDEXSENDER++);

	self.connections[id] = {};
	var obj = self.connections[id];

	obj.id = id;
	obj.try = messages === undefined;
	obj.messages = obj.try ? EMPTYARRAY : messages instanceof Array ? messages : [messages];
	obj.callback = callback;
	obj.closed = false;
	obj.message = null;
	obj.files = null;
	obj.count = 0;
	obj.socket;
	obj.tls = false;
	obj.date = global.F ? global.F.datetime : new Date();

	smtp = smtp || null;

	if (options && options.secure && !options.port)
		options.port = 465;

	options = framework_utils.copy(options, { secure: false, port: 25, user: '', password: '', timeout: 10000, tls: null });

	if (options.secure) {
		var internal = framework_utils.copy(options);
		internal.host = smtp;
		obj.socket = Tls.connect(internal, () => mailer.$send(obj, options));
	} else
		obj.socket = Net.createConnection(options.port, smtp);

	if (!smtp)  {
		var err = new Error('No SMTP server configuration. Mail message won\'t be sent.');
		callback && callback(err);
		F.error(err, 'mail-smtp');
		return self;
	}

	obj.socket.$host = smtp;
	obj.host = smtp.substring(smtp.lastIndexOf('.', smtp.lastIndexOf('.') - 1) + 1);
	obj.socket.on('error', function(err) {
		mailer.destroy(obj);
		obj.callback && obj.callback(err);
		obj.callback = null;
		if (obj.try || err.stack.indexOf('ECONNRESET') !== -1)
			return;
		mailer.$events.error && mailer.emit('error', err, obj);
	});

	obj.socket.on('clientError', function(err) {
		mailer.destroy(obj);
		obj.callback && obj.callback(err);
		obj.callback = null;
		mailer.$events.error && !obj.try && mailer.emit('error', err, obj);
	});

	obj.socket.setTimeout(options.timeout || 8000, function() {
		var err = new Error(framework_utils.httpStatus(408));
		mailer.destroy(obj);
		obj.callback && obj.callback(err);
		obj.callback = null;
		mailer.$events.error && !obj.try && mailer.emit('error', err, obj);
	});

	obj.socket.on('connect', () => !options.secure && mailer.$send(obj, options));
	return self;
};

Mailer.prototype.$writemessage = function(obj, buffer) {

	var self = this;
	var msg = obj.messages.shift();
	var message = [];

	if (global.F)
		global.F.stats.other.mail++;

	obj.boundary = '--totaljs' + obj.date.getTime() + obj.count;
	obj.files = msg.files;
	obj.count++;

	buffer.push('MAIL FROM: <' + msg.addressFrom.address + '>');
	message.push('Message-ID: <total' + (INDEXATTACHMENT++) + '@WIN-t' + (INDEXATTACHMENT) + '>');
	message.push('MIME-Version: 1.0');
	message.push('From: ' + (msg.addressFrom.name ? unicode_encode(msg.addressFrom.name) + ' <' + msg.addressFrom.address + '>' : msg.addressFrom.address));

	var length;

	if (msg.headers) {
		var headers = Object.keys(msg.headers);
		for (var i = 0, length = headers.length; i < length; i++)
			message.push(headers[i] + ': ' + msg.headers[headers[i]]);
	}

	length = msg.addressTo.length;

	var builder = '';
	var mail;
	var item;

	if (length) {
		for (var i = 0; i < length; i++) {
			item = msg.addressTo[i];
			if (item instanceof Object)
				mail = '<' + item.email + '>';
			else
				mail = '<' + item + '>';
			buffer.push('RCPT TO: ' + mail);
			builder += (builder ? ', ' : '') + (item instanceof Object ? unicode_encode(item.name) + ' ' : '') + mail;
		}
		message.push('To: ' + builder);
		builder = '';
	}

	if (msg.addressCC) {
		length = msg.addressCC.length;
		for (var i = 0; i < length; i++) {
			item = msg.addressCC[i];
			if (item instanceof Object)
				mail = '<' + item.email  + '>';
			else
				mail = '<' + item + '>';
			buffer.push('RCPT TO: ' + mail);
			builder += (builder ? ', ' : '') + (item instanceof Object ? unicode_encode(item.name) + ' ' : '') + mail;
		}
		message.push('Cc: ' + builder);
		builder = '';
	}

	if (msg.addressBCC) {
		length = msg.addressBCC.length;
		for (var i = 0; i < length; i++)
			buffer.push('RCPT TO: <' + msg.addressBCC[i] + '>');
	}

	buffer.push('DATA');
	buffer.push('');

	message.push('Date: ' + obj.date.toUTCString());
	message.push('Subject: ' + unicode_encode(msg.subject));
	msg.$unsubscribe && message.push('List-Unsubscribe: ' + msg.$unsubscribe);

	if (msg.addressReply) {
		length = msg.addressReply.length;
		for (var i = 0; i < length; i++)
			builder += (builder !== '' ? ', ' : '') + '<' + msg.addressReply[i] + '>';
		message.push('Reply-To: ' + builder);
		builder = '';
	}

	message.push('Content-Type: multipart/mixed; boundary=' + obj.boundary);
	message.push('');
	message.push('--' + obj.boundary);
	message.push('Content-Type: ' + (msg.body.indexOf('<') !== -1 && msg.body.lastIndexOf('>') !== -1 ? 'text/html' : 'text/plain') + '; charset=utf-8');
	message.push('Content-Transfer-Encoding: base64');
	message.push('');
	message.push(prepareBASE64(framework_utils.createBuffer(msg.body.replace(REG_WINLINE, '\n').replace(REG_NEWLINE, CRLF)).toString('base64')));

	obj.message = message.join(CRLF);
	obj.messagecallback = msg.$callback;
	obj.instance = msg;

	message = null;
	return self;
};

Mailer.prototype.$writeline = function(obj) {

	if (obj.closed)
		return false;

	var socket = obj.socket2 ? obj.socket2 : obj.socket;

	for (var i = 1; i < arguments.length; i++) {
		var line = arguments[i];
		if (line) {
			mailer.debug && console.log('SEND', line);
			socket.write(line + CRLF);
		}
	}

	return true;
};

Mailer.prototype.$send = function(obj, options, autosend) {

	var self = this;
	var buffer = [];
	var isAuthorized = false;
	var isAuthorization = false;
	var command = '';
	var auth = [];
	var socket = obj.socket2 ? obj.socket2 : obj.socket;
	var host = obj.host;
	var line = null;
	var isAttach = !options.tls || (obj.tls && options.tls);

	isAttach && mailer.$events.send && mailer.emit('send', obj);
	socket.setEncoding('utf8');

	socket.on('end', function() {
		mailer.destroy(obj);
		obj.callback && obj.callback();
		obj.callback = null;
		line = null;
	});

	socket.on('data', function(data) {

		if (obj.closed)
			return;

		while (true) {

			var index = data.indexOf(BUF_CRLF);
			if (index === -1) {
				if (line) {
					CONCAT[0] = line;
					CONCAT[1] = data;
					line = Buffer.concat(CONCAT);
				} else
					line = data;
				break;
			}

			var tmp = data.slice(0, index).toString('utf8');
			data = data.slice(index + BUF_CRLF.length);
			tmp && socket && socket.emit('line', tmp);
		}
	});

	socket.on('line', function(line) {

		line = line.toUpperCase();
		mailer.debug && console.log('<---', line);

		var code = +line.match(REG_STATE)[0];

		if (code === 250 && !isAuthorization) {
			if (REG_AUTH.test(line) && ((options.user && options.password) || options.xoauth2)) {
				isAuthorization = true;
				if (options.xoauth2 && line.indexOf('XOAUTH2') !== -1)
					auth.push('AUTH XOAUTH2 ' + options.xoauth2);
				else if (line.lastIndexOf('XOAUTH') === -1) {
					auth.push('AUTH LOGIN');
					auth.push(framework_utils.createBuffer(options.user).toString('base64'));
					auth.push(framework_utils.createBuffer(options.password).toString('base64'));
				} else
					auth.push('AUTH PLAIN ' + framework_utils.createBuffer('\0'+ options.user + '\0' + options.password).toString('base64'));
			}
		}

		// help
		if (line.substring(3, 4) === '-')
			return;

		if (!isAuthorized && isAuthorization) {
			isAuthorized = true;
			code = 334;
		}

		switch (code) {
			case 220:

				if (obj.isTLS) {
					mailer.switchToTLS(obj, options);
					return;
				}

				command = obj.isTLS || (options.user && options.password) || REG_ESMTP.test(line) ? 'EHLO' : 'HELO';
				mailer.$writeline(obj, command + ' ' + host);
				break;

			case 250: // OPERATION
			case 251: // FORWARD
			case 235: // VERIFY
			case 999: // Total.js again

				mailer.$writeline(obj, buffer.shift());

				if (buffer.length)
					return;

				// NEW MESSAGE
				if (obj.messages.length) {
					mailer.$writemessage(obj, buffer);
					mailer.$writeline(obj, buffer.shift());
				} else {
					// end
					mailer.$writeline(obj, 'QUIT');
				}

				return;

			case 221: // BYE
				mailer.destroy(obj);
				obj.callback && obj.callback(null, obj.try ? true : obj.count);
				obj.callback = null;
				return;

			case 334: // LOGIN

				if (!self.tls && !obj.isTLS && options.tls) {
					obj.isTLS = true;
					mailer.$writeline(obj, 'STARTTLS');
					return;
				}

				var value = auth.shift();
				if (value) {
					mailer.$writeline(obj, value);
				} else {
					var err = new Error('Forbidden.');
					mailer.destroy(obj);
					obj.callback && obj.callback(err);
					obj.callback = null;
					mailer.$events.error && !obj.try && mailer.emit('error', err, obj);
				}

				return;

			case 354:
				mailer.$writeline(obj, obj.message);
				mailer.$writeattachment(obj);
				obj.message = null;
				return;

			default:

				if (code < 400)
					return;

				var err = new Error(line);

				mailer.$events.error && !obj.try && mailer.emit('error', err, obj);
				obj.messagecallback && obj.messagecallback(err, obj.instance);
				obj.messagecallback = null;

				if (obj.message) {
					// a problem
					buffer = [];
					obj.count--;
					socket.emit('line', '999 TRY NEXT MESSAGE');
				} else {
					mailer.destroy(obj);
					obj.callback && obj.callback(err);
					obj.callback = null;
				}

				return;
		}
	});

	autosend && self.$writeline(obj, 'EHLO ' + host);
};

Mailer.prototype.restart = function() {
	var self = this;
	self.removeAllListeners();
	self.debug = false;
	INDEXSENDER = 0;
	INDEXATTACHMENT = 0;
};

// Split Base64 to lines with 68 characters
function prepareBASE64(value) {

	var index = 0;
	var output = '';
	var length = value.length;

	while (index < length) {
		var max = index + 68;
		if (max > length)
			max = length;
		output += value.substring(index, max) + CRLF;
		index = max;
	}

	return output;
}

function unicode_encode(val) {
	return val ? '=?utf-8?B?' + framework_utils.createBuffer(val.toString()).toString('base64') + '?=' : '';
}

// ======================================================
// EXPORTS
// ======================================================

var mailer = new Mailer();
module.exports = mailer;