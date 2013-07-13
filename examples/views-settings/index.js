var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.run(http, debug, port);

framework.onSettings = function() {

	if (arguments.length > 0)
		return '<script type="text/javascript">document.title="{0}";</script>'.format(arguments[0]);

	return '';
};

console.log("http://{0}:{1}/".format(framework.ip, framework.port));