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

var utils = require('./utils');
var fs = require('fs');

// parsovanie parametrov z metódy POST
exports.parsePOST = function(req, maximumSize) {
	req.setEncoding('utf8');
	req.buffer = { data: '', isUpload: false, isExceeded: false };
	req.on('data', function(chunk) {
		if (!req.buffer.isExceeded)
			req.buffer.data += chunk.toString();

		if (req.buffer.data.length >= maximumSize) {	
			req.buffer.isExceeded = true;
			req.buffer.data = '';
		}
	});
};

// uloženie celého Request stream do súboru
exports.uploadWrite = function(req, contentType, maximumSize, tmpDirectory) {
	var boundary = contentType.split(';')[1];
	var id = '.' + tmpDirectory + new Date().getTime() + '-' + Math.floor(Math.random() * 1000000);
	var fileTMP = id + '.upload';	
	req.buffer = { data: fileTMP, isUpload: true, isExceeded: false, size: 0, boundary: boundary, id: id, stream: fs.createWriteStream(fileTMP, { flags: 'w' }) };
	req.on('data', function(chunk) {
		req.buffer.size += chunk.length;
		
		if (!req.buffer.isExceeded)
			req.buffer.stream.write(chunk);

		if (req.buffer.size > maximumSize)
			req.buffer.isExceeded = true;
	});
};

// vyparsovanie uploadnutých súborov zo súboru
// pomalé :-(
exports.uploadParse = function(req, cb) {

	if (!req.buffer.isExceeded) {
		req.buffer.stream.on('close', function() {
			uploadExtract(req, cb);
		});
	}

	// zatvárame stream
	req.buffer.stream.end();
	req.buffer.stream.destroy();

	if (req.buffer.isExceeded) {
		req.connection.destroy();
		return;
	}
};

// async
// pomalé
function uploadExtract(req, cb) {

	var boundary = req.buffer.boundary.substring(10);
	fs.readFile(req.buffer.data, function(err, data) {
		
		var name = "";
		var isFile = false;
		var index = 0;	
		var formData = {};
		var formFiles = [];
		var buffer = new Buffer(data);
		var length = buffer.length;	
		var indexFrom = 0;
		var indexer = 0;
		
		function onEnd() {
			req.formPOST = formData;
			req.formFiles = formFiles;
			cb();
		}

		function onStep(buffer, index, indexFrom) {

			if (index + boundary.length > length) {
				onEnd();
				return;
			}

			var value = buffer.slice(index, index + boundary.length).toString();

			if (value === boundary)
			{
				if (index > 0)
				{
					var size = index - indexFrom;					
					if (isFile) {

						var obj = formFiles[formFiles.length - 1];
						obj.fileSize = size;
						obj.tmp = req.buffer.id + '_' + (indexer++) + '.file';
						
						var buf = buffer.slice(indexFrom, index - 4);					
						var stream = fs.createWriteStream(obj.tmp, { flags: 'w' });
						stream.end(buf, 'binary');
						stream.destroy();

					} else {

						if (name.length > 0)
							formData[name] = buffer.slice(indexFrom, index - 4).toString();

					}				
				}

				index = index + boundary.length;

				var indexFrom = findFrom(index, buffer);
				if (indexFrom === 0) {
					onEnd();
					return;
				}

				var header = headerParse(buffer.slice(index, indexFrom).toString());
				if (header.fileName && header.fileName.length > 0) {
					
					var obj = {
						name: header.name,
						fileName: header.fileName,
						fileSize: 0,
						contentType: header.contentType,
						tmp: "",
						
						read: function() {
							return fs.readFileSync(this.tmp);
						},

						copy: function(path) {
							fs.createReadStream(this.tmp).pipe(fs.createWriteStream(path));
						}
					};

					formFiles.push(obj);
					isFile = true;

				} else {

					name = header.name;
					isFile = false;

				}
			}

			index++;
			if (index < buffer.length)
				process.nextTick(function() { onStep(buffer, index, indexFrom); });
			else
				onEnd();
		};

		onStep(buffer, index);
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

exports.routeCompare = function (route, url) {
	for (var i = 0; i < route.length; i++) {
		
		if (url.length !== route.length)
			return false;

		var value = url[i];
		
		if (value[0] === "{")
			continue;

		if (route[i] !== value)
			return false;
	}
	return true;
};

exports.routeCompareFlags = function (arr1, arr2) {
	for (var i = 0; i < arr2.length; i++) {
		var value = arr2[i];

		if (value === 'json')
			value = 'post';

		if (arr1.indexOf(value) === -1)
			return value === "logged" || value === "unlogged" ? -1 : 0;
	}
	return 1;
};

exports.routeParam = function(routeUrl, route) {
	var arr = [];
	if (route == null)
		return arr;
	if (route.param.length > 0) {
		route.param.forEach(function(o) {
			arr.push(routeUrl[o]);
		});
	}
	return arr;
};

// mazanie dočasných uploadnutých súborov
exports.uploadClear = function(req) {

	req.formFiles.forEach(function(o) {
		if (fs.existsSync(o.tmp))
			fs.unlink(o.tmp);
	});	

	if (req.buffer) {
		var tmp = req.buffer.id + '.upload';

		if (fs.existsSync(tmp))
			fs.unlink(tmp);
	}
};

function findFrom(index, buffer) {
	var count = 0;
	var old = 0;
	for (var i = index; i < buffer.length; i++) {
		var c = buffer[i];

		if (buffer[i] == 13 && buffer[i - 2] == 13)
			return i + 2;
	}
	return 0;
};

function headerParse(str) {
	var arr = str.replace(/\r/g, '').replace(/\n/g, ';').split(';');

	var name = arr[2].substring(7);
	name = name.substring(0, name.length - 1);

	var fileName = "";
	var contentType = "";

	if (str.indexOf("filename") != -1)
	{
		fileName = arr[3].substring(11)
		fileName = fileName.substring(0, fileName.length - 1);
		contentType = arr[4].substring(14);
	}

	return { name: name, fileName: fileName, contentType: contentType };
};