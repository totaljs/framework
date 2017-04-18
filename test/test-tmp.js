require('../index');

NOSQL('users').count().callback(function(err, count) {
	console.log(err, count);
});
