var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

console.log('===================================================================');
console.log('WARNING: you must have installed node-sqlite3 / npm install sqlite3');
console.log('===================================================================');
console.log('');

framework.init(http, debug, port);

// Initialize controllers
framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));