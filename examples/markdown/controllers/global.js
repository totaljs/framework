var md = require('partial.js/markdown');
var utils = require('partial.js/utils');
var fs = require('fs');

exports.install = function(framework) {
	framework.route('/', viewMarkdown);
}

function viewMarkdown() {
	
	var self = this;
	var markdown = md.init();
	
	markdown.onLine = function(type, value) {

		switch (type) {
			case '#':
				return '<h1>{0}</h1>'.format(value);
			case '##':
				return '<h2>{0}</h2>'.format(value);
			case '###':
				return '<h3>{0}</h3>'.format(value);
			case '*':
			case '-':
				return '<hr />';
		};

		if (value === '\n')
			return '<br />';

		return value;
	};

	markdown.onLines = function(type, value) {

		switch (type) {
			case 'javascript':
				return '<pre>{0}</pre>'.format(value.join('\n').htmlEncode());
			case '>':
			case '|':
				return '<p>{0}</p>'.format(value.join('<br />'));
		}		
		return '';
	};

	markdown.onUL = function(ul) {

		var builder = [];
		builder.push('<ul>');

		ul.forEach(function(o) {
			builder.push('<li>{0}</li>'.format(o.value).indent(4));
		});

		builder.push('</ul>');

		return builder.join('\n');
	};

	markdown.onLink = function(name, url) {
		return '<a href="{0}">{1}</a>'.format(url.indexOf('http') === -1 ? 'http://' + url : url, name);
	};

	markdown.onFormat = function(type, value) {

		switch (type) {
			case '__':
				return '<strong>{0}</strong>'.format(value);
			case '_':
				return '<b>{0}</b>'.format(value);
			case '**':
				return '<em>{0}</em>'.format(value);
			case '*':
				return '<i>{0}</i>'.format(value);
		};

		return '';
	};

	markdown.onImage = function(alt, url, width, height) {
		return '<img src="{0}" width="{1}" height="{2}" alt="{3}" />'.format(url, width, height, alt);
	};

	markdown.onKeyword = function(type, name, value) {

		switch (name) {
			case '[]':
			case '{}':
				return '<span>{0}</span>'.format(name);
		}

		return '';
	};

	fs.readFile(self.pathPublic('readme.md'), function(err, data) {
		
		if (err) {
			self.view404();
			return;
		}

		self.view('reader', { body: markdown.load(data.toString()) });
	});
}