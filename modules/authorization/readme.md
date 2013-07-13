Append authorization.js to /partialjs-projects/modules/

```javascript

function json_login() {

	var self = this;
	var auth = self.module('authorization');

    // read user information from database
    // this is an example
	var user = { id: '1', alias: 'Peter' };

    // create cookie
    // save to session
	// @controller {Controller}
	// @id {Number}
	// @user {String}
	auth.login(self, user.id, user);

	self.json({ r: true });
}

function json_logoff() {

	var self = this;
	var auth = self.module('authorization');
	var user = self.session;

    // remove cookie
    // remove user session
	// @controller {Controller}
	// @id {String}
	auth.logoff(self, user.id);

	self.json({ r: true });
}

framework.on('load', function() {

	var auth = self.modules('authorization');

	auth.onAuthorization = function(id, callback) {

        // read user information from database
        // into callback insert the user object (this object is saved to session)
        // this is an example
        callback({ id: '1', alias: 'Peter Sirka' });

        // if user not exist then
        // callback(null);
	};

	auth.on('login', function(id, user) {});
	auth.on('logoff', function(id, user) {});
	auth.on('change', function(id, user, old) {});
	auth.on('online', function(online) {});
	auth.on('expire', function(id, user) {});
});


```