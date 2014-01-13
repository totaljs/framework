var fs = require('fs');

exports.install = function(framework) {
	framework.route('/', view_markdown);
    framework.route('/usage/', view_usage);
}

function view_markdown() {

	var self = this;
	var markdown = self.module('markdown').init();

	markdown.onEmbedded = function(name, value) {
		switch (name) {
			case 'javascript':
				return '<pre>{0}</pre>'.format(value.join('\n').encode());
		}
	}

	// Below delegates are defined in markdown class as default
	
	markdown.onList = function(items) {

        var length = items.length;
        var output = '';

        for (var i = 0; i < length; i++) {
            var item = items[i];
            output += '<li>' + item.value + '</li>';
        }

        return '<ul>' + output + '</ul>';

    };

    markdown.onKeyValue = function(items) {

        var length = items.length;
        var output = '';

        for (var i = 0; i < length; i++) {
            var item = items[i];
            output += '<dt>' + item.key + '</dt><dd>' + item.value + '</dd>';
        }

        return '<dl>' + output + '</dl>';
    };

    markdown.onLine = function(line) {
        return '<p>' + line + '</p>';
    };

    markdown.onParagraph = function(type, lines) {
        return '<p class="paragraph">' + lines.join('<br />') + '</p>';
    };

    markdown.onBreak = function(type) {

    	switch (type) {

    		case '\n':
    			return '<br />';
    		case '***':
    		case '---':
    			return '<hr />';
    	}

    	return '';
    };

	markdown.onTitle = function(type, value) {
		switch (type) {
			case '#':
				return '<h1>' + value + '</h1>';
			case '##':
				return '<h2>' + value + '</h2>';
			case '###':
				return '<h3>' + value + '</h3>';
			case '####':
				return '<h4>' + value + '</h4>';
			case '#####':
				return '<h5>' + value + '</h5>';
		}
	}

	markdown.onImage = function(alt, src, width, height, url) {
        var tag = '<img src="' + src + '"' + (width ? ' width="' + width + '"' : '') + (height ? ' height="' + height + '"' : '') + ' alt="' + alt +'" border="0" />';

        if (url)
            return '<a href="' + url + '">' + tag + '</a>';

        return tag;
	}

	markdown.onFormat = function(type, value) {

        switch (type) {
            case '**':
                return '<em>' + value + '</em>';
            case '*':
                return '<i>' + value + '</i>';
            case '__':
                return '<strong>' + value + '</strong>';
            case '_':
                return '<b>' + value + '</b>';
        }

        return value;
    };

    markdown.onLink = function(text, url) {

        if (url.substring(0, 7) !== 'http://' && url.substring(0, 8) !== 'https://')
            url = 'http://' + url;

        return '<a href="' + url + '">' + text + '</a>';
    };

	fs.readFile(self.path.public('readme.md'), function(err, data) {

		if (err) {
			self.view404();
			return;
		}

		self.view('reader', { body: markdown.load(data.toString()) });
	});
}

function view_usage() {
    var markdown = md.init();
    self.view('reader', { body: markdown.load(framework.usage(true)) });
}