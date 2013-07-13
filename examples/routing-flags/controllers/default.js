exports.install = function(framework) {

	framework.route('/', view_homepage);

	// [+xhr] - you can execute "view_subpage" with request type: XMLHttpRequest or classic GET/HTTP
	framework.route('/sub/', view_subpage, ['+xhr']);
	
	framework.route('/xhr/', xhr_example, ['xhr']);
	framework.route('/xhr/post/', xhr_example, ['xhr', 'post']);

	framework.route('/post/', form_example, ['post']);
	framework.route('/json/', json_example, ['json']);
	framework.route('/upload/', upload_example, ['upload']);

	framework.route('/put/', put_example, ['put']);
	framework.route('/delete/', delete_example, ['delete']);

	// Disable XSS protection
	framework.route('/xss/', xss_example, ['xss']);

	// This route is enabled in debug mode 
	framework.route('/debug/', debug_example, ['debug']);

	// Prefix as the flag
	framework.route('/', android_example, ['#android']);

	framework.route('/myflag/', myflag_example, ['!myflag']);

	// https://github.com/petersirka/partial.js/tree/master/examples/authorization
	// framework.route('/user/registration/', user_registration, ['unlogged']);
	// framework.route('/user/profile/', user_profile, ['logged']);
};

// flags: !myflag
function myflag_example() {

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

// flags: +xhr
function view_subpage() {
	this.plain('SUBPAGE CONTENT');
}

// flags: post
function form_example() {
	this.plain('POST - homepage');
}

// flags: xhr
// Request header must contains XMLHttpRequest
function xhr_example() {
	this.plain('XHR - homepage');	
}

// flags: json
// Request content must be a JSON
function json_example() {
	this.plain('JSON - homepage');
}

// flags: upload
// POST (MULTIPART)
function upload_example() {
	this.plain('UPLOAD - homepage');
}

// flags: debug
function debug_example() {
	this.plain('DEBUG MODE');
}

// flags: #android
function android_example() {
	this.plain('ANDROID');	
}

// flags: delete
function delete_example() {
	this.plain('DELETE - homepage');
}

// flags: put
function put_example() {
	this.plain('PUT - homepage');
}

// flags: xss
function xss_example() {
	this.plain('XSS - homepage');
}