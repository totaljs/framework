var assert = require('assert');

exports.install = function(framework) {
	framework.route('/logged/', view_logged, { flags: ['authorize'], timeout: 1000, length: 3000 });
	framework.route('/unauthorize/', view_unauthorize, { flags: ['unauthorize'] });
	framework.route('/homepage/', view_homepage);
	framework.route('/usage/', view_usage);
	framework.route('/sse/', viewSSE_html);
	framework.route('/pipe/', pipe);
	framework.route('/app/*', asterix);
	framework.route('/sse/', viewSSE, ['sse']);
	framework.route('/http/', viewHTTP, ['http']);
	framework.route('/https/', viewHTTPS, ['https']);
	framework.route('/dynamic/', viewDynamic);
	framework.route('/f/', viewSocket);
	framework.route('/js/', viewJS);
	framework.route('/', viewIndex);
	framework.route('/cookie/', view_cookie);
	framework.route('/layout/', view_layout);
	framework.route('/custom/', viewCustomTesting);
	framework.route('/views/', viewViews, [], ['partial']);
	framework.route('/view-notfound/', viewError);
	framework.route('/views-if/', viewViewsIf);
	framework.route('/{a}/', viewRouteA);
	framework.route('/{a}/{b}/', viewRouteAB);
	framework.route('/a/{a}/', viewRouteAA);
	framework.route('/a/b/c/', viewRouteABC);
	framework.route('/test/', viewTest);
	framework.route('/test-view/', view_test_view);
	framework.route('/login/google/callback/', aa);
	framework.route('/timeout/', function() {}, [], null, [], 50);
	
	framework.file('Resizing of images', function(req, res) {
		return req.url.indexOf('.jpg') !== -1;
	}, resize_image);

	framework.route('/live/', viewLive);
	framework.route('/live/incoming/', viewLiveIncoming, ['mixed']);

	framework.redirect('http://www.google.sk', 'http://www.petersirka.sk');

	framework.route('#408', function() {
		var self = this;
		self.global.timeout++;
		self.plain('408');
	}, []);

	assert.ok(framework.encrypt('123456', 'key', false) === 'MjM9QR8HExlaHQJQBxcGAEoaFQoGGgAW', 'framework.encrypt(string)');
	assert.ok(framework.decrypt('MjM9QR8HExlaHQJQBxcGAEoaFQoGGgAW', 'key', false) === '123456', 'framework.decrypt(string)');

	assert.ok(framework.encrypt({ name: 'Peter' }, 'key', false) === 'MzM9QVUXTkwCThBbF3RXQRlYBkUFVRdOTAJOEFsXdFdBGQ', 'framework.encrypt(object)');
	assert.ok(framework.decrypt('MzM9QVUXTkwCThBbF3RXQRlYBkUFVRdOTAJOEFsXdFdBGQ', 'key').name === 'Peter', 'framework.decrypt(object)')

	assert.ok(source('main').hello() === 'world', 'source');
	assert.ok(include('main').hello() === 'world', 'source');

	framework.route('/basic/', viewBAA);

	// url
	// function
	// flags [json, logged, unlogged]
	// protocols []
	// allow []
	// maximumSize
	framework.websocket('/', socket);
};

function resize_image(req, res) {
	var fs = require('fs');
//	this.responseImage(req, res, fs.createReadStream(this.path.public(req.url)), function(image) {
	this.responseImage(req, res, this.path.public(req.url), function(image) {
		image.resize('20%');
	});
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
	this.plain(this.framework.usage(true));
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

function viewCustomTesting() {
	this.plain(this.template('one', [{ name: 'A', price: 10, B: false }, { name: 'B', price: 10.5, B: true }]));
}

function socket(self, framework) {

	self.on('open', function (client) {
		console.log('open ->', client.id);
		console.log(client.get);
	});

	self.on('close', function (client) {
		console.log('close ->', client.id);
	});

	self.on('message', function (client, message) {
		console.log('message ->', client.id, message);

		if (message === 'disconnect')
			client.close();
	});

	self.on('error', function(error, client) {
		console.log('error –>', error);
	});
}

function aa() {
	this.json(this.get);
}

function viewTest() {
	this.layout('');
	this.view('e');
}

function viewDynamic() {
	this.view('<b>@{model.name}</b>', { name: 'Peter' });
}

function viewIndex() {

	var self = this;
	var name = 'controller: ';

	assert.ok(self.path.public('file.txt') === './public/file.txt', name + 'path.public');
	assert.ok(self.path.logs('file.txt') === './logs/file.txt', name + 'path.logs');
	assert.ok(self.path.temp('file.txt') === './tmp/file.txt', name + 'path.temp');

	self.meta('A', 'B');
	assert.ok(self.repository['$title'] === 'A' && self.repository['$description'] === 'B', name + 'meta() - write');

	self.sitemap('A', '/');
	assert.ok(self.sitemap()[0].name === 'A', name + 'sitemap() - write');

	assert.ok(self.module('hatatitla') === null, name + 'module(not exists) - read');
	assert.ok(self.module('test').message() === 'message', name + 'module(exists) - read');

	self.layout('test');
	assert.ok(self.layoutName === 'test', name + 'layout()');

	assert.ok(self.functions('share').message() === 'message', name + 'functions()');
	assert.ok(self.model('user').ok === 1, name + 'model()');
	assert.ok(framework.model('user').ok === 1, 'framework: model()');

	assert.ok(self.isSecure === false, 'controller.isSecure');
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

	assert.ok(self.routeJS('p.js') === '/js/p.js', name + 'routeJS()');
	assert.ok(self.routeCSS('p.css') === '/css/p.css', name + 'routeCSS()');
	assert.ok(self.routeImage('p.jpg') === '/img/p.jpg', name + 'routeImage()');
	assert.ok(self.routeVideo('p.avi') === '/video/p.avi', name + 'routeVideo()');
	assert.ok(self.routeFont('p.woff') === '/font/p.woff', name + 'routeFont()');
	assert.ok(self.routeDownload('p.pdf') === '/download/p.pdf', name + 'routeDownload()');
	assert.ok(self.routeStatic('/p.zip') === '/p.zip', name + 'routeStatic()');

	self.currentTemplate('current');

	assert.ok(self.template('test', ['A', 'B'], { name: '' }) === '<div>AB</div>', name + 'template - no repository');
	assert.ok(self.template('test', ['A', 'B'], '', { name: 'ABCDEFG' }) === '<div>AB</div>...', name + 'template - repository');
	assert.ok(self.template('test', [], 'test') === 'EMPTY', name + 'template - empty');	
	self.layout('');
	assert.ok(self.view('test', null, true) === 'total.js', name + 'view');
	assert.ok(self.content('test', true) === 'EMPTY', name + 'content');
	assert.ok(self.url === '/', name + 'url');

	var error = self.validate({ A: 'B' }, ['A']);
	assert.ok(error.hasError() && error.read('A') === 'AB', 'framework.onValidation & controller.validation');

	self.status = 404;
	self.plain('OK');
}

function viewViews() {
	var name = 'views: ';
	var self = this;

	self.repository.arr = ['Q', 'R', 'S'];
	self.repository.title = 'TEST';
	self.repository.tag = '<b>A</b>';
	self.repository.optionsEmpty = [{ name: 'A', value: 'A' }, { name: 'B', value: 'B' }];
	self.repository.options = [{ k: 'C', v: 'C' }, { k: 'D', v: 'D' }];
	self.repository.template = [{ name: 'A', price: 10, B: false }, { name: 'B', price: 10.5, B: true }];

	var output = self.view('a', { a: 'A', b: 'B', arr: ['1', '2', '3'] }, true);
	
	//console.log('\n\n\n');
	//console.log('###' + output + '###');
	//console.log('\n\n\n');
	//self.framework.stop();
	//return;
	//console.log(output);
	assert.ok(output.contains('var d="$\'"'), name + 'JS script special chars 1');
	assert.ok(output.contains("var e='$\\'';"), name + "JS script special chars 2");
	assert.ok(output.contains('<script type="text/template"><textarea>\na</textarea>a</script>'), name + ' minify html');
	assert.ok(output.contains('#tag-encode&lt;b&gt;A&lt;/b&gt;#'), name + 'encode value');
	assert.ok(output.contains('#tag-raw<b>A</b>#'), name + 'raw value');
	assert.ok(output.contains('#helper-property-OK#'), name + 'helper property');
	assert.ok(output.contains('#helper-fn-A#'), name + 'helper function');
	assert.ok(output.contains('#readonly readonly="readonly"#'), name + 'readonly()');
	assert.ok(output.contains('#checked checked="checked"#'), name + 'checked()');
	assert.ok(output.contains('#selected selected="selected"#'), name + 'selected()');
	assert.ok(output.contains('#disabled disabled="disabled"#'), name + 'disabled()');
	assert.ok(output.contains('#resourcedefault#'), name + 'resource()');
	assert.ok(output.contains('#options-empty<option value="A">A</option><option value="B" selected="selected">B</option>#'), name + 'options() - without property name and value');
	assert.ok(output.contains('#options<option value="C" selected="selected">C</option><option value="D">D</option>#'), name + 'options() - with property name and value');
	assert.ok(output.contains('#view#bmodel##'), name + 'view() with model');
	assert.ok(output.contains('#view-toggle#'), name + 'viewToggle()');
	assert.ok(output.contains('#contentEMPTY#'), name + 'content');
	assert.ok(output.contains('#content-toggle#'), name + 'contentToggle');
	assert.ok(output.contains('#componentCOMPONENT#'), name + 'component');
	assert.ok(output.contains('#titleTITLE#'), name + 'title');
//	template-one<div>10.00</div><div>10</div><div>A</div><div>other</div><div>10.50</div><div>10.5</div><div>B</div><div>other</div>
//	template-one<div>10.00</div><div>10</div><div>A</div><div>zero</div><div>10.50</div><div>10.5</div><div>B</div><div>one</div>
	assert.ok(output.contains('#template-one<div>10.00</div><div>10</div><div>A</div><div>zero</div><div>D</div><div>10.50</div><div>10.5</div><div>B</div><div>one</div><div>C</div>#'), name + 'template() - one');
	assert.ok(output.contains('#template-more<ul><li>A</li><li>B</li></ul>#'), name + 'template() - more');
	assert.ok(output.contains('#template-emptyEMPTY#'), name + 'template() - empty');
	assert.ok(output.contains('#template-toggle#'), name + 'templateToggle()');
	assert.ok(output.contains('#routejs-/js/p.js#'), name + 'route to static');
	assert.ok(output.contains('#<a href="/download/test.pdf" download="test">content</a>#'), name + 'download');

	assert.ok(output.contains('<link rel="dns-prefetch" href="//fonts.googleapis.com" />'), name + 'dns');
	assert.ok(output.contains('<link rel="prefetch" href="http://daker.me/2013/05/hello-world.html" />'), name + 'prefetch');
	assert.ok(output.contains('<link rel="prerender" href="http://daker.me/2013/05/hello-world.html" />'), name + 'prerender');
	assert.ok(output.contains('<link rel="canonical" href="http://127.0.0.1:8001/a/a-b-c/" />'), name + 'canonical');
	assert.ok(output.contains('<link rel="next" href="http://127.0.0.1:8001/a/3/" />'), name + 'next');
	assert.ok(output.contains('<link rel="prev" href="http://127.0.0.1:8001/a/1/" />'), name + 'prev');
	assert.ok(output.contains('<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/2.0.0/jquery.min.js"></script>'), name + 'head');

	assert.ok(output.contains('src="/js/jquery.js"'), name + 'place (routeJS)');
	assert.ok(output.contains('src="//fabricjs.js"'), name + 'place');
	assert.ok(output.contains('#dynamic<b>OK</b>#'), name + 'dynamic view');

	self.repository.A = 'A';

	self.currentView('current');
	output = self.view('c', { a: 'A', b: 'B', c: true, d: 'hidden<b>' }, true);

	assert.ok(output.contains('<input type="text" name="a" id="a" class="bootstrap" value="A" />'), name + 'text');
	assert.ok(output.contains('<input type="hidden" name="d" id="d" value="hidden&lt;b&gt;" />'), name + 'hidden');
	assert.ok(output.contains('<label><input type="checkbox" name="c" id="c" checked="checked" value="1" /> <span>test label</span></label>'), name + 'checkbox');
	assert.ok(output.contains('<textarea name="b" id="b" class="myarea">B</textarea>'), name + 'textarea');
	assert.ok(output.contains('#ACAXXX#'), name + 'if');
	assert.ok(output.contains('<label><input type="radio" name="a" checked="checked" value="A" /> <span>test label</span></label>'), name + 'radio');

	self.json({ r: true });
}

function viewViewsIf() {
	var self = this;
	self.layout('');
	self.repository.A = 'A';
	self.view('current/c', { a: 'A', b: 'B' });
}

function viewError() {
	var self = this;
	var template = self.template('asdljsald', [1, 2, 3]);
	assert.ok(template === '', 'template: not found problem');
	assert.ok(self.content('asdasd') === '', 'content: not found problem');
	self.view('asdlkjasl');
}

function viewRouteA() {
	var self = this;
	assert.ok(self.url === '/a/', 'routing: viewRouteA');
	self.plain('OK');
}

function viewRouteAB() {
	var self = this;
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
	self.res.cookie('cookie1', '1', new Date().add('d', 1));
	self.res.cookie('cookie2', '2', new Date().add('d', 1));
	self.res.cookie('cookie3', '3', new Date().add('d', 1));
	self.res.cookie('cookie4', '4', new Date().add('d', 1));
	self.plain('cookie');
}

function viewHTTP() {
	this.plain('HTTP');
}

function viewHTTPS() {
	this.plain('HTTPS');
}