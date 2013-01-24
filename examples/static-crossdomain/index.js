var framework = require('partial.js');
var http = require('http');

var options = {
	debug: true,
	staticUrl: 'http://static.yourdomain.com',
	staticUrlJS: 'http://static.yourdomain.com/scripts/',
	staticUrlCSS: 'http://static.yourdomain.com/styles/',
	staticUrlImage: 'http://static.yourdomain.com/image/'
};

var port = 8004;
var server = framework.init(http, options).listen(port);

// Initialize controllers
framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));