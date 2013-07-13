exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/cancel/', view_cancel);
};

function view_homepage() {
	this.plain('view_homepage');
}

function view_cancel() {
	this.plain('view_cancel');
}