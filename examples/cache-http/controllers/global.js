var utils = require('partial.js/utils');

exports.install = function(framework) {
	framework.route('/', viewHomepage);
	framework.route('/dynamic/date/', viewDynamicModified);
	framework.route('/dynamic/etag/', viewDynamicEtag);
	framework.route('/date/', viewModified);
	framework.route('/etag/', viewEtag);
};

function viewHomepage() {
	var self = this;
	var builder = [];
	builder.push('Run location:');
	builder.push('');
	builder.push(self.req.hostname('/date/'));
	builder.push(self.req.hostname('/etag/'));
	builder.push(self.req.hostname('/dynamic/date/'));
	builder.push(self.req.hostname('/dynamic/etag/'));
	self.plain(builder.join('\n'));
}

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

	if (self.notModified())
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

	if (self.notModified())
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

	if (self.notModified('123456'))
		return;

	self.layout('');
	self.view('etag');
}

function viewEtag() {

	var self = this;
	var etag = 'abc123456';

	if (self.notModified(etag))
		return;

	// if value == string then framework uses Etag else Last-Modified
	self.setModified(etag);

	// show Firebug and call 3x refresh
	self.plain('etag');
}