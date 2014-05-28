var framework = require('../index');
var http = require('http');
framework.run(http, false, 8001);

/*
setTimeout(function() {
    utils.request('http://127.0.0.1:8001/views/', ['get'], function(err) {
        framework.stop();
    });
}, 500);*/