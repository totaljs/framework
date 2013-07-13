var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.onPrefix = function(req) {
	var userAgent = req.headers['user-agent'];

	if ((/\Android/gi).test(userAgent))
		return 'android';

	return '';
};

framework.run(http, debug, port);
console.log("http://{0}:{1}/".format(framework.ip, framework.port));