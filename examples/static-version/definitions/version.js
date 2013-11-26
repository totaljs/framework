
// A dynamic versioning
// Documentation: http://docs.partialjs.com/Framework/#framework.onVersion
framework.onVersion = function(name) {

	switch (name) {
		case 'custom.png':
			return 'custom101.png';
	}

	return name;
};