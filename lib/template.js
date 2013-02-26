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

var fs = require('fs');
var utils = require('./utils');
var generatorView = require('./view');

/*
    Template class
    @controller {Controller}
    @model {Object}
    @repository {Object}
    return {Template}
*/
function Template(controller, model, repository) {
	this.controller = controller;
	this.model = model;
	this.repository = repository || null;
	this.prefix = controller.prefix;
	this.cache = controller.cache;

	if (typeof(model) === 'undefined')
		model = '';

	if (model !== null && !utils.isArray(model))
		this.model = [model];
};

/*
    Parse HTML
    @html {String}
    @isRepository {Boolean}
    return {Object}
*/
Template.prototype.parse = function(html, isRepository) {

	var self = this;
	var indexBeg = html.indexOf('<!--');	
	var indexEnd = html.lastIndexOf('-->')

	var beg = '';
	var end = '';
	var template = html.trim();

	if (indexBeg !== -1 && indexEnd !== -1) {
		beg = html.substring(0, indexBeg).trim();
		end = html.substring(indexEnd + 3).trim();
		template = html.substring(indexBeg + 4, indexEnd).trim();
	}	

	if (self.config.httpMinify) {
		beg = generatorView.minifyHTML(beg);
		end = generatorView.minifyHTML(end);
		template = generatorView.minifyHTML(template);
	}

	var indexBeg = 0;
	var indexer = 0;
	var index = 0;
	
	var builder = [];
	var property = [];
	var keys = {};

	var tmp = template.match(/\{[^}\n]*\}/g);

	if (tmp === null)
		tmp = [];

	for (var i = 0; i < tmp.length; i++) {

		var format = '';
		var name = tmp[i];
		var isEncode = true;

		index = name.indexOf('|');				
		indexEnd = template.indexOf(name, indexBeg);

		var b = template.substring(indexBeg, indexEnd);
		builder.push(b);

		indexBeg = indexEnd + name.length;
		
		if (index !== -1) {
			format = name.substring(index + 1, name.length - 1).trim();
			name = name.substring(1, index);

			// format number
			if (format.indexOf('#') !== -1) {				
				format = ".format('" + format + "')";
			} else {
				format = utils.parseInt(format);
				if (format === 0)
					format = ".format('" + format + "')";
				else {
					format = ".maxLength(" + (format + 3) + ",'...')";
					if (isEncode) {
						format += '.htmlEncode()';
						isEncode = false;
					}
				}
			}
		}
		else {
			name = name.substring(1, name.length - 1);
		}

		if (name[0] === '!') {
			name = name.substring(1);
			isEncode = false;
		}

		if (isEncode)
			format += '.toString().htmlEncode()';

		var key = name + format;
		var indexer = keys[key];
		
		if (typeof(indexer) === 'undefined') {
			property.push(name.trim());
			indexer = property.length - 1;
			keys[key] = indexer;
		}

		builder.push('prop[' + indexer + ']' + format);
	}

	if (indexBeg !== template.length)
		builder.push(template.substring(indexBeg));

	var fn = [];
	for (var i = 0; i < builder.length; i++) {		
		
		var str = builder[i];

		if (i % 2 !== 0)
			fn.push(str);
		else
			fn.push("'" + str.replace(/\'/g, "\'").replace(/\n/g, '\\n') + "'");
	}

	var repositoryBeg = null;
	var repositoryEnd = null;

	if (!isRepository && self.repository !== null) {
		repositoryBeg = beg.indexOf('{') !== -1 ? self.parse(beg, true) : null;
		repositoryEnd = end.indexOf('{') !== -1 ? self.parse(end, true) : null;
	}

	return { generator: '(function(prop){return ' + fn.join('+') + ';})', beg: beg, end: end, property: property, repositoryBeg: repositoryBeg, repositoryEnd: repositoryEnd };
};

/*
    Read from file
    @name {String}
    return {Object} :: return parsed HTML
*/
Template.prototype.read = function(name) {
	var self = this;
	var config = self.controller.config;
	var fileName = utils.combine(config.directoryTemplates, name + '.html');

	if (fs.existsSync(fileName))
		return self.parse(fs.readFileSync(fileName).toString('utf8'));

	return null;
};

/*
    Load template with/without prefix
    @name {String}
    @prefix {String} :: optional
    return {Object} :: return parsed HTML
*/
Template.prototype.load = function(name, prefix) {

	var self = this;
	var isPrefix = (prefix || '').length > 0;

	var key = 'template.' + name + (isPrefix ? '#' + prefix : '');

	var generator = self.cache.read(key);

	if (generator === null) {
		generator = self.read(name + (isPrefix ? '#' + prefix : ''));

		if (generator === null && isPrefix)
			generator = self.read(name);

		if (generator !== null && !self.controller.isDebug)
			self.cache.write(key, generator, new Date().add('hour', 1));
	}

	return generator;
};

/*
    Render HTML
    @name {String}
    return {String}
*/
Template.prototype.render = function(name) {

	var self = this;
	var generator = self.load(name, self.prefix);
	
	if (generator === null)
		return '';

	var mid = compile(generator, self.model, true);
	var beg = generator.repositoryBeg !== null ? compile(generator.repositoryBeg, self.repository) : generator.beg;
	var end = generator.repositoryEnd !== null ? compile(generator.repositoryEnd, self.repository) : generator.end;

	return beg + mid + end;
};

/*
	Eval parsed code
    @generator {Object}
    @obj {Array}
    @plain {Boolean} :: internal property
    return {String}
*/
function compile(generator, obj, plain) {

	var fn = eval(generator.generator);
	var html = '';

	if (!utils.isArray(obj))
		obj = [obj];

	for (var j = 0; j < obj.length; j++) {

		var model = obj[j];
		var params = [];

		for (var i = 0; i < generator.property.length; i++) {

			var property = generator.property[i];
			var val;

			if (property === '') {
				val = model;
 			} else {
 				if (property.indexOf('.') !== -1) {
					var arr = property.split('.');
					if (arr.length === 2)
						val = model[arr[0]][arr[1]];
					else if (arr.length === 3)
						val = model[arr[0]][arr[1]][arr[3]];
					else if (arr.length === 4)
						val = model[arr[0]][arr[1]][arr[3]][arr[4]];
					else if (arr.length === 5)
						val = model[arr[0]][arr[1]][arr[3]][arr[4]][arr[5]];
				} else 
					val = model[property];
			}

			if (typeof(val) === 'function')
				val = val(j);

			if (typeof(val) === 'undefined' || val === null)
				val = '';

			params.push(val);
		}

		html += fn.call(null, params);
	}

	return plain ? html : generator.beg + html + generator.end;
}

/*
	Generate template / Render template
	@controller {Controller}
	@name {String} :: filename of template
	@model {Array of Object}
	@repository {Object} :: optional
*/
exports.generate = function(controller, name, model, repository) {
	var template = new Template(controller, model, repository);
	return template.render(name);
};