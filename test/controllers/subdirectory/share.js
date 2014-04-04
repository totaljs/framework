exports.install = function(framework) {
	framework.route('/sub/share/', view_share);
};

function view_share() {
	this.layout('');
	this.view('sub');
}