var framework = require('total.js');
var http = require('http');

framework.run(http, true, parseInt(process.argv[2]));

framework.test(true, function() {
	console.log('');
	console.log('====================================================');
	console.log('Congratulations, the test was successful!');
	console.log('====================================================');
	console.log('');
});