var assert = require('assert');
var utils = require('../lib/utils');
var cache = require('../lib/cache').init({});

cache.init(100);

cache.write('NAME', 'VALUE', new Date().add('s', 5));
cache.write('REMOVE', 'VALUE', new Date().add('s', 10));
cache.write('EXPIRE', 'VALUE', new Date().add('s', 5));
assert.ok(cache.repository['NAME'] && cache.repository['NAME'].value === 'VALUE', 'cache write');
assert.ok(cache.read('NAME') === 'VALUE', 'cache read');
assert.ok(cache.read('FET') === null, 'cache read (null)');

cache.remove('REMOVE');
assert.ok(cache.read('REMOVE') === null, 'cache remove');

cache.setExpires('EXPIRE', new Date().add('m', 1));

cache.on('service', function (runner) {
	assert.ok(!cache.repository['NAME'], 'cache expiration');
	assert.ok(cache.read('EXPIRE') === 'VALUE', 'cache no-expiration');
	console.log('================================================');
	console.log('success - OK');
	console.log('================================================');
	console.log('');
	cache.stop();
});