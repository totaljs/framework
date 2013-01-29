exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;
	var message = 'MESSAGE TO LOG :: LOOK AT LOGS DIRECTORY';

	self.log(message);
	self.plain(message);
}