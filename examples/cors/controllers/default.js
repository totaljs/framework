exports.install = function(framework) {
	framework.route('/time/', cors_time);
};

function cors_time() {

	var self = this;

	if (!self.cors('*', ['GET'])) {
		self.plain('Not allowed');
		return;
	}

	// OR

	/*
	if (!self.cors(['partialjs.com', 'google.com'], ['GET', 'POST'])) {
		self.plain('Not allowed');
		return;
	}
	*/

	// OR

	/*
	
	// @allow, [@method], [@header], [@credentials]
	// true == with credentials
	
	if (!self.cors(['partialjs.com', 'google.com'], true)) {
		self.plain('Not allowed');
		return;
	}
	*/

	self.plain(new Date().toString());
};