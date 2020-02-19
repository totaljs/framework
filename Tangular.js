(function(W) {

	if (W.Tangular)
		return;

	var Tangular = {};
	var Thelpers = Tangular.helpers = {};
	Tangular.version = 'v3.0.1';
	Tangular.cache = {};
	Tangular.debug = false;

	W.Tangular = Tangular;
	W.Thelpers = Thelpers;

	var SKIP = { 'null': true, 'undefined': true, 'true': true, 'false': true };
	var REG_VARIABLES = /&&|\|\|/;
	var REG_KEY = /[a-z0-9._]+/gi;
	var REG_KEYCLEAN = /^[a-z0-9_$]+/i;
	var REG_NUM = /^[0-9]/;
	var REG_STRING = /'.*?'|".?"/g;
	var REG_CMDFIND = /\{\{.*?\}\}/g;
	var REG_CMDCLEAN = /\{\{|\}\}/g;
	var REG_ENCODE = /[<>&"]/g;
	var REG_TRIM = /\n$/g;

	Tangular.toArray = function(obj) {
		var keys = Object.keys(obj);
		var arr = [];
		for (var i = 0, length = keys.length; i < length; i++)
			arr.push({ key: keys[i], value: obj[keys[i]] });
		return arr;
	};

	function Template() {
		this.commands;
		this.variables;
		this.builder;
		this.split = '\0';
	}

	Template.prototype.compile = function(template) {

		var self = this;
		var ifcount = 0;
		var loopcount = 0;
		var tmp;
		var loops = [];

		self.variables = {};
		self.commands = [];

		self.builder = template.replace(REG_CMDFIND, function(text) {

			var cmd = text.replace(REG_CMDCLEAN, '').trim();
			var variable = null;
			var helpers = null;
			var index;
			var isif = false;
			var isloop = false;
			var iscode = true;

			if (cmd === 'fi') {
				ifcount--;
				// end of condition
			} else if (cmd === 'end') {
				loopcount--;
				// end of loop
				loops.pop();
			} else if (cmd.substring(0, 3) === 'if ') {
				ifcount++;
				// condition
				variable = self.parseVariables(cmd.substring(3), loops);
				if (variable.length) {
					for (var i = 0; i < variable.length; i++) {
						var name = variable[i];
						if (self.variables[name])
							self.variables[name]++;
						else
							self.variables[name] = 1;
					}
				} else
					variable = null;
				isif = true;
				iscode = true;
			} else if (cmd.substring(0, 8) === 'foreach ') {

				loopcount++;
				// loop

				tmp = cmd.substring(8).split(' ');
				loops.push(tmp[0].trim());

				index = tmp[2].indexOf('.');
				if (index !== -1)
					tmp[2] = tmp[2].substring(0, index);

				variable = tmp[2].trim();

				if (loops.indexOf(variable) === -1) {
					if (self.variables[variable])
						self.variables[variable]++;
					else
						self.variables[variable] = 1;
					variable = [variable];
				}
				else
					variable = null;

				isloop = true;
			} else if (cmd.substring(0, 8) === 'else if ') {
				// else if
				variable = self.parseVariables(cmd.substring(8), loops);
				if (variable.length) {
					for (var i = 0; i < variable.length; i++) {
						var name = variable[i];
						if (self.variables[name])
							self.variables[name]++;
						else
							self.variables[name] = 1;
					}
				} else
					variable = null;
				isif = true;
			} else if (cmd !== 'continue' && cmd !== 'break' && cmd !== 'else') {


				variable = cmd ? cmd.match(REG_KEYCLEAN) : null;

				if (variable)
					variable = variable.toString();

				if (variable && SKIP[variable])
					variable = null;

				if (variable && loops.indexOf(variable) === -1) {
					if (self.variables[variable])
						self.variables[variable]++;
					else
						self.variables[variable] = 1;

					variable = [variable];
				} else
					variable = null;

				if (cmd.indexOf('|') === -1)
					cmd += ' | encode';

				helpers = cmd.split('|');
				cmd = helpers[0];
				helpers = helpers.slice(1);
				if (helpers.length) {
					for (var i = 0; i < helpers.length; i++) {
						var helper = helpers[i].trim();
						index = helper.indexOf('(');
						if (index === -1) {
							helper = 'Thelpers.$execute(model,\'' + helper + '\',\7)';
						} else
							helper = 'Thelpers.$execute(model,\'' + helper.substring(0, index) + '\',\7,' + helper.substring(index + 1);
						helpers[i] = helper;
					}
				} else
					helpers = null;

				cmd = self.safe(cmd.trim() || 'model');
				iscode = false;
			}

			self.commands.push({ index: self.commands.length, cmd: cmd, ifcount: ifcount, loopcount: loopcount, variable: variable, helpers: helpers, isloop: isloop, isif: isif, iscode: iscode });
			return self.split;

		}).split(self.split);


		for (var i = 0, length = self.builder.length; i < length; i++)
			self.builder[i] = self.builder[i].replace(REG_TRIM, '');

		return self.make();
	};

	Template.prototype.parseVariables = function(condition, skip) {

		var variables = [];
		var arr = condition.split(REG_VARIABLES);
		for (var i = 0, length = arr.length; i < length; i++) {

			var key = arr[i].replace(REG_STRING, '');
			var keys = key.match(REG_KEY);

			for (var j = 0; j < keys.length; j++) {
				key = keys[j];
				key = key.split('.')[0];
				if (!key || (REG_NUM).test(key) || SKIP[key])
					continue;
				variables.indexOf(key) === -1 && skip.indexOf(key) === -1 && variables.push(key);
			}
		}
		return variables;
	};

	Template.prototype.safe = function(cmd) {

		var arr = cmd.split('.');
		var output = [];

		for (var i = 1; i < arr.length; i++) {
			var k = arr.slice(0, i).join('.');
			output.push(k + '==null?\'\':');
		}
		return output.join('') + arr.join('.');
	};

	Template.prototype.make = function() {

		var self = this;
		var builder = ['var $output=$text[0];var $tmp;var $index=0;'];

		for (var i = 0, length = self.commands.length; i < length; i++) {

			var cmd = self.commands[i];
			var tmp;

			i && builder.push('$output+=$text[' + i + '];');

			if (cmd.iscode) {

				if (cmd.isloop) {

					var name = '$i' + Math.random().toString(16).substring(3, 6);
					var namea = name + 'a';
					tmp = cmd.cmd.substring(cmd.cmd.lastIndexOf(' in ') + 4).trim();
					tmp = namea + '=' + self.safe(tmp) + ';if(!(' + namea + ' instanceof Array)){if(' + namea + '&&typeof(' + namea + ')===\'object\')' + namea + '=Tangular.toArray(' + namea + ')}if(' + namea + ' instanceof Array&&' + namea + '.length){for(var ' + name + '=0,' + name + 'l=' + namea + '.length;' + name + '<' + name + 'l;' + name + '++){$index=' + name + ';var ' + cmd.cmd.split(' ')[1] + '=' + namea + '[' + name + '];';
					builder.push(tmp);

				} else if (cmd.isif) {
					if (cmd.cmd.substring(0, 8) === 'else if ')
						builder.push('}' + cmd.cmd.substring(0, 8).trim() + '(' + cmd.cmd.substring(8).trim() + '){');
					else
						builder.push(cmd.cmd.substring(0, 3).trim() + '(' + cmd.cmd.substring(3).trim() + '){');
				} else {
					switch (cmd.cmd) {
						case 'else':
							builder.push('}else{');
							break;
						case 'end':
							builder.push('}}');
							break;
						case 'fi':
							builder.push('}');
							break;
						case 'break':
							builder.push('break;');
							break;
						case 'continue':
							builder.push('continue;');
							break;
					}
				}

			} else {
				if (cmd.helpers) {
					var str = '';
					for (var j = 0; j < cmd.helpers.length; j++) {
						var helper = cmd.helpers[j];
						if (j === 0)
							str = helper.replace('\7', cmd.cmd.trim()).trim();
						else
							str = helper.replace('\7', str.trim());
					}
					builder.push('$tmp=' + str + ';if($tmp!=null)$output+=$tmp;');
				} else
					builder.push('if(' + cmd.cmd + '!=null)$output+=' + cmd.cmd + ';');
			}
		}

		builder.push((length ? ('$output+=$text[' + length + '];') : '') + 'return $output;');

		delete self.variables.$;
		var variables = Object.keys(self.variables);
		var names = ['$ || {}', 'model'];

		for (var i = 0; i < variables.length; i++)
			names.push('model.' + variables[i]);

		var code = 'var tangular=function($,model' + (variables.length ? (',' + variables.join(',')) : '') + '){' + builder.join('') + '};return function(model,$){return tangular(' + names.join(',') + ');}';
		return (new Function('$text', code))(self.builder);
	};

	Thelpers.$execute = function(model, name, a, b, c, d, e, f, g, h) {

		if (Thelpers[name] == null) {
			console && console.warn('Tangular: missing helper', '"' + name + '"');
			return a;
		}
		return Thelpers[name].call(model, a, b, c, d, e, f, g, h);
	};

	Thelpers.encode = function(value) {
		return value == null ? '' : value.toString().replace(REG_ENCODE, function(c) {
			switch (c) {
				case '&': return '&amp;';
				case '<': return '&lt;';
				case '>': return '&gt;';
				case '"': return '&quot;';
			}
			return c;
		});
	};

	Thelpers.raw = function(value) {
		return value;
	};

	Tangular.render = function(template, model, repository) {
		if (model == null)
			model = {};
		return new Template().compile(template)(model, repository);
	};

	Tangular.compile = function(template) {
		return new Template().compile(template);
	};

	Tangular.register = function(name, fn) {
		Thelpers[name] = fn;
		return Tangular;
	};

	Thelpers.pluralize = function(r,e,t,a,n){ return r||(r=0),'number'!=typeof r&&(r=parseFloat(r.toString().replace(/\s/g,'').replace(',','.'))),r.pluralize(e,t,a,n); };
	Thelpers.format=function(r,e,t,a){var n=typeof r;if(r==0||r==null)return'';if('number'===n||r instanceof Date)return r.format(e==null?null:e,t,a);'string'!==n&&(r=r.toString()),r=r.trim();for(var i=!1,o=0,f=0,u=0,l=r.length;l>u;u++){var g=r.charCodeAt(u);if(58===g||32===g||84===g){i=!0;break;}if(45===g){if(o++,1===o)continue;i=!0;break;}if(46===g){if(f++,1===f)continue;i=!0;break;}}return i?r.parseDate().format(e||'dd.MM.yyyy'):r.parseFloat().format(e,t,a);};
	Thelpers.def=function(e,n){return e?Thelpers.encode(e):n||'---';};
	Thelpers.currency=function(e,t){switch(typeof e){case'number':return e.currency(t);case'string':return e.parseFloat().currency(t);default:return'';}};

})(global);