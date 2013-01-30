var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.init(http, debug, port);

// Initialize controllers
framework.controller('global');

framework.onVersion = function(name) {

	switch (name) {
		case 'script.js':
			return 'script023.js';
		case 'style.css':
			return this.options['version-style'];
		case 'logo.png':
			return 'logo003.png';

		// from CSS	
		case '/img/bg.png':
			return '/img/bg002.png';
	}

	return name;
};

console.log("http://127.0.0.1:{0}/".format(port));