var utils = require('partial.js/utils');

exports.install = function(framework) {
	framework.route('/', get_form);
	framework.route('/', post_form, ['post']);
	framework.route('/xss/', xss_form, ['xss']);
	framework.route('/xss/', xss_form, ['xss', 'post']);
	framework.route('#404', view404);
};

function view404() {
	var self = this;

	if (self.flags.indexOf('xss') === -1) {
		self.plain('404');
		return;
	}

	self.plain('XSS protection');
}

function xss_form() {
	var self = this;

	self.repository.unknown = (self.req.method === 'GET' ? self.get.unknown : self.post.unknown) || '';
	self.view('form');
}

function get_form() {

	var self = this;
	self.repository.unknown = self.get.unknown || '';

	if (self.repository.unknown.length > 0)
		console.log('GET');

	self.view('form');
}

function post_form() {

	console.log('POST');

	var self = this;
	self.repository.unknown = self.post.unknown || '';
	self.view('form');
}