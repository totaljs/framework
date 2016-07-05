require('../index');

var users = F.database('users');

users.view('test').make(function(builder) {
//	builder.where('index', '>', 3);
	builder.sort('name', true);
});

// console.log(users.binary.insert('/users/petersirka/desktop/freedelivery.jpg'));

// users.drop();

// users.refresh();

/*
users.sort(n => n, function(a, b) {
	if (a.index > b.index)
		return -1;
	return 1;
}, function() {
	console.log('----');
	console.log(arguments);
});

users.one(n => n, function() {
	console.log('---');
	console.log(arguments);
});
*/

// users.modify({ age: n => n + 1 }).where('name', 'Lucia');

// users.insert({ name: 'Peter', age: 33 });
// users.insert({ name: 'Lucia', age: 35 });

/*
users.top(6, 'test').make(function(builder) {
	builder.in('index', [5, 1, 3]);
}).callback(function(err, response) {
	console.log(err, response);
});
*/
/*
users.modify({ age: 35, updated: new Date() }).callback(function(err, count) {
	console.log(arguments);
});
*/
// users.remove().where('name', 'E').callback(console.log);

/*
users.sort(n => n, function(a, b) {
	if (a.index > b.index)
		return -1;
	return 1;
}, function() {
	console.log('----');
	console.log(arguments);
});
*/