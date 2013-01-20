var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', rss);
}

function rss() {
	
	var self = this;
	var data = ['A', 'B', 'C', 'D', 'E'];
	
	var newline = '\n';
	self.raw('text/rss', function(fn) {
		fn('<?xml version="1.0" encoding="utf-8"?>' + newline);
		fn('<items>' + newline);
		
		data.forEach(function(o) {
			fn('<name>{0}</name>'.format(o).indent(4) + newline);
		});

		fn('</items>');
	});
}
	
