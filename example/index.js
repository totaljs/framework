var http = require('http');	
var app = require('partial.js');
var port = 8008;
var util = require('util');

app.config.name = 'My First partial.js';
app.config.debug = true;

var server = app.init(http).listen(port);

app.onAuthorize = function (req, res) {
	//req.session = {};
	return false;
};

require('./controllers/global.js').init(app);

console.log("http://127.0.0.1:" + port + "/");