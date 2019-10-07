require('../index');

var flow = FLOWSTREAM();

flow.register('condition', function(self) {

	self.install = function() {
		console.log('install:', self.id);
	};

	self.ondata = function(message) {
		console.log('message:', message.data);
		message.data.value += 5;
		message.send(1);
	};

}, { operator: '>', value: 3 });

flow.register('something', 'exports.ondata=function(message){console.log("NOFUCK",message.data);};');

flow.register('sms', function(self) {

	self.install = function() {
		console.log('install:', self.id);
	};

	self.ondata = function(message) {
		console.log('SMS send:', message.input, message.data, message.options);
		setTimeout(function() {
			message.destroy();
		}, 500);
	};

}, { operator: '>', value: 3 });

flow.use('{"COM1":{"component":"condition","connections":{"1":[{"id":"COM2","index":"0"}]}},"COM2":{"component":"something","options":{"message":"EMBEDDED FLOW IS ALIVE"}}}');
flow.trigger('COM1__0', { value: 2 });

setTimeout(function() {
	console.log(flow.meta.flow, flow.meta.messages);
}, 3000);