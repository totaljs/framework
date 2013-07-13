exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/dynamic/date/', view_dynamic_modified);
	framework.route('/dynamic/etag/', view_dynamic_etag);
	framework.route('/date/', view_modified);
	framework.route('/etag/', view_etag);
};

function view_homepage() {
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

function view_dynamic_modified() {
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

function view_modified() {

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


function view_dynamic_etag() {
	var self = this;

	if (self.notModified('123456'))
		return;

	self.layout('');
	self.view('etag');
}

function view_etag() {

	var self = this;
	var etag = 'abc123456';

	if (self.notModified(etag))
		return;

	// if value == string then framework uses Etag else Last-Modified
	self.setModified(etag);

	// show Firebug and call 3x refresh
	self.plain('etag');
}