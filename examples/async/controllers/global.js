var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
	this.route('/', viewHomepage, ['xhr']);
};

function viewHomepage() {
	var self = this;
	var builder = [];
	
	self.wait(function() {
		utils.request('https://www.google.com', 'GET', null, function(err, data) {
			var output = err ? 'error' : data.length.toString();
			builder.push('www.google.com -> ' + output);

			// skip next steps?
			// self.skip(2);

			self.next();
		});
	});

	self.wait(function() {
		utils.request('https://www.github.com', 'GET', null, function(err, data) {
			var output = err ? 'error' : data.length.toString();
			builder.push('www.github.com -> ' + output);

			// skip next?
			// self.skip();

			self.next();
		});
	});

	self.wait(function() {
		utils.request('http://www.yahoo.com', 'GET', null, function(err, data) {
			var output = err ? 'error' : data.length.toString();
			builder.push('www.yahoo.com -> ' + output);
			self.next();
		});
	});

	/*
		self.completed(function() {
			self.view('homepage', builder);
		});

		or ...
	*/

	if (self.xhr)
		self.jsonAsync(builder);
	else
		self.viewAsync('homepage', builder);
}