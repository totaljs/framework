var assert = require('assert');
var javascript = require('../internal');
var fs = require('fs');

var buffer = [];
buffer.push('<script type="text/javascript">');
buffer.push('function skuska (name, value) {');
buffer.push('var arr = [1, 2, 3, 4, 5];');
buffer.push('var obj = { Name: "Peter", Age: "28" };');
buffer.push('}');
buffer.push('console.log("OK");');
buffer.push('</script>');


var result1 = '<script type="text/javascript">function skuska(name,value){var arr=[1,2,3,4,5],obj={Name:"Peter",Age:"28"}}console.log("OK");</script>';
assert.ok(javascript.compile_javascript(buffer.join('\n')) === result1, 'javascript');
assert.ok(Buffer.from(javascript.compile_javascript(fs.readFileSync('javascript.js').toString('utf8'))).toString('base64') === 'cmV0dXJuJ1xcJysyO3ZhciBhdHRyaWJ1dGVzPSJcXFsiK2ErIiooIitiKyIpKD86IitjKyIqKFsqXiR8IX5dPz0pIitkKyIqKD86JygoPzpcXFxcLnxbXlxcXFwnXSkqKSd8XCIoKD86XFxcXC58W15cXFxcXCJdKSopXCJ8KCIrZSsiKSl8KSIrZisiKlxcXSI7dmFyIGE9MjAwOw==', 'Problem 1');

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');

process.on('uncaughtException', function(err) {
	console.error(err);
	process.exit(1);
});