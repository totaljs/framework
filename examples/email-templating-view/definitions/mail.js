// Documentation: http://docs.totaljs.com/FrameworkMail/
var mail = require('total.js/mail');

framework.mail = function(email, subject, html) {

	var self = this;

	if (subject.length === 0 || html.length === 0)
		return false;

	var message = new mail.Message(subject, html);

	// message.subject;
	// message.body;

	message.from(self.config['mail-from'], self.config['mail-from-name']);
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