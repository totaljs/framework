var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.run(http, debug, port, '127.0.0.1');
console.log("http://{0}:{1}/".format(framework.ip, framework.port));