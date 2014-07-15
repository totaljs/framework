var Utils = require('../utils');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

Utils.request('https://modules.totaljs.com/webcounter/v1.00/webcounter.js', ['get'], function(err, data) {
    console.log(err, data);
});