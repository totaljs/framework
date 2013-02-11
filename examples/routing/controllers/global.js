var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/contact/', contact);
	this.route('/products/', products);
	this.route('/products/{category}/', products);
	this.route('/products/{category}/{subcategory}/', products);
	this.route('/', homepage);
	this.route('/{category}/', homepage);

	// Route to file
	// this.routeFile(name, funcValidation, funcExecute);
	// @name {String}
	// @funcValidation {Function} :: params: {req}, {res}, return {Boolean};
	// @funcExecute {Function} :: params: {req}, {res};	

	this.routeFile('my route file for .txt', function onValidation(req, res) {
		
		// valid request
		return req.url.indexOf('.txt') !== -1;

	}, function onExecute(req, res) {
		
		// generate response
		this.returnContent(req, res, 200, 'Server time: ' + new Date().toString(), 'text/plain');

	});
}

function homepage(category) {

	category = category || '';

	if (category.length > 0)
		category = ' -> ' + category;

	this.plain('homepage{0}'.format(category));
}

function contact() {
	this.plain('contact');
}

function products(category, subcategory) {

	category = category || '';
	subcategory = subcategory || '';

	if (category.length > 0)
		category = ' -> ' + category;

	if (subcategory.length > 0)
		subcategory = ' -> ' + subcategory;

	this.plain('products{0}{1}'.format(category, subcategory));
}
