exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {
	this.plain('Auto backup');
}