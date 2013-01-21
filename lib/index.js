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

var javascript = require('./javascript'),
	less = require('./less'),
	qs = require('querystring'),
	os = require('os'),
	fs = require('fs'),
	zlib = require('zlib'),
	path = require('path'),
	urlParser = require('url'),
	utils = require('./utils'),
	util = require('util'),
	events = require('events'),
	internal = require('./internal'),
	controller = require('./controller'),
	subscribe = require('./subscribe'),
	encoding = 'utf8',
	directory = process.cwd(),
	_controller = '';

require('./prototypes');

// 1. Framework
// 2. Subscribe
// 3. Controller
// 4. res.end();

function Framework() {
	this.version = 1152;
	this.options = {
		debug: false,
		
		name: 'partial.js',
		secret: os.hostname() + '-' + os.platform() + '-' + os.arch(),

		ETagVersion: '',

		directoryControllers: '/controllers/',
		directoryViews: '/views/',
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

		staticAccept: ['.jpg', '.png', '.gif', '.ico', '.js', '.css', '.txt', '.xml', '.woff', '.ttf', '.eot', '.svg', '.zip', '.rar', '.pdf', '.docx', '.xlsx', '.doc', '.xls', '.html', '.htm'],

		// nastavenie užívateľa
		user: {},
		resources: {},

		// defaultný layout
		defaultLayout: '_layout',

		httpCompress: false,
		httpCache: false,

		// defaultná maximálna veľkosť requestu
		defaultMaxRequestLength: 1024 * 5 // 5 kB
	};

	// routing in controllers
	this.routes = [];
	this.controllers = {};

	// initializácia cache
	this.cache = require('./cache').init(this);
	this.cache.init();

	this.cache.on('service', function(runner) {

		if (self.options.debug) {
			
			// každú minútu čistíme cache resources
			self.options.resources = {};

		} else {

			// každých 30 minút čístíme cache resources
			if (runner % 30 === 0)
				self.options.resources = {};
		}

		self.emit('service', runner);
	});

	var self = this;
};

// ======================================================
// PROTOTYPES
// ======================================================

Framework.prototype = new events.EventEmitter;

Framework.prototype.controller = function(name) {

	var self = this;

	// získanie názvu controllera
	_controller = name;

	// inicializovanie controllera
	var obj = require(path.join(directory, self.options.directoryControllers, name + '.js'));
	
	self.controllers[name] = obj;
	obj.init.call(self);

	// triedenie routov
	self.routes.sort(function(a, b) {

		if (a.subdomain === null || b.subdomain === null)
			return 1;
		
		if (a.subdomain.length > b.subdomain.length)
			return -1;

		if (a.flags.length > b.flags.length)
			return -1;

		if (a.url.length > b.url.length)
			return -1

		return 1;
	});

	return self;
};

// namapovanie URL adresy na funkciu v Controlleri
// túto funkciu volá každý Controller
Framework.prototype.route = function(url, funExecute, flags, maximumSize, funcValidation) {

	var self = this;

	if (typeof(funcValidation) === 'number') {
		maximumSize = funcValidation;
		funcValidation = null;
	}

	var index = url.indexOf(']');
	var subdomain = null;
	
	if (index > 0) {
		subdomain = url.substring(1, index).trim().toLowerCase().split(',');
		url = url.substring(index + 1);
	}

	var routeURL = internal.routeSplit(url.trim());
	var arr = [];
	
	if (url.indexOf('{') != -1) {
		routeURL.forEach(function(o, i) {
			if (o.substring(0, 1) === '{')
				arr.push(i);
		});
	}

	self.routes.push({ subdomain: subdomain, name: _controller, url: routeURL, param: arr, flags: flags || [], onExecute: funExecute, onValidation: funcValidation || null, maximumSize: maximumSize || self.options.defaultMaxRequestLength });
};

Framework.prototype.onError = function(err, name, uri, code) {
	console.log('!ERROR!');
	console.log(name);
	console.log(err);
	console.log(uri.href);
	console.log('================================================');
};

Framework.prototype.onAuthorize = null;
Framework.prototype.onPrefix = null;
Framework.prototype.onVersion = null;
Framework.prototype.onRoute = null;
Framework.prototype.onController = null;


Framework.prototype.onStatic = function(req, res) {
	this.returnStatic(req, res);
};

Framework.prototype.returnStatic = function(req, res) {
	var self = this;

	if (res.isFlush)
		return;

	var fileName = utils.combine(self.options.directoryPublic, req.url);
	var extension = path.extname(fileName).toLowerCase();

	if (self.options.staticAccept.indexOf(extension) === -1) {
		self.return404(req, res);
		return;
	};
	
	// javascript compressor & css LESS compiler
	if (extension === '.js' || extension === '.css') {
		
		var fileComiled = utils.combine(self.options.directoryTMP, req.url.replace(/\//g, '-').substring(1));		
		if (self.options.debug || !fs.existsSync(fileComiled)) {
			
			if (!fs.existsSync(fileName)) {
				self.return404(req, res);
				return;
			}

			var data = fs.readFileSync(fileName).toString('utf8');

			if (extension === '.js')
				data = javascript.compile(data);

			if (extension === '.css') {
				data = less.compile(data, !self.options.debug);
				if (self.onVersion != null) {
					var matches = data.match(/url\(.*?\)/g);
					if (matches != null) {
						matches.forEach(function(o) {
							var url = o.substring(4, o.length - 1);
							data = data.replace(o, 'url('+ self.onVersion(url) +')');
						});
					}
				}
			}

			fs.writeFileSync(fileComiled, data);
		}

		fileName = fileComiled;
	};

	self.returnFile(req, res, fileName, '');
};

Framework.prototype.return404 = function(req, res) {
	if (res.isFlush)
		return;

	res.isFlush = true;
	res.writeHead(404, { 'Content-Type': 'text/plain' });
	res.end('File not found (404).');
};

Framework.prototype.returnFile = function(req, res, fileName, downloadName, headers) {

	var self = this;

	if (res.isFlush)
		return;

	if (!fs.existsSync(fileName)) {
		self.return404(req, res);
		return;
	}

	var etag = self.options.httpCache ? utils.ETagCreateFromFile(fileName) : '';
	
	if (!self.options.debug) {
		if (utils.ETagCompare(req, etag)) {
			res.isFlush = true;
			res.writeHead(304);
			res.end();
			return;
		}
	}

	var extension = path.extname(fileName);
	var compress = self.options.httpCompress && ['js', 'css', 'txt', 'xml', 'html', 'htm', 'rtf'].indexOf(extension.substring(1)) != -1;
	var accept = req.headers['accept-encoding'] || '';
	var returnHeaders = {};

	// možnosť odoslať vlastné hlavičky
	if (headers)
		util._extend(returnHeaders, headers);

	downloadName = downloadName || '';

	if (downloadName.length > 0)
		returnHeaders['Content-Disposition'] = 'attachment; filename=' + downloadName;

	if (etag.length > 0)
		returnHeaders['Etag'] = etag;

	returnHeaders['Content-Type'] = utils.getContentType(extension.substring(1));

	if (compress) {

		if (accept.indexOf('gzip') != -1) {
			returnHeaders['Content-Encoding'] = 'gzip';
			res.isFlush = true;
			res.writeHead(200, returnHeaders);
			fs.createReadStream(fileName).pipe(zlib.createGzip()).pipe(res);
			return;
		}

		// problém pri IE, deflate nefunguje
		if (accept.indexOf('deflate') != -1) {
			returnHeaders['Content-Encoding'] = 'deflate';
			res.isFlush = true;
			res.writeHead(200, returnHeaders);
			fs.createReadStream(fileName).pipe(zlib.createDeflate()).pipe(res);
			return;
		}			
	}

	res.isFlush = true;
	res.writeHead(200, returnHeaders);
	fs.createReadStream(fileName).pipe(res);
};

Framework.prototype.returnContent = function(req, res, code, contentBody, contentType, compress, headers) {
	var self = this;

	if (res.isFlush)
		return;

	res.isFlush = true;
	
	if (req.buffer && req.buffer.isUpload) {
		try
		{
			// vymazanie dočasných súborov
			internal.uploadClear(req);
		} catch (err) {
			self.onError(err, 'uploadClear', req.uri);
		}
	}

	var accept = req.headers['accept-encoding'] || '';
	var returnHeaders = {};

	// možnosť odoslať vlastné hlavičky
	if (headers)
		util._extend(returnHeaders, headers);

	// pridáme UTF-8 do hlavičky
	if ((/text|application/).test(contentType))
		contentType += '; charset=utf-8';

	if (!self.options.httpCompress)
		compress = false;

	if (compress) {

		if (accept.indexOf('gzip') != -1) {
			zlib.gzip(new Buffer(contentBody), function gzip(err, data) {
				
				if (err) {
					req.connection.destroy();
					return;
				}

				returnHeaders['Content-Type'] = contentType;
				returnHeaders['Content-Encoding'] = 'gzip';

				res.writeHead(code, returnHeaders);
				res.end(data, encoding);
			});
			return;
		}

		// problém pri IE, deflate nefunguje
		if (accept.indexOf('deflate') != -1) {
			zlib.deflate(new Buffer(contentBody), function deflate(err, data) {
				
				if (err) {
					req.connection.destroy();
					return;
				}

				returnHeaders['Content-Type'] = contentType;
				returnHeaders['Content-Encoding'] = 'deflate';

				res.writeHead(code, returnHeaders);
				res.end(data, encoding);
			});
			return;
		}
	}

	returnHeaders['Content-Type'] = contentType;

	res.writeHead(code, returnHeaders);
	res.end(contentBody, encoding);
};

Framework.prototype.init = function(http, options, optionsUser) {

	var self = this;

	util._extend(self.options, options);

	self.clear();

	self.options.user = optionsUser || {};

	if (typeof(self.options.user.name) === 'undefined')
		self.options.user.name = self.options.name;

    return http.createServer(function (req, res) {

		res.setHeader('Platform', 'node.js ' + process.version);
	    res.setHeader('Framework', 'partial.js v' + self.version);

	    if (self.options.debug)
	    	res.setHeader('Mode', 'debug');

		res.isFlush = false;
		req.data = { get: {}, post: {}, files: [] };
		req.buffer = {};
		req.isAjax = false;
		req.uri = {};
		req.ip = '';
		req.flags = [];
		req.session = {};
		req.prefix = '';
		req.subdomain = [];

		res.isFlush = false;

		var header = req.headers;
		var protocol = req.connection.encrypted ? 'https' : 'http';

       	req.host = header["host"];
       	req.uri = urlParser.parse(protocol + '://' + req.host + req.url);

		var subdomain = req.uri.host.toLowerCase().split('.');
		
		if (subdomain.length > 2)
			req.subdomain = subdomain.slice(0, subdomain.length - 2); // príklad: [subdomain].domain.sk

       	// if static file, end
       	if (utils.isStaticFile(req.url)) {

	        req.on('end', function () {
				self.onStatic(req, res);
    	   	});

    	   	return;
		}

		if (self.onRoute != null) {
			try
			{
				
				if (!self.onRoute(req, res))
					return;

			} catch(err) {
				self.app.onError(err, 'Controller –> onRoute', req.uri);
			}
		}

		var flags = [req.method.toLowerCase()];
	    var multipart = req.headers['content-type'] || '';

	    if (multipart.indexOf('multipart/form-data') === -1)
	    	multipart = '';

		flags.push(protocol);

		if (self.options.debug)
			flags.push('debug');

		req.isAjax = header['x-requested-with'] === 'XMLHttpRequest';
		req.prefix = self.onPrefix === null ? '' : self.onPrefix(req) || '';

		if (req.prefix.length > 0)
			flags.push('#' + req.prefix);

		req.ip = header['X-Real-IP'] || header['X-Forwarded-For'] || req.connection.remoteAddress;

       	if (req.uri.query)
       		req.data.get = qs.parse(req.uri.query);

		if (multipart.length > 0)
			flags.push('upload');

		if (req.isAjax)
			flags.push('ajax');

    	req.flags = flags;

    	// call event request
    	self.emit('request', req, res);

	   	if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {

	   		var route;

       		if (multipart.length > 0) {

       			// kontrola či Controller obsahuje flag Upload
				route = self.routeSync(req.subdomain, req.uri.pathname, req.flags, true);
       			if (route != null) {

       				// once je lepšie, ale náročnejšie, pretože ho musí niečo odobrať z poolu
	        		req.on('end', function () {
	        			// parsujeme poslané súbory zo súboru
	        			internal.uploadParse(req, function() {

	        				// voláme automatický routing
	        				self.request(req, res, req.flags);
	        			});
					});

       				// ukladáme Request do jedného súboru, ktorý budeme potom parsovať
       				internal.uploadWrite(req, multipart, route.maximumSize, self.options.directoryTMP);       			
					return;
	        	}
				
        		req.connection.destroy();
        		return;

       		} else {

       			route = self.routeSync(req.subdomain, req.uri.pathname, req.flags, true);

       			if (route === null) {
        			req.connection.destroy();
					return;
       			}

       			// parsujeme parametre z POST
   				internal.parsePOST(req, route.maximumSize);
       		}
       	};

       	// spracujeme request
        req.on('end', function() {

        	if (typeof(req.buffer.data) != 'undefined' && req.buffer.data.length > 0) {

        		//&& !req.buffer.isExceeded 

        		var data = req.buffer.data;
        		if (route.flags.indexOf('json') === -1)
        			req.data.post = qs.parse(data);
        		else {
        			try
        			{
        				req.data.post = JSON.parse(data);
        			} catch (err) {
        				self.onError(err, '', req.uri);
        			};
        		}
        	}

        	self.request(req, res, flags);
        });
	});
};

// vyčistenie dočasného adresára TMP
Framework.prototype.clear = function() {

	var self = this;

	fs.readdir(utils.combine(self.options.directoryTMP), function(err, files) {
		if (typeof(files) != 'undefined') {
    		files.forEach(function(file) {
    			fs.unlink(utils.combine(self.options.directoryTMP, file));
	    	});
    	}
	});

	return self;
};

Framework.prototype.stringEncode = function(value, key, isUnique) {

	var self = this;
	var type = typeof(value);
	
	if (type === 'undefined')
		return '';

	if (type === 'object')
		value = JSON.stringify(value);

	return value.encode(self.options.secret + '=' + key, isUnique || true);
};

Framework.prototype.stringDecode = function(value, key, jsonConvert) {

	jsonConvert = jsonConvert || true;

	var self = this;
	var result = value.decode(self.options.secret + '=' + key);

	if (jsonConvert) {
		
		var first = result[0];
		var last = result[result.length - 1];

		if ((first === '{' && last === '}') || (first === '[' && last === ']'))
			return JSON.parse(result);
	}

	return result;
};

Framework.prototype.resource = function (name, key, def) {

	var self = this;
	var res = self.options.resources[name];

	if (typeof(res) === 'undefined') {

		var fileName = utils.combine(self.options.directoryResources, name + '.resource');
		var obj = {};
		
		if (fs.existsSync(fileName)) {

			var arr = fs.readFileSync(fileName).toString('utf8').split('\n');
			for (var i = 0; i < arr.length; i++) {
				var str = arr[i];

				if (str === '')
					continue;

				var index = str.indexOf(':');
				if (index === -1)
					continue;

				obj[str.substring(0, index).trim()] = str.substring(index + 1).trim();
			}

			self.options.resources[name] = obj;
		}

		res = obj;
	}

	return res[key] || (def || '');
};

Framework.prototype.routeJS = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.options.staticUrlJS);
};

Framework.prototype.routeCSS = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.options.staticUrlCSS);
};

Framework.prototype.routeImage = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.options.staticUrlImage);
};

Framework.prototype.routeVideo = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.options.staticUrlVideo);
};

Framework.prototype.routeFont = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.options.staticUrlFont);
};

Framework.prototype.routeDocument = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.options.staticUrlDocument);
};

Framework.prototype.routeStatic = function(name) {
	var self = this;
	return self.routeStaticSync(name, self.options.staticUrl);
};

// pomocná funkcia pre spracovanie prijatých dát
Framework.prototype.routeSync = function(subdomain, pathname, flags, noLoggedUnlogged) {
	
	var self = this;
	var url = internal.routeSplit(pathname);
	var isSystem = pathname[0] === '#';

	return self.routes.find(function(obj) {

		if (!internal.routeCompareSubdomain(subdomain, obj.subdomain))
			return false;

		if (!internal.routeCompare(url, obj.url, isSystem))
			return false;

		if (internal.routeCompareFlags(flags, obj.flags, noLoggedUnlogged) < 1)
			return false;

		return true;
	});
};

Framework.prototype.routeStaticSync = function(name, directory) {	
	var self = this;
	var fileName = self.onVersion === null ? name : self.onVersion(name) || name;
	return directory + fileName;
};

Framework.prototype.request = function(req, res, flags) {
	
	var self = this;

	if (self.onAuthorize != null) {
		
		self.onAuthorize(req, res, function (isLogged) {
			flags.push(isLogged ? 'logged' : 'unlogged');
        	
        	// máme spracovaný request, môžeme vykonať routing
        	// a volať spúšťať controller
			subscribe.init(self, req, res).lookup(req.subdomain, req.uri.pathname, flags);
		});

		return;
	}

	// máme spracovaný request, môžeme vykonať routing
   	// a volať spúšťať controller
	subscribe.init(self, req, res).lookup(req.subdomain, req.uri.pathname, flags);
};

module.exports = new Framework();