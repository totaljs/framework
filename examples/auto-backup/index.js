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

/*
	=======================
	Backup & Restore filter
	=======================

	framework.onFilterBackup = function(path) {
		return path.indexOf('vide-1GB.avi') === -1;
	};

	famework.onFilterRestore = function(path) {
		return path.indexOf('logo.png') === -1;
	};
*/

console.log("http://127.0.0.1:{0}/".format(port));