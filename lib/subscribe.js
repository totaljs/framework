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

var controller = require('./controller'),
	internal = require('./internal'),
	utils = require('./utils');

function Subscribe(framework, req, res) {
	this.req = req;
	this.res = res;
	this.app = framework;
	this.version = '1.1.1';
	this.isError = false;
	this.isAuthorized = true;
	this._myurl = null;	
};

// ======================================================
// PROTOTYPES
// ======================================================

Subscribe.prototype.isFlush = function() {
	return this.res.isFlush || false;
};

Subscribe.prototype.return404 = function(plain) {
	
	var self = this;

	if (self.isFlush())
		return;	

	if (plain || this.isError) {
			self.app.returnContent(self.req, self.res, 404, '404', 'text/plain', true);
			return;
		}

		// hľadáme route #404
		self.lookup(null, '#404');
};

Subscribe.prototype.return403 = function() {

	var self = this;
	
	if (self.isFlush())
		return;	

	// hľadáme route #403
	self.lookup(null, '#403');
};

Subscribe.prototype.return500 = function(name, error) {
	
	var self = this;	
	self.app.onError(error, name, self.req.uri);

	if (self.isFlush())
		return;	

	if (plain || this.isError) {
		self.app.returnContent(self.req, self.res, 500, '500', 'text/plain', true);
		return;
	}

	// hľadáme route #500
	self.lookup(null, '#500');
};

Subscribe.prototype.returnContent = function(code, contentBody, contentType, headers) {
	
	var self = this;
	if (self.isFlush())
		return;

	self.app.returnContent(self.req, self.res, code, contentBody, contentType, true, headers);
};

Subscribe.prototype.returnFile = function(fileName, contentType, downloadName, headers) {

	var self = this;
	if (self.isFlush())
		return;

	var fileName = utils.combine(self.options.directoryPublic, fileName);
	self.app.returnFile(self.req, self.res, fileName, downloadName, headers);
};

Subscribe.prototype.returnRedirect = function(url, permament) {

	var self = this;
	if (self.isFlush())
		return;

	self.res.isFlush = true;
	self.res.writeHead(permament ? 301 : 302, { 'Location': url });
	self.res.end();
};

// vyhľadanie controllera
Subscribe.prototype.lookup = function(subdomain, url, flags, options) {

	var self = this;
	var sub = subdomain === null ? null : subdomain.join('.');

	self._myurl = internal.routeSplit(url);

	// search route handler
	var onRoute = function(obj) {

		if (!internal.routeCompareSubdomain(sub, obj.subdomain))
			return false;

		if (!internal.routeCompare(self._myurl, obj.url))
			return false;

		if (obj.flags != null && obj.flags.length > 0) {

			var result = internal.routeCompareFlags(flags, obj.flags);

			// if user not logged or unlogged, then 401 redirect
			if (result === -1)
				self.isAuthorized = false;

			if (result < 1)
				return false;
		}

		if (obj.onValidation != null && !obj.onValidation(self.req, self.res, flags))
			return false;

		return true;
	};

	var callback = function(val, opt) {
		self.onLookup(val, opt);
	};

	self.app.routes.findAsync(onRoute, callback, options);
};

Subscribe.prototype.onLookup = function(obj, options) {

	var self = this;

	if (obj === null) {

		if (self.isError) {
			self.return404(true);
			return;
		};

		self.isError = true;
		self.lookup(null, self.isAuthorized ? '#404' : '#403', []);
		return;
	}
	
	// máme route, voláme controller
	// response si už riadiť odteraz controller

	var $controller = controller.init(obj.name, self, self.req, self.res, options);

	try
	{
		if (self.app.onController != null)
			self.app.onController.call($controller, obj.name);
			
		var a = self.app.controllers[obj.name]
		
		if (typeof(a.onRequest) != 'undefined')
			a.onRequest.call($controller);

	} catch (err) {
		self.app.onError(err, 'Controller –> onRequest | onController –> ' + obj.name, self.req.uri);
	}

	try
	{
		obj.onExecute.apply($controller, internal.routeParam(self._myurl, obj));

	} catch (err) {
		self.app.onError(err, 'Controller –> ' + obj.name, self.req.uri);
		self.lookup(null, '#500', []);
	}
};

// ======================================================
// EXPORTS
// ======================================================

exports.init = function(framework, req, res) {
	return new Subscribe(framework, req, res);
};