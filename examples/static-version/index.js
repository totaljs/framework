var framework = require('partial.js');
var http = require('http');

var port = 8004;
var server = framework.init(http, { debug: true }).listen(port);


framework.onVersion = function(name) {

	switch (name) {
		case 'script.js':
			return 'script023.js';
		case 'style.css':
			return 'style001.css';
		case 'logo.png':
			return 'logo003.png';

		// from CSS	
		case '/img/bg.png':
			return '/img/bg002.png';
	}

	return name;
};

// Initialize controllers
framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));