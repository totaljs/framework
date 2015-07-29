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
 * @module FrameworkImage
 * @version 1.9.0
 */

'use strict';

var child = require('child_process');
var exec = child.exec;
var spawn = child.spawn;
var path = require('path');
var sof = { 0xc0: true, 0xc1: true, 0xc2: true, 0xc3: true, 0xc5: true, 0xc6: true, 0xc7: true, 0xc9: true, 0xca: true, 0xcb: true, 0xcd: true, 0xce: true, 0xcf: true };

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

		return {
			width: w,
			height: h
		};
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

	var match = buffer.toString('utf8').match(/(width=\"\d+\")+|(height=\"\d+\")+/g);
	if (!match)
		return;

	var width = 0;
	var height = 0;

	for (var i = 0, length = match.length; i < length; i++) {
		var value = match[i];

		if (width > 0 && height > 0)
			break;

		if (width === 0) {
			if (value.startsWith('width="')) {
				width = parseInt(value.match(/\d+/g));
				if (isNaN(width))
					width = 0;
			}
		}

		if (height === 0) {
			if (value.startsWith('height="')) {
				height = parseInt(value.match(/\d+/g));
				if (isNaN(height))
					height = 0;
			}
		}
	}

	return { width: width, height: height };
};

/*
	Image class
	@filename {String}
	@useImageMagick {Boolean} :: default false
*/
function Image(filename, useImageMagick, width, height) {

	var type = typeof(filename);

	this.width = width;
	this.height = height;
	this.builder = [];
	this.filename = type === 'string' ? filename : null;
	this.currentStream = type === 'object' ? filename : null;
	this.isIM = useImageMagick === undefined || useImageMagick === null ? F.config['default-image-converter'] === 'im' : useImageMagick;
	this.outputType = type === 'string' ? path.extname(filename).substring(1) : 'jpg';
/*
	if (!filename)
		throw new Error('Image filename is undefined.');
*/
}

/*
	Clear all filter
	return {Image}
*/
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
	var stream = require('fs').createReadStream(self.filename, {
		start: 0,
		end: extension === '.jpg' ? 40000 : 24
	});

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

	filename = filename || self.filename || '';

	var command = self.cmd(self.filename === null ? '-' : self.filename, filename);

	if (self.builder.length === 0) {
		if (!callback)
			return;
		setImmediate(function() {
			callback(null, true);
		});
		return;
	}

	var cmd = exec(command, function(error, stdout, stderr) {

		FINISHED(stdout, function() {
			DESTROY(stdout);
		});

 		// clean up
		cmd.kill();
		cmd = null;

		self.clear();
		if (!callback)
			return;

		if (error)
			callback(error, false);
		else
			callback(null, true);
	});

	if (self.currentStream) {
		if (self.currentStream instanceof Buffer)
			cmd.stdin.end(self.currentStream);
		else
			self.currentStream.pipe(cmd.stdin);
	}

	FINISHED(cmd.stdin, function() {
		DESTROY(cmd.stdin);
	});

	if (writer)
		writer(cmd.stdin);

	return self;
};

Image.prototype.$$save = function(filename, writer) {
	var self = this;
	return function(callback) {
		self.save(filename, callback, writer);
	};
};

/*
	Pipe stream
	@stream {Stream}
	@type {String} :: optional, image type (png, jpg, gif)
	@options {Object} :: Stream object
	return {Image}
*/
Image.prototype.pipe = function(stream, type, options) {

	var self = this;

	if (typeof(type) === 'object') {
		options = type;
		type = null;
	}

	if (self.builder.length === 0)
		return;

	if (type === undefined || type === null)
		type = self.outputType;

	var cmd = spawn(self.isIM ? 'convert' : 'gm', self.arg(self.filename === null ? '-' : self.filename, (type ? type + ':' : '') + '-'));

	cmd.stderr.on('data', stream.emit.bind(stream, 'error'));
	cmd.stdout.on('data', stream.emit.bind(stream, 'data'));
	cmd.stdout.on('end', stream.emit.bind(stream, 'end'));
	cmd.on('error', stream.emit.bind(stream, 'error'));
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

	if (self.builder.length === 0)
		return;

	if (type === undefined || type === null)
		type = self.outputType;

	var cmd = spawn(self.isIM ? 'convert' : 'gm', self.arg(self.filename === null ? '-' : self.filename, (type ? type + ':' : '') + '-'));

	if (self.currentStream) {
		if (self.currentStream instanceof Buffer)
			cmd.stdin.end(self.currentStream);
		else
			self.currentStream.pipe(cmd.stdin);
	}

	if (writer)
		writer(cmd.stdin);

	return cmd.stdout;
};

/*
	Internal function
	@filenameFrom {String}
	@filenameTo {String}
	return {String}
*/
Image.prototype.cmd = function(filenameFrom, filenameTo) {

	var self = this;
	var cmd = '';

	self.builder.sort(function(a, b) {
		if (a.priority > b.priority)
			return 1;
		else
			return -1;
	});

	var length = self.builder.length;

	for (var i = 0; i < length; i++)
		cmd += (cmd ? ' ' : '') + self.builder[i].cmd;

	return (self.isIM ? 'convert' : 'gm -convert') + ' "' + filenameFrom + '"' + ' ' + cmd + ' "' + filenameTo + '"';
};

/*
	Internal function
	@filenameFrom {String}
	@filenameTo {String}
	return {String}
*/
Image.prototype.arg = function(first, last) {

	var self = this;
	var arr = [];

	if (!self.isIM)
		arr.push('-convert');

	if (first)
		arr.push(first);

	self.builder.sort(function(a, b) {
		if (a.priority > b.priority)
			return 1;
		else
			return -1;
	});

	var length = self.builder.length;

	for (var i = 0; i < length; i++) {
		var o = self.builder[i];
		var index = o.cmd.indexOf(' ');
		if (index === -1)
			arr.push(o.cmd);
		else {
			arr.push(o.cmd.substring(0, index));
			arr.push(o.cmd.substring(index + 1).replace(/\"/g, ''));
		}
	}

	if (last)
		arr.push(last);

	return arr;
};

/*
	Identify image
	cb {Function} :: function(err, info) {} :: info.type {String} == 'JPEG' | 'PNG', info.width {Number}, info.height {Number}
	return {Image}
*/
Image.prototype.identify = function(cb) {
	var self = this;

	exec((self.isIM ? 'identify' : 'gm identify') + ' "' + self.fileName + '"', function(error, stdout, stderr) {

		if (error) {
			cb(error, null);
			return;
		}

		var arr = stdout.split(' ');
		var size = arr[2].split('x');
		var obj = {
			type: arr[1],
			width: framework_utils.parseInt(size[0]),
			height: framework_utils.parseInt(size[1])
		};

		cb(null, obj);
	});

	return self;
};

Image.prototype.$$identify = function() {
	var self = this;
	return function(callback) {
		self.identify(callback);
	};
};

/*
	Append filter to filter list
	@key {String}
	@value {String}
	@priority {Number}
	return {Image}
*/
Image.prototype.push = function(key, value, priority) {
	var self = this;
	self.builder.push({
		cmd: key + (value ? ' "' + value + '"' : ''),
		priority: priority
	});
	return self;
};

Image.prototype.output = function(type) {
	var self = this;

	if (type[0] === '.')
		type = type.substring(1);

	self.outputType = type;
	return self;
};

/*
	@w {Number}
	@h {Number}
	@options {String}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-resize
*/
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

	return self.push('-resize', size + options, 1);
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

	return self.push('-thumbnail', size + options, 1);
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

	return self.push('-geometry', size + options, 1);
};


Image.prototype.filter = function(type) {
	return this.push('-filter', type, 1);
};

Image.prototype.trim = function() {
	return this.push('-trim +repage', 1);
};

/*
	@w {Number}
	@h {Number}
*/
Image.prototype.extent = function(w, h) {

	var self = this;
	var size = '';

	if (w && h)
		size = w + 'x' + h;
	else if (w && !h)
		size = w;
	else if (!w && h)
		size = 'x' + h;

	return self.push('-extent', size, 4);
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
	return this.filter(filter || 'Box').thumbnail(w, h).background(color ? color : 'white').align('center').extent(w, h);
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

/*
	@w {Number}
	@h {Number}
	@options {String}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-scale
*/
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

	return self.push('-scale', size + options, 1);
};

/*
	@w {Number}
	@h {Number}
	@x {Number}
	@y {Number}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-crop
*/
Image.prototype.crop = function(w, h, x, y) {
	return this.push('-crop', w + 'x' + h + '+' + (x || 0) + '+' + (y || 0), 4);
};

/*
	@percentage {Number}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-quality
*/
Image.prototype.quality = function(percentage) {
	return this.push('-quality', percentage || 80, 5);
};

/*
	@type {String}
*/
Image.prototype.align = function(type) {

	var output = '';

	switch (type.toLowerCase().replace('-', '')) {
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
			output = 'Center';
			break;
		default:
			output = type;
			break;
	}

	return this.push('-gravity', output, 3);
};

/*
	@type {String}
*/
Image.prototype.gravity = function(type) {
	return this.align(type);
};

/*
	@radius {Number}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-blur
*/
Image.prototype.blur = function(radius) {
	return this.push('-blur', radius, 10);
};

Image.prototype.normalize = function() {
	return this.push('-normalize', null, 10);
};

/*
	@deg {Number}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-rotate
*/
Image.prototype.rotate = function(deg) {
	return this.push('-rotate', deg || 0, 8);
};

// http://www.graphicsmagick.org/GraphicsMagick.html#details-flip
Image.prototype.flip = function() {
	return this.push('-flip', null, 10);
};

// http://www.graphicsmagick.org/GraphicsMagick.html#details-flop
Image.prototype.flop = function() {
	return this.push('-flop', null, 10);
};

Image.prototype.minify = function() {
	return this.push('+profile', '*');
};

Image.prototype.grayscale = function() {
	return this.push('-colorspace', 'Gray', 10);
};

Image.prototype.bitdepth = function(value) {
	return this.push('-depth', value, 10);
};

Image.prototype.colors = function(value) {
	return this.push('-colors', value, 10);
};

/*
	@color {String}
*/
Image.prototype.background = function(color) {
	return this.push('-background', color, 2);
};

Image.prototype.fill = function(color) {
	return this.push('-fill', color, 2);
};

Image.prototype.sepia = function(percentage) {
	return this.push('-modulate', '115,0,100', 4).push('-colorize', '7,21,50', 5);
};

/*
	@cmd {String}
	@priority {Number}
*/
Image.prototype.command = function(key, value, priority) {
	return this.push(key, value, priority || 10);
};

exports.Image = Image;
exports.Picture = Image;

/*
	Init image class
	@filename {String}
	@imageMagick {Boolean} :: default false
*/
exports.init = function(filename, imageMagick, width, height) {
	return new Image(filename, imageMagick, width, height);
};

exports.load = function(filename, imageMagick, width, height) {
	return new Image(filename, imageMagick, width, height);
};