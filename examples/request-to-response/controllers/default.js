exports.install = function(framework) {
	framework.route('/', pipe_homepage);
	framework.route('/file/', pipe_file);
}

function pipe_homepage() {
	var self = this;
	self.pipe('http://www.totaljs.com');
}

function pipe_file() {
	var self = this;
	self.pipe('http://www.totaljs.com/download/logo-black.png');
}