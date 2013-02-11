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

var urlParser = require('url');
var http = require('http');
var https = require('https');

/*
	MongoDB class
	@database {String}
	@key {String} :: get your key from https://mongolab.com/user?username=[username]
*/
function MongoDB(database, key) {
	this.key = key;
	this.database = database;
	this.uri = urlParser.parse('https://api.mongolab.com/api/1/databases/');
};

// ======================================================
// FUNCTIONS
// ======================================================

/*
	Check if string is JSON object
	@value {String}
	return {Object}
*/
function parseJSON(value) {
	if (value.isJSON())
		return JSON.parse(value);
	return {};
};

/*
	Object to URL params
	@obj {Object}
	return {String}
*/
function toParams(obj, key) {

	if (typeof(obj) === 'undefined' || obj === null)
		return '?apiKey=' + key;

	var buffer = [];
	var arr = Object.keys(obj);
	
	arr.forEach(function(o) {

		var value = obj[o];
		var name = o.toLowerCase().replace(/-/g, '');

		switch (name) {
			case 'q':
			case 'query':
			case 'where':
				buffer.push('q=' + encodeURIComponent(JSON.stringify(value)));
				break;		

			case 'include':

				if (typeof(value) === 'array') {
					var prepare = {};
					value.forEach(function(o) {
						prepare[o] = 1;
					});
					value = prepare;
				}

				buffer.push('f=' + encodeURIComponent(JSON.stringify(value)));
				break;

			case 'exclude':

				if (typeof(value) === 'array') {
					var prepare = {};
					value.forEach(function(o) {
						prepare[o] = 0;
					});
					value = prepare;
				}

				buffer.push('f=' + encodeURIComponent(JSON.stringify(value)));
				break;

			case 'f':
				buffer.push('f=' + encodeURIComponent(JSON.stringify(value)));
				break;

			case 'l':
			case 'max':
			case 'top':
			case 'limit':
				buffer.push('l=' + value);
				break;

			case 'skip':
			case 'sk':
				buffer.push('sk=' + value);
				break;

			case 'asc':

				if (typeof(value) === 'array') {
					var prepare = {};
					value.forEach(function(o) {
						prepare[o] = 1;
					});
					value = prepare;
				}

				buffer.push('s=' + encodeURIComponent(JSON.stringify(value)));
				break;

			case 'desc':

				if (typeof(value) === 'array') {
					var prepare = {};
					value.forEach(function(o) {
						prepare[o] = -1;
					});
					value = prepare;
				}

				buffer.push('s=' + encodeURIComponent(JSON.stringify(value)));
				break;

			case 's':
			case 'sort':
			case 'sorting':
				buffer.push('s=' + encodeURIComponent(JSON.stringify(value)));
				break;

			case 'c':
			case 'count':
				buffer.push('c=' + value.toString().toLowerCase());
				break;

			case 'fo':
			case 'first':
				buffer.push('fo=' + value.toString().toLowerCase());
				break;

			case 'm':
			case 'updateall':
			case 'all':
				buffer.push('m=' + value.toString().toLowerCase());
				break;

			case 'u':
			case 'upsert':
				buffer.push('u=' + value.toString().toLowerCase());
				break;

			default:
				break;
		};
	});

	var params = buffer.join('&');
	return '?' + (params.length > 0 ? params + '&' : '') + 'apiKey=' + key;
};

// ======================================================
// PROTOTYPES
// ======================================================

/*
	Internal function
	@path {String}
	@method {String}
	@data {String or Object or Array}
	@params {Object}
	@callback {Function} :: function(error, object)
	return {self}
*/
MongoDB.prototype.connect = function(path, method, data, params, callback) {

	var self = this;

	if (path[0] === '/')
		path = path.substring(1);

	var uri = self.uri;
	var type = typeof(data);
	var isObject = type === 'object' || type === 'array';

	var headers = {};

	headers['Content-Type'] = isObject ? 'application/json' : 'text/plain';

	var location = '';

	if (path[0] === '#')
		location = path.substring(1);
	else
		location = uri.pathname + path;

	var options = { protocol: uri.protocol, auth: uri.auth, method: method || 'GET', hostname: uri.hostname, port: uri.port, path: location + toParams(params, self.key), agent:false, headers: headers };

	var response = function (res) {
		var buffer = '';

		res.on('data', function(chunk) {
			buffer += chunk.toString('utf8');
		})

		req.setTimeout(exports.timeout, function() {
			callback(new Error('timeout'), null);
		});

		res.on('end', function() {
			var data = parseJSON(buffer.trim());
			var error = null;

			if (res.statusCode > 200) {				
				error = new Error(res.statusCode + ' (' + (data.message || '') + ') ');
				data = null;
			}

			callback(error, data);
		});
	};

	var con = options.protocol === 'https:' ? https : http;
	var req = callback ? con.request(options, response) : con.request(options);

	req.on('error', function(err) {
		callback(err, null);
	});

	if (isObject)
		req.end(JSON.stringify(data));
	else
		req.end();

	return self;
};

/*
	MongoDB command
	@cb {Function} :: function(error, object)
	return {MongoDB}
*/
MongoDB.prototype.list = function(cb) {
	var self = this;
	return self.connect(self.database + '/collections/', 'GET', null, null, cb);
};

/*
	MongoDB command
	@collection {String}
	@params {Object}
	@cb {Function} :: function(error, object)
	return {MongoDB}
*/
MongoDB.prototype.documents = function(collection, params, cb) {
	var self = this;
	return self.connect(self.database + '/collections/' + collection + '/', 'GET', null, params, cb);
};

/*
	MongoDB command
	@cb {Function} :: function(error, object)
	return {MongoDB}
*/
MongoDB.prototype.all = function(cb) {
	return this.connect('', 'GET', null, null, cb);
};

/*
	MongoDB command
	@collection {String}
	@documents {Object or Object array}
	@cb {Function} :: function(error, object)
	return {MongoDB}
*/
MongoDB.prototype.insert = function(collection, documents, cb) {
	var self = this;
	return self.connect(self.database + '/collections/' + collection + '/', 'POST', documents, null, cb);
};

/*
	MongoDB command
	@collection {String}
	@condition {Object or Object array}
	@params {Object}
	@cb {Function} :: function(error, object)
	return {MongoDB}
*/
MongoDB.prototype.update = function(collection, condition, params, cb) {
	var self = this;
	return self.connect(self.database + '/collections/' + collection + '/', 'PUT', condition, params, cb);
};

/*
	MongoDB command
	@collection {String}
	@id {String or Number}
	@cb {Function} :: function(error, object)
	return {MongoDB}
*/
MongoDB.prototype.findId = function(collection, id, cb) {
	var self = this;
	return self.connect(self.database + '/collections/' + collection + '/' + id + '/', 'GET', null, null, cb);
};

/*
	MongoDB command
	@collection {String}
	@id {String or Number}
	@cb {Function} :: function(error, object)
	return {MongoDB}
*/
MongoDB.prototype.updateId = function(collection, id, document, cb) {
	var self = this;
	return self.connect(self.database + '/collections/' + collection + '/' + id + '/', 'PUT', document, null, cb);
};

/*
	MongoDB command
	@collection {String}
	@id {String or Number}
	@cb {Function} :: function(error, object)
	return {MongoDB}
*/
MongoDB.prototype.deleteId = function(collection, id, cb) {
	var self = this;
	return self.connect(self.database + '/collections/' + collection + '/' + id + '/', 'DELETE', null, null, cb);
};

/*
	MongoDB command
	@command {Object}
	@cb {Function} :: function(error, object)
	return {MongoDB}
*/
MongoDB.prototype.command = function(command, cb) {
	var self = this;
	return self.connect(self.database + '/runCommand/', 'POST', command, null, cb);
};

// ======================================================
// EXPORTS
// ======================================================

exports.timeout = 10000;
exports.MongoDB = MongoDB;

/*
	MongoDB class
	@connectionString {String} :: url address
*/
exports.init = function(connectionString, key) {
	return new MongoDB(connectionString, key);
};
