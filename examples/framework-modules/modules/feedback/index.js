var helper = require('./helper');

exports.install = function (framework) {
	framework.route('/feedback/', feedback, ['xhr', 'post']);
};

function feedback() {
	this.json({ message: helper.toUpper('Thanks!') });
}