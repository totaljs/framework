exports.install = function(framework) {
	framework.route('/', viewHomepage);
};

function viewHomepage() {
	this.plain('Hello World!');
}