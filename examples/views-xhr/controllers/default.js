exports.install = function(framework) {
	framework.route('/', landingPage);
	framework.route('/loadPanel', loadPanel, ['xhr']);
};

function landingPage() {
	var self = this;
	self.view('company');
}

function loadPanel() {
	var self = this;
	self.view(self.post.choice);
}