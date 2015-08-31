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
 * @module FrameworkInternal
 * @version 1.9.1
 */

'use strict';

var crypto = require('crypto');
var fs = require('fs');
var ReadStream = require('fs').ReadStream;
var Stream = require('stream');

var ENCODING = 'utf8';
var UNDEFINED = 'undefined';
var FUNCTION = 'function';
var OBJECT = 'object';
var BOOLEAN = 'boolean';
var NUMBER = 'number';

var REG_1 = /[\n\r\t]+/g;
var REG_2 = /\s{2,}/g;
var REG_3 = /\/{1,}/g;
var REG_4 = /\n\s{2,}./g;
var REG_5 = />\n\s{1,}</g;

var HTTPVERBS = { 'GET': true, 'POST': true, 'OPTIONS': true, 'PUT': true, 'DELETE': true, 'PATCH': true, 'upload': true, 'HEAD': true, 'TRACE': true, 'PROPFIND': true };

global.$STRING = function(value) {
	if (value === null || value === undefined)
		return '';
	return value.toString();
};

/*
	Internal function / Parse data from Request
	@req {ServerRequest}
	@contentType {String}
	@maximumSize {Number}
	@tmpDirectory {String}
	@subscribe {Object}
*/
exports.parseMULTIPART = function(req, contentType, route, tmpDirectory, subscribe) {

	var parser = new MultipartParser();
	var boundary = contentType.split(';')[1];
	var size = 0;
	var stream = null;
	var maximumSize = route.length;
	var now = Date.now();
	var tmp;
	var close = 0;
	var rm = null;
	var ip = '';

	for (var i = 0, length = req.ip.length; i < length; i++) {
		if (req.ip[i] !== '.')
			ip += req.ip[i];
	}

	// Why indexOf(.., 2)? Because performance
	boundary = boundary.substring(boundary.indexOf('=', 2) + 1);

	req.buffer_exceeded = false;
	req.buffer_has = true;

	parser.initWithBoundary(boundary);

	parser.onPartBegin = function() {
		// Temporary data
		tmp = new HttpFile();
		tmp.$data = new Buffer('');
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

		if (!tmp.$is) {
			destroyStream(stream);
			return;
		}

		tmp.filename = header[1];
		tmp.path = framework_utils.combine(tmpDirectory, ip + '-' + now + '-' + framework_utils.random(100000) + '.upload');

		stream = fs.createWriteStream(tmp.path, { flags: 'w' });

		stream.once('close', function() {
			close--;
		});

		stream.once('error', function() {
			close--;
		});

		close++;
	};

	parser.onPartData = function(buffer, start, end) {

		if (req.buffer_exceeded)
			return;

		var data = buffer.slice(start, end);
		var length = data.length;

		size += length;

		if (size >= maximumSize) {
			req.buffer_exceeded = true;

			if (rm === null)
				rm = [tmp.path];
			else
				rm.push(tmp.path);

			return;
		}

		if (!tmp.$is) {
			tmp.$data = Buffer.concat([tmp.$data, data]);
			return;
		}

		if (tmp.length) {
			stream.write(data);
			tmp.length += length;
			return;
		}

		var wh = null;

		if (!req.behaviour('disable-measuring')) {
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
		}

		if (wh) {
			tmp.width = wh.width;
			tmp.height = wh.height;
		} else {
			tmp.width = 0;
			tmp.height = 0;
		}

		framework.emit('upload-begin', req, tmp);
		stream.write(data);
		tmp.length += length;
	};

	parser.onPartEnd = function() {

		if (stream !== null) {
			stream.end();
			stream = null;
		}

		if (req.buffer_exceeded)
			return;

		if (tmp.$is) {
			delete tmp.$data;
			delete tmp.$is;
			delete tmp.$step;

			req.files.push(tmp);
			framework.emit('upload-end', req, tmp);
			return;
		}

		tmp.$data = tmp.$data.toString(ENCODING);

		var temporary = req.body[tmp.name];
		if (temporary === undefined) {
			req.body[tmp.name] = tmp.$data;
			return;
		}

		if (temporary instanceof Array) {
			req.body[tmp.name].push(tmp.$data);
			return;
		}

		temporary = [temporary];
		temporary.push(tmp.$data);
		req.body[tmp.name] = temporary;
	};

	parser.onEnd = function() {
		var cb = function() {
			if (close > 0) {
				setImmediate(cb);
				return;
			}
			if (rm !== null)
				framework.unlink(rm);
			subscribe.doEnd();
		};
		cb();
	};

	req.on('data', function(chunk) {
		parser.write(chunk);
	});

	req.on('end', function() {
		parser.end();
	});
};

function parse_multipart_header(header) {

	var arr = new Array(2);
	var find = ' name="';
	var length = find.length;
	var beg = header.indexOf(find);
	var tmp = '';

	if (beg !== -1)
		tmp = header.substring(beg + length, header.indexOf('"', beg + length));

	if (!tmp)
		arr[0] = 'undefined_' + (Math.floor(Math.random() * 100000)).toString();
	else
		arr[0] = tmp;

	find = ' filename="';
	length = find.length;
	beg = header.indexOf(find);
	tmp = '';

	if (beg !== -1)
		tmp = header.substring(beg + length, header.indexOf('"', beg + length));

	if (beg !== -1)
		tmp = header.substring(beg + length, header.indexOf('"', beg + length));

	if (!tmp)
		arr[1] = null;
	else
		arr[1] = tmp;

	return arr;
}

exports.routeSplit = function(url, noLower) {

	var arr;

	if (!noLower) {
		arr = framework.temporary.other[url];
		if (arr)
			return arr;
	}

	if (!url || url === '/') {
		arr = new Array(1);
		arr[0] = '/';
		return arr;
	}

	var prev = false;
	var key = '';
	var count = 0;

	arr = [];

	for (var i = 0, length = url.length; i < length; i++) {
		var c = url[i];

		if (c === '/') {
			if (prev)
				continue;

			if (key) {
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
	else if (count === 0)
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

	if (count === 0)
		arr.push(url.substring(end + (arr.length ? 1 : 0), url.length));

	if (arr.length === 1 && arr[0] === '')
		arr[0] = '/';

	return arr;
};

/*
	Internal function / Compare route with url
	@route {String array}
	@url {String}
	@isSystem {Boolean}
	return {Boolean}
*/
exports.routeCompare = function(url, route, isSystem, isAsterix) {

	var length = url.length;
	var lengthRoute = route.length;

	if (lengthRoute !== length && !isAsterix)
		return false;

	if (isAsterix && lengthRoute === 1 && route[0] === '/')
		return true;

	var skip = length === 1 && url[0] === '/';

	for (var i = 0; i < length; i++) {

		var value = route[i];

		if (!isSystem && isAsterix && value === undefined)
			return true;

		if (!isSystem && (!skip && value[0] === '{'))
			continue;

		if (url[i] !== value) {
			if (!isSystem)
				return isAsterix ? i >= lengthRoute : false;
			return false;
		}
	}

	return true;
};

/*
	Internal function / Compare subdomain
	@subdomain {String}
	@arr {String array}
	return {Boolean}
*/
exports.routeCompareSubdomain = function(subdomain, arr) {

	if (arr === null || subdomain === null || !arr.length)
		return true;

	return arr.indexOf(subdomain) > -1;
};

exports.routeCompareFlags = function(arr1, arr2, noLoggedUnlogged) {

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

		if (noLoggedUnlogged && (value === AUTHORIZE || value === UNAUTHORIZE))
			continue;

		var index = compare.indexOf(value);
		var method = value.toUpperCase();

		if (index === -1 && !HTTPVERBS[method])
			return value === AUTHORIZE || value === UNAUTHORIZE ? -1 : 0;

		hasVerb = hasVerb || (index !== -1 && HTTPVERBS[method]);
	}

	return hasVerb ? 1 : 0;
};

exports.routeCompareFlags2 = function(req, route, noLoggedUnlogged) {

	if (!route.isWEBSOCKET) {
		if (route.isXHR && !req.xhr)
			return 0;
		if (route.isMOBILE && !req.mobile)
			return 0;
		var method = req.method;
		if (route.method) {
			if (route.method !== method)
				return 0;
		} else if (route.flags.indexOf(method.toLowerCase()) === -1)
			return 0;
		if (route.isREFERER && req.flags.indexOf('referer') === -1)
			return 0;
		if (!route.isMULTIPLE && route.isJSON && req.flags.indexOf('json') === -1)
			return 0;
	}

	var isRole = false;

	for (var i = 0, length = req.flags.length; i < length; i++) {

		var flag = req.flags[i];
		switch (flag) {
			case 'json':
				// skip
				/*
				if (!route.isJSON)
					return 0;
				*/
				continue;

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

		if (noLoggedUnlogged && route.isMEMBER)
			continue;

		var role = flag[0] === '@';

		// Is some role verified?
		if (role && isRole)
			continue;

		var index = route.flags.indexOf(flag);
		if (index === -1)
			return !route.isMEMBER ? -1 : 0;

		if (role)
			isRole = true;
	}

	return 1;
};

/**
 * Create arguments for controller action
 * @param {String Array} routeUrl
 * @param {Object} route
 * @return {String Array}
 */
exports.routeParam = function(routeUrl, route) {

	if (!route || !routeUrl)
		return new Array(0);

	var length = route.param.length;
	var arr = new Array(length);
	if (length === 0)
		return arr;

	for (var i = 0; i < length; i++) {
		var value = routeUrl[route.param[i]];
		arr[i] = value === '/' ? '' : value;
	}

	return arr;
};

/*
	HttpFile class
	@name {String}
	@filename {String}
	@path {String}
	@length {Number}
	@contentType {String}
	return {HttpFile}
*/
function HttpFile() {
	this.name;
	this.filename;
	this.type;
	this.path;
	this.length = 0;
	this.width = 0;
	this.height = 0;
}

HttpFile.prototype = {
	get contentType() {
		console.log('OBSOLETE: The HttpFile.contentType is deprecated. Use: HttpFile.type');
		return this.type;
	}
};

/*
	Read file to byte array
	@filename {String} :: new filename
	return {HttpFile}
*/
HttpFile.prototype.copy = function(filename, callback) {

	var self = this;

	if (!callback) {
		fs.createReadStream(self.path).pipe(fs.createWriteStream(filename));
		return;
	}

	var reader = fs.createReadStream(self.path);
	var writer = fs.createWriteStream(filename);

	reader.on('close', callback);
	reader.pipe(writer);

	return self;
};

HttpFile.prototype.$$copy = function(filename) {
	var self = this;
	return function(callback) {
		return self.copy(filename, callback);
	};
};

/*
	Read file to buffer (SYNC)
	return {Buffer}
*/
HttpFile.prototype.readSync = function() {
	return fs.readFileSync(this.path);
};

/*
	Read file to buffer (ASYNC)
	@callback {Function} :: function(error, data);
	return {HttpFile}
*/
HttpFile.prototype.read = function(callback) {
	var self = this;
	fs.readFile(self.path, callback);
	return self;
};

HttpFile.prototype.$$read = function() {
	var self = this;
	return function(callback) {
		self.read(callback);
	};
};

/*
	Create MD5 hash from a file
	@callback {Function} :: function(error, hash);
	return {HttpFile}
*/
HttpFile.prototype.md5 = function(callback) {

	var self = this;
	var md5 = crypto.createHash('md5');
	var stream = fs.createReadStream(self.path);

	stream.on('data', function(buffer) {
		md5.update(buffer);
	});

	stream.on('error', function(error) {
		callback(error, null);
	});

	onFinished(stream, function() {
		destroyStream(stream);
		callback(null, md5.digest('hex'));
	});

	return self;
};

HttpFile.prototype.$$md5 = function() {
	var self = this;
	return function(callback) {
		self.md5(callback);
	};
};

/*
	Get a stream
	@options {Object} :: optional
	return {Stream}
*/
HttpFile.prototype.stream = function(options) {
	var self = this;
	return fs.createReadStream(self.path, options);
};

/*
	Pipe a stream
	@stream {Stream}
	@options {Object} :: optional
	return {Stream}
*/
HttpFile.prototype.pipe = function(stream, options) {
	var self = this;
	return fs.createReadStream(self.path, options).pipe(stream, options);
};

/*
	return {Boolean}
*/
HttpFile.prototype.isImage = function() {
	var self = this;
	return self.type.indexOf('image/') !== -1;
};

/*
	return {Boolean}
*/
HttpFile.prototype.isVideo = function() {
	var self = this;
	return self.type.indexOf('video/') !== -1;
};

/*
	return {Boolean}
*/
HttpFile.prototype.isAudio = function() {
	var self = this;
	return self.type.indexOf('audio/') !== -1;
};

/*
	@imageMagick {Boolean} :: optional - default false
	return {Image} :: look at ./lib/image.js
*/
HttpFile.prototype.image = function(imageMagick) {

	var im = imageMagick;

	// Not a clean solution because the framework hasn't a direct dependence.
	// This is hack :-)
	if (im === undefined)
		im = framework.config['default-image-converter'] === 'im';

	return framework_image.init(this.path, im, this.width, this.height);
};

// *********************************************************************************
// =================================================================================
// JS CSS + AUTO-VENDOR-PREFIXES
// =================================================================================
// *********************************************************************************

function compile_autovendor(css) {

	var reg1 = /\n|\s{2,}/g;
	var reg2 = /\s?\{\s{1,}/g;
	var reg3 = /\s?\}\s{1,}/g;
	var reg4 = /\s?\:\s{1,}/g;
	var reg5 = /\s?\;\s{1,}/g;
	var reg6 = /\,\s{1,}/g;

	var avp = '@#auto-vendor-prefix#@';
	var isAuto = css.startsWith(avp);

	if (isAuto)
		css = css.replace(avp, '');
	else {
		avp = '/*auto*/';
		isAuto = css.indexOf(avp) !== -1;
		if (isAuto)
			css = css.replace(avp, '');
	}

	if (isAuto)
		css = autoprefixer(css);
	return css.replace(reg1, '').replace(reg2, '{').replace(reg3, '}').replace(reg4, ':').replace(reg5, ';').replace(reg6, function(search, index, text) {
		for (var i = index; i > 0; i--) {
			if (text[i] === '\'' || text[i] === '"') {
				if (text[i - 1] === ':')
					return search;
			}
		}
		return ',';
	}).replace(/\s\}/g, '}').replace(/\s\{/g, '{').trim();
}

/*
	Auto vendor prefixer
	@value {String} :: Raw CSS
	return {String}
*/
function autoprefixer(value) {

	var prefix = ['filter', 'appearance', 'column-count', 'column-gap', 'column-rule', 'display', 'transform', 'transform-style', 'transform-origin', 'transition', 'user-select', 'animation', 'perspective', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-play-state', 'opacity', 'background', 'background-image', 'font-smoothing', 'text-size-adjust', 'backface-visibility', 'box-sizing', 'overflow-scrolling'];

	value = autoprefixer_keyframes(value);

	var builder = [];
	var index = 0;
	var property;

	// properties
	for (var i = 0; i < prefix.length; i++) {

		property = prefix[i];
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
			// if (property === 'transform' && isPrefix)

			if (isPrefix)
				continue;

			var css = value.substring(index, end);
			end = css.indexOf(':');

			if (end === -1)
				continue;

			if (css.substring(0, end + 1).replace(/\s/g, '') !== property + ':')
				continue;

			builder.push({
				name: property,
				property: css
			});
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

			var opacity = parseFloat(plus.replace('opacity', '').replace(':', '').replace(/\s/g, ''));
			if (isNaN(opacity))
				continue;

			updated += 'filter:alpha(opacity=' + Math.floor(opacity * 100) + ');';

			value = value.replacer(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		if (name === 'background' || name === 'background-image') {

			if (property.indexOf('linear-gradient') === -1)
				continue;

			updated = plus.replacer('linear-', '-webkit-linear-') + delimiter;
			updated += plus.replacer('linear-', '-moz-linear-') + delimiter;
			updated += plus.replacer('linear-', '-o-linear-') + delimiter;
			updated += plus.replacer('linear-', '-ms-linear-') + delimiter;
			updated += plus + (plus[plus.length - 1] === ';' ? '' : delimiter);

			value = value.replacer(property, '@[[' + output.length + ']]');
			output.push(updated);
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

		updated += delimiter + '-o-' + plus;

		value = value.replacer(property, '@[[' + output.length + ']]');
		output.push(updated);
	}

	length = output.length;
	for (var i = 0; i < length; i++)
		value = value.replacer('@[[' + i + ']]', output[i]);

	output = null;
	builder = null;
	prefix = null;

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
		builder.push({
			name: 'keyframes',
			property: css
		});
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

	builder = null;
	output = null;

	return value;
}

exports.compile_css = function(value, filename) {

	if (global.framework) {

		if (framework.modificators) {
			for (var i = 0, length = framework.modificators.length; i < length; i++) {
				var output = framework.modificators[i]('style', filename, value);
				if (output)
					value = output;
			}
		}

		if (framework.onCompileStyle !== null)
			return framework.onCompileStyle(filename, value);

		if (framework.onCompileCSS !== null) {
			console.log('OBSOLETE: framework.onCompileCSS() is deprecated, use framework.onCompileStyle()');
			return framework.onCompileCSS(filename, value);
		}
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
		framework.error(new Error('CSS compiler exception: ' + ex.message));
		return '';
	}
};

// *********************************************************************************
// =================================================================================
// JavaScript compressor
// =================================================================================
// *********************************************************************************

// Copyright (c) 2002 Douglas Crockford  (www.crockford.com)
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

/*
	Minify JS
	@source {String}
	return {String}
*/
function JavaScript(source) {

	var EOF = -1;
	var sb = [];
	var theA; // int
	var theB; // int
	var theLookahead = EOF; // int
	var index = 0;

	function jsmin() {
		theA = 13;
		action(3);
		while (theA !== EOF) {
			switch (theA) {
				case 32:
					if (isAlphanum(theB))
						action(1);
					else
						action(2);
					break;
				case 13:
					switch (theB) {
						case 123:
						case 91:
						case 40:
						case 43:
						case 45:
							action(1);
							break;
						case 32:
							action(3);
							break;
						default:
							if (isAlphanum(theB))
								action(1);
							else
								action(2);
							break;
					}
					break;
				default:
					switch (theB) {
						case 32:
							if (isAlphanum(theA)) {
								action(1);
								break;
							}
							action(3);
							break;

						case 13:
							switch (theA) {
								case 125:
								case 93:
								case 41:
								case 43:
								case 45:
								case 34:
								case 92:
									action(1);
									break;
								default:
									if (isAlphanum(theA))
										action(1);
									else
										action(3);
									break;
							}
							break;
						default:
							action(1);
							break;
					}
					break;
			}
		}
	}

	function action(d) {
		if (d <= 1) {
			put(theA);
		}
		if (d <= 2) {
			theA = theB;
			if (theA === 39 || theA === 34) {
				for (;;) {
					put(theA);
					theA = get();
					if (theA === theB) {
						break;
					}
					if (theA <= 13) {
						if (framework)
							framework.error('Error: JSMIN unterminated string literal: ' + theA, 'JavaScript compressor');
						return;
					}
					if (theA === 92) {
						put(theA);
						theA = get();
					}
				}
			}
		}
		if (d <= 3) {
			theB = next();
			if (theB === 47 && (theA === 40 || theA === 44 || theA === 61 ||
				theA === 91 || theA === 33 || theA === 58 ||
				theA === 38 || theA === 124 || theA === 63 ||
				theA === 123 || theA === 125 || theA === 59 ||
				theA === 13)) {
				put(theA);
				put(theB);
				for (;;) {
					theA = get();
					if (theA === 47) {
						break;
					} else if (theA === 92) {
						put(theA);
						theA = get();
					} else if (theA <= 13) {
						c = EOF;
						return;
					}
					put(theA);
				}
				theB = next();
			}
		}
	}

	function next() {
		var c = get();

		if (c !== 47)
			return c;

		switch (peek()) {
			case 47:
				for (;;) {
					c = get();
					if (c <= 13)
						return c;
				}
				break;
			case 42:
				get();
				for (;;) {
					switch (get()) {
						case 42:
							if (peek() === 47) {
								get();
								return 32;
							}
							break;
						case EOF:
							c = EOF;
							return;
					}
				}
				break;
			default:
				return c;
		}

		return c;
	}

	function peek() {
		theLookahead = get();
		return theLookahead;
	}

	function get() {
		var c = theLookahead;
		theLookahead = EOF;
		if (c === EOF) {
			c = source.charCodeAt(index++);
			if (isNaN(c))
				c = EOF;
		}
		if (c >= 32 || c === 13 || c === EOF) {
			return c;
		}
		if (c === 10)
			return 13;
		return 32;
	}

	function put(c) {
		if (c === 13 || c === 10)
			sb.push(' ');
		else
			sb.push(String.fromCharCode(c));
	}

	function isAlphanum(c) {
		return ((c >= 97 && c <= 122) || (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || c === 95 || c === 36 || c === 92 || c > 126);
	}

	jsmin();
	return sb.join('');
}

exports.compile_javascript = function(source, filename) {

	var isFramework = (typeof(global.framework) === OBJECT);

	try {

		if (isFramework) {

			if (framework.modificators) {
				for (var i = 0, length = framework.modificators.length; i < length; i++) {
					var output = framework.modificators[i]('script', filename, source);
					if (output)
						source = output;
				}
			}

			if (framework.onCompileScript !== null)
				return framework.onCompileScript(filename, source).trim();

			if (framework.onCompileJS !== null) {
				console.log('OBSOLETE: framework.onCompileJS() is deprecated, use framework.onCompileScript()');
				return framework.onCompileJS(filename, source).trim();
			}
		}

		return JavaScript(source).trim();
	} catch (ex) {

		if (isFramework)
			framework.error(ex, 'JavaScript compressor');

		return source;
	}
};

exports.compile_html = function(source, filename) {
	return compressHTML(source, true);
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
	F = {
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

	self.boundary = new Buffer(str.length + 4);

	if (framework.versionNode > 0) {
		self.boundary.write('\r\n--', 0, 'ascii');
		self.boundary.write(str, 4, 'ascii');
	} else {
		self.boundary.write('\r\n--', 'ascii', 0);
		self.boundary.write(str, 'ascii', 4);
	}

	self.lookbehind = new Buffer(self.boundary.length + 8);
	self.state = S.START;

	self.boundaryChars = {};
	for (var i = 0; i < self.boundary.length; i++) {
		self.boundaryChars[self.boundary[i]] = true;
	}
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
			if (start !== undefined && start === end) {
				return;
			}

			var callbackSymbol = 'on' + name.substr(0, 1).toUpperCase() + name.substr(1);
			if (callbackSymbol in self) {
				self[callbackSymbol](buffer, start, end);
			}
		},
		dataCallback = function(name, clear) {
			var markSymbol = name + 'Mark';
			if (!(markSymbol in self)) {
				return;
			}

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
					if (c == HYPHEN) {
						flags |= F.LAST_BOUNDARY;
					} else if (c != CR) {
						return i;
					}
					index++;
					break;
				} else if (index - 1 == boundary.length - 2) {
					if (flags & F.LAST_BOUNDARY && c == HYPHEN) {
						callback('end');
						state = S.END;
						flags = 0;
					} else if (!(flags & F.LAST_BOUNDARY) && c == LF) {
						index = 0;
						callback('partBegin');
						state = S.HEADER_FIELD_START;
					} else {
						return i;
					}
					break;
				}

				if (c != boundary[index + 2]) {
					index = -2;
				}
				if (c == boundary[index + 2]) {
					index++;
				}
				break;
			case S.HEADER_FIELD_START:
				state = S.HEADER_FIELD;
				mark('headerField');
				index = 0;
			case S.HEADER_FIELD:
				if (c == CR) {
					clear('headerField');
					state = S.HEADERS_ALMOST_DONE;
					break;
				}

				index++;
				if (c == HYPHEN) {
					break;
				}

				if (c == COLON) {
					if (index == 1) {
						// empty header field
						return i;
					}
					dataCallback('headerField', true);
					state = S.HEADER_VALUE_START;
					break;
				}

				cl = lower(c);
				if (cl < A || cl > Z) {
					return i;
				}
				break;
			case S.HEADER_VALUE_START:
				if (c == SPACE) {
					break;
				}

				mark('headerValue');
				state = S.HEADER_VALUE;
			case S.HEADER_VALUE:
				if (c == CR) {
					dataCallback('headerValue', true);
					callback('headerEnd');
					state = S.HEADER_VALUE_ALMOST_DONE;
				}
				break;
			case S.HEADER_VALUE_ALMOST_DONE:
				if (c != LF) {
					return i;
				}
				state = S.HEADER_FIELD_START;
				break;
			case S.HEADERS_ALMOST_DONE:
				if (c != LF) {
					return i;
				}

				callback('headersEnd');
				state = S.PART_DATA_START;
				break;
			case S.PART_DATA_START:
				state = S.PART_DATA;
				mark('partData');
			case S.PART_DATA:
				prevIndex = index;

				if (index === 0) {
					// boyer-moore derrived algorithm to safely skip non-boundary data
					i += boundaryEnd;
					while (i < bufferLength && !(buffer[i] in boundaryChars)) {
						i += boundaryLength;
					}
					i -= boundaryEnd;
					c = buffer[i];
				}

				if (index < boundary.length) {
					if (boundary[index] == c) {
						if (index === 0) {
							dataCallback('partData', true);
						}
						index++;
					} else {
						index = 0;
					}
				} else if (index == boundary.length) {
					index++;
					if (c == CR) {
						// CR = part boundary
						flags |= F.PART_BOUNDARY;
					} else if (c == HYPHEN) {
						// HYPHEN = end boundary
						flags |= F.LAST_BOUNDARY;
					} else {
						index = 0;
					}
				} else if (index - 1 == boundary.length) {
					if (flags & F.PART_BOUNDARY) {
						index = 0;
						if (c == LF) {
							// unset the PART_BOUNDARY flag
							flags &= ~F.PART_BOUNDARY;
							callback('partEnd');
							callback('partBegin');
							state = S.HEADER_FIELD_START;
							break;
						}
					} else if (flags & F.LAST_BOUNDARY) {
						if (c == HYPHEN) {
							callback('partEnd');
							callback('end');
							state = S.END;
							flags = 0;
						} else {
							index = 0;
						}
					} else {
						index = 0;
					}
				}

				if (index > 0) {
					// when matching a possible boundary, keep a lookbehind reference
					// in case it turns out to be a false lead
					lookbehind[index - 1] = c;
				} else if (prevIndex > 0) {
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

	var self = this;

	var callback = function(self, name) {
		var callbackSymbol = 'on' + name.substr(0, 1).toUpperCase() + name.substr(1);
		if (callbackSymbol in self) {
			self[callbackSymbol]();
		}
	};

	if ((self.state == S.HEADER_FIELD_START && self.index === 0) ||
		(self.state == S.PART_DATA && self.index == self.boundary.length)) {
		callback(self, 'partEnd');
		callback(self, 'end');
	} else if (self.state != S.END) {
		callback(self, 'partEnd');
		callback(self, 'end');
		return new Error('MultipartParser.end(): stream ended unexpectedly: ' + self.explain());
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

/*
	View class
	return {View}
*/
function View() {}

function view_parse_localization(content, language) {

	var is = false;

	content = content.replace(/@\{notranslate\}/gi, function(text) {
		is = true;
		return '';
	}).trim();

	if (is)
		return content;

	var command = view_find_localization(content, 0);
	var output = '';
	var end = 0;

	if (command === null)
		return content;

	while (command !== null) {

		if (command !== null)
			output += content.substring(end === 0 ? 0 : end + 1, command.beg) + framework.translate(language, command.command);

		end = command.end;
		command = view_find_localization(content, command.end);
	}

	output += content.substring(end + 1);
	return output;
}

/**
 * View parser
 * @param {String} content
 * @param {Boolean} minify
 * @return {Function}
 */
function view_parse(content, minify, filename) {

	if (minify)
		content = removeComments(content);

	var nocompressHTML = false;
	var nocompressJS = false;
	var nocompressCSS = false;

	content = content.replace(/@\{nocompress\s\w+}/gi, function(text) {

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

	content = framework._version_prepare(content);

	var DELIMITER = '\'';
	var DELIMITER_UNESCAPE = 'unescape(\'';
	var DELIMITER_UNESCAPE_END = '\')';
	var SPACE = ' ';
	var builder = 'var $EMPTY=\'\';var $length=0;var $source=null;var $tmp=index;var $output=$EMPTY';
	var command = view_find_command(content, 0);
	var compressed = '';
	var nocompress = false;
	var isFirst = false;
	var pharse = '';

	function escaper(value) {

		var is = value.match(/[^\>]\n\s{1,}$/);

		if (!nocompressHTML)
			value = compressHTML(value, minify);
		else if (!isFirst) {
			isFirst = true;
			value = value.replace(/^\s+/, '');
		}

		if (value === '')
			return '$EMPTY';

		if (!nocompressHTML && value[0] === ' ' && value[1] === '<')
			value = value.substring(1);

		if (!nocompressHTML && is)
			value += ' ';

		if (value.match(/\n|\r|\'|\\/) !== null)
			return DELIMITER_UNESCAPE + escape(value) + DELIMITER_UNESCAPE_END;

		return DELIMITER + value + DELIMITER;
	}

	if (command === null)
		builder += '+' + escaper(content);

	var old = null;
	var newCommand = '';
	var tmp = '';
	var index = 0;
	var counter = 0;
	var functions = [];
	var functionsName = [];
	var isFN = false;
	var isSECTION = false;
	var isCOMPILATION = false;
	var builderTMP = '';
	var sectionName = '';
	var compileName = '';
	var isSitemap = false;
	var text;

	while (command !== null) {

		if (old !== null) {
			text = content.substring(old.end + 1, command.beg);
			if (text !== '') {
				if (view_parse_plus(builder))
					builder += '+';
				builder += escaper(text);
			}
		} else {
			text = content.substring(0, command.beg);
			if (text !== '') {
				if (view_parse_plus(builder))
					builder += '+';
				builder += escaper(text);
			}
		}

		var cmd = content.substring(command.beg + 2, command.end);
		var cmd8 = cmd.substring(0, 8);
		var cmd7 = cmd.substring(0, 7);

		pharse = cmd;

		if (cmd7 === 'compile' && cmd.lastIndexOf(')') === -1) {

			builderTMP = builder + '+(framework.onCompileView.call(self,\'' + (cmd8[7] === ' ' ? cmd.substring(8) : '') + '\',';
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

			newCommand = (cmd.substring(8, cmd.indexOf(SPACE, 8)) || '').trim();
			index = cmd.trim().indexOf(SPACE, newCommand.length + 10);

			if (index === -1)
				index = cmd.indexOf('[', newCommand.length + 10);

			builder += '+(function(){var $source=' + cmd.substring(index).trim() + ';if (!($source instanceof Array) || !source.length)return $EMPTY;var $length=$source.length;var $output=$EMPTY;var index=0;for(var i=0;i<$length;i++){index = i;var ' + newCommand + '=$source[i];$output+=$EMPTY';

		} else if (cmd === 'end') {

		  if (isFN && counter <= 0) {
				counter = 0;

				if (isCOMPILATION) {
					builder = builderTMP + 'unescape($EMPTY' + builder + '),model) || $EMPTY)';
					builderTMP = '';
				} else if (isSECTION) {
					builder = builderTMP + builder + ';repository[\'$section_' + sectionName + '\']=$output;return $EMPTY})()';
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
			builder += ';if (' + cmd.substring(3) + '){$output+=$EMPTY';
		} else if (cmd7 === 'else if') {
			builder += '} else if (' + cmd.substring(7) + ') {$output+=$EMPTY';
		} else if (cmd === 'else') {
			builder += '} else {$output+=$EMPTY';
		} else if (cmd === 'endif' || cmd === 'fi') {
			builder += '}$output+=$EMPTY';
		} else {

			tmp = view_prepare(command.command, newCommand, functionsName, function() {
				nocompress = true;
			});

			if (tmp) {
				if (view_parse_plus(builder))
					builder += '+';
				builder += wrapTryCatch(tmp, command.command, command.line);
			}
		}

		old = command;
		command = view_find_command(content, command.end);
		if (command && command.command && command.command.indexOf('sitemap(') !== -1)
			isSitemap = true;
	}

	if (old !== null) {
		text = content.substring(old.end + 1);
		if (text)
			builder += '+' + escaper(text);
	}

	var fn = '(function(self,repository,model,session,query,body,url,global,helpers,user,config,functions,index,output,date,cookie,files,mobile){var get=query;var post=body;var language=this.language;var cookie=function(name){return controller.req.cookie(name);};' + (isSitemap ? 'var sitemap=function(){return self.sitemap.apply(self,arguments);};' : '') + (functions.length ? functions.join('') + ';' : '') + 'var controller=self;' + builder + ';return $output;})';
	return eval(fn);
}

function wrapTryCatch(value, command, line) {
	if (!framework.isDebug)
		return value;
	return '(function(){try{return ' + value + '}catch(e){throw new Error(unescape(\'' + escape(command) + '\') + \' - Line: ' + line + ' - \' + e.message.toString());}return $EMPTY})()';
}

function view_parse_plus(builder) {
	var c = builder[builder.length - 1];
	if (c !== '!' && c !== '?' && c !== '+' && c !== '.' && c !== ':')
		return true;
	return false;
}

function view_prepare(command, dynamicCommand, functions) {

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
			if (tmp === -1)
				return '';
			return '(repository[\'$section_' + command.substring(tmp + 1, command.length - 1).replace(/\'/g, '') + '\'] || \'\')';

		case 'log':
		case 'LOG':
			return '(' + (name === 'log' ? 'framework.' : '') + command + '?$EMPTY:$EMPTY)';

		case 'logger':
		case 'LOGGER':
			return '(' + (name === 'logger' ? 'framework.' : '') + command + '?$EMPTY:$EMPTY)';

		case 'console':
			return '(' + command + '?$EMPTY:$EMPTY)';

		case 'cookie':
			return '$STRING(' + command + ').encode()';
		case '!cookie':
			return '$STRING(' + command + ')';
		case 'isomorphic':
			return '$STRING(' + command + ').encode()';
		case '!isomorphic':
			return '$STRING(' + command + ')';

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

			if (view_is_assign(command))
				return 'self.$set(' + command + ')';

			return '$STRING(' + command + ').encode()';

		case 'body':

			if (view_is_assign(command))
				return 'self.$set(' + command + ')';

			if (command.lastIndexOf('.') === -1)
				return 'output';

			return '$STRING(' + command + ').encode()';

		case 'files':
			return command;

		case 'mobile':
			return command;

		case 'CONFIG':
		case 'FUNCTION':
		case 'MODEL':
		case 'SCHEMA':
		case 'MODULE':
		case 'functions':
			return '$STRING(' + command + ').encode()';

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
		case '!FUNCTION':
		case '!MODEL':
		case '!MODULE':
			return '$STRING(' + command.substring(1) + ')';

		case 'language':
			return command;

		case 'resource':
		case 'RESOURCE':
			return '$STRING(self.' + command + ').encode()';

		case '!resource':
		case '!RESOURCE':
			return '$STRING(self.' + command.substring(1) + ')';

		case 'host':
		case 'hostname':
			if (command.indexOf('(') === -1)
				return 'self.host()';
			return 'self.' + command;

		case 'url':
			if (command.indexOf('(') !== -1)
				return 'self.$' + command;
			return 'self.' + command;

		case 'title':
		case 'description':
		case 'keywords':
			if (command.indexOf('(') !== -1)
				return 'self.$' + command;
			return '(repository[\'$' + command + '\'] || \'\').toString().encode()';

		case '!title':
		case '!description':
		case '!keywords':
			return '(repository[\'$' + command.substring(1) + '\'] || \'\')';

		case 'head':
			if (command.indexOf('(') !== -1)
				return 'self.$' + command;
			return 'self.' + command + '()';

		case 'sitemap':
		case 'place':
			if (command.indexOf('(') !== -1)
				return 'self.$' + command;
			return '(repository[\'$' + command + '\'] || \'\')';

		case 'meta':
			if (command.indexOf('(') !== -1)
				return 'self.$' + command;
			return 'self.$meta()';

		case 'js':
		case 'script':
		case 'css':
		case 'favicon':
		case 'import':
			return 'self.$' + command + (command.indexOf('(') === -1 ? '()' : '');

		case 'index':
			return '(' + command + ')';

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
		case 'image':
		case 'layout':
		case 'template':
		case 'templateToggle':
		case 'view':
		case 'viewToggle':
		case 'helper':
		case 'download':
		case 'selected':
		case 'currentContent':
		case 'currentCSS':
		case 'currentDownload':
		case 'currentImage':
		case 'currentJS':
		case 'currentTemplate':
		case 'currentVideo':
		case 'currentView':
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

			if (framework.helpers[name])
				return 'helpers.' + view_insert_call(command);

			return '$STRING(' + (functions.indexOf(name) === -1 ? command[0] === '!' ? command.substring(1) + ')' : command + ').encode()' : command + ')');
	}

	return command;
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
			if (skip === 0)
				return true;
		}

		if (c === '-' && (next === '-' || next === '=')) {
			if (skip === 0)
				return true;
		}

		if (c === '*' && (next === '*' || next === '=')) {
			if (skip === 0)
				return true;
		}

		if (c === '=') {
			if (skip === 0)
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
		else {
			if (count > 0) {
				count--;
				continue;
			}
		}

		return {
			beg: index,
			end: i,
			line: view_line_counter(content.substr(0, index)),
			command: content.substring(index + 2, i).trim()
		};
	}

	return null;
}

function view_line_counter(value) {
	var count = value.match(/\n/g);
	if (count)
		return count.length;
	return 0;
}

function view_find_localization(content, index) {

	index = content.indexOf('@(', index);
	if (index === -1)
		return null;

	var length = content.length;
	var count = 0;

	for (var i = index + 2; i < length; i++) {
		var c = content[i];

		if (c === '(') {
			count++;
			continue;
		}

		if (c !== ')')
			continue;
		else {
			if (count > 0) {
				count--;
				continue;
			}
		}

		return {
			beg: index,
			end: i,
			command: content.substring(index + 2, i).trim()
		};
	}

	return null;
}

function removeCondition(text, beg) {

	if (beg) {
		if (text[0] === '+')
			return text.substring(1, text.length);
	} else {
		if (text[text.length - 1] === '+')
			return text.substring(0, text.length - 1);
	}

	return text;
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
			continue;
		}

		html = html.replacer(comment, '');
		beg = html.indexOf(tagBeg, end + 3);
	}

	return html;
}

/**
 * Inline JS compressor
 * @private
 * @param  {String} html HTML.
 * @param  {Number} index Last index.
 * @return {String}
 */
function compressJS(html, index, filename) {

	if (!framework.config['allow-compile-script'])
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
	html = html.replacer(js, strFrom + compiled.dollar().trim() + strTo.trim());
	return compressJS(html, indexBeg + compiled.length + 9, filename);
}

/**
 * Inline CSS compressor
 * @private
 * @param  {String} html HTML.
 * @param  {Number} index Last index.
 * @return {String}
 */
function compressCSS(html, index, filename) {
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

	content = content.replace(/\$[a-z0-9-_]+\:.*?;/gi, function(text) {
		var index = text.indexOf(':');
		if (index === -1)
			return text;
		var key = text.substring(0, index).trim();
		variables[key] = text.substring(index + 1, text.length - 1).trim();
		return '';
	});

	content = content.replace(/\$[a-z0-9-_]+/gi, function(text, position) {
		var end = text.length + position;
		var variable = variables[text];
		if (!variable)
			return text;
		return variable;
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

	while (true) {
		var a = css[index++];

		if (!a)
			break;

		if (a === '\n' || a === '\r')
			continue;

		if (a === '$' && variable)
			variable();

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
	var beg;


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

/**
 * HTML compressor
 * @private
 * @param  {String} html HTML.
 * @param  {Boolean} minify Can minify?
 * @return {String}
 */
function compressHTML(html, minify) {

	if (html === null || html === '' || !minify)
		return html;

	html = removeComments(html);

	var tags = ['script', 'textarea', 'pre', 'code'];
	var id = '[' + new Date().getTime() + ']#';
	var cache = {};
	var indexer = 0;
	var length = tags.length;

	for (var i = 0; i < length; i++) {
		var o = tags[i];

		var tagBeg = '<' + o;
		var tagEnd = '</' + o;

		var beg = html.indexOf(tagBeg);
		var end = 0;
		var len = tagEnd.length;

		while (beg !== -1) {

			end = html.indexOf(tagEnd, beg + 3);
			if (end === -1)
				break;

			var key = id + (indexer++);
			var value = html.substring(beg, end + len);

			if (i === 0) {
				end = value.indexOf('>');
				len = value.indexOf('type="text/template"');
				if (len < end && len !== -1)
					break;
				len = value.indexOf('type="text/html"');
				if (len < end && len !== -1)
					break;
				len = value.indexOf('type="text/ng-template"');
				if (len < end && len !== -1)
					break;
			}

			cache[key] = value;
			html = html.replacer(value, key);
			beg = html.indexOf(tagBeg, beg + tagBeg.length);
		}
	}

	// html = html.replace(/>\n\s+/g, '>').replace(/\w\n\s+</g, function(text) {
	html = html.replace(/>\n\s+/g, '>').replace(/(\w|\W)\n\s+</g, function(text) {
		return text.trim().replace(/\s/g, '');
	}).replace(REG_5, '><').replace(REG_4, function(text) {
		var c = text[text.length - 1];
		if (c === '<')
			return c;
		return ' ' + c;
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
View.prototype.read = function(path, language) {
	var config = framework.config;
	var isOut = path[0] === '.';
	var filename = isOut ? path.substring(1) : framework.path.views(path);

	if (fs.existsSync(filename))
		return view_parse(view_parse_localization(this.modify(fs.readFileSync(filename).toString('utf8'), filename), language), config['allow-compile-html'], filename);

	if (isOut)
		return null;

	var index = path.lastIndexOf('/');
	if (index === -1)
		return null;

	filename = framework.path.views(path.substring(index + 1));

	if (fs.existsSync(filename))
		return view_parse(view_parse_localization(this.modify(fs.readFileSync(filename).toString('utf8'), filename), language), config['allow-compile-html'], filename);

	return null;
};

View.prototype.modify = function(value, filename) {

	if (!framework.modificators)
		return value;

	for (var i = 0, length = framework.modificators.length; i < length; i++) {
		var output = framework.modificators[i]('view', filename, value);
		if (output)
			value = output;
	}

	return value;
};

/**
 * Load view
 * @param {String} name
 * @param {String} filename
 * @return {Objec}
 */
View.prototype.load = function(name, filename, language) {

	var self = this;

	// Is dynamic content?
	if (name.indexOf('@{') !== -1 || name.indexOf('<') !== -1)
		return self.dynamic(name, language);

	var precompiled = framework.routes.views[name];

	if (precompiled)
		filename = '.' + precompiled.filename;
	else
		filename += '.html';

	var key = 'view#' + filename;

	if (language)
		key += language;

	var generator = framework.temporary.views[key] || null;

	if (generator !== null)
		return generator;

	generator = self.read(filename, language);

	if (!framework.isDebug)
		framework.temporary.views[key] = generator;

	return generator;
};

/*
	Compile dynamic view
	@content {String}
	return {Object} :: return parsed HTML
*/
View.prototype.dynamic = function(content, language) {
	var key = content.hash();
	var generator = framework.temporary.views[key] || null;
	if (generator !== null)
		return generator;
	generator = view_parse(view_parse_localization(this.modify(content, ''), language), framework.config['allow-compile-html']);
	if (!framework.isDebug)
		framework.temporary.views[key] = generator;
	return generator;
};

/*
	Render view from file
	@name {String}
	return {Object}
*/
exports.generateView = function(name, plus, language) {
	return new View().load(name, plus, language);
};

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
};

exports.parseURI = function(protocol, req) {

	var port = req.host.lastIndexOf(':');
	var hostname;
	var search = req.url.indexOf('?', 1);
	var pathname;
	var query = null;

	if (port === -1) {
		port = null;
		hostname = req.host;
	} else {
		hostname = req.host.substring(0, port);
		port = req.host.substring(port + 1);
	}

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

	return {
		auth: null,
		hash: null,
		host: req.host,
		hostname: hostname,
		href: protocol + '://' + req.host + req.url,
		path: req.url,
		pathname: pathname,
		port: port,
		protocol: protocol + ':',
		query: query,
		search: search,
		slashes: true
	};
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
		if (typeof(stream.close) !== FUNCTION)
			return stream;
		stream.on('open', function() {
			if (typeof(this.fd) === NUMBER)
				this.close();
		});
		return stream;
	}
	if (!(stream instanceof Stream))
		return stream;
	if (typeof(stream.destroy) === FUNCTION)
		stream.destroy();
	return stream;
}

/*
 * ee-first (first, listener)
 * Copyright(c) 2014 Jonathan Ong <me@jongleberry.com>
 * MIT Licensed
 * https://github.com/jonathanong/ee-first
 */
function first(stuff, done) {
	var cleanups = [];
	for (var i = 0, il = stuff.length; i < il; i++) {
		var arr = stuff[i];
		var ee = arr[0];
		for (var j = 1, jl = arr.length; j < jl; j++) {
			var event = arr[j];
			var fn = listener(event, callback);
			ee.on(event, fn);
			cleanups.push({ ee: ee, event: event, fn: fn });
		}
	}

	function callback() {
		cleanup();
		done.apply(null, arguments);
	}

	function cleanup() {
		var x;
		for (var i = 0, length = cleanups.length; i < length; i++) {
			x = cleanups[i];
			x.ee.removeListener(x.event, x.fn);
		}
	}

	function thunk(fn) {
		done = fn;
	}

	thunk.cancel = cleanup;
	return thunk;
}

function listener(event, done) {
	return function(arg1) {
		var args = new Array(arguments.length);
		var ee = this;
		var err = event === 'error' ? arg1 : null;

		// copy args to prevent arguments escaping scope
		for (var i = 0; i < args.length; i++)
			args[i] = arguments[i];
		done(err, ee, event, args);
	}
}

/*
 * on-finished (onFinished, attachFinishedListener, attachListener, createListener, patchAssignSocket, isFinished)
 * Copyright(c) 2013 Jonathan Ong <me@jongleberry.com>
 * Copyright(c) 2014 Douglas Christopher Wilson <doug@somethingdoug.com>
 * MIT Licensed
 * https://github.com/jshttp/on-finished
 */
function onFinished(msg, listener) {
	if (isFinished(msg) !== false) {
		setImmediate(listener, null, msg);
		return msg;
	}
	attachListener(msg, listener);
	return msg;
}

function attachFinishedListener(msg, callback) {
	var eeMsg;
	var eeSocket;
	var finished = false;

	function onFinish(error) {
		eeMsg.cancel();
		eeSocket.cancel();
		finished = true;
		callback(error);
	}

	// finished on first message event
	eeMsg = eeSocket = first([[msg, 'end', 'finish']], onFinish);

	function onSocket(socket) {
		// remove listener
		msg.removeListener('socket', onSocket)

		if (finished || eeMsg !== eeSocket)
			return;

		// finished on first socket event
		eeSocket = first([[socket, 'error', 'close']], onFinish);
	}

	// socket already assigned
	if (msg.socket) {
		onSocket(msg.socket);
		return;
	}

	// wait for socket to be assigned
	msg.on('socket', onSocket)

	// node.js 0.8 patch
	if (msg.socket === undefined)
		patchAssignSocket(msg, onSocket);
}

function attachListener(msg, listener) {
	var attached = msg.__onFinished;

	// create a private single listener with queue
	if (!attached || !attached.queue) {
		attached = msg.__onFinished = createListener(msg);
		attachFinishedListener(msg, attached);
	}

	attached.queue.push(listener);
}

function createListener(msg) {
	function listener(err) {
		if (msg.__onFinished === listener)
			msg.__onFinished = null;
		if (!listener.queue)
			return;
		var queue = listener.queue;
		listener.queue = null
		for (var i = 0, length = queue.length; i < length; i++)
			queue[i](err, msg);
	}
	listener.queue = [];
	return listener;
}

function patchAssignSocket(res, callback) {
	var assignSocket = res.assignSocket;
	if (typeof(assignSocket) !== FUNCTION)
		return;
	// res.on('socket', callback) is broken in 0.8
	res.assignSocket = function _assignSocket(socket) {
		assignSocket.call(this, socket);
		callback(socket);
	};
}

function isFinished(msg) {

	var socket = msg.socket;

	// OutgoingMessage
	if (typeof msg.finished === BOOLEAN)
		return Boolean(msg.finished || (socket && !socket.writable));

	// IncomingMessage
	if (typeof msg.complete === BOOLEAN)
		return Boolean(msg.upgrade || !socket || !socket.readable || (msg.complete && !msg.readable))

	// don't know
	return;
}

exports.parseLocalization = view_parse_localization;
exports.findLocalization = view_find_localization;
exports.destroyStream = destroyStream;
exports.onFinished = onFinished;
