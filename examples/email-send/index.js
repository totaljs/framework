var framework = require('total.js');
var mail = require('total.js/mail');

var message = new mail.Message('Subject', 'Body');

message.to('petersirka@gmail.com');

// message.cc('@');
// message.bcc('@');
// message.reply('@');
// message.attachment('/filename.txt', 'name.txt');

message.from('sirka@wsd-europe.com', 'Janko Hrasko');

mail.on('error', function (err) {
	console.log(err);
});

// SEND via GMAIL
// message.send('smtp.gmail.com', { port: 465, secure: true, user: 'ENTER_YOUR_EMAIL', password: 'ENTER_YOUR_PASSWORD' });

// SEND via AUTH BASIC SMTP
// message.send('smtp.yourdomain.com', { user: 'ENTER_YOUR_EMAIL', password: 'ENTER_YOUR_PASSWORD' });

// SEND via SMTP
// message.send('smtp.yourdomain.com');