exports.init = function(partial) {
	partial.route("/", homepage);
	partial.route("#401", error401);
	partial.route("#404", error404);
	partial.route("#500", error500);
}

// Unauthorized
function error401() {
	this.repository.title = 'Unauthorized';
	this.view("401");
}

// Not found
function error404() {
	this.repository.title = 'Not found';
	this.view("404");
}

// Internal error
function error500() {
	this.repository.title = 'Internal error';
	this.view("500");
}

function homepage() {
	this.repository.title = 'Welcome';
	this.view('homepage', { meno: 'Peter' });
}