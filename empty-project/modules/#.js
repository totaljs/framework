// your custom framework prototypes
// this code it run automatically

/*
	Error Handler
	@err {Error}
	@name {String} :: name of Controller (optional)
	@uri {Uri} :: optional

	[default: console.log(err)]
	exports.onError = function(err, name, uri) {}
*/

/*
	Authorize handler
	@req {ServerRequest}
	@res {ServerResponse}
	@callback {Function} - @callback(Boolean), true if logged and false if unlogged

	[default: null]
	exports.onAuthorize = function(req, res, callback) {};
*/

/*
	Global framework validation
	@name {String}
	@value {String}
	return {Boolean or utils.isValid() or StringErrorMessage};

	exports.onValidation = function(name, value) {};
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