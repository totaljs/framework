exports.install = function(framework) {
	framework.route('/', view_homepage);
};

function view_homepage() {
	var self = this;
	self.plain('copy one file from /keepalive-command/ directory to his parent directory');
}