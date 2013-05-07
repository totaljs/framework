var assert = require('assert');
var sqlite = require('../sqlite');
var builders = require('../builders');

var db = sqlite.init(':memory:');

builders.schema('user', {
	id: Number,
	name: 'text(5)'
}, 'id');

function test_orm(next) {

	var model = {
		name: 'Peter'
	};

	db.insert('user', model, function(err, user) {
		assert.ok(user.id === 1 && user.name === 'Peter', 'db.insert()');
		user.name = 'Lucka';
		db.update('user', user, function(err, user) {
			assert.ok(user.id === 1 && user.name === 'Lucka', 'db.update()');
			user.name = '     Peter      ';
			db.update('user', user, function(err, user) {
				assert.ok(user.id === 1 && user.name === 'Peter', 'trim string');
				db.delete('user', user, function(err, user) {
						db.findPK('user', user.id, function(err, user) {
							assert.ok(user === null, 'db.delete()');
							db.insert('user', { name: '1' });
							db.insert('user', { name: '2' });
							db.insert('user', { name: '3' });
							db.insert('user', { name: '4' });
							db.insert('user', { name: '5' }, function() {
								db.all('user', function(err, rows) {
									assert.ok(rows.length === 5, 'all');
									next && next();
								});
							});
						});
					});
			});
		});
	});
}

function test_orm_find(next) {
	db.findPK('user', 5, function(err, user) {
		assert.ok(user.name === '5', 'findPK');
		db.findTop(3, 'user', null, function(err, users) {
			assert.ok(users.length === 3, 'findTop');
			db.all('user', function(err, users) {
				assert.ok(users.length === 5, 'all');
				db.count('user', null, function(err, count) {
					assert.ok(count === 5, 'count');
					db.findOne('user', new builders.QueryBuilder().addValue('id', '>', 2), builders.asc('id'), function(err, user) {
						assert.ok(user.id === 3, 'findOne');
						next && next();
					});
				});
			});
		});
	});
}

function test_execute(next) {
	db.execute('UPDATE user SET name=name + "-OK" WHERE id>{id}', { id: 2 }, function(err, data) {
		assert.ok(data.changes === 3, 'execute');
		var query = new builders.QueryBuilder();
		query.addValue('Id', '>', 1);

		db.reader('SELECT * FROM user' + query.toString(true), query, function(err, data) {
			assert.ok(data.length === 4, 'reader');

			db.scalar('SELECT COUNT(*) AS Count FROM user', function(err, data) {
				assert.ok(data.Count, 'scalar');
				db.deleteSchema('user', function(isDeleted) {
					assert.ok(isDeleted, 'schemaDrop');
					next && next();
				});
			});
		});
	});
}

function end() {
	console.log('================================================');
	console.log('success - OK');
	console.log('================================================');
	console.log('');
}

db.createSchema('user', function(err, data) {
	test_orm(function() {
		test_orm_find(function() {
			test_execute(function() {
				end();
			});
		});
	});
});
