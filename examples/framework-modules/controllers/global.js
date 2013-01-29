var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {

	var self = this;

	// call module
	var now = self.module('utils').now();

	self.plain('From module utils -> {0}'.format(now));
}