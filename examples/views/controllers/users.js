exports.install = function(framework) {
	framework.route('/users/', view_users);
	framework.route('/users/admin/', view_users_admin);
};

function view_users() {
	var self = this;
	self.repository.title = 'Users';

	// this view is loaded by the controller name: /views/users/index.html
	self.view('index');
}

function view_users_admin() {
	var self = this;
	self.repository.title = 'Admin';
	self.view('~admin');
}