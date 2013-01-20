var framework = require('partial.js');
var couchdb = require('partial.js/couchdb');
var http = require('http');

var port = 8004;
var server = framework.init(http, { debug: true }).listen(port);

// Initialize controllers
framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));