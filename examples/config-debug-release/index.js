var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

var server = framework.init(http, debug).listen(port);

// if debug == true
// 	  framework.load(config-debug);
// else
//    frmaework.load(config-release);
//
// config will refresh every 20 minutes
//
// or
//
// var server = framework.init(http, { debug: true, name: 'TEST' }).listen(port);

// Initialize controllers
framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));