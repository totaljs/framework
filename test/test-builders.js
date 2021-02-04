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

	NEWSCHEMA('tbl_user').make(function(schema) {
		schema.define('Id', Number);
		schema.define('Name', String);
		schema.define('date', Date);
		schema.setDefault(function(name) {
			if (name === 'date')
				return 'OK';
		});
	});

	//assert.ok(builders.schema('default').get('tbl_user').schema.Id instanceof Function, name + 'schema write & read');
	//assert.ok(JSON.stringify(builders.defaults('tbl_user')) === '{"date":"OK","Name":"","Id":0}', name + 'schema defaults');
	//assert.ok(JSON.stringify(builders.create('tbl_user')) === '{"date":"OK","Name":"","Id":0}', name + 'schema create');

	NEWSCHEMA('test').make(function(schema) {
		schema.define('Id', Number);
		schema.define('Name', String);
		schema.define('Dt', Date);
		schema.define('Male', Boolean);
		schema.define('Price', 'decimal');
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

	NEWSCHEMA('1').make(function(schema) {
		schema.define('name', String);
		schema.define('join', '[2]');
	});

	GETSCHEMA('1').define('nums', '[number]');

	NEWSCHEMA('2').make(function(schema) {
		schema.define('age', Number);
		schema.setDefault(function(name) {
			if (name === 'age')
				return -1;
		});
	});

	GETSCHEMA('2').addTransform('xml', function($) {
		$.next('<xml>OK</xml>');
	}).addWorkflow('send', function($) {
		countW++;
		$.callback('workflow');
	}).addOperation('test', function($) {
		assert.ok(!$.model, 'schema - operation 1');
		assert.ok($.options === true, 'schema - operation 2');
		$.next(false);
	}).setGet(function($) {
		assert.ok($.error.hasError() === false, 'schema - setGet');
		$.model.age = 99;
		$.next();
	}).setSave(function($) {
		countS++;
		assert.ok($.error.hasError() === false, 'schema - setSave');
		$.next(true);
	}).setRemove(function($) {
		assert.ok($.error.hasError() === false, 'schema - setRemove');
		$.next(true);
	}).setQuery(function($) {
		assert.ok($.error.hasError() === false, 'schema - setQuery');
		$.next([]);
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

	GETSCHEMA('2').transform('xml', output, function(err, output) {
		assert.ok(output === '<xml>OK</xml>', 'Builders.transform()');
	});

	GETSCHEMA('2').workflow('send', output, function(err, output) {
		assert.ok(output === 'workflow', 'Builders.workflow()');
	}).get(null, function(err, result) {
		assert.ok(result.age === 99, 'schema - get');
	}).save(output, function(err, result) {
		assert.ok(result === true, 'schema - save');
	}).remove(output, function(err, result) {
		assert.ok(result === true, 'schema - remove');
	}).query(output, function(err, result) {
		assert.ok(result.length === 0, 'schema - query');
	}).operation('', function(err, result) {
		assert.ok(!result, 'schema - operation - result');
	});

	GETSCHEMA('default', '2').addOperation('test2', function($) {
		assert.ok($.model === 1 || $.model == null, 'schema - operation problem with model');
		assert.ok($.options != null, 'schema - operation problem with options');
		$.next(3);
	}).operation('test2', 1, 2, function(err, value) {
		assert.ok(value === 3, 'schema - operation advanced 1');
	}).operation('test2', 2, function(err, value) {
		assert.ok(value === 3, 'schema - operation advanced 2');
	}).operation('test2', null, function(err, value) {
		assert.ok(value === 3, 'schema - operation advanced 3');
	});

	NEWSCHEMA('validator').make(function(schema) {
		schema.define('name', String, true);
		schema.define('age', Number, true);
		schema.define('isTerms', Boolean, true);

		schema.setValidate(function(name, value, path, schema) {
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

	var obj = GETSCHEMA('default', '2').create();

	var b = obj.$clone();
	assert.ok(obj.age === b.age, 'schema $clone 1');
	b.age = 10;
	assert.ok(obj.age !== b.age, 'schema $clone 2');

	obj.$async(function(err, result) {
		assert.ok(err === null && countW === 2 && countS === 2 && result.length === 2, 'schema $async');
	}).$save().$workflow('send');

	var q = NEWSCHEMA('test', 'q');
	var x = NEWSCHEMA('test', 'x');

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
		if (!path.startsWith('x.') && path.indexOf('ref.') === -1)
			assert.ok((name === 'age' && value > 22) || (name === 'note' && value.length > 3), 'SchemaBuilderEntity.validation() 2');
	});

	var qi = q.create();
	assert.ok(qi.created.format('yyyyMMddHHmmss') === F.datetime.format('yyyyMMddHHmmss'), 'A problem with problem a default value of date');

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

	var Cat = NEWSCHEMA('test', 'Cat');
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
	assert.ok(catClone.meou === cats[0].meou, 'schema $clone 3');

	var NewTypes = NEWSCHEMA('NewTypes').make(function(schema) {
		schema.define('capitalize', 'Capitalize');
		schema.define('capitalize10', 'Capitalize(10)');
		schema.define('capitalize2', 'Capitalize2');
		schema.define('lower', 'Lower');
		schema.define('lower10', 'Lower(10)');
		schema.define('upper', 'Upper');
		schema.define('upper10', 'Upper(10)');
		schema.define('zip', 'Zip');
		schema.define('phone', 'Phone');
		schema.define('url', 'Url');
		schema.define('uid', 'UID');
		schema.define('base64', 'Base64');

		var obj = {};
		schema.fields.forEach(n => obj[n] = 'total fraMEWOrk');
		obj.zip = '83102';
		obj.phone = '+421 903 163 302';
		obj.url = 'https://www.totaljs.com';
		obj.uid = UID();
		obj.base64 = 'WA==';

		var res = schema.make(obj);
		assert.ok(res.capitalize === 'Total FraMEWOrk', 'SchemaBuilder: Capitalize');
		assert.ok(res.capitalize10 === 'Total FraM', 'SchemaBuilder: Capitalize(10)');
		assert.ok(res.capitalize2 === 'Total fraMEWOrk', 'SchemaBuilder: Capitalize2');
		assert.ok(res.lower === 'total framework', 'SchemaBuilder: Lower');
		assert.ok(res.lower10 === 'total fram', 'SchemaBuilder: Lower(10)');
		assert.ok(res.upper === 'TOTAL FRAMEWORK', 'SchemaBuilder: Upper');
		assert.ok(res.upper10 === 'TOTAL FRAM', 'SchemaBuilder: Upper(10)');
		assert.ok(res.zip === '83102', 'SchemaBuilder: Zip');
		assert.ok(res.phone === '+421903163302', 'SchemaBuilder: Phone');
		assert.ok(res.url === 'https://www.totaljs.com', 'SchemaBuilder: URL');
		assert.ok(res.uid ? true : false, 'SchemaBuilder: UID');
		assert.ok(res.base64 ? true : false, 'SchemaBuilder: Base64');

		obj.phone = '+4210000';
		obj.uid = U.GUID(10);
		obj.url = 'totaljs.com';
		obj.zip = '349393';
		obj.base64 = 'adlajkd';

		res = schema.make(obj);
		assert.ok(res.phone ? false : true, 'SchemaBuilder: Phone must be empty');
		assert.ok(res.url ? false : true, 'SchemaBuilder: URL must be empty');
		assert.ok(res.uid ? false : true, 'SchemaBuilder: UID must be empty');
		assert.ok(res.base64 ? false : true, 'SchemaBuilder: Base64 must be empty');
	});

	NEWSCHEMA('Hooks').make(function(schema) {

		schema.addHook('1', function($) {
			$.model.counter = 1;
			$.callback();
		});

		schema.addHook('1', function($) {
			$.model.counter++;
			$.callback();
		});

		schema.addHook('1', function($) {
			$.model.counter++;
			$.callback();
		});

		schema.addHook('1', function($) {
			$.model.counter++;
			$.callback();
		});

		schema.hook('1', null, null, function(err, response) {
			assert.ok(response.counter === 4, 'Problem with hooks');
		});
	});

	NEWSCHEMA('Special').make(function(schema) {

		schema.define('enum_int', [1, 2, 0.3, 4], true);
		schema.define('enum_string', ['Peter', 'Širka'], true);
		schema.define('keyvalue', { 'peter': 1, 'lucia': 2 }, true);
		schema.define('number', 'Number2');

		schema.make({ enum_int: '0.3', 'keyvalue': 'lucia', enum_string: 'Širka' }, function(err, response) {
			assert.ok(response.number === null, 'Special schema nullable (number2)');
			assert.ok(response.enum_int === 0.3, 'Special schema (int)');
			assert.ok(response.enum_string === 'Širka', 'Special schema (int)');
			assert.ok(response.keyvalue === 2, 'Schema keyvalue');
		});

		schema.make({ enum_int: '0.3', 'keyvalue': 'lucia', enum_string: 'Širka', number: '10' }, function(err, response) {
			assert.ok(response.number === 10, 'Special schema with number (number2)');
		});

		schema.make({ enum_int: '5', 'keyvalue': 'luciaa', enum_string: 'Širkaa', number: '10' }, function(err) {
			assert.ok(err.items[0].path === 'enum_int', 'Special schema (int) 2');
			assert.ok(err.items[1].path === 'enum_string', 'Special schema (string) 2');
			assert.ok(err.items[2].path === 'keyvalue', 'Schema keyvalue 2');
		});

	});
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
	assert.ok(builder.output(true) === '[{"name":"name","error":"name"}]', name + 'json');

	builder.add(new builders.ErrorBuilder().add('age'));
	assert.ok(builder.output(true) === '[{"name":"name","error":"name"},{"name":"age","error":"age"}]', name + 'add(ErrorBuilder)');
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

	NEWSCHEMA('Async').make(function(schema) {

		var arr = [];

		schema.define('name', String);

		schema.addWorkflow('1', function($) {
			arr.push('workflow1');
			$.model.$next('workflow', '2');
			$.callback();
		});

		schema.addWorkflow('2', function($) {
			arr.push('workflow2');
			$.callback();
		});

		schema.addWorkflow('3', function($) {
			arr.push('workflow3');
			$.callback();
		});

		schema.addTransform('1', function($) {
			arr.push('transform1');
			$.model.$next('transform', '2');
			$.model.$push('transform', '4');
			$.callback();
		});

		schema.addTransform('2', function($) {
			arr.push('transform2');
			$.callback();
		});

		schema.addTransform('3', function($) {
			arr.push('transform3');
			$.callback();
		});

		schema.addTransform('4', function($) {
			arr.push('transform4');
			$.callback();
		});

		var model = schema.create();
		model.name = 'Peter';

		var async = model.$async(function() {
			assert.ok(arr.indexOf('workflow2') === 1, 'SchemaBuilderEntit.$next()');
			assert.ok(arr.indexOf('transform2') === 4, 'SchemaBuilderEntit.$next()');
			assert.ok(arr.pop() === 'transform4', 'SchemaBuilderEntit.$push()');
		});

		async.$workflow('1');
		async.$workflow('3');
		async.$transform('1');
		async.$transform('3');
	});

	NEWSCHEMA('Repository').make(function(schema) {

		schema.addWorkflow('1', function($) {
			$.model.$repository('valid', true);
			$.callback();
		});

		schema.addWorkflow('2', function($) {
			$.callback();
		});

		var model = schema.create();

		model.$async(function(err) {
			assert.ok(model.$repository('valid') === true, 'SchemaBuilder.$repository()');
		}).$workflow('1').$workflow('2');
	});


	NEWSCHEMA('Output').make(function(schema) {

		schema.addWorkflow('1', function($) {
			$.callback(1);
		});

		schema.addWorkflow('2', function($) {
			$.model.$output();
			$.callback(2);
		});

		schema.addWorkflow('3', function($) {
			$.callback(3);
		});

		var model = schema.create();

		model.$async(function(err, response) {
			assert.ok(response === 2, 'SchemaBuilderEntity.$output()');
		}).$workflow('1').$workflow('2').$workflow('3');
	});

}

function test_Convertors() {
	var a = CONVERT({ page: 5, age: 3, money: '-100', tags: 'Total.js' }, 'page:Number,age:Number, money:Number, tags:[String], empty: Boolean');
	assert.ok(a.page === 5 && a.age === 3 && a.money === -100 && a.tags[0] === 'Total.js' && a.empty === false, 'Problem in convertor');
}

function test_Operations() {

	NEWOPERATION('testA', function($) {
		$.callback(SUCCESS(true, $.value));
	});

	NEWOPERATION('testB', function($) {
		$.error.push('bug');
		$.callback();
	});

	OPERATION('testA', 123456, function(err, response) {
		assert.ok(err === null, 'OPERATIONS: errors');
		assert.ok(response.success && response.value === 123456, 'OPERATIONS: response');
	});

	OPERATION('testB', function(err, response) {
		assert.ok(err.hasError('bug'), 'OPERATIONS: ErrorHandling 1');
		assert.ok(response === undefined, 'OPERATIONS: ErrorHandling 2');
	});

	NEWOPERATION('testC', function($) {
		assert.ok($.controller === EMPTYCONTROLLER, 'OPERATIONS: Controller 1');
		$.callback(true);
	});

	NEWOPERATION('testD', function($) {
		assert.ok($.options.ok === 100, 'OPERATIONS: Custom options + controller');
		assert.ok($.controller === EMPTYCONTROLLER, 'OPERATIONS: Controller 2');
		$.callback(false);
	});

	OPERATION('testC', 1, function(err, response) {
		assert.ok(response === true, 'OPERATIONS: controller 1 response');
	}, EMPTYCONTROLLER);

	OPERATION('testD', 2, function(err, response) {
		assert.ok(response === false, 'OPERATIONS: controller 2 response');
	}, { ok: 100 }, EMPTYCONTROLLER);
}

test_PageBuilder();
test_UrlBuilder();
test_Schema();
test_ErrorBuilder();
test_Operations();
test_Convertors();

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');

setTimeout(function() {}, 1000);

process.on('uncaughtException', function(err) {
	console.error(err);
	process.exit(1);
});