var framework = require('partial.js');
var http = require('http');

var port = parseInt(process.argv[2] || '8000', 10);
var debug = true;

framework.run(http, debug, port);

// framework.test(true);

console.log('http://{0}:{1}/'.format(framework.ip, framework.port));