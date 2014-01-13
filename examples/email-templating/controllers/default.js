exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {
	var self = this;

	// self.framework.mail('petersirka@gmail.com', 'hello', { name: 'Peter' });
	self.framework.mail('petersirka@gmail.com', 'registration', { firstName: 'Peter', lastName: 'Sirka', age: 28 });
	self.plain('mail');
}