var assert = require('assert');

exports.install = function(framework) {
    setTimeout(function() {
        assert.ok(framework.view('view') === '<div>total.js</div><script>var a=1+1;</script>', 'framework.view()');
    }, 100);
};