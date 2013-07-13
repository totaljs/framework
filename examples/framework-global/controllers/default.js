exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {
	var self = this;

	self.json(self.global);

	// or
	// self.json(self.framework.global);
}