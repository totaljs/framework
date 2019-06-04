require('../../index');

F.load(true, ['definitions']);

F.on('ready', function() {
    F.send('assert');
    F.stop();
});