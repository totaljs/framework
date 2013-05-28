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

'use strict';

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
function parse(html, controller) {
	var index = 0;
	var count = 0;

	var copy = false;

	var code = '';
	var cache = compressJS(html);
	var minify = true;

	var indexBeg = 0;
	var builder = [];
	var execute = [];
	var keys = {};
	var condition = 0;
	var isCondition = false;
	var plus = '';
	var beg = '';
	var end = '';
	var name = '';

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

				var other = cache.substring(indexBeg + code.length + 2);

				if (minify)
					other = minifyHTML(other);

				code = code.trim();

				var indexer = keys[code];
				var push = false;

				if (typeof(indexer) === 'undefined') {
					indexer = execute.length;
					keys[code] = indexer;
					push = true;
				}

				var value = cache.substring(0, indexBeg - 1);

				condition = code.substring(0, 2) === 'if' ? 1 : code.substring(0, 5) === 'endif' ? 3 : code.substring(0, 4) === 'else' ? 2 : 0;

				builder.push(minify ? minifyHTML(value).replace(/\n/g, '\\n') : value.replace(/\n/g, '\\n'));

				var param = 'arr[' + indexer + ']';

				if (condition > 0) {

					switch (condition) {
						case 1:
							isCondition = true;
							name = 'if';
							builder.push('({0} ? '.format(param));
							code = code.substring(2).trim();
							break;
						case 2:
							builder.push(':');
							break;
						case 3:
							isCondition = false;
							builder.push(')');
							break;
					}

				} else {

					if (isCondition)
						param = '( ' + param + '(self,repository,model,session,sitemap,get,post,url,empty,global,helper) || \'\')';

					builder.push(param);
				}

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

				if (condition !== 1)
					name = code.substring(0, index);

				if (push) {
					beg = '';
					end = '';
					var isDeclared = false;
					switch (name) {

						case 'options':
						case 'readonly':
						case 'selected':
						case 'disabled':
						case 'checked':
						case 'etag':
						case 'modified':
						case 'image':
						case 'json':
						case 'dns':
						case 'prefetch':
						case 'prerender':
						case 'next':
						case 'prev':
						case 'canonical':
							isEncode = false;
							isDeclared = true;
							code = 'self.$' + code;
							beg = 'return ';
							break;

						case 'view':
						case 'viewToggle':
						case 'content':
						case 'contentToggle':
						case 'template':
						case 'templateToggle':
							beg = 'return self.$';
							break;

						case 'radio':
						case 'text':
						case 'checkbox':
						case 'hidden':
						case 'textarea':
						case 'password':
							isEncode = false;
							isDeclared = true;
							code = 'self.$' + exports.appendModel(code);
							beg = 'return ';
							break;

						case 'js':
						case 'script':
						case 'css':
						case 'favicon':
							beg = '';
							isEncode = false;
							isDeclared = true;
							code = 'self.$' + code + (code.indexOf('(') === -1 ? '()' : '');
							beg = 'return ';
							break;

						case 'routeJS':
						case 'routeCSS':
						case 'routeImage':
						case 'routeFont':
						case 'routeDocument':
						case 'routeVideo':
						case 'routeStatic':
							isEncode = false;
							isDeclared = true;
							code = 'self.' + code;
							beg = 'return ';
							break;

						case 'resource':
							code = 'self.' + code;
							isDeclared = true;
							beg = 'return ';
							break;

						case 'global':
						case 'model':
						case 'repository':
						case 'session':
						case 'config':
						case 'get':
						case 'post':
							beg = 'return self.';
							break;

						case 'head':
						case 'meta':
						case 'sitemap':
						case 'settings':
						case 'layout':
						case 'title':
						case 'description':
						case 'keywords':

							if (code.indexOf('(') !== -1) {
								beg = 'self.';
								end = ';return \'\'';
							} else {
								beg = 'return self.repository["$';
								end = '"]';
							}

							break;

						case 'url':
							isEncode = false;

							if (code.contains('('))
								code = 'self.$' + code;
							else
								code = 'url';

							beg = 'return ';
							isDeclared = true;
							break;
					}

					if (isCondition && condition === 0)
						code = '(function(){' + beg + code + end + ';})';

					execute.push({ run: code, name: name, isEncode: isEncode, isDeclared: isDeclared });
				}

				cache = other;

				index = 0;
				code = '';
				continue;
			}
		}

		if (copy)
			code += current;
	}

	builder.push(minify ? minifyHTML(cache.replace(/\n/g, '\\n')) : cache.replace(/\n/g, '\\n'));

	var fn = '';
	var plus = true;
	condition = 0;

	for (var i = 0; i < builder.length; i++) {

		var str = builder[i];

		if (str === '')
			continue;

		if (condition === 1 && str[0] === ':') {
			condition = 2;
			fn += ' : ';
			plus = false;
			continue;
		}

		if (condition !== 0 && str[0] === ')') {

			plus = true;

			if (condition !== 2)
				fn += ' : empty';

			fn += ')';
			condition = 0;
			continue;
		}

		if (plus && fn.length > 0)
			fn += '+';

		if (!plus)
			plus = true;

		if (str.substring(0, 4) === '(arr') {

			if (condition !== 0) {
				controller.app.error(new Error('View engine doesnt support nested condition.'), 'View compiler', controller.req.uri);
				fn = '';
				break;
			}

			plus = false;
			condition = 1;
		}

		if (i % 2 !== 0)
			fn += str;
		else
			fn += "'" + str.replace(/\'/g, "\\'") + "'";
	}

	fn = '(function(arr,self,repository,model,session,sitemap,get,post,url,empty,global,helper){return ' + (fn.length === 0 ? 'empty' : fn) + ';})';

	try
	{
		return { generator: eval(fn), execute: execute };
	} catch (ex) {
		controller.app.error(ex, 'View compiler', controller.req.uri);
		return null;
	}
}

function removeCondition(text, beg) {

	if (beg) {
		if (text[0] === '+')
			return text.substring(1, text.length);
	} else {
		if (text[text.length - 1] === '+')
			return text.substring(0, text.length - 1);
	}

	return text;
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
	if (indexBeg === -1)
		return html;

	var indexEnd = html.indexOf(strTo, indexBeg + strFrom.length);
	if (indexEnd === -1)
		return html;

	var js = html.substring(indexBeg, indexEnd + strTo.length);
	var compiled = javascript.compile(js).replace(/\\n/g, "'+(String.fromCharCode(13)+String.fromCharCode(10))+'");

	html = html.replace(js, compiled.dollar());

	// voláme znova funkciu v prípade
	return compressJS(html, indexBeg + compiled.length);
}

/*
	Minify HTML
    @html {String}
    return {String}
*/
function minifyHTML(html) {

	if (html === null || html === '')
		return html;

	var reg1 = new RegExp(/[\n\r\t]+/g);
	var reg2 = new RegExp(/\s{2,}/g);

	var tags =['textarea', 'pre', 'code', 'script'];
	var id = '[' + new Date().getTime() + ']#';
	var cache = {};
	var indexer = 0;

	tags.forEach(function(o) {

		var tagBeg = '<' + o;
		var tagEnd = '</' + o;

		var beg = html.indexOf(tagBeg);
		var end = 0;

		while (beg !== -1) {

			end = html.indexOf(tagEnd, beg + 3);
			if (end === -1)
				break;

			var key = id + (indexer++);
			var value = html.substring(beg, end);
			cache[key] = value;
			html = html.replace(value, key);
			beg = html.indexOf(tagBeg, end + o.length);
		}
	});

	html = html.replace(reg1, '').replace(reg2, '');

	Object.keys(cache).forEach(function(o) {
		html = html.replace(o, cache[o]);
	});

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
	var fileName = utils.combine(config['directory-views'], name + '.html');

	if (fs.existsSync(fileName))
		return parse(fs.readFileSync(fileName).toString('utf8'), self.controller);

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

	if (generator !== null)
		return generator;

	generator = self.read(name + (isPrefix ? '#' + prefix : ''));

	if (generator === null && isPrefix)
		generator = self.read(name);

	if (generator !== null && !self.controller.isDebug)
		self.cache.write(key, generator, new Date().add('minute', 5));

	self.dispose();
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
	var fileName = utils.combine(config['directory-contents'], name + '.html');

	if (fs.existsSync(fileName))
		return minifyHTML(fs.readFileSync(fileName).toString('utf8'));

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

	if (content !== null)
		return content;

	content = self.read(name + (isPrefix ? '#' + prefix : ''));

	if (content === null && isPrefix)
		content = self.read(name);

	if (content === null)
		self.controller.app.error('Content "' + name + '" not found.', self.controller.name, self.controller.uri);

	if (content !== null && !self.controller.isDebug)
		self.cache.write(key, content, new Date().add('minute', 5));

	self.dispose();
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

	if (index <= 0)
		return str;

	if (dot > 0 && dot < index)
		return str;
	var end = str.substring(index + 1);
	return str.substring(0, index) + '.call(this' + (end[0] === ')' ? end : ',' + end);
};

exports.appendModel = function(str) {
	var index = str.indexOf('(');
	if (index === -1)
		return str;

	var end = str.substring(index + 1);
	return str.substring(0, index) + '(model' + (end[0] === ')' ? end : ',' + end);
};

exports.minifyHTML = minifyHTML;