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

var controller = require('./controller');
var internal = require('./internal');
var utils = require('./utils');

function Subscribe(framework, req, res) {
	this.req = req;
	this.res = res;
	this.app = framework;
	this.isError = false;
	this.isAuthorized = true;
	this._myurl = null;	
};

// ======================================================
// PROTOTYPES
// ======================================================

/*
	Internal function
	return {Boolean}
*/
Subscribe.prototype.isFlush = function isFlush() {
	return this.res.isFlush || false;
};

/*
	Internal function
	@plain {Boolean}
	return {Subscribe}
*/
Subscribe.prototype.return404 = function return404(plain) {
	
	var self = this;

	if (self.isFlush())
		return self;	

	if (plain || this.isError) {
		self.app.returnContent(self.req, self.res, 404, '404', 'text/plain', true);
		return self;
	}

	// hľadáme route #404
	self.lookup(null, '#404');
	return self;
};

/*
	Internal function
	return {Subscribe}
*/
Subscribe.prototype.return403 = function return403() {

	var self = this;
	
	if (self.isFlush())
		return self;

	// hľadáme route #403
	self.lookup(null, '#403');
	return self;
};

/*
	Internal function
	@name {String}
	@error {Error}
	return {Subscribe}
*/
Subscribe.prototype.return500 = function return500(name, error) {
	
	var self = this;	
	self.app.error(error, name, self.req.uri);

	if (self.isFlush())
		return self;	

	// hľadáme route #500
	self.lookup(null, '#500');
};

/*
	Internal function
	@code {Number}
	@contentBody {String}
	@contentType {String}
	@headers {Object} :: optional
	return {Subscribe}
*/
Subscribe.prototype.returnContent = function returnContent(code, contentBody, contentType, headers) {
	
	var self = this;
	if (self.isFlush())
		return self;

	self.app.returnContent(self.req, self.res, code, contentBody, contentType, true, headers);
	return self;
};

/*
	Internal function
	@fileName {String}
	@contentType {String}
	@downloadName {String}
	@headers {Object} :: optional
	return {Subscribe}
*/
Subscribe.prototype.returnFile = function returnFile(fileName, contentType, downloadName, headers) {

	var self = this;
	if (self.isFlush())
		return self;

	var fileName = utils.combine(self.app.options.directoryPublic, fileName);
	self.app.returnFile(self.req, self.res, fileName, downloadName, headers);
	return self;
};

/*
	Internal function
	@url {String}
	@permament {Boolean} :: optional
	return {Subscribe}
*/
Subscribe.prototype.returnRedirect = function returnRedirect(url, permament) {

	var self = this;
	if (self.isFlush())
		return self;

	self.res.isFlush = true;
	self.res.writeHead(permament ? 301 : 302, { 'Location': url });
	self.res.end();

	return self;
};

/*
	Internal function
	@subdomain {String array}
	@url {String}
	@flags {String array}
	@options {Object}
	return {Subscribe}
*/
Subscribe.prototype.lookup = function lookup(subdomain, url, flags, options) {

	var self = this;
	var sub = subdomain === null ? null : subdomain.join('.');
	var isSystem = url[0] === '#';

	self._myurl = internal.routeSplit(url);

	// search route handler
	var onRoute = function(obj) {

		if (!internal.routeCompareSubdomain(sub, obj.subdomain))
			return false;

		if (!internal.routeCompare(self._myurl, obj.url, isSystem))
			return false;

		if (obj.flags !== null && obj.flags.length > 0) {

			var result = internal.routeCompareFlags(flags, obj.flags);

			// if user not logged or unlogged, then 401 redirect
			if (result === -1)
				self.isAuthorized = false;

			if (result < 1)
				return false;
		}

		if (obj.onValidation !== null && !obj.onValidation(self.req, self.res, flags))
			return false;

		return true;
	};

	var callback = function(val, opt) {
		self.onLookup(val, opt);
	};

	self.app.routes.findAsync(onRoute, callback, options);
	return self;
};

/*
	Internal handler
	@obj {Controller}
	@options {Object}
	return {Subscribe}
*/
Subscribe.prototype.onLookup = function onLookup(obj, options) {

	var self = this;

	if (obj === null) {

		if (self.isError) {
			self.return404(true);
			return self;
		};

		self.isError = true;
		self.lookup(null, self.isAuthorized ? '#404' : '#403', []);
		return self;
	}
	
	// máme route, voláme controller
	// response si už riadiť odteraz controller

	var $controller = controller.init(obj.name, self, self.req, self.res, options);

	try
	{
		if (self.app.onController !== null)
			self.app.onController.call($controller, obj.name);
			
		var a = self.app.controllers[obj.name]
		
		if (typeof(a.onRequest) !== 'undefined')
			a.onRequest.call($controller);

	} catch (err) {
		self.app.error(err, 'Controller –> onRequest | onController –> ' + obj.name, self.req.uri);
	}

	try
	{
		obj.onExecute.apply($controller, internal.routeParam(self._myurl, obj));

	} catch (err) {
		self.app.error(err, 'Controller –> ' + obj.name, self.req.uri);
		self.lookup(null, '#500', []);
	}

	return self;
};

// ======================================================
// EXPORTS
// ======================================================

/*
	Internal function
	@framework {Framework}
	@req {ServerRequest}
	@res {ServerResponse}
	return {Subscribe}
*/
exports.init = function init(framework, req, res) {
	return new Subscribe(framework, req, res);
};