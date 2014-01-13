exports.install = function(framework) {

	framework.route('/', plain_homepage);
	
};

function plain_homepage() {
	var self = this;
	self.plain('Homepage');
}