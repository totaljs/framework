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

function test(version, name) {
	for (var i = 1; i < arguments.length; i++)
		console.log(arguments[i]);
}

test('1.2.2', 'angular', 'test');