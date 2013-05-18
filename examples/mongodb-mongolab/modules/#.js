
// $ sudo npm install -g mongolab-provider
var mongodb = require('mongolab-provider');

// ==================================================
// in this file, you can rewrite framework prototypes
// this file call framework automatically
// ==================================================

exports.db = function() {

	// free registration on www.mongolab.com
	// get API key from https://mongolab.com/user?username=[username] 

	return mongodb.init('YOUR DATABASE NAME', 'YOUR API KEY');
};
