require('../index');

var async = new U.Async();
var value = [];

async.on('error', function(err, name) {
	console.log('ERROR', err, name);
});

async.wait('0', function(next) {
	async.cancel();
	value.push(0);
	console.log('---index 0');
	next();
});

async.wait('1', function(next) {
	value.push(1);
	console.log('---index 1');
	next();
});

async.wait('2', function(next) {
	value.push(2);
	console.log('---index 2');
	next();
});

async.on('percentage', function(p) {
	console.log(p + '%');
});

async.complete(function() {
	console.log('-----> RESULT', value);
});

setTimeout(function() {
	console.log('END');
}, 3000);

