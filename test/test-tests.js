var self = {};
var message = [];

self.headers = { 'neviem': 'kokot' };

var arr = Object.keys(self.headers);
for (var i = 0, length = arr.length; i < length; i++)
	message.push(arr[i] + ': ' + self.headers[arr[i]]);

console.log(message);