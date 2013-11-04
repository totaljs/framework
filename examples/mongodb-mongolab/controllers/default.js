exports.install = function(framework) {
	framework.route('/', view_database);
};

function view_database() {
	
	var self = this;
	var db = self.app.db();

	db.collections(function(err, data) {

		if (err) {
			self.plain(err.toString());
			return;
		}

		var rows = [];
		data.forEach(function(o) {
			rows.push('collection -> ' + o);
		});

		// Bad documentation: https://github.com/petersirka/node-mongolab
		db.insert('users', { name: 'Peter', age: 25 }, function(err, data) {
			// DONE
		});		

		// return all rows
		self.plain(rows.join('\n'));
	});
}