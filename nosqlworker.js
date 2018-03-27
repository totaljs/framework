require(module.filename.replace(/nosqlworker\.js$/, 'index.js'));

const RESFIND = { TYPE: 'find' };
const RESINSERT = { TYPE: 'insert' };
const RESCOUNT = { TYPE: 'count' };
const RESUPDATE = { TYPE: 'update' };
const RESBACKUP = { TYPE: 'backup' };
const RESRESTORE = { TYPE: 'restore' };
const RESREMOVE = { TYPE: 'remove' };
const RESCOUNTERREAD = { TYPE: 'counter.read' };
const RESCOUNTERSTATS = { TYPE: 'counter.stats' };
const RESCOUNTERCLEAR = { TYPE: 'counter.clear' };
const RESTORAGESCAN = { TYPE: 'storage.scan' };
const RESTORAGESTATS = { TYPE: 'storage.stats' };
const RESSTORAGECLEAR = { TYPE: 'storage.clear' };

function killprocess() {
	process.exit(0);
}

process.on('disconnect', killprocess);
process.on('close', killprocess);
process.on('exit', killprocess);
process.on('message', function(msg) {

	if (msg.TYPE === 'init') {
		F.directory = msg.directory;
		return;
	}

	var db = NOSQL(msg.name);
	switch (msg.TYPE) {
		case 'find':
			db.find(msg.arg ? msg.arg[0] : undefined).parse(msg.data).callback(function(err, response, count, repository) {
				RESFIND.err = err;
				RESFIND.response = response;
				RESFIND.count = count;
				RESFIND.repository = repository;
				RESFIND.id = msg.id;
				process.send(RESFIND);
			});
			break;
		case 'one':
			db.one(msg.arg ? msg.arg[0] : undefined).parse(msg.data).callback(function(err, response, count, repository) {
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
			db.update(msg.arg[0], msg.arg[1]).parse(msg.data).callback(function(err, response, repository) {
				RESUPDATE.err = err;
				RESUPDATE.response = response;
				RESUPDATE.id = msg.id;
				RESUPDATE.repository = repository;
				process.send(RESUPDATE);
			});
			break;
		case 'modify':
			db.modify(msg.arg[0], msg.arg[1]).parse(msg.data).callback(function(err, response, repository) {
				RESUPDATE.err = err;
				RESUPDATE.response = response;
				RESUPDATE.id = msg.id;
				RESUPDATE.repository = repository;
				process.send(RESUPDATE);
			});
			break;
		case 'count':
			db.count(msg.arg ? msg.arg[0] : undefined).parse(msg.data).callback(function(err, response, count, repository) {
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
		case 'view':
			db.view(msg.arg[0]).parse(msg.data);
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
	}
});