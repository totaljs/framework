require('../index');

var flow = FLOWSTREAM();

flow.register('trigger', function(self) {

	self.message = function(message) {
		console.log('trigger:', message.data);
		message.data.value += 5;
		message.send(1); // send output 1
		message.send(0); // send output 0
	};

}, { operator: '>', value: 3 });

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
		message.send(1); // send output 1
		message.send(0); // send output 0
	};

}, { operator: '>', value: 3 });

flow.register('something', 'instance.message=function(message){console.log("NOFUCK",message.data);};');

flow.register('sms', function(self) {

	self.connect = function() {
		console.log('connect:', self.id);
	};

	self.message = function(message) {
		message.data = message.options;
		console.log('SMS send:', message.input, message.data, message.options);
		setTimeout(function() {
			message.destroy();
		}, 500);
	};

}, { operator: '>', value: 3 });

flow.use('{"COM1":{"component":"trigger","connections":{"1":[{"id":"COM2","index":"0"}],"0":[{"id":"COM3","index":"0"}]}},"COM2":{"component":"condition"},"COM3":{"component":"sms","options":{"message":"EMBEDDED FLOW IS ALIVE"}}}', console.log);

// flow.trigger2('trigger__0', { value: 2 })
flow.trigger('COM1__0', { value: 2 }).on('message', function(msg) {
	console.log('MSG --->', msg.id, msg.fromid, msg.toid);
}).on('end', function(msg) {
	console.log('END', msg.data);
});