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

var http = require('http');
var fs = require('fs');

Object.prototype.dispose = function() {
	for (var m in this)
		this[m] = null;
};

/*
	Write cookie
	@name {String}
	@value {String}
	@expire {Date}
	@path {String}
	@domain {String}
	@httpOnly {Boolean},
	@secure {Boolean}
	return {ServerResponse}
*/
http.ServerResponse.prototype.cookie = function(name, value, expire, path, domain, httpOnly, secure) {

	httpOnly = httpOnly || false;
	secure = secure || false;
	domain = domain || '';

	var isExpire = expire || false;
    var cookie = (!isExpire ? '{0}={1}; path={3}' : '{0}={1}; expires={2}; path={3}') + (domain.length > 0 ? '; domain={4}' : '') + (secure ? '; secure' : '') + (httpOnly ? '; httpOnly' : '');
    var self = this;

	self.setHeader('Set-Cookie', cookie.format(name, value, isExpire ? expire.toUTCString() : '', path || '/', domain));
	return self;
};

/*
	Read cookie
	@name {String}
	return {String}
*/
http.IncomingMessage.prototype.cookie = function(name) {

	var self = this;

	if (typeof(self.cookies) === 'undefined') {
		self.cookies = {};
	    var cookie = self.headers['cookie'] || '';
        if (cookie.length > 0) {
			cookie.split(';').forEach(function(o) {
	        	var c = o.trim().split('=');
				self.cookies[c[0]] = c[1];
			});
		}
 	}

	return self.cookies[name] || null;
};

/*
	Clear all uploaded files
	return {ServerRequest}
*/
http.IncomingMessage.prototype.clear = function() {
	var self = this;

	if (self.data.files.length === 0)
		return self;

	self.data.files.forEach(function(o) {
		fs.exists(o.fileNameTmp, function(exists) {
			if (exists)
				fs.unlink(o.fileNameTmp);
		});
	});

	self.data.files = null;
	return self;
};

/*
	Return hostname with protocol and port
	@path {String} :: optional
	return {String}
*/
http.IncomingMessage.prototype.hostname = function(path) {

	var self = this;
	var uri = self.uri;

	path = path || '';

	if (path[0] !== '/')
		path = '/' + path;

	return uri.protocol + '//' + uri.hostname + (typeof(uri.port) !== 'undefined' && uri.port !== 80 ? ':' + uri.port : '') + path;
};