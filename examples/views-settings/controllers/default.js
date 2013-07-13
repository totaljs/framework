exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/controller/', view_homepage_controller);
};

function view_homepage() {
	var self = this;
	self.view('homepage');
}

function view_homepage_controller() {
	var self = this;
	
	self.settings('title controller');
	
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