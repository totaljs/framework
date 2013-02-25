var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.init(http, debug, port);

framework.onRoute = function (req, res) {

	/*	
	if (req.ip === '127.0.0.1') {
		this.returnRedirect(req, res, 'http://www.google.com');
		return false;
	}*/	

	// if false = req.connection.destroy()
	return req.ip === '127.0.0.1';
};

console.log("http://127.0.0.1:{0}/".format(port));