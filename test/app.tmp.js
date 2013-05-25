var utils = require('partial.js/utils');

function autoprefixer (value) {

	var prefix = ['appearance', 'box-shadow', 'border-radius', 'border-image', 'column-count', 'column-gap', 'column-rule', 'display', 'transform', 'transform-origin', 'transition', 'user-select', 'animation', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-play-state', 'opacity', 'background', 'background-image'];
	var id = '@auto-prefix@';

	if (value.indexOf(id) === -1)
		return value;

	value = value.replace(id, '');

	var builder = [];
	var index = 0;

	// properties
	for (var i = 0; i < prefix.length; i++) {

		var property = prefix[i];
		index = 0;

		while (index !== -1) {

			index = value.indexOf(property, index + 1);

			if (index === -1)
				continue;

			var a = value.indexOf(';', index);
			var b = value.indexOf('}', index);

			var end = Math.min(a, b);

			if (end === -1)
				continue;

			var css = value.substring(index, end);

			end = css.indexOf(':');

			if (end === -1)
				continue;

			if (css.substring(0, end + 1).replace(/\s/g, '') !== property + ':')
				continue;

			builder.push({ name: property, property: css });
		}
	}

	// search @keyframes
	index = 0;

	while (index !== -1) {

		index = value.indexOf('@keyframes', index + 1);
		if (index === -1)
			continue;

		var counter = 0;
		var end = -1;

		for (var indexer = index + 15; indexer < value.length; indexer++) {

			if (value[indexer] === '{')
				counter++;

			if (value[indexer] !== '}')
				continue;

			if (counter > 1) {
				counter--;
				continue;
			}

			end = indexer;
			break;
		};

		if (end === -1)
			continue;

		var css = value.substring(index, end + 1);
		builder.push({ name: 'keyframes', property: css });
	}

	for (var i = 0; i < builder.length; i++) {

		var name = builder[i].name;
		var property = builder[i].property;
		var plus = property;
		var delimiter = ';';
		var before = '';

		if (name === 'keyframes') {
			plus = plus.substring(1);
			delimiter = '\n';
		}

		var updated = plus + delimiter;

		if (name === 'keyframes') {
			updated += '@-webkit-' + plus + delimiter;
			updated += '@-moz-' + plus + delimiter;
			updated += '@-ms-' + plus + delimiter;
			updated += '@-o-' + plus;
			value = value.replace(property, updated);
			continue;
		}

		if (name === 'opacity') {

			var opacity = parseFloat(plus.replace('opacity', '').replace(':', '').replace(/\s/g, ''));
			if (isNaN(opacity))
				continue;

			updated += 'filter:alpha(opacity='+Math.floor(opacity * 100)+')';
			value = value.replace(property, updated);
			continue;
		}

		if (name === 'background' || name === 'background-image') {

			if (property.indexOf('linear-gradient') === -1)
				continue;

			updated = plus + delimiter;
			updated += plus.replace('linear-', '-webkit-linear-') + delimiter;
			updated += plus.replace('linear-', '-moz-linear-') + delimiter;
			updated += plus.replace('linear-', '-o-linear-') + delimiter;
			updated += plus.replace('linear-', '-ms-linear-');
			value = value.replace(property, updated);
			continue;
		}

		if (name === 'display') {

			if (property.indexOf('box') === -1)
				continue;

			updated = plus + delimiter;
			updated += plus.replace('box', '-webkit-box') + delimiter;
			updated += plus.replace('box', '-moz-box');

			value = value.replace(property, updated);
			continue;
		}

		updated += '-webkit-' + plus + delimiter;
		updated += '-moz-' + plus;

		if (name !== 'box-shadow' || name === 'border-radius') {
			updated += delimiter + '-ms-' + plus;
			updated += delimiter + '-o-' + plus;
		}

		value = value.replace(property, updated);
	};

	return value;
};

console.log(autoprefixer(require('fs').readFileSync('/users/petersirka/desktop/default.css').toString('utf8')));

