exports.install = function(framework) {
	framework.route('/', view_homepage_cached);
	framework.route('/notcached/', view_homepage);
	framework.route('/fn/', view_fn_cached);
};

function view_homepage_cached() {

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

function view_homepage() {
	var self = this;
	var	item = new Date().toString();

	// press 15x refresh browser
	self.plain(item);
}

function view_fn_cached() {

	var self = this;

	var fnCallback = function(value) {
		self.plain(value);
	};

	self.cache.fn('cache-name', function(fnSave) {

		var dt = new Date();

		// Save to cache
		// @value {Object}
		// @expire {Date}
		fnSave(dt.format('dd.MM.yyyy - HH:mm:ss'), dt.add('m', 2));

	}, fnCallback);
}