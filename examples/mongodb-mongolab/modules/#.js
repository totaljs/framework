
// $ sudo npm install -g mongolab
var mongodb = require('mongolab');

// ==================================================
// in this file, you can rewrite framework prototypes
// this file call framework automatically
// ==================================================

exports.db = function() {

	// free registration on www.mongolab.com
	// get API key from https://mongolab.com/user?username=[username] 

	return mongodb.init('YOUR DATABASE NAME', 'YOUR API KEY');
};
