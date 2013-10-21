var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

// please check partial.js version
// markdown: partial.js v1.2.8+

framework.run(http, debug, port);
console.log("http://{0}:{1}/".format(framework.ip, framework.port));