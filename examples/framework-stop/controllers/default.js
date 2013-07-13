exports.install = function(framework) {
	framework.route('/', view_stop);
};

function view_stop() {
	var self = this;

	// stop server
	self.framework.stop();
}