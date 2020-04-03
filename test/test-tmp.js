require('../index');

DOWNLOAD('https://www.totaljs.com/download/B20200120T000000011.png', '/users/petersirka/desktop/kokot.png', function() {
	console.log(arguments);
});