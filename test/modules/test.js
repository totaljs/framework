var assert = require('assert');
var app;

exports.install = function(framework) {
	app = framework;
	assert.ok(typeof(framework.modules) === 'object', 'module install');
};

exports.message = function() {
	return 'message';
};