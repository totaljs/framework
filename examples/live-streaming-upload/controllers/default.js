exports.install = function(framework) {
	framework.route('/', upload, { flags: ['mmr'], length: 100000 });
};

function upload(file) {
	console.log(file);

	// cancel upload
	// this.close();
	
}