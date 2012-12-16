var assert = require('assert');
var app = require('../lib/');
var internal = require('../lib/internal');

app.route('#401', function(){});
app.route('#404', function(){});
app.route('#500', function(){});
app.route('/user/', function(){}, ['logged']);
app.route('/shop/shoes/', function(){});
app.route('/shop/shoes/', function(){}, ['post']);
app.route('/shop/shoes/', function(){}, ['post', 'ajax']);
app.route('/shop/category/{category}/', function(){});
app.route('/shop/category/{category}/{subcategory}/', function(){});

app.route('/shop/custom/', function(){}, [], function(o) {
	return o.url === '/shop/custom/';
});

var url = '/shop/shoes/';
var flags = ['post', 'ajax'];

assert.ok(app.routeLookup({}, {}, url, flags, false).flags.length == flags.length, 'kontrola –> flags');

flags = [];
url = '/shop/category/test/';
assert.ok(internal.routeParam(internal.routeSplit(url), app.routeLookup({}, {}, url, flags, false))[0] == 'test', 'kontrola –> path (1)');

url = '/shop/category/test/sub/';
route = internal.routeParam(internal.routeSplit(url), app.routeLookup({}, {}, url, flags, false));
assert.ok(route[0] == 'test' && route[1] == 'sub', 'kontrola –> path (2)');

url = '/shop/custom/';
route = app.routeLookup({ url: url }, {}, url, flags, false);
assert.ok(route.url[1] == 'custom', 'kontrola –> custom validation');

url = '#500';
assert.ok(app.routeLookup({}, {}, url, flags, false).url[0] == '#500', 'kontrola –> 500');

url = '/not/exists/';
assert.ok(app.routeLookup({}, {}, url, flags, false).url[0] == '#404', 'kontrola –> 404');

url = '/user/';
flags = ['unlogged'];
assert.ok(app.routeLookup({}, {}, url, flags, false).url[0] == '#401', 'kontrola –> 401');

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');