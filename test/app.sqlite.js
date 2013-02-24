var assert = require('assert');
var sqlite = require('../lib/sqlite');
var builders = require('../lib/builders');

var db = sqlite.init(':memory:', true);

builders.schema('user', {
	id: Number,
	name: 'text(5)'
}, 'id');

db.beg();
db.run('CREATE TABLE user (id INTEGER PRIMARY KEY NOT NULL, name TEXT(5))');
db.end();

function test_orm() {

	var model = {
		name: 'Peter'
	};

	db.beg();
	db.insert('user', model, function(err, user) {
		assert.ok(user.id === 1 && user.name === 'Peter', 'db.insert()');
		user.name = 'Lucka';
		db.update('user', user, function(err, user) {

			assert.ok(user.id === 1 && user.name === 'Lucka', 'db.update()');
			db.delete('user', user, function(err, user) {
				db.findPK('user', user.id, function(err, user) {
					assert.ok(user === null, 'db.delete()');
				});
			});
		});
	});

	db.insert('user', { name: '1' });
	db.insert('user', { name: '2' });
	db.insert('user', { name: '3' });
	db.insert('user', { name: '4' });
	db.insert('user', { name: '5' });
	db.end();	

	setTimeout(function() {

		db.beg();
		
		db.all('user', function(err, rows) {
			assert.ok(rows.length === 5, 'all');
		});

		db.end();

	}, 500);
}

test_orm();

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');