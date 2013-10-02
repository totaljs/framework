exports.install = function(framework) {
	framework.route('/', xml);
}

function xml() {
	var self = this;

	self.res.writeHead(200, { 'Content-Type': 'text/xml' });	
	self.res.write('<xml>\n')

	// write async loop
	// {
	self.res.write('<item value="1" />\n'.indent(4));
	self.res.write('<item value="1" />\n'.indent(4));
	self.res.write('<item value="1" />\n'.indent(4));
	self.res.write('<item value="1" />\n'.indent(4));
	// .... 
	// .... 
	// .... 
	// .... 
	// .... 
	// }
	self.res.write('</xml>')
	self.close();
}
	
