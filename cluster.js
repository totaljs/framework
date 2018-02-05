// Copyright 2012-2018 (c) Peter Širka <petersirka@gmail.com>
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
 * @version 2.9.2
 */

const Cluster = require('cluster');
const CLUSTER_REQ = { TYPE: 'req' };
const CLUSTER_RES = { TYPE: 'res' };
const CLUSTER_EMIT = { TYPE: 'emit' };
const CLUSTER_MASTER = { TYPE: 'master' };
const FORKS = [];

var OPERATIONS = {};
var CALLBACKS = {};
var OPTIONS = {};
var THREADS = 0;
var MASTER = null;

exports.on = function(name, callback) {
	!MASTER && (MASTER = {});
	if (MASTER[name])
		MASTER.push(callback);
	else
		MASTER[name] = [callback];
	return F;
};

exports.emit = function(name, data) {
	if (Cluster.isMaster) {
		CLUSTER_EMIT.name = name;
		CLUSTER_EMIT.data = data;
		message(CLUSTER_EMIT);
	} else if (F.isCluster) {
		CLUSTER_EMIT.name = name;
		CLUSTER_EMIT.data = data;
		process.send(CLUSTER_EMIT);
	}
	return F;
};

exports.master = function(name, data) {
	if (F.isCluster) {
		CLUSTER_MASTER.name = name;
		CLUSTER_MASTER.data = data;
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

exports.restart = function(index) {
	if (index === undefined) {
		for (var i = 0; i < THREADS; i++)
			exports.restart(i);
	} else {
		var fork = FORKS[index];
		if (fork) {
			fork.removeAllListeners();
			fork.disconnect();
			exec(index);
		}
	}
};

function master(count, mode, options, callback) {

	if (count == null || count === 'auto')
		count = require('os').cpus().length;

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
	console.log('Threads     : {0}x'.format(count));
	console.log('====================================================');
	console.log('Date        : ' + new Date().format('yyyy-MM-dd HH:mm:ss'));
	console.log('Mode        : ' + mode);
	console.log('====================================================\n');

	THREADS = count;

	for (var i = 0; i < count; i++)
		exec(i);

	process.title = 'total: cluster';
	callback && callback(FORKS);
}

function message(m) {

	if (m.TYPE === 'master') {
		if (MASTER && MASTER[m.name]) {
			for (var i = 0, length = MASTER[m.name].length; i < length; i++)
				MASTER[m.name][i](m.data);
		}
	} else {
		if (m.target === 'master') {
			exports.res(m);
		} else {
			for (var i = 0, length = FORKS.length; i < length; i++)
				FORKS[i] && FORKS[i].send(m);
		}
	}
}

function mastersend(m) {
	for (var i = 0, length = FORKS.length; i < length; i++)
		FORKS[i] && FORKS[i].send(m);
}

function exec(index) {
	var fork = Cluster.fork();
	fork.$id = index.toString();
	fork.on('message', message);
	if (FORKS[index])
		FORKS[index] = fork;
	else
		FORKS.push(fork);
	(function(fork) {
		setTimeout(function() {
			OPTIONS.options.id = fork.$id;
			fork.send({ TYPE: 'init', id: fork.$id, mode: OPTIONS.mode, options: OPTIONS.options, threads: OPTIONS.count, index: index });
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
			F.http(msg.mode, msg.options);
			F.isCluster = true;
			F.removeListener(msg.TYPE, on_init);
			break;
	}
}