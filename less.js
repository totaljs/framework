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

function LessParam() {
	this.name = '';
	this.value = '';
};

/*
	Internal class
	@parent {Object}
	return {LessValue}
*/
function LessValue(parent) {
	this.index = 0;
	this.value = '';
	this.name = '';
	this.isVariable = false;
	this.isFunction = false;
	this.isProblem = false;
	this.parent = parent;
};

function Less() {};

// ======================================================
// PROTOTYPES
// ======================================================

/*
	Internal function
	@less {Object}
	return {String}
*/
LessValue.prototype.getValue = function(less) {

	var self = this;

	if (less === null)
		return '';

	if (self.isVariable)
		return '';

	var value = '';

	if (!self.isFunction) {
		value = less.value.substring(less.name.length).trim();

		// možná chyba pri substring - 2
		if ((value[0] === '{') && (value[value.length - 1] === '}'))
			value = value.substring(1, value.length - 2).trim();

		return value;
	}

	var param = [];
	var beg = less.value.indexOf('(') + 1;
	var end = less.value.indexOf(')', beg + 1);

	less.value.substring(beg, end).split(',').forEach(function(o) {
		var p = new LessParam();
		p.name = o.trim();
		param.push(p);
	});

	beg = self.value.indexOf('(') + 1;
	end = self.value.lastIndexOf(')');

	var index = 0;

	self.parent.getParams(self.value.substring(beg, end)).forEach(function(o, index) {
		if (param[index])
			param[index].value = o.trim().replace(/\|/g, ',');
	});

	beg = less.value.indexOf('{') + 1;
	end = less.value.lastIndexOf('}');

	var sb = [];

	less.value.substring(beg, end).split(';').forEach(function(o, index) {
		value = o.trim();

		if (value.length === 0)
			return;

		param.forEach(function(oo) {
			var reg = new RegExp('@' + oo.name, 'g');
			value = value.replace(reg, oo.value);
		});

		sb.push(value);
	});

	return sb.join(';');
};

/*
	Internal function
	@param {String}
	return {String array}
*/
Less.prototype.getParams = function getParams(param) {

	var self = this;
	var sb = '';
	var arr = [];
	var index = 0;
	var skip = false;
	var closure = false;

	var prepare = function prepare(n) {
		var value = n.replace(/\|/g, ',');
		if (value[0] === '\'' || value[0] === '"')
			return value.substring(1, value.length - 1).trim();
		return value;
	};

	do
	{
		var c = param[index];

		if (c === '(' && !skip) {
			closure = true;
			skip = true;
		}

		if (!closure) {
			if (c === '\'' || c === '"')
				skip = !skip;
		}

		if (c === ')' && !skip && closure) {
			skip = false;
			closure = false;
		}

		if (c !== ',' || skip || closure) {
			sb += c;
		} else {
			arr.push(prepare(sb));
			sb = '';
		}

		index++;

	} while (index < param.length);

	if (sb.length > 0)
		arr.push(prepare(sb));

	return arr;
};

/*
	Internal function
	@prev {LessValue}
	@value {String}
	return {LessValue}
*/
Less.prototype.getValue = function(prev, value) {
	var self = this;
	var index = 0;

	if (prev !== null)
		index = prev.index + prev.value.length;

    var beg = false;
    var copy = false;
    var skip = false;

    var param = 0;
    var val = 0;

    var sb = [];
    var less = new LessValue(self);
    var without = ['@import', '@font-face', '@keyframes', '@-moz-keyframes', '@-webkit-keyframes', '@-o-keyframes', '@-ms-keyframes', '@media'];

    while (index < value.length) {

    	var c = value[index];
    	if (c === '@' && !less.isFunction) {
    		beg = true;
    		copy = true;
    		less.index = index;
    	} else if (beg) {
    		var charindex = value.charCodeAt(index);

    		if (charindex === 40)
    			param++;
    		else if (charindex === 41)
    			param--;

    		var next = val !== 0;

    		if (charindex === 123) {

    			if (val === 0)
    				less.isVariable = true;

    			val++;
    			next = true;
    		} else if (charindex === 125) {

    			if (val === 0) {
    				index++;
    				continue;
    			}
    			val--;
    			next = true;
    		}

    		if (charindex === 32 || charindex === 41)
    			next = true;
    		else if (param === 0 && val === 0 && !next)
    			next = (charindex >= 65 && charindex <= 90) || (charindex >= 97 && charindex <= 122) || charindex === 45;
     		else if (param > 0 && val === 0) {
    			next = charindex !== 41;
    			less.isFunction = true;
    		} else if (val > 0 && param === 0)
    			next = true;

    		copy = next;
    	}

    	if (beg && copy)
    		sb.push(c);
    	else if(beg) {

    		if (copy)
    			sb.push(c);

    		less.value = sb.join('').trim();

    		if (less.isFunction)
    			less.name = less.value.substring(0, less.value.indexOf('(')).trim();
			else if (less.isVariable)
				less.name = less.value.substring(0, less.value.indexOf('{')).trim();
			else
				less.name = less.value.trim();

			var invalid = less.name.split(' ');

			if (without.indexOf(invalid[0]) > -1)
				less.isProblem = true;

			return less;
    	}

    	index++;
    };

    return null;
};

/*
	Internal function
	@value {String}
	return {String}
*/
Less.prototype.compile = function(value) {

	var self = this;
	var arr = [];
	var less = self.getValue(null, value);

	while (less !== null) {
		arr.push(less);
		less = self.getValue(less, value);
	};

	if (arr.length > 0) {

		arr.forEach(function(o) {

			if (o.isProblem)
				return;

			if (o.isVariable) {
				value = value.replace(o.value, '');
				return;
			}

			var val = arr.find(function(oo) {
				return oo.name === o.name;
			});

			if (val === null)
				return;

			var v = o.getValue(val);
			value = value.replace(o.value, v);
		});
	}

	var reg1 = /\n|\s{2,}/g;
	var reg2 = /\s?\{\s{1,}/g;
	var reg3 = /\s?\}\s{1,}/g;
	var reg4 = /\s?\:\s{1,}/g;
	var reg5 = /\s?\;\s{1,}/g;

	arr = null;
	less = null;

	return value.replace(reg1, '').replace(reg2, '{').replace(reg3, '}').replace(reg4, ':').replace(reg5, ';').replace(/\s\}/g, '}').replace(/\s\{/g, '{').trim();
};

/*
	Auto vendor prefixer
	@value {String} :: Raw CSS
	return {String}
*/
function autoprefixer (value) {

	var prefix = ['appearance', 'box-shadow', 'border-radius', 'border-image', 'column-count', 'column-gap', 'column-rule', 'display', 'transform', 'transform-origin', 'transition', 'user-select', 'animation', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-play-state', 'opacity', 'background', 'background-image', 'text-overflow'];
	var id = '@#auto-vendor-prefix#@';

	if (value.indexOf(id) === -1)
		return value;

	value = autoprefixer_keyframes(value.replace(id, ''));

	var builder = [];
	var index = 0;

	// properties
	for (var i = 0; i < prefix.length; i++) {

		var property = prefix[i];
		index = 0;

		while (index !== -1) {

			index = value.indexOf(property, index + 1);

			if (index === -1)
				continue;
	
			var a = value.indexOf(';', index);
			var b = value.indexOf('}', index);

			var end = Math.min(a, b);
			if (end === -1)
				end = Math.max(a, b);

			if (end === -1)
				continue;

			// text-transform
			if (property === 'transform' && value.substring(index - 1, index) === '-')
				continue;

			var css = value.substring(index, end);
			end = css.indexOf(':');

			if (end === -1)
				continue;

			if (css.substring(0, end + 1).replace(/\s/g, '') !== property + ':')
				continue;

			builder.push({ name: property, property: css });
		}
	}
	
	var output = [];

	for (var i = 0; i < builder.length; i++) {

		var name = builder[i].name;
		var property = builder[i].property;

		var plus = property;
		var delimiter = ';';
		var updated = plus + delimiter;

		if (name === 'opacity') {

			var opacity = parseFloat(plus.replace('opacity', '').replace(':', '').replace(/\s/g, ''));
			if (isNaN(opacity))
				continue;

			updated += 'filter:alpha(opacity='+Math.floor(opacity * 100)+')';

			value = value.replace(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		if (name === 'background' || name === 'background-image') {

			if (property.indexOf('linear-gradient') === -1)
				continue;

			updated = plus + delimiter;
			updated += plus.replace('linear-', '-webkit-linear-') + delimiter;
			updated += plus.replace('linear-', '-moz-linear-') + delimiter;
			updated += plus.replace('linear-', '-o-linear-') + delimiter;
			updated += plus.replace('linear-', '-ms-linear-');

			value = value.replace(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		if (name === 'text-overflow') {
			updated = plus + delimiter;
			updated += plus.replace('text-overflow', '-ms-text-overflow');
			value = value.replace(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		if (name === 'display') {

			if (property.indexOf('box') === -1)
				continue;

			updated = plus + delimiter;
			updated += plus.replace('box', '-webkit-box') + delimiter;
			updated += plus.replace('box', '-moz-box');

			value = value.replace(property, '@[[' + output.length + ']]');
			output.push(updated);
			continue;
		}

		updated += '-webkit-' + plus + delimiter;
		updated += '-moz-' + plus;

		if (name !== 'box-shadow' && name !== 'border-radius') {
			
			if (name.indexOf('animation') === -1)
				updated += delimiter + '-ms-' + plus;

			updated += delimiter + '-o-' + plus;
		}

		value = value.replace(property, '@[[' + output.length + ']]');
		output.push(updated);
	};

	for (var i = 0; i < output.length; i++)
		value = value.replace('@[[' + i + ']]', output[i]);

	output = null;
	builder = null;
	prefix = null;

	return value;
};

function autoprefixer_keyframes (value) {

	var builder = [];
	var index = 0;

	while (index !== -1) {

		index = value.indexOf('@keyframes', index + 1);
		if (index === -1)
			continue;

		var counter = 0;
		var end = -1;

		for (var indexer = index + 10; indexer < value.length; indexer++) {

			if (value[indexer] === '{')
				counter++;

			if (value[indexer] !== '}')
				continue;

			if (counter > 1) {
				counter--;
				continue;
			}

			end = indexer;
			break;
		};

		if (end === -1)
			continue;

		var css = value.substring(index, end + 1);
		builder.push({ name: 'keyframes', property: css });
	}

	var output = [];

	for (var i = 0; i < builder.length; i++) {

		var name = builder[i].name;
		var property = builder[i].property;

		if (name !== 'keyframes')
			continue;

		var plus = property.substring(1);
		var delimiter = '\n';

		var updated = plus + delimiter;

		updated += '@-webkit-' + plus + delimiter;
		updated += '@-moz-' + plus + delimiter;
		updated += '@-o-' + plus;

		value = value.replace(property, '@[[' + output.length + ']]');
		output.push(updated);
	}

	for (var i = 0; i < output.length; i++)
		value = value.replace('@[[' + i + ']]', output[i]);

	builder = null;
	output = null;

	return value;
};

// ======================================================
// EXPORTS
// ======================================================

/*
	Load and compile and minify CSS
	@value {String}
	@minify {Boolean}
	return {String}
*/
exports.compile = function(value, minify) {
	var less = new Less();
	var value = less.compile(autoprefixer(value), minify);
	less.dispose();
	less = null;
	return value;
};