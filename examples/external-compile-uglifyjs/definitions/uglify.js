var uglify = require('uglify-js');

// Documentation: http://docs.partialjs.com/Framework/#framework.onCompileJS
framework.onCompileJS = function (filename, content) {
	return uglify.minify(content, { fromString: true }).code;
};