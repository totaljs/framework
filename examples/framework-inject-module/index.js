var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.on('load', function() {
	framework.injectModule('test', 'http://www.partialjs.com/inject-module.js');
});

framework.run(http, debug, port);