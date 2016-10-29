// ===================================================
// IMPORTANT: only for development
// Total.js - framework for Node.js
// https://www.totaljs.com
// ===================================================

const fs = require('fs');
const options = {};

// options.ip = '127.0.0.1';
// options.port = parseInt(process.argv[2]);
// options.config = { name: 'Total.js' };
// options.https = { key: fs.readFileSync('keys/agent2-key.pem'), cert: fs.readFileSync('keys/agent2-cert.pem')};
// options.sleep = 3000;
// options.debugger = 40894;

const isDebugging = process.argv.indexOf('debugging') !== -1;
const directory = process.cwd();
const path = require('path');
const VERSION = '6.0';
const TIME = 2000;
const REG_FILES = /config\-debug|config\-release|config|versions|sitemap|dependencies|\.js|\.resource/i;
const REG_THEMES = /\/themes\//i;
const REG_THEMES_INDEX = /themes(\/|\\)?[a-z0-9_.-]+(\/|\\)?index\.js/i;
const REG_EXTENSION = /\.(js|resource|package)/i;

var first = process.argv.indexOf('restart') === -1;

process.on('uncaughtException', function(e) {
	e.toString().indexOf('ESRCH') == -1 && console.log(e);
});

function debug() {
	require('total.js');
	var port = parseInt(process.argv[process.argv.length - 1]);

	if (!isNaN(port)) {
		if (!options)
			options = {};
		options.port = port;
	}

	if (port > 0 && !options.port)
		options.port = port || 8000;

	if (options.https)
		return F.https('debug', options);

	F.http('debug', options);

	if (first)
		F.emit('debug-start');
	else
		F.emit('debug-restart');
}

function app() {
	const fork = require('child_process').fork;
	const utils = require('total.js/utils');
	const directories = [directory + '/controllers', directory + '/definitions', directory + '/isomorphic', directory + '/modules', directory + '/resources', directory + '/models', directory + '/source', directory + '/workers', directory + '/packages', directory + '/themes'];
	const async = new utils.Async();
	const prefix = '---------------------------------> ';
	var files = {};
	var force = false;
	var changes = [];
	var app = null;
	var status = 0;
	var pid = '';
	var pidInterval = null;
	var isLoaded = false;
	var isSkip = false;
	var pidIncrease;
	var speed = TIME;

	function onFilter(path, isDirectory) {
		if (!isDirectory && REG_THEMES.test(path))
			return REG_THEMES_INDEX.test(path);
		return isDirectory ? true : REG_EXTENSION.test(path);
	}

	function onIncrease(clear) {

 		if (clear) {
			clearTimeout(pidIncrease);
			speed = TIME;
 		}

		pidIncrease = setTimeout(function() {
			speed += TIME;
			if (speed > 4000)
				speed = 4000;
			onIncrease();
		}, 120000);
	}

	function onComplete(f) {

		fs.readdir(directory, function(err, arr) {

			var length = arr.length;

			for (var i = 0; i < length; i++) {
				var name = arr[i];
				name !== 'debug.js' && REG_FILES.test(name) && f.push(name);
			}

			length = f.length;

			for (var i = 0; i < length; i++) {
				var name = f[i];
				if (files[name] === undefined)
					files[name] = isLoaded ? 0 : null;
			}

			refresh();
		});
	}

	function refresh() {

		 var filenames = Object.keys(files);
		 var length = filenames.length;

		 for (var i = 0; i < length; i++) {
			var filename = filenames[i];
			(function(filename) {
				async.await(function(next) {
					fs.stat(filename, function(err, stat) {

						var stamp = '--- # --- [ ' + new Date().format('yyyy-MM-dd HH:mm:ss') + ' ] ';

						if (err) {
							delete files[filename];
							changes.push(stamp.replace('#', 'REM') + prefix + filename.replace(directory, ''));
							force = true;
						} else {
							var ticks = stat.mtime.getTime();
							if (files[filename] != null && files[filename] !== ticks) {
								changes.push(stamp.replace('#', files[filename] === 0 ? 'ADD' : 'UPD') + prefix + filename.replace(directory, ''));
								force = true;
							}
							files[filename] = ticks;
						}

						next();
					});
				});

			})(filename);
		 }

		 async.complete(function() {

			isLoaded = true;
			setTimeout(refresh_directory, speed);
			onIncrease();

			if (status !== 1 || !force)
				return;

			onIncrease(true);
			restart();

			var length = changes.length;
			for (var i = 0; i < length; i++)
				console.log(changes[i]);

			changes = [];
			force = false;
		 });

	}

	function refresh_directory() {
		utils.ls(directories, onComplete, onFilter);
	}

	function restart() {

		if (app !== null) {
			try
			{
				isSkip = true;
				process.kill(app.pid);
			} catch (err) {}
			app = null;
		}

		var arr = process.argv;
		var port = arr.pop();

		if (process.execArgv.indexOf('--debug') !== -1) {
			var key = '--debug=' + (options.debugger || 40894);
			process.execArgv.indexOf(key) === -1 && process.execArgv.push(key);
		}

		if (first)
			first = false;
		else
			arr.push('restart');

		arr.push('debugging');
		arr.push(port);

		app = fork(path.join(directory, 'debug.js'), arr);

		app.on('message', function(msg) {
			msg === 'eaddrinuse' && process.exit(1);
		});

		app.on('exit', function() {

			// checks unexpected exit
			if (isSkip === false) {
				app = null;
				process.exit();
				return;
			}

			isSkip = false;
			if (status === 255)
				app = null;
		});

		status === 0 && app.send('debugging');
		status = 1;
	}

	process.on('SIGTERM', end);
	process.on('SIGINT', end);
	process.on('exit', end);

	function end() {

		if (arguments.callee.isEnd)
			return;

		arguments.callee.isEnd = true;
		fs.unlink(pid, noop);

		if (app === null) {
			process.exit(0);
			return;
		}

		isSkip = true;
		process.kill(app.pid);
		app = null;
		process.exit(0);
	}

	function noop() {}

	if (process.pid > 0) {
		console.log(prefix + 'PID: ' + process.pid + ' (v' + VERSION + ')');
		pid = path.join(directory, 'debug.pid');
		fs.writeFileSync(pid, process.pid);

		pidInterval = setInterval(function() {
			fs.exists(pid, function(e) {

				if (e)
					return;

				fs.unlink(pid, noop);

				if (app !== null) {
					isSkip = true;
					process.kill(app.pid);
				}

				process.exit(0);
			});

		}, 2000);
	}

	restart();
	refresh_directory();
}

function run() {

	if (isDebugging) {
		debug();
		return;
	}

	var filename = path.join(directory, 'debug.pid');
	if (!fs.existsSync(filename)) {
		app();
		return;
	}

	fs.unlinkSync(filename);
	setTimeout(function() { app() }, 3000);
}

run();