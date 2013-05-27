// Copyright Peter Širka, Web Site Design s.r.o. (www.petersirka.sk)
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var utils = require('./utils');
var regEmpty = new RegExp(/^\s/);
var regFormat = /\*{1,2}.*?\*{1,2}|_{1,3}.*?_{1,3}/g;
var regKeyword = /(\[.*?\]|\{.*?\})/g;
var regLink1 = /\<.*?\>+/g;
var regLink2 = /(!)?\[[^\]]+\][\:\s\(]+.*?[^)\s$]+/g;
var regImage = /(\[)?\!\[[^\]]+\][\:\s\(]+.*?[^\s$]+/g;

/*
    Table class
    @columnCount {Number}
    @width {Number}
*/
function Table(columnCount, width) {
    this.columnCount = columnCount || 0;
    this.width = width || 0;
    this.rows = [];
};

/*
    Row class
    @index {Number}
*/
function Row(index) {
    this.index = index || 0;
    this.columns = [];
};

/*
    Column class
    @index {Number}
    @size {Number}
    @value {String}
*/
function Column(index, size, value) {
    this.index = index || 0;
    this.size = size || 0;
    this.value = value || '';
};

/*
    UL class
    @type {String}
    @index {Number}
    @indent {Number}
    @value {String}
*/
function UL(type, index, indent, value) {
    this.type = type || '';
    this.index = index || 0;
    this.indent = indent || 0;
    this.value = value || '';
};

function Markdown() {
    this.block = '===';
    this.name = '';

    /*
        Render line
        @type {String}
        @value {String}
        @index {Number} :: optional
        return {String}
    */
    this.onLine = null;

    /*
        Render paragraph
        @type {String}
        @value {String array}
        @index {Number} :: optional
        return {String}
    */
    this.onLines = null;

    /*
        Render UL
        @ul {UL}
        return {String} :: tag
    */
    this.onUL = null;

    /*
        Render table
        @table {onTable}
        return {String} :: tag
    */
    this.onTable = null;

    /*
        Render link (A)
        @name {String}
        @url {String}
        return {String} :: tag
    */
    this.onLink = null;

    /*
        Render table (EM, STRONG, B, I)
        @type {String}
        @value {String}
        return {String} :: tag
    */
    this.onFormat = null;

    /*
        Render keyword ({}, [])
        @type {String}
        @name {String}
        @value {String}
        return {String} :: tag
    */
    this.onKeyword = null;

    /*
        Render image
        @alt {String}
        @src {String}
        @width {Number}
        @height {Number}
        @url {String} :: optional
        return {String} :: tag
    */
    this.onImage = null;
};

// ======================================================
// FUNCTIONS
// ======================================================

/*
    Internal function
    @text {String}
    @c {String} :: char
    return {Boolean}
*/
function $isFill(text, c) {
    for (var i = 0; i < text.length; i++) {
        if (text[i] !== c)
            return false;
    }
    return true;
};

/*
    Internal function
    @text {String}
    return {String}
*/
function $clean(text) {

    if (utils.isNullOrEmpty(text))
        return '';

    var buffer = '';

    for (var i = 0; i < text.length; i++) {

        var m = text.charCodeAt(i);
        if (m === 13 || m === 10)
            continue;

        buffer += text[i];
    }

    return buffer;
};

/*
    Internal function
    @text {String}
    @c {String} :: char
    return {Number}
*/
function $charCount(text, c) {

    var count = 0;

    for (var i = 0; i < text.length; i++) {
        if (text[i] === c)
            count++;
    }

    return count;
};

/*
    Internal function
    @text {String}
    return {String}
*/
function $nearest(text) {
    var c = text.match(/\w/);

    if (c === null)
        return ' ';

    return c.toString();
};

/*
    Internal function
    @text {String}
    return {String} :: char
*/
function $firstChar(text) {
    return text[0] || '\0';
};

/*
    Internal function
    @c {String} :: char
    return {Boolean}
*/
function $isParagraph(c, cn) {
    return c === '>' || c === '|' || (c === '/' && cn === '/') || (c === '\\' && cn === '\\');
};

/*
    Internal function
    @c {String} :: char
    return {Boolean}
*/
function $isWhite(c) {
    return regEmpty.test(c);
};

/*
    Internal function
    @text {String}
    return {Boolean}
*/
function $isUL(text) {
    if (utils.isNullOrEmpty(text))
        return false;

    var c = $firstChar(text);

    if (c.match(/\W/) === null)
        c = $nearest(text);

    return (c === '-' || c === 'x' || c === '+') && text.indexOf(' ') > -1;
};

/*
    Internal function
    @self {Markdown}
    @text {String}
    return {String}
*/
function $parse(self, text) {

    var index = 0;

    if (self.onLink !== null) {
        text = $parseLink(text, function(title, url) {
            return self.onLink(title, url);
        });
    }

    if (self.onImage !== null) {
        text = $parseImage(text, function(alt, src, width, height, url) {
            return self.onImage(alt, src, width, height, url);
        });
    }

    if (self.onFormat !== null) {
        var match = text.match(regFormat);
        if (match !== null) {
            match.forEach(function(o) {

                if (o === null)
                    return;

                var m = o.toString();

                if (m.length < 3)
                    return;

                var max = 2;
                var isMax = false;

                switch (m[0]) {
                    case '*':
                        isMax = m.substring(0, 2) === '**';

                        if (isMax)
                            max = m.length > 3 ? 4 : m.length;

                        text = text.replace(m, self.onFormat(isMax ? '**' : '*', isMax ? m.substring(2, max) : m.substring(1, m.length - 1)));
                        return;

                    case '_':
                        var count = m.substring(0, 3) === '___' ? 3 : m.substring(0, 2) === '__' ? 2 : 1;
                        text = text.replace(m, self.onFormat(m.substring(0, count), m.substring(count, m.length - count)));
                        return;
                }
            });
        }
    }

    if (self.onKeyword !== null) {
        text = $parseKeyword(text, function(text, value, type) {
            return self.onKeyword(type, text, value);
        });
    }

    return text.trim();
};

/*
    Internal function
    @text {String}
    @callback {Function}
    return {String}
*/
function $parseKeyword(line, callback) {

    if (callback === null)
        return line;

    var output = line;
    var matches = line.match(regKeyword);

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

/*
    Internal function
    @text {String}
    @callback {Function}
    return {String}
*/
function $parseLink(line, callback) {

    var matches = line.match(regLink1);
    var output = line;

    if (matches !== null) {
        matches.forEach(function(o) {
            var url = o.substring(1, o.length - 1);
            output = output.replace(o, callback(url, url));
        });
    }

    matches = line.match(regLink2);

    if (matches === null)
        return output;

    matches.forEach(function(o) {

        if (o.substring(0, 3) === '[![')
            return;

        var index = o.indexOf(']');
        if (index === -1)
            return;

        if (o[0] === '!')
            return;

        var text = o.substring(1, index).trim();
        var url = o.substring(index + 1).trim();

        var first = url[0];

        if (first === '(' || first === '(' || first === ':')
            url = url.substring(1).trim();
        else
            return;

        if (first === '(')
            o += ')';

        var last = url[url.length - 1];

        if (last === ',' || last === '.' || last === ' ')
            url = url.substring(0, url.length - 1);
        else
            last = '';

        output = output.replace(o, callback(text, url) + last);
    });

    return output;
};

/*
    Internal function
    @text {String}
    @callback {Function}
    return {String}
*/
function $parseImage(line, callback) {

    var output = line;
    var matches = line.match(regImage);

    if (matches === null)
        return output;

    matches.forEach(function(o) {

        var indexBeg = 2;

        if (o.substring(0, 3) === '[![')
            indexBeg = 3;

        var index = o.indexOf(']');
        if (index === -1)
            return;

        var text = o.substring(indexBeg, index).trim();
        var url = o.substring(index + 1).trim();

        var first = url[0];
        if (first !== '(')
            return;

        index = o.lastIndexOf(')');
        if (index === -1)
            return;

        var find = o.substring(0, index + 1);

        url = url.substring(1, index + 1);
        index = url.indexOf('#');
        indexBeg = index;

        var src = '';
        var indexEnd = url.indexOf(')', index);

        var dimension = [];

        if (index > 0) {
            dimension = url.substring(indexBeg + 1, indexEnd).split('x');
            src = url.substring(0, index);
        }

        indexBeg = url.indexOf('(', indexEnd);
        indexEnd = url.lastIndexOf(')');

        if (indexBeg !== -1 && indexBeg > index)
            url = url.substring(indexBeg + 1, indexEnd);
        else
            url = '';

        output = output.replace(find, callback(text, src, parseInt(dimension[0] || '0'), parseInt(dimension[1] || '0'), url));
    });

    return output;
};

// ======================================================
// PROTOTYPES
// ======================================================

/*
    Parse text
    @text {String} :: markdown
    @name {String} :: optional, default undefined
    return {String}
*/
Markdown.prototype.parse = function(text, name) {
    return this.load(text, name);
};

/*
    Load text
    @text {String} :: markdown
    @name {String} :: optional, default undefined
    return {String}
*/
Markdown.prototype.load = function(text, name) {

    var self = this;
    var tmpTable = null;
    var tmpName = '';
    var tmp = [];
    var tmpUL = [];
    var lines = text.split('\n');

    self.name = name;

    var read = function read(i) {
        return $clean(lines[i] || '');
    };

    var isBlock = false;
    var isTable = false;
    var skip = false;
    var index = 0;
    var buffer = '';

    var flushUL = function() {
        if (self.onUL !== null)
            buffer += self.onUL(tmpUL) || '';
        else {
            tmpUL.forEach(function(o) {
                buffer += self.onLine(null, o.value) || '';
            });
        }

        tmpUL = [];
    };

    var flushParagraph = function(i) {
        isBlock = false;

        if (tmpName === '/')
            tmpName = '//';

        if (tmpName === '\\')
            tmpName = '\\\\';

        buffer += self.onLines(tmpName, tmp, i) || '';
        tmp = [];
    };

    var blockLength = self.block.length;

    for (var i = 0; i < lines.length; i++)
    {
        var line = lines[i];

        // Kroky
        // 1. kontrola
        // 2. je blok?
        // 3. je tabuľka?
        // 4. je odsek, čiara?
        // 5. je UL?
        // 6. je paragraf?
        // 7. je nadpis?
        // 8. text

        if (skip)
        {
            skip = false;
            continue;
        }

        if (isBlock)
        {
            if (line.trim().substring(0, blockLength) === self.block)
            {
                flushParagraph(i);
                continue;
            }

            tmp.push(line);
            continue;
        }

        var m = $clean(line);

        if (m.length == 0) {
            buffer += self.onLine('\n', '\n', i);
            continue;
        }

        var c = m[0] || '';
        var cn = m[1] || '';

        // 2. je blok?
        if (line.substring(0, blockLength) === self.block)
        {
            index = m.lastIndexOf('=') + 1;
            if (index < m.length)
            {
                tmpName = m.substring(index + 1).trim();
                isBlock = true;
                continue;
            }
        }

        // 3. je tabuľka?
        if (m.length > 1) {

            if (c === '|' && m[1] === '-' && m[m.length - 1] === '|') {

                isTable = !isTable;
                if (isTable)
                {
                    tmpTable = new Table();
                    tmpTable.columnCount = 0;
                    tmpTable.rows = [];
                }
                else
                {
                    if (self.onTable !== null && tmpTable !== null)
                        self.onTable(tmpTable);
                }
                continue;
            }

            if (isTable)
            {
                var columns = m.split('|');
                var columnCount = columns.length - 2;
                var row = new Row();

                row.index = tmpTable.rows.length;
                row.columns = [];

                if (tmpTable.columnCount < columnCount)
                    tmpTable.columnCount = columnCount;

                for (var j = 0; j < columns.length; j++)
                {
                    var a = columns[j];
                    if (j > 0 && j < columns.length - 1)
                    {
                        row.columns.push(new Column(row.columns.length, a.length, $parse(self, a.trim())));
                        if (row.index === 0)
                            tmpTable.width += a.length;
                    }
                }

                tmpTable.rows.push(row);
                continue;
            }
        }

        // 4. je odsek, čiara?
        if (m.length > 0 && (c === '*' || c === '-')) {
            if ($isFill(m, c)) {
                buffer += self.onLine(c.toString(), m, i) || '';
                continue;
            }

        }

        var next = read(i + 1);

        // 5. je UL?
        if ($isUL(m)) {

            var value = m;
            var a = c;

            if ($isWhite(c)) {
                a = $nearest(m);
                value = value.substring(value.indexOf(a));
            }

            var ul = new UL(a, tmpUL.length, $charCount(m, c), $parse(self, value.substring(1)));
            tmpUL.push(ul);

            if (!$isUL(next))
                flushUL();

            continue;
        }

        if (tmpUL.length > 0)
            flushUL();

        // 6. je paragraf?
        if ($isParagraph(c, cn)) {

            if ($firstChar(tmpName) !== c && tmp.length > 0)
                flushParagraph(i);

            tmpName = c;
            tmp.push($parse(self, c === '/' || c === '\\' ? m.substring(2) : m.substring(1)));

            var nl = read(i + 1);
            c = nl[0] || '\0';
            cn = nl[1] || '\0';

            if (!$isParagraph(c, cn))
                flushParagraph(i);

            continue;
        }

        // 7. je nadpis?
        if (c === '#')
        {
            index = m.lastIndexOf(c);
            if (index !== m.length)
            {
                index++;
                buffer += self.onLine(m.substring(0, index), m.substring(index, m.length).trim(), i) || '';
                continue;
            }
        }

        // kontrola či nasledujíci riadok nie je čiara kvôli nadpisu
        if (m.length == next.length) {
            c = $firstChar(next);
            if (c === '-' || c === '=') {
                buffer += self.onLine(c === '=' ? '#' : '##', m.trim(), i);
                skip = true;
                continue;
            }
        }

        buffer += self.onLine(null, $parse(self, m), i) || '';
    };

    text = null;
    lines = null;
    tmp = null;
    tmpUL = null;

    return buffer;
};

// ======================================================
// EXPORTS
// ======================================================

exports.init = function() {
    return new Markdown();
};

exports.load = function() {
    return new Markdown();
};

exports.markdown = function() {
    return new Markdown();
};

exports.md = function() {
    return new Markdown();
};