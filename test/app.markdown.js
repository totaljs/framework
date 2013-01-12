var assert = require('assert');

var markdown = require('../lib/markdown').init();


markdown.onLine = function(type, value) {
	return value;	
};

markdown.onLines = function(type, value) {
	return '<p>' + value.join('') + '</p>';
}

markdown.onUL = function(value) {

	var buffer = [];
	value.forEach(function(o) {
		buffer.push('<li>' + o.value + '</li>');
	});

	return '<ul>' + buffer.join('') + '</ul>';
};

markdown.onLink = function(name, url) {
	return '<a href="' + url + '">' + name + '</a>';
};

markdown.onKeyword = function(type, name, value) {
	return '<span>' + name + '</span>';
};

markdown.onFormat = function(type, value) {
	
	if (type[0] === '*')
		return '<i>' + value + '</i>';	

	return '<b>' + value + '</b>';

};

markdown.onImage = function(alt, url, width, height) {
	return '<img src="' + url + '" alt="' + alt + '" widht="' + width + '" height="' + height + '" />';
};

assert.ok(markdown.load('> 1\n> 2') == '<p>12</p>', 'paragraph parser error');
assert.ok(markdown.load('| 1\n| 2') == '<p>12</p>', 'paragraph parser error');
assert.ok(markdown.load('- 1\n- 2') == '<ul><li>1</li><li>2</li></ul>', 'ul parser error');
assert.ok(markdown.load('kontrola obrazka ![Test](http://google.sk/logo.png#300x200) a neviem ...') == 'kontrola obrazka <img src="http://google.sk/logo.png" alt="Te" widht="300" height="200" /> a neviem ...', 'img parser error');
assert.ok(markdown.load('<www.google.sk> a [Google.sk]: http://google.sk.') == '<a href="www.google.sk">www.google.sk</a> a <a href="http://google.sk">Google.sk</a>.', 'ul parser error');
assert.ok(markdown.load('*kurziva* __bold__') == '<i>kurziva</i> <b>bold</b>', 'format parser error');
assert.ok(markdown.load('test test [Test] a {Test}') == 'test test <span>Test</span> a <span>Test</span>', 'keyword parser error');

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');