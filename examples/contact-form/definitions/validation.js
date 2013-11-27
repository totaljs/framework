// Documentation: http://docs.partialjs.com/Framework/#framework.onValidation
framework.onValidation = function(name, value, path) {
	switch (name) {
		case 'Email':
			return value.isEmail();
		case 'Message':
			return value.length > 0;
	};
}