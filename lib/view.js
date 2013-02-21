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
var javascript = require('./javascript');
var fs = require('fs');

/*
	View class
    @controller {Controller}
    return {View}
*/
function View(controller) {
	this.controller = controller;
	this.cache = controller.cache;
	this.prefix = controller.prefix;
};

/*
	Content class
    @controller {Controller}
    return {Content}
*/
function Content(controller) {
	this.controller = controller;
	this.cache = controller.cache;
	this.prefix = controller.prefix;
};


/*
	Parse HTML
    @html {String}
    return {Object}
*/
function parse(html) {
	var index = 0;
	var count = 0;

	var copy = false;

	var code = '';
	var cache = compressJS(html);
	var indexBeg = 0;
	var builder = [];
	var execute = [];
	var keys = {};

	while (index < cache.length) {

		var current = cache[index];
		var next = cache[index + 1];
		
		index++;

		if (!copy && current === '@' && next === '{') {
			copy = true;
			count = 0;
			indexBeg = index;
			continue;
		}

		if (copy && current === '{') {
			count++;
			if (count <= 1)
				continue;
		}
		
		if (copy && current === '}') {
			if (count > 1)
				count--;
			else {
				copy = false;
				countParser = 0;

				var other = cache.substring(indexBeg + code.length + 2);
				code = code.trim();

				var indexer = keys[code];
				var push = false;

				if (typeof(indexer) === 'undefined') {
					indexer = execute.length;
					keys[code] = indexer;
					push = true;
				}

				builder.push(cache.substring(0, indexBeg - 1).replace(/\n/g, '\\n'));
				builder.push('arr[' + indexer + ']');

				var isEncode = code[0] !== '!';

				if (!isEncode)
					code = code.substring(1);

				var a = code.indexOf('.');
				var b = code.indexOf('(');

				if (a === -1)
					a = b;
				
				if (b === -1)
					b = a;

				index = Math.min(a, b);

				if (index === -1)
					index = code.length;

				name = code.substring(0, index);

				if (push)
					execute.push({ run: code, name: name, isEncode: isEncode });

				cache = other;

				index = 0;
				code = '';
				continue;
			}
		}

		if (copy)
			code += current;
	}

	builder.push(cache.replace(/\n/g, '\\n'));

	var fn = [];
	for (var i = 0; i < builder.length; i++) {
		
		var str = builder[i];

		if (i % 2 !== 0)
			fn.push(str);
		else {
			fn.push("'" + str.replace(/\'/g, "\\'") + "'");
		}
	}

	var fn = '(function(arr){return ' + fn.join('+') + ';})';
	return { generator: fn, execute: execute };
}

/*
	Dynamic JavaScript compress
    @html {String}
    @index {Number}
    return {String}
*/
function compressJS(html, index) {

	var strFrom = '<script type="text/javascript">';
	var strTo = '</script>';

	var indexBeg = html.indexOf(strFrom, index || 0);
	if (indexBeg > 20) {
					
		var indexEnd = html.indexOf(strTo, indexBeg + strFrom.length);
		if (indexEnd > 0) {
			var js = html.substring(indexBeg, indexEnd + strTo.length);
			var compiled = javascript.compile(js);
			html = html.replace(js, compiled.dollar());

			// voláme znova funkciu v prípade
			compressJS(html, indexBeg + compiled.length);
		};
	}

	return html;
}

/*
	Render view
    @name {String}
    return {Object} :: return factory object
*/
View.prototype.render = function(name) {
	var self = this;
	return self.load(name, self.prefix);
};

/*
	Read view
    @name {String}
    return {Object} :: return factory object
*/
View.prototype.read = function(name) {
	var self = this;
	var config = self.controller.config;
	var fileName = utils.combine(config.directoryViews, name + '.html');

	if (fs.existsSync(fileName))
		return parse(fs.readFileSync(fileName).toString('utf8'));

	return null;
};

/*
	Load view
    @name {String}
    @prefix {String}
    return {Object} :: return factory object
*/
View.prototype.load = function(name, prefix) {

	var self = this;
	var isPrefix = (prefix || '').length > 0;

	var key = 'view.' + name + (isPrefix ? '#' + prefix : '');

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
	Read content
    @name {String}
    return {String}
*/
Content.prototype.read = function(name) {
	var self = this;
	var config = self.controller.config;
	var fileName = utils.combine(config.directoryContents, name + '.html');

	if (fs.existsSync(fileName))
		return fs.readFileSync(fileName).toString('utf8');

	return null;
};

/*
	Render content
    @name {String}
    return {String}
*/
Content.prototype.render = function(name) {
	var self = this;
	return self.load(name, self.prefix);
};

/*
	Load content
    @name {String}
    @prefix {String}
    return {String}
*/
Content.prototype.load = function(name, prefix) {

	var self = this;
	var isPrefix = prefix.length > 0;

	var key = 'content.' + name + (isPrefix ? '#' + prefix : '');
	var content = self.cache.read(key);

	if (content === null) {
		content = self.read(name + (isPrefix ? '#' + prefix : ''));

		if (content === null && isPrefix)
			content = self.read(name);

		if (content !== null && !self.controller.isDebug)
			self.cache.write(key, content, new Date().add('hour', 1));
	}

	return content;
};

/*
	Render view from file
    @controller {Controller}
    @name {String}
    return {Object}
*/
exports.generate = function(controller, name) {
	var view = new View(controller);
	return view.render(name);
};

/*
	Load content from file
    @controller {Controller}
    @name {String}
    return {String}
*/
exports.generateContent = function(controller, name) {
	var content = new Content(controller);
	return content.render(name);
};

/*
	Internal function
    @str {String}
    return {String}
*/
exports.appendThis = function(str) {
	var index = str.indexOf('(');
	var dot = str.indexOf('.');
	if (index > 0) {
		if (dot > 0 && dot < index)
			return str;
		var end = str.substring(index + 1);
		return str.substring(0, index) + '.call(this' + (end[0] === ')' ? end : ',' + end);
	}
	return str;
};