var framework = require('partial.js');
var http = require('http');
var uglify = require('uglify-js');

var port = 8004;
var debug = true;

framework.onCompileJS = function (filename, content) {
	return uglify.minify(content, { fromString: true }).code;
};

framework.run(http, debug, port);
console.log("http://{0}:{1}/".format(framework.ip, framework.port));