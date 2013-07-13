exports.onLoad = function(framework) {
	
	framework.on('controller', function(controller, name) {

		if (controller.url === '/') {

			// controllers/global.js - cancel execute function: viewIndex()
			controller.cancel();

			// redirect to new controller
			controller.redirect('/cancel/');

		}

	});

};