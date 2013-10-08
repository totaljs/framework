exports.install = function(framework) {
	framework.route('/products/', view_products);
};

function view_products() {
	var self = this;
	self.repository.title = 'Products';

	// this view is loaded by the controller name: /views/products/index.html
	self.view('index');
}