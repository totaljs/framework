var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/dynamic/date/', viewDynamicModified);
	this.route('/dynamic/etag/', viewDynamicEtag);
	this.route('/date/', viewModified);
	this.route('/etag/', viewEtag);
};

function viewDynamicModified() {
	var self = this;

	// Check header
	//
	// @date {Date} :: optional, default: new Date()
	// @strict {Boolean} :: optional, default: false	
	// 
	// if @strict === false then header['if-modified-since'] > @date return 304
	// if @strict === true then header['if-modified-since'] === @date return 304
	//
	// ifNotModified([date], [strict])

	if (self.ifNotModified())
		return;

	self.layout('');
	self.view('modified');
}

function viewModified() {

	var self = this;

	// Check header
	//
	// @date {Date} :: optional, default: new Date()
	// @strict {Boolean} :: optional, default: false	
	// 
	// if @strict === false then header['if-modified-since'] > @date return 304
	// if @strict === true then header['if-modified-since'] === @date return 304
	//
	// ifNotModified([date], [strict])

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


function viewDynamicEtag() {
	var self = this;

	if (self.ifNotModified('123456'))
		return;

	self.layout('');
	self.view('etag');
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