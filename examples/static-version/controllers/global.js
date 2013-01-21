var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;
	self.repository.title = 'Welcome';
	self.view('homepage');
}