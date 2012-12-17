var utils = require('./utils');
var fs = require('fs');
var crypto = require('crypto');

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
exports.saveFiles = function(req, contentType, maximumSize, tmpDirectory) {

	var boundary = contentType.split(';')[1];
	var id = tmpDirectory + new Date().getTime() + '-' + Math.floor(Math.random() * 1000000);
	var fileTMP = id + '.upload';

	req.setEncoding('utf8');
	req.buffer = { data: fileTMP, isUpload: true, isExceeded: false, size: 0, boundary: boundary, id: id, stream: fs.createWriteStream(fileTMP, { flags: 'w' }) };
	req.on('data', function(chunk) {
		req.buffer.size += chunk.length;
		
		if (!req.buffer.isExceeded)
			req.buffer.stream.write(chunk, "binary");

		if (req.buffer.size > maximumSize)
			req.buffer.isExceeded = true;
	});
};

// vyparsovanie uploadnutých súborov zo súboru
// pomalé :-(
exports.parseFiles = function(req, cb) {

	req.buffer.stream.end();

	if (req.buffer.isExceeded) {
		req.connection.destroy();
		return;
	}

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

		do
		{
			if (index + boundary.length > length)
				break;

			var value = buffer.slice(index, index + boundary.length).toString();

			if (value == boundary)
			{
				if (index > 0)
				{
					var size = index - indexFrom;
					if (isFile) {
						var obj = formFiles[formFiles.length - 1];
						obj.fileSize = size;
						obj.tmp = req.buffer.id + '_' + (indexer++) + '.file';
						fs.writeFileSync(obj.tmp, buffer.slice(indexFrom, index - 2));
					} else {
						if (name.length > 0)
							formData[name] = buffer.slice(indexFrom, index - 4).toString();
					}				
				}

				index = index + boundary.length;

				var indexFrom = findFrom(index, buffer);
				if (indexFrom == 0)
					break;

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
		
		} while (index < buffer.length);

		req.formPOST = formData;
		req.formFiles = formFiles;
		cb();
	});
}

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
exports.clearUpload = function(req) {

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

exports.extension = function(name, ext) {
	return name.indexOf(ext) == -1 ? name + ext : name;
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