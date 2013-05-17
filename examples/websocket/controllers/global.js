var utils = require('partial.js/utils');

exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/usage/', view_usage);

	/*
		Add a new websocket route
		@url {String}
		@funcInitialize {Function}
		@flags {String Array} :: optional
		@protocols {String Array} :: optional, websocket-allow-protocols
		@allow {String Array} :: optional, allow origin
		@maximumSize {Number} :: optional, maximum size length
		return {Framework}

		flags: json, logged, unlogged
		[logged, unlogged] https://github.com/petersirka/partial.js/tree/master/examples/authorization

	*/
	framework.websocket('/', socket_homepage, ['json']);
};

function view_usage() {
	var self = this;
	self.plain(self.framework.usage(true));
}

function view_homepage() {
	var self = this;
	self.view('homepage');
}

function socket_homepage(connection, framework) {

    // client.id               : client identifiactor, you can modify this property, default is random string
    // client.socket           : socket (internal)
    // client.req              : request
    // client.uri              : URI
    // client.ip               : IP
    // client.session          : empty object, you can modify this property

    // client.cookie(name)	   :
    // client.send(value)      : send message
    // client.close(status)    : disconnect client (status {Number} :: optional, default undefined)

    /*
    	Send message to all
    	@value {String or Object}
    	@names {String Array} :: client.id, optional - default null
    	@blacklist {String Array} :: client.id, optional - default null

		if (names === null || names === undefined)
			message send to all users

    */
    // connection.send(value, names, blacklist);

    /*
    	Close connection
    	@names {String Array} :: client.id, optional - default null

		if (names === null || names === undefined)
			close/disconnect all users

    */
    // connection.close(names);

	/*
    	Destroy websocket
    */
    // connection.destroy();

	connection.on('open', function(client) {

		console.log('Connect / Online:', connection.online);

		client.send({ message: 'Hello {0}'.format(client.id) });
		connection.send({ message: 'Connect new user: {0}\nOnline: {1}'.format(client.id, connection.online) }, [], [client.id]);

	});

	connection.on('close', function(client) {

		console.log('Disconnect / Online:', connection.online);
		connection.send({ message: 'Disconnect user: {0}\nOnline: {1}'.format(client.id, connection.online) });

	});

	connection.on('message', function(client, message) {

		if (typeof(message.username) !== 'undefined') {
			var old = client.id;
			client.id = message.username;
			connection.send({ message: 'rename: ' + old + ', new: ' + client.id });
			return;
		}

		// send to all without this client
		message.message = client.id + ': ' + message.message;
		connection.send(message);

	});

	connection.on('error', function(error, client) {

		framework.error(error, 'websocket', connection.uri);

	});

	// how many connections?

	// NUMBER
	connection.online;
}