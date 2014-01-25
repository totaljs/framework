var framework = require('../index');
var http = require('http');

framework.run(http, true, 8001);
framework.test(true);