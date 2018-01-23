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
 * @module FrameworkImage
 * @version 2.9.2
 */

'use strict';

const sof = { 0xc0: true, 0xc1: true, 0xc2: true, 0xc3: true, 0xc5: true, 0xc6: true, 0xc7: true, 0xc9: true, 0xca: true, 0xcb: true, 0xcd: true, 0xce: true, 0xcf: true };
const child = require('child_process');
const exec = child.exec;
const spawn = child.spawn;
const Fs = require('fs');
const REGEXP_SVG = /(width="\d+")+|(height="\d+")+/g;
const REGEXP_PATH = /\//g;
const REGEXP_ESCAPE = /'/g;
const D = require('os').platform().substring(0, 3).toLowerCase() === 'win' ? '"' : '\'';

var CACHE = {};
var middlewares = {};

if (!global.framework_utils)
	global.framework_utils = require('./utils');

function u16(buf, o) {
	return buf[o] << 8 | buf[o + 1];
}

function u32(buf, o) {
	return buf[o] << 24 | buf[o + 1] << 16 | buf[o + 2] << 8 | buf[o + 3];
}

exports.measureGIF = function(buffer) {
	return { width: buffer[6], height: buffer[8] };
};

// MIT
// Written by TJ Holowaychuk
// visionmedia
exports.measureJPG = function(buffer) {

	var len = buffer.length;
	var o = 0;

	var jpeg = 0xff == buffer[0] && 0xd8 == buffer[1];
	if (!jpeg)
		return;

	o += 2;

	while (o < len) {

		while (0xff != buffer[o]) o++;
		while (0xff == buffer[o]) o++;

		if (!sof[buffer[o]]) {
			o += u16(buffer, ++o);
			continue;
		}

		var w = u16(buffer, o + 6);
		var h = u16(buffer, o + 4);

		return { width: w, height: h };
	}

	return null;
};

// MIT
// Written by TJ Holowaychuk
// visionmedia
exports.measurePNG = function(buffer) {
	return { width: u32(buffer, 16), height: u32(buffer, 16 + 4) };
};

exports.measureSVG = function(buffer) {

	var match = buffer.toString('utf8').match(REGEXP_SVG);
	if (!match)
		return;

	var width = 0;
	var height = 0;

	for (var i = 0, length = match.length; i < length; i++) {
		var value = match[i];

		if (width > 0 && height > 0)
			break;

		if (!width && value.startsWith('width="'))
			width = value.parseInt2();

		if (!height && value.startsWith('height="'))
			height = value.parseInt2();
	}

	return { width: width, height: height };
};

exports.measure = function(type, buffer) {
	switch (type) {
		case '.jpg':
		case '.jpeg':
		case 'jpg':
		case 'jpeg':
		case 'image/jpeg':
			return exports.measureJPG(buffer);
		case '.gif':
		case 'gif':
		case 'image/gif':
			return exports.measureGIF(buffer);
		case '.png':
		case 'png':
		case 'image/png':
			return exports.measurePNG(buffer);
		case '.svg':
		case 'svg':
		case 'image/svg+xml':
			return exports.measureSVG(buffer);
	}
};

function Image(filename, useImageMagick, width, height) {
	var type = typeof(filename);
	this.width = width;
	this.height = height;
	this.builder = [];
	this.filename = type === 'string' ? filename : null;
	this.currentStream = type === 'object' ? filename : null;
	this.isIM = useImageMagick == null ? F.config['default-image-converter'] === 'im' : useImageMagick;
	this.outputType = type === 'string' ? framework_utils.getExtension(filename) : 'jpg';
	this.islimit = false;
}

Image.prototype.clear = function() {
	var self = this;
	self.builder = [];
	return self;
};

Image.prototype.measure = function(callback) {

	var self = this;
	var index = self.filename.lastIndexOf('.');

	if (!self.filename) {
		callback(new Error('Measure does not support stream.'));
		return;
	}

	if (index === -1) {
		callback(new Error('This type of file is not supported.'));
		return;
	}

	var extension = self.filename.substring(index).toLowerCase();
	var stream = require('fs').createReadStream(self.filename, { start: 0, end: extension === '.jpg' ? 40000 : 24 });

	stream.on('data', function(buffer) {

		switch (extension) {
			case '.jpg':
				callback(null, exports.measureJPG(buffer));
				return;
			case '.gif':
				callback(null, exports.measureGIF(buffer));
				return;
			case '.png':
				callback(null, exports.measurePNG(buffer));
				return;
		}

		callback(new Error('This type of file is not supported.'));
	});

	stream.on('error', callback);
	return self;
};

Image.prototype.$$measure = function() {
	var self = this;
	return function(callback) {
		self.measure(callback);
	};
};

/**
 * Execute commands
 * @param {String} filename
 * @param {Function(err, filename)} callback Optional.
 * @param {Function(stream)} writer A custom stream writer, optional.
 * @return {Image}
 */
Image.prototype.save = function(filename, callback, writer) {

	var self = this;

	if (typeof(filename) === 'function') {
		callback = filename;
		filename = null;
	}

	!self.builder.length && self.minify();
	filename = filename || self.filename || '';

	var command = self.cmd(self.filename ? self.filename : '-', filename);

	if (F.isWindows)
		command = command.replace(REGEXP_PATH, '\\');

	var cmd = exec(command, function(err) {

		// clean up
		cmd.kill();
		cmd = null;

		self.clear();

		if (!callback)
			return;

		if (err) {
			callback(err, false);
			return;
		}

		var middleware = middlewares[self.outputType];
		if (!middleware)
			return callback(null, true);

		var reader = Fs.createReadStream(filename);
		var writer = Fs.createWriteStream(filename + '_');

		reader.pipe(middleware()).pipe(writer);
		writer.on('finish', () => Fs.rename(filename + '_', filename, () => callback(null, true)));
	});

	if (self.currentStream) {
		if (self.currentStream instanceof Buffer)
			cmd.stdin.end(self.currentStream);
		else
			self.currentStream.pipe(cmd.stdin);
	}

	CLEANUP(cmd.stdin);
	writer && writer(cmd.stdin);
	return self;
};

Image.prototype.$$save = function(filename, writer) {
	var self = this;
	return function(callback) {
		self.save(filename, callback, writer);
	};
};

Image.prototype.pipe = function(stream, type, options) {

	var self = this;

	if (typeof(type) === 'object') {
		options = type;
		type = null;
	}

	!self.builder.length && self.minify();
	!type && (type = self.outputType);

	var cmd = spawn(self.isIM ? 'convert' : 'gm', self.arg(self.filename ? wrap(self.filename) : '-', (type ? type + ':' : '') + '-'));

	cmd.stderr.on('data', stream.emit.bind(stream, 'error'));
	cmd.stdout.on('data', stream.emit.bind(stream, 'data'));
	cmd.stdout.on('end', stream.emit.bind(stream, 'end'));
	cmd.on('error', stream.emit.bind(stream, 'error'));

	var middleware = middlewares[type];
	if (middleware)
		cmd.stdout.pipe(middleware()).pipe(stream, options);
	else
		cmd.stdout.pipe(stream, options);

	if (self.currentStream) {
		if (self.currentStream instanceof Buffer)
			cmd.stdin.end(self.currentStream);
		else
			self.currentStream.pipe(cmd.stdin);
	}

	return self;
};

/**
 * Create a stream
 * @param {String} type File type (png, jpg, gif)
 * @param {Function(stream)} writer A custom stream writer.
 * @return {ReadStream}
 */
Image.prototype.stream = function(type, writer) {

	var self = this;

	!self.builder.length && self.minify();

	if (!type)
		type = self.outputType;

	var cmd = spawn(self.isIM ? 'convert' : 'gm', self.arg(self.filename ? wrap(self.filename) : '-', (type ? type + ':' : '') + '-'));

	if (self.currentStream) {
		if (self.currentStream instanceof Buffer)
			cmd.stdin.end(self.currentStream);
		else
			self.currentStream.pipe(cmd.stdin);
	}

	writer && writer(cmd.stdin);
	var middleware = middlewares[type];
	return middleware ? cmd.stdout.pipe(middleware()) : cmd.stdout;
};

Image.prototype.cmd = function(filenameFrom, filenameTo) {

	var self = this;
	var cmd = '';

	if (!self.islimit) {
		var tmp = F.config['default-image-consumption'];
		self.limit('memory', (1500 / 100) * tmp);
		self.limit('map', (3000 / 100) * tmp);
	}

	self.builder.sort(sort);

	var length = self.builder.length;
	for (var i = 0; i < length; i++)
		cmd += (cmd ? ' ' : '') + self.builder[i].cmd;

	return (self.isIM ? 'convert' : 'gm -convert') + wrap(filenameFrom, true) + ' ' + cmd + wrap(filenameTo, true);
};

function sort(a, b) {
	return a.priority > b.priority ? 1 : -1;
}

Image.prototype.arg = function(first, last) {

	var self = this;
	var arr = [];

	!self.isIM && arr.push('-convert');
	first && arr.push(first);

	if (!self.islimit) {
		var tmp = F.config['default-image-consumption'];
		self.limit('memory', (1500 / 100) * tmp);
		self.limit('map', (3000 / 100) * tmp);
	}

	self.builder.sort(sort);

	var length = self.builder.length;

	for (var i = 0; i < length; i++) {
		var o = self.builder[i];
		var index = o.cmd.indexOf(' ');
		if (index === -1)
			arr.push(o.cmd);
		else {
			arr.push(o.cmd.substring(0, index));
			arr.push(o.cmd.substring(index + 1).replace(/"/g, ''));
		}
	}

	last && arr.push(last);
	return arr;
};

Image.prototype.identify = function(callback) {
	var self = this;

	exec((self.isIM ? 'identify' : 'gm identify') + wrap(self.filename, true), function(err, stdout) {

		if (err) {
			callback(err, null);
			return;
		}

		var arr = stdout.split(' ');
		var size = arr[2].split('x');
		var obj = { type: arr[1], width: framework_utils.parseInt(size[0]), height: framework_utils.parseInt(size[1]) };
		callback(null, obj);
	});

	return self;
};

Image.prototype.$$identify = function() {
	var self = this;
	return function(callback) {
		self.identify(callback);
	};
};

Image.prototype.push = function(key, value, priority, encode) {
	var self = this;
	var cmd = key;

	if (value != null) {
		if (encode && typeof(value) === 'string')
			cmd += ' ' + D + value.replace(REGEXP_ESCAPE, '') + D;
		else
			cmd += ' ' + value;
	}

	var obj = CACHE[cmd];
	if (obj) {
		obj.priority = priority;
		self.builder.push(obj);
	} else {
		CACHE[cmd] = { cmd: cmd, priority: priority };
		self.builder.push(CACHE[cmd]);
	}

	return self;
};

Image.prototype.output = function(type) {
	var self = this;
	if (type[0] === '.')
		type = type.substring(1);
	self.outputType = type;
	return self;
};

Image.prototype.resize = function(w, h, options) {
	options = options || '';

	var self = this;
	var size = '';

	if (w && h)
		size = w + 'x' + h;
	else if (w && !h)
		size = w + 'x';
	else if (!w && h)
		size = 'x' + h;

	return self.push('-resize', size + options, 1, true);
};

Image.prototype.thumbnail = function(w, h, options) {
	options = options || '';

	var self = this;
	var size = '';

	if (w && h)
		size = w + 'x' + h;
	else if (w && !h)
		size = w;
	else if (!w && h)
		size = 'x' + h;

	return self.push('-thumbnail', size + options, 1, true);
};

Image.prototype.geometry = function(w, h, options) {
	options = options || '';

	var self = this;
	var size = '';

	if (w && h)
		size = w + 'x' + h;
	else if (w && !h)
		size = w;
	else if (!w && h)
		size = 'x' + h;

	return self.push('-geometry', size + options, 1, true);
};


Image.prototype.filter = function(type) {
	return this.push('-filter', type, 1, true);
};

Image.prototype.trim = function() {
	return this.push('-trim +repage', 1);
};

Image.prototype.limit = function(type, value) {
	this.islimit = true;
	return this.push('-limit', type + ' ' + value, 1);
};

Image.prototype.extent = function(w, h) {

	var self = this;
	var size = '';

	if (w && h)
		size = w + 'x' + h;
	else if (w && !h)
		size = w;
	else if (!w && h)
		size = 'x' + h;

	return self.push('-extent', size, 4, true);
};

/**
 * Resize picture to miniature (full picture)
 * @param {Number} w
 * @param {Number} h
 * @param {String} color Optional, background color.
 * @param {String} filter Optional, resize filter (default: Box)
 * @return {Image}
 */
Image.prototype.miniature = function(w, h, color, filter) {
	return this.filter(filter || 'Hamming').thumbnail(w, h).background(color ? color : 'white').align('center').extent(w, h);
};

/**
 * Resize picture to center
 * @param {Number} w
 * @param {Number} h
 * @param {String} color Optional, background color.
 * @return {Image}
 */
Image.prototype.resizeCenter = function(w, h, color) {
	return this.resize(w, h, '^').background(color ? color : 'white').align('center').crop(w, h);
};

/**
 * Resize picture to align
 * @param {Number} w
 * @param {Number} h
 * @param {String} align (top, center, bottom)
 * @param {String} color Optional, background color.
 * @return {Image}
 */
Image.prototype.resizeAlign = function(w, h, align, color) {
	return this.resize(w, h, '^').background(color ? color : 'white').align(align || 'center').crop(w, h);
};

Image.prototype.scale = function(w, h, options) {
	options = options || '';

	var self = this;
	var size = '';

	if (w && h)
		size = w + 'x' + h;
	else if (w && !h)
		size = w;
	else if (!w && h)
		size = 'x' + h;

	return self.push('-scale', size + options, 1, true);
};

Image.prototype.crop = function(w, h, x, y) {
	return this.push('-crop', w + 'x' + h + '+' + (x || 0) + '+' + (y || 0), 4, true);
};

Image.prototype.quality = function(percentage) {
	return this.push('-quality', percentage || 80, 5, true);
};

Image.prototype.align = function(type) {

	var output;

	switch (type) {
		case 'left top':
		case 'top left':
			output = 'NorthWest';
			break;
		case 'left bottom':
		case 'bottom left':
			output = 'SouthWest';
			break;
		case 'right top':
		case 'top right':
			output = 'NorthEast';
			break;
		case 'right bottom':
		case 'bottom right':
			output = 'SouthEast';
			break;
		case 'left center':
		case 'center left':
		case 'left':
			output = 'West';
			break;
		case 'right center':
		case 'center right':
		case 'right':
			output = 'East';
			break;
		case 'bottom center':
		case 'center bottom':
		case 'bottom':
			output = 'South';
			break;
		case 'top center':
		case 'center top':
		case 'top':
			output = 'North';
			break;
		case 'center center':
		case 'center':
		case 'middle':
			output = 'Center';
			break;
		default:
			output = type;
			break;
	}

	output && this.push('-gravity', output, 3, true);
	return this;
};

Image.prototype.gravity = function(type) {
	return this.align(type);
};

Image.prototype.blur = function(radius) {
	return this.push('-blur', radius, 10, true);
};

Image.prototype.normalize = function() {
	return this.push('-normalize', null, 10);
};

Image.prototype.rotate = function(deg) {
	return this.push('-rotate', deg || 0, 8, true);
};

Image.prototype.flip = function() {
	return this.push('-flip', null, 10);
};

Image.prototype.flop = function() {
	return this.push('-flop', null, 10);
};

Image.prototype.minify = function() {
	return this.push('+profile', '*', null, 10, true);
};

Image.prototype.grayscale = function() {
	return this.push('-colorspace', 'Gray', 10, true);
};

Image.prototype.bitdepth = function(value) {
	return this.push('-depth', value, 10, true);
};

Image.prototype.colors = function(value) {
	return this.push('-colors', value, 10, true);
};

Image.prototype.background = function(color) {
	return this.push('-background', color, 2, true).push('-extent 0x0', null, 2);
};

Image.prototype.fill = function(color) {
	return this.push('-fill', color, 2, true);
};

Image.prototype.sepia = function() {
	return this.push('-modulate', '115,0,100', 4).push('-colorize', '7,21,50', 5);
};

Image.prototype.watermark = function(filename, x, y, w, h) {
	return this.push('-draw', 'image over {1},{2} {3},{4} {5}{0}{5}'.format(filename, x || 0, y || 0, w || 0, h || 0, D), 6, true);
};

Image.prototype.make = function(fn) {
	fn.call(this, this);
	return this;
};

Image.prototype.command = function(key, value, priority, esc) {

	if (priority === true) {
		priority = 0;
		esc = true;
	}

	return this.push(key, value, priority || 10, esc);
};

function wrap(command, empty) {
	return (empty ? ' ' : '') + (command === '-' ? command : (D + command.replace(REGEXP_ESCAPE, '') + D));
}

exports.Image = Image;
exports.Picture = Image;

exports.init = function(filename, imageMagick, width, height) {
	return new Image(filename, imageMagick, width, height);
};

exports.load = function(filename, imageMagick, width, height) {
	return new Image(filename, imageMagick, width, height);
};

exports.middleware = function(type, fn) {
	if (type[0] === '.')
		type = type.substring(1);
	middlewares[type] = fn;
};

exports.restart = function() {
	middlewares = {};
};

// Clears cache with commands
exports.clear = function() {
	CACHE = {};
};

global.Image = exports;
