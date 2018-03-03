var utils = require('../utils');
var assert = require('assert');
var framework = require('../index');
var url = 'http://127.0.0.1:8001/';
var errorStatus = 0;
var max = 100;

//F.snapshot('/templates/localization.html', '/users/petersirka/desktop/localization.html');

// INSTALL('module', 'https://www.totaljs.com/framework/include.js', { test: true });

//framework.map('/minify/', '@testpackage', ['.html', 'js']);
//framework.map('/minify/', 'models');
//framework.map('/minify/', F.path.models());
framework.onCompileView = function(name, html) {
	return html + 'COMPILED';
};

framework.onLocale = function(req) {
	return !req.url.startsWith('/abc') ? 'sk' : '';
};

framework.on('ready', function() {
	var t = framework.worker('test');
	var a = false;
	t.on('message', function(msg) {
		if (msg === 'assert')
			a = true;
	});
	t.on('exit', () => assert.ok(a === true, 'F.load() in worker'));
	assert.ok(F.config.array.length === 4, 'Problem with config sub types.');
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
	utils.request(url, ['get'], function(error, data, code, headers) {
		error && assert.ok(false, 'test_controller_functions: ' + error.toString());
		assert.ok(code === 404, 'controller: statusCode ' + code);
		assert.ok(headers['etag'] === '1234561', 'controller: setModified(etag)');
		assert.ok(headers['last-modified'].toString().indexOf('1984') !== -1, 'controller: setModified(date)');
		next();
	});
}

function test_view_functions(next) {
	utils.request(url + 'views/', ['get'], function(error, data, code, headers) {

		if (error)
			assert.ok(false, 'test_view_functions: ' + error.toString());

		assert.ok(data === '{"r":true}', 'json');
		next();
	});
}

function test_view_error(next) {
	errorStatus = 1;
	utils.request(url + 'view-notfound/', ['get'], function(error, data, code, headers) {

		if (error)
			assert.ok(false, 'test_view_error: ' + error.toString());

		next();
	});
}

function test_routing(next) {

	var async = new utils.Async();

	async.await('cors 1', function(complete) {
		utils.request(url + '/cors/origin-all/', ['options'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(code === 200, 'CORS, problem with "*" origin');
			complete();
		}, null, { 'origin': 'https://www.totaljs.com' });
	});

	async.await('cors 2', function(complete) {
		utils.request(url + '/cors/origin-not/', ['options'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(code === 404, 'CORS, problem with origin (origin is not valid)');
			complete();
		}, null, { 'origin': 'https://www.totaljs.com' });
	});

	async.await('cors 3', function(complete) {
		utils.request(url + '/cors/origin-not/', ['options'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(code === 200, 'CORS, problem with origin (valid origin)');
			complete();
		}, null, { 'origin': 'http://www.petersirka.eu' });
	});

	async.await('cors asterix / wildcard', function(complete) {
		utils.request(url + '/api/whatever/you/need/', ['options'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(code === 200, 'CORS, problem with origin (wildcard routing)');
			complete();
		}, null, { 'origin': 'http://www.petersirka.eu' });
	});

	async.await('cors headers', function(complete) {
		utils.request(url + '/cors/headers/', ['options'], function(error, data, code, headers) {
			if (error)
				throw error;

			// "access-control-allow-origin" doesn't support * (wildcard) when "access-control-allow-credentials" is set to true
			// node.js doesn't support duplicates headers
			assert.ok(headers['access-control-allow-origin'] === 'http://www.petersirka.eu', 'CORS, headers problem 1');
			assert.ok(headers['access-control-allow-credentials'] === 'true', 'CORS, headers problem 2');
			assert.ok(headers['access-control-allow-methods'] === 'POST, PUT, DELETE, OPTIONS', 'CORS, headers problem 3');
			assert.ok(headers['access-control-allow-headers'] === 'x-ping', 'CORS, headers problem 4');
			complete();
		}, null, { 'origin': 'http://www.petersirka.eu' });
	});

	async.await('options', function(complete) {
		utils.request(url + 'options/', ['options'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(data === 'OPTIONS', 'OPTIONS method problem');
			complete();
		});
	});

	async.await('html compressor', function(complete) {
		utils.request(url + 'html-compressor/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '<div><p>a b c d</p><div>Price 30 &euro;</div></div><div>Name: Peter</div><div>Name: Peter</div><div>Price: 1000 1 000.00</div><div>1  3</div><div>Name: Peter</div>', 'HTML compressor');
			complete();
		});
	});

	async.await('html nocompress', function(complete) {
		utils.request(url + 'html-nocompress/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data.indexOf('<div>\nA\n</div>') !== -1, 'HTML nocompress');
			complete();
		});
	});

	async.await('0', function(complete) {
		utils.request(url + 'share/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(data === 'OK', 'controller view directory');
			complete();
		});
	});

	async.await('a', function(complete) {
		utils.request(url + 'a/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			complete();
		});
	});

	async.await('a/aaa', function(complete) {
		utils.request(url + 'a/aaa/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			complete();
		});
	});

	async.await('sync', function(complete) {
		utils.request(url + 'sync/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(data === 'TEST', 'generator problem');
			complete();
		});
	});

	async.await('a/b', function(complete) {
		utils.request(url + 'c/b/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			complete();
		});
	});

	async.await('router', function(complete) {
		utils.request(url + 'routeto/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'dilino gadzo', 'problem with controller.routeTo()');
			complete();
		});
	});

	async.await('mobile - 1', function(complete) {
		utils.request(url + 'mobile/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(headers['vary'] === 'Accept-Encoding, User-Agent', 'mobile device user-agent problem 1');
			assert(data !== 'X', 'mobile device routing problem 1');
			complete();
		});
	});

	async.await('mobile - 2', function(complete) {
		utils.request(url + 'mobile/?ok=true', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(headers['vary'] === 'Accept-Encoding, User-Agent', 'mobile device user-agent problem 2');
			assert(data === 'X', 'mobile device routing problem 2');
			complete();
		}, null, { 'user-agent': 'bla bla iPad bla' });
	});

	async.await('robot - 1', function(complete) {
		utils.request(url + '', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'ROBOT', 'robot routing problem 1');
			complete();
		}, null, { 'user-agent': 'I am Crawler' });
	});

	async.await('robot - 2', function(complete) {
		utils.request(url + '', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data !== 'ROBOT', 'robot routing problem 2');
			complete();
		}, null, { 'user-agent': 'Chrome' });
	});

	async.await('binary', function(complete) {
		utils.request(url + 'binary/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'čťž', 'binary');
			complete();
		});
	});

	async.await('localize', function(complete) {
		utils.request(url + 'templates/localization.html', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '###preklad###', 'file localization');
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
			assert(data.connection === 'close', 'REST - HEAD');
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
		utils.request(url + 'translate/?language=', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '---translate---######', 'translate problem (EN)');
			utils.request(url + 'translate/?language=sk', ['get'], function(error, data, code, headers) {
				if (error)
					throw error;
				assert(data === '---preklad---###preklad###', 'translate problem (SK)');
				complete();
			});
		});
	});

	async.await('custom', function(complete) {
		utils.request(url + 'custom/route/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'CUSTOM', 'custom route problem');
			complete();
		});
	});

	async.await('views in modules', function(complete) {
		utils.request(url + 'view-in-modules/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'VIEW IN MODULES', 'Problem with opened path in views.');
			complete();
		});
	});

	async.await('sitemap routing 1', function(complete) {
		utils.request(url + 'abcdefgh/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '#DEFAULT#', 'Sitemap routing and localization 1');
			complete();
		});
	});

	async.await('sitemap routing 2', function(complete) {
		utils.request(url + 'abcdefgh-sk/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '#SK#', 'Sitemap routing and localization 2');
			complete();
		});
	});

	async.await('asterix', function(complete) {
		utils.request(url + 'app/a/b/c/d', ['get'], function(error, data, code, headers) {
			assert(data === 'ASTERIX', 'asterix routing problem');
			if (error)
				throw error;
			complete();
		});
	});

	async.await('a/b/c/', function(complete) {
		utils.request(url + 'a/b/c/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			complete();
		});
	});

	async.await('prefix -- 1', function(complete) {
		utils.request(url + 'prefix1/test/', ['get'], function(error, data) {
			if (error)
				throw error;
			assert.ok(data === 'PREFIX1TEST', 'Group + Prefix 1');
			complete();
		});
	});

	async.await('prefix -- 2', function(complete) {
		utils.request(url + 'prefix2/test/', ['get'], function(error, data) {
			if (error)
				throw error;
			assert.ok(data === 'PREFIX2TEST', 'Group + Prefix 2');
			complete();
		});
	});

	async.await('package/', function(complete) {
		utils.request(url + 'package/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(data === '<div>PACKAGELAYOUT</div><div>PACKAGEVIEW</div>', 'package view problem');
			complete();
		});
	});

	async.await('precompile', function(complete) {
		utils.request(url + 'precompile/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert.ok(data.indexOf('precompile') === -1, 'framework.precompile() problem');
			complete();
		});
	});

	async.await('subshare', function(complete) {
		utils.request(url + 'sub/share/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'SUBSHARE', 'problem with controller in subdirectory.');
			complete();
		});
	});

	async.await('logged', function(complete) {
		utils.request(url + 'logged/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			complete();
		});
	});

	async.await('unauthorize', function(complete) {
		utils.request(url + 'unauthorize/', ['get'], function(error, data, code, headers) {
			assert.ok(data === 'UNAUTHORIZED', 'unauthorize flag problem');
			if (error)
				throw error;
			complete();
		});
	});

	async.await('timeout', function(complete) {
		utils.request(url + 'timeout/', ['get'], function(error, data, code, headers) {
			assert(data === '408', 'timeout problem');
			complete();
		});
	});

	async.await('http', function(complete) {
		utils.request(url + 'http/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'HTTP', 'HTTP flag routing problem');
			complete();
		});
	});

	async.await('get', function(complete) {
		utils.request(url + 'get/?name=total&age=30&page=30', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '{"name":"total","age":"30","page":30}', 'get');
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

	async.await('post-schema-filter', function(complete) {
		utils.request(url + 'schema-filter/', ['post'], 'EMPTY', function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '[{"name":"age","error":"The field \\"age\\" is invalid.","path":"filter.age","prefix":"age"}]', 'schema filter');
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
			assert(data === '[{"name":"name","error":"default","path":"User.name","prefix":"name"}]', 'post-schema 2');
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
		utils.request(url + 'post/xml/', ['xml', 'post'], '<root><name>total.js</name><page>20</page></root>', function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === '{"root.name":"total.js","root.page":20,"type":"xml"}', 'post-xml');
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

	async.await('components routing', function(complete) {
		utils.request(url + 'components/contactform/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'CONTACTFORM COMPONENTS', 'components: routing');
			complete();
		});
	});

	async.await('static-file-notfound-because-directory1', function(complete) {
		utils.request(url + 'directory.txt', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(code === 404, 'directory name as filename 1');
			complete();
		});
	});

	async.await('static-file-notfound-because-directory2', function(complete) {
		utils.request(url + 'directory.js', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(code === 404, 'directory name as filename 2');
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
		utils.upload([{ name: 'file', filename: ',;-test.txt', buffer: Buffer.from('dG90YWwuanMgaXMga2luZyBvZiB3ZWI=', 'base64') }], url + 'upload/', function(error, data, code, headers) {
			assert(data === '{"name":",;-test.txt","length":25,"type":"text/plain"}', 'upload');
			complete();
		});
	});

	async.await('cookie', function(complete) {
		utils.request(url + 'cookie/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;

			var cookie = headers['set-cookie'].join('');
			assert(cookie.indexOf('cookie1=1;') !== -1 && cookie.indexOf('cookie2=2;') !== -1 && cookie.indexOf('cookie3=3;') !== -1, 'Cookie problem.');
			assert(cookie.indexOf('cookieR=O;') === -1 && cookie.indexOf('cookieR=N;') !== -1 && cookie.indexOf('cookieR=') === cookie.lastIndexOf('cookieR='), 'Two cookies with same name');
			complete();
		}, { a: 1, b: 2, c: 3 });
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
			assert(data.indexOf('console.log(\'test\');') !== -1, 'merge package');
			complete();
		});
	});

	if (DEBUG) {
		async.await('merge directory', function(complete) {
			// mergepackage2 is from versions
			utils.request(url + 'mergedirectory.js', [], function(error, data, code, headers) {
				if (error)
					throw error;
				assert(data.indexOf('block.js') !== -1 && data.indexOf('test.js') !== -1, 'merge directory');
				complete();
			});
		});
	}

	async.await('merge-blocks-a', function(complete) {
		utils.request(url + 'merge-blocks-a.js', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data.indexOf('var common=true;var a=true;') !== -1, 'merge blocks - A');
			complete();
		});
	});

	async.await('merge-blocks-b', function(complete) {
		utils.request(url + 'merge-blocks-b.js', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data.indexOf('var common=true;var b=true;') !== -1, 'merge blocks - B');
			complete();
		});
	});

	async.await('mapping-blocks-a', function(complete) {
		utils.request(url + 'blocks-a.js', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data.indexOf('var common=true;var a=true;') !== -1, 'mapping blocks - A');
			complete();
		});
	});

	async.await('mapping-blocks-b', function(complete) {
		utils.request(url + 'blocks-b.js', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data.indexOf('var common=true;var b=true;') !== -1, 'mapping blocks - B');
			complete();
		});
	});

	async.await('mapping-blocks-c', function(complete) {
		utils.request(url + 'blocks-c.js', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data.indexOf('var common=true;var a=true;var b=true;') !== -1, 'mapping blocks - C');
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

	async.await('theme-green', function(complete) {
		utils.request(url + '/green/js/default.js', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'var a=1+1;', 'Themes: problem with static files.');
			complete();
		});
	});

	async.await('theme-green-merge', function(complete) {
		utils.request(url + '/merge-theme.js', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data.indexOf('var a=1+1;') !== -1 && data.indexOf('var b=2+2;'), 'Themes: problem with merging static files');
			complete();
		});
	});

	async.await('theme-green-map', function(complete) {
		utils.request(url + '/map-theme.js', [], function(error, data, code, headers) {
			if (error)
				throw error;
			assert(data === 'var a=1+1;', 'Themes: problem with mapping static files.');
			complete();
		});
	});

	async.await('theme-green', function(complete) {
		utils.request(url + 'theme-green/', ['get'], function(error, data, code, headers) {
			if (error)
				throw error;
			console.log('--->', data);
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
		}, 2000);
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
// framework.fs.create.view('fromURL', 'http://www.totaljs.com/framework/test.html');

framework.on('load', function() {

	F.merge('/mergepackage.js', '@testpackage/test.js');
	F.merge('/mergedirectory.js', '~' + F.path.public('js') + '*.js');

	assert.ok(MODULE('supermodule').ok, 'load module from subdirectory');
	assert.ok(F.config['custom-config1'] === '1YES', 'custom configuration 1');
	assert.ok(F.config['custom-config2'] === '2YES', 'custom configuration 2');
	assert.ok(RESOURCE('default', 'name-root').length > 0, 'custom resource mapping 1');
	assert.ok(RESOURCE('default', 'name-theme').length > 0, 'custom resource mapping 2');
	assert.ok(F.global.newslettercomponent, 'components: inline <script type="text/totaljs"> --> newsletter');
	assert.ok(F.global.schemas === 1, 'schemas are not loaded');

	var sa = F.sitemap_navigation();
	var sb = F.sitemap_navigation('b');

	assert.ok(sa[0].url === '/', 'F.sitemap_navigation()');
	assert.ok(sb[0].url === '/c/', 'F.sitemap_navigation("b")');

	setTimeout(function() {
		console.time('TEST');
		run();
	}, 2000);
});

framework.useConfig('my-config.txt').useConfig('/configs/my-config.config').http('debug', { port: 8001 });

process.on('uncaughtException', function(err) {
	console.error(err);
	process.exit(1);
});
