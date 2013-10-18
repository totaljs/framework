const EMPTY = 0;
const PARAGRAPH = 100;
const EMBEDDED = 101;
const LIST = 102;

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

	this.current = [];
	this.status = 0;
	this.command = '';
}

Markdown.prototype.load = function(text) {

	var self = this;
	var arr = text.split('\n');
	var length = arr.length;
	var skip = false;

	for (var i = 0; i < length; i++) {

		var line = arr[i];

		if (self.parseEmbedded(line))
			continue;

		if (self.parseBreak(line))
			continue;

		if (self.parseList(line))
			continue;

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
		self.onBreak(line === '' ? '\n' : line);

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

	return true;
};

Markdown.prototype.flush = function() {

	var self = this;

	switch (self.status) {
		case EMBEDDED:
			console.log('EMBEDDED:');
			console.log(self.current.join('\n'));
			break;
		case LIST:
			console.log('LIST:');
			console.log(JSON.stringify(self.current));
			break;
	}

	self.current = [];
};


var md = new Markdown();

md.onBreak = function(line) {
	console.log('onBreak', line);
};

md.load('=== js\na\nb\nasda\n===\n\n\n- asd\n- asdasd\n');