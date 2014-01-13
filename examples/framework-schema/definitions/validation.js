

framework.onValidation = function (name, value, path) {

	switch (name) {
		case 'email':
			return (value || '').isEmail();
		case 'price':
			return value.parseFloat() > 0;
		case 'firstname':
		case 'lastname':
		case 'telephone':
		case 'address':
		case 'name':
			return (value || '').length > 0;
	}

}