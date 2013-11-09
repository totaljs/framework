//  parseMULTIPART
//  parseMULTIPART_MIXED
//	HttpFile
//	LESS CSS + Auto vendor prefixes
//	JavaScript Compiler
//	View engine
//	Template engine

'use strict';

var fs = require('fs');
var image = require('./image');

var ENCODING = 'utf8';
var UNDEFINED = 'undefined';
var FUNCTION = 'function';

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
	return {St<ring array}
*/
exports.parseMULTIPART = function(req, contentType, maximumSize, tmpDirectory, onXSS, callback) {

	var parser = new MultipartParser();
	var boundary = contentType.split(';')[1];
	var isFile = false;
	var size = 0;
	var stream = null;
	var tmp = { name: '', value: '', contentType: '', fileName: '', fileNameTmp: '', fileSize: 0, isFile: false, step: 0 };
	var ip = req.ip.replace(/\./g, '');
	var close = 0;
	var isXSS = false;

	boundary = boundary.substring(boundary.indexOf('=') + 1);

	req.buffer.isExceeded = false;
	req.buffer.isData = true;

	parser.initWithBoundary(boundary);

	parser.onPartBegin = function() {
		tmp.value = '';
		tmp.fileSize = 0;
		tmp.step = 0;
		tmp.isFile = false;
    };

    parser.onHeaderValue = function(buffer, start, end) {

		if (req.buffer.isExceeded || tmp.step > 1)
			return;

		if (isXSS)
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
			close++;
			return;
		}
    };

    parser.onPartData = function(buffer, start, end) {

		if (req.buffer.isExceeded)
			return;

		if (isXSS)
			return;

		var data = buffer.slice(start, end);
		var length = data.length;

		size += length;

		if (size >= maximumSize) {
			req.buffer.isExceeded = true;
			return;
		}

		if (!tmp.isFile) {
			tmp.value += data.toString(ENCODING);
			return;
		}

		stream.write(data);
		tmp.fileSize += length;
    };

    parser.onPartEnd = function() {

		if (stream !== null) {

			stream.on('close', function() {
				close--;
			});

			stream.end();
			stream.destroy();
			stream = null;
		}

		if (req.buffer.isExceeded)
			return;

		if (isXSS)
			return;

		if (tmp.isFile) {
			req.data.files.push(new HttpFile(tmp.name, tmp.fileName, tmp.fileNameTmp, tmp.fileSize, tmp.contentType));
			return;
		}

		if (onXSS(tmp.value))
			isXSS = true;

		req.data.post[tmp.name] = tmp.value;
    };

    parser.onEnd = function() {

		var cb = function () {

			if (close <= 0) {

				if (isXSS && req.flags.indexOf('xss') === -1)
					req.flags.push('xss');

				callback();
				return;
			}

			setImmediate(cb);
		};

		cb();
    };

    req.on('data', parser.write.bind(parser));
};

/*
	Internal function / Parse MIXED data
	@req {ServerRequest}
	@contentType {String}
	@tmpDirectory {String}
	@onFile {Function} :: this function is called when is a file downloaded
	@callback {Function}
	return {String array}
*/
exports.parseMULTIPART_MIXED = function(req, contentType, tmpDirectory, onFile, callback) {

	var parser = new MultipartParser();
	var boundary = contentType.split(';')[1];
	var stream = null;
	var tmp = { name: '', contentType: '', fileName: '', fileNameTmp: '', fileSize: 0, isFile: false, step: 0 };
	var ip = req.ip.replace(/\./g, '');
	var close = 0;

	boundary = boundary.substring(boundary.indexOf('=') + 1);

	req.buffer.isExceeded = false;
	req.buffer.isData = true;

	parser.initWithBoundary(boundary);

	parser.onPartBegin = function() {
		tmp.fileSize = 0;
		tmp.step = 0;
		tmp.isFile = false;
    };

    parser.onHeaderValue = function(buffer, start, end) {
		if (req.buffer.isExceeded || tmp.step > 1)
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
			close++;
			return;
		}
    };

    parser.onPartData = function(buffer, start, end) {
		var data = buffer.slice(start, end);
		var length = data.length;

		if (!tmp.isFile)
			return;

		stream.write(data);
		tmp.fileSize += length;
	};

    parser.onPartEnd = function() {
		if (stream !== null) {

			stream.on('close', function() {
				close--;
			});

			stream.end();
			stream.destroy();
			stream = null;
		}

		if (!tmp.isFile)
			return;

		onFile(new HttpFile(tmp.name, tmp.fileName, tmp.fileNameTmp, tmp.fileSize, tmp.contentType));
    };

    parser.onEnd = function() {
		var cb = function cb () {

			if (close <= 0) {
				callback();
				return;
			}

			setImmediate(cb);
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
exports.routeCompare = function(url, route, isSystem) {

	if (route.length !== url.length)
		return false;

	var skip = url.length === 1 && url[0] === '/';

	for (var i = 0; i < url.length; i++) {

		var value = route[i];

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

	for (var i = 0; i < arr2.length; i++) {
		var value = arr2[i];

		if (value[0] === '!')
			continue;

		if (value === 'json')
			value = 'post';

		if (noLoggedUnlogged) {
			if (value === 'logged' || value === 'unlogged')
				continue;
		}

		var index = arr1.indexOf(value);

		if (index === -1 && value === 'xss') {
			isXSS = true;
			continue;
		}

		if (value === 'xss')
			isXSS = true;

		if (index === -1)
			return value === 'logged' || value === 'unlogged' ? -1 : 0;
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
	@filenameTMP {String}
	@fileSize {Number}
	@contentType {String}
	return {HttpFile}
*/
function HttpFile(name, filename, filenameTMP, size, contentType) {
	this.name = name;
	this.filename = filename;
	this.size = size;
	this.contentType = contentType;
	this.filenameTMP = filenameTMP;
}

/*
	Read file to byte array
	@fileName {String} :: new filename
	return {HttpFile}
*/
HttpFile.prototype.copy = function(filename) {
	var self = this;
	fs.createReadStream(self.filenameTMP).pipe(fs.createWriteStream(filename));
	return self;
};

/*
	Read file to buffer (SYNC)
	return {Buffer}
*/
HttpFile.prototype.readSync = function() {
	return fs.readFileSync(this.filenameTMP);
};

/*
	Read file to buffer (ASYNC)
	@callback {Function} :: function(error, data);
	return {HttpFile}
*/
HttpFile.prototype.read = function(callback) {
	var self = this;
	fs.readFile(self.filenameTMP, callback);
	return self;
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
	return image.init(this.filenameTMP, imageMagick);
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
    var without = ['@import', '@font-face', '@keyframes', '@-moz-keyframes', '@-webkit-keyframes', '@-o-keyframes', '@-ms-keyframes', '@media'];

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
				value = value.replace(o.value, '');
				return;
			}

			var val = arr.find(function(oo) {
				return oo.name === o.name;
			});

			if (val === null)
				return;

			var v = o.getValue(val);
			value = value.replace(o.value, v);
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

	var prefix = ['appearance', 'box-shadow', 'border-radius', 'border-image', 'column-count', 'column-gap', 'column-rule', 'display', 'transform', 'transform-origin', 'transition', 'user-select', 'animation', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-play-state', 'opacity', 'background', 'background-image', 'text-overflow', 'font-smoothing'];
	var id = '@#auto-vendor-prefix#@';

	if (value.indexOf(id) === -1)
		return value;

	value = autoprefixer_keyframes(value.replace(id, ''));

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

	for (var i = 0; i < builder.length; i++) {

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

			value = value.replace(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		if (name === 'background' || name === 'background-image') {

			if (property.indexOf('linear-gradient') === -1)
				continue;

			updated = plus + delimiter;
			updated += plus.replace('linear-', '-webkit-linear-') + delimiter;
			updated += plus.replace('linear-', '-moz-linear-') + delimiter;
			updated += plus.replace('linear-', '-o-linear-') + delimiter;
			updated += plus.replace('linear-', '-ms-linear-');

			value = value.replace(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		if (name === 'text-overflow') {
			updated = plus + delimiter;
			updated += plus.replace('text-overflow', '-ms-text-overflow');
			value = value.replace(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		if (name === 'display') {

			if (property.indexOf('box') === -1)
				continue;

			updated = plus + delimiter;
			updated += plus.replace('box', '-webkit-box') + delimiter;
			updated += plus.replace('box', '-moz-box');

			value = value.replace(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		updated += '-webkit-' + plus + delimiter;
		updated += '-moz-' + plus;

		if (name !== 'box-shadow' && name !== 'border-radius') {

			if (name.indexOf('animation') === -1)
				updated += delimiter + '-ms-' + plus;

			updated += delimiter + '-o-' + plus;
		}

		value = value.replace(property, '@[[' + output.length + ']]');
		output.push(updated);
	}

	for (var i = 0; i < output.length; i++)
		value = value.replace('@[[' + i + ']]', output[i]);

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

	for (var i = 0; i < builder.length; i++) {

		var name = builder[i].name;
		var property = builder[i].property;

		if (name !== 'keyframes')
			continue;

		var plus = property.substring(1);
		var delimiter = '\n';

		var updated = plus + delimiter;

		updated += '@-webkit-' + plus + delimiter;
		updated += '@-moz-' + plus + delimiter;
		updated += '@-o-' + plus;

		value = value.replace(property, '@[[' + output.length + ']]');
		output.push(updated);
	}

	for (var i = 0; i < output.length; i++)
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

    function put(c)
    {
        if (c === 13 || c === 10)
            sb.push(' ');
        else
            sb.push(String.fromCharCode(c));
    }

    function isAlphanum(c)
    {
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
  this.boundary = new Buffer(str.length+4);
  this.boundary.write('\r\n--', 'ascii', 0);
  this.boundary.write(str, 'ascii', 4);
  this.lookbehind = new Buffer(this.boundary.length+8);
  this.state = S.START;

  this.boundaryChars = {};
  for (var i = 0; i < this.boundary.length; i++) {
    this.boundaryChars[this.boundary[i]] = true;
  }
};

MultipartParser.prototype.write = function(buffer) {
  var self = this,
      i = 0,
      len = buffer.length,
      prevIndex = this.index,
      index = this.index,
      state = this.state,
      flags = this.flags,
      lookbehind = this.lookbehind,
      boundary = this.boundary,
      boundaryChars = this.boundaryChars,
      boundaryLength = this.boundary.length,
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

  this.index = index;
  this.state = state;
  this.flags = flags;

  return len;
};

MultipartParser.prototype.end = function() {
  var callback = function(self, name) {
    var callbackSymbol = 'on'+name.substr(0, 1).toUpperCase()+name.substr(1);
    if (callbackSymbol in self) {
      self[callbackSymbol]();
    }
  };
  if ((this.state == S.HEADER_FIELD_START && this.index === 0) ||
      (this.state == S.PART_DATA && this.index == this.boundary.length)) {
    callback(this, 'partEnd');
    callback(this, 'end');
  } else if (this.state != S.END) {
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

/*
	Parse HTML
    @html {String}
    return {Object}
*/
function parse(html, controller) {
	var index = 0;
	var count = 0;

	var copy = false;
	var framework = controller.framework;
	var code = '';
	var cache = compressCSS(compressJS(html, 0, framework), 0, framework);
	var minify = true;

	var indexBeg = 0;
	var builder = [];
	var execute = [];
	var keys = {};
	var condition = 0;
	var isCondition = false;
	var plus = '';
	var beg = '';
	var end = '';
	var name = '';

	while (index < cache.length) {

		var current = cache[index];
		var next = cache[index + 1];

		index++;

		if (!copy && current === '@' && next === '{') {
			copy = true;
			count = 0;
			indexBeg = index;
			continue;
		}

		if (copy && current === '{') {
			count++;
			if (count <= 1)
				continue;
		}

		if (copy && current === '}') {
			if (count > 1)
				count--;
			else {
				copy = false;

				var other = cache.substring(indexBeg + code.length + 2);

				if (minify)
					other = minifyHTML(other);

				code = code.trim();

				var indexer = keys[code];
				var push = false;

				if (typeof(indexer) === UNDEFINED) {
					indexer = execute.length;
					keys[code] = indexer;
					push = true;
				}

				var value = cache.substring(0, indexBeg - 1);

				condition = code.substring(0, 2) === 'if' ? 1 : code.substring(0, 5) === 'endif' ? 3 : code.substring(0, 4) === 'else' ? 2 : 0;

				builder.push(minify ? minifyHTML(value).replace(/\n/g, '\\n') : value.replace(/\n/g, '\\n'));

				var param = 'arr[' + indexer + ']';

				if (condition > 0) {

					switch (condition) {
						case 1:
							isCondition = true;
							name = 'if';
							builder.push('({0} ? '.format(param));
							code = code.substring(2).trim();
							break;
						case 2:
							builder.push(':');
							break;
						case 3:
							isCondition = false;
							builder.push(')');
							break;
					}

				} else {

					if (isCondition)
						param = '( ' + param + '(self,repository,model,session,sitemap,get,post,url,empty,global,helper,user) || \'\')';

					builder.push(param);
				}

				var isEncode = code[0] !== '!';

				if (!isEncode)
					code = code.substring(1);

				var a = code.indexOf('.');
				var b = code.indexOf('(');
				var c = code.indexOf('[');

				if (a === -1)
					a = b;

				if (b === -1)
					b = a;

				if (a === -1)
					a = c;

				if (b === -1)
					b = c;

				index = Math.min(a, b);

				if (index === -1)
					index = code.length;

				if (condition !== 1)
					name = code.substring(0, index);

				if (push) {
					beg = '';
					end = '';
					var isDeclared = false;
					switch (name) {

						case 'options':
						case 'readonly':
						case 'selected':
						case 'disabled':
						case 'checked':
						case 'etag':
						case 'modified':
						case 'image':
						case 'download':
						case 'json':
						case 'dns':
						case 'header':
						case 'prefetch':
						case 'prerender':
						case 'next':
						case 'prev':
						case 'canonical':
						case 'currentJS':
						case 'currentCSS':
						case 'currentImage':
						case 'currentUpload':
						case 'currentVideo':
							isEncode = false;
							isDeclared = true;
							code = 'self.$' + code;
							beg = 'return ';
							break;

						case 'view':
						case 'viewToggle':
						case 'content':
						case 'contentToggle':
						case 'template':
						case 'templateToggle':
							beg = 'return self.$';
							break;

						case 'radio':
						case 'text':
						case 'checkbox':
						case 'hidden':
						case 'textarea':
						case 'password':
							isEncode = false;
							isDeclared = true;
							code = 'self.$' + exports.appendModel(code);
							beg = 'return ';
							break;

						case 'js':
						case 'script':
						case 'css':
						case 'favicon':
							beg = '';
							isEncode = false;
							isDeclared = true;
							code = 'self.$' + code + (code.indexOf('(') === -1 ? '()' : '');
							beg = 'return ';
							break;

						case 'routeJS':
						case 'routeCSS':
						case 'routeImage':
						case 'routeFont':
						case 'routeUpload':
						case 'routeVideo':
						case 'routeStatic':
							isEncode = false;
							isDeclared = true;
							code = 'self.' + code;
							beg = 'return ';
							break;

						case 'resource':
							code = 'self.' + code;
							isDeclared = true;
							beg = 'return ';
							break;

						case 'global':
						case 'model':
						case 'repository':
						case 'session':
						case 'user':
						case 'config':
						case 'get':
						case 'post':
							beg = 'return self.';
							break;

						case 'head':
						case 'meta':
						case 'sitemap':
						case 'settings':
						case 'layout':
						case 'title':
						case 'description':
						case 'keywords':

							if (code.indexOf('(') !== -1) {
								beg = 'self.';
								end = ';return \'\'';
							} else {
								beg = 'return self.repository["$';
								end = '"]';
							}

							break;

						case 'host':
							isEncode = false;

							if (code.contains('('))
								code = 'self.' + code;
							else
								code = 'self.host()';

							beg = 'return ';
							isDeclared = true;
							break;

						case 'url':
							isEncode = false;

							if (code.contains('('))
								code = 'self.$' + code;
							else
								code = 'url';

							beg = 'return ';
							isDeclared = true;
							break;
					}

					if (isCondition && condition === 0)
						code = '(function(){' + beg + code + end + ';})';

					execute.push({ run: code, name: name, isEncode: isEncode, isDeclared: isDeclared });
				}

				cache = other;

				index = 0;
				code = '';
				continue;
			}
		}

		if (copy)
			code += current;
	}

	builder.push(minify ? minifyHTML(cache.replace(/\n/g, '\\n')) : cache.replace(/\n/g, '\\n'));

	var fn = '';
	var isPlus = true;
	condition = 0;

	for (var i = 0; i < builder.length; i++) {

		var str = builder[i];

		if (str === '')
			continue;

		if (condition === 1 && str[0] === ':') {
			condition = 2;
			fn += ' : ';
			isPlus = false;
			continue;
		}

		if (condition !== 0 && str[0] === ')') {

			isPlus = true;

			if (condition !== 2)
				fn += ' : empty';

			fn += ')';
			condition = 0;
			continue;
		}

		if (isPlus && fn.length > 0)
			fn += '+';

		if (!isPlus)
			isPlus = true;

		if (str.substring(0, 4) === '(arr') {

			if (condition !== 0) {
				controller.framework.error(new Error('View engine doesn\'t support nested condition.'), 'View compiler', controller.req.uri);
				fn = '';
				break;
			}

			isPlus = false;
			condition = 1;
		}

		if (i % 2 !== 0)
			fn += str;
		else
			fn += "'" + str.replace(/\'/g, "\\'") + "'";
	}

	fn = '(function(arr,self,repository,model,session,sitemap,get,post,url,empty,global,helper,user){return ' + (fn.length === 0 ? 'empty' : fn) + ';})';

	try
	{
		return { generator: eval(fn), execute: execute };
	} catch (ex) {
		controller.framework.error(ex, 'View compiler', controller.req.uri);
		return null;
	}
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

		html = html.replace(html.substring(beg, end + 3), '');
		beg = html.indexOf(tagBeg);
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
	if (indexBeg === -1)
		return html;

	var indexEnd = html.indexOf(strTo, indexBeg + strFrom.length);
	if (indexEnd === -1)
		return html;

	var js = html.substring(indexBeg, indexEnd + strTo.length).trim();
	var val = js.substring(strFrom.length, js.length - strTo.length).trim();
	var compiled = exports.compile_javascript(val, framework).replace(/\\n/g, "'+(String.fromCharCode(13)+String.fromCharCode(10))+'");

	html = html.replace(js, (strFrom + compiled.dollar() + strTo).trim());

	// voláme znova funkciu v prípade
	return compressJS(html, indexBeg + compiled.length, framework);
}

function compressCSS(html, index, framework) {
	var strFrom = '<style type="text/css">';
	var strTo = '</style>';

	var indexBeg = html.indexOf(strFrom, index || 0);
	if (indexBeg === -1)
		return html;

	var indexEnd = html.indexOf(strTo, indexBeg + strFrom.length);
	if (indexEnd === -1)
		return html;

	var css = html.substring(indexBeg, indexEnd + strTo.length);
	var val = css.substring(strFrom.length, css.length - strTo.length).trim();
	var compiled = exports.compile_less(val, true, framework);

	html = html.replace(css, (strFrom + compiled + strTo).trim());

	// voláme znova funkciu v prípade
	return compressCSS(html, indexBeg + compiled.length, framework);

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

	var reg1 = new RegExp(/[\n\r\t]+/g);
	var reg2 = new RegExp(/\s{2,}/g);

	var tags =['textarea', 'pre', 'code', 'script'];
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
			cache[key] = value;
			html = html.replace(value, key);
			beg = html.indexOf(tagBeg);
		}
	}

	html = html.replace(reg1, '').replace(reg2, '');

	Object.keys(cache).forEach(function(o) {
		html = html.replace(o, cache[o]);
	});

	return html;
}

/*
	Render view
    @name {String}
    return {Object} :: return factory object
*/
View.prototype.render = function(name) {
	var self = this;
	return self.load(name, self.prefix);
};

/*
	Read view
    @name {String}
    return {Object} :: return factory object
*/
View.prototype.read = function(name) {
	var self = this;
	var config = self.controller.config;
	var filename = utils.combine(config['directory-views'], name + '.html');

	if (fs.existsSync(filename))
		return parse(fs.readFileSync(filename).toString('utf8'), self.controller);

	var index = name.lastIndexOf('/');
	if (index === -1)
		return null;

	name = name.substring(index + 1);
	if (name.indexOf('#') !== -1)
		return null;

	filename = utils.combine(config['directory-views'], name + '.html');

	if (fs.existsSync(filename))
		return parse(fs.readFileSync(filename).toString('utf8'), self.controller);

	return null;
};

/*
	Load view
    @name {String}
    @prefix {String}
    return {Object} :: return factory object
*/
View.prototype.load = function(name, prefix) {

	var self = this;
	var isPrefix = (prefix || '').length > 0;

	var key = 'view.' + name + (isPrefix ? '#' + prefix : '');

	var generator = self.cache.read(key);

	if (generator !== null)
		return generator;

	generator = self.read(name + (isPrefix ? '#' + prefix : ''));

	if (generator === null && isPrefix)
		generator = self.read(name);

	if (generator !== null && !self.controller.isDebug)
		self.cache.add(key, generator, new Date().add('minute', 5));

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
	var fileName = utils.combine(config['directory-contents'], name + '.html');

	if (fs.existsSync(fileName))
		return minifyHTML(fs.readFileSync(fileName).toString('utf8'));

	return null;
};

/*
	Render content
    @name {String}
    return {String}
*/
Content.prototype.render = function(name) {
	var self = this;
	return self.load(name, self.prefix);
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
	var content = self.cache.read(key);

	if (content !== null)
		return content;

	content = self.read(name + (isPrefix ? '#' + prefix : ''));

	if (content === null && isPrefix)
		content = self.read(name);

	if (content === null)
		self.controller.framework.error('Content "' + name + '" not found.', self.controller.name, self.controller.uri);

	if (content !== null && !self.controller.isDebug)
		self.cache.add(key, content, new Date().add('minute', 5));

	return content;
};

/*
	Render view from file
    @controller {Controller}
    @name {String}
    return {Object}
*/
exports.generateView = function(controller, name) {
	var view = new View(controller);
	return view.render(name);
};

/*
	Load content from file
    @controller {Controller}
    @name {String}
    return {String}
*/
exports.generateContent = function(controller, name) {
	var content = new Content(controller);
	return content.render(name);
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
Template.prototype.parse = function(html, isRepository) {

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

	for (var i = 0; i < tmp.length; i++) {

		var format = '';
		var name = tmp[i];
		var isEncode = true;

		var isView = name[0] === '@';

		indexEnd = template.indexOf(name, indexBeg);

		var b = template.substring(indexBeg, indexEnd);
		builder.push(b);
		indexBeg = indexEnd + name.length;

		if (!isView) {
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
	        }
	        else
	            name = name.substring(1, name.length - 1);

			if (name[0] === '!') {
				name = name.substring(1);
				isEncode = false;
			}

			name = name.trim();
		}

		if (isEncode)
			format += '.toString().htmlEncode()';

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
						}
						return 'prop[' + indexer + ']';
					}

					return prop;
				});

				if (counter === 1)
					controller = controller.substring(0, controller.length - 1) + ',null,true)';
				else if (counter === 2)
					controller = controller.substring(0, controller.length - 1) + ',true)';
			}
		}

		if (!isView) {
			var key = name + format;
			indexer = keys[key];

			if (typeof(indexer) === UNDEFINED) {
				property.push(name.trim());
				indexer = property.length - 1;
				keys[key] = indexer;
			}
			builder.push('prop[' + indexer + ']' + format);
		} else
			builder.push(controller);
	}

	if (indexBeg !== template.length)
		builder.push(template.substring(indexBeg));

	var fn = [];
	for (var i = 0; i < builder.length; i++) {

		var str = builder[i];

		if (i % 2 !== 0)
			fn.push(str);
		else
			fn.push("'" + str.replace(/\'/g, "\\'").replace(/\n/g, '\\n') + "'");
	}

	var repositoryBeg = null;
	var repositoryEnd = null;

	if (!isRepository && self.repository !== null) {
		repositoryBeg = beg.indexOf('{') !== -1 ? self.parse(beg, true) : null;
		repositoryEnd = end.indexOf('{') !== -1 ? self.parse(end, true) : null;
	}

	try
	{
		return { generator: eval('(function(prop, controller){return ' + fn.join('+') + ';})'), beg: beg, end: end, property: property, repositoryBeg: repositoryBeg, repositoryEnd: repositoryEnd };
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

	return ".pluralize('{0}','{1}','{2}', '{3}')".format(a, b, c, d);
}

/*
    Read from file
    @name {String}
    return {Object} :: return parsed HTML
*/
Template.prototype.read = function(name) {
	var self = this;
	var config = self.controller.config;
	var fileName = utils.combine(config['directory-templates'], name + '.html');

	if (fs.existsSync(fileName))
		return self.parse(fs.readFileSync(fileName).toString('utf8'));

	return null;
};

/*
    Load template with/without prefix
    @name {String}
    @prefix {String} :: optional
    return {Object} :: return parsed HTML
*/
Template.prototype.load = function(name, prefix) {

	var self = this;
	var isPrefix = (prefix || '').length > 0;

	var key = 'template.' + name + (isPrefix ? '#' + prefix : '') + (self.repository !== null ? '.repository' : '');

	var generator = self.cache.read(key);

	if (generator !== null)
		return generator;

	generator = self.read(name + (isPrefix ? '#' + prefix : ''));

	if (generator === null && isPrefix)
		generator = self.read(name);

	if (generator === null)
		self.controller.framework.error('Template "' + name + '" not found.', self.controller.name, self.controller.uri);

	if (generator !== null && !self.controller.isDebug)
		self.cache.add(key, generator, new Date().add('minute', 5));

	return generator;
};

/*
    Render HTML
    @name {String}
    return {String}
*/
Template.prototype.render = function(name) {

	var self = this;
	var generator = self.load(name, self.prefix);

	if (generator === null)
		return '';

	var mid = compile(generator, self.model, true, self.controller, false);

	var beg = generator.repositoryBeg !== null ? compile(generator.repositoryBeg, self.repository, false, self.controller) : generator.beg;
	var end = generator.repositoryEnd !== null ? compile(generator.repositoryEnd, self.repository, false, self.controller) : generator.end;

	if (name !== 'comments')
		return beg + mid + end;

	return beg + mid + end;
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

		for (var j = 0; j < obj.length; j++)
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
	for (var i = 0; i < generator.property.length; i++) {

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
exports.generateTemplate = function(controller, name, model, repository) {
	var template = new Template(controller, model, repository);
	return template.render(name);
};