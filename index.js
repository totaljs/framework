// Copyright 2012-2017 (c) Peter Širka <petersirka@gmail.com>
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
 * @version 2.4.0
 */

'use strict';

const Qs = require('querystring');
const Os = require('os');
const Fs = require('fs');
const Zlib = require('zlib');
const Path = require('path');
const Crypto = require('crypto');
const Parser = require('url');
const Child = require('child_process');
const Util = require('util');
const Events = require('events');
const http = require('http');

const ENCODING = 'utf8';
const RESPONSE_HEADER_CACHECONTROL = 'Cache-Control';
const RESPONSE_HEADER_CONTENTTYPE = 'Content-Type';
const RESPONSE_HEADER_CONTENTLENGTH = 'Content-Length';
const CONTENTTYPE_TEXTPLAIN = 'text/plain';
const CONTENTTYPE_TEXTHTML = 'text/html';
const REQUEST_COMPRESS_CONTENTTYPE = { 'text/plain': true, 'text/javascript': true, 'text/css': true, 'text/jsx': true, 'application/x-javascript': true, 'application/json': true, 'text/xml': true, 'image/svg+xml': true, 'text/x-markdown': true, 'text/html': true };
const TEMPORARY_KEY_REGEX = /\//g;
const REG_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;
const REG_ROBOT = /search|agent|bot|crawler|spider/i;
const REG_VERSIONS = /(href|src)="[a-zA-Z0-9\/\:\-\.]+\.(jpg|js|css|png|gif|svg|html|ico|json|less|sass|scss|swf|txt|webp|woff|woff2|xls|xlsx|xml|xsl|xslt|zip|rar|csv|doc|docx|eps|gzip|jpe|jpeg|manifest|mov|mp3|flac|mp4|ogg|package|pdf)"/gi;
const REG_MULTIPART = /\/form\-data$/i;
const REG_COMPILECSS = /url\(.*?\)/g;
const REG_ROUTESTATIC = /^(\/\/|https\:|http\:)+/;
const REG_RANGE = /bytes=/;
const REG_EMPTY = /\s/g;
const REG_ACCEPTCLEANER = /\s|\./g;
const REG_SANITIZE_BACKSLASH = /\/\//g;
const REG_WEBSOCKET_ERROR = /ECONNRESET|EHOSTUNREACH|EPIPE|is closed/i;
const REG_WINDOWSPATH = /\\/g;
const REG_SCRIPTCONTENT = /\<|\>|;/;
const REG_HTTPHTTPS = /^(\/)?(http|https)\:\/\//i;
const REG_NOCOMPRESS = /[\.|-]+min\.(css|js)$/i;
const REG_TEXTAPPLICATION = /text|application/;
const REG_ENCODINGCLEANER = /[\;\s]charset=utf\-8/g;
const REQUEST_PROXY_FLAGS = ['post', 'json'];
const REQUEST_INSTALL_FLAGS = ['get'];
const REQUEST_DOWNLOAD_FLAGS = ['get', 'dnscache'];
const QUERYPARSEROPTIONS = { maxKeys: 69 };
const EMPTYARRAY = [];
const EMPTYOBJECT = {};
const EMPTYREQUEST = { uri: {} };
const SINGLETONS = {};
const REPOSITORY_HEAD = '$head';
const REPOSITORY_META = '$meta';
const REPOSITORY_COMPONENTS = '$components';
const REPOSITORY_META_TITLE = '$title';
const REPOSITORY_META_DESCRIPTION = '$description';
const REPOSITORY_META_KEYWORDS = '$keywords';
const REPOSITORY_META_AUTHOR = '$author';
const REPOSITORY_META_IMAGE = '$image';
const REPOSITORY_PLACE = '$place';
const REPOSITORY_SITEMAP = '$sitemap';
const ATTR_END = '"';
const ETAG = '858';

Object.freeze(EMPTYOBJECT);
Object.freeze(EMPTYARRAY);
Object.freeze(EMPTYREQUEST);

global.EMPTYOBJECT = EMPTYOBJECT;
global.EMPTYARRAY = EMPTYARRAY;

var RANGE = { start: 0, end: 0 };
var HEADERS = {};
var SUCCESSHELPER = { success: true };

// Cached headers for repeated usage
HEADERS['responseCode'] = {};
HEADERS['responseCode'][RESPONSE_HEADER_CONTENTTYPE] = CONTENTTYPE_TEXTPLAIN;
HEADERS['responseRedirect'] = {};
HEADERS['responseRedirect'][RESPONSE_HEADER_CONTENTTYPE] = CONTENTTYPE_TEXTHTML + '; charset=utf-8';
HEADERS['responseRedirect'][RESPONSE_HEADER_CONTENTLENGTH] = '0';
HEADERS['sse'] = {};
HEADERS['sse'][RESPONSE_HEADER_CACHECONTROL] = 'no-cache, no-store, must-revalidate';
HEADERS['sse']['Pragma'] = 'no-cache';
HEADERS['sse']['Expires'] = '0';
HEADERS['sse'][RESPONSE_HEADER_CONTENTTYPE] = 'text/event-stream';
HEADERS['sse']['X-Powered-By'] = 'Total.js';
HEADERS['mmr'] = {};
HEADERS['mmr'][RESPONSE_HEADER_CACHECONTROL] = 'no-cache, no-store, must-revalidate';
HEADERS['mmr']['Pragma'] = 'no-cache';
HEADERS['mmr']['Expires'] = '0';
HEADERS['mmr']['X-Powered-By'] = 'Total.js';
HEADERS['proxy'] = {};
HEADERS['proxy']['X-Proxy'] = 'total.js';
HEADERS['responseFile.lastmodified'] = {};;
HEADERS['responseFile.lastmodified']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseFile.lastmodified'][RESPONSE_HEADER_CACHECONTROL] = 'public, max-age=11111111';
HEADERS['responseFile.lastmodified']['X-Powered-By'] = 'Total.js';
HEADERS['responseFile.release.compress'] = {};
HEADERS['responseFile.release.compress'][RESPONSE_HEADER_CACHECONTROL] = 'public, max-age=11111111';
HEADERS['responseFile.release.compress']['Vary'] = 'Accept-Encoding';
HEADERS['responseFile.release.compress']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseFile.release.compress']['Last-Modified'] = 'Mon, 01 Jan 2001 08:00:00 GMT';
HEADERS['responseFile.release.compress']['Content-Encoding'] = 'gzip';
HEADERS['responseFile.release.compress']['X-Powered-By'] = 'Total.js';
HEADERS['responseFile.release.compress.range'] = {};
HEADERS['responseFile.release.compress.range']['Accept-Ranges'] = 'bytes';
HEADERS['responseFile.release.compress.range'][RESPONSE_HEADER_CACHECONTROL] = 'public, max-age=11111111';
HEADERS['responseFile.release.compress.range']['Vary'] = 'Accept-Encoding';
HEADERS['responseFile.release.compress.range']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseFile.release.compress.range']['Last-Modified'] = 'Mon, 01 Jan 2001 08:00:00 GMT';
HEADERS['responseFile.release.compress.range']['Content-Encoding'] = 'gzip';
HEADERS['responseFile.release.compress.range'][RESPONSE_HEADER_CONTENTLENGTH] = '0';
HEADERS['responseFile.release.compress.range']['Content-Range'] = '';
HEADERS['responseFile.release.compress.range']['X-Powered-By'] = 'Total.js';
HEADERS['responseFile.release'] = {};
HEADERS['responseFile.release'][RESPONSE_HEADER_CACHECONTROL] = 'public, max-age=11111111';
HEADERS['responseFile.release']['Vary'] = 'Accept-Encoding';
HEADERS['responseFile.release']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseFile.release']['Last-Modified'] = 'Mon, 01 Jan 2001 08:00:00 GMT';
HEADERS['responseFile.release']['X-Powered-By'] = 'Total.js';
HEADERS['responseFile.release.range'] = {};
HEADERS['responseFile.release.range']['Accept-Ranges'] = 'bytes';
HEADERS['responseFile.release.range'][RESPONSE_HEADER_CACHECONTROL] = 'public, max-age=11111111';
HEADERS['responseFile.release.range']['Vary'] = 'Accept-Encoding';
HEADERS['responseFile.release.range']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseFile.release.range']['Last-Modified'] = 'Mon, 01 Jan 2001 08:00:00 GMT';
HEADERS['responseFile.release.range'][RESPONSE_HEADER_CONTENTLENGTH] = '0';
HEADERS['responseFile.release.range']['Content-Range'] = '';
HEADERS['responseFile.release.range']['X-Powered-By'] = 'Total.js';
HEADERS['responseFile.debug.compress'] = {};
HEADERS['responseFile.debug.compress'][RESPONSE_HEADER_CACHECONTROL] = 'private, no-cache, no-store, must-revalidate';
HEADERS['responseFile.debug.compress']['Vary'] = 'Accept-Encoding';
HEADERS['responseFile.debug.compress']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseFile.debug.compress']['Pragma'] = 'no-cache';
HEADERS['responseFile.debug.compress']['Expires'] = '0';
HEADERS['responseFile.debug.compress']['Content-Encoding'] = 'gzip';
HEADERS['responseFile.debug.compress']['X-Powered-By'] = 'Total.js';
HEADERS['responseFile.debug.compress.range'] = {};
HEADERS['responseFile.debug.compress.range']['Accept-Ranges'] = 'bytes';
HEADERS['responseFile.debug.compress.range'][RESPONSE_HEADER_CACHECONTROL] = 'private, no-cache, no-store, must-revalidate';
HEADERS['responseFile.debug.compress.range']['Vary'] = 'Accept-Encoding';
HEADERS['responseFile.debug.compress.range']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseFile.debug.compress.range']['Content-Encoding'] = 'gzip';
HEADERS['responseFile.debug.compress.range']['Pragma'] = 'no-cache';
HEADERS['responseFile.debug.compress.range']['Expires'] = '0';
HEADERS['responseFile.debug.compress.range'][RESPONSE_HEADER_CONTENTLENGTH] = '0';
HEADERS['responseFile.debug.compress.range']['Content-Range'] = '';
HEADERS['responseFile.debug.compress.range']['X-Powered-By'] = 'Total.js';
HEADERS['responseFile.debug'] = {};
HEADERS['responseFile.debug'][RESPONSE_HEADER_CACHECONTROL] = 'private, no-cache, no-store, must-revalidate';
HEADERS['responseFile.debug']['Vary'] = 'Accept-Encoding';
HEADERS['responseFile.debug']['Pragma'] = 'no-cache';
HEADERS['responseFile.debug']['Expires'] = '0';
HEADERS['responseFile.debug']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseFile.debug']['X-Powered-By'] = 'Total.js';
HEADERS['responseFile.debug.range'] = {};
HEADERS['responseFile.debug.range']['Accept-Ranges'] = 'bytes';
HEADERS['responseFile.debug.range'][RESPONSE_HEADER_CACHECONTROL] = 'private, no-cache, no-store, must-revalidate';
HEADERS['responseFile.debug.range']['Vary'] = 'Accept-Encoding';
HEADERS['responseFile.debug.range']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseFile.debug.range']['Pragma'] = 'no-cache';
HEADERS['responseFile.debug.range']['Expires'] = '0';
HEADERS['responseFile.debug.range'][RESPONSE_HEADER_CONTENTLENGTH] = '0';
HEADERS['responseFile.debug.range']['Content-Range'] = '';
HEADERS['responseFile.debug.range']['X-Powered-By'] = 'Total.js';
HEADERS['responseContent.mobile.compress'] = {};
HEADERS['responseContent.mobile.compress']['Vary'] = 'Accept-Encoding, User-Agent';
HEADERS['responseContent.mobile.compress']['Content-Encoding'] = 'gzip';
HEADERS['responseContent.mobile'] = {};
HEADERS['responseContent.mobile']['Vary'] = 'Accept-Encoding, User-Agent';
HEADERS['responseContent.mobile']['X-Powered-By'] = 'Total.js';
HEADERS['responseContent.compress'] = {};
HEADERS['responseContent.compress'][RESPONSE_HEADER_CACHECONTROL] = 'private';
HEADERS['responseContent.compress']['Vary'] = 'Accept-Encoding';
HEADERS['responseContent.compress']['Content-Encoding'] = 'gzip';
HEADERS['responseContent.compress']['X-Powered-By'] = 'Total.js';
HEADERS['responseContent'] = {};
HEADERS['responseContent']['Vary'] = 'Accept-Encoding';
HEADERS['responseContent']['X-Powered-By'] = 'Total.js';
HEADERS['responseStream.release.compress'] = {};
HEADERS['responseStream.release.compress'][RESPONSE_HEADER_CACHECONTROL] = 'public, max-age=11111111';
HEADERS['responseStream.release.compress']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseStream.release.compress']['Content-Encoding'] = 'gzip';
HEADERS['responseStream.release.compress']['X-Powered-By'] = 'Total.js';
HEADERS['responseStream.release'] = {};
HEADERS['responseStream.release'][RESPONSE_HEADER_CACHECONTROL] = 'public, max-age=11111111';
HEADERS['responseStream.release']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseStream.release']['X-Powered-By'] = 'Total.js';
HEADERS['responseStream.debug.compress'] = {};
HEADERS['responseStream.debug.compress'][RESPONSE_HEADER_CACHECONTROL] = 'private, no-cache, no-store, must-revalidate';
HEADERS['responseStream.debug.compress']['Pragma'] = 'no-cache';
HEADERS['responseStream.debug.compress']['Expires'] = '0';
HEADERS['responseStream.debug.compress']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseStream.debug.compress']['Content-Encoding'] = 'gzip';
HEADERS['responseStream.debug.compress']['X-Powered-By'] = 'Total.js';
HEADERS['responseStream.debug'] = {};
HEADERS['responseStream.debug'][RESPONSE_HEADER_CACHECONTROL] = 'private, no-cache, no-store, must-revalidate';
HEADERS['responseStream.debug']['Pragma'] = 'no-cache';
HEADERS['responseStream.debug']['Expires'] = '0';
HEADERS['responseStream.debug']['Access-Control-Allow-Origin'] = '*';
HEADERS['responseStream.debug']['X-Powered-By'] = 'Total.js';
HEADERS['responseBinary.compress'] = {};
HEADERS['responseBinary.compress'][RESPONSE_HEADER_CACHECONTROL] = 'public';
HEADERS['responseBinary.compress']['Content-Encoding'] = 'gzip';
HEADERS['responseBinary.compress']['X-Powered-By'] = 'Total.js';
HEADERS['responseBinary'] = {};
HEADERS['responseBinary'][RESPONSE_HEADER_CACHECONTROL] = 'public';
HEADERS['responseBinary']['X-Powered-By'] = 'Total.js';
HEADERS.redirect = { 'Location': '' };
HEADERS.authorization = { user: '', password: '', empty: true };
HEADERS.fsStreamRead = { flags: 'r', mode: '0666', autoClose: true }
HEADERS.fsStreamReadRange = { flags: 'r', mode: '0666', autoClose: true, start: 0, end: 0 };
HEADERS.workers = { cwd: '' };
HEADERS.mmrpipe = { end: false };
HEADERS['responseLocalize'] = {};
HEADERS['responseNotModified'] = {};
HEADERS['responseNotModified'][RESPONSE_HEADER_CACHECONTROL] = 'public, max-age=11111111';

Object.freeze(HEADERS.authorization);

var IMAGEMAGICK = false;
var _controller = '';
var _owner = '';
var _test;
var _flags;

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
	global.framework_image = require('./image');

if (!global.framework_nosql)
	global.framework_nosql = require('./nosql');

global.Builders = framework_builders;
var utils = U = global.Utils = global.utils = global.U = global.framework_utils;
global.Mail = framework_mail;

global.WTF = function(message, name, uri) {
	return F.problem(message, name, uri);
};

global.INCLUDE = global.SOURCE = function(name, options) {
	return F.source(name, options);
};

global.MODULE = function(name) {
	return F.module(name);
};

global.NOSQL = function(name) {
	return F.nosql(name);
};

global.NOBIN = function(name) {
	return F.nosql(name).binary;
};

global.NOCOUNTER = function(name) {
	return F.nosql(name).counter;
};

global.NOMEM = global.NOSQLMEMORY = function(name, view) {
	return global.framework_nosql.inmemory(name, view);
};

global.DB = global.DATABASE = function() {
	return typeof(F.database) === 'object' ? F.database : F.database.apply(framework, arguments);
};

global.CONFIG = function(name) {
	return F.config[name];
};

global.UPTODATE = function(type, url, options, interval, callback) {
	return F.uptodate(type, url, options, interval, callback);
};

global.INSTALL = function(type, name, declaration, options, callback) {
	return F.install(type, name, declaration, options, callback);
};

global.UNINSTALL = function(type, name, options) {
	return F.uninstall(type, name, options);
};

global.RESOURCE = function(name, key) {
	return F.resource(name, key);
};

global.TRANSLATE = function(name, key) {
	return F.translate(name, key);
};

global.TRANSLATOR = function(name, text) {
	return F.translator(name, text);
};

global.LOG = function() {
	return F.log.apply(F, arguments);
};

global.TRACE = function(message, name, uri, ip) {
	return F.trace(message, name, uri, ip);
};

global.LOGGER = function() {
	return F.logger.apply(F, arguments);
};

global.MODEL = function(name) {
	return F.model(name);
};

global.$$$ = global.GETSCHEMA = function(group, name, fn, timeout) {
	return framework_builders.getschema(group, name, fn, timeout);
};

global.CREATE = function(group, name) {
	return framework_builders.getschema(group, name).default();
};

global.SCRIPT = function(body, value, callback) {
	return F.script(body, value, callback);
};

global.UID = function() {
	var plus = UIDGENERATOR.index % 2 ? 1 : 0;
	return UIDGENERATOR.date + (UIDGENERATOR.index++).padLeft(4, '0') + UIDGENERATOR.instance + plus;
};

global.MAKE = global.TRANSFORM = function(transform, fn) {

	if (typeof(transform) === 'function') {
		var tmp = fn;
		fn = transform;
		transform = tmp;
	}

	var obj;

	if (typeof(fn) === 'function') {
		obj = {};
		fn.call(obj, obj);
	} else
		obj = fn;

	return transform ? TransformBuilder.transform.apply(obj, arguments) : obj;
};

global.SINGLETON = function(name, def) {
	return SINGLETONS[name] || (SINGLETONS[name] = (new Function('return ' + (def || '{}')))());
};

global.NEWTRANSFORM = function(name, fn, isDefault) {
	return TransformBuilder.addTransform.apply(this, arguments);
};

global.NEWSCHEMA = function(group, name) {
	if (!name) {
		name = group;
		group = 'default';
	}
	return framework_builders.newschema(group, name);
};

global.EACHSCHEMA = function(group, fn) {
	return framework_builders.eachschema(group, fn);
};

global.FUNCTION = function(name) {
	return F.functions[name];
};

global.ROUTING = function(name) {
	return F.routing(name);
};

global.SCHEDULE = function(date, each, fn) {
	return F.schedule(date, each, fn);
};

global.FINISHED = function(stream, callback) {
	framework_internal.onFinished(stream, callback);
};

global.DESTROY = function(stream) {
	framework_internal.destroyStream(stream);
};

global.CLEANUP = function(stream, callback) {

	var fn = function() {
		FINISHED(stream, function() {
			DESTROY(stream);
			if (callback) {
				callback();
				callback = null;
			}
		});
	};

	stream.on('error', fn);

	if (stream.readable)
		stream.on('end', fn);
	else
		stream.on('finish', fn);
};

global.SUCCESS = function(success, value) {

	if (typeof(success) === 'function') {
		return function(err, value) {
			success(err, SUCCESS(err, value));
		};
	}

	var err;

	if (success instanceof Error) {
		err = success;
		success = false;
	} else if (success instanceof framework_builders.ErrorBuilder) {
		if (success.hasError()) {
			err = success.output();
			success = false;
		} else
			success = true;
	} else if (success == null)
		success = true;

	SUCCESSHELPER.success = success ? true : false;
	SUCCESSHELPER.value = value == null ? undefined : value;
	SUCCESSHELPER.error = err ? err : undefined;
	return SUCCESSHELPER;
};

global.TRY = function(fn, err) {
	try {
		fn();
		return true;
	} catch (e) {
		err && err(e);
		return false;
	}
};

global.OBSOLETE = function(name, message) {
	console.log(F.datetime.format('yyyy-MM-dd HH:mm:ss') + ' :: OBSOLETE / IMPORTANT ---> "' + name + '"', message);
	if (global.F)
		F.stats.other.obsolete++;
};

global.DEBUG = false;
global.TEST = false;
global.RELEASE = false;
global.is_client = false;
global.is_server = true;

var directory = U.$normalize(require.main ? Path.dirname(require.main.filename) : process.cwd());

// F._service() changes the values below:
var DATE_EXPIRES = new Date().add('y', 1).toUTCString();

const UIDGENERATOR = { date: new Date().format('yyMMddHHmm'), instance: 'abcdefghijklmnoprstuwxy'.split('').random().join('').substring(0, 3), index: 1 };
const EMPTYBUFFER = U.createBufferSize(0);
global.EMPTYBUFFER = EMPTYBUFFER;

const controller_error_status = function(controller, status, problem) {

	if (status !== 500 && problem)
		controller.problem(problem);

	if (controller.res.success || controller.res.headersSent || !controller.isConnected)
		return controller;

	controller.precache && controller.precache(null, null, null);
	controller.req.path = EMPTYARRAY;
	controller.subscribe.success();
	controller.subscribe.route = F.lookup(controller.req, '#' + status, EMPTYARRAY, 0);
	controller.subscribe.exception = problem;
	controller.subscribe.execute(status, true);
	return controller;
};

function Framework() {

	this.id = null;
	this.version = 2400;
	this.version_header = '2.4.0';
	this.version_node = process.version.toString().replace('v', '').replace(/\./g, '').parseFloat();

	this.config = {

		debug: false,
		trace: true,
		'trace-console': true,

		name: 'Total.js',
		version: '1.0.0',
		author: '',
		secret: Os.hostname() + '-' + Os.platform() + '-' + Os.arch(),

		'default-xpoweredby': 'Total.js',
		'etag-version': '',
		'directory-controllers': '/controllers/',
		'directory-components': '/components/',
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
		'directory-themes': '/themes/',

		// all HTTP static request are routed to directory-public
		'static-url': '',
		'static-url-script': '/js/',
		'static-url-style': '/css/',
		'static-url-image': '/img/',
		'static-url-video': '/video/',
		'static-url-font': '/fonts/',
		'static-url-download': '/download/',
		'static-url-components': '/components.',
		'static-accepts': { 'flac': true, 'jpg': true, 'png': true, 'gif': true, 'ico': true, 'js': true, 'css': true, 'txt': true, 'xml': true, 'woff': true, 'woff2': true, 'otf': true, 'ttf': true, 'eot': true, 'svg': true, 'zip': true, 'rar': true, 'pdf': true, 'docx': true, 'xlsx': true, 'doc': true, 'xls': true, 'html': true, 'htm': true, 'appcache': true, 'manifest': true, 'map': true, 'ogv': true, 'ogg': true, 'mp4': true, 'mp3': true, 'webp': true, 'webm': true, 'swf': true, 'package': true, 'json': true, 'md': true, 'm4v': true, 'jsx': true },

		// 'static-accepts-custom': [],

		'default-layout': 'layout',
		'default-theme': '',

		// default maximum request size / length
		// default 10 kB
		'default-request-length': 10,
		'default-websocket-request-length': 2,
		'default-websocket-encodedecode': true,
		'default-maximum-file-descriptors': 0,
		'default-timezone': '',
		'default-root': '',
		'default-response-maxage': '11111111',

		// Seconds (2 minutes)
		'default-cors-maxage': 120,

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
		'allow-cache-snapshot': false,
		'disable-strict-server-certificate-validation': true,
		'disable-clear-temporary-directory': false,

		// Used in F._service()
		// All values are in minutes
		'default-interval-clear-resources': 20,
		'default-interval-clear-cache': 10,
		'default-interval-precompile-views': 61,
		'default-interval-websocket-ping': 3,
		'default-interval-clear-dnscache': 120,
		'default-interval-uptodate': 5
	};

	this.global = {};
	this.resources = {};
	this.connections = {};
	this.functions = {};
	this.themes = {};
	this.versions = null;
	this.workflows = {};
	this.uptodates = null;
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
		cors: [],
		websockets: [],
		middleware: {},
		redirects: {},
		resize: {},
		request: [],
		views: {},
		merge: {},
		mapping: {},
		packages: {},
		blocks: {},
		resources: {},
		mmr: {}
	};

	this.owners = [];
	this.modificators = null;
	this.helpers = {};
	this.modules = {};
	this.models = {};
	this.sources = {};
	this.controllers = {};
	this.dependencies = {};
	this.isomorphic = {};
	this.components = { has: false, css: false, js: false, views: {}, instances: {}, version: null };
	this.convertors = [];
	this.tests = [];
	this.errors = [];
	this.problems = [];
	this.changes = [];
	this.server = null;
	this.port = 0;
	this.ip = '';

	this.validators = {
		email: new RegExp('^[a-zA-Z0-9-_.+]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'),
		url: /^(http|https):\/\/(?:(?:(?:[\w\.\-\+!$&'\(\)*\+,;=]|%[0-9a-f]{2})+:)*(?:[\w\.\-\+%!$&'\(\)*\+,;=]|%[0-9a-f]{2})+@)?(?:(?:[a-z0-9\-\.]|%[0-9a-f]{2})+|(?:\[(?:[0-9a-f]{0,4}:)*(?:[0-9a-f]{0,4})\]))(?::[0-9]+)?(?:[\/|\?](?:[\w#!:\.\?\+=&@!$'~*,;\/\(\)\[\]\-]|%[0-9a-f]{2})*)?$/i,
		phone: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im,
		zip: /^\d{5}(?:[-\s]\d{4})?$/,
		uid: /^\d{14,}[a-z]{3}[01]{1}$/
	};

	this.workers = {};
	this.databases = {};
	this.directory = HEADERS.workers.cwd = directory;
	this.isLE = Os.endianness ? Os.endianness() === 'LE' : true;
	this.isHTTPS = false;
	this.datetime = new Date();

	// It's hidden
	// this.waits = {};

	this.temporary = {
		path: {},
		notfound: {},
		processing: {},
		range: {},
		views: {},
		versions: {},
		dependencies: {}, // temporary for module dependencies
		other: {},
		internal: {} // controllers/modules names for the routing
	};

	this.stats = {

		other: {
			websocketPing: 0,
			websocketCleaner: 0,
			obsolete: 0,
			restart: 0,
			mail: 0
		},

		request: {
			request: 0,
			pending: 0,
			web: 0,
			xhr: 0,
			file: 0,
			websocket: 0,
			get: 0,
			options: 0,
			head: 0,
			post: 0,
			put: 0,
			path: 0,
			upload: 0,
			schema: 0,
			mmr: 0,
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
			image: 0,
			destroy: 0,
			stream: 0,
			streaming: 0,
			plain: 0,
			empty: 0,
			redirect: 0,
			forward: 0,
			notModified: 0,
			sse: 0,
			mmr: 0,
			errorBuilder: 0,
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
	this.path = new FrameworkPath();

	this._request_check_redirect = false;
	this._request_check_referer = false;
	this._request_check_POST = false;
	this._request_check_robot = false;
	this._length_middleware = 0;
	this._length_request_middleware = 0;
	this._length_files = 0;
	this._length_wait = 0;
	this._length_themes = 0;
	this._length_cors = 0;
	this._length_subdomain_web = 0;
	this._length_subdomain_websocket = 0;
	this._length_convertors = 0;

	this.isVirtualDirectory = false;
	this.isTheme = false;
	this.isWindows = Os.platform().substring(0, 3).toLowerCase() === 'win';
}

// ======================================================
// PROTOTYPES
// ======================================================

Framework.prototype = {
	get onLocate() {
		return this.onLocale;
	},
	set onLocate(value) {
		OBSOLETE('F.onLocate', 'Rename "F.onLocate" method for "F.onLocale".');
		this.onLocale = value;
	}
}

Framework.prototype.__proto__ = Object.create(Events.EventEmitter.prototype, {
	constructor: {
		value: WebSocket,
		enumberable: false
	}
});

/**
 * Internal function
 * @return {String} Returns current (dependency type and name) owner.
 */
Framework.prototype.$owner = function() {
	return _owner;
};

Framework.prototype.behaviour = function(url, flags) {
	OBSOLETE('F.behaviour()', 'This functionality has been removed.');
	return F;
};

Framework.prototype.isSuccess = function(obj) {
	return obj === SUCCESSHELPER;
};

Framework.prototype.convert = function(value, convertor) {

	if (convertor) {
		if (F.convertors.findIndex('name', value) !== -1)
			return false;

		if (convertor === Number)
			convertor = U.parseFloat;
		else if (convertor === Boolean)
			convertor = U.parseBoolean;
		else if (typeof(convertor) === 'string') {
			switch (convertor.toLowerCase()) {
				case 'json':
					convertor = U.parseJSON;
					break;
				case 'float':
				case 'number':
				case 'double':
					convertor = U.parseFloat;
					break;
				case 'int':
				case 'integer':
					convertor = U.parseInt2;
					break;
				default:
					return console.log('F.convert unknown convertor type:', convertor);
			}
		}

		F.convertors.push({ name: value, convertor: convertor });
		F._length_convertors = F.convertors.length;
		return true;
	}

	for (var i = 0, length = F.convertors.length; i < length; i++) {
		if (value[F.convertors[i].name])
			value[F.convertors[i].name] = F.convertors[i].convertor(value[F.convertors[i].name]);
	}

	return value;
};

/**
 * Get a controller
 * @param {String} name
 * @return {Object}
 */
Framework.prototype.controller = function(name) {
	return F.controllers[name] || null;
};

/**
 * Use configuration
 * @param {String} filename
 * @return {Framework}
 */
Framework.prototype.useConfig = function(name) {
	return F._configure(name, true);
};

/**
 * Sort all routes
 * @return {Framework}
 */
Framework.prototype.$routesSort = function(type) {

	F.routes.web.sort(function(a, b) {
		return a.priority > b.priority ? -1 : a.priority < b.priority ? 1 : 0;
	});

	F.routes.websockets.sort(function(a, b) {
		return a.priority > b.priority ? -1 : a.priority < b.priority ? 1 : 0;
	});

	var cache = {};
	var length = F.routes.web.length;
	var url;

	for (var i = 0; i < length; i++) {
		var route = F.routes.web[i];
		var name = F.temporary.internal[route.controller];
		if (name)
			route.controller = name;
		if (!route.isMOBILE || route.isUPLOAD || route.isXHR || route.isJSON || route.isSYSTEM || route.isXML || route.flags.indexOf('get') === -1)
			continue;
		url = route.url.join('/');
		cache[url] = true;
	}

	for (var i = 0; i < length; i++) {
		var route = F.routes.web[i];
		if (route.isMOBILE || route.isUPLOAD || route.isXHR || route.isJSON || route.isSYSTEM || route.isXML || route.flags.indexOf('get') === -1)
			continue;
		url = route.url.join('/');
		route.isMOBILE_VARY = cache[url] === true;
	}

	(!type || type === 1) && F.routes.web.forEach(function(route) {
		var tmp = F.routes.web.findItem(function(item) {
			return item.hash === route.hash && item !== route;
		});
		route.isUNIQUE = tmp == null;
	});

	// Clears cache
	Object.keys(F.temporary.other).forEach(function(key) {
		if (key[0] === '#')
			F.temporary.other[key] = undefined;
	});

	return F;
};

Framework.prototype.script = function(body, value, callback) {

	var fn;
	var compilation = value === undefined && callback === undefined;

	try {
		fn = new Function('next', 'value', 'now', 'var model=value;var global,require,process,GLOBAL,root,clearImmediate,clearInterval,clearTimeout,setImmediate,setInterval,setTimeout,console,$STRING,$VIEWCACHE,framework_internal,TransformBuilder,Pagination,Page,URLBuilder,UrlBuilder,SchemaBuilder,framework_builders,framework_utils,framework_mail,Image,framework_image,framework_nosql,Builders,U,utils,Utils,Mail,WTF,SOURCE,INCLUDE,MODULE,NOSQL,NOBIN,NOCOUNTER,NOSQLMEMORY,NOMEM,DATABASE,DB,CONFIG,INSTALL,UNINSTALL,RESOURCE,TRANSLATOR,LOG,LOGGER,MODEL,GETSCHEMA,CREATE,UID,TRANSFORM,MAKE,SINGLETON,NEWTRANSFORM,NEWSCHEMA,EACHSCHEMA,FUNCTION,ROUTING,SCHEDULE,OBSOLETE,DEBUG,TEST,RELEASE,is_client,is_server,F,framework,Controller,setTimeout2,clearTimeout2,String,Number,Boolean,Object,Function,Date,isomorphic,I,eval;UPTODATE,NEWOPERATION,OPERATION,$$$;try{' + body + '}catch(e){next(e)}');
	} catch(e) {
		callback && callback(e);
		return compilation ? null : F;
	}

	if (compilation) {
		return (function() {
			return function(model, callback) {
				return fn.call(EMPTYOBJECT, function(value) {
					if (value instanceof Error)
						callback(value);
					else
						callback(null, value);
				}, model, F.datetime);
			};
		})();
	}

	fn.call(EMPTYOBJECT, function(value) {

		if (!callback)
			return;

		if (value instanceof Error)
			callback(value);
		else
			callback(null, value);

	}, value, F.datetime);

	return F;
};

Framework.prototype.database = function(name) {
	return F.nosql(name);
};

Framework.prototype.nosql = function(name) {
	var db = F.databases[name];
	if (db)
		return db;
	F.path.verify('databases');
	db = framework_nosql.load(name, F.path.databases(name));
	F.databases[name] = db;
	return db;
};

Framework.prototype.stop = Framework.prototype.kill = function(signal) {

	for (var m in F.workers) {
		var worker = F.workers[m];
		TRY(() => worker && worker.kill && worker.kill(signal || 'SIGTERM'));
	}

	F.emit('exit', signal);

	if (!F.isWorker && typeof(process.send) === 'function')
		TRY(() => process.send('stop'));

	F.cache.stop();
	F.server && F.server.close();

	setTimeout(() => process.exit(signal || 'SIGTERM'), TEST ? 2000 : 100);
	return F;
};


Framework.prototype.redirect = function(host, newHost, withPath, permanent) {

	var external = host.startsWith('http://') || host.startsWith('https');
	if (external) {

		if (host[host.length - 1] === '/')
			host = host.substring(0, host.length - 1);

		if (newHost[newHost.length - 1] === '/')
			newHost = newHost.substring(0, newHost.length - 1);

		F.routes.redirects[host] = { url: newHost, path: withPath, permanent: permanent };
		F._request_check_redirect = true;
		F.owners.push({ type: 'redirects', owner: _owner, id: host });
		return F;
	}

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

	if (U.isStaticFile(host)) {
		F.file(host, function(req, res) {
			if (newHost.startsWith('http://') || newHost.startsWith('https://'))
				res.redirect(newHost, permanent);
			else
				res.redirect(newHost[0] !== '/' ? '/' + newHost : newHost, permanent);
		});
		return F;
	}

	F.route(host, function() {

		if (newHost.startsWith('http://') || newHost.startsWith('https://')) {
			this.redirect(newHost + this.href(), permanent);
			return;
		}

		if (newHost[0] !== '/')
			newHost = '/' + newHost;

		this.redirect(newHost + this.href(), permanent);
	}, flags);

	return F;
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

	var type = typeof(date);

	if (type === 'string')
		date = date.parseDate();
	else if (type === 'number')
		date = new Date(date);

	var sum = date.getTime();

	if (repeat)
		repeat = repeat.replace('each', '1');

	F.schedules.push({ expire: sum, fn: fn, repeat: repeat, owner: _owner });
	return F;
};

/**
 * Auto resize picture according the path
 * @param {String} url Relative path.
 * @param {Function(image)} fn Processing.
 * @param {String Array} flags Optional, can contains extensions `.jpg`, `.gif' or watching path `/img/gallery/`
 * @return {Framework}
 */
Framework.prototype.resize = function(url, fn, flags) {

	var extensions = {};
	var cache = true;

	if (typeof(flags) === 'function') {
		var tmp = flags;
		flags = fn;
		fn = tmp;
	}

	var ext = url.match(/\*.\*$|\*?\.(jpg|png|gif|jpeg)$/gi);
	if (ext) {
		url = url.replace(ext, '');
		switch (ext.toString().toLowerCase()) {
			case '*.*':
				extensions['*'] = true;
				break;
			case '*.jpg':
			case '*.gif':
			case '*.png':
			case '*.jpeg':
				extensions[ext.toString().toLowerCase().replace(/\*/g, '').substring(1)] = true;
				break;
		}
	}

	var path = url;

	if (flags && flags.length) {
		for (var i = 0, length = flags.length; i < length; i++) {
			var flag = flags[i];
			if (flag[0] === '.')
				extensions[flag.substring(1)] = true;
			else if (flag[0] === '~' || flag[0] === '/' || flag.match(/^http\:|https\:/gi))
				path = flag;
			else if (flag === 'nocache')
				cache = false;
		}
	}

	if (!extensions.length) {
		extensions['jpg'] = true;
		extensions['jpeg'] = true;
		extensions['png'] = true;
		extensions['gif'] = true;
	}

	if (extensions['jpg'] && !extensions['jpeg'])
		extensions['jpeg'] = true;
	else if (extensions['jpeg'] && !extensions['jpg'])
		extensions['jpg'] = true;

	F.routes.resize[url] = { fn: fn, path: U.path(path || url), ishttp: path.match(/http\:|https\:/gi) ? true : false, extension: extensions, cache: cache };
	F.owners.push({ type: 'resize', owner: _owner, id: url });
	return F;
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

	var tmp;

	if (onQuery) {
		tmp = [];
		flags && tmp.push.apply(tmp, flags);
		F.route(url, tmp, onQuery);
	}

	var restful = U.path(url) + '{id}';

	if (onGet) {
		tmp = [];
		flags && tmp.push.apply(tmp, flags);
		F.route(restful, tmp, onGet);
	}

	if (onSave) {
		tmp = ['post'];
		flags && tmp.push.apply(tmp, flags);
		F.route(url, tmp, onSave);
		tmp = ['put'];
		flags && tmp.push.apply(tmp, flags);
		F.route(restful, tmp, onSave);
	}

	if (onDelete) {
		tmp = ['delete'];
		flags && tmp.push.apply(tmp, flags);
		F.route(restful, tmp, onDelete);
	}

	return F;
};

/**
 * Register cors
 * @param {String} url
 * @param {String Array or String} origin
 * @param {String Array or String} methods
 * @param {String Array or String} headers
 * @param {Boolean} credentials
 * @return {Framework}
 */
Framework.prototype.cors = function(url, flags, credentials) {

	var route = {};
	var origins = [];
	var methods = [];
	var headers = [];
	var age;

	if (flags instanceof Array) {
		for (var i = 0, length = flags.length; i < length; i++) {
			var flag = flags[i];
			var type = typeof(flag);

			if (type === 'string')
				flag = flag.toLowerCase();
			else if (type === 'number') {
				age = flag;
				continue;
			}

			if (type === 'boolean' || flag.startsWith('credential')) {
				credentials = true;
				continue;
			}

			if (flag.startsWith('http://') || flag.startsWith('https://')) {
				origins.push(flag);
				continue;
			}

			switch (flag) {
				case 'post':
				case 'put':
				case 'delete':
				case 'options':
				case 'patch':
				case 'head':
				case 'get':
					methods.push(flag.toUpperCase());
					break;
				default:
					headers.push(flags[i]);
					break;
			}
		}
	}

	route.isASTERIX = url.lastIndexOf('*') !== -1;

	if (route.isASTERIX)
		url = url.replace('*', '');

	url = framework_internal.preparePath(framework_internal.encodeUnicodeURL(url.trim()));

	route.hash = url.hash();
	route.owner = _owner;
	route.url = framework_internal.routeSplitCreate(url);
	route.origins = origins.length ? origins : null;
	route.methods = methods.length ? methods : null;
	route.headers = headers.length ? headers : null;
	route.credentials = credentials;
	route.age = age || F.config['default-cors-maxage'];

	F.routes.cors.push(route);
	F._length_cors = F.routes.cors.length;

	F.routes.cors.sort(function(a, b) {
		var al = a.url.length;
		var bl = b.url.length;
		return al > bl ? - 1 : al < bl ? 1 : a.isASTERIX && b.isASTERIX ? 1 : 0;
	});

	return F;
};

Framework.prototype.group = function(flags, fn) {
	_flags = flags;
	fn.call(this);
	_flags = undefined;
	return this;
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
Framework.prototype.web = Framework.prototype.route = function(url, funcExecute, flags, length, language) {

	var name;
	var tmp;
	var viewname;
	var sitemap;
	var sitemap_language = language !== undefined;

	if (url instanceof Array) {
		url.forEach(url => F.route(url, funcExecute, flags, length));
		return F;
	}

	var CUSTOM = typeof(url) === 'function' ? url : null;
	if (CUSTOM)
		url = '/';

	if (url[0] === '#') {
		url = url.substring(1);
		if (url !== '400' && url !== '401' && url !== '403' && url !== '404' && url !== '408' && url !== '431' && url !== '500' && url !== '501') {

			var sitemapflags = funcExecute instanceof Array ? funcExecute : flags;
			if (!(sitemapflags instanceof Array))
				sitemapflags = EMPTYARRAY;

			sitemap = F.sitemap(url, true, language);
			if (sitemap) {

				name = url;
				url = sitemap.url;
				if (sitemap.wildcard)
					url += '*';

				if (sitemap.localizeUrl) {
					if (language === undefined) {
						sitemap_language = true;
						var sitemaproutes = {};
						F.temporary.internal.resources.forEach(function(language) {
							var item = F.sitemap(sitemap.id, true, language);
							if (item.url && item.url !== url)
								sitemaproutes[item.url] = { name: sitemap.id, language: language };
						});

						Object.keys(sitemaproutes).forEach(key => F.route('#' + sitemap.id, funcExecute, flags, length, sitemaproutes[key].language));
					}
				}

			} else
				throw new Error('Sitemap item "' + url + '" not found.');
		} else
			url = '#' + url;
	}

	if (!url)
		url = '/';

	if (url[0] !== '[' && url[0] !== '/')
		url = '/' + url;

	if (url.endsWith('/'))
		url = url.substring(0, url.length - 1);

	url = framework_internal.encodeUnicodeURL(url);

	var type = typeof(funcExecute);
	var index = 0;
	var urlcache = url;

	if (!name)
		name = url;

	if (type === 'object' || funcExecute instanceof Array) {
		tmp = funcExecute;
		funcExecute = flags;
		flags = tmp;
	}

	var priority = 0;
	var subdomain = null;

	priority = url.count('/');

	if (url[0] === '[') {
		index = url.indexOf(']');
		if (index > 0) {
			subdomain = url.substring(1, index).trim().toLowerCase().split(',');
			url = url.substring(index + 1);
			priority += subdomain.indexOf('*') !== -1 ? 50 : 100;
		}
	}

	var isASTERIX = url.indexOf('*') !== -1;
	if (isASTERIX) {
		url = url.replace('*', '').replace('//', '/');
		priority = priority - 100;
	}

	var isRaw = false;
	var isNOXHR = false;
	var method = '';
	var schema;
	var workflow;
	var isMOBILE = false;
	var isJSON = false;
	var isDELAY = false;
	var isROBOT = false;
	var isBINARY = false;
	var isCORS = false;
	var isROLE = false;
	var middleware = null;
	var timeout;
	var options;
	var corsflags = [];
	var membertype = 0;
	var isGENERATOR = false;
	var description;

	if (_flags) {
		if (!flags)
			flags = [];
		_flags.forEach(function(flag) {
			flags.indexOf(flag) === -1 && flags.push(flag);
		});
	}

	if (flags) {

		tmp = [];
		var count = 0;

		for (var i = 0; i < flags.length; i++) {

			var tt = typeof(flags[i]);

			if (tt === 'number') {
				timeout = flags[i];
				continue;
			}

			if (tt === 'object') {
				options = flags[i];
				continue;
			}

			var first = flags[i][0];

			if (first === '&') {
				// resource (sitemap localization)
				// doesn't used now
				continue;
			}

			// TODO: remove in future versions
			if (first === '%') {
				F.behaviour();
				continue;
			}

			if (first === '#') {
				if (!middleware)
					middleware = [];
				middleware.push(flags[i].substring(1));
				continue;
			}

			if (first === '*') {

				workflow = flags[i].trim().substring(1);
				index = workflow.indexOf('-->');

				if (index !== -1) {
					schema = workflow.substring(0, index).trim();
					workflow = workflow.substring(index + 3).trim();
				} else {
					schema = workflow;
					workflow = null;
				}
				schema = schema.replace(/\\/g, '/').split('/');

				if (schema.length === 1) {
					schema[1] = schema[0];
					schema[0] = 'default';
				}

				index = schema[1].indexOf('#');
				if (index !== -1) {
					schema[2] = schema[1].substring(index + 1).trim();
					schema[1] = schema[1].substring(0, index).trim();
				}

				continue;
			}

			// Comment
			if (flags[i].substring(0, 3) === '// ') {
				description = flags[i].substring(3).trim();
				continue;
			}

			var flag = flags[i].toString().toLowerCase();

			if (flag.startsWith('http://') || flag.startsWith('https://')) {
				corsflags.push(flag);
				continue;
			}

			count++;

			switch (flag) {

				case 'json':
					isJSON = true;
					continue;

				case 'delay':
					count--;
					isDELAY = true;
					continue;

				case 'binary':
					isBINARY = true;
					continue;

				case 'cors':
					isCORS = true;
					count--;
					continue;

				case 'credential':
				case 'credentials':
					corsflags.push(flag);
					count--;
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
					break;
				case 'robot':
					isROBOT = true;
					F._request_check_robot = true;
					break;
				case 'authorize':
				case 'authorized':
				case 'logged':
					membertype = 1;
					priority += 2;
					tmp.push('authorize');
					break;
				case 'unauthorize':
				case 'unauthorized':
				case 'unlogged':
					membertype = 2;
					priority += 2;
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
					corsflags.push(flag);
					break;
				default:
					if (flag[0] === '@')
						isROLE = true;
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

	if (type === 'string') {
		viewname = funcExecute;
		funcExecute = (function(name, sitemap, language) {
			if (language && !this.language)
				this.language = language;
			var themeName = U.parseTheme(name);
			if (themeName)
				name = prepare_viewname(name);
			return function() {
				sitemap && this.sitemap(sitemap.id, language);
				if (name[0] === '~')
					this.themeName = '';
				else if (themeName)
					this.themeName = themeName;

				if (!this.route.workflow)
					return this.view(name);
				var self = this;
				this.$exec(this.route.workflow, this, function(err, response) {
					if (err)
						self.content(err);
					else
						self.view(name, response);
				});
			};
		})(viewname, sitemap, language);
	} else if (typeof(funcExecute) !== 'function') {

		viewname = (sitemap && sitemap.url !== '/' ? sitemap.id : workflow ? '' : url) || '';

		if (!workflow || (!viewname && !workflow)) {
			if (viewname.endsWith('/'))
				viewname = viewname.substring(0, viewname.length - 1);

			index = viewname.lastIndexOf('/');
			if (index !== -1)
				viewname = viewname.substring(index + 1);

			if (!viewname || viewname === '/')
				viewname = 'index';

			funcExecute = (function(name, sitemap, language) {
				return function() {
					if (language && !this.language)
						this.language = language;
					sitemap && this.sitemap(sitemap.id, language);
					name[0] === '~' && this.theme('');
					if (!this.route.workflow)
						return this.view(name);
					var self = this;
					this.$exec(this.route.workflow, this, function(err, response) {
						if (err)
							self.content(err);
						else
							self.view(name, response);
					});
				};
			})(viewname, sitemap, language);
		} else if (workflow)
			funcExecute = controller_json_workflow;
	}

	if (!isGENERATOR)
		isGENERATOR = (funcExecute.constructor.name === 'GeneratorFunction' || funcExecute.toString().indexOf('function*') === 0);

	var url2 = framework_internal.preparePath(url.trim());
	var urlraw = U.path(url2) + (isASTERIX ? '*' : '');
	var hash = url2.hash();
	var routeURL = framework_internal.routeSplitCreate(url2);
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
		F._request_check_referer = true;

	if (!F._request_check_POST && (flags.indexOf('delete') !== -1 || flags.indexOf('post') !== -1 || flags.indexOf('put') !== -1 || flags.indexOf('upload') !== -1 || flags.indexOf('json') !== -1 || flags.indexOf('patch') !== -1 || flags.indexOf('options') !== -1))
		F._request_check_POST = true;

	var isMULTIPLE = false;

	if (method.indexOf(',') !== -1)
		isMULTIPLE = true;

	if (method.indexOf(',') !== -1 || method === '')
		method = undefined;
	else
		method = method.toUpperCase();

	if (name[1] === '#')
		name = name.substring(1);

	if (isBINARY && !isRaw) {
		isBINARY = false;
		console.warn('F.route() skips "binary" flag because the "raw" flag is not defined.');
	}

	if (subdomain)
		F._length_subdomain_web++;

	F.routes.web.push({
		hash: hash,
		name: name,
		priority: priority,
		sitemap: sitemap ? sitemap.id : '',
		schema: schema,
		workflow: workflow,
		subdomain: subdomain,
		description: description,
		controller: _controller ? _controller : 'unknown',
		owner: _owner,
		urlraw: urlraw,
		url: routeURL,
		param: arr,
		flags: flags || EMPTYARRAY,
		flags2: flags_to_object(flags),
		method: method,
		execute: funcExecute,
		length: (length || F.config['default-request-length']) * 1024,
		middleware: middleware,
		timeout: timeout === undefined ? (isDELAY ? 0 : F.config['default-request-timeout']) : timeout,
		isGET: flags.indexOf('get') !== -1,
		isMULTIPLE: isMULTIPLE,
		isJSON: isJSON,
		isXML: flags.indexOf('xml') !== -1,
		isRAW: isRaw,
		isBINARY: isBINARY,
		isMOBILE: isMOBILE,
		isROBOT: isROBOT,
		isMOBILE_VARY: isMOBILE,
		isGENERATOR: isGENERATOR,
		MEMBER: membertype,
		isASTERIX: isASTERIX,
		isROLE: isROLE,
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

	F.emit('route', 'web', F.routes.web[F.routes.web.length - 1]);

	// Appends cors route
	isCORS && F.cors(urlcache, corsflags);
	!_controller && F.$routesSort(1);

	return F;
};

function flags_to_object(flags) {
	var obj = {};
	flags.forEach(function(flag) {
		obj[flag] = true;
	});
	return obj;
}

Framework.prototype.mmr = function(url, process) {
	url = framework_internal.preparePath(U.path(url));
	F.routes.mmr[url] = { exec: process };
	F._request_check_POST = true;
	return F;
};

/**
 * Get routing by name
 * @param {String} name
 * @return {Object}
 */
Framework.prototype.routing = function(name) {
	for (var i = 0, length = F.routes.web.length; i < length; i++) {
		var route = F.routes.web[i];
		if (route.name === name) {
			var url = U.path(route.url.join('/'));
			if (url[0] !== '/')
				url = '/' + url;
			return { controller: route.controller, url: url, id: route.id, flags: route.flags, middleware: route.middleware, execute: route.execute, timeout: route.timeout, options: route.options, length: route.length };
		}
	}
};

/**
 * Merge files
 * @param {String} url Relative URL.
 * @param {String/String Array} file1 Filename or URL.
 * @param {String/String Array} file2 Filename or URL.
 * @param {String/String Array} file3 Filename or URL.
 * @param {String/String Array} fileN Filename or URL.
 * @return {Framework}
 */
Framework.prototype.merge = function(url) {

	var arr = [];

	for (var i = 1, length = arguments.length; i < length; i++) {

		var items = arguments[i];
		if (!(items instanceof Array))
			items = [items];

		for (var j = 0, lengthsub = items.length; j < lengthsub; j++) {
			var fn = items[j];
			var c = fn[0];
			if (c === '@')
				fn = '~' + F.path.package(fn.substring(1));
			else if (c === '=')
				fn = '~' + F.path.themes(fn.substring(1));
			else if (c === '#')
				fn = '~' + F.path.temp('isomorphic_' + fn.substring(1) + '.min.js');
			arr.push(fn);
		}
	}

	url = framework_internal.preparePath(F._version(url));

	if (url[0] !== '/')
		url = '/' + url;

	var filename = F.path.temp((F.id ? 'i-' + F.id + '_' : '') + 'merged_' + createTemporaryKey(url));
	F.routes.merge[url] = { filename: filename.replace(/\.(js|css)/g, ext => '.min' + ext), files: arr };
	Fs.unlink(F.routes.merge[url].filename, NOOP);
	F.owners.push({ type: 'merge', owner: _owner, id: url });
	return F;
};

Framework.prototype.mapping = function(url, path) {
	return F.map.apply(F, arguments);
};

/**
 * Send message
 * @param  {Object} message
 * @param  {Object} handle
 * @return {Framework}
 */
Framework.prototype.send = function(message, handle) {
	process.send(message, handle);
	return F;
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

	filename = U.$normalize(filename);
	url = framework_internal.preparePath(F._version(url));

	// isomorphic
	if (filename[0] === '#') {
		F.owners.push({ type: 'mapping', owner: _owner, id: url });
		F.routes.mapping[url] = F.path.temp('isomorphic_' + filename.substring(1) + '.min.js');
		return F;
	}

	var index = filename.indexOf('#');
	var block;

	if (index !== -1) {
		var tmp = filename.split('#');
		filename = tmp[0];
		block = tmp[1];
	}

	var c = filename[0];

	// package
	if (c === '@') {
		filename = F.path.package(filename.substring(1));
		isPackage = true;
	} else if (c === '=') {
		if (F.isWindows)
			filename = U.combine(F.config['directory-themes'], filename.substring(1));
		else
			filename = F.path.themes(filename.substring(1));
		isPackage = true;
	}

	var isFile = U.getExtension(filename).length > 0;

	// Checks if the directory exists
	if (!isPackage && !filename.startsWith(directory)) {
		var tmp = filename[0] === '~' ? F.path.root(filename.substring(1)) : F.path.public(filename);
		if (existsSync(tmp))
			filename = tmp;
	}

	if (isFile) {
		F.routes.mapping[url] = filename;
		F.owners.push({ type: 'mapping', owner: _owner, id: url });
		if (block) {
			F.owners.push({ type: 'blocks', owner: _owner, id: url });
			F.routes.blocks[url] = block;
		}
		return F;
	}

	url = U.path(url);
	filename = U.path(filename);

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
		for (var i = 0, length = filter.length; i < length; i++) {
			if (filter[i][0] === '.')
				filter[i] = filter[i].substring(1);
			filter[i] = filter[i].toLowerCase();
		}
	}

	setTimeout(function() {
		U.ls(F.isWindows ? filename.replace(/\//g, '\\') : filename, function(files) {
			for (var i = 0, length = files.length; i < length; i++) {

				if (F.isWindows)
					files[i] = files[i].replace(filename, '').replace(/\\/g, '/');

				var file = files[i].replace(replace, '');

				if (filter) {
					if (typeof(filter) === 'function') {
						if (!filter(file))
							continue;
					} else {
						if (filter.indexOf(U.getExtension(file).toLowerCase()) === -1)
							continue;
					}
				}

				if (file[0] === '/')
					file = file.substring(1);

				var key = url + file;
				F.routes.mapping[key] = plus + files[i];
				F.owners.push({ type: 'mapping', owner: _owner, id: key });

				if (block) {
					F.owners.push({ type: 'blocks', owner: _owner, id: key });
					F.routes.blocks[key] = block;
				}
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
	F.install('middleware', name, funcExecute);
	_owner && F.owners.push({ type: 'middleware', owner: _owner, id: name });
	return F;
};

/**
 * Uses middleware
 * @name {String or String Array} name
 * @url {String} url A url address (optional)
 * @types {String Array} It can be `web`, `file` or `websocket`
 * @first {Boolean} Optional, add a middleware as first
 * @return {Framework}
 */
Framework.prototype.use = function(name, url, types, first) {
	if (!url && !types) {
		if (name instanceof Array) {
			for (var i = 0; i < name.length; i++)
				F.routes.request.push(name[i]);
		} else
			F.routes.request.push(name);
		F._length_request_middleware = F.routes.request.length;
		return F;
	}

	if (url instanceof Array) {
		types = url;
		url = null;
	}

	if (url === '*')
		url = null;

	var route;

	if (url)
		url = framework_internal.routeSplitCreate(framework_internal.preparePath(url.trim())).join('/');

	if (!types || types.indexOf('web') !== -1) {
		for (var i = 0, length = F.routes.web.length; i < length; i++) {
			route = F.routes.web[i];
			if (url && !route.url.join('/').startsWith(url))
				continue;
			if (!route.middleware)
				route.middleware = [];
			merge_middleware(route.middleware, name, first);
		}
	}

	if (!types || types.indexOf('file') !== -1 || types.indexOf('files') !== -1) {
		for (var i = 0, length = F.routes.files.length; i < length; i++) {
			route = F.routes.files[i];
			if (url && !route.url.join('/').startsWith(url))
				continue;
			if (!route.middleware)
				route.middleware = [];
			merge_middleware(route.middleware, name, first);
		}
	}

	if (!types || types.indexOf('websocket') !== -1 || types.indexOf('websockets') !== -1) {
		for (var i = 0, length = F.routes.websockets.length; i < length; i++) {
			route = F.routes.websockets[i];
			if (url && !route.url.join('/').startsWith(url))
				continue;
			if (!route.middleware)
				route.middleware = [];
			merge_middleware(route.middleware, name, first);
		}
	}

	return F;
};

function merge_middleware(a, b, first) {

	if (typeof(b) === 'string')
		b = [b];

	for (var i = 0, length = b.length; i < length; i++) {
		var index = a.indexOf(b[i]);
		if (index === -1) {
			if (first)
				a.unshift(b[i]);
			else
				a.push(b[i]);
		}
	}

	return a;
}

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
Framework.prototype.websocket = function(url, funcInitialize, flags, length) {

	var tmp;

	var CUSTOM = typeof(url) === 'function' ? url : null;
	if (CUSTOM)
		url = '/';

	if (url[0] === '#') {
		url = url.substring(1);
		var sitemap = F.sitemap(url, true);
		if (sitemap) {
			url = sitemap.url;
			if (sitemap.wildcard)
				url += '*';
		} else
			throw new Error('Sitemap item "' + url + '" not found.');
	}

	if (url === '')
		url = '/';

	// Unicode encoding
	url = framework_internal.encodeUnicodeURL(url);

	var priority = 0;
	var index = url.indexOf(']');
	var subdomain = null;
	var middleware;
	var allow;
	var options;
	var protocols;

	priority = url.count('/');

	if (index > 0) {
		subdomain = url.substring(1, index).trim().toLowerCase().split(',');
		url = url.substring(index + 1);
		priority += subdomain.indexOf('*') !== -1 ? 50 : 100;
	}

	var isASTERIX = url.indexOf('*') !== -1;
	if (isASTERIX) {
		url = url.replace('*', '').replace('//', '/');
		priority = (-10) - priority;
	}

	var url2 = framework_internal.preparePath(url.trim());
	var routeURL = framework_internal.routeSplitCreate(url2);
	var arr = [];
	var reg = null;
	var regIndex = null;
	var hash = url2.hash();

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

	if (typeof(allow) === 'string')
		allow = allow[allow];

	if (typeof(protocols) === 'string')
		protocols = protocols[protocols];

	tmp = [];

	var isJSON = false;
	var isBINARY = false;
	var isROLE = false;
	var count = 0;
	var membertype = 0;

	if (!flags)
		flags = [];

	_flags && _flags.forEach(function(flag) {
		if (flags.indexOf(flag) === -1)
			flags.push(flag);
	});

	for (var i = 0; i < flags.length; i++) {

		var flag = flags[i];
		var type = typeof(flag);

		// Middleware options
		if (type === 'object') {
			options = flags[i];
			continue;
		}

		// Length
		if (type === 'number') {
			length = flag;
			continue;
		}

		// Middleware
		if (flag[0] === '#') {
			if (!middleware)
				middleware = [];
			middleware.push(flags[i].substring(1));
			continue;
		}

		flag = flag.toString().toLowerCase();

		// Origins
		if (flag.startsWith('http://') || flag.startsWith('https://')) {
			if (!allow)
				allow = [];
			allow.push(flag);
			continue;
		}

		count++;

		if (flag === 'json')
			isJSON = true;

		if (flag === 'binary')
			isBINARY = true;

		if (flag === 'raw') {
			isBINARY = false;
			isJSON = false;
		}


		if (flag[0] === '@') {
			isROLE = true;
			tmp.push(flag);
			continue;
		}

		if (flag === 'json' || flag === 'binary' || flag === 'raw')
			continue;

		switch (flag) {
			case 'authorize':
			case 'authorized':
			case 'logged':
				membertype = 1;
				priority++;
				tmp.push('authorize');
				break;
			case 'unauthorize':
			case 'unauthorized':
			case 'unlogged':
				membertype = 2;
				priority++;
				tmp.push('unauthorize');
				break;
			case 'get':
			case 'http':
			case 'https':
			case 'debug':
			case 'release':
				tmp.push(flag);
				break;
			default:
				if (!protocols)
					protocols = [];
				protocols.push(flag);
				break;
		}
	}

	flags = tmp;

	flags.indexOf('get') === -1 && flags.unshift('get');
	priority += (count * 2);

	if (subdomain)
		F._length_subdomain_websocket++;

	F.routes.websockets.push({
		hash: hash,
		controller: _controller ? _controller : 'unknown',
		owner: _owner,
		url: routeURL,
		param: arr,
		subdomain: subdomain,
		priority: priority,
		flags: flags || EMPTYARRAY,
		flags2: flags_to_object(flags),
		onInitialize: funcInitialize,
		protocols: protocols || EMPTYARRAY,
		allow: allow || [],
		length: (length || F.config['default-websocket-request-length']) * 1024,
		isWEBSOCKET: true,
		MEMBER: membertype,
		isJSON: isJSON,
		isBINARY: isBINARY,
		isROLE: isROLE,
		isASTERIX: isASTERIX,
		isHTTPS: flags.indexOf('https'),
		isHTTP: flags.indexOf('http'),
		isDEBUG: flags.indexOf('debug'),
		isRELEASE: flags.indexOf('release'),
		CUSTOM: CUSTOM,
		middleware: middleware ? middleware : null,
		options: options,
		isPARAM: arr.length > 0,
		regexp: reg,
		regexpIndexer: regIndex
	});

	F.emit('route', 'websocket', F.routes.websockets[F.routes.websockets.length - 1]);
	!_controller && F.$routesSort(2);
	return F;
};

/**
 * Create a file route
 * @param {String} name
 * @param {Function} funcValidation
 * @param {Function} fnExecute
 * @param {String Array} middleware
 * @return {Framework}
 */
Framework.prototype.file = function(fnValidation, fnExecute, flags) {

	var a;

	if (fnValidation instanceof Array) {
		a = fnExecute;
		var b = flags;
		flags = fnValidation;
		fnValidation = a;
		fnExecute = b;
	} else if (fnExecute instanceof Array) {
		a = fnExecute;
		fnExecute = flags;
		flags = a;
	}

	if (!fnExecute && fnValidation) {
		fnExecute = fnValidation;
		fnValidation = undefined;
	}

	var extensions;
	var middleware;
	var options;
	var url;
	var wildcard = false;
	var fixedfile = false;

	if (_flags) {
		if (!flags)
			flags = [];
		_flags.forEach(function(flag) {
			flags.indexOf(flag) === -1 && flags.push(flag);
		});
	}

	if (flags) {
		for (var i = 0, length = flags.length; i < length; i++) {
			var flag = flags[i];

			if (typeof(flag) === 'object') {
				options = flag;
				continue;
			}

			if (flag[0] === '#') {
				if (!middleware)
					middleware = [];
				middleware.push(flag.substring(1));
			}

			if (flag[0] === '.') {
				flag = flag.substring(1).toLowerCase();
				if (!extensions)
					extensions = {};
				extensions[flag] = true;
			}
		}
	}

	if (typeof(fnValidation) === 'string') {

		if (fnValidation === '/')
			fnValidation = '';

		url = fnValidation ? framework_internal.routeSplitCreate(fnValidation) : EMPTYARRAY;
		fnValidation = undefined;
		a = url.last();
		if (a === '*.*') {
			wildcard = true;
			url.splice(url.length - 1, 1);
		} else if (a) {
			var index = a.indexOf('*.');
			if (index !== -1) {
				extensions = {};
				extensions[a.substring(index + 2).trim()] = true;
				wildcard = false;
				url.splice(url.length - 1, 1);
			} else if (a === '*') {
				wildcard = true;
				url.splice(url.length - 1, 1);
			} else if (U.getExtension(a)) {
				fixedfile = true;
				wildcard = false;
			}
		}
	} else if (!extensions && !fnValidation)
		fnValidation = fnExecute;


	F.routes.files.push({
		controller: _controller ? _controller : 'unknown',
		owner: _owner,
		url: url,
		fixedfile: fixedfile,
		wildcard: wildcard,
		extensions: extensions,
		onValidate: fnValidation,
		execute: fnExecute,
		middleware: middleware,
		options: options
	});

	F.routes.files.sort(function(a, b) {
		return !a.url ? -1 : !b.url ? 1 : a.url.length > b.url.length ? -1 : 1;
	});

	F.emit('route', 'file', F.routes.files[F.routes.files.length - 1]);
	F._length_files++;
	return F;
};

Framework.prototype.localize = function(url, flags, minify) {

	url = url.replace('*', '');

	if (flags === true) {
		flags = [];
		minify = true;
	} else if (!flags)
		flags = [];

	var index;

	if (!minify) {
		index = flags.indexOf('minify');
		if (index === -1)
			index = flags.indexOf('compress');
		minify = index !== -1;
		index !== -1 && flags.splice(index, 1);
	}

	var index = url.lastIndexOf('.');

	if (index === -1)
		flags.push('.html', '.htm', '.md', '.txt');
	else {
		flags.push(url.substring(index).toLowerCase());
		url = url.substring(0, index);
	}

	url = framework_internal.preparePath(url);
	F.file(url, function(req, res, is) {

		var key = 'locate_' + (req.$language ? req.$language : 'default') + '_' + req.url;
		var output = F.temporary.other[key];

		if (output) {
			if (!F.$notModified(req, res, output.$mtime)) {
				HEADERS.responseLocalize['Last-Modified'] = output.$mtime;
				F.responseContent(req, res, 200, output, U.getContentType(req.extension), true);
			}
			return;
		}

		var name = req.uri.pathname;
		var filename = F.onMapping(name, name, true, true);

		Fs.readFile(filename, function(err, content) {

			if (err)
				return res.throw404();

			content = F.translator(req.$language, framework_internal.modificators(content.toString(ENCODING), filename, 'static'));

			Fs.lstat(filename, function(err, stats) {

				var mtime = stats.mtime.toUTCString();

				if (minify && (req.extension === 'html' || req.extension === 'htm'))
					content = framework_internal.compile_html(content, filename);

				if (RELEASE) {
					F.temporary.other[key] = U.createBuffer(content);
					F.temporary.other[key].$mtime = mtime;
					if (F.$notModified(req, res, mtime))
						return;
				}

				HEADERS.responseLocalize['Last-Modified'] = mtime;
				F.responseContent(req, res, 200, content, U.getContentType(req.extension), true, HEADERS.responseLocalize);
			});
		});

	}, flags);
	return F;
};

Framework.prototype.$notModified = function(req, res, date) {
	if (date === req.headers['if-modified-since']) {
		HEADERS.responseNotModified['Last-Modified'] = date;
		res.success = true;
		res.writeHead(304, HEADERS.responseNotModified);
		res.end();
		F.stats.response.notModified++;
		F._request_stats(false, req.isStaticFile);
		return true;
	}
};

/**
 * Error caller
 * @param {Error} err
 * @param {String} name Controller or Script name.
 * @param {Object} uri
 * @return {Framework}
 */
Framework.prototype.error = function(err, name, uri) {

	if (!arguments.length) {
		return function(err) {
			err && F.error(err, name, uri);
		};
	}

	if (!err)
		return F;

	if (F.errors) {
		F.datetime = new Date();
		F.errors.push({ error: err.stack, name: name, url: uri ? typeof(uri) === 'string' ? uri : Parser.format(uri) : undefined, date: F.datetime });
		F.errors.length > 50 && F.errors.shift();
	}

	F.onError(err, name, uri);
	return F;
};

/**
 * Registers a new problem
 * @param {String} message
 * @param {String} name A controller name.
 * @param {String} uri
 * @param {String} ip
 * @return {Framework}
 */
Framework.prototype.problem = Framework.prototype.wtf = function(message, name, uri, ip) {
	F.emit('problem', message, name, uri, ip);

	if (message instanceof framework_builders.ErrorBuilder)
		message = message.plain();
	else if (typeof(message) === 'object')
		message = JSON.stringify(message);

	var obj = { message: message, name: name, url: uri ? typeof(uri) === 'string' ? uri : Parser.format(uri) : undefined, ip: ip };
	F.logger('problems', obj.message, 'url: ' + obj.url, 'source: ' + obj.name, 'ip: ' + obj.ip);

	if (F.problems) {
		F.problems.push(obj);
		F.problems.length > 50 && F.problems.shift();
	}

	return F;
};

/**
 * Registers a new change
 * @param {String} message
 * @param {String} name A controller name.
 * @param {String} uri
 * @param {String} ip
 * @return {Framework}
 */
Framework.prototype.change = function(message, name, uri, ip) {
	F.emit('change', message, name, uri, ip);

	if (message instanceof framework_builders.ErrorBuilder)
		message = message.plain();
	else if (typeof(message) === 'object')
		message = JSON.stringify(message);

	var obj = { message: message, name: name, url: uri ? typeof(uri) === 'string' ? uri : Parser.format(uri) : undefined, ip: ip };
	F.logger('changes', obj.message, 'url: ' + obj.url, 'source: ' + obj.name, 'ip: ' + obj.ip);

	if (F.changes) {
		F.changes.push(obj);
		F.changes.length > 50 && F.changes.shift();
	}

	return F;
};

/**
 * Trace
 * @param {String} message
 * @param {String} name A controller name.
 * @param {String} uri
 * @param {String} ip
 * @return {Framework}
 */
Framework.prototype.trace = function(message, name, uri, ip) {

	if (!F.config.trace)
		return F;

	F.emit('trace', message, name, uri, ip);

	if (message instanceof framework_builders.ErrorBuilder)
		message = message.plain();
	else if (typeof(message) === 'object')
		message = JSON.stringify(message);

	F.datetime = new Date();
	var obj = { message: message, name: name, url: uri ? typeof(uri) === 'string' ? uri : Parser.format(uri) : undefined, ip: ip, date: F.datetime };
	F.logger('traces', obj.message, 'url: ' + obj.url, 'source: ' + obj.name, 'ip: ' + obj.ip);

	F.config['trace-console'] && console.log(F.datetime.format('yyyy-MM-dd HH:mm:ss'), '[trace]', message, '|', 'url: ' + obj.url, 'source: ' + obj.name, 'ip: ' + obj.ip);

	if (F.traces) {
		F.traces.push(obj);
		F.traces.length > 50 && F.traces.shift();
	}

	return F;
};

/**
 * Get a module
 * @param {String} name
 * @return {Object}
 */
Framework.prototype.module = function(name) {
	return F.modules[name] || null;
};

/**
 * Add a new modificator
 * @param {Function(type, filename, content)} fn The `fn` must return modified value.
 * @return {String}
 */
Framework.prototype.modify = function(fn) {
	if (!F.modificators)
		F.modificators = [];
	F.modificators.push(fn);
	fn.$owner = owner;
	return F;
};

/**
 * Load framework
 * @return {Framework}
 */
Framework.prototype.$load = function(types, targetdirectory) {

	var arr = [];
	var dir = '';

	if (!targetdirectory)
		targetdirectory = directory;

	targetdirectory = '~' + targetdirectory;

	function listing(directory, level, output, extension, isTheme) {

		if (!existsSync(dir))
			return;

		if (!extension)
			extension = '.js';

		Fs.readdirSync(directory).forEach(function(o) {
			var isDirectory = Fs.statSync(Path.join(directory, o)).isDirectory();

			if (isDirectory && isTheme) {
				output.push({ name: o });
				return;
			}

			if (isDirectory) {

				if (extension === '.package' && o.endsWith(extension)) {
					var name = o.substring(0, o.length - extension.length);
					output.push({ name: name[0] === '/' ? name.substring(1) : name, filename: Path.join(dir, o), is: true });
					return;
				}

				level++;
				listing(Path.join(directory, o), level, output, extension);
				return;
			}

			var ext = U.getExtension(o).toLowerCase();
			if (ext)
				ext = '.' + ext;
			if (ext !== extension)
				return;
			var name = (level ? U.$normalize(directory).replace(dir, '') + '/' : '') + o.substring(0, o.length - ext.length);
			output.push({ name: name[0] === '/' ? name.substring(1) : name, filename: Path.join(dir, name) + extension });
		});
	}

	try {
		// Reads name of resources
		F.temporary.internal.resources = Fs.readdirSync(F.path.resources()).map(n => n.substring(0, n.lastIndexOf('.')));
	} catch (e) {
		F.temporary.internal.resources = [];
	}

	if (!types || types.indexOf('modules') !== -1) {
		dir = U.combine(targetdirectory, F.config['directory-modules']);
		arr = [];
		listing(dir, 0, arr, '.js');
		arr.forEach((item) => F.install('module', item.name, item.filename, undefined, undefined, undefined, true));
	}

	if (!types || types.indexOf('isomorphic') !== -1) {
		dir = U.combine(targetdirectory, F.config['directory-isomorphic']);
		arr = [];
		listing(dir, 0, arr, '.js');
		arr.forEach((item) => F.install('isomorphic', item.name, item.filename, undefined, undefined, undefined, true));
	}

	if (!types || types.indexOf('packages') !== -1) {
		dir = U.combine(targetdirectory, F.config['directory-packages']);
		arr = [];
		listing(dir, 0, arr, '.package');

		var dirtmp = U.$normalize(dir);

		arr.forEach(function(item) {

			if (item.is) {
				U.ls(item.filename, function(files, directories) {

					var dir = F.path.temp(item.name) + '.package';

					if (!existsSync(dir))
						Fs.mkdirSync(dir);

					for (var i = 0, length = directories.length; i < length; i++) {
						var target = F.path.temp(U.$normalize(directories[i]).replace(dirtmp, '') + '/');
						if (!existsSync(target))
							Fs.mkdirSync(target);
					}

					files.wait(function(filename, next) {
						var stream = Fs.createReadStream(filename);
						stream.pipe(Fs.createWriteStream(Path.join(dir, filename.replace(item.filename, '').replace(/\.package$/i, ''))));
						stream.on('end', next);
					}, function() {
						// Windows sometimes doesn't load package and delay solves the problem.
						setTimeout(() => F.install('package2', item.name, item.filename, undefined, undefined, undefined, true), 50);
					});
				});
				return;
			}

			F.install('package', item.name, item.filename, undefined, undefined, undefined, true);
		});
	}

	if (!types || types.indexOf('models') !== -1) {
		dir = U.combine(targetdirectory, F.config['directory-models']);
		arr = [];
		listing(dir, 0, arr);
		arr.forEach((item) => F.install('model', item.name, item.filename, undefined, undefined, undefined, true));
	}

	if (!types || types.indexOf('themes') !== -1) {
		arr = [];
		dir = U.combine(targetdirectory, F.config['directory-themes']);
		listing(dir, 0, arr, undefined, true);
		arr.forEach(function(item) {
			var themeName = item.name;
			var themeDirectory = Path.join(dir, themeName);
			var filename = Path.join(themeDirectory, 'index.js');
			F.themes[item.name] = U.path(themeDirectory);
			F._length_themes++;
			existsSync(filename) && F.install('theme', item.name, filename, undefined, undefined, undefined, true);
			/*
			@TODO: FOR FUTURE VERSION
			var components = [];
			var components_dir = U.combine(targetdirectory, F.config['directory-themes'], themeName, F.config['directory-components']);
			existsSync(components_dir) && listing(components_dir, 0, components, '.html', true);
			components_dir && components.forEach((item) => F.install('component', themeName + '/' + item.name, item.filename, undefined, undefined, undefined));
			*/
		});
	}

	if (!types || types.indexOf('definitions') !== -1) {
		dir = U.combine(targetdirectory, F.config['directory-definitions']);
		arr = [];
		listing(dir, 0, arr);
		arr.forEach((item) => F.install('definition', item.name, item.filename, undefined, undefined, undefined, true));
	}

	if (!types || types.indexOf('controllers') !== -1) {
		arr = [];
		dir = U.combine(targetdirectory, F.config['directory-controllers']);
		listing(dir, 0, arr);
		arr.forEach((item) => F.install('controller', item.name, item.filename, undefined, undefined, undefined, true));
	}

	if (!types || types.indexOf('components') !== -1) {
		arr = [];
		dir = U.combine(targetdirectory, F.config['directory-components']);
		listing(dir, 0, arr, '.html');
		arr.forEach((item) => F.install('component', item.name, item.filename, undefined, undefined, undefined));
	}

	F.$routesSort();

	if (!types || types.indexOf('dependencies') !== -1)
		F._configure_dependencies();

	return F;
};

Framework.prototype.$startup = function(callback) {

	var dir = Path.join(directory, '/startup/');

	if (!existsSync(dir))
		return callback();

	var run = [];

	Fs.readdirSync(dir).forEach(function(o) {
		var extension = U.getExtension(o).toLowerCase();
		if (extension === 'js')
			run.push(o);
	});

	if (!run.length)
		return callback();

	run.wait(function(filename, next) {
		var fn = dir + filename + new Date().format('yyMMdd_HHmmss');
		Fs.renameSync(dir + filename, fn);
		var fork = Child.fork(fn, [], { cwd: directory });
		fork.on('exit', function() {
			fork = null;
			next();
		});
	}, callback);

	return this;
};

Framework.prototype.uptodate = function(type, url, options, interval, callback) {

	if (typeof(options) === 'string' && typeof(interval) !== 'string') {
		interval = options;
		options = null;
	}

	var obj = { type: type, name: '', url: url, interval: interval, options: options, count: 0, updated: F.datetime, errors: [], callback: callback };

	if (!F.uptodates)
		F.uptodates = [];

	F.uptodates.push(obj);
	F.install(type, url, options, function(err, name) {
		err && obj.errors.push(err);
		obj.name = name;
		obj.callback && obj.callback(err, name);
	});
	return F;
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
 * @param {String} uptodateName Internal, optional.
 * @return {Framework}
 */
Framework.prototype.install = function(type, name, declaration, options, callback, internal, useRequired, skipEmit, uptodateName) {

	var obj = null;

	if (type !== 'config' && type !== 'version' && typeof(name) === 'string') {
		if (name.startsWith('http://') || name.startsWith('https://')) {
			if (typeof(declaration) === 'object') {
				callback = options;
				options = declaration;
				declaration = name;
				name = '';
			}
		} else if (name[0] === '@') {
			declaration = F.path.package(name.substring(1));
			name = Path.basename(name).replace(/\.js$/i, '');
			if (useRequired === undefined)
				useRequired = true;
		}
	}

	var t = typeof(declaration);
	var key = '';
	var tmp;
	var content;

	F.datetime = new Date();

	if (t === 'object') {
		t = typeof(options);
		if (t === 'function')
			callback = options;
		options = declaration;
		declaration = undefined;
	}

	if (declaration === undefined) {
		declaration = name;
		name = '';
	}

	if (typeof(options) === 'function') {
		callback = options;
		options = undefined;
	}

	// Check if declaration is a valid URL address
	if (type !== 'eval' && typeof(declaration) === 'string') {

		if (declaration.startsWith('http://') || declaration.startsWith('https://')) {
			if (type === 'package') {
				U.download(declaration, REQUEST_INSTALL_FLAGS, function(err, response) {

					if (err) {
						F.error(err, 'F.install(\'{0}\', \'{1}\')'.format(type, declaration), null);
						callback && callback(err);
						return;
					}

					var id = Path.basename(declaration, '.package');
					var filename = F.path.temp(id + '.download');
					var stream = Fs.createWriteStream(filename);
					var md5 = Crypto.createHash('md5');

					response.on('data', (buffer) => md5.update(buffer));
					response.pipe(stream);

					stream.on('finish', function() {
						var hash = md5.digest('hex');

						if (F.temporary.versions[declaration] === hash) {
							callback && callback(null, uptodateName || name, true);
							return;
						}

						F.temporary.versions[declaration] = hash;
						F.install(type, id, filename, options, callback, undefined, undefined, true, uptodateName);
					});
				});
				return F;
			}

			U.request(declaration, REQUEST_INSTALL_FLAGS, function(err, data, code) {

				if (code !== 200 && !err)
					err = new Error(data);

				if (err) {
					F.error(err, 'F.install(\'{0}\', \'{1}\')'.format(type, declaration), null);
					callback && callback(err);
				} else {

					var hash = data.hash('md5');

					if (F.temporary.versions[declaration] === hash) {
						callback && callback(null, uptodateName || name, true);
						return;
					}

					F.temporary.versions[declaration] = hash;
					F.install(type, name, data, options, callback, declaration, undefined, undefined, uptodateName);
				}

			});
			return F;
		} else {
			if (declaration[0] === '~')
				declaration = declaration.substring(1);
			if (type !== 'config' && type !== 'resource' && type !== 'package' && type !== 'component' && !REG_SCRIPTCONTENT.test(declaration)) {
				if (!existsSync(declaration))
					throw new Error('The ' + type + ': ' + declaration + ' doesn\'t exist.');
				useRequired = true;
			}
		}
	}

	if (type === 'middleware') {

		F.routes.middleware[name] = typeof(declaration) === 'function' ? declaration : eval(declaration);
		F._length_middleware = Object.keys(F.routes.middleware).length;

		callback && callback(null, name);

		key = type + '.' + name;

		if (F.dependencies[key]) {
			F.dependencies[key].updated = F.datetime;
		} else {
			F.dependencies[key] = { name: name, type: type, installed: F.datetime, updated: null, count: 0 };
			if (internal)
				F.dependencies[key].url = internal;
		}

		F.dependencies[key].count++;

		setTimeout(function() {
			F.emit(type + '#' + name);
			F.emit('install', type, name);
		}, 500);

		return F;
	}

	if (type === 'config' || type === 'configuration' || type === 'settings') {

		F._configure(declaration instanceof Array ? declaration : declaration.toString().split('\n'), true);
		setTimeout(function() {
			delete F.temporary['mail-settings'];
			F.emit(type + '#' + name, F.config);
			F.emit('install', type, name);
		}, 500);

		callback && callback(null, name);
		return F;
	}

	if (type === 'version' || type === 'versions') {

		F._configure_versions(declaration.toString().split('\n'));
		setTimeout(function() {
			F.emit(type + '#' + name);
			F.emit('install', type, name);
		}, 500);

		callback && callback(null, name);
		return F;
	}

	if (type === 'workflow' || type === 'workflows') {

		F._configure_workflows(declaration.toString().split('\n'));
		setTimeout(function() {
			F.emit(type + '#' + name);
			F.emit('install', type, name);
		}, 500);

		callback && callback(null, name);
		return F;
	}

	if (type === 'sitemap') {

		F._configure_sitemap(declaration.toString().split('\n'));
		setTimeout(function() {
			F.emit(type + '#' + name);
			F.emit('install', type, name);
		}, 500);

		callback && callback(null, name);
		return F;
	}

	if (type === 'component') {

		if (!name && internal)
			name = U.getName(internal).replace(/\.html/gi, '').trim();

		F.uninstall(type, uptodateName || name, uptodateName ? 'uptodate' : undefined);

		var hash = '\n/*' + name.hash() + '*/\n';
		var temporary = (F.id ? 'i-' + F.id + '_' : '') + 'components';
		content = parseComponent(internal ? declaration : Fs.readFileSync(declaration).toString(ENCODING), name);
		content.js && Fs.appendFileSync(F.path.temp(temporary + '.js'), hash + (F.config.debug ? component_debug(name, content.js, 'js') : content.js) + hash.substring(0, hash.length - 1));
		content.css && Fs.appendFileSync(F.path.temp(temporary + '.css'), hash + (F.config.debug ? component_debug(name, content.css, 'css') : content.css) + hash.substring(0, hash.length - 1));

		if (content.js)
			F.components.js = true;

		if (content.css)
			F.components.css = true;

		F.components.views[name] = '.' + F.path.temp('component_' + name);
		F.components.has = true;

		Fs.writeFile(F.components.views[name].substring(1) + '.html', U.minifyHTML(content.body), NOOP);

		var link = F.config['static-url-components'];
		F.components.version = F.datetime.getTime();
		F.components.links = (F.components.js ? '<script src="{0}js?version={1}"></script>'.format(link, F.components.version) : '') + (F.components.css ? '<link type="text/css" rel="stylesheet" href="{0}css?version={1}" />'.format(link, F.components.version) : '');

		if (content.install) {
			try {
				_owner = type + '#' + name;
				var obj = (new Function('var exports={};' + content.install + ';return exports;'))();
				obj.$owner = _owner;
				_controller = '';
				F.components.instances[name] = obj;
				obj = typeof(obj.install) === 'function' && obj.install(options || F.config[_owner], name);
			} catch(e) {
				F.error(e, 'F.install(\'component\', \'{0}\')'.format(name));
			}
		} else if (!internal) {
			var js = declaration.replace(/\.html$/i, '.js');
			if (existsSync(js)) {
				_owner = type + '#' + name;
				obj = require(js);
				obj.$owner = _owner;
				_controller = '';
				F.components.instances[name] = obj;
				typeof(obj.install) === 'function' && obj.install(options || F.config[_owner], name);
				(function(name, filename) {
					setTimeout(function() {
						delete require.cache[name];
					}, 1000);
				})(require.resolve(declaration), declaration);
			}
		}

		!skipEmit && setTimeout(function() {
			F.emit(type + '#' + name);
			F.emit('install', type, name);
		}, 500);

		callback && callback(null, name);
		return F;
	}

	if (type === 'package') {

		var backup = new Backup();
		var id = Path.basename(declaration, '.' + U.getExtension(declaration));
		var dir = F.config['directory-temp'][0] === '~' ? Path.join(F.config['directory-temp'].substring(1), id + '.package') : Path.join(F.path.root(), F.config['directory-temp'], id + '.package');

		F.routes.packages[id] = dir;
		backup.restore(declaration, dir, function() {

			var filename = Path.join(dir, 'index.js');
			if (!existsSync(filename)) {
				callback && callback(null, name);
				return;
			}

			F.install('module', id, filename, options, function(err) {

				setTimeout(function() {
					F.emit(type + '#' + name);
					F.emit('install', type, name);
				}, 500);

				callback && callback(err, name);
			}, internal, useRequired, true);
		});

		return F;
	}

	if (type === 'theme') {

		_owner = type + '#' + name;
		obj = require(declaration);
		obj.$owner = _owner;

		typeof(obj.install) === 'function' && obj.install(options || F.config[_owner], name);

		!skipEmit && setTimeout(function() {
			F.emit(type + '#' + name);
			F.emit('install', type, name);
		}, 500);

		callback && callback(null, name);

		(function(name, filename) {
			setTimeout(function() {
				delete require.cache[name];
			}, 1000);
		})(require.resolve(declaration), declaration);
		return F;
	}

	if (type === 'package2') {
		var id = U.getName(declaration, '.package');
		var dir = F.config['directory-temp'][0] === '~' ? Path.join(F.config['directory-temp'].substring(1), id) : Path.join(F.path.root(), F.config['directory-temp'], id);
		var filename = Path.join(dir, 'index.js');
		F.install('module', id, filename, options, function(err) {
			setTimeout(function() {
				F.emit(type + '#' + name);
				F.emit('install', type, name);
			}, 500);
			callback && callback(err, name);
		}, internal, useRequired, true);
		return F;
	}

	var plus = F.id ? 'i-' + F.id + '_' : '';

	if (type === 'view') {

		var item = F.routes.views[name];
		key = type + '.' + name;

		if (item === undefined) {
			item = {};
			item.filename = F.path.temporary(plus + 'installed-view-' + U.GUID(10) + '.tmp');
			item.url = internal;
			item.count = 0;
			F.routes.views[name] = item;
		}

		item.count++;
		Fs.writeFileSync(item.filename, framework_internal.modificators(declaration, name));

		setTimeout(function() {
			F.emit(type + '#' + name);
			F.emit('install', type, name);
		}, 500);

		callback && callback(null, name);
		return F;
	}

	if (type === 'definition' || type === 'eval') {

		_controller = '';
		_owner = type + '#' + name;

		try {

			if (useRequired) {
				delete require.cache[require.resolve(declaration)];
				obj = require(declaration);

				(function(name) {
					setTimeout(() => delete require.cache[name], 1000);
				})(require.resolve(declaration));
			}
			else
				obj = typeof(declaration) === 'function' ? eval('(' + declaration.toString() + ')()') : eval(declaration);

		} catch (ex) {
			F.error(ex, 'F.install(\'' + type + '\')', null);
			callback && callback(ex, name);
			return F;
		}

		callback && callback(null, name);

		setTimeout(function() {
			F.emit(type + '#' + name);
			F.emit('install', type, name);
		}, 500);

		return F;
	}

	if (type === 'isomorphic') {

		content = '';

		try {

			if (!name && typeof(internal) === 'string') {
				var tmp = internal.match(/[a-z0-9]+\.js$/i);
				if (tmp)
					name = tmp.toString().replace(/\.js/i, '');
			}

			if (useRequired) {
				delete require.cache[require.resolve(declaration)];
				obj = require(declaration);
				content = Fs.readFileSync(declaration).toString(ENCODING);
				(function(name) {
					setTimeout(() => delete require.cache[name], 1000);
				})(require.resolve(declaration));
			}
			else {
				obj = typeof(declaration) === 'function' ? eval('(' + declaration.toString() + ')()') : eval(declaration);
				content = declaration.toString();
			}

		} catch (ex) {
			F.error(ex, 'F.install(\'' + type + '\')', null);
			callback && callback(ex, name);
			return F;
		}

		if (typeof(obj.id) === 'string')
			name = obj.id;
		else if (typeof(obj.name) === 'string')
			name = obj.name;

		if (obj.url) {
			if (obj.url[0] !== '/')
				obj.url = '/' + obj.url;
		} else
			obj.url = '/' + name + '.js';

		tmp = F.path.temp('isomorphic_' + name + '.min.js');
		F.map(framework_internal.preparePath(obj.url), tmp);
		F.isomorphic[name] = obj;
		Fs.writeFileSync(tmp, prepare_isomorphic(name, framework_internal.compile_javascript(content, '#' + name)));
		callback && callback(null, name);

		setTimeout(function() {
			F.emit(type + '#' + name, obj);
			F.emit('install', type, name, obj);
		}, 500);

		return F;
	}

	if (type === 'model' || type === 'source') {

		_controller = '';
		_owner = type + '#' + name;

		try {

			if (useRequired) {
				obj = require(declaration);
				(function(name) {
					setTimeout(() => delete require.cache[name], 1000);
				})(require.resolve(declaration));
			}
			else {

				if (typeof(declaration) !== 'string')
					declaration = declaration.toString();

				if (!name && typeof(internal) === 'string') {
					var tmp = internal.match(/[a-z0-9]+\.js$/i);
					if (tmp)
						name = tmp.toString().replace(/\.js/i, '');
				}

				var filename = F.path.temporary(plus + 'installed-' + type + '-' + U.GUID(10) + '.js');
				Fs.writeFileSync(filename, declaration);
				obj = require(filename);

				(function(name, filename) {
					setTimeout(function() {
						Fs.unlinkSync(filename);
						delete require.cache[name];
					}, 1000);
				})(require.resolve(filename), filename);
			}

		} catch (ex) {
			F.error(ex, 'F.install(\'' + type + '\', \'' + name + '\')', null);
			callback && callback(ex, name);
			return F;
		}

		if (typeof(obj.id) === 'string')
			name = obj.id;
		else if (typeof(obj.name) === 'string')
			name = obj.name;

		_owner = type + '#' + name;
		obj.$owner = _owner;

		if (!name)
			name = (Math.random() * 10000) >> 0;

		key = type + '.' + name;
		tmp = F.dependencies[key];

		F.uninstall(type, uptodateName || name, uptodateName ? 'uptodate' : undefined);

		if (tmp) {
			F.dependencies[key] = tmp;
			F.dependencies[key].updated = F.datetime;
		}
		else {
			F.dependencies[key] = { name: name, type: type, installed: F.datetime, updated: null, count: 0 };
			if (internal)
				F.dependencies[key].url = internal;
		}

		F.dependencies[key].count++;

		if (obj.reinstall)
			F.dependencies[key].reinstall = obj.reinstall.toString().parseDateExpiration();
		else
			delete F.dependencies[key];

		if (type === 'model')
			F.models[name] = obj;
		else
			F.sources[name] = obj;

		typeof(obj.install) === 'function' && obj.install(options || F.config[_owner], name);

		!skipEmit && setTimeout(function() {
			F.emit(type + '#' + name, obj);
			F.emit('install', type, name, obj);
		}, 500);

		callback && callback(null, name);
		return F;
	}

	if (type === 'module' || type === 'controller') {

		// for inline routes
		var _ID = _controller = 'TMP' + U.random(10000);
		_owner = type + '#' + name;

		try {
			if (useRequired) {
				obj = require(declaration);
				(function(name) {
					setTimeout(function() {
						delete require.cache[name];
					}, 1000);
				})(require.resolve(declaration));
			} else {

				if (typeof(declaration) !== 'string')
					declaration = declaration.toString();

				if (!name && typeof(internal) === 'string') {
					var tmp = internal.match(/[a-z0-9]+\.js$/i);
					if (tmp)
						name = tmp.toString().replace(/\.js/i, '');
				}
				filename = F.path.temporary(plus + 'installed-' + type + '-' + U.GUID(10) + '.js');
				Fs.writeFileSync(filename, declaration);
				obj = require(filename);
				(function(name, filename) {
					setTimeout(function() {
						Fs.unlinkSync(filename);
						delete require.cache[name];
					}, 1000);
				})(require.resolve(filename), filename);
			}

		} catch (ex) {
			F.error(ex, 'F.install(\'' + type + '\', \'' + (name ? '' : internal) + '\')', null);
			callback && callback(ex, name);
			return F;
		}

		if (typeof(obj.id) === 'string')
			name = obj.id;
		else if (typeof(obj.name) === 'string')
			name = obj.name;

		if (!name)
			name = (Math.random() * 10000) >> 0;

		_owner = type + '#' + name;
		obj.$owner = _owner;

		obj.booting && setTimeout(function() {

			var tmpdir = F.path.temp(name + '.package/');
			if (obj.booting === 'root') {
				F.directory = directory = tmpdir;
				F.temporary.path = {};
				F.temporary.notfound = {};
				F._configure();
				F._configure_versions();
				F._configure_dependencies();
				F._configure_sitemap();
				F._configure_workflows();
			} else {

				F._configure('@' + name + '/config');

				if (F.config.debug)
					F._configure('@' + name + '/config-debug');
				else
					F._configure('@' + name + '/config-release');

				F.isTest && F._configure('@' + name + '/config-test');
				F._configure_versions('@' + name + '/versions');
				F._configure_dependencies('@' + name + '/dependencies');
				F._configure_sitemap('@' + name + '/sitemap');
				F._configure_workflows('@' + name + '/workflows');
			}

			F.$load(undefined, tmpdir);
		}, 100);

		key = type + '.' + name;
		tmp = F.dependencies[key];

		F.uninstall(type, uptodateName || name, uptodateName ? 'uptodate' : undefined);

		if (tmp) {
			F.dependencies[key] = tmp;
			F.dependencies[key].updated = F.datetime;
		}
		else {
			F.dependencies[key] = { name: name, type: type, installed: F.datetime, updated: null, count: 0, _id: _ID };
			if (internal)
				F.dependencies[key].url = internal;
		}

		F.dependencies[key].dependencies = obj.dependencies;
		F.dependencies[key].count++;
		F.dependencies[key].processed = false;

		if (obj.reinstall)
			F.dependencies[key].reinstall = obj.reinstall.toString().parseDateExpiration();
		else
			delete F.dependencies[key].reinstall;

		_controller = _ID;

		if (obj.dependencies instanceof Array) {
			for (var i = 0, length = obj.dependencies.length; i < length; i++) {
				if (!F.dependencies[type + '.' + obj.dependencies[i]]) {
					F.temporary.dependencies[key] = { obj: obj, options: options, callback: callback, skipEmit: skipEmit };
					return F;
				}
			}
		}

		F.install_make(key, name, obj, options, callback, skipEmit, type);

		if (type === 'module')
			F.modules[name] = obj;
		else
			F.controllers[name] = obj;

		F.install_prepare();
	}

	return F;
};

Framework.prototype.restart = function() {
	if (!F.isRestarted) {
		F.isRestarted = true;
		F.emit('restart');
		setTimeout(() => F.$restart(), 1000);
	}
	return F;
};

Framework.prototype.$restart = function() {

	console.log('----------------------------------------------------> RESTART ' + new Date().format('yyyy-MM-dd HH:mm:ss'));

	F.server.setTimeout(0);
	F.server.timeout = 0;
	F.server.close(function() {

		Object.keys(F.modules).forEach(function(key) {
			var item = F.modules[key];
			item && item.uninstall && item.uninstall();
		});

		Object.keys(F.models).forEach(function(key) {
			var item = F.models[key];
			item && item.uninstall && item.uninstall();
		});

		Object.keys(F.controllers).forEach(function(key) {
			var item = F.controllers[key];
			item && item.uninstall && item.uninstall();
		});

		Object.keys(F.workers).forEach(function(key) {
			var item = F.workers[key];
			if (item && item.kill) {
				item.removeAllListeners();
				item.kill('SIGTERM');
			}
		});

		Object.keys(F.connections).forEach(function(key) {
			var item = F.connections[key];
			if (item) {
				item.removeAllListeners();
				item.close();
			}
		});

		framework_builders.restart();
		framework_image.restart();
		framework_mail.restart();
		U.restart();
		framework_internal.restart();

		F.cache.clear();
		F.cache.stop();
		F.global = {};
		F.resources = {};
		F.connections = {};
		F.functions = {};
		F.themes = {};
		F.uptodates = null;
		F.versions = null;
		F.schedules = [];
		F.isLoaded = false;
		F.isRestarted = false;

		F.routes = {
			sitemap: null,
			web: [],
			files: [],
			cors: [],
			websockets: [],
			middleware: {},
			redirects: {},
			resize: {},
			request: [],
			views: {},
			merge: {},
			mapping: {},
			packages: {},
			blocks: {},
			resources: {},
			mmr: {}
		};

		F.temporary = {
			path: {},
			notfound: {},
			processing: {},
			range: {},
			views: {},
			versions: {},
			dependencies: {},
			other: {},
			internal: {}
		};

		F.modificators = null;
		F.helpers = {};
		F.modules = {};
		F.models = {};
		F.sources = {};
		F.controllers = {};
		F.dependencies = {};
		F.isomorphic = {};
		F.tests = [];
		F.errors = [];
		F.problems = [];
		F.changes = [];
		F.traces = [];
		F.workers = {};
		F.convertors = [];
		F.databases = {};

		F._request_check_redirect = false;
		F._request_check_referer = false;
		F._request_check_POST = false;
		F._request_check_robot = false;
		F._length_middleware = 0;
		F._length_request_middleware = 0;
		F._length_files = 0;
		F._length_wait = 0;
		F._length_themes = 0;
		F._length_cors = 0;
		F._length_subdomain_web = 0;
		F._length_subdomain_websocket = 0;
		F.isVirtualDirectory = false;
		F.isTheme = false;
		F.stats.other.restart++;

		setTimeout(() => F.removeAllListeners(), 2000);
		setTimeout(function() {
			var init = F.temporary.init;
			F.mode(init.isHTTPS ? require('https') : http, init.name, init.options);
		}, 1000);
	});
	return F;
};

Framework.prototype.install_prepare = function(noRecursive) {

	var keys = Object.keys(F.temporary.dependencies);

	if (!keys.length)
		return;

	// check dependencies
	for (var i = 0, length = keys.length; i < length; i++) {

		var k = keys[i];
		var a = F.temporary.dependencies[k];
		var b = F.dependencies[k];
		var skip = false;

		if (b.processed)
			continue;

		for (var j = 0, jl = b.dependencies.length; j < jl; j++) {
			var d = F.dependencies['module.' + b.dependencies[j]];
			if (!d || !d.processed) {
				skip = true;
				break;
			}
		}

		if (skip)
			continue;

		delete F.temporary.dependencies[k];

		if (b.type === 'module')
			F.modules[b.name] = a.obj;
		else
			F.controllers[b.name] = a.obj;

		F.install_make(k, b.name, a.obj, a.options, a.callback, a.skipEmit, b.type);
	}

	keys = Object.keys(F.temporary.dependencies);

	clearTimeout(F.temporary.other.dependencies);
	F.temporary.other.dependencies = setTimeout(function() {
		var keys = Object.keys(F.temporary.dependencies);
		if (keys.length)
			throw new Error('Dependency exception (module): missing dependencies for: ' + keys.join(', ').trim());
		delete F.temporary.other.dependencies;
	}, 1500);

	if (!keys.length || noRecursive)
		return F;

	F.install_prepare(true);
	return F;
};

Framework.prototype.install_make = function(key, name, obj, options, callback, skipEmit, type) {

	var me = F.dependencies[key];
	var routeID = me._id;
	var type = me.type;

	F.temporary.internal[me._id] = name;
	_controller = routeID;
	_owner = type + '#' + name.replace(/\.package$/gi, '');

	typeof(obj.install) === 'function' && obj.install(options || F.config[_owner], name);
	me.processed = true;

	var id = (type === 'module' ? '#' : '') + name;
	var length = F.routes.web.length;
	for (var i = 0; i < length; i++) {
		if (F.routes.web[i].controller === routeID)
			F.routes.web[i].controller = id;
	}

	length = F.routes.websockets.length;
	for (var i = 0; i < length; i++) {
		if (F.routes.websockets[i].controller === routeID)
			F.routes.websockets[i].controller = id;
	}

	length = F.routes.files.length;
	for (var i = 0; i < length; i++) {
		if (F.routes.files[i].controller === routeID)
			F.routes.files[i].controller = id;
	}

	F.$routesSort();
	_controller = '';

	if (!skipEmit) {
		setTimeout(function() {
			F.emit(type + '#' + name, obj);
			F.emit('install', type, name, obj);
		}, 500);
	}

	callback && callback(null, name);
	return F;
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

	var obj = null;
	var id = type + '#' + name;

	if (type === 'schema') {
		framework_builders.remove(name);
	} else if (type === 'mapping') {
		delete F.routes.mapping[name];
	} else if (type === 'isomorphic') {
		var obj = F.isomorphic[name];
		if (obj.url)
			delete F.routes.mapping[F._version(obj.url)];
		delete F.isomorphic[name];
	} else if (type === 'middleware') {

		if (!F.routes.middleware[name])
			return F;

		delete F.routes.middleware[name];
		delete F.dependencies[type + '.' + name];
		F._length_middleware = Object.keys(F.routes.middleware).length;

		var tmp;

		for (var i = 0, length = F.routes.web.length; i < length; i++) {
			tmp = F.routes.web[i];
			if (tmp.middleware && tmp.middleware.length)
				tmp.middleware = tmp.middleware.remove(name);
		}

		for (var i = 0, length = F.routes.websockets.length; i < length; i++) {
			tmp = F.routes.websocket[i];
			if (tmp.middleware && tmp.middleware.length)
				tmp.middleware = tmp.middleware.remove(name);
		}

		for (var i = 0, length = F.routes.files.length; i < length; i++) {
			tmp = F.routes.files[i];
			if (tmp.middleware && tmp.middleware.length)
				tmp.middleware = tmp.middleware.remove(name);
		}

	} else if (type === 'package') {
		delete F.routes.packages[name];
		F.uninstall('module', name, options, true);
		return F;
	} else if (type === 'view' || type === 'precompile') {

		obj = F.routes.views[name];

		if (!obj)
			return F;

		delete F.routes.views[name];
		delete F.dependencies[type + '.' + name];

		fsFileExists(obj.filename, function(e) {
			e && Fs.unlink(obj.filename, NOOP);
		});

	} else if (type === 'model' || type === 'source') {

		obj = type === 'model' ? F.models[name] : F.sources[name];

		if (!obj)
			return F;

		if (obj.id)
			delete require.cache[require.resolve(obj.id)];

		F.$uninstall(id);
		typeof(obj.uninstall) === 'function' && obj.uninstall(options, name);

		if (type === 'model')
			delete F.models[name];
		else
			delete F.sources[name];

		delete F.dependencies[type + '.' + name];

	} else if (type === 'module' || type === 'controller') {

		var isModule = type === 'module';
		obj = isModule ? F.modules[name] : F.controllers[name];

		if (!obj)
			return F;

		if (obj.id)
			delete require.cache[require.resolve(obj.id)];

		F.$uninstall(id, (isModule ? '#' : '') + name);

		if (obj) {
			obj.uninstall && obj.uninstall(options, name);
			if (isModule)
				delete F.modules[name];
			else
				delete F.controllers[name];
		}

	} else if (type === 'component') {

		if (!F.components.instances[name])
			return F;

		obj = F.components.instances[name];

		if (obj) {
			F.$uninstall(id);
			obj.uninstall && obj.uninstall(options, name);
			delete F.components.instances[name];
		}

		delete F.components.instances[name];
		delete F.components.views[name];

		var temporary = (F.id ? 'i-' + F.id + '_' : '') + 'components';
		var data;
		var index;
		var beg = '\n/*' + name.hash() + '*/\n';
		var end = beg.substring(0, beg.length - 1);
		var is = false;

		if (F.components.js) {
			data = Fs.readFileSync(F.path.temp(temporary + '.js')).toString('utf-8');
			index = data.indexOf(beg);
			if (index !== -1) {
				data = data.substring(0, index) + data.substring(data.indexOf(end, index + end.length) + end.length);
				Fs.writeFileSync(F.path.temp(temporary + '.js'), data);
				is = true;
			}
		}

		if (F.components.css) {
			data = Fs.readFileSync(F.path.temp(temporary + '.css')).toString('utf-8');
			index = data.indexOf(beg);
			if (index !== -1) {
				data = data.substring(0, index) + data.substring(data.indexOf(end, index +end.length) + end.length);
				Fs.writeFileSync(F.path.temp(temporary + '.css'), data);
				is = true;
			}
		}

		if (is)
			F.components.version = U.GUID(5);
	}

	!skipEmit && F.emit('uninstall', type, name);
	return F;
};

Framework.prototype.$uninstall = function(owner, controller) {

	if (controller) {
		F.routes.web = F.routes.web.remove('controller', controller);
		F.routes.files = F.routes.files.remove('controller', controller);
		F.routes.websockets = F.routes.websockets.remove('controller', controller);
	}

	F.routes.web = F.routes.web.remove('owner', owner);
	F.routes.files = F.routes.files.remove('owner', owner);
	F.routes.websockets = F.routes.websockets.remove('owner', owner);
	F.routes.cors = F.routes.cors.remove('owner', owner);
	F.schedules = F.schedules.remove('owner', owner);

	if (F.modificators)
		F.modificators = F.modificators.remove('$owner', owner);

	framework_builders.uninstall(owner);

	var owners = [];
	var redirects = false;

	for (var i = 0, length = F.owners.length; i < length; i++) {

		var m = F.owners[i];
		if (m.owner !== owner) {
			owners.push(m);
			continue;
		}

		switch (m.type) {
			case 'redirects':
				delete F.routes.redirects[m.id];
				redirects = true;
				break;
			case 'resize':
				delete F.routes.resize[m.id];
				break;
			case 'merge':
				delete F.routes.merge[m.id];
				break;
			case 'mapping':
				delete F.routes.mapping[m.id];
				break;
			case 'blocks':
				delete F.routes.blocks[m.id];
				break;
			case 'middleware':
				UNINSTALL('middleware', m.id);
				break;
		}

	}

	if (redirects)
		F._request_check_redirect = Object.keys(F.routes.redirects).length > 0;

	F.owners = owners;
	F.$routesSort();
	return F;
};

/**
 * Register internal mapping (e.g. Resource)
 * @param {String} path
 * @return {Framework}
 */
Framework.prototype.register = function(path) {

	var key;
	var extension = '.' + U.getExtension(path);
	var name = U.getName(path);
	var c = path[0];

	if (c === '@')
		path = F.path.package(path.substring(1));
	else if (c === '=') {
		if (path[1] === '?')
			F.path.themes(F.config['default-theme'] + path.substring(2));
		else
			path = F.path.themes(path.substring(1));
	}

	switch (extension) {
		case '.resource':
			key = name.replace(extension, '');
			if (F.routes.resources[key])
				F.routes.resources[key].push(path);
			else
				F.routes.resources[key] = [path];
			// clears cache
			delete F.resources[key];
			break;

		default:
			throw new Error('Not supported registration type "' + extension + '".');
	}

	return F;
};

/**
 * Run code
 * @param {String or Function} script Function to eval or Code or URL address.
 * @return {Framework}
 */
Framework.prototype.eval = function(script) {
	return F.install('eval', script);
};

/**
 * Error handler
 * @param {Error} err
 * @param {String} name
 * @param {Object} uri URI address, optional.
 * @return {Framework}
 */
Framework.prototype.onError = function(err, name, uri) {
	F.datetime = new Date();
	console.log('======= ' + (F.datetime.format('yyyy-MM-dd HH:mm:ss')) + ': ' + (name ? name + ' ---> ' : '') + err.toString() + (uri ? ' (' + Parser.format(uri) + ')' : ''), err.stack);
	return F;
};

/*
	Authorization handler
	@req {Request}
	@res {Response} OR {WebSocketClient}
	@flags {String array}
	@callback {Function} - @callback(Boolean), true is [authorize]d and false is [unauthorize]d
*/
Framework.prototype.onAuthorize = null;

/*
	Sets the current language for the current request
	@req {Request}
	@res {Response} OR {WebSocketClient}
	@return {String}
*/
Framework.prototype.onLocale = null;
// OLD: Framework.prototype.onLocate = null;

/**
 * Sets theme to controlller
 * @controller {Controller}
 * @return {String}
 */
Framework.prototype.onTheme = null;

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
Framework.prototype.onMapping = function(url, def, ispublic, encode) {

	if (url[0] !== '/')
		url = '/' + url;

	if (F._length_themes) {
		var index = url.indexOf('/', 1);
		if (index !== -1) {
			var themeName = url.substring(1, index);
			if (F.themes[themeName])
				return F.themes[themeName] + 'public' + url.substring(index);
		}
	}

	if (F.routes.mapping[url])
		return F.routes.mapping[url];

	def = framework_internal.preparePath(def, true);

	if (encode)
		def = $decodeURIComponent(def);

	if (ispublic)
		def = F.path.public_cache(def);
	else
		def = def[0] === '~' ? def.substring(1) : def[0] === '.' ? def : F.path.public_cache(def);

	return def;
};
Framework.prototype.download = Framework.prototype.snapshot = function(url, filename, callback) {

	url = framework_internal.preparePath(url);
	if (!url.match(/^http:|https:/gi)) {
		if (url[0] !== '/')
			url = '/' + url;
		url = 'http://' + (F.ip === 'auto' ? '0.0.0.0' : F.ip) + ':' + F.port + url;
	}

	U.download(url, REQUEST_INSTALL_FLAGS, function(err, response) {

		if (err) {
			callback && callback(err);
			callback = null;
			return;
		}

		var stream = Fs.createWriteStream(filename);
		response.pipe(stream);

		response.on('error', function(err) {
			callback && callback(err);
			callback = null;
		});

		CLEANUP(stream, function() {
			DESTROY(stream);
			callback && callback(null, filename);
			callback = null;
		});
	});

	return F;
};

/**
 * Find WebSocket connection
 * @param {String/RegExp} path
 * @return {WebSocket}
 */
Framework.prototype.findConnection = function(path) {
	var arr = Object.keys(F.connections);
	var is = U.isRegExp(path);
	for (var i = 0, length = arr.length; i < length; i++) {
		var key = arr[i];
		if (is) {
			if (path.test(key))
				return F.connections[key];
		} else {
			if (key.indexOf(path) !== -1)
				return F.connections[key];
		}
	}
};

/**
 * Find WebSocket connections
 * @param {String/RegExp} path
 * @return {WebSocket Array}
 */
Framework.prototype.findConnections = function(path) {
	var arr = Object.keys(F.connections);
	var is = U.isRegExp(path);
	var output = [];
	for (var i = 0, length = arr.length; i < length; i++) {
		var key = arr[i];
		if (!path)
 			output.push(F.connections[key]);
		else if (is)
			path.test(key) && output.push(F.connections[key]);
		else
			key.indexOf(path) !== -1 && output.push(F.connections[key]);
	}
	return output;
};

/**
 * Global validation
 * @param {Function(name, value)} delegate
 * @type {Boolean or StringErrorMessage}
 */
Framework.prototype.onValidate = null;

/**
 * Global XML parsing
 * @param {String} value
 * @return {Object}
 */
Framework.prototype.onParseXML = function(value) {
	var val = U.parseXML(value);
	F._length_convertors && F.convert(val);
	return val;
};

/**
 * Global JSON parsing
 * @param {String} value
 * @return {Object}
 */
Framework.prototype.onParseJSON = function(value) {
	return JSON.parse(value);
};

/**
 * Global JSON parsing
 * @param {String} value
 * @return {Object}
 */
Framework.prototype.onParseQuery = function(value) {
	if (value) {
		var val = Qs.parse(value, null, null, QUERYPARSEROPTIONS);
		F._length_convertors && F.convert(val);
		return val;
	}
	return {};
};

/**
 * Schema parser delegate
 * @param {Request} req
 * @param {String} group
 * @param {String} name
 * @param {Function(err, body)} callback
 */
Framework.prototype.onSchema = function(req, group, name, callback, filter) {
	var schema = GETSCHEMA(group, name);
	if (schema)
		schema.make(req.body, (err, res) => err ? callback(err) : callback(null, res), filter);
	else
		callback(new Error('Schema "' + group + '/' + name + '" not found.'));
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

	if (typeof(callback) === 'string') {
		tmp = replyTo;
		replyTo = callback;
		callback = tmp;
	}

	var message = Mail.create(subject, body);

	if (address instanceof Array) {
		for (var i = 0, length = address.length; i < length; i++)
			message.to(address[i]);
	} else
		message.to(address);

	message.from(F.config['mail.address.from'] || '', F.config.name);
	tmp = F.config['mail.address.reply'];

	if (replyTo)
		message.reply(replyTo);
	else if (tmp && tmp.isEmail())
		message.reply(F.config['mail.address.reply']);

	tmp = F.config['mail.address.copy'];

	if (tmp && tmp.isEmail())
		message.bcc(tmp);

	var opt = F.temporary['mail-settings'];

	if (!opt) {
		var config = F.config['mail.smtp.options'];
		if (config) {
			var type = typeof(config);
			if (type === 'string')
				opt = config.parseJSON();
			else if (type === 'object')
				opt = config;
		}

		if (!opt)
			opt = {};

		F.temporary['mail-settings'] = opt;
	}

	message.$sending = setTimeout(() => message.send(F.config['mail.smtp'], opt, callback), 5);
	return message;
};

Framework.prototype.onMeta = function() {

	var builder = '';
	var length = arguments.length;
	var self = this;

	for (var i = 0; i < length; i++) {

		var arg = U.encode(arguments[i]);
		if (arg == null || !arg.length)
			continue;

		switch (i) {
			case 0:
				builder += '<title>' + (arg + (F.url !== '/' && !F.config['allow-custom-titles'] ? ' - ' + F.config.name : '')) + '</title>';
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

	F.datetime = new Date();
	var filename = F.datetime.getFullYear() + '-' + (F.datetime.getMonth() + 1).toString().padLeft(2, '0') + '-' + F.datetime.getDate().toString().padLeft(2, '0');
	var time = F.datetime.getHours().toString().padLeft(2, '0') + ':' + F.datetime.getMinutes().toString().padLeft(2, '0') + ':' + F.datetime.getSeconds().toString().padLeft(2, '0');
	var str = '';
	var length = arguments.length;

	for (var i = 0; i < length; i++) {
		var val = arguments[i];
		if (val === undefined)
			val = 'undefined';
		else if (val === null)
			val = 'null';
		else if (typeof(val) === 'object')
			val = Util.inspect(val);
		str += (str ? ' ' : '') + val;
	}

	F.path.verify('logs');
	U.queue('F.log', 5, (next) => Fs.appendFile(U.combine(F.config['directory-logs'], filename + '.log'), time + ' | ' + str + '\n', next));
	return F;
};

Framework.prototype.logger = function() {
	F.datetime = new Date();
	var dt = F.datetime.getFullYear() + '-' + (F.datetime.getMonth() + 1).toString().padLeft(2, '0') + '-' + F.datetime.getDate().toString().padLeft(2, '0') + ' ' + F.datetime.getHours().toString().padLeft(2, '0') + ':' + F.datetime.getMinutes().toString().padLeft(2, '0') + ':' + F.datetime.getSeconds().toString().padLeft(2, '0');
	var str = '';
	var length = arguments.length;

	for (var i = 1; i < length; i++) {
		var val = arguments[i];
		if (val === undefined)
			val = 'undefined';
		else if (val === null)
			val = 'null';
		else if (typeof(val) === 'object')
			val = Util.inspect(val);
		str += (str ? ' ' : '') + val;
	}

	F.path.verify('logs');
	U.queue('F.logger', 5, (next) => Fs.appendFile(U.combine(F.config['directory-logs'], arguments[0] + '.log'), dt + ' | ' + str + '\n', next));
	return F;
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
		subject = F.config.name + ' v' + F.config.version;

	var body = '<!DOCTYPE html><html><head><title>' + subject + '</title><meta charset="utf-8" /></head><body><pre style="max-width:600px;font-size:13px;line-height:16px">' + (typeof(body) === 'object' ? JSON.stringify(body).escape() : body) + '</pre></body></html>';
	return F.onMail(address, subject, body, callback);
};

Framework.prototype.usage = function(detailed) {
	var memory = process.memoryUsage();
	var cache = Object.keys(F.cache.items);
	var resources = Object.keys(F.resources);
	var controllers = Object.keys(F.controllers);
	var connections = Object.keys(F.connections);
	var workers = Object.keys(F.workers);
	var modules = Object.keys(F.modules);
	var isomorphic = Object.keys(F.isomorphic);
	var models = Object.keys(F.models);
	var helpers = Object.keys(F.helpers);
	var staticFiles = Object.keys(F.temporary.path);
	var staticNotfound = Object.keys(F.temporary.notfound);
	var staticRange = Object.keys(F.temporary.range);
	var redirects = Object.keys(F.routes.redirects);
	var output = {};

	output.framework = {
		pid: process.pid,
		node: process.version,
		version: 'v' + F.version_header,
		platform: process.platform,
		processor: process.arch,
		uptime: Math.floor(process.uptime() / 60),
		memoryTotal: (memory.heapTotal / 1024 / 1024).floor(2),
		memoryUsage: (memory.heapUsed / 1024 / 1024).floor(2),
		mode: F.config.debug ? 'debug' : 'release',
		port: F.port,
		ip: F.ip,
		directory: process.cwd()
	};

	var keys = Object.keys(U.queuecache);
	var pending = 0;
	for (var i = 0, length = keys.length; i < length; i++)
		pending += U.queuecache[keys[i]].pending.length;

	output.counter = {
		resource: resources.length,
		controller: controllers.length,
		module: modules.length,
		isomorphic: isomorphic.length,
		cache: cache.length,
		worker: workers.length,
		connection: connections.length,
		schedule: F.schedules.length,
		helpers: helpers.length,
		error: F.errors.length,
		problem: F.problems.length,
		queue: pending,
		files: staticFiles.length,
		notfound: staticNotfound.length,
		streaming: staticRange.length,
		modificator:  F.modificators ? F.modificators.length : 0,
		viewphrases: $VIEWCACHE.length,
		uptodates: F.uptodates ? F.uptodates.length : 0
	};

	output.routing = {
		webpage: F.routes.web.length,
		sitemap: F.routes.sitemap ? Object.keys(F.routes.sitemap).length : 0,
		websocket: F.routes.websockets.length,
		file: F.routes.files.length,
		middleware: Object.keys(F.routes.middleware).length,
		redirect: redirects.length,
		mmr: Object.keys(F.routes.mmr).length
	};

	output.stats = F.stats;
	output.redirects = redirects;

	if (!detailed)
		return output;

	output.controllers = [];

	controllers.forEach(function(o) {
		var item = F.controllers[o];
		output.controllers.push({ name: o, usage: item.usage ? item.usage() : null });
	});

	output.connections = [];

	connections.forEach(function(o) {
		output.connections.push({ name: o, online: F.connections[o].online });
	});

	output.modules = [];

	modules.forEach(function(o) {
		var item = F.modules[o];
		output.modules.push({ name: o, usage: item.usage ? item.usage() : null });
	});

	output.models = [];

	models.forEach(function(o) {
		var item = F.models[o];
		output.models.push({ name: o, usage: item.usage ? item.usage() : null });
	});

	output.uptodates = F.uptodates;
	output.helpers = helpers;
	output.cache = cache;
	output.resources = resources;
	output.errors = F.errors;
	output.problems = F.problems;
	output.changes = F.changes;
	output.traces = F.traces;
	output.files = staticFiles;
	output.streaming = staticRange;
	output.other = Object.keys(F.temporary.other);
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

/*
	3rd JavaScript compiler (Sync)
	@filename {String}
	@content {String} :: Content of JavaScript file
	return {String}
*/
Framework.prototype.onCompileScript = null;

/**
 * Compile content (JS, CSS, HTML)
 * @param {String} extension File extension.
 * @param {String} content File content.
 * @param {String} filename
 * @return {String}
 */
Framework.prototype.compileContent = function(extension, content, filename) {

	if (filename && REG_NOCOMPRESS.test(filename))
		return content;

	switch (extension) {
		case 'js':
			return F.config['allow-compile-script'] ? framework_internal.compile_javascript(content, filename) : content;

		case 'css':
			content = F.config['allow-compile-style'] ? framework_internal.compile_css(content, filename) : content;
			var matches = content.match(REG_COMPILECSS);
			if (matches) {
				for (var i = 0, length = matches.length; i < length; i++) {
					var key = matches[i];
					var url = key.substring(4, key.length - 1);
					content = content.replace(key, 'url(' + F._version(url) + ')');
				}
			}
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
	fsFileRead(filename, function(err, buffer) {

		if (err) {
			F.error(err, filename, uri);
			F.temporary.notfound[key] = true;
			callback();
			return;
		}

		var file = F.path.temp((F.id ? 'i-' + F.id + '_' : '') + createTemporaryKey(uri.pathname));
		F.path.verify('temp');
		Fs.writeFileSync(file, F.compileContent(extension, framework_internal.parseBlock(F.routes.blocks[uri.pathname], buffer.toString(ENCODING)), filename), ENCODING);
		var stats = Fs.statSync(file);
		F.temporary.path[key] = [file, stats.size, stats.mtime.toUTCString()];
		callback();
	});
	return F;
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

	var merge = F.routes.merge[uri.pathname];
	var filename = merge.filename;

	if (!F.config.debug && existsSync(filename)) {
		var stats = Fs.statSync(filename);
		F.temporary.path[key] = [filename, stats.size, stats.mtime.toUTCString()];
		callback();
		return F;
	}

	var writer = Fs.createWriteStream(filename);

	writer.on('finish', function() {
		var stats = Fs.statSync(filename);
		F.temporary.path[key] = [filename, stats.size, stats.mtime.toUTCString()];
		callback();
	});

	var index = 0;
	var remove;

	merge.files.wait(function(filename, next) {

		var block;

		// Skip isomorphic
		if (filename[0] !== '#') {
			var blocks = filename.split('#');
			block = blocks[1];
			if (block)
				filename = blocks[0];
		}

		if (filename.startsWith('http://') || filename.startsWith('https://')) {
			U.request(filename, REQUEST_DOWNLOAD_FLAGS, function(err, data) {

				var output = F.compileContent(extension, framework_internal.parseBlock(block, data), filename);

				if (extension === 'js') {
					if (output[output.length - 1] !== ';')
						output += ';';
				} else if (extension === 'html') {
					if (output[output.length - 1] !== NEWLINE)
						output += NEWLINE;
				}

				DEBUG && merge_debug_writer(writer, filename, extension, index++, block);
				writer.write(output);
				next();
			});
			return;
		}

		if (filename[0] !== '~') {
			var tmp = F.path.public(filename);
			if (F.isVirtualDirectory && !existsSync(tmp))
				tmp = F.path.virtual(filename);
			filename = tmp;
		}
		else
			filename = filename.substring(1);

		var indexer = filename.indexOf('*');
		if (indexer !== -1) {

			var tmp = filename.substring(indexer + 1).toLowerCase();
			var len = tmp.length;

			if (!remove)
				remove = [];

			// Remove directory for all future requests
			remove.push(arguments[0]);

			U.ls(filename.substring(0, indexer), function(files, directories) {
				for (var j = 0, l = files.length; j < l; j++)
					merge.files.push('~' + files[j]);
				next();
			}, function(path, isDirectory) {
				return isDirectory ? true : path.substring(path.length - len).toLowerCase() === tmp;
			});

			return;
		}

		fsFileRead(filename, function(err, buffer) {

			if (err) {
				F.error(err, merge.filename, uri);
				next();
				return;
			}

			var output = F.compileContent(extension, framework_internal.parseBlock(block, buffer.toString(ENCODING)), filename);
			if (extension === 'js') {
				if (output[output.length - 1] !== ';')
					output += ';';
			} else if (extension === 'html') {
				if (output[output.length - 1] !== NEWLINE)
					output += NEWLINE;
			}

			DEBUG && merge_debug_writer(writer, filename, extension, index++, block);
			writer.write(output);
			next();
		});

	}, function() {

		writer.end();

		// Removes all directories from merge list (because the files are added into the queue)
		if (remove) {
			for (var i = 0, length = remove.length; i < length; i++)
				merge.files.splice(merge.files.indexOf(remove[i]), 1);
		}
	});

	return F;
};

function merge_debug_writer(writer, filename, extension, index, block) {
	var plus = '===========================================================================================';
	var beg = extension === 'js' ? '/*\n' : extension === 'css' ? '/*!\n' : '<!--\n';
	var end = extension === 'js' || extension === 'css' ? '\n */' : '\n-->';
	var mid = extension !== 'html' ? ' * ' : ' ';
	writer.write((index > 0 ? '\n\n' : '') + beg + mid + plus + '\n' + mid + 'MERGED: ' + filename + '\n' + (block ? mid + 'BLOCKS: ' + block + '\n' : '') + mid + plus + end + '\n\n', ENCODING);
}

function component_debug(filename, value, extension) {
	var plus = '===========================================================================================';
	var beg = extension === 'js' ? '/*\n' : extension === 'css' ? '/*!\n' : '<!--\n';
	var end = extension === 'js' || extension === 'css' ? '\n */' : '\n-->';
	var mid = extension !== 'html' ? ' * ' : ' ';
	return beg + mid + plus + '\n' + mid + 'COMPONENT: ' + filename + '\n' + mid + plus + end + '\n\n' + value;
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
Framework.prototype.compileValidation = function(uri, key, filename, extension, callback, noCompress) {

	if (F.routes.merge[uri.pathname]) {
		F.compileMerge(uri, key, extension, callback);
		return F;
	}

	fsFileExists(filename, function(e, size, sfile, stats) {
		if (e) {
			if (!noCompress && (extension === 'js' || extension === 'css') && !REG_NOCOMPRESS.test(filename))
				return F.compileFile(uri, key, filename, extension, callback);
			F.temporary.path[key] = [filename, size, stats.mtime.toUTCString()];
			callback();
		} else if (F.isVirtualDirectory)
			F.compileValidationVirtual(uri, key, filename, extension, callback, noCompress);
		else {
			F.temporary.notfound[key] = true;
			callback();
		}
	});

	return F;
};

Framework.prototype.compileValidationVirtual = function(uri, key, filename, extension, callback, noCompress) {

	var tmpname = filename.replace(F.config['directory-public'], F.config['directory-public-virtual']);
	if (tmpname === filename) {
		F.temporary.notfound[key] = true;
		callback();
		return;
	}

	filename = tmpname;
	fsFileExists(filename, function(e, size, sfile, stats) {

		if (!e) {
			F.temporary.notfound[key] = true;
			callback();
			return;
		}

		if (!noCompress && (extension === 'js' || extension === 'css') && !REG_NOCOMPRESS.test(filename))
			return F.compileFile(uri, key, filename, extension, callback);

		F.temporary.path[key] = [filename, size, stats.mtime.toUTCString()];
		callback();
	});

	return;
};

/**
 * Server all static files
 * @param {Request} req
 * @param {Response} res
 * @return {Framework}
 */
Framework.prototype.responseStatic = function(req, res, done) {

	if (res.success || res.headersSent) {
		done && done();
		return F;
	}

	if (!F.config['static-accepts'][req.extension]) {
		F.response404(req, res);
		done && done();
		return F;
	}

	req.$key = createTemporaryKey(req);
	if (F.temporary.notfound[req.$key]) {
		F.response404(req, res);
		done && done();
		return F;
	}

	var name = req.uri.pathname;
	var index = name.lastIndexOf('/');
	var resizer = F.routes.resize[name.substring(0, index + 1)] || null;
	var canResize;
	var filename;

	if (resizer) {
		name = name.substring(index + 1);
		canResize = resizer.extension['*'] || resizer.extension[req.extension];
		if (canResize) {
			name = resizer.path + $decodeURIComponent(name);
			filename = F.onMapping(name, name, false, false);
		} else
			filename = F.onMapping(name, name, true, true);
	} else
		filename = F.onMapping(name, name, true, true);

	if (!canResize) {
		if (F.components.has && F.components[req.extension] && req.uri.pathname === F.config['static-url-components'] + req.extension) {
			res.noCompress = true;
			filename = F.path.temp('components.' + req.extension);
		}
		F.responseFile(req, res, filename, undefined, undefined, done);
		return F;
	}

	if (!resizer.ishttp) {
		var method = resizer.cache ? F.responseImage : F.responseImageWithoutCache;
		method.call(F, req, res, filename, (image) => resizer.fn.call(image, image), undefined, done);
		return;
	}

	if (F.temporary.processing[req.uri.pathname]) {
		setTimeout(() => F.responseStatic(req, res, done), 500);
		return;
	}

	var tmp = F.path.temp(req.$key);
	if (F.temporary.path[req.$key]) {
		F.responseFile(req, res, req.uri.pathname, undefined, undefined, done);
		return F;
	}

	F.temporary.processing[req.uri.pathname] = true;

	U.download(name, REQUEST_DOWNLOAD_FLAGS, function(err, response) {
		var writer = Fs.createWriteStream(tmp);
		response.pipe(writer);
		CLEANUP(writer, function() {

			delete F.temporary.processing[req.uri.pathname];
			var contentType = response.headers['content-type'];

			if (response.statusCode !== 200 || !contentType || !contentType.startsWith('image/')) {
				F.response404(req, res);
				done && done();
				return;
			}

			var method = resizer.cache ? F.responseImage : F.responseImageWithoutCache;
			method.call(F, req, res, tmp, (image) => resizer.fn.call(image, image), undefined, done);
		});
	});

	return F;
};

Framework.prototype.restore = function(filename, target, callback, filter) {
	var backup = new Backup();
	backup.restore(filename, target, callback, filter);
};

Framework.prototype.backup = function(filename, path, callback, filter) {

	var length = path.length;
	var padding = 120;

	U.ls(path, function(files, directories) {
		directories.wait(function(item, next) {
			var dir = item.substring(length).replace(/\\/g, '/') + '/';
			if (filter && !filter(dir))
				return next();
			Fs.appendFile(filename, dir.padRight(padding) + ':#\n', next);
		}, function() {
			files.wait(function(item, next) {
				var fil = item.substring(length).replace(/\\/g, '/');
				if (filter && !filter(fil))
					return next();
				Fs.readFile(item, function(err, data) {
					Zlib.gzip(data, function(err, data) {
						if (err) {
							F.error(err, 'F.backup()', filename);
							return next();
						}
						Fs.appendFile(filename, fil.padRight(padding) + ':' + data.toString('base64') + '\n', next);
					});
				});
			}, callback);
		});
	});

	return this;
};

Framework.prototype.exists = function(req, res, max, callback) {

	if (typeof(max) === 'function') {
		callback = max;
		max = 10;
	}

	var name = createTemporaryKey(req);
	var filename = F.path.temp(name);
	var httpcachevalid = false;

	RELEASE && (req.headers['if-none-match'] === ETAG + F.config['etag-version']) && (httpcachevalid = true);

	if (F.isProcessed(name) || httpcachevalid) {
		F.responseFile(req, res, filename);
		return F;
	}

	U.queue('F.exists', max, function(next) {
		fsFileExists(filename, function(e) {
			if (e)
				F.responseFile(req, res, filename, undefined, undefined, next);
			else
				callback(next, filename);
		});
	});

	return F;
};

/**
 * Is processed static file?
 * @param {String / Request} filename Filename or Request object.
 * @return {Boolean}
 */
Framework.prototype.isProcessed = function(filename) {

	if (filename.url) {
		var name = filename.url;
		var index = name.indexOf('?');
		if (index !== -1)
			name = name.substring(0, index);
		filename = F.path.public($decodeURIComponent(name));
	}

	return !F.temporary.notfound[filename] && F.temporary.path[filename] !== undefined;
};

/**
 * Processing
 * @param {String / Request} filename Filename or Request object.
 * @return {Boolean}
 */
Framework.prototype.isProcessing = function(filename) {

	if (!filename.url)
		return F.temporary.processing[filename] ? true : false;

	var name = filename.url;
	var index = name.indexOf('?');

	if (index !== -1)
		name = name.substring(0, index);

	filename = U.combine(F.config['directory-public'], $decodeURIComponent(name));
	return F.temporary.processing[filename] ? true : false;
};

/**
 * Disable HTTP cache for current request/response
 * @param  {Request}  req Request
 * @param  {Response} res (optional) Response
 * @return {Framework}
 */
Framework.prototype.noCache = function(req, res) {
	req.noCache();
	res && res.noCache();
	return F;
};

/**
 * Response file
 * @param {Request} req
 * @param {Response} res
 * @param {String} filename
 * @param {String} downloadName Optional
 * @param {Object} headers Optional
 * @param {Function} done Optional, callback.
 * @param {String} key Path to file, INTERNAL.
 * @return {Framework}
 */
Framework.prototype.responseFile = function(req, res, filename, downloadName, headers, done, key) {

	if (res.success || res.headersSent) {
		done && done();
		return F;
	}

	// Is package?
	if (filename[0] === '@')
		filename = F.path.package(filename.substring(1));

	if (!key)
		key = req.$key || createTemporaryKey(req);

	if (F.temporary.notfound[key]) {
		F.config.debug && (F.temporary.notfound[key] = undefined);
		F.response404(req, res);
		done && done();
		return F;
	}

	var name = F.temporary.path[key];
	var extension = req.extension;
	var returnHeaders;
	var index;

	if (!extension) {
		if (key)
			extension = U.getExtension(key);
		if (!extension && name) {
			extension = U.getExtension(name);
			index = extension.lastIndexOf(';');
			if (index !== -1)
				extension = extension.substring(0, index);
		}
		if (!extension && filename)
			extension = U.getExtension(filename);
	}

	if (name && RELEASE && req.headers['if-modified-since'] === name[2]) {

		returnHeaders = HEADERS['responseFile.lastmodified'];
		if (res.getHeader('Last-Modified'))
			delete returnHeaders['Last-Modified'];
		else
			returnHeaders['Last-Modified'] = name[2];

		if (res.getHeader('Expires'))
			delete returnHeaders.Expires;
		else
			returnHeaders.Expires = DATE_EXPIRES;

		if (res.getHeader('ETag'))
			delete returnHeaders.Etag;
		else
			returnHeaders.Etag = ETAG + F.config['etag-version'];

		returnHeaders[RESPONSE_HEADER_CONTENTTYPE] = U.getContentType(extension);
		res.success = true;
		res.writeHead(304, returnHeaders);
		res.end();
		F.stats.response.notModified++;
		F._request_stats(false, req.isStaticFile);
		done && done();
		!req.isStaticFile && F.emit('request-end', req, res);
		req.clear(true);
		return F;
	}

	// JS, CSS
	if (name === undefined) {

		if (F.isProcessing(key)) {
			if (req.processing > F.config['default-request-timeout'])
				F.response408(req, res);
			else {
				req.processing += 500;
				setTimeout(() => F.responseFile(req, res, filename, downloadName, headers, done, key), 500);
			}
			return F;
		}

		// waiting
		F.temporary.processing[key] = true;

		// checks if the file exists and counts the file size
		F.compileValidation(req.uri, key, filename, extension, function() {
			delete F.temporary.processing[key];
			F.responseFile(req, res, filename, downloadName, headers, done, key);
		}, res.noCompress);

		return F;
	}

	var contentType = U.getContentType(extension);
	var accept = req.headers['accept-encoding'] || '';

	if (!accept && isGZIP(req))
		accept = 'gzip';

	var compress = F.config['allow-gzip'] && REQUEST_COMPRESS_CONTENTTYPE[contentType] && accept.indexOf('gzip') !== -1;
	var range = req.headers['range'];
	var canCache = RELEASE && contentType !== 'text/cache-manifest';

	if (canCache) {
		if (compress)
			returnHeaders = range ? HEADERS['responseFile.release.compress.range'] : HEADERS['responseFile.release.compress'];
		else
			returnHeaders = range ? HEADERS['responseFile.release.range'] : HEADERS['responseFile.release'];
	} else {
		if (compress)
			returnHeaders = range ? HEADERS['responseFile.debug.compress.range'] : HEADERS['responseFile.debug.compress'];
		else
			returnHeaders = range ? HEADERS['responseFile.debug.range'] : HEADERS['responseFile.debug'];
	}

	if (req.$mobile)
		returnHeaders.Vary = 'Accept-Encoding, User-Agent';
	else
		returnHeaders.Vary = 'Accept-Encoding';

	returnHeaders[RESPONSE_HEADER_CONTENTTYPE] = contentType;
	if (REG_TEXTAPPLICATION.test(contentType))
		returnHeaders[RESPONSE_HEADER_CONTENTTYPE] += '; charset=utf-8';

	if (canCache && !res.getHeader('Expires'))
		returnHeaders.Expires = DATE_EXPIRES;
	else if (returnHeaders.Expires)
		delete returnHeaders.Expires;

	if (headers)
		returnHeaders = U.extend_headers(returnHeaders, headers);

	if (downloadName)
		returnHeaders['Content-Disposition'] = 'attachment; filename="' + encodeURIComponent(downloadName) + '"';
	else if (returnHeaders['Content-Disposition'])
		delete returnHeaders['Content-Disposition'];

	if (res.getHeader('Last-Modified'))
		delete returnHeaders['Last-Modified'];
	else
		returnHeaders['Last-Modified'] = name[2];

	returnHeaders.Etag = ETAG + F.config['etag-version'];
	res.success = true;

	if (range) {
		F.responseRange(name[0], range, returnHeaders, req, res, done);
		return F;
	}

	DEBUG && F.isProcessed(key) && (F.temporary.path[key] = undefined);

	if (name[1] && !compress)
		returnHeaders[RESPONSE_HEADER_CONTENTLENGTH] = name[1];
	else if (returnHeaders[RESPONSE_HEADER_CONTENTLENGTH])
		delete returnHeaders[RESPONSE_HEADER_CONTENTLENGTH];

	F.stats.response.file++;
	F._request_stats(false, req.isStaticFile);

	if (req.method === 'HEAD') {
		res.writeHead(200, returnHeaders);
		res.end();
		done && done();
		!req.isStaticFile && F.emit('request-end', req, res);
		req.clear(true);
		return F;
	}

	if (compress) {
		res.writeHead(200, returnHeaders);
		fsStreamRead(name[0], undefined, function(stream, next) {
			framework_internal.onFinished(res, function(err) {
				framework_internal.destroyStream(stream);
				next();
			});
			stream.pipe(Zlib.createGzip()).pipe(res);
			done && done();
			!req.isStaticFile && F.emit('request-end', req, res);
			req.clear(true);
		});
		return F;
	}

	res.writeHead(200, returnHeaders);
	fsStreamRead(name[0], undefined, function(stream, next) {
		stream.pipe(res);
		framework_internal.onFinished(res, function(err) {
			framework_internal.destroyStream(stream);
			next();
		});
		done && done();
		!req.isStaticFile && F.emit('request-end', req, res);
		req.clear(true);
	});

	return F;
};

/**
 * Clears file information in release mode
 * @param {String/Request} url
 * @return {Framework}
 */
Framework.prototype.touch = function(url) {
	if (url) {
		var key = createTemporaryKey(url);
		delete F.temporary.path[key];
		delete F.temporary.notfound[key];
	} else {
		F.temporary.path = {};
		F.temporary.notfound = {};
	}
	return F;
};

/**
 * Creates a pipe between the current request and target URL
 * @param {Request} req
 * @param {Response} res
 * @param {String} url
 * @param {Object} headers Additional headers, optional.
 * @param {Number} timeout
 * @param {Function(err)} callback
 * @return {Framework}
 */
Framework.prototype.responsePipe = function(req, res, url, headers, timeout, callback) {

	if (res.success || res.headersSent)
		return F;

	U.resolve(url, function(err, uri) {
		var h = {};

		h[RESPONSE_HEADER_CACHECONTROL] = 'private';

		if (headers)
			U.extend_headers2(h, headers);

		var options = { protocol: uri.protocol, auth: uri.auth, method: 'GET', hostname: uri.hostname, port: uri.port, path: uri.path, agent: false, headers: h };
		var connection = options.protocol === 'https:' ? require('https') : http;
		var supportsGZIP = (req.headers['accept-encoding'] || '').lastIndexOf('gzip') !== -1;

		var client = connection.get(options, function(response) {

			if (res.success || res.headersSent)
				return;

			var contentType = response.headers['content-type'];
			var isGZIP = (response.headers['content-encoding'] || '').lastIndexOf('gzip') !== -1;
			var compress = !isGZIP && supportsGZIP && (contentType.indexOf('text/') !== -1 || contentType.lastIndexOf('javascript') !== -1 || contentType.lastIndexOf('json') !== -1);
			var attachment = response.headers['content-disposition'] || '';

			attachment && res.setHeader('Content-Disposition', attachment);
			res.setHeader(RESPONSE_HEADER_CONTENTTYPE, contentType);
			res.setHeader('Vary', 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : ''));

			res.on('error', function(err) {
				response.close();
				callback && callback(err);
				callback = null;
			});

			if (compress) {
				res.setHeader('Content-Encoding', 'gzip');
				response.pipe(Zlib.createGzip()).pipe(res);
				return;
			}

			if (isGZIP && !supportsGZIP)
				response.pipe(Zlib.createGunzip()).pipe(res);
			else
				response.pipe(res);
		});

		timeout && client.setTimeout(timeout, function() {
			F.response408(req, res);
			callback && callback(new Error(U.httpStatus(408)));
			callback = null;
		});

		client.on('close', function() {

			if (res.success || res.headersSent)
				return;

			res.success = true;
			F.stats.response.pipe++;
			F._request_stats(false, req.isStaticFile);
			res.success = true;
			!req.isStaticFile && F.emit('request-end', req, res);
			req.clear(true);
			callback && callback();
		});
	});

	return F;
};

/**
 * Enables a custom respoding for the current response
 * @param {Request} req
 * @param {Response} res
 * @return {Framework}
 */
Framework.prototype.responseCustom = function(req, res) {
	if (res.success || res.headersSent)
		return F;
	res.success = true;
	F.stats.response.custom++;
	F._request_stats(false, req.isStaticFile);
	!req.isStaticFile && F.emit('request-end', req, res);
	req.clear(true);
	return F;
};

/**
 * Responds with an image
 * @param {Request} req
 * @param {Response} res
 * @param {String or Stream} filename
 * @param {Function(image)} fnProcess
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optional, callback function.
 * @return {Framework}
 */
Framework.prototype.responseImage = function(req, res, filename, fnProcess, headers, done) {

	var key = req.$key || createTemporaryKey(req);
	if (F.temporary.notfound[key]) {
		F.response404(req, res);
		done && done();
		return F;
	}

	var name = F.temporary.path[key];
	var stream;

	if (typeof(filename) === 'object')
		stream = filename;
	else if (filename[0] === '@')
		filename = F.path.package(filename.substring(1));

	if (name !== undefined) {
		F.responseFile(req, res, '', undefined, headers, done, key);
		return F;
	}

	if (F.isProcessing(key)) {
		if (req.processing > F.config['default-request-timeout']) {
			F.response408(req, res);
			done && done();
		} else {
			req.processing += 500;
			setTimeout(() => F.responseImage(req, res, filename, fnProcess, headers, done), 500);
		}
		return F;
	}

	var plus = F.id ? 'i-' + F.id + '_' : '';

	name = F.path.temp(plus + key);
	F.temporary.processing[key] = true;

	// STREAM
	if (stream) {
		fsFileExists(name, function(exist) {

			if (exist) {
				delete F.temporary.processing[key];
				F.temporary.path[key] = name;
				F.responseFile(req, res, name, undefined, headers, done, key);
				DEBUG && (F.temporary.path[key] = undefined);
				return;
			}

			F.path.verify('temp');
			var image = framework_image.load(stream, IMAGEMAGICK);
			fnProcess(image);

			var extension = U.getExtension(name);
			if (extension !== image.outputType) {
				var index = name.lastIndexOf('.' + extension);
				if (index !== -1)
					name = name.substring(0, index) + '.' + image.outputType;
				else
					name += '.' + image.outputType;
			}

			F.stats.response.image++;
			image.save(name, function(err) {

				delete F.temporary.processing[key];

				if (err) {
					F.temporary.notfound[key] = true;
					F.response500(req, res, err);
					done && done();
					DEBUG && (F.temporary.notfound[key] = undefined);
					return;
				}

				var stats = Fs.statSync(name);
				F.temporary.path[key] = [name, stats.size, stats.mtime.toUTCString()];
				F.responseFile(req, res, name, undefined, headers, done, key);
			});
		});

		return F;
	}

	// FILENAME
	fsFileExists(filename, function(exist) {

		if (!exist) {
			delete F.temporary.processing[key];
			F.temporary.notfound[key] = true;
			F.response404(req, res);
			done && done();
			DEBUG && (F.temporary.notfound[key] = undefined);
			return;
		}

		F.path.verify('temp');
		var image = framework_image.load(filename, IMAGEMAGICK);
		fnProcess(image);

		var extension = U.getExtension(name);
		if (extension !== image.outputType) {
			var index = name.lastIndexOf('.' + extension);
			if (index === -1)
				name += '.' + image.outputType;
			else
				name = name.substring(0, index) + '.' + image.outputType;
		}

		F.stats.response.image++;
		image.save(name, function(err) {

			delete F.temporary.processing[key];

			if (err) {
				F.temporary.notfound[key] = true;
				F.response500(req, res, err);
				done && done();
				DEBUG && (F.temporary.notfound[key] = undefined);
				return;
			}

			var stats = Fs.statSync(name);
			F.temporary.path[key] = [name, stats.size, stats.mtime.toUTCString()];
			F.responseFile(req, res, name, undefined, headers, done, key);
		});
	});

	return F;
};

Framework.prototype.responseImagePrepare = function(req, res, fnPrepare, fnProcess, headers, done) {

	var key = req.$key || createTemporaryKey(req);

	if (F.temporary.notfound[key]) {
		F.response404(req, res);
		done && done();
		DEBUG && (F.temporary.notfound[key] = undefined);
		return F;
	}

	var name = F.temporary.path[key];
	if (name) {
		F.responseFile(req, res, '', undefined, headers, done, key);
		return F;
	}

	if (F.isProcessing(key)) {
		if (req.processing > F.config['default-request-timeout']) {
			F.response408(req, res);
			done && done();
		} else {
			req.processing += 500;
			setTimeout(() => F.responseImage(req, res, filename, fnProcess, headers, done), 500);
		}
		return;
	}

	fnPrepare.call(F, function(filename) {
		if (filename) {
			F.responseImage(req, res, filename, fnProcess, headers, done);
		} else {
			F.response404(req, res);
			done && done();
		}
	});

	return F;
};

/**
 * Responds with an image (not cached)
 * @param {Request} req
 * @param {Response} res
 * @param {String or Stream} filename
 * @param {Function(image)} fnProcess
 * @param {Object} headers Optional, additional headers
 * @param {Function} done Optional, callback.
 * @return {Framework}
 */
Framework.prototype.responseImageWithoutCache = function(req, res, filename, fnProcess, headers, done) {

	var stream;

	if (typeof(filename) === 'object')
		stream = filename;
	else if (filename[0] === '@')
		filename = F.path.package(filename.substring(1));

	// STREAM
	if (stream) {
		var image = framework_image.load(stream, IMAGEMAGICK);
		fnProcess(image);
		F.stats.response.image++;
		F.responseStream(req, res, U.getContentType(image.outputType), image, null, headers, done);
		return F;
	}

	// FILENAME
	fsFileExists(filename, function(e) {

		if (e) {
			F.path.verify('temp');
			var image = framework_image.load(filename, IMAGEMAGICK);
			fnProcess(image);
			F.stats.response.image++;
			F.responseStream(req, res, U.getContentType(image.outputType), image, null, headers, done);
		} else {
			F.response404(req, res);
			done && done();
		}

	});
	return F;
};

/**
 * Responds with a stream
 * @param {Request} req
 * @param {Response} res
 * @param {String} contentType
 * @param {ReadStream} stream
 * @param {String} download Optional, download name.
 * @param {Object} headers Optional
 * @return {Framework}
 */
Framework.prototype.responseStream = function(req, res, contentType, stream, download, headers, done, nocompress) {

	if (res.success || res.headersSent) {
		done && done();
		return F;
	}

	if (contentType.lastIndexOf('/') === -1)
		contentType = U.getContentType(contentType);

	var accept = req.headers['accept-encoding'] || '';

	if (!accept && isGZIP(req))
		accept = 'gzip';

	var compress = nocompress === false && F.config['allow-gzip'] && REQUEST_COMPRESS_CONTENTTYPE[contentType] && accept.indexOf('gzip') !== -1;
	var returnHeaders;

	if (RELEASE) {
		if (compress)
			returnHeaders = HEADERS['responseStream.release.compress'];
		else
			returnHeaders = HEADERS['responseStream.release'];
	} else {
		if (compress)
			returnHeaders = HEADERS['responseStream.debug.compress'];
		else
			returnHeaders = HEADERS['responseStream.debug'];
	}

	returnHeaders.Vary = 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : '');

	if (RELEASE) {
		returnHeaders.Expires = DATE_EXPIRES;
		returnHeaders['Last-Modified'] = 'Mon, 01 Jan 2001 08:00:00 GMT';
	}

	if (headers)
		returnHeaders = U.extend_headers(returnHeaders, headers);

	if (download)
		returnHeaders['Content-Disposition'] = 'attachment; filename=' + encodeURIComponent(download);
	else if (returnHeaders['Content-Disposition'])
		delete returnHeaders['Content-Disposition'];

	returnHeaders[RESPONSE_HEADER_CONTENTTYPE] = contentType;

	F.stats.response.stream++;
	F._request_stats(false, req.isStaticFile);

	if (req.method === 'HEAD') {
		res.writeHead(200, returnHeaders);
		res.end();
		done && done();
		!req.isStaticFile && F.emit('request-end', req, res);
		req.clear(true);
		return F;
	}

	if (compress) {
		res.writeHead(200, returnHeaders);
		res.on('error', () => stream.close());
		stream.pipe(Zlib.createGzip()).pipe(res);
		framework_internal.onFinished(res, () => framework_internal.destroyStream(stream));
		done && done();
		!req.isStaticFile && F.emit('request-end', req, res);
		req.clear(true);
		return F;
	}

	res.writeHead(200, returnHeaders);
	framework_internal.onFinished(res, (err) => framework_internal.destroyStream(stream));
	stream.pipe(res);

	done && done();
	!req.isStaticFile && F.emit('request-end', req, res);
	req.clear(true);
	return F;
};

/**
 * INTERNAL: Response range (streaming)
 * @param {String} name Temporary name.
 * @param {String} range
 * @param {Object} headers Optional, additional headers.
 * @param {Request} req
 * @param {Response} res
 * @param {Function} done Optional, callback.
 * @return {Framework}
 */
Framework.prototype.responseRange = function(name, range, headers, req, res, done) {

	var arr = range.replace(REG_RANGE, '').split('-');
	var beg = +arr[0] || 0;
	var end = +arr[1] || 0;
	var total = F.temporary.range[name];

	if (!total) {
		total = Fs.statSync(name).size;
		RELEASE && (F.temporary.range[name] = total);
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
		F.stats.response.streaming++;
		F._request_stats(false, req.isStaticFile);
		done && done();
		!req.isStaticFile && F.emit('request-end', req, res);
		return F;
	}

	res.writeHead(206, headers);

	RANGE.start = beg;
	RANGE.end = end;

	fsStreamRead(name, RANGE, function(stream, next) {

		framework_internal.onFinished(res, function() {
			framework_internal.destroyStream(stream);
			next();
		});

		stream.pipe(res);
		F.stats.response.streaming++;
		F._request_stats(false, req.isStaticFile);
		done && done();
		!req.isStaticFile && F.emit('request-end', req, res);
	});

	return F;
};

/**
 * Responds with a binary
 * @param {Request} req
 * @param {Response} res
 * @param {String} contentType
 * @param {Buffer} buffer
 * @param {Encoding} type Default: "binary", optioanl
 * @param {String} download Optional, download name.
 * @param {Object} headers Optional
 * @return {Framework}
 */
Framework.prototype.responseBinary = function(req, res, contentType, buffer, encoding, download, headers, done) {

	if (res.success || res.headersSent) {
		done && done();
		return F;
	}

	if (!encoding)
		encoding = 'binary';

	if (contentType.lastIndexOf('/') === -1)
		contentType = U.getContentType(contentType);

	var accept = req.headers['accept-encoding'] || '';

	if (!accept && isGZIP(req))
		accept = 'gzip';

	var compress = F.config['allow-gzip'] && REQUEST_COMPRESS_CONTENTTYPE[contentType] && accept.indexOf('gzip') !== -1;
	var returnHeaders = compress ? HEADERS['responseBinary.compress'] : HEADERS['responseBinary'];

	returnHeaders['Vary'] = 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : '');

	if (headers)
		returnHeaders = U.extend_headers(returnHeaders, headers);

	if (download)
		returnHeaders['Content-Disposition'] = 'attachment; filename=' + encodeURIComponent(download);
	else if (returnHeaders['Content-Disposition'])
		delete returnHeaders['Content-Disposition'];

	returnHeaders[RESPONSE_HEADER_CONTENTTYPE] = contentType;

	F.stats.response.binary++;
	F._request_stats(false, req.isStaticFile);

	if (req.method === 'HEAD') {
		res.writeHead(200, returnHeaders);
		res.end();
		done && done();
		!req.isStaticFile && F.emit('request-end', req, res);
		req.clear(true);
		return F;
	}

	if (compress) {
		res.writeHead(200, returnHeaders);
		Zlib.gzip(encoding === 'binary' ? buffer : buffer.toString(encoding), (err, buffer) => res.end(buffer));
		done && done();
		!req.isStaticFile && F.emit('request-end', req, res);
		return F;
	}

	res.writeHead(200, returnHeaders);
	res.end(encoding === 'binary' ? buffer : buffer.toString(encoding));

	done && done();
	!req.isStaticFile && F.emit('request-end', req, res);
	req.clear(true);
	return F;
};

Framework.prototype.setModified = function(req, res, value) {
	if (typeof(value) === 'string')
		res.setHeader('Etag', value + F.config['etag-version']);
	else
		res.setHeader('Last-Modified', value.toUTCString());
	return F;
};

Framework.prototype.notModified = function(req, res, compare, strict) {

	var type = typeof(compare);
	if (type === 'boolean') {
		var tmp = compare;
		compare = strict;
		strict = tmp;
		type = typeof(compare);
	}

	var isEtag = type === 'string';
	var val = req.headers[isEtag ? 'if-none-match' : 'if-modified-since'];

	if (isEtag) {
		if (val !== (compare + F.config['etag-version']))
			return false;
	} else {

		if (!val)
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

	F.stats.response.notModified++;
	F._request_stats(false, req.isStaticFile);
	!req.isStaticFile && F.emit('request-end', req, res);
	return true;
};

Framework.prototype.responseCode = function(req, res, code, problem) {
	problem && F.problem(problem, 'response' + code + '()', req.uri, req.ip);
	if (res.success || res.headersSent)
		return F;

	F._request_stats(false, req.isStaticFile);
	res.success = true;
	res.writeHead(code, HEADERS['responseCode']);

	if (req.method === 'HEAD')
		res.end();
	else
		res.end(U.httpStatus(code));

	!req.isStaticFile && F.emit('request-end', req, res);
	req.clear(true);
	var key = 'error' + code;
	F.emit(key, req, res, problem);
	F.stats.response[key]++;
	return F;
};

Framework.prototype.response400 = function(req, res, problem) {
	return F.responseCode(req, res, 400, problem);
};

Framework.prototype.response401 = function(req, res, problem) {
	return F.responseCode(req, res, 401, problem);
};

Framework.prototype.response403 = function(req, res, problem) {
	return F.responseCode(req, res, 403, problem);
};

Framework.prototype.response404 = function(req, res, problem) {
	return F.responseCode(req, res, 404, problem);
};

Framework.prototype.response408 = function(req, res, problem) {
	return F.responseCode(req, res, 408, problem);
};

Framework.prototype.response431 = function(req, res, problem) {
	return F.responseCode(req, res, 431, problem);
};

Framework.prototype.response500 = function(req, res, error) {
	error && F.error(error, null, req.uri);
	if (res.success || res.headersSent)
		return F;

	F._request_stats(false, req.isStaticFile);
	res.success = true;
	res.writeHead(500, HEADERS['responseCode']);

	if (req.method === 'HEAD')
		res.end();
	else
		res.end(U.httpStatus(500) + prepare_error(error));

	!req.isStaticFile && F.emit('request-end', req, res);
	req.clear(true);
	F.stats.response.error500++;
	return F;
};

Framework.prototype.response501 = function(req, res, problem) {
	return F.responseCode(req, res, 501, problem);
};

Framework.prototype.response503 = function(req, res) {
	var keys = '';
	var headers = {};
	headers[RESPONSE_HEADER_CACHECONTROL] = 'private, no-cache, no-store, must-revalidate';
	headers[RESPONSE_HEADER_CONTENTTYPE] = CONTENTTYPE_TEXTHTML;
	res.writeHead(503, headers);
	for (var m in F.waits)
		keys += (keys ? ', ' : '') + '<u>' + m + '</u>';
	res.end('<html><head><meta charset="utf-8" /></head><body style="font:normal normal 11px Arial;color:gray;line-height:16px;padding:10px;background-color:white"><div style="font-size:14px;color:#505050">Please wait (<span id="time">10</span>) for <b>' + (F.config.name + ' v' + F.config.version) + '</b> application.</div>The application is waiting for: ' + keys + '.<script>var i=10;setInterval(function(){i--;if(i<0)return;document.getElementById("time").innerHTML=(i===0?"refreshing":i);if(i===0)window.location.reload();},1000);</script></body></html>', ENCODING);
	return F;
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
	if (res.success || res.headersSent)
		return F;

	res.success = true;

	var accept = req.headers['accept-encoding'] || '';

	if (!accept && isGZIP(req))
		accept = 'gzip';

	var gzip = compress ? accept.indexOf('gzip') !== -1 : false;
	var returnHeaders;

	if (req.$mobile)
		returnHeaders = gzip ? HEADERS['responseContent.mobile.compress'] : HEADERS['responseContent.mobile'];
	else
		returnHeaders = gzip ? HEADERS['responseContent.compress'] : HEADERS.responseContent;

	if (headers)
		returnHeaders = U.extend_headers(returnHeaders, headers);

	// Safari resolve
	if (contentType === 'application/json')
		returnHeaders[RESPONSE_HEADER_CACHECONTROL] = 'private, no-cache, no-store, must-revalidate';
	else
		returnHeaders[RESPONSE_HEADER_CACHECONTROL] = 'private';

	if (REG_TEXTAPPLICATION.test(contentType))
		contentType += '; charset=utf-8';

	returnHeaders[RESPONSE_HEADER_CONTENTTYPE] = contentType;

	if (req.method === 'HEAD') {
		res.writeHead(code, returnHeaders);
		res.end();
	} else {
		if (gzip) {
			res.writeHead(code, returnHeaders);
			Zlib.gzip(contentBody instanceof Buffer ? contentBody : U.createBuffer(contentBody), (err, data) => res.end(data, ENCODING));
		} else {
			res.writeHead(code, returnHeaders);
			res.end(contentBody, ENCODING);
		}
	}

	F._request_stats(false, req.isStaticFile);
	!req.isStaticFile && F.emit('request-end', req, res);
	req.clear(true);
	return F;
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
	if (res.success || res.headersSent)
		return F;
	F._request_stats(false, req.isStaticFile);
	res.success = true;
	var headers = HEADERS.responseRedirect;
	headers.Location = url;
	res.writeHead(permanent ? 301 : 302, headers);
	res.end();
	!req.isStaticFile && F.emit('request-end', req, res);
	req.clear(true);
	return F;
};

Framework.prototype.load = function(debug, types, pwd) {

	if (pwd && pwd[0] === '.' && pwd.length < 4)
		F.directory = directory = U.$normalize(Path.normalize(directory + '/..'));
	else if (pwd)
		F.directory = directory = U.$normalize(pwd);

	F.isWorker = true;
	F.config.debug = debug;
	F.isDebug = debug;

	global.DEBUG = debug;
	global.RELEASE = !debug;
	global.I = global.isomorphic = F.isomorphic;

	F.$startup(function() {

		F._configure();

		if (!types || types.indexOf('versions') !== -1)
			F._configure_versions();

		if (!types || types.indexOf('workflows') !== -1)
			F._configure_workflows();

		if (!types || types.indexOf('sitemap') !== -1)
			F._configure_sitemap();

		F.cache.init();
		F.emit('init');
		F.isLoaded = true;

		setTimeout(function() {

			try {
				F.emit('load', F);
				F.emit('ready', F);
			} catch (err) {
				F.error(err, 'F.on("load/ready")');
			}

			F.removeAllListeners('load');
			F.removeAllListeners('ready');

			// clear unnecessary items
			delete F.tests;
			delete F.test;
			delete F.testing;
			delete F.assert;
		}, 500);

		F.$load(types, directory);
	});

	return F;
};

/**
 * Initialize framework
 * @param  {Object} http
 * @param  {Boolean} debug
 * @param  {Object} options
 * @return {Framework}
 */
Framework.prototype.initialize = function(http, debug, options, restart) {

	if (!options)
		options = {};

	var port = options.port;
	var ip = options.ip;

	if (options.config)
		U.copy(options.config, F.config);

	F.isHTTPS = typeof(http.STATUS_CODES) === 'undefined';
	if (isNaN(port) && typeof(port) !== 'string')
		port = null;

	F.config.debug = debug;
	F.isDebug = debug;

	global.DEBUG = debug;
	global.RELEASE = !debug;
	global.I = global.isomorphic = F.isomorphic;

	F._configure();
	F._configure_versions();
	F._configure_workflows();
	F._configure_sitemap();
	F.isTest && F._configure('config-test', false);
	F.cache.init();
	F.emit('init');

	// clears static files
	F.clear(function() {

		F.$load(undefined, directory);

		if (!port) {
			if (F.config['default-port'] === 'auto') {
				var envPort = +(process.env.PORT || '');
				if (!isNaN(envPort))
					port = envPort;
			} else
				port = F.config['default-port'];
		}

		F.port = port || 8000;

		if (ip !== null) {
			F.ip = ip || F.config['default-ip'] || '127.0.0.1';
			if (F.ip === 'null' || F.ip === 'undefined' || F.ip === 'auto')
				F.ip = undefined;
		} else
			F.ip = undefined;

		if (F.ip == null)
			F.ip = 'auto';

		if (F.server) {
			F.server.removeAllListeners();

			Object.keys(F.connections).forEach(function(key) {
				var item = F.connections[key];
				if (!item)
					return;
				item.removeAllListeners();
				item.close();
			});

			F.server.close();
		}

		if (options.https)
			F.server = http.createServer(options.https, F.listener);
		else
			F.server = http.createServer(F.listener);

		F.config['allow-performance'] && F.server.on('connection', function(socket) {
			socket.setNoDelay(true);
			socket.setKeepAlive(true, 10);
		});

		F.config['allow-websocket'] && F.server.on('upgrade', F._upgrade);
		F.server.listen(F.port, F.ip === 'auto' ? undefined : F.ip);
		F.isLoaded = true;

		if (!process.connected || restart)
			F.console();

		setTimeout(function() {
			try {
				F.emit('load', F);
				F.emit('ready', F);
			} catch (err) {
				F.error(err, 'F.on("load/ready")');
			}

			F.removeAllListeners('load');
			F.removeAllListeners('ready');
			options.package && INSTALL('package', options.package);
		}, 500);

		if (F.isTest) {
			var sleep = options.sleep || options.delay || 1000;
			global.TEST = true;
			global.assert = require('assert');
			setTimeout(() => F.test(true, options.tests || options.test), sleep);
			return F;
		}

		setTimeout(function() {
			if (F.isTest)
				return;
			delete F.tests;
			delete F.test;
			delete F.testing;
			delete F.assert;
		}, 5000);
	}, true);

	return F;
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
		options.port = +process.argv[2];

	return F.mode(require('http'), mode, options);
};

/**
 * Run framework –> HTTPS
 * @param {String} mode Framework mode.
 * @param {Object} options Framework settings.
 * @return {Framework}
 */
Framework.prototype.https = function(mode, options) {
	return F.mode(require('https'), mode, options || {});
};

/**
 * Changes the framework mode
 * @param {String} mode New mode (e.g. debug or release)
 * @return {Framework}
 */
Framework.prototype.mode = function(http, name, options) {

	var test = false;
	var debug = false;

	if (options.directory)
		F.directory = directory = options.directory;

	if (typeof(http) === 'string') {
		switch (http) {
			case 'debug':
			case 'development':
				debug = true;
				break;
		}
		F.config.debug = debug;
		F.config.trace = debug;
		F.isDebug = debug;
		global.DEBUG = debug;
		global.RELEASE = !debug;
		return F;
	}

	F.isWorker = false;

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
		case 'debug-test':
		case 'testing-debug':
			test = true;
			debug = true;
			F.isTest = true;
			break;

		case 'test-release':
		case 'release-test':
		case 'testing-release':
		case 'test-production':
		case 'testing-production':
			test = true;
			debug = false;
			break;
	}

	var restart = false;
	if (F.temporary.init)
		restart = true;
	else
		F.temporary.init = { name: name, isHTTPS: typeof(http.STATUS_CODES) === 'undefined', options: options };

	F.config.trace = debug;
	F.$startup(n => F.initialize(http, debug, options, restart));
	return F;
};

Framework.prototype.console = function() {
	console.log('====================================================');
	console.log('PID         : ' + process.pid);
	console.log('Node.js     : ' + process.version);
	console.log('Total.js    : v' + F.version_header);
	console.log('OS          : ' + Os.platform() + ' ' + Os.release());
	console.log('====================================================');
	console.log('Name        : ' + F.config.name);
	console.log('Version     : ' + F.config.version);
	console.log('Author      : ' + F.config.author);
	console.log('Date        : ' + F.datetime.format('yyyy-MM-dd HH:mm:ss'));
	console.log('Mode        : ' + (F.config.debug ? 'debug' : 'release'));
	console.log('====================================================\n');
	console.log('{2}://{0}:{1}/'.format(F.ip, F.port, F.isHTTPS ? 'https' : 'http'));
	console.log('');
};

/**
 * Re-connect server
 * @return {Framework}
 */
Framework.prototype.reconnect = function() {
	if (F.config['default-port'] !== undefined)
		F.port = F.config['default-port'];
	if (F.config['default-ip'] !== undefined)
		F.ip = F.config['default-ip'];
	F.server.close(() => F.server.listen(F.port, F.ip));
	return F;
};

/**
 * Internal service
 * @private
 * @param {Number} count Run count.
 * @return {Framework}
 */
Framework.prototype._service = function(count) {

	UIDGENERATOR.date = F.datetime.format('yyMMddHHmm');
	UIDGENERATOR.index = 1;

	var releasegc = false;

	// clears temporary memory for non-exist files
	F.temporary.notfound = {};

	// every 7 minutes (default) service clears static cache
	if (count % F.config['default-interval-clear-cache'] === 0) {

		F.emit('clear', 'temporary', F.temporary);
		F.temporary.path = {};
		F.temporary.range = {};
		F.temporary.views = {};
		F.temporary.other = {};
		global.$VIEWCACHE && global.$VIEWCACHE.length && (global.$VIEWCACHE = []);

		// Clears command cache
		Image.clear();

		var dt = F.datetime.add('-5 minutes');
		for (var key in F.databases)
			F.databases[key] && F.databases[key].inmemorylastusage < dt && F.databases[key].release();

		releasegc = true;
	}

	// every 61 minutes (default) services precompile all (installed) views
	if (count % F.config['default-interval-precompile-views'] === 0) {
		for (var key in F.routes.views) {
			var item = F.routes.views[key];
			F.install('view', key, item.url, null);
		}
	}

	if (count % F.config['default-interval-clear-dnscache'] === 0) {
		F.emit('clear', 'dns');
		U.clearDNS();
	}

	var ping = F.config['default-interval-websocket-ping'];
	if (ping > 0 && count % ping === 0) {
		for (var item in F.connections) {
			var conn = F.connections[item];
			if (conn) {
				conn.check();
				conn.ping();
			}
		}
	}

	if (F.uptodates && (count % F.config['default-interval-uptodate'] === 0) && F.uptodates.length) {
		var hasUpdate = false;
		F.uptodates.wait(function(item, next) {

			if (item.updated.add(item.interval) > F.datetime)
				return next();

			item.updated = F.datetime;
			item.count++;

			setTimeout(function() {

				F.install(item.type, item.url, item.options, function(err, name, skip) {

					if (skip)
						return next();

					if (err) {
						item.errors.push(err);
						item.errors.length > 50 && F.errors.shift();
					} else {
						hasUpdate = true;
						item.name = name;
						F.emit('uptodate', item.type, name);
					}

					item.callback && item.callback(err, name);
					next();

				}, undefined, undefined, undefined, undefined, item.name);

			}, item.name ? 500 : 1);

		}, function() {
			if (hasUpdate) {
				F.temporary.path = {};
				F.temporary.range = {};
				F.temporary.views = {};
				F.temporary.other = {};
				global.$VIEWCACHE && global.$VIEWCACHE.length && (global.$VIEWCACHE = []);
			}
		});
	}

	// every 20 minutes (default) service clears resources
	if (count % F.config['default-interval-clear-resources'] === 0) {
		F.emit('clear', 'resources');
		F.resources = {};
		releasegc = true;
	}

	// Update expires date
	count % 1000 === 0 && (DATE_EXPIRES = F.datetime.add('y', 1).toUTCString());

	F.emit('service', count);
	releasegc && global.gc && setTimeout(() => global.gc(), 1000);

	// Run schedules
	if (!F.schedules.length)
		return F;

	var expire = F.datetime.getTime();
	var index = 0;

	while (true) {
		var schedule = F.schedules[index++];
		if (!schedule)
			break;
		if (schedule.expire > expire)
			continue;

		index--;

		if (schedule.repeat)
			schedule.expire = F.datetime.add(schedule.repeat);
		else
			F.schedules.splice(index, 1);

		schedule.fn.call(F);
	}

	return F;
};

/**
 * Request processing
 * @private
 * @param {Request} req
 * @param {Response} res
 */
Framework.prototype.listener = function(req, res) {

	if (F._length_wait)
		return F.response503(req, res);
	else if (!req.host) // HTTP 1.0 without host
		return F.response400(req, res);

	var headers = req.headers;
	var protocol = req.connection.encrypted || headers['x-forwarded-protocol'] === 'https' ? 'https' : 'http';

	res.req = req;
	req.res = res;
	req.uri = framework_internal.parseURI(protocol, req);

	F.stats.request.request++;
	F.emit('request', req, res);

	if (F._request_check_redirect) {
		var redirect = F.routes.redirects[protocol + '://' + req.host];
		if (redirect) {
			F.stats.response.forward++;
			F.responseRedirect(req, res, redirect.url + (redirect.path ? req.url : ''), redirect.permanent);
			return;
		}
	}

	req.path = framework_internal.routeSplit(req.uri.pathname);
	req.processing = 0;
	req.isAuthorized = true;
	req.xhr = headers['x-requested-with'] === 'XMLHttpRequest';
	res.success = false;
	req.session = null;
	req.user = null;
	req.isStaticFile = F.config['allow-handle-static-files'] && U.isStaticFile(req.uri.pathname);

	var can = true;

	if (req.isStaticFile) {
		req.extension = U.getExtension(req.uri.pathname);
		switch (req.extension) {
			case 'html':
			case 'htm':
			case 'txt':
			case 'md':
				break;
			default:
				can = false;
				break;
		}
	}

	if (can && F.onLocale)
		req.$language = F.onLocale(req, res, req.isStaticFile);

	F._request_stats(true, true);

	if (F._length_request_middleware)
		async_middleware(0, req, res, F.routes.request, () => F._request_continue(res.req, res, res.req.headers, protocol));
	else
		F._request_continue(req, res, headers, protocol);
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

	if (!req || !res || res.headersSent || res.success)
		return;

	// Validates if this request is the file (static file)
	if (req.isStaticFile) {
		F.stats.request.file++;
		if (F._length_files)
			new Subscribe(F, req, res, 3).file();
		else
			F.responseStatic(req, res);
		return F;
	}

	req.body = EMPTYOBJECT;
	req.files = EMPTYARRAY;
	req.isProxy = headers['x-proxy'] === 'total.js';
	req.buffer_exceeded = false;
	req.buffer_has = false;
	req.$flags = req.method[0] + req.method[1];
	F.stats.request.web++;

	var flags = [req.method.toLowerCase()];
	var multipart = req.headers['content-type'] || '';

	if (req.mobile) {
		req.$flags += 'a';
		F.stats.request.mobile++;
	} else
		F.stats.request.desktop++;

	if (protocol[5])
		req.$flags += protocol[5];

	req.$type = 0;
	flags.push(protocol);

	var method = req.method;
	var first = method[0];
	if (first === 'P' || first === 'D') {
		req.buffer_data = U.createBuffer();
		var index = multipart.lastIndexOf(';');
		var tmp = multipart;
		if (index !== -1)
			tmp = tmp.substring(0, index);
		switch (tmp.substring(tmp.length - 4)) {
			case 'json':
				req.$flags += 'b';
				flags.push('json');
				req.$type = 1;
				multipart = '';
				break;
			case 'oded':
				req.$type = 3;
				multipart = '';
				break;
			case 'data':
				req.$flags += 'c';
				flags.push('upload');
				break;
			case '/xml':
				req.$flags += 'd';
				flags.push('xml');
				req.$type = 2;
				multipart = '';
				break;
			case 'lace':
				req.$type = 4;
				flags.push('mmr');
				req.$flags += 'e';
				break;
			default:
				if (multipart) {
					// 'undefined' DATA
					multipart = '';
					flags.push('raw');
				} else {
					req.$type = 3;
					multipart = '';
				}
				break;
		}
	}

	if (req.isProxy) {
		req.$flags += 'f';
		flags.push('proxy');
	}

	if (headers.accept === 'text/event-stream') {
		req.$flags += 'g';
		flags.push('sse');
	}

	if (F.config.debug) {
		req.$flags += 'h';
		flags.push('debug');
	}

	if (req.xhr) {
		F.stats.request.xhr++;
		req.$flags += 'i';
		flags.push('xhr');
	}

	if (F._request_check_robot && req.robot)
		req.$flags += 'j';

	if (F._request_check_referer) {
		var referer = headers['referer'];
		if (referer && referer.indexOf(headers['host']) !== -1) {
			req.$flags += 'k';
			flags.push('referer');
		}
	}

	req.flags = flags;
	F.emit('request-begin', req, res);

	var isCORS = req.headers['origin'] && F._length_cors;

	switch (first) {
		case 'G':
			F.stats.request.get++;
			if (isCORS)
				F._cors(req, res, (req, res) => new Subscribe(framework, req, res, 0).end());
			else
				new Subscribe(F, req, res, 0).end();
			return F;

		case 'O':
			F.stats.request.options++;
			if (isCORS)
				F._cors(req, res, (req, res) => new Subscribe(framework, req, res, 0).end());
			else
				new Subscribe(framework, req, res, 0).end();
			return F;

		case 'H':
			F.stats.request.head++;
			if (isCORS)
				F._cors(req, res, (req, res) => new Subscribe(framework, req, res, 0).end());
			else
				new Subscribe(F, req, res, 0).end();
			return F;

		case 'D':
			F.stats.request['delete']++;
			if (isCORS)
				F._cors(req, res, (req, res) => new Subscribe(framework, req, res, 1).urlencoded());
			else
				new Subscribe(F, req, res, 1).urlencoded();
			return F;

		case 'P':
			if (F._request_check_POST) {

				if (multipart) {

					if (isCORS)
						F._cors(req, res, (req, res, multipart) => req.$type === 4 ? F._request_mmr(req, res, multipart) : new Subscribe(F, req, res, 2).multipart(multipart), multipart);
					else if (req.$type === 4)
						F._request_mmr(req, res, multipart);
					else
						new Subscribe(F, req, res, 2).multipart(multipart);

					return F;

				} else {
					if (method === 'PUT')
						F.stats.request.put++;
					else if (method === 'PATCH')
						F.stats.request.path++;
					else
						F.stats.request.post++;
					if (isCORS)
						F._cors(req, res, (req, res) => new Subscribe(F, req, res, 1).urlencoded());
					else
						new Subscribe(F, req, res, 1).urlencoded();
				}

				return F;
			}
			break;
	}

	F.emit('request-end', req, res);
	F._request_stats(false, false);
	F.stats.request.blocked++;
	res.writeHead(403);
	res.end();
	return F;
};

Framework.prototype._request_mmr = function(req, res, header) {
	var route = F.routes.mmr[req.url];
	F.stats.request.mmr++;

	if (route) {
		F.path.verify('temp');
		framework_internal.parseMULTIPART_MIXED(req, header, F.config['directory-temp'], route.exec);
		return;
	}

	F.emit('request-end', req, res);
	F._request_stats(false, false);
	F.stats.request.blocked++;
	res.writeHead(403);
	res.end();
};

Framework.prototype._cors = function(req, res, fn, arg) {

	var isAllowed = false;
	var cors;

	for (var i = 0; i < F._length_cors; i++) {
		cors = F.routes.cors[i];
		if (framework_internal.routeCompare(req.path, cors.url, false, cors.isASTERIX)) {
			isAllowed = true;
			break;
		}
	}

	if (!isAllowed)
		return fn(req, res, arg);

	var stop = false;
	var headers = req.headers;

	if (!isAllowed)
		stop = true;

	isAllowed = false;

	if (!stop && cors.headers) {
		isAllowed = false;
		for (var i = 0, length = cors.headers.length; i < length; i++) {
			if (headers[cors.headers[i]]) {
				isAllowed = true;
				break;
			}
		}
		if (!isAllowed)
			stop = true;
	}

	if (!stop && cors.methods) {
		isAllowed = false;
		var current = headers['access-control-request-method'] || req.method;
		if (current !== 'OPTIONS') {
			for (var i = 0, length = cors.methods.length; i < length; i++) {
				if (current.indexOf(cors.methods[i]) !== -1)
					isAllowed = true;
			}

			if (!isAllowed)
				stop = true;
		}
	}

	var origin = headers['origin'].toLowerCase();
	if (!stop && cors.origins) {
		isAllowed = false;
		for (var i = 0, length = cors.origins.length; i < length; i++) {
			if (cors.origins[i].indexOf(origin) !== -1) {
				isAllowed = true;
				break;
			}
		}
		if (!isAllowed)
			stop = true;
	}

	var name
	var isOPTIONS = req.method === 'OPTIONS';

	res.setHeader('Access-Control-Allow-Origin', cors.origins ? cors.origins : cors.credentials ? isAllowed ? origin : cors.origins ? cors.origins : origin : headers['origin']);
	cors.credentials && res.setHeader('Access-Control-Allow-Credentials', 'true');

	name = 'Access-Control-Allow-Methods';

	if (cors.methods)
		res.setHeader(name, cors.methods.join(', '));
	else
		res.setHeader(name, isOPTIONS ? headers['access-control-request-method'] || '*' : req.method);

	name = 'Access-Control-Allow-Headers';

	if (cors.headers)
		res.setHeader(name, cors.headers.join(', '));
	else
		res.setHeader(name, headers['access-control-request-headers'] || '*');

	cors.age && res.setHeader('Access-Control-Max-Age', cors.age);

	if (stop) {
		fn = null;
		F.emit('request-end', req, res);
		F._request_stats(false, false);
		F.stats.request.blocked++;
		res.writeHead(404);
		res.end();
		return;
	}

	if (!isOPTIONS)
		return fn(req, res, arg);

	fn = null;
	F.emit('request-end', req, res);
	F._request_stats(false, false);
	res.writeHead(200);
	res.end();
	return F;
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

	// disables timeout
	socket.setTimeout(0);
	socket.on('error', NOOP);

	var headers = req.headers;
	var protocol = req.connection.encrypted || headers['x-forwarded-protocol'] === 'https' ? 'https' : 'http';

	req.uri = framework_internal.parseURI(protocol, req);

	F.emit('websocket', req, socket, head);
	F.stats.request.websocket++;

	req.session = null;
	req.user = null;
	req.flags = [req.secured ? 'https' : 'http', 'get'];

	var path = U.path(req.uri.pathname);
	var websocket = new WebSocketClient(req, socket, head);

	req.path = framework_internal.routeSplit(req.uri.pathname);
	req.websocket = websocket;

	if (F.onLocale)
		req.$language = F.onLocale(req, socket);

	if (F._length_request_middleware)
		async_middleware(0, req, req.websocket, F.routes.request, () => F._upgrade_prepare(req, path, req.headers));
	else
		F._upgrade_prepare(req, path, headers);
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
	var auth = F.onAuthorize;
	if (auth) {
		auth.call(F, req, req.websocket, req.flags, function(isLogged, user) {

			if (user)
				req.user = user;

			var route = F.lookup_websocket(req, req.websocket.uri.pathname, isLogged ? 1 : 2);
			if (route) {
				F._upgrade_continue(route, req, path);
			} else {
				req.websocket.close();
				req.connection.destroy();
			}
		});
	} else {
		var route = F.lookup_websocket(req, req.websocket.uri.pathname, 0);
		if (route) {
			F._upgrade_continue(route, req, path);
		} else {
			req.websocket.close();
			req.connection.destroy();
		}
	}
};

/**
 * Prepare WebSocket
 * @private
 * @param {HttpRequest} req
 * @param {WebSocketClient} websocket
 * @param {String} path
 * @param {Object} headers
 */
Framework.prototype._upgrade_continue = function(route, req, path) {

	var socket = req.websocket;

	if (!socket.prepare(route.flags, route.protocols, route.allow, route.length, F.version_header)) {
		socket.close();
		req.connection.destroy();
		return;
	}

	var id = path + (route.flags.length ? '#' + route.flags.join('-') : '');

	if (route.isBINARY)
		socket.type = 1;
	else if (route.isJSON)
		socket.type = 3;

	var next = function() {

		if (F.connections[id]) {
			socket.upgrade(F.connections[id]);
			return;
		}

		var connection = new WebSocket(path, route.controller, id);
		connection.route = route;
		connection.options = route.options;
		F.connections[id] = connection;
		route.onInitialize.apply(connection, framework_internal.routeParam(route.param.length ? req.split : req.path, route));
		setImmediate(() => socket.upgrade(connection));
	};

	if (route.middleware)
		async_middleware(0, req, req.websocket, route.middleware, next, route.options);
	else
		next();
};

/**
 * Request statistics writer
 * @private
 * @param {Boolean} beg
 * @param {Boolean} isStaticFile
 * @return {Framework}
 */
Framework.prototype._request_stats = function(beg, isStaticFile) {

	if (beg)
		F.stats.request.pending++;
	else
		F.stats.request.pending--;

	if (F.stats.request.pending < 0)
		F.stats.request.pending = 0;

	return F;
};

/**
 * Get a model
 * @param {String} name
 * @return {Object}
 */
Framework.prototype.model = function(name) {
	var obj = F.models[name];
	if (obj || obj === null)
		return obj;
	var filename = U.combine(F.config['directory-models'], name + '.js');
	existsSync(filename) && F.install('model', name, filename, undefined, undefined, undefined, true);
	return F.models[name] || null;
};

/**
 * Load a source code
 * @param {String} name
 * @param {Object} options Custom initial options, optional.
 * @return {Object}
 */
Framework.prototype.source = function(name, options, callback) {
	var obj = F.sources[name];
	if (obj || obj === null)
		return obj;
	var filename = U.combine(F.config['directory-source'], name + '.js');
	existsSync(filename) && F.install('source', name, filename, options, callback, undefined, true);
	return F.sources[name] || null;
};

/**
 * Load a source code (alias for F.source())
 * @param {String} name
 * @param {Object} options Custom initial options, optional.
 * @return {Object}
 */
Framework.prototype.include = function(name, options, callback) {
	return F.source(name, options, callback);
};

/**
 * Internal logger
 * @private
 * @param {String} message
 * @return {Framework}
 */
Framework.prototype._log = function(a, b, c, d) {

	if (RELEASE)
		return false;

	var length = arguments.length;
	var params = ['---->'];

	for (var i = 0; i < length; i++)
		params.push(arguments[i]);

	setTimeout(() => console.log.apply(console, params), 1000);
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

	if (typeof(callback) === 'string') {
		var tmp = language;
		language = callback;
		callback = tmp;
	}

	var controller = EMPTYCONTROLLER;
	controller.layoutName = '';
	controller.themeName = U.parseTheme(view);

	if (controller.themeName)
		view = prepare_viewname(view);
	else if (this.onTheme)
		controller.themeName = this.onTheme(controller);
	else
		controller.themeName = '';

	var replyTo;

	// Translation
	if (typeof(language) === 'string') {
		subject = subject.indexOf('@(') === -1 ? F.translate(language, subject) : F.translator(language, subject);
		controller.language = language;
	}

	if (typeof(repository) === 'object' && repository)
		controller.repository = repository;

	return controller.mail(address, subject, view, model, callback, replyTo);
};

/**
 * Renders view
 * @param {String} name View name.
 * @param {Object} model Model.
 * @param {String} layout Layout for the view, optional. Default without layout.
 * @param {Object} repository A repository object, optional. Default empty.
 * @param {String} language Optional.
 * @return {String}
 */
Framework.prototype.view = function(name, model, layout, repository, language) {

	var controller = EMPTYCONTROLLER;

	if (typeof(layout) === 'object') {
		var tmp = repository;
		repository = layout;
		layout = tmp;
	}

	controller.layoutName = layout || '';
	controller.language = language || '';
	controller.repository = typeof(repository) === 'object' && repository ? repository : EMPTYOBJECT;

	var theme = U.parseTheme(name);
	if (theme) {
		controller.themeName = theme;
		name = prepare_viewname(name);
	} else if (this.onTheme)
		controller.themeName = this.onTheme(controller);
	else
		controller.themeName = undefined;

	return controller.view(name, model, true);
};

/**
 * Compiles and renders view
 * @param {String} body HTML body.
 * @param {Object} model Model.
 * @param {String} layout Layout for the view, optional. Default without layout.
 * @param {Object} repository A repository object, optional. Default empty.
 * @param {String} language Optional.
 * @return {String}
 */
Framework.prototype.viewCompile = function(body, model, layout, repository, language) {

	var controller = EMPTYCONTROLLER;

	if (typeof(layout) === 'object') {
		var tmp = repository;
		repository = layout;
		layout = tmp;
	}

	controller.layoutName = layout || '';
	controller.language = language || '';
	controller.themeName = undefined;
	controller.repository = typeof(repository) === 'object' && repository ? repository : EMPTYOBJECT;

	return controller.viewCompile(body, model, true);
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

	// !IMPORTANT! F.testsPriority is created dynamically in F.test()
	if (typeof(url) === 'function') {
		F.tests.push({ name: _test + ': ' + name, priority: F.testsPriority, index: F.tests.length, run: url });
		return F;
	}

	var method = 'GET';
	var length = 0;
	var type = 0;

	if (headers)
		headers = U.extend({}, headers);
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
				case 'head':
				case 'options':
					method = flags[i].toUpperCase();

					if (data) {
						if (typeof(data) === 'object')
							url += '?' + Qs.stringify(data);
						else
							url += data[0] === '?' ? data : '?' + data;
						data = '';
					}

					break;

				case 'upload':
					headers['Content-Type'] = 'multipart/form-data';
					break;

				case 'robot':
					if (headers['User-Agent'])
						headers['User-Agent'] += ' Bot';
					else
						headers['User-Agent'] = 'Bot';
					break;

				case 'mobile':
					if (headers['User-Agent'])
						headers['User-Agent'] += ' iPhone';
					else
						headers['User-Agent'] = 'iPhone';
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

	if (cookies) {
		var builder = [];
		var keys = Object.keys(cookies);

		length = keys.length;

		for (var i = 0; i < length; i++)
			builder.push(keys[i] + '=' + encodeURIComponent(cookies[keys[i]]));

		if (builder.length)
			headers['Cookie'] = builder.join('; ');
	}

	var obj = { name: _test + ': ' + name, priority: F.testsPriority, index: F.tests.length, url: url, callback: callback, method: method, data: data, headers: headers };
	F.tests.push(obj);
	return F;
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


	// !IMPORTANT! F.isTestError is created dynamically
	//             F.testsFiles too

	if (!F.tests.length) {

		if (!F.testsFiles.length) {
			callback && callback(F.isTestError === true);
			stop && F.stop(F.isTestError ? 1 : 0);
			return F;
		}

		var file = F.testsFiles.shift();
		file && file.fn.call(F, F);
		F.testing(stop, callback);
		return F;
	}

	var logger = function(name, start, err) {

		var time = Math.floor(new Date() - start) + ' ms';

		if (err) {
			F.isTestError = true;
			console.error('Failed [x] '.padRight(20, '.') + ' ' + name + ' <' + (err.name.toLowerCase().indexOf('assert') !== -1 ? err.toString() : err.stack) + '> [' + time + ']');
		} else
			console.info('Passed '.padRight(20, '.') + ' ' + name + ' [' + time + ']');
	};

	var test = F.tests.shift();
	var key = test.name;
	var beg = new Date();

	if (test.run) {

		// Is used in: process.on('uncaughtException')
		F.testContinue = function(err) {
			logger(key, beg, err);
			if (err)
				F.testsNO++;
			else
				F.testsOK++;
			F.testing(stop, callback);
		};

		test.run.call(F, function() {
			logger(key, beg);
			F.testsOK++;
			F.testing(stop, callback);
		}, key);

		return F;
	}

	var response = function(res) {

		res.on('data', function(chunk) {
			if (this._buffer)
				this._buffer = Buffer.concat([this._buffer, chunk]);
			else
				this._buffer = chunk;
		});

		res.on('end', function() {

			res.removeAllListeners();

			var cookie = res.headers['cookie'] || '';
			var cookies = {};

			if (cookie.length) {

				var arr = cookie.split(';');
				var length = arr.length;

				for (var i = 0; i < length; i++) {
					var c = arr[i].trim().split('=');
					cookies[c.shift()] = unescape(c.join('='));
				}
			}

			try {
				test.callback(null, this._buffer ? this._buffer.toString(ENCODING) : '', res.statusCode, res.headers, cookies, key);
				logger(key, beg);
				F.testsOK++;
			} catch (e) {
				F.testsNO++;
				logger(key, beg, e);
			}

			F.testing(stop, callback);
		});

		res.resume();
	};

	var options = Parser.parse((test.url.startsWith('http://', true) || test.url.startsWith('https://', true) ? '' : 'http://' + F.ip + ':' + F.port) + test.url);
	if (typeof(test.data) === 'function')
		test.data = test.data();

	if (typeof(test.data) !== 'string')
		test.data = (test.headers[RESPONSE_HEADER_CONTENTTYPE] || '').indexOf('json') !== -1 ? JSON.stringify(test.data) : Qs.stringify(test.data);

	var buf;

	if (test.data && test.data.length) {
		buf = U.createBuffer(test.data);
		test.headers[RESPONSE_HEADER_CONTENTLENGTH] = buf.length;
	}

	options.method = test.method;
	options.headers = test.headers;

	var con = options.protocol === 'https:' ? require('https') : http;
	var req = test.method === 'POST' || test.method === 'PUT' || test.method === 'DELETE' || test.method === 'PATCH' ? con.request(options, response) : con.get(options, response);

	req.on('error', function(e) {
		req.removeAllListeners();
		logger(key, beg, e);
		F.testsNO++;
		F.testing(stop, callback);
	});

	req.end(buf);
	return F;
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

	if (stop === undefined)
		stop = true;

	if (typeof(names) === 'function') {
		cb = names;
		names = [];
	} else
		names = names || [];

	var counter = 0;
	var dir = F.config['directory-tests'];
	F.isTest = true;
	F._configure('config-test', true);

	var logger = function(name, start, err) {
		var time = Math.floor(new Date() - start) + ' ms';
		if (err) {
			F.isTestError = true;
			console.error('Failed [x] '.padRight(20, '.') + ' ' + name + ' <' + (err.name.toLowerCase().indexOf('assert') !== -1 ? err.toString() : err.stack) + '> [' + time + ']');
		} else
			console.info('Passed '.padRight(20, '.') + ' ' + name + ' [' + time + ']');
	};

	var results = function() {
		if (!F.testsResults.length)
			return;
		console.log('');
		console.log('===================== RESULTS ======================');
		console.log('');
		F.testsResults.forEach((fn) => fn());
	};

	F.testsFiles = [];

	if (!F.testsResults)
		F.testsResults = [];

	if (!F.testsOK)
		F.testsOK = 0;

	if (!F.testsNO)
		F.testsNO = 0;

	U.ls(U.combine(dir), function(files) {
		files.forEach(function(filePath) {
			var name = Path.relative(U.combine(dir), filePath);
			var filename = filePath;
			var ext = U.getExtension(filename).toLowerCase();
			if (ext !== 'js')
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

				F.testsPriority = test.priority === undefined ? F.testsFiles.length : test.priority;
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

				F.testsFiles.push({ name: name, index: F.testsFiles.length, fn: fn, priority: F.testsPriority });

				test.usage && (function(test) {
					F.testsResults.push(() => test.usage(name));
				})(test);

				counter++;

			} catch (ex) {
				logger('Failed', beg, ex);
			}
		});

		_test = '';

		F.testsFiles.sort(function(a, b) {

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
			counter && console.log('');
			F.testing(stop, function() {

				console.log('');
				console.log('Passed ...', F.testsOK);
				console.log('Failed ...', F.testsNO);
				console.log('');

				results();
				F.isTest = false;
				console.log('');
				cb && cb();
			});
		}, 100);
	});

	return F;
};

/**
 * Clear temporary directory
 * @param {Function} callback
 * @param {Boolean} isInit Private argument.
 * @return {Framework}
 */
Framework.prototype.clear = function(callback, isInit) {

	var dir = F.path.temp();
	var plus = F.id ? 'i-' + F.id + '_' : '';

	if (isInit) {
		if (F.config['disable-clear-temporary-directory']) {
			// clears only JS and CSS files
			U.ls(dir, function(files, directories) {
				F.unlink(files, function() {
					callback && callback();
				});
			}, function(filename, folder) {
				if (folder || (plus && !filename.substring(dir.length).startsWith(plus)))
					return false;
				var ext = U.getExtension(filename);
				return ext === 'js' || ext === 'css' || ext === 'tmp' || ext === 'upload' || ext === 'html' || ext === 'htm';
			});

			return F;
		}
	}

	if (!existsSync(dir)) {
		callback && callback();
		return F;
	}

	U.ls(dir, function(files, directories) {

		if (isInit) {
			var arr = [];
			for (var i = 0, length = files.length; i < length; i++) {
				var filename = files[i].substring(dir.length);
				if (plus && !filename.startsWith(plus))
					continue;
				filename.indexOf('/') === -1 && !filename.endsWith('.jsoncache') && arr.push(files[i]);
			}
			files = arr;
			directories = [];
		}

		F.unlink(files, function() {
			F.rmdir(directories, callback);
		});
	});

	if (!isInit) {
		// clear static cache
		F.temporary.path = {};
		F.temporary.range = {};
		F.temporary.notfound = {};
	}

	return F;
};

/**
 * Remove files in array
 * @param {String Array} arr File list.
 * @param {Function} callback
 * @return {Framework}
 */
Framework.prototype.unlink = function(arr, callback) {

	if (typeof(arr) === 'string')
		arr = [arr];

	if (!arr.length) {
		callback && callback();
		return F;
	}

	var filename = arr.shift();
	if (filename)
		Fs.unlink(filename, (err) => F.unlink(arr, callback));
	else
		callback && callback();

	return F;
};

/**
 * Remove directories in array
 * @param {String Array} arr
 * @param {Function} callback
 * @return {Framework}
 */
Framework.prototype.rmdir = function(arr, callback) {
	if (typeof(arr) === 'string')
		arr = [arr];

	if (!arr.length) {
		callback && callback();
		return F;
	}

	var path = arr.shift();
	if (path)
		Fs.rmdir(path, () => F.rmdir(arr, callback));
	else
		callback && callback();

	return F;
};

/**
 * Cryptography (encrypt)
 * @param {String} value
 * @param {String} key Encrypt key.
 * @param {Boolean} isUnique Optional, default true.
 * @return {String}
 */
Framework.prototype.encrypt = function(value, key, isUnique) {

	if (value === undefined)
		return '';

	var type = typeof(value);

	if (typeof(key) === 'boolean') {
		var tmp = isUnique;
		isUnique = key;
		key = tmp;
	}

	if (type === 'function')
		value = value();
	else if (type === 'number')
		value = value.toString();
	else if (type === 'object')
		value = JSON.stringify(value);

	return value.encrypt(F.config.secret + '=' + key, isUnique);
};

/**
 * Cryptography (decrypt)
 * @param {String} value
 * @param {String} key Decrypt key.
 * @param {Boolean} jsonConvert Optional, default true.
 * @return {Object or String}
 */
Framework.prototype.decrypt = function(value, key, jsonConvert) {

	if (typeof(key) === 'boolean') {
		var tmp = jsonConvert;
		jsonConvert = key;
		key = tmp;
	}

	if (typeof(jsonConvert) !== 'boolean')
		jsonConvert = true;

	var response = (value || '').decrypt(F.config.secret + '=' + key);
	if (!response)
		return null;

	if (jsonConvert) {
		if (response.isJSON()) {
			try {
				return JSON.parse(response);
			} catch (ex) {}
		}
		return null;
	}

	return response;
};

/**
 * Create hash
 * @param {String} type Type (md5, sha1, sha256, etc.)
 * @param {String} value
 * @param {String} salt Optional, default false.
 * @return {String}
 */
Framework.prototype.hash = function(type, value, salt) {
	var hash = Crypto.createHash(type);
	var plus = '';

	if (typeof(salt) === 'string')
		plus = salt;
	else if (salt !== false)
		plus = (F.config.secret || '');

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

	var res = F.resources[name];
	if (res)
		return res[key] || '';

	var routes = F.routes.resources[name];
	var body = '';
	var filename;
	if (routes) {
		for (var i = 0, length = routes.length; i < length; i++) {
			filename = routes[i];
			if (existsSync(filename))
				body += (body ? '\n' : '') + Fs.readFileSync(filename).toString(ENCODING);
		}
	}

	var filename = U.combine(F.config['directory-resources'], name + '.resource');
	if (existsSync(filename))
		body += (body ? '\n' : '') + Fs.readFileSync(filename).toString(ENCODING);

	var obj = body.parseConfig();
	F.resources[name] = obj;
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
		return F.resource(language, text.substring(1));

	var value = F.resource(language, 'T' + text.hash());
	return value ? value : text;
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

Framework.prototype._configure_sitemap = function(arr, clean) {

	if (!arr || typeof(arr) === 'string') {
		var filename = prepare_filename(arr || 'sitemap');
		if (existsSync(filename, true))
			arr = Fs.readFileSync(filename).toString(ENCODING).split('\n');
		else
			arr = null;
	}

	if (!arr || !arr.length)
		return F;

	if (clean || !F.routes.sitemap)
		F.routes.sitemap = {};

	for (var i = 0, length = arr.length; i < length; i++) {

		var str = arr[i];
		if (!str || str[0] === '#' || str.substring(0, 3) === '// ')
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
		var url = a[1].trim();
		var wildcard = false;

		if (url.endsWith('*')) {
			wildcard = true;
			url = url.substring(0, url.length - 1);
		}

		var name = a[0].trim();
		var localizeName = name.startsWith('@(');
		var localizeUrl = url.startsWith('@(');

		if (localizeName)
			name = name.substring(2, name.length - 1).trim();

		if (localizeUrl)
			url = url.substring(2, url.length - 1).trim();

		F.routes.sitemap[key] = { name: name, url: url, parent: a[2] ? a[2].trim() : null, wildcard: wildcard, formatName: name.indexOf('{') !== -1, formatUrl: url.indexOf('{') !== -1, localizeName: localizeName, localizeUrl: localizeUrl };
	}

	return F;
};

Framework.prototype.sitemap = function(name, me, language) {

	if (!F.routes.sitemap)
		return EMPTYARRAY;

	if (typeof(me) === 'string') {
		language = me;
		me = false;
	}

	var key = REPOSITORY_SITEMAP + name + '$' + (me ? '1' : '0') + '$' + (language || '');

	if (F.temporary.other[key])
		return F.temporary.other[key];

	var sitemap;
	var id = name;
	var url;
	var title;

	if (me === true) {
		sitemap = F.routes.sitemap[name];
		var item = { sitemap: id, id: '', name: '', url: '', last: true, selected: true, index: 0, wildcard: false, formatName: false, formatUrl: false };
		if (!sitemap)
			return item;

		title = sitemap.name;
		if (sitemap.localizeName)
			title = F.translate(language, title);

		url = sitemap.url;
		if (sitemap.localizeUrl)
			url = F.translate(language, url);

		item.sitemap = id;
		item.id = name;
		item.formatName = sitemap.formatName;
		item.formatUrl = sitemap.formatUrl;
		item.localizeUrl = sitemap.localizeUrl;
		item.localizeName = sitemap.localizeName;
		item.name = title;
		item.url = url;
		item.wildcard = sitemap.wildcard;
		F.temporary.other[key] = item;
		return item;
	}

	var arr = [];
	var index = 0;

	while (true) {
		sitemap = F.routes.sitemap[name];
		if (!sitemap)
			break;

		title = sitemap.name;
		url = sitemap.url;

		if (sitemap.localizeName)
			title = F.translate(language, sitemap.name);

		if (sitemap.localizeUrl)
			url = F.translate(language, url);

		arr.push({ sitemap: id, id: name, name: title, url: url, last: index === 0, first: sitemap.parent ? false : true, selected: index === 0, index: index, wildcard: sitemap.wildcard, formatName: sitemap.formatName, formatUrl: sitemap.formatUrl, localizeName: sitemap.localizeName, localizeUrl: sitemap.localizeUrl });
		index++;
		name = sitemap.parent;
		if (!name)
			break;
	}

	arr.reverse();
	F.temporary.other[key] = arr;
	return arr;
};

/**
 * Gets a list of all items in sitemap
 * @param {String} parent
 * @param {String} language Optional, language
 * @return {Array}
 */
Framework.prototype.sitemap_navigation = function(parent, language) {

	var key = REPOSITORY_SITEMAP + '_n_' + (parent || '') + '$' + (language || '');;
	if (F.temporary.other[key])
		return F.temporary.other[key];

	var keys = Object.keys(F.routes.sitemap);
	var arr = [];
	var index = 0;

	for (var i = 0, length = keys.length; i < length; i++) {
		var item = F.routes.sitemap[keys[i]];
		if ((parent && item.parent !== parent) || (!parent && item.parent))
			continue;

		var title = item.name;
		var url = item.url;

		if (item.localizeName)
			title = F.translate(language, title);

		if (item.localizeUrl)
			url = F.translate(language, url);

		arr.push({ id: parent || '', name: title, url: url, last: index === 0, first: item.parent ? false : true, selected: index === 0, index: index, wildcard: item.wildcard, formatName: item.formatName, formatUrl: item.formatUrl });
		index++;
	}

	arr.quicksort('name');
	F.temporary.other[key] = arr;
	return arr;
};

/**
 * Adds an item(s) to sitemap
 * @param {String|Array} obj - 'ID : Title ---> URL --> [Parent]' parent is optional
 * @return {framework}
 */
Framework.prototype.sitemap_add = function (obj) {
    F._configure_sitemap(typeof(obj) === 'array' ? obj : [obj]);
    return F;
};

Framework.prototype._configure_dependencies = function(arr) {

	if (!arr || typeof(arr) === 'string') {
		var filename = prepare_filename(arr || 'dependencies');
		if (existsSync(filename, true))
			arr = Fs.readFileSync(filename).toString(ENCODING).split('\n');
		else
			arr = null;
	}

	if (!arr)
		return F;

	var type;
	var options;
	var interval;

	for (var i = 0, length = arr.length; i < length; i++) {

		var str = arr[i];

		if (!str || str[0] === '#' || str.substring(0, 3) === '// ')
			continue;

		var index = str.indexOf(' :');
		if (index === -1) {
			index = str.indexOf('\t:');
			if (index === -1)
				continue;
		}

		var key = str.substring(0, index).trim();
		var url = str.substring(index + 2).trim();

		options = undefined;
		interval = undefined;

		index = key.indexOf('(');
		if (index !== -1) {
			interval = key.substring(index, key.indexOf(')', index)).replace(/\(|\)/g, '').trim();
			key = key.substring(0, index).trim();
		}

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
				type = 'package';
				break;
			case 'module':
			case 'modules':
				type = 'module';
				break;
			case 'model':
			case 'models':
				type = 'model';
				break;
			case 'source':
			case 'sources':
				type = 'source';
				break;
			case 'controller':
			case 'controllers':
				type = 'controller';
				break;
			case 'view':
			case 'views':
				type = 'view';
				break;
			case 'version':
			case 'versions':
				type = 'version';
				break;
			case 'config':
			case 'configuration':
				type = 'config';
				break;
			case 'isomorphic':
			case 'isomorphics':
				type = 'isomorphic';
				break;
			case 'definition':
			case 'definitions':
				type = 'definition';
				break;
			case 'middleware':
			case 'middlewares':
				type = 'middleware';
				break;
			case 'component':
			case 'components':
				type = 'component';
				break;
		}

		if (type) {
			if (interval)
				F.uptodate(type, url, options, interval);
			else
				F.install(type, url, options);
		}
	}

	return F;
};

Framework.prototype._configure_workflows = function(arr, clean) {

	if (arr === undefined || typeof(arr) === 'string') {
		var filename = prepare_filename(arr || 'workflows');
		if (existsSync(filename, true))
			arr = Fs.readFileSync(filename).toString(ENCODING).split('\n');
		else
			arr = null;
	}

	if (clean)
		F.workflows = {};

	if (!arr || !arr.length)
		return F;

	arr.forEach(function(line) {
		line = line.trim();
		if (line.startsWith('//'))
			return;
		var index = line.indexOf(':');
		if (index === -1)
			return;

		var key = line.substring(0, index).trim();
		var response = -1;
		var builder = [];

		// sub-type
		var subindex = key.indexOf('(');
		if (subindex !== -1) {
			var type = key.substring(subindex + 1, key.indexOf(')', subindex + 1)).trim();
			key = key.substring(0, subindex).trim();
			type = type.replace(/^default\//gi, '');
			key = type + '#' + key;
		}

		line.substring(index + 1).split('-->').forEach(function(operation, index) {
			operation = operation.trim().replace(/\"/g, '\'');

			if (operation.endsWith('(response)')) {
				response = index;
				operation = operation.replace('(response)', '').trim();
			}

			var what = operation.split(':');
			if (what.length === 2)
				builder.push('$' + what[0].trim() + '(' + what[1].trim() + ', options)');
			else
				builder.push('$' + what[0] + '(options)');
		});

		F.workflows[key] = new Function('model', 'options', 'callback', 'return model.$async(callback' + (response === -1 ? '' : ', ' + response) + ').' + builder.join('.') + ';');
	});

	return F;
};

Framework.prototype._configure_versions = function(arr, clean) {

	if (arr === undefined || typeof(arr) === 'string') {
		var filename = prepare_filename(arr || 'versions');
		if (existsSync(filename, true))
			arr = Fs.readFileSync(filename).toString(ENCODING).split('\n');
		else
			arr = null;
	}

	if (!arr) {
		if (clean)
			F.versions = null;
		return F;
	}

	if (!clean)
		F.versions = {};

	if (!F.versions)
		F.versions = {};

	for (var i = 0, length = arr.length; i < length; i++) {

		var str = arr[i];

		if (!str || str[0] === '#' || str.substring(0, 3) === '// ')
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
		F.versions[key] = filename;
		ismap && F.map(filename, F.path.public(key));
	}

	return F;
};

Framework.prototype._configure = function(arr, rewrite) {

	var type = typeof(arr);
	if (type === 'string') {
		var filename = prepare_filename(arr);
		if (!existsSync(filename, true))
			return F;
		arr = Fs.readFileSync(filename).toString(ENCODING).split('\n');
	}

	if (!arr) {

		var filenameA = U.combine('/', 'config');
		var filenameB = U.combine('/', 'config-' + (F.config.debug ? 'debug' : 'release'));

		arr = [];

		// read all files from "configs" directory
		var configs = F.path.configs();
		if (existsSync(configs)) {
			var tmp = Fs.readdirSync(configs);
			for (var i = 0, length = tmp.length; i < length; i++) {
				var skip = tmp[i].match(/\-(debug|release|test)$/i);
				if (skip) {
					skip = skip[0].toString().toLowerCase();
					if (skip === '-debug' && !F.isDebug)
						continue;
					if (skip === '-release' && F.isDebug)
						continue;
					if (skip === '-test' && !F.isTest)
						continue;
				}
				arr = arr.concat(Fs.readFileSync(configs + tmp[i]).toString(ENCODING).split('\n'));
			}
		}

		if (existsSync(filenameA) && Fs.lstatSync(filenameA).isFile())
			arr = arr.concat(Fs.readFileSync(filenameA).toString(ENCODING).split('\n'));

		if (existsSync(filenameB) && Fs.lstatSync(filenameB).isFile())
			arr = arr.concat(Fs.readFileSync(filenameB).toString(ENCODING).split('\n'));
	}

	var done = function() {
		process.title = 'total: ' + F.config.name.removeDiacritics().toLowerCase().replace(REG_EMPTY, '-').substring(0, 8);
		F.isVirtualDirectory = existsSync(U.combine(F.config['directory-public-virtual']));
	};

	if (!arr instanceof Array || !arr.length) {
		done();
		return F;
	}

	if (rewrite === undefined)
		rewrite = true;

	var obj = {};
	var accepts = null;
	var length = arr.length;
	var tmp;
	var subtype;
	var value;

	for (var i = 0; i < length; i++) {
		var str = arr[i];

		if (!str || str[0] === '#' || (str[0] === '/' || str[1] === '/'))
			continue;

		var index = str.indexOf(':');
		if (index === -1)
			continue;

		var name = str.substring(0, index).trim();
		if (name === 'debug' || name === 'resources')
			continue;

		value = str.substring(index + 1).trim();
		index = name.indexOf('(');

		if (index !== -1) {
			subtype = name.substring(index + 1, name.indexOf(')')).trim().toLowerCase();
			name = name.substring(0, index).trim();
		} else
			subtype = '';

		switch (name) {
			case 'default-cors-maxage':
			case 'default-request-length':
			case 'default-websocket-request-length':
			case 'default-request-timeout':
			case 'default-interval-clear-cache':
			case 'default-interval-clear-resources':
			case 'default-interval-precompile-views':
			case 'default-interval-uptodate':
			case 'default-interval-websocket-ping':
			case 'default-maximum-file-descriptors':
			case 'default-interval-clear-dnscache':
				obj[name] = U.parseInt(value);
				break;

			case 'static-accepts-custom':
				accepts = value.replace(REG_ACCEPTCLEANER, '').split(',');
				break;

			case 'default-root':
				if (value)
					obj[name] = U.path(value);
				break;

			case 'static-accepts':
				obj[name] = {};
				tmp = value.replace(REG_ACCEPTCLEANER, '').split(',');
				for (var j = 0; j < tmp.length; j++)
					obj[name][tmp[j].substring(1)] = true;
				break;

			case 'allow-gzip':
			case 'allow-websocket':
			case 'allow-performance':
			case 'allow-compile-html':
			case 'allow-compile-style':
			case 'allow-compile-script':
			case 'disable-strict-server-certificate-validation':
			case 'disable-clear-temporary-directory':
			case 'trace':
			case 'allow-cache-snapshot':
				obj[name] = value.toLowerCase() === 'true' || value === '1' || value === 'on';
				break;

			case 'allow-compress-html':
				obj['allow-compile-html'] = value.toLowerCase() === 'true' || value === '1' || value === 'on';
				break;

			case 'version':
				obj[name] = value;
				break;

			default:

				if (subtype === 'string')
					obj[name] = value;
				else if (subtype === 'number' || subtype === 'currency' || subtype === 'float' || subtype === 'double')
					obj[name] = value.isNumber(true) ? value.parseFloat() : value.parseInt();
				else if (subtype === 'boolean' || subtype === 'bool')
					obj[name] = value.parseBoolean();
				else if (subtype === 'eval' || subtype === 'object' || subtype === 'array') {
					try {
						obj[name] = new Function('return ' + value)();
					} catch (e) {
						F.error(e, 'F.configure(' + name + ')');
					}
				} else if (subtype === 'json')
					obj[name] = value.parseJSON();
				else if (subtype === 'date' || subtype === 'datetime' || subtype === 'time')
					obj[name] = value.parseDate();
				else if (subtype === 'env' || subtype === 'environment')
					obj[name] = process.env[value];
				else
					obj[name] = value.isNumber() ? U.parseInt(value) : value.isNumber(true) ? U.parseFloat(value) : value.isBoolean() ? value.toLowerCase() === 'true' : value;
				break;
		}
	}

	U.extend(F.config, obj, rewrite);

	if (!F.config['directory-temp'])
		F.config['directory-temp'] = '~' + U.path(Path.join(Os.tmpdir(), 'totaljs' + F.directory.hash()));

	if (!F.config['etag-version'])
		F.config['etag-version'] = F.config.version.replace(/\.|\s/g, '');

	if (F.config['default-timezone'])
		process.env.TZ = F.config['default-timezone'];

	accepts && accepts.length && accepts.forEach(accept => F.config['static-accepts'][accept] = true);

	if (F.config['disable-strict-server-certificate-validation'] === true)
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

	if (F.config['allow-performance'])
		http.globalAgent.maxSockets = 9999;

	var xpowered = F.config['default-xpoweredby'];

	Object.keys(HEADERS).forEach(function(key) {
		Object.keys(HEADERS[key]).forEach(function(subkey) {
			if (subkey === 'Cache-Control')
				HEADERS[key][subkey] = HEADERS[key][subkey].replace(/max-age=\d+/, 'max-age=' + F.config['default-response-maxage']);
			if (subkey === 'X-Powered-By') {
				if (xpowered)
					HEADERS[key][subkey] = xpowered;
				else
					delete HEADERS[key][subkey];

			}
		});
	});

	IMAGEMAGICK = F.config['default-image-converter'] === 'im';
	done();
	F.emit('configure', F.config);
	return F;
};

/**
 * Create URL: JavaScript (according to config['static-url-script'])
 * @param {String} name
 * @return {String}
 */
Framework.prototype.routeScript = function(name, theme) {
	if (!name.endsWith('.js'))
		name += '.js';
	return F.$routeStatic(name, F.config['static-url-script'], theme);
};

/**
 * Create URL: CSS (according to config['static-url-style'])
 * @param {String} name
 * @return {String}
 */
Framework.prototype.routeStyle = function(name, theme) {
	return F.$routeStatic(name + (name.endsWith('.css') ? '' : '.css'), F.config['static-url-style'], theme);
};

Framework.prototype.routeImage = function(name, theme) {
	return F.$routeStatic(name, F.config['static-url-image'], theme);
};

Framework.prototype.routeVideo = function(name, theme) {
	return F.$routeStatic(name, F.config['static-url-video'], theme);
};

Framework.prototype.routeFont = function(name, theme) {
	return F.$routeStatic(name, F.config['static-url-font'], theme);
};

Framework.prototype.routeDownload = function(name, theme) {
	return F.$routeStatic(name, F.config['static-url-download'], theme);
};

Framework.prototype.routeStatic = function(name, theme) {
	return F.$routeStatic(name, F.config['static-url'], theme);
};

Framework.prototype.$routeStatic = function(name, directory, theme) {
	var key = name + directory + '$' + theme;
	var val = F.temporary.other[key];
	if (RELEASE && val)
		return val;

	if (name[0] === '~') {
		name = name.substring(name[1] === '~' ? 2 : 1);
		theme = '';
	} else if (name[0] === '=') {
		// theme
		var index = name.indexOf('/');
		if (index !== -1) {
			theme = name.substring(1, index);
			name = name.substring(index + 1);
			if (theme === '?')
				theme = F.config['default-theme'];
		}
	}

	var filename;

	if (REG_ROUTESTATIC.test(name))
		filename = name;
	else if (name[0] === '/')
		filename = U.join(theme, this._version(name));
	else {
		filename = U.join(theme, directory, this._version(name));
		if (REG_HTTPHTTPS.test(filename))
			filename = filename.substring(1);
	}

	return F.temporary.other[key] = framework_internal.preparePath(this._version(filename));
};

Framework.prototype._version = function(name) {
	if (F.versions)
		name = F.versions[name] || name;
	if (F.onVersion)
		name = F.onVersion(name) || name;
	return name;
};

Framework.prototype._version_prepare = function(html) {
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
		html = html.replace(match[i], src.substring(0, end) + F._version(name) + '"');
	}

	return html;
};

/**
 * Lookup for the route
 * @param {HttpRequest} req
 * @param {String} url URL address.
 * @param {String Array} flags
 * @param {Boolean} membertype Not defined = 0, Authorized = 1, Unauthorized = 2
 * @return {Object}
 */
Framework.prototype.lookup = function(req, url, flags, membertype) {

	var isSystem = url[0] === '#';
	var subdomain = F._length_subdomain_web && req.subdomain ? req.subdomain.join('.') : null;
	if (isSystem)
		req.path = [url];

	// helper for 401 http status
	req.$isAuthorized = true;

	var key;

	if (!isSystem) {
		key = '#' + url + '$' + membertype + req.$flags + (subdomain ? '$' + subdomain : '');
		if (F.temporary.other[key])
			return F.temporary.other[key];
	}

	var length = F.routes.web.length;
	for (var i = 0; i < length; i++) {

		var route = F.routes.web[i];
		if (route.CUSTOM) {
			if (!route.CUSTOM(url, req, flags))
				continue;
		} else {
			if (F._length_subdomain_web && !framework_internal.routeCompareSubdomain(subdomain, route.subdomain))
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

		if (route.flags && route.flags.length) {
			var result = framework_internal.routeCompareFlags2(req, route, membertype);
			if (result === -1)
				req.$isAuthorized = false; // request is not authorized
			if (result < 1)
				continue;
		}

		if (key && route.isCACHE && req.$isAuthorized)
			F.temporary.other[key] = route;

		return route;
	}

	return null;
};

Framework.prototype.lookup_websocket = function(req, url, membertype) {

	var subdomain = F._length_subdomain_websocket && req.subdomain ? req.subdomain.join('.') : null;
	var length = F.routes.websockets.length;

	req.$isAuthorized = true;

	for (var i = 0; i < length; i++) {

		var route = F.routes.websockets[i];

		if (route.CUSTOM) {
			if (!route.CUSTOM(url, req))
				continue;
		} else {

			if (F._length_subdomain_websocket && !framework_internal.routeCompareSubdomain(subdomain, route.subdomain))
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

		if (route.flags && route.flags.length) {
			var result = framework_internal.routeCompareFlags2(req, route, membertype);
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
	if (extension[0] === '.')
		extension = extension.substring(1);
	F.config['static-accepts'][extension] = true;
	contentType && U.setContentType(extension, contentType);
	return F;
};

/**
 * Run worker
 * @param {String} name
 * @param {String} id Worker id, optional.
 * @param {Number} timeout Timeout, optional.
 * @param {Array} args Additional arguments, optional.
 * @return {ChildProcess}
 */
Framework.prototype.worker = function(name, id, timeout, args) {

	var fork = null;
	var type = typeof(id);

	if (type === 'number' && timeout === undefined) {
		timeout = id;
		id = null;
		type = 'undefined';
	}

	if (type === 'string')
		fork = F.workers[id];

	if (id instanceof Array) {
		args = id;
		id = null;
		timeout = undefined;
	}

	if (timeout instanceof Array) {
		args = timeout;
		timeout = undefined;
	}

	if (fork)
		return fork;

	// @TODO: dokončiť
	var filename = name[0] === '@' ? F.path.package(name.substring(1)) : U.combine(F.config['directory-workers'], name);

	if (!args)
		args = [];

	fork = Child.fork(filename[filename.length - 3] === '.' ? filename : filename + '.js', args, HEADERS.workers);

	if (!id)
		id = name + '_' + new Date().getTime();

	fork.__id = id;
	F.workers[id] = fork;

	fork.on('exit', function() {
		var self = this;
		self.__timeout && clearTimeout(self.__timeout);
		delete F.workers[self.__id];
		fork.removeAllListeners();
		fork = null;
	});

	if (typeof(timeout) !== 'number')
		return fork;

	fork.__timeout = setTimeout(function() {
		fork.kill();
		fork = null;
	}, timeout);

	return fork;
};

Framework.prototype.worker2 = function(name, args, callback, timeout) {

	if (typeof(args) === 'function') {
		timeout = callback;
		callback = args;
		args = undefined;
	} else if (typeof(callback) === 'number') {
		var tmp = timeout;
		timeout = callback;
		callback = tmp;
	}

	if (args && !(args instanceof Array))
		args = [args];

	var fork = F.worker(name, name, timeout, args);
	if (fork.__worker2)
		return fork;

	fork.__worker2 = true;
	fork.on('error', function(e) {
		callback && callback(e);
		callback = null;
	});

	fork.on('exit', function() {
		callback && callback();
		callback = null;
	});

	return fork;
};

/**
 * This method suspends
 * @param {String} name Operation name.
 * @param {Boolean} enable Enable waiting (optional, default: by the current state).
 * @return {Boolean}
 */
Framework.prototype.wait = function(name, enable) {

	if (!F.waits)
		F.waits = {};

	if (enable !== undefined) {
		if (enable)
			F.waits[name] = true;
		else
			delete F.waits[name];
		F._length_wait = Object.keys(F.waits).length;
		return enable;
	}

	if (F.waits[name])
		delete F.waits[name];
	else {
		F.waits[name] = true;
		enable = true;
	}

	F._length_wait = Object.keys(F.waits).length;
	return enable === true;
};

// *********************************************************************************
// =================================================================================
// Framework path
// =================================================================================
// *********************************************************************************

function FrameworkPath() {}

FrameworkPath.prototype.verify = function(name) {
	var prop = '$directory-' + name;
	if (F.temporary.path[prop])
		return F;
	var directory = F.config['directory-' + name] || name;
	var dir = U.combine(directory);
	!existsSync(dir) && Fs.mkdirSync(dir);
	F.temporary.path[prop] = true;
	return F;
};

FrameworkPath.prototype.exists = function(path, callback) {
	Fs.lstat(path, (err, stats) => callback(err ? false : true, stats ? stats.size : 0, stats ? stats.isFile() : false));
	return F;
};

FrameworkPath.prototype.public = function(filename) {
	return U.combine(F.config['directory-public'], filename);
};

FrameworkPath.prototype.public_cache = function(filename) {
	var key = 'public_' + filename;
	var item = F.temporary.other[key];
	return item ? item : F.temporary.other[key] = U.combine(F.config['directory-public'], filename);
};

FrameworkPath.prototype.private = function(filename) {
	return U.combine(F.config['directory-private'], filename);
};

FrameworkPath.prototype.isomorphic = function(filename) {
	return U.combine(F.config['directory-isomorphic'], filename);
};

FrameworkPath.prototype.configs = function(filename) {
	return U.combine(F.config['directory-configs'], filename);
};

FrameworkPath.prototype.virtual = function(filename) {
	return U.combine(F.config['directory-public-virtual'], filename);
};

FrameworkPath.prototype.logs = function(filename) {
	this.verify('logs');
	return U.combine(F.config['directory-logs'], filename);
};

FrameworkPath.prototype.models = function(filename) {
	return U.combine(F.config['directory-models'], filename);
};

FrameworkPath.prototype.temp = function(filename) {
	this.verify('temp');
	return U.combine(F.config['directory-temp'], filename);
};

FrameworkPath.prototype.temporary = function(filename) {
	return this.temp(filename);
};

FrameworkPath.prototype.views = function(filename) {
	return U.combine(F.config['directory-views'], filename);
};

FrameworkPath.prototype.workers = function(filename) {
	return U.combine(F.config['directory-workers'], filename);
};

FrameworkPath.prototype.databases = function(filename) {
	this.verify('databases');
	return U.combine(F.config['directory-databases'], filename);
};

FrameworkPath.prototype.modules = function(filename) {
	return U.combine(F.config['directory-modules'], filename);
};

FrameworkPath.prototype.controllers = function(filename) {
	return U.combine(F.config['directory-controllers'], filename);
};

FrameworkPath.prototype.definitions = function(filename) {
	return U.combine(F.config['directory-definitions'], filename);
};

FrameworkPath.prototype.tests = function(filename) {
	return U.combine(F.config['directory-tests'], filename);
};

FrameworkPath.prototype.resources = function(filename) {
	return U.combine(F.config['directory-resources'], filename);
};

FrameworkPath.prototype.services = function(filename) {
	return U.combine(F.config['directory-services'], filename);
};

FrameworkPath.prototype.packages = function(filename) {
	return U.combine(F.config['directory-packages'], filename);
};

FrameworkPath.prototype.themes = function(filename) {
	return U.combine(F.config['directory-themes'], filename);
};

FrameworkPath.prototype.root = function(filename) {
	var p = Path.join(directory, filename || '');
	return F.isWindows ? p.replace(/\\/g, '/') : p;
};

FrameworkPath.prototype.package = function(name, filename) {

	if (filename === undefined) {
		var index = name.indexOf('/');
		if (index !== -1) {
			filename = name.substring(index + 1);
			name = name.substring(0, index);
		}
	}

	var tmp = F.config['directory-temp'];
	var p = tmp[0] === '~' ? Path.join(tmp.substring(1), name + '.package', filename || '') : Path.join(directory, tmp, name + '.package', filename || '');
	return F.isWindows ? p.replace(REG_WINDOWSPATH, '/') : p;
};

// *********************************************************************************
// =================================================================================
// Cache declaration
// =================================================================================
// *********************************************************************************

function FrameworkCache() {
	this.items = {};
	this.count = 1;
	this.interval;
}

FrameworkCache.prototype.init = function() {
	clearInterval(this.interval);
	this.interval = setInterval(() => F.cache.recycle(), 1000 * 60);
	F.config['allow-cache-snapshot'] && this.load();
	return this;
};

FrameworkCache.prototype.save = function() {
	Fs.writeFile(F.path.temp((F.id ? 'i-' + F.id + '_' : '') + 'F.jsoncache'), JSON.stringify(this.items), NOOP);
	return this;
};

FrameworkCache.prototype.load = function() {
	var self = this;
	Fs.readFile(F.path.temp((F.id ? 'i-' + F.id + '_' : '') + 'F.jsoncache'), function(err, data) {
		if (err)
			return;

		try {
			data = JSON.parse(data.toString('utf8'), (key, value) => typeof(value) === 'string' && value.isJSONDate() ? new Date(value) : value);
			self.items = data;
		} catch (e) {}
	});
	return self;
};

FrameworkCache.prototype.stop = function() {
	clearInterval(this.interval);
	return this;
};

FrameworkCache.prototype.clear = function() {
	this.items = {};
	return this;
};

FrameworkCache.prototype.recycle = function() {

	var items = this.items;
	F.datetime = new Date();

	this.count++;

	for (var o in items) {
		var value = items[o];
		if (!value)
			delete items[o];
		else if (value.expire < F.datetime) {
			F.emit('cache-expire', o, value.value);
			delete items[o];
		}
	}

	F.config['allow-cache-snapshot'] && this.save();
	F._service(this.count);
	return this;
};

FrameworkCache.prototype.set = FrameworkCache.prototype.add = function(name, value, expire, sync) {
	var type = typeof(expire);

	switch (type) {
		case 'string':
			expire = expire.parseDateExpiration();
			break;
		case 'undefined':
			expire = F.datetime.add('m', 5);
			break;
	}

	this.items[name] = { value: value, expire: expire };
	F.emit('cache-set', name, value, expire, sync);
	return value;
};

FrameworkCache.prototype.read = FrameworkCache.prototype.get = function(key, def) {

	var value = this.items[key];
	if (!value)
		return def;

	F.datetime = new Date();

	if (value.expire < F.datetime) {
		this.items[key] = undefined;
		F.emit('cache-expire', key, value.value);
		return def;
	}

	return value.value;
};

FrameworkCache.prototype.read2 = FrameworkCache.prototype.get2 = function(key, def) {
	var value = this.items[key];

	if (!value)
		return def;

	if (value.expire < F.datetime) {
		this.items[key] = undefined;
		F.emit('cache-expire', key, value.value);
		return def;
	}

	return value.value;
};

FrameworkCache.prototype.setExpire = function(name, expire) {
	var obj = this.items[name];
	if (obj)
		obj.expire = typeof(expire) === 'string' ? expire.parseDateExpiration() : expire;
	return this;
};

FrameworkCache.prototype.remove = function(name) {
	var value = this.items[name];
	if (value)
		this.items[name] = undefined;
	return value;
};

FrameworkCache.prototype.removeAll = function(search) {
	var count = 0;
	var isReg = U.isRegExp(search);

	for (var key in this.items) {

		if (isReg) {
			if (!search.test(key))
				continue;
		} else {
			if (key.indexOf(search) === -1)
				continue;
		}

		this.remove(key);
		count++;
	}

	return count;
};

FrameworkCache.prototype.fn = function(name, fnCache, fnCallback) {

	var self = this;
	var value = self.read2(name);

	if (value) {
		fnCallback && fnCallback(value, true);
		return self;
	}

	fnCache(function(value, expire) {
		self.add(name, value, expire);
		fnCallback && fnCallback(value, false);
	});

	return self;
};

// *********************************************************************************
// =================================================================================
// Framework.Subscribe
// =================================================================================
// *********************************************************************************

function Subscribe(framework, req, res, type) {

	// type = 0 - GET, DELETE
	// type = 1 - POST, PUT
	// type = 2 - POST MULTIPART
	// type = 3 - file routing

	// this.controller;
	this.req = req;
	this.res = res;

	// Because of performance
	// this.route = null;
	// this.timeout = null;
	// this.isCanceled = false;
	// this.isTransfer = false;
	// this.header = '';
	// this.error = null;
}

Subscribe.prototype.success = function() {
	var self = this;

	self.timeout && clearTimeout(self.timeout);
	self.timeout = null;
	self.isCanceled = true;

	if (self.controller && self.controller.res) {
		self.controller.res.controller = null;
		self.controller = null;
	}

	return self;
};

Subscribe.prototype.file = function() {
	var self = this;
	self.req.on('end', () => self.doEndfile(this));
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

	F.stats.request.upload++;
	self.route = F.lookup(req, req.uri.pathname, req.flags, 0);
	self.header = header;

	if (self.route) {
		F.path.verify('temp');
		framework_internal.parseMULTIPART(req, header, self.route, F.config['directory-temp'], self);
		return self;
	}

	F._request_stats(false, false);
	F.stats.request.blocked++;
	self.res.writeHead(403);
	self.res.end();
	return self;
};

Subscribe.prototype.urlencoded = function() {

	var self = this;
	self.route = F.lookup(self.req, self.req.uri.pathname, self.req.flags, 0);

	if (self.route) {
		self.req.buffer_has = true;
		self.req.buffer_exceeded = false;
		self.req.on('data', (chunk) => self.doParsepost(chunk));
		self.end();
		return self;
	}

	F.stats.request.blocked++;
	F._request_stats(false, false);
	self.res.writeHead(403);
	self.res.end();
	F.emit('request-end', self.req, self.res);
	self.req.clear(true);

	return self;
};

Subscribe.prototype.end = function() {
	var self = this;
	self.req.on('end', () => self.doEnd());
	self.req.resume();
};

/**
 * Execute controller
 * @private
 * @param {Number} status Default HTTP status.
 * @return {FrameworkSubscribe}
 */
Subscribe.prototype.execute = function(status, isError) {

	var self = this;
	var route = self.route;
	var req = self.req;
	var res = self.res;

	if (isError || !route) {
		F.stats.response['error' + status]++;
		status !== 500 && F.emit('error' + status, req, res, self.exception);
	}

	if (!route) {

		if (!status)
			status = 404;

		if (status === 400 && self.exception instanceof framework_builders.ErrorBuilder) {
			F.stats.response.errorBuilder++;
			req.$language && self.exception.setResource(req.$language);
			F.responseContent(req, res, 200, self.exception.output(), self.exception.contentType, F.config['allow-gzip']);
			return self;
		}

		F.responseContent(req, res, status, U.httpStatus(status) + prepare_error(self.exception), CONTENTTYPE_TEXTPLAIN, F.config['allow-gzip']);
		return self;
	}

	var name = route.controller;

	if (route.isMOBILE_VARY)
		req.$mobile = true;

	if (route.currentViewDirectory === undefined)
		route.currentViewDirectory = name && name[0] !== '#' && name !== 'default' && name !== 'unknown' ? '/' + name + '/' : '';

	var controller = new Controller(name, req, res, self, route.currentViewDirectory);

	controller.isTransfer = self.isTransfer;
	controller.exception = self.exception;
	self.controller = controller;

	if (!self.isCanceled && route.timeout) {
		self.timeout && clearTimeout(self.timeout);
		self.timeout = setTimeout(function() {
			self.controller && self.controller.precache && self.controller.precache(null, null, null);
			self.doCancel();
		}, route.timeout);
	}

	route.isDELAY && self.res.writeContinue();
	if (self.isSchema)
		req.body.$$controller = controller;

	if (!F._length_middleware || !route.middleware)
		self.doExecute();
	else
		async_middleware(0, req, res, route.middleware, () => self.doExecute(), route.options, controller);
};

Subscribe.prototype.prepare = function(flags, url) {

	var self = this;
	var req = self.req;
	var res = self.res;
	var auth = F.onAuthorize;

	if (auth) {
		var length = flags.length;
		auth(req, res, flags, function(isAuthorized, user) {

			var hasRoles = length !== flags.length;

			if (hasRoles)
				req.$flags += flags.slice(length).join('');

			if (typeof(isAuthorized) !== 'boolean') {
				user = isAuthorized;
				isAuthorized = !user;
			}

			req.isAuthorized = isAuthorized;
			self.doAuthorize(isAuthorized, user, hasRoles);
		});
		return self;
	}

	if (!self.route)
		self.route = F.lookup(req, req.buffer_exceeded ? '#431' : url || req.uri.pathname, req.flags, 0);

	if (!self.route)
		self.route = F.lookup(req, '#404', EMPTYARRAY, 0);

	var code = req.buffer_exceeded ? 431 : 404;

	if (!self.schema || !self.route)
		self.execute(code);
	else
		self.validate(self.route, () => self.execute(code));

	return self;
};

Subscribe.prototype.doExecute = function() {

	var self = this;
	var name = self.route.controller;
	var controller = self.controller;
	var req = self.req;

	try {

		if (F.onTheme)
			controller.themeName = F.onTheme(controller);

		if (controller.isCanceled)
			return self;

		F.emit('controller', controller, name, self.route.options);

		if (controller.isCanceled)
			return self;

		if (self.route.isCACHE && !F.temporary.other[req.uri.pathname])
			F.temporary.other[req.uri.pathname] = req.path;

		if (self.route.isGENERATOR)
			async.call(controller, self.route.execute, true)(controller, framework_internal.routeParam(self.route.param.length ? req.split : req.path, self.route));
		else
			self.route.execute.apply(controller, framework_internal.routeParam(self.route.param.length ? req.split : req.path, self.route));

	} catch (err) {
		controller = null;
		F.error(err, name, req.uri);
		self.exception = err;
		self.route = F.lookup(req, '#500', EMPTYARRAY, 0);
		self.execute(500, true);
	}

	return self;
};

Subscribe.prototype.doAuthorize = function(isLogged, user, roles) {

	var self = this;
	var req = self.req;
	var membertype = isLogged ? 1 : 2;

	req.$flags += membertype

	if (user)
		req.user = user;

	if (self.route && self.route.isUNIQUE && !roles && (!self.route.MEMBER || self.route.MEMBER === membertype)) {
		if (self.schema)
			self.validate(self.route, () => self.execute(code));
		else
			self.execute(req.buffer_exceeded ? 431 : 401, true);
		return;
	}

	var route = F.lookup(req, req.buffer_exceeded ? '#431' : req.uri.pathname, req.flags, req.buffer_exceeded ? 0 : membertype);
	var status = req.$isAuthorized ? 404 : 401;
	var code = req.buffer_exceeded ? 431 : status;

	if (!route)
		route = F.lookup(req, '#' + status, EMPTYARRAY, 0);

	self.route = route;

	if (self.route && self.schema)
		self.validate(self.route, () => self.execute(code));
	else
		self.execute(code);

	return self;
};

Subscribe.prototype.doEnd = function() {

	var self = this;
	var req = self.req;
	var res = self.res;
	var route = self.route;

	if (req.buffer_exceeded) {
		route = F.lookup(req, '#431', EMPTYARRAY, 0);
		req.buffer_data = null;

		if (!route) {
			F.response431(req, res);
			return self;
		}

		self.route = route;
		self.execute(431, true);
		return self;
	}

	if (req.buffer_data && (!route || !route.isBINARY))
		req.buffer_data = req.buffer_data.toString(ENCODING);

	if (!req.buffer_data) {
		if (route && route.schema)
			self.schema = true;
		req.buffer_data = null;
		self.prepare(req.flags, req.uri.pathname);
		return self;
	}

	if (route.isXML) {

		if (req.$type !== 2) {
			self.route400('Invalid "Content-Type".');
			req.buffer_data = null;
			return self;
		}

		try {
			req.body = F.onParseXML(req.buffer_data.trim(), req);
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
		req.buffer_data = null;
		self.prepare(req.flags, req.uri.pathname);
		return self;
	}

	if (!req.$type) {
		req.buffer_data = null;
		self.route400('Invalid "Content-Type".');
		return self;
	}

	if (req.$type === 1) {
		try {
			req.body = F.onParseJSON(req.buffer_data, req);
			req.buffer_data = null;
		} catch (e) {
			self.route400('Invalid JSON data.');
			return self;
		}
	} else
		req.body = F.onParseQuery(req.buffer_data, req);

	if (self.route.schema)
		self.schema = true;

	req.buffer_data = null;
	self.prepare(req.flags, req.uri.pathname);
	return self;
};

Subscribe.prototype.validate = function(route, next) {
	var self = this;
	var req = self.req;
	self.schema = false;

	if (!route.schema || req.method === 'DELETE')
		return next();

	F.onSchema(req, route.schema[0], route.schema[1], function(err, body) {

		if (err) {
			self.route400(err);
			next = null;
		} else {
			F.stats.request.schema++;
			req.body = body;
			self.isSchema = true;
			next();
		}

	}, route.schema[2]);
};

Subscribe.prototype.route400 = function(problem) {
	var self = this;
	self.route = F.lookup(self.req, '#400', EMPTYARRAY, 0);
	self.exception = problem;
	self.execute(400, true);
	return self;
};

Subscribe.prototype.route500 = function(problem) {
	var self = this;
	self.route = F.lookup(self.req, '#500', EMPTYARRAY, 0);
	self.exception = problem;
	self.execute(500, true);
	return self;
};

Subscribe.prototype.doEndfile = function() {

	var self = this;
	var req = self.req;
	var res = self.res;

	if (!F._length_files)
		return F.responseStatic(self.req, self.res);

	for (var i = 0; i < F._length_files; i++) {

		var file = F.routes.files[i];
		try {

			if (file.extensions && !file.extensions[self.req.extension])
				continue;

			if (file.url) {
				var skip = false;
				var length = file.url.length;

				if (!file.wildcard && !file.fixedfile && length !== req.path.length - 1)
					continue;

				for (var j = 0; j < length; j++) {
					if (file.url[j] === req.path[j])
						continue;
					skip = true;
					break;
				}

				if (skip)
					continue;

			} else if (file.onValidate && !file.onValidate.call(framework, req, res, true))
				continue;

			if (file.middleware)
				self.doEndfile_middleware(file);
			else
				file.execute.call(framework, req, res, false);

			return self;

		} catch (err) {
			F.error(err, file.controller, req.uri);
			F.responseContent(req, res, 500, '500 - internal server error', CONTENTTYPE_TEXTPLAIN, F.config['allow-gzip']);
			return self;
		}
	}

	F.responseStatic(self.req, self.res);
};

/**
 * Executes a file middleware
 * @param {FileRoute} file
 * @return {Subscribe}
 */
Subscribe.prototype.doEndfile_middleware = function(file) {
	var self = this;
	async_middleware(0, self.req, self.res, file.middleware, function() {
		try {
			file.execute.call(framework, self.req, self.res, false);
		} catch (err) {
			F.error(err, file.controller + ' :: ' + file.name, self.req.uri);
			F.responseContent(self.req, self.res, 500, '500 - internal server error', CONTENTTYPE_TEXTPLAIN, F.config['allow-gzip']);
		}
	}, file.options);
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

	if (req.buffer_data.length < self.route.length)
		return self;

	req.buffer_exceeded = true;
	req.buffer_data = U.createBuffer();
	return self;
};

Subscribe.prototype.doCancel = function() {
	var self = this;

	F.stats.response.timeout++;
	clearTimeout(self.timeout);
	self.timeout = null;

	if (!self.controller)
		return;

	self.controller.isTimeout = true;
	self.controller.isCanceled = true;
	self.route = F.lookup(self.req, '#408', EMPTYARRAY, 0);
	self.execute(408, true);
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
	// this.exception;

	// Sets the default language
	if (req) {
		this.language = req.$language;
		this.req = req;
	} else
		this.req = EMPTYREQUEST;

	// controller.type === 0 - classic
	// controller.type === 1 - server sent events
	this.type = 0;

	// this.layoutName = F.config['default-layout'];
	// this.themeName = F.config['default-theme'];

	this.status = 200;

	// this.isLayout = false;
	// this.isCanceled = false;
	// this.isTimeout = false;
	// this.isTransfer = false;

	this.isConnected = true;
	this.isController = true;
	this.repository = {};

	// render output
	// this.output = null;
	// this.outputPartial = null;
	// this.$model = null;

	this._currentView = currentView;

	if (res) {
		this.res = res;
		this.res.controller = this;
	} else
		this.res = EMPTYOBJECT;
}

Controller.prototype = {

	get schema() {
		return this.route.schema[0] === 'default' ? this.route.schema[1] : this.route.schema.join('/');
	},

	get workflow() {
		return this.route.schema_workflow;
	},

	get sseID() {
		return this.req.headers['last-event-id'] || null;
	},

	get route() {
		return this.subscribe.route;
	},

	get options() {
		return this.subscribe.route.options;
	},

	get flags() {
		return this.subscribe.route.flags;
	},

	get path() {
		return F.path;
	},

	get get() {
		OBSOLETE('controller.get', 'Instead of controller.get use controller.query');
		return this.req.query;
	},

	get query() {
		return this.req.query;
	},

	get post() {
		OBSOLETE('controller.post', 'Instead of controller.post use controller.body');
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
		return U.path(this.req.uri.pathname);
	},

	get uri() {
		return this.req.uri;
	},

	get cache() {
		return F.cache;
	},

	get config() {
		return F.config;
	},

	get controllers() {
		return F.controllers;
	},

	get isProxy() {
		return this.req.isProxy;
	},

	get isDebug() {
		return F.config.debug;
	},

	get isTest() {
		return this.req.headers['x-assertion-testing'] === '1';
	},

	get isSecure() {
		return this.req.isSecure;
	},

	get secured() {
		return this.req.secured;
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

	get referrer() {
		return this.req.headers['referer'] || '';
	},

	set user(value) {
		this.req.user = value;
	},

	get mobile() {
		return this.req.mobile;
	},

	get robot() {
		return this.req.robot;
	},

	get viewname() {
		var name = this.req.path[this.req.path.length - 1];
		if (!name || name === '/')
			name = 'index';
		return name;
	}
};

// ======================================================
// PROTOTYPES
// ======================================================

// Schema operations

Controller.prototype.$get = Controller.prototype.$read = function(helper, callback) {
	this.getSchema().get(helper, callback, this);
	return this;
};

Controller.prototype.$query = function(helper, callback) {
	this.getSchema().query(helper, callback, this);
	return this;
};

Controller.prototype.$save = function(helper, callback) {
	var self = this;
	if (framework_builders.isSchema(self.body)) {
		self.body.$$controller = self;
		self.body.$save(helper, callback);
	} else {
		var model = self.getSchema().default();
		model.$$controller = self;
		model.$save(helper, callback);
	}
	return self;
};

Controller.prototype.$remove = function(helper, callback) {
	var self = this;
	self.getSchema().remove(helper, callback, self);
	return this;
};

Controller.prototype.$workflow = function(name, helper, callback) {
	var self = this;
	if (framework_builders.isSchema(self.body)) {
		self.body.$$controller = self;
		self.body.$workflow(name, helper, callback);
	} else
		self.getSchema().workflow2(name, helper, callback, self);
	return self;
};

Controller.prototype.$workflow2 = function(name, helper, callback) {
	var self = this;
	self.getSchema().workflow2(name, helper, callback, self);
	return self;
};

Controller.prototype.$hook = function(name, helper, callback) {
	var self = this;
	if (framework_builders.isSchema(self.body)) {
		self.body.$$controller = self;
		self.body.$hook(name, helper, callback);
	} else
		self.getSchema().hook2(name, helper, callback, self);
	return self;
};

Controller.prototype.$hook2 = function(name, helper, callback) {
	var self = this;
	self.getSchema().hook2(name, helper, callback, self);
	return self;
};

Controller.prototype.$transform = function(name, helper, callback) {
	var self = this;
	if (framework_builders.isSchema(self.body)) {
		self.body.$$controller = self;
		self.body.$transform(name, helper, callback);
	} else
		self.getSchema().transform2(name, helper, callback, self);
	return self;
};

Controller.prototype.$transform2 = function(name, helper, callback) {
	var self = this;
	self.getSchema().transform2(name, helper, callback, self);
	return self;
};

Controller.prototype.$operation = function(name, helper, callback) {
	var self = this;
	if (framework_builders.isSchema(self.body)) {
		self.body.$$controller = self;
		self.body.$operation(name, helper, callback);
	} else
		self.getSchema().operation2(name, helper, callback, self);
	return self;
};

Controller.prototype.$operation2 = function(name, helper, callback) {
	var self = this;
	self.getSchema().operation2(name, helper, callback, self);
	return self;
};

Controller.prototype.$exec = function(name, helper, callback) {
	var self = this;

	if (framework_builders.isSchema(self.body)) {
		self.body.$$controller = self;
		self.body.$exec(name, helper, callback);
		return self;
	}

	var tmp = self.getSchema().create();
	tmp.$$controller = self;
	tmp.$exec(name, helper, callback);
	return self;
};

Controller.prototype.$async = function(callback, index) {
	var self = this;

	if (framework_builders.isSchema(self.body)) {
		self.body.$$controller = self;
		return self.body.$async(callback, index);
	}

	var model = self.getSchema().default();
	model.$$controller = self;
	return model.$async(callback, index);
};

Controller.prototype.getSchema = function() {
	var route = this.subscribe.route;
	if (!route.schema || !route.schema[1])
		throw new Error('The controller\'s route does not define any schema.');
	var schema = GETSCHEMA(route.schema[0], route.schema[1]);
	if (schema)
		return schema;
	throw new Error('Schema "{0}" does not exist.'.format(route.schema[1]));
};

/**
 * Renders component
 * @param {String} name A component name
 * @param {Object} settings Optional, settings.
 * @return {String}
 */
Controller.prototype.component = function(name, settings) {
	var self = this;
	var filename = F.components.views[name];

	if (filename) {
		var generator = framework_internal.viewEngine(name, filename, self);
		if (generator) {
			self.repository[REPOSITORY_COMPONENTS] = true;
			return generator.call(self, self, self.repository, self.$model, self.session, self.query, self.body, self.url, F.global, F.helpers, self.user, self.config, F.functions, 0, self.outputPartial, self.req.cookie, self.req.files, self.req.mobile, settings || EMPTYOBJECT);
		}
	}

	F.error('Error: A component "{0}" doesn\'t exist.'.format(name), self.name, self.uri);
	return '';
};

/**
 * Reads / Writes cookie
 * @param {String} name
 * @param {String} value
 * @param {String/Date} expires
 * @param {Object} options
 * @return {String/Controller}
 */
Controller.prototype.cookie = function(name, value, expires, options) {
	var self = this;
	if (value === undefined)
		return self.req.cookie(name);
	self.res.cookie(name, value, expires, options);
	return self;
};

/**
 * Clears uploaded files
 * @return {Controller}
 */
Controller.prototype.clear = function() {
	var self = this;
	self.req.clear();
	return self;
};

/**
 * Translates text
 * @param {String} text
 * @return {String}
 */
Controller.prototype.translate = function(language, text) {

	if (!text) {
		text = language;
		language = this.language;
	}

	return F.translate(language, text);
};

/**
 * Exec middleware
 * @param {String Array} names Middleware name.
 * @param {Object} options Custom options for middleware.
 * @param {Function} callback
 * @return {Controller}
 */
Controller.prototype.middleware = function(names, options, callback) {

	if (typeof(names) === 'string')
		names = [names];

	if (typeof(options) === 'function') {
		var tmp = callback;
		callback = options;
		options = tmp;
	}

	if (!options)
		options = EMPTYOBJECT;

	var self = this;
	async_middleware(0, self.req, self.res, names, () => callback && callback(), options, self);
	return self;
};

/**
 * Creates a pipe between the current request and target URL
 * @param {String} url
 * @param {Object} headers Optional, custom headers.
 * @param {Function(err)} callback Optional.
 * @return {Controller}
 */
Controller.prototype.pipe = function(url, headers, callback) {

	var self = this;

	if (typeof(headers) === 'function') {
		var tmp = callback;
		callback = headers;
		headers = tmp;
	}

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	F.responsePipe(self.req, self.res, url, headers, null, function() {
		self.subscribe.success();
		callback && callback();
	});

	return self;
};

Controller.prototype.encrypt = function() {
	return F.encrypt.apply(framework, arguments);
};

Controller.prototype.decrypt = function() {
	return F.decrypt.apply(framework, arguments);
};

/**
 * Creates a hash (alias for F.hash())
 * @return {Controller}
 */
Controller.prototype.hash = function() {
	return F.hash.apply(framework, arguments);
};

/**
 * Sets a response header
 * @param {String} name
 * @param {String} value
 * @return {Controller}
 */
Controller.prototype.header = function(name, value) {
	this.res.setHeader(name, value);
	return this;
};

/**
 * Gets a hostname
 * @param {String} path
 * @return {Controller}
 */
Controller.prototype.host = function(path) {
	return this.req.hostname(path);
};

Controller.prototype.hostname = function(path) {
	return this.req.hostname(path);
};

Controller.prototype.resource = function(name, key) {
	return F.resource(name, key);
};

/**
 * Error caller
 * @param {Error/String} err
 * @return {Controller/Function}
 */
Controller.prototype.error = function(err) {
	var self = this;

	// Custom errors
	if (err instanceof ErrorBuilder) {
		self.content(err);
		return self;
	}

	var result = F.error(typeof(err) === 'string' ? new Error(err) : err, self.name, self.uri);

	if (err === undefined)
		return result;

	if (self.subscribe) {
		self.subscribe.exception = err;
		self.exception = err;
	}

	return self;
};

Controller.prototype.invalid = function(status) {
	var self = this;

	if (status)
		self.status = status;

	var builder = new ErrorBuilder();
	setImmediate(n => self.content(builder));
	return builder;
};

/**
 * Registers a new problem
 * @param {String} message
 * @return {Controller}
 */
Controller.prototype.wtf = Controller.prototype.problem = function(message) {
	F.problem(message, this.name, this.uri, this.ip);
	return this;
};

/**
 * Registers a new change
 * @param {String} message
 * @return {Controller}
 */
Controller.prototype.change = function(message) {
	F.change(message, this.name, this.uri, this.ip);
	return this;
};

/**
 * Trace
 * @param {String} message
 * @return {Controller}
 */
Controller.prototype.trace = function(message) {
	F.trace(message, this.name, this.uri, this.ip);
	return this;
};

/**
 * Transfer to new route
 * @param {String} url Relative URL.
 * @param {String Array} flags Route flags (optional).
 * @return {Boolean}
 */
Controller.prototype.transfer = function(url, flags) {

	var self = this;
	var length = F.routes.web.length;
	var path = framework_internal.routeSplit(url.trim());

	var isSystem = url[0] === '#';
	var noFlag = !flags || flags.length === 0 ? true : false;
	var selected = null;

	self.req.$isAuthorized = true;

	for (var i = 0; i < length; i++) {

		var route = F.routes.web[i];

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

		if (route.flags && route.flags.length) {
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
	self.req.path = EMPTYARRAY;
	self.subscribe.isTransfer = true;
	self.subscribe.success();
	self.subscribe.route = selected;
	self.subscribe.execute(404);
	return true;

};

Controller.prototype.cancel = function() {
	this.isCanceled = true;
	return this;
};

Controller.prototype.log = function() {
	F.log.apply(framework, arguments);
	return this;
};

Controller.prototype.logger = function() {
	F.logger.apply(framework, arguments);
	return this;
};

Controller.prototype.meta = function() {
	var self = this;

	if (arguments[0])
		self.repository[REPOSITORY_META_TITLE] = arguments[0];

	if (arguments[1])
		self.repository[REPOSITORY_META_DESCRIPTION] = arguments[1];

	if (arguments[2] && arguments[2].length)
		self.repository[REPOSITORY_META_KEYWORDS] = arguments[2] instanceof Array ? arguments[2].join(', ') : arguments[2];

	if (arguments[3])
		self.repository[REPOSITORY_META_IMAGE] = arguments[3];

	return self;
};

Controller.prototype.$dns = function(value) {

	var builder = '';
	var length = arguments.length;

	for (var i = 0; i < length; i++)
		builder += '<link rel="dns-prefetch" href="' + this._preparehostname(arguments[i]) + '" />';

	this.head(builder);
	return '';
};

Controller.prototype.$prefetch = function() {

	var builder = '';
	var length = arguments.length;

	for (var i = 0; i < length; i++)
		builder += '<link rel="prefetch" href="' + this._preparehostname(arguments[i]) + '" />';

	this.head(builder);
	return '';
};

Controller.prototype.$prerender = function(value) {

	var builder = '';
	var length = arguments.length;

	for (var i = 0; i < length; i++)
		builder += '<link rel="prerender" href="' + this._preparehostname(arguments[i]) + '" />';

	this.head(builder);
	return '';
};

Controller.prototype.$next = function(value) {
	this.head('<link rel="next" href="' + this._preparehostname(value) + '" />');
	return '';
};

Controller.prototype.$prev = function(value) {
	this.head('<link rel="prev" href="' + this._preparehostname(value) + '" />');
	return '';
};

Controller.prototype.$canonical = function(value) {
	this.head('<link rel="canonical" href="' + this._preparehostname(value) + '" />');
	return '';
};

Controller.prototype.$meta = function() {
	var self = this;

	if (arguments.length) {
		self.meta.apply(self, arguments);
		return '';
	}

	F.emit('controller-render-meta', self);
	var repository = self.repository;
	return F.onMeta.call(self, repository[REPOSITORY_META_TITLE], repository[REPOSITORY_META_DESCRIPTION], repository[REPOSITORY_META_KEYWORDS], repository[REPOSITORY_META_IMAGE]);
};

Controller.prototype.title = function(value) {
	this.$title(value);
	return this;
};

Controller.prototype.description = function(value) {
	this.$description(value);
	return this;
};

Controller.prototype.keywords = function(value) {
	this.$keywords(value);
	return this;
};

Controller.prototype.author = function(value) {
	this.$author(value);
	return this;
};

Controller.prototype.$title = function(value) {
	if (value)
		this.repository[REPOSITORY_META_TITLE] = value;
	return '';
};

Controller.prototype.$title2 = function(value) {
	var current = this.repository[REPOSITORY_META_TITLE];
	if (value)
		this.repository[REPOSITORY_META_TITLE] = (current ? current : '') + value;
	return '';
};

Controller.prototype.$description = function(value) {
	if (value)
		this.repository[REPOSITORY_META_DESCRIPTION] = value;
	return '';
};

Controller.prototype.$keywords = function(value) {
	if (value && value.length)
		this.repository[REPOSITORY_META_KEYWORDS] = value instanceof Array ? value.join(', ') : value;
	return '';
};

Controller.prototype.$author = function(value) {
	if (value)
		this.repository[REPOSITORY_META_AUTHOR] = value;
	return '';
};

Controller.prototype.sitemap_navigation = function(name, language) {
	return F.sitemap_navigation(name, language || this.language);
};

Controller.prototype.sitemap_url = function(name, a, b, c, d, e, f) {
	if (!name)
		name = this.repository[REPOSITORY_SITEMAP];
	var item = F.sitemap(name, true, this.language);
	return item ? item.url.format(a, b, c, d, e, f) : '';
};

Controller.prototype.sitemap_name = function(name, a, b, c, d, e, f) {
	if (!name)
		name = this.repository[REPOSITORY_SITEMAP];
	var item = F.sitemap(name, true, this.language);
	return item ? item.name.format(a, b, c, d, e, f) : '';
};

Controller.prototype.sitemap_change = function(name, type, a, b, c, d, e, f) {

	var self = this;
	var sitemap = self.repository[REPOSITORY_SITEMAP];

	if (!sitemap)
		sitemap = self.sitemap(name);

	if (!sitemap.$cloned) {
		sitemap = U.clone(sitemap);
		sitemap.$cloned = true;
		self.repository[REPOSITORY_SITEMAP] = sitemap;
	}

	var isFn = typeof(a) === 'function';

	for (var i = 0, length = sitemap.length; i < length; i++) {

		var item = sitemap[i];
		if (item.id !== name)
			continue;

		var tmp = item[type];

		if (isFn)
			item[type] = a(item[type]);
		else if (type === 'name')
			item[type] = item.formatName ? item[type].format(a, b, c, d, e, f) : a;
		else if (type === 'url')
			item[type] = item.formatUrl ? item[type].format(a, b, c, d, e, f) : a;
		else
			item[type] = a;

		if (type === 'name' && self.repository[REPOSITORY_META_TITLE] === tmp)
			self.repository[REPOSITORY_META_TITLE] = item[type];

		return self;
	}

	return self;
};

Controller.prototype.sitemap_replace = function(name, title, url) {
	var self = this;
	var sitemap = self.repository[REPOSITORY_SITEMAP];
	if (!sitemap)
		sitemap = self.sitemap(name);

	if (!sitemap.$cloned) {
		sitemap = U.clone(sitemap);
		sitemap.$cloned = true;
		self.repository[REPOSITORY_SITEMAP] = sitemap;
	}

	for (var i = 0, length = sitemap.length; i < length; i++) {
		var item = sitemap[i];
		if (item.id !== name)
			continue;
		var is = self.repository[REPOSITORY_META_TITLE] === item.name;
		item.name = typeof(title) === 'function' ? title(item.name) : item.formatName ? item.name.format(title) : title;
		item.url = typeof(url) === 'function' ? url(item.url) : item.formatUrl ? item.url.format(url) : url;
		if (is)
			self.repository[REPOSITORY_META_TITLE] = item.name;
		return self;
	}

	return self;
};

Controller.prototype.$sitemap_change = function(name, type, value, format) {
	this.sitemap_change.apply(this, arguments);
	return '';
};

Controller.prototype.$sitemap_replace = function(name, title, url, format) {
	this.sitemap_replace.apply(this, arguments);
	return '';
};

Controller.prototype.sitemap = function(name) {
	var self = this;
	var sitemap;

	if (name instanceof Array) {
		self.repository[REPOSITORY_SITEMAP] = name;
		return self;
	}

	if (!name) {
		sitemap = self.repository[REPOSITORY_SITEMAP];
		return sitemap ? sitemap : self.repository.sitemap || EMPTYARRAY;
	}

	sitemap = F.sitemap(name, false, self.language);
	self.repository[REPOSITORY_SITEMAP] = sitemap;
	if (!self.repository[REPOSITORY_META_TITLE]) {
		sitemap = sitemap.last();
		if (sitemap)
			self.repository[REPOSITORY_META_TITLE] = sitemap.name;
	}

	return self.repository[REPOSITORY_SITEMAP];
};

Controller.prototype.$sitemap = function(name) {
	var self = this;
	self.sitemap.apply(self, arguments);
	return '';
};

Controller.prototype.module = function(name) {
	return F.module(name);
};

Controller.prototype.layout = function(name) {
	var self = this;
	self.layoutName = name;
	return self;
};

Controller.prototype.theme = function(name) {
	var self = this;
	self.themeName = name;
	return self;
};

/**
 * Layout setter for views
 * @param {String} name Layout name
 * @return {String}
 */
Controller.prototype.$layout = function(name) {
	var self = this;
	self.layoutName = name;
	return '';
};

Controller.prototype.model = function(name) {
	return F.model(name);
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
Controller.prototype.mail = function(address, subject, view, model, callback) {

	if (typeof(model) === 'function') {
		callback = model;
		model = null;
	}

	var self = this;

	if (typeof(self.language) === 'string')
		subject = subject.indexOf('@(') === -1 ? F.translate(self.language, subject) : F.translator(self.language, subject);

	// Backup layout
	var layoutName = self.layoutName;
	var body = self.view(view, model, true);
	self.layoutName = layoutName;
	return F.onMail(address, subject, body, callback);
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
	return F.notModified(this.req, this.res, compare, strict);
};

/*
	Set last modified header or Etag
	@value {String or Date}

	if @value === {String} set ETag
	if @value === {Date} set LastModified

	return {Controller};
*/
Controller.prototype.setModified = function(value) {
	F.setModified(this.req, this.res, value);
	return this;
};

/**
 * Sets expire headers
 * @param {Date} date
 */
Controller.prototype.setExpires = function(date) {
	date && this.res.setHeader('Expires', date.toUTCString());
	return this;
};

Controller.prototype.$template = function(name, model, expire, key) {
	return this.$viewToggle(true, name, model, expire, key);
};

Controller.prototype.$templateToggle = function(visible, name, model, expire, key) {
	return this.$viewToggle(visible, name, model, expire, key);
};

Controller.prototype.$view = function(name, model, expire, key) {
	return this.$viewToggle(true, name, model, expire, key);
};

Controller.prototype.$viewCompile = function(body, model) {
	var self = this;
	var layout = self.layoutName;
	self.layoutName = '';
	var value = self.viewCompile(body, model, null, true);
	self.layoutName = layout;
	return value || '';
};

Controller.prototype.$viewToggle = function(visible, name, model, expire, key) {

	if (!visible)
		return '';

	var self = this;
	var cache;

	if (expire) {
		cache = '$view.' + name + '.' + (key || '');
		var output = self.cache.read2(cache);
		if (output)
			return output;
	}

	var layout = self.layoutName;
	self.layoutName = '';
	var value = self.view(name, model, null, true);
	self.layoutName = layout;

	if (!value)
		return '';

	expire && self.cache.add(cache, value, expire);
	return value;
};

/**
 * Adds a place into the places.
 * @param {String} name A place name.
 * @param {String} arg1 A content 1, optional
 * @param {String} arg2 A content 2, optional
 * @param {String} argN A content 2, optional
 * @return {String/Controller} String is returned when the method contains only `name` argument
 */
Controller.prototype.place = function(name) {

	var key = REPOSITORY_PLACE + '_' + name;
	var length = arguments.length;

	if (length === 1)
		return this.repository[key] || '';

	var output = '';
	for (var i = 1; i < length; i++) {
		var val = arguments[i];

		if (val)
			val = val.toString();
		else
			val = '';

		if (val.endsWith('.js'))
			val = '<script src="' + val + '"></script>';

		output += val;
	}

	this.repository[key] = (this.repository[key] || '') + output;
	return this;
};

/**
 * Adds a content into the section
 * @param {String} name A section name.
 * @param {String} value A content.
 * @param {Boolean} replace Optional, default `false` otherwise concats contents.
 * @return {String/Controller} String is returned when the method contains only `name` argument
 */
Controller.prototype.section = function(name, value, replace) {

	var key = '$section_' + name;

	if (value === undefined)
		return this.repository[key];

	if (replace) {
		this.repository[key] = value;
		return this;
	}

	if (this.repository[key])
		this.repository[key] += value;
	else
		this.repository[key] = value;

	return this;
};

Controller.prototype.$place = function() {
	var self = this;
	if (arguments.length === 1)
		return self.place.apply(self, arguments);
	self.place.apply(self, arguments);
	return '';
};

Controller.prototype.$url = function(host) {
	return host ? this.req.hostname(this.url) : this.url;
};

Controller.prototype.$helper = function(name) {
	return this.helper.apply(this, arguments);
};

function querystring_encode(value, def) {
	return value != null ? value instanceof Date ? encodeURIComponent(value.format()) : typeof(value) === 'string' ? encodeURIComponent(value) : value.toString() : def || '';
}

// @{href({ key1: 1, key2: 2 })}
// @{href('key', 'value')}
Controller.prototype.href = function(key, value) {
	var self = this;

	if (!arguments.length) {
		var val = Qs.stringify(self.query);
		return val ? '?' + val : '';
	}

	var type = typeof(key);
	var obj;

	if (type === 'string') {

		var cachekey = '$href' + key;
		var str = self[cachekey] || '';

		if (!str) {

			obj = U.copy(self.query);
			for (var i = 2; i < arguments.length; i++)
				obj[arguments[i]] = undefined;

			obj[key] = '\0';

			var arr = Object.keys(obj);
			for (var i = 0, length = arr.length; i < length; i++) {
				var val = obj[arr[i]];
				if (val !== undefined)
					str += (str ? '&' : '') + arr[i] + '=' + (key === arr[i] ? '\0' : querystring_encode(val));
			}
			self[cachekey] = str;
		}

		str = str.replace('\0', querystring_encode(value, self.query[key]));

		for (var i = 2; i < arguments.length; i++) {
			var beg = str.indexOf(arguments[i] + '=');
			if (beg === -1)
				continue;
			var end = str.indexOf('&', beg);
			str = str.substring(0, beg) + str.substring(end === -1 ? str.length : end + 1);
		}

		return str ? '?' + str : '';
	}

	if (value) {
		obj = U.copy(self.query);
		U.extend(obj, value);
	}

	if (value != null)
		obj[key] = value;

	obj = Qs.stringify(obj);

	if (value === undefined && type === 'string')
		obj += (obj ? '&' : '') + key;

	return self.url + (obj ? '?' + obj : '');
};

Controller.prototype.$checked = function(bool, charBeg, charEnd) {
	return this.$isValue(bool, charBeg, charEnd, 'checked="checked"');
};

Controller.prototype.$disabled = function(bool, charBeg, charEnd) {
	return this.$isValue(bool, charBeg, charEnd, 'disabled="disabled"');
};

Controller.prototype.$selected = function(bool, charBeg, charEnd) {
	return this.$isValue(bool, charBeg, charEnd, 'selected="selected"');
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

Controller.prototype.$readonly = function(bool, charBeg, charEnd) {
	return this.$isValue(bool, charBeg, charEnd, 'readonly="readonly"');
};

Controller.prototype.$header = function(name, value) {
	this.header(name, value);
	return '';
};

Controller.prototype.$text = function(model, name, attr) {
	return this.$input(model, 'text', name, attr);
};

Controller.prototype.$password = function(model, name, attr) {
	return this.$input(model, 'password', name, attr);
};

Controller.prototype.$hidden = function(model, name, attr) {
	return this.$input(model, 'hidden', name, attr);
};

Controller.prototype.$radio = function(model, name, value, attr) {

	if (typeof(attr) === 'string') {
		var label = attr;
		attr = SINGLETON('!$radio');
		attr.label = label;
	}

	attr.value = value;
	return this.$input(model, 'radio', name, attr);
};

Controller.prototype.$checkbox = function(model, name, attr) {

	if (typeof(attr) === 'string') {
		var label = attr;
		attr = SINGLETON('!$checkbox');
		attr.label = label;
	}

	return this.$input(model, 'checkbox', name, attr);
};

Controller.prototype.$textarea = function(model, name, attr) {

	var builder = '<textarea';

	if (typeof(attr) !== 'object')
		attr = EMPTYOBJECT;

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

	return builder + '>' + ((model[name] || attr.value) || '') + '</textarea>';
};

Controller.prototype.$input = function(model, type, name, attr) {

	var builder = ['<input'];

	if (typeof(attr) !== 'object')
		attr = EMPTYOBJECT;

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
			if (value == '1' || value === 'true' || value === true || value === 'on')
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

	if (value === undefined)
		builder += ' value="' + (attr.value || '').toString().encode() + ATTR_END;
	else
		builder += ' value="' + (value || '').toString().encode() + ATTR_END;

	builder += ' />';
	return attr.label ? ('<label>' + builder + ' <span>' + attr.label + '</span></label>') : builder;
};

Controller.prototype._preparehostname = function(value) {
	if (!value)
		return value;
	var tmp = value.substring(0, 5);
	return tmp !== 'http:' && tmp !== 'https' && (tmp[0] !== '/' || tmp[1] !== '/') ? this.host(value) : value;
};

Controller.prototype.head = function() {

	var self = this;

	if (!arguments.length) {
		// OBSOLETE: this is useless
		// F.emit('controller-render-head', self);
		var author = self.repository[REPOSITORY_META_AUTHOR] || self.config.author;
		return (author ? '<meta name="author" content="' + author + '" />' : '') + (self.repository[REPOSITORY_HEAD] || '') + (self.repository[REPOSITORY_COMPONENTS] ? F.components.links : '');
	}

	var header = (self.repository[REPOSITORY_HEAD] || '');

	for (var i = 0; i < arguments.length; i++) {

		var val = arguments[i];
		var key = '$head-' + val;

		if (self.repository[key])
			continue;

		self.repository[key] = true;

		if (val[0] === '<') {
			header += val;
			continue;
		}

		var tmp = val.substring(0, 7);
		var is = (tmp[0] !== '/' && tmp[1] !== '/') && tmp !== 'http://' && tmp !== 'https:/';
		var ext = U.getExtension(val);
		if (ext === 'css')
			header += '<link type="text/css" rel="stylesheet" href="' + (is ? self.routeStyle(val) : val) + '" />';
		else if (ext === 'js')
			header += '<script src="' + (is ? self.routeScript(val) : val) + '"></script>';
	}

	self.repository[REPOSITORY_HEAD] = header;
	return self;
};

Controller.prototype.$head = function() {
	this.head.apply(this, arguments);
	return '';
};

Controller.prototype.$isValue = function(bool, charBeg, charEnd, value) {
	if (!bool)
		return '';
	charBeg = charBeg || ' ';
	charEnd = charEnd || '';
	return charBeg + value + charEnd;
};

Controller.prototype.$modified = function(value) {

	var self = this;
	var type = typeof(value);
	var date;

	if (type === 'number') {
		date = new Date(value);
	} else if (type === 'string') {

		var d = value.split(' ');

		date = d[0].split('-');
		var time = (d[1] || '').split(':');

		var year = U.parseInt(date[0] || '');
		var month = U.parseInt(date[1] || '') - 1;
		var day = U.parseInt(date[2] || '') - 1;

		if (month < 0)
			month = 0;

		if (day < 0)
			day = 0;

		var hour = U.parseInt(time[0] || '');
		var minute = U.parseInt(time[1] || '');
		var second = U.parseInt(time[2] || '');

		date = new Date(year, month, day, hour, minute, second, 0);
	} else if (U.isDate(value))
		date = value;

	date && self.setModified(date);
	return '';
};

Controller.prototype.$etag = function(value) {
	this.setModified(value);
	return '';
};

Controller.prototype.$options = function(arr, selected, name, value) {

	var type = typeof(arr);
	if (!arr)
		return '';

	var isObject = false;
	var tmp = null;

	if (!(arr instanceof Array) && type === 'object') {
		isObject = true;
		tmp = arr;
		arr = Object.keys(arr);
	}

	if (!U.isArray(arr))
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
				if (!value)
					value = '';
			} else {
				val = o;
				text = tmp[o];
				if (!text)
					text = '';
			}

		} else if (type === 'object') {

			text = (o[name] || '');
			val = (o[value] || '');

			if (typeof(text) === 'function')
				text = text(i);

			if (typeof(val) === 'function')
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
	return arguments.length === 1 ? this.$js(arguments[0]) : this.$js.apply(this, arguments);
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

/**
 * Append <script> or <style> TAG
 * @private
 * @return {String}
 */
Controller.prototype.$absolute = function(files, base) {

	var self = this;
	var builder;
	var ftype;

	if (!base)
		base = self.hostname();

	if (files instanceof Array) {

		ftype = U.getExtension(files[0]);
		builder = '';

		for (var i = 0, length = files.length; i < length; i++) {
			switch (ftype) {
				case 'js':
					builder += self.routeScript(files[i], true, base);
					break;
				case 'css':
					builder += self.routeStyle(files[i], true, base);
					break;
				default:
					builder += self.routeStatic(files[i], base);
					break;
			}
		}

		return builder;
	}

	ftype = U.getExtension(files);

	switch (ftype) {
		case 'js':
			return self.routeScript(files, true, base);
		case 'css':
			return self.routeStyle(files, true, base);
	}

	return self.routeStatic(files, base);
};

Controller.prototype.$import = function() {

	var self = this;
	var builder = '';

	for (var i = 0; i < arguments.length; i++) {
		var filename = arguments[i];

		if (filename === 'head') {
			builder += self.head();
			continue;
		}

		if (filename === 'meta') {
			builder += self.$meta();
			continue;
		}

		if (filename === 'components')
			continue;

		var extension = filename.substring(filename.lastIndexOf('.'));
		var tag = filename[0] !== '!';
		if (!tag)
			filename = filename.substring(1);

		if (filename[0] === '#')
			extension = '.js';

		switch (extension) {
			case '.js':
				builder += self.routeScript(filename, tag);
				break;
			case '.css':
				builder += self.routeStyle(filename, tag);
				break;
			case '.ico':
				builder += self.$favicon(filename);
				break;
			case '.mp4':
			case '.avi':
			case '.ogv':
			case '.webm':
			case '.mov':
			case '.mpg':
			case '.mpe':
			case '.mpeg':
			case '.m4v':
				builder += self.routeVideo(filename);
				break;
			case '.jpg':
			case '.gif':
			case '.png':
			case '.jpeg':
				builder += self.routeImage(filename);
				break;
			default:
				builder += self.routeStatic(filename);
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

Controller.prototype.$image = function(name, width, height, alt, className) {

	var style = '';

	if (typeof(width) === 'object') {
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
	var builder = '<a href="' + F.routeDownload(filename) + ATTR_END;

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
Controller.prototype.$json = function(obj, id, beautify, replacer) {

	if (typeof(id) === 'boolean') {
		replacer = beautify;
		beautify = id;
		id = null;
	}

	if (typeof(beautify) === 'function') {
		replacer = beautify;
		beautify = false;
	}

	var value = beautify ? JSON.stringify(obj, replacer, 4) : JSON.stringify(obj, replacer);
	return id ? ('<script type="application/json" id="' + id + '">' + value + '</script>') : value;
};

/**
 * Append FAVICON tag
 * @private
 * @param {String} name
 * @return {String}
 */
Controller.prototype.$favicon = function(name) {

	var contentType = 'image/x-icon';

	if (name == null)
		name = 'favicon.ico';

	var key = 'favicon#' + name;
	if (F.temporary.other[key])
		return F.temporary.other[key];

	if (name.lastIndexOf('.png') !== -1)
		contentType = 'image/png';
	else if (name.lastIndexOf('.gif') !== -1)
		contentType = 'image/gif';

	return F.temporary.other[key] = '<link rel="shortcut icon" href="' + F.routeStatic('/' + name) + '" type="' + contentType + '" />';
};

/**
 * Route static file helper
 * @private
 * @param {String} current
 * @param {String} name
 * @param {Function} fn
 * @return {String}
 */
Controller.prototype._routeHelper = function(name, fn) {
	return fn.call(framework, prepare_staticurl(name, false), this.themeName);
};

/**
 * Create URL: JavaScript
 * @param {String} name
 * @param {Boolean} tag Append tag?
 * @return {String}
 */
Controller.prototype.routeScript = function(name, tag, path) {

	if (name === undefined)
		name = 'default.js';

	var url;

	// isomorphic
	if (name[0] === '#') {
		var tmp = F.isomorphic[name.substring(1)];
		if (tmp)
			url = tmp.url;
		else {
			F.error('Isomorphic library {0} doesn\'t exist.'.format(name.substring(1)));
			return '';
		}
	} else {
		url = this._routeHelper(name, F.routeScript);
		if (path && U.isRelative(url))
			url = F.isWindows ? U.join(path, url) : U.join(path, url).substring(1);
	}

	return tag ? '<script src="' + url + '"></script>' : url;
};

/**
 * Create URL: CSS
 * @param {String} name
 * @param {Boolean} tag Append tag?
 * @return {String}
 */
Controller.prototype.routeStyle = function(name, tag, path) {
	var self = this;

	if (name === undefined)
		name = 'default.css';

	var url = self._routeHelper(name, F.routeStyle);
	if (path && U.isRelative(url))
		url = F.isWindows ? U.join(path, url) : U.join(path, url).substring(1);

	return tag ? '<link type="text/css" rel="stylesheet" href="' + url + '" />' : url;
};

/**
 * Create URL: IMG
 * @param {String} name
 * @return {String}
 */
Controller.prototype.routeImage = function(name) {
	return this._routeHelper(name, F.routeImage);
};

/**
 * Create URL: VIDEO
 * @param {String} name
 * @return {String}
 */
Controller.prototype.routeVideo = function(name) {
	return this._routeHelper(name, F.routeVideo);
};

/**
 * Create URL: FONT
 * @param {String} name
 * @return {String}
 */
Controller.prototype.routeFont = function(name) {
	return F.routeFont(name);
};

/**
 * Create URL: DOWNLOAD
 * @param {String} name
 * @return {String}
 */
Controller.prototype.routeDownload = function(name) {
	return this._routeHelper(name, F.routeDownload);
};

/**
 * Create URL: static files (by the config['static-url'])
 * @param {String} name
 * @return {String}
 */
Controller.prototype.routeStatic = function(name, path) {
	var url = this._routeHelper(name, F.routeStatic);
	if (path && U.isRelative(url))
		return F.isWindows ? U.join(path, url) : U.join(path, url).substring(1);
	return url;
};

/**
 * Creates a string from the view
 * @param {String} name A view name without `.html` extension.
 * @param {Object} model A model, optional.
 * @return {String}
 */
Controller.prototype.template = function(name, model) {
	return this.view(name, model, true);
};

/**
 * Renders a custom helper to a string
 * @param {String} name A helper name.
 * @return {String}
 */
Controller.prototype.helper = function(name) {
	var helper = F.helpers[name];
	if (!helper)
		return '';

	var params = [];
	for (var i = 1; i < arguments.length; i++)
		params.push(arguments[i]);

	return helper.apply(this, params);
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
		F.responseContent(self.req, self.res, self.status, EMPTYBUFFER, 'application/json', self.config['allow-gzip'], headers);
		F.stats.response.json++;
		return self;
	}

	if (typeof(headers) === 'boolean') {
		replacer = beautify;
		beautify = headers;
	}

	var type = 'application/json';

	if (obj instanceof framework_builders.ErrorBuilder) {
		self.req.$language && !obj.isResourceCustom && obj.setResource(self.req.$language);
		if (obj.contentType)
			type = obj.contentType;
		obj = obj.output();
		F.stats.response.errorBuilder++;
	} else {

		if (framework_builders.isSchema(obj))
			obj = obj.$clean();

		if (beautify)
			obj = JSON.stringify(obj, replacer, 4);
		else
			obj = JSON.stringify(obj, replacer);
	}

	self.subscribe.success();
	F.responseContent(self.req, self.res, self.status, obj, type, self.config['allow-gzip'], headers);
	F.stats.response.json++;
	self.precache && self.precache(obj, type, headers);
	return self;
};

/**
 * Responds with JSONP
 * @param {String} name A method name.
 * @param {Object} obj Object to serialize.
 * @param {Object} headers A custom headers.
 * @param {Boolean} beautify Should be the JSON prettified? Optional, default `false`
 * @param {Function} replacer Optional, the JSON replacer.
 * @return {Controller}
 */
Controller.prototype.jsonp = function(name, obj, headers, beautify, replacer) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	// Checks the HEAD method
	if (self.req.method === 'HEAD') {
		self.subscribe.success();
		F.responseContent(self.req, self.res, self.status, EMPTYBUFFER, 'application/x-javascript', self.config['allow-gzip'], headers);
		F.stats.response.json++;
		return self;
	}

	if (typeof(headers) === 'boolean') {
		replacer = beautify;
		beautify = headers;
	}

	if (!name)
		name = 'callback';

	if (obj instanceof framework_builders.ErrorBuilder) {
		self.req.$language && !obj.isResourceCustom && obj.setResource(self.req.$language);
		obj = obj.json(beautify);
		F.stats.response.errorBuilder++;
	} else {

		if (framework_builders.isSchema(obj))
			obj = obj.$clean();

		if (beautify)
			obj = JSON.stringify(obj, replacer, 4);
		else
			obj = JSON.stringify(obj, replacer);
	}

	self.subscribe.success();
	F.responseContent(self.req, self.res, self.status, name + '(' + obj + ')', 'application/x-javascript', self.config['allow-gzip'], headers);
	F.stats.response.json++;
	self.precache && self.precache(name + '(' + obj + ')', 'application/x-javascript', headers);
	return self;
};

/**
 * Creates View or JSON callback
 * @param {String} view Optional, undefined or null returns JSON.
 * @return {Function}
 */
Controller.prototype.callback = function(view) {
	var self = this;
	return function(err, data) {

		var is = err instanceof framework_builders.ErrorBuilder;

		// NoSQL embedded database
		if (data === undefined && !U.isError(err) && !is) {
			data = err;
			err = null;
		}

		if (err) {
			if (is && !view) {
				self.req.$language && !err.isResourceCustom && err.setResource(self.req.$language);
				return self.content(err);
			}
			return is && err.unexpected ? self.view500(err) : self.view404(err);
		}

		if (typeof(view) === 'string')
			self.view(view, data);
		else
			self.json(data);
	};
};

Controller.prototype.custom = function() {
	this.subscribe.success();
	if (this.res.success || this.res.headersSent || !this.isConnected)
		return false;
	F.responseCustom(this.req, this.res);
	return true;
};

/**
 * Prevents cleaning uploaded files (need to call `controller.clear()` manually).
 * @param {Boolean} enable Optional, default `true`.
 * @return {Controller}
 */
Controller.prototype.noClear = function(enable) {
	this.req._manual = enable === undefined ? true : enable;
	return this;
};

Controller.prototype.content = function(contentBody, contentType, headers) {

	var self = this;
	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	if (contentBody instanceof ErrorBuilder) {
		var tmp = contentBody.output();
		if (!contentType)
			contentType = contentBody.contentType || 'application/json';
		contentBody = tmp;
		F.stats.response.errorBuilder++;
	}

	self.subscribe.success();
	F.responseContent(self.req, self.res, self.status, contentBody, contentType || CONTENTTYPE_TEXTPLAIN, self.config['allow-gzip'], headers);

	if (self.precache && self.status === 200) {
		self.layout('');
		self.precache(contentBody, contentType || CONTENTTYPE_TEXTPLAIN, headers, true);
	}

	return self;
};

/**
 * Responds with plain/text body
 * @param {String} body A response body (object is serialized into the JSON automatically).
 * @param {Boolean} headers A custom headers.
 * @return {Controller}
 */
Controller.prototype.plain = function(body, headers) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	// Checks the HEAD method
	if (self.req.method === 'HEAD') {
		self.subscribe.success();
		F.responseContent(self.req, self.res, self.status, EMPTYBUFFER, CONTENTTYPE_TEXTPLAIN, self.config['allow-gzip'], headers);
		F.stats.response.plain++;
		return self;
	}

	var type = typeof(body);

	if (body == null)
		body = '';
	else if (type === 'object') {
		if (framework_builders.isSchema(body))
			body = body.$clean();
		body = body ? JSON.stringify(body, null, 4) : '';
	} else
		body = body ? body.toString() : '';

	self.subscribe.success();
	F.responseContent(self.req, self.res, self.status, body, CONTENTTYPE_TEXTPLAIN, self.config['allow-gzip'], headers);
	F.stats.response.plain++;
	self.precache && self.precache(body, CONTENTTYPE_TEXTPLAIN, headers);
	return self;
};

/**
 * Creates an empty response
 * @param {Object/Number} headers A custom headers or a custom HTTP status.
 * @return {Controller}
 */
Controller.prototype.empty = function(headers) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	var code = 200;

	if (typeof(headers) === 'number') {
		code = headers;
		headers = null;
	}

	self.subscribe.success();
	F.responseContent(self.req, self.res, code, EMPTYBUFFER, CONTENTTYPE_TEXTPLAIN, false, headers);
	F.stats.response.empty++;
	return self;
};

/**
 * Destroys a request (closes it)
 * @param {String} problem Optional.
 * @return {Controller}
 */
Controller.prototype.destroy = function(problem) {
	var self = this;

	problem && self.problem(problem);
	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	self.subscribe.success();
	self.req.connection.destroy();
	F.stats.response.destroy++;
	return self;
};

/**
 * Responds with a file
 * @param {String} filename
 * @param {String} download Optional, a download name.
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optinoal, callback.
 * @return {Controller}
 */
Controller.prototype.file = function(filename, download, headers, done) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected) {
		done && done();
		return self;
	}

	if (filename[0] === '~')
		filename = filename.substring(1);
	else
		filename = F.path.public_cache(filename);

	self.subscribe.success();
	F.responseFile(self.req, self.res, filename, download, headers, done);
	return self;
};

/**
 * Responds with an image
 * @param {String or Stream} filename
 * @param {Function(image)} fnProcess
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optional, callback.
 * @return {Controller}
 */
Controller.prototype.image = function(filename, fnProcess, headers, done) {
	var self = this;

	if (self.res.success || self.res.headersSent || !self.isConnected) {
		done && done();
		return self;
	}

	if (typeof(filename) === 'string') {
		if (filename[0] === '~')
			filename = filename.substring(1);
		else
			filename = F.path.public_cache(filename);
	}

	self.subscribe.success();
	F.responseImage(self.req, self.res, filename, fnProcess, headers, done);
	return self;
};

/**
 * Responds with a stream
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
		done && done();
		return self;
	}

	self.subscribe.success();
	F.responseStream(self.req, self.res, contentType, stream, download, headers, done, nocompress);
	return self;
};

/**
 * Throw 400 - Bad request.
 * @param  {String} problem Description of problem (optional)
 * @return {Controller}
 */
Controller.prototype.throw400 = Controller.prototype.view400 = function(problem) {
	return controller_error_status(this, 400, problem);
};

/**
 * Throw 401 - Unauthorized.
 * @param  {String} problem Description of problem (optional)
 * @return {Controller}
 */
Controller.prototype.throw401 = Controller.prototype.view401 = function(problem) {
	return controller_error_status(this, 401, problem);
};

/**
 * Throw 403 - Forbidden.
 * @param  {String} problem Description of problem (optional)
 * @return {Controller}
 */
Controller.prototype.throw403 = Controller.prototype.view403 = function(problem) {
	return controller_error_status(this, 403, problem);
};

/**
 * Throw 404 - Not found.
 * @param  {String} problem Description of problem (optional)
 * @return {Controller}
 */
Controller.prototype.throw404 = Controller.prototype.view404 = function(problem) {
	return controller_error_status(this, 404, problem);
};

/**
 * Throw 500 - Internal Server Error.
 * @param {Error} error
 * @return {Controller}
 */
Controller.prototype.throw500 = Controller.prototype.view500 = function(error) {
	var self = this;
	F.error(error instanceof Error ? error : new Error((error || '').toString()), self.name, self.req.uri);
	return controller_error_status(self, 500, error);
};

/**
 * Throw 501 - Not implemented
 * @param  {String} problem Description of the problem (optional)
 * @return {Controller}
 */
Controller.prototype.throw501 = Controller.prototype.view501 = function(problem) {
	return controller_error_status(this, 501, problem);
};

/**
 * Creates a redirect
 * @param {String} url
 * @param {Boolean} permanent Is permanent? Default: `false`
 * @return {Controller}
 */
Controller.prototype.redirect = function(url, permanent) {
	var self = this;
	self.precache && self.precache(null, null, null);

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	HEADERS.redirect.Location = url;
	self.subscribe.success();
	self.res.success = true;
	self.res.writeHead(permanent ? 301 : 302, HEADERS.redirect);
	self.res.end();
	F._request_stats(false, false);
	F.emit('request-end', self.req, self.res);
	self.req.clear(true);
	F.stats.response.redirect++;
	return self;
};

/**
 * A binary response
 * @param {Buffer} buffer
 * @param {String} contentType
 * @param {String} type Transformation type: `binary`, `utf8`, `ascii`.
 * @param {String} download Optional, download name.
 * @param {Object} headers Optional, additional headers.
 * @return {Controller}
 */
Controller.prototype.binary = function(buffer, contentType, type, download, headers) {
	var self = this;
	var res = self.res;

	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	if (typeof(type) === 'object') {
		var tmp = type;
		type = download;
		download = headers;
		headers = tmp;
	}

	if (typeof(download) === 'object') {
		headers = download;
		download = headers;
	}

	self.subscribe.success();
	F.responseBinary(self.req, res, contentType, buffer, type, download, headers);
	return self;
};

/**
 * Basic access authentication (baa)
 * @param {String} label
 * @return {Object}
 */
Controller.prototype.baa = function(label) {

	var self = this;
	self.precache && self.precache(null, null, null);

	if (label === undefined)
		return self.req.authorization();

	var headers = SINGLETON('!controller.baa');
	headers['WWW-Authenticate'] = 'Basic realm="' + (label || 'Administration') + '"';
	F.responseContent(self.req, self.res, 401, '401: NOT AUTHORIZED', CONTENTTYPE_TEXTPLAIN, false, headers);
	self.subscribe.success();
	self.cancel();
	return null;
};

/**
 * Sends server-sent event message
 * @param {String/Object} data
 * @param {String} eventname Optional, an event name.
 * @param {String} id Optional, a custom ID.
 * @param {Number} retry A reconnection timeout in milliseconds when is an unexpected problem.
 * @return {Controller}
 */
Controller.prototype.sse = function(data, eventname, id, retry) {

	var self = this;
	var res = self.res;

	if (!self.isConnected)
		return self;

	if (!self.type && res.success)
		throw new Error('Response was sent.');

	if (self.type > 0 && self.type !== 1)
		throw new Error('Response was used.');

	if (!self.type) {

		self.type = 1;

		if (retry === undefined)
			retry = self.subscribe.route.timeout;

		self.subscribe.success();
		self.req.on('close', () => self.close());
		res.success = true;
		res.writeHead(self.status, HEADERS['sse']);
	}

	if (typeof(data) === 'object')
		data = JSON.stringify(data);
	else
		data = data.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

	var newline = '\n';
	var builder = '';

	if (eventname)
		builder = 'event: ' + eventname + newline;

	builder += 'data: ' + data + newline;

	if (id)
		builder += 'id: ' + id + newline;

	if (retry > 0)
		builder += 'retry: ' + retry + newline;

	builder += newline;
	res.write(builder);
	F.stats.response.sse++;
	return self;
};

Controller.prototype.mmr = function(name, stream, callback) {

	var self = this;
	var res = self.res;

	if (typeof(stream) === 'function') {
		callback = stream;
		stream = name;
	}

	if (!stream)
		stream = name;

	if (!self.isConnected || (!self.type && res.success) || (self.type && self.type !== 2)) {
		callback = null;
		return self;
	}

	if (!self.type) {
		self.type = 2;
		self.boundary = '----totaljs' + U.GUID(10);
		self.subscribe.success();
		self.req.on('close', () => self.close());
		res.success = true;
		HEADERS.mmr[RESPONSE_HEADER_CONTENTTYPE] = 'multipart/x-mixed-replace; boundary=' + self.boundary;
		res.writeHead(self.status, HEADERS.mmr);
	}

	res.write('--' + self.boundary + NEWLINE + RESPONSE_HEADER_CONTENTTYPE + ': ' + U.getContentType(U.getExtension(name)) + NEWLINE + NEWLINE);
	F.stats.response.mmr++;

	if (typeof(stream) === 'string')
		stream = Fs.createReadStream(stream);

	stream.pipe(res, HEADERS.mmrpipe);
	CLEANUP(stream, () => callback && callback());
	return self;
};

/**
 * Close a response
 * @param {Boolean} end
 * @return {Controller}
 */
Controller.prototype.close = function(end) {
	var self = this;

	if (end === undefined)
		end = true;

	if (!self.isConnected)
		return self;

	if (self.type) {
		self.isConnected = false;
		self.res.success = true;
		F._request_stats(false, false);
		F.emit('request-end', self.req, self.res);
		self.type = 0;
		end && self.res.end();
		return self;
	}

	self.isConnected = false;

	if (self.res.success)
		return self;

	self.res.success = true;
	F._request_stats(false, false);
	F.emit('request-end', self.req, self.res);
	end && self.res.end();
	return self;
};

/**
 * Sends an object to another total.js application (POST + JSON)
 * @param {String} url
 * @param {Object} obj
 * @param {Funciton(err, data, code, headers)} callback
 * @param {Number} timeout Timeout, optional default 10 seconds.
 * @return {EventEmitter}
 */
Controller.prototype.proxy = function(url, obj, callback, timeout) {

	var self = this;
	var tmp;

	if (typeof(callback) === 'number') {
		tmp = timeout;
		timeout = callback;
		callback = tmp;
	}

	if (typeof(obj) === 'function') {
		tmp = callback;
		callback = obj;
		obj = tmp;
	}

	return U.request(url, REQUEST_PROXY_FLAGS, obj, function(err, data, code, headers) {
		if (!callback)
			return;
		if ((headers['content-type'] || '').lastIndexOf('/json') !== -1)
			data = F.onParseJSON(data);
		callback.call(self, err, data, code, headers);
	}, null, HEADERS['proxy'], ENCODING, timeout || 10000);
};

/**
 * Creates a proxy between current request and new URL
 * @param {String} url
 * @param {Function(err, response, headers)} callback Optional.
 * @param {Object} headers Optional, additional headers.
 * @param {Number} timeout Optional, timeout (default: 10000)
 * @return {EventEmitter}
 */
Controller.prototype.proxy2 = function(url, callback, headers, timeout) {

	if (typeof(callback) === 'object') {
		timeout = headers;
		headers = callback;
		callback = undefined;
	}

	var self = this;
	var flags = [];
	var req = self.req;
	var type = req.headers['content-type'];
	var h = {};

	flags.push(req.method);
	flags.push('dnscache');

	if (type === 'application/json')
		flags.push('json');

	var c = req.method[0];
	var tmp;
	var keys;

	if (c === 'G' || c === 'H' || c === 'O') {
		if (url.indexOf('?') === -1) {
			tmp = Qs.stringify(self.query);
			if (tmp)
				url += '?' + tmp;
		}
	}

	keys = Object.keys(req.headers);
	for (var i = 0, length = keys.length; i < length; i++) {
		switch (keys[i]) {
			case 'x-forwarded-for':
			case 'x-forwarded-protocol':
			case 'x-nginx-proxy':
			case 'connection':
			case 'content-type':
			case 'host':
			case 'accept-encoding':
				break;
			default:
				h[keys[i]] = req.headers[keys[i]];
				break;
		}
	}

	if (headers) {
		keys = Object.keys(headers);
		for (var i = 0, length = keys.length; i < length; i++)
			h[keys[i]] = headers[keys[i]];
	}

	return U.request(url, flags, self.body, function(err, data, code, headers) {

		if (err) {
			callback && callback(err);
			self.invalid().push(err);
			return;
		}

		self.status = code;
		callback && callback(err, data, code, headers);
		self.content(data, (headers['content-type'] || 'text/plain').replace(REG_ENCODINGCLEANER, ''));
	}, null, h, ENCODING, timeout || 10000);
};

/**
 * Renders view to response
 * @param {String} name View name without `.html` extension.
 * @param {Object} model A model, optional default: `undefined`.
 * @param {Object} headers A custom headers, optional.
 * @param {Boolean} isPartial When is `true` the method returns rendered HTML as `String`
 * @return {Controller/String}
 */
Controller.prototype.view = function(name, model, headers, partial) {

	var self = this;

	if (typeof(name) !== 'string') {
		partial = headers;
		headers = model;
		model = name;
		name = self.viewname;
	} else if (partial === undefined && typeof(headers) === 'boolean') {
		partial = headers;
		headers = null;
	}

	if (!partial && self.res && self.res.success)
		return self;

	if (self.layoutName === undefined)
		self.layoutName = F.config['default-layout'];
	if (self.themeName === undefined)
		self.themeName = F.config['default-theme'];

	// theme root `~some_view`
	// views root `~~some_view`
	// package    `@some_view`
	// theme      `=theme/view`

	var key = 'view#=' + this.themeName + '/' + self._currentView + '/' + name;
	var filename = F.temporary.other[key];
	var isLayout = self.isLayout;

	self.isLayout = false;

	// A small cache
	if (!filename) {

		// ~   --> routed into the root of views (if the controller uses a theme then is routed into the root views of the theme)
		// ~~  --> routed into the root of views (if the controller contains theme)
		// /   --> routed into the views (skipped)
		// @   --> routed into the packages
		// .   --> routed into the opened path
		// =   --> routed into the theme

		var c = name[0];
		var skip = c === '/' ? 1 : c === '~' && name[1] === '~' ? 4 : c === '~' ? 2 : c === '@' ? 3 : c === '.' ? 5 : c === '=' ? 6 : 0;
		var isTheme = false;

		filename = name;

		if (self.themeName && skip < 3) {
			filename = '.' + F.path.themes(self.themeName + '/views/' + (isLayout || skip ? '' : self._currentView.substring(1)) + (skip ? name.substring(1) : name)).replace(REG_SANITIZE_BACKSLASH, '/');
			isTheme = true;
		}

		if (skip === 4) {
			filename = filename.substring(1);
			name = name.substring(1);
			skip = 2;
		}

		if (!isTheme && !isLayout && !skip)
			filename = self._currentView + name;

		if (!isTheme && (skip === 2 || skip === 3))
			filename = name.substring(1);

		if (skip === 3)
			filename = '.' + F.path.package(filename);

		if (skip === 6) {
			c = U.parseTheme(filename);
			name = name.substring(name.indexOf('/') + 1);
			filename = '.' + F.path.themes(c + '/views/' + name).replace(REG_SANITIZE_BACKSLASH, '/');
		}

		F.temporary.other[key] = filename;
	}

	return self.$viewrender(filename, framework_internal.viewEngine(name, filename, self), model, headers, partial, isLayout);
};

Controller.prototype.viewCompile = function(body, model, headers, partial) {

	if (headers === true) {
		partial = true;
		headers = undefined;
	}

	return this.$viewrender('[dynamic view]', framework_internal.viewEngineCompile(body, this.language, this), model, headers, partial);
};

Controller.prototype.$viewrender = function(filename, generator, model, headers, partial, isLayout) {

	var self = this;
	var err;

	if (!generator) {

		err = new Error('View "' + filename + '" not found.');

		if (partial) {
			F.error(err, self.name, self.uri);
			return self.outputPartial;
		}

		if (isLayout) {
			self.subscribe.success();
			F.response500(self.req, self.res, err);
			return self;
		}

		self.view500(err);
		return self;
	}

	var value = '';
	self.$model = model;

	if (isLayout)
		self._currentView = self._defaultView || '';

	var helpers = F.helpers;

	try {
		value = generator.call(self, self, self.repository, model, self.session, self.query, self.body, self.url, F.global, helpers, self.user, self.config, F.functions, 0, partial ? self.outputPartial : self.output, self.req.cookie, self.req.files, self.req.mobile, EMPTYOBJECT);
	} catch (ex) {

		err = new Error('View "' + filename + '": ' + ex.message);

		if (!partial) {
			self.view500(err);
			return self;
		}

		self.error(err);

		if (self.partial)
			self.outputPartial = '';
		else
			self.output = '';

		isLayout = false;
		return value;
	}

	if (!isLayout && self.precache && self.status === 200 && !partial)
		self.precache(value, CONTENTTYPE_TEXTHTML, headers, true);

	if (isLayout || !self.layoutName) {

		self.outputPartial = '';
		self.output = '';
		isLayout = false;

		if (partial)
			return value;

		self.subscribe.success();

		if (!self.isConnected)
			return self;

		F.responseContent(self.req, self.res, self.status, value, CONTENTTYPE_TEXTHTML, self.config['allow-gzip'], headers);
		F.stats.response.view++;
		return self;
	}

	if (partial)
		self.outputPartial = value;
	else
		self.output = value;

	self.isLayout = true;
	value = self.view(self.layoutName, self.$model, headers, partial);

	if (partial) {
		self.outputPartial = '';
		self.isLayout = false;
		return value;
	}

	return self;
};

/**
 * Creates a cache for the response without caching layout
 * @param {String} key
 * @param {String} expires Expiration, e.g. `1 minute`
 * @param {Boolean} disabled Disables a caching, optinoal (e.g. for debug mode you can disable a cache), default: `false`
 * @param {Function()} fnTo This method is executed when the content is prepared for the cache.
 * @param {Function()} fnFrom This method is executed when the content is readed from the cache.
 * @return {Controller}
 */
Controller.prototype.memorize = function(key, expires, disabled, fnTo, fnFrom) {

	var self = this;

	if (disabled === true) {
		fnTo();
		return self;
	}

	var output = self.cache.read2(key);
	if (!output)
		return self.$memorize_prepare(key, expires, disabled, fnTo, fnFrom);

	if (typeof(disabled) === 'function') {
		var tmp = fnTo;
		fnTo = disabled;
		fnFrom = tmp;
	}

	self.layoutName = output.layout;
	self.themeName = output.theme;

	if (output.type !== CONTENTTYPE_TEXTHTML) {
		fnFrom && fnFrom();
		self.subscribe.success();
		F.responseContent(self.req, self.res, self.status, output.content, output.type, self.config['allow-gzip'], output.headers);
		return;
	}

	switch (output.type) {
		case CONTENTTYPE_TEXTPLAIN:
			F.stats.response.plain++;
			return self;
		case 'application/json':
			F.stats.response.json++;
			return self;
		case CONTENTTYPE_TEXTHTML:
			F.stats.response.view++;
			break;
	}

	var length = output.repository.length;
	for (var i = 0; i < length; i++) {
		var key = output.repository[i].key;
		if (self.repository[key] === undefined)
			self.repository[key] = output.repository[i].value;
	}

	fnFrom && fnFrom();

	if (!self.layoutName) {
		self.subscribe.success();
		self.isConnected && F.responseContent(self.req, self.res, self.status, output.content, output.type, self.config['allow-gzip'], output.headers);
		return self;
	}

	self.output = U.createBuffer(output.content);
	self.isLayout = true;
	self.view(self.layoutName, null);
	return self;
};

Controller.prototype.$memorize_prepare = function(key, expires, disabled, fnTo, fnFrom) {

	var self = this;
	var pk = '$memorize' + key;

	if (F.temporary.processing[pk]) {
		setTimeout(function() {
			!self.subscribe.isCanceled && self.memorize(key, expires, disabled, fnTo, fnFrom);
		}, 500);
		return self;
	}

	self.precache = function(value, contentType, headers, isView) {

		if (!value && !contentType && !headers) {
			delete F.temporary.processing[pk];
			self.precache = null;
			return;
		}

		var options = { content: value, type: contentType, layout: self.layoutName, theme: self.themeName };
		if (headers)
			options.headers = headers;

		if (isView) {
			options.repository = [];
			for (var name in self.repository) {
				var value = self.repository[name];
				value !== undefined && options.repository.push({ key: name, value: value });
			}
		}

		self.cache.add(key, options, expires);
		self.precache = null;
		delete F.temporary.processing[pk];
	};

	if (typeof(disabled) === 'function')
		fnTo = disabled;

	F.temporary.processing[pk] = true;
	fnTo();
	return self;
};

// *********************************************************************************
// =================================================================================
// F.WebSocket
// =================================================================================
// *********************************************************************************

const NEWLINE = '\r\n';
const SOCKET_RESPONSE = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {0}\r\n\r\n';
const SOCKET_RESPONSE_PROTOCOL = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {0}\r\nSec-WebSocket-Protocol: {1}\r\n\r\n';
const SOCKET_RESPONSE_ERROR = 'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nX-WebSocket-Reject-Reason: 403 Forbidden\r\n\r\n';
const SOCKET_HASH = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const SOCKET_ALLOW_VERSION = [13];

function WebSocket(path, name, id) {
	this._keys = [];
	this.id = id;
	this.online = 0;
	this.connections = {};
	this.repository = {};
	this.name = name;
	this.isController = true;
	this.url = U.path(path);
	this.route = null;

	// on('open', function(client) {});
	// on('close', function(client) {});
	// on('message', function(client, message) {});
	// on('error', function(error, client) {});
	// Events.EventEmitter.call(this);
}

WebSocket.prototype = {

	get global() {
		return F.global;
	},

	get config() {
		return F.config;
	},

	get cache() {
		return F.cache;
	},

	get isDebug() {
		return F.config.debug;
	},

	get path() {
		return F.path;
	},

	get fs() {
		return F.fs;
	},

	get isSecure() {
		return this.req.isSecure;
	},

	get secured() {
		return this.req.secured;
	},
}

WebSocket.prototype.__proto__ = Object.create(Events.EventEmitter.prototype, {
	constructor: {
		value: WebSocket,
		enumberable: false
	}
});

/**
 * Sends a message
 * @param {String} message
 * @param {String Array or Function(id, client)} id
 * @param {String Array or Function(id, client)} blacklist
 * @param {String} raw internal
 * @return {WebSocket}
 */
WebSocket.prototype.send = function(message, id, blacklist, replacer) {

	var keys = this._keys;
	if (!keys || !keys.length)
		return this;

	var data;
	var raw = false;

	for (var i = 0, length = keys.length; i < length; i++) {

		var _id = keys[i];
		var conn = this.connections[_id];

		if (id) {
			if (id instanceof Array) {
				if (!websocket_valid_array(_id, id))
					continue;
			} else if (id instanceof Function) {
				if (!websocket_valid_fn(_id, conn, id))
					continue;
			} else
				throw new Error('Invalid "id" argument.');
		}

		if (blacklist) {
			if (blacklist instanceof Array) {
				if (websocket_valid_array(_id, blacklist))
					continue;
			} else if (blacklist instanceof Function) {
				if (websocket_valid_fn(_id, conn, blacklist))
					continue;
			} else
				throw new Error('Invalid "blacklist" argument.');
		}

		if (data === undefined) {
			if (conn.type === 3) {
				raw = true;
				data = JSON.stringify(message, replacer);
			} else
				data = message;
		}

		conn.send(data, raw);
		F.stats.response.websocket++;
	}

	return this;
};

function websocket_valid_array(id, arr) {
	return arr.indexOf(id) !== -1;
}

function websocket_valid_fn(id, client, fn) {
	return fn && fn(id, client) ? true : false;
}

/**
 * Sends a ping message
 * @return {WebSocket}
 */
WebSocket.prototype.ping = function() {

	var keys = this._keys;
	if (!keys)
		return this;

	var length = keys.length;
	if (!length)
		return this;

	this.$ping = true;
	F.stats.other.websocketPing++;

	for (var i = 0; i < length; i++)
		this.connections[keys[i]].ping();

	return this;
};

/**
 * Closes a connection
 * @param {String Array} id Client id, optional, default `null`.
 * @param {String} message A message for the browser.
 * @param {Number} code Optional default 1000.
 * @return {Websocket}
 */
WebSocket.prototype.close = function(id, message, code) {

	var keys = this._keys;

	if (!keys)
		return this;

	if (typeof(id) === 'string') {
		code = message;
		message = id;
		id = null;
	}

	var length = keys.length;
	if (!length)
		return this;

	if (!id || !id.length) {
		for (var i = 0; i < length; i++) {
			var _id = keys[i];
			this.connections[_id].close(message, code);
			this._remove(_id);
		}
		this._refresh();
		return this;
	}

	var is = id instanceof Array;
	var fn = typeof(id) === 'function' ? id : null;

	for (var i = 0; i < length; i++) {

		var _id = keys[i];
		if (is && id.indexOf(_id) === -1)
			continue;

		var conn = this.connections[_id];
		if (fn && !fn.call(this, _id, conn))
			continue;

		conn.close(message, code);
		this._remove(_id);
	}

	this._refresh();
	return this;
};

/**
 * Error caller
 * @param {Error/String} err
 * @return {WebSocket/Function}
 */
WebSocket.prototype.error = function(err) {
	var result = F.error(typeof(err) === 'string' ? new Error(err) : err, this.name, this.path);
	return err === undefined ? result : this;
};

/**
 * Creates a problem
 * @param {String} message
 * @return {WebSocket}
 */
WebSocket.prototype.wtf = WebSocket.prototype.problem = function(message) {
	F.problem(message, this.name, this.uri);
	return this;
};

/**
 * Creates a change
 * @param {String} message
 * @return {WebSocket}
 */
WebSocket.prototype.change = function(message) {
	F.change(message, this.name, this.uri, this.ip);
	return this;
};

/**
 * The method executes a provided function once per client.
 * @param {Function(connection, index)} fn
 * @return {WebSocket}
 */
WebSocket.prototype.all = function(fn) {
	if (this._keys) {
		for (var i = 0, length = this._keys.length; i < length; i++)
			fn(this.connections[this._keys[i]], i);
	}
	return this;
};

/**
 * Finds a connection
 * @param {String} id
 * @return {WebSocketClient}
 */
WebSocket.prototype.find = function(id) {
	var self = this;

	if (!self._keys)
		return self;

	var length = self._keys.length;
	var isFn = typeof(id) === 'function';

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

/**
 * Destroyes a WebSocket controller
 * @param {String} problem Optional.
 * @return {WebSocket}
 */
WebSocket.prototype.destroy = function(problem) {
	var self = this;

	problem && self.problem(problem);
	if (!self.connections && !self._keys)
		return self;

	self.close();
	self.emit('destroy');

	setTimeout(function() {

		self._keys.forEach(function(key) {
			var conn = self.connections[key];
			if (conn) {
				conn._isClosed = true;
				conn.socket.removeAllListeners();
				conn.removeAllListeners();
			}
		});

		self.connections = null;
		self._keys = null;
		self.route = null;
		self.buffer = null;
		delete F.connections[self.id];
		self.removeAllListeners();
	}, 1000);

	return self;
};

/**
 * Enables auto-destroy websocket controller when any user is not online
 * @param {Function} callback
 * @return {WebSocket]
 */
WebSocket.prototype.autodestroy = function(callback) {
	var self = this;
	var key = 'websocket:' + self.id;
	self.on('open', () => clearTimeout2(key));
	self.on('close', function() {
		!self.online && setTimeout2(key, function() {
			callback && callback.call(self);
			self.destroy();
		}, 5000);
	});
	return self;
};

/**
 * Internal function
 * @return {WebSocket}
 */
WebSocket.prototype._refresh = function() {
	if (this.connections) {
		this._keys = Object.keys(this.connections);
		this.online = this._keys.length;
	} else
		this.online = 0;
	return this;
};

/**
 * Internal function
 * @param {String} id
 * @return {WebSocket}
 */
WebSocket.prototype._remove = function(id) {
	if (this.connections)
		delete this.connections[id];
	return this;
};

/**
 * Internal function
 * @param {WebSocketClient} client
 * @return {WebSocket}
 */
WebSocket.prototype._add = function(client) {
	this.connections[client._id] = client;
	return this;
};

/**
 * A resource header
 * @param {String} name A resource name.
 * @param {String} key A resource key.
 * @return {String}
 */
WebSocket.prototype.resource = function(name, key) {
	return F.resource(name, key);
};

WebSocket.prototype.log = function() {
	F.log.apply(framework, arguments);
	return this;
};

WebSocket.prototype.logger = function() {
	F.logger.apply(framework, arguments);
	return this;
};

WebSocket.prototype.check = function() {

	if (!this.$ping)
		return this;

	this.all(function(client) {
		if (client.$ping)
			return;
		client.close();
		F.stats.other.websocketCleaner++;
	});

	return this;
};

/**
 * WebSocket controller
 * @param {Request} req
 * @param {Socket} socket
 * @param {String} head
 */
function WebSocketClient(req, socket, head) {
	this.$ping = true;
	this.container;
	this._id;
	this.id = '';
	this.socket = socket;
	this.req = req;
	// this.isClosed = false;
	this.errors = 0;
	this.buffer = U.createBufferSize();
	this.length = 0;

	// 1 = raw - not implemented
	// 2 = plain
	// 3 = JSON

	this.type = 2;
	// this._isClosed = false;
}

WebSocketClient.prototype = {

	get protocol() {
		return (this.req.headers['sec-websocket-protocol'] || '').replace(REG_EMPTY, '').split(',');
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

WebSocketClient.prototype.__proto__ = Object.create(Events.EventEmitter.prototype, {
	constructor: {
		value: WebSocketClient,
		enumberable: false
	}
});

WebSocketClient.prototype.isWebSocket = true;

WebSocketClient.prototype.cookie = function(name) {
	return this.req.cookie(name);
};

WebSocketClient.prototype.prepare = function(flags, protocols, allow, length, version) {

	flags = flags || EMPTYARRAY;
	protocols = protocols || EMPTYARRAY;
	allow = allow || EMPTYARRAY;

	this.length = length;

	var origin = this.req.headers['origin'] || '';
	var length = allow.length;

	if (length) {
		if (allow.indexOf('*') === -1) {
			for (var i = 0; i < length; i++) {
				if (origin.indexOf(allow[i]) === -1)
					return false;
			}
		}
	}

	length = protocols.length;
	if (length) {
		for (var i = 0; i < length; i++) {
			if (this.protocol.indexOf(protocols[i]) === -1)
				return false;
		}
	}

	if (SOCKET_ALLOW_VERSION.indexOf(U.parseInt(this.req.headers['sec-websocket-version'])) === -1)
		return false;

	var header = protocols.length ? SOCKET_RESPONSE_PROTOCOL.format(this._request_accept_key(this.req), protocols.join(', ')) : SOCKET_RESPONSE.format(this._request_accept_key(this.req));
	this.socket.write(U.createBuffer(header, 'binary'));

	this._id = (this.ip || '').replace(/\./g, '') + U.GUID(20);
	this.id = this._id;
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

	self.socket.on('data', n => self._ondata(n));
	self.socket.on('error', n => self._onerror(n));
	self.socket.on('close', () => self._onclose());
	self.socket.on('end', () => self._onclose());
	self.container._add(self);
	self.container._refresh();

	F.emit('websocket-begin', self.container, self);
	self.container.emit('open', self);
	return self;
};

/**
 * Internal handler written by Jozef Gula
 * @param {Buffer} data
 * @return {Framework}
 */
WebSocketClient.prototype._ondata = function(data) {

	if (data)
		this.buffer = Buffer.concat([this.buffer, data]);

	if (this.buffer.length > this.length) {
		this.errors++;
		this.container.emit('error', new Error('Maximum request length exceeded.'), this);
		return;
	}

	switch (this.buffer[0] & 0x0f) {
		case 0x01:
			// text message or JSON message
			this.type !== 1 && this.parse();
			break;
		case 0x02:
			// binary message
			this.type === 1 && this.parse();
			break;
		case 0x08:
			// close
			this.close();
			break;
		case 0x09:
			// ping, response pong
			this.socket.write(U.getWebSocketFrame(0, '', 0x0A));
			this.buffer = U.createBufferSize();
			this.$ping = true;
			break;
		case 0x0a:
			// pong
			this.$ping = true;
			this.buffer = U.createBufferSize();
			break;
	}
};

// MIT
// Written by Jozef Gula
WebSocketClient.prototype.parse = function() {

	var bLength = this.buffer[1];
	if (((bLength & 0x80) >> 7) !== 1)
		return this;

	var length = U.getMessageLength(this.buffer, F.isLE);
	var index = (this.buffer[1] & 0x7f);

	index = (index == 126) ? 4 : (index == 127 ? 10 : 2);
	if ((index + length + 4) > (this.buffer.length))
		return this;

	var mask = U.createBufferSize(4);
	this.buffer.copy(mask, 0, index, index + 4);

	// TEXT
	if (this.type !== 1) {
		var output = '';
		for (var i = 0; i < length; i++)
			output += String.fromCharCode(this.buffer[index + 4 + i] ^ mask[i % 4]);

		// JSON
		if (this.type === 3) {
			try {
				output = this.container.config['default-websocket-encodedecode'] === true ? $decodeURIComponent(output) : output;
				output.isJSON() && this.container.emit('message', this, F.onParseJSON(output, this.req));
			} catch (ex) {
				if (DEBUG) {
					this.errors++;
					this.container.emit('error', new Error('JSON parser: ' + ex.toString()), this);
				}
			}
		} else
			this.container.emit('message', this, this.container.config['default-websocket-encodedecode'] === true ? $decodeURIComponent(output) : output);
	} else {
		var binary = U.createBufferSize(length);
		for (var i = 0; i < length; i++)
			binary[i] = this.buffer[index + 4 + i] ^ mask[i % 4];
		this.container.emit('message', this, new Uint8Array(binary).buffer);
	}

	this.buffer = this.buffer.slice(index + length + 4, this.buffer.length);
	this.buffer.length >= 2 && U.getMessageLength(this.buffer, F.isLE) && this.parse();
	return this;
};

WebSocketClient.prototype._onerror = function(err) {

	if (this.isClosed)
		return;

	if (REG_WEBSOCKET_ERROR.test(err.stack)) {
		this.isClosed = true;
		this._onclose();
	} else
		this.container.emit('error', err, this);
};

WebSocketClient.prototype._onclose = function() {
	if (this._isClosed)
		return;
	this.isClosed = true;
	this._isClosed = true;
	this.container._remove(this._id);
	this.container._refresh();
	this.container.emit('close', this);
	this.socket.removeAllListeners();
	this.removeAllListeners();
	F.emit('websocket-end', this.container, this);
};

/**
 * Sends a message
 * @param {String/Object} message
 * @param {Boolean} raw The message won't be converted e.g. to JSON.
 * @return {WebSocketClient}
 */
WebSocketClient.prototype.send = function(message, raw, replacer) {

	if (this.isClosed)
		return this;

	if (this.type !== 1) {
		var data = this.type === 3 ? (raw ? message : JSON.stringify(message, replacer)) : (message || '').toString();
		if (this.container.config['default-websocket-encodedecode'] === true && data)
			data = encodeURIComponent(data);
		this.socket.write(U.getWebSocketFrame(0, data, 0x01));
	} else
		message && this.socket.write(U.getWebSocketFrame(0, new Int8Array(message), 0x02));

	return this;
};

/**
 * Ping message
 * @return {WebSocketClient}
 */
WebSocketClient.prototype.ping = function() {
	if (this.isClosed)
		return this;
	this.socket.write(U.getWebSocketFrame(0, '', 0x09));
	this.$ping = false;
	return this;
};

/**
 * Close connection
 * @param {String} message Message.
 * @param {Number} code WebSocket code.
 * @return {WebSocketClient}
 */
WebSocketClient.prototype.close = function(message, code) {
	if (this.isClosed)
		return this;
	this.isClosed = true;
	this.socket.end(U.getWebSocketFrame(code || 1000,  message ? encodeURIComponent(message) : '', 0x08));
	return this;
};

/**
 * Create a signature for the WebSocket
 * @param {Request} req
 * @return {String}
 */
WebSocketClient.prototype._request_accept_key = function(req) {
	var sha1 = Crypto.createHash('sha1');
	sha1.update((req.headers['sec-websocket-key'] || '') + SOCKET_HASH);
	return sha1.digest('base64');
};

function Backup() {
	this.file = [];
	this.directory = [];
	this.path = '';
	this.read = { key: U.createBufferSize(), value: U.createBufferSize(), status: 0 };
	this.pending = 0;
	this.cache = {};
	this.complete = NOOP;
	this.filter = () => true;
	this.bufKey = U.createBuffer(':');
	this.bufNew = U.createBuffer('\n');
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
		tmp = Buffer.concat([read.key, tmp]);
		index = tmp.indexOf(self.bufKey);
	} else
		index = tmp.indexOf(self.bufKey);

	if (index === -1) {
		read.key = Buffer.concat([read.key, data]);
		read.status = 2;
		return;
	}

	read.status = 1;
	read.key = tmp.slice(0, index);
	self.restoreValue(tmp.slice(index + 1));
	tmp = null;
};

Backup.prototype.restoreValue = function(data) {

	var self = this;
	var read = self.read;

	if (read.status !== 1) {
		self.restoreKey(data);
		return;
	}

	var index = data.indexOf(self.bufNew);
	if (index === -1) {
		read.value = Buffer.concat([read.value, data]);
		return;
	}

	read.value = Buffer.concat([read.value, data.slice(0, index)]);
	self.restoreFile(read.key.toString('utf8').replace(REG_EMPTY, ''), read.value.toString('utf8').replace(REG_EMPTY, ''));

	read.status = 0;
	read.value = U.createBufferSize();
	read.key = U.createBufferSize();

	self.restoreKey(data.slice(index + 1));
};

Backup.prototype.restore = function(filename, path, callback, filter) {

	if (!existsSync(filename)) {
		callback && callback(new Error('Package not found.'), path);
		return;
	}

	var self = this;

	self.filter = filter;
	self.cache = {};
	self.createDirectory(path, true);
	self.path = path;

	var stream = Fs.createReadStream(filename);
	stream.on('data', buffer => self.restoreKey(buffer));

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
	setTimeout(() => self.callback(cb), 100);
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
		p && self.createDirectory(p);
	}

	var buffer = U.createBuffer(value, 'base64');
	self.pending++;

	Zlib.gunzip(buffer, function(err, data) {
		Fs.writeFile(Path.join(self.path, key), data, () => self.pending--);
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

	var is = F.isWindows;

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

	for (var i = 0, length = arr.length; i < length; i++) {
		var name = arr[i];
		if (is)
			directory += (directory ? '\\' : '') + name;
		else
			directory += (directory ? '/' : '') + name;

		var dir = Path.join(self.path, directory);
		if (root)
			dir = (is ? '\\' : '/') + dir;

		!existsSync(dir) && Fs.mkdirSync(dir);
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
 * @return {Response}
 */
http.ServerResponse.prototype.cookie = function(name, value, expires, options) {

	var self = this;

	if (self.headersSent || self.success)
		return;

	var cookieHeaderStart = name + '=';
	var builder = [cookieHeaderStart + value];
	var type = typeof(expires);

	if (expires && !U.isDate(expires) && type === 'object') {
		options = expires;
		expires = options.expires || options.expire || null;
	}

	if (type === 'string')
		expires = expires.parseDateExpiration();

	if (!options)
		options = {};

	options.path = options.path || '/';
	expires &&  builder.push('Expires=' + expires.toUTCString());
	options.domain && builder.push('Domain=' + options.domain);
	options.path && builder.push('Path=' + options.path);
	options.secure && builder.push('Secure');

	if (options.httpOnly || options.httponly || options.HttpOnly)
		builder.push('HttpOnly');

	var arr = self.getHeader('set-cookie') || [];

	// Cookie, already, can be in array, resulting in duplicate 'set-cookie' header
	var idx = arr.findIndex(cookieStr => cookieStr.startsWith(cookieHeaderStart));
	idx !== -1 && arr.splice(idx, 1);
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

	self.controller && self.controller.subscribe.success();

	var res = self;
	var req = self.req;
	var contentType = type;
	var isHEAD = req.method === 'HEAD';

	if (body === undefined) {
		body = code;
		code = 200;
	}

	switch (typeof(body)) {
		case 'string':
			if (!contentType)
				contentType = 'text/html';
			break;

		case 'number':
			if (!contentType)
				contentType = 'text/plain';
			body = U.httpStatus(body);
			break;

		case 'boolean':
		case 'object':
			if (!isHEAD) {
				if (body instanceof framework_builders.ErrorBuilder) {
					body = obj.output();
					contentType = obj.contentType;
					F.stats.response.errorBuilder++;
				} else
					body = JSON.stringify(body);
				if (!contentType)
					contentType = 'application/json';
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
	F.responseCustom(req, res);

	if (!accept && isGZIP(req))
		accept = 'gzip';

	var compress = accept.indexOf('gzip') !== -1;

	if (isHEAD) {
		if (compress)
			headers['Content-Encoding'] = 'gzip';
		res.writeHead(200, headers);
		res.end();
		return self;
	}

	if (!compress) {
		res.writeHead(code, headers);
		res.end(body, ENCODING);
		return self;
	}

	var buffer = U.createBuffer(body);
	Zlib.gzip(buffer, function(err, data) {

		if (err) {
			res.writeHead(code, headers);
			res.end(body, ENCODING);
			return;
		}

		headers['Content-Encoding'] = 'gzip';
		res.writeHead(code, headers);
		res.end(data, ENCODING);
	});

	return self;
};

http.ServerResponse.prototype.throw400 = function(problem) {
	this.controller && this.controller.subscribe.success();
	F.response400(this.req, this, problem);
};

http.ServerResponse.prototype.setModified = function(value) {
	F.setModified(this.req, this, value);
	return this;
};

http.ServerResponse.prototype.throw401 = function(problem) {
	this.controller && this.controller.subscribe.success();
	F.response401(this.req, this, problem);
};

http.ServerResponse.prototype.throw403 = function(problem) {
	this.controller && this.controller.subscribe.success();
	F.response403(this.req, this, problem);
};

http.ServerResponse.prototype.throw404 = function(problem) {
	this.controller && this.controller.subscribe.success();
	F.response404(this.req, this, problem);
};

http.ServerResponse.prototype.throw408 = function(problem) {
	this.controller && this.controller.subscribe.success();
	F.response408(this.req, this, problem);
};

http.ServerResponse.prototype.throw431 = function(problem) {
	this.controller && this.controller.subscribe.success();
	F.response431(this.req, this, problem);
};

http.ServerResponse.prototype.throw500 = function(error) {
	this.controller && this.controller.subscribe.success();
	F.response500(this.req, this, error);
};

http.ServerResponse.prototype.throw501 = function(problem) {
	this.controller && this.controller.subscribe.success();
	F.response501(this.req, this, problem);
};

/**
 * Responds with a static file
 * @param {Function} done Optional, callback.
 * @return {Response}
 */
http.ServerResponse.prototype.continue = function(done) {
	var self = this;
	if (self.headersSent) {
		done && done();
		return self;
	}
	self.controller && self.controller.subscribe.success();
	F.responseStatic(self.req, self, done);
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
	self.controller && self.controller.subscribe.success();
	F.responseContent(self.req, self, code, body, type, compress, headers);
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
	self.controller && self.controller.subscribe.success();
	F.responseRedirect(self.req, self, url, permanent);
	return self;
};

/**
 * Responds with a file
 * @param {String} filename
 * @param {String} download Optional, a download name.
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optional, callback.
 * @return {Framework}
 */
http.ServerResponse.prototype.file = function(filename, download, headers, done) {
	var self = this;
	if (self.headersSent) {
		done && done();
		return self;
	}
	self.controller && self.controller.subscribe.success();
	F.responseFile(self.req, self, filename, download, headers, done);
	return self;
};

/**
 * Responds with a stream
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
		done && done();
		return self;
	}

	self.controller && self.controller.subscribe.success();
	F.responseStream(self.req, self, contentType, stream, download, headers, done, nocompress);
	return self;
};

/**
 * Responds with an image
 * @param {String or Stream} filename
 * @param {String} fnProcess
 * @param {Object} headers Optional, additional headers.
 * @param {Function} done Optional, callback.
 * @return {Framework}
 */
http.ServerResponse.prototype.image = function(filename, fnProcess, headers, done) {
	var self = this;
	if (self.headersSent) {
		done && done();
		return self;
	}
	self.controller && self.controller.subscribe.success();
	F.responseImage(self.req, self, filename, fnProcess, headers, done);
	return self;
};

/**
 * Response JSON
 * @param {Object} obj
 * @return {Response}
 */
http.ServerResponse.prototype.json = function(obj) {
	var self = this;
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
		if (proxy)
			self._ip = proxy.split(',', 1)[0] || self.connection.remoteAddress;
		else if (!self._ip)
			self._ip = self.connection.remoteAddress;

		return self._ip;
	},

	get query() {
		var self = this;
		if (self._dataGET)
			return self._dataGET;
		self._dataGET = F.onParseQuery(self.uri.query, self);
		return self._dataGET;
	},

	set query(value) {
		this._dataGET = value;
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

	get split() {
		if (this.$path)
			return this.$path;
		return this.$path = framework_internal.routeSplit(this.uri.pathname, true);
	},

	get secured() {
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

	get robot() {
		if (this.$robot === undefined)
			this.$robot = REG_ROBOT.test(this.headers['user-agent']);
		return this.$robot;
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
	return F.encrypt((this.headers['user-agent'] || '') + '#' + this.ip + '#' + this.url + '#' + (key || ''), 'request-signature', false);
};

/**
 * Disable HTTP cache for current request
 * @return {Request}
 */
http.IncomingMessage.prototype.noCache = function() {
	delete this.headers['if-none-match'];
	delete this.headers['if-modified-since'];
	return this;
};

http.IncomingMessage.prototype.notModified = function(compare, strict) {
	return F.notModified(this, this.res, compare, strict);
};

/**
 * Read a cookie from current request
 * @param {String} name Cookie name.
 * @return {String} Cookie value (default: '')
 */
http.IncomingMessage.prototype.cookie = function(name) {

	if (this.cookies)
		return $decodeURIComponent(this.cookies[name] || '');

	var cookie = this.headers['cookie'];
	if (!cookie)
		return '';

	this.cookies = {};

	var arr = cookie.split(';');

	for (var i = 0, length = arr.length; i < length; i++) {
		var line = arr[i].trim();
		var index = line.indexOf('=');
		if (index !== -1)
			this.cookies[line.substring(0, index)] = line.substring(index + 1);
	}

	return $decodeURIComponent(this.cookies[name] || '');
};

/**
 * Read authorization header
 * @return {Object}
 */
http.IncomingMessage.prototype.authorization = function() {

	var authorization = this.headers['authorization'];
	if (!authorization)
		return HEADERS.authorization;

	var result = { user: '', password: '', empty: true };

	try {
		var arr = U.createBuffer(authorization.replace('Basic ', '').trim(), 'base64').toString(ENCODING).split(':');
		result.user = arr[0] || '';
		result.password = arr[1] || '';
		result.empty = !result.user || !result.password;
	} catch (e) {}

	return result;
};

/**
 * Authorization for custom delegates
 * @param  {Function(err, userprofile, isAuthorized)} callback
 * @return {Request}
 */
http.IncomingMessage.prototype.authorize = function(callback) {

	var auth = F.onAuthorize;

	if (!auth) {
		callback(null, null, false);
		return this;
	}

	var req = this;

	auth(req, req.res, req.flags, function(isAuthorized, user) {
		if (typeof(isAuthorized) !== 'boolean') {
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

	if (!files || (isAuto && self._manual))
		return self;

	self.body = null;
	self.query = null;
	self.cookies = null;

	var length = files.length;
	if (!length)
		return self;

	var arr = [];
	for (var i = 0; i < length; i++)
		files[i].rem && arr.push(files[i].path);

	F.unlink(arr);
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
global.Controller = Controller;

process.on('uncaughtException', function(e) {

	if (e.toString().indexOf('listen EADDRINUSE') !== -1) {
		if (typeof(process.send) === 'function')
			process.send('eaddrinuse');
		console.log('\nThe IP address and the PORT is already in use.\nYou must change the PORT\'s number or IP address.\n');
		process.exit('SIGTERM');
		return;
	}

	if (F.isTest) {
		// HACK: this method is created dynamically in F.testing();
		F.testContinue && F.testContinue(e);
		return;
	}

	F.error(e, '', null);
});

function fsFileRead(filename, callback) {
	U.queue('F.files', F.config['default-maximum-file-descriptors'], function(next) {
		Fs.readFile(filename, function(err, result) {
			next();
			callback(err, result);
		});
	});
};

function fsFileExists(filename, callback) {
	U.queue('F.files', F.config['default-maximum-file-descriptors'], function(next) {
		Fs.lstat(filename, function(err, stats) {
			next();
			callback(!err && stats.isFile(), stats ? stats.size : 0, stats ? stats.isFile() : false, stats);
		});
	});
};

function fsStreamRead(filename, options, callback) {

	if (!callback) {
		callback = options;
		options = undefined;
	}

	var opt;

	if (options) {
		opt = HEADERS.fsStreamReadRange
		opt.start = options.start;
		opt.end = options.end;
	} else
		opt = HEADERS.fsStreamRead;

	U.queue('F.files', F.config['default-maximum-file-descriptors'], function(next) {
		var stream = Fs.createReadStream(filename, opt);
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

process.on('SIGTERM', () => F.stop());
process.on('SIGINT', () => F.stop());
process.on('exit', () => F.stop());

process.on('message', function(msg, h) {

	if (typeof(msg) !== 'string') {
		F.emit('message', msg, h);
		return;
	}

	if (msg === 'debugging') {
		U.wait(() => F.isLoaded, function() {
			F.isLoaded = undefined;
			F.console();
		}, 10000, 500);
		return;
	}

	if (msg === 'reconnect') {
		F.reconnect();
		return;
	}

	if (msg === 'reconfigure') {
		F._configure();
		F._configure_versions();
		F._configure_workflows();
		F._configure_sitemap();
		F.emit(msg);
		return;
	}

	if (msg === 'reset') {
		// F.clear();
		F.cache.clear();
		return;
	}

	if (msg === 'stop' || msg === 'exit') {
		F.stop();
		return;
	}

	F.emit('message', msg, h);
});

function prepare_error(e) {
	return (RELEASE || !e) ? '' : ' :: ' + (e instanceof ErrorBuilder ? e.plain() : e.stack ? e.stack.toString() : e.toString());
}

function prepare_filename(name) {
	return name[0] === '@' ? (F.isWindows ? U.combine(F.config['directory-temp'], name.substring(1)) : F.path.package(name.substring(1))) : U.combine('/', name);
}

function prepare_staticurl(url, isDirectory) {
	if (!url)
		return url;
	if (url[0] === '~') {
		if (isDirectory)
			return U.path(url.substring(1));
	} else if (url.substring(0, 2) === '//' || url.substring(0, 6) === 'http:/' || url.substring(0, 7) === 'https:/')
		return url;
	return url;
}

function prepare_isomorphic(name, value) {
	return 'if(window["isomorphic"]===undefined)window.isomorphic=window.I={};isomorphic["' + name.replace(/\.js$/i, '') + '"]=(function(framework,F,U,utils,Utils,is_client,is_server){var module={},exports=module.exports={};' + value + ';return exports;})(null,null,null,null,null,true,false)';
}

function isGZIP(req) {
	var ua = req.headers['user-agent'];
	return ua && ua.lastIndexOf('Firefox') !== -1;
}

function prepare_viewname(value) {
	// Cleans theme name
	return value.substring(value.indexOf('/', 2) + 1);
}

function existsSync(filename, file) {
	try {
		var val = Fs.statSync(filename);
		return val ? (file ? val.isFile() : true) : false;
	} catch (e) {
		return false;
	}
}

function async_middleware(index, req, res, middleware, callback, options, controller) {

	if (res.success || res.headersSent) {
		// Prevents timeout
		controller && controller.subscribe.success();
		callback = null;
		return;
	}

	var name = middleware[index++];
	if (!name)
		return callback && callback();

	var item = F.routes.middleware[name];
	if (!item) {
		F.error('Middleware not found: ' + name, null, req.uri);
		return async_middleware(index, req, res, middleware, callback, options, controller);
	}

	var output = item.call(framework, req, res, function(err) {

		if (err) {
			res.throw500(err);
			callback = null;
			return;
		}

		async_middleware(index, req, res, middleware, callback, options, controller);
	}, options, controller);

	if (output !== false)
		return;

	callback = null;
};

global.setTimeout2 = function(name, fn, timeout) {
	var key = ':' + name;
	F.temporary.internal[key] && clearTimeout(F.temporary.internal[key]);
	return F.temporary.internal[key] = setTimeout(fn, timeout);
};

global.clearTimeout2 = function(name) {
	var key = ':' + name;

	if (F.temporary.internal[key]) {
		clearTimeout(F.temporary.internal[key]);
		F.temporary.internal[key] = undefined;
		return true;
	}

	return false;
};

function parseComponent(body, filename) {
	var response = {};

	response.css = '';
	response.js = '';
	response.install = '';

	var beg = 0;
	var end = 0;

	while (true) {
		beg = body.indexOf('<script type="text/totaljs">');
		if (beg === -1)
			break;
		end = body.indexOf('</script>', beg);
		if (end === -1)
			break;
		response.install += (response.install ? '\n' : '') + body.substring(beg, end).replace(/<(\/)?script.*?>/g, '');
		body = body.substring(0, beg).trim() + body.substring(end + 9).trim();
	}

	while (true) {
		beg = body.indexOf('<style');
		if (beg === -1)
			break;
		end = body.indexOf('</style>', beg);
		if (end === -1)
			break;
		response.css += (response.css ? '\n' : '') + body.substring(beg, end).replace(/<(\/)?style.*?>/g, '');
		body = body.substring(0, beg).trim() + body.substring(end + 8).trim();
	}

	while (true) {
		beg = body.indexOf('<script>');
		if (beg === -1) {
			beg = body.indexOf('<script type="text/javascript">');
			if (beg === -1)
				break;
		}
		end = body.indexOf('</script>', beg);
		if (end === -1)
			break;
		response.js += (response.js ? '\n' : '') + body.substring(beg, end).replace(/<(\/)?script.*?>/g, '');
		body = body.substring(0, beg).trim() + body.substring(end + 9).trim();
	}

	if (response.js)
		response.js = framework_internal.compile_javascript(response.js, filename);

	if (response.css)
		response.css = framework_internal.compile_css(response.css, filename);

	response.body = body;
	return response;
}

// Default action for workflow routing
function controller_json_workflow(id) {
	var self = this;
	self.id = id;
	self.$exec(self.route.workflow, self, self.callback());
}

// Because of controller prototypes
// It's used in F.view() and F.viewCompile()
const EMPTYCONTROLLER = new Controller('', null, null, null, '');
EMPTYCONTROLLER.isConnected = false;