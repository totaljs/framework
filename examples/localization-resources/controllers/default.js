exports.install = function(framework) {
	framework.route('/', view_auto);
	framework.route('/en/', view_EN);
	framework.route('/sk/', view_SK);
	framework.route('/cz/', view_CZ);
	framework.route('/{language}/message/', view_message, ['xhr']);
};

function view_auto() {
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

function view_SK() {
	var self = this;
	self.repository.title = 'Vitajte';
	self.view('homepage-sk');
}

function view_CZ() {
	var self = this;
	self.repository.title = 'Vítejte';
	self.view('homepage-cz');
}

function view_EN() {
	var self = this;
	self.repository.title = 'Welcome';
	self.view('homepage-en');
}

function view_message(language) {
	var self = this;
	self.json({ message: self.resource(language, 'message') });
}