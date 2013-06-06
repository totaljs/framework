exports.install = function(framework) {
	framework.route('/', upload, ['mixed']);
};

function upload(file) {
	console.log(file);
}