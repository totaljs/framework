exports.install = function(framework) {
	framework.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;
	self.plain('copy one file from /keepalive-command/ directory to his parent directory');
}