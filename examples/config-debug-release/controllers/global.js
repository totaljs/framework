
var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {

	var builder = [];
	var self = this;

	Object.keys(self.options).forEach(function(o) {
		var value = self.options[o];
		builder.push('{0} : {1}'.format(o.padRight(30, ' '), value instanceof Array ? value.join(', ') : value));
	});

	self.plain(builder.join('\n'));
}