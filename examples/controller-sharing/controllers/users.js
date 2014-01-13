exports.install = function(framework) {
	framework.route('/users/', view_users);
};

exports.models = {
	users: ['Peter', 'Lucia', 'Zuzana', 'Veronika']
};

exports.functions = {
	exists: function(name) {
		return exports.models.users.indexOf(name) > -1;
	}
};

function view_users() {
	this.json(exports.models.users);
}