var fs = require('fs');

exports.install = function(framework) {
	framework.route('/', file_download);
};

function file_download() {
	var self = this;
	// documentation: http://www.partialjs.com/documentation/controller/
	// @contentType {String}, @stream {Stream}, [@downloadName] {String}, [@headers] {Options}
	self.stream('application/pdf', fs.createReadStream(self.path.public('company-profile.pdf')), 'about-us.pdf');
}