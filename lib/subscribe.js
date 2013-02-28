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
Subscribe.prototype.isFlush = function() {
	return this.res.isFlush || false;
};

/*
	Internal function
	@plain {Boolean}
	return {Subscribe}
*/
Subscribe.prototype.return404 = function(plain) {
	
	var self = this;

	if (self.isFlush())
		return self;	

	if (plain || this.isError) {
		self.app.returnContent(self.req, self.res, 404, '404', 'text/plain', true);
		return self;
	}

	self.lookup(null, '#404');
	return self;
};

/*
	Internal function
	return {Subscribe}
*/
Subscribe.prototype.return403 = function() {

	var self = this;
	
	if (self.isFlush())
		return self;

	self.lookup(null, '#403');
	return self;
};

/*
	Internal function
	@name {String}
	@error {Error}
	return {Subscribe}
*/
Subscribe.prototype.return500 = function(name, error) {
	
	var self = this;	
	self.app.error(error, name, self.req.uri);

	if (self.isFlush())
		return self;	

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
Subscribe.prototype.returnContent = function(code, contentBody, contentType, headers) {
	
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
Subscribe.prototype.returnFile = function(fileName, contentType, downloadName, headers) {

	var self = this;
	if (self.isFlush())
		return self;

	var fileName = utils.combine(self.app.config.directoryPublic, fileName);
	self.app.returnFile(self.req, self.res, fileName, downloadName, headers);
	return self;
};

/*
	Internal function
	@url {String}
	@permament {Boolean} :: optional
	return {Subscribe}
*/
Subscribe.prototype.returnRedirect = function(url, permament) {

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
Subscribe.prototype.lookup = function(subdomain, url, flags, options) {

	var self = this;
	var sub = subdomain === null ? null : subdomain.join('.');
	var isSystem = url[0] === '#';

	self._myurl = internal.routeSplit(url);

	var route = null;

	for (var i = 0; i < self.app.routes.length; i++) {
		var item = self.app.routes[i];

		if (!internal.routeCompareSubdomain(sub, item.subdomain))
			continue;

		if (!internal.routeCompare(self._myurl, item.url, isSystem))
			continue;

		if (item.flags !== null && item.flags.length > 0) {

			var result = internal.routeCompareFlags(flags, item.flags);

			// if user not logged or unlogged, then 401 redirect
			if (result === -1)
				self.isAuthorized = false;

			if (result < 1)
				continue;
		}

		if (item.onValidation !== null && !item.onValidation(self.req, self.res, flags))
			continue;

		route = item;
		break;		
	}

	self.onLookup(route, options);
	return self;
};

/*
	Internal handler
	@obj {Controller}
	@options {Object}
	return {Subscribe}
*/
Subscribe.prototype.onLookup = function(obj, options) {

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

	var name = obj.name;
	var $controller = controller.init(name, self, self.req, self.res, options);

	try
	{	
		self.app.emit('controller', $controller, name);

		var isModule = name[0] === '#' && name[1] === 'm';
		var o = isModule ? self.app.modules[name.substring(8)] : self.app.controllers[name];

		if (typeof(o.onRequest) !== 'undefined')
			o.onRequest.call($controller);

	} catch (err) {
		self.app.error(err, name, self.req.uri);
	}

	try
	{
		
		if (!$controller.internal.cancel)
			obj.onExecute.apply($controller, internal.routeParam(self._myurl, obj));

	} catch (err) {
		self.app.error(err, name, self.req.uri);
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
exports.init = function(framework, req, res) {
	return new Subscribe(framework, req, res);
};