var framework = require('total.js');
var http = require('http');
var debug = true;

framework.controller('test', function() {

	var controller = {
		install: function(framework) {
			framework.route('/', plain_homepage);
		}
	};

	function plain_homepage() {
		this.plain('THIS IS HOMEPAGE');
	}

	return controller;

});

framework.run(http, debug);