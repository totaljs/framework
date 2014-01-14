exports.install = function(framework) {
	// all templates will be routed to contents/templates/*.html
	// EXAMPLE:
	// $routeProvider.when('/', { templateUrl: '/templates/products.html', controller: 'ProductsCtrl' });

	// Documentation: http://docs.totaljs.com/Framework/#framework.file
    framework.file('Mapping: templates/*.html', file_template);
};

function file_template(req, res, isValidation) {
	
	// Documentation: http://docs.totaljs.com/Request.prototype/#request.path
	if (isValidation)
		return req.path[0] === 'templates' && (req.path[1] || '').indexOf('.html') !== -1;

	var self = this;

	// Documentation: http://docs.totaljs.com/Framework/#framework.responseFile
	self.responseFile(req, res, self.path.contents(req.path[0] + '/' + req.path[1]));
}