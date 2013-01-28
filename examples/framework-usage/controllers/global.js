var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;

	// self.app.usage([detailed:bool default false])
	self.plain(self.app.usage());
}