var utils = require('partial.js/utils');

exports.init = function() {
	this.route('/', waitingArray);
	this.route('/timeout/', waitingTimeout);
}

function waitingArray() {
	var self = this;

	var arr = [1, 2, 3, 4, 5];

	arr.forEachAsync(function(o) {
		
		console.log(o);

	}, function() {
		self.plain('OK');
	});
}

function waitingTimeout() {
	var self = this;
	setTimeout(function() {
		self.plain('OK');
	}, 5000);
}