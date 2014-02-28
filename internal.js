//  parseMULTIPART
//  parseMULTIPART_MIXED
//	HttpFile
//	LESS CSS + Auto vendor prefixes
//	JavaScript Compiler
//	View engine
//	Template engine

'use strict';

var crypto = require('crypto');
var fs = require('fs');

var ENCODING = 'utf8';
var UNDEFINED = 'undefined';
var FUNCTION = 'function';

var REG_1 = /[\n\r\t]+/g;
var REG_2 = /\s{2,}/g;

if (typeof(setImmediate) === UNDEFINED) {
	global.setImmediate = function(cb) {
		process.nextTick(cb);
	};
}

/*
	Internal function / Parse data from Request
	@req {ServerRequest}
	@contentType {String}
	@maximumSize {Number}
	@tmpDirectory {String}
	@onXSS {Function}
	@callback {Function}
*/
exports.parseMULTIPART = function(req, contentType, maximumSize, tmpDirectory, onXSS, callback) {

	var parser = new MultipartParser();
	var boundary = contentType.split(';')[1];
	var isFile = false;
	var size = 0;
	var stream = null;
	var tmp = { name: '', value: '', contentType: '', fileName: '', fileNameTmp: '', fileSize: 0, isFile: false, step: 0, width: 0, height: 0 };
	var ip = req.ip.replace(/\./g, '');
	var close = 0;
	var isXSS = false;
	var rm = null;

	boundary = boundary.substring(boundary.indexOf('=') + 1);

	req.buffer_exceeded = false;
	req.buffer_has = true;

	parser.initWithBoundary(boundary);

	parser.onPartBegin = function() {
		tmp.value = '';
		tmp.fileSize = 0;
		tmp.step = 0;
		tmp.isFile = false;
    };

    parser.onHeaderValue = function(buffer, start, end) {

		if (req.buffer_exceeded)
			return;

		if (isXSS)
			return;

		var arr = buffer.slice(start, end).toString(ENCODING).split(';');

		if (tmp.step === 1) {
			tmp.contentType = arr[0];
			tmp.step = 2;
			return;
		}

		if (tmp.step !== 0)
			return;

		tmp.name = arr[1].substring(arr[1].indexOf('=') + 2);
		tmp.name = tmp.name.substring(0, tmp.name.length - 1);
		tmp.step = 1;

		if (arr.length !== 3)
			return;

		tmp.fileName = arr[2].substring(arr[2].indexOf('=') + 2);
		tmp.fileName = tmp.fileName.substring(0, tmp.fileName.length - 1);

		tmp.isFile = true;
		tmp.fileNameTmp = utils.combine(tmpDirectory, ip + '-' + new Date().getTime() + '-' + utils.random(100000) + '.upload');

		stream = fs.createWriteStream(tmp.fileNameTmp, { flags: 'w' });

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

		if (isXSS)
			return;

		var data = buffer.slice(start, end);
		var length = data.length;

		size += length;

		if (size >= maximumSize) {
			req.buffer_exceeded = true;

			if (rm === null)
				rm = [tmp.fileNameTmp];
			else
				rm.push(tmp.fileNameTmp);

			return;
		}

		if (!tmp.isFile) {
			tmp.value += data.toString(ENCODING);
			return;
		}

		if (tmp.fileSize === 0) {
			var wh = null;
			switch (tmp.contentType) {
				case 'image/jpeg':
					wh = require('./image').measureJPG(data);
					break;
				case 'image/gif':
					wh = require('./image').measureGIF(data);
					break;
				case 'image/png':
					wh = require('./image').measurePNG(data);
					break;
			}

			if (wh) {
				tmp.width = wh.width;
				tmp.height = wh.height;
			}
		}

		stream.write(data);
		tmp.fileSize += length;
    };

    parser.onPartEnd = function() {

		if (stream !== null) {
			stream.end();
			stream = null;
		}

		if (req.buffer_exceeded)
			return;

		if (tmp.isFile) {
			req.data.files.push(new HttpFile(tmp.name, tmp.fileName, tmp.fileNameTmp, tmp.fileSize, tmp.contentType, tmp.width, tmp.height));
			return;
		}

		if (onXSS(tmp.value))
			isXSS = true;

		req.data.post[tmp.name] = tmp.value;
    };

    parser.onEnd = function() {

		var cb = function() {

			if (close > 0) {
				setImmediate(cb);
				return;
			}

			if (isXSS) {
				req.flags.push('xss');
				framework.stats.request.xss++;
			}

			if (rm !== null)
				framework.unlink(rm);

			callback();
		};

		cb();
    };

    req.on('data', parser.write.bind(parser));
    req.on('end', parser.end.bind(parser));
};

/*
	Internal function / Parse MIXED data
	@req {ServerRequest}
	@contentType {String}
	@tmpDirectory {String}
	@onFile {Function} :: this function is called when is a file downloaded
	@callback {Function}
*/
exports.parseMULTIPART_MIXED = function(req, contentType, tmpDirectory, onFile, callback) {

	var parser = new MultipartParser();
	var boundary = contentType.split(';')[1];
	var stream = null;
	var tmp = { name: '', contentType: '', fileName: '', fileNameTmp: '', fileSize: 0, isFile: false, step: 0, width: 0, height: 0 };
	var ip = req.ip.replace(/\./g, '');
	var close = 0;

	boundary = boundary.substring(boundary.indexOf('=') + 1);

	req.buffer_exceeded = false;
	req.buffer_has = true;

	parser.initWithBoundary(boundary);

	parser.onPartBegin = function() {
		tmp.fileSize = 0;
		tmp.step = 0;
		tmp.isFile = false;
    };

    parser.onHeaderValue = function(buffer, start, end) {

		if (req.buffer_exceeded || tmp.step > 1)
			return;

		var arr = buffer.slice(start, end).toString(ENCODING).split(';');

		if (tmp.step === 1) {
			tmp.contentType = arr[0];
			tmp.step = 2;
			return;
		}

		if (tmp.step === 0) {

			tmp.name = arr[1].substring(arr[1].indexOf('=') + 2);
			tmp.name = tmp.name.substring(0, tmp.name.length - 1);
			tmp.step = 1;

			if (arr.length !== 3)
				return;

			tmp.fileName = arr[2].substring(arr[2].indexOf('=') + 2);
			tmp.fileName = tmp.fileName.substring(0, tmp.fileName.length - 1);
			tmp.isFile = true;
			tmp.fileNameTmp = utils.combine(tmpDirectory, ip + '-' + new Date().getTime() + '-' + utils.random(100000) + '.upload');
			stream = fs.createWriteStream(tmp.fileNameTmp, { flags: 'w' });

			stream.on('close', function() {
				close--;
			});

			stream.on('error', function() {
				close--;
			});

			close++;
			return;
		}

    };

    parser.onPartData = function(buffer, start, end) {
		var data = buffer.slice(start, end);
		var length = data.length;

		if (!tmp.isFile)
			return;

		if (tmp.fileSize === 0) {
			var wh = null;
			switch (tmp.contentType) {
				case 'image/jpeg':
					wh = require('./image').measureJPG(data);
					break;
				case 'image/gif':
					wh = require('./image').measureGIF(data);
					break;
				case 'image/png':
					wh = require('./image').measurePNG(data);
					break;
			}

			if (wh) {
				tmp.width = wh.width;
				tmp.height = wh.height;
			}
		}

		stream.write(data);
		tmp.fileSize += length;
	};

    parser.onPartEnd = function() {

		if (stream !== null) {
			stream.end();
			stream = null;
		}

		if (!tmp.isFile)
			return;

		onFile(new HttpFile(tmp.name, tmp.fileName, tmp.fileNameTmp, tmp.fileSize, tmp.contentType, tmp.width, tmp.height));
    };

    parser.onEnd = function() {
		var cb = function cb () {

			if (close > 0) {
				setImmediate(cb);
				return;
			}

			onFile(null);
			callback();
		};

		cb();
    };

    req.on('data', parser.write.bind(parser));
};

/*
	Internal function / Split string (url) to array
	@url {String}
	return {String array}
*/
exports.routeSplit = function(url, noLower) {

	if (!noLower)
		url = url.toLowerCase();

	if (url[0] === '/')
		url = url.substring(1);

	if (url[url.length - 1] === '/')
		url = url.substring(0, url.length - 1);

	var arr = url.split('/');
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

	if (route.length !== length && !isAsterix)
		return false;

	var skip = length === 1 && url[0] === '/';

	for (var i = 0; i < length; i++) {

		var value = route[i];

		if (isAsterix && typeof(value) === UNDEFINED)
			return true;

		if (!isSystem && (!skip && value[0] === '{'))
			continue;

		if (url[i] !== value)
			return false;
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

	if (arr === null || subdomain === null || arr.length === 0)
		return true;

	return arr.indexOf(subdomain) > -1;
};

/*
	Internal function / Compare flags
	@arr1 {String array}
	@arr2 {String array}
	@noLoggedUnlogged {Boolean}
	return {Number}
*/
exports.routeCompareFlags = function(arr1, arr2, noLoggedUnlogged) {

	var isXSS = false;
	var length = arr2.length;
	var LOGGED = 'logged';
	var UNLOGGED = 'unlogged';

	for (var i = 0; i < length; i++) {
		var value = arr2[i];

		if (value[0] === '!')
			continue;

		if (noLoggedUnlogged && (value === LOGGED || value === UNLOGGED))
			continue;

		var index = arr1.indexOf(value);

		if (index === -1 && value === 'xss') {
			isXSS = true;
			continue;
		}

		if (value === 'xss')
			isXSS = true;

		if (index === -1)
			return value === LOGGED || value === UNLOGGED ? -1 : 0;
	}

	if (!isXSS && arr1.indexOf('xss') !== -1)
		return 0;

	return 1;
};

/*
	Internal function
	@routeUrl {String array}
	@route {Controller route}
	return {String array}
*/
exports.routeParam = function(routeUrl, route) {
	var arr = [];

	if (!route || !routeUrl)
		return arr;

	var length = route.param.length;
	if (length === 0)
		return arr;

	for (var i = 0; i < length; i++) {
		var value = routeUrl[route.param[i]];
		arr.push(value === '/' ? '' : value);
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
function HttpFile(name, filename, path, length, contentType, width, height) {
	this.name = name;
	this.filename = filename;
	this.length = length;
	this.contentType = contentType;
	this.path = path;
	this.width = width;
	this.height = height;
}

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

	stream.on('end', function() {
		callback(null, md5.digest('hex'));
	});

	return self;
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
	return self.contentType.indexOf('image/') !== -1;
};

/*
	return {Boolean}
*/
HttpFile.prototype.isVideo = function() {
	var self = this;
	return self.contentType.indexOf('video/') !== -1;
};

/*
	return {Boolean}
*/
HttpFile.prototype.isAudio = function() {
	var self = this;
	return self.contentType.indexOf('audio/') !== -1;
};

/*
	@imageMagick {Boolean} :: optional - default false
	return {Image} :: look at ./lib/image.js
*/
HttpFile.prototype.image = function(imageMagick) {

	var im = imageMagick;

	// Not a clean solution because the framework hasn't a direct dependence.
	// This is hack :-)
	if (typeof(im) === UNDEFINED)
		im = framework.config['default-image-converter'] === 'im';

	return require('./image').init(this.path, im);
};

// *********************************************************************************
// =================================================================================
// LESS CSS
// =================================================================================
// *********************************************************************************

function LessParam() {
	this.name = '';
	this.value = '';
}

/*
	Internal class
	@parent {Object}
	return {LessValue}
*/
function LessValue(parent) {
	this.index = 0;
	this.value = '';
	this.name = '';
	this.isVariable = false;
	this.isFunction = false;
	this.isProblem = false;
	this.parent = parent;
};

function Less() {};

/*
	Internal function
	@less {Object}
	return {String}
*/
LessValue.prototype.getValue = function(less) {

	var self = this;

	if (less === null)
		return '';

	if (self.isVariable)
		return '';

	var value = '';

	if (!self.isFunction) {
		value = less.value.substring(less.name.length).trim();

		// možná chyba pri substring - 2
		if ((value[0] === '{') && (value[value.length - 1] === '}'))
			value = value.substring(1, value.length - 2).trim();

		return value;
	}

	var param = [];
	var beg = less.value.indexOf('(') + 1;
	var end = less.value.indexOf(')', beg + 1);

	less.value.substring(beg, end).split(',').forEach(function(o) {
		var p = new LessParam();
		p.name = o.trim();
		param.push(p);
	});

	beg = self.value.indexOf('(') + 1;
	end = self.value.lastIndexOf(')');

	var index = 0;

	self.parent.getParams(self.value.substring(beg, end)).forEach(function(o, index) {
		if (param[index])
			param[index].value = o.trim().replace(/\|/g, ',');
	});

	beg = less.value.indexOf('{') + 1;
	end = less.value.lastIndexOf('}');

	var sb = [];

	less.value.substring(beg, end).split(';').forEach(function(o, index) {
		value = o.trim();

		if (value.length === 0)
			return;

		param.forEach(function(oo) {
			var reg = new RegExp('@' + oo.name, 'g');
			value = value.replace(reg, oo.value);
		});

		sb.push(value);
	});

	return sb.join(';');
};

/*
	Internal function
	@param {String}
	return {String array}
*/
Less.prototype.getParams = function getParams(param) {

	var self = this;
	var sb = '';
	var arr = [];
	var index = 0;
	var skip = false;
	var closure = false;

	var prepare = function prepare(n) {
		var value = n.replace(/\|/g, ',');
		if (value[0] === '\'' || value[0] === '"')
			return value.substring(1, value.length - 1).trim();
		return value;
	};

	do
	{
		var c = param[index];

		if (c === '(' && !skip) {
			closure = true;
			skip = true;
		}

		if (!closure) {
			if (c === '\'' || c === '"')
				skip = !skip;
		}

		if (c === ')' && !skip && closure) {
			skip = false;
			closure = false;
		}

		if (c !== ',' || skip || closure) {
			sb += c;
		} else {
			arr.push(prepare(sb));
			sb = '';
		}

		index++;

	} while (index < param.length);

	if (sb.length > 0)
		arr.push(prepare(sb));

	return arr;
};

/*
	Internal function
	@prev {LessValue}
	@value {String}
	return {LessValue}
*/
Less.prototype.getValue = function(prev, value) {
	var self = this;
	var index = 0;

	if (prev !== null)
		index = prev.index + prev.value.length;

    var beg = false;
    var copy = false;
    var skip = false;

    var param = 0;
    var val = 0;

    var sb = [];
    var less = new LessValue(self);
    var without = ['@import', '@font-face', '@keyframes', '@-moz-keyframes', '@-webkit-keyframes', '@-o-keyframes', '@-ms-keyframes', '@media', '@charset'];

    while (index < value.length) {

		var c = value[index];
		if (c === '@' && !less.isFunction) {
			beg = true;
			copy = true;
			less.index = index;
		} else if (beg) {
			var charindex = value.charCodeAt(index);

			if (charindex === 40)
				param++;
			else if (charindex === 41)
				param--;

			var next = val !== 0;

			if (charindex === 123) {

				if (val === 0)
					less.isVariable = true;

				val++;
				next = true;
			} else if (charindex === 125) {

				if (val === 0) {
					index++;
					continue;
				}
				val--;
				next = true;
			}

			if (charindex === 32 || charindex === 41)
				next = true;
			else if (param === 0 && val === 0 && !next)
				next = (charindex >= 65 && charindex <= 90) || (charindex >= 97 && charindex <= 122) || charindex === 45;
			else if (param > 0 && val === 0) {
				next = charindex !== 41;
				less.isFunction = true;
			} else if (val > 0 && param === 0)
				next = true;

			copy = next;
		}

		if (beg && copy)
			sb.push(c);
		else if(beg) {

			if (copy)
				sb.push(c);

			less.value = sb.join('').trim();

			if (less.isFunction)
				less.name = less.value.substring(0, less.value.indexOf('(')).trim();
			else if (less.isVariable)
				less.name = less.value.substring(0, less.value.indexOf('{')).trim();
			else
				less.name = less.value.trim();

			var invalid = less.name.split(' ');

			if (without.indexOf(invalid[0]) > -1)
				less.isProblem = true;

			return less;
		}

		index++;
    }

    return null;
};

/*
	Internal function
	@value {String}
	return {String}
*/
Less.prototype.compile = function(value) {

	var self = this;
	var arr = [];
	var less = self.getValue(null, value);

	while (less !== null) {
		arr.push(less);
		less = self.getValue(less, value);
	}

	if (arr.length > 0) {

		arr.forEach(function(o) {

			if (o.isProblem)
				return;

			if (o.isVariable) {
				value = value.replacer(o.value, '');
				return;
			}

			var val = arr.find(function(oo) {
				return oo.name === o.name;
			});

			if (val === null)
				return;

			var v = o.getValue(val);
			value = value.replacer(o.value, v);
		});
	}

	var reg1 = /\n|\s{2,}/g;
	var reg2 = /\s?\{\s{1,}/g;
	var reg3 = /\s?\}\s{1,}/g;
	var reg4 = /\s?\:\s{1,}/g;
	var reg5 = /\s?\;\s{1,}/g;

	arr = null;
	less = null;

	return value.replace(reg1, '').replace(reg2, '{').replace(reg3, '}').replace(reg4, ':').replace(reg5, ';').replace(/\s\}/g, '}').replace(/\s\{/g, '{').trim();
};

/*
	Auto vendor prefixer
	@value {String} :: Raw CSS
	return {String}
*/
function autoprefixer(value) {

	// 'box-shadow', 'border-radius'
	var prefix = ['appearance', 'column-count', 'column-gap', 'column-rule', 'display', 'transform', 'transform-origin', 'transition', 'user-select', 'animation', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-play-state', 'opacity', 'background', 'background-image', 'font-smoothing'];
	var id = '@#auto-vendor-prefix#@';

	if (value.indexOf(id) === -1) {
		id = '/*auto*/';
		if (value.indexOf(id) === -1)
			return value;
	}

	value = autoprefixer_keyframes(value.replacer(id, ''));

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
			if (property === 'transform' && value.substring(index - 1, index) === '-')
				continue;

			var css = value.substring(index, end);
			end = css.indexOf(':');

			if (end === -1)
				continue;

			if (css.substring(0, end + 1).replace(/\s/g, '') !== property + ':')
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

			var opacity = parseFloat(plus.replace('opacity', '').replace(':', '').replace(/\s/g, ''));
			if (isNaN(opacity))
				continue;

			updated += 'filter:alpha(opacity='+Math.floor(opacity * 100)+');';

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
			updated += plus.replacer('linear-', '-ms-linear-');
			updated += plus + delimiter;

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
		updated += '@-o-' + plus;

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

exports.compile_less = function(value, minify, framework) {
	if (framework) {
		if (framework.onCompileCSS !== null)
			return framework.onCompileCSS('', value);
	}
	return new Less().compile(autoprefixer(value), minify);
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

    function jsmin()
    {
        theA = 13;
        action(3);
        var indexer = 0;
        while (theA !== EOF)
        {
            switch (theA)
            {
                case 32:
                    if (isAlphanum(theB))
                        action(1);
                    else
                        action(2);
                    break;
                case 13:
                    switch (theB)
                    {
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
                    switch (theB)
                    {
                        case 32:
                            if (isAlphanum(theA)) {
                                action(1);
                                break;
                            }
                            action(3);
                            break;

                        case 13:
                            switch (theA)
                            {
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

    function action(d)
    {
        if (d <= 1)
        {
            put(theA);
        }
        if (d <= 2)
        {
            theA = theB;
            if (theA === 39 || theA === 34)
            {
                for (; ; )
                {
                    put(theA);
                    theA = get();
                    if (theA === theB)
                    {
                        break;
                    }
                    if (theA <= 13)
                    {
                        //throw new Exception(string.Format("Error: JSMIN unterminated string literal: {0}\n", theA));
                        c = EOF;
                        return;
                    }
                    if (theA === 92)
                    {
                        put(theA);
                        theA = get();
                    }
                }
            }
        }
        if (d <= 3)
        {
            theB = next();
            if (theB === 47 && (theA === 40 || theA === 44 || theA === 61 ||
                               theA === 91 || theA === 33 || theA === 58 ||
                               theA === 38 || theA === 124 || theA === 63 ||
                               theA === 123 || theA === 125 || theA === 59 ||
                               theA === 13))
            {
                put(theA);
                put(theB);
                for (; ; )
                {
                    theA = get();
                    if (theA === 47)
                    {
                        break;
                    }
                    else if (theA === 92)
                    {
                        put(theA);
                        theA = get();
                    }
                    else if (theA <= 13)
                    {
                        c = EOF;
                        return;
                    }
                    put(theA);
                }
                theB = next();
            }
        }
    }

    function next()
    {
        var c = get();

        if (c !== 47)
			return c;

        switch (peek())
        {
            case 47:
                for (; ; )
                {
                    c = get();
                    if (c <= 13)
                        return c;
                }
                break;
            case 42:
                get();
                for (; ; )
                {
                    switch (get())
                    {
                        case 42:
                            if (peek() === 47)
                            {
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

    function peek()
    {
        theLookahead = get();
        return theLookahead;
    }

    function get()
    {
        var c = theLookahead;
        theLookahead = EOF;
        if (c === EOF)
        {
            c = source.charCodeAt(index++);
            if (isNaN(c))
                c = EOF;
        }
        if (c >= 32 || c === 13 || c === EOF)
        {
            return c;
        }
        if (c === 10) // \r
        {
            return 13;
        }
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

exports.compile_javascript = function(source, framework) {
    try
    {
		if (framework) {
			if (framework.onCompileJS !== null)
				return framework.onCompileJS('', source);
		}

        return JavaScript(source);
    } catch (ex) {

		if (framework)
			framework.error(ex, 'JavaScript compressor');

        return source;
    }
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
    S =
    { PARSER_UNINITIALIZED: s++,
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
    F =
    { PART_BOUNDARY: f,
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
  self.boundary = new Buffer(str.length+4);

  if (framework.versionNode >= 1111) {
	  self.boundary.write('\r\n--', 0, 'ascii');
	  self.boundary.write(str, 4, 'ascii');
  } else {
	  self.boundary.write('\r\n--', 'ascii', 0);
	  self.boundary.write(str, 'ascii', 4);
  }

  self.lookbehind = new Buffer(self.boundary.length+8);
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
        self[name+'Mark'] = i;
      },
      clear = function(name) {
        delete self[name+'Mark'];
      },
      callback = function(name, buffer, start, end) {
        if (start !== undefined && start === end) {
          return;
        }

        var callbackSymbol = 'on'+name.substr(0, 1).toUpperCase()+name.substr(1);
        if (callbackSymbol in self) {
          self[callbackSymbol](buffer, start, end);
        }
      },
      dataCallback = function(name, clear) {
        var markSymbol = name+'Mark';
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
          if (flags & F.LAST_BOUNDARY && c == HYPHEN){
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

        if (c != boundary[index+2]) {
          index = -2;
        }
        if (c == boundary[index+2]) {
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
        } else if (index - 1 == boundary.length)  {
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
          lookbehind[index-1] = c;
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
    var callbackSymbol = 'on'+name.substr(0, 1).toUpperCase()+name.substr(1);
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
    @controller {Controller}
    return {View}
*/
function View(controller) {
	this.controller = controller;
	this.cache = controller.cache;
	this.prefix = controller.prefix;
}

/*
	Content class
    @controller {Controller}
    return {Content}
*/
function Content(controller) {
	this.controller = controller;
	this.cache = controller.cache;
	this.prefix = controller.prefix;
}

function view_parse(content) {

	content = removeComments(compressCSS(compressJS(content, 0, framework), 0, framework));

	var builder = '';
	var command = view_find_command(content, 0);

	if (command === null)
		builder = '+\'' + minifyHTML(content).replace(/\\\'/g, '\\\\\'').replace(/\'/g, '\\\'').replace(/\n/g, '\\n') + '\'';

	var old = null;
	var condition = 0;
	var is = false;

	while (command !== null) {

		if (condition === 0 && builder !== '')
			builder += '+';

		if (old !== null) {
			var text = content.substring(old.end + 1, command.beg);
			if (text !== '') {
				if (view_parse_plus(builder))
					builder += '+';
				builder += '\'' + minifyHTML(text).replace(/\\\'/g, '\\\\\'').replace(/\'/g, '\\\'').replace(/\n/g, '\\n') + '\'';
			}
		} else {
			var text = content.substring(0, command.beg);
			if (text !== '') {
				if (view_parse_plus(builder))
					builder += '+';
				builder += '\'' + minifyHTML(text).replace(/\\\'/g, '\\\\\'').replace(/\'/g, '\\\'').replace(/\n/g, '\\n') + '\'';
			}
		}

		var cmd = content.substring(command.beg + 2, command.end);

		if (cmd.substring(0, 3) === 'if ') {
			if (view_parse_plus(builder))
				builder += '+';
			condition = 1;
			builder += '(' + cmd.substring(3) + '?';
			is = true;
		} else if (cmd === 'else') {
			condition = 2;
			builder += ':';
			is = true;
		} else if (cmd === 'endif') {
			if (condition === 1)
				builder += ':\'\'';
			condition = 0;
			builder += ')';
			is = true;
		} else {
			if (view_parse_plus(builder))
				builder += '+';
			builder += view_prepare(command.command);
		}

		if (!is) {

		}

		old = command;
		command = view_find_command(content, command.end);
	}

	if (old !== null) {
		var text = content.substring(old.end + 1);
		if (text.length > 0)
			builder += '+\'' + minifyHTML(text).replace(/\\\'/g, '\\\\\'').replace(/\'/g, '\\\'').replace(/\n/g, '\\n') + '\'';
	}

	var fn = '(function(self,repository,model,session,get,post,url,global,helpers,user,config,functions,index,sitemap){var controller=self;return ' + builder.substring(1) + '})';
	return eval(fn);
}

function view_parse_plus(builder) {
	var c = builder[builder.length - 1];
	if (c !== '!' && c !== '?' && c !== '+' && c !== '.' && c !== ':')
		return true;
	return false;
}

function view_prepare(command) {

	var a = command.indexOf('.');
	var b = command.indexOf('(');
	var c = command.indexOf('[');

	if (a === -1)
		a = b;

	if (b === -1)
		b = a;

	if (a === -1)
		a = c;

	if (b === -1)
		b = c;

	var index = Math.min(a, b);

	if (index === -1)
		index = command.length;

	var name = command.substring(0, index);

	switch (name) {
		case 'controller':
		case 'repository':
		case 'model':
		case 'get':
		case 'post':
		case 'global':
		case 'session':
		case 'user':
		case 'config':
		case 'functions':
		case 'model':
			return '(' + command + ').toString().encode()';

		case '!controller':
		case '!repository':
		case '!get':
		case '!post':
		case '!global':
		case '!session':
		case '!user':
		case '!config':
		case '!functions':
		case '!model':
			return '(' + command.substring(1) + ')';

		case 'body':
			return 'self.output';

		case 'resource':
			return '(self.' + command + ').toString().encode()';

		case '!resource':
			return '(self.' + command .substring(1) + ')';

		case 'host':
		case 'hostname':
			if (command.indexOf('(') === -1)
				return 'self.host()';
			return 'self.' + command;

		case 'url':
			if (command.indexOf('(') !== -1)
				return 'self.$' + command;
			return command = 'url';

		case 'title':
		case 'description':
		case 'keywords':
			if (command.indexOf('(') !== -1)
				return 'self.' + command;
			return '(repository[\'$' + command + '\'] || \'\').toString().encode()';

		case '!title':
		case '!description':
		case '!keywords':
			return '(repository[\'$' + command.substring(1) + '\'] || \'\')';

		case 'head':
			if (command.indexOf('(') !== -1)
				return 'self.$' + command;
			return 'self.' + command + '()';
		case 'place':
		case 'sitemap':
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
			return 'self.$' + command + (command.indexOf('(') === -1 ? '()' : '');

		case 'index':
			return '(' + command + ')';

		case 'routeJS':
		case 'routeCSS':
		case 'routeImage':
		case 'routeFont':
		case 'routeDownload':
		case 'routeVideo':
		case 'routeStatic':
			return 'self.' + command;

		case 'ng':
		case 'ngTemplate':
		case 'ngController':
		case 'ngCommon':
		case 'ngInclude':
		case 'ngLocale':
		case 'ngService':
		case 'ngFilter':
		case 'ngDirective':
		case 'ngResource':
		case 'ngStyle':
			return 'self.$' + command;

		case 'canonical':
		case 'checked':
		case 'helper':
		case 'component':
		case 'componentToggle':
		case 'content':
		case 'contentToggle':
		case 'currentContent':
		case 'currentCSS':
		case 'currentDownload':
		case 'currentImage':
		case 'currentJS':
		case 'currentTemplate':
		case 'currentVideo':
		case 'currentView':
		case 'disabled':
		case 'dns':
		case 'download':
		case 'etag':
		case 'header':
		case 'image':
		case 'json':
		case 'layout':
		case 'modified':
		case 'next':
		case 'options':
		case 'prefetch':
		case 'prerender':
		case 'prev':
		case 'readonly':
		case 'selected':
		case 'template':
		case 'templateToggle':
		case 'view':
		case 'viewToggle':
			return 'self.$' + command;
		case 'radio':
		case 'text':
		case 'checkbox':
		case 'hidden':
		case 'textarea':
		case 'password':
			return 'self.$' + exports.appendModel(command);
		default:
			return 'helpers.' + view_insert_call(command);
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

		return command.substring(0, beg) + '.call(self, ' + command.substring(beg + 1);
	}

	return command;
};

function view_find_command(content, index) {

	var index = content.indexOf('@{', index);
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

		return { beg: index, end: i, command: content.substring(index + 2, i).trim() };
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

/*
	Dynamic JavaScript compress
    @html {String}
    @index {Number}
    return {String}
*/
function compressJS(html, index, framework) {

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
	var compiled = exports.compile_javascript(val, framework).replace(/\\\\/g, '\\\\\\\\').replace(/\\n/g, "'+(String.fromCharCode(13)+String.fromCharCode(10))+'");
	html = html.replacer(js, strFrom + compiled.dollar().trim() + strTo.trim());
	return compressJS(html, indexBeg + compiled.length + 9, framework);
}

function compressCSS(html, index, framework) {
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
	var compiled = exports.compile_less(val, true, framework);
	html = html.replacer(css, (strFrom + compiled.trim() + strTo).trim());
	return compressCSS(html, indexBeg + compiled.length + 8, framework);
}

/*
	Minify HTML
    @html {String}
    return {String}
*/
function minifyHTML(html) {

	if (html === null || html === '')
		return html;

	html = removeComments(html);

	var tags =['script', 'textarea', 'pre', 'code'];
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
			}

			cache[key] = value.replace(/\n/g, '\\n');
			html = html.replacer(value, key);
			beg = html.indexOf(tagBeg, beg + tagBeg.length);
		}
	}

	html = html.replace(REG_1, '').replace(REG_2, '');

	var keys = Object.keys(cache);
	length = keys.length;

	for (var i = 0; i < length; i++) {
		var key = keys[i];
		html = html.replacer(key, cache[key]);
	}

	return html;
}


/*
	Read view
    @name {String}
    return {Object} :: return factory object
*/
View.prototype.read = function(name) {

	var self = this;
	var config = self.controller.config;
	var isOut = name[0] === '.';

	var filename = isOut ? name.substring(1) + '.html' : utils.combine(config['directory-views'], name + '.html');

	if (fs.existsSync(filename))
		return view_parse(fs.readFileSync(filename).toString('utf8'));

	if (isOut)
		return null;

	var index = name.lastIndexOf('/');
	if (index === -1)
		return null;

	name = name.substring(index + 1);
	if (name.indexOf('#') !== -1)
		return null;

	filename = name[0] === '.' ? name.substring(1) : utils.combine(config['directory-views'], name + '.html');

	if (fs.existsSync(filename))
		return view_parse(fs.readFileSync(filename).toString('utf8'));

	return null;
};

/*
	Load view
    @name {String}
    @prefix {String}
    return {Object} :: return factory object
*/
View.prototype.load = function(name, prefix, filename) {

	var self = this;

	// Is dynamic content?
	if (name.indexOf('@{') !== -1 || name.indexOf('<') !== -1)
		return self.dynamic(name);

	var isPrefix = (prefix || '').length > 0;
	var key = 'view.' + filename + (isPrefix ? '#' + prefix : '');

	var generator = self.controller.framework.temporary.views[key] || null;

	if (generator !== null)
		return generator;

	generator = self.read(filename + (isPrefix ? '#' + prefix : ''));

	if (generator === null && isPrefix)
		generator = self.read(filename);

	if (generator !== null && !self.controller.isDebug)
		self.controller.framework.temporary.views[key] = generator;

	return generator;
};

/*
	Compile dynamic view
	@content {String}
	return {Object} :: return parsed HTML
*/
View.prototype.dynamic = function(content) {

	var self = this;
	var key = content.md5();
	var generator = self.controller.framework.temporary.views[key] || null;

	if (generator !== null)
		return generator;

	generator = view_parse(content, self.controller);

	if (generator !== null && !self.controller.isDebug)
		self.controller.framework.temporary.views[key] = generator;

	return generator;
};

/*
	Read content
    @name {String}
    return {String}
*/
Content.prototype.read = function(name) {
	var self = this;
	var config = self.controller.config;
	var isOut = name[0] === '.';
	var filename = isOut ? name.substring(1) + '.html' : utils.combine(config['directory-contents'], name + '.html');

	if (fs.existsSync(filename))
		return minifyHTML(fs.readFileSync(filename).toString('utf8'));

	return null;
};

/*
	Load content
    @name {String}
    @prefix {String}
    return {String}
*/
Content.prototype.load = function(name, prefix) {

	var self = this;
	var isPrefix = prefix.length > 0;

	var key = 'content.' + name + (isPrefix ? '#' + prefix : '');
	var content = self.controller.framework.temporary.views[key] || null;

	if (content !== null)
		return content;

	content = self.read(name + (isPrefix ? '#' + prefix : ''));

	if (content === null && isPrefix)
		content = self.read(name);

	if (content === null)
		self.controller.framework.error('Content "' + name + '" not found.', self.controller.name, self.controller.uri);

	if (content !== null && !self.controller.isDebug)
		self.controller.framework.temporary.views[key] = content;

	return content;
};

/*
	Render view from file
    @controller {Controller}
    @name {String}
    return {Object}
*/
exports.generateView = function(controller, name, plus) {
	return new View(controller).load(name, controller.prefix, plus);
};

/*
	Load content from file
    @controller {Controller}
    @name {String}
    return {String}
*/
exports.generateContent = function(controller, name) {
	return new Content(controller).load(name, controller.prefix);
};

/*
	Internal function
    @str {String}
    return {String}
*/
exports.appendThis = function(str) {
	var index = str.indexOf('(');
	var dot = str.indexOf('.');

	if (index <= 0)
		return str;

	if (dot > 0 && dot < index)
		return str;
	var end = str.substring(index + 1);
	return str.substring(0, index) + '.call(this' + (end[0] === ')' ? end : ',' + end);
};

exports.appendModel = function(str) {
	var index = str.indexOf('(');
	if (index === -1)
		return str;

	var end = str.substring(index + 1);
	return str.substring(0, index) + '(model' + (end[0] === ')' ? end : ',' + end);
};

// *********************************************************************************
// =================================================================================
// TEMPLATE ENGINE
// =================================================================================
// *********************************************************************************


/*
    Template class
    @controller {Controller}
    @model {Object}
    @repository {Object}
    return {Template}
*/
function Template(controller, model, repository) {
	this.controller = controller;
	this.model = model;
	this.repository = repository || null;
	this.prefix = controller.prefix;
	this.cache = controller.cache;
	this.name = '';

	if (typeof(model) === UNDEFINED)
		model = '';

	if (model !== null && !utils.isArray(model))
		this.model = [model];
}

/*
    Parse HTML
    @html {String}
    @isRepository {Boolean}
    return {Object}
*/
Template.prototype.parse_old = function(html, isRepository) {

	var self = this;
	var indexBeg = html.indexOf('<!--');
	var indexEnd = html.lastIndexOf('-->');

	var beg = '';
	var end = '';
	var template = html.trim();

	if (indexBeg !== -1 && indexEnd !== -1) {
		beg = html.substring(0, indexBeg).trim();
		end = html.substring(indexEnd + 3).trim();
		template = html.substring(indexBeg + 4, indexEnd).trim();
	}

	beg = minifyHTML(beg);
	end = minifyHTML(end);
	template = minifyHTML(template);

	indexBeg = 0;
	var indexer = 0;
	var index = 0;

	var builder = [];
	var property = [];
	var keys = {};

	var tmp = template.match(/(@)?\{[^}\n]*\}/g);

	if (tmp === null)
		tmp = [];

	var length = tmp.length;
	var indexKey = 0;

	for (var i = 0; i < length; i++) {

		var format = '';
		var name = tmp[i];
		var isEncode = true;
		var cond = '';
		var isView = name[0] === '@';

		indexEnd = template.indexOf(name, indexBeg);

		var b = template.substring(indexBeg, indexEnd);
		builder.push(b);
		indexBeg = indexEnd + name.length;

		if (!isView) {

        	index = name.indexOf('?');
        	if (index !== -1) {
	            format = name.substring(index + 1, name.length - 1).trim();
	            name = name.substring(1, index);
	            cond = parseConditionParams(name);
                var condition = parseCondition(format);
            	if (cond.length !== 0) {
					format = "(function(){return " + name.split(cond).join('@#1_0;') + "})().condition(" + condition + ")";
					name = cond;
            	} else
            		format = ".condition(" + condition + ")";

        	} else {

				index = name.indexOf('|');
		        if (index !== -1) {
			            format = name.substring(index + 1, name.length - 1).trim();
			            name = name.substring(1, index);
			            var pluralize = parsePluralize(format);
			            if (pluralize.length === 0) {
			                if (format.indexOf('#') === -1) {
			                    var condition = parseCondition(format);
			                    if (condition.length === 0) {
			                        var count = utils.parseInt(format);
			                        if (count === 0) {
			                            format = ".format('" + format + "')";
			                        } else
			                            format = ".max(" + (count + 3) + ",'...')";
			                    } else
			                   		format = ".condition(" + condition + ")";
			                } else
			                    format = ".format('" + format + "')";
			            } else
			                format = pluralize;
			        } else
        				name = name.substring(1, name.length - 1);
        	}

			if (name[0] === '!') {
				name = name.substring(1);
				isEncode = false;
			}

			name = name.trim();
		}

		if (isEncode)
			format += '.toString().encode()';

		var controller = '';

		if (isView) {

			isEncode = false;
			name = name.substring(2, name.length - 1);

			if (name.substring(0, 8) === 'template') {
				controller = 'controller.' + parseParams(name, function(prop, index) {

					if (index === 1 || index === 3) {
						indexer = keys[prop];
						if (typeof(indexer) === UNDEFINED) {
							property.push(prop);
							indexer = property.length - 1;
							keys[key] = indexer;
							indexKey++;
						}
						return 'prop[' + indexer + ']';
					}

					return prop;
				});
			} else if (name.substring(0, 4) === 'view') {

				var counter = 0;
				controller = 'controller.' + parseParams(name, function(prop, index) {
					counter++;
					if (index === 1) {
						indexer = keys[prop];
						if (typeof(indexer) === UNDEFINED) {
							property.push(prop);
							indexer = property.length - 1;
							keys[key] = indexer;
							indexKey++;
						}
						return 'prop[' + indexer + ']';
					}

					return prop;
				});

				if (counter === 1)
					controller = controller.substring(0, controller.length - 1) + ',null,true)';
				else if (counter === 2)
					controller = controller.substring(0, controller.length - 1) + ',true)';
			} else
				throw new Error('Template "' + self.name + '" contains an illegal tag "' + tmp[i] + '".');
		}

		if (!isView) {

			var key = name + format + indexKey;
			indexer = keys[key];

			if (typeof(indexer) === UNDEFINED) {
				property.push(name.trim());
				indexer = property.length - 1;
				keys[key] = indexer;
			}

			if (format.indexOf('@#1_0;') === -1)
				builder.push('prop[' + indexer + ']' + format);
			else
				builder.push(format.split('@#1_0;').join('prop[' + indexer + ']'));

		} else
			builder.push(controller);
	}

	if (indexBeg !== template.length)
		builder.push(template.substring(indexBeg));

	var fn = [];
	var length = builder.length;
	for (var i = 0; i < length; i++) {

		var str = builder[i];

		if (i % 2 !== 0) {
			if (str.length > 0)
				fn.push(str);
		}
		else
			fn.push("'" + str.replace(/\'/g, "\\'").replace(/\n/g, '\\n') + "'");
	}

	var repositoryBeg = null;
	var repositoryEnd = null;

	if (!isRepository && self.repository !== null) {
		repositoryBeg = beg.indexOf('{') !== -1 ? self.parse_old(beg, true) : null;
		repositoryEnd = end.indexOf('{') !== -1 ? self.parse_old(end, true) : null;
	}

	try
	{
		return { generator: eval('(function(prop,controller){return ' + fn.join('+') + ';})'), beg: beg, end: end, property: property, repositoryBeg: repositoryBeg, repositoryEnd: repositoryEnd };
	} catch (ex) {
		self.controller.framework.error(ex, 'Template compiler', self.controller.req.uri);
	}
};

function parseParams(tmp, rp) {

	var isCopy = false;

	var index = tmp.indexOf('(');
	if (index === -1)
		return tmp;

	var arr = tmp.substring(index + 1, tmp.length - 1).replace(/\s/g, '').split(',');
	var length = arr.length;

	for (var i = 0; i < length; i++)
		arr[i] = rp(arr[i], i);

	tmp = tmp.substring(0, index + 1) + arr.join(',') + ')';
	return tmp;
}

function parseConditionParams(value) {
	var property = value.match(/[^"']?[a-zA-Z0-9\.\#]+/i);
	if (property === null)
		return '';
	return property.toString();
}

function parseCondition(value) {

	value = value.trim();

	var condition = value[0];
	if (condition !== '"' && condition !== '\'')
		return '';

	var index = value.indexOf(condition, 1);
	if (index === -1)
		return '';

	var a = value.substring(1, index).replace(/\'/g, "\\'");
	index = value.indexOf(condition, index + 2);

	if (index === -1)
		return "'{0}'".format(a);

	return "'{0}','{1}'".format(a, value.substring(index + 1, value.length - 1).replace(/\'/g, "\\'"));
}

function parsePluralize(value) {

	value = value.trim();

	var condition = value[0];
	if (condition !== '"' && condition !== '\'')
		return '';

	var index = value.indexOf(condition, 1);
	if (index === -1)
		return '';

	var a = value.substring(1, index).replace(/\'/g, "\\'");
	var b = '';
	var c = '';
	var d = '';

	var beg = value.indexOf(condition, index + 1);

	if (beg === -1)
		return '';

	index = value.indexOf(condition, beg + 1);
	b = value.substring(beg + 1, index).replace(/\'/g, "\\'");
	c = '';

	beg = value.indexOf(condition, index + 1);
	if (beg === -1)
		return '';

	index = value.indexOf(condition, beg + 1);
	c = value.substring(beg + 1, index).replace(/\'/g, "\\'");

	beg = value.indexOf(condition, index + 1);
	if (beg === -1)
		return -1;

	index = value.indexOf(condition, beg + 1);
	d = value.substring(beg + 1, index).replace(/\'/g, "\\'");

	return ".pluralize('{0}','{1}','{2}','{3}')".format(a, b, c, d);
}

/*
    Read from file
    @name {String}
    return {Object} :: return parsed HTML
*/
Template.prototype.read = function(name) {
	var self = this;
	var config = self.controller.config;
	var isOut = name[0] === '.';
	var filename = isOut ? name.substring(1) + '.html' : utils.combine(config['directory-templates'], name + '.html');

	if (!fs.existsSync(filename))
		return null;

	var content = fs.readFileSync(filename).toString(ENCODING);

	if (content.indexOf('model') !== -1 && content.indexOf('@{') !== -1)
		return self.parse(content);

	return self.parse_old(content);
};

Template.prototype.parse = function(html) {

	var self = this;
	var indexBeg = html.indexOf('<!--');
	var indexEnd = html.lastIndexOf('-->');

	var beg = '';
	var end = '';
	var template = html.trim();

	if (indexBeg !== -1 && indexEnd !== -1) {
		beg = html.substring(0, indexBeg).trim();
		end = html.substring(indexEnd + 3).trim();
		template = html.substring(indexBeg + 4, indexEnd).trim();
	}

	beg = minifyHTML(beg);
	end = minifyHTML(end);
	template = minifyHTML(template);

	return { is: true, beg: beg.length > 0 ? view_parse(beg) : null, end: end.length > 0 ? view_parse(end) : null, template: view_parse(template) };
};

/*
    Load template with/without prefix
    @name {String}
    @prefix {String} :: optional
    return {Object} :: return parsed HTML
*/
Template.prototype.load = function(name, prefix, plus) {

	var self = this;

	// Is dynamic content?
	if (name.indexOf('{') !== -1) {
		self.name = '<dynamic>';
		return self.dynamic(name);
	}

	self.name = plus + name + (isPrefix ? '#' + prefix : '');

	var isPrefix = (prefix || '').length > 0;
	var key = 'template.' + plus + name + (isPrefix ? '#' + prefix : '') + (self.repository !== null ? '.repository' : '');
	var generator = self.controller.framework.temporary.views[key] || null;

	if (generator !== null)
		return generator;

	generator = self.read(plus + name + (isPrefix ? '#' + prefix : ''));

	if (generator === null && isPrefix)
		generator = self.read(plus + name);

	if (generator === null)
		self.controller.framework.error('Template "' + plus + name + '" not found.', self.controller.name, self.controller.uri);

	if (generator !== null && !self.controller.isDebug)
		self.controller.framework.temporary.views[key] = generator;

	return generator;
};

/*
	Compile dynamic template
	@content {String}
	return {Object} :: return parsed HTML
*/
Template.prototype.dynamic = function(content) {

	var self = this;
	var key = 'template.' + content.md5();
	var generator = self.controller.framework.temporary.views[key] || null;

	if (generator !== null)
		return generator;

	generator = self.parse(content);

	if (generator !== null && !self.controller.isDebug)
		self.controller.framework.temporary.views[key] = generator;

	return generator;
};

/*
    Render HTML
    @name {String}
    return {String}
*/
Template.prototype.render = function(name, plus) {

	var self = this;
	var generator = self.load(name, self.prefix, plus);

	if (generator === null)
		return '';

	if (!generator.is) {
		var mid = compile(generator, self.model, true, self.controller, false);
		var beg = generator.repositoryBeg !== null ? compile(generator.repositoryBeg, self.repository, false, self.controller) : generator.beg;
		var end = generator.repositoryEnd !== null ? compile(generator.repositoryEnd, self.repository, false, self.controller) : generator.end;
		return beg + mid + end;
	}

	var builder = '';

	if (generator.beg !== null)
		builder += generator.beg.call(self.controller, self.controller, self.repository, self.model, self.controller.session, self.controller.get, self.controller.post, self.controller.url, self.controller.framework.global, self.controller.framework.helpers, self.controller.user, self.controller.config, self.controller.framework.functions, 0).replace(/\\n/g, '\n');

	if (self.model instanceof Array) {
		var length = self.model.length;
		for (var i = 0; i < length; i++)
			builder += generator.template.call(self.controller, self.controller, self.repository, self.model[i], self.controller.session, self.controller.get, self.controller.post, self.controller.url, self.controller.framework.global, self.controller.framework.helpers, self.controller.user, self.controller.config, self.controller.framework.functions, i).replace(/\\n/g, '\n');
	} else
		builder += generator.template.call(self.controller, self.controller, self.repository, self.model, self.controller.session, self.controller.get, self.controller.post, self.controller.url, self.controller.framework.global, self.controller.framework.helpers, self.controller.user, self.controller.config, self.controller.framework.functions, 0).replace(/\\n/g, '\n');

	if (generator.end !== null)
		builder += generator.end.call(self.controller, self.controller, self.repository, self.model, self.controller.session, self.controller.get, self.controller.post, self.controller.url, self.controller.framework.global, self.controller.framework.helpers, self.controller.user, self.controller.config, self.controller.framework.functions, 0).replace(/\\n/g, '\n');

	return builder;
};

/*
	Eval parsed code
    @generator {Object}
    @obj {Array}
    @plain {Boolean} :: internal property
    return {String}
*/
function compile(generator, obj, plain, controller) {

	var html = '';

	if (plain) {

		if (!utils.isArray(obj))
			obj = [obj];

		var length = obj.length;

		for (var j = 0; j < length; j++)
			html += compile_eval(generator, obj[j], j, controller);

	} else
		html = compile_eval(generator, obj, 0, controller);

	return plain ? html : generator.beg + html + generator.end;
}

/*
	Eval parsed code
    @generator {Object}
    @model {Object}
    return {String}
*/
function compile_eval(generator, model, indexer, controller) {

	var params = [];
	var length = generator.property.length;

	for (var i = 0; i < length; i++) {

		var property = generator.property[i];
		var val;

		if (property !== '') {
			if (property.indexOf('.') !== -1) {
				var arr = property.split('.');
				if (arr.length === 2)
					val = model[arr[0]][arr[1]];
				else if (arr.length === 3)
					val = model[arr[0]][arr[1]][arr[3]];
				else if (arr.length === 4)
					val = model[arr[0]][arr[1]][arr[3]][arr[4]];
				else if (arr.length === 5)
					val = model[arr[0]][arr[1]][arr[3]][arr[4]][arr[5]];
			} else if (property === '#')
				val = indexer;
			else
				val = model[property];
		} else
			val = model;

		if (typeof(val) === FUNCTION)
			val = val(i);

		if (typeof(val) === UNDEFINED || val === null)
			val = '';

		params.push(val);
	}

	return generator.generator.call(null, params, controller);
}

/*
	Generate template / Render template
	@controller {Controller}
	@name {String} :: filename of template
	@model {Array of Object}
	@repository {Object} :: optional
*/
exports.generateTemplate = function(controller, name, model, repository, plus) {
	return new Template(controller, model, repository).render(name, plus);
};