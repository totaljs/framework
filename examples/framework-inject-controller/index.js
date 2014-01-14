var framework = require('total.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.on('load', function() {
	framework.injectModule('myControllerName', 'http://www.totaljs.com/inject-controller.js');
});

framework.run(http, debug, port);