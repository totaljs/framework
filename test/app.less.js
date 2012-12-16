var assert = require('assert');
var app = require('../lib/');
var less = require('../lib/less');

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

//var result1 = 'div { border-radius:4px 4px 4px 4px;-moz-border-radius:4px 4px 4px 4px; }\na:hover { transition-property:left,top;transition-duration: 2s; }\nli:hover { transition-property:left, top;transition-duration: 1s; }'
//var result2 = 'div{border-radius:4px 4px 4px 4px;-moz-border-radius:4px 4px 4px 4px;}a:hover{transition-property:left,top;transition-duration:2s;}li:hover{transition-property:left, top;transition-duration:1s;}';

var result1 = "@font-face { font-family: 'Dosis'; font-style: normal; font-weight: 400; src: local('Dosis Regular'), local('Dosis-Regular'), url(http://themes.googleusercontent.com/static/fonts/dosis/v1/7L9_zC5qZfwiKVyE9UcfBqCWcynf_cDxXwCLxiixG1c.woff) format('woff');}\n\ndiv { border-radius:4px 4px 4px 4px;-moz-border-radius:4px 4px 4px 4px; @font-face; }\na:hover { transition-property:left,top;transition-duration: 2s; }\nli:hover { transition-property:left, top;transition-duration: 1s; }\ndiv { border-radius:4px 4px 4px 4px;-moz-border-radius:4px 4px 4px 4px; }\n@keyframes {}";
var result2 = "@font-face{font-family:'Dosis';font-style:normal;font-weight:400;src:local('Dosis Regular'), local('Dosis-Regular'), url(http://themes.googleusercontent.com/static/fonts/dosis/v1/7L9_zC5qZfwiKVyE9UcfBqCWcynf_cDxXwCLxiixG1c.woff) format('woff');}div{border-radius:4px 4px 4px 4px;-moz-border-radius:4px 4px 4px 4px;@font-face;}a:hover{transition-property:left,top;transition-duration:2s;}li:hover{transition-property:left, top;transition-duration:1s;}div{border-radius:4px 4px 4px 4px;-moz-border-radius:4px 4px 4px 4px;}@keyframes{}";

assert.ok(less.compile(css, false) === result1, 'less – compress=false');
assert.ok(less.compile(css, true) === result2, 'less – compress=true');

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');