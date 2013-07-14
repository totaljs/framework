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

var qs = require('querystring');
var os = require('os');
var fs = require('fs');
var zlib = require('zlib');
var path = require('path');
var crypto = require('crypto');
var parser = require('url');
var events = require('events');
var internal = require('./internal');
var bk = require('./backup');
var nosql = require('./nosql');
var http = require('http');
var directory = path.dirname(process.argv[1]);

var ENCODING = 'utf8';
var UNDEFINED = 'undefined';
var STRING = 'string';
var FUNCTION = 'function';
var NUMBER = 'number';
var OBJECT = 'object';
var BOOLEAN = 'boolean';

var _controller = '';

global.builders = require('./builders');
global.utils = require('./utils');

process.chdir(directory);
process.maxTickDepth = 300;

function Framework() {
	this.version = 1245;
	this.versionNode = parseInt(process.version.replace('v', '').replace(/\./g, ''), 10);

	this.handlers = {
		onrequest: this._request.bind(this),
		onxss: this.onXSS(this),
		onupgrade: this._upgrade.bind(this),
		onservice: this._service.bind(this)
	};

	this.config = {
		debug: false,

		name: 'partial.js',
		version: '1.01',
		secret: os.hostname() + '-' + os.platform() + '-' + os.arch(),

		'etag-version': '',

		'directory-contents': '/contents/',
		'directory-controllers': '/controllers/',
		'directory-views': '/views/',
		'directory-temp': '/tmp/',
		'directory-templates': '/templates/',
		'directory-resources': '/resources/',
		'directory-public': '/public/',
		'directory-modules': '/modules/',
		'directory-logs': '/logs/',
		'directory-tests': '/tests/',
		'directory-databases': '/databases/',
		'directory-backup': '/backup/',

		// all HTTP static request are routed to directory-public
		'static-url': '',
		'static-url-js': '/js/',
		'static-url-css': '/css/',
		'static-url-image': '/img/',
		'static-url-video': '/video/',
		'static-url-font': '/font/',
		'static-url-upload': '/upload/',
		'static-accepts': ['.jpg', '.png', '.gif', '.ico', '.js', '.css', '.txt', '.xml', '.woff', '.ttf', '.eot', '.svg', '.zip', '.rar', '.pdf', '.docx', '.xlsx', '.doc', '.xls', '.html', '.htm', '.appcache'],

		// 'static-accepts-custom': [],

		'default-layout': '_layout',

		// default maximum request size / length
		// default 5 kB
		'default-request-length': 1024 * 5,
		'default-websocket-request-length': 1024 * 5,

		// in milliseconds
		'default-request-timeout': 3000,

		'allow-gzip': true,
		'allow-websocket': true,
	};

	this.global = {};
	this.resources = {};
	this.connections = {};

	this.routes = {
		web: [],
		files: [],
		websockets: [],
		partial: {},
		partialGlobal: []
	};

	this.helpers = {};
	this.modules = {};
	this.controllers = {};
	this.tests = {};
	this.errors = [];
	this.server = null;
	this.port = 0;
	this.ip = '';

	this.databases = {};
	this.directory = directory;

	this.temporary = {
		path: {},
		range: {}
	};

	this.stats = {

		request: {
			web: 0,
			xhr: 0,
			file: 0,
			websocket: 0,
			get: 0,
			post: 0,
			upload: 0,
			xss: 0
		},

		response: {
			view: 0,
			json: 0,
			websocket: 0,
			file: 0,
			plain: 0,
			empty: 0,
			redirect: 0,
			mmr: 0,
			sse: 0,
			error401: 0,
			error403: 0,
			error404: 0,
			error408: 0,
			error431: 0,
			error500: 0
		}
	};

	// intialize cache
	this.cache = new FrameworkCache(this);
	this.cache.on('service', this.handlers.onservice);

	this.fs = new FrameworkFileSystem(this);
	this.path = new FrameworkPath(this);

	var self = this;
};

// ======================================================
// PROTOTYPES
// ======================================================

Framework.prototype = new events.EventEmitter;

/*
	Refresh framework internal information
	@clear {Boolean} || optional, default true - clear TMP direcotry
	return {Framework}
*/
Framework.prototype.refresh = function(clear) {
	var self = this;
	self.resources = {};
	self.databases = {};
	self.configure();
	self.temporary.path = {};
	self.temporary.range = {};
	(clear || true) && self.clear();
	return self;
};

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
	var obj = require(path.join(directory, self.config['directory-controllers'], name + '.js'));

	self.controllers[name] = obj;

	if (obj.install) {
		obj.install.call(self, self);
		return self;
	}

	if (obj.init) {
		obj.init.call(self, self);
		return self;
	}

	return self;
};

Framework.prototype._routeSort = function() {

	var self = this;

	self.routes.web.sort(function(a, b) {
		if (a.priority > b.priority)
			return -1;

		if (a.priority < b.priority)
			return 1;

		return 0;
	});

	self.routes.websockets.sort(function(a, b) {
		if (a.priority > b.priority)
			return -1;

		if (a.priority < b.priority)
			return 1;

		return 0;
	});

	return self;
};

/*
	@name {String} :: file name of database
	@changes {Boolean} :: optional, default true
	return {nosql}
*/
Framework.prototype.database = function(name, changes) {

	var self = this;

	var db = self.databases[name];
	if (typeof(db) !== UNDEFINED)
		return db;

	db = nosql.load(path.join(directory, this.config['directory-databases'], name), path.join(directory, this.config['directory-databases'], name + '-binary'), changes);
	self.databases[name] = db;

	return db;
};

/*
	Stop the server and exit
	@code {Number} :: optional, exit code - default 0
	return {Framework}
*/
Framework.prototype.stop = function(code) {
	var self = this;

	if (typeof(process.send) === FUNCTION)
		process.send('stop');

	self.cache.stop();
	self.server.close();

	process.exit(code || 0);
	return self;
};

/*
	Add a new route
	@url {String}
	@funcExecute {Function}
	@flags {String array} :: optional, default []
	@maximumSize {Number} :: optional, default by the config
	@partial {String Array} :: optional, partial content
	@timeout {Number} :: optional, default by the config
	return {Framework}
*/
Framework.prototype.route = function(url, funcExecute, flags, maximumSize, partial, timeout) {

	if (_controller === '')
		throw new Error('Route must be defined in a controller.');

	if (utils.isArray(maximumSize)) {
		var tmp = partial;
		partial = maximumSize;
		maximumSize = tmp;
	}

	var self = this;
	var priority = 0;
	var index = url.indexOf(']');
	var subdomain = null;

	priority = url.count('/');

	if (index > 0) {
		subdomain = url.substring(1, index).trim().toLowerCase().split(',');
		url = url.substring(index + 1);
		priority += 2;
	}

	if (flags) {
		for (var i = 0; i < flags.length; i++)
			flags[i] = flags[i].toString().toLowerCase();

		priority += (flags.length * 2);
 	} else
 		flags = ['get'];

 	var isMixed = flags.indexOf('mmr') !== -1;

	if (isMixed && url.indexOf('{') !== -1)
		throw new Error('Mixed route cannot contain dynamic path');

	if (isMixed && flags.indexOf('upload') !== -1)
		throw new Error('Multipart mishmash: mmr vs. upload');

	var routeURL = internal.routeSplit(url.trim());
	var arr = [];

	if (url.indexOf('{') !== -1) {
		routeURL.forEach(function(o, i) {
			if (o.substring(0, 1) === '{')
				arr.push(i);
		});

		priority -= arr.length;
	}

	if (url.indexOf('#') !== -1)
		priority--;

	if (typeof(flags) !== UNDEFINED) {

		if (flags.indexOf('proxy') !== -1 && flags.indexOf('json') === -1)
			flags.push('json');

		if (flags.indexOf('json') !== -1 && flags.indexOf('post') === -1)
			flags.push('post');

		for (var i = 0; i < flags.length; i++)
			flags[i] = flags[i].toLowerCase();
	}

	self.routes.web.push({ priority: priority, subdomain: subdomain, name: _controller, url: routeURL, param: arr, flags: flags || [], onExecute: funcExecute, maximumSize: maximumSize || self.config['default-request-length'], partial: partial || [], timeout: timeout || self.config['default-request-timeout'] });
	return self;
};

/*
	Add a new partial route
	@name {String or Function} :: if @name is function, route will be a global partial content
	@funcExecute {Function} :: optional
	return {Framework}
*/
Framework.prototype.partial = function(name, funcExecute) {
	var self = this;

	if (typeof(name) === FUNCTION)
		self.routes.partialGlobal.push(name);
	else
		self.routes.partial[name] = funcExecute;

	return self;
};

/*
	Add a new websocket route
	@url {String}
	@funcInitialize {Function}
	@flags {String Array} :: optional
	@protocols {String Array} :: optional, websocket-allow-protocols
	@allow {String Array} :: optional, allow origin
	@maximumSize {Number} :: optional, default by the config
	return {Framework}
*/
Framework.prototype.websocket = function(url, funcInitialize, flags, protocols, allow, maximumSize) {

	if (_controller === '')
		throw new Error('Websocket route must be defined in controller.');

	if (url.indexOf('{') !== -1)
		throw new Error('Websocket url cannot contain dynamic path.');

	var self = this;
	var priority = 0;
	var routeURL = internal.routeSplit(url.trim());
	var index = url.indexOf(']');
	var subdomain = null;

	priority = url.count('/');

	if (index > 0) {
		subdomain = url.substring(1, index).trim().toLowerCase().split(',');
		url = url.substring(index + 1);
		priority += 2;
	}

	if (typeof(allow) === STRING)
		allow = allow[allow];

	if (typeof(protocols) === STRING)
		protocols = protocols[protocols];

	if (typeof(flags) === STRING)
		flags = flags[flags];

	self.routes.websockets.push({ name: _controller, url: routeURL, subdomain: subdomain, priority: priority, flags: flags || [], onInitialize: funcInitialize, protocols: protocols || [], allow: allow || [], length: maximumSize || self.config['default-websocket-request-length'] });
	return self;
};

/*
	Alias for routeFile
*/
Framework.prototype.file = function(name, funcValidation, funcExecute) {
	var self = this;
	self.routes.files.push({ controller: _controller, name: name, onValidation: funcValidation, onExecute: funcExecute });
	return self;
};

/*
	Error caller
	@err {Error}
	@name {String} :: controller name
	@uri {URI} :: optional
	return {Framework}
*/
Framework.prototype.error = function(err, name, uri) {
	var self = this;

	self.errors.push({ error: err, name: name, uri: uri, date: new Date() });

	if (self.errors.length > 50)
		self.errors.shift();

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

	return path.join.apply(self, params).replace(/\\/g, '/');
};

/*
	Module caller
	@name {String}
	return {Object} :: framework return require();
*/
Framework.prototype.module = function(name) {

	var self = this;
	var module = self.modules[name];

	if (typeof(module) !== UNDEFINED)
		return module;

	var filename = path.join(directory, self.config['directory-modules'], name + '.js');

	if (!fs.existsSync(filename)) {

		filename = path.join(directory, self.config['directory-modules'], name, 'index.js');
		if (fs.existsSync(filename))
			module = require(filename);

	} else
		module = require(filename);

	if (typeof(module) === UNDEFINED)
		module = null;

	_controller = '#module-' + name;

	if (module !== null && typeof(module.directory) === UNDEFINED)
		module.directory = path.join(directory, self.config['directory-modules']);

	self.modules[name] = module;

	return module;
};

/*
	Install/Init modules
	return {Framework}
*/
Framework.prototype.install = function() {

	var self = this;
	var dir = path.join(directory, self.config['directory-controllers']);

	if (fs.existsSync(dir)) {
		fs.readdirSync(dir).forEach(function(o) {

			var ext = path.extname(o);
			if (ext.toLowerCase() !== '.js')
				return;

			self.controller(o.substring(0, o.length - 3));
		});
	}

	dir = path.join(directory, self.config['directory-modules']);

	if (!fs.existsSync(dir)) {
		self._routeSort();
		return self;
	}

	fs.readdirSync(dir).forEach(function(o) {

		var ext = path.extname(o);

		var isDirectory = fs.statSync(path.join(dir + o)).isDirectory();
		if (!isDirectory && ext.toLowerCase() !== '.js')
			return;

		var name = o.replace(ext, '');

		if (name === '#')
			return;

		var module = self.module(name);

		if (module === null || typeof(module.install) === UNDEFINED)
			return;

		try
		{
			module.install(self);
		} catch (err) {
			self.error(err, name);
		}
	});

	self._routeSort();
	return self;
};

/*
	Inject module / script
	@name {String} :: name of module or script
	@url {String}
	return {Framework}
*/
Framework.prototype.inject = function(name, url) {
	var self = this;
	var framework = self;

	utils.request(url, 'GET', '', function(error, data) {

		if (error) {
			self.error(error, 'inject - ' + name, null);
			return;
		}

		try
		{
			var result = eval('(new (function(framework){var module = this;var exports = {};this.exports=exports;' + data + '})).exports');
			_controller = '#module-' + name;

			self.routes.web = self.routes.web.remove(function(route) {
				return route.name === _controller;
			});

			if (typeof(result.install) !== UNDEFINED)
				result.install(self);

			self.modules[name] = result;
			self._routeSort();

		} catch (ex) {
			self.error(ex, 'inject - ' + name, null);
		}
	});

	return self;
};

/*
	Backup website directory
	@callback {Function} :: optional, param: param: @err {Error}, @filename {String}
	return {Framework}
*/
Framework.prototype.backup = function(callback) {

	var self = this;
	var backup = new bk.Backup();

	var filter = function(path) {

		if (path === '/tmp/' || path === '/backup/')
			return true;

		if (path.indexOf('.DS_Store') !== -1)
			return false;

		if (path.indexOf('/backup/') === 0)
			return false;

		if (path.indexOf('/tmp/') === 0)
			return false;

		if (path.indexOf('.nosql-tmp') !== -1)
			return false;

		if (path === '/keepalive.js')
			return false;

		return self.onFilterBackup(path);
	};

	backup.directory.push('/backup/');
	backup.directory.push('/tmp/');

	var directoryBackup = path.join(directory, self.config['directory-backup']);

	if (!fs.existsSync(directoryBackup))
		fs.mkdirSync(directoryBackup);

	backup.backup(directory, path.join(directoryBackup, new Date().format('yyyy-MM-dd') + '.backup'), callback, filter);
	return self;
};

/*
	Restore website directory
	@date {String} :: yyyy-MM-dd
	@callback {Function} :: optional, param: @err {Error}, @path {String}
	@restorePath {String} :: optional, path to restore website
	return {Framework}
*/
Framework.prototype.restore = function(date, callback, restorePath) {

	var self = this;
	var dir = restorePath || directory;

	var tmpDirectory = path.join(dir, self.config['directory-temp']);

	if (!fs.existsSync(tmpDirectory))
		fs.mkdirSync(tmpDirectory);

	var fileName = path.join(dir, self.config['directory-backup'], date + (date.indexOf('.backup') === -1 ? '.backup' : ''));

	var cb = function(err, path) {

		if (typeof(process.send) === FUNCTION)
			process.send('restore');

		callback && callback(err, path);
	};

	if (!fs.existsSync(fileName))
		return cb(new Error('Backup file not found.'), dir);

	var filter = function(path) {

		if (path === '/tmp/' || path === '/backup/')
			return true;

		if (path.indexOf('/backup/') === 0)
			return false;

		return self.onFilterRestore(path);
	};

	var filterClear = function(path) {
		if (path === '/tmp/' || path === '/backup/')
			return false;
		return;
	};

	var backup = new bk.Backup();

	backup.clear(dir, function() {
		backup.restore(fileName, dir, cb, filter);
	}, filterClear);

	return self;
};

/*
	Error Handler
	@err {Error}
	@name {String} :: name of Controller (optional)
	@uri {Uri} :: optional
*/
Framework.prototype.onError = function(err, name, uri) {
	console.log(err.toString(), err.stack);
	console.log('--------------------------------------------------------------------');
	return this;
};

/*
	Authorization handler
	@req {ServerRequest}
	@res {ServerResponse} OR {WebSocketClient}
	@flags {String array}
	@callback {Function} - @callback(Boolean), true if logged and false if unlogged
*/
Framework.prototype.onAuthorization = null;

/*
	Prefix delegate
	@req {ServerRequest}
	return {String} :: return prefix (default return empty string)
*/
Framework.prototype.onPrefix = null;

/*
	Versioning static files (this delegate call LESS CSS by the background property)
	@name {String} :: name of static file (style.css or script.js)
	return {String} :: return new name of static file (style-new.css or script-new.js)
*/
Framework.prototype.onVersion = null;

/*
	Skipper delegate
	@name {String}
	return {Boolean}
*/
Framework.prototype.onSkip = null;

/*
	Route validator / Request restriction
	@req {ServerRequest}
	@res {ServerResponse}
	return {Boolean}
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
	Validate request data
	@data {String}
	return {Boolean}
*/
Framework.prototype.onXSS = function(data) {

	if (data === null || data.length === 0)
		return false;

	data = decodeURIComponent(data);
	return (data.indexOf('<') !== -1 && data.indexOf('>') !== -1);
};

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
	Backup Filter
	@path {String}
	return {Boolean}
*/
Framework.prototype.onFilterBackup = function(path) {
	return true;
};

/*
	Restore Filter
	@path {String}
	return {Boolean}
*/
Framework.prototype.onFilterRestore = function(path) {
	return true;
};

/*
	Render HTML for views
	@argument {String params}

	this === controller

	return {String}
*/
Framework.prototype.onMeta = function() {

	var self = this;
	var builder = '';

	for (var i = 0; i < arguments.length; i++) {

		var arg = utils.htmlEncode(arguments[i]);
		if (arg === null || arg.length === 0)
			continue;

		switch (i) {
			case 0:
				builder += '<title>{0}</title>'.format(arg + (self.url !== '/' ? ' - ' + self.config['name'] : ''));
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

// @arguments {Object params}
Framework.prototype.log = function() {

	var self = this;
	var now = new Date();
	var fileName = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padLeft(2, '0') + '-' + now.getDate().toString().padLeft(2, '0');
	var time = now.getHours().toString().padLeft(2, '0') + ':' + now.getMinutes().toString().padLeft(2, '0') + ':' + now.getSeconds().toString().padLeft(2, '0');
	var str = '';

	for (var i = 0; i < arguments.length; i++)
		str += (str.length > 0 ? ' ' : '') +  (arguments[i] || '');

	fs.appendFile(utils.combine(self.config['directory-logs'], fileName + '.log'), time + ' | ' + str + '\n');

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
	var connections = Object.keys(self.connections);
	var modules = Object.keys(self.modules);
	var helpers = Object.keys(self.helpers);
	var staticFiles = Object.keys(self.temporary.path);
	var staticRange = Object.keys(self.temporary.range);

	var size = 0;
	var sizeBackup = 0;
	var sizeDatabase = 0;
	var dir = '.' + self.config['directory-temp'];

	if (fs.existsSync(dir)) {
		fs.readdirSync(dir).forEach(function(o) {
			size += fs.statSync(utils.combine(self.config['directory-temp'], o)).size;
		});
	}

	dir = '.' + self.config['directory-backup'];

	if (fs.existsSync(dir)) {
		fs.readdirSync(dir).forEach(function(o) {
			sizeBackup += fs.statSync(utils.combine(self.config['directory-backup'], o)).size;
		});
	}

	dir = '.' + self.config['directory-databases'];

	if (fs.existsSync(dir)) {
		fs.readdirSync(dir).forEach(function(o) {
			sizeDatabase += fs.statSync(utils.combine(self.config['directory-databases'], o)).size;
		});
	}

	var delimiter = '----------------------------------------------------------------------------------';

	builder.push('Platform                        : {0}'.format(process.platform));
	builder.push('Processor                       : {0}'.format(process.arch));
	builder.push('PID                             : {0}'.format(process.pid));
	builder.push('Node version                    : {0}'.format(process.version));
	builder.push('Framework version               : v{0}'.format(self.version));
	builder.push('Current directory               : {0}'.format(process.cwd));
	builder.push('Service ran                     : {0}x'.format(self.cache.count));
	builder.push(delimiter);
	builder.push('Uptime                          : {0} minutes'.format(Math.floor(process.uptime() / 60)));
	builder.push('Memory usage                    : total {0} MB, used {1} MB'.format((memory.heapTotal / 1024 / 1024).format('### ### ###.##'), (memory.heapUsed / 1024 / 1024).format('### ### ###.##')));
	builder.push(delimiter);
	builder.push('Temporary directory             : {0} kB'.format((size / 1024).format('### ### ###.##')));
	builder.push('Backup directory                : {0} kB'.format((sizeBackup / 1024).format('### ### ###.##')));
	builder.push('Databases directory             : {0} kB'.format((sizeDatabase / 1024).format('### ### ###.##')));
	builder.push('Resource count                  : {0}'.format(resources.length));
	builder.push('Controller count                : {0}'.format(controllers.length));
	builder.push('Module count                    : {0}'.format(modules.length));
	builder.push('Cache                           : {0} items'.format(cache.length, self.cache.count));
	builder.push('WebSocket connections           : {0}'.format(connections.length));
	builder.push('Count of routes to webpage      : {0}'.format(self.routes.web.length));
	builder.push('Count of routes to websocket    : {0}'.format(self.routes.websockets.length));
	builder.push('Count of routes to file         : {0}'.format(self.routes.files.length));
	builder.push('Count of helpers                : {0}'.format(helpers.length));
	builder.push('Static cache files              : {0}'.format(staticFiles.length));
	builder.push('Static cache files / range      : {0}'.format(staticRange.length));
	builder.push('Error count                     : {0}'.format(self.errors.length));
	builder.push(delimiter);
	builder.push('Request statistics / The last 10 minutes');
	builder.push('Request to controller           : {0}x'.format(self.stats.request.web.format('### ### ###')));
	builder.push('Request to websocket            : {0}x'.format(self.stats.request.websocket.format('### ### ###')));
	builder.push('Request to file                 : {0}x'.format(self.stats.request.file.format('### ### ###')));
	builder.push('Request XHR                     : {0}x'.format(self.stats.request.xhr.format('### ### ###')));
	builder.push('Request GET                     : {0}x'.format(self.stats.request.get.format('### ### ###')));
	builder.push('Request POST                    : {0}x'.format(self.stats.request.post.format('### ### ###')));
	builder.push('Request MULTIPART (upload)      : {0}x'.format(self.stats.request.upload.format('### ### ###')));
	builder.push('Request XSS                     : {0}x'.format(self.stats.request.xss.format('### ### ###')));
	builder.push(delimiter);
	builder.push('Response statistics / The last 10 minutes');
	builder.push('Response view                   : {0}x'.format(self.stats.response.view.format('### ### ###')));
	builder.push('Response JSON                   : {0}x'.format(self.stats.response.json.format('### ### ###')));
	builder.push('Response plain                  : {0}x'.format(self.stats.response.plain.format('### ### ###')));
	builder.push('Response empty                  : {0}x'.format(self.stats.response.empty.format('### ### ###')));
	builder.push('Response redirect               : {0}x'.format(self.stats.response.redirect.format('### ### ###')));
	builder.push('Response file                   : {0}x'.format(self.stats.response.file.format('### ### ###')));
	builder.push('Response x-mixed-replace        : {0}x'.format(self.stats.response.mmr.format('### ### ###')));
	builder.push('Response Server Sent Events     : {0}x'.format(self.stats.response.sse.format('### ### ###')));
	builder.push('Response websocket message      : {0}x'.format(self.stats.response.websocket.format('### ### ###')));
	builder.push('Response 401                    : {0}x'.format(self.stats.response.error401.format('### ### ###')));
	builder.push('Response 403                    : {0}x'.format(self.stats.response.error403.format('### ### ###')));
	builder.push('Response 404                    : {0}x'.format(self.stats.response.error404.format('### ### ###')));
	builder.push('Response 408                    : {0}x'.format(self.stats.response.error408.format('### ### ###')));
	builder.push('Response 431                    : {0}x'.format(self.stats.response.error431.format('### ### ###')));
	builder.push('Response 500                    : {0}x'.format(self.stats.response.error500.format('### ### ###')));
	builder.push(delimiter);

	if (!detailed)
		return builder.join('\n');

	builder.push('');
	builder.push('============ [Controllers]');

	controllers.forEach(function(o) {

		builder.push('');
		builder.push('[' + o + ']');

		var controller = self.controllers[o];

		if (typeof(controller.usage) === UNDEFINED)
			return;

		builder.push((controller.usage() || '').toString());

	});

	if (connections.length > 0) {
		builder.push('');
		builder.push('============ [WebSocket connections]');
		builder.push('');
		connections.forEach(function(o) {
			builder.push('Path: {0} (online {1}x)'.format(o, self.connections[o].online));
		});
	}

	if (modules.length > 0) {
		builder.push('');
		builder.push('============ [Modules]');

		modules.forEach(function(o) {

			builder.push('');
			builder.push('[' + o + ']');

			var module = self.modules[o];

			if (module === null || typeof(module.usage) === UNDEFINED)
				return;

			builder.push('');
			builder.push((module.usage() || '').toString());
		});
	}

	if (helpers.length > 0) {
		builder.push('');
		builder.push('============ [Helpers]');

		helpers.forEach(function(o) {
			builder.push('{0}'.format(o).indent(4));
		});
	}

	if (cache.length > 0) {
		builder.push('');
		builder.push('============ [Cached items]');

		cache.forEach(function(o) {
			builder.push('{0}'.format(o).indent(4));
		});
	}

	if (resources.length > 0) {
		builder.push('');
		builder.push('============ [Resources]');

		resources.forEach(function(o) {
			builder.push('{0}.resource'.format(o).indent(4));
		});
	}

	if (staticFiles.length > 0) {
		builder.push('');
		builder.push('============ [Cache of static files]');

		staticFiles.forEach(function(o) {
			builder.push('{0}'.format(o).indent(4));
		});
	}

	if (staticRange.length > 0) {
		builder.push('');
		builder.push('============ [Cache of static files / range]');

		staticRange.forEach(function(o) {
			builder.push('{0} / {1}'.format(o, (self.temporary.range[o] / 1024).floor(2)).indent(4));
		});
	}

	if (self.errors.length > 0) {
		builder.push('');
		builder.push('============ [Errors]');
		builder.push('');
		self.errors.forEach(function(error) {
			builder.push(error.date.format('yyyy-MM-dd / HH:mm:ss - ') + error.error.toString() + ' - ' + error.error.stack + '\n');
		});
	}

	return builder.join('\n');
};

/*
	Automatic serve static files
	@req {ServerRequest}
	@res {ServerResponse}
	return {Framework}
*/
Framework.prototype.onStatic = function(req, res) {
	var self = this;
	self.responseStatic(req, res);
	return self;
};

/*
	3rd CSS compiler (Sync)
	@filename {String}
	@content {String} :: Content of CSS file
	return {String}
*/
Framework.prototype.onCompileCSS = null;

/*
	3rd JavaScript compiler (Sync)
	@filename {String}
	@content {String} :: Content of JavaScript file
	return {String}
*/
Framework.prototype.onCompileJS = null;

/*
	Compile JavaScript and CSS
	@req {ServerRequest}
	@filename {String}
	return {String or NULL};
*/
Framework.prototype.compileStatic = function(req, filename) {

	if (!fs.existsSync(filename))
		return null;

	var self = this;
	var index = filename.lastIndexOf('.');
	var ext = filename.substring(index).toLowerCase();
	var output = fs.readFileSync(filename).toString(ENCODING);

	switch (ext) {
		case '.js':
			output = self.onCompileJS === null ? internal.compile_javascript(output, self) : self.onCompileJS(filename, output);
			break;
		case '.css':
			output = self.onCompileCSS === null ? internal.compile_less(output) : self.onCompileCSS(filename, output);

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

	self._verify_directory('temp');

	var fileComiled = utils.combine(self.config['directory-temp'], req.url.replace(/\//g, '-').substring(1));
	fs.writeFileSync(fileComiled, output);

	return fileComiled;
};

/*
	Serve static files
	@req {ServerRequest}
	@res {ServerResponse}
	return {Framework}
*/
Framework.prototype.responseStatic = function(req, res) {

	var self = this;

	if (res.success)
		return self;

	var name = req.url;
	var index = name.indexOf('?');

	if (index !== -1)
		name = name.substring(0, index);

	var filename = utils.combine(self.config['directory-public'], name);
	self.responseFile(req, res, filename, '');
	return self;
};

/*
	Response file
	@req {ServerRequest}
	@res {ServerResponse}
	@filename {String}
	@downloadName {String} :: optional
	@headers {Object} :: optional
	return {Framework}
*/
Framework.prototype.responseFile = function(req, res, filename, downloadName, headers) {

	var self = this;

	if (res.success)
		return self;

	req.clear(true);

	var name = self.temporary.path[filename];

	if (name === null) {
		self.response404(req, res);
		return self;
	}

	var etag = utils.etag(req.url, self.config['etag-version']);

	if (!self.config.debug) {
		if (req.headers['if-none-match'] === etag) {
			res.success = true;
			res.writeHead(304);
			res.end();
			return self;
		}
	}

	var extension = path.extname(filename).substring(1);

	if (self.config['static-accepts'].indexOf('.' + extension) === -1) {
		self.response404(req, res);
		return self;
	}

	if (typeof(name) === UNDEFINED) {

		if (!fs.existsSync(filename)) {
			self.temporary.path[filename] = null;
			self.response404(req, res);
			return self;
		}

		name = filename;

		// compile JavaScript and CSS
		if (['js', 'css'].indexOf(extension) !== -1) {
			if (name.indexOf('.min.') === -1 && name.indexOf('-min.') === -1) {
				name = self.compileStatic(req, name);
				self.temporary.path[filename] = name;
			}
		}

		self.temporary.path[filename] = name;

		if (self.config.debug)
			delete self.temporary.path[filename];
	}

	var compress = self.config['allow-gzip'] && ['js', 'css', 'txt'].indexOf(extension) !== -1;
	var accept = req.headers['accept-encoding'] || '';
	var returnHeaders = {};

	returnHeaders['Accept-Ranges'] = 'bytes';
	returnHeaders['Cache-Control'] = 'public';
	returnHeaders['Expires'] = new Date().add('d', 15);
	returnHeaders['Vary'] = 'Accept-Encoding';

	// možnosť odoslať vlastné hlavičky
	if (headers)
		utils.extend(returnHeaders, headers, true);

	downloadName = downloadName || '';

	if (downloadName.length > 0)
		returnHeaders['Content-Disposition'] = 'attachment; filename=' + downloadName;

	if (etag.length > 0)
		returnHeaders['Etag'] = etag;

	returnHeaders['Content-Type'] = utils.getContentType(extension);

	var range = req.headers['range'] || '';
	res.success = true;

	if (range.length > 0)
		return self.responseRange(name, range, returnHeaders, res);

	if (compress) {

		if (accept.indexOf('gzip') !== -1) {
			returnHeaders['Content-Encoding'] = 'gzip';
			res.writeHead(200, returnHeaders);
			var stream = fs.createReadStream(name).pipe(zlib.createGzip());
			stream.pipe(res);
			return self;
		}

		// IE problem
		if (accept.indexOf('deflate') !== -1) {
			returnHeaders['Content-Encoding'] = 'deflate';
			res.writeHead(200, returnHeaders);
			var stream = fs.createReadStream(name).pipe(zlib.createDeflate());
			stream.pipe(res);
			return self;
		}
	}

	res.writeHead(200, returnHeaders);
	var stream = fs.createReadStream(name);
	stream.pipe(res);
	return self;
};

/*
	Response stream
	@req {ServerRequest}
	@res {ServerResponse}
	@contentType {String}
	@stream {ReadStream}
	@downloadName {String} :: optional
	@headers {Object} :: optional
	return {Framework}
*/
Framework.prototype.responseStream = function(req, res, contentType, stream, downloadName, headers) {

	var self = this;

	if (res.success)
		return self;

	req.clear(true);

	if (contentType.indexOf('/') === -1)
		contentType = utils.getContentType(contentType);

	var compress = ['text/plain', 'text/javascript', 'text/css', 'application/x-javascript', 'text/html'].indexOf(contentType) !== -1;
	var accept = req.headers['accept-encoding'] || '';
	var returnHeaders = {};

	returnHeaders['Cache-Control'] = 'public';
	returnHeaders['Expires'] = new Date().add('d', 15);
	returnHeaders['Vary'] = 'Accept-Encoding';

	// možnosť odoslať vlastné hlavičky
	if (headers)
		utils.extend(returnHeaders, headers, true);

	downloadName = downloadName || '';

	if (downloadName.length > 0)
		returnHeaders['Content-Disposition'] = 'attachment; filename=' + downloadName;

	returnHeaders['Content-Type'] = contentType;

	if (compress) {

		if (accept.indexOf('gzip') !== -1) {
			returnHeaders['Content-Encoding'] = 'gzip';
			res.writeHead(200, returnHeaders);
			var gzip = zlib.createGzip();
			stream.pipe(gzip).pipe(res);
			return self;
		}

		// IE problem
		if (accept.indexOf('deflate') !== -1) {
			returnHeaders['Content-Encoding'] = 'deflate';
			res.writeHead(200, returnHeaders);
			var deflate = zlib.createDeflate();
			stream.pipe(deflate).pipe(res);
			return self;
		}
	}

	stream.on('error', function() {
		self.response404(req, res);
	});

	res.writeHead(200, returnHeaders);
	stream.pipe(res);
	return self;
};

/*
	Internal :: Response Range
	@name {String}
	@range {String}
	@headers {Object}
	@res {ServerResponse}
	return {Framework}
*/
Framework.prototype.responseRange = function(name, range, headers, res) {

	var self = this;
	var arr = range.replace(/bytes=/, '').split('-');
	var beg = parseInt(arr[0] || '0');
	var end = parseInt(arr[1] || '0');
	var total = self.temporary.range[name] || 0;

	if (total === 0) {
		// sync
		total = fs.statSync(name).size;
		self.temporary.range[name] = total;
	}

	if (end === 0)
		end = total - 1;

	if (beg > end) {
		beg = 0;
		end = total - 1;
	}

	var length = (end - beg) + 1;

	headers['Content-Length'] = length;
	headers['Content-Range'] = 'bytes ' + beg + '-' + end + '/' + total;

	res.writeHead(206, headers);
	var stream = fs.createReadStream(name, { start: beg, end: end });
	stream.pipe(res);
	return self;
};

/*
	Set last modified header or Etag
	@req {ServerRequest}
	@res {ServerResponse}
	@value {String or Date}

	if @value === {String} set ETag
	if @value === {Date} set LastModified

	return {Controller};
*/
Framework.prototype.setModified = function(req, res, value) {

	var self = this;
	var isEtag = typeof(value) === STRING;

	if (isEtag) {
		res.setHeader('Etag', value + ':' + self.config['etag-version']);
		return self;
	}

	value = value || new Date();
	res.setHeader('Last-Modified', value.toUTCString());

	return self;
};

/*
	Check if ETag or Last Modified has modified
	@req {ServerRequest}
	@res {ServerResponse}
	@compare {String or Date}
	@strict {Boolean} :: if strict then use equal date else use great then date (default: false)

	if @compare === {String} compare if-none-match
	if @compare === {Date} compare if-modified-since

	this method automatically flush response (if not modified)
	--> response 304

	return {Controller};
*/
Framework.prototype.notModified = function(req, res, compare, strict) {

	var self = this;
	var isEtag = typeof(compare) === STRING;

	var val = req.headers[isEtag ? 'if-none-match' : 'if-modified-since'];

	if (isEtag) {

		if (typeof(val) === UNDEFINED)
			return false;

		var myetag = compare + ':' + self.config['etag-version'];

		if (val !== myetag)
			return false;

	} else {

		if (typeof(val) === UNDEFINED)
			return false;

		var date = typeof(compare) === UNDEFINED ? new Date().toUTCString() : compare.toUTCString();


		if (strict)
 		{
			if (new Date(Date.parse(val)) === new Date(date))
				return false;
		} else {
			if (new Date(Date.parse(val)) < new Date(date))
				return false;
		}
	}

	res.success = true;
	res.writeHead(304);
	res.end();

	return true;
};

/*
	Response with 404 error
	@req {ServerRequest}
	@res {ServerResponse}
	return {Framework}
*/
Framework.prototype.response404 = function(req, res) {
	var self = this;

	if (res.success)
		return self;

	req.clear(true);

	res.success = true;
	res.writeHead(404, { 'Content-Type': 'text/plain' });
	res.end('File not found (404).');

	self.stats.response.error404++;
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
	return {Framework}
*/
Framework.prototype.responseContent = function(req, res, code, contentBody, contentType, compress, headers) {
	var self = this;

	if (res.success)
		return self;

	req.clear(true);
	res.success = true;

	var accept = req.headers['accept-encoding'] || '';
	var returnHeaders = {};

	returnHeaders['Cache-Control'] = 'private';
	returnHeaders['Vary'] = 'Accept-Encoding';

	// možnosť odoslať vlastné hlavičky
	if (headers)
		utils.extend(returnHeaders, headers, true);

	// Safari resolve
	if (contentType === 'application/json')
		returnHeaders['Cache-Control'] = 'no-cache';

	// pridáme UTF-8 do hlavičky
	if ((/text|application/).test(contentType))
		contentType += '; charset=utf-8';

	if (compress) {

		if (accept.indexOf('gzip') !== -1) {
			var buffer = new Buffer(contentBody);

			zlib.gzip(buffer, function(err, data) {

				if (err) {
					req.connection.destroy();
					return;
				}

				returnHeaders['Content-Type'] = contentType;
				returnHeaders['Content-Encoding'] = 'gzip';

				res.writeHead(code, returnHeaders);
				res.end(data, ENCODING);
			});

			return self;
		}

		// problém pri IE, deflate nefunguje
		if (accept.indexOf('deflate') !== -1) {
			var buffer = new Buffer(contentBody);

			zlib.deflate(buffer, function(err, data) {

				if (err) {
					req.connection.destroy();
					return;
				}

				returnHeaders['Content-Type'] = contentType;
				returnHeaders['Content-Encoding'] = 'deflate';

				res.writeHead(code, returnHeaders);
				res.end(data, ENCODING);
			});

			return self;
		}
	}

	returnHeaders['Content-Type'] = contentType;
	res.writeHead(code, returnHeaders);
	res.end(contentBody, ENCODING);
	return self;
};

/*
	Internal function
	@req {ServerRequest}
	@res {ServerResponse}
	@url {String}
	@permament {Boolean} :: optional
	return {Framework}
*/
Framework.prototype.responseRedirect = function(req, res, url, permament) {

	var self = this;

	if (res.success)
		return self;

	res.success = true;
	res.writeHead(permament ? 301 : 302, { 'Location': url });
	res.end();
	return self;
};

/*
	Initialization
	@http {HTTP or HTTPS}
	@config {Boolean or Object}
	@port {Number}
	return {Framework}
*/
Framework.prototype.init = function(http, config, port, ip) {

	var self = this;

	if (self.server !== null)
		return;

	if (typeof(config) === BOOLEAN)
		self.config.debug = config;
	else if (typeof(config) === OBJECT)
		utils.extend(self.config, config, true);

	self.configure();
	self.clear();
	self.cache.init();
	self.install();

	var module = self.module('#');
	if (module !== null) {
		Object.keys(module).forEach(function(o) {
			if (o === 'onLoad' || o === 'usage')
				return;
			self[o] = module[o];
		});
	}

	process.on('uncaughtException', function(e) {
		self.error(e, '', null);

		if (e.toString().indexOf('listen EADDRINUSE') !== -1) {
			if (typeof(process.send) === FUNCTION)
				process.send('stop');
			process.exit(0);
		}

	});

	process.on('SIGTERM', function() {
	    self.stop();
	});

	process.on('SIGINT', function() {
	    self.stop();
	});

	process.on('exit', function () {

		if (self.onExit)
			self.onExit(self);

		self.emit('exit');
	});

	process.on('message', function(msg) {

		if (msg === 'backup') {
			self.backup();
			return;
		}

		if (msg === 'reset') {
			self.clear();
			self.cache.clear();
			return;
		}

		if (msg === 'stop' || msg === 'exit') {
			self.stop();
			return;
		}

		if (msg.indexOf('restore') !== -1) {
			self.restore(msg.substring(7).trim());
			return;
		}
	});

    self.server = http.createServer(self.handlers.onrequest);

    if (self.config['allow-websocket'])
		self.server.on('upgrade', self.handlers.onupgrade);

	self.port = port || 8000;
	self.ip = ip || '127.0.0.1';
	self.server.listen(self.port, self.ip);

	if (module !== null) {
		if (typeof(module.onLoad) !== UNDEFINED) {
			try
			{
				module.onLoad.call(self, self);
			} catch (err) {
				self.error(err, '#.onLoad()');
			}
		}
	}

	try
	{
		self.emit('load', self);
	} catch (err) {
		self.error(err, 'framework.on("load")');
	}

	if (typeof(process.send) === FUNCTION)
		process.send('name: ' + self.config.name);

	return self;
};

// Alias for framework.init
Framework.prototype.run = function(http, config, port, ip) {
	return this.init(http, config, port, ip);
};

Framework.prototype._verify_directory = function(name) {

	var self = this;
	var prop = '$directory-' + name;

	if (self.temporary.path[prop])
		return self;

	var dir = self.config['directory-' + name];

	if (dir[0] !== '.')
		dir = '.' + dir;

	if (!fs.existsSync(dir))
		fs.mkdirSync(dir);

	self.temporary.path[prop] = true;
	return self;
};

Framework.prototype._upgrade = function(req, socket, head) {

    if (req.headers.upgrade !== 'websocket')
        return;

	var self = this;

	self.stats.request.websocket++;

    var socket = new WebSocketClient(req, socket, head);
    var path = utils.path(req.uri.pathname);
	var subdomain = req.uri.host.toLowerCase().split('.');

	req.subdomain = null;
   	req.path = internal.routeSplit(req.uri.pathname);

	if (subdomain.length > 2)
		req.subdomain = subdomain.slice(0, subdomain.length - 2);

    var route = self.lookup_websocket(req, socket.uri.pathname);
    if (route === null) {
    	socket.close();
    	return;
    }

    if (self.onAuthorization === null) {
	    self._upgrade_continue(route, req, socket, path);
    	return;
    }

	var logged = route.flags.indexOf('logged') !== -1;
	if (logged || route.flags.indexOf('unlogged')) {

		self.onAuthorization.call(self, req, socket, route.flags, function(isLogged) {

			if (logged && !isLogged) {
		    	socket.close();
				return;
			}

			if (!logged && isLogged) {
		    	socket.close();
				return;
			}

			self._upgrade_continue(route, req, socket, path);
		});

		return;
	}

	self._upgrade_continue(route, req, socket, path);
};

Framework.prototype._upgrade_continue = function(route, req, socket, path) {

	var self = this;

    if (!socket.prepare(route.flags, route.protocols, route.allow, route.length, self.version)) {
    	socket.close();
        return;
    }

    if (typeof(self.connections[path]) === UNDEFINED) {
    	var connection = new WebSocket(self, path, route.name);
        self.connections[path] = connection;
        route.onInitialize.call(connection, connection, self);
    }

    socket.upgrade(self.connections[path]);
};

Framework.prototype._service = function(count) {
	var self = this;

	if (count % 10 === 0) {
		self.emit('clear', 'stats', self.stats);
		self.stats.request.web = 0;
		self.stats.request.xhr = 0;
		self.stats.request.file = 0;
		self.stats.request.websocket = 0;
		self.stats.request.get = 0;
		self.stats.request.post = 0;
		self.stats.request.upload = 0;
		self.stats.request.xss = 0;
		self.stats.response.view = 0;
		self.stats.response.json = 0;
		self.stats.response.websocket = 0;
		self.stats.response.file = 0;
		self.stats.response.plain = 0;
		self.stats.response.empty = 0;
		self.stats.response.redirect = 0;
		self.stats.response.mmr = 0;
		self.stats.response.sse = 0;
		self.stats.response.error401 = 0;
		self.stats.response.error403 = 0;
		self.stats.response.error404 = 0;
		self.stats.response.error408 = 0;
		self.stats.response.error431 = 0;
		self.stats.response.error500 = 0;
	}

	if (self.config.debug)
		self.resources = {};

	// every 20 minute service clears resources and reconfigure framework
	if (count % 20 === 0) {
		self.emit('clear', 'resources');
		self.resources = {};
		// self.databases = {};
		self.configure();
	}

	// every 5 minute service clears static cache
	if (count % 5 === 0) {
		self.emit('clear', 'temporary', self.temporary);
		self.temporary.path = {};
		self.temporary.range = {};
	}

	self.emit('service', count);
};

Framework.prototype._request = function(req, res) {
	var self = this;

	res.setHeader('X-Powered-By', 'partial.js v' + self.version);

    if (self.config.debug)
    	res.setHeader('Mode', 'debug');

    res.success = false;

	req.data = { get: {}, post: {}, files: [] };
	req.buffer = { data: '', isExceeded: false, isData: false };
	req.isXHR = false;
	req.uri = {};
	req.ip = '';
	req.flags = [];
	req.session = {};
	req.prefix = '';
	req.subdomain = [];
	req.isAuthorized = true;

	var isXSS = false;
	var header = req.headers;
	var protocol = req.connection.encrypted ? 'https' : 'http';
	var accept = header['accept'];

	req.isProxy = header['x-proxy'] === 'partial.js';
   	req.host = header['host'];
   	req.uri = parser.parse(protocol + '://' + req.host + req.url);
   	req.path = internal.routeSplit(req.uri.pathname);

	var subdomain = req.uri.host.toLowerCase().split('.');

	if (subdomain.length > 2)
		req.subdomain = subdomain.slice(0, subdomain.length - 2); // example: [subdomain].domain.com

	var proxy = header['x-forwarded-for'];

	//  x-forwarded-for: client, proxy1, proxy2, ...
	if (typeof(proxy) !== UNDEFINED)
		req.ip = proxy.split(',', 1)[0] || req.connection.remoteAddress;
	else
		req.ip = req.connection.remoteAddress;

   	// if is static file, return file
   	if (utils.isStaticFile(req.uri.pathname)) {
		new Subscribe(self, req, res).file();
		self.stats.request.file++;
		return;
	}

	self.stats.request.web++;

   	if (req.uri.query && req.uri.query.length > 0) {
   		if (self.onXSS !== null)
   			isXSS = self.onXSS(req.uri.query);

   		req.data.get = qs.parse(req.uri.query);
   	}

	if (self.onRoute !== null) {
		try
		{
			if (!self.onRoute(req, res)) {

				if (!res.success)
					req.connection.destroy();

				return;
			}
		} catch(err) {
			self.app.error(err, 'framework.onRoute()', req.uri);
		}
	}

	var flags = [req.method.toLowerCase()];
    var multipart = req.headers['content-type'] || '';

    if (multipart.indexOf('multipart/form-data') === -1) {
    	if (multipart.indexOf('mixed') === -1)
    		multipart = '';
    	else
    		flags.push('mmr');
    }

    if (req.isProxy)
    	flags.push('proxy');

    if (accept === 'text/event-stream')
    	flags.push('sse');

	flags.push(protocol);

	if (self.config.debug)
		flags.push('debug');

	req.isXHR = header['x-requested-with'] === 'XMLHttpRequest';
	req.prefix = self.onPrefix === null ? '' : self.onPrefix(req) || '';

	if (req.prefix.length > 0)
		flags.push('#' + req.prefix);

	if (multipart.length > 0)
		flags.push('upload');

	if (req.isXHR) {
		self.stats.request.xhr++;
		flags.push('+xhr');
		flags.push('xhr');
	} else
		flags.push('+xhr');

	if (isXSS) {
		flags.push('xss');
		self.stats.request.xss++;
	}

	req.flags = flags;

	// call event request
	self.emit('request', req, res);

   	if (req.method === 'POST' || req.method === 'PUT') {
   		if (multipart.length > 0) {
   			self.stats.request.upload++;
   			new Subscribe(self, req, res).multipart(multipart);
   			return;
   		} else {
   			self.stats.request.post++;
   			new Subscribe(self, req, res).urlencoded();
   			return;
   		}
   	} else
   		self.stats.request.get++;

	new Subscribe(self, req, res).end();
};

/*
	Test request to controller

	@url {String}
	@callback {Functions} :: function(error, data, statusCode, headers);
	@method {String} :: default GET
	@data {String} :: default empty string
	@headers {Object} :: optional
	@xhr {Boolean} :: optional

	return {Framework}
*/
Framework.prototype.assert = function(name, url, callback, method, data, headers, xhr) {

	var self = this;

	if (typeof(headers) === BOOLEAN) {
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

	return {Framework}
*/
Framework.prototype.testing = function(stop, callback) {

	if (typeof(stop) === UNDEFINED)
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

			setTimeout(function() {
				self.stop();
			}, 500);

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

	if (typeof(names) === FUNCTION) {
		cb = names;
		names = [];
	} else
		names = names || [];

	fs.readdirSync('.' + self.config['directory-tests']).forEach(function(name) {

		var fileName = path.join(directory, self.config['directory-tests'], name);

		if (path.extname(fileName).toLowerCase() !== '.js')
			return;

		if (names.length > 0 && names.indexOf(name.substring(0, name.length - 3)) === -1)
			return;

		var test = require(fileName);

		try
		{
			var isRun = typeof(test.run) !== UNDEFINED;
			var isInit = typeof(test.init) !== UNDEFINED;
			var isLoad = typeof(test.load) !== UNDEFINED;

			if (isRun)
				test.run(self, name);
			else if (isInit)
				test.init(self, name);
			else if (isLoad)
				test.load(self, name);

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
	return {Framework}
*/
Framework.prototype.clear = function() {

	var self = this;
	var dir = utils.combine(self.config['directory-temp']);

	if (!fs.existsSync(dir))
		return self;

	fs.readdir(dir, function(err, files) {

		if (err)
			return;

		files.forEach(function(file) {
			var fileName = utils.combine(self.config['directory-temp'], file);
			fs.unlink(fileName);
    	});
	});

	// clear static cache
	self.temporary.path = {};
	self.temporary.range = {};
	return self;
};

/*
	Cryptography (encode)
	@value {String}
	@key {String}
	@isUniqe {Boolean} :: optional, default true
	return {Framework}
*/
Framework.prototype.encode = function(value, key, isUnique) {

	var self = this;
	var type = typeof(value);

	if (type === UNDEFINED)
		return '';

	if (type === FUNCTION)
		value = value();

	if (type === NUMBER)
		value = value.toString();

	if (type === OBJECT)
		value = JSON.stringify(value);

	return value.encode(self.config.secret + '=' + key, isUnique || true);
};

/*
	Cryptography (decode)
	@value {String}
	@key {String}
	@jsonConvert {Boolean} :: optional (convert string to JSON)
	return {String or Object}
*/
Framework.prototype.decode = function(value, key, jsonConvert) {

	jsonConvert = jsonConvert || true;

	var self = this;
	var result = (value || '').decode(self.config.secret + '=' + key);

	if (jsonConvert && result.isJSON())
		return JSON.parse(result);

	return result;
};

/*
	Resource reader
	@name {String} :: filename of resource
	@key {String}
	return {String}
*/
Framework.prototype.resource = function(name, key) {

	if (typeof(key) === UNDEFINED || name.length === 0) {
		key = name;
		name = 'default';
	}

	var self = this;
	var res = self.resources[name];

	if (typeof(res) !== UNDEFINED)
		return res[key];

	var fileName = utils.combine(self.config['directory-resources'], name + '.resource');
	var obj = {};

	if (!fs.existsSync(fileName))
		return '';

	var arr = fs.readFileSync(fileName).toString(ENCODING).split('\n');
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
	return obj[key] || '';
};

/*
	Configuration from file
	return {Framework}
*/
Framework.prototype.configure = function() {

	var self = this;
	var fileName = utils.combine('/', 'config-' + (self.config.debug ? 'debug' : 'release'));

	if (!fs.existsSync(fileName))
		return self;

	var obj = {};
	var arr = fs.readFileSync(fileName).toString(ENCODING).split('\n');
	var accepts = null;

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
			case 'default-request-length':
			case 'default-websocket-request-length':
			case 'default-request-timeout':
				obj[name] = utils.parseInt(value);
				break;
			case 'static-accepts-custom':
				accepts = value.replace(/\s/g, '').split(',');
				break;
			case 'static-accepts':
				obj[name] = value.replace(/\s/g, '').split(',');
				break;
			case 'allow-gzip':
			case 'allow-websocket':
				obj[name] = value.toLowerCase() == 'true' || value === '1';
			case 'version':
				obj[name] = value;
				break;
			default:
				obj[name] = value.isNumber() ? utils.parseInt(value) : value.isNumber(true) ? utils.parseFloat(value) : value;
				break;
		}
	}

	utils.extend(self.config, obj, true);

	if (self.config['etag-version'] === '')
		self.config['etag-version'] = self.config.version.replace(/\.|\s/g, '');

	process.title = self.config.name.removeDiacritics().toLowerCase().replace(/\s/g, '-');

	if (accepts !== null && accepts.length > 0) {
		accepts.forEach(function(accept) {
			if (self.config['static-accepts'].indexOf(accept) === -1)
				self.config['static-accepts'].push(accept);
		});
	}

	return self;
};

/*
	Verification
	@cb {Function} :: param @errors {String array}
	return {Framework}
*/
Framework.prototype.verification = function(cb) {

	var self = this;

	if (typeof(self.verify) === UNDEFINED) {
		self.configure();
		self.verify = null;
	}

	if (self.verify !== null) {

		if (self.verify.length > 0) {
			var test = self.verify.shift();
			test();
			return self;
		}

		if (self.verify.length === 0) {
			self.verify = null;
			cb.call(this, self.verifyError);
			return self;
		}

		return self;
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

		if (!fs.existsSync('.' + self.config['directory-controllers']))
			self.verifyError.push('DirectoryNotFound: ' + self.config['directory-controllers']);

		if (!fs.existsSync('.' + self.config['directory-views']))
			self.verifyError.push('DirectoryNotFound: ' + self.config['directory-views']);

		if (!fs.existsSync('.' + self.config['directory-contents']))
			self.verifyError.push('DirectoryNotFound: ' + self.config['directory-contents']);

		if (!fs.existsSync('.' + self.config['directory-temp']))
			self.verifyError.push('DirectoryNotFound: ' + self.config['directory-temp']);

		if (!fs.existsSync('.' + self.config['directory-templates']))
			self.verifyError.push('DirectoryNotFound: ' + self.config['directory-templates']);

		if (!fs.existsSync('.' + self.config['directory-resources']))
			self.verifyError.push('DirectoryNotFound: ' + self.config['directory-resources']);

		if (!fs.existsSync('.' + self.config['directory-public']))
			self.verifyError.push('DirectoryNotFound: ' + self.config['directory-public']);

		if (!fs.existsSync('.' + self.config['directory-modules']))
			self.verifyError.push('DirectoryNotFound: ' + self.config['directory-modules']);

		if (!fs.existsSync('.' + self.config['directory-databases']))
			self.verifyError.push('DirectoryNotFound: ' + self.config['directory-databases']);

		if (!fs.existsSync('.' + self.config['directory-logs']))
			self.verifyError.push('DirectoryNotFound: ' + self.config['directory-logs']);

		self.verification.call(self, cb);
	});

	self.verify.push(function() {
		var filename = self.path.temp('verify.tmp');
		try
		{
			fs.writeFileSync(filename, 'OK');
			fs.readFileSync(filename);
			fs.unlinkSync(filename);
		} catch (ex) {
			self.verifyError.push('Writing/Readings files: ' + ex.toString());
		}
		self.verification.call(self, cb);
	});

	self.verify.push(function() {
		var exec = require('child_process').exec;

		exec('gm', function(error, stdout, stderr) {

			if (stderr.length !== 0)
				self.verifyError.push('GraphicsMagickError: ' + stderr);

			self.verification.call(self, cb);
		});
	});

	self.verify.push(function () {
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
	return {String}
*/
Framework.prototype.routeJS = function(name) {
	var self = this;

	if (name.indexOf('.js') === -1)
		name += '.js';

	return self._routeStatic(name, self.config['static-url-js']);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Framework.prototype.routeCSS = function(name) {
	var self = this;

	if (name.indexOf('.css') === -1)
		name += '.css';

	return self._routeStatic(name, self.config['static-url-css']);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Framework.prototype.routeImage = function(name) {
	var self = this;
	return self._routeStatic(name, self.config['static-url-image']);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Framework.prototype.routeVideo = function(name) {
	var self = this;
	return self._routeStatic(name, self.config['static-url-video']);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Framework.prototype.routeFont = function(name) {
	var self = this;
	return self._routeStatic(name, self.config['static-url-font']);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Framework.prototype.routeUpload = function(name) {
	var self = this;
	return self._routeStatic(name, self.config['static-url-upload']);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Framework.prototype.routeStatic = function(name) {
	var self = this;
	return self._routeStatic(name, self.config['static-url']);
};

/*
	Internal static file routing
	@name {String} :: filename
	@directory {String} :: directory
	return {String}
*/
Framework.prototype._routeStatic = function(name, directory) {
	var self = this;
	var fileName = self.onVersion === null ? name : self.onVersion(name) || name;
	return directory + fileName;
};

/*
	Internal function
	@req {HttpRequest}
	@url {String}
	@flags {String Array}
	@noLoggedUnlogged {Boolean} :: optional, default false
	return {ControllerRoute}
*/
Framework.prototype.lookup = function(req, url, flags, noLoggedUnlogged) {

	var self = this;
	var isSystem = url[0] === '#';

	if (isSystem)
		req.path = [url];

	var subdomain = req.subdomain === null ? null : req.subdomain.join('.');
	var length = self.routes.web.length;

	for (var i = 0; i < length; i++) {

		var route = self.routes.web[i];

		if (!internal.routeCompareSubdomain(subdomain, route.subdomain))
			continue;

		if (!internal.routeCompare(req.path, route.url, isSystem))
			continue;

		if (isSystem)
			return route;

		if (route.flags !== null && route.flags.length > 0) {

			var result = internal.routeCompareFlags(flags, route.flags, noLoggedUnlogged);

			if (result === -1)
				req.isAuthorized = false;

			if (result < 1)
				continue;

		} else {

			if (flags.indexOf('xss') !== -1)
				continue;
		}

		return route;
	}

	return null;
};

/*
	Internal function
	@req {HttpRequest}
	@url {String}
	return {WebSocketRoute}
*/
Framework.prototype.lookup_websocket = function(req, url) {

	var self = this;
	var subdomain = req.subdomain === null ? null : req.subdomain.join('.');
	var length = self.routes.websockets.length;

	for (var i = 0; i < length; i++) {

		var route = self.routes.websockets[i];

		if (!internal.routeCompareSubdomain(subdomain, route.subdomain))
			continue;

		if (!internal.routeCompare(req.path, route.url, false))
			continue;

		return route;
	}

	return null;
};

// *********************************************************************************
// =================================================================================
// Framework File System
// 1.01
// =================================================================================
// *********************************************************************************

function FrameworkFileSystem(framework) {

	this.framework = framework;
	this.config = framework.config;

	this.create = {
		css: this.createCSS,
		js: this.createJS,
		view: this.createView,
		content: this.createContent,
		template: this.createTemplate,
		resource: this.createResource,
		file: this.createFile
	};

	this.rm = {
		css: this.deleteCSS,
		js: this.deleteJS,
		view: this.deleteView,
		content: this.deleteContent,
		template: this.deleteTemplate,
		resource: this.deleteResource,
		file: this.deleteFile
	};
};

/*
	Delete a file - CSS
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteCSS = function(name) {
	var self = this;

	if (name.indexOf('.css') === -1)
		name += '.css';

	var filename = utils.combine(self.config['directory-public'], self.config['static-url-css'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - JS
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteJS = function(name) {
	var self = this;

	if (name.indexOf('.js') === -1)
		name += '.js';

	var filename = utils.combine(self.config['directory-public'], self.config['static-url-js'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - View
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteView = function(name) {
	var self = this;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var filename = utils.combine(self.config['directory-views'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - Content
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteContent = function(name) {
	var self = this;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var filename = utils.combine(self.config['directory-contents'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - Template
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteTemplate = function(name) {
	var self = this;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var filename = utils.combine(self.config['directory-templates'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - Resource
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteResource = function(name) {
	var self = this;

	if (name.indexOf('.resource') === -1)
		name += '.resource';

	var filename = utils.combine(self.config['directory-resources'], name);
	return self.deleteFile(filename);
};

/*
	Internal :: Delete a file
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteFile = function(filename) {
	var self = this;

	if (!fs.existsSync(filename))
		return false;

	fs.unlink(filename);
	return true;
};

/*
	Create a file with the CSS
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

	var filename = utils.combine(self.config['directory-public'], self.config['static-url-css'], name);
	return self.createFile(filename, content, append, rewrite);
};

/*
	Create a file with the JavaScript
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
FrameworkFileSystem.prototype.createJS = function(name, content, rewrite, append) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.js') === -1)
		name += '.js';

	var filename = utils.combine(self.config['directory-public'], self.config['static-url-js'], name);
	return self.createFile(filename, content, append, rewrite);
};

/*
	Create a file with the template
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
FrameworkFileSystem.prototype.createTemplate = function(name, content, rewrite, append) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var filename = utils.combine(self.config['directory-templates'], name);
	return self.createFile(filename, content, append, rewrite);
};

/*
	Create a file with the view
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
FrameworkFileSystem.prototype.createView = function(name, content, rewrite, append) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var filename = utils.combine(self.config['directory-views'], name);
	return self.createFile(filename, content, append, rewrite);
};

/*
	Create a file with the content
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
FrameworkFileSystem.prototype.createContent = function(name, content, rewrite, append) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.html') === -1)
		name += '.html';

	var filename = utils.combine(self.config['directory-contents'], name);
	return self.createFile(filename, content, append, rewrite);
};

/*
	Create a file with the resource
	@name {String}
	@content {String or Object}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
FrameworkFileSystem.prototype.createResource = function(name, content, rewrite, append) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	if (name.indexOf('.resource') === -1)
		name += '.resource';

	var builder = content;

	if (typeof(content) === OBJECT) {
		builder = '';
		Object.keys(content).forEach(function(o) {
			builder += o.padRight(20, ' ') + ': ' + content[o] + '\n';
		});
	}

	var filename = utils.combine(self.config['directory-resources'], name);
	return self.createFile(filename, builder, append, rewrite);
};

/*
	Internal :: Create a file with the content
	@filename {String}
	@content {String}
	@append {Boolean}
	@rewrite {Boolean}
	return {Boolean}
*/
FrameworkFileSystem.prototype.createFile = function(filename, content, append, rewrite) {

	var self = this;

	if ((content || '').length === 0)
		return false;

	var exists = fs.existsSync(filename);

	if (exists && append)
	{
		var data = fs.readFileSync(filename).toString(ENCODING);

		if (data.indexOf(content) === -1) {
			fs.appendFileSync(filename, '\n' + content);
			return true;
		}

		return false;
	}

	if (exists && !rewrite)
		return false;

	fs.writeFileSync(filename, content, ENCODING);
	return true;
};

// *********************************************************************************
// =================================================================================
// Framework path
// =================================================================================
// *********************************************************************************

function FrameworkPath(framework) {
	this.framework = framework;
	this.config = framework.config;
};

/*
	@filename {String} :: optional
	return {String}
*/
FrameworkPath.prototype.public = function(filename) {
	var self = this;
	self.framework._verify_directory('public');
	return utils.combine(self.config['directory-public'], filename || '').replace(/\\/g, '/');
};

/*
	@filename {String} :: optional
	return {String}
*/
FrameworkPath.prototype.logs = function(filename) {
	var self = this;
	self.framework._verify_directory('logs');
	return utils.combine(self.config['directory-logs'], filename || '').replace(/\\/g, '/');
};

/*
	@filename {String} :: optional
	return {String}
*/
FrameworkPath.prototype.temp = function(filename) {
	var self = this;
	self.framework._verify_directory('temp');
	return utils.combine(self.config['directory-temp'], filename || '').replace(/\\/g, '/');
};

/*
	@filename {String} :: optional
	return {String}
*/
FrameworkPath.prototype.backup = function(filename) {
	var self = this;
	self.framework._verify_directory('backup');
	return utils.combine(self.config['directory-backup'], filename || '').replace(/\\/g, '/');
};

/*
	@filename {String} :: optional
	return {String}
*/
FrameworkPath.prototype.root = function(filename) {
	return utils.combine(directory, filename || '');
};

// *********************************************************************************
// =================================================================================
// Cache declaration
// =================================================================================
// *********************************************************************************

/*
	Cache class
	@framework {Framework}
*/
function FrameworkCache(framework) {
	this.repository = {};
	this.framework = framework;
	this.count = 1;
	this.interval = null;
};

FrameworkCache.prototype = new events.EventEmitter;

/*
	Cache init
	return {Cache}
*/
FrameworkCache.prototype.init = function(interval) {
	var self = this;

	self.interval = setInterval(function() {
		self.recycle();
	}, interval || 1000 * 60);

	return self;
};

FrameworkCache.prototype.stop = function() {
	var self = this;
	clearTimeout(self.interval);
	return self;
};

FrameworkCache.prototype.clear = function() {
	var self = this;
	self.repository = {};
	return self;
};

/*
	Internal function
	return {Cache}
*/
FrameworkCache.prototype.recycle = function() {

	var self = this;
	var repository = self.repository;
	var keys = Object.keys(repository);
	var length = keys.length;

	if (length === 0) {
		self.emit('service', self.count++);
		return self;
	}

	var expire = new Date();

	for (var i = 0; i < length; i++) {
		var o = keys[i];
		var value = repository[o];
		if (value.expire < expire) {
			self.framework.emit('expire', o, value.value);
			delete repository[o];
		}
	}

	self.emit('service', self.count++);
	return self;
};

/*
	Add item to cache
	@name {String}
	@value {Object}
	@expire {Date}
	return @value
*/
FrameworkCache.prototype.write = function(name, value, expire) {
	var self = this;

	if (typeof(expire) === UNDEFINED)
		expire = new Date().add('m', 5);

	self.repository[name] = { value: value, expire: expire };
	return value;
};

/*
	Read item from cache
	@name {String}
	return {Object}
*/
FrameworkCache.prototype.read = function(name) {
	var self = this;
	var value = self.repository[name] || null;

	if (value === null)
		return null;

	return value.value;
};

/*
	Update cache item expiration
	@name {String}
	@expire {Date}
	return {Cache}
*/
FrameworkCache.prototype.setExpires = function(name, expire) {
	var self = this;
	var obj = self.repository[name];

	if (typeof(obj) === UNDEFINED)
		return self;

	obj.expire = expire;
	return self;
};

/*
	Remove item from cache
	@name {String}
	return {Object} :: return value;
*/
FrameworkCache.prototype.remove = function(name) {
	var self = this;
	var value = self.repository[name] || null;

	delete self.repository[name];
	return value;
};

/*
	Remove all
	@search {String}
	return {Number}
*/
FrameworkCache.prototype.removeAll = function(search) {
	var self = this;
	var count = 0;

	Object.keys(self.repository).forEach(function(o) {
		if (o.indexOf(search) !== -1) {
			self.remove(o);
			count++;
		}
	});

	return count;
};

/*
	Cache function value
	@name {String}
	@fnCache {Function} :: params, @value {Object}, @expire {Date}
	@fnCallback {Function} :: params, @value {Object}
	return {Cache}
*/
FrameworkCache.prototype.fn = function(name, fnCache, fnCallback) {

	var self = this;
	var value = self.read(name);

	if (value !== null) {
		fnCallback(value);
		return self;
	}

	fnCache(function(value, expire) {
		self.write(name, value, expire);
		fnCallback(value);
	});

	return self;
};

// *********************************************************************************
// =================================================================================
// Framework.Subscribe
// =================================================================================
// *********************************************************************************

var REPOSITORY_HEAD = '$head';
var REPOSITORY_META = '$meta';
var REPOSITORY_META_TITLE = '$title';
var REPOSITORY_META_DESCRIPTION = '$description';
var REPOSITORY_META_KEYWORDS = '$keywords';
var ATTR_END = '"';

function Subscribe(framework, req, res) {
	this.framework = framework;

	this.handlers = {
		_authorization: this._authorization.bind(this),
		_end: this._end.bind(this),
		_endfile: this._endfile.bind(this),
		_parsepost: this._parsepost.bind(this),
		_execute: this._execute.bind(this),
		_cancel: this._cancel.bind(this)
	};

	this.controller = null;
	this.req = req;
	this.res = res;
	this.route = null;
	this.timeout = null;
	this.isCanceled = false;
	this.isMixed = false;
	this.header = '';
};

Subscribe.prototype.success = function() {
	var self = this;
	clearTimeout(self.timeout);
	self.timeout = null;
	self.isCanceled = true;
};

Subscribe.prototype.file = function() {
	var self = this;
	self.req.on('end', self.handlers._endfile);
	self.req.resume();
};

/*
	@header {String} :: Content-Type
*/
Subscribe.prototype.multipart = function(header) {

	var self = this;
	self.route = self.framework.lookup(self.req, self.req.uri.pathname, self.req.flags, true);
	self.header = header;

	if (self.route === null) {
		self.req.connection.destroy();
		return;
	}

	if (header.indexOf('mixed') === -1) {
		internal.parseMULTIPART(self.req, header, self.route.maximumSize, self.framework.config['directory-temp'], self.framework.handlers.onxss, self.handlers._end);
		return;
	}

	self.isMixed = true;
	self.execute();
};

Subscribe.prototype.urlencoded = function() {

	var self = this;
	self.route = self.framework.lookup(self.req, self.req.uri.pathname, self.req.flags, true);

	if (self.route === null) {
		self.req.clear(true);
		self.req.connection.destroy();
		return;
	}

	self.req.buffer.isData = true;
	self.req.buffer.isExceeded = false;
	self.req.on('data', self.handlers._parsepost);
	self.end();
};

Subscribe.prototype.end = function() {
	var self = this;
	self.req.on('end', self.handlers._end);
	self.req.resume();
};

/*
	@status {Number} :: HTTP status
*/
Subscribe.prototype.execute = function(status) {

	var self = this;

	if (status > 400 && (self.route === null || self.route.name[0] === '#')) {
		if (status === 401)
			self.framework.stats.response.error401++;
		else if (status === 403)
			self.framework.stats.response.error403++;
		else if (status === 404)
			self.framework.stats.response.error404++;
		else if (status === 408)
			self.framework.stats.response.error408++;
		else if (status === 431)
			self.framework.stats.response.error431++;
		else if (status === 500)
			self.framework.stats.response.error500++;
	}

	if (self.route === null) {
		self.framework.responseContent(self.req, self.res, status || 404, utils.httpStatus(status || 404), 'text/plain', true);
		return self;
	}

	var name = self.route.name;
	self.controller = new Controller(name, self.req, self.res, self);

	if (!self.isCanceled && !self.isMixed)
		self.timeout = setTimeout(self.handlers._cancel, self.route.timeout);

	var lengthPrivate = self.route.partial.length;
	var lengthGlobal = self.framework.routes.partialGlobal.length;

	if (lengthPrivate === 0 && lengthGlobal === 0) {
		self.handlers._execute();
		return self;
	}

	var async = new utils.Async();
	var count = 0;

	for (var i = 0; i < lengthGlobal; i++) {
		var partial = self.framework.routes.partialGlobal[i];
		async.await('global' + i, partial.bind(self.controller));
	}

	for (var i = 0; i < lengthPrivate; i++) {
		var partialName = self.route.partial[i];
		var partialFn = self.framework.routes.partial[partialName];
		if (partialFn) {
			count++;
			async.await(partialName, partialFn.bind(self.controller));
		}
	}

	if (count === 0 && lengthGlobal === 0)
		self.handlers._execute();
	else
		async.complete(self.handlers._execute);

	return self;
};

/*
	@flags {String Array}
	@url {String}
*/
Subscribe.prototype.prepare = function(flags, url) {

	var self = this;

	if (self.framework.onAuthorization !== null) {
		self.framework.onAuthorization(self.req, self.res, flags, self.handlers._authorization);
		return;
	}

	if (self.route === null)
		self.route = self.framework.lookup(self.req, self.req.buffer.isExceeded ? '#431' : url || self.req.uri.pathname, flags);

	if (self.route === null)
		self.route = self.framework.lookup(self.req, '#404', []);

	self.execute(self.req.buffer.isExceeded ? 431 : 404);
};

Subscribe.prototype._execute = function() {

	var self = this;
	var name = self.route.name;

	self.controller.isCanceled = false;

	try
	{
		self.framework.emit('controller', self.controller, name);

		var isModule = name[0] === '#' && name[1] === 'm';
		var o = isModule ? self.framework.modules[name.substring(8)] : self.framework.controllers[name];

		if (o.onRequest)
			o.onRequest.call(self.controller, self.controller);

	} catch (err) {
		self.framework.error(err, name, self.req.uri);
	}

	try
	{

		if (self.controller.isCanceled)
			return;

		if (!self.isMixed) {
			self.route.onExecute.apply(self.controller, internal.routeParam(self.req.path, self.route));
			return;
		}

		internal.parseMULTIPART_MIXED(self.req, self.header, self.framework.config['directory-temp'], function(file) {
			self.route.onExecute.call(self.controller, file);
		}, self.handlers._end);

	} catch (err) {
		self.controller = null;
		self.framework.error(err, name, self.req.uri);
		self.route = self.framework.lookup(self.req, '#500', []);
		self.execute(500);
	}
};

/*
	@isLogged {Boolean}
*/
Subscribe.prototype._authorization = function(isLogged) {
	var self = this;

	self.req.flags.push(isLogged ? 'logged' : 'unlogged');
	self.route = self.framework.lookup(self.req, self.req.buffer.isExceeded ? '#431' : self.req.uri.pathname, self.req.flags);

	if (self.route === null)
		self.route = self.framework.lookup(self.req, '#401', []);

	self.execute(self.req.buffer.isExceeded ? 431 : 404);
};

Subscribe.prototype._end = function() {

	var self = this;

	if (self.isMixed) {
		self.req.clear(true);
		self.res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'cache-control': 'private, max-age=0' });
		self.res.end('END');
		return;
	}

	if (self.req.buffer.isExceeded) {
		self.req.clear(true);
		self.req.connection.destroy();
		return;
	}

	if (self.req.buffer.data.length === 0) {
		self.prepare(self.req.flags, self.req.uri.pathname);
		return;
	}

	if (self.route.flags.indexOf('json') !== -1) {

		try
		{
			self.req.data.post = self.req.buffer.data.isJSON() ? JSON.parse(self.req.buffer.data) : null;
			self.req.buffer.data = null;
		} catch (err) {
			self.req.data.post = null;
		}

	} else {

		if (self.framework.onXSS !== null && self.framework.onXSS(self.req.buffer.data)) {
			if (self.req.flags.indexOf('xss') === -1) {
				self.req.flags.push('xss');
				self.route = null;
			}
		}

		self.req.data.post = qs.parse(self.req.buffer.data);
		self.req.buffer.data = null;
	}

	self.prepare(self.req.flags, self.req.uri.pathname);
};

Subscribe.prototype._endfile = function() {

	var self = this;
	var files = self.framework.routes.files;
	var length = files.length;

	if (length === 0) {
		self.framework.onStatic(self.req, self.res);
		return;
	}

	for (var i = 0; i < length; i++) {
		var file = files[i];
		try
		{

			if (file.onValidation.call(self.framework, self.req, self.res)) {
				file.onExecute.call(self.framework, self.req, self.res);
				return;
			}

		} catch (err) {
			self.framework.error(err, file.controller + ' :: ' + file.name, self.req.uri);
			self.framework.responseContent(self.req, self.res, 500, '500 - internal servere error', 'text/plain', true);
			return;
		}
	}

	self.framework.onStatic(self.req, self.res);
};

Subscribe.prototype._parsepost = function(chunk) {

	var self = this;

	if (self.req.buffer.isExceeded)
		return;

	if (!self.req.buffer.isExceeded)
		self.req.buffer.data += chunk.toString();

	if (self.req.buffer.data.length < self.route.maximumSize)
		return;

	self.req.buffer.isExceeded = true;
	self.req.buffer.data = '';
};

Subscribe.prototype._cancel = function() {
	var self = this;

	clearTimeout(self.timeout);
	self.timeout = null;

	if (self.controller === null)
		return;

	self.controller.isCanceled = true;
	self.route = self.framework.lookup(self.req, '#408', []);
	self.execute(408);
};

// *********************************************************************************
// =================================================================================
// Framework.Controller
// =================================================================================
// *********************************************************************************

/*
	Controller class
	@name {String}
	@req {ServerRequest}
	@res {ServerResponse}
	@substribe {Object}
	return {Controller};
*/
function Controller(name, req, res, subscribe) {

	this.subscribe = subscribe;
	this.name = name;
	this.cache = subscribe.framework.cache;
	this.app = subscribe.framework;
	this.framework = subscribe.framework;
	this.req = req;
	this.res = res;
	this.session = req.session;
	this.get = req.data.get;
	this.post = req.data.post;
	this.files = req.data.files;
	this.xhr = req.isXHR;
	this.config = subscribe.framework.config;

	// controller.internal.type === 0 - classic
	// controller.internal.type === 1 - server sent events
	// controller.internal.type === 2 - multipart/x-mixed-replace

	this.internal = { layout: subscribe.framework.config['default-layout'], contentType: 'text/html', boundary: null, type: 0 };
	this.statusCode = 200;
	this.controllers = subscribe.framework.controllers;
	this.url = utils.path(req.uri.pathname);

	this.isXHR = req.isXHR;
	this.isProxy = req.isProxy;
	this.isLayout = false;
	this.isTest = req.headers['assertion-testing'] === '1';
	this.isDebug = subscribe.framework.config.debug;
	this.isCanceled = false;
	this.isConnected = true;

	this.global = subscribe.framework.global;
	this.flags = req.flags;

	this.lastEventID = req.headers['last-event-id'] || null;

	this.repository = {};
	this.model = null;

	// render output
	this.output = '';
	this.prefix = req.prefix;

	if (typeof(this.prefix) === UNDEFINED || this.prefix.length === 0)
		this.prefix = '';
	else
		this.prefix = this.prefix;

	this.path = subscribe.framework.path;
	this.fs = subscribe.framework.fs;
	this.async = new utils.Async(this);

	var self = this;
	req.on('close', function() { self.isConnected = false; });

	this._currentImage = '';
	this._currentUpload = '';
	this._currentVideo = '';
	this._currentJS = '';
	this._currentCSS = '';
};

// ======================================================
// PROTOTYPES
// ======================================================

/*
	Validation / alias for validate
	@model {Object}
	@properties {String Array}
	@prefix {String} :: optional - prefix in a resource
	@name {String} :: optional - a resource name
	return {ErrorBuilder}
*/
Controller.prototype.validation = function(model, properties, prefix, name) {
	return this.validate(model, properties, prefix, name);
};

Controller.prototype.validate = function(model, properties, prefix, name) {

	var self = this;

	var resource = function(key) {
		return self.resource(name || 'default', (prefix || '') + key);
	};

	var error = new builders.ErrorBuilder(resource);
	return utils.validate.call(self, model, properties, self.app.onValidation, error);
};

/*
	Set response header
	@name {String}
	@value {String}
	return {Controller}
*/
Controller.prototype.header = function(name, value) {
	var self = this;
	self.res.setHeader(name, value);
	return self;
};

/*
	Cross-origin resource sharing
	@allow {String Array}
	@method {String Array} :: optional, default null
	@header {String Array} :: optional, default null
	@credentials {Boolean} :: optional, default false
	return {Boolean}
*/
Controller.prototype.cors = function(allow, method, header, credentials) {

	var self = this;
	var origin = self.req.headers['origin'];

	if (typeof(origin) === UNDEFINED)
		return true;

	if (typeof(allow) === UNDEFINED)
		allow = '*';

	if (typeof(method) === BOOLEAN) {
		credentials = method;
		method = null;
	}

	if (typeof(header) === BOOLEAN) {
		credentials = header;
		header = null;
	}

	if (!utils.isArray(allow))
		allow = [allow];

	var isAllowed = false;
	var isAll = false;

	if (header) {

		if (!utils.isArray(header))
			header = [header];

		for (var i = 0; i < header.length; i++) {
			if (self.req.headers[header[i].toLowerCase()]) {
				isAllowed = true;
				break;
			}
		}

		if (!isAllowed)
			return false;

		isAllowed = false;
	}

	if (method) {

		if (!utils.isArray(method))
			method = [method];

		for (var i = 0; i < method.length; i++) {

			var value = method[i].toUpperCase();
			method[i] = value;

			if (value === self.req.method)
				isAllowed = true;
		}

		if (!isAllowed)
			return false;

		isAllowed = false;
	}

	for (var i = 0; i < allow.length; i++) {

		var value = allow[i];

		if (value === '*' || origin.indexOf(value) !== -1) {
			isAll = value === '*';
			isAllowed = true;
			break;
		}

	}

	if (!isAllowed)
		return false;

	self.res.setHeader('Access-Control-Allow-Origin', isAll ? '*' : origin);

	if (credentials)
		self.res.setHeader('Access-Control-Allow-Credentials', 'true');

	if (method)
		self.res.setHeader('Access-Control-Allow-Methods', method.join(', '));

	if (header)
		self.res.setHeader('Access-Control-Allow-Headers', header.join(', '));

	return true;
};

/*
	Error
	@err {Error}
	return {Framework}
*/
Controller.prototype.error = function(err) {
	var self = this;
	self.framework.error(typeof(err) === STRING ? new Error(err) : err, self.name, self.uri);
	return self;
};

/*
	Add function to async wait list
	@name {String}
	@waitingFor {String} :: name of async function
	@fn {Function}
	return {Controller}
*/
Controller.prototype.wait = function(name, waitingFor, fn) {
	var self = this;
	self.async.wait(name, waitingFor, fn);
	return self;
};

/*
	Run async functions
	@callback {Function}
	return {Controller}
*/
Controller.prototype.complete = function(callback) {
	var self = this;
	return self.complete(callback);
};

/*
	Add function to async list
	@name {String}
	@fn {Function}
	return {Controller}
*/
Controller.prototype.await = function(name, fn) {
	var self = this;
	self.async.await(name, fn);
	return self;
};

/*
	Cancel execute controller function
	Note: you can cancel controller function execute in on('controller') or controller.onRequest();

	return {Controller}
*/
Controller.prototype.cancel = function() {
	var self = this;
	self.isCanceled = true;
	return self;
};

/*
	Log
	@arguments {Object array}
	return {Controller};
*/
Controller.prototype.log = function() {
	var self = this;
	self.app.log.apply(self.app, arguments);
	return self;
};

/*
	META Tags for views
	@arguments {String array}
	return {Controller};
*/
Controller.prototype.meta = function() {
	var self = this;
	self.repository[REPOSITORY_META_TITLE] = arguments[0] || '';
	self.repository[REPOSITORY_META_DESCRIPTION] = arguments[1] || '';
	self.repository[REPOSITORY_META_KEYWORDS] = arguments[2] || '';
	self.repository[REPOSITORY_META] = self.app.onMeta.apply(this, arguments);
	return self;
};

/*
	Sitemap generator
	@name {String}
	@url {String}
	@index {Number}
	return {Controller};
*/
Controller.prototype.sitemap = function(name, url, index) {
	var self = this;

	if (typeof(name) === UNDEFINED)
		return self.repository.sitemap || [];

	if (typeof(url) === UNDEFINED)
		url = self.req.url;

	if (typeof(self.repository.sitemap) === UNDEFINED)
		self.repository.sitemap = [];

	self.repository.sitemap.push({ name: name, url: url, index: index || self.repository.sitemap.length });

	if (typeof(index) !== UNDEFINED && self.sitemap.length > 1) {
		self.repository.sitemap.sort(function(a, b) {
			if (a.index < b.index)
				return -1;
			if (a.index > b.index)
				return 1;
			return 0;
		});
	}

	return self;
};

/*
	Settings for views
	@arguments {String array}
	return {Controller};
*/
Controller.prototype.settings = function() {
	var self = this;
	self.repository['$settings'] = self.app.onSettings.apply(this, arguments);
	return self;
};

/*
	Module caller
	@name {String}
	return {Module};
*/
Controller.prototype.module = function(name) {
	return this.app.module(name);
};

/*
	Layout setter
	@name {String} :: layout filename
	return {Controller};
*/
Controller.prototype.layout = function(name) {
	var self = this;
	self.internal.layout = name;
	return self;
};

/*
	Controller models reader
	@name {String} :: name of controller
	return {Object};
*/
Controller.prototype.models = function(name) {
	var self = this;
	return (self.controllers[name] || {}).models;
};

/*
	Controller functions reader
	@name {String} :: name of controller
	return {Object};
*/
Controller.prototype.functions = function(name) {
	var self = this;
	return (self.controllers[name] || {}).functions;
};

/*
	Check if ETag or Last Modified has modified
	@compare {String or Date}
	@strict {Boolean} :: if strict then use equal date else use great then date (default: false)

	if @compare === {String} compare if-none-match
	if @compare === {Date} compare if-modified-since

	return {Controller};
*/
Controller.prototype.notModified = function(compare, strict) {
	var self = this;
	return self.app.notModified(self.req, self.res, compare, strict);
};

/*
	Set last modified header or Etag
	@value {String or Date}

	if @value === {String} set ETag
	if @value === {Date} set LastModified

	return {Controller};
*/
Controller.prototype.setModified = function(value) {
	var self = this;
	self.app.setModified(self.req, self.res, value);
	return self;
};

/*
	Set Expires header
	@date {Date}

	return {Controller};
*/
Controller.prototype.setExpires = function(date) {
	var self = this;

	if (typeof(date) === UNDEFINED)
		return self;

	self.res.setHeader('Expires', date.toUTCString());
	return self;
};

/*
	Internal function for views
	@name {String} :: filename
	@model {Object}
	return {String}
*/
Controller.prototype.$view = function(name, model) {
	return this.$viewToggle(true, name, model);
};

/*
	Internal function for views
	@visible {Boolean}
	@name {String} :: filename
	@model {Object}
	return {String}
*/
Controller.prototype.$viewToggle = function(visible, name, model) {
	if (!visible)
		return '';
	return this.view(name, model, null, true);
};

/*
	Internal function for views
	@name {String} :: filename
	return {String}
*/
Controller.prototype.$content = function(name) {
	return this.$contentToggle(true, name);
};

/*
	Internal function for views
	@visible {Boolean}
	@name {String} :: filename
	return {String}
*/
Controller.prototype.$contentToggle = function(visible, name) {

	var self = this;

	if (!visible)
		return '';

	return internal.generateContent(self, name) || '';
};

Controller.prototype.$url = function(host) {
	var self = this;
	return host ? self.req.hostname(self.url) : self.url;
};

/*
	Internal function for views
	@name {String} :: filename
	@model {Object} :: must be an array
	@nameEmpty {String} :: optional filename from contents
	@repository {Object} :: optional
	return {Controller};
*/
Controller.prototype.$template = function(name, model, nameEmpty, repository) {
	var self = this;
	return self.$templateToggle(true, name, model, nameEmpty, repository);
};

/*
	Internal function for views
	@bool {Boolean}
	@name {String} :: filename
	@model {Object}
	@nameEmpty {String} :: optional filename from contents
	@repository {Object} :: optional
	return {Controller};
*/
Controller.prototype.$templateToggle = function(visible, name, model, nameEmpty, repository) {
	var self = this;

	if (!visible)
		return '';

	return self.template(name, model, nameEmpty, repository);
};

/*
	Internal function for views
	@name {String}
	return {String}
*/
Controller.prototype.$checked = function(bool, charBeg, charEnd) {
	var self = this;
	return self.$isValue(bool, charBeg, charEnd, 'checked="checked"');
};

/*
	Internal function for views
	@bool {Boolean}
	@charBeg {String}
	@charEnd {String}
	return {String}
*/
Controller.prototype.$disabled = function(bool, charBeg, charEnd) {
	var self = this;
	return self.$isValue(bool, charBeg, charEnd, 'disabled="disabled"');
};

/*
	Internal function for views
	@bool {Boolean}
	@charBeg {String}
	@charEnd {String}
	return {String}
*/
Controller.prototype.$selected = function(bool, charBeg, charEnd) {
	var self = this;
	return self.$isValue(bool, charBeg, charEnd, 'selected="selected"');
};

/*
	Internal function for views
	@bool {Boolean}
	@charBeg {String}
	@charEnd {String}
	return {String}
*/
Controller.prototype.$readonly = function(bool, charBeg, charEnd) {
	var self = this;
	return self.$isValue(bool, charBeg, charEnd, 'readonly="readonly"');
};

/*
	Internal function for views
	@name {String}
	@value {String}
	return {String}
*/
Controller.prototype.$header = function(name, value) {
	this.header(name, value);
	return '';
};

/*
	Internal function for views
	@model {Object}
	@name {String}
	@attr {Object} :: optional
	return {String}
*/
Controller.prototype.$text = function(model, name, attr) {
	return this.$input(model, 'text', name, attr);
};

/*
	Internal function for views
	@model {Object}
	@name {String} :: optional
	@attr {Object} :: optional
	return {String}
*/
Controller.prototype.$password = function(model, name, attr) {
	return this.$input(model, 'password', name, attr);
};

/*
	Internal function for views
	@model {Object}
	@name {String}
	@attr {Object} :: optional
	return {String}
*/
Controller.prototype.$hidden = function(model, name, attr) {
	return this.$input(model, 'hidden', name, attr);
};

/*
	Internal function for views
	@model {Object}
	@name {String}
	@attr {Object} :: optional
	return {String}
*/
Controller.prototype.$radio = function(model, name, value, attr) {

	if (typeof(attr) === STRING)
		attr = { label: attr };

	attr.value = value;
	return this.$input(model, 'radio', name, attr);
};

/*
	Internal function for views
	@model {Object}
	@name {String}
	@attr {Object} :: optional
	return {String}
*/
Controller.prototype.$checkbox = function(model, name, attr) {

	if (typeof(attr) === STRING)
		attr = { label: attr };

	return this.$input(model, 'checkbox', name, attr);
};

/*
	Internal function for views
	@model {Object}
	@name {String}
	@attr {Object} :: optional
	return {String}
*/
Controller.prototype.$textarea = function(model, name, attr) {

	var builder = '<textarea';

	if (typeof(attr) !== OBJECT)
		attr = {};

	builder += ' name="' + name + '" id="' + (attr.id || name) + ATTR_END;

	if (attr.class)
		builder += ' class="' + attr.class + ATTR_END;

	if (attr.maxlength > 0)
		builder += ' maxlength="'+ attr.maxlength + ATTR_END;

	if (attr.required === true)
		builder += ' required="required"';

	if (attr.disabled === true)
		builder += ' disabled="disabled"';

	if (attr.cols > 0)
		builder += ' cols="' + attr.cols + ATTR_END;

	if (attr.rows > 0)
		builder += ' rows="' + attr.rows + ATTR_END;

	if (attr.style)
		builder += ' style="' + attr.style + ATTR_END;

	if (attr.pattern)
		builder += ' pattern="' + pattern + ATTR_END;

	if (typeof(model) === UNDEFINED)
		return builder + '></textarea>';

	var value = (model[name] || attr.value) || '';
	return builder + '>' + value.toString().htmlEncode() + '</textarea>';
};

/*
	Internal function for views
	@model {Object}
	@type {String}
	@name {String}
	@attr {Object} :: optional
	return {String}
*/
Controller.prototype.$input = function(model, type, name, attr) {

	var builder = ['<input'];

	if (typeof(attr) !== OBJECT)
		attr = {};

	var val = attr.value || '';

	builder += ' type="' + type + ATTR_END;

	if (type === 'radio')
		builder += ' name="' + name + ATTR_END;
	else
		builder += ' name="' + name + '" id="' + (attr.id || name) + ATTR_END;

	if (attr.class)
		builder += ' class="' + attr.class + ATTR_END;

	if (attr.style)
		builder += ' style="' + attr.style + ATTR_END;

	if (attr.maxlength)
		builder += ' maxlength="' + attr.maxlength + ATTR_END;

	if (attr.max)
		builder += ' max="' + attr.max + ATTR_END;

	if (attr.step)
		builder += ' step="' + attr.step + ATTR_END;

	if (attr.min)
		builder += ' min="' + attr.min + ATTR_END;

	if (attr.readonly === true)
		builder += ' readonly="readonly"';

	if (attr.placeholder)
		builder += ' placeholder="' + (attr.placeholder || '').toString().htmlEncode() + ATTR_END;

	if (attr.autofocus === true)
		builder += ' autofocus="autofocus"';

	if (attr.list)
		builder += ' list="' + attr.list + ATTR_END;

	if (attr.required === true)
		builder += ' required="required"';

	if (attr.disabled === true)
		builder += ' disabled="disabled"';

	if (attr.pattern && attr.pattern.length > 0)
		builder += ' pattern="' + attr.pattern + ATTR_END;

	if (attr.autocomplete) {
		if (attr.autocomplete === true || attr.autocomplete === 'on')
			builder += ' autocomplete="on"';
		else
			builder += ' autocomplete="off"';
	}

	var value = '';

	if (typeof(model) !== UNDEFINED) {
		value = model[name];

		if (type === 'checkbox') {
			if (value === '1' || value === 'true' || value === true)
				builder += ' checked="checked"';

			value = val || '1';
		}

		if (type === 'radio') {

			val = (val || '').toString();

			if (value.toString() === val)
				builder += ' checked="checked"';

			value = val || '';
		}
	}

	if (typeof(value) !== UNDEFINED)
		builder += ' value="' + value.toString().htmlEncode() + ATTR_END;
	else
		builder += ' value="' + (attr.value || '').toString().htmlEncode() + ATTR_END;

	builder += ' />';

	if (attr.label)
		return '<label>' + builder + ' <span>' + attr.label + '</span></label>';

	return builder;
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.$dns = function(value) {

	var builder = '';

	for (var i = 0; i < arguments.length; i++)
		builder += '<link rel="dns-prefetch" href="' + (arguments[i] || '') + '" />';

	this.head(builder);
	return '';
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.$prefetch = function() {

	var builder = '';

	for (var i = 0; i < arguments.length; i++)
		builder += '<link rel="prefetch" href="' + (arguments[i] || '') + '" />';

	this.head(builder);
	return '';
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.$prerender = function(value) {

	var builder = '';

	for (var i = 0; i < arguments.length; i++)
		builder += '<link rel="prerender" href="' + (arguments[i] || '') + '" />';

	this.head(builder);
	return '';
};

/*
	Internal function for views
	@value {String}
	return {String}
*/
Controller.prototype.$next = function(value) {
	this.head('<link rel="next" href="' + (value || '') + '" />');
	return '';
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.$prev = function(value) {
	this.head('<link rel="prev" href="' + (value || '') + '" />');
	return '';
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.$canonical = function(value) {
	this.head('<link rel="canonical" href="' + (value || '') + '" />');
	return '';
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.head = function() {

	var self = this;

	if (arguments.length === 0)
		return self.repository[REPOSITORY_HEAD] || '';

	var output = '';

	for (var i = 0; i < arguments.length; i++) {

		var val = arguments[i];

		if (val.indexOf('<') === -1) {
			if (val.indexOf('.js') !== -1)
				output += '<script type="text/javascript" src="' + val + '"></script>';
			else if (val.indexOf('.css') !== -1)
				output += '<link type="text/css" rel="stylesheet" href="' + val + '" />';
		} else
			output += val;
	}

	var header = (self.repository[REPOSITORY_HEAD] || '') + output;
	self.repository[REPOSITORY_HEAD] = header;
	return '';
};

/*
	Internal function for views
	@bool {Boolean}
	@charBeg {String}
	@charEnd {String}
	@value {String}
	return {String}
*/
Controller.prototype.$isValue = function(bool, charBeg, charEnd, value) {
	if (!bool)
		return '';

	charBeg = charBeg || ' ';
	charEnd = charEnd || '';

	return charBeg + value + charEnd;
};

/*
	Internal function for views
	@date {String or Date or Number} :: if {String} date format must has YYYY-MM-DD HH:MM:SS, {Number} represent Ticks (.getTime())
	return {String} :: empty string
*/
Controller.prototype.$modified = function(value) {

	var self = this;
	var type = typeof(value);
	var date;

	if (type === NUMBER) {
		date = new Date(value);
	} else if (type === STRING) {

		var d = value.split(' ');

		var date = d[0].split('-');
		var time = (d[1] || '').split(':');

		var year = utils.parseInt(date[0] || '');
		var month = utils.parseInt(date[1] || '') - 1;
		var day = utils.parseInt(date[2] || '') - 1;

		if (month < 0)
			month = 0;

		if (day < 0)
			day = 0;

		var hour = utils.parseInt(time[0] || '');
		var minute = utils.parseInt(time[1] || '');
		var second = utils.parseInt(time[2] || '');

		date = new Date(year, month, day, hour, minute, second, 0);
	} else if (utils.isDate(value))
		date = value;

	if (typeof(date) === UNDEFINED)
		return '';

	self.setModified(date);
	return '';
};

/*
	Internal function for views
	@value {String}
	return {String} :: empty string
*/
Controller.prototype.$etag = function(value) {
	this.setModified(value);
	return '';
};

/*
	Internal function for views
	@arr {Array} :: array of object or plain value array
	@selected {Object} :: value for selecting item
	@name {String} :: name of name property, default: name
	@value {String} :: name of value property, default: value
	return {String}
*/
Controller.prototype.$options = function(arr, selected, name, value) {
	var self = this;

	if (arr === null || typeof(arr) === UNDEFINED)
		return '';

	if (!utils.isArray(arr))
		arr = [arr];

	selected = selected || '';

	var options = '';

	if (typeof(value) === UNDEFINED)
		value = value || name || 'value';

	if (typeof(name) === UNDEFINED)
		name = name || 'name';

	var isSelected = false;
	for (var i = 0; i < arr.length; i++) {
		var o = arr[i];
		var type = typeof(o);
		var text = '';
		var val = '';
		var sel = false;

		if (type === OBJECT) {

			text = (o[name] || '');
			val = (o[value] || '');

			if (typeof(text) === FUNCTION)
				text = text(i);

			if (typeof(val) === FUNCTION)
				val = val(i, text);

		} else {
			text = o;
			val = o;
		}

		if (!isSelected) {
			sel = val == selected;
			isSelected = sel;
		}

		options += '<option value="' + val.toString().htmlEncode() + '"'+ (sel ? ' selected="selected"' : '') + '>' + text.toString().htmlEncode() + '</option>';
	}

	return options;
};

/*
	Append <script> TAG
	@name {String} :: filename
	return {String}
*/
Controller.prototype.$script = function(name) {
	return this.routeJS(name, true);
};

Controller.prototype.$js = function(name) {
	return this.routeJS(name, true);
};

/*
	Appedn style <link> TAG
	@name {String} :: filename
	return {String}
*/
Controller.prototype.$css = function(name) {
	return this.routeCSS(name, true);
};

/*
	Append <img> TAG
	@name {String} :: filename
	@width {Number} :: optional
	@height {Number} :: optional
	@alt {String} :: optional
	@className {String} :: optional
	return {String}
*/
Controller.prototype.$image = function(name, width, height, alt, className) {

	var style = '';

	if (typeof(width) === OBJECT) {
		height = width.height;
		alt = width.alt;
		className = width.class;
		style = width.style;
		width = width.width;
	}

	var builder = '<img src="' + this.routeImage(name) + ATTR_END;

	if (width > 0)
		builder += ' width="' + width + ATTR_END;

	if (height > 0)
		builder += ' height="' + height + ATTR_END;

	if (alt)
		builder += ' alt="' + alt.htmlEncode() + ATTR_END;

	if (className)
		builder += ' class="' + className + ATTR_END;

	if (style)
		builder += ' style="' + style + ATTR_END;

	return builder + ' border="0" />';
};

/*
	Append <a> TAG
	@filename {String}
	@innerHTML {String}
	@downloadName {String}
	@className {String} :: optional
	return {String}
*/
Controller.prototype.$download = function(filename, innerHTML, downloadName, className) {
	var builder = '<a href="' + this.app.routeUpload(filename) + ATTR_END;

	if (downloadName)
		builder += ' download="' + downloadName + ATTR_END;

	if (className)
		builder += ' class="' + className + ATTR_END;

	return builder + '>' + (innerHTML || filename) + '</a>';
};

/*
	Append <script> TAG
	return {String}
*/
Controller.prototype.$json = function(obj, name) {

	if (!name)
		return JSON.stringify(obj);

	return '<script type="application/json" id="' + name + '">' + JSON.stringify(obj) + '</script>';
};

/*
	Append favicon TAG
	@name {String} :: filename
	return {String}
*/
Controller.prototype.$favicon = function(name) {
	var self = this;
	var contentType = 'image/x-icon';

	if (typeof(name) === UNDEFINED)
		name = 'favicon.ico';

	if (name.indexOf('.png') !== -1)
		contentType = 'image/png';

	if (name.indexOf('.gif') !== -1)
		contentType = 'image/gif';

	name = self.app.routeStatic('/' + name)

	return '<link rel="shortcut icon" href="' + name + '" type="' + contentType + '" /><link rel="icon" href="' + name + '" type="' + contentType + '" />';
};

/*
	Static file routing
	@name {String} :: filename
	@tag {Boolean} :: optional, append tag? default: false
	return {String}
*/
Controller.prototype.routeJS = function(name, tag) {
	var self = this;

	if (typeof(name) === UNDEFINED)
		name = 'default.js';

	return tag ? '<script type="text/javascript" src="' + self.app.routeJS(self._currentJS + name) + '"></script>' : self.app.routeJS(self._currentJS + name);
};

/*
	Static file routing
	@name {String} :: filename
	@tag {Boolean} :: optional, append tag? default: false
	return {String}
*/
Controller.prototype.routeCSS = function(name, tag) {
	var self = this;

	if (typeof(name) === UNDEFINED)
		name = 'default.css';

	return tag ? '<link type="text/css" rel="stylesheet" href="' + self.app.routeCSS(self._currentCSS + name) + '" />' : self.app.routeCSS(self._currentCSS + name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Controller.prototype.routeImage = function(name) {
	var self = this;
	return self.app.routeImage(self._currentImage + name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Controller.prototype.routeVideo = function(name) {
	var self = this;
	return self.app.routeVideo(self._currentVideo + name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Controller.prototype.routeFont = function(name) {
	var self = this;
	return self.app.routeFont(name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Controller.prototype.routeUpload = function(name) {
	var self = this;
	return self.app.routeUpload(self._currentUpload + name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Controller.prototype.routeStatic = function(name) {
	var self = this;
	return self.app.routeStatic(name);
};

/*
	Internal
	@path {String} :: add path to route path
	return {String}
*/
Controller.prototype.$currentJS = function(path) {
	this._currentJS = path.length > 0 ? utils.path(path) : '';
	return '';
};

/*
	Internal
	@path {String} :: add path to route path
	return {String}
*/
Controller.prototype.$currentCSS = function(path) {
	this._currentCSS = path.length > 0 ? utils.path(path) : '';
	return '';
};

/*
	Internal
	@path {String} :: add path to route path
	return {String}
*/
Controller.prototype.$currentImage = function(path) {
	this._currentImage = path.length > 0 ? utils.path(path) : '';
	return '';
};

/*
	Internal
	@path {String} :: add path to route path
	return {String}
*/
Controller.prototype.$currentVideo = function(path) {
	this._currentVideo = path.length > 0 ? utils.path(path) : '';
	return '';
};

/*
	Internal
	@path {String} :: add path to route path
	return {String}
*/
Controller.prototype.$currentUpload = function(path) {
	this._currentUpload = path.length > 0 ? utils.path(path) : '';
	return '';
};

/*
	Set current image path
	@path {String}
	return {Controller}
*/
Controller.prototype.currentImage = function(path) {
	var self = this;
	self.$currentImage(path);
	self._defaultImage = self._currentImage;
	return self;
};

/*
	Set current upload path
	@path {String}
	return {Controller}
*/
Controller.prototype.currentUpload = function(path) {
	var self = this;
	self.$currentUpload(path);
	self._defaultUpload = self._currentUpload;
	return self;
};

/*
	Set current CSS path
	@path {String}
	return {Controller}
*/
Controller.prototype.currentCSS = function(path) {
	var self = this;
	self.$currentCSS(path);
	self._defaultCSS = self._currentCSS;
	return self;
};

/*
	Set current JS path
	@path {String}
	return {Controller}
*/
Controller.prototype.currentJS = function(path) {
	var self = this;
	self.$currentJS(path);
	self._defaultJS = self._currentJS;
	return self;
};

/*
	Set current video path
	@path {String}
	return {Controller}
*/
Controller.prototype.currentVideo = function(path) {
	var self = this;
	self.$currentVideo(path);
	self._defaultVideo = self._currentVideo;
	return self;
};

/*
	Resource reader
	@name {String} :: filename
	@key {String}
	return {String}
*/
Controller.prototype.resource = function(name, key) {
	var self = this;
	return self.app.resource(name, key);
};

/*
	Render template to string
	@name {String} :: filename
	@model {Object}
	@nameEmpty {String} :: filename for empty Contents
	@repository {Object}
	@cb {Function} :: callback(string)
	return {String}
*/
Controller.prototype.template = function(name, model, nameEmpty, repository) {

	var self = this;

	if (self.res.success)
		return '';

	if (typeof(nameEmpty) === OBJECT) {
		repository = nameEmpty;
		nameEmpty = '';
	}

	if (typeof(model) === UNDEFINED || model === null || model.length === 0) {

		if (typeof(nameEmpty) !== UNDEFINED && nameEmpty.length > 0)
			return self.$content(nameEmpty);

		return '';
	}

	return internal.generateTemplate(self, name, model, repository);
};

/*
	Response JSON
	@obj {Object}
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.json = function(obj, headers) {
	var self = this;

	if (self.res.success || !self.isConnected)
		return self;

	if (obj instanceof builders.ErrorBuilder)
		obj = obj.json();
	else
		obj = JSON.stringify(obj || {});

	self.subscribe.success();
	self.framework.responseContent(self.req, self.res, self.statusCode, obj, 'application/json', true, headers);
	self.framework.stats.response.json++;

	return self;
};

/*
	Response JSON ASYNC
	@obj {Object}
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.jsonAsync = function(obj, headers) {
	var self = this;

	var fn = function() {
		self.json(obj, headers);
	};

	self.async.complete(fn);
	return self;
};

/*
	!!! pell-mell
	Response custom content or Return content from Contents
	@contentBody {String}
	@contentType {String} :: optional
	@headers {Object} :: optional
	return {Controller or String}; :: return String when contentType is undefined
*/
Controller.prototype.content = function(contentBody, contentType, headers) {
	var self = this;

	if (typeof(contentType) === UNDEFINED)
		return self.$contentToggle(true, contentBody);

	if (self.res.success || !self.isConnected)
		return self;

	self.subscribe.success();
	self.framework.responseContent(self.req, self.res, self.statusCode, contentBody, contentType || 'text/plain', true, headers);
	return self;
};

/*
	Response raw content
	@contentType {String}
	@onWrite {Function} :: function(fn) { fn.write('CONTENT'); }
	@headers {Object}
	return {Controller};
*/
Controller.prototype.raw = function(contentType, onWrite, headers) {

	var self = this;
	var res = self.res;

	if (self.res.success || !self.isConnected)
		return self;

	self.subscribe.success();
	var returnHeaders = {};

	returnHeaders['Cache-Control'] = 'private';

	if (headers)
		utils.extend(returnHeaders, headers, true);

	if (contentType === null)
		contentType = 'text/plain';

	if ((/text|application/).test(contentType))
		contentType += '; charset=utf-8';

	returnHeaders['Content-Type'] = contentType;

	res.success = true;
	res.writeHead(self.statusCode, returnHeaders);

	onWrite(function(chunk, ENCODING) {
		res.write(chunk, ENCODING || 'utf8');
	});

	res.end();
	return self;
};

/*
	Response plain text
	@contentBody {String}
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.plain = function(contentBody, headers) {
	var self = this;

	if (self.res.success || !self.isConnected)
		return self;

	self.subscribe.success();
	self.framework.responseContent(self.req, self.res, self.statusCode, typeof(contentBody) === STRING ? contentBody : contentBody.toString(), 'text/plain', true, headers);
	self.framework.stats.response.plain++;

	return self;
};

/*
	Response empty content
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.empty = function(headers) {
	var self = this;

	if (self.res.success || !self.isConnected)
		return self;

	self.subscribe.success();
	self.framework.responseContent(self.req, self.res, self.statusCode, '', 'text/plain', false, headers);
	self.framework.stats.response.empty++;

	return self;
};

/*
	Response file
	@filename {String}
	@downloadName {String} :: optional
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.file = function(filename, downloadName, headers) {
	var self = this;

	if (self.res.success || !self.isConnected)
		return self;

	filename = utils.combine(self.framework.config['directory-public'], filename);

	self.subscribe.success();
	self.framework.responseFile(self.req, self.res, filename, downloadName, headers);
	self.framework.stats.response.file++;

	return self;
};

/*
	Response Async file
	@filename {String}
	@downloadName {String} :: optional
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.fileAsync = function(filename, downloadName, headers) {
	var self = this;

	var fn = function() {
		self.file(filename, downloadName, headers);
	};

	self.async.complete(fn);
	return self;
};

/*
	Response stream
	@contentType {String}
	@stream {ReadStream}
	@downloadName {String} :: optional
	@headers {Object} :: optional key/value
	return {Controller}
*/
Controller.prototype.stream = function(contentType, stream, downloadName, headers) {
	var self = this;

	if (self.res.success || !self.isConnected)
		return self;

	self.subscribe.success();
	self.framework.responseStream(self.req, self.res, contentType, stream, downloadName, headers);
	return self;
};

/*
	Response 404
	return {Controller};
*/
Controller.prototype.view404 = function() {
	var self = this;

	if (self.res.success || !self.isConnected)
		return self;

	self.req.path = [];
	self.subscribe.success();
	self.subscribe.route = self.framework.lookup(self.req, '#404', []);
	self.subscribe.execute(404);
	return self;
};

/*
	Response 401
	return {Controller};
*/
Controller.prototype.view401 = function() {
	var self = this;

	if (self.res.success || !self.isConnected)
		return self;

	self.req.path = [];
	self.subscribe.success();
	self.subscribe.route = self.framework.lookup(self.req, '#401', []);
	self.subscribe.execute(401);
	return self;
};

/*
	Response 403
	return {Controller};
*/
Controller.prototype.view403 = function() {
	var self = this;

	if (self.res.success || !self.isConnected)
		return self;

	self.req.path = [];
	self.subscribe.success();
	self.subscribe.route = self.framework.lookup(self.req, '#403', []);
	self.subscribe.execute(403);
	return self;
};

/*
	Response 500
	@error {String}
	return {Controller};
*/
Controller.prototype.view500 = function(error) {
	var self = this;

	if (self.res.success || !self.isConnected)
		return self;

	self.req.path = [];
	self.framework.error(new Error(error), self.name, self.req.uri);
	self.subscribe.success();
	self.subscribe.route = self.framework.lookup(self.req, '#500', []);
	self.subscribe.execute(500);
	return self;
};

/*
	Response redirect
	@url {String}
	@permament {Boolean} :: optional default false
	return {Controller};
*/
Controller.prototype.redirect = function(url, permament) {
	var self = this;

	if (self.res.success || !self.isConnected)
		return self;

	self.subscribe.success();
	self.res.success = true;
	self.res.writeHead(permament ? 301 : 302, { 'Location': url });
	self.res.end();
	self.framework.stats.response.redirect++;

	return self;
};

/*
	Response Async View
	@name {String}
	@model {Object} :: optional
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.redirectAsync = function(url, permament) {
	var self = this;

	var fn = function() {
		self.redirect(url, permament);
	};

	self.async.complete(fn);
	return self;
};

/*
	Basic access authentication (baa)
	@name {String} :: optional, default Administration
	return {Object} :: if null then user is not authenticated else return { name: {String}, password: {String} };
*/
Controller.prototype.baa = function(name) {

	var self = this;
	var authorization = self.req.headers['authorization'] || '';

	if (authorization === '') {
		self.res.setHeader('WWW-Authenticate', 'Basic realm="' + (name || 'Administration') + '"');
		self.view401();
		return null;
	}

	var arr = new Buffer(authorization.replace('Basic ', '').trim(), 'base64').toString('utf8').split(':');
	return { name: arr[0] || '', password: arr[1] || '' };
};

/*
	Response Async View
	@name {String}
	@model {Object} :: optional
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.viewAsync = function(name, model, headers) {
	var self = this;

	var fn = function() {
		self.view(name, model, headers);
	};

	self.async.complete(fn);
	return self;
};

/*
	Send data via [S]erver-[s]ent [e]vents
	@data {String or Object}
	@eventname {String} :: optional
	@id {String} :: optional
	@retry {Number} :: optional, reconnection in milliseconds
	return {Controller};
*/
Controller.prototype.sse = function(data, eventname, id, retry) {

	var self = this;
	var res = self.res;

	if (!self.isConnected)
		return self;

	if (self.internal.type === 0 && res.success)
		throw new Error('Response was sent.');

	if (self.internal.type > 0 && self.internal.type !== 1)
		throw new Error('Response was used.');

	if (self.internal.type === 0) {

		self.internal.type = 1;

		if (typeof(retry) === UNDEFINED)
			retry = self.subscribe.route.timeout;

		self.subscribe.success();
		res.success = true;
		res.writeHead(self.statusCode, { 'Content-type': 'text/event-stream', 'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate', 'Pragma': 'no-cache' });
	}

	if (typeof(data) === OBJECT)
		data = JSON.stringify(data);
	else
		data = data.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

	var newline = '\n';
	var builder = '';

	if (eventname && eventname.length > 0)
		builder = 'event: ' + eventname + newline;

	builder += 'data: ' + data + newline;

	if (id && id.toString().length > 0)
		builder += 'id: ' + id + newline;

	if (retry && retry > 0)
		builder += 'retry: ' + retry + newline;

	builder += newline;
	res.write(builder);
	self.framework.stats.response.sse++;

	return self;
};

/*
	Send a file or stream via [m]ultipart/x-[m]ixed-[r]eplace
	@filename {String}
	@contentType {String}
	@{stream} {Stream} :: optional, if undefined then framework reads by the filename file from disk
	@cb {Function} :: callback if stream is sent
	return {Controller}
*/
Controller.prototype.mmr = function(filename, stream, cb) {

	var self = this;
	var res = self.res;

	if (!self.isConnected)
		return self;

	if (self.internal.type === 0 && res.success)
		throw new Error('Response was sent.');

	if (self.internal.type > 0 && self.internal.type !== 2)
		throw new Error('Response was used.');

	if (self.internal.type === 0) {
		self.internal.type = 2;
		self.internal.boundary = '----partialjs' + utils.GUID(10);
		self.subscribe.success();
		res.success = true;
		res.writeHead(self.statusCode, { 'Content-type': 'multipart/x-mixed-replace; boundary=' + self.internal.boundary, 'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate', 'Pragma': 'no-cache' });
	}

	var type = typeof(stream);

	if (type === FUNCTION) {
		cb = stream;
		stream = null;
	}

	res.write('--' + self.internal.boundary + '\r\nContent-Type: ' + utils.getContentType(path.extname(filename)) + '\r\n\r\n');

	if (typeof(stream) !== UNDEFINED && stream !== null) {

		stream.on('end', function() {
			self = null;
			cb && cb();
		});

		stream.pipe(res, { end: false });
		self.framework.stats.response.mmr++;
		return self;
	}

	stream = fs.createReadStream(filename);

	stream.on('end', function() {
		self = null;
		cb && cb();
	});

	stream.pipe(res, { end: false });
	self.framework.stats.response.mmr++;

	return self;
};

/*
	Close Response
	return {Controller}
*/
Controller.prototype.close = function() {
	var self = this;

	if (!self.isConnected)
		return self;

	if (self.internal.type === 0 && self.res.success)
		return self;

	if (self.internal.type === 2)
		self.res.write('\r\n\r\n--' + self.internal.boundary + '--');

	self.res.end();
	self.internal.type = 0;

	return self;
};

/*
	Send proxy request
	@url {String}
	@obj {Object}
	@fnCallback {Function} :: optional
	@timeout {Number} :: optional
	return {Controller}
*/
Controller.prototype.proxy = function(url, obj, fnCallback, timeout) {

	var self = this;
	var headers = { 'X-Proxy': 'partial.js', 'Content-Type': 'application/json' };

	if (typeof(fnCallback) === NUMBER) {
		var tmp = timeout;
		timeout = fnCallback;
		fnCallback = tmp;
	}

	if (typeof(obj) === FUNCTION) {
		var tmp = fnCallback;
		fnCallback = obj;
		obj = tmp;
	}

	utils.request(url, 'POST', obj, function(error, data, code, headers) {

		if (!fnCallback)
			return;

		if ((headers['content-type'] || '').indexOf('application/json') !== -1)
			data = JSON.parse(data);

		fnCallback.call(self, error, data, code, headers);

	}, headers, 'utf8', timeout || 10000);

	return self;
};

/*
	Return database
	@name {String}
	return {Database};
*/
Controller.prototype.database = function(name) {
	return this.framework.database(name);
};

/*
	Response view
	@name {String}
	@model {Object} :: optional
	@headers {Object} :: optional
	@isPartial {Boolean} :: optional
	return {Controller or String}; string is returned when isPartial == true
*/
Controller.prototype.view = function(name, model, headers, isPartial) {
	var self = this;

	if (self.res.success)
		return isPartial ? '' : self;

	if (!self.isLayout && name[0] !== '/')
	{
		if (self.name !== 'default')
			name = '/' + self.name + '/' + name;
	}

	var generator = internal.generateView(self, name);

	if (generator === null) {

		if (isPartial)
			return '';

		self.view500('View "' + name + '" not found.');
		return;
	}

	var values = [];
	var repository = self.repository;
	var config = self.config;
	var get = self.get;
	var post = self.post;
	var session = self.session;
	var helper = self.app.helpers;
	var fn = generator.generator;
	var sitemap = null;
	var url = self.url;
	var empty = '';
	var global = self.app.global;

	self.model = model;

	if (typeof(isPartial) === UNDEFINED && typeof(headers) === BOOLEAN) {
		isPartial = headers;
		headers = null;
	}

	var condition = false;

	if (self.isLayout) {
		self._currentCSS = self._defaultCSS || '';
		self._currentJS = self._defaultJS || '';
		self._currentUpload = self._defaultUpload || '';
		self._currentVideo = self._defaultVideo || '';
		self._currentImage = self._defaultImage || '';
	}

	for (var i = 0; i < generator.execute.length; i++) {

		var execute = generator.execute[i];
		var isEncode = execute.isEncode;
		var run = execute.run;
		var evl = true;
		var value = '';

		if (execute.name === 'if') {
			values[i] = eval(run);
			condition = true;
			continue;
		}

		if (execute.name === 'else') {
			values[i] = '';
			condition = true;
			continue;
		}

		if (execute.name === 'endif') {
			values[i] = '';
			condition = false;
			continue;
		}

		switch (execute.name) {
			case 'view':
			case 'viewToggle':
			case 'content':
			case 'contentToggle':
			case 'template':
			case 'templateToggle':

				if (run.indexOf('sitemap') !== -1)
					sitemap = self.sitemap();

				isEncode = false;
				if (!condition)
					run = 'self.$'+ run;

				break;

			case 'body':
				isEncode = false;
				evl = false;
				value = self.output;
				break;

			case 'title':
			case 'description':
			case 'keywords':
				run = 'self.repository["$'+ execute.name + '"]';
				break;

			case 'meta':
			case 'head':
			case 'sitemap':
			case 'settings':
			case 'layout':

				isEncode = false;

				if (run.indexOf('(') !== -1) {
					if (!condition) {
						eval('self.' + run);
						evl = false;
					}
				} else
					run = 'self.repository["$'+ execute.name + '"]';

				break;

			case 'global':
			case 'model':
			case 'repository':
			case 'session':
			case 'config':
			case 'get':
			case 'post':
			case 'dns':
			case 'header':
			case 'next':
			case 'prev':
			case 'prerender':
			case 'prefetch':
			case 'canonical':
				break;

			default:

				if (!execute.isDeclared) {
					if (typeof(helper[execute.name]) === UNDEFINED) {
						self.app.error(new Error('Helper "' + execute.name + '" is not defined.'), 'view -> ' + name, self.req.uri);
						evl = false;
					}
					else {
						isEncode = false;
						if (condition)
							run = run.replace('(function(){', '(function(){return helper.');
						else
							run = 'helper.' + internal.appendThis(run);
					}
				}

			break;
		}

		if (evl) {
			try
			{
				value = eval(run);
			} catch (ex) {
				self.app.error(ex, 'View error "' + name + '", problem with: ' + execute.name, self.req.uri);
			}
		}

		if (typeof(value) === FUNCTION) {
			values[i] = value;
			continue;
		}

		if (value === null)
			value = '';

		var type = typeof(value);

		if (type === UNDEFINED)
			value = '';
		else if (type !== STRING)
			value = value.toString();

		if (isEncode)
			value = value.toString().htmlEncode();

		values[i] = value;
	}

	var value = fn.call(self, values, self, repository, model, session, sitemap, get, post, url, empty, global, helper).replace(/\\n/g, '\n');

	if (isPartial)
		return value;

	if (self.isLayout || utils.isNullOrEmpty(self.internal.layout)) {

		self.subscribe.success();

		if (self.isConnected) {
			self.framework.responseContent(self.req, self.res, self.statusCode, value, self.internal.contentType, true, headers);
			self.framework.stats.response.view++;
		}

		return self;
	}

	self.output = value;
	self.isLayout = true;
	self.view(self.internal.layout, null, headers);
	return self;
};

// *********************************************************************************
// =================================================================================
// Framework.WebSocket
// =================================================================================
// *********************************************************************************

var NEWLINE                = '\r\n';
var SOCKET_RESPONSE        = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nX-Powered-By: {0}\r\nSec-WebSocket-Accept: {1}\r\n\r\n';
var SOCKET_RESPONSE_ERROR  = 'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nX-WebSocket-Reject-Reason: 403 Forbidden\r\n\r\n';
var SOCKET_HASH            = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
var SOCKET_ALLOW_VERSION   = [13];

/*
    WebSocket
    @framework {partial.js}
    @path {String}
    @name {String} :: Controller name
    return {WebSocket}
*/
function WebSocket(framework, path, name) {
    this._keys = [];
    this.path = path;
    this.online = 0;
    this.connections = {};
    this.framework = framework;
    this.global = framework.global;
    this.config = framework.config;
    this.repository = {};
    this.name = name;
    this.isDebug = framework.config.debug;
    this.url = utils.path(path);
    this.async = new utils.Async(this);
    this.path = framework.path;
    this.fs = framework.fs;
};

// on('open', function(client) {});
// on('close', function(client) {});
// on('message', function(client, message) {});
// on('error', function(error, client) {});

WebSocket.prototype = new events.EventEmitter;

/*
    Send message
    @message {String or Object}
    @names {String Array}
    @blacklist {String Array}
    return {WebSocket}
*/
WebSocket.prototype.send = function(message, names, blacklist) {

    var self = this;
    var keys = self._keys;
    var length = keys.length;

    if (length === 0)
    	return self;

    blacklist = blacklist || [];

    if (typeof(names) === UNDEFINED || names === null || names.length === 0) {

        var isBlacklist = blacklist.length > 0;

        for (var i = 0; i < length; i++) {

        	var _id = keys[i];
            var conn = self.connections[_id];

            if (isBlacklist && blacklist.indexOf(conn.id) !== -1)
                continue;

            conn.send(message);
            self.framework.stats.response.websocket++;
        }

        self.emit('send', message);
        return self;
    }

    for (var i = 0; i < length; i++) {

        var _id = keys[i];

        if (names.indexOf(_id) === -1)
            continue;

        var conn = self.connections[_id];
        conn.send(message);
        self.framework.stats.response.websocket++;

    }

    self.emit('send', message, names, blacklist);
    return self;
};

/*
    Close connection
    @names {String Array} :: optional, default null
    return {WebSocket}
*/
WebSocket.prototype.close = function(names) {

    var self = this;
    var keys = self._keys;
    var length = keys.length;

    if (length === 0)
    	return self;

    if (typeof(names) === UNDEFINED || names === null || names.length === 0) {
    	for (var i = 0; i < length; i++) {
			var _id = keys[i];
            self.connections[_id].close();
            self._remove(_id);
    	}
        self._refresh();
        return self;
    }

	for (var i = 0; i < length; i++) {

		var _id = keys[i];
        var conn = self.connections[_id];

        if (names.indexOf(conn.name) === -1)
            continue;

        conn.close();
        self._remove(_id);
	}

    self._refresh();
    return self;
};

/*
	Error
	@err {Error}
	return {Framework}
*/
WebSocket.prototype.error = function(err) {
	var self = this;
	self.framework.error(typeof(err) === STRING ? new Error(err) : err, self.name, self.path);
	return self;
};

/*
    All connections (forEach)
    @fn {Function} :: function(client, index) {}
    return {WebSocketClient};
*/
WebSocket.prototype.all = function(fn) {

    var self = this;
    var length = self._keys.length;

    for (var i = 0; i < length; i++) {
        var id = self._keys[i];
        if (fn(self.connections[id], i))
            break;
    }

    return self;
};

/*
    Find connection
    @name {String}
    return {WebSocketClient}
*/
WebSocket.prototype.find = function(name) {
    var self = this;
    var length = self._keys.length;

    for (var i = 0; i < length; i++) {
        var connection = self.connections[self._keys[i]];
        if (connection.id === name)
            return connection;
    }

    return null;
};

/*
    Destroy websocket
*/
WebSocket.prototype.destroy = function() {
    var self = this;
    self.close();
    self.connections = null;
    self._keys = null;
    delete self.framework.connections[self.path];
    self.emit('destroy');
};

/*
	Send proxy request
	@url {String}
	@obj {Object}
	@fnCallback {Function} :: optional
	return {Controller}
*/
WebSocket.prototype.proxy = function(url, obj, fnCallback) {

	var self = this;
	var headers = { 'X-Proxy': 'partial.js', 'Content-Type': 'application/json' };

	if (typeof(obj) === FUNCTION) {
		var tmp = fnCallback;
		fnCallback = obj;
		obj = tmp;
	}

	utils.request(url, 'POST', obj, function(error, data, code, headers) {

		if (!fnCallback)
			return;

		if ((headers['content-type'] || '').indexOf('application/json') !== -1)
			data = JSON.parse(data);

		fnCallback.call(self, error, data, code, headers);

	}, headers);

	return self;
};

/*
    Internal function
    return {WebSocket}
*/
WebSocket.prototype._refresh = function() {
    var self = this;
    self._keys = Object.keys(self.connections);
    self.online = self._keys.length;
    return self;
};

/*
    Internal function
    @id {String}
    return {WebSocket}
*/
WebSocket.prototype._remove = function(id) {
    var self = this;
    delete self.connections[id];
    return self;
};

/*
    Internal function
    @client {WebSocketClient}
    return {WebSocket}
*/
WebSocket.prototype._add = function(client) {
    var self = this;
    self.connections[client._id] = client;
    return self;
};

/*
    Module caller
    @name {String}
    return {Module};
*/
WebSocket.prototype.module = function(name) {
    return this.framework.module(name);
};

/*
    Controller models reader
    @name {String} :: name of controller
    return {Object};
*/
WebSocket.prototype.models = function(name) {
    return (this.framework.controllers[name] || {}).models;
};

/*
    Controller functions reader
    @name {String} :: name of controller
    return {Object};
*/
WebSocket.prototype.functions = function(name) {
    return (this.framework.controllers[name] || {}).functions;
};

/*
    Return database
    @name {String}
    return {Database};
*/
WebSocket.prototype.database = function(name) {
    return this.framework.database(name);
};

/*
    Resource reader
    @name {String} :: filename
    @key {String}
    return {String};
*/
WebSocket.prototype.resource = function(name, key) {
    return this.framework.resource(name, key);
};

/*
    Log
    @arguments {Object array}
    return {WebSocket};
*/
WebSocket.prototype.log = function() {
    var self = this;
    self.framework.log.apply(self.framework, arguments);
    return self;
};

/*
    Validation / alias for validate
    return {ErrorBuilder}
*/
WebSocket.prototype.validation = function(model, properties, prefix, name) {
    return this.validate(model, properties, prefix, name);
};

/*
    Validation object
    @model {Object} :: object to validate
    @properties {String array} : what properties?
    @prefix {String} :: prefix for resource = prefix + model name
    @name {String} :: name of resource
    return {ErrorBuilder}
*/
WebSocket.prototype.validate = function(model, properties, prefix, name) {

    var self = this;

    var resource = function(key) {
        return self.resource(name || 'default', (prefix || '') + key);
    };

    var error = new builders.ErrorBuilder(resource);
    return utils.validate.call(self, model, properties, self.framework.onValidation, error);
};

/*
    Add function to async wait list
    @name {String}
    @waitingFor {String} :: name of async function
    @fn {Function}
    return {WebSocket}
*/
WebSocket.prototype.wait = function(name, waitingFor, fn) {
    var self = this;
    self.async.wait(name, waitingFor, fn);
    return self;
};

/*
    Run async functions
    @callback {Function}
    return {WebSocket}
*/
WebSocket.prototype.complete = function(callback) {
    var self = this;
    return self.complete(callback);
};

/*
    Add function to async list
    @name {String}
    @fn {Function}
    return {WebSocket}
*/
WebSocket.prototype.await = function(name, fn) {
    var self = this;
    self.async.await(name, fn);
    return self;
};

/*
    WebSocketClient
    @req {Request}
    @socket {Socket}
    @head {Buffer}
*/
function WebSocketClient(req, socket, head) {

    this.handlers = {
        ondata: this._ondata.bind(this),
        onerror: this._onerror.bind(this),
        onclose: this._onclose.bind(this)
    };

    this.limit = 0;
    this.container = null;
    this._id = null;
    this.id = '';
    this.socket = socket;
    this.req = req;
    this.isClosed = false;
    this.get = {};
    this.session = {};
    this.ip = '';
    this.protocol = (req.headers['sec-websocket-protocol'] || '').replace(/\s/g, '').split(',');

    req.uri = parser.parse('ws://' + req.headers['host'] + req.url);

    this.uri = req.uri;
    this.length = 0;
    this.cookie = req.cookie.bind(req);

    // 1 = raw - not implemented
    // 2 = plain
    // 3 = JSON

    this.type = 2;
};

WebSocketClient.prototype = new events.EventEmitter;

/*
    Internal function
    @allow {String Array} :: allow origin
    @protocols {String Array} :: allow protocols
    @flags {String Array} :: flags
    return {Boolean}
*/
WebSocketClient.prototype.prepare = function(flags, protocols, allow, length, version) {

    var self = this;
    var socket = self.socket;

    flags = flags || [];
    protocols = protocols || [];
    allow = allow || [];

    self.length = length;

    var origin = self.req.headers['origin'] || '';

    if (allow.length > 0) {

        if (allow.indexOf('*') === -1) {
            for (var i = 0; i < allow.length; i++) {
                if (origin.indexOf(allow[i]) === -1)
                    return false;
            }
        }

    } else {

        if (origin.indexOf(self.req.headers.host) === -1)
            return false;
    }

    if (protocols.length > 0) {
        for (var i = 0; i < protocols.length; i++) {
            if (self.protocol.indexOf(protocols[i]) === -1)
                return false;
        }
    }

    if (SOCKET_ALLOW_VERSION.indexOf(utils.parseInt(self.req.headers['sec-websocket-version'])) === -1)
        return false;

    self.socket = socket;
    self.socket.write(new Buffer(SOCKET_RESPONSE.format('partial.js v' + version, self._request_accept_key(self.req)), 'binary'));

    var proxy = self.req.headers['x-forwarded-for'];

    if (typeof(proxy) !== UNDEFINED)
        self.ip = proxy.split(',', 1)[0] || self.req.connection.remoteAddress;
    else
        self.ip = self.req.connection.remoteAddress;

    if (self.uri.query && self.uri.query.length > 0)
        self.get = qs.parse(self.uri.query);

    self._id = self.ip.replace(/\./g, '') + utils.GUID(20);
    self.id = self._id;

    if (flags.indexOf('binary') !== -1)
    	self.type = 1;
    else if (flags.indexOf('json') !== -1)
    	self.type = 3;

    return true;
};

/*
    Internal function
    @container {WebSocket}
    return {WebSocketClient}
*/
WebSocketClient.prototype.upgrade = function(container) {

    var self = this;
    self.container = container;

    //self.socket.setTimeout(0);
    //self.socket.setNoDelay(true);
    //self.socket.setKeepAlive(true, 0);

    self.socket.on('data', self.handlers.ondata);
    self.socket.on('error', self.handlers.onerror);
    self.socket.on('close', self.handlers.onclose);

    self.container._add(self);
    self.container._refresh();
    self.container.framework.emit('websocket-connection', self.container, self);
    self.container.emit('open', self);

    return self;
};

/*
    Internal handler
    @data {Buffer}
*/
WebSocketClient.prototype._ondata = function(data) {

    var self = this;

    if (data.length > self.length) {
        self.container.emit('error', new Error('Maximum request length exceeded'), self);
        return;
    }

	var message = utils.decode_WS(data);

    if (message === '' || message === null) {
        // websocket.close() send empty string
        self.close();
        return;
    }

    if (self.type !== 3) {
    	self.container.emit('message', self, message);
    	return;
    }

    if (message.isJSON()) {
        try
        {
            message = JSON.parse(message);
        } catch (ex) {
            message = null;
            self.container.emit('error', new Error('JSON parser: ' + ex.toString()), self);
            return;
        }
    }
    else {
        message = null;
        self.close();
        return;
    }

    self.container.emit('message', self, message);
};

/*
    Internal handler
*/
WebSocketClient.prototype._onerror = function(error) {
    var self = this;
    self.container.emit('error', error, self);
};

/*
    Internal handler
*/
WebSocketClient.prototype._onclose = function() {
    var self = this;
    self.container._remove(self._id);
    self.container._refresh();
    self.container.emit('close', self);
};

/*
    Send message
    @message {String or Object}
    return {WebSocketClient}
*/
WebSocketClient.prototype.send = function(message) {
    var self = this;

    if (self.isClosed)
        return;

   	self.socket.write(new Buffer(utils.encode_WS(self.type === 3 ? JSON.stringify(message) : (message || '').toString()), 'binary'));
    return self;
};

/*
    Close connection
    return {WebSocketClient}
*/
WebSocketClient.prototype.close = function() {
    var self = this;

    if (self.isClosed)
        return self;

    self.isClosed = true;

    // removed: end(new Buffer(SOCKET_RESPONSE_ERROR, 'binary'));
    self.socket.end();

    return self;
};

WebSocketClient.prototype._request_accept_key = function(req) {
    var sha1 = crypto.createHash('sha1');
    sha1.update((req.headers['sec-websocket-key'] || '') + SOCKET_HASH);
    return sha1.digest('base64');
};

// *********************************************************************************
// =================================================================================
// Prototypes
// =================================================================================
// *********************************************************************************

/*
	Write cookie
	@name {String}
	@value {String}
	@expire {Date}
	@path {String}
	@domain {String}
	@httpOnly {Boolean},
	@secure {Boolean}
	return {ServerResponse}
*/
http.ServerResponse.prototype.cookie = function(name, value, expire, path, domain, httpOnly, secure) {

	httpOnly = httpOnly || false;
	secure = secure || false;
	domain = domain || '';

	var isExpire = expire || false;
    var cookie = (!isExpire ? '{0}={1}; path={3}' : '{0}={1}; expires={2}; path={3}') + (domain.length > 0 ? '; domain={4}' : '') + (secure ? '; secure' : '') + (httpOnly ? '; httpOnly' : '');
    var self = this;

	self.setHeader('Set-Cookie', cookie.format(name, value, isExpire ? expire.toUTCString() : '', path || '/', domain));
	return self;
};

/*
	Read cookie
	@name {String}
	return {String}
*/
http.IncomingMessage.prototype.cookie = function(name) {

	var self = this;

	if (typeof(self.cookies) !== UNDEFINED)
		return self.cookies[name] || '';

	self.cookies = {};

    var cookie = self.headers['cookie'] || '';
    if (cookie.length > 0) {
		var arr = cookie.split(';');
		var length = arr.length;
		for (var i = 0; i < length; i++) {
        	var c = arr[i].trim().split('=');
			self.cookies[c[0]] = c[1];
		}
	}

	return self.cookies[name] || '';
};

/*
	Clear all uploaded files
	@isAuto {Booelan} :: system, internal, optional default false
	return {ServerRequest}
*/
http.IncomingMessage.prototype.clear = function(isAuto) {

	var self = this;
	var files = self.data.files;

	if (isAuto && self._manual)
		return self;

	if (!files)
		return self;

	var length = files.length;

	if (length === 0)
		return self;

	for (var i = 0; i < length; i++) {
		(function(filename) {
			fs.exists(filename, function(exists) {
				if (exists)
					fs.unlink(filename);
			});
		})(files[i].filenameTMP);
	}

	self.data.files = null;
	return self;
};

/*
	Return hostname with protocol and port
	@path {String} :: optional
	return {String}
*/
http.IncomingMessage.prototype.hostname = function(path) {

	var self = this;
	var uri = self.uri;

	path = path || '';

	if (path[0] !== '/')
		path = '/' + path;

	return uri.protocol + '//' + uri.hostname + (typeof(uri.port) !== UNDEFINED && uri.port !== 80 ? ':' + uri.port : '') + path;
};

global.framework = module.exports = new Framework();