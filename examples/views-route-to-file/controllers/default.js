exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/sub/', view_subpage);
};

function view_homepage() {
	var self = this;
	self.view('homepage');
}

function view_subpage() {

	var self = this;

	// set default image path
	self.currentImage('products');
	self.view('subpage');	
};