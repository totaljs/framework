require('../index');

var md = `# Peter je kráľ

asdljasdlasjdlaj lsajd lsajd lsajskl dsalk jklsa

- a
- b
- c
	- d
	- e
	- f
- g
- h
`;

(function Markdown() {

	var links = /(!)?\[.*?\]\(.*?\)/g;
	var imagelinks = /\[!\[.*?\]\(.*?\)\]\(.*?\)/g;
	var format = /__.*?__|_.*?_|\*\*.*?\*\*|\*.*?\*|~~.*?~~|~.*?~/g;
	var ordered = /^([a-z|0-9]{1,2}\.\s)|-\s/i;
	var orderedsize = /^(\s|\t)+/;
	var code = /`.*?`/g;
	var encodetags = /<|>/g;
	var formatclean = /_|\*|~/g;
	var regid = /[^\w]+/g;
	var regdash = /-{2,}/g;
	var regtags = /<\/?[^>]+(>|$)/g;

	var encode = function(val) {
		return '&' + (val === '<' ? 'lt' : 'gt') + ';';
	};

	function markdown_code(value) {
		return '<code>' + value.substring(1, value.length - 1) + '</code>';
	}

	function markdown_imagelinks(value) {
		var end = value.indexOf(')') + 1;
		var img = value.substring(1, end);
		return '<a href="' + value.substring(end + 2, value.length - 1) + '">' + markdown_links(img) + '</a>';
	}

	function markdown_table(value, align, ishead) {

		var columns = value.substring(1, value.length - 1).split('|');
		var builder = '';

		for (var i = 0; i < columns.length; i++) {
			var column = columns[i].trim();
			if (column.charAt(0) == '-')
				continue;
			var a = align[i];
			builder += '<' + (ishead ? 'th' : 'td') + (a && a !== 'left' ? (' class="' + a + '"') : '') + '>' + column + '</' + (ishead ? 'th' : 'td') + '>';
		}

		return '<tr>' + builder + '</tr>';
	}

	function markdown_links(value) {
		var end = value.lastIndexOf(']');
		var img = value.charAt(0) === '!';
		var text = value.substring(img ? 2 : 1, end);
		var link = value.substring(end + 2, value.length - 1);
		return img ? ('<img src="' + link + '" alt="' + text + '" class="img-responsive" border="0" />') : ('<a href="' + link + '">' + text + '</a>');
	}

	function markdown_format(value) {
		switch (value[0]) {
			case '_':
				return '<strong>' + value.replace(formatclean, '') + '</strong>';
			case '*':
				return '<em>' + value.replace(formatclean, '') + '</em>';
			case '~':
				return '<strike>' + value.replace(formatclean, '') + '</strike>';
		}
		return value;
	}

	function markdown_id(value) {

		var end = '';
		var beg = '';

		if (value.charAt(0) === '<')
			beg = '-';

		if (value.charAt(value.length - 1) === '>')
			end = '-';

		return (beg + value.replace(regtags, '').toLowerCase().replace(regid, '-') + end).replace(regdash, '-');
	}

	String.prototype.markdown = function() {
		var lines = this.split('\n');
		var builder = [];
		var ul = [];
		var table = false;
		var iscode = false;
		var ishead = false;
		var prev;
		var prevsize = 0;
		var tmp;

		for (var i = 0, length = lines.length; i < length; i++) {

			lines[i] = lines[i].replace(encodetags, encode);

			if (lines[i].substring(0, 3) === '```') {

				if (iscode) {
					builder.push('</code></pre>');
					iscode = false;
					continue;
				}

				iscode = true;
				builder.push('<pre><code class="' + lines[i].substring(3) + '">');
				prev = 'code';
				continue;
			}

			if (iscode) {
				builder.push(lines[i]);
				continue;
			}

			var line = lines[i].replace(imagelinks, markdown_imagelinks).replace(links, markdown_links).replace(format, markdown_format).replace(code, markdown_code);
			if (!line) {
				if (table) {
					table = null;
					builder.push('</tbody></table>');
				}
			}

			if (line === '' && lines[i - 1] === '') {
				builder.push('<br />');
				prev = 'br';
				continue;
			}

			if (line[0] === '|') {
				if (!table) {
					var next = lines[i + 1];
					if (next[0] === '|') {
						table = [];
						var columns = next.substring(1, next.length - 1).split('|');
						for (var j = 0; j < columns.length; j++) {
							var column = columns[j].trim();
							var align = 'left';
							if (column.charAt(column.length - 1) === ':')
								align = column[0] === ':' ? 'center' : 'right';
							table.push(align);
						}
						builder.push('<table class="table table-bordered"><thead>');
						prev = 'table';
						ishead = true;
						i++;
					} else
						continue;
				}

				if (ishead)
					builder.push(markdown_table(line, table, true) + '</thead><tbody>');
				else
					builder.push(markdown_table(line, table));
				ishead = false;
				continue;
			}

			if (line.charAt(0) === '#') {

				if (line.substring(0, 2) === '# ') {
					tmp = line.substring(2).trim();
					builder.push('<h1 id="' + markdown_id(tmp) + '">' + tmp + '</h1>');
					prev = '#';
					continue;
				}

				if (line.substring(0, 3) === '## ') {
					tmp = line.substring(3).trim();
					builder.push('<h2 id="' + markdown_id(tmp) + '">' + tmp + '</h2>');
					prev = '##';
					continue;
				}

				if (line.substring(0, 4) === '### ') {
					tmp = line.substring(4).trim();
					builder.push('<h3 id="' + markdown_id(tmp) + '">' + tmp + '</h3>');
					prev = '###';
					continue;
				}

				if (line.substring(0, 5) === '#### ') {
					tmp = line.substring(5).trim();
					builder.push('<h4 id="' + markdown_id(tmp) + '">' + tmp + '</h4>');
					prev = '####';
					continue;
				}

				if (line.substring(0, 6) === '##### ') {
					tmp = line.substring(6).trim();
					builder.push('<h5 id="' + markdown_id(tmp) + '">' + tmp + '</h5>');
					prev = '#####';
					continue;
				}
			}

			var tmp = line.substring(0, 3);

			if (tmp === '---' || tmp === '***') {
				prev = 'hr';
				builder.push('<hr class="line' + (tmp.charAt(0) === '-' ? '1' : '2') + '" />');
				continue;
			}

			if (line[0] === '>' && line.substring(0, 2) === '> ') {
				builder.push('<blockquote>' + line.substring(2).trim() + '</blockquote>');
				prev = '>';
				continue;
			}

			var tmpline = line.trim();

			if (ordered.test(tmpline)) {

				var size = line.match(orderedsize);
				if (size)
					size = size[0].length;
				else
					size = 0;

				var append = false;

				if (prevsize !== size) {
					// NESTED
					if (size > prevsize) {
						prevsize = size;
						append = true;
						var index = builder.length - 1;
						builder[index] = builder[index].substring(0, builder[index].length - 5);
						prev = '';
					} else {
						// back to normal
						prevsize = size;
						builder.push('</' + ul.pop() + '>');
					}
				}

				var type = tmpline.charAt(0) === '-' ? 'ul' : 'ol';
				if (prev !== type) {
					var subtype;
					if (type === 'ol')
						subtype = tmpline.charAt(0);
					builder.push('<' + type + (subtype ? (' type="' + subtype + '"') : '') + '>');
					ul.push(type + (append ? '></li' : ''));
					prev = type;
					prevsize = size;
				}

				builder.push('<li>' + (type === 'ol' ? tmpline.substring(tmpline.indexOf('.') + 1) : tmpline.substring(2)).trim() + '</li>');

			} else {
				ul.length && builder.push('</' + ul.pop() + '>');
				line && builder.push('<p>' + line.trim() + '</p>');
				prev = 'p';
			}
		}

		for (var i = 0; i < ul.length; i++)
			builder.push('</' + ul[i] + '>');

		table && builder.push('</tbody></table>');
		iscode && builder.push('</code></pre>');

		return '<div class="markdown">' + builder.join('\n') + '</div>';
	};
})();

console.log(md.markdown());