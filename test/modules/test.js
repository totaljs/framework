var assert = require('assert');
var app;

exports.install = function(framework) {
	app = framework;
	assert.ok(typeof(framework.modules) === 'object', 'module install');

    setTimeout(function() {
        console.log(framework.routes);
        assert.ok(MODULE('inline-view').installed, 'module install dependencies');
    }, 3000);
};

exports.message = function() {
	return 'message';
};

exports.usage = function(detailed) {
	return 'usage';
};