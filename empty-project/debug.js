var fork = require('child_process').fork;
var fs = require('fs');
var path = require('path');
var directory = process.cwd();
var utils = require('partial.js/utils');

var directories = ['controllers', 'definitions', 'modules'];
var files = {};
var force = false;
var changes = [];
var app = null;
var status = 0;
var async = new utils.Async();
var pid = '';
var pidInterval = null;
var prefix = '------------> ';

function refresh() {

	async.await(function(next) {
		refresh_directory(directory, next);
	});

	var length = directories.length;
	for (var i = 0; i < length; i++) {
		(function(current) {
			async.await(function(next) {
				refresh_directory(current, next);
			});
		})(path.join(directory, directories[i]));
	}

	async.complete(function() {

		 var filenames = Object.keys(files);
		 var length = filenames.length;

		 for (var i = 0; i < length; i++) {

		 	var filename = filenames[i];

		 	(function(filename) {

		 		async.await(function(next) {

			 		fs.stat(filename, function(err, stat) {

			 			if (!err) {
				 			var ticks = stat.mtime.getTime();

				 			if (files[filename] !== null && files[filename] !== ticks) {
				 				changes.push(prefix + filename.replace(directory, '') + ' (modified)');
				 				force = true;
				 			}

			 				files[filename] = ticks;
				 		}
				 		else {
				 			delete files[filename];
				 			changes.push(prefix + filename.replace(directory, '') + ' (removed)');
				 			force = true;
				 		}

				 		next();
			 		});
		 		});

		 	})(filename);
		 }

		 async.complete(function() {

		 	setTimeout(function() {
				refresh();
		 	}, 1000);

		 	if (status !== 1)
		 		return;

		 	if (!force)
		 		return;

		 	restart();

			var length = changes.length;

		 	for (var i = 0; i < length; i++)
		 		console.log(changes[i]);

		 	changes = [];
		 	force = false;

		 });

	});
}

function refresh_directory(current, callback) {

	fs.readdir(current, function (err, arr) {
		var length = arr.length;

		for (var i = 0; i < length; i++) {
			var file = arr[i];
			if (file.indexOf('.js') === -1)
				continue;
			var filename = path.join(current, file);
			if (!files[filename])
				files[filename] = null;
		}

		callback();
	});
}

function restart() {

	if (app !== null) {
		try
		{
			process.kill(app.pid);
		} catch (err) {}
		app = null;
	}

	app = fork(path.join(directory, 'index.js'));

	app.on('message', function(msg) {
		if (msg.substring(0, 5) === 'name:') {
			process.title = 'debug: ' + msg.substring(6);
			return;
		}
	});

	app.on('exit', function() {

		if (status !== 255)
			return;

		app = null;
	});

	status = 1;
}

process.on('SIGTERM', function() {
	fs.unlink(pid, noop);

	if (app === null) {
		process.exit(0);
		return;
	}

	process.kill(app.pid);
	app = null;
	process.exit(0);
});

process.on('SIGINT', function() {
	fs.unlink(pid, noop);

	if (app === null) {
		process.exit(0);
		return;
	}

	process.kill(app.pid);
	app = null;
	process.exit(0);
});

process.on('exit', function() {
	fs.unlink(pid, noop);

	if (app === null)
		return;

	process.kill(app.pid);
	app = null;
});

function noop() {}

if (process.pid > 0) {
	console.log(prefix + 'PID: ' + process.pid);
	pid = path.join(directory, 'debug-' + process.pid + '.pid');
	fs.writeFileSync(pid, new Date().toString());

	pidInterval = setInterval(function() {

		fs.exists(pid, function(exist) {
			if (exist)
				return;

			fs.unlink(pid, noop);

			if (app !== null)
				process.kill(app.pid);

			process.exit(0);
		});

	}, 2000);
}

restart();
refresh();