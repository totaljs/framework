exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/', view_homepage, ['xhr', 'post']);
};

function view_homepage() {
	var self = this;
	
	if (!self.isXHR) {
		self.repository.title = 'Validation example';
		self.view('homepage', { LoginName: '@' });
		return;
	}

	var resource = function(name) {
		return self.resource('en', name);
	};

	// Documentation: http://docs.partialjs.com/Builders.ErrorBuilder/
	var errorBuilder = new builders.ErrorBuilder(resource);

	// Documentation: http://docs.partialjs.com/FrameworkUtils/#utils.validate
	if (utils.validate(self.post, ['FirstName', 'LastName', 'Age', 'Email', 'Terms'], onValidation, errorBuilder).hasError()) {
		self.json(errorBuilder);
		return;
	}

	self.json({ r: true });
}

function onValidation(name, value) {
	switch (name) {
		case 'Email':
			return utils.isEmail(value);
		case 'Age':
			return utils.isValid(utils.parseInt(value) > 0, 'Fill fucking age');
		case 'Terms':
			return value === '1';
		case 'FirstName':
		case 'LastName':
			return value.length > 0;
	};
}