var utils = require('partial.js/utils');
var path = require('path');
var counter = 0;

exports.install = function(framework) {

	// route index	
	framework.route('/', viewIndex);
	
	// file route
	framework.routeFile('*.pdf counter', function(req) {
		return req.url.toLowerCase().substring(req.url.length - 4) === '.pdf';
	}, download);	

};

function viewIndex() {
	var self = this;
	self.plain(self.req.hostname('/company-profile.pdf') + '\n\nDownload count: ' + counter); 
};

function download(req, res) {

	// this === framework
	var self = this;
	var filename = path.basename(req.url);

	counter++;

	// framework documentation: http://www.partialjs.com/documentation/framework/
	// response file
	self.responseFile(req, res, self.path(self.config.directoryPublic, filename), filename);
};