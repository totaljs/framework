var utils = require('partial.js/utils');

// ==================================================
// In this file, you can rewrite framework prototypes
// This file call framework automatically
// ==================================================

exports.onValidation = function(name, value) {
	switch (name) {
		case 'Email':
			return utils.isEmail(value);
		case 'Message':
			return value.length > 0;
	};
}