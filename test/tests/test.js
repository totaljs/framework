exports.priority = 2;

TEST('validation assert', function() {
	FAIL('1' !== '2');
	TEST('validation assert inline', function() {
		FAIL('5' !== '5', 'TO JE OK');
	});
});

TEST('validation assert.ok', function() {
	FAIL(false);
});
