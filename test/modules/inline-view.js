var assert = require('assert');

exports.dependencies = ['test'];
exports.installed = false;

exports.install = function(framework) {
    exports.installed = true;
    framework.route('/inline-view-route/');
    setTimeout(function() {
        assert.ok(framework.view('view') === '<div>total.js</div><script>var a=1+1;</script>', 'framework.view()');
    }, 100);
};