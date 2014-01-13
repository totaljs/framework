exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {

	var self = this;

	// call module
	var now = self.module('utils').now();
	var greeting = self.module('feedback').greeting('Thanks');

	self.plain('From module utils -> {0} ({1})'.format(now, greeting));
}