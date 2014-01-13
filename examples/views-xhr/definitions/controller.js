// this code affect all controllers
framework.on('controller', function(controller, name) {

	if (!controller.xhr)
		return;
	
	controller.layout('');
});