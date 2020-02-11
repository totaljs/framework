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
 * @module NoSQL Worker
 * @version 1.0.0
 */

require(module.filename.replace(/nosqlworker\.js$/, 'index.js'));

const RESFIND = { TYPE: 'find' };
const RESINSERT = { TYPE: 'insert' };
const RESCOUNT = { TYPE: 'count' };
const RESUPDATE = { TYPE: 'update' };
const RESBACKUP = { TYPE: 'backup' };
const RESRESTORE = { TYPE: 'restore' };
const RESREMOVE = { TYPE: 'remove' };
const RESCALLBACK = { TYPE: 'callback' };
const RESCOUNTERREAD = { TYPE: 'counter.read' };
const RESCOUNTERSTATS = { TYPE: 'counter.stats' };
const RESCOUNTERCLEAR = { TYPE: 'counter.clear' };
const RESTORAGESCAN = { TYPE: 'storage.scan' };
const RESTORAGESTATS = { TYPE: 'storage.stats' };
const RESSTORAGECLEAR = { TYPE: 'storage.clear' };
const RESSTREAM = { TYPE: 'stream' };

global.NOW = global.DATETIME = new Date();

function killprocess() {
	process.exit(0);
}

setInterval(function() {
	global.NOW = global.DATETIME = new Date();
}, 30000);

// One day cleaner
setInterval(function() {
	var keys = Object.keys(F.databasescleaner);
	keys.length && keys.wait(function(item, next) {
		NOSQL(item).clean(next);
	});
}, 60000 * 60 * 24);

process.on('disconnect', killprocess);
process.on('close', killprocess);
process.on('exit', killprocess);
process.on('message', function(msg) {

	if (msg.TYPE === 'init') {
		F.directory = msg.directory;
		return;
	}

	var db = msg.t ? TABLE(msg.name) : NOSQL(msg.name);

	switch (msg.TYPE) {
		case 'find':
			db.find().parse(msg.data).callback(function(err, response, count, repository) {
				RESFIND.err = err;
				RESFIND.response = response;
				RESFIND.count = count;
				RESFIND.repository = repository;
				RESFIND.id = msg.id;
				process.send(RESFIND);
			});
			break;
		case 'find2':
			db.find2().parse(msg.data).callback(function(err, response, count, repository) {
				RESFIND.err = err;
				RESFIND.response = response;
				RESFIND.count = count;
				RESFIND.repository = repository;
				RESFIND.id = msg.id;
				process.send(RESFIND);
			});
			break;
		case 'top':
			db.top().parse(msg.data).callback(function(err, response, count, repository) {
				RESFIND.err = err;
				RESFIND.response = response;
				RESFIND.count = count;
				RESFIND.repository = repository;
				RESFIND.id = msg.id;
				process.send(RESFIND);
			});
			break;
		case 'one':
			db.one().parse(msg.data).callback(function(err, response, count, repository) {
				RESFIND.err = err;
				RESFIND.response = response;
				RESFIND.count = count;
				RESFIND.repository = repository;
				RESFIND.id = msg.id;
				process.send(RESFIND);
			});
			break;
		case 'insert':
			db.insert(msg.arg[0], msg.arg[1]).parse(msg.data).callback(function(err, response) {
				RESINSERT.err = err;
				RESINSERT.response = response;
				RESINSERT.id = msg.id;
				process.send(RESINSERT);
			});
			break;
		case 'update':

			if (typeof(msg.arg[0]) === 'string')
				msg.arg[0] = eval('(' + msg.arg[0] + ')');

			db.update(msg.arg[0], msg.arg[1]).parse(msg.data).callback(function(err, response, repository) {
				RESUPDATE.err = err;
				RESUPDATE.response = response;
				RESUPDATE.id = msg.id;
				RESUPDATE.repository = repository;
				process.send(RESUPDATE);
			});
			break;
		case 'modify':

			if (typeof(msg.arg[0]) === 'string')
				msg.arg[0] = eval('(' + msg.arg[0] + ')');

			db.modify(msg.arg[0], msg.arg[1]).parse(msg.data).callback(function(err, response, repository) {
				RESUPDATE.err = err;
				RESUPDATE.response = response;
				RESUPDATE.id = msg.id;
				RESUPDATE.repository = repository;
				process.send(RESUPDATE);
			});
			break;
		case 'count':
			db.count().parse(msg.data).callback(function(err, response, count, repository) {
				RESCOUNT.err = err;
				RESCOUNT.response = response;
				RESCOUNT.count = count;
				RESCOUNT.repository = repository;
				RESCOUNT.id = msg.id;
				process.send(RESCOUNT);
			});
			break;
		case 'remove':
			db.remove(msg.arg ? msg.arg[0] : undefined).parse(msg.data).callback(function(err, response, repository) {
				RESREMOVE.err = err;
				RESREMOVE.response = response;
				RESREMOVE.repository = repository;
				RESREMOVE.id = msg.id;
				process.send(RESREMOVE);
			});
			break;
		case 'backup':
			db.backup(msg.arg[0], function(err, response) {
				RESBACKUP.id = msg.id;
				RESBACKUP.err = err;
				RESBACKUP.response = response;
				process.send(RESBACKUP);
			});
			break;
		case 'restore':
			db.restore(msg.arg[0], function(err, response) {
				RESRESTORE.id = msg.id;
				RESRESTORE.err = err;
				RESRESTORE.response = response;
				process.send(RESRESTORE);
			});
			break;
		case 'refresh':
			db.refresh();
			break;
		case 'drop':
			db.drop();
			break;
		case 'counter.min':
			db.counter.min(msg.arg[0], msg.arg[1]);
			break;
		case 'counter.max':
			db.counter.max(msg.arg[0], msg.arg[1]);
			break;
		case 'counter.hit':
			db.counter.hit(msg.arg[0], msg.arg[1]);
			break;
		case 'counter.remove':
			db.counter.remove(msg.arg ? msg.arg[0] : undefined);
			break;
		case 'counter.read':
			db.counter.read(msg.arg[0], function(err, response) {
				RESCOUNTERREAD.id = msg.id;
				RESCOUNTERREAD.err = err;
				RESCOUNTERREAD.response = response;
				process.send(RESCOUNTERREAD);
			});
			break;
		case 'counter.stats':
			db.counter.stats(msg.arg[0], msg.arg[1], msg.arg[2], msg.arg[3], msg.arg[4], function(err, response) {
				RESCOUNTERSTATS.id = msg.id;
				RESCOUNTERSTATS.err = err;
				RESCOUNTERSTATS.response = response;
				process.send(RESCOUNTERSTATS);
			});
			break;
		case 'counter.clear':
			db.counter.clear(function(err) {
				RESCOUNTERCLEAR.id = msg.id;
				RESCOUNTERCLEAR.err = err;
				process.send(RESCOUNTERCLEAR);
			});
			break;
		case 'storage.insert':
			db.storage.insert(msg.arg[0]);
			break;
		case 'storage.stats':
			db.storage.stats(msg.arg[0], function(err, response) {
				RESTORAGESTATS.id = msg.id;
				RESTORAGESTATS.response = response;
				RESTORAGESTATS.err = err;
				process.send(RESTORAGESTATS);
			});
			break;
		case 'storage.scan':
			db.storage.scan(msg.arg[0], msg.arg[1], eval('(' + msg.arg[2] + ')'), function(err, response, repository) {
				RESTORAGESCAN.id = msg.id;
				RESTORAGESCAN.response = response;
				RESTORAGESCAN.repository = repository;
				RESTORAGESCAN.err = err;
				process.send(RESTORAGESCAN);
			});
			break;
		case 'storage.clear':
			db.storage.clear(msg.arg[0], msg.arg[1], function(err, response) {
				RESSTORAGECLEAR.id = msg.id;
				RESSTORAGECLEAR.response = response;
				RESSTORAGECLEAR.err = err;
				process.send(RESSTORAGECLEAR);
			});
			break;
		case 'stream':
			db[msg.TYPE](eval('(' + msg.arg[0] + ')'), msg.arg[1], function(err, repository, count) {
				RESSTREAM.id = msg.id;
				RESSTREAM.err = err;
				RESSTREAM.repository = repository;
				RESSTREAM.count = count;
				process.send(RESSTREAM);
			});
			break;
		case 'clean':
		case 'clear':
		case 'ready':
			db[msg.TYPE](function(err) {
				RESCALLBACK.id = msg.id;
				RESCALLBACK.err = err;
				process.send(RESCALLBACK);
			});
			break;
	}
});