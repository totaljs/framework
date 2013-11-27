// Documentation: http://docs.partialjs.com/FrameworkMail/
var mail = require('partial.js/mail');

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

	// SEND via GMAIL
	// message.send('smtp.gmail.com', { port: 465, secure: true, user: 'ENTER_YOUR_EMAIL', password: 'ENTER_YOUR_PASSWORD' });

	// SEND via AUTH BASIC SMTP
	// message.send('smtp.yourdomain.com', { user: 'ENTER_YOUR_EMAIL', password: 'ENTER_YOUR_PASSWORD' });

	// SEND via SMTP
	// message.send('smtp.yourdomain.com');

	message.send(self.config['mail-smtp'], { user: '', password: '' });
	return true;
};

mail.on('error', function(error, description) {
	console.log('ERROR --->', error, description);
});