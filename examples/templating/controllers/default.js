exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {
	var self = this;
	self.repository.title = 'Templates';
	self.view('homepage');
}