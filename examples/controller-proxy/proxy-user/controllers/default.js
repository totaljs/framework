exports.install = function(framework) {
	framework.route('/', json_users, ['proxy']);
};

function json_users() {
	
	var self = this;
	
	var users = [
		{ name: 'Peter', age: 30 },
		{ name: 'Jano', age: 23 },
		{ name: 'Lucia', age: 32 },
		{ name: 'Igor', age: 34 },
		{ name: 'Libor', age: 24 },
		{ name: 'Tomas', age: 34 },
		{ name: 'Martin', age: 49 },
		{ name: 'Ivan', age: 29 }
	];

	var output = users.where(function(item) {
		return item.age > self.post.age;
	});

	self.json(output);
	
};