exports.install = function(framework) {
    
    framework.route('/', view_homepage, ['unlogged']);
    framework.route('/', view_profile, ['logged']);
    framework.route('/usage/', view_usage);
    
    framework.route('/login/', json_login, ['unlogged', 'xhr', 'post']);
    framework.route('/logoff/', json_logoff, ['logged']);

    framework.on('loaded', function() {
        
        var self = this;
        var auth = self.module('authorization');

        auth.onAuthorization = function(id, callback) {

            // read user information from database
            // into callback insert the user object (this object is saved to session)
            // this is an example
            callback({ id: '1', alias: 'Peter Sirka' });

            // if user not exist then
            // callback(null);
        };

    });
};

// Homepage & login form
// GET, [unlogged]
function view_homepage() {
    var self = this;
    self.view('homepage');
}

// User profile
// GET, [logged]
function view_profile() {
    var self = this;
    self.json(self.session);
}

// Framework usage
// GET
function view_usage() {
    var self = this;
    self.plain(self.framework.usage(true));
}

// Login process
// POST, [xhr, unlogged]
function json_login() {
    var self = this;
    var auth = self.module('authorization');

    // read user information from database
    // this is an example
    var user = { id: '1', alias: 'Peter Sirka' };

    // create cookie
    // save to session
    auth.login(self, user.id, user);

    self.json({ r: true });
}

// Logoff process
// POST, [+xhr, logged]
function json_logoff() {
    var self = this;
    var auth = self.module('authorization');
    var user = self.session;

    // remove cookie
    // remove user session
    auth.logoff(self, user.id);

    self.redirect('/');
}