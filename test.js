var line = '{www.petersirka.sk}. [keyword (a asd asd raa)] ![IMG](obrazok.jpg#200x300) asd [poradna] (pc.poradna.net) lkjasd lja [Google.sk](www.google.sk) alebo <www.yahoo.com> alebo [Server.sk]: www.server.sk aa <www.motoride.sk>';

var output = $parseKeyword(line, function(text, value) {
	return text + '#' + value + '#';
});

function $parseKeyword(line, callback) {

	if (callback === null)
		return line;

	var output = line;
    var matches = line.match(/(\[.*?\]|\{.*?\})/g);

    if (matches === null)
        return output;

    matches.forEach(function(o) {

    	var index = o.indexOf('(');
    	var text = '';
    	var value = '';
    	var type = o[0] === '{' ? '{}' : '[]';

    	if (index !== -1) {

    		text = o.substring(1, index).trim();
    		value = o.substring(index + 1, o.length - 2);

    	} else
    		text = o.substring(1, o.length - 1);

    	output = output.replace(o, callback(text, value, type));
    });

    return output;
};

console.log(output);

