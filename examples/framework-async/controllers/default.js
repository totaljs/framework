exports.install = function(framework) {
	
	framework.route('/', view_homepage);
	framework.route('/', xhr_percentage, ['xhr']);
	
	framework.file('*.jpg', function(req) {
		return req.url.indexOf('pic') !== -1;
	}, static_file);
};

function view_homepage() {
	var self = this;
	self.view('homepage');
}

function xhr_percentage() {

	var self = this;
	self.json({ percentage: self.framework.async.percentage });

}

function static_file(req, res) {

	var self = this;
	
	self.async.await(function(next) {
		
		setTimeout(function() {
		
			self.responseFile(req, res, self.path.public('img/picture.jpg'));
			next();

		}, 1000 * utils.random(10, 5));

	});

	self.async.run();
}