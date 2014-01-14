
function refresh() {

	// Documentation: http://docs.totaljs.com/Framework/#framework.worker
	// workers/weather.js will runs in other process
	var worker = framework.worker('weather', 'current', 5000);

	// worker === http://nodejs.org/api/child_process.html#child_process_class_childprocess
	worker.on('message', function(obj) {
		// console.log(obj);
		framework.global.weather = obj;
	});

}

setInterval(refresh, 5000);
framework.once('load', refresh);