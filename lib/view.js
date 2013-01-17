// Copyright Peter Širka, Web Site Design s.r.o. (www.petersirka.sk)
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

exports.version = "1.1.3";

var utils = require('./utils'),
	path = require('path'),
	javascript = require('./javascript'),
	fs = require('fs');

function view(template) {
	var index = 0;
	var count = 0;

	var copy = false;

	var code = '';
	var cache = template;

	var repository = [];
	var indexBeg = 0;

	while (index < cache.length) {

		var current = cache[index];
		var next = cache[index + 1];
		
		index++;

		if (!copy && current === '@' && next === '{') {
			copy = true;
			count = 0;
			indexBeg = index;
			continue;
		}

		if (copy && current === '{') {
			count++;
			if (count <= 1)
				continue;
		}
		
		if (copy && current === '}') {
			if (count > 1)
				count--;
			else {
				copy = false;
				countParser = 0;
				
				var codeClean = code.trim();
				var codeIndex = 0;
				var id = '@###';

				var item = repository.find(function(o) {
					return o.onExecute === codeClean;
				});

				if (item === null) {

					codeIndex = repository.length;
					id += codeIndex;
					var vaar = 'var $id = "' + id + '";';

					if (codeClean.indexOf('controller(') === 0)
						repository.push(vaar + 'this.$' + insertParam(codeClean, '$id,'));
					if (codeClean.indexOf('controllerVisible(') === 0)
						repository.push(vaar + 'this.$' + insertParam(codeClean, '$id,'));
					else if (codeClean.indexOf('body') === 0)
						repository.push(vaar + 'this.$layout($id, cb);');
					else if (codeClean.indexOf('partial(') === 0)
						repository.push(vaar + 'this.$' + insertParam(codeClean, '$id,'));
					else if (codeClean.indexOf('isChecked(') === 0)
						repository.push(vaar + 'self.onValue($id,this.$' + codeClean + ')');
					else if (codeClean.indexOf('isReadonly(') === 0)
						repository.push(vaar + 'self.onValue($id,this.$' + codeClean + ')');
					else if (codeClean.indexOf('isSelected(') === 0)
						repository.push(vaar + 'self.onValue($id,this.$' + codeClean + ')');
					else if (codeClean.indexOf('isDisabled(') === 0)
						repository.push(vaar + 'self.onValue($id,this.$' + codeClean + ')');
					else if (codeClean.indexOf('partialIf(') === 0)
						repository.push(vaar + 'this.$' + insertParam(codeClean, '$id,'));
					else if (codeClean.indexOf('partialVisible(') === 0)
						repository.push(vaar + 'this.$' + insertParam(codeClean, '$id,'));
					else if (codeClean.indexOf('model.') === 0)
						repository.push(vaar + 'self.onValue($id,utils.htmlEncode(this.' + codeClean + '))');
					else if (codeClean.indexOf('!model.') === 0)
						repository.push(vaar + 'self.onValue($id,this.' + codeClean.substring(1) + ')');
					else if (codeClean.indexOf('options') === 0)
						repository.push(vaar + 'self.onValue($id,utils.htmlEncode(this.app.options.user' + codeClean.substring(7) + '))');
					else if (codeClean.indexOf('!options') === 0)
						repository.push(vaar + 'self.onValue($id,this.app.options.user' + codeClean.substring(8) + ')');
					else if (codeClean.indexOf('if(') === 0)
						repository.push(vaar + 'self.onValue($id,utils.htmlEncode(this.$' + codeClean + '))');
					else if (codeClean.indexOf('!if(') === 0)
						repository.push(vaar + 'self.onValue($id,this.$' + codeClean.substring(1) + ')');
					else if (codeClean.indexOf('repository.') === 0)
						repository.push(vaar + 'self.onValue($id,utils.htmlEncode(this.' + codeClean + '))');
					else if (codeClean.indexOf('!repository.') === 0)
						repository.push(vaar + 'self.onValue($id,this.' + codeClean.substring(1) + ')');
					else if (codeClean.indexOf('get.') === 0)
						repository.push(vaar + 'self.onValue($id,utils.htmlEncode(this.get.' + codeClean.substring(4) + '))');
					else if (codeClean.indexOf('!get.') === 0)
						repository.push(vaar + 'self.onValue($id,this.get.' + codeClean.substring(5) + ')');
					else if (codeClean.indexOf('post.') === 0)
						repository.push(vaar + 'self.onValue($id,utils.htmlEncode(this.post.' + codeClean.substring(5) + '))');
					else if (codeClean.indexOf('!post.') === 0)
						repository.push(vaar + 'self.onValue($id,this.post.' + codeClean.substring(6) + ')');
					else if (codeClean.indexOf('session.') === 0)
						repository.push(vaar + 'self.onValue($id,utils.htmlEncode(this.' + codeClean + '))');
					else if (codeClean.indexOf('!session.') === 0)
						repository.push(vaar + 'self.onValue($id,this.' + codeClean.substring(1) + ')');
					else if (codeClean.indexOf('resource(') === 0)
						repository.push(vaar + 'self.onValue($id,utils.htmlEncode(this.' + codeClean + '))');
					else if (codeClean.indexOf('!resource(') === 0)
						repository.push(vaar + 'self.onValue($id,this.' + codeClean.substring(1) + ')');					
					else if (codeClean.indexOf('template(') === 0)
						repository.push(vaar + 'this.$' + insertParam(codeClean, '$id,'));
					else if (codeClean.indexOf('templateIf(') === 0)
						repository.push(vaar + 'this.$' + insertParam(codeClean, '$id,'));
					else if (codeClean.indexOf('templateVisible(') === 0)
						repository.push(vaar + 'this.$' + insertParam(codeClean, '$id,'));
					else if (codeClean.indexOf('routeJS(') === 0 || codeClean.indexOf('routeCSS(') === 0 || codeClean.indexOf('routeImage(') === 0 || codeClean.indexOf('routeVideo(') === 0 || codeClean.indexOf('routeFont(') === 0 || codeClean.indexOf('routeStatic(') === 0 || codeClean.indexOf('routeDocument(') === 0)
						repository.push(vaar + 'this.$' + insertParam(codeClean, '$id,'));
				} else
					id += codeIndex;

				var other = cache.substring(indexBeg + code.length + 2);

				cache = cache.substring(0, indexBeg - 1) + id;	
				cache += other;

				index = indexBeg;
				code = '';
				continue;
			}
		}
		
		if (copy)
			code += current;
	}

	return { html: compressJS(cache), generator: repository }
}

function insertParam(str, value) {
	var modelIndex = str.indexOf('(');
	var modelValue = str;
	if (modelIndex > 0)
		modelValue = str.substring(0, modelIndex + 1) + value + str.substring(modelIndex + 1);
	return modelValue;
}

function compressJS(html, index) {

	var strFrom = '<script type="text/javascript">';
	var strTo = '</script>';

	var indexBeg = html.indexOf(strFrom, index || 0);
	if (indexBeg > 20) {
					
		var indexEnd = html.indexOf(strTo, indexBeg + strFrom.length);
		if (indexEnd > 0) {
			var js = html.substring(indexBeg, indexEnd + strTo.length);
			var compiled = javascript.compile(js);
			html = html.replace(js, compiled);

			// voláme znova funkciu v prípade
			compressJS(html, indexBeg + compiled.length);
		};
	}

	return html;
}

function parseFromFile(subscribe, name, prefix, cb, key) {
	var fileName = utils.combine(subscribe.app.options.directoryViews, name + prefix + '.html');
	
	var callback = function(data) {

		if (data === null) {
			
			// súbor sa nenašiel a bol nastavený prefix
			// prefix odstraňujeme a načítavame klasickú šablonu
			exports.render(subscribe, name, '', cb);
			return;
		};

		var viewData = view(data.toString('utf8'));
		
		// if debug == no cache
		if (subscribe.app.options.debug) {
			cb(viewData);
			return;
		}

		cb(subscribe.app.cache.write(key, viewData, new Date().add('mm', 5)));
	};

	utils.loadFromFile(fileName, callback, prefix.length > 0 ? null : '');
}

// ======================================================
// EXPORTS
// ======================================================

exports.render = function (subscribe, name, prefix, cb) {

	var key = 'views.' + name + (prefix.length > 0 ? '#' + prefix : '');	
	var data = subscribe.app.cache.read(key);
		
	if (data === null) {
		parseFromFile(subscribe, name, prefix, cb, key);
		return;
	}

	cb(data);
};