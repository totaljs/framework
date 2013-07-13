exports.install = function(framework) {
	framework.route('/', file_download);
};

function file_download() {
	// documentation: http://www.partialjs.com/documentation/controller/
	this.file('company-profile.pdf', 'about-us.pdf');
}