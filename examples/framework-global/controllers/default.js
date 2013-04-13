exports.install = function(framework) {
	framework.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;

	self.json(self.global);

	// or
	// self.json(self.framework.global);
}