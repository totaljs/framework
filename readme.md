![partial.js logo](http://petersirka.sk/partial-js/logo-new.png)

web application framework for node.js
=====================================

- Homepage / [www.partialjs.com](http://partialjs.com)
- Follow partial.js on Twitter [@partialjs](https://twitter.com/partialjs)
- __Blog example__: [new example - blog written in partial.js and NoSQL embedded database (without installation)](http://blog.partialjs.com)
- __E-shop example__: [new example - e-shop written in partial.js and NoSQL embedded database (without installation)](http://eshop.partialjs.com)
- Documentation: [partial.js documentation](http://partialjs.com/documentation/)

***

* Async web framework - [example: async methods](https://github.com/petersirka/partial.js/tree/master/examples/async)
* Simple view engine - [example: view engine](https://github.com/petersirka/partial.js/tree/master/examples/views)
* Simple routing + support flags ['xhr', 'post', 'get', 'put', 'delete', 'upload', 'json', 'logged', 'unlogged', 'debug'] - [example: flags](https://github.com/petersirka/partial.js/tree/master/examples/routing)
* Simple cacheing - [http cache example](https://github.com/petersirka/partial.js/tree/master/examples/cache-http), [partial cache example](https://github.com/petersirka/partial.js/tree/master/examples/cache-partial)
* Simple directory structure (controllers, modules, public, logs, tmp, templates, views, resources)
* Simple code structure
* Simple error handling
* Simple cookie manipulation - [example: cookies](https://github.com/petersirka/partial.js/tree/master/examples/cookies)
* Simple listing via templates - [example: listing via templates](https://github.com/petersirka/partial.js/tree/master/examples/templating)
* XSS protection
* Share controller functions and models over framework - [example](https://github.com/petersirka/partial.js/tree/master/examples/controller-sharing)
* __Assertion Testing__ - [example: testing](https://github.com/petersirka/partial.js/tree/master/examples/testing)
* Supports custom helpers - [example: custom helpers](https://github.com/petersirka/partial.js/tree/master/examples/View-custom-helper)
* Supports routing to static file for dynamic creating static file - [example: routing](https://github.com/petersirka/partial.js/tree/master/examples/routing)
* Supports controller sharing between other controllers - [example](https://github.com/petersirka/partial.js/tree/master/examples/controller-sharing)
* Supports debug mode with custom settings without cache - [example: debug mode](https://github.com/petersirka/partial.js/tree/master/examples/config-debug-release)
* Supports file upload - [example: file upload](https://github.com/petersirka/partial.js/tree/master/examples/upload-multipart)
* Supports copy&paste custom code between projects - [example](https://github.com/petersirka/partial.js/tree/master/examples/framework-custom)
* __Supports modules__ (module can create route, view, template, content, resource or static CSS/JS file) - [example: module](https://github.com/petersirka/partial.js/tree/master/examples/framework-modules)
* Supports form data validation - [example: validation](https://github.com/petersirka/partial.js/tree/master/examples/validation)
* Supports simple log writer - [example: logs](https://github.com/petersirka/partial.js/tree/master/examples/logs)
* Supports simple restrictions [example: restriction](https://github.com/petersirka/partial.js/tree/master/examples/restrictions-ip)
* Supports serve static files
* __Supports streaming static files__ - implemented Accept-Ranges
* Supports HTML minification
* Supports JavaScript compress
* Supports JavaScript dynamic compress in views - [example: dynamic JavaScript compress](https://github.com/petersirka/partial.js/tree/master/examples/views-javascript-compress)
* Supports simple LESS CSS (with compress) - [example: LESS CSS](https://github.com/petersirka/partial.js/tree/master/examples/css-less)
* Supports Markdown parser - [example: Markdown](https://github.com/petersirka/partial.js/tree/master/examples/markdown)
* Supports resources (for multilanguage pages) - [example: resources](https://github.com/petersirka/partial.js/tree/master/examples/localization-resources)
* __Supports prefixes for mobile devices__ - [example: prefixes](https://github.com/petersirka/partial.js/tree/master/examples/mobile)
* Supports simple SMTP mail sender - [example: SMTP mail sender](https://github.com/petersirka/partial.js/tree/master/examples/email-templating)
* Supports simple mail templating - [example: mail templating](https://github.com/petersirka/partial.js/tree/master/examples/email-templating)
* Supports custom authorization - [example: authorization](https://github.com/petersirka/partial.js/tree/master/examples/authorization)
* Supports simple image processing (resize, crop, blur, sepia, grayscale, etc.)  with GraphicsMagick or ImageMagick - [example](https://github.com/petersirka/partial.js/tree/master/examples/picture-resize)
* Easy adding dynamic META tags in views or controllers - [example: meta tags](https://github.com/petersirka/partial.js/tree/master/examples/views-meta)
* Easy adding dynamic Settings in views or controllers - [example: view settings](https://github.com/petersirka/partial.js/tree/master/examples/views-settings)
* Simple use paypal payment with [node-paypal project](https://github.com/petersirka/node-paypal) - [example: paypal](https://github.com/petersirka/partial.js/tree/master/examples/paypal)
* Supports simple pagination builder - [example: pagination builder](https://github.com/petersirka/partial.js/tree/master/examples/paging)
* Supports live usage information - [example: framework usage](https://github.com/petersirka/partial.js/tree/master/examples/framework-usage)
* Supports dynamic stop server - [example: stop server](https://github.com/petersirka/partial.js/tree/master/examples/framework-stop)
* Supports verification of framework - [example: verification](https://github.com/petersirka/partial.js/tree/master/examples/framework-verification)
* __Supports backup and restore website__ - [example: backup & restore](https://github.com/petersirka/partial.js/tree/master/examples/backup-restore), [auto-backup example](https://github.com/petersirka/partial.js/tree/master/examples/auto-backup)
* About 8 000 lines of JavaScript code, all files have 300 kB
* __No dependencies__
* [More examples](https://github.com/petersirka/partial.js/tree/master/examples)
* [Documentation](http://www.partialjs.com/documentation/)
* __Supports internal NoSQL embedded database__ - [example: authorization](https://github.com/petersirka/partial.js/tree/master/examples/authorization) or [example: contact form](https://github.com/petersirka/partial.js/tree/master/examples/contact-form)


## partial.js NoSQL embedded database

[![NoSQL embedded database](http://partialjs.com/exports/nosql-logo.png)](https://github.com/petersirka/nosql)

* Small and simple data storage for small web site
* Written in JavaScript
* Asynchronous insert, read, update, remove
* Easy filtering documents
* [partial.js example: authorization](https://github.com/petersirka/partial.js/tree/master/examples/authorization) or [partial.js example: contact form](https://github.com/petersirka/partial.js/tree/master/examples/contact-form)
* __No dependencies__
* [NoSQL embedded database project on GitHub](https://github.com/petersirka/nosql)


## partial.js Backup & Restore

[![Backup & Restore](http://partialjs.com/exports/backup-logo.png)](https://github.com/petersirka/backup)

* Written in JavaScript
* Easy backup & Easy Restore
* Small and effective
* Backup file is text file and all files are compressed via GZIP
* [partial.js backup & restore example](https://github.com/petersirka/partial.js/tree/master/examples/backup-restore), [partial.js auto-backup example](https://github.com/petersirka/partial.js/tree/master/examples/auto-backup)
* __No dependencies__
* [Backup & Restore project on GitHub](https://github.com/petersirka/backup)


***

## partial.js presentation

[![partial.js example](http://partialjs.com/img/video.jpg)](http://www.youtube.com/watch?v=3GMQJki82Lo)

***


## Install step by step partial.js

```
$ sudo npm install -g partial.js
```
```
$ mkdir mywebsite
$ cd mywebsite
$ partial.js
```
```
$ node keepalive 8080
```
```
$ open http://127.0.0.1:8080
```

## Interesting modules

* Simple __Backup/Restore__ module for node.js - https://github.com/petersirka/backup
* __PayPal__ Express Checkout for node.js - https://github.com/petersirka/node-payment-paypal
* CouchDB client for node.js - https://github.com/petersirka/node-couchdb
* MongoDB (www.mongolab.com) REST client for node.js - https://github.com/petersirka/node-mongolab
* HTTP-RDBMS REST node.js client for partial.js (MySQL, SQL Server, OleDB, ODBC) - https://github.com/petersirka/node-rdbms

*** 

> I am still improving my english.

## The MIT License

Copyright (c) 2012-2013 Peter Širka <petersirka@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Contact

[www.petersirka.sk](http://www.petersirka.sk)
