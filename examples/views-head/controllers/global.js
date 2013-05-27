var utils = require('partial.js/utils');

exports.install = function(framework) {
	framework.route('/', viewHomepage);
	framework.route('/controller/', viewHomepageMetaController);
};

function viewHomepage() {
	var self = this;
	self.view('homepage');
}

function viewHomepageMetaController() {
	var self = this;
	
	self.meta('title controller', 'description controller', 'keywords controller');
	
	// self.meta('title controller', 'description controller', 'meta image_src');
	//
	// you can write own meta render
	//
	// framework.onMeta = function() {
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