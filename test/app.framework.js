var utils = require('../utils');
var assert = require('assert');
var framework = require('../index');
var http = require('http');

var url = 'http://127.0.0.1:8001/';
var errorStatus = 0;
var max = 1000;

framework.run(http, false, 8001);

console.log('http://{0}:{1}/'.format(framework.ip, framework.port));