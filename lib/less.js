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

function LessParam() {
	this.name = '';
	this.value = '';
};

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

LessValue.prototype.getValue = function(less) {
	
	var self = this;

	if (less === null)
		return '';
	
	if (self.isVariable)
		return '';

	var value = '';
	
	if (self.isFunction) {
		var param = [];
		var beg = less.value.indexOf('(') + 1;
		var end = less.value.lastIndexOf(')');

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
				var reg = new RegExp('@'+oo.name, 'g');
				value = value.replace(reg, oo.value);
			});
			sb.push(value);
		});

		return sb.join(';');
	}

	value = less.value.substring(less.name.length).trim();

	// možná chyba pri substring - 2
	if ((value[0] === '{') && (value[value.length - 1] === '}'))
		value = value.substring(1, value.length - 2).trim();

	return value;
};

Less.prototype.getParams = function(param) {

	var self = this;
	var sb = '';
	var arr = [];
	var index = 0;
	var skip = false;
	var closure = false;

	var prepare = function(n) {
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

Less.prototype.getValue = function(prev, value) {
	var self = this;
	var index = 0;

	if (prev !== null)
		index = prev.index + prev.value.length;

    var beg = false;
    var copy = false;

    var param = 0;
    var val = 0;

    var sb = [];
    var less = new LessValue(self);
    var without = ["@font-face", "@keyframes", "@-moz-keyframes", "@-webkit-keyframes", "@-o-keyframes", "@-ms-keyframes"];

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

    		var next = false;
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

			if (without.indexOf(less.name) > -1)
				less.isProblem = true;

			return less;
    	}

    	index++;
    };

    return null;
};

Less.prototype.compile = function(value, minify) {

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
			} else {

				var val = arr.find(function(oo) {
					return oo.name === o.name;
				});

				if (val !== null) {
					var v = o.getValue(val);
					value = value.replace(o.value, v);
				}
			}

		});
	}

	if (minify) {
		var reg1 = /\n|\s{2,}/g;
		var reg2 = /\s?\{\s{1,}/g;
		var reg3 = /\s?\}\s{1,}/g;
		var reg4 = /\s?\:\s{1,}/g;
		var reg5 = /\s?\;\s{1,}/g;
		return value.replace(reg1, '').replace(reg2, '{').replace(reg3, '}').replace(reg4, ':').replace(reg5, ';').replace(/\s\}/g, '}').replace(/\s\{/g, '{').trim();
	}

	return value.trim();
}

// ======================================================
// EXPORTS
// ======================================================

exports.compile = function(value, minify) {
	var less = new Less();
	return less.compile(value, minify);
};