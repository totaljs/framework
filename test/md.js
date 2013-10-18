var utils = require('partial.js/utils');

const EMPTY = 0;
const PARAGRAPH = 100;
const EMBEDDED = 101;
const LIST = 102;
const KEYVALUE = 103;

var noop = function() {};

function Markdown() {

	this.embedded = '===';

	this.onLine = noop;
	this.onParagraph = noop;
	this.onLink = noop;
	this.onKeyValue = noop;
	this.onFormatting = noop;
	this.onKeyword = noop;
	this.onImage = noop;
	this.onList = noop;
	this.onEmbedded = noop;
	this.onBreak = noop;
	this.onTitle = noop;

	this.current = [];
	this.status = 0;
	this.command = '';
	this.skip = false;
	this.output = '';
}

Markdown.prototype.load = function(text) {

	var self = this;
	var arr = text.split('\n');
	var length = arr.length;

	self.output = '';

	for (var i = 0; i < length; i++) {

		if (self.skip) {
			self.skip = false;
			continue;
		}

		var line = arr[i];

		if (self.parseEmbedded(line))
			continue;

		if (self.parseBreak(line))
			continue;

		if (self.parseList(line))
			continue;

		if (self.parseKeyValue(line))
			continue;

		if (self.parseParagraph(line))
			continue;

		if (self.parseTitle(line, arr[i + 1]))
			continue;

		if (self.onLine !== null)
			self.onLine(line);
	}

	if (self.status !== EMPTY)
		self.flush();
};

Markdown.prototype.parseEmbedded = function(line) {

	var self = this;
	var status = self.status;
	var chars = self.embedded + (status !== EMBEDDED ? ' ' : '');
	var has = line.substring(0, chars.length) === chars;

	if (status !== EMBEDDED && !has)
		return false;

	if (status !== EMBEDDED && has)
		self.flush();

	if (status === EMBEDDED && has) {
		self.flush();
		self.status = EMPTY;
		return true;
	}

	if (has) {
		self.status = EMBEDDED;
		status = EMBEDDED;
		self.command = line.substring(chars.length);
		return true;
	}

	if (status === EMBEDDED)
		self.current.push(line);

	return true;
};

Markdown.prototype.parseBreak = function(line) {

	var self = this;

	if (line === '' || line === '***' || line === '---') {

		var status = self.status;

		if (status !== EMPTY)
			self.flush();

		self.status = EMPTY;

		if (self.onBreak)
			self.output += self.onBreak(line === '' ? '\n' : line) || '';

		return true;
	}

	return false;
};

Markdown.prototype.parseList = function(line) {

	var self = this;

	var first = line[0] || '';
	var second = line[1] || '';

	var has = (first === '-' || first === '+' || first === 'x') && (second === ' ');

	if (!has)
		return false;

	var status = self.status;

	if (status !== LIST) {
		self.flush();
		self.status = LIST;
	}

	self.current.push({ type: first, value: line.substring(3) });
	return true;
};

Markdown.prototype.parseKeyValue = function(line) {

	var self = this;
	var index = line.indexOf(':');

	if (index === -1)
		return false;

	var tmp = line.substring(0, index);
	var length = tmp.length;

	var countTab = 0;
	var countSpace = 0;

	for (var i = 0; i < length; i++) {

		var c = tmp[i];

		if (c === '\t') {
			countTab++;
			break;
		}

		if (c === ' ') {
			countSpace++;
			if (countSpace > 2)
				break;
		} else
			countSpace = 0;
	}

	if (countSpace < 3 && countTab <= 0)
		return false;

	var status = self.status;

	if (status !== KEYVALUE) {
		self.flush();
		self.status = KEYVALUE;
	}

	self.current.push({ key: tmp.trim(), value: line.substring(index + 1).trim() });
	return true;
};

Markdown.prototype.parseParagraph = function(line) {

	var self = this;
	var first = line[0] || '';
	var second = line[1] || '';
	var index = 0;
	var has = false;

	switch (first) {
		case '>':
		case '|':
			has = second === ' ';
			index = 1;
			break;

		case '/':
			has == second === '/' && line[3] === ' ';
			index = 2;
			break;
	}

	if (!has)
		return false;

	var status = self.status;

	if (has) {
		var command = first + (first === '/' ? '/' : '');
		if (self.command !== '' && self.command !== command && status === PARAGRAPH)
			self.flush();
		self.command = command;
	}

	if (status !== PARAGRAPH) {
		self.flush();
		self.status = PARAGRAPH;
		status = PARAGRAPH;
	}

	self.current.push(line.substring(index).trim());
	return true;
};

Markdown.prototype.parseTitle = function(line, next) {

	var self = this;
	var has = line[0] === '#';
	var type = '';

	if (!has) {
		var first = (next || '')[0] || '';
	 	has = line[0].charCodeAt(0) > 64 && (first === '=' || first === '-');

	 	if (has)
	 		has = line.length === next.length;

	 	if (has) {
	 		type = first === '=' ? '#' : '##';
	 		self.skip = true;
	 	}

	} else {

		var index = line.indexOf(' ');
		if (index === -1)
			return false;

		type = line.substring(0, index).trim();
	}

	if (!has)
		return false;

	if (self.status !== EMPTY)
		self.flush();

	if (self.onTitle !== null)
		self.output += self.onTitle(type, self.skip ? line : line.substring(type.length + 1)) || '';

	return true;
};

Markdown.prototype.formatting = function(line) {


};

Markdown.prototype.parseLink = function(line) {

	var self = this;
	var length = line.length;

	var beg = line.indexOf('[');
	var end = line.indexOf(')', beg);

	var index = 0;

	while (beg !== -1) {

		index++;
		if (index > 100)
			break;

		if (end === -1)
			break;

		console.log(line.substring(beg, end + 1));

		beg = line.indexOf('[', beg + 1);

		if (beg === -1)
			break;

		end = line.indexOf(')', beg);
	}

};

Markdown.prototype.flush = function() {

	var self = this;

	switch (self.status) {
		case EMBEDDED:
			console.log('EMBEDDED:');
			console.log(JSON.stringify(self.current));
			break;
		case LIST:
			console.log('LIST:');
			console.log(JSON.stringify(self.current));
			break;
		case KEYVALUE:
			console.log('KEYVALUE:');
			console.log(JSON.stringify(self.current));
			break;
		case PARAGRAPH:
			console.log('PARAGRAPH:');
			console.log(JSON.stringify(self.current));
			break;
	}

	self.current = [];
	self.command = '';
};


var md = new Markdown();


md.onBreak = function(line) {
	console.log('onBreak', line === '\n' ? '\\n' : line);
};

md.onTitle = function(type, text) {
	console.log('onTitle', type, text);
};

//md.load('## WELCOME\n=== js\na\n===\n\n\n- asd\n- asdasd\nkey    : value \n> asdsa');
md.parseLink('asda sd asd [Google](www.google.sk). www.partialjs.com alebo <http://www.azet.sk>, [Zoznam.sk](https://www.zoznam.sk)');