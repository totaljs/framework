var framework = require('partial.js');
var mail = require('partial.js/mail');
var http = require('http');

var port = 8004;
var debug = true;

framework.run(http, debug, port);

framework.mail = function(email, subject, html) {

	var self = this;

	if (subject.length === 0 || html.length === 0)
		return false;

	// partial.js +v1.2.4-4
	var message = new mail.Message(subject, html);

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

console.log("http://{0}:{1}/".format(framework.ip, framework.port));