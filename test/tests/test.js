var assert = require('assert');

exports.run = function(framework) {

	framework.assert('validation', function(name, next) {
		assert('1' === '2', name);
		next();
	});

	framework.assert('/', ['GET'], function(error, data, code, headers, cookies, name) {
		assert.ok(code === 200, name);
	});

};