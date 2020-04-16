#! /usr/bin/env node

var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var os = require('os');
var Utils = require('total.js/utils');
var Internal = require('total.js/internal');
var $type = 0;
var isDirectory = false;

function display_help() {
	console.log('--------------------------------------------------------');
	console.log('TEMPLATES');
	console.log('--------------------------------------------------------');
	console.log('');
	console.log('without arguments      : creates emptyproject');
	console.log('flow                   : creates emptyproject-flow');
	console.log('dashboard              : creates emptyproject-dashboard');
	console.log('flowboard              : creates emptyproject-flowboard');
	console.log('spa                    : creates emptyproject-jcomponent');
	console.log('pwa                    : creates emptyproject-pwa');
	console.log('rest                   : creates emptyproject-restservice');
	console.log('cms                    : downloads Total.js CMS');
	console.log('eshop                  : downloads Total.js Eshop');
	console.log('superadmin             : downloads Total.js SuperAdmin');
	console.log('openplatform           : downloads Total.js OpenPlatform');
	console.log('helpdesk               : downloads Total.js HelpDesk');
	console.log('');
	console.log('--------------------------------------------------------');
	console.log('TOOLS');
	console.log('--------------------------------------------------------');
	console.log('');
	console.log('-translate             : creates a resource file with the localized text from views');
	console.log('-translate "TEXT"      : creates an identificator for the resource');
	console.log('-translate filename    : parses and creates a resource file from the text file');
	console.log('-translatecsv          : parses and creates CSV with localization in the current directory');
	console.log('-csv filename          : parses CSV and creates resources from CSV file');
	console.log('-diff source target    : creates differences between two resources "-diff source target"');
	console.log('-merge source target   : merges first resource into the second "-merge source target"');
	console.log('-clean source          : cleans a resource file "-clean source"');
	console.log('-minify filename       : minifies .js, .css or .html file into filename.min.[extension]');
	console.log('-bundle filename       : makes a bundle from the current directory');
	console.log('-package filename      : makes a package from the current directory');
	console.log('-install               : run "totaljs -install help" to see what can be installed');
	console.log('8000                   : starts a server');
	console.log('');
}

function translateFile(a) {

	if (!fs.existsSync(a))
		return false;

	var arr = fs.readFileSync(a).toString('utf8').split('\n');
	var builder = [];
	var count = 0;

	for (var i = 0, length = arr.length; i < length; i++) {
		var line = arr[i].trim();
		if (line.length === 0)
			continue;
		builder.push('T' + line.hash().padRight(17, ' ') + ': ' + line);
		count++;
	}

	fs.writeFileSync('translate.resource', '// Total.js translation file\n// Created: ' + new Date().format('yyyy-MM-dd HH:mm') + '\n' + builder.join('\n'));
	console.log('Total.js: the translation was created (' + count + ' texts)');
	return true;
}

function diff(a, b) {

	if (!fs.existsSync(a)) {
		console.log('The translation file does not exist: ' + a);
		return;
	}

	if (!fs.existsSync(b)) {
		console.log('The translation file does not exist: ' + b);
		return;
	}

	var ba = fs.readFileSync(a).toString('utf8');
	var bb = fs.readFileSync(b).toString('utf8');
	var ca = ba.parseConfig();
	var cb = bb.parseConfig();
	var ka = Object.keys(ca);
	var kb = Object.keys(cb);

	ba = ba.split('\n');
	bb = bb.split('\n');

	var output = '';
	var items = [];
	var add = 0;
	var rem = 0;
	var padding = 0;

	for (var i = 0, length = ba.length; i < length; i++) {
		if (ba[i].indexOf(ka[0]) !== -1) {
			padding = ba[i].indexOf(':');
			break;
		}
	}

	if (padding <= 0)
		padding = 17;

	function find_comment(arr, id) {
		var comment = '';
		for (var i = 0, length = arr.length; i < length; i++) {
			if (arr[i].indexOf(id) !== -1)
				return comment;
			var line = arr[i];
			if (line[0] !== '/' && line[1] !== '/')
				continue;
			comment = line;
		}
		return '';
	}

	var comment = '';
	var prev = '';

	for (var i = 0, length = ka.length; i < length; i++) {
		var key = ka[i];

		if (cb[key] !== undefined)
			continue;

		comment = find_comment(ba, key);

		if (comment) {
			if (items[items.length - 1] !== '')
				items.push('');
			items.push(comment);
		}

		var empty = comment === prev;

		prev = comment;
		items.push(key.padRight(padding) + ': ' + ca[key]);

		if (!empty)
			items.push('');

		add++;
	}

	if (items.length > 0) {
		output += '\n';
		output += 'Add to "' + b + '" these:\n';
		output += '\n';
		output += items.join('\n');
		output += '\n';
	}

	items = [];

	for (var i = 0, length = kb.length; i < length; i++) {
		var key = kb[i];

		if (ca[key] !== undefined)
			continue;

		comment = find_comment(bb, key);

		if (comment) {
			if (items[items.length - 1] !== '')
				items.push('');
			items.push(comment);
		}
		else if (prev !== '')
			items.push('');

		var empty = comment === prev;

		prev = comment;
		items.push(key.padRight(padding) + ': ' + cb[key]);

		if (!empty)
			items.push('');

		rem++;
	}

	if (items.length) {
		output += '\n';
		output += 'Remove from "' + b + '" these:\n';
		output += '\n';
		output += items.join('\n');
		output += '\n';
	}

	var filename = path.join(path.dirname(b), path.basename(b, '.resource') + '-diff.txt');
	fs.writeFileSync(filename, '// Total.js diff file\n// Created: ' + new Date().format('yyyy-MM-dd HH:mm') + '\n' + clean_resource(output));
	console.log('========================================');
	console.log('Translation files differences:');
	console.log('========================================');
	console.log('');
	console.log('added    : ' + add);
	console.log('removed  : ' + rem);
	console.log('output   : ' + filename);
	console.log('');
}

function merge(a, b) {
	if (!fs.existsSync(a)) {
		console.log('The translation file does not exist: ' + a);
		return;
	}

	if (!fs.existsSync(b)) {
		console.log('The translation file does not exist: ' + b);
		return;
	}

	var ba = fs.readFileSync(b).toString('utf8');
	var bb = fs.readFileSync(a).toString('utf8');
	var arr = ba.split('\n');
	var output = [];
	var cb = bb.parseConfig();
	var upd = 0;

	for (var i = 0, length = arr.length; i < length; i++) {

		var line = arr[i];
		if (!line || line[0] === '#' || line.startsWith('//')) {
			output.push(line);
			continue;
		}

		var index = line.indexOf(' :');
		if (index === -1) {
			index = line.indexOf('\t:');
			if (index === -1) {
				output.push(line);
				continue;
			}
		}

		var key = line.substring(0, index).trim();
		var val = cb[key];
		if (!val) {
			output.push(line);
			continue;
		}

		upd++;
		output.push(key.padRight(index) + ' : ' + val);
	}

	var filename = path.join(path.dirname(b), path.basename(b, '.resource') + '-merged.txt');
	fs.writeFileSync(filename, '// Total.js merged file\n// Created: ' + new Date().format('yyyy-MM-dd HH:mm') + '\n' + clean_resource(output.join('\n')));
	console.log('========================================');
	console.log('Merged result:');
	console.log('========================================');
	console.log('');
	console.log('merged   : ' + upd);
	console.log('output   : ' + filename);
	console.log('');
}

function clean_resource(content) {
	var lines = content.split('\n');
	var output = [];
	var max = 0;

	for (var i = 0, length = lines.length; i < length; i++) {
		var line = lines[i];
		if (!line || line[0] === '#' || line.startsWith('//'))
			continue;

		var index = line.indexOf(' :');
		if (index === -1) {
			index = line.indexOf('\t:');
			if (index === -1)
				continue;
		}

		max = Math.max(max, index);
	}

	for (var i = 0, length = lines.length; i < length; i++) {
		var line = lines[i];
		if (!line || line[0] === '#' || line.startsWith('//')) {
			output.push(line);
			continue;
		}

		var index = line.indexOf(' :');
		if (index === -1) {
			index = line.indexOf('\t:');
			if (index === -1) {
				output.push(line);
				continue;
			}
		}

		var key = line.substring(0, index).trim();
		output.push(key.padRight(max, ' ') + ' : ' + line.substring(index + 2).trim());
	}

	return output.join('\n');
}

function parse_csv(content) {

	var output = {};
	var max = 0;
	var csv = content.parseCSV(';');

	for (var i = 1; i < csv.length; i++) {
		var line = csv[i];
		var key = line.a || '';
		var val = line.b || '';
		if (key) {
			max = Math.max(key.length, max);
			output[key] = val;
		}
	}

	var builder = [];
	max += 10;

	Object.keys(output).forEach(function(key) {
		builder.push('{0}: {1}'.format(key.padRight(max, ' '), output[key]));
	});

	return '\n' + builder.join('\n');
}

function main() {

	console.log('');
	console.log('|==================================================|');
	console.log('| Total.js - www.totaljs.com                       |');
	console.log('| Version: v' + require('total.js').version_header.padRight(39) + '|');
	console.log('|==================================================|');
	console.log('');

	var dir = process.cwd();
	for (var i = 2; i < process.argv.length; i++) {
		var arg = process.argv[i];
		var cmd = arg.toLowerCase();

		if (cmd.substring(0, 2) === '--')
			cmd = cmd.substring(1);

		if (i === 2) {
			var port = cmd.parseInt();
			if (port) {

				CONF.directory_temp = '~' + path.join(os.tmpdir(), 'totaljs' + dir.hash());
				CONF.directory_public = '~' + dir;
				CONF.allow_compile_html = false;
				CONF.allow_compile_script = false;
				CONF.allow_compile_style = false;

				F.accept('.less', 'text/less');

				F.http('debug', { port: port, directory: dir });

				F.route('/*', function() {

					var self = this;
					var dir = F.path.public(self.url.substring(1));
					var filename = path.join(self.url, 'index.html').substring(1);

					F.path.exists(filename, function(e) {

						if (e)
							return self.file(filename, '');

						fs.readdir(dir, function(err, items) {

							var render = function(controller, directories, files) {
								controller.content('<!DOCTYPE html><html><head><title>Directory listing: {0}</title><meta charset="utf-8" /><style>body{font-family:Arial;font-size:16px;padding:10px 30px 30px}a{display:block}.directory:last-child{margin-bottom:10px}.directory{padding:2px 10px;background-color:#F8F8F8;margin-bottom:2px;text-decoration:none;color:black;font-weight:bold;font-size:18px}.directory-back{text-decoration:none;font-size:50px;margin:0 0 10px 5px;color:gray}.file{color:gray;text-decoration:none;font-size:14px;padding:3px 10px;border-bottom:1px solid #F0F0F0;}.file span{float:right;font-size:12px;margin:2px 0 0 0;color:#A0A0A0}.file:hover{background-color:#F8F8F8}</style></head><body><div class="directories">{1}</div><div class="files">{2}</div></body></html>'.format(controller.url, directories.join(''), files.join('')), 'text/html');
							};

							var directories = [];
							var files = [];

							if (self.url !== '/')
								directories.push('<a href=".." class="directory-back">..</a>');

							if (err)
								return render(self, directories, files);

							items.wait(function(item, next) {
								var filename = path.join(dir, item);
								fs.stat(filename, function(err, info) {

									if (info.isFile())
										files.push('<a href="{1}" class="file">{0}<span>{2}</span></a>'.format(item, self.url + item, info.size.filesize()));
									else
										directories.push('<a href="{1}/" class="directory">{0}</a>'.format(item, self.url + item));

									next();
								});
							}, () => render(self, directories, files));
						});

					});
				});

				F.route('/proxy/', function() {
					var self = this;
					var method = self.req.method;
					U.request(self.query.url, [self.req.method], method === 'POST' || method === 'PUT' || method === 'DELETE' ? self.body : null, (err, response, status, headers) => self.content(response, headers ? headers['content-type'] : 'text/plain'));
				}, ['get', 'post', 'put', 'delete'], 5120);

				return;
			}
		}

		if (!$type && (cmd === '-v' || cmd === '-version'))
			return;

		if (!$type && (cmd === '-t' || cmd === '-translate')) {
			$type = 4;
			continue;
		}

		if (!$type && cmd === '-merge') {
			merge(process.argv[i + 1] || '', process.argv[i + 2] || '');
			return;
		}

		if (!$type && (cmd === '-translate-csv' || cmd === '-translatecsv' || cmd === '-c')) {
			$type = 6;
			continue;
		}

		if (!$type && cmd === '-csv') {
			var tmp = process.argv[i + 1] || '';
			var tt = path.join(path.dirname(tmp), path.basename(tmp, '.csv') + '.resource');
			fs.writeFileSync(tt, '// Total.js resource file\n// Created: ' + new Date().format('yyyy-MM-dd HH:mm') + '\n' + parse_csv(fs.readFileSync(tmp).toString('utf8')));
			console.log('========================================');
			console.log('Parsed CSV:');
			console.log('========================================');
			console.log('');
			console.log('output   : ' + tt);
			console.log('');
			continue;
		}

		if (!$type && (cmd === '-i' || cmd === '-install')) {

			var libs = ['jc', 'jc.min', 'jcta', 'jcta.min', 'jctajr', 'jctajr.min', 'ta', 'jr', 'jr.jc', 'spa', 'spa.min'];
			var tmp = process.argv[i + 1] || '';

			if (tmp === 'help') {
				return console.log('Following libs can be installed: jc, jc.min, jcta.min, jctajr.min, ta, jr, jr.jc, spa');
			}

			if (!tmp || libs.indexOf(tmp) < 0)
				return console.log('Unknown library: "' + tmp + '"');

			console.log('');
			console.log('Installing: ' + tmp);

			var url = '';
			switch(tmp) {
				case 'jc':
					url = 'https://rawgit.com/totaljs/components/master/0dependencies/jc.js';
					break;
				case 'jc.min':
					url = 'https://rawgit.com/totaljs/components/master/0dependencies/jc.min.js';
					break;
				case 'jcta.min':
					url = 'https://rawgit.com/totaljs/components/master/0dependencies/jcta.min.js';
					break;
				case 'jctajr.min':
					url = 'https://rawgit.com/totaljs/components/master/0dependencies/jctajr.min.js';
					break;
				case 'spa':
				case 'spa.min':
					url = 'https://rawgit.com/totaljs/components/master/0dependencies/spa.min.js';
					break;
				case 'spa@14':
				case 'spa.min@14':
					url = 'https://rawgit.com/totaljs/components/master/0dependencies/spa.min@14.js';
					break;
				case 'spa@15':
				case 'spa.min@15':
					url = 'https://rawgit.com/totaljs/components/master/0dependencies/spa.min@15.js';
					break;
				case 'ta':
					url = 'https://rawgit.com/totaljs/Tangular/master/Tangular.js';
					break;
				case 'jr':
					url = 'https://rawgit.com/totaljs/jRouting/master/jrouting.js';
					break;
				case 'jr.jc':
					url = 'https://rawgit.com/totaljs/jRouting/master/jrouting.jcomponent.js';
					break;
			}

			U.download(url, [], function callback(err,response) {
				var target = fs.createWriteStream(path.join(dir, './' + tmp + '.js'));
				response.pipe(target);
				console.log('Done!');
			});
			return;
		}

		if (cmd === '-minify' || cmd === '-compress' || cmd === '-compile') {
			$type = 5;
			break;
		}

		if (!$type && (cmd === '-clean')) {
			var tmp = process.argv[i + 1] || '';
			var tt = path.join(path.dirname(tmp), path.basename(tmp, '.resource') + '-cleaned.txt');
			fs.writeFileSync(tt, '// Total.js cleaned file\n// Created: ' + new Date().format('yyyy-MM-dd HH:mm') + '\n' + clean_resource(fs.readFileSync(tmp).toString('utf8')));
			console.log('========================================');
			console.log('Cleaned result:');
			console.log('========================================');
			console.log('');
			console.log('output   : ' + tt);
			console.log('');
			return;
		}

		if (!$type && (cmd === '-cms' || cmd === 'cms')) {
			git(dir, 'cms');
			return;
		}

		if (!$type && (cmd === '-eshop' || cmd === 'eshop')) {
			git(dir, 'eshop');
			return;
		}

		if (!$type && (cmd === '-superadmin' || cmd === 'superadmin')) {
			git(dir, 'superadmin');
			return;
		}

		if (!$type && (cmd === '-messenger' || cmd === 'messenger')) {
			git(dir, 'messenger');
			return;
		}

		if (!$type && (cmd === '-helpdesk' || cmd === 'helpdesk')) {
			git(dir, 'helpdesk');
			return;
		}

		if (!$type && (cmd === '-openplatform' || cmd === 'openplatform')) {
			git(dir, 'openplatform');
			return;
		}

		if (!$type && (cmd === '-flow' || cmd === 'flow')) {
			git(dir, 'emptyproject-flow');
			return;
		}

		if (!$type && (cmd === '-dashboard' || cmd === 'dashboard')) {
			git(dir, 'emptyproject-dashboard');
			return;
		}

		if (!$type && (cmd === '-flowboard' || cmd === 'flowboard')) {
			git(dir, 'emptyproject-flowboard');
			return;
		}

		if (!$type && (cmd === '-bundle' || cmd === 'bundle')) {
			makebundle(dir, process.argv[i + 1] || '');
			return;
		}

		if (!$type && (cmd === '-package' || cmd === 'package')) {
			makepackage(dir, process.argv[i + 1] || '');
			return;
		}

		if (!$type && (cmd === '-pwa' || cmd === 'pwa')) {
			git(dir, 'emptyproject-pwa');
			return;
		}

		if (!$type && (cmd === '-spa' || cmd === 'spa')) {
			git(dir, 'emptyproject-jcomponent');
			return;
		}

		if (!$type && (cmd === '-rest' || cmd === 'rest')) {
			git(dir, 'emptyproject-restservice');
			return;
		}

		if (!$type && cmd === '-diff') {
			diff(process.argv[i + 1] || '', process.argv[i + 2] || '');
			return;
		}

		if (cmd === '-a' || cmd === '-angular' || cmd === 'angular') {
			$type = 3;
			continue;
		}

		if (!$type && (cmd === '-m' || cmd === '-minimal' || cmd === '-minimum' || cmd === 'minimum')) {
			$type = 2;
			continue;
		}

		if (!$type && (cmd === '-n' || cmd === '-normal' || cmd === 'normal')) {
			$type = 1;
			continue;
		}

		if (!$type && (cmd === '-h' || cmd === '-help' || cmd === '--help' || cmd === 'help')) {
			display_help();
			return;
		}

		dir = arg;
		isDirectory = true;
	}

	if (!$type)
		$type = 1;

	if (dir === '.')
		dir = process.cwd();

	if ($type === 5) {

		if (!fs.existsSync(dir)) {
			console.log('ERROR: file not found');
			console.log('');
			return;
		}

		var content = fs.readFileSync(dir).toString('utf8');
		var extension = U.getExtension(dir);
		var filename = dir.replace('.' + extension, '.min.' + extension);

		switch (extension.toLowerCase()) {
			case 'html':
				fs.writeFileSync(filename, Utils.minifyHTML(content));
				break;
			case 'js':
				fs.writeFileSync(filename, Utils.minifyScript(content));
				break;
			case 'css':
				fs.writeFileSync(filename, Utils.minifyStyle(content));
				break;
		}

		console.log('Minified: ' + filename);
		return;
	}

	if ($type !== 4) {
		if (!fs.existsSync(dir)) {
			console.log('ERROR: directory does not exist');
			console.log('');
			return;
		}
	}

	if ($type === 4) {

		if (isDirectory) {
			if (translateFile(dir))
				return;
			console.log('T' + dir.hash().padRight(17, ' ') + ': ' + dir);
			return;
		}

		console.log('Total.js: creating translation');
		Utils.ls(dir, function(files) {

			var resource = {};
			var texts = {};
			var max = 0;
			var count = 0;
			var key;
			var file;

			for (var i = 0, length = files.length; i < length; i++) {
				var filename = files[i];
				var ext = Utils.getExtension(filename);

				if (filename.indexOf('sitemap') === -1 && ext !== 'html' && ext !== 'js')
					continue;

				var content = fs.readFileSync(filename).toString('utf8');
				var command = Internal.findLocalization(content, 0);
				while (command !== null) {

					// Skip for direct reading
					if (command.command[0] === '#' && command.command[1] !== ' ') {
						command = Internal.findLocalization(content, command.end);
						continue;
					}

					key = 'T' + command.command.hash();
					file = filename.substring(dir.length + 1);

					texts[key] = command.command;

					if (resource[key]) {
						if (resource[key].indexOf(file) === -1)
							resource[key] += ', ' + file;
					} else
						resource[key] = file;

					count++;
					max = Math.max(max, key.length);
					command = Internal.findLocalization(content, command.end);
				}

				if (ext === 'js') {
					// ErrorBuilder
					var tmp = content.match(/\$\.invalid\('[a-z-0-9]+'\)/gi);
					if (tmp) {
						for (var j = 0; j < tmp.length; j++) {
							var m = (tmp[j] + '');
							m = m.substring(11, m.length - 2);
							key = m;
							file = filename.substring(dir.length + 1);
							texts[key] = m;
							if (resource[key]) {
								if (resource[key].indexOf(file) === -1)
									resource[key] += ', ' + file;
							} else
								resource[key] = file;
							count++;
							max = Math.max(max, key.length);
						}
					}

					// DBMS
					tmp = content.match(/\.(error|err)\('[a-z-0-9]+'/gi);
					if (tmp) {
						for (var j = 0; j < tmp.length; j++) {
							var m = (tmp[j] + '');
							m = m.substring(m.indexOf('(') + 2, m.length - 1);
							key = m;
							file = filename.substring(dir.length + 1);
							texts[key] = m;
							if (resource[key]) {
								if (resource[key].indexOf(file) === -1)
									resource[key] += ', ' + file;
							} else
								resource[key] = file;
							count++;
							max = Math.max(max, key.length);
						}
					}
				}
			}

			var keys = Object.keys(resource);
			var builder = [];
			var output = {};

			for (var i = 0, length = keys.length; i < length; i++) {
				if (!output[resource[keys[i]]])
					output[resource[keys[i]]] = [];
				output[resource[keys[i]]].push(keys[i].padRight(max + 5, ' ') + ': ' + texts[keys[i]]);
			}

			keys = Object.keys(output);
			for (var i = 0, length = keys.length; i < length; i++)
				builder.push('\n// ' + keys[i] + '\n' + output[keys[i]].join('\n'));

			fs.writeFileSync('translate.resource', '// Total.js translation file\n// Created: ' + new Date().format('yyyy-MM-dd HH:mm') + '\n' + builder.join('\n'));
			console.log('Total.js: the translation was created (' + count + ' texts)');
		}, (path, dir) => dir ? (path.endsWith('/node_modules') || path.endsWith('/tmp') || path.endsWith('/.git')) ? false : true : true);
		return;
	}

	if ($type === 6) {
		console.log('Total.js: creating translation to CSV');
		Utils.ls(dir, function(files) {

			var resource = {};
			var texts = {};
			var count = 0;
			var output = ['Hash;Text;Translation'];

			for (var i = 0, length = files.length; i < length; i++) {
				var filename = files[i];
				var ext = Utils.getExtension(filename);

				if (ext !== 'html' && ext !== 'js')
					continue;

				var content = fs.readFileSync(filename).toString('utf8');
				var command = Internal.findLocalization(content, 0);
				while (command !== null) {

					// Skip for direct reading
					if (command.command[0] === '#' && command.command[1] !== ' ') {
						command = Internal.findLocalization(content, command.end);
						continue;
					}

					var key = 'T' + command.command.hash();

					texts[key] = command.command;

					if (!resource[key]) {
						output.push(key + ';"' + command.command.replace(/"/g, '""') + '";');
						resource[key] = true;
						count++;
					}

					command = Internal.findLocalization(content, command.end);
				}
			}

			fs.writeFileSync('translate.csv', output.join('\n'));
			console.log('Total.js: the translation was created (' + count + ' texts)');
		}, (path, dir) => dir ? (path.endsWith('/node_modules') && path.endsWith('/tmp') && path.endsWith('/.git')) ? false : true : true);
		return;
	}

	var files = fs.readdirSync(dir);
	if (files.length > 0) {

		var can = true;
		for (var i = 0; i < files.length; i++) {
			var name = files[i];
			if (name[0] !== '.')
				can = false;
		}

		if (!can) {
			console.log('ERROR: directory is not empty');
			console.log('');
			return;
		}
	}

	git(dir, 'emptyproject');
}

function git(dir, type) {

	var done = function() {
		console.log('Installed: {0}'.format(type));
		console.log();
	};

	U.ls(dir, function(fol, fil) {

		if (fol.length || fil.length) {
			console.log('Directory "{0}"" is not empty.'.format(dir));
			console.log();
			return;
		}

		F.path.mkdir(dir);
		exec('git clone https://github.com/totaljs/{0}.git {1}'.format(type, dir), function() {
			F.path.mkdir(path.join(dir, '/node_modules/'));
			F.rmdir(path.join(dir, '.git'), function() {
				F.unlink(path.join(dir, '.gitignore'), function() {
					F.path.exists(path.join(dir, 'package.json'), function(e) {
						if (e)
							exec('npm install total.js --save', done);
						else
							exec('npm install', done);
					});
				});
			});
		});
	});
}

function makebundle(dir, filename) {

	if (!filename)
		filename = 'app.bundle';

	var blacklist = {};
	blacklist['/bundle.json'] = 1;
	blacklist['/debug.js'] = 1;
	blacklist['/release.js'] = 1;
	blacklist['/debug.pid'] = 1;
	blacklist['/package.json'] = 1;
	blacklist['/readme.md'] = 1;
	blacklist['/license.txt'] = 1;
	blacklist['/bundles/'] = 1;
	blacklist['/tmp/'] = 1;

	if (filename[0] !== '/')
		blacklist['/' + filename] = 1;
	else
		blacklist[filename] = 1;

	blacklist['/.git/'] = 1;

	if (filename.toLowerCase().lastIndexOf('.bundle') === -1)
		filename += '.bundle';

	blacklist[filename] = 1;

	console.log('--- CREATE BUNDLE PACKAGE --');
	console.log('');
	console.log('Directory    :', dir);
	console.log('Filename     :', filename);

	F.backup(filename, U.path(dir), function(err, path) {

		if (err)
			throw err;

		console.log('Success      :', path.files.pluralize('# files', '# file', '# files', '# files') + ' (' + path.size.filesize() + ')');
		console.log('');

	}, function(path) {
		return blacklist[path] == null;
	});
}

function makepackage(dir, filename) {

	if (!filename)
		filename = 'noname.package';

	var blacklist = {};
	blacklist['/bundle.json'] = 1;
	blacklist['/debug.js'] = 1;
	blacklist['/release.js'] = 1;
	blacklist['/debug.pid'] = 1;
	blacklist['/package.json'] = 1;
	blacklist['/readme.md'] = 1;
	blacklist['/license.txt'] = 1;
	blacklist['/bundles/'] = 1;
	blacklist['/tmp/'] = 1;

	if (filename[0] !== '/')
		blacklist['/' + filename] = 1;
	else
		blacklist[filename] = 1;

	blacklist['/.git/'] = 1;

	if (filename.toLowerCase().lastIndexOf('.package') === -1)
		filename += '.package';

	blacklist[filename] = 1;

	console.log('--- CREATE PACKAGE --');
	console.log('');
	console.log('Directory    :', dir);
	console.log('Filename     :', filename);

	F.backup(filename, U.path(dir), function(err, path) {

		if (err)
			throw err;

		console.log('Success      :', path.files.pluralize('# files', '# file', '# files', '# files') + ' (' + path.size.filesize() + ')');
		console.log('');

	}, function(path) {
		return blacklist[path] == null;
	});
}

main();