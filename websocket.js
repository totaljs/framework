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

"use strict";

var crypto = require('crypto');
var events = require('events');
var qs = require('querystring');
var parser = require('url');
var utils = require('./utils');

require('./prototypes');

var NEWLINE              = '\r\n';
var SOCKET_RESPONSE      = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nX-Powered-By: {0}\r\nSec-WebSocket-Accept: {1}\r\n\r\n';
var SOCKET_HASH          = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
var SOCKET_STATUS        = { 200: 'OK', 400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required', 403: 'Forbidden', 404: 'Not Found', 406: 'Not Acceptable', 407: 'Proxy Authorization Required', 408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 411: 'Length Required', 412: 'Precondition Failed', 413: 'Request Entity Too Long', 414: 'Request-URI Too Long', 415: 'Unsupported Media Type', 416: 'Requested Range Not Satisfiable', 417: 'Expectation Failed', 426: 'Upgrade Required', 444: 'Disconnect', 500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout', 505: 'HTTP Version Not Supported' };
var SOCKET_ALLOW_VERSION = [13];

function WebSocket(framework, path) {
    this._keys = [];
    this.path = path;
    this.online = 0;
    this.connections = {};
    this.framework = framework;
};

// on('open', function(client) {});
// on('close', function(client) {});
// on('message', function(client, message) {});
// on('error', function(error, client) {});

WebSocket.prototype = new events.EventEmitter;
WebSocket.prototype.send = function(message, names, blacklist) {

    var self = this;
    var keys = self._keys;

    blacklist = blacklist || [];

    if (typeof(names) === 'undefined' || names === null || names.length === 0) {
        var length = blacklist.length;
        keys.forEach(function(_id) {

            var conn = self.connections[_id];

            if (length > 0 && blacklist.indexOf(conn.id) !== -1)
                return;

            conn.send(message);
        });

        self.emit('send', message);
        return self;
    }

    keys.forEach(function(_id) {
        if (names.indexOf(_id) === -1)
            return;

        var conn = self.connections[_id];
        conn.send(message);
    });

    self.emit('send', message, names, blacklist);
    return self;
};

/*
    Close connection
    @names {String Array} :: optional, default null
    return {WebSocket}
*/
WebSocket.prototype.close = function(names) {

    var self = this;
    var keys = self._keys;

    if (typeof(names) === 'undefined' || names === null || names.length === 0) {
        keys.forEach(function(_id) {
            self.connections[_id].close();
            self._remove(_id);
        });
        self._refresh();
        return self;
    }

    keys.forEach(function(_id) {
        var conn = self.connections[_id];
        if (names.indexOf(conn.name) === -1)
            return;

        conn.close();
        self._remove(_id);
    });

    self._refresh();
    return self;
};

/*
    Destroy websocket
*/
WebSocket.prototype.destroy = function() {
    var self = this;
    self.close();
    self.connections = null;
    self._keys = null;
    delete self.framework.connections[self.path];
    self.emit('destroy');
    self.dispose();
};

/*
    Internal function
    return {WebSocket}
*/
WebSocket.prototype._refresh = function() {
    var self = this;
    self._keys = Object.keys(self.connections);
    self.online = self._keys.length;
    return self;
};

/*
    Internal function
    @id {String}
    return {WebSocket}
*/
WebSocket.prototype._remove = function(id) {
    var self = this;
    delete self.connections[id];
    return self;
};

/*
    Internal function
    @client {WebSocketClient}
    return {WebSocket}
*/
WebSocket.prototype._add = function(client) {
    var self = this;
    self.connections[client._id] = client;
    return self;
};

/*
    WebSocketClient
    @req {Request}
    @socket {Socket}
    @head {Buffer}
*/
function WebSocketClient(req, socket, head) {

    this.handlers = {
        ondata: this._ondata.bind(this),
        onerror: this._onerror.bind(this),
        onclose: this._onclose.bind(this)
    };

    this.limit = 0;
    this.container = null;
    this._id = null;
    this.id = '';
    this.socket = socket;
    this.req = req;
    this.isClosed = false;
    this.get = {};
    this.session = {};
    this.ip = '';
    this.protocol = (req.headers['sec-websocket-protocol'] || '').replace(/\s/g, '').split(',');
    req.uri = parser.parse('ws://' + req.headers['host'] + req.url);
    this.uri = req.uri;
    this.isJSON = false;
    this.length = 0;
    this.cookie = req.cookie.bind(req);
};

WebSocketClient.prototype = new events.EventEmitter;

/*
    Internal function
    @allow {String Array} :: allow origin
    @protocols {String Array} :: allow protocols
    @flags {String Array} :: flags
    return {Boolean}
*/
WebSocketClient.prototype.prepare = function(flags, protocols, allow, length, version) {

    var self = this;
    var req = self.req;
    var socket = self.socket;

    flags = flags || [];
    protocols = protocols || [];
    allow = allow || [];

    self.length = length;

    var origin = req.headers['origin'] || '';

    if (allow.length > 0) {

        if (allow.indexOf('*') === -1) {
            if (allow.indexOf(origin) === -1)
                return false;
        }

    } else {

        if (origin.indexOf(req.headers.host) === -1)
            return false;
    }

    if (protocols.length > 0) {
        for (var i = 0; i < protocols.length; i++) {
            if (self.protocol.indexOf(protocols[i]) === -1)
                return false;
        }
    }

    if (SOCKET_ALLOW_VERSION.indexOf(utils.parseInt(self.req.headers['sec-websocket-version'])) === -1)
        return false;

    self.socket = socket;
    self.socket.write(new Buffer(SOCKET_RESPONSE.format('partial.js v' + version, self._request_accept_key(req)), 'binary'));

    var proxy = req.headers['x-forwarded-for'];

    if (typeof(proxy) !== 'undefined')
        self.ip = proxy.split(',', 1)[0] || req.connection.remoteAddress;
    else
        self.ip = req.connection.remoteAddress;

    if (self.uri.query && self.uri.query.length > 0)
        self.get = qs.parse(self.uri.query);

    self._id = self.ip.replace(/\./g, '') + utils.GUID(20);
    self.id = self._id;
    self.isJSON = flags.indexOf('json') !== -1;

    return true;
};

/*
    Internal function
    @container {WebSocket}
    return {WebSocketClient}
*/
WebSocketClient.prototype.upgrade = function(container) {

    var self = this;
    self.container = container;

    self.socket.setTimeout(0);
    self.socket.setNoDelay(true);
    self.socket.setKeepAlive(true, 0);

    self.socket.on('data', self.handlers.ondata);
    self.socket.on('error', self.handlers.onerror);
    self.socket.on('close', self.handlers.onclose);

    self.container._add(self);
    self.container._refresh();
    self.container.framework.emit('websocket-connection', self.container, self);
    self.container.emit('open', self);

    return self;
};

/*
    Internal handler
    @data {Buffer}
*/
WebSocketClient.prototype._ondata = function(data) {

    var self = this;

    if (data.length > self.length) {
        self.container.emit('error', new Error('Maximum request length exceeded'), self);
        return;
    }

    var message = decode_WS(data);
    if (message === null)
        return;

    if (message === '') {
        // websocket.close() send empty string
        self.close(444);
        return;
    }

    if (self.isJSON) {
        if (message.isJSON())
            message = JSON.parse(message);
        else
            message = null;
    }

    self.container.emit('message', self, message);
};

/*
    Internal handler
*/
WebSocketClient.prototype._onerror = function(error) {
    var self = this;
    self.container.emit('error', e, self);
};

/*
    Internal handler
*/
WebSocketClient.prototype._onclose = function() {
    var self = this;
    self.container._remove(self._id);
    self.container._refresh();
    self.container.emit('close', self);
    self.dispose();
};

/*
    Send message
    @message {String or Object}
    return {WebSocketClient}
*/
WebSocketClient.prototype.send = function(message) {
    var self = this;

    if (self.isClosed)
        return;

    self.socket.write(new Buffer(encode_WS(self.isJSON ? JSON.stringify(message) : (message || '').toString()), 'binary'));
    return self;
};

/*
    Close connection
    @status {Number} :: HTTP Status, optional, default undefined
    return {WebSocketClient}
*/
WebSocketClient.prototype.close = function(status) {
    var self = this;

    if (self.isClosed)
        return self;

    self.isClosed = true;
    status = status || 444;
    self.socket.end(new Buffer('HTTP/1.1 ' + status + ' ' + SOCKET_STATUS[status] + NEWLINE + 'Connection: close' + NEWLINE + NEWLINE, 'binary'));
    return self;
};

WebSocketClient.prototype._request_accept_key = function(req) {
    var sha1 = crypto.createHash('sha1');
    sha1.update((req.headers['sec-websocket-key'] || '') + SOCKET_HASH);
    return sha1.digest('base64');
};

// Author: Haribabu Pasupathy
// http://stackoverflow.com/users/1679439/haribabu-pasupathy
function encode_WS(data){

    var bytesFormatted = [];
    bytesFormatted[0] = 129;

    if (data.length <= 125) {
        bytesFormatted[1] = data.length;
    } else if (data.length >= 126 && data.length <= 65535) {
        bytesFormatted[1] = 126;
        bytesFormatted[2] = (data.length >> 8) & 255;
        bytesFormatted[3] = (data.length) & 255;
    } else {
        bytesFormatted[1] = 127;
        bytesFormatted[2] = (data.length >> 56) & 255;
        bytesFormatted[3] = (data.length >> 48) & 255;
        bytesFormatted[4] = (data.length >> 40) & 255;
        bytesFormatted[5] = (data.length >> 32) & 255;
        bytesFormatted[6] = (data.length >> 24) & 255;
        bytesFormatted[7] = (data.length >> 16) & 255;
        bytesFormatted[8] = (data.length >> 8) & 255;
        bytesFormatted[9] = (data.length) & 255;
    }

    for (var i = 0; i < data.length; i++)
        bytesFormatted.push(data.charCodeAt(i));

    return bytesFormatted;
}

// Author: Haribabu Pasupathy
// http://stackoverflow.com/users/1679439/haribabu-pasupathy
function decode_WS(data) {

    var datalength = data[1] & 127;
    var indexFirstMask = 2;

    if (datalength === 126)
        indexFirstMask = 4;
    else if (datalength === 127)
        indexFirstMask = 10;

    var masks = data.slice(indexFirstMask, indexFirstMask + 4);
    var i = indexFirstMask + 4;
    var index = 0;
    var output = '';

    while (i < data.length)
        output += String.fromCharCode(data[i++] ^ masks[index++ % 4]);

    return output;
}

exports.WebSocket = WebSocket;
exports.WebSocketClient = WebSocketClient;
