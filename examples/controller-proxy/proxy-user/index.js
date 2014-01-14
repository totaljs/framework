var framework = require('total.js');
var http = require('http');

var port = 8005;
var debug = true;

framework.run(http, debug, port);