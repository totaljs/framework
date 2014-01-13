var assert = require('assert');

exports.onMeta = function(a,b) {
	return a + b;
};

exports.onSettings = function(a,b) {
	return a + b;
};

exports.onPictureDimension = function(dimension) {

	switch(dimension) {
		case 'small':
			return { width: 128, height: 96 };
		case 'middle':
			return { width: 320, height: 240 };
	}

	return null;
};

exports.onLoad = function() {
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
	self.global.partial = 0;
	self.global.timeout = 0;

	self.partial(function(next) {
		self.global.header++;
		next();
	});

	self.partial('partial', function(next) {
		self.global.partial++;
		next();
	});
};

exports.onPictureUrl = function(dimension, id, width, height, alt) {
	return dimension + '-' + id + '.jpg';
};

exports.onValidation = function(name, value) {
	return name + value;
};