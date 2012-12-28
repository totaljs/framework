exports.init = function() {
	this.route('/', homepage);
	this.route('#403', error403);
	this.route('#404', error404);
	this.route('#431', error431)
	this.route('#500', error500);
}

// Forbidden
function error403() {
	this.repository.title = 'Forbidden (403)';
	this.view('403');
}

// Not Found
function error404() {
	this.repository.title = 'Not Found (404)';
	this.view('404');
}

// Request Header Fields Too Large
function error431() {
	this.repository.title = 'Request Header Fields Too Large (431)';
	this.view('431');
}

// Internal Server Error
function error500() {
	this.repository.title = 'Internal Server Error (500)';
	this.view('500');
}

function homepage() {
	this.repository.title = 'Welcome';
	this.view('homepage');
}