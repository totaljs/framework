exports.install = function(framework) {
	framework.route('/', authorization);
};

function authorization() {

	var self = this;
	var user = self.baa('This is secure area');

	if (user === null)
		return;

	if (user.name !== 'peter' || user.password !== '123456') {
		self.view401();
		return;
	}

	self.plain('You are authorized.');
}