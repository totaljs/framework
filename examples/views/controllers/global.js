var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
	this.route('/new/', viewHomepage2);
};

function viewHomepage() {
	var self = this;
	self.repository.title = 'Welcome';
	self.view('homepage');
}

function viewHomepage2() {
	var self = this;
	self.layout('_layout_new');
	self.repository.title = 'Welcome';
	self.view('homepage');
}