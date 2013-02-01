var utils = require('partial.js/utils');
var path = require('path');

exports.init = function() {
	this.route('/', viewHomepage);

	// the number is maximum data receive
	this.route('/', viewHomepage, ['upload'], 1024 * 1000 * 1000);
};

function viewHomepage() {

	var self = this;	
	var model = { info: '...' };

	self.repository.title = 'Templates';

	if (self.files.length > 0) {

		var file = self.files[0];
		model.info = file.fileName + ' ({0} kB)'.format(Math.floor(file.fileSize / 1024, 2));

		// =============================
		// $ brew install graphicsmagick
		// =============================

		// file.isAudio();
		// file.isVideo();		
		// file.isPicture() or file.isImage();

		if (file.isImage()) {
			
			var fileName = self.pathPublic('upload.jpg');
			var picture = file.picture(); // this is equivalent to require('partail.js/picture').init(false);

			// require('partial.js/picture').init(fileName, [isImageMagick]);
			// file.picture([isImageMagick]);

			// picture.resize(w, h, options);
			// picture.resizeCenter(w, h); :: resize(w, h, '^').align('center center').crop(w, h);
			// picture.crop(w, h, x, y);
			// picture.scale(w, h);
			// picture.quality(percentage);
			// picture.align(type); :: left-top left-bottom left-center right-top right-bottom right-center top-center bottom-center center-center
			// picture.blur(radius);
			// picture.normalize();
			// picture.rotate(deg);
			// picture.flip();
			// picture.flop();
			// picture.minify();
			// picture.grayscale();
			// picture.background(color);
			// picture.sepia();
			// picture.command(command, [priority]);

			picture.resizeCenter(300, 300).save(fileName, function(err, fileName) {
				
				model.url = '<div><img src="/{0}" width="300" height="300" alt="Uploaded image" /></div><br />'.format(path.basename(fileName));
				self.view('homepage', model);

			});

			return;
		}
	}

	self.view('homepage', model);
}