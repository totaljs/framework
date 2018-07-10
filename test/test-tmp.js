require('../index');

const Fs = require('fs');

var insert = 0;
var link = 0;
var update = 0;
var read = 0;
var remove = 1;

if (insert) {
	try {
		Fs.unlinkSync(F.path.databases('skuska.db'));
	} catch (e) {}
}

var db = GRAPHDB('skuska');

db.ready(function() {
	// this.insert('Si kokot?', console.log);
	//this.count(console.log);
	//this.read(20303, console.log);

	//console.log(db);

	if (insert) {
		for (var i = 0; i < 1000000; i++) {
			if (i % 100000 === 0)
				console.log(i);
			db.insert({ index: i + 1 });
		}
	}

	db.read(1000001, (err, links) => console.log(1000001, links));
	db.read(1000002, (err, links) => console.log(1000002, links));
	db.read(1000003, (err, links) => console.log(1000003, links));
	db.read(1000004, (err, links) => console.log(1000004, links));
	db.read(1000005, (err, links) => console.log(1000005, links));
	db.read(1000006, (err, links) => console.log(1000006, links));

	//db.link(100, 1000, 1, 0);
	//db.link(100, 10000, 1, 0);
	//db.link(100000, 200000, 1, 1);
	//db.link(100, 1000000, 1, 0);

	//db.read(1000004, console.log);

	if (link) {
		// 11
		//GRAPHDB('skuska').setLinkId(null, 4, 2, console.log);
		//GRAPHDB('skuska').setLinkId(11, 3, 6, console.log);
		//GRAPHDB('skuska').read(11, console.log);

		//GRAPHDB('skuska').read(1001, console.log);
		// 100 knows 1000 (but not vice versa)
		//GRAPHDB('skuska').link(10, 30, 1, 0, console.log);
		//GRAPHDB('skuska').link(20, 30, 1, 0, console.log);
		//return;
		//return;

		// 100 knows 100000 (but not vice versa)
		//GRAPHDB('skuska').link(100, 10000, 1, 0, console.log);
		//return;

		//GRAPHDB('skuska').read(100001, console.log);
		//return;

		var opt = {};

		opt.type = 1;
		// opt.relation = 1;

		db.graph(100, opt, function(err, doc) {
			console.log(JSON.stringify(doc, null, '  '));
		});

		//db.read(1000005, console.log);
	}

	if (remove) {
		//console.log(db);
		//db.read(51, console.log);
		// GRAPHDB('skuska').clean([10, 51], console.log);
		setTimeout(function() {
			//db.remove(100, console.log);
		}, 1000);
	}

	if (read) {
		db.read(50, console.log);
	}

	if (update) {
		db.update(2, { id: 2, guid: GUID(100), kokotaris: 99 }, console.log);
	}

	// GRAPHDB('skuska').insert({ index: 999999 }, console.log);

	//GRAPHDB('skuska').remove(100, console.log);

	// GRAPHDB('skuska').read(2, console.log);
	//GRAPHDB('skuska').link(2, 9, console.log);
});

/*
KEYVALUE('skuska').traverse(340304, function(err, val, index) {
	console.log(val);
	if (index === 6)
		return false;
});
*/
/*

KEYVALUE('skuska').ready(function() {
	for (var i = 0; i < 1000000; i++)
		KEYVALUE('skuska').put({ id: i + 1, guid: GUID(100) });
});
*/