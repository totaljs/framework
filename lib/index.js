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
var _controller = '';

require('./prototypes');

// 1. Framework
// 2. Subscribe
// 3. Controller
// 4. res.end();

function Framework() {
	this.version = 1202;
	this.config = {
		debug: false,
		
		name: 'partial.js',
		secret: os.hostname() + '-' + os.platform() + '-' + os.arch(),

		ETagVersion: '',

		directoryContents: '/contents/',
		directoryControllers: '/controllers/',
		directoryViews: '/views/',
		directoryTemp: '/tmp/',
		directoryTemplates: '/templates/',
		directoryResources: '/resources/',
		directoryPublic: '/public/',
		directoryModules: '/modules/',
		directoryLogs: '/logs/',
		directoryTests: '/tests',
		directoryDatabases: '/databases/',

		// all HTTP static requests are routed to directoryPublic
		staticUrl: '',
		staticUrlJS: '/js/',
		staticUrlCSS: '/css/',
		staticUrlImage: '/img/',
		staticUrlVideo: '/video/',
		staticUrlFont: '/font/',
		staticUrlDocument: '/upload/',

		staticAccepts: ['.jpg', '.png', '.gif', '.ico', '.js', '.css', '.txt', '.xml', '.woff', '.ttf', '.eot', '.svg', '.zip', '.rar', '.pdf', '.docx', '.xlsx', '.doc', '.xls', '.html', '.htm'],
		defaultLayout: '_layout',

		httpCompress: false,
		httpCache: false,

		// default maximum request size / length
		// default 5 kB
		defaultMaxRequestLength: 1024 * 5
	};

	this.resources = {};

	// routing to controllers
	this.routes = [];

	// routing to handlers
	this.routesFile = [];

	this.helpers = {};
	this.modules = {};
	this.controllers = {};
	this.tests = {};
	this.lastError = null;
	this.server = null;
	this.port = 0;
	this.statics = {};

	// intialize cache
	this.cache = require('./cache').init(this);

	this.cache.on('service', function(count) {

		var self = this.app;

		if (self.config.debug) {
			
			// every minute clear the resource
			self.resources = {};

		} else {

			// every 20 minute clear resources and reconfigure framework
			if (count % 20 === 0) {
				self.resources = {};
				self.configure();
			}

		}

		self.emit('service', count);
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

	// is controller initialized?
	if (self.controllers[name])
		return self;

	// get controller name to internal property
	_controller = name;

	// initialize controller
	var obj = require(path.join(directory, self.config.directoryControllers, name + '.js'));
	
	self.controllers[name] = obj;
	
	if (!obj.init)
		return self;

	obj.init.call(self);

	// triedenie routov
	self.routes.sort(function(a, b) {

		if (a.flags.length > b.flags.length)
			return -1;

		if (a.url.length < b.url.length)
			return -1;

		for (var i = 0; i < a.url.length; i++) {
			var aa = a.url[i];
			for (var j = 0; i < b.url.length; i++) {
				var bb = b.url[i];
				if (aa[0] === '{' && bb[0] !== '{')
					return 1;
				if (aa[0] !== '{' && bb[0] === '{')
					return -1;
			}
		}

		var ai = a.subdomain === null ? 0 : a.subdomain.length;
		var bi = b.subdomain === null ? 0 : b.subdomain.length;

		if (ai > bi)
			return -1;

		return 1;
	});

	return self;
};

/*
	WARNING: must be installed 'npm install sqlite3'
	Load SQLite database
	@name {String} :: file name of database (example: pictures.sqlite)
*/
Framework.prototype.database = function(name, mode) {
	var sqlite = require('./sqlite');
	return new sqlite.database(path.join(directory, this.config.directoryDatabases, name + '.sqlite3'), mode);
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
	@funcExecute {Function}
	@flags {String array}
	@maximumSize {Number}
	@funcValidation {Function} :: params: {req}, {res}, {flags} return {Boolean};
	return {Framework};
*/
Framework.prototype.route = function(url, funcExecute, flags, maximumSize, funcValidation) {

	if (_controller === '') {
		throw new Error('Route must be defined in controller.');
		return;
	}

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

	self.routes.push({ subdomain: subdomain, name: _controller, url: routeURL, param: arr, flags: flags || [], onExecute: funcExecute, onValidation: funcValidation || null, maximumSize: maximumSize || self.config.defaultMaxRequestLength });
	return self;
};

/*
	Add a new file route
	@name {String}
	@funcValidation {Function} :: params: {req}, {res}, return {Boolean};
	@funcExecute {Function} :: params: {req}, {res};
	return {Framework};
*/
Framework.prototype.routeFile = function(name, funcValidation, funcExecute) {
	var self = this;
	self.routesFile.push({ controller: _controller, name: name, onValidation: funcValidation, onExecute: funcExecute });
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
	self.lastError = name + ' | ' + err + ' | ' + (uri ? uri.href : '');
	self.onError(err, name, uri);
	return self;
};

/*
	Return path to web application directory
	@arguments {String params}
	return {String}
*/
Framework.prototype.path = function() {
	var self = this;

	if (arguments.length === 0)
		return directory;

	var params = [];
	params.push(directory);

	for (var i = 0; i < arguments.length; i++)
		params.push(arguments[i]);

	return path.join.apply(self, params);
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
		var fileName = path.join(directory, self.config.directoryModules, name + '.js');

		if (!fs.existsSync(fileName)) {
			
			fileName = path.join(directory, self.config.directoryModules, name, 'index.js');
			if (fs.existsSync(fileName))
				module = require(fileName);

		} else
			module = require(fileName);

		if (typeof(module) === 'undefined')
			module = null;
		
		_controller = '#module-' + name;

		if (module !== null && typeof(module.directory) === 'undefined')
			module.directory = path.join(directory, self.config.directoryModules);

		self.modules[name] = module;
	}

	return module;
};

/*
	Install/Init modules
	return {Framework}
*/
Framework.prototype.install = function() {

	var self = this;
	var dir = path.join(directory, self.config.directoryControllers);

	if (fs.existsSync(dir)) {
		fs.readdirSync(dir).forEach(function(o) {
			self.controller(o.substring(0, o.length - 3));
		});
	}

	dir = path.join(directory, self.config.directoryModules);

	if (!fs.existsSync(dir))
		return self;

	fs.readdirSync(dir).forEach(function(o) {

		var name = o.replace(path.extname(o), '');

		if (name === '#')
			return;

		var module = self.module(name);

		if (module === null || typeof(module.install) === 'undefined')
			return;

		try
		{
			module.install(self);
		} catch (err) {
			self.error(err, name);
		}
	});

	return self;
};

/*
	Error Handler
	@err {Error}
	@name {String} :: name of Controller (optional)
	@uri {Uri} :: optional
*/
Framework.prototype.onError = function(err, name, uri) {
	console.log(err, name, uri);
	console.log('--------------------------------------------------------------------');
	return this;
};

/*
	Authorize handler
	@req {ServerRequest}
	@res {ServerResponse}
	@flags {String array}
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
	Global framework validation
	@name {String}
	@value {String}
	return {Boolean or utils.isValid() or StringErrorMessage};
*/
Framework.prototype.onValidation = null;

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
	Create file with CSS (client side)
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
Framework.prototype.createCSS = function(name, content, rewrite, append) {

	var self = this;	

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.css') === -1)
		name += '.css';

	var fileName = utils.combine(self.config.directoryPublic, self.config.staticUrlCSS, name);
	return self.createFile(fileName, content, append, rewrite);
};

/*
	Create file with JavaScript (client side)
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
Framework.prototype.createJS = function(name, content, rewrite, append) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.js') === -1)
		name += '.js';

	var fileName = utils.combine(self.config.directoryPublic, self.config.staticUrlJS, name);
	return self.createFile(fileName, content, append, rewrite);
};

/*
	Create file with template
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
Framework.prototype.createTemplate = function(name, content, rewrite, append) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var fileName = utils.combine(self.config.directoryTemplates, name);
	return self.createFile(fileName, content, append, rewrite);
};

/*
	Create file with view
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
Framework.prototype.createView = function(name, content, rewrite, append) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var fileName = utils.combine(self.config.directoryViews, name);
	return self.createFile(fileName, content, append, rewrite);
};

/*
	Create file with content
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
Framework.prototype.createContent = function(name, content, rewrite, append) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var fileName = utils.combine(self.config.directoryContents, name);
	return self.createFile(fileName, content, append, rewrite);
};

/*
	Create file with resource
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
Framework.prototype.createResource = function(name, content, rewrite, append) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.resource') === -1)
		name += '.resource';

	var fileName = utils.combine(self.config.directoryResources, name);
	return self.createFile(fileName, content, append, rewrite);
};

/*
	Create file with content
	@fileName {String}
	@content {String}
	@append {Boolean}
	@rewrite {Boolean}
	return {Boolean}
*/
Framework.prototype.createFile = function(fileName, content, append, rewrite) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	var exists = fs.existsSync(fileName);

	if (exists && append)
	{
		var data = fs.readFileSync(fileName).toString(encoding);

		if (data.indexOf(content) === -1) {
			fs.appendFileSync(fileName, '\n' + content);
			return true;
		}

		return false;
	}

	if (exists && !rewrite)
		return false;

	fs.writeFileSync(fileName, content, encoding);
	return true;
};

/*
	Delete file of CSS
	@name {String}
	return {Boolean}
*/
Framework.prototype.deleteCSS = function(name) {
	var self = this;

	if (name.indexOf('.css') === -1)
		name += '.css';

	var fileName = utils.combine(self.config.directoryPublic, self.config.staticUrlCSS, name);
	return self.deleteFile(fileName);
};

/*
	Delete file of JS
	@name {String}
	return {Boolean}
*/
Framework.prototype.deleteJS = function(name) {
	var self = this;

	if (name.indexOf('.js') === -1)
		name += '.js';

	var fileName = utils.combine(self.config.directoryPublic, self.config.staticUrlJS, name);
	return self.deleteFile(fileName);
};

/*
	Delete file of view
	@name {String}
	return {Boolean}
*/
Framework.prototype.deleteView = function(name) {
	var self = this;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var fileName = utils.combine(self.config.directoryViews, name);
	return self.deleteFile(fileName);
};

/*
	Delete file of content
	@name {String}
	return {Boolean}
*/
Framework.prototype.deleteContent = function(name) {
	var self = this;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var fileName = utils.combine(self.config.directoryContents, name);
	return self.deleteFile(fileName);
};

/*
	Delete file of template
	@name {String}
	return {Boolean}
*/
Framework.prototype.deleteTemplate = function(name) {
	var self = this;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var fileName = utils.combine(self.config.directoryTemplates, name);
	return self.deleteFile(fileName);
};

/*
	Delete file of resource
	@name {String}
	return {Boolean}
*/
Framework.prototype.deleteResource = function(name) {
	var self = this;

	if (name.indexOf('.resource') === -1)
		name += '.resource';

	var fileName = utils.combine(self.config.directoryResources, name);
	return self.deleteFile(fileName);
};

/*
	Delete file
	@name {String}
	return {Boolean}
*/
Framework.prototype.deleteFile = function(fileName) {
	var self = this;

	if (!fs.existsSync(fileName))
		return false;

	fs.unlink(fileName);
	return true;
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
	var fileName = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padLeft(2, '0') + '-' + now.getDate().toString().padLeft(2, '0');
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
	var helpers = Object.keys(self.helpers);
	var statics = Object.keys(self.statics);

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
	builder.push('Service run: {0}x'.format(self.cache.count));
	builder.push('Controller count: {0}'.format(controllers.length));
	builder.push('Module count: {0}'.format(modules.length));
	builder.push('Cache: {0} items'.format(cache.length, self.cache.count));
	builder.push('Resource count: {0}'.format(resources.length));
	builder.push('Route count: {0}'.format(self.routes.length));
	builder.push('Helper count: {0}'.format(helpers.length));
	builder.push('Static files: {0}'.format(statics.length));
	builder.push('-------------------------------------------------------');
	builder.push('Last error: {0}'.format(self.lastError));

	if (detailed) {
		builder.push('-------------------------------------------------------');
		builder.push('');
		builder.push('[Controllers]');

		controllers.forEach(function(o) {
			builder.push('{0}'.format(o).indent(4));
		});

		if (modules.length > 0) {
			builder.push('');
			builder.push('[Modules]');

			modules.forEach(function(o) {
				builder.push('{0}'.format(o).indent(4));
			});
		}

		if (helpers.length > 0) {
			builder.push('');
			builder.push('[Helpers]');

			helpers.forEach(function(o) {
				builder.push('{0}'.format(o).indent(4));
			});
		}

		if (cache.length > 0) {
			builder.push('');
			builder.push('[Cache items]');

			cache.forEach(function(o) {
				builder.push('{0}'.format(o).indent(4));
			});
		}

		if (resources.length > 0) {
			builder.push('');
			builder.push('[Resources]');

			resources.forEach(function(o) {
				builder.push('{0}.resource'.format(o).indent(4));
			});
		}

		if (statics.length > 0) {
			builder.push('');
			builder.push('[Statics]');

			statics.forEach(function(o) {
				builder.push('{0}'.format(o).indent(4));
			});
		}
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
		return self;

	var fileName = utils.combine(self.config.directoryPublic, req.url);
	self.returnFile(req, res, fileName, '');

	return self;
};

/*
	Compile JavaScript and CSS
	@req {ServerRequest}
	@fileName {String}
	return {String or NULL};
*/
Framework.prototype.compileStatic = function(req, fileName) {

	if (!fs.existsSync(fileName))
		return null;

	var self = this;
	var index = fileName.lastIndexOf('.');
	var ext = fileName.substring(index).toLowerCase();
	var output = fs.readFileSync(fileName).toString(encoding);

	switch (ext) {
		case '.js':
			output = javascript.compile(output);
			break;
		
		case '.css':			
			output = less.compile(output, !self.config.debug);

			if (self.onVersion !== null) {
				var matches = output.match(/url\(.*?\)/g);
				if (matches !== null) {
					matches.forEach(function(o) {
						var url = o.substring(4, o.length - 1);
						output = output.replace(o, 'url('+ self.onVersion(url) +')');
					});
				}
			}

			break;
	}

	var fileComiled = utils.combine(self.config.directoryTemp, req.url.replace(/\//g, '-').substring(1));
	fs.writeFileSync(fileComiled, output);

	return fileComiled;
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

	var name = self.statics[fileName];

	if (name === null) {
		self.return404(req, res);
		return self;
	}

	var etag = self.config.httpCache ? utils.Etag(req.url) : '';
	
	if (!self.config.debug) {
		if (req.headers['if-none-match'] === etag) {
			res.isFlush = true;
			res.writeHead(304);
			res.end();
			return self;
		}
	}

	var extension = path.extname(fileName).substring(1);

	if (self.config.staticAccepts.indexOf('.' + extension) === -1) {
		self.return404(req, res);
		return self;
	}

	if (typeof(name) === 'undefined') {

		if (!fs.existsSync(fileName)) {
			self.statics[fileName] = null;
			self.return404(req, res);
			return self;
		}

		name = fileName;

		// compile JavaScript and CSS
		if (['js', 'css'].indexOf(extension) !== -1) {
			name = self.compileStatic(req, fileName);
			self.statics[fileName] = name;
		}
		
		self.statics[fileName] = name;

		if (self.config.debug)
			delete self.statics[fileName];
	}

	var compress = self.config.httpCompress && ['js', 'css', 'txt'].indexOf(extension) !== -1;
	var accept = req.headers['accept-encoding'] || '';
	var returnHeaders = {};

	returnHeaders['Cache-Control'] = 'public';
	returnHeaders['Expires'] = new Date().add('d', 15);
	returnHeaders['Vary'] = 'Accept-Encoding';

	// možnosť odoslať vlastné hlavičky
	if (headers)
		util._extend(returnHeaders, headers);

	downloadName = downloadName || '';

	if (downloadName.length > 0)
		returnHeaders['Content-Disposition'] = 'attachment; filename=' + downloadName;

	if (etag.length > 0)
		returnHeaders['Etag'] = etag;

	returnHeaders['Content-Type'] = utils.getContentType(extension);

	if (compress) {

		if (accept.indexOf('gzip') !== -1) {
			returnHeaders['Content-Encoding'] = 'gzip';
			res.isFlush = true;
			res.writeHead(200, returnHeaders);
			fs.createReadStream(name).pipe(zlib.createGzip()).pipe(res);
			return self;
		}

		// IE problem
		if (accept.indexOf('deflate') !== -1) {
			returnHeaders['Content-Encoding'] = 'deflate';
			res.isFlush = true;
			res.writeHead(200, returnHeaders);
			fs.createReadStream(name).pipe(zlib.createDeflate()).pipe(res);
			return self;
		}			
	}

	res.isFlush = true;
	res.writeHead(200, returnHeaders);
	fs.createReadStream(name).pipe(res);

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
	returnHeaders['Vary'] = 'Accept-Encoding';

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
	self.install();

	var module = self.module('#');
	if (module !== null) {
		Object.keys(module).forEach(function(o) {
			if (o === 'onLoaded')
				return;
			self[o] = module[o];
		});
	}

	process.on('uncaughtException', function(e) {
		self.error(e, '', null);

		if (e.toString().indexOf('listen EADDRINUSE') !== -1)
			process.exit(0);
	});	

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
	        	var files = self.routesFile;	        	
				if (files.length > 0) {
					for (var i = 0; i < files.length; i++) {						
						var file = files[i];
						try
						{
							if (file.onValidation.call(self, req, res)) {
								file.onExecute.call(self, req, res);
								return;
							}
						} catch (err) {
							self.error(err, file.controller + ' :: ' + file.name, req.uri);
						}
					}
				}

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

	   	if (req.method === 'POST' || req.method === 'PUT') {

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

	self.port = port || 8000;
	self.server.listen(self.port);

	if (module !== null) {
		if (typeof(module.onLoaded) !== 'undefined')
			module.onLoaded.call(self, self);
	}

	self.emit('loaded', self);

	return self;
};

/*
	Test request to controller
	
	@url {String}
	@callback {Functions} :: function(error, data, statusCode, headers);
	@method {String} :: default GET
	@data {String} :: default empty string
	@headers {Object} :: optional
	@xhr {Boolean} :: optional

	return {Framework};
*/
Framework.prototype.assert = function(name, url, callback, method, data, headers, xhr) {
	
	var self = this;

	if (typeof(headers) === 'boolean') {
		xhr = headers;
		headers = {};
	}

	var obj = {
		url: url,
		callback: callback,
		method: method || 'GET',
		data: data,
		headers: headers || {}
	};

	if (xhr)
		obj.headers['X-Requested-With'] = 'XMLHttpRequest';
	
	obj.headers['assertion-testing'] = '1';
	self.tests[name] = obj;

	return self;
};

/*
	Internal test function for assertion testing
	
	@stop {Boolean} :: stop framework (default true)
	@callback {Functions} :: on complete test handler

	return {Framework};
*/
Framework.prototype.testing = function(stop, callback) {

	if (typeof(stop) === 'undefined')
		stop = true;

	var self = this;
	var keys = Object.keys(self.tests);

	if (keys.length === 0) {

		if (callback)
			callback();

		if (stop)
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
		self.testing(stop, callback);
	};

	var url = (test.url.indexOf('http://') > 0 || test.url.indexOf('https://') > 0 ? '' : 'http://127.0.0.1:' + self.port) + test.url;	
	utils.request(url, test.method, test.data, cb, test.headers);

	return self;
};

/*
	Make a tests
	@stop {Boolean} :: stop framework (default true)
	@names {String array} :: only tests in names (optional)
	@callback {Functions} :: on complete test handler (optional)
	return {Framework}
*/
Framework.prototype.test = function(stop, names, cb) {
	
	var self = this;

	if (typeof(names) === 'function') {
		cb = names;
		names = [];
	} else
		names = names || [];

	fs.readdirSync('.' + self.config.directoryTests).forEach(function(name) {

		var fileName = path.join(directory, self.config.directoryTests, name);

		if (path.extname(fileName).toLowerCase() !== '.js')
			return;

		if (names.length > 0) {
			if (names.indexOf(name.substring(0, name.length - 3)) === -1)
				return;
		}

		var test = require(fileName);

		try
		{
			if (typeof(test.init) === 'undefined')
				test.load(self, name);
			else
				test.init(self, name);
		} catch (ex) {
			self.cache.stop();
			self.server.close();
			throw ex;
		}
	});

	self.testing(stop, cb);
	return self;
};

/*
	Clear temporary directory
	return {Framework};
*/
Framework.prototype.clear = function() {

	var self = this;
	var dir = utils.combine(self.config.directoryTemp);

	if (fs.existsSync(dir)) {
		fs.readdir(dir, function(err, files) {

			if (err)
				return;

			if (typeof(files) !== 'undefined') {
	    		files.forEach(function(file) {
	    			fs.unlink(utils.combine(self.config.directoryTemp, file));
		    	});
	    	}
	    	
		});
	}

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

	if (typeof(key) === 'undefined' || name.length === 0) {
		key = name;
		name = 'default';
	}

	var self = this;
	var res = self.resources[name];

	if (typeof(res) === 'undefined') {

		var fileName = utils.combine(self.config.directoryResources, name + '.resource');
		var obj = {};
		
		if (fs.existsSync(fileName)) {

			var arr = fs.readFileSync(fileName).toString(encoding).split('\n');
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
	var arr = fs.readFileSync(fileName).toString(encoding).split('\n');

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
	process.title = self.config.name;
	
	return self;
};

Framework.prototype.verification = function(cb) {

	var self = this;

	if (typeof(self.verify) === 'undefined') {
		self.configure();
		self.verify = null;
	}

	if (self.verify !== null) {

		if (self.verify.length > 0) {
			var test = self.verify.shift();
			test();
			return;
		}

		if (self.verify.length === 0) {
			self.verify = null;
			cb.call(this, self.verifyError);
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

			self.verification.call(self, cb);
		});
	});

	self.verify.push(function verifyDirectory() {

		if (!fs.existsSync('.' + self.config.directoryControllers))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryControllers);

		if (!fs.existsSync('.' + self.config.directoryViews))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryViews);

		if (!fs.existsSync('.' + self.config.directoryTemp))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryTemp);

		if (!fs.existsSync('.' + self.config.directoryTemplates))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryTemplates);

		if (!fs.existsSync('.' + self.config.directoryResources))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryResources);

		if (!fs.existsSync('.' + self.config.directoryPublic))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryPublic);

		if (!fs.existsSync('.' + self.config.directoryModules))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryModules);

		if (!fs.existsSync('.' + self.config.directoryDatabases))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryDatabases);

		if (!fs.existsSync('.' + self.config.directoryLogs))
			self.verifyError.push('DirectoryNotFound: ' + self.config.directoryLogs);

		self.verification.call(self, cb);
	});

	self.verify.push(function verifyGraphicsMagick() {
		var exec = require('child_process').exec;

		exec('gm', function(error, stdout, stderr) {

			if (stderr.length !== 0)
				self.verifyError.push('GraphicsMagickError: ' + stderr);

			self.verification.call(self, cb);
		});
	});

	self.verify.push(function verifyGraphicsMagick() {
		var exec = require('child_process').exec;

		exec('convert', function(error, stdout, stderr) {

			if (stderr.length !== 0)
				self.verifyError.push('ImageMagickError: ' + stderr);

			self.verification.call(self, cb);
		});
	});

	self.verification.call(self, cb);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Framework.prototype.routeJS = function(name) {
	var self = this;

	if (name.indexOf('.js') === -1)
		name += '.js';

	return self.routeStaticSync(name, self.config.staticUrlJS);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Framework.prototype.routeCSS = function(name) {
	var self = this;

	if (name.indexOf('.css') === -1)
		name += '.css';

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
		
		self.onAuthorize(req, res, flags, function (isLogged) {
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