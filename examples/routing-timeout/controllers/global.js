var utils = require('partial.js/utils');

exports.init = function(framework) {

	// timeout by framework.config['default-request-timeout']
	framework.route('/', timeout);

	// @url, @fn, @flags, @length, @partial, @timeout
	framework.route('/quick/', timeout, [], null, [], 100);

	// Request timeout
	framework.route('#408', view_408)
}

function timeout() {
	// I forgotten to call a view()
}

function view_408() {
	this.plain('REQUEST TIMEOUT');
}