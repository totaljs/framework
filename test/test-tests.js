var framework = require('../index');
framework.http('debug', { 'port': 8001 });

setTimeout(function() {
    framework.stop();
}, 4000);