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
 * @module FrameworkTest
 * @version 2.9.4
 */

var T = F.tests = {};
T.countok = 0;
T.countno = 0;
T.count = 0;
T.tests = [];
T.current = null;
T.results = [];
T.running = false;
T.immediate = null;

function NEXT() {

	T.immediate && clearImmediate(T.immediate);
	T.immediate = null;

	var fn = T.current ? T.current.items.shift() : null;

	if (fn != null) {
		fn();
		return;
	}

	if (T.current) {
		T.results.push(T.current);
		console.log('');
	}

	var test = F.tests.tests.shift();
	if (test == null) {

		console.log('===================== RESULTS ======================');
		console.log('');
		console.log('> Passed .........', T.countok + '/' + T.count);
		console.log('> Failed ' + (T.countno ? '[x] .....' : '.........'), T.countno + '/' + T.count);
		console.log('');

		F.isTest = false;
		F.emit('test-end', T);

		// DONE
		setTimeout(function() {
			F.kill(T.countno ? 1 : 0);
		}, 1000);

	} else {

		T.current = test;
		T.current.results = [];

		console.log('[ TEST: ' + test.filename.substring(F.path.tests().length) + (T.current.priority ? ' ({0}) ]'.format(T.current.priority) : ' ]'));
		console.log('');

		NEXT();
	}
}

global.TEST = function(name, url, scope) {

	if (typeof(url) === 'function') {

		var fn = function() {
			T.now = Date.now();
			T.currentname = name;
			T.current.count++;
			url(NEXT);
		};

		if (T.running)
			T.current.items.unshift(fn);
		else
			T.current.items.push(fn);

		return;
	}

	if (!url.startsWith('http://', true) && !url.startsWith('https://', true))
		url = 'http://' + F.ip + ':' + F.port + (url[0] !== '/' ? '/' : '') + url;

	var fn = function() {
		T.now = Date.now();
		T.currentname = name;
		T.current.count++;
		var builder = new RESTBuilder(url);
		builder.header('X-Assertion-Testing', '1');
		scope.call(builder, builder);
	};

	if (T.running)
		T.current.items.unshift(fn);
	else
		T.current.items.push(fn);
};

global.FAIL = function(is, description) {
	logger(is ? true : false, T.currentname, description);
	T.immediate && clearImmediate(T.immediate);
	T.immediate = setImmediate(NEXT);
};

global.OK = function(is, description) {
	logger(is ? false : true, T.currentname, description);
	T.immediate && clearImmediate(T.immediate);
	T.immediate = setImmediate(NEXT);
};

exports.load = function() {
	U.ls(F.path.tests(), function(files) {
		files.waitFor(function(filename, next) {
			T.current = { filename: filename, items: [] };
			var m = require(filename);
			T.current.module = m;
			T.current.countok = 0;
			T.current.countno = 0;
			T.current.count = 0;
			T.current.priority = m.priority || 0;
			T.current.items.length && T.tests.push(T.current);
			T.current = null;
			next();
		}, function() {
			T.tests.quicksort('priority');
			F.emit('test-begin', T);
			console.log('===================== TESTING ======================');
			console.log('');
			T.running = true;
			T.start = Date.now();
			NEXT();
		});
	});
};

function logger(fail, name, description) {
	var time = Math.floor(Date.now() - T.now) + ' ms';
	T.count++;
	if (fail) {
		T.countno++;
		T.current.countno++;
		console.error('Failed [x] '.padRight(20, '.') + ' ' + name + (description ? (' <' + description + '>') : '') + ' [' + time + ']');
	} else {
		T.countok++;
		T.current.countok++;
		console.info('Passed '.padRight(20, '.') + ' ' + name + (description ? (' <' + description + '>') : '') + ' [' + time + ']');
	}
}