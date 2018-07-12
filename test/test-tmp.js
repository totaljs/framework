require('../index');

const Fs = require('fs');

var insert = 1;
var link = 0;
var update = 0;
var read = 0;
var remove = 0;

if (insert) {
	try {
		Fs.unlinkSync(F.path.databases('skuska.gdb'));
	} catch (e) {}
}

var db = GRAPHDB('skuska');

db.ready(function() {

	db.class('user', 'name:string|age:number');
	db.class('order', 'id:string|price:number');
	db.class('tags', 'name:string');
	db.relation('like', true);

	// this.insert('Si kokot?', console.log);
	//this.count(console.log);
	//this.read(20303, console.log);

	/*
	setTimeout(function() {
		db.connect('like', 8, 9);
		setTimeout(function() {
			db.read(2, console.log);
			// db.read(6, console.log);
			// db.read(13, console.log);
			// var opt = {};
			// opt.relation = 'like';
			// opt.class = 'fet';
			// db.graph(8, opt, function(err, doc) {
			// 	console.log(JSON.stringify(doc, null, '  '));
			// });
		}, 500);
	}, 500);
	*/

	setTimeout(function() {
		var count = 0;

		//db.findRelationCount('order', (err, count) => console.log('order', count));
		// db.findRelationCount('user', (err, count) => console.log('user', count));
		// db.findRelationCount('tags', (err, count) => console.log('tags', count));

		// db.findRelation(db.$classes.order.nodeid, function(id, next) {

		// 	for (var i = 0; i < id.length; i++) {
		// 		var a = ordersid[id[i].ID];

		// 		if (a == null)
		// 			console.log('MISSING', id[i]);
		// 		else
		// 			ordersid[id[i].ID]++;
		// 	}

		// 	if (next)
		// 		next();
		// 	else
		// 		console.log(ordersid);
		// });

		//db.read(34, (err, doc) => console.log(34, doc));
		//db.read(35, (err, doc) => console.log(35, doc));

		// db.read(34, (err, doc) => console.log(34, doc.length));
		// db.read(35, (err, doc) => console.log(35, doc.length));
		// db.read(36, (err, doc) => console.log(36, doc.length));
		// db.read(37, (err, doc) => console.log(37, doc.length));

		// db.find('user').callback((err, docs) => console.log('users', docs.length));
		// db.find('order').callback((err, docs) => console.log('orders', docs.length));
		// db.find('tags').callback((err, docs) => console.log('tags', docs.length));

	}, 500);

	// db.find('user').take(100).callback((err, docs, count) => console.log('users', docs.length, count));
	// db.find('order').take(100).callback((err, docs, count) => console.log('orders', docs.length, count));
	// db.find('tags').take(100).callback((err, docs, count) => console.log('tags', docs.length, count));

	// setTimeout(function() {
	// 	db.find2('user').take(100).callback(console.log);
	// }, 100);

	// var sum = 0;
	// db.findRelation(db.$classes.user.nodeid, function(id, next) {
	// 	sum += id.length;
	// 	console.log(id);
	// 	if (next)
	// 		next();
	// 	else
	// 		console.log('--->', sum);
	// });

	//console.log(db);

	if (insert) {

		var max = 10;

		(max).async(function(i, next) {
			if (i && i % 1000 === 0)
				console.log('user', i);
			db.insert('user', { name: GUID(5), age: i + 20 }, next);
		}, function() {
			console.log('user done');
		});
/*
		(max).async(function(i, next) {
				if (i && i % 100000 === 0)
					console.log('order', i);
				db.insert('order', { id: UID(), price: (i + 1) }, next);
		}, function() {
			console.log('order done');
		});

		(max).async(function(i, next) {

			if (i && i % 100000 === 0)
				console.log('tags', i);

			db.insert('tags', { name: GUID(5) }, next);
		}, function() {
			console.log('tags done');
		});*/

	}

	// db.read(1, console.log);

	// db.read(11, console.log);
	// null [ { RELATION: 1, TYPE: 1, ID: 5, INDEX: 0 } ] 0

	// db.connect('like', 1, 5);

	//	db.read(1000001, (err, links) => console.log(1000001, links));
	//	db.read(1000002, (err, links) => console.log(1000002, links));
	//	db.read(1000003, (err, links) => console.log(1000003, links));
	//	db.read(1000004, (err, links) => console.log(1000004, links));
	//	db.read(1000005, (err, links) => console.log(1000005, links));
	//	db.read(1000006, (err, links) => console.log(1000006, links));

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