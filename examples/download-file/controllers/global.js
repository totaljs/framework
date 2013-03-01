var utils = require('partial.js/utils');

exports.install = function(framework) {
	framework.route('/', download);
};

function download() {
	// documentation: http://www.partialjs.com/documentation/controller/
	this.file('company-profile.pdf', 'about-us.pdf');
}