exports.install = function(framework) {
	framework.route('/', upload, { flags: ['mmr'], length: 100000 }); // 1 === 1 kB
};

var files = [];

function upload(file) {

	if (file === null) {
		// END
		// remove uploaded files
		framework.unlink(files);
		return;
	}

	console.log(file);

	// To remove list
	files.push(file.path);

	// cancel upload
	// this.close();

}