exports.group = 'serverside';
exports.install = function() {
	F.route('/components/contactform/', function() {
		this.plain('CONTACTFORM COMPONENTS');
	});
};