exports.ok = 1;

var User = NEWSCHEMA('test', 'User');
User.define('name', 'string(10)', true);
User.setValidate(function(name, value) {
	return value.length > 0;
});

NEWSCHEMA('filter').make(function(schema) {
	schema.define('name', String, true, 'create');
	schema.define('age', Number, true, 'update');
	schema.setValidate(function() {
		return false;
	});
});