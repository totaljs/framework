var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;

	//self.app.mail('petersirka@gmail.com', 'hello', { name: 'Peter' });
	self.app.mail('petersirka@gmail.com', 'registration', { firstName: 'Peter', lastName: 'Sirka', age: 28 });
	self.plain('mail');
}