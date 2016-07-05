require('../index');
global.utils = require('../utils');

var assert = require('assert');
global.builders = require('../builders');

var countW = 0;
var countS = 0;

function test_PageBuilder() {

	var name = 'Pagination: ';

	builders.Pagination.addTransform('custom', function(argument1) {
		assert.ok(argument1 === 1, name + 'addTransform(argument1)');
		return this.count;
	});

	var builder = new builders.Pagination(100, 1, 12);

	assert.ok(builder.isPrev === false, name + 'isPrev (1)');
	assert.ok(builder.isNext === true, name + 'isNext (1)');
	assert.ok(builder.isFirst === true, name + 'isFirst (1)');
	assert.ok(builder.isLast === false, name + 'isLast (1)');
	assert.ok(builder.nextPage === 2, name + 'nextPage (1)');
	assert.ok(builder.prevPage === 1, name + 'prevPage (1)');
	assert.ok(builder.lastPage === 9, name + 'lastPage (1)');
	assert.ok(builder.last().page === 9, name + 'last(1)');

	var output = builder.render();

	output = builder.render(6);
	builder.refresh(100, 5, 12);

	assert.ok(builder.isPrev, name + 'isPrev (2)');
	assert.ok(builder.isNext, name + 'isNext (2)');
	assert.ok(builder.isFirst === false, name + 'isFirst (2)');
	assert.ok(builder.isLast === false, name + 'isLast (2)');
	assert.ok(builder.nextPage === 6, name + 'nextPage (2)');
	assert.ok(builder.prevPage === 4, name + 'prevPage (2)');
	assert.ok(builder.lastPage === 9, name + 'lastPage (2)');
	assert.ok(builder.last().page === 9, name + 'last(2)');

	output = builder.render(5);
	assert.ok(output[2].selected, name + 'render - max 5 (selected page problem)');
	assert.ok(output[4].url === '?page=7', name + 'render - max 5 (url format)');

	builder.refresh(1, 1, 12);
	assert.ok(builder.isFirst === true, name + 'isFirst (3)');
	assert.ok(builder.isLast === true, name + 'isLast (3)');
	assert.ok(builder.nextPage === 1, name + 'nextPage (3)');
	assert.ok(builder.prevPage === 1, name + 'prevPage (3)');
	assert.ok(builder.lastPage === 1, name + 'lastPage (3)');

	builder.refresh(10, 1, 5);
	assert.ok(builder.isFirst === true, name + 'isFirst (4)');
	assert.ok(builder.isLast === false, name + 'isLast (4)');
	assert.ok(builder.transform('custom', 1) === 2, name + 'transform()');
	assert.ok(builder.nextPage === 2, name + 'nextPage (4)');
	assert.ok(builder.prevPage === 1, name + 'prevPage (4)');
	assert.ok(builder.lastPage === 2, name + 'lastPage (4)');

	builders.Pagination.setDefaultTransform('custom');

	var builder = new builders.Pagination(100, 1, 10);
	assert.ok(builder.render(1) === 10, name + 'default transform()');
}

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

	assert.ok(builder.hasValue(['A', 'B']) === false, name + 'hasValue(empty)');
	builder.add('A', '1');
	builder.add('B', '2');
	assert.ok(builder.hasValue(['A', 'B']) === true, name + 'hasValue()');
}

function test_Schema() {
	var name = 'Schema: ';

	builders.schema('tbl_user', {
		Id: Number,
		Name: String,
		date: Date
	}, function(name) {
		if (name === 'date')
			return 'OK';
	});

	//assert.ok(builders.schema('default').get('tbl_user').schema.Id instanceof Function, name + 'schema write & read');
	//assert.ok(JSON.stringify(builders.defaults('tbl_user')) === '{"date":"OK","Name":"","Id":0}', name + 'schema defaults');
	//assert.ok(JSON.stringify(builders.create('tbl_user')) === '{"date":"OK","Name":"","Id":0}', name + 'schema create');

	builders.schema('test', {
		Id: Number,
		Name: String,
		Male: Boolean,
		Dt: Date,
		Price: 'decimal'
	});

	var model = {
		Name: 23,
		Male: '1',
		Dt: 'ADASD',
		Price: 1.13
	};

	var output = builders.prepare('test', model);

	name = 'Schema.prepare: ';

	assert.ok(output.Price === 1.13, name + 'decimal');
	assert.ok(output.Name === '23', name + 'string');
	assert.ok(output.Male, name + 'boolean = true');
	//assert.ok(output.Dt === null, name + 'date (invalid)');

	assert.ok(builders.prepare('tbl_user', {}).date === 'OK', name + 'defaults');

	model = {
		Dt: '2012-12-12',
		Male: false
	};
	output = builders.prepare('test', model);

	assert.ok(output.Dt.getDate() === 12 && output.Dt.getMonth() === 11 && output.Dt.getFullYear() === 2012, name + 'date');
	assert.ok(!output.Male, name + 'boolean = false');

	output = builders.defaults('test');

	assert.ok(output.Id === 0, name + 'defaults (int)');
	assert.ok(output.Name === '', name + 'defaults (String)');
	assert.ok(output.Male === false, name + 'defaults (Boolean)');

	builders.schema('1', {
		name: 'string',
		join: '[2]'
	});

	builders.schema('default').get('1').define('nums', '[number]');

	builders.schema('2', {
		age: Number
	}, function(name) {
		if (name === 'age')
			return -1;
	});

	builders.schema('default').get('2').addTransform('xml', function(err, model, helper, next) {
		next('<xml>OK</xml>');
	}).addWorkflow('send', function(err, model, helper, next) {
		countW++;
		next('workflow');
	}).addOperation('test', function(err, model, helper, next) {
		assert.ok(!model, 'schema - operation 1');
		assert.ok(helper === true, 'schema - operation 2');
		next(false);
	}).setGet(function(error, model, helper, next) {
		assert.ok(error.hasError() === false, 'schema - setGet');
		model.age = 99;
		next();
	}).setSave(function(error, model, helper, next) {
		countS++;
		assert.ok(error.hasError() === false, 'schema - setSave');
		next(true);
	}).setRemove(function(error, helper, next) {
		assert.ok(error.hasError() === false, 'schema - setRemove');
		next(true);
	}).setQuery(function(error, helper, next) {
		assert.ok(error.hasError() === false, 'schema - setQuery');
		next([]);
	});

	//console.log(builders.defaults('1', { name: 'Peter', age: 30, join: { name: 20 }}));
	output = builders.prepare('1', {
		name: 'Peter',
		join: [{
			name: 'TEST'
		}, {
			age: 20,
			test: 'KUNDA'
		}],
		nums: ['1', 'asdas', 2.3]
	});

	assert.ok(output.join[0].age === -1 && output.join[1].age === 20, name + 'schema - joining models');
	assert.ok(output.nums[2] === 2.3 && output.nums[1] === 0, name + 'schema - parse plain array');

	builders.schema('default').get('2').transform('xml', output, function(err, output) {
		assert.ok(output === '<xml>OK</xml>', 'Builders.transform()');
	});

	builders.schema('default').get('2').workflow('send', output, function(err, output) {
		assert.ok(output === 'workflow', 'Builders.workflow()');
	}).get(null, function(err, result) {
		assert.ok(result.age === 99, 'schema - get');
	}).save(output, function(err, result) {
		assert.ok(result === true, 'schema - save');
	}).remove(output, function(err, result) {
		assert.ok(result === true, 'schema - remove');
	}).query(output, function(err, result) {
		assert.ok(result.length === 0, 'schema - query');
	}).operation(true, function(err, result) {
		assert.ok(!result, 'schema - operation - result');
	});

	SCHEMA('default', '2').addOperation('test2', function(error, model, helper, next) {
		assert.ok(model === 1 || model === undefined, 'schema - operation problem with model');
		assert.ok(helper === 2 || helper === undefined, 'schema - operation problem with helper');
		next(3);
	}).operation('test2', 1, 2, function(err, value) {
		assert.ok(value === 3, 'schema - operation advanced 1');
	}).operation('test2', 2, function(err, value) {
		assert.ok(value === 3, 'schema - operation advanced 2');
	}).operation('test2', function(err, value) {
		assert.ok(value === 3, 'schema - operation advanced 3');
	}).constant('test', true);

	assert.ok(SCHEMA('default', '2').constant('test') === true, 'schema - constant');

	builders.schema('validator', {
		name: 'string',
		age: 'number',
		isTerms: 'boolean'
	}, null, function(name, value, path, schema) {
		assert.ok(name !== 'validator', 'schema validator - problem with schema name in utils.validate()');
		switch (name) {
			case 'name':
				return value.length > 0;
			case 'age':
				return value > 10;
			case 'isTerms':
				return value === true;
		}
	});

	var builder = builders.validate('validator', {
		name: 'Peter'
	});

	assert.ok(builder.hasError(), name + 'schema validator (error)');

	builder = builders.validate('validator', {
		name: 'Peter',
		age: 34,
		isTerms: true
	});

	assert.ok(!builder.hasError(), name + 'schema validator (no error)');

	var obj = SCHEMA('default', '2').create();

	var b = obj.$clone();
	assert.ok(obj.age === b.age, 'schema $clone 1');
	b.age = 10;
	assert.ok(obj.age !== b.age, 'schema $clone 2');

	obj.$async(function(err, result) {
		assert.ok(err === null && countW === 2 && countS === 2 && result.length === 2, 'schema $async');
	}).$save().$workflow('send');

	var q = SCHEMA('test').create('q');
	var x = SCHEMA('test').create('x');

	q.define('name', String, true);
	q.define('arr', '[x]', true);
	q.define('ref', x);
	q.define('created', Date);
	x.define('age', Number, true);
	x.define('note', String, true);

	q.setValidate(function(name, value) {
		assert.ok((name === 'name' && value.length === 0) || (name === 'arr' && value.length === 2), 'SchemaBuilderEntity.validation() 1');
	});

	x.setValidate(function(name, value, path, model) {
		if (!path.startsWith('x.'))
			assert.ok((name === 'age' && value > 22) || (name === 'note' && value.length > 3), 'SchemaBuilderEntity.validation() 2');
	});

	var qi = q.create();
	assert.ok(qi.created.format('yyyyMMddHHmmss') === new Date().format('yyyyMMddHHmmss'), 'A problem with problem a default value of date');

	var xi = x.create();
	xi.age = 30;
	xi.note = 'Peter';
	qi.arr.push(xi);

	xi = x.create();
	xi.age = 23;
	xi.note = 'Jano';
	qi.arr.push(xi);

	qi.$validate();

	// Relations test
	qi = q.make({ ref: xi, arr:[xi,xi] });
	xi.note = 'Ivan';
	assert.ok(qi.ref.note === 'Ivan', 'schema relations');

	var Cat = SCHEMA('test').create('Cat');
	Cat.define('id', Number);
	Cat.define('name', String);
	Cat.define('age', Number);

	// Performance test
	var instanceCount = 80000;
	var cats = [];

	//var memwatch = require('memwatch-next');
	//var hd = new memwatch.HeapDiff();

	var __start = (new Date()).getTime();

	for (var i=0; i<instanceCount; i++){
		var c = Cat.make({
			id: i,
			name: 'Cat ' + i.toString(),
			age: 3
		});
		cats.push(c);
	}

	var __time = (new Date()).getTime() - __start;
	//var __mem = hd.end();
	// console.log('Create time (instance in ms): ', instanceCount / __time);
	//console.log('Memory usage (bytes per instance): ', __mem.change.size_bytes / instanceCount);

	// JSON test
	var cat = { id: 123, name: 'Kitty', age: 4 };
	assert.ok(JSON.stringify(Cat.make(cat)) == JSON.stringify(cat), 'schema - json stringify');

	// instance prototype test test
	Cat.instancePrototype().meou = function(){
		return this.name;
	};
	assert.ok(cats[40].meou() === 'Cat 40', 'schema - add function');

	var catClone = cats[40].$clone();
	assert.ok(catClone.meou === cats[0].meou, 'schema $clone 3')
}

function test_ErrorBuilder() {
	var name = 'ErrorBuilder: ';

	builders.ErrorBuilder.addTransform('custom', function() {
		assert.ok(this.hasError(), name + 'transform context');
		return this.items.length;
	});

	var builder = new builders.ErrorBuilder();

	builder.add('name');
	assert.ok(builder.items[0].name === 'name' && builder.items[0].error === '@', name + 'add');
	builder.add('age', 'only number');
	assert.ok(builder.items[1].name === 'age' && builder.items[1].error === 'only number', name + 'add (custom message)');

	builder.remove('age');
	assert.ok(typeof(builder.items[1]) === 'undefined', name + 'remove');
	assert.ok(builder.hasError(), name + 'hasError');

	builder = new builders.ErrorBuilder(function(name) {
		return name;
	});

	builder.add('name');
	builder.prepare();
	assert.ok(builder.items[0].error === 'name', name + 'prepare');

	builder.clear();
	builder.add('name');
	assert.ok(builder.output() === '[{"name":"name","error":"name"}]', name + 'json');

	builder.add(new builders.ErrorBuilder().add('age'));
	assert.ok(builder.output() === '[{"name":"name","error":"name"},{"name":"age","error":"age"}]', name + 'add(ErrorBuilder)');
	assert.ok(builder.read('name') === 'name', name + 'read()');
	assert.ok(builder.hasError('name'), name + 'hasError(name)');

	builder.replace('name', 'FET');
	assert.ok(builder.read('name') === 'FET', name + 'replace()');

	builder.setTransform('default');
	assert.ok(builder.transform('custom') === 2, name + 'transform()');

	builders.ErrorBuilder.setDefaultTransform('custom');
	builder = new builders.ErrorBuilder();

	builder.add('error', new Error('some error'));
	builder.add('name');

	assert.ok(builder.errors === 2, name + 'transform()');

	NEWSCHEMA('default').make(function(schema) {
		schema.define('created', Date);
	});

};

function test_TransformBuilder() {

	TransformBuilder.addTransform('xml', function(obj) {
		var xml = '';
		Object.keys(obj).forEach(function(key) {
			xml += '<' + key + '>' + obj[key] + '</' + key + '>';
		});
		return xml;
	}, true);

	assert.ok(TransformBuilder.transform('xml', { name: 'Peter' }, true) === '<name>Peter</name>', 'TransformBuilder problem');
	assert.ok(TransformBuilder.transform({ name: 'Peter' }) === '<name>Peter</name>', 'TransformBuilder problem (default)');
}

test_PageBuilder();
test_UrlBuilder();
test_Schema();
test_ErrorBuilder();
test_TransformBuilder();

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');

setTimeout(function() {}, 1000);