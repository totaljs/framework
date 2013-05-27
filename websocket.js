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

var crypto = require('crypto');
var events = require('events');
var qs = require('querystring');
var parser = require('url');
var utils = require('./utils');

require('./prototypes');

var NEWLINE                = '\r\n';
var SOCKET_RESPONSE        = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nX-Powered-By: {0}\r\nSec-WebSocket-Accept: {1}\r\n\r\n';
var SOCKET_RESPONSE_ERROR  = 'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nX-WebSocket-Reject-Reason: 403 Forbidden\r\n\r\n';
var SOCKET_HASH            = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
var SOCKET_ALLOW_VERSION   = [13];

/*
    WebSocket
    @framework {partial.js}
    @path {String}
    @name {String} :: Controller name
    return {WebSocket}
*/
function WebSocket(framework, path, name) {
    this._keys = [];
    this.path = path;
    this.online = 0;
    this.connections = {};
    this.framework = framework;
    this.global = framework.global;
    this.config = framework.config;
    this.repository = {};
    this.name = name;
    this.isDebug = framework.config.debug;
    this.url = utils.path(path);
    this.async = new utils.Async(this);
};

// on('open', function(client) {});
// on('close', function(client) {});
// on('message', function(client, message) {});
// on('error', function(error, client) {});

WebSocket.prototype = new events.EventEmitter;

/*
    Send message
    @message {String or Object}
    @names {String Array}
    @blacklist {String Array}
    return {WebSocket}
*/
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
    All connections (forEach)
    @fn {Function} :: function(client, index) {}
    return {WebSocketClient};
*/
WebSocket.prototype.all = function(fn) {

    var self = this;
    var length = self._keys.length;

    for (var i = 0; i < length; i++) {
        var id = self._keys[i];
        if (fn(self.connections[id], i))
            break;
    }

    return self;
};

/*
    Find connection
    @name {String}
    return {WebSocketClient}
*/
WebSocket.prototype.find = function(name) {
    var self = this;
    var length = self._keys.length;

    for (var i = 0; i < length; i++) {
        var connection = self.connections[self._keys[i]];
        if (connection.id === name)
            return connection;
    }

    return null;
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
    Module caller
    @name {String}
    return {Module};
*/
WebSocket.prototype.module = function(name) {
    return this.framework.module(name);
};

/*
    Controller models reader
    @name {String} :: name of controller
    return {Object};
*/
WebSocket.prototype.models = function(name) {
    return (this.framework.controllers[name] || {}).models;
};

/*
    Controller functions reader
    @name {String} :: name of controller
    return {Object};
*/
WebSocket.prototype.functions = function(name) {
    return (this.framework.controllers[name] || {}).functions;
};

/*
    Return database
    @name {String}
    return {Database};
*/
WebSocket.prototype.database = function(name) {
    return this.framework.database(name);
};

/*
    Resource reader
    @name {String} :: filename
    @key {String}
    return {String};
*/
WebSocket.prototype.resource = function(name, key) {
    return this.framework.resource(name, key);
};

/*
    Log
    @arguments {Object array}
    return {WebSocket};
*/
WebSocket.prototype.log = function() {
    var self = this;
    self.framework.log.apply(self.framework, arguments);
    return self;
};

/*
    Get path
    @name {String} :: filename
    return {String};
*/
WebSocket.prototype.pathPublic = function(name) {
    return utils.combine(this.framework.config['directory-public'], name).replace(/\\/g, '/');
};

/*
    Get path
    @name {String} :: filename
    return {String};
*/
WebSocket.prototype.pathLog = function(name) {
    return utils.combine(this.framework.config['directory-logs'], name).replace(/\\/g, '/');
};

/*
    Get path
    @name {String} :: filename
    return {String};
*/
WebSocket.prototype.pathTemp = function(name) {
    return utils.combine(this.framework.config['directory-temp'], name).replace(/\\/g, '/');
};

/*
    Validation / alias for validate
    return {ErrorBuilder}
*/
WebSocket.prototype.validation = function(model, properties, prefix, name) {
    return this.validate(model, properties, prefix, name);
};

/*
    Validation object
    @model {Object} :: object to validate
    @properties {String array} : what properties?
    @prefix {String} :: prefix for resource = prefix + model name
    @name {String} :: name of resource
    return {ErrorBuilder}
*/
WebSocket.prototype.validate = function(model, properties, prefix, name) {

    var self = this;

    var resource = function(key) {
        return self.resource(name || 'default', (prefix || '') + key);
    };

    var error = new builders.ErrorBuilder(resource);
    return utils.validate.call(self, model, properties, self.framework.onValidation, error);
};

/*
    Add function to async wait list
    @name {String}
    @waitingFor {String} :: name of async function
    @fn {Function}
    return {WebSocket}
*/
WebSocket.prototype.wait = function(name, waitingFor, fn) {
    var self = this;
    self.async.wait(name, waitingFor, fn);
    return self;
};

/*
    Run async functions
    @callback {Function}
    return {WebSocket}
*/
WebSocket.prototype.complete = function(callback) {
    var self = this;
    return self.complete(callback);
};

/*
    Add function to async list
    @name {String}
    @fn {Function}
    return {WebSocket}
*/
WebSocket.prototype.await = function(name, fn) {
    var self = this;
    self.async.await(name, fn);
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
    var socket = self.socket;

    flags = flags || [];
    protocols = protocols || [];
    allow = allow || [];

    self.length = length;

    var origin = self.req.headers['origin'] || '';

    if (allow.length > 0) {

        if (allow.indexOf('*') === -1) {
            for (var i = 0; i < allow.length; i++) {
                if (origin.indexOf(allow[i]) === -1)
                    return false;
            }
        }

    } else {

        if (origin.indexOf(self.req.headers.host) === -1)
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
    self.socket.write(new Buffer(SOCKET_RESPONSE.format('partial.js v' + version, self._request_accept_key(self.req)), 'binary'));

    var proxy = self.req.headers['x-forwarded-for'];

    if (typeof(proxy) !== 'undefined')
        self.ip = proxy.split(',', 1)[0] || self.req.connection.remoteAddress;
    else
        self.ip = self.req.connection.remoteAddress;

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

    //self.socket.setTimeout(0);
    //self.socket.setNoDelay(true);
    //self.socket.setKeepAlive(true, 0);

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
    if (message === '' || message === null) {
        // websocket.close() send empty string
        self.close();
        return;
    }

    if (self.isJSON) {
        if (message.isJSON()) {
            try
            {
                message = JSON.parse(message);
            } catch (ex) {
                message = null;
                self.container.emit('error', new Error('JSON parser: ' + ex.toString()), self);
                return;
            }
        }
        else {
            message = null;
            self.close();
            return;
        }
    }

    self.container.emit('message', self, message);
};

/*
    Internal handler
*/
WebSocketClient.prototype._onerror = function(error) {
    var self = this;
    self.container.emit('error', error, self);
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
WebSocketClient.prototype.close = function() {
    var self = this;

    if (self.isClosed)
        return self;

    self.isClosed = true;
    self.socket.end(new Buffer(SOCKET_RESPONSE_ERROR, 'binary'));

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
