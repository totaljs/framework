var utils = require('total.js/utils');

utils.request('http://api.openweathermap.org/data/2.5/weather?q=London,uk', 'GET', '', function(err, data) {

	if (!err)
		process.send(JSON.parse(data));

	process.exit();

});