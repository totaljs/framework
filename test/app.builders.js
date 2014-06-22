global.utils = require('../utils');

var assert = require('assert');
global.builders = require('../builders');

function test_PageBuilder() {

    var name = 'Pagination: ';
    var builder = new builders.Pagination(100, 1, 12);

    assert.ok(builder.isPrev === false, name + 'isPrev (1)');
    assert.ok(builder.isNext === true, name + 'isNext (1)');

    var output = builder.render();

    output = builder.render(6);
    builder.refresh(100, 5, 12);

    assert.ok(builder.isPrev, name + 'isPrev (50)');
    assert.ok(builder.isNext, name + 'isNext (50)');

    //output = builder.render(5);
    //assert.ok(output === '34567', name + 'render - max 5');
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

    builders.schema('tbl_user', {
        Id: Number,
        Name: String,
        date: Date
    }, function(name) {
        if (name === 'date')
            return 'OK';
    });

    assert.ok(builders.schema('tbl_user').Id instanceof Function, name + 'schema write & read');
    assert.ok(JSON.stringify(builders.defaults('tbl_user')) === '{"date":"OK","Name":"","Id":0}', name + 'schema defaults');
    assert.ok(JSON.stringify(builders.create('tbl_user')) === '{"date":"OK","Name":"","Id":0}', name + 'schema create');

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
    assert.ok(builders.prepare('tbl_user', {}).date === 'OK', name + 'defaults');
    assert.ok(output.Price === 1.13, name + 'decimal');
    assert.ok(output.Name === '23', name + 'string');
    assert.ok(output.Male, name + 'boolean = true');
    assert.ok(output.Dt === null, name + 'date (invalid)');

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
        join: '[2]',
        nums: '[number]'
    });
    builders.schema('2', {
        age: Number
    }, function(name) {
        if (name === 'age')
            return -1;
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

    builders.schema('validator', {
        name: 'string',
        age: 'number',
        isTerms: 'boolean'
    }, null, function(name, value, path, name) {
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

};

function test_ErrorBuilder() {
    var name = 'ErrorBuilder: ';
    var builder = new builders.ErrorBuilder();

    builder.add('name');
    assert.ok(builder.errors[0].name === 'name' && builder.errors[0].error === '@', name + 'add');
    builder.add('age', 'only number');
    assert.ok(builder.errors[1].name === 'age' && builder.errors[1].error === 'only number', name + 'add (custom message)');

    builder.remove('age');
    assert.ok(typeof(builder.errors[1]) === 'undefined', name + 'remove');
    assert.ok(builder.hasError(), name + 'hasError');

    builder = new builders.ErrorBuilder(function(name) {
        return name;
    });

    builder.add('name');
    builder.prepare();
    assert.ok(builder.errors[0].error === 'name', name + 'prepare');

    builder.clear();
    builder.add('name');

    assert.ok(builder.json() === '[{"name":"name","error":"name"}]', name + 'json');

    builder.add(new builders.ErrorBuilder().add('age'));
    assert.ok(builder.json() === '[{"name":"name","error":"name"},{"name":"age","error":"age"}]', name + 'add(ErrorBuilder)');

    assert.ok(builder.read('name') === 'name', name + 'read()');
    assert.ok(builder.hasError('name'), name + 'hasError(name)');

    builder.replace('name', 'FET');

    assert.ok(builder.read('name') === 'FET', name + 'replace()');
};

test_PageBuilder();
test_UrlBuilder();
test_Schema();
test_ErrorBuilder();

console.log('================================================');
console.log('success - OK');
console.log('================================================');
console.log('');