// Copyright 2012-2021 (c) Peter Širka <petersirka@gmail.com>
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
 * @version 3.4.13
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
const http = require('http');

const ENCODING = 'utf8';
const HEADER_CACHE = 'Cache-Control';
const HEADER_TYPE = 'Content-Type';
const HEADER_LENGTH = 'Content-Length';
const CT_TEXT = 'text/plain';
const CT_HTML = 'text/html';
const CT_JSON = 'application/json';
const COMPRESSION = { 'text/plain': true, 'text/javascript': true, 'text/css': true, 'text/jsx': true, 'application/javascript': true, 'application/x-javascript': true, 'application/json': true, 'text/xml': true, 'image/svg+xml': true, 'text/x-markdown': true, 'text/html': true };
const COMPRESSIONSPECIAL = { js: 1, css: 1, mjs: 1 };
const RESPONSENOCACHE = { zip: 1, rar: 1 };
const REG_TEMPORARY = /\//g;
const REG_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;
const REG_ROBOT = /search|agent|bot|crawler|spider/i;
const REG_VERSIONS = /(href|src)="[a-zA-Z0-9/:\-._]+\.(jpg|js|css|png|apng|gif|svg|html|ico|json|less|sass|scss|swf|txt|webp|heif|heic|jpeg|woff|woff2|xls|xlsx|xml|xsl|xslt|zip|rar|csv|doc|docx|eps|gzip|jpe|jpeg|manifest|mov|mp3|flac|mp4|ogg|package|pdf)"/gi;
const REG_COMPILECSS = /url\(.*?\)/g;
const REG_ROUTESTATIC = /^(\/\/|https:|http:)+/;
const REG_NEWIMPL = /^(async\s)?function(\s)?([a-zA-Z$][a-zA-Z0-9$]+)?(\s)?\([a-zA-Z0-9$]+\)|^function anonymous\(\$/;
const REG_RANGE = /bytes=/;
const REG_EMPTY = /\s/g;
const REG_ACCEPTCLEANER = /\s|\./g;
const REG_SANITIZE_BACKSLASH = /\/\//g;
const REG_WEBSOCKET_ERROR = /ECONNRESET|EHOSTUNREACH|EPIPE|is closed/i;
const REG_WINDOWSPATH = /\\/g;
const REG_SCRIPTCONTENT = /<|>|;/;
const REG_HTTPHTTPS = /^(\/)?(http|https):\/\//i;
const REG_NOCOMPRESS = /[.|-]+min(@[a-z0-9]*)?\.(css|js)$/i;
const REG_WWW = /^www\./i;
const REG_TEXTAPPLICATION = /text|application/;
const REG_ENCODINGCLEANER = /[;\s]charset=utf-8/g;
const REG_SKIPERROR = /epipe|invalid\sdistance/i;
const REG_OLDCONF = /-/g;
const REG_UTF8 = /[^\x20-\x7E]+/;
const REG_ENCODEDSPACE = /\+/g;
const FLAGS_INSTALL = ['get'];
const FLAGS_DOWNLOAD = ['get', 'dnscache'];
const QUERYPARSEROPTIONS = { maxKeys: 33 };
const EMPTYARRAY = [];
const EMPTYOBJECT = {};
const EMPTYREQUEST = { uri: {} };
const SINGLETONS = {};
const REPOSITORY_HEAD = '$head';
const REPOSITORY_META_TITLE = '$title';
const REPOSITORY_META_DESCRIPTION = '$description';
const REPOSITORY_META_KEYWORDS = '$keywords';
const REPOSITORY_META_AUTHOR = '$author';
const REPOSITORY_META_IMAGE = '$image';
const REPOSITORY_PLACE = '$place';
const REPOSITORY_SITEMAP = '$sitemap';
const REPOSITORY_COMPONENTS = '$components';
const ATTR_END = '"';
const ETAG = '858';
const CONCAT = [null, null];
const CLUSTER_CACHE_SET = { TYPE: 'cache', method: 'set' };
const CLUSTER_CACHE_REMOVE = { TYPE: 'cache', method: 'remove' };
const CLUSTER_CACHE_REMOVEALL = { TYPE: 'cache', method: 'removeAll' };
const CLUSTER_CACHE_CLEAR = { TYPE: 'cache', method: 'clear' };
const CLUSTER_SNAPSHOT = { TYPE: 'snapshot' };
const GZIPFILE = { memLevel: 9 };
const GZIPSTREAM = { memLevel: 1 };
const MODELERROR = {};
const IMAGES = { jpg: 1, png: 1, gif: 1, apng: 1, jpeg: 1, heif: 1, heic: 1, webp: 1 };
const KEYSLOCALIZE = { html: 1, htm: 1 };
const PROXYOPTIONS = { end: true };
const PROXYKEEPALIVE = new http.Agent({ keepAlive: true, timeout: 60000 });
const JSFILES = { js: 1, mjs: 1 };
var PREFFILE = 'preferences.json';

var PATHMODULES = require.resolve('./index');
PATHMODULES = PATHMODULES.substring(0, PATHMODULES.length - 8);

Object.freeze(EMPTYOBJECT);
Object.freeze(EMPTYARRAY);
Object.freeze(EMPTYREQUEST);

global.EMPTYOBJECT = EMPTYOBJECT;
global.EMPTYARRAY = EMPTYARRAY;
global.NOW = new Date();
global.THREAD = '';
global.isWORKER = false;
global.REQUIRE = function(path) {
	return require(F.directory + '/' + path);
};

function flowwrapper(name) {
	if (!name)
		name = 'default';
	if (F.flows[name])
		return F.flows[name];
	var flow = new framework_flow.make(name);
	return F.flows[name] = flow;
}

global.FLOWSTREAM = function(name) {
	global.framework_flow = require('./flow');
	global.FLOW = flowwrapper;
	return flowwrapper(name);
};

var DEF = global.DEF = {};

DEF.currencies = {};

var PROTORES, PROTOREQ;

var RANGE = { start: 0, end: 0 };
var HEADERS = {};
var SUCCESSHELPER = { success: true };

// Cached headers for repeated usage
HEADERS.responseCode = {};
HEADERS.responseCode[HEADER_TYPE] = CT_TEXT;
HEADERS.redirect = {};
HEADERS.redirect[HEADER_TYPE] = CT_HTML + '; charset=utf-8';
HEADERS.redirect[HEADER_LENGTH] = '0';
HEADERS.sse = {};
HEADERS.sse[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.sse['Pragma'] = 'no-cache';
HEADERS.sse['Expires'] = '-1';
HEADERS.sse[HEADER_TYPE] = 'text/event-stream';
HEADERS.sse['X-Powered-By'] = 'Total.js';
HEADERS.file_lastmodified = {};
HEADERS.file_lastmodified['Access-Control-Allow-Origin'] = '*';
HEADERS.file_lastmodified[HEADER_CACHE] = 'public, max-age=11111111';
HEADERS.file_lastmodified['X-Powered-By'] = 'Total.js';
HEADERS.file_release_compress = {};
HEADERS.file_release_compress[HEADER_CACHE] = 'public, max-age=11111111';
HEADERS.file_release_compress['Vary'] = 'Accept-Encoding';
HEADERS.file_release_compress['Access-Control-Allow-Origin'] = '*';
HEADERS.file_release_compress['Last-Modified'] = 'Mon, 01 Jan 2001 08:00:00 GMT';
HEADERS.file_release_compress['Content-Encoding'] = 'gzip';
HEADERS.file_release_compress['X-Powered-By'] = 'Total.js';
HEADERS.file_release_compress_range = {};
HEADERS.file_release_compress_range['Accept-Ranges'] = 'bytes';
HEADERS.file_release_compress_range[HEADER_CACHE] = 'public, max-age=11111111';
HEADERS.file_release_compress_range['Vary'] = 'Accept-Encoding';
HEADERS.file_release_compress_range['Access-Control-Allow-Origin'] = '*';
HEADERS.file_release_compress_range['Last-Modified'] = 'Mon, 01 Jan 2001 08:00:00 GMT';
HEADERS.file_release_compress_range['Content-Encoding'] = 'gzip';
HEADERS.file_release_compress_range[HEADER_LENGTH] = '0';
HEADERS.file_release_compress_range['Content-Range'] = '';
HEADERS.file_release_compress_range['X-Powered-By'] = 'Total.js';
HEADERS.file_release = {};
HEADERS.file_release[HEADER_CACHE] = 'public, max-age=11111111';
HEADERS.file_release['Vary'] = 'Accept-Encoding';
HEADERS.file_release['Access-Control-Allow-Origin'] = '*';
HEADERS.file_release['Last-Modified'] = 'Mon, 01 Jan 2001 08:00:00 GMT';
HEADERS.file_release['X-Powered-By'] = 'Total.js';
HEADERS.file_release_range = {};
HEADERS.file_release_range['Accept-Ranges'] = 'bytes';
HEADERS.file_release_range[HEADER_CACHE] = 'public, max-age=11111111';
HEADERS.file_release_range['Vary'] = 'Accept-Encoding';
HEADERS.file_release_range['Access-Control-Allow-Origin'] = '*';
HEADERS.file_release_range['Last-Modified'] = 'Mon, 01 Jan 2001 08:00:00 GMT';
HEADERS.file_release_range[HEADER_LENGTH] = '0';
HEADERS.file_release_range['Content-Range'] = '';
HEADERS.file_release_range['X-Powered-By'] = 'Total.js';
HEADERS.file_debug_compress = {};
HEADERS.file_debug_compress[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.file_debug_compress['Vary'] = 'Accept-Encoding';
HEADERS.file_debug_compress['Access-Control-Allow-Origin'] = '*';
HEADERS.file_debug_compress['Pragma'] = 'no-cache';
HEADERS.file_debug_compress['Expires'] = '-1';
HEADERS.file_debug_compress['Content-Encoding'] = 'gzip';
HEADERS.file_debug_compress['X-Powered-By'] = 'Total.js';
HEADERS.file_debug_compress_range = {};
HEADERS.file_debug_compress_range['Accept-Ranges'] = 'bytes';
HEADERS.file_debug_compress_range[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.file_debug_compress_range['Vary'] = 'Accept-Encoding';
HEADERS.file_debug_compress_range['Access-Control-Allow-Origin'] = '*';
HEADERS.file_debug_compress_range['Content-Encoding'] = 'gzip';
HEADERS.file_debug_compress_range['Pragma'] = 'no-cache';
HEADERS.file_debug_compress_range['Expires'] = '-1';
HEADERS.file_debug_compress_range[HEADER_LENGTH] = '0';
HEADERS.file_debug_compress_range['Content-Range'] = '';
HEADERS.file_debug_compress_range['X-Powered-By'] = 'Total.js';
HEADERS.file_debug = {};
HEADERS.file_debug[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.file_debug['Vary'] = 'Accept-Encoding';
HEADERS.file_debug['Pragma'] = 'no-cache';
HEADERS.file_debug['Expires'] = '-1';
HEADERS.file_debug['Access-Control-Allow-Origin'] = '*';
HEADERS.file_debug['X-Powered-By'] = 'Total.js';
HEADERS.file_debug_range = {};
HEADERS.file_debug_range['Accept-Ranges'] = 'bytes';
HEADERS.file_debug_range[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.file_debug_range['Vary'] = 'Accept-Encoding';
HEADERS.file_debug_range['Access-Control-Allow-Origin'] = '*';
HEADERS.file_debug_range['Pragma'] = 'no-cache';
HEADERS.file_debug_range['Expires'] = '-1';
HEADERS.file_debug_range[HEADER_LENGTH] = '0';
HEADERS.file_debug_range['Content-Range'] = '';
HEADERS.file_debug_range['X-Powered-By'] = 'Total.js';
HEADERS.content_mobile_release = {};
HEADERS.content_mobile_release[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.content_mobile_release['Vary'] = 'Accept-Encoding, User-Agent';
HEADERS.content_mobile_release['Content-Encoding'] = 'gzip';
HEADERS.content_mobile_release['Expires'] = '-1';
HEADERS.content_mobile_release['X-Powered-By'] = 'Total.js';
HEADERS.content_mobile = {};
HEADERS.content_mobile[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.content_mobile['Vary'] = 'Accept-Encoding, User-Agent';
HEADERS.content_mobile['Expires'] = '-1';
HEADERS.content_mobile['X-Powered-By'] = 'Total.js';
HEADERS.content_compress = {};
HEADERS.content_compress[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.content_compress['Vary'] = 'Accept-Encoding';
HEADERS.content_compress['Content-Encoding'] = 'gzip';
HEADERS.content_compress['Expires'] = '-1';
HEADERS.content_compress['X-Powered-By'] = 'Total.js';
HEADERS.content = {};
HEADERS.content[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.content['Vary'] = 'Accept-Encoding';
HEADERS.content['Expires'] = '-1';
HEADERS.content['X-Powered-By'] = 'Total.js';
HEADERS.stream_release_compress = {};
HEADERS.stream_release_compress[HEADER_CACHE] = 'public, max-age=11111111';
HEADERS.stream_release_compress['Access-Control-Allow-Origin'] = '*';
HEADERS.stream_release_compress['Content-Encoding'] = 'gzip';
HEADERS.stream_release_compress['X-Powered-By'] = 'Total.js';
HEADERS.stream_release = {};
HEADERS.stream_release[HEADER_CACHE] = 'public, max-age=11111111';
HEADERS.stream_release['Access-Control-Allow-Origin'] = '*';
HEADERS.stream_release['X-Powered-By'] = 'Total.js';
HEADERS.stream_debug_compress = {};
HEADERS.stream_debug_compress[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.stream_debug_compress['Pragma'] = 'no-cache';
HEADERS.stream_debug_compress['Expires'] = '-1';
HEADERS.stream_debug_compress['Access-Control-Allow-Origin'] = '*';
HEADERS.stream_debug_compress['Content-Encoding'] = 'gzip';
HEADERS.stream_debug_compress['X-Powered-By'] = 'Total.js';
HEADERS.stream_debug = {};
HEADERS.stream_debug[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.stream_debug['Pragma'] = 'no-cache';
HEADERS.stream_debug['Expires'] = '-1';
HEADERS.stream_debug['Access-Control-Allow-Origin'] = '*';
HEADERS.stream_debug['X-Powered-By'] = 'Total.js';
HEADERS.binary_compress = {};
HEADERS.binary_compress[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.binary_compress['Content-Encoding'] = 'gzip';
HEADERS.binary_compress['X-Powered-By'] = 'Total.js';
HEADERS.binary = {};
HEADERS.binary[HEADER_CACHE] = 'public';
HEADERS.binary['X-Powered-By'] = 'Total.js';
HEADERS.authorization = { user: '', password: '', empty: true };
HEADERS.fsStreamRead = { flags: 'r', mode: '0666', autoClose: true };
HEADERS.fsStreamReadRange = { flags: 'r', mode: '0666', autoClose: true, start: 0, end: 0 };
HEADERS.responseLocalize = {};
HEADERS.responseLocalize['Access-Control-Allow-Origin'] = '*';
HEADERS.responseNotModified = {};
HEADERS.responseNotModified[HEADER_CACHE] = 'public, max-age=11111111';
HEADERS.responseNotModified['X-Powered-By'] = 'Total.js';
HEADERS.response503 = {};
HEADERS.response503[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.response503[HEADER_TYPE] = CT_HTML;
HEADERS.response503['X-Powered-By'] = 'Total.js';
HEADERS.response503ddos = {};
HEADERS.response503ddos[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
HEADERS.response503ddos[HEADER_TYPE] = CT_TEXT;
HEADERS.response503ddos['X-Powered-By'] = 'Total.js';

Object.freeze(HEADERS.authorization);

var _controller = '';
var _owner = '';
var _flags;
var _prefix;

// GO ONLINE MODE
!global.framework_internal && (global.framework_internal = require('./internal'));
!global.framework_builders && (global.framework_builders = require('./builders'));
!global.framework_utils && (global.framework_utils = require('./utils'));
!global.framework_mail && (global.framework_mail = require('./mail'));
!global.framework_image && (global.framework_image = require('./image'));
!global.framework_session && (global.framework_session = require('./session'));

require('./tangular');

function sessionwrapper(name) {
	if (!name)
		name = 'default';
	if (F.sessions[name])
		return F.sessions[name];
	var session = new framework_session.Session(name);
	session.load();
	if (F.sessionscount)
		F.sessionscount++;
	else
		F.sessionscount = 1;
	return F.sessions[name] = session;
}

global.SESSION = function(name) {
	global.framework_session = require('./session');
	global.SESSION = sessionwrapper;
	return sessionwrapper(name);
};

var TMPENV = framework_utils.copy(process.env);
TMPENV.istotaljsworker = true;

HEADERS.workers = { cwd: '', silent: false, env: TMPENV };
HEADERS.workers2 = { cwd: '', silent: true, env: TMPENV };

global.Builders = framework_builders;
var U = global.Utils = global.utils = global.U = global.framework_utils;
global.Mail = framework_mail;

global.WTF = (message, name, uri) => F.problem(message, name, uri);
global.NOBIN = global.NOSQLBINARY = (name) => F.nosql(name).binary;
global.NOSQLSTORAGE = (name) => F.nosql(name).storage;
global.NOCOUNTER = global.NOSQLCOUNTER = (name) => F.nosql(name).counter;

function nomemwrapper(name) {
	return global.framework_nosql.inmemory(name);
}

global.NOMEM = global.NOSQLMEMORY = function(name) {
	if (!global.framework_nosql)
		global.framework_nosql = require('./nosql');
	global.NOMEM = global.NOSQLMEMORY = global.framework_nosql.inmemory;
	return nomemwrapper(name);
};

global.CONFIG = function(name, val) {
	return arguments.length === 1 ? CONF[name] : (CONF[name] = val);
};

var prefid;

global.PREF = {};
global.PREF.set = function(name, value) {

	if (value === undefined)
		return F.pref[name];

	if (value === null) {
		delete F.pref[name];
	} else
		F.pref[name] = global.PREF[name] = value;

	prefid && clearTimeout(prefid);
	prefid = setTimeout(F.onPrefSave, 1000, F.pref);
};

global.CACHE = function(name, value, expire, persistent) {
	return arguments.length === 1 ? F.cache.get2(name) : F.cache.set(name, value, expire, persistent);
};

global.CREATE = (group, name) => framework_builders.getschema(group, name).default();
global.SINGLETON = (name, def) => SINGLETONS[name] || (SINGLETONS[name] = (new Function('return ' + (def || '{}')))());
global.FUNCTION = (name) => F.functions[name] || NOOP;
global.FINISHED = framework_internal.onFinished;
global.DESTROY = framework_internal.destroyStream;

function filestoragewrapper(name) {
	var key = 'storage_' + name;
	return F.databases[key] ? F.databases[key] : (F.databases[key] = new framework_nosql.DatabaseBinary({ name: name }, F.path.databases('fs-' + name + '/'), '.file'));
}

global.FILESTORAGE = function(name) {
	if (!global.framework_nosql)
		global.framework_nosql = require('./nosql');
	global.FILESTORAGE = filestoragewrapper;
	return filestoragewrapper(name);
};

global.UID16 = function(type) {
	var index;
	if (type) {
		if (UIDGENERATOR.types[type])
			index = UIDGENERATOR.types[type] = UIDGENERATOR.types[type] + 1;
		else {
			UIDGENERATOR.multiple = true;
			index = UIDGENERATOR.types[type] = 1;
		}
	} else
		index = UIDGENERATOR.index++;
	return UIDGENERATOR.date16 + index.padLeft(3, '0') + UIDGENERATOR.instance + UIDGENERATOR.date16.length + (index % 2 ? 1 : 0) + 'c'; // "c" version
};

global.UID = function(type) {
	var index;
	if (type) {
		if (UIDGENERATOR.types[type])
			index = UIDGENERATOR.types[type] = UIDGENERATOR.types[type] + 1;
		else {
			UIDGENERATOR.multiple = true;
			index = UIDGENERATOR.types[type] = 1;
		}
	} else
		index = UIDGENERATOR.index++;
	return UIDGENERATOR.date + index.padLeft(3, '0') + UIDGENERATOR.instance + UIDGENERATOR.date.length + (index % 2 ? 1 : 0) + 'b'; // "b" version
};

global.UIDF = function(type) {

	var index;

	if (type) {
		if (UIDGENERATOR.typesnumber[type])
			index = UIDGENERATOR.typesnumber[type] = UIDGENERATOR.typesnumber[type] + 1;
		else {
			UIDGENERATOR.multiplenumber = true;
			index = UIDGENERATOR.typesnumber[type] = 1;
		}
	} else
		index = UIDGENERATOR.indexnumber++;

	var div = index > 1000 ? 10000 : 1000;
	return (UIDGENERATOR.datenumber + (index / div));
};

global.ERROR = function(name) {
	return name == null ? F.errorcallback : function(err) {
		err && F.error(err, name);
	};
};

global.AUTH = function(fn) {
	F.onAuthorize = framework_builders.AuthOptions.wrap(fn);
};

global.WEBSOCKETCLIENT = function(callback) {
	var ws = require('./websocketclient').create();
	callback && callback.call(ws, ws);
	return ws;
};

global.$CREATE = function(schema) {
	var o = framework_builders.getschema(schema);
	return o ? o.default() : null;
};

global.$MAKE = function(schema, model, filter, callback, novalidate, argument) {

	var o = framework_builders.getschema(schema);
	var w = null;

	if (typeof(filter) === 'function') {
		var tmp = callback;
		callback = filter;
		filter = tmp;
	}

	if (filter instanceof Array) {
		w = {};
		for (var i = 0; i < filter.length; i++)
			w[filter[i]] = i + 1;
		filter = null;
	} else if (filter instanceof Object) {
		if (!(filter instanceof RegExp)) {
			filter = null;
			w = filter;
		}
	}

	return o ? o.make(model, filter, callback, argument, novalidate, w) : undefined;
};

global.$QUERY = function(schema, options, callback, controller) {
	var o = framework_builders.getschema(schema);
	if (o)
		o.query(options, callback, controller);
	else
		callback && callback(new Error('Schema "{0}" not found.'.format(getSchemaName(schema))));
	return !!o;
};

global.$GET = global.$READ = function(schema, options, callback, controller) {
	var o = framework_builders.getschema(schema);
	if (o)
		o.get(options, callback, controller);
	else
		callback && callback(new Error('Schema "{0}" not found.'.format(getSchemaName(schema))));
	return !!o;
};

global.$WORKFLOW = function(schema, name, options, callback, controller) {
	var o = framework_builders.getschema(schema);
	if (o)
		o.workflow2(name, options, callback, controller);
	else
		callback && callback(new Error('Schema "{0}" not found.'.format(getSchemaName(schema))));
	return !!o;
};

global.$TRANSFORM = function(schema, name, options, callback, controller) {
	var o = framework_builders.getschema(schema);
	if (o)
		o.transform2(name, options, callback, controller);
	else
		callback && callback(new Error('Schema "{0}" not found.'.format(getSchemaName(schema))));
	return !!o;
};

global.$REMOVE = function(schema, options, callback, controller) {
	var o = framework_builders.getschema(schema);

	if (typeof(options) === 'function') {
		controller = callback;
		callback = options;
		options = EMPTYOBJECT;
	}

	if (o)
		o.remove(options, callback, controller);
	else
		callback && callback(new Error('Schema "{0}" not found.'.format(getSchemaName(schema))));
	return !!o;
};

global.$SAVE = function(schema, model, options, callback, controller, novalidate) {
	return performschema('$save', schema, model, options, callback, controller, novalidate);
};

global.$INSERT = function(schema, model, options, callback, controller, novalidate) {
	return performschema('$insert', schema, model, options, callback, controller, novalidate);
};

global.$UPDATE = function(schema, model, options, callback, controller, novalidate) {
	return performschema('$update', schema, model, options, callback, controller, novalidate);
};

global.$PATCH = function(schema, model, options, callback, controller, novalidate) {
	return performschema('$patch', schema, model, options, callback, controller, novalidate);
};

// GET Users/Neviem  --> @query @workflow
global.$ACTION = function(schema, model, callback, controller) {

	if (typeof(model) === 'function') {
		controller = callback;
		callback = model;
		model = null;
	}

	var meta = F.temporary.other[schema];
	var tmp, index;

	if (!meta) {

		index = schema.indexOf('-->');

		var op = (schema.substring(index + 3).trim().trim() + ' ').split(/\s@/).trim();
		tmp = schema.substring(0, index).split(/\s|\t/).trim();

		if (tmp.length !== 2) {
			callback('Invalid "{0}" type.'.format(schema));
			return;
		}

		meta = {};
		meta.method = tmp[0].toUpperCase();
		meta.schema = tmp[1];

		if (meta.schema[0] === '*')
			meta.schema = meta.schema.substring(1);

		meta.op = [];
		meta.opcallbackindex = -1;

		var name = meta.schema.split('/');
		var o = GETSCHEMA(name[0], name[1]);
		if (!o) {
			callback(new ErrorBuilder().push('', 'Schema "{0}" not found'.format(meta.schema)));
			return;
		}

		for (var i = 0; i < op.length; i++) {

			tmp = {};

			var item = op[i];
			if (item[0] === '@')
				item = item.substring(1);

			index = item.indexOf('(');

			if (index !== -1) {
				meta.opcallbackindex = i;
				tmp.response = true;
				item = item.substring(0, index).trim();
			}

			tmp.name = item;
			tmp.name2 = '$' + tmp.name;

			if (o.meta[item] === undefined) {
				if (o.meta['workflow#' + item] !== undefined)
					tmp.type = '$workflow';
				else if (o.meta['transform#' + item] !== undefined)
					tmp.type = '$transform';
				else if (o.meta['operation#' + item] !== undefined)
					tmp.type = '$operation';
				else if (o.meta['hook#' + item] !== undefined)
					tmp.type = '$hook';
				else {
					callback(new ErrorBuilder().push('', 'Schema "{0}" doesn\'t contain "{1}" operation.'.format(meta.schema, item)));
					return;
				}
			}

			if (tmp.type)
				tmp.type2 = tmp.type.substring(1);

			meta.op.push(tmp);
		}

		meta.multiple = meta.op.length > 1;
		meta.schema = o;
		meta.validate = meta.method !== 'GET';
		F.temporary.other[schema] = meta;
	}

	if (meta.validate) {

		var req = controller ? controller.req : null;
		if (meta.method === 'PATCH' || meta.method === 'DELETE') {
			if (!req)
				req = {};
			req.$patch = true;
		}

		var data = {};
		data.meta = meta;
		data.callback = callback;
		data.controller = controller;
		meta.schema.make(model, null, performsschemaaction_async, data, null, null, req);
	} else
		performsschemaaction(meta, null, callback, controller);

};

function performsschemaaction_async(err, response, data) {
	if (err)
		data.callback(err);
	else
		performsschemaaction(data.meta, response, data.callback, data.controller);
}

function performsschemaaction(meta, model, callback, controller) {

	if (meta.multiple) {

		if (!model)
			model = meta.schema.default();

		model.$$controller = controller;
		var async = model.$async(callback, meta.opcallbackindex === - 1 ? null : meta.opcallbackindex);

		for (var i = 0; i < meta.op.length; i++) {
			var op = meta.op[i];
			if (op.type)
				async[op.type](op.name);
			else
				async[op.name2]();
		}

	} else {

		var op = meta.op[0];

		if (model) {
			model.$$controller = controller;
			if (op.type)
				model[op.type](op.name, EMPTYOBJECT, callback);
			else
				model[op.name2](EMPTYOBJECT, callback);
		} else {
			if (op.type)
				meta.schema[op.type2 + '2'](op.name, EMPTYOBJECT, callback, controller);
			else
				meta.schema[op.name](EMPTYOBJECT, callback, controller);
		}
	}
}

// type, schema, model, options, callback, controller
function performschema(type, schema, model, options, callback, controller, novalidate) {

	if (typeof(options) === 'function') {
		novalidate = controller;
		controller = callback;
		callback = options;
		options = null;
	}

	var o = framework_builders.getschema(schema);

	if (!o) {
		callback && callback(new Error('Schema "{0}" not found.'.format(getSchemaName(schema))));
		return false;
	}

	var workflow = {};
	workflow[type.substring(1)] = 1;

	var req = controller ? controller.req : null;
	var keys;

	if (type === '$patch') {
		keys = Object.keys(model);
		if (req)
			req.$patch = true;
		else
			req = { $patch: true };
	}

	o.make(model, null, function(err, model) {
		if (err) {
			callback && callback(err);
		} else {
			model.$$keys = keys;
			model.$$controller = controller;
			model[type](options, callback);
			if (req && req.$patch && req.method && (req.method !== 'PATCH' & req.method !== 'DELETE'))
				delete req.$patch;
		}
	}, null, novalidate, workflow, req);

	return !!o;
}

global.$ASYNC = function(schema, callback, index, controller) {

	if (index && typeof(index) === 'object') {
		controller = index;
		index = undefined;
	}

	var o = framework_builders.getschema(schema).default();

	if (!o) {
		callback && callback(new Error('Schema "{0}" not found.'.format(getSchemaName(schema))));
		return EMPTYOBJECT;
	}

	controller && (o.$$controller = controller);
	return o.$async(callback, index);
};

global.$OPERATION = function(schema, name, options, callback, controller) {
	var o = framework_builders.getschema(schema);
	if (o)
		o.operation2(name, options, callback, controller);
	else
		callback && callback(new Error('Schema "{0}" not found.'.format(getSchemaName(schema))));
	return !!o;
};

global.DB = global.DATABASE = function(a, b, c, d) {
	return typeof(F.database) === 'object' ? F.database : F.database(a, b, c, d);
};

global.OFF = function() {
	return arguments.length > 1 ? F.removeListener.apply(F, arguments) : F.removeAllListeners.apply(F, arguments);
};

global.NEWSCHEMA = function(group, name, make) {

	if (typeof(name) === 'function') {
		make = name;
		name = undefined;
	}

	if (!name) {
		var arr = group.split('/');
		if (arr.length === 2) {
			name = arr[1];
			group = arr[0];
		} else {
			name = group;
			group = 'default';
		}
	}

	var schema = framework_builders.newschema(group, name);
	make && make.call(schema, schema);
	return schema;
};

global.CLEANUP = function(stream, callback) {
	FINISHED(stream, function() {
		DESTROY(stream);
		if (callback) {
			callback();
			callback = null;
		}
	});
};

global.SUCCESS = function(success, value) {

	if (typeof(success) === 'function') {
		return function(err, value) {
			success(err, SUCCESS(err, value));
		};
	}

	var err;

	if (success instanceof Error) {
		err = success.toString();
		success = false;
	} else if (success instanceof framework_builders.ErrorBuilder) {
		if (success.hasError()) {
			err = success.output();
			success = false;
		} else
			success = true;
	} else if (success == null)
		success = true;

	SUCCESSHELPER.success = !!success;
	SUCCESSHELPER.value = value === SUCCESSHELPER ? value.value : value == null ? undefined : (value && value.$$schema ? value.$clean() : value);
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

	if (F.config.nowarnings)
		return;

	console.log(NOW.format('yyyy-MM-dd HH:mm:ss') + ' :: OBSOLETE / IMPORTANT ---> "' + name + '"', message);
	if (global.F)
		F.stats.other.obsolete++;
};

global.DEBUG = false;
global.TEST = false;
global.RELEASE = false;
global.is_client = false;
global.is_server = true;

var directory = U.$normalize(require.main ? Path.dirname(require.main.filename) : process.cwd());

// F.service() changes the values below:
var DATE_EXPIRES = new Date().add('y', 1).toUTCString();

const _randomstring = 'abcdefghijklmnoprstuwxy'.split('');

function random2string() {
	return _randomstring[(Math.random() * _randomstring.length) >> 0] + _randomstring[(Math.random() * _randomstring.length) >> 0];
}

const WEBSOCKET_COMPRESS = Buffer.from([0x00, 0x00, 0xFF, 0xFF]);
const WEBSOCKET_COMPRESS_OPTIONS = { windowBits: Zlib.Z_DEFAULT_WINDOWBITS };
const UIDGENERATOR = { types: {}, typesnumber: {} };

function UIDGENERATOR_REFRESH() {

	var ticks = NOW.getTime();
	var dt = Math.round(((ticks - 1580511600000) / 1000 / 60));

	UIDGENERATOR.date = dt + '';
	UIDGENERATOR.date16 = dt.toString(16);

	var seconds = ((NOW.getSeconds() / 60) + '').substring(2, 4);
	UIDGENERATOR.datenumber = +((((ticks - 1580511600000) / 1000 / 60) >> 0) + seconds); // 1580511600000 means 1.1.2020
	UIDGENERATOR.indexnumber = 1;
	UIDGENERATOR.index = 1;
	UIDGENERATOR.instance = random2string();

	var keys;

	if (UIDGENERATOR.multiple) {
		keys = Object.keys(UIDGENERATOR.types);
		for (var i = 0; i < keys.length; i++)
			UIDGENERATOR.types[keys[i]] = 0;
	}

	if (UIDGENERATOR.multiplenumber) {
		keys = Object.keys(UIDGENERATOR.typesnumber);
		for (var i = 0; i < keys.length; i++)
			UIDGENERATOR.typesnumber[keys[i]] = 0;
	}
}

UIDGENERATOR_REFRESH();

const EMPTYBUFFER = Buffer.alloc(0);
global.EMPTYBUFFER = EMPTYBUFFER;

const controller_error_status = function(controller, status, problem) {

	if (status !== 500 && problem)
		controller.problem(problem);

	if (controller.res.success || controller.res.headersSent || !controller.isConnected)
		return controller;

	controller.precache && controller.precache(null, null, null);
	controller.req.path = EMPTYARRAY;
	controller.req.$total_success();
	controller.req.$total_route = F.lookup(controller.req, '#' + status, EMPTYARRAY, 0);
	controller.req.$total_exception = problem;
	controller.req.$total_execute(status, true);

	return controller;
};

var PERF = {};

function Framework() {

	var self = this;

	self.$id = null; // F.id ==> property
	self.version = 3413;
	self.version_header = '3.4.13';
	self.version_node = process.version.toString();
	self.syshash = (__dirname + '-' + Os.hostname() + '-' + Os.platform() + '-' + Os.arch() + '-' + Os.release() + '-' + Os.tmpdir() + JSON.stringify(process.versions)).md5();
	self.pref = global.PREF;
	global.CONF = self.config = {

		debug: true,
		trace: true,
		trace_console: true,

		//nowarnings: process.argv.indexOf('restart') !== -1,
		nowarnings: true,
		name: 'Total.js',
		version: '1.0.0',
		author: '',
		secret: self.syshash,
		secret_uid: self.syshash.substring(10),

		'security.txt': 'Contact: mailto:support@totaljs.com\nContact: https://www.totaljs.com/contact/',
		etag_version: '',
		directory_src: '/.src/',
		directory_bundles: '/bundles/',
		directory_controllers: '/controllers/',
		directory_components: '/components/',
		directory_views: '/views/',
		directory_definitions: '/definitions/',
		directory_temp: '/tmp/',
		directory_models: '/models/',
		directory_schemas: '/schemas/',
		directory_operations: '/operations/',
		directory_resources: '/resources/',
		directory_public: '/public/',
		directory_public_virtual: '/app/',
		directory_modules: '/modules/',
		directory_source: '/source/',
		directory_logs: '/logs/',
		directory_tests: '/tests/',
		directory_databases: '/databases/',
		directory_workers: '/workers/',
		directory_packages: '/packages/',
		directory_private: '/private/',
		directory_isomorphic: '/isomorphic/',
		directory_configs: '/configs/',
		directory_services: '/services/',
		directory_themes: '/themes/',
		directory_tasks: '/tasks/',
		directory_updates: '/updates/',

		// all HTTP static request are routed to directory-public
		static_url: '',
		static_url_script: '/js/',
		static_url_style: '/css/',
		static_url_image: '/img/',
		static_url_video: '/video/',
		static_url_font: '/fonts/',
		static_url_download: '/download/',
		static_url_components: '/components.',
		static_accepts: { flac: true, jpg: true, jpeg: true, png: true, gif: true, ico: true, js: true, mjs: true, css: true, txt: true, xml: true, woff: true, woff2: true, otf: true, ttf: true, eot: true, svg: true, zip: true, rar: true, pdf: true, docx: true, xlsx: true, doc: true, xls: true, html: true, htm: true, appcache: true, manifest: true, map: true, ogv: true, ogg: true, mp4: true, mp3: true, webp: true, webm: true, swf: true, package: true, json: true, md: true, m4v: true, jsx: true, heif: true, heic: true, ics: true },

		// 'static-accepts-custom': [],
		default_crypto_iv: Buffer.from(self.syshash).slice(0, 16),
		default_xpoweredby: 'Total.js',
		default_layout: 'layout',
		default_theme: '',
		default_proxy: '',
		default_request_maxkeys: 33,
		default_request_maxkey: 25,

		// default maximum request size / length
		// default 10 kB
		default_request_maxlength: 10,
		default_websocket_maxlength: 2,
		default_websocket_encodedecode: true,
		default_maxopenfiles: 100,
		default_timezone: 'utc',
		default_root: '',
		default_response_maxage: '11111111',
		default_errorbuilder_status: 200,

		// Default originators
		default_cors: null,

		// Seconds (2 minutes)
		default_cors_maxage: 120,

		// in milliseconds
		default_request_timeout: 3000,
		default_dependency_timeout: 1500,
		default_restbuilder_timeout: 10000,

		// otherwise is used ImageMagick (Heroku supports ImageMagick)
		// gm = graphicsmagick or im = imagemagick or magick (new version of ImageMagick)
		default_image_converter: 'gm', // command-line name
		default_image_quality: 93,
		default_image_consumption: 0, // disabled because e.g. GM v1.3.32 throws some error about the memory

		allow_static_files: true,
		allow_gzip: true,
		allow_websocket: true,
		allow_websocket_compression: true,
		allow_compile: true,
		allow_compile_script: true,
		allow_compile_style: true,
		allow_compile_html: true,
		allow_localize: true,
		allow_stats_snapshot: true,
		allow_performance: false,
		allow_custom_titles: false,
		allow_cache_snapshot: false,
		allow_cache_cluster: false,
		allow_debug: false,
		allow_head: false,
		allow_filter_errors: true,
		allow_clear_temp: true,
		allow_ssc_validation: true,
		allow_workers_silent: false,
		allow_sessions_unused: '-20 minutes',
		allow_reqlimit: 0,
		allow_persistent_images: false,

		nosql_worker: false,
		nosql_inmemory: null, // String Array
		nosql_cleaner: 1440,
		nosql_logger: true,
		logger: false,

		// Used in F.service()
		// All values are in minutes
		default_interval_clear_resources: 20,
		default_interval_clear_cache: 10,
		default_interval_clear_dnscache: 30,
		default_interval_precompile_views: 61,
		default_interval_websocket_ping: 3,
		default_interval_uptodate: 5,

		set ['mail-smtp'] (val) {
			CONF['mail_smtp'] = val;
			return null;
		},

		set ['mail-smtp-options'] (val) {
			CONF['mail_smtp_options'] = val;
			return null;
		},

		set ['mail-address-reply'] (val) {
			CONF['mail_address_reply'] = val;
			return null;
		},

		set ['mail-address-from'] (val) {
			CONF['mail_address_from'] = val;
			return null;
		},

		set ['mail-address-copy'] (val) {
			CONF['mail_address_copy'] = val;
			return null;
		}
	};

	global.REPO = global.G = self.global = {};
	global.MAIN = {};
	global.TEMP = {};

	self.$bundling = true;
	self.resources = {};
	self.connections = {};
	global.FUNC = self.functions = {};
	self.themes = {};
	self.versions = null;
	self.workflows = {};
	self.uptodates = null;
	self.schedules = {};

	self.isDebug = true;
	self.isTest = false;
	self.isLoaded = false;
	self.isWorker = true;
	self.isCluster = process.env.PASSENGER_APP_ENV ? false : require('cluster').isWorker;

	self.routes = {
		sitemap: null,
		web: [],
		system: {},
		files: [],
		filesfallback: null,
		cors: [],
		corsall: false,
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
		proxies: [],
		resources: {}
	};

	self.owners = [];
	self.modificators = null;
	self.modificators2 = null;
	DEF.helpers = self.helpers = {};
	self.modules = {};
	self.models = {};
	self.sources = {};
	self.controllers = {};
	self.dependencies = {};
	self.isomorphic = {};
	self.components = { has: false, css: false, js: false, views: {}, instances: {}, version: null, links: '', groups: {}, files: {} };
	self.convertors = [];
	self.convertors2 = null;
	self.tests = [];
	self.errors = [];
	self.timeouts = [];
	self.problems = [];
	self.changes = [];
	self.server = null;
	self.port = 0;
	self.ip = '';

	DEF.validators = self.validators = {
		email: new RegExp('^[a-zA-Z0-9-_.+]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'),
		url: /^http(s)?:\/\/[^,{}\\]*$/i,
		phone: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,8}$/im,
		zip: /^[0-9a-z\-\s]{3,20}$/i,
		uid: /^\d{14,}[a-z]{3}[01]{1}|^\d{9,14}[a-z]{2}[01]{1}a|^\d{4,18}[a-z]{2}\d{1}[01]{1}b|^[0-9a-f]{4,18}[a-z]{2}\d{1}[01]{1}c|^[0-9a-z]{4,18}[a-z]{2}\d{1}[01]{1}d$/
	};

	self.workers = {};
	self.sessions = {};
	self.flows = {};
	self.databases = {};
	self.databasescleaner = {};
	self.directory = HEADERS.workers2.cwd = HEADERS.workers.cwd = directory;
	self.isLE = Os.endianness ? Os.endianness() === 'LE' : true;
	self.isHTTPS = false;

	// Fix for workers crash (port in use) when debugging main process with --inspect or --debug
	// See: https://github.com/nodejs/node/issues/14325 and https://github.com/nodejs/node/issues/9435
	for (var i = 0; i < process.execArgv.length; i++) {
		// Setting inspect/debug port to random unused
		if ((/inspect|debug/).test(process.execArgv[i])) {
			process.execArgv[i] = '--inspect=0';
			break;
		}
	}

	HEADERS.workers.execArgv = process.execArgv;

	// It's hidden
	// self.waits = {};

	self.temporary = {
		path: {},
		shortcache: {},
		notfound: {},
		processing: {},
		range: {},
		views: {},
		versions: {},
		dependencies: {}, // temporary for module dependencies
		other: {},
		keys: {}, // for crypto keys
		internal: {}, // controllers/modules names for the routing
		owners: {},
		ready: {},
		ddos: {},
		service: { redirect: 0, request: 0, file: 0, usage: 0 }
	};

	self.stats = {

		error: 0,

		performance: {
			request: 0,
			message: 0,
			external: 0,
			file: 0,
			open: 0,
			dbrm: 0,
			dbwm: 0,
			online: 0,
			usage: 0,
			mail: 0
		},

		other: {
			websocketPing: 0,
			websocketCleaner: 0,
			obsolete: 0,
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
			patch: 0,
			upload: 0,
			schema: 0,
			operation: 0,
			blocked: 0,
			'delete': 0,
			mobile: 0,
			desktop: 0
		},
		response: {
			ddos: 0,
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
			proxy: 0,
			notModified: 0,
			sse: 0,
			errorBuilder: 0,
			error400: 0,
			error401: 0,
			error403: 0,
			error404: 0,
			error408: 0,
			error409: 0,
			error431: 0,
			error500: 0,
			error501: 0,
			error503: 0
		}
	};

	// intialize cache
	self.cache = new FrameworkCache();
	self.path = global.PATH = new FrameworkPath();

	self._request_check_redirect = false;
	self._request_check_referer = false;
	self._request_check_POST = false;
	self._request_check_robot = false;
	self._request_check_mobile = false;
	self._request_check_proxy = false;
	self._length_middleware = 0;
	self._length_request_middleware = 0;
	self._length_files = 0;
	self._length_wait = 0;
	self._length_themes = 0;
	self._length_cors = 0;
	self._length_subdomain_web = 0;
	self._length_subdomain_websocket = 0;
	self._length_convertors = 0;

	self.isVirtualDirectory = false;
	self.isTheme = false;
	self.isWindows = Os.platform().substring(0, 3).toLowerCase() === 'win';

	self.$events = {};
	self.commands = { reload_preferences: [loadpreferences] };
}

// ======================================================
// PROTOTYPES
// ======================================================

Framework.prototype = {
	get datetime() {
		return global.NOW;
	},
	set datetime(val) {
		global.NOW = val;
	},
	get cluster() {
		return require('./cluster');
	},
	get id() {
		return F.$id;
	},
	set id(value) {
		CLUSTER_CACHE_SET.ID = value;
		CLUSTER_CACHE_REMOVE.ID = value;
		CLUSTER_CACHE_REMOVEALL.ID = value;
		CLUSTER_CACHE_CLEAR.ID = value;
		F.$id = value;
		return F.$id;
	}
};

var framework = new Framework();
global.framework = global.F = module.exports = framework;

global.CMD = function(key, a, b, c, d) {
	if (F.commands[key]) {
		for (var i = 0; i < F.commands[key].length; i++)
			F.commands[key][i](a, b, c, d);
	}
};

F.callback_redirect = function(url) {
	this.url = url;
};

F.dir = function(path) {
	F.directory = path;
	directory = path;
};

F.refresh = function() {

	NOW = new Date();

	F.$events.clear && EMIT('clear', 'temporary', F.temporary);
	F.temporary.path = {};
	F.temporary.range = {};
	F.temporary.views = {};
	F.temporary.other = {};
	F.temporary.keys = {};
	global.$VIEWCACHE && global.$VIEWCACHE.length && (global.$VIEWCACHE = []);

	// Clears command cache
	Image.clear();

	CONF.allow_debug && F.consoledebug('clear temporary cache');

	var keys = Object.keys(F.temporary.internal);
	for (var i = 0; i < keys.length; i++)
		if (!F.temporary.internal[keys[i]])
			delete F.temporary.internal[keys[i]];

	F.$events.clear && EMIT('clear', 'resources');
	F.resources = {};
	CONF.allow_debug && F.consoledebug('clear resources');

	F.$events.clear && EMIT('clear', 'dns');
	CMD('clear_dnscache');
	CONF.allow_debug && F.consoledebug('clear DNS cache');

	return F;
};

F.prototypes = function(fn) {

	if (!global.framework_nosql)
		global.framework_nosql = require('./nosql');

	var proto = {};
	proto.Chunker = framework_utils.Chunker.prototype;
	proto.Controller = Controller.prototype;
	proto.Database = framework_nosql.Database.prototype;
	proto.DatabaseBinary = framework_nosql.DatabaseBinary.prototype;
	proto.DatabaseBuilder = framework_nosql.DatabaseBuilder.prototype;
	proto.DatabaseBuilder2 = framework_nosql.DatabaseBuilder2.prototype;
	proto.DatabaseCounter = framework_nosql.DatabaseCounter.prototype;
	proto.DatabaseStorage = framework_nosql.DatabaseStorage.prototype;
	proto.DatabaseTable = framework_nosql.DatabaseTable.prototype;
	proto.ErrorBuilder = framework_builders.ErrorBuilder.prototype;
	proto.HttpFile = framework_internal.HttpFile.prototype;
	proto.HttpRequest = PROTOREQ;
	proto.HttpResponse = PROTORES;
	proto.Image = framework_image.Image.prototype;
	proto.Message = Mail.Message.prototype;
	proto.MiddlewareOptions = MiddlewareOptions.prototype;
	proto.OperationOptions = framework_builders.OperationOptions.prototype;
	proto.Page = framework_builders.Page.prototype;
	proto.Pagination = framework_builders.Pagination.prototype;
	proto.RESTBuilder = framework_builders.RESTBuilder.prototype;
	proto.RESTBuilderResponse = framework_builders.RESTBuilderResponse.prototype;
	proto.SchemaBuilder = framework_builders.SchemaBuilder.prototype;
	proto.SchemaOptions = framework_builders.SchemaOptions.prototype;
	proto.UrlBuilder = framework_builders.UrlBuilder.prototype;
	proto.WebSocket = WebSocket.prototype;
	proto.WebSocketClient = WebSocketClient.prototype;
	proto.AuthOptions = framework_builders.AuthOptions.prototype;
	fn.call(proto, proto);
	return F;
};

global.ON = F.on = function(name, fn) {

	if (name === 'init' || name === 'ready' || name === 'load') {
		if (F.isLoaded) {
			fn.call(F);
			return;
		}
	} else if (name.indexOf('#') !== -1) {
		var arr = name.split('#');
		switch (arr[0]) {
			case 'middleware':
				F.temporary.ready[name] && fn.call(F);
				break;
			case 'component':
				F.temporary.ready[name] && fn.call(F);
				break;
			case 'model':
				F.temporary.ready[name] && fn.call(F, F.models[arr[1]]);
				break;
			case 'source':
				F.temporary.ready[name] && fn.call(F, F.sources[arr[1]]);
				break;
			case 'package':
			case 'module':
				F.temporary.ready[name] && fn.call(F, F.modules[arr[1]]);
				break;
			case 'controller':
				F.temporary.ready[name] && fn.call(F, F.controllers[arr[1]]);
				break;
		}
	}

	switch (name) {
		case 'cache-set':
		case 'controller-render-meta':
		case 'request-end':
		case 'websocket-begin':
		case 'websocket-end':
		case 'request-begin':
		case 'upload-begin':
		case 'upload-end':
			OBSOLETE(name, 'Name of event has been replaced to "{0}"'.format(name.replace(/-/g, '_')));
			break;
		case 'cache-expire':
			OBSOLETE(name, 'Name of event has been replaced to "cache_expired"');
			break;
	}

	if (isWORKER && name === 'service' && !F.cache.interval)
		F.cache.init_timer();

	if (F.$events[name])
		F.$events[name].push(fn);
	else
		F.$events[name] = [fn];

	return F;
};

global.EMIT = F.emit = function(name, a, b, c, d, e, f, g) {

	var evt = F.$events[name];
	if (evt) {
		var clean = false;
		for (var i = 0, length = evt.length; i < length; i++) {
			if (evt[i].$once)
				clean = true;
			evt[i].call(F, a, b, c, d, e, f, g);
		}
		if (clean) {
			evt = evt.remove(n => n.$once);
			if (evt.length)
				F.$events[name] = evt;
			else
				F.$events[name] = undefined;
		}
	}
	return F;
};

global.ONCE = F.once = function(name, fn) {
	fn.$once = true;
	return F.on(name, fn);
};

F.removeListener = function(name, fn) {
	var evt = F.$events[name];
	if (evt) {
		evt = evt.remove(n => n === fn);
		if (evt.length)
			F.$events[name] = evt;
		else
			F.$events[name] = undefined;
	}
	return F;
};

F.removeAllListeners = function(name) {
	if (name)
		F.$events[name] = undefined;
	else
		F.$events = {};
	return F;
};

/**
 * Internal function
 * @return {String} Returns current (dependency type and name) owner.
 */
F.$owner = function() {
	return _owner;
};

F.isSuccess = function(obj) {
	return obj === SUCCESSHELPER;
};

F.convert = function(value, convertor) {

	if (convertor) {

		if (F.convertors.findIndex('name', value) !== -1) {
			if (convertor == null)
				F.convertors = F.convertors.remove('name', value);
			return false;
		}

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
					return console.log('Unknown convertor type:', convertor);
			}
		}

		F.convertors.push({ name: value, convertor: convertor });
		F._length_convertors = F.convertors.length;
		return true;
	}

	if (value) {
		for (var i = 0, length = F.convertors.length; i < length; i++) {
			if (value[F.convertors[i].name] != null)
				value[F.convertors[i].name] = F.convertors[i].convertor(value[F.convertors[i].name]);
		}
	}

	return value;
};

/**
 * Get a controller
 * @param {String} name
 * @return {Object}
 */
F.controller = function(name) {
	return F.controllers[name] || null;
};

/**
 * Use configuration
 * @param {String} filename
 * @return {Framework}
 */
F.useConfig = function(name) {
	OBSOLETE('F.useConfig', 'F.useConfig will be moreved in Total.js v4');
	return F.$configure_configs(name, true);
};

Mail.use = function(smtp, options, callback) {

	if (typeof(options) === 'function') {
		callback = options;
		options = undefined;
	}

	Mail.try(smtp, options, function(err) {

		if (!err) {
			delete F.temporary.mail_settings;
			CONF.mail_smtp = smtp;
			CONF.mail_smtp_options = options;
		}

		if (callback)
			callback(err);
		else if (err)
			F.error(err, 'F.useSMTP()', null);
	});
};

F.useSMTP = function(smtp, options, callback) {
	OBSOLETE('F.useSMTP', 'Use `Mail.use() instead of F.useSMTP()');
	Mail.use(smtp, options, callback);
	return F;
};

/**
 * Sort all routes
 * @return {Framework}
 */
F.$routesSort = function(type) {

	F.routes.web.sort((a, b) => a.priority > b.priority ? -1 : a.priority < b.priority ? 1 : 0);
	F.routes.websockets.sort((a, b) => a.priority > b.priority ? -1 : a.priority < b.priority ? 1 : 0);

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
		var tmp = F.routes.web.findItem(item => item.hash === route.hash && item !== route);
		route.isUNIQUE = tmp == null;
	});

	// Clears cache
	Object.keys(F.temporary.other).forEach(function(key) {
		if (key[0] === '1')
			F.temporary.other[key] = undefined;
	});

	return F;
};

F.parseComponent = parseComponent;

global.SCRIPT = F.script = function(body, value, callback, param) {

	var fn;
	var compilation = value === undefined && callback === undefined;
	var err;

	try {
		fn = new Function('next', 'value', 'now', 'var model=value;var global,require,process,GLOBAL,root,clearImmediate,clearInterval,clearTimeout,setImmediate,setInterval,setTimeout,console,$STRING,$VIEWCACHE,framework_internal,TransformBuilder,Pagination,Page,URLBuilder,UrlBuilder,SchemaBuilder,framework_builders,framework_utils,framework_mail,Image,framework_image,framework_nosql,Builders,U,utils,Utils,Mail,WTF,SOURCE,INCLUDE,MODULE,NOSQL,NOBIN,NOCOUNTER,NOSQLMEMORY,NOMEM,DATABASE,DB,CONFIG,INSTALL,UNINSTALL,RESOURCE,TRANSLATOR,LOG,LOGGER,MODEL,GETSCHEMA,CREATE,UID,TRANSFORM,MAKE,SINGLETON,NEWTRANSFORM,NEWSCHEMA,EACHSCHEMA,FUNCTION,ROUTING,SCHEDULE,OBSOLETE,DEBUG,TEST,RELEASE,is_client,is_server,F,framework,Controller,setTimeout2,clearTimeout2,String,Number,Boolean,Object,Function,Date,isomorphic,I,eval;UPTODATE,NEWOPERATION,OPERATION,$$$,EMIT,ON,$QUERY,$GET,$WORKFLOW,$TRANSFORM,$OPERATION,$MAKE,$CREATE,HttpFile;EMPTYCONTROLLER,ROUTE,FILE,TEST,WEBSOCKET,MAIL,LOGMAIL,FUNC,REPO,FILESTORAGE;try{' + body + ';\n}catch(e){next(e)}');
	} catch(e) {
		err = e;
	}

	if (err) {
		callback && callback(err);
		return compilation ? err : F;
	}

	if (compilation) {
		return (function() {
			return function(model, callback, param) {
				return fn.call(EMPTYOBJECT, function(value) {
					if (value instanceof Error)
						callback(value, undefined, param);
					else
						callback(null, value, param);
				}, model, scriptNow);
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

	}, value, scriptNow, param);

	return F;
};

function scriptNow() {
	return new Date();
}

function nosqlwrapper(name) {
	var db = F.databases[name];
	if (db)
		return db;

	// absolute
	if (name[0] === '~') {
		db = framework_nosql.load(U.getName(name), name.substring(1), true);
	} else {
		var is = name.substring(0, 6);
		if (is === 'http:/' || is === 'https:')
			db = framework_nosql.load(U.getName(name), name);
		else {
			F.path.verify('databases');
			db = framework_nosql.load(name, F.path.databases(name));
		}
	}

	F.databases[name] = db;
	return db;
}

F.database = global.NOSQL = F.nosql = function(name) {
	if (!global.framework_nosql)
		global.framework_nosql = require('./nosql');
	// Someone rewrites F.database
	if (F.database !== F.nosql)
		global.NOSQL = F.nosql = nosqlwrapper;
	else
		F.database = nosqlwrapper;

	return nosqlwrapper(name);
};

function tablewrapper(name) {
	var db = F.databases['$' + name];
	if (db)
		return db;

	if (name[0] === '~') {
		db = framework_nosql.load(U.getName(name), name.substring(1), true);
	} else {
		F.path.verify('databases');
		db = framework_nosql.table(name, F.path.databases(name));
	}

	F.databases['$' + name] = db;
	return db;
}

global.TABLE = function(name) {
	if (!global.framework_nosql)
		global.framework_nosql = require('./nosql');
	global.TABLE = tablewrapper;
	return tablewrapper(name);
};

F.stop = F.kill = function(signal) {

	if (F.isKilled)
		return F;

	F.isKilled = true;

	if (!signal)
		signal = 'SIGTERM';

	for (var m in F.workers) {
		var worker = F.workers[m];
		TRY(() => worker && worker.kill && worker.kill(signal));
	}

	global.framework_nosql && global.framework_nosql.kill(signal);

	EMIT('exit', signal);

	if (!F.isWorker && process.send && process.connected)
		TRY(() => process.send('total:stop'));

	F.cache.stop();

	if (F.server) {
		F.server.setTimeout(1);
		F.server.close();
	}

	// var extenddelay = F.grapdbinstance && require('./graphdb').getImportantOperations() > 0;
	// setTimeout(() => process.exit(signal), global.TEST || extenddelay ? 2000 : 300);
	setTimeout(() => process.exit(signal), global.TEST ? 2000 : 300);
	return F;
};


global.PROXY = F.proxy = function(url, target, copypath, before, after) {

	if (typeof(copypath) == 'function') {
		after = before;
		before = copypath;
		copypath = false;
	}

	var obj = { url: url, uri: require('url').parse(target), before: before, after: after, copypath: copypath };
	F.routes.proxies.push(obj);
	F._request_check_proxy = true;
};

global.REDIRECT = F.redirect = function(host, newHost, withPath, permanent) {

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
global.SCHEDULE = F.schedule = function(date, repeat, fn) {

	if (fn === undefined) {
		fn = repeat;
		repeat = false;
	}

	var type = typeof(date);

	if (type === 'string') {
		date = date.parseDate().toUTC();
		repeat && date < NOW && (date = date.add(repeat));
	} else if (type === 'number')
		date = new Date(date);

	var sum = date.getTime();
	repeat && (repeat = repeat.replace('each', '1'));
	var id = U.GUID(5);
	F.schedules[id] = { expire: sum, fn: fn, repeat: repeat, owner: _owner };
	return id;
};

F.clearSchedule = function(id) {
	delete F.schedules[id];
	return F;
};

/**
 * Auto resize picture according the path
 * @param {String} url Relative path.
 * @param {Function(image)} fn Processing.
 * @param {String Array} flags Optional, can contains extensions `.jpg`, `.gif' or watching path `/img/gallery/`
 * @return {Framework}
 */
global.RESIZE = F.resize = function(url, fn, flags) {

	var extensions = {};
	var cache = true;

	if (typeof(flags) === 'function') {
		var tmp = flags;
		flags = fn;
		fn = tmp;
	}

	var ext = url.match(/\*.\*$|\*?\.(jpg|png|gif|jpeg|heif|heic|apng)$/gi);
	if (ext) {
		url = url.replace(ext, '');
		switch (ext.toString().toLowerCase()) {
			case '*.*':
				extensions['*'] = true;
				break;
			case '*.jpg':
			case '*.gif':
			case '*.png':
			case '*.heif':
			case '*.heic':
			case '*.apng':
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
			else if (flag[0] === '~' || flag[0] === '/' || flag.match(/^http:|https:/gi))
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
		extensions['heic'] = true;
		extensions['heif'] = true;
		extensions['apng'] = true;
	}

	if (extensions['jpg'] && !extensions['jpeg'])
		extensions['jpeg'] = true;
	else if (extensions['jpeg'] && !extensions['jpg'])
		extensions['jpg'] = true;

	F.routes.resize[url] = { fn: fn, path: U.path(path || url), ishttp: path.match(/http:|https:/gi) ? true : false, extension: extensions, cache: cache };
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
F.restful = function(url, flags, onQuery, onGet, onSave, onDelete) {

	OBSOLETE('F.restful()', 'This method will be removed in v4.');

	var tmp;
	var index = flags ? flags.indexOf('cors') : -1;
	var cors = {};

	if (index !== -1)
		flags.splice(index, 1);

	if (onQuery) {
		tmp = [];
		flags && tmp.push.apply(tmp, flags);
		F.route(url, tmp, onQuery);
		cors['get'] = true;
	}

	var restful = U.path(url) + '{id}';

	if (onGet) {
		cors['get'] = true;
		tmp = [];
		flags && tmp.push.apply(tmp, flags);
		F.route(restful, tmp, onGet);
	}

	if (onSave) {
		cors['post'] = true;
		tmp = ['post'];
		flags && tmp.push.apply(tmp, flags);
		F.route(url, tmp, onSave);
		tmp = ['put'];
		cors['put'] = true;
		flags && tmp.push.apply(tmp, flags);
		F.route(restful, tmp, onSave);
	}

	if (onDelete) {
		cors['delete'] = true;
		tmp = ['delete'];
		flags && tmp.push.apply(tmp, flags);
		F.route(restful, tmp, onDelete);
	}

	if (index !== -1)
		F.cors(U.path(url) + '*', Object.keys(cors), flags.indexOf('authorize') === -1);

	return F;
};

// This version of RESTful doesn't create advanced routing for insert/update/delete and all URL address of all operations are without "{id}" param because they expect some identificator in request body
F.restful2 = function(url, flags, onQuery, onGet, onSave, onDelete) {

	OBSOLETE('F.restful2()', 'This method will be removed in v4.');

	var tmp;
	var index = flags ? flags.indexOf('cors') : -1;
	var cors = {};

	if (index !== -1)
		flags.splice(index, 1);

	if (onQuery) {
		tmp = [];
		cors['get'] = true;
		flags && tmp.push.apply(tmp, flags);
		F.route(url, tmp, onQuery);
	}

	if (onGet) {
		tmp = [];
		cors['get'] = true;
		flags && tmp.push.apply(tmp, flags);
		F.route(U.path(url) + '{id}', tmp, onGet);
	}

	if (onSave) {
		tmp = ['post'];
		cors['post'] = true;
		flags && tmp.push.apply(tmp, flags);
		F.route(url, tmp, onSave);
	}

	if (onDelete) {
		tmp = ['delete'];
		cors['delete'] = true;
		flags && tmp.push.apply(tmp, flags);
		F.route(url, tmp, onDelete);
	}

	if (index !== -1)
		F.cors(U.path(url) + '*', Object.keys(cors), flags.indexOf('authorize') === -1);

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
global.CORS = F.cors = function(url, flags, credentials) {

	if (!arguments.length) {
		F.routes.corsall = true;
		PERF.OPTIONS = true;
		return F;
	}

	if (flags === true) {
		credentials = true;
		flags = null;
	}

	var route = {};
	var origin = [];
	var methods = [];
	var headers = [];
	var age;
	var id;

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

			if (flag.substring(0, 2) === '//') {
				origin.push(flag.substring(2));
				continue;
			}

			if (flag.startsWith('http://') || flag.startsWith('https://')) {
				origin.push(flag.substring(flag.indexOf('/') + 2));
				continue;
			}

			if (flag.substring(0, 3) === 'id:') {
				id = flag.substring(3);
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
					headers.push(flags[i].toLowerCase());
					break;
			}
		}
	}

	if (!methods.length)
		methods = 'POST,PUT,GET,DELETE,PATCH,GET,HEAD'.split(',');

	if (!origin.length && CONF.default_cors)
		origin = CONF.default_cors;

	route.isWILDCARD = url.lastIndexOf('*') !== -1;

	var index = url.indexOf('{');
	if (index !== -1) {
		route.isWILDCARD = true;
		url = url.substring(0, index);
	}

	if (route.isWILDCARD)
		url = url.replace('*', '');

	if (url[url.length - 1] !== '/')
		url += '/';

	url = framework_internal.preparePath(framework_internal.encodeUnicodeURL(url.trim()));
	route.hash = url.hash();
	route.owner = _owner;
	route.url = framework_internal.routeSplitCreate(url);
	route.origin = origin.length ? origin : null;
	route.methods = methods.length ? methods : null;
	route.headers = headers.length ? headers : null;
	route.credentials = credentials;
	route.age = age || CONF.default_cors_maxage;

	var e = F.routes.cors.findItem(function(item) {
		return item.hash === route.hash;
	});

	if (e) {

		// Extends existing
		if (route.origin && e.origin)
			corsextend(route.origin, e.origin);
		else if (e.origin && !route.origin)
			e.origin = null;

		if (route.methods && e.methods)
			corsextend(route.methods, e.methods);

		if (route.headers && e.headers)
			corsextend(route.headers, e.headers);

		if (route.credentials && !e.credentials)
			e.credentials = true;

		if (route.isWILDCARD && !e.isWILDCARD)
			e.isWILDCARD = true;

	} else {
		F.routes.cors.push(route);
		route.id = id;
	}

	F._length_cors = F.routes.cors.length;

	F.routes.cors.sort(function(a, b) {
		var al = a.url.length;
		var bl = b.url.length;
		return al > bl ? - 1 : al < bl ? 1 : a.isWILDCARD && b.isWILDCARD ? 1 : 0;
	});

	PERF.OPTIONS = true;
	return F;
};

function corsextend(a, b) {
	for (var i = 0; i < a.length; i++)
		b.indexOf(a[i]) === -1 && b.push(a[i]);
}

global.GROUP = F.group = function() {

	var fn = null;

	_flags = null;
	_prefix = null;

	for (var i = 0; i < arguments.length; i++) {
		var o = arguments[i];

		if (o instanceof Array) {
			_flags = o;
			continue;
		}

		switch (typeof(o)) {
			case 'string':
				if (o.indexOf('/') === -1) {
					// flags
					_flags = o.split(',').trim();
				} else {
					if (o.endsWith('/'))
						o = o.substring(0, o.length - 1);
					_prefix = o;
				}
				break;
			case 'function':
				fn = o;
				break;
		}
	}

	fn && fn.call(F);
	_prefix = undefined;
	_flags = undefined;
	return F;
};

global.ROUTE = F.web = F.route = function(url, funcExecute, flags, length, language) {

	var name;
	var tmp;
	var viewname;
	var sitemap;

	if (url instanceof Array) {
		url.forEach(url => F.route(url, funcExecute, flags, length));
		return F;
	}

	if (typeof(flags) === 'number') {
		length = flags;
		flags = null;
	}

	var type = typeof(funcExecute);

	if (funcExecute instanceof Array) {
		tmp = funcExecute;
		funcExecute = flags;
		flags = tmp;
	}

	var search = (typeof(url) === 'string' ? url.toLowerCase().replace(/\s{2,}/g, ' ') : '') + (flags ? (' ' + flags.where(n => typeof(n) === 'string' && n.substring(0, 2) !== '//' && n[2] !== ':').join(' ')).toLowerCase() : '');
	var method = '';
	var CUSTOM = typeof(url) === 'function' ? url : null;
	if (CUSTOM)
		url = '/';

	if (url) {

		url = url.replace(/\t/g, ' ').trim();

		var first = url.substring(0, 1);
		if (first === '+' || first === '-' || url.substring(0, 2) === '🔒') {
			// auth/unauth
			url = url.replace(/^(\+|-|🔒)+/g, '').trim();
			!flags && (flags = []);
			flags.push(first === '-' ? 'unauthorized' : 'authorized');
		}

		url = url.replace(/(^|\s?)\*([{}a-z0-9}]|\s).*?$/i, function(text) {
			!flags && (flags = []);
			flags.push(text.trim());
			return '';
		}).trim();

		var index = url.indexOf(' ');
		if (index !== -1) {
			method = url.substring(0, index).toLowerCase().trim();
			url = url.substring(index + 1).trim();
		}

		if (method.indexOf(',') !== -1) {
			!flags && (flags = []);
			method.split(',').forEach(m => flags.push(m.trim()));
			method = '';
		}
	}

	if (url[0] === '#') {
		url = url.substring(1);
		if (url !== '400' && url !== '401' && url !== '403' && url !== '404' && url !== '408' && url !== '409' && url !== '431' && url !== '500' && url !== '501') {

			var sitemapflags = funcExecute instanceof Array ? funcExecute : flags;
			if (!(sitemapflags instanceof Array))
				sitemapflags = EMPTYARRAY;

			var index = url.indexOf('/');
			if (index !== -1) {
				tmp = url.substring(index);
				url = url.substring(0, index);
			} else
				tmp = '';

			sitemap = F.sitemap(url, true, language);

			if (sitemap) {

				name = url;
				url = sitemap.url;

				if (sitemap.localizeUrl && language === undefined) {
					var sitemaproutes = {};
					F.temporary.internal.resources.forEach(function(language) {
						var item = F.sitemap(sitemap.id, true, language);
						if (item.url && item.url !== url)
							sitemaproutes[item.url] = { name: sitemap.id, language: language };
					});
					Object.keys(sitemaproutes).forEach(key => F.route('#' + sitemap.id, funcExecute, flags, length, sitemaproutes[key].language));
				}

				if (tmp)
					url += url[url.length - 1] === '/' ? tmp.substring(1) : tmp;
				else if (sitemap.wildcard)
					url += '*';
			} else
				throw new Error('Sitemap item "' + url + '" not found.');
		} else
			url = '#' + url;
	}

	if (!url)
		url = '/';

	if (url[0] !== '[' && url[0] !== '/')
		url = '/' + url;

	if (_prefix)
		url = _prefix + url;

	if (url.endsWith('/'))
		url = url.substring(0, url.length - 1);

	url = framework_internal.encodeUnicodeURL(url);

	var urlcache = url;

	if (!name)
		name = url;

	if (method) {
		!flags && (flags = []);
		flags.push(method);
		method = '';
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

	var isWILDCARD = url.indexOf('*') !== -1;
	if (isWILDCARD) {
		url = url.replace('*', '').replace('//', '/');
		priority = priority - 100;
	}

	var isRaw = false;
	var isNOXHR = false;
	var schema;
	var workflow;
	var isMOBILE = false;
	var isJSON = false;
	var isDELAY = false;
	var isROBOT = false;
	var isBINARY = false;
	var isCORS = false;
	var isROLE = false;
	var novalidate = false;
	var middleware = null;
	var timeout;
	var options;
	var corsflags = [];
	var membertype = 0;
	var isGENERATOR = false;
	var isDYNAMICSCHEMA = false;
	var description;
	var id = null;
	var groups = [];

	if (_flags) {
		!flags && (flags = []);
		_flags.forEach(flag => flags.indexOf(flag) === -1 && flags.push(flag));
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

			flags[i] = flags[i].replace(/\t/g, ' ');

			var first = flags[i][0];
			if (first === '&') {
				groups.push(flags[i].substring(1).trim());
				continue;
			}

			// ROUTE identificator
			if (flags[i].substring(0, 3) === 'id:') {
				id = flags[i].substring(3).trim();
				continue;
			}

			if (first === '#') {
				!middleware && (middleware = []);
				middleware.push(flags[i].substring(1).trim());
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

				schema = schema.replace(/\\/g, '/').split('/').trim();

				if (schema.length) {

					if (schema.length === 1) {
						schema[1] = schema[0];
						schema[0] = 'default';
					}

					// Is dynamic schema?
					if (schema[0][0] === '{') {
						isDYNAMICSCHEMA = true;
						schema[0] = schema[0].substring(1).trim();
						schema[1] = schema[1].substring(0, schema[1].length - 1).trim();
					}

					if (schema[1][0] === '{') {
						isDYNAMICSCHEMA = true;
						schema[1] = schema[1].substring(1, schema[1].length - 1).trim();
					}

					index = schema[1].indexOf('#');
					if (index !== -1) {
						schema[2] = schema[1].substring(index + 1).trim();
						schema[1] = schema[1].substring(0, index).trim();
						(schema[2] && schema[2][0] !== '*') && (schema[2] = '*' + schema[2]);
					}

				} // else it's an operation
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

				case 'novalidate':
					novalidate = true;
					break;

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
					PERF[flag.toUpperCase()] = true;
					PERF[flag] = true;
					break;
				default:
					if (flag[0] === '@')
						isROLE = true;
					tmp.push(flag);
					break;
			}

			if (flag === 'get')
				priority -= 2;

		}

		if (isROLE && !membertype) {
			tmp.push('authorize');
			priority += 2;
			membertype = 1;
			count++;
		}

		flags = tmp;
		priority += (count * 2);
	} else {
		flags = ['get'];
		method = 'get';
	}

	if (workflow && workflow[0] === '@') {
		var tmpa = workflow.replace(/,/g, ' ').split('@').trim();
		var rindex = null;
		for (var i = 0; i < tmpa.length; i++) {
			var a = tmpa[i].split(' ');
			if (a[1] && (/response|res/i).test(a[1]))
				rindex = i;
			tmpa[i] = a[0];
		}
		workflow = { id: tmpa.length > 1 ? tmpa : tmpa[0], index: rindex };
	}

	if (type === 'string') {
		viewname = funcExecute;
		funcExecute = (function(name, sitemap, language, workflow) {
			var themeName = U.parseTheme(name);
			if (themeName)
				name = prepare_viewname(name);
			return function(id) {
				if (language && !this.language)
					this.language = language;
				sitemap && this.sitemap(sitemap.id, language);
				if (name[0] === '~')
					this.themeName = '';
				else if (themeName)
					this.themeName = themeName;
				if (!this.route.workflow)
					return this.view(name);

				var self = this;
				if (this.route.workflow instanceof Object) {
					workflow.view = name;
					if (workflow.id instanceof Array)
						controller_json_workflow_multiple.call(self, id);
					else
						controller_json_workflow.call(self, id);
				} else {
					this.$exec(this.route.workflow, null, function(err, response) {
						if (err)
							self.content(err);
						else
							self.view(name, response);
					});
				}
			};
		})(viewname, sitemap, language, workflow);
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
				return function(id) {
					var self = this;

					if (language && !self.language)
						self.language = language;

					sitemap && self.sitemap(sitemap.id, language);

					if (name[0] === '~')
						self.themeName = '';

					if (!self.route.workflow)
						return self.view(name);

					if (self.route.workflow instanceof Object) {
						workflow.view = name;
						if (workflow.id instanceof Array)
							controller_json_workflow_multiple.call(self, id);
						else
							controller_json_workflow.call(self, id);
					} else {
						self.$exec(self.route.workflow, null, function(err, response) {
							if (err)
								self.content(err);
							else
								self.view(name, response);
						});
					}
				};
			})(viewname, sitemap, language);
		} else if (workflow)
			funcExecute = workflow.id instanceof Array ? controller_json_workflow_multiple : controller_json_workflow;
	}

	if (!isGENERATOR)
		isGENERATOR = (funcExecute.constructor.name === 'GeneratorFunction' || funcExecute.toString().indexOf('function*') === 0);

	var url2 = framework_internal.preparePath(url.trim());
	var urlraw = U.path(url2) + (isWILDCARD ? '*' : '');
	var hash = url2.hash();
	var routeURL = framework_internal.routeSplitCreate(url2);
	var arr = [];
	var params = [];
	var reg = null;
	var regIndex = null;
	var dynamicidindex = -1;

	if (url.indexOf('{') !== -1) {
		routeURL.forEach(function(o, i) {
			if (o.substring(0, 1) !== '{')
				return;

			arr.push(i);

			var sub = o.substring(1, o.length - 1);
			var name = o.substring(1, o.length - 1).trim();

			if (name === 'id')
				dynamicidindex = i;

			params.push(name);

			if (sub[0] !== '/')
				return;

			var index = sub.lastIndexOf('/');
			if (index === -1)
				return;

			if (!reg) {
				reg = {};
				regIndex = [];
			}

			params[params.length - 1] = 'regexp' + (regIndex.length + 1);
			reg[i] = new RegExp(sub.substring(1, index), sub.substring(index + 1));
			regIndex.push(i);
		});

		priority -= arr.length + 1;
	}

	if (url.indexOf('#') !== -1)
		priority -= 100;

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

	if (flags.indexOf('get') === -1 && flags.indexOf('options') === -1 && flags.indexOf('post') === -1 && flags.indexOf('delete') === -1 && flags.indexOf('put') === -1 && flags.indexOf('upload') === -1 && flags.indexOf('head') === -1 && flags.indexOf('trace') === -1 && flags.indexOf('patch') === -1 && flags.indexOf('propfind') === -1) {
		flags.push('get');
		method += (method ? ',' : '') + 'get';
	}

	if (CONF.allow_head && flags.indexOf('get') !== -1) {
		flags.append('head');
		method += (method ? ',' : '') + 'head';
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

	if (workflow && workflow.id) {
		workflow.meta = {};
		if (workflow.id instanceof Array) {
			for (var i = 0; i < workflow.id.length; i++)
				workflow.meta[workflow.id[i]] = i + 1;
		} else
			workflow.meta[workflow.id] = 1;
	}

	if (subdomain)
		F._length_subdomain_web++;

	var instance = new FrameworkRoute();
	var r = instance.route;
	r.hash = hash;
	r.search = search.split(' ');
	r.id = id;
	r.name = name.trim();
	r.groups = flags_to_object(groups);
	r.priority = priority;
	r.sitemap = sitemap ? sitemap.id : '';
	r.schema = schema;
	r.novalidate = novalidate;
	r.workflow = workflow;
	r.subdomain = subdomain;
	r.description = description;
	r.controller = _controller ? _controller : 'unknown';
	r.owner = _owner;
	r.urlraw = urlraw;
	r.url = routeURL;
	r.param = arr;
	r.paramidindex = isDYNAMICSCHEMA ? dynamicidindex : -1;
	r.paramnames = params.length ? params : null;
	r.flags = flags || EMPTYARRAY;
	r.flags2 = flags_to_object(flags);
	r.method = method;
	r.execute = funcExecute;
	r.length = (length || CONF.default_request_maxlength) * 1024;
	r.middleware = middleware;
	r.timeout = timeout === undefined ? (isDELAY ? 0 : CONF.default_request_timeout) : timeout;
	r.isGET = flags.indexOf('get') !== -1;
	r.isMULTIPLE = isMULTIPLE;
	r.isJSON = isJSON;
	r.isXML = flags.indexOf('xml') !== -1;
	r.isRAW = isRaw;
	r.isBINARY = isBINARY;
	r.isMOBILE = isMOBILE;
	r.isROBOT = isROBOT;
	r.isMOBILE_VARY = isMOBILE;
	r.isGENERATOR = isGENERATOR;
	r.MEMBER = membertype;
	r.isWILDCARD = isWILDCARD;
	r.isROLE = isROLE;
	r.isREFERER = flags.indexOf('referer') !== -1;
	r.isHTTPS = flags.indexOf('https') !== -1;
	r.isHTTP = flags.indexOf('http') !== -1;
	r.isDEBUG = flags.indexOf('debug') !== -1;
	r.isRELEASE = flags.indexOf('release') !== -1;
	r.isBOTH = isNOXHR ? false : true;
	r.isXHR = flags.indexOf('xhr') !== -1;
	r.isUPLOAD = flags.indexOf('upload') !== -1;
	r.isSYSTEM = url.startsWith('/#');
	r.isCACHE = !url.startsWith('/#') && !CUSTOM && !arr.length && !isWILDCARD;
	r.isPARAM = arr.length > 0;
	r.isDELAY = isDELAY;
	r.isDYNAMICSCHEMA = isDYNAMICSCHEMA;
	r.CUSTOM = CUSTOM;
	r.options = options;
	r.regexp = reg;
	r.regexpIndexer = regIndex;
	r.type = 'web';
	r.remove = remove_route_web;

	if (r.isUPLOAD)
		PERF.upload = true;
	if (r.isJSON)
		PERF.json = true;
	if (r.isXML)
		PERF.xml = true;
	if (r.isBINARY)
		PERF.binary = true;
	if (r.MEMBER === 1)
		PERF.auth = true;
	if (r.MEMBER === 2)
		PERF.unauth = true;

	var arr = method ? method.split(',') : EMPTYARRAY;
	for (var i = 0; i < arr.length; i++) {
		PERF[arr[i]] = true;
		PERF[arr[i].toLowerCase()] = true;
	}

	if (r.isSYSTEM)
		F.routes.system[url.substring(1)] = r;
	else {
		F.routes.web.push(r);

		// Appends cors route
		isCORS && F.cors(urlcache, corsflags);
		!_controller && F.$routesSort(1);
	}

	if (isMOBILE)
		F._request_check_mobile = true;

	EMIT('route', 'web', instance);
	return instance;
};

function flags_to_object(flags) {
	var obj = {};
	flags.forEach(flag => obj[flag] = true);
	return obj;
}

function remove_route_web() {

	if (this.isSYSTEM) {
		var keys = Object.keys(F.routes.system);
		for (var i = 0; i < keys.length; i++) {
			if (F.routes.system[keys[i]] === this) {
				delete F.routes.system[keys];
				F.temporary.other = {};
				return;
			}
		}
	}

	var index = F.routes.web.indexOf(this);
	if (index !== -1) {
		F.routes.web.splice(index, 1);
		F.$routesSort();
		F.temporary.other = {};
	}
}

/**
 * Get routing by name
 * @param {String} name
 * @return {Object}
 */
global.ROUTING = F.routing = function(name, flags) {

	var id = name.substring(0, 3) === 'id:' ? name.substring(3) : null;
	if (id)
		name = null;

	var search = id ? null : (name.toLowerCase().replace(/\s{2,}/g, ' ') + (flags ? (' ' + flags.where(n => typeof(n) === 'string' && n.substring(0, 2) !== '//' && n[2] !== ':').join(' ')).toLowerCase() : '')).split(' ');

	for (var i = 0, length = F.routes.web.length; i < length; i++) {
		var route = F.routes.web[i];
		var is = true;
		if (id && route.id !== id)
			is = false;
		else if (search) {
			for (var j = 0; j < search.length; j++) {
				if (route.search.indexOf(search[j]) === -1) {
					is = false;
					break;
				}
			}
		}

		if (!is)
			continue;

		var url = U.path(route.url.join('/'));
		if (url[0] !== '/')
			url = '/' + url;

		return route;
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
global.MERGE = F.merge = function(url) {

	F.temporary.other['merge_' + url] = 1;

	if (url[0] === '#')
		url = sitemapurl(url.substring(1));

	url = F.$version(framework_internal.preparePath(url));

	if (url === 'auto') {
		// auto-generating
		var arg = arguments;
		setTimeout(function(arg) {
			F.merge.apply(F, arg);
		}, 500, arg);
		return F;
	}

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

	if (url[0] !== '/')
		url = '/' + url;

	var key = createTemporaryKey(url);
	var filename = F.path.temp((F.id ? 'i-' + F.id + '_' : '') + 'merged_' + key);
	F.routes.merge[url] = { filename: filename.replace(/\.(js|css)$/g, ext => '.min' + ext), files: arr };
	Fs.unlink(F.routes.merge[url].filename, NOOP);
	F.owners.push({ type: 'merge', owner: _owner, id: url });
	delete F.temporary.notfound[key];
	return F;
};

F.mapping = function() {
	return F.map.apply(F, arguments);
};

/**
 * Send message
 * @param  {Object} message
 * @param  {Object} handle
 * @return {Framework}
 */
F.send = function(message, handle) {
	process.send(message, handle);
	return F;
};

/**
 * Mapping of static file
 * @param {String} url
 * @param {String} filename	Filename or Directory.
 * @param {Function(filename) or String Array} filter
 * @return {Framework}
 */
global.MAP = F.map = function(url, filename, filter) {

	if (url[0] === '#')
		url = sitemapurl(url.substring(1));

	if (url[0] !== '/')
		url = '/' + url;

	var isPackage = false;

	filename = U.$normalize(filename);
	url = framework_internal.preparePath(F.$version(url));

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
			filename = U.combine(CONF.directory_themes, filename.substring(1));
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
						if (filter.indexOf(U.getExtension(file)) === -1)
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

	return F;
};

/**
 * Add a middleware
 * @param {String} name
 * @param {Function(req, res, next, options)} funcExecute
 * @return {Framework}
 */
global.MIDDLEWARE = F.middleware = function(name, funcExecute) {
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
F.use = function(name, url, types, first) {

	if (typeof(name) === 'function') {
		var tmp = 'mid' + GUID(5);
		MIDDLEWARE(tmp, name);
		name = tmp;
	}

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
			!route.middleware && (route.middleware = []);
			merge_middleware(route.middleware, name, first);
		}
	}

	if (!types || types.indexOf('file') !== -1 || types.indexOf('files') !== -1) {
		for (var i = 0, length = F.routes.files.length; i < length; i++) {
			route = F.routes.files[i];
			if (url && !route.url.join('/').startsWith(url))
				continue;
			!route.middleware && (route.middleware = []);
			merge_middleware(route.middleware, name, first);
		}
	}

	if (!types || types.indexOf('websocket') !== -1 || types.indexOf('websockets') !== -1) {
		for (var i = 0, length = F.routes.websockets.length; i < length; i++) {
			route = F.routes.websockets[i];
			if (url && !route.url.join('/').startsWith(url))
				continue;
			!route.middleware && (route.middleware = []);
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
global.WEBSOCKET = F.websocket = function(url, funcInitialize, flags, length) {

	var tmp;

	var CUSTOM = typeof(url) === 'function' ? url : null;
	if (CUSTOM)
		url = '/';

	if (url[0] === '#') {

		var index = url.indexOf('/');
		if (index !== -1) {
			tmp = url.substring(index);
			url = url.substring(0, index);
		}

		url = url.substring(1);
		var sitemap = F.sitemap(url, true);
		if (sitemap) {
			url = sitemap.url;
			if (tmp)
				url += url[url.length - 1] === '/' ? tmp.substring(1) : tmp;
			else if (sitemap.wildcard)
				url += '*';
		} else
			throw new Error('Sitemap item "' + url + '" not found.');
	}

	var first = url.substring(0, 1);
	if (first === '+' || first === '-' || url.substring(0, 2) === '🔒') {
		// auth/unauth
		url = url.replace(/^(\+|-|🔒)+/g, '').trim();
		!flags && (flags = []);
		flags.push(first === '-' ? 'unauthorized' : 'authorized');
	}

	var index = url.substring(0, 7).indexOf(' ');
	if (index !== -1)
		url = url.substring(index + 1).trim();

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
	var id;
	var groups = [];

	priority = url.count('/');

	if (index > 0) {
		subdomain = url.substring(1, index).trim().toLowerCase().split(',');
		url = url.substring(index + 1);
		priority += subdomain.indexOf('*') !== -1 ? 50 : 100;
	}

	var isWILDCARD = url.indexOf('*') !== -1;
	if (isWILDCARD) {
		url = url.replace('*', '').replace('//', '/');
		priority = (-10) - priority;
	}

	var url2 = framework_internal.preparePath(url.trim());
	var routeURL = framework_internal.routeSplitCreate(url2);
	var arr = [];
	var reg = null;
	var regIndex = null;
	var hash = url2.hash();
	var urlraw = U.path(url2) + (isWILDCARD ? '*' : '');
	var params = [];

	if (url.indexOf('{') !== -1) {
		routeURL.forEach(function(o, i) {

			if (o.substring(0, 1) !== '{')
				return;

			arr.push(i);

			var sub = o.substring(1, o.length - 1);
			var name = o.substring(1, o.length - 1).trim();

			params.push(name);

			if (sub[0] !== '/')
				return;

			var index = sub.lastIndexOf('/');
			if (index === -1)
				return;

			if (!reg) {
				reg = {};
				regIndex = [];
			}

			params[params.length - 1] = 'regexp' + (regIndex.length + 1);
			reg[i] = new RegExp(sub.substring(1, index), sub.substring(index + 1));
			regIndex.push(i);
		});
	}

	if (typeof(allow) === 'string')
		allow = allow[allow];

	if (typeof(protocols) === 'string')
		protocols = protocols[protocols];

	tmp = [];

	var isJSON = false;
	var isBINARY = false;
	var isROLE = false;
	var isBUFFER = false;
	var count = 0;
	var membertype = 0;

	!flags && (flags = []);
	_flags && _flags.forEach(flag => flags.indexOf(flag) === -1 && flags.push(flag));

	for (var i = 0; i < flags.length; i++) {

		var flag = flags[i];
		var type = typeof(flag);

		// Middleware options
		if (type === 'object') {
			options = flag;
			continue;
		}

		// Length
		if (type === 'number') {
			length = flag;
			continue;
		}

		if (flag.substring(0, 3) === 'id:') {
			id = flag.substring(3).trim();
			continue;
		}

		// Groups
		if (flag[0] === '&') {
			groups.push(flag.substring(1).trim());
			continue;
		}

		// Middleware
		if (flag[0] === '#') {
			!middleware && (middleware = []);
			middleware.push(flag.substring(1).trim());
			continue;
		}

		flag = flag.toString().toLowerCase();

		// Origin
		if (flag.startsWith('http://') || flag.startsWith('https://')) {
			!allow && (allow = []);
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

		if (flag === 'buffer')
			isBUFFER = true;

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
				!protocols && (protocols = []);
				protocols.push(flag);
				break;
		}
	}

	if (isROLE && !membertype) {
		tmp.push('authorize');
		membertype = 1;
		priority++;
		count++;
	}

	flags = tmp;

	flags.indexOf('get') === -1 && flags.unshift('get');
	priority += (count * 2);

	if (subdomain)
		F._length_subdomain_websocket++;

	var instance = new FrameworkRoute();
	var r = instance.route;
	r.id = id;
	r.urlraw = urlraw;
	r.hash = hash;
	r.groups = flags_to_object(groups);
	r.controller = _controller ? _controller : 'unknown';
	r.owner = _owner;
	r.url = routeURL;
	r.paramnames = params.length ? params : null;
	r.param = arr;
	r.subdomain = subdomain;
	r.priority = priority;
	r.flags = flags || EMPTYARRAY;
	r.flags2 = flags_to_object(flags);
	r.onInitialize = funcInitialize;
	r.protocols = protocols || EMPTYARRAY;
	r.allow = allow || [];
	r.length = (length || CONF.default_websocket_maxlength) * 1024;
	r.isWEBSOCKET = true;
	r.MEMBER = membertype;
	r.isJSON = isJSON;
	r.isBUFFER = isBUFFER;
	r.isBINARY = isBINARY;
	r.isROLE = isROLE;
	r.isWILDCARD = isWILDCARD;
	r.isHTTPS = flags.indexOf('https');
	r.isHTTP = flags.indexOf('http');
	r.isDEBUG = flags.indexOf('debug');
	r.isRELEASE = flags.indexOf('release');
	r.CUSTOM = CUSTOM;
	r.middleware = middleware ? middleware : null;
	r.options = options;
	r.isPARAM = arr.length > 0;
	r.regexp = reg;
	r.regexpIndexer = regIndex;
	r.type = 'websocket';
	F.routes.websockets.push(r);
	F.initwebsocket && F.initwebsocket();
	EMIT('route', 'websocket', r);
	!_controller && F.$routesSort(2);
	return instance;
};

F.initwebsocket = function() {
	if (F.routes.websockets.length && CONF.allow_websocket && F.server) {
		F.server.on('upgrade', F.$upgrade);
		F.initwebsocket = null;
	}
};

/**
 * Create a file route
 * @param {String} name
 * @param {Function} funcValidation
 * @param {Function} fnExecute
 * @param {String Array} middleware
 * @return {Framework}
 */
global.FILE = F.file = function(fnValidation, fnExecute, flags) {

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
	var id = null;
	var urlraw = fnValidation;
	var groups = [];

	if (_flags) {
		!flags && (flags = []);
		_flags.forEach(flag => flags.indexOf(flag) === -1 && flags.push(flag));
	}

	if (flags) {
		for (var i = 0, length = flags.length; i < length; i++) {
			var flag = flags[i];
			if (typeof(flag) === 'object')
				options = flag;
			else if (flag[0] === '&')
				groups.push(flag.substring(1).trim());
			else if (flag[0] === '#') {
				!middleware && (middleware = []);
				middleware.push(flag.substring(1).trim());
			} else if (flag[0] === '.') {
				flag = flag.substring(1).toLowerCase().trim();
				!extensions && (extensions = {});
				extensions[flag] = true;
			} else if (flag.substring(0, 3) === 'id:')
				id = flag.substring(3).trim();
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

	var instance = new FrameworkRoute();
	var r = instance.route;
	r.id = id;
	r.urlraw = urlraw;
	r.groups = flags_to_object(groups);
	r.controller = _controller ? _controller : 'unknown';
	r.owner = _owner;
	r.url = url;
	r.fixedfile = fixedfile;
	r.wildcard = wildcard;
	r.extensions = extensions;
	r.onValidate = fnValidation;
	r.execute = fnExecute;
	r.middleware = middleware;
	r.options = options;
	r.type = 'file';

	F.routes.files.push(r);
	F.routes.files.sort((a, b) => !a.url ? -1 : !b.url ? 1 : a.url.length > b.url.length ? -1 : 1);
	EMIT('route', 'file', r);
	F._length_files = F.routes.files.length;
	return F;
};

global.FILE404 = function(fn) {
	F.routes.filesfallback = fn;
};

function sitemapurl(url) {

	var index = url.indexOf('/');
	var tmp;

	if (index !== -1) {
		tmp = url.substring(index);
		url = url.substring(0, index);
	}

	var sitemap = F.sitemap(url, true, '');
	if (sitemap) {
		url = sitemap.url;
		if (tmp) {
			if (url[url.length - 1] === '/')
				url += tmp.substring(1);
			else
				url += tmp;
		}
	}

	return url;
}

global.LOCALIZE = F.localize = function(url, flags, minify) {

	if (typeof(url) === 'function') {
		F.onLocale = url;
		return;
	}

	if (url[0] === '#')
		url = sitemapurl(url.substring(1));

	url = url.replace('*.*', '');

	if (minify == null)
		minify = true;

	if (flags === true) {
		flags = [];
		minify = true;
	} else if (!flags)
		flags = [];

	var index;
	var ext = false;

	flags = flags.remove(function(item) {
		item = item.toLowerCase();
		if (item === 'nocompress')
			minify = false;
		if (item[0] === '.')
			ext = true;
		return item === 'compress' || item === 'nocompress' || item === 'minify';
	});

	var index = url.lastIndexOf('.');

	if (!ext) {
		if (index === -1)
			flags.push('.html', '.htm', '.md', '.txt');
		else {
			flags.push(url.substring(index).toLowerCase());
			url = url.substring(0, index).replace('*', '');
		}
	}

	url = framework_internal.preparePath(url.replace('.*', ''));

	if (minify)
		F.file(url, F.$filelocalize, flags);
	else
		F.file(url, filelocalize_nominify, flags);
};

function filelocalize_nominify(req, res) {
	F.$filelocalize(req, res, true);
}

F.$filelocalize = function(req, res, nominify) {

	// options.filename
	// options.code
	// options.callback
	// options.headers
	// options.download

	F.onLocale && (req.$language = F.onLocale(req, res, req.isStaticFile));

	var key = 'locate_' + (req.$language ? req.$language : 'default') + '_' + (req.$key || req.url);
	var output = F.temporary.other[key];

	if (output) {
		if (!F.$notModified(req, res, output.$mtime)) {
			HEADERS.responseLocalize['Last-Modified'] = output.$mtime;
			res.options.body = output;
			res.options.type = U.getContentType(req.extension);
			res.$text();
		}
		return;
	}

	var filename = (res.options ? res.options.filename : null) || F.onMapping(req.uri.pathname, req.uri.pathname, true, true);

	Fs.readFile(filename, function(err, content) {

		if (err) {
			if (!F.routes.filesfallback || !F.routes.filesfallback(req, res))
				res.throw404();
			return;
		}

		content = framework_internal.markup(F.translator(req.$language, framework_internal.modificators(content.toString(ENCODING), filename, 'static')), filename);

		Fs.lstat(filename, function(err, stats) {

			var mtime = stats.mtime.toUTCString();

			if (CONF.allow_compile_html && CONF.allow_compile && !nominify && (req.extension === 'html' || req.extension === 'htm'))
				content = framework_internal.compile_html(content, filename, true);

			if (RELEASE) {
				F.temporary.other[key] = Buffer.from(content);
				F.temporary.other[key].$mtime = mtime;
				if (F.$notModified(req, res, mtime))
					return;
			}

			HEADERS.responseLocalize['Last-Modified'] = mtime;
			res.options.body = content;
			res.options.type = U.getContentType(req.extension);
			res.options.headers = HEADERS.responseLocalize;
			res.$text();
		});
	});
};

F.$notModified = function(req, res, date) {
	if (date === req.headers['if-modified-since']) {
		HEADERS.responseNotModified['Last-Modified'] = date;
		res.success = true;
		res.writeHead(304, HEADERS.responseNotModified);
		res.end();
		F.stats.response.notModified++;
		F.reqstats(false, req.isStaticFile);
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
F.error = function(err, name, uri) {

	if (!arguments.length)
		return F.errorcallback;

	if (!err)
		return F;

	if (F.errors) {
		F.stats.error++;
		NOW = new Date();
		F.errors.push({ error: err.stack ? err.stack : err, name: name, url: uri ? typeof(uri) === 'string' ? uri : Parser.format(uri) : undefined, date: NOW });
		F.errors.length > 50 && F.errors.shift();
	}

	F.onError(err, name, uri);
	return F;
};

F.errorcallback = function(err) {
	err && F.error(err);
};

/**
 * Registers a new problem
 * @param {String} message
 * @param {String} name A controller name.
 * @param {String} uri
 * @param {String} ip
 * @return {Framework}
 */
F.problem = F.wtf = function(message, name, uri, ip) {

	// OBSOLETE('F.problem()', 'This method will be removed in v4');

	F.$events.problem && EMIT('problem', message, name, uri, ip);

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

global.PRINTLN = function(msg) {
	console.log('------>', '[' + new Date().format('yyyy-MM-dd HH:mm:ss') + ']', msg);
};

/**
 * Registers a new change
 * @param {String} message
 * @param {String} name A source name.
 * @param {String} uri
 * @param {String} ip
 * @return {Framework}
 */
F.change = function(message, name, uri, ip) {

	OBSOLETE('F.change()', 'This method will be removed in v4.');

	F.$events.change && EMIT('change', message, name, uri, ip);

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
global.TRACE = F.trace = function(message, name, uri, ip) {

	OBSOLETE('TRACE()', 'This method will be removed in v4.');

	if (!CONF.trace)
		return F;

	F.$events.trace && EMIT('trace', message, name, uri, ip);

	if (message instanceof framework_builders.ErrorBuilder)
		message = message.plain();
	else if (typeof(message) === 'object')
		message = JSON.stringify(message);

	NOW = new Date();
	var obj = { message: message, name: name, url: uri ? typeof(uri) === 'string' ? uri : Parser.format(uri) : undefined, ip: ip, date: NOW };
	F.logger('traces', obj.message, 'url: ' + obj.url, 'source: ' + obj.name, 'ip: ' + obj.ip);

	CONF.trace_console && console.log(NOW.format('yyyy-MM-dd HH:mm:ss'), '[trace]', message, '|', 'url: ' + obj.url, 'source: ' + obj.name, 'ip: ' + obj.ip);

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
global.MODULE = F.module = function(name) {
	return F.modules[name] || null;
};

/**
 * Add a new modificator
 * @param {Function(type, filename, content)} fn The `fn` must return modified value.
 * @return {Framework}
 */
global.MODIFY = F.modify = function(filename, fn) {

	if (typeof(filename) === 'function') {
		fn = filename;
		filename = null;
	}

	if (filename) {
		if (!F.modificators2)
			F.modificators2 = {};
		if (F.modificators2[filename])
			F.modificators2[filename].push(fn);
		else
			F.modificators2[filename] = [fn];
	} else {
		if (!F.modificators)
			F.modificators = [];
		F.modificators.push(fn);
	}

	fn.$owner = _owner;
	return F;
};

F.$bundle = function(callback) {

	var bundledir = F.path.root(CONF.directory_bundles);

	var makebundle = function() {

		var arr = Fs.readdirSync(bundledir);
		var url = [];

		for (var i = 0; i < arr.length; i++) {
			if (arr[i].endsWith('.url'))
				url.push(arr[i]);
		}

		url.wait(function(item, next) {

			var filename = F.path.root(CONF.directory_bundles) + item.replace('.url', '.bundle');
			var link = Fs.readFileSync(F.path.root(CONF.directory_bundles) + item).toString('utf8');

			F.consoledebug('Download bundle: ' + link);

			U.download(link, FLAGS_INSTALL, function(err, response) {

				if (err) {
					F.error(err, 'Bundle: ' + link);
					next();
					return;
				}

				var stream = Fs.createWriteStream(filename);

				response.pipe(stream);
				response.on('error', function(err) {
					F.error(err, 'Bundle: ' + link);
					next();
				});

				CLEANUP(stream, next);
			});

		}, function() {
			require('./bundles').make(function() {
				F.directory = HEADERS.workers.cwd = directory = F.path.root(CONF.directory_src);
				callback();
			});
		});
	};

	try {
		Fs.statSync(bundledir);
		if (F.$bundling) {
			makebundle();
			return;
		} else
			F.directory = HEADERS.workers.cwd = directory = F.path.root(CONF.directory_src);
	} catch(e) {}
	callback();
};

F.$load = function(types, targetdirectory, callback, packageName) {

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

			var ext = U.getExtension(o);
			if (ext)
				ext = '.' + ext;
			if (ext !== extension || o[0] === '.' || o.endsWith('-bk' + extension) || o.endsWith('_bk' + extension))
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

	var dependencies = [];
	var operations = [];
	var isPackage = targetdirectory.indexOf('.package') !== -1;
	var isNo = true;

	if (types) {
		for (var i = 0; i < types.length; i++) {
			if (types[i].substring(0, 2) !== 'no') {
				isNo = false;
				break;
			}
		}
	}

	var can = function(type) {
		if (!types)
			return true;
		if (types.indexOf('no' + type) !== -1)
			return false;
		return isNo ? true : types.indexOf(type) !== -1;
	};

	if (can('modules')) {
		operations.push(function(resume) {
			dir = U.combine(targetdirectory, isPackage ? '/modules/' : CONF.directory_modules);
			arr = [];
			listing(dir, 0, arr, '.js');
			arr.forEach((item) => dependencies.push(next => F.install('module', item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName)));
			resume();
		});
	}

	if (can('isomorphic')) {
		operations.push(function(resume) {
			dir = U.combine(targetdirectory, isPackage ? '/isomorphic/' : CONF.directory_isomorphic);
			arr = [];
			listing(dir, 0, arr, '.js');
			arr.forEach((item) => dependencies.push(next => F.install('isomorphic', item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName)));
			resume();
		});
	}

	if (can('packages')) {
		operations.push(function(resume) {
			dir = U.combine(targetdirectory, isPackage ? '/packages/' : CONF.directory_packages);
			arr = [];
			listing(dir, 0, arr, '.package');
			var dirtmp = U.$normalize(dir);

			arr.wait(function(item, next2) {

				if (!item.is) {
					dependencies.push(next => F.install('package', item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName));
					return next2();
				}

				U.ls(item.filename, function(files, directories) {
					var dir = F.path.temp(item.name) + '.package';
					!existsSync(dir) && Fs.mkdirSync(dir);

					for (var i = 0, length = directories.length; i < length; i++) {
						var target = F.path.temp(U.$normalize(directories[i]).replace(dirtmp, '') + '/');
						!existsSync(target) && Fs.mkdirSync(target);
					}

					files.wait(function(filename, next) {

						if (F.$bundling) {
							var stream = Fs.createReadStream(filename);
							var writer = Fs.createWriteStream(Path.join(dir, filename.replace(item.filename, '').replace(/\.package$/i, '')));
							stream.pipe(writer);
							writer.on('finish', next);
						} else
							next();

					}, function() {

						// Windows sometimes doesn't load package and this delay solves the problem.
						setTimeout(function() {
							dependencies.push(next => F.install('package2', item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName));
							next2();
						}, 50);

					});
				});
			}, resume);
		});
	}

	if (can('models')) {
		operations.push(function(resume) {
			dir = U.combine(targetdirectory, isPackage ? '/models/' : CONF.directory_models);
			arr = [];
			listing(dir, 0, arr);
			arr.forEach((item) => dependencies.push(next => F.install('model', item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName)));
			resume();
		});
	}

	if (can('schemas')) {
		operations.push(function(resume) {
			dir = U.combine(targetdirectory, isPackage ? '/schemas/' : CONF.directory_schemas);
			arr = [];
			listing(dir, 0, arr);
			arr.forEach((item) => dependencies.push(next => F.install('schema', item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName)));
			resume();
		});
	}

	if (can('tasks')) {
		operations.push(function(resume) {
			dir = U.combine(targetdirectory, isPackage ? '/tasks/' : CONF.directory_tasks);
			arr = [];
			listing(dir, 0, arr);
			arr.forEach((item) => dependencies.push(next => F.install('task', item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName)));
			resume();
		});
	}

	if (can('operations')) {
		operations.push(function(resume) {
			dir = U.combine(targetdirectory, isPackage ? '/operations/' : CONF.directory_operations);
			arr = [];
			listing(dir, 0, arr);
			arr.forEach((item) => dependencies.push(next => F.install('operation', item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName)));
			resume();
		});
	}

	if (can('themes')) {
		operations.push(function(resume) {
			arr = [];
			dir = U.combine(targetdirectory, isPackage ? '/themes/' : CONF.directory_themes);
			listing(dir, 0, arr, undefined, true);
			arr.forEach(function(item) {
				var themeName = item.name;
				var themeDirectory = Path.join(dir, themeName);
				var filename = Path.join(themeDirectory, 'index.js');
				F.themes[item.name] = U.path(themeDirectory);
				F._length_themes++;
				existsSync(filename) && dependencies.push(next => F.install('theme', item.name, filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName));
			});
			resume();
		});
	}

	if (can('definitions')) {
		operations.push(function(resume) {
			dir = U.combine(targetdirectory, isPackage ? '/definitions/' : CONF.directory_definitions);
			arr = [];
			listing(dir, 0, arr);
			arr.forEach((item) => dependencies.push(next => F.install('definition', item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName)));
			resume();
		});
	}

	if (can('controllers')) {
		operations.push(function(resume) {
			arr = [];
			dir = U.combine(targetdirectory, isPackage ? '/controllers/' : CONF.directory_controllers);
			listing(dir, 0, arr);
			arr.forEach((item) => dependencies.push(next => F.install('controller', item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName)));
			resume();
		});
	}

	if (can('components')) {
		operations.push(function(resume) {
			arr = [];
			dir = U.combine(targetdirectory, isPackage ? '/components/' : CONF.directory_components);
			listing(dir, 0, arr, '.html');
			arr.forEach((item) => dependencies.push(next => F.install('component', item.name, item.filename, undefined, undefined, undefined, undefined, undefined, undefined, next, packageName)));
			resume();
		});
	}

	var thread = global.THREAD;
	if (thread) {

		// Updates PREF file
		PREFFILE = PREFFILE.replace('.json', '_' + thread + '.json');

		operations.push(function(resume) {
			arr = [];
			dir = '/threads/' + thread;
			F.$configure_env(dir + '/.env');
			F.$configure_env(dir + '/.env-' + (DEBUG ? 'debug' : 'release'));
			F.$configure_configs(dir + '/config');
			F.$configure_configs(dir + '/config-' + (DEBUG ? 'debug' : 'release'));
			dir = U.combine(targetdirectory, '/threads/' + thread);
			listing(dir, 0, arr);
			arr.forEach(item => dependencies.push(next => F.install('module', 'threads/' + item.name, item.filename, undefined, undefined, undefined, true, undefined, undefined, next, packageName)));
			resume();
		});
	}

	if (can('preferences')) {
		operations.push(function(resume) {
			if (F.onPrefLoad)
				loadpreferences(resume);
			else
				resume();
		});
	}

	operations.async(function() {
		var count = dependencies.length;
		F.consoledebug('load dependencies ' + count + 'x');
		dependencies.async(function() {
			types && types.indexOf('service') === -1 && F.cache.stop();
			F.$routesSort();
			(!types || types.indexOf('dependencies') !== -1) && F.$configure_dependencies();
			F.consoledebug('load dependencies {0}x (done)'.format(count));
			callback && callback();
		});
	});

	return F;
};

function loadpreferences(callback) {
	F.onPrefLoad(function(value) {
		if (value) {
			var keys = Object.keys(value);
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i];
				F.pref[key] = global.PREF[key] = value[key];
			}
		}
		callback && callback();
	});
}

F.$startup = function(callback) {

	var dir = Path.join(directory, '/startup/');

	if (!existsSync(dir))
		return callback();

	var run = [];

	Fs.readdirSync(dir).forEach(function(o) {
		var extension = U.getExtension(o);
		if (JSFILES[extension])
			run.push(o);
	});

	if (!run.length)
		return callback();

	run.wait(function(filename, next) {
		var fn = dir + filename + '_bk';
		Fs.renameSync(dir + filename, fn);
		var fork = Child.fork(fn, [], { cwd: directory });
		fork.on('exit', function() {
			fork = null;
			next();
		});
	}, callback);

	return F;
};

global.UPTODATE = F.uptodate = function(type, url, options, interval, callback, next) {

	if (typeof(options) === 'string' && typeof(interval) !== 'string') {
		interval = options;
		options = null;
	}

	OBSOLETE('UPTODATE()', 'This method is deprecated and it will be removed in v4.');

	var obj = { type: type, name: '', url: url, interval: interval, options: options, count: 0, updated: NOW, errors: [], callback: callback };

	if (!F.uptodates)
		F.uptodates = [];

	F.uptodates.push(obj);
	F.install(type, url, options, function(err, name) {
		err && obj.errors.push(err);
		obj.name = name;
		obj.callback && obj.callback(err, name);
	}, undefined, undefined, undefined, undefined, next);
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
 * @param {Function} next Internal, optional.
 * @param {String} packageName Internal, optional.
 * @return {Framework}
 */
global.INSTALL = F.install = function(type, name, declaration, options, callback, internal, useRequired, skipEmit, uptodateName, next, packageName) {

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
	var err;

	NOW = new Date();

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

	if (type === 'command') {
		if (typeof(declaration) === 'function') {
			if (F.commands[name])
				F.commands[name].push(declaration);
			else
				F.commands[name] = [declaration];
		}
		return F;
	}

	// Check if declaration is a valid URL address
	if (type !== 'eval' && typeof(declaration) === 'string') {

		if (declaration.startsWith('http://') || declaration.startsWith('https://')) {
			if (type === 'package') {
				F.consoledebug('download', type, declaration);
				U.download(declaration, FLAGS_INSTALL, function(err, response) {

					if (err) {
						F.error(err, 'F.install(\'{0}\', \'{1}\')'.format(type, declaration), null);
						next && next();
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
							next && next();
							callback && callback(null, uptodateName || name, true);
							return;
						}

						F.temporary.versions[declaration] = hash;
						F.install(type, id, filename, options, callback, undefined, undefined, true, uptodateName, next);
					});
				});
				return F;
			}

			F.consoledebug('download', type, declaration);
			U.request(declaration, FLAGS_INSTALL, function(err, data, code) {

				if (code !== 200 && !err)
					err = new Error(data);

				if (err) {
					F.error(err, 'F.install(\'{0}\', \'{1}\')'.format(type, declaration), null);
					next && next();
					callback && callback(err);
				} else {

					var hash = data.hash('md5');

					if (F.temporary.versions[declaration] === hash) {
						next && next();
						callback && callback(null, uptodateName || name, true);
						return;
					}

					F.temporary.versions[declaration] = hash;
					F.install(type, name, data, options, callback, declaration, undefined, undefined, uptodateName, next);
				}

			});
			return F;
		} else {
			if (declaration[0] === '~')
				declaration = declaration.substring(1);
			if (type !== 'config' && type !== 'resource' && type !== 'package' && type !== 'component' && !REG_SCRIPTCONTENT.test(declaration)) {
				var relative = F.path.root(declaration);
				if (existsSync(relative))
					declaration = relative;
				if (!existsSync(declaration))
					throw new Error('The ' + type + ': ' + declaration + ' doesn\'t exist.');
				useRequired = true;
			}
		}
	}

	if (type === 'middleware') {

		F.routes.middleware[name] = typeof(declaration) === 'function' ? declaration : eval(declaration);
		F._length_middleware = Object.keys(F.routes.middleware).length;

		if (REG_NEWIMPL.test(F.routes.middleware[name].toString()))
			F.routes.middleware[name].$newversion = true;
		else
			OBSOLETE('MIDDLEWARE("{0}")'.format(name), 'You used older declaration of this delegate and you must rewrite it. Read more in docs.');

		next && next();
		callback && callback(null, name);

		key = type + '.' + name;

		if (F.dependencies[key]) {
			F.dependencies[key].updated = NOW;
		} else {
			F.dependencies[key] = { name: name, type: type, installed: NOW, updated: null, count: 0 };
			if (internal)
				F.dependencies[key].url = internal;
		}

		F.dependencies[key].count++;

		setTimeout(function() {
			EMIT(type + '#' + name);
			EMIT('install', type, name);
			F.temporary.ready[type + '#' + name] = NOW;
		}, 500);

		F.consoledebug('install', type + '#' + name);
		return F;
	}

	if (type === 'config' || type === 'configuration' || type === 'settings') {
		F.$configure_configs(declaration instanceof Array ? declaration : declaration.toString().split('\n'), true);
		setTimeout(function() {
			delete F.temporary.mail_settings;
			EMIT(type + '#' + name, CONF);
			EMIT('install', type, name);
			F.temporary.ready[type + '#' + name] = NOW;
		}, 500);

		F.consoledebug('install', type + '#' + name);
		next && next();
		callback && callback(null, name);
		return F;
	}

	if (type === 'version' || type === 'versions') {

		F.$configure_versions(declaration.toString().split('\n'));
		setTimeout(function() {
			EMIT(type + '#' + name);
			EMIT('install', type, name);
			F.temporary.ready[type + '#' + name] = NOW;
		}, 500);

		F.consoledebug('install', type + '#' + name);
		next && next();
		callback && callback(null, name);
		return F;
	}

	if (type === 'workflow' || type === 'workflows') {

		F.$configure_workflows(declaration.toString().split('\n'));
		setTimeout(function() {
			EMIT(type + '#' + name);
			EMIT('install', type, name);
			F.temporary.ready[type + '#' + name] = NOW;
			F.consoledebug('install', type + '#' + name);
		}, 500);

		next && next();
		callback && callback(null, name);
		return F;
	}

	if (type === 'sitemap') {

		F.$configure_sitemap(declaration.toString().split('\n'));
		setTimeout(function() {
			EMIT(type + '#' + name);
			EMIT('install', type, name);
			F.temporary.ready[type + '#' + name] = NOW;
			F.consoledebug('install', type + '#' + name);
		}, 500);

		next && next();
		callback && callback(null, name);
		return F;
	}

	if (type === 'component') {

		if (!name && internal)
			name = U.getName(internal).replace(/\.html/gi, '').trim();

		F.uninstall(type, uptodateName || name, uptodateName ? 'uptodate' : undefined);

		var hash = '\n/*' + name.crc32(true) + '*/\n';
		var temporary = (F.id ? 'i-' + F.id + '_' : '') + 'components';

		content = parseComponent(internal ? declaration : Fs.readFileSync(declaration).toString(ENCODING), name);

		if (F.$bundling) {
			content.js && Fs.appendFileSync(F.path.temp(temporary + '.js'), hash + (DEBUG ? component_debug(name, content.js, 'js') : content.js) + hash.substring(0, hash.length - 1));
			content.css && Fs.appendFileSync(F.path.temp(temporary + '.css'), hash + (DEBUG ? component_debug(name, content.css, 'css') : content.css) + hash.substring(0, hash.length - 1));
		}

		if (!Object.keys(content.parts).length)
			content.parts = null;

		if (content.js)
			F.components.js = true;

		if (content.css)
			F.components.css = true;

		if (content.files)
			F.components.files[name] = content.files;
		else
			delete F.components.files[name];

		if (content.body) {
			F.components.views[name] = '.' + F.path.temp('component_' + name);
			F.$bundling && Fs.writeFile(F.components.views[name].substring(1) + '.html', U.minifyHTML(content.body), NOOP);
		} else
			delete F.components.views[name];

		F.components.has = true;

		var link = CONF.static_url_components;
		F.components.version = NOW.getTime();
		F.components.links = (F.components.js ? '<script src="{0}js?version={1}"></script>'.format(link, F.components.version) : '') + (F.components.css ? '<link type="text/css" rel="stylesheet" href="{0}css?version={1}" />'.format(link, F.components.version) : '');

		if (content.install) {
			try {
				var filecomponent = F.path.temp('component-' + name + '.js');
				_owner = (packageName ? packageName + '@' : '') + type + '#' + name;
				Fs.writeFileSync(filecomponent, content.install.trim());
				obj = require(filecomponent);
				(function(name) {
					setTimeout(function() {
						delete require.cache[name];
					}, 1000);
				})(require.resolve(filecomponent));
				obj.$owner = _owner;
				F.temporary.owners[_owner] = true;
				_controller = '';
				obj.name = name;
				obj.parts = content.parts;
				F.components.instances[name] = obj;
				obj && typeof(obj.install) === 'function' && obj.install(options || CONF[_owner], name);
			} catch(e) {
				F.error(e, 'F.install(\'component\', \'{0}\')'.format(name));
			}
		} else if (!internal) {
			var js = declaration.replace(/\.html$/i, '.js');
			if (existsSync(js)) {
				_owner = (packageName ? packageName + '@' : '') + type + '#' + name;
				F.temporary.owners[_owner] = true;
				obj = require(js);
				obj.name = name;
				obj.parts = content.parts;
				obj.$owner = _owner;
				_controller = '';
				F.components.instances[name] = obj;
				typeof(obj.install) === 'function' && obj.install(options || CONF[_owner], name);
				(function(name) {
					setTimeout(function() {
						delete require.cache[name];
					}, 1000);
				})(require.resolve(declaration));
			}
		}

		if (obj) {

			if (!obj.group)
				obj.group = 'default';

			key = obj.group.crc32(true);
			temporary += '_g' + key;
			tmp = F.components.groups[obj.group];
			if (!tmp)
				tmp = F.components.groups[obj.group] = {};

			if (content.js) {
				Fs.appendFileSync(F.path.temp(temporary + '.js'), hash + (DEBUG ? component_debug(name, content.js, 'js') : content.js) + hash.substring(0, hash.length - 1));
				tmp.js = true;
			}

			if (content.css) {
				Fs.appendFileSync(F.path.temp(temporary + '.css'), hash + (DEBUG ? component_debug(name, content.css, 'css') : content.css) + hash.substring(0, hash.length - 1));
				tmp.css = true;
			}

			tmp.version = GUID(5);
			tmp.links = (tmp.js ? '<script src="{0}js?group={2}_{1}"></script>'.format(link, tmp.version, key) : '') + (tmp.css ? '<link type="text/css" rel="stylesheet" href="{0}css?group={2}_{1}" />'.format(link, tmp.version, key) : '');
		}

		!skipEmit && setTimeout(function() {
			EMIT(type + '#' + name);
			EMIT('install', type, name);
			F.temporary.ready[type + '#' + name] = NOW;
		}, 500);

		F.consoledebug('install', type + '#' + name);
		next && next();
		callback && callback(null, name);
		return F;
	}

	if (type === 'package') {

		var id = Path.basename(declaration, '.' + U.getExtension(declaration));
		var dir = CONF.directory_temp[0] === '~' ? Path.join(CONF.directory_temp.substring(1), id + '.package') : Path.join(F.path.root(), CONF.directory_temp, id + '.package');

		F.routes.packages[id] = dir;

		var restorecb = function() {
			var filename = Path.join(dir, 'index.js');
			if (!existsSync(filename)) {
				next && next();
				callback && callback(null, name);
				return;
			}

			F.install('module', id, filename, options || CONF['package#' + name], function(err) {
				setTimeout(function() {
					EMIT('module#' + name);
					EMIT(type + '#' + name);
					EMIT('install', 'module', name);
					EMIT('install', type, name);
					F.temporary.ready['package#' + name] = NOW;
					F.temporary.ready['module#' + name] = NOW;
				}, 500);
				F.consoledebug('install', 'package#' + name);
				callback && callback(err, name);
			}, internal, useRequired, true, undefined);
			next && next();
		};

		if (F.$bundling)
			F.restore(declaration, dir, restorecb);
		else
			restorecb();

		return F;
	}

	if (type === 'theme') {

		_owner = (packageName ? packageName + '@' : '') + type + '#' + name;
		obj = require(declaration);
		obj.$owner = _owner;
		F.temporary.owners[_owner] = true;

		typeof(obj.install) === 'function' && obj.install(options || CONF[_owner], name);

		!skipEmit && setTimeout(function() {
			EMIT(type + '#' + name);
			EMIT('install', type, name);
			F.temporary.ready[type + '#' + name] = NOW;
		}, 500);

		F.consoledebug('install', type + '#' + name);
		next && next();
		callback && callback(null, name);

		(function(name) {
			setTimeout(function() {
				delete require.cache[name];
			}, 1000);
		})(require.resolve(declaration));
		return F;
	}

	if (type === 'package2') {
		type = type.substring(0, type.length - 1);
		var id = U.getName(declaration, '.package');
		var dir = CONF.directory_temp[0] === '~' ? Path.join(CONF.directory_temp.substring(1), id) : Path.join(F.path.root(), CONF.directory_temp, id);
		var filename = Path.join(dir, 'index.js');
		F.install('module', id.replace(/\.package$/i, ''), filename, options || CONF['package#' + name], function(err) {
			setTimeout(function() {
				EMIT('module#' + name);
				EMIT(type + '#' + name);
				EMIT('install', type, name);
				EMIT('install', 'module', name);
				F.temporary.ready['package#' + name] = NOW;
				F.temporary.ready['module#' + name] = NOW;
			}, 500);
			F.consoledebug('install', 'package#' + name);
			callback && callback(err, name);
		}, internal, useRequired, true);
		next && next();
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
			EMIT(type + '#' + name);
			EMIT('install', type, name);
			F.temporary.ready[type + '#' + name] = NOW;
		}, 500);

		F.consoledebug('install', type + '#' + name);
		next && next();
		callback && callback(null, name);
		return F;
	}

	if (type === 'definition' || type === 'eval' || type === 'schema' || type === 'operation' || type === 'task') {

		_controller = '';
		_owner = (packageName ? packageName + '@' : '') + type + '#' + name;
		F.temporary.owners[_owner] = true;
		err = null;

		try {

			if (useRequired) {
				var relative = F.path.root(declaration);
				if (existsSync(relative))
					declaration = relative;
				delete require.cache[require.resolve(declaration)];
				obj = require(declaration);

				(function(name) {
					setTimeout(() => delete require.cache[name], 1000);
				})(require.resolve(declaration));
			} else
				obj = typeof(declaration) === 'function' ? eval('(' + declaration.toString() + ')()') : eval(declaration);

		} catch (ex) {
			err = ex;
		}

		if (err) {
			F.error(err, 'F.install(\'' + type + '\')', null);
			next && next();
			callback && callback(err, name);
			return F;
		}

		F.consoledebug('install', type + '#' + (name || '::undefined::'));
		next && next();
		callback && callback(null, name);

		setTimeout(function() {
			EMIT(type + '#' + name);
			EMIT('install', type, name);
			F.temporary.ready[type + '#' + name] = NOW;
		}, 500);

		return F;
	}

	if (type === 'isomorphic') {

		content = '';
		err = null;

		OBSOLETE('isomorphic', 'Isomorphic scripts will be removed in v4.');

		try {

			if (!name && typeof(internal) === 'string') {
				var tmp = internal.match(/[a-z0-9]+\.js$/i);
				if (tmp)
					name = tmp.toString().replace(/\.js/i, '');
			}

			if (useRequired) {
				var relative = F.path.root(declaration);
				if (existsSync(relative))
					declaration = relative;
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
			err = ex;
		}

		if (err) {
			F.error(err, 'F.install(\'' + type + '\')', null);
			next && next();
			callback && callback(err, name);
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

		F.$bundling && Fs.writeFileSync(tmp, prepare_isomorphic(name, framework_internal.compile_javascript(content, '#' + name)));

		F.consoledebug('install', type + '#' + name);
		next && next();
		callback && callback(null, name);

		setTimeout(function() {
			EMIT(type + '#' + name, obj);
			EMIT('install', type, name, obj);
			F.temporary.ready[type + '#' + name] = NOW;
		}, 500);

		return F;
	}

	if (type === 'model' || type === 'source') {

		_controller = '';
		_owner = (packageName ? packageName + '@' : '') + type + '#' + name;
		F.temporary.owners[_owner] = true;
		err = null;

		try {

			if (useRequired) {
				var relative = F.path.root(declaration);
				if (existsSync(relative))
					declaration = relative;
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
			err = ex;
		}

		if (err) {
			F.error(err, 'F.install(\'' + type + '\', \'' + name + '\')', null);
			next && next();
			callback && callback(err, name);
			return F;
		}

		if (typeof(obj.id) === 'string')
			name = obj.id;
		else if (typeof(obj.name) === 'string')
			name = obj.name;

		_owner = (packageName ? packageName + '@' : '') + type + '#' + name;
		obj.$owner = _owner;

		if (!name)
			name = (Math.random() * 10000) >> 0;

		key = type + '.' + name;
		tmp = F.dependencies[key];

		F.uninstall(type, uptodateName || name, uptodateName ? 'uptodate' : undefined);
		F.temporary.owners[_owner] = true;

		if (tmp) {
			F.dependencies[key] = tmp;
			F.dependencies[key].updated = NOW;
		}
		else {
			F.dependencies[key] = { name: name, type: type, installed: NOW, updated: null, count: 0 };
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

		typeof(obj.install) === 'function' && obj.install(options || CONF[type + '#' + name], name);

		!skipEmit && setTimeout(function() {
			EMIT(type + '#' + name, obj);
			EMIT('install', type, name, obj);
			F.temporary.ready[type + '#' + name] = NOW;
		}, 500);

		F.consoledebug('install', type + '#' + name);
		next && next();
		callback && callback(null, name);
		return F;
	}

	if (type === 'module' || type === 'controller') {

		// for inline routes
		var _ID = _controller = 'TMP' + U.random(10000);
		_owner = (packageName ? packageName + '@' : '') + type + '#' + name;
		err = null;

		try {
			if (useRequired) {
				var relative = F.path.root(declaration);
				if (existsSync(relative))
					declaration = relative;
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
			err = ex;
		}

		if (err) {
			F.error(err, 'F.install(\'' + type + '\', \'' + (name ? '' : internal) + '\')', null);
			next && next();
			callback && callback(err, name);
			return F;
		}

		if (typeof(obj.id) === 'string')
			name = obj.id;
		else if (typeof(obj.name) === 'string')
			name = obj.name;

		if (!name)
			name = (Math.random() * 10000) >> 0;

		_owner = (packageName ? packageName + '@' : '') + type + '#' + name;
		obj.$owner = _owner;

		obj.booting && setTimeout(function() {

			var tmpdir = F.path.temp(name + (U.getExtension(name) === 'package' ? '' : '.package/'));

			if (obj.booting === 'root') {
				F.directory = directory = tmpdir;
				F.temporary.path = {};
				F.temporary.notfound = {};
				F.$configure_env();
				F.$configure_configs();
				F.$configure_versions();
				F.$configure_dependencies();
				F.$configure_sitemap();
				F.$configure_workflows();
			} else {
				F.$configure_env('@' + name + '/.env');
				F.$configure_env('@' + name + '/.env-' + (DEBUG ? 'debug' : 'release'));
				F.$configure_configs('@' + name + '/config');
				F.$configure_configs('@' + name + '/config-' + (DEBUG ? 'debug' : 'release'));
				F.isTest && F.$configure_configs('@' + name + '/config-test');
				F.$configure_versions('@' + name + '/versions');
				F.$configure_dependencies('@' + name + '/dependencies');
				F.$configure_sitemap('@' + name + '/sitemap');
				F.$configure_workflows('@' + name + '/workflows');
			}

			F.$bundle(() => F.$load(undefined, tmpdir, undefined, name));
		}, 100);

		key = type + '.' + name;
		tmp = F.dependencies[key];

		F.uninstall(type, uptodateName || name, uptodateName ? 'uptodate' : undefined, undefined, packageName);
		F.temporary.owners[_owner] = true;

		if (tmp) {
			F.dependencies[key] = tmp;
			F.dependencies[key].updated = NOW;
		}
		else {
			F.dependencies[key] = { name: name, type: type, installed: NOW, updated: null, count: 0, _id: _ID };
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
					next && next();
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
		next && next();
	}

	return F;
};

F.install_prepare = function(noRecursive) {

	var keys = Object.keys(F.temporary.dependencies);
	if (!keys.length)
		return;

	OBSOLETE('exports.dependencies()', 'Module dependencies will be removed in v4: "' + keys.join(', ') + '"');

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
			throw new Error('Dependency exception, missing dependencies for: ' + keys.join(', ').trim());
		delete F.temporary.other.dependencies;
	}, CONF.default_dependency_timeout);

	if (!keys.length || noRecursive)
		return F;

	F.install_prepare(true);
	return F;
};

F.install_make = function(key, name, obj, options, callback, skipEmit, type) {

	var me = F.dependencies[key];
	var routeID = me._id;
	var type = me.type;

	F.temporary.internal[me._id] = name;
	_controller = routeID;
	_owner = type + '#' + name.replace(/\.package$/gi, '');

	typeof(obj.install) === 'function' && obj.install(options || CONF[_owner], name);
	me.processed = true;

	var id = (type === 'module' ? '#' : '') + name;
	var length = F.routes.web.length;

	for (var i = 0; i < length; i++) {
		if (F.routes.web[i].controller === routeID)
			F.routes.web[i].controller = id;
	}

	var tmp = Object.keys(F.routes.system);
	length = tmp.length;
	for (var i = 0; i < length; i++) {
		if (F.routes.system[tmp[i]].controller === routeID)
			F.routes.system[tmp[i]].controller = id;
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
	name = name.replace(/\.package$/gi, '');

	if (!skipEmit) {
		setTimeout(function() {
			EMIT(type + '#' + name, obj);
			EMIT('install', type, name, obj);
			F.temporary.ready[type + '#' + name] = NOW;
		}, 500);
	}

	F.consoledebug('install', type + '#' + name);
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
global.UNINSTALL = F.uninstall = function(type, name, options, skipEmit, packageName) {

	var obj = null;
	var k, v, tmp;

	if (type === 'route' || type === 'web') {
		k = typeof(name) === 'string' ? name.substring(0, 3) === 'id:' ? 'id' : 'urlraw' : 'execute';
		v = k === 'execute' ? name : k === 'id' ? name.substring(3).trim() : name;
		if (k === 'urlraw' && v[0] === '#')
			delete F.routes.system[v];
		else
			F.routes.web = F.routes.web.remove(k, v);
		F.$routesSort();
		F.consoledebug('uninstall', type + '#' + name);
		F.temporary.other = {};
		return F;
	}

	if (type === 'cors') {
		k = typeof(name) === 'string' ? name.substring(0, 3) === 'id:' ? 'id' : 'hash' : 'hash';
		v = k === 'id' ? name.substring(3).trim() : name;
		if (k !== 'id')
			v = framework_internal.preparePath(framework_internal.encodeUnicodeURL(v.replace('*', '').trim()));
		F.routes.cors = F.routes.cors.remove(k, v);
		F._length_cors = F.routes.cors.length;
		F.consoledebug('uninstall', type + '#' + name);
		return F;
	}

	if (type === 'operation') {
		NEWOPERATION(name, null);
		F.consoledebug('uninstall', type + '#' + name);
		return F;
	}

	if (type === 'convertor') {
		F.convertor(name, null);
		F.consoledebug('uninstall', type + '#' + name);
		return F;
	}

	if (type === 'schedule') {
		F.clearSchedule(name);
		F.consoledebug('uninstall', type + '#' + name);
		return F;
	}

	var id = (packageName ? packageName + '@' : '') +  type + '#' + name;

	if (type === 'websocket') {
		k = typeof(name) === 'string' ? name.substring(0, 3) === 'id:' ? 'id' : 'urlraw' : 'onInitialize';
		v = k === 'onInitialize' ? name : k === 'id' ? name.substring(3).trim() : name;
		F.routes.websockets = F.routes.websockets.remove(k, v);
		F.$routesSort();
		F.consoledebug('uninstall', type + '#' + name);
		return F;
	}

	if (type === 'file') {
		k = typeof(name) === 'string' ? name.substring(0, 3) === 'id:' ? 'id' : 'urlraw' : 'execute';
		v = k === 'execute' ? name : k === 'id' ? name.substring(3).trim() : name;
		F.routes.files = F.routes.files.remove(k, v);
		F._length_files = F.routes.files.length;
		F.consoledebug('uninstall', type + '#' + name);
		return F;
	}

	if (type === 'schema') {
		tmp = name.split('/');
		tmp.length === 2 ? framework_builders.remove(tmp[0], tmp[1]) : framework_builders.remove(undefined, tmp[0]);
		F.consoledebug('uninstall', type + '#' + name);
	} else if (type === 'mapping') {
		delete F.routes.mapping[name];
		F.consoledebug('uninstall', type + '#' + name);
	} else if (type === 'isomorphic') {
		var obj = F.isomorphic[name];
		if (obj.url)
			delete F.routes.mapping[F.$version(obj.url)];
		delete F.isomorphic[name];
		delete F.temporary.ready[type + '#' + name];
		F.consoledebug('uninstall', type + '#' + name);
	} else if (type === 'middleware') {

		if (!F.routes.middleware[name])
			return F;

		delete F.routes.middleware[name];
		delete F.dependencies[type + '.' + name];
		delete F.temporary.ready[type + '#' + name];
		F._length_middleware = Object.keys(F.routes.middleware).length;

		for (var i = 0, length = F.routes.web.length; i < length; i++) {
			tmp = F.routes.web[i];
			if (tmp.middleware && tmp.middleware.length)
				tmp.middleware = tmp.middleware.remove(name);
		}

		for (var i = 0, length = F.routes.websockets.length; i < length; i++) {
			tmp = F.routes.websockets[i];
			if (tmp.middleware && tmp.middleware.length)
				tmp.middleware = tmp.middleware.remove(name);
		}

		for (var i = 0, length = F.routes.files.length; i < length; i++) {
			tmp = F.routes.files[i];
			if (tmp.middleware && tmp.middleware.length)
				tmp.middleware = tmp.middleware.remove(name);
		}

		F.consoledebug('uninstall', type + '#' + name);

	} else if (type === 'package') {
		delete F.routes.packages[name];
		delete F.temporary.ready['package#' + name];
		F.uninstall('module', name, options, true);
		F.consoledebug('uninstall', type + '#' + name);
		return F;
	} else if (type === 'view' || type === 'precompile') {

		obj = F.routes.views[name];

		if (!obj)
			return F;

		delete F.routes.views[name];
		delete F.dependencies[type + '.' + name];
		delete F.temporary.ready[type + '#' + name];

		fsFileExists(obj.filename, function(e) {
			e && Fs.unlink(obj.filename, NOOP);
			F.consoledebug('uninstall', type + '#' + name);
		});

	} else if (type === 'model' || type === 'source') {

		obj = type === 'model' ? F.models[name] : F.sources[name];

		if (!obj)
			return F;

		F.$uninstall(id);
		typeof(obj.uninstall) === 'function' && obj.uninstall(options, name);

		if (type === 'model')
			delete F.models[name];
		else
			delete F.sources[name];

		delete F.dependencies[type + '.' + name];
		delete F.temporary.ready[type + '#' + name];
		F.consoledebug('uninstall', type + '#' + name);

	} else if (type === 'module' || type === 'controller') {

		var isModule = type === 'module';
		obj = isModule ? F.modules[name] : F.controllers[name];

		if (!obj)
			return F;

		F.$uninstall(id, packageName ? '' : ((isModule ? '#' : '') + name));
		delete F.temporary.ready[type + '#' + name];
		F.consoledebug('uninstall', type + '#' + name);

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
		delete F.components.files[name];
		delete F.temporary.ready[type + '#' + name];

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
				data = data.substring(0, index) + data.substring(data.indexOf(end, index + end.length) + end.length);
				Fs.writeFileSync(F.path.temp(temporary + '.css'), data);
				is = true;
			}
		}

		if (obj.group) {
			temporary += '_g' + obj.group.hash();
			tmp = F.components.groups[obj.group];
			if (tmp) {

				if (tmp.js) {
					data = Fs.readFileSync(F.path.temp(temporary + '.js')).toString('utf-8');
					index = data.indexOf(beg);
					if (index !== -1) {
						data = data.substring(0, index) + data.substring(data.indexOf(end, index + end.length) + end.length);
						Fs.writeFileSync(F.path.temp(temporary + '.js'), data);
						is = true;
					}
				}

				if (tmp.css) {
					data = Fs.readFileSync(F.path.temp(temporary + '.css')).toString('utf-8');
					index = data.indexOf(beg);
					if (index !== -1) {
						data = data.substring(0, index) + data.substring(data.indexOf(end, index + end.length) + end.length);
						Fs.writeFileSync(F.path.temp(temporary + '.css'), data);
						is = true;
					}
				}

				tmp.version = NOW.getTime();
			}
		}

		if (is)
			F.components.version = NOW.getTime();

		F.consoledebug('uninstall', type + '#' + name);
	}

	!skipEmit && EMIT('uninstall', type, name);
	return F;
};

F.$uninstall = function(owner, controller) {

	if (!F.temporary.owners[owner])
		return F;

	if (controller) {
		F.routes.web = F.routes.web.remove('controller', controller);
		F.routes.files = F.routes.files.remove('controller', controller);
		F.routes.websockets = F.routes.websockets.remove('controller', controller);
	}

	F.routes.web = F.routes.web.remove('owner', owner);
	F.routes.files = F.routes.files.remove('owner', owner);
	F.routes.websockets = F.routes.websockets.remove('owner', owner);
	F.routes.cors = F.routes.cors.remove('owner', owner);

	var keys = Object.keys(F.schedules);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		if (F.schedules[key].owner == owner)
			delete F.schedules[key];
	}

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
	delete F.temporary.owners[owner];

	return F;
};

/**
 * Register internal mapping (e.g. Resource)
 * @param {String} path
 * @return {Framework}
 */
F.register = function(path) {

	var key;
	var extension = '.' + U.getExtension(path);
	var name = U.getName(path);
	var c = path[0];

	if (c === '@')
		path = F.path.package(path.substring(1));
	else if (c === '=') {
		if (path[1] === '?')
			F.path.themes(CONF.default_theme + path.substring(2));
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
F.eval = function(script) {
	return F.install('eval', script);
};

/**
 * Error handler
 * @param {Error} err
 * @param {String} name
 * @param {Object} uri URI address, optional.
 * @return {Framework}
 */
F.onError = function(err, name, uri) {
	NOW = new Date();
	console.log('======= ' + (NOW.format('yyyy-MM-dd HH:mm:ss')) + ': ' + (name ? name + ' ---> ' : '') + err.toString() + (uri ? ' (' + Parser.format(uri) + ')' : ''), err.stack);
	return F;
};

/*
	Authorization handler
	@req {Request}
	@res {Response} OR {WebSocketClient}
	@flags {String array}
	@callback {Function} - @callback(Boolean), true is [authorize]d and false is [unauthorize]d
*/
F.onAuthorize = null;

/*
	Sets the current language for the current request
	@req {Request}
	@res {Response} OR {WebSocketClient}
	@return {String}
*/
F.onLocale = null;
// OLD: F.onLocate = null;

/**
 * Sets theme to controller
 * @controller {Controller}
 * @return {String}
 */
F.onTheme = null;

/*
	Versioning static files (this delegate call LESS CSS by the background property)
	@name {String} :: name of static file (style.css or script.js)
	return {String} :: return new name of static file (style-new.css or script-new.js)
*/
F.onVersion = null;

/**
 * On mapping static files
 * @param {String} url
 * @param {String} def Default value.
 * @return {String}
 */
F.onMapping = function(url, def, ispublic, encode) {

	if (url[0] !== '/')
		url = '/' + url;

	var tmp = url;
	if (CONF.default_root)
		tmp = tmp.substring(CONF.default_root.length - 1);

	// component files
	if (tmp[1] === '~') {
		var index = tmp.indexOf('/', 2);
		var name = tmp.substring(2, index);
		return F.components.files[name] && F.components.files[name][tmp.substring(index + 1)] ? (F.path.temp() + tmp.substring(1)) : null;
	}

	if (F.routes.mapping[url])
		return F.routes.mapping[url];

	if (F._length_themes) {
		var index = tmp.indexOf('/', 2);
		if (index !== -1) {
			var themeName = tmp.substring(1, index);
			if (F.themes[themeName])
				return F.themes[themeName] + 'public' + tmp.substring(index);
		}
	}

	def = framework_internal.preparePath(def, true);

	if (encode)
		def = $decodeURIComponent(def);

	if (ispublic)
		def = F.path.public_cache(def);
	else
		def = def[0] === '~' ? def.substring(1) : def[0] === '.' ? def : F.path.public_cache(def);

	return def;
};

global.DOWNLOAD = F.download = F.snapshot = function(url, filename, callback) {

	if (!F.isLoaded && url[0] === '/') {
		setTimeout(F.download, 200, url, filename, callback);
		return F;
	}

	url = framework_internal.preparePath(url);

	if (!REG_HTTPHTTPS.test(url)) {
		if (url[0] !== '/')
			url = '/' + url;
		if (F.isWorker)
			throw new Error('Worker can\'t create a snapshot from the relative URL address "{0}".'.format(url));
		url = 'http://' + (F.ip === 'auto' ? '0.0.0.0' : F.ip) + ':' + F.port + url;
	}

	U.download(url, FLAGS_DOWNLOAD, function(err, response) {

		if (err) {
			callback && callback(err);
			callback = null;
			return;
		}

		var stream = Fs.createWriteStream(filename);

		var done = function(err) {
			if (callback) {
				callback(err);
				callback = null;
			}
		};

		response.pipe(stream);
		response.on('error', done);
		stream.on('error', done);
		CLEANUP(stream, done);
	});

	return F;
};

/**
 * Find WebSocket connection
 * @param {String/RegExp} path
 * @return {WebSocket}
 */
F.findConnection = function(path) {
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
F.findConnections = function(path) {
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
F.onValidate = null;

/**
 * Global XML parsing
 * @param {String} value
 * @return {Object}
 */
F.onParseXML = function(value, replace) {
	var val = U.parseXML(value, replace);
	F._length_convertors && F.convert(val);
	return val;
};
F.onParseXML.$def = true;

F.$onParseXML = function(req) {
	if (F.onParseXML.$def) {
		req.body = U.parseXML(req.buffer_data);
		F._length_convertors && F.convert(req.body);
	} else
		req.body = F.onParseXML(req.buffer_data);
};

/**
 * Global JSON parsing
 * @param {String} value
 * @return {Object}
 */
F.onParseJSON = function(value) {
	if (value) {
		try {
			return JSON.parse(value);
		} catch (e) {}
	}
};
F.onParseJSON.$def = true;

F.$onParseJSON = function(req) {
	req.body = F.onParseJSON.$def ? JSON.parse(req.buffer_data) : F.onParseJSON(req.buffer_data);
};

function parseQueryArgumentsDecode(val) {
	try {
		return decodeURIComponent(val);
	} catch (e) {
		return '';
	}
}

const QUERY_ALLOWED = { '45': 1, '95': 1, 46: 1, '91': 1, '92': 1 };

function parseQueryArguments(str) {

	var obj = {};
	var key = '';
	var val = '';
	var is = false;
	var decodev = false;
	var decodek = false;
	var count = 0;
	var pos = 0;

	str += '&';

	for (var i = 0; i < str.length; i++) {
		var n = str.charCodeAt(i);

		if (n === 38) {

			if (key) {
				if (pos < i)
					val += str.substring(pos, i);

				if (decodev)
					val = parseQueryArgumentsDecode(val);

				if (decodek)
					key = parseQueryArgumentsDecode(key);

				obj[key] = val;
			}

			if (key)
				key = '';

			if (val)
				val = '';

			pos = i + 1;
			is = false;
			decodek = false;
			decodev = false;

			if ((count++) >= QUERYPARSEROPTIONS.maxKeys)
				break;

		} else {

			if (n === 61) {
				if ((i - pos) > CONF.default_request_maxkey)
					key = '';
				else {
					if (pos < i)
						key += str.substring(pos, i);
					pos = i + 1;
					is = true;
				}
				continue;
			}

			if (!is) {

				var can = false;

				if (n > 47 && n < 58)
					can = true;
				else if ((n > 64 && n < 91) || (n > 96 && n < 123))
					can = true;
				else if (QUERY_ALLOWED[n])
					can = true;

				if (!can)
					break;
			}

			if (n === 43) {
				if (is)
					val += str.substring(pos, i) + ' ';
				else
					key += str.substring(pos, i) + ' ';
				pos = i + 1;
			}

			if (n === 37) {
				if (str.charCodeAt(i + 1) === 48 && str.charCodeAt(i + 2) === 48)
					pos = i + 3;
				else if (is) {
					if (!decodev)
						decodev = true;
				} else {
					if (!decodev)
						decodek = true;
				}
			}
		}
	}

	return obj;
}

/**
 * Global JSON parsing
 * @param {String} value
 * @return {Object}
 */
F.onParseQuery = function(value) {
	if (value) {
		// var val = Qs.parse(value, null, null, QUERYPARSEROPTIONS);
		var val = parseQueryArguments(value);
		F._length_convertors && F.convert(val);
		return val;
	}
	return {};
};
F.onParseQuery.$def = true;

F.$onParseQueryBody = function(req) {
	if (F.onParseQuery.$def) {
		if (req.buffer_data) {
			// req.body = Qs.parse(req.buffer_data, null, null, QUERYPARSEROPTIONS);
			req.body = parseQueryArguments(req.buffer_data);
			F._length_convertors && F.convert(req.body);
		} else
			req.body = {};
	} else
		req.body = F.onParseQuery(req.buffer_data, req);
};

F.$onParseQueryUrl = function(req) {
	if (F.onParseQuery.$def) {
		if (req.uri.query) {
			// req._querydata = Qs.parse(req.uri.query, null, null, QUERYPARSEROPTIONS);
			req._querydata = parseQueryArguments(req.uri.query);
			F._length_convertors && F.convert(req._querydata);
		} else
			req._querydata = {};
	} else
		req._querydata = F.onParseQuery(req.uri.query, req);
};

/**
 * Schema parser delegate
 * @param {Request} req
 * @param {String} group
 * @param {String} name
 * @param {Function(err, body)} callback
 */
F.onSchema = function(req, route, callback) {

	var schema;

	if (route.isDYNAMICSCHEMA) {
		var index = route.param[route.paramnames.indexOf(route.schema[1])];
		req.$schemaname = route.schema[0] + '/' + req.split[index];
		schema = framework_builders.findschema(req.$schemaname);
	} else
		schema = GETSCHEMA(route.schema[0], route.schema[1]);

	if (req.method === 'PATCH' || req.method === 'DELETE')
		req.$patch = true;

	if (schema)
		schema.make(req.body, route.schema[2], onSchema_callback, callback, route.novalidate, route.workflow ? route.workflow.meta : null, req);
	else
		callback('Schema "' + (route.isDYNAMICSCHEMA ? req.$schemaname : (route.schema[0] + '/' + route.schema[1])) + '" not found.');
};

function onSchema_callback(err, res, callback) {
	if (err)
		callback(err);
	else
		callback(null, res);
}

var onmailsendforce = (cb, message) => message.send2(cb);

/**
 * Mail delegate
 * @param {String or Array String} address
 * @param {String} subject
 * @param {String} body
 * @param {Function(err)} callback
 * @param {String} replyTo
 * @return {MailMessage}
 */
F.onMail = function(address, subject, body, callback, replyTo) {

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

	message.from(CONF.mail_address_from || '', CONF.name);

	if (replyTo)
		message.reply(replyTo);
	else {
		tmp = CONF.mail_address_reply;
		tmp && tmp.length > 3 && message.reply(tmp);
	}

	tmp = CONF.mail_address_copy;
	tmp && tmp.length > 3 && message.bcc(tmp);

	message.$sending = setImmediate(onmailsendforce, callback, message);
	return message;
};

F.onMeta = function() {

	var builder = '';
	var length = arguments.length;
	var self = this;

	for (var i = 0; i < length; i++) {

		var arg = U.encode(arguments[i]);
		if (arg == null || !arg.length)
			continue;

		switch (i) {
			case 0:
				builder += '<title>' + (arg + (F.url !== '/' && !CONF.allow_custom_titles ? ' - ' + CONF.name : '')) + '</title>';
				break;
			case 1:
				builder += '<meta name="description" content="' + arg + '" />';
				break;
			case 2:
				builder += '<meta name="keywords" content="' + arg + '" />';
				break;
			case 3:
				var tmp = arg.substring(0, 6);
				var img = tmp === 'http:/' || tmp === 'https:' || arg.substring(0, 2) === '//' ? arg : self.hostname(self.public_image(arg));
				builder += '<meta property="og:image" content="' + img + '" /><meta name="twitter:image" content="' + img + '" />';
				break;
		}
	}

	return builder;
};

global.AUDIT = function(name, $, type, message) {

	if (message == null) {
		message = type;
		type = null;
	}

	var data = {};

	if ($.user) {
		data.userid = $.user.id;
		data.username = $.user.name || $.user.nick || $.user.alias;
	}

	if ($.req) {
		if ($.req.sessionid)
			data.sessionid = $.req.sessionid;
		data.ua = $.req.ua;
		data.ip = $.ip;
	}

	if (type)
		data.type = type;

	if ($.name)
		data.caller = ($.schema ? ($.schema.name + '/') : '') + $.name;

	if (F.id)
		data.instance = F.id;

	data.created = NOW = new Date();

	if (message)
		data.message = message;

	DEF.onAudit(name, data);
};

global.NOSQLREADER = function(filename) {
	if (!global.framework_nosql)
		global.framework_nosql = require('./nosql');
	return new framework_nosql.Database('readonlynosql', filename, true);
};

global.TABLEREADER = function(filename) {
	if (!global.framework_nosql)
		global.framework_nosql = require('./nosql');
	return new framework_nosql.Table('readonlytable', filename, true);
};

// @arguments {Object params}
global.LOG = F.log = function() {

	NOW = new Date();
	var filename = NOW.getFullYear() + '-' + (NOW.getMonth() + 1).toString().padLeft(2, '0') + '-' + NOW.getDate().toString().padLeft(2, '0');
	var time = NOW.getHours().toString().padLeft(2, '0') + ':' + NOW.getMinutes().toString().padLeft(2, '0') + ':' + NOW.getSeconds().toString().padLeft(2, '0');
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
	U.queue('F.log', 5, (next) => Fs.appendFile(U.combine(CONF.directory_logs, filename + '.log'), time + ' | ' + str + '\n', next));
	return F;
};

global.LOGGER = F.logger = function() {
	NOW = new Date();
	var dt = NOW.getFullYear() + '-' + (NOW.getMonth() + 1).toString().padLeft(2, '0') + '-' + NOW.getDate().toString().padLeft(2, '0') + ' ' + NOW.getHours().toString().padLeft(2, '0') + ':' + NOW.getMinutes().toString().padLeft(2, '0') + ':' + NOW.getSeconds().toString().padLeft(2, '0');
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
	U.queue('F.logger', 5, (next) => Fs.appendFile(U.combine(CONF.directory_logs, arguments[0] + '.log'), dt + ' | ' + str + '\n', next));
	return F;
};

global.LOGMAIL = F.logmail = function(address, subject, body, callback) {

	if (typeof(body) === FUNCTION) {
		callback = body;
		body = subject;
		subject = null;
	} else if (body === undefined) {
		body = subject;
		subject = null;
	}

	if (!subject)
		subject = CONF.name + ' v' + CONF.version;

	var body = '<!DOCTYPE html><html><head><title>' + subject + '</title><meta charset="utf-8" /></head><body><pre style="max-width:600px;font-size:13px;line-height:16px;white-space:pre-line">' + (typeof(body) === 'object' ? JSON.stringify(body).escape() : body) + '</pre></body></html>';
	return F.onMail(address, subject, body, callback);
};

F.usage = function(detailed) {

	var memory = process.memoryUsage();
	var cache = Object.keys(F.cache.items);
	var resources = Object.keys(F.resources);
	var controllers = Object.keys(F.controllers);
	var connections = Object.keys(F.connections);
	var schedules = Object.keys(F.schedules);
	var workers = Object.keys(F.workers);
	var modules = Object.keys(F.modules);
	var isomorphic = Object.keys(F.isomorphic);
	var models = Object.keys(F.models);
	var helpers = Object.keys(F.helpers);
	var staticFiles = Object.keys(F.temporary.path);
	var staticNotfound = Object.keys(F.temporary.notfound);
	var staticRange = Object.keys(F.temporary.range);
	var redirects = Object.keys(F.routes.redirects);
	var commands = Object.keys(F.commands);
	var output = {};
	var nosqlcleaner = Object.keys(F.databasescleaner);
	var sessions = Object.keys(F.sessions);
	var shortcache = Object.keys(F.temporary.shortcache);

	output.framework = {
		id: F.id,
		datetime: NOW,
		pid: process.pid,
		node: process.version,
		version: 'v' + F.version_header,
		platform: process.platform,
		processor: process.arch,
		uptime: Math.floor(process.uptime() / 60),
		memoryTotal: (memory.heapTotal / 1024 / 1024).floor(2),
		memoryUsage: (memory.heapUsed / 1024 / 1024).floor(2),
		memoryRss: (memory.rss / 1024 / 1024).floor(2),
		mode: DEBUG,
		port: F.port,
		ip: F.ip,
		directory: process.cwd()
	};

	if (CONF.nosql_worker && global.framework_nosql)
		output.framework.pidnosql = framework_nosql.pid();

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
		schedule: schedules.length,
		helpers: helpers.length,
		error: F.errors.length,
		problem: F.problems.length,
		queue: pending,
		files: staticFiles.length,
		notfound: staticNotfound.length,
		streaming: staticRange.length,
		modificator:  F.modificators ? F.modificators.length : 0,
		viewphrases: $VIEWCACHE.length,
		uptodates: F.uptodates ? F.uptodates.length : 0,
		nosqlcleaner: nosqlcleaner.length,
		commands: commands.length,
		sessions: sessions.length,
		shortcache: shortcache.length
	};

	output.routing = {
		webpage: F.routes.web.length,
		sitemap: F.routes.sitemap ? Object.keys(F.routes.sitemap).length : 0,
		websocket: F.routes.websockets.length,
		file: F.routes.files.length,
		middleware: Object.keys(F.routes.middleware).length,
		redirect: redirects.length
	};

	output.stats = F.stats;
	output.redirects = redirects;

	if (!detailed)
		return output;

	output.controllers = [];
	for (var i = 0, length = controllers.length; i < length; i++) {
		var key = controllers[i];
		var item = F.controllers[key];
		output.controllers.push({ name: key, usage: item.usage ? item.usage() : null });
	}

	output.connections = [];
	for (var i = 0, length = connections.length; i < length; i++) {
		var key = connections[i];
		output.connections.push({ name: key, online: F.connections[key].online });
	}

	output.modules = [];
	for (var i = 0, length = modules.length; i < length; i++) {
		var key = modules[i];
		var item = F.modules[key];
		output.modules.push({ name: key, usage: item.usage ? item.usage() : null });
	}

	output.models = [];
	for (var i = 0, length = models.length; i < length; i++) {
		var key = models[i];
		var item = F.models[key];
		output.models.push({ name: key, usage: item.usage ? item.usage() : null });
	}

	output.sessions = [];

	for (var i = 0, length = sessions.length; i < length; i++) {
		var key = sessions[i];
		var item = F.sessions[key];
		output.sessions.push({ name: key, usage: item.usage() });
	}

	output.cache = cache;
	output.changes = F.changes;
	output.errors = F.errors;
	output.files = staticFiles;
	output.helpers = helpers;
	output.nosqlcleaner = nosqlcleaner;
	output.other = Object.keys(F.temporary.other);
	output.problems = F.problems;
	output.resources = resources;
	output.commands = commands;
	output.streaming = staticRange;
	output.traces = F.traces;
	output.uptodates = F.uptodates;
	output.shortcache = shortcache;

	return output;
};

F.onPrefSave = function(val) {
	Fs.writeFile(F.path.databases(PREFFILE), JSON.stringify(val), ERROR('F.onPrefSave'));
};

F.onPrefLoad = function(next) {
	Fs.readFile(U.combine(CONF.directory_databases, PREFFILE), function(err, data) {
		if (data)
			next(data.toString('utf8').parseJSON(true));
		else
			next();
	});
};

DEF.onAudit = F.onAudit = function(name, data) {
	F.path.verify('logs');
	U.queue('F.logger', 5, (next) => Fs.appendFile(U.combine(CONF.directory_logs, name + '.log'), JSON.stringify(data) + '\n', next));
};

/**
 * Compiles content in the view @{compile}...@{end}. The function has controller context, this === controler.
 * @param {String} name
 * @param {String} html HTML content to compile
 * @param {Object} model
 * @return {String}
 */
// name, html, model
F.onCompileView = function(name, html) {
	return html;
};

/*
	3rd CSS compiler (Sync)
	@filename {String}
	@content {String} :: Content of CSS file
	return {String}
*/
F.onCompileStyle = null;

/*
	3rd JavaScript compiler (Sync)
	@filename {String}
	@content {String} :: Content of JavaScript file
	return {String}
*/
F.onCompileScript = null;

function compile_file(res) {
	fsFileRead(res.options.filename, function(err, buffer) {

		var req = res.req;
		var uri = req.uri;

		if (err) {
			F.error(err, res.options.filename, uri);
			F.temporary.notfound[req.$key] = true;
			delete F.temporary.processing[req.$key];
			res.$file();
			return;
		}

		var file = F.path.temp((F.id ? 'i-' + F.id + '_' : '') + createTemporaryKey(uri.pathname));
		F.path.verify('temp');
		Fs.writeFileSync(file, compile_content(req.extension, framework_internal.parseBlock(F.routes.blocks[uri.pathname], buffer.toString(ENCODING)), res.options.filename), ENCODING);
		var stats = Fs.statSync(file);
		var tmp = [file, stats.size, stats.mtime.toUTCString()];
		compile_gzip(tmp, function(tmp) {
			F.temporary.path[req.$key] = tmp;
			delete F.temporary.processing[req.$key];
			res.$file();
		});
	});
}

function compile_merge(res, repeated) {

	var req = res.req;
	var uri = req.uri;

	var merge = F.routes.merge[uri.pathname];
	var filename = merge.filename;

	if (!DEBUG && existsSync(filename)) {
		var stats = Fs.statSync(filename);
		var tmp = [filename, stats.size, stats.mtime.toUTCString()];
		compile_gzip(tmp, function(tmp) {
			delete F.temporary.processing[req.$key];
			F.temporary.path[req.$key] = tmp;
			res.$file();
		});
		return;
	}

	var writer = Fs.createWriteStream(filename);
	var index = 0;
	var remove = null;

	merge.files.wait(function(filename, next) {

		var block;

		// Skip isomorphic
		if (filename[0] !== '#') {
			var blocks = filename.split('#');
			block = blocks[1];
			block && (filename = blocks[0]);
		}

		if (filename.startsWith('http://') || filename.startsWith('https://')) {
			U.request(filename, FLAGS_DOWNLOAD, function(err, data) {

				var output = compile_content(req.extension, framework_internal.parseBlock(block, data), filename);

				if (JSFILES[req.extension]) {
					if (output[output.length - 1] !== ';')
						output += ';';
				} else if (req.extension === 'html') {
					if (output[output.length - 1] !== NEWLINE)
						output += NEWLINE;
				}

				DEBUG && merge_debug_writer(writer, filename, req.extension, index++, block);
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
		} else
			filename = filename.substring(1);

		var indexer = filename.indexOf('*');
		if (indexer !== -1) {

			var tmp = filename.substring(indexer + 1).toLowerCase();
			var len = tmp.length;
			!remove && (remove = []);

			// Remove directory for all future requests
			remove.push(arguments[0]);

			U.ls(filename.substring(0, indexer), function(files) {
				for (var j = 0, l = files.length; j < l; j++)
					merge.files.push('~' + files[j]);
				next();
			}, (path, isDirectory) => isDirectory ? true : path.substring(path.length - len).toLowerCase() === tmp);
			return;
		}

		fsFileRead(filename, function(err, buffer) {

			if (err) {
				F.error(err, merge.filename, uri);
				next();
				return;
			}

			var output = compile_content(req.extension, framework_internal.parseBlock(block, buffer.toString(ENCODING)), filename);
			if (JSFILES[req.extension]) {
				if (output[output.length - 1] !== ';')
					output += ';' + NEWLINE;
			} else if (req.extension === 'html') {
				if (output[output.length - 1] !== NEWLINE)
					output += NEWLINE;
			}

			DEBUG && merge_debug_writer(writer, filename, req.extension, index++, block);
			writer.write(output);
			next();
		});

	}, function() {

		CLEANUP(writer, function() {

			var stats;

			try {
				stats = Fs.statSync(filename);
			} catch (e) {

				e && F.error(e, 'compile_merge' + (repeated ? ' - repeated' : ''), req.url);

				// Try it again
				if (repeated) {
					delete F.temporary.processing[req.$key];
					if (!F.routes.filesfallback || !F.routes.filesfallback(req, res))
						res.throw404();
				} else
					compile_merge(res, true);

				return;
			}

			var tmp = [filename, stats.size, stats.mtime.toUTCString()];
			compile_gzip(tmp, function(tmp) {
				F.temporary.path[req.$key] = tmp;
				delete F.temporary.processing[req.$key];
				res.$file();
			});
		});

		writer.end();

		// Removes all directories from merge list (because the files are added into the queue)
		if (remove) {
			for (var i = 0, length = remove.length; i < length; i++)
				merge.files.splice(merge.files.indexOf(remove[i]), 1);
		}
	});

	return F;
}

function merge_debug_writer(writer, filename, extension, index, block) {
	var plus = '===========================================================================================';
	var beg = JSFILES[extension] ? '/*\n' : extension === 'css' ? '/*!\n' : '<!--\n';
	var end = JSFILES[extension] || extension === 'css' ? '\n */' : '\n-->';
	var mid = extension !== 'html' ? ' * ' : ' ';
	writer.write((index > 0 ? '\n\n' : '') + beg + mid + plus + '\n' + mid + 'MERGED: ' + filename + '\n' + (block ? mid + 'BLOCKS: ' + block + '\n' : '') + mid + plus + end + '\n\n', ENCODING);
}

function component_debug(filename, value, extension) {
	var plus = '===========================================================================================';
	var beg = JSFILES[extension] ? '/*\n' : extension === 'css' ? '/*!\n' : '<!--\n';
	var end = JSFILES[extension] || extension === 'css' ? '\n */' : '\n-->';
	var mid = extension !== 'html' ? ' * ' : ' ';
	return beg + mid + plus + '\n' + mid + 'COMPONENT: ' + filename + '\n' + mid + plus + end + '\n\n' + value;
}

F.compile_virtual = function(res) {

	var req = res.req;
	var tmpname = res.options.filename.replace(CONF.directory_public, CONF.directory_public_virtual);

	if (tmpname === res.options.filename) {
		F.temporary.notfound[req.$key] = true;
		delete F.temporary.processing[req.$key];
		res.$file();
		return;
	}

	fsFileExists(tmpname, function(e, size, sfile, stats) {

		if (!e) {
			F.temporary.notfound[req.$key] = true;
			delete F.temporary.processing[req.$key];
			res.$file();
			return;
		}

		if (!res.noCompress && COMPRESSIONSPECIAL[req.extension] && CONF.allow_compile && !REG_NOCOMPRESS.test(res.options.filename)) {
			res.options.filename = tmpname;
			return compile_file(res);
		}

		var tmp = [tmpname, size, stats.mtime.toUTCString()];
		if (CONF.allow_gzip && COMPRESSION[U.getContentType(req.extension)]) {
			compile_gzip(tmp, function(tmp) {
				F.temporary.path[req.$key] = tmp;
				delete F.temporary.processing[req.$key];
				res.$file();
			});
		} else {
			F.temporary.path[req.$key] = tmp;
			delete F.temporary.processing[req.$key];
			res.$file();
		}
	});

	return;
};

function compile_check(res) {

	var req = res.req;
	var uri = req.uri;

	if (F.routes.merge[uri.pathname]) {
		compile_merge(res);
		return;
	}

	fsFileExists(res.options.filename, function(e, size, sfile, stats) {

		if (e) {

			if (!res.noCompress && COMPRESSIONSPECIAL[req.extension] && CONF.allow_compile && !REG_NOCOMPRESS.test(res.options.filename))
				return compile_file(res);

			var tmp = [res.options.filename, size, stats.mtime.toUTCString()];
			if (CONF.allow_gzip && COMPRESSION[U.getContentType(req.extension)]) {
				compile_gzip(tmp, function(tmp) {
					F.temporary.path[req.$key] = tmp;
					res.$file();
					delete F.temporary.processing[req.$key];
				});
			} else {
				F.temporary.path[req.$key] = tmp;
				res.$file();
				delete F.temporary.processing[req.$key];
			}

		} else if (F.isVirtualDirectory)
			F.compile_virtual(res);
		else {
			F.temporary.notfound[req.$key] = true;
			delete F.temporary.processing[req.$key];
			res.$file();
		}
	});
}

function compile_gzip(arr, callback) {

	// GZIP compression

	var filename = F.path.temp('file' + arr[0].hash().toString().replace('-', '0') + '.gz');
	arr.push(filename);

	F.stats.performance.open++;
	var reader = Fs.createReadStream(arr[0]);
	var writer = Fs.createWriteStream(filename);

	CLEANUP(writer, function() {
		fsFileExists(filename, function(e, size) {
			arr.push(size);
			callback(arr);
		});
	});

	reader.pipe(Zlib.createGzip(GZIPFILE)).pipe(writer);
	CLEANUP(reader);
}

function compile_content(extension, content, filename) {

	if (filename && REG_NOCOMPRESS.test(filename))
		return content;

	switch (extension) {
		case 'js':
		case 'mjs':
			return CONF.allow_compile_script ? framework_internal.compile_javascript(content, filename) : content;

		case 'css':
			content = CONF.allow_compile_style ? framework_internal.compile_css(content, filename) : content;
			var matches = content.match(REG_COMPILECSS);
			if (matches) {
				for (var i = 0, length = matches.length; i < length; i++) {
					var key = matches[i];
					var url = key.substring(4, key.length - 1);
					content = content.replace(key, 'url(' + F.$version(url, true) + ')');
				}
			}
			return content;
	}

	return content;
}

F.restore = function(filename, target, callback, filter) {

	var buffer_key = Buffer.from(':');
	var buffer_new = Buffer.from('\n');
	var buffer_dir = Buffer.from('#');
	var cache = {};
	var data = null;
	var type = 0;
	var item = null;
	var stream = Fs.createReadStream(filename);
	var index = 0;
	var parser = {};
	var open = {};
	var pending = 0;
	var end = false;
	var output = {};

	output.count = 0;
	output.path = target;

	parser.parse_key = function() {

		index = data.indexOf(buffer_key);
		if (index === -1)
			return;

		index++;
		item = data.slice(0, index - 1).toString('utf8').trim();
		data = data.slice(index + (data[index] === 32 ? 1 : 0));
		type = 1;
		parser.next();
	};

	parser.parse_meta = function() {
		var path = Path.join(target, item);

		// Is directory?
		if (data[0] === buffer_dir[0]) {
			if (!cache[path]) {
				cache[path] = true;
				if (!filter || filter(item, true) !== false)
					F.path.mkdir(path);
			}
			type = 3;
			parser.next();
			return;
		}

		if (!cache[path]) {
			cache[path] = true;

			var npath = path.substring(0, path.lastIndexOf(F.isWindows ? '\\' : '/'));

			var filename = filter && filter(item, false);

			if (!filter || filename || filename == null)
				F.path.mkdir(npath);
			else {
				type = 5; // skip
				parser.next();
				return;
			}
		}

		if (typeof(filename) === 'string')
			path = Path.join(target, filename);

		// File
		type = 2;
		var tmp = open[item] = {};
		tmp.path = path;
		tmp.name = item;
		tmp.writer = Fs.createWriteStream(path);
		tmp.zlib = Zlib.createGunzip();
		tmp.zlib.$self = tmp;
		pending++;

		output.count++;

		tmp.zlib.on('error', function(e) {
			pending--;
			var tmp = this.$self;
			tmp.writer.end();
			tmp.writer = null;
			tmp.zlib = null;
			delete open[tmp.name];
			F.error(e, 'bundling', path);
		});

		tmp.zlib.on('data', function(chunk) {
			this.$self.writer.write(chunk);
		});

		tmp.zlib.on('end', function() {
			pending--;
			var tmp = this.$self;
			tmp.writer.end();
			tmp.writer = null;
			tmp.zlib = null;
			delete open[tmp.name];
		});

		parser.next();
	};

	parser.parse_dir = function() {
		index = data.indexOf(buffer_new);
		if (index !== -1) {
			data = data.slice(index + 1);
			type = 0;
		}
		parser.next();
	};

	parser.parse_data = function() {

		index = data.indexOf(buffer_new);

		var skip = false;

		if (index !== -1)
			type = 0;

		if (type) {
			var remaining = data.length % 4;
			if (remaining) {
				open[item].zlib.write(Buffer.from(data.slice(0, data.length - remaining).toString('ascii'), 'base64'));
				data = data.slice(data.length - remaining);
				skip = true;
			} else {
				open[item].zlib.write(Buffer.from(data.toString('ascii'), 'base64'));
				data = null;
			}
		} else {
			open[item].zlib.end(Buffer.from(data.slice(0, index).toString('ascii'), 'base64'));
			data = data.slice(index + 1);
		}

		!skip && data && data.length && parser.next();
	};

	parser.next = function() {
		switch (type) {
			case 0:
				parser.parse_key();
				break;
			case 1:
				parser.parse_meta();
				break;
			case 2:
				parser.parse_data();
				break;
			case 3:
				parser.parse_dir();
				break;
			case 5:
				index = data.indexOf(buffer_new);
				if (index === -1)
					data = null;
				else {
					data = data.slice(index + 1);
					type = 0;
					parser.next();
				}
				break;
		}

		end && !data.length && callback && callback(null, output);
	};

	parser.end = function() {
		if (callback) {
			if (pending)
				setTimeout(parser.end, 100);
			else if (end && !data.length)
				callback(null, output);
		}
	};

	stream.on('data', function(chunk) {

		if (data) {
			CONCAT[0] = data;
			CONCAT[1] = chunk;
			data = Buffer.concat(CONCAT);
		} else
			data = chunk;

		parser.next();
	});

	CLEANUP(stream, function() {
		end = true;
		parser.end();
	});

	return F;
};

F.backup = function(filename, filelist, callback, filter) {

	var padding = 100;
	var path = filelist instanceof Array ? F.path.root() : filelist;

	if (!(filelist instanceof Array))
		filelist = [''];

	var counter = 0;

	Fs.unlink(filename, function() {

		filelist.sort(function(a, b) {
			var ac = a.split('/');
			var bc = b.split('/');
			if (ac.length < bc.length)
				return -1;
			else if (ac.length > bc.length)
				return 1;
			return a.localeCompare(b);
		});

		var clean = function(path, files) {
			var index = 0;
			while (true) {
				var filename = files[index];
				if (!filename)
					break;
				if (filename.substring(0, path.length) === path) {
					files.splice(index, 1);
					continue;
				} else
					index++;
			}
		};

		var writer = Fs.createWriteStream(filename);

		writer.on('finish', function() {
			callback && Fs.stat(filename, (e, stat) => callback(null, { filename: filename, files: counter, size: stat.size }));
		});

		filelist.wait(function(item, next) {

			var file = Path.join(path, item);

			if (F.isWindows)
				item = item.replace(/\\/g, '/');

			if (item[0] !== '/')
				item = '/' + item;

			Fs.stat(file, function(err, stats) {

				if (err) {
					F.error(err, 'F.backup()', filename);
					return next();
				}

				if (stats.isDirectory()) {
					var dir = item.replace(/\\/g, '/');

					if (dir[dir.length - 1] !== '/')
						dir += '/';

					if (filter && !filter(dir, true))
						return next();

					U.ls(file, function(f, d) {

						var length = path.length;
						if (path[path.length - 1] === '/')
							length--;

						d.wait(function(item, next) {

							if (filter && !filter(item.substring(length), true)) {
								clean(item, f);
								return next();
							}

							writer.write(item.substring(length).padRight(padding) + ':#\n', 'utf8');
							next();
						}, function() {
							for (var i = 0; i < f.length; i++)
								filelist.push(f[i].substring(length));
							next();
						});
					});
					return;
				}

				if (filter && !filter(file.substring(path.length - 1), false))
					return next();

				var data = Buffer.alloc(0);
				writer.write(item.padRight(padding) + ':');
				Fs.createReadStream(file).pipe(Zlib.createGzip(GZIPFILE)).on('data', function(chunk) {

					CONCAT[0] = data;
					CONCAT[1] = chunk;
					data = Buffer.concat(CONCAT);

					var remaining = data.length % 3;
					if (remaining) {
						writer.write(data.slice(0, data.length - remaining).toString('base64'));
						data = data.slice(data.length - remaining);
					}

				}).on('end', function() {
					data.length && writer.write(data.toString('base64'));
					writer.write('\n', 'utf8');
					counter++;
					setImmediate(next);
				});

			});
		}, () => writer.end());
	});

	return F;
};

F.exists = function(req, res, max, callback) {

	if (typeof(max) === 'function') {
		callback = max;
		max = 10;
	}

	var name = req.$key = createTemporaryKey(req);
	var filename = F.path.temp(name);
	var httpcachevalid = RELEASE && (req.headers['if-none-match'] === (ETAG + CONF.etag_version));

	if (F.isProcessed(name) || httpcachevalid) {
		res.options.filename = filename;
		res.$file();
		return F;
	}

	U.queue('F.exists', max, function(next) {
		fsFileExists(filename, function(e) {
			if (e) {
				res.options.filename = filename;
				res.options.callback = next;
				res.$file();
			} else
				callback(next, filename, req, res);
		});
	});

	return F;
};

/**
 * Is processed static file?
 * @param {String / Request} filename Filename or Request object.
 * @return {Boolean}
 */
F.isProcessed = function(filename) {

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
F.isProcessing = function(filename) {

	if (!filename.url)
		return !!F.temporary.processing[filename];

	var name = filename.url;
	var index = name.indexOf('?');

	if (index !== -1)
		name = name.substring(0, index);

	filename = U.combine(CONF.directory_public, $decodeURIComponent(name));
	return !!F.temporary.processing[filename];
};

/**
 * Clears file information in release mode
 * @param {String/Request} url
 * @return {Framework}
 */
F.touch = function(url) {
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

F.response503 = function(req, res) {
	res.options.code = 503;
	res.options.headers = HEADERS.response503;
	res.options.body = VIEW('.' + PATHMODULES + res.options.code, F.waits);
	res.$text();
	return F;
};

global.LOAD = F.load = function(debug, types, pwd, ready) {

	if (typeof(types) === 'function') {
		ready = types;
		types = null;
	}

	if (typeof(pwd) === 'function') {
		ready = pwd;
		pwd = null;
	}

	if (!types)
		types = ['nobundles', 'nopackages', 'nocomponents', 'nothemes'];

	if (pwd && pwd[0] === '.' && pwd.length < 4)
		F.directory = directory = U.$normalize(Path.normalize(directory + '/..'));
	else if (pwd)
		F.directory = directory = U.$normalize(pwd);
	else if (process.env.istotaljsworker)
		F.directory = process.cwd();
	else if ((/\/scripts\/.*?.js/).test(process.argv[1]))
		F.directory = directory = U.$normalize(Path.normalize(directory + '/..'));

	if (typeof(debug) === 'string') {
		switch (debug.toLowerCase().replace(/\.|\s/g, '-')) {
			case 'release':
			case 'production':
				debug = false;
				break;

			case 'debug':
			case 'develop':
			case 'development':
				debug = true;
				break;

			case 'test-debug':
			case 'debug-test':
			case 'testing-debug':
				debug = true;
				F.isTest = true;
				break;

			case 'test':
			case 'testing':
			case 'test-release':
			case 'release-test':
			case 'testing-release':
			case 'test-production':
			case 'testing-production':
				debug = false;
				F.isTest = true;
				break;
		}
	}

	F.isWorker = true;
	F.isDebug = debug;

	global.isWORKER = true;
	global.DEBUG = debug;
	global.RELEASE = !debug;
	global.I = global.isomorphic = F.isomorphic;

	var isNo = true;

	if (types) {
		for (var i = 0; i < types.length; i++) {
			if (types[i].substring(0, 2) !== 'no') {
				isNo = false;
				break;
			}
		}
	}

	var can = function(type) {
		if (!types)
			return true;
		if (types.indexOf('no' + type) !== -1)
			return false;
		return isNo ? true : types.indexOf(type) !== -1;
	};

	F.$bundle(function() {
		F.consoledebug('startup');
		F.$startup(function() {

			F.consoledebug('startup (done)');
			F.$configure_env();
			F.$configure_configs();

			if (can('versions'))
				F.$configure_versions();

			if (can('workflows'))
				F.$configure_workflows();

			if (can('sitemap'))
				F.$configure_sitemap();

			F.consoledebug('init');

			var noservice = true;

			for (var i = 0; i < types.length; i++) {
				switch(types[i]) {
					case 'service':
					case 'services':
						noservice = false;
						break;
				}
				if (!noservice)
					break;
			}

			F.cache.init(noservice);
			EMIT('init');

			F.$load(types, directory, function() {

				F.isLoaded = true;

				process.send && process.send('total:ready');

				setTimeout(function() {

					try {
						EMIT('load');
						EMIT('ready');
					} catch (err) {
						F.error(err, 'ON("load/ready")');
					}

					ready && ready();

					F.removeAllListeners('load');
					F.removeAllListeners('ready');

					if (F.isTest) {
						F.console();
						F.test();
						return F;
					}

					// Because this is worker
					// setTimeout(function() {
					// 	if (!F.isTest)
					// 		delete F.test;
					// }, 5000);

				}, 500);

				if (CONF.allow_debug) {
					F.consoledebug('done');
					F.usagesnapshot();
				}
			});
		});
	}, can('bundles'));

	return F;
};

/**
 * Initialize framework
 * @param  {Object} http
 * @param  {Boolean} debug
 * @param  {Object} options
 * @return {Framework}
 */
F.initialize = function(http, debug, options) {

	if (!options)
		options = {};

	var port = options.port;
	var ip = options.ip;
	var listenpath = options.listenpath;

	if (options.thread)
		global.THREAD = options.thread;

	options.config && U.extend_headers2(CONF, options.config);

	if (options.debug || options['allow-debug'] || options.allow_debug)
		CONF.allow_debug = true;

	F.isHTTPS = http.STATUS_CODES === undefined;

	if (isNaN(port) && typeof(port) !== 'string')
		port = null;

	if (options.id)
		F.id = options.id;

	F.isDebug = debug;

	if (options.bundling != null)
		F.$bundling = options.bundling == true;

	global.DEBUG = debug;
	global.RELEASE = !debug;
	global.I = global.isomorphic = F.isomorphic;

	if (options.tests) {
		F.testlist = options.tests;
		for (var i = 0; i < F.testlist.length; i++)
			F.testlist[i] = F.testlist[i].replace(/\.js$/, '');
	}

	F.$bundle(function() {

		F.$configure_env();
		F.$configure_configs();
		F.$configure_versions();
		F.$configure_workflows();
		F.$configure_sitemap();
		F.isTest && F.$configure_configs('config-test', true);
		F.cache.init();
		F.consoledebug('init');
		EMIT('init');

		if (!port) {
			if (CONF.default_port === 'auto') {
				var envPort = +(process.env.PORT || '');
				if (!isNaN(envPort))
					port = envPort;
			} else
				port = CONF.default_port;
		}

		F.port = port || 8000;

		if (ip !== null) {
			F.ip = ip || CONF.default_ip || '0.0.0.0';
			if (F.ip === 'null' || F.ip === 'undefined' || F.ip === 'auto')
				F.ip = null;
		} else
			F.ip = undefined;

		if (F.ip == null)
			F.ip = '0.0.0.0';

		!listenpath && (listenpath = CONF.default_listenpath);
		F.listenpath = listenpath;

		if (F.server) {
			F.server.removeAllListeners();
			Object.keys(F.connections).forEach(function(key) {
				var item = F.connections[key];
				if (item) {
					item.removeAllListeners();
					item.close();
				}
			});

			F.server.close();
		}

		var listen = function() {

			if (options.https) {

				var meta = options.https;

				if (typeof(meta.key) === 'string') {
					if (meta.key.indexOf('.') === -1)
						meta.key = Buffer.from(meta.key, 'base64');
					else
						meta.key = Fs.readFileSync(meta.key);
				}

				if (typeof(meta.cert) === 'string') {
					if (meta.cert.indexOf('.') === -1)
						meta.cert = Buffer.from(meta.cert, 'base64');
					else
						meta.cert = Fs.readFileSync(meta.cert);
				}

				F.server = http.createServer(meta, F.listener);

			} else
				F.server = http.createServer(F.listener);

			CONF.allow_performance && F.server.on('connection', connection_tunning);
			F.initwebsocket && F.initwebsocket();
			F.consoledebug('HTTP listening');

			if (listenpath)
				F.server.listen(listenpath);
			else
				F.server.listen(F.port, F.ip);
		};

		// clears static files
		F.consoledebug('clear temporary');
		F.clear(function() {

			F.consoledebug('clear temporary (done)');
			F.$load(undefined, directory, function() {

				F.isLoaded = true;
				process.send && process.send('total:ready');

				if (options.middleware)
					options.middleware(listen);
				else
					listen();

				if (CONF.allow_debug) {
					F.consoledebug('done');
					F.usagesnapshot();
				}

				if (!process.connected)
					F.console();

				setTimeout(function() {

					try {
						EMIT('load');
						EMIT('ready');
					} catch (err) {
						F.error(err, 'ON("load/ready")');
					}

					F.removeAllListeners('load');
					F.removeAllListeners('ready');
					options.package && INSTALL('package', options.package);
					runsnapshot();
				}, 500);

				if (F.isTest) {
					var sleep = options.sleep || options.delay || 1000;
					setTimeout(F.test, sleep);
					return F;
				}

				setTimeout(function() {
					if (!F.isTest)
						delete F.test;
				}, 5000);
			});
		}, true);
	});

	return F;
};

function connection_tunning(socket) {
	socket.setNoDelay(true);
	socket.setKeepAlive(true, 10);
}

/**
 * Run framework –> HTTP
 * @param  {String} mode Framework mode.
 * @param  {Object} options Framework settings.
 * @param {Function(listen)} middleware A middleware for manual calling of HTTP listener
 * @return {Framework}
 */
F.http = function(mode, options, middleware) {
	F.consoledebug('begin');

	if (typeof(options) === 'function') {
		middleware = options;
		options = null;
	}

	options == null && (options = {});
	!options.port && (options.port = +process.argv[2]);

	if (options.port && isNaN(options.port))
		options.port = 0;

	if (typeof(middleware) === 'function')
		options.middleware = middleware;

	if (options.bundling != null)
		F.$bundling = options.bundling;

	var http = require('http');
	extend_request(http.IncomingMessage.prototype);
	extend_response(http.ServerResponse.prototype);
	return F.mode(http, mode, options);
};

/**
 * Run framework –> HTTPS
 * @param {String} mode Framework mode.
 * @param {Object} options Framework settings.
 * @param {Function(listen)} middleware A middleware for manual calling of HTTP listener
 * @return {Framework}
 */
F.https = function(mode, options, middleware) {
	F.consoledebug('begin');
	var http = require('http');

	if (typeof(options) === 'function') {
		middleware = options;
		options = null;
	}

	options == null && (options = {});
	!options.port && (options.port = +process.argv[2]);

	if (options.port && isNaN(options.port))
		options.port = 0;

	if (typeof(middleware) === 'function')
		options.middleware = middleware;

	extend_request(http.IncomingMessage.prototype);
	extend_response(http.ServerResponse.prototype);
	return F.mode(require('https'), mode, options);
};

F.mode = function(http, name, options) {

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
		DEBUG = debug;
		CONF.trace = debug;
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

		case 'test-debug':
		case 'debug-test':
		case 'testing-debug':
			debug = true;
			F.isTest = true;
			break;

		case 'test':
		case 'testing':
		case 'test-release':
		case 'release-test':
		case 'testing-release':
		case 'test-production':
		case 'testing-production':
			debug = false;
			F.isTest = true;
			break;
	}

	CONF.trace = debug;
	F.consoledebug('startup');
	F.$startup(function() {
		F.consoledebug('startup (done)');
		F.initialize(http, debug, options);
	});
	return F;
};

F.custom = function(mode, http, request, response, options) {
	var debug = false;

	if (options.directory)
		F.directory = directory = options.directory;

	F.consoledebug('begin');

	extend_request(request);
	extend_response(response);

	switch (mode.toLowerCase().replace(/\.|\s/g, '-')) {
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
			debug = true;
			F.isTest = true;
			break;

		case 'test-release':
		case 'release-test':
		case 'testing-release':
		case 'test-production':
		case 'testing-production':
			debug = false;
			break;
	}

	CONF.trace = debug;
	F.consoledebug('startup');
	F.$startup(function() {
		F.consoledebug('startup (done)');
		F.initialize(http, debug, options);
	});

	return F;
};

F.console = function() {
	var memory = process.memoryUsage();
	console.log('====================================================');
	console.log('PID           : ' + process.pid);
	console.log('Node.js       : ' + process.version);
	console.log('Total.js      : v' + F.version_header);
	console.log('OS            : ' + Os.platform() + ' ' + Os.release());

	// Removed worker in v4
	CONF.nosql_worker && global.framework_nosql && console.log('NoSQL PID     : ' + global.framework_nosql.pid());

	console.log('Memory        : ' + memory.heapUsed.filesize(2) + ' / ' + memory.heapTotal.filesize(2));
	console.log('User          : ' + Os.userInfo().username);
	console.log('====================================================');
	console.log('Name          : ' + CONF.name);
	console.log('Version       : ' + CONF.version);
	CONF.author && console.log('Author        : ' + CONF.author);
	console.log('Date          : ' + NOW.format('yyyy-MM-dd HH:mm:ss'));
	console.log('Mode          : ' + (DEBUG ? 'debug' : 'release'));
	global.THREAD && console.log('Thread        : ' + global.THREAD);
	console.log('====================================================');
	CONF.default_root && console.log('Root          : ' + F.config.default_root);
	console.log('Directory     : ' + process.cwd());
	console.log('node_modules  : ' + PATHMODULES);
	console.log('====================================================\n');

	if (!F.isWorker) {

		var hostname = '{2}://{0}:{1}/'.format(F.ip, F.port, F.isHTTPS ? 'https' : 'http');

		if (F.ip === '0.0.0.0') {
			var ni = Os.networkInterfaces();
			if (ni.en0) {
				for (var i = 0; i < ni.en0.length; i++) {
					var nii = ni.en0[i];
					// nii.family === 'IPv6' ||
					if (nii.family === 'IPv4') {
						hostname += '\n{2}://{0}:{1}/'.format(nii.address, F.port, F.isHTTPS ? 'https' : 'http');
						break;
					}
				}
			}
		}

		console.log(hostname);
		console.log('');
	}
};

F.usagesnapshot = function(filename) {
	Fs.writeFile(filename || F.path.root('usage' + (F.id ? ('-' + F.id) : '') + '.log'), JSON.stringify(F.usage(true), null, '\t'), NOOP);
	return F;
};

F.consoledebug = function() {

	if (!CONF.allow_debug)
		return F;

	var arr = [new Date().format('yyyy-MM-dd HH:mm:ss'), '--------->'];
	for (var i = 0; i < arguments.length; i++)
		arr.push(arguments[i]);
	console.log.apply(console, arr);
	return F;
};

/**
 * Re-connect server
 * @return {Framework}
 */
F.reconnect = function() {
	if (CONF.default_port !== undefined)
		F.port = CONF.default_port;
	if (CONF.default_ip !== undefined)
		F.ip = CONF.default_ip;
	F.server.close(() => F.server.listen(F.port, F.ip));
	return F;
};

/**
 * Internal service
 * @private
 * @param {Number} count Run count.
 * @return {Framework}
 */
F.service = function(count) {

	UIDGENERATOR_REFRESH();

	var keys;
	var releasegc = false;

	F.temporary.service.request = F.stats.performance.request;
	F.temporary.service.file = F.stats.performance.file;
	F.temporary.service.message = F.stats.performance.message;
	F.temporary.service.mail = F.stats.performance.mail;
	F.temporary.service.open = F.stats.performance.open;
	F.temporary.service.dbrm = F.stats.performance.dbrm;
	F.temporary.service.dbwm = F.stats.performance.dbwm;
	F.temporary.service.external = F.stats.performance.external;

	F.stats.performance.external = 0;
	F.stats.performance.dbrm = 0;
	F.stats.performance.dbwm = 0;
	F.stats.performance.request = 0;
	F.stats.performance.file = 0;
	F.stats.performance.message = 0;
	F.stats.performance.mail = 0;
	F.stats.performance.open = 0;

	// clears short cahce temporary cache
	F.temporary.shortcache = {};

	// clears temporary memory for non-exist files
	F.temporary.notfound = {};

	if (CONF.allow_reqlimit)
		F.temporary.ddos = {};

	// every 10 minutes (default) service clears static cache
	if (count % CONF.default_interval_clear_cache === 0) {
		F.$events.clear && EMIT('clear', 'temporary', F.temporary);
		F.temporary.path = {};
		F.temporary.range = {};
		F.temporary.views = {};
		F.temporary.other = {};

		global.TEMP = {};
		global.$VIEWCACHE && global.$VIEWCACHE.length && (global.$VIEWCACHE = []);

		// Clears command cache
		Image.clear();

		var dt = NOW.add('-5 minutes');
		for (var key in F.databases)
			F.databases[key] && F.databases[key].inmemorylastusage < dt && F.databases[key].release();

		releasegc = true;
		CONF.allow_debug && F.consoledebug('clear temporary cache');

		keys = Object.keys(F.temporary.internal);
		for (var i = 0; i < keys.length; i++)
			if (!F.temporary.internal[keys[i]])
				delete F.temporary.internal[keys[i]];

		// Clears released sessions
		keys = Object.keys(F.sessions);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (F.sessions[key]) {
				F.sessions[key].clean();
				CONF.allow_sessions_unused && F.sessions[key].releaseunused(CONF.allow_sessions_unused);
			}
		}
	}

	// every 61 minutes (default) services precompile all (installed) views
	if (count % CONF.default_interval_precompile_views === 0) {
		for (var key in F.routes.views) {
			var item = F.routes.views[key];
			F.install('view', key, item.url, null);
		}
	}

	if (count % CONF.default_interval_clear_dnscache === 0) {
		F.$events.clear && EMIT('clear', 'dns');
		CMD('clear_dnscache');
		CONF.allow_debug && F.consoledebug('clear DNS cache');
	}

	var ping = CONF.default_interval_websocket_ping;
	if (ping > 0 && count % ping === 0) {
		var has = false;
		for (var item in F.connections) {
			var conn = F.connections[item];
			if (conn) {
				conn.check();
				conn.ping();
				has = true;
			}
		}
		has && CONF.allow_debug && F.consoledebug('ping websocket connections');
	}

	// OBSOLETE, it will be deleted in v4
	if (F.uptodates && (count % CONF.default_interval_uptodate === 0) && F.uptodates.length) {
		var hasUpdate = false;
		F.uptodates.wait(function(item, next) {

			if (item.updated.add(item.interval) > NOW)
				return next();

			item.updated = NOW;
			item.count++;

			setTimeout(function() {
				CONF.allow_debug && F.consoledebug('uptodate', item.type + '#' + item.url);
				F.install(item.type, item.url, item.options, function(err, name, skip) {

					CONF.allow_debug && F.consoledebug('uptodate', item.type + '#' + item.url + ' (done)');

					if (skip)
						return next();

					if (err) {
						item.errors.push(err);
						item.errors.length > 50 && F.errors.shift();
					} else {
						hasUpdate = true;
						item.name = name;
						F.$events.uptodate && EMIT('uptodate', item.type, name);
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
	if (count % CONF.default_interval_clear_resources === 0) {
		F.$events.clear && EMIT('clear', 'resources');
		F.resources = {};
		releasegc = true;
		CONF.allow_debug && F.consoledebug('clear resources');
	}

	// Session DDOS cleaner
	if (F.sessionscount && count % 15 === 0) {
		keys = Object.keys(F.sessions);
		for (var i = 0; i < keys.length; i++) {
			var session = F.sessions[keys[i]];
			if (session.ddosis) {
				session.ddos = {};
				session.ddosis = false;
			}
		}
	}

	// Update expires date
	count % 1000 === 0 && (DATE_EXPIRES = NOW.add('y', 1).toUTCString());

	if (count % CONF.nosql_cleaner === 0 && CONF.nosql_cleaner) {
		keys = Object.keys(F.databasescleaner);
		keys.wait(function(item, next) {
			if (item[0] === '$')
				TABLE(item.substring(1)).clean(next);
			else
				NOSQL(item).clean(next);
		});
	}

	F.$events.service && EMIT('service', count);

	if (CONF.allow_debug) {
		F.consoledebug('service ({0}x)'.format(count));
		F.usagesnapshot();
	}

	releasegc && global.gc && setTimeout(function() {
		global.gc();
		CONF.allow_debug && F.consoledebug('gc()');
	}, 1000);

	if (WORKERID > 9999999999)
		WORKERID = 0;

	// Run schedules
	keys = Object.keys(F.schedules);

	if (!keys.length)
		return F;

	var expire = NOW.getTime();

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var schedule = F.schedules[key];
		if (schedule.expire <= expire) {
			if (schedule.repeat)
				schedule.expire = NOW.add(schedule.repeat);
			else
				delete F.schedules[key];
			CONF.allow_debug && F.consoledebug('schedule', key);
			schedule.fn.call(F);
		}
	}

	return F;
};

/**
 * Request processing
 * @private
 * @param {Request} req
 * @param {Response} res
 */
F.listener = function(req, res) {

	req.options = res.options = {};
	res.req = req;
	req.res = res;

	if (F._length_wait)
		return F.response503(req, res);
	else if (!req.host) // HTTP 1.0 without host
		return res.throw400();

	if (CONF.allow_reqlimit) {
		var ip = req.ip;
		if (F.temporary.ddos[ip] > CONF.allow_reqlimit) {
			F.stats.response.ddos++;
			res.options.code = 503;
			res.options.headers = HEADERS.response503ddos;
			res.options.body = '503 Service Unavailable';
			res.$text();
			return;
		}
		if (F.temporary.ddos[ip])
			F.temporary.ddos[ip]++;
		else
			F.temporary.ddos[ip] = 1;
	}

	if (F._request_check_proxy) {
		for (var i = 0; i < F.routes.proxies.length; i++) {
			var proxy = F.routes.proxies[i];
			if (req.url.substring(0, proxy.url.length) === proxy.url) {
				F.stats.response.proxy++;
				makeproxy(proxy, req, res);
				return;
			}
		}
	}

	var headers = req.headers;
	req.$protocol = ((req.connection && req.connection.encrypted) || ((headers['x-forwarded-proto'] || ['x-forwarded-protocol']) === 'https')) ? 'https' : 'http';
	req.uri = framework_internal.parseURI(req);

	F.stats.request.request++;
	F.$events.request && EMIT('request', req, res);

	if (F._request_check_redirect) {
		var redirect = F.routes.redirects[req.$protocol + '://' + req.host];
		if (redirect) {
			F.stats.response.forward++;
			res.options.url = redirect.url + (redirect.path ? req.url : '');
			res.options.permanent = redirect.permanent;
			res.$redirect();
			return;
		}
	}

	req.path = framework_internal.routeSplit(req.uri.pathname);

	req.processing = 0;
	req.isAuthorized = true;
	req.xhr = headers['x-requested-with'] === 'XMLHttpRequest';
	res.success = false;
	req.user = req.session = null;
	req.isStaticFile = CONF.allow_static_files && U.isStaticFile(req.uri.pathname);

	if (req.isStaticFile)
		req.extension = U.getExtension(req.uri.pathname);
	else if (F.onLocale)
		req.$language = F.onLocale(req, res, req.isStaticFile);

	req.on('aborted', onrequesterror);
	F.reqstats(true, true);

	if (F._length_request_middleware)
		async_middleware(0, req, res, F.routes.request, requestcontinue_middleware);
	else
		F.$requestcontinue(req, res, headers);
};

function onrequesterror() {
	F.reqstats(false);
	this.success = true;
	if (this.res)
		this.res.$aborted = true;
}

function requestcontinue_middleware(req, res)  {
	if (req.$total_middleware)
		req.$total_middleware = null;
	F.$requestcontinue(req, res, req.headers);
}

function makeproxy(proxy, req, res) {

	var secured = proxy.uri.protocol === 'https:';
	var uri = proxy.uri;
	uri.headers = req.headers;
	uri.method = req.method;

	if (proxy.copypath)
		uri.path = req.url;

	if (!secured)
		uri.agent = PROXYKEEPALIVE;

	proxy.before && proxy.before(uri, req, res);
	uri.headers.host = uri.host;

	var request;
	if (secured) {
		var https = require('https');
		if (uri.method === 'GET')
			request = https.get(uri, makeproxycallback);
		else
			request = https.request(uri, makeproxycallback);
	} else {
		if (uri.method === 'GET')
			request = http.get(uri, makeproxycallback);
		else
			request = http.request(uri, makeproxycallback);
	}

	F.stats.performance.external++;

	request.on('error', makeproxyerror);
	request.$res = res;
	request.$proxy = proxy;
	req.pipe(request, PROXYOPTIONS);
}

function makeproxyerror(err) {
	MODELERROR.code = 503;
	MODELERROR.status = U.httpStatus(503, false);
	MODELERROR.error = err.toString();
	this.$res.writeHead(503, HEADERS.response503);
	this.$res.end(VIEW('.' + PATHMODULES + 'error', MODELERROR));
}

function makeproxycallback(response) {
	this.$proxy.after && this.proxy.after(response);
	this.$res.writeHead(response.statusCode, response.headers);
	response.pipe(this.$res, PROXYOPTIONS);
}


const TRAVELCHARS = { e: 1, E: 1 };

/**
 * Continue to process
 * @private
 * @param {Request} req
 * @param {Response} res
 * @param {Object} headers
 * @param {String} protocol [description]
 * @return {Framework}
 */
F.$requestcontinue = function(req, res, headers) {

	if (!req || !res || res.headersSent || res.success)
		return;

	var tmp;

	// Validates if this request is the file (static file)
	if (req.isStaticFile) {

		F.stats.performance.file++;
		tmp = F.temporary.shortcache[req.uri.pathname];

		if (!tmp) {
			// Stops path travelsation outside of "public" directory
			// A potential security issue
			for (var i = 0; i < req.uri.pathname.length - 1; i++) {
				var c = req.uri.pathname[i];
				var n = req.uri.pathname[i + 1];
				if ((c === '.' && (n === '/' || n === '%')) || (c === '%' && n === '2' && TRAVELCHARS[req.uri.pathname[i + 2]])) {
					F.temporary.shortcache[req.uri.pathname] = 2;
					req.$total_status(404);
					return;
				}
			}
			F.temporary.shortcache[req.uri.pathname] = 1;
		} else if (tmp === 2) {
			req.$total_status(404);
			return;
		}

		F.stats.request.file++;

		if (F._length_files)
			req.$total_file();
		else
			res.continue();

		return;
	}

	F.stats.performance.request++;

	if (!PERF[req.method]) {
		req.$total_status(404);
		return;
	}

	if (req.uri.search) {
		tmp = F.temporary.shortcache[req.uri.search];

		if (!tmp) {
			tmp = 1;
			for (var i = 1; i < req.uri.search.length - 2; i++) {
				if (req.uri.search[i] === '%' && req.uri.search[i + 1] === '0' && req.uri.search[i + 2] === '0') {
					tmp = 2;
					break;
				}
			}
			F.temporary.shortcache[req.uri.search] = tmp;
		}

		if (tmp === 2) {
			req.$total_status(404);
			return;
		}
	}

	F.stats.request.web++;
	req.body = EMPTYOBJECT;
	req.files = EMPTYARRAY;
	req.buffer_exceeded = false;
	req.buffer_has = false;
	req.$flags = req.method[0] + req.method[1];

	var flags = [req.method.toLowerCase()];
	var multipart;

	if (F._request_check_mobile && req.mobile) {
		req.$flags += 'a';
		F.stats.request.mobile++;
	} else
		F.stats.request.desktop++;

	req.$protocol[5] && (req.$flags += req.$protocol[5]);
	req.$type = 0;
	flags.push(req.$protocol);

	var method = req.method;
	var first = method[0];

	if (first === 'P' || first === 'D') {
		multipart = req.headers['content-type'] || '';
		req.buffer_data = Buffer.alloc(0);
		var index = multipart.indexOf(';', 6);
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
				req.$upload = true;
				flags.push('upload');
				break;
			case '/xml':
				req.$flags += 'd';
				flags.push('xml');
				req.$type = 2;
				multipart = '';
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

	if (headers.accept === 'text/event-stream') {
		req.$flags += 'g';
		flags.push('sse');
	}

	if (DEBUG) {
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

	F.$events['request-begin'] && EMIT('request-begin', req, res);
	F.$events.request_begin && EMIT('request_begin', req, res);

	var isCORS = (F._length_cors || F.routes.corsall) && req.headers.origin != null;

	switch (first) {
		case 'G':
			F.stats.request.get++;
			if (isCORS)
				F.$cors(req, res, cors_callback0);
			else
				req.$total_end();
			return;

		case 'O':
			F.stats.request.options++;
			if (isCORS)
				F.$cors(req, res, cors_callback0);
			else
				req.$total_end();
			return;

		case 'H':
			F.stats.request.head++;
			if (isCORS)
				F.$cors(req, res, cors_callback0);
			else
				req.$total_end();
			return;

		case 'D':
			F.stats.request['delete']++;
			if (isCORS)
				F.$cors(req, res, cors_callback1);
			else
				req.$total_urlencoded();
			return;

		case 'P':
			if (F._request_check_POST) {
				if (multipart) {
					if (isCORS)
						F.$cors(req, res, cors_callback_multipart, multipart);
					else
						req.$total_multipart(multipart);
				} else {
					if (method === 'PUT')
						F.stats.request.put++;
					else if (method === 'PATCH')
						F.stats.request.patch++;
					else
						F.stats.request.post++;
					if (isCORS)
						F.$cors(req, res, cors_callback1);
					else
						req.$total_urlencoded();
				}
				return;
			}
			break;
	}

	req.$total_status(404);
};

function cors_callback0(req) {
	req.$total_end();
}

function cors_callback1(req) {
	req.$total_urlencoded();
}

function cors_callback_multipart(req, res, multipart) {
	req.$total_multipart(multipart);
}

F.$cors = function(req, res, fn, arg) {

	var isAllowed = F.routes.corsall;
	var cors, origin;
	var headers = req.headers;
	var key;

	if (!isAllowed) {

		for (var i = 0; i < F._length_cors; i++) {
			cors = F.routes.cors[i];
			if (framework_internal.routeCompare(req.path, cors.url, false, cors.isWILDCARD)) {
				isAllowed = true;
				break;
			}
		}

		if (!isAllowed)
			return fn(req, res, arg);

		var stop = false;

		key = 'cors' + cors.hash + '_' + headers.origin;

		if (F.temporary.other[key]) {
			stop = F.temporary.other[key] === 2;
		} else {

			isAllowed = false;

			if (cors.headers) {
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
						if (current === cors.methods[i]) {
							isAllowed = true;
							break;
						}
					}
					if (!isAllowed)
						stop = true;
				}
			}

			if (!stop && cors.origin) {
				origin = headers.origin.toLowerCase().substring(headers.origin.indexOf('/') + 2);
				if (origin !== headers.host) {
					isAllowed = false;
					for (var i = 0, length = cors.origin.length; i < length; i++) {
						if (cors.origin[i].indexOf(origin) !== -1) {
							isAllowed = true;
							break;
						}
					}
					if (!isAllowed)
						stop = true;
				}
			}

			F.temporary.other[key] = stop ? 2 : 1;
		}
	} else if (CONF.default_cors) {
		key = headers.origin;
		if (F.temporary.other[key]) {
			stop = F.temporary.other[key] === 2;
		} else {
			origin = key.toLowerCase().substring(key.indexOf('/') + 2);
			stop = origin !== headers.host && CONF.default_cors.indexOf(origin) === -1;
			F.temporary.other[key] = stop ? 2 : 1;
		}
	}

	if (stop)
		origin = 'null';
	else
		origin = headers.origin;

	res.setHeader('Access-Control-Allow-Origin', origin);

	if (!cors || cors.credentials)
		res.setHeader('Access-Control-Allow-Credentials', 'true');

	var name = 'Access-Control-Allow-Methods';
	var isOPTIONS = req.method === 'OPTIONS';

	if (cors && cors.methods)
		res.setHeader(name, cors.methods.join(', '));
	else
		res.setHeader(name, isOPTIONS ? headers['access-control-request-method'] || '*' : req.method);

	name = 'Access-Control-Allow-Headers';

	if (cors && cors.headers)
		res.setHeader(name, cors.headers.join(', '));
	else
		res.setHeader(name, headers['access-control-request-headers'] || '*');

	cors && cors.age && res.setHeader('Access-Control-Max-Age', cors.age);

	if (stop) {
		fn = null;
		F.$events['request-end'] && EMIT('request-end', req, res);
		F.$events.request_end && EMIT('request_end', req, res);
		F.reqstats(false, false);
		F.stats.request.blocked++;
		res.writeHead(404);
		res.end();
		return;
	}

	if (!isOPTIONS)
		return fn(req, res, arg);

	fn = null;
	F.$events['request-end'] && EMIT('request-end', req, res);
	F.$events.request_end && EMIT('request_end', req, res);
	F.reqstats(false, false);
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
const REGWS = /websocket/i;
F.$upgrade = function(req, socket, head) {

	if (!REGWS.test(req.headers.upgrade || '') || F._length_wait)
		return;

	// disables timeout
	socket.setTimeout(0);
	socket.on('error', NOOP);

	var headers = req.headers;
	req.$protocol = req.connection.encrypted || headers['x-forwarded-protocol'] === 'https' ? 'https' : 'http';

	req.uri = framework_internal.parseURI(req);

	F.$events.websocket && EMIT('websocket', req, socket, head);
	F.stats.request.websocket++;

	req.session = null;
	req.user = null;
	req.flags = [req.secured ? 'https' : 'http', 'get'];

	req.$wspath = U.path(req.uri.pathname);
	var websocket = new WebSocketClient(req, socket, head);

	req.path = framework_internal.routeSplit(req.uri.pathname);
	req.websocket = websocket;

	if (F.onLocale)
		req.$language = F.onLocale(req, socket);

	if (F._length_request_middleware)
		async_middleware(0, req, req.websocket, F.routes.request, websocketcontinue_middleware);
	else
		F.$websocketcontinue(req, req.$wspath, headers);
};

function websocketcontinue_middleware(req) {
	if (req.$total_middleware)
		req.$total_middleware = null;
	F.$websocketcontinue(req, req.$wspath, req.headers);
}

function websocketcontinue_authnew(isAuthorized, user, $) {

	// @isAuthorized "null" for callbacks(err, user)
	// @isAuthorized "true"
	// @isAuthorized "object" is as user but "user" must be "undefined"

	if (isAuthorized instanceof Error || isAuthorized instanceof ErrorBuilder) {
		// Error handling
		isAuthorized = false;
	} else if (isAuthorized == null && user) {
		// A callback error handling
		isAuthorized = true;
	} else if (user == null && isAuthorized && isAuthorized !== true) {
		user = isAuthorized;
		isAuthorized = true;
	}

	var req = $.req;
	if (user)
		req.user = user;
	var route = F.lookup_websocket(req, req.websocket.uri.pathname, isAuthorized ? 1 : 2);
	if (route) {
		F.$websocketcontinue_process(route, req, req.websocketpath);
	} else
		req.websocket.$close(4001, '401: unauthorized');
}

F.$websocketcontinue = function(req, path) {
	req.websocketpath = path;
	if (F.onAuthorize) {
		if (F.onAuthorize.$newversion) {
			F.onAuthorize(req, req.websocket, req.flags, websocketcontinue_authnew);
		} else {
			// @TODO: remove in v4
			F.onAuthorize.call(F, req, req.websocket, req.flags, function(isAuthorized, user) {

				if (!F.onAuthorize.isobsolete) {
					F.onAuthorize.isobsolete = 1;
					OBSOLETE('F.onAuthorize', 'You need to use a new authorization declaration: "AUTH(function($) {})"');
				}

				// @isAuthorized "null" for callbacks(err, user)
				// @isAuthorized "true"
				// @isAuthorized "object" is as user but "user" must be "undefined"

				if (isAuthorized instanceof Error || isAuthorized instanceof ErrorBuilder) {
					// Error handling
					isAuthorized = false;
				} else if (isAuthorized == null && user) {
					// A callback error handling
					isAuthorized = true;
				} else if (user == null && isAuthorized && isAuthorized !== true) {
					user = isAuthorized;
					isAuthorized = true;
				}

				if (user)
					req.user = user;
				var route = F.lookup_websocket(req, req.websocket.uri.pathname, isAuthorized ? 1 : 2);
				if (route) {
					F.$websocketcontinue_process(route, req, path);
				} else
					req.websocket.$close(4001, '401: unauthorized');
			});
		}
	} else {
		var route = F.lookup_websocket(req, req.websocket.uri.pathname, 0);
		if (route) {
			F.$websocketcontinue_process(route, req, path);
		} else
			req.websocket.$close(4004, '404: not found');
	}
};

F.$websocketcontinue_process = function(route, req, path) {

	var socket = req.websocket;

	if (!socket.prepare(route.flags, route.protocols, route.allow, route.length)) {
		socket.$close(4001, '401: unauthorized');
		return;
	}

	var id = path + (route.flags.length ? '#' + route.flags.join('-') : '');

	if (route.isBINARY)
		socket.type = 1;
	else if (route.isJSON)
		socket.type = 3;

	if (route.isBUFFER)
		socket.typebuffer = true;

	var next = function() {

		if (req.$total_middleware)
			req.$total_middleware = null;

		if (F.connections[id]) {
			socket.upgrade(F.connections[id]);
			return;
		}

		var connection = new WebSocket(path, route.controller, id);
		connection.encodedecode = CONF.default_websocket_encodedecode === true;
		connection.route = route;
		connection.options = route.options;
		F.connections[id] = connection;
		route.onInitialize.apply(connection, framework_internal.routeParam(route.param.length ? req.split : req.path, route));
		setImmediate(next_upgrade_continue, socket, connection);
	};

	if (route.middleware)
		async_middleware(0, req, req.websocket, route.middleware, next, route.options);
	else
		next();
};

function next_upgrade_continue(socket, connection) {
	socket.upgrade(connection);
}

/**
 * Request statistics writer
 * @private
 * @param {Boolean} beg
 * @param {Boolean} isStaticFile
 * @return {Framework}
 */
F.reqstats = function(beg) {

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
global.MODEL = F.model = function(name) {
	var obj = F.models[name];
	if (obj || obj === null)
		return obj;
	var filename = U.combine(CONF.directory_models, name + '.js');
	existsSync(filename) && F.install('model', name, filename, undefined, undefined, undefined, true);
	return F.models[name] || null;
};

/**
 * Load a source code
 * @param {String} name
 * @param {Object} options Custom initial options, optional.
 * @return {Object}
 */
global.INCLUDE = global.SOURCE = F.source = function(name, options, callback) {
	var obj = F.sources[name];
	if (obj || obj === null)
		return obj;
	var filename = U.combine(CONF.directory_source, name + '.js');
	existsSync(filename) && F.install('source', name, filename, options, callback, undefined, true);
	return F.sources[name] || null;
};

/**
 * Load a source code (alias for F.source())
 * @param {String} name
 * @param {Object} options Custom initial options, optional.
 * @return {Object}
 */
F.include = function(name, options, callback) {
	return F.source(name, options, callback);
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
global.MAIL = F.mail = function(address, subject, view, model, callback, language) {

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
	else if (F.onTheme)
		controller.themeName = F.onTheme(controller);
	else
		controller.themeName = '';

	var replyTo;

	// Translation
	if (typeof(language) === 'string') {
		subject = subject.indexOf('@(') === -1 ? F.translate(language, subject) : F.translator(language, subject);
		controller.language = language;
	}

	var mail = controller.mail(address, subject, view, model, callback, replyTo);

	if (language != null)
		mail.language = language;

	return mail;
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
global.VIEW = function(name, model, layout, repository, language) {

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
	} else if (F.onTheme)
		controller.themeName = F.onTheme(controller);
	else
		controller.themeName = undefined;

	return controller.view(name, model, true);
};

F.view = function(name, model, layout, repository, language) {
	OBSOLETE('F.view()', 'Instead of F.view() use VIEW()');
	return VIEW(name, model, layout, repository, language);
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
global.VIEWCOMPILE = function(body, model, layout, repository, language) {

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

	return controller.view_compile(body, model, true);
};

F.viewCompile = function(body, model, layout, repository, language) {
	OBSOLETE('F.viewCompile()', 'Instead of F.viewCompile() use VIEWCOMPILE()');
	return VIEWCOMPILE(body, model, layout, repository, language);
};

/**
 * Load tests
 * @private
 * @param {Boolean} stop Stop framework after end.
 * @param {String Array} names Test names, optional.
 * @param {Function()} cb
 * @return {Framework}
 */
F.test = function() {
	F.isTest = true;
	F.$configure_configs('config-test', true);
	require('./test').load();
	return F;
};

/**
 * Clear temporary directory
 * @param {Function} callback
 * @param {Boolean} isInit Private argument.
 * @return {Framework}
 */
F.clear = function(callback, isInit) {

	var dir = F.path.temp();
	var plus = F.id ? 'i-' + F.id + '_' : '';

	if (isInit) {
		if (!CONF.allow_clear_temp) {
			if (F.$bundling) {
				// clears only JS and CSS files
				U.ls(dir, function(files) {
					F.unlink(files, function() {
						callback && callback();
					});
				}, function(filename, folder) {
					if (folder || (plus && !filename.substring(dir.length).startsWith(plus)))
						return false;
					if (filename.indexOf('.package') !== -1)
						return true;
					var ext = U.getExtension(filename);
					return JSFILES[ext]  || ext === 'css' || ext === 'tmp' || ext === 'upload' || ext === 'html' || ext === 'htm';
				});
			}
			return F;
		}
	}

	if (!existsSync(dir) || !F.$bundling) {
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
				(filename.indexOf('/') === -1 || filename.indexOf('.package/') !== -1) && !filename.endsWith('.jsoncache') && arr.push(files[i]);
			}

			files = arr;
			directories = directories.remove(function(name) {
				name = U.getName(name);

				if (name[0] === '~')
					return false;

				if (name.endsWith('.package'))
					return false;

				return true;
			});
		}

		F.unlink(files, () => F.rmdir(directories, callback));
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
F.unlink = F.path.unlink = function(arr, callback) {

	if (typeof(arr) === 'string')
		arr = [arr];

	if (!arr.length) {
		callback && callback();
		return F;
	}

	var filename = arr.shift();
	if (filename)
		Fs.unlink(filename, () => F.unlink(arr, callback));
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
F.rmdir = F.path.rmdir = function(arr, callback) {
	if (typeof(arr) === 'string')
		arr = [arr];

	if (!arr.length) {
		callback && callback();
		return F;
	}

	var path = arr.shift();
	if (path) {
		U.ls(path, function(files, directories) {
			directories.reverse();
			directories.push(path);
			files.wait((item, next) => Fs.unlink(item, next), function() {
				directories.wait(function(item, next) {
					Fs.rmdir(item, next);
				}, () => F.rmdir(arr, callback));
			});
		});
	} else
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
global.ENCRYPT = F.encrypt = function(value, key, isUnique) {

	if (value == null)
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

	if (CONF.default_crypto) {
		key = (key || '') + CONF.secret;

		if (key.length < 32)
			key += ''.padLeft(32 - key.length, '0');

		if (key.length > 32)
			key = key.substring(0, 32);

		if (!F.temporary.keys[key])
			F.temporary.keys[key] = Buffer.from(key);

		var cipher = Crypto.createCipheriv(CONF.default_crypto, F.temporary.keys[key], CONF.default_crypto_iv);
		CONCAT[0] = cipher.update(value);
		CONCAT[1] = cipher.final();
		return Buffer.concat(CONCAT).toString('hex');
	}

	return value.encrypt(CONF.secret + '=' + key, isUnique);
};

/**
 * Cryptography (decrypt)
 * @param {String} value
 * @param {String} key Decrypt key.
 * @param {Boolean} jsonConvert Optional, default true.
 * @return {Object or String}
 */
global.DECRYPT = F.decrypt = function(value, key, jsonConvert) {

	if (typeof(key) === 'boolean') {
		var tmp = jsonConvert;
		jsonConvert = key;
		key = tmp;
	}

	if (typeof(jsonConvert) !== 'boolean')
		jsonConvert = true;

	var response;

	if (CONF.default_crypto) {

		key = (key || '') + CONF.secret;

		if (key.length < 32)
			key += ''.padLeft(32 - key.length, '0');

		if (key.length > 32)
			key = key.substring(0, 32);

		if (!F.temporary.keys[key])
			F.temporary.keys[key] = Buffer.from(key);

		var decipher = Crypto.createDecipheriv(CONF.default_crypto, F.temporary.keys[key], CONF.default_crypto_iv);
		try {
			CONCAT[0] = decipher.update(Buffer.from(value || '', 'hex'));
			CONCAT[1] = decipher.final();
			response = Buffer.concat(CONCAT).toString('utf8');
		} catch (e) {
			response = null;
		}
	} else
		response = (value || '').decrypt(CONF.secret + '=' + key);

	return response ? (jsonConvert ? (response.isJSON() ? response.parseJSON(true) : null) : response) : null;
};

global.ENCRYPTREQ = function(req, val, key, strict) {

	if (req instanceof Controller)
		req = req.req;

	var obj = {};
	obj.ua = req.ua;
	if (strict)
		obj.ip = req.ip;
	obj.data = val;
	return F.encrypt(obj, key);
};

global.DECRYPTREQ = function(req, val, key) {
	if (!val)
		return;
	if (req instanceof Controller)
		req = req.req;
	var obj = F.decrypt(val, key || '', true);
	if (!obj || (obj.ip && obj.ip !== req.ip) || (obj.ua !== req.ua))
		return;
	return obj.data;
};

/**
 * Create hash
 * @param {String} type Type (md5, sha1, sha256, etc.)
 * @param {String} value
 * @param {String} salt Optional, default false.
 * @return {String}
 */
F.hash = function(type, value, salt) {

	OBSOLETE('F.hash()', 'Use String.prototype.hash()');

	var hash = Crypto.createHash(type);
	var plus = '';

	if (typeof(salt) === 'string')
		plus = salt;
	else if (salt !== false)
		plus = (CONF.secret || '');

	hash.update(value.toString() + plus, ENCODING);
	return hash.digest('hex');
};

/**
 * Resource reader
 * @param {String} name Optional, resource file name. Default: "default".
 * @param {String} key Resource key.
 * @return {String} String
 */

const DEFNAME = 'default';

global.RESOURCE = F.resource = function(name, key) {

	if (!key) {
		key = name;
		name = null;
	}

	if (!name)
		name = DEFNAME;

	var res = F.resources[name];
	if (res) {
		if (res.$empty && res[key] == null && name !== DEFNAME)
			return res[key] = F.resource(DEFNAME, key); // tries to load a value from "default.resource"
		return res[key] == null ? '' : res[key];
	}

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

	var filename = U.combine(CONF.directory_resources, name + '.resource');
	var empty = false;
	if (existsSync(filename))
		body += (body ? '\n' : '') + Fs.readFileSync(filename).toString(ENCODING);
	else
		empty = true;

	var obj = body.parseConfig();
	F.resources[name] = obj;
	obj.$empty = empty;
	return obj[key] == null ? name == DEFNAME ? '' : obj[key] = F.resource(DEFNAME, key) : obj[key];
};

/**
 * Translates text
 * @param {String} language A resource filename, optional.
 * @param {String} text
 * @return {String}
 */

// var obsolete_translate = false;
global.TRANSLATE = F.translate = function(language, text) {

	if (!text) {
		text = language;
		language = undefined;
	}

	if (text[0] === '#' && text[1] !== ' ')
		return F.resource(language, text.substring(1));

	/*
	var value = F.resource(language, 'T' + text.hash(true).toString(16));
	if (!value) {
		value = F.resources[language]['T' + text.hash()];
		if (value && !obsolete_translate) {
			obsolete_translate = true;
			OBSOLETE(language + '.resource', 'A resource file contains older keys with localization, please regenerate localization.');
		}
	}*/
	var value = F.resource(language, 'T' + text.hash());
	return value ? value : text;
};

/**
 * The translator for the text from the View Engine @(TEXT TO TRANSLATE)
 * @param {String} language A resource filename, optional.
 * @param {String} text
 * @return {String}
 */
global.TRANSLATOR = F.translator = function(language, text) {
	return framework_internal.parseLocalization(text, language);
};

F.$configure_sitemap = function(arr, clean) {

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
		} else if (url.endsWith('*)')) {
			// localization
			wildcard = true;
			url = url.substring(0, url.length - 2);
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

global.SITEMAP = F.sitemap = function(name, me, language) {

	if (!F.routes.sitemap)
		return me ? null : EMPTYARRAY;

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
		var wildcard = sitemap.wildcard;

		if (sitemap.localizeUrl) {
			if (sitemap.wildcard) {
				if (url[url.length - 1] !== '/')
					url += '/';
				url += '*';
			}

			url = F.translate(language, url);

			if (url.endsWith('*')) {
				url = url.substring(0, url.length - 1);
				wildcard = true;
			} else
				wildcard = false;
		}

		item.sitemap = id;
		item.id = name;
		item.formatName = sitemap.formatName;
		item.formatUrl = sitemap.formatUrl;
		item.localizeUrl = sitemap.localizeUrl;
		item.localizeName = sitemap.localizeName;
		item.name = title;
		item.url = url;
		item.wildcard = wildcard;
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

		var wildcard = sitemap.wildcard;

		if (sitemap.localizeName)
			title = F.translate(language, sitemap.name);

		if (sitemap.localizeUrl) {
			if (sitemap.wildcard) {
				if (url[url.length - 1] !== '/')
					url += '/';
				url += '*';
			}
			url = F.translate(language, url);

			if (url.endsWith('*')) {
				url = url.substring(0, url.length - 1);
				wildcard = true;
			} else
				wildcard = false;
		}

		arr.push({ sitemap: id, id: name, name: title, url: url, last: index === 0, first: sitemap.parent ? false : true, selected: index === 0, index: index, wildcard: wildcard, formatName: sitemap.formatName, formatUrl: sitemap.formatUrl, localizeName: sitemap.localizeName, localizeUrl: sitemap.localizeUrl });
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
F.sitemap_navigation = function(parent, language) {

	var key = REPOSITORY_SITEMAP + '_n_' + (parent || '') + '$' + (language || '');
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
F.sitemap_add = function (obj) {
	F.$configure_sitemap(obj instanceof Array ? obj : [obj]);
	return F;
};

F.$configure_dependencies = function(arr, callback) {

	if (!arr || typeof(arr) === 'string') {
		var filename = prepare_filename(arr || 'dependencies');
		if (existsSync(filename, true))
			arr = Fs.readFileSync(filename).toString(ENCODING).split('\n');
		else
			arr = null;
	}

	if (!arr || !arr.length)
		return F;

	OBSOLETE('/dependencies', 'File "/dependencies" are deprecated and they will be removed in v4.');

	var type;
	var options;
	var interval;
	var dependencies = [];

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
		var priority = 0;

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
				options = opt.parseJSON(true);
			url = url.substring(0, index).trim();
		}

		switch (key) {
			case 'package':
			case 'packages':
			case 'pkg':
				type = 'package';
				priority = 9;
				break;
			case 'module':
			case 'modules':
				type = 'module';
				priority = 10;
				break;
			case 'model':
			case 'models':
				type = 'model';
				priority = 8;
				break;
			case 'source':
			case 'sources':
				type = 'source';
				priority = 3;
				break;
			case 'controller':
			case 'controllers':
				type = 'controller';
				priority = 4;
				break;
			case 'view':
			case 'views':
				priority = 3;
				type = 'view';
				break;
			case 'version':
			case 'versions':
				priority = 3;
				type = 'version';
				break;
			case 'config':
			case 'configuration':
				priority = 11;
				type = 'config';
				break;
			case 'isomorphic':
			case 'isomorphics':
				priority = 6;
				type = 'isomorphic';
				break;
			case 'definition':
			case 'definitions':
				priority = 5;
				type = 'definition';
				break;
			case 'middleware':
			case 'middlewares':
				type = 'middleware';
				priority = 4;
				break;
			case 'component':
			case 'components':
				priority = 7;
				type = 'component';
				break;
		}

		if (type) {
			(function(type, url, options, interval) {
				if (interval)
					dependencies.push({ priority: priority, fn: next => F.uptodate(type, url, options, interval, next) });
				else
					dependencies.push({ priority: priority, fn: next => F.install(type, url, options, undefined, undefined, undefined, undefined, undefined, undefined, next) });
			})(type, url, options, interval);
		}
	}

	dependencies.quicksort('priority', false);
	dependencies.wait(function(item, next) {
		item.fn(next);
	}, callback);
	return F;
};

F.$configure_workflows = function(arr, clean) {

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

	OBSOLETE('/workflows', 'File "/workflows" are deprecated and they will be removed in v4.');

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

			var options = 'options||EMPTYOBJECT';
			operation = operation.trim().replace(/"/g, '\'');

			var oindex = operation.indexOf('{');
			if (oindex !== -1) {
				options = operation.substring(oindex, operation.lastIndexOf('}') + 1);
				operation = operation.replace(options, '').trim();
				options = 'options||' + options;
			}

			if (operation.endsWith('(response)')) {
				response = index;
				operation = operation.replace('(response)', '').trim();
			}

			var what = operation.split(':');
			if (what.length === 2)
				builder.push('$' + what[0].trim() + '(' + what[1].trim() + ', {0})'.format(options));
			else
				builder.push('$' + what[0] + '({0})'.format(options));

		});

		F.workflows[key] = new Function('model', 'options', 'callback', 'return model.$async(callback' + (response === -1 ? '' : ', ' + response) + ').' + builder.join('.') + ';');
	});

	return F;
};

F.$configure_versions = function(arr, clean) {

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

		if (CONF.default_root)
			key = U.join(CONF.default_root, key);

		if (filename === 'auto') {

			if (ismap)
				throw new Error('/versions: "auto" value can\'t be used with mapping');

			F.versions[key] = filename;

			(function(key, filename) {
				ON('ready', function() {
					F.consoledebug('"versions" is getting checksum of ' + key);
					makehash(key, function(hash) {

						F.consoledebug('"versions" is getting checksum of ' + key + ' (done)');

						if (hash) {
							var index = key.lastIndexOf('.');
							filename = key.substring(0, index) + '-' + hash + key.substring(index);

							F.versions[key] = filename;

							if (!F.routes.merge[key] && !F.temporary.other['merge_' + key]) {
								var index = key.indexOf('/', 1);
								var theme = index === -1 ? null : key.substring(1, index);
								if (theme) {
									if (F.themes[theme])
										key = F.themes[theme] + 'public' + key.substring(index);
									else
										key = F.path.public(key);
								} else
									key = F.path.public(key);
								F.map(filename, key);
							}

							F.temporary.views = {};
							F.temporary.other = {};
							global.$VIEWCACHE = [];
						}
					});
				});
			})(key, filename);

		} else {
			F.versions[key] = filename;
			ismap && F.map(filename, F.path.public(key));
		}
	}

	return F;
};

function makehash(url, callback, count) {
	var target = 'http://' + (F.ip === 'auto' ? '0.0.0.0' : F.ip) + ':' + F.port + url;
	U.download(target, ['get'], function(err, stream, status) {

		// Maybe F.wait()
		if (status === 503) {
			// Unhandled problem
			if (count > 60)
				callback('');
			else
				setTimeout((url, callback, count) => makehash(url, callback, (count || 1) + 1), 1000, url, callback, count);
			return;
		}

		if (status !== 200) {
			callback('');
			return;
		}

		var hash = Crypto.createHash('md5');
		hash.setEncoding('hex');
		stream.pipe(hash);
		stream.on('end', function() {
			hash.end();
			callback(hash.read().crc32(true));
		});

		stream.on('error', () => callback(''));
	});
}

F.$configure_env = function(filename) {

	var data;

	if (filename) {
		filename = prepare_filename(filename);
		if (!existsSync(filename, true))
			return F;
		data = Fs.readFileSync(filename).toString(ENCODING);
	}

	var filename2 = null;

	if (!filename) {
		filename = U.combine('/', '.env');
		filename2 = '.env-' + (DEBUG ? 'debug' : 'release');
		if (!existsSync(filename, true)) {
			F.$configure_env(filename2);
			return F;
		}
		data = Fs.readFileSync(filename).toString(ENCODING);
	}

	data = data.parseENV();
	var keys = Object.keys(data);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		if (!process.env.hasOwnProperty(key))
			process.env[key] = data[key];
	}

	filename2 && F.$configure_env(filename2);
	return F;
};

F.$configure_configs = function(arr, rewrite) {

	var type = typeof(arr);
	if (type === 'string') {
		var filename = prepare_filename(arr);
		if (!existsSync(filename, true))
			return F;
		arr = Fs.readFileSync(filename).toString(ENCODING).split('\n');
	}

	if (!arr) {

		var filenameA = U.combine('/', 'config');
		var filenameB = U.combine('/', 'config-' + (DEBUG ? 'debug' : 'release'));
		arr = [];

		// read all files from "configs" directory
		var configs = PATH.configs();
		if (existsSync(configs)) {
			var tmp = Fs.readdirSync(configs);
			for (var i = 0, length = tmp.length; i < length; i++) {
				var skip = tmp[i].match(/-(debug|release|test)$/i);
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
		process.title = 'total: ' + CONF.name.removeDiacritics().toLowerCase().replace(REG_EMPTY, '-').substring(0, 8);
		F.isVirtualDirectory = existsSync(U.combine(CONF.directory_public_virtual));
	};

	if (!(arr instanceof Array) || !arr.length) {
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
	var generated = [];

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

		if (value.substring(0, 7) === 'base64 ' && value.length > 8)
			value = Buffer.from(value.substring(7).trim(), 'base64').toString('utf8');
		else if (value.substring(0, 4) === 'hex ' && value.length > 6)
			value = Buffer.from(value.substring(4).trim(), 'hex').toString('utf8');

		if (index !== -1) {
			subtype = name.substring(index + 1, name.indexOf(')')).trim().toLowerCase();
			name = name.substring(0, index).trim();
		} else
			subtype = '';

		switch (name) {
			case 'secret':
			case 'secret-uid':
			case 'secret_uid':
				name = name.replace(REG_OLDCONF, '_');
				obj[name] = value;
				break;
			case 'default-request-length':
				OBSOLETE(name, 'You need to use "default_request_maxlength"');
				obj.default_request_maxlength = U.parseInt(value);
				break;
			case 'default-websocket-request-length':
				OBSOLETE(name, 'You need to use "default_websocket_maxlength"');
				obj.default_websocket_maxlength = U.parseInt(value);
				break;
			case 'default-maximum-file-descriptors':
				OBSOLETE(name, 'You need to use "default_maxopenfiles"');
				obj.default_maxopenfiles = U.parseInt(value);
				break;
			case 'default-cors-maxage': // old
			case 'default-request-timeout': // old
			case 'default-request-maxlength': // old
			case 'default-request-maxkeys': // old
			case 'default-websocket-maxlength': // old
			case 'default-interval-clear-cache': // old
			case 'default-interval-clear-resources': // old
			case 'default-interval-precompile-views': // old
			case 'default-interval-uptodate': // old
			case 'default-interval-websocket-ping': // old
			case 'default-interval-clear-dnscache': // old
			case 'default-dependency-timeout': // old
			case 'default-restbuilder-timeout': // old
			case 'nosql-cleaner': // old
			case 'default-errorbuilder-status': // old
			case 'default-maxopenfiles': // old
			case 'default_maxopenfiles':
			case 'default_errorbuilder_status':
			case 'default_cors_maxage':
			case 'default_request_timeout':
			case 'default_request_maxlength':
			case 'default_request_maxkeys':
			case 'default_websocket_maxlength':
			case 'default_interval_clear_cache':
			case 'default_interval_clear_resources':
			case 'default_interval_precompile_views':
			case 'default_interval_uptodate':
			case 'default_interval_websocket_ping':
			case 'default_interval_clear_dnscache':
			case 'default_dependency_timeout':
			case 'default_restbuilder_timeout':
			case 'nosql_cleaner':
				name = obsolete_config(name);
				obj[name] = U.parseInt(value);
				break;
			case 'default-image-consumption': // old
			case 'default-image-quality': // old
			case 'default_image_consumption':
			case 'default_image_quality':
				name = obsolete_config(name);
				obj[name] = U.parseInt(value.replace(/%|\s/g, ''));
				break;

			case 'static-accepts-custom': // old
			case 'static_accepts_custom':
				accepts = value.replace(REG_ACCEPTCLEANER, '').split(',');
				break;

			case 'default-root': // old
			case 'default_root':
				name = obsolete_config(name);
				if (value)
					obj[name] = U.path(value);
				break;

			case 'static-accepts': // old
			case 'static_accepts':
				name = obsolete_config(name);
				obj[name] = {};
				tmp = value.replace(REG_ACCEPTCLEANER, '').split(',');
				for (var j = 0; j < tmp.length; j++)
					obj[name][tmp[j]] = true;
				break;

			case 'mail.smtp':
			case 'mail.smtp.options':
			case 'mail.address.from':
			case 'mail.address.copy':
			case 'mail.address.bcc':
			case 'mail.address.reply':

				if (name === 'mail.address.bcc')
					tmp = 'mail_address_copy';
				else
					tmp = name.replace(/\./g, '-');

				OBSOLETE(name, 'is renamed to "' + tmp + '"');
				obj[tmp] = value;
				break;

			case 'default-cors': // old
			case 'default_cors':
				name = obsolete_config(name);
				value = value.replace(/,/g, ' ').split(' ');
				tmp = [];
				for (var j = 0; j < value.length; j++) {
					var co = (value[j] || '').trim();
					if (co) {
						co = co.toLowerCase();
						if (co.substring(0, 2) === '//') {
							tmp.push(co);
						} else
							tmp.push(co.substring(co.indexOf('/') + 2));
					}
				}
				obj[name] = tmp.length ? tmp : null;
				break;

			case 'allow-handle-static-files':
				OBSOLETE('config["allow-handle-static-files"]', 'The key has been renamed to "allow_static_files"');
				obj.allow_static_files = true;
				break;

			case 'disable-clear-temporary-directory':
				OBSOLETE('disable-clear-temporary-directory', 'You need to use "allow_clear_temp : true|false"');
				obj.allow_clear_temp = !(value.toLowerCase() === 'true' || value === '1' || value === 'on');
				break;

			case 'disable-strict-server-certificate-validation':
				OBSOLETE('disable-strict-server-certificate-validation', 'You need to use "allow_ssc_validation : true|false"');
				obj.allow_ssc_validation = !(value.toLowerCase() === 'true' || value === '1' || value === 'on');
				break;

			case 'allow-compile': // old
			case 'allow-compile-html': // old
			case 'allow-compile-script': // old
			case 'allow-compile-style': // old
			case 'allow-ssc-validation': // old
			case 'allow-debug': // old
			case 'allow-gzip': // old
			case 'allow-head': // old
			case 'allow-performance': // old
			case 'allow-static-files': // old
			case 'allow-websocket': // old
			case 'allow-websocket-compression': // old
			case 'allow-clear-temp': // old
			case 'allow-cache-snapshot': // old
			case 'allow-cache-cluster': // old
			case 'allow-custom-titles': // old
			case 'nosql-worker': // old
			case 'nosql-logger': // old
			case 'allow-filter-errors': // old
			case 'default-websocket-encodedecode': // old
			case 'allow_compile':
			case 'allow_compile_html':
			case 'allow_compile_script':
			case 'allow_compile_style':
			case 'allow_ssc_validation':
			case 'allow_debug':
			case 'allow_gzip':
			case 'allow_head':
			case 'allow_performance':
			case 'allow_static_files':
			case 'allow_websocket':
			case 'allow_websocket_compression':
			case 'allow_clear_temp':
			case 'allow_cache_snapshot':
			case 'allow_cache_cluster':
			case 'allow_filter_errors':
			case 'allow_custom_titles':
			case 'trace':
			case 'nosql_worker':
			case 'nosql_logger':
			case 'default_websocket_encodedecode':
				name = obsolete_config(name);
				obj[name] = value.toLowerCase() === 'true' || value === '1' || value === 'on';
				break;

			case 'nosql-inmemory': // old
			case 'nosql_inmemory':
				name = obsolete_config(name);
				obj[name] = typeof(value) === 'string' ? value.split(',').trim() : value instanceof Array ? value : null;
				break;

			case 'allow-compress-html':
				obj.allow_compile_html = value.toLowerCase() === 'true' || value === '1' || value === 'on';
				break;

			case 'version':
				obj[name] = value;
				break;

			case 'security.txt':
				obj[name] = value ? value.split(',').trim().join('\n') : '';
				break;

			case 'default_crypto_iv':
				obj[name] = typeof(value) === 'string' ? Buffer.from(value, 'hex') : value;
				break;
			case 'allow_workers_silent':
				obj[name] = HEADERS.workers.silent = value;
				break;

			// backward compatibility
			case 'mail-smtp': // old
			case 'mail-smtp-options': // old
			case 'mail-address-from': // old
			case 'mail-address-copy': // old
			case 'mail-address-bcc': // old
			case 'mail-address-reply': // old
			case 'default-image-converter': // old
			case 'static-url': // old
			case 'static-url-script': // old
			case 'static-url-style': // old
			case 'static-url-image': // old
			case 'static-url-video': // old
			case 'static-url-font': // old
			case 'static-url-download': // old
			case 'static-url-components': // old
			case 'default-xpoweredby': // old
			case 'default-layout': // old
			case 'default-theme': // old
			case 'default-proxy': // old
			case 'default-timezone': // old
			case 'default-response-maxage': // old
			case 'default-errorbuilder-resource-name': // old
			case 'default-errorbuilder-resource-prefix': // old
				name = obsolete_config(name);
				obj[name] = value;
				break;

			default:

				if (subtype === 'string')
					obj[name] = value;
				else if (subtype === 'number' || subtype === 'currency' || subtype === 'float' || subtype === 'double')
					obj[name] = value.isNumber(true) ? value.parseFloat2() : value.parseInt2();
				else if (subtype === 'boolean' || subtype === 'bool')
					obj[name] = (/true|on|1|enabled/i).test(value);
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
				else if (subtype === 'random')
					obj[name] = GUID(value || 10);
				else if (subtype === 'generate') {
					obj[name] = GUID(value || 10);
					generated.push(name);
				} else {
					if (value.isNumber()) {
						obj[name] = value[0] !== '0' ? U.parseInt(value) : value;
					} else if (value.isNumber(true))
						obj[name] = value.indexOf(',') === -1 && !(/^0{2,}/).test(value) ? U.parseFloat(value) : value;
					else
						obj[name] = value.isBoolean() ? value.toLowerCase() === 'true' : value;
				}
				break;
		}
	}

	// Cache for generated passwords
	if (generated && generated.length) {
		var filenameC = U.combine('/databases/', 'config{0}.json'.format(global.THREAD ? ('_' + global.THREAD) : ''));
		var gdata;

		if (existsSync(filenameC)) {
			gdata = Fs.readFileSync(filenameC).toString('utf8').parseJSON(true);
			for (var i = 0; i < generated.length; i++) {
				if (gdata[generated[i]] != null)
					obj[generated[i]] = gdata[generated[i]];
			}
		}

		tmp = {};
		for (var i = 0; i < generated.length; i++)
			tmp[generated[i]] = obj[generated[i]];

		PATH.verify('databases');
		Fs.writeFileSync(filenameC, JSON.stringify(tmp), NOOP);
	}

	U.extend(CONF, obj, rewrite);

	if (!CONF.secret_uid)
		CONF.secret_uid = (CONF.name).crc32(true).toString();

	tmp = CONF.mail_smtp_options;
	if (typeof(tmp) === 'string' && tmp) {
		tmp = new Function('return ' + tmp)();
		CONF.mail_smtp_options = tmp;
	}

	process.env.NODE_TLS_REJECT_UNAUTHORIZED = CONF.allow_ssc_validation === false ? '0' : '1';

	if (!CONF.directory_temp)
		CONF.directory_temp = '~' + U.path(Path.join(Os.tmpdir(), 'totaljs' + F.directory.hash()));

	if (!CONF.etag_version)
		CONF.etag_version = CONF.version.replace(/\.|\s/g, '');

	if (CONF.default_timezone)
		process.env.TZ = CONF.default_timezone;

	CONF.nosql_worker && framework_nosql.worker();
	CONF.nosql_inmemory && CONF.nosql_inmemory.forEach(framework_nosql.inmemory);
	accepts && accepts.length && accepts.forEach(accept => CONF.static_accepts[accept] = true);

	if (CONF.allow_performance)
		http.globalAgent.maxSockets = 9999;

	QUERYPARSEROPTIONS.maxKeys = CONF.default_request_maxkeys || 33;

	var xpowered = CONF.default_xpoweredby;

	Object.keys(HEADERS).forEach(function(key) {
		Object.keys(HEADERS[key]).forEach(function(subkey) {
			if (RELEASE && subkey === 'Cache-Control')
				HEADERS[key][subkey] = HEADERS[key][subkey].replace(/max-age=\d+/, 'max-age=' + CONF.default_response_maxage);
			if (subkey === 'X-Powered-By') {
				if (xpowered)
					HEADERS[key][subkey] = xpowered;
				else
					delete HEADERS[key][subkey];
			}
		});
	});

	done();
	EMIT('configure', CONF);
	return F;
};

function obsolete_config(name) {
	if (name.indexOf('-') === -1)
		return name;
	var n = name.replace(REG_OLDCONF, '_');
	OBSOLETE('config[\'' + name + '\']', 'Replace key "{0}" to "{1}" in your config file'.format(name, n));
	return n;
}

/**
 * Create URL: JavaScript (according to config['static-url-script'])
 * @param {String} name
 * @return {String}
 */
F.routeScript = function(name, theme) {
	OBSOLETE('F.routeScript()', 'Renamed to F.public_js');
	return F.$public(name, CONF.static_url_script, theme);
};

/**
 * Create URL: CSS (according to config['static-url-style'])
 * @param {String} name
 * @return {String}
 */
F.routeStyle = function(name, theme) {
	OBSOLETE('F.routeStyle()', 'Renamed to F.public_css');
	return F.$public(name, CONF.static_url_style, theme);
};

F.routeImage = function(name, theme) {
	OBSOLETE('F.routeImage()', 'Renamed to F.public_image');
	return F.$public(name, CONF.static_url_image, theme);
};

F.routeVideo = function(name, theme) {
	OBSOLETE('F.routeVideo()', 'Renamed to F.public_video');
	return F.$public(name, CONF.static_url_video, theme);
};

F.routeFont = function(name, theme) {
	OBSOLETE('F.routeFont()', 'Renamed to F.public_font');
	return F.$public(name, CONF.static_url_font, theme);
};

F.routeDownload = function(name, theme) {
	OBSOLETE('F.routeDownload()', 'Renamed to F.public_download');
	return F.$public(name, CONF.static_url_download, theme);
};

F.routeStatic = function(name, theme) {
	OBSOLETE('F.routeStatic()', 'Renamed to F.public');
	return F.$public(name, CONF.static_url, theme);
};

F.public_js = function(name, theme) {
	return F.$public(name, CONF.static_url_script, theme);
};

F.public_css = function(name, theme) {
	return F.$public(name, CONF.static_url_style, theme);
};

F.public_image = function(name, theme) {
	return F.$public(name, CONF.static_url_image, theme);
};

F.public_video = function(name, theme) {
	return F.$public(name, CONF.static_url_video, theme);
};

F.public_font = function(name, theme) {
	return F.$public(name, CONF.static_url_font, theme);
};

F.public_download = function(name, theme) {
	return F.$public(name, CONF.static_url_download, theme);
};

F.public = function(name, theme) {
	return F.$public(name, CONF.static_url, theme);
};

F.$public = function(name, directory, theme) {
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
			if (theme === '?') {
				theme = CONF.default_theme;
				name = name.substring(index);
			} else
				name = name.substring(index + 1);
		}
	}

	var filename;

	if (REG_ROUTESTATIC.test(name))
		filename = name;
	else if (name[0] === '/')
		filename = U.join(theme, F.$version(name, true));
	else {
		filename = U.join(theme, directory, F.$version(name, true));
		if (REG_HTTPHTTPS.test(filename) && filename[0] === '/')
			filename = filename.substring(1);
	}

	return F.temporary.other[key] = F.$version(framework_internal.preparePath(filename), true);
};

F.$version = function(name, def) {
	var tmp;

	if (F.versions)
		tmp = F.versions[name] || name;

	if (F.onVersion)
		tmp = F.onVersion(name) || name;

	return tmp === 'auto' && def ? name : (tmp || name);
};

F.$versionprepare = function(html) {
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
		html = html.replace(match[i], src.substring(0, end) + F.$version(name, true) + '"');
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
F.lookup = function(req, url, flags, membertype) {

	var isSystem = url[0] === '#';
	var subdomain = F._length_subdomain_web && req.subdomain ? req.subdomain.join('.') : null;

	if (isSystem)
		return F.routes.system[url];

	if (isSystem)
		req.path = [url];

	var key;

	// helper for 401 http status
	req.$isAuthorized = true;

	if (!isSystem) {
		key = '1' + url + '$' + membertype + req.$flags + (subdomain ? '$' + subdomain : '') + (req.$roles ? 'R' : '');
		if (F.temporary.other[key])
			return F.temporary.other[key];
	}

	for (var i = 0; i < F.routes.web.length; i++) {
		var route = F.routes.web[i];

		if (route.CUSTOM) {
			if (!route.CUSTOM(url, req, flags))
				continue;
		} else {
			if (F._length_subdomain_web && !framework_internal.routeCompareSubdomain(subdomain, route.subdomain))
				continue;
			if (route.isWILDCARD) {
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

		if (key && route.isCACHE && (req.$isAuthorized || membertype === 1))
			F.temporary.other[key] = route;

		return route;
	}

	return null;
};

F.lookupaction = function(req, url) {

	var isSystem = url[0] === '#';
	if (isSystem)
		return F.routes.system[url];

	var length = F.routes.web.length;
	for (var i = 0; i < length; i++) {

		var route = F.routes.web[i];
		if (route.method !== req.method)
			continue;

		if (route.CUSTOM) {
			if (!route.CUSTOM(url, req))
				continue;
		} else {
			if (route.isWILDCARD) {
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
				if (p === undefined || !route.regexp[route.regexpIndexer[j]].test(p)) {
					skip = true;
					break;
				}
			}
			if (skip)
				continue;
		}
		return route;
	}
};


F.lookup_websocket = function(req, url, membertype) {

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
			if (route.isWILDCARD) {
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
F.accept = function(extension, contentType) {
	if (extension[0] === '.')
		extension = extension.substring(1);
	CONF.static_accepts[extension] = true;
	contentType && U.setContentType(extension, contentType);
	return F;
};

// A temporary variable for generating Worker ID
// It's faster than Date.now()
var WORKERID = 0;

/**
 * Run worker
 * @param {String} name
 * @param {String} id Worker id, optional.
 * @param {Number} timeout Timeout, optional.
 * @param {Array} args Additional arguments, optional.
 * @return {ChildProcess}
 */
global.WORKER = F.worker = function(name, id, timeout, args, special) {

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

	var filename = name[0] === '@' ? F.path.package(name.substring(1)) : U.combine(CONF.directory_workers, name);

	if (!args)
		args = EMPTYARRAY;

	fork = Child.fork(filename[filename.length - 3] === '.' ? filename : filename + '.js', args, special ? HEADERS.workers2 : HEADERS.workers);

	if (!id)
		id = name + '_' + (WORKERID++);

	fork.__id = id;
	F.workers[id] = fork;

	fork.on('exit', function() {
		var self = this;
		self.__timeout && clearTimeout(self.__timeout);
		delete F.workers[self.__id];
		if (fork) {
			fork.removeAllListeners();
			fork = null;
		}
	});

	if (typeof(timeout) !== 'number')
		return fork;

	fork.__timeout = setTimeout(function() {
		fork && fork.kill('SIGKILL');
	}, timeout);

	return fork;
};

global.WORKER2 = F.worker2 = function(name, args, callback, timeout) {

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

	var fork = F.worker(name, null, timeout, args, true);
	if (fork.__worker2)
		return fork;

	var output = Buffer.alloc(0);

	fork.__worker2 = true;
	fork.on('error', function(e) {
		callback && callback(e, output);
		callback = null;
	});

	fork.stdout.on('data', function(data) {
		CONCAT[0] = output;
		CONCAT[1] = data;
		output = Buffer.concat(CONCAT);
	});

	fork.on('exit', function() {
		callback && callback(null, output);
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
global.PAUSESERVER = F.wait = function(name, enable) {

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

global.UPDATE = function(versions, callback, pauseserver, noarchive) {

	if (typeof(version) === 'function') {
		callback = versions;
		versions = CONF.version;
	}

	if (typeof(callback) === 'string') {
		pauseserver = callback;
		callback = null;
	}

	if (!(versions instanceof Array))
		versions = [versions];

	pauseserver && PAUSESERVER(pauseserver);

	if (F.id && F.id !== '0') {
		if (callback || pauseserver) {
			ONCE('update', function() {
				callback && callback();
				pauseserver && PAUSESERVER(pauseserver);
			});
		}
		return;
	}

	var errorbuilder = new ErrorBuilder();

	versions.wait(function(version, next) {

		var filename = PATH.updates(version + '.js');
		var response;

		try {
			response = Fs.readFileSync(filename);
		} catch (e) {
			next();
			return;
		}

		var opt = {};
		opt.version = version;
		opt.callback = function(err) {
			err && errorbuilder.push(err);

			if (!noarchive)
				Fs.renameSync(filename, filename + '_bk');

			next();
		};

		opt.done = function(arg) {
			return function(err) {
				if (err) {
					opt.callback(err);
				} else if (arg)
					opt.callback();
				else
					opt.callback();
			};
		};

		opt.success = function() {
			opt.callback(null);
		};

		opt.invalid = function(err) {
			opt.callback(err);
		};

		var fn = new Function('$', response);
		fn(opt, response.toString('utf8'));

	}, function() {
		var err = errorbuilder.length ? errorbuilder : null;
		callback && callback(err);
		if (F.isCluster && F.id && F.id !== '0')
			process.send('total:update');
		pauseserver && PAUSESERVER(pauseserver);
		EMIT('update', err);
	});
};

// =================================================================================
// Framework route
// =================================================================================

function FrameworkRoute() {
	this.route = {};
}

FrameworkRoute.prototype = {
	get id() {
		return this.route.id;
	},
	set id(value) {
		this.route.id = value;
	},
	get description() {
		return this.route.description;
	},
	set description(value) {
		this.route.description = value;
	},
	get maxlength() {
		return this.route.length;
	},
	set maxlength(value) {
		this.route.length = value;
	},
	get options() {
		return this.route.options;
	},
	set options(value) {
		this.route.options = value;
	},
	get url() {
		return this.route.urlraw;
	},
	get flags() {
		return this.route.flags || EMPTYARRAY;
	},
	set groups(value) {
		this.route.groups = value;
	},
	get groups() {
		return this.route.groups;
	}
};

const FrameworkRouteProto = FrameworkRoute.prototype;

FrameworkRouteProto.make = function(fn) {
	fn && fn.call(this, this);
	return this;
};

FrameworkRouteProto.setId = function(value) {
	this.route.id = value;
	return this;
};

FrameworkRouteProto.setDecription = function(value) {
	this.route.description = value;
	return this;
};

FrameworkRouteProto.setTimeout = function(value) {
	this.route.timeout = value;
	return this;
};

FrameworkRouteProto.setMaxLength = function(value) {
	this.route.length = value;
	return this;
};

FrameworkRouteProto.setOptions = function(value) {
	this.route.options = value;
	return this;
};

// =================================================================================
// Framework path
// =================================================================================

function FrameworkPath() {}
const FrameworkPathProto = FrameworkPath.prototype;

FrameworkPathProto.verify = function(name) {
	var prop = '$directory-' + name;
	if (F.temporary.path[prop])
		return F;
	var directory = CONF['directory_' + name] || name;
	var dir = U.combine(directory);
	try {
		!existsSync(dir) && Fs.mkdirSync(dir);
	} catch (e) {}
	F.temporary.path[prop] = true;
	return F;
};

FrameworkPathProto.mkdir = function(p, cache) {

	var key = '$directory-' + p;

	if (cache && F.temporary.path[key])
		return F;

	F.temporary.path[key] = true;

	var is = F.isWindows;
	var s = '';

	if (p[0] === '/') {
		s = is ? '\\' : '/';
		p = p.substring(1);
	}

	var l = p.length - 1;
	var beg = 0;

	if (is) {
		if (p[l] === '\\')
			p = p.substring(0, l);

		if (p[1] === ':')
			beg = 1;

	} else {
		if (p[l] === '/')
			p = p.substring(0, l);
	}

	if (existsSync(p))
		return F;

	var arr = is ? p.replace(/\//g, '\\').split('\\') : p.split('/');
	var directory = s;

	for (var i = 0, length = arr.length; i < length; i++) {
		var name = arr[i];
		if (is)
			directory += (i && directory ? '\\' : '') + name;
		else
			directory += (i && directory ? '/' : '') + name;

		if (i >= beg && !existsSync(directory))
			Fs.mkdirSync(directory);
	}

	return F;
};

FrameworkPathProto.exists = function(path, callback) {
	Fs.lstat(path, (err, stats) => callback(err ? false : true, stats ? stats.size : 0, stats ? stats.isFile() : false));
	return F;
};

FrameworkPathProto.public = function(filename) {
	return U.combine(CONF.directory_public, filename);
};

FrameworkPathProto.public_cache = function(filename) {
	var key = 'public_' + filename;
	var item = F.temporary.other[key];
	return item ? item : F.temporary.other[key] = U.combine(CONF.directory_public, filename);
};

FrameworkPathProto.private = function(filename) {
	return U.combine(CONF.directory_private, filename);
};

FrameworkPathProto.isomorphic = function(filename) {
	return U.combine(CONF.directory_isomorphic, filename);
};

FrameworkPathProto.configs = function(filename) {
	return U.combine(CONF.directory_configs, filename);
};

FrameworkPathProto.virtual = function(filename) {
	return U.combine(CONF.directory_public_virtual, filename);
};

FrameworkPathProto.logs = function(filename) {
	this.verify('logs');
	return U.combine(CONF.directory_logs, filename);
};

FrameworkPathProto.models = function(filename) {
	return U.combine(CONF.directory_models, filename);
};

FrameworkPathProto.temp = function(filename) {
	this.verify('temp');
	return U.combine(CONF.directory_temp, filename);
};

FrameworkPathProto.temporary = function(filename) {
	return this.temp(filename);
};

FrameworkPathProto.views = function(filename) {
	return U.combine(CONF.directory_views, filename);
};

FrameworkPathProto.updates = function(filename) {
	return U.combine(CONF.directory_updates, filename);
};

FrameworkPathProto.workers = function(filename) {
	return U.combine(CONF.directory_workers, filename);
};

FrameworkPathProto.databases = function(filename) {
	this.verify('databases');
	return U.combine(CONF.directory_databases, filename);
};

FrameworkPathProto.modules = function(filename) {
	return U.combine(CONF.directory_modules, filename);
};

FrameworkPathProto.schemas = function(filename) {
	return U.combine(CONF.directory_schemas, filename);
};

FrameworkPathProto.operations = function(filename) {
	return U.combine(CONF.directory_operations, filename);
};

FrameworkPathProto.tasks = function(filename) {
	return U.combine(CONF.directory_tasks, filename);
};

FrameworkPathProto.controllers = function(filename) {
	return U.combine(CONF.directory_controllers, filename);
};

FrameworkPathProto.definitions = function(filename) {
	return U.combine(CONF.directory_definitions, filename);
};

FrameworkPathProto.tests = function(filename) {
	return U.combine(CONF.directory_tests, filename);
};

FrameworkPathProto.resources = function(filename) {
	return U.combine(CONF.directory_resources, filename);
};

FrameworkPathProto.services = function(filename) {
	return U.combine(CONF.directory_services, filename);
};

FrameworkPathProto.packages = function(filename) {
	return U.combine(CONF.directory_packages, filename);
};

FrameworkPathProto.themes = function(filename) {
	return U.combine(CONF.directory_themes, filename);
};

FrameworkPathProto.components = function(filename) {
	return U.combine(CONF.directory_components, filename);
};

FrameworkPathProto.root = function(filename) {
	var p = Path.join(directory, filename || '');
	return F.isWindows ? p.replace(/\\/g, '/') : p;
};

FrameworkPathProto.package = function(name, filename) {

	if (filename === undefined) {
		var index = name.indexOf('/');
		if (index !== -1) {
			filename = name.substring(index + 1);
			name = name.substring(0, index);
		}
	}

	var tmp = CONF.directory_temp;
	var p = tmp[0] === '~' ? Path.join(tmp.substring(1), name + '.package', filename || '') : Path.join(directory, tmp, name + '.package', filename || '');
	return F.isWindows ? p.replace(REG_WINDOWSPATH, '/') : p;
};

// =================================================================================
// Cache declaration
// =================================================================================

function FrameworkCache() {
	this.items = {};
	this.count = 1;
	this.interval;
	this.$sync = true;
}

const FrameworkCacheProto = FrameworkCache.prototype;

FrameworkCacheProto.init = function(notimer) {
	var self = this;

	if (!notimer)
		self.init_timer();

	if (CONF.allow_cache_snapshot)
		self.load(() => self.loadpersistent());
	else
		self.loadpersistent();

	return self;
};

FrameworkCacheProto.init_timer = function() {
	var self = this;
	self.interval && clearInterval(self.interval);
	self.interval = setInterval(() => F.cache.recycle(), 1000 * 60);
	return self;
};

FrameworkCacheProto.save = function() {
	Fs.writeFile(F.path.temp((F.id ? 'i-' + F.id + '_' : '') + 'framework_cachesnapshot.jsoncache'), JSON.stringify(this.items), NOOP);
	return this;
};

FrameworkCacheProto.load = function(callback) {
	var self = this;
	Fs.readFile(F.path.temp((F.id ? 'i-' + F.id + '_' : '') + 'framework_cachesnapshot.jsoncache'), function(err, data) {
		if (!err) {
			try {
				data = JSON.parse(data.toString('utf8'), (key, value) => typeof(value) === 'string' && value.isJSONDate() ? new Date(value) : value);
				self.items = data;
			} catch (e) {}
		}
		callback && callback();
	});
	return self;
};

FrameworkCacheProto.savepersistent = function() {
	setTimeout2('framework_cachepersist', function(self) {
		var keys = Object.keys(self.items);
		var obj = {};

		for (var i = 0, length = keys.length; i < length; i++) {
			var key = keys[i];
			var item = self.items[key];
			if (item && item.persist)
				obj[key] = item;
		}

		Fs.writeFile(F.path.temp((F.id ? 'i-' + F.id + '_' : '') + 'framework_cachepersist.jsoncache'), JSON.stringify(obj), NOOP);
	}, 1000, 50, this);
	return this;
};

FrameworkCacheProto.loadpersistent = function(callback) {
	var self = this;
	Fs.readFile(F.path.temp((F.id ? 'i-' + F.id + '_' : '') + 'framework_cachepersist.jsoncache'), function(err, data) {
		if (!err) {
			try {
				data = JSON.parse(data.toString('utf8'), (key, value) => typeof(value) === 'string' && value.isJSONDate() ? new Date(value) : value);
				var keys = Object.keys(data);
				for (var i = 0, length = keys.length; i < length; i++) {
					var key = keys[i];
					var item = data[key];
					if (item.expire >= NOW)
						self.items[key] = item;
				}
			} catch (e) {}
		}
		callback && callback();
	});
	return self;
};

FrameworkCacheProto.stop = function() {
	clearInterval(this.interval);
	return this;
};

FrameworkCacheProto.clear = function() {
	this.items = {};
	F.isCluster && CONF.allow_cache_cluster && process.send(CLUSTER_CACHE_CLEAR);
	this.savepersistent();
	return this;
};

FrameworkCacheProto.recycle = function() {

	var items = this.items;
	var persistent = false;

	NOW = new Date();
	this.count++;

	for (var o in items) {
		var value = items[o];
		if (!value)
			delete items[o];
		else if (value.expire < NOW) {
			if (value.persist)
				persistent = true;
			F.$events['cache-expire'] && EMIT('cache-expire', o, value.value);
			F.$events.cache_expired && EMIT('cache_expired', o, value.value);
			delete items[o];
		}
	}

	persistent && this.savepersistent();
	CONF.allow_cache_snapshot && this.save();
	F.service(this.count);
	CONF.allow_stats_snapshot && F.snapshotstats && F.snapshotstats();
	F.temporary.service.usage = 0;
	measure_usage();
	return this;
};

FrameworkCacheProto.set2 = function(name, value, expire) {
	return this.set(name, value, expire, true);
};

FrameworkCacheProto.set = FrameworkCacheProto.add = function(name, value, expire, persist) {

	if (F.isCluster && CONF.allow_cache_cluster && this.$sync) {
		CLUSTER_CACHE_SET.name = name;
		CLUSTER_CACHE_SET.value = value;
		CLUSTER_CACHE_SET.expire = expire;
		process.send(CLUSTER_CACHE_SET);
	}

	switch (typeof(expire)) {
		case 'string':
			expire = expire.parseDateExpiration();
			break;
		case 'undefined':
			expire = NOW.add('m', 5);
			break;
	}

	var obj = { value: value, expire: expire };

	if (persist) {
		obj.persist = true;
		this.savepersistent();
	}

	this.items[name] = obj;
	F.$events['cache-set'] && EMIT('cache-set', name, value, expire, this.$sync);
	F.$events.cache_set && EMIT('cache_set', name, value, expire, this.$sync);
	return value;
};

FrameworkCacheProto.read = FrameworkCacheProto.get = function(key, def) {

	var value = this.items[key];
	if (!value)
		return def;

	NOW = new Date();

	if (value.expire < NOW) {
		this.items[key] = undefined;
		F.$events['cache-expire'] && EMIT('cache-expire', key, value.value);
		F.$events.cache_expired && EMIT('cache_expired', key, value.value);
		return def;
	}

	return value.value;
};

FrameworkCacheProto.read2 = FrameworkCacheProto.get2 = function(key, def) {
	var value = this.items[key];

	if (!value)
		return def;

	if (value.expire < NOW) {
		this.items[key] = undefined;
		F.$events['cache-expire'] && EMIT('cache-expire', key, value.value);
		F.$events.cache_expired && EMIT('cache_expired', key, value.value);
		return def;
	}

	return value.value;
};

FrameworkCacheProto.setExpire = function(name, expire) {
	var obj = this.items[name];
	if (obj)
		obj.expire = typeof(expire) === 'string' ? expire.parseDateExpiration() : expire;
	return this;
};

FrameworkCacheProto.remove = function(name) {
	var value = this.items[name];

	if (value) {
		this.items[name].persist && this.savepersistent();
		this.items[name] = undefined;
	}

	if (F.isCluster && CONF.allow_cache_cluster && this.$sync) {
		CLUSTER_CACHE_REMOVE.name = name;
		process.send(CLUSTER_CACHE_REMOVE);
	}

	return value;
};

FrameworkCacheProto.removeAll = function(search) {
	var count = 0;
	var isReg = typeof(search) === 'object';

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

	if (F.isCluster && CONF.allow_cache_cluster && this.$sync) {
		CLUSTER_CACHE_REMOVEALL.search = search;
		process.send(CLUSTER_CACHE_REMOVEALL);
	}

	return count;
};

FrameworkCacheProto.fn = function(name, fnCache, fnCallback, options) {

	var self = this;
	var value = self.read2(name);

	if (value) {
		fnCallback && fnCallback(value, true, options);
		return self;
	}

	fnCache(function(value, expire) {
		self.add(name, value, expire);
		fnCallback && fnCallback(value, false, options);
	}, options);

	return self;
};

function subscribe_timeout(req) {
	req.controller && req.controller.precache && req.controller.precache(null, null, null);
	req.$total_cancel();
}

function subscribe_timeout_middleware(req) {
	if (req.$total_middleware)
		req.$total_middleware = null;
	req.$total_execute2();
}

function subscribe_validate_callback(req, code) {
	req.$total_execute(code);
}

/**
 * FrameworkController
 * @class
 * @param {String} name Controller name.
 * @param {Request} req
 * @param {Response} res
 * @param {FrameworkSubscribe} subscribe
 */
function Controller(name, req, res, currentView) {

	this.name = name;
	// this.exception;

	// Sets the default language
	if (req) {
		this.language = req.$language;
		this.req = req;
		this.route = req.$total_route;
	} else
		this.req = EMPTYREQUEST;

	// controller.type === 0 - classic
	// controller.type === 1 - server sent events
	// this.type = 0;

	// this.layoutName =CONF.default_layout;
	// this.themeName =CONF.default_theme;
	// this.status = 200;

	// this.isLayout = false;
	// this.isCanceled = false;
	// this.isTimeout = false;
	// this.isTransfer = false;

	this.isConnected = true;
	this.isController = true;

	// render output
	// this.output = null;
	// this.outputPartial = null;
	// this.$model = null;

	this._currentView = currentView;

	if (res) {
		this.res = res;
		this.req.controller = this.res.controller = this;
	} else
		this.res = EMPTYOBJECT;
}

Controller.prototype = {

	get breadcrumb() {
		return this.repository[REPOSITORY_SITEMAP];
	},

	get repository() {
		if (this.$repository)
			return this.$repository;
		else
			return this.$repository ? this.$repository : (this.$repository = {});
	},

	set repository(val) {
		this.$repository = val;
	},

	get schema() {
		return this.route.schema ? this.route.schema[0] === 'default' ? this.route.schema[1] : this.route.schema.join('/') : '';
	},

	get workflow() {
		return this.route.schema_workflow;
	},

	get sseID() {
		return this.req.headers['last-event-id'] || null;
	},

	get options() {
		return this.route.options;
	},

	get split() {
		return this.req.split;
	},

	get flags() {
		return this.route.flags;
	},

	get path() {
		OBSOLETE('controller.path', 'Use: PATH');
		return F.path;
	},

	get query() {
		return this.req.query;
	},

	set query(val) {
		this.req.query = val;
	},

	get body() {
		return this.req.body;
	},

	set body(val) {
		this.req.body = val;
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

	set xhr(val) {
		this.req.xhr = val;
	},

	get url() {
		return U.path(this.req.uri.pathname);
	},

	get uri() {
		return this.req.uri;
	},

	get headers() {
		return this.req.headers;
	},

	get cache() {
		OBSOLETE('controller.cache', 'Use: F.cache or CACHE()');
		return F.cache;
	},

	get config() {
		OBSOLETE('controller.config', 'Use: CONF');
		return CONF;
	},

	get controllers() {
		OBSOLETE('controller.controllers', 'This property will be removed in v4.');
		return F.controllers;
	},

	get isTest() {
		OBSOLETE('controller.isTest', 'Use: F.isTest');
		return this.req.headers['x-assertion-testing'] === '1';
	},

	get isSecure() {
		OBSOLETE('controller.isSecure', 'Use: controller.secured');
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

	set mobile(val) {
		this.req.mobile = val;
	},

	get robot() {
		return this.req.robot;
	},

	get sessionid() {
		return this.req.sessionid;
	},

	set sessionid(val) {
		this.req.sessionid = val;
	},

	get viewname() {
		var name = this.req.path[this.req.path.length - 1];
		return !name || name === '/' ? 'index' : name;
	},

	get sitemapid() {
		return this.$sitemapid || this.route.sitemap;
	},

	get params() {
		if (this.$params)
			return this.$params;
		var route = this.route;
		var names = route.paramnames;
		if (names) {
			var obj = {};
			for (var i = 0; i < names.length; i++)
				obj[names[i]] = this.req.split[route.param[i]];
			this.$params = obj;
			return obj;
		} else {
			// Because in some cases are overwritten
			return this.$params = {};
		}
	},

	set params(val) {
		this.$params = val;
	},

	get ua() {
		return this.req ? this.req.ua : null;
	}
};

// ======================================================
// PROTOTYPES
// ======================================================

const ControllerProto = Controller.prototype;

ControllerProto.$get = ControllerProto.$read = function(helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = null;
	}

	this.getSchema().get(helper, callback, this);
	return this;
};

ControllerProto.$query = function(helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = null;
	}

	this.getSchema().query(helper, callback, this);
	return this;
};

ControllerProto.$save = function(helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = null;
	}

	var self = this;
	if (self.body && self.body.$$schema) {
		self.body.$$controller = self;
		self.body.$save(helper, callback);
	} else {
		var model = self.getSchema().default();
		model.$$controller = self;
		model.$save(helper, callback);
	}
	return self;
};

ControllerProto.$insert = function(helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = null;
	}

	var self = this;
	if (self.body && self.body.$$schema) {
		self.body.$$controller = self;
		self.body.$insert(helper, callback);
	} else {
		var model = self.getSchema().default();
		model.$$controller = self;
		model.$insert(helper, callback);
	}
	return self;
};

ControllerProto.$update = function(helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = null;
	}

	var self = this;
	if (self.body && self.body.$$schema) {
		self.body.$$controller = self;
		self.body.$update(helper, callback);
	} else {
		var model = self.getSchema().default();
		model.$$controller = self;
		model.$update(helper, callback);
	}
	return self;
};

ControllerProto.$patch = function(helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = null;
	}

	var self = this;
	if (self.body && self.body.$$schema) {
		self.body.$$controller = self;
		self.body.$patch(helper, callback);
	} else {
		var model = self.getSchema().default();
		model.$$controller = self;
		model.$patch(helper, callback);
	}
	return self;
};

ControllerProto.$remove = function(helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = null;
	}

	var self = this;
	self.getSchema().remove(helper, callback, self);
	return this;
};

ControllerProto.$workflow = function(name, helper, callback) {
	var self = this;

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = null;
	}

	if (self.body && self.body.$$schema) {
		self.body.$$controller = self;
		self.body.$workflow(name, helper, callback);
	} else
		self.getSchema().workflow2(name, helper, callback, self);
	return self;
};

ControllerProto.$workflow2 = function(name, helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = null;
	}

	var self = this;
	self.getSchema().workflow2(name, helper, callback, self);
	return self;
};

ControllerProto.$hook = function(name, helper, callback) {
	var self = this;

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = EMPTYOBJECT;
	}

	if (self.body && self.body.$$schema) {
		self.body.$$controller = self;
		self.body.$hook(name, helper, callback);
	} else
		self.getSchema().hook2(name, helper, callback, self);

	return self;
};

ControllerProto.$hook2 = function(name, helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = EMPTYOBJECT;
	}

	var self = this;
	self.getSchema().hook2(name, helper, callback, self);
	return self;
};

ControllerProto.$transform = function(name, helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = EMPTYOBJECT;
	}

	var self = this;
	if (self.body && self.body.$$schema) {
		self.body.$$controller = self;
		self.body.$transform(name, helper, callback);
	} else
		self.getSchema().transform2(name, helper, callback, self);
	return self;
};

ControllerProto.$transform2 = function(name, helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = EMPTYOBJECT;
	}

	var self = this;
	self.getSchema().transform2(name, helper, callback, self);
	return self;
};

ControllerProto.$operation = function(name, helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = EMPTYOBJECT;
	}

	var self = this;
	if (self.body && self.body.$$schema) {
		self.body.$$controller = self;
		self.body.$operation(name, helper, callback);
	} else
		self.getSchema().operation2(name, helper, callback, self);
	return self;
};

ControllerProto.operation = function(name, value, callback, options) {
	OPERATION(name, value, callback, options, this);
	return this;
};

ControllerProto.tasks = function() {
	var tb = new TaskBuilder(this);
	// tb.callback(this.callback());
	return tb;
};

ControllerProto.$operation2 = function(name, helper, callback) {

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = EMPTYOBJECT;
	}

	var self = this;
	self.getSchema().operation2(name, helper, callback, self);
	return self;
};

ControllerProto.$exec = function(name, helper, callback) {
	var self = this;

	if (callback == null && typeof(helper) === 'function') {
		callback = helper;
		helper = EMPTYOBJECT;
	}

	if (callback == null)
		callback = self.callback();

	if (self.body && self.body.$$schema) {
		self.body.$$controller = self;
		self.body.$exec(name, helper, callback);
		return self;
	}

	var tmp = self.getSchema().create();
	tmp.$$controller = self;
	tmp.$exec(name, helper, callback);
	return self;
};

ControllerProto.$async = function(callback, index) {
	var self = this;

	if (self.body && self.body.$$schema) {
		self.body.$$controller = self;
		return self.body.$async(callback, index);
	}

	var model = self.getSchema().default();
	model.$$controller = self;
	return model.$async(callback, index);
};

ControllerProto.getSchema = function() {
	var route = this.route;
	if (!route.schema || !route.schema[1])
		throw new Error('The controller\'s route does not define any schema.');
	var schema = route.isDYNAMICSCHEMA ? framework_builders.findschema(route.schema[0] + '/' + this.params[route.schema[1]]) : GETSCHEMA(route.schema[0], route.schema[1]);
	if (schema)
		return schema;
	throw new Error('Schema "{0}" does not exist.'.format(route.schema[1]));
};

/**
 * Renders component
 * @param {String} name A component name
 * @param {Object} settings Optional, settings.
 * @model {Object} settings Optional, model for the component.
 * @return {String}
 */
ControllerProto.component = function(name, settings, model) {
	var filename = F.components.views[name];
	if (filename) {
		var self = this;
		var generator = framework_internal.viewEngine(name, filename, self, true);
		if (generator) {
			if (generator.components.length) {
				if (!self.repository[REPOSITORY_COMPONENTS])
					self.repository[REPOSITORY_COMPONENTS] = {};
				for (var i = 0; i < generator.components.length; i++)
					self.repository[REPOSITORY_COMPONENTS][generator.components[i]] = 1;
			}
			return generator.call(self, self, self.repository, model || self.$model, self.session, self.query, self.body, self.url, F.global, F.helpers, self.user, CONF, F.functions, 0, self.outputPartial, self.req.files, self.req.mobile, settings || EMPTYOBJECT);
		}
	}
	return '';
};

ControllerProto.$components = function(group, settings) {

	if (group) {
		var keys = Object.keys(F.components.instances);
		var output = [];
		for (var i = 0, length = keys.length; i < length; i++) {
			var component = F.components.instances[keys[i]];
			if (component.group === group) {
				if (component.render) {
					!this.$viewasync && (this.$viewasync = []);
					$VIEWASYNC++;
					var name = '@{-' + $VIEWASYNC + '-}';
					this.$viewasync.push({ replace: name, name: component.name, settings: settings });
					output.push(name);
				} else {
					var tmp = this.component(keys[i], settings);
					tmp && output.push(tmp);
				}
			}
		}
		return output.join('\n');
	}

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
ControllerProto.cookie = function(name, value, expires, options) {
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
ControllerProto.clear = function() {
	var self = this;
	self.req.clear();
	return self;
};

/**
 * Translates text
 * @param {String} text
 * @return {String}
 */
ControllerProto.translate = function(language, text) {

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
ControllerProto.middleware = function(names, options, callback) {

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

	if (self.req.$total_middleware)
		self.req.$total_middleware = null;

	async_middleware(0, self.req, self.res, names, () => callback && callback(), options, self);
	return self;
};

ControllerProto.nocache = function() {
	this.req.nocache();
	return this;
};

/**
 * Creates a pipe between the current request and target URL
 * @param {String} url
 * @param {Object} headers Optional, custom headers.
 * @param {Function(err)} callback Optional.
 * @return {Controller}
 */
ControllerProto.pipe = function(url, headers, callback) {
	this.res.proxy(url, headers, null, callback);
	return this;
};

ControllerProto.encrypt = function() {
	return F.encrypt.apply(framework, arguments);
};

ControllerProto.decrypt = function() {
	return F.decrypt.apply(framework, arguments);
};

/**
 * Creates a hash (alias for F.hash())
 * @return {Controller}
 */
ControllerProto.hash = function() {
	OBSOLETE('controller.hash()', 'Use String.prototype.hash()');
	return F.hash.apply(framework, arguments);
};

/**
 * Sets a response header
 * @param {String} name
 * @param {String} value
 * @return {Controller}
 */
ControllerProto.header = function(name, value) {
	this.res.setHeader(name, value);
	return this;
};

/**
 * Gets a hostname
 * @param {String} path
 * @return {Controller}
 */
ControllerProto.host = function(path) {
	return this.req.hostname(path);
};

ControllerProto.hostname = function(path) {
	return this.req.hostname(path);
};

ControllerProto.resource = function(name, key) {
	return F.resource(name, key);
};

/**
 * Error caller
 * @param {Error/String} err
 * @return {Controller/Function}
 */
ControllerProto.error = function(err) {
	var self = this;

	// Custom errors
	if (err instanceof ErrorBuilder) {
		self.content(err);
		return self;
	}

	var result = F.error(typeof(err) === 'string' ? new Error(err) : err, self.name, self.uri);
	if (err === undefined)
		return result;

	self.req.$total_exception = err;
	self.exception = err;
	return self;
};

ControllerProto.invalid = function(status) {

	var self = this;

	if (status instanceof ErrorBuilder) {
		setImmediate(next_controller_invalid, self, status);
		return status;
	}

	var type = typeof(status);

	if (type === 'number')
		self.status = status;

	var builder = new ErrorBuilder();

	if (type === 'string')
		builder.push(status);
	else if (status instanceof Error)
		builder.push(status);

	setImmediate(next_controller_invalid, self, builder);
	return builder;
};

function next_controller_invalid(self, builder) {
	self.content(builder);
}

/**
 * Registers a new problem
 * @param {String} message
 * @return {Controller}
 */
ControllerProto.wtf = ControllerProto.problem = function(message) {
	F.problem(message, this.name, this.uri, this.ip);
	return this;
};

/**
 * Registers a new change
 * @param {String} message
 * @return {Controller}
 */
ControllerProto.change = function(message) {
	F.change(message, this.name, this.uri, this.ip);
	return this;
};

/**
 * Trace
 * @param {String} message
 * @return {Controller}
 */
ControllerProto.trace = function(message) {
	F.trace(message, this.name, this.uri, this.ip);
	return this;
};

/**
 * Transfer to new route
 * @param {String} url Relative URL.
 * @param {String Array} flags Route flags (optional).
 * @return {Boolean}
 */
ControllerProto.transfer = function(url, flags) {

	var self = this;
	var length = F.routes.web.length;
	var path = framework_internal.routeSplit(url.trim());

	var isSystem = url[0] === '#';
	var noFlag = !flags || flags.length === 0 ? true : false;
	var selected = null;

	self.req.$isAuthorized = true;

	for (var i = 0; i < length; i++) {

		var route = F.routes.web[i];

		if (route.isWILDCARD) {
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
	self.req.$total_transfer = true;
	self.req.$total_success();

	// Because of dynamic params
	// Hidden variable
	self.req.$path = framework_internal.routeSplit(url, true);

	self.route = self.req.$total_route = selected;
	self.req.$total_execute(404);
	return true;
};

ControllerProto.cancel = function() {
	this.isCanceled = true;
	return this;
};

ControllerProto.log = function() {
	F.log.apply(F, arguments);
	return this;
};

ControllerProto.logger = function() {
	F.logger.apply(F, arguments);
	return this;
};

ControllerProto.meta = function() {
	var self = this;

	if (arguments[0])
		self.repository[REPOSITORY_META_TITLE] = arguments[0].encode();

	if (arguments[1])
		self.repository[REPOSITORY_META_DESCRIPTION] = arguments[1].encode();

	if (arguments[2] && arguments[2].length)
		self.repository[REPOSITORY_META_KEYWORDS] = (arguments[2] instanceof Array ? arguments[2].join(', ') : arguments[2]);

	if (arguments[3])
		self.repository[REPOSITORY_META_IMAGE] = arguments[3];

	return self;
};

ControllerProto.$dns = function() {

	var builder = '';
	var length = arguments.length;

	for (var i = 0; i < length; i++)
		builder += '<link rel="dns-prefetch" href="' + this._preparehostname(arguments[i]) + '" />';

	this.head(builder);
	return '';
};

ControllerProto.$prefetch = function() {

	var builder = '';
	var length = arguments.length;

	for (var i = 0; i < length; i++)
		builder += '<link rel="prefetch" href="' + this._preparehostname(arguments[i]) + '" />';

	this.head(builder);
	return '';
};

ControllerProto.$prerender = function() {

	var builder = '';
	var length = arguments.length;

	for (var i = 0; i < length; i++)
		builder += '<link rel="prerender" href="' + this._preparehostname(arguments[i]) + '" />';

	this.head(builder);
	return '';
};

ControllerProto.$next = function(value) {
	this.head('<link rel="next" href="' + this._preparehostname(value) + '" />');
	return '';
};

ControllerProto.$prev = function(value) {
	this.head('<link rel="prev" href="' + this._preparehostname(value) + '" />');
	return '';
};

ControllerProto.$canonical = function(value) {
	this.head('<link rel="canonical" href="' + this._preparehostname(value) + '" />');
	return '';
};

ControllerProto.$meta = function() {
	var self = this;

	if (arguments.length) {
		self.meta.apply(self, arguments);
		return '';
	}

	F.$events['controller-render-meta'] && EMIT('controller-render-meta', self);
	F.$events.controller_render_meta && EMIT('controller_render_meta', self);
	var repository = self.repository;
	return F.onMeta.call(self, repository[REPOSITORY_META_TITLE], repository[REPOSITORY_META_DESCRIPTION], repository[REPOSITORY_META_KEYWORDS], repository[REPOSITORY_META_IMAGE]);
};

ControllerProto.title = function(value) {
	this.$title(value);
	return this;
};

ControllerProto.description = function(value) {
	this.$description(value);
	return this;
};

ControllerProto.keywords = function(value) {
	this.$keywords(value);
	return this;
};

ControllerProto.author = function(value) {
	this.$author(value);
	return this;
};

ControllerProto.$title = function(value) {
	if (value)
		this.repository[REPOSITORY_META_TITLE] = value.encode();
	return '';
};

ControllerProto.$title2 = function(value) {
	var current = this.repository[REPOSITORY_META_TITLE];
	if (value)
		this.repository[REPOSITORY_META_TITLE] = (current ? current : '') + value.encode();
	return '';
};

ControllerProto.$description = function(value) {
	if (value)
		this.repository[REPOSITORY_META_DESCRIPTION] = value.encode();
	return '';
};

ControllerProto.$keywords = function(value) {
	if (value && value.length)
		this.repository[REPOSITORY_META_KEYWORDS] = (value instanceof Array ? value.join(', ') : value).encode();
	return '';
};

ControllerProto.$author = function(value) {
	if (value)
		this.repository[REPOSITORY_META_AUTHOR] = value.encode();
	return '';
};

ControllerProto.sitemap_navigation = function(name, language) {
	return F.sitemap_navigation(name || this.sitemapid, language || this.language);
};

ControllerProto.sitemap_url = function(name, a, b, c, d, e, f) {
	var item = F.sitemap(name || this.sitemapid, true, this.language);
	return item ? item.url.format(a, b, c, d, e, f) : '';
};

ControllerProto.sitemap_name = function(name, a, b, c, d, e, f) {
	var item = F.sitemap(name || this.sitemapid, true, this.language);
	return item ? item.name.format(a, b, c, d, e, f) : '';
};

ControllerProto.sitemap_url2 = function(language, name, a, b, c, d, e, f) {
	var item = F.sitemap(name || this.sitemapid, true, language);
	return item ? item.url.format(a, b, c, d, e, f) : '';
};

ControllerProto.sitemap_name2 = function(language, name, a, b, c, d, e, f) {
	var item = F.sitemap(name || this.sitemapid, true, language);
	return item ? item.name.format(a, b, c, d, e, f) : '';
};

ControllerProto.sitemap_add = function(parent, name, url) {

	var self = this;
	var sitemap = self.repository[REPOSITORY_SITEMAP];

	if (!sitemap) {
		sitemap = self.sitemap(self.sitemapid || name);
		if (!sitemap)
			return EMPTYARRAY;
	}

	var index = sitemap.findIndex('id', parent);
	if (index === -1)
		return sitemap;

	var obj = { sitemap: '', id: '', name: name, url: url, last: false, first: false, index: index, wildcard: false, formatName: false, formatUrl: false, localizeName: false, localizeUrl: false };

	sitemap.splice(index + 1, 0, obj);

	if (index) {
		var tmp = index;
		for (var i = index + 1; i > -1; i--)
			sitemap[i].index = tmp++;
	}

	return sitemap;
};

ControllerProto.sitemap_change = function(name, type, a, b, c, d, e, f) {

	var self = this;
	var sitemap = self.repository[REPOSITORY_SITEMAP];

	if (!sitemap) {
		sitemap = self.sitemap(self.sitemapid || name);
		if (!sitemap)
			return EMPTYARRAY;
	}

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

		return sitemap;
	}

	return sitemap;
};

ControllerProto.sitemap_replace = function(name, title, url) {

	var self = this;
	var sitemap = self.repository[REPOSITORY_SITEMAP];

	if (!sitemap) {
		sitemap = self.sitemap(self.sitemapid || name);
		if (!sitemap)
			return EMPTYARRAY;
	}

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

		if (title)
			item.name = typeof(title) === 'function' ? title(item.name) : item.formatName ? item.name.format(title) : title;

		if (url)
			item.url = typeof(url) === 'function' ? url(item.url) : item.formatUrl ? item.url.format(url) : url;

		if (is)
			self.repository[REPOSITORY_META_TITLE] = item.name;

		return sitemap;
	}

	return sitemap;
};

// Arguments: parent, name, url
ControllerProto.$sitemap_add = function(parent, name, url) {
	this.sitemap_add(parent, name, url);
	return '';
};

// Arguments: name, type, value, format
ControllerProto.$sitemap_change = function(a, b, c, d, e, f, g, h) {
	this.sitemap_change(a, b, c, d, e, f, g, h);
	return '';
};

// Arguments: name, title, url
ControllerProto.$sitemap_replace =function(a, b, c) {
	this.sitemap_replace(a, b, c);
	return '';
};

ControllerProto.sitemap = function(name) {
	var self = this;
	var sitemap;

	if (!name) {
		sitemap = self.repository[REPOSITORY_SITEMAP];
		if (!sitemap && (self.$sitemapid || self.route.sitemap))
			return self.sitemap(self.$sitemapid || self.route.sitemap);
		return sitemap ? sitemap : self.repository.sitemap || EMPTYARRAY;
	}

	if (name instanceof Array) {
		self.repository[REPOSITORY_SITEMAP] = name;
		return self;
	}

	self.$sitemapid = name;
	sitemap = U.clone(F.sitemap(name, false, self.language));
	sitemap.$cloned = true;

	self.repository[REPOSITORY_SITEMAP] = sitemap;

	if (!self.repository[REPOSITORY_META_TITLE]) {
		sitemap = sitemap[sitemap.length - 1];
		if (sitemap)
			self.repository[REPOSITORY_META_TITLE] = sitemap.name;
	}

	return self.repository[REPOSITORY_SITEMAP];
};

// Arguments: name
ControllerProto.$sitemap = function(name) {
	var self = this;
	self.sitemap(name);
	return '';
};

ControllerProto.module = function(name) {
	return F.module(name);
};

ControllerProto.layout = function(name) {
	var self = this;
	self.layoutName = name;
	return self;
};

ControllerProto.theme = function(name) {
	var self = this;
	self.themeName = name;
	return self;
};

/**
 * Layout setter for views
 * @param {String} name Layout name
 * @return {String}
 */
ControllerProto.$layout = function(name) {
	var self = this;
	self.layoutName = name;
	return '';
};

ControllerProto.model = function(name) {
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
ControllerProto.mail = function(address, subject, view, model, callback) {

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

	var message;

	if (body instanceof Function) {
		message = F.onMail(address, subject, '');
		message.manually();
		body(function(err, body) {
			message.body = body;
			message.send2(callback);
		});
	} else {
		message = F.onMail(address, subject, body, callback);
		self.layoutName = layoutName;
	}

	return message;
};

ControllerProto.$template = function(name, model, expire, key) {
	OBSOLETE('@{template()}', 'The method will be removed in v4');
	return this.$viewToggle(true, name, model, expire, key);
};

ControllerProto.$templateToggle = function(visible, name, model, expire, key) {
	OBSOLETE('@{templateToggle()}', 'The method will be removed in v4');
	return this.$viewToggle(visible, name, model, expire, key);
};

ControllerProto.$view = function(name, model, expire, key) {

	var self = this;
	var cache;

	if (expire) {
		cache = '$view.' + name + '.' + (key || '');
		var output = F.cache.read2(cache);
		if (output)
			return output.body;
	}

	var value = self.view(name, model, null, true, true, cache);
	if (!value)
		return '';

	expire && F.cache.add(cache, { components: value instanceof Function, body: value instanceof Function ? '' : value }, expire, false);
	return value;
};

ControllerProto.$viewCompile = function(body, model, key) {
	OBSOLETE('@{viewCompile()}', 'Was renamed to @{view_compile()}.');
	return this.$view_compile(body, model, key);
};

ControllerProto.$view_compile = function(body, model, key) {
	var self = this;
	var layout = self.layoutName;
	self.layoutName = '';
	var value = self.view_compile(body, model, null, true, key);
	self.layoutName = layout;
	return value || '';
};

ControllerProto.$viewToggle = function(visible, name, model, expire, key, async) {
	OBSOLETE('@{viewToggle()}', 'The method will be removed in v4');
	return visible ? this.$view(name, model, expire, key, async) : '';
};

/**
 * Adds a place into the places.
 * @param {String} name A place name.
 * @param {String} arg1 A content 1, optional
 * @param {String} arg2 A content 2, optional
 * @param {String} argN A content 2, optional
 * @return {String/Controller} String is returned when the method contains only `name` argument
 */
ControllerProto.place = function(name) {

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

		switch (U.getExtension(val)) {
			case 'js':
			case 'mjs':
				val = '<script src="' + val + '"></script>';
				break;
			case 'css':
				val = '<link rel="stylesheet" href="' + val + '" />';
				break;
		}

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
ControllerProto.section = function(name, value, replace) {

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

ControllerProto.$place = function() {
	var self = this;
	if (arguments.length === 1)
		return self.place.apply(self, arguments);
	self.place.apply(self, arguments);
	return '';
};

ControllerProto.$url = function(host) {
	return host ? this.req.hostname(this.url) : this.url;
};

// Argument: name
ControllerProto.$helper = function() {
	return this.helper.apply(this, arguments);
};

function querystring_encode(value, def, key) {

	if (value instanceof Array) {
		var tmp = '';
		for (var i = 1; i < value.length; i++)
			tmp += (tmp ? '&' : '') + key + '=' + querystring_encode(value[i], def);
		return querystring_encode(value[0], def) + (tmp ? tmp : '');
	}

	return value != null ? value instanceof Date ? encodeURIComponent(value.format()) : typeof(value) === 'string' ? encodeURIComponent(value) : (value + '') : def || '';
}

// @{href({ key1: 1, key2: 2 })}
// @{href('key', 'value')}
ControllerProto.href = function(key, value) {
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

			for (var k in obj) {
				var val = obj[k];
				if (val !== undefined) {
					if (val instanceof Array) {
						for (var j = 0; j < val.length; j++)
							str += (str ? '&' : '') + k + '=' + (key === k ? '\0' : querystring_encode(val[j]));
					} else
						str += (str ? '&' : '') + k + '=' + (key === k ? '\0' : querystring_encode(val));
				}
			}
			self[cachekey] = str;
		}

		str = str.replace('\0', querystring_encode(value, self.query[key], key));

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

ControllerProto.$checked = function(bool, charBeg, charEnd) {
	return this.$isValue(bool, charBeg, charEnd, 'checked="checked"');
};

ControllerProto.$disabled = function(bool, charBeg, charEnd) {
	return this.$isValue(bool, charBeg, charEnd, 'disabled="disabled"');
};

ControllerProto.$selected = function(bool, charBeg, charEnd) {
	return this.$isValue(bool, charBeg, charEnd, 'selected="selected"');
};

/**
 * Fake function for assign value
 * @private
 * @param {Object} value Value to eval.
 * return {String} Returns empty string.
 */
// Argument: value
ControllerProto.$set = function() {
	return '';
};

ControllerProto.$readonly = function(bool, charBeg, charEnd) {
	return this.$isValue(bool, charBeg, charEnd, 'readonly="readonly"');
};

ControllerProto.$header = function(name, value) {
	this.header(name, value);
	return '';
};

ControllerProto.$text = function(model, name, attr) {
	return this.$input(model, 'text', name, attr);
};

ControllerProto.$password = function(model, name, attr) {
	return this.$input(model, 'password', name, attr);
};

ControllerProto.$hidden = function(model, name, attr) {
	return this.$input(model, 'hidden', name, attr);
};

ControllerProto.$radio = function(model, name, value, attr) {

	if (typeof(attr) === 'string') {
		var label = attr;
		attr = SINGLETON('!$radio');
		attr.label = label;
	}

	attr.value = value;
	return this.$input(model, 'radio', name, attr);
};

ControllerProto.$checkbox = function(model, name, attr) {

	if (typeof(attr) === 'string') {
		var label = attr;
		attr = SINGLETON('!$checkbox');
		attr.label = label;
	}

	return this.$input(model, 'checkbox', name, attr);
};

ControllerProto.$textarea = function(model, name, attr) {

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

ControllerProto.$input = function(model, type, name, attr) {

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

ControllerProto._preparehostname = function(value) {
	if (!value)
		return value;
	var tmp = value.substring(0, 5);
	return tmp !== 'http:' && tmp !== 'https' && (tmp[0] !== '/' || tmp[1] !== '/') ? this.host(value) : value;
};

ControllerProto.head = function() {

	var self = this;

	if (!arguments.length) {
		var author = self.repository[REPOSITORY_META_AUTHOR] || CONF.author;
		var plus = '';
		var components = self.repository[REPOSITORY_COMPONENTS];
		if (components) {
			var keys = Object.keys(components);
			for (var i = 0; i < keys.length; i++) {
				var com = F.components.groups[keys[i]];
				if (com)
					plus += com.links;
			}
			// Cleans cache
			self.repository[REPOSITORY_COMPONENTS] = null;
		}
		return (author ? '<meta name="author" content="' + author + '" />' : '') + (self.repository[REPOSITORY_HEAD] || '') + plus;
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
			header += '<link type="text/css" rel="stylesheet" href="' + (is ? self.public_css(val) : val) + '" />';
		else if (JSFILES[ext])
			header += '<script src="' + (is ? self.public_js(val) : val) + '"></script>';
	}

	self.repository[REPOSITORY_HEAD] = header;
	return self;
};

ControllerProto.$head = function() {
	this.head.apply(this, arguments);
	return '';
};

ControllerProto.$isValue = function(bool, charBeg, charEnd, value) {
	if (!bool)
		return '';
	charBeg = charBeg || ' ';
	charEnd = charEnd || '';
	return charBeg + value + charEnd;
};

ControllerProto.$options = function(arr, selected, name, value, disabled) {

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

	if (!(arr instanceof Array))
		arr = [arr];

	selected = selected || '';

	var options = '';

	if (!isObject) {
		if (value == null)
			value = value || name || 'value';
		if (name == null)
			name = 'name';
		if (disabled == null)
			disabled = 'disabled';
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
		var dis = false;

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

			dis = o[disabled];

			if (typeof(disabled) === 'function')
				dis = disabled(i, val, text);
			else
				dis = dis ? true : false;

		} else {
			text = o;
			val = o;
		}

		if (!isSelected) {
			sel = val == selected;
			isSelected = sel;
		}

		options += '<option value="' + val.toString().encode() + '"' + (sel ? ' selected="selected"' : '') + (dis ? ' disabled="disabled"' : '') + '>' + text.toString().encode() + '</option>';
	}

	return options;
};

/**
 * Append <script> TAG
 * @private
 * @return {String}
 */
ControllerProto.$script = function() {
	return arguments.length === 1 ? this.$js(arguments[0]) : this.$js.apply(this, arguments);
};

/**
 * Append <script> TAG
 * @private
 * @return {String}
 */
ControllerProto.$js = function() {
	var self = this;
	var builder = '';
	for (var i = 0; i < arguments.length; i++)
		builder += self.public_js(arguments[i], true);
	return builder;
};

/**
 * Append <script> or <style> TAG
 * @private
 * @return {String}
 */
ControllerProto.$absolute = function(files, base) {

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
				case 'mjs':
					builder += self.public_js(files[i], true, base);
					break;
				case 'css':
					builder += self.public_css(files[i], true, base);
					break;
				default:
					builder += self.public(files[i], base);
					break;
			}
		}

		return builder;
	}

	ftype = U.getExtension(files);

	switch (ftype) {
		case 'js':
		case 'mjs':
			return self.public_js(files, true, base);
		case 'css':
			return self.public_css(files, true, base);
	}

	return self.public(files, base);
};

var $importmergecache = {};

ControllerProto.$import = function() {

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

		if (filename === 'components' && F.components.has) {
			// Generated in controller.head()
			continue;
		}

		if (filename === 'manifest' || filename === 'manifest.json') {
			builder += '<link rel="manifest" href="' + F.$version('/manifest.json') + '">';
			continue;
		}

		if (filename === 'favicon.ico' || filename === 'favicon.png') {
			builder += self.$favicon(filename);
			continue;
		}

		if (filename[0] === 'l' && filename[9] === 'd' && filename.substring(0, 10) === 'livereload') {
			if (DEBUG) {
				var url = filename.substring(11).trim();
				builder += '<script src="//cdn.totaljs.com/livereload.js"' + (url ? (' data-url="' + url + '"') : '') + '></script>';
			}
			continue;
		}

		var k = 'import#' + (self.themeName || '') + filename;

		if (F.temporary.other[k]) {
			builder += F.temporary.other[k];
			continue;
		}

		var ext;

		if (filename.indexOf('+') !== -1) {

			// MERGE
			var merge = filename.split('+');
			var hash = 'merge' + filename.hash(true);

			if ($importmergecache[hash]) {
				builder += F.temporary.other[k] = $importmergecache[hash];
				continue;
			}

			merge[0] = merge[0].trim();
			var index = merge[0].lastIndexOf('.');
			var mergename = merge[0];
			var crc = 0;

			ext = U.getExtension(merge[0]);
			merge[0] = ext === 'css' ? self.public_css(merge[0]) : self.public_js(merge[0]);

			for (var j = 1; j < merge.length; j++) {
				merge[j] = merge[j].trim();
				merge[j] = ext === 'css' ? self.public_css(merge[j]) : self.public_js(merge[j]);
				crc += merge[j].crc32(true);
			}

			var outputname = mergename.substring(0, index) + crc + mergename.substring(index);
			outputname = ext === 'css' ? self.public_css(outputname) : self.public_js(outputname);

			var tmp = ext === 'css' ? self.public_css(outputname, true) : self.public_js(outputname, true);
			$importmergecache[hash] = F.temporary.other[k] = tmp;

			merge.unshift(outputname);
			MERGE.apply(global, merge);
			builder += tmp;
			continue;
		}

		ext = filename.substring(filename.lastIndexOf('.'));
		var tag = filename[0] !== '!';
		if (!tag)
			filename = filename.substring(1);

		if (filename[0] === '#')
			ext = '.js';

		switch (ext) {
			case '.js':
				builder += F.temporary.other[k] = self.public_js(filename, tag);
				break;
			case '.css':
				builder += F.temporary.other[k] = self.public_css(filename, tag);
				break;
			case '.ico':
				builder += F.temporary.other[k] = self.$favicon(filename);
				break;
			case '.jpg':
			case '.gif':
			case '.svg':
			case '.png':
			case '.jpeg':
			case '.heif':
			case '.webp':
			case '.heic':
			case '.apng':
				builder += F.temporary.other[k] = self.public_image(filename);
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
				builder += F.temporary.other[k] = self.public_video(filename);
				break;
			default:
				builder += F.temporary.other[k] = self.public(filename);
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
ControllerProto.$css = function() {

	var self = this;
	var builder = '';

	for (var i = 0; i < arguments.length; i++)
		builder += self.public_css(arguments[i], true);

	return builder;
};

ControllerProto.$image = function(name, width, height, alt, className) {

	var style = '';

	if (typeof(width) === 'object') {
		height = width.height;
		alt = width.alt;
		className = width.class;
		style = width.style;
		width = width.width;
	}

	var builder = '<img src="' + this.public_image(name) + ATTR_END;

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
ControllerProto.$download = function(filename, innerHTML, downloadName, className) {
	var builder = '<a href="' + F.public_download(filename) + ATTR_END;

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
ControllerProto.$json = function(obj, id, beautify, replacer) {

	if (typeof(id) === 'boolean') {
		replacer = beautify;
		beautify = id;
		id = null;
	}

	if (typeof(beautify) === 'function') {
		replacer = beautify;
		beautify = false;
	}

	if (obj && obj.$$schema)
		obj = obj.$clean();

	var value = beautify ? JSON.stringify(obj, replacer, 4) : JSON.stringify(obj, replacer);
	return id ? ('<script type="application/json" id="' + id + '">' + value + '</script>') : value;
};

/**
 * Serialize object into the JSON
 * @private
 * @param {Object} obj
 * @param {String} id Optional.
 * @param {Boolean} beautify Optional.
 * @return {String}
 */
ControllerProto.$json2 = function(obj, id) {

	if (obj && obj.$$schema)
		obj = obj.$clean();

	var data = {};

	for (var i = 2; i < arguments.length; i++) {
		var key = arguments[i];
		data[key] = obj[key];
	}

	return '<script type="application/json" id="' + id + '">' + JSON.stringify(data) + '</script>';
};

/**
 * Append FAVICON tag
 * @private
 * @param {String} name
 * @return {String}
 */
ControllerProto.$favicon = function(name) {

	var contentType = 'image/x-icon';

	if (!name)
		name = 'favicon.ico';

	var key = 'favicon#' + name;
	if (F.temporary.other[key])
		return F.temporary.other[key];

	if (name.lastIndexOf('.png') !== -1)
		contentType = 'image/png';
	else if (name.lastIndexOf('.gif') !== -1)
		contentType = 'image/gif';

	return F.temporary.other[key] = '<link rel="icon" href="' + F.public('/' + name) + '" type="' + contentType + '" />';
};

/**
 * Route static file helper
 * @private
 * @param {String} current
 * @param {String} name
 * @param {Function} fn
 * @return {String}
 */
ControllerProto.$static = function(name, fn) {
	return fn.call(framework, prepare_staticurl(name, false), this.themeName);
};

ControllerProto.routeScript = function(name, tag, path) {
	OBSOLETE('controller.routeScript()', 'Was renamed to "controller.public_js()"');
	return this.public_js(name, tag, path);
};

ControllerProto.public_js = function(name, tag, path) {

	if (name === undefined)
		name = 'default.js';

	var async = false;
	var url;

	// Checks "async "
	if (tag && name[0] === 'a' && name[5] === ' ') {
		async = true;
		name = name.substring(6);
	}

	// Isomorphic
	if (name[0] === '#') {
		var tmp = F.isomorphic[name.substring(1)];
		if (tmp)
			url = tmp.url;
		else {
			F.error('Isomorphic library {0} doesn\'t exist.'.format(name.substring(1)));
			return '';
		}
	} else {
		url = this.$static(name, F.public_js);
		if (path && U.isRelative(url))
			url = F.isWindows ? U.join(path, url) : U.join(path, url).substring(1);
	}

	return tag ? ('<script src="' + url + '"' + (async ? ' async' : '') + '></script>') : url;
};

ControllerProto.routeStyle = function(name, tag, path) {
	OBSOLETE('controller.routeStyle()', 'Was renamed to "controller.public_css()"');
	return this.public_css(name, tag, path);
};

ControllerProto.public_css = function(name, tag, path) {

	var self = this;

	if (name === undefined)
		name = 'default.css';

	var url = self.$static(name, F.public_css);
	if (path && U.isRelative(url))
		url = F.isWindows ? U.join(path, url) : U.join(path, url).substring(1);

	return tag ? '<link type="text/css" rel="stylesheet" href="' + url + '" />' : url;
};

ControllerProto.routeImage = function(name) {
	OBSOLETE('controller.routeImage()', 'Was renamed to "controller.public_image()"');
	return this.public_image(name);
};

ControllerProto.public_image = function(name) {
	return this.$static(name, F.public_image);
};

ControllerProto.routeVideo = function(name) {
	OBSOLETE('controller.routeVideo()', 'Was renamed to "controller.public_video()"');
	return this.public_video(name);
};

ControllerProto.public_video = function(name) {
	return this.$static(name, F.public_video);
};

ControllerProto.routeFont = function(name) {
	OBSOLETE('controller.routeFont()', 'Was renamed to "controller.public_font()"');
	return this.public_font(name);
};

ControllerProto.public_font = function(name) {
	return F.public_font(name);
};

ControllerProto.routeDownload = function(name) {
	OBSOLETE('controller.routeDownload()', 'Was renamed to "controller.public_download()"');
	return this.public_download(name);
};

ControllerProto.public_download = function(name) {
	return this.$static(name, F.public_download);
};

ControllerProto.routeStatic = function(name, path) {
	OBSOLETE('controller.routeStatic()', 'Was renamed to "controller.public()"');
	return this.public(name, path);
};

ControllerProto.public = function(name, path) {
	var url = this.$static(name, F.public);
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
ControllerProto.template = function(name, model) {
	OBSOLETE('controller.template()', 'This method will be removed in v4.');
	return this.view(name, model, true);
};

/**
 * Renders a custom helper to a string
 * @param {String} name A helper name.
 * @return {String}
 */
ControllerProto.helper = function(name) {
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
ControllerProto.json = function(obj, headers, beautify, replacer) {

	var self = this;
	var res = self.res;

	if (typeof(headers) === 'boolean') {
		replacer = beautify;
		beautify = headers;
	}

	res.options.code = self.status || 200;
	res.options.type = CT_JSON;
	res.options.headers = headers;

	// Checks the HEAD method
	if (self.req.method === 'HEAD') {
		res.options.body = EMPTYBUFFER;
		res.options.type = CT_JSON;
		res.$text();
		F.stats.response.json++;
		return self;
	}

	if (self.$evalroutecallback) {
		var err = obj instanceof framework_builders.ErrorBuilder ? obj : null;
		self.$evalroutecallback(err, err ? null : obj);
		return self;
	}

	if (obj instanceof framework_builders.ErrorBuilder) {
		self.req.$language && !obj.isResourceCustom && obj.setResource(self.req.$language);

		var json = obj.output(true);

		if (obj.contentType)
			res.options.type = obj.contentType;
		else
			res.options.type = CT_JSON;

		if (obj.status !== 200)
			res.options.code = obj.status;

		obj = json;
		F.stats.response.errorBuilder++;
	} else {

		if (obj && obj.$$schema)
			obj = obj.$clean();

		if (beautify)
			obj = JSON.stringify(obj, replacer, 4);
		else
			obj = JSON.stringify(obj, replacer);
	}

	F.stats.response.json++;
	res.options.body = obj;
	res.options.compress = obj.length > 4096;
	res.$text();
	self.precache && self.precache(obj, res.options.type, headers);
	return self;
};

ControllerProto.success = function(is, value) {
	var t = typeof(is);
	if (value === undefined && (is == null || t === 'boolean')) {
		F.stats.response.json++;
		var res = this.res;
		res.options.body = '{"success":' + (is == null ? 'true' : is) + '}';
		res.options.type = CT_JSON;
		res.options.compress = false;
		res.$text();
	} else {
		if (t && t !== 'boolean') {
			value = t;
			t = true;
		}
		this.json(SUCCESS(is == null ? true : is, value));
	}

	return this;
};

ControllerProto.done = function(arg) {
	var self = this;
	return function(err, response) {
		if (err) {
			self.invalid(err);
		} else if (arg)
			self.json(SUCCESS(err == null, arg === true ? response : arg));
		else {
			var res = self.res;
			res.options.body = '{"success":' + (err == null) + '}';
			res.options.type = CT_JSON;
			res.options.compress = false;
			res.$text();
		}
	};
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
ControllerProto.jsonp = function(name, obj, headers, beautify, replacer) {

	var self = this;
	var res = self.res;

	if (typeof(headers) === 'boolean') {
		replacer = beautify;
		beautify = headers;
	}

	res.options.code = self.status || 200;
	res.options.headers = headers;
	res.options.type = 'application/x-javascript';

	// Checks the HEAD method
	if (self.req.method === 'HEAD') {
		res.options.body = EMPTYBUFFER;
		res.$text();
		F.stats.response.json++;
		return self;
	}

	!name && (name = 'callback');

	if (obj instanceof framework_builders.ErrorBuilder) {
		self.req.$language && !obj.isResourceCustom && obj.setResource(self.req.$language);
		obj = obj.json(beautify);
		if (obj.status !== 200)
			res.options.code = obj.status;
		F.stats.response.errorBuilder++;
	} else {

		if (obj && obj.$$schema)
			obj = obj.$clean();

		if (beautify)
			obj = JSON.stringify(obj, replacer, 4);
		else
			obj = JSON.stringify(obj, replacer);
	}

	res.options.body = name + '(' + obj + ')';
	res.$text();

	F.stats.response.json++;
	self.precache && self.precache(name + '(' + obj + ')', res.options.type, headers);
	return self;
};

/**
 * Creates View or JSON callback
 * @param {String} view Optional, undefined or null returns JSON.
 * @return {Function}
 */
ControllerProto.callback = function(view) {
	var self = this;
	return function(err, data) {

		CONF.logger && self.req.$logger && F.ilogger(null, self.req);

		if (self.res && self.res.success)
			return;

		var is = err instanceof framework_builders.ErrorBuilder;

		// NoSQL embedded database
		if (data === undefined && (err && !err.stack) && !is) {
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

		// Hack for schemas
		if (data instanceof F.callback_redirect)
			return self.redirect(data.url);

		if (typeof(view) === 'string')
			self.view(view, data);
		else if (data === SUCCESSHELPER && data.value === undefined) {
			if (self.$evalroutecallback) {
				self.$evalroutecallback(null, data);
			} else {
				F.stats.response.json++;
				var res = self.res;
				res.options.compress = false;
				res.options.body = '{"success":' + (data.success == null ? 'true' : data.success) + '}';
				res.options.type = CT_JSON;
				res.$text();
			}
		} else
			self.json(data);
	};
};

ControllerProto.custom = function() {
	if (this.res.success)
		return false;
	this.res.$custom();
	return true;
};

/**
 * Prevents cleaning uploaded files (need to call `controller.clear()` manually).
 * @param {Boolean} enable Optional, default `true`.
 * @return {Controller}
 */
ControllerProto.noClear = function(enable) {
	OBSOLETE('controller.noClear()', 'You need to use controller.autoclear(false)');
	this.req._manual = enable === undefined ? true : enable;
	return this;
};

ControllerProto.autoclear = function(enable) {
	this.req._manual = enable === false;
	return this;
};

ControllerProto.html = function(body, headers) {
	return this.content(body, 'text/html', headers);
};

ControllerProto.content = function(body, type, headers) {

	var self = this;
	var res = self.res;

	res.options.headers = headers;
	res.options.code = self.status || 200;

	if (self.$evalroutecallback) {
		var err = body instanceof ErrorBuilder ? body : null;
		self.$evalroutecallback(err, err ? null : body);
		return self;
	}

	if (body instanceof ErrorBuilder) {

		if (self.language && !body.resourceName)
			body.resourceName = self.language;

		var tmp = body.output(true);
		if (body.contentType)
			res.options.type = body.contentType;
		else
			res.options.type = CT_JSON;

		if (body.status !== 200)
			res.options.code = body.status;

		body = tmp;
		F.stats.response.errorBuilder++;
	} else
		res.options.type = type || CT_TEXT;

	res.options.body = body;
	res.options.compress = body.length > 4096;
	res.$text();

	if (self.precache && (!self.status || self.status === 200)) {
		self.layout('');
		self.precache(body, res.options.type, headers, true);
	}

	return self;
};

/**
 * Responds with plain/text body
 * @param {String} body A response body (object is serialized into the JSON automatically).
 * @param {Boolean} headers A custom headers.
 * @return {Controller}
 */
ControllerProto.plain = function(body, headers) {

	var self = this;
	var res = self.res;

	res.options.code = self.status || 200;
	res.options.headers = headers;
	res.options.type = CT_TEXT;

	// Checks the HEAD method
	if (self.req.method === 'HEAD') {
		res.options.body = EMPTYBUFFER;
		res.$text();
		F.stats.response.plain++;
		return self;
	}

	var type = typeof(body);

	if (body == null)
		body = '';
	else if (type === 'object') {
		if (body && body.$$schema)
			body = body.$clean();
		body = body ? JSON.stringify(body, null, 4) : '';
	} else
		body = body ? body.toString() : '';

	res.options.body = body;
	res.$text();
	F.stats.response.plain++;
	self.precache && self.precache(body, res.options.type, headers);
	return self;
};

/**
 * Creates an empty response
 * @param {Object/Number} headers A custom headers or a custom HTTP status.
 * @return {Controller}
 */
ControllerProto.empty = function(headers) {

	var self = this;
	var res = self.res;

	if (typeof(headers) === 'number') {
		self.status = headers;
		headers = null;
	}

	res.options.code = self.status || 200;
	res.options.headers = headers;
	res.options.body = EMPTYBUFFER;
	res.options.type = CT_TEXT;
	res.options.compress = false;
	res.$text();
	F.stats.response.empty++;
	return self;
};

/**
 * Creates an empty response with 204
 * @param {Object/Number} headers A custom headers or a custom HTTP status.
 * @return {Controller}
 */
ControllerProto.nocontent = function(headers) {
	var self = this;
	var res = self.res;
	res.writeHead(204, headers);
	res.end();
	F.stats.response.empty++;
	response_end(res);
	return self;
};

/**
 * Destroys a request (closes it)
 * @param {String} problem Optional.
 * @return {Controller}
 */
ControllerProto.destroy = function(problem) {
	var self = this;

	problem && self.problem(problem);
	if (self.res.success || self.res.headersSent || !self.isConnected)
		return self;

	self.req.$total_success();
	self.req.connection && self.req.connection.destroy();
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
ControllerProto.file = function(filename, download, headers, done) {

	if (filename[0] === '~')
		filename = filename.substring(1);
	else
		filename = F.path.public_cache(filename);

	var res = this.res;
	res.options.filename = filename;
	res.options.download = download;
	res.options.headers = headers;
	res.options.callback = done;

	res.$file();
	return this;
};

ControllerProto.filefs = function(name, id, download, headers, callback, checkmeta) {
	var self = this;
	var options = {};
	options.id = id;
	options.download = download;
	options.headers = headers;
	options.done = callback;
	FILESTORAGE(name).res(self.res, options, checkmeta, $file_notmodified);
	return self;
};

ControllerProto.filenosql = function(name, id, download, headers, callback, checkmeta) {
	var self = this;
	var options = {};
	options.id = id;
	options.download = download;
	options.headers = headers;
	options.done = callback;
	NOSQL(name).binary.res(self.res, options, checkmeta, $file_notmodified);
	return self;
};

ControllerProto.imagefs = function(name, id, make, headers, callback, checkmeta) {
	var self = this;
	var options = {};
	options.id = id;
	options.image = true;
	options.make = make;
	options.headers = headers;
	options.done = callback;
	FILESTORAGE(name).res(self.res, options, checkmeta, $file_notmodified);
	return self;
};

ControllerProto.imagenosql = function(name, id, make, headers, callback, checkmeta) {
	var self = this;
	var options = {};
	options.id = id;
	options.image = true;
	options.make = make;
	options.headers = headers;
	options.done = callback;
	NOSQL(name).binary.res(self.res, options, checkmeta, $file_notmodified);
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
ControllerProto.image = function(filename, make, headers, done) {

	var res = this.res;

	if (typeof(filename) === 'string') {
		if (filename[0] === '~')
			filename = filename.substring(1);
		else
			filename = F.path.public_cache(filename);

		res.options.filename = filename;
	} else
		res.options.stream = filename;

	res.options.make = make;
	headers && (res.options.headers = headers);
	done && (res.options.callback = done);
	res.$image();
	return this;
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
ControllerProto.stream = function(type, stream, download, headers, done, nocompress) {
	var res = this.res;
	res.options.type = type;
	res.options.stream = stream;
	res.options.download = download;
	res.options.headers = headers;
	res.options.done = done;
	res.options.compress = nocompress ? false : true;
	res.$stream();
	return this;
};

/**
 * Throw 400 - Bad request.
 * @param  {String} problem Description of problem (optional)
 * @return {Controller}
 */
ControllerProto.throw400 = ControllerProto.view400 = function(problem) {
	return controller_error_status(this, 400, problem);
};

/**
 * Throw 401 - Unauthorized.
 * @param  {String} problem Description of problem (optional)
 * @return {Controller}
 */
ControllerProto.throw401 = ControllerProto.view401 = function(problem) {
	return controller_error_status(this, 401, problem);
};

/**
 * Throw 403 - Forbidden.
 * @param  {String} problem Description of problem (optional)
 * @return {Controller}
 */
ControllerProto.throw403 = ControllerProto.view403 = function(problem) {
	return controller_error_status(this, 403, problem);
};

/**
 * Throw 404 - Not found.
 * @param  {String} problem Description of problem (optional)
 * @return {Controller}
 */
ControllerProto.throw404 = ControllerProto.view404 = function(problem) {
	return controller_error_status(this, 404, problem);
};

/**
 * Throw 409 - Conflict.
 * @param  {String} problem Description of problem (optional)
 * @return {Controller}
 */
ControllerProto.throw409 = ControllerProto.view409 = function(problem) {
	return controller_error_status(this, 409, problem);
};

/**
 * Throw 500 - Internal Server Error.
 * @param {Error} error
 * @return {Controller}
 */
ControllerProto.throw500 = ControllerProto.view500 = function(error) {
	var self = this;
	F.error(error instanceof Error ? error : new Error((error || '').toString()), self.name, self.req.uri);
	return controller_error_status(self, 500, error);
};

/**
 * Throw 501 - Not implemented
 * @param  {String} problem Description of the problem (optional)
 * @return {Controller}
 */
ControllerProto.throw501 = ControllerProto.view501 = function(problem) {
	return controller_error_status(this, 501, problem);
};

/**
 * Throw 503 - Service unavailable
 * @param  {String} problem Description of the problem (optional)
 * @return {Controller}
 */
ControllerProto.throw503 = ControllerProto.view503 = function(problem) {
	return controller_error_status(this, 503, problem);
};

/**
 * Creates a redirect
 * @param {String} url
 * @param {Boolean} permanent Is permanent? Default: `false`
 * @return {Controller}
 */
ControllerProto.redirect = function(url, permanent) {
	this.precache && this.precache(null, null, null);
	var res = this.res;
	res.options.url = url;
	res.options.permanent = permanent;
	res.$redirect();
	return this;
};

/**
 * A binary response
 * @param {Buffer} buffer
 * @param {String} type
 * @param {String} encoding Transformation type: `binary`, `utf8`, `ascii`.
 * @param {String} download Optional, download name.
 * @param {Object} headers Optional, additional headers.
 * @return {Controller}
 */
ControllerProto.binary = function(buffer, type, encoding, download, headers) {

	var res = this.res;

	if (typeof(encoding) === 'object') {
		var tmp = encoding;
		encoding = download;
		download = headers;
		headers = tmp;
	}

	if (typeof(download) === 'object') {
		headers = download;
		download = headers;
	}

	res.options.body = buffer;
	res.options.type = type;
	res.options.download = download;
	res.options.headers = headers;
	res.options.encoding = encoding;
	res.$binary();
	return this;
};

/**
 * Basic access authentication (baa)
 * @param {String} label
 * @return {Object}
 */
ControllerProto.baa = function(label) {

	var self = this;
	self.precache && self.precache(null, null, null);

	if (label === undefined)
		return self.req.authorization();

	var res = self.res;
	var headers = SINGLETON('!controller.baa');

	headers['WWW-Authenticate'] = 'Basic realm="' + (label || 'Administration') + '"';

	res.options.code = 401;
	res.options.body = '401: NOT AUTHORIZED';
	res.options.compress = false;
	res.options.headers = headers;
	res.options.type = CT_TEXT;
	res.$text();
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
ControllerProto.sse = function(data, eventname, id, retry) {

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
			retry = self.route.timeout;

		self.req.$total_success();
		self.req.on('close', () => self.close());
		res.success = true;
		res.writeHead(self.status || 200, HEADERS.sse);
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

/**
 * Close a response
 * @param {Boolean} end
 * @return {Controller}
 */
ControllerProto.close = function(end) {
	var self = this;

	if (end === undefined)
		end = true;

	if (!self.isConnected)
		return self;

	if (self.type) {
		self.isConnected = false;
		self.res.success = true;
		F.reqstats(false, false);
		F.$events['request-end'] && EMIT('request-end', self.req, self.res);
		F.$events.request_end && EMIT('request_end', self.req, self.res);
		self.type = 0;
		end && self.res.end();
		self.req.clear(true);
		return self;
	}

	self.isConnected = false;

	if (self.res.success)
		return self;

	self.res.success = true;
	F.reqstats(false, false);
	F.$events['request-end'] && EMIT('request-end', self.req, self.res);
	F.$events.request_end && EMIT('request_end', self.req, self.res);
	end && self.res.end();
	self.req.clear(true);
	return self;
};

/**
 * Creates a proxy between current request and new URL
 * @param {String} url
 * @param {Function(err, response, headers)} callback Optional.
 * @param {Object} headers Optional, additional headers.
 * @param {Number} timeout Optional, timeout (default: 10000)
 * @return {EventEmitter}
 */
ControllerProto.proxy = ControllerProto.proxy2 = function(url, callback, headers, timeout) {

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

	if ((/\/json/i).test(type))
		flags.push('json');

	var tmp;

	if (url.indexOf('?') === -1) {
		tmp = Qs.stringify(self.query);
		if (tmp)
			url += '?' + tmp;
	}

	var keys = Object.keys(req.headers);
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

		if (headers.flags) {
			if (typeof(headers.flags) === 'string')
				headers.flags = headers.flags.split(',');
			for (var i = 0; i < headers.flags.length; i++)
				flags.push(headers.flags[i]);
			headers.flags = undefined;
		}

		keys = Object.keys(headers);
		for (var i = 0, length = keys.length; i < length; i++) {
			if (headers[keys[i]])
				h[keys[i]] = headers[keys[i]];
		}
	}

	return U.request(url, flags, self.body, function(err, data, code, headers) {

		if (err) {
			callback && callback(err);
			self.invalid().push(err);
		} else {
			self.status = code;
			callback && callback(err, data, code, headers);
			var ct = (headers['content-type'] || 'text/plain').replace(REG_ENCODINGCLEANER, '');
			if (data instanceof Buffer)
				self.binary(data, ct);
			else
				self.content(data, ct);
		}

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
ControllerProto.view = function(name, model, headers, partial, noasync, cachekey) {

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
		self.layoutName = CONF.default_layout;
	if (self.themeName === undefined)
		self.themeName = CONF.default_theme;

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

		if (REG_HTTPHTTPS.test(name))
			skip = 7;

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

		if (!isTheme && !isLayout && !skip && self._currentView)
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

		if (skip === 7) {

			if (F.temporary.other[key] === 0) {
				setTimeout(function() {
					self.view(name, model, headers, partial);
				}, 100, self);
				return;
			}

			filename = F.path.temp('view' + name.hash() + '.html');
			F.temporary.other[key] = 0;

			var done = { callback: NOOP };

			F.download(name, filename, function(err) {
				if (err) {
					F.temporary.other[key] = undefined;
					if (done.callback === NOOP)
						F.throw500(err);
					else
						done.callback(err);
				} else {
					F.temporary.other[key] = '.' + filename.substring(0, filename.length - 5);
					done.callback(null, self.view(name, model, headers, partial));
				}
			});

			return function(cb) {
				done.callback = cb;
			};
		}
	}

	return self.$viewrender(filename, framework_internal.viewEngine(name, filename, self), model, headers, partial, isLayout, noasync, cachekey);
};

ControllerProto.viewCompile = function(body, model, headers, partial, key) {
	OBSOLETE('controller.viewCompile()', 'Was renamed to `controller.view_compile()`.');
	return this.view_compile(body, model, headers, partial, key);
};

ControllerProto.view_compile = function(body, model, headers, partial, key) {

	if (headers === true) {
		key = partial;
		partial = true;
		headers = undefined;
	} else if (typeof(headers) === 'string') {
		key = headers;
		headers = undefined;
	} else if (typeof(partial) === 'string') {
		key = partial;
		partial = undefined;
	}

	return this.$viewrender('[dynamic view]', framework_internal.viewEngineCompile(body, this.language, this, key), model, headers, partial);
};

ControllerProto.$viewrender = function(filename, generator, model, headers, partial, isLayout, noasync, cachekey) {

	var self = this;
	var err;

	if (!generator) {

		err = new Error('View "' + filename + '" not found.');

		if (partial) {
			F.error(err, self.name, self.uri);
			return self.outputPartial;
		}

		if (isLayout) {
			self.res.throw500(err);
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

		if (generator.components.length) {
			if (!self.repository[REPOSITORY_COMPONENTS])
				self.repository[REPOSITORY_COMPONENTS] = {};
			for (var i = 0; i < generator.components.length; i++)
				self.repository[REPOSITORY_COMPONENTS][generator.components[i]] = 1;
		}

		value = generator.call(self, self, self.repository, model, self.session, self.query, self.body, self.url, F.global, helpers, self.user, CONF, F.functions, 0, partial ? self.outputPartial : self.output, self.req.files, self.req.mobile, EMPTYOBJECT);

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

	// noasync = true --> rendered inline view in view

	if (self.$viewasync && self.$viewasync.length) {

		var can = ((isLayout || !self.layoutName) && noasync !== true) || !!cachekey;
		if (can) {
			var done = {};
			var obj = {};

			obj.repository = self.repository;
			obj.model = self.$model;
			obj.user = self.user;
			obj.session = self.session;
			obj.controller = self;
			obj.query = self.query;
			obj.body = self.body;
			obj.files = self.files;

			self.$viewasync.waitFor(function(item, next) {

				if (item.value) {
					value = value.replace(item.replace, item.value);
					if (isLayout && self.precache)
						self.output = self.output.replace(item.replace, item.value);
					return next();
				}

				obj.options = obj.settings = item.settings;
				obj.next = obj.callback = function(model) {
					if (arguments.length > 1)
						model = arguments[1];
					item.value = self.component(item.name, item.settings, model);
					value = value.replace(item.replace, item.value);
					if (isLayout && self.precache)
						self.output = self.output.replace(item.replace, item.value);
					next();
				};

				F.components.instances[item.name].render(obj);

			}, function() {

				if (cachekey && F.cache.items[cachekey]) {
					var cache = F.cache.items[cachekey].value;
					cache.body = value;
					cache.components = true;
				}

				if (isLayout && self.precache && (!self.status || self.status === 200) && !partial)
					self.precache(self.output, CT_HTML, headers, true);

				if (isLayout || !self.layoutName) {

					self.outputPartial = '';
					self.output = '';
					isLayout = false;

					if (partial) {
						done.callback && done.callback(null, value);
						return;
					}

					self.req.$total_success();

					if (!self.isConnected)
						return self;

					var res = self.res;
					res.options.body = value;
					res.options.code = self.status || 200;
					res.options.type = CT_HTML;
					res.options.headers = headers;
					res.$text();
					F.stats.response.view++;
					return self;
				}

				if (partial)
					self.outputPartial = value;
				else
					self.output = value;

				if (!cachekey && !noasync) {
					self.isLayout = true;
					value = self.view(self.layoutName, self.$model, headers, partial);
				}

				// Async
				if (partial) {
					self.outputPartial = '';
					self.isLayout = false;
					done.callback && done.callback(null, value);
				}

			});

			return cachekey ? value : (partial ? (fn => done.callback = fn) : self);
		}
	}

	if (!isLayout && self.precache && (!self.status || self.status === 200) && !partial && !self.$viewasync)
		self.precache(value, CT_HTML, headers, true);

	if (isLayout || !self.layoutName) {

		self.outputPartial = '';
		self.output = '';
		isLayout = false;

		if (partial)
			return value;

		self.req.$total_success();

		if (!self.isConnected)
			return self;

		var components = self.repository[REPOSITORY_COMPONENTS];
		if (components) {
			var keys = Object.keys(components);
			var plus = '';
			for (var i = 0; i < keys.length; i++) {
				var com = F.components.groups[keys[i]];
				if (com)
					plus += com.links;
			}
			// Cleans cache
			self.repository[REPOSITORY_COMPONENTS] = null;
			value = value.replace('</head>', plus + '</head>');
		}

		var res = self.res;
		res.options.body = value;
		res.options.code = self.status || 200;
		res.options.type = CT_HTML;
		res.options.headers = headers;
		res.$text();
		F.stats.response.view++;
		return self;
	}

	if (partial)
		self.outputPartial = value;
	else
		self.output = value;

	if (!cachekey && !noasync) {
		self.isLayout = true;
		value = self.view(self.layoutName, self.$model, headers, partial);
	}

	// Async
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
 * @param {Boolean} disabled Disables a caching, optional (e.g. for debug mode you can disable a cache), default: `false`
 * @param {Function()} fnTo This method is executed when the content is prepared for the cache.
 * @param {Function()} fnFrom This method is executed when the content is readed from the cache.
 * @return {Controller}
 */
ControllerProto.memorize = function(key, expires, disabled, fnTo, fnFrom) {

	var self = this;

	if (disabled === true) {
		fnTo.call(self);
		return self;
	}

	self.themeName && (key += '#' + self.themeName);

	var output = F.cache.read2(key);
	if (!output)
		return self.$memorize_prepare(key, expires, disabled, fnTo, fnFrom);

	if (typeof(disabled) === 'function') {
		var tmp = fnTo;
		fnTo = disabled;
		fnFrom = tmp;
	}

	self.layoutName = output.layout;
	self.themeName = output.theme;

	var res = self.res;

	res.options.code = self.status || 200;
	res.options.type = output.type;
	res.options.headers = output.headers;
	res.options.body = output.content;

	if (output.type !== CT_HTML) {
		fnFrom && fnFrom.call(self);
		res.$text();
		return;
	}

	switch (output.type) {
		case CT_TEXT:
			F.stats.response.plain++;
			return self;
		case CT_JSON:
			F.stats.response.json++;
			return self;
		case CT_HTML:
			F.stats.response.view++;
			break;
	}

	var length = output.repository.length;
	for (var i = 0; i < length; i++) {
		var key = output.repository[i].key;
		if (self.repository[key] === undefined)
			self.repository[key] = output.repository[i].value;
	}

	fnFrom && fnFrom.call(self);

	if (self.layoutName) {
		self.output = Buffer.from(output.content);
		self.isLayout = true;
		self.view(self.layoutName, null);
	} else {
		self.req.$total_success();
		res.$text();
	}

	return self;
};

ControllerProto.$memorize_prepare = function(key, expires, disabled, fnTo, fnFrom) {

	var self = this;
	var pk = '$memorize' + key;

	if (F.temporary.processing[pk]) {
		setTimeout(function() {
			!self.req.$total_canceled && self.memorize(key, expires, disabled, fnTo, fnFrom);
		}, 500);
		return self;
	}

	self.precache = function(value, contentType, headers, isView) {

		if (!value && !contentType && !headers) {
			delete F.temporary.processing[pk];
			self.precache = null;
			return;
		}

		var options = { content: value, type: contentType || CT_TEXT, layout: self.layoutName, theme: self.themeName };
		if (headers)
			options.headers = headers;

		if (isView) {
			options.repository = [];
			for (var name in self.repository) {
				var value = self.repository[name];
				value !== undefined && options.repository.push({ key: name, value: value });
			}
		}

		F.cache.add(key, options, expires, false);
		self.precache = null;
		delete F.temporary.processing[pk];
	};

	if (typeof(disabled) === 'function')
		fnTo = disabled;

	F.temporary.processing[pk] = true;
	fnTo.call(self);
	return self;
};

// *********************************************************************************
// =================================================================================
// F.WebSocket
// =================================================================================
// *********************************************************************************

const NEWLINE = '\r\n';
const SOCKET_RESPONSE = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {0}\r\n\r\n';
const SOCKET_RESPONSE_COMPRESS = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {0}\r\nSec-WebSocket-Extensions: permessage-deflate\r\n\r\n';
const SOCKET_RESPONSE_PROTOCOL = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {0}\r\nSec-WebSocket-Protocol: {1}\r\n\r\n';
const SOCKET_RESPONSE_PROTOCOL_COMPRESS = 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {0}\r\nSec-WebSocket-Protocol: {1}\r\nSec-WebSocket-Extensions: permessage-deflate\r\n\r\n';
const SOCKET_HASH = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const SOCKET_ALLOW_VERSION = [13];

function WebSocket(path, name, id) {
	this._keys = [];
	this.id = id;
	this.online = 0;
	this.connections = {};
	this.name = name;
	this.isController = true;
	this.url = U.path(path);
	this.route = null;
	this.$events = {};

	// on('open', function(client) {});
	// on('close', function(client) {});
	// on('message', function(client, message) {});
	// on('error', function(error, client) {});
	// Events.EventEmitter.call(this);
}

WebSocket.prototype = {

	get repository() {
		if (this.$repository)
			return this.$repository;
		else
			return this.$repository ? this.$repository : (this.$repository = {});
	},

	get global() {
		OBSOLETE('controller.global', 'Use: G');
		return F.global;
	},

	get config() {
		OBSOLETE('controller.config', 'Use: CONF');
		return CONF;
	},

	get cache() {
		OBSOLETE('controller.cache', 'Use: F.cache or CACHE()');
		return F.cache;
	},

	get isDebug() {
		OBSOLETE('controller.isDebug', 'Use: DEBUG');
		return DEBUG;
	},

	get path() {
		OBSOLETE('controller.path', 'Use: PATH');
		return F.path;
	},

	get isSecure() {
		OBSOLETE('controller.isSecure', 'Use: controller.secured');
		return this.req.isSecure;
	},

	get secured() {
		return this.req.secured;
	},

	get params() {
		if (this.$params)
			return this.$params;
		var split = framework_internal.routeSplit(this.url, true);
		var names = this.route.paramnames;
		if (names) {
			var obj = {};
			for (var i = 0; i < names.length; i++)
				obj[names[i]] = split[this.route.param[i]];
			this.$params = obj;
			return obj;
		} else {
			this.$params = EMPTYOBJECT;
			return EMPTYOBJECT;
		}
	},

	get keys() {
		return this._keys;
	}
};


const WebSocketProto = WebSocket.prototype;

WebSocketProto.operation = function(name, value, callback, options) {
	OPERATION(name, value, callback, options, this);
	return this;
};

WebSocketProto.emit = function(name, a, b, c, d, e, f, g) {
	var evt = this.$events[name];
	if (evt) {
		var clean = false;
		for (var i = 0, length = evt.length; i < length; i++) {
			if (evt[i].$once)
				clean = true;
			evt[i].call(this, a, b, c, d, e, f, g);
		}
		if (clean) {
			evt = evt.remove(n => n.$once);
			if (evt.length)
				this.$events[name] = evt;
			else
				this.$events[name] = undefined;
		}
	}
	return this;
};

WebSocketProto.on = function(name, fn) {
	if (this.$events[name])
		this.$events[name].push(fn);
	else
		this.$events[name] = [fn];
	return this;
};

WebSocketProto.once = function(name, fn) {
	fn.$once = true;
	return this.on(name, fn);
};

WebSocketProto.removeListener = function(name, fn) {
	var evt = this.$events[name];
	if (evt) {
		evt = evt.remove(n => n === fn);
		if (evt.length)
			this.$events[name] = evt;
		else
			this.$events[name] = undefined;
	}
	return this;
};

WebSocketProto.removeAllListeners = function(name) {
	if (name === true)
		this.$events = EMPTYOBJECT;
	else if (name)
		this.$events[name] = undefined;
	else
		this.$events = {};
	return this;
};

/**
 * Sends a message
 * @param {String} message
 * @param {String Array or Function(id, client)} id (optional)
 * @param {String Array or Function(id, client)} blacklist (optional)
 * @param {Function(key, value)} replacer for JSON (optional)
 * @return {WebSocket}
 */
WebSocketProto.send = function(message, id, blacklist, replacer) {

	var self = this;
	var keys = self._keys;

	if (!keys || !keys.length || message === undefined)
		return self;

	var data;
	var raw = false;

	for (var i = 0, length = keys.length; i < length; i++) {

		var conn = self.connections[keys[i]];

		if (id) {
			if (id instanceof Array) {
				if (!websocket_valid_array(conn.id, id))
					continue;
			} else if (id instanceof Function) {
				if (!websocket_valid_fn(conn.id, conn, id, message))
					continue;
			} else
				throw new Error('Invalid "id" argument.');
		}

		if (blacklist) {
			if (blacklist instanceof Array) {
				if (websocket_valid_array(conn.id, blacklist))
					continue;
			} else if (blacklist instanceof Function) {
				if (websocket_valid_fn(conn.id, conn, blacklist, message))
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

	return self;
};

WebSocketProto.send2 = function(message, comparer, replacer, params) {

	var self = this;
	var keys = self._keys;
	if (!keys || !keys.length || message === undefined)
		return self;

	if (!params && replacer != null && typeof(replacer) !== 'function') {
		params = replacer;
		replacer = null;
	}

	var data;
	var raw = false;

	for (var i = 0, length = keys.length; i < length; i++) {

		var conn = self.connections[keys[i]];

		if (data === undefined) {
			if (conn.type === 3) {
				raw = true;
				data = JSON.stringify(message, replacer);
			} else
				data = message;
		}

		if (comparer && !comparer(conn, message, params))
			continue;

		conn.send(data, raw);
		F.stats.response.websocket++;
	}

	return self;
};

function websocket_valid_array(id, arr) {
	return arr.indexOf(id) !== -1;
}

function websocket_valid_fn(id, client, fn, msg) {
	return fn && fn(id, client, msg) ? true : false;
}

/**
 * Sends a ping message
 * @return {WebSocket}
 */
WebSocketProto.ping = function() {

	var keys = this._keys;
	if (!keys)
		return this;

	var length = keys.length;
	if (length) {
		this.$ping = true;
		F.stats.other.websocketPing++;
		for (var i = 0; i < length; i++)
			this.connections[keys[i]].ping();
	}

	return this;
};

/**
 * Closes a connection
 * @param {String Array} id Client id, optional, default `null`.
 * @param {String} message A message for the browser.
 * @param {Number} code Optional default 1000.
 * @return {Websocket}
 */
WebSocketProto.close = function(id, message, code) {

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
			this.$remove(_id);
		}
		this.$refresh();
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
		this.$remove(_id);
	}

	this.$refresh();
	return this;
};

/**
 * Error caller
 * @param {Error/String} err
 * @return {WebSocket/Function}
 */
WebSocketProto.error = function(err) {
	var result = F.error(typeof(err) === 'string' ? new Error(err) : err, this.name, this.path);
	return err ? this : result;
};

/**
 * Creates a problem
 * @param {String} message
 * @return {WebSocket}
 */
WebSocketProto.wtf = WebSocketProto.problem = function(message) {
	F.problem(message, this.name, this.uri);
	return this;
};

/**
 * Creates a change
 * @param {String} message
 * @return {WebSocket}
 */
WebSocketProto.change = function(message) {
	F.change(message, this.name, this.uri, this.ip);
	return this;
};

/**
 * The method executes a provided function once per client.
 * @param {Function(connection, index)} fn
 * @return {WebSocket}
 */
WebSocketProto.all = function(fn) {
	var arr = fn == null || fn == true ? [] : null;
	var self = this;
	if (self._keys) {
		for (var i = 0, length = self._keys.length; i < length; i++) {
			if (arr)
				arr.push(self.connections[self._keys[i]]);
			else
				fn(self.connections[self._keys[i]], i);
		}
	}
	return arr ? arr : self;
};

/**
 * Finds a connection
 * @param {String} id
 * @return {WebSocketClient}
 */
WebSocketProto.find = function(id) {
	var self = this;

	if (!self._keys)
		return self;

	var length = self._keys.length;
	var isFn = typeof(id) === 'function';

	for (var i = 0; i < length; i++) {
		var connection = self.connections[self._keys[i]];
		if (isFn) {
			if (id(connection, connection.id))
				return connection;
		} else if (connection.id === id)
			return connection;
	}
	return null;
};

/**
 * Destroys a WebSocket controller
 * @param {String} problem Optional.
 * @return {WebSocket}
 */
WebSocketProto.destroy = function(problem) {
	var self = this;

	problem && self.problem(problem);
	if (!self.connections && !self._keys)
		return self;

	self.close();
	self.$events.destroy && self.emit('destroy');

	setTimeout(function() {

		for (var i = 0; i < self._keys.length; i++) {
			var key = self._keys[i];
			var conn = self.connections[key];
			if (conn) {
				conn._isClosed = true;
				conn.socket.removeAllListeners();
			}
		}

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
WebSocketProto.autodestroy = function(callback) {
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
WebSocketProto.$refresh = function() {
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
WebSocketProto.$remove = function(id) {
	if (this.connections)
		delete this.connections[id];
	return this;
};

/**
 * Internal function
 * @param {WebSocketClient} client
 * @return {WebSocket}
 */
WebSocketProto.$add = function(client) {
	this.connections[client._id] = client;
	return this;
};

/**
 * A resource header
 * @param {String} name A resource name.
 * @param {String} key A resource key.
 * @return {String}
 */
WebSocketProto.resource = function(name, key) {
	return F.resource(name, key);
};

WebSocketProto.log = function() {
	F.log.apply(framework, arguments);
	return this;
};

WebSocketProto.logger = function() {
	F.logger.apply(framework, arguments);
	return this;
};

WebSocketProto.check = function() {
	this.$ping && this.all(websocketcheck_ping);
	return this;
};

function websocketcheck_ping(client) {
	if (!client.$ping) {
		client.close();
		F.stats.other.websocketCleaner++;
	}
}

/**
 * WebSocket controller
 * @param {Request} req
 * @param {Socket} socket
 */
function WebSocketClient(req, socket) {
	this.$ping = true;
	this.container;
	this._id;
	this.id = '';
	this.socket = socket;
	this.req = req;

	// this.isClosed = false;
	this.errors = 0;
	this.length = 0;
	this.current = {};

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

	get headers() {
		return this.req.headers;
	},

	get uri() {
		return this.req.uri;
	},

	get config() {
		OBSOLETE('controller.config', 'Use: CONF');
		return this.container.config;
	},

	get global() {
		OBSOLETE('controller.global', 'Use: G');
		return this.container.global;
	},

	get sessionid() {
		return this.req.sessionid;
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

	get mobile() {
		return this.req.mobile;
	}
};

const WebSocketClientProto = WebSocketClient.prototype;

WebSocketClientProto.isWebSocket = true;

WebSocketClientProto.cookie = function(name) {
	return this.req.cookie(name);
};

WebSocketClientProto.$close = function(code, message) {

	var self = this;

	if ((self.req.headers['user-agent'] || '').indexOf('Total.js') !== -1) {
		self.close();
		return;
	}

	var header = SOCKET_RESPONSE.format(self.$websocket_key(self.req));
	self.socket.write(Buffer.from(header, 'binary'));
	self.ready = true;
	self.close(message, code);

	setTimeout(function(self) {
		self.req = null;
		self.socket = null;
	}, 1000, self);

	return self;
};

WebSocketClientProto.prepare = function(flags, protocols, allow, length) {

	flags = flags || EMPTYARRAY;
	protocols = protocols || EMPTYARRAY;
	allow = allow || EMPTYARRAY;

	var self = this;

	if (SOCKET_ALLOW_VERSION.indexOf(U.parseInt(self.req.headers['sec-websocket-version'])) === -1)
		return false;

	self.length = length;

	var origin = self.req.headers.origin || '';
	var length = allow.length;

	if (length && allow.indexOf('*') === -1) {
		var is = false;
		for (var i = 0; i < length; i++) {
			if (origin.indexOf(allow[i]) !== -1) {
				is = true;
				break;
			}
		}
		if (!is)
			return false;
	}

	length = protocols.length;
	if (length) {
		for (var i = 0; i < length; i++) {
			if (self.protocol.indexOf(protocols[i]) === -1)
				return false;
		}
	}

	var compress = (CONF.allow_websocket_compression && self.req.headers['sec-websocket-extensions'] || '').indexOf('permessage-deflate') !== -1;
	var header = protocols.length ? (compress ? SOCKET_RESPONSE_PROTOCOL_COMPRESS : SOCKET_RESPONSE_PROTOCOL).format(self.$websocket_key(self.req), protocols.join(', ')) : (compress ? SOCKET_RESPONSE_COMPRESS : SOCKET_RESPONSE).format(self.$websocket_key(self.req));

	self.socket.write(Buffer.from(header, 'binary'));
	self.ready = true;

	if (compress) {
		self.inflatepending = [];
		self.inflatelock = false;
		self.inflate = Zlib.createInflateRaw(WEBSOCKET_COMPRESS_OPTIONS);
		self.inflate.$websocket = self;
		self.inflate.on('error', function() {
			if (!self.$uerror) {
				self.$uerror = true;
				self.close('Invalid data', 1003);
			}
		});
		self.inflate.on('data', websocket_inflate);

		self.deflatepending = [];
		self.deflatelock = false;
		self.deflate = Zlib.createDeflateRaw(WEBSOCKET_COMPRESS_OPTIONS);
		self.deflate.$websocket = self;
		self.deflate.on('error', function() {
			if (!self.$uerror) {
				self.$uerror = true;
				self.close('Invalid data', 1003);
			}
		});
		self.deflate.on('data', websocket_deflate);
	}

	self._id = Date.now() + U.GUID(5);
	self.id = self._id;
	return true;
};

function websocket_inflate(data) {
	var ws = this.$websocket;
	if (ws && ws.inflatechunks) {
		ws.inflatechunks.push(data);
		ws.inflatechunkslength += data.length;
	}
}

function websocket_deflate(data) {
	var ws = this.$websocket;
	if (ws && ws.deflatechunks) {
		ws.deflatechunks.push(data);
		ws.deflatechunkslength += data.length;
	}
}

/**
 * Add a container to client
 * @param {WebSocket} container
 * @return {WebSocketClient}
 */
WebSocketClientProto.upgrade = function(container) {
	var self = this;
	self.req.on('error', websocket_onerror);
	self.container = container;
	self.socket.$websocket = this;
	self.socket.on('data', websocket_ondata);
	self.socket.on('error', websocket_onerror);
	self.socket.on('close', websocket_close);
	self.socket.on('end', websocket_close);
	self.container.$add(self);
	self.container.$refresh();
	F.$events['websocket-begin'] && EMIT('websocket-begin', self.container, self);
	F.$events.websocket_begin && EMIT('websocket_begin', self.container, self);
	self.container.$events.open && self.container.emit('open', self);
	F.stats.performance.online++;
	return self;
};

function websocket_ondata(chunk) {
	this.$websocket.$ondata(chunk);
}

function websocket_onerror(e) {
	this.destroy && this.destroy();
	this.$websocket.$onerror(e);
}

function websocket_close() {
	this.destroy && this.destroy();
	this.$websocket.$onclose();
}

WebSocketClientProto.$ondata = function(data) {

	var self = this;

	if (self.isClosed)
		return;

	var current = self.current;

	if (data) {
		if (current.buffer) {
			CONCAT[0] = current.buffer;
			CONCAT[1] = data;
			current.buffer = Buffer.concat(CONCAT);
		} else
			current.buffer = data;
	}

	if (!self.$parse())
		return;

	if (!current.final && current.type !== 0x00)
		current.type2 = current.type;

	var decompress = current.compressed && self.inflate;
	var tmp;

	switch (current.type === 0x00 ? current.type2 : current.type) {
		case 0x01:

			// text
			if (decompress) {
				current.final && self.parseInflate();
			} else {
				tmp = self.$readbody();
				if (current.body) {
					CONCAT[0] = current.body;
					CONCAT[1] = tmp;
					current.body = Buffer.concat(CONCAT);
				} else
					current.body = tmp;
				current.final && self.$decode();
			}

			break;

		case 0x02:

			// binary
			if (decompress) {
				current.final && self.parseInflate();
			} else {
				tmp = self.$readbody();
				if (current.body) {
					CONCAT[0] = current.body;
					CONCAT[1] = tmp;
					current.body = Buffer.concat(CONCAT);
				} else
					current.body = tmp;
				current.final && self.$decode();
			}

			break;

		case 0x08:
			// close
			self.closemessage = current.buffer.slice(4).toString('utf8');
			self.closecode = current.buffer[2] << 8 | current.buffer[3];

			if (self.closemessage && self.container.encodedecode)
				self.closemessage = $decodeURIComponent(self.closemessage);

			self.close();
			break;

		case 0x09:
			// ping, response pong
			self.socket.write(U.getWebSocketFrame(0, 'PONG', 0x0A));
			current.buffer = null;
			current.inflatedata = null;
			self.$ping = true;
			break;

		case 0x0a:
			// pong
			self.$ping = true;
			current.buffer = null;
			current.inflatedata = null;
			break;
	}

	if (current.buffer) {
		current.buffer = current.buffer.slice(current.length, current.buffer.length);
		current.buffer.length && self.$ondata();
	}
};

function buffer_concat(buffers, length) {
	var buffer = Buffer.alloc(length);
	var offset = 0;
	for (var i = 0, n = buffers.length; i < n; i++) {
		buffers[i].copy(buffer, offset);
		offset += buffers[i].length;
	}
	return buffer;
}

// MIT
// Written by Jozef Gula
// Optimized by Peter Sirka
WebSocketClientProto.$parse = function() {

	var self = this;
	var current = self.current;

	// check end message

	// Long messages doesn't work because 0x80 still returns 0
	// if (!current.buffer || current.buffer.length <= 2 || ((current.buffer[0] & 0x80) >> 7) !== 1)
	if (!current.buffer || current.buffer.length <= 2)
		return;

	// WebSocket - Opcode
	current.type = current.buffer[0] & 0x0f;
	current.compressed = (current.buffer[0] & 0x40) === 0x40;

	// is final message?
	current.final = ((current.buffer[0] & 0x80) >> 7) === 0x01;

	// does frame contain mask?
	current.isMask = ((current.buffer[1] & 0xfe) >> 7) === 0x01;

	// data length
	var length = U.getMessageLength(current.buffer, F.isLE);
	// index for data

	// Solving a problem with The value "-1" is invalid for option "size"
	if (length <= 0)
		return;

	var index = current.buffer[1] & 0x7f;
	index = ((index === 126) ? 4 : (index === 127 ? 10 : 2)) + (current.isMask ? 4 : 0);

	// total message length (data + header)
	var mlength = index + length;

	if (mlength > this.length) {
		this.close('Frame is too large', 1009);
		return;
	}

	// Check length of data
	if (current.buffer.length < mlength)
		return;

	current.length = mlength;

	// Not Ping & Pong
	if (current.type !== 0x09 && current.type !== 0x0A) {

		// does frame contain mask?
		if (current.isMask) {
			current.mask = Buffer.alloc(4);
			current.buffer.copy(current.mask, 0, index - 4, index);
		}

		if (current.compressed && this.inflate) {

			var buf = Buffer.alloc(length);
			current.buffer.copy(buf, 0, index, mlength);

			// does frame contain mask?
			if (current.isMask) {
				for (var i = 0; i < length; i++)
					buf[i] = buf[i] ^ current.mask[i % 4];
			}

			// Does the buffer continue?
			buf.$continue = current.final === false;
			this.inflatepending.push(buf);
		} else {
			current.data = Buffer.alloc(length);
			current.buffer.copy(current.data, 0, index, mlength);
		}
	}

	return true;
};

WebSocketClientProto.$readbody = function() {
	var current = this.current;
	var length = current.data.length;
	var buf = Buffer.alloc(length);
	for (var i = 0; i < length; i++) {
		// does frame contain mask?
		if (current.isMask)
			buf[i] = current.data[i] ^ current.mask[i % 4];
		else
			buf[i] = current.data[i];
	}
	return buf;
};

WebSocketClientProto.$decode = function() {

	var data = this.current.body;
	F.stats.performance.message++;

	// Buffer
	if (this.typebuffer) {
		this.container.emit('message', this, data);
		return;
	}

	switch (this.type) {

		case 1: // BINARY
			// this.container.emit('message', this, new Uint8Array(data).buffer);
			this.container.emit('message', this, data);
			break;

		case 3: // JSON

			if (data instanceof Buffer)
				data = data.toString(ENCODING);

			if (this.container.encodedecode === true)
				data = $decodeURIComponent(data);

			if (data.isJSON()) {
				var tmp = F.onParseJSON(data, this.req);
				if (tmp !== undefined)
					this.container.emit('message', this, tmp);
			}
			break;

		default: // TEXT
			if (data instanceof Buffer)
				data = data.toString(ENCODING);
			this.container.emit('message', this, this.container.encodedecode === true ? $decodeURIComponent(data) : data);
			break;
	}

	this.current.body = null;
};

WebSocketClientProto.parseInflate = function() {
	var self = this;

	if (self.inflatelock)
		return;

	var buf = self.inflatepending.shift();
	if (buf) {
		self.inflatechunks = [];
		self.inflatechunkslength = 0;
		self.inflatelock = true;
		self.inflate.write(buf);
		!buf.$continue && self.inflate.write(Buffer.from(WEBSOCKET_COMPRESS));
		self.inflate.flush(function() {

			if (!self.inflatechunks)
				return;

			var data = buffer_concat(self.inflatechunks, self.inflatechunkslength);

			self.inflatechunks = null;
			self.inflatelock = false;

			if (data.length > self.length) {
				self.close('Frame is too large', 1009);
				return;
			}

			if (self.current.body) {
				CONCAT[0] = self.current.body;
				CONCAT[1] = data;
				self.current.body = Buffer.concat(CONCAT);
			} else
				self.current.body = data;

			!buf.$continue && self.$decode();
			self.parseInflate();
		});
	}
};

WebSocketClientProto.$onerror = function(err) {

	if (this.isClosed)
		return;

	if (REG_WEBSOCKET_ERROR.test(err.stack)) {
		this.isClosed = true;
		this.$onclose();
	} else
		this.container.$events.error && this.container.emit('error', err, this);
};

WebSocketClientProto.$onclose = function() {

	if (this._isClosed)
		return;

	F.stats.performance.online--;
	this.isClosed = true;
	this._isClosed = true;

	if (this.inflate) {
		this.inflate.removeAllListeners();
		this.inflate = null;
		this.inflatechunks = null;
	}

	if (this.deflate) {
		this.deflate.removeAllListeners();
		this.deflate = null;
		this.deflatechunks = null;
	}

	this.container.$remove(this._id);
	this.container.$refresh();
	this.container.$events.close && this.container.emit('close', this, this.closecode, this.closemessage);
	this.socket.removeAllListeners();
	F.$events['websocket-end'] && EMIT('websocket-end', this.container, this);
	F.$events.websocket_end && EMIT('websocket_end', this.container, this);
};

/**
 * Sends a message
 * @param {String/Object} message
 * @param {Boolean} raw The message won't be converted e.g. to JSON.
 * @return {WebSocketClient}
 */
WebSocketClientProto.send = function(message, raw, replacer) {

	var self = this;

	if (self.isClosed)
		return self;

	if (self.type !== 1) {
		var data = self.type === 3 ? (raw ? message : JSON.stringify(message, replacer)) : typeof(message) === 'object' ? JSON.stringify(message, replacer) : message.toString();
		if (self.container.encodedecode === true && data)
			data = encodeURIComponent(data);
		if (self.deflate) {
			self.deflatepending.push(Buffer.from(data));
			self.sendDeflate();
		} else
			self.socket.write(U.getWebSocketFrame(0, data, 0x01));
	} else if (message) {
		if (self.deflate) {
			self.deflatepending.push(Buffer.from(message));
			self.sendDeflate();
		} else
			self.socket.write(U.getWebSocketFrame(0, new Int8Array(message), 0x02));
	}

	return self;
};

WebSocketClientProto.sendDeflate = function() {
	var self = this;

	if (self.deflatelock)
		return;

	var buf = self.deflatepending.shift();
	if (buf) {
		self.deflatechunks = [];
		self.deflatechunkslength = 0;
		self.deflatelock = true;
		self.deflate.write(buf);
		self.deflate.flush(function() {
			if (self.deflatechunks) {
				var data = buffer_concat(self.deflatechunks, self.deflatechunkslength);
				data = data.slice(0, data.length - 4);
				self.deflatelock = false;
				self.deflatechunks = null;
				self.socket.write(U.getWebSocketFrame(0, data, self.type === 1 ? 0x02 : 0x01, true));
				self.sendDeflate();
			}
		});
	}
};

/**
 * Ping message
 * @return {WebSocketClient}
 */
WebSocketClientProto.ping = function() {
	if (!this.isClosed) {
		this.socket.write(U.getWebSocketFrame(0, 'PING', 0x09));
		this.$ping = false;
	}
	return this;
};

/**
 * Close connection
 * @param {String} message Message.
 * @param {Number} code WebSocket code.
 * @return {WebSocketClient}
 */
WebSocketClientProto.close = function(message, code) {
	var self = this;
	if (!self.isClosed) {
		self.isClosed = true;
		if (self.ready) {
			if (message && self.container && self.container.encodedecode)
				message = encodeURIComponent(message);
			self.socket.end(U.getWebSocketFrame(code || 1000, message || '', 0x08));
		} else
			self.socket.end();
		self.req.connection.destroy();
	}
	return self;
};

/**
 * Create a signature for the WebSocket
 * @param {Request} req
 * @return {String}
 */
WebSocketClientProto.$websocket_key = function(req) {
	var sha1 = Crypto.createHash('sha1');
	sha1.update((req.headers['sec-websocket-key'] || '') + SOCKET_HASH);
	return sha1.digest('base64');
};

// *********************************************************************************
// =================================================================================
// Prototypes
// =================================================================================
// *********************************************************************************

function req_authorizecallback(isAuthorized, user, $) {

	// @isAuthorized "null" for callbacks(err, user)
	// @isAuthorized "true"
	// @isAuthorized "object" is as user but "user" must be "undefined"

	if (isAuthorized instanceof Error || isAuthorized instanceof ErrorBuilder) {
		// Error handling
		isAuthorized = false;
	} else if (isAuthorized == null && user) {
		// A callback error handling
		isAuthorized = true;
	} else if (user == null && isAuthorized && isAuthorized !== true) {
		user = isAuthorized;
		isAuthorized = true;
	}

	$.req.isAuthorized = isAuthorized;
	$.req.authorizecallback(null, user, isAuthorized);
	$.req.authorizecallback = null;
}

function req_authorizetotal(isAuthorized, user, $) {

	// @isAuthorized "null" for callbacks(err, user)
	// @isAuthorized "true"
	// @isAuthorized "object" is as user but "user" must be "undefined"

	var req = $.req;
	var roles = req.flagslength !== req.flags.length;

	if (roles) {
		req.$flags += req.flags.slice(req.flagslength).join('');
		req.$roles = true;
	}

	req.flagslength = undefined;

	if (isAuthorized instanceof Error || isAuthorized instanceof ErrorBuilder) {
		// Error handling
		isAuthorized = false;
	} else if (isAuthorized == null && user) {
		// A callback error handling
		isAuthorized = true;
	} else if (user == null && isAuthorized && isAuthorized !== true) {
		user = isAuthorized;
		isAuthorized = true;
	}

	req.isAuthorized = isAuthorized;
	req.$total_authorize(isAuthorized, user, roles);
}

function extend_request(PROTO) {

	PROTOREQ = PROTO;

	Object.defineProperty(PROTO, 'ip', {
		get: function() {
			if (this._ip)
				return this._ip;

			//  x-forwarded-for: client, proxy1, proxy2, ...
			var proxy = this.headers['x-forwarded-for'];
			if (proxy)
				this._ip = proxy.split(',', 1)[0] || this.connection.remoteAddress;
			else if (!this._ip)
				this._ip = this.connection.remoteAddress;

			return this._ip;
		}
	});

	Object.defineProperty(PROTO, 'query', {
		get: function() {
			!this._querydata && F.$onParseQueryUrl(this);
			return this._querydata;
		},
		set: function(value) {
			this._querydata = value;
		}
	});

	Object.defineProperty(PROTO, 'subdomain', {
		get: function() {
			if (this._subdomain)
				return this._subdomain;
			var subdomain = this.uri.hostname.toLowerCase().replace(REG_WWW, '').split('.');
			if (subdomain.length > 2) // example: [subdomain].domain.com
				this._subdomain = subdomain.slice(0, subdomain.length - 2);
			else if (subdomain.length > 1 && subdomain[subdomain.length - 1] === 'localhost') // example: [subdomain].localhost
				this._subdomain = subdomain.slice(0, subdomain.length - 1);
			else
				this._subdomain = null;
			return this._subdomain;
		}
	});

	Object.defineProperty(PROTO, 'host', {
		get: function() {
			return this.headers['host'];
		}
	});

	Object.defineProperty(PROTO, 'split', {
		get: function() {
			return this.$path ? this.$path : this.$path = framework_internal.routeSplit(this.uri.pathname, true);
		}
	});

	Object.defineProperty(PROTO, 'secured', {
		get: function() {
			return this.uri.protocol === 'https:' || this.uri.protocol === 'wss:';
		}
	});

	Object.defineProperty(PROTO, 'language', {
		get: function() {
			if (!this.$language)
				this.$language = (((this.headers['accept-language'] || '').split(';')[0] || '').split(',')[0] || '').toLowerCase();
			return this.$language;
		},
		set: function(value) {
			this.$language = value;
		}
	});

	Object.defineProperty(PROTO, 'ua', {
		get: function() {
			if (this.$ua === undefined)
				this.$ua = (this.headers['user-agent'] || '').parseUA();
			return this.$ua;
		}
	});

	Object.defineProperty(PROTO, 'mobile', {
		get: function() {
			if (this.$mobile === undefined)
				this.$mobile = REG_MOBILE.test(this.headers['user-agent']);
			return this.$mobile;
		}
	});

	Object.defineProperty(PROTO, 'robot', {
		get: function() {
			if (this.$robot === undefined)
				this.$robot = REG_ROBOT.test(this.headers['user-agent']);
			return this.$robot;
		}
	});

	/**
	 * Signature request (user-agent + ip + referer + current URL + custom key)
	 * @param {String} key Custom key.
	 * @return {Request}
	 */
	PROTO.signature = function(key) {
		return F.encrypt((this.headers['user-agent'] || '') + '#' + this.ip + '#' + this.url + '#' + (key || ''), 'request-signature', false);
	};

	PROTO.localize = function() {
		F.onLocale && (this.$language = F.onLocale(this, this.res, this.isStaticFile));
		return this.$language;
	};

	/**
	 * Disable HTTP cache for current request
	 * @return {Request}
	 */
	PROTO.noCache = PROTO.nocache = function() {
		this.res && this.res.noCache();
		return this;
	};

	PROTO.useragent = function(structured) {
		var key = structured ? '$ua2' : '$ua';
		return this[key] ? this[key] : this[key] = (this.headers['user-agent'] || '').parseUA(structured);
	};

	/**
	 * Read a cookie from current request
	 * @param {String} name Cookie name.
	 * @return {String} Cookie value (default: '')
	 */
	PROTO.cookie = function(name) {

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
	PROTO.authorization = function() {

		var authorization = this.headers['authorization'];
		if (!authorization)
			return HEADERS.authorization;

		var result = { user: '', password: '', empty: true };

		try {
			var arr = Buffer.from(authorization.replace('Basic ', '').trim(), 'base64').toString(ENCODING).split(':');
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
	PROTO.authorize = function(callback) {

		var req = this;

		if (!F.onAuthorize) {
			callback(null, null, false);
			return req;
		}

		if (F.onAuthorize.$newversion) {
			req.authorizecallback = callback;
			F.onAuthorize(req, req.res, req.flags, req_authorizecallback);
			return req;
		}

		F.onAuthorize(req, req.res, req.flags || [], function(isAuthorized, user) {

			if (!F.onAuthorize.isobsolete) {
				F.onAuthorize.isobsolete = 1;
				OBSOLETE('F.onAuthorize', 'You need to use a new authorization declaration: "AUTH(function($) {})"');
			}

			// @isAuthorized "null" for callbacks(err, user)
			// @isAuthorized "true"
			// @isAuthorized "object" is as user but "user" must be "undefined"

			if (isAuthorized instanceof Error || isAuthorized instanceof ErrorBuilder) {
				// Error handling
				isAuthorized = false;
			} else if (isAuthorized == null && user) {
				// A callback error handling
				isAuthorized = true;
			} else if (user == null && isAuthorized && isAuthorized !== true) {
				user = isAuthorized;
				isAuthorized = true;
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
	PROTO.clear = function(isAuto) {

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
	PROTO.hostname = function(path) {

		var self = this;
		var uri = self.uri;

		if (path && path[0] !== '/')
			path = '/' + path;

		return uri.protocol + '//' + uri.hostname + (uri.port && uri.port !== 80 ? ':' + uri.port : '') + (path || '');
	};

	PROTO.filecache = function(callback) {
		F.exists(this, this.res, 20, callback);
	};

	PROTO.$total_success = function() {
		this.$total_timeout && clearTimeout(this.$total_timeout);
		this.$total_canceled = true;
		if (this.controller) {
			this.controller.res.controller = null;
			this.controller = null;
		}
	};

	PROTO.$total_file = function() {
		var h = this.method[0];
		if (h === 'G' || h === 'H')
			this.$total_endfile();
		else
			this.on('end', this.$total_endfile);
	};

	PROTO.$total_multipart = function(header) {
		F.stats.request.upload++;
		this.$total_route = F.lookup(this, this.uri.pathname, this.flags, 0);
		this.$total_header = header;
		if (this.$total_route) {
			F.path.verify('temp');
			framework_internal.parseMULTIPART(this, header, this.$total_route, CONF.directory_temp);
		} else
			this.$total_status(404);
	};

	PROTO.$total_urlencoded = function() {
		this.$total_route = F.lookup(this, this.uri.pathname, this.flags, 0);
		if (this.$total_route) {
			this.buffer_has = true;
			this.buffer_exceeded = false;
			this.on('data', this.$total_parsebody);
			this.$total_end();
		} else
			this.$total_status(404);
	};

	PROTO.$total_status = function(status) {

		if (status == null)
			F.stats.request.blocked++;
		else
			F.stats.request['error' + status]++;

		F.reqstats(false, false);
		this.res.writeHead(status);
		this.res.end(U.httpStatus(status));
		F.$events['request-end'] && EMIT('request-end', this, this.res);
		F.$events.request_end && EMIT('request_end', this, this.res);
		this.clear(true);
	};

	PROTO.$total_end = function() {
		var h = this.method[0];
		if (h === 'G' || h === 'H' || h === 'O') {
			if (this.$total_route && this.$total_route.schema)
				this.$total_schema = true;
			this.buffer_data = null;
			this.$total_prepare();
		} else
			this.on('end', this.$total_end2);
	};

	PROTO.$total_execute = function(status, isError) {

		var route = this.$total_route;
		var res = this.res;

		if (isError || !route) {
			var key = 'error' + status;
			F.stats.response[key]++;
			status !== 500 && F.$events.error && EMIT('error', this, res, this.$total_exception);

			if (status === 408) {
				if (F.timeouts.push((NOW = new Date()).toJSON() + ' ' + this.url) > 5)
					F.timeouts.shift();
			}

			F.$events[key] && EMIT(key, this, res, this.$total_exception);
		}

		if (!route) {
			if (status === 400 && this.$total_exception instanceof framework_builders.ErrorBuilder) {
				F.stats.response.errorBuilder++;
				this.$language && this.$total_exception.setResource(this.$language);
				res.options.body = this.$total_exception.output(true);
				res.options.code = this.$total_exception.status;
				res.options.type = this.$total_exception.contentType;
				res.$text();
			} else {

				MODELERROR.code = status;
				MODELERROR.status = U.httpStatus(status, false);
				MODELERROR.error = this.$total_exception ? prepare_error(this.$total_exception) : null;

				res.options.body = VIEW('.' + PATHMODULES + 'error', MODELERROR);
				res.options.type = CT_HTML;
				res.options.code = status || 404;
				res.$text();
			}
			return;
		}

		var name = route.controller;

		if (route.isMOBILE_VARY)
			this.$mobile = true;

		if (route.currentViewDirectory === undefined)
			route.currentViewDirectory = name && name[0] !== '#' && name !== 'default' && name !== 'unknown' ? '/' + name + '/' : '';

		var controller = new Controller(name, this, res, route.currentViewDirectory);

		controller.isTransfer = this.$total_transfer;
		controller.exception = this.$total_exception;
		this.controller = controller;

		if (!this.$total_canceled && route.timeout) {
			this.$total_timeout && clearTimeout(this.$total_timeout);
			this.$total_timeout = setTimeout(subscribe_timeout, route.timeout, this);
		}

		route.isDELAY && res.writeContinue();

		if (this.$total_schema)
			this.body.$$controller = controller;

		if (route.middleware)
			async_middleware(0, this, res, route.middleware, subscribe_timeout_middleware, route.options, controller);
		else
			this.$total_execute2();
	};

	PROTO.$total_execute2 = function() {

		var name = this.$total_route.controller;
		var controller = this.controller;

		try {

			if (F.onTheme)
				controller.themeName = F.onTheme(controller);

			if (controller.isCanceled)
				return;

			var ctrlname = '@' + name;
			F.$events.controller && EMIT('controller', controller, name, this.$total_route.options);
			F.$events[ctrlname] && EMIT(ctrlname, controller, name, this.$total_route.options);

			if (controller.isCanceled)
				return;

			if (!controller.isTransfer && this.$total_route.isCACHE && !F.temporary.other[this.uri.pathname])
				F.temporary.other[this.uri.pathname] = this.path;

			if (this.$total_route.isGENERATOR)
				async.call(controller, this.$total_route.execute, true)(controller, framework_internal.routeParam(this.$total_route.param.length ? this.split : this.path, this.$total_route));
			else {
				if (this.$total_route.param.length) {
					var params = framework_internal.routeParam(this.split, this.$total_route);
					controller.id = params[0];
					this.$total_route.execute.apply(controller, params);
				} else
					this.$total_route.execute.call(controller);
			}

		} catch (err) {
			F.error(err, name, this.uri);
			this.$total_exception = err;
			this.$total_route = F.lookup(this, '#500', EMPTYARRAY, 0);
			this.$total_execute(500, true);
		}
	};

	PROTO.$total_parsebody = function(chunk) {

		if (this.buffer_exceeded)
			return;

		if (!this.buffer_exceeded) {
			CONCAT[0] = this.buffer_data;
			CONCAT[1] = chunk;
			this.buffer_data = Buffer.concat(CONCAT);
		}

		if ((this.buffer_data.length / 1024) < this.$total_route.length)
			return;

		this.buffer_exceeded = true;
		this.buffer_data = Buffer.alloc(0);
	};

	PROTO.$total_cancel = function() {
		F.stats.response.timeout++;
		clearTimeout(this.$total_timeout);
		if (!this.controller)
			return;
		this.controller.isTimeout = true;
		this.controller.isCanceled = true;
		this.$total_route = F.lookup(this, '#408', EMPTYARRAY, 0);
		this.$total_execute(408, true);
	};

	PROTO.$total_validate = function(route, next, code) {

		var self = this;
		self.$total_schema = false;

		if (!self.$total_route.schema)
			return next(self, code);

		if (!self.$total_route.schema[1]) {
			F.stats.request.operation++;
			return next(self, code);
		}

		F.onSchema(self, self.$total_route, function(err, body) {
			if (err) {
				self.$total_400(err);
				next = null;
			} else {
				F.stats.request.schema++;
				self.body = body;
				self.$total_schema = true;
				next(self, code);
			}
		});
	};

	PROTO.$total_authorize = function(isLogged, user, roles) {

		var membertype = isLogged ? 1 : 2;
		var code = this.buffer_exceeded ? 431 : 401;

		this.$flags += membertype;
		user && (this.user = user);

		if (this.$total_route && this.$total_route.isUNIQUE && !roles && (!this.$total_route.MEMBER || this.$total_route.MEMBER === membertype)) {
			if (code === 401 && this.$total_schema)
				this.$total_validate(this.$total_route, subscribe_validate_callback, code);
			else
				this.$total_execute(code, true);
		} else {
			var route = F.lookup(this, this.buffer_exceeded ? '#431' : this.uri.pathname, this.flags, this.buffer_exceeded ? 0 : membertype);
			var status = this.$isAuthorized ? 404 : 401;
			var code = this.buffer_exceeded ? 431 : status;
			!route && (route = F.lookup(this, '#' + status, EMPTYARRAY, 0));

			this.$total_route = route;

			if (this.$total_route && this.$total_schema)
				this.$total_validate(this.$total_route, subscribe_validate_callback, code);
			else
				this.$total_execute(code);
		}
	};

	PROTO.$total_end2 = function() {

		var route = this.$total_route;

		if (this.buffer_exceeded) {
			route = F.lookup(this, '#431', EMPTYARRAY, 0);
			this.buffer_data = null;
			if (route) {
				this.$total_route = route;
				this.$total_execute(431, true);
			} else
				this.res.throw431();
			return;
		}

		if (this.buffer_data && (!route || !route.isBINARY))
			this.buffer_data = this.buffer_data.toString(ENCODING);

		if (!this.buffer_data) {
			if (route && route.schema)
				this.$total_schema = true;
			this.buffer_data = null;
			this.$total_prepare();
			return;
		}

		if (route.isXML) {

			if (this.$type !== 2) {
				this.$total_400('Invalid "Content-Type".');
				this.buffer_data = null;
				return;
			}

			try {
				F.$onParseXML(this);
				this.buffer_data = null;
				this.$total_prepare();
			} catch (err) {
				F.error(err, null, this.uri);
				this.$total_500(err);
			}

			return;
		}

		if (route.isRAW) {
			this.body = this.buffer_data;
			this.buffer_data = null;
			this.$total_prepare();
			return;
		}

		if (!this.$type) {
			this.buffer_data = null;
			this.$total_400('Invalid "Content-Type".');
			return;
		}

		if (this.$type === 1) {
			try {
				F.$onParseJSON(this);
				this.buffer_data = null;
			} catch (e) {
				this.$total_400('Invalid JSON data.');
				return;
			}
		} else {

			for (var i = 0; i < this.buffer_data.length - 2; i++) {
				if (this.buffer_data[i] === '%' && this.buffer_data[i + 1] === '0' && this.buffer_data[i + 2] === '0') {
					this.buffer_data = null;
					this.$total_400('Not allowed chars in the request body.');
					return;
				}
			}

			F.$onParseQueryBody(this);
		}

		route.schema && (this.$total_schema = true);
		this.buffer_data = null;
		this.$total_prepare();
	};

	PROTO.$total_endfile = function() {

		var req = this;
		var res = this.res;

		if (!F._length_files)
			return res.continue();

		for (var i = 0; i < F.routes.files.length; i++) {

			var file = F.routes.files[i];
			// try {

			if (file.extensions && !file.extensions[req.extension])
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

			} else if (file.onValidate && !file.onValidate(req, res, true))
				continue;

			if (file.middleware)
				req.$total_endfilemiddleware(file);
			else
				file.execute(req, res, false);

			return;
		}

		res.continue();
	};

	PROTO.$total_endfilemiddleware = function(file) {
		this.$total_filemiddleware = file;
		async_middleware(0, this, this.res, file.middleware, total_endmiddleware, file.options);
	};

	PROTO.$total_400 = function(problem) {
		this.$total_route = F.lookup(this, '#400', EMPTYARRAY, 0);
		this.$total_exception = problem;
		this.$total_execute(400, true);
	};

	PROTO.$total_404 = function(problem) {
		this.$total_route = F.lookup(this, '#404', EMPTYARRAY, 0);
		this.$total_exception = problem;
		this.$total_execute(404, true);
	};

	PROTO.$total_500 = function(problem) {
		this.$total_route = F.lookup(this, '#500', EMPTYARRAY, 0);
		this.$total_exception = problem;
		this.$total_execute(500, true);
	};

	PROTO.$total_prepare = function() {
		var req = this;
		var length = req.flags.length;
		if (F.onAuthorize) {

			if (F.onAuthorize.$newversion) {
				req.flagslength = length;
				F.onAuthorize(req, req.res, req.flags, req_authorizetotal);
				return;
			}

			F.onAuthorize(req, req.res, req.flags, function(isAuthorized, user) {

				if (!F.onAuthorize.isobsolete) {
					F.onAuthorize.isobsolete = 1;
					OBSOLETE('F.onAuthorize', 'You need to use a new authorization declaration: "AUTH(function($) {})"');
				}

				// @isAuthorized "null" for callbacks(err, user)
				// @isAuthorized "true"
				// @isAuthorized "object" is as user but "user" must be "undefined"

				var roles = length !== req.flags.length;

				if (roles) {
					req.$flags += req.flags.slice(length).join('');
					req.$roles = true;
				}

				if (isAuthorized instanceof Error || isAuthorized instanceof ErrorBuilder) {
					// Error handling
					isAuthorized = false;
				} else if (isAuthorized == null && user) {
					// A callback error handling
					isAuthorized = true;
				} else if (user == null && isAuthorized && isAuthorized !== true) {
					user = isAuthorized;
					isAuthorized = true;
				}

				req.isAuthorized = isAuthorized;
				req.$total_authorize(isAuthorized, user, roles);
			});

		} else {
			if (!req.$total_route)
				req.$total_route = F.lookup(req, req.buffer_exceeded ? '#431' : req.uri.pathname, req.flags, 0);
			if (!req.$total_route)
				req.$total_route = F.lookup(req, '#404', EMPTYARRAY, 0);
			var code = req.buffer_exceeded ? 431 : 404;
			if (!req.$total_schema || !req.$total_route)
				req.$total_execute(code, code);
			else
				req.$total_validate(req.$total_route, subscribe_validate_callback, code);
		}
	};

	PROTO.snapshot = function(callback) {

		var req = this;
		var builder = [];
		var keys = Object.keys(req.headers);
		var max = 0;

		for (var i = 0; i < keys.length; i++) {
			var length = keys[i].length;
			if (length > max)
				max = length;
		}

		builder.push('url'.padRight(max + 1) + ': ' + req.method.toUpperCase() + ' ' + req.url);

		for (var i = 0; i < keys.length; i++)
			builder.push(keys[i].padRight(max + 1) + ': ' + req.headers[keys[i]]);

		builder.push('');

		var data = [];
		req.on('data', chunk => data.push(chunk));
		req.on('end', function() {
			builder.push(Buffer.concat(data).toString('utf8'));
			callback(null, builder.join('\n'));
		});
	};
}

function total_endmiddleware(req) {

	if (req.total_middleware)
		req.total_middleware = null;

	try {
		req.$total_filemiddleware.execute(req, req.res, false);
	} catch (err) {
		F.error(err, req.$total_filemiddleware.controller + ' :: ' + req.$total_filemiddleware.name, req.uri);
		req.res.throw500();
	}
}

function extend_response(PROTO) {

	PROTORES = PROTO;

	/**
	 * Add a cookie into the response
	 * @param {String} name
	 * @param {Object} value
	 * @param {Date/String} expires
	 * @param {Object} options Additional options.
	 * @return {Response}
	 */
	PROTO.cookie = function(name, value, expires, options) {

		var self = this;

		if (self.headersSent || self.success)
			return;

		var cookiename = name + '=';
		var builder = [cookiename + value];
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
		expires && builder.push('Expires=' + expires.toUTCString());
		options.domain && builder.push('Domain=' + options.domain);
		options.path && builder.push('Path=' + options.path);
		options.secure && builder.push('Secure');

		if (options.httpOnly || options.httponly || options.HttpOnly)
			builder.push('HttpOnly');

		var same = options.security || options.samesite || options.sameSite;
		if (same) {
			switch (same) {
				case 1:
					same = 'lax';
					break;
				case 2:
					same = 'strict';
					break;
			}
			builder.push('SameSite=' + same);
		}

		var arr = self.getHeader('set-cookie') || [];

		// Cookie, already, can be in array, resulting in duplicate 'set-cookie' header
		if (arr.length) {
			var l = cookiename.length;
			for (var i = 0; i < arr.length; i++) {
				if (arr[i].substring(0, l) === cookiename) {
					arr.splice(i, 1);
					break;
				}
			}
		}

		arr.push(builder.join('; '));
		self.setHeader('Set-Cookie', arr);
		return self;
	};

	/**
	 * Disable HTTP cache for current response
	 * @return {Response}
	 */
	PROTO.noCache = PROTO.nocache = function() {
		var self = this;

		if (self.$nocache)
			return self;

		if (self.req) {
			delete self.req.headers['if-none-match'];
			delete self.req.headers['if-modified-since'];
		}

		if (self.getHeader(HEADER_CACHE)) {
			self.removeHeader(HEADER_CACHE);
			self.removeHeader('Expires');
			self.removeHeader('Etag');
			self.removeHeader('Last-Modified');
			self.setHeader(HEADER_CACHE, 'private, no-cache, no-store, max-age=0');
			self.setHeader('Expires', -1);
		}

		self.$nocache = true;
		return self;
	};

	// For express middleware
	PROTO.status = function(code) {
		this.options.code = code;
		return this;
	};

	// For express middleware
	PROTO.send = function(code, body, type) {

		if (this.headersSent)
			return this;

		this.controller && this.req.$total_success();

		if (code instanceof Buffer) {
			// express.js static file
			if (!body && !type) {
				this.end(code);
				return this;
			}
		}

		var res = this;
		var req = this.req;
		var contentType = type;
		var isHEAD = req.method === 'HEAD';

		if (body === undefined) {
			body = code;
			code = res.$statuscode || 200;
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
						var json = body.output(true);
						if (body.status !== 200)
							res.options.code = body.status;
						if (body.contentType)
							contentType = body.contentType;
						else
							contentType = CT_JSON;
						body = json;
						F.stats.response.errorBuilder++;
					} else
						body = JSON.stringify(body);
					!contentType && (contentType = CT_JSON);
				}
				break;
		}

		var accept = req.headers['accept-encoding'] || '';
		var headers = {};

		headers[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
		headers['Vary'] = 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : '');

		if ((/text|application/).test(contentType))
			contentType += '; charset=utf-8';

		headers[HEADER_TYPE] = contentType;
		res.$custom();

		if (!accept && isGZIP(req))
			accept = 'gzip';

		var compress = CONF.allow_gzip && accept.indexOf('gzip') !== -1;
		if (isHEAD) {
			compress && (headers['Content-Encoding'] = 'gzip');
			res.writeHead(200, headers);
			res.end();
			return res;
		}

		if (!compress) {
			res.writeHead(code, headers);
			res.end(body, ENCODING);
			return res;
		}

		var buffer = Buffer.from(body);
		Zlib.gzip(buffer, function(err, data) {

			if (err) {
				res.writeHead(code, headers);
				res.end(body, ENCODING);
			} else {
				headers['Content-Encoding'] = 'gzip';
				res.writeHead(code, headers);
				res.end(data, ENCODING);
			}
		});

		return res;
	};

	/**
	 * Response a custom content
	 * @param {Number} code
	 * @param {String} body
	 * @param {String} type
	 * @param {Boolean} compress Disallows GZIP compression. Optional, default: true.
	 * @param {Object} headers Optional, additional headers.
	 * @return {Response}
	 */
	PROTO.content = function(code, body, type, compress, headers) {

		if (typeof(compress) === 'object') {
			var tmp = headers;
			headers = compress;
			compress = tmp;
		}

		var res = this;
		res.options.code = code;
		res.options.compress = compress === undefined || compress === true;
		res.options.body = body;
		res.options.type = type;
		res.options.compress = body.length > 4096;
		headers && (res.options.headers = headers);
		res.$text();
		return res;
	};

	/**
	 * Response redirect
	 * @param {String} url
	 * @param {Boolean} permanent Optional, default: false.
	 * @return {Framework}
	 */
	PROTO.redirect = function(url, permanent) {
		this.options.url = url;
		permanent && (this.options.permanent = permanent);
		this.$redirect();
		return this;
	};

	/**
	 * Responds with a file
	 * @param {String} filename
	 * @param {String} download Optional, a download name.
	 * @param {Object} headers Optional, additional headers.
	 * @param {Function} done Optional, callback.
	 * @return {Framework}
	 */
	PROTO.file = function(filename, download, headers, callback) {
		this.options.filename = filename;
		headers && (this.options.headers = headers);
		callback && (this.options.callback = callback);
		download && (this.options.download = download);
		return this.$file();
	};

	/**
	 * Responds with a file from FileStorage
	 * @param {String} name A name of FileStorage
	 * @param {String/Number} id
	 * @param {String} download Optional, a download name.
	 * @param {Object} headers Optional, additional headers.
	 * @param {Function} done Optional, callback.
	 * @return {Framework}
	 */
	PROTO.filefs = function(name, id, download, headers, callback, checkmeta) {
		var self = this;
		var options = {};
		options.id = id;
		options.download = download;
		options.headers = headers;
		options.done = callback;
		FILESTORAGE(name).res(self, options, checkmeta, $file_notmodified);
		return self;
	};

	PROTO.filenosql = function(name, id, download, headers, callback, checkmeta) {
		var self = this;
		var options = {};
		options.id = id;
		options.download = download;
		options.headers = headers;
		options.done = callback;
		NOSQL(name).binary.res(self, options, checkmeta, $file_notmodified);
		return self;
	};

	PROTO.imagefs = function(name, id, make, headers, callback, checkmeta) {
		var self = this;
		var options = {};
		options.id = id;
		options.image = true;
		options.make = make;
		options.headers = headers;
		options.done = callback;
		FILESTORAGE(name).res(self, options, checkmeta, $file_notmodified);
		return self;
	};

	PROTO.imagenosql = function(name, id, make, headers, callback, checkmeta) {
		var self = this;
		var options = {};
		options.id = id;
		options.image = true;
		options.make = make;
		options.headers = headers;
		options.done = callback;
		NOSQL(name).binary.res(self, options, checkmeta, $file_notmodified);
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
	PROTO.stream = function(type, stream, download, headers, callback, nocompress) {
		var res = this;
		res.options.type = type;
		res.options.stream = stream;
		download && (res.options.download = download);
		headers && (res.options.headers = headers);
		callback && (res.options.callback = callback);
		res.options.compress = nocompress ? false : true;
		res.$stream();
		return res;
	};

	PROTO.binary = function(body, type, encoding, download, headers) {

		if (typeof(encoding) === 'object') {
			var tmp = encoding;
			encoding = download;
			download = headers;
			headers = tmp;
		}

		if (typeof(download) === 'object') {
			headers = download;
			download = headers;
		}

		this.options.type = type;
		this.options.body = body;
		this.options.encoding = encoding;
		download && (this.options.download = download);
		headers && (this.options.headers = headers);
		this.$binary();
		return this;
	};

	PROTO.proxy = function(url, headers, timeout, callback) {

		OBSOLETE('res.proxy()', 'You need to use controller.proxy()');

		var res = this;

		if (res.success || res.headersSent)
			return res;

		callback && (res.options.callback = callback);
		headers && (res.options.headers = headers);
		timeout && (res.options.timeout = timeout);

		U.resolve(url, function(err, uri) {

			var headers = {};

			headers[HEADER_CACHE] = 'private, no-cache, no-store, max-age=0';
			res.options.headers && U.extend_headers2(headers, res.options.headers);

			var options = { protocol: uri.protocol, auth: uri.auth, method: 'GET', hostname: uri.hostname, port: uri.port, path: uri.path, agent: false, headers: headers };
			var connection = options.protocol === 'https:' ? require('https') : http;
			var gzip = CONF.allow_gzip && (res.req.headers['accept-encoding'] || '').lastIndexOf('gzip') !== -1;

			var client = connection.get(options, function(response) {

				if (res.success || res.headersSent)
					return;

				var contentType = response.headers['content-type'];
				var isGZIP = (response.headers['content-encoding'] || '').lastIndexOf('gzip') !== -1;
				var compress = !isGZIP && gzip && (contentType.indexOf('text/') !== -1 || contentType.lastIndexOf('javascript') !== -1 || contentType.lastIndexOf('json') !== -1);
				var attachment = response.headers['content-disposition'] || '';

				attachment && res.setHeader('Content-Disposition', attachment);
				res.setHeader(HEADER_TYPE, contentType);
				res.setHeader('Vary', 'Accept-Encoding' + (res.req.$mobile ? ', User-Agent' : ''));

				res.on('error', function() {
					response.close();
					response_end(res);
				});

				if (compress) {
					res.setHeader('Content-Encoding', 'gzip');
					response.pipe(Zlib.createGzip(GZIPSTREAM)).pipe(res);
					return;
				}

				if (isGZIP && !gzip)
					response.pipe(Zlib.createGunzip()).pipe(res);
				else
					response.pipe(res);
			});

			timeout && client.setTimeout(timeout, function() {
				res.throw408();
			});

			client.on('close', function() {
				if (!res.success) {
					F.stats.response.pipe++;
					response_end(res);
				}
			});
		});

		return res;
	};

	/**
	 * Responds with an image
	 * @param {String or Stream} filename
	 * @param {String} make
	 * @param {Object} headers Optional, additional headers.
	 * @param {Function} callback Optional.
	 * @return {Framework}
	 */
	PROTO.image = function(filename, make, headers, callback, persistent) {

		var res = this;

		res.options.make = make;

		if (persistent === true || (persistent == null && CONF.allow_persistent_images === true))
			res.options.persistent = true;

		headers && (res.options.headers = headers);
		callback && (res.options.callback = callback);

		if (typeof(filename) === 'object')
			res.options.stream = filename;
		else
			res.options.filename = filename;

		res.$image();
		return res;
	};

	PROTO.image_nocache = function(filename, make, headers, callback) {
		this.options.cache = false;
		return this.image(filename, make, headers, callback);
	};

	/**
	 * Response JSON
	 * @param {Object} obj
	 * @return {Response}
	 */
	PROTO.json = function(obj) {
		var res = this;
		F.stats.response.json++;
		if (obj && obj.$$schema)
			obj = obj.$clean();
		res.options.body = JSON.stringify(obj);
		res.options.compress = res.options.body.length > 4096;
		res.options.type = CT_JSON;
		return res.$text();
	};

	const SECURITYTXT = { '/security.txt': 1, '/.well-known/security.txt': 1 };

	PROTO.continue = function(callback) {

		var res = this;
		var req = res.req;

		callback && (res.options.callback = callback);

		if (res.success || res.headersSent)
			return res;

		if (!CONF.static_accepts[req.extension]) {
			if (!F.routes.filesfallback || !F.routes.filesfallback(req, res))
				res.throw404();
			return res;
		}

		if (SECURITYTXT[req.url] && CONF['security.txt']) {
			res.send(200, CONF['security.txt'], 'text/plain');
			return;
		}

		req.$key = createTemporaryKey(req);

		if (F.temporary.notfound[req.$key]) {
			if (!F.routes.filesfallback || !F.routes.filesfallback(req, res))
				res.throw404();
			return res;
		}

		var canresize = false;
		var filename = null;
		var name = req.uri.pathname;

		if (IMAGES[req.extension]) {
			var index = name.lastIndexOf('/');
			var resizer = F.routes.resize[name.substring(0, index + 1)];
			if (resizer) {
				name = name.substring(index + 1);
				canresize = resizer.extension['*'] || resizer.extension[req.extension];
				if (canresize) {
					name = resizer.path + $decodeURIComponent(name);
					filename = F.onMapping(name, name, false, false);
				} else
					filename = F.onMapping(name, name, true, true);
			} else
				filename = F.onMapping(name, name, true, true);
		} else
			filename = F.onMapping(name, name, true, true);

		if (!filename) {
			if (!F.routes.filesfallback || !F.routes.filesfallback(req, res))
				res.throw404();
			return;
		}

		if (!canresize) {

			if (F.components.has && F.components[req.extension] && req.uri.pathname === CONF.static_url_components + req.extension) {
				res.noCompress = true;
				res.options.components = true;
				var g = req.query.group ? req.query.group.substring(0, req.query.group.length - 6) : '';
				filename = F.path.temp('components' + (g ? '_g' + g : '') + '.' + req.extension);
				if (g)
					req.$key = 'components_' + g + '.' + req.extension;
				else
					req.$key = 'components.' + req.extension;
			}

			res.options.filename = filename;
			res.$file();
			return res;
		}

		if (!resizer.ishttp) {
			res.options.cache = resizer.cache;
			res.options.make = resizer.fn;
			res.options.filename = filename;
			res.$image();
			return res;
		}

		if (F.temporary.processing[req.uri.pathname]) {
			setTimeout($continue_timeout, 500, res);
			return res;
		}

		var tmp = F.path.temp(req.$key);
		if (F.temporary.path[req.$key]) {
			res.options.filename = req.uri.pathname;
			res.$file();
			return res;
		}

		F.temporary.processing[req.uri.pathname] = true;

		U.download(name, FLAGS_DOWNLOAD, function(err, response) {
			var writer = Fs.createWriteStream(tmp);
			response.pipe(writer);
			CLEANUP(writer, function() {

				delete F.temporary.processing[req.uri.pathname];
				var contentType = response.headers['content-type'];

				if (response.statusCode !== 200 || !contentType || !contentType.startsWith('image/')) {
					if (!F.routes.filesfallback || !F.routes.filesfallback(req, res))
						res.throw404();
					return;
				}

				res.options.cache = resizer.cache;
				res.options.filename = tmp;
				res.options.maker = resizer.fn;
				res.$image();
			});
		});

		return res;
	};

	PROTO.$file = function() {

		// res.options.filename
		// res.options.code
		// res.options.callback
		// res.options.headers
		// res.options.download

		var res = this;
		var options = res.options;

		if (res.headersSent)
			return res;

		var req = this.req;

		// Localization
		if (CONF.allow_localize && KEYSLOCALIZE[req.extension]) {

			// Is package?
			if (options.filename && options.filename[0] === '@')
				options.filename = F.path.package(options.filename.substring(1));

			F.$filelocalize(req, res, false, options);
			return;
		}

		!req.$key && (req.$key = createTemporaryKey(req));

		// "$keyskip" solves a problem with handling files in 404 state
		if (!req.$keyskip) {
			if (F.temporary.notfound[req.$key]) {
				req.$keyskip = true;
				DEBUG && (F.temporary.notfound[req.$key] = undefined);
				if (!F.routes.filesfallback || !F.routes.filesfallback(req, res))
					res.throw404();
				return res;
			}
		}

		// Is package?
		if (options.filename && options.filename[0] === '@')
			options.filename = F.path.package(options.filename.substring(1));

		var name = F.temporary.path[req.$key];
		var index;

		if (!req.extension) {
			req.$key && (req.extension = U.getExtension(req.$key));
			if (!req.extension && name) {
				req.extension = U.getExtension(name);
				index = req.extension.lastIndexOf(';');
				index !== -1 && (req.extension = req.extension.substring(0, index));
			}
			!req.extension && options.filename && (req.extension = U.getExtension(options.filename));
		}

		if (name && RELEASE && !res.$nocache && req.headers['if-modified-since'] === name[2]) {
			$file_notmodified(res, name);
			return res;
		}

		if (name === undefined) {

			if (F.temporary.processing[req.$key]) {
				if (req.processing > CONF.default_request_timeout) {
					res.throw408();
				} else {
					req.processing += 500;
					setTimeout($file_processing, 500, res);
				}
				return res;
			}

			// waiting
			F.temporary.processing[req.$key] = true;
			compile_check(res);
			return res;
		}

		var contentType = U.getContentType(req.extension);
		var accept = req.headers['accept-encoding'] || '';
		var headers;

		!accept && isGZIP(req) && (accept = 'gzip');

		var compress = CONF.allow_gzip && COMPRESSION[contentType] && accept.indexOf('gzip') !== -1 && name.length > 2;
		var range = req.headers.range;
		var canCache = !res.$nocache && RELEASE && contentType !== 'text/cache-manifest' && !RESPONSENOCACHE[req.extension];

		if (canCache) {
			if (compress)
				headers = range ? HEADERS.file_release_compress_range : HEADERS.file_release_compress;
			else
				headers = range ? HEADERS.file_release_range : HEADERS.file_release;
		} else {
			if (compress)
				headers = range ? HEADERS.file_debug_compress_range : HEADERS.file_debug_compress;
			else
				headers = range ? HEADERS.file_debug_range : HEADERS.file_debug;
		}

		if (req.$mobile)
			headers.Vary = 'Accept-Encoding, User-Agent';
		else
			headers.Vary = 'Accept-Encoding';

		headers[HEADER_TYPE] = contentType;
		if (REG_TEXTAPPLICATION.test(contentType))
			headers[HEADER_TYPE] += '; charset=utf-8';

		if (canCache && !res.getHeader('Expires')) {
			headers.Expires = DATE_EXPIRES;
		} else if (headers.Expires && RELEASE)
			delete headers.Expires;

		if (res.options.headers)
			headers = U.extend_headers(headers, res.options.headers);

		if (res.options.download) {
			var encoded = encodeURIComponent(res.options.download);
			headers['Content-Disposition'] = 'attachment; ' + (REG_UTF8.test(res.options.download) ? 'filename*=utf-8\'\'' + encoded : ('filename="' + encoded + '"'));
		} else if (headers['Content-Disposition'])
			delete headers['Content-Disposition'];

		if (res.getHeader('Last-Modified'))
			delete headers['Last-Modified'];
		else if (!res.options.lastmodified)
			headers['Last-Modified'] = name[2];

		headers.Etag = ETAG + CONF.etag_version;

		if (range) {
			$file_range(name[0], range, headers, res);
			return res;
		}

		// (DEBUG && !res.options.make) --> because of image convertor
		if (!res.options.components && ((DEBUG && !res.options.make) || res.$nocache))
			F.isProcessed(req.$key) && (F.temporary.path[req.$key] = undefined);

		if (name[1] && !compress)
			headers[HEADER_LENGTH] = name[1];
		else if (compress && name[4])
			headers[HEADER_LENGTH] = name[4];
		else if (headers[HEADER_LENGTH])
			delete headers[HEADER_LENGTH];

		F.stats.response.file++;
		options.stream && DESTROY(options.stream);

		if (req.method === 'HEAD') {
			res.writeHead(res.options.code || 200, headers);
			res.end();
			response_end(res);
		} else if (compress) {

			if (name[4])
				headers[HEADER_LENGTH] = name[4];
			else
				delete headers[HEADER_LENGTH];

			res.writeHead(res.options.code || 200, headers);
			fsStreamRead(name[3], undefined, $file_nocompress, res);
		} else {
			res.writeHead(res.options.code || 200, headers);
			fsStreamRead(name[0], undefined, $file_nocompress, res);
		}
	};

	PROTO.$redirect = function() {

		// res.options.permanent
		// res.options.url

		var res = this;

		if (res.headersSent)
			return res;

		HEADERS.redirect.Location = res.options.url;
		res.writeHead(res.options.permanent ? 301 : 302, HEADERS.redirect);
		res.end();
		response_end(res);
		F.stats.response.redirect++;
		return res;
	};

	PROTO.$binary = function() {

		// res.options.callback
		// res.options.code
		// res.options.encoding
		// res.options.download
		// res.options.type
		// res.options.body
		// res.options.headers

		var res = this;

		if (res.headersSent)
			return res;

		var req = res.req;
		var options = res.options;

		/*
		if (options.type.lastIndexOf('/') === -1)
			options.type = U.getContentType(options.type);
		*/

		var accept = req.headers['accept-encoding'] || '';
		!accept && isGZIP(req) && (accept = 'gzip');

		var compress = CONF.allow_gzip && COMPRESSION[options.type] && accept.indexOf('gzip') !== -1;
		var headers = compress ? HEADERS.binary_compress : HEADERS.binary;

		headers['Vary'] = 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : '');

		if (options.download)
			headers['Content-Disposition'] = 'attachment; filename=' + encodeURIComponent(options.download);
		else if (headers['Content-Disposition'])
			delete headers['Content-Disposition'];

		headers[HEADER_TYPE] = options.type;

		if (options.headers)
			headers = U.extend_headers(headers, options.headers);

		F.stats.response.binary++;

		if (req.method === 'HEAD') {
			res.writeHead(options.code || 200, headers);
			res.end();
			response_end(res);
		} else if (compress) {
			res.writeHead(options.code || 200, headers);
			Zlib.gzip(!options.encoding || options.encoding === 'binary' ? options.body : options.body.toString(options.encoding), (err, buffer) => res.end(buffer));
			response_end(res);
		} else {
			res.writeHead(options.code || 200, headers);
			res.end(!options.encoding || options.encoding === 'binary' ? options.body : options.body.toString(options.encoding));
			response_end(res);
		}

		return res;
	};

	PROTO.$stream = function() {

		// res.options.filename
		// res.options.options
		// res.options.callback
		// res.options.code
		// res.options.stream
		// res.options.type
		// res.options.compress

		var res = this;
		var req = res.req;
		var options = res.options;

		if (res.headersSent)
			return res;

		/*
		if (options.type.lastIndexOf('/') === -1)
			options.type = U.getContentType(options.type);
		*/

		var accept = req.headers['accept-encoding'] || '';
		!accept && isGZIP(req) && (accept = 'gzip');

		var compress = (options.compress === undefined || options.compress) && CONF.allow_gzip && COMPRESSION[options.type] && accept.indexOf('gzip') !== -1;
		var headers;

		if (RELEASE) {
			if (compress)
				headers = HEADERS.stream_release_compress;
			else
				headers = HEADERS.stream_release;
		} else {
			if (compress)
				headers = HEADERS.stream_debug_compress;
			else
				headers = HEADERS.stream_debug;
		}

		headers.Vary = 'Accept-Encoding' + (req.$mobile ? ', User-Agent' : '');

		if (RELEASE) {
			headers.Expires = DATE_EXPIRES;
			headers['Last-Modified'] = 'Mon, 01 Jan 2001 08:00:00 GMT';
		}

		if (options.download)
			headers['Content-Disposition'] = 'attachment; filename=' + encodeURIComponent(options.download);
		else if (headers['Content-Disposition'])
			delete headers['Content-Disposition'];

		headers[HEADER_TYPE] = options.type;

		if (options.headers)
			headers = U.extend_headers(headers, options.headers);

		F.stats.response.stream++;

		if (req.method === 'HEAD') {
			res.writeHead(options.code || 200, headers);
			res.end();
			options.stream && framework_internal.onFinished(res, () => framework_internal.destroyStream(options.stream));
			response_end(res);
			return res;
		}

		if (compress) {
			res.writeHead(options.code || 200, headers);
			res.on('error', () => options.stream.close());
			options.stream.pipe(Zlib.createGzip(GZIPSTREAM)).pipe(res);
			framework_internal.onFinished(res, () => framework_internal.destroyStream(options.stream));
			response_end(res);
		} else {
			res.writeHead(options.code || 200, headers);
			framework_internal.onFinished(res, () => framework_internal.destroyStream(options.stream));
			options.stream.pipe(res);
			response_end(res);
		}

		return res;
	};

	PROTO.$image = function() {

		// res.options.filename
		// res.options.stream
		// res.options.options
		// res.options.callback
		// res.options.code
		// res.options.cache
		// res.options.headers
		// res.options.make = function(image, res)
		// res.options.persistent

		var res = this;
		var options = res.options;

		if (options.cache === false)
			return $image_nocache(res);

		var req = this.req;
		if (!req.$key)
			req.$key = createTemporaryKey(req);

		var key = req.$key;

		if (F.temporary.notfound[key]) {
			DEBUG && (F.temporary.notfound[key] = undefined);
			if (!F.routes.filesfallback || !F.routes.filesfallback(req, res))
				res.throw404();
			return res;
		}

		var name = F.temporary.path[key];

		if (options.filename && options.filename[0] === '@')
			options.filename = F.path.package(options.filename.substring(1));

		if (name !== undefined) {
			res.$file();
			return res;
		}

		if (F.temporary.processing[key]) {
			if (req.processing > CONF.default_request_timeout) {
				res.throw408();
			} else {
				req.processing += 500;
				setTimeout($image_processing, 500, res);
			}
			return res;
		}

		var plus = F.id ? 'i-' + F.id + '_' : '';

		options.name = F.path.temp((options.persistent ? 'timg_' : '') + plus + key);

		if (options.persistent) {
			fsFileExists(options.name, $image_persistent, res);
			return;
		}

		F.temporary.processing[key] = true;

		if (options.stream)
			fsFileExists(options.name, $image_stream, res);
		else
			fsFileExists(options.filename, $image_filename, res);

		return res;
	};

	PROTO.$custom = function() {
		F.stats.response.custom++;
		response_end(this);
		return this;
	};

	PROTO.$text = function() {

		// res.options.type
		// res.options.body
		// res.options.code
		// res.options.headers
		// res.options.callback
		// res.options.compress
		// res.options.encoding

		var res = this;
		var req = res.req;
		var options = res.options;

		if (res.headersSent)
			return res;

		if (res.$evalroutecallback) {
			res.headersSent = true;
			res.$evalroutecallback(null, options.body, res.options.encoding || ENCODING);
			return res;
		}

		var accept = req.headers['accept-encoding'] || '';
		!accept && isGZIP(req) && (accept = 'gzip');

		var gzip = CONF.allow_gzip && (options.compress === undefined || options.compress) ? accept.indexOf('gzip') !== -1 : false;
		var headers;

		if (req.$mobile)
			headers = gzip ? HEADERS.content_mobile_release : HEADERS.content_mobile;
		else
			headers = gzip ? HEADERS.content_compress : HEADERS.content;

		if (REG_TEXTAPPLICATION.test(options.type))
			options.type += '; charset=utf-8';

		headers[HEADER_TYPE] = options.type;

		if (options.headers)
			headers = U.extend_headers(headers, options.headers);

		if (req.method === 'HEAD') {
			res.writeHead(options.code || 200, headers);
			res.end();
		} else {
			if (gzip) {
				res.writeHead(options.code || 200, headers);
				Zlib.gzip(options.body instanceof Buffer ? options.body : Buffer.from(options.body), (err, data) => res.end(data, res.options.encoding || ENCODING));
			} else {
				res.writeHead(options.code || 200, headers);
				res.end(options.body, res.options.encoding || ENCODING);
			}
		}

		response_end(res);
		return res;
	};

	PROTO.throw400 = function(problem) {
		this.options.code = 400;
		problem && (this.options.problem = problem);
		return this.$throw();
	};

	PROTO.throw401 = function(problem) {
		this.options.code = 401;
		problem && (this.options.problem = problem);
		return this.$throw();
	};

	PROTO.throw403 = function(problem) {
		this.options.code = 403;
		problem && (this.options.problem = problem);
		return this.$throw();
	};

	PROTO.throw404 = function(problem) {
		this.options.code = 404;
		problem && (this.options.problem = problem);
		return this.$throw();
	};

	PROTO.throw408 = function(problem) {
		this.options.code = 408;
		problem && (this.options.problem = problem);
		return this.$throw();
	};

	PROTO.throw409 = function(problem) {
		this.options.code = 409;
		problem && (this.options.problem = problem);
		return this.$throw();
	};

	PROTO.throw431 = function(problem) {
		this.options.code = 431;
		problem && (this.options.problem = problem);
		return this.$throw();
	};

	PROTO.throw500 = function(error) {
		error && F.error(error, null, this.req.uri);
		this.options.code = 500;
		this.options.body = U.httpStatus(500) + error ? prepare_error(error) : '';
		return this.$throw();
	};

	PROTO.throw501 = function(problem) {
		this.options.code = 501;
		problem && (this.options.problem = problem);
		return this.$throw();
	};

	PROTO.$throw = function() {

		// res.options.code
		// res.options.body
		// res.options.problem

		var res = this;

		if (res.success || res.headersSent)
			return res;

		var req = res.req;
		var key = 'error' + res.options.code;

		res.options.problem && F.problem(res.options.problem, 'response' + res.options.code + '()', req.uri, req.ip);

		if (req.method === 'HEAD') {
			res.writeHead(res.options.code || 501, res.options.headers || HEADERS.responseCode);
			res.end();
			F.stats.response[key]++;
			response_end(res);
		} else {
			req.$total_route = F.lookup(req, '#' + res.options.code, EMPTYARRAY, 0);
			req.$total_exception = res.options.problem;
			req.$total_execute(res.options.code, true);
		}

		F.$events[key] && EMIT(key, req, res, res.options.problem);
		return res;
	};
}

function $image_persistent(exists, size, isFile, stats, res) {
	if (exists) {
		delete F.temporary.processing[res.req.$key];
		F.temporary.path[res.req.$key] = [res.options.name, stats.size, stats.mtime.toUTCString()];
		res.options.filename = res.options.name;
		res.$file();
	} else {
		F.temporary.processing[res.req.$key] = true;
		if (res.options.stream)
			fsFileExists(res.options.name, $image_stream, res);
		else
			fsFileExists(res.options.filename, $image_filename, res);
	}
}

function $continue_timeout(res) {
	res.continue();
}

function $file_processing(res) {
	res.$file();
}

function $file_notmodified(res, name) {
	var req = res.req;
	var headers = HEADERS.file_lastmodified;

	if (res.getHeader('Last-Modified'))
		delete headers['Last-Modified'];
	else
		headers['Last-Modified'] = name instanceof Array ? name[2] : name;

	if (res.getHeader('Expires'))
		delete headers.Expires;
	else
		headers.Expires = DATE_EXPIRES;

	if (res.getHeader('ETag'))
		delete headers.Etag;
	else
		headers.Etag = ETAG + CONF.etag_version;

	headers[HEADER_TYPE] = U.getContentType(req.extension);
	res.writeHead(304, headers);
	res.end();
	F.stats.response.notModified++;
	response_end(res);
}

function $file_nocompress(stream, next, res) {

	stream.pipe(res);

	framework_internal.onFinished(res, function() {
		next();
		framework_internal.destroyStream(stream);
	});

	response_end(res);
}

function $file_range(name, range, headers, res) {

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

	if (end > total)
		end = total - 1;

	var length = (end - beg) + 1;

	headers[HEADER_LENGTH] = length;
	headers['Content-Range'] = 'bytes ' + beg + '-' + end + '/' + total;

	var req = res;
	F.stats.response.streaming++;

	if (req.method === 'HEAD') {
		res.writeHead(206, headers);
		res.end();
		response_end(res);
		return F;
	}

	res.writeHead(206, headers);
	RANGE.start = beg;
	RANGE.end = end;
	fsStreamRead(name, RANGE, $file_range_callback, res);
	return F;
}

function $file_range_callback(stream, next, res) {
	framework_internal.onFinished(res, function() {
		framework_internal.destroyStream(stream);
		next();
	});
	stream.pipe(res);
	response_end(res);
}

function $image_nocache(res) {

	var options = res.options;

	// STREAM
	if (options.stream) {
		var image = framework_image.load(options.stream);
		options.make.call(image, image, res);
		options.type = U.getContentType(image.outputType);
		options.stream = image;
		F.stats.response.image++;
		res.$stream();
		return F;
	}

	// FILENAME
	fsFileExists(options.filename, function(e) {

		if (e) {
			F.path.verify('temp');
			var image = framework_image.load(options.filename);
			options.make.call(image, image, res);
			F.stats.response.image++;
			options.type = U.getContentType(image.outputType);
			options.stream = image;
			res.$stream();
		} else {
			options.headers = null;
			if (!F.routes.filesfallback || !F.routes.filesfallback(res.req, res))
				res.throw404();
		}
	});
}

function $image_processing(res) {
	res.$image();
}

function $image_stream(exists, size, isFile, stats, res) {

	var req = res.req;
	var options = res.options;

	if (exists) {
		delete F.temporary.processing[req.$key];
		F.temporary.path[req.$key] = [options.name, stats.size, stats.mtime.toUTCString()];
		res.options.filename = options.name;

		if (options.stream) {
			options.stream.once('error', NOOP); // sometimes is throwed: Bad description
			DESTROY(options.stream);
			options.stream = null;
		}

		res.$file();
		DEBUG && (F.temporary.path[req.$key] = undefined);
		return;
	}

	F.path.verify('temp');

	var image = framework_image.load(options.stream);
	options.make.call(image, image, res);
	req.extension = U.getExtension(options.name);

	if (req.extension !== image.outputType) {
		var index = options.name.lastIndexOf('.' + req.extension);
		if (index !== -1)
			options.name = options.name.substring(0, index) + '.' + image.outputType;
		else
			options.name += '.' + image.outputType;
	}

	F.stats.response.image++;
	image.save(options.name, function(err) {

		if (options.stream) {
			options.stream.once('error', NOOP); // sometimes is throwed: Bad description
			DESTROY(options.stream);
			options.stream = null;
		}

		delete F.temporary.processing[req.$key];
		if (err) {
			F.temporary.notfound[req.$key] = true;
			res.throw500(err);
			DEBUG && (F.temporary.notfound[req.$key] = undefined);
		} else {
			var stats = Fs.statSync(options.name);
			F.temporary.path[req.$key] = [options.name, stats.size, stats.mtime.toUTCString()];
			options.filename = options.name;
			res.$file();
		}
	});
}

function $image_filename(exists, size, isFile, stats, res) {

	var req = res.req;
	var options = res.options;

	if (!exists) {
		delete F.temporary.processing[req.$key];
		F.temporary.notfound[req.$key] = true;
		if (!F.routes.filesfallback || !F.routes.filesfallback(req, res))
			res.throw404();
		DEBUG && (F.temporary.notfound[req.$key] = undefined);
		return;
	}

	F.path.verify('temp');

	var image = framework_image.load(options.filename);
	options.make.call(image, image, res);
	req.extension = U.getExtension(options.name);

	if (req.extension !== image.outputType) {
		var index = options.name.lastIndexOf('.' + req.extension);
		if (index === -1)
			options.name += '.' + image.outputType;
		else
			options.name = options.name.substring(0, index) + '.' + image.outputType;
	}

	F.stats.response.image++;

	image.save(options.name, function(err) {

		delete F.temporary.processing[req.$key];

		if (err) {
			F.temporary.notfound[req.$key] = true;
			res.throw500(err);
			DEBUG && (F.temporary.notfound[req.$key] = undefined);
		} else {
			var stats = Fs.statSync(options.name);
			F.temporary.path[req.$key] = [options.name, stats.size, stats.mtime.toUTCString()];
			res.options.filename = options.name;
			res.$file();
		}
	});
}

function response_end(res) {

	F.reqstats(false, res.req.isStaticFile);
	res.success = true;

	if (CONF.allow_reqlimit && F.temporary.ddos[res.req.ip])
		F.temporary.ddos[res.req.ip]--;

	if (!res.req.isStaticFile) {
		F.$events['request-end'] && EMIT('request-end', res.req, res);
		F.$events.request_end && EMIT('request_end', res.req, res);
	}

	res.req.clear(true);
	res.controller && res.req.$total_success();

	if (res.options.callback) {
		res.options.callback();
		res.options.callback = null;
	}

	if (res.options.done) {
		res.options.done();
		res.options.done = null;
	}

	// res.options = EMPTYOBJECT;
	res.controller = null;
}

// Handle errors of decodeURIComponent
function $decodeURIComponent(value) {
	try
	{
		return decodeURIComponent(value);
	} catch (e) {
		return value;
	}
}

global.Controller = Controller;
global.WebSocketClient = WebSocketClient;

process.on('unhandledRejection', function(e) {
	F.error(e, '', null);
});

process.on('uncaughtException', function(e) {

	var err = e.toString();

	if (err.indexOf('listen EADDRINUSE') !== -1) {
		process.send && process.send('total:eaddrinuse');
		console.log('\nThe IP address and the PORT is already in use.\nYou must change the PORT\'s number or IP address.\n');
		process.exit('SIGTERM');
		return;
	} else if (CONF.allow_filter_errors && REG_SKIPERROR.test(err))
		return;

	F.error(e, '', null);
});

function fsFileRead(filename, callback, a, b, c) {
	U.queue('F.files', CONF.default_maxopenfiles, function(next) {
		F.stats.performance.open++;
		Fs.readFile(filename, function(err, result) {
			next();
			callback(err, result, a, b, c);
		});
	});
}

function fsFileExists(filename, callback, a, b, c) {
	U.queue('F.files', CONF.default_maxopenfiles, function(next) {
		F.stats.performance.open++;
		Fs.lstat(filename, function(err, stats) {
			next();
			callback(!err && stats.isFile(), stats ? stats.size : 0, stats ? stats.isFile() : false, stats, a, b, c);
		});
	});
}

function fsStreamRead(filename, options, callback, res) {

	if (!callback) {
		callback = options;
		options = undefined;
	}

	var opt;

	if (options) {

		opt = HEADERS.fsStreamReadRange;
		opt.start = options.start;
		opt.end = options.end;

		if (opt.start > opt.end)
			delete opt.end;

	} else
		opt = HEADERS.fsStreamRead;

	U.queue('F.files', CONF.default_maxopenfiles, function(next) {
		F.stats.performance.open++;
		var stream = Fs.createReadStream(filename, opt);
		stream.on('error', NOOP);
		callback(stream, next, res);
	}, filename);
}

/**
 * Prepare URL address to temporary key (for caching)
 * @param {ServerRequest or String} req
 * @return {String}
 */
function createTemporaryKey(req) {
	return (req.uri ? req.uri.pathname : req).replace(REG_TEMPORARY, '_').substring(1);
}

F.createTemporaryKey = createTemporaryKey;

function MiddlewareOptions() {}

MiddlewareOptions.prototype = {

	get user() {
		return this.req.user;
	},

	get session() {
		return this.req.session;
	},

	get language() {
		return this.req.$language;
	},

	get ip() {
		return this.req.ip;
	},

	get headers() {
		return this.req.headers;
	},

	get ua() {
		return this.req ? this.req.ua : null;
	},

	get sessionid() {
		return this.req.sessionid;
	},

	get id() {
		return this.controller ? this.controller.id : null;
	},

	get params() {
		return this.controller ? this.controller.params : null;
	},

	get files() {
		return this.req.files;
	},

	get body() {
		return this.req.body;
	},

	get query() {
		return this.req.query;
	}
};

const MiddlewareOptionsProto = MiddlewareOptions.prototype;

MiddlewareOptionsProto.callback = function() {
	this.next();
	return this;
};

MiddlewareOptionsProto.cancel = function() {
	this.next(false);
	return this;
};

function forcestop() {
	F.stop();
}

process.on('SIGTERM', forcestop);
process.on('SIGINT', forcestop);
process.on('exit', forcestop);

function process_ping() {
	process.connected && process.send('total:ping');
}

process.on('message', function(msg, h) {
	if (msg === 'total:debug') {
		U.wait(() => F.isLoaded, function() {
			F.isLoaded = undefined;
			F.console();
		}, 10000, 500);
	} else if (msg === 'reconnect')
		F.reconnect();
	else if (msg === 'total:ping')
		setImmediate(process_ping);
	else if (msg === 'total:update')
		EMIT('update');
	else if (msg === 'reset')
		F.cache.clear();
	else if (msg === 'stop' || msg === 'exit' || msg === 'kill')
		F.stop();
	else if (msg && msg.TYPE && msg.ID !== F.id) {
		if (msg.TYPE === 'req')
			F.cluster.req(msg);
		else if (msg.TYPE === 'res')
			msg.target === F.id && F.cluster.res(msg);
		else if (msg.TYPE === 'emit')
			F.$events[msg.name] && EMIT(msg.name, msg.a, msg.b, msg.c, msg.d, msg.e);
		else if (msg.TYPE === 'nosql-meta')
			NOSQL(msg.name).meta(msg.key, msg.value, true);
		else if (msg.TYPE === 'table-meta')
			TABLE(msg.name).meta(msg.key, msg.value, true);
		else if (msg.TYPE === 'session') {
			var session = SESSION(msg.NAME);
			switch (msg.method) {
				case 'remove':
					session.$sync = false;
					session.remove(msg.sessionid);
					session.$sync = true;
					break;
				case 'remove2':
					session.$sync = false;
					session.remove2(msg.id);
					session.$sync = true;
					break;
				case 'set2':
					session.$sync = false;
					session.set2(msg.id, msg.data, msg.expire, msg.note, msg.settings);
					session.$sync = true;
					break;
				case 'set':
					session.$sync = false;
					session.set(msg.sessionid, msg.id, msg.data, msg.expire, msg.note, msg.settings);
					session.$sync = true;
					break;
				case 'update2':
					session.$sync = false;
					session.update2(msg.id, msg.data, msg.expire, msg.note, msg.settings);
					session.$sync = true;
					break;
				case 'update':
					session.$sync = false;
					session.update(msg.sessionid, msg.data, msg.expire, msg.note, msg.settings);
					session.$sync = true;
					break;
				case 'clear':
					session.$sync = false;
					session.clear(msg.lastusage);
					session.$sync = true;
					break;
				case 'clean':
					session.$sync = false;
					session.clean();
					session.$sync = true;
					break;
			}
		} else if (msg.TYPE === 'cache') {
			switch (msg.method) {
				case 'set':
					F.cache.$sync = false;
					F.cache.set(msg.name, msg.value, msg.expire);
					F.cache.$sync = true;
					break;
				case 'remove':
					F.cache.$sync = false;
					F.cache.remove(msg.name);
					F.cache.$sync = true;
					break;
				case 'clear':
					F.cache.$sync = false;
					F.cache.clear();
					F.cache.$sync = true;
					break;
				case 'removeAll':
					F.cache.$sync = false;
					F.cache.removeAll(msg.search);
					F.cache.$sync = true;
					break;
			}
		} else if (msg.TYPE === 'filestorage') {
			var fs = F.databases['storage_' + msg.NAME];
			if (fs) {
				switch (msg.method) {
					case 'add':
						fs.meta.index = msg.index;
						fs.meta.count = msg.count;
						if (F.id === '0')
							fs.$save();
						break;
					case 'remove':
						fs.meta.count = msg.count;
						if (F.id === '0' && msg.id) {
							fs.meta.free.push(msg.id);
							fs.$save();
						}
						break;
					case 'refresh':
						fs.$refresh();
						break;
				}
			}
		}
	}

	F.$events.message && EMIT('message', msg, h);
});

function prepare_error(e) {
	if (!e)
		return '';
	else if (e instanceof ErrorBuilder)
		return e.plain();
	else if (DEBUG)
		return e.stack ? e.stack : e.toString();
}

function prepare_filename(name) {
	return name[0] === '@' ? (F.isWindows ? U.combine(CONF.directory_temp, name.substring(1)) : F.path.package(name.substring(1))) : U.combine('/', name);
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

function getLoggerMiddleware(name) {
	return 'MIDDLEWARE("' + name + '")';
}

function async_middleware(index, req, res, middleware, callback, options, controller) {

	if (res.success || res.headersSent || res.finished) {
		req.$total_route && req.$total_success();
		callback = null;
		return;
	}

	var name = middleware[index++];
	if (!name)
		return callback && callback(req, res);

	var item = F.routes.middleware[name];
	if (!item) {
		F.error('Middleware not found: ' + name, null, req.uri);
		return async_middleware(index, req, res, middleware, callback, options, controller);
	}

	var output;
	var $now;

	if (CONF.logger)
		$now = Date.now();

	if (item.$newversion) {
		var opt = req.$total_middleware;
		if (!index || !opt) {
			opt = req.$total_middleware = new MiddlewareOptions();
			opt.req = req;
			opt.res = res;
			opt.middleware = middleware;
			opt.options = options || EMPTYOBJECT;
			opt.controller = controller;
			opt.callback2 = callback;
			opt.next = function(err) {
				CONF.logger && F.ilogger(getLoggerMiddleware(name), req, $now);
				var mid = req.$total_middleware;
				if (err === false) {
					req.$total_route && req.$total_success();
					req.$total_middleware = null;
					callback = null;
				} else if (err instanceof Error || err instanceof ErrorBuilder) {
					res.throw500(err);
					req.$total_middleware = null;
					callback = null;
				} else
					async_middleware(mid.index, mid.req, mid.res, mid.middleware, mid.callback2, mid.options, mid.controller);
			};
		}

		opt.index = index;
		output = item(opt);

	} else {
		output = item.call(framework, req, res, function(err) {
			CONF.logger && F.ilogger(getLoggerMiddleware(name), req, $now);
			if (err === false) {
				req.$total_route && req.$total_success();
				callback = null;
			} else if (err instanceof Error || err instanceof ErrorBuilder) {
				res.throw500(err);
				callback = null;
			} else
				async_middleware(index, req, res, middleware, callback, options, controller);
		}, options, controller);
	}

	if (res.headersSent || res.finished) {
		req.$total_route && req.$total_success();
		callback = null;
		return;
	} else if (output !== false)
		return;

	req.$total_route && req.$total_success();
	callback = null;
}

global.setTimeout2 = function(name, fn, timeout, limit, param) {
	var key = ':' + name;
	var internal = F.temporary.internal;

	if (limit > 0) {

		var key2 = key + '_limit';
		var key3 = key + '_fn';

		if (internal[key2] >= limit) {
			internal[key] && clearTimeout(internal[key]);
			internal[key] = internal[key2] = internal[key3] = undefined;
			fn();
			return;
		}

		internal[key] && clearTimeout(internal[key]);
		internal[key2] = (internal[key2] || 0) + 1;

		return internal[key] = setTimeout(function(param, key) {
			F.temporary.internal[key] = F.temporary.internal[key + '_limit'] = F.temporary.internal[key + '_fn'] = undefined;
			fn && fn(param);
		}, timeout, param, key);
	}

	if (internal[key]) {
		clearTimeout(internal[key]);
		internal[key] = undefined;
	}

	return internal[key] = setTimeout(fn, timeout, param);
};

global.clearTimeout2 = function(name) {
	var key = ':' + name;

	if (F.temporary.internal[key]) {
		clearTimeout(F.temporary.internal[key]);
		F.temporary.internal[key] = undefined;
		F.temporary.internal[key + ':limit'] && (F.temporary.internal[key + ':limit'] = undefined);
		return true;
	}

	return false;
};

function parseComponent(body, filename) {

	var response = {};
	response.css = '';
	response.js = '';
	response.install = '';
	response.files = {};
	response.parts = {};

	var beg = 0;
	var end = 0;
	var comname = U.getName(filename);

	// Files
	while (true) {
		beg = body.indexOf('<file ');
		if (beg === -1)
			break;

		end = body.indexOf('</file>', beg);
		if (end === -1)
			break;

		var data = body.substring(beg, end);
		body = body.substring(0, beg) + body.substring(end + 7);

		// Creates directory
		var p = F.path.temp() + '~' + comname;
		try {
			Fs.mkdirSync(p);
		} catch (e) {}

		var tmp = data.indexOf('>');
		beg = data.lastIndexOf('name="', tmp);
		var name = data.substring(beg + 6, data.indexOf('"', beg + 7));
		var encoding;

		beg = data.lastIndexOf('encoding="', tmp);
		if (beg !== -1)
			encoding = data.substring(beg + 10, data.indexOf('"', beg + 11));

		data = data.substring(tmp + 1);
		F.$bundling && Fs.writeFile(U.join(p, name), data.trim(), encoding || 'base64', NOOP);
		response.files[name] = 1;
	}

	while (true) {
		beg = body.indexOf('@{part');
		if (beg === -1)
			break;
		end = body.indexOf('@{end}', beg);
		if (end === -1)
			break;
		var tmp = body.substring(beg, end);
		var tmpend = tmp.indexOf('}', 4);
		response.parts[tmp.substring(tmp.indexOf(' '), tmpend).trim()] = body.substring(beg + tmpend + 1, end).trim();
		body = body.substring(0, beg).trim() + body.substring(end + 8).trim();
		end += 5;
	}

	while (true) {
		beg = body.indexOf('<script type="text/totaljs">');
		if (beg === -1) {
			beg = body.indexOf('<script total>');
			if (beg === -1)
				beg = body.indexOf('<script totaljs>');
			if (beg === -1)
				break;
		}
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

function getSchemaName(schema, params) {
	if (!(schema instanceof Array))
		schema = schema.split('/');
	return schema[0] === 'default' ? (params ? params[schema[1]] : schema[1]) : (schema.length > 1 ? (schema[0] + '/' + schema[1]) : schema[0]);
}

// Default action for workflow routing
function controller_json_workflow(id) {
	var self = this;
	var w = self.route.workflow;

	self.id = self.route.paramidindex === -1 ? id : self.req.split[self.route.paramidindex];

	CONF.logger && (self.req.$logger = []);

	if (w instanceof Object) {

		if (!w.type) {

			// IS IT AN OPERATION?
			if (!self.route.schema.length) {
				OPERATION(w.id, self.body, w.view ? self.callback(w.view) : self.callback(), self);
				return;
			}

			var schema = self.route.isDYNAMICSCHEMA ? framework_builders.findschema(self.req.$schemaname || (self.route.schema[0] + '/' + self.params[self.route.schema[1]])) : GETSCHEMA(self.route.schema[0], self.route.schema[1]);
			if (!schema) {
				var err = 'Schema "{0}" not found.'.format(getSchemaName(self.route.schema, self.route.isDYNAMICSCHEMA ? self.params : null));
				if (self.route.isDYNAMICSCHEMA)
					self.throw404(err);
				else
					self.throw500(err);
				return;
			}

			if (schema.meta[w.id] !== undefined) {
				w.type = '$' + w.id;
			} else if (schema.meta['workflow#' + w.id] !== undefined) {
				w.type = '$workflow';
				w.name = w.id;
			} else if (schema.meta['transform#' + w.id] !== undefined) {
				w.type = '$transform';
				w.name = w.id;
			} else if (schema.meta['operation#' + w.id] !== undefined) {
				w.type = '$operation';
				w.name = w.id;
			} else if (schema.meta['hook#' + w.id] !== undefined) {
				w.type = '$hook';
				w.name = w.id;
			}
		}

		if (w.name)
			self[w.type](w.name, self.callback(w.view));
		else {

			if (w.type)
				self[w.type](self.callback(w.view));
			else {
				var err = 'Schema "{0}" does not contain "{1}" operation.'.format(schema.name, w.id);
				if (self.route.isDYNAMICSCHEMA)
					self.throw404(err);
				else
					self.throw500(err);
			}
		}

		if (self.route.isDYNAMICSCHEMA)
			w.type = '';

	} else
		self.$exec(w, null, self.callback(w.view));
}

// Default action for workflow routing
function controller_json_workflow_multiple(id) {

	var self = this;
	var w = self.route.workflow;

	self.id = self.route.paramidindex === -1 ? id : self.req.split[self.route.paramidindex];
	CONF.logger && (self.req.$logger = []);

	if (w instanceof Object) {
		if (!w.type) {

			// IS IT AN OPERATION?
			if (!self.route.schema.length) {
				RUN(w.id, self.body, w.view ? self.callback(w.view) : self.callback(), null, self, w.index != null ? w.id[w.index] : null);
				return;
			}

			var schema = self.route.isDYNAMICSCHEMA ? framework_builders.findschema(self.route.schema[0] + '/' + self.params[self.route.schema[1]]) : GETSCHEMA(self.route.schema[0], self.route.schema[1]);
			if (!schema) {
				self.throw500('Schema "{0}" not found.'.format(getSchemaName(self.route.schema, self.isDYNAMICSCHEMA ? self.params : null)));
				return;
			}

			var op = [];
			for (var i = 0; i < w.id.length; i++) {
				var id = w.id[i];
				if (schema.meta[id] !== undefined) {
					op.push({ name: '$' + id });
				} else if (schema.meta['workflow#' + id] !== undefined) {
					op.push({ name: '$workflow', id: id });
				} else if (schema.meta['transform#' + id] !== undefined) {
					op.push({ name: '$transform', id: id });
				} else if (schema.meta['operation#' + id] !== undefined) {
					op.push({ name: '$operation', id: id });
				} else if (schema.meta['hook#' + id] !== undefined) {
					op.push({ name: '$hook', id: id });
				} else {
					// not found
					self.throw500('Schema "{0}" does not contain "{1}" operation.'.format(schema.name, id));
					return;
				}
			}
			w.async = op;
		}

		var async = self.$async(self.callback(w.view), w.index);
		for (var i = 0; i < w.async.length; i++) {
			var a = w.async[i];
			if (a.id)
				async[a.name](a.id);
			else
				async[a.name]();
		}
	} else
		self.$exec(w, null, self.callback(w.view));
}

function ilogger(body) {
	F.path.verify('logs');
	U.queue('F.ilogger', 5, (next) => Fs.appendFile(U.combine(CONF.directory_logs, 'logger.log'), body, next));
}

F.ilogger = function(name, req, ts) {

	if (req && req instanceof Controller)
		req = req.req;

	var isc = CONF.logger === 'console';
	var divider = '';

	for (var i = 0; i < (isc ? 64 : 220); i++)
		divider += '-';

	var msg;

	if (req && !name && req.$logger && req.$logger.length) {

		msg = req.method + ' ' + req.url;

		req.$logger.unshift(msg);
		req.$logger.push(divider);

		if (isc)
			console.log(req.$logger.join('\n'));
		else {
			req.$logger.push('');
			ilogger(req.$logger.join('\n'));
		}

		req.$logger = null;
		return;
	}

	if (!name)
		return;

	var dt = new Date();

	msg = dt.format('yyyy-MM-dd HH:mm:ss') + ' | ' + name.padRight(40, ' ') + ' | ' + (((dt.getTime() - ts) / 1000).format(3) + ' sec.').padRight(12) + ' | ' + (req ? (req.method + ' ' + req.url).max(70) : '').padRight(70);

	if (isc) {
		if (req && req.$logger)
			req.$logger.push(msg);
		else
			console.log(msg + '\n' + divider);
	} else {
		msg = msg + ' | ' + (req ? (req.ip || '') : '').padRight(20) + ' | ' + (req && req.headers ? (req.headers['user-agent'] || '') : '');
		if (req && req.$logger)
			req.$logger.push(msg);
		else
			ilogger(msg + '\n' + divider + '\n');
	}
};

function evalroutehandleraction(controller) {
	if (controller.route.isPARAM)
		controller.route.execute.apply(controller, framework_internal.routeParam(controller.req.split, controller.route));
	else
		controller.route.execute.call(controller);
}

function evalroutehandler(controller) {
	if (!controller.route.schema || !controller.route.schema[1] || controller.req.method === 'DELETE' || controller.req.method === 'GET')
		return evalroutehandleraction(controller);

	F.onSchema(controller.req, controller.route, function(err, body) {
		if (err) {
			controller.$evalroutecallback(err, body);
		} else {
			controller.body = body;
			evalroutehandleraction(controller);
		}
	});
}

global.ACTION = function(url, data, callback) {

	if (typeof(data) === 'function') {
		callback = data;
		data = null;
	}

	var index = url.indexOf(' ');
	var method = url.substring(0, index);
	var params = '';
	var route;

	url = url.substring(index + 1);
	index = url.indexOf('?');

	if (index !== -1) {
		params = url.substring(index + 1);
		url = url.substring(0, index);
	}

	url = url.trim();
	var routeurl = url;

	if (routeurl.endsWith('/'))
		routeurl = routeurl.substring(0, routeurl.length - 1);

	var req = {};
	var res = {};

	req.res = res;
	req.$protocol = 'http';
	req.url = url;
	req.ip = F.ip || '127.0.0.1';
	req.host = req.ip + ':' + (F.port || 8000);
	req.headers = { 'user-agent': 'Total.js/v' + F.version_header };
	req.uri = framework_internal.parseURI(req);
	req.path = framework_internal.routeSplit(req.uri.pathname);
	req.body = data || {};
	req.query = params ? F.onParseQuery(params) : {};
	req.files = EMPTYARRAY;
	req.method = method;
	res.options = req.options = {};

	var route = F.lookupaction(req, url);
	if (!route)
		return;

	if (route.isPARAM)
		req.split = framework_internal.routeSplit(req.uri.pathname, true);
	else
		req.split = EMPTYARRAY;

	var controller = new Controller(route.controller, null, null, route.currentViewDirectory);
	controller.route = route;
	controller.req = req;
	controller.res = res;

	res.$evalroutecallback = controller.$evalroutecallback = callback || NOOP;
	setImmediate(evalroutehandler, controller);
	return controller;
};

function runsnapshot() {

	var main = {};
	var stats = {};
	var lastwarning = 0;

	stats.id = F.id;
	stats.version = {};
	stats.version.node = process.version;
	stats.version.total = F.version_header;
	stats.version.app = CONF.version;
	stats.pid = process.pid;
	stats.thread = global.THREAD;
	stats.mode = DEBUG ? 'debug' : 'release';
	stats.overload = 0;

	main.pid = process.pid;
	main.stats = [stats];

	F.snapshotstats = function() {

		var memory = process.memoryUsage();
		stats.date = NOW;
		stats.memory = (memory.heapUsed / 1024 / 1024).floor(2);
		stats.rm = F.temporary.service.request || 0;      // request min
		stats.fm = F.temporary.service.file || 0;         // files min
		stats.wm = F.temporary.service.message || 0;      // websocket messages min
		stats.mm = F.temporary.service.mail || 0;         // mail min
		stats.om = F.temporary.service.open || 0;         // mail min
		stats.em = F.temporary.service.external || 0;     // external requests min
		stats.dbrm = F.temporary.service.dbrm || 0;       // DB read min
		stats.dbwm = F.temporary.service.dbwm || 0;       // DB write min
		stats.usage = F.temporary.service.usage.floor(2); // app usage in %
		stats.requests = F.stats.request.request;
		stats.pending = F.stats.request.pending;
		stats.errors = F.stats.error;
		stats.timeouts = F.stats.response.error408;
		stats.uptime = F.cache.count;
		stats.online = F.stats.performance.online;

		var err = F.errors[F.errors.length - 1];
		var timeout = F.timeouts[F.timeouts.length - 1];

		stats.lasterror = err ? (err.date.toJSON() + ' ' + (err.error ? err.error : err)) : undefined;
		stats.lasttimeout = timeout;

		if ((stats.usage > 80 || stats.memory > 600 || stats.pending > 1000) && lastwarning !== NOW.getHours()) {
			lastwarning = NOW.getHours();
			stats.overload++;
		}

		if (F.isCluster) {
			if (process.connected) {
				CLUSTER_SNAPSHOT.data = stats;
				process.send(CLUSTER_SNAPSHOT);
			}
		} else
			Fs.writeFile(process.mainModule.filename + '.json', JSON.stringify(main, null, '  '), NOOP);
	};
}

var lastusagedate;

function measure_usage_response() {
	var diff = (Date.now() - lastusagedate) - 60;
	if (diff > 50)
		diff = 50;
	var val = diff < 0 ? 0 : (diff / 50) * 100;
	if (F.temporary.service.usage < val)
		F.temporary.service.usage = val;
	F.stats.performance.usage = val;
}

function measure_usage() {
	lastusagedate = Date.now();
	setTimeout(measure_usage_response, 50);
}

// Because of controller prototypes
// It's used in VIEW() and VIEWCOMPILE()
const EMPTYCONTROLLER = new Controller('', null, null, '');
EMPTYCONTROLLER.isConnected = false;
EMPTYCONTROLLER.req = {};
EMPTYCONTROLLER.req.url = '';
EMPTYCONTROLLER.req.uri = EMPTYOBJECT;
EMPTYCONTROLLER.req.query = EMPTYOBJECT;
EMPTYCONTROLLER.req.body = EMPTYOBJECT;
EMPTYCONTROLLER.req.files = EMPTYARRAY;
global.EMPTYCONTROLLER = EMPTYCONTROLLER;