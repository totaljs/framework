var assert = require('assert');

exports.priority = 1;
exports.disabled = false;

exports.run = function(framework) {

	// framework.assert(name, url, flags, callback, [data], [cookies], [headers]);
	framework.assert('Test URL 1', '/relative-url/', ['delete'], function (err, data, code, headers, cookies, name) {
		assert.ok(code === 200 && data === '1', name);
	});

	// framework.assert(name, delegate(next, name));
	framework.assert('Test methods', function(next, name) {
		assert.ok('1' !== '1', name);
		next();
	});
};