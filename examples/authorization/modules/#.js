var couchdb = require('partial.js/couchdb');
var utils = require('partial.js/utils');

// ==================================================
// in this file, you can rewrite framework prototypes
// this file call framework automatically
// ==================================================

exports.db = function() {

	/*
	{
	   "_id": "0854153caee4db8e7298769ffb000a04",
	   "_rev": "70-842ca2825b8dc0972d6f20da060b1b72",
	   "alias": "Peter Širka",
	   "password": "7c4a8d09ca3762af61e59520943dc26494f8941b",
	   "roles": "all",
	   "email": "petersirka@gmail.com"
	}
	*/

	return couchdb.init('http://127.0.0.1:5984/cms/');
};

// ================================================
// AUTHORIZATION
// ================================================

exports.onAuthorize = function(req, res, flags, callback) {

	var self = this;

	var cookie = req.cookie(self.config.cookie);
	if (cookie === null || cookie.length < 10) {
		callback(false);
		return;
	}

	var obj = self.decode(cookie, 'user');

	if (obj.ip != req.ip) {
		callback(false);
		return;
	}

	var user = self.cache.read('user_' + obj.id);
	if (user != null) {
		req.session = user;
		callback(true);
		return;
	}
	
	// autologin by cookie
	var db = self.db();

	db.find(obj.id, function(err, data) {

		if (err) {
			callback(false);
			return;
		}

		user = { id: data._id,
				 alias: data.alias,
				 email: data.email };

		self.cache.write('user_' + user.id, user, new Date().add('m', 5));
		req.session = user;
		callback(true);

	});
};