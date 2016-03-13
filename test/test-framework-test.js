var framework = require('../index');
var url = 'http://127.0.0.1:8001/';

framework.onCompileView = function(name, html, model) {
	return html + 'COMPILED';
};

framework.onLocate = function(req) {
	return 'sk';
};

framework.onAuthorize = function(req, res, flags, cb) {
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

framework.http('debug', { port: 8001 });
F.merge('/mergedirectory.js', '~' + F.path.public('js') + '*.js');

setTimeout(function() {
    F.stop();
}, 5000);