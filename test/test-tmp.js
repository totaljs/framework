require('../index');

NEWSCHEMA('B').make(function(schema) {
	schema.define('name', String, true);
});

NEWSCHEMA('C').make(function(schema) {
	schema.define('name', String, true);
});

NEWSCHEMA('A').make(function(schema) {
	schema.define('name', String, true);
	schema.define('subB', '[B]');
	schema.define('subC', 'C');
});

var obj = {};
obj.name = 'asdas';
obj.subB = [{}];
obj.subC = { A: '' };

GETSCHEMA('A').make(obj, function(err, res) {
	console.log('------');
	err.setPrefix('error-');
	console.log(err.output());
});