var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
	this.route('/controller/', viewHomepageSettingsController);
};

function viewHomepage() {
	var self = this;
	self.view('homepage');
}

function viewHomepageSettingsController() {
	var self = this;
	
	self.settings('title');
	
	// you can write own settings render
	//
	// framework.onSettings = function() {
	//    arguments.forEach(function(o) {
	//       ...
	//	  });
	//    return '<title>HA HA HA</title>';
	// };
	//
	// ===========================================================================
	// look at example: framework-custom
	// ===========================================================================

	self.view('homepage-controller');
}