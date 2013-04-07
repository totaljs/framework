var assert = require('assert');
var builders = require('../lib/builders');

function test_PageBuilder () {

	var name = 'PageBuilder: ';
	var builder = new builders.PageBuilder(100, 1, 12);

	assert.ok(builder.isPrev === false, name + 'isPrev (1)');
	assert.ok(builder.isNext === true, name + 'isNext (1)');


	var output = builder.render(function(page, selected) {
		return page;
	});

	assert.ok(output.length === 9, name + 'render - no max');

	output = builder.render(function(page, selected) {
		return page;
	}, 6);

	assert.ok(output.length === 6, name + 'render - max 6');

	builder.refresh(100, 5, 12);
	
	assert.ok(builder.isPrev, name + 'isPrev (50)');
	assert.ok(builder.isNext, name + 'isNext (50)');

	output = builder.render(function(page, selected) {
		return page;
	}, 5);

	assert.ok(output.join('') === '34567', name + 'render - max 5');	
};

function test_UrlBuilder() {	
	var name = 'UrlBuilder: ';
	var builder = new builders.UrlBuilder();

	builder.add('A', '1');
	builder.add('B', '2');
	builder.add('C', ' 3 ');

	assert.ok(builder.read('C') === ' 3 ', name + 'read');

	builder.remove('B');
	assert.ok(builder.read('B') === null, name + 'remove');

	builder.add('A', '5');
	assert.ok(builder.read('A') === '5', name + 'update');

	assert.ok(builder.toString() === 'A=5&C=%203%20', name + 'toString()');
	builder.add('C', '3');
	
	assert.ok(builder.toOne(['A', 'B', 'C'], 'X') === '5XX3', name + 'toOne()');

	builder.clear();
	assert.ok(builder.read('A') === null, name + 'clear()');

	assert.ok(builder.hasValue(['A', 'B']) === false, name + 'hasValues(empty)');
	builder.add('A', '1');
	builder.add('B', '2');
	assert.ok(builder.hasValue(['A', 'B']) === true, name + 'hasValues()');
}

function test_Schema() {
	var name = 'Schema: ';
	builders.schema('tbl_user', { Id: Number, Name: String }, 'Id', false);
	assert.ok(builders.schema('tbl_user').Id instanceof Function, name + 'schema write & read');
	assert.ok(builders.primaryKey('tbl_user').name === 'Id', name + 'schema primary key');
	assert.ok(JSON.stringify(builders.defaults('tbl_user')) === '{"Name":null,"Id":0}', name + 'schema defaults');

	builders.schema('test', { Id: Number, Name: String, Male: Boolean, Dt: Date, Price: 'decimal' });
	
	var model = { Name: 23, Male: '1', Dt: 'ADASD', Price: 1.13 };
	var output = builders.prepare('test', model);

	name = 'Schema.prepare: ';
	assert.ok(output.Price === 1.13, name + 'decimal');
	assert.ok(output.Name === '23', name + 'string');
	assert.ok(output.Male, name + 'boolean = true');
	assert.ok(output.Dt === null, name + 'date (invalid)');

	model = { Dt: '2012-12-12', Male: false };
	output = builders.prepare('test', model);
	
	assert.ok(output.Dt.getDate() === 12 && output.Dt.getMonth() === 11 && output.Dt.getFullYear() === 2012, name + 'date');
	assert.ok(!output.Male, name + 'boolean = false');
};

function test_ErrorBuilder() {
	var name = 'ErrorBuilder: ';
	var builder = new builders.ErrorBuilder();

	builder.add('name');
	assert.ok(builder.builder[0].name === 'name' && builder.builder[0].error === '@', name + 'add');
	builder.add('age', 'only number');
	assert.ok(builder.builder[1].name === 'age' && builder.builder[1].error === 'only number', name + 'add (custom message)');

	builder.remove('age');
	assert.ok(typeof(builder.builder[1]) === 'undefined', name + 'remove');
	assert.ok(builder.hasError(), name + 'hasError');

	builder = new builders.ErrorBuilder(function(name) {
		return name;
	});

	builder.add('name');
	builder.prepare();
	assert.ok(builder.builder[0].error === 'name', name + 'prepare');

	builder.clear();
	builder.add('name');

	assert.ok(builder.json() === '[{"name":"name","error":"name"}]', name + 'json');

	builder.add(new builders.ErrorBuilder().add('age'));
	assert.ok(builder.json() === '[{"name":"name","error":"name"},{"name":"age","error":"age"}]', name + 'add(ErrorBuilder)');

	assert.ok(builder.read('name') === 'name', name + 'read()');
	assert.ok(builder.hasError('name'), name + 'hasError(name)');
};

test_PageBuilder();
test_UrlBuilder();
test_Schema();
test_ErrorBuilder();

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');