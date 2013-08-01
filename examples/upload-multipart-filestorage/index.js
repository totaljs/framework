var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

// create default file storage
framework.storage = require('filestorage').create();

framework.run(http, debug, port);
console.log("http://{0}:{1}/".format(framework.ip, framework.port));