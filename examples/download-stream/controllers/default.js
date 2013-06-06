var utils = require('partial.js/utils');
var fs = require('fs');

exports.install = function(framework) {
	framework.route('/', download);
};

function download() {
	var self = this;
	// documentation: http://www.partialjs.com/documentation/controller/
	// @contentType {String}, @stream {Stream}, [@downloadName] {String}, [@headers] {Options}
	self.stream('application/pdf', fs.createReadStream(self.path.public('company-profile.pdf')), 'about-us.pdf');
}