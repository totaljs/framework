var fs = require('fs');
var utils = require('../utils');

async(function *() {
	var a = yield sync(fs.readFile)('/users/petersirka/desktop/test.js');
	var b = yield sync(fs.readFile)('/users/petersirka/desktop/helper.js');
	var c = yield sync(fs.readFile)('/users/petersirka/desktop/library.js');
	console.log('a->', a);
	console.log('b->', b);
	console.log('c->', c);
})();

//var content = readFile('/users/petersirka/desktop/test.js')();