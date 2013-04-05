var fork = require('child_process').fork;
var fs = require('fs');
var path = require('path');
var directory = process.cwd();
var framework = null;
var skip = false;
var name = 'keepalive';

function run() {
	framework = fork('index');
	framework.on('message', function(msg) {

		if (msg.substring(0, 5) === 'name:') {
			process.title = 'keepalive: ' + msg.substring(6);
			return;
		}

		if (msg === 'restart') {
			restart();
			return;
		}
	});

	framework.on('error', function(msg) {
		skip = true;
		process.kill(framework.pid);
		framework = null;
		restart();
	});
}

process.on('SIGTERM', function() {
	if (framework === null) {
		process.exit(0);
		return;
	}

	process.kill(framework.pid);
	framework = null;
	process.exit(0);
});

process.on('SIGINT', function() {
	if (framework === null) {
		process.exit(0);
		return;
	}

	process.kill(framework.pid);
	framework = null;
	process.exit(0);
});

process.on('exit', function() {
	if (framework === null)
		return;

	process.kill(framework.pid);
	framework = null;
});

function command(msg) {
	
	console.log(name + ': ' + msg);

	if (framework === null)
		return;

	framework.send(msg);
}

function restart() {

	console.log(name + ': restart');

	if (framework === null) {
		setTimeout(run, 1000);
		return;
	}

	process.kill(framework.pid);
	framework = null;
	setTimeout(run, 1000);
}

function operation() {
	
	var filenameStop = path.join(directory, 'stop');
	var filenameRestart = path.join(directory, 'restart');
	var filenameBackup = path.join(directory, 'backup');
	var filenameRestore = path.join(directory, 'restore');
	
	fs.exists(filenameStop, function(exists) {

		if (!exists)
			return;

		fs.unlink(filenameStop, function(err) {

			if (framework !== null) {
				console.log(name + ': stop');
				process.kill(framework.pid);
				framework = null;
			}

			process.exit(0);
		});

	});

	fs.exists(filenameBackup, function(exists) {

		if (!exists)
			return;

		if (!fs.statSync(filenameBackup).isDirectory())
			return;

		fs.unlink(filenameBackup, function(err) {
			command('backup');
		});

	});

	fs.exists(filenameRestore, function(exists) {

		if (!exists)
			return;

		var restore = fs.readFileSync(filenameRestore, 'utf8').toString();

		fs.unlink(filenameRestore, function(err) {
			command('restore ' + restore);
		});

	});	

	fs.exists(filenameRestart, function(exists) {
		if (!exists)
			return;

		fs.unlink(filenameRestart, function(err) {
			restart();
		});

	});
}

run();

setInterval(function() {

	if (skip) {
		skip = false;
		return;
	}

	operation();
}, 10000);