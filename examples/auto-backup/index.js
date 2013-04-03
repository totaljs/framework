var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.run(http, debug, port);

framework.on('service', function(minutes) {

	// every 24 hours backup this web site
	// one day has (24 * 60) 1440 minutes

	if (minutes % 1440 === 0)
		framework.backup();
	
});

console.log("http://127.0.0.1:{0}/".format(port));