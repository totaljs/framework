require('../index');

F.http('debug');

F.on('ready', function() {
	F.map('/neviem.js', 'main.js');
});