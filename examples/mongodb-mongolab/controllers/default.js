exports.install = function(framework) {
	framework.route('/', view_database);
};

function view_database() {

	var self = this;

	// definitions/database.js
	var db = self.database('your-database-name');

	db.collections(function(err, rows) {

		if (err) {
			self.view500(err);
			return;
		}

		var collection = [];

		rows.forEach(function(o) {
			collection.push('collection -> ' + o);
		});

		// Bad documentation: https://github.com/petersirka/node-mongolab

		db.documents('products', {}, function(err, rows) {
			// DONE
		    console.log(rows);
		});

		db.insert('users', { name: 'Peter', age: 25 }, function(err, result) {
			// DONE
			console.log(result);
		});

		// response all collections as JSON
		self.json(collection);
	});
}