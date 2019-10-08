require('../index');

var flow = FLOWSTREAM();

flow.register('condition', function(self) {

	self.connect = function() {
		console.log('connect:', self.id);
	};

	self.disconnect = function() {
		console.log('disconnect:', self.id);
	};

	self.message = function(message) {
		console.log('message:', message.data);
		message.data.value += 5;
		message.send();
	};

}, { operator: '>', value: 3 });

flow.register('something', 'instance.message=function(message){console.log("NOFUCK",message.data);};');

flow.register('sms', function(self) {

	self.connect = function() {
		console.log('connect:', self.id);
	};

	self.message = function(message) {
		console.log('SMS send:', message.input, message.data, message.options);
		setTimeout(function() {
			message.destroy();
		}, 500);
	};

}, { operator: '>', value: 3 });

flow.use('{"COM1":{"component":"condition","connections":{"1":[{"id":"COM2","index":"0"}],"0":[{"id":"COM2","index":"0"}]}},"COM2":{"component":"something","options":{"message":"EMBEDDED FLOW IS ALIVE"}}}', console.log);
flow.trigger('COM1__0', { value: 2 });

setTimeout(function() {
	console.log(flow);
}, 3000);