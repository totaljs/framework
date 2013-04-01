var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.run(http, debug, port);

// if debug == true
// 	  framework load config-debug
// else
//    frmaework load config-release
//
// config will refresh every 20 minutes
//
// or
//
// framework.run(http, { debug: true, name: 'TEST' }, port);

console.log("http://127.0.0.1:{0}/".format(port));