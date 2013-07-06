var framework = require('partial.js');
var mail = require('partial.js/mail');
var http = require('http');

var port = 8004;
var debug = true;

framework.run(http, debug, port);

framework.mail = function(email, name, params) {

	var self = this;
	
	var subject = '';

	switch (name) {
		case 'hello':
			subject = 'Hello!';
			break;
		case 'registration':
			subject = 'New registration';
			break;
	}

	if (subject.length === 0)
		return false;

	var body = self.resource('en', 'mail-' + name, '');
	var template = self.resource('en', 'mail', '').replace('{body}', body.params(params));

	// OLD VERSION partial.js
	// mail.send(self.config['mail-smtp'], self.config['mail-from'], email, null, subject, template, self.config['mail-from-name']);

	// partial.js +v1.2.4-4
	var message = new mail.Message(subject, template);

	// message.subject;
	// message.body;

	message.sender(self.config['mail-from'], self.config['mail-from-name']);
	message.to(email);

	// message.cc('@');
	// message.bcc('@');
	// message.reply('@');
	// message.attachmet('/users/desktop/petersirka/filename.txt', 'name.txt');
	// message.send(smtp, options);

	message.send(self.config['mail-smtp'], { user: '', password: '' });
	return true;
};

mail.on('error', function(error, description) {
	console.log('ERROR --->', error, description);
});

console.log("http://127.0.0.1:{0}/".format(port));