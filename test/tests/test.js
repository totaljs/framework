var assert = require('assert');

exports.run = function(framework) {

	framework.assert('validation', function(name, next) {
		assert('1' === '2', name);
		next();
	});

};