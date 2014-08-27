var Utils = require('../utils');
global.builders = require('../builders');
global.utils = require('../utils');

/*
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

Utils.request('https://modules.totaljs.com/webcounter/v1.00/webcounter.js', ['get'], function(err, data) {
    console.log(err, data);
});
*/

function onValidation(name, value, path) {
    switch (name) {
        case 'firstName':
            return value.length > 0;
        case 'lastName':
            return 'lastName-error';
        case 'age':
            return utils.isValid(utils.parseInt(value) > 0, 'age-error');
    }
}

builders.schema('1', { name: 'string', join: '[2]' });

builders.schema('2', {
    age: Number
}, function(name) {
    if (name === 'age')
        return -1;
});

var error = Utils.validate({ name: 'Name', join: [{ age: 'A' }, { age: 4 }]}, '1', onValidation);
console.log(error);