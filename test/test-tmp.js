var Utils = require('../utils');
var css = '.container{.b{font-weight:bold}}#neviem{.u{text-decoration:underline;}}';
var beg = -1;
var end = -1;
var index = 0;
while (true) {

    console.log(beg, end);

    beg = css.indexOf('{', beg + 1);
    if (beg === -1)
        break;

    index = css.indexOf('{', beg + 1);
    end = css.indexOf('}', beg);

    console.log(index > end);
}