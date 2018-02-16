var assert = require('assert');

exports.install = function() {

	F.localize('/templates/');

	F.route(function DEFER(url, req, flags) {
		return url === '/custom/route/';
	}, function DEFER() {
		this.plain('CUSTOM');
	});

	F.route('/logged/', view_logged, ['authorize', 1000], 3000);
	F.route('/unauthorize/', ['unauthorize'], view_unauthorize);

	F.route('/a/b/c/d/authorize/', ['authorize'], function() {
		this.plain('authorize');
	});

/*
	F.route('/', function() {
		this.plain('OK');
	}, ['unauthorize']);
*/
	F.route('/', function DEFER() {
		this.plain('ROBOT');
	}, ['robot']);

	GROUP(['get'], '/prefix1/', function() {
		ROUTE('/test/', function() {
			this.plain('PREFIX1TEST');
		});
	});

	GROUP('prefix2', ['get'], function() {
		ROUTE('/test/', function() {
			this.plain('PREFIX2TEST');
		});
	});

	F.route('#route');
	F.route('/view-in-modules/', '.' + F.path.modules('someview'));
	F.route('/options/', plain_options, ['options']);
	F.route('/exception/', 'exception');
	F.route('/html-compressor/', view_compressor);
	F.route('/html-nocompress/', view_nocompress);
	F.route('/sync/', synchronize);
	F.route('/schema-filter/', ['post', '*filter#update']);
	F.route('/package/', '@testpackage/test');
	F.route('/precompile/', view_precomile);
	F.route('/homepage/', view_homepage);
	F.route('/usage/', view_usage);
	F.route('/sse/', viewSSE_html);
	F.route('/pipe/', pipe);
	F.route('/binary/', binary);
	F.route('/mobile/', mobile, ['mobile']);
	F.route('/mobile/', mobile_none);
	F.route('/reg/exp/{/^\\d+$/}/', regexp);
	F.route('/app/*', asterix);
	F.route('/sse/', viewSSE, ['sse']);
	F.route('/http/', viewHTTP, ['http']);
	F.route('/https/', viewHTTPS, ['https']);
	F.route('/dynamic/', viewDynamic);
	F.route('/routeto/', viewRouteto);
	F.route('/f/', viewSocket);
	F.route('/js/', viewJS);
	F.route('/', viewIndex);
	F.route('/cookie/', view_cookie);
	F.route('/layout/', view_layout);
	F.route('/custom/', viewCustomTesting);
	F.route('/views/', viewViews, ['#middleware']);
	F.route('/view-notfound/', viewError);
	F.route('/views-if/', viewViewsIf);
	F.route('/{a}/', viewRouteA);
	F.route('/{a}/{b}/', viewRouteAB);
	F.route('/a/{a}/', viewRouteAA);
	F.route('/a/b/c/', viewRouteABC);
	F.route('/test/', viewTest);
	F.route('/translate/', viewTranslate);
	F.route('/test-view/', view_test_view);
	F.route('/login/google/callback/', aa);
	F.route('/timeout/', function DEFER() {}, [50]);

	F.route('/get/', plain_get);
	F.route('/post/raw/', plain_post_raw, ['post', 'raw']);
	F.route('/post/parse/', plain_post_parse, ['post']);
	F.route('/post/json/', plain_post_json, ['json']);
	F.route('/post/xml/', plain_post_xml, ['xml']);
	F.route('/multiple/', plain_multiple, ['post', 'get', 'put', 'delete']);
	F.route('/post/schema/', plain_post_schema_parse, ['post', '*test/User']);
	F.route('/rest/', plain_rest, ['post']);
	F.route('/rest/', plain_rest, ['put']);
	F.route('/rest/', plain_rest, ['get', 'head']);
	F.route('/rest/', plain_rest, ['delete']);
	F.route('/put/raw/', plain_put_raw, ['put', 'raw']);
	F.route('/put/parse/', plain_put_parse, ['put']);
	F.route('/put/json/', plain_put_json, ['json', 'put']);
	F.route('/put/xml/', plain_put_xml, ['xml', 'put']);
	F.route('/upload/', plain_upload, ['upload']);
	F.route('/index/', 'homepage');
	F.route('/live/', viewLive);
	F.route('/live/incoming/', viewLiveIncoming, ['mixed']);

	F.redirect('http://www.google.sk', 'http://www.petersirka.sk');

	F.route('#408', function DEFER() {
		var self = this;
		F.global.timeout++;
		self.plain('408');
	});

	assert.ok(F.encrypt('123456', 'key', false) === 'MjM9QR8HExlaHQJQBxcGAEoaFQoGGgAW', 'F.encrypt(string)');
	assert.ok(F.decrypt('MjM9QR8HExlaHQJQBxcGAEoaFQoGGgAW', 'key', false) === '123456', 'F.decrypt(string)');

	assert.ok(F.encrypt({ name: 'Peter' }, 'key', false) === 'MzM9QVUXTkwCThBbF3RXQRlYBkUFVRdOTAJOEFsXdFdBGQ', 'F.encrypt(object)');
	assert.ok(F.decrypt('MzM9QVUXTkwCThBbF3RXQRlYBkUFVRdOTAJOEFsXdFdBGQ', 'key').name === 'Peter', 'F.decrypt(object)')

	assert.ok(SOURCE('main').hello() === 'world', 'source');
	assert.ok(INCLUDE('main').hello() === 'world', 'source');

	F.route('/basic/', viewBAA);

	F.file(file_plain_middleware, ['#file']);
	F.file('/robots.txt', file_plain);
	F.file(file_plain_status);

	F.route('#401', function() {
		this.plain('401');
	});

	F.file((req) => req.url.indexOf('.jpg') !== -1, resize_image);

	// url
	// function
	// flags [json, logged, unlogged]
	// protocols []
	// allow []
	// maximumSize
	F.websocket('/', socket);
	F.route('/theme-green/', view_theme);
	F.cors('/api/*');
	F.cors('/cors/origin-all/');
	F.cors('/cors/origin-not/', ['http://www.petersirka.eu', 'http://www.858project.com']);
	F.cors('/cors/headers/', ['post', 'put', 'delete', 'options', 'X-Ping'], true);
};

function plain_options() {
	this.plain('OPTIONS');
}

function *synchronize() {
	var self = this;
	var content = (yield sync(require('fs').readFile)(self.path.public('file.txt'))).toString('utf8');
	self.plain(content);
}

function plain_rest() {
	this.plain(this.req.method);
}

function view_precomile() {
	var self = this;
	self.layout('precompile._layout');
	self.view('precompile.homepage');
}

function plain_multiple() {
	var self = this;
	self.plain('POST-GET-PUT-DELETE');
}

function plain_get() {
	var self = this;
	self.json(self.query);
}

function plain_post_raw() {
	var self = this;
	self.plain(self.body);
}

function plain_post_parse() {
	var self = this;
	self.layout('');
	var output = self.view('params', null, true);
	assert.ok(output === '--body=total.js--query=query--post=total.js--get=query--', 'Problem with getting values from request body and URL.');
	self.body.type = 'parse';
	self.json(self.body);
}

function plain_post_schema_parse() {
	var self = this;
	self.body.type = 'schema';
	self.json(self.body);
}

function plain_post_json() {
	var self = this;
	self.body.type = 'json';
	self.json(self.body);
}

function plain_post_xml() {
	var self = this;
	self.body.type = 'xml';
	self.json(self.body);
}

function plain_put_raw() {
	var self = this;
	self.plain(self.body);
}

function plain_put_parse() {
	var self = this;
	self.body.type = 'parse';
	self.json(self.body);
}

function plain_put_json() {
	var self = this;
	self.body.type = 'json';
	self.json(self.body);
}

function plain_put_xml() {
	var self = this;
	self.body.type = 'xml';
	self.json(self.body);
}

function plain_upload() {
	var self = this;
	var file = self.files[0];
	self.json({ name: file.filename, length: file.length, type: file.type });
}

function file_plain(req, res, is) {
	res.send(req.url);
}

function file_plain_middleware(req, res, isValidation) {
	if (isValidation)
		return req.url === '/middleware.txt';

	res.send({ url: req.url });
}

function file_plain_status(req, res, isValidation) {
	if (isValidation)
		return req.url === '/status.txt';

	res.send(404);
}

function resize_image(req, res) {
	var fs = require('fs');
	this.responseImage(req, res, fs.createReadStream(this.path.public(req.url)), function DEFER(image) {
		image.resize('20%');
	});
}

function viewRouteto() {
	var self = this;
	var result = self.transfer('/router/');
	assert.ok(result, 'controller.routeTo()');
}

function asterix() {
	this.plain('ASTERIX');
}

function view_homepage() {
	/*
	framework.server.getConnections(function(a, b, c) {
		console.log(a, b, c);
	});*/

	//console.log(framework.server._connection);

	console.log(this.hash('sha1', '123456', false));

	//this.view('homepage');
	this.plain(framework.usage(true));
}

function view_layout() {
	this.view('test');
}

function view_usage() {
	this.plain(this.framework.usage(true));
}

function viewBAA() {

	var user = this.baa();

	if (user === null)
		return;

	this.json(user);
}

function viewSSE_html() {
	this.view('g');
}

function view_logged() {
	var self = this;
	assert.ok(self.session.ready === true, 'Session problem');
	assert.ok(self.user.alias === 'Peter Širka', 'User problem');
	self.plain('OK');
}

function view_unauthorize() {
	var self = this;
	self.plain('UNAUTHORIZED');
}

function viewSSE() {
	var self = this;
	self.sse('TEST\n\nTEST');
}

function viewLiveIncoming(file) {
	console.log(file);
}

function viewSocket() {
	this.view('f');
}

function view_test_view() {
	this.view('test');
}

function viewCustomTesting() {/*
	this.plain(this.template('one', [{
		name: 'A',
		price: 10,
		B: false
	}, {
		name: 'B',
		price: 10.5,
		B: true
	}]));*/
	this.plain(this.template('new', [{ tag: '<b>A</b>' }, { tag: '<b>B</b>' }]));
	setTimeout(function DEFER() {
		framework.stop();
	}, 500);
}

function socket(self, framework) {

	self.on('open', function DEFER(client) {
		console.log('open ->', client.id);
		console.log(client.get);
	});

	self.on('close', function DEFER(client) {
		console.log('close ->', client.id);
	});

	self.on('message', function DEFER(client, message) {
		console.log('message ->', client.id, message);

		if (message === 'disconnect')
			client.close();
	});

	self.on('error', function DEFER(error, client) {
		console.log('error –>', error);
	});
}

function aa() {
	this.json(this.get);
}

function viewTest() {

	var name = 'views: ';
	var self = this;

	self.repository.arr = ['Q', 'R', 'S'];
	self.repository.title = 'TEST';
	self.repository.tag = '<b>A</b>';

	self.repository.optionsEmpty = [{
		name: 'A',
		value: 'A'
	}, {
		name: 'B',
		value: 'B'
	}];

	self.repository.options = [{
		k: 'C',
		v: 'C'
	}, {
		k: 'D',
		v: 'D'
	}];
	self.repository.template = [{
		name: 'A',
		price: 10,
		B: false
	}, {
		name: 'B',
		price: 10.5,
		B: true
	}];

	var output = self.view('a', {
		a: 'A',
		b: 'B',
		arr: ['1', '2', '3']
	});
}

function viewDynamic() {
	this.viewCompile('<b>@{model.name}</b>', { name: 'Peter' });
}

function viewTranslate() {
	this.language = this.query.language || '';
	this.view('translate');
}

function viewIndex() {

	var self = this;
	var name = 'controller: ';

	assert.ok(self.path.public('file.txt').endsWith('/public/file.txt'), name + 'path.public');
	assert.ok(self.path.logs('file.txt').endsWith('/file.txt'), name + 'path.logs');
	assert.ok(self.path.temp('file.txt').endsWith('/file.txt'), name + 'path.temp');

	self.meta('A', 'B');
	assert.ok(self.repository['$title'] === 'A' && self.repository['$description'] === 'B', name + 'meta() - write');

	assert.ok(self.module('hatatitla') === null, name + 'module(not exists) - read');
	assert.ok(self.module('test').message() === 'message', name + 'module(exists) - read');

	self.layout('test');
	assert.ok(self.layoutName === 'test', name + 'layout()');

	// assert.ok(self.functions('share').message() === 'message', name + 'functions()');
	assert.ok(self.model('user').ok === 1, name + 'model()');
	assert.ok(framework.model('user').ok === 1, 'framework: model() - 1');
	assert.ok(framework.model('other/products').ok === 2, 'framework: model() - 2');

	assert.ok(self.secured === false, 'controller.secured');
	assert.ok(self.config.isDefinition === true, 'definitions()');

	assert.ok(!self.xhr, name + 'xhr');
	assert.ok(self.flags.indexOf('get') !== -1, name + 'flags')

	assert.ok(self.resource('name') === 'default' && self.resource('default', 'name') === 'default', name + 'resource(default)');
	assert.ok(self.resource('test', 'name') === 'test', name + 'resource(test.resource)');

	self.log('test');

	assert.ok(self.hash('sha1', '123456', false) === '7c4a8d09ca3762af61e59520943dc26494f8941b', 'controller.hash()');

	self.setModified('123456');

	var date = new Date();
	date.setFullYear(1984);

	self.setModified(date);
	self.setExpires(date);

	assert.ok(self.routeScript('p.js') === '/js/p.js', name + 'routeScript()');
	assert.ok(self.routeStyle('p.css') === '/css/p.css', name + 'routeStyle()');
	assert.ok(self.routeImage('p.jpg') === '/img/p.jpg', name + 'routeImage()');
	assert.ok(self.routeVideo('p.avi') === '/video/p.avi', name + 'routeVideo()');
	assert.ok(self.routeFont('p.woff') === '/fonts/p.woff', name + 'routeFont()');
	assert.ok(self.routeDownload('p.pdf') === '/download/p.pdf', name + 'routeDownload()');
	assert.ok(self.routeStatic('/p.zip') === '/p.zip', name + 'routeStatic()');

	self.layout('');
	assert.ok(self.view('test', null, true) === 'Total.js', name + 'view');
	assert.ok(self.url === '/', name + 'url');

	self.status = 404;
	self.plain('OK');
}

function viewViews() {
	var name = 'views: ';
	var self = this;

	self.repository.arr = ['Q', 'R', 'S'];
	self.repository.title = 'TEST';
	self.repository.tag = '<b>A</b>';

	self.repository.a = 'a';
	self.repository.b = 'b';
	self.repository.c = 'c';

	self.repository.optionsEmpty = [{
		name: 'A',
		value: 'A'
	}, {
		name: 'B',
		value: 'B'
	}];

	self.repository.options = [{
		k: 'C',
		v: 'C'
	}, {
		k: 'D',
		v: 'D'
	}];
	self.repository.template = [{
		name: 'A',
		price: 10,
		B: false
	}, {
		name: 'B',
		price: 10.5,
		B: true
	}];

	var output = self.view('a', {
		a: 'A',
		b: 'B',
		arr: ['1', '2', '3']
	}, true);

	//console.log('###' + output + '###');
	//console.log('\n\n\n');
	//self.framework.stop();
	//return;

	assert.ok(output.contains('#COMPONENTVIEWPETER#'), name + 'components rendering');
	assert.ok(output.contains('#<div>@{{ vue_command }}</div>#'), name + 'VUE command');
	assert.ok(output.contains('#mobilefalse#'), name + 'mobile');
	assert.ok(output.contains('<count>10</count>'), name + 'inline helper');
	assert.ok(output.contains('<count>40</count><next>40</next>'), name + 'inline helper + condition');
	assert.ok(output.contains('HELPER:1-<count>1</count><next>0</next>'), name + 'inline helper + foreach 1');
	assert.ok(output.contains('HELPER:2-<count>2</count><next>1</next>'), name + 'inline helper + foreach 2');
	assert.ok(output.contains('<section>SECTION</section>'), name + 'section');
	assert.ok(output.contains('COMPILE_TANGULARCOMPILED'), name + 'onCompileView with name');
	assert.ok(output.contains('COMPILE_WITHOUTCOMPILED'), name + 'onCompileView without name');
	assert.ok(output.contains('<div>4</div><div>4</div><div>FOREACH</div>'), name + 'foreach');
	assert.ok(output.contains('<div>3</div><div>3</div><div></div><div>C:10</div><div>C:11</div><div>C:12</div>'), name + 'foreach - nested');
	assert.ok(output.contains('<INLINE>5</INLINE>'), name + 'Inline assign value');
	assert.ok(output.contains('var d="$\'"'), name + 'JS script special chars 1');
	assert.ok(output.contains("var e='$\\'';"), name + "JS script special chars 2");
	assert.ok(output.contains('<script type="text/template"><textarea>\na</textarea>a</script>'), name + ' minify html');
	assert.ok(output.contains('#tag-encode&lt;b&gt;A&lt;/b&gt;#'), name + 'encode value');
	assert.ok(output.contains('#tag-raw<b>A</b>#'), name + 'raw value');
	assert.ok(output.contains('#helper-fn-A#'), name + 'helper function');
	assert.ok(output.contains('#helper-fnwithout-A#'), name + 'helper function (without helper keyword)');
	assert.ok(output.contains('#readonly readonly="readonly"#'), name + 'readonly()');
	assert.ok(output.contains('#checked checked="checked"#'), name + 'checked()');
	assert.ok(output.contains('#selected selected="selected"#'), name + 'selected()');
	assert.ok(output.contains('#disabled disabled="disabled"#'), name + 'disabled()');
	assert.ok(output.contains('#resourcedefault#'), name + 'resource()');
	assert.ok(output.contains('#options-empty<option value="A">A</option><option value="B" selected="selected">B</option>#'), name + 'options() - without property name and value');
	assert.ok(output.contains('#options<option value="C" selected="selected">C</option><option value="D">D</option>#'), name + 'options() - with property name and value');
	assert.ok(output.contains('#view#bmodel##'), name + 'view() with model');
	assert.ok(output.contains('#view-toggle#'), name + 'viewToggle()');
	assert.ok(output.contains('#titleTITLE#'), name + 'title');
	assert.ok(output.contains('#routejs-/js/p.js#'), name + 'route to static');
	assert.ok(output.contains('#<a href="/download/test.pdf" download="test">content</a>#'), name + 'download');

	assert.ok(output.contains('<link rel="dns-prefetch" href="//fonts.googleapis.com" />'), name + 'dns');
	assert.ok(output.contains('<link rel="prefetch" href="http://daker.me/2013/05/hello-world.html" />'), name + 'prefetch');
	assert.ok(output.contains('<link rel="prerender" href="http://daker.me/2013/05/hello-world.html" />'), name + 'prerender');

	assert.ok(output.contains('<link rel="canonical" href="http://127.0.0.1:8001/a/a-b-c/" />'), name + 'canonical');
	assert.ok(output.contains('<link rel="next" href="http://127.0.0.1:8001/a/3/" />'), name + 'next');
	assert.ok(output.contains('<link rel="prev" href="http://127.0.0.1:8001/a/1/" />'), name + 'prev');
	assert.ok(output.contains('<script src="//ajax.googleapis.com/ajax/libs/jquery/2.0.0/jquery.min.js"></script>'), name + 'head');
	assert.ok(output.contains('PLACE'), name + 'place');
	assert.ok(output.contains('#dynamic<b>OK</b>#'), name + 'dynamic view');
	assert.ok(self.repository.INLINE === 6, name + 'INLINE assign 2');
	// console.log(output);
	assert.ok(output.contains('#RELEASETRANSLATOR1=A=A#'), name + 'INLINE TRANSLATOR FOR RELEASE MODE 1');
	assert.ok(output.contains('#RELEASETRANSLATOR2=A=A#'), name + 'INLINE TRANSLATOR FOR RELEASE MODE 2');
	assert.ok(output.contains('#absolute1=<script src="http://127.0.0.1:8001/js/filename.js"></script>#'), name + 'absolute problem without hostname');
	assert.ok(output.contains('#absolute2=<script src="https://www.google.sk/js/filename.js"></script>#'), name + 'aboslute problem with hostname');
	assert.ok(output.contains('#absolute3=<script src="http://localhost:8000/js/default.js"></script><script src="http://localhost:8000/js/home.js"></script>#'), name + 'aboslute problem array + with hostname');
	assert.ok(output.contains('#CONFIGNAME1=Total.js#'), name + 'inline config value with value');
	assert.ok(output.contains('#CONFIGNAME2=#'), name + 'inline config value without value');

	assert.ok(output.contains('#d429c9c776604a9e15d04d9bd90dba27e0155965=a+b+c#'), name + 'https://github.com/totaljs/framework/commit/d429c9c776604a9e15d04d9bd90dba27e0155965');

	self.repository.A = 'A';

	output = self.view('current/c', {
		a: 'A',
		b: 'B',
		c: true,
		d: 'hidden<b>'
	}, true);

	assert.ok(output.contains('<input type="text" name="a" id="a" class="bootstrap" value="A" />'), name + 'text');
	assert.ok(output.contains('<input type="hidden" name="d" id="d" value="hidden&lt;b&gt;" />'), name + 'hidden');
	assert.ok(output.contains('<label><input type="checkbox" name="c" id="c" checked="checked" value="1" /> <span>test label</span></label>'), name + 'checkbox');
	assert.ok(output.contains('<textarea name="b" id="b" class="myarea">B</textarea>'), name + 'textarea');
	assert.ok(output.contains('#ACAXXX#'), name + 'if');
	assert.ok(output.contains('<label><input type="radio" name="a" checked="checked" value="A" /> <span>test label</span></label>'), name + 'radio');
	assert.ok(output.contains('<div>NESTED</div>'), name + 'if - nested');
	assert.ok(output.contains('---<div>Hello World!</div><div>Price: 12</div>---'), name + '- "/" view path problem');

	F.script('next(value.toLowerCase())', 'PETER', function(err, val) {
		assert.ok(val ==='peter', 'SCRIPT: lowercase');
	});

	self.json({
		r: true
	});
}

function viewViewsIf() {
	var self = this;
	self.layout('');
	self.repository.A = 'A';
	self.view('current/c', {
		a: 'A',
		b: 'B'
	});
}

function viewError() {
	var self = this;
	self.view('asdlkjasl');
}

function viewRouteA() {
	var self = this;
	assert.ok(self.url === '/a/', 'routing: viewRouteA');
	self.plain('OK');
}

function viewRouteAB(a, b) {
	var self = this;
	var params = self.params;
	assert.ok(params.a === a, params.b === b, 'controller.params');
	assert.ok(self.url === '/c/b/', 'routing: viewRouteAB');
	self.plain('OK');
}

function viewRouteAA(a) {
	var self = this;
	assert.ok(a === 'aaa', 'routing: viewRouteAA');
	assert.ok(self.url === '/a/aaa/', 'routing: viewRouteAA');
	self.plain('OK');
}

function viewRouteABC() {
	var self = this;
	assert.ok(self.url === '/a/b/c/', 'routing: viewRouteABC');
	self.plain('OK');
}

function viewJS() {
	var self = this;
	self.layout('');
	self.view('d');
}

function viewLive() {

	var self = this;

	self.mixed.beg();
	self.mixed.send('/users/petersirka/desktop/aaaaa/1.jpg');

	setTimeout(function() {
		self.mixed.send('/users/petersirka/desktop/aaaaa/2.jpg', self.mixed.end.bind(self));
	}, 3000);
}

function pipe() {
	var self = this;
	self.pipe('http://www.totaljs.com/');
}

function view_cookie() {
	var self = this;

	assert.ok(self.req.cookie('a') === '1', 'request cookie problem 1');
	assert.ok(self.req.cookie('b') === '2', 'request cookie problem 2');
	assert.ok(self.req.cookie('c') === '3', 'request cookie problem 3');

	self.res.cookie('cookieR', 'O', new Date().add('d', 1));
	self.res.cookie('cookie1', '1', new Date().add('d', 1));
	self.res.cookie('cookie2', '2', new Date().add('d', 1));
	self.res.cookie('cookie3', '3', new Date().add('d', 1));
	self.res.cookie('cookie4', '4', new Date().add('d', 1));
	self.res.cookie('cookieR', 'N', new Date().add('d', 1));
	self.plain('cookie');
}

function viewHTTP() {
	this.plain('HTTP');
}

function viewHTTPS() {
	this.plain('HTTPS');
}

function view_compressor() {
	var self = this;
	self.view('compress', { name: 'Peter' });
}

function view_nocompress() {
	var self = this;
	self.view('nocompress');
}

function regexp(number) {
	this.plain(number);
}

function binary() {
	this.binary(Buffer.from('čťž'), 'text/plain', 'utf8');
}

function mobile() {
	this.plain('X');
}

function mobile_none() {
	this.plain('NO-MOBILE');
}

function view_theme() {
	var self = this;
	self.theme('green');
	self.view('index');
}