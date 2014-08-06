var assert = require('assert');

exports.run = function(framework) {

  framework.assert('/', ['GET'], function(error, data, code, headers, cookies, name) {
    assert.ok(code === 200, name);
  });

};