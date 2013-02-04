var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.verification(function(err) {
	console.log(err);
});