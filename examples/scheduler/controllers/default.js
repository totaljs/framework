var counter = 0;

exports.install = function(framework) {
	framework.route('/', view_homepage);

	// This event is triggered every 60 seconds.

	framework.on('service', function() {
		counter++;
	});

	// or

	/*

	setInterval(function() {
		counter++;
	}, 1000);

	*/
};

function view_homepage() {
	this.plain('Scheduler ran: ' + counter);
}