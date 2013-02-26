var assert = require('assert');

exports.init = function() {
	var self = this;
	self.route('/', viewIndex);
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

	var picture = self.picture(1, 'small', 'photo');
	assert.ok(picture.id === 1 && picture.url === 'small-1.jpg' && picture.width === 128 && picture.height === 96, name + 'picture()');

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

	self.statusCode = 404;
	self.plain('OK');
}