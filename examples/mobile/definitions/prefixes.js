framework.onPrefix = function(req) {
	var userAgent = req.headers['user-agent'];

	if ((/\iPhone|iPad/gi).test(userAgent))
		return 'ios';

	if ((/\Android/gi).test(userAgent))
		return 'android';

	return '';
};