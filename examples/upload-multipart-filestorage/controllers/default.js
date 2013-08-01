exports.install = function(framework) {
	framework.route('/', view_homepage);

	// The number is maximum data length to receive
	framework.route('/', view_upload, ['upload'], 1024 * 20);

	// If file length is greater than maximum allowed size
	framework.route('#431', view_error_maximum);

	framework.file('all images', function(req, res) {
		return req.url.indexOf('/upload/') !== -1;
	}, file_picture);
};

function view_homepage() {
	var self = this;

	self.framework.storage.listing(function(err, arr) {

		var model = [];

		arr.forEach(function(directory) {
			directory.split('\n').forEach(function(file) {

				var picture = JSON.parse(file);
				if (picture.extension.contains(['jpg', 'gif', 'png']))
					model.push(picture);
			});
		});

		self.view('homepage', model);
	});
}

function view_error_maximum() {
	var self = this;
	self.statusCode = 431;
	self.plain(utils.httpStatus(self.statusCode));
}


function view_upload() {
	var self = this;

	self.framework.storage.insert(self.files[0].filename, self.files[0].filenameTMP, function(err, id, stat) {
		self.redirect('/?success=ok');
	});

}

function file_picture(req, res) {

	var id = (req.url.match(/\d+/) || '').toString().parseInt();
	var self = this;

	if (id === 0) {
		self.response404(req, res);
		return;
	}

	self.storage.pipe(id, res, req);
}