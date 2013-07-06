var framework = require('partial.js');
var http = require('http');

var port = 8005;
var debug = true;

framework.run(http, debug, port);
console.log("http://127.0.0.1:{0}/".format(port));
