var configuration = { class: 'grid' };

exports.install = function(framework) {
	// @#auto-vendor-prefix#@ = framework automatically adds prefixes
	framework.fs.create.css('grid', '@#auto-vendor-prefix#@\n.grid{width:100%;border:1px solid #E0E0E0;border-right:0;border-bottom:0;font:normal 11px Arial;color:gray}.grid td{border:1px solid #E0E0E0;border-left:0;border-top:0;padding:5px 8px}', true);
};

exports.configure = function(obj) {
	utils.extend(configuration, obj);
};

exports.render = function(data) {

	// this === controller
	var self = this;

	// I created grid.css in exports.install
	// This function adds grid.css into HTML @{head}
	self.head('grid.css');

	var builder = '<table width="100%" cellspacing="0" cellpadding="0" border="0" class="' + configuration.class + '">';
	var length = data.length;

	for (var i = 0; i < length; i++)
		builder += '<tr><td>' + data[i] + '</td></tr>';

	return builder + '</table>';
};