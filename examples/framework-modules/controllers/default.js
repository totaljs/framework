exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {

	var self = this;

	// call module
	var now = self.module('utils').now();

	self.plain('From module utils -> {0}'.format(now));
}