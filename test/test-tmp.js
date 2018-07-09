require('../index');

var insert = false;
var update = false;
var read = false;
var link = true;

KVALUE('skuska').ready(function() {
	// this.insert('Si kokot?', console.log);
	//this.count(console.log);
	//this.read(20303, console.log);


	if (insert) {
		for (var i = 0; i < 10; i++)
			KVALUE('skuska').insert({ id: i + 1, guid: GUID(100) });
	}

	if (link) {
		// 11
		//KVALUE('skuska').setLinkId(null, 4, 2, console.log);
		//KVALUE('skuska').setLinkId(11, 3, 6, console.log);
		//KVALUE('skuska').read(11, console.log);
		//KVALUE('skuska').link(2, 6, 1, console.log);
		KVALUE('skuska').traverse(2, console.log);
	}

	if (read) {
		KVALUE('skuska').read(2, console.log);
	}

	if (update) {
		KVALUE('skuska').update(2, { id: 2, guid: GUID(100), kokotaris: 99 }, console.log);
	}

	// KVALUE('skuska').read(2, console.log);
	//KVALUE('skuska').link(2, 9, console.log);
});

/*
KEYVALUE('skuska').traverse(340304, function(err, val, index) {
	console.log(val);
	if (index === 6)
		return false;
});
*/
/*

KEYVALUE('skuska').ready(function() {
	for (var i = 0; i < 1000000; i++)
		KEYVALUE('skuska').put({ id: i + 1, guid: GUID(100) });
});
*/