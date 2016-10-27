require('../index');

NOSQL('users').count().callback(function(err, count) {
	console.log(err, count);
});

F.eval(function() {
	console.log(Builders.Page);
});