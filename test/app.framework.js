var framework = require('../index');
var http = require('http');
framework.run(http, false, 8001);

framework.cache.add('peter', 'JOO', 34);
framework.cache.removeAll(/\e/g);