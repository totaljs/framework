framework.onPrefix = function(req) {
	var userAgent = req.headers['user-agent'];

	if ((/\Android/gi).test(userAgent))
		return 'android';

	return '';
};