// Copyright 2012-2015 (c) Peter Širka <petersirka@gmail.com>
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
 * @version 1.9.1
 */

'use strict'

var net = require('net');
var tls = require('tls');
var events = require('events');
var dns = require('dns');
var fs = require('fs');
var path = require('path');
var CRLF = '\r\n';
var UNDEFINED = 'undefined';
var REG_ESMTP = /\besmtp\b/i;

var errors = {
	notvalid: 'E-mail address is not valid',
	resolve: 'Cannot resolve MX of ',
	connection: 'Cannot connect to any SMTP server.'
};

if (!global.framework_utils)
	global.framework_utils = require('./utils');

/**
 * Mailer
 * @class
 * @property {Boolean} debug Debug mode (true/false).
 */
function Mailer() {
	this.debug = false;
	this.Message = Message;
	this.Mail = Message;
}

Mailer.prototype.__proto__ = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: Mailer,
		enumberable: false
	}
});

/**
 * Create Mail Message
 * @param  {String} subject
 * @param  {String} body
 * @return {MailMessage}
 */
Mailer.prototype.create = function(subject, body) {
	return new Message(subject, body);
};

/*
	Resolve MX
	@domain {String}
	@callback {Function} :: callback(error, socket);
*/
/**
 * Resolve MX record
 * @param  {String}   domain   Domain name.
 * @param  {ResolveMxCallback} callback Callback.
 */
function resolveMx(domain, callback) {

	dns.resolveMx(domain, function(err, data) {

		if (err) {
			callback(err, data);
			return;
		}

		if (!data || data.length === 0) {
			callback(new Error(errors.resolve + domain));
			return;
		}

		data.sort(function(a, b) {
			return a.priority < b. priority;
		});

		function tryConnect(index) {

			if (index >= data.length) {
				callback(new Error(errors.connection));
				return;
			}

			var sock = net.createConnection(25, data[index].exchange);

			sock.on('error', function(err) {
				tryConnect(++index);
			});

			sock.on('connect', function() {
				callback(null, sock);
			});
		}

		tryConnect(0);
	});
}

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
	this.files = new Array(0);
	this.addressTo = new Array(0);
	this.addressReply = new Array(0);
	this.addressCC = new Array(0);
	this.addressBCC = new Array(0);
	this.addressFrom = { name: '', address: '' };
	this.callback = null;
	this.closed = false;
	this.tls = false;
	// Supports (but it's hidden):
	// this.headers;
}

/**
 * Set sender
 * @param {String} address A valid e-mail address.
 * @param {String} name User name.
 * @return {Message}
 */
Message.prototype.sender = function(address, name) {
	return this.from(address, name);
};

/**
 * Set sender
 * @param  {String} address A valid e-mail address.
 * @param  {String} name    User name.
 * @return {Message}
 */
Message.prototype.from = function(address, name) {

	if (!address.isEmail())
		throw new Error(errors.notvalid);

	var self = this;

	self.addressFrom.name = name || '';
	self.addressFrom.address = address;
	return self;

};

/**
 * Add a recipient
 * @param  {String} address A valid e-mail addrčess.
 * @return {Message}
 */
Message.prototype.to = function(address) {

	if (!address.isEmail())
		throw new Error(errors.notvalid);

	var self = this;
	self.addressTo.push(address);
	return self;

};

/**
 * Add a CC recipient
 * @param  {String} address A valid e-mail addrčess.
 * @return {Message}
 */
Message.prototype.cc = function(address, clear) {

	if (!address.isEmail())
		throw new Error(errors.notvalid);

	var self = this;

	if (clear)
		self.addressCC = new Array(0);

	self.addressCC.push(address);
	return self;

};

/**
 * Add a BCC recipient
 * @param  {String} address A valid e-mail addrčess.
 * @return {Message}
 */
Message.prototype.bcc = function(address, clear) {

	if (!address.isEmail())
		throw new Error(errors.notvalid);

	var self = this;

	if (clear)
		self.addressBCC = new Array(0);

	self.addressBCC.push(address);
	return self;

};

/**
 * Add a reply to address
 * @param  {String} address A valid e-mail addrčess.
 * @return {Message}
 */
Message.prototype.reply = function(address, clear) {

	if (!address.isEmail())
		throw new Error(errors.notvalid);

	var self = this;

	if (clear)
		self.addressReply = new Array(0);

	self.addressReply.push(address);
	return self;

};

/**
 * Add an attachment
 * @param  {String} filename Filename with extension.
 * @return {Message}
 */
Message.prototype.attachment = function(filename, name) {

	var self = this;

	if (name === undefined)
		name = path.basename(filename);

	self.files.push({ name: name, filename: filename, contentType: framework_utils.getContentType(path.extname(name)) });
	return self;

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
	var self = this;
	if (name === undefined)
		name = path.basename(filename);

	self.files.push({name: name, filename: filename, contentType: framework_utils.getContentType(path.extname(name)), disposition: 'inline', contentId: contentId});
	return self;
};

/**
 * Send e-mail
 * @param {String} smtp SMTP server / hostname.
 * @param {Object} options Options (optional).
 * @param {Function(err)} fnCallback
 * @return {Message}
 */
Message.prototype.send = function(smtp, options, fnCallback) {

	var self = this;
	smtp = smtp || null;

	if (typeof(options) === 'function') {
		var tmp = fnCallback;
		fnCallback = options;
		options = tmp;
	}

	self.isSent = false;

	self.callback = fnCallback;

	if (options.secure && !options.port)
		options.port = 465;

	options = framework_utils.copy(options, { secure: false, port: 25, user: '', password: '', timeout: 10000, tls: null });

	if (smtp === null || smtp === '') {

		smtp = getHostName(self.addressFrom.address);
		resolveMx(smtp, function(err, socket) {

			if (err) {
				mailer.emit('error', err, self);

				if (!self.isSent && fnCallback)
					fnCallback(err);

				return;
			}

			socket.on('error', function(err) {
				mailer.emit('error', err, self);

				if (!self.isSent && fnCallback)
					fnCallback(err);

			});

			self._send(socket, options);
		});

		return self;
	}

	var socket;

	if (options.secure) {
		var internal = framework_utils.copy(options);
		internal.host = smtp;
		socket = tls.connect(internal, function() { self._send(this, options); });
	} else
		socket = net.createConnection(options.port, smtp);

	socket.$host = smtp;

	socket.on('error', function(err) {
		socket.destroy();
		self.closed = true;
		if (!self.isSent && self.callback)
			self.callback(err);
		if (err.stack.indexOf('ECONNRESET') === -1)
			mailer.emit('error', err, self);
	});

	socket.on('clientError', function(err) {
		mailer.emit('error', err, self);
		if (!self.isSent && self.callback)
			self.callback(err);
	});

	socket.on('connect', function() {
		if (!options.secure)
			self._send(socket, options);
	});

	return self;
};

Message.prototype.switchToTLS = function(socket, options) {
	var self = this;
	self.tls = true;

    socket.removeAllListeners('data');
    socket.removeAllListeners('error');
    socket.removeAllListeners('clientError');

	var opt = framework_utils.copy(options.tls, { socket: socket, host: socket.$host, ciphers: 'SSLv3' });
	var sock = tls.connect(opt, function() { self._send(this, options, true); });

	sock.on('error', function(err) {
		sock.destroy();
		self.closed = true;
		if (!self.isSent && self.callback)
			self.callback(err);
		if (err.stack.indexOf('ECONNRESET') === -1)
			mailer.emit('error', err, self);
	});

	sock.on('clientError', function(err) {
		mailer.emit('error', err, self);
		if (!self.isSent && self.callback)
			self.callback(err);
	});

	sock.on('connect', function() {
		if (!options.secure)
			self._send(sock, options);
	});
};

/**
 * Internal: Send method
 * @private
 * @param  {Socket} socket
 * @param  {Object} options
 */
Message.prototype._send = function(socket, options, autosend) {

	var self = this;
	var command = '';
	var buffer = [];
	var message = [];
	var host = getHostName(self.addressFrom.address);
	var date = new Date();
	var boundary = '--totaljs' + date.getTime();
	var isAuthenticated = false;
	var isAuthorization = false;
	var authType = '';
	var auth = [];
	var err = null;
	var ending = null;
	var isTLS = false;

	var write = function(line) {
		if (self.closed)
			return;
		if (mailer.debug)
			console.log('SEND', line);
		socket.write(line + CRLF);
	};

	var isAttach = !options.tls || (self.tls && options.tls);
	if (isAttach)
		mailer.emit('send', self);

	socket.setTimeout(options.timeout || 5000, function() {
		self.closed = true;
		var err = new Error(framework_utils.httpStatus(408));
		mailer.emit('error', err, self);
		if (socket !== null)
			socket.destroy();
		socket = null;
		if (!self.isSent && self.callback)
			self.callback(err);
	});

	socket.setEncoding('utf8');

	if (isAttach) {
		buffer.push('MAIL FROM: <' + self.addressFrom.address + '>');
		message.push('Message-ID: <' + GUID() + '@WIN-' + s4() + '>');
		message.push('MIME-Version: 1.0');
		message.push('From: ' + (self.addressFrom.name ? unicode_encode(self.addressFrom.name) + ' <' + self.addressFrom.address + '>' : self.addressFrom.address));

		var length;

		if (self.headers) {
			var headers = Object.keys(self.headers);
			for (var i = 0, length = headers.length; i < length; i++)
				message.push(headers[i] + ': ' + self.headers[headers[i]]);
		}

		length = self.addressTo.length;
		var builder = '';
		var mail;

		if (length) {

			for (var i = 0; i < length; i++) {
				mail = '<' + self.addressTo[i] + '>';
				buffer.push('RCPT TO: ' + mail);
				builder += (builder !== '' ? ', ' : '') + mail;
			}

			message.push('To: ' + builder);
			builder = '';
		}

		length = self.addressCC.length;
		if (length) {

			for (var i = 0; i < length; i++) {
				mail = '<' + self.addressCC[i] + '>';
				buffer.push('RCPT TO: ' + mail);
				builder += (builder !== '' ? ', ' : '') + mail;
			}

			message.push('Cc: ' + builder);
			builder = '';

		}

		length = self.addressBCC.length;
		if (length) {
			for (var i = 0; i < length; i++)
				buffer.push('RCPT TO: <' + self.addressBCC[i] + '>');
		}

		buffer.push('DATA');
		buffer.push('QUIT');
		buffer.push('');

		message.push('Date: ' + date.toUTCString());
		message.push('Subject: ' + unicode_encode(self.subject));

		length = self.addressReply.length;

		if (length) {
			for (var i = 0; i < length; i++)
				builder += (builder !== '' ? ', ' : '') + '<' + self.addressReply[i] + '>';

			message.push('Reply-To: ' + builder);
			builder = '';
		}

		message.push('Content-Type: multipart/mixed; boundary=' + boundary);
		message.push('');
		message.push('--' + boundary);
		message.push('Content-Type: ' + (self.body.indexOf('<') !== -1 && self.body.lastIndexOf('>') !== -1 ? 'text/html' : 'text/plain') + '; charset=utf-8');
		message.push('Content-Transfer-Encoding: base64');
		message.push('');
		message.push(prepareBASE64(new Buffer(self.body.replace(/\r\n/g, '\n').replace(/\n/g, CRLF)).toString('base64')));

		length = self.files.length;
	}

	socket.on('end', function() {
		self.closed = true;
		if (socket)
			socket.destroy();
	});

	socket.on('data', function(data) {

		if (self.closed)
			return;

		var response = data.toString().split(CRLF);
		var length = response.length;

		for (var i = 0; i < length; i++) {

			var line = response[i];
			if (line === '')
				continue;

			if (socket)
				socket.emit('line', line);
		}
	});

	socket.on('line', function(line) {
		line = line.toUpperCase();

		if (mailer.debug)
			console.log('<–––', line);

		var code = parseInt(line.match(/\d+/)[0], 10);
		if (code === 250 && !isAuthorization) {
			if ((line.indexOf('AUTH LOGIN PLAIN') !== -1 || line.indexOf('AUTH PLAIN LOGIN') !== -1) || (options.user && options.password)) {
				authType = 'plain';
				isAuthorization = true;
				if (line.indexOf('XOAUTH') === -1) {
					auth.push('AUTH LOGIN');
					auth.push(new Buffer(options.user).toString('base64'));
					auth.push(new Buffer(options.password).toString('base64'));
				} else
					auth.push('AUTH PLAIN ' + new Buffer('\0'+ options.user + '\0' + options.password).toString('base64'));
			}
		}

		if (line.substring(3, 4) === '-') {
			// help
			return;
		}

		if (!isAuthenticated && isAuthorization) {
			isAuthenticated = true;
			code = 334;
		}

		switch (code) {
			case 220:

				if (isTLS) {
					self.switchToTLS(socket, options);
					return;
				}

				//command = isTLS || /\besmtp\b/i.test(line) ? 'EHLO' : 'HELO';
				// @CHANGED: only ESMTP supports auth, so this fix has fixed EXIM mail servers
				command = isTLS || (options.user && options.password) || REG_ESMTP.test(line) ? 'EHLO' : 'HELO';
				write(command + ' ' + host);
				break;

			case 221: // BYE
			case 250: // OPERATION
			case 251: // FORWARD
			case 235: // VERIFY

				write(buffer.shift());

				if (buffer.length === 0) {
					self.isSent = true;

					mailer.emit('success', self);

					if (self.callback)
						self.callback(null);

					ending = setTimeout(function() {
						if (socket !== null)
							socket.destroy();
						socket = null;
					}, 500);
				}

				break;

			case 334: // LOGIN

				if (!self.tls && !isTLS && options.tls) {
					isTLS = true;
					write('STARTTLS');
					return;
				}

				var value = auth.shift();
				if (value === undefined) {

					err = new Error('Forbidden.');
					mailer.emit('error', err, self);

					if (!self.isSent && self.callback)
						self.callback(err);

					if (socket !== null)
						socket.destroy();
					socket = null;
					break;
				}

				write(value);
				break;

			case 354:

				write(message.join(CRLF));

				if (self.files.length) {
					message = null;
					self._writeAttachment(write, boundary, socket);
					return;
				}

				write('--' + boundary + '--');
				write('');
				write('.');
				message = null;
				break;

			default:

				if (code < 400)
					break;

				err = new Error(line);

				if (socket !== null)
					socket.destroy();

				socket = null;
				mailer.emit('error', err, self);

				if (!self.isSent && self.callback)
					self.callback(err);

				break;
		}
	});

	if (autosend)
		write('EHLO ' + host);
};

/**
 * Internal: Write attachment into the current socket
 * @param  {Function} write  Write function.
 * @param  {String} boundary Boundary.
 * @param  {Socket} socket   Current socket.
 */
Message.prototype._writeAttachment = function(write, boundary, socket) {

	var self = this;
	var attachment = self.files.shift();

	if (attachment === undefined) {
		write('--' + boundary + '--');
		write('');
		write('.');
		return;
	}

	var name = attachment.name;
	var stream = fs.createReadStream(attachment.filename, { encoding: 'base64' });
	var message = [];

	message.push('--' + boundary);

	if (attachment.contentId) {
		message.push('Content-Disposition: inline; filename="' + name + '"');
		message.push('Content-ID: <' + attachment.contentId + '>');
	} else
		message.push('Content-Disposition: attachment; filename="' + name + '"');

	message.push('Content-Type: application/octet-stream;');
	message.push('Content-Transfer-Encoding: base64');
	message.push(CRLF);

	write(message.join(CRLF));

	stream.on('data', function(buf) {

		var length = buf.length;
		var count = 0;
		var beg = 0;

		while (count < length) {

			count += 68;

			if (count > length)
				count = length;

			write(buf.slice(beg, count).toString('base64'));
			beg = count;
		}
	});

	stream.on('end', function() {
		write(CRLF);
		self._writeAttachment(write, boundary, socket);
	});

	return self;
};

/**
 * Split Base64 to lines with 68 characters
 * @private
 * @param  {String} value Base64 message.
 * @return {String}
 */
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

/**
 * Get hostname
 * @param  {String} address A valid e-mail address.
 * @return {String} Hostname.
 */
function getHostName(address) {
	return address.substring(address.indexOf('@') + 1);
}

/**
 * Internal: Create random hexadecimal string
 * @private
 * @return {String}
 */
function s4() {
	return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1).toUpperCase();
}

/**
 * Create GUID identificator
 * @private
 * return {String}
 */
function GUID() {
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function unicode_encode(val) {
	if (!val)
		return '';
	return '=?utf-8?B?' + new Buffer(val).toString('base64') + '?=';
}

// ======================================================
// EXPORTS
// ======================================================

var mailer = new Mailer();
module.exports = mailer;
