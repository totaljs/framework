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