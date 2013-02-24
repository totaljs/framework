exports.init = function() {
	var self = this;
	self.route('/', viewHomepage);
	self.route('/1/', view1);
	self.route('/1/2/', view2);
	self.route('/1/2/3/', view3);
};

function viewHomepage() {
	var self = this;	
	self.view('homepage');
}

function view1() {
	var self = this;
	self.sitemap('1', '/1/');
	self.view('homepage');
}

function view2() {
	var self = this;
	self.sitemap('1', '/1/');
	self.sitemap('2', '/1/2/');
	self.view('homepage');
}

function view3() {
	var self = this;
	self.sitemap('1', '/1/');
	self.sitemap('2', '/1/2/');
	self.sitemap('3', '/1/2/3/');
	self.view('homepage');
}