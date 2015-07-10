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

framework.onAuthorization = function(req, res, flags, cb) {
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

	var async = new utils.Async();

	async.await('html compressor', function(complete) {
		utils.request(url + 'html-compressor/', ['get'], null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '<div><p>a b c d</p><div>Price 30 &euro;</div></div><div>Name: Peter</div><div>Name: Peter</div><div>Price: 1000 1 000.00</div><div>13</div><div>Name: Peter</div>', 'HTML compressor');
			complete();
		});
	});

	async.await('html nocompress', function(complete) {
		utils.request(url + 'html-nocompress/', ['get'], null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data.indexOf('<div>\nA\n</div>') !== -1, 'HTML nocompress');
			complete();
		});
	});

	async.await('0', function(complete) {
		utils.request(url + 'share/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(data === 'OK', 'controller view directory');
			complete();
		});
	});

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

	async.await('sync', function(complete) {
		utils.request(url + 'sync/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(data === 'TEST', 'generator problem');
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

	async.await('router', function(complete) {
		utils.request(url + 'routeto/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'dilino gadzo', 'problem with controller.routeTo()');
			complete();
		});
	});

	async.await('mobile - 1', function(complete) {
		utils.request(url + 'mobile/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(headers['vary'] === 'Accept-Encoding, User-Agent', 'mobile device user-agent problem 1');
			assert(data !== 'X', 'mobile device routing problem 1');
			complete();
		});
	});

	async.await('mobile - 2', function(complete) {
		utils.request(url + 'mobile/?ok=true', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(headers['vary'] === 'Accept-Encoding, User-Agent', 'mobile device user-agent problem 2');
			assert(data === 'X', 'mobile device routing problem 2');
			complete();
		}, null, { 'user-agent': 'bla bla iPad bla' });
	});

	async.await('binary', function(complete) {
		utils.request(url + 'binary/', ['get'], null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'čťž', 'binary');
			complete();
		});
	});

	async.await('rest GET', function(complete) {
		utils.request(url + 'rest/', ['get'], null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'GET', 'REST - GET');
			complete();
		});
	});

	async.await('rest HEAD', function(complete) {
		utils.request(url + 'rest/', ['head'], null, function(error, data, code, headers) {
 			if (error)
				throw error;
			assert(data === '', 'REST - HEAD');
			complete();
		});
	});

	async.await('rest DELETE', function(complete) {
		utils.request(url + 'rest/', ['delete'], null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'DELETE', 'REST - DELETE');
			complete();
		});
	});

	async.await('rest POST', function(complete) {
		utils.request(url + 'rest/', ['post', 'json'], { success: true }, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'POST', 'REST - POST (JSON)');
			complete();
		});
	});

	async.await('rest PUT', function(complete) {
		utils.request(url + 'rest/', ['put', 'json'], { success: true }, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'PUT', 'REST - PUT (JSON)');
			complete();
		});
	});

	async.await('translate', function(complete) {
		utils.request(url + 'translate/?language=', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '---translate---######', 'translate problem (EN)');
			utils.request(url + 'translate/?language=sk', 'GET', null, function(error, data, code, headers) {
				if (error)
					throw error;
				assert(data === '---preklad---###preklad###', 'translate problem (SK)');
				complete();
			});
		});
	});

	async.await('custom', function(complete) {
		utils.request(url + 'custom/route/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'CUSTOM', 'custom route problem');
			complete();
		});
	});

/*
	async.await('pipe', function(complete) {
		utils.request(url + 'pipe/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(data.toString('utf8').indexOf('telephone=no') !== -1, 'controller.pipe() / responsePipe() problem');
			complete();
		});
	});
*/
	async.await('asterix', function(complete) {
		utils.request(url + 'app/a/b/c/d', 'GET', null, function(error, data, code, headers) {
			assert(data === 'ASTERIX', 'asterix routing problem');
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


	async.await('package/', function(complete) {
		utils.request(url + 'package/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(data === '<div>PACKAGELAYOUT</div><div>PACKAGEVIEW</div>', 'package view problem');
			complete();
		});
	});

	async.await('precompile', function(complete) {
		utils.request(url + 'precompile/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(data.indexOf('precompile') === -1, 'framework.precompile() problem');
			complete();
		});
	});

	async.await('subshare', function(complete) {
		utils.request(url + 'sub/share/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'SUBSHARE', 'problem with controller in subdirectory.');
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

	async.await('unauthorize', function(complete) {
		utils.request(url + 'unauthorize/', 'GET', null, function(error, data, code, headers) {
			assert.ok(data === 'UNAUTHORIZED', 'unauthorize flag problem');
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

	async.await('http', function(complete) {
		utils.request(url + 'http/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'HTTP', 'HTTP flag routing problem');
			complete();
		});
	});

	async.await('get', function(complete) {
		utils.request(url + 'get/?name=total&age=30', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '{"name":"total","age":"30"}', 'get');
			complete();
		});
	});

	async.await('post-raw', function(complete) {
		utils.request(url + 'post/raw/', ['post', 'raw'], 'SALAMA', function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'SALAMA', 'post-raw');
			complete();
		});
	});

	async.await('post-schema', function(complete) {
		utils.request(url + 'post/schema/', ['post'], 'name=Peter123456789012345678901234567890#', function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '{"name":"Peter12345","type":"schema"}', 'post-schema');
			complete();
		});
	});

	async.await('post-schema-error', function(complete) {
		utils.request(url + 'post/schema/', ['post'], 'age=Peter123456789012345678901234567890#', function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '[{"name":"name","error":"default","path":"User.name"}]', 'post-schema 2');
			complete();
		});
	});

	async.await('post-json', function(complete) {
		utils.request(url + 'post/json/', ['json', 'post'], { name: 'total.js' }, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '{"name":"total.js","type":"json"}', 'post-json');
			complete();
		});
	});

	async.await('post-xml', function(complete) {
		utils.request(url + 'post/xml/', ['xml', 'post'], '<root><name>total.js</name></root>', function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '{"root.name":"total.js","type":"xml"}', 'post-xml');
			complete();
		});
	});

	async.await('post-parse', function(complete) {
		utils.request(url + 'post/parse/?value=query', ['post'], { name: 'total.js' }, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '{"name":"total.js","type":"parse"}', 'post-json');
			complete();
		});
	});

	async.await('put-raw', function(complete) {
		utils.request(url + 'put/raw/', ['put', 'raw'], 'SALAMA', function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'SALAMA', 'put-raw');
			complete();
		});
	});

	async.await('put-json', function(complete) {
		utils.request(url + 'put/json/', ['json', 'put'], { name: 'total.js' }, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '{"name":"total.js","type":"json"}', 'put-json');
			complete();
		});
	});

	async.await('put-xml', function(complete) {
		utils.request(url + 'put/xml/', ['xml', 'put'], '<root><name>total.js</name></root>', function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '{"root.name":"total.js","type":"xml"}', 'put-xml');
			complete();
		});
	});

	async.await('put-parse', function(complete) {
		utils.request(url + 'put/parse/', ['put'], { name: 'total.js' }, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '{"name":"total.js","type":"parse"}', 'put-json');
			complete();
		});
	});

	async.await('multiple GET', function(complete) {
		utils.request(url + 'multiple/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'POST-GET-PUT-DELETE', 'multiple (GET)');
			complete();
		});
	});

	async.await('multiple DELETE', function(complete) {
		utils.request(url + 'multiple/', ['delete'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'POST-GET-PUT-DELETE', 'multiple (DELETE)');
			complete();
		});
	});

	async.await('multiple POST', function(complete) {
		utils.request(url + 'multiple/', ['post'], { name: 'total.js' }, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'POST-GET-PUT-DELETE', 'multiple (POST)');
			complete();
		});
	});

	async.await('multiple PUT', function(complete) {
		utils.request(url + 'multiple/', ['put'], { name: 'total.js' }, function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'POST-GET-PUT-DELETE', 'multiple (PUT)');
			complete();
		});
	});

	async.await('regexp OK', function(complete) {
		utils.request(url + 'reg/exp/12345/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '12345', 'regexp routing');
			complete();
		});
	});

	async.await('regexp NO', function(complete) {
		utils.request(url + 'reg/exp/a12345/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(code === 404, 'regexp routing (NO)');
			complete();
		});
	});

	async.await('static-file', function(complete) {
		utils.request(url + 'robots.txt', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '/robots.txt', 'static file routing && res.send(STRING)');
			complete();
		});
	});

	async.await('static-file-middleware', function(complete) {
		utils.request(url + 'middleware.txt', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(JSON.parse(data).url === '/middleware.txt', 'static file routing with middleware && res.send(OBJECT)');
			complete();
		});
	});

	async.await('static-file-status', function(complete) {
		utils.request(url + 'status.txt', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '404: Not Found', 'static file routing && res.send(NUMBER)');
			complete();
		});
	});

	async.await('upload', function(complete) {
		utils.send(',;-test.txt', new Buffer('dG90YWwuanMgaXMga2luZyBvZiB3ZWI=', 'base64'), url + 'upload/', function(error, data, code, headers) {
			assert(data === '{"name":",;-test.txt","length":25,"type":"text/plain"}', 'upload');
			complete();
		});
	});

	async.await('cookie', function(complete) {
		utils.request(url + 'cookie/', 'GET', null, function(error, data, code, headers) {
			if (error)
				throw error;

			var cookie = headers['set-cookie'].join('');
			assert(cookie.indexOf('cookie1=1;') !== -1 && cookie.indexOf('cookie2=2;') !== -1 && cookie.indexOf('cookie3=3;') !== -1, 'Cookie problem.');
			complete();
		});
	});

	async.await('Authorize', function(complete) {
		utils.request(url + 'a/b/c/d/authorize/', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'authorize', 'Authorize problem.');
			complete();
		});
	});

	async.await('mapping', function(complete) {
		utils.request(url + 'fet.txt', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'TEST', 'static file mapping');
			complete();
		});
	});

	async.await('merge package', function(complete) {
		// mergepackage2 is from versions
		utils.request(url + 'mergepackage2.js', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'console.log(\'test\');', 'merge package');
			complete();
		});
	});

	async.await('virtual', function(complete) {
		utils.request(url + 'virtual.txt', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'TEST', 'virtual directory problem');
			complete();
		});
	});

	async.complete(function() {
		next && next();
	});
}

function run() {

	if (max <= 0) {

		console.timeEnd('TEST');
		framework.fs.rm.view('fromURL');

		assert.ok(framework.global.middleware > 0, 'middleware - middleware');
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

/*
var mem = require('memwatch');

mem.on('leak', function(info) {
	console.log('LEAK ->', info);
});

mem.on('stats', function(info) {
	console.log('STATS ->', JSON.stringify(info));
});
*/
framework.fs.create.view('fromURL', 'http://www.totaljs.com/framework/test.html');

framework.on('load', function() {

	framework.merge('/mergepackage.js', '@testpackage/test.js');
	assert.ok(MODULE('supermodule').ok, 'load module from subdirectory');
	assert.ok(F.config['custom-config1'] === '1YES', 'custom configuration 1');
	assert.ok(F.config['custom-config2'] === '2YES', 'custom configuration 2');

	setTimeout(function() {
		console.time('TEST');
		run();
	}, 2000);
});

framework.useConfig('my-config.txt').useConfig('/configs/my-config.config').http('debug', { port: 8001 });