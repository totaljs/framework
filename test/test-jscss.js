var assert = require('assert');
var utils = require('../utils');
var utils = require('../index');
var internal = require('../internal');

var buffer = [];

buffer.push('/* function name(){');
buffer.push('return "color:red";');
buffer.push('} */');
buffer.push('/* function all(a,b,c,d){');
buffer.push('return a + b + JSON.stringify(c) + d;');
buffer.push('} */');
buffer.push('/* var a = "12px"; */');
buffer.push('');
buffer.push('body{ $name(); font-size:$a; }');
buffer.push('div{ font-size:20px; $all(1, "WORD", { a: "b" }, true); background-color:red; }');

assert.ok(internal.compile_css(buffer.join('\n')) === 'body{color:red;font-size:12px;}div{font-size:20px;1WORD{"a":"b"}true;background-color:red;}', 'JS CSS');

buffer = [];
buffer.push('/*auto*/');
buffer.push('b{border-radius:1px}');
buffer.push('a{border-radius:1px 2px 3px 4px}');
buffer.push('a{text-overflow:ellipsis}');
buffer.push('@keyframes test{border-radius:5px}');
buffer.push('div{background:linear-gradient(90deg, #000000, #FFFFFF)}');

var css = buffer.join('\n');

assert.ok(internal.compile_css(css) === 'b{border-radius:1px}a{border-radius:1px 2px 3px 4px}a{text-overflow:ellipsis}@keyframes test{border-radius:5px}@-webkit-keyframes test{border-radius:5px}@-moz-keyframes test{border-radius:5px}@-o-keyframes test{border-radius:5px}div{background:-webkit-linear-gradient(90deg, #000000, #FFFFFF);background:-moz-linear-gradient(90deg, #000000, #FFFFFF);background:-o-linear-gradient(90deg, #000000, #FFFFFF);background:-ms-linear-gradient(90deg, #000000, #FFFFFF)background:linear-gradient(90deg, #000000, #FFFFFF);}', 'automated CSS vendor prefixes');

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');