exports.install = function(framework) {
	framework.route('/', json_products, ['proxy']);
};

function json_products() {

	var self = this;
	var products = ['A', 'B', 'C', 'D', 'E', 'F'];
	
	self.json(products);

};