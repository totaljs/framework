var net = require('net');
var tls = require('tls');
var events = require('events');
var dns = require('dns');
var fs = require('fs');
var path = require('path');

const CRLF = '\r\n';
const UNDEFINED = 'undefined';

var errors = {
	notvalid: 'e-mail address is not valid',
	resolve: 'Cannot resolve MX of ',
	connection: 'Cannot connect to any SMTP server.'
};

/*
	Mailer class
	extended via prototypes
*/
function Mailer() {
	this.debug = false;
	this.Message = Message;
	this.Mail = Message;
}

Mailer.prototype = new events.EventEmitter();

Mailer.prototype.create = function(subject, body) {
	return new Message(subject, body);
};

/*
	Resolve MX
	@domain {String}
	@callback {Function} :: callback(error, socket);
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
                sock.removeAllListeners('error');
                callback(null, sock);
            });
        }

        tryConnect(0);
    });
}

function Message(subject, body) {
	this.subject = subject || '';
	this.body = body || '';
	this.files = [];
	this.addressTo = [];
	this.addressReply = [];
	this.addressCC = [];
	this.addressBCC = [];
	this.addressFrom = { name: '', address: '' };
}

/*
	Set sender address and name
	@address {String}
	@name {String} :: optional
	return {Message}
*/
Message.prototype.sender = function(address, name) {
	return this.from(address, name);
};

/*
	Set from address and name
	@address {String}
	@name {String} :: optional
	return {Message}
*/
Message.prototype.from = function(address, name) {

	if (!address.isEmail())
		throw new Error(errors.notvalid);

	var self = this;

	self.addressFrom.name = name || '';
	self.addressFrom.address = address;
	return self;

};

/*
	Add a recipient
	@address {String}
	return {Message}
*/
Message.prototype.to = function(address) {

	if (!address.isEmail())
		throw new Error(errors.notvalid);

	var self = this;
	self.addressTo.push(address);
	return self;

};

/*
	Add a CC recipient
	@address {String}
	return {Message}
*/
Message.prototype.cc = function(address) {

	if (!address.isEmail())
		throw new Error(errors.notvalid);

	var self = this;
	self.addressCC.push(address);
	return self;

};

/*
	Add a BCC recipient
	@address {String}
	return {Message}
*/
Message.prototype.bcc = function(address) {

	if (!address.isEmail())
		throw new Error(errors.notvalid);

	var self = this;
	self.addressBCC.push(address);
	return self;

};

/*
	Add a reply to address
	@address {String}
	return {Message}
*/
Message.prototype.reply = function(address) {

	if (!address.isEmail())
		throw new Error(errors.notvalid);

	var self = this;
	self.addressReply.push(address);
	return self;

};

/*
	Add a attachment
	@filename {String}
	@name {String} :: optional, name with extension
	return {Message}
*/
Message.prototype.attachment = function(filename, name) {

	var self = this;

	if (typeof(name) === UNDEFINED)
		name = path.basename(filename);

	self.files.push({ name: name, filename: filename, contentType: utils.getContentType(path.extname(name)) });
	return self;

};

/*
	Send e-mail
	@smtp {String}
	@options {Object} :: optional, @port {Number}, @timeout {Number}, @user {String}, @password {String}
	@fnCallback {Function} :: optional
	return {Message}
*/
Message.prototype.send = function(smtp, options, fnCallback) {

	var self = this;
	smtp = smtp || null;

	if (typeof(options) === 'function') {
		var tmp = fnCallback;
		fnCallback = options;
		options = tmp;
	}

	options = utils.copy({ secure: false, port: 25, user: '', password: '', timeout: 10000 }, options, true);

	if (smtp === null || smtp === '') {

		smtp = getHostName(self.addressFrom.address);
		resolveMx(smtp, function(err, socket) {

			if (err) {
				mailer.emit('error', err, self);
				fnCallback();
				return;
			}

			socket.on('error', function(err) {
				mailer.emit('error', err, self);
			});

			self._send(socket, options);
		});

		return self;
	}

	var socket = options.secure ? tls.connect(options.port, smtp) : net.createConnection(options.port, smtp);

	socket.on('error', function(err) {
		mailer.emit('error', err, self);
		fnCallback();
	});

	socket.on('secureConnect', function() {
		self._send(socket, options);
	});

    socket.on('connect', function() {
		self._send(socket, options);
    });

    if (fnCallback)
		socket.on('close', fnCallback);

    return self;
};

Message.prototype._send = function(socket, options) {

	var self = this;
	var command = '';
	var buffer = [];
	var message = [];
	var host = getHostName(self.addressFrom.address);
	var date = new Date();
	var timestamp = date.getTime();
	var boundary = '----partialjs' + timestamp;
	var isAuthenticated = false;
	var isAuthorization = false;
	var authType = '';
	var auth = [];

	mailer.emit('sending', self);

	socket.setTimeout(options.timeout || 5000, function() {
		mailer.emit('error', new Error(utils.httpStatus(408)), self);
		socket.destroy();
		socket = null;
	});

	socket.setEncoding('utf8');

	var write = function(line) {

		if (mailer.debug)
			console.log('SEND', line);

		socket.write(line + CRLF);
	};

	buffer.push('MAIL FROM: <' + self.addressFrom.address + '>');
	message.push('From: ' + (self.addressFrom.name.length > 0 ? '"' + self.addressFrom.name + '" ' + '<' + self.addressFrom.address + '>' : self.addressFrom.address));

	var length = self.addressTo.length;
	var builder = '';

	if (length > 0) {

		for (var i = 0; i < length; i++) {
			var mail = '<' + self.addressTo[i] + '>';
			buffer.push('RCPT TO: ' + mail);
			builder += (builder !== '' ? ', ' : '') + mail;
		}

		message.push('To: ' + builder);
		builder = '';

	}

	length = self.addressCC.length;
	if (length > 0) {

		for (var i = 0; i < length; i++) {
			var mail = '<' + self.addressCC[i] + '>';
			buffer.push('RCPT TO: ' + mail);
			builder += (builder !== '' ? ', ' : '') + mail;
		}

		message.push('Cc: ' + builder);
		builder = '';

	}

	length = self.addressBCC.length;
	if (length > 0) {
		for (var i = 0; i < length; i++)
			buffer.push('RCPT TO: <' + self.addressBCC[i] + '>');
	}

	buffer.push('DATA');
	buffer.push('QUIT');
	buffer.push('');

	message.push('Subject: ' + self.subject);
	message.push('MIME-Version: 1.0');
	message.push('Message-ID: <' + timestamp + host + '>');
	message.push('Date: ' + date.toUTCString());

	length = self.addressReply.length;
	if (length > 0) {

		for (var i = 0; i < length; i++)
			builder += (builder !== '' ? ', ' : '') + '<' + self.addressReply[i] + '>';

		message.push('Reply-To: ' + builder);
		builder = '';
	}

	message.push('Content-Type: multipart/mixed; boundary="' + boundary + '"');
	message.push('');

	message.push('--' + boundary);
	message.push('Content-Type: ' + (self.body.indexOf('<') !== -1 && self.body.indexOf('>') !== -1 ? 'text/html' : 'text/plain') + '; charset="utf8"');
	message.push('Content-Transfer-Encoding: base64');
	message.push(CRLF);
	message.push(new Buffer(self.body.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')).toString('base64'));

	length = self.files.length;

	if (mailer.debug) {
		socket.on('end', function() {
			console.log('END');
		});
	}

	socket.on('data', function(data) {

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
			console.log('–––>', line);

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

				command = /\besmtp\b/i.test(line) ? 'EHLO' : 'HELO';
				write(command + ' ' + host);
				break;

            case 221: // BYE
            case 250: // OPERATION
            case 251: // FORWARD
            case 235: // VERIFY

				write(buffer.shift());

				if (buffer.length === 0) {
					mailer.emit('success', self);
					ending = setTimeout(function() {
						socket.destroy();
						socket = null;
					}, 500);
				}

				break;

			case 334: // LOGIN

				var value = auth.shift();

				if (typeof(value) === UNDEFINED) {
					mailer.emit('error', new Error('Forbidden.'), self);
					socket.destroy();
					socket = null;
					break;
				}

				write(value);
				break;

			case 354:

				write(message.join(CRLF));

				if (self.files.length > 0) {
					message = null;
					self._writeAttachment(write, boundary);
					return;
				}

				write('--' + boundary + '--');
				write('');
				write('.');
				message = null;
				break;

			default:

				if (code > 399) {
					socket.destroy();
					socket = null;
					mailer.emit('error', new Error(line), self);
				}

				break;
		}
	});

};

Message.prototype._writeAttachment = function(write, boundary) {

	var self = this;
	var attachment = self.files.shift();

	if (typeof(attachment) === UNDEFINED) {
		write('--' + boundary + '--');
		write('');
		write('.');
		return;
	}

	var name = attachment.name;

	fs.readFile(attachment.filename, 'base64', function(err, data) {

		if (err) {
			mailer.error('error', err, self);
			self._writeAttachment(write, boundary);
			return;
		}

		var message = [];
		message.push('--' + boundary);
		message.push('Content-Type: application/octet-stream; name="' + name + '"');
		message.push('Content-Transfer-Encoding: base64');
		message.push('Content-Disposition: attachment; filename="' + name + '"');
		message.push(CRLF);
		message.push(data);
		message.push('');
		write(message.join(CRLF));

		self._writeAttachment(write, boundary);
	});

	return self;
};

/*
	@address {String}
*/
function getHostName(address) {
    return address.substring(address.indexOf('@') + 1);
}

// ======================================================
// EXPORTS
// ======================================================
var mailer = new Mailer();
module.exports = mailer;