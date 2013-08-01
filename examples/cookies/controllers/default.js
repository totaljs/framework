exports.install = function(framework) {
	framework.route('/read/', cookieRead);
	framework.route('/write/', cookieWrite);
}

function cookieRead() {
	var self = this;
	self.plain('Cookie example, read: ' + (self.req.cookie('test') || 'null'));
}

function cookieWrite() {
	var self = this;
	var value = 'VALUE';
	
	self.res.cookie('test', value, new Date().add('day', 1));

	// options.domain
	// options.path
	// options.secure
	// options.httponly
	// self.res.cookie(name, value, expire, [options]);
	
	//self.plain('Cookie example, write: ' + value);
	self.redirect('/read/');
}