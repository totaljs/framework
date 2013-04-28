var assert = require('assert');
var utils = require('../../lib/utils');

exports.init = function() {
	var self = this;
	self.route('/js/', viewJS);
	self.route('/', viewIndex);
	self.route('/views/', viewViews);
	self.route('/view-notfound/', viewError);
	self.route('/views-if/', viewViewsIf);
	self.route('/{a}/', viewRouteA);
	self.route('/{a}/{b}/', viewRouteAB);
	self.route('/a/{a}/', viewRouteAA);
	self.route('/a/b/c/', viewRouteABC);
};

function viewIndex() {
	var self = this;
	var name = 'controller: ';

	assert.ok(self.pathPublic('file.txt') === './public/file.txt', name + 'pathPublic');
	assert.ok(self.pathLog('file.txt') === './logs/file.txt', name + 'pathLog');
	assert.ok(self.pathTemp('file.txt') === './tmp/file.txt', name + 'pathTemp');

	self.meta('A', 'B');
	assert.ok(self.repository['$meta'] === 'AB', name + 'meta() - write');

	self.sitemap('A', '/');
	assert.ok(self.sitemap()[0].name === 'A', name + 'sitemap() - write');

	self.settings('B','A');
	assert.ok(self.repository['$settings'] === 'BA', name + 'settings() - write');

	assert.ok(self.module('hatatitla') === null, name + 'module(not exists) - read');
	assert.ok(self.module('test').message() === 'message', name + 'module(exists) - read');

	self.layout('test');
	assert.ok(self.internal.layout === 'test', name + 'layout()');

	assert.ok(self.functions('share').message() === 'message', name + 'functions()');
	assert.ok(self.models('share').user.name === 'Peter', name + 'models()');

	assert.ok(!self.xhr, name + 'xhr');
	assert.ok(!self.isXHR, name + 'isXHR');

	assert.ok(self.resource('name') === 'default' && self.resource('default', 'name') === 'default', name + 'resource(default)');
	assert.ok(self.resource('test', 'name') === 'test', name + 'resource(test.resource)');
	
	self.log('test');

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
	assert.ok(self.routeDocument('p.pdf') === '/upload/p.pdf', name + 'routeDocument()');
	assert.ok(self.routeStatic('/p.zip') === '/p.zip', name + 'routeStatic()');
	assert.ok(self.template('test', ['A', 'B']) === '<div>AB</div>{name | 1}', name + 'template - no repository');	
	assert.ok(self.template('test', ['A', 'B'], '', { name: 'ABCDEFG' }) === '<div>AB</div>A...', name + 'template - repository');
	assert.ok(self.template('test', [], 'test') === 'EMPTY', name + 'template - empty');
	assert.ok(self.view('test', null, true) === 'partial.js', name + 'view');		
	assert.ok(self.content('test') === 'EMPTY', name + 'content');
	assert.ok(self.url === '/', name + 'url');

	var error = self.validation({ A: 'B' }, ['A']);	
	assert.ok(error.hasError() && error.read('A') === 'AB', 'framework.onValidation & contrller.validation');

	self.statusCode = 404;
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
	self.repository.template = [{ name: 'A', price: 10 }, { name: 'B', price: 10.5 }];

	var output = self.view('a', { a: 'A', b: 'B', arr: ['1', '2', '3'] }, true);
	
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
	assert.ok(output.contains('#template-one<div>10.00</div><div>10</div><div>10.50</div><div>10.5</div>#'), name + 'template() - one');
	assert.ok(output.contains('#template-more<ul><li>A</li><li>B</li></ul>#'), name + 'template() - more');
	assert.ok(output.contains('#template-emptyEMPTY#'), name + 'template() - empty');
	assert.ok(output.contains('#template-toggle#'), name + 'templateToggle()');
	assert.ok(!output.contains('<!--'), name + 'minify html');
	assert.ok(output.contains('#routejs-/js/p.js#'), name + 'route to static');

	self.repository.A = 'A';
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
	self.view('c', { a: 'A', b: 'B' });
};

function viewError() {
	var self = this;
	assert.ok(self.template('asdljsald', [1, 2, 3]) === '', 'template: not found problem');
	assert.ok(self.content('asdasd') === '', 'content: not found problem');
	self.view('asdlkjasl');
};

function viewRouteA() {
	var self = this;
	assert.ok(self.url === '/a/', 'routing: viewRouteA');
	self.plain('OK');
};

function viewRouteAB() {
	var self = this;
	assert.ok(self.url === '/c/b/', 'routing: viewRouteAB');
	self.plain('OK');
};

function viewRouteAA(a) {
	var self = this;
	assert.ok(a === 'aaa', 'routing: viewRouteAA');
	assert.ok(self.url === '/a/aaa/', 'routing: viewRouteAA');
	self.plain('OK');
};

function viewRouteABC() {
	var self = this;
	assert.ok(self.url === '/a/b/c/', 'routing: viewRouteABC');
	self.plain('OK');
};

function viewJS() {
	var self = this;
	self.layout('');
	self.view('d');
}
