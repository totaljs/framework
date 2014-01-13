var framework = require('partial.js');
var http = require('http');

var port = 8006;
var debug = true;

framework.run(http, debug, port);