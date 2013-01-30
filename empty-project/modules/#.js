// your custom framework prototypes

/*
	Authorize handler
	@req {ServerRequest}
	@res {ServerResponse}
	@callback {Function} - @callback(Boolean), true if logged and false if unlogged

	[default: null]
	exports.onAuthorize = function(req, res, callback) {};
*/

/*
	Prefix handler
	@req {ServerRequest}
	return {String}; :: return prefix (default return empty string)

	[default: null]
	exports.onPrefix = function(req) {};
*/

/*
	Versioning static files (this handler call LESS CSS by the background property)
	@name {String} :: name of static file (style.css or script.js)
	return {String}; :: return new name of static file (style-new.css or script-new.js)

	[default: null]
	exports.onVersion = function(name) {};
*/

/*
	Route validator / Request restriction
	@req {ServerRequest}
	@res {ServerResponse}
	return {Boolean};

	[default: null]
	exports.onRoute = function(req, res) {}
*/

/*
	Every routed request call this handler
	@name {String} :: name of controller
	
	@this === Controller

	[default: null]
	exports.onController = function(name) {}
*/

/*
	Render HTML for views
	@argument {String params}
	return {String}

	@this === Controller

	[default: return '']
	exports.onSettings = function() {}
*/

/*
	Render HTML for views
	@argument {String params}
	return {String}

	@this === Controller

	[default: return '<Title', '<meta Description', '<meta Keyword']
	exports.onMeta = function onMeta() {}
*/

/*
	Return size of dimension
	@dimension {String} :: small, large
	return { width: Number, height: Number }

	exports.onPictureDimension = function(dimension) {}
*/

/*
	Return picture URL
	@dimension {String} :: small, large
	@id {String}
	@width {Number}
	@height {Number}
	@alt {String}
	return {String} :: picture URL adress

	[default: return URL address]
	exports.onPictureUrl = function(dimension, id, width, height, alt) {};	
*/