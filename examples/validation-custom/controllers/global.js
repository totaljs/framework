var utils = require('partial.js/utils');
var builders = require('partial.js/builders');

exports.init = function() {
	var self = this;
	self.route('/', viewHomepage);
	self.route('/', viewHomepage, ['xhr', 'post']);
};

function viewHomepage() {
	var self = this;
	
	if (!self.isXHR) {
		self.repository.title = 'Validation example';
		self.view('homepage', { LoginName: '@' });
		return;
	}

	var resource = function(name) {
		return self.resource('en', name);
	};

	var errorBuilder = new builders.ErrorBuilder(resource);

	// Documentation: http://www.partialjs.com/documentation/utils/
	if (utils.validation(self.post, ['FirstName', 'LastName', 'Age', 'Email', 'Terms'], onValidation, errorBuilder).hasError()) {
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