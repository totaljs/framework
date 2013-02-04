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

var util = require('util');
var utils = require('./utils');
var builders = require('./builders');
var generatorView = require('./view');
var generatorTemplate = require('./template');
var path = require('path');

/*
	Controller class
	@name {String}
	@subscribe {Subscribe}
	@req {ServerRequest}
	@res {ServerResponse}
	@internal {Object} :: internal config
	@repository {Object} :: repository sharing
	return {Controller};
*/
function Controller(name, subscribe, req, res, internal, repository) {
	
	this.name = name;
	this.subscribe = subscribe;
	this.cache = subscribe.app.cache;
	this.app = subscribe.app;
	this.req = req;
	this.res = res;
	this.session = req.session;
	this.get = req.data.get;
	this.post = req.data.post;
	this.files = req.data.files;
	this.isLayout = false;
	this.isXHR = req.isXHR;
	this.xhr = req.isXHR;
	this.config = subscribe.app.config;
	this.internal = { layout: subscribe.app.config.defaultLayout, isChild: false, callback: null, callbackId: '', model: null, contentType: 'text/html', headers: {} };
	this.statusCode = 200;
	this.controllers = subscribe.app.controllers;

	util._extend(this.internal, internal);

	// dočasné úložisko
	this.repository = repository || {};
	
	// dočasný model
	this.model = {};

	// render output
	this.output = '';
	this.outputTMP = '';

	// v request.prefix je uložený prefix z handlera onPrefix
	this.prefix = req.prefix;

	if (typeof(this.prefix) === 'undefined' || this.prefix.length === 0)
		this.prefix = '';
	else
		this.prefix = this.prefix;

	this.async = utils.async(this);
	this.async.onComplete = this.onComplete;
};

// ======================================================
// PROTOTYPES
// ======================================================

/*
	Create picture class
	@id {String}
	@dimension {String}
	@alt {String}
	return {Object};
*/
Controller.prototype.picture = function(id, dimension, alt) {
	var self = this;

	if (self.app.onPictureDimension === null)
		return null;

	var size = self.app.onPictureDimension !== null ? self.app.onPictureDimension(dimension) : { width: 0, height: 0 };
	var url = self.app.onPictureUrl(dimension, id, size.width, size.height, name);

	return {
		id: id,
		height: size.height,
		width: size.width,
		dimension: dimension,
		alt: alt || '',
		url: url
	};
};

/*
	Get path
	@name {String} :: filename
	return {String};
*/
Controller.prototype.pathPublic = function(name) {
	return utils.combine(this.app.config.directoryPublic, name);
};

/*
	Get path
	@name {String} :: filename
	return {String};
*/
Controller.prototype.pathLog = function(name) {
	return utils.combine(this.app.config.directoryLogs, name);
};

/*
	Get path
	@name {String} :: filename
	return {String};
*/
Controller.prototype.pathTemp = function(name) {
	return utils.combine(this.app.config.directoryTemp, name);
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
	self.repository['$meta'] = self.app.onMeta.apply(this, arguments);
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
Controller.prototype.ifNotModified = function(compare, strict) {
	
	var self = this;
	var isEtag = typeof(compare) === 'string';

	var val = self.req.headers[isEtag ? 'if-none-match' : 'if-modified-since'];

	if (isEtag) {

		if (typeof(val) === 'undefined')
			return false;

		if (val !== compare)
			return false;

	} else {

		if (typeof(val) === 'undefined')
			return false;

		var date = typeof(compare) === 'undefined' ? new Date().toUTCString() : compare.toUTCString();


		if (strict)
 		{			
			if (new Date(Date.parse(val)) === new Date(date))
				return false;
		} else {
			if (new Date(Date.parse(val)) < new Date(date))
				return false;			
		}
	}

	self.res.isFlush = true;
	self.res.writeHead(304);
	self.res.end();

	return true;
};

/*
	Set last modified header
	@value {String or Date}

	if @value === {String} set ETag
	if @value === {Date} set LastModified

	return {Controller};
*/
Controller.prototype.setModified = function(value) {
	var self = this;

	var isEtag = typeof(value) === 'string';

	if (isEtag) {
		self.res.setHeader('Etag', value);
		return self;
	}

	value = value || new Date();
	self.res.setHeader('Last-Modified', value.toUTCString());

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
	@id {String}
	@url {String}
	@flags {String array}
	@model {Object}
	@options {Object}
	return {Controller};
*/
Controller.prototype.$controller = function(id, url, flags, model, options) {
	var self = this;
	self.$controllerVisible(id, true, url, flags, model, options);
	return self;
};

/*
	Internal function for views
	@id {String}
	@visible {Boolean}
	@url {String}
	@flags {String array}
	@model {Object}
	@options {Object}
	return {Controller};
*/
Controller.prototype.$controllerVisible = function(id, visible, url, flags, model, options) {
	
	var self = this;
	var cb = function (id, html) {
		self.output = self.output.replace(id, html);
		self.async.next();
	};

	var opt = { isChild: true, callback: cb, callbackId: id, model: model || null, layout: '' };
	util._extend(opt, options);

	self.subscribe.lookup(url, flags, opt);
	return self;
};

/*
	Internal function for views
	@id {String}
	@name {String} :: filename
	@model {Object}
	return {Controller};
*/
Controller.prototype.$partial = function(id, name, model) {
	var self = this;
	self.$partialVisible(id, true, name, model);
	return self;
};

/*
	Internal function for views
	@id {String}
	@bool {Boolean}
	@nameTrue {String} :: filename
	@nameFalse {String} :: filename
	@model {Object}
	return {Controller};
*/
Controller.prototype.$partialIf = function(id, bool, nameTrue, nameFalse, model) {
	var self = this;
	self.$partialVisible(id, true, bool ? nameTrue : nameFalse, model);
	return self;
};

/*
	Internal function for views
	@id {String}
	@visible {Boolean}
	@name {String} :: filename
	@model {Object}
	return {Controller};
*/
Controller.prototype.$partialVisible = function(id, visible, name, model) {
	
	var self = this;

	var callback = function (id, html) {
		self.output = self.output.replace(id, html);
		self.async.next();
	};

	if (!visible) {
		callback(id, '');
		return self;
	};

	var partial = new Controller(self.name, self.subscribe, self.req, self.res, { isChild: true, callback: callback, callbackId: id, layout: '' }, self.repository);
	partial.view(name, model);
	return self;
};

/*
	Internal function for views
	@id {String}
	@name {String} :: filename
	@model {Object}
	@nameEmpty {String} :: filename
	@repository {Object}
	return {Controller};
*/
Controller.prototype.$template = function(id, name, model, nameEmpty, repository) {
	var self = this;
	self.$templateVisible(id, true, name, model, nameEmpty, repository);
	return self;
};

/*
	Internal function for views
	@id {String}
	@bool {Boolean}
	@nameTrue {String} :: filename
	@nameFalse {String} :: filename
	@model {Object}
	@nameEmpty {String} :: filename
	@repository {Object}
	return {Controller};
*/
Controller.prototype.$templateIf = function(id, bool, nameTrue, nameFalse, model, nameEmpty, repository) {
	var self = this;
	self.$templateVisible(id, true, bool ? nameTrue : nameFalse, model, nameEmpty, repository);
	return self;
};

/*
	Internal function for views
	@id {String}
	@bool {Boolean}
	@name {String} :: filename
	@model {Object}
	@nameEmpty {String} :: filename
	@repository {Object}
	return {Controller};
*/
Controller.prototype.$templateVisible = function(id, visible, name, model, nameEmpty, repository) {
	var self = this;

	var callback = function (id, html) {
		self.output = self.output.replace(id, html);
		self.async.next();
	};

	if (typeof(nameEmpty) === 'object') {
		repository = nameEmpty;
		nameEmpty = '';
	}

	if (!visible) {
		callback(id, '');
		return;
	};

	generatorTemplate.render(self, id, name, nameEmpty, self.prefix, model, repository, callback);
};

/*
	Internal function for views
	@id {String}
	@name {String or Picutre object} :: name is id
	@dimension {String}
	@alt {String}
	@className {String}
	return {String};
*/
Controller.prototype.$picture = function(id, name, dimension, alt, className) {	
	var self = this;

	var picture;
	
	if (typeof(name) === 'object') {
		
		picture = name;		
		if (typeof(className) === 'undefined')
			className = dimension || '';

	} else {
		picture = self.picture(name, dimension, alt);
		className = className || '';
	}

	return '<img src="{0}" width="{1}" height="{2}" alt="{3}" border="0"{4} />'.format(picture.url, picture.width, picture.height, picture.alt, className.length > 0 ? ' class="' + className + '"' : '');
};

/*
	Internal function for views
	@id {String}
	@cb {Function} :: callback
	return {Controller}
*/
Controller.prototype.$body = function(id, cb) {
	var self = this;
	self.output = self.output.replace(id, self.outputTMP);
	cb();
	return self;
};

/*
	Internal function for views
	@id {String}
	@name {String}
	return {Controller}
*/
Controller.prototype.$routeJS = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.config.staticUrlJS);
	return self;
};

/*
	Internal function for views
	@id {String}
	@name {String}
	return {Controller}
*/
Controller.prototype.$routeCSS = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.config.staticUrlCSS);
	return self;
};

/*
	Internal function for views
	@id {String}
	@name {String}
	return {Controller}
*/
Controller.prototype.$routeImage = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.config.staticUrlImage);
	return self;
};

/*
	Internal function for views
	@id {String}
	@name {String}
	return {Controller}
*/
Controller.prototype.$routeVideo = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.config.staticUrlVideo);
	return self;
};

/*
	Internal function for views
	@id {String}
	@name {String}
	return {Controller}
*/
Controller.prototype.$routeFont = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.config.staticUrlFont);
};

/*
	Internal function for views
	@id {String}
	@name {String}
	return {Controller}
*/
Controller.prototype.$routeDocument = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.config.staticUrlDocument);
};

/*
	Internal function for views
	@id {String}
	@name {String}
	return {Controller}
*/
Controller.prototype.$routeStatic = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.config.staticUrl);
};

/*
	Internal function for views
	@id {String}
	@name {String}
	return {Controller}
*/
Controller.prototype.$isChecked = function(bool, charBeg, charEnd) {
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
Controller.prototype.$isDisabled = function(bool, charBeg, charEnd) {
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
Controller.prototype.$isSelected = function(bool, charBeg, charEnd) {
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
Controller.prototype.$isReadonly = function(bool, charBeg, charEnd) {
	var self = this;
	return self.$isValue(bool, charBeg, charEnd, 'readonly="readonly"');
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
	} else if (util.isDate(value))
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
	@arguments {String array}
	return {String} :: empty string
*/
Controller.prototype.$meta = function() {
	var self = this;
	self.repository['$meta'] = self.app.onMeta.apply(self, arguments);
	return '';
};

/*
	Internal function for views
	@name {String}
	return {String} :: empty string
*/
Controller.prototype.$layout = function(name) {
	this.layout(name);
	return '';
};

/*
	Internal function for views
	@arguments {String array}
	return {String} :: empty string
*/
Controller.prototype.$settings = function() {
	var self = this;
	self.repository['$settings'] = self.app.onSettings.apply(self, arguments);
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
	@bool {Boolean}
	@ifTrue {String}
	@ifFalse {String}
	return {String}
*/
Controller.prototype.$if = function(bool, ifTrue, ifFalse) {
	var self = this;
	return (bool ? ifTrue : ifFalse) || '';
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Controller.prototype.routeJS = function(name) {
	var self = this;
	return self.app.routeJS(name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Controller.prototype.routeCSS = function(name) {
	var self = this;
	return self.app.routeCSS(name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Controller.prototype.routeImage = function(name) {
	var self = this;
	return self.app.routeImage(name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Controller.prototype.routeVideo = function(name) {
	var self = this;
	return self.app.routeVideo(name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Controller.prototype.routeFont = function(name) {
	var self = this;
	return self.app.routeFont(name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Controller.prototype.routeDocument = function(name) {
	var self = this;
	return self.app.routeDocument(name);
};

/*
	Static file routing
	@name {String} :: filename
	return {String};
*/
Controller.prototype.routeStatic = function(name) {
	var self = this;
	return self.app.routeStatic(name);
};

/*
	Resource reader
	@name {String} :: filename
	@key {String}
	@def {String} :: default value
	return {String};
*/
Controller.prototype.resource = function(name, key, def) {
	var self = this;
	return self.app.resource(name, key, def);
};

/*
	Response JSON
	@obj {Object}
	@headers {Object}
	return {Controller};
*/
Controller.prototype.json = function(obj, headers) {
	var self = this;

	if (obj instanceof builders.ErrorBuilder)
		obj = obj.json();
	else
		obj = JSON.stringify(obj || {});
	
	self.subscribe.returnContent(self.statusCode, obj, 'application/json', headers);
	return self;
};

/*
	Response custom content
	@contentBody {String}
	@contentType {String}
	@headers {Object}
	return {Controller};
*/
Controller.prototype.content = function(contentBody, contentType, headers) {
	var self = this;
	self.subscribe.returnContent(self.statusCode, contentBody, contentType, headers);
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

	if (res.isFlush)
		return self;

	var returnHeaders = {};

	returnHeaders['Cache-Control'] = 'private';

	if (headers)
		util._extend(returnHeaders, headers);

	if (contentType === null)
		contentType = 'text/plain';

	if ((/text|application/).test(contentType))
		contentType += '; charset=utf-8';

	returnHeaders['Content-Type'] = contentType;

	res.isFlush = true;
	res.writeHead(self.statusCode, returnHeaders);
	
	onWrite(function(chunk, encoding) {
		res.write(chunk, encoding);
	});

	res.end();

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
	self.subscribe.returnContent(self.statusCode, typeof(contentBody) === 'string' ? contentBody : contentBody.toString(), 'text/plain', headers);
	return self;
};

/*
	Response file
	@fileName {String}
	@downloadName {String}
	@headers {Object}
	return {Controller};
*/
Controller.prototype.file = function(fileName, downloadName, headers) {
	var self = this;
	self.subscribe.returnFile(fileName, utils.getContentType(path.extname(fileName).substring(1)), downloadName, headers);
	return self;
};

/*
	Response 404
	return {Controller};
*/
Controller.prototype.view404 = function() {
	var self = this;
	self.subscribe.return404(false);
	return self;
};

/*
	Response 403
	return {Controller};
*/
Controller.prototype.view403 = function() {
	var self = this;
	self.subscribe.return403();
	return self;
};

/*
	Response 500
	@error {String}
	return {Controller};
*/
Controller.prototype.view500 = function(error) {
	var self = this;
	self.subscribe.return500(self.name, error);
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
	self.subscribe.returnRedirect(url, permament);
	return self;
};

/*
	Response view
	@name {String}
	@model {Object} :: optional
	@headers {Object} :: optional
	return {Controller};
*/
Controller.prototype.view = function(name, model, headers) {

	var self = this;
	
	if (self.async.isBusy())
		return self;

	var callback = function(obj) {
		
		self.output = obj.html;
		self.model = model;

		obj.generator.forEach(function(o) {
			self.async.add(function(cb) {
				eval(o);
			});
		});

		// voláme funkcie v poole
		self.async.run();
	};

	self.internal.headers = headers;
	generatorView.render(self.subscribe, name, self.prefix, callback);

	return self;
};

/*
	Internal function for views
	@id {String}
	@value {String}
	return {Controller}
*/
Controller.prototype.onValue = function(id, value) {
	var self = this;
	self.output = self.output.replace(id, value || '');
	self.async.next();
	return self;
};

/*
	Internal function for views
	return {Controller}
*/
Controller.prototype.onComplete = function() {

	var self = this;

	if (self.internal.isChild) {
		self.internal.callback(self.internal.callbackId, self.output);
		return self;
	}

	if (self.isLayout || utils.isNullOrEmpty(self.internal.layout)) { 	
		// ukončujeme response
		// ukončujeme request
		self.subscribe.returnContent(self.statusCode, self.output, self.internal.contentType, self.internal.headers);
		return self;
	}

	// ukladáme render do TEMPu
	self.outputTMP = self.output;		
	self.isLayout = true;
	
	// ešte layout
	self.view(self.internal.layout, null, self.internal.headers);
	return self;
};

/*
	Render template to string
	@name {String} :: filename
	@model {Object}
	@nameEmpty {String} :: filename
	@repository {Object}
	@cb {Function} :: callback(string)
	return {Controller};
*/
Controller.prototype.template = function(name, model, nameEmpty, repository, cb) {

	var self = this;

	var callback = function (id, html) {
		cb(html);
	};

	generatorTemplate.render(self, '', name, nameEmpty, self.prefix, model, repository, callback);
	return self;
};

/*
	Render another controller to string
	@url {String}
	@flags {String array}
	@model {Object}
	@options {Object}
	@cb {Function} :: callback(string)
	return {Controller};
*/
Controller.prototype.controller = function(url, flags, model, options, cb) {
	
	var self = this;
	var cb = function (id, html) {
		cb(html);
	};

	var opt = { isChild: true, callback: cb, callbackId: '', model: model || null, layout: '' };
	util._extend(opt, options);
	self.subscribe.lookup(url, flags, opt);

	return self;
};

/*
	Render partial view to string
	@name {String} :: filename
	@model {Object}
	@cb {Function} :: callback(string)
	return {Controller};
*/
Controller.prototype.partial = function(name, model, cb) {

	var self = this;
	var callback = function (id, html) {
		cb(html);
	};

	var partial = new Controller(self.name, self.subscribe, self.req, self.res, { isChild: true, callback: callback, callbackId: '', layout: '' }, self.repository);
	partial.view(name, model);

	return self;
};

/*
	Internal functions for routeJS, routeCSS, etc.
	@id {String}
	@name {String} :: filename
	@directory {String}
	return {Controller};
*/
Controller.prototype.privateRoute = function(id, name, directory) {	
	var self = this;
	var fileName = self.app.onVersion === null ? name : self.app.onVersion(name) || name;
	self.output = self.output.replace(id, directory + fileName);
	self.async.next();

	return self;
};	

// ======================================================
// EXPORTS
// ======================================================

/*
	Controller init
	@name {String}
	@subscribe {Subscribe}
	@req {ServerRequest}
	@res {ServerResponse}
	@options {Object}
	return {Controller};
*/
exports.init = function(name, subscribe, req, res, options) {
	return new Controller(name, subscribe, req, res, options);
};
