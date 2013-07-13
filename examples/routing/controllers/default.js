exports.init = function(framework) {
	framework.route('/contact/', view_contact);
	framework.route('/products/', view_products);
	framework.route('/products/{category}/', view_products);
	framework.route('/products/{category}/{subcategory}/', view_products);
	framework.route('/', view_homepage);
	framework.route('/{category}/', view_homepage);

	// Route to file
	// this.routeFile(name, funcValidation, funcExecute);
	// @name {String}
	// @funcValidation {Function} :: params: {req}, {res}, return {Boolean};
	// @funcExecute {Function} :: params: {req}, {res};	

	// route: all txt files
	framework.file('my route file for .txt', function onValidation(req, res) {
		
		// valid request
		return req.url.indexOf('.txt') !== -1;

	}, function onExecute(req, res) {
		
		// generate response
		// this === framework
		this.responseContent(req, res, 200, 'Server time: ' + new Date().toString(), 'text/plain');

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
