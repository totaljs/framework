exports.install = function(framework) {
	framework.route('/', pipe_homepage);
	framework.route('/file/', pipe_file);
}

function pipe_homepage() {
	var self = this;
	self.pipe('http://www.partialjs.com');
}

function pipe_file() {
	var self = this;
	self.pipe('http://www.partialjs.com/upload/empty-project.zip');
}