

framework.onValidation = function (name, value) {
	
	switch (name) {
		case 'email':
			return (value || '').isEmail();
		case 'firstname':
		case 'lastname':
		case 'telephone':
		case 'address':
			return (value || '').length > 0;
	}

}