exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('#400', error400);
	framework.route('#401', error401);
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

// Bad Request
function error400() {
	var self = this;
	self.status = 400;
	self.plain(utils.httpStatus(self.status));
}

// Unauthorized
function error401() {
	var self = this;
	self.status = 401;
	self.plain(utils.httpStatus(self.status));
}

// Forbidden
function error403() {
	var self = this;
	self.status = 403;
	self.plain(utils.httpStatus(self.status));
}

// Not Found
function error404() {
	var self = this;
	self.status = 404;
	self.plain(utils.httpStatus(self.status));
}

// Request Timeout
function error408() {
	var self = this;
	self.status = 408;
	self.plain(utils.httpStatus(self.status));
}

// Request Header Fields Too Large
function error431() {
	var self = this;
	self.status = 431;
	self.plain(utils.httpStatus(self.status));
}

// Internal Server Error
function error500() {
	var self = this;
	self.status = 500;
	self.plain(utils.httpStatus(self.status));
}

// GET: homepage
// Description: webpage homepage
function view_homepage() {
	var self = this;
	self.view('homepage');
}