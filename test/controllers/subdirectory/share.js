exports.install = function() {
	framework.route('/sub/share/', view_share);
};

function view_share() {
	this.layout('');
	this.view('sub');
}