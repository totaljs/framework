exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {
	var self = this;
	var message = 'MESSAGE TO LOG :: LOOK AT LOGS DIRECTORY';

	self.log(message);
	self.plain(message);
}