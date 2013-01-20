var framework = require('partial.js');
var http = require('http');

var port = 8004;
var server = framework.init(http, { debug: true }).listen(port);

framework.onPrefix = function(req) {
	var userAgent = req.headers['user-agent'];

	if ((/\iPhone|iPad/gi).test(userAgent))
		return 'ios';

	if ((/\Android/gi).test(userAgent))
		return 'android';

	return '';
};

// Initialize controllers
framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));