require('../index');

function SQL(query) {

	var self = this;
	self.options = {};
	self.builder = new framework_nosql.DatabaseBuilder(null);
	self.query = query;

	var type = self.parseType();

	switch (type) {
		case 'select':
			self.parseLimit();
			self.parseOrder();
			self.parseWhere();
			self.parseJoins();
			self.parseTable();
			self.parseNames();
			break;
		case 'update':
			self.parseWhere();
			self.parseTable();
			self.parseUpdate();
			break;
		case 'insert':
			self.parseWhere();
			self.parseInsert();
			break;
		case 'delete':
			self.parseWhere();
			self.parseTable();
			break;
	}

	console.log(self.options);
}

var SQLP = SQL.prototype;

SQLP.parseLimit = function() {
	var self = this;
	var tmp = self.query.match(/take \d+ skip \d+$/i);
	!tmp && (tmp = self.query.match(/skip \d+ take \d+$/i));
	!tmp && (tmp = self.query.match(/take \d+$/i));
	!tmp && (tmp = self.query.match(/skip \d+$/i));
	if (!tmp)
		return self;
	self.query = self.query.replace(tmp, '').trim();
	var arr = tmp[0].toString().toLowerCase().split(' ');
	if (arr[0] === 'take')
		self.options.take = +arr[1];
	else if (arr[2] === 'take')
		self.options.take = +arr[3];
	if (arr[0] === 'skip')
		self.options.skip = +arr[1];
	else if (arr[2] === 'skip')
		self.options.skip = +arr[3];
	return self;
};

SQLP.parseOrder = function() {
	var self = this;
	var tmp = self.query.match(/order by .*?$/i);

	if (!tmp)
		return self;

	self.query = self.query.replace(tmp, '').trim();
	var arr = tmp[0].toString().substring(9).split(',');

	self.options.sort = [];

	for (var i = 0; i < arr.length; i++) {
		tmp = arr[i].trim().split(' ');
		self.options.sort.push({ name: tmp[0], desc: (tmp[1] || '').toLowerCase() === 'desc' });
	}

	return self;
};

SQLP.parseWhere = function() {
	var self = this;
	var tmp = self.query.match(/where .*?$/i);
	if (!tmp)
		return self;
	self.query = self.query.replace(tmp, '');

	tmp = tmp[0].toString().substring(6).replace(/\sAND\s/gi, ' && ').replace(/\sOR\s/gi, ' || ').replace(/[a-z0-9]=/gi, function(text) {
		return text + '=';
	});

	self.options.where = tmp;
	return self;
};

SQLP.parseJoins = function() {
	var self = this;
	var tmp = self.query.match(/left join.*?$/i);
	if (!tmp) {
		tmp = self.query.match(/join.*?$/i);
		if (!tmp)
			return self;
	}
	self.query = self.query.replace(tmp, '');
	tmp = tmp[0].toString().trim();

	self.options.joins = [];

	tmp = tmp.substring(5).split(/\s?JOIN\s/i);
	for (var i = 0; i < tmp.length; i++) {
		var join = tmp[i].split(/\son\s/i);
		self.options.joins.push({ table: join[0], condition: join[1] });
	}

	return self;
};

SQLP.parseTable = function() {
	var self = this;
	var tmp = self.query.match(/from\s.*?$/i);
	if (!tmp)
		return self;
	self.query = self.query.replace(tmp, '');
	tmp = tmp[0].toString().substring(5).trim();

	var arr = tmp.split(' ');
	// console.log(arr);

	return self;
};

SQLP.parseNames = function() {
	var self = this;
	var tmp = self.query.match(/select\s.*?$/i);
	if (!tmp)
		return self;

	self.query = self.query.replace(tmp, '');
	tmp = tmp[0].toString().substring(6).trim().split(',');

	self.options.fields = [];

	for (var i = 0; i < tmp.length; i++) {
		var field = tmp[i].trim();
		var alias = field.match(/as\s.*?$/);
		var name = '';
		var type = 0;

		if (alias) {
			field = field.replace(alias, '');
			alias = alias.toString().substring(3);
		}

		var index = field.indexOf('(');
		if (index !== -1) {
			switch (field.substring(0, index).toLowerCase()) {
				case 'count':
					type = 1;
					break;
				case 'min':
					type = 2;
					break;
				case 'max':
					type = 3;
					break;
				case 'avg':
					type = 4;
					break;
				case 'sum':
					type = 5;
					break;
				case 'distinct':
					type = 6;
					break;
			}
			name = field.substring(index + 1, field.lastIndexOf(')'));
		} else
			name = field;
		self.options.fields.push({ alias: alias || name, name: name, type: type });
	}

	return self;
};

SQLP.parseUpdate = function() {
	var self = this;
	return self;
};

SQLP.parseInsert = function() {
	var self = this;
	return self;
};

SQLP.parseType = function() {
	var self = this;
	return self.query.substring(0, self.query.indexOf(' ')).toLowerCase();
};

var sql = new SQL('SELECT COUNT(*) as count, id FROM table a JOIN users ON users.id=a.id JOIN orders ON orders.id=a.id WHERE a.name="Peter" AND a.age=30 ORDER BY a.name, a.age ASC TAKE 20 SKIP 10');