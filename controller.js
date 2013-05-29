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

var utils = require('./utils');
var builders = require('./builders');
var internal = require('./internal');
var generatorView = require('./view');
var generatorTemplate = require('./template');
var path = require('path');
var qs = require('querystring');

var REPOSITORY_HEAD = '$head';
var REPOSITORY_META = '$meta';
var REPOSITORY_META_TITLE = '$title';
var REPOSITORY_META_DESCRIPTION = '$description';
var REPOSITORY_META_KEYWORDS = '$keywords';

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

Subscribe.prototype.multipart = function(header) {

	var self = this;
	self.route = self.framework.lookup(self.req, self.req.uri.pathname, self.req.flags, true);

	if (self.route === null) {
		self.req.connection.destroy();
		self.dispose();
		return;
	}

	internal.parseMULTIPART(self.req, header, self.route.maximumSize, self.framework.config['directory-temp'], self.framework.handlers.onxss, self.handlers._end);
};

Subscribe.prototype.urlencoded = function() {

	var self = this;
	self.route = self.framework.lookup(self.req, self.req.uri.pathname, self.req.flags, true);

	if (self.route === null) {
		self.req.clear();
		self.req.connection.destroy();
		self.dispose();
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

Subscribe.prototype.execute = function(status) {

	var self = this;

	if (self.route === null) {
		self.framework.responseContent(self.req, self.res, status || 404, (status || 404).toString(), 'text/plain', true);
		return self;
	}

	var name = self.route.name;
	self.controller = new Controller(name, self.framework, self.req, self.res, self);

	if (!self.isCanceled)
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

		if (typeof(o.onRequest) !== 'undefined')
			o.onRequest.call(self.controller, self.controller);

	} catch (err) {
		self.framework.error(err, name, self.req.uri);
	}

	try
	{
		if (!self.controller.isCanceled)
			self.route.onExecute.apply(self.controller, internal.routeParam(self.req.path, self.route));

		self.route = null;

	} catch (err) {
		self.controller = null;
		self.framework.error(err, name, self.req.uri);
		self.route = self.framework.lookup(self.req, '#500', []);
		self.execute(500);
	}
};

Subscribe.prototype._authorization = function(isLogged) {
	var self = this;

	self.req.flags.push(isLogged ? 'logged' : 'unlogged');
	self.route = self.framework.lookup(self.req, self.req.buffer.isExceeded ? '#431' : self.req.uri.pathname, self.req.flags);

	if (self.route === null)
		self.route = self.framework.lookup(self.req, '#404', []);

	self.execute(self.req.buffer.isExceeded ? 431 : 404);
};

Subscribe.prototype._end = function() {

	var self = this;

	if (self.req.buffer.isExceeded) {
		self.req.clear();
		self.req.connection.destroy();
		self.dispose();
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
		self.dispose();
		return;
	}

	for (var i = 0; i < length; i++) {
		var file = files[i];
		try
		{

			if (file.onValidation.call(self.framework, self.req, self.res)) {
				file.onExecute.call(self.framework, self.req, self.res);
				self.dispose();
				return;
			}

		} catch (err) {
			self.framework.error(err, file.controller + ' :: ' + file.name, self.req.uri);
			self.framework.responseContent(self.req, self.res, 500, '500 - internal servere error', 'text/plain', true);
			self.dispose();
			return;
		}
	}

	self.framework.onStatic(self.req, self.res);
	self.dispose();
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

/*
	Controller class
	@name {String}
	@framework {Framework}
	@req {ServerRequest}
	@res {ServerResponse}
	@internal {Object} :: internal options
	return {Controller};
*/
function Controller(name, framework, req, res, subscribe) {

	this.subscribe = subscribe;
	this.name = name;
	this.cache = framework.cache;
	this.app = framework;
	this.framework = framework;
	this.req = req;
	this.res = res;
	this.session = req.session;
	this.get = req.data.get;
	this.post = req.data.post;
	this.files = req.data.files;
	this.isLayout = false;
	this.isXHR = req.isXHR;
	this.xhr = req.isXHR;
	this.config = framework.config;
	this.internal = { layout: framework.config['default-layout'], contentType: 'text/html' };
	this.statusCode = 200;
	this.controllers = framework.controllers;
	this.url = utils.path(req.uri.pathname);
	this.isTest = req.headers['assertion-testing'] === '1';
	this.isDebug = framework.config.debug;
	this.isCanceled = false;

	this.global = framework.global;
	this.flags = req.flags;

	// dočasné úložisko
	this.repository = {};
	this.model = null;

	// render output
	this.output = '';
	this.prefix = req.prefix;

	if (typeof(this.prefix) === 'undefined' || this.prefix.length === 0)
		this.prefix = '';
	else
		this.prefix = this.prefix;

	this.async = new utils.Async(this);
};

// ======================================================
// PROTOTYPES
// ======================================================

/*
	Validation / alias for validate
	return {ErrorBuilder}
*/
Controller.prototype.validation = function(model, properties, prefix, name) {
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
Controller.prototype.validate = function(model, properties, prefix, name) {

	var self = this;

	var resource = function(key) {
		return self.resource(name || 'default', (prefix || '') + key);
	};

	var error = new builders.ErrorBuilder(resource);
	return utils.validate.call(self, model, properties, self.app.onValidation, error);
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
	Get path
	@name {String} :: filename
	return {String}
*/
Controller.prototype.pathPublic = function(name) {
	return utils.combine(this.app.config['directory-public'], name).replace(/\\/g, '/');
};

/*
	Get path
	@name {String} :: filename
	return {String}
*/
Controller.prototype.pathLog = function(name) {
	return utils.combine(this.app.config['directory-logs'], name).replace(/\\/g, '/');
};

/*
	Get path
	@name {String} :: filename
	return {String}
*/
Controller.prototype.pathTemp = function(name) {
	return utils.combine(this.app.config['directory-temp'], name).replace(/\\/g, '/');
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

	if (typeof(name) === 'undefined')
		return self.repository.sitemap || [];

	if (typeof(url) === 'undefined')
		url = self.req.url;

	if (typeof(self.repository.sitemap) === 'undefined')
		self.repository.sitemap = [];

	self.repository.sitemap.push({ name: name, url: url, index: index || self.repository.sitemap.length });

	if (typeof(index) !== 'undefined' && self.sitemap.length > 1) {
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

	if (typeof(date) === 'undefined')
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

	return generatorView.generateContent(self, name) || '';
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

	if (typeof(attr) === 'string')
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

	if (typeof(attr) === 'string')
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
	var attrEnd = '"';

	if (typeof(attr) !== 'object')
		attr = {};

	builder += ' name="' + name + '" id="' + (attr.id || name) + attrEnd;

	if (attr.class)
		builder += ' class="' + attr.class + attrEnd;

	if (attr.maxlength > 0)
		builder += ' maxlength="'+ attr.maxlength + attrEnd;

	if (attr.required === true)
		builder += ' required="required"';

	if (attr.disabled === true)
		builder += ' disabled="disabled"';

	if (attr.cols > 0)
		builder += ' cols="' + attr.cols + attrEnd;

	if (attr.rows > 0)
		builder += ' rows="' + attr.rows + attrEnd;

	if (attr.style)
		builder += ' style="' + attr.style + attrEnd;

	if (attr.pattern)
		builder += ' pattern="' + pattern + attrEnd;

	if (typeof(model) === 'undefined')
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
	var attrEnd = '"';

	if (typeof(attr) !== 'object')
		attr = {};

	var val = attr.value || '';

	builder += ' type="' + type + attrEnd;

	if (type === 'radio')
		builder += ' name="' + name + attrEnd;
	else
		builder += ' name="' + name + '" id="' + (attr.id || name) + attrEnd;

	if (attr.class)
		builder += ' class="' + attr.class + attrEnd;

	if (attr.style)
		builder += ' style="' + attr.style + attrEnd;

	if (attr.maxlength)
		builder += ' maxlength="' + attr.maxlength + attrEnd;

	if (attr.max)
		builder += ' max="' + attr.max + attrEnd;

	if (attr.step)
		builder += ' step="' + attr.step + attrEnd;

	if (attr.min)
		builder += ' min="' + attr.min + attrEnd;

	if (attr.readonly === true)
		builder += ' readonly="readonly"';

	if (attr.placeholder)
		builder += ' placeholder="' + (attr.placeholder || '').toString().htmlEncode() + attrEnd;

	if (attr.autofocus === true)
		builder += ' autofocus="autofocus"';

	if (attr.list)
		builder += ' list="' + attr.list + attrEnd;

	if (attr.required === true)
		builder += ' required="required"';

	if (attr.disabled === true)
		builder += ' disabled="disabled"';

	if (attr.pattern && attr.pattern.length > 0)
		builder += ' pattern="' + attr.pattern + attrEnd;

	if (attr.autocomplete) {
		if (attr.autocomplete === true || attr.autocomplete === 'on')
			builder += ' autocomplete="on"';
		else
			builder += ' autocomplete="off"';
	}

	var value = '';

	if (typeof(model) !== 'undefined') {
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

	if (typeof(value) !== 'undefined')
		builder += ' value="' + value.toString().htmlEncode() + attrEnd;
	else
		builder += ' value="' + (attr.value || '').toString().htmlEncode() + attrEnd;

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

	if (type === 'number') {
		date = new Date(value);
	} else if (type === 'string') {

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

	if (typeof(date) === 'undefined')
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

	if (arr === null || typeof(arr) === 'undefined')
		return '';

	if (!utils.isArray(arr))
		arr = [arr];

	selected = selected || '';

	var options = '';

	if (typeof(value) === 'undefined')
		value = value || name || 'value';

	if (typeof(name) === 'undefined')
		name = name || 'name';

	var isSelected = false;
	for (var i = 0; i < arr.length; i++) {
		var o = arr[i];
		var type = typeof(o);
		var text = '';
		var val = '';
		var sel = false;

		if (type === 'object') {

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

	var attrEnd = '"';
	var style = '';

	if (typeof(width) === 'object') {
		height = width.height;
		alt = width.alt;
		className = width.class;
		style = width.style;
		width = width.width;
	}

	var builder = '<img src="' + this.routeImage(name) + attrEnd;

	if (width > 0)
		builder += ' width="' + width + attrEnd;

	if (height > 0)
		builder += ' height="' + height + attrEnd;

	if (alt)
		builder += ' alt="' + alt.htmlEncode() + attrEnd;

	if (className)
		builder += ' class="' + className + attrEnd;

	if (style)
		builder += ' style="' + style + attrEnd;

	return builder + ' border="0" />';
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
	Static file routing
	@name {String} :: filename
	@tag {Boolean} :: optional, append tag? default: false
	return {String}
*/
Controller.prototype.routeJS = function(name, tag) {
	var self = this;

	if (typeof(name) === 'undefined')
		name = 'default.js';

	return tag ? '<script type="text/javascript" src="' + self.app.routeJS(name) + '"></script>' : self.app.routeJS(name);
};

/*
	Static file routing
	@name {String} :: filename
	@tag {Boolean} :: optional, append tag? default: false
	return {String}
*/
Controller.prototype.routeCSS = function(name, tag) {
	var self = this;

	if (typeof(name) === 'undefined')
		name = 'default.css';

	return tag ? '<link type="text/css" rel="stylesheet" href="' + self.app.routeCSS(name) + '" />' : self.app.routeCSS(name);
};

/*
	Append favicon TAG
	@name {String} :: filename
	return {String}
*/
Controller.prototype.$favicon = function(name) {
	var self = this;
	var contentType = 'image/x-icon';

	if (typeof(name) === 'undefined')
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
	return {String}
*/
Controller.prototype.routeImage = function(name) {
	return this.app.routeImage(name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String}
*/
Controller.prototype.routeVideo = function(name) {
	var self = this;
	return self.app.routeVideo(name);
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
Controller.prototype.routeDocument = function(name) {
	var self = this;
	return self.app.routeDocument(name);
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

	if (self.isCanceled || self.res.success)
		return '';

	if (typeof(nameEmpty) === 'object') {
		repository = nameEmpty;
		nameEmpty = '';
	}

	if (typeof(model) === 'undefined' || model === null || model.length === 0) {

		if (typeof(nameEmpty) !== 'undefined' && nameEmpty.length > 0)
			return self.$content(nameEmpty);

		return '';
	}

	return generatorTemplate.generate(self, name, model, repository);
};

/*
	Response JSON
	@obj {Object}
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.json = function(obj, headers) {
	var self = this;

	if (self.isCanceled || self.res.success)
		return self;

	if (obj instanceof builders.ErrorBuilder)
		obj = obj.json();
	else
		obj = JSON.stringify(obj || {});

	self.subscribe.success();
	self.framework.responseContent(self.req, self.res, self.statusCode, obj, 'application/json', true, headers);
	self._dispose();
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

	if (self.isCanceled || self.res.success)
		return typeof(contentType) === 'undefined' ? '' : self;

	if (typeof(contentType) === 'undefined')
		return self.$contentToggle(true, contentBody);

	self.subscribe.success();
	self.framework.responseContent(self.req, self.res, self.statusCode, contentBody, contentType || 'text/plain', true, headers);
	self._dispose();
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

	if (self.isCanceled || self.res.success)
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

	onWrite(function(chunk, encoding) {
		res.write(chunk, encoding || 'utf8');
	});

	res.end();
	self._dispose();
	return self;
};

/*
	Response plain text
	@contentBody {String}
	@headers {Object}
	return {Controller};
*/
Controller.prototype.plain = function(contentBody, headers) {
	var self = this;

	if (self.isCanceled || self.res.success)
		return self;

	self.subscribe.success();
	self.framework.responseContent(self.req, self.res, self.statusCode, typeof(contentBody) === 'string' ? contentBody : contentBody.toString(), 'text/plain', true, headers);
	self._dispose();
	return self;
};

/*
	Response file
	@fileName {String}
	@downloadName {String} :: optional
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.file = function(fileName, downloadName, headers) {
	var self = this;

	if (self.isCanceled || self.res.success)
		return self;

	fileName = utils.combine(self.framework.config['directory-public'], fileName);

	self.subscribe.success();
	self.framework.responseFile(self.req, self.res, fileName, downloadName, headers);
	self._dispose();
	return self;
};

/*
	Response Async file
	@fileName {String}
	@downloadName {String} :: optional
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.fileAsync = function(fileName, downloadName, headers) {
	var self = this;

	var fn = function() {
		self.file(fileName, downloadName, headers);
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

	if (self.isCanceled || self.res.success)
		return self;

	self.subscribe.success();
	self.framework.responseStream(self.req, self.res, contentType, stream, downloadName, headers);
	self._dispose();
	return self;
};

/*
	Response 404
	return {Controller};
*/
Controller.prototype.view404 = function() {
	var self = this;

	if (self.isCanceled || self.res.success)
		return self;

	self.req.path = [];
	self.subscribe.success();
	self.subscribe.route = self.framework.lookup(self.req, '#404', []);
	self.subscribe.execute(404);
	self._dispose();
	return self;
};

/*
	Response 403
	return {Controller};
*/
Controller.prototype.view403 = function() {
	var self = this;

	if (self.isCanceled || self.res.success)
		return self;

	self.req.path = [];
	self.subscribe.success();
	self.subscribe.route = self.framework.lookup(self.req, '#403', []);
	self.subscribe.execute(403);
	self._dispose();
	return self;
};

/*
	Response 500
	@error {String}
	return {Controller};
*/
Controller.prototype.view500 = function(error) {
	var self = this;

	if (self.isCanceled || self.res.success)
		return self;

	self.req.path = [];
	self.framework.error(new Error(error), self.name, self.req.uri);
	self.subscribe.success();
	self.subscribe.route = self.framework.lookup(self.req, '#500', []);
	self.subscribe.execute(500);
	self._dispose();
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

	if (self.isCanceled || self.res.success)
		return self;

	self.subscribe.success();
	self.res.success = true;
	self.res.writeHead(permament ? 301 : 302, { 'Location': url });
	self.res.end();
	self._dispose();
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
	Return database
	@name {String}
	return {Database};
*/
Controller.prototype.database = function(name) {
	return this.app.database(name);
};

Controller.prototype._dispose = function() {
	var self = this;
	var cancel = self.isCanceled;
	self.dispose();
	self.isCanceled = cancel;
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

	if (self.isCanceled || self.res.success)
		return isPartial ? '' : self;

	var generator = generatorView.generate(self, name);

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

	if (typeof(isPartial) === 'undefined' && typeof(headers) === 'boolean') {
		isPartial = headers;
		headers = null;
	}

	var condition = false;

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
			case 'next':
			case 'prev':
			case 'prerender':
			case 'prefetch':
			case 'canonical':
				break;

			default:

				if (!execute.isDeclared) {
					if (typeof(helper[execute.name]) === 'undefined') {
						self.app.error(new Error('Helper "' + execute.name + '" is not defined.'), 'view -> ' + name, self.req.uri);
						evl = false;
					}
					else {
						isEncode = false;
						if (condition)
							run = run.replace('(function(){', '(function(){return helper.');
						else
							run = 'helper.' + generatorView.appendThis(run);
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

		if (typeof(value) === 'function') {
			values[i] = value;
			continue;
		}

		if (value === null)
			value = '';

		var type = typeof(value);

		if (type === 'undefined')
			value = '';
		else if (type !== 'string')
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
		self.framework.responseContent(self.req, self.res, self.statusCode, value, self.internal.contentType, true, headers);
		self._dispose();
		return self;
	}

	self.output = value;
	self.isLayout = true;
	self.view(self.internal.layout, null, headers);
	return self;
};

// ======================================================
// EXPORTS
// ======================================================

exports.Subscribe = Subscribe;