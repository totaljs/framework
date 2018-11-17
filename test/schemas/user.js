F.global.schemas = 1;

NEWSCHEMA('Orders', function(schema) {

	schema.define('name', String, true);

	schema.setQuery(function($) {
		$.success('orders');
	});

	schema.setSave(function($) {
		$.success('orders');
	});
});

NEWSCHEMA('Users', function(schema) {
	schema.setQuery(function($) {
		$.success('users');
	});
});