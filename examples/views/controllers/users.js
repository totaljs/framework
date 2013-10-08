exports.install = function(framework) {
	framework.route('/users/', view_users);
};

function view_users() {
	var self = this;
	self.repository.title = 'Users';

	// this view is loaded by the controller name: /views/users/index.html
	self.view('index');
}