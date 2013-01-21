var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/contact/', contact);
	this.route('/products/', products);
	this.route('/products/{category}/', products);
	this.route('/products/{category}/{subcategory}/', products);
	this.route('/', homepage);
	this.route('/{category}/', homepage);
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
