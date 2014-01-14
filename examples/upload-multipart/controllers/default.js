exports.install = function(framework) {
	framework.route('/', view_homepage);

	// the number is maximum data receive
	framework.route('/', view_homepage, { flags: ['upload'], length: 1024 * 20 }); // 1 === 1 kB
};

function view_homepage() {
	var self = this;

	var model = { info: '...' };

	// self.files array of HttpFile === http://docs.totaljs.com/HttpFile/
	if (self.files.length > 0)
		model.info = self.files[0].filename + ' ({0} kB - {1}x{2})'.format(Math.floor(self.files[0].length / 1024, 2), self.files[0].width, self.files[0].height);

	self.view('homepage', model);
}