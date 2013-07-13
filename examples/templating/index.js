var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.run(http, debug, port);
console.log("http://{0}:{1}/".format(framework.ip, framework.port));

// Init temporary database

framework.global.database = {};

var category = [
	{ url: '/', name: 'Shoes', alternate: false },
	{ url: '/', name: 'Shirts', alternate: true },
	{ url: '/', name: 'Jeans', alternate: false },
	{ url: '/', name: 'Accessories', alternate: true }
];

framework.global.database.category = category;

var itemsPaging = [
	{ url: '/?p=1', name: '1' },
	{ url: '/?p=2', name: '2' },
	{ url: '/?p=3', name: '3' },
	{ url: '/?p=4', name: '4' },
	{ url: '/?p=5', name: '5' }
];

var itemsInformation = {
	pages: 20,
	items: 1023
};

var items = [
	{ name: 'Product 01', price: 30.32, date: new Date().add('month', -1), example: { name: '1' }, fn: function() { return 'function 1'; } },
	{ name: 'Product 02', price: 31.32, date: new Date().add('month', -2), example: { name: '2' }, fn: function() { return 'function 2'; } },
	{ name: 'Product 03', price: 32.32, date: new Date().add('month', -3), example: { name: '3' }, fn: function() { return 'function 3'; } },
	{ name: 'Product 04', price: 33.32, date: new Date().add('month', -4), example: { name: '4' }, fn: function() { return 'function 4'; } },
	{ name: 'Product 05', price: 34.32, date: new Date().add('month', -5), example: { name: '5' }, fn: function() { return 'function 5'; } },
	{ name: 'Product 06', price: 35.32, date: new Date().add('month', -6), example: { name: '6' }, fn: function() { return 'function 6'; } },
	{ name: 'Product 07', price: 36.32, date: new Date().add('month', -7), example: { name: '7' }, fn: function() { return 'function 7'; } },
	{ name: 'Product 08', price: 37.32, date: new Date().add('month', -7), example: { name: '8' }, fn: function() { return 'function 8'; } },
	{ name: 'Product 09', price: 38.32, date: new Date().add('month', -8), example: { name: '9' }, fn: function() { return 'function 9'; } },
	{ name: 'Product 10', price: 39.32, date: new Date().add('month', -9), example: { name: '0' }, fn: function() { return 'function 0'; } }
];

framework.global.database.itemsPaging = itemsPaging;
framework.global.database.itemsInformation = itemsInformation;
framework.global.database.items = items;