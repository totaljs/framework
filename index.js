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
 * @module Framework
 * @version 1.9.1
 */

'use strict';

var qs = require('querystring');
var os = require('os');
var fs = require('fs');
var zlib = require('zlib');
var path = require('path');
var crypto = require('crypto');
var parser = require('url');
var events = require('events');
var http = require('http');
var directory = path.dirname(process.argv[1]);
var child = require('child_process');
var util = require('util');

var ENCODING = 'utf8';
var UNDEFINED = 'undefined';
var STRING = 'string';
var TYPE_FUNCTION = 'function';
var NUMBER = 'number';
var OBJECT = 'object';
var BOOLEAN = 'boolean';
var EXTENSION_JS = '.js';
var RESPONSE_HEADER_CACHECONTROL = 'Cache-Control';
var RESPONSE_HEADER_CONTENTTYPE = 'Content-Type';
var RESPONSE_HEADER_CONTENTLENGTH = 'Content-Length';
var CONTENTTYPE_TEXTPLAIN = 'text/plain';
var CONTENTTYPE_TEXTHTML = 'text/html';
var REQUEST_COMPRESS_CONTENTTYPE = { 'text/plain': true, 'text/javascript': true, 'text/css': true, 'application/x-javascript': true, 'application/json': true, 'text/xml': true, 'image/svg+xml': true, 'text/x-markdown': true, 'text/html': true };
var TEMPORARY_KEY_REGEX = /\//g;
var REG_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;
var REG_VERSIONS = /(href|src)="[a-zA-Z0-9\/\:\-\.]+\.(jpg|js|css|png|gif|svg|html|ico|json|less|sass|scss|swf|txt|webp|woff|woff2|xls|xlsx|xml|xsl|xslt|zip|rar|csv|doc|docx|eps|gzip|jpe|jpeg|manifest|mov|mp3|mp4|ogg|package|pdf)"/gi;
var REG_MULTIPART = /\/form\-data$/i;
var REQUEST_PROXY_FLAGS = ['post', 'json'];

var _controller = '';
var _test;

// GO ONLINE MODE
if (!global.framework_internal)
	global.framework_internal = require('./internal');

if (!global.framework_builders)
	global.framework_builders = require('./builders');

if (!global.framework_utils)
	global.framework_utils = require('./utils');

if (!global.framework_mail)
	global.framework_mail = require('./mail');

if (!global.framework_image)
	global.framework_image = global.Image = require('./image');

if (!global.framework_nosql)
	global.framework_nosql = require('./nosql');

global.Builders = global.builders = framework_builders;
var utils = global.Utils = global.utils = global.U = framework_utils;
global.Mail = global.MAIL = framework_mail;

global.include = global.INCLUDE = global.source = global.SOURCE = function(name, options) {
	return framework.source(name, options);
};

global.MODULE = function(name) {
	return framework.module(name);
};

global.DB = global.DATABASE = function() {
	if (typeof(framework.database) === OBJECT)
		return framework.database;
	return framework.database.apply(framework, arguments);
};

global.CONFIG = function(name) {
	return framework.config[name];
};

global.INSTALL = function(type, name, declaration, options, callback) {
	return framework.install(type, name, declaration, options, callback);
};

global.UNINSTALL = function(type, name, options) {
	return framework.uninstall(type, name, options);
};

global.RESOURCE = function(name, key) {
	return framework.resource(name, key);
};

global.TRANSLATE = function(name, key) {
	return framework.translate(name, key);
};

global.TRANSLATOR = function(name, text) {
	return framework.translator(name, text);
};

global.LOG = function() {
	return framework.log.apply(framework, arguments);
};

global.LOGGER = function() {
	return framework.logger.apply(framework, arguments);
};

global.MODEL = function(name) {
	return framework.model(name);
};

global.SCHEMA = function(group, name, model) {
	return Builders.load(group, name, model);
};

global.GETSCHEMA = function(group, name) {
	return Builders.getschema(group, name);
};

global.NEWSCHEMA = function(group, name) {
	if (!name) {
		name = group;
		group = 'default';
	}
	return Builders.newschema(group, name);
};

global.EACHSCHEMA = function(group, fn) {
	return Builders.eachschema(group, fn);
};

global.FUNCTION = function(name) {
	return framework.functions[name];
};

global.ROUTING = function(name) {
	return framework.routing(name);
};

global.SCHEDULE = function(date, each, fn) {
	return framework.schedule(date, each, fn);
};

global.FINISHED = function(stream, callback) {
	framework_internal.onFinished(stream, callback);
};

global.DESTROY = function(stream) {
	framework_internal.destroyStream(stream);
};

global.CLEANUP = function(stream, callback) {
	FINISHED(stream, function() {
		if (callback)
			callback();
		DESTROY(stream);
	});
};

global.SUCCESS = function(success, value) {

	var err;

	if (success instanceof Error) {
		err = success;
		success = false;
	} else if (success instanceof Builders.ErrorBuilder) {
		if (success.hasError()) {
			err = success.output();
			success = false;
		} else
			success = true;
	} else if (success === null || success === undefined)
		success = true;

	var o = { success: success };

	if (err)
		o.error = err;

	if (value === undefined)
		return o;

	o.value = value;
	return o;
};

if (global.setImmediate === undefined) {
	global.setImmediate = function(cb) {
		process.nextTick(cb);
	};
}

global.DEBUG = false;
global.TEST = false;
global.RELEASE = false;
global.is_client = false;
global.is_server = true;

function Framework() {

	this.id = null;
	this.version = 1910;
	this.version_header = '1.9.1';

	var version = process.version.toString().replace('v', '').replace(/\./g, '');
	if (version[1] === '0')
		version = parseFloat('0.' + version.substring(1));
	else
		version = parseFloat(version);

	this.versionNode = version;
	this.config = {

		debug: false,

		name: 'total.js',
		version: '1.01',
		author: '',
		secret: os.hostname() + '-' + os.platform() + '-' + os.arch(),

		'etag-version': '',
		'directory-controllers': '/controllers/',
		'directory-views': '/views/',
		'directory-definitions': '/definitions/',
		'directory-temp': '/tmp/',
		'directory-models': '/models/',
		'directory-resources': '/resources/',
		'directory-public': '/public/',
		'directory-public-virtual': '/app/',
		'directory-modules': '/modules/',
		'directory-source': '/source/',
		'directory-logs': '/logs/',
		'directory-tests': '/tests/',
		'directory-databases': '/databases/',
		'directory-workers': '/workers/',
		'directory-packages': '/packages/',
		'directory-private': '/private/',
		'directory-isomorphic': '/isomorphic/',
		'directory-configs': '/configs/',
		'directory-services': '/services/',

		// all HTTP static request are routed to directory-public
		'static-url': '',
		'static-url-script': '/js/',
		'static-url-style': '/css/',
		'static-url-image': '/img/',
		'static-url-video': '/video/',
		'static-url-font': '/fonts/',
		'static-url-download': '/download/',
		'static-accepts': { '.jpg': true, '.png': true, '.gif': true, '.ico': true, '.js': true, '.css': true, '.txt': true, '.xml': true, '.woff': true, '.woff2':true, '.otf':true, '.ttf':true, '.eot':true, '.svg':true, '.zip':true, '.rar':true, '.pdf':true, '.docx':true, '.xlsx':true, '.doc':true, '.xls':true, '.html':true, '.htm':true, '.appcache':true, '.manifest':true, '.map':true, '.ogg':true, '.mp4':true, '.mp3':true, '.webp':true, '.webm':true, '.swf':true, '.package':true, '.json':true, '.md': true, '.m4v': true },

		// 'static-accepts-custom': [],

		'default-layout': 'layout',

		// default maximum request size / length
		// default 5 kB
		'default-request-length': 5,
		'default-websocket-request-length': 2,
		'default-websocket-encodedecode': true,
		'default-maximum-file-descriptors': 0,
		'default-timezone': '',

		// in milliseconds
		'default-request-timeout': 5000,

		// otherwise is used ImageMagick (Heroku supports ImageMagick)
		// gm = graphicsmagick or im = imagemagick
		'default-image-converter': 'gm',
		'default-image-quality': 93,

		'allow-handle-static-files': true,
		'allow-gzip': true,
		'allow-websocket': true,
		'allow-compile-script': true,
		'allow-compile-style': true,
		'allow-compile-html': true,
		'allow-performance': false,
		'allow-custom-titles': false,
		'allow-compatibility': false,
		'disable-strict-server-certificate-validation': true,
		'disable-clear-temporary-directory': false,

		// Used in framework._service()
		// All values are in minutes
		'default-interval-clear-resources': 20,
		'default-interval-clear-cache': 7,
		'default-interval-precompile-views': 61,
		'default-interval-websocket-ping': 3,
		'default-interval-clear-dnscache': 2880 // 2 days
	};

	this.global = {};
	this.resources = {};
	this.connections = {};
	this.functions = {};
	this.versions = null;
	this.schedules = [];

	this.isDebug = true;
	this.isTest = false;
	this.isLoaded = false;
	this.isWorker = true;
	this.isCluster = require('cluster').isWorker;

	this.routes = {
		sitemap: null,
		web: [],
		files: [],
		websockets: [],
		middleware: {},
		redirects: {},
		resize: {},
		request: [],
		views: {},
		merge: {},
		mapping: {},
		packages: {},
	};

	this.behaviours = null;
	this.modificators = null;
	this.helpers = {};
	this.modules = {};
	this.models = {};
	this.sources = {};
	this.controllers = {};
	this.dependencies = {};
	this.isomorphic = {};
	this.tests = [];
	this.errors = [];
	this.problems = [];
	this.changes = [];
	this.server = null;
	this.port = 0;
	this.ip = '';

	this.workers = {};
	this.databases = {};
	this.directory = directory;
	this.isLE = os.endianness ? os.endianness() === 'LE' : true;
	this.isHTTPS = false;

	this.temporary = {
		path: {},
		processing: {},
		range: {},
		views: {},
		dependencies: {}, // temporary for module dependencies
		other: {}
	};

	this.stats = {

		other: {
			websocketPing: 0,
			websocketCleaner: 0
		},

		request: {
			request: 0,
			pending: 0,
			web: 0,
			xhr: 0,
			file: 0,
			websocket: 0,
			get: 0,
			head: 0,
			post: 0,
			put: 0,
			upload: 0,
			blocked: 0,
			'delete': 0,
			mobile: 0,
			desktop: 0
		},
		response: {
			view: 0,
			json: 0,
			websocket: 0,
			timeout: 0,
			custom: 0,
			binary: 0,
			pipe: 0,
			file: 0,
			destroy: 0,
			stream: 0,
			streaming: 0,
			plain: 0,
			empty: 0,
			redirect: 0,
			forward: 0,
			restriction: 0,
			notModified: 0,
			sse: 0,
			error400: 0,
			error401: 0,
			error403: 0,
			error404: 0,
			error408: 0,
			error431: 0,
			error500: 0,
			error501: 0
		}
	};

	// intialize cache
	this.cache = new FrameworkCache();
	this.fs = new FrameworkFileSystem();
	this.path = new FrameworkPath();
	this.restrictions = new FrameworkRestrictions();

	this._request_check_redirect = false;
	this._request_check_referer = false;
	this._request_check_POST = false;
	this._request_check_mobile = false;
	this._length_middleware = 0;
	this._length_request_middleware = 0;
	this._length_files = 0;

	this.isVirtualDirectory = false;
	this.isWindows = os.platform().substring(0, 3).toLowerCase() === 'win';
}

// ======================================================
// PROTOTYPES
// ======================================================

Framework.prototype = {
	get async() {
		var self = this;
		if (typeof(self._async) === UNDEFINED)
			self._async = new utils.Async(self);
		return self._async;
	}
};

Framework.prototype.__proto__ = new events.EventEmitter();

/**
 * Adds a new behaviour
 * @param {String} url A relative URL address.
 * @param {String Array} flags
 * @return {Framework}
 */
Framework.prototype.behaviour = function(url, flags) {
	var self = this;

	if (!self.behaviours)
		self.behaviours = {};

	if (typeof(flags) === STRING)
		flags = [flags];

	if (!self.behaviours[url])
		self.behaviours[url] = {};

	for (var i = 0; i < flags.length; i++)
		self.behaviours[url][flags[i]] = true;

	return self;
};

/**
 * Refersh framework internal informations
 * @param {Boolean} clear Clear temporary files, optional
 * @return {Framework}
 */
Framework.prototype.refresh = function(clear) {
	var self = this;

	self.emit('clear', 'refresh');

	self.resources = {};
	self.databases = {};

	self._configure();
	self._configure_versions();
	self._configure_sitemap();

	self.temporary.path = {};
	self.temporary.range = {};
	self.temporary.views = {};
	self.temporary.other = {};

	self.emit('reconfigure');
	return self;
};

/**
 * Get a controller
 * @param {String} name
 * @return {Object}
 */
Framework.prototype.controller = function(name) {
	return this.controllers[name] || null;
};

/**
 * Use configuration
 * @param {String} filename
 * @return {Framework}
 */
Framework.prototype.useConfig = function(name) {
	return this._configure(name, true);
};

/**
 * Sort all routes
 * @return {Framework}
 */
Framework.prototype._routesSort = function() {

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

	var cache = {};
	var length = self.routes.web.length;

	for (var i = 0; i < length; i++) {
		var route = self.routes.web[i];
		if (!route.isMOBILE)
			continue;
		if (route.isUPLOAD || route.isXHR || route.isJSON || route.isSYSTEM || route.isXML)
			continue;
		if (route.flags.indexOf('get') === -1)
			continue;
		var url = route.url.join('/');
		cache[url] = true;
	}

	for (var i = 0; i < length; i++) {
		var route = self.routes.web[i];
		if (route.isMOBILE || route.isUPLOAD || route.isXHR || route.isJSON || route.isSYSTEM || route.isXML)
			continue;
		if (route.flags.indexOf('get') === -1)
			continue;
		var url = route.url.join('/');
		route.isMOBILE_VARY = cache[url] === true;
	}

	return self;
};

/**
 * Get a database instance
 * @param {String} name Database name (optional)
 * @return {Framework}
 */
Framework.prototype.database = function(name) {
	var self = this;
	var db = self.databases[name];
	if (db !== undefined)
		return db;
	self.path.verify('databases');
	db = framework_nosql.load(path.join(directory, this.config['directory-databases'], name), path.join(directory, this.config['directory-databases'], name + '-binary'), true);
	self.databases[name] = db;
	return db;
};

/**
 * Stop application
 * @param {String} signal
 * @return {Framework}
 */
Framework.prototype.stop = function(signal) {

	var self = this;

	for (var m in framework.workers) {
		var worker = framework.workers[m];
		if (worker && worker.kill)
			worker.kill(signal || 'SIGTERM');
	}

	framework.emit('exit');

	if (!self.isWorker && typeof(process.send) === TYPE_FUNCTION)
		process.send('stop');

	self.cache.stop();

	if (self.server)
		self.server.close();

	process.exit(signal || 'SIGTERM');
	return self;
};

/**
 * Add a route redirect
 * @param {String} host Domain with protocol.
 * @param {String} newHost Domain with protocol.
 * @param {Boolean} withPath Copy path (default: true).
 * @param {Boolean} permanent Is permanent redirect (302)? (default: false)
 * @return {Framework}
 */
Framework.prototype.redirect = function(host, newHost, withPath, permanent) {

	var self = this;
	var external = host.startsWith('http://') || host.startsWith('https');

	if (external === false) {
		if (host[0] !== '/')
			host = '/' + host;

		var flags;

		if (withPath instanceof Array) {
			flags = withPath;
			withPath = permanent === true;
		} else if (permanent instanceof Array) {
			flags = permanent;
			withPath = withPath === true;
		} else
			withPath = withPath === true;

		permanent = withPath;
		framework.route(host, function() {
			if (newHost.startsWith('http://') || newHost.startsWith('https://')) {
				this.redirect(newHost, permanent);
				return;
			}

			if (newHost[0] !== '/')
				newHost = '/' + newHost;

			this.redirect(newHost, permanent);
		}, flags);
		return self;
	}

	if (host[host.length - 1] === '/')
		host = host.substring(0, host.length - 1);

	if (newHost[newHost.length - 1] === '/')
		newHost = newHost.substring(0, newHost.length - 1);

	self.routes.redirects[host] = {
		url: newHost,
		path: withPath,
		permanent: permanent
	};

	self._request_check_redirect = true;
	return self;
};

/**
 * Schedule job
 * @param {Date or String} date
 * @param {Boolean} repeat Repeat schedule
 * @param {Function} fn
 * @return {Framework}
 */
Framework.prototype.schedule = function(date, repeat, fn) {

	if (fn === undefined) {
		fn = repeat;
		repeat = false;
	}

	var self = this;
	var type = typeof(date);

	if (type === STRING)
		date = date.parseDate();
	else if (type === NUMBER)
		date = new Date(date);

	var sum = date.getTime();
	var id = framework_utils.GUID(5) + framework_utils.random(10000);

	if (repeat)
		repeat = repeat.replace('each', '1');

	self.schedules.push({ expire: sum, fn: fn, repeat: repeat });
	return self;
};

/**
 * Auto resize picture according the path
 * @param {String} url Relative path.
 * @param {String} width New width (optional).
 * @param {String} height New height (optional).
 * @param {Object} options Additional options.
 * @param {String Array} ext Allowed file extension (optional).
 * @param {String} path Source directory (optional).
 * @return {Framework}
 */
Framework.prototype.resize = function(url, width, height, options, path, extensions) {
	var self = this;
	var extension = null;
	var index = url.lastIndexOf('.');

	if (index !== -1)
		extension = [url.substring(index)];
	else
		extension = extensions || ['.jpg', '.png', '.gif'];

	var length = extension.length;
	for (var i = 0; i < length; i++)
		extension[i] = (extension[i][0] !== '.' ? '.' : '') + extension[i].toLowerCase();

	index = url.lastIndexOf('/');
	if (index !== -1)
		url = url.substring(0, index);

	if (url[0] !== '/')
		url = '/' + url;

	if (url[url.length - 1] !== '/')
		url += '/';

	path = path || url;

	if (!options)
		options = {};

	var ext = {};
	for (var i = 0, length = extension.length; i < length; i++)
		ext[extension[i]] = true;

	self.routes.resize[url] = {
		width: width,
		height: height,
		extension: ext,
		path: path || url,
		grayscale: options.grayscale,
		blur: options.blur,
		rotate: options.rotate,
		flip: options.flip,
		flop: options.flop,
		sepia: options.sepia,
		quality: options.quality,
		cache: options.cache === false ? false : true
	};

	return self;
};

/**
 * RESTful routing
 * @param {String} url A relative url.
 * @param {String Array} flags
 * @param {Function} onQuery
 * @param {Function(id)} onGet
 * @param {Function([id])} onSave
 * @param {Function(id)} onDelete
 * @return {Framework}
 */
Framework.prototype.restful = function(url, flags, onQuery, onGet, onSave, onDelete) {

	var self = this;
	var tmp;

	function remove_schema(arr) {
		for (var i = 0, length = arr.length; i < length; i++) {
			if (arr[i][0] !== '*')
				continue;
			arr.splice(i, 1);
			return arr;
		}
		return arr;
	}

	if (onQuery) {
		tmp = [];

		if (flags)
			tmp.push.apply(tmp, remove_schema(flags));

		self.route(url, tmp, onQuery);
	}

	var restful = framework_utils.path(url) + '{id}';

	if (onGet) {
		tmp = [];

		if (flags)
			tmp.push.apply(tmp, remove_schema(flags));

		self.route(restful, tmp, onGet);
	}

	if (onSave) {
		tmp = ['post'];

		if (flags)
			tmp.push.apply(tmp, flags);

		self.route(url, tmp, onSave);

		tmp = ['put'];
		if (flags)
			tmp.push.apply(tmp, flags);

		self.route(restful, tmp, onSave);
	}

	if (onDelete) {
		tmp = ['delete'];

		if (flags)
			tmp.push.apply(tmp, remove_schema(flags));

		self.route(restful, tmp, onDelete);
	}

	return self;
};

/**
 * Add a route
 * @param {String} url
 * @param {Function} funcExecute Action.
 * @param {String Array} flags
 * @param {Number} length Maximum length of request data.
 * @param {String Array} middleware Loads custom middleware.
 * @param {Number timeout Response timeout.
 * @return {Framework}
 */
Framework.prototype.route = function(url, funcExecute, flags, length, middleware, timeout, options) {

	var name;
	var tmp;
	var viewname;
	var skip = true;

	for (var i = 0; i < arguments.length; i++) {
		if (typeof(arguments[i]) === TYPE_FUNCTION) {
			skip = false;
			break;
		}
	}

	var CUSTOM = typeof(url) === TYPE_FUNCTION ? url : null;
	if (CUSTOM)
		url = '/';

	if (!skip && typeof(funcExecute) === 'string' && flags !== undefined) {
		// ID
		name = url;
		url = funcExecute;
		funcExecute = flags;
		flags = length;
		length = middleware;
		middleware = timeout;
		timeout = options;
		options = undefined;
	}

	if (url[0] === '#') {
		url = url.substring(1);
		if (url !== '400' && url !== '401' && url !== '403' && url !== '404' && url !== '408' && url !== '431' && url !== '500' && url !== '501') {
			var sitemap = self.sitemap(url, true);
			if (sitemap) {
				name = url;
				url = sitemap.url;
			} else
				throw new Error('Sitemap item "' + url + '" not found.');
		} else
			url = '#' + url;
	}

	if (url === '')
		url = '/';

	if (url[0] !== '[' && url[0] !== '/')
		url = '/' + url;

	if (url.endsWith('/'))
		url = url.substring(0, url.length - 1);

	if (utils.isArray(length)) {
		tmp = middleware;
		middleware = length;
		length = tmp;
	}

	var type = typeof(funcExecute);
	var index = 0;

	if (!name)
		name = url;

	if (type === OBJECT || funcExecute instanceof Array) {
		tmp = funcExecute;
		funcExecute = flags;
		flags = tmp;
	}

	if (type === STRING) {
		viewname = funcExecute;
		funcExecute = function(name) {
			this.view(viewname);
		};
	} else if (typeof(funcExecute) !== TYPE_FUNCTION) {

		viewname = url;

		if (viewname.endsWith('/'))
			viewname = viewname.substring(0, viewname.length - 1);

		index = viewname.lastIndexOf('/');
		if (index !== -1)
			viewname = viewname.substring(index + 1);

		if (viewname === '' || viewname === '/')
			viewname = 'index';

		funcExecute = function() {
			this.view(viewname);
		};
	}

	if (!utils.isArray(flags) && typeof(flags) === 'object') {
		length = flags['max'] || flags['length'] || flags['maximum'] || flags['maximumSize'] || flags['size'];
		middleware = flags['middleware'] || flags['partials'] || flags['partial'];
		timeout = flags['timeout'];
		options = flags['options'];
		if (flags['name'])
			name = flags['name'];
		if (flags['id'])
			name = flags['id'];
		flags = flags['flags'] || flags['flag'];
	} else if (flags instanceof Array && length && typeof(length) === OBJECT) {
		options = length;
		length = undefined;
	} else if (flags instanceof Array && typeof(length) === NUMBER && typeof(middleware) === OBJECT && (!(middleware instanceof Array))) {
		options = middleware;
		middleware = undefined;
	}


	var self = this;
	var priority = 0;
	var subdomain = null;
	var isASTERIX = url.indexOf('*') !== -1;

	index = url.indexOf(']');
	priority = url.count('/');

	if (isASTERIX) {
		url = url.replace('*', '').replace('//', '/');
		priority = priority - 100;
	}

	if (index > 0) {
		subdomain = url.substring(1, index).trim().toLowerCase().split(',');
		url = url.substring(index + 1);
		priority += 2;
	}

	var isRaw = false;
	var isNOXHR = false;
	var method = '';
	var schema;
	var isGENERATOR = (funcExecute.constructor.name === 'GeneratorFunction' || funcExecute.toString().indexOf('function*') === 0);
	var isMOBILE = false;
	var isJSON = false;
	var isDELAY = false;

	if (flags) {

		tmp = [];
		var count = 0;

		for (var i = 0; i < flags.length; i++) {

			if (typeof(flags[i]) === NUMBER) {
				timeout = flags[i];
				continue;
			}

			var first = flags[i][0];

			if (first === '%') {
				self.behaviour(url === '' ? '/' : url, flags[i].substring(1));
				continue;
			}

			if (first === '#') {
				if ((middleware || null) === null)
					middleware = [];
				middleware.push(flags[i].substring(1));
				continue;
			}

			if (first === '*') {
				schema = flags[i].substring(1).split('/');
				if (schema.length === 1) {
					schema[1] = schema[0];
					schema[0] = 'default';
				}
				continue;
			}

			count++;
			var flag = flags[i].toString().toLowerCase();
			switch (flag) {

				case 'json':
					isJSON = true;
					continue;

				case 'xss':
					count--;
					continue;

				case 'delay':
					count--;
					isDELAY = true;
					continue;

				case 'sync':
				case 'yield':
				case 'synchronize':
					isGENERATOR = true;
					count--;
					continue;

				case 'noxhr':
				case '-xhr':
					isNOXHR = true;
					continue;
				case 'raw':
					isRaw = true;
					tmp.push(flag);
					break;
				case 'mobile':
					isMOBILE = true;
					self._request_check_mobile = true;
					break;
				case 'authorize':
				case 'authorized':
					priority += 2;
					tmp.push('authorize');
					break;
				case 'unauthorize':
				case 'unauthorized':
					priority += 2;
					tmp.push('unauthorize');
					break;
				case 'logged':
					priority += 2;
					tmp.push('authorize');
					break;
				case 'unlogged':
					tmp.push('unauthorize');
					break;
				case 'referer':
				case 'referrer':
					tmp.push('referer');
					break;
				case 'delete':
				case 'get':
				case 'head':
				case 'options':
				case 'patch':
				case 'post':
				case 'propfind':
				case 'put':
				case 'trace':
					tmp.push(flag);
					method += (method ? ',' : '') + flag;
					break;
				default:
					tmp.push(flag);
					break;
			}
		}
		flags = tmp;
		priority += (count * 2);
	} else {
		flags = ['get'];
		method = 'get';
	}

	var isMember = false;

	if (flags.indexOf('logged') === -1 && flags.indexOf('authorize') === -1 && flags.indexOf('unauthorize') === -1 && flags.indexOf('unlogged') === -1)
		isMember = true;

	var routeURL = framework_internal.routeSplitCreate(url.trim());
	var arr = [];
	var reg = null;
	var regIndex = null;

	if (url.indexOf('{') !== -1) {

		routeURL.forEach(function(o, i) {
			if (o.substring(0, 1) !== '{')
				return;
			arr.push(i);

			var sub = o.substring(1, o.length - 1);

			if (sub[0] !== '/')
				return;

			var index = sub.lastIndexOf('/');
			if (index === -1)
				return;

			if (!reg) {
				reg = {};
				regIndex = [];
			}

			reg[i] = new RegExp(sub.substring(1, index), sub.substring(index + 1));
			regIndex.push(i);
		});

		priority -= arr.length;
	}

	if (url.indexOf('#') !== -1)
		priority -= 100;

	if (flags.indexOf('proxy') !== -1) {
		isJSON = true;
		priority++;
	}

	// commented: flags.indexOf('get') === -1 && because we can have: route('/', ..., ['json', 'get']);
	if ((isJSON || flags.indexOf('xml') !== -1 || isRaw) && (flags.indexOf('delete') === -1 && flags.indexOf('post') === -1 && flags.indexOf('put') === -1) && flags.indexOf('patch') === -1) {
		flags.push('post');
		method += (method ? ',' : '') + 'post';
		priority++;
	}

	if (flags.indexOf('upload') !== -1) {
		if (flags.indexOf('post') === -1 && flags.indexOf('put') === -1) {
			flags.push('post');
			method += (method ? ',' : '') + 'post';
		}
	}

	if (flags.indexOf('get') === -1 &&
		flags.indexOf('options') === -1 &&
		flags.indexOf('post') === -1 &&
		flags.indexOf('delete') === -1 &&
		flags.indexOf('put') === -1 &&
		flags.indexOf('upload') === -1 &&
		flags.indexOf('head') === -1 &&
		flags.indexOf('trace') === -1 &&
		flags.indexOf('patch') === -1 &&
		flags.indexOf('propfind') === -1) {
			flags.push('get');
			method += (method ? ',' : '') + 'get';
		}

	if (flags.indexOf('referer') !== -1)
		self._request_check_referer = true;

	if (!self._request_check_POST && (flags.indexOf('delete') !== -1 || flags.indexOf('post') !== -1 || flags.indexOf('put') !== -1 || flags.indexOf('upload') !== -1 || flags.indexOf('json') !== -1 || flags.indexOf('patch') !== -1 || flags.indexOf('options') !== -1))
		self._request_check_POST = true;

	if (!middleware || (!(middleware instanceof Array)) || !middleware.length)
		middleware = null;

	var isMULTIPLE = false;

	if (method.indexOf(',') !== -1)
		isMULTIPLE = true;

	if (method.indexOf(',') !== -1 || method === '')
		method = undefined;
	else
		method = method.toUpperCase();

	if (name[1] === '#')
		name = name.substring(1);

	self.routes.web.push({
		name: name,
		priority: priority,
		schema: schema,
		subdomain: subdomain,
		controller: !_controller ? 'unknown' : _controller,
		url: routeURL,
		param: arr,
		flags: flags || [],
		method: method,
		execute: funcExecute,
		length: (length || self.config['default-request-length']) * 1024,
		middleware: middleware,
		timeout: timeout === undefined ? (isDELAY ? 0 : self.config['default-request-timeout']) : timeout,
		isMULTIPLE: isMULTIPLE,
		isJSON: isJSON,
		isXML: flags.indexOf('xml') !== -1,
		isRAW: isRaw,
		isMOBILE: isMOBILE,
		isMOBILE_VARY: isMOBILE,
		isGENERATOR: isGENERATOR,
		isMEMBER: isMember,
		isASTERIX: isASTERIX,
		isREFERER: flags.indexOf('referer') !== -1,
		isHTTPS: flags.indexOf('https') !== -1,
		isHTTP: flags.indexOf('http') !== -1,
		isDEBUG: flags.indexOf('debug') !== -1,
		isRELEASE: flags.indexOf('release') !== -1,
		isPROXY: flags.indexOf('proxy') !== -1,
		isBOTH: isNOXHR ? false : true,
		isXHR: flags.indexOf('xhr') !== -1,
		isUPLOAD: flags.indexOf('upload') !== -1,
		isSYSTEM: url.startsWith('/#'),
		isCACHE: !url.startsWith('/#') && !CUSTOM && !arr.length && !isASTERIX,
		isPARAM: arr.length > 0,
		isDELAY: isDELAY,
		CUSTOM: CUSTOM,
		options: options,
		regexp: reg,
		regexpIndexer: regIndex
	});

	self.emit('route-add', 'web', self.routes.web[self.routes.web.length - 1]);

	if (!_controller)
		self._routesSort();

	return self;
};

/**
 * Get routing by name
 * @param {String} name
 * @return {Object}
 */
Framework.prototype.routing = function(name) {
	var self = this;
	for (var i = 0, length = self.routes.web.length; i < length; i++) {
		var route = self.routes.web[i];
		if (route.name === name) {
			var url =  Utils.path(route.url.join('/'));
			if (url[0] !== '/')
				url = '/' + url;
			return { controller: route.controller, url: url, id: route.id, flags: route.flags, middleware: route.middleware, execute: route.execute, timeout: route.timeout, options: route.options, length: route.length };
		}
	}
};

/**
 * Merge files
 * @param {String} url Relative URL.
 * @param {String/String Array  } file1 Filename or URL.
 * @param {String/String Array} file2 Filename or URL.
 * @param {String/String Array} file3 Filename or URL.
 * @param {String/String Array} fileN Filename or URL.
 * @return {Framework}
 */
Framework.prototype.merge = function(url) {

	var arr = [];
	var self = this;

	for (var i = 1, length = arguments.length; i < length; i++) {

		var items = arguments[i];
		if (!(items instanceof Array))
			items = [items];

		for (var j = 0, lengthsub = items.length; j < lengthsub; j++) {
			var fn = items[j];
			if (fn[0] === '@')
				fn = '~' + framework.path.package(fn.substring(1));
			arr.push(fn);
		}
	}

	url = self._version(url);

	if (url[0] !== '/')
		url = '/' + url;

	var filename = self.path.temp('merge-' + createTemporaryKey(url));
	self.routes.merge[url] = { filename: filename, files: arr };
	return self;
};

Framework.prototype.mapping = function(url, path) {
	return this.map.apply(this, arguments);
};

/**
 * Send message
 * @param  {Object} message
 * @param  {Object} handle
 * @return {Framework}
 */
Framework.prototype.send = function(message, handle) {
	process.send(message, handle);
	return this;
}

/**
 * Mapping of static file
 * @param {String} url
 * @param {String} filename	Filename or Directory.
 * @param {Function(filename) or String Array} filter
 * @return {Framework}
 */
Framework.prototype.map = function(url, filename, filter) {

	if (url[0] !== '/')
		url = '/' + url;

	var isPackage = false;
	var self = this;

	url = self._version(url);

	if (filename[0] === '#') {
		// isomorphic
		self.routes.mapping[url] = filename;
		return self;
	}

	if (filename[0] === '@') {
		filename = self.path.package(filename.substring(1));
		isPackage = true;
	}

	var isFile = path.extname(filename).length > 0;
	if (isFile) {
		self.routes.mapping[url] = filename;
		return self;
	}

	url = framework_utils.path(url);
	filename = framework_utils.path(filename);

	var replace = filename;
	var plus = '';
	var isRoot = false;

	if (replace[0] === '/')
		isRoot = true;

	if (replace[0] === '~') {
		plus += '~';
		replace = replace.substring(1);
	}

	if (replace[0] === '.') {
		plus += '.';
		replace = replace.substring(1);
	}

	if (!isRoot && replace[0] === '/') {
		plus += '/';
		replace = replace.substring(1);
	}

	if (filter instanceof Array) {
		for (var i = 0, length = filter.length; i < length; i++)
			filter[i] = (filter[i][0] !== '.' ? '.' : '') + filter[i].toLowerCase();
	}

	setTimeout(function() {
		framework_utils.ls(filename, function(files) {
			for (var i = 0, length = files.length; i < length; i++) {
				var file = files[i].replace(replace, '');

				if (filter) {
					if (typeof(filter) === 'function') {
						if (!filter(file))
							continue;
					} else {
						if (filter.indexOf(path.extname(file).toLowerCase()) === -1)
							continue;
					}
				}

				if (file[0] === '/')
					file = file.substring(1);
				var key = url + file;
				self.routes.mapping[key] = plus + files[i];
			}
		});
	}, isPackage ? 500 : 1);

	return this;
};

/**
 * Add a middleware
 * @param {String} name
 * @param {Function(req, res, next, options)} funcExecute
 * @return {Framework}
 */
Framework.prototype.middleware = function(name, funcExecute) {
	var self = this;
	self.install('middleware', name, funcExecute);
	return self;
};

/**
 * Add a global middleware
 * @param {String} name
 * @return {Framework}
 */
Framework.prototype.use = function(name) {
	var self = this;

	if (arguments.length) {
		for (var i = 0; i < arguments.length; i++)
			self.routes.request.push(arguments[i]);
	} else if (name instanceof Array) {
		for (var i = 0; i < name.length; i++)
			self.routes.request.push(name[i]);
	} else
		self.routes.request.push(name);

	self._length_request_middleware = self.routes.request.length;

	return self;
};

/**
 * Add a new websocket route
 * @param {String} url
 * @param {Function()} funcInitialize
 * @param {String Array} flags Optional.
 * @param {String Array} protocols Optional, framework compares this array with request protocol (http or https)
 * @param {String Array} allow Optional, framework compares this array with "origin" request header
 * @param {Number} length Optional, maximum message length.
 * @param {String Array} middleware Optional, middlewares.
 * @param {Object} options Optional, additional options for middleware.
 * @return {Framework}
 */
Framework.prototype.websocket = function(url, funcInitialize, flags, protocols, allow, length, middleware, options) {

	var tmp;

	var CUSTOM = typeof(url) === TYPE_FUNCTION ? url : null;
	if (CUSTOM)
		url = '/';

	if (url[0] === '#') {
		url = url.substring(1);
		var sitemap = self.sitemap(url, true);
		if (sitemap) {
			name = url;
			url = sitemap.url;
		} else
			throw new Error('Sitemap item "' + url + '" not found.');
	}

	if (url === '')
		url = '/';

	if (utils.isArray(length)) {
		tmp = middleware;
		middleware = length;
		length = tmp;
	}

	if (typeof(funcExecute) === OBJECT) {
		tmp = flags;
		funcExecute = flags;
		flags = tmp;
	}

	if (!(flags instanceof Array) && typeof(flags) === OBJECT) {
		protocols = flags['protocols'] || flags['protocol'];
		allow = flags['allow'] || flags['origin'];
		length = flags['max'] || flags['length'] || flags['maximum'] || flags['maximumSize'];
		middleware = flags['middleware'];
		options = flags['options'];
		flags = flags['flags'];
	}

	if (middleware === undefined)
		middleware = null;

	var self = this;
	var priority = 0;
	var index = url.indexOf(']');
	var subdomain = null;
	var isASTERIX = url.indexOf('*') !== -1;

	priority = url.count('/');

	if (index > 0) {
		subdomain = url.substring(1, index).trim().toLowerCase().split(',');
		url = url.substring(index + 1);
		priority += 2;
	}

	if (isASTERIX) {
		url = url.replace('*', '').replace('//', '/');
		priority = (-10) - priority;
	}

	var routeURL = framework_internal.routeSplitCreate(url.trim());
	var arr = [];
	var reg = null;
	var regIndex = null;

	if (url.indexOf('{') !== -1) {

		routeURL.forEach(function(o, i) {
			if (o.substring(0, 1) !== '{')
				return;
			arr.push(i);

			var sub = o.substring(1, o.length - 1);

			if (sub[0] !== '/')
				return;

			var index = sub.lastIndexOf('/');
			if (index === -1)
				return;

			if (!reg) {
				reg = {};
				regIndex = [];
			}

			reg[i] = new RegExp(sub.substring(1, index), sub.substring(index + 1));
			regIndex.push(i);
		});

		priority -= arr.length;
	}

	if (typeof(allow) === STRING)
		allow = allow[allow];

	if (typeof(protocols) === STRING)
		protocols = protocols[protocols];

	if (typeof(flags) === STRING)
		flags = flags[flags];

	tmp = [];

	var isJSON = false;
	var isBINARY = false;
	var count = 0;

	if (flags === undefined)
		flags = [];

	for (var i = 0; i < flags.length; i++) {

		if (flags[i][0] === '#') {
			if ((middleware || null) === null)
				middleware = [];
			middleware.push(flags[i].substring(1));
			continue;
		}

		flags[i] = flags[i].toString().toLowerCase();
		count++;

		if (flags[i] === 'json')
			isJSON = true;

		if (flags[i] === 'binary')
			isBINARY = true;

		if (flags[i] === 'raw') {
			isBINARY = false;
			isJSON = false;
		}

		if (flags[i] !== 'json' && flags[i] !== 'binary' && flags[i] !== 'raw')
			tmp.push(flags[i]);
	}

	flags = tmp;

	if (flags.indexOf('get') === -1)
		flags.unshift('get');

	priority += (count * 2);

	var isMember = false;

	if (!flags || (flags.indexOf('authorize') === -1))
		isMember = true;

	if (!middleware || (!(middleware instanceof Array)) || !middleware.length)
		middleware = null;

	self.routes.websockets.push({
		controller: !_controller ? 'unknown' : _controller,
		url: routeURL,
		param: arr,
		subdomain: subdomain,
		priority: priority,
		flags: flags || [],
		onInitialize: funcInitialize,
		protocols: protocols || [],
		allow: allow || [],
		length: (length || self.config['default-websocket-request-length']) * 1024,
		isWEBSOCKET: true,
		isMEMBER: isMember,
		isJSON: isJSON,
		isBINARY: isBINARY,
		isASTERIX: isASTERIX,
		isHTTPS: flags.indexOf('https'),
		isHTTP: flags.indexOf('http'),
		isDEBUG: flags.indexOf('debug'),
		isRELEASE: flags.indexOf('release'),
		CUSTOM: CUSTOM,
		middleware: middleware,
		options: options,
		isPARAM: arr.length > 0,
		regexp: reg,
		regexpIndexer: regIndex
	});

	self.emit('route-add', 'websocket', self.routes.websockets[self.routes.websockets.length - 1]);

	if (!_controller)
		self._routesSort();

	return self;
};

/**
 * Create a file route
 * @param {String} name
 * @param {Function} funcValidation
 * @param {Function} fnExecute
 * @param {String Array} middleware
 * @return {Framework}
 */
Framework.prototype.file = function(name, fnValidation, fnExecute, middleware, options) {

	var self = this;
	var a;

	if (utils.isArray(fnValidation)) {
		a = fnExecute;
		var b = middleware;
		middleware = fnValidation;
		fnValidation = a;
		fnExecute = b;
	} else if (utils.isArray(fnExecute)) {
		a = fnExecute;
		fnExecute = middleware;
		middleware = a;
	}

	if (middleware === undefined)
		middleware = null;

	if (middleware) {
		for (var i = 0, length = middleware.length; i < length; i++)
			middleware[i] = middleware[i].replace('#', '');
	}

	if (!middleware || (!(middleware instanceof Array)) || !middleware.length)
		middleware = null;

	self.routes.files.push({
		controller: !_controller ? 'unknown' : _controller,
		name: name,
		onValidation: fnValidation,
		execute: fnExecute || fnValidation,
		middleware: middleware,
		options: options
	});

	self.emit('route-add', 'file', self.routes.files[self.routes.files.length - 1]);
	self._length_files++;

	return self;
};

/**
 * Auto localize static files
 * @param {String} name Description
 * @param {String} url A relative url path (e.g. /templates/)
 * @param {String Array} middleware Optional
 * @param {Object} options Optional, middleware options
 * @return {Framework}
 */
Framework.prototype.localize = function(name, url, middleware, options) {

	var self = this;
	url = url.replace('*', '');

	var index = url.lastIndexOf('.');
	var extension = 'html|htm|md|txt';

	if (index !== -1) {
		extension = url.substring(index + 1);
		url = url.substring(0, index);
	}

	var fnExecute = function(req, res, is) {

		if (is)
			return req.url.substring(0, url.length) === url && extension.indexOf(req.extension) !== -1;

		var key = 'locate_' + (req.$language ? req.$language : 'default') + '_' + req.url;
		var output = framework.temporary.other[key];

		if (output) {
			framework.responseContent(req, res, 200, output, framework_utils.getContentType(req.extension), true);
			return;
		}

		var name = req.uri.pathname;
		var filename = self.onMapping(name, framework.path.public($decodeURIComponent(name)));

		fs.readFile(filename, function(err, content) {
			if (err)
				return res.throw404();
			content = framework.translator(req.$language, content.toString(ENCODING));
			if (!framework.isDebug)
				framework.temporary.other[key] = content;
			framework.responseContent(req, res, 200, content, framework_utils.getContentType(req.extension), true);
		});
	};

	self.file(name, fnExecute, middleware, options);
	return self;
};

/**
 * Error caller
 * @param {Error} err
 * @param {String} name Controller or Script name.
 * @param {Object} uri
 * @return {Framework}
 */
Framework.prototype.error = function(err, name, uri) {

	if (err === null)
		return this;

	if (err === undefined) {
		return function(err) {
			if (err)
				framework.error(err, name, uri);
		};
	}

	var self = this;

	if (self.errors !== null) {
		self.errors.push({
			error: err.stack,
			name: name,
			url: uri ? parser.format(uri) : null,
			date: new Date()
		});

		if (self.errors.length > 50)
			self.errors.shift();
	}

	self.onError(err, name, uri);
	return self;
};

/*
	Problem caller
	@message {String}
	@name {String} :: controller name
	@uri {URI} :: optional
	@ip {String} :: optional
	return {Framework}
*/
Framework.prototype.problem = function(message, name, uri, ip) {
	var self = this;

	if (self.problems !== null) {
		self.problems.push({
			message: message,
			name: name,
			url: uri ? parser.format(uri) : null,
			ip: ip
		});

		if (self.problems.length > 50)
			self.problems.shift();
	}

	self.emit('problem', message, name, uri, ip);
	return self;
};

/*
	Change caller
	@message {String}
	@name {String} :: controller name
	@uri {URI} :: optional
	@ip {String} :: optional
	return {Framework}
*/
Framework.prototype.change = function(message, name, uri, ip) {
	var self = this;

	if (self.changes !== null) {
		self.changes.push({
			message: message,
			name: name,
			url: uri ? parser.format(uri) : null,
			ip: ip
		});

		if (self.changes.length > 50)
			self.changes.shift();
	}

	self.emit('change', message, name, uri, ip);
	return self;
};

/**
 * Get a module
 * @param {String} name
 * @return {Object}
 */
Framework.prototype.module = function(name) {
	return this.modules[name] || null;
};

/**
 * Add a new modificator
 * @param {Function(type, filename, content)} fn The `fn` must return modified value.
 * @return {String}
 */
Framework.prototype.modify = function(fn) {
	var self = this;
	if (!self.modificators)
		self.modificators = [];
	self.modificators.push(fn);
	return self;
};

/**
 * Load framework
 * @return {Framework}
 */
Framework.prototype.$load = function(types) {

	var self = this;
	var dir = '';
	var arr = [];

	function listing(directory, level, output, extension) {
		if (!fs.existsSync(dir))
			return;

		if (!extension)
			extension = EXTENSION_JS;

		fs.readdirSync(directory).forEach(function(o) {
			var isDirectory = fs.statSync(path.join(directory, o)).isDirectory();
			if (isDirectory) {
				level++;
				listing(path.join(directory, o), level, output, extension);
				return;
			}
			var ext = path.extname(o).toLowerCase();
			if (ext !== extension)
				return;
			var name = (level > 0 ? directory.replace(dir, '') + '/' : '') + o.substring(0, o.length - ext.length);
			output.push({ name: name[0] === '/' ? name.substring(1) : name, filename: path.join(dir, name) + extension });
		});
	}

	if (!types || types.indexOf('modules') !== -1) {
		dir = path.join(directory, self.config['directory-modules']);
		arr = [];
		listing(dir, 0, arr, '.js');

		arr.forEach(function(item) {
			self.install('module', item.name, item.filename, undefined, undefined, undefined, true);
		});
	}

	if (!types || types.indexOf('isomorphic') !== -1) {
		dir = path.join(directory, self.config['directory-isomorphic']);
		arr = [];
		listing(dir, 0, arr, '.js');

		arr.forEach(function(item) {
			self.install('isomorphic', item.name, item.filename, undefined, undefined, undefined, true);
		});
	}

	if (!types || types.indexOf('packages') !== -1) {
		dir = path.join(directory, self.config['directory-packages']);
		arr = [];
		listing(dir, 0, arr, '.package');

		arr.forEach(function(item) {
			self.install('package', item.name, item.filename, undefined, undefined, undefined, true);
		});
	}

	if (!types || types.indexOf('models') !== -1) {
		dir = path.join(directory, self.config['directory-models']);
		arr = [];
		listing(dir, 0, arr);

		arr.forEach(function(item) {
			self.install('model', item.name, item.filename, undefined, undefined, undefined, true);
		});
	}

	if (!types || types.indexOf('definitions') !== -1) {
		dir = path.join(directory, self.config['directory-definitions']);
		arr = [];
		listing(dir, 0, arr);

		arr.forEach(function(item) {
			self.install('definition', item.name, item.filename, undefined, undefined, undefined, true);
		});
	}

	if (!types || types.indexOf('controllers') !== -1) {
		arr = [];
		dir = path.join(directory, self.config['directory-controllers']);
		listing(dir, 0, arr);

		arr.forEach(function(item) {
			self.install('controller', item.name, item.filename, undefined, undefined, undefined, true);
		});
	}

	self._routesSort();

	if (!types || types.indexOf('dependencies') !== -1)
		self._configure_dependencies();

	return self;
};

/**
 * Install type with its declaration
 * @param {String} type Available types: model, module, controller, source.
 * @param {String} name Default name (optional).
 * @param {String or Function} declaration
 * @param {Object} options Custom options, optional.
 * @param {Object} internal Internal/Temporary options, optional.
 * @param {Boolean} useRequired Internal, optional.
 * @param {Boolean} skipEmit Internal, optional.
 * @return {Framework}
 */
Framework.prototype.install = function(type, name, declaration, options, callback, internal, useRequired, skipEmit) {

	var self = this;
	var obj = null;

	if (type !== 'config' && type !== 'version' && typeof(name) === STRING) {
		if (name.startsWith('http://') || name.startsWith('https://')) {
			if (typeof(declaration) === OBJECT) {
				callback = options;
				options = declaration;
				declaration = name;
				name = '';
			}
		}
	}

	var t = typeof(declaration);
	var key = '';
	var tmp = null;

	if (t === OBJECT) {
		t = typeof(options);
		if (t === TYPE_FUNCTION)
			callback = options;
		options = declaration;
		declaration = undefined;
	}

	if (declaration === undefined) {
		declaration = name;
		name = '';
	}

	// Check if declaration is a valid URL address
	if (typeof(declaration) === STRING) {

		if (declaration.startsWith('http://') || declaration.startsWith('https://')) {

			if (type === 'package') {

				utils.download(declaration, ['get'], function(err, response) {

					if (err) {
						self.error(err, 'framework.install(\'{0}\', \'{1}\')'.format(type, declaration), null);
						if (callback)
							callback(err);
						return;
					}

					var id = path.basename(declaration, '.package');
					var filename = framework.path.temp(id + '.package');
					var stream = fs.createWriteStream(filename);

					response.pipe(stream);
					stream.on('finish', function() {
						self.install(type, id, filename, options, undefined, undefined, true);
					});

				});

				return self;
			}

			utils.request(declaration, ['get'], function(err, data, code) {

				if (code !== 200 && !err)
					err = new Error(data);

				if (err) {
					self.error(err, 'framework.install(\'{0}\', \'{1}\')'.format(type, declaration), null);
					if (callback)
						callback(err);
					return;
				}

				self.install(type, name, data, options, callback, declaration);

			});

			return self;
		}
	}

	// self._log('Install "' + type + '": ' + name);

	if (type === 'middleware') {

		self.routes.middleware[name] = typeof(declaration) === TYPE_FUNCTION ? declaration : eval(declaration);
		self._length_middleware = Object.keys(self.routes.middleware).length;

		if (callback)
			callback(null);

		key = type + '.' + name;

		if (self.dependencies[key]) {
			self.dependencies[key].updated = new Date();
		} else {
			self.dependencies[key] = { name: name, type: type, installed: new Date(), updated: null, count: 0 };
			if (internal)
				self.dependencies[key].url = internal;
		}

		self.dependencies[key].count++;

		setTimeout(function() {
			self.emit(type + '#' + name);
			self.emit('install', type, name);
		}, 500);

		return self;
	}

	if (type === 'config' || type === 'configuration' || type === 'settings') {

		self._configure(declaration instanceof Array ? declaration : declaration.toString().split('\n'), true);

		setTimeout(function() {
			delete self.temporary['mail-settings'];
			self.emit(type + '#' + name);
			self.emit('install', type, name);
		}, 500);

		if (callback)
			callback(null);

		return self;
	}

	if (type === 'version' || type === 'versions') {

		self._configure_versions(declaration.toString(), true);
		setTimeout(function() {
			self.emit(type + '#' + name);
			self.emit('install', type, name);
		}, 500);

		if (callback)
			callback(null);

		return self;
	}

	if (type === 'sitemap') {

		self._configure_sitemap(declaration.toString(), true);
		setTimeout(function() {
			self.emit(type + '#' + name);
			self.emit('install', type, name);
		}, 500);

		if (callback)
			callback(null);

		return self;
	}

	if (type === 'package') {

		var backup = new Backup();
		var id = path.basename(declaration, '.package');
		var dir = path.join(framework.path.root(), framework.config['directory-temp'], id);

		self.routes.packages[id] = dir;
		backup.restore(declaration, dir, function() {

			var filename = path.join(dir, 'index.js');
			self.install('module', id, filename, options, function(err) {

				setTimeout(function() {
					self.emit(type + '#' + name);
					self.emit('install', type, name);
				}, 500);

				if (callback)
					callback(err);

			}, internal, useRequired, true);

		});

		return self;
	}

	var plus = self.id === null ? '' : 'instance-' + self.id + '-';

	if (type === 'view') {

		var item = self.routes.views[name];
		key = type + '.' + name;

		if (item === undefined) {
			item = {};
			item.filename = self.path.temporary('installed-' + plus + 'view-' + utils.GUID(10) + '.tmp');
			item.url = internal;
			item.count = 0;
			self.routes.views[name] = item;
		}

		item.count++;

		fs.writeFileSync(item.filename, declaration);

		setTimeout(function() {
			self.emit(type + '#' + name);
			self.emit('install', type, name);
		}, 500);

		if (callback)
			callback(null);

		return self;
	}

	if (type === 'definition' || type === 'eval') {

		_controller = '';

		try {

			if (useRequired) {
				delete require.cache[require.resolve(declaration)];
				obj = require(declaration);

				(function(name) {

					setTimeout(function() {
						delete require.cache[name];
					}, 1000);

				})(require.resolve(declaration));
			}
			else
				obj = typeof(declaration) === TYPE_FUNCTION ? eval('(' + declaration.toString() + ')()') : eval(declaration);

		} catch (ex) {

			self.error(ex, 'framework.install(\'' + type + '\')', null);

			if (callback)
				callback(ex);

			return self;
		}

		if (callback)
			callback(null);

		setTimeout(function() {
			self.emit(type + '#' + name);
			self.emit('install', type, name);
		}, 500);

		return self;
	}

	if (type === 'isomorphic') {

		var content = '';

		try {

			if (useRequired) {
				delete require.cache[require.resolve(declaration)];
				obj = require(declaration);
				content = fs.readFileSync(declaration).toString(ENCODING);
				(function(name) {
					setTimeout(function() {
						delete require.cache[name];
					}, 1000);
				})(require.resolve(declaration));
			}
			else {
				obj = typeof(declaration) === TYPE_FUNCTION ? eval('(' + declaration.toString() + ')()') : eval(declaration);
				content = declaration.toString();
			}

		} catch (ex) {

			self.error(ex, 'framework.install(\'' + type + '\')', null);

			if (callback)
				callback(ex);

			return self;
		}

		if (typeof(obj.id) === STRING)
			name = obj.id;
		else if (typeof(obj.name) === STRING)
			name = obj.name;

		if (obj.url)
			framework.map(obj.url, '#' + name);

		framework.isomorphic[name] = obj;
		framework.isomorphic[name].$$output = framework_internal.compile_javascript(content, '#' + name);

		if (callback)
			callback(null);

		setTimeout(function() {
			self.emit(type + '#' + name);
			self.emit('install', type, name);
		}, 500);

		return self;
	}

	if (type === 'model' || type === 'source') {

		_controller = '';

		try {

			if (useRequired) {

				obj = require(declaration);

				(function(name) {

					setTimeout(function() {
						delete require.cache[name];
					}, 1000);

				})(require.resolve(declaration));

			}
			else {

				if (typeof(declaration) !== STRING)
					declaration = declaration.toString();

				var filename = self.path.temporary('installed-' + plus + type + '-' + utils.GUID(10) + '.js');
				fs.writeFileSync(filename, declaration);
				obj = require(filename);

				(function(name, filename) {

					setTimeout(function() {
						fs.unlinkSync(filename);
						delete require.cache[name];
					}, 1000);

				})(require.resolve(filename), filename);
			}

		} catch (ex) {

			self.error(ex, 'framework.install(\'' + type + '\', \'' + name + '\')', null);

			if (callback)
				callback(ex);

			return self;
		}

		if (typeof(obj.id) === STRING)
			name = obj.id;
		else if (typeof(obj.name) === STRING)
			name = obj.name;

		key = type + '.' + name;
		tmp = self.dependencies[key];

		self.uninstall(type, name);

		if (tmp) {
			self.dependencies[key] = tmp;
			self.dependencies[key].updated = new Date();
		}
		else {
			self.dependencies[key] = { name: name, type: type, installed: new Date(), updated: null, count: 0 };
			if (internal)
				self.dependencies[key].url = internal;
		}

		self.dependencies[key].count++;

		if (obj.reinstall)
			self.dependencies[key].reinstall = obj.reinstall.toString().parseDateExpiration();
		else
			delete self.dependencies[key];

		if (type === 'model')
			self.models[name] = obj;
		else
			self.sources[name] = obj;

		if (typeof(obj.install) === TYPE_FUNCTION) {
			if (framework.config['allow-compatibility'] || obj.install.toString().indexOf('function (framework') === 0) {
				console.log('OBSOLETE ' + key + ': exports.install = function(framework <-- REMOVE ARGUMENT, options, name) { ...');
				obj.install(self, options, name);
			} else
				obj.install(options, name);
		}

		if (!skipEmit) {
			setTimeout(function() {
				self.emit(type + '#' + name);
				self.emit('install', type, name);
			}, 500);
		}

		if (callback)
			callback(null);

		return self;
	}

	if (type === 'module' || type === 'controller') {

		// for inline routes
		var _ID = _controller = 'TMP' + Utils.random(10000);

		try {

			if (useRequired) {
				obj = require(declaration);
				(function(name) {
					setTimeout(function() {
						delete require.cache[name];
					}, 1000);
				})(require.resolve(declaration));
			}
			else {

				if (typeof(declaration) !== STRING)
					declaration = declaration.toString();

				filename = self.path.temporary('installed-' + plus + type + '-' + utils.GUID(10) + '.js');
				fs.writeFileSync(filename, declaration);
				obj = require(filename);
				(function(name, filename) {
					setTimeout(function() {
						fs.unlinkSync(filename);
						delete require.cache[name];
					}, 1000);
				})(require.resolve(filename), filename);
			}

		} catch (ex) {

			self.error(ex, 'framework.install(\'' + type + '\', \'' + (name ? '' : internal) + '\')', null);

			if (callback)
				callback(ex);

			return self;
		}

		if (typeof(obj.id) === STRING)
			name = obj.id;
		else if (typeof(obj.name) === STRING)
			name = obj.name;

		key = type + '.' + name;
		tmp = self.dependencies[key];

		self.uninstall(type, name);

		if (tmp) {
			self.dependencies[key] = tmp;
			self.dependencies[key].updated = new Date();
		}
		else {
			self.dependencies[key] = { name: name, type: type, installed: new Date(), updated: null, count: 0, _id: _ID };
			if (internal)
				self.dependencies[key].url = internal;
		}

		self.dependencies[key].dependencies = obj.dependencies;
		self.dependencies[key].count++;
		self.dependencies[key].processed = false;

		if (obj.reinstall)
			self.dependencies[key].reinstall = obj.reinstall.toString().parseDateExpiration();
		else
			delete self.dependencies[key].reinstall;

		_controller = _ID;

		if (obj.dependencies instanceof Array) {
			for (var i = 0, length = obj.dependencies.length; i < length; i++) {
				if (!self.dependencies[type + '.' + obj.dependencies[i]]) {
					self.temporary.dependencies[key] = { obj: obj, options: options, callback: callback, skipEmit: skipEmit };
					return self;
				}
			}
		}

		self.install_make(key, name, obj, options, callback, skipEmit);

		if (type === 'module')
			self.modules[name] = obj;
		else
			self.controllers[name] = obj;

		self.install_prepare();
		return self;
	}

	return self;
};

Framework.prototype.install_prepare = function(noRecursive) {

	var self = this;
	var keys = Object.keys(self.temporary.dependencies);

	if (!keys.length)
		return;

	// check dependencies
	for (var i = 0, length = keys.length; i < length; i++) {

		var k = keys[i];
		var a = self.temporary.dependencies[k];
		var b = self.dependencies[k];
		var skip = false;

		if (b.processed)
			continue;

		for (var j = 0, jl = b.dependencies.length; j < jl; j++) {
			var d = self.dependencies['module.' + b.dependencies[j]];
			if (!d || !d.processed) {
				skip = true;
				break;
			}
		}

		if (skip)
			continue;

		delete self.temporary.dependencies[k];

		if (b.type === 'module')
			self.modules[b.name] = a.obj;
		else
			self.controllers[b.name] = a.obj;

		self.install_make(k, b.name, a.obj, a.options, a.callback, a.skipEmit);
	}

	keys = Object.keys(self.temporary.dependencies);

	clearTimeout(self.temporary.other.dependencies);
	self.temporary.other.dependencies = setTimeout(function() {
		var keys = Object.keys(framework.temporary.dependencies);
		if (keys.length)
			throw new Error('Dependency exception (module): missing dependencies for: ' + keys.join(', ').trim());
		delete self.temporary.other.dependencies;
	}, 1500);

	if (!keys.length)
		return self;

	if (noRecursive)
		return self;

	self.install_prepare(true);
	return self;
};

Framework.prototype.install_make = function(key, name, obj, options, callback, skipEmit) {

	var self = this;
	var me = self.dependencies[key];
	var routeID = me._id;
	var type = me.type;

	_controller = routeID;

	if (typeof(obj.install) === TYPE_FUNCTION) {
		if (framework.config['allow-compatibility'] || obj.install.toString().indexOf('function (framework') === 0) {
			console.log('OBSOLETE ' + key + ': exports.install = function(framework <-- REMOVE ARGUMENT, options, name) { ...');
			obj.install(self, options, name);
		}
		else
			obj.install(options, name);
	}

	me.processed = true;

	var id = (type === 'module' ? '#' : '') + name;
	var length = self.routes.web.length;

	for (var i = 0; i < length; i++) {
		if (self.routes.web[i].controller === routeID)
			self.routes.web[i].controller = id;
	}

	length = self.routes.websockets.length;
	for (var i = 0; i < length; i++) {
		if (self.routes.websockets[i].controller === routeID)
			self.routes.websockets[i].controller = id;
	}

	length = self.routes.files.length;
	for (var i = 0; i < length; i++) {
		if (self.routes.files[i].controller === routeID)
			self.routes.files[i].controller = id;
	}

	self._routesSort();
	_controller = '';

	if (!skipEmit) {
		setTimeout(function() {
			self.emit(type + '#' + name);
			self.emit('install', type, name);
		}, 500);
	}

	if (callback)
		callback(null);

	return self;
};

/**
 * Uninstall type
 * @param {String} type Available types: model, module, controller, source.
 * @param {String} name
 * @param {Object} options Custom options, optional.
 * @param {Object} skipEmit Internal, optional.
 * @return {Framework}
 */
Framework.prototype.uninstall = function(type, name, options, skipEmit) {

	var self = this;
	var obj = null;

	if (type === 'schema') {
		Builders.remove(name);
		self.emit('uninstall', type, name);
		return self;
	}

	if (type === 'mapping') {
		delete self.routes.mapping[name];
		self.emit('uninstall', type, name);
		return self;
	}

	if (type === 'isomorphic') {
		var obj = self.isomorphic[name];
		if (obj.url)
			delete self.routes.mapping[self._version(obj.url)];
		delete self.isomorphic[name];
		self.emit('uninstall', type, name);
		return self;
	}

	if (type === 'middleware') {

		if (!self.routes.middleware[name])
			return self;

		delete self.routes.middleware[name];
		delete self.dependencies[type + '.' + name];
		self._length_middleware = Object.keys(self.routes.middleware).length;
		self.emit('uninstall', type, name);
		return self;
	}

	if (type === 'package') {
		delete self.routes.packages[name];
		self.uninstall('module', name, options, true);
		return self;
	}

	if (type === 'view' || type === 'precompile') {

		obj = self.routes.views[name];

		if (!obj)
			return self;

		delete self.routes.views[name];
		delete self.dependencies[type + '.' + name];

		fsFileExists(obj.filename, function(exist) {
			if (exist)
				fs.unlink(obj.filename);
		});

		self.emit('uninstall', type, name);
		return self;
	}

	if (type === 'model' || type === 'source') {

		obj = type === 'model' ? self.models[name] : self.sources[name];

		if (!obj)
			return self;

		if (obj.id)
			delete require.cache[require.resolve(obj.id)];

		if (typeof(obj.uninstall) === TYPE_FUNCTION) {
			if (framework.config['allow-compatibility'])
				obj.uninstall(self, options, name);
			else
				obj.uninstall(options, name);
		}

		if (type === 'model')
			delete self.models[name];
		else
			delete self.sources[name];

		delete self.dependencies[type + '.' + name];

		self._routesSort();
		self.emit('uninstall', type, name);
		return self;
	}

	if (type === 'module' || type === 'controller') {

		var isModule = type === 'module';
		obj = isModule ? self.modules[name] : self.controllers[name];

		if (!obj)
			return self;

		if (obj.id)
			delete require.cache[require.resolve(obj.id)];

		var id = (isModule ? '#' : '') + name;

		self.routes.web = self.routes.web.remove('controller', id);
		self.routes.files = self.routes.files.remove('controller', id);
		self.routes.websockets = self.routes.websockets.remove('controller', id);

		if (obj) {
			if (obj.uninstall) {
				if (framework.config['allow-compatibility'])
					obj.uninstall(self, options, name);
				else
					obj.uninstall(options, name);
			}

			if (isModule)
				delete self.modules[name];
			else
				delete self.controllers[name];
		}

		self._routesSort();
		delete self.dependencies[type + '.' + name];

		if (!skipEmit)
			self.emit('uninstall', type, name);

		return self;
	}

	return self;
};

/**
 * Run code
 * @param {String or Function} script Function to eval or Code or URL address.
 * @return {Framework}
 */
Framework.prototype.eval = function(script) {
	return this.install('eval', script);
};

/**
 * Error handler
 * @param {Error} err
 * @param {String} name
 * @param {Object} uri URI address, optional.
 * @return {Framework}
 */
Framework.prototype.onError = function(err, name, uri) {
	console.log('======= ' + (new Date().format('yyyy-MM-dd HH:mm:ss')) + ': ' + (name ? name + ' ---> ' : '') + err.toString() + (uri ? ' (' + parser.format(uri) + ')' : ''), err.stack);
	return this;
};

/*
	Authorization handler
	@req {ServerRequest}
	@res {ServerResponse} OR {WebSocketClient}
	@flags {String array}
	@callback {Function} - @callback(Boolean), true is [authorize]d and false is [unauthorize]d
*/
Framework.prototype.onAuthorization = null;

/*
	Sets the current language for the current request
	@req {ServerRequest}
	@res {ServerResponse} OR {WebSocketClient}
	@return {String}
*/
Framework.prototype.onLocate = null;

/*
	Versioning static files (this delegate call LESS CSS by the background property)
	@name {String} :: name of static file (style.css or script.js)
	return {String} :: return new name of static file (style-new.css or script-new.js)
*/
Framework.prototype.onVersion = null;

/**
 * On mapping static files
 * @param {String} url
 * @param {String} def Default value.
 * @return {String}
 */
Framework.prototype.onMapping = function(url, def) {
	if (url[0] !== '/')
		url = '/' + url;
	if (this.routes.mapping[url])
		return this.routes.mapping[url];
	return def;
};

/**
 * Snapshot
 * @param {String} url Relative URL.
 * @param {String} filename Filename to save output.
 * @param {Function} callback
 * @return {Framework}
 */
Framework.prototype.snapshot = function(url, filename, callback) {
	var self = this;

	if (!url.match(/^http:|https:/gi)) {
		if (url[0] !== '/')
			url = '/' + url;
		var ip = self.ip === 'auto' ? '0.0.0.0' : self.ip;
		url = 'http://' + ip + ':' + self.port + url;
	}

	framework_utils.download(url, ['get'], function(error, response) {
		var stream = fs.createWriteStream(filename);
		response.pipe(stream);
		FINISHED(stream, function() {
			DESTROY(stream);
			if (callback)
				setImmediate(callback);
		});
	});

	return self;
};

/*
	Global framework validation
	@name {String}
	@value {String}
	return {Boolean or utils.isValid() or StringErrorMessage};
*/
Framework.prototype.onValidation = null;

/**
 * Schema parser delegate
 * @param {Request} req
 * @param {String} group
 * @param {String} name
 * @param {Function(err, body)} callback
 */
Framework.prototype.onSchema = function(req, group, name, callback) {

	var schema = GETSCHEMA(group, name);

	if (!schema) {
		callback(new Error('Schema not found.'));
		return;
	}

	schema.make(req.body, function(err, result) {
		if (err)
			callback(err);
		else
			callback(null, result);
	});
};

/**
 * Mail delegate
 * @param {String or Array String} address
 * @param {String} subject
 * @param {String} body
 * @param {Function(err)} callback
 * @param {String} replyTo
 * @return {MailMessage}
 */
Framework.prototype.onMail = function(address, subject, body, callback, replyTo) {

	var tmp;

	if (typeof(callback) === STRING) {
		tmp = replyTo;
		replyTo = callback;
		callback = tmp;
	}

	var message = Mail.create(subject, body);

	if (address instanceof Array) {
		var length = address.length;
		for (var i = 0; i < length; i++)
			message.to(address[i]);
	} else
		message.to(address);

	var self = this;

	message.from(self.config['mail.address.from'] || '', self.config.name);
	tmp = self.config['mail.address.reply'];

	if (replyTo)
		message.reply(replyTo);
	else if (tmp && tmp.isEmail())
		message.reply(self.config['mail.address.reply']);

	tmp = self.config['mail.address.copy'];

	if (tmp && tmp.isEmail())
		message.bcc(tmp);

	var opt = self.temporary['mail-settings'];

	if (opt === undefined) {
		var config = self.config['mail.smtp.options'];
		if (config && config.isJSON())
			opt = JSON.parse(config);
		self.temporary['mail-settings'] = opt;
	}

	setTimeout(function() {
		message.send(self.config['mail.smtp'], opt, callback);
	}, 2);

	return message;
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
	var length = arguments.length;

	for (var i = 0; i < length; i++) {

		var arg = utils.encode(arguments[i]);
		if (arg === null || !arg.length)
			continue;

		switch (i) {
			case 0:
				builder += '<title>' + (arg + (self.url !== '/' && !self.config['allow-custom-titles'] ? ' - ' + self.config.name : '')) + '</title>';
				break;
			case 1:
				builder += '<meta name="description" content="' + arg + '" />';
				break;
			case 2:
				builder += '<meta name="keywords" content="' + arg + '" />';
				break;
			case 3:
				var tmp = arg.substring(0, 6);
				var img = tmp === 'http:/' || tmp === 'https:' || arg.substring(0, 2) === '//' ? arg : self.hostname(self.routeImage(arg));
				builder += '<meta property="og:image" content="' + img + '" /><meta name="twitter:image" content="' + img + '" />';
				break;
		}
	}

	return builder;
};

// @arguments {Object params}
Framework.prototype.log = function() {

	var self = this;
	var now = new Date();
	var filename = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padLeft(2, '0') + '-' + now.getDate().toString().padLeft(2, '0');
	var time = now.getHours().toString().padLeft(2, '0') + ':' + now.getMinutes().toString().padLeft(2, '0') + ':' + now.getSeconds().toString().padLeft(2, '0');
	var str = '';
	var length = arguments.length;

	for (var i = 0; i < length; i++) {
		var val = arguments[i];
		if (val === undefined)
			val = 'undefined';
		else if (val === null)
			val = 'null';
		else if (typeof(val) === OBJECT)
			val = util.inspect(val);
		str += (str ? ' ' : '') + val;
	}

	self.path.verify('logs');
	fs.appendFile(utils.combine(self.config['directory-logs'], filename + '.log'), time + ' | ' + str + '\n');
	return self;
};

Framework.prototype.logger = function() {
	var self = this;
	var now = new Date();
	var dt = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padLeft(2, '0') + '-' + now.getDate().toString().padLeft(2, '0') + ' ' + now.getHours().toString().padLeft(2, '0') + ':' + now.getMinutes().toString().padLeft(2, '0') + ':' + now.getSeconds().toString().padLeft(2, '0');
	var str = '';
	var length = arguments.length;

	for (var i = 1; i < length; i++) {
		var val = arguments[i];
		if (val === undefined)
			val = 'undefined';
		else if (val === null)
			val = 'null';
		else if (typeof(val) === OBJECT)
			val = util.inspect(val);
		str += (str ? ' ' : '') + val;
	}

	self.path.verify('logs');
	fs.appendFile(utils.combine(self.config['directory-logs'], arguments[0] + '.log'), dt + ' | ' + str + '\n');
	return self;
};

Framework.prototype.logmail = function(address, subject, body, callback) {

	if (typeof(body) === FUNCTION) {
		callback = body;
		body = subject;
		subject = null;
	} else if (body === undefined) {
		body = subject;
		subject = null;
	}

	if (!subject)
		subject = framework.config.name + ' v' + framework.config.version;

	var self = this;
	var body = '<!DOCTYPE html><html><head><title>' + subject + '</title><meta charset="utf-8" /></head><body><pre>' + (typeof(body) === OBJECT ? JSON.stringify(body).escape() : body) + '</pre></body></html>';
	return framework.onMail(address, subject, body, callback);
};

/*
	Return string of framework usage information
	@detailed {Boolean} :: default (false)
	return {String}
*/
Framework.prototype.usage = function(detailed) {
	var self = this;
	var memory = process.memoryUsage();
	var cache = Object.keys(self.cache.items);
	var resources = Object.keys(self.resources);
	var controllers = Object.keys(self.controllers);
	var connections = Object.keys(self.connections);
	var workers = Object.keys(self.workers);
	var modules = Object.keys(self.modules);
	var isomorphic = Object.keys(self.isomorphic);
	var models = Object.keys(self.models);
	var helpers = Object.keys(self.helpers);
	var staticFiles = Object.keys(self.temporary.path);
	var staticRange = Object.keys(self.temporary.range);
	var redirects = Object.keys(self.routes.redirects);
	var output = {};

	output.framework = {
		pid: process.pid,
		node: process.version,
		version: 'v' + self.version_header,
		platform: process.platform,
		processor: process.arch,
		uptime: Math.floor(process.uptime() / 60),
		memoryTotal: (memory.heapTotal / 1024 / 1024).floor(2),
		memoryUsage: (memory.heapUsed / 1024 / 1024).floor(2),
		mode: self.config.debug ? 'debug' : 'release',
		port: self.port,
		ip: self.ip,
		directory: process.cwd()
	};

	var keys = Object.keys(framework_utils.queuecache);
	var pending = 0;
	for (var i = 0, length = keys.length; i < length; i++)
		pending += framework_utils.queuecache[keys[i]].pending.length;

	output.counter = {
		resource: resources.length,
		controller: controllers.length,
		module: modules.length,
		isomorphic: isomorphic.length,
		cache: cache.length,
		worker: workers.length,
		connection: connections.length,
		schedule: self.schedules.length,
		helpers: helpers.length,
		error: self.errors.length,
		problem: self.problems.length,
		queue: pending,
		files: staticFiles.length,
		streaming: staticRange.length,
		modificator:  self.modificators ? self.modificators.length : 0
	};

	output.routing = {
		webpage: self.routes.web.length,
		sitemap: self.routes.sitemap ? Object.keys(self.routes.sitemap).length : 0,
		websocket: self.routes.websockets.length,
		file: self.routes.files.length,
		middleware: Object.keys(self.routes.middleware).length,
		redirect: redirects.length
	};

	output.stats = self.stats;
	output.redirects = redirects;

	if (self.restrictions.isRestrictions) {
		output.restrictions = {
			allowed: [],
			blocked: [],
			allowedHeaders: self.restrictions.allowedCustomKeys,
			blockedHeaders: self.restrictions.blockedCustomKeys
		};
	}

	if (!detailed)
		return output;

	output.controllers = [];

	controllers.forEach(function(o) {
		var item = self.controllers[o];
		output.controllers.push({
			name: o,
			usage: item.usage === undefined ? null : item.usage()
		});
	});

	output.connections = [];

	connections.forEach(function(o) {
		output.connections.push({
			name: o,
			online: self.connections[o].online
		});
	});

	output.modules = [];

	modules.forEach(function(o) {
		var item = self.modules[o];
		output.modules.push({
			name: o,
			usage: item.usage === undefined ? null : item.usage()
		});
	});

	output.models = [];

	models.forEach(function(o) {
		var item = self.models[o];
		output.models.push({
			name: o,
			usage: item.usage === undefined ? null : item.usage()
		});
	});

	output.helpers = helpers;
	output.cache = cache;
	output.resources = resources;
	output.errors = self.errors;
	output.problems = self.problems;
	output.changes = self.changes;
	output.files = staticFiles;
	output.streaming = staticRange;
	output.other = Object.keys(self.temporary.other);
	return output;
};

/**
 * Compiles content in the view @{compile}...@{end}. The function has controller context, this === controler.
 * @param {String} name
 * @param {String} html HTML content to compile
 * @param {Object} model
 * @return {String}
 */
Framework.prototype.onCompileView = function(name, html, model) {
	return html;
};

/*
	3rd CSS compiler (Sync)
	@filename {String}
	@content {String} :: Content of CSS file
	return {String}
*/
Framework.prototype.onCompileStyle = null;
Framework.prototype.onCompileCSS = null; // obsolete

/*
	3rd JavaScript compiler (Sync)
	@filename {String}
	@content {String} :: Content of JavaScript file
	return {String}
*/
Framework.prototype.onCompileScript = null;
Framework.prototype.onCompileJS = null;  // obsolete

/**
 * Compile content (JS, CSS, HTML)
 * @param {String} extension File extension.
 * @param {String} content File content.
 * @param {String} filename
 * @return {String}
 */
Framework.prototype.compileContent = function(extension, content, filename) {

	var self = this;

	if (filename && (filename.indexOf('.min.') !== -1 || filename.indexOf('-min.') !== -1))
		return content;

	switch (extension) {
		case 'js':
			return self.config['allow-compile-script'] ? framework_internal.compile_javascript(content, filename) : content;
		case 'css':

			content = self.config['allow-compile-style'] ? framework_internal.compile_css(content, filename) : content;

			var matches = content.match(/url\(.*?\)/g);
			if (matches === null)
				return content;

			matches.forEach(function(o) {
				var url = o.substring(4, o.length - 1);
				content = content.replace(o, 'url(' + self._version(url) + ')');
			});

			return content;
	}

	return content;
};

/**
 * Compile static file
 * @param {URI} uri
 * @param {String} key Temporary key.
 * @param {String} filename
 * @param {String} extension File extension.
 * @param {Function()} callback
 * @return {Framework}
 */
Framework.prototype.compileFile = function(uri, key, filename, extension, callback) {

	var self = this;

	fsFileRead(filename, function(err, buffer) {

		if (err) {
			self.error(err, filename, uri);
			self.temporary.path[key] = null;
			callback();
			return;
		}

		var file = self.path.temp((self.id === null ? '' : 'instance-' + self.id + '-') + createTemporaryKey(uri.pathname));
		self.path.verify('temp');
		fs.writeFileSync(file, self.compileContent(extension, buffer.toString(ENCODING), filename), ENCODING);
		self.temporary.path[key] = file + ';' + fs.statSync(file).size;
		callback();

	});

	return self;
};

/**
 * Merge static files (JS, CSS, HTML, TXT, JSON)
 * @param {URI} uri
 * @param {String} key Temporary key.
 * @param {String} extension File extension.
 * @param {Function()} callback
 * @return {Framework}
 */
Framework.prototype.compileMerge = function(uri, key, extension, callback) {

	var self = this;
	var merge = self.routes.merge[uri.pathname];
	var filename = merge.filename;

	if (!self.config.debug && fs.existsSync(filename)) {
		self.temporary.path[key] = filename + ';' + fs.statSync(filename).size;
		callback();
		return self;
	}

	var writer = fs.createWriteStream(merge.filename);

	writer.on('finish', function() {
		self.temporary.path[key] = filename + ';' + fs.statSync(filename).size;
		callback();
	});

	var index = 0;

	merge.files.wait(function(filename, next) {

		if (filename.startsWith('http://') || filename.startsWith('https://')) {
			Utils.request(filename, ['get'], function(err, data) {
				var output = self.compileContent(extension, data, filename).trim();

				if (extension === 'js') {
					if (output[output.length - 1] !== ';')
						output += ';';
				} else if (extension === 'html') {
					if (output[output.length - 1] !== NEWLINE)
						output += NEWLINE;
				}

				if (framework.isDebug)
					merge_debug_writer(writer, filename, extension, index++);

				writer.write(output, ENCODING);
				next();
			});
			return;
		}

		if (filename[0] === '#') {
			if (framework.isDebug)
				merge_debug_writer(writer, filename, 'js', index++);
			writer.write(prepare_isomorphic(filename.substring(1)), ENCODING);
			next();
			return;
		}

		if (filename[0] !== '~') {
			var tmp = self.path.public(filename);
			if (self.isVirtualDirectory && !fs.existsSync(tmp))
				tmp = self.path.virtual(filename);
			filename = tmp;
		}
		else
			filename = filename.substring(1);

		fsFileRead(filename, function(err, buffer) {

			if (err) {
				self.error(err, merge.filename, uri);
				next();
				return;
			}

			var output = self.compileContent(extension, buffer.toString(ENCODING), filename).trim();

			if (extension === 'js') {
				if (output[output.length - 1] !== ';')
					output += ';';
			} else if (extension === 'html') {
				if (output[output.length - 1] !== NEWLINE)
					output += NEWLINE;
			}

			if (framework.isDebug)
				merge_debug_writer(writer, filename, extension, index++);

			writer.write(output, ENCODING);
			next();
		});

	}, function() {
		writer.end();
	});

	return self;
};

function merge_debug_writer(writer, filename, extension, index) {
	var plus = '===========================================================================================';
	var beg = extension === 'js' ? '/*\n' : extension === 'css' ? '/*!\n' : '<!--\n';
	var end = extension === 'js' || extension === 'css' ? '\n */' : '\n-->';
	var mid = extension !== 'html' ? ' * ' : ' ';
	writer.write((index > 0 ? '\n\n' : '') + beg + mid + plus + '\n' + mid + 'MERGED: ' + filename + '\n' + mid + plus + end + '\n\n', ENCODING);
}

/**
 * Validating static file for compilation
 * @param {URI} uri
 * @param {String} key Temporary key.
 * @param {String} filename
 * @param {String} extension File extension.
 * @param {Function()} callback
 * @return {Framework}
 */
Framework.prototype.compileValidation = function(uri, key, filename, extension, callback) {

	var self = this;

	if (self.routes.merge[uri.pathname]) {
		self.compileMerge(uri, key, extension, callback);
		return;
	}

	if (!fs.existsSync(filename)) {

		// file doesn't exist
		if (!self.isVirtualDirectory) {
			self.temporary.path[key] = null;
			callback();
			return self;
		}

		var tmpname = filename.replace(self.config['directory-public'], self.config['directory-public-virtual']);
		var notfound = true;

		if (tmpname !== filename) {
			filename = tmpname;
			notfound = !fs.existsSync(filename);
		}

		if (notfound) {
			self.temporary.path[key] = null;
			callback();
			return self;
		}

	}

	if (extension === 'js' || extension === 'css') {
		if (filename.lastIndexOf('.min.') === -1 && filename.lastIndexOf('-min.') === -1) {
			self.compileFile(uri, key, filename, extension, callback);
			return self;
		}
	}

	self.temporary.path[key] = filename + ';' + fs.statSync(filename).size;
	callback();

	return self;
};

/**
 * Server all static files
 * @param {Request} req
 * @param {Response} res
 * @return {Framework}
 */
Framework.prototype.responseStatic = function(req, res, done) {

	var self = this;

	if (res.success || res.headersSent) {
		if (done)
			done();
		return self;
	}

	var extension = req.extension;
	if (!self.config['static-accepts']['.' + extension]) {
		self.response404(req, res);
		if (done)
			done();
		return self;
	}

	var name = req.uri.pathname;
	var index = name.lastIndexOf('/');
	var resizer = self.routes.resize[name.substring(0, index + 1)] || null;
	var isResize = false;
	var filename;

	if (resizer !== null) {
		name = name.substring(index + 1);
		index = name.lastIndexOf('.');
		isResize = resizer.extension['*'] || resizer.extension[name.substring(index).toLowerCase()];
		if (isResize) {
			name = resizer.path + $decodeURIComponent(name);
			filename = self.onMapping(name, name[0] === '~' ? name.substring(1) : name[0] === '.' ? name : framework.path.public(name));
		} else {
			filename = self.onMapping(name, framework.path.public($decodeURIComponent(name)));
		}

	} else
		filename = self.onMapping(name, framework.path.public($decodeURIComponent(name)));

	if (!isResize) {

		// is isomorphic?
		if (filename[0] !== '#') {
			self.responseFile(req, res, filename, undefined, undefined, done);
			return self;
		}

		var key = filename.substring(1);
		var iso = framework.isomorphic[key];

		if (!iso) {
			self.response404(req, res);
			return;
		}

		var etag = framework_utils.etag(filename, (iso.version || '') + '-' + (self.config['etag-version'] || ''));
		if (RELEASE && framework.notModified(req, res, etag))
			return;

		// isomorphic
		var headers = {};
		headers['Etag'] = etag;
		headers['Expires'] = new Date().add('M', 3);
		headers[RESPONSE_HEADER_CACHECONTROL] = 'public, max-age=11111111';
		framework.responseContent(req, res, 200, prepare_isomorphic(key), 'text/javascript', true, headers);
		return self;
	}

	var method = resizer.cache ? self.responseImage : self.responseImageWithoutCache;
	method.call(self, req, res, filename, function(image) {

		if (resizer.width || resizer.height) {
			if (resizer.width && resizer.height)
				image.resizeCenter(resizer.width, resizer.height);
			else
				image.resize(resizer.width, resizer.height);
		}

		if (resizer.grayscale)
			image.grayscale();

		if (resizer.blur)
			image.blur(typeof(resizer.blur) === 'number' ? resizer.blur : 1);

		if (resizer.rotate && typeof(resizer.rotate) == NUMBER)
			image.rotate(resizer.rotate);

		if (resizer.flop)
			image.flop();

		if (resizer.flip)
			image.flip();

		if (resizer.sepia)
			image.sepia(typeof(resizer.sepia) === 'number' ? resizer.sepia : 100);

		if (resizer.quality)
			image.quality(resizer.quality);
		else
			image.quality(self.config['default-image-quality']);

		image.minify();
	}, undefined, done);

	return self;
};

Framework.prototype.restore = function(filename, target, callback, filter) {
	var backup = new Backup();
	backup.restore(filename, target, callback, filter);
};

Framework.prototype.backup = function(filename, path, callback, filter) {

	var length = path.length;
	var padding = 120;

	framework_utils.ls(path, function(files, directories) {
		directories.wait(function(item, next) {
			var dir = item.substring(length).replace(/\\/g, '/') + '/';
			if (filter && !filter(dir))
				return next();
			fs.appendFile(filename, dir.padRight(padding) + ':#\n', next);
		}, function() {
			files.wait(function(item, next) {
				var fil = item.substring(length).replace(/\\/g, '/');
				if (filter && !filter(fil))
					return next();
				fs.readFile(item, function(err, data) {
					zlib.gzip(data, function(err, data) {
						if (err) {
							framework.error(err, 'framework.backup()', filename);
							return next();
						}
						fs.appendFile(filename, fil.padRight(padding) + ':' + data.toString('base64') + '\n', next);
					});
				});
			}, callback);
		});
	});

	return this;
};

Framework.prototype.exists = function(req, res, max, callback) {

	if (typeof(max) === TYPE_FUNCTION) {
		callback = max;
		max = 10;
	}

	var self = this;
	var name = createTemporaryKey(req);
	var filename = self.path.temp(name);
	var httpcachevalid = false;

	if (RELEASE) {
		var etag = framework_utils.etag(req.url, self.config['etag-version']);
		if (req.headers['if-none-match'] === etag)
			httpcachevalid = true;
	}

	if (self.isProcessed(name) || httpcachevalid) {
		self.responseFile(req, res, filename);
		return self;
	}

	framework_utils.queue('framework.exists', max, function(next) {
		fsFileExists(filename, function(e) {

			if (e) {
				framework.responseFile(req, res, filename, undefined, undefined, next);
				return;
			}

			callback(next, filename);
		});
	});

	return self;
};

/**
 * Is processed static file?
 * @param {String / Request} filename Filename or Request object.
 * @return {Boolean}
 */
Framework.prototype.isProcessed = function(filename) {

	var self = this;

	if (filename.url) {
		var name = filename.url;
		var index = name.indexOf('?');

		if (index !== -1)
			name = name.substring(0, index);

		filename = framework.path.public($decodeURIComponent(name));
	}

	if (self.temporary.path[filename] !== undefined)
		return true;

	return false;
};

/**
 * Processing
 * @param {String / Request} filename Filename or Request object.
 * @return {Boolean}
 */
Framework.prototype.isProcessing = function(filename) {

	var self = this;
	var name;

	if (filename.url) {
		name = filename.url;
		var index = name.indexOf('?');

		if (index !== -1)
			name = name.substring(0, index);

		filename = utils.combine(self.config['directory-public'], $decodeURIComponent(name));
	}

	name = self.temporary.processing[filename];
	if (self.temporary.processing[filename] !== undefined)
		return true;
	return false;
};

/**
 * Disable HTTP cache for current request/response
 * @param  {Request}  req Request
 * @param  {Response} res (optional) Response
 * @return {Framework}
 */
Framework.prototype.noCache = function(req, res) {
	req.noCache();
	if (res)
		res.noCache();
	return this;
};

/**
 * Response file
 * @param {ServerRequest} req
 * @param {ServerResponse} res
 * @param {String} filename
 * @param {String} downloadName Optional
 * @param {Object} headers Optional
 * @param {Function} done Optional, callback.
 * @param {String} key Path to file, INTERNAL.
 * @return {Framework}
 */
Framework.prototype.responseFile = function(req, res, filename, downloadName, headers, done, key) {

	var self = this;

	if (res.success || res.headersSent) {
		if (done)
			done();
		return self;
	}

	// Is package?
	if (filename[0] === '@')
		filename = framework.path.package(filename.substring(1));

	req.clear(true);

	if (!key)
		key = createTemporaryKey(req);

	var name = self.temporary.path[key];
	if (name === null) {

		if (self.config.debug)
			delete self.temporary.path[key];

		self.response404(req, res);

		if (done)
			done();

		return self;
	}

	var allowcache = req.headers['pragma'] !== 'no-cache';
	var etag = allowcache ? framework_utils.etag(req.url, self.config['etag-version']) : null;
	var returnHeaders = {};

	if (!self.config.debug && req.headers['if-none-match'] === etag) {

		if (!res.getHeader('ETag') && etag)
			returnHeaders['Etag'] = etag;

		if (!res.getHeader('Expires'))
			returnHeaders['Expires'] = new Date().add('M', 3);

		returnHeaders[RESPONSE_HEADER_CACHECONTROL] = 'public, max-age=11111111';

		res.success = true;
		res.writeHead(304, returnHeaders);
		res.end();
		self.stats.response.notModified++;
		self._request_stats(false, req.isStaticFile);

		if (done)
			done();

		if (!req.isStaticFile)
			self.emit('request-end', req, res);

		return self;
	}

	var extension = req.extension;
	if (!extension) {
		if (key)
			extension = path.extname(key);
		if (!extension)
			extension = path.extname(name);
	}

	// JS, CSS
	if (name === undefined) {
		if (self.isProcessing(key)) {
			if (req.processing > self.config['default-request-timeout']) {
				// timeout
				self.response408(req, res);
				return;
			}
			req.processing += 500;
			setTimeout(function() {
				framework.responseFile(req, res, filename, downloadName, headers, done, key);
			}, 500);
			return self;
		}

		// waiting
		self.temporary.processing[key] = true;

		// checks if the file exists
		self.compileValidation(req.uri, key, filename, extension, function() {
			delete self.temporary.processing[key];
			framework.responseFile(req, res, filename, downloadName, headers, done, key);
		});

		return self;
	}

	var index = name.lastIndexOf(';');
	var size = null;

	if (index === -1)
		index = name.length;
	else
		size = name.substring(index + 1);

	name = name.substring(0, index);

	var accept = req.headers['accept-encoding'] || '';

	returnHeaders['Accept-Ranges'] = 'bytes';
	returnHeaders[RESPONSE_HEADER_CACHECONTROL] = 'public' + (RELEASE && allowcache ? ', max-age=11111111' : '');

	if (RELEASE && allowcache && !res.getHeader('Expires'))
		returnHeaders['Expires'] = new Date().add('M', 3);

	returnHeaders['Vary'] = 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : '');

	if (headers)
		utils.extend(returnHeaders, headers, true);

	if (downloadName)
		returnHeaders['Content-Disposition'] = 'attachment; filename="' + downloadName + '"';

	if (RELEASE && allowcache && etag && !res.getHeader('ETag'))
		returnHeaders['Etag'] = etag;

	if (!returnHeaders[RESPONSE_HEADER_CONTENTTYPE])
		returnHeaders[RESPONSE_HEADER_CONTENTTYPE] = utils.getContentType(extension);

	var compress = self.config['allow-gzip'] && REQUEST_COMPRESS_CONTENTTYPE[returnHeaders[RESPONSE_HEADER_CONTENTTYPE]] && accept.lastIndexOf('gzip') !== -1;
	var range = req.headers['range'] || '';

	res.success = true;
	if (range)
		return self.responseRange(name, range, returnHeaders, req, res, done);

	if (self.config.debug && self.isProcessed(key))
		delete self.temporary.path[key];

	if (size !== null && size !== '0' && !compress)
		returnHeaders[RESPONSE_HEADER_CONTENTLENGTH] = size;

	self.stats.response.file++;
	self._request_stats(false, req.isStaticFile);

	if (req.method === 'HEAD') {
		if (compress)
			returnHeaders['Content-Encoding'] = 'gzip';

		res.writeHead(200, returnHeaders);
		res.end();

		if (done)
			done();
		if (!req.isStaticFile)
			self.emit('request-end', req, res);
		return self;
	}

	if (compress) {
		returnHeaders['Content-Encoding'] = 'gzip';
		fsStreamRead(name, function(stream, next) {

			res.writeHead(200, returnHeaders);

			framework_internal.onFinished(res, function(err) {
				framework_internal.destroyStream(stream);
				next();
			});

			stream.pipe(zlib.createGzip()).pipe(res);

			if (done)
				done();
			if (!req.isStaticFile)
				self.emit('request-end', req, res);
		});
		return self;
	}

	fsStreamRead(name, function(stream, next) {
		res.writeHead(200, returnHeaders);
		stream.pipe(res);

		framework_internal.onFinished(res, function(err) {
			framework_internal.destroyStream(stream);
			next();
		});

		if (done)
			done();
		if (!req.isStaticFile)
			self.emit('request-end', req, res);
	});

	return self;
};

/*
	Response PIPE
	@req {ServerRequest}
	@res {ServerResponse}
	@url {String}
	@header {Object} :: optional
	@timeout {Number} :: optional
	@callback {Function} :: optional
	return {Framework}
*/
Framework.prototype.responsePipe = function(req, res, url, headers, timeout, callback) {

	var self = this;

	if (res.success || res.headersSent)
		return self;

	var uri = parser.parse(url);
	var h = {};

	h[RESPONSE_HEADER_CACHECONTROL] = 'private';

	if (headers)
		utils.extend(h, headers, true);

	h['X-Powered-By'] = 'total.js v' + self.version_header;

	var options = {
		protocol: uri.protocol,
		auth: uri.auth,
		method: 'GET',
		hostname: uri.hostname,
		port: uri.port,
		path: uri.path,
		agent: false,
		headers: h
	};

	var connection = options.protocol === 'https:' ? require('https') : http;
	var supportsGZIP = (req.headers['accept-encoding'] || '').lastIndexOf('gzip') !== -1;

	var client = connection.get(options, function(response) {

		var contentType = response.headers['content-type'];
		var isGZIP = (response.headers['content-encoding'] || '').lastIndexOf('gzip') !== -1;
		var compress = !isGZIP && supportsGZIP && (contentType.indexOf('text/') !== -1 || contentType.lastIndexOf('javascript') !== -1 || contentType.lastIndexOf('json') !== -1);
		var attachment = response.headers['content-disposition'] || '';

		if (attachment)
			res.setHeader('Content-Disposition', attachment);

		res.setHeader(RESPONSE_HEADER_CONTENTTYPE, contentType);
		res.setHeader('Vary', 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : ''));

		res.on('error', function() {
			response.close();
		});

		if (compress) {
			res.setHeader('Content-Encoding', 'gzip');
			response.pipe(zlib.createGzip()).pipe(res);
			return;
		}

		if (!supportsGZIP && isGZIP)
			response.pipe(zlib.createGunzip()).pipe(res);
		else
			response.pipe(res);

	});

	if ((timeout || 0) > 0) {
		client.setTimeout(timeout || 3000, function() {
			self.response408(req, res);
			if (callback)
				callback();
		});
	}

	client.on('close', function() {

		if (res.success || res.headersSent)
			return;

		req.clear(true);
		res.success = true;

		self.stats.response.pipe++;
		self._request_stats(false, req.isStaticFile);
		res.success = true;

		if (!req.isStaticFile)
			self.emit('request-end', req, res);

		if (callback)
			callback();
	});

	return self;
};

/*
	Response custom
	@req {ServerRequest}
	@res {ServerResponse}
*/
Framework.prototype.responseCustom = function(req, res) {

	var self = this;

	if (res.success || res.headersSent)
		return;

	req.clear(true);
	res.success = true;

	self.stats.response.custom++;
	self._request_stats(false, req.isStaticFile);

	if (!req.isStaticFile)
		self.emit('request-end', req, res);

	return self;
};

/**
 * Responses image
 * @param {ServerRequest} req
 * @param {ServerResponse} res
 * @param {String or Stream} filename
 * @param {Function(image)} fnProcess
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optional, callback function.
 * @return {Framework}
 */
Framework.prototype.responseImage = function(req, res, filename, fnProcess, headers, done) {

	var self = this;
	var key = createTemporaryKey(req);

	var name = self.temporary.path[key];
	if (name === null) {
		self.response404(req, res);
		if (done)
			done();
		return self;
	}

	var stream = null;

	if (typeof(filename) === OBJECT)
		stream = filename;
	else if (filename[0] === '@')
		filename = framework.path.package(filename.substring(1));

	if (name !== undefined) {
		self.responseFile(req, res, '', undefined, headers, done, key);
		return self;
	}

	var im = self.config['default-image-converter'] === 'im';

	if (self.isProcessing(key)) {

		if (req.processing > self.config['default-request-timeout']) {
			self.response408(req, res);
			if (done)
				done();
			return;
		}

		req.processing += 500;
		setTimeout(function() {
			self.responseImage(req, res, filename, fnProcess, headers, done);
		}, 500);
		return;
	}

	var plus = self.id === null ? '' : 'instance-' + self.id + '-';

	name = self.path.temp(plus + key);
	self.temporary.processing[key] = true;

	// STREAM
	if (stream !== null) {
		fsFileExists(name, function(exist) {

			if (exist) {
				delete self.temporary.processing[key];
				self.temporary.path[key] = name;
				self.responseFile(req, res, name, undefined, headers, done, key);
				if (self.isDebug)
					delete self.temporary.path[key];
				return;
			}

			self.path.verify('temp');
			var image = framework_image.load(stream, im);

			fnProcess(image);

			var extension = path.extname(name);
			if (extension.substring(1) !== image.outputType)
				name = name.substring(0, name.lastIndexOf(extension)) + '.' + image.outputType;

			image.save(name, function(err) {

				delete self.temporary.processing[key];

				if (err) {

					self.temporary.path[key] = null;
					self.response500(req, res, err);

					if (done)
						done();

					if (self.isDebug)
						delete self.temporary.path[key];

					return;
				}

				self.temporary.path[key] = name + ';' + fs.statSync(name).size;
				self.responseFile(req, res, name, undefined, headers, done, key);
			});
		});

		return self;
	}

	// FILENAME
	fsFileExists(filename, function(exist) {

		if (!exist) {

			delete self.temporary.processing[key];
			self.temporary.path[key] = null;
			self.response404(req, res);

			if (done)
				done();

			if (self.isDebug)
				delete self.temporary.path[key];

			return;
		}

		self.path.verify('temp');

		var image = framework_image.load(filename, im);

		fnProcess(image);

		var extension = path.extname(name);
		if (extension.substring(1) !== image.outputType)
			name = name.substring(0, name.lastIndexOf(extension)) + '.' + image.outputType;

		image.save(name, function(err) {

			delete self.temporary.processing[key];

			if (err) {
				self.temporary.path[key] = null;
				self.response500(req, res, err);

				if (done)
					done();

				if (self.isDebug)
					delete self.temporary.path[key];

				return;
			}

			self.temporary.path[key] = name + ';' + fs.statSync(name).size;
			self.responseFile(req, res, name, undefined, headers, done, key);
		});

	});

	return self;
};

Framework.prototype.responseImagePrepare = function(req, res, fnPrepare, fnProcess, headers, done) {

	var self = this;
	var key = createTemporaryKey(req);

	var name = self.temporary.path[key];
	if (name === null) {
		self.response404(req, res);

		if (done)
			done();

		return self;
	}

	if (name !== undefined) {
		self.responseFile(req, res, '', undefined, headers, done, key);
		return self;
	}

	if (self.isProcessing(key)) {
		if (req.processing > self.config['default-request-timeout']) {
			self.response408(req, res);
			if (done)
				done();
			return;
		}

		req.processing += 500;
		setTimeout(function() {
			self.responseImage(req, res, filename, fnProcess, headers, done);
		}, 500);

		return;
	}

	fnPrepare.call(self, function(filename) {
		if (!filename) {
			self.response404(req, res);
			if (done)
				done();
			return;
		}
		self.responseImage(req, res, filename, fnProcess, headers, done);
	});

	return self;
};

/**
 * Responses image
 * @param {ServerRequest} req
 * @param {ServerResponse} res
 * @param {String or Stream} filename
 * @param {Function(image)} fnProcess
 * @param {Object} headers Optional, additional headers
 * @param {Function} done Optional, callback.
 * @return {Framework}
 */
Framework.prototype.responseImageWithoutCache = function(req, res, filename, fnProcess, headers, done) {

	var self = this;
	var stream = null;

	if (typeof(filename) === OBJECT)
		stream = filename;
	else if (filename[0] === '@')
		filename = framework.path.package(filename.substring(1));

	var im = self.config['default-image-converter'] === 'im';

	// STREAM
	if (stream !== null) {
		var image = framework_image.load(stream, im);
		fnProcess(image);
		self.responseStream(req, res, utils.getContentType(image.outputType), image.stream(), null, headers, done);
		return self;
	}

	// FILENAME
	fsFileExists(filename, function(exist) {

		if (!exist) {
			self.response404(req, res);
			if (done)
				done();
			return;
		}

		self.path.verify('temp');
		var image = framework_image.load(filename, im);
		fnProcess(image);
		self.responseStream(req, res, utils.getContentType(image.outputType), image.stream(), null, headers, done);
	});
	return self;
};

/**
 * Responses stream
 * @param {ServerRequest} req
 * @param {ServerResponse} res
 * @param {String} contentType
 * @param {ReadStream} stream
 * @param {String} download Optional, download name.
 * @param {Object} headers Optional
 * @return {Framework}
 */
Framework.prototype.responseStream = function(req, res, contentType, stream, download, headers, done, nocompress) {

	var self = this;

	if (res.success || res.headersSent) {
		if (done)
			done();
		return self;
	}

	req.clear(true);

	if (contentType.lastIndexOf('/') === -1)
		contentType = utils.getContentType(contentType);

	var accept = req.headers['accept-encoding'] || '';
	var compress = self.config['allow-gzip'] && REQUEST_COMPRESS_CONTENTTYPE[contentType] && accept.lastIndexOf('gzip') !== -1;
	var returnHeaders = {};

	returnHeaders[RESPONSE_HEADER_CACHECONTROL] = 'public' + (RELEASE ? ', max-age=11111111' : '');

	if (RELEASE)
		returnHeaders['Expires'] = new Date().add('M', 3);

	returnHeaders['Vary'] = 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : '');

	if (headers)
		utils.extend(returnHeaders, headers, true);

	download = download || '';

	if (download)
		returnHeaders['Content-Disposition'] = 'attachment; filename=' + encodeURIComponent(download);

	returnHeaders[RESPONSE_HEADER_CONTENTTYPE] = contentType;

	self.stats.response.stream++;
	self._request_stats(false, req.isStaticFile);

	if (req.method === 'HEAD') {
		if (compress)
			returnHeaders['Content-Encoding'] = 'gzip';
		res.writeHead(200, returnHeaders);
		res.end();
		if (done)
			done();
		if (!req.isStaticFile)
			self.emit('request-end', req, res);
		return self;
	}

	if (compress && !nocompress) {

		returnHeaders['Content-Encoding'] = 'gzip';
		res.writeHead(200, returnHeaders);

		res.on('error', function() {
			stream.close();
		});

		var gzip = zlib.createGzip();

		framework_internal.onFinished(res, function() {
			framework_internal.destroyStream(stream);
		});

		stream.pipe(gzip).pipe(res);

		if (done)
			done();

		if (!req.isStaticFile)
			self.emit('request-end', req, res);

		return self;
	}

	res.writeHead(200, returnHeaders);

	framework_internal.onFinished(res, function(err) {
		framework_internal.destroyStream(stream);
	});

	stream.pipe(res);

	if (done)
		done();

	if (!req.isStaticFile)
		self.emit('request-end', req, res);

	return self;
};

/**
 * INTERNAL: Response range (streaming)
 * @param {String} name Temporary name.
 * @param {String} range
 * @param {Object} headers Optional, additional headers.
 * @param {ServerRequest} req
 * @param {ServerResponse} res
 * @param {Function} done Optional, callback.
 * @return {Framework}
 */
Framework.prototype.responseRange = function(name, range, headers, req, res, done) {

	var self = this;
	var arr = range.replace(/bytes=/, '').split('-');
	var beg = parseInt(arr[0] || '0', 10);
	var end = parseInt(arr[1] || '0', 10);
	var total = self.temporary.range[name] || 0;

	if (total === 0) {
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

	headers[RESPONSE_HEADER_CONTENTLENGTH] = length;
	headers['Content-Range'] = 'bytes ' + beg + '-' + end + '/' + total;

	if (req.method === 'HEAD') {
		res.writeHead(206, headers);
		res.end();
		self.stats.response.streaming++;
		self._request_stats(false, req.isStaticFile);
		if (done)
			done();
		if (!req.isStaticFile)
			self.emit('request-end', req, res);
		return self;
	}

	fsStreamRead(name, { start: beg, end: end }, function(stream, next) {

		res.writeHead(206, headers);

		framework_internal.onFinished(res, function() {
			framework_internal.destroyStream(stream);
			next();
		});

		stream.pipe(res);
		self.stats.response.streaming++;
		self._request_stats(false, req.isStaticFile);

		if (done)
			done();

		if (!req.isStaticFile)
			self.emit('request-end', req, res);
	});

	return self;
};

/**
 * Responses binary
 * @param {ServerRequest} req
 * @param {ServerResponse} res
 * @param {String} contentType
 * @param {Buffer} buffer
 * @param {Encoding} type Default: "binary", optioanl
 * @param {String} download Optional, download name.
 * @param {Object} headers Optional
 * @return {Framework}
 */
Framework.prototype.responseBinary = function(req, res, contentType, buffer, encoding, download, headers, done) {

	var self = this;

	if (res.success || res.headersSent) {
		if (done)
			done();
		return self;
	}

	if (!encoding)
		encoding = 'binary';

	req.clear(true);

	if (contentType.lastIndexOf('/') === -1)
		contentType = utils.getContentType(contentType);

	var accept = req.headers['accept-encoding'] || '';
	var compress = self.config['allow-gzip'] && REQUEST_COMPRESS_CONTENTTYPE[contentType] && accept.lastIndexOf('gzip') !== -1;
	var returnHeaders = {};

	returnHeaders[RESPONSE_HEADER_CACHECONTROL] = 'public';
	returnHeaders['Vary'] = 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : '');

	if (headers)
		utils.extend(returnHeaders, headers, true);

	download = download || '';

	if (download)
		returnHeaders['Content-Disposition'] = 'attachment; filename=' + encodeURIComponent(download);

	returnHeaders[RESPONSE_HEADER_CONTENTTYPE] = contentType;

	self.stats.response.binary++;
	self._request_stats(false, req.isStaticFile);

	if (req.method === 'HEAD') {
		if (compress)
			returnHeaders['Content-Encoding'] = 'gzip';
		res.writeHead(200, returnHeaders);
		res.end();
		if (done)
			done();
		if (!req.isStaticFile)
			self.emit('request-end', req, res);
		return self;
	}

	if (compress) {

		returnHeaders['Content-Encoding'] = 'gzip';
		res.writeHead(200, returnHeaders);

		zlib.gzip(encoding === 'binary' ? buffer : buffer.toString(encoding), function(err, buffer) {
			res.end(buffer);
		});

		if (done)
			done();

		if (!req.isStaticFile)
			self.emit('request-end', req, res);

		return self;
	}

	res.writeHead(200, returnHeaders);
	res.end(encoding === 'binary' ? buffer : buffer.toString(encoding));

	if (done)
		done();

	if (!req.isStaticFile)
		self.emit('request-end', req, res);

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
	@strict {Boolean} :: if strict then use equal date else use great than date (default: false)

	if @compare === {String} compare if-none-match
	if @compare === {Date} compare if-modified-since

	this method automatically flush response (if not modified)
	--> response 304

	return {Boolean};
*/
Framework.prototype.notModified = function(req, res, compare, strict) {

	var self = this;
	var type = typeof(compare);

	if (type === BOOLEAN) {
		var tmp = compare;
		compare = strict;
		strict = tmp;
		type = typeof(compare);
	}

	var isEtag = type === STRING;

	var val = req.headers[isEtag ? 'if-none-match' : 'if-modified-since'];

	if (isEtag) {

		if (val === undefined)
			return false;

		var myetag = compare + ':' + self.config['etag-version'];

		if (val !== myetag)
			return false;

	} else {

		if (val === undefined)
			return false;

		var date = compare === undefined ? new Date().toUTCString() : compare.toUTCString();

		if (strict) {
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

	self.stats.response.notModified++;
	self._request_stats(false, req.isStaticFile);

	if (!req.isStaticFile)
		self.emit('request-end', req, res);

	return true;
};

Framework.prototype.responseCode = function(req, res, code, problem) {
	var self = this;

	if (problem)
		self.problem(problem, 'response' + code + '()', req.uri, req.ip);

	if (res.success || res.headersSent)
		return self;

	self._request_stats(false, req.isStaticFile);
	req.clear(true);

	res.success = true;

	var headers = {};
	var status = code;

	headers[RESPONSE_HEADER_CONTENTTYPE] = CONTENTTYPE_TEXTPLAIN;
	res.writeHead(status, headers);

	if (req.method === 'HEAD')
		res.end();
	else
		res.end(utils.httpStatus(status));

	if (!req.isStaticFile)
		self.emit('request-end', req, res);

	var key = 'error' + code;
	self.stats.response[key]++;
	return self;
};

Framework.prototype.response400 = function(req, res, problem) {
	return this.responseCode(req, res, 400, problem);
};

Framework.prototype.response401 = function(req, res, problem) {
	return this.responseCode(req, res, 401, problem);
};

Framework.prototype.response403 = function(req, res, problem) {
	return this.responseCode(req, res, 403, problem);
};

Framework.prototype.response404 = function(req, res, problem) {
	return this.responseCode(req, res, 404, problem);
};

Framework.prototype.response408 = function(req, res, problem) {
	return this.responseCode(req, res, 408, problem);
};

Framework.prototype.response431 = function(req, res, problem) {
	return this.responseCode(req, res, 431, problem);
};

/*
	Response with 500 error
	@req {ServerRequest}
	@res {ServerResponse}
	@error {Error}
	return {Framework}
*/
Framework.prototype.response500 = function(req, res, error) {
	var self = this;

	if (error)
		self.error(error, null, req.uri);

	if (res.success || res.headersSent)
		return self;

	self._request_stats(false, req.isStaticFile);
	req.clear(true);

	res.success = true;
	var headers = {};
	var status = 500;
	headers[RESPONSE_HEADER_CONTENTTYPE] = CONTENTTYPE_TEXTPLAIN;
	res.writeHead(status, headers);

	if (req.method === 'HEAD')
		res.end();
	else
		res.end(utils.httpStatus(status) + prepare_error(error));

	if (!req.isStaticFile)
		self.emit('request-end', req, res);

	self.stats.response.error500++;
	return self;
};

Framework.prototype.response501 = function(req, res, problem) {
	return this.responseCode(req, res, 501, problem);
};

/**
 * Response content
 * @param {Request} req
 * @param {Response} res
 * @param {Number} code Status code.
 * @param {String} contentBody Content body.
 * @param {String} contentType Content type.
 * @param {Boolean} compress GZIP compression.
 * @param {Object} headers Custom headers.
 * @return {Framework}
 */
Framework.prototype.responseContent = function(req, res, code, contentBody, contentType, compress, headers) {
	var self = this;

	if (res.success || res.headersSent)
		return self;

	req.clear(true);
	res.success = true;

	if (contentBody === null || contentBody === undefined)
		contentBody = '';

	var accept = req.headers['accept-encoding'] || '';
	var returnHeaders = {};
	var gzip = compress ? accept.lastIndexOf('gzip') !== -1 : false;

	returnHeaders[RESPONSE_HEADER_CACHECONTROL] = 'private';
	returnHeaders['Vary'] = 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : '');

	if (headers)
		utils.extend(returnHeaders, headers, true);

	// Safari resolve
	if (contentType === 'application/json')
		returnHeaders[RESPONSE_HEADER_CACHECONTROL] = 'private, no-cache, no-store, must-revalidate';

	if ((/text|application/).test(contentType))
		contentType += '; charset=utf-8';

	returnHeaders[RESPONSE_HEADER_CONTENTTYPE] = contentType;

	if (req.method === 'HEAD') {
		if (gzip)
			returnHeaders['Content-Encoding'] = 'gzip';
		res.writeHead(code, returnHeaders);
		res.end();
		self._request_stats(false, req.isStaticFile);
		if (!req.isStaticFile)
			self.emit('request-end', req, res);
		return self;
	}

	if (gzip) {
		zlib.gzip(new Buffer(contentBody), function(err, data) {

			if (err) {
				res.writeHead(code, returnHeaders);
				res.end(contentBody, ENCODING);
				return;
			}

			returnHeaders['Content-Encoding'] = 'gzip';
			res.writeHead(code, returnHeaders);
			res.end(data, ENCODING);
		});

		self._request_stats(false, req.isStaticFile);

		if (!req.isStaticFile)
			self.emit('request-end', req, res);

		return self;
	}

	res.writeHead(code, returnHeaders);
	res.end(contentBody, ENCODING);

	self._request_stats(false, req.isStaticFile);

	if (!req.isStaticFile)
		self.emit('request-end', req, res);

	return self;
};

/**
 * Response Redirect
 * @param {Request} req
 * @param {Response} res
 * @param {String} url
 * @param {Boolean} permanent Optional.
 * @return {Framework}
 */
Framework.prototype.responseRedirect = function(req, res, url, permanent) {

	var self = this;

	if (res.success || res.headersSent)
		return;

	self._request_stats(false, req.isStaticFile);

	req.clear(true);
	res.success = true;

	var headers = { 'Location': url };
	headers[RESPONSE_HEADER_CONTENTTYPE] = CONTENTTYPE_TEXTHTML + '; charset=utf-8';

	res.writeHead(permanent ? 301 : 302, headers);
	res.end();

	if (!req.isStaticFile)
		self.emit('request-end', req, res);

	return self;
};

Framework.prototype.load = function(debug, types, path) {

	var self = this;

	if (path)
		self.directory = directory = path;

	self.isWorker = true;
	self.config.debug = debug;
	self.isDebug = debug;

	global.DEBUG = debug;
	global.RELEASE = !debug;
	global.isomorphic = self.isomorphic;

	self._configure();

	if (!types || types.indexOf('versions') !== -1)
		self._configure_versions();

	if (!types || types.indexOf('sitemap') !== -1)
		self._configure_sitemap();

	self.cache.init();
	self.emit('init');
	self.isLoaded = true;

	setTimeout(function() {

		try {
			self.emit('load', self);
			self.emit('ready', self);
		} catch (err) {
			self.error(err, 'framework.on("load/ready")');
		}

		self.removeAllListeners('load');
		self.removeAllListeners('ready');

		// clear unnecessary items
		delete framework.tests;
		delete framework.test;
		delete framework.testing;
		delete framework.assert;
	}, 500);

	self.$load(types);
};

/**
 * Initialize framework
 * @param  {Object} http
 * @param  {Boolean} debug
 * @param  {Object} options
 * @return {Framework}
 */
Framework.prototype.initialize = function(http, debug, options) {

	var self = this;

	if (self.server !== null)
		return self;

	if (!options)
		options = {};

	var port = options.port;
	var ip = options.ip;

	if (options.config)
		framework_utils.copy(options.copy, self.config);

	self.isHTTPS = typeof(http.STATUS_CODES) === UNDEFINED;
	if (isNaN(port) && typeof(port) !== STRING)
		port = null;

	self.config.debug = debug;
	self.isDebug = debug;

	global.DEBUG = debug;
	global.RELEASE = !debug;
	global.isomorphic = self.isomorphic;

	self._configure();
	self._configure_versions();
	self._configure_sitemap();

	if (self.isTest)
		self._configure('config-test', false);

	self.cache.init();
	self.emit('init');

	// clear static files
	self.clear(function() {

		self.$load();

		if (options.https)
			self.server = http.createServer(options.https, self.listener);
		else
			self.server = http.createServer(self.listener);

		if (self.config['allow-performance']) {
			self.server.on('connection', function(socket) {
				socket.setNoDelay(true);
				// socket.setTimeout(5000); // 15 seconds
				socket.setKeepAlive(true, 10);
			});
		}

		if (self.config['allow-websocket'])
			self.server.on('upgrade', framework._upgrade);

		if (!port) {
			if (self.config['default-port'] === 'auto') {
				var envPort = parseInt(process.env.PORT || '');
				if (!isNaN(envPort))
					port = envPort;
			} else
				port = self.config['default-port'];
		}

		self.port = port || 8000;

		if (ip !== null) {
			self.ip = ip || self.config['default-ip'] || '127.0.0.1';
			if (self.ip === 'null' || self.ip === UNDEFINED || self.ip === 'auto')
				self.ip = undefined;
		} else
			self.ip = undefined;

		if (typeof(options.sleep) === NUMBER) {
			setTimeout(function() {
				self.server.listen(self.port, self.ip);
			}, options.sleep);
		} else
			self.server.listen(self.port, self.ip);

		if (self.ip === undefined || self.ip === null)
			self.ip = 'auto';

		self.isLoaded = true;

		if (!process.connected)
			self.console();

		setTimeout(function() {

			try {
				self.emit('load', self);
				self.emit('ready', self);
			} catch (err) {
				self.error(err, 'framework.on("load/ready")');
			}

			self.removeAllListeners('load');
			self.removeAllListeners('ready');

		}, 500);

		if (self.isTest) {

			var sleep = options.sleep || options.delay || 1000;
			global.TEST = true;
			global.assert = require('assert');
			setTimeout(function() {
				self.test(true, options.tests || options.test);
			}, sleep);

			return self;
		}

		setTimeout(function() {

			if (framework.isTest)
				return;

			// clear unnecessary items
			delete framework.tests;
			delete framework.test;
			delete framework.testing;
			delete framework.assert;

		}, 5000);

	}, true);

	return self;
};

/**
 * Run framework –> HTTP
 * @param  {String} mode Framework mode.
 * @param  {Object} options Framework settings.
 * @return {Framework}
 */
Framework.prototype.http = function(mode, options) {

	if (options === undefined)
		options = {};

	if (!options.port)
		options.port = parseInt(process.argv[2]);

	return this.mode(require('http'), mode, options);
};

/**
 * Run framework –> HTTPS
 * @param {String} mode Framework mode.
 * @param {Object} options Framework settings.
 * @return {Framework}
 */
Framework.prototype.https = function(mode, options) {

	if (options === undefined)
		options = {};

	return this.mode(require('https'), mode, options);
};

/**
 * Run framework
 * @param {Object} http
 * @param {String} name Mode name.
 * @param {Object} options Optional, additional options.
 * @return {Framework}
 */
/**
 * Changes the framework mode
 * @param {String} mode New mode (e.g. debug or release)
 * @return {Framework}
 */
Framework.prototype.mode = function(http, name, options) {

	var self = this;
	var test = false;
	var debug = false;

	if (typeof(http) === STRING) {
		switch (http) {
			case 'debug':
			case 'development':
				debug = true;
				break;
		}
		self.config.debug = debug;
		self.isDebug = debug;
		global.DEBUG = debug;
		global.RELEASE = !debug;
		return self;
	}

	self.isWorker = false;

	switch (name.toLowerCase().replace(/\.|\s/g, '-')) {
		case 'release':
		case 'production':
			break;

		case 'debug':
		case 'develop':
		case 'development':
			debug = true;
			break;

		case 'test':
		case 'testing':
		case 'test-debug':
		case 'testing-debug':
			test = true;
			debug = true;
			self.isTest = true;
			break;

		case 'test-release':
		case 'testing-release':
		case 'test-production':
		case 'testing-production':
			test = true;
			debug = false;
			break;
	}

	return self.initialize(http, debug, options);
};

/**
 * Show framework informations
 */
Framework.prototype.console = function() {
	console.log('====================================================');
	console.log('PID          : ' + process.pid);

	if (process.argv[0] === 'iojs')
		console.log('io.js        : ' + process.version);
	else
		console.log('node.js      : ' + process.version);

	console.log('total.js     : v' + framework.version_header);
	console.log('====================================================');
	console.log('Name         : ' + framework.config.name);
	console.log('Version      : ' + framework.config.version);
	console.log('Author       : ' + framework.config.author);
	console.log('Date         : ' + new Date().format('yyyy-MM-dd HH:mm:ss'));
	console.log('Mode         : ' + (framework.config.debug ? 'debug' : 'release'));
	console.log('====================================================\n');
	console.log('{2}://{0}:{1}/'.format(framework.ip, framework.port, framework.isHTTPS ? 'https' : 'http'));
	console.log('');
};

/**
 * Re-connect server
 * @return {Framework}
 */
Framework.prototype.reconnect = function() {
	var self = this;

	if (self.config['default-port'] !== undefined)
		self.port = self.config['default-port'];

	if (self.config['default-ip'] !== undefined)
		self.ip = self.config['default-ip'];

	self.server.close(function() {
		self.server.listen(self.port, self.ip);
	});

	return self;
};

/**
 * Internal service
 * @private
 * @param {Number} count Run count.
 * @return {Framework}
 */
Framework.prototype._service = function(count) {
	var self = this;

	if (self.config.debug)
		self.resources = {};

	// every 7 minutes (default) service clears static cache
	if (count % framework.config['default-interval-clear-cache'] === 0) {
		self.emit('clear', 'temporary', self.temporary);
		self.temporary.path = {};
		self.temporary.range = {};
		self.temporary.views = {};
		self.temporary.other = {};
	}

	// every 61 minutes (default) services precompile all (installed) views
	if (count % framework.config['default-interval-precompile-views'] === 0) {
		for (var key in self.routes.views) {
			var item = self.routes.views[key];
			self.install('view', key, item.url, null);
		}
	}

	if (count % framework.config['default-interval-clear-dnscache'] === 0)
		framework_utils.clearDNS();

	var ping = framework.config['default-interval-websocket-ping'];
	if (ping > 0 && count % ping === 0) {
		for (var item in framework.connections) {
			var conn = framework.connections[item];
			if (!conn)
				continue;
			conn.check();
			conn.ping();
		}
	}

	// every 20 minutes (default) service clears resources
	if (count % framework.config['default-interval-clear-resources'] === 0) {
		self.emit('clear', 'resources');
		self.resources = {};
		if (typeof(gc) !== UNDEFINED)
			setTimeout(gc, 1000);
	}

	self.emit('service', count);

	var length = self.schedules.length;

	// Run schedules
	if (!length)
		return self;

	var expire = new Date().getTime();
	var index = 0;

	while (true) {
		var schedule = self.schedules[index++];
		if (!schedule)
			break;
		if (schedule.expire > expire)
			continue;

		index--;

		if (!schedule.repeat)
			self.schedules.splice(index, 1);
		else
			schedule.expire = new Date().add(schedule.repeat);

		schedule.fn.call(self);
	}

	return self;
};

/**
 * Request processing
 * @private
 * @param {Request} req
 * @param {Response} res
 */
Framework.prototype.listener = function(req, res) {

	var self = framework;

	if (!req.host) {
		self.stats.response.destroy++;
		res.writeHead(403);
		res.end();
		return;
	}

	var headers = req.headers;
	var protocol = req.connection.encrypted || headers['x-forwarded-protocol'] === 'https' ? 'https' : 'http';

	res.req = req;
	req.res = res;
	req.uri = framework_internal.parseURI(protocol, req);

	self.stats.request.request++;
	self.emit('request', req, res);

	if (self._request_check_redirect) {
		var redirect = self.routes.redirects[protocol + '://' + req.host];
		if (redirect) {
			self.stats.response.forward++;
			self.responseRedirect(req, res, redirect.url + (redirect.path ? req.url : ''), redirect.permanent);
			return self;
		}
	}

	if (self.restrictions.isRestrictions) {
		if (self.restrictions.isAllowedIP) {
			if (self.restrictions.allowedIP.indexOf(req.ip) === -1) {
				self.stats.response.restriction++;
				res.writeHead(403);
				res.end();
				return self;
			}
		}

		if (self.restrictions.isBlockedIP) {
			if (self.restrictions.blockedIP.indexOf(req.ip) !== -1) {
				self.stats.response.restriction++;
				res.writeHead(403);
				res.end();
				return self;
			}
		}

		if (self.restrictions.isAllowedCustom) {
			if (!self.restrictions._allowedCustom(headers)) {
				self.stats.response.restriction++;
				res.writeHead(403);
				res.end();
				return self;
			}
		}

		if (self.restrictions.isBlockedCustom) {
			if (self.restrictions._blockedCustom(headers)) {
				self.stats.response.restriction++;
				res.writeHead(403);
				res.end();
				return self;
			}
		}
	}

	if (!req.host) {
		self.stats.response.destroy++;
		res.writeHead(403);
		res.end();
		return self;
	}

	req.path = framework_internal.routeSplit(req.uri.pathname);
	req.body = {};
	req.files = new Array(0);
	req.processing = 0;
	req.session = null;
	req.user = null;
	req.isAuthorized = true;
	req.xhr = headers['x-requested-with'] === 'XMLHttpRequest';
	res.success = false;
	res.setHeader('X-Powered-By', 'total.js v' + self.version_header);

	if (self.isDebug)
		res.setHeader('Mode', 'debug');

	req.isStaticFile = framework.config['allow-handle-static-files'] ? framework_utils.isStaticFile(req.uri.pathname) : false;

	var can = true;
	if (req.isStaticFile) {
		req.extension = path.extname(req.uri.pathname).substring(1);
		switch (req.extension) {
			case 'html':
			case 'htm':
			case 'txt':
			case 'md':
				can = true;
				break;
			default:
				can = false;
				break;
		}
	}

	if (can && self.onLocate)
		req.$language = self.onLocate(req, res, req.isStaticFile);

	self._request_stats(true, true);

	if (self._length_request_middleware === 0)
		return self._request_continue(req, res, headers, protocol);

	if (req.behaviour('disable-middleware'))
		return self._request_continue(req, res, headers, protocol);

	var func = new Array(self._length_request_middleware);
	var indexer = 0;

	for (var i = 0; i < self._length_request_middleware; i++) {
		var middleware = self.routes.middleware[self.routes.request[i]];

		if (!middleware) {
			self.error('Middleware not found: ' + route.middleware[i], null, req.uri);
			continue;
		}

		(function(middleware) {
			func[indexer++] = function(next) {
				middleware.call(framework, res.req, res, next);
			};
		})(middleware);
	}

	func._async_middleware(res, function() {
		self._request_continue(res.req, res, res.req.headers, protocol);
	});
};

/**
 * Continue to process
 * @private
 * @param {Request} req
 * @param {Response} res
 * @param {Object} headers
 * @param {String} protocol [description]
 * @return {Framework}
 */
Framework.prototype._request_continue = function(req, res, headers, protocol) {

	var self = this;

	if (req === null || res === null || res.headersSent || res.success)
		return self;

	// Validate if this request is a file (static file)
	if (req.isStaticFile) {

		self.stats.request.file++;

		if (self._length_files === 0) {
			self.responseStatic(req, res);
			return self;
		}

		new Subscribe(self, req, res, 3).file();
		return self;
	}

	req.isProxy = headers['x-proxy'] === 'total.js';

	req.buffer_exceeded = false;
	req.buffer_data = new Buffer('');
	req.buffer_has = false;
	req.$flags = req.method;

	var accept = headers.accept;

	self.stats.request.web++;

	var flags = [req.method.toLowerCase()];
	var multipart = req.headers['content-type'] || '';

	if (req.mobile) {
		req.$flags += '_m_';
		self.stats.request.mobile++;
	} else
		self.stats.request.desktop++;

	req.$flags += protocol;
	req.$type = 0;
	flags.push(protocol);

	var method = req.method;
	var first = method[0];

	if (first === 'P' || first === 'D') {
		var index = multipart.lastIndexOf(';');
		var tmp = multipart;
		if (index !== -1)
			tmp = tmp.substring(0, index);
		switch (tmp.substring(tmp.length - 4)) {
			case 'json':
				req.$flags += 'json';
				flags.push('json');
				req.$type = 1;
				multipart = '';
				break;
			case '/xml':
				req.$flags += 'xml';
				flags.push('xml');
				req.$type = 2;
				multipart = '';
				break;
			case 'oded':
				req.$type = 3;
				multipart = '';
				break;
			case 'data':
				req.$flags += 'upload';
				flags.push('upload');
				break;
			default:
				// UNDEFINED DATA
				multipart = '';
				flags.push('raw');
				break;
		}
	}

	if (req.isProxy) {
		req.$flags += 'proxy';
		flags.push('proxy');
	}

	if (accept === 'text/event-stream') {
		req.$flags += 'sse';
		flags.push('sse');
	}

	if (self.config.debug) {
		req.$flags += 'debug';
		flags.push('debug');
	}

	if (req.xhr) {
		self.stats.request.xhr++;
		req.$flags += 'xhr';
		flags.push('xhr');
	}

	if (self._request_check_referer) {
		var referer = headers['referer'] || '';
		if (referer && referer.indexOf(headers['host']) !== -1) {
			req.$flags += 'referer';
			flags.push('referer');
		}
	}

	req.flags = flags;

	// call event request
	self.emit('request-begin', req, res);

	switch (first) {
		case 'G':
			self.stats.request.get++;
			new Subscribe(self, req, res, 0).end();
			return self;
		case 'H':
			self.stats.request.head++;
			new Subscribe(self, req, res, 0).end();
			return self;
		case 'D':
			self.stats.request['delete']++;
			new Subscribe(self, req, res, 1).urlencoded();
			return self;
		case 'P':
			if (self._request_check_POST) {
				if (multipart) {
					self.stats.request.upload++;
					new Subscribe(self, req, res, 2).multipart(multipart);
				} else {
					if (method === 'PUT')
						self.stats.request.put++;
					else
						self.stats.request.post++;
					new Subscribe(self, req, res, 1).urlencoded();
				}
				return self;
			}
			break;
	}

	self.emit('request-end', req, res);
	self._request_stats(false, false);
	self.stats.request.blocked++;
	res.writeHead(403);
	res.end();
	return self;
};

/**
 * Upgrade HTTP (WebSocket)
 * @param {HttpRequest} req
 * @param {Socket} socket
 * @param {Buffer} head
 */
Framework.prototype._upgrade = function(req, socket, head) {

	if ((req.headers.upgrade || '').toLowerCase() !== 'websocket')
		return;

	// disable timeout
	socket.setTimeout(0);

	var self = framework;
	var headers = req.headers;
	var protocol = req.connection.encrypted || headers['x-forwarded-protocol'] === 'https' ? 'https' : 'http';

	req.uri = framework_internal.parseURI(protocol, req);

	self.emit('websocket', req, socket, head);
	self.stats.request.websocket++;

	if (self.restrictions.isRestrictions) {
		if (self.restrictions.isAllowedIP) {
			if (self.restrictions.allowedIP.indexOf(req.ip) === -1) {
				self.stats.response.restriction++;
				res.writeHead(403);
				res.end();
				return self;
			}
		}

		if (self.restrictions.isBlockedIP) {
			if (self.restrictions.blockedIP.indexOf(req.ip) !== -1) {
				self.stats.response.restriction++;
				res.writeHead(403);
				res.end();
				return self;
			}
		}

		if (self.restrictions.isAllowedCustom) {
			if (!self.restrictions._allowedCustom(headers)) {
				self.stats.response.restriction++;
				res.writeHead(403);
				res.end();
				return self;
			}
		}

		if (self.restrictions.isBlockedCustom) {
			if (self.restrictions._blockedCustom(headers)) {
				self.stats.response.restriction++;
				res.writeHead(403);
				res.end();
				return self;
			}
		}
	}

	req.session = null;
	req.user = null;
	req.flags = [req.isSecure ? 'https' : 'http', 'get'];

	var path = framework_utils.path(req.uri.pathname);
	var websocket = new WebSocketClient(req, socket, head);

	req.path = framework_internal.routeSplit(req.uri.pathname);
	req.websocket = websocket;

	if (self.onLocate)
		req.$language = self.onLocate(req, socket);

	if (self._length_request_middleware === 0)
		return self._upgrade_prepare(req, path, headers);

	if (req.behaviour('disable-middleware'))
		return self._upgrade_prepare(req, path, headers);

	var func = new Array(self._length_request_middleware);
	var indexer = 0;

	for (var i = 0; i < self._length_request_middleware; i++) {
		var middleware = self.routes.middleware[self.routes.request[i]];
		if (!middleware) {
			self.error('Middleware not found: ' + route.middleware[i], null, req.uri);
			continue;
		}

		(function(middleware) {
			func[indexer++] = function(next) {
				middleware.call(framework, req, req.websocket, next);
			};
		})(middleware);
	}

	func._async_middleware(websocket, function() {
		self._upgrade_prepare(req, path, req.headers);
	});
};

/**
 * Prepare WebSocket
 * @private
 * @param {HttpRequest} req
 * @param {WebSocketClient} websocket
 * @param {String} path
 * @param {Object} headers
 */
Framework.prototype._upgrade_prepare = function(req, path, headers) {

	var self = this;

	if (self.onAuthorization === null) {
		var route = self.lookup_websocket(req, req.websocket.uri.pathname, true);
		if (route === null) {
			req.websocket.close();
			req.connection.destroy();
			return;
		}

		self._upgrade_continue(route, req, path);
		return;
	}

	self.onAuthorization.call(self, req, req.websocket, req.flags, function(isLogged, user) {

		if (user)
			req.user = user;

		req.flags.push(isLogged ? 'authorize' : 'unauthorize');

		var route = self.lookup_websocket(req, req.websocket.uri.pathname, false);
		if (route === null) {
			req.websocket.close();
			req.connection.destroy();
			return;
		}

		self._upgrade_continue(route, req, path);
	});
};

/**
 * WebSocket, controller caller
 * @private
 * @param {Object} route
 * @param {HttpRequest} req
 * @param {Socket} socket
 * @param {String} path
 * @return {Framework}
 */
Framework.prototype._upgrade_continue = function(route, req, path) {

	var self = this;
	var socket = req.websocket;

	if (!socket.prepare(route.flags, route.protocols, route.allow, route.length, self.version_header)) {
		socket.close();
		req.connection.destroy();
		return self;
	}

	var id = path + (route.flags.length ? '#' + route.flags.join('-') : '');

	if (route.isBINARY)
		socket.type = 1;
	else if (route.isJSON)
		socket.type = 3;

	var next = function() {
		if (self.connections[id] === undefined) {
			var connection = new WebSocket(self, path, route.controller, id);
			connection.route = route;
			self.connections[id] = connection;
			route.onInitialize.apply(connection, framework_internal.routeParam(route.param.length ? framework_internal.routeSplit(req.uri.pathname, true) : req.path, route));
		}
		socket.upgrade(self.connections[id]);
	};

	if (route.middleware instanceof Array && route.middleware.length) {
		var func = new Array(route.middleware.length);
		var indexer = 0;
		for (var i = 0, length = route.middleware.length; i < length; i++) {
			var middleware = framework.routes.middleware[route.middleware[i]];

			if (!middleware)
				continue;

			(function(middleware) {
				func[indexer++] = function(next) {
					middleware.call(framework, req, socket, next, route.options);
				};
			})(middleware);
		}
		func._async_middleware(socket, next);
		return self;
	}

	next();
	return self;
};

/**
 * Request statistics writer
 * @private
 * @param {Boolean} beg
 * @param {Boolean} isStaticFile
 * @return {Framework}
 */
Framework.prototype._request_stats = function(beg, isStaticFile) {

	var self = this;

	if (beg)
		self.stats.request.pending++;
	else
		self.stats.request.pending--;

	if (self.stats.request.pending < 0)
		self.stats.request.pending = 0;

	return self;
};

/**
 * Get a model
 * @param {String} name
 * @return {Object}
 */
Framework.prototype.model = function(name) {

	var self = this;
	var model = self.models[name];

	if (model || model === null)
		return model;

	if (self.models[name] !== undefined)
		return self.models[name];

	var filename = path.join(directory, self.config['directory-models'], name + EXTENSION_JS);

	if (fs.existsSync(filename))
		self.install('model', name, filename, undefined, undefined, undefined, true);

	return self.models[name] || null;
};

/**
 * Load a source code
 * @param {String} name
 * @param {Object} options Custom initial options, optional.
 * @return {Object}
 */
Framework.prototype.source = function(name, options, callback) {

	var self = this;
	var model = self.sources[name];

	if (model || model === null)
		return model;

	if (self.sources[name] !== undefined)
		return self.sources[name];

	var filename = path.join(directory, self.config['directory-source'], name + EXTENSION_JS);
	if (fs.existsSync(filename))
		self.install('source', name, filename, options, callback, undefined, true);

	return self.sources[name] || null;
};

/**
 * Load a source code (alias for framework.source())
 * @param {String} name
 * @param {Object} options Custom initial options, optional.
 * @return {Object}
 */
Framework.prototype.include = function(name, options, callback) {
	return this.source(name, options, callback);
};

/**
 * Internal logger
 * @private
 * @param {String} message
 * @return {Framework}
 */
Framework.prototype._log = function(a, b, c, d) {
	var self = this;

	if (!self.isDebug)
		return false;

	var length = arguments.length;
	var params = ['---->'];
	for (var i = 0; i < length; i++)
		params.push(arguments[i]);

	setTimeout(function() {
		console.log.apply(console, params);
	}, 1000);
};

/**
 * Send e-mail
 * @param {String or Array} address E-mail address.
 * @param {String} subject E-mail subject.
 * @param {String} view View name.
 * @param {Object} model Optional.
 * @param {Function(err)} callback Optional.
 * @param {String} language Optional.
 * @return {MailMessage}
 */
Framework.prototype.mail = function(address, subject, view, model, callback, language) {

	if (typeof(callback) === STRING) {
		var tmp = language;
		language = callback;
		callback = tmp;
	}

	var controller = new Controller('', null, null, null, '');

	controller.layoutName = '';

	var replyTo;

	if (language) {
		// @todo: Remove in future versions
		if (language.indexOf('@') !== -1) {
			replyTo = language;
			language = undefined;
			console.log('OBSOLETE: F.mail(..., ..., [replyTo] --> has been replaced for [language]).');
		} else
			controller.language = language;
	}

	if (typeof(repository) === OBJECT && repository !== null)
		controller.repository = repository;

	return controller.mail(address, subject, view, model, callback, replyTo);
};

/**
 * Render view
 * @param {String} name View name.
 * @param {Object} model Model.
 * @param {String} layout Layout for the view, optional. Default without layout.
 * @param {Object} repository A repository object, optional. Default empty.
 * @param {String} language Optional.
 * @return {String}
 */
Framework.prototype.view = function(name, model, layout, repository, language) {

	var controller = new Controller('', null, null, null, '');

	if (typeof(layout) === OBJECT) {
		var tmp = repository;
		repository = layout;
		layout = tmp;
	}

	controller.layoutName = layout || '';
	controller.language = language;

	if (typeof(repository) === OBJECT && repository !== null)
		controller.repository = repository;

	var output = controller.view(name, model, true);
	controller = null;
	return output;
};

/**
 * Add a test function or test request
 * @param {String} name Test name.
 * @param {Url or Function} url Url or Callback function(next, name) {}.
 * @param {Array} flags Routed flags (GET, POST, PUT, XHR, JSON ...).
 * @param {Function} callback Callback.
 * @param {Object or String} data Request data.
 * @param {Object} cookies Request cookies.
 * @param {Object} headers Additional headers.
 * @return {Framework}
 */
Framework.prototype.assert = function(name, url, flags, callback, data, cookies, headers) {

	var self = this;

	// !IMPORTANT! framework.testsPriority is created dynamically in framework.test()
	if (typeof(url) === TYPE_FUNCTION) {
		self.tests.push({
			name: _test + ': ' + name,
			priority: framework.testsPriority,
			index: self.tests.length,
			run: url
		});
		return self;
	}

	var method = 'GET';
	var length = 0;
	var type = 0;

	if (headers)
		headers = framework_utils.extend({}, headers);
	else
		headers = {};

	if (flags instanceof Array) {
		length = flags.length;
		for (var i = 0; i < length; i++) {

			switch (flags[i].toLowerCase()) {

				case 'xhr':
					headers['X-Requested-With'] = 'XMLHttpRequest';
					break;

				case 'referer':
				case 'referrer':
					headers['Referer'] = url;
					break;

				case 'json':
					headers['Content-Type'] = 'application/json';
					type = 1;
					break;

				case 'xml':
					headers['Content-Type'] = 'text/xml';
					type = 2;
					break;

				case 'get':
				case 'options':
					method = flags[i].toUpperCase();
					break;

				case 'upload':
					headers['Content-Type'] = 'multipart/form-data';
					break;

				case 'post':
				case 'put':
				case 'delete':

					method = flags[i].toUpperCase();

					if (!headers['Content-Type'])
						headers['Content-Type'] = 'application/x-www-form-urlencoded';

					break;

				case 'raw':
					headers['Content-Type'] = 'application/octet-stream';
					break;

			}
		}
	}

	headers['X-Assertion-Testing'] = '1';
	headers['X-Powered-By'] = 'total.js v' + self.version_header;

	if (cookies) {
		var builder = [];
		var keys = Object.keys(cookies);

		length = keys.length;

		for (var i = 0; i < length; i++)
			builder.push(keys[i] + '=' + encodeURIComponent(cookies[keys[i]]));

		if (builder.length)
			headers['Cookie'] = builder.join('; ');
	}

	var obj = {
		name: _test + ': ' + name,
		priority: framework.testsPriority,
		index: self.tests.length,
		url: url,
		callback: callback,
		method: method,
		data: data,
		headers: headers
	};

	self.tests.push(obj);
	return self;
};

/**
 * Test in progress
 * @private
 * @param {Boolean} stop Stop application.
 * @param {Function} callback Callback.
 * @return {Framework}
 */
Framework.prototype.testing = function(stop, callback) {

	if (stop === undefined)
		stop = true;

	var self = this;

	// !IMPORTANT! framework.isTestError is created dynamically
	//             framework.testsFiles too

	if (self.tests.length === 0) {
		if (self.testsFiles.length === 0) {

			if (callback)
				callback(framework.isTestError === true);

			if (stop)
				self.stop(framework.isTestError ? 1 : 0);

			return self;
		}

		var file = self.testsFiles.shift();
		try {
			file.fn.call(self, self);
			self.testing(stop, callback);
		} catch (e) {
			console.log(new Error(e.stack, file.name, e.lineNumber));
			framework.isTestError = true;
			framework.testsNO++;
			self.testing(stop, callback);
		}
		return self;
	}

	var logger = function(name, start, err) {

		var time = Math.floor(new Date() - start) + ' ms';

		if (err) {
			framework.isTestError = true;
			console.error('Failed [x] '.padRight(20, '.') + ' ' + name + ' <' + (err.name.toLowerCase().indexOf('assert') !== -1 ? err.toString() : err.stack) + '> [' + time + ']');
			return;
		}

		console.info('Passed '.padRight(20, '.') + ' ' + name + ' [' + time + ']');
	};

	var test = self.tests.shift();
	var key = test.name;
	var beg = new Date();

	if (test.run) {
		try {

			// Is used in: process.on('uncaughtException')
			framework.testContinue = function(err) {
				logger(key, beg, err);
				if (err)
					framework.testsNO++;
				else
					framework.testsOK++;
				self.testing(stop, callback);
			};

			test.run.call(self, function() {
				self.testContinue();
			}, key);

		} catch (e) {
			logger(key, beg, e);
			framework.isTestError = true;
			framework.testsNO++;
			self.testing(stop, callback);
		}

		return self;
	}

	var response = function(res) {

		res._buffer = '';

		res.on('data', function(chunk) {
			this._buffer += chunk.toString(ENCODING);
		});

		res.on('end', function() {

			var cookie = res.headers['cookie'] || '';
			var cookies = {};

			if (cookie.length !== 0) {

				var arr = cookie.split(';');
				var length = arr.length;

				for (var i = 0; i < length; i++) {
					var c = arr[i].trim().split('=');
					cookies[c.shift()] = unescape(c.join('='));
				}
			}

			try {
				test.callback(null, res._buffer, res.statusCode, res.headers, cookies, key);
				logger(key, beg);
				framework.testsOK++;
				self.testing(stop, callback);
			} catch (e) {
				framework.testsNO++;
				logger(key, beg, e);
				self.testing(stop, callback);
				throw e;
			}
		});

		res.resume();
	};

	var options = parser.parse((test.url.indexOf('http://') > 0 || test.url.indexOf('https://') > 0 ? '' : 'http://' + self.ip + ':' + self.port) + test.url);
	if (typeof(test.data) === TYPE_FUNCTION)
		test.data = test.data();

	if (typeof(test.data) !== STRING)
		test.data = (test.headers[RESPONSE_HEADER_CONTENTTYPE] || '').indexOf('json') !== -1 ? JSON.stringify(test.data) : qs.stringify(test.data);

	var buf;

	if (test.data && test.data.length) {
		buf = new Buffer(test.data, ENCODING);
		test.headers[RESPONSE_HEADER_CONTENTLENGTH] = buf.length;
	}

	options.method = test.method;
	options.headers = test.headers;

	var con = options.protocol === 'https:' ? https : http;
	var req = test.method === 'POST' || test.method === 'PUT' ? con.request(options, response) : con.get(options, response);

	req.on('error', function(e) {
		logger(key, beg, e);
		self.testsNO++;
		self.testing(stop, callback);
	});

	if (test.data)
		req.end(buf);
	else
		req.end();

	return self;
};

/**
 * Load tests
 * @private
 * @param {Boolean} stop Stop framework after end.
 * @param {String Array} names Test names, optional.
 * @param {Function()} cb
 * @return {Framework}
 */
Framework.prototype.test = function(stop, names, cb) {

	var self = this;

	if (stop === undefined)
		stop = true;

	if (typeof(names) === TYPE_FUNCTION) {
		cb = names;
		names = [];
	} else
		names = names || [];

	var counter = 0;
	self.isTest = true;

	var dir = self.config['directory-tests'];

	if (!fs.existsSync(framework_utils.combine(dir))) {
		if (cb) cb();
		if (stop) setTimeout(function() {
			framework.stop(0);
		}, 500);
		return self;
	}

	self._configure('config-test', true);

	var logger = function(name, start, err) {

		var time = Math.floor(new Date() - start) + ' ms';

		if (err) {
			framework.isTestError = true;
			console.error('Failed [x] '.padRight(20, '.') + ' ' + name + ' <' + (err.name.toLowerCase().indexOf('assert') !== -1 ? err.toString() : err.stack) + '> [' + time + ']');
			return;
		}

		console.info('Passed '.padRight(20, '.') + ' ' + name + ' [' + time + ']');
	};

	var results = function() {

		if (framework.testsResults.length === 0)
			return;

		console.log('');
		console.log('===================== RESULTS ======================');
		console.log('');

		framework.testsResults.forEach(function(fn) {
			fn();
		});

	};

	framework.testsFiles = [];

	if (!framework.testsResults)
		framework.testsResults = [];

	if (!framework.testsOK)
		framework.testsOK = 0;

	if (!framework.testsNO)
		framework.testsNO = 0;

	framework_utils.ls(framework_utils.combine(dir), function(files) {
		files.forEach(function(filePath) {
			var name = path.relative(framework_utils.combine(dir), filePath);
			var filename = filePath;
			var ext = path.extname(filename).toLowerCase();

			if (ext !== EXTENSION_JS)
				return;

			if (names.length && names.indexOf(name.substring(0, name.length - 3)) === -1)
				return;

			var test = require(filename);
			var beg = new Date();

			try {
				var isRun = test.run !== undefined;
				var isInstall = test.isInstall !== undefined;
				var isInit = test.init !== undefined;
				var isLoad = test.load !== undefined;

				_test = name;

				if (test.disabled === true)
					return;

				if (test.order === undefined)
					framework.testsPriority = test.priority === undefined ? self.testsFiles.length : test.priority;
				else
					framework.testsPriority = test.priority;

				var fn = null;

				if (isRun)
					fn = test.run;
				else if (isInstall)
					fn = test.install;
				else if (isInit)
					fn = test.init;
				else if (isLoad)
					fn = test.loadname;

				if (fn === null)
					return;

				self.testsFiles.push({ name: name, index: self.testsFiles.length, fn: fn, priority: framework.testsPriority });

				if (test.usage) {
					(function(test) {
						framework.testsResults.push(function() { test.usage(name); });
					})(test);
				}

				counter++;

			} catch (ex) {
				logger('Failed', beg, ex);
			}
		});

		_test = '';

		if (counter === 0) {

			results();

			if (cb)
				cb();

			if (!stop)
				return self;

			setTimeout(function() {
				framework.stop(1);
			}, 500);

			return self;
		}

		self.testsFiles.sort(function(a, b) {

			if (a.priority > b.priority)
				return 1;

			if (a.priority < b.priority)
				return -1;

			if (a.index > b.index)
				return 1;

			if (a.index < b.index)
				return -1;

			return 0;
		});

		setTimeout(function() {
			console.log('===================== TESTING ======================');
			console.log('');

			self.testing(stop, function() {

				console.log('');
				console.log('Passed ...', framework.testsOK);
				console.log('Failed ...', framework.testsNO);
				console.log('');

				results();
				self.isTest = false;

				console.log('');

				if (cb)
					cb();
			});
		}, 100);
	});

	return self;
};

/**
 * Clear temporary directory
 * @param {Function} callback
 * @param {Boolean} isInit Private argument.
 * @return {Framework}
 */
Framework.prototype.clear = function(callback, isInit) {

	var self = this;
	var dir = self.path.temp();

	if (isInit) {
		if (self.config['disable-clear-temporary-directory']) {
			if (callback)
				callback();
			return self;
		}
	}

	if (!fs.existsSync(dir)) {
		if (callback)
			callback();
		return self;
	}

	framework_utils.ls(dir, function(files, directories) {

		if (isInit) {
			var arr = [];
			for (var i = 0, length = files.length; i < length; i++) {
				var filename = files[i].substring(dir.length);
				if (filename.indexOf('/') === -1)
					arr.push(files[i]);
			}
			files = arr;
			directories = [];
		}

		self.unlink(files, function() {
			self.rmdir(directories, callback);
		});
	});

	if (!isInit) {
		// clear static cache
		self.temporary.path = {};
		self.temporary.range = {};
	}

	return this;
};

/**
 * Remove files in array
 * @param {String Array} arr File list.
 * @param {Function} callback
 * @return {Framework}
 */
Framework.prototype.unlink = function(arr, callback) {
	var self = this;

	if (typeof(arr) === STRING)
		arr = [arr];

	if (!arr.length) {
		if (callback)
			callback();
		return;
	}

	var filename = arr.shift();
	if (!filename) {
		if (callback)
			callback();
		return;
	}

	fs.unlink(filename, function(err) {
		self.unlink(arr, callback);
	});

	return self;
};

/**
 * Remove directories in array
 * @param {String Array} arr
 * @param {Function} callback
 * @return {Framework}
 */
Framework.prototype.rmdir = function(arr, callback) {
	var self = this;

	if (typeof(arr) === STRING)
		arr = [arr];

	if (!arr.length) {
		if (callback)
			callback();
		return;
	}

	var path = arr.shift();
	if (!path) {
		if (callback)
			callback();
		return;
	}

	fs.rmdir(path, function() {
		self.rmdir(arr, callback);
	});

	return self;
};

/**
 * Cryptography (encrypt)
 * @param {String} value
 * @param {String} key Encrypt key.
 * @param {Boolean} isUnique Optional, default true.
 * @return {String}
 */
Framework.prototype.encrypt = function(value, key, isUnique) {

	var self = this;

	if (value === undefined)
		return '';

	var type = typeof(value);

	if (typeof(key) === BOOLEAN) {
		var tmp = isUnique;
		isUnique = key;
		key = tmp;
	}

	if (type === TYPE_FUNCTION)
		value = value();

	if (type === NUMBER)
		value = value.toString();

	if (type === OBJECT)
		value = JSON.stringify(value);

	return value.encrypt(self.config.secret + '=' + key, isUnique);
};

/**
 * Cryptography (decrypt)
 * @param {String} value
 * @param {String} key Decrypt key.
 * @param {Boolean} jsonConvert Optional, default true.
 * @return {Object or String}
 */
Framework.prototype.decrypt = function(value, key, jsonConvert) {

	if (typeof(key) === BOOLEAN) {
		var tmp = jsonConvert;
		jsonConvert = key;
		key = tmp;
	}

	if (typeof(jsonConvert) !== BOOLEAN)
		jsonConvert = true;

	var self = this;
	var result = (value || '').decrypt(self.config.secret + '=' + key);

	if (result === null)
		return null;

	if (jsonConvert) {
		if (result.isJSON()) {
			try {
				return JSON.parse(result);
			} catch (ex) {}
		}
		return null;
	}

	return result;
};

/**
 * Create hash
 * @param {String} type Type (md5, sha1, sha256, etc.)
 * @param {String} value
 * @param {String} salt Optional, default false.
 * @return {String}
 */
Framework.prototype.hash = function(type, value, salt) {
	var hash = crypto.createHash(type);
	var plus = '';

	if (typeof(salt) === STRING)
		plus = salt;
	else if (salt !== false)
		plus = (this.config.secret || '');

	hash.update(value.toString() + plus, ENCODING);
	return hash.digest('hex');
};

/**
 * Resource reader
 * @param {String} name Optional, resource file name. Default: "default".
 * @param {String} key Resource key.
 * @return {String} String
 */
Framework.prototype.resource = function(name, key) {

	if (!key) {
		key = name;
		name = null;
	}

	if (!name)
		name = 'default';

	var self = this;
	var res = self.resources[name];

	if (res !== undefined)
		return res[key] || '';

	var filename = utils.combine(self.config['directory-resources'], name + '.resource');

	if (!fs.existsSync(filename))
		return '';

	var obj = fs.readFileSync(filename).toString(ENCODING).parseConfig();
	self.resources[name] = obj;

	return obj[key] || '';
};

/**
 * Translates text
 * @param {String} language A resource filename, optional.
 * @param {String} text
 * @return {String}
 */
Framework.prototype.translate = function(language, text) {

	if (!text) {
		text = language;
		language = undefined;
	}

	if (text[0] === '#' && text[1] !== ' ')
		return this.resource(language, text.substring(1));

	var value = this.resource(language, 'T' + text.hash());
	if (!value)
		return text;

	return value;
};

/**
 * The translator for the text from the View Engine @(TEXT TO TRANSLATE)
 * @param {String} language A resource filename, optional.
 * @param {String} text
 * @return {String}
 */
Framework.prototype.translator = function(language, text) {
	return framework_internal.parseLocalization(text, language);
};

Framework.prototype._configure_sitemap = function(content) {

	if (content === undefined) {
		var filename = framework_utils.combine('/', 'sitemap');
		if (fs.existsSync(filename))
			content = fs.readFileSync(filename).toString(ENCODING);
		else
			content = '';
	}

	var self = this;

	if (!content)
		return self;

	var arr = content.split('\n');
	var sitemap = {};

	for (var i = 0, length = arr.length; i < length; i++) {

		var str = arr[i];

		if (str === '' || str[0] === '#' || str.substring(0, 3) === '// ')
			continue;

		var index = str.indexOf(' :');
		if (index === -1) {
			index = str.indexOf('\t:');
			if (index === -1)
				continue;
		}

		var key = str.substring(0, index).trim();
		var val = str.substring(index + 2).trim();
		var a = val.split('-->');

		sitemap[key] = { name: a[0].trim(), url: a[1].trim(), parent: a[2] ? a[2].trim() : null };
	}

	self.routes.sitemap = sitemap;
	return self;
};

Framework.prototype.sitemap = function(name, me, language) {

	var self = this;
	if (!self.routes.sitemap)
		return new Array(0);

	if (typeof(me) === STRING) {
		var tmp = language;
		language = me;
		me = language;
	}

	var key = REPOSITORY_SITEMAP + name + '$' + (me ? '1' : '0') + '$' + (language || '');
	if (self.temporary.other[key])
		return self.temporary.other[key];

	var sitemap;
	var id = name;

	if (me === true) {
		sitemap = self.routes.sitemap[name];
		var item = { sitemap: id, id: '', name: '', url: '', last: true, selected: true, index: 0 };
		if (!sitemap)
			return item;

		var title = sitemap.name;
		if (title.startsWith('@('))
			title = self.translate(language, map.name.substring(2, map.name.length - 1).trim());

		item.sitemap = id;
		item.id = name;
		item.name = title;
		item.url = sitemap.url;
		self.temporary.other[key] = item;
		return item;
	}

	var arr = [];
	var index = 0;

	while (true) {
		sitemap = self.routes.sitemap[name];
		if (!sitemap)
			break;

		var title = sitemap.name;
		if (title.startsWith('@('))
			title = self.translate(language, sitemap.name.substring(2, sitemap.name.length - 1));

		arr.push({ sitemap: id, id: name, name: title, url: sitemap.url, last: index === 0, first: sitemap.parent === null || sitemap.parent === undefined || sitemap.parent === '', selected: index === 0, index: index });
		index++;
		name = sitemap.parent;
		if (!name)
			break;
	}

	arr.reverse();
	self.temporary.other[key] = arr;
	return arr;
};

Framework.prototype._configure_dependencies = function(content) {

	if (content === undefined) {
		var filename = framework_utils.combine('/', 'dependencies');
		if (fs.existsSync(filename))
			content = fs.readFileSync(filename).toString(ENCODING);
		else
			content = '';
	}

	var self = this;

	if (!content)
		return self;

	var arr = content.split('\n');

	for (var i = 0, length = arr.length; i < length; i++) {

		var str = arr[i];

		if (str === '' || str[0] === '#' || str.substring(0, 3) === '// ')
			continue;

		var index = str.indexOf(' :');
		if (index === -1) {
			index = str.indexOf('\t:');
			if (index === -1)
				continue;
		}

		var key = str.substring(0, index).trim();
		var url = str.substring(index + 2).trim();
		var options = {};

		index = url.indexOf('-->');

		if (index !== -1) {
			var opt = url.substring(index + 3).trim();
			if (opt.isJSON())
				options = JSON.parse(opt);
			url = url.substring(0, index).trim();
		}

		switch (key) {
			case 'package':
			case 'packages':
			case 'pkg':
				self.install('package', url, options);
				break;
			case 'module':
			case 'modules':
				self.install('module', url, options);
				break;
			case 'model':
			case 'models':
				self.install('model', url, options);
				break;
			case 'source':
			case 'sources':
				self.install('source', url, options);
				break;
			case 'controller':
			case 'controllers':
				self.install('controller', url, options);
				break;
			case 'view':
			case 'views':
				self.install('view', url, options);
				break;
			case 'version':
			case 'versions':
				self.install('version', url, options);
				break;
			case 'config':
			case 'configuration':
				self.install('config', url, options);
				break;
			case 'isomorphic':
			case 'isomorphics':
				self.install('isomorphic', url, options);
				break;
			case 'definition':
			case 'definitions':
				self.install('definition', url, options);
				break;
			case 'middleware':
			case 'middlewares':
				self.install('middleware', url, options);
				break;
		}
	}

	return self;
};

/**
 * Versions configuration
 * @private
 * @param {String} content
 * @return {Framework}
 */
Framework.prototype._configure_versions = function(content) {

	var self = this;

	if (content === undefined) {
		var filename = framework_utils.combine('/', 'versions');
		if (fs.existsSync(filename))
			content = fs.readFileSync(filename).toString(ENCODING);
		else
			content = '';
		self.versions = null;
	}

	if (!content) {
		self.versions = null;
		return self;
	}

	var arr = content.split('\n');
	var obj = {};

	for (var i = 0, length = arr.length; i < length; i++) {

		var str = arr[i];

		if (str === '' || str[0] === '#' || str.substring(0, 3) === '// ')
			continue;

		if (str[0] !== '/')
			str = '/' + str;

		var index = str.indexOf(' :');
		var ismap = false;

		if (index === -1) {
			index = str.indexOf('\t:');
			if (index === -1) {
				index = str.indexOf('-->');
				if (index === -1)
					continue;
				ismap = true;
			}
		}

		var len = ismap ? 3 : 2;
		var key = str.substring(0, index).trim();
		var filename = str.substring(index + len).trim();
		obj[key] = filename;
		if (ismap)
			self.map(filename, self.path.public(key));
	}

	self.versions = obj;
	return self;
};

/**
 * Load configuration
 * @private
 * @param {[type]} arr [description]
 * @param {[type]} rewrite [description]
 * @return {[type]} [description]
 */
Framework.prototype._configure = function(arr, rewrite) {

	var self = this;
	var type = typeof(arr);

	if (type === STRING) {
		var filename = utils.combine('/', arr);
		if (!fs.existsSync(filename))
			return self;
		arr = fs.readFileSync(filename).toString(ENCODING).split('\n');
	}

	if (arr === undefined) {

		var filenameA = utils.combine('/', 'config');
		var filenameB = utils.combine('/', 'config-' + (self.config.debug ? 'debug' : 'release'));

		arr = [];

		// read all files from "configs" directory
		var configs = self.path.configs();
		if (fs.existsSync(configs)) {
			var tmp = fs.readdirSync(configs);
			for (var i = 0, length = tmp.length; i < length; i++) {
				var skip = tmp[i].match(/\-(debug|release|test)$/i);
				if (skip) {
					skip = skip[0].toString().toLowerCase();
					if (skip === '-debug' && !self.isDebug)
						continue;
					if (skip === '-release' && self.isDebug)
						continue;
					if (skip === '-test' && !self.isTest)
						continue;
				}
				arr = arr.concat(fs.readFileSync(configs + tmp[i]).toString(ENCODING).split('\n'));
			}
		}

		if (fs.existsSync(filenameA) && fs.lstatSync(filenameA).isFile())
			arr = arr.concat(fs.readFileSync(filenameA).toString(ENCODING).split('\n'));

		if (fs.existsSync(filenameB) && fs.lstatSync(filenameB).isFile())
			arr = arr.concat(fs.readFileSync(filenameB).toString(ENCODING).split('\n'));
	}

	var done = function() {
		process.title = 'total: ' + self.config.name.removeDiacritics().toLowerCase().replace(/\s/g, '-').substring(0, 8);
		self.isVirtualDirectory = fs.existsSync(utils.combine(self.config['directory-public-virtual']));
	};

	if (!arr instanceof Array) {
		done();
		return self;
	}

	if (!arr.length) {
		done();
		return self;
	}

	if (rewrite === undefined)
		rewrite = true;

	var obj = {};
	var accepts = null;
	var length = arr.length;
	var tmp;

	for (var i = 0; i < length; i++) {
		var str = arr[i];

		if (str === '' || str[0] === '#' || (str[0] === '/' || str[1] === '/'))
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
			case 'default-interval-clear-cache':
			case 'default-interval-clear-resources':
			case 'default-interval-precompile-views':
			case 'default-interval-websocket-ping':
			case 'default-maximum-file-descriptors':
			case 'default-interval-clear-dnscache':
				obj[name] = utils.parseInt(value);
				break;

			case 'static-accepts-custom':
				accepts = value.replace(/\s/g, '').split(',');
				break;

			case 'static-accepts':
				obj[name] = {};
				tmp = value.replace(/\s/g, '').split(',');
				for (var j = 0; j < tmp.length; j++)
					obj[name][tmp[j]] = true;
				break;

			case 'allow-compile-js':
				console.log('CONFIG: allow-compile-js is obsolete, use: allow-compile-script');
				obj['allow-compile-script'] = value.toLowerCase() === 'true' || value === '1' || value === 'on';
				break;

			case 'allow-compile-css':
				console.log('CONFIG: allow-compile-css is obsolete, use: allow-compile-style');
				obj['allow-compile-style'] = value.toLowerCase() === 'true' || value === '1' || value === 'on';
				break;

			case 'allow-gzip':
			case 'allow-websocket':
			case 'allow-performance':
			case 'allow-compile-html':
			case 'allow-compile-style':
			case 'allow-compile-script':
			case 'disable-strict-server-certificate-validation':
			case 'disable-clear-temporary-directory':
				obj[name] = value.toLowerCase() === 'true' || value === '1' || value === 'on';
				break;

			case 'allow-compress-html':
				obj['allow-compile-html'] = value.toLowerCase() === 'true' || value === '1' || value === 'on';
				break;

			case 'version':
				obj[name] = value;
				break;

			case 'static-url-css':
				console.log('OBSOLETE "config.static-url-css": use "config.static-url-style"');
				obj['static-url-style'] = value;
				break;

			case 'static-url-js':
				console.log('OBSOLETE "config.static-url-js": use "config.static-url-script"');
				obj['static-url-script'] = value;
				break;

			default:
				obj[name] = value.isNumber() ? utils.parseInt(value) : value.isNumber(true) ? utils.parseFloat(value) : value.isBoolean() ? value.toLowerCase() === 'true' : value;
				break;
		}
	}

	utils.extend(self.config, obj, rewrite);

	if (self.config['etag-version'] === '')
		self.config['etag-version'] = self.config.version.replace(/\.|\s/g, '');

	if (self.config['default-timezone'])
		process.env.TZ = self.config['default-timezone'];

	if (accepts !== null && accepts.length) {
		accepts.forEach(function(accept) {
			self.config['static-accepts'][accept] = true;
		});
	}

	if (self.config['disable-strict-server-certificate-validation'] === true)
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

	if (self.config['allow-performance'])
		http.globalAgent.maxSockets = 9999;

	done();
	self.emit('configure', self.config);
	return self;
};

/**
 * Create URL: JavaScript (according to config['static-url-script'])
 * @alias
 * @param {String} name
 * @return {String}
 */
Framework.prototype.routeJS = function(name) {
	console.log('OBSOLETE framework.routeJS(): use framework.routeScript()');
	return this.routeScript(name);
};

/**
 * Create URL: JavaScript (according to config['static-url-script'])
 * @param {String} name
 * @return {String}
 */
Framework.prototype.routeScript = function(name) {
	var self = this;

	if (name.lastIndexOf(EXTENSION_JS) === -1)
		name += EXTENSION_JS;

	return self._routeStatic(name, self.config['static-url-script']);
};

/**
 * Create URL: CSS (according to config['static-url-style'])
 * @alias
 * @param {String} name
 * @return {String}
 */
Framework.prototype.routeCSS = function(name) {
	console.log('OBSOLETE framework.routeCSS(): use framework.routeStyle()');
	return this.routeStyle(name);
};

/**
 * Create URL: CSS (according to config['static-url-style'])
 * @param {String} name
 * @return {String}
 */
Framework.prototype.routeStyle = function(name) {
	var self = this;

	if (name.lastIndexOf('.css') === -1)
		name += '.css';

	return self._routeStatic(name, self.config['static-url-style']);
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
Framework.prototype.routeDownload = function(name) {
	var self = this;
	return self._routeStatic(name, self.config['static-url-download']);
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
	return this._version((name[0] === '/' ? '' : directory) + this._version(name));
};

/*
	Internal mapping function
	@name {String} :: filename
	return {String}
*/
Framework.prototype._version = function(name) {
	var self = this;
	if (self.versions !== null)
		name = self.versions[name] || name;
	if (self.onVersion !== null)
		name = self.onVersion(name) || name;
	return name;
};

Framework.prototype._version_prepare = function(html) {
	var self = this;

	var match = html.match(REG_VERSIONS);

	if (!match)
		return html;

	for (var i = 0, length = match.length; i < length; i++) {

		var src = match[i].toString();
		var end = 5;

		// href
		if (src[0] === 'h')
			end = 6;

		var name = src.substring(end, src.length - 1);
		html = html.replace(match[i], src.substring(0, end) + self._version(name) + '"');
	}

	return html;
};

/**
 * Lookup for the route
 * @param {HttpRequest} req
 * @param {String} url URL address.
 * @param {String Array} flags
 * @param {Boolean} noLoggedUnlogged A helper argument.
 * @return {Object}
 */
Framework.prototype.lookup = function(req, url, flags, noLoggedUnlogged) {

	var self = this;
	var isSystem = url[0] === '#';
	var subdomain = req.subdomain === null ? null : req.subdomain.join('.');

	if (isSystem)
		req.path = [url];

	// helper for 401 http status
	req.$isAuthorized = true;

	var key;

	if (!isSystem) {
		key = '#' + url + '$' + req.$flags + (subdomain ? '$' + subdomain : '');
		if (framework.temporary.other[key])
			return framework.temporary.other[key];
	}

	var length = self.routes.web.length;
	for (var i = 0; i < length; i++) {

		var route = self.routes.web[i];

		if (route.CUSTOM) {
			if (!route.CUSTOM(url, req, flags))
				continue;
		} else {
			if (!framework_internal.routeCompareSubdomain(subdomain, route.subdomain))
				continue;
			if (route.isASTERIX) {
				if (!framework_internal.routeCompare(req.path, route.url, isSystem, true))
					continue;
			} else {
				if (!framework_internal.routeCompare(req.path, route.url, isSystem))
					continue;
			}
		}

		if (isSystem) {
			if (route.isSYSTEM)
				return route;
			continue;
		}

		if (route.isPARAM && route.regexp) {
			var skip = false;
			for (var j = 0, l = route.regexpIndexer.length; j < l; j++) {

				var p = req.path[route.regexpIndexer[j]];
				if (p === undefined) {
					skip = true;
					break;
				}

				if (!route.regexp[route.regexpIndexer[j]].test(p)) {
					skip = true;
					break;
				}
			}

			if (skip)
				continue;
		}

		if (route.flags !== null && route.flags.length) {
			var result = framework_internal.routeCompareFlags2(req, route, noLoggedUnlogged ? true : route.isMEMBER);
			if (result === -1)
				req.$isAuthorized = false; // request is not authorized
			if (result < 1)
				continue;
		}

		if (key && route.isCACHE && req.$isAuthorized)
			framework.temporary.other[key] = route;

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
Framework.prototype.lookup_websocket = function(req, url, noLoggedUnlogged) {

	var self = this;
	var subdomain = req.subdomain === null ? null : req.subdomain.join('.');
	var length = self.routes.websockets.length;

	req.$isAuthorized = true;

	for (var i = 0; i < length; i++) {

		var route = self.routes.websockets[i];

		if (route.CUSTOM) {
			if (!route.CUSTOM(url, req))
				continue;
		} else {
			if (!framework_internal.routeCompareSubdomain(subdomain, route.subdomain))
				continue;
			if (route.isASTERIX) {
				if (!framework_internal.routeCompare(req.path, route.url, false, true))
					continue;
			} else {
				if (!framework_internal.routeCompare(req.path, route.url, false))
					continue;
			}
		}

		if (route.isPARAM && route.regexp) {
			var skip = false;
			for (var j = 0, l = route.regexpIndexer.length; j < l; j++) {

				var p = req.path[route.regexpIndexer[j]];
				if (p === undefined) {
					skip = true;
					break;
				}

				if (!route.regexp[route.regexpIndexer[j]].test(p)) {
					skip = true;
					break;
				}
			}

			if (skip)
				continue;
		}

		if (route.flags !== null && route.flags.length) {

			// var result = framework_internal.routeCompareFlags(req.flags, route.flags, noLoggedUnlogged ? true : route.isMEMBER);
			var result = framework_internal.routeCompareFlags2(req, route, noLoggedUnlogged ? true : route.isMEMBER);

			if (result === -1)
				req.$isAuthorized = false;

			if (result < 1)
				continue;
		}

		return route;
	}

	return null;
};

/**
 * Accept file type
 * @param {String} extension
 * @param {String} contentType Content-Type for file extension, optional.
 * @return {Framework}
 */
Framework.prototype.accept = function(extension, contentType) {

	var self = this;

	if (extension[0] !== '.')
		extension = '.' + extension;

	self.config['static-accepts'][extension] = true;

	if (contentType)
		utils.setContentType(extension, contentType);

	return self;
};

/*
	@name {String}
	@id {String} :: optional, Id of process
	@timeout {Number} :: optional, timeout - default undefined (none)
	@args {Array} :: optional, array of arguments
	return {Worker(fork)}
*/
/**
 * Run worker
 * @param {String} name
 * @param {String} id Worker id, optional.
 * @param {Number} timeout Timeout, optional.
 * @param {Array} args Additional arguments, optional.
 * @return {ChildProcess}
 */
Framework.prototype.worker = function(name, id, timeout, args) {

	var self = this;
	var fork = null;
	var type = typeof(id);

	if (type === NUMBER && timeout === undefined) {
		timeout = id;
		id = null;
		type = UNDEFINED;
	}

	if (type === STRING)
		fork = self.workers[id] || null;

	if (id instanceof Array) {
		args = id;
		id = null;
		timeout = undefined;
	}

	if (timeout instanceof Array) {
		args = timeout;
		timeout = undefined;
	}

	if (fork !== null)
		return fork;

	var filename = utils.combine(self.config['directory-workers'], name) + EXTENSION_JS;

	if (!args)
		args = new Array(0);

	fork = child.fork(filename, args, { cwd: directory });

	id = name + '_' + new Date().getTime();
	fork.__id = id;
	self.workers[id] = fork;

	fork.on('exit', function() {
		var self = this;
		if (self.__timeout)
			clearTimeout(self.__timeout);
		delete framework.workers[self.__id];
	});

	if (typeof(timeout) !== NUMBER)
		return fork;

	fork.__timeout = setTimeout(function() {

		fork.kill();
		fork = null;

	}, timeout);

	return fork;
};

// *********************************************************************************
// =================================================================================
// Framework Restrictions
// 1.01
// =================================================================================
// *********************************************************************************

function FrameworkRestrictions() {
	this.isRestrictions = false;
	this.isAllowedIP = false;
	this.isBlockedIP = false;
	this.isAllowedCustom = false;
	this.isBlockedCustom = false;
	this.allowedIP = [];
	this.blockedIP = [];
	this.allowedCustom = {};
	this.blockedCustom = {};
	this.allowedCustomKeys = [];
	this.blockedCustomKeys = [];
};

/*
	Allow IP or custom header
	@name {String} :: IP or Header name
	@value {RegExp} :: optional, header value
	return {Framework}
*/
FrameworkRestrictions.prototype.allow = function(name, value) {

	var self = this;

	// IP address
	if (value === undefined) {
		self.allowedIP.push(name);
		self.refresh();
		return framework;
	}

	// Custom header
	if (self.allowedCustom[name] === undefined)
		self.allowedCustom[name] = [value];
	else
		self.allowedCustom[name].push(value);

	self.refresh();
	return framework;

};

/*
	Disallow IP or custom header
	@name {String} :: IP or Header name
	@value {RegExp} :: optional, header value
	return {Framework}
*/
FrameworkRestrictions.prototype.disallow = function(name, value) {

	var self = this;

	// IP address
	if (value === undefined) {
		self.blockedIP.push(name);
		self.refresh();
		return framework;
	}

	// Custom header
	if (self.blockedCustom[name] === undefined)
		self.blockedCustom[name] = [value];
	else
		self.blockedCustom[name].push(value);

	self.refresh();
	return framework;

};

/*
	INTERNAL: Refresh internal informations
	return {Framework}
*/
FrameworkRestrictions.prototype.refresh = function() {

	var self = this;

	self.isAllowedIP = self.allowedIP.length > 0;
	self.isBlockedIP = self.blockedIP.length > 0;

	self.isAllowedCustom = !utils.isEmpty(self.allowedCustom);
	self.isBlockedCustom = !utils.isEmpty(self.blockedCustom);

	self.allowedCustomKeys = Object.keys(self.allowedCustom);
	self.blockedCustomKeys = Object.keys(self.blockedCustom);

	self.isRestrictions = self.isAllowedIP || self.isBlockedIP || self.isAllowedCustom || self.isBlockedCustom;

	return framework;
};

/*
	Clear all restrictions for IP
	return {Framework}
*/
FrameworkRestrictions.prototype.clearIP = function() {
	var self = this;
	self.allowedIP = [];
	self.blockedIP = [];
	self.refresh();
	return framework;
}

/*
	Clear all restrictions for custom headers
	return {Framework}
*/
FrameworkRestrictions.prototype.clearHeaders = function() {
	var self = this;
	self.allowedCustom = {};
	self.blockedCustom = {};
	self.allowedCustomKeys = [];
	self.blockedCustomKeys = [];
	self.refresh();
	return framework;
}

/*
	INTERNAL: Restrictions using
	return {Framework}
*/
FrameworkRestrictions.prototype._allowedCustom = function(headers) {

	var self = this;
	var length = self.allowedCustomKeys.length;

	for (var i = 0; i < length; i++) {

		var key = self.allowedCustomKeys[i];
		var value = headers[key];
		if (value === undefined)
			return false;

		var arr = self.allowedCustom[key];
		var max = arr.length;

		for (var j = 0; j < max; j++) {

			if (value.search(arr[j]) !== -1)
				return false;

		}
	}

	return true;
};

/*
	INTERNAL: Restrictions using
	return {Framework}
*/
FrameworkRestrictions.prototype._blockedCustom = function(headers) {

	var self = this;
	var length = self.blockedCustomKeys.length;

	for (var i = 0; i < length; i++) {

		var key = self.blockedCustomKeys[i];
		var value = headers[key];

		if (value === undefined)
			return false;

		var arr = self.blockedCustom[key];
		var max = arr.length;

		for (var j = 0; j < max; j++) {
			if (value.search(arr[j]) !== -1)
				return true;
		}

	}

	return false;
};

// *********************************************************************************
// =================================================================================
// Framework File System
// 1.01
// =================================================================================
// *********************************************************************************

function FrameworkFileSystem() {
	this.create = {
		style: this.createStyle.bind(this),
		css: this.createStyle.bind(this),
		database: this.createDatabase.bind(this),
		file: this.createFile.bind(this),
		script: this.createScript.bind(this),
		js: this.createScript.bind(this),
		resource: this.createResource.bind(this),
		temporary: this.createTemporary.bind(this),
		temp: this.createTemporary.bind(this),
		view: this.createView.bind(this),
		worker: this.createWorker.bind(this)
	};

	this.rm = {
		css: this.deleteStyle.bind(this),
		style: this.deleteStyle.bind(this),
		database: this.deleteDatabase.bind(this),
		file: this.deleteFile.bind(this),
		js: this.deleteScript.bind(this),
		script: this.deleteScript.bind(this),
		resource: this.deleteResource.bind(this),
		temporary: this.deleteTemporary.bind(this),
		temp: this.deleteTemporary.bind(this),
		view: this.deleteView.bind(this),
		worker: this.deleteWorker.bind(this)
	};
}

/*
	Delete a file - CSS
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteStyle = function(name) {
	var self = this;

	if (name.lastIndexOf('.css') === -1)
		name += '.css';

	var filename = utils.combine(framework.config['directory-public'], framework.config['static-url-style'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - JS
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteScript = function(name) {
	var self = this;

	if (name.lastIndexOf(EXTENSION_JS) === -1)
		name += EXTENSION_JS;

	var filename = utils.combine(framework.config['directory-public'], framework.config['static-url-script'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - View
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteView = function(name) {
	var self = this;

	if (name.lastIndexOf('.html') === -1)
		name += '.html';

	var filename = utils.combine(framework.config['directory-views'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - Database
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteDatabase = function(name) {
	var self = this;
	var filename = utils.combine(framework.config['directory-databases'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - Worker
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteWorker = function(name) {
	var self = this;

	if (name.lastIndexOf(EXTENSION_JS) === -1)
		name += EXTENSION_JS;

	var filename = utils.combine(framework.config['directory-workers'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - Resource
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteResource = function(name) {
	var self = this;

	if (name.lastIndexOf('.resource') === -1)
		name += '.resource';

	var filename = utils.combine(framework.config['directory-resources'], name);
	return self.deleteFile(filename);
};

/*
	Delete a file - Temporary
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteTemporary = function(name) {
	var self = this;
	var filename = utils.combine(framework.config['directory-temp'], name);
	return self.deleteFile(filename);
};

/*
	Internal :: Delete a file
	@name {String}
	return {Boolean}
*/
FrameworkFileSystem.prototype.deleteFile = function(filename) {
	fsFileExists(filename, function(exist) {
		if (!exist)
			return;
		fs.unlink(filename);
	});
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
FrameworkFileSystem.prototype.createStyle = function(name, content, rewrite, append) {

	var self = this;

	if (!content)
		return false;

	if (name.lastIndexOf('.css') === -1)
		name += '.css';

	var filename = utils.combine(framework.config['directory-public'], framework.config['static-url-style'], name);
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
FrameworkFileSystem.prototype.createScript = function(name, content, rewrite, append) {

	var self = this;

	if (!content)
		return false;

	if (name.lastIndexOf(EXTENSION_JS) === -1)
		name += EXTENSION_JS;

	var filename = utils.combine(framework.config['directory-public'], framework.config['static-url-script'], name);
	return self.createFile(filename, content, append, rewrite);
};

/*
	Create a database
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
FrameworkFileSystem.prototype.createDatabase = function(name, content, rewrite, append) {

	var self = this;

	if (!content)
		return false;

	var filename = utils.combine(framework.config['directory-databases'], name);
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

	if (!content)
		return false;

	if (name.lastIndexOf('.html') === -1)
		name += '.html';

	framework.path.verify('views');

	var filename = utils.combine(framework.config['directory-views'], name);
	return self.createFile(filename, content, append, rewrite);
};

/*
	Create a file with the worker
	@name {String}
	@content {String}
	@rewrite {Boolean} :: optional (default false)
	@append {Boolean} :: optional (default false)
	return {Boolean}
*/
FrameworkFileSystem.prototype.createWorker = function(name, content, rewrite, append) {

	var self = this;

	if (!content)
		return false;

	if (name.lastIndexOf(EXTENSION_JS) === -1)
		name += EXTENSION_JS;

	framework.path.verify('workers');

	var filename = utils.combine(framework.config['directory-workers'], name);
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

	if (!content)
		return false;

	if (name.lastIndexOf('.resource') === -1)
		name += '.resource';

	var builder = content;

	if (typeof(content) === OBJECT) {
		builder = '';
		Object.keys(content).forEach(function(o) {
			builder += o.padRight(20, ' ') + ': ' + content[o] + '\n';
		});
	}

	framework.path.verify('resources');

	var filename = utils.combine(framework.config['directory-resources'], name);
	return self.createFile(filename, builder, append, rewrite);
};

/*
	Create a temporary file
	@name {String}
	@stream {Stream}
	@callback {Function} :: function(err, filename) {}
	return {Boolean}
*/
FrameworkFileSystem.prototype.createTemporary = function(name, stream, callback) {

	var self = this;

	if (typeof(stream) === 'string') {
		Utils.download(stream, ['get'], function(err, response) {

			if (err) {
				if (callback)
					return callback(err);
				F.error(err);
				return;
			}

			self.createTemporary(name, response, callback);
		});
		return;
	}

	framework.path.verify('temp');

	var filename = utils.combine(framework.config['directory-temp'], name);
	var writer = fs.createWriteStream(filename);

	if (!callback) {
		stream.pipe(writer);
		return self;
	}

	writer.on('error', function(err) {
		callback(err, filename);
	});

	writer.on('finish', function() {
		callback(null, filename);
	});

	stream.pipe(writer);
	return self;
};

/*
	Internal :: Create a file with the content
	@filename {String}
	@content {String}
	@append {Boolean}
	@rewrite {Boolean}
	@callback {Function} :: optional
	return {Boolean}
*/
FrameworkFileSystem.prototype.createFile = function(filename, content, append, rewrite, callback) {

	var self = this;

	if (content.substring(0, 7) === 'http://' || content.substring(0, 8) === 'https://') {

		utils.request(content, ['get'], function(err, data) {

			if (!err)
				self.createFile(filename, data, append, rewrite);

			if (typeof(callback) === TYPE_FUNCTION)
				callback(err, filename);

		});

		return true;
	}

	if (!content)
		return false;

	var exists = fs.existsSync(filename);

	if (exists && append) {
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

	if (typeof(callback) === TYPE_FUNCTION)
		callback(null, filename);

	return true;
};

// *********************************************************************************
// =================================================================================
// Framework path
// =================================================================================
// *********************************************************************************

function FrameworkPath() {}

FrameworkPath.prototype.verify = function(name) {
	var prop = '$directory-' + name;
	if (framework.temporary.path[prop])
		return framework;
	var dir = utils.combine(framework.config['directory-' + name]);
	if (!fs.existsSync(dir))
		fs.mkdirSync(dir);
	framework.temporary.path[prop] = true;
	return framework;
};

FrameworkPath.prototype.public = function(filename) {
	return utils.combine(framework.config['directory-public'], filename || '');
};

FrameworkPath.prototype.private = function(filename) {
	return utils.combine(framework.config['directory-private'], filename || '');
};

FrameworkPath.prototype.isomorphic = function(filename) {
	return utils.combine(framework.config['directory-isomorphic'], filename || '');
};

FrameworkPath.prototype.configs = function(filename) {
	return utils.combine(framework.config['directory-configs'], filename || '');
};

FrameworkPath.prototype.virtual = function(filename) {
	return utils.combine(framework.config['directory-public-virtual'], filename || '');
};

FrameworkPath.prototype.logs = function(filename) {
	this.verify('logs');
	return utils.combine(framework.config['directory-logs'], filename || '');
};

FrameworkPath.prototype.models = function(filename) {
	return utils.combine(framework.config['directory-models'], filename || '');
};
FrameworkPath.prototype.temp = function(filename) {
	this.verify('temp');
	return utils.combine(framework.config['directory-temp'], filename || '');
};

FrameworkPath.prototype.temporary = function(filename) {
	return this.temp(filename);
};

FrameworkPath.prototype.views = function(filename) {
	return utils.combine(framework.config['directory-views'], filename || '');
};

FrameworkPath.prototype.workers = function(filename) {
	return utils.combine(framework.config['directory-workers'], filename || '');
};

FrameworkPath.prototype.databases = function(filename) {
	this.verify('databases');
	return utils.combine(framework.config['directory-databases'], filename || '');
};

FrameworkPath.prototype.modules = function(filename) {
	return utils.combine(framework.config['directory-modules'], filename || '');
};

FrameworkPath.prototype.controllers = function(filename) {
	return utils.combine(framework.config['directory-controllers'], filename || '');
};

FrameworkPath.prototype.definitions = function(filename) {
	return utils.combine(framework.config['directory-definitions'], filename || '');
};

FrameworkPath.prototype.tests = function(filename) {
	return utils.combine(framework.config['directory-tests'], filename || '');
};

FrameworkPath.prototype.resources = function(filename) {
	return utils.combine(framework.config['directory-resources'], filename || '');
};

FrameworkPath.prototype.root = function(filename) {
	return path.join(directory, filename || '');
};

FrameworkPath.prototype.services = function(filename) {
	return utils.combine(framework.config['directory-services'], filename || '');
};

FrameworkPath.prototype.package = function(name, filename) {
	return path.join(directory, framework.config['directory-temp'], name, filename || '');
};

FrameworkPath.prototype.packages = function(filename) {
	return path.join(directory, framework.config['directory-packages'], filename || '');
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
function FrameworkCache() {
	this.items = {};
	this.count = 1;
	this.interval = null;
}

/*
	Cache init
	return {Cache}
*/
FrameworkCache.prototype.init = function(interval) {

	var self = this;

	self.interval = setInterval(function() {
		framework.cache.recycle();
	}, interval || 1000 * 60);

	return self;
};

FrameworkCache.prototype.stop = function() {
	var self = this;
	clearInterval(self.interval);
	return self;
};

FrameworkCache.prototype.clear = function() {
	var self = this;
	self.items = {};
	return self;
};

/*
	Internal function
	return {Cache}
*/
FrameworkCache.prototype.recycle = function() {

	var self = this;
	var items = self.items;
	var expire = new Date();

	self.count++;

	for (var o in items) {
		var value = items[o];
		if (value.expire < expire) {
			framework.emit('cache-expire', o, value.value);
			delete items[o];
		}
	}

	framework._service(self.count);
	return self;
};

/*
	Add item to cache
	@name {String}
	@value {Object}
	@expire {Date}
	return @value
*/
FrameworkCache.prototype.add = function(name, value, expire, sync) {
	var self = this;
	var type = typeof(expire);

	switch (type) {
		case STRING:
			expire = expire.parseDateExpiration();
			break;

		case UNDEFINED:
			expire = new Date().add('m', 5);
			break;
	}

	self.items[name] = { value: value, expire: expire };
	framework.emit('cache-set', name, value, expire, sync);

	return value;
};

FrameworkCache.prototype.set = function(name, value, expire, sync) {
	return this.add(name, value, expire, sync);
};

/**
 * Get item from the cache
 * @alias FrameworkCache.prototype.get
 * @param {String} key
 * @param {Object} def Default value.
 * @return {Object}
 */
FrameworkCache.prototype.read = function(key, def) {
	return this.get(key);
};

/**
 * Get item from the cache
 * @param {String} key
 * @param {Object} def Default value.
 * @return {Object}
 */
FrameworkCache.prototype.get = function(key, def) {
	var self = this;
	var value = self.items[key] || null;

	if (value === null)
		return typeof(def) === UNDEFINED ? null : def;

	if (value.expire < new Date())
		return typeof(def) === UNDEFINED ? null : def;

	return value.value;
};

/*
	Update cache item expiration
	@name {String}
	@expire {Date}
	return {Cache}
*/
FrameworkCache.prototype.setExpire = function(name, expire) {
	var self = this;
	var obj = self.items[name];

	if (obj === undefined)
		return self;

	if (typeof(expire) === STRING)
		expire = expire.parseDateExpiration();

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
	var value = self.items[name] || null;

	delete self.items[name];
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
	var isReg = utils.isRegExp(search);

	for (var key in self.items) {

		if (isReg) {
			if (!search.test(key))
				continue;
		} else {
			if (key.indexOf(search) === -1)
				continue;
		}

		self.remove(key);
		count++;
	}

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
		if (fnCallback)
			fnCallback(value);
		return self;
	}

	fnCache(function(value, expire) {
		self.add(name, value, expire);
		if (fnCallback)
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
var REPOSITORY_META_IMAGE = '$image';
var REPOSITORY_PLACE = '$place';
var REPOSITORY_SITEMAP = '$sitemap';
var ATTR_END = '"';

function Subscribe(framework, req, res, type) {

	// type = 0 - GET, DELETE
	// type = 1 - POST, PUT
	// type = 2 - POST MULTIPART
	// type = 3 - file routing

	this.controller = null;
	this.req = req;
	this.res = res;
	this.route = null;
	this.timeout = null;
	this.isCanceled = false;
	this.isTransfer = false;
	this.header = '';
	this.error = null;
}

Subscribe.prototype.success = function() {
	var self = this;

	if (self.timeout)
		clearTimeout(self.timeout);

	self.timeout = null;
	self.isCanceled = true;
	return self;
};

Subscribe.prototype.file = function() {
	var self = this;

	self.req.on('end', function() {
		self.doEndfile(this);
	});

	self.req.resume();
	return self;
};

/**
 * Process MULTIPART (uploaded files)
 * @param {String} header Content-Type header.
 * @return {FrameworkSubscribe}
 */
Subscribe.prototype.multipart = function(header) {

	var self = this;
	var req = self.req;

	self.route = framework.lookup(req, req.uri.pathname, req.flags, true);
	self.header = header;

	if (self.route === null) {
		framework._request_stats(false, false);
		framework.stats.request.blocked++;
		self.res.writeHead(403);
		self.res.end();
		return self;
	}

	framework.path.verify('temp');
	framework_internal.parseMULTIPART(req, header, self.route, framework.config['directory-temp'], self);
	return self;
};

Subscribe.prototype.urlencoded = function() {

	var self = this;
	self.route = framework.lookup(self.req, self.req.uri.pathname, self.req.flags, true);

	if (self.route === null) {
		self.req.clear(true);
		framework.stats.request.blocked++;
		framework._request_stats(false, false);
		self.res.writeHead(403);
		self.res.end();
		return self;
	}

	self.req.buffer_has = true;
	self.req.buffer_exceeded = false;

	// THROWS (in OSX): Assertion failed: (Buffer::HasInstance(args[0]) == true), function Execute, file ../src/node_http_parser.cc, line 392.
	//self.req.socket.setEncoding(ENCODING);

	self.req.on('data', function(chunk) {
		self.doParsepost(chunk);
	});

	self.end();
	return self;
};

Subscribe.prototype.end = function() {
	var self = this;

	self.req.on('end', function() {
		self.doEnd();
	});

	self.req.resume();
};

/**
 * Execute controller
 * @private
 * @param {Number} status Default HTTP status.
 * @return {FrameworkSubscribe}
 */
Subscribe.prototype.execute = function(status) {

	var self = this;
	var route = self.route;
	var req = self.req;
	var res = self.res;

	if ((route === null || route.controller[0] === '#') && status > 399) {
		switch (status) {
			case 400:
				framework.stats.response.error400++;
				break;
			case 401:
				framework.stats.response.error401++;
				break;
			case 403:
				framework.stats.response.error403++;
				break;
			case 404:
				framework.stats.response.error404++;
				break;
			case 408:
				framework.stats.response.error408++;
				break;
			case 431:
				framework.stats.response.error431++;
				break;
			case 500:
				framework.stats.response.error500++;
				break;
			case 501:
				framework.stats.response.error501++;
				break;
		}
	}

	if (route === null) {
		if (!status)
			status = 404;

		if (status === 400 && self.exception instanceof Builders.ErrorBuilder) {
			if (req.$language)
				self.exception.resource(req.$language, framework.config['default-errorbuilder-resource-prefix']);
			framework.responseContent(req, res, 200, self.exception.transform(), self.exception.contentType, framework.config['allow-gzip']);
			return self;
		}

		framework.responseContent(req, res, status, utils.httpStatus(status) + prepare_error(self.exception), CONTENTTYPE_TEXTPLAIN, framework.config['allow-gzip']);
		return self;
	}

	var name = route.controller;

	if (route.isMOBILE_VARY)
		req.$mobile = true;

	if (route.currentViewDirectory === undefined)
		route.currentViewDirectory = name[0] !== '#' && name !== 'default' && name !== '' ? '/' + name + '/' : '';

	var controller = new Controller(name, req, res, self, route.currentViewDirectory);

	controller.isTransfer = self.isTransfer;
	controller.exception = self.exception;

	self.controller = controller;

	if (!self.isCanceled && route.timeout > 0) {
		self.timeout = setTimeout(function() {
			self.doCancel();
		}, route.timeout);
	}

	if (route.isDELAY)
		self.res.writeContinue();

	if (framework._length_middleware === 0 || route.middleware === null)
		return self.doExecute();

	var length = route.middleware.length;
	var func = new Array(length);
	var indexer = 0;

	for (var i = 0; i < length; i++) {

		var middleware = framework.routes.middleware[route.middleware[i]];
		if (!middleware) {
			framework.error('Middleware not found: ' + route.middleware[i], controller.name, req.uri);
			continue;
		}

		(function(middleware) {
			func[indexer++] = function(next) {
				middleware.call(controller, req, res, next, route.options, controller);
			};
		})(middleware);
	}

	func._async_middleware(res, function() {
		self.doExecute();
	});

	return self;
};



/*
	@flags {String Array}
	@url {String}
*/
Subscribe.prototype.prepare = function(flags, url) {

	var self = this;
	var req = self.req;
	var res = self.res;

	if (framework.onAuthorization) {
		var length = flags.length;
		framework.onAuthorization(req, res, flags, function(isAuthorized, user) {

			if (length !== flags.length)
				req.$flags += flags.slice(length).join('');

			if (typeof(isAuthorized) !== BOOLEAN) {
				user = isAuthorized;
				isAuthorized = !user;
			}

			req.isAuthorized = isAuthorized;
			self.doAuthorization(isAuthorized, user);
		});
		return self;
	}

	if (self.route === null)
		self.route = framework.lookup(req, req.buffer_exceeded ? '#431' : url || req.uri.pathname, req.flags);

	if (self.route === null)
		self.route = framework.lookup(req, '#404');

	self.execute(req.buffer_exceeded ? 431 : 404);
	return self;
};

Subscribe.prototype.doExecute = function() {

	var self = this;
	var name = self.route.controller;
	var controller = self.controller;
	var req = self.req;

	try {

		if (controller.isCanceled)
			return self;

		framework.emit('controller', controller, name, self.route.options);

		if (controller.isCanceled)
			return self;

		if (self.route.isCACHE && !framework.temporary.other[req.uri.pathname])
			framework.temporary.other[req.uri.pathname] = req.path;

		if (self.route.isGENERATOR)
			async.call(controller, self.route.execute, true)(controller, framework_internal.routeParam(self.route.param.length ? framework_internal.routeSplit(req.uri.pathname, true) : req.path, self.route));
		else
			self.route.execute.apply(controller, framework_internal.routeParam(self.route.param.length ? framework_internal.routeSplit(req.uri.pathname, true) : req.path, self.route));

		return self;

	} catch (err) {
		controller = null;
		framework.error(err, name, req.uri);
		self.exception = err;
		self.route = framework.lookup(req, '#500');
		self.execute(500);
	}

	return self;
};

/*
	@isLogged {Boolean}
*/
Subscribe.prototype.doAuthorization = function(isLogged, user) {

	var self = this;
	var req = self.req;
	var auth = isLogged ? 'authorize' : 'unauthorize';

	req.flags.push(auth);
	req.$flags += auth;

	if (user)
		req.user = user;

	var route = framework.lookup(req, req.buffer_exceeded ? '#431' : req.uri.pathname, req.flags);
	var status = req.$isAuthorized ? 404 : 401;

	if (route === null)
		route = framework.lookup(req, '#' + status);

	self.route = route;
	self.execute(req.buffer_exceeded ? 431 : status);

	return self;
};

Subscribe.prototype.doEnd = function() {

	var self = this;
	var req = self.req;
	var res = self.res;
	var route = self.route;

	if (req.buffer_exceeded) {
		route = framework.lookup(req, '#431');

		if (route === null) {
			framework.response431(req, res);
			return self;
		}

		self.route = route;
		self.execute(431);
		return self;
	}

	req.buffer_data = req.buffer_data.toString(ENCODING);
	var schema;

	if (!req.buffer_data) {

		if (!route || !route.schema) {
			req.buffer_data = null;
			self.prepare(req.flags, req.uri.pathname);
			return self;
		}

		framework.onSchema(req, route.schema[0], route.schema[1], function(err, body) {

			if (err) {
				self.route400(err);
				return self;
			}

			req.body = body;
			self.prepare(req.flags, req.uri.pathname);
		});

		return self;
	}

	if (route.isXML) {

		if (req.$type !== 2) {
			self.route400(new Error('The request validation (The content-type is not text/xml).'));
			return self;
		}

		try {
			req.body = utils.parseXML(req.buffer_data.trim());
			req.buffer_data = null;
			self.prepare(req.flags, req.uri.pathname);
		} catch (err) {
			F.error(err, null, req.uri);
			self.route500(err);
		}
		return self;
	}

	if (self.route.isRAW) {
		req.body = req.buffer_data;
		self.prepare(req.flags, req.uri.pathname);
		return self;
	}

	if (req.$type === 0) {
		self.route400(new Error('The request validation (The content-type is not x-www-form-urlencoded).'));
		return self;
	}

	if (req.$type === 1) {
		try {
			req.body = JSON.parse(req.buffer_data);
		} catch (e) {
			self.route400(new Error('Not valid JSON data.'));
			return self;
		}
	} else
		req.body = qs.parse(req.buffer_data);

	if (!route.schema) {
		self.prepare(req.flags, req.uri.pathname);
		return self;
	}

	framework.onSchema(req, route.schema[0], route.schema[1], function(err, body) {

		if (err) {
			self.route400(err);
			return self;
		}

		req.body = body;
		self.prepare(req.flags, req.uri.pathname);
	});

	return self;
};

Subscribe.prototype.route400 = function(problem) {
	var self = this;
	self.route = framework.lookup(self.req, '#400');
	self.exception = problem;
	self.execute(400);
	return self;
};

Subscribe.prototype.route500 = function(problem) {
	var self = this;
	self.route = framework.lookup(self.req, '#500');
	self.exception = problem;
	self.execute(500);
	return self;
};

Subscribe.prototype.doEndfile = function() {

	var self = this;
	var req = self.req;
	var res = self.res;

	if (!framework._length_files) {
		framework.responseStatic(self.req, self.res);
		return;
	}

	for (var i = 0; i < framework._length_files; i++) {
		var file = framework.routes.files[i];
		try {

			if (file.onValidation.call(framework, req, res, true)) {

				if (file.middleware === null)
					file.execute.call(framework, req, res, false);
				else
					self.doEndfile_middleware(file);

				return self;
			}

		} catch (err) {
			framework.error(err, file.controller + ' :: ' + file.name, req.uri);
			framework.responseContent(req, res, 500, '500 - internal server error', CONTENTTYPE_TEXTPLAIN, framework.config['allow-gzip']);
			return self;
		}
	}

	framework.responseStatic(self.req, self.res);
	return self;
};

/**
 * Executes a file middleware
 * @param {FileRoute} file
 * @return {Subscribe}
 */
Subscribe.prototype.doEndfile_middleware = function(file) {

	var length = file.middleware.length;
	var func = new Array(length);
	var self = this;
	var req = self.req;
	var res = self.res;
	var indexer = 0;

	for (var i = 0; i < length; i++) {

		var middleware = framework.routes.middleware[file.middleware[i]];
		if (!middleware)
			continue;

		(function(middleware) {
			func[indexer++] = function(next) {
				middleware.call(framework, req, res, next, file.options);
			};
		})(middleware);
	}

	func._async_middleware(res, function() {
		try {
			file.execute.call(framework, req, res, false);
		} catch (err) {
			framework.error(err, file.controller + ' :: ' + file.name, req.uri);
			framework.responseContent(req, res, 500, '500 - internal server error', CONTENTTYPE_TEXTPLAIN, framework.config['allow-gzip']);
			return self;
		}
	});

	return self;
};

/**
 * Parse data from CHUNK
 * @param {Buffer} chunk
 * @return {FrameworkSubscribe}
 */
Subscribe.prototype.doParsepost = function(chunk) {

	var self = this;
	var req = self.req;

	if (req.buffer_exceeded)
		return self;

	if (!req.buffer_exceeded)
		req.buffer_data = Buffer.concat([req.buffer_data, chunk]);

	if ((req.buffer_data.length / 1024) < self.route.length)
		return self;

	req.buffer_exceeded = true;
	req.buffer_data = new Buffer('');

	return self;
};

Subscribe.prototype.doCancel = function() {
	var self = this;

	framework.stats.response.timeout++;
	clearTimeout(self.timeout);
	self.timeout = null;

	if (self.controller === null)
		return;

	self.controller.isTimeout = true;
	self.controller.isCanceled = true;
	self.route = framework.lookup(self.req, '#408');
	self.execute(408);
};

// *********************************************************************************
// =================================================================================
// Framework.Controller
// =================================================================================
// *********************************************************************************

/**
 * FrameworkController
 * @class
 * @param {String} name Controller name.
 * @param {Request} req
 * @param {Response} res
 * @param {FrameworkSubscribe} subscribe
 */
function Controller(name, req, res, subscribe, currentView) {

	this.subscribe = subscribe;
	this.name = name;
	this.req = req;
	this.res = res;
	this.exception = null;

	// Sets the default language
	if (req)
		this.language = req.$language;

	// controller.type === 0 - classic
	// controller.type === 1 - server sent events
	this.type = 0;

	this.layoutName = framework.config['default-layout'];
	this.status = 200;

	this.isLayout = false;
	this.isCanceled = false;
	this.isConnected = true;
	this.isTimeout = false;
	this.isController = true;
	this.isTransfer = false;
	this.repository = {};

	// render output
	this.output = null;
	this.outputPartial = null;
	this.$model = null;

	this._currentImage = '';
	this._currentDownload = '';
	this._currentVideo = '';
	this._currentScript = '';
	this._currentStyle = '';
	this._currentView = currentView;

	if (!req)
		this.req = { uri: {}};

	if (!res)
		this.res = {};

	// Assign controller to Response
	this.res.controller = this;
}

Controller.prototype = {

	get sseID() {
		return this.req.headers['last-event-id'] || null;
	},

	get flags() {
		return this.subscribe.route.flags;
	},

	get path() {
		return framework.path;
	},

	get fs() {
		return framework.fs;
	},

	get get() {
		return this.req.query;
	},

	get query() {
		return this.req.query;
	},

	get post() {
		return this.req.body;
	},

	get body() {
		return this.req.body;
	},

	get files() {
		return this.req.files;
	},

	get subdomain() {
		return this.req.subdomain;
	},

	get ip() {
		return this.req.ip;
	},

	get xhr() {
		return this.req.xhr;
	},

	get url() {
		return utils.path(this.req.uri.pathname);
	},

	get uri() {
		return this.req.uri;
	},

	get cache() {
		return framework.cache;
	},

	get config() {
		return framework.config;
	},

	get controllers() {
		return framework.controllers;
	},

	get isProxy() {
		return this.req.isProxy;
	},

	get isDebug() {
		return framework.config.debug;
	},

	get isTest() {
		return this.req.headers['x-assertion-testing'] === '1';
	},

	get isSecure() {
		return this.req.isSecure;
	},

	get session() {
		return this.req.session;
	},

	set session(value) {
		this.req.session = value;
	},

	get user() {
		return this.req.user;
	},

	set user(value) {
		this.req.user = value;
	},

	get global() {
		return framework.global;
	},

	set global(value) {
		framework.global = value;
	},

	get async() {

		var self = this;

		if (typeof(self._async) === UNDEFINED)
			self._async = new utils.Async(self);

		return self._async;
	},

	get viewname() {
		var name = this.req.path[this.req.path.length - 1];
		if (name === '' || name === undefined || name === '/')
			name = 'index';
		return name;
	}
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

/**
 * Clear uploaded files
 * @return {Controller}
 */
Controller.prototype.clear = function() {
	var self = this;
	self.req.clear();
	return self;
};

/**
 * Translate text
 * @param {String} text
 * @return {String}
 */
Controller.prototype.translate = function(text) {
	return framework.translate(this.language, text);
};

/**
 * Exec middleware
 * @param {String Array} names Middleware name.
 * @param {Object} options Custom options for middleware.
 * @param {Function} callback
 * @return {Controller}
 */
Controller.prototype.middleware = function(names, options, callback) {

	if (typeof(names) === STRING)
		names = [names];

	if (typeof(options) === TYPE_FUNCTION) {
		var tmp = callback;
		callback = options;
		options = tmp;
	}

	if (options === undefined || options === null)
		options = {};

	var self = this;
	var length = names.length;
	var func = new Array(length);
	var indexer = 0;

	for (var i = 0; i < length; i++) {

		var middleware = framework.routes.middleware[names[i]];
		if (!middleware)
			continue;

		(function(middleware, options) {
			func[indexer++] = function(next) {
				middleware.call(framework, self.req, self.res, next, options);
			};
		})(middleware, options[names[i]] === undefined ? options : options[names[i]]);

	}

	func._async_middleware(self.res, callback, controller);
	return self;
};

/*
	Pipe URL response
	@url {String}
	@headers {Object} :: optional
	return {Controller}
*/
Controller.prototype.pipe = function(url, headers, callback) {

	var self = this;

	if (typeof(headers) === TYPE_FUNCTION) {
		var tmp = callback;
		callback = headers;
		headers = tmp;
	}

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	framework.responsePipe(self.req, self.res, url, headers, null, function() {
		self.subscribe.success();
		if (callback)
			callback();
	});

	return self;
};

/*
	Cryptography (encrypt)
	@value {String}
	@key {String}
	@isUniqe {Boolean} :: optional, default true
	return {String}
*/
Controller.prototype.encrypt = function() {
	return framework.encrypt.apply(framework, arguments);
};

/*
	Cryptography (decrypt)
	@value {String}
	@key {String}
	@jsonConvert {Boolean} :: optional (convert string to JSON)
	return {String or Object}
*/
Controller.prototype.decrypt = function() {
	return framework.decrypt.apply(framework, arguments);
};

/*
	Hash value
	@type {String} :: sha1, sha256, sha512, md5
	@value {Object}
	@salt {String or Boolean} :: custom salt {String} or secret as salt {undefined or Boolean}
	return {String}
*/
Controller.prototype.hash = function() {
	return framework.hash.apply(framework, arguments);
};

/**
 * Compare DateTime
 * @param {String} type Compare type ('<', '>', '=', '>=', '<=')
 * @param {String or Date} d1 String (yyyy-MM-dd [HH:mm:ss]), (optional) - default current date
 * @param {String or Date} d2 String (yyyy-MM-dd [HH:mm:ss])
 * @return {Boolean}
 */
Controller.prototype.date = function(type, d1, d2) {

	if (d2 === undefined) {
		d2 = d1;
		d1 = new Date();
	}

	var beg = typeof(d1) === STRING ? d1.parseDate() : d1;
	var end = typeof(d2) === STRING ? d2.parseDate() : d2;
	var r = beg.compare(end);

	switch (type) {
		case '>':
			return r === 1;
		case '>=':
		case '=>':
			return r === 1 || r === 0;
		case '<':
			return r === -1;
		case '<=':
		case '=<':
			return r === -1 || r === 0;
		case '=':
			return r === 0;
	}

	return true;

};

/**
 * Validate a model
 * @param {Object} model Model to validate.
 * @param {String Array} properties
 * @param {String} prefix Resource prefix.
 * @param {String} name Resource name.
 * @return {ErrorBuilder}
 */
Controller.prototype.validate = function(model, properties, prefix, name) {

	var self = this;

	var resource = function(key) {
		return self.resource(name || 'default', (prefix || '') + key);
	};

	if (typeof(properties) === STRING)
		return builders.validate(properties, model, prefix);

	var error = new builders.ErrorBuilder(resource);
	return utils.validate.call(self, model, properties, framework.onValidation, error);
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
	Get host name
	@path {String} :: optional
	return {String}
*/
Controller.prototype.host = function(path) {
	var self = this;
	return self.req.hostname(path);
};

Controller.prototype.hostname = function(path) {
	var self = this;
	return self.req.hostname(path);
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
	var isOPTIONS = self.req.method.toUpperCase() === 'OPTIONS';

	if (origin === undefined)
		return true;

	if (allow === undefined)
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
	var value;
	var headers = self.req.headers;

	if (header) {

		if (!utils.isArray(header))
			header = [header];

		for (var i = 0; i < header.length; i++) {
			if (headers[header[i].toLowerCase()]) {
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

		var current = headers['access-control-request-method'] || self.req.method;

		for (var i = 0; i < method.length; i++) {

			value = method[i].toUpperCase();
			method[i] = value;

			if (current.indexOf(value) !== -1)
				isAllowed = true;
		}

		if (!isAllowed)
			return false;

		isAllowed = false;
	}

	for (var i = 0; i < allow.length; i++) {

		value = allow[i];

		if (value === '*' || origin.indexOf(value) !== -1) {
			isAll = value === '*';
			isAllowed = true;
			break;
		}

	}

	if (!isAllowed)
		return false;

	var tmp;
	var name;

	self.res.setHeader('Access-Control-Allow-Origin', isAll ? '*' : origin);

	if (credentials)
		self.res.setHeader('Access-Control-Allow-Credentials', 'true');

	name = 'Access-Control-Allow-Methods';

	if (method) {
		self.res.setHeader(name, method.join(', '));
	} else if (isOPTIONS) {
		tmp = headers['access-control-request-method'];
		if (tmp)
			self.res.setHeader(name, tmp);
	}

	name = 'Access-Control-Allow-Headers';

	if (header) {
		self.res.setHeader(name, header.join(', '));
	} else if (isOPTIONS) {
		tmp = headers['access-control-request-headers'];
		if (tmp)
			self.res.setHeader(name, tmp);
	}

	return true;
};

/**
 * Error caller
 * @param {Error/String} err
 * @return {Controller/Function}
 */
Controller.prototype.error = function(err) {
	var self = this;
	var result = framework.error(typeof(err) === STRING ? new Error(err) : err, self.name, self.uri);

	if (err === undefined)
		return result;

	if (!self.subscribe)
		return self;

	self.subscribe.exception = err;
	self.exception = err;

	return self;
};

/*
	Problem
	@message {String}
	return {Framework}
*/
Controller.prototype.problem = function(message) {
	var self = this;
	framework.problem(message, self.name, self.uri, self.ip);
	return self;
};

/*
	Change
	@message {String}
	return {Framework}
*/
Controller.prototype.change = function(message) {
	var self = this;
	framework.change(message, self.name, self.uri, self.ip);
	return self;
};

/**
 * Transfer to new route
 * @param {String} url Relative URL.
 * @param {String Array} flags Route flags (optional).
 * @return {Boolean}
 */
Controller.prototype.transfer = function(url, flags) {

	var self = this;
	var length = framework.routes.web.length;
	var path = framework_internal.routeSplit(url.trim());

	var isSystem = url[0] === '#';
	var noFlag = flags === null || flags === undefined || flags.length === 0;
	var selected = null;

	self.req.$isAuthorized = true;

	for (var i = 0; i < length; i++) {

		var route = framework.routes.web[i];

		if (route.isASTERIX) {
			if (!framework_internal.routeCompare(path, route.url, isSystem, true))
				continue;
		} else {
			if (!framework_internal.routeCompare(path, route.url, isSystem))
				continue;
		}

		if (noFlag) {
			selected = route;
			break;
		}

		if (route.flags !== null && route.flags.length) {
			var result = framework_internal.routeCompareFlags(route.flags, flags, true);
			if (result === -1)
				self.req.$isAuthorized = false;
			if (result < 1)
				continue;
		}

		selected = route;
		break;
	}


	if (!selected)
		return false;

	self.cancel();
	self.req.path = new Array(0);
	self.subscribe.isTransfer = true;
	self.subscribe.success();
	self.subscribe.route = selected;
	self.subscribe.execute(404);

	return true;

};

/*
	Cancel execute controller function
	Note: you can cancel controller function execute in on('controller') or controller.request();

	return {Controller}
*/
Controller.prototype.cancel = function() {
	var self = this;

	if (typeof(self._async) !== UNDEFINED)
		self._async.cancel();

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
	framework.log.apply(framework, arguments);
	return self;
};

Controller.prototype.logger = function() {
	var self = this;
	framework.logger.apply(framework, arguments);
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
	self.repository[REPOSITORY_META_IMAGE] = arguments[3] || '';
	return self;
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.$dns = function(value) {

	var builder = '';
	var self = this;
	var length = arguments.length;

	for (var i = 0; i < length; i++)
		builder += '<link rel="dns-prefetch" href="' + self._prepareHost(arguments[i] || '') + '" />';

	self.head(builder);
	return '';
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.$prefetch = function() {

	var builder = '';
	var self = this;
	var length = arguments.length;

	for (var i = 0; i < length; i++)
		builder += '<link rel="prefetch" href="' + self._prepareHost(arguments[i] || '') + '" />';

	self.head(builder);
	return '';
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.$prerender = function(value) {

	var builder = '';
	var self = this;
	var length = arguments.length;

	for (var i = 0; i < length; i++)
		builder += '<link rel="prerender" href="' + self._prepareHost(arguments[i] || '') + '" />';

	self.head(builder);
	return '';
};

/*
	Internal function for views
	@value {String}
	return {String}
*/
Controller.prototype.$next = function(value) {
	var self = this;
	self.head('<link rel="next" href="' + self._prepareHost(value || '') + '" />');
	return '';
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.$prev = function(value) {
	var self = this;
	self.head('<link rel="prev" href="' + self._prepareHost(value || '') + '" />');
	return '';
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.$canonical = function(value) {
	var self = this;
	self.head('<link rel="canonical" href="' + self._prepareHost(value || '') + '" />');
	return '';
};

Controller.prototype.$meta = function() {
	var self = this;

	if (arguments.length !== 0) {
		self.meta.apply(self, arguments);
		return '';
	}

	framework.emit('controller-render-meta', self);
	var repository = self.repository;
	return framework.onMeta.call(self, repository[REPOSITORY_META_TITLE], repository[REPOSITORY_META_DESCRIPTION], repository[REPOSITORY_META_KEYWORDS], repository[REPOSITORY_META_IMAGE]);
};

Controller.prototype.title = function(value) {
	var self = this;
	self.$title(value);
	return self;
};

Controller.prototype.description = function(value) {
	var self = this;
	self.$description(value);
	return self;
};


Controller.prototype.keywords = function(value) {
	var self = this;
	self.$keywords(value);
	return self;
};

Controller.prototype.$title = function(value) {
	var self = this;

	if (!value)
		return self.repository[REPOSITORY_META_TITLE] || '';

	self.repository[REPOSITORY_META_TITLE] = value;
	return '';
};

Controller.prototype.$description = function(value) {
	var self = this;

	if (!value)
		return self.repository[REPOSITORY_META_DESCRIPTION] || '';

	self.repository[REPOSITORY_META_DESCRIPTION] = value;
	return '';
};

Controller.prototype.$keywords = function(value) {
	var self = this;

	if (!value)
		return self.repository[REPOSITORY_META_KEYWORDS] || '';

	self.repository[REPOSITORY_META_KEYWORDS] = value;
	return '';
};

Controller.prototype.sitemap = function(name, url, index) {
	var self = this;
	var sitemap;

	if (name instanceof Array) {
		self.repository[REPOSITORY_SITEMAP] = name;
		return self;
	}

	if (!name) {
		sitemap = self.repository[REPOSITORY_SITEMAP];
		if (sitemap)
			return sitemap;
		return self.repository.sitemap || [];
	}

	if (name[0] === '#') {
		name = name.substring(1);
		sitemap = framework.sitemap(name, false, self.language);
		self.repository[REPOSITORY_SITEMAP] = sitemap;
		if (!self.repository[REPOSITORY_META_TITLE]) {
			sitemap = sitemap.last();
			if (sitemap)
				self.repository[REPOSITORY_META_TITLE] = sitemap.name;
		}
		return self;
	}

	if (!url)
		return self.repository[REPOSITORY_SITEMAP];

	console.log('OBSOLETE sitemap: The newest version supports new sitemap mechanism.');

	if (self.repository.sitemap === undefined)
		self.repository.sitemap = [];

	self.repository.sitemap.push({
		name: name,
		url: url,
		index: index || self.repository.sitemap.length
	});

	if (index !== undefined && self.sitemap.length > 1) {
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

Controller.prototype.$sitemap = function(name, url, index) {
	var self = this;
	self.sitemap.apply(self, arguments);
	return '';
};

/*
	Module caller
	@name {String}
	return {Module};
*/
Controller.prototype.module = function(name) {
	return framework.module(name);
};

/*
	Layout setter
	@name {String} :: layout filename
	return {Controller};
*/
Controller.prototype.layout = function(name) {
	var self = this;
	self.layoutName = name;
	return self;
};

/*
	Layout setter
	@name {String} :: layout filename
	return {Controller};
*/
Controller.prototype.$layout = function(name) {
	var self = this;
	self.layoutName = name;
	return '';
};

/*
	Get a model
	@name {String} :: name of controller
	return {Object};
*/
Controller.prototype.model = function(name) {
	return framework.model(name);
};

/*
	Controller models reader
	@name {String} :: name of controller
	return {Object};
*/
Controller.prototype.models = function(name) {
	var self = this;
	return (self.controllers[name || self.name] || {}).models;
};

/**
 * Send e-mail
 * @param {String or Array} address E-mail address.
 * @param {String} subject E-mail subject.
 * @param {String} view View name.
 * @param {Object} model Optional.
 * @param {Function(err)} callback Optional.
 * @return {MailMessage}
 */
Controller.prototype.mail = function(address, subject, view, model, callback, language) {

	if (typeof(model) === TYPE_FUNCTION) {
		callback = model;
		model = null;
	}

	var self = this;
	var body = self.view(view, model, true);

	return framework.onMail(address, subject, body, callback, language);
};

/*
	Controller functions reader
	@name {String} :: name of controller
	return {Object};
*/
Controller.prototype.functions = function(name) {
	var self = this;
	return (self.controllers[name || self.name] || {}).functions;
};

/*
	Check if ETag or Last Modified has modified
	@compare {String or Date}
	@strict {Boolean} :: if strict then use equal date else use great than date (default: false)

	if @compare === {String} compare if-none-match
	if @compare === {Date} compare if-modified-since

	return {Boolean};
*/
Controller.prototype.notModified = function(compare, strict) {
	var self = this;
	return framework.notModified(self.req, self.res, compare, strict);
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
	framework.setModified(self.req, self.res, value);
	return self;
};

/*
	Set Expires header
	@date {Date}

	return {Controller};
*/
Controller.prototype.setExpires = function(date) {
	var self = this;

	if (date === undefined)
		return self;

	self.res.setHeader('Expires', date.toUTCString());
	return self;
};

/**
 * INTERNAL: Render view in view
 * @private
 * @param {String} name
 * @param {Object} model Custom model, optional.
 * @return {String}
 */
Controller.prototype.$template = function(name, model, expire, key) {
	return this.$viewToggle(true, name, model, expire, key);
};

/**
 * INTERNAL: Render view in view
 * @private
 * @param {Boolean} visible
 * @param {String} name
 * @param {Object} model Custom model, optional.
 * @return {String}
 */
Controller.prototype.$templateToggle = function(visible, name, model, expire, key) {
	return this.$viewToggle(visible, name, model, expire, key);
};

/**
 * INTERNAL: Render view in view
 * @private
 * @param {String} name
 * @param {Object} model Custom model, optional.
 * @return {String}
 */
Controller.prototype.$view = function(name, model, expire, key) {
	return this.$viewToggle(true, name, model, expire, key);
};

/**
 * INTERNAL: Render view in view
 * @private
 * @param {Boolean} visible
 * @param {String} name
 * @param {Object} model Custom model, optional.
 * @return {String}
 */
Controller.prototype.$viewToggle = function(visible, name, model, expire, key) {

	if (!visible)
		return '';

	var self = this;
	var cache;

	if (expire) {
		cache = '$view.' + name + '.' + (key || '');
		var output = self.cache.read(cache);
		if (output)
			return output;
	}

	var layout = self.layoutName;

	self.layoutName = '';
	var value = self.view(name, model, null, true);
	self.layoutName = layout;

	if (value === null)
		return '';

	if (expire)
		self.cache.add(cache, value, expire);

	return value;
};

Controller.prototype.place = function(name) {

	var self = this;

	var key = REPOSITORY_PLACE + '_' + name;
	var length = arguments.length;

	if (length === 1)
		return self.repository[key] || '';

	var output = '';
	for (var i = 1; i < length; i++) {
		var val = arguments[i];
		if (val === null || typeof(val) === undefined)
			val = '';
		else
			val = val.toString();
		output += val;
	}

	self.repository[key] = (self.repository[key] || '') + output;
	return self;
};

Controller.prototype.section = function(name, value, replace) {

	var self = this;
	var key = '$section_' + name;

	if (value === undefined)
		return self.repository[key];

	if (replace) {
		self.repository[key] = value;
		return self;
	}

	if (!self.repository[key])
		self.repository[key] = value;
	else
		self.repository[key] += value;

	return self;
};

Controller.prototype.$place = function() {
	var self = this;
	if (arguments.length === 1)
		return self.place.apply(self, arguments);
	self.place.apply(self, arguments);
	return '';
};

Controller.prototype.$url = function(host) {
	var self = this;
	return host ? self.req.hostname(self.url) : self.url;
};

Controller.prototype.$helper = function(name) {
	var self = this;
	return self.helper.apply(self, arguments);
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

/**
 * Fake function for assign value
 * @private
 * @param {Object} value Value to eval.
 * return {String} Returns empty string.
 */
Controller.prototype.$set = function(value) {
	return '';
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
		attr = {
			label: attr
		};

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
		attr = {
			label: attr
		};

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

	for (var key in attr) {
		switch (key) {
			case 'name':
			case 'id':
				break;
			case 'required':
			case 'disabled':
			case 'readonly':
			case 'value':
				builder += ' ' + key + '="' + key + ATTR_END;
				break;
			default:
				builder += ' ' + key + '="' + attr[key].toString().encode() + ATTR_END;
				break;
		}
	}

	if (model === undefined)
		return builder + '></textarea>';

	var value = (model[name] || attr.value) || '';
	return builder + '>' + value.toString().encode() + '</textarea>';
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

	if (attr.autocomplete) {
		if (attr.autocomplete === true || attr.autocomplete === 'on')
			builder += ' autocomplete="on"';
		else
			builder += ' autocomplete="off"';
	}

	for (var key in attr) {
		switch (key) {
			case 'name':
			case 'id':
			case 'type':
			case 'autocomplete':
			case 'checked':
			case 'value':
			case 'label':
				break;
			case 'required':
			case 'disabled':
			case 'readonly':
			case 'autofocus':
				builder += ' ' + key + '="' + key + ATTR_END;
				break;
			default:
				builder += ' ' + key + '="' + attr[key].toString().encode() + ATTR_END;
				break;
		}
	}

	var value = '';

	if (model !== undefined) {
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

	if (value !== undefined)
		builder += ' value="' + (value || '').toString().encode() + ATTR_END;
	else
		builder += ' value="' + (attr.value || '').toString().encode() + ATTR_END;

	builder += ' />';

	if (attr.label)
		return '<label>' + builder + ' <span>' + attr.label + '</span></label>';

	return builder;
};

Controller.prototype._prepareHost = function(value) {
	var tmp = value.substring(0, 5);

	if (tmp !== 'http:' && tmp !== 'https://') {
		if (tmp[0] !== '/' || tmp[1] !== '/')
			value = this.host(value);
	}

	return value;
};

/*
	Internal function for views
	@arguments {String}
	return {String}
*/
Controller.prototype.head = function() {

	var self = this;

	var length = arguments.length;

	if (length === 0) {
		framework.emit('controller-render-head', self);
		return (self.config.author ? '<meta name="author" content="' + self.config.author + '" />' : '') + (self.repository[REPOSITORY_HEAD] || '');
	}

	var header = (self.repository[REPOSITORY_HEAD] || '');

	var output = '';
	for (var i = 0; i < length; i++) {

		var val = arguments[i];
		if (val.indexOf('<') !== -1) {
			output += val;
			continue;
		}

		var tmp = val.substring(0, 7);
		var isRoute = (tmp[0] !== '/' && tmp[1] !== '/') && tmp !== 'http://' && tmp !== 'https:/';

		if (val.endsWith('.css', true))
			output += '<link type="text/css" rel="stylesheet" href="' + (isRoute ? self.routeStyle(val) : val) + '" />';
		else if (val.endsWith(EXTENSION_JS, true) !== -1)
			output += '<script type="text/javascript" src="' + (isRoute ? self.routeScript(val) : val) + '"></script>';
	}

	header += output;
	self.repository[REPOSITORY_HEAD] = header;
	return self;
};

Controller.prototype.$head = function() {
	var self = this;
	self.head.apply(self, arguments);
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

		date = d[0].split('-');
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

	if (date === undefined)
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

	var type = typeof(arr);
	if (arr === null || arr === undefined)
		return '';

	var isObject = false;
	var tmp = null;

	if (!(arr instanceof Array) && type === OBJECT) {
		isObject = true;
		tmp = arr;
		arr = Object.keys(arr);
	}

	if (!utils.isArray(arr))
		arr = [arr];

	selected = selected || '';

	var options = '';

	if (!isObject) {
		if (value === undefined)
			value = value || name || 'value';

		if (name === undefined)
			name = name || 'name';
	}

	var isSelected = false;
	var length = 0;

	length = arr.length;

	for (var i = 0; i < length; i++) {

		var o = arr[i];
		var type = typeof(o);
		var text = '';
		var val = '';
		var sel = false;

		if (isObject) {
			if (name === true) {
				val = tmp[o];
				text = o;
				if (value === null)
					value = '';
			} else {
				val = o;
				text = tmp[o];
				if (text === null)
					text = '';
			}

		} else if (type === OBJECT) {

			text = (o[name] || '');
			val = (o[value] || '');

			if (typeof(text) === TYPE_FUNCTION)
				text = text(i);

			if (typeof(val) === TYPE_FUNCTION)
				val = val(i, text);

		} else {
			text = o;
			val = o;
		}

		if (!isSelected) {
			sel = val == selected;
			isSelected = sel;
		}

		options += '<option value="' + val.toString().encode() + '"' + (sel ? ' selected="selected"' : '') + '>' + text.toString().encode() + '</option>';
	}

	return options;
};

/**
 * Append <script> TAG
 * @private
 * @return {String}
 */
Controller.prototype.$script = function() {
	var self = this;
	return self.$js.apply(self, arguments);
};

/**
 * Append <script> TAG
 * @private
 * @return {String}
 */
Controller.prototype.$js = function() {

	var self = this;
	var builder = '';

	for (var i = 0; i < arguments.length; i++)
		builder += self.routeScript(arguments[i], true);

	return builder;
};

Controller.prototype.$import = function() {

	var self = this;
	var builder = '';

	for (var i = 0; i < arguments.length; i++) {
		var filename = arguments[i];
		var extension = filename.substring(filename.lastIndexOf('.'));

		switch (extension) {
			case '.js':
				builder += self.routeScript(filename, true);
				break;
			case '.css':
				builder += self.routeStyle(filename, true);
				break;
			case '.ico':
				builder += self.$favicon(filename);
				break;
			case '.jpg':
			case '.gif':
			case '.png':
			case '.jpeg':
				builder += self.routeImage(filename, true);
				break;
		}
	}

	return builder;
};

/**
 * Append <link> TAG
 * @private
 * @return {String}
 */
Controller.prototype.$css = function() {

	var self = this;
	var builder = '';

	for (var i = 0; i < arguments.length; i++)
		builder += self.routeStyle(arguments[i], true);

	return builder;
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
		builder += ' alt="' + alt.encode() + ATTR_END;

	if (className)
		builder += ' class="' + className + ATTR_END;

	if (style)
		builder += ' style="' + style + ATTR_END;

	return builder + ' border="0" />';
};

/**
 * Create URL: DOWNLOAD (<a href="..." download="...")
 * @private
 * @param {String} filename
 * @param {String} innerHTML
 * @param {String} downloadName Optional.
 * @param {String} className Optional.
 * @return {String}
 */
Controller.prototype.$download = function(filename, innerHTML, downloadName, className) {
	var builder = '<a href="' + framework.routeDownload(filename) + ATTR_END;

	if (downloadName)
		builder += ' download="' + downloadName + ATTR_END;

	if (className)
		builder += ' class="' + className + ATTR_END;

	return builder + '>' + (innerHTML || filename) + '</a>';
};

/**
 * Serialize object into the JSON
 * @private
 * @param {Object} obj
 * @param {String} id Optional.
 * @param {Boolean} beautify Optional.
 * @return {String}
 */
Controller.prototype.$json = function(obj, id, beautify) {

	if (typeof(id) === BOOLEAN) {
		var tmp = id;
		id = beautify;
		beautify = tmp;
	}

	var value = beautify ? JSON.stringify(obj, null, 4) : JSON.stringify(obj);

	if (!id)
		return value;

	return '<script type="application/json" id="' + id + '">' + value + '</script>';
};

/**
 * Append FAVICON tag
 * @private
 * @param {String} name
 * @return {String}
 */
Controller.prototype.$favicon = function(name) {

	var contentType = 'image/x-icon';

	if (name === undefined)
		name = 'favicon.ico';

	var key = 'favicon#' + name;
	if (framework.temporary.other[key])
		return framework.temporary.other[key];

	if (name.lastIndexOf('.png') !== -1)
		contentType = 'image/png';
	else if (name.lastIndexOf('.gif') !== -1)
		contentType = 'image/gif';

	name = framework.routeStatic('/' + name);
	return framework.temporary.other[key] = '<link rel="shortcut icon" href="' + name + '" type="' + contentType + '" />';

};

/**
 * Route static file helper
 * @private
 * @param {String} current
 * @param {String} name
 * @param {Function} fn
 * @return {String}
 */
Controller.prototype._routeHelper = function(current, name, fn) {
	if (!current)
		return fn.call(framework, name);
	if (current.substring(0, 2) === '//' || current.substring(0, 6) === 'http:/' || current.substring(0, 7) === 'https:/')
		return fn.call(framework, current + name);
	if (current[0] === '~')
		return fn.call(framework, utils.path(current.substring(1)) + name);
	return fn.call(framework, utils.path(current) + name);
};

/**
 * Create URL: JavaScript
 * @alias
 * @param {String} name
 * @param {Boolean} tag Append tag?
 * @return {String}
 */
Controller.prototype.routeJS = function(name, tag) {
	console.log('OBSOLETE controller.routeJS(): use controller.routeScript()');
	return this.routeScript(name, tag);
};

/**
 * Create URL: JavaScript
 * @param {String} name
 * @param {Boolean} tag Append tag?
 * @return {String}
 */
Controller.prototype.routeScript = function(name, tag) {
	var self = this;
	if (name === undefined)
		name = 'default.js';
	var url = self._routeHelper(self._currentScript, name, framework.routeScript);
	return tag ? '<script type="text/javascript" src="' + url + '"></script>' : url;
};

/**
 * Create URL: CSS
 * @param {String} name
 * @param {Boolean} tag Append tag?
 * @return {String}
 */
Controller.prototype.routeCSS = function(name, tag) {
	console.log('OBSOLETE controller.routeCSS(): use controller.routeStyle()');
	return this.routeStyle(name, tag);
};

/**
 * Create URL: CSS
 * @param {String} name
 * @param {Boolean} tag Append tag?
 * @return {String}
 */
Controller.prototype.routeStyle = function(name, tag) {
	var self = this;

	if (name === undefined)
		name = 'default.css';

	var url = self._routeHelper(self._currentStyle, name, framework.routeStyle);
	return tag ? '<link type="text/css" rel="stylesheet" href="' + url + '" />' : url;
};

/**
 * Create URL: IMG
 * @param {String} name
 * @return {String}
 */
Controller.prototype.routeImage = function(name) {
	var self = this;
	return self._routeHelper(self._currentImage, name, framework.routeImage);
};

/**
 * Create URL: VIDEO
 * @param {String} name
 * @return {String}
 */
Controller.prototype.routeVideo = function(name) {
	var self = this;
	return self._routeHelper(self._currentVideo, name, framework.routeVideo);
};

/**
 * Create URL: FONT
 * @param {String} name
 * @return {String}
 */
Controller.prototype.routeFont = function(name) {
	return framework.routeFont(name);
};

/**
 * Create URL: DOWNLOAD
 * @param {String} name
 * @return {String}
 */
Controller.prototype.routeDownload = function(name) {
	var self = this;
	return self._routeHelper(self._currentDownload, name, framework.routeDownload);
};

/**
 * Create URL: static files (by the config['static-url'])
 * @param {String} name
 * @return {String}
 */
Controller.prototype.routeStatic = function(name) {
	return framework.routeStatic(name);
};

/**
 * Set current "script" path
 * @alias
 * @param {String} path
 * @return {String}
 */
Controller.prototype.$currentJS = function(path) {
	return this.$currentScript(path);
};

/**
 * Set current "script" path
 * @param {String} path
 * @return {String}
 */
Controller.prototype.$currentScript = function(path) {
	this._currentScript = path ? path : '';
	return '';
};

/**
 * Set current "view" path
 * @param {String} path
 * @return {String}
 */
Controller.prototype.$currentView = function(path) {
	var self = this;

	if (path === undefined) {
		self._currentView = self.name[0] !== '#' && self.name !== 'default' ? '/' + self.name + '/' : '';
		return self;
	}

	self._currentView = path ? utils.path(path) : '';
	return '';
};

/**
 * Set current "view" path
 * @param {String} path
 * @return {FrameworkController}
 */
Controller.prototype.currentView = function(path) {
	var self = this;
	self.$currentView(path);
	self._defaultView = self._currentView;
	return self;
};

/**
 * Set current "style" path
 * @alias
 * @param {String} path
 * @return {String}
 */
Controller.prototype.$currentCSS = function(path) {
	return this.$currentStyle(path);
};

/**
 * Set current "style" path
 * @param {String} path
 * @return {String}
 */
Controller.prototype.$currentStyle = function(path) {
	this._currentStyle = path ? path : '';
	return '';
};

/**
 * Set current "image" path
 * @param {String} path
 * @return {String}
 */
Controller.prototype.$currentImage = function(path) {
	this._currentImage = path ? path : '';
	return '';
};

/**
 * Set current "video" path
 * @param {String} path
 * @return {String}
 */
Controller.prototype.$currentVideo = function(path) {
	this._currentVideo = path ? path : '';
	return '';
};

/**
 * Set current "download" path
 * @param {String} path
 * @return {String}
 */
Controller.prototype.$currentDownload = function(path) {
	this._currentDownload = path ? path : '';
	return '';
};

/**
 * Set current "image" path
 * @param {String} path
 * @return {FrameworkController}
 */
Controller.prototype.currentImage = function(path) {
	var self = this;
	self.$currentImage(path);
	self._defaultImage = self._currentImage;
	return self;
};

/**
 * Set current "download" path
 * @param {String} path
 * @return {FrameworkController}
 */
Controller.prototype.currentDownload = function(path) {
	var self = this;
	self.$currentDownload(path);
	self._defaultDownload = self._currentDownload;
	return self;
};

/**
 * Set current "style" path
 * @alias
 * @param {String} path
 * @return {String}
 */
Controller.prototype.currentCSS = function(path) {
	return this.currentStyle(path);
};

/**
 * Set current "style" path
 * @param {String} path
 * @return {FrameworkController}
 */
Controller.prototype.currentStyle = function(path) {
	var self = this;
	self.$currentStyle(path);
	self._defaultStyle = self._currentStyle;
	return self;
};

/**
 * Set current "script" path
 * @alias
 * @param {String} path
 * @return {FrameworkController}
 */
Controller.prototype.currentJS = function(path) {
	return this.currentScript(path);
};

/**
 * Set current "script" path
 * @param {String} path
 * @return {FrameworkController}
 */
Controller.prototype.currentScript = function(path) {
	var self = this;
	self.$currentScript(path);
	self._defaultScript = self._currentScript;
	return self;
};

/**
 * Set current "video" path
 * @param {String} path
 * @return {FrameworkController}
 */
Controller.prototype.currentVideo = function(path) {
	var self = this;
	self.$currentVideo(path);
	self._defaultVideo = self._currentVideo;
	return self;
};

/**
 * Read resource
 * @param {String} name Optional, resource file name. Default: "default".
 * @param {String} key
 * @return {String}
 */
Controller.prototype.resource = function(name, key) {
	return framework.resource(name, key);
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
Controller.prototype.template = function(name, model) {
	return this.view(name, model, true);
};

/*
	Render component to string
	@name {String}
	return {String}
*/
Controller.prototype.helper = function(name) {
	var self = this;
	var helper = framework.helpers[name] || null;

	if (helper === null)
		return '';

	var length = arguments.length;
	var params = [];

	for (var i = 1; i < length; i++)
		params.push(arguments[i]);

	return helper.apply(self, params);
};

/**
 * Response JSON
 * @param {Object} obj
 * @param {Object} headers Custom headers, optional.
 * @param {Boolean} beautify Beautify JSON.
 * @param {Function(key, value)} replacer JSON replacer.
 * @return {Controller}
 */
Controller.prototype.json = function(obj, headers, beautify, replacer) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	// Checks the HEAD method
	if (self.req.method === 'HEAD') {
		self.subscribe.success();
		framework.responseContent(self.req, self.res, self.status, '', 'application/json', self.config['allow-gzip'], headers);
		framework.stats.response.json++;
		return self;
	}

	if (typeof(headers) === BOOLEAN) {
		replacer = beautify;
		beautify = headers;
	}

	if (obj instanceof builders.ErrorBuilder) {
		if (self.language && !obj.isResourceCustom)
			obj.resource(self.language);
		obj = obj.json(beautify);
	} else {
		if (beautify)
			obj = JSON.stringify(obj, replacer, 4);
		else
			obj = JSON.stringify(obj, replacer);
	}

	self.subscribe.success();
	framework.responseContent(self.req, self.res, self.status, obj, 'application/json', self.config['allow-gzip'], headers);
	framework.stats.response.json++;

	if (self.precache)
		self.precache(obj, 'application/json', headers);

	return self;
};

Controller.prototype.jsonp = function(name, obj, headers, beautify, replacer) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	// Checks the HEAD method
	if (self.req.method === 'HEAD') {
		self.subscribe.success();
		framework.responseContent(self.req, self.res, self.status, '', 'application/x-javascript', self.config['allow-gzip'], headers);
		framework.stats.response.json++;
		return self;
	}

	if (typeof(headers) === BOOLEAN) {
		replacer = beautify;
		beautify = headers;
	}

	if (!name)
		name = 'callback';

	if (obj instanceof builders.ErrorBuilder) {
		if (self.language && !obj.isResourceCustom)
			obj.resource(self.language);
		obj = obj.json(beautify);
	} else {
		if (beautify)
			obj = JSON.stringify(obj, replacer, 4);
		else
			obj = JSON.stringify(obj, replacer);
	}

	self.subscribe.success();
	framework.responseContent(self.req, self.res, self.status, name + '(' + obj + ')', 'application/x-javascript', self.config['allow-gzip'], headers);
	framework.stats.response.json++;

	if (self.precache)
		self.precache(name + '(' + obj + ')', 'application/x-javascript', headers);

	return self;
};

/**
 * Create View or JSON callback
 * @param {String} viewName Optional, if is undefined or null then returns JSON.
 * @return {Function}
 */
Controller.prototype.callback = function(viewName) {
	var self = this;
	return function(err, data) {

		// NoSQL embedded database
		if (data === undefined && !util.isError(err) && (!(err instanceof Builders.ErrorBuilder))) {
			data = err;
			err = null;
		}

		if (err) {
			if (err instanceof Builders.ErrorBuilder && !viewName) {
				if (self.language)
					err.resource(self.language);
				return self.content(err.transform(), err.contentType);
			}
			return self.view500(err);
		}

		if (typeof(viewName) === STRING)
			return self.view(viewName, data);

		self.json(data);
	};
};

/**
 * Set custom response
 * @return {Controller}
 */
Controller.prototype.custom = function() {

	var self = this;

	self.subscribe.success();

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return false;

	framework.responseCustom(self.req, self.res);
	return true;

};

/*
	Manul clear request data
	@enable {Boolean} :: enable manual clear - controller.clear()
	return {Controller}
*/
Controller.prototype.noClear = function(enable) {
	var self = this;
	self.req._manual = enable === undefined ? true : enable;
	return self;
};

/**
 * Response a custom content
 * @param {String} contentBody
 * @param {String} contentType
 * @param {Object} headers Custom headers, optional.
 * @return {Controller}
 */
Controller.prototype.content = function(contentBody, contentType, headers) {

	var self = this;
	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	if (contentBody instanceof ErrorBuilder) {
		var tmp = contentBody.transform();
		if (!contentType)
			contentType = contentBody.contentType;
		contentBody = tmp;
	}

	self.subscribe.success();
	framework.responseContent(self.req, self.res, self.status, contentBody, contentType || CONTENTTYPE_TEXTPLAIN, self.config['allow-gzip'], headers);
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

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	// Checks the HEAD method
	if (self.req.method === 'HEAD') {
		self.subscribe.success();
		framework.responseContent(self.req, self.res, self.status, '', CONTENTTYPE_TEXTPLAIN, self.config['allow-gzip'], headers);
		framework.stats.response.plain++;
		return self;
	}

	var type = typeof(contentBody);

	if (contentBody === undefined)
		contentBody = '';
	else if (type === OBJECT)
		contentBody = contentBody === null ? '' : JSON.stringify(contentBody, null, 4);
	else
		contentBody = contentBody === null ? '' : contentBody.toString();

	self.subscribe.success();
	framework.responseContent(self.req, self.res, self.status, contentBody, CONTENTTYPE_TEXTPLAIN, self.config['allow-gzip'], headers);
	framework.stats.response.plain++;

	if (self.precache)
		self.precache(contentBody, CONTENTTYPE_TEXTPLAIN, headers);

	return self;
};

/*
	Response empty content
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.empty = function(headers) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	var code = 200;

	if (typeof(headers) === NUMBER) {
		code = headers;
		headers = null;
	}

	self.subscribe.success();
	framework.responseContent(self.req, self.res, code, '', CONTENTTYPE_TEXTPLAIN, false, headers);
	framework.stats.response.empty++;

	return self;
};

Controller.prototype.destroy = function(problem) {
	var self = this;

	if (problem)
		self.problem(problem);

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	self.subscribe.success();
	self.req.connection.destroy();
	framework.stats.response.destroy++;

	return self;
};

/**
 * Responses file
 * @param {String} filename
 * @param {String} download Optional, a download name.
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optinoal, callback.
 * @return {Controller}
 */
Controller.prototype.file = function(filename, download, headers, done) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected) {
		if (done)
			done();
		return self;
	}

	if (filename[0] === '~')
		filename = filename.substring(1);
	else
		filename = framework.path.public(filename);

	self.subscribe.success();
	framework.responseFile(self.req, self.res, filename, download, headers, done);
	return self;
};

/**
 * Responses image
 * @param {String or Stream} filename
 * @param {Function(image)} fnProcess
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optional, callback.
 * @return {Controller}
 */
Controller.prototype.image = function(filename, fnProcess, headers, done) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected) {
		if (done)
			done();
		return self;
	}

	if (typeof(filename) === STRING) {
		if (filename[0] === '~')
			filename = filename.substring(1);
		else
			filename = framework.path.public(filename);
	}

	self.subscribe.success();
	framework.responseImage(self.req, self.res, filename, fnProcess, headers, done);
	return self;
};

/**
 * Responses stream
 * @param {String} contentType
 * @param {Stream} stream
 * @param {String} download Optional, a download name.
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optinoal, callback.
 * @return {Controller}
 */
Controller.prototype.stream = function(contentType, stream, download, headers, done, nocompress) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected) {
		if (done)
			done();
		return self;
	}

	self.subscribe.success();
	framework.responseStream(self.req, self.res, contentType, stream, download, headers, done, nocompress);
	return self;
};

/**
 * Throw 401 - Bad request.
 * @param  {String} problem Description of problem (optional)
 * @return {FrameworkController}
 */
Controller.prototype.throw400 = function(problem) {
	return this.view400(problem);
};

/*
	Response 400
	return {Controller};
*/
Controller.prototype.view400 = function(problem) {
	var self = this;

	if (problem && !problem.items)
		self.problem(problem);

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	self.req.path = new Array(0);
	self.subscribe.success();
	self.subscribe.route = framework.lookup(self.req, '#400');
	self.subscribe.exception = problem;
	self.subscribe.execute(400);
	return self;
};

/**
 * Throw 401 - Unauthorized.
 * @param  {String} problem Description of problem (optional)
 * @return {FrameworkController}
 */
Controller.prototype.throw401 = function(problem) {
	return this.view401(problem);
};

/*
	Response 401
	return {Controller};
*/
Controller.prototype.view401 = function(problem) {
	var self = this;

	if (problem)
		self.problem(problem);

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	self.req.path = new Array(0);
	self.subscribe.success();
	self.subscribe.route = framework.lookup(self.req, '#401');
	self.subscribe.exception = problem;
	self.subscribe.execute(401);
	return self;
};

/**
 * Throw 403 - Forbidden.
 * @param  {String} problem Description of problem (optional)
 * @return {FrameworkController}
 */
Controller.prototype.throw403 = function(problem) {
	return this.view403(problem);
};

/*
	Response 403
	return {Controller};
*/
Controller.prototype.view403 = function(problem) {
	var self = this;

	if (problem)
		self.problem(problem);

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	self.req.path = new Array(0);
	self.subscribe.success();
	self.subscribe.route = framework.lookup(self.req, '#403');
	self.subscribe.exception = problem;
	self.subscribe.execute(403);
	return self;
};

/**
 * Throw 404 - Not found.
 * @param  {String} problem Description of problem (optional)
 * @return {FrameworkController}
 */
Controller.prototype.throw404 = function(problem) {
	return this.view404(problem);
};
/*
	Response 404
	return {Controller};
*/
Controller.prototype.view404 = function(problem) {
	var self = this;

	if (problem)
		self.problem(problem);

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	self.req.path = new Array(0);
	self.subscribe.success();
	self.subscribe.route = framework.lookup(self.req, '#404');
	self.subscribe.exception = problem;
	self.subscribe.execute(404);
	return self;
};

/*
	Response 500
	@error {String}
	return {Controller};
*/
Controller.prototype.view500 = function(error) {
	var self = this;

	framework.error(typeof(error) === STRING ? new Error(error) : error, self.name, self.req.uri);

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	self.req.path = new Array(0);
	self.subscribe.exception = error;
	self.subscribe.success();
	self.subscribe.route = framework.lookup(self.req, '#500');
	self.subscribe.exception = error;
	self.subscribe.execute(500);
	return self;
};

/**
 * Throw 500 - Internal Server Error
 * @param  {Error} error
 * @return {FrameworkController}
 */
Controller.prototype.throw500 = function(error) {
	return this.view500(error);
};

/**
 * Throw 501 - Not implemented
 * @param  {String} problem Description of the problem (optional)
 * @return {FrameworkController}
 */
Controller.prototype.view501 = function(problem) {
	var self = this;

	if (problem)
		self.problem(problem);

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	self.req.path = new Array(0);
	self.subscribe.success();
	self.subscribe.route = framework.lookup(self.req, '#501');
	self.subscribe.exception = problem;
	self.subscribe.execute(501);
	return self;
};

/**
 * Throw 501 - Not implemented
 * @param  {String} problem Description of the problem (optional)
 * @return {FrameworkController}
 */
Controller.prototype.throw501 = function(problem) {
	return this.view501(problem);
};

/*
	Response redirect
	@url {String}
	@permanent {Boolean} :: optional default false
	return {Controller};
*/
Controller.prototype.redirect = function(url, permanent) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	self.subscribe.success();
	self.req.clear(true);
	self.res.success = true;
	self.res.writeHead(permanent ? 301 : 302, { 'Location': url });
	self.res.end();
	framework._request_stats(false, false);
	framework.emit('request-end', self.req, self.res);
	framework.stats.response.redirect++;

	return self;
};

/**
 * A binary response
 * @param {Buffer} buffer
 * @param {String} contentType
 * @param {String} type Transformation type: `binary`, `utf8`, `ascii`.
 * @param {String} download Optional, download name.
 * @param {Object} headers Optional, additional headers.
 * @return {FrameworkController}
 */
Controller.prototype.binary = function(buffer, contentType, type, download, headers) {
	var self = this;
	var res = self.res;
	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	if (typeof(type) === OBJECT) {
		var tmp = type;
		type = download;
		download = headers;
		headers = tmp;
	}

	if (typeof(download) === OBJECT) {
		headers = download;
		download = headers;
	}

	self.subscribe.success();
	framework.responseBinary(self.req, res, contentType, buffer, type, download, headers);
	return self;
};

/**
 * Basic access authentication (baa)
 * @param {String} label
 * @return {Object}
 */
Controller.prototype.baa = function(label) {

	var self = this;

	if (label === undefined)
		return self.req.authorization();

	framework.responseContent(self.req, self.res, 401, '401: NOT AUTHORIZED', CONTENTTYPE_TEXTPLAIN, false, { 'WWW-Authenticate': 'Basic realm="' + (label || 'Administration') + '"'});
	self.subscribe.success();
	self.cancel();
	return null;
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

	if (self.type === 0 && res.success)
		throw new Error('Response was sent.');

	if (self.type > 0 && self.type !== 1)
		throw new Error('Response was used.');

	if (self.type === 0) {

		self.type = 1;

		if (retry === undefined)
			retry = self.subscribe.route.timeout;

		self.subscribe.success();
		self.req.on('close', self.close.bind(self));
		res.success = true;
		var headers = {
			'Pragma': 'no-cache'
		};
		headers[RESPONSE_HEADER_CACHECONTROL] = 'no-cache, no-store, max-age=0, must-revalidate';
		headers[RESPONSE_HEADER_CONTENTTYPE] = 'text/event-stream';
		res.writeHead(self.status, headers);
	}

	if (typeof(data) === OBJECT)
		data = JSON.stringify(data);
	else
		data = data.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

	var newline = '\n';
	var builder = '';

	if (eventname)
		builder = 'event: ' + eventname + newline;

	builder += 'data: ' + data + newline;

	if (id && id.toString())
		builder += 'id: ' + id + newline;

	if (retry && retry > 0)
		builder += 'retry: ' + retry + newline;

	builder += newline;

	res.write(builder);
	framework.stats.response.sse++;

	return self;
};

/*
	Close a response
	@end {Boolean} :: end response? - default true
	return {Controller}
*/
Controller.prototype.close = function(end) {
	var self = this;

	if (end === undefined)
		end = true;

	if (!self.isConnected)
		return self;

	if (self.type === 0) {

		self.isConnected = false;

		if (!self.res.success) {

			self.res.success = true;

			if (end)
				self.res.end();

			framework._request_stats(false, false);
			framework.emit('request-end', self.req, self.res);
		}

		return self;
	}

	self.isConnected = false;
	self.res.success = true;

	if (end)
		self.res.end();

	framework._request_stats(false, false);
	framework.emit('request-end', self.req, self.res);
	self.type = 0;

	return self;
};

/*
	Send proxy request
	@url {String}
	@obj {Object}
	@fnCallback {Function} :: optional
	@timeout {Number} :: optional
	return {EventEmitter}
*/
Controller.prototype.proxy = function(url, obj, fnCallback, timeout) {

	var self = this;
	var headers = { 'X-Proxy': 'total.js' };

	var tmp;

	if (typeof(fnCallback) === NUMBER) {
		tmp = timeout;
		timeout = fnCallback;
		fnCallback = tmp;
	}

	if (typeof(obj) === TYPE_FUNCTION) {
		tmp = fnCallback;
		fnCallback = obj;
		obj = tmp;
	}

	return utils.request(url, REQUEST_PROXY_FLAGS, obj, function(error, data, code, headers) {

		if (!fnCallback)
			return;

		if ((headers['content-type'] || '').indexOf('application/json') !== -1)
			data = JSON.parse(data);

		fnCallback.call(self, error, data, code, headers);

	}, null, headers, ENCODING, timeout || 10000);
};

/*
	Return database
	@name {String}
	return {NoSQL};
*/
Controller.prototype.database = function() {
	if (typeof(framework.database) === OBJECT)
		return framework.database;
	return framework.database.apply(framework, arguments);
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

	if (typeof(name) !== STRING) {
		isPartial = headers;
		headers = model;
		model = name;
		name = self.viewname;
	} else if (isPartial === undefined && typeof(headers) === BOOLEAN) {
		isPartial = headers;
		headers = null;
	}

	if (!isPartial && self.res && self.res.success)
		return self;

	var c = name[0];
	var skip = c === '/' ? 1 : c === '~' ? 2 : c === '@' ? 3 : 0;
	var filename = name;
	var isLayout = self.isLayout;
	self.isLayout = false;

	if (!self.isLayout && skip === 0)
		filename = self._currentView + name;

	if (skip === 2 || skip === 3)
		filename = name.substring(1);

	if (skip === 3)
		filename = '.' + framework.path.package(filename);

	var generator = framework_internal.generateView(name, filename, self.language);
	if (generator === null) {

		var err = new Error('View "' + filename + '" not found.');

		if (isPartial) {
			framework.error(err, self.name, self.uri);
			return self.outputPartial;
		}

		if (isLayout) {
			self.subscribe.success();
			framework.response500(self.req, self.res, err);
			return;
		}

		self.view500(err);
		return;
	}

	var value = '';
	self.$model = model;

	if (isLayout) {
		self._currentStyle = self._defaultStyle || '';
		self._currentScript = self._defaultScript || '';
		self._currentDownload = self._defaultDownload || '';
		self._currentVideo = self._defaultVideo || '';
		self._currentImage = self._defaultImage || '';
		self._currentView = self._defaultView || '';
	}

	var helpers = framework.helpers;

	try {
		value = generator.call(self, self, self.repository, model, self.session, self.query, self.body, self.url, framework.global, helpers, self.user, self.config, framework.functions, 0, isPartial ? self.outputPartial : self.output, self.date, self.req.cookie, self.req.files, self.req.mobile);
	} catch (ex) {

		var err = new Error('View: ' + name + ' - ' + ex.toString());

		if (!isPartial) {
			self.view500(err);
			return;
		}

		self.error(err);

		if (self.isPartial)
			self.outputPartial = '';
		else
			self.output = '';

		isLayout = false;
		return value;
	}

	if (!isLayout && self.precache && self.status === 200 && !isPartial)
		self.precache(value, CONTENTTYPE_TEXTHTML, headers, true);

	if (isLayout || utils.isNullOrEmpty(self.layoutName)) {

		self.outputPartial = '';
		self.output = '';
		isLayout = false;

		if (isPartial)
			return value;

		self.subscribe.success();

		if (!self.isConnected)
			return;

		framework.responseContent(self.req, self.res, self.status, value, CONTENTTYPE_TEXTHTML, self.config['allow-gzip'], headers);
		framework.stats.response.view++;

		return self;
	}

	if (isPartial)
		self.outputPartial = value;
	else
		self.output = value;

	self.isLayout = true;
	value = self.view(self.layoutName, self.$model, headers, isPartial);

	if (isPartial) {
		self.outputPartial = '';
		self.isLayout = false;
		return value;
	}

	return self;
};

/*
	Memorize a view (without layout) into the cache
	@key {String} :: cache key
	@expires {Date} :: expiration
	@disabled {Boolean} :: disabled for debug mode
	@fnTo {Function} :: if cache not exist
	@fnFrom {Function} :: optional, if cache is exist
	return {Controller}
*/
Controller.prototype.memorize = function(key, expires, disabled, fnTo, fnFrom) {

	var self = this;

	if (disabled === true) {
		fnTo();
		return self;
	}

	var output = self.cache.read(key);
	if (output === null) {
		self.precache = function(value, contentType, headers, isView) {

			var options = { content: value, type: contentType };
			if (headers)
				options.headers = headers;

			if (isView) {
				options.repository = [];
				for (var name in self.repository) {
					var value = self.repository[name];
					if (value !== undefined)
						options.repository.push({ key: name, value: value });
				}
			}

			self.cache.add(key, options, expires);
			self.precache = null;
		};

		if (typeof(disabled) === TYPE_FUNCTION)
			fnTo = disabled;

		fnTo();
		return self;
	}

	if (typeof(disabled) === TYPE_FUNCTION) {
		var tmp = fnTo;
		fnTo = disabled;
		fnFrom = tmp;
	}

	if (fnFrom)
		fnFrom();

	if (output.type !== CONTENTTYPE_TEXTHTML) {
		self.subscribe.success();
		framework.responseContent(self.req, self.res, self.status, output.content, output.type, self.config['allow-gzip'], output.headers);
		return;
	}

	switch (output.type) {
		case CONTENTTYPE_TEXTPLAIN:
			framework.stats.response.plain++;
			return self;
		case 'application/json':
			framework.stats.response.json++;
			return self;
		case CONTENTTYPE_TEXTHTML:
			framework.stats.response.view++;
			break;
	}

	var length = output.repository.length;
	for (var i = 0; i < length; i++)
		self.repository[output.repository[i].key] = output.repository[i].value;

	if (!self.layoutName) {
		self.subscribe.success();
		if (!self.isConnected)
			return self;
		framework.responseContent(self.req, self.res, self.status, output.content, output.type, self.config['allow-gzip'], output.headers);
		return self;
	}

	self.output = output.content;
	self.isLayout = true;
	self.view(self.layoutName, null);
	return self;
};

// *********************************************************************************
// =================================================================================
// Framework.WebSocket
// =================================================================================
// *********************************************************************************

var NEWLINE = '\r\n';
var SOCKET_RESPONSE = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nX-Powered-By: {0}\r\nSec-WebSocket-Accept: {1}\r\n\r\n';
var SOCKET_RESPONSE_ERROR = 'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nX-WebSocket-Reject-Reason: 403 Forbidden\r\n\r\n';
var SOCKET_HASH = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
var SOCKET_ALLOW_VERSION = [13];

/*
	WebSocket
	@framework {total.js}
	@path {String}
	@name {String} :: Controller name
	return {WebSocket}
*/
function WebSocket(framework, path, name, id) {
	this._keys = [];
	this.id = id;
	this.online = 0;
	this.connections = {};
	this.repository = {};
	this.name = name;
	this.isController = true;
	this.url = utils.path(path);
	this.route = null;

	// on('open', function(client) {});
	// on('close', function(client) {});
	// on('message', function(client, message) {});
	// on('error', function(error, client) {});
	// events.EventEmitter.call(this);
}

WebSocket.prototype = {

	get global() {
		return framework.global;
	},

	get config() {
		return framework.config;
	},

	get cache() {
		return framework.cache;
	},

	get isDebug() {
		return framework.config.debug;
	},

	get path() {
		return framework.path;
	},

	get fs() {
		return framework.fs;
	},

	get isSecure() {
		return this.req.isSecure;
	},

	get async() {

		var self = this;

		if (typeof(self._async) === UNDEFINED)
			self._async = new utils.Async(self);

		return self._async;
	}
}

WebSocket.prototype.__proto__ = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: WebSocket,
		enumberable: false
	}
});

/**
 * Compare Date/Time
 * @param {String} type Compare type ('<', '>', '=', '>=', '<=')
 * @param {String or Date} d1 String (yyyy-MM-dd [HH:mm:ss]), (optional) - default current date
 * @param {String or Date} d2 String (yyyy-MM-dd [HH:mm:ss])
 * @return {Boolean}
 */
WebSocket.prototype.date = function(type, d1, d2) {

	if (d2 === undefined) {
		d2 = d1;
		d1 = new Date();
	}

	var beg = typeof(d1) === STRING ? d1.parseDate() : d1;
	var end = typeof(d2) === STRING ? d2.parseDate() : d2;
	var r = beg.compare(end);

	switch (type) {
		case '>':
			return r === 1;
		case '>=':
		case '=>':
			return r === 1 || r === 0;
		case '<':
			return r === -1;
		case '<=':
		case '=<':
			return r === -1 || r === 0;
		case '=':
			return r === 0;
	}

	return true;
};

/**
 * Send a message
 * @param {String} message
 * @param {String Array or Function(client)} id
 * @param {String Array or Funciton(client)} blacklist
 * @return {WebSocket}
 */
WebSocket.prototype.send = function(message, id, blacklist) {

	var self = this;
	var keys = self._keys;
	var length = keys.length;

	if (length === 0)
		return self;

	var fn = typeof(blacklist) === TYPE_FUNCTION ? blacklist : null;
	var is = blacklist instanceof Array;

	if (id === undefined || id === null || !id.length) {

		for (var i = 0; i < length; i++) {

			var _id = keys[i];

			if (is && blacklist.indexOf(_id) !== -1)
				continue;

			var conn = self.connections[_id];

			if (fn !== null && !fn.call(self, _id, conn))
				continue;

			conn.send(message);
			framework.stats.response.websocket++;
		}

		self.emit('send', message, null, []);
		return self;
	}

	fn = typeof(id) === TYPE_FUNCTION ? id : null;
	is = id instanceof Array;

	for (var i = 0; i < length; i++) {

		var _id = keys[i];

		if (is && id.indexOf(_id) === -1)
			continue;

		var conn = self.connections[_id];

		if (fn !== null && !fn.call(self, _id, conn) === -1)
			continue;

		conn.send(message);
		framework.stats.response.websocket++;
	}

	self.emit('send', message, id, blacklist);
	return self;
};

/**
 * Send a ping
 * @return {WebSocket}
 */
WebSocket.prototype.ping = function() {

	var self = this;
	var keys = self._keys;
	var length = keys.length;

	if (length === 0)
		return self;

	self.$ping = true;
	framework.stats.other.websocketPing++;

	for (var i = 0; i < length; i++)
		self.connections[keys[i]].ping();

	return self;
};

/*
	Close connection
	@id {String Array} :: optional, default null
	@message {String} :: optional
	@code {Number} :: optional, default 1000
	return {WebSocket}
*/
WebSocket.prototype.close = function(id, message, code) {

	var self = this;
	var keys = self._keys;

	if (typeof(id) === STRING) {
		code = message;
		message = id;
		id = null;
	}

	if (keys === null)
		return self;

	var length = keys.length;

	if (length === 0)
		return self;

	if (id === undefined || id === null || !id.length) {
		for (var i = 0; i < length; i++) {
			var _id = keys[i];
			self.connections[_id].close(message, code);
			self._remove(_id);
		}
		self._refresh();
		return self;
	}

	var is = id instanceof Array;
	var fn = typeof(id) === TYPE_FUNCTION ? id : null;

	for (var i = 0; i < length; i++) {

		var _id = keys[i];

		if (is && id.indexOf(_id) === -1)
			continue;

		var conn = self.connections[_id];

		if (fn !== null && !fn.call(self, _id, conn))
			continue;

		conn.close(message, code);
		self._remove(_id);
	}

	self._refresh();
	return self;
};

/**
 * Error caller
 * @param {Error/String} err
 * @return {WebSocket/Function}
 */
WebSocket.prototype.error = function(err) {
	var self = this;
	var result = framework.error(typeof(err) === STRING ? new Error(err) : err, self.name, self.path);

	if (err === undefined)
		return result;

	return self;
};

/*
	Problem
	@message {String}
	return {Framework}
*/
WebSocket.prototype.problem = function(message) {
	var self = this;
	framework.problem(message, self.name, self.uri);
	return self;
};

/*
	Change
	@message {String}
	return {Framework}
*/
WebSocket.prototype.change = function(message) {
	var self = this;
	framework.change(message, self.name, self.uri, self.ip);
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
	Find a connection
	@id {String or Function} :: function(client, id) {}
	return {WebSocketClient}
*/
WebSocket.prototype.find = function(id) {
	var self = this;
	var length = self._keys.length;
	var isFn = typeof(id) === TYPE_FUNCTION;

	for (var i = 0; i < length; i++) {
		var connection = self.connections[self._keys[i]];

		if (!isFn) {
			if (connection.id === id)
				return connection;
			continue;
		}

		if (id(connection, connection.id))
			return connection;
	}

	return null;
};

/*
	Destroy a websocket
*/
WebSocket.prototype.destroy = function(problem) {
	var self = this;

	if (problem)
		self.problem(problem);

	if (self.connections === null && self._keys === null)
		return self;

	self.close();
	self.connections = null;
	self._keys = null;
	delete framework.connections[self.id];
	self.removeAllListeners();
	self.emit('destroy');
	return self;
};

/*
	Send proxy request
	@url {String}
	@obj {Object}
	@fnCallback {Function} :: optional
	return {EvetEmitter}
*/
WebSocket.prototype.proxy = function(url, obj, fnCallback) {

	var self = this;
	var headers = {
		'X-Proxy': 'total.js'
	};

	if (typeof(obj) === TYPE_FUNCTION) {
		var tmp = fnCallback;
		fnCallback = obj;
		obj = tmp;
	}

	return utils.request(url, REQUEST_PROXY_FLAGS, obj, function(error, data, code, headers) {

		if (!fnCallback)
			return;

		if ((headers['content-type'] || '').indexOf('application/json') !== -1)
			data = JSON.parse(data);

		fnCallback.call(self, error, data, code, headers);

	}, headers);

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
	return framework.module(name);
};

/*
	Get a model
	@name {String} :: name of model
	return {Object};
*/
WebSocket.prototype.model = function(name) {
	return framework.model(name);
};

/**
 * Render helper to string
 * @param {String} name
 * @return {String}
 */
WebSocket.prototype.helper = function(name) {
	var self = this;
	var helper = framework.helpers[name] || null;

	if (helper === null)
		return '';

	var length = arguments.length;
	var params = [];

	for (var i = 1; i < length; i++)
		params.push(arguments[i]);

	return helper.apply(self, params);
};

/*
	Controller functions reader
	@name {String} :: name of controller
	return {Object};
*/
WebSocket.prototype.functions = function(name) {
	return (framework.controllers[name] || {}).functions;
};

/*
	Return database
	@name {String}
	return {Database};
*/
WebSocket.prototype.database = function() {
	if (typeof(framework.database) === OBJECT)
		return framework.database;
	return framework.database.apply(framework, arguments);
};

/*
	Resource reader
	@name {String} :: filename
	@key {String}
	return {String};
*/
WebSocket.prototype.resource = function(name, key) {
	return framework.resource(name, key);
};

/*
	Log
	@arguments {Object array}
	return {WebSocket};
*/
WebSocket.prototype.log = function() {
	var self = this;
	framework.log.apply(framework, arguments);
	return self;
};

WebSocket.prototype.check = function() {
	var self = this;

	if (!self.$ping)
		return self;

	self.all(function(client) {
		if (client.$ping)
			return;
		client.close();
		framework.stats.other.websocketCleaner++;
	});

	return self;
};

/*
	Logger
	@arguments {Object array}
	return {WebSocket};
*/
WebSocket.prototype.logger = function() {
	var self = this;
	framework.logger.apply(framework, arguments);
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
	return utils.validate.call(self, model, properties, framework.onValidation, error);
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

	this.$ping = true;
	this.container = null;
	this._id = null;
	this.id = '';
	this.socket = socket;
	this.req = req;
	this.isClosed = false;
	this.isWebSocket = true;
	this.errors = 0;
	this.buffer = new Buffer(0);
	this.length = 0;
	this.cookie = req.cookie.bind(req);

	// 1 = raw - not implemented
	// 2 = plain
	// 3 = JSON

	this.type = 2;
	this._isClosed = false;
}

WebSocketClient.prototype = {

	get protocol() {
		return (this.req.headers['sec-websocket-protocol'] || '').replace(/\s/g, '').split(',');
	},

	get ip() {
		return this.req.ip;
	},

	get get() {
		return this.req.query;
	},

	get query() {
		return this.req.query;
	},

	get uri() {
		return this.req.uri;
	},

	get config() {
		return this.container.config;
	},

	get global() {
		return this.container.global;
	},

	get session() {
		return this.req.session;
	},

	set session(value) {
		this.req.session = value;
	},

	get user() {
		return this.req.user;
	},

	set user(value) {
		this.req.user = value;
	}
};

WebSocketClient.prototype.__proto__ = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: WebSocketClient,
		enumberable: false
	}
});

/*
	Internal function
	@allow {String Array} :: allow origin
	@protocols {String Array} :: allow protocols
	@flags {String Array} :: flags
	return {Boolean}
*/
WebSocketClient.prototype.prepare = function(flags, protocols, allow, length, version) {

	var self = this;

	flags = flags || [];
	protocols = protocols || [];
	allow = allow || [];

	self.length = length;

	var origin = self.req.headers['origin'] || '';

	if (allow.length) {

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

	if (protocols.length) {
		for (var i = 0; i < protocols.length; i++) {
			if (self.protocol.indexOf(protocols[i]) === -1)
				return false;
		}
	}

	if (SOCKET_ALLOW_VERSION.indexOf(utils.parseInt(self.req.headers['sec-websocket-version'])) === -1)
		return false;

	self.socket.write(new Buffer(SOCKET_RESPONSE.format('total.js v' + version, self._request_accept_key(self.req)), 'binary'));

	self._id = (self.ip || '').replace(/\./g, '') + utils.GUID(20);
	self.id = self._id;

	return true;
};

/**
 * Add a container to client
 * @param {WebSocket} container
 * @return {WebSocketClient}
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
	self.socket.on('end', self.handlers.onclose);

	self.container._add(self);
	self.container._refresh();

	framework.emit('websocket-begin', self.container, self);
	self.container.emit('open', self);

	return self;
};

/*
	MIT
	Written by Jozef Gula
	---------------------
	Internal handler
	@data {Buffer}
*/
WebSocketClient.prototype._ondata = function(data) {

	var self = this;

	if (data != null)
		self.buffer = Buffer.concat([self.buffer, data]);

	if (self.buffer.length > self.length) {
		self.errors++;
		self.container.emit('error', new Error('Maximum request length exceeded.'), self);
		return;
	}

	switch (self.buffer[0] & 0x0f) {
		case 0x01:

			// text message or JSON message
			if (self.type !== 1)
				self.parse();

			break;
		case 0x02:

			// binary message
			if (self.type === 1)
				self.parse();

			break;
		case 0x08:
			// close
			self.close();
			break;
		case 0x09:
			// ping, response pong
			self.socket.write(utils.getWebSocketFrame(0, '', 0x0A));
			self.buffer = new Buffer(0);
			self.$ping = true;
			break;
		case 0x0a:
			// pong
			self.$ping = true;
			self.buffer = new Buffer(0);
			break;
	}
};

// MIT
// Written by Jozef Gula
WebSocketClient.prototype.parse = function() {

	var self = this;

	var bLength = self.buffer[1];

	if (((bLength & 0x80) >> 7) !== 1)
		return self;

	var length = utils.getMessageLength(self.buffer, framework.isLE);
	var index = (self.buffer[1] & 0x7f);

	index = (index == 126) ? 4 : (index == 127 ? 10 : 2);

	if ((index + length + 4) > (self.buffer.length))
		return self;

	var mask = new Buffer(4);
	self.buffer.copy(mask, 0, index, index + 4);

	// TEXT
	if (self.type !== 1) {
		var output = '';
		for (var i = 0; i < length; i++)
			output += String.fromCharCode(self.buffer[index + 4 + i] ^ mask[i % 4]);

		// JSON
		if (self.type === 3) {
			try {
				self.container.emit('message', self, JSON.parse(self.container.config['default-websocket-encodedecode'] === true ? $decodeURIComponent(output) : output));
			} catch (ex) {
				self.errors++;
				self.container.emit('error', new Error('JSON parser: ' + ex.toString()), self);
			}
		} else
			self.container.emit('message', self, self.container.config['default-websocket-encodedecode'] === true ? $decodeURIComponent(output) : output);

	} else {
		var binary = new Buffer(length);
		for (var i = 0; i < length; i++)
			binary.write(self.buffer[index + 4 + i] ^ mask[i % 4]);
		self.container.emit('message', self, binary);
	}

	self.buffer = self.buffer.slice(index + length + 4, self.buffer.length);

	if (self.buffer.length >= 2 && utils.getMessageLength(self.buffer, framework.isLE))
		self.parse();

	return self;
};

WebSocketClient.prototype._onerror = function(error) {
	var self = this;
	if (error.stack.indexOf('ECONNRESET') !== -1 || error.stack.indexOf('socket is closed') !== -1 || error.stack.indexOf('EPIPE') !== -1)
		return;
	self.container.emit('error', error, self);
};

WebSocketClient.prototype._onclose = function() {
	var self = this;

	if (self._isClosed)
		return;

	self._isClosed = true;
	self.container._remove(self._id);
	self.container._refresh();
	self.container.emit('close', self);
	framework.emit('websocket-end', self.container, self);
};

/*
	Send message
	@message {String or Object}
	return {WebSocketClient}
*/
WebSocketClient.prototype.send = function(message) {

	var self = this;

	if (self.isClosed)
		return self;

	if (self.type !== 1) {

		var data = self.type === 3 ? JSON.stringify(message) : (message || '').toString();
		if (self.container.config['default-websocket-encodedecode'] === true && data)
			data = encodeURIComponent(data);
		self.socket.write(utils.getWebSocketFrame(0, data, 0x01));

	} else {

		if (message !== null)
			self.socket.write(utils.getWebSocketFrame(0, message, 0x02));

	}

	return self;
};

/**
 * Ping message
 * @return {WebSocketClient}
 */
WebSocketClient.prototype.ping = function() {

	var self = this;

	if (self.isClosed)
		return self;

	self.socket.write(utils.getWebSocketFrame(0, '', 0x09));
	self.$ping = false;

	return self;
};

/**
 * Close connection
 * @param {String} message Message.
 * @param {Number} code WebSocket code.
 * @return {WebSocketClient}
 */
WebSocketClient.prototype.close = function(message, code) {
	var self = this;

	if (self.isClosed)
		return self;

	self.isClosed = true;
	self.socket.end(utils.getWebSocketFrame(code || 1000, message || '', 0x08));

	return self;
};

/**
 * Create a signature for the WebSocket
 * @param {Request} req
 * @return {String}
 */
WebSocketClient.prototype._request_accept_key = function(req) {
	var sha1 = crypto.createHash('sha1');
	sha1.update((req.headers['sec-websocket-key'] || '') + SOCKET_HASH);
	return sha1.digest('base64');
};

function Backup() {
	this.file = [];
	this.directory = [];
	this.path = '';
	this.fileName = '';
	this.read = { key: '', value: '', status: 0 };
	this.pending = 0;
	this.cache = {};
	this.complete = function() {};
	this.filter = function(path) {
		return true;
	};
}

Backup.prototype.restoreKey = function(data) {

	var self = this;
	var read = self.read;

	if (read.status === 1) {
		self.restoreValue(data);
		return;
	}

	var index = -1;
	var tmp = data;

	if (read.status === 2) {
		tmp = read.key + tmp;
		index = tmp.indexOf(':');
	}
	else
		index = tmp.indexOf(':');

	if (index === -1) {
		read.key += data;
		read.status = 2;
		return;
	}

	read.status = 1;
	read.key = tmp.substring(0, index);
	self.restoreValue(tmp.substring(index + 1));
};

Backup.prototype.restoreValue = function(data) {

	var self = this;
	var read = self.read;

	if (read.status !== 1) {
		self.restoreKey(data);
		return;
	}

	var index = data.indexOf('\n');
	if (index === -1) {
		read.value += data;
		return;
	}

	read.value += data.substring(0, index);
	self.restoreFile(read.key.replace(/\s/g, ''), read.value.replace(/\s/g, ''));

	read.status = 0;
	read.value = '';
	read.key = '';

	self.restoreKey(data.substring(index + 1));
};

Backup.prototype.restore = function(filename, path, callback, filter) {

	if (!fs.existsSync(filename)) {
		if (callback)
			callback(new Error('Package not found.'), path);
		return;
	}

	var self = this;

	self.filter = filter;
	self.cache = {};
	self.createDirectory(path, true);

	var stream = fs.createReadStream(filename);

	self.path = path;

	stream.on('data', function(buffer) {
		self.restoreKey(buffer.toString('utf8'));
	});

	if (!callback) {
		stream.resume();
		return;
	}

	callback.path = path;

	stream.on('end', function() {
		self.callback(callback);
		stream = null;
	});

	stream.resume();
};

Backup.prototype.callback = function(cb) {
	var self = this;

	if (self.pending <= 0)
		return cb(null, cb.path);

	setTimeout(function() {
		self.callback(cb);
	}, 100);
};

Backup.prototype.restoreFile = function(key, value) {
	var self = this;

	if (typeof(self.filter) === 'function' && !self.filter(key))
		return;

	if (value === '#') {
		self.createDirectory(key);
		return;
	}

	var p = key;
	var index = key.lastIndexOf('/');

	if (index !== -1) {
		p = key.substring(0, index).trim();
		if (p)
			self.createDirectory(p);
	}

	var buffer = new Buffer(value, 'base64');
	self.pending++;
	zlib.gunzip(buffer, function(err, data) {
		fs.writeFileSync(path.join(self.path, key), data);
		self.pending--;
		buffer = null;
	});
};

Backup.prototype.createDirectory = function(p, root) {

	var self = this;

	if (self.cache[p])
		return;

	self.cache[p] = true;

	if (p[0] === '/')
		p = p.substring(1);

	var is = framework.isWindows;

	if (is) {
		if (p[p.length - 1] === '\\')
			p = p.substring(0, p.length - 1);
	} else {
		if (p[p.length - 1] === '/')
			p = p.substring(0, p.length - 1);
	}

	var arr = is ? p.replace(/\//g, '\\').split('\\') : p.split('/');
	var directory = '';

	if (is && arr[0].indexOf(':') !== -1)
		arr.shift();

	var length = arr.length;

	for (var i = 0; i < length; i++) {

		var name = arr[i];

		if (is)
			directory += (directory ? '\\' : '') + name;
		else
			directory += (directory ? '/' : '') + name;

		var dir = path.join(self.path, directory);
		if (root)
			dir = (is ? '\\' : '/') + dir;

		if (fs.existsSync(dir))
			continue;

		fs.mkdirSync(dir);
	}
};

// *********************************************************************************
// =================================================================================
// Prototypes
// =================================================================================
// *********************************************************************************

/**
 * Add a cookie into the response
 * @param {String} name
 * @param {Object} value
 * @param {Date/String} expires
 * @param {Object} options Additional options.
 * @return {ServerResponse}
 */
http.ServerResponse.prototype.cookie = function(name, value, expires, options) {

	var self = this;

	if (self.headersSent || self.success)
		return;

	var builder = [name + '=' + encodeURIComponent(value)];
	var type = typeof(expires);

	if (expires && !utils.isDate(expires) && type === OBJECT) {
		options = expires;
		expires = options.expires || options.expire || null;
	}

	if (type === STRING)
		expires = expires.parseDateExpiration();

	if (!options)
		options = {};

	options.path = options.path || '/';

	if (expires)
		builder.push('Expires=' + expires.toUTCString());

	if (options.domain)
		builder.push('Domain=' + options.domain);

	if (options.path)
		builder.push('Path=' + options.path);

	if (options.secure)
		builder.push('Secure');

	if (options.httpOnly || options.httponly || options.HttpOnly)
		builder.push('HttpOnly');

	var arr = self.getHeader('set-cookie') || [];
	arr.push(builder.join('; '));
	self.setHeader('Set-Cookie', arr);
	return self;
};

/**
 * Disable HTTP cache for current response
 * @return {Response}
 */
http.ServerResponse.prototype.noCache = function() {
	var self = this;
	self.removeHeader(RESPONSE_HEADER_CACHECONTROL);
	self.removeHeader('Etag');
	self.removeHeader('Last-Modified');
	return self;
};

/**
 * Send
 * @param {Number} code Response status code, optional
 * @param {Object} body Body
 * @param {String} type Content-Type, optional
 * @return {Response}
 */
http.ServerResponse.prototype.send = function(code, body, type) {

	var self = this;

	if (self.headersSent)
		return self;

	if (self.controller)
		self.controller.subscribe.success();

	var res = self;
	var req = self.req;
	var contentType = type;
	var isHEAD = req.method === 'HEAD';

	if (body === undefined) {
		body = code;
		code = 200;
	}

	switch (typeof(body)) {
		case STRING:

			if (!contentType)
				contentType = 'text/html';

			break;

		case NUMBER:

			if (!contentType)
				contentType = 'text/plain';

			body = utils.httpStatus(body);
			break;

		case BOOLEAN:
		case OBJECT:

			if (!contentType)
				contentType = 'application/json';

			if (!isHEAD) {
				if (body instanceof builders.ErrorBuilder)
					body = obj.output();
				body = JSON.stringify(body);
			}

			break;
	}

	var accept = req.headers['accept-encoding'] || '';
	var headers = {};

	headers[RESPONSE_HEADER_CACHECONTROL] = 'private';
	headers['Vary'] = 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : '');

	// Safari resolve
	if (contentType === 'application/json')
		headers[RESPONSE_HEADER_CACHECONTROL] = 'private, no-cache, no-store, must-revalidate';

	if ((/text|application/).test(contentType))
		contentType += '; charset=utf-8';

	headers[RESPONSE_HEADER_CONTENTTYPE] = contentType;
	framework.responseCustom(req, res);

	var compress = accept.lastIndexOf('gzip') !== -1;

	if (isHEAD) {
		if (compress)
			headers['Content-Encoding'] = 'gzip';
		res.writeHead(200, headers);
		res.end();
		return self;
	}

	if (!compress) {
		// headers[RESPONSE_HEADER_CONTENTLENGTH] = Buffer.byteLength(body, ENCODING);
		res.writeHead(code, headers);
		res.end(body, ENCODING);
		return self;
	}

	var buffer = new Buffer(body);
	zlib.gzip(buffer, function(err, data) {

		if (err) {
			res.writeHead(code, headers);
			res.end(body, ENCODING);
			return;
		}

		headers['Content-Encoding'] = 'gzip';
		// headers[RESPONSE_HEADER_CONTENTLENGTH] = data.length;
		res.writeHead(code, headers);
		res.end(data, ENCODING);
	});

	return self;
};

http.ServerResponse.prototype.throw400 = function(problem) {
	if (this.controller)
		this.controller.subscribe.success();
	framework.response400(this.req, this, problem);
};

http.ServerResponse.prototype.throw401 = function(problem) {
	if (this.controller)
		this.controller.subscribe.success();
	framework.response401(this.req, this, problem);
};

http.ServerResponse.prototype.throw403 = function(problem) {
	if (this.controller)
		this.controller.subscribe.success();
	framework.response403(this.req, this, problem);
};

http.ServerResponse.prototype.throw404 = function(problem) {
	if (this.controller)
		this.controller.subscribe.success();
	framework.response404(this.req, this, problem);
};

http.ServerResponse.prototype.throw408 = function(problem) {
	if (this.controller)
		this.controller.subscribe.success();
	framework.response408(this.req, this, problem);
};

http.ServerResponse.prototype.throw431 = function(problem) {
	if (this.controller)
		this.controller.subscribe.success();
	framework.response431(this.req, this, problem);
};

http.ServerResponse.prototype.throw500 = function(error) {
	if (this.controller)
		this.controller.subscribe.success();
	framework.response500(this.req, this, error);
};

http.ServerResponse.prototype.throw501 = function(problem) {
	if (this.controller)
		this.controller.subscribe.success();
	framework.response501(this.req, this, problem);
};

/**
 * Responses static file
 * @param {Function} done Optional, callback.
 * @return {Response}
 */
http.ServerResponse.prototype.continue = function(done) {
	var self = this;
	if (self.headersSent) {
		if (done)
			done();
		return self;
	}
	if (self.controller)
		self.controller.subscribe.success();
	framework.responseStatic(self.req, self, done);
	return self;
};

/**
 * Response custom content
 * @param {Number} code
 * @param {String} body
 * @param {String} type
 * @param {Boolean} compress Disallows GZIP compression. Optional, default: true.
 * @param {Object} headers Optional, additional headers.
 * @return {Response}
 */
http.ServerResponse.prototype.content = function(code, body, type, compress, headers) {
	var self = this;
	if (self.headersSent)
		return self;
	if (self.controller)
		self.controller.subscribe.success();
	framework.responseContent(self.req, self, code, body, type, compress, headers);
	return self;
};

/**
 * Response redirect
 * @param {String} url
 * @param {Boolean} permanent Optional, default: false.
 * @return {Framework}
 */
http.ServerResponse.prototype.redirect = function(url, permanent) {
	var self = this;
	if (self.headersSent)
		return self;
	if (self.controller)
		self.controller.subscribe.success();
	framework.responseRedirect(self.req, self, url, permanent);
	return self;
};

/**
 * Responses file
 * @param {String} filename
 * @param {String} download Optional, a download name.
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optional, callback.
 * @return {Framework}
 */
http.ServerResponse.prototype.file = function(filename, download, headers, done) {
	var self = this;
	if (self.headersSent) {
		if (done)
			done();
		return self;
	}
	if (self.controller)
		self.controller.subscribe.success();
	framework.responseFile(self.req, self, filename, download, headers, done);
	return self;
};

/**
 * Responses stream
 * @param {String} contentType
 * @param {Stream} stream
 * @param {String} download Optional, a download name.
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optional, callback.
 * @return {Framework}
 */
http.ServerResponse.prototype.stream = function(contentType, stream, download, headers, done, nocompress) {
	var self = this;
	if (self.headersSent) {
		if (done)
			done();
		return self;
	}
	if (self.controller)
		self.controller.subscribe.success();

	framework.responseStream(self.req, self, contentType, stream, download, headers, done, nocompress);
	return self;
};

/**
 * Responses image
 * @param {String or Stream} filename
 * @param {String} fnProcess
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optional, callback.
 * @return {Framework}
 */
http.ServerResponse.prototype.image = function(filename, fnProcess, headers, done) {
	var self = this;
	if (self.headersSent) {
		if (done)
			done();
		return self;
	}
	if (self.controller)
		self.controller.subscribe.success();
	framework.responseImage(self.req, self, filename, fnProcess, headers, done);
	return self;
};

/**
 * Response JSON
 * @param {Object} obj
 * @return {Response}
 */
http.ServerResponse.prototype.json = function(obj) {
	var self = this;
	// self.removeHeader('Etag');
	// self.removeHeader('Last-Modified');
	return self.send(200, obj, 'application/json');
};

var _tmp = http.IncomingMessage.prototype;

http.IncomingMessage.prototype = {

	get ip() {

		var self = this;
		if (self._ip)
			return self._ip;

		//  x-forwarded-for: client, proxy1, proxy2, ...
		var proxy = self.headers['x-forwarded-for'];
		if (proxy !== undefined)
			self._ip = proxy.split(',', 1)[0] || self.connection.removiewddress;
		else
			self._ip = self.connection.remoteAddress;

		return self._ip;
	},

	get query() {
		var self = this;
		if (self._dataGET)
			return self._dataGET;
		self._dataGET = qs.parse(self.uri.query);
		return self._dataGET;
	},

	get subdomain() {

		var self = this;

		if (self._subdomain)
			return self._subdomain;

		var subdomain = self.uri.host.toLowerCase().replace(/^www\./i, '').split('.');
		if (subdomain.length > 2)
			self._subdomain = subdomain.slice(0, subdomain.length - 2); // example: [subdomain].domain.com
		else
			self._subdomain = null;

		return self._subdomain;
	},

	get host() {
		return this.headers['host'];
	},

	get isSecure() {
		return this.uri.protocol === 'https:' || this.uri.protocol === 'wss:';
	},

	get language() {
		if (!this.$language)
			this.$language = (((this.headers['accept-language'] || '').split(';')[0] || '').split(',')[0] || '').toLowerCase();
		return this.$language;
	},

	get mobile() {
		if (this.$mobile === undefined)
			this.$mobile = REG_MOBILE.test(this.headers['user-agent']);
		return this.$mobile;
	},

	set language(value) {
		this.$language = value;
	}
};

// Handle errors of decodeURIComponent
function $decodeURIComponent(value) {
	try
	{
		return decodeURIComponent(value);
	} catch (e) {
		return value;
	}
};

http.IncomingMessage.prototype.__proto__ = _tmp;

/**
 * Signature request (user-agent + ip + referer + current URL + custom key)
 * @param {String} key Custom key.
 * @return {Request}
 */
http.IncomingMessage.prototype.signature = function(key) {
	var self = this;
	return framework.encrypt((self.headers['user-agent'] || '') + '#' + self.ip + '#' + self.url + '#' + (key || ''), 'request-signature', false);
};

/**
 * Disable HTTP cache for current request
 * @return {Request}
 */
http.IncomingMessage.prototype.noCache = function() {
	var self = this;
	delete self.headers['if-none-match'];
	delete self.headers['if-modified-since'];
	return self;
};

http.IncomingMessage.prototype.behaviour = function(type) {

	if (!framework.behaviours)
		return false;

	var url = this.url;

	if (!this.isStaticFile && url[url.length - 1] !== '/')
		url += '/';

	var current = framework.behaviours['*'];
	var value = false;

	// global
	if (current !== undefined) {
		current = current[type];
		if (current !== undefined)
			value = current;
	}

	// by specific
	current = framework.behaviours[url];
	if (current === undefined)
		return value; // responds with global

	current = current[type];

	if (current === undefined)
		return value; // responds with global

	return current;
};

/**
 * Read a cookie from current request
 * @param {String} name Cookie name.
 * @return {String} Cookie value (default: '')
 */
http.IncomingMessage.prototype.cookie = function(name) {

	var self = this;
	if (self.cookies !== undefined)
		return $decodeURIComponent(self.cookies[name] || '');

	var cookie = self.headers['cookie'];
	if (!cookie)
		return '';

	self.cookies = {};

	var arr = cookie.split(';');
	var length = arr.length;

	for (var i = 0; i < length; i++) {
		var c = arr[i].trim().split('=');
		self.cookies[c.shift()] = c.join('=');
	}

	return $decodeURIComponent(self.cookies[name] || '');
};

/**
 * Read authorization header
 * @return {Object}
 */
http.IncomingMessage.prototype.authorization = function() {

	var self = this;
	var authorization = self.headers['authorization'] || '';
	var result = { user: '', password: '', empty: true };

	if (authorization === '')
		return result;

	var arr = new Buffer(authorization.replace('Basic ', '').trim(), 'base64').toString(ENCODING).split(':');

	result.user = arr[0] || '';
	result.password = arr[1] || '';
	result.empty = result.user.length === 0 || result.password.length === 0;

	return result;
};

/**
 * Authorization for custom delegates
 * @param  {Function(err, userprofile, isAuthorized)} callback
 * @return {Request}
 */
http.IncomingMessage.prototype.authorize = function(callback) {

	if (framework.onAuthorization === null) {
		callback(null, null, false);
		return this;
	}

	var req = this;

	framework.onAuthorization(req, req.res, req.flags, function(isAuthorized, user) {
		if (typeof(isAuthorized) !== BOOLEAN) {
			user = isAuthorized;
			isAuthorized = !user;
		}
		req.isAuthorized = isAuthorized;
		callback(null, user, isAuthorized);
	});

	return this;
};

/**
 * Clear all uplaoded files
 * @private
 * @param {Boolean} isAuto
 * @return {Request}
 */
http.IncomingMessage.prototype.clear = function(isAuto) {

	var self = this;
	var files = self.files;

	if (!files)
		return self;

	if (isAuto && self._manual)
		return self;

	var length = files.length;
	if (length === 0)
		return self;

	var arr = [];
	for (var i = 0; i < length; i++)
		arr.push(files[i].path);

	framework.unlink(arr);
	self.files = null;

	return self;
};

/**
 * Get host name from URL
 * @param {String} path Additional path.
 * @return {String}
 */
http.IncomingMessage.prototype.hostname = function(path) {

	var self = this;
	var uri = self.uri;

	if (path && path[0] !== '/')
		path = '/' + path;

	return uri.protocol + '//' + uri.hostname + (uri.port && uri.port !== 80 ? ':' + uri.port : '') + (path || '');
};

var framework = new Framework();
global.framework = global.F = module.exports = framework;

process.on('uncaughtException', function(e) {

	if (e.toString().indexOf('listen EADDRINUSE') !== -1) {
		if (typeof(process.send) === TYPE_FUNCTION)
			process.send('eaddrinuse');
		console.log('\nThe IP address and the PORT is already in use.\nYou must change the PORT\'s number or IP address.\n');
		process.exit('SIGTERM');
		return;
	}

	if (framework.isTest) {
		// HACK: this method is created dynamically in framework.testing();
		if (framework.testContinue)
			framework.testContinue(e);
		return;
	}

	framework.error(e, '', null);
});

function fsFileRead(filename, callback) {
	U.queue('framework.files', F.config['default-maximum-file-descriptors'], function(next) {
		fs.readFile(filename, function(err, result) {
			next();
			callback(err, result);
		});
	});
};

function fsFileExists(filename, callback) {
	U.queue('framework.files', F.config['default-maximum-file-descriptors'], function(next) {
		fs.exists(filename, function(e) {
			next();
			callback(e);
		});
	});
};

function fsStreamRead(filename, options, callback, next) {
	if (!callback) {
		callback = options;
		options = undefined;
	}

	var opt = { flags: 'r', mode: '0666', autoClose: true };

	if (options)
		framework_utils.extend(opt, options, true);

	U.queue('framework.files', F.config['default-maximum-file-descriptors'], function(next) {
		var stream = fs.createReadStream(filename, opt);
		stream.on('error', noop);
		callback(stream, next);
	});
}

/**
 * Prepare URL address to temporary key (for caching)
 * @param {ServerRequest or String} req
 * @return {String}
 */
function createTemporaryKey(req) {
	return (req.uri ? req.uri.pathname : req).replace(TEMPORARY_KEY_REGEX, '-').substring(1);
}

process.on('SIGTERM', function() {
	framework.stop();
});

process.on('SIGINT', function() {
	framework.stop();
});

process.on('exit', function() {
	framework.stop();
});

process.on('message', function(msg, h) {

	if (typeof(msg) !== STRING) {
		framework.emit('message', msg, h);
		return;
	}

	if (msg === 'debugging') {
		Utils.wait(function() {
			return framework.isLoaded;
		}, function() {
			delete framework.isLoaded;
			framework.console();
			framework.console = utils.noop;
		}, 10000, 500);
		return;
	}

	if (msg === 'reconnect') {
		framework.reconnect();
		return;
	}

	if (msg === 'reconfigure') {
		framework._configure();
		framework._configure_versions();
		framework._configure_sitemap();
		framework.emit(msg);
		return;
	}

	if (msg === 'reset') {
		// framework.clear();
		framework.cache.clear();
		return;
	}

	if (msg === 'stop' || msg === 'exit') {
		framework.stop();
		return;
	}

	framework.emit('message', msg, h);
});

function prepare_error(e) {
	if (!framework.isDebug || !e)
		return '';
	if (e.stack)
		return ' :: ' + e.stack.toString();
	return ' :: ' + e.toString();
}

function prepare_isomorphic(name) {
	name = name.replace(/\.js$/i, '');

	var content = framework.isomorphic[name];
	if (content)
		content = content.$$output;
	else
		content = '';

	return 'if(window["isomorphic"]===undefined)window.isomorphic={};isomorphic["' + name + '"]=(function(framework,F,U,utils,Utils,is_client,is_server){var module={},exports=module.exports={};' + content + ';return exports;})(null,null,null,null,null,true,false)';
}
