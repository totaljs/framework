var framework = require('../index');

var q = SCHEMA('test').create('q');
var x = SCHEMA('test').create('x');

q.define('name', String, true);
q.define('arr', '[x]', true);
x.define('age', Number, false);
x.define('note', String, false);

q.setValidation(function(name, value, index) {
    console.log('–––> q', name, value);
});

x.setValidation(function(name, value) {
    console.log('–––> x', name, value);
});

var qi = q.create();
// console.log(qi);

var xi = x.create();
xi.age = 30;
xi.note = 'Peter';
qi.arr.push(xi);

xi = x.create();
xi.age = 23;
xi.note = 'Jano';
qi.arr.push(xi);

qi.$validate();
