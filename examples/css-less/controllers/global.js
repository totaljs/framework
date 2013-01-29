exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;
	self.view('homepage');
}