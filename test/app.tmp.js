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

var tmp = "template('more', price.asda, 'asdsa', repository['asdasd'])";


function params(tmp, replace) {

	var isCopy = false;
	
	var index = tmp.indexOf('(');
	if (index === -1)
		return false;

	tmp = tmp.substring(index + 1, tmp.length - 1).replace(/\s/g, '').split(',');
	var length = tmp.length;

	for (var i = 0; i < length; i++)
		replace(tmp[i], i);

	return true;
}

params(tmp, function(key, index) {
	console.log(key, index);
});


// message.attachment('/users/petersirka/desktop/wall.png');

//message.send('smtp.wsd-europe.com', { user: 'sirka@wsd-europe.com', password: 'PETO07dlska' });
//message.send('smtp.gmail.com', { port: 465, secure: true, user: 'petersirka@gmail.com', password: 'plisBB12' });
//message.send();

//var socket = new tls.connect(465, 'smtp.gmail.com');
//var isSended = false;

