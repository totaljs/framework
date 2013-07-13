exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/new/', view_homepage2);
};

function view_homepage() {
	var self = this;
	self.repository.title = 'Welcome';
	self.view('homepage');
}

function view_homepage2() {
	var self = this;
	self.layout('_layout_new');
	self.repository.title = 'Welcome';
	self.view('homepage');
}