var framework = require('total.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.run(http, debug, port, '127.0.0.1');