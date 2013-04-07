var framework = require('../lib/index');
var assert = require('assert');
var db = framework.database('users');
var fs = require('fs');
var dbfile = framework.path(framework.config['directory-databases'], 'users.nosql');

if (fs.existsSync(dbfile))
	fs.unlinkSync(dbfile);

for (var i = 0; i < 10; i++)
	db.insert({ name: String.fromCharCode(i + 65), index: i });

db.bulk([{ name: '0', index: 0 }, { name: '1', index: 1 }, { name: '2', index: 2 }], function(err, count) {
	assert.ok(count === 3, 'bulk insert problem')
});

function read() {

	db.all('doc.name === "A" || doc.index === 2', function(err, selected) {

		var a = '';
		selected.forEach(function(o) {
			a += o.name;
		});

		assert.ok(a === 'AC2', 'read problem');
	});

	db.remove(function(o) {
		return o.index > 2;
	}, function(err, count) {
		assert.ok(count === 7, 'remove problem');
	});

	db.update(function(o) {
		o.name = 'X';
		return o;
	}, function(err, count) {
		assert.ok(count === 6, 'update problem');
	});

}

setTimeout(function() {
	read();
}, 1000);

setTimeout(function() {
	fs.unlinkSync(framework.path(framework.config['directory-databases'], 'users.nosql'));
	console.log('================================================');
	console.log('success - OK');
	console.log('================================================');
	console.log('');	
}, 1500);