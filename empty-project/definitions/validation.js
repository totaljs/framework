
framework.onValidation = function (name, value) {
	
	switch (name) {
		case 'name':
		case 'message':
			return value.length > 0;
		case 'email':
			return value.isEmail();
	}

}