var framework = require('total.js');
var http = require('http');

var port = 8004;

// static cache works in release mode
var debug = false;

framework.run(http, debug, port);