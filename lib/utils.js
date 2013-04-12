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

var urlParser = require('url');
var http = require('http');
var https = require('https');
var util = require('util');
var path = require('path');
var fs = require('fs');
var builders = require('./builders');
var crypto = require('crypto');
var regexpMail = RegExp('^[a-zA-Z0-9-_.]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$');
var regexpUrl = new RegExp('^(http[s]?:\\/\\/(www\\.)?|ftp:\\/\\/(www\\.)?|www\\.){1}([0-9A-Za-z-\\.@:%_\+~#=]+)+((\\.[a-zA-Z]{2,3})+)(/(.)*)?(\\?(.)*)?');

if (typeof(setImmediate) === 'undefined') {
	setImmediate = function(cb) {
		process.nextTick(cb);
	};
}

/*
	Expression declaration
	@query {String}
	@params {String Array}
	@values {Object Array}
	return {Function}
*/
function expression(query, params) {
	var name = params.join(',');
	var fn = eval('(function(' + name +'){' + (query.indexOf('return') === -1 ? 'return ' : '') + query + '})');

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

require('./prototypes');
global.expression = expression;

/*	
	Send request to URL
	@url {String}
	@method {String}
    @data {String}
    @callback {Function} :: function(error, data, statusCode, headers)
    @headers {Object} :: optional, default {}
    @encoding {String} :: optional, default utf8
    @timeout {Number} :: optional, default 10000
*/
exports.request = function(url, method, data, callback, headers, encoding, timeout) {

	var uri = urlParser.parse(url);
	var h = {};
	var isJSON = typeof(data) === 'object';

	method = (method || '').toString().toUpperCase();

	if (method !== 'GET')
		h['Content-Type'] = 'application/x-www-form-urlencoded';

	if (isJSON)
		h['Content-Type'] = 'application/json';
	
	util._extend(h, headers);

	var options = { protocol: uri.protocol, auth: uri.auth, method: method, hostname: uri.hostname, port: uri.port, path: uri.pathname, agent: false, headers: h };

	var response = function(res) {
		var buffer = '';

		res.on('data', function(chunk) {
			buffer += chunk.toString('utf8');
		});

		res.on('end', function() {
			callback(null, buffer, res.statusCode, res.headers);
		});

		res.resume();
	};

	var con = options.protocol === 'https:' ? https : http;

	try
	{

		var isPOST = method === 'POST' || method === 'PUT';
		var req = isPOST ? callback ? con.request(options, response) : con.request(options) : callback ? con.get(options, response) : con.get(options);

		req.on('error', function(error) {
	  		callback(error, null, {});
		});

		req.setTimeout(timeout || 10000, function() {
			callback(408, null, {});
		});

		if (isPOST)
			req.end(isJSON ? JSON.stringify(data) : (data || '').toString(), encoding || 'utf8');

	} catch (ex) {
		callback(new Error(ex), null, 0, {});
	}
};

/*
	TRIM string properties
	@obj {Object}
	return {Object}
*/
exports.trim = function(obj) {

	var type = typeof(obj);
	
	if (type === 'string')
		return obj.trim();

	if (type !== 'object')
		return obj;

	Object.keys(obj).forEach(function(name) {
		var val = obj[name];
		
		if (typeof(val) === 'object') {
			exports.trim(val);
			return;
		}

		if (typeof(val) !== 'string')
			return;

		obj[name] = val.trim();
	});

	return obj;
};

/*
	Empty function
*/
exports.noop = function() {}

/*
	Extend object
	@source {Object}
	@add {Object}
	@rewrite {Boolean} :: option, default false
	return {Object}
*/
exports.extend = function(source, add, rewrite) {
	
	if (source === null || add === null)
		return source;

	if (typeof(source) !== 'object' || typeof(add) !== 'object')
		return source;

	var keys = Object.keys(add);
	var i = keys.length;

	while (i--) {

		var key = keys[i];

		if (rewrite) {
			source[key] = add[key];
			continue;
		}

		if (typeof(source[key]) !== 'undefined')
			continue;

		source[key] = add[key];
	}
	
	return source;
};

/*
	Reduce object properties
	@source {Object}
	@prop {String array or Object} :: property name
	return @source
*/
exports.reduce = function(source, prop) {

	if (source === null || prop === null)
		return source;

	var type = typeof(prop);
	
	if (type === 'array') {
		Object.keys(source).forEach(function(o) {
			if (prop.indexOf(o) === -1)
				delete source[o];
		});
	}

	if (type === 'object') {
		var obj = Object.keys(prop);
		Object.keys(source).forEach(function(o) {
			if (obj.indexOf(o) === -1)
				delete source[o];
		});
	}

	return source;
};

/*
	Is relative URL?
	@url {String}
	return {Boolean}
*/
exports.isRelative = function(url) {
	return !(url.substring(0, 2) === '//' || url.indexOf('http://') !== -1 || url.indexOf('https://') !== -1);
};

/*
	Encode HTML
	@str {String}
	return {String}
*/
exports.htmlEncode = function(str) {

	var type = typeof(str);

	if (type === 'undefined')
		return '';

	if (type !== 'string')
		str = str.toString();

	return str.htmlEncode();
};

/*
	Decode HTML
	@str {String}
	return {String}
*/
exports.htmlDecode = function(str) {

	var type = typeof(str);

	if (type === 'undefined')
		return '';

	if (type !== 'string')
		str = str.toString();

	return str.htmlDecode();
};

/*
	Is static file?
	@url {String}
	return {Boolean}
*/
exports.isStaticFile = function(url) {
	var pattern = /\.\w{2,5}($|\?)+/g;
	return pattern.test(url);
};

/*
	load content from file
	@fileName {String}
	@cb {function}
	@def {String}
*/
exports.loadFromFile = function(fileName, cb, def) {
	if (fs.existsSync(fileName))
		cb(fs.readFileSync(fileName));
	else
		cb(def);
};

/*
	@str {String}
	return {Boolean}
*/
exports.isNullOrEmpty = function(str) {

	if (typeof(str) === 'undefined')
		return true;

	return str === null || str.length === 0;
};

/*
	parseInt
	@obj {Object}
	@def {Number}
	return {Number}
*/
exports.parseInt = function(obj, def) {
	var type = typeof(obj);
	
	if (type === 'undefined')
		return def || 0;

	var str = type !== 'string' ? obj.toString() : obj;
    return str.parseInt(def);
};

/*
	parseFloat
	@obj {Object}
	@def {Number}
	return {Number}
*/
exports.parseFloat = function(obj, def) {
	var type = typeof(obj);

	if (type === 'undefined')
		return def || 0;

	var str = type !== 'string' ? obj.toString() : obj;
    return str.parseFloat(def);
};

/*
	Is array?
	@obj {Object}
	return {Boolean}
*/
exports.isArray = function(obj) {
	return util.isArray(obj);
};

/*
	Is date?
	@obj {Object}
	return {Boolean}
*/
exports.isDate = function(obj) {
	return util.isDate(obj);
};

/*
	@str {String}
	return {String}
*/
exports.getContentType = function(ext) {
	
	if (ext[0] === '.')
		ext = ext.substring(1);

	var extension = {
		'ai': 'application/postscript',
		'aif': 'audio/x-aiff',
		'aifc': 'audio/x-aiff',
		'aiff': 'audio/x-aiff',
		'asc': 'text/plain',
		'atom': 'application/atom+xml',
		'au': 'audio/basic',
		'avi': 'video/x-msvideo',
		'bcpio': 'application/x-bcpio',
		'bin': 'application/octet-stream',
		'bmp': 'image/bmp',
		'cdf': 'application/x-netcdf',
		'cgm': 'image/cgm',
		'class': 'application/octet-stream',
		'cpio': 'application/x-cpio',
		'cpt': 'application/mac-compactpro',
		'csh': 'application/x-csh',
		'css': 'text/css',
		'dcr': 'application/x-director',
		'dif': 'video/x-dv',
		'dir': 'application/x-director',
		'djv': 'image/vnd.djvu',
		'djvu': 'image/vnd.djvu',
		'dll': 'application/octet-stream',
		'dmg': 'application/octet-stream',
		'dms': 'application/octet-stream',
		'doc': 'application/msword',
		'dtd': 'application/xml-dtd',
		'dv': 'video/x-dv',
		'dvi': 'application/x-dvi',
		'dxr': 'application/x-director',
		'eps': 'application/postscript',
		'etx': 'text/x-setext',
		'exe': 'application/octet-stream',
		'ez': 'application/andrew-inset',
		'gif': 'image/gif',
		'gram': 'application/srgs',
		'grxml': 'application/srgs+xml',
		'gtar': 'application/x-gtar',
		'hdf': 'application/x-hdf',
		'hqx': 'application/mac-binhex40',
		'htm': 'text/html',
		'html': 'text/html',
		'ice': 'x-conference/x-cooltalk',
		'ico': 'image/x-icon',
		'ics': 'text/calendar',
		'ief': 'image/ief',
		'ifb': 'text/calendar',
		'iges': 'model/iges',
		'igs': 'model/iges',
		'jnlp': 'application/x-java-jnlp-file',
		'jp2': 'image/jp2',
		'jpe': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'jpg': 'image/jpeg',
		'js': 'application/x-javascript',
		'kar': 'audio/midi',
		'latex': 'application/x-latex',
		'lha': 'application/octet-stream',
		'lzh': 'application/octet-stream',
		'm3u': 'audio/x-mpegurl',
		'm4a': 'audio/mp4a-latm',
		'm4b': 'audio/mp4a-latm',
		'm4p': 'audio/mp4a-latm',
		'm4u': 'video/vnd.mpegurl',
		'm4v': 'video/x-m4v',
		'mac': 'image/x-macpaint',
		'man': 'application/x-troff-man',
		'mathml': 'application/mathml+xml',
		'me': 'application/x-troff-me',
		'mesh': 'model/mesh',
		'mid': 'audio/midi',
		'midi': 'audio/midi',
		'mif': 'application/vnd.mif',
		'mov': 'video/quicktime',
		'movie': 'video/x-sgi-movie',
		'mp2': 'audio/mpeg',
		'mp3': 'audio/mpeg',
		'mp4': 'video/mp4',
		'mpe': 'video/mpeg',
		'mpeg': 'video/mpeg',
		'mpg': 'video/mpeg',
		'mpga': 'audio/mpeg',
		'ms': 'application/x-troff-ms',
		'msh': 'model/mesh',
		'mv4': 'video/mv4',
		'mxu': 'video/vnd.mpegurl',
		'nc': 'application/x-netcdf',
		'oda': 'application/oda',
		'ogg': 'application/ogg',
		'pbm': 'image/x-portable-bitmap',
		'pct': 'image/pict',
		'pdb': 'chemical/x-pdb',
		'pdf': 'application/pdf',
		'pgm': 'image/x-portable-graymap',
		'pgn': 'application/x-chess-pgn',
		'pic': 'image/pict',
		'pict': 'image/pict',
		'png': 'image/png',
		'pnm': 'image/x-portable-anymap',
		'pnt': 'image/x-macpaint',
		'pntg': 'image/x-macpaint',
		'ppm': 'image/x-portable-pixmap',
		'ppt': 'application/vnd.ms-powerpoint',
		'ps': 'application/postscript',
		'qt': 'video/quicktime',
		'qti': 'image/x-quicktime',
		'qtif': 'image/x-quicktime',
		'ra': 'audio/x-pn-realaudio',
		'ram': 'audio/x-pn-realaudio',
		'ras': 'image/x-cmu-raster',
		'rdf': 'application/rdf+xml',
		'rgb': 'image/x-rgb',
		'rm': 'application/vnd.rn-realmedia',
		'roff': 'application/x-troff',
		'rtf': 'text/rtf',
		'rtx': 'text/richtext',
		'sgm': 'text/sgml',
		'sgml': 'text/sgml',
		'sh': 'application/x-sh',
		'shar': 'application/x-shar',
		'silo': 'model/mesh',
		'sit': 'application/x-stuffit',
		'skd': 'application/x-koan',
		'skm': 'application/x-koan',
		'skp': 'application/x-koan',
		'skt': 'application/x-koan',
		'smi': 'application/smil',
		'smil': 'application/smil',
		'snd': 'audio/basic',
		'so': 'application/octet-stream',
		'spl': 'application/x-futuresplash',
		'src': 'application/x-wais-source',
		'sv4cpio': 'application/x-sv4cpio',
		'sv4crc': 'application/x-sv4crc',
		'svg': 'image/svg+xml',
		'swf': 'application/x-shockwave-flash',
		't': 'application/x-troff',
		'tar': 'application/x-tar',
		'tcl': 'application/x-tcl',
		'tex': 'application/x-tex',
		'texi': 'application/x-texinfo',
		'texinfo': 'application/x-texinfo',
		'tif': 'image/tiff',
		'tiff': 'image/tiff',
		'tr': 'application/x-troff',
		'tsv': 'text/tab-separated-values',
		'txt': 'text/plain',
		'ustar': 'application/x-ustar',
		'vcd': 'application/x-cdlink',
		'vrml': 'model/vrml',
		'vxml': 'application/voicexml+xml',
		'wav': 'audio/x-wav',
		'wbmp': 'image/vnd.wap.wbmp',
		'wbmxl': 'application/vnd.wap.wbxml',
		'wml': 'text/vnd.wap.wml',
		'wmlc': 'application/vnd.wap.wmlc',
		'woff': 'font/woff',
		'wmls': 'text/vnd.wap.wmlscript',
		'wmlsc': 'application/vnd.wap.wmlscriptc',
		'wrl': 'model/vrml',
		'xbm': 'image/x-xbitmap',
		'xht': 'application/xhtml+xml',
		'xhtml': 'application/xhtml+xml',
		'xls': 'application/vnd.ms-excel',
		'xml': 'application/xml',
		'xpm': 'image/x-xpixmap',
		'xsl': 'application/xml',
		'xslt': 'application/xslt+xml',
		'xul': 'application/vnd.mozilla.xul+xml',
		'xwd': 'image/x-xwindowdump',
		'xyz': 'chemical/x-xyz',
		'zip': 'application/zip'
	};

	return extension[ext.toLowerCase()] || 'application/octet-stream';
};

/*
	Create ETag from string
	@text {String} :: filename
	@version {String} :: optional
	return {String}
*/
exports.etag = function(text, version) {
	var sum = 0;
	for (var i = 0; i < text.length; i++)
		sum += text.charCodeAt(i);
	return sum.toString() + (version ? ':' + version : '');
};

/*
	Add @c to end of @path
	@path {String} :: filename
	@c {String} :: optional, default /
	return {String}
*/
exports.path = function(path, c) {
	c = c || '/';
	if (path[path.length - 1] === c)
		return path;
	return path + c;
};

/*
	@max {Number}
	return {Number}
*/
exports.random = function(max) {
	return Math.floor(Math.random() * (max + 1));
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

/*
	Validation object
	@model {Object} :: object to validate
	@properties {String array} : what properties?
	@prepare {Function} : return utils.isValid() OR {Boolean} :: true is valid
	@builder {ErrorBuilder}
	@resource {Function} :: function(key) return {String}
	return {ErrorBuilder}
*/
exports.validation = function(model, properties, prepare, builder, resource) {
	
	if (typeof(builder) === 'function' && typeof(resource) === 'undefined') {
		resource = builder;
		builder = null;
	}

	var error = builder;

	if (!(error instanceof builders.ErrorBuilder))
		error = new builders.ErrorBuilder(resource);

	if (typeof(properties) === 'string')
		properties = properties.replace(/\s/g, '').split(',');

	if (typeof(model) === 'undefined' || model === null)
		model = {};

	for (var i = 0; i < properties.length; i++) {
		
		var type = typeof(value);
		var name = properties[i].toString();
		var value = (type === 'function' ? model[name]() : model[name]) || '';

		if (type === 'object') {
			error.add(exports.validation(value, properties, prepare, error, builder, resource));
			continue;
		};

		var result = prepare(name, value);	

		if (typeof(result) === 'undefined')
			continue;

		type = typeof(result);

		if (type === 'string') {
			error.add(name, result);
			continue;
		}

		if (type === 'boolean') {
			if (!result)
				error.add(name, '@');
			continue;
		}

		if (result.isValid === false)
			error.add(name, result.error);
	};
	
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
	return '.' + path.join.apply(this, arguments);
};

/*
	@str {String}
	return {String}
*/
exports.removeDiacritics = function(str) {
    var dictionaryA = ['á', 'ä', 'č', 'ď', 'é', 'ě', 'ť', 'ž', 'ú', 'ů', 'ü', 'í', 'ï', 'ô', 'ó', 'ö', 'š', 'ľ', 'ĺ', 'ý', 'ÿ', 'č', 'ř'];
    var dictionaryB = ['a', 'a', 'c', 'd', 'e', 'e', 't', 'z', 'u', 'u', 'u', 'i', 'i', 'o', 'o', 'o', 's', 'l', 'l', 'y', 'y', 'c', 'r'];
    var buf = [];
    for (var i = 0; i < str.length; i++) {
        var c = str[i];
        var isUpper = false;

        var index = dictionaryA.indexOf(c);
        if (index === -1) {
            index = dictionaryA.indexOf(c.toLowerCase());
            isUpper = true;
        }

        if (index === -1) {
            buf.push(c);
            continue;
        }

        c = dictionaryB[index];
        if (isUpper)
            c = c.toUpperCase();

        buf.push(c);
    }
    return buf.join('');	
};

/*
	@type {String}
	@value {Number}
	return {Date}
*/
Date.prototype.add = function(type, value) {
	var self = this;
	switch(type) {
		case 's':
		case 'ss':
		case 'second':
		case 'seconds':
			self.setSeconds(self.getSeconds() + value);
			return self;
		case 'm':
		case 'mm':
		case 'minute':
		case 'minutes':
			self.setMinutes(self.getMinutes() + value);
			return self;
		case 'h':
		case 'hh':
		case 'hour':
		case 'hours':
			self.setHours(self.getHours() + value);
			return self;
		case 'd':
		case 'dd':
		case 'day':
		case 'days':
			self.setDate(self.getDate() + value);
			return self;
		case 'M':
		case 'MM':
		case 'month':
		case 'months':
			self.setMonth(self.getMonth() + value);
			return self;
		case 'y':
		case 'yyyy':
		case 'year':
		case 'years':
			self.setFullYear(self.getFullYear() + value);
			return self;
	}
	return self;
};

/*
	Format date to string
	@format {String}
	return {String}
*/
Date.prototype.format = function(format) {
	var self = this;
	
	var h = self.getHours();
	var m = self.getMinutes().toString();
	var s = self.getSeconds().toString();
	var M = (self.getMonth() + 1).toString();
	var yyyy = self.getFullYear().toString();
	var d = self.getDate().toString();

	var a = 'AM';
	var H = h.toString();


	if (h >= 12) {
		h -= 12;
		a = 'PM';
	}

	if (h === 0)
		h = 12;

	h = h.toString();

	var hh = h.padLeft(2, '0');
	var HH = H.padLeft(2, '0');
	var mm = m.padLeft(2, '0');
	var ss = s.padLeft(2, '0');
	var MM = M.padLeft(2, '0');
	var dd = d.padLeft(2, '0');	
	var yy = yyyy.substring(2);

	return format.replace(/yyyy/g, yyyy).replace(/yy/g, yy).replace(/MM/g, MM).replace(/M/g, M).replace(/dd/g, dd).replace(/d/g, d).replace(/HH/g, HH).replace(/H/g, H).replace(/hh/g, hh).replace(/h/g, h).replace(/mm/g, mm).replace(/m/g, m).replace(/ss/g, ss).replace(/s/g, ss).replace(/a/g, a);
};

String.prototype.trim = function() {
	return this.replace(/^[\s]+|[\s]+$/g, '');
};

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

String.prototype.parseDate = function() {
	return new Date(this.toString());
};

/*
	Contain string a array values?
	@value {String or String Array}
	@mustAll {Boolean} :: optional (default false), String must contains all items in String array
	return {Boolean}
*/
String.prototype.contains = function(value, mustAll) {

	var str = this.toString();

	if (typeof(value) === 'string')
		return str.indexOf(value) !== -1;

	for (var i = 0; i < value.length; i++) {
		var exists = str.indexOf(value[i]) !== -1;

		if (mustAll) {
			if (!exists)
				return false;
		} else if (exists)
			return true;
	}

	return mustAll ? true : false;
};


/*
	@arguments {Object array}
	return {String}
*/
String.prototype.format = function() {
    var formatted = this;
    for (var i = 0; i < arguments.length; i++) {
        var regexp = new RegExp('\\{' + i + '\\}', 'gi');
        formatted = formatted.replace(regexp, arguments[i]);
    }
    return formatted;
};

String.prototype.htmlEncode = function() {
	return this.replace(/\&/g, '&amp;').replace(/\>/g, '&gt;').replace(/\</g, '&lt;').replace(/\"/g, '&quot;');
};

String.prototype.htmlDecode = function() {
	return this.replace(/&gt;/g, '>').replace(/\&lt;/g, '<').replace(/\&quot;/g, '"').replace(/&amp;/g, '&');
};

String.prototype.urlEncode = function() {
	return encodeURIComponent(this);
};

String.prototype.urlDecode = function() {
	return decodeURIComponent(this);
};

/*
	Simple templating :: Hellow {name}, your score: {score}, your price: {price | ### ###.##}, date: {date | dd.MM.yyyy}
	@obj {Object}
	return {String}
*/
String.prototype.params = function(obj) {
    var formatted = this.toString();

    if (typeof(obj) === 'undefined' || obj === null)
    	return formatted;

	var reg = /\{[^}\n]*\}/g;

	formatted.match(reg).forEach(function(prop) {

		var isEncode = false;
		var name = prop.substring(1, prop.length - 1).trim();

		var format = '';
		var index = name.indexOf('|');

		if (index !== -1) {
			format = name.substring(index + 1, name.length).trim();
			name = name.substring(0, index).trim();
		}

		if (prop.substring(0, 2) === '{!')
			name = name.substring(1);
		else
			isEncode = true;

		var val;

		if (name.indexOf('.') !== -1) {
			var arr = name.split('.');

			if (arr.length === 2)
				val = obj[arr[0]][arr[1]];
			else if (arr.length === 3)
				val = obj[arr[0]][arr[1]][arr[3]];
			else if (arr.length === 4)
				val = obj[arr[0]][arr[1]][arr[3]][arr[4]];
			else if (arr.length === 5)
				val = obj[arr[0]][arr[1]][arr[3]][arr[4]][arr[5]];

		} else
			val = name.length === 0 ? obj : obj[name];
		
		if (typeof(val) === 'function')
			val = val(index);

		if (typeof(val) === 'undefined')
			return;

		if (format.length > 0) {

			var type = typeof(val);
			if (type === 'string') {
				var max = parseInt(format);
				if (!isNaN(max))
					val = val.maxLength(max + 3, '...');

			} else if (type === 'number' || util.isDate(val))
				val = val.format(format);
		}

		val = val.toString().dollar();
		formatted = formatted.replace(prop, isEncode ? exports.htmlEncode(val) : val);
	});

    return formatted;
};

/*
	Set max length of string
	@max {Number}
	@chars {String} :: optional, default ...
	return {String}
*/
String.prototype.maxLength = function(max, chars) {
	var str = this.toString();
	chars = chars || '...';
    return str.length > max ? str.substring(0, max - chars.length) + chars : str;
};

String.prototype.isJSON = function() {
	if (this.length === 1)
		return false;
	var a = this[0];
	var b = this[this.length - 1];
	return (a === '"' && b === '"') || (a === '[' && b === ']') || (a === '{' && b === '}');
};

String.prototype.isURL = function() {
	var str = this.toString();
	if (str.length <= 7)
		return false;
	return regexpUrl.test(str);
}

String.prototype.isEmail = function() {
	var str = this.toString();
	if (str.length <= 4) 
		return false;
	return regexpMail.test(str);
};

/*
	@def {Number} :: optional, default 0
	return {Number}
*/
String.prototype.parseInt = function(def) {
    var num = 0;
    var str = this.toString();

    if (str.substring(0, 1) === '0')
        num = parseInt(str.replace(/\s/g, '').substring(1));
    else
        num = parseInt(str.replace(/\s/g, ''));

    if (isNaN(num))
        return def || 0;

    return num;
};

/*
	@def {Number} :: optional, default 0
	return {Number}
*/
String.prototype.parseFloat = function(def) {
	var num = 0;
    var str = this.toString();
	    
    if (str.substring(0, 1) === '0')
        num = parseFloat(str.replace(/\s/g, '').substring(1).replace(',', '.'));
    else
        num = parseFloat(str.replace(/\s/g, '').replace(',', '.'));

    if (isNaN(num))
        return def || 0;

    return num;
};

String.prototype.toUnicode = function() {
    var result = '';
    for(var i = 0; i < this.length; ++i){
        if(this.charCodeAt(i) > 126 || this.charCodeAt(i) < 32)
            result += '\\u' + this.charCodeAt(i).hex(4);
        else
            result += this[i];
    }
    return result;
};

String.prototype.fromUnicode = function() {
	
	var str = this.replace(/\\u([\d\w]{4})/gi, function (match, v) {
		return String.fromCharCode(parseInt(v, 16));
	});

	return unescape(str);
};

String.prototype.toSHA1 = function() {
  	var hash = crypto.createHash('sha1');
  	hash.update(this.toString(), 'utf8');
  	return hash.digest('hex');
};

String.prototype.toMD5 = function() {
  	var hash = crypto.createHash('md5');
  	hash.update(this.toString(), 'utf8');
  	return hash.digest('hex');
};

/*
	@key {String}
	@isUnique {Boolean}
	return {String}
*/
String.prototype.encode = function(key, isUnique) {
	var str = '0' + this.toString();
    var data_count = str.length;
    var key_count = key.length;
    var change = str[data_count - 1];
    var random = isUnique || true ? exports.random(120) + 40 : 65;
    var count = data_count + (random % key_count);
    var values = [];

    values[0] = String.fromCharCode(random);
    var counter = this.length + key.length;

    for (var i = count - 1; i > 0; i--) {
    	var index = str.charCodeAt(i % data_count);
        values[i] = String.fromCharCode(index ^ (key.charCodeAt(i % key_count) ^ random));
    }

    var hash = new Buffer(counter + '=' + values.join(''), 'utf8').toString('base64').replace(/\//g, '-').replace(/\+/g, '_');
    var index = hash.indexOf('=');
    if (index > 0)
    	return hash.substring(0, index);

    return hash;
};

/*
	@key {String}
	return {String}
*/
String.prototype.decode = function(key) {
	
	var values = this.toString().replace(/\-/g, '/').replace(/\_/g, '+');
	var mod = values.length % 4;

	if (mod > 0) {
		for (var i = 0; i < mod; i++)
			values += '=';
	}

	values = new Buffer(values, 'base64').toString('utf8');

	var index = values.indexOf('=');
	if (index == -1)
		return '';

	var counter = parseInt(values.substring(0, index));
	if (isNaN(counter))
		return '';

	values = values.substring(index + 1);

	var count = values.length;
	var random = values.charCodeAt(0);

	var key_count = key.length;
	var data_count = count - (random % key_count);
	var decrypt_data = [];

	for (var i = data_count - 1; i > 0; i--) {
		var index = values.charCodeAt(i) ^ (random ^ key.charCodeAt(i % key_count));
	    decrypt_data[i] = String.fromCharCode(index);
	}

	var val = decrypt_data.join('');

	if (counter !== val.length + key.length)
		return '';

	return val;
};

/*
	Convert value from base64 and save to file
	@fileName {String}
	@callback {Function} :: optional
	return {String}
*/
String.prototype.base64ToFile = function(fileName, callback) {
	var self = this.toString();

	var index = self.indexOf(',');
	if (index === -1)
		index = 0;
	else
		index++;

	if (callback)
		fs.writeFile(fileName, self.substring(index), 'base64', callback);
	else
		fs.writeFileSync(fileName, self.substring(index), 'base64');

	return this;
};

/*
	Get content type from base64
	return {String}
*/
String.prototype.base64ContentType = function() {
	var self = this.toString();
	
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
	var self = this.toString();
	return Array(max + 1).join(c || ' ') + self;
};

/*
	isNumber?
	@isDecimal {Boolean} :: optional, default false
	return {Boolean}
*/
String.prototype.isNumber = function(isDecimal) {
	
	var self = this.toString();

	if (self.length === 0)
		return false;

	isDecimal = isDecimal || false;

	for (var i = 0; i < self.length; i++) {
		var ascii = self.charCodeAt(i);

		if (isDecimal) {
			if (ascii === 44 || ascii == 46) {
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
String.prototype.padLeft = function(max, c) {
	var self = this.toString();
	return Array(Math.max(0, max - self.length + 1)).join(c || ' ') + self;
};

/*
	@max {Number}
	@c {String} :: optional
	return {String}
*/
String.prototype.padRight = function(max, c) {
	var self = this.toString();
	return self + Array(Math.max(0, max - self.length + 1)).join(c || ' ');
};

/*
	index {Number}
	value {String}
	return {String}
*/
String.prototype.insert = function(index, value) {
	var str = this.toString();
	var a = str.substring(0, index);
	var b = value.toString() + str.substring(index);
	return a + b;
};

/*
	Prepare string for replacing double dollar
*/
String.prototype.dollar = function() {
	var str = this.toString();
	var index = str.indexOf('$', 0);

	while (index !== -1) {
		if (str[index + 1] === '$')
			str = str.insert(index, '$');
		index = str.indexOf('$', index + 2);
	}
	return str.toString();
};

/*
	Create link
	@max {Number} :: optional default 60 chars
	return {String}
*/
String.prototype.link = function(max) {
	max = max || 60;

	var self = this.toString().trim().removeDiacritics().toLowerCase();
	var builder = [];

	for (var i = 0; i < self.length; i++) {
		var c = self[i];
		var code = self.charCodeAt(i);

		if (builder.length >= max)
			break;

		if (code > 31 && code < 48) {

			if (builder[builder.length - 1] === '-')
				continue;

			builder.push('-');
			continue;
		}

		if (code > 47 && code < 58) {
			builder.push(c);
			continue;
		}

		if (code > 94 && code < 123) {
			builder.push(c);
			continue;
		}

	}

	return builder.join('');
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

/*
	Format number :: 10000 = 10 000
	@format {Number or String} :: number is decimal and string is specified format, example: ## ###.##
	return {String}
*/
Number.prototype.format = function(format) {

	var index = 0;
	var num = this.toString();
	var beg = 0;
	var end = 0;
	var output = '';

	if (typeof(format) === 'string') {

		var d = false;		

		for (var i = 0; i < format.length; i++) {
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
			var max = strBeg.length - beg;
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

		for (var i = 0; i < format.length; i++) {
			
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
	var beg = num.indexOf('.');
	var max = format || 0;

	if (max === 0 && num != -1)
		max = num.length - (beg + 1);

	if (max > 0) {
		output += '.';
		for (var i = 0; i < max; i++) 
			output += '#';
	}

	return this.format(output);
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
    @count {Number}
	return {Array}
*/
Array.prototype.take = function(count) {
	var arr = [];
	var self = this;
	for (var i = 0; i < self.length; i++) {
    	arr.push(self[i]);
    	if (arr.length >= count)
    		return arr;
  	}
  	return arr;
};

/*
    @count {Number}
    return {Array}
*/
Array.prototype.skip = function(count) {
	var arr = [];
	var self = this;
	for (var i = 0; i < self.length; i++) {
		if (i >= count)
			arr.push(self[i]);
	}
	return arr;
};

/*
	@cb {Function} :: return true if is finded
	return {Array item}
*/
Array.prototype.find = function(cb) {
	var self = this;
	for (var i = 0; i < self.length; i++) {
		if (cb(self[i], i))
			return self[i];
	}
	return null;
};

/*
	@cb {Function} :: return true if is removed
	return {Array}
*/
Array.prototype.remove = function(cb) {
	var self = this;
	var arr = [];
	for (var i = 0; i < self.length; i++) {
		if (!cb(self[i], i))
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
	Async class
*/
function Async(owner) {
	this.tasks = null;
	this.onCompleted = null;
	this.owner = owner;
};

/*
	Next call function from async list
	return {Async};
*/
Async.prototype.next = function() {
	var self = this;
	
	if (self.tasks === null || self.tasks.length === 0) {

		var cb = function() {
			var owner = self.owner || self;
			self.onCompleted.call(owner, owner);
		};

		setImmediate(cb);		
		return self;
	}

	var fn = this.tasks.shift();
	
	if (typeof(fn) === 'undefined' || fn === null) {
		self.next();
		return self;
	}

	var run = function() {
		var owner = self.owner || self;
		fn.call(owner, owner);
	};

	// node.js do events
	setImmediate(run);
	return self;
};

/*
	Skip next call function from async list
	@count {Number} :: optional, default 1
	return {Async};
*/
Async.prototype.skip = function(count) {
	
	var self = this;
	count = count || 1;

	if (self.tasks === null || self.tasks.length === 0) {
		
		var cb = function() {
			var owner = self.owner || self;
			self.onCompleted.call(owner, owner);
		};

		setImmediate(cb);
		return self;
	}

	for (var i = 0; i < count; i++)
		this.tasks.shift();

	self.next();
	return self;
};

/*
	Add function to wait list (ASYNC)
	@fn {Function}
	return {Async};
*/
Async.prototype.wait = function (fn) {
	var self = this;

	if (self.tasks === null)
		self.tasks = [];

	self.tasks.push(fn);
	return self;
};

/*
	Run async tasks
	@fn {Function}
	@run {Boolean} :: optional, default true
	return {Controller};
*/
Async.prototype.complete = function(fn, run) {
	return this.work(fn, run);
};

Async.prototype.work = function(fn, run) {
	var self = this;

	if (typeof(fn) === 'function')
		self.onCompleted = fn;
	else
		run = fn;

	if (run || true)
		self.next();

	return self;
};

exports.Async = Async;
exports.async = Async;