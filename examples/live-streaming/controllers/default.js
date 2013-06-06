exports.install = function(framework) {
	framework.route('/', viewHomepage);
	framework.route('/live/', viewLive);
};

function viewHomepage() {
	var self = this;
	self.view('homepage');
}

function viewLive() {

	var self = this;

	var index = 0;
	var count = 0;

	self.mixed.beg();

	var interval = setInterval(function() {

		index++;

		if (index > 5) {
			index = 1;
			count++;
		}

		// Params:
		// @filename {String}
		// @stream {ReadStream} :: optional, default undefined
		self.mixed.send(self.path.public('img/' + index + '.jpg'));

		// or
		// self.mixed.send('live.jpg', require('fs').createReadStream(self.pathPublic('img/' + index + '.jpg')));

		if (count > 5) {
			self.mixed.end();
			clearInterval(count);
		}

	}, 500);
}