require('../index');
global.builders = require('../builders');

var assert = require('assert');
var utils = require('../utils');

// test: date prototype
function prototypeDate() {

	var dt = new Date(1404723152167);
	assert.ok(dt.toString() === 'Mon Jul 07 2014 10:52:32 GMT+0200 (CEST)', 'date problem');
	assert.ok(dt.format() === '2014-07-07T10:52:32.167Z', 'date format(0) problem');
	assert.ok(dt.add('minute', 5).toString() === 'Mon Jul 07 2014 10:57:32 GMT+0200 (CEST)', 'date add');
	assert.ok(dt.format('MMM') === 'Jul', 'month name 1');
	assert.ok(dt.format('MMMM') === 'July', 'month name 2');
	assert.ok(dt.format('MMM', 'sk') === 'Júl', 'localized month name 1');
	assert.ok(dt.format('MMMM', 'sk') === 'Júl', 'localized month name 2');

	dt = new Date();
	dt = dt.add('minute', 1);
	dt = dt.add('seconds', 5);

	assert.ok('1 minute 5 seconds'.parseDateExpiration().format('mm:ss') === dt.format('mm:ss'), 'date expiration');

	dt = '2010-01-01 12:05:10'.parseDate();
	assert.ok('Fri, 01 Jan 2010 11:05:10 GMT' === dt.toUTCString(), 'date parsing 1');

	dt = '2010-01-02'.parseDate();
	assert.ok('Fri, 01 Jan 2010 23:00:00 GMT' === dt.toUTCString(), 'date parsing 2');

	dt = '2100-01-01'.parseDate();
	assert.ok(dt.compare(new Date()) === 1, 'date compare (earlier)');
	assert.ok(dt.compare('2101-01-01'.parseDate()) === -1, 'date compare (later)');
	assert.ok(dt.compare(dt) === 0, 'date compare (same)');
	assert.ok(Date.compare(dt, dt) === 0, 'date compare (same, static)');

	dt = '12:00:00'.parseDate();
	assert.ok(dt.compare(dt) === 0, 'time compare (same)');
}

// test: number prototype
function prototypeNumber() {
	assert.ok((10000).format(2) === '10 000.00', 'format number with decimal parameter');
	assert.ok((10000).format(3) === '10 000.000', 'format/decimal: A');
	assert.ok((10000).format(3, ',', '.') === '10,000.000', 'format/decimal: B');
	assert.ok((10000).format() === '10 000', 'format/decimal: C');
	var number = 10.103435;
	assert.ok(number.floor(2) === 10.10, 'floor number: 2 decimals');
	assert.ok(number.floor(4) === 10.1034, 'floor number: 4 decimals');
	assert.ok(number.floor(0) === 10, 'floor number: 0 decimals');
	assert.ok(number.hex() === 'A.1A7AB75643028', 'number to hex');
	assert.ok(number.add('10%', 0) === 1, 'add number: 1');
	assert.ok(number.add('+10%', 0) === 11, 'add number: 2');
	assert.ok(number.add('-10%', 0) === 9, 'add number: 3');
	assert.ok(number.add('*2', 0) === 20, 'add number: 4');
	assert.ok(number.add('*10%', 0) === 10, 'add number: 5');

	number = 1024;
	assert.ok(number.filesize() === '1 KB', 'filesize decimals: auto');
	assert.ok(number.filesize('MB') === '0 MB', 'filesize decimals: MB');
	assert.ok(number.filesize('GB') === '0 GB', 'filesize decimals: GB');
	assert.ok(number.filesize('TB') === '0 TB', 'filesize decimals: TB');

	number = 1248576;
	assert.ok(number.filesize() === '1.19 MB', 'filesize decimals: auto');
	assert.ok(number.filesize('MB') === '1.19 MB', 'filesize decimals: MB');
	assert.ok(number.filesize('TB') === '0 TB', 'filesize decimals: TB');
	assert.ok(number.filesize('KB') === '1 219.31 KB', 'filesize decimals: KB');

	var num = 5;
	var count = 0;

	num.async(function(index, next) {
		count += index;
		setTimeout(next, 100);
	}, function() {
		assert.ok(count === 15, 'Number.async() problem');
	});

}

// test: string prototype
function prototypeString() {
	var str = ' total.js    ';
	assert.ok(str.trim() === 'total.js', 'string.trim()');
	assert.ok(str.contains(['t', 'X']), 'string.contains(all=false)');
	assert.ok(str.contains(['t', 'X'], true) === false, 'string.contains(all=true)');
	assert.ok('{0}={1}'.format('name', 'value') === 'name=value', 'string.format()');
	assert.ok('<b>total.js</b>"&nbsp;'.encode() === '&lt;b&gt;total.js&lt;/b&gt;&quot;&amp;nbsp;', 'string.encode()');
	assert.ok('&lt;b&gt;total.js&lt;/b&gt;&amp;nbsp;'.decode() === '<b>total.js</b>&nbsp;', 'string.decode()');
	assert.ok(str.trim().replaceAt(5, ';') === 'total;js', 'string.replaceAt()');

	str = ' A PeTer Širka   Je krááály. ';

	assert.ok(str.toSearch() === 'a peter sirka je krali', 'string.toSearch()');

	str = 'Great function.';

	assert.ok(str.startsWith('Great'), 'string.startsWith()');
	assert.ok(str.startsWith('GrEAT', true), 'string.startsWith(ignoreCase)');
	assert.ok(str.startsWith('asdljkaslkdj aslkdjalsdjlasdjlkasdjlasjdlaj') === false, 'string.startsWith() - large string');

	assert.ok(str.endsWith('ion.'), 'string.endsWith()');
	assert.ok(str.endsWith('ION.', true), 'string.endsWith(ignoreCase)');
	assert.ok(str.endsWith('asdljkaslkdj aslkdjalsdjlasdjlkasdjlasjdlaj') === false, 'string.endsWith() - large string');

	str = 'abcdefgh ijklmnop';
	assert.ok(str.max(5, '---') === 'ab---', 'string.maxLength(5, "---")');
	assert.ok(str.max(5) === 'ab...', 'string.maxLength(5)');

	assert.ok(str.isJSON() === false, 'string.isJSON()');
	assert.ok('[]'.isJSON() === true, 'string.isJSON([])');
	assert.ok('{}'.isJSON() === true, 'string.isJSON({})');
	assert.ok('    {}     '.isJSON() === true, 'string.isJSON({})');
	assert.ok('"'.isJSON() === false, 'string.isJSON(")');
	assert.ok('""'.isJSON() === true, 'string.isJSON("")');
	assert.ok('12'.isJSON() === true, 'string.isJSON(12)');
	assert.ok('[}'.isJSON() === false, 'string.isJSON([})');
	assert.ok('['.isJSON() === false, 'string.isJSON([")');
	assert.ok(str.isJSON() === false, 'string.isJSON()');
	assert.ok(JSON.parse(JSON.stringify(new Date())).isJSONDate(), 'string.isJSONDate()');

	var dt = new Date();
	var ts = dt.getTime();

	assert.ok(JSON.stringify({ date: dt }).parseJSON(true).date.getTime() === ts, 'string.parseJSON(true) - problem with Date parsing');

	str = 'google.sk';
	assert.ok(str.isURL() === false, 'string.isURL(): ' + str);

	str = 'google';
	assert.ok(str.isURL() === false, 'string.isURL(): ' + str);

	str = 'http://www.google.com';
	assert.ok(str.isURL() === true, 'string.isURL(): ' + str);

	str = 'http://127.0.0.1:8000';
	assert.ok(str.isURL() === true, 'string.isURL(): ' + str);

	str = 'https://mail.google.com';
	assert.ok(str.isURL() === true, 'string.isURL(): ' + str);

	str = 'http://w';
	assert.ok(str.isURL() === false, 'string.isURL(): ' + str);

	str = 'petersirka@gmail.com';
	assert.ok(str.isEmail() === true, 'string.isEmail(): ' + str);

	str = 'petersirka@gmail';
	assert.ok(str.isEmail() === false, 'string.isEmail(): ' + str);

	str = 'anything@addons.business';
	assert.ok(str.isEmail() === true, 'string.isEmail(): ' + str);

	str = 'a@a.a';
	assert.ok(str.isEmail() === false, 'string.isEmail(): ' + str);

	str = '255';
	assert.ok(str.parseInt() === 255, 'string.parseInt(): ' + str);

	str = '-255';
	assert.ok(str.parseInt() === -255, 'string.parseInt(): ' + str);

	str = '   255  ';
	assert.ok(str.parseInt() === 255, 'string.parseInt(): ' + str);

	str = '   a  ';
	assert.ok(str.parseInt() === 0, 'string.parseInt(): ' + str);

	str = '   a  ';
	assert.ok(str.parseInt(-1) === -1, 'string.parseInt(): ' + str + ' / default');

	str = '';
	assert.ok(str.parseInt() === 0, 'string.parseInt(): ' + str);

	str = 'Abc 334';
	assert.ok(str.parseInt2() === 334, 'string.parseInt2(): ' + str);

	str = 'Abc 334.33';
	assert.ok(str.parseFloat2() === 334.33, 'string.parseFloat2(): ' + str);

	str = '';
	assert.ok(str.parseInt2() === 0, 'string.parseInt2(): ' + str);

	str = '';
	assert.ok(str.parseFloat2() === 0, 'string.parseFloat2(): ' + str);

	str = '255.50';
	assert.ok(str.parseFloat() === 255.5, 'string.parseFloat(): ' + str);

	str = '  255,50  ';
	assert.ok(str.parseFloat() === 255.5, 'string.parseFloat(): ' + str);

	str = '  ,50  ';
	assert.ok(str.parseFloat() === 0.50, 'string.parseFloat(): ' + str);

	str = '.50';
	assert.ok(str.parseFloat() === 0.50, 'string.parseFloat(): ' + str);

	str = '.';
	assert.ok(str.parseFloat() === 0, 'string.parseFloat(): ' + str);

	str = '123456';
	assert.ok(str.sha1() === '7c4a8d09ca3762af61e59520943dc26494f8941b', 'string.sha1(): ' + str);
	assert.ok(str.sha256() === '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'string.sha256(): ' + str);
	assert.ok(str.md5() === 'e10adc3949ba59abbe56e057f20f883e', 'string.md5(): ' + str);
	assert.ok(str.sha512() === 'ba3253876aed6bc22d4a6ff53d8406c6ad864195ed144ab5c87621b6c233b548baeae6956df346ec8c17f5ea10f35ee3cbc514797ed7ddd3145464e2a0bab413', 'string.sha512(): ' + str);

	var value = str.encrypt('key', false);
	assert.ok(value.decrypt('key') === str, 'string.encode() & string.decode() = unique=false: ' + str);

	value = str.encrypt('key', true);
	assert.ok(value.decrypt('key') === str, 'string.encode() & string.decode() = unique=true: ' + str);

	str = 'data:image/gif;base64,R0lGODdhAQABAIAAAF5eXgAAACwAAAAAAQABAAACAkQBADs=';
	assert.ok(str.base64ContentType() === 'image/gif', 'string.base64ContentType(): ' + str);

	str = 'ľščťŽýÁíéäôúáűő';
	assert.ok(str.removeDiacritics() === 'lsctZyAieaouauo', 'string.removeDiacritics(): ' + str);

	str ='<xml>';
	assert.ok(str.indent(4) === '    <xml>', 'string.indent(4): ' + str);
	assert.ok(str.indent(4, '-') === '----<xml>', 'string.indent(4, "-"): ' + str);

	str = '12';
	assert.ok(str.isNumber() === true, 'string.isNumber(): ' + str);
	str = '13a';
	assert.ok(str.isNumber() === false, 'string.isNumber(): ' + str);
	str = '13 ';
	assert.ok(str.isNumber() === false, 'string.isNumber(): ' + str);
	str = '13.34';
	assert.ok(str.isNumber(true) === true, 'string.isNumber(true): ' + str);
	str = '13,34';
	assert.ok(str.isNumber(true) === true, 'string.isNumber(true): ' + str);

	str = '12345';
	assert.ok(str.padLeft(10) === '     12345', 'string.padLeft(10): ' + str);
	assert.ok(str.padLeft(5) === '12345', 'string.padLeft(10): ' + str);
	assert.ok(str.padLeft(10, '-') === '-----12345', 'string.padLeft(10, "-"): ' + str);
	assert.ok(str.padRight(10) === '12345     ', 'string.padRight(10): ' + str);
	assert.ok(str.padRight(5) === '12345', 'string.padRight(10): ' + str);
	assert.ok(str.padRight(10, '-') === '12345-----', 'string.padRight(10, "-"): ' + str);

	var num = 12345;
	assert.ok(num.padLeft(10) === '0000012345', 'number.padLeft(10): ' + num);
	assert.ok(num.padRight(10) === '1234500000', 'number.padRight(10): ' + num);

	str = 'Peter Širka Linker & - you known';
	assert.ok(str.linker() === 'peter-sirka-linker-you-known', 'string.link(): ' + str);
	assert.ok(str.linker(11) === 'peter-sirka', 'string.link(): ' + str);
	assert.ok(str.slug() === 'peter-sirka-linker-you-known', 'string.slug(): ' + str);
	assert.ok(str.slug(11) === 'peter-sirka', 'string.slug(): ' + str);

	assert.ok('total Js'.capitalize() === 'Total Js', 'string.capitalize()');
	assert.ok('totaljs'.isAlphaNumeric(), 'string.isAlphaNumeric(true)');
	assert.ok('total js'.isAlphaNumeric() === false, 'string.isAlphaNumeric(false)');

	str = '// Configuration\nname   : total.js\nage    : 29\n// comment1    : comment1\n# comment2     : comment2\ndebug  : false';
	assert.ok(JSON.stringify(str.parseConfig({ comment3: 'comment3' })) === '{"comment3":"comment3","name":"total.js","age":"29","debug":"false"}', 'String.parseConfig()');

	assert.ok('á'.localeCompare2('a') === 1, 'localeCompare2 - 1');
	assert.ok('á'.localeCompare2('b') === -1, 'localeCompare2 - 2');
	assert.ok('č'.localeCompare2('b') === 1, 'localeCompare2 - 3');
}

function prototypeArray() {

	var arr = [
		{ name: '1', value: 10 },
		{ name: '2', value: 20 },
		{ name: '3', value: 30 },
		{ name: '4', value: 40 },
		{ name: '5', value: 50 }
	];

	var obj = arr.toObject('name');

	assert.ok(obj['3'].value === 30, 'array.toObject(with name)');

	assert.ok(arr.findItem(function(o) { return o.name === '4'; }).value === 40, 'array.find()');
	assert.ok(arr.findItem(function(o) { return o.name === '6'; }) === null, 'array.find(): null');
	assert.ok(arr.findItem('name', '4').value === 40, 'array.find(inline)');
	assert.ok(arr.findItem('name', '6') === null, 'array.find(inline): null');

	arr = arr.remove(function(o) {
		return o.value > 30;
	});

	assert.ok(arr.length === 3, 'array.remove()');
	arr = arr.remove('value', 30);
	assert.ok(arr.length === 2, 'array.remove(inline)');

	arr = [1, 2, 3, 4, 5];
	obj = arr.toObject();
	assert.ok(obj[3] === true, 'array.toObject(without name)');
	assert.ok(arr.skip(3).join('') === '45', 'array.skip()');
	assert.ok(arr.take(3).join('') === '123', 'array.take()');

	assert.ok(arr.orderBy(false)[0] === 5, 'array.orderBy()');

	arr = [{}, {}, {}];
	assert.ok(arr.extend({ $index: 1 })[0].$index === 1, 'array.extend(obj)');

	var c = arr.extend(function(item, index) {
		item.$index = index;
		return item;
	});

	assert.ok(c[0].$index === 0, 'array.extend(function)');

	var counter = arr.length;

	arr.wait(function(item, next) {
		counter--;
		next();
	}, function() {
		assert.ok(counter === 0 && counter !== arr.length, 'array.wait(remove = false)');

		arr.wait(function(item, next) {
			next();
		}, function() {
			assert.ok(arr.length === 0, 'array.wait(remove = true)');
		}, true);

	});

	arr = [1, 2, 3, 4, 5, 6];
	arr.limit(3, function(item, next, beg, end) {
		if (beg === 0 && end === 3)
			assert.ok(item.join(',') === '1,2,3', 'arrray.limit(0-3)');
		else if (beg === 3 && end === 6)
			assert.ok(item.join(',') === '4,5,6', 'arrray.limit(3-6)');
		next();
	});

	var arr1 = [{ id: 1, name: 'Peter', age: 25 }, { id: 2, name: 'Lucia', age: 19 }, { id: 3, name: 'Jozef', age: 33 }, { id: 10, name: 'New', age: 39 }];
	var arr2 = [{ id: 2, age: 5, name: 'Lucka' }, { id: 3, name: 'Peter', age: 50 }, { id: 1, name: 'Peter', age: 25 }, { id: 5, name: 'New', age: 33 }];

	arr1.compare('id', arr2, function(a, b, ai, bi) {

		if (!b)
			assert.ok(a.age === 39, 'array.compare(0)');

		if (!a)
			assert.ok(b.age === 33, 'array.compare(1)');
	});

	arr = [1, 2, 3, 1, 3, 2, 4];

	assert.ok(arr.unique().join(',') === '1,2,3,4', 'array.unique(2)');

	var b = [{ name: 'Peter' }, { name: 'Janko' }, { name: 'Peter' }, { name: 'Lucia' }, { name: 'Lucia' }, { name: 'Peter' }];
	assert.ok(JSON.stringify(b.unique('name')) === '[{"name":"Peter"},{"name":"Janko"},{"name":"Lucia"}]', 'array.unique(property)');

	var asyncarr = [];
	var asyncounter = 0;

	asyncarr.push(function(next) {
		asyncounter++;
		next();
	});

	asyncarr.push(function(next) {
		asyncounter++;
		next();
	});

	asyncarr.async(function() {
		assert.ok(asyncounter === 2, 'array.async(classic)');
	});
}

function other() {
	var obj = {};

	assert.ok(utils.isEmpty({}), 'utils.isEmpty() - is empty');
	assert.ok(!utils.isEmpty({ a: 1 }), 'utils.isEmpty() - not empty');

	assert.ok(JSON.stringify(utils.extend({ id: 1 })) === '{"id":1}', 'utils.extend() - undefined');

	var anonymous = { name: 'Peter', age: 25, arr: [1, 2, 3] };
	assert.ok(!obj.name, 'utils.copy(2)');
	assert.ok(utils.copy({ name: 'Janko' }).name === 'Janko', 'utils.copy(1)');

	utils.extend(obj, anonymous);
	obj.arr.push(4);
	assert.ok(obj.arr.length !== anonymous.length, 'utils.copy(2)');
	assert.ok(obj.name === 'Peter' && obj.age === 25, 'utils.extend()');

	utils.copy({ name: 'A', age: -1 }, obj);
	assert.ok(obj.name === 'A' && obj.age === -1, 'utils.copy(rewrite=true)');

	var a = utils.reduce(obj, ['name']);
	var b = utils.reduce(obj, ['name'], true);

	assert.ok(typeof(a.age) === 'undefined', 'utils.reduce()');
	assert.ok(typeof(b.age) === 'number', 'utils.reduce() - reverse');

	assert.ok(utils.reduce([{ name: 'Peter', age: 27 }, { name: 'Lucia', age: 22 }], ['name'])[0].age === undefined, 'utils.reduce() - array');
	assert.ok(utils.reduce([{ name: 'Peter', age: 27 }, { name: 'Lucia', age: 22 }], ['name'], true)[0].name === undefined, 'utils.reduce() - array reverse');

	var str = 'http://www.google.sk';
	assert.ok(utils.isRelative(str) === false, 'utils.isRelative(): ' + str);

	str = '/img/logo.jpg';
	assert.ok(utils.isRelative(str) === true, 'utils.isRelative(): ' + str);

	assert.ok(utils.isStaticFile(str) === true, 'utils.isStaticFile(): ' + str);

	str = '/logo/';
	assert.ok(utils.isStaticFile(str) === false, 'utils.isStaticFile(): ' + str);

	str = 'gif';
	assert.ok(utils.getContentType(str) === 'image/gif', 'utils.getContentType(): ' + str);

	str = '.jpg';
	assert.ok(utils.getContentType(str) === 'image/jpeg', 'utils.getContentType(): ' + str);

	str = '.xFx';
	assert.ok(utils.getContentType(str) === 'application/octet-stream', 'utils.getContentType(): ' + str);

	str = '/logo';
	assert.ok(utils.path(str) === '/logo/', 'utils.path(): ' + str);

	str = '/logo/';
	assert.ok(utils.path(str) === '/logo/', 'utils.path(): ' + str);

	assert.ok(utils.GUID(40).length === 40, 'utils.GUID(40)');

	assert.ok(utils.encode('<b>total.js</b>"&nbsp;') === '&lt;b&gt;total.js&lt;/b&gt;&quot;&amp;nbsp;', 'utils.encode()');
	assert.ok(utils.decode('&lt;b&gt;total.js&lt;/b&gt;&amp;nbsp;') === '<b>total.js</b>&nbsp;', 'utils.decode()');

	var result = utils.parseXML('<div><b>Peter&amp;Janko</b><i style="color:red">Ita&apos;lic</i></div>');

	assert.ok(result['div.b'] === 'Peter&Janko', 'XML Parser 1');
	assert.ok(result['div.i'] === 'Ita\'lic', 'XML Parser 2');
	assert.ok(result['div.i[]'].style === 'color:red', 'XML Parser Attributes');

	result = utils.parseXML('<xml>OK</xml>');

	obj = { a: '  1  ', b: { a: '    2 '}, c: [' 1 ', '2', [' 3', ' 5  ']]};
	utils.trim(obj);
	assert.ok(JSON.stringify(obj) === '{"a":"1","b":{"a":"2"},"c":["1","2",["3","5"]]}', 'utils.trim()');

	var async = new utils.Async();
	var value = [];

	async.on('error', function(err, name) {
		console.log('ERROR', err, name);
	});

	async.await('0', function(next) {
		value.push(9);
		next();
	});

	async.wait('1', '0', function(next) {
		value.push(1);
		next();
	});

	async.wait('2', '1', function(next) {
		setTimeout(function() {
			value.push(2);
			next();
		}, 2000);
	});

	async.wait('3', '2', function(next) {
		value.push(3);
		next();
	});

	async.wait('4', '5', function(next) {
		value.push(4);
		next();
	});

	async.wait('5', '3', function(next) {
		value.push(5);
		next();
	});

	async.wait('6', '5', function(next) {
		value.push(6);
		next();
	});

	async.wait('7', '6', function(next) {
		value.push(7);
		next();
	});

	async.wait('8', '7', function(next) {
		value.push(8);
		next();
	});

	async.await(function(next) {
		next();
	});

	async.await(function(next) {
		next();
	});

	async.complete(function() {

		value.sort(function(a, b) {
			if (a > b)
				return 1;
			else
				return -1;
		});

		assert.ok(value.join(',') === '1,2,3,4,5,6,7,8,9', 'async');
	});

	utils.request('http://www.totaljs.com', ['get', 'dnscache'], function(err, data, code) {
		assert.ok(code === 200, 'utils.request (success)');
	}).on('data', function(chunk, p) {
		assert.ok(p === 0, 'utils.request (events)');
	});

	utils.request('https://www.totaljs.com', ['get'], function(err, data, code) {
		assert.ok(code === 200, 'utils.request (success)');
	}).on('data', function(chunk, p) {
		assert.ok(p === 0, 'utils.request (events)');
	});

	utils.download('http://www.totaljs.com/img/logo.png', ['get'], function(err, res) {
		assert.ok(res.statusCode === 200, 'utils.download (success)');
	}).on('data', function(chunk, p) {
		assert.ok(p === 100, 'utils.download (events)');
	});

	utils.request('http://xxxxxxx.yyy', ['get'], null, function(err, data, code) {
		assert.ok(err !== null, 'utils.request (error)');
	});

	assert.ok(utils.getName('/aaa/bbb/ccc/dddd') === 'dddd', 'problem with getName (1)');
	assert.ok(utils.getName('\\aaa\\bbb\\ccc\\dddd') === 'dddd', 'problem with getName (2)');
	assert.ok(utils.getName('/aaa/bbb/ccc/dddd/') === 'dddd', 'problem with getName (3)');
	assert.ok(utils.getName('\\aaa\\bbb\\ccc\\dddd\\') === 'dddd', 'problem with getName (4)');

	var indexer = 0;

	utils.wait(function() {
		return indexer++ === 3;
	}, function(err) {
		assert(err === null, 'utils.wait()');
	});

	utils.wait(NOOP, function(err) {
		assert(err !== null, 'utils.wait() - timeout');
	}, 1000);

	var queue = 0;

	utils.queue('file', 2, function(next) {
		setTimeout(function() {
			queue++;
			next();
		}, 300);
	});

	utils.queue('file', 2, function(next) {
		setTimeout(function() {
			queue--;
			next();
		}, 300);
	});

	utils.queue('file', 2, function(next) {
		setTimeout(function() {
			assert.ok(queue === 0, 'utils.queue()');
			next();
		}, 300);
	});

	var a = { a: 1, b: 2, name: 'Peter', isActive: true, dt: new Date() };
	var b = { a: 1, b: 2, name: 'Peter', isActive: true, dt: new Date() };

	assert.ok(utils.isEqual(a, b), 'utils.isEqual(1)');

	b.isActive = false;
	assert.ok(utils.isEqual(a, b) === false, 'utils.isEqual(2)');

	b.name = 'Lucia';
	assert.ok(utils.isEqual(a, b, ['a', 'b']), 'utils.isEqual(3)');
	assert.ok(utils.minifyScript('var a = 1 ;') === 'var a=1;', 'JavaScript minifier');
	assert.ok(utils.minifyStyle('body { margin: 0 0 0 5px }') === 'body{margin:0 0 0 5px}', 'Style minifier');
	assert.ok(utils.minifyHTML('<b>\nTEST\n</b>') === '<b>TEST</b>', 'HTML minifier');

	var streamer = utils.streamer('\n', function(value, index) {
		assert.ok(value.trim() === index.toString(), 'Streamer problem');
	});

	streamer(Buffer.from('0'));
	streamer(Buffer.from('\n1\n2\n'));
	streamer(Buffer.from('3\n'));
	streamer(Buffer.from('4\n'));

	streamer = utils.streamer('<a>', '</a>', function(value, index) {
		assert.ok(value.trim() === '<a>' + (index + 1) + '</a>', 'Streamer problem 2');
	});

	streamer(Buffer.from('aaaa <a>1</a> adsklasdlajsdlas jd <a>2</a>'));
	streamer(Buffer.from('aaaa <a>3</a> adsklasdlajsdlas jd <a>4</a>'));

	var a = { buf: Buffer.from('123456') };
	assert.ok(U.clone(a).buf !== a, 'Cloning buffers');

}

prototypeDate();
prototypeNumber();
prototypeString();
prototypeArray();
other();
//harmony();

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');

process.on('uncaughtException', function(err) {
	console.error(err);
	process.exit(1);
});