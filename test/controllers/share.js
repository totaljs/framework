exports.install = function(framework) {
	framework.route('/share/', view_share);
};

exports.functions = {
	message: function () {
		return 'message';
	}
};

exports.models = {
	user: {
		name: 'Peter',
		age: 28
	}
};

function view_share() {
	this.layout('');
	this.view('index');
}