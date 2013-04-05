var fork = require('child_process').fork;
var fs = require('fs');
var path = require('path');
var directory = process.cwd();
var framework = null;
var skip = false;
var name = 'keepalive';
var arg = [];

for (var i = 2; i < process.argv.length; i++)
	arg.push(process.argv[i]);

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

/*
	Run partial.js
*/
function run() {
	framework = fork('index', arg);
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
		restart(5000);
	});
}

/*
	Restart partial.js
*/
function restart(timeout) {

	console.log(name + ': restart');

	if (framework === null) {
		setTimeout(run, timeout || 1000);
		return;
	}

	process.kill(framework.pid);
	framework = null;
	setTimeout(run, timeout || 1000);
}

/*
	Operation / this function monitor these files: stop, restart, backup, restore
*/
function operation() {
	
	var filenameStop = path.join(directory, 'keepalive-stop');
	var filenameRestart = path.join(directory, 'keepalive-restart');
	var filenameBackup = path.join(directory, 'keepalive-backup');
	var filenameRestore = path.join(directory, 'keepalive-restore');
	var filenameReset = path.join(directory, 'keepalive-reset');
	
	fs.exists(filenameStop, function(exists) {

		if (!exists)
			return;

		fs.unlink(filenameStop, function(err) {

			console.log(name + ': stop');

			if (framework !== null) {
				process.kill(framework.pid);
				framework = null;
			}

			process.exit(0);
		});

	});

	fs.exists(filenameReset, function(exists) {

		if (!exists)
			return;
		
		fs.unlink(filenameReset, function(err) {
			command('reset');
		});

	});	

	fs.exists(filenameBackup, function(exists) {

		if (!exists)
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

/*
	Send command to partial.js
	@msg {String}
*/
function command(msg) {
	
	console.log(name + ': ' + msg);

	if (framework === null)
		return;

	framework.send(msg);
}

// ===========================================================================
// RUN
// ===========================================================================

run();

setInterval(function() {

	if (skip) {
		skip = false;
		return;
	}

	operation();
}, 10000);