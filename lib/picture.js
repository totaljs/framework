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

var exec = require('child_process').exec;

/*
	Picture class
	@fileName {String}
	@imageMagick {Boolean} :: default false
*/
function Picture(fileName, imageMagick) {
	this.builder = [];
	this.fileName = fileName;
	this.isIM = imageMagick || false;

	if (!fileName)
		throw new Error('Picture filename is undefined.');
};

/*
	Clear all filter
	return {Picture}
*/
Picture.prototype.clear = function clear() {
	var self = this;
	self.builder = [];
	return self;
};

/*
	Execute all filters and save picture
	@fileName {String}
	@callback {Function} :: optional
	return {Picture}
*/
Picture.prototype.save = function save(fileName, callback) {

	var self = this;

	if (typeof(fileName) === 'function') {
		callback = fileName;
		fileName = null;
	}

	fileName = fileName || self.fileName;

	var command = self.cmd(self.fileName, fileName);
	if (self.builder.length > 0) {
		exec(command, function(error, stdout, stderr) {
			self.clear();
			if (callback) {
				if (error)
					callback(error, '');
				else
					callback(null, fileName);
			};
		 });
	} else {
		if (callback)
			callback(null, fileName);
	}
	return self;
};

/*
	Internal function
	@fileNameFrom {String}
	@fileNameTo {String}
	return {String}
*/
Picture.prototype.cmd = function cmd(fileNameFrom, fileNameTo) {

	var self = this;
	var cmd = '';

	self.builder.sort(function(a, b) {
		if (a.priority > b.priority)
			return 1;
		else
			return -1;
	});

	self.builder.forEach(function(o) {
		cmd += (cmd.length > 0 ? ' ' : '') + o.cmd;
	});

	return (self.isIM ? 'convert' : 'gm -convert') + ' "' + fileNameFrom + '"' + ' ' + cmd + ' "' + fileNameTo + '"';
};

/*
	Append filter to filter list
	@key {String}
	@value {String}
	@priority {Number}
	return {Picture}
*/
Picture.prototype.push = function push(key, value, priority) {
	var self = this;
	self.builder.push({ cmd: key + (value ? ' "' + value + '"' : ''), priority: priority });
	return self;
};

/*
	@w {Number}
	@h {Number}
	@options {String}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-resize
*/
Picture.prototype.resize = function resize(w, h, options) {
	options = options || '';

	var self = this;
	var size = '';

	if (w && h)
		size = w + 'x' + h;
    else if (w && !h)
      size = w 
    else if (!w && h)
      size = 'x' + h;

  	return self.push('-resize', size + options, 1);
};

/*
	@w {Number}
	@h {Number}
*/
Picture.prototype.resizeCenter = function resizeCenter(w, h) {
	return this.resize(w, h, '^').align('center').crop(w, h);
};

/*
	@w {Number}
	@h {Number}
	@options {String}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-scale
*/
Picture.prototype.scale = function scale(w, h, options) {
	options = options || '';

	var self = this;
	var size = '';

	if (w && h)
		size = w + 'x' + h;
    else if (w && !h)
      size = w 
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
Picture.prototype.crop = function crop(w, h, x, y) {
	return this.push('-crop', w + 'x' + h + '+' + (x || 0) + '+' + (y || 0), 4);
};

/*
	@percentage {Number}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-quality
*/
Picture.prototype.quality = function quality(percentage) {
    return this.push('-quality', percentage || 80, 5);
};

/*
	@type {String}
*/
Picture.prototype.align = function align(type) {

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
			output = 'SouthEast'
			break;
		case 'left center':
		case 'center left':
		case 'left':
			output = 'West'
			break;
		case 'right center':
		case 'center right':
		case 'right':
			output = 'East'
			break;
		case 'bottom center':
		case 'center bottom':
		case 'bottom':
			output = 'South'
			break;
		case 'top center':
		case 'center top':
		case 'top':
			output = 'North'
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
Picture.prototype.gravity = function gravity(type) {
	return this.align(type);
};

/*
	@radius {Number}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-blur
*/
Picture.prototype.blur = function blur(radius) {
    return this.push('-blur', radius, 10);
};

Picture.prototype.normalize = function normalize () {
	return this.push('-normalize', null, 10);
};

/*
	@deg {Number}
	http://www.graphicsmagick.org/GraphicsMagick.html#details-rotate
*/
Picture.prototype.rotate = function rotate(deg) {
	return this.push('-rotate', deg || 0, 8);
};

// http://www.graphicsmagick.org/GraphicsMagick.html#details-flip
Picture.prototype.flip = function flip() {
	return this.push('-flip', null, 10);
};

// http://www.graphicsmagick.org/GraphicsMagick.html#details-flop
Picture.prototype.flop = function flop() {
	return this.push('-flop', null, 10);
};

// http://www.graphicsmagick.org/GraphicsMagick.html
Picture.prototype.minify = function minify() {
	return this.push('-minify', null, 10);
};

Picture.prototype.grayscale = function grayscale() {
	return this.push('-modulate 100,0', null, 10);
};

/*
	@color {String}
*/
Picture.prototype.background = function background(color) {
	return this.push('-background', color, 2);
};

Picture.prototype.sepia = function sepia() {
	return this.push('-modulate 115,0,100 \ -colorize 7,21,50', null, 10);
};

/*
	@cmd {String}
	@priority {Number}
*/
Picture.prototype.command = function command(cmd, priority) {
	return this.push(cmd, null, priority || 10);
};

exports.Picture = Picture;

/*
	Init picture class
	@fileName {String}
	@imageMagick {Boolean} :: default false
*/
exports.init = function init(fileName, imageMagick) {
	return new Picture(fileName, imageMagick);
};