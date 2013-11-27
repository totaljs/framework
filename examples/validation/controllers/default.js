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

	// Look here: https://github.com/petersirka/partial.js/tree/master/examples/framework-schema
	// Documentation: http://docs.partialjs.com/FrameworkController/#controller.validate
	var result = self.validate(self.post, ['FirstName', 'LastName', 'Age', 'Email', 'Terms'], 'Form');

	// Documentation: http://docs.partialjs.com/Builders.ErrorBuilder/
	if (result.hasError()) {		
		result.replace('@Email', self.post.Email);
		self.json(result);
		return;
	}

	self.json({ r: true });
}