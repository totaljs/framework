require('../index').http('debug');

F.backup(F.path.databases('my.backup'), F.path.root(), function() {
	console.log('done');
}, function(n) {
	return n.lastIndexOf('.html') !== -1;
});