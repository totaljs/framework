require('../index');
const Http = require('http');
const Https = require('https');
const Url = require('url');

function rrr() {
	var options = { port: 8080, hostname: '127.0.0.1', method: 'CONNECT', headers: { host: 'www.totaljs.com:443' }};
	var req = Http.request(options);

	req.on('connect', function(res, socket) {

		console.log(res.statusCode);
		options = Url.parse('https://www.totaljs.com');

		var agent = new Https.Agent();
		agent.reuseSocket(socket, req);
		options.agent = agent;

		var r = Http.request(options);

		r.on('response', function(res) {

			res.on('data', function(data) {
				console.log(data.toString('utf8'));
			});

			res.on('end', function() {
				agent.destroy();
				agent = null;
				socket.destroy();
			});
		});

		r.end();

	});

	req.end();
}

//U.request('http://www.vyvojari.sk', ['get', 'proxy http://127.0.0.1:8080'], console.log);

RESTBuilder.make(function(builder) {
	builder.url('https://www.spektrum-bb.sk');
	builder.proxy('127.0.0.1:8080');
	builder.exec(console.log);
});

//rrr();