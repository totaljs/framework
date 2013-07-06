var framework = require('partial.js');
var http = require('http');
var sass = require('node-sass');

var port = 8004;
var debug = true;

framework.onCompileCSS = function (filename, content) {
	return sass.renderSync({ data: content, outputStyle: 'compressed' });
};

framework.run(http, debug, port);
console.log("http://127.0.0.1:{0}/".format(port));