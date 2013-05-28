var assert = require('assert');
var less = require('../less');

var buffer = [];
//buffer.push('@radius(a){ border-radius:@a @a @a @a; -moz-border-radius:@a @a @a @a; }');
buffer.push('@radius(a,b,c,d){ border-radius:@a @b @c @d; -moz-border-radius:@a @b @c @d; }');
buffer.push('@transition(property,duration){ transition-property:@property; transition-duration: @duration; }');
buffer.push("@font-face { font-family: 'Dosis'; font-style: normal; font-weight: 400; src: local('Dosis Regular'), local('Dosis-Regular'), url(http://themes.googleusercontent.com/static/fonts/dosis/v1/7L9_zC5qZfwiKVyE9UcfBqCWcynf_cDxXwCLxiixG1c.woff) format('woff');}");
buffer.push('@red{ color:red }')
buffer.push('div { @radius(4px, 4px, 4px, 4px); @font-face; }');
buffer.push('a:hover { @transition(left|top, 2s); }');
buffer.push('li:hover { @transition("left, top", 1s); }');
buffer.push('div { @radius(4px, 4px, 4px, 4px); }');
buffer.push('@keyframes {}');

var css = buffer.join('\n');

var result = "@font-face{font-family:'Dosis';font-style:normal;font-weight:400;src:local('Dosis Regular'), local('Dosis-Regular'), url(http://themes.googleusercontent.com/static/fonts/dosis/v1/7L9_zC5qZfwiKVyE9UcfBqCWcynf_cDxXwCLxiixG1c.woff) format('woff');}div{border-radius:4px 4px 4px 4px;-moz-border-radius:4px 4px 4px 4px;@font-face;}a:hover{transition-property:left,top;transition-duration:2s;}li:hover{transition-property:left, top;transition-duration:1s;}div{border-radius:4px 4px 4px 4px;-moz-border-radius:4px 4px 4px 4px;}@keyframes{}";

assert.ok(less.compile(css, true) === result, 'less – compress=true');

buffer = [];
buffer.push('@#auto-vendor-prefix#@');
buffer.push('b{border-radius:1px}');
buffer.push('a{border-radius:1px 2px 3px 4px}');
buffer.push('a{text-overflow:ellipsis}');
buffer.push('@keyframes test{border-radius:5px}');

css = buffer.join('\n');
assert.ok(less.compile(css, true) === 'b{border-radius:1px;-webkit-border-radius:1px;-moz-border-radius:1px}a{border-radius:1px 2px 3px 4px;-webkit-border-radius:1px 2px 3px 4px;-moz-border-radius:1px 2px 3px 4px}a{text-overflow:ellipsis;-ms-text-overflow:ellipsis}keyframes test{border-radius:5px;-webkit-border-radius:5px;-moz-border-radius:5px}@-webkit-keyframes test{border-radius:5px;-webkit-border-radius:5px;-moz-border-radius:5px}@-moz-keyframes test{border-radius:5px;-webkit-border-radius:5px;-moz-border-radius:5px}@-o-keyframes test{border-radius:5px;-webkit-border-radius:5px;-moz-border-radius:5px}', 'automated CSS vendor prefixes');

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');