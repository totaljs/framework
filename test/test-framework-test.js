

var Image = require('../image');


var img = Image.load('/users/petersirka/desktop/b.jpg', false);

img.resize('100%', '100%');
img.watermark('/users/petersirka/desktop/a.jpg', 'center');
img.save('/users/petersirka/desktop/output.jpg');