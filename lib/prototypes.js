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

var http = require('http');
var utils = require('./utils');

var request = http.IncomingMessage.prototype;
request.data = { get: {}, post: {}, files: {} };
request.buffer = {};
request.isAjax = false;
request.uri = {};
request.ip = '';
request.flags = [];
request.session = {};
request.prefix = '';
request.subdomain = [];

http.ServerResponse.prototype.isFlush = false;

http.ServerResponse.prototype.cookie = function (name, value, expire, path, domain) {

	var isExpire = expire || false;
	domain = domain || '';

    var cookie = (!isExpire ? '{0}={1}; path={3}' : '{0}={1}; expires={2}; path={3}') + (domain.length > 0 ? '; domain={4}' : ''); 
	this.setHeader('Set-Cookie', cookie.format(name, value, isExpire ? expire.toUTCString() : '', path || '/', domain));
};

http.IncomingMessage.prototype.cookie = function (name) {
	var self = this;
	if (typeof(self.cookies) === 'undefined') {
		self.cookies = {};
	    var cookie = self.headers['cookie'];
        if (cookie != null) {
			cookie.split(';').forEach(function(o) {
	        	var c = o.trim().split('=');
				self.cookies[c[0]] = c[1];
			});
		}
 	}

	var value = self.cookies[name];
	
	if (typeof(value) === 'undefined')
		return null;

	return value;
};