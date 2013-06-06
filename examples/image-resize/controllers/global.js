var utils = require('partial.js/utils');
var path = require('path');

exports.install = function(framework) {
	framework.route('/', viewHomepage);

	// the number is maximum data receive
	framework.route('/', viewHomepage, ['upload'], 1024 * 1000 * 1000);
};

function viewHomepage() {

	var self = this;
	var model = { info: '...' };

	self.repository.title = 'Templates';

	if (self.files.length > 0) {

		var file = self.files[0];
		model.info = file.filename + ' ({0} kB)'.format(Math.floor(file.size / 1024, 2));

		// =============================
		// $ brew install graphicsmagick
		// =============================

		// file.isAudio();
		// file.isVideo();
		// file.isImage();

		if (file.isImage()) {

			var filename = self.path.public('upload.jpg');
			var image = file.image(); // this is equivalent to require('partail.js/image').init(false);

			// require('partial.js/image').init(filename, [isImageMagick]);
			// file.image([isImageMagick]);

			// image.identify(function(err, info) { info.width, info.heigth });
			// image.resize(w, h, options);
			// image.resizeCenter(w, h); :: resize(w, h, '^').align('center center').crop(w, h);
			// image.crop(w, h, x, y);
			// image.scale(w, h);
			// image.quality(percentage);
			// image.align(type); :: left-top left-bottom left-center right-top right-bottom right-center top-center bottom-center center-center
			// image.blur(radius);
			// image.normalize();
			// image.rotate(deg);
			// image.flip();
			// image.flop();
			// image.minify();
			// image.grayscale();
			// image.background(color);
			// image.sepia();
			// image.command(command, [priority]);
			image.resizeCenter(300, 300).save(filename, function(err, filename) {

				model.url = '<div><img src="/{0}" width="300" height="300" alt="Uploaded image" /></div><br />'.format(path.basename(filename));
				self.view('homepage', model);

			});

			return;
		}
	}

	self.view('homepage', model);
}