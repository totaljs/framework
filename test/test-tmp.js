require('../index');

NEWSCHEMA('User').make(function(schema) {

	schema.define('name', String, true);
	schema.define('age', Number, true);
	schema.define('email', 'Email', true);
	schema.define('phone', 'Phone', true);

	console.log(schema.schema.email);
});