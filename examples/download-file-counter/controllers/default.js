var path = require('path');
var counter = 0;

exports.install = function(framework) {

	// route index	
	framework.route('/', view_homepage);
	
	// file route
	framework.file('*.pdf counter', function(req) {
		
		return req.url.toLowerCase().substring(req.url.length - 4) === '.pdf';

	}, file_download);	

};

function view_homepage() {
	var self = this;
	self.plain(self.req.hostname('/company-profile.pdf') + '\n\nDownload count: ' + counter); 
};

function file_download(req, res) {

	// this === framework
	var self = this;
	var filename = path.basename(req.url);

	counter++;

	// framework documentation: http://www.partialjs.com/documentation/framework/
	// response file
	self.responseFile(req, res, self.path.public(filename), filename);
};