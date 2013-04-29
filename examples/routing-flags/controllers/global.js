var utils = require('partial.js/utils');

exports.install = function(framework) {
	framework.route('/', view_homepage);
	
	framework.route('/xhr/', xhr_homepage, ['xhr']);
	framework.route('/xhr/post/', xhr_homepage, ['xhr', 'post']);

	framework.route('/post/', form_homepage, ['post']);
	framework.route('/json/', json_homepage, ['json']);
	framework.route('/upload/', upload_homepage, ['upload']);

	framework.route('/put/', put_homepage, ['put']);
	framework.route('/delete/', delete_homepage, ['delete']);

	// Disable XSS protection
	framework.route('/xss/', xss_homepage, ['xss']);

	// This route is enabled in debug mode 
	framework.route('/debug/', debug_homepage, ['debug']);

	// Prefix as the flag
	framework.route('/', android_homepage, ['#android']);

	framework.route('/myflag/', myflag_homepage, ['!myflag']);

	// https://github.com/petersirka/partial.js/tree/master/examples/authorization
	// framework.route('/user/registration/', user_registration, ['unlogged']);
	// framework.route('/user/profile/', user_profile, ['logged']);
};

// flags: !myflag
function myflag_homepage() {

	var self = this;

	if (self.flags.indexOf('!myflag') !== -1) {
		self.plain('MYFLAG - homepage');
		return;
	}

	self.view404();
};

function view_homepage() {
	this.plain('GET - homepage');
}

// flags: POST
function form_homepage() {
	this.plain('POST - homepage');
}

// flags: XHR
// Request header must contains XMLHttpRequest
function xhr_homepage() {
	this.plain('XHR - homepage');	
}

// flags: JSON
// Request content must be a JSON
function json_homepage() {
	this.plain('JSON - homepage');
}

// flags: UPLOAD
// POST (MULTIPART)
function upload_homepage() {
	this.plain('UPLOAD - homepage');
}

// flags: debug
function debug_homepage() {
	this.plain('DEBUG MODE');
}

// flags: #android
function android_homepage() {
	this.plain('ANDROID');	
}

// flags: DELETE
function delete_homepage() {
	this.plain('DELETE - homepage');
}

// flags: PUT
function put_homepage() {
	this.plain('PUT - homepage');
}

function xss_homepage() {
	this.plain('XSS - homepage');
}