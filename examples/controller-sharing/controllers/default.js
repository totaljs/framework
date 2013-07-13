exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {
	var self = this;

	var users = self.functions('users');
	
	// console.log(self.models('users').users);

	var builder = [];

	builder.push('Exists: Peter = {0}'.format(users.exists('Peter')));
	builder.push('Exists: Jolaus = {0}'.format(users.exists('Jolaus')));
	builder.push('Exists: Lucia = {0}'.format(users.exists('Lucia')));
	builder.push('');
	builder.push('All users: {0}users/'.format(utils.path(self.req.uri.href)));

	self.plain(builder.join('\n'));
}