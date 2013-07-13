exports.install = function(framework) {
	framework.route('/', view_form);
	framework.route('/', json_form, ['xhr', 'post']);
};

function view_form() {
	this.view('form', { Email: '@' });
}

function json_form() {
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
