exports.install = function(framework) {
	framework.route('/', stop);
};

function stop() {
	var self = this;
	
	// client response
	self.plain('STOP & EXIT');

	// stop server
	self.app.stop();
}