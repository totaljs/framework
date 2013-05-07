exports.install = function(framework) {
	framework.route('/', stop);
};

function stop() {
	var self = this;

	// stop server
	self.framework.stop();
}