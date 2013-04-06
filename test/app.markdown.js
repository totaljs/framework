var assert = require('assert');
var markdown = require('../lib/markdown').init();

markdown.onLine = function(type, value) {
	return value;	
};

markdown.onLines = function(type, value) {
	return '<p>' + value.join('') + '</p>';
}

markdown.onUL = function(value) {

	if (this.name === 'TEST')
		return this.name;

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

markdown.onImage = function(alt, src, width, height, url) {
	if (url.length === 0)
		return '<img src="' + src + '" alt="' + alt + '" width="' + width + '" height="' + height + '" />';
	return '<a href="' + url + '"><img src="' + src + '" alt="' + alt + '" width="' + width + '" height="' + height + '" /></a>';
};

assert.ok(markdown.load('> 1\n> 2') === '<p>12</p>', 'paragraph > parser error');
assert.ok(markdown.load('| 1\n| 2') === '<p>12</p>', 'paragraph | parser error');
assert.ok(markdown.load('// 1\n// 2') === '<p>12</p>', 'paragraph // parser error');
assert.ok(markdown.load('\\\\ 1\n\\\\ 2') === '<p>12</p>', 'paragraph \\\\ parser error');
assert.ok(markdown.load('- 1\n- 2') === '<ul><li>1</li><li>2</li></ul>', 'ul parser error');
assert.ok(markdown.load('kontrola obrazka ![Test](http://google.sk/logo.png#300x200) a neviem ...') === 'kontrola obrazka <img src="http://google.sk/logo.png" alt="Test" width="300" height="200" /> a neviem ...', 'img parser error');
assert.ok(markdown.load('kontrola obrazka ![Test](http://google.sk/logo.png#300x200)(www.google.sk) a neviem ...') === 'kontrola obrazka <a href="www.google.sk"><img src="http://google.sk/logo.png" alt="Test" width="300" height="200" /></a> a neviem ...', 'img url parser error');
assert.ok(markdown.load('kontrola obrazka [![Test](http://google.sk/logo.png#300x200)](www.google.sk) a neviem ...') === 'kontrola obrazka <a href="www.google.sk"><img src="http://google.sk/logo.png" alt="Test" width="300" height="200" /></a> a neviem ...', 'img url parser error');
assert.ok(markdown.load('<www.google.sk> a [Google.sk]: http://google.sk. [partial.js](www.partialjs.com)') === '<a href="www.google.sk">www.google.sk</a> a <a href="http://google.sk">Google.sk</a>. <a href="www.partialjs.com">partial.js</a>', 'link parser');
assert.ok(markdown.load('*kurziva* __bold__') === '<i>kurziva</i> <b>bold</b>', 'format parser error');
assert.ok(markdown.load('test test [Test] a {Test}') === 'test test <span>Test</span> a <span>Test</span>', 'keyword parser error');
assert.ok(markdown.load('- 1\n- 2', 'TEST') === 'TEST', 'name parameter');

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');