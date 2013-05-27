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

'use strict';

var utils = require('./utils');
var fs = require('fs');
var image = require('./image');
var multipart = require('./multipart');
var encoding = 'utf8';

if (typeof(setImmediate) === 'undefined') {
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
	return {String array}
*/
exports.parseMULTIPART = function(req, contentType, maximumSize, tmpDirectory, onXSS, callback) {

  	var parser = new multipart.MultipartParser();
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

    	var arr = buffer.slice(start, end).toString(encoding).split(';');

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
			tmp.value += data.toString(encoding);
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

		var cb = function cb () {

			if (close <= 0) {

				parser.dispose();
				parser = null;
				boundary = null;
				stream = null;
				tmp = null;
				ip = null;

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
	Internal function / Split string (url) to array
	@url {String}
	return {String array}
*/
exports.routeSplit = function(url) {

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
		//console.log(index, value);

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

	if (route.param.length === 0)
		return arr;

	route.param.forEach(function(o) {
		var value = routeUrl[o];
		arr.push(value === '/' ? '' : value);
	});

	return arr;
};

/*
	Clear all uploaded files :: Internal function
	@req {ServerRequest}
	return {ServerRequest}
*/
exports.multipartClear = function(req) {
	req.data.files.forEach(function(o) {
		if (fs.existsSync(o.fileNameTmp))
			fs.unlink(o.fileNameTmp);
	});
	return req;
};

/*
	HttpFile class
	@name {String}
	@fileName {String}
	@fileNameTmp {String}
	@fileSize {Number}
	@contentType {String}
	return {HttpFile}
*/
function HttpFile(name, fileName, fileNameTmp, fileSize, contentType) {
	this.name = name;
	this.fileName = fileName;
	this.fileSize = fileSize;
	this.contentType = contentType;
	this.fileNameTmp = fileNameTmp;
};

/*
	Read file to byte array
	@fileName {String} :: new filename
	return {HttpFile}
*/
HttpFile.prototype.copy = function(fileName) {
	var self = this;
	fs.createReadStream(self.fileNameTmp).pipe(fs.createWriteStream(fileName));
	return self;
};

/*
	Read file to buffer (SYNC)
	return {Buffer}
*/
HttpFile.prototype.readSync = function() {
	return fs.readFileSync(this.fileNameTmp);
};

/*
	Read file to buffer (ASYNC)
	@callback {Function} :: function(error, data);
	return {HttpFile}
*/
HttpFile.prototype.read = function(callback) {
	var self = this;
	fs.readFile(self.fileNameTmp, callback);
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
	return image.init(this.fileNameTmp, imageMagick);
};