var assert = require('assert');

exports.installed = false;

exports.install = function() {
	exports.installed = true;
	ROUTE('/inline-view-route/');
	setTimeout(function() {
		assert.ok(VIEW('view') === '<div>Total.js</div><script>var a=1+1;</script>', 'VIEW()');
	}, 100);
};