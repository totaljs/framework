exports.install = function(framework) {

	framework.route('/', plain_homepage);
	framework.route('/usage/', plain_usage);

};

function plain_homepage() {
	var self = this;
	self.plain('Restrictions ...');
}

function plain_usage() {
	this.plain(this.framework.usage());
}