var fs = require('fs');
var path = require('path');
var dir = './total.js/';

var license = '// Copyright 2012-2015 (c) Peter Širka <petersirka@gmail.com>\n//\n// Permission is hereby granted, free of charge, to any person obtaining a\n// copy of this software and associated documentation files (the\n// "Software"), to deal in the Software without restriction, including\n// without limitation the rights to use, copy, modify, merge, publish,\n// distribute, sublicense, and/or sell copies of the Software, and to permit\n// persons to whom the Software is furnished to do so, subject to the\n// following conditions:\n//\n// The above copyright notice and this permission notice shall be included\n// in all copies or substantial portions of the Software.\n//\n// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN\n// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,\n// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR\n// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE\n// USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n';

fs.readdirSync(dir).forEach(function(name) {
	if (name.match(/\.js$/) === null)
		return;
	var filename = path.join(dir, name);
	console.log('....... LINCENSE: ' + name);
	fs.writeFileSync(filename, license + fs.readFileSync(filename, 'utf8'), 'utf8');
});

var binary = path.join(dir, 'bin', 'total');
fs.writeFileSync(binary, '#!/usr/bin/env node\n\n' + license + fs.readFileSync(binary, 'utf8'), 'utf8');

binary = path.join(dir, 'bin', 'tpm');
fs.writeFileSync(binary, '#!/usr/bin/env node\n\n' + license + fs.readFileSync(binary, 'utf8'), 'utf8');
