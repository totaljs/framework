var utils = require('partial.js/utils');

exports.init = function(framework) {
	framework.route('/', view);
	framework.route('/b/', view, [], ['B']);
	framework.route('/c/', view, [], ['C']);
	framework.route('/all/', view, [], ['B', 'C']);
}

function view() {
	var self = this;
	self.json(self.repository);
}