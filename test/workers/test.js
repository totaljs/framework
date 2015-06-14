require('../../index');

F.load(true, ['definitions'], '/Volumes/Development/github/framework/test/');

F.on('ready', function() {
    F.send('assert');
    F.stop();
});