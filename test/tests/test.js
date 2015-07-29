var assert = require('assert');

exports.run = function() {

	framework.assert('validation assert', function(next, name) {
		assert('1' !== '2', name);
		next();
	});

  framework.assert('validation assert.ok', function(next, name) {
    assert.ok(true, name);
    next();
  });

};