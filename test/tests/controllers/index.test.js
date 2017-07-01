TEST('plain get', '/get', function(builder) {
	builder.exec(function(err, response) {
		FAIL(JSON.stringify(response) !== '{}');
		FAIL(JSON.stringify(response) !== '{OK}', 'NEVIEM');
	});
});

TEST('upload', '/upload', function(builder) {
	builder.file('file1', '/users/petersirka/desktop/aaa.txt');
	builder.exec(function(err, response) {
		OK(response.name === 'aaa.txt');
	});
});