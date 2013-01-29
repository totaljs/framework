var framework = require('partial.js');
var mail = require('partial.js/mail');
var http = require('http');

var port = 8004;
var debug = true;

var server = framework.init(http, debug).listen(port);

framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));