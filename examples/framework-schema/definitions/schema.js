// Create model schemas

// [product] === array of schema('product')
// product = schema('product')
builders.schema('order', { products: '[product]', firstname: 'string(30)', lastname: 'string(40)', email: 'string(120)', telephone: 'string(20)', address: 'string', ip: 'string', created: Date, updated: Date }, function (name) {

	// Default values
	switch (name) {
		case 'created':
		case 'updated':
			return new Date();
		case 'email':
			return '@';
	}

});

builders.schema('product', { name: 'string(30)', price: 'number' });

builders.schema('contactform', { name: 'string(30)', email: 'string(120)', message: 'string(8000)', ip: 'string', created: Date }, function(name) {
	if (name === 'created')
		return new Date();
});

// Serve for controller.validation()

builders.validation('order', ['firstname', 'lastname', 'email', 'telephone', 'address', 'products']);
builders.validation('contactform', ['name', 'email', 'message']);