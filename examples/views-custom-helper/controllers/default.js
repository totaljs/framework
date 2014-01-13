var utils = require('partial.js/utils');

exports.install = function(framework) {
	framework.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;
	self.view('homepage', { name: "Peter Sirka" });
}