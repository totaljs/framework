var path = require('path');
var counter = 0;

exports.install = function(framework) {

	// route index
	framework.route('/', view_homepage);

	// file route
	// Documentation: http://docs.totaljs.com/Framework/#framework.file
	framework.file('*.pdf counter', file_download);

};

function view_homepage() {
	var self = this;
	self.plain(self.req.hostname('/company-profile.pdf') + '\n\nDownload count: ' + counter);
};

function file_download(req, res, isValidation) {

	if (isValidation)
		return req.url.toLowerCase().substring(req.url.length - 4) === '.pdf';

	// this === framework
	var self = this;
	var filename = path.basename(req.url);

	counter++;

	// Documentation: http://docs.totaljs.com/Framework/#framework.responseFile
	// response file
	self.responseFile(req, res, self.path.public(filename), filename);
};