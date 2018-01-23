// Copyright 2012-2018 (c) Peter Širka <petersirka@gmail.com>
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
 * @module FrameworkInternal
 * @version 2.9.2
 */

'use strict';

const Crypto = require('crypto');
const Fs = require('fs');
const ReadStream = Fs.ReadStream;
const Stream = require('stream');
const ENCODING = 'utf8';
const EMPTYARRAY = [];
const EMPTYOBJECT = {};
const CONCAT = [null, null];

if (!global.framework_utils)
	global.framework_utils = require('./utils');

Object.freeze(EMPTYOBJECT);
Object.freeze(EMPTYARRAY);

const REG_1 = /[\n\r\t]+/g;
const REG_2 = /\s{2,}/g;
const REG_4 = /\n\s{2,}./g;
const REG_5 = />\n\s{1,}</g;
const REG_6 = /[<\w"\u0080-\u07ff\u0400-\u04FF]+\s{2,}[\w\u0080-\u07ff\u0400-\u04FF>]+/;
const REG_7 = /\\/g;
const REG_8 = /'/g;
const REG_BLOCK_BEG = /@\{block.*?\}/i;
const REG_BLOCK_END = /@\{end\}/i;
const REG_SKIP_1 = /\('|"/;
const REG_SKIP_2 = /,(\s)?\w+/;
const REG_HEAD = /<\/head>/i;
const REG_COMPONENTS = /@{(\s)?(component|components)(\s)?\(/i;
const REG_COMPONENTS_GROUP = /('|")[a-z0-9]+('|")/i;
const HTTPVERBS = { 'get': true, 'post': true, 'options': true, 'put': true, 'delete': true, 'patch': true, 'upload': true, 'head': true, 'trace': true, 'propfind': true };
const RENDERNOW = ['self.$import(', 'self.route', 'self.$js(', 'self.$css(', 'self.$favicon(', 'self.$script(', '$STRING(self.resource(', '$STRING(RESOURCE(', 'self.translate(', 'language', 'self.sitemap_url(', 'self.sitemap_name(', '$STRING(CONFIG(', '$STRING(config.', '$STRING(config[', '$STRING(config('];
const REG_NOTRANSLATE = /@\{notranslate\}/gi;
const REG_NOCOMPRESS = /@\{nocompress\s\w+}/gi;
const REG_TAGREMOVE = /[^>]\n\s{1,}$/;
const REG_HELPERS = /helpers\.[a-z0-9A-Z_$]+\(.*?\)+/g;
const REG_SITEMAP = /\s+(sitemap_navigation\(|sitemap\()+/g;
const REG_CSS_1 = /\n|\s{2,}/g;
const REG_CSS_2 = /\s?\{\s{1,}/g;
const REG_CSS_3 = /\s?\}\s{1,}/g;
const REG_CSS_4 = /\s?:\s{1,}/g;
const REG_CSS_5 = /\s?;\s{1,}/g;
const REG_CSS_6 = /,\s{1,}/g;
const REG_CSS_7 = /\s\}/g;
const REG_CSS_8 = /\s\{/g;
const REG_CSS_9 = /;\}/g;
const REG_CSS_10 = /\$[a-z0-9-_]+:.*?;/gi;
const REG_CSS_11 = /\$[a-z0-9-_]+/gi;
const AUTOVENDOR = ['filter', 'appearance', 'column-count', 'column-gap', 'column-rule', 'display', 'transform', 'transform-style', 'transform-origin', 'transition', 'user-select', 'animation', 'perspective', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-play-state', 'opacity', 'background', 'background-image', 'font-smoothing', 'text-size-adjust', 'backface-visibility', 'box-sizing', 'overflow-scrolling'];
const WRITESTREAM = { flags: 'w' };
const EMPTYBUFFER = framework_utils.createBufferSize(0);

var INDEXFILE = 0;
var INDEXMIXED = 0;

global.$STRING = function(value) {
	return value != null ? value.toString() : '';
};

global.$VIEWCACHE = [];

exports.parseMULTIPART = function(req, contentType, route, tmpDirectory) {

	var boundary = contentType.split(';')[1];
	if (!boundary) {
		F.reqstats(false, false);
		F.stats.request.error400++;
		req.res.writeHead(400);
		req.res.end();
		return;
	}

	// For unexpected closing
	req.once('close', () => !req.$upload && req.clear());

	var parser = new MultipartParser();
	var size = 0;
	var stream;
	var maximumSize = route.length;
	var tmp;
	var close = 0;
	var rm;
	var fn_close = function() {
		close--;
	};

	// Replaces the EMPTYARRAY and EMPTYOBJECT in index.js
	req.files = [];
	req.body = {};

	var path = framework_utils.combine(tmpDirectory, (F.id ? 'i-' + F.id + '_' : '') + 'uploadedfile-');

	// Why indexOf(.., 2)? Because performance
	boundary = boundary.substring(boundary.indexOf('=', 2) + 1);

	req.buffer_exceeded = false;
	req.buffer_has = true;
	req.buffer_parser = parser;

	parser.initWithBoundary(boundary);

	parser.onPartBegin = function() {

		if (req.buffer_exceeded)
			return;

		// Temporary data
		tmp = new HttpFile();
		tmp.$data = framework_utils.createBufferSize();
		tmp.$step = 0;
		tmp.$is = false;
		tmp.length = 0;
	};

	parser.onHeaderValue = function(buffer, start, end) {

		if (req.buffer_exceeded)
			return;

		var header = buffer.slice(start, end).toString(ENCODING);

		if (tmp.$step === 1) {
			var index = header.indexOf(';');
			if (index === -1)
				tmp.type = header.trim();
			else
				tmp.type = header.substring(0, index).trim();

			tmp.$step = 2;
			return;
		}

		if (tmp.$step !== 0)
			return;

		// UNKNOWN ERROR, maybe attack
		if (header.indexOf('form-data; ') === -1) {
			req.buffer_exceeded = true;
			!tmp.$is && destroyStream(stream);
			return;
		}

		header = parse_multipart_header(header);

		tmp.$step = 1;
		tmp.$is = header[1] !== null;
		tmp.name = header[0];

		if (!tmp.$is) {
			destroyStream(stream);
			return;
		}

		tmp.filename = header[1];

		// IE9 sends absolute filename
		var index = tmp.filename.lastIndexOf('\\');

		// For Unix like senders
		if (index === -1)
			index = tmp.filename.lastIndexOf('/');

		if (index !== -1)
			tmp.filename = tmp.filename.substring(index + 1);

		tmp.path = path + (INDEXFILE++) + '.bin';
	};

	parser.onPartData = function(buffer, start, end) {

		if (req.buffer_exceeded)
			return;

		var data = buffer.slice(start, end);
		var length = data.length;

		size += length;

		if (size >= maximumSize) {
			req.buffer_exceeded = true;
			if (rm)
				rm.push(tmp.path);
			else
				rm = [tmp.path];
			return;
		}

		if (!tmp.$is) {
			CONCAT[0] = tmp.$data;
			CONCAT[1] = data;
			tmp.$data = Buffer.concat(CONCAT);
			return;
		}

		if (tmp.length) {
			stream.write(data);
			tmp.length += length;
			return;
		}

		var wh = null;

		switch (tmp.type) {
			case 'image/jpeg':
				wh = framework_image.measureJPG(buffer.slice(start));
				break;
			case 'image/gif':
				wh = framework_image.measureGIF(data);
				break;
			case 'image/png':
				wh = framework_image.measurePNG(data);
				break;
			case 'image/svg+xml':
				wh = framework_image.measureSVG(data);
				break;
		}

		if (wh) {
			tmp.width = wh.width;
			tmp.height = wh.height;
		} else {
			tmp.width = 0;
			tmp.height = 0;
		}

		req.files.push(tmp);
		F.$events['upload-begin'] && F.emit('upload-begin', req, tmp);
		close++;
		stream = Fs.createWriteStream(tmp.path, WRITESTREAM);
		stream.once('close', fn_close);
		stream.once('error', fn_close);
		stream.write(data);
		tmp.length += length;
	};

	parser.onPartEnd = function() {

		if (stream) {
			stream.end();
			stream = null;
		}

		if (req.buffer_exceeded)
			return;

		if (tmp.$is) {
			tmp.$data = undefined;
			tmp.$is = undefined;
			tmp.$step = undefined;
			F.$events['upload-end'] && F.emit('upload-end', req, tmp);
			return;
		}

		tmp.$data = tmp.$data.toString(ENCODING);

		var temporary = req.body[tmp.name];
		if (temporary === undefined) {
			req.body[tmp.name] = tmp.$data;
		} else if (temporary instanceof Array) {
			req.body[tmp.name].push(tmp.$data);
		} else {
			temporary = [temporary];
			temporary.push(tmp.$data);
			req.body[tmp.name] = temporary;
		}
	};

	parser.onEnd = function() {

		if (close) {
			setImmediate(parser.onEnd);
		} else {
			rm && F.unlink(rm);
			req.$total_end2();
		}
	};

	req.on('data', uploadparser);
	req.on('end', uploadparser_done);
};

function uploadparser(chunk) {
	this.buffer_parser.write(chunk);
}

function uploadparser_done() {
	!this.buffer_exceeded && (this.$upload = true);
	this.buffer_parser.end();
}

exports.parseMULTIPART_MIXED = function(req, contentType, tmpDirectory, onFile) {

	var boundary = contentType.split(';')[1];
	if (!boundary) {
		F.reqstats(false, false);
		F.stats.request.error400++;
		req.res.writeHead(400);
		req.res.end();
		return;
	}

	// For unexpected closing
	req.once('close', () => !req.$upload && req.clear());

	var parser = new MultipartParser();
	var close = 0;
	var stream;
	var tmp;
	var counter = 0;
	var path = framework_utils.combine(tmpDirectory, (F.id ? 'i-' + F.id + '_' : '') + 'uploadedmixed-');

	boundary = boundary.substring(boundary.indexOf('=', 2) + 1);
	req.buffer_exceeded = false;
	req.buffer_has = true;
	req.buffer_parser = parser;

	parser.initWithBoundary(boundary);

	parser.onPartBegin = function() {
		// Temporary data
		tmp = new HttpFile();
		tmp.$step = 0;
		tmp.$is = false;
		tmp.length = 0;
	};

	parser.onHeaderValue = function(buffer, start, end) {

		if (req.buffer_exceeded)
			return;

		var header = buffer.slice(start, end).toString(ENCODING);
		if (tmp.$step === 1) {
			var index = header.indexOf(';');
			if (index === -1)
				tmp.type = header.trim();
			else
				tmp.type = header.substring(0, index).trim();
			tmp.$step = 2;
			return;
		}

		if (tmp.$step !== 0)
			return;

		header = parse_multipart_header(header);

		tmp.$step = 1;
		tmp.$is = header[1] !== null;
		tmp.name = header[0];

		if (tmp.$is) {
			tmp.filename = header[1];
			tmp.path = path + (INDEXMIXED++) + '.bin';

			stream = Fs.createWriteStream(tmp.path, WRITESTREAM);
			stream.once('close', () => close--);
			stream.once('error', () => close--);
			close++;
		} else
			destroyStream(stream);
	};

	parser.onPartData = function(buffer, start, end) {

		if (req.buffer_exceeded)
			return;

		var data = buffer.slice(start, end);
		var length = data.length;

		if (!tmp.$is)
			return;

		if (tmp.length) {
			stream.write(data);
			tmp.length += length;
			return;
		}

		stream.write(data);
		tmp.length += length;
		onFile(req, tmp, counter++);
	};

	parser.onPartEnd = function() {

		if (stream) {
			stream.end();
			stream = null;
		}

		if (req.buffer_exceeded || !tmp.$is)
			return;

		tmp.$is = undefined;
		tmp.$step = undefined;
	};

	parser.onEnd = function() {
		if (close) {
			setImmediate(parser.onEnd);
		} else {
			onFile(req, null);
			F.responseContent(req, req.res, 200, EMPTYBUFFER, 'text/plain', false);
		}
	};

	req.on('data', uploadparser);
	req.on('end', uploadparser_done);
};

function parse_multipart_header(header) {

	var arr = new Array(2);
	var find = ' name="';
	var length = find.length;
	var beg = header.indexOf(find);
	var tmp = '';

	if (beg !== -1)
		tmp = header.substring(beg + length, header.indexOf('"', beg + length));

	if (tmp)
		arr[0] = tmp;
	else
		arr[0] = 'undefined_' + (Math.floor(Math.random() * 100000)).toString();

	find = ' filename="';
	length = find.length;
	beg = header.indexOf(find);
	tmp = '';

	if (beg !== -1)
		tmp = header.substring(beg + length, header.indexOf('"', beg + length));

	if (tmp)
		arr[1] = tmp;
	else
		arr[1] = null;

	return arr;
}

exports.routeSplit = function(url, noLower) {

	var arr;

	if (!noLower) {
		arr = F.temporary.other[url];
		if (arr)
			return arr;
	}

	if (!url || url === '/') {
		arr = ['/'];
		return arr;
	}

	var prev = false;
	var key = '';
	var count = 0;

	arr = [];

	for (var i = 0, length = url.length; i < length; i++) {
		var c = url[i];

		if (c === '/') {
			if (key && !prev) {
				arr.push(key);
				count++;
				key = '';
			}
			continue;
		}

		key += noLower ? c : c.toLowerCase();
		prev = c === '/';
	}

	if (key)
		arr.push(key);
	else if (!count)
		arr.push('/');

	return arr;
};

exports.routeSplitCreate = function(url, noLower) {

	if (!noLower)
		url = url.toLowerCase();

	if (url[0] === '/')
		url = url.substring(1);

	if (url[url.length - 1] === '/')
		url = url.substring(0, url.length - 1);

	var count = 0;
	var end = 0;
	var arr = [];

	for (var i = 0, length = url.length; i < length; i++) {
		switch (url[i]) {
			case '/':
				if (count !== 0)
					break;
				arr.push(url.substring(end + (arr.length ? 1 : 0), i));
				end = i;
				break;

			case '{':
				count++;
				break;

			case '}':
				count--;
				break;
		}
	}

	!count && arr.push(url.substring(end + (arr.length ? 1 : 0), url.length));

	if (arr.length === 1 && !arr[0])
		arr[0] = '/';

	return arr;
};

exports.routeCompare = function(url, route, isSystem, isWildcard) {

	var length = url.length;
	var lengthRoute = route.length;

	if (lengthRoute !== length && !isWildcard)
		return false;

	if (isWildcard && lengthRoute === 1 && route[0] === '/')
		return true;

	var skip = length === 1 && url[0] === '/';

	for (var i = 0; i < length; i++) {

		var value = route[i];

		if (!isSystem && isWildcard && value === undefined)
			return true;

		if (!isSystem && (!skip && value[0] === '{'))
			continue;

		if (url[i] !== value)
			return isSystem ? false : isWildcard ? i >= lengthRoute : false;
	}

	return true;
};

exports.routeCompareSubdomain = function(subdomain, arr) {
	if ((!subdomain && !arr) || (subdomain && !arr))
		return true;
	if (!subdomain && arr)
		return false;
	for (var i = 0, length = arr.length; i < length; i++) {
		if (arr[i] === '*')
			return true;
		var index = arr[i].lastIndexOf('*');
		if (index === -1) {
			if (arr[i] === subdomain)
				return true;
		} else if (subdomain.indexOf(arr[i].replace('*', '')) !== -1)
			return true;
	}
	return false;
};

exports.routeCompareFlags = function(arr1, arr2, membertype) {

	var hasVerb = false;
	var a1 = arr1;
	var a2 = arr2;
	var l1 = arr1.length;
	var l2 = arr2.length;
	var select = l1 > l2 ? a1 : a2;
	var compare = l1 > l2 ? a2 : a1;
	var length = Math.max(l1, l2);

	var AUTHORIZE = 'authorize';
	var UNAUTHORIZE = 'unauthorize';

	for (var i = 0; i < length; i++) {

		var value = select[i];
		var c = value[0];

		if (c === '!' || c === '#' || c === '$' || c === '@' || c === '+') // ignore roles
			continue;

		if (!membertype && (value === AUTHORIZE || value === UNAUTHORIZE))
			continue;

		var index = compare.indexOf(value);
		if (index === -1 && !HTTPVERBS[value])
			return value === AUTHORIZE || value === UNAUTHORIZE ? -1 : 0;

		hasVerb = hasVerb || (index !== -1 && HTTPVERBS[value]);
	}

	return hasVerb ? 1 : 0;
};

exports.routeCompareFlags2 = function(req, route, membertype) {

	// membertype 0 -> not specified
	// membertype 1 -> auth
	// membertype 2 -> unauth

	// 1. upload --> 0
	// 2. doAuth --> 1 or 2

	// if (membertype && ((membertype !== 1 && route.MEMBER === 1) || (membertype !== 2 && route.MEMBER === 2)))
	if (membertype && route.MEMBER && membertype !== route.MEMBER)
		return -1;

	if (!route.isWEBSOCKET) {
		if ((route.isXHR && !req.xhr) || (route.isMOBILE && !req.mobile) || (route.isROBOT && !req.robot) || (route.isUPLOAD && !req.$upload))
			return 0;
		var method = req.method;
		if (route.method) {
			if (route.method !== method)
				return 0;
		} else if (!route.flags2[method.toLowerCase()])
			return 0;
		if ((route.isREFERER && req.flags.indexOf('referer') === -1) || (!route.isMULTIPLE && route.isJSON && req.flags.indexOf('json') === -1))
			return 0;
	}

	var isRole = false;
	var hasRoles = false;

	for (var i = 0, length = req.flags.length; i < length; i++) {

		var flag = req.flags[i];
		switch (flag) {
			case 'json':
				continue;
			case 'xml':
				if (route.isRAW || route.isXML)
					continue;
				return 0;

			case 'proxy':
				if (!route.isPROXY)
					return 0;
				continue;

			case 'debug':
				if (!route.isDEBUG && route.isRELEASE)
					return 0;
				continue;

			case 'release':
				if (!route.isRELEASE && route.isDEBUG)
					return 0;
				continue;

			case 'referer':
				continue;

			case 'upload':
				if (!route.isUPLOAD)
					return 0;
				continue;

			case 'https':
				if (!route.isHTTPS && route.isHTTP)
					return 0;
				continue;

			case 'http':
				if (!route.isHTTP && route.isHTTPS)
					return 0;
				continue;

			case 'xhr':
			case '+xhr':
				if (!route.isBOTH && !route.isXHR)
					return 0;
				continue;
		}

		var role = flag[0] === '@';

		if (membertype !== 1 && route.MEMBER !== 1) {
			if ((!route.isGET && !role && !route.flags2[flag]) || (route.isROLE && role && !route.flags2[flag]) || (route.isROLE && !role))
				return 0;
			continue;
		}

		// Is some role verified?
		if (role && isRole && !route.isROLE)
			continue;

		if (!role && !route.flags2[flag])
			return 0;

		if (role) {
			if (route.flags2[flag])
				isRole = true;
			hasRoles = true;
		}
	}

	return (route.isROLE && hasRoles) ? isRole ? 1 : -1 : 1;
};

/**
 * Create arguments for controller's action
 * @param {String Array} routeUrl
 * @param {Object} route
 * @return {String Array}
 */
exports.routeParam = function(routeUrl, route) {

	if (!route || !routeUrl || !route.param.length)
		return EMPTYARRAY;

	var arr = [];

	for (var i = 0, length = route.param.length; i < length; i++) {
		var value = routeUrl[route.param[i]];
		arr.push(value === '/' ? '' : value);
	}

	return arr;
};

function HttpFile() {
	this.name;
	this.filename;
	this.type;
	this.path;
	this.length = 0;
	this.width = 0;
	this.height = 0;
	this.rem = true;
}

HttpFile.prototype.rename = HttpFile.prototype.move = function(filename, callback) {
	var self = this;
	Fs.rename(self.path, filename, function(err) {

		if (!err) {
			self.path = filename;
			self.rem = false;
		}

		callback && callback(err);
	});
	return self;
};

HttpFile.prototype.copy = function(filename, callback) {

	var self = this;

	if (!callback) {
		Fs.createReadStream(self.path).pipe(Fs.createWriteStream(filename));
		return;
	}

	var reader = Fs.createReadStream(self.path);
	var writer = Fs.createWriteStream(filename);

	reader.on('close', callback);
	reader.pipe(writer);
	return self;
};

HttpFile.prototype.$$rename = HttpFile.prototype.$$move = function(filename) {
	var self = this;
	return function(callback) {
		return self.rename(filename, callback);
	};
};

HttpFile.prototype.$$copy = function(filename) {
	var self = this;
	return function(callback) {
		return self.copy(filename, callback);
	};
};

HttpFile.prototype.readSync = function() {
	return Fs.readFileSync(this.path);
};

HttpFile.prototype.read = function(callback) {
	var self = this;
	Fs.readFile(self.path, callback);
	return self;
};

HttpFile.prototype.$$read = function() {
	var self = this;
	return function(callback) {
		self.read(callback);
	};
};

HttpFile.prototype.md5 = function(callback) {
	var self = this;
	var md5 = Crypto.createHash('md5');
	var stream = Fs.createReadStream(self.path);

	stream.on('data', (buffer) => md5.update(buffer));
	stream.on('error', function(error) {
		if (callback) {
			callback(error, null);
			callback = null;
		}
	});

	onFinished(stream, function() {
		destroyStream(stream);
		if (callback) {
			callback(null, md5.digest('hex'));
			callback = null;
		}
	});

	return self;
};

HttpFile.prototype.$$md5 = function() {
	var self = this;
	return function(callback) {
		self.md5(callback);
	};
};

HttpFile.prototype.stream = function(options) {
	return Fs.createReadStream(this.path, options);
};

HttpFile.prototype.pipe = function(stream, options) {
	return Fs.createReadStream(this.path, options).pipe(stream, options);
};

HttpFile.prototype.isImage = function() {
	return this.type.indexOf('image/') !== -1;
};

HttpFile.prototype.isVideo = function() {
	return this.type.indexOf('video/') !== -1;
};

HttpFile.prototype.isAudio = function() {
	return this.type.indexOf('audio/') !== -1;
};

HttpFile.prototype.image = function(im) {
	if (im === undefined)
		im = F.config['default-image-converter'] === 'im';
	return framework_image.init(this.path, im, this.width, this.height);
};

// *********************************************************************************
// =================================================================================
// JS CSS + AUTO-VENDOR-PREFIXES
// =================================================================================
// *********************************************************************************

function compile_autovendor(css) {
	var avp = '/*auto*/';
	var isAuto = css.substring(0, 100).indexOf(avp) !== -1;
	if (isAuto)
		css = autoprefixer(css.replace(avp, ''));
	return css.replace(REG_CSS_1, '').replace(REG_CSS_2, '{').replace(REG_CSS_3, '}').replace(REG_CSS_4, ':').replace(REG_CSS_5, ';').replace(REG_CSS_6, function(search, index, text) {
		for (var i = index; i > 0; i--) {
			if ((text[i] === '\'' || text[i] === '"') && (text[i - 1] === ':'))
				return search;
		}
		return ',';
	}).replace(REG_CSS_7, '}').replace(REG_CSS_8, '{').replace(REG_CSS_9, '}').trim();
}

function autoprefixer(value) {

	value = autoprefixer_keyframes(value);

	var builder = [];
	var index = 0;
	var property;

	// properties
	for (var i = 0, length = AUTOVENDOR.length; i < length; i++) {

		property = AUTOVENDOR[i];
		index = 0;

		while (index !== -1) {

			index = value.indexOf(property, index + 1);
			if (index === -1)
				continue;

			var a = value.indexOf(';', index);
			var b = value.indexOf('}', index);

			var end = Math.min(a, b);
			if (end === -1)
				end = Math.max(a, b);

			if (end === -1)
				continue;

			// text-transform
			var isPrefix = value.substring(index - 1, index) === '-';
			if (isPrefix)
				continue;

			var css = value.substring(index, end);
			end = css.indexOf(':');

			if (end === -1 || css.substring(0, end + 1).replace(/\s/g, '') !== property + ':')
				continue;

			builder.push({ name: property, property: css });
		}
	}

	var output = [];
	var length = builder.length;

	for (var i = 0; i < length; i++) {

		var name = builder[i].name;
		property = builder[i].property;

		var plus = property;
		var delimiter = ';';
		var updated = plus + delimiter;

		if (name === 'opacity') {
			var opacity = +plus.replace('opacity', '').replace(':', '').replace(/\s/g, '');
			if (isNaN(opacity))
				continue;
			updated += 'filter:alpha(opacity=' + Math.floor(opacity * 100) + ')';
			value = value.replacer(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		if (name === 'font-smoothing') {
			updated = plus + delimiter;
			updated += plus.replacer('font-smoothing', '-webkit-font-smoothing') + delimiter;
			updated += plus.replacer('font-smoothing', '-moz-osx-font-smoothing');
			value = value.replacer(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		if (name === 'background' || name === 'background-image') {
			if (property.indexOf('repeating-linear-gradient') !== -1) {
				updated = plus.replacer('repeating-linear-', '-webkit-repeating-linear-') + delimiter;
				updated += plus.replacer('repeating-linear-', '-moz-repeating-linear-') + delimiter;
				updated += plus.replacer('repeating-linear-', '-ms-repeating-linear-') + delimiter;
				updated += plus;
				value = value.replacer(property, '@[[' + output.length + ']]');
				output.push(updated);
			} else if (property.indexOf('repeating-radial-gradient') !== -1) {
				updated = plus.replacer('repeating-radial-', '-webkit-repeating-radial-') + delimiter;
				updated += plus.replacer('repeating-radial-', '-moz-repeating-radial-') + delimiter;
				updated += plus.replacer('repeating-radial-', '-ms-repeating-radial-') + delimiter;
				updated += plus;
				value = value.replacer(property, '@[[' + output.length + ']]');
				output.push(updated);
			} else if (property.indexOf('linear-gradient') !== -1) {
				updated = plus.replacer('linear-', '-webkit-linear-') + delimiter;
				updated += plus.replacer('linear-', '-moz-linear-') + delimiter;
				updated += plus.replacer('linear-', '-ms-linear-') + delimiter;
				updated += plus;
				value = value.replacer(property, '@[[' + output.length + ']]');
				output.push(updated);
			} else if (property.indexOf('radial-gradient') !== -1) {
				updated = plus.replacer('radial-', '-webkit-radial-') + delimiter;
				updated += plus.replacer('radial-', '-moz-radial-') + delimiter;
				updated += plus.replacer('radial-', '-ms-radial-') + delimiter;
				updated += plus;
				value = value.replacer(property, '@[[' + output.length + ']]');
				output.push(updated);
			}

			continue;
		}

		if (name === 'text-overflow') {
			updated = plus + delimiter;
			updated += plus.replacer('text-overflow', '-ms-text-overflow');
			value = value.replacer(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		if (name === 'display') {
			if (property.indexOf('box') === -1)
				continue;
			updated = plus + delimiter;
			updated += plus.replacer('box', '-webkit-box') + delimiter;
			updated += plus.replacer('box', '-moz-box');
			value = value.replacer(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		updated += '-webkit-' + plus + delimiter;
		updated += '-moz-' + plus;

		if (name.indexOf('animation') === -1)
			updated += delimiter + '-ms-' + plus;

		value = value.replacer(property, '@[[' + output.length + ']]');
		output.push(updated);
	}

	length = output.length;
	for (var i = 0; i < length; i++)
		value = value.replacer('@[[' + i + ']]', output[i]);

	output = null;
	builder = null;
	return value;
}

function autoprefixer_keyframes(value) {

	var builder = [];
	var index = 0;

	while (index !== -1) {

		index = value.indexOf('@keyframes', index + 1);
		if (index === -1)
			continue;

		var counter = 0;
		var end = -1;

		for (var indexer = index + 10; indexer < value.length; indexer++) {

			if (value[indexer] === '{')
				counter++;

			if (value[indexer] !== '}')
				continue;

			if (counter > 1) {
				counter--;
				continue;
			}

			end = indexer;
			break;
		}

		if (end === -1)
			continue;

		var css = value.substring(index, end + 1);
		builder.push({ name: 'keyframes', property: css });
	}

	var output = [];
	var length = builder.length;

	for (var i = 0; i < length; i++) {

		var name = builder[i].name;
		var property = builder[i].property;

		if (name !== 'keyframes')
			continue;

		var plus = property.substring(1);
		var delimiter = '\n';

		var updated = '@' + plus + delimiter;

		updated += '@-webkit-' + plus + delimiter;
		updated += '@-moz-' + plus + delimiter;
		updated += '@-o-' + plus + delimiter;

		value = value.replacer(property, '@[[' + output.length + ']]');
		output.push(updated);
	}

	length = output.length;

	for (var i = 0; i < length; i++)
		value = value.replace('@[[' + i + ']]', output[i]);

	return value;
}

function minify_javascript(data) {

	var index = 0;
	var output = [];
	var isCS = false;
	var isCI = false;
	var alpha = /[0-9a-z$]/i;
	var white = /\W/;
	var skip = { '$': true, '_': true };
	var regexp = false;
	var scope;
	var prev;
	var next;
	var last;

	while (true) {

		var c = data[index];
		var prev = data[index - 1];
		var next = data[index + 1];

		index++;

		if (c === undefined)
			break;

		if (!scope) {

			if (!regexp) {
				if (c === '/' && next === '*') {
					isCS = true;
					continue;
				} else if (c === '*' && next === '/') {
					isCS = false;
					index++;
					continue;
				}

				if (isCS)
					continue;

				if (c === '/' && next === '/') {
					isCI = true;
					continue;
				} else if (isCI && (c === '\n' || c === '\r')) {
					isCI = false;
					alpha.test(last) && output.push(' ');
					last = '';
					continue;
				}

				if (isCI)
					continue;
			}

			if (c === '\t' || c === '\n' || c === '\r') {
				if (!last || !alpha.test(last))
					continue;
				output.push(' ');
				last = '';
				continue;
			}

			if (!regexp && (c === ' ' && (white.test(prev) || white.test(next)))) {
				if (!skip[prev] && !skip[next])
					continue;
			}

			if (regexp) {
				if ((last !== '\\' && c === '/') || (last === '\\' && c === '/' && output[output.length - 2] === '\\'))
					regexp = false;
			} else
				regexp = (last === '=' || last === '(' || last === ':' || last === '{' || last === '[' || last === '?') && (c === '/');
		}

		if (scope && c === '\\') {
			output.push(c);
			output.push(next);
			index++;
			last = next;
			continue;
		}

		if (!regexp && (c === '"' || c === '\'' || c === '`')) {

			if (scope && scope !== c) {
				output.push(c);
				continue;
			}

			if (c === scope)
				scope = 0;
			else
				scope = c;
		}

		if ((c === '}' && last === ';') || ((c === '}' || c === ']') && output[output.length - 1] === ' ' && alpha.test(output[output.length - 2])))
			output.pop();

		output.push(c);
		last = c;
	}

	return output.join('').trim();
}

exports.compile_css = function(value, filename) {

	if (global.F) {
		value = modificators(value, filename, 'style');
		if (F.onCompileStyle)
			return F.onCompileStyle(filename, value);
	}

	try {

		var isVariable = false;

		value = nested(value, '', function() {
			isVariable = true;
		});

		value = compile_autovendor(value);

		if (isVariable)
			value = variablesCSS(value);

		return value;
	} catch (ex) {
		F.error(new Error('CSS compiler exception: ' + ex.message));
		return '';
	}
};

exports.compile_javascript = function(source, filename) {

	if (global.F) {
		source = modificators(source, filename, 'script');
		if (F.onCompileScript)
			return F.onCompileScript(filename, source).trim();
	}

	return minify_javascript(source);
};

exports.compile_html = function(source, filename) {
	return compressCSS(compressJS(compressHTML(source, true), 0, filename), 0, filename);
};

// *********************************************************************************
// =================================================================================
// MULTIPART PARSER
// =================================================================================
// *********************************************************************************

// Copyright (c) 2010 Hongli Lai
// Copyright (c) Felix Geisendörfer -> https://github.com/felixge/node-formidable

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var Buffer = require('buffer').Buffer,
	s = 0,
	S = {
		PARSER_UNINITIALIZED: s++,
		START: s++,
		START_BOUNDARY: s++,
		HEADER_FIELD_START: s++,
		HEADER_FIELD: s++,
		HEADER_VALUE_START: s++,
		HEADER_VALUE: s++,
		HEADER_VALUE_ALMOST_DONE: s++,
		HEADERS_ALMOST_DONE: s++,
		PART_DATA_START: s++,
		PART_DATA: s++,
		PART_END: s++,
		END: s++
	},

	f = 1,
	FB = {
		PART_BOUNDARY: f,
		LAST_BOUNDARY: f *= 2
	},

	LF = 10,
	CR = 13,
	SPACE = 32,
	HYPHEN = 45,
	COLON = 58,
	A = 97,
	Z = 122,

	lower = function(c) {
		return c | 0x20;
	};

for (s in S) {
	exports[s] = S[s];
}

function MultipartParser() {
	this.boundary = null;
	this.boundaryChars = null;
	this.lookbehind = null;
	this.state = S.PARSER_UNINITIALIZED;
	this.index = null;
	this.flags = 0;
}

exports.MultipartParser = MultipartParser;

MultipartParser.stateToString = function(stateNumber) {
	for (var state in S) {
		var number = S[state];
		if (number === stateNumber) return state;
	}
};

MultipartParser.prototype.initWithBoundary = function(str) {
	var self = this;
	self.boundary = framework_utils.createBufferSize(str.length + 4);
	self.boundary.write('\r\n--', 0, 'ascii');
	self.boundary.write(str, 4, 'ascii');
	self.lookbehind = framework_utils.createBufferSize(self.boundary.length + 8);
	self.state = S.START;
	self.boundaryChars = {};
	for (var i = 0; i < self.boundary.length; i++)
		self.boundaryChars[self.boundary[i]] = true;
};

MultipartParser.prototype.write = function(buffer) {
	var self = this,
		i = 0,
		len = buffer.length,
		prevIndex = self.index,
		index = self.index,
		state = self.state,
		flags = self.flags,
		lookbehind = self.lookbehind,
		boundary = self.boundary,
		boundaryChars = self.boundaryChars,
		boundaryLength = self.boundary.length,
		boundaryEnd = boundaryLength - 1,
		bufferLength = buffer.length,
		c,
		cl,
		mark = function(name) {
			self[name + 'Mark'] = i;
		},
		clear = function(name) {
			delete self[name + 'Mark'];
		},
		callback = function(name, buffer, start, end) {
			if (start !== undefined && start === end)
				return;
			var callbackSymbol = 'on' + name.substr(0, 1).toUpperCase() + name.substr(1);
			if (callbackSymbol in self)
				self[callbackSymbol](buffer, start, end);
		},
		dataCallback = function(name, clear) {
			var markSymbol = name + 'Mark';
			if (!(markSymbol in self))
				return;
			if (!clear) {
				callback(name, buffer, self[markSymbol], buffer.length);
				self[markSymbol] = 0;
			} else {
				callback(name, buffer, self[markSymbol], i);
				delete self[markSymbol];
			}
		};

	for (i = 0; i < len; i++) {
		c = buffer[i];
		switch (state) {
			case S.PARSER_UNINITIALIZED:
				return i;
			case S.START:
				index = 0;
				state = S.START_BOUNDARY;
			case S.START_BOUNDARY:
				if (index == boundary.length - 2) {
					if (c === HYPHEN)
						flags |= FB.LAST_BOUNDARY;
					else if (c !== CR)
						return i;
					index++;
					break;
				} else if (index - 1 === boundary.length - 2) {
					if (flags & FB.LAST_BOUNDARY && c === HYPHEN) {
						callback('end');
						state = S.END;
						flags = 0;
					} else if (!(flags & FB.LAST_BOUNDARY) && c === LF) {
						index = 0;
						callback('partBegin');
						state = S.HEADER_FIELD_START;
					} else
						return i;
					break;
				}

				if (c !== boundary[index + 2])
					index = -2;
				if (c === boundary[index + 2])
					index++;
				break;
			case S.HEADER_FIELD_START:
				state = S.HEADER_FIELD;
				mark('headerField');
				index = 0;
			case S.HEADER_FIELD:
				if (c === CR) {
					clear('headerField');
					state = S.HEADERS_ALMOST_DONE;
					break;
				}

				index++;
				if (c === HYPHEN)
					break;

				if (c === COLON) {
					// empty header field
					if (index === 1)
						return i;
					dataCallback('headerField', true);
					state = S.HEADER_VALUE_START;
					break;
				}

				cl = lower(c);
				if (cl < A || cl > Z)
					return i;
				break;
			case S.HEADER_VALUE_START:
				if (c === SPACE)
					break;
				mark('headerValue');
				state = S.HEADER_VALUE;
			case S.HEADER_VALUE:
				if (c === CR) {
					dataCallback('headerValue', true);
					callback('headerEnd');
					state = S.HEADER_VALUE_ALMOST_DONE;
				}
				break;
			case S.HEADER_VALUE_ALMOST_DONE:
				if (c !== LF)
					return i;
				state = S.HEADER_FIELD_START;
				break;
			case S.HEADERS_ALMOST_DONE:
				if (c !== LF)
					return i;
				callback('headersEnd');
				state = S.PART_DATA_START;
				break;
			case S.PART_DATA_START:
				state = S.PART_DATA;
				mark('partData');
			case S.PART_DATA:
				prevIndex = index;

				if (!index) {
					// boyer-moore derrived algorithm to safely skip non-boundary data
					i += boundaryEnd;
					while (i < bufferLength && !(buffer[i] in boundaryChars))
						i += boundaryLength;
					i -= boundaryEnd;
					c = buffer[i];
				}

				if (index < boundary.length) {
					if (boundary[index] === c) {
						if (!index)
							dataCallback('partData', true);
						index++;
					} else
						index = 0;
				} else if (index === boundary.length) {
					index++;
					if (c === CR) {
						// CR = part boundary
						flags |= FB.PART_BOUNDARY;
					} else if (c === HYPHEN) {
						// HYPHEN = end boundary
						flags |= FB.LAST_BOUNDARY;
					} else
						index = 0;
				} else if (index - 1 === boundary.length) {
					if (flags & FB.PART_BOUNDARY) {
						index = 0;
						if (c === LF) {
							// unset the PART_BOUNDARY flag
							flags &= ~FB.PART_BOUNDARY;
							callback('partEnd');
							callback('partBegin');
							state = S.HEADER_FIELD_START;
							break;
						}
					} else if (flags & FB.LAST_BOUNDARY) {
						if (c === HYPHEN) {
							callback('partEnd');
							callback('end');
							state = S.END;
							flags = 0;
						} else
							index = 0;
					} else
						index = 0;
				}

				if (index) {
					// when matching a possible boundary, keep a lookbehind reference
					// in case it turns out to be a false lead
					lookbehind[index - 1] = c;
				} else if (prevIndex) {
					// if our boundary turned out to be rubbish, the captured lookbehind
					// belongs to partData
					callback('partData', lookbehind, 0, prevIndex);
					prevIndex = 0;
					mark('partData');
					// reconsider the current character even so it interrupted the sequence
					// it could be the beginning of a new sequence
					i--;
				}
				break;
			case S.END:
				break;
			default:
				return i;
		}
	}

	dataCallback('headerField');
	dataCallback('headerValue');
	dataCallback('partData');

	self.index = index;
	self.state = state;
	self.flags = flags;

	return len;
};

MultipartParser.prototype.end = function() {
	if ((this.state === S.HEADER_FIELD_START && this.index === 0) || (this.state === S.PART_DATA && this.index == this.boundary.length)) {
		this.onPartEnd && this.onPartEnd();
		this.onEnd && this.onEnd();
	} else if (this.state != S.END) {
		this.onPartEnd && this.onPartEnd();
		this.onEnd && this.onEnd();
		return new Error('MultipartParser.end(): stream ended unexpectedly: ' + this.explain());
	}
};

MultipartParser.prototype.explain = function() {
	return 'state = ' + MultipartParser.stateToString(this.state);
};

// *********************************************************************************
// =================================================================================
// VIEW ENGINE
// =================================================================================
// *********************************************************************************

function view_parse_localization(content, language) {

	var is = false;

	content = content.replace(REG_NOTRANSLATE, function() {
		is = true;
		return '';
	}).trim();

	if (is)
		return content;

	var command = view_find_localization(content, 0);
	var output = '';
	var end = 0;

	if (!command)
		return content;

	while (command) {

		if (command)
			output += content.substring(end ? end + 1 : 0, command.beg) + (command.command ? localize(language, command) : '');

		end = command.end;
		command = view_find_localization(content, command.end);
	}

	output += content.substring(end + 1);
	return output;
}

// Escaping ", ' and ` chars
function localize(language, command) {

	!language && (language = 'default');

	if (F.resources[language] && F.resources[language].$empty)
		return command.command;

	var output = F.translate(language, command.command);

	if (command.escape) {
		var index = 0;
		while (true) {
			index = output.indexOf(command.escape, index);
			if (index === -1)
				break;
			var c = output[index - 1];
			if (c !== '\\') {
				output = output.substring(0, index) + '\\' + output.substring(index);
				index++;
			} else
				index += 2;
		}
	}

	return output;
}

function view_parse(content, minify, filename, controller) {

	if (minify)
		content = removeComments(content);

	var nocompressHTML = false;
	var nocompressJS = false;
	var nocompressCSS = false;

	content = content.replace(REG_NOCOMPRESS, function(text) {

		var index = text.lastIndexOf(' ');
		if (index === -1)
			return '';

		switch (text.substring(index, text.length - 1).trim()) {
			case 'all':
				nocompressHTML = true;
				nocompressJS = true;
				nocompressCSS = true;
				break;
			case 'html':
				nocompressHTML = true;
				break;
			case 'js':
			case 'script':
			case 'javascript':
				nocompressJS = true;
				break;
			case 'css':
			case 'style':
				nocompressCSS = true;
				break;
		}

		return '';
	}).trim();

	if (!nocompressJS)
		content = compressJS(content, 0, filename);

	if (!nocompressCSS)
		content = compressCSS(content, 0, filename);

	content = F.$versionprepare(content);

	if (!nocompressHTML)
		content = compressView(content, minify, filename);

	var DELIMITER = '\'';
	var SPACE = ' ';
	var builder = 'var $EMPTY=\'\';var $length=0;var $source=null;var $tmp=index;var $output=$EMPTY';
	var command = view_find_command(content, 0);
	var isFirst = false;
	var txtindex = -1;
	var index = 0;

	if ((controller.$hasComponents || REG_COMPONENTS.test(content)) && REG_HEAD.test(content)) {

		index = content.indexOf('@{import(');

		var add = true;
		while (index !== -1) {
			var str = content.substring(index, content.indexOf(')', index));
			if (str.indexOf('components') !== -1) {
				add = false;
				break;
			} else
				index = content.indexOf('@{import(', index + str.length);
		}

		if (add && controller.$hasComponents) {
			if (controller.$hasComponents instanceof Array) {
				content = content.replace(REG_HEAD, function(text) {
					var str = '';
					for (var i = 0; i < controller.$hasComponents.length; i++) {
						var group = F.components.groups[controller.$hasComponents[i]];
						if (group)
							str += group.links;
					}
					return str + text;
				});
			} else
				content = content.replace(REG_HEAD, text => F.components.links + text);
		}
	}

	function escaper(value) {

		var is = REG_TAGREMOVE.test(value);

		if (!nocompressHTML) {
		//	value = compressHTML(value, minify, true);
		} else if (!isFirst) {
			isFirst = true;
			value = value.replace(/^\s+/, '');
		}

		if (!value)
			return '$EMPTY';

		if (!nocompressHTML && is)
			value += ' ';

		txtindex = $VIEWCACHE.indexOf(value);

		if (txtindex === -1) {
			txtindex = $VIEWCACHE.length;
			$VIEWCACHE.push(value);
		}

		return '$VIEWCACHE[' + txtindex + ']';
	}

	if (!command)
		builder += '+' + escaper(content);

	index = 0;

	var old = null;
	var newCommand = '';
	var tmp = '';
	var counter = 0;
	var functions = [];
	var functionsName = [];
	var isFN = false;
	var isSECTION = false;
	var isCOMPILATION = false;
	var builderTMP = '';
	var sectionName = '';
	var text;

	while (command) {

		if (old) {
			text = content.substring(old.end + 1, command.beg);
			if (text) {
				if (view_parse_plus(builder))
					builder += '+';
				builder += escaper(text);
			}
		} else {
			text = content.substring(0, command.beg);
			if (text) {
				if (view_parse_plus(builder))
					builder += '+';
				builder += escaper(text);
			}
		}

		var cmd = content.substring(command.beg + 2, command.end).trim();

		var cmd8 = cmd.substring(0, 8);
		var cmd7 = cmd.substring(0, 7);

		if (cmd === 'continue' || cmd === 'break') {
			builder += ';' + cmd + ';';
			old = command;
			command = view_find_command(content, command.end);
			continue;
		}

		// cmd = cmd.replace
		command.command = command.command.replace(REG_HELPERS, function(text) {
			var index = text.indexOf('(');
			return index === - 1 ? text : text.substring(0, index) + '.call(self' + (text.endsWith('()') ? ')' : ',' + text.substring(index + 1));
		});

		if (cmd[0] === '\'' || cmd[0] === '"') {
			if (cmd[1] === '%') {
				var t = F.config[cmd.substring(2, cmd.length - 1)];
				if (t != null)
					builder += '+' + DELIMITER + t + DELIMITER;
			} else
				builder += '+' + DELIMITER + (new Function('self', 'return self.$import(' + cmd[0] + '!' + cmd.substring(1) + ')'))(controller) + DELIMITER;
		} else if (cmd7 === 'compile' && cmd.lastIndexOf(')') === -1) {

			builderTMP = builder + '+(F.onCompileView.call(self,\'' + (cmd8[7] === ' ' ? cmd.substring(8) : '') + '\',';
			builder = '';
			sectionName = cmd.substring(8);
			isCOMPILATION = true;
			isFN = true;

		} else if (cmd8 === 'section ' && cmd.lastIndexOf(')') === -1) {

			builderTMP = builder;
			builder = '+(function(){var $output=$EMPTY';
			sectionName = cmd.substring(8);
			isSECTION = true;
			isFN = true;

		} else if (cmd7 === 'helper ') {

			builderTMP = builder;
			builder = 'function ' + cmd.substring(7).trim() + '{var $output=$EMPTY';
			isFN = true;
			functionsName.push(cmd.substring(7, cmd.indexOf('(', 7)).trim());

		} else if (cmd8 === 'foreach ') {

			counter++;

			if (cmd.indexOf('foreach var ') !== -1)
				cmd = cmd.replace(' var ', SPACE);

			cmd = view_prepare_keywords(cmd);
			newCommand = (cmd.substring(8, cmd.indexOf(SPACE, 8)) || '').trim();
			index = cmd.trim().indexOf(SPACE, newCommand.length + 10);

			if (index === -1)
				index = cmd.indexOf('[', newCommand.length + 10);

			builder += '+(function(){var $source=' + cmd.substring(index).trim() + ';if(!($source instanceof Array))$source=framework_utils.ObjectToArray($source);if(!$source.length)return $EMPTY;var $length=$source.length;var $output=$EMPTY;var index=0;for(var $i=0;$i<$length;$i++){index=$i;var ' + newCommand + '=$source[$i];$output+=$EMPTY';
		} else if (cmd === 'end') {

			if (isFN && counter <= 0) {
				counter = 0;

				if (isCOMPILATION) {
					builder = builderTMP + 'unescape($EMPTY' + builder + '),model) || $EMPTY)';
					builderTMP = '';
				} else if (isSECTION) {
					builder = builderTMP + builder + ';repository[\'$section_' + sectionName + '\']=repository[\'$section_' + sectionName + '\']?repository[\'$section_' + sectionName + '\']+$output:$output;return $EMPTY})()';
					builderTMP = '';
				} else {
					builder += ';return $output;}';
					functions.push(builder);
					builder = builderTMP;
					builderTMP = '';
				}

				isSECTION = false;
				isCOMPILATION = false;
				isFN = false;

			} else {
				counter--;
				builder += '}return $output;})()';
				newCommand = '';
			}

		} else if (cmd.substring(0, 3) === 'if ') {
			builder += ';if (' + view_prepare_keywords(cmd).substring(3) + '){$output+=$EMPTY';
		} else if (cmd7 === 'else if') {
			builder += '} else if (' + view_prepare_keywords(cmd).substring(7) + ') {$output+=$EMPTY';
		} else if (cmd === 'else') {
			builder += '} else {$output+=$EMPTY';
		} else if (cmd === 'endif' || cmd === 'fi') {
			builder += '}$output+=$EMPTY';
		} else {

			tmp = view_prepare(command.command, newCommand, functionsName, controller);
			var can = false;

			// Inline rendering is supported only in release mode
			if (RELEASE && tmp.indexOf('+') === -1 && REG_SKIP_1.test(tmp) && !REG_SKIP_2.test(tmp)) {
				for (var a = 0, al = RENDERNOW.length; a < al; a++) {
					if (tmp.startsWith(RENDERNOW[a])) {
						if (!a) {
							var isMeta = tmp.indexOf('\'meta\'') !== -1;
							var isHead = tmp.indexOf('\'head\'') !== -1;
							var isComponent = tmp.indexOf('\'components\'') !== -1;
							tmp = tmp.replace(/'(meta|head|components)',/g, '').replace(/(,,|,\)|\s{1,})/g, '');
							if (isMeta || isHead || isComponent) {
								var tmpimp = '';
								if (isMeta)
									tmpimp += (isMeta ? '\'meta\'' : '');
								if (isHead)
									tmpimp += (tmpimp ? ',' : '') + (isHead ? '\'head\'' : '');
								if (isComponent)
									tmpimp += (tmpimp ? ',' : '') + (isComponent ? '\'components\'' : '');
								builder += '+self.$import(' + tmpimp + ')';
							}
						}
						can = true;
						break;
					}
				}
			}

			if (can && !counter) {
				try {
					var r = (new Function('self', 'config', 'return ' + tmp))(controller, F.config).replace(REG_7, '\\\\').replace(REG_8, '\\\'');
					if (r) {
						txtindex = $VIEWCACHE.indexOf(r);
						if (txtindex === -1) {
							txtindex = $VIEWCACHE.length;
							$VIEWCACHE.push(r);
						}
						builder += '+$VIEWCACHE[' + txtindex + ']';
					}
				} catch (e) {

					console.log('VIEW EXCEPTION --->', filename, e, tmp);
					F.errors.push({ error: e.stack, name: filename, url: null, date: new Date() });

					if (view_parse_plus(builder))
						builder += '+';
					builder += wrapTryCatch(tmp, command.command, command.line);
				}
			} else if (tmp) {
				if (view_parse_plus(builder))
					builder += '+';
				builder += wrapTryCatch(tmp, command.command, command.line);
			}
		}

		old = command;
		command = view_find_command(content, command.end);
	}

	if (old) {
		text = content.substring(old.end + 1);
		if (text)
			builder += '+' + escaper(text);
	}

	if (RELEASE)
		builder = builder.replace(/(\+\$EMPTY\+)/g, '+').replace(/(\$output=\$EMPTY\+)/g, '$output=').replace(/(\$output\+=\$EMPTY\+)/g, '$output+=').replace(/(\}\$output\+=\$EMPTY)/g, '}').replace(/(\{\$output\+=\$EMPTY;)/g, '{').replace(/(\+\$EMPTY\+)/g, '+').replace(/(>'\+'<)/g, '><').replace(/'\+'/g, '');

	var fn = '(function(self,repository,model,session,query,body,url,global,helpers,user,config,functions,index,output,cookie,files,mobile,settings){var get=query;var post=body;var G=F.global;var R=this.repository;var M=model;var theme=this.themeName;var language=this.language;var sitemap=this.repository.$sitemap;var cookie=function(name){return self.req.cookie(name)};' + (functions.length ? functions.join('') + ';' : '') + 'var controller=self;' + builder + ';return $output;})';
	try {
		fn = eval(fn);
	} catch (e) {
		throw new Error(filename + ': ' + e.message.toString());
	}
	return fn;
}

function view_prepare_keywords(cmd) {
	return cmd.replace(REG_SITEMAP, text => ' self.' + text.trim());
}

function wrapTryCatch(value, command, line) {
	return F.isDebug ? ('(function(){try{return ' + value + '}catch(e){throw new Error(unescape(\'' + escape(command) + '\') + \' - Line: ' + line + ' - \' + e.message.toString());}return $EMPTY})()') : value;
}

function view_parse_plus(builder) {
	var c = builder[builder.length - 1];
	return c !== '!' && c !== '?' && c !== '+' && c !== '.' && c !== ':';
}

function view_prepare(command, dynamicCommand, functions, controller) {

	var a = command.indexOf('.');
	var b = command.indexOf('(');
	var c = command.indexOf('[');

	var max = [];
	var tmp = 0;

	if (a !== -1)
		max.push(a);

	if (b !== -1)
		max.push(b);

	if (c !== -1)
		max.push(c);

	var index = Math.min.apply(this, max);

	if (index === -1)
		index = command.length;

	var name = command.substring(0, index);
	if (name === dynamicCommand)
		return '$STRING(' + command + ').encode()';

	if (name[0] === '!' && name.substring(1) === dynamicCommand)
		return '$STRING(' + command.substring(1) + ')';

	switch (name) {

		case 'foreach':
		case 'end':
			return '';

		case 'section':
			tmp = command.indexOf('(');
			return tmp === -1 ? '' : '(repository[\'$section_' + command.substring(tmp + 1, command.length - 1).replace(/'|"/g, '') + '\'] || \'\')';

		case 'log':
		case 'LOG':
			return '(' + (name === 'log' ? 'F.' : '') + command + '?$EMPTY:$EMPTY)';

		case 'logger':
		case 'LOGGER':
			return '(' + (name === 'logger' ? 'F.' : '') + command + '?$EMPTY:$EMPTY)';

		case 'console':
			return '(' + command + '?$EMPTY:$EMPTY)';

		case '!cookie':
			return '$STRING(' + command + ')';
		case '!isomorphic':
			return '$STRING(' + command + ')';

		case 'M':
		case 'R':
		case 'G':
		case 'model':
		case 'repository':
		case 'get':
		case 'post':
		case 'query':
		case 'global':
		case 'session':
		case 'user':
		case 'config':
		case 'controller':
			return view_is_assign(command) ? ('self.$set(' + command + ')') : ('$STRING(' + command + ').encode()');

		case 'body':
			return view_is_assign(command) ? ('self.$set(' + command + ')') : command.lastIndexOf('.') === -1 ? 'output' : ('$STRING(' + command + ').encode()');

		case 'files':
		case 'mobile':
		case 'continue':
		case 'break':
		case 'language':
		case 'TRANSLATE':
		case 'helpers':
			return command;

		case 'cookie':
		case 'isomorphic':
		case 'settings':
		case 'CONFIG':
		case 'function':
		case 'MODEL':
		case 'SCHEMA':
		case 'MODULE':
		case 'functions':
			return '$STRING(' + command + ').encode()';

		case '!M':
		case '!R':
		case '!G':
		case '!controller':
		case '!repository':
		case '!get':
		case '!post':
		case '!body':
		case '!query':
		case '!global':
		case '!session':
		case '!user':
		case '!config':
		case '!functions':
		case '!model':
		case '!CONFIG':
		case '!SCHEMA':
		case '!function':
		case '!MODEL':
		case '!MODULE':
			return '$STRING(' + command.substring(1) + ')';

		case 'resource':
			return '$STRING(self.' + command + ').encode()';
		case 'RESOURCE':
			return '$STRING(' + command + ').encode()';

		case '!resource':
			return '$STRING(self.' + command.substring(1) + ')';
		case '!RESOURCE':
			return '$STRING(' + command.substring(1) + ')';

		case 'host':
		case 'hostname':
			return command.indexOf('(') === -1 ? 'self.host()' : 'self.' + command;

		case 'href':
			return command.indexOf('(') === -1 ? 'self.href()' : 'self.' + command;

		case 'url':
			return command.indexOf('(') === -1 ? 'self.' + command : 'self.$' + command;

		case 'title':
		case 'description':
		case 'keywords':
		case 'author':
			return command.indexOf('(') === -1 ? '(repository[\'$' + command + '\'] || \'\').toString().encode()' : 'self.$' + command;

		case 'title2':
			return 'self.$' + command;

		case '!title':
		case '!description':
		case '!keywords':
		case '!author':
			return '(repository[\'$' + command.substring(1) + '\'] || \'\')';

		case 'head':
			return command.indexOf('(') === -1 ? 'self.' + command + '()' : 'self.$' + command;

		case 'sitemap_url':
		case 'sitemap_name':
		case 'sitemap_navigation':
			return 'self.' + command;

		case 'sitemap':
		case 'place':
			return command.indexOf('(') === -1 ? '(repository[\'$' + command + '\'] || \'\')' : 'self.$' + command;

		case 'meta':
			return command.indexOf('(') === -1 ? 'self.$meta()' : 'self.$' + command;

		case 'import':
		case 'favicon':
		case 'js':
		case 'css':
		case 'script':
		case 'absolute':
			return 'self.$' + command + (command.indexOf('(') === -1 ? '()' : '');

		case 'components':

			if (!controller.$hasComponents)
				controller.$hasComponents = [];

			if (controller.$hasComponents instanceof Array) {
				var group = command.match(REG_COMPONENTS_GROUP);
				if (group && group.length) {
					group = group[0].toString().replace(/'|"'/g, '');
					controller.$hasComponents.indexOf(group) === -1 && controller.$hasComponents.push(group);
				}
			}

			return 'self.$' + command + (command.indexOf('(') === -1 ? '()' : '');

		case 'index':
			return '(' + command + ')';

		case 'component':
			controller.$hasComponents = true;
			return 'self.' + command;

		case 'routeJS':
		case 'routeCSS':
		case 'routeScript':
		case 'routeStyle':
		case 'routeImage':
		case 'routeFont':
		case 'routeDownload':
		case 'routeVideo':
		case 'routeStatic':
			return 'self.' + command;
		case 'translate':
			return 'self.' + command;
		case 'json':
		case 'sitemap_change':
		case 'sitemap_replace':
		case 'sitemap_add':
		case 'helper':
		case 'view':
		case 'layout':
		case 'image':
		case 'template':
		case 'templateToggle':
		case 'viewCompile':
		case 'viewToggle':
		case 'download':
		case 'selected':
		case 'disabled':
		case 'checked':
		case 'etag':
		case 'header':
		case 'modified':
		case 'options':
		case 'readonly':
		case 'canonical':
		case 'dns':
		case 'next':
		case 'prefetch':
		case 'prerender':
		case 'prev':
			return 'self.$' + command;

		case 'now':
			return '(new Date()' + command.substring(3) + ')';

		case 'radio':
		case 'text':
		case 'checkbox':
		case 'hidden':
		case 'textarea':
		case 'password':
			return 'self.$' + exports.appendModel(command);

		default:
			return F.helpers[name] ? ('helpers.' + view_insert_call(command)) : ('$STRING(' + (functions.indexOf(name) === -1 ? command[0] === '!' ? command.substring(1) + ')' : command + ').encode()' : command + ')'));
	}
}

function view_insert_call(command) {

	var beg = command.indexOf('(');
	if (beg === -1)
		return command;

	var length = command.length;
	var count = 0;

	for (var i = beg + 1; i < length; i++) {

		var c = command[i];

		if (c !== '(' && c !== ')')
			continue;

		if (c === '(') {
			count++;
			continue;
		}

		if (count > 0) {
			count--;
			continue;
		}

		var arg = command.substring(beg + 1);
		return command.substring(0, beg) + '.call(self' + (arg.length > 1 ? ',' + arg : ')');
	}

	return command;
}

function view_is_assign(value) {

	var length = value.length;
	var skip = 0;

	for (var i = 0; i < length; i++) {

		var c = value[i];

		if (c === '[') {
			skip++;
			continue;
		}

		if (c === ']') {
			skip--;
			continue;
		}

		var next = value[i + 1] || '';

		if (c === '+' && (next === '+' || next === '=')) {
			if (!skip)
				return true;
		}

		if (c === '-' && (next === '-' || next === '=')) {
			if (!skip)
				return true;
		}

		if (c === '*' && (next === '*' || next === '=')) {
			if (!skip)
				return true;
		}

		if (c === '=') {
			if (!skip)
				return true;
		}

	}

	return false;
}

function view_find_command(content, index) {

	index = content.indexOf('@{', index);
	if (index === -1)
		return null;

	var length = content.length;
	var count = 0;

	for (var i = index + 2; i < length; i++) {
		var c = content[i];

		if (c === '{') {
			count++;
			continue;
		}

		if (c !== '}')
			continue;
		else if (count > 0) {
			count--;
			continue;
		}

		var command = content.substring(index + 2, i).trim();

		// @{{ SKIP }}
		if (command[0] === '{')
			return view_find_command(content, index + 1);

		return {
			beg: index,
			end: i,
			line: view_line_counter(content.substr(0, index)),
			command: command
		};
	}

	return null;
}

function view_line_counter(value) {
	var count = value.match(/\n/g);
	return count ? count.length : 0;
}

function view_find_localization(content, index) {

	index = content.indexOf('@(', index);
	if (index === -1)
		return null;

	var length = content.length;
	var count = 0;
	var beg = content[index - 1];
	var esc = '';

	for (var i = index + 2; i < length; i++) {
		var c = content[i];

		if (c === '(') {
			count++;
			continue;
		}

		if (c !== ')')
			continue;
		else if (count) {
			count--;
			continue;
		}

		var end = content.substring(i + 1, i + 2);
		if (beg === end && beg === '"' || beg === '\'' || beg === '`')
			esc = beg;
		return { beg: index, end: i, command: content.substring(index + 2, i).trim(), escape: esc };
	}

	return null;
}

function removeComments(html) {
	var tagBeg = '<!--';
	var tagEnd = '-->';
	var beg = html.indexOf(tagBeg);
	var end = 0;

	while (beg !== -1) {
		end = html.indexOf(tagEnd, beg + 4);

		if (end === -1)
			break;

		var comment = html.substring(beg, end + 3);
		if (comment.indexOf('[if') !== -1 || comment.indexOf('[endif') !== -1) {
			beg = html.indexOf(tagBeg, end + 3);
		} else {
			html = html.replacer(comment, '');
			beg = html.indexOf(tagBeg, beg);
		}
	}

	return html;
}

function compressView(html, minify) {

	var cache = [];

	while (true) {
		var beg = html.indexOf('@{');
		if (beg === -1)
			break;
		var end = html.indexOf('}', beg + 2);
		if (end === -1)
			break;
		cache.push(html.substring(beg, end + 1));
		html = html.substring(0, beg) + '#@' + (cache.length - 1) + '#' + html.substring(end + 1);
	}

	html = compressHTML(html, minify, false);

	return html.replace(/#@\d+#/g, function(text) {
		return cache[+text.substring(2, text.length - 1)];
	});
}

/**
 * Inline JS compressor
 * @private
 * @param  {String} html HTML.
 * @param  {Number} index Last index.
 * @return {String}
 */
function compressJS(html, index, filename) {

	if (!F.config['allow-compile-script'])
		return html;

	var strFrom = '<script type="text/javascript">';
	var strTo = '</script>';

	var indexBeg = html.indexOf(strFrom, index || 0);
	if (indexBeg === -1) {
		strFrom = '<script>';
		indexBeg = html.indexOf(strFrom, index || 0);
		if (indexBeg === -1)
			return html;
	}

	var indexEnd = html.indexOf(strTo, indexBeg + strFrom.length);
	if (indexEnd === -1)
		return html;

	var js = html.substring(indexBeg, indexEnd + strTo.length).trim();
	var beg = html.indexOf(js);
	if (beg === -1)
		return html;

	var val = js.substring(strFrom.length, js.length - strTo.length).trim();
	var compiled = exports.compile_javascript(val, filename);
	html = html.replacer(js, strFrom + compiled.trim() + strTo.trim());
	return compressJS(html, indexBeg + compiled.length + 9, filename);
}

function compressCSS(html, index, filename) {

	if (!F.config['allow-compile-style'])
		return html;

	var strFrom = '<style type="text/css">';
	var strTo = '</style>';

	var indexBeg = html.indexOf(strFrom, index || 0);
	if (indexBeg === -1) {
		strFrom = '<style>';
		indexBeg = html.indexOf(strFrom, index || 0);
		if (indexBeg === -1)
			return html;
	}

	var indexEnd = html.indexOf(strTo, indexBeg + strFrom.length);
	if (indexEnd === -1)
		return html;

	var css = html.substring(indexBeg, indexEnd + strTo.length);
	var val = css.substring(strFrom.length, css.length - strTo.length).trim();
	var compiled = exports.compile_css(val, filename);
	html = html.replacer(css, (strFrom + compiled.trim() + strTo).trim());
	return compressCSS(html, indexBeg + compiled.length + 8, filename);
}

function variablesCSS(content) {

	if (!content)
		return content;

	var variables = {};

	content = content.replace(REG_CSS_10, function(text) {
		var index = text.indexOf(':');
		if (index === -1)
			return text;
		var key = text.substring(0, index).trim();
		variables[key] = text.substring(index + 1, text.length - 1).trim();
		return '';
	});

	content = content.replace(REG_CSS_11, function(text) {
		var variable = variables[text];
		return variable ? variable : text;
	}).trim();

	return content;
}

function nested(css, id, variable) {

	if (!css)
		return css;

	var index = 0;
	var output = '';
	var A = false;
	var count = 0;
	var beg;
	var begAt;
	var valid = false;
	var plus = '';
	var skip = false;
	var skipImport = '';
	var isComment = false;
	var comment = '';
	var skipView = false;
	var skipType;

	while (true) {

		var a = css[index++];
		if (!a)
			break;

		if (a === '/' && css[index] === '*') {
			isComment = true;
			index++;
			comment = '';
			continue;
		}

		if (isComment) {
			comment += a;
			if (a === '*' && css[index] === '/') {
				isComment = false;
				index++;
				if (comment === 'auto*')
					output += '/*auto*/';
			}
			continue;
		}

		if (a === '\n' || a === '\r')
			continue;

		if (a === '$' && variable)
			variable();

		if (a === '@' && css[index] === '{')
			skipView = true;

		if (skipView) {
			plus += a;
			if (a === '}')
				skipView = false;
			continue;
		}

		if (a === '\'' || a === '"') {
			if (a === skipType && css[index] !== '\\')
				skipType = '';
			else if (!skipType) {
				skipType = a;
			}
		}

		if (skipType) {
			plus += a;
			continue;
		}

		if (a === '@') {
			begAt = index;
			skip = true;
		}

		if (skip && !skipImport && (a === ';' || a === '{')) {
			skipImport = a;
			if (a === ';') {
				output += css.substring(begAt - 1, index);
				skip = false;
				plus = '';
				continue;
			}
		}

		plus += a;

		if (a === '{') {

			if (A) {
				count++;
				continue;
			}

			A = true;
			count = 0;
			beg = index;
			valid = false;
			continue;
		}

		if (a === '}') {

			if (count > 0) {
				count--;
				valid = true;
				continue;
			}

			if (!valid) {
				output += plus;
				plus = '';
				A = false;
				skip = false;
				skipImport = '';
				continue;
			}

			if (skip) {

				if (plus.indexOf('@keyframes') !== -1) {
					output += plus;
				} else {
					begAt = plus.indexOf('{');
					output += plus.substring(0, begAt + 1) + process_nested(plus.substring(begAt), id).trim() + '}';
				}

				A = false;
				skip = false;
				skipImport = '';
				plus = '';

				continue;
			}

			var ni = beg - 1;
			var name = '';

			while (true) {
				var b = css[ni--];
				if (b === '{')
					continue;
				if (b === '}' || b === '\n' || b === '\r' || b === undefined || (skipImport && skipImport === b))
					break;
				name = b + name;
			}

			A = false;
			skip = false;
			skipImport = '';
			plus = '';
			output += process_nested(css.substring(beg - 1, index), (id || '') + name.trim());
		}
	}

	return output + plus;
}

function process_nested(css, name) {
	css = css.trim();
	css = make_nested(css.substring(1, css.length - 1), name);
	return nested(css, name);
}

function make_nested(css, name) {

	var index = 0;
	var plus = '';
	var output = '';
	var count = 0;
	var A = false;
	var valid = false;

	while (true) {
		var a = css[index++];

		if (!a)
			break;

		if (a === '\n' || a === '\r')
			continue;

		if (a !== ' ' || plus[plus.length -1] !== ' ')
			plus += a;

		if (a === '{') {

			if (A) {
				count++;
				continue;
			}

			A = true;
			count = 0;
			valid = false;
			continue;
		}

		if (a === '}') {

			if (count > 0) {
				count--;
				valid = true;
				continue;
			}

			if (!valid) {
				output += name + ' ' + plus.trim();
				plus = '';
				A = false;
				continue;
			}

			output += plus;
		}
	}

	return output;
}

function compressHTML(html, minify, isChunk) {

	if (!html || !minify)
		return html;

	html = removeComments(html);

	var tags = ['script', 'textarea', 'pre', 'code'];
	var id = '[' + new Date().getTime() + ']#';
	var cache = {};
	var indexer = 0;
	var length = tags.length;
	var chars = 65;

	for (var i = 0; i < length; i++) {
		var o = tags[i];

		var tagBeg = '<' + o;
		var tagEnd = '</' + o;

		var beg = html.indexOf(tagBeg);
		var end = 0;
		var len = tagEnd.length;

		while (beg !== -1) {

			end = html.indexOf(tagEnd, beg + 3);
			if (end === -1) {
				if (isChunk)
					end = html.length;
				else
					break;
			}

			var key = id + (indexer++) + String.fromCharCode(chars++);
			if (chars > 90)
				chars = 65;

			var value = html.substring(beg, end + len);

			if (!i) {
				end = value.indexOf('>');
				len = value.indexOf('type="text/template"');

				if (len < end && len !== -1) {
					beg = html.indexOf(tagBeg, beg + tagBeg.length);
					continue;
				}

				len = value.indexOf('type="text/html"');

				if (len < end && len !== -1) {
					beg = html.indexOf(tagBeg, beg + tagBeg.length);
					continue;
				}

				len = value.indexOf('type="text/ng-template"');

				if (len < end && len !== -1) {
					beg = html.indexOf(tagBeg, beg + tagBeg.length);
					continue;
				}
			}

			cache[key] = value;
			html = html.replacer(value, key);
			beg = html.indexOf(tagBeg, beg + tagBeg.length);
		}
	}

	while (true) {
		if (!REG_6.test(html))
			break;
		html = html.replace(REG_6, text => text.replace(/\s+/g, ' '));
	}

	html = html.replace(/>\n\s+/g, '>').replace(/(\w|\W)\n\s+</g, function(text) {
		return text.trim().replace(/\s/g, '');
	}).replace(REG_5, '><').replace(REG_4, function(text) {
		var c = text[text.length - 1];
		return c === '<' ? c : ' ' + c;
	}).replace(REG_1, '').replace(REG_2, '');

	for (var key in cache)
		html = html.replacer(key, cache[key]);

	return html;
}

/**
 * Read file
 * @param {String} path
 * @return {Object}
 */
function viewengine_read(path, controller) {
	var config = F.config;
	var out = path[0] === '.';
	var filename = out ? path.substring(1) : F.path.views(path);
	var key;

	if (RELEASE) {
		key = '404/' + path;
		var is = F.temporary.other[key];
		if (is !== undefined)
			return null;
	}

	if (existsSync(filename))
		return view_parse(view_parse_localization(modificators(Fs.readFileSync(filename).toString('utf8'), filename), controller.language), config['allow-compile-html'], filename, controller);

	var index;

	if (out) {

		if (controller.themeName) {
			index = filename.lastIndexOf('/');
			if (index !== -1) {
				filename = filename.substring(0, filename.lastIndexOf('/', index - 1)) + filename.substring(index);
				if (existsSync(filename))
					return view_parse(view_parse_localization(modificators(Fs.readFileSync(filename).toString('utf8'), filename), controller.language), config['allow-compile-html'], filename, controller);
			}
		}

		if (RELEASE)
			F.temporary.other[key] = null;

		return null;
	}

	index = path.lastIndexOf('/');
	if (index === -1) {
		if (RELEASE)
			F.temporary.other[key] = null;
		return null;
	}

	filename = F.path.views(path.substring(index + 1));

	if (existsSync(filename))
		return view_parse(view_parse_localization(modificators(Fs.readFileSync(filename).toString('utf8'), filename), controller.language), config['allow-compile-html'], filename, controller);

	if (RELEASE)
		F.temporary.other[key] = null;

	return null;
}

function modificators(value, filename, type) {

	if (!F.modificators)
		return value;

	for (var i = 0, length = F.modificators.length; i < length; i++) {
		var output = F.modificators[i](type || 'view', filename, value);
		if (output)
			value = output;
	}

	return value;
}

function viewengine_load(name, filename, controller) {

	var precompiled = F.routes.views[name];
	if (precompiled)
		filename = '.' + precompiled.filename;
	else
		filename += '.html';

	var key = 'view#' + filename + (controller.language || '');
	var generator = F.temporary.views[key];
	if (generator)
		return generator;

	generator = viewengine_read(filename, controller);

	if (!F.isDebug)
		F.temporary.views[key] = generator;

	return generator;
}

function viewengine_dynamic(content, language, controller, cachekey) {

	var generator = cachekey ? (F.temporary.views[cachekey] || null) : null;
	if (generator)
		return generator;

	generator = view_parse(view_parse_localization(modificators(content, ''), language), F.config['allow-compile-html'], null, controller);

	if (cachekey && !F.isDebug)
		F.temporary.views[cachekey] = generator;

	return generator;
}

exports.appendModel = function(str) {
	var index = str.indexOf('(');
	if (index === -1)
		return str;
	var end = str.substring(index + 1);
	return str.substring(0, index) + '(model' + (end[0] === ')' ? end : ',' + end);
};

function cleanURL(url, index) {
	var o = url.substring(0, index);
	var prev;
	var skip = false;

	for (var i = index, length = url.length; i < length; i++) {
		var c = url[i];
		if (c === '/' && prev === '/' && !skip)
			continue;
		prev = c;
		o += c;
	}

	return o;
}

exports.preparePath = function(path, remove) {
	var root = F.config['default-root'];
	if (!root)
		return path;
	var is = path[0] === '/';
	if ((is && path[1] === '/') || path[4] === ':' || path[5] === ':')
		return path;
	return remove ? path.substring(root.length - 1) : (root + (is ? path.substring(1) : path));
};

exports.parseURI = function(req) {

	var cache = F.temporary.other[req.host];
	var port;
	var hostname;

	if (cache) {
		port = cache.port;
		hostname = cache.hostname;
	} else {
		port = req.host.lastIndexOf(':');
		if (port === -1) {
			port = null;
			hostname = req.host;
		} else {
			hostname = req.host.substring(0, port);
			port = req.host.substring(port + 1);
		}
		F.temporary.other[req.host] = { port: port, hostname: hostname };
	}

	var search = req.url.indexOf('?', 1);
	var query = null;
	var pathname;

	if (search === -1) {
		search = null;
		pathname = req.url;
	} else {
		pathname = req.url.substring(0, search);
		search = req.url.substring(search);
		query = search.substring(1);
	}

	var index = pathname.indexOf('//');
	if (index !== -1) {
		pathname = cleanURL(pathname, index);
		req.url = pathname;
		if (search)
			req.url += search;
	}

	return { auth: null, hash: null, host: req.host, hostname: hostname, href: req.$protocol + '://' + req.host + req.url, path: req.url, pathname: pathname, port: port, protocol: req.$protocol + ':', query: query, search: search, slashes: true };
};

/**
 * Destroy the stream
 * @param {Stream} stream
 * @return {Stream}
 * @author Jonathan Ong <me@jongleberry.com>
 * @license MIT
 * @see {@link https://github.com/stream-utils/destroy}
 */
function destroyStream(stream) {
	if (stream instanceof ReadStream) {
		stream.destroy();
		typeof(stream.close) === 'function' && stream.on('open', function() {
			typeof(this.fd) === 'number' && this.close();
		});
	} else if (stream instanceof Stream)
		typeof(stream.destroy) === 'function' && stream.destroy();
	return stream;
}

function isFinished(stream) {

	// Response & Request
	if (stream.socket) {
		if (stream.writable && (!stream.socket._writableState || stream.socket._writableState.finished || stream.socket._writableState.destroyed))
			return true;
		if (stream.readable && (!stream.socket._readableState|| stream.socket._writableState.ended || stream.socket._readableState.destroyed))
			return true;
		return false;
	}

	if (stream._readableState && (stream._readableState.ended || stream._readableState.destroyed))
		return true;

	if (stream._writableState && (stream._writableState.finished || stream._writableState.destroyed))
		return true;

	return false;
}

function onFinished(stream, fn) {

	if (stream.$onFinished) {
		fn && fn();
		fn = null;
		return;
	}

	if (stream.$onFinishedQueue) {
		if (stream.$onFinishedQueue instanceof Array)
			stream.$onFinishedQueue.push(fn);
		else
			stream.$onFinishedQueue = [stream.$onFinishedQueue, fn];
		return;
	} else
		stream.$onFinishedQueue = fn;

	var callback = function() {
		!stream.$onFinished && (stream.$onFinished = true);
		if (stream.$onFinishedQueue instanceof Array) {
			while (stream.$onFinishedQueue.length)
				stream.$onFinishedQueue.shift()();
			stream.$onFinishedQueue = null;
		} else if (stream.$onFinishedQueue) {
			stream.$onFinishedQueue();
			stream.$onFinishedQueue = null;
		}
	};

	if (isFinished(stream)) {
		setImmediate(callback);
	} else {

		if (stream.socket) {
			if (!stream.socket.$totalstream) {
				stream.socket.$totalstream = stream;
				stream.socket.prependListener('error', callback);
				stream.socket.prependListener('close', callback);
			}
		}

		stream.prependListener('error', callback);
		stream.prependListener('end', callback);
		stream.prependListener('close', callback);
		stream.prependListener('aborted', callback);
		stream.prependListener('finish', callback);

		//stream.uri --> determines ServerRespone
		// stream.uri && stream.prependListener('aborted', callback);
		// (stream._writableState || stream.uri) && stream.prependListener('finish', callback);
	}
}

exports.encodeUnicodeURL = function(url) {
	var output = url;
	for (var i = 0, length = url.length; i < length; i++) {
		var code = url.charCodeAt(i);
		if (code > 127)
			output = output.replace(url[i], encodeURIComponent(url[i]));
	}
	return output;
};

exports.parseBlock = function(name, content) {

	// @{block name}
	//
	// @{end}

	if (!REG_BLOCK_BEG.test(content))
		return content;

	var newline = '\n';
	var lines = content.split(newline);
	var is = false;
	var skip = false;
	var builder = '';

	name = (name || '').replace(/\s/g, '').split(',');

	for (var i = 0, length = lines.length; i < length; i++) {

		var line = lines[i];

		if (!line)
			continue;

		if (REG_BLOCK_END.test(line)) {
			is = false;
			skip = false;
			continue;
		}

		if (is) {
			if (skip)
				continue;
			builder += line + newline;
			continue;
		}

		var index = line.search(REG_BLOCK_BEG);
		if (index === -1) {
			builder += line + newline;
			continue;
		}

		is = true;
		skip = true;

		var block = line.substring(index + 8, line.indexOf('}', index)).replace(/\|\|/g, ',').replace(/\s/g, '').split(',');
		for (var j = 0, jl = block.length; j < jl; j++) {
			if (name.indexOf(block[j]) === -1)
				continue;
			skip = false;
			break;
		}
	}

	return builder.trim();
};

function existsSync(filename) {
	try {
		return !!Fs.statSync(filename);
	} catch (e) {
		return false;
	}
}

exports.restart = function() {
	INDEXMIXED = 0;
	INDEXFILE = 0;
};

global.HttpFile = HttpFile;
exports.HttpFile = HttpFile;
exports.viewEngineCompile = viewengine_dynamic;
exports.viewEngine = viewengine_load;
exports.parseLocalization = view_parse_localization;
exports.findLocalization = view_find_localization;
exports.destroyStream = destroyStream;
exports.onFinished = onFinished;
exports.modificators = modificators;