
framework.on('controller', function(self, name) {	
	// set default value for each request to controller
	self.repository.sitemap = [{ url: '/', name: 'Homepage' }];
	self.layout('');
});