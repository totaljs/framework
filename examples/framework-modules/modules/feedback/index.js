var helper = require('./helper');
var greeting = '';

exports.install = function (framework) {

	framework.route('/feedback/', feedback, ['xhr', 'post']);

	// create client side JavaScript
	// framework.fs.create.js('feedback.js', 'func' + 'tion feedback() { alert("I am feedback"); }');

	// create client side CSS
	// framework.fs.create.css('feedback.css', 'feedback { padding:5px; font: normal 20px Arial; }');

	// create view file (must exists Views directory)
	// framework.fs.create.view('feedback', '<div>VIEW</div>');

	// create template file (must exists Templates directory)
	// framework.fs.create.template('feedback', '<div>{name}</div>');

	// create content file (must exists Contents directory)
	// framework.fs.create.content('feedback', '<div>static content from Feedback module</div>');

	// create resource (must exists Resources directory)
	// framework.fs.create.resource('feedback', 'hello	: welcome in feedback resource');

	// remove files
	// framework.fs.rm.css('feedback');
	// framework.fs.rm.js('feedback');
	// framework.fs.rm.view('feedback');
	// framework.fs.rm.template('feedback');
	// framework.fs.rm.content('feedback');
	// framework.fs.rm.resource('feedback');

	// get directory path
	// framework.path.public('image.jpg');
	// framework.path.logs();
	// framework.path.temp();
	// framework.path.backup();
	// framework.path.root();

	/*
	
	framework.on('load', function() {
		// all controllers and modules is loaded
	});

	framework.on('controller', function(controller, name) {
		// every request to controller call this event
		console.log(controller.req.ip);
	});

	*/
	
};

exports.onRequest = function() {
	// this method is called every request to route /feedback/
};

exports.greeting = function(value) {
	console.log('From greeting(): ' + value);
	greeting = value;
	return value;
};

function feedback() {
	this.json({ message: helper.toUpper(greeting) });
}