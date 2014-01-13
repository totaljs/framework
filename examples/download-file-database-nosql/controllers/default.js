exports.install = function(framework) {

/*
	var db = framework.database('images');
	db.insert({ file: db.binary.insert('logo.png', 'image/png', require('fs').readFileSync('/users/petersirka/desktop/logo.png')) });
*/

	framework.route('/', view_homepage);
    framework.file('load image from database', static_image);
};

function view_homepage() {
    var self = this;
	self.plain('http://{0}:{1}/1388185217985mspuv7vi.png'.format(self.framework.ip, self.framework.port));
}

// Serve image from database products
function static_image(req, res, isValidation) {

    if (isValidation)
        return req.url.indexOf('.png') !== -1;

    // this === framework
    var self = this;

    var db = self.database('images');
    var id = req.uri.pathname.replace('/', '').replace('.png', '');

    // check client cache via etag
    // if not modified - framework send automatically 304
    // id === etag
    //if (self.notModified(req, res, id))
        //return;

    db.binary.read(id, function(err, stream, header) {

        if (err) {
            self.response404(req, res);
            return;
        }

        // Set HTTP cache via etag
        // Documentation: http://docs.partialjs.com/Framework/#framework.setModified
        //self.setModified(req, res, id);

        // Documentation: http://docs.partialjs.com/Framework/#framework.responseStream
        // self.responseStream(req, res, 'image/png', stream);

        // Documentation: http://docs.partialjs.com/Framework/#framework.responseImage
        self.responseImage(req, res, stream, function(image) {
            image.resize('50%');
            image.output('png');
            image.minify();
        });
    });
}