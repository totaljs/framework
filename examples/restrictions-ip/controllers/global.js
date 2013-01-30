var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {
	this.plain('You are authorized!');
}