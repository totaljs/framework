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
 * @module FrameworkUtils
 * @version 1.9.4
 */

'use strict';

var Dns = require('dns');
var parser = require('url');
var qs = require('querystring');
var http = require('http');
var https = require('https');
var path = require('path');
var fs = require('fs');
var events = require('events');
var crypto = require('crypto');
var expressionCache = {};

var regexpMail = new RegExp('^[a-zA-Z0-9-_.+]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$');
var regexpUrl = new RegExp('^(http[s]?:\\/\\/(www\\.)?|ftp:\\/\\/(www\\.)?|www\\.){1}([0-9A-Za-z-\\.@:%_\+~#=]+)+((\\.[a-zA-Z]{2,3})+)(/(.)*)?(\\?(.)*)?');
var regexpTRIM = /^[\s]+|[\s]+$/g;
var regexpDATE = /(\d{1,2}\.\d{1,2}\.\d{4})|(\d{4}\-\d{1,2}\-\d{1,2})|(\d{1,2}\:\d{1,2}(\:\d{1,2})?)/g;
var regexpSTATIC = /\.\w{2,8}($|\?)+/;
var regexpDATEFORMAT = /yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|a/g;
var regexpSTRINGFORMAT = /\{\d+\}/g;
var regexpPATH = /\\/g;
var DIACRITICS = {225:'a',228:'a',269:'c',271:'d',233:'e',283:'e',357:'t',382:'z',250:'u',367:'u',252:'u',369:'u',237:'i',239:'i',244:'o',243:'o',246:'o',353:'s',318:'l',314:'l',253:'y',255:'y',263:'c',345:'r',341:'r',328:'n',337:'o'};
var ENCODING = 'utf8';
var UNDEFINED = 'undefined';
var STRING = 'string';
var FUNCTION = 'function';
var NUMBER = 'number';
var OBJECT = 'object';
var BOOLEAN = 'boolean';
var NEWLINE = '\r\n';
var VERSION = (typeof(framework) !== UNDEFINED ? ' v' + framework.version_header : '');
var isWindows = require('os').platform().substring(0, 3).toLowerCase() === 'win';
var dnscache = {};

var contentTypes = {
	'aac': 'audio/aac',
	'ai': 'application/postscript',
	'appcache': 'text/cache-manifest',
	'avi': 'video/avi',
	'bin': 'application/octet-stream',
	'bmp': 'image/bmp',
	'coffee': 'text/coffeescript',
	'css': 'text/css',
	'csv': 'text/csv',
	'doc': 'application/msword',
	'docx': 'application/msword',
	'dtd': 'application/xml-dtd',
	'eps': 'application/postscript',
	'exe': 'application/octet-stream',
	'geojson': 'application/json',
	'gif': 'image/gif',
	'gzip': 'application/x-gzip',
	'htm': 'text/html',
	'html': 'text/html',
	'ico': 'image/x-icon',
	'ics': 'text/calendar',
	'ifb': 'text/calendar',
	'jpe': 'image/jpeg',
	'jpeg': 'image/jpeg',
	'jpg': 'image/jpeg',
	'js': 'text/javascript',
	'json': 'application/json',
	'less': 'text/css',
	'm4a': 'audio/mp4a-latm',
	'm4v': 'video/x-m4v',
	'manifest': 'text/cache-manifest',
	'md': 'text/x-markdown',
	'mid': 'audio/midi',
	'midi': 'audio/midi',
	'mov': 'video/quicktime',
	'mp3': 'audio/mpeg',
	'mp4': 'video/mp4',
	'mpe': 'video/mpeg',
	'mpeg': 'video/mpeg',
	'mpg': 'video/mpeg',
	'mpga': 'audio/mpeg',
	'mtl': 'text/plain',
	'mv4': 'video/mv4',
	'obj': 'text/plain',
	'ogg': 'application/ogg',
	'package': 'text/plain',
	'pdf': 'application/pdf',
	'png': 'image/png',
	'ppt': 'application/vnd.ms-powerpoint',
	'pptx': 'application/vnd.ms-powerpoint',
	'ps': 'application/postscript',
	'rar': 'application/x-rar-compressed',
	'rtf': 'text/rtf',
	'sass': 'text/css',
	'scss': 'text/css',
	'sh': 'application/x-sh',
	'stl': 'application/sla',
	'svg': 'image/svg+xml',
	'swf': 'application/x-shockwave-flash',
	'tar': 'application/x-tar',
	'tif': 'image/tiff',
	'tiff': 'image/tiff',
	'txt': 'text/plain',
	'wav': 'audio/x-wav',
	'webp': 'image/webp',
	'woff': 'application/font-woff',
	'woff2': 'application/font-woff2',
	'xht': 'application/xhtml+xml',
	'xhtml': 'application/xhtml+xml',
	'xls': 'application/vnd.ms-excel',
	'xlsx': 'application/vnd.ms-excel',
	'xml': 'application/xml',
	'xpm': 'image/x-xpixmap',
	'xsl': 'application/xml',
	'xslt': 'application/xslt+xml',
	'zip': 'application/zip'
};

if (typeof(setImmediate) === UNDEFINED) {
	global.setImmediate = function(cb) {
		process.nextTick(cb);
	};
}

var hasOwnProperty = Object.prototype.hasOwnProperty;

/*
	Expression declaration
	@query {String}
	@params {String Array}
	@values {Object Array}
	return {Function}
*/
function expression(query, params) {

	var name = params.join(',');
	var fn = expressionCache[query + '-' + name];

	if (!fn) {
		fn = eval('(function(' + name +'){' + (query.indexOf('return') === -1 ? 'return ' : '') + query + '})');
		expressionCache[query + name] = fn;
	}

	var values = [];

	for (var i = 2; i < arguments.length; i++)
		values.push(arguments[i]);

	return (function() {
		var arr = [];

		for (var i = 0; i < arguments.length; i++)
			arr.push(arguments[i]);

		for (var i = 0; i < values.length; i++)
			arr.push(values[i]);

		return fn.apply(this, arr);
	});
}

global.expression = expression;

/**
 * Checks if is object empty
 * @param  {Object}  obj
 * @return {Boolean}
 */
exports.isEmpty = function(obj) {

	if (obj === null)
		return true;

	if (obj.length)
		return false;

	if (obj.length === 0)
		return true;

	for (var key in obj) {
		if (hasOwnProperty.call(obj, key))
		return false;
	}
	return true;
};

/**
 * Compare objects
 * @param {Object} obj1
 * @param {Object} obj2
 * @return {Boolean}
 */
exports.isEqual = function(obj1, obj2, properties) {

	var keys = properties ? properties : Object.keys(obj1);

	for (var i = 0, length = keys.length; i < length; i++) {
		var key = keys[i];
		if (obj1[key] === obj2[key])
			continue;
		return false;
	}

	return true;
};

/**
 * Function checks a valid function and waits for it positive result
 * @param {Function} fnValid
 * @param {Function(err, success)} fnCallback
 * @param {Number} timeout  Timeout, optional (default: 5000)
 * @param {Number} interval Refresh interval, optional (default: 500)
 */
exports.wait = function(fnValid, fnCallback, timeout, interval) {

	if (fnValid() === true)
		return fnCallback(null, true);

	var id_timeout = null;
	var id_interval = setInterval(function() {

		if (fnValid() === true) {
			clearInterval(id_interval);
			clearTimeout(id_timeout);
			if (fnCallback)
				fnCallback(null, true);
			return;
		}

	}, interval || 500);

	id_timeout = setTimeout(function() {
		clearInterval(id_interval);
		if (fnCallback)
			fnCallback(new Error('Timeout.'), false);
	}, timeout || 5000);
};

exports.$$wait = function(fnValid, timeout, interval) {
	return function(callback) {
		exports.wait(fnValid, callback, timeout, interval);
	};
};

/**
 * Resolves an IP from the URL address
 * @param {String} url
 * @param {Function(err, uri)} callback
 */
exports.resolve = function(url, callback) {

    var uri = parser.parse(url);

    if (dnscache[uri.host]) {
        uri.host = dnscache[uri.host];
        callback(null, uri);
        return;
    }

    Dns.resolve4(uri.hostname, function(e, addresses) {

        if (!e) {
            dnscache[uri.host] = addresses[0];
            uri.host = addresses[0];
	        callback(null, uri);
            return;
        }

        setImmediate(function() {
	        Dns.resolve4(uri.hostname, function(e, addresses) {
	            if (e)
	                return callback(e, uri);
	            dnscache[uri.host] = addresses[0];
	            uri.host = addresses[0];
		        callback(null, uri);
	        });
    	});
    });
};

exports.$$resolve = function(url) {
	return function(callback) {
		return exports.resolve(url, callback);
	};
};

/**
 * Clears DNS cache
 */
exports.clearDNS = function() {
	dnscache = {};
};

/**
 * Create a request to a specific URL
 * @param  {String} url URL address.
 * @param  {String Array} flags Request flags.
 * @param  {String or Object} data Request data (optional).
 * @param  {Function(error, content, statusCode, headers)} callback Callback.
 * @param  {Object} headers Custom cookies (optional, default: null).
 * @param  {Object} headers Custom headers (optional, default: null).
 * @param  {String} encoding Encoding (optional, default: UTF8)
 * @param  {Number} timeout Request timeout.
 * return {Boolean}
 */
exports.request = function(url, flags, data, callback, cookies, headers, encoding, timeout) {

	// No data (data is optinal argument)
	if (typeof(data) === FUNCTION) {
		timeout = encoding;
		encoding = headers;
		headers = cookies;
		cookies = callback;
		callback = data;
		data = '';
	}

	if (typeof(cookies) === NUMBER) {
		cookies = null;
		timeout = cookies;
	}

	if (typeof(headers) === NUMBER) {
		headers = null;
		timeout = headers;
	}

	if (typeof(encoding) === NUMBER) {
		encoding = null;
		timeout = encoding;
	}

	var method = '';
	var length = 0;
	var type = 0;
	var e = new events.EventEmitter();
	var isDNSCACHE = false;

	if (headers)
		headers = exports.extend({}, headers);
	else
		headers = {};

	if (typeof(encoding) !== STRING)
		encoding = ENCODING;

	if (data === null)
		data = '';

	if (flags instanceof Array) {
		length = flags.length;
		for (var i = 0; i < length; i++) {

			switch (flags[i].toLowerCase()) {

				case 'xhr':
					headers['X-Requested-With'] = 'XMLHttpRequest';
					break;

				case 'json':
					headers['Content-Type'] = 'application/json';

					if (method === '')
						method = 'POST';

					type = 1;
					break;

				case 'xml':
					headers['Content-Type'] = 'text/xml';

					if (method === '')
						method = 'POST';

					type = 2;
					break;

				case 'get':
				case 'options':
				case 'head':
					method = flags[i].toUpperCase();
					break;

				case 'upload':
					headers['Content-Type'] = 'multipart/form-data';
					break;

				case 'post':
				case 'put':
				case 'delete':

					method = flags[i].toUpperCase();
					if (!headers['Content-Type'])
						headers['Content-Type'] = 'application/x-www-form-urlencoded';

					break;
				case 'dnscache':
					isDNSCACHE = true;
					break;
			}
		}
	}

	if (!method)
		method = 'GET';

	var isPOST = method === 'POST' || method === 'PUT' || method === 'DELETE';

	if (typeof(data) !== STRING)
		data = type === 1 ? JSON.stringify(data) : qs.stringify(data);
	else if (data[0] === '?')
		data = data.substring(1);

	if (!isPOST) {
		if (data.length && url.indexOf('?') === -1)
			url += '?' + data;
		data = '';
	}

	var uri = parser.parse(url);
	var responseLength = 0;

	uri.method = method;
	headers['X-Powered-By'] = 'total.js' + VERSION;

	if (cookies) {
		var builder = '';

		for (var m in cookies)
			builder += (builder ? '; ' : '') + m + '=' + encodeURIComponent(cookies[m]);

		if (builder)
			headers['Cookie'] = builder;
	}

	var buf;

	if (data.length) {
		buf = new Buffer(data, ENCODING);
		headers['Content-Length'] = buf.length;
	}

	uri.agent = false;
	uri.headers = headers;

	var onResponse = function(res) {

		res._buffer = '';
		res._bufferlength = 0;

		// We have redirect
		if (res.statusCode === 301) {
			exports.request(res.headers['location'], flags, data, callback, cookies, headers, encoding, timeout);
			res = null;
			return;
		}

		res.on('data', function(chunk) {
			var self = this;
			self._buffer += chunk.toString(encoding);
			self._bufferlength += chunk.length;
			e.emit('data', chunk, responseLength ? (self._bufferlength / responseLength) * 100 : 0);
		});

		res.on('end', function() {
			var self = this;
			e.emit('end', self._buffer, self.statusCode, self.headers, uri.host);
			if (callback)
				callback(null, self._buffer, self.statusCode, self.headers, uri.host);
			callback = null;
		});

		res.resume();
	};

	var connection = uri.protocol === 'https:' ? https : http;
	var run = function() {
		try
		{
			var request = isPOST ? connection.request(uri, onResponse) : connection.get(uri, onResponse);

			if (callback) {
				request.on('error', function(error) {
					if (callback)
						callback(error, '', 0, undefined, undefined, uri.host);
					callback = null;
				});

				request.setTimeout(timeout || 10000, function() {
					if (callback)
						callback(new Error(exports.httpStatus(408)), '', 0, undefined, uri.host);
					callback = null;
				});
			}

			request.on('response', function(response) {
				responseLength = +response.headers['content-length'] || 0;
				e.emit('begin', responseLength);
			});

			if (isPOST && buf)
				request.end(buf);
			else
				request.end();

		} catch (ex) {
			if (callback)
				callback(ex, '', 0);
		}
	};

	if (isDNSCACHE) {
		exports.resolve(url, function(err, u) {
			uri.host = u.host;
			run();
		});
	} else
		run();

	return e;
};

exports.$$request = function(url, flags, data, cookies, headers, encoding, timeout) {
	return function(callback) {
		exports.request(url, flags, data, callback, cookies, headers, encoding, timeout);
	};
};

exports.btoa = function(str) {
	return (str instanceof Buffer) ? str.toString('base64') : new Buffer(str.toString(), 'binary').toString('base64');
};

exports.atob = function(str) {
	return new Buffer(str, 'base64').toString('binary');
};

/**
 * Create a request to a specific URL
 * @param {String} url URL address.
 * @param {String Array} flags Request flags.
 * @param {String or Object} data Request data (optional).
 * @param {Function(error, response)} callback Callback.
 * @param {Object} headers Custom cookies (optional, default: null).
 * @param {Object} headers Custom headers (optional, default: null).
 * @param {String} encoding Encoding (optional, default: UTF8)
 * @param {Number} timeout Request timeout.
 * return {Boolean}
 */
exports.download = function(url, flags, data, callback, cookies, headers, encoding, timeout) {

	// No data (data is optinal argument)
	if (typeof(data) === FUNCTION) {
		timeout = encoding;
		encoding = headers;
		headers = cookies;
		cookies = callback;
		callback = data;
		data = '';
	}

	if (typeof(cookies) === NUMBER) {
		cookies = null;
		timeout = cookies;
	}

	if (typeof(headers) === NUMBER) {
		headers = null;
		timeout = headers;
	}

	if (typeof(encoding) === NUMBER) {
		encoding = null;
		timeout = encoding;
	}

	var method = 'GET';
	var length = 0;
	var type = 0;
	var e = new events.EventEmitter();
	var isDNSCACHE = false;

	if (headers)
		headers = exports.extend({}, headers);
	else
		headers = {};

	if (typeof(encoding) !== STRING)
		encoding = ENCODING;

	if (data === null)
		data = '';

	if (flags instanceof Array) {
		length = flags.length;
		for (var i = 0; i < length; i++) {

			switch (flags[i].toLowerCase()) {

				case 'xhr':
					headers['X-Requested-With'] = 'XMLHttpRequest';
					break;

				case 'json':
					headers['Content-Type'] = 'application/json';
					type = 1;
					break;

				case 'xml':
					headers['Content-Type'] = 'text/xml';
					type = 2;
					break;

				case 'get':
				case 'delete':
				case 'options':
					method = flags[i].toUpperCase();
					break;

				case 'upload':
					headers['Content-Type'] = 'multipart/form-data';
					break;

				case 'post':
				case 'put':
					method = flags[i].toUpperCase();
					if (!headers['Content-Type'])
						headers['Content-Type'] = 'application/x-www-form-urlencoded';
					break;

				case 'dnscache':
					isDNSCACHE = true;
					break;

			}
		}
	}

	var isPOST = method === 'POST' || method === 'PUT';

	if (typeof(data) !== STRING)
		data = type === 1 ? JSON.stringify(data) : qs.stringify(data);
	else if (data[0] === '?')
		data = data.substring(1);

	if (!isPOST) {
		if (data.length && url.indexOf('?') === -1)
			url += '?' + data;
		data = '';
	}

	var uri = parser.parse(url);
	var responseLength = 0;

	uri.method = method;

	headers['X-Powered-By'] = 'total.js' + VERSION;

	if (cookies) {
		var builder = '';

		for (var m in cookies)
			builder += (builder ? '; ' : '') + m + '=' + encodeURIComponent(cookies[m]);

		if (builder)
			headers['Cookie'] = builder;
	}

	var buf;

	if (data.length) {
		buf = new Buffer(data, ENCODING);
		headers['Content-Length'] = buf.length;
	}

	uri.agent = false;
	uri.headers = headers;

	var onResponse = function(res) {

		res._bufferlength = 0;

		res.on('data', function(chunk) {
			var self = this;
			self._bufferlength += chunk.length;
			e.emit('data', chunk, responseLength ? (self._bufferlength / responseLength) * 100 : 0);
		});

		res.on('end', function() {
			var self = this;
			e.emit('end', self.statusCode, self.headers);
		});

		callback(null, res);
		res.resume();
	};

	var connection = uri.protocol === 'https:' ? https : http;
	var run = function() {
		try
		{
			var request = isPOST ? connection.request(uri, onResponse) : connection.request(uri, onResponse);

			if (callback) {
				request.on('error', function(error) {
					callback(error, null, 0, {});
				});

				request.setTimeout(timeout || 10000, function() {
					callback(new Error(exports.httpStatus(408)), null, 0, null);
				});
			}

			request.on('response', function(response) {
				responseLength = +response.headers['content-length'] || 0;
				e.emit('begin', responseLength);
			});

			if (isPOST && buf)
				request.end(buf);
			else
				request.end();

		} catch (ex) {
			if (callback)
				callback(ex, null, 0, {});
		}
	};

	if (isDNSCACHE) {
		exports.resolve(url, function(err, u) {
			uri.host = u.host;
			run();
		});
	} else
		run();

	return e;
};

exports.$$download = function(url, flags, data, cookies, headers, encoding, timeout) {
	return function(callback) {
		exports.download(url, flags, data, callback, cookies, headers, encoding, timeout);
	};
};

/**
 * Send a stream through HTTP
 * @param {String} name Filename with extension.
 * @param {Stream} stream Stream.
 * @param {String} url A valid URL address.
 * @param {Function} callback Callback.
 * @param {Object} headers Custom headers (optional).
 * @param {String} method HTTP method (optional, default POST).
 */
exports.send = function(name, stream, url, callback, headers, method) {

	if (typeof(callback) === OBJECT) {
		var tmp = headers;
		callback = headers;
		headers = tmp;
	}

	if (typeof(stream) === STRING)
		stream = fs.createReadStream(stream, { flags: 'r' });

	var BOUNDARY = '----' + Math.random().toString(16).substring(2);
	var h = {};

	if (headers)
		exports.extend(h, headers);

	name = path.basename(name);

	h['Cache-Control'] = 'max-age=0';
	h['Content-Type'] = 'multipart/form-data; boundary=' + BOUNDARY;
	h['X-Powered-By'] = 'total.js' + VERSION;

	var uri = parser.parse(url);
	var options = { protocol: uri.protocol, auth: uri.auth, method: method || 'POST', hostname: uri.hostname, port: uri.port, path: uri.path, agent: false, headers: h };

	var response = function(res) {

		if (!callback)
			return;

		res.body = '';
		res.on('data', function(chunk) {
			this.body += chunk.toString(ENCODING);
		});

		res.on('end', function() {
			var self = this;
			if (callback)
				callback(null, self.body, self.statusCode, self.headers);
		});

	};

	var connection = options.protocol === 'https:' ? https : http;
	var req = connection.request(options, response);

	if (callback) {
		req.on('error', function(err) {
			if (callback)
				callback(err, null, 0, null);
			callback = null;
		});
	}

	var header = NEWLINE + NEWLINE + '--' + BOUNDARY + NEWLINE + 'Content-Disposition: form-data; name="File"; filename="' + name + '"' + NEWLINE + 'Content-Type: ' + exports.getContentType(exports.getExtension(name)) + NEWLINE + NEWLINE;
	req.write(header);

	// Is Buffer
	if (typeof(stream.length) === NUMBER) {
		req.end(stream.toString('utf8') + NEWLINE + NEWLINE + '--' + BOUNDARY + '--');
		return;
	}

	stream.on('end', function() {
		req.end(NEWLINE + NEWLINE + '--' + BOUNDARY + '--');
	});

	stream.pipe(req, { end: false });
	return;
};

exports.$$send = function(name, stream, url, headers, method) {
	return function(callback) {
		exports.send(name, stream, url, callback, headers, method);
	};
};

/**
 * Trim string properties
 * @param {Object} obj
 * @return {Object}
 */
exports.trim = function(obj) {

	if (obj === undefined || obj === null)
		return obj;

	var type = typeof(obj);

	if (type === STRING)
		return obj.trim();

	if (obj instanceof Array) {
		for (var i = 0, length = obj.length; i < length; i++) {

			var item = obj[i];
			type = typeof(item);

			if (type === OBJECT) {
				exports.trim(item);
				continue;
			}

			if (type !== STRING)
				continue;

			obj[i] = item.trim();
		}

		return obj;
	}

	if (type !== OBJECT)
		return obj;

	Object.keys(obj).forEach(function(name) {

		var val = obj[name];
		var type = typeof(val);

		if (type === OBJECT) {
			exports.trim(val);
			return;
		}

		if (type !== STRING)
			return;

		obj[name] = val.trim();
	});

	return obj;
};

/**
 * Noop function
 * @return {Function} Empty function.
 */
exports.noop = global.noop = global.NOOP = function() {};

/**
 * Read HTTP status
 * @param  {Number} code HTTP code status.
 * @param  {Boolean} addCode Add code number to HTTP status.
 * @return {String}
 */
exports.httpStatus = function(code, addCode) {
	if (addCode === undefined)
		addCode = true;
	return (addCode ? code + ': ' : '') + http.STATUS_CODES[code];
};

/**
 * Extend object
 * @param {Object} target Target object.
 * @param {Object} source Source object.
 * @param {Boolean} rewrite Rewrite exists values (optional, default true).
 * @return {Object} Modified object.
 */
exports.extend = function(target, source, rewrite) {

	if (target === null || source === null)
		return target;

	if (typeof(target) !== OBJECT || typeof(source) !== OBJECT)
		return target;

	if (rewrite === undefined)
		rewrite = true;

	var keys = Object.keys(source);
	var i = keys.length;

	while (i--) {
		var key = keys[i];
		if (rewrite || target[key] === undefined)
			target[key] = source[key];
	}

	return target;
};

/**
 * Copy values from object to object
 * @param {Object} source Object source
 * @param {Object} target Object target (optional)
 * @return {Object} Modified object.
 */
exports.copy = function(source, target) {

	if (target === undefined)
		return exports.extend({}, source, true);

	if (target === null || source === null)
		return target;

	if (typeof(target) !== OBJECT || typeof(source) !== OBJECT)
		return target;

	var keys = Object.keys(source);
	var i = keys.length;

	while (i--) {

		var key = keys[i];
		if (target[key] === undefined)
			continue;

		target[key] = source[key];
	}

	return target;
};

/**
 * Reduce an object
 * @param {Object} source Source object.
 * @param {String Array or Object} prop Other properties than these ones will be removed.
 * @param {Boolean} reverse Reverse reducing (prop will be removed), default: false.
 * @return {Object}
 */
exports.reduce = function(source, prop, reverse) {

	if (!(prop instanceof Array)) {
		if (typeof(prop) === OBJECT)
			return exports.reduce(source, Object.keys(prop), reverse);
	}

	var output = {};

	Object.keys(source).forEach(function(o) {
		if (reverse) {
			if (prop.indexOf(o) === -1)
				output[o] = source[o];
		} else {
			if (prop.indexOf(o) !== -1)
				output[o] = source[o];
		}
	});

	return output;
};

/**
 * Assign value to an object according to a path
 * @param {Object} obj Source object.
 * @param {String} path Path to the update.
 * @param {Object or Function} fn Value or Function to update.
 * @return {Object}
 */
exports.assign = function(obj, path, fn) {

	if (obj === null || obj === undefined)
		return obj;

	var arr = path.split('.');
	var model = obj[arr[0]];

	for (var i = 1; i < arr.length - 1; i++)
		model = model[arr[i]];

	model[arr[arr.length - 1]] = typeof (fn) === FUNCTION ? fn(model[arr[arr.length - 1]]) : fn;
	return obj;
};

/**
 * Checks if is relative url
 * @param {String} url
 * @return {Boolean}
 */
exports.isRelative = function(url) {
	return !(url.substring(0, 2) === '//' || url.indexOf('http://') !== -1 || url.indexOf('https://') !== -1);
};

/**
 * Streamer method
 * @param {String} delimiter
 * @param {Function(value, index)} callback
 */
exports.streamer = function(delimiter, callback) {
    var cache = '';
    var length = delimiter.length;
    var indexer = 0;
    return function(chunk) {
    	if (!chunk)
    		return;
        if (typeof(chunk) !== 'string')
            chunk = chunk.toString('utf8');
        cache += chunk;
        var index = cache.indexOf(delimiter);
        if (index === -1)
            return;
        while (index !== -1) {
            callback(cache.substring(0, index + length), indexer++);
            cache = cache.substring(index + length);
            index = cache.indexOf(delimiter);
            if (index === -1)
                return;
        }
    };
};

/**
 * HTML encode string
 * @param {String} str
 * @return {String}
 */
exports.encode = function(str) {

	if (str === undefined)
		return '';

	var type = typeof(str);

	if (type !== STRING)
		str = str.toString();

	return str.encode();
};

/**
 * HTML decode string
 * @param {String} str
 * @return {String}
 */
exports.decode = function(str) {

	if (str === undefined)
		return '';

	var type = typeof(str);

	if (type !== STRING)
		str = str.toString();

	return str.decode();
};

/**
 * Checks if URL contains file extension.
 * @param {String} url
 * @return {Boolean}
 */
exports.isStaticFile = function(url) {
	return regexpSTATIC.test(url);
};

/**
 * Checks if string is null or empty
 * @param {String} str
 * @return {Boolean}
 */
exports.isNullOrEmpty = function(str) {

	if (typeof(str) !== STRING)
		return true;

	return str.length === 0;
};

/**
 * Converts Value to number
 * @param {Object} obj Value to convert.
 * @param {Number} def Default value (default: 0).
 * @return {Number}
 */
exports.parseInt = function(obj, def) {
	if (obj === undefined || obj === null)
		return def || 0;
	var type = typeof(obj);
	if (type === NUMBER)
		return obj;
	return (type !== STRING ? obj.toString() : obj).parseInt();
};

exports.parseBool = exports.parseBoolean = function(obj, def) {

	if (obj === undefined || obj === null)
		return def === undefined ? false : def;

	var type = typeof(obj);

	if (type === BOOLEAN)
		return obj;

	if (type === NUMBER)
		return obj > 0;

	var str = type !== STRING ? obj.toString() : obj;
	return str.parseBool(def);
};

/**
 * Converts Value to float number
 * @param {Object} obj Value to convert.
 * @param {Number} def Default value (default: 0).
 * @return {Number}
 */
exports.parseFloat = function(obj, def) {

	if (obj === undefined || obj === null)
		return def || 0;

	var type = typeof(obj);

	if (type === NUMBER)
		return obj;

	var str = type !== STRING ? obj.toString() : obj;
	return str.parseFloat(def);
};

/**
 * Check if the object is Array.
 * @param {Object} obj
 * @return {Boolean}
 */
exports.isArray = function(obj) {
	return obj instanceof Array;
};

/**
 * Check if the object is RegExp
 * @param {Object} obj
 * @return {Boolean}
 */
exports.isRegExp = function(obj) {
	return (obj && typeof(obj.test) === FUNCTION) ? true : false;
};

/**
 * Check if the object is Date
 * @param {Object} obj
 * @return {Boolean}
 */
exports.isDate = function(obj) {
	return (obj && typeof(obj.getTime) === FUNCTION) ? true : false;;
};

/**
 * Check if the object is Date
 * @param {Object} obj
 * @return {Boolean}
 */
exports.isError = function(obj) {
	return (obj && obj.stack) ? true : false;;
};

/**
 * Check if the value is object
 * @param {Object} value
 * @return {Boolean}
 */
exports.isObject = function(value) {
	try {
		return (value && Object.getPrototypeOf(value) === Object.prototype) ? true : false;
	} catch (e) {
		return false;
	}
};

/**
 * Get ContentType from file extension.
 * @param {String} ext File extension.
 * @return {String}
 */
exports.getContentType = function(ext) {
	if (ext[0] === '.')
		ext = ext.substring(1);
	return contentTypes[ext.toLowerCase()] || 'application/octet-stream';
};

/**
 * Get extension from filename
 * @param {String} filename
 * @return {String}
 */
exports.getExtension = function(filename) {
	if (!filename)
		return '';
	var index = filename.lastIndexOf('.');
	if (index === -1)
		return '';
	return filename.substring(index);
};

/**
 * Add a new content type to content types
 * @param {String} ext File extension.
 * @param {String} type Content type (example: application/json).
 */
exports.setContentType = function(ext, type) {
	if (ext[0] === '.')
		ext = ext.substring(1);
	contentTypes[ext.toLowerCase()] = type;
	return true;
};

/**
 * Create eTag hash from text
 * @param {String} text
 * @param {String} version
 * @return {String}
 */
exports.etag = function(text, version) {
	var sum = 0;
	var length = text.length;
	for (var i = 0; i < length; i++)
		sum += text.charCodeAt(i);
	return sum.toString() + (version ? ':' + version : '');
};

/*
	Add @delimiter to end of @path
	@path {String} :: filename
	@delimiter {String} :: optional, default /
	return {String}
*/
exports.path = function(path, delimiter) {

	if (!path)
		path = '';

	delimiter = delimiter || '/';
	if (path[path.length - 1] === delimiter)
		return path;

	return path + delimiter;
};

/**
 * Prepares Windows path to UNIX like format
 * @internal
 * @param {String} path
 * @return {String}
 */
exports.$normalize = function(path) {
	if (isWindows)
		return path.replace(regexpPATH, '/');
	return path;
};

/*
	Get random number
	@max {Number}
	@min {Number}
	return {Number}
*/
exports.random = function(max, min) {
	max = (max || 100000);
	min = (min || 0);
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

/*
	Create unique identifier
	@max {Number} :: optional, default 40
	return {String}
*/
exports.GUID = function(max) {

	max = max || 40;

	var rnd = function () {
		return Math.floor(Math.random() * 65536).toString(16);
	};

	var str = '';
	for (var i = 0; i < (max / 4) + 1; i++)
		str += rnd();

	return str.substring(0, max);
};

/**
 * Validate object
 * @param {Object} model Model to validate.
 * @param {String Array or String} properties Properties or Schema name.
 * @param {Function(name, value, path, schema)} prepare Validate function.
 * @param {ErrorBuilder} builder Own ErrorBuilder object.
 * @param {Function(resourceName, key)} resource Resource handler.
 * @param {String} path Internal, current path
 * @return {ErrorBuilder}
 */
exports.validate = function(model, properties, prepare, builder, resource, path, collection, index) {

	if (typeof(builder) === FUNCTION && resource === undefined) {
		resource = builder;
		builder = null;
	}

	var empty = false;

	if (collection === undefined) {
		empty = true;
		collection = {};
	}

	var error = builder;
	var current = path === undefined ? '' : path + '.';
	var isSchema = false;
	var schemaName = '';
	var definition = null;
	var schema;

	if (!(error instanceof builders.ErrorBuilder))
		error = new builders.ErrorBuilder(resource);

	if (typeof(properties) === STRING) {
		schema = collection === undefined ? builders.validation(properties) : collection[properties] === undefined ? '' : collection[properties].properties;
		if (schema.length !== 0) {
			schemaName = properties;
			properties = schema;
			isSchema = true;
			definition = collection === undefined ? builders.schema('default').collection : collection;
			if (!definition)
				definition = {};
		} else if (!empty)
			return error;
		else
			properties = properties.replace(/\s/g, '').split(',');
	}

	if (model === undefined || model === null)
		model = {};

	if (typeof(prepare) !== FUNCTION)
		throw new Error('The validate function does not have any method to validate properties.\nYou must define the delegate: framework.onValidate ...');

	for (var i = 0; i < properties.length; i++) {

		var name = properties[i].toString();
		var value = model[name];
		var type = typeof(value);

		if (value === undefined) {
			error.add(name, '@', current + name);
			continue;
		} else if (type === FUNCTION)
			value = model[name]();

		if (type !== OBJECT && isSchema) {
			// collection = builders.schema('default').collection;
			if (builders.isJoin(collection, name))
				type = OBJECT;
		}

		if (type === OBJECT && !exports.isDate(value)) {
			if (isSchema) {
				schema = collection[schemaName];
				if (schema) {
					schema = schema.schema[name] || null;

					if (schema === Date || schema === String || schema === Number || schema === Boolean) {
						// Empty
					} else if (schema !== null && typeof(schema) === STRING) {

						var isArray = schema[0] === '[';

						if (!isArray) {
							exports.validate(value, schema, prepare, error, resource, current + name, collection);
							continue;
						}

						schema = schema.substring(1, schema.length - 1).trim();

						if (!(value instanceof Array)) {
							error.add(name, '@', current + name, index);
							continue;
						}

						// The schema not exists
						if (collection[schema] === undefined) {

							var result2 = prepare(name, value, current + name, schemaName, model);
							if (result2 === undefined)
								continue;

							type = typeof(result2);

							if (type === STRING) {
								error.add(name, result2, current + name, index);
								continue;
							}

							if (type === BOOLEAN && !result2) {
								error.add(name, '@', current + name, index);
								continue;
							}

							if (result2.isValid === false)
								error.add(name, result2.error, current + name, index);

							continue;
						}

						var result3 = prepare(name, value, current + name, schemaName, model);
						if (result3 !== undefined) {

							type = typeof(result3);

							if (type === STRING) {
								error.add(name, result3, current + name, index);
								continue;
							}

							if (type === BOOLEAN && !result3) {
								error.add(name, '@', current + name, index);
								continue;
							}

							if (result3.isValid === false) {
								error.add(name, result3.error, current + name, index);
								continue;
							}
						}

						var sublength = value.length;
						for (var j = 0; j < sublength; j++)
							exports.validate(value[j], schema, prepare, error, resource, current + name, collection, j);

						continue;
					}
				}
			}
		}

		var result = prepare(name, value, current + name, schemaName, model);

		if (result === undefined)
			continue;

		type = typeof(result);

		if (type === STRING) {
			error.add(name, result, current + name, index);
			continue;
		}

		if (type === BOOLEAN) {
			if (!result)
				error.add(name, '@', current + name, index);
			continue;
		}

		if (result.isValid === false)
			error.add(name, result.error, current + name, index);
	}

	return error;
};

exports.validate_builder = function(model, error, schema, collection, path, index, fields) {

	var entity = collection[schema];
	var prepare = entity.onValidate || entity.onValidation || framework.onValidate || framework.onValidation;

	var current = path === undefined ? '' : path + '.';
	var properties = entity.properties;

	if (model === undefined || model === null)
		model = {};

	if (typeof(prepare) !== FUNCTION)
		throw new Error('It\'s not defined onValidation delegate.');

	for (var i = 0; i < properties.length; i++) {

		var name = properties[i].toString();
		if (fields && fields.indexOf(name) === -1)
			continue;

		var value = model[name];
		var type = typeof(value);

		if (value === undefined) {
			error.add(name, '@', current + name);
			continue;
		} else if (type === FUNCTION)
			value = model[name]();

		if (type !== OBJECT) {
			if (builders.isJoin(collection, name))
				type = OBJECT;
		}

		if (type === OBJECT && !exports.isDate(value)) {
			entity = collection[schema];

			if (entity) {
				entity = entity.schema[name] || null;

				if (entity === Date || entity === String || entity === Number || entity === Boolean) {
					// Empty
				} else if (entity !== null && typeof(entity) === STRING) {

					var isArray = entity[0] === '[';

					if (!isArray) {
						exports.validate_builder(value, error, schema, collection, current + name, index);
						continue;
					}

					entity = entity.substring(1, entity.length - 1).trim();

					if (!(value instanceof Array)) {
						error.add(name, '@', current + name, index);
						continue;
					}

					// The schema not exists
					if (collection[entity] === undefined) {

						var result2 = prepare(name, value, current + name, model, schema);
						if (result2 === undefined)
							continue;

						type = typeof(result2);

						if (type === STRING) {
							error.add(name, result2, current + name, index);
							continue;
						}

						if (type === BOOLEAN && !result2) {
							error.add(name, '@', current + name, index);
							continue;
						}

						if (result2.isValid === false)
							error.add(name, result2.error, current + name, index);

						continue;
					}

					var result3 = prepare(name, value, current + name, model, schema);
					if (result3 !== undefined) {

						type = typeof(result3);

						if (type === STRING) {
							error.add(name, result3, current + name, index);
							continue;
						}

						if (type === BOOLEAN && !result3) {
							error.add(name, '@', current + name, index);
							continue;
						}

						if (result3.isValid === false) {
							error.add(name, result3.error, current + name, index);
							continue;
						}
					}

					var sublength = value.length;
					for (var j = 0; j < sublength; j++)
						exports.validate_builder(value[j], error, entity, collection, current + name, j);

					continue;
				}
			}
		}

		var result = prepare(name, value, current + name, model, schema);

		if (result === undefined)
			continue;

		type = typeof(result);

		if (type === STRING) {
			error.add(name, result, current + name, index);
			continue;
		}

		if (type === BOOLEAN) {
			if (!result)
				error.add(name, '@', current + name, index);
			continue;
		}

		if (result.isValid === false)
			error.add(name, result.error, current + name, index);
	}

	return error;
};

/*
	Validation object
	@isValid {Boolean}
	@error {String} :: optional, default @
	return {Object}
*/
exports.isValid = function(valid, error) {
	return { isValid: valid, error: error || '@' };
};

/*
	Email address validation
	@str {String}
	return {Boolean}
*/
exports.isEmail = function(str) {
	return (str || '').toString().isEmail();
};

/*
	URL address validation
	@str {String}
	return {Boolean}
*/
exports.isURL = function(str) {
	return (str || '').toString().isURL();
};

/*
	Combine path
	@arguments {String array}
	return {String}
*/
exports.combine = function() {

	var self = this;
	var p;

	if (arguments[0][0] === '~') {
		arguments[0] = arguments[0].substring(1);
		p = '';

		for (var i = 0, length = arguments.length; i < length; i++) {
			var v = arguments[i];
			if (!v)
				continue;
			if (v[0] === '/')
				v = v.substring(1);
			p += (p[p.length - 1] !== '/' ? '/' : '') + v;
		}

		return exports.$normalize(p);
	}

	p = framework.directory;

	for (var i = 0, length = arguments.length; i < length; i++) {
		var v = arguments[i];
		if (!v)
			continue;
		if (v[0] === '/')
			v = v.substring(1);
		p += (p[p.length - 1] !== '/' ? '/' : '') + v;
	}

	return exports.$normalize(p);
};

/**
 * Remove diacritics
 * @param {String} str
 * @return {String}
 */
exports.removeDiacritics = function(str) {
	var buf = '';
	for (var i = 0, length = str.length; i < length; i++) {
		var c = str[i];
		var code = c.charCodeAt(0);
		var isUpper = false;

		var r = DIACRITICS[code];

		if (r === undefined) {
			code = c.toLowerCase().charCodeAt(0);
			r = DIACRITICS[code];
			isUpper = true;
		}

		if (r === undefined) {
			buf += c;
			continue;
		}

		c = r;
		if (isUpper)
			c = c.toUpperCase();
		buf += c;
	}
	return buf;
};

/**
 * Simple XML parser
 * @param {String} xml
 * @return {Object}
 */
exports.parseXML = function(xml) {

	var beg = -1;
	var end = 0;
	var tmp = 0;
	var current = [];
	var obj = {};
	var from = -1;

	while (true) {

		beg = xml.indexOf('<', beg + 1);
		if (beg === -1)
			break;

		end = xml.indexOf('>', beg + 1);
		if (end === -1)
			break;

		var el = xml.substring(beg, end + 1);
		var c = el[1];

		if (c === '?' || c === '/') {

			var o = current.pop();

			if (from === -1 || o !== el.substring(2, el.length - 1))
				continue;

			var path = (current.length ? current.join('.') + '.' : '') + o;
			var value = xml.substring(from, beg).decode();

			if (obj[path] === undefined)
				obj[path] = value;
			else if (obj[path] instanceof Array)
				obj[path].push(value);
			else
				obj[path] = [obj[path], value];

			from = -1;
			continue;
		}

		tmp = el.indexOf(' ');
		var hasAttributes = true;

		if (tmp === -1) {
			tmp = el.length - 1;
			hasAttributes = false;
		}

		from = beg + el.length;

		var isSingle = el[el.length - 2] === '/';
		var name = el.substring(1, tmp);

		if (!isSingle)
			current.push(name);

		if (!hasAttributes)
			continue;

		var match = el.match(/\w+\=\".*?\"/g);
		if (match === null)
			continue;

		var attr = {};
		var length = match.length;

		for (var i = 0; i < length; i++) {
			var index = match[i].indexOf('"');
			attr[match[i].substring(0, index - 1)] = match[i].substring(index + 1, match[i].length - 1).decode();
		}

		obj[current.join('.') + (isSingle ? '.' + name : '') + '[]'] = attr;
	}

	return obj;
};

exports.parseJSON = function(value) {
	try {
		return JSON.parse(value);
	} catch(e) {
		return null;
	}
};

/**
 * Get WebSocket frame
 * @author Jozef Gula <gula.jozef@gmail.com>
 * @param {Number} code
 * @param {Buffer or String} message
 * @param {Hexa} type
 * @return {Buffer}
 */
exports.getWebSocketFrame = function(code, message, type) {
	var messageBuffer = getWebSocketFrameMessageBytes(code, message);
	var messageLength = messageBuffer.length;
	var lengthBuffer = getWebSocketFrameLengthBytes(messageLength);
	var frameBuffer = new Buffer(1 + lengthBuffer.length + messageLength);
	frameBuffer[0] = 0x80 | type;
	lengthBuffer.copy(frameBuffer, 1, 0, lengthBuffer.length);
	messageBuffer.copy(frameBuffer, lengthBuffer.length + 1, 0, messageLength);
	return frameBuffer;
};

/**
 * Get bytes of WebSocket frame message
 * @author Jozef Gula <gula.jozef@gmail.com>
 * @param  {Number} code
 * @param  {Buffer or String} message
 * @return {Buffer}
 */
function getWebSocketFrameMessageBytes(code, message) {
	var index = code === 0 ? 0 : 2;
	var binary = message.readUInt8 !== undefined;
	var length = message.length;
	var messageBuffer = new Buffer(length + index);

	for (var i = 0; i < length; i++) {
		if (binary)
			messageBuffer[i + index] = message[i];
		else
			messageBuffer[i + index] = message.charCodeAt(i);
	}

	if (code === 0)
		return messageBuffer;

	messageBuffer[0] = (code >> 8);
	messageBuffer[1] = (code);

	return messageBuffer;
}

/**
 * Get length of WebSocket frame
 * @author Jozef Gula <gula.jozef@gmail.com>
 * @param  {Number} length
 * @return {Number}
 */
function getWebSocketFrameLengthBytes(length) {
	var lengthBuffer = null;

	if (length <= 125) {
		lengthBuffer = new Buffer(1);
		lengthBuffer[0] = length;
		return lengthBuffer;
	}

	if (length <= 65535) {
		lengthBuffer = new Buffer(3);
		lengthBuffer[0] = 126;
		lengthBuffer[1] = (length >> 8) & 255;
		lengthBuffer[2] = (length) & 255;
		return lengthBuffer;
	}

	lengthBuffer = new Buffer(9);

	lengthBuffer[0] = 127;
	lengthBuffer[1] = 0x00;
	lengthBuffer[2] = 0x00;
	lengthBuffer[3] = 0x00;
	lengthBuffer[4] = 0x00;
	lengthBuffer[5] = (length >> 24) & 255;
	lengthBuffer[6] = (length >> 16) & 255;
	lengthBuffer[7] = (length >> 8) & 255;
	lengthBuffer[8] = (length) & 255;

	return lengthBuffer;
}

/**
 * GPS distance in KM
 * @param  {Number} lat1
 * @param  {Number} lon1
 * @param  {Number} lat2
 * @param  {Number} lon2
 * @return {Number}
 */
exports.distance = function(lat1, lon1, lat2, lon2) {
	var R = 6371;
	var dLat = (lat2 - lat1).toRad();
	var dLon = (lon2 - lon1).toRad();
	var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return (R * c).floor(3);
};

/**
 * Directory listing
 * @param  {String} path Path.
 * @param  {Function(files, directories)} callback Callback
 * @param  {Function(filename)} filter Custom filter (optional).
 */
exports.ls = function(path, callback, filter) {
	var filelist = new FileList();
	filelist.onComplete = callback;
	filelist.onFilter = filter || null;
	filelist.walk(path);
};

/*
	@type {String}
	@value {Number}
	return {Date}
*/
Date.prototype.add = function(type, value) {

	if (value === undefined) {
		var arr = type.split(' ');
		type = arr[1];
		value = exports.parseInt(arr[0]);
	}

	var self = this;
	var dt = new Date(self.getTime());

	switch(type) {
		case 's':
		case 'ss':
		case 'sec':
		case 'second':
		case 'seconds':
			dt.setSeconds(dt.getSeconds() + value);
			return dt;
		case 'm':
		case 'mm':
		case 'minute':
		case 'min':
		case 'minutes':
			dt.setMinutes(dt.getMinutes() + value);
			return dt;
		case 'h':
		case 'hh':
		case 'hour':
		case 'hours':
			dt.setHours(dt.getHours() + value);
			return dt;
		case 'd':
		case 'dd':
		case 'day':
		case 'days':
			dt.setDate(dt.getDate() + value);
			return dt;
		case 'M':
		case 'MM':
		case 'month':
		case 'months':
			dt.setMonth(dt.getMonth() + value);
			return dt;
		case 'y':
		case 'yyyy':
		case 'year':
		case 'years':
			dt.setFullYear(dt.getFullYear() + value);
			return dt;
	}
	return dt;
};

/**
 * Date difference
 * @param  {Date/Number/String} date Optional.
 * @param  {String} type Date type: minutes, seconds, hours, days, months, years
 * @return {Number}
 */
Date.prototype.diff = function(date, type) {

	if (arguments.length === 1) {
		type = date;
		date = Date.now();
	} else {
		var to = typeof(date);
		if (to === STRING)
			date = Date.parse(date);
		else if (exports.isDate(date))
			date = date.getTime();
	}

	var r = this.getTime() - date;

	switch (type) {
		case 's':
		case 'ss':
		case 'second':
		case 'seconds':
			r = Math.ceil(r / 1000);
			if (r === 0)
				return r.toString().parseInt();
			return r;
		case 'm':
		case 'mm':
		case 'minute':
		case 'minutes':
			r = Math.ceil((r / 1000) / 60);
			if (r === 0)
				return r.toString().parseInt();
			return r;
		case 'h':
		case 'hh':
		case 'hour':
		case 'hours':
			r = Math.ceil(((r / 1000) / 60) / 60);
			if (r === 0)
				return r.toString().parseInt();
			return r;
		case 'd':
		case 'dd':
		case 'day':
		case 'days':
			r = Math.ceil((((r / 1000) / 60) / 60) / 24);
			if (r === 0)
				return r.toString().parseInt();
			return r;
		case 'M':
		case 'MM':
		case 'month':
		case 'months':
			// avg: 28 days per month
			r = Math.ceil((((r / 1000) / 60) / 60) / (24 * 28));
			if (r === 0)
				return r.toString().parseInt();
			return r;

		case 'y':
		case 'yyyy':
		case 'year':
		case 'years':
			// avg: 28 days per month
			r = Math.ceil((((r / 1000) / 60) / 60) / (24 * 28 * 12));
			if (r === 0)
				return r.toString().parseInt();
			return r;
	}

	return NaN;
};

Date.prototype.extend = function(date) {
	var dt = new Date(this);
	var match = date.match(regexpDATE);

	if (!match)
		return dt;

	for (var i = 0, length = match.length; i < length; i++) {
		var m = match[i];
		var arr, tmp;

		if (m.indexOf(':') !== -1) {

			arr = m.split(':');
			tmp = +arr[0];
			if (!isNaN(tmp))
				dt.setHours(tmp);

			if (arr[1]) {
				tmp = +arr[1];
				if (!isNaN(tmp))
					dt.setMinutes(tmp);
			}

			if (arr[2]) {
				tmp = +arr[2];
				if (!isNaN(tmp))
					dt.setSeconds(tmp);
			}

			continue;
		}

		if (m.indexOf('-') !== -1) {
			arr = m.split('-');

			tmp = +arr[0];
			dt.setFullYear(tmp);

			if (arr[1]) {
				tmp = +arr[1];
				if (!isNaN(tmp))
					dt.setMonth(tmp - 1);
			}

			if (arr[2]) {
				tmp = +arr[2];
				if (!isNaN(tmp))
					dt.setDate(tmp);
			}

			continue;
		}

		if (m.indexOf('.') !== -1) {
			arr = m.split('.');

			tmp = +arr[0];
			dt.setDate(tmp);

			if (arr[1]) {
				tmp = +arr[1];
				if (!isNaN(tmp))
					dt.setMonth(tmp - 1);
			}

			if (arr[2]) {
				tmp = +arr[2];
				if (!isNaN(tmp))
					dt.setFullYear(tmp);
			}

			continue;
		}
	}

	return dt;
};

/**
 * Compare dates
 * @param {Date} date
 * @return {Number} Results: -1 = current date is earlier than @date, 0 = current date is same as @date, 1 = current date is later than @date
 */
Date.prototype.compare = function(date) {

	var self = this;
	var r = self.getTime() - date.getTime();

	if (r === 0)
		return 0;

	if (r < 0)
		return -1;

	return 1;
};

/**
 * Compare two dates
 * @param {String or Date} d1
 * @param {String or Date} d2
 * @return {Number} Results: -1 = @d1 is earlier than @d2, 0 = @d1 is same as @d2, 1 = @d1 is later than @d2
 */
Date.compare = function(d1, d2) {

	if (typeof(d1) === STRING)
		d1 = d1.parseDate();

	if (typeof(d2) === STRING)
		d2 = d2.parseDate();

	return d1.compare(d2);
};

/**
 * Format datetime
 * @param {String} format
 * @return {String}
 */
Date.prototype.format = function(format) {

	var self = this;
	var half = false;

	if (format && format[0] === '!') {
		half = true;
		format = format.substring(1);
	}

	if (format === undefined || format === null || format === '')
		return self.getFullYear() + '-' + (self.getMonth() + 1).toString().padLeft(2, '0') + '-' + self.getDate().toString().padLeft(2, '0') + 'T' + self.getHours().toString().padLeft(2, '0') + ':' + self.getMinutes().toString().padLeft(2, '0') + ':' + self.getSeconds().toString().padLeft(2, '0') + '.' + self.getMilliseconds().toString().padLeft(3, '0') + 'Z';

	var h = self.getHours();

	if (half) {
		if (h >= 12)
			h -= 12;
	}

	return format.replace(regexpDATEFORMAT, function(key) {
		switch (key) {
			case 'yyyy':
				return self.getFullYear();
			case 'yy':
				return self.getYear();
			case 'MM':
				return (self.getMonth() + 1).toString().padLeft(2, '0');
			case 'M':
				return (self.getMonth() + 1);
			case 'dd':
				return self.getDate().toString().padLeft(2, '0');
			case 'd':
				return self.getDate();
			case 'HH':
			case 'hh':
				return h.toString().padLeft(2, '0');
			case 'H':
			case 'h':
				return self.getHours();
			case 'mm':
				return self.getMinutes().toString().padLeft(2, '0');
			case 'm':
				return self.getMinutes();
			case 'ss':
				return self.getSeconds().toString().padLeft(2, '0');
			case 's':
				return self.getSeconds();
			case 'a':
				var a = 'AM';
				if (self.getHours() >= 12)
					a = 'PM';
				return a;
		}
	});
};

Date.prototype.toUTC = function(ticks) {
	var dt = this.getTime() + this.getTimezoneOffset() * 60000;
	return ticks ? dt : new Date(dt);
};

if (!String.prototype.trim) {
	String.prototype.trim = function() {
		return this.replace(regexpTRIM, '');
	};
}

if (!String.prototype.replaceAt) {
	String.prototype.replaceAt = function(index, character) {
		var self = this;
		return self.substr(0, index) + character + self.substr(index + character.length);
	};
}

/**
 * Checks if the string starts with the text
 * @see {@link http://docs.totaljs.com/String.prototype/#String.prototype.startsWith|Documentation}
 * @param {String} text Text to find.
 * @param {Boolean/Number} ignoreCase Ingore case sensitive or position in the string.
 * @return {Boolean}
 */
String.prototype.startsWith = function(text, ignoreCase) {
	var self = this;
	var length = text.length;
	var tmp;

	if (ignoreCase === true) {
		tmp = self.substring(0, length);
		return tmp.length === length && tmp.toLowerCase() === text.toLowerCase();
	}

	if (ignoreCase)
		tmp = self.substr(ignoreCase, length);
	else
		tmp = self.substring(0, length);

	return tmp.length === length && tmp === text;
};

/**
 * Checks if the string ends with the text
 * @see {@link http://docs.totaljs.com/String.prototype/#String.prototype.endsWith|Documentation}
 * @param {String} text Text to find.
 * @param {Boolean/Number} ignoreCase Ingore case sensitive or position in the string.
 * @return {Boolean}
 */
String.prototype.endsWith = function(text, ignoreCase) {
	var self = this;
	var length = text.length;
	var tmp;

	if (ignoreCase === true) {
		tmp = self.substring(self.length - length);
		return tmp.length === length && tmp.toLowerCase() === text.toLowerCase();
	}

	if (ignoreCase > 0)
		tmp = self.substr((self.length - ignoreCase) - length, length);
	else
		tmp = self.substring(self.length - length);

	return tmp.length === length && tmp === text;

};

String.prototype.replacer = function(find, text) {
	var self = this;
	var beg = self.indexOf(find);
	if (beg === -1)
		return self;
	return self.substring(0, beg) + text + self.substring(beg + find.length);
};

/**
 * Hash string
 * @param {String} type Hash type.
 * @param {String} salt Optional, salt.
 * @return {String}
 */
String.prototype.hash = function(type, salt) {
	var str = this;
	if (salt)
		str += salt;
	switch ((type || '').toLowerCase()) {
		case 'md5':
			return str.md5();
		case 'sha1':
			return str.sha1();
		case 'sha256':
			return str.sha256();
		case 'sha512':
			return str.sha512();
		default:
			return string_hash(str);
	}
};

function string_hash(s) {
	var hash = 0, i, char;
	if (s.length === 0)
		return hash;
	var l = s.length;
	for (i = 0; i < l; i++) {
		char = s.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
}

/*
	Count text in string
	@text {String}
	return {Number}
*/
String.prototype.count = function(text) {
	var index = 0;
	var count = 0;
	do {

		index = this.indexOf(text, index + text.length);

		if (index > 0)
			count++;

	} while (index > 0);
	return count;
};

/**
 * Parse XML
 * @return {Object}
 */
String.prototype.parseXML = function() {
	return exports.parseXML(this);
};

String.prototype.parseJSON = function() {
	return exports.parseJSON(this);
};

/**
 * Parse date from string
 * @return {Date}
 */
String.prototype.parseDate = function() {
	var self = this.trim();

	var lc = self.charCodeAt(self.length - 1);

	// Classic date
	if (lc === 41)
		return new Date(self);

	// JSON format
	if (lc === 90)
		return new Date(Date.parse(self));

	var arr = self.indexOf(' ') === -1 ? self.split('T') : self.split(' ');
	var index = arr[0].indexOf(':');
	var length = arr[0].length;

	if (index !== -1) {
		var tmp = arr[1];
		arr[1] = arr[0];
		arr[0] = tmp;
	}

	if (arr[0] === undefined)
		arr[0] = '';

	var noTime = arr[1] === undefined ? true : arr[1].length === 0;

	for (var i = 0; i < length; i++) {
		var c = arr[0].charCodeAt(i);
		if (c > 47 && c < 58)
			continue;
		if (c === 45 || c === 46)
			continue;

		if (noTime)
			return new Date(self);
	}

	if (arr[1] === undefined)
		arr[1] = '00:00:00';

	var firstDay = arr[0].indexOf('-') === -1;

	var date = (arr[0] || '').split(firstDay ? '.' : '-');
	var time = (arr[1] || '').split(':');
	var parsed = [];

	if (date.length < 4 && time.length < 2)
		return new Date(self);

	index = (time[2] || '').indexOf('.');

	// milliseconds
	if (index !== -1) {
		time[3] = time[2].substring(index + 1);
		time[2] = time[2].substring(0, index);
	} else
		time[3] = '0';

	parsed.push(+date[firstDay ? 2 : 0]); // year
	parsed.push(+date[1]); // month
	parsed.push(+date[firstDay ? 0 : 2]); // day
	parsed.push(+time[0]); // hours
	parsed.push(+time[1]); // minutes
	parsed.push(+time[2]); // seconds
	parsed.push(+time[3]); // miliseconds

	var def = new Date();

	for (var i = 0, length = parsed.length; i < length; i++) {
		if (isNaN(parsed[i]))
			parsed[i] = 0;

		var value = parsed[i];
		if (value !== 0)
			continue;

		switch (i) {
			case 0:
				if (value <= 0)
					parsed[i] = def.getFullYear();
				break;
			case 1:
				if (value <= 0)
					parsed[i] = def.getMonth() + 1;
				break;
			case 2:
				if (value <= 0)
					parsed[i] = def.getDate();
				break;
		}
	}

	return new Date(parsed[0], parsed[1] - 1, parsed[2], parsed[3], parsed[4], parsed[5]);
};

/**
 * Parse expiration date
 * @return {Date}
 */
String.prototype.parseDateExpiration = function() {
	var self = this;

	var arr = self.split(' ');
	var dt = new Date();
	var length = arr.length;

	for (var i = 0; i < length; i += 2) {

		var num = arr[i].parseInt();
		if (num === 0)
			continue;

		var type = arr[i + 1] || '';
		if (type === '')
			continue;

		dt = dt.add(type, num);
	}

	return dt;
};

/*
	Contain string a array values?
	@value {String or String Array}
	@mustAll {Boolean} :: optional (default false), String must contains all items in String array
	return {Boolean}
*/
String.prototype.contains = function(value, mustAll) {

	var str = this;

	if (typeof(value) === STRING)
		return str.indexOf(value, typeof(mustAll) === NUMBER ? mustAll : 0) !== -1;

	var length = value.length;

	for (var i = 0; i < length; i++) {
		var exists = str.indexOf(value[i]) !== -1;
		if (mustAll) {
			if (!exists)
				return false;
		} else if (exists)
			return true;
	}

	return mustAll;
};

/**
 * Parse configuration from a string
 * @param {Object} def Default value, optional
 * @return {Object}
 */
String.prototype.configuration = function(def) {
	console.log('OBSOLETE: String.configuration() -> use String.parseConfig([default])');
	return this.parseConfig(def);
};

/**
 * Parse configuration from a string
 * @param {Object} def
 * @return {Object}
 */
String.prototype.parseConfig = function(def) {
	var arr = this.split('\n');
	var length = arr.length;
	var obj = exports.extend({}, def);

	for (var i = 0; i < length; i++) {

		var str = arr[i];

		if (str === '' || str[0] === '#')
			continue;

		if (str.substring(0, 2) === '//')
			continue;

		var index = str.indexOf(' :');
		if (index === -1) {
			index = str.indexOf('\t:');
			if (index === -1)
				continue;
		}

		obj[str.substring(0, index).trim()] = str.substring(index + 2).trim();
	}

	return obj;
};

/**
 * String format
 * @return {String}
 */
String.prototype.format = function() {
	var arg = arguments;
	return this.replace(regexpSTRINGFORMAT, function(text) {
		var value = arg[+text.substring(1, text.length - 1)];
		if (value === null || value === undefined)
			value = '';
		return value;
	});
};

String.prototype.encode = function() {
	var output = '';
	for (var i = 0, length = this.length; i < length; i++) {
		var c = this[i];
		switch (c) {
			case '<':
				output += '&lt;';
				break;
			case '>':
				output += '&gt;';
				break;
			case '"':
				output += '&quot;';
				break;
			case '\'':
				output += '&apos;';
				break;
			case '&':
				output += '&amp;';
				break;
			default:
				output += c;
				break;
		}
	}
	return output;
};

String.prototype.decode = function() {
	return this.replace(/&gt;/g, '>').replace(/\&lt;/g, '<').replace(/\&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&amp;/g, '&');
};

String.prototype.urlEncode = function() {
	return encodeURIComponent(this);
};

String.prototype.urlDecode = function() {
	return decodeURIComponent(this);
};

/*
	Simple templating :: Hello {name}, your score: {score}, your price: {price | ### ###.##}, date: {date | dd.MM.yyyy}
	@obj {Object}
	return {String}
*/
String.prototype.params = function(obj) {
	var formatted = this;

	if (obj === undefined || obj === null)
		return formatted;

	var reg = /\{{2}[^}\n]*\}{2}/g;
	return formatted.replace(reg, function(prop) {

		var isEncode = false;
		var name = prop.substring(2, prop.length - 2).trim();

		var format = '';
		var index = name.indexOf('|');

		if (index !== -1) {
			format = name.substring(index + 1, name.length).trim();
			name = name.substring(0, index).trim();
		}

		if (name[0] === '!')
			name = name.substring(1);
		else
			isEncode = true;

		var val;

		if (name.indexOf('.') !== -1) {
			var arr = name.split('.');
			if (arr.length === 2) {
				if (obj[arr[0]])
					val = obj[arr[0]][arr[1]];
			}
			else if (arr.length === 3) {
				if (obj[arr[0]] && obj[arr[0]][arr[1]])
					val = obj[arr[0]][arr[1]][arr[2]];
			}
			else if (arr.length === 4)
				if (obj[arr[0]] && obj[arr[0]][arr[1]] && obj[arr[0]][arr[1]][arr[2]])
					val = obj[arr[0]][arr[1]][arr[2]][arr[3]];
			else if (arr.length === 5) {
				if (obj[arr[0]] && obj[arr[0]][arr[1]] && obj[arr[0]][arr[1]][arr[2]] && obj[arr[0]][arr[1]][arr[2]][arr[3]])
					val = obj[arr[0]][arr[1]][arr[2]][arr[3]][arr[4]];
			}
		} else
			val = name.length === 0 ? obj : obj[name];

		if (typeof(val) === FUNCTION)
			val = val(index);

		if (val === undefined)
			return prop;

		if (format.length) {

			var type = typeof(val);
			if (type === STRING) {
				var max = +format;
				if (!isNaN(max))
					val = val.max(max + 3, '...');

			} else if (type === NUMBER || exports.isDate(val)) {
				if (format.isNumber())
					format = +format;
				val = val.format(format);
			}
		}

		val = val.toString().dollar();
		return isEncode ? exports.encode(val) : val;
	});
};

/*
	Set max length of string
	@length {Number}
	@chars {String} :: optional, default ...
	return {String}
*/
String.prototype.max = function(length, chars) {
	var str = this;
	if (typeof(chars) !== STRING)
		chars = '...';
	return str.length > length ? str.substring(0, length - chars.length) + chars : str;
};

String.prototype.isJSON = function() {
	var self = this;
	if (self.length <= 1)
		return false;
	var a = self[0];
	var b = self[self.length - 1];
	return (a === '"' && b === '"') || (a === '[' && b === ']') || (a === '{' && b === '}');
};

String.prototype.isURL = function() {
	var str = this;
	if (str.length <= 7)
		return false;
	return regexpUrl.test(str);
};

String.prototype.isEmail = function() {
	var str = this;
	if (str.length <= 4)
		return false;
	return regexpMail.test(str);
};

String.prototype.parseInt = function(def) {
	var str = this.trim();
	var num = +str;
	if (isNaN(num))
		return def || 0;
	return num;
};

String.prototype.parseBool = String.prototype.parseBoolean = function() {
	var self = this.toLowerCase();
	return self === 'true' || self === '1' || self === 'on';
};

String.prototype.parseFloat = function(def) {
	var str = this.trim();
	if (str.indexOf(',') !== -1)
		str = str.replace(',', '.');
	var num = +str;
	if (isNaN(num))
		return def || 0;
	return num;
};

String.prototype.toUnicode = function() {
	var result = '';
	var self = this;
	var length = self.length;
	for(var i = 0; i < length; ++i){
		if(self.charCodeAt(i) > 126 || self.charCodeAt(i) < 32)
			result += '\\u' + self.charCodeAt(i).hex(4);
		else
			result += self[i];
	}
	return result;
};

String.prototype.fromUnicode = function() {

	var str = this.replace(/\\u([\d\w]{4})/gi, function (match, v) {
		return String.fromCharCode(parseInt(v, 16));
	});

	return unescape(str);
};

String.prototype.sha1 = function(salt) {
	var hash = crypto.createHash('sha1');
	hash.update(this + (salt || ''), ENCODING);
	return hash.digest('hex');
};

String.prototype.sha256 = function(salt) {
	var hash = crypto.createHash('sha256');
	hash.update(this + (salt || ''), ENCODING);
	return hash.digest('hex');
};

String.prototype.sha512 = function(salt) {
	var hash = crypto.createHash('sha512');
	hash.update(this + (salt || ''), ENCODING);
	return hash.digest('hex');
};

String.prototype.md5 = function(salt) {
	var hash = crypto.createHash('md5');
	hash.update(this + (salt || ''), ENCODING);
	return hash.digest('hex');
};

String.prototype.toSearch = function() {
	return this.replace(/[^a-zA-Zá-žÁ-Ž\d\s:]/g, '').trim().replace(/\s{2,}/g, ' ').toLowerCase().removeDiacritics().replace(/y/g, 'i');
};

/*
	@key {String}
	@isUnique {Boolean}
	return {String}
*/
String.prototype.encrypt = function(key, isUnique) {
	var str = '0' + this;
	var data_count = str.length;
	var key_count = key.length;
	var random = isUnique ? exports.random(120) + 40 : 65;
	var count = data_count + (random % key_count);
	var values = [];
	var index = 0;

	values[0] = String.fromCharCode(random);
	var counter = this.length + key.length;

	for (var i = count - 1; i > 0; i--) {
		index = str.charCodeAt(i % data_count);
		values[i] = String.fromCharCode(index ^ (key.charCodeAt(i % key_count) ^ random));
	}

	var hash = new Buffer(counter + '=' + values.join(''), ENCODING).toString('base64').replace(/\//g, '-').replace(/\+/g, '_');
	index = hash.indexOf('=');
	if (index > 0)
		return hash.substring(0, index);

	return hash;
};

/*
	@key {String}
	return {String}
*/
String.prototype.decrypt = function(key) {

	var values = this.replace(/\-/g, '/').replace(/\_/g, '+');
	var mod = values.length % 4;

	if (mod > 0) {
		for (var i = 0; i < mod; i++)
			values += '=';
	}

	values = new Buffer(values, 'base64').toString(ENCODING);

	var index = values.indexOf('=');
	if (index === -1)
		return null;

	var counter = +values.substring(0, index);
	if (isNaN(counter))
		return null;

	values = values.substring(index + 1);

	var count = values.length;
	var random = values.charCodeAt(0);

	var key_count = key.length;
	var data_count = count - (random % key_count);
	var decrypt_data = [];

	for (var i = data_count - 1; i > 0; i--) {
		index = values.charCodeAt(i) ^ (random ^ key.charCodeAt(i % key_count));
		decrypt_data[i] = String.fromCharCode(index);
	}

	var val = decrypt_data.join('');

	if (counter !== val.length + key.length)
		return null;

	return val;
};

/*
	Convert value from base64 and save to file
	@filename {String}
	@callback {Function} :: optional
	return {String}
*/
String.prototype.base64ToFile = function(filename, callback) {
	var self = this;

	var index = self.indexOf(',');
	if (index === -1)
		index = 0;
	else
		index++;

	if (callback)
		fs.writeFile(filename, self.substring(index), 'base64', callback);
	else
		fs.writeFile(filename, self.substring(index), 'base64', exports.noop);

	return this;
};

String.prototype.base64ToBuffer = function() {
	var self = this;

	var index = self.indexOf(',');
	if (index === -1)
		index = 0;
	else
		index++;

	return new Buffer(self.substring(index), 'base64');
};

/*
	Get content type from base64
	return {String}
*/
String.prototype.base64ContentType = function() {
	var self = this;

	var index = self.indexOf(';');
	if (index === -1)
		return '';

	return self.substring(5, index);
};

String.prototype.removeDiacritics = function() {
	return exports.removeDiacritics(this);
};

/*
	Indent
	@max {Number}
	@c {String} : optional, default SPACE
	return {String}
*/
String.prototype.indent = function(max, c) {
	var self = this;
	return new Array(max + 1).join(c || ' ') + self;
};

/*
	isNumber?
	@isDecimal {Boolean} :: optional, default false
	return {Boolean}
*/
String.prototype.isNumber = function(isDecimal) {

	var self = this;
	var length = self.length;

	if (length === 0)
		return false;

	isDecimal = isDecimal || false;

	for (var i = 0; i < length; i++) {
		var ascii = self.charCodeAt(i);

		if (isDecimal) {
			if (ascii === 44 || ascii === 46) {
				isDecimal = false;
				continue;
			}
		}

		if (ascii < 48 || ascii > 57)
			return false;
	}

	return true;
};

/*
	@max {Number}
	@c {String} :: optional
	return {String}
*/

if (!String.prototype.padLeft) {
	String.prototype.padLeft = function(max, c) {
		var self = this;
		return new Array(Math.max(0, max - self.length + 1)).join(c || ' ') + self;
	};
}

/*
	@max {Number}
	@c {String} :: optional
	return {String}
*/
if (!String.prototype.padRight) {
	String.prototype.padRight = function(max, c) {
		var self = this;
		return self + new Array(Math.max(0, max - self.length + 1)).join(c || ' ');
	};
}

/*
	index {Number}
	value {String}
	return {String}
*/
String.prototype.insert = function(index, value) {
	var str = this;
	var a = str.substring(0, index);
	var b = value.toString() + str.substring(index);
	return a + b;
};

/*
	Prepare string for replacing double dollar
*/
String.prototype.dollar = function() {
	var str = this;
	var index = str.indexOf('$', 0);

	while (index !== -1) {
		if (str[index + 1] === '$')
			str = str.insert(index, '$');
		index = str.indexOf('$', index + 2);
	}
	return str.toString();
};

/**
 * Create a link from String
 * @param  {Number} max A maximum length, default: 60 and optional.
 * @return {String}
 */
String.prototype.slug = String.prototype.toSlug = String.prototype.toLinker = String.prototype.linker = function(max) {
	max = max || 60;

	var self = this.trim().toLowerCase().removeDiacritics();
	var builder = '';
	var length = self.length;

	for (var i = 0; i < length; i++) {
		var c = self[i];
		var code = self.charCodeAt(i);

		if (builder.length >= max)
			break;

		if (code > 31 && code < 48) {
			if (builder[builder.length - 1] === '-')
				continue;
			builder += '-';
			continue;
		}

		if (code > 47 && code < 58) {
			builder += c;
			continue;
		}

		if (code > 94 && code < 123) {
			builder += c;
			continue;
		}
	}
	var l = builder.length - 1;
	if (builder[l] === '-')
		return builder.substring(0, l);
	return builder;
};

String.prototype.link = function(max) {
	console.log('String.prototype.link: OBSOLETE - Use String.prototype.linker()');
	return this.linker(max);
};

String.prototype.pluralize = function(zero, one, few, other) {
	var str = this;
	return str.parseInt().pluralize(zero, one, few, other);
};

String.prototype.isBoolean = function() {
	var self = this.toLowerCase();
	return (self === 'true' || self === 'false') ? true : false;
};

String.prototype.capitalize = function() {
	return this[0].toUpperCase() + this.substring(1);
};

/**
 * Check if the string contains only letters and numbers.
 * @return {Boolean}
 */
String.prototype.isAlphaNumeric = function() {
  var regExp = /^[A-Za-z0-9]+$/;
  return (this.match(regExp) ? true : false);
};

/*
	@decimals {Number}
	return {Number}
*/
Number.prototype.floor = function(decimals) {
	return Math.floor(this * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/*
	@max {Number}
	@c {String} :: optional
	return {String}
*/
Number.prototype.padLeft = function(max, c) {
	return this.toString().padLeft(max, c || '0');
};

/*
	@max {Number}
	@c {String} :: optional
	return {String}
*/
Number.prototype.padRight = function(max, c) {
	return this.toString().padRight(max, c || '0');
};

/**
 * Format number
 * @param {Number} decimals Maximum decimal numbers
 * @param {String} separator Number separator, default ' '
 * @param {String} separatorDecimal Decimal separator, default '.' if number separator is ',' or ' '.
 * @return {String}
 */
Number.prototype.format = function(decimals, separator, separatorDecimal) {

	var self = this;

	if (typeof(decimals) === STRING)
		return self.format2(decimals);

	var num = self.toString();
	var dec = '';
	var output = '';
	var minus = num[0] === '-' ? '-' : '';
	if (minus)
		num = num.substring(1);

	var index = num.indexOf('.');

	if (typeof(decimals) === STRING) {
		var tmp = separator;
		separator = decimals;
		decimals = tmp;
	}

	if (separator === undefined)
		separator = ' ';

	if (index !== -1) {
		dec = num.substring(index + 1);
		num = num.substring(0, index);
	}

	index = -1;
	for (var i = num.length - 1; i >= 0; i--) {
		index++;
		if (index > 0 && index % 3 === 0)
			output = separator + output;
		output = num[i] + output;
	}

	if (decimals || dec.length) {
		if (dec.length > decimals)
			dec = dec.substring(0, decimals);
		else
			dec = dec.padRight(decimals, '0');
	}

	if (dec.length && separatorDecimal === undefined)
		separatorDecimal = separator === '.' ? ',' : '.';

	return minus + output + (dec.length ? separatorDecimal + dec : '');
};

Number.prototype.add = function(value, decimals) {

	if (value === undefined || value === null)
		return this;

	if (typeof(value) === NUMBER)
		return this + value;

	var first = value.charCodeAt(0);
	var is = false;

	if (first < 48 || first > 57) {
		is = true;
		value = value.substring(1);
	}

	var length = value.length;
	var isPercentage = false;
	var num;

	if (value[length - 1] === '%') {
		value = value.substring(0, length - 1);
		isPercentage = true;

		if (is) {
			var tmp = ((value.parseFloat() / 100) + 1);

			switch (first) {
				case 42:
					num = this * (this * tmp);
					break;
				case 43:
					num = this * tmp;
					break;
				case 45:
					num = this / tmp;
					break;
				case 47:
					num = this / (this / tmp);
					break;
			}
			return decimals !== undefined ? num.floor(decimals) : num;
		} else {
			num = (this / 100) * value.parseFloat();
			return decimals !== undefined ? num.floor(decimals) : num;
		}

	} else
		num = value.parseFloat();

	switch (first) {
		case 42:
			num = this * num;
			break;
		case 43:
			num = this + num;
			break;
		case 45:
			num = this - num;
			break;
		case 47:
			num = this / num;
			break;
		case 47:
			num = this / num;
			break;
		default:
			num = this;
			break;
	}

	if (decimals !== undefined)
		return num.floor(decimals);

	return num;
};

/*
	Format number :: 10000 = 10 000
	@format {Number or String} :: number is decimal and string is specified format, example: ## ###.##
	return {String}
*/
Number.prototype.format2 = function(format) {
	var index = 0;
	var num = this.toString();
	var beg = 0;
	var end = 0;
	var max = 0;
	var output = '';
	var length = 0;

	if (typeof(format) === STRING) {

		var d = false;
		length = format.length;

		for (var i = 0; i < length; i++) {
			var c = format[i];
			if (c === '#') {
				if (d)
					end++;
				else
					beg++;
			}

			if (c === '.')
				d = true;
		}

		var strBeg = num;
		var strEnd = '';

		index = num.indexOf('.');

		if (index !== -1) {
			strBeg = num.substring(0, index);
			strEnd = num.substring(index + 1);
		}

		if (strBeg.length > beg) {
			max = strBeg.length - beg;
			var tmp = '';
			for (var i = 0; i < max; i++)
				tmp += '#';

			format = tmp + format;
		}

		if (strBeg.length < beg)
			strBeg = strBeg.padLeft(beg, ' ');

		if (strEnd.length < end)
			strEnd = strEnd.padRight(end, '0');

		if (strEnd.length > end)
			strEnd = strEnd.substring(0, end);

		d = false;
		index = 0;

		var skip = true;
		length = format.length;

		for (var i = 0; i < length; i++) {

			var c = format[i];

			if (c !== '#') {

				if (skip)
					continue;

				if (c === '.') {
					d = true;
					index = 0;
				}

				output += c;
				continue;
			}

			var value = d ? strEnd[index] : strBeg[index];

			if (skip)
				skip = [',', ' '].indexOf(value) !== -1;

			if (!skip)
				output += value;

			index++;
		}

		return output;
	}

	output = '### ### ###';
	beg = num.indexOf('.');
	max = format || 0;

	if (max === 0 && beg !== -1)
		max = num.length - (beg + 1);

	if (max > 0) {
		output += '.';
		for (var i = 0; i < max; i++)
			output += '#';
	}

	return this.format(output);
};

/*
	Pluralize number
	zero {String}
	one {String}
	few {String}
	other {String}
	return {String}
*/
Number.prototype.pluralize = function(zero, one, few, other) {

	var num = this;
	var value = '';

	if (num == 0)
		value = zero || '';
	else if (num == 1)
		value = one || '';
	else if (num > 1 && num < 5)
		value = few || '';
	else
		value = other;

	var beg = value.indexOf('#');
	if (beg === -1)
		return value;

	var end = value.lastIndexOf('#');
	var format = value.substring(beg, end + 1);
	return num.format(format) + value.replace(format, '');
};

/*
	@length {Number}
	return {String}
*/
Number.prototype.hex = function(length) {
	var str = this.toString(16).toUpperCase();
	while(str.length < length)
		str = '0' + str;
	return str;
};

/*
	VAT
	@percentage {Number}
	@decimals {Number}, optional, default 2,
	@includedVAT {Boolean}, optional, default true
	return {Number}
*/
Number.prototype.VAT = function(percentage, decimals, includedVAT) {
	var num = this;
	var type = typeof(decimals);

	if (type === BOOLEAN) {
		var tmp = includedVAT;
		includedVAT = decimals;
		decimals = tmp;
		type = typeof(decimals);
	}

	if (type === UNDEFINED)
		decimals = 2;

	if (includedVAT === undefined)
		includedVAT = true;

	if (percentage === 0 || num === 0)
		return num;

	return includedVAT ? (num / ((percentage / 100) + 1)).floor(decimals) : (num * ((percentage / 100) + 1)).floor(decimals);
};

/*
	Discount
	@percentage {Number}
	@decimals {Number}, optional, default 2
	return {Number}
*/
Number.prototype.discount = function(percentage, decimals) {
	var num = this;

	if (decimals === undefined)
		decimals = 2;

	return (num - (num / 100) * percentage).floor(decimals);
};

Number.prototype.parseDate = function(plus) {
	return new Date(this + (plus || 0));
};

if (typeof (Number.prototype.toRad) === UNDEFINED) {
	Number.prototype.toRad = function () {
		return this * Math.PI / 180;
	};
}

/**
 * Take items from array
 * @param {Number} count
 * @return {Array}
 */
Array.prototype.take = function(count) {
	var arr = [];
	var self = this;
	var length = self.length;
	for (var i = 0; i < length; i++) {
		arr.push(self[i]);
		if (arr.length >= count)
			return arr;
	}
	return arr;
};

/**
 * Extend objects in Array
 * @param {Object} obj
 * @param {Boolean} rewrite Default: false.
 * @return {Array} Returns self
 */
Array.prototype.extend = function(obj, rewrite) {
	var isFn = typeof(obj) === FUNCTION;
	for (var i = 0, length = this.length; i < length; i++) {

		if (isFn) {
			this[i] = obj(this[i], i);
			continue;
		}

		this[i] = exports.extend(this[i], obj, rewrite);
	}
	return this;
};

/**
 * First item in array
 * @param {Object} def Default value.
 * @return {Object}
 */
Array.prototype.first = function(def) {
	var item = this[0];
	return item === undefined ? def : item;
};

/**
 * Create object from Array
 * @param {String} name Optional, property name.
 * @return {Object}
 */
Array.prototype.toObject = function(name) {

	var self = this;
	var obj = {};

	for (var i = 0, length = self.length; i < length; i++) {
		var item = self[i];
		if (name)
			obj[item[name]] = item;
		else
			obj[item] = true;
	}

	return obj;
};

/**
 * Compare two arrays
 * @param {String} id An identificator.
 * @param {Array} b Second array.
 * @param {Function(itemA, itemB, indexA, indexB)} executor
 */
Array.prototype.compare = function(id, b, executor) {

	var a = this;
	var ak = {};
	var bk = {};
	var al = a.length;
	var bl = b.length;
	var tl = Math.max(al, bl);
	var processed = {};

	for (var i = 0; i < tl; i++) {
		var av = a[i];
		if (av)
			ak[av[id]] = i;
		var bv = b[i];
		if (bv)
			bk[bv[id]] = i;
	}

	var index = -1;

	for (var i = 0; i < tl; i++) {

		var av = a[i];
		var bv = b[i];
		var akk;
		var bkk;

		if (av) {
			akk = av[id];
			if (processed[akk])
				continue;
			processed[akk] = true;
			index = bk[akk];
			if (index === undefined)
				executor(av, undefined, i, -1);
			else
				executor(av, b[index], i, index);
		}

		if (bv) {
			bkk = bv[id];
			if (processed[bkk])
				continue;
			processed[bkk] = true;
			index = ak[bkk];
			if (index === undefined)
				executor(undefined, bv, -1, i);
			else
				executor(a[index], bv, index, i);
		}
	}
};

/**
 * Pair arrays
 * @param {Array} arr
 * @param {String} property
 * @param {Function(itemA, itemB)} fn Paired items (itemA == this, itemB == arr)
 * @param {Boolean} remove Optional, remove item from this array if the item doesn't exist int arr (default: false).
 * @return {Array}
 */
Array.prototype.pair = function(property, arr, fn, remove) {

	if (property instanceof Array) {
		var tmp = property;
		property = arr;
		arr = tmp;
	}

	if (!arr)
		arr = new Array(0);

	var length = arr.length;
	var index = 0;

	while (true) {
		var item = this[index++];
		if (!item)
			break;

		var is = false;

		for (var i = 0; i < length; i++) {
			if (item[property] !== arr[i][property])
				continue;
			fn(item, arr[i]);
			is = true;
			break;
		}

		if (is || !remove)
			continue;

		index--;
		this.splice(index, 1);
	}

	return this;
};

/**
 * Last item in array
 * @param {Object} def Default value.
 * @return {Object}
 */
Array.prototype.last = function(def) {
	var item = this[this.length - 1];
	return item === undefined ? def : item;
};

/**
 * Array object sorting
 * @param {String} name Property name.
 * @param {Booelan} asc
 * @return {Array}
 */
Array.prototype.orderBy = function(name, asc) {

	if (typeof(name) === BOOLEAN) {
		var tmp = asc;
		asc = name;
		name = tmp;
	}

	if (asc === undefined)
		asc = true;

	var self = this;
	var type = 0;
	var path = (name || '').split('.');
	var length = path.length;

	self.sort(function(a, b) {

		var va = null;
		var vb = null;

		switch (length) {
			case 1:

				if (path[0] === '') {
					va = a;
					vb = b;
				} else {
					va = a[path[0]];
					vb = b[path[0]];
				}

				break;
			case 2:
				va = a[path[0]][path[1]];
				vb = b[path[0]][path[1]];
				break;
			case 3:
				va = a[path[0]][path[1]][path[2]];
				vb = b[path[0]][path[1]][path[2]];
				break;
			case 4:
				va = a[path[0]][path[1]][path[2]][path[3]];
				vb = b[path[0]][path[1]][path[2]][path[3]];
				break;
			case 5:
				va = a[path[0]][path[1]][path[2]][path[3]][path[4]];
				vb = b[path[0]][path[1]][path[2]][path[3]][path[4]];
				break;
			default:
				return 0;
		}

		if (type === 0) {
			var t = typeof(va);
			if (t === STRING)
				type = 1;
			else if (t === NUMBER)
				type = 2;
			else if (t === BOOLEAN)
				type = 3;
			else
				type = 4;
		}

		// String
		if (type === 1)
			return asc ? va.removeDiacritics().localeCompare(vb.removeDiacritics()) : vb.removeDiacritics().localeCompare(va.removeDiacritics());

		if (type === 2) {

			if (va > vb)
				return asc ? 1 : -1;

			if (va < vb)
				return asc ? -1 : 1;

			return 0;
		}

		if (type === 3) {
			if (va === true && vb === false)
				return asc ? 1 : -1;
			if (va === false && vb === true)
				return asc ? -1 : 1;
			return 0;
		}

		return 0;

	});

	return self;
};

/*
	Trim values
*/
Array.prototype.trim = function() {
	var self = this;
	var output = [];
	for (var i = 0, length = self.length; i < length; i++) {
		if (typeof(self[i]) === STRING)
			self[i] = self[i].trim();
		if (self[i])
			output.push(self[i]);
	}
	return output;
};

/**
 * Skip items from array
 * @param {Number} count
 * @return {Array}
 */
Array.prototype.skip = function(count) {
	var arr = [];
	var self = this;
	var length = self.length;
	for (var i = 0; i < length; i++) {
		if (i >= count)
			arr.push(self[i]);
	}
	return arr;
};

/**
 * Find items in Array
 * @param {Function(item, index) or String/Object} cb
 * @param {Object} value Optional.
 * @return {Array}
 */
Array.prototype.where = function(cb, value) {

	var self = this;
	var selected = [];
	var isFN = typeof(cb) === 'function';
	var isV = value !== undefined;

	for (var i = 0, length = self.length; i < length; i++) {

		if (isFN) {
			if (cb.call(self, self[i], i))
				selected.push(self[i]);
			continue;
		}

		if (isV) {
			if (self[i][cb] === value)
				selected.push(self[i]);
			continue;
		}

		if (self[i] === cb)
			selected.push(self[i]);
	}

	return selected;
};

/**
 * Find item in Array
 * @param {Function(item, index) or String/Object} cb
 * @param {Object} value Optional.
 * @return {Array}
 */
Array.prototype.find = function(cb, value) {
	var self = this;
	var index = self.findIndex(cb, value);
	if (index === -1)
		return null;
	return self[index];
};

Array.prototype.findIndex = function(cb, value) {

	var self = this;
	var isFN = typeof(cb) === FUNCTION;
	var isV = value !== undefined;

	for (var i = 0, length = self.length; i < length; i++) {

		if (isFN) {
			if (cb.call(self, self[i], i))
				return i;
			continue;
		}

		if (isV) {
			if (self[i][cb] === value)
				return i;
			continue;
		}

		if (self[i] === cb)
			return i;
	}

	return -1;
};

/**
 * Remove items from Array
 * @param {Function(item, index) or Object} cb
 * @param {Object} value Optional.
 * @return {Array}
 */
Array.prototype.remove = function(cb, value) {

	var self = this;
	var arr = [];
	var isFN = typeof(cb) === 'function';
	var isV = value !== undefined;

	for (var i = 0, length = self.length; i < length; i++) {

		if (isFN) {
			if (!cb.call(self, self[i], i))
				arr.push(self[i]);
			continue;
		}

		if (isV) {
			if (self[i][cb] !== value)
				arr.push(self[i]);
			continue;
		}

		if (self[i] !== cb)
			arr.push(self[i]);
	}
	return arr;
};

/*
	Random return item from array
	Return {Object}
*/
Array.prototype.random = function() {
	var self = this;
	return self[exports.random(self.length - 1)];
};

/*
	Waiting list - function remove each item
	@callback {Function} :: function(next) {}
	@complete {Function} :: optional
*/
Array.prototype.waiting = function(onItem, callback) {
	console.log('Array.prototype.waiting: OBSOLETE. Use Array.prototype.wait');
	return this.wait(onItem, callback);
};

/*
	Waiting list - function remove each item
	@callback {Function} :: function(next) {}
	@complete {Function} :: optional
*/
Array.prototype.wait = Array.prototype.each = function(onItem, callback, remove) {

	var self = this;
	var type = typeof(callback);

	if (type === NUMBER || type === BOOLEAN) {
		var tmp = remove;
		remove = callback;
		callback = tmp;
	}

	if (remove === undefined)
		remove = 0;

	var item = remove === true ? self.shift() : self[remove];

	if (item === undefined) {
		if (callback)
			callback();
		return self;
	}

	onItem.call(self, item, function() {
		setImmediate(function() {
			if (typeof(remove) === NUMBER)
				remove++;
			self.wait(onItem, callback, remove);
		});
	});

	return self;
};

/**
 * Creates a function async list
 * @param {Function} callback Optional
 * @return {Array}
 */
Array.prototype.async = function(callback) {

	var self = this;
	var item = self.shift();

	if (item === undefined) {
		if (callback)
			callback();
		return self;
	}

	item(function() {
		setImmediate(function() {
			self.async(callback);
		});
	});

	return self;
};

/**
 * Create async loop for middleware
 * @param {Response} res
 * @param {Function} callback
 * @param {Controller} controller Current controller if exists, optional.
 * @return {Array}
 */
Array.prototype._async_middleware = function(res, callback, controller) {

	var self = this;

	if (res.success || res.headersSent) {

		res.$middleware = null; // clear next function (memoryleak prevention)
		self.length = 0; // clear middlewares

		// Prevent timeout
		if (controller)
			controller.subscribe.success();

		callback = null;
		return self;
	}

	var item = self.shift();

	if (!item) {
		if (callback)
			callback();
		return self;
	}

	res.$middleware = function() {
		self._async_middleware(res, callback);
	};

	var output = item(function(err) {

		if (err) {
			res.$middleware = false;
			res.throw500(err);
			callback = null;
			self.length = 0;
			return;
		}

		setImmediate(res.$middleware);
	});

	if (output !== false)
		return self;

	res.$middleware = null;
	callback = null;
	self.length = 0;
	return self;
};

/*
	Randomize array
	Return {Array}
*/
Array.prototype.randomize = function() {

	var self = this;
	var random = (Math.floor(Math.random() * 100000000) * 10).toString();
	var index = 0;
	var old = 0;

	self.sort(function(a, b) {

		var c = random[index++];

		if (c === undefined) {
			c = random[0];
			index = 0;
		}

		if (old > c) {
			old = c;
			return -1;
		}

		if (old === c) {
			old = c;
			return 0;
		}

		old = c;
		return 1;
	});

	return self;
};

Array.prototype.limit = function(max, fn, callback, index) {

	if (index === undefined)
		index = 0;

	var current = [];
	var self = this;
	var length = index + max;

	for (var i = index; i < length; i++) {
		var item = self[i];

		if (item !== undefined) {
			current.push(item);
			continue;
		}

		if (current.length === 0) {
			if (callback)
				callback();
			return self;
		}

		fn(current, function() {
			if (callback)
				callback();
		}, index, index + max);

		return self;
	}

	if (current.length === 0) {
		if (callback)
			callback();
		return self;
	}

	fn(current, function() {

		if (length < self.length) {
			self.limit(max, fn, callback, length);
			return;
		}

		if (callback)
			callback();
	}, index, index + max);

	return self;
};

/**
 * Get unique elements from Array
 * @return {[type]} [description]
 */
Array.prototype.unique = function(property) {

	var self = this;
	var result = [];
	var sublength = 0;

	for (var i = 0, length = self.length; i < length; i++) {
		var value = self[i];

		if (!property) {
			if (result.indexOf(value) === -1)
				result.push(value);
			continue;
		}

		if (sublength === 0) {
			result.push(value);
			sublength++;
			continue;
		}

		var is = true;
		for (var j = 0; j < sublength; j++) {
			if (result[j][property] === value[property]) {
				is = false;
				break;
			}
		}

		if (is) {
			result.push(value);
			sublength++;
		}
	}

	return result;
};

/*
	Async class
*/
function AsyncTask(owner, name, fn, cb, waiting) {
	this.isRunning = 0;
	this.owner = owner;
	this.name = name;
	this.fn = fn;
	this.cb = cb;
	this.waiting = waiting;
	this.interval = null;
	this.isCanceled = false;
}

AsyncTask.prototype.run = function() {
	var self = this;
	try
	{

		if (self.isCanceled) {
			self.complete();
			return self;
		}

		self.isRunning = 1;
		self.owner.tasksWaiting[self.name] = true;
		self.owner.emit('begin', self.name);

		var timeout = self.owner.tasksTimeout[self.name];
		if (timeout > 0)
			self.interval = setTimeout(function() { self.timeout(); }, timeout);

		self.fn(function() {
			setImmediate(function() {
				self.complete();
			});
		});

	} catch (ex) {
		self.owner.emit('error', self.name, ex);
		self.complete();
	}
	return self;
};

AsyncTask.prototype.timeout = function(timeout) {

	var self = this;

	if (timeout > 0) {
		clearTimeout(self.interval);
		setTimeout(function() { self.timeout(); }, timeout);
		return self;
	}

	if (timeout <= 0) {
		clearTimeout(self.interval);
		setTimeout(function() { self.timeout(); }, timeout);
		return self;
	}

	setImmediate(function() {
		self.cancel(true);
	});
	return self;
};

AsyncTask.prototype.cancel = function(isTimeout) {
	var self = this;

	self.isCanceled = true;

	if (isTimeout)
		self.owner.emit('timeout', self.name);
	else
		self.owner.emit('cancel', self.name);

	self.fn = null;
	self.cb = null;
	self.complete();
	return self;
};

AsyncTask.prototype.complete = function() {

	var item = this;
	var self = item.owner;

	item.isRunning = 2;

	delete self.tasksPending[item.name];
	delete self.tasksWaiting[item.name];

	if (!item.isCanceled) {
		try
		{
			self.emit('end', item.name);

			if (item.cb)
				item.cb();

		} catch (ex) {
			self.emit('error', ex, item.name);
		}
	}

	setImmediate(function() {
		self.reload();
		self.refresh();
	});

	return self;
};

function Async(owner) {

	this._max = 0;
	this._count = 0;
	this._isRunning = false;
	this._isEnd = false;

	this.owner = owner;
	this.onComplete = [];

	this.tasksPending = {};
	this.tasksWaiting = {};
	this.tasksAll = [];
	this.tasksTimeout = {};
	this.isCanceled = false;

	events.EventEmitter.call(this);
}

Async.prototype = {
	get count() {
		return this._count;
	},

	get percentage() {
		var self = this;
		var p = 100 - Math.floor((self._count * 100) / self._max);
		if (!p)
			return 0;
		return p;
	}
};

Async.prototype.__proto__ = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: Async,
		enumberable: false
	}
});

Async.prototype.reload = function() {
	var self = this;
	self.tasksAll = Object.keys(self.tasksPending);
	self.emit('percentage', self.percentage);
	return self;
};

Async.prototype.cancel = function(name) {

	var self = this;

	if (name === undefined) {
		self.isCanceled = true;
		for (var i = 0; i < self._count; i++)
			self.cancel(self.tasksAll[i]);
		return true;
	}

	var task = self.tasksPending[name];
	if (!task)
		return false;

	delete self.tasksPending[name];
	delete self.tasksWaiting[name];

	task.cancel();
	task = null;
	self.reload();
	self.refresh();

	return true;
};

Async.prototype.await = function(name, fn, cb) {

	var self = this;

	if (self.isCanceled)
		return false;

	if (typeof(name) === FUNCTION) {
		cb = fn;
		fn = name;
		name = exports.GUID(6);
	}

	if (self.tasksPending[name] !== undefined)
		return false;

	self.tasksPending[name] = new AsyncTask(self, name, fn, cb, null);
	self._max++;
	self.reload();
	self.refresh();
	return true;
};

Async.prototype.wait = function(name, waitingFor, fn, cb) {

	var self = this;

	if (self.isCanceled)
		return false;

	if (typeof(waitingFor) === FUNCTION) {
		cb = fn;
		fn = waitingFor;
		waitingFor = null;
	}

	if (self.tasksPending[name] !== undefined)
		return false;

	self.tasksPending[name] = new AsyncTask(self, name, fn, cb, waitingFor);
	self._max++;
	self.reload();
	self.refresh();
	return true;
};

Async.prototype.complete = function(fn) {
	return this.run(fn);
};

Async.prototype.run = function(fn) {
	var self = this;
	self._isRunning = true;

	if (fn)
		self.onComplete.push(fn);

	self.refresh();
	return self;
};

Async.prototype.isRunning = function(name) {

	var self = this;

	if (!name)
		return self._isRunning;

	var task = self.tasksPending[name];
	if (!task)
		return false;

	return task.isRunning === 1;
};

Async.prototype.isWaiting = function(name) {
	var self = this;

	var task = self.tasksPending[name];
	if (!task)
		return false;

	return task.isRunning === 0;
};

Async.prototype.isPending = function(name) {
	var self = this;
	var task = self.tasksPending[name];
	if (!task)
		return false;
	return true;
};

Async.prototype.timeout = function(name, timeout) {

	var self = this;

	if (timeout <= 0 || timeout === undefined) {
		delete self.tasksTimeout[name];
		return self;
	}

	self.tasksTimeout[name] = timeout;
	return self;
};

Async.prototype.refresh = function(name) {

	var self = this;

	if (!self._isRunning || self._isEnd)
		return self;

	self._count = self.tasksAll.length;
	var index = 0;

	while (true) {
		var name = self.tasksAll[index++];
		if (name === undefined)
			break;

		var task = self.tasksPending[name];
		if (task === undefined)
			break;

		if (self.isCanceled || task.isCanceled) {
			delete self.tasksPending[name];
			delete self.tasksWaiting[name];
			self.tasksAll.splice(index, 1);
			self._count = self.tasksAll.length;
			index--;
			continue;
		}

		if (task.isRunning !== 0)
			continue;

		if (task.waiting && self.tasksPending[task.waiting])
			continue;

		task.run();
	}

	if (self._count === 0) {
		self._isRunning = false;
		self._isEnd = true;
		self.emit('complete');
		self.emit('percentage', 100);
		self._max = 0;
		var complete = self.onComplete;
		var length = complete.length;
		self.onComplete = [];
		for (var i = 0; i < length; i++) {
			try
			{
				complete[i]();
			} catch (ex) {
				self.emit('error', ex);
			}
		}
		setImmediate(function() {
			self._isEnd = false;
		});
	}

	return self;
};

function FileList() {
	this.pending = [];
	this.pendingDirectory = [];
	this.directory = [];
	this.file = [];
	this.onComplete = null;
	this.onFilter = null;
}

FileList.prototype.reset = function() {
	var self = this;
	self.file = [];
	self.directory = [];
	self.pendingDirectory = [];
};

FileList.prototype.walk = function(directory) {

	var self = this;

	if (directory instanceof Array) {
		var length = directory.length;

		for (var i = 0; i < length; i++)
			self.pendingDirectory.push(directory[i]);

		self.next();
		return;
	}

	fs.readdir(directory, function(err, arr) {

		if (err)
			return self.next();

		var length = arr.length;
		for (var i = 0; i < length; i++)
			self.pending.push(path.join(directory, arr[i]));

		self.next();
	});
};

FileList.prototype.stat = function(path) {
	var self = this;

	fs.stat(path, function(err, stats) {

		if (err)
			return self.next();

		if (stats.isDirectory() && (self.onFilter === null || self.onFilter(path, true))) {
			self.directory.push(path);
			self.pendingDirectory.push(path);
			self.next();
			return;
		}

		if (self.onFilter === null || self.onFilter(path, false))
			self.file.push(path);

		self.next();
	});
};

FileList.prototype.next = function() {
	var self = this;

	if (self.pending.length) {
		var item = self.pending.shift();
		self.stat(item);
		return;
	}

	if (self.pendingDirectory.length) {
		var directory = self.pendingDirectory.shift();
		self.walk(directory);
		return;
	}

	self.onComplete(self.file, self.directory);
};

exports.Async = Async;

exports.sync = function(fn, owner) {
	return function() {

		var args = [].slice.call(arguments);
		var params;
		var callback;
		var executed = false;
		var self = owner || this;

		args.push(function() {
			params = arguments;
			if (!executed && callback) {
				executed = true;
				callback.apply(self, params);
			}
		});

		fn.apply(self, args);

		return function(cb) {
			callback = cb;
			if (!executed && params) {
				executed = true;
				callback.apply(self, params);
			}
		};
	};
};

exports.sync2 = function(fn, owner) {
	(function() {

		var params;
		var callback;
		var executed = false;
		var self = owner || this;
		var args = [].slice.call(arguments);

		args.push(function() {
			params = arguments;
			if (!executed && callback) {
				executed = true;
				callback.apply(self, params);
			}
		});

		fn.apply(self, args);

		return function(cb) {
			callback = cb;
			if (!executed && params) {
				executed = true;
				callback.apply(self, params);
			}
		};
	})();
};

exports.async = function(fn, isApply) {
	var context = this;
	return function(complete) {

		var self = this;
		var argv;

		if (arguments.length) {

			if (isApply) {
				// index.js/Subscribe.prototype.doExecute
				argv = arguments[1];
			} else {
				argv = [];
				for (var i = 1; i < arguments.length; i++)
					argv.push(arguments[i]);
			}
		} else
			argv = new Array(0);

		var generator = fn.apply(context, argv);
		next(null);

		function next(err, result) {

			var g;

			try
			{
				var can = err === null || err === undefined;
				switch (can) {
					case true:
						g = generator.next(result);
						break;
					case false:
						g = generator.throw(err);
						break;
				}
			} catch (e) {

				if (!complete)
					return;

				if (typeof(complete) === OBJECT && complete.isController) {
					if (e instanceof ErrorBuilder)
						complete.content(e);
					else
						complete.view500(e);
					return;
				}

				setImmediate(function() {
					complete(e);
				});

				return;
			}

			if (g.done) {
				if (complete && typeof(complete) !== OBJECT)
					complete(null, g.value);
				return;
			}

			if (typeof(g.value) !== FUNCTION) {
				next.call(self, null, g.value);
				return;
			}

			try
			{
				g.value.call(self, function() {
					next.apply(self, arguments);
				});
			} catch (e) {
				setImmediate(function() {
					next.call(self, e);
				});
			}
		}

		return generator.value;
	};
};

// MIT
// Written by Jozef Gula
exports.getMessageLength = function(data, isLE) {

	var length = data[1] & 0x7f;

	if (length === 126) {
		if (data.length < 4)
			return -1;
		return converBytesToInt64([data[3], data[2], 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0, isLE);
	}

	if (length === 127) {
		if (data.Length < 10)
			return -1;
		return converBytesToInt64([data[9], data[8], data[7], data[6], data[5], data[4], data[3], data[2]], 0, isLE);
	}

	return length;
};

// MIT
// Written by Jozef Gula
function converBytesToInt64(data, startIndex, isLE) {
	if (isLE)
		return (data[startIndex] | (data[startIndex + 1] << 0x08) | (data[startIndex + 2] << 0x10) | (data[startIndex + 3] << 0x18) | (data[startIndex + 4] << 0x20) | (data[startIndex + 5] << 0x28) | (data[startIndex + 6] << 0x30) | (data[startIndex + 7] << 0x38));
	return ((data[startIndex + 7] << 0x20) | (data[startIndex + 6] << 0x28) | (data[startIndex + 5] << 0x30) | (data[startIndex + 4] << 0x38) | (data[startIndex + 3]) | (data[startIndex + 2] << 0x08) | (data[startIndex + 1] << 0x10) | (data[startIndex] << 0x18));
}

exports.queuecache = {};

function queue_next(name) {

	var item = exports.queuecache[name];
	if (!item)
		return;

	item.running--;
	if (item.running < 0)
		item.running = 0;

	if (item.pending.length === 0)
		return;

	var fn = item.pending.shift();
	if (!fn) {
		item.running = 0;
		return;
	}

	item.running++;
	(function(name){
		setImmediate(function() {
			fn(function() {
				queue_next(name);
			});
		});
	})(name);
}

/**
 * Queue list
 * @param {String} name
 * @param {Number} max Maximum stack.
 * @param {Function(next)} fn
 */
exports.queue = function(name, max, fn) {

	if (!fn)
		return false;

	if (!max) {
		fn(NOOP);
		return true;
	}

	if (exports.queuecache[name] === undefined)
		exports.queuecache[name] = { limit: max, running: 0, pending: [] };

	var item = exports.queuecache[name];
	if (item.running >= item.limit) {
		item.pending.push(fn);
		return false;
	}

	item.running++;
	(function(name){
		setImmediate(function() {
			fn(function() {
				queue_next(name);
			});
		});
	})(name);

	return true;
};

exports.minifyStyle = function(value) {
	return require('./internal').compile_css(value);
};

exports.minifyScript = function(value) {
	return require('./internal').compile_javascript(value);
};

exports.minifyHTML = function(value) {
	return require('./internal').compile_html(value);
};

global.Async = global.async = exports.async;
global.sync = global.SYNCHRONIZE = exports.sync;
global.sync2 = exports.sync2;