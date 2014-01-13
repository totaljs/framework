exports.install = function(framework) {
	framework.route('/', view_homepage);
	framework.route('/live/', view_live);
};

function view_homepage() {
	var self = this;
	self.view('homepage');
}

function view_live() {

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

		// Documentation: http://docs.partialjs.com/FrameworkController/#controller.mmr
		self.mmr(self.path.public('img/' + index + '.jpg'));

		// or
		// self.mmr('live.jpg', require('fs').createReadStream(self.pathPublic('img/' + index + '.jpg')));

		if (count > 5) {
			clearInterval(interval);

			// close connection
			// Documentation: http://docs.partialjs.com/FrameworkController/#controller.close
			self.close();
		}

	}, 500);
}