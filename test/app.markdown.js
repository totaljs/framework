global.utils = require('../utils');

var assert = require('assert');
var markdown = require('../markdown').init();

assert.ok(markdown.load('> 1\n> 2') === '<p class="paragraph">1<br />2</p>', 'paragraph > parser error');
assert.ok(markdown.load('| 1\n| 2') === '<p class="paragraph">1<br />2</p>', 'paragraph | parser error');
assert.ok(markdown.load('// 1\n// 2') === '<p class="paragraph">1<br />2</p>', 'paragraph // parser error');
assert.ok(markdown.load('- 1\n- 2') === '<ul><li>1</li><li>2</li></ul>', 'ul parser error');
assert.ok(markdown.load('kontrola obrazka ![Test](http://google.sk/logo.png#300x200) a neviem ...') === '<p>kontrola obrazka <img src="http://google.sk/logo.png" width="300" height="200" alt="Test" border="0" /> a neviem ...</p>', 'img parser error');
assert.ok(markdown.load('kontrola obrazka ![Test](http://google.sk/logo.png#300x200)(www.google.sk) a neviem ...') === '<p>kontrola obrazka <a href="www.google.sk"><img src="http://google.sk/logo.png" width="300" height="200" alt="Test" border="0" /></a> a neviem ...</p>', 'img url parser error');
assert.ok(markdown.load('kontrola obrazka [![Test](http://google.sk/logo.png#300x200)](www.google.sk) a neviem ...') === '<p>kontrola obrazka <a href="www.google.sk"><img src="http://google.sk/logo.png" width="300" height="200" alt="Test" border="0" /></a> a neviem ...</p>', 'img url parser error');
assert.ok(markdown.load('<www.google.sk> a [Google.sk]: http://google.sk. [partial.js](www.partialjs.com)') === '<p><a href="http://www.google.sk">www.google.sk</a> a <a href="http://google.sk">Google.sk</a>. <a href="http://www.partialjs.com">partial.js</a></p>', 'link parser');
assert.ok(markdown.load('*kurziva* __bold__') === '<p><i>kurziva</i> <strong>bold</strong></p>', 'format parser error');
assert.ok(markdown.load('test test [Test] a {Test}') === '<p>test test <span>Test</span> a <span>Test</span></p>', 'keyword parser error');

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');