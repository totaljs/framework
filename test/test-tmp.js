require('../index');

NEWSCHEMA('Address', function(schema) {
	schema.define('countryid', 'Upper(3)', true);

	schema.verify('countryid', function($) {
		console.log('1--->', $.value);
		$.invalid('error-country');
		//$.next();
	});

});

NEWSCHEMA('Users', function(schema) {

	schema.define('address', 'Address', true);
	schema.define('userid', 'String(20)', true);

	schema.verify('userid', function($) {
		console.log('2--->', $.value);
		$.next();
	});

	schema.make({ address: { countryid: 'kokotaris' }, userid: '123456' }, function(err, response) {
		console.log('');
		console.log('');
		console.log(err, response);
	});
});