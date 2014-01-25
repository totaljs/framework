var framework = require('total.js');
var http = require('http');

framework.run(http, true, parseInt(process.argv[2]));

setTimeout(function() {
	framework.stop();
}, 3000);

framework.test(true, function() {
	console.log('');
	console.log('====================================================');
	console.log('Congratulations, the test was successful!');
	console.log('====================================================');
	console.log('');
});