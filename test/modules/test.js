var assert = require('assert');
var app;

exports.install = function() {
	app = framework;
	assert.ok(typeof(framework.modules) === 'object', 'module install');

	setTimeout(function() {
		assert.ok(MODULE('inline-view').installed, 'module install dependencies');
	}, 3000);
};

exports.message = function() {
	return 'message';
};

exports.usage = function(detailed) {
	return 'usage';
};