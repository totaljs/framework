var urlParser = require('url');
var http = require('http');
var tls = require('tls');
var https = require('https');
var util = require('util');
var path = require('path');
var utils = require('../utils');
var exec = require('child_process').exec;
var sys = require('sys');
var Image = require('../image');
var fs = require('fs');
var events = require('events');
var crypto = require('crypto');
var framework = require('../index');
var ENCODING = 'utf8';
var UNDEFINED = 'undefined';
var STRING = 'string';
var FUNCTION = 'function';
var NUMBER = 'number';
var OBJECT = 'object';
var BOOLEAN = 'boolean';

function view_parse(content) {

	var builder = '';
	var command = view_find_command(content, 0);

	if (command === null) {
		builder.push(content);
		return builder;
	}

	var old = null;
	var condition = 0;
	var is = false;

	while (command !== null) {

		if (condition === 0 && builder !== '')
			builder += '+';

		if (old !== null) {
			var text = content.substring(old.end + 1, command.beg).replace(/\n/g, '');
			if (text !== '') {
				if (view_parse_plus(builder))
					builder += '+';
				builder += '\'' + text + '\'';
			}
		}

		var cmd = content.substring(command.beg + 2, command.end);

		if (cmd.substring(0, 3) === 'if ') {
			if (view_parse_plus(builder))
				builder += '+';
			condition = 1;
			builder += '(' + cmd.substring(3) + '?';
			is = true;
		} else if (cmd === 'else') {
			condition = 2;
			builder += ':';
			is = true;
		} else if (cmd === 'endif') {

			if (condition === 1)
				builder += ':\'\'';
			condition = 0;
			builder += ')';
			is = true;
		} else {
			if (view_parse_plus(builder))
				builder += '+';
			builder += view_prepare(command.command);
		}

		if (!is) {

		}

		old = command;
		command = view_find_command(content, command.end);
	}

	if (old !== null) {
		var text = content.substring(old.end + 1).trim();
		if (text.length > 0)
			builder += '+\'' + text + '\'';
	}

	console.log(builder);
	return builder;
}

function view_parse_plus(builder) {
	var c = builder[builder.length - 1];
	if (c !== '!' && c !== '?' && c !== '+' && c !== '.' && c !== ':')
		return true;
	return false;
}

function view_prepare(command) {

	var a = command.indexOf('.');
	var b = command.indexOf('(');
	var c = command.indexOf('[');

	if (a === -1)
		a = b;

	if (b === -1)
		b = a;

	if (a === -1)
		a = c;

	if (b === -1)
		b = c;

	var index = Math.min(a, b);
	var name = command.substring(0, index);

	switch (name) {
		case 'repository':
		case 'model':
		case 'get':
		case 'post':
		case 'global':
		case 'session':
		case 'user':
		case 'config':
			return '(' + command + ' || \'\').toString().encode()';
		case '!repository':
		case '!model':
		case '!get':
		case '!post':
		case '!global':
		case '!session':
		case '!user':
		case '!config':
			return '(' + command.substring(1) + ' || \'\')';

		case 'options':
		case 'readonly':
		case 'selected':
		case 'disabled':
		case 'checked':
		case 'etag':
		case 'modified':
		case 'image':
		case 'download':
		case 'json':
		case 'dns':
		case 'header':
		case 'prefetch':
		case 'prerender':
		case 'next':
		case 'prev':
		case 'canonical':
		case 'currentJS':
		case 'currentCSS':
		case 'currentImage':
		case 'currentDownload':
		case 'currentVideo':
		case 'currentView':
		case 'currentTemplate':
		case 'currentContent':
		case 'layout':
			return 'self.$' + command;
	}

	return command;
}

function view_find_command(content, index) {

	var index = content.indexOf('@{', index);
	if (index === -1)
		return null;

	var length = content.length;
	var count = 0;

	for (var i = index; i < length; i++) {
		var c = content[i];

		if (c === '{') {
			count++;
			continue;
		}

		if (c !== '}')
			continue;

		return { beg: index, end: i, command: content.substring(index + 2, i).trim() };
	}

	return null;
}

view_parse(fs.readFileSync('views/parse.html').toString());