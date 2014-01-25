var framework = require('total.js');
var http = require('http');

framework.run(http, false, parseInt(process.argv[2]));