var utils = require('partial.js/utils');

// =====================================================
// In this file you can rewrite all framework prototypes
// Framework call this file automatically
// =====================================================

console.log('# is running');

exports.onError = function(err, name, uri, code) {
	console.log('!ERROR!');
};

exports.onSettings = function() {

	if (arguments.length > 0)
		return '<script type="text/javascript">document.title="{0}";</script>'.format(arguments[0]);

	return '';
};

exports.onMeta = function onMeta() {
	
	var builder = '';
	
	for (var i = 0; i < arguments.length; i++) {
		var arg = utils.htmlEncode(arguments[i]);

		if (arg === null || arg.length === 0)
			continue;

		switch (i) {
			case 0:
				builder += '<title>{0}</title>'.format(arg);
				break;
			case 1:
				builder += '<meta name="description" content="{0}" />'.format(arg);
				break;
			case 2:
				builder += '<meta name="keywords" content="{0}" />'.format(arg);
				break;
			case 3:
				builder += '<link rel="image_src" type="image/jpeg" href="{0}" />'.format(arg);
				break;
		}
	}

	return builder;
};

exports.onPrefix = function(req) {
	var userAgent = req.headers['user-agent'];

	if ((/\iPhone|iPad/gi).test(userAgent))
		return 'ios';

	if ((/\Android/gi).test(userAgent))
		return 'android';

	return '';
};