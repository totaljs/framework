var qs = require('querystring');

var str = 'name=' + 'asdlj asldj asljd aslkdj klasd jklasd klasjd lasjd=alsdlajsd';


console.log(parseInt(process.version.replace('v', '').replace(/\./g, '')));
console.log(decodeURIComponent(str));
//console.log(str);

var a = (new (function(framework){var module = this;var exports = {};this.exports=exports; console.log('INJECTED');exports.install=function(framework){console.log(framework===null);};})).exports;