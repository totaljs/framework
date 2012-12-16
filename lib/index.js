var javascript = require('./javascript');
var less = require('./less');
var qs = require('querystring');
var fs = require('fs');
var zlib = require('zlib');
var path = require('path');
var crypto = require('crypto');
var urlParser = require('url');
var utils = require('./utils');
var templater = require('./template');
var events = require('events');
var internal = require('./internal');
var caching = require('./cache');

require('./prototypes');

function Framework() {
	
	this.version = '1.0.1';
	this.routing = [];

	this.config = {
		debug: false,
		name: 'partial.js',
		ETagVersion: '',

		directoryViews: '/views/',
		directoryCache: '/cache/',
		directoryTMP: '/tmp/',
		directoryTemplates: '/templates/',
		directoryResources: '/resources/',
		directoryPublic: '/public/',

		// všetky static sú smerované do directoryPublic
		staticUrl: '',
		staticUrlJS: '/data/',
		staticUrlCSS: '/data/',
		staticUrlImage: '/img/',
		staticUrlVideo: '/video/',
		staticUrlFont: '/data/',
		staticUrlDocument: '/upload/',

		// nastavenie užívateľa
		user: {},

		// defaultný layout
		defaultLayout: '_layout',

		// defaultná maximálna veľkosť requestu
		defaultMaxRequestLength: 1024 * 5 // 5 kB
	};

	// namapovanie URL adresy na funkciu
	// túto funkciu volá každý Controller
	this.route = function(url, funExecute, flags, funcValidation, maximumSize) {

		if (typeof(funcValidation) === 'number') {
			maximumSize = funcValidation;
			funcValidation = null;
		}

		var routeURL = internal.routeSplit(url);
		var arr = [];
		
		if (url.indexOf('{') != -1) {
			routeURL.forEach(function(o, i) {
				if (o.substring(0, 1) === '{')
					arr.push(i);
			});
		}

		self.routing.push({ url: routeURL, param: arr, flags: flags || [], onExecute: funExecute, onValidation: funcValidation || null, maximumSize: maximumSize || self.config.defaultMaxRequestLength });
		self.routing.sort(function(a, b) {
			if (a.flags.length > 0 || b.flags.length > 0) {
				if (a.flags.length > b.flags.length)
					return -1;
				else
					return 1;
			} else {
				if (a.url.length > b.url.length)
					return 1;
				else
					return -1;
			}
		});
	};

	// načítanie hodnoty z Resources
	// return string
	this.resource = function(file, name, defaultValue) {		

		var resource = self.cacheRead('resources.' + file, function(key) {
			var fileName = '.' + path.join(self.config.directoryResources, file + '.json');

			if (!fs.existsSync(fileName))
				return defaultValue;

			// možno klesne výkon aplikácie kvôli použitu globálnej cache
			resource = JSON.parse(fs.readFileSync(fileName).toString());
			return self.cacheWrite(key, resource, new Date().add('y', 1));
		});

		return resource[name] || defaultValue;
	};

	// užívateľské nastavenie - zápis
	this.set = function (name, value) {
		self.config.user[name] = value;
		return this;
	};

	// užívateľské nastavenie - čítanie
	this.get = function (name) {
		var value = self.config.user[name];
		return typeof(value) === 'undefined' ? null : value;
	};

	// vyvolanie erroru
	this.error = function(req, res, code, name, e) {
		console.log('error -->', req.url, code, name, e);
		if (code == 500)
			self.routeLookup(req, res, "#500").onExecute.apply(new Controller(self, req, res, []));
	};

	// funkcia na zápis do Cache
	this.cacheWrite = function(name, value, expire) {
		return cache.write(name, value, expire);
	};

	// funkcia na čítanie z Cache
	this.cacheRead = function(name, onEmpty) {
		var value = cache.read(name);
		return value == null ? onEmpty(name) : value;
	};

		// funkcia na zápis do Cache súboru
	this.cacheWriteToFile = function(name, value) {
		return cache.fileWrite('.' + path.join(self.config.directoryTMP, name + '.cache'), value);
	};

	// funkcia na čítanie z Cache súboru
	this.cacheReadFromFile = function(name, expireMinute, onEmpty) {
		return cache.fileRead('.' + path.join(self.config.directoryTMP, name + '.cache'), expireMinute, onEmpty);
	};

	// vyčistenie dočasného adresára TMP
	this.clear = function() {
		fs.readdir('.' + self.config.directoryTMP, function(err, files) {
			if (typeof(files) != 'undefined') {
	    		files.forEach(function(file) {
	    			fs.unlink('.' + path.join(self.config.directoryTMP, file));
		    	});
	    	}
		});
		return this;
	};	

	// !!! Response vrátenie súboru
	this.returnFile = function(res, fileName, contentType, downloadName) {
		if (res.isFlush)
			return false;

		fileName = '.' + path.join(self.config.directoryPublic, filename);

		if (!fs.existsSync(pathFile))
			return true;

		var data = fs.readFileSync(fileName);
		var headers = { 'Content-Type': contentType, 'Content-Length': data.length };

		if (downloadName)
			headers['Content-Disposition'] = 'attachment; filename=' + downloadName;

		res.writeHead(200, headers);
		res.end(data);
		res.isFlush = true;

		return false;
	};

	// !!! Response presmerovanie
	this.returnRedirect = function(res, url, permament) {
		if (res.isFlush)
			return;
		
		res.writeHead(permament ? 301 : 302, { 'Location': url });
		res.end();
	};

	// !!! Response vrátenie vlastného contentu
	this.returnContent = function(req, res, code, contentBody, contentType, compress) {

		if (res.isFlush)
			return;

		var accept = req.headers['accept-encoding'] || '';

		if (compress && accept.indexOf('gzip') != -1) {
			zlib.gzip(new Buffer(contentBody), function gzip(err, data) {
				
				if (err) {
					self.error(req, res, 500, 'return Content(gzip compress)', err);
					return;
				}

				res.isFlush = true;
				res.writeHead(code, { 'Content-Type': contentType, 'Content-Encoding': 'gzip', 'Content-Length': data.length });
				res.end(data, 'utf8');
			});
			return;
		}
		
		if (compress && accept.indexOf('deflate') != -1) {
			zlib.gzip(new Buffer(contentBody), function deflate(err, data) {
				
				if (err) {
					self.error(req, res, 500, 'return Content(deflate compress)', err);
					return;
				}

				res.isFlush = true;
				res.writeHead(code, { 'Content-Type':  contentType, 'Content-Encoding': 'deflate', 'Content-Length': data.length });
				res.end(data, 'utf8');
			});
			return;
		}

		res.isFlush = true;
		res.writeHead(code, { 'Content-Type': contentType, 'Content-Length': contentBody.length });
		res.end(contentBody, 'utf8');
	};

	// inicializačná trieda
	// vracia HTTP objekt
	this.init = function(http, cacheInit) {
		
		// vymažeme TMP adresár
		self.clear();
		cache.init();

		// core
	    return http.createServer(function (req, res) {

			res.setHeader('Platform', 'node.js ' + process.version);
		    res.setHeader('Framework', 'partial.js v' + self.version);

		    if (self.config.debug)
		    	res.setHeader('Mode', 'debug');

			res.isFlush = false;

	       	// if static file, end
	       	if (utils.isStaticFile(req.url)) {

		        req.on('end', function () {
					self.onStatic(req, res);
	    	   	});

	    	   	return;
			}

			var header = req.headers;
			var protocol = req.connection.encrypted ? 'https' : 'http';
			var flags = [req.method.toLowerCase()];
		    var multipart = req.headers['content-type'] || '';

		    if (multipart.indexOf('multipart/form-data') === -1)
		    	multipart = '';

	       	req.host = header["host"];     	
	       	req.uri = urlParser.parse(protocol + '://' + req.host + req.url);

			flags.push(protocol);

			if (self.config.debug)
				flags.push('debug');

			req.formGET = {};
			req.formPOST = {};
			req.formFiles = [];
			req.buffer = {};
			req.isAjax = header['x-requested-with'] === 'XMLHttpRequest';

			// získanie hodnoty PUT, DELETE
			var methodOverrire = header["x-http-method-override"] || '';

			if (methodOverrire.length > 0)
				header.push(methodOverrire);

	       	if (req.uri.query)
	       		req.formGET = qs.parse(req.uri.query);

			if (multipart.length > 0)
				req.flags.push('upload');

			if (req.isAjax)
				flags.push('ajax');
		
	    	flags.push(self.onAuthorize(req, res) ? 'logged' : 'unlogged');
	    	req.flags = flags;

	    	// call event request
	    	self.emit('request', req, res);

	    	// vyhľadanie routingu
	    	var route = self.routeLookup(req, res, req.uri.pathname, flags, false);

	    	if (route == null) {
				res.isFlush = true;
				req.connection.destroy();
	    		return;
	    	}

		   	if (req.method === 'POST') {
	       		if (multipart.length > 0) {

	       			// kontrola či Controller obsahuje flag Upload
	       			if (route.flags.indexOf('upload') != -1) {

	       				// ukladáme Request do jedného súboru, ktorý budeme potom parsovať
	       				internal.saveFiles(req, multipart, route.maximumSize, self.config.directoryTMP);
	       				
		        		req.on('end', function () {
		        			
		        			// parsujeme poslané súbory zo súboru
		        			internal.parseFiles(req, function() {
		        				
		        				try
	        					{
		        					route.onExecute.apply(new Controller(self, req, res, flags), internal.routeParam(internal.routeSplit(req.url), route));
	        					} catch (e) {
		        					self.error(req, res, 500, req.url + '#' + route.flags.join(','), e);
	        					}

	        					// vymažeme dočasné súbory
	        					internal.clearUpload(req);        				
		        			});
						});

						return;
		        	}

	        		req.connection.destroy();
	        		return;

	       		} else {

	       			// kontrola či niekto neposiela zbytočné data
	       			if (route.flags.indexOf('post') === -1 && route.flags.indexOf('json') === -1) {
	       				req.connection.destroy();
	       				return;
	       			}

	       			// parsujeme parametre z POST
       				internal.parsePOST(req, route.maximumSize);
	       		}

	       	};

	        req.on('end', function () {
			
	        	if (typeof(req.buffer.data) != 'undefined' && !req.buffer.isExceeded && req.buffer.data.length > 0) {

	        		var data = req.buffer.data;
	        		if (route.flags.indexOf('json') === -1)
	        			req.formPOST = qs.parse(data);
	        		else {
	        			try
	        			{
	        				req.formPOST = JSON.parse(data);
	        			} catch (e) {
	        				// chybné JSON data
	        			};
	        		}
	        	}

	        	try
	        	{
	        		route.onExecute.apply(new Controller(self, req, res, flags), internal.routeParam(internal.routeSplit(req.url), route));
	        	} catch (e) {
	        		self.error(req, res, 500, req.url + '#' + route.flags.join(','), e);
	        	} 
			});
		});
	};

	// ==============================
	// delegáti na spracovanie údajov
	// ==============================
	
	// vlastná autorizácia užívateľa
	// return true | false;
	this.onAuthorize = function(req) {
		return false;
	};

	// verziovanie statických súborov
	// return new fileName
	this.onVersion = function(name) {
		return name;
	};

	// spracovanie chyby
	this.onError = function(req, code, name, err) {
		console.log("error", code, name, err);
	};

	// spracovanie statického súboru
	// slúži ako handler pre dynamické generovanie statického súboru
	this.onStatic = function(req, res) {
		self.onStaticDefault(req, res);
	};

	// spracovanie statického súboru
	this.onStaticDefault = function (req, res) {
		
		if (res.isFlush)
			return;

		var fileName = '.' + path.join(self.config.directoryPublic, req.url);	
		var etag = self.ETagVersion(utils.ETagCreateFromFile(fileName));
		

		if (!self.config.debug) {
			if (utils.ETagValid(req, etag))
			{
				res.writeHead(304);
				res.end();
				return;
			}
		}

		if (!fs.existsSync(fileName)) {
			self.routeLookup(req, res, "#404", []).onExecute.apply(new Controller(self, req, res, []));
			return;
		}
		
		var ext = path.extname(fileName).substring(1).toLowerCase();		
		var fileCompile = "";
		var data = null;
		

		if (ext === "js" || ext === "css") {
			fileCompile = '.' + self.config.directoryTMP + fileName.replace(/\//g, "-").substring(1) + "compile";
			if (fs.existsSync(fileCompile))
				data = fs.readFileSync(fileCompile);
		}

		if (data == null) {
			data = fs.readFileSync(fileName);
			if (ext === "js") {
				data = javascript.compile(data.toString());
				fs.writeFileSync(fileCompile, data);
			}

			if (ext === "css") {
				data = less.compile(data.toString(), !self.config.debug);
				fs.writeFileSync(fileCompile, data);
			}
		}

		var headers = { 'Content-Type': utils.getContentType(ext), 'Content-Length': data.length };

		if (!self.config.debug)
			headers['Etag'] = etag;

		res.isFlush = true;
		res.writeHead(200, headers);
		res.end(data);
	};

	this.routeLookup = function(req, res, url, flags, isError) {
		var isAuthorized = false;
		var url = internal.routeSplit(url);
		var routes = self.routing;

		for (var i = 0; i < routes.length; i++) {
			var obj = routes[i];

			if (!internal.routeCompare(url, obj.url))
				continue;

			if (obj.flags != null && obj.flags.length > 0) {

				var result = internal.routeCompareFlags(flags, obj.flags);		

				// if user not logged or unlogged, then 401 redirect
				if (result === -1)
					isAuthorized = true;

				if (result < 1)
					continue;
			}
			
			if (obj.onValidation != null && !obj.onValidation(req, res, flags))
				continue;

			return obj;
		}
		
		if (isError)
			return null;

		return self.routeLookup(req, res, isAuthorized ? "#401" : "#404", [], true);
	};
	
	this.ETagVersion = function(etag) {
		var etagVersion = self.config.ETagVersion;
		return etag + (etagVersion.length > 0 ? '-' + etag : '');
	};

	var self = this;
	var cache = caching.init(self);
};

// Definícia Controllera
function Controller(app, req, res, flags) {
	this.app = app;
	this.req = req;
	this.res = res;
	this.flags = flags;
	this.status = 200;
	this.isFlush = false;
	this.repository = {};
	this.layout = app.config.defaultLayout;

	// vrátenie aktuálnej verzie statického súboru
	this.version = function(name) {
		return this.app.onVersion(name);
	};

	this.resource = function(file, name, defaultValue, raw) {
		var value = this.app.resource(file, name, defaultValue);
		return raw ? value : utils.htmlEncode(value);
	};

	// renderovanie viewu do viewu
	this.partial = function(name, model) {
		return render(this, name, model);
	};

	// renderovanie templateu / gridu
	this.template = function(name, model, nameEmpty) {
		return template(name, model, nameEmpty);
	}

	// mapovanie statických súborov
	// prepojené s nastavením aplikácie

	this.routeCSS = function(name) {
		return utils.isRelative(name) ? config.staticUrlCSS + this.version(name) : name;
	};

	this.routeJS = function(name) {
		return utils.isRelative(name) ? config.staticUrlJS + this.version(name) : name;
	};

	this.routeDocument = function(name) {
		return utils.isRelative(name) ? config.staticUrlDocument + this.version(name) : name;
	};

	this.routeImage = function(name) {
		return utils.isRelative(name) ? config.staticUrlImage + this.version(name) : name;
	};

	this.routeVideo = function(name) {
		return utils.isRelative(name) ? config.staticUrlVideo + this.version(name) : name;
	};

	this.routeFont = function(name) {
		return utils.isRelative(name) ? config.staticUrlFont + this.version(name) : name;
	};

	this.routeStatic = function(name) {
		return utils.isRelative(name) ? config.staticUrl + this.version(name) : name;
	};

	// čítanie hodnôt z requestu alebo z repository

	this.readGET = function(name, raw) {
		var value = this.req.formGet[name] || '';
		return raw ? value : utils.htmlEncode(value);
	};

	this.readPOST = function(name, raw) {
		var value = this.req.formPOST[name] || '';
		return raw ? value : utils.htmlEncode(value);
	};

	this.readModel = function(model, name, raw) {
		var value = model[name] || '';
		return raw ? value : utils.htmlEncode(value);
	};

	this.readRepository = function(name, raw) {
		var value = this.repository[name] || '';
		return raw ? value : utils.htmlEncode(value);
	};	

	this.json = function(obj) {
		self.app.returnContent(JSON.stringify(obj), "application/json", true);
	};

	this.cacheWrite = function(name, value, expire) {
		return app.cacheWrite(name, value, expire);
	};

	this.cacheRead = function(name, onEmpty) {
		return app.cacheRead(name, onEmpty);
	};

	this.cacheWriteToFile = function(name, value) {
		return app.cacheWriteToFile(name, value);
	};

	this.cacheReadFromFile = function(name, expire, onEmpty) {
		return app.cacheReadFromFile(name, onEmpty);
	};

	this.redirect = function(url, permament) {
		self.app.redirect(self.res, url, permament);
	};

	this.file = function(path, contentType, downloadName) {		
		self.app.returnFile(self.res, path, contentType || 'application/octet-stream', downloadName);
	};

	this.content = function(data, contentType) {
		self.app.returnContent(self.req, self.res, self.status, data, contentType || "text/plain", true);
	};		

	this.view = function(name, model) {
		try
		{
			var data = render(self, name, model);
			
			if (self.layout.length > 0)
				data = render(self, self.layout, data);

			self.content(data, 'text/html', true);

		} catch (e) {
			self.app.error(self.req, self.res, 500, 'Controller.view({0})'.format(name), e);
		}
	};

	// render template
	function template(name, model, nameIfEmpty) {
		var value = '';

		var reg = new RegExp(/[\{\}\<\>]/gi);

		if (reg.test(name))
			value = name;
		else {

			var fileName = '.' + path.join(config.directoryTemplates, name + '.html');
			if (fs.existsSync(fileName))
				value = fs.readFileSync(fileName).toString();
		}

		var empty = '';

		if (typeof(nameIfEmpty) != 'undefined') {	

			if (reg.text(nameIfEmpty))
				empty = nameIfEmpty;
			else {
				var fileNameEmpty = '.' + path.join(config.directoryTemplates, nameIfEmpty + '.html');
				if (fs.existsSync(fileNameEmpty))
					empty = fs.readFileSync(fileNameEmpty).toString();
			}
		}

		return templater.renderTemplate(value, model, empty);
	};

	// render view
	function render(parent, name, model) {			
		
		var key = 'view_' + name + '.html';

		var obj = self.app.cacheRead(key, function(key) {
			return self.app.cacheWrite(key, templater.renderView('.' + path.join(config.directoryViews, name + '.html')), new Date().add("h", 1));
		});

		var html = obj.html;
		obj.generator.forEach(function (d, index) {

			var result = (function () {
				return eval(d);
			}).call(parent);
			
			if (typeof(result) === 'undefined' || result == null)
				result = '';

			var id = '@###' + index;
			html = html.replace(id, result);
		});

		return html;
	};

	var config = app.config;
	var self = this;
};

Framework.prototype = new events.EventEmitter;
module.exports = new Framework();