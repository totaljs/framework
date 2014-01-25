var framework = require('total.js');
var http = require('http');

framework.run(http, true, parseInt(process.argv[2]));