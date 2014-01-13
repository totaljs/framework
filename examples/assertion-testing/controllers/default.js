exports.install = function(framework) {
	framework.route('/1/', test1);
	framework.route('/2/', test2);
	framework.route('/3/', test3);
};

function test1() {
	this.plain('1');
}

function test2() {
	/*
	if (this.isTest)
		console.log('IS TEST');
	*/
	this.plain('2');
}

function test3() {
	// throw error
	this.plain('4');
}