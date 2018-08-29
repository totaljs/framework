require('./index');

const Fs = require('fs');
const Path = require('path');
const CONSOLE = process.argv.indexOf('restart') === -1;
const META = {};
const INTERNAL = { '/sitemap': 1, '/versions': 1, '/workflows': 1, '/dependencies': 1, '/config': 1, '/config-release': 1, '/config-debug': 1 };
const isWindows = require('os').platform().substring(0, 3).toLowerCase() === 'win';
const REGAPPEND = /\/--[a-z0-9]+/i;

META.version = 1;
META.created = new Date();
META.total = 'v' + F.version_header;
META.node = F.version_node;
META.files = [];
META.directories = [];
META.ignore = () => true;

exports.make = function(callback) {

	var path = F.path.root();
	var blacklist = {};

	if (CONSOLE) {
		console.log('--------------------- BUNDLING ---------------------');
		console.time('Done');
	}

	try {
		META.ignore = makeignore(Fs.readFileSync(Path.join(path, '.bundlesignore')).toString('utf8').split('\n'));
	} catch (e) {}

	blacklist[F.config['directory-temp']] = 1;
	blacklist[F.config['directory-bundles']] = 1;
	blacklist[F.config['directory-src']] = 1;
	blacklist['/node_modules/'] = 1;
	// blacklist['/debug.js'] = 1;
	blacklist['/debug.pid'] = 1;
	//blacklist['/package.json'] = 1;
	blacklist['/package-lock.json'] = 1;

	var Files = [];
	var Dirs = [];
	var Merge = [];
	var Length = path.length;
	var async = [];

	async.push(cleanFiles);

	async.push(function(next) {
		var target = F.path.root(F.config['directory-src']);
		U.ls(F.path.root(F.config['directory-bundles']), function(files) {
			var dirs = {};
			files.wait(function(filename, resume) {
				var dbpath = F.config['directory-databases'];

				F.restore(filename, target, resume, function(p, dir) {

					if (dir) {
						if (!p.startsWith(dbpath) && META.directories.indexOf(p) === -1)
							META.directories.push(p);
					} else {

						var dirname = p.substring(0, p.length - U.getName(p).length);
						if (dirname && dirname !== '/')
							dirs[dirname] = true;

						var exists = false;
						try {
							exists = Fs.statSync(Path.join(target, p)) != null;
						} catch (e) {}

						// DB file
						if (exists && p.startsWith(dbpath))
							return false;

						if (INTERNAL[p] || U.getExtension(p) === 'resource') {
							var hash = Math.random().toString(16).substring(5);
							Merge.push({ name: p, filename: Path.join(target, p + hash) });
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
				for (var i = 0, length = Merge.length; i < length; i++) {
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
				if (file.startsWith(F.config['directory-databases']))
					type = 1;
				else if (file.startsWith(F.config['directory-public']))
					type = 2;
				else if (REGAPPEND.test(file)) {
					file = file.replace(/\/--/g, '/');
					type = 3;
				}

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
		Fs.writeFileSync(Path.join(F.path.root(F.config['directory-src']), 'bundle.json'), JSON.stringify(META, null, '\t'));
		next();
	});

	async.async(function() {
		CONSOLE && console.timeEnd('Done');
		callback();
	});

};

function makeignore(arr) {

	var ext;
	var code = ['var path=P.substring(0,P.lastIndexOf(\'/\') + 1);', 'var ext=U.getExtension(P);', 'var name=U.getName(P).replace(\'.\' + ext, \'\');'];

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

	var path = F.path.root(F.config['directory-src']);
	var length = path.length - 1;
	var blacklist = {};

	blacklist[F.config['directory-public']] = 1;
	blacklist[F.config['directory-private']] = 1;
	blacklist[F.config['directory-databases']] = 1;

	var meta;

	try {
		meta = U.parseJSON(Fs.readFileSync(Path.join(path, 'bundle.json')).toString('utf8'), true) || {};
	} catch (e) {
		meta = {};
	}

	if (meta.files && meta.files.length) {
		for (var i = 0, length = meta.files.length; i < length; i++) {
			var filename = meta.files[i];
			try {
				F.consoledebug('Remove', filename);
				Fs.unlinkSync(Path.join(path, filename));
			} catch (e) {}
		}
	}

	if (meta.directories && meta.directories.length) {
		meta.directories.quicksort('length', false);
		for (var i = 0, length = meta.directories.length; i < length; i++) {
			try {
				Fs.rmdirSync(Path.join(path, meta.directories[i]));
			} catch (e) {}
		}
	}

	callback();
}

function createDirectories(dirs, callback) {

	var path = F.path.root(F.config['directory-src']);

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
	var path = F.path.root(F.config['directory-src']);
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
			F.config['allow-debug'] && F.consoledebug(append ? 'EXT: ' : 'REW:', p);
		} else
			F.consoledebug(append ? 'EXT:' :   'COP:', p);

		if (append) {
			Fs.appendFile(filename, '\n' + Fs.readFileSync(file.filename).toString('utf8'), next);
		} else
			copyFile(file.filename, filename, next);

		if (CONSOLE && exists)
			F.config['allow-debug'] && F.consoledebug('REW:', p);
		else
			F.consoledebug('COP:', p);

	}, callback);
}

function copyFile(oldname, newname, callback) {
	var writer = Fs.createWriteStream(newname);
	writer.on('finish', callback);
	Fs.createReadStream(oldname).pipe(writer);
}