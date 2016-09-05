var assert = require('assert');
var javascript = require('../internal');

var buffer = [];
buffer.push('<script type="text/javascript">');
buffer.push('function skuska (name, value) {');
buffer.push('var arr = [1, 2, 3, 4, 5];');
buffer.push('var obj = { Name: "Peter", Age: "28" };');
buffer.push('}');
buffer.push('console.log("OK");');
buffer.push('</script>');


var result1 = '<script type="text/javascript">function skuska(name,value){var arr=[1,2,3,4,5];var obj={Name:"Peter",Age:"28"}}console.log("OK");</script>';
assert.ok(javascript.compile_javascript(buffer.join('\n')) === result1, 'javascript');

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');