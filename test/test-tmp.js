require('../index');

NEWSCHEMA('Address', function(schema) {

	schema.define('countryid', function($) {
		console.log('OKokok', $);
		$.next('OK');
	}, true);

});

NEWSCHEMA('Users', function(schema) {

	schema.define('address', 'Address', true);

	schema.define('userid', function($) {
		console.log('userid');
		$.next('OK');
	}, true);

	schema.make({ address: { countryid: 'kokotaris' }, userid: '123456' }, console.log);
});