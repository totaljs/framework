

exports.onAuthorization = function(req, res, flags, callback) {

	// http://localhost:8000/?user=admin
	// or
	// http://localhost:8000/?user=moderator

	var get = req.data.get;

	if (get.user === 'admin' || get.user === 'moderator') {

		// I add role flag
		flags.push('@' + get.user);

		callback(true);
	}
	else
		callback(false);
};