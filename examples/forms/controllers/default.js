exports.install = function(framework) {
	framework.route('/', view_registration);
	framework.route('/', json_registration, ['post']);
};

function view_registration() {
	var self = this;

	self.repository.title = 'Registration';	

	var model = {
		type: 0,
		name: '',
		email: '@',
		password: '',
		phone: '+421',
		country: 'SK',
		terms: true
	};

	self.repository.country = ['', 'SK', 'CZ', 'EN', 'DE', 'AU', 'HU', 'PL', 'FR'];
	self.repository.type = [
		{ id: 0, name: '' },
		{ id: 1, name: 'Developer' },
		{ id: 2, name: 'Webdesigner' },
		{ id: 3, name: 'Copywriter' },
		{ id: 4, name: 'Consultant' }
	];

	self.view('registration', model);
}

// THIS IS BAD EXAMPLE (SEND FORM VIA XHR)
// METHOD: POST
function json_registration() {
	var self = this;

	self.repository.country = ['', 'SK', 'CZ', 'EN', 'DE', 'AU', 'HU', 'PL', 'FR'];
	self.repository.type = [
		{ id: 0, name: '' },
		{ id: 1, name: 'Developer' },
		{ id: 2, name: 'Webdesigner' },
		{ id: 3, name: 'Copywriter' },
		{ id: 4, name: 'Consultant' }
	];

	self.repository.isSuccess = true;
	self.view('registration', self.post);
}