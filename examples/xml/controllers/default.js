exports.install = function(framework) {
	framework.route('/', xml);
}

function xml() {
	
	var self = this;
	var data = ['A', 'B', 'C', 'D', 'E'];
	
	var newline = '\n';	
	self.raw('text/xml', function(fn) {
		fn('<?xml version="1.0" encoding="utf-8"?>' + newline);
		fn('<items>' + newline);
		
		data.forEach(function(o) {
			fn('<name>{0}</name>'.format(o).indent(4) + newline);
		});

		fn('</items>');
	});
}
	
