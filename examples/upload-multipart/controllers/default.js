exports.install = function(framework) {
	framework.route('/', view_homepage);

	// the number is maximum data receive
	framework.route('/', view_homepage, ['upload'], 1024 * 20);
};

function view_homepage() {
	var self = this;	
	self.repository.title = 'File upload';

	var model = { info: '...' };

	if (self.files.length > 0)
		model.info = self.files[0].filename + ' ({0} kB)'.format(Math.floor(self.files[0].size / 1024, 2));
	
	self.view('homepage', model);
}