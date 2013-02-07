exports.init = function() {
	var self = this
	self.route('/1/', test1);	
	self.route('/2/', test2);
	self.route('/3/', test3);
};

function test1() {
	this.plain('1');
}

function test2() {

	/*
	if (this.isTest)
		console.log('THIS IS TESTED');
	*/

	this.plain('2');
}

function test3() {
	// throw error
	this.plain('4');
}