// Documentation: http://docs.partialjs.com/Builders.SchemaBuilder/#builders.schema
builders.schema('contactform', { Email: 'string(200)', Phone: 'string(40)', Message: 'string(10000)', Ip: 'string(60)', Created: 'date' }, function(name, isDefault) {
	switch (name) {
		case 'Email':
			return '@';
		case 'Created':
			return new Date();
	}
});

// Documentation: http://docs.partialjs.com/Builders.SchemaBuilder/#builders.validation
builders.validation('contactform', ['Email', 'Message']);