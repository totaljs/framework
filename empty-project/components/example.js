// optional
exports.install = function(framework) {
	// component doesn't support routing
	console.log('OK');
};

// optional
exports.usage = function(isDetailed) {
	return '';
};

// optional
exports.configure = function(setup) {

};

// REQUIRED
exports.render = function(data) {
	// this === controller or this === framework
	return '';
};