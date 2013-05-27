var utils = require('partial.js/utils');

exports.install = function(framework) {
	framework.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;

	// append <script type="text/javascript" src="test.js"></script> to head
	self.head('test.js');

	self.view('homepage');
}
