exports.install = function() {
	framework.route('/share/', view_share);
	framework.route('/router/', view_router);
	framework.route('/share/a/', view_share_a);
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

function view_share_a() {
	this.layout('');
	this.view('a');
}

function view_router() {
	this.plain('dilino gadzo');
}