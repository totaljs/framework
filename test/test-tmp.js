require('../index');
// NOSQLMEMORY('test');
// NOSQL('test').find2().take(10).callback(console.log);
// NOSQL('test').count().callback(console.log);
// NOSQL('test').remove().between('index', 0, 10).callback(console.log).backup('fet');
// NOSQL('test').remove().between('index', 1, 3).callback(console.log);
// NOSQL('test').on('modify', console.log);
// NOSQL('test').update({ name: GUID(5) }).between('index', 1, 3).callback(console.log);

CONF['table.test'] = 'index:number | name:string';

TABLE('test').find().take(10).skip(10).callback(console.log);

// TABLE('test').modify({ name: GUID(5) }).between('index', 3, 5).callback(console.log);
// TABLE('test').remove().between('index', 0, 2).callback(console.log);

/*
for (var i = 0; i < 100; i++)
	TABLE('test').insert({ index: i });
*/