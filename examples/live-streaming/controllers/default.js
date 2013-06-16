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

	var interval = setInterval(function() {

		index++;

		if (index > 5) {
			index = 1;
			count++;
		}

		if (!self.isConnected) {
			clearInterval(interval);
			return;
		}

		// Params:
		// @filename {String}
		// @stream {ReadStream} :: optional, default undefined
		self.mmr(self.path.public('img/' + index + '.jpg'));

		// or
		// self.mmr('live.jpg', require('fs').createReadStream(self.pathPublic('img/' + index + '.jpg')));

		if (count > 5) {
			clearInterval(interval);

			// close connection
			self.close();
		}

	}, 500);
}