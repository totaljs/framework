exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/custom/', plain_custom);
};

function view_homepage() {
	var self = this;
	self.view('homepage');
}

function plain_custom() {
	var self = this;
	self.plain(self.component('grid', [1, 2, 3, 4, 5]));
}