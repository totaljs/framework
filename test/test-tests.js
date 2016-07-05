require('../index');

F.http('debug');

F.on('ready', function() {
	console.log(F.routeStatic('/p.zip'));
});