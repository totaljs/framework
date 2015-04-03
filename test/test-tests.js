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