require('../index');

F.backup(F.path.root('semtu.package'), ['config-debug', 'my-config.txt', '/workers/'], function(err, filename) {
	console.log(filename);
	F.restore(filename, F.path.root('tmp'));
});