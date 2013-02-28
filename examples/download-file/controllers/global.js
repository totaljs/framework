var utils = require('partial.js/utils');

exports.install = function(framework) {
	framework.route('/', download);
};

function download() {
	this.file('company-profile.pdf', 'about-us.pdf');
	// file in public, download name
}