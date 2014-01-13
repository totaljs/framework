exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {
	var self = this;
	self.repository.title = 'Mobile version example';
	self.view('homepage');
}
