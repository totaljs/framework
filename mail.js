// Copyright Peter Širka, Web Site Design s.r.o. (www.petersirka.sk)
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

'use strict';

var net = require('net');
var util = require('util');
var events = require('events');
var dns = require('dns');
var CRLF = '\r\n';

/*
	Mailer class
	extended via prototypes
*/
function Mailer() {
	this.debug = false;
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

        if (!data || data.length == 0) {
            callback(new Error('Cannot resolve MX of ' + domain));
            return;
        }

        data.sort(function(a, b) {
            return a.priority < b. priority;
        });

        function tryConnect(index) {

            if (index >= data.length) {
              callback(new Error('Cannot connect to any SMTP server.'));
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
};

/*
	SMTP sender
	@socket {net.Socket}
	@addressFrom {String}
	@addressTo {String or String array}
	@addressCc {String or String array}
	@subject {String}
	@body {String}
	@senderName {String} :: optional
	@addressReply {String} :: optional
	@userName {String} :: optional
	@userPassword {String} :: optional
	@contentType {String} :: default text/html
*/
function SMTPSender(socket, addressFrom, addressTo, addressCc, subject, body, senderName, addressReply, userName, userPassword, contentType) {

	userName = userName || '';
	userPassword = userPassword || '';
	addressReply = addressReply || '';
	senderName = senderName || '';

	this.status = 0;
	this.header = '';
	this.data = '';
	this.command = '';
	this.socket = socket;
	this.socket.setTimeout(10000); // 10 sekúnd
	this.options = { port: 25, contentType: contentType || 'text/html' };

	this.socket.on('data', function(data) {

		self.data += data.toString();

		var index = self.data.indexOf('\r\n');
		if (index > 0) {
			self.socket.emit('line', self.data.substring(0, index));
			self.data = '';
		}

	});

	var host = getHostName(addressFrom);
	var message = [];
	var buffer = [];
	var to = [];
	var cc = [];

	message.push('From: ' + (senderName.length > 0 ? '"' + senderName + '"' : '') + ' <' + addressFrom + '>');

	if (util.isArray(addressTo)) {

		addressTo.forEach(function(o) {
			to.push(o);
		});

    	message.push('To: ' + addressTo.join(', '));

	} else {
	   	message.push('To: ' + addressTo);
	   	to.push(addressTo);
	}

	if (addressCc !== null) {

		if (util.isArray(addressCc)) {
			addressCc.forEach(function(o) {
				to.push(o);
				cc.push(o);;
			});
		} else if (addressCc.length > 0) {
			addressCc.push(addressCc);
			cc.push(addressCc);
		}
	}

	if (userName.length > 0 && userPassword.length > 0)
		buffer.push('AUTH PLAIN ' + new Buffer(userName + '\0' + userName + '\0' + userPassword, 'utf8').toString('base64'));

	buffer.push('MAIL FROM: <' + addressFrom + '>');

	to.forEach(function(o) {
		buffer.push('RCPT TO: <' + o + '>');
	});

	buffer.push('DATA');
	buffer.push('QUIT');
	buffer.push('');

    if (cc.length > 0)
		message.push('Cc:' + cc.join(', '));

	message.push('Subject: ' + subject);
	message.push('MIME-Version: 1.0');
	message.push('Message-ID: <' + (new Date().getTime() + host) + '>');
	message.push('Date: ' + new Date().toUTCString());

	if (addressReply.length > 0)
		message.push('Reply-To: ' + addressReply);

	message.push('Content-Type: ' + this.options.contentType + '; charset="utf8"');
	message.push('Content-Transfer-Encoding: base64');

	message.push(CRLF);
	message.push(new Buffer(body.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')).toString('base64'));

	this.socket.on('line', function(line) {

		if (mailer.debug)
			console.log('–––>', line);

		var code = parseInt(line.match(/\d+/)[0]);

		switch (code) {

			case 220:
				self.command = /\besmtp\b/i.test(line) ? 'EHLO' : 'HELO';
				write(self.command + ' ' + host);
				break;

            case 221: // BYE
            case 235: // VERIFY
            case 250: // OPERATION
            case 251: // FORWARD

				write(buffer.shift());

	            if (buffer.length === 0)
    	        	mailer.emit('success', addressFrom, addressTo);

				break;

			case 334: // LOGIN
				if (userName.length > 0 && userPassword.length > 0) {
					write(new Buffer(userName + '\0' + userName + '\0' + userPassword).toString('base64'));
					break;
				}
				self.socket.end();
				break;

			case 354:
				write(message.join(CRLF));
				write('');
				write('.');
				message = null;
				break;

			default:
				if (code > 399) {
					self.socket.end();
					mailer.emit('error', line, addressFrom, addressTo);
				}
				break;
		};
	});

	this.socket.setEncoding('utf8');

	function write(line) {
		self.socket.write(line + '\r\n');
	};

	this.socket.on('timeout', function () {
		mailer.emit('error', new Error('timeout'), addressFrom, addressTo);
		self.socket.destroy();
		self.socket = null;
	});

	var self = this;
};

/*
	@address {String}
*/
function getHostName(address) {
    return address.substring(address.indexOf('@') + 1);
};

// ======================================================
// PROTOTYPES
// ======================================================

Mailer.prototype = new events.EventEmitter;

/*
	Send mail through SMTP server
	@smtp {String}
	@addressFrom {String}
	@addressTo {String or String array}
	@addressCc {String or String array}
	@subject {String}
	@body {String}
	@senderName {String} :: optional
	@addressReply {String} :: optional
	@userName {String} :: optional
	@userPassword {String} :: optional
*/
Mailer.prototype.send = function(smtp, addressFrom, addressTo, addressCc, subject, body, senderName, addressReply, userName, userPassword) {

	var self = this;

	if (smtp === null || smtp === '') {
		smtp = getHostName(addressTo);

		resolveMx(smtp, function(err, socket) {

			if (err) {
				self.emit('error', err);
				return;
			}

			socket.on('error', function(err) {
				self.emit('error', error, addressFrom, addressTo);
			});

			new SMTPSender(socket, addressFrom, addressTo, addressCc, subject, body, senderName, addressReply, userName, userPassword);
		});
		return;
	}

	var socket = net.createConnection(25, smtp);

	socket.on('error', function(err) {
		self.emit('error', err, addressFrom, addressTo);
	});

    socket.on('connect', function() {
        new SMTPSender(socket, addressFrom, addressTo, addressCc, subject, body, senderName, addressReply, userName, userPassword);
    });
};

// ======================================================
// EXPORTS
// ======================================================

var mailer = new Mailer();
module.exports = mailer;