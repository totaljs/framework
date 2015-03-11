var framework = require('../index');
//framework.http('debug', { 'port': 8001 });

/*
setTimeout(function() {
    framework.stop();
}, 4000);
*/
var interval = 0;
var t = setInterval(function() {

    if (interval > 50)
        clearInterval(t);

    console.log('--->', interval);

    (function(interval) {
        U.queue('test', 2, function(next) {
            console.log(interval);
            setTimeout(function() {
                next();
            }, 1000);
        });
    })(interval++);

}, 100);