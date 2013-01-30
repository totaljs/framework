var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.init(http, debug, port);

// Initialize controllers
framework.controller('global');

framework.onController = function(name) {
	var self = this;
	
	// set default value for each request to controller
	self.repository.title = 'Sitemap';
	self.repository.sitemap = [{ url: '/', name: 'Homepage' }];
	self.layout('');
};

console.log("http://127.0.0.1:{0}/".format(port));