var UglifyJS = require('uglify-js');
var fs = require('fs');
var path = require('path');
var dir = './total.js/';

var license = '// Copyright 2012-2015 (c) Peter Širka <petersirka@gmail.com>\n//\n// Permission is hereby granted, free of charge, to any person obtaining a\n// copy of this software and associated documentation files (the\n// "Software"), to deal in the Software without restriction, including\n// without limitation the rights to use, copy, modify, merge, publish,\n// distribute, sublicense, and/or sell copies of the Software, and to permit\n// persons to whom the Software is furnished to do so, subject to the\n// following conditions:\n//\n// The above copyright notice and this permission notice shall be included\n// in all copies or substantial portions of the Software.\n//\n// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN\n// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,\n// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR\n// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE\n// USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n';

var merge = ['builders.js', 'utils.js', 'image.js', 'nosql.js', 'mail.js', 'internal.js', 'index.js'];
var buffer = [];

for (var i = 0, length = merge.length; i < length; i++) {

    var file = merge[i];
    var content = fs.readFileSync('../' + file).toString('utf8');

    switch (file) {
        case 'index.js':
            buffer.push(content);
            break;
        default:
            buffer.push('(function(module){var exports=module.exports;global.framework_' + file.substring(0, file.length - 3) + '=module.exports;\n' + content + 'return module;})({ exports: {} });');
            break;
    }
}

var output = buffer.join('');
var options = {};

options.fromString = true;
options.mangle = true;

output = UglifyJS.minify(output, options).code;

fs.writeFileSync(path.join(process.cwd(), 'total.js'), license + output);