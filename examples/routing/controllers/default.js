exports.install = function(framework) {
	// Documentation: http://docs.partialjs.com/Framework/#framework.route
	framework.route('/contact/', view_contact);
	framework.route('/products/', view_products);
	framework.route('/products/{category}/', view_products);
	framework.route('/products/{category}/{subcategory}/', view_products);
	framework.route('/', view_homepage);
	framework.route('/{category}/', view_homepage);

	// route: all txt files
	// Documentation: http://docs.partialjs.com/Framework/#framework.file
	// Try: http://127.0.0.4/test.txt
	framework.file('.txt', static_txt);

	// route: all jpg files
	// all images will resized about 50%
	// Documentation: http://docs.partialjs.com/Framework/#framework.file
	// Try: http://127.0.0.4/header.jpg
	framework.file('.jpg', static_jpg);
}

function static_txt(req, res, isValidation) {

	if (isValidation)
		return req.url.indexOf('.txt') !== -1;

	// generate response
	// this === framework
	// Documentation: http://docs.partialjs.com/Framework/#framework.responsContent
	this.responseContent(req, res, 200, 'Server time: ' + new Date().toString(), 'text/plain');
}

function static_jpg(req, res, isValidation) {

	if (isValidation)
		return req.url.indexOf('.jpg') !== -1;

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

function view_homepage(category) {

	category = category || '';

	if (category.length > 0)
		category = ' -> ' + category;

	this.plain('homepage{0}'.format(category));
}

function view_contact() {
	this.plain('contact');
}

function view_products(category, subcategory) {

	category = category || '';
	subcategory = subcategory || '';

	if (category.length > 0)
		category = ' -> ' + category;

	if (subcategory.length > 0)
		subcategory = ' -> ' + subcategory;

	this.plain('products{0}{1}'.format(category, subcategory));
}