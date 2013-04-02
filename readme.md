![partial.js logo](http://petersirka.sk/partial-js/logo-new.png)

web application framework for node.js
=====================================

- Homepage / [www.partialjs.com](http://partialjs.com)
- Follow partial.js on Twitter [@partialjs](https://twitter.com/partialjs)
- E-shop example: [e-shop written in partial.js and SQLite3](http://eshop.partialjs.com)

***

* Async web framework - [example](https://github.com/petersirka/partial.js/tree/master/examples/async)
* Simple view engine - [example](https://github.com/petersirka/partial.js/tree/master/examples/views)
* Simple routing + support flags ['xhr', 'post', 'get', 'put', 'delete', 'upload', 'json', 'logged', 'unlogged', 'debug'] - [example](https://github.com/petersirka/partial.js/tree/master/examples/routing)
* Simple cacheing - [http cache example](https://github.com/petersirka/partial.js/tree/master/examples/cache-http), [partial cache example](https://github.com/petersirka/partial.js/tree/master/examples/cache-partial)
* Simple directory structure (controllers, modules, public, logs, tmp, templates, views, resources)
* Simple code structure
* Simple error handling
* Simple cookie manipulation - [example](https://github.com/petersirka/partial.js/tree/master/examples/cookies)
* Simple listing via templates - [example](https://github.com/petersirka/partial.js/tree/master/examples/templating)
* XSS protection
* Share controller functions and models over framework - [example](https://github.com/petersirka/partial.js/tree/master/examples/controller-sharing)
* __Assertion Testing__ - [example](https://github.com/petersirka/partial.js/tree/master/examples/testing)
* Supports custom helpers - [example](https://github.com/petersirka/partial.js/tree/master/examples/View-custom-helper)
* Supports routing to static file for dynamic creating static file - [example](https://github.com/petersirka/partial.js/tree/master/examples/routing)
* Supports controller sharing between other controllers - [example](https://github.com/petersirka/partial.js/tree/master/examples/controller-sharing)
* Supports debug mode with custom settings without cache - [example](https://github.com/petersirka/partial.js/tree/master/examples/config-debug-release)
* Supports file upload - [example](https://github.com/petersirka/partial.js/tree/master/examples/upload-multipart)
* Supports copy&paste custom code between projects - [example](https://github.com/petersirka/partial.js/tree/master/examples/framework-custom)
* __Supports modules__ (module can create route, view, template, content, resource or static CSS/JS file) - [example](https://github.com/petersirka/partial.js/tree/master/examples/framework-modules)
* Supports form data validation - [example](https://github.com/petersirka/partial.js/tree/master/examples/validation)
* Supports simple log writer - [example](https://github.com/petersirka/partial.js/tree/master/examples/logs)
* Supports simple restrictions [example](https://github.com/petersirka/partial.js/tree/master/examples/restrictions-ip)
* Supports serve static files
* Supports HTML minification
* Supports JavaScript compress
* Supports JavaScript dynamic compress in views - [example](https://github.com/petersirka/partial.js/tree/master/examples/views-javascript-compress)
* Supports simple LESS CSS (with compress) - [example](https://github.com/petersirka/partial.js/tree/master/examples/css-less)
* Supports Markdown parser - [example](https://github.com/petersirka/partial.js/tree/master/examples/markdown)
* Supports resources (for multilanguage pages) - [example](https://github.com/petersirka/partial.js/tree/master/examples/localization-resources)
* __Supports prefixes for mobile devices__ - [example](https://github.com/petersirka/partial.js/tree/master/examples/mobile)
* Supports simple SMTP mail sender - [example](https://github.com/petersirka/partial.js/tree/master/examples/email-templating)
* Supports simple mail templating - [example](https://github.com/petersirka/partial.js/tree/master/examples/email-templating)
* Supports custom authorization - [example](https://github.com/petersirka/partial.js/tree/master/examples/authorization)
* Supports simple image processing (resize, crop, blur, sepia, grayscale, etc.)  with GraphicsMagick or ImageMagick - [example](https://github.com/petersirka/partial.js/tree/master/examples/picture-resize)
* Easy adding dynamic META tags in views or controllers - [example](https://github.com/petersirka/partial.js/tree/master/examples/views-meta)
* Easy adding dynamic Settings in views or controllers - [example](https://github.com/petersirka/partial.js/tree/master/examples/views-settings)
* Simple use paypal payment with [node-paypal](https://github.com/petersirka/node-paypal) - [example](https://github.com/petersirka/partial.js/tree/master/examples/paypal)
* Supports simple paging builder - [example](https://github.com/petersirka/partial.js/tree/master/examples/paging)
* Supports live usage information - [example](https://github.com/petersirka/partial.js/tree/master/examples/framework-usage)
* Supports dynamic stop server - [example](https://github.com/petersirka/partial.js/tree/master/examples/framework-stop)
* Supports verification of framework - [example](https://github.com/petersirka/partial.js/tree/master/examples/framework-verification)
* Supports simple SQLite ORM, must be installed [note-sqlite3](https://github.com/developmentseed/node-sqlite3)
* __Supports backup and restore website__ - [example](https://github.com/petersirka/partial.js/tree/master/examples/backup-restore)
* About 8 000 lines of JavaScript code, all files have 300 kB
* __No dependencies__
* [More examples](https://github.com/petersirka/partial.js/tree/master/examples)
* [Documentation](http://www.partialjs.com/documentation/)

***

* CouchDB client for node.js - https://github.com/petersirka/node-couchdb
* MongoDB (www.mongolab.com) REST client for node.js - https://github.com/petersirka/node-mongolab
* HTTP-RDBMS REST node.js client for partial.js (MySQL, SQL Server, OleDB, ODBC) - https://github.com/petersirka/node-rdbms

> I am still improving my english. Please do not hesitate to contact me in any contradictions.

***

## Simple eshop example with partial.js and SQLite 3
http://eshop.partialjs.com

## partial.js homepage
http://partialjs.com

## partial.js documentation
http://partialjs.com/documentation/

***

## Run your website:

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

## Create empty project from terminal

```text
$ mkdir newproject
$ cd newproject
$ partial.js
```

or

```text
$ partial.js /users/petersirka/desktop/newproject/
```

***

## Plans

> I want perfect and stability web application framework. Currently is framework in testing mode and stable version will be in short time.

## Simple example

> index.js

```js
var framework = require('partial.js');
var http = require('http');

var port = parseInt(process.argv[2] || '8000');
var debug = true;

framework.run(http, debug, port);
console.log("http://127.0.0.1:{0}/".format(port));
```

> controllers / global.js

```js
exports.install = function(framework) {
	framework.route('/', viewHomepage);
	// framework.route('/registration/', viewRegistration, ['xhr', 'post']);
	// framework.route('/products/{category}/', viewProducts);
	// framework.route('/products/{category}/{subcategory}/', viewProducts);
	// framework.route('/user/', viewUser, ['logged']);
};

function viewHomepage() {
	var self = this;
	
	if (self.xhr) {
		self.json({ greeting: 'Hello world!' });
		return;
	}

	self.repository.title = 'Web application framework';
	self.view('homepage', { name: 'Peter' });
}
```

> views / _layout.html

```html
<!DOCTYPE html>
<html>
<head>
    @{meta}
    <meta charset="utf-8" />
	<meta http-equiv="X-UA-Compatible" content="IE=10" />
	<meta name="format-detection" content="telephone=no"/>
	<meta name="viewport" content="width=1024, user-scalable=yes" />
	<meta name="robots" content="all,follow" />
	@{css('default.css')}
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
	@{js('default.js')}
	@{favicon('favicon.png')}
</head>
<body>
	<div class="content">
		@{body}
	</div>
</body>
</html>
```

> views / homepage.html

```html
@{meta('My Homepage', 'My Homepage description', 'My Homepage keywords')}

<h1>@{repository.title}</h1>
Welcome @{model.name}!
```

> RESULT

```html

<!DOCTYPE html>
<html>
<head>
    <title>My Homepage</title>
    <meta name="description" content="My Homepage description" />
    <meta name="keywords" content="My Homepage keywords" />
    <meta charset="utf-8" />
	<meta http-equiv="X-UA-Compatible" content="IE=10" />
	<meta name="format-detection" content="telephone=no"/>
	<meta name="viewport" content="width=1024, user-scalable=yes" />
	<meta name="robots" content="all,follow" />
	<link rel="stylesheet" href="/css/default.css" />
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
	<script type="text/javascript" src="/js/default.js" ></script>
	<link rel="shortcut icon" href="/favicon.png" type="image/png" />
	<link rel="icon" href="/favicon.png" type="image/png" />
</head>
<body>
	<div class="content">
		<h1>Web application framework</h1>		
		Welcome Peter!
	</div>
</body>
</html>

```

## The MIT License

Copyright (c) 2012-2013 Peter Širka <petersirka@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Contact

[www.petersirka.sk](http://www.petersirka.sk)
