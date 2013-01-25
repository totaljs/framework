var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;
var server = framework.init(http, debug).listen(port);

// Initialize controllers
framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));


// Init temporary database

global.database = {};

var category = [
	{ url: '/', name: 'Shoes' },
	{ url: '/', name: 'Shirts' },
	{ url: '/', name: 'Jeans' },
	{ url: '/', name: 'Accessories' }
];

global.database.category = category;

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
	{ name: 'Product 01', price: 30.32 },
	{ name: 'Product 02', price: 31.32 },
	{ name: 'Product 03', price: 32.32 },
	{ name: 'Product 04', price: 33.32 },
	{ name: 'Product 05', price: 34.32 },
	{ name: 'Product 06', price: 35.32 },
	{ name: 'Product 07', price: 36.32 },
	{ name: 'Product 08', price: 37.32 },
	{ name: 'Product 09', price: 38.32 },
	{ name: 'Product 10', price: 39.32 }
];

global.database.itemsPaging = itemsPaging;
global.database.itemsInformation = itemsInformation;
global.database.items = items;