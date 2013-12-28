var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;

framework.run(http, debug, port);

/*
	Make a tests
	@stop {Boolean} :: stop framework (default true)
	@names {String array} :: only tests in names (optional)
	@callback {Functions} :: on complete test handler (optional)
	return {Framework}
*/
framework.test(true, function() {
	console.log('SUCCESSS');
});