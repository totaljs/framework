exports.init = function() {
	this.route('/read/', cookieRead);
	this.route('/write/', cookieWrite);
}

function cookieRead() {
	var self = this;
	self.plain('Cookie example, read: ' + (self.req.cookie('test') || 'null'));
}

function cookieWrite() {
	var self = this;
	var value = 'VALUE';
	
	self.res.cookie('test', value, new Date().add('day', 1));
	
	//self.plain('Cookie example, write: ' + value);
	self.redirect('/read/');
}