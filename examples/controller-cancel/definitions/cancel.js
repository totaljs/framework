framework.on('controller', function(controller, name) {

	if (controller.url === '/') {

		// controllers/default.js - cancel execute function: viewIndex()
		controller.cancel();

		// redirect to new controller
		controller.redirect('/cancel/');

	}

});
