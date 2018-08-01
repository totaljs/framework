var utils = require('../utils');
var assert = require('assert');
var framework = require('../index');
var fs = require('fs');
var url = 'http://127.0.0.1:8001/';
var errorStatus = 0;
var max = 100;

// INSTALL('module', 'https://www.totaljs.com/framework/include.js', { test: true });

//framework.map('/minify/', '@testpackage', ['.html', 'js']);
//framework.map('/minify/', 'models');
//framework.map('/minify/', F.path.models());
framework.onCompileView = function(name, html, model) {
	return html + 'COMPILED';
};

framework.onLocate = function(req) {
	return 'sk';
};

framework.on('ready', function() {
	var t = framework.worker('test');
	var a = false;
	t.on('message', function(msg) {
		if (msg === 'assert')
			a = true;
	});
	t.on('exit', function() {
		assert.ok(a === true, 'F.load() in worker');
	});
});

framework.onAuthorize = function(req, res, flags, cb) {
	req.user = { alias: 'Peter Širka' };
	req.session = { ready: true };
	cb(req.url !== '/unauthorize/');
};

framework.onError = function(error, name, uri) {

	if (errorStatus === 0) {
		console.log(error, name, uri);
		console.log(error.stack);
		framework.stop();
		return;
	}

	if (errorStatus === 1) {
		assert.ok(error.toString().indexOf('not found') !== -1, 'view: not found problem');
		errorStatus = 0;
		return;
	}
};

function end() {
	console.log('');
	console.log('Requests count:', framework.stats.request.request);
	console.log('');
	console.log('================================================');
	console.log('success - OK');
	console.log('================================================');
	console.log('');
	framework.stop();
}

function test_controller_functions(next) {
	utils.request(url, 'GET', null, function(error, data, code, headers) {

		if (error)
			assert.ok(false, 'test_controller_functions: ' + error.toString());

		assert.ok(code === 404, 'controller: statusCode ' + code);
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

	var async = new utils.Async();

	async.await('robot - 1', function(complete) {
		utils.request(url + '', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'ROBOT', 'robot routing problem 1');
			complete();
		}, null, { 'user-agent': 'I am Crawler' });
	});

	async.complete(function() {
		next && next();
	});
}

function run() {

	if (max <= 0) {

		console.timeEnd('TEST');

		assert.ok(framework.global.middleware > 0, 'middleware - middleware');
		assert.ok(framework.global.theme > 0, 'theme - initialization');
		assert.ok(framework.global.all > 0, 'middleware - global');
		assert.ok(framework.global.file > 0, 'middleware - file');
		assert.ok(framework.global.timeout > 0, 'timeout');

		UNINSTALL('source', { uninstall: true });
		UNINSTALL('view', 'precompile._layout');

		framework.uninstall('precompile', 'precompile.homepage');
		framework.clear();

		setTimeout(function() {
			end();
		}, 2000)
		return;
	}

	max--;
	test_routing(function() {
		run();
	});
}

/*
var mem = require('memwatch');

mem.on('leak', function(info) {
	console.log('LEAK ->', info);
});

mem.on('stats', function(info) {
	console.log('STATS ->', JSON.stringify(info));
});
*/
// framework.fs.create.view('fromURL', 'http://www.totaljs.com/framework/test.html');

framework.on('load', function() {

	F.merge('/mergepackage.js', '@testpackage/test.js');
	F.merge('/mergedirectory.js', '~' + F.path.public('js') + '*.js');

	assert.ok(MODULE('supermodule').ok, 'load module from subdirectory');
	assert.ok(F.config['custom-config1'] === '1YES', 'custom configuration 1');
	assert.ok(F.config['custom-config2'] === '2YES', 'custom configuration 2');
	assert.ok(RESOURCE('default', 'name-root').length > 0, 'custom resource mapping 1');
	assert.ok(RESOURCE('default', 'name-theme').length > 0, 'custom resource mapping 2');

	setTimeout(function() {
		console.time('TEST');
		run();
	}, 2000);
});

framework.useConfig('my-config.txt').useConfig('/configs/my-config.config').http('debug', { port: 8001 });