var assert = require('assert');

exports.run = function(framework) {

	framework.assert('validation', function(name) {
		assert('1' === '2', name);
	});

};