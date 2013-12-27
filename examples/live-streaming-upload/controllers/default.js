exports.install = function(framework) {
	framework.route('/', upload, { flags: ['mmr'], length: 100000 }); // 1 === 1 kB
};

function upload(file) {

	console.log(file);

	// cancel upload
	// this.close();
	
}