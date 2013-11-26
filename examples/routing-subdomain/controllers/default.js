exports.install = function(framework) {
	
	// IMPORTANT: www. is removed automatically

	// add to host:
	// 127.0.0.1	website.debug
	// 127.0.0.1	subdomain.website.debug
	// and run node on 80 port

	framework.route('[subdomain]/', subdomain);
	framework.route('/', root);

	// 127.0.0.1	subdomain.website.debug
	// 127.0.0.1	eshop.website.debug
	// 127.0.0.1	blog.website.debug
	framework.route('[subdomain,eshop,blog]/', subdomain);

	// show for all subdomain
	framework.route('/all/', all);

	// hidden for subdomain
	framework.route('[]/contact/', contact);
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