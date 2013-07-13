// take a look at https://github.com/petersirka/partial.js/issues/12

exports.onLoad = function(framework) {

	// this code affect all controllers
	framework.on('controller', function(controller, name) {

		if (!controller.xhr)
			return;
		
		controller.layout('');
	});
};