exports.install = function(framework) {
	framework.route('/', viewHomepage);
};

function viewHomepage() {
	this.plain('Auto backup');
}