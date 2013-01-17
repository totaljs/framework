![partial.js logo](http://petersirka.sk/partial-js/logo.png)

web application framework for node.js
=====================================

![passing](http://petersirka.sk/files/96.png)

* async web framework
* simple view system
* simple routing
* simple cache
* simple directory structure
* simple code structure
* simple view system
* simple error handling
* simple listing via templates
* render controller in controller
* share controller functions and models over framework
* support debug mode without cache
* support file upload
* support form data validation
* support JavaScript compress
* support JavaScript dynamic compress in views
* support simple LESS CSS (with compress)
* support Markdown parser
* support resources (for multilanguage pages)
* support prefixes for mobile devices
* support simple SMTP mail sender
* support simple ORM (via HTTP-RDBMS)
* support HTTP-RDBMS provider (MySQL, SQL Server, OleDB, ODBC), more on https://github.com/petersirka/http-rdbms/
* support simple CouchDB provider
* about 6 000 lines of JavaScript code
* __no any dependencies__

***

## Simple documentation
Slovak documentation: <https://github.com/petersirka/partial.js/wiki>

***

## Empty website project
http://petersirka.sk/partial-js/new-web-site.zip

***

## Simple eshop example
http://petersirka.sk/partial-js/eshop.zip

Preview node.js eshop:
http://nodejs-eshop.eu01.aws.af.cm

***

## Run your web site:

- download empty website project
- open terminal and find website directory
- write and run on terminal:

```text
$ node index.js
```

***

## NPM partial.js

- create on your desktop empty directory with name: website
- create file index.js
- open terminal and find this directory: cd /Desktop/website/
- write and run on terminal:

```text
$ npm install partial.js
```

### Tips:

- node.js cluster: <http://petersirka.sk/development/spustenie-partial-js-v-module-cluster/>
- install nginx: <http://www.petersirka.sk/ostatok/instalacia-na-osx-lion-nginx-a-nastavenie-sublime-do-termin/>

### Sublime 2 Syntax partial.js HTML Highlighter

![Sublime Text 2 Syntax Highlighter](http://petersirka.sk/partial-js/syntax-highlight.gif)

> Download / extract and copy to Sublime Text 2 Packgages

http://petersirka.sk/partial-js/Packages.zip

## Plans

- native simple image processing (ImageMagick (http://www.imagemagick.org) or GraphicsMagic (http://www.graphicsmagick.org))
- native sipmle RIAK DB provider <http://docs.basho.com>

## Simple example

> index.js

```js
var framework = require('partial.js');
var http = require('http');

var options = {
	name: 'Value'
};

var port = 8004;
var server = framework.init(http, { debug: true }, options).listen(port);

// Initialize controllers
framework.controller('global');

console.log("http://127.0.0.1:{0}/".format(port));
```

> controllers / global.js

```js
exports.init = function() {
	this.route('/', viewHomepage);
	this.route('#403', error403);
	this.route('#404', error404);
	this.route('#431', error431)
	this.route('#500', error500);
};

// Forbidden
function error403() {
	this.repository.title = 'Forbidden (403)';
	this.statusCode = 403;
	this.view('403');
}

// Not Found
function error404() {
	this.repository.title = 'Not Found (404)';
	this.statusCode = 404;
	this.view('404');
}

// Request Header Fields Too Large
function error431() {
	this.repository.title = 'Request Header Fields Too Large (431)';
	this.statusCode = 431;
	this.view('431');
}

// Internal Server Error
function error500() {
	this.repository.title = 'Internal Server Error (500)';
	this.statusCode = 500;
	this.view('500');
}

function viewHomepage() {
	this.repository.title = 'Welcome';
	this.view('homepage', { name: 'Peter' });
}
```

> views / _layout.html

```html
<!DOCTYPE html>
<html>
<head>
    <title>@{repository.title}</title>
    <meta charset="utf-8" />
	<meta http-equiv="content-language" content="sk" />
	<meta http-equiv="X-UA-Compatible" content="IE=10" />
	<meta name="format-detection" content="telephone=no"/>
	<meta name="viewport" content="width=1024, user-scalable=yes" />
	<meta name="robots" content="all,follow" />
	<link rel="stylesheet" href="@{routeCSS('p.css')}" />
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js"></script>
	<script type="text/javascript" src="@{routeJS('p.js')}" ></script>
</head>
<body>
	<div class="content">
		<h1>@{repository.title}</h1>
		@{body}
	</div>
</body>
</html>
```

> views / homepage.html

```html
Welcome @{model.name}!
```

> RESULT

```html

<!DOCTYPE html>
<html>
<head>
    <title>Welcome</title>
    <meta charset="utf-8" />
	<meta http-equiv="content-language" content="sk" />
	<meta http-equiv="X-UA-Compatible" content="IE=10" />
	<meta name="format-detection" content="telephone=no"/>
	<meta name="viewport" content="width=1024, user-scalable=yes" />
	<meta name="robots" content="all,follow" />
	<link rel="stylesheet" href="/data/p.css" />
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js"></script>
	<script type="text/javascript" src="/data/p.js" ></script>
</head>
<body>
	<div class="content">
		<h1>Welcome</h1>
		Welcome Peter!
	</div>
</body>
</html>

```

***

## Simple ORM via HTTP-RDBMS

- support parameters (resolve for SQL injection)
- support schema builder
- support query builder
- support order builder
- support paging

```js

var builders = new requiere('partial.js/builders');
var rdbms = new requiere('partial.js/rdbms');

var db = new rdbms.SQLServer('http://myrdbms/sqlserver/', 'Data Source=;Database=;Uid=;Pwd=;');

// or

var db = new rdbms.MySQL('http://myrdbms/mysql/', 'Server=;Database=;Uid=;Pwd=;');

builders.schema('tbl_user', {
	Id: 'int',
	FirstName: 'string(50)',
	LastName: 'string(50)',
	Age: 'int'
}, 'Id');

var newUser = {
	FirstName: 'Peter',
	LastName: 'Sirka',
	Age: 28
};

db.insert('tbl_user', newUser, function(data) {

	console.log(data.Id);
	db.delete('tbl_user', newUser);

});

var where = new builders.QueryBuilder();
var order = new builders.OrderBuilder();

order.asc('Id').desc('FistName');
where.addValue('Id', '>', 10).addOperator('AND').addValue('FistName', '=', 'Peter');
// Query:
// SQL Server: Id > @a AND FirstName = @b
// MySQL: Id > ? AND FirstName = ?

db.findTop(10, 'tbl_user', where, order, function(data) {
	console.log(data);
});

db.execute('UPDATE tbl_user SET Price=20 WHERE Id BETWEEN {a} AND {b}', { a: 10, b: 20 });
// Query:
// SQL Server: UPDATE tbl_user SET Price=20 WHERE Id BETWEEN @a AND @b
// MySQL: UPDATE tbl_user SET Price=20 WHERE Id BETWEEN ? AND ?

db.scalar('SELECT COUNT(*) FROM tbl_user', null, null, function(err, data) {
	console.log(data);
});

// multiple recordset
db.reader('SELECT Id, LastName FORM tbl_user; SELECT Id, FirstName FROM tbl_user', function(err, data) {
	// data[0] == []
	// data[1] == []
});

db.count('tbl_user', function(err, data) {
	// data.value
});

db.count('tbl_user', where, function(err, data) {
	// data.value
});

```

***

## Contact

<http://www.petersirka.sk>