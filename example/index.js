var framework = require('./lib');
var http = require('http');	


// Options -> global
var optionsGlobal = {
	debug: true,
	name: 'partial.js'
};

// Options –> user
var optionsUser = {
	name: 'Value'
};

var port = 8004;
var server = framework.init(http, optionsGlobal, optionsUser).listen(port);

// Initialize controllers
framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));