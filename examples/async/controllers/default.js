exports.install = function(framework) {
	framework.route('/', viewHomepage, ['+xhr']);
};

function viewHomepage() {
	var self = this;
	var builder = [];
	
	// Documentation: http://docs.partialjs.com/Async/
	self.await(function(complete) {

		// Documentation: http://docs.partialjs.com/FrameworkUtils/#utils.request
		utils.request('https://www.google.com', 'GET', null, function(err, data) {
			var output = err ? 'error' : data.length.toString();
			builder.push('www.google.com -> ' + output);
			complete();
		});
	});

	self.await(function(complete) {

		// Documentation: http://docs.partialjs.com/FrameworkUtils/#utils.request
		utils.request('https://www.expressjs.com', 'GET', null, function(err, data) {
			var output = err ? 'error' : data.length.toString();
			builder.push('www.expressjs.com -> ' + output);
			complete();
		});
	});

	self.await(function(complete) {

		// Documentation: http://docs.partialjs.com/FrameworkUtils/#utils.request
		utils.request('http://www.yahoo.com', 'GET', null, function(err, data) {
			var output = err ? 'error' : data.length.toString();
			builder.push('www.yahoo.com -> ' + output);
			complete();
		});
	});

	self.await('partial', function(complete) {

		// Documentation: http://docs.partialjs.com/FrameworkUtils/#utils.request
		utils.request('http://www.partialjs.com', 'GET', null, function(err, data) {
			var output = err ? 'error' : data.length.toString();
			builder.push('www.partialjs.com -> ' + output);
			complete();
		});
	});
	
	// waiting for await('partial')
	self.wait('waiting 1', 'partial', function(complete) {
		console.log('waiting 1 complete');
		setTimeout(function() {
			complete();
		}, 1000);
	});

	// waiting for wait('waiting')
	self.wait('waiting 2', 'waiting 1', function(complete) {
		console.log('waiting 2 complete');
		setTimeout(function() {
			complete();
		}, 1000);
	});	

	/*
		self.complete(function() {
			self.view('homepage', builder);
		});

		or ...
	*/

	if (self.xhr)
		self.jsonAsync(builder);
	else
		self.viewAsync('homepage', builder);
}