var utils = require('../lib/utils');
var assert = require('assert');
var framework = require('../lib/index');
var http = require('http');

var url = 'http://127.0.0.1:8001/';
var errorStatus = 0;
var max = 1000;

framework.init(http, true, 8001);
var url = 'http://127.0.0.1:8001/';

console.log(url);