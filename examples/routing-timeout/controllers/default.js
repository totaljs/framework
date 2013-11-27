exports.init = function(framework) {

	// Documentation: http://docs.partialjs.com/Framework/#framework.route
	framework.route('/', timeout);

	framework.route('/quick/', timeout, { timeout: 100 });

	// Request timeout
	framework.route('#408', view_408)
}

function timeout() {
	// I forgotten to call a view()
}

function view_408() {
	this.plain('RESPONSE TIMEOUT');
}