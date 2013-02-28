var utils = require('partial.js/utils');

exports.install = function(framework) {
	framework.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;
	self.repository.title = 'Templates';
	self.view('homepage');
}