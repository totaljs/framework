exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {
	this.plain('Hello World!');
}