var framework = require('partial.js');
var http = require('http');

var options = {
	name: 'Value'
};

var port = 8004;
var server = framework.init(http, { debug: true }, options).listen(port);

// Initialize controllers
framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));