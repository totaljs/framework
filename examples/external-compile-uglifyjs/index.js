var framework = require('partial.js');
var http = require('http');
var uglify = require('uglify-js');

var port = 8004;
var debug = true;

framework.onCompileJS = function (filename, content) {
	console.log(content);
	return uglify.minify(content, { fromString: true }).code;
};

framework.run(http, debug, port);
console.log("http://127.0.0.1:{0}/".format(port));