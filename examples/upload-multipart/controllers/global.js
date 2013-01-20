var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
	this.route('/', viewHomepage, ['upload'], 1024 * 1000);
};

function viewHomepage() {
	var self = this;	
	
	self.repository.title = 'Templates';

	var model = { info: '...' };

	if (self.files.length > 0)
		model.info = self.files[0].fileName + ' ({0} kB)'.format(Math.floor(self.files[0].fileSize / 1024, 2));

	self.view('homepage', model);
}