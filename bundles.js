// Copyright 2012-2020 (c) Peter Širka <petersirka@gmail.com>
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

/**
 * @module FrameworkBundles
 * @version 3.4.3
 */

require('./index');

const Fs = require('fs');
const Path = require('path');
const CONSOLE = process.argv.indexOf('restart') === -1;
const INTERNAL = { '/sitemap': 1, '/versions': 1, '/workflows': 1, '/dependencies': 1, '/config': 1, '/config-release': 1, '/config-debug': 1 };
const isWindows = require('os').platform().substring(0, 3).toLowerCase() === 'win';
const REGAPPEND = /\/--[a-z0-9]+/i;
const REGAPPENDREPLACE = /\/--/g;
const REGBK = /(-|_)bk\.bundle$/i;
const META = {};

META.version = 1;
META.created = new Date();
META.total = 'v' + F.version_header;
META.node = F.version_node;
META.files = [];
META.skip = false;
META.directories = [];
META.ignore = () => true;

exports.make = function(callback) {

	var path = F.path.root();
	var blacklist = {};

	if (CONSOLE) {
		console.log('--------------------- BUNDLING ---------------------');
		console.time('Done');
	}

	var isignore = false;

	try {
		META.ignore = makeignore(Fs.readFileSync(Path.join(path, '.bundleignore')).toString('utf8').split('\n'));
		isignore = true;
	} catch (e) {}

	if (!isignore) {
		try {
			META.ignore = makeignore(Fs.readFileSync(Path.join(path, '.bundlesignore')).toString('utf8').split('\n'));
		} catch (e) {}
	}

	blacklist[CONF.directory_temp] = 1;
	blacklist[CONF.directory_bundles] = 1;
	blacklist[CONF.directory_src] = 1;
	blacklist[CONF.directory_logs] = 1;
	blacklist['/node_modules/'] = 1;
	blacklist['/debug.pid'] = 1;
	blacklist['/package-lock.json'] = 1;

	var Files = [];
	var Dirs = [];
	var Merge = [];
	var Length = path.length;
	var async = [];

	async.push(cleanFiles);

	async.push(function(next) {
		META.skip && (async.length = 0);
		next();
	});

	async.push(function(next) {
		var target = F.path.root(CONF.directory_src);
		U.ls(F.path.root(CONF.directory_bundles), function(files) {
			var dirs = {};
			files.wait(function(filename, resume) {

				if (!filename.endsWith('.bundle') || REGBK.test(filename))
					return resume();

				if (CONSOLE)
					console.log('-----', U.getName(filename));

				var dbpath = CONF.directory_databases;
				var pathupdate = CONF.directory_updates;
				var pathstartup = '/startup';

				F.restore(filename, target, resume, function(p, dir) {

					if (dir) {
						if (!p.startsWith(dbpath) && META.directories.indexOf(p) === -1)
							META.directories.push(p);
					} else {

						var dirname = p.substring(0, p.length - U.getName(p).length);
						if (dirname && dirname !== '/')
							dirs[dirname] = true;

						// handle files in bundle to merge
						var mergeme = 0;

						if (REGAPPEND.test(p)) {
							mergeme = 3;
							p = p.replace(REGAPPENDREPLACE, '/');
						}

						var exists = false;
						try {
							exists = Fs.statSync(Path.join(target, p)) != null;
						} catch (e) {}

						if ((dirname === pathupdate || dirname === pathstartup) && !exists) {
							try {
								exists = Fs.statSync(Path.join(target, p + '_bk')) != null;
							} catch (e) {}
						}

						// A specific file like DB file or startup file or update script
						if (exists && (p.startsWith(dbpath) || p.startsWith(pathupdate) || p.startsWith(pathstartup)))
							return false;

						if (INTERNAL[p] || U.getExtension(p) === 'resource' || mergeme) {
							var hash = p.hash(true).toString(16);
							Merge.push({ name: p, filename: Path.join(target, p + hash), type: mergeme });
							META.files.push(p + hash);
							return p + hash;
						}

						if (META.files.indexOf(p) === -1)
							META.files.push(p);
					}

					return true;
				});
			}, function() {
				dirs = Object.keys(dirs);
				dirs.length && Dirs.push.apply(Dirs, dirs);
				next();
			});
		});
	});

	async.push(function(next) {
		if (Merge.length) {
			copyFiles(Merge, function() {
				for (var i = 0; i < Merge.length; i++) {
					try {
						Fs.unlinkSync(Merge[i].filename);
					} catch(e) {}
				}
				next();
			});
		} else
			next();
	});

	async.push(function(next) {
		U.ls(path, function(files, dirs) {

			for (var i = 0, length = dirs.length; i < length; i++)
				Dirs.push(normalize(dirs[i].substring(Length)));

			for (var i = 0, length = files.length; i < length; i++) {
				var file = files[i].substring(Length);
				var type = 0;

				if (file.startsWith(CONF.directory_databases) || file.startsWith('/flow/') || file.startsWith('/dashboard/'))
					type = 1;
				else if (REGAPPEND.test(file)) {
					file = file.replace(REGAPPENDREPLACE, '/');
					type = 3;
				} else if (file.startsWith(CONF.directory_public))
					type = 2;

				Files.push({ name: file, filename: files[i], type: type });
			}

			next();
		}, function(p) {
			p = normalize(p.substring(Length));
			return blacklist[p] == null && p.substring(0, 2) !== '/.';
		});
	});

	async.push(function(next) {
		createDirectories(Dirs, function() {
			copyFiles(Files, next);
		});
	});

	async.push(function(next) {
		Fs.writeFileSync(Path.join(F.path.root(CONF.directory_src), 'bundle.json'), JSON.stringify(META, null, '\t'));
		next();
	});

	async.async(function() {
		CONSOLE && console.timeEnd('Done');
		callback();
	});

};

function makeignore(arr) {

	var ext;
	var code = ['var path=P.substring(0,P.lastIndexOf(\'/\')+1);', 'var ext=U.getExtension(P);', 'var name=U.getName(P).replace(\'.\'+ ext,\'\');'];

	for (var i = 0; i < arr.length; i++) {
		var item = arr[i];
		var index = item.lastIndexOf('*.');

		if (index !== -1) {
			// only extensions on this path
			ext = item.substring(index + 2);
			item = item.substring(0, index);
			code.push('tmp=\'{0}\';'.format(item));
			code.push('if((!tmp||path===tmp)&&ext===\'{0}\')return;'.format(ext));
			continue;
		}

		ext = U.getExtension(item);
		if (ext) {
			// only filename
			index = item.lastIndexOf('/');
			code.push('tmp=\'{0}\';'.format(item.substring(0, index + 1)));
			code.push('if(path===tmp&&U.getName(\'{0}\').replace(\'.{1}\', \'\')===name&&ext===\'{1}\')return;'.format(item.substring(index + 1), ext));
			continue;
		}

		// all nested path
		code.push('if(path.startsWith(\'{0}\'))return;'.format(item.replace('*', '')));
	}

	code.push('return true');
	return new Function('P', code.join(''));
}

function normalize(path) {
	return isWindows ? path.replace(/\\/g, '/') : path;
}

function cleanFiles(callback) {

	var path = F.path.root(CONF.directory_src);
	var length = path.length - 1;
	var blacklist = {};

	blacklist[CONF.directory_public] = 1;
	blacklist[CONF.directory_private] = 1;
	blacklist[CONF.directory_databases] = 1;

	var meta;

	try {
		meta = U.parseJSON(Fs.readFileSync(Path.join(path, 'bundle.json')).toString('utf8'), true) || {};

		if (CONF.bundling === 'shallow') {
			META.skip = true;
			callback();
			return;
		}

	} catch (e) {
		meta = {};
	}

	if (meta.files && meta.files.length) {
		for (var i = 0, length = meta.files.length; i < length; i++) {
			var filename = meta.files[i];
			var dir = filename.substring(0, filename.indexOf('/', 1) + 1);
			if (!blacklist[dir]) {
				try {
					F.consoledebug('Remove', filename);
					Fs.unlinkSync(Path.join(path, filename));
				} catch (e) {}
			}
		}
	}

	if (meta.directories && meta.directories.length) {
		meta.directories.quicksort('length', false);
		for (var i = 0, length = meta.directories.length; i < length; i++) {
			try {
				if (!blacklist[meta.directories[i]])
					Fs.rmdirSync(Path.join(path, meta.directories[i]));
			} catch (e) {}
		}
	}

	callback();
}

function createDirectories(dirs, callback) {

	var path = F.path.root(CONF.directory_src);

	try {
		Fs.mkdirSync(path);
	} catch(e) {}

	for (var i = 0, length = dirs.length; i < length; i++) {
		var p = normalize(dirs[i]);
		if (META.directories.indexOf(p) === -1)
			META.directories.push(p);
		try {
			Fs.mkdirSync(Path.join(path, dirs[i]));
		} catch (e) {}
	}

	callback();
}

function copyFiles(files, callback) {
	var path = F.path.root(CONF.directory_src);
	files.wait(function(file, next) {

		if (!META.ignore(file.name))
			return next();

		var filename = Path.join(path, file.name);
		var exists = false;
		var ext = U.getExtension(file.name);
		var append = file.type === 3;

		try {
			exists = Fs.statSync(filename) != null;
		} catch (e) {}

		// DB file
		if (file.type === 1 && exists) {
			next();
			return;
		}

		var p = normalize(file.name);

		if (file.type !== 1 && META.files.indexOf(p) === -1)
			META.files.push(p);

		if (exists && (ext === 'resource' || (!ext && file.name.substring(1, 7) === 'config') || INTERNAL[file.name]))
			append = true;

		if (CONSOLE && exists) {
			CONF.allow_debug && F.consoledebug(append ? 'EXT:' : 'REW:', p);
		} else
			F.consoledebug(append ? 'EXT:' : 'COP:', p);

		if (append) {
			Fs.appendFile(filename, '\n' + Fs.readFileSync(file.filename).toString('utf8'), next);
		} else
			copyFile(file.filename, filename, next);

		if (CONSOLE && exists)
			CONF.allow_debug && F.consoledebug('REW:', p);
		else
			F.consoledebug('COP:', p);

	}, callback);
}

function copyFile(oldname, newname, callback) {
	var writer = Fs.createWriteStream(newname);
	writer.on('finish', callback);
	Fs.createReadStream(oldname).pipe(writer);
}
