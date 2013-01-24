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

var utils = require('./utils'),
	fs = require('fs'),
	multipart = require('./multipart');

// parsovanie parametrov z metódy POST
exports.parsePOST = function(req, maximumSize) {
	req.setEncoding('utf8');
	
	req.buffer.isData = true;
	req.buffer.isExceeded = false;

	req.on('data', function(chunk) {
		
		if (req.buffer.isExceeded)
			return;

		if (!req.buffer.isExceeded)
			req.buffer.data += chunk.toString();

		if (req.buffer.data.length >= maximumSize) {
			req.buffer.isExceeded = true;
			req.buffer.data = '';
		}
	});
};

exports.parseMULTIPART = function(req, contentType, maximumSize, tmpDirectory, callback) {
  	
  	var parser = new multipart.MultipartParser();
  	var boundary = contentType.split(';')[1];
  	var isFile = false;
  	var size = 0;
  	var stream = null;
  	var tmp = { name: '', value: '', contentType: '', fileName: '', fileNameTmp: '', fileSize: 0, isFile: false, step: 0 };
	var ip = req.ip.replace(/\./g, '');

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
    	
    	if (req.buffer.isExceeded)
    		return;

    	var arr = buffer.slice(start, end).toString('utf8').split(';');

    	if (tmp.step === 0) {
	    	
	    	tmp.name = arr[1].substring(arr[1].indexOf('=') + 2);
    		tmp.name = tmp.name.substring(0, tmp.name.length - 1);

    		if (arr.length === 3) {
	    		tmp.fileName = arr[2].substring(arr[2].indexOf('=') + 2);
    			tmp.fileName = tmp.fileName.substring(0, tmp.fileName.length - 1);
    			tmp.isFile = true;
    			tmp.fileNameTmp = utils.combine(tmpDirectory, ip + '-' + new Date().getTime() + '-' + utils.random(100000) + '.upload');
    			stream = fs.createWriteStream(tmp.fileNameTmp, { flags: 'w' });
    		}

    		tmp.step = 1;
    		return;
    	}

    	if (tmp.step === 1) {
    		tmp.contentType = arr[0];
    		tmp.step = 2;    		
    		return;
    	}
    };
    
    parser.onPartData = function(buffer, start, end) {

		if (req.buffer.isExceeded)
			return;

		var data = buffer.slice(start, end);
		var length = data.length;

		size += length;

		if (tmp.isFile) {
			stream.write(data);
			tmp.fileSize += length;
		}
		else
			tmp.value += data.toString('utf8');

		if (size >= maximumSize) {
			req.buffer.isExceeded = true;
			return;
		}

    };
    
    parser.onPartEnd = function() {
		
		if (stream !== null) {
			stream.end();
			stream.destroy();
			stream = null;
		}

    	if (req.buffer.isExceeded)
    		return;

		if (tmp.isFile)
			req.data.files.push(new HttpFile(tmp.name, tmp.fileName, tmp.fileNameTmp, tmp.fileSize, tmp.contentType));
		else
			req.data.post[tmp.name] = tmp.value;
    };

    parser.onEnd = function() {   				
		callback();
    };
	
    req.on('data', function(chunk) {
    	parser.write(chunk);
    });
};

exports.routeSplit = function(url) {

	url = url.toLowerCase();

	if (url[0] === "/")
		url = url.substring(1);

	if (url[url.length - 1] === "/")
		url = url.substring(0, url.length - 1);

	var arr = url.split("/");
	if (arr.length === 1 && arr[0] === "")
		arr[0] = "/";

	return arr;
};

exports.routeCompare = function (route, url, isSystem) {
	
	if (url.length !== route.length)
		return false;

	for (var i = 0; i < route.length; i++) {

		var value = url[i];

		if (!isSystem && value[0] === "{")
			continue;

		if (route[i] !== value)
			return false;
	}

	return true;
};

exports.routeCompareSubdomain = function(subdomain, arr) {

	if (arr === null || subdomain === null || arr.length === 0)
		return true;

	return arr.indexOf(subdomain) > -1;
};

exports.routeCompareFlags = function (arr1, arr2, noLoggedUnlogged) {
	for (var i = 0; i < arr2.length; i++) {
		var value = arr2[i];

		if (value === 'json')
			value = 'post';

		if (noLoggedUnlogged) {
			if (value === 'logged' || value === 'unlogged')
				continue;
		}

		if (arr1.indexOf(value) === -1)
			return value === "logged" || value === "unlogged" ? -1 : 0;
	}
	return 1;
};

exports.routeParam = function(routeUrl, route) {
	var arr = [];
	if (route === null)
		return arr;
	if (route.param.length > 0) {
		route.param.forEach(function(o) {
			var value = routeUrl[o];
			arr.push(value === '/' ? '' : value);
		});
	}
	return arr;
};

// mazanie dočasných uploadnutých súborov
exports.multipartClear = function(req) {
	req.data.files.forEach(function(o) {
		if (fs.existsSync(o.fileNameTmp))
			fs.unlink(o.fileNameTmp);
	});	
};

function HttpFile(name, fileName, fileNameTmp, fileSize, contentType) {
	this.name = name;
	this.fileName = fileName;
	this.fileSize = fileSize;
	this.contentType = contentType;
	this.fileNameTmp = fileNameTmp;
};

HttpFile.prototype.copy = function(fileName) {
	var self = this;
	fs.createReadStream(self.fileNameTmp).pipe(fs.createWriteStream(fileName));
	return self;
};

HttpFile.prototype.readSync = function() {
	return fs.readFileSync(this.fileNameTmp);
};

HttpFile.prototype.read = function(callback) {
	var self = this;
	fs.readFile(self.fileNameTmp, callback);
	return self;
};