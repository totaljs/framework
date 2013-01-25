var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepageCached);
	this.route('/notcached/', viewHomepageNotCached);
};

function viewHomepageCached() {

	var self = this;
	var key = 'my-cache-key';

	var item = self.cache.read(key);
	
	if (item === null) {
		var date = new Date();
		item = date.toString();
		self.cache.write(key, item, date.add('minute', 5));	
	}

	// press 15x refresh browser
	self.plain(item);
}

function viewHomepageNotCached() {
	var self = this;
	var	item = new Date().toString();

	// press 15x refresh browser
	self.plain(item);
}