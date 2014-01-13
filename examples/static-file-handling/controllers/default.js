exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.file('All (.jpg, .png, .gif) images', image_resize);
};

function view_homepage() {
	this.view('homepage');
}

function image_resize(req, res, isValidation) {

	if (isValidation)
		return req.url.contains(['.jpg', '.png', '.gif']);

	// generate response
	// this === framework
	// Documentation: http://docs.partialjs.com/Framework/#framework.responseImage
	this.responseImage(req, res, this.path.public(req.url), function (image) {

		// image === FrameworkImage
		// http://docs.partialjs.com/FrameworkImage/

		image.resize('50%');
		image.quality(80);
		image.minify();

	});

}

