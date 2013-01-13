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
* support file upload
* support debug mode without cache
* support JavaScript compress
* support simple CSS LESS (with compress)
* support Markdown parser
* support resources
* support prefixes for mobile device
* support HTTP-RDBMS
* support simple ORM
* support simple CouchDB provider

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

- native SMTP mail sender
- native image processing (ImageMagick (http://www.imagemagick.org) or GraphicsMagic (http://www.graphicsmagick.org))
- native RIAK DB  provider <http://docs.basho.com>

## Simple ORM via HTTP-RDBMS

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

db.findTop(10, 'tbl_user', where, order, function(data) {
	console.log(data);
});

db.execute('UPDATE tbl_user SET DateUpdated=GETDATE() WHERE Id BETWEEN {{a}} AND {{b}}', { a: 10, b: 20 });

db.scalar('SELECT COUNT(*) FROM tbl_user', null, null, function(data) {
	console.log(data);
});

// multiple recordset
db.reader('SELECT Id, LastName FORM tbl_user; SELECT Id, FirstName FROM tbl_user', function(d) {
	// d[0] == []
	// d[1] == []
});

db.count('tbl_user', function(d) {
	// d.value
});

db.count('tbl_user', where, function(d) {
	// d.value
});

```

***

## Contact

<http://www.petersirka.sk>