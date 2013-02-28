exports.install = function(framework) {
	framework.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;
	self.repository.title = 'Mobile version example';
	self.view('homepage');
}
