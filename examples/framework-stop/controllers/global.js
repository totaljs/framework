exports.init = function() {
	this.route('/', stop);
};

function stop() {
	var self = this;
	
	// client response
	self.plain('STOP & EXIT');

	// stop server
	self.app.stop();
}