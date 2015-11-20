var framework = require('../index');
var url = 'http://127.0.0.1:8001/';

framework.onLocate = function(req) {
	return 'sk';
};

framework.onAuthorization = function(req, res, flags, cb) {
    req.user = { alias: 'Peter Širka' };
    req.session = { ready: true };
    cb(req.url === '/a/');
};

/*
var mem = require('memwatch');

mem.on('leak', function(info) {
    console.log('LEAK ->', info);
});

mem.on('stats', function(info) {
    console.log('STATS ->', JSON.stringify(info));
});
*/

framework.on('load', function() {
    framework.merge('/mergepackage.js', '@testpackage/test.js');
});

framework.http('debug', { port: 8001 });


setTimeout(function() {
	U.request('http://127.0.0.1:8001/options/', ['options'], null, function() {
		console.log(arguments);
		F.stop();
	});
}, 1000);