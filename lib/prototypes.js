var http = require('http');

var request = http.IncomingMessage.prototype;
request.formGET = {};
request.formPOST = {};
request.formFiles = {};
request.buffer = {};
request.isAjax = false;
request.uri = {};
request.flags = [];
request.session = {};

var response = http.ServerResponse.prototype;
response.isFlush = false;