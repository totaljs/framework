require('../index');

var filter = NOSQL('pages').find();
var page = 2;

filter.take(4);
filter.skip(page * 4);

filter.fields('name');
filter.sort('name', true);

filter.callback(function(err, docs) {
	var a = [];
	docs.forEach(function(b) {
		a.push(b.name);
	});
	console.log(a.join('\n'));
});