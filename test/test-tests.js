var framework = require('../index');

var q = SCHEMA('test').create('q');
var x = SCHEMA('test').create('x');
var w = SCHEMA('test').create('w');

w.define('firstname', 'String(10)');

q.define('name', 'string(5)', true);
q.define('arr', '[x]', true);
q.define('dep', w, true);
x.define('age', Number, false);
x.define('note', String, false);

q.setValidation(function(name, value, index) {
// console.log('–––> q', name, value);
});

x.setValidation(function(name, value) {
//    console.log('–––> x', name, value);
});

var qi = {};
qi.dep = {};
qi.arr = [{ age: 300, note: 'FET' }];
qi.dep.lastname = 'Sirka';
qi.dep.firstname = 'Peter';
qi.name = 'ASDASKDSADSALDKASLDJLSJ';

console.log(q.prepare(qi));

/*
var xi = x.create();
xi.age = 30;
xi.note = 'Peter';
qi.arr.push(xi);

xi = x.create();
xi.age = 23;
xi.note = 'Jano';
qi.arr.push(xi);
*/
//qi.$validate();

Array.prototype.compare = function(id, arr, keys, callback) {

    var self = this;
    var cache = {};

    for (var i = 0, length = arr.length; i < length; i++) {
        var key = arr[i][id];
        if (key === undefined)
            continue;
        cache[key] = i;
    }

    var kl = keys.length;

    for (var i = 0, length = self.length; i < length; i++) {
        var a = self[i];
        var key = a[id];

        if (!key)
            continue;

        var index = cache[key];

        if (index === undefined) {
            callback(0, item);
            continue;
        }

        var b = arr[index];

        for (var j = 0; j < kl; j++) {

            var k = keys[j];
            var av = a[k];
            var bv = b[k];

            if (av === bv)
                continue;


        }

    }
};

var arr1 = [{ id: 1, name: 'Peter', age: 25 }, { id: 2, name: 'Lucia', age: 19 }, { id: 3, name: 'Jozef', age: 33 }];
var arr2 = [{ id: 2, name: 'Lucka', age: 5 }, { id: 3, name: 'Peter', age: 50 }, { id: 1, name: 'Peter', age: 20 }, { id: 5, name: 'New', age: 33 }];

arr1.compare('id', arr2, ['name', 'age'], function(type, item) {
    console.log(type, item);
});