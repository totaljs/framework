
exports.install = function(framework) {
	framework.route('/', viewIndex);
	framework.route('/cancel/', viewCancel);
};

function viewCancel() {
	this.plain('viewCancel');
};

function viewIndex() {
	this.plain('viewIndex');
};