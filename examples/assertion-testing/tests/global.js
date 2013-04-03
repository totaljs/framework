var utils = require('partial.js/utils');
var assert = require('assert');

exports.run = function(framework, name) {

	console.log('run test: {0}'.format(name));
	console.log('');

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
		// throw error, data === 4
		assert.ok(code === 200 && data === '3', name);
		console.log('3');
	});
};