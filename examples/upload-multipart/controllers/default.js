exports.install = function(framework) {
	framework.route('/', view_homepage);

	// the number is maximum data receive
	framework.route('/', view_homepage, { flags: ['upload'], length: 1024 * 20 });
};

function view_homepage() {
	var self = this;

	var model = { info: '...' };

	if (self.files.length > 0)
		model.info = self.files[0].filename + ' ({0} kB)'.format(Math.floor(self.files[0].length / 1024, 2));

	self.view('homepage', model);
}