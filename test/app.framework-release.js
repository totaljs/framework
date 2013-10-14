var utils = require('../utils');
var assert = require('assert');
var framework = require('../index');
var http = require('http');
var fs = require('fs');

var port = parseInt(process.argv[2] || '8001');
var url = 'http://127.0.0.1:' + port + '/';
var errorStatus = 0;
var max = 1000;
var async = new utils.Async();

framework.run(http, false, port);

framework.onAuthorization = function(req, res, flags, cb) {
	req.user = { alias: 'Peter Širka' };
	req.session = { ready: true };
	cb(true);
};

framework.onError = function(error, name, uri) {

	if (errorStatus === 0) {
		console.log(error, name, uri, max);
		framework.stop();
		return;
	}

	if (errorStatus === 1) {
		if (error.toString().indexOf('not found') === -1)
			console.log(error);
		assert.ok(error.toString().indexOf('not found') !== -1, 'view: not found problem');
		errorStatus = 2;
		return;
	}

	if (errorStatus === 2) {
		assert.ok(error.toString().indexOf('not found') !== -1, 'template: not found problem');
		errorStatus = 3;
		return;
	}

	if (errorStatus === 3) {
		assert.ok(error.toString().indexOf('not found') !== -1, 'content: not found problem');
		errorStatus = 0;
		return;
	}
};

function end() {
	framework.backup(function(err, file) {
		try
		{
			fs.unlinkSync(file);
		} catch (ex) {
			assert.ok(false, 'framework.backup(): ' + ex.toString());
		}
		console.log('================================================');
		console.log('success - OK');
		console.log('================================================');
		console.log('');
		framework.stop();
	});
}

function test_controller_functions(next) {

	utils.request(url, 'GET', null, function(error, data, code, headers) {

		if (error)
			assert.ok(false, 'test_controller_functions: ' + error.toString());

		assert.ok(code === 404, 'controller: statusCode ' + code);
		assert.ok(headers['etag'] === '123456:1', 'controller: setModified(etag)');
		assert.ok(headers['last-modified'].toString().indexOf('1984') !== -1, 'controller: setModified(date)');
		assert.ok(headers['expires'].toString().indexOf('1984') !== -1, 'controller: setExpires(date)');
		next();
	});
}

function test_view_functions(next) {
	utils.request(url + 'views/', 'GET', null, function(error, data, code, headers) {

		if (error)
			assert.ok(false, 'test_view_functions: ' + error.toString());

		assert.ok(data === '{"r":true}', 'json');
		next();
	});
};

function test_view_error(next) {
	errorStatus = 1;
	utils.request(url + 'view-notfound/', 'GET', null, function(error, data, code, headers) {

		if (error)
			assert.ok(false, 'test_view_error: ' + error.toString());

		next();
	});
}

function test_routing(next) {

	async.await('a', function(complete) {
		utils.request(url + 'a/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			complete();
		});
	});

	async.await('a/aaa', function(complete) {
		utils.request(url + 'a/aaa/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			complete();
		});
	});

	async.await('a/b', function(complete) {
		utils.request(url + 'c/b/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			complete();
		});
	});

	async.await('a/b/c/', function(complete) {
		utils.request(url + 'a/b/c/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			complete();
		});
	});

	async.await('logged', function(complete) {
		utils.request(url + 'logged/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			complete();
		});
	});

	async.await('timeout', function(complete) {
		utils.request(url + 'timeout/', 'GET', null, function(error, data, code, headers) {
			assert(data === '408', 'timeout problem');
			complete();
		});
	});

	async.complete(function() {
		next && next();
	});
};

function run() {

	if (max <= 0) {

		framework.fs.rm.view('fromURL');

		assert.ok(framework.global.header > 0, 'partial - global');
		assert.ok(framework.global.partial > 0, 'partial - partial');

		console.log('Max   :', memMax);
		console.log('Leak  :', memLeak);
		console.timeEnd('new');
		console.log('');
		console.log(framework.stats);
		console.log('');
		console.log('----------------------------');
		console.log('');
		end();
		return;
	}

	max--;
	test_controller_functions(function() {
		test_view_functions(function() {
			test_view_error(function() {
				test_routing(function() {
					run();
				});
			});
		});
	});
}

var mem = require('memwatch');
var memMax = 0;
var memLeak = 0;

mem.on('leak', function(info) {
	memLeak++;
});

mem.on('stats', function(info) {
	memMax = Math.max(memMax, info.max);
	console.log('STATS ->', JSON.stringify(info));
});

framework.fs.create.view('fromURL', 'http://partialjs.com/framework/test.html');

setTimeout(function() {
	console.time('new');
	run();
}, 500);