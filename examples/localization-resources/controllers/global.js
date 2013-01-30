var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewAuto);
	this.route('/en/', viewEN);
	this.route('/sk/', viewSK);
	this.route('/cz/', viewCZ);
	this.route('/{language}/message/', viewMessage, ['xhr']);
};

function viewAuto() {
	var self = this;
	
	var language = (self.req.headers['accept-language'].split(';')[0].split(',')[0] || 'en').toLowerCase();
	var lng = '';

	if (language.indexOf('sk') > -1)
		lng = 'sk';
	else if (language.indexOf('cz') > -1)
		lng = 'cz';
	else if (language.indexOf('en') > -1)
		lng = 'en';

	//self.view('homepage-{0}'.format(lng));
	self.redirect('/{0}/'.format(lng));
}

function viewSK() {
	var self = this;
	self.repository.title = 'Vitajte';
	self.view('homepage-sk');
}

function viewCZ() {
	var self = this;
	self.repository.title = 'Vítejte';
	self.view('homepage-cz');
}

function viewEN() {
	var self = this;
	self.repository.title = 'Welcome';
	self.view('homepage-en');
}

function viewMessage(language) {
	var self = this;
	self.json({ message: self.resource(language, 'message') });
}