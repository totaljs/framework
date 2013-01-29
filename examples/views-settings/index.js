var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;
var server = framework.init(http, debug).listen(port);

// Initialize controllers
framework.controller('global');

framework.onSettings = function() {

	if (arguments.length > 0)
		return '<script type="text/javascript">document.title="{0}";</script>'.format(arguments[0]);

	return '';
};

console.log("http://127.0.0.1:{0}/".format(port));