if (!global.framework_utils)
	global.framework_utils = require('./utils');

const Crypto = require('crypto');
const Https = require('https');
const Http = require('http');
const Url = require('url');

function WebSocketClient() {
}

WebSocketClient.prototype.connect = function(url, opt) {

	var self = this;
	var options = {};
	var key = Crypto.randomBytes(16).toString('base64');

	self.url = url;
	url = Url.parse(url);

	var isSecure = url.protocol === 'wss:';

	options.port = isSecure ? 443 : 80;
	options.host = url.hostname;
	options.path = url.path;
	options.query = url.query;
	options.headers = {};
	options.headers['Sec-WebSocket-Version'] = '13';
	options.headers['Sec-WebSocket-Key'] = key;
	options.headers['Sec-Websocket-Extensions'] = 'client_max_window_bits';
	// options.headers['Sec-WebSocket-Protocol'];
	// options.headers['Sec-WebSocket-Origin']
	options.headers.Connection = 'Upgrade';
	options.headers.Upgrade = 'websocket';

};