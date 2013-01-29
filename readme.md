![partial.js logo](http://petersirka.sk/partial-js/logo.png)

web application framework for node.js
=====================================

* Async web framework - [example](https://github.com/petersirka/partial.js/tree/master/examples/async)
* Simple view system - [example](https://github.com/petersirka/partial.js/tree/master/examples/views)
* Simple routing (+ support flags ['ajax', 'post', 'get', 'put', 'delete', 'upload', 'json', 'logged', 'unlogged', 'debug']) - [example](https://github.com/petersirka/partial.js/tree/master/examples/routing)
* Simple cacheing - [http cache example](https://github.com/petersirka/partial.js/tree/master/examples/cache-http), [partial cache example](https://github.com/petersirka/partial.js/tree/master/examples/cache-partial)
* Simple directory structure
* Simple code structure
* Simple error handling
* Simple cookie manipulation - [example](https://github.com/petersirka/partial.js/tree/master/examples/cookies)
* Simple listing via templates - [example](https://github.com/petersirka/partial.js/tree/master/examples/templating)
* Render controller in controller
* Share controller functions and models over framework
* Supports controller sharing between other controllers - [example](https://github.com/petersirka/partial.js/tree/master/examples/controller-sharing)
* Supports debug mode with custom settings without cache - [example](https://github.com/petersirka/partial.js/tree/master/examples/config-debug-release)
* Supports file upload - [example](https://github.com/petersirka/partial.js/tree/master/examples/upload-multipart)
* Supports copy&paste custom code between projects - [example](https://github.com/petersirka/partial.js/tree/master/examples/framework-custom)
* __Supports modules__ - [example](https://github.com/petersirka/partial.js/tree/master/examples/framework-modules)
* Supports form data validation - [example](https://github.com/petersirka/partial.js/tree/master/examples/validation)
* Supports static files
* Supports JavaScript compress
* Supports JavaScript dynamic compress in views
* Supports simple LESS CSS (with compress)
* Supports Markdown parser - [example](https://github.com/petersirka/partial.js/tree/master/examples/markdown)
* Supports resources (for multilanguage pages) - [example](https://github.com/petersirka/partial.js/tree/master/examples/localization-resources)
* __Supports prefixes for mobile devices__ - [example](https://github.com/petersirka/partial.js/tree/master/examples/mobile)
* Supports simple SMTP mail sender
* Supports simple mail templating - [example](https://github.com/petersirka/partial.js/tree/master/examples/email-templating)
* Supports simple ORM (via HTTP-RDBMS)
* Supports custom authorization - [example](https://github.com/petersirka/partial.js/tree/master/examples/authorization)
* Supports HTTP-RDBMS provider (MySQL, SQL Server, OleDB, ODBC), more on https://github.com/petersirka/http-rdbms/
* Supports simple CouchDB provider - [example](https://github.com/petersirka/partial.js/tree/master/examples/authorization)
* Supports simple image processing (resize, crop, blur, sepia, grayscale, etc.)  with GraphicsMagick or ImageMagick - [example](https://github.com/petersirka/partial.js/tree/master/examples/picture-resize)
* Easy adding dynamic META tags in views or controllers - [example](https://github.com/petersirka/partial.js/tree/master/examples/views-meta)
* Easy adding dynamic Settings in views or controllers - [example](https://github.com/petersirka/partial.js/tree/master/examples/views-settings)
* Simple use paypal payment with [node-paypal](https://github.com/petersirka/node-paypal) - [example](https://github.com/petersirka/partial.js/tree/master/examples/paypal)
* Supports simple paging builder - [example](https://github.com/petersirka/partial.js/tree/master/examples/paging)
* Supports live usage information - [example](https://github.com/petersirka/partial.js/tree/master/examples/framework-usage)
* About 6 500 lines of JavaScript code
* __No dependencies__
* [More examples](https://github.com/petersirka/partial.js/tree/master/examples)

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

## Empty website project
http://petersirka.sk/partial-js/new-web-site.zip

***

## Simple documentation
Slovak documentation: <https://github.com/petersirka/partial.js/wiki>
English documentation: ... in progress ...

***

## Plans

> I want perfect and stability web application framework. Currently is framework in testing mode and stable version will be in short time.

### Tips:

- node.js cluster: <http://petersirka.sk/development/spustenie-partial-js-v-module-cluster/>
- install nginx: <http://www.petersirka.sk/ostatok/instalacia-na-osx-lion-nginx-a-nastavenie-sublime-do-termin/>

### Sublime 2 Syntax partial.js HTML Highlighter

![Sublime Text 2 Syntax Highlighter](http://petersirka.sk/partial-js/syntax-highlight.gif)

> Download / extract and copy to Sublime Text 2 Packgages

http://petersirka.sk/partial-js/Packages.zip

## Simple example

> index.js

```js
var framework = require('partial.js');
var http = require('http');

var port = 8004;
var debug = true;
var server = framework.init(http, debug).listen(port);

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
	// this.route('/registration/', viewRegistration, ['ajax', 'post']);
	// this.route('/products/{category}/', viewProducts);
	// this.route('/products/{category}/{subcategory}/', viewProducts);
	// this.route('/user/', viewUser, ['logged']);
};

// Forbidden
function error403() {
	this.repository.title = 'Forbidden (403)';
	this.view('403');
}

// Not Found
function error404() {
	this.repository.title = 'Not Found (404)';
	this.view('404');
}

// Request Header Fields Too Large
function error431() {
	this.repository.title = 'Request Header Fields Too Large (431)';
	this.view('431');
}

// Internal Server Error
function error500() {
	this.repository.title = 'Internal Server Error (500)';
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
