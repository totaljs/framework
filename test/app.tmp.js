var urlParser = require('url');
var http = require('http');
var tls = require('tls');
var https = require('https');
var util = require('util');
var path = require('path');
var fs = require('fs');
var events = require('events');
var crypto = require('crypto');
var framework = require('../index');

var BOUNDARY = '----' + Math.random().toString(16).substring(2);

function send(url) {

	var uri = urlParser.parse(url);
	var h = {};
	var indexer = 0;

	h['Content-Type'] = 'multipart/x-mixed-replace; boundary=' + BOUNDARY;
	//h['Content-Type'] = 'multipart/form-data; boundary=' + BOUNDARY;

	var options = { protocol: uri.protocol, auth: uri.auth, method: 'POST', hostname: uri.hostname, port: uri.port, path: uri.path, agent: false, headers: h };

	var response = function(res) {
		var buffer = '';

		res.on('data', function(chunk) {
			buffer += chunk.toString('utf8');
		});

		res.on('end', function() {
			console.log(res.statusCode, buffer);
		});

		res.resume();
		console.log('response');
	};

	var con = http;


	var req = con.request(options, response);

	req.on('error', function(error) {
		console.log('ERROR', error, error.stack);
	});

	function sendfile(filename, cb) {
		console.log(filename);
		var header = '\r\n\r\n--' + BOUNDARY + '\r\nContent-Disposition: form-data; name="File"; filename="'+path.basename(filename)+'"\r\nContent-Type: image/jpeg\r\n\r\n';
		req.write(header);
		var stream = fs.createReadStream(filename);
		stream.pipe(req, { end: false });
		stream.on('end', cb);
	}

	function run() {
		indexer++;

		if (indexer > 5) {
			req.end('\r\n\r\n--' + BOUNDARY + '--');
			console.log('END');
			return;
		}

		setTimeout(function() {
			sendfile('/users/petersirka/desktop/aaaaa/' + indexer + '.jpg', run);
		}, 500);

	}

	run();
};

//send('http://127.0.0.1:8004/');
//send('http://127.0.0.1:8001/live/incoming/');

function arrayFindAll(arr, filter) {

	var length = arr.length;
	var selected = [];

	for (var i = 0; i < length; i++) {
		var value = arr[i];
		if (filter(value))
			selected.push(value);
	}

	return selected;
};

function arrayFindAllWithIndex(arr, filter) {

	var length = arr.length;
	var selected = [];

	for (var i = 0; i < length; i++) {
		var value = arr[i];
		// i === index
		if (filter(value, i))
			selected.push(value);
	}

	return selected;
};

function Obj() {
}

Obj.prototype = {
	get async() {

		if (typeof(this._async) === 'undefined') {
			this._async = new utils.Async(this);
			console.log('create');
		}

		return this._async;
	}
}

Obj.prototype.__proto__ = new events.EventEmitter();

var obj = new Obj();
console.log(obj.async);
console.log(obj.async);
console.log(obj.async);

// message.attachment('/users/petersirka/desktop/wall.png');

//message.send('smtp.wsd-europe.com', { user: 'sirka@wsd-europe.com', password: 'PETO07dlska' });
//message.send('smtp.gmail.com', { port: 465, secure: true, user: 'petersirka@gmail.com', password: 'plisBB12' });
//message.send();

//var socket = new tls.connect(465, 'smtp.gmail.com');
//var isSended = false;

