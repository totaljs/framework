var utils = require('partial.js/utils');
var builders = require('partial.js/builders');

exports.init = function() {
	this.route('/', viewIsLogged, ['logged']);
	this.route('/', viewHomepage, ['unlogged']);
	this.route('/', viewHomepage, ['unlogged', 'xhr', 'post']);
};

function viewIsLogged() {
	this.plain('You are logged. To unlogged remove cookie __user');
}

function viewHomepage() {
	var self = this;
	
	if (!self.isXHR) {
		self.repository.title = 'Login example';
		self.layout('');
		self.view('homepage', { LoginName: '@' });
		return;
	}

	var resource = function(name) {
		return self.resource('en', name);
	};

	var errorBuilder = new builders.ErrorBuilder(resource);

	if (utils.validation(self.post, ['LoginName', 'LoginPassword'], onValidation, errorBuilder).hasError()) {
		self.json(errorBuilder);
		return;
	}

	var db = self.app.db();
	
	db.view('admin', 'users', { key: self.post.LoginName }, function(err, data) {

		if (err) {
			errorBuilder.add('LoginName');
			self.json(errorBuilder);
			return;
		}

		var user = data.rows[0];

		if (user.value.password != self.post.LoginPassword.toSHA1()) {
			errorBuilder.add('LoginError');
			self.json(errorBuilder);
			return;
		}
		
		self.res.cookie(self.options.cookie, self.app.stringEncode({ id: user.value._id, ip: self.req.ip }, 'user'), new Date().add('m', 5));
		self.json({ r: true });
	});
}

function onValidation(name, value) {
	switch (name) {
		case 'LoginName':
			return utils.isValid(utils.isMail(value));
		case 'LoginPassword':
			return utils.isValid(value.length > 0);
	};
}