exports.ok = 1;

var User = SCHEMA('test').add('User');
User.define('name', 'string(10)', true);
User.setValidation(function(name, value) {
	return value.length > 0;
});