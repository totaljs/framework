require('../index');
var url = '/views/';
var a = require('../internal');
var max = 1000000;
var ip = '127.0.0.1';

console.time('old');
for (var i = 0; i < max; i++) {
	ip.replace(/\./g, '');
}
console.timeEnd('old');

console.time('new');
for (var h = 0; h < max; h++) {
	var n = '';
	for (var i = 0, length = ip.length; i < length; i++) {
		if (ip[i] !== '.')
			n += ip[i];
	}
}
console.timeEnd('new');