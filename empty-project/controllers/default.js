exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('#403', error403);
	framework.route('#404', error404);
	framework.route('#408', error408);
	framework.route('#431', error431);
	framework.route('#500', error500);	
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
	self.plain('403 - Forbidden');
}

// Not Found
function error404() {
	var self = this;
	self.meta('Not Found (404)');
	self.statusCode = 404;
	self.plain('404 - Not Found');
}

// Request Timeout
function error408() {
	var self = this;
	self.meta('Request Timeout (408)');
	self.statusCode = 408;
	self.plain('408 - Request Timeout');
}

// Request Header Fields Too Large
function error431() {
	var self = this;
	self.meta('Request Header Fields Too Large (431)');
	self.statusCode = 431;
	self.plain('431 - Request Header Fields Too Large');
}

// Internal Server Error
function error500() {
	var self = this;
	self.meta('Internal Server Error (500)');
	self.statusCode = 500;
	self.plain('500 - Internal Server Error');
}

function view_homepage() {
	var self = this;
	self.view('homepage');
}