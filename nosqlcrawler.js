// Copyright 2018-2020 (c) Peter Širka <petersirka@gmail.com>
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
 * @module NoSQL Crawler
 * @version 1.0.0
 */

var filename = module.filename.replace(/nosqlcrawler\.js$/, '');

require(filename + 'index.js');
const NoSQLStream = require(filename + 'nosqlstream.js');

global.NOW = global.DATETIME = new Date();

function killprocess() {
	process.exit(0);
}

setInterval(function() {
	global.NOW = global.DATETIME = new Date();
}, 30000);

process.on('disconnect', killprocess);
process.on('close', killprocess);
process.on('exit', killprocess);
process.on('message', function(msg) {

	// msg.builder;
	// msg.filename or msg.data

	var builder = new framework_nosql.DatabaseBuilder();
	builder.parse(msg.builder);

	var filters = new framework_nosql.NoSQLReader([builder]);

	msg.files.wait(function(item, next) {
		find(item.filename, filters, next);
	}, function() {
		var item = filters.builders[0];
		process.send({ response: item.response, count: item.count });
		setTimeout(() => killprocess(), 1000);
	});

});

function find(filename, filters, next) {

	var fs = new NoSQLStream(filename);

	fs.ondocuments = function() {
		return filters.compare(JSON.parse('[' + fs.docs + ']', jsonparser));
	};

	fs.$callback = function() {
		fs = null;
		next();
	};

	fs.openread();
}

function jsonparser(key, value) {
	return typeof(value) === 'string' && value.isJSONDate() ? new Date(value) : value;
}
