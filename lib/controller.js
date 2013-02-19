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
	@internal {Object} :: internal options
	return {Controller};
*/
function Controller(name, subscribe, req, res, internal) {
	
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
	this.internal = { layout: subscribe.app.config.defaultLayout, contentType: 'text/html' };
	this.statusCode = 200;
	this.controllers = subscribe.app.controllers;

	this.isTest = req.headers['assertion-testing'] === '1';
	this.isDebug = subscribe.app.config.debug;

	util._extend(this.internal, internal);

	// dočasné úložisko
	this.repository = {};
	
	// render output
	this.output = '';
	this.outputTMP = '';

	// v request.prefix je uložený prefix z handlera onPrefix
	this.prefix = req.prefix;

	if (typeof(this.prefix) === 'undefined' || this.prefix.length === 0)
		this.prefix = '';
	else
		this.prefix = this.prefix;
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
	@name {String} :: filename
	@model {Object}
	return {String};
*/
Controller.prototype.$view = function(name, model) {
	return this.$viewVisible(true, name, model);
};

/*
	Internal function for views
	@id {String}
	@bool {Boolean}
	@nameTrue {String} :: filename
	@nameFalse {String} :: filename
	@model {Object}
	return {String};
*/
Controller.prototype.$viewIf = function(bool, nameTrue, nameFalse, model) {
	return this.$viewVisible(true, bool ? nameTrue : nameFalse, model);
};

/*
	Internal function for views
	@id {String}
	@visible {Boolean}
	@name {String} :: filename
	@model {Object}
	return {String};
*/
Controller.prototype.$viewVisible = function(visible, name, model) {
	if (!visible)
		return '';
	return this.view(name, model, null, true);
};

/*
	Internal function for views
	@name {String} :: filename
	return {String};
*/
Controller.prototype.$content = function(name) {
	return this.$contentVisible(true, name);
};

/*
	Internal function for views
	@bool {Boolean}
	@nameTrue {String} :: filename
	@nameFalse {String} :: filename
	return {String};
*/
Controller.prototype.$contentIf = function(bool, nameTrue, nameFalse) {
	return this.$contentVisible(true, bool ? nameTrue : nameFalse);
};

/*
	Internal function for views
	@visible {Boolean}
	@name {String} :: filename
	return {String};
*/
Controller.prototype.$contentVisible = function(visible, name) {

	var self = this;

	if (!visible)
		return '';

	return generatorView.generateContent(self, name);
};

/*
	Internal function for views
	@id {String}
	@name {String} :: filename
	@model {Object} :: must be an array
	@nameEmpty {String} :: optional filename from contents
	@repository {Object} :: optional
	return {Controller};
*/
Controller.prototype.$template = function(name, model, nameEmpty, repository) {
	var self = this;
	return self.$templateVisible(true, name, model, nameEmpty, repository);
};

/*
	Internal function for views
	@id {String}
	@bool {Boolean}
	@nameTrue {String} :: filename
	@nameFalse {String} :: filename
	@model {Object}
	@nameEmpty {String} :: optional filename from contents
	@repository {Object} :: optional
	return {Controller};
*/
Controller.prototype.$templateIf = function(bool, nameTrue, nameFalse, model, nameEmpty, repository) {
	var self = this;
	self.$templateVisible(true, bool ? nameTrue : nameFalse, model, nameEmpty, repository);
	return self;
};

/*
	Internal function for views
	@id {String}
	@bool {Boolean}
	@name {String} :: filename
	@model {Object}
	@nameEmpty {String} :: optional filename from contents
	@repository {Object} :: optional
	return {Controller};
*/
Controller.prototype.$templateVisible = function(visible, name, model, nameEmpty, repository) {
	var self = this;

	if (!visible)
		return '';

	return self.template(name, model, nameEmpty, repository);
};

/*
	Internal function for views
	@name {String or Picture object}
	@dimension {String}
	@alt {String} :: optional
	@className {String} :: optinal
	return {String};
*/
Controller.prototype.$picture = function(name, dimension, alt, className) {	
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
	return {String}
*/
Controller.prototype.$body = function() {
	return this.outputTMP;
};

/*
	Internal function for views
	@name {String}
	return {String}
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
	Internal function for views
	@arr {Array} :: array of object or plain value array
	@selected {Object} :: value for selecting item
	@name {String} :: name of name property
	@value {String} :: name of value property
	return {String}
*/
Controller.prototype.$options = function(arr, selected, name, value) {
	var self = this;

	if (arr === null || typeof(arr) === 'undefined')
		return '';

	if (!util.isArray(arr))
		arr = [arr];

	selected = selected || '';
	
	var options = '';

	if (typeof(value) === 'undefined')
		value = value || name || 'value';
	
	if (typeof(name) === 'undefined')
		name = name || 'name';

	var isSelected = false;
	arr.forEach(function(o, index) {
	
		var type = typeof(o);
		var text = '';
		var val = '';
		var sel = false;

		if (type === 'object') {
			
			text = (o[name] || '');
			val = (o[value] || '');

			if (typeof(text) === 'function')
				text = text(index);

			if (typeof(val) === 'function')
				val = val(index, text);
		} else {
			text = o;
			val = o;
		}

		if (!isSelected) {
			sel = val == selected;
			isSelected = sel;
		}

		options += '<option value="' + val.toString().htmlEncode() + '"'+ (sel ? ' selected="selected"' : '') + '>' + text.toString().htmlEncode() + '</option>';
	});
	return options;
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
	@isPartial {Boolean} :: internal parameter
	return {Controller or String}; string is returned when isPartial == true
*/
Controller.prototype.view = function(name, model, headers, isPartial) {
	var self = this;
	var generator = generatorView.generate(self, name);
	var values = [];
	var repository = self.repository;
	var config = self.config;
	var get = self.get;
	var post = self.post;
	var helper = self.app.helpers;
	var fn = eval(generator.generator);

	for (var i = 0; i < generator.execute.length; i++) {
	
		var execute = generator.execute[i];
		var isEncode = execute.isEncode;
		var run = execute.run;
		var evl = true;

		switch (execute.name) {
			case 'view':
			case 'viewIf':
			case 'viewVisible':
			case 'content':
			case 'contentIf':
			case 'contentVisible':
			case 'template':
			case 'templateIf':
			case 'templateVisible':
				isEncode = false;
				run = 'self.$'+ run;
				break;

			case 'body':
				isEncode = false;
				evl = false;				
				values[i] = self.outputTMP;
				break;

			case 'meta':
			case 'settings':

				isEncode = false;				
				if (execute.execute.indexOf('(') !== -1) {
					evl = false;
					values[i] = '';
					eval('self.' + run);
				} else
					run = 'self.repository["$'+ execute.name + '"]';

				break;

			case 'options':
			case 'isReadonly':
			case 'isSelected':
			case 'isDisabled':
			case 'isChecked':
			case 'etag':
			case 'modified':
			case 'picture':
				isEncode = false;
				run = 'self.$' + run;
				break;

			case 'if':
			case 'model':
			case 'repository':
			case 'get':
			case 'post':
			case 'resource':
			case 'layout':
			case 'routeJS':
			case 'routeCSS':
			case 'routeImage':
			case 'routeFont':
			case 'routeDocument':
			case 'routeVideo':
			case 'routeStatic':
				values[i] = eval(run) || '';
				break;
			
			default:
				
				if (typeof(helper[execute.name]) === 'undefined') {
					self.app.error(new Error('Helper "' + execute.name + '" is not defined.'), 'view -> ' + name, self.req.uri);
					values[i] = '';
					evl = false;
				}
				else
					run = 'helper.' + run;

				break;
		}

		if (evl) {
			try
			{
				values[i] = eval(run) || '';
			} catch (ex) {
				self.app.error(ex, 'view -> ' + name, self.req.uri);
				values[i] = '';
			}
		}

		if (isEncode)
			values[i] = values[i].toString().htmlEncode();
	}

	var value = fn(values).replace(/\\n/g, '\n');

	if (isPartial)
		return value;

	self.output = value;

	if (self.isLayout || utils.isNullOrEmpty(self.internal.layout)) {
		// end response
		// end request
		self.subscribe.returnContent(self.statusCode, self.output, self.internal.contentType, headers);
		return self;
	}

	self.outputTMP = self.output;
	self.isLayout = true;
	self.view(self.internal.layout, null, headers);

	return self;
};

/*
	Render template to string
	@name {String} :: filename
	@model {Object}
	@nameEmpty {String} :: filename for empty Contents
	@repository {Object}
	@cb {Function} :: callback(string)
	return {String};
*/
Controller.prototype.template = function(name, model, nameEmpty, repository) {

	var self = this;

	if (typeof(nameEmpty) === 'object') {
		repository = nameEmpty;
		nameEmpty = '';
	}

	if (typeof(model) === 'undefined' || model === null || model.length === 0) {

		if (typeof(nameEmpty) !== 'undefined')
			return self.$content(nameEmpty);

		return '';
	}

	return generatorTemplate.generate(self, name, model, repository);
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
