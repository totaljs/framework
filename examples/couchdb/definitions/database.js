// $ sudo npm install -g coucher
var couchdb = require('coucher');

// https://github.com/petersirka/node-couchdb
framework.database = function(name) {
	return couchdb.init('http://127.0.0.1:5984/' + name + '/');
};