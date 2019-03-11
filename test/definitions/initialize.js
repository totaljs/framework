var assert = require('assert');

F.register(F.path.root('default.resource'));

framework.onMeta = function(a,b) {
	return a + b;
};

framework.onSettings = function(a,b) {
	return a + b;
};

framework.onPictureDimension = function(dimension) {

	switch(dimension) {
		case 'small':
			return { width: 128, height: 96 };
		case 'middle':
			return { width: 320, height: 240 };
	}

	return null;
};

framework.on('load', function() {
	var self = this;

	self.log = function(value) {
		assert.ok(value === 'test', 'framework: log()');
		return self;
	};

	self.helpers.property = 'OK';
	self.helpers.fn = function(a) {
		return a;
	};

	self.global.header = 0;
	self.global.middleware = 0;
	self.global.timeout = 0;
	self.global.file = 0;
	self.global.all = 0;

	self.middleware('each', function($) {
		self.global.all++;
		$.next();
	});

	self.middleware('middleware', function($) {
		self.global.middleware++;
		$.next();
	});

	self.middleware('file', function($) {
		self.global.file++;
		assert.ok($.req.isStaticFile === true, 'file middleware problem');
		$.next();
	});

	self.use('each');
});

framework.onPictureUrl = function(dimension, id, width, height, alt) {
	return dimension + '-' + id + '.jpg';
};

// Is read from http://www.totaljs.com/framework/include.js
//framework.precompile('precompile.layout', 'http://www.totaljs.com/framework/_layout.html');
//framework.precompile('precompile.homepage', 'http://www.totaljs.com/framework/homepage.html');