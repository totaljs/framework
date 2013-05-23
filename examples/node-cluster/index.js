var http = require('http');
var cluster = require('cluster');
var os = require('os');
var utils = require('partial.js/utils');

var port = 8004;
var debug = true;

if (cluster.isMaster) {
 
    var numCPUs = os.cpus().length;
    
    for (var i = 0; i < numCPUs; i++)
        cluster.fork();
 
 	return; 
}

var framework = require('partial.js');
framework.run(http, debug, port);
console.log("http://127.0.0.1:{0}".format(port)); 
