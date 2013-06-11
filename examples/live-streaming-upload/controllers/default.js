exports.install = function(framework) {
	framework.route('/', upload, ['mmr']);
};

function upload(file) {
	console.log(file);

	// cancel upload
	// this.close();
	
}