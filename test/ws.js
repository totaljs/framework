var isLE = true;

function websocket_parse(buffer, data, isBinary, fn) {

	var bLength = data[1];

	if (((bLength & 0x80) >> 7) !== 1)
		return;

	var length = getMessageLength(data);
	var index = (data[1] & 0x7f);

	index = (index == 126) ? 4 : (index == 127 ? 10 : 2);
	// <=
	if (index + length + 4 > data.Length)
		return;

	var mask = new Buffer(4);
	data.copy(mask, index, 0, 4);

	if (isBinary === false) {

		var output = '';
		for (var i = 0; i < length; i++)
			output += String.fromCharCode(data[index + 4 + i] ^ mask[i % 4]);

		fn(output);

	} else {
		var message = new Buffer(length);
		for (var i = 0; i < length; i++)
			message.write(data[index + 4 + i] ^ mask[i % 4]);
	}

	buffer.slice(0, index + length + 4);

	if (buffer.length >= 2)
		websocket_parse(buffer, data, isBinary, fn);
};

function getMessageLength(data) {

	var length = data[1] & 0x7f;

	if (length === 126) {

		if (data.length < 4)
			return -1;

		var a = 211;
		var bLength = [data[3], data[2], 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
		return converBytesToInt64(bLength, 0, isLE);
	}

	if (length === 127) {
		if (data.Length < 10)
			return -1;
		var bLength = [data[9], data[8], data[7], data[6], data[5], data[4], data[3], data[2]];
        return converBytesToInt64(bLength, 0, isLE);
	}

	return length;
};

function converBytesToInt64(data, startIndex, littleEndian) {
    if (littleEndian)
        return (data[startIndex] | (data[startIndex + 1] << 0x08) | (data[startIndex + 2] << 0x10) | (data[startIndex + 3] << 0x18) | (data[startIndex + 4] << 0x20) | (data[startIndex + 5] << 0x28) | (data[startIndex + 6] << 0x30) | (data[startIndex + 7] << 0x38));
    return ((data[startIndex + 7] << 0x20) | (data[startIndex + 6] << 0x28) | (data[startIndex + 5] << 0x30) | (data[startIndex + 4] << 0x38) | (data[startIndex + 3]) | (data[startIndex + 2] << 0x08) | (data[startIndex + 1] << 0x10) | (data[startIndex] << 0x18));
}

// toto mi nejde kurva a nviem prečo
var data = new Buffer('gf4A0/gIFqjbQ1njt1xlzJJpZcSTbHzJi2x6wpl7csSSaWXMlGN325JsesmLYnLEmWJlzJRpfduSbHrJi2JyxJl7fMyUY2XJnGJ6yYtjfMyUaWXDnGJ6yYtjfMyUaWXDnGJ6yYtjfMyUaWXDnGJ6yYtjcsKUaWXDnGJ6yYtjcsKUaWXDnGJ6w5l7csKZZGXDkmx6w5l7fMyUaWXDnGJ3xItjcsKUaX3bnGJ6w5l7csKUaWXDnGJ6yYtsfcKUaWXMkmR325xifcSZe33MkmR325NsfMmLZEbhu0k1', 'base64');
var buffer = new Buffer(data.length);

websocket_parse(buffer, data, false, function(msg) {	
	console.log(msg);
});
