'use strict';

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var EXTENSION = '.fulltext';
var EXTENSION_CACHE = '.fulltext-cache';
var EXTENSION_TMP = '.fulltext-tmp';
var EXTENSION_DOCUMENT = '.json';
var NEWLINE = '\n';
var STRING = 'string';
var FUNCTION = 'function';
var UNDEFINED = 'undefined';
var BOOLEAN = 'boolean';
var ENCODING = 'utf8';

var REG_TAG = /(<([^>]+)>)/ig;

if (typeof(setImmediate) === UNDEFINED) {
	global.setImmediate = function(cb) {
		process.nextTick(cb);
	};
}

function Fulltext(name, directory, documents) {
	this.name = name;
	this.directory = directory;
	this.isReady = false;
	this.fs = new FulltextFile(name, directory, documents);
}

Fulltext.prototype.onAdd = function(id, keywords, document, callback) {
	var self = this;
	self.fs.add(id, keywords, document, callback);
};

Fulltext.prototype.onUpdate = function(id, keywords, document, callback) {
	var self = this;
	self.fs.update(id, keywords, document, callback);
};

Fulltext.prototype.onRemove = function(id, callback) {
	var self = this;
	self.fs.remove(id, callback);
};

Fulltext.prototype.onRead = function(id, callback) {
	var self = this;
	self.fs.read(id, callback);
};

Fulltext.prototype.onFind = function(search, options, callback) {
	var self = this;
	self.fs.find(search, options, callback);
};

Fulltext.prototype.add = function(content, document, callback, max) {
	var self = this;
	var id = new Date().getTime();

	self.onAdd(id, find_keywords(content.replace(REG_TAG, ' '), max), document, callback);
	clearInterval(self.interval);

	self.interval = setTimeout(function() {
		self.fs.cacheRemove();
	}, 3000);

	return id;
};

Fulltext.prototype.keywords = function(content, alternative, count, max, min) {
	return find_keywords(contet, alternative, count, max, min);
};

Fulltext.prototype.read = function(id, callback) {
	var self = this;
	self.onRead(id, callback);
	return self;
};

Fulltext.prototype.update = function(id, content, document, callback) {
	var self = this;
	self.onUpdate(id, keywords, document, callback);
	return self;
};

Fulltext.prototype.remove = function(id, callback) {
	var self = this;
	self.onRemove(id, callback);
	return self;
};

Fulltext.prototype.find = function(search, options, callback) {
	var self = this;
	self.onFind(search, options, callback);
	return self;
};

function FulltextFile(name, directory, documents) {
	this.directory = directory;
	this.documents = documents;
	this.filename = path.join(directory, name + EXTENSION);
	this.filenameCache = path.join(directory, name + EXTENSION_CACHE);
	this.status = 0;
	this.pendingWrite = [];
	this.pendingRead = [];
}

FulltextFile.prototype.add = function(id, keywords, document, callback) {
	var self = this;
	fs.appendFile(self.filename, id + ',' + keywords.join(',') + '\n');
	fs.appendFile(path.join(self.documents, id + EXTENSION_DOCUMENT), JSON.stringify(document));
};

FulltextFile.prototype.update = function(id, keywords, document, callback) {

	var self = this;

	if (!self.canWrite()) {
		self.pendingWrite.push(function() { this.update(id, keywords, document, callback); });
		return self;
	}

	var temporary = path.join(self.directory, self.name + EXTENSION_TMP);
	var reader = fs.createReadStream(self.filename);
	var writer = fs.createWriteStream(temporary);

	reader._buffer = '';

	reader.on('data', function(buffer) {

		var buf = buffer.toString(ENCODING);
		reader._buffer += buf;

		var index = buf.indexOf(NEWLINE);

		while (index !== -1) {
			var line = reader._buffer.substring(0, index);
			var current = line.substring(0, line.indexOf(','));

			if (current === id) {
				var filename = path.join(self.documents, id);
				if (keywords !== null) {
					writer.write(id + ',' + keywords.join(',') + NEWLINE);
					fs.writeFile(filename, JSON.stringify(document));
				}
				else
					fs.unlink(filename, noop);
			} else
				writer.write(line + NEWLINE);

			reader._buffer = reader._buffer.substring(index + 1);
			index = reader._buffer.indexOf('\n');
		}

	});

	writer.on('close', function() {
		fs.rename(temporary, self.filename, function(err) {
			self.done();
			if (callback)
				callback();
		});
	});

	reader.on('end', function() {
		self.done();
		writer.end();
	});

	reader.resume();
	return self;
};

FulltextFile.prototype.remove = function(id, callback) {
	var self = this;
	self.update(id, null, null, callback);
	return self;
};

FulltextFile.prototype.read = function(id, callback) {

	var self = this;
	var filename = path.join(self.documents, id + EXTENSION_DOCUMENT);

	fs.readFile(filename, function(err, data) {

		if (err) {
			callback(err, null);
			return;
		}

		callback(null, JSON.parse(data.toString(ENCODING)));
	});

	return self;
};

FulltextFile.prototype.readall = function(id, count, callback) {

	var self = this;
	var output = [];

	var fn = function() {

		var first = id.shift();

		if (first === '') {
			fn();
			return;
		}

		if (typeof(first) === UNDEFINED) {
			callback(count, output);
			return;
		}

		self.read(first, function(err, json) {
			output.push({ id : first, document: json });
			setImmediate(fn);
		});
	};

	fn();
};

FulltextFile.prototype.cacheAdd = function(search, options, arr) {
	var self = this;
	var hash = crypto.createHash('md5');

	hash.update(search + JSON.stringify(options), ENCODING);
	var id = hash.digest('hex');

	fs.appendFile(self.filenameCache, id + '=' + arr.length + ',' + arr.join(',') + '\n');

	return self;
};

FulltextFile.prototype.cacheRemove = function() {
	var self = this;
	fs.unlink(self.filenameCache, noop);
	return self;
};

FulltextFile.prototype.cacheRead = function(search, options, callback, skip, take) {
	var self = this;
	var hash = crypto.createHash('md5');

	hash.update(search + JSON.stringify(options), ENCODING);
	var id = hash.digest('hex');

	var stream = fs.createReadStream(self.filenameCache);
	var stop = false;

	stream._buffer = '';

	stream.on('data', function(buffer) {

		if (stop)
			return;

		var buf = buffer.toString(ENCODING);
		stream._buffer += buf;

		var index = buf.indexOf(NEWLINE);

		while (index !== -1) {

			var line = stream._buffer.substring(0, index);
			var beg = line.indexOf('=');

			if (line.substring(0, beg) === id) {

				var sum = parseInt(line.substring(beg + 1, line.indexOf(',')));
				self.readall(skipcomma(line.substring(beg + 1), skip || 0, take || 50).split(','), sum, callback);
				stream._buffer = null;
				stream.resume();
				stream = null;
				stop = true;
				break;

			}

			stream._buffer = stream._buffer.substring(index + 1);
			index = stream._buffer.indexOf('\n');
		}

	});

	stream.on('end', function() {
		if (!stop)
			callback(0, null);
	});

	stream.on('error', function() {
		callback(0, null);
	});

	stream.resume();
};

// options.alternate = true | false;
// options.strict = true | false;
// options.skip = 0;
// options.take = 50;
FulltextFile.prototype.find = function(search, options, callback) {

	var self = this;

	if (!self.canRead()) {
		self.pendingRead.push(function() { this.find(search, options, callback); });
		return self;
	}

	options = options || {};

	var take = options.take || 10;
	var skip = options.skip || 0;

	if (typeof(options.strict) === UNDEFINED)
		options.strict = true;

	if (options.take)
		delete options.take;

	if (options.skip)
		delete options.skip;

	search = search.trim().replace(/\t|\n/g, ' ');

	self.cacheRead(search, options, function(count, arr) {

		if (arr !== null) {
			callback(count, arr);
			return;
		}

		arr = [];
		var keywords = find_keywords(search, options.alternate);
		var length = keywords.length;
		var count = 0;
		var rating = {};
		var sumarize = 0;

		self.each(function(line) {

			var index = line.indexOf(',');
			var id = line.substring(0, index);
			var all = line.substring(index + 1);
			var isFinded = true;
			var sum = 0;
			var counter = 1;
			var ln = line.length;

			for (var i = 0; i < length; i++) {
				var keyword = keywords[i];
				var indexer = all.indexOf(keyword);

				if (indexer === -1) {
					counter++;
					sum += ln;
					if (options.strict) {
						isFinded = false;
						break;
					}
				} else
					sum += indexer;
			}

			if (isFinded) {
				sumarize++;
				rating[id] = sum * counter;
				arr.push(id);
				count++;
			}

			return true;

		}, function() {

			self.done();

			if (arr.length === 0) {
				self.cacheAdd(search, options, []);
				callback([]);
				return;
			}

			arr.sort(function(a, b) {
				var ra = rating[a];
				var rb = rating[b];
				if (ra > rb)
					return 1;
				if (ra < rb)
					return -1;
				return 0;
			});

			self.cacheAdd(search, options, arr);
			self.readall(arr.slice(skip, skip + take), arr.length, callback);

		});

	}, skip, take);

	return self;
};

FulltextFile.prototype.each = function(map, callback) {

	var self = this;
	var stream = fs.createReadStream(self.filename);
	var arr = [];
	var stop = false;

	stream._buffer = '';

	stream.on('data', function(buffer) {

		if (stop)
			return;

		var buf = buffer.toString(ENCODING);
		stream._buffer += buf;

		var index = buf.indexOf(NEWLINE);

		while (index !== -1) {

			stop = !map(stream._buffer.substring(0, index));

			if (stop) {
				stream.resume();
				stream = null;
				break;
			}

			stream._buffer = stream._buffer.substring(index + 1);
			index = stream._buffer.indexOf('\n');
		}

	});

	stream.on('error', function() {
		callback();
	});

	stream.on('end', callback);
	stream.resume();

	return self;
};

FulltextFile.prototype.canRead = function(fn) {
	return this.pendingWrite.length === 0;
};

FulltextFile.prototype.canWrite = function() {
	return this.pendingWrite.length === 0;
};

FulltextFile.prototype.done = function () {

	var self = this;

	if (self.pendingWrite.length > 0) {
		self.pendingWrite.shift();
		return;
	}

	if (self.pendingRead.length > 0) {
		self.pendingRead.shift();
		return;
	}

	return self;
};

function noop() {}

function skipcomma(str, skip, take) {

	var index = -1;
	var counter = -1;
	var length = str.length;
	var beg = length;
	var end = 0;

	take += skip;

	do {

		index = str.indexOf(',', index + 1);
		counter++;

		if (counter === skip) {

			if (index === -1)
				break;

			beg = index + 1;
			continue;
		}

		if (counter === take) {
			end = index;
			break;
		}

	}
	while (index !== -1);

	if (end < 1)
		end = length;

	if (beg >= length)
		return '';

	return str.substring(beg, end);
}

function find_keywords(content, alternative, count, max, min) {

	min = min || 2;
	count = count || 200;
	max = max || 20;

	var words = content.removeDiacritics().toLowerCase().replace(/y/g, 'i').match(/\w+/g);

	if (words === null)
		words = [];

	var length = words.length;
	var dic = {};
	var counter = 0;

	for (var i = 0; i < length; i++) {
		var word = words[i].trim();

		if (word.length < min)
			continue;

		if (counter >= count)
			break;

		word = word.toLowerCase().removeDiacritics().replace(/\W|_/g, '').replace(/y/g, 'i');

		if (alternative)
			word = word.substring(0, (word.length / 100) * 80);

		if (word.length < min || word.length > max)
			continue;

		if (typeof(dic[word]) === UNDEFINED)
			dic[word] = 1;
		else
			dic[word]++;

		counter++;
	}

	var keys = Object.keys(dic);

	keys.sort(function(a, b) {

		var countA = dic[a];
		var countB = dic[b];

		if (countA > countB)
			return -1;

		if (countA < countB)
			return 1;

		return 0;
	});

	return keys;
}

exports.Fulltext = Fulltext;
exports.keywords = find_keywords;

exports.load = function(name, directory, documents) {
	return new Fulltext(name, directory, documents);
};

exports.init = function(name, directory, documents) {
	return new Fulltext(name, directory, documents);
};