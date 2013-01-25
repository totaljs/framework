var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/date/', viewModified);
	this.route('/etag/', viewEtag);
};

function viewModified() {

	var self = this;

	if (self.ifNotModified())
		return;

	// if (self.ifNotModified(new Date().add('minute', 5)))
	//	   return;

	// if value == date then framework uses Last-Modified else Etag
	// set not modified to 5 minute
	self.setModified(new Date().add('minute', 5));

	// show Firebug and call 3x refresh
	self.plain('modified');
}

function viewEtag() {

	var self = this;
	var etag = 'abc123456';

	if (self.ifNotModified(etag))
		return;

	// if value == string then framework uses Etag else Last-Modified
	self.setModified(etag);

	// show Firebug and call 3x refresh
	self.plain('etag');
}