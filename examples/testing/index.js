var framework = require('partial.js');
var http = require('http');
var assert = require('assert');

var port = 8004;
var debug = true;

framework.init(http, debug, port);
framework.controller('global');

/*
	ADD TO TEST
*/

// @name {String} :: name of test
// @url {String}
// @callback {Function} :: function params @error {Error}, @data {String}, @name {String}, @statusCode {Number}, @headers {Object}
// @method {String} :: optional default GET
// @data {String} :: optional default empty string
// @headers {Object} :: optional custom headers

// framework.assert(name, url, callback, [method], [data], [headers])

framework.assert('Test URL 1', '/1/', function response (error, data, name, code, headers) {
	assert.ok(code === 200 && data === '1', name);
	console.log('1');
});

framework.assert('Test URL 2', '/2/', function response (error, data, name, code, headers) {
	assert.ok(code === 200 && data === '2', name);
	console.log('2');
});

framework.assert('Test URL 3', '/3/', function response (error, data, name, code, headers) {
	console.log(data);
	assert.ok(code === 200 && data === '3', name);
	console.log('3');
});


/*
	RUN TEST

	@stop {Boolean} :: stop server?
	@callback {Function}
*/
framework.test(true);

console.log("http://127.0.0.1:{0}/".format(port));