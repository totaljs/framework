var utils = require('partial.js/utils');
var builders = require('partial.js/builders');

// ==================================================
// in this file, you can rewrite framework prototypes
// this file call framework automatically
// ==================================================

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

	if (obj.ip !== req.ip) {
		callback(false);
		return;
	}

	var user = self.cache.read('user_' + obj.id);
	if (user !== null) {
		req.session = user;
		callback(true);
		return;
	}
	
	// autologin by cookie
	var db = self.database('users');

	db.one('doc.id === {0}'.format(obj.id), function(err, user) {

		if (user === null) {
			callback(false);
			return;
		}

		self.cache.write('user_' + user.id, user, new Date().add('m', 5));
		req.session = user;
		callback(true);
	});

};