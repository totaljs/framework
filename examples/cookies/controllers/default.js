exports.install = function(framework) {
	framework.route('/read/', cookieRead);
	framework.route('/write/', cookieWrite);
}

function cookieRead() {
	var self = this;
	self.plain('Cookie example\nread test1: ' + (self.req.cookie('test1') || 'null') + '\nread test2: ' + (self.req.cookie('test2') || 'null'));
}

function cookieWrite() {
	var self = this;

	self.res.cookie('test1', 'value 1', new Date().add('day', 1));
	self.res.cookie('test2', 'value 2', new Date().add('day', 1));

	// options.domain
	// options.path
	// options.secure
	// options.httponly
	// self.res.cookie(name, value, expire, [options]);

	//self.plain('Cookie example, write: ' + value);
	self.redirect('/read/');
}