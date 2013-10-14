var urlParser = require('url');
var http = require('http');
var tls = require('tls');
var https = require('https');
var util = require('util');
var path = require('path');
var utils = require('../utils');
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

var async = new utils.Async();

async.await('1', function(next) {
	setTimeout(function() {
		console.log('RESULT: 1');
		next();
	}, 2000)
});

async.timeout('1', 1000);

async.wait('2', '1', function(next) {
	setTimeout(function() {
		console.log('RESULT: 2');
		next();
	}, 500)
});

async.on('begin', function(name) {
	console.log('BEGIN --->', name);
});

async.on('percentage', function(percentage) {
	console.log(percentage);
});

async.on('end', function(name) {
	console.log('END --->', name);
});

async.run(function() {
	console.log('COMPLETED');
});

async.on('timeout', function(name) {
	console.log('TIMEOUT --->', name);
});

async.on('cancel', function(name) {
	console.log('CANCEL --->', name);
});


// message.attachment('/users/petersirka/desktop/wall.png');

//message.send('smtp.wsd-europe.com', { user: 'sirka@wsd-europe.com', password: 'PETO07dlska' });
//message.send('smtp.gmail.com', { port: 465, secure: true, user: 'petersirka@gmail.com', password: 'plisBB12' });
//message.send();

//var socket = new tls.connect(465, 'smtp.gmail.com');
//var isSended = false;

