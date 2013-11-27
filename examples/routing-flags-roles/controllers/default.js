exports.install = function(framework) {
	framework.route('#401', error_401);

	// custom flag definition : '!custom1', '!custom2'
	// role flag definition   : '#admin', '#moderator'
	// difference between custom and role flags is: custom flags are skipped from comparing flags between route and request

	framework.route('/', view_admin, ['logged', '@admin']);
	framework.route('/', view_moderator, ['logged', '@moderator']);
};

// Flags: logged, !admin
function view_admin() {
	this.plain('ADMIN');
}

// Flags: logged, !moderator
function view_moderator() {
	this.plain('MODERATOR');
}

function error_401() {
	this.plain('401:UNAUTHORIZED\n\nhttp://127.0.0.1:8004/?user=admin\nhttp://127.0.0.1:8004/?user=moderator');
}