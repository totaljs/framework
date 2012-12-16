exports.version = "1.0.1";

var utils = require('./utils');
var javascript = require('./javascript');
var fs = require('fs');

function renderView(path) {
	var template = fs.readFileSync(path).toString();
	
	var index = 0;
	var count = 0;

	var copy = false;
	var skip = false;

	var code = '';
	var cache = template;

	var repository = [];
	var indexBeg = 0;
	var indexEnd = 0;

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
				var codeIndex = repository.indexOf(codeClean);

				if (codeIndex === - 1) {
					if (codeClean.indexOf('model') === 0)
						repository.push('(function(model){return typeof(model) === \'undefined\' ? \'\' : ' + codeClean + '}).call(this,model);');
					else if (codeClean.indexOf('partial(') === 0)
						repository.push('(function(model){return this.' + codeClean + '}).call(this,model);');
					else if (codeClean.indexOf('template(') === 0)
						repository.push('(function(model){return this.' + codeClean + '}).call(this,model);');
					else if (codeClean.indexOf('version(') === 0)
						repository.push('(function(){return this.' + codeClean + '}).call(this);');
					else if (codeClean.indexOf('resource(') === 0)
						repository.push('(function(){return this.' + codeClean + '}).call(this);');
					else if (codeClean.indexOf('readGET') === 0)
						repository.push('(function(){return this.' + codeClean + '}).call(this);');
					else if (codeClean.indexOf('readPOST') === 0)
						repository.push('(function(){return this.' + codeClean + '}).call(this);');
					else if (codeClean.indexOf('readModel') === 0) {
						var modelIndex = codeClean.indexOf('(');
						if (modelIndex > 0) {
							modelValue =codeClean.substring(0, modelIndex + 1) + 'model,' + codeClean.substring(modelIndex + 1);
							repository.push('(function(model){return this.' + modelValue + '}).call(this,model);');
						};
					}
					else if (codeClean.indexOf('route') === 0)
						repository.push('(function(){return this.' + codeClean + '}).call(this);');
					else if (codeClean.indexOf('body') === 0)
						repository.push('(function(model){return model;}).call(this,model);');			
					else if (codeClean.indexOf('readRepository') === 0)
						repository.push('(function(){return this.' + codeClean + '}).call(this);');
					/*
					else if (codeClean.indexOf('return ') === -1)
						repository.push('(function(model){return utils.htmlEncode(this.repository["' + codeClean + '"] || "");}).call(this,model);');*/
					else
						repository.push('(function(model){' + codeClean +' }).call(this,model);');
					codeIndex = repository.length - 1;
				}
				
				var id = '@###' + codeIndex;
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

	return { html: minifyInlineJavaScript(cache), generator: repository }
}

exports.renderView = function (path) {
	return renderView(path);
};

exports.renderTemplate = function(template, arr, templateEmpty) {
	
	if (arr.length == 0)
		return templateEmpty || '';

	var builder = [];
	var id = template.match(/\{[\w\(\)]+\}/g);	
	arr.forEach(function(o){
		var str = template;
		id.forEach(function(prop) {

			var name = prop.replace(/\s/g, '');
			var isEncode = false;
						
			if (prop.substring(0, 5) === '{raw(') {
				name = name.substring(5);
				name = name.substring(0, name.length - 2);
			} else {
				name = name.substring(1);
				name = name.substring(0, name.length - 1);
				isEncode = true;
			}
			
			var val = o[name];

			if (typeof(val) === 'undefined')
				return;

			val = val.toString();
			str = str.replace(prop, isEncode ? utils.htmlEncode(val) : val);
		});

		builder.push(str)
	});

	return builder.join('');
};

function minifyInlineJavaScript(html, index) {
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
			minifyInlineJavaScript(html, indexBeg + compiled.length);
		};
	}

	return html;
}