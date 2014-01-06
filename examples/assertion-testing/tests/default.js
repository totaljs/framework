var assert = require('assert');

exports.run = function(framework, name) {

	console.log('run test: {0}'.format(name));
	console.log('');

	// Documentation: http://docs.partialjs.com/Framework/#framework.assert
	
	framework.assert('Test URL 1', '/1/', function(error, data, name, code, headers) {
		assert.ok(code === 200 && data === '1', name);
		console.log('1');
	});

	framework.assert('Test URL 2', '/2/', function(error, data, name, code, headers) {
		assert.ok(code === 200 && data === '2', name);
		console.log('2');
	});

	framework.assert('Test URL 3', '/3/', function(error, data, name, code, headers) {
		// throw error, data === 4
		assert.ok(code === 200 && data === '3', name);
		console.log('3');
	});
};