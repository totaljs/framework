var utils = require('partial.js/utils');
var builders = require('partial.js/builders');

exports.install = function(framework) {
	framework.route('/', viewForm);
	framework.route('/', jsonForm, ['xhr', 'post']);
};

function viewForm() {
	this.view('form', { Email: '@' });
}

function jsonForm() {
	var self = this;
	
	var error = self.validate(self.post, ['Email', 'Message'])

	if (error.hasError()) {
		self.json(error);
		return;
	}

	// save to database

	self.post.date = new Date();
	self.post.ip = self.req.ip;

	var db = self.database('forms');
	db.insert(self.post);

	// send mail
	// look to example: [email-templating]
	self.json({ r: true });
}
