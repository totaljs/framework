exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/', view_homepage, ['xhr', 'post']);
};

function view_homepage() {
	var self = this;
	
	if (!self.xhr) {
		self.meta('Validation example');
		self.view('homepage', { LoginName: '@' });
		return;
	}

	/*
		Global validation
		@model {Object}
		@properties {String array}
		@prefix :: optional, default empty
		@resource name :: optional, default = default.resource
		return {ErrorBuilder}
	*/
	var result = self.validate(self.post, ['FirstName', 'LastName', 'Age', 'Email', 'Terms'], 'Form');
	if (result.hasError()) {
		result.replace('Email', self.post.Email);
		self.json(result);
		return;
	}

	self.json({ r: true });
}