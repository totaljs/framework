// $ sudo npm install -g mongolab-provider
var mongodb = require('mongolab-provider');

framework.database = function(name) {
	return mongodb.init(name, 'YOUR API KEY');
};
