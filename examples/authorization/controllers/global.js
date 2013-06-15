var utils = require('partial.js/utils');
var builders = require('partial.js/builders');

exports.install = function(framework) {
	framework.route('/', viewIsLogged, ['logged']);
	framework.route('/', viewHomepage, ['unlogged']);
	framework.route('/', viewHomepage, ['unlogged', 'xhr', 'post']);
	framework.route('/logout', logout, ['logged', 'get']);
};

function viewIsLogged() {
	var self = this;
	self.plain('You are logged as {0}. To unlogged remove cookie __user or click <a href="/logout">logout</a>.'.format(self.session.email));
}

function viewHomepage() {
	var self = this;
	
	if (!self.xhr) {
		self.view('homepage', { LoginName: '@' });
		return;
	}

	var errorBuilder = self.validate(self.post, ['LoginName', 'LoginPassword']);

	if (errorBuilder.hasError()) {
		self.json(errorBuilder);
		return;
	}

	var db = self.database('users');
	var filter = function(o) { return o.email === self.post.LoginName && o.password == self.post.LoginPassword; };

	db.one(filter, function(user) {

		if (user === null) {
			errorBuilder.add('LoginError');
			self.json(errorBuilder);
			return;
		}

		self.database('users-logs').insert({ id: user.id, email: user.email, ip: self.req.ip, date: new Date() });

		// save to cookie
		self.res.cookie(self.config.cookie, self.app.encode({ id: user.id, ip: self.req.ip }, 'user'), new Date().add('m', 5));

		// return result
		self.json({ r: true });		
	});

}

function logout() {
	var self = this;

	self.res.cookie(self.config.cookie, self.app.encode({ id: self.session.id, ip: self.req.ip }, 'user'), new Date());
	self.redirect('/');
}