var framework = require('partial.js');
var http = require('http');
var os = require('os');

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

var port = parseInt(process.argv[2] || '8000', 10);
var debug = true;

framework.run(http, debug, port);

// framework.test(true);

console.log('http://{0}:{1}/'.format(framework.ip, framework.port));