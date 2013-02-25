var utils = require('../lib/utils')
var assert = require('assert');
var framework = require('../lib/index');
var http = require('http');

var url = 'http://127.0.0.1:8000/';
framework.init(http, true, 8000);

framework.onError = function(error) {
	console.log(error);
	framework.stop();
};

function end() {
	console.log('================================================');
	console.log('success - OK');
	console.log('================================================');
	console.log('');
	framework.stop();
}

function test_controller_functions(next) {	
	utils.request(url, 'GET', null, function(error, data, code, headers) {
		assert.ok(code === 404, 'controller: statusCode');

		assert.ok(headers['etag'] === '123456', 'controller: setModified(etag)');
		assert.ok(headers['last-modified'].toString().indexOf('1984') !== -1, 'controller: setModified(date)');
		assert.ok(headers['expires'].toString().indexOf('1984') !== -1, 'controller: setExpires(date)');
		
		next();
	});
}

setTimeout(function() {
	test_controller_functions(function() {
		end();
	});
}, 500);
