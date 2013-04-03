var framework = require('partial.js');
var http = require('http');

var port = parseInt(process.argv[2] || '8000');
var debug = true;

var index = process.argv.indexOf('backup');
if (index !== -1) {
	framework.backup(function(err, path) {
		console.log('Backup: ' + (err ? err.toString() : path));
	});
	return;
}

index = process.argv.indexOf('restore');
if (index !== -1) {
	var restore = process.argv[index + 1] || '';
	framework.restore(restore, function(err, path) {
		console.log('Restore: ' + (err ? err.toString() : path));
	});
	return;
}

framework.run(http, debug, port);
//framework.test(true);

console.log("http://127.0.0.1:{0}/".format(port));