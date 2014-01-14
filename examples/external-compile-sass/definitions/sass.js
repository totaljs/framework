var sass = require('node-sass');

// Documentation: http://docs.totaljs.com/Framework/#framework.onCompileCSS
framework.onCompileCSS = function (filename, content) {
	return sass.renderSync({ data: content, outputStyle: 'compressed' });
};