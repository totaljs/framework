var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;
	var builder = [];
	
	self.wait(function() {
		utils.request('https://www.google.com', 'GET', null, function(err, data) {
			var output = err ? 'error' : data.length.toString();
			builder.push('www.google.com -> ' + output);
			self.next();
		});
	});

	self.wait(function() {
		utils.request('https://www.github.com', 'GET', null, function(err, data) {
			var output = err ? 'error' : data.length.toString();
			builder.push('www.github.com -> ' + output);
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

	self.wait(function() {
		utils.request('https://www.facebook.com', 'GET', null, function(err, data) {
			var output = err ? 'error' : data.length.toString();
			builder.push('www.facebook.com -> ' + output);
			self.next();
		});
	});

	self.viewAsync('homepage', builder);
}