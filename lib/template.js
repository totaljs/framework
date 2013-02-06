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

var utils = require('./utils');
var path = require('path');
var fs = require('fs');
var	util = require('util');
var utils = require('./utils');
var internal = require('./internal');

/*
    Template class
    @subscribe {Subscribe}
    @id {String}
    @prefix {String}
    @model {Object}
    @repository {Object}
    @cb {Functions} :: function(string)
    return {Template}
*/
function Template(subscribe, id, prefix, model, repository, cb) {
	this.subscribe = subscribe;
	this.app = subscribe.app;
	this.id = id;
	this.name = '';
	this.prefix = prefix;
	this.model = util.isArray(model) ? model : [];
	this.callback = cb;
	this.state = 0;
	this.repository = repository || null;

	if (typeof(model) === 'undefined')
		model = '';

	if (model !== null && !util.isArray(model))
		this.model = [model];

	this.template = '';
	this.builder = '';
};

// ======================================================
// PROTOTYPES
// ======================================================

Template.prototype.onTemplate = function(obj) {

	var self = this;
	var data = obj.data;
	var matches = obj.matches;
	var reg = new RegExp('\{' + self.name.replace(/\./g, '\.') + '\}', 'g');
	var isBetween = obj.between.length > 0;
	var between = obj.between;

	// isEmpty? vraciame šablonu
	if (self.state === 1) {
		
		if (isBetween) {
			between = obj.between.replace('@@@', '');
		
			if (self.repository !== null)
				between = self.onRepository(self.repository, between, obj.matchesBetween);
		}

		self.callback(self.id, isBetween ? between : data);
		return;
	}

	if (matches === null) {
		self.callback(self.id, '');
		return;
	}

	// model forEach
	// rewrite to async
	self.model.forEach(function(o) {
		
		var str = data;
		matches.forEach(function(prop) {

			var isEncode = false;
			var name = prop.replace(/\s/g, '');

			if (prop.substring(0, 2) === '{!') {
				name = name.substring(2);
				name = name.substring(0, name.length - 1);
			} else {
				name = name.substring(1);
				name = name.substring(0, name.length - 1);
				isEncode = true;
			}

			var val;

			if (name.indexOf('.') !== -1) {
				var arr = name.split('.');

				if (arr.length === 2)
					val = o[arr[0]][arr[1]];
				else if (arr.length === 3)
					val = o[arr[0]][arr[1]][arr[3]];
				else if (arr.length === 4)
					val = o[arr[0]][arr[1]][arr[3]][arr[4]];
				else if (arr.length === 5)
					val = o[arr[0]][arr[1]][arr[3]][arr[4]][arr[5]];

			} else {
				val = o[name];
			}

			if (typeof(val) === 'function')
				val = val(index);

			if (typeof(val) === 'undefined')
				return;

			val = val.toString().dollar();
			str = str.replace(prop, isEncode ? utils.htmlEncode(val) : val);

		});

		self.builder += str;
	});

	if (isBetween && self.repository !== null)
		between = self.onRepository(self.repository, between, obj.matchesBetween);

	var output = (isBetween ? between.replace('@@@', self.builder) : self.builder).dollar();
	self.callback(self.id, self.template.length > 0 ? self.template.replace(reg, output) : output);
};

/*
	Parse template tags
    @html {String}
    return {Object}
*/
Template.prototype.parseTemplate = function(html) {

	var indexBeg = html.indexOf('<!--');
	if (indexBeg === -1)
		return { template: html, between: '' };
	
	var indexEnd = html.lastIndexOf('-->')
	if (indexEnd === -1)
		return { template: html, between: '' };

	return { template: html.substring(indexBeg + 4, indexEnd).trim(), between: html.substring(0, indexBeg) + '@@@' + html.substring(indexEnd + 3) };
};

/*
	Parse template tags
	@obj {Object}
    @html {String}
    @matches {RegExp}
    return {String}
*/
Template.prototype.onRepository = function(obj, html, matches) {

	var self = this;
	
	Object.keys(obj).forEach(function(key, index) {
		matches.forEach(function(prop) {

			var isEncode = false;
			var name = prop.replace(/\s/g, '');

			if (prop.substring(0, 2) === '{!') {
				name = name.substring(2);
				name = name.substring(0, name.length - 1);
			} else {
				name = name.substring(1);
				name = name.substring(0, name.length - 1);
				isEncode = true;
			}

			var val;

			if (name.indexOf('.') !== -1) {
				
				var arr = name.split('.');

				if (arr.length === 2)
					val = obj[arr[0]][arr[1]];
				else if (arr.length === 3)
					val = obj[arr[0]][arr[1]][arr[3]];
				else if (arr.length === 4)
					val = obj[arr[0]][arr[1]][arr[3]][arr[4]];
				else if (arr.length === 5)
					val = obj[arr[0]][arr[1]][arr[3]][arr[4]][arr[5]];

			} else 
				val = obj[name];

			if (typeof(val) === 'function')
				val = val(index);

			if (typeof(val) === 'undefined' || val === null)
				return;

			val = val.toString();
			html = html.replace(prop, isEncode ? utils.htmlEncode(val) : val);
		});
	});

	return html;
};

/*
	Load template
	@key {String}
	@name {String}
    @prefix {String}
    return {Template}
*/
Template.prototype.parseFromFile = function(key, name, prefix) {

	var self = this;
	var fileName = utils.combine(self.app.config.directoryTemplates, name + prefix + '.html');

	var callback = function(data) {
		
		if (data === null) {
			// odstraňujeme prefix
			self.load(name, '');
			return self;
		}

		var reg = /\{[\!\w\.\(\)]+\}/g;
		var template = typeof(data) === 'string' ? data : data.toString('utf8');
		var matches = template.match(reg);

		// vytvorenie cache objektu
		var tmp = self.parseTemplate(template);
		var matchesBetween = tmp.between.length > 0 ? tmp.between.match(reg) : null;

		var obj = { data: tmp.template, between: tmp.between, matches: matches, matchesBetween: matchesBetween };

		// if debug == no cache
		if (self.app.config.debug) {
			self.onTemplate(obj);
			return self;
		}

		self.onTemplate(self.app.cache.write(key, obj, new Date().add('m', 3)));
	};

	utils.loadFromFile(fileName, callback, prefix !== '' ? null : ''); 
	return self;
};

/*
	Init template
	@name {String}
	@nameEmpty {String}
    return {Template}
*/
Template.prototype.init = function(name, nameEmpty) {

	var self = this;
	var fileName = name;
	
	self.state = 2;

	if (self.model === null || self.model.length === 0) {
		fileName = nameEmpty || '';
		self.state = 1;
	}

	var reg = new RegExp('{.*?}', 'gi');
	var match = reg.exec(fileName);

	if (match !== null) {
		self.template = fileName;
		fileName = match[0].toString().replace('{', '').replace('}', '');
		self.name = fileName;
	}

	self.load(fileName, self.prefix);

	return self;
};

/*
	Load template
	@name {String}
	@prefix {String}
    return {Template}
*/
Template.prototype.load = function(name, prefix) {

	var self = this;
	var key = 'template.' + name + (prefix.length > 0 ? '#' + prefix : prefix);

	// čítanie z Cache (async)
	var data = self.app.cache.read(key);
	
	if (data === null) {
		self.parseFromFile(key, name, prefix);
		return self;
	}

	self.onTemplate(data);
	return self;
};

// ======================================================
// EXPORTS
// ======================================================

/*
    Template render
    @subscribe {Subscribe}
    @id {String}
    @prefix {String}
    @model {Object}
    @repository {Object}
    @cb {Functions} :: function(string)
    return {Template}
*/
module.exports.render = function(subscribe, id, name, nameEmpty, prefix, model, repository, cb) {
	var template = new Template(subscribe, id, prefix, model, repository, cb);
	template.init(name, nameEmpty);
};