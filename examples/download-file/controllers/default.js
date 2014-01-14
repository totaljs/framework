exports.install = function(framework) {
	framework.route('/', file_download);
	framework.route('/image/', image_download);
};

function file_download() {
	// Documentation: http://docs.totaljs.com/FrameworkController/#controller.file
	this.file('company-profile.pdf', 'about-us.pdf');
}

function image_download() {
	// Documentation: http://docs.totaljs.com/FrameworkController/#controller.image
	this.image('slovakia.jpg', function(image) {
		image.resize('50%');
		image.minify();
	});
}