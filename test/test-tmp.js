require('../index');

NEWTASK('cardav', function(push) {

	push('getBooks', function($) {
		console.log('----- getBooks');

		$.value.books = [];
		$.next('getContacts');
	});

	push('getContacts', function($) {

		console.log('----- getContacts');

		var current = $.value.books.shift();
		if (current == null) {
			// no books
			$.success();
			return;
		}

		// Download contacts
		// ...
		$.value.contacts = [];
		$.next('synchronize');
	});

	push('synchronize', function($) {

		console.log('----- synchronize');

		// synchronize with DB
		$.value.contacts;

		// modify DB

		// process next contacts
		$.next('getContacts');
	});

});

TASK('cardav', 'getBooks', function(err, response) {
	console.log(err, response);
});