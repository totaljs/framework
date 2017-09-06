var assert = require('assert');
var internal = require('../internal');

var buffer = [];
buffer.push('/*auto*/');
buffer.push('b{border-radius:1px}');
buffer.push('a{border-radius:1px 2px 3px 4px}');
buffer.push('a{text-overflow:ellipsis}');
buffer.push('span{opacity:0;}');
buffer.push('@keyframes test{border-radius:5px}');
buffer.push('div{background:linear-gradient(90deg, #000000, #FFFFFF);}');

var css = buffer.join('\n');
assert.ok(internal.compile_css(css) === 'b{border-radius:1px}a{border-radius:1px 2px 3px 4px}a{text-overflow:ellipsis}span{opacity:0;filter:alpha(opacity=0)}@keyframes test{border-radius:5px}@-webkit-keyframes test{border-radius:5px}@-moz-keyframes test{border-radius:5px}@-o-keyframes test{border-radius:5px}div{background:-webkit-linear-gradient(90deg,#000000,#FFFFFF);background:-moz-linear-gradient(90deg,#000000,#FFFFFF);background:-ms-linear-gradient(90deg,#000000,#FFFFFF);background:linear-gradient(90deg,#000000,#FFFFFF)}', 'automated CSS vendor prefixes');

// console.log(internal.compile_css('/*auto*/\ndiv{background:repeating-linear-gradient(90deg, #000000, #FFFFFF);}'));

css = '.input{ }, .input:disabled, .input:hover { background-color: red; } .required{content:"This, field is required"}';
assert.ok(internal.compile_css(css) === '.input{},.input:disabled,.input:hover{background-color:red}.required{content:"This, field is required"}', 'Problem with content.');

buffer = [];
buffer.push('$color: red; $font: "Times New Roman";');
buffer.push('$radius: 4px;');
buffer.push('body { background-color: $color; font-family: $font }');
buffer.push('div { border-radius: $radius; }');

css = buffer.join('\n');
assert.ok(internal.compile_css(css) === 'body{background-color:red;font-family:"Times New Roman"}div{border-radius:4px}', 'CSS variables');

buffer = [];
buffer.push('@import url(\'font.css\');');
buffer.push('div {');
buffer.push('    b { color: red; }');
buffer.push('    span { color: red; }');
buffer.push('    div { color: red }');
buffer.push('    div .blue { color: blue; }');
buffer.push('}');
buffer.push('@media(max-width:960px){');
buffer.push('    b { color: red; }');
buffer.push('    div {');
buffer.push('        b { color: red; }');
buffer.push('        span { color: red; }');
buffer.push('        div { color: red }');
buffer.push('        div .blue { color: blue; }');
buffer.push('    }');
buffer.push('}');

assert.ok(internal.compile_css(buffer.join("\n")) === "@import url('font.css');div b{color:red}div span{color:red}div div{color:red}div div .blue{color:blue}@media(max-width:960px){b{color:red}div b{color:red}div span{color:red}div div{color:red}div div .blue{color:blue}}", "CSS nested ordering");

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');

process.on('uncaughtException', function(err) {
	console.error(err);
	process.exit(1);
});