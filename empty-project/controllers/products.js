exports.install = function(framework) {
	framework.route('/products/', view_products);
};

function view_products() {	
	var self = this;
	self.view('index');	
}