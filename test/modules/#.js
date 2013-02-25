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

exports.onLoaded = function() {
	var self = this;

	self.log = function(value) {
		assert.ok(value === 'test', 'framework: log()');
		return self;
	};

};

exports.onPictureUrl = function(dimension, id, width, height, alt) {
	return dimension + '-' + id + '.jpg';
};