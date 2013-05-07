// Copyright (c) 2002 Douglas Crockford  (www.crockford.com)
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

"use strict";

/*
    Minify JS
    @source {String}
    return {String}
*/
exports.compile = function(source, framework) {
    try
    {
        return JavaScript(source);
    } catch (ex) {
        framework.error(ex, 'JavaScript compressor');
        return source;
    }
};

/*
    Minify JS
    @source {String}
    return {String}
*/
function JavaScript(source) {

    var EOF = -1;
    var sb = [];
    var theA; // int
    var theB; // int
    var theLookahead = EOF; // int
    var index = 0;

    function jsmin()
    {
        theA = 13;
        action(3);
        var indexer = 0;
        while (theA !== EOF)
        {
            switch (theA)
            {
                case 32:
                    {
                        if (isAlphanum(theB))
                        {
                            action(1);
                        }
                        else
                        {
                            action(2);
                        }
                        break;
                    }
                case 13:
                    {
                        switch (theB)
                        {
                            case 123:
                            case 91:
                            case 40:
                            case 43:
                            case 45:
                                {
                                    action(1);
                                    break;
                                }
                            case 32:
                                {
                                    action(3);
                                    break;
                                }
                            default:
                                {
                                    if (isAlphanum(theB))
                                    {
                                        action(1);
                                    }
                                    else
                                    {
                                        action(2);
                                    }
                                    break;
                                }
                        }
                        break;
                    }
                default:
                    {
                        switch (theB)
                        {
                            case 32:
                                {
                                    if (isAlphanum(theA))
                                    {
                                        action(1);
                                        break;
                                    }
                                    action(3);
                                    break;
                                }
                            case 13:
                                {
                                    switch (theA)
                                    {
                                        case 125:
                                        case 93:
                                        case 41:
                                        case 43:
                                        case 45:
                                        case 34:
                                        case 92:
                                            {
                                                action(1);
                                                break;
                                            }
                                        default:
                                            {
                                                if (isAlphanum(theA))
                                                {
                                                    action(1);
                                                }
                                                else
                                                {
                                                    action(3);
                                                }
                                                break;
                                            }
                                    }
                                    break;
                                }
                            default:
                                {
                                    action(1);
                                    break;
                                }
                        }
                        break;
                    }
            }
        }
    }

    function action(d)
    {
        if (d <= 1)
        {
            put(theA);
        }
        if (d <= 2)
        {
            theA = theB;
            if (theA === 39 || theA === 34)
            {
                for (; ; )
                {
                    put(theA);
                    theA = get();
                    if (theA === theB)
                    {
                        break;
                    }
                    if (theA <= 13)
                    {
                        //throw new Exception(string.Format("Error: JSMIN unterminated string literal: {0}\n", theA));
                        c = EOF;
                        return;
                    }
                    if (theA === 92)
                    {
                        put(theA);
                        theA = get();
                    }
                }
            }
        }
        if (d <= 3)
        {
            theB = next();
            if (theB === 47 && (theA === 40 || theA === 44 || theA === 61 ||
                               theA === 91 || theA === 33 || theA === 58 ||
                               theA === 38 || theA === 124 || theA === 63 ||
                               theA === 123 || theA === 125 || theA === 59 ||
                               theA === 13))
            {
                put(theA);
                put(theB);
                for (; ; )
                {
                    theA = get();
                    if (theA === 47)
                    {
                        break;
                    }
                    else if (theA === 92)
                    {
                        put(theA);
                        theA = get();
                    }
                    else if (theA <= 13)
                    {
                        c = EOF;
                        return;
                    }
                    put(theA);
                }
                theB = next();
            }
        }
    }

    function next()
    {
        var c = get();
        if (c === 47)
        {
            switch (peek())
            {
                case 47:
                    {
                        for (; ; )
                        {
                            c = get();
                            if (c <= 13)
                            {
                                return c;
                            }
                        }
                    }
                case 42:
                    {
                        get();
                        for (; ; )
                        {
                            switch (get())
                            {
                                case 42:
                                    {
                                        if (peek() === 47)
                                        {
                                            get();
                                            return 32;
                                        }
                                        break;
                                    }
                                case EOF:
                                    {
                                        c = EOF;
                                        return;
                                    }
                            }
                        }
                    }
                default:
                    {
                        return c;
                    }
            }
        }
        return c;
    }

    function peek()
    {
        theLookahead = get();
        return theLookahead;
    }

    function get()
    {
        var c = theLookahead;
        theLookahead = EOF;
        if (c === EOF)
        {
            c = source.charCodeAt(index++);
            if (isNaN(c))
                c = EOF;
        }
        if (c >= 32 || c === 13 || c === EOF)
        {
            return c;
        }
        if (c === 10) // \r
        {
            return 13;
        }
        return 32;
    }

    function put(c)
    {
        if (c === 13 || c === 10)
            sb.push(' ');
        else
            sb.push(String.fromCharCode(c));
    }

    function isAlphanum(c)
    {
        return ((c >= 97 && c <= 122) || (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || c === 95 || c === 36 || c === 92 || c > 126);
    }

    jsmin();
    return sb.join('');
};