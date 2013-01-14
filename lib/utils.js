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
var path = require('path');
var fs = require('fs');

exports.isRelative = function(url) {
	return !(url.substring(0, 2) === "//" || url.indexOf("http://") != -1 || url.indexOf("https://") != -1);
};

exports.htmlEncode = function(str) {

	var type = typeof(str);

	if (type === 'undefined')
		return '';

	if (type != 'string')
		str = str.toString();

	return str.htmlEncode();
};

exports.htmlDecode = function(str) {

	var type = typeof(str);

	if (type === 'undefined')
		return '';

	if (type != 'string')
		str = str.toString();

	return str.htmlDecode();
};

exports.isStaticFile = function(url) {
	var pattern = /\.\w{2,5}($|\?)+/g;
	return pattern.test(url);
};

exports.loadFromFile = function(fileName, cb, def) {
	if (fs.existsSync(fileName))
		cb(fs.readFileSync(fileName));
	else
		cb(def);
};

exports.isNullOrEmpty = function(str) {

	if (typeof(str) === 'undefined')
		return true;

	return str === null || str.length === 0;
};

exports.parseInt = function (obj, def) {
	var type = typeof(obj);
	
	if (type === 'undefined')
		return def || 0;

	var str = type != 'string' ? obj.toString() : obj;
    return str.parseInt(def);
};

exports.parseFloat = function (obj, def) {
	var type = typeof(obj);

	if (type === 'undefined')
		return def || 0;

	var str = type != 'string' ? obj.toString() : obj;
    return str.parseFloat(def);
};

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
		'woff': 'application/font-woff',
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

exports.ETagCreateFromFile = function(path) {
	var stats = fs.statSync(path)
	return stats === null ? '' : stats.ino + '-' + stats.size + '-' + Date.parse(stats.mtime);
};

exports.ETagCompare = function(req, etag) {
	return req.headers["if-none-match"] === etag;
};

exports.random = function(max) {
	return Math.floor(Math.random() * (max + 1));
};

exports.GUID = function(max) {

	max = max || 40;

    var rnd = function () {
        return Math.floor(Math.random() * 65536).toString(16);
    };

    var str = '';
    for (var i = 0; i < max / 4; i++)
    	str += rnd();

    return str.substring(0, max);
};

exports.validation = function (obj, properties, prepare, resource) {
	var arr = [];
	var res = resource || function(d) { return d; };

	if (typeof(properties) === 'string')
		properties = properties.replace(/\s/g, '').split(',');

	if (typeof(obj) === 'undefined' || obj === null)
		obj = {};

	for (var i = 0; i < properties.length; i++) {
		
		var name = properties[i].toString();
		var value = obj[name] || '';
		var type = typeof(value);

		if (type === 'function')
			continue;

		if (type === 'object') {			
			var tmp = exports.validation(value, properties, prepare, resource);
			if (tmp.length > 0) {
				for (var j = 0; j < tmp.length; j++)
					arr.push(tmp[j]);
			}
			continue;
		};

		var result = prepare(name, value);	
		if (typeof(result) != 'undefined') {

			if (result.isValid === false) {
				var msg = result.errorMessage;

				if (msg === '@')
					msg = res(name);
				else if (msg.substring(0, 1) === '@')
					msg = res(msg.substring(0, 1));

				arr.push({ K: name, V: msg });
			}
		}
	};
	return arr;
};

exports.isValid = function(valid, errorMessage) {
	return { isValid: valid, errorMessage: errorMessage || '@' };
};

exports.isMail = function(value) {
	return value.isMail(value || '');
};

// získanie cesty k súboru
// Windows to má cesty trochu inak ako Unix
exports.combine = function() {
	return '.' + path.join.apply(this, arguments);
};

exports.removeDiacritics = function(str) {
    var dictionaryA = ['á', 'ä', 'č', 'ď', 'é', 'ě', 'ť', 'ž', 'ú', 'ů', 'ü', 'í', 'ï', 'ô', 'ó', 'ö', 'š', 'ľ', 'ĺ', 'ý', 'ÿ', 'č'];
    var dictionaryB = ['a', 'a', 'c', 'd', 'e', 'e', 't', 'z', 'u', 'u', 'u', 'i', 'i', 'o', 'o', 'o', 's', 'l', 'l', 'y', 'y', 'c'];
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

Date.prototype.add = function(type, value) {
	switch(type) {
		case "s":
		case "ss":
		case "second":
		case "seconds":
			this.setSeconds(this.getSeconds() + value);
			return this;
		case "m":
		case "mm":
		case "minute":
		case "minutes":
			this.setMinutes(this.getMinutes() + value);
			return this;
		case "h":
		case "hh":
		case "hour":
		case "hours":
			this.setHours(this.getHours() + value);
			return this;
		case "d":
		case "dd":
		case "day":
		case "days":
			this.setDate(this.getDate() + value);
			return this;
		case "M":
		case "MM":
		case "month":
		case "months":
			this.setMonth(this.getMonth() + value);
			return this;
		case "y":
		case "yyyy":
		case "year":
		case "years":
			this.setFullYear(this.getFullYear() + value);
			return this;
	}
	return this;
};

String.prototype.trim = function() {
	return this.replace(/^[\s]+|[\s]+$/g, '');
};

String.prototype.format = function() {
    var formatted = this;
    for (var i = 0; i < arguments.length; i++) {
        var regexp = new RegExp('\\{' + i + '\\}', 'gi');
        formatted = formatted.replace(regexp, arguments[i]);
    }
    return formatted;
};

String.prototype.htmlEncode = function() {
	return this.replace(/\>/g, '&gt;').replace(/\</g, '&lt;').replace(/\"/g, '&quot');
};

String.prototype.htmlDecode = function() {
	return this.replace(/&gt;/g, '>').replace(/\&lt;/g, '<').replace(/\&quot;/g, '"');
};

String.prototype.params = function(obj, encode) {
    var formatted = this;

    Object.keys(obj).forEach(function(o) {
        var regexp = new RegExp('\\{' + o + '\\}', 'gi');
        var val = obj[o].toString();

        if (encode)
        	val = val.htmlEncode();

		formatted = formatted.replace(regexp, val);
    });

    return formatted;
};

String.prototype.maxLength = function (max, chars) {
    return this.length > max ? this.substring(0, max - chars.length) + (typeof (c) === 'undefined' ? "..." : chars) : this;
};

String.prototype.isMail = function () {
	if (this.length <= 4) 
		return false;
	return RegExp("^[a-zA-Z0-9-_.]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$").test(this);
};

String.prototype.parseInt = function (def) {
    var num = 0;

    if (this.substring(0, 1) === '0')
        num = parseInt(this.replace(/\s/g, '').substring(1));
    else
        num = parseInt(this.replace(/\s/g, ''));

    if (isNaN(num))
        return def || 0;

    return num;
};

String.prototype.parseFloat = function (def) {
	var num = 0;
	    
    if (this.substring(0, 1) === '0')
        num = parseFloat(this.replace(/\s/g, '').substring(1).replace(',', '.'));
    else
        num = parseFloat(this.replace(/\s/g, '').replace(',', '.'));

    if (isNaN(num))
        return def || 0;

    return num;
};

String.prototype.toUnicode = function() {
    var result = "";
    for(var i = 0; i < this.length; ++i){
        if(this.charCodeAt(i) > 126 || this.charCodeAt(i) < 32)
            result += "\\u" + this.charCodeAt(i).hex(4);
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


String.prototype.encode = function(key, isUnique) {
	var str = '0' + this;
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

	if (counter != val.length + key.length)
		return '';

	return val;
};

String.prototype.removeDiacritics = function() {
	return exports.removeDiacritics(this);
};

Number.prototype.floor = function(decimals) {
	return Math.floor(this * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

Number.prototype.round = function(decimals) {
	return Math.round(this * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

Number.prototype.format = function (decimals) {

	var value = this.floor(decimals || 0).toString().replace(/\,/g, '.');
	var scale = '';

	var index = value.lastIndexOf('.');

	if (index > 0) {
		scale = value.substring(index + 1);
		value = value.substring(0, index);
	}

	var minus = value.substring(0, 1);

	if (minus == '-')
		value = value.substring(1);

	var length = value.length;
	var result = '';

    for (var i = 0; i < length; i++)
        result = value.substring((length - 1) - i, length - i) + (i % 3 == 0 ? ' ' : '') + result;

    result = result.trim();

    if (minus == '-')
    	result = minus + result;

	length = scale.length;
    if (length > 0 || decimals > 0) {
    	
    	if (length < decimals)
    	{
    		for (var i = length; i < decimals; i++)
    			scale += '0';
    	}

    	result += '.' + scale;
    }

	return result;
};

Number.prototype.hex = function(length) {
    var str = this.toString(16).toUpperCase();
    while(str.length < length)
        str = "0" + str;
    return str;
};

Object.prototype.validation = function(properties, cb, resource) {
	return exports.validation(this, properties, cb, resource);
};

Array.prototype.find = function(cb) {
	for (var i = 0; i < this.length; i++) {
		if (cb(this[i], i))
			return this[i];
	}
	return null;
};

Array.prototype.remove = function (cb) {
	var arr = [];
	for (var i = 0; i < this.length; i++) {
		if (!cb(this[i], i))
			arr.push(this[i]);
	}
	return arr;
};

Array.prototype.forEachAsync = function(predicate, cb, param) {

	var index = 0;
	var length = this.length;
	var self = this;
	
	this.$parameter = param;

	function run() {
		predicate.call(self, self[index], index);
		index++;

		if (index < length)
			process.nextTick(run);
		else
			cb && cb(self.$parameter);
	};

	process.nextTick(run);
};

Array.prototype.removeAsync = function(predicate, cb) {
	var index = 0;
	var length = this.length;
	var self = this;
	var tmp = [];

	function run() {
		var val = self[index];

		if (typeof(val) != 'undefined') {
			if (!predicate(val, index))
				tmp.push(val);
		}

		index++;

		if (index < length)
			process.nextTick(run);
		else
			cb && cb(tmp);
	};

	process.nextTick(run);
};

Array.prototype.findAsync = function(predicate, cb, param) {
	
	var index = 0;
	var length = this.length;
	var self = this;

	this.$parameter = param;

	function run() {
		var val = self[index];

		if (typeof(val) != 'undefined' && predicate.call(self, val, index)) {
			cb(val, self.$parameter);
			return;
		}

		index++;

		if (index < length)
			process.nextTick(run);
		else
			cb && cb(null, self.$parameter);
	};

	process.nextTick(run);
};

// ======================================================
// Async Class
// ======================================================

function Async(obj) {
	this.obj = obj;
	this.arr = [];
	this.onComplete = null;
};

Async.prototype.clear = function () {
	this.arr = [];
};

Async.prototype.add = function (fn) {
	this.arr.push(fn);
};

Async.prototype.isBusy = function() {
	return this.arr.length > 0;
};

Async.prototype.run = function() { 

	var self = this;
	var callback = function() {
		self.next();
	};

	process.nextTick(callback);
};

Async.prototype.next = function() {
	
	var self = this;
	var obj = self.arr.shift();

	if (typeof(obj) === 'undefined') {
		
		if (self.onComplete != null)
			self.onComplete.call(self.obj, self.obj);

		return;
	}
	
	process.nextTick(function() {

		var callback = function() {
			self.next();
		};

		obj.call(self.obj, callback);
	});
};

exports.async = function(obj) {
	return new Async(obj);
};
