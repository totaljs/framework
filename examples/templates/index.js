var framework = require('partial.js');
var http = require('http');

var port = 8004;
var server = framework.init(http, { debug: true }).listen(port);

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
	{ url: '/?p=5', name: '5' },
];

var itemsInformation = {
	pages: 20,
	items: 1023
};

global.database.itemsPaging = itemsPaging;
global.database.itemsInformation = itemsInformation;