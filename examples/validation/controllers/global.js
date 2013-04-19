var utils = require('partial.js/utils');
var builders = require('partial.js/builders');

exports.install = function(framework) {
	framework.route('/', viewHomepage);
	framework.route('/', viewHomepage, ['xhr', 'post']);
};

function viewHomepage() {
	var self = this;
	
	if (!self.isXHR) {
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
		self.json(result);
		return;
	}

	self.json({ r: true });
}