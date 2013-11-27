exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/xhr/', xhr_panel, ['xhr', 'post']);
};

function view_homepage() {
	var self = this;
	self.view('company');
}

function xhr_panel() {
	var self = this;
	self.view(self.post.choice);
}