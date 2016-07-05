var assert = require('assert');

exports.dependencies = ['test'];
exports.installed = false;

exports.install = function() {
    exports.installed = true;
    framework.route('/inline-view-route/');
    setTimeout(function() {
        assert.ok(framework.view('view') === '<div>Total.js</div><script>var a=1+1;</script>', 'framework.view()');
    }, 100);
};