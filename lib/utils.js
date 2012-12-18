var http = require('http');

exports.version = "1.0.1";

var fs = require('fs');

exports.isRelative = function(str) {
	return !(str.indexOf("//") != -1 || str.indexOf("http://") != -1 || str.indexOf("https://") != -1);
}

exports.htmlEncode = function(str) {
	return str.replace(/\>/g, "&gt;").replace(/\</g, "&lt;").replace(/\"/g, "&quot;");
};

exports.htmlDecode = function(str) {
	return str.replace(/&gt;/g, ">").replace(/\&lt;/g, "<").replace(/\&quot;/g, "\"");
};

exports.isStaticFile = function(str) {
	var pattern = /\.\w{2,5}($|\?)+/g;
	return pattern.test(str);
};

exports.IdParserEncode = function(id, token, key) {
	var empty = 'ABCDEFGHIJKLMNOP';
	var str = id + ';' + (token || empty) + ';' + config.name + ';' + (key || empty);
	return id + 'x' + crypto.createHash('sha256').update(str).digest('hex') + 'x' + str.length;
};

exports.IdParserDecode = function(hash, token, key) {
	var id = hash.split('x').read(0).parseInt(0);
	if (id > 0 && exports.IdParserEncode(id, token, key) === hash)
		return id;
	return 0;
};

exports.getContentType = function(ext) {
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

	return extension[ext] || 'application/octet-stream';
};


exports.ETagCreateFromFile = function(path) {
	if (!fs.existsSync(path))
		return '';
	
	var stats = fs.statSync(path)
	return stats.ino + '-' + stats.size + '-' + Date.parse(stats.mtime);
};

exports.ETagValid = function(req, etag) {
	return req.headers["if-none-match"] == etag;
};

exports.random = function(max) {
	return Math.floor(Math.random() * (max + 1));
};

exports.validation = function (obj, properties, cb, resource) {
	var arr = [];
	var res = resource || function(d) { return d; };

	if (typeof(properties) === 'string')
		properties = properties.replace(/\s/g, '').split(',');

	if (typeof(obj) === 'undefined' || obj == null)
		obj = {};

	for (var i = 0; i < properties.length; i++) {
		
		var name = properties[i].toString();
		var value = obj[name] || '';
		var type = typeof(value);

		if (type === 'function')
			continue;

		if (type === 'object') {
			var tmp = exports.validation(value, properties, cb, resource);
			if (tmp.length > 0) {
				for (var j = 0; j < tmp.length; j++)
					arr.push(tmp[j]);
			}
			continue;
		};

		var result = cb(name, value);	
		if (typeof(result) != 'undefined') {

			if (!result.isValid) {

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

exports.isValid = function(isValid, errorMessage) {
	return { isValid: isValid, errorMessage: errorMessage };
};

exports.isMail = function(value) {
	return value.isMail(value || '');
};

http.ServerResponse.prototype.cookie = function (name, value, expire, path, domain) {

	var isExpire = typeof(expire) === 'undefined' || expire == null;
	domain = domain || '';

    var cookie = (!isExpire ? '{0}={1}; path={3}' : '{0}={1}; expires={2}; path={3}') + (domain.length > 0 ? '; domain={4}' : ''); 
	this.setHeader('Set-Cookie', cookie.format(name, value, isExpire ? expire.toUTCString() : '', path || '/', domain));
};

http.IncomingMessage.prototype.cookie = function (name) {
	if (typeof(this.cache.cookies) == 'undefined') {
		this.cache.cookies = {};
	    var cookie = this.headers['cookie'];
        if (cookie != null) {
			var self = this;
			cookie.split(';').each(function(o) {
	        	var c = o.trim().split('=');
				self.cache.cookies[c[0]] = c[1];
			});
		}
 	}
	var value = this.cache.cookies[name];
	
	if (typeof(value) === 'undefined')
		return null;

	return value;
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
    var num = parseFloat(this.replace(/\s/g, '').replace(',', '.'));
    
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

Number.prototype.floor = function(decimals) {
	return Math.floor(this * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

Number.prototype.round = function(decimals) {
	return Math.round(this * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

Number.prototype.format = function (decimals) {

	var value = this.floor(decimals).toString().replace(/\,/g, '.');
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

Array.prototype.read = function (index, def) {

    if (index >= this.length)
        return def;

    if (index < 0)
        return def;

    return this[index];
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

Array.prototype.forEachAsync = function(predicate, cb) {

	var index = 0;
	var length = this.length;
	var self = this;

	function run() {
		predicate(self[index], index);
		index++;

		if (index < length)
			process.nextTick(run);
		else
			cb && cb();
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

Array.prototype.findAsync = function(predicate, cb) {
	var index = 0;
	var length = this.length;
	var self = this;

	function run() {
		var val = self[index];

		if (typeof(val) != 'undefined' && predicate(val, index)) {
			cb(val);
			return;
		}

		index++;

		if (index < length)
			process.nextTick(run);
		else
			cb && cb(null);
	};

	process.nextTick(run);	
};
