exports.install = function(framework) {

	framework.route('/', plain_homepage);
	framework.route('/order/', post_order, ['post']);

};

function plain_homepage() {
	var self = this;

	// send test request to /order/
	utils.request(self.host('/order/'), 'POST', 'firstname=Peter&lastname=Sirka&email=petersirka@gmail.com&telephone=0903163302&address=&inject=1&inject=2&param=custom');

	self.plain('Show node.js console');
}

function post_order() {
	var self = this;

	// validate request data
	var validation = self.validate(self.post, 'order', 'prefix_');

	// prepare request data into the model
	var model = builders.prepare('order', self.post);

	console.log('Request data:\n', self.post);
	console.log('');

	if (validation.hasError()) {
		console.log('Validation:\n', validation.json());
		console.log('');
	}

	// I'm adding additional information
	model.ip = self.ip;

	console.log('Model:\n', model);
	console.log('');

	console.log('Create default contactform schema:\n', builders.defaults('contactform'));
	console.log('');

	self.empty();
}