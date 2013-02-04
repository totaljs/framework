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

var javascript = require('./javascript');
var less = require('./less');
var qs = require('querystring');
var os = require('os');
var fs = require('fs');
var zlib = require('zlib');
var path = require('path');
var urlParser = require('url');
var utils = require('./utils');
var util = require('util');
var events = require('events');
var internal = require('./internal');
var controller = require('./controller');
var subscribe = require('./subscribe');
var encoding = 'utf8';
var directory = process.cwd();
var assert = require('assert');
var _controller = '';

require('./prototypes');

// 1. Framework
// 2. Subscribe
// 3. Controller
// 4. res.end();

function Framework() {
	this.version = 1170;
	this.config = {
		debug: false,
		
		name: 'partial.js',
		secret: os.hostname() + '-' + os.platform() + '-' + os.arch(),

		ETagVersion: '',

		directoryControllers: '/controllers/',
		directoryViews: '/views/',
		directoryTemp: '/tmp/',
		directoryTemplates: '/templates/',
		directoryResources: '/resources/',
		directoryPublic: '/public/',
		directoryModules: '/modules/',
		directoryLogs: '/logs/',
		directoryTests: '/tests',

		// všetky static sú smerované do directoryPublic
		staticUrl: '',
		staticUrlJS: '/js/',
		staticUrlCSS: '/css/',
		staticUrlImage: '/img/',
		staticUrlVideo: '/video/',
		staticUrlFont: '/font/',
		staticUrlDocument: '/upload/',

		staticAccepts: ['.jpg', '.png', '.gif', '.ico', '.js', '.css', '.txt', '.xml', '.woff', '.ttf', '.eot', '.svg', '.zip', '.rar', '.pdf', '.docx', '.xlsx', '.doc', '.xls', '.html', '.htm'],

		// defaultný layout
		defaultLayout: '_layout',

		httpCompress: false,
		httpCache: false,

		// defaultná maximálna veľkosť requestu
		defaultMaxRequestLength: 1024 * 5 // 5 kB
	};

	this.resources = {};

	// routing in controllers
	this.routes = [];
	this.modules = {};
	this.controllers = {};
	this.tests = {};
	this.lastError = null;
	this.server = null;
	this.port = 0;

	// initializácia cache
	this.cache = require('./cache').init(this);

	this.cache.on('service', function(runner) {

		if (self.config.debug) {
			
			// každú minútu čistíme cache resources
			self.resources = {};

		} else {

			// každých 20 minút načítame znova config a resources
			if (runner % 20 === 0) {
				self.resources = {};
				self.configure();
			}

		}

		self.emit('service', runner);
	});

	var self = this;
};

// ======================================================
// PROTOTYPES
// ======================================================

Framework.prototype = new events.EventEmitter;

/*
	Add/Register a new controller
	@name {String}
*/
Framework.prototype.controller = function(name) {

	var self = this;

	// získanie názvu controllera
	_controller = name;

	// inicializovanie controllera
	var obj = require(path.join(directory, self.config.directoryControllers, name + '.js'));
	
	self.controllers[name] = obj;
	obj.init.call(self);

	// triedenie routov
	self.routes.sort(function(a, b) {

		if (a.url.length > b.url.length)
			return -1;

		if (a.flags.length > b.flags.length)
			return -1;

		var ai = a.subdomain === null ? 0 : a.subdomain.length;
		var bi = b.subdomain === null ? 0 : b.subdomain.length;

		if (ai > bi)
			return -1;

		return 1;
	});

	return self;
};

/*
	Stop the server and exit
	return {Framework}
*/
Framework.prototype.stop = function(code) {
	var self = this;
	self.cache.stop();
	self.server.close();
	process.exit(code || 0);
	return self;
};

/*
	Add a new route
	@url {String}
	@funExecute {Function}
	@flags {String array}
	@maximumSize {Number}
	@funcValidation {Function} :: params: {req}, {res}, {flags} return {Boolean};
	return {Framework};
*/
Framework.prototype.route = function(url, funExecute, flags, maximumSize, funcValidation) {

	var self = this;

	if (typeof(funcValidation) === 'number') {
		maximumSize = funcValidation;
		funcValidation = null;
	}

	var index = url.indexOf(']');
	var subdomain = null;
	
	if (index > 0) {
		subdomain = url.substring(1, index).trim().toLowerCase().split(',');
		url = url.substring(index + 1);
	}

	if (flags) {
		for (var i = 0; i < flags.length; i++)
			flags[i] = flags[i].toString().toLowerCase();
	}

	var routeURL = internal.routeSplit(url.trim());
	var arr = [];
	
	if (url.indexOf('{') !== -1) {
		routeURL.forEach(function(o, i) {
			if (o.substring(0, 1) === '{')
				arr.push(i);
		});
	}

	self.routes.push({ subdomain: subdomain, name: _controller, url: routeURL, param: arr, flags: flags || [], onExecute: funExecute, onValidation: funcValidation || null, maximumSize: maximumSize || self.config.defaultMaxRequestLength });
	return self;
};

/*
	Error caller
	@err {Error}
	@name {String} :: name of controller
	return {Framework}
*/
Framework.prototype.error = function(err, name, uri) {
	var self = this;
	self.lastError = name + ' | ' + err + ' | ' + uri.href;
	self.onError(err, name, uri);
	return self;
};

/*
	Module caller
	@name {String}
	return {Object} :: framework return require();
*/
Framework.prototype.module = function(name) {

	var self = this;
	var module = self.modules[name];
	
	if (typeof(module) === 'undefined') {
		
		var fileName = path.join(directory, self.config.directoryModules, name + '.js')
		if (fs.existsSync(fileName))
			module = require(fileName);
	}

	return module;
};

/*
	Error Handler
	@err {Error}
	@name {String} :: name of Controller
	@uri {Uri}
*/
Framework.prototype.onError = function(err, name, uri) {
	console.log('!ERROR!');
	console.log('Controller: ' + name);
	console.log('Url: ' + uri.href);
	console.log('');
	console.log(err);
	console.log('--------------------------------------------------------------------');
	return this;
};

/*
	Authorize delegate
	@req {ServerRequest}
	@res {ServerResponse}
	@callback {Function} - @callback(Boolean), true if logged and false if unlogged
*/
Framework.prototype.onAuthorize = null;

/*
	Prefix delegate
	@req {ServerRequest}
	return {String}; :: return prefix (default return empty string)
*/
Framework.prototype.onPrefix = null;

/*
	Versioning static files (this delegate call LESS CSS by the background property)
	@name {String} :: name of static file (style.css or script.js)
	return {String}; :: return new name of static file (style-new.css or script-new.js)
*/
Framework.prototype.onVersion = null;

/*
	Route validator / Request restriction
	@req {ServerRequest}
	@res {ServerResponse}
	return {Boolean};
*/
Framework.prototype.onRoute = null;

/*
	Every routed request call this delegate
	@name {String} :: name of controller

	this === controller
*/
Framework.prototype.onController = null;

/*
	Render HTML for views
	@argument {String params}

	this === controller

	return {String}
*/
Framework.prototype.onSettings = function() {
	return '';
};

/*
	Render HTML for views
	@argument {String params}

	this === controller

	return {String}
*/
Framework.prototype.onMeta = function() {
	
	var builder = '';
	
	for (var i = 0; i < arguments.length; i++) {
		var arg = utils.htmlEncode(arguments[i]);

		if (arg === null || arg.length === 0)
			continue;

		switch (i) {
			case 0:
				builder += '<title>{0}</title>'.format(arg);
				break;
			case 1:
				builder += '<meta name="description" content="{0}" />'.format(arg);
				break;
			case 2:
				builder += '<meta name="keywords" content="{0}" />'.format(arg);
				break;
			case 3:
				builder += '<link rel="image_src" type="image/jpeg" href="{0}" />'.format(arg);
				break;
		}
	}

	return builder;
};

/*
	Return size of dimension
	@dimension {String} :: small, large
	return {Object} :: example: return { width: 128, height: 30 };
*/
Framework.prototype.onPictureDimension = function(dimension) {
	return { width: 0, height: 0 };
};

/*
	Return picture URL
	@dimension {String} :: small, large
	@id {String}
	@width {Number}
	@height {Number}
	@alt {String}
	return {String} :: picture URL address
*/
Framework.prototype.onPictureUrl = function(dimension, id, width, height, alt) {
	return '{0}/img/{1}/{2}.jpg'.format(this.config.StaticUrl, dimension, id);
};

// @arguments {Object params}
Framework.prototype.log = function() {

	var self = this;
	var now = new Date();
	var fileName = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padLeft(2, '0') + '-' + (now.getDate() + 1).toString().padLeft(2, '0');
	var time = now.getHours().toString().padLeft(2, '0') + ':' + now.getMinutes().toString().padLeft(2, '0') + ':' + now.getSeconds().toString().padLeft(2, '0');
	var str = '';

	for (var i = 0; i < arguments.length; i++)
		str += (str.length > 0 ? ' ' : '') +  (arguments[i] || '');

	fs.appendFile(utils.combine(self.config.directoryLogs, fileName + '.log'), time + ' | ' + str + '\n');

	return self;
};

/*
	Return string of framework usage information
	@detailed {Boolean} :: default (false)
	return {String}
*/
Framework.prototype.usage = function(detailed) {
	var memory = process.memoryUsage();
	var builder = [];
	var self = this;

	var cache = Object.keys(self.cache.repository);
	var resources = Object.keys(self.resources);
	var controllers = Object.keys(self.controllers);
	var modules = Object.keys(self.modules);

	builder.push('Platform: {0}'.format(process.platform));
	builder.push('Processor: {0}'.format(process.arch));
	builder.push('PID: {0}'.format(process.pid));
	builder.push('Node version: {0}'.format(process.version));
	builder.push('Framework version: {0}'.format(self.version));
	builder.push('Current directory: {0}'.format(process.cwd));
	builder.push('-------------------------------------------------------');
	builder.push('Uptime: {0} minutes'.format(Math.floor(process.uptime() / 60)));
	builder.push('Memory usage: total {0} MB, used {1} MB'.format((memory.heapTotal / 1024 / 1024).floor(2), (memory.heapUsed / 1024 / 1024).floor(2)));
	builder.push('Temporary directory: {0} kB'.format((fs.statSync(self.config.directoryTemp).size / 1024).floor(2)));
	builder.push('Service run: {0}x'.format(self.cache.runner));
	builder.push('Controllers count: {0}'.format(controllers.length));
	builder.push('Modules count: {0}'.format(modules.length));
	builder.push('Cache: {0} items'.format(cache.length, self.cache.runner));
	builder.push('Resources count: {0}'.format(resources.length));
	builder.push('Routes count: {0}'.format(self.routes.length));
	builder.push('-------------------------------------------------------');
	builder.push('Last error: {0}'.format(self.lastError));

	if (detailed) {
		builder.push('-------------------------------------------------------');
		builder.push('');
		builder.push('[Controllers]');

		controllers.forEach(function(o) {
			builder.push('{0}'.format(o).indent(4));
		});

		builder.push('');
		builder.push('[Modules]');

		modules.forEach(function(o) {
			builder.push('{0}'.format(o).indent(4));
		});

		builder.push('');
		builder.push('[Cache items]');

		cache.forEach(function(o) {
			builder.push('{0}'.format(o).indent(4));
		});

		builder.push('');
		builder.push('[Resources]');

		resources.forEach(function(o) {
			builder.push('{0}.resource'.format(o).indent(4));
		});
	}

	return builder.join('\n');
};

/*
	Automatic serve static files
	@req {ServerRequest}
	@res {ServerResponse}
	return {Framework};
*/
Framework.prototype.onStatic = function(req, res) {
	var self = this;
	self.returnStatic(req, res);
	return self;
};

/*
	Automatic serve static files
	@req {ServerRequest}
	@res {ServerResponse}
	return {Framework};
*/
Framework.prototype.returnStatic = function(req, res) {
	
	var self = this;

	if (res.isFlush)
		return;

	var fileName = utils.combine(self.config.directoryPublic, req.url);
	var extension = path.extname(fileName).toLowerCase();

	if (self.config.staticAccepts.indexOf(extension) === -1) {
		self.return404(req, res);
		return;
	};
	
	// javascript compressor & css LESS compiler
	if (extension === '.js' || extension === '.css') {
		
		var fileComiled = utils.combine(self.config.directoryTemp, req.url.replace(/\//g, '-').substring(1));		
		if (self.config.debug || !fs.existsSync(fileComiled)) {
			
			if (!fs.existsSync(fileName)) {
				self.return404(req, res);
				return;
			}

			var data = fs.readFileSync(fileName).toString('utf8');

			if (extension === '.js')
				data = javascript.compile(data);

			if (extension === '.css') {
				data = less.compile(data, !self.config.debug);
				if (self.onVersion !== null) {
					var matches = data.match(/url\(.*?\)/g);
					if (matches !== null) {
						matches.forEach(function(o) {
							var url = o.substring(4, o.length - 1);
							data = data.replace(o, 'url('+ self.onVersion(url) +')');
						});
					}
				}
			}

			fs.writeFileSync(fileComiled, data);
		}

		fileName = fileComiled;
	};

	self.returnFile(req, res, fileName, '');
	return self;
};

/*
	Response with 404 error
	@req {ServerRequest}
	@res {ServerResponse}
	return {Framework};
*/
Framework.prototype.return404 = function(req, res) {
	
	if (res.isFlush)
		return this;

	req.clear();
	
	res.isFlush = true;
	res.writeHead(404, { 'Content-Type': 'text/plain' });
	res.end('File not found (404).');

	return this;
};

/*
	Response file
	@req {ServerRequest}
	@res {ServerResponse}
	@fileName {String}
	@downloadName {String} :: optional
	@headers {Object} :: optional key/value
	return {Framework};
*/
Framework.prototype.returnFile = function(req, res, fileName, downloadName, headers) {

	var self = this;

	if (res.isFlush)
		return self;

	req.clear();

	if (!fs.existsSync(fileName)) {
		self.return404(req, res);
		return self;
	}

	var etag = self.config.httpCache ? utils.EtagCreateFromFile(fileName) : '';
	
	if (!self.config.debug) {
		
		if (req.headers['if-none-match'] === etag) {
			res.isFlush = true;
			res.writeHead(304);
			res.end();
			return self;
		}
	}

	var extension = path.extname(fileName);
	var compress = self.config.httpCompress && ['js', 'css', 'txt', 'xml', 'html', 'htm', 'rtf'].indexOf(extension.substring(1)) !== -1;
	var accept = req.headers['accept-encoding'] || '';
	var returnHeaders = {};

	returnHeaders['Cache-Control'] = 'public';

	// možnosť odoslať vlastné hlavičky
	if (headers)
		util._extend(returnHeaders, headers);

	downloadName = downloadName || '';

	if (downloadName.length > 0)
		returnHeaders['Content-Disposition'] = 'attachment; filename=' + downloadName;

	if (etag.length > 0)
		returnHeaders['Etag'] = etag;

	returnHeaders['Content-Type'] = utils.getContentType(extension.substring(1));

	if (compress) {

		if (accept.indexOf('gzip') !== -1) {
			returnHeaders['Content-Encoding'] = 'gzip';
			res.isFlush = true;
			res.writeHead(200, returnHeaders);
			fs.createReadStream(fileName).pipe(zlib.createGzip()).pipe(res);
			return;
		}

		// problém pri IE, deflate nefunguje
		if (accept.indexOf('deflate') !== -1) {
			returnHeaders['Content-Encoding'] = 'deflate';
			res.isFlush = true;
			res.writeHead(200, returnHeaders);
			fs.createReadStream(fileName).pipe(zlib.createDeflate()).pipe(res);
			return;
		}			
	}

	res.isFlush = true;
	res.writeHead(200, returnHeaders);
	fs.createReadStream(fileName).pipe(res);

	return self;
};

/*
	Response content
	@req {ServerRequest}
	@res {ServerResponse}
	@code {Number}
	@contentBody {String}
	@contentType {String}
	@compress {Boolean}
	@headers {Object} :: optional key/value
	return {Framework};
*/
Framework.prototype.returnContent = function(req, res, code, contentBody, contentType, compress, headers) {
	var self = this;

	if (res.isFlush)
		return self;

	req.clear();
	res.isFlush = true;

	var accept = req.headers['accept-encoding'] || '';
	var returnHeaders = {};

	returnHeaders['Cache-Control'] = 'private';

	// možnosť odoslať vlastné hlavičky
	if (headers)
		util._extend(returnHeaders, headers);

	// Safari resolve
	if (contentType === 'application/json')
		returnHeaders['Cache-Control'] = 'no-cache';

	// pridáme UTF-8 do hlavičky
	if ((/text|application/).test(contentType))
		contentType += '; charset=utf-8';

	if (!self.config.httpCompress)
		compress = false;

	if (compress) {

		if (accept.indexOf('gzip') !== -1) {
			zlib.gzip(new Buffer(contentBody), function(err, data) {
				
				if (err) {
					req.connection.destroy();
					return;
				}

				returnHeaders['Content-Type'] = contentType;
				returnHeaders['Content-Encoding'] = 'gzip';

				res.writeHead(code, returnHeaders);
				res.end(data, encoding);
			});
			return self;
		}

		// problém pri IE, deflate nefunguje
		if (accept.indexOf('deflate') !== -1) {
			zlib.deflate(new Buffer(contentBody), function(err, data) {
				
				if (err) {
					req.connection.destroy();
					return;
				}

				returnHeaders['Content-Type'] = contentType;
				returnHeaders['Content-Encoding'] = 'deflate';

				res.writeHead(code, returnHeaders);
				res.end(data, encoding);
			});
			return self;
		}
	}

	returnHeaders['Content-Type'] = contentType;

	res.writeHead(code, returnHeaders);
	res.end(contentBody, encoding);

	return self;
};

/*
	Internal function
	@req {ServerRequest}
	@res {ServerResponse}
	@url {String}
	@permament {Boolean} :: optional
	return {Subscribe}
*/
Framework.prototype.returnRedirect = function(req, res, url, permament) {

	var self = this;

	if (res.isFlush)
		return self;

	res.isFlush = true;
	res.writeHead(permament ? 301 : 302, { 'Location': url });
	res.end();

	return self;
};

/*
	Initialization
	@http {HTTP or HTTPS}
	@config {Boolean or Object}
	@port {Number}
	return {Framework};
*/
Framework.prototype.init = function(http, config, port) {

	var self = this;

	if (self.server !== null)
		return;

	if (typeof(config) === 'boolean')
		self.config.debug = config;
	else if (typeof(config) === 'object')
		util._extend(self.config, config);

	self.configure();
	self.clear();
	self.cache.init();	

	var module = self.module('#');
	if (typeof(module) !== 'undefined') {
		Object.keys(module).forEach(function(o) {
			self[o] = module[o];
		});
	}

    self.server = http.createServer(function(req, res) {

		res.setHeader('X-Powered-By', 'partial.js v' + self.version);

	    if (self.config.debug)
	    	res.setHeader('Mode', 'debug');

		res.isFlush = false;
		req.data = { get: {}, post: {}, files: [] };
		req.buffer = { data: '', isExceeded: false, isData: false };
		req.isXHR = false;
		req.uri = {};
		req.ip = '';
		req.flags = [];
		req.session = {};
		req.prefix = '';
		req.subdomain = [];

		res.isFlush = false;

		var header = req.headers;
		var protocol = req.connection.encrypted ? 'https' : 'http';

       	req.host = header['host'];
       	req.uri = urlParser.parse(protocol + '://' + req.host + req.url);

		var subdomain = req.uri.host.toLowerCase().split('.');
		
		if (subdomain.length > 2)
			req.subdomain = subdomain.slice(0, subdomain.length - 2); // example: [subdomain].domain.com

		var proxy = header['x-forwarded-for'];

		//  x-forwarded-for: client, proxy1, proxy2, ...
		if (typeof(proxy) !== 'undefined')
			req.ip = proxy.split(',', 1)[0] || req.connection.remoteAddress;
		else
			req.ip = req.connection.remoteAddress;

       	if (req.uri.query)
       		req.data.get = qs.parse(req.uri.query);

       	// if static file, return
       	if (utils.isStaticFile(req.url)) {

	        req.on('end', function () {
				self.onStatic(req, res);
    	   	});

    	   	return;
		}

		if (self.onRoute !== null) {
			try
			{				
				if (!self.onRoute(req, res)) {
					
					if (!res.isFlush)
						req.connection.destroy();

					return;
				}

			} catch(err) {
				self.app.error(err, 'Controller :: onRoute', req.uri);
			}
		}

		var flags = [req.method.toLowerCase()];
	    var multipart = req.headers['content-type'] || '';

	    if (multipart.indexOf('multipart/form-data') === -1)
	    	multipart = '';

		flags.push(protocol);

		if (self.config.debug)
			flags.push('debug');

		req.isXHR = header['x-requested-with'] === 'XMLHttpRequest';
		req.prefix = self.onPrefix === null ? '' : self.onPrefix(req) || '';

		if (req.prefix.length > 0)
			flags.push('#' + req.prefix);

		if (multipart.length > 0)
			flags.push('upload');

		if (req.isXHR)
			flags.push('xhr');

    	req.flags = flags;

    	// call event request
    	self.emit('request', req, res);

	   	if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {

	   		var route;

       		if (multipart.length > 0) {

       			// kontrola či Controller obsahuje flag Upload
				route = self.routeSync(req.subdomain, req.uri.pathname, req.flags, true);
       			if (route !== null) {

	   				internal.parseMULTIPART(req, multipart, route.maximumSize, self.config.directoryTemp, function() {
						self.request(req, res, req.flags);	   					
	   				});
	   				
					return;
	        	}
				
        		req.connection.destroy();
        		return;

       		} else {

       			route = self.routeSync(req.subdomain, req.uri.pathname, req.flags, true);

       			if (route === null) {
        			req.connection.destroy();
					return;
       			}

       			// parsujeme parametre z POST
   				internal.parsePOST(req, route.maximumSize);
       		}
       	};

       	// spracujeme request
        req.on('end', function() {

        	if (!req.buffer.isExceeded && typeof(req.buffer.data) !== 'undefined' && req.buffer.data.length > 0) {
        		var data = req.buffer.data;
        		if (route.flags.indexOf('json') === -1)
        			req.data.post = qs.parse(data);
        		else {
        			try
        			{
        				req.data.post = data.isJSON() ? JSON.parse(data) : null;
        			} catch (err) {
        				self.error(err, '', req.uri);
        			};
        		}
        	}

        	self.request(req, res, flags);
        });
	});

	self.port = port || 8004;
	self.server.listen(self.port);
	return self;
};

/*
	Test request to controller
	
	@url {String}
	@callback {Functions} :: function(error, data, statusCode, headers);
	@method {String} :: default GET
	@data {String} :: default empty string
	@headers {Object}

	return {Framework};
*/
Framework.prototype.assert = function(name, url, callback, method, data, headers) {
	
	var self = this;
	var obj = {
		url: url,
		callback: callback,
		method: method || 'GET',
		data: data,
		headers: headers
	}
	
	self.tests[name] = obj;
	return self;
};

/*
	Test request to controller
	
	@stop {Boolean} :: stop framework (default true)
	@callback {Functions} :: on complete test handler

	return {Framework};
*/
Framework.prototype.test = function(stop, callback) {

	var self = this;
	var keys = Object.keys(self.tests);

	if (keys.length === 0) {

		if (callback)
			callback();

		if (stop || true)
			self.stop();

		return self;
	};

	var key = keys[0];
	var test = self.tests[key];

	delete self.tests[key];

	var cb = function(error, data, code, headers) {

		try
		{
			test.callback.call(self, error, data, key, code, headers);
		} catch (ex) {
			self.cache.stop();
			self.server.close();
			throw ex;
		}
		self.test(stop);
	};

	var url = (test.url.indexOf('http://') > 0 || test.url.indexOf('https://') > 0 ? '' : 'http://127.0.0.1:' + self.port) + test.url;
	utils.request(url, test.method, test.data, cb, test.headers);

	return self;
};

/*
	Make a test from file

	@name {String}
	return {Framework}
*/
Framework.prototype.makeTest = function(name) {

	var self = this;

	var fileName = path.join(directory, self.config.directoryTests, name + '.js');

	if (!fs.existsSync(fileName))
		throw new Error('File of test not found.');

	var test = require(fileName);

	if (typeof(test.init) === 'undefined')
		test.load(self, name);
	else
		test.init(self, name);

	return self;
};

/*
	Clear temporary directory
	return {Framework};
*/
Framework.prototype.clear = function() {

	var self = this;

	fs.readdir(utils.combine(self.config.directoryTemp), function(err, files) {
		if (typeof(files) !== 'undefined') {
    		files.forEach(function(file) {
    			fs.unlink(utils.combine(self.config.directoryTemp, file));
	    	});
    	}
	});

	return self;
};

/*
	Cryptography (encode)
	@value {String}
	@key {String}
	@isUniqe {Boolean} :: optional
	return {Framework};
*/
Framework.prototype.encode = function(value, key, isUnique) {

	var self = this;
	var type = typeof(value);
	
	if (type === 'undefined')
		return '';

	if (type === 'function')
		value = value();

	if (type === 'number')
		value = value.toString();

	if (type === 'object')
		value = JSON.stringify(value);

	return value.encode(self.config.secret + '=' + key, isUnique || true);
};

/*
	Cryptography (decode)
	@value {String}
	@key {String}
	@jsonConvert {Boolean} :: optional (convert string to JSON)
	return {String or Object};
*/
Framework.prototype.decode = function(value, key, jsonConvert) {

	jsonConvert = jsonConvert || true;

	var self = this;
	var result = value.decode(self.config.secret + '=' + key);

	if (jsonConvert) {
		
		if (result.isJSON())
			return JSON.parse(result);
	}

	return result;
};

/*
	Resource reader
	@name {String} :: filename of resource
	@key {String}
	@def {String} :: default value
	return {String};
*/
Framework.prototype.resource = function(name, key, def) {

	var self = this;
	var res = self.resources[name];

	if (typeof(res) === 'undefined') {

		var fileName = utils.combine(self.config.directoryResources, name + '.resource');
		var obj = {};
		
		if (fs.existsSync(fileName)) {

			var arr = fs.readFileSync(fileName).toString('utf8').split('\n');
			for (var i = 0; i < arr.length; i++) {
				var str = arr[i];

				if (str === '')
					continue;

				var index = str.indexOf(':');
				if (index === -1)
					continue;

				obj[str.substring(0, index).trim()] = str.substring(index + 1).trim();
			}

			self.resources[name] = obj;
		}

		res = obj;
	}

	return res[key] || (def || '');
};

/*
	Configuration from file
	return {Framework};
*/
Framework.prototype.configure = function() {
	
	var self = this;
	var fileName = utils.combine('/', 'config-' + (self.config.debug ? 'debug' : 'release'));

	if (!fs.existsSync(fileName))
		return self;

	var obj = {};
	var arr = fs.readFileSync(fileName).toString('utf8').split('\n');

	for (var i = 0; i < arr.length; i++) {
		var str = arr[i];

		if (str === '')
			continue;

		var index = str.indexOf(':');
		if (index === -1)
			continue;

		var name = str.substring(0, index).trim();

		if (name === 'debug' || name === 'resources')
			continue; 

		var value = str.substring(index + 1).trim();

		switch (name) {
			case 'defaultMaxRequestLength':
				obj[name] = utils.parseInt(value);
				break;
			case 'staticAccepts':
				obj[name] = value.split(',');
				break;
			case 'httpCompress':
			case 'httpCache':
				obj[name] = value.toLowerCase() === 'true' || value === '1';
				break;
			default:
				obj[name] = value.isNumber() ? utils.parseInt(value) : value.isNumber(true) ? utils.parseFloat(value) : value;
				break;
		}
	}

	util._extend(self.config, obj);	
	return self;
};

Framework.prototype.verification = function(cb) {

	var self = this;

	if (typeof(self.verify) === 'undefined')
		self.verify = null;

	if (self.verify !== null) {

		if (self.verify.length > 0) {
			var test = self.verify.shift();
			test();
			return;
		}

		if (self.verify.length === 0) {
			self.verify = null;
			cb(self.verifyError);
			return;
		}

		return;
	}

	self.verify = [];
	self.verifyError = [];
	
	self.verify.push(function verifyVersion() {
		utils.request('https://raw.github.com/petersirka/partial.js/master/package.json', 'GET', '', function(err, data) {
			
			if (!err) {
				var obj = JSON.parse(data);
				var git = utils.parseInt(obj.version.replace(/[\.\-]/g, ''));
				var gitFrom = utils.parseInt(obj.versionDifference.replace(/[\.\-]/g, ''));
				if (self.version < git)
					self.verifyError.push('FrameworkVersion: partial.js has a new version v' + git + (self.version >= gitFrom ? ' (trouble-free installation)' : ' (many changes in code)'));
			}

			self.verification(cb);
		});
	});

	self.verify.push(function verifyDirectory() {

		if (!fs.existsSync(self.config.directoryControllers))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryControllers);

		if (!fs.existsSync(self.config.directoryViews))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryViews);

		if (!fs.existsSync(self.config.directoryTemp))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryTemp);

		if (!fs.existsSync(self.config.directoryTemplates))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryTemplates);

		if (!fs.existsSync(self.config.directoryResources))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryResources);

		if (!fs.existsSync(self.config.directoryPublic))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryPublic);

		if (!fs.existsSync(self.config.directoryModules))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryModules);

		if (!fs.existsSync(self.config.directoryLogs))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryLogs);

		self.verification(cb);
	});

	self.verify.push(function verifyGraphicsMagick() {
		var exec = require('child_process').exec;

		exec('gm', function(error, stdout, stderr) {

			if (stderr.length !== 0)
				self.verifyError.push('GraphicsMagickError: ' + stderr);

			self.verification(cb);
		});
	});


	self.verify.push(function verifyGraphicsMagick() {
		var exec = require('child_process').exec;

		exec('convert', function(error, stdout, stderr) {

			if (stderr.length !== 0)
				self.verifyError.push('ImageMagickError: ' + stderr);

			self.verification(cb);
		});
	});

	self.verification(cb);
}

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Framework.prototype.routeJS = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.config.staticUrlJS);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Framework.prototype.routeCSS = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.config.staticUrlCSS);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Framework.prototype.routeImage = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.config.staticUrlImage);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Framework.prototype.routeVideo = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.config.staticUrlVideo);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Framework.prototype.routeFont = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.config.staticUrlFont);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Framework.prototype.routeDocument = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.config.staticUrlDocument);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Framework.prototype.routeStatic = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.config.staticUrl);
};

/*
	Internal sync route function
	@subdomain {String array}
	@pathname {String}
	@flags {String array}
	@noLoggedUnlogged {Boolean}
	return {Boolean};
*/
Framework.prototype.routeSync = function(subdomain, pathname, flags, noLoggedUnlogged) {
	
	var self = this;
	var url = internal.routeSplit(pathname);
	var isSystem = pathname[0] === '#';

	return self.routes.find(function(obj) {

		if (!internal.routeCompareSubdomain(subdomain, obj.subdomain))
			return false;

		if (!internal.routeCompare(url, obj.url, isSystem))
			return false;

		if (internal.routeCompareFlags(flags, obj.flags, noLoggedUnlogged) < 1)
			return false;

		return true;
	});
};

/*
	Internal static file routing
	@name {String} :: filename
	@directory {String} :: directory
	return {String};
*/
Framework.prototype.routeStaticSync = function(name, directory) {	
	var self = this;
	var fileName = self.onVersion === null ? name : self.onVersion(name) || name;
	return directory + fileName;
};

/*
	Per Request handler (internal function, this function create subscribe object and subscribe call controller)
	@req {ServerRequest}
	@res {ServerResponse}
	@flags {String array}
	return {Framework};
*/
Framework.prototype.request = function(req, res, flags) {
	
	var self = this;

	if (self.onAuthorize !== null) {
		
		self.onAuthorize(req, res, function (isLogged) {
			flags.push(isLogged ? 'logged' : 'unlogged');
        	
        	// máme spracovaný request, môžeme vykonať routing
        	// a volať spúšťať controller
			subscribe.init(self, req, res).lookup(req.subdomain, req.buffer.isExceeded ? '#431' : req.uri.pathname, flags);
		});

		return self;
	}

	// máme spracovaný request, môžeme vykonať routing
   	// a volať spúšťať controller
	subscribe.init(self, req, res).lookup(req.subdomain, req.buffer.isExceeded ? '#431' : req.uri.pathname, flags);
	return self;
};

module.exports = new Framework();