exports.install = function(framework) {
	framework.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;

	// self.app.usage([detailed:bool default false])
	self.plain(self.app.usage(true));
}