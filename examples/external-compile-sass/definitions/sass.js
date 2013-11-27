var sass = require('node-sass');

// Documentation: http://docs.partialjs.com/Framework/#framework.onCompileCSS
framework.onCompileCSS = function (filename, content) {
	return sass.renderSync({ data: content, outputStyle: 'compressed' });
};