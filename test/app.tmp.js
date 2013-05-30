var utils = require('../utils');

var fs = require('fs');

fs.writeFileSync('/users/petersirka/desktop/default-compiled.css', require('../less').compile(fs.readFileSync('/users/petersirka/desktop/default.css').toString('utf8'), true));