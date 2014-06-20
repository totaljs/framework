require("v8-profiler");

var urlParser = require('url');
var http = require('http');
var tls = require('tls');
var https = require('https');
var util = require('util');
var path = require('path');
var utils = require('../utils');
var exec = require('child_process').exec;
var sys = require('sys');
var Image = require('../image');
var fs = require('fs');
var events = require('events');
var crypto = require('crypto');
var framework = require('../index');
var ENCODING = 'utf8';
var UNDEFINED = 'undefined';
var STRING = 'string';
var FUNCTION = 'function';
var NUMBER = 'number';
var OBJECT = 'object';
var BOOLEAN = 'boolean';
var indexer = 0;


var arr = [];

arr.push(function() {

})

arr._async_middleware(function() {
    console.log('DONE');
});