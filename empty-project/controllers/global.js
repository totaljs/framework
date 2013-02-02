exports.init = function() {
	var self = this;
	self.route('/', viewHomepage);
	self.route('#403', error403);
	self.route('#404', error404);
	self.route('#431', error431)
	self.route('#500', error500);
};

/*
exports.models = function() {

};

exports.functions = function() {

};
*/

// Forbidden
function error403() {
	var self = this;
	self.meta('Forbidden (403)');
	self.statusCode = 403;
	self.view('403');
}

// Not Found
function error404() {
	var self = this;
	self.meta('Not Found (404)');
	self.statusCode = 404;
	self.view('404');
}

// Request Header Fields Too Large
function error431() {
	var self = this;
	self.meta('Request Header Fields Too Large (431)');
	self.statusCode = 431;
	self.view('431');
}

// Internal Server Error
function error500() {
	var self = this;
	self.meta('Internal Server Error (500)');
	self.statusCode = 500;
	self.view('500');
}

function viewHomepage() {
	var self = this;
	self.meta('Welcome');
	self.view('homepage');
}