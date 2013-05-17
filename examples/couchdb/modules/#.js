var utils = require('partial.js/utils');

// $ sudo npm install -g coucher
var couchdb = require('coucher');

// ==================================================
// in this file, you can rewrite framework prototypes
// this file call framework automatically
// ==================================================

exports.db = function() {
	return couchdb.init('http://127.0.0.1:5984/db/');
};
