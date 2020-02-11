// Copyright 2012-2020 (c) Peter Širka <petersirka@gmail.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

/**
 * @module FrameworkCluster
 * @version 3.4.0
 */

const Fs = require('fs');
const Cluster = require('cluster');
const CLUSTER_REQ = { TYPE: 'req' };
const CLUSTER_RES = { TYPE: 'res' };
const CLUSTER_EMIT = { TYPE: 'emit' };
const CLUSTER_MASTER = { TYPE: 'master' };
const MAXTHREADLATENCY = 70;
const FORKS = [];

var OPERATIONS = {};
var CALLBACKS = {};
var OPTIONS = {};
var THREADS = 0;
var MASTER = null;
var CONTINUE = false;
var STATS = [];
var TIMEOUTS = {};

exports.on = function(name, callback) {
	!MASTER && (MASTER = {});
	if (MASTER[name])
		MASTER.push(callback);
	else
		MASTER[name] = [callback];
	return F;
};

exports.emit = function(name, a, b, c, d, e) {

	CLUSTER_EMIT.name = name;
	CLUSTER_EMIT.a = a;
	CLUSTER_EMIT.b = b;
	CLUSTER_EMIT.c = c;
	CLUSTER_EMIT.d = d;
	CLUSTER_EMIT.e = e;

	if (Cluster.isMaster)
		message(CLUSTER_EMIT);
	else if (F.isCluster)
		process.send(CLUSTER_EMIT);

	return F;
};

exports.master = function(name, a, b, c, d, e) {
	if (F.isCluster) {
		CLUSTER_MASTER.name = name;
		CLUSTER_MASTER.a = a;
		CLUSTER_MASTER.b = b;
		CLUSTER_MASTER.c = c;
		CLUSTER_MASTER.d = d;
		CLUSTER_MASTER.e = e;
		process.send(CLUSTER_MASTER);
	}
	return F;
};

exports.request = function(name, data, callback, timeout) {

	if (typeof(data) === 'function') {
		timeout = callback;
		callback = data;
		data = null;
	}

	CLUSTER_REQ.name = name;
	CLUSTER_REQ.data = data;
	CLUSTER_REQ.callback = (Math.random()).toString(32).substring(3);
	var obj = CALLBACKS[CLUSTER_REQ.callback] = { fn: callback, response: [], id: CLUSTER_REQ.callback };

	obj.timeout = setTimeout(function(obj) {
		delete CALLBACKS[obj.id];
		obj.fn && obj.fn(new Error('Timeout.'), obj.response);
	}, timeout || 3000, obj);

	if (Cluster.isMaster)
		mastersend(CLUSTER_REQ);
	else
		process.send(CLUSTER_REQ);
	return F;
};

exports.response = function(name, callback) {
	OPERATIONS[name] = callback;
	return F;
};

exports.req = function(message) {

	if (!F.isCluster)
		return F;

	// message.id
	// message.name
	// message.data
	// message.callback

	if (OPERATIONS[message.name]) {
		OPERATIONS[message.name](message.data, function(response) {
			CLUSTER_RES.data = response;
			CLUSTER_RES.target = message.id;
			CLUSTER_RES.callback = message.callback;
			process.send(CLUSTER_RES);
		}, message.id);
	} else {
		CLUSTER_RES.target = message.id;
		CLUSTER_RES.data = undefined;
		CLUSTER_RES.callback = message.callback;
		process.send(CLUSTER_RES);
	}

	return F;
};

exports.res = function(message) {
	var callback = CALLBACKS[message.callback];
	callback.fn && callback.response.push(message.data);

	var count = message.target === 'master' ? THREADS : THREADS - 1;
	if (callback.response.length >= count) {
		delete CALLBACKS[callback.id];
		clearTimeout(callback.timeout);
		callback.fn && callback.fn(null, callback.response);
	}
};

exports.http = function(count, mode, options, callback) {
	// Fork will obtain options automatically via event
	if (Cluster.isMaster) {
		CLUSTER_REQ.id = 'master';
		CLUSTER_RES.id = 'master';
		CLUSTER_EMIT.id = 'master';
		master(count, mode, options, callback);
	} else
		fork();
};

exports.https = function(count, mode, options, callback) {
	// Fork will obtain options automatically via event
	if (Cluster.isMaster) {
		CLUSTER_REQ.id = 'master';
		CLUSTER_RES.id = 'master';
		CLUSTER_EMIT.id = 'master';
		master(count, mode, options, callback, true);
	} else
		fork();
};

exports.restart = function(index) {
	if (index === undefined) {
		for (var i = 0; i < THREADS; i++)
			setTimeout(index => exports.restart(index), i * 2000, i);
	} else {
		var fork = FORKS[index];
		if (fork) {
			fork.$ready = false;
			fork.removeAllListeners();
			fork.disconnect();
			exec(index);
		} else
			exec(index);

		RELEASE && console.log('======= ' + (new Date().format('yyyy-MM-dd HH:mm:ss')) + ': restarted thread with index "{0}"'.format(index));
	}
};

function master(count, mode, options, callback, https) {

	if (count == null)
		count = require('os').cpus().length;

	OPTIONS.auto = count === 'auto';

	if (OPTIONS.auto)
		count = 1;

	if (typeof(options) === 'function') {
		callback = options;
		options = {};
	}  else if (!options)
		options = {};

	OPTIONS.count = count;
	OPTIONS.mode = mode;
	OPTIONS.options = options;

	var Os = require('os');
	require('./utils');

	console.log('==================== CLUSTER =======================');
	console.log('PID         : ' + process.pid);
	console.log('Node.js     : ' + process.version);
	console.log('OS          : ' + Os.platform() + ' ' + Os.release());
	console.log('Threads     : {0}'.format(OPTIONS.auto ? 'auto' : (count + 'x')));
	console.log('====================================================');
	console.log('Date        : ' + new Date().format('yyyy-MM-dd HH:mm:ss'));
	console.log('Mode        : ' + mode);
	options.thread && console.log('Thread      : ' + options.thread);
	console.log('====================================================\n');

	if (options.thread)
		global.THREAD = options.thread;

	if (mode === 'debug') {
		require('./debug').watcher(function(changes) {
			var can = false;
			if (options.thread) {
				for (var i = 0; i < changes.length; i++) {
					var change = changes[i];
					if (change.indexOf('/threads/') !== -1) {
						if (change.indexOf('/threads/' + options.thread + '/') !== -1) {
							can = true;
							break;
						}
					} else {
						can = true;
						break;
					}
				}
			} else
				can = true;
			can && exports.restart();
		});
	}

	// Remove all DB locks
	Fs.readdir(F.path.databases(), function(err, files) {
		if (!err) {
			var reglock = /(\.nosql-lock|\.table-lock|\.nosql-counter2-lock)$/;
			for (var i = 0; i < files.length; i++) {
				var file = files[i];
				reglock.test(file) && Fs.unlinkSync(F.path.databases(file));
			}
		}
	});

	THREADS = count;

	var can = function(cb) {
		if (CONTINUE)
			cb();
		else
			setTimeout(can, 500, cb);
	};

	count.async(function(i, next) {
		exec(Math.abs(i - THREADS), https);
		can(next);
	}, function() {
		callback && callback(FORKS);
	});

	process.title = 'total: cluster';

	var filename = require('path').join(process.cwd(), 'restart' + (options.thread ? ('_' + options.thread) : ''));
	var restartthreads = function(err) {
		if (!err) {
			Fs.unlink(filename, NOOP);
			if (!F.restarting) {
				exports.restart();
				F.restarting = true;
				setTimeout(function() {
					F.restarting = false;
				}, 30000);
			}
		}
	};

	var killme = function(fork) {
		fork.kill();
	};

	var counter = 0;
	var main = {};
	main.pid = process.pid;
	main.version = {};
	main.version.node = process.version;
	main.version.total = F.version_header;
	main.version.app = CONF.version;
	main.thread = options.thread;

	setInterval(function() {

		counter++;

		if (counter % 10 === 0) {
			main.date = new Date();
			main.threads = THREADS;
			var memory = process.memoryUsage();
			main.memory = (memory.heapUsed / 1024 / 1024).floor(2);
			main.stats = STATS;
			Fs.writeFile(process.mainModule.filename + '.json', JSON.stringify(main, null, '  '), NOOP);
		}

		Fs.stat(filename, restartthreads);

		// Ping
		if (!OPTIONS.auto)
			return;

		var isfree = false;
		var isempty = false;

		// Auto-ping
		for (var i = 0; i < FORKS.length; i++) {
			var fork = FORKS[i];
			if (fork) {
				if (fork.$ping) {
					if (fork.$ping < MAXTHREADLATENCY)
						isfree = true;
				} else
					isempty = true;

				fork.$ping_beg = Date.now();
				fork.send('total:ping');
			}
		}

		if (isfree || isempty) {
			if (!isempty && THREADS > 1) {
				// try to remove last
				var lastindex = FORKS.length - 1;
				var last = FORKS[lastindex];
				if (last == null) {
					TIMEOUTS[lastindex] && clearTimeout(TIMEOUTS[lastindex]);
					FORKS.splice(lastindex, 1);
					STATS.splice(lastindex, 1);
					THREADS = FORKS.length;
					return;
				}

				for (var i = 0; i < STATS.length; i++) {
					if (STATS[i].id === last.$id) {
						if (STATS[i].pending < 2) {
							// nothing pending
							fork.$ready = false;
							fork.removeAllListeners();
							fork.disconnect();
							setTimeout(killme, 1000, fork);
							FORKS.splice(lastindex, 1);
							STATS.splice(lastindex, 1);
						}
						break;
					}
				}
				THREADS = FORKS.length;
			}
		} else if (!options.max || THREADS < options.max)
			exec(THREADS++, https);

	}, 5000);
}

function message(m) {

	if (m === 'total:ready') {
		CONTINUE = true;
		this.$ready = true;
		return;
	}

	if (m === 'total:ping') {
		this.$ping = Date.now() - this.$ping_beg;
		return;
	}

	if (m === 'total:update') {
		for (var i = 1, length = FORKS.length; i < length; i++)
			FORKS[i] && FORKS[i].$ready && FORKS[i].send(m);
		return;
	}

	if (m.TYPE === 'master') {
		if (MASTER && MASTER[m.name]) {
			for (var i = 0, length = MASTER[m.name].length; i < length; i++)
				MASTER[m.name][i](m.a, m.b, m.c, m.d, m.e);
		}
	} else if (m.TYPE === 'snapshot') {
		var is = false;
		STATS[i];
		for (var i = 0; i < STATS.length; i++) {
			if (STATS[i].id === m.data.id) {
				m.data.ping = this.$ping;
				STATS[i] = m.data;
				is = true;
				break;
			}
		}
		!is && STATS.push(m.data);
	} else {

		if (m.target === 'master') {
			exports.res(m);
		} else {
			for (var i = 0, length = FORKS.length; i < length; i++)
				FORKS[i] && FORKS[i].$ready && FORKS[i].send(m);
		}
	}
}

function mastersend(m) {
	for (var i = 0, length = FORKS.length; i < length; i++)
		FORKS[i] && FORKS[i].send(m);
}

function exec(index, https) {

	if (TIMEOUTS[index]) {
		clearTimeout(TIMEOUTS[index]);
		delete TIMEOUTS[index];
	}

	var fork = Cluster.fork();
	fork.$id = index.toString();
	fork.on('message', message);
	fork.on('exit', function() {
		FORKS[index] = null;
		TIMEOUTS[index] = setTimeout(exports.restart, 1000, index);
	});

	if (FORKS[index] === undefined)
		FORKS.push(fork);
	else
		FORKS[index] = fork;

	(function(fork) {
		setTimeout(function() {
			OPTIONS.options.id = fork.$id;
			fork.send({ TYPE: 'init', bundling: !CONTINUE, id: fork.$id, mode: OPTIONS.mode, options: OPTIONS.options, threads: OPTIONS.count, index: index, https: https });
		}, fork.$id * 500);
	})(fork);
}

function fork() {
	require('./index');
	F.on('message', on_init);
}

function on_init(msg) {
	switch (msg.TYPE) {
		case 'init':
			CLUSTER_EMIT.id = msg.id;
			CLUSTER_REQ.id = msg.id;
			CLUSTER_RES.id = msg.id;
			THREADS = msg.threads;
			msg.options.bundling = msg.bundling;
			if (msg.https)
				F.https(msg.mode, msg.options);
			else
				F.http(msg.mode, msg.options);
			F.isCluster = true;
			F.removeListener(msg.TYPE, on_init);
			break;
	}
}