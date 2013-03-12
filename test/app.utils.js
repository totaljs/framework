var assert = require('assert');
var utils = require('../lib/utils');

// test: number prototype
function prototypeNumber() {
	var format = '';
	assert.ok((10000).format(2) === '10 000.00', 'format number with decimal parameter');

	format = '### ### ###.###';
	assert.ok((10000).format(format) === '10 000.000', 'format number: ' + format);

	format = '###,###,###.###';
	assert.ok((10000).format(format) === '10,000.000', 'format number: ' + format);

	format = '#########.###';
	assert.ok((10000).format(format) === '10000.000', 'format number: ' + format);

	format = '###';
	assert.ok((10000).format(format) === '10000', 'format number: ' + format);

	var number = 10.103435;
	assert.ok(number.floor(2) === 10.10, 'floor number: 2 decimals');
	assert.ok(number.floor(4) === 10.1034, 'floor number: 4 decimals');
	assert.ok(number.floor(0) === 10, 'floor number: 0 decimals');
	assert.ok(number.hex() === 'A.1A7AB75643028', 'number to hex');
};

// test: string prototype
function prototypeString() {	
	var str = ' partial.js    ';
	assert.ok(str.trim() === 'partial.js', 'string.trim()');	
	assert.ok(str.contains(['p', 'X']), 'string.contains(all=false)');
	assert.ok(str.contains(['p', 'X'], true) === false, 'string.contains(all=true)');
	assert.ok('{0}={1}'.format('name', 'value') === 'name=value', 'string.format()');
	assert.ok('<b>partial.js</b>'.htmlEncode() === '&lt;b&gt;partial.js&lt;/b&gt;', 'string.htmlEncode()');
	assert.ok('&lt;b&gt;partial.js&lt;/b&gt;'.htmlDecode() === '<b>partial.js</b>', 'string.htmlDecode()');

	str = 'abcdefgh ijklmnop';
	assert.ok(str.maxLength(5, '---') === 'ab---', 'string.maxLength(5, "---")');
	assert.ok(str.maxLength(5) === 'ab...', 'string.maxLength(5)');

	assert.ok(str.isJSON() === false, 'string.isJSON()');
	assert.ok('[]'.isJSON() === true, 'string.isJSON([])');
	assert.ok('{}'.isJSON() === true, 'string.isJSON({})');
	assert.ok('"'.isJSON() === false, 'string.isJSON(")');
	assert.ok('""'.isJSON() === true, 'string.isJSON("")');
	assert.ok('12'.isJSON() === false, 'string.isJSON(12)');
	assert.ok('[}'.isJSON() === false, 'string.isJSON([})');
	assert.ok('["'.isJSON() === false, 'string.isJSON([")');

	str = 'www.google.sk';
	assert.ok(str.isURL() === true, 'string.isURL(): ' + str);
	
	str = 'google.sk';
	assert.ok(str.isURL() === false, 'string.isURL(): ' + str);

	str = 'google';
	assert.ok(str.isURL() === false, 'string.isURL(): ' + str);
	
	str = 'http://google.com';
	assert.ok(str.isURL() === true, 'string.isURL(): ' + str);

	str = 'https://mail.google.com';
	assert.ok(str.isURL() === true, 'string.isURL(): ' + str);

	str = 'petersirka@gmail.com';
	assert.ok(str.isEmail() === true, 'string.isEmail(): ' + str);

	str = 'petersirka@gmail';
	assert.ok(str.isEmail() === false, 'string.isEmail(): ' + str);

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

	str = '';
	assert.ok(str.parseInt() === 0, 'string.parseInt(): ' + str);

	str = '255.50';
	assert.ok(str.parseFloat() === 255.50, 'string.parseFloat(): ' + str);

	str = '  255,50  ';
	assert.ok(str.parseFloat() === 255.50, 'string.parseFloat(): ' + str);

	str = '  ,50  ';
	assert.ok(str.parseFloat() === 0.50, 'string.parseFloat(): ' + str);

	str = '.50';
	assert.ok(str.parseFloat() === 0.50, 'string.parseFloat(): ' + str);

	str = '.';
	assert.ok(str.parseFloat() === 0, 'string.parseFloat(): ' + str);

	str = '123456'
	assert.ok(str.toSHA1() === '7c4a8d09ca3762af61e59520943dc26494f8941b', 'string.toSHA1(): ' + str);
	assert.ok(str.toMD5() === 'e10adc3949ba59abbe56e057f20f883e', 'string.toMD5(): ' + str);

	var value = str.encode('key', false);
	assert.ok(value.decode('key') === str, 'string.encode() & string.decode() = unique=false: ' + str);

	value = str.encode('key', true);
	assert.ok(value.decode('key') === str, 'string.encode() & string.decode() = unique=true: ' + str);

	str = 'data:image/gif;base64,R0lGODdhAQABAIAAAF5eXgAAACwAAAAAAQABAAACAkQBADs=';
	assert.ok(str.base64ContentType() === 'image/gif', 'string.base64ContentType(): ' + str);

	str = 'ľščťŽýÁíéäôúá';
	assert.ok(str.removeDiacritics() === 'lsctZyAieaoua', 'string.removeDiacritics(): ' + str);

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
	assert.ok(str.padLeft(10) === '0000012345', 'string.padLeft(10): ' + str);
	assert.ok(str.padLeft(5) === '12345', 'string.padLeft(10): ' + str);
	assert.ok(str.padLeft(10, '-') === '-----12345', 'string.padLeft(10, "-"): ' + str);
	assert.ok(str.padRight(10) === '1234500000', 'string.padRight(10): ' + str);
	assert.ok(str.padRight(5) === '12345', 'string.padRight(10): ' + str);
	assert.ok(str.padRight(10, '-') === '12345-----', 'string.padRight(10, "-"): ' + str);

	str = 'Date: {now | dd.MM.yyyy HH:mm:ss}. Currency: {number | ###,###,###.##} and encoded: {name} and raw: {!name}';	
	assert.ok(str.params({now: new Date(), number: 23034.34, name: '<b>Peter</b>'}).length === 106, 'string.params(): ' + str);

	str = 'Peter Širka Linker & - you known';
	assert.ok(str.link() === 'peter-sirka-linker-you-known', 'string.link(): ' + str);
	assert.ok(str.link(11) === 'peter-sirka', 'string.link(): ' + str);
};

function prototypeArray() {

	var arr = [
		{ name: '1', value: 10 },
		{ name: '2', value: 20 },
		{ name: '3', value: 30 },
		{ name: '4', value: 40 },
		{ name: '5', value: 50 }
	];

	assert.ok(arr.find(function(o) { return o.name === '4'; }).value === 40, 'array.find()');
	assert.ok(arr.find(function(o) { return o.name === '6'; }) === null, 'array.find(): null');

	arr = arr.remove(function(o) {
		return o.value > 30;
	});

	assert.ok(arr.length === 3, 'array.remove()');

	arr = [1, 2, 3, 4, 5];
	assert.ok(arr.skip(3).join('') === '45', 'array.skip()');
	assert.ok(arr.take(3).join('') === '123', 'array.take()');
};

function others() {
	var obj = {};

	utils.extend(obj, { name: 'Peter', age: 25 });
	assert.ok(obj.name === 'Peter' && obj.age === 25, 'utils.extend()');

	utils.reduce(obj, ['name']);
	assert.ok(typeof(obj.age) === 'undefined', 'utils.reduce()');

	var str = 'http://www.google.sk';
	assert.ok(utils.isRelative(str) === false, 'utils.isRelative(): ' + str);
	
	str = '/img/logo.jpg'
	assert.ok(utils.isRelative(str) === true, 'utils.isRelative(): ' + str);

	assert.ok(utils.isStaticFile(str) === true, 'utils.isStaticFile(): ' + str);

	str = '/logo/';
	assert.ok(utils.isStaticFile(str) === false, 'utils.isStaticFile(): ' + str);

	str = null;
	assert.ok(utils.isNullOrEmpty(str) === true, 'utils.isNullOrEmpty(): null');

	str = '';
	assert.ok(utils.isNullOrEmpty(str) === true, 'utils.isNullOrEmpty(): ' + str);

	str = 'gif';
	assert.ok(utils.getContentType(str) === 'image/gif', 'utils.getContentType(): ' + str);

	str = '.jpg';
	assert.ok(utils.getContentType(str) === 'image/jpeg', 'utils.getContentType(): ' + str);

	str = '.xFx';
	assert.ok(utils.getContentType(str) === 'application/octet-stream', 'utils.getContentType(): ' + str);

	str = 'logo.jpg';
	assert.ok(utils.Etag(str) === '800', 'utils.Etag(): ' + str);

	str = 'logo.jpg?=1';
	assert.ok(utils.Etag(str) === '973', 'utils.Etag(): ' + str);

	str = 'logo.jpg?=2';
	assert.ok(utils.Etag(str) === '974', 'utils.Etag(): ' + str);

	str = '/logo';
	assert.ok(utils.path(str) === '/logo/', 'utils.path(): ' + str);

	str = '/logo/';
	assert.ok(utils.path(str) === '/logo/', 'utils.path(): ' + str);

	assert.ok(utils.GUID(40).length === 40, 'utils.GUID(40)');
	assert.ok(utils.combine('1', '2', 'logo.jpg') === '.1/2/logo.jpg', 'utils.combine()');

	var async = new utils.Async();
	var value = [];

	async.wait(function() {
		value.push(1);
		async.next();
	});

	async.wait(function() {
		value.push(2);
		async.skip();
	});

	async.wait(function() {
		value.push(3);
		async.next();
	});

	async.wait(function() {
		value.push(4);
		async.next();
	});

	async.wait(function() {
		value.push(5);
		async.skip(2);
	});

	async.wait(function() {
		value.push(6);
		async.next();
	});

	async.wait(function() {
		value.push(7);
		async.next();
	});	

	async.wait(function() {
		value.push(8);
		async.next();
	});

	async.complete(function() {
		assert.ok(value.length === 5, 'async');
	});

	utils.request('http://www.yahoo.com', 'GET', null, function(err, data, code) {
		assert.ok(code === 200, 'utils.request (success)');
	});

	utils.request('http://xxxxxxx.yyy', 'GET', null, function(err, data, code) {
		assert.ok(err !== null, 'utils.requiest (error)');
	});

	var resource = function(name) {
		return 'resource-' + name;
	};

	var error = utils.validation({}, ['firstName', 'lastName', 'age'], onValidation, resource);

	assert.ok(error.hasError(), 'validation - hasError()');

	error.prepare();

	assert.ok(error.builder[0].name === 'firstName' || error.builder[0].error === 'resource-firstName', 'validation - return boolean');
	assert.ok(error.builder[1].name === 'lastName' || error.builder[1].error === 'lastName-error', 'validation - return string');
	assert.ok(error.builder[2].name === 'age' || error.builder[2].error === 'age-error', 'validation - return utils.isValid()');

	error.clear();
	assert.ok(!error.hasError(), 'validation - clear() & hasError()');
};

function onValidation(name, value) {
	switch (name) {
		case 'firstName':
			return value.length > 0;
		case 'lastName':
			return 'lastName-error';
		case 'age':
			return utils.isValid(utils.parseInt(value) > 0, 'age-error')
	}
};

prototypeNumber();
prototypeString();
prototypeArray();
others();

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');
