exports.install = function(framework) {
	framework.route('/', view_database);
};

function view_database() {

	var self = this;
	var db = self.database('my-database');

		// https://github.com/petersirka/node-couchdb
	db.all({ limit: 10 }, function(err, rows, total, offset) {

		if (err) {
			self.plain(err.toString());
			return;
		}

		// return all rows
		self.json(rows);

		// insert
		// @doc {Object}
		// @callback {Functions} :: optional
		db.insert({ name: 'Peter', age: 28 });

	});
}