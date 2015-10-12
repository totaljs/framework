require('../index').http('debug');

F.route('/', function() {
	var self = this;
	console.log('SOM TU');
	self.memorize('test', '10 minutes', function() {
		setTimeout(function() {
			self.plain('NOOK');
		}, 3000);
	});
}, [5000]);