var urlParser = require('url');
var http = require('http');
var tls = require('tls');
var https = require('https');
var util = require('util');
var path = require('path');
var utils = require('../utils');
var exec = require('child_process').exec;
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

//console.log((1).pluralize('zero', 'one', 'few', 'other'));

var Stream = require('stream');
//var writer = fs.createWriteStream('/users/petersirka/desktop/kokotar.zip')
//var reader = fs.createReadStream('/users/petersirka/desktop/user.zip');

//reader.pipe(writer);
//console.log(writer);
/*
var image = Image.load('/users/petersirka/desktop/header.jpg', false);
image.resize('20%');
image.quality(90);
image.minify();
image.save('/users/petersirka/desktop/c.jpg');
*/

//image.pipe(fs.createWriteStream('/users/petersirka/desktop/c.jpg'));

/*
var p = exec('gm -convert - -resize 10% "/users/petersirka/desktop/b.jpg"', function(err, stdout) {
	console.log('OK');
});

fs.createReadStream('/users/petersirka/desktop/a.jpg').pipe(p.stdin);
*/

// message.attachment('/users/petersirka/desktop/wall.png');

//var message = new require('../mail').create('subject', 'body');

//message.to('petersirka@gmail.com');
//message.from('sirka@wsd-europe.com', 'Janko');

//message.send('smtp.wsd-europe.com', { user: 'sirka@wsd-europe.com', password: 'PETO07dlska' });
//message.send('smtp.gmail.com', { port: 465, secure: true, user: 'petersirka@gmail.com', password: '' });
//message.send();

//var socket = new tls.connect(465, 'smtp.gmail.com');
//var isSended = false;

