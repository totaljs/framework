exports.onLoaded = function() {

	var self = this;

	// partial - global
	self.partial(function(complete) {

		// this partial content will be executed every request to the controller
		// this === controller

		var self = this;
		self.repository.A = 'partial - global';

		complete();
	});

	// partial - private
	self.partial('B', function(complete) {

		// this partial content will be executed if "controller routing" will contains @partial ['B']
		// this === controller
		var self = this;
		self.repository.B = 'partial - private - B';

		complete();
	});

	// partial - private
	self.partial('C', function(complete) {

		// this partial content will be executed if "controller routing" will contains @partial ['C']
		// this === controller
		var self = this;
		self.repository.C = 'partial - private - C';

		complete();
	});

};