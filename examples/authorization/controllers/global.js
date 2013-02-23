var utils = require('partial.js/utils');
var builders = require('partial.js/builders');

exports.init = function() {
	var self = this;
	self.route('/', viewIsLogged, ['logged']);
	self.route('/', viewHomepage, ['unlogged']);
	self.route('/', viewHomepage, ['unlogged', 'xhr', 'post']);
};

function viewIsLogged() {
	var self = this;
	self.plain('You are logged as {0} ({1}x). To unlogged remove cookie __user'.format(self.session.email, self.session.countLogin));
}

function viewHomepage() {
	var self = this;
	
	if (!self.xhr) {
		self.view('homepage', { LoginName: '@' });
		return;
	}

	var resource = function(name) {
		return self.resource(name);
	};

	var errorBuilder = new builders.ErrorBuilder(resource);

	if (utils.validation(self.post, ['LoginName', 'LoginPassword'], onValidation, errorBuilder).hasError()) {
		self.json(errorBuilder);
		return;
	}

	var db = self.database('users');
	var query = new builders.QueryBuilder();

	query.addValue('email', '=', self.post.LoginName).addOperator('AND').addValue('password', '=', self.post.LoginPassword.toSHA1());
	
	db.findOne('tbl_user', query, function(err, user) {

		if (user === null) {
			errorBuilder.add('LoginError');
			self.json(errorBuilder);
			return;
		}

		// save to cookie
		self.res.cookie(self.config.cookie, self.app.encode({ id: user.id, ip: self.req.ip }, 'user'), new Date().add('m', 5));

		// return result
		self.json({ r: true });
	});
}

function onValidation(name, value) {
	switch (name) {
		case 'LoginName':
			return utils.isEmail(value);
		case 'LoginPassword':
			return value.length > 0;
	};
}