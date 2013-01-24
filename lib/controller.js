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

var util = require('util'),
	utils = require('./utils'),
	builders = require('./builders'),
	generatorView = require('./view'),
	generatorTemplate = require('./template'),
	path = require('path');

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
	this.isAjax = req.isAjax;
	this.xhr = req.isAjax;
	this.options = subscribe.app.options;
	this.internal = { layout: subscribe.app.options.defaultLayout, isChild: false, callback: null, callbackId: '', model: null, contentType: 'text/html', headers: {} };
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

Controller.prototype.picture = function(id, dimension, name) {

	if (self.app.onPictureDimension === null)
		return null;

	var self = this;
	var size = self.app.onPictureDimension(dimension);

	return {
		id: id,		
		height: size.height,
		width: size.width,
		dimension: dimension,
		name: name || '',
		url: self.app.onPictureUrl(dimension, id, size.width, size.height, name)
	};
};

Controller.prototype.layout = function(name) {
	var self = this;
	self.internal.layout = name;
	return self;
};

Controller.prototype.models = function(name) {
	var self = this;
	return (self.controllers[name] || {}).models;
};

Controller.prototype.functions = function(name) {
	var self = this;
	return (self.controllers[name] || {}).functions;
};

Controller.prototype.$controller = function (id, url, flags, model, options) {
	var self = this;
	self.$controllerVisible(id, true, url, flags, model, options);
};

// náročné na spracovanie
// slowly
Controller.prototype.$controllerVisible = function (id, visible, url, flags, model, options) {
	
	var self = this;
	var cb = function (id, html) {
		self.output = self.output.replace(id, html);
		self.async.next();
	};

	var opt = { isChild: true, callback: cb, callbackId: id, model: model || null, layout: '' };
	util._extend(opt, options);

	self.subscribe.lookup(url, flags, opt);
};

Controller.prototype.$partial = function (id, name, model) {
	var self = this;
	self.$partialVisible(id, true, name, model);
};

Controller.prototype.$partialIf = function (id, bool, nameTrue, nameFalse, model) {
	var self = this;
	self.$partialVisible(id, true, bool ? nameTrue : nameFalse, model);
};

// náročné na spracovanie
// slowly
Controller.prototype.$partialVisible = function (id, visible, name, model) {
	
	var self = this;

	var callback = function (id, html) {
		self.output = self.output.replace(id, html);
		self.async.next();
	};

	if (!visible) {
		callback(id, '');
		return;
	};

	var partial = new Controller(self.name, self.subscribe, self.req, self.res, { isChild: true, callback: callback, callbackId: id, layout: '' }, self.repository);
	partial.view(name, model);
};

Controller.prototype.$template = function (id, name, model, nameEmpty, repository) {
	var self = this;
	self.$templateVisible(id, true, name, model, nameEmpty, repository);
};

Controller.prototype.$templateIf = function(id, bool, nameTrue, nameFalse, model, nameEmpty, repository) {
	var self = this;
	self.$templateVisible(id, true, bool ? nameTrue : nameFalse, model, nameEmpty, repository);
};

// náročné na spracovanie
// slowly
Controller.prototype.$templateVisible = function (id, visible, name, model, nameEmpty, repository) {
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

Controller.prototype.$layout = function (id, cb) {
	var self = this;
	self.output = self.output.replace(id, self.outputTMP);
	cb();
};

Controller.prototype.$routeJS = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.options.staticUrlJS);
};

Controller.prototype.$routeCSS = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.options.staticUrlCSS);
};

Controller.prototype.$routeImage = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.options.staticUrlImage);
};

Controller.prototype.$routeVideo = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.options.staticUrlVideo);
};

Controller.prototype.$routeFont = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.options.staticUrlFont);
};

Controller.prototype.$routeDocument = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.options.staticUrlDocument);
};

Controller.prototype.$routeStatic = function(id, name) {
	var self = this;
	self.privateRoute(id, name, self.app.options.staticUrl);
};

Controller.prototype.$isChecked = function(bool, charBeg, charEnd) {
	var self = this;
	return self.$isValue(bool, charBeg, charEnd, 'checked="checked"');
};

Controller.prototype.$isDisabled = function(bool, charBeg, charEnd) {
	var self = this;
	return self.$isValue(bool, charBeg, charEnd, 'disabled="disabled"');
};

Controller.prototype.$isSelected = function(bool, charBeg, charEnd) {
	var self = this;
	return self.$isValue(bool, charBeg, charEnd, 'selected="selected"');
};

Controller.prototype.$isReadonly = function(bool, charBeg, charEnd) {
	var self = this;
	return self.$isValue(bool, charBeg, charEnd, 'readonly="readonly"');
};

Controller.prototype.$isValue = function(bool, charBeg, charEnd, value) {
	if (!bool)
		return '';
	
	charBeg = charBeg || ' ';
	charEnd = charEnd || '';
	
	return charBeg + value + charEnd;
};	

Controller.prototype.$if = function(bool, ifTrue, ifFalse) {
	var self = this;
	return (bool ? ifTrue : ifFalse) || '';
};

Controller.prototype.routeJS = function(name) {
	var self = this;
	return self.app.routeJS(name);
};

Controller.prototype.routeCSS = function(name) {
	var self = this;
	return self.app.routeCSS(name);
};

Controller.prototype.routeImage = function(name) {
	var self = this;
	return self.app.routeImage(name);
};

Controller.prototype.routeVideo = function(name) {
	var self = this;
	return self.app.routeVideo(name);
};

Controller.prototype.routeFont = function(name) {
	var self = this;
	return self.app.routeFont(name);
};

Controller.prototype.routeDocument = function(name) {
	var self = this;
	return self.app.routeDocument(name);
};

Controller.prototype.routeStatic = function(name) {
	var self = this;
	return self.app.routeStatic(name);
};

Controller.prototype.resource = function(name, key, def) {
	var self = this;
	return self.app.resource(name, key, def);
};

Controller.prototype.json = function(obj, headers) {
	var self = this;

	if (obj instanceof builders.ErrorBuilder)
		obj = obj.json();

	self.subscribe.returnContent(self.statusCode, JSON.stringify(obj || {}), 'application/json', headers);
};

Controller.prototype.content = function(contentBody, contentType, headers) {
	var self = this;
	self.subscribe.returnContent(self.statusCode, contentBody, contentType, headers);
};

Controller.prototype.raw = function(contentType, onWrite, headers) {
	
	var self = this;
	var res = self.res;

	if (res.isFlush)
		return;

	var returnHeaders = {};

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
};

Controller.prototype.plain = function(contentBody, headers) {
	var self = this;
	self.subscribe.returnContent(self.statusCode, typeof(contentBody) === 'string' ? contentBody : contentBody.toString(), 'text/plain', headers);
};

Controller.prototype.file = function(fileName, downloadName, headers) {
	var self = this;
	self.subscribe.returnFile(fileName, utils.getContentType(path.extname(fileName).substring(1)), downloadName, headers);
};

Controller.prototype.view404 = function() {
	var self = this;
	self.subscribe.return404(false);
};

Controller.prototype.view403 = function() {
	var self = this;
	self.subscribe.return403();
};

Controller.prototype.view500 = function(error, code) {
	var self = this;
	self.app.onError(error, self.name, self.req.uri, code);
	self.subscribe.return500(self.name, error);
};

Controller.prototype.redirect = function(url, permament) {
	var self = this;
	self.subscribe.returnRedirect(url, permament);
};

Controller.prototype.view = function(name, model, headers) {

	var self = this;
	
	if (self.async.isBusy())
		return;

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
};

Controller.prototype.onValue = function(id, value) {
	var self = this;
	self.output = self.output.replace(id, value || '');
	self.async.next();
};

Controller.prototype.onComplete = function() {

	var self = this;

	if (self.internal.isChild) {
		self.internal.callback(self.internal.callbackId, self.output);
		return;
	}

		if (self.isLayout || utils.isNullOrEmpty(self.internal.layout)) { 	
		// ukončujeme response
		// ukončujeme request
		self.subscribe.returnContent(self.statusCode, self.output, self.internal.contentType, self.internal.headers);
		return;
	}

	// ukladáme render do TEMPu
	self.outputTMP = self.output;		
	self.isLayout = true;
	
	// ešte layout
	self.view(self.internal.layout, null, self.internal.headers);
};

// náročné na spracovanie
// slowly
Controller.prototype.template = function(name, model, nameEmpty, repository, cb) {

	var self = this;

	var callback = function (id, html) {
		cb(html);
	};

	generatorTemplate.render(self, '', name, nameEmpty, self.prefix, model, repository, callback);
};

// náročné na spracovanie
// slowly
Controller.prototype.controller = function (url, flags, model, options, cb) {
	
	var self = this;
	var cb = function (id, html) {
		cb(html);
	};

	var opt = { isChild: true, callback: cb, callbackId: '', model: model || null, layout: '' };
	util._extend(opt, options);
	self.subscribe.lookup(url, flags, opt);
};

// náročné na spracovanie
// slowly
Controller.prototype.partial = function (name, model, cb) {

	var self = this;
	var callback = function (id, html) {
		cb(html);
	};

	var partial = new Controller(self.name, self.subscribe, self.req, self.res, { isChild: true, callback: callback, callbackId: '', layout: '' }, self.repository);
	partial.view(name, model);
};

// private functions
Controller.prototype.privateRoute = function(id, name, directory) {	
	var self = this;
	var fileName = self.app.onVersion === null ? name : self.app.onVersion(name) || name;
	self.output = self.output.replace(id, directory + fileName);
	self.async.next();
};	

// ======================================================
// EXPORTS
// ======================================================

// inicializácia Controllera
// index.onLookup volá funkciu load();
exports.init = function(name, subscribe, req, res, options) {
	return new Controller(name, subscribe, req, res, options);
};
