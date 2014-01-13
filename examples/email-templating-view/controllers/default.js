exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {
	var self = this;

	self.framework.mail('petersirka@gmail.com', 'Email subject', self.view('email', null, true));
	self.plain('mail');
}