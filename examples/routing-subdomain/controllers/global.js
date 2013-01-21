var utils = require('partial.js/utils');

exports.init = function() {
	
	// add to host:
	// 127.0.0.1	website.debug
	// 127.0.0.1	subdomain.website.debug
	// and run node on 80 port

	this.route('[subdomain]/', subdomain);
	this.route('/', root);

	// show for all subdomain
	this.route('/all/', all);

	// hidden for subdomain
	this.route('[]/contact/', contact);
};

function subdomain() {
	this.plain('subdomain');
}

function all() {
	this.plain('all');
}

function contact() {
	this.plain('contact');
}
	
function root() {
	this.plain('root');
}