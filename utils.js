// Copyright 2012-2016 (c) Peter Širka <petersirka@gmail.com>
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

/**
 * @module FrameworkUtils
 * @version 2.3.0
 */

'use strict';

const Dns = require('dns');
const parser = require('url');
const qs = require('querystring');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const events = require('events');
const crypto = require('crypto');

if (!global.framework_utils)
	global.framework_utils = exports;

var regexpSTATIC = /\.\w{2,8}($|\?)+/;
const regexpTRIM = /^[\s]+|[\s]+$/g;
const regexpDATE = /(\d{1,2}\.\d{1,2}\.\d{4})|(\d{4}\-\d{1,2}\-\d{1,2})|(\d{1,2}\:\d{1,2}(\:\d{1,2})?)/g;
const regexpDATEFORMAT = /yyyy|yy|M+|d+|HH|H|hh|h|mm|m|ss|s|a|ww|w/g;
const regexpSTRINGFORMAT = /\{\d+\}/g;
const regexpPATH = /\\/g;
const regexpTags = /<\/?[^>]+(>|$)/g;
const regexpDiacritics = /[^\u0000-\u007e]/g;
const regexpXML = /\w+\=\".*?\"/g;
const regexpDECODE = /&#?[a-z0-9]+;/g;
const regexpPARAM = /\{{2}[^}\n]*\}{2}/g;
const regexpINTEGER = /[\-0-9]+/g;
const regexpFLOAT = /[\-0-9\.\,]+/g;
const regexpALPHA = /^[A-Za-z0-9]+$/;
const regexpSEARCH = /[^a-zA-Zá-žÁ-Ž\d\s:]/g;
const regexpDECRYPT = /\-|\_/g;
const regexpENCRYPT = /\/|\+/g;
const SOUNDEX = { a: '', e: '', i: '', o: '', u: '', b: 1, f: 1, p: 1, v: 1, c: 2, g: 2, j: 2, k: 2, q: 2, s: 2, x: 2, z: 2, d: 3, t: 3, l: 4, m: 5, n: 5, r: 6 };
const ENCODING = 'utf8';
const NEWLINE = '\r\n';
const isWindows = require('os').platform().substring(0, 3).toLowerCase() === 'win';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'Juny', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DIACRITICSMAP = {};
const STREAM_READONLY = { flags: 'r' };
const STREAM_END = { end: false };
const ALPHA_INDEX = { '&lt': '<', '&gt': '>', '&quot': '"', '&apos': '\'', '&amp': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': '\'', '&amp;': '&' };
const EMPTYARRAY = [];

Object.freeze(EMPTYARRAY);

var DIACRITICS=[{b:' ',c:'\u00a0'},{b:'0',c:'\u07c0'},{b:'A',c:'\u24b6\uff21\u00c0\u00c1\u00c2\u1ea6\u1ea4\u1eaa\u1ea8\u00c3\u0100\u0102\u1eb0\u1eae\u1eb4\u1eb2\u0226\u01e0\u00c4\u01de\u1ea2\u00c5\u01fa\u01cd\u0200\u0202\u1ea0\u1eac\u1eb6\u1e00\u0104\u023a\u2c6f'},{b:'AA',c:'\ua732'},{b:'AE',c:'\u00c6\u01fc\u01e2'},{b:'AO',c:'\ua734'},{b:'AU',c:'\ua736'},{b:'AV',c:'\ua738\ua73a'},{b:'AY',c:'\ua73c'},{b:'B',c:'\u24b7\uff22\u1e02\u1e04\u1e06\u0243\u0181'},{b:'C',c:'\u24b8\uff23\ua73e\u1e08\u0106C\u0108\u010a\u010c\u00c7\u0187\u023b'},{b:'D',c:'\u24b9\uff24\u1e0a\u010e\u1e0c\u1e10\u1e12\u1e0e\u0110\u018a\u0189\u1d05\ua779'},{b:'Dh',c:'\u00d0'},{b:'DZ',c:'\u01f1\u01c4'},{b:'Dz',c:'\u01f2\u01c5'},{b:'E',c:'\u025b\u24ba\uff25\u00c8\u00c9\u00ca\u1ec0\u1ebe\u1ec4\u1ec2\u1ebc\u0112\u1e14\u1e16\u0114\u0116\u00cb\u1eba\u011a\u0204\u0206\u1eb8\u1ec6\u0228\u1e1c\u0118\u1e18\u1e1a\u0190\u018e\u1d07'},{b:'F',c:'\ua77c\u24bb\uff26\u1e1e\u0191\ua77b'}, {b:'G',c:'\u24bc\uff27\u01f4\u011c\u1e20\u011e\u0120\u01e6\u0122\u01e4\u0193\ua7a0\ua77d\ua77e\u0262'},{b:'H',c:'\u24bd\uff28\u0124\u1e22\u1e26\u021e\u1e24\u1e28\u1e2a\u0126\u2c67\u2c75\ua78d'},{b:'I',c:'\u24be\uff29\u00cc\u00cd\u00ce\u0128\u012a\u012c\u0130\u00cf\u1e2e\u1ec8\u01cf\u0208\u020a\u1eca\u012e\u1e2c\u0197'},{b:'J',c:'\u24bf\uff2a\u0134\u0248\u0237'},{b:'K',c:'\u24c0\uff2b\u1e30\u01e8\u1e32\u0136\u1e34\u0198\u2c69\ua740\ua742\ua744\ua7a2'},{b:'L',c:'\u24c1\uff2c\u013f\u0139\u013d\u1e36\u1e38\u013b\u1e3c\u1e3a\u0141\u023d\u2c62\u2c60\ua748\ua746\ua780'}, {b:'LJ',c:'\u01c7'},{b:'Lj',c:'\u01c8'},{b:'M',c:'\u24c2\uff2d\u1e3e\u1e40\u1e42\u2c6e\u019c\u03fb'},{b:'N',c:'\ua7a4\u0220\u24c3\uff2e\u01f8\u0143\u00d1\u1e44\u0147\u1e46\u0145\u1e4a\u1e48\u019d\ua790\u1d0e'},{b:'NJ',c:'\u01ca'},{b:'Nj',c:'\u01cb'},{b:'O',c:'\u24c4\uff2f\u00d2\u00d3\u00d4\u1ed2\u1ed0\u1ed6\u1ed4\u00d5\u1e4c\u022c\u1e4e\u014c\u1e50\u1e52\u014e\u022e\u0230\u00d6\u022a\u1ece\u0150\u01d1\u020c\u020e\u01a0\u1edc\u1eda\u1ee0\u1ede\u1ee2\u1ecc\u1ed8\u01ea\u01ec\u00d8\u01fe\u0186\u019f\ua74a\ua74c'}, {b:'OE',c:'\u0152'},{b:'OI',c:'\u01a2'},{b:'OO',c:'\ua74e'},{b:'OU',c:'\u0222'},{b:'P',c:'\u24c5\uff30\u1e54\u1e56\u01a4\u2c63\ua750\ua752\ua754'},{b:'Q',c:'\u24c6\uff31\ua756\ua758\u024a'},{b:'R',c:'\u24c7\uff32\u0154\u1e58\u0158\u0210\u0212\u1e5a\u1e5c\u0156\u1e5e\u024c\u2c64\ua75a\ua7a6\ua782'},{b:'S',c:'\u24c8\uff33\u1e9e\u015a\u1e64\u015c\u1e60\u0160\u1e66\u1e62\u1e68\u0218\u015e\u2c7e\ua7a8\ua784'},{b:'T',c:'\u24c9\uff34\u1e6a\u0164\u1e6c\u021a\u0162\u1e70\u1e6e\u0166\u01ac\u01ae\u023e\ua786'}, {b:'Th',c:'\u00de'},{b:'TZ',c:'\ua728'},{b:'U',c:'\u24ca\uff35\u00d9\u00da\u00db\u0168\u1e78\u016a\u1e7a\u016c\u00dc\u01db\u01d7\u01d5\u01d9\u1ee6\u016e\u0170\u01d3\u0214\u0216\u01af\u1eea\u1ee8\u1eee\u1eec\u1ef0\u1ee4\u1e72\u0172\u1e76\u1e74\u0244'},{b:'V',c:'\u24cb\uff36\u1e7c\u1e7e\u01b2\ua75e\u0245'},{b:'VY',c:'\ua760'},{b:'W',c:'\u24cc\uff37\u1e80\u1e82\u0174\u1e86\u1e84\u1e88\u2c72'},{b:'X',c:'\u24cd\uff38\u1e8a\u1e8c'},{b:'Y',c:'\u24ce\uff39\u1ef2\u00dd\u0176\u1ef8\u0232\u1e8e\u0178\u1ef6\u1ef4\u01b3\u024e\u1efe'}, {b:'Z',c:'\u24cf\uff3a\u0179\u1e90\u017b\u017d\u1e92\u1e94\u01b5\u0224\u2c7f\u2c6b\ua762'},{b:'a',c:'\u24d0\uff41\u1e9a\u00e0\u00e1\u00e2\u1ea7\u1ea5\u1eab\u1ea9\u00e3\u0101\u0103\u1eb1\u1eaf\u1eb5\u1eb3\u0227\u01e1\u00e4\u01df\u1ea3\u00e5\u01fb\u01ce\u0201\u0203\u1ea1\u1ead\u1eb7\u1e01\u0105\u2c65\u0250\u0251'},{b:'aa',c:'\ua733'},{b:'ae',c:'\u00e6\u01fd\u01e3'},{b:'ao',c:'\ua735'},{b:'au',c:'\ua737'},{b:'av',c:'\ua739\ua73b'},{b:'ay',c:'\ua73d'}, {b:'b',c:'\u24d1\uff42\u1e03\u1e05\u1e07\u0180\u0183\u0253\u0182'},{b:'c',c:'\uff43\u24d2\u0107\u0109\u010b\u010d\u00e7\u1e09\u0188\u023c\ua73f\u2184'},{b:'d',c:'\u24d3\uff44\u1e0b\u010f\u1e0d\u1e11\u1e13\u1e0f\u0111\u018c\u0256\u0257\u018b\u13e7\u0501\ua7aa'},{b:'dh',c:'\u00f0'},{b:'dz',c:'\u01f3\u01c6'},{b:'e',c:'\u24d4\uff45\u00e8\u00e9\u00ea\u1ec1\u1ebf\u1ec5\u1ec3\u1ebd\u0113\u1e15\u1e17\u0115\u0117\u00eb\u1ebb\u011b\u0205\u0207\u1eb9\u1ec7\u0229\u1e1d\u0119\u1e19\u1e1b\u0247\u01dd'}, {b:'f',c:'\u24d5\uff46\u1e1f\u0192'},{b:'ff',c:'\ufb00'},{b:'fi',c:'\ufb01'},{b:'fl',c:'\ufb02'},{b:'ffi',c:'\ufb03'},{b:'ffl',c:'\ufb04'},{b:'g',c:'\u24d6\uff47\u01f5\u011d\u1e21\u011f\u0121\u01e7\u0123\u01e5\u0260\ua7a1\ua77f\u1d79'},{b:'h',c:'\u24d7\uff48\u0125\u1e23\u1e27\u021f\u1e25\u1e29\u1e2b\u1e96\u0127\u2c68\u2c76\u0265'},{b:'hv',c:'\u0195'},{b:'i',c:'\u24d8\uff49\u00ec\u00ed\u00ee\u0129\u012b\u012d\u00ef\u1e2f\u1ec9\u01d0\u0209\u020b\u1ecb\u012f\u1e2d\u0268\u0131'}, {b:'j',c:'\u24d9\uff4a\u0135\u01f0\u0249'},{b:'k',c:'\u24da\uff4b\u1e31\u01e9\u1e33\u0137\u1e35\u0199\u2c6a\ua741\ua743\ua745\ua7a3'},{b:'l',c:'\u24db\uff4c\u0140\u013a\u013e\u1e37\u1e39\u013c\u1e3d\u1e3b\u017f\u0142\u019a\u026b\u2c61\ua749\ua781\ua747\u026d'},{b:'lj',c:'\u01c9'},{b:'m',c:'\u24dc\uff4d\u1e3f\u1e41\u1e43\u0271\u026f'},{b:'n',c:'\u24dd\uff4e\u01f9\u0144\u00f1\u1e45\u0148\u1e47\u0146\u1e4b\u1e49\u019e\u0272\u0149\ua791\ua7a5\u043b\u0509'},{b:'nj', c:'\u01cc'},{b:'o',c:'\u24de\uff4f\u00f2\u00f3\u00f4\u1ed3\u1ed1\u1ed7\u1ed5\u00f5\u1e4d\u022d\u1e4f\u014d\u1e51\u1e53\u014f\u022f\u0231\u00f6\u022b\u1ecf\u0151\u01d2\u020d\u020f\u01a1\u1edd\u1edb\u1ee1\u1edf\u1ee3\u1ecd\u1ed9\u01eb\u01ed\u00f8\u01ff\ua74b\ua74d\u0275\u0254\u1d11'},{b:'oe',c:'\u0153'},{b:'oi',c:'\u01a3'},{b:'oo',c:'\ua74f'},{b:'ou',c:'\u0223'},{b:'p',c:'\u24df\uff50\u1e55\u1e57\u01a5\u1d7d\ua751\ua753\ua755\u03c1'},{b:'q',c:'\u24e0\uff51\u024b\ua757\ua759'}, {b:'r',c:'\u24e1\uff52\u0155\u1e59\u0159\u0211\u0213\u1e5b\u1e5d\u0157\u1e5f\u024d\u027d\ua75b\ua7a7\ua783'},{b:'s',c:'\u24e2\uff53\u015b\u1e65\u015d\u1e61\u0161\u1e67\u1e63\u1e69\u0219\u015f\u023f\ua7a9\ua785\u1e9b\u0282'},{b:'ss',c:'\u00df'},{b:'t',c:'\u24e3\uff54\u1e6b\u1e97\u0165\u1e6d\u021b\u0163\u1e71\u1e6f\u0167\u01ad\u0288\u2c66\ua787'},{b:'th',c:'\u00fe'},{b:'tz',c:'\ua729'},{b:'u',c:'\u24e4\uff55\u00f9\u00fa\u00fb\u0169\u1e79\u016b\u1e7b\u016d\u00fc\u01dc\u01d8\u01d6\u01da\u1ee7\u016f\u0171\u01d4\u0215\u0217\u01b0\u1eeb\u1ee9\u1eef\u1eed\u1ef1\u1ee5\u1e73\u0173\u1e77\u1e75\u0289'}, {b:'v',c:'\u24e5\uff56\u1e7d\u1e7f\u028b\ua75f\u028c'},{b:'vy',c:'\ua761'},{b:'w',c:'\u24e6\uff57\u1e81\u1e83\u0175\u1e87\u1e85\u1e98\u1e89\u2c73'},{b:'x',c:'\u24e7\uff58\u1e8b\u1e8d'},{b:'y',c:'\u24e8\uff59\u1ef3\u00fd\u0177\u1ef9\u0233\u1e8f\u00ff\u1ef7\u1e99\u1ef5\u01b4\u024f\u1eff'},{b:'z',c:'\u24e9\uff5a\u017a\u1e91\u017c\u017e\u1e93\u1e95\u01b6\u0225\u0240\u2c6c\ua763'}];

for (var i=0; i <DIACRITICS.length; i+=1)
	for (var chars=DIACRITICS[i].c,j=0;j<chars.length;j+=1)
		DIACRITICSMAP[chars[j]]=DIACRITICS[i].b;

DIACRITICS = null;

var CONTENTTYPES = {
	'aac': 'audio/aac',
	'ai': 'application/postscript',
	'appcache': 'text/cache-manifest',
	'avi': 'video/avi',
	'bin': 'application/octet-stream',
	'bmp': 'image/bmp',
	'coffee': 'text/coffeescript',
	'css': 'text/css',
	'csv': 'text/csv',
	'doc': 'application/msword',
	'docx': 'application/msword',
	'dtd': 'application/xml-dtd',
	'eps': 'application/postscript',
	'exe': 'application/octet-stream',
	'geojson': 'application/json',
	'gif': 'image/gif',
	'gzip': 'application/x-gzip',
	'htm': 'text/html',
	'html': 'text/html',
	'ico': 'image/x-icon',
	'ics': 'text/calendar',
	'ifb': 'text/calendar',
	'jpe': 'image/jpeg',
	'jpeg': 'image/jpeg',
	'jpg': 'image/jpeg',
	'js': 'text/javascript',
	'json': 'application/json',
	'jsx': 'text/jsx',
	'less': 'text/css',
	'm4a': 'audio/mp4a-latm',
	'm4v': 'video/x-m4v',
	'manifest': 'text/cache-manifest',
	'md': 'text/x-markdown',
	'mid': 'audio/midi',
	'midi': 'audio/midi',
	'mov': 'video/quicktime',
	'mp3': 'audio/mpeg',
	'mp4': 'video/mp4',
	'mpe': 'video/mpeg',
	'mpeg': 'video/mpeg',
	'mpg': 'video/mpeg',
	'mpga': 'audio/mpeg',
	'mtl': 'text/plain',
	'mv4': 'video/mv4',
	'obj': 'text/plain',
	'ogg': 'application/ogg',
	'ogv': 'video/ogg',
	'package': 'text/plain',
	'pdf': 'application/pdf',
	'png': 'image/png',
	'ppt': 'application/vnd.ms-powerpoint',
	'pptx': 'application/vnd.ms-powerpoint',
	'ps': 'application/postscript',
	'rar': 'application/x-rar-compressed',
	'rtf': 'text/rtf',
	'sass': 'text/css',
	'scss': 'text/css',
	'sh': 'application/x-sh',
	'stl': 'application/sla',
	'svg': 'image/svg+xml',
	'swf': 'application/x-shockwave-flash',
	'tar': 'application/x-tar',
	'tif': 'image/tiff',
	'tiff': 'image/tiff',
	'txt': 'text/plain',
	'wav': 'audio/x-wav',
	'webm': 'video/webm',
	'webp': 'image/webp',
	'woff': 'application/font-woff',
	'woff2': 'application/font-woff2',
	'xht': 'application/xhtml+xml',
	'xhtml': 'application/xhtml+xml',
	'xls': 'application/vnd.ms-excel',
	'xlsx': 'application/vnd.ms-excel',
	'xml': 'application/xml',
	'xpm': 'image/x-xpixmap',
	'xsl': 'application/xml',
	'xslt': 'application/xslt+xml',
	'zip': 'application/zip'
};

var dnscache = {};
const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Checks if is object empty
 * @param {Object} obj
 * @return {Boolean}
 */
exports.isEmpty = function(obj) {

	if (!obj)
		return true;

	if (obj.length)
		return false;

	for (var key in obj) {
		if (hasOwnProperty.call(obj, key))
			return false;
	}

	return true;
};

/**
 * Compare objects
 * @param {Object} obj1
 * @param {Object} obj2
 * @return {Boolean}
 */
exports.isEqual = function(obj1, obj2, properties) {

	var keys = properties ? properties : Object.keys(obj1);

	for (var i = 0, length = keys.length; i < length; i++) {
		var key = keys[i];
		var a = obj1[key];
		var b = obj2[key];
		var ta = typeof(a);
		var tb = typeof(b);

		if (ta !== tb)
			return false;

		if (a === b)
			continue;

		if (a instanceof Date && b instanceof Date) {
			if (a.getTime() === b.getTime())
				continue;
			return false;
		} else if (a instanceof Array && b instanceof Array) {
			if (JSON.stringify(a) === JSON.stringify(b))
				continue;
			return false;
		}

		if (ta === 'object' && tb === 'object') {
			if (exports.isEqual(a, b))
				continue;
		}

		return false;
	}

	return true;
};

/**
 * Function checks a valid function and waits for it positive result
 * @param {Function} fnValid
 * @param {Function(err, success)} fnCallback
 * @param {Number} timeout  Timeout, optional (default: 5000)
 * @param {Number} interval Refresh interval, optional (default: 500)
 */
exports.wait = function(fnValid, fnCallback, timeout, interval) {

	if (fnValid() === true)
		return fnCallback(null, true);

	var id_timeout = null;
	var id_interval = setInterval(function() {

		if (fnValid() === true) {
			clearInterval(id_interval);
			clearTimeout(id_timeout);
			fnCallback && fnCallback(null, true);
			return;
		}

	}, interval || 500);

	id_timeout = setTimeout(function() {
		clearInterval(id_interval);
		fnCallback && fnCallback(new Error('Timeout.'), false);
	}, timeout || 5000);
};

exports.$$wait = function(fnValid, timeout, interval) {
	return function(callback) {
		exports.wait(fnValid, callback, timeout, interval);
	};
};

/**
 * Resolves an IP from the URL address
 * @param {String} url
 * @param {Function(err, uri)} callback
 */
exports.resolve = function(url, callback) {

	var uri = parser.parse(url);

	if (!callback)
		return dnscache[uri.host];

	if (dnscache[uri.host]) {
		uri.host = dnscache[uri.host];
		callback(null, uri);
		return;
	}

	Dns.resolve4(uri.hostname, function(e, addresses) {

		if (!e) {
			dnscache[uri.host] = addresses[0];
			uri.host = addresses[0];
			callback(null, uri);
			return;
		}

		setImmediate(function() {
			Dns.resolve4(uri.hostname, function(e, addresses) {
				if (e)
					return callback(e, uri);
				dnscache[uri.host] = addresses[0];
				uri.host = addresses[0];
				callback(null, uri);
			});
		});
	});
};

exports.$$resolve = function(url) {
	return function(callback) {
		return exports.resolve(url, callback);
	};
};

/**
 * Clears DNS cache
 */
exports.clearDNS = function() {
	dnscache = {};
};

exports.keywords = function(content, forSearch, alternative, max_count, max_length, min_length) {

	if (forSearch === undefined)
		forSearch = true;

	min_length = min_length || 2;
	max_count = max_count || 200;
	max_length = max_length || 20;

	var words = [];
	var isSoundex = alternative === 'soundex';

	if (content instanceof Array) {
		for (var i = 0, length = content.length; i < length; i++) {
			if (!content[i])
				continue;
			var tmp = (forSearch ? content[i].removeDiacritics().toLowerCase().replace(/y/g, 'i') : content[i].toLowerCase()).replace(/\n/g, ' ').split(' ');
			if (!tmp || !tmp.length)
				continue;
			for (var j = 0, jl = tmp.length; j < jl; j++)
				words.push(tmp[j]);
		}
	} else
		words = (forSearch ? content.removeDiacritics().toLowerCase().replace(/y/g, 'i') : content.toLowerCase()).replace(/\n/g, ' ').split(' ');

	if (!words)
		words = [];

	var dic = {};
	var counter = 0;

	for (var i = 0, length = words.length; i < length; i++) {
		var word = words[i].trim();

		if (word.length < min_length)
			continue;

		if (counter >= max_count)
			break;

		if (forSearch)
			word = word.replace(/\W|_/g, '');

		// Gets 80% length of word
		if (alternative) {
			if (isSoundex)
				word = word.soundex();
			else {
				var size = (word.length / 100) * 80;
				if (size > min_length + 1)
					word = word.substring(0, size);
			}
		}

		if (word.length < min_length || word.length > max_length)
			continue;

		if (dic[word])
			dic[word]++;
		else
			dic[word] = 1;

		counter++;
	}

	var keys = Object.keys(dic);

	keys.sort(function(a, b) {
		var countA = dic[a];
		var countB = dic[b];
		return countA > countB ? -1 : countA < countB ? 1 : 0;
	});

	return keys;
};

/**
 * Create a request to a specific URL
 * @param  {String} url URL address.
 * @param  {String Array} flags Request flags.
 * @param  {String or Object} data Request data (optional).
 * @param  {Function(error, content, statusCode, headers)} callback Callback.
 * @param  {Object} headers Custom cookies (optional, default: null).
 * @param  {Object} headers Custom headers (optional, default: null).
 * @param  {String} encoding Encoding (optional, default: UTF8)
 * @param  {Number} timeout Request timeout.
 * return {Boolean}
 */
exports.request = function(url, flags, data, callback, cookies, headers, encoding, timeout) {

	// No data (data is optinal argument)
	if (typeof(data) === 'function') {
		timeout = encoding;
		encoding = headers;
		headers = cookies;
		cookies = callback;
		callback = data;
		data = '';
	} else if (!data)
		data = '';

	if (typeof(cookies) === 'number') {
		cookies = null;
		timeout = cookies;
	}

	if (typeof(headers) === 'number') {
		headers = null;
		timeout = headers;
	}

	if (typeof(encoding) === 'number') {
		encoding = null;
		timeout = encoding;
	}

	if (callback === NOOP)
		callback = null;

	var options = { length: 0, timeout: 10000, evt: new events.EventEmitter(), encoding: typeof(encoding) !== 'string' ? ENCODING : encoding, callback: callback, post: false, redirect: 0 };
	var method;
	var type = 0;

	if (headers)
		headers = exports.extend({}, headers);
	else
		headers = {};

	if (flags instanceof Array) {
		for (var i = 0, length = flags.length; i < length; i++) {

			// timeout
			if (flags[i] > 0) {
				options.timeout = flags[i];
				continue;
			}

			if (flags[i][0] === '<') {
				options.max = flags[i].substring(1).trim().parseInt() * 1024; // kB
				continue;
			}

			switch (flags[i].toLowerCase()) {
				case 'utf8':
				case 'ascii':
				case 'base64':
				case 'binary':
				case 'hex':
					options.encoding = flags[i];
					break;
				case 'xhr':
					headers['X-Requested-With'] = 'XMLHttpRequest';
					break;
				case 'plain':
					headers['Content-Type'] = 'text/plain';
					break;
				case 'html':
					headers['Content-Type'] = 'text/html';
					break;
				case 'json':
					headers['Content-Type'] = 'application/json';

					if (!method)
						method = 'POST';

					type = 1;
					break;
				case 'xml':
					headers['Content-Type'] = 'text/xml';

					if (!method)
						method = 'POST';

					type = 2;
					break;

				case 'get':
				case 'options':
				case 'head':
					method = flags[i].toUpperCase();
					break;

				case 'upload':
					headers['Content-Type'] = 'multipart/form-data';
					break;

				case 'post':
				case 'put':
				case 'delete':
				case 'patch':

					method = flags[i].toUpperCase();
					if (!headers['Content-Type'])
						headers['Content-Type'] = 'application/x-www-form-urlencoded';

					break;
				case 'dnscache':
					options.resolve = true;
					break;
			}
		}
	}

	if (method)
		options.post = method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH';
	else
		method = 'GET';

	if (typeof(data) !== 'string')
		data = type === 1 ? JSON.stringify(data) : qs.stringify(data);
	else if (data[0] === '?')
		data = data.substring(1);

	if (!options.post) {
		if (data.length && url.indexOf('?') === -1)
			url += '?' + data;
		data = '';
	}

	if (cookies) {
		var builder = '';
		for (var m in cookies)
			builder += (builder ? '; ' : '') + m + '=' + cookies[m];
		if (builder)
			headers['Cookie'] = builder;
	}

	if (data.length) {
		options.data = new Buffer(data, ENCODING);
		headers['Content-Length'] = options.data.length;
	}

	var uri = parser.parse(url);
	uri.method = method;
	uri.agent = false;
	uri.headers = headers;

	if (options.resolve) {
		exports.resolve(url, function(err, u) {
			if (!err)
				uri.host = u.host;
			request_call(uri, options);
		});
	} else
		request_call(uri, options);

	return options.evt;
};

function request_call(uri, options, counter) {

	var connection = uri.protocol === 'https:' ? https : http;
	var req = options.post ? connection.request(uri, (res) => request_response(res, uri, options)) : connection.get(uri, (res) => request_response(res, uri, options));

	if (!options.callback) {
		req.on('error', NOOP);
		return;
	}

	req.on('error', function(err) {
		if (!options.callback)
			return;
		options.callback(err, '', 0, undefined, uri.host);
		options.callback = null;
		options.evt.removeAllListeners();
		options.evt = null;
	});

	req.setTimeout(options.timeout, function() {
		if (!options.callback)
			return;
		options.callback(new Error(exports.httpStatus(408)), '', 0, undefined, uri.host);
		options.callback = null;
		options.evt.removeAllListeners();
		options.evt = null;
	});

	req.on('response', (response) => response.req = req);
	req.end(options.data);
}

function request_response(res, uri, options) {

	res._buffer = null;
	res._bufferlength = 0;

	// We have redirect
	if (res.statusCode === 301 || res.statusCode === 302) {

		if (options.redirect > 3) {

			if (options.callback) {
				options.callback(new Error('Too many redirects.'), '', 0, undefined, uri.host);
				options.callback = null;
			}

			if (options.evt) {
				options.evt.removeAllListeners();
				options.evt = null;
			}

			res.req.removeAllListeners();
			res.req = null;
			res.removeAllListeners();
			res = null;
			return;
		}

		options.redirect++;

		var tmp = parser.parse(res.headers['location']);
		tmp.headers = uri.headers;
		tmp.agent = false;
		tmp.method = uri.method;

		res.req.removeAllListeners();
		res.req = null;

		if (!options.resolve) {
			res.removeAllListeners();
			res = null;
			return request_call(tmp, options);
		}

		exports.resolve(res.headers['location'], function(err, u) {
			if (!err)
				tmp.host = u.host;
			res.removeAllListeners();
			res = null;
			request_call(tmp, options);
		});

		return;
	}

	options.length = +res.headers['content-length'] || 0;
	options.evt && options.evt.emit('begin', options.length);

	res.on('data', function(chunk) {
		var self = this;
		if (options.max && self._bufferlength > options.max)
			return;
		if (self._buffer)
			self._buffer = Buffer.concat([self._buffer, chunk]);
		else
			self._buffer = chunk;
		self._bufferlength += chunk.length;
		options.evt && options.evt.emit('data', chunk, options.length ? (self._bufferlength / options.length) * 100 : 0);
	});

	res.on('end', function() {
		var self = this;
		var str = self._buffer ? self._buffer.toString(options.encoding) : '';
		self._buffer = undefined;

		if (options.evt) {
			options.evt.emit('end', str, self.statusCode, self.headers, uri.host);
			options.evt.removeAllListeners();
			options.evt = null;
		}

		if (options.callback) {
			options.callback(null, uri.method === 'HEAD' ? self.headers : str, self.statusCode, self.headers, uri.host);
			options.callback = null;
		}

		res.req && res.req.removeAllListeners();
		res.removeAllListeners();
	});

	res.resume();
}

exports.$$request = function(url, flags, data, cookies, headers, encoding, timeout) {
	return function(callback) {
		exports.request(url, flags, data, callback, cookies, headers, encoding, timeout);
	};
};

exports.btoa = function(str) {
	return (str instanceof Buffer) ? str.toString('base64') : new Buffer(str.toString(), 'binary').toString('base64');
};

exports.atob = function(str) {
	return new Buffer(str, 'base64').toString('binary');
};

/**
 * Create a request to a specific URL
 * @param {String} url URL address.
 * @param {String Array} flags Request flags.
 * @param {String or Object} data Request data (optional).
 * @param {Function(error, response)} callback Callback.
 * @param {Object} cookies Custom cookies (optional, default: null).
 * @param {Object} headers Custom headers (optional, default: null).
 * @param {String} encoding Encoding (optional, default: UTF8)
 * @param {Number} timeout Request timeout.
 * return {Boolean}
 */
exports.download = function(url, flags, data, callback, cookies, headers, encoding, timeout) {

	// No data (data is optinal argument)
	if (typeof(data) === 'function') {
		timeout = encoding;
		encoding = headers;
		headers = cookies;
		cookies = callback;
		callback = data;
		data = '';
	}

	if (typeof(cookies) === 'number') {
		cookies = null;
		timeout = cookies;
	}

	if (typeof(headers) === 'number') {
		headers = null;
		timeout = headers;
	}

	if (typeof(encoding) === 'number') {
		encoding = null;
		timeout = encoding;
	}

	if (typeof(encoding) !== 'string')
		encoding = ENCODING;

	var method = 'GET';
	var type = 0;
	var options = { callback: callback, resolve: false, length: 0, evt: new events.EventEmitter(), timeout: timeout || 60000, post: false, encoding: encoding };

	if (headers)
		headers = exports.extend({}, headers);
	else
		headers = {};

	if (data === null)
		data = '';

	if (flags instanceof Array) {
		for (var i = 0, length = flags.length; i < length; i++) {

			// timeout
			if (flags[i] > 0) {
				options.timeout = flags[i];
				continue;
			}

			if (flags[i][0] === '<') {
				// max length is not supported
				continue;
			}

			switch (flags[i].toLowerCase()) {

				case 'utf8':
				case 'ascii':
				case 'base64':
				case 'binary':
				case 'hex':
					options.encoding = flags[i];
					break;

				case 'xhr':
					headers['X-Requested-With'] = 'XMLHttpRequest';
					break;

				case 'plain':
					headers['Content-Type'] = 'text/plain';
					break;
				case 'html':
					headers['Content-Type'] = 'text/html';
					break;

				case 'json':
					headers['Content-Type'] = 'application/json';
					type = 1;
					break;

				case 'xml':
					headers['Content-Type'] = 'text/xml';
					type = 2;
					break;

				case 'get':
				case 'head':
				case 'options':
					method = flags[i].toUpperCase();
					break;

				case 'upload':
					headers['Content-Type'] = 'multipart/form-data';
					break;

				case 'post':
				case 'patch':
				case 'delete':
				case 'put':
					method = flags[i].toUpperCase();
					if (!headers['Content-Type'])
						headers['Content-Type'] = 'application/x-www-form-urlencoded';
					break;

				case 'dnscache':
					options.resolve = true;
					break;

			}
		}
	}

	options.post = method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH';

	if (typeof(data) !== 'string')
		data = type === 1 ? JSON.stringify(data) : qs.stringify(data);
	else if (data[0] === '?')
		data = data.substring(1);

	if (!options.post) {
		if (data.length && url.indexOf('?') === -1)
			url += '?' + data;
		data = '';
	}

	if (cookies) {
		var builder = '';
		for (var m in cookies)
			builder += (builder ? '; ' : '') + m + '=' + cookies[m];
		if (builder)
			headers['Cookie'] = builder;
	}

	var uri = parser.parse(url);
	uri.method = method;
	uri.agent = false;
	uri.headers = headers;

	if (data.length) {
		options.data = new Buffer(data, ENCODING);
		headers['Content-Length'] = options.data.length;
	}

	if (options.resolve) {
		exports.resolve(url, function(err, u) {
			if (!err)
				uri.host = u.host;
			download_call(uri, options);
		});
	} else
		download_call(uri, options);

	return options.evt;
};

function download_call(uri, options) {

	options.length = 0;

	var connection = uri.protocol === 'https:' ? https : http;
	var req = options.post ? connection.request(uri, (res) => download_response(res, uri, options)) : connection.get(uri, (res) => download_response(res, uri, options));

	if (!options.callback) {
		req.on('error', NOOP);
		return;
	}

	req.on('error', function(err) {
		if (!options.callback)
			return;
		options.callback(err);
		options.callback = null;
		options.evt.removeAllListeners();
		options.evt = null;
	});

	req.setTimeout(options.timeout, function() {
		if (!options.callback)
			return;
		options.callback(new Error(exports.httpStatus(408)));
		options.callback = null;
		options.evt.removeAllListeners();
		options.evt = null;
	});

	req.on('response', function(response) {
		response.req = req;
		options.length = +response.headers['content-length'] || 0;
		options.evt && options.evt.emit('begin', options.length);
	});

	req.end(options.data);
}

function download_response(res, uri, options) {

	res._bufferlength = 0;

	// We have redirect
	if (res.statusCode === 301 || res.statusCode === 302) {

		if (options.redirect > 3) {
			options.callback && options.callback(new Error('Too many redirects.'));
			res.req.removeAllListeners();
			res.req = null;
			res.removeAllListeners();
			res = null;
			return;
		}

		options.redirect++;

		var tmp = parser.parse(res.headers['location']);
		tmp.headers = uri.headers;
		tmp.agent = false;
		tmp.method = uri.method;
		res.req.removeAllListeners();
		res.req = null;

		if (!options.resolve) {
			res.removeAllListeners();
			res = null;
			return download_call(tmp, options);
		}

		exports.resolve(res.headers['location'], function(err, u) {
			if (!err)
				tmp.host = u.host;
			res.removeAllListeners();
			res = null;
			download_call(tmp, options);
		});

		return;
	}

	res.on('data', function(chunk) {
		var self = this;
		self._bufferlength += chunk.length;
		options.evt && options.evt.emit('data', chunk, options.length ? (self._bufferlength / options.length) * 100 : 0);
	});

	res.on('end', function() {
		var self = this;
		var str = self._buffer ? self._buffer.toString(options.encoding) : '';

		self._buffer = undefined;

		if (options.evt) {
			options.evt.emit('end', str, self.statusCode, self.headers, uri.host);
			options.evt.removeAllListeners();
			options.evt = null;
		}

		res.req && res.req.removeAllListeners();
		res.removeAllListeners();
	});

	res.resume();
	options.callback && options.callback(null, res, res.statusCode, res.headers, uri.host);
}

exports.$$download = function(url, flags, data, cookies, headers, encoding, timeout) {
	return function(callback) {
		exports.download(url, flags, data, callback, cookies, headers, encoding, timeout);
	};
};

/**
 * Send a stream through HTTP
 * @param {String} name Filename with extension.
 * @param {Stream} stream Stream.
 * @param {String} url A valid URL address.
 * @param {Function} callback Callback.
 * @param {Object} headers Custom headers (optional).
 * @param {String} method HTTP method (optional, default POST).
 * @param {Number} timeout Request timeout, default: 60000 (1 minute)
 */
exports.send = function(name, stream, url, callback, cookies, headers, method, timeout) {

	if (typeof(stream) === 'string')
		stream = fs.createReadStream(stream, STREAM_READONLY);

	var BOUNDARY = '----totaljs' + Math.random().toString(16).substring(2);
	var h = {};

	if (headers)
		exports.extend(h, headers);

	if (cookies) {
		var builder = '';
		for (var m in cookies)
			builder += (builder ? '; ' : '') + m + '=' + cookies[m];
		if (builder)
			h['Cookie'] = builder;
	}

	name = exports.getName(name);

	h['Cache-Control'] = 'max-age=0';
	h['Content-Type'] = 'multipart/form-data; boundary=' + BOUNDARY;

	var e = new events.EventEmitter();
	var uri = parser.parse(url);
	var options = { protocol: uri.protocol, auth: uri.auth, method: method || 'POST', hostname: uri.hostname, port: uri.port, path: uri.path, agent: false, headers: h };
	var responseLength = 0;

	var response = function(res) {

		res.body = new Buffer(0);
		res._bufferlength = 0;

		res.on('data', function(chunk) {
			res.body = Buffer.concat([res.body, chunk]);
			res._bufferlength += chunk.length;
			e.emit('data', chunk, responseLength ? (res._bufferlength / responseLength) * 100 : 0);
		});

		res.on('end', function() {
			var self = this;
			e.emit('end', self.statusCode, self.headers);
			e.removeAllListeners();
			e = null;
			callback && callback(null, self.body.toString('utf8'), self.statusCode, self.headers, uri.host);
			self.body = null;
		});
	};

	var connection = options.protocol === 'https:' ? https : http;
	var req = connection.request(options, response);

	req.on('response', function(response) {
		responseLength = +response.headers['content-length'] || 0;
		e.emit('begin', responseLength);
	});

	req.setTimeout(timeout || 60000, function() {
		req.removeAllListeners();
		req = null;
		e.removeAllListeners();
		e = null;
		callback && callback(new Error(exports.httpStatus(408)), '', 408, undefined, uri.host);
	});

	req.on('error', function(err) {
		req.removeAllListeners();
		req = null;
		e.removeAllListeners();
		e = null;
		callback && callback(err, '', 0, undefined, uri.host);
	});

	req.on('close', function() {
		req.removeAllListeners();
		req = null;
	});

	var header = NEWLINE + NEWLINE + '--' + BOUNDARY + NEWLINE + 'Content-Disposition: form-data; name="File"; filename="' + name + '"' + NEWLINE + 'Content-Type: ' + exports.getContentType(exports.getExtension(name)) + NEWLINE + NEWLINE;
	req.write(header);

	// Is Buffer
	if (stream.length) {
		req.end(stream.toString(ENCODING) + NEWLINE + NEWLINE + '--' + BOUNDARY + '--');
		return e;
	}

	stream.on('end', () => req.end(NEWLINE + NEWLINE + '--' + BOUNDARY + '--'));
	stream.pipe(req, STREAM_END);
	return e;
};

exports.$$send = function(name, stream, url, cookies, headers, method, timeout) {
	return function(callback) {
		exports.send(name, stream, url, callback, cookies, headers, method, timeout);
	};
};

/**
 * Trim string properties
 * @param {Object} obj
 * @return {Object}
 */
exports.trim = function(obj, clean) {

	if (!obj)
		return obj;

	var type = typeof(obj);
	if (type === 'string') {
		obj = obj.trim();
		return clean && !obj ? undefined : obj;
	}

	if (obj instanceof Array) {
		for (var i = 0, length = obj.length; i < length; i++) {

			var item = obj[i];
			type = typeof(item);

			if (type === 'object') {
				exports.trim(item, clean);
				continue;
			}

			if (type !== 'string')
				continue;

			obj[i] = item.trim();
			if (clean && !obj[i])
				obj[i] = undefined;
		}

		return obj;
	}

	if (type !== 'object')
		return obj;

	var keys = Object.keys(obj);
	for (var i = 0, length = keys.length; i < length; i++) {
		var val = obj[keys[i]];
		var type = typeof(val);
		if (type === 'object') {
			exports.trim(val, clean);
			continue;
		} else if (type !== 'string')
			continue;
		obj[keys[i]] = val.trim();
		if (clean && !obj[keys[i]])
			obj[keys[i]] = undefined;
	}

	return obj;
};

/**
 * Noop function
 * @return {Function} Empty function.
 */
exports.noop = global.noop = global.NOOP = function() {};

/**
 * Read HTTP status
 * @param  {Number} code HTTP code status.
 * @param  {Boolean} addCode Add code number to HTTP status.
 * @return {String}
 */
exports.httpStatus = function(code, addCode) {
	if (addCode === undefined)
		addCode = true;
	return (addCode ? code + ': ' : '') + http.STATUS_CODES[code];
};

/**
 * Extend object
 * @param {Object} target Target object.
 * @param {Object} source Source object.
 * @param {Boolean} rewrite Rewrite exists values (optional, default true).
 * @return {Object} Modified object.
 */
exports.extend = function(target, source, rewrite) {

	if (!target || !source)
		return target;

	if (typeof(target) !== 'object' || typeof(source) !== 'object')
		return target;

	if (rewrite === undefined)
		rewrite = true;

	var keys = Object.keys(source);
	var i = keys.length;

	while (i--) {
		var key = keys[i];
		if (rewrite || target[key] === undefined)
			target[key] = exports.clone(source[key]);
	}

	return target;
};

/**
 * Clones object
 * @param {Object} obj
 * @param {Object} skip Optional, can be only object e.g. { name: true, age: true }.
 * @param {Boolean} skipFunctions It doesn't clone functions, optional --> default false.
 * @return {Object}
 */
exports.clone = function(obj, skip, skipFunctions) {

	if (!obj)
		return obj;

	var type = typeof(obj);
	if (type !== 'object' || obj instanceof Date)
		return obj;

	var length;
	var o;

	if (obj instanceof Array) {

		length = obj.length;
		o = new Array(length);

		for (var i = 0; i < length; i++) {
			type = typeof(obj[i]);
			if (type !== 'object' || obj[i] instanceof Date) {
				if (skipFunctions && type === 'function')
					continue;
				o[i] = obj[i];
				continue;
			}
			o[i] = exports.clone(obj[i], skip, skipFunctions);
		}

		return o;
	}

	o = {};

	for (var m in obj) {

		if (skip && skip[m])
			continue;

		var val = obj[m];
		var type = typeof(val);
		if (type !== 'object' || val instanceof Date) {
			if (skipFunctions && type === 'function')
				continue;
			o[m] = val;
			continue;
		}

		o[m] = exports.clone(obj[m], skip, skipFunctions);
	}

	return o;
}

/**
 * Copy values from object to object
 * @param {Object} source Object source
 * @param {Object} target Object target (optional)
 * @return {Object} Modified object.
 */
exports.copy = function(source, target) {

	if (target === undefined)
		return exports.extend({}, source, true);

	if (!target || !source || typeof(target) !== 'object' || typeof(source) !== 'object')
		return target;

	var keys = Object.keys(source);
	var i = keys.length;

	while (i--) {
		var key = keys[i];
		if (target[key] !== undefined)
			target[key] = exports.clone(source[key]);
	}

	return target;
};

/**
 * Reduce an object
 * @param {Object} source Source object.
 * @param {String Array or Object} prop Other properties than these ones will be removed.
 * @param {Boolean} reverse Reverse reducing (prop will be removed), default: false.
 * @return {Object}
 */
exports.reduce = function(source, prop, reverse) {

	if (!(prop instanceof Array)) {
		if (typeof(prop) === 'object')
			return exports.reduce(source, Object.keys(prop), reverse);
	}

	if (source instanceof Array) {
		var arr = [];
		for (var i = 0, length = source.length; i < length; i++)
			arr.push(exports.reduce(source[i], prop, reverse));
		return arr;
	}

	var output = {};

	Object.keys(source).forEach(function(o) {
		if (reverse) {
			if (prop.indexOf(o) === -1)
				output[o] = source[o];
		} else {
			if (prop.indexOf(o) !== -1)
				output[o] = source[o];
		}
	});

	return output;
};

/**
 * Assign value to an object according to a path
 * @param {Object} obj Source object.
 * @param {String} path Path to the update.
 * @param {Object or Function} fn Value or Function to update.
 * @return {Object}
 */
exports.assign = function(obj, path, fn) {

	if (obj == null)
		return obj;

	var arr = path.split('.');
	var model = obj[arr[0]];

	for (var i = 1; i < arr.length - 1; i++)
		model = model[arr[i]];

	model[arr[arr.length - 1]] = typeof (fn) === 'function' ? fn(model[arr[arr.length - 1]]) : fn;
	return obj;
};

/**
 * Checks if is relative url
 * @param {String} url
 * @return {Boolean}
 */
exports.isRelative = function(url) {
	return !(url.substring(0, 2) === '//' || url.indexOf('http://') !== -1 || url.indexOf('https://') !== -1);
};

/**
 * Streamer method
 * @param {String} beg
 * @param {String} end
 * @param {Function(value, index)} callback
 */
exports.streamer = function(beg, end, callback) {

	if (typeof(end) === 'function') {
		callback = end;
		end = undefined;
	}

	var indexer = 0;
	var buffer = new Buffer(0);

	beg = new Buffer(beg, 'utf8');
	if (end)
		end = new Buffer(end, 'utf8');

	if (!end) {
		var length = beg.length;
		return function(chunk) {

			if (!chunk)
				return;

			buffer = Buffer.concat([buffer, chunk]);

			var index = buffer.indexOf(beg);
			if (index === -1)
				return;

			while (index !== -1) {
				callback(buffer.toString('utf8', 0, index + length), indexer++);
				buffer = buffer.slice(index + length);
				index = buffer.indexOf(beg);
				if (index === -1)
					return;
			}
		};
	}

	var blength = beg.length;
	var elength = end.length;
	var bi = -1;
	var ei = -1;
	var is = false;

	return function(chunk) {

		if (!chunk)
			return;

		buffer = Buffer.concat([buffer, chunk]);

		if (!is) {
			bi = buffer.indexOf(beg);
			if (bi === -1)
				return;
			is = true;
		}

		if (is) {
			ei = buffer.indexOf(end, bi + blength);
			if (ei === -1)
				return;
		}

		while (bi !== -1) {
			callback(buffer.toString('utf8', bi, ei + elength), indexer++);
			buffer = buffer.slice(ei + elength);
			is = false;
			bi = buffer.indexOf(beg);
			if (bi === -1)
				return;
			is = true;
			ei = buffer.indexOf(end, bi + blength);
			if (ei === -1)
				return;
		}
	};
};

/**
 * HTML encode string
 * @param {String} str
 * @return {String}
 */
exports.encode = function(str) {

	if (str == null)
		return '';

	var type = typeof(str);

	if (type !== 'string')
		str = str.toString();

	return str.encode();
};

/**
 * HTML decode string
 * @param {String} str
 * @return {String}
 */
exports.decode = function(str) {

	if (str == null)
		return '';

	var type = typeof(str);

	if (type !== 'string')
		str = str.toString();

	return str.decode();
};

/**
 * Checks if URL contains file extension.
 * @param {String} url
 * @return {Boolean}
 */
exports.isStaticFile = function(url) {
	return regexpSTATIC.test(url);
};

/**
 * Converts Value to number
 * @param {Object} obj Value to convert.
 * @param {Number} def Default value (default: 0).
 * @return {Number}
 */
exports.parseInt = function(obj, def) {
	if (obj == null)
		return def || 0;
	var type = typeof(obj);
	if (type === 'number')
		return obj;
	return (type !== 'string' ? obj.toString() : obj).parseInt();
};

exports.parseBool = exports.parseBoolean = function(obj, def) {

	if (obj == null)
		return def === undefined ? false : def;

	var type = typeof(obj);
	if (type === 'boolean')
		return obj;

	if (type === 'number')
		return obj > 0;

	var str = type !== 'string' ? obj.toString() : obj;
	return str.parseBool(def);
};

/**
 * Converts Value to float number
 * @param {Object} obj Value to convert.
 * @param {Number} def Default value (default: 0).
 * @return {Number}
 */
exports.parseFloat = function(obj, def) {

	if (obj == null)
		return def || 0;

	var type = typeof(obj);
	if (type === 'number')
		return obj;

	var str = type !== 'string' ? obj.toString() : obj;
	return str.parseFloat(def);
};

/**
 * Check if the object is Array.
 * @param {Object} obj
 * @return {Boolean}
 */
exports.isArray = function(obj) {
	return obj instanceof Array;
};

/**
 * Check if the object is RegExp
 * @param {Object} obj
 * @return {Boolean}
 */
exports.isRegExp = function(obj) {
	return obj && typeof(obj.test) === 'function' ? true : false;
};

/**
 * Check if the object is Date
 * @param {Object} obj
 * @return {Boolean}
 */
exports.isDate = function(obj) {
	return obj instanceof Date && obj.getTime() > -1 ? true : false;
};

/**
 * Check if the object is Date
 * @param {Object} obj
 * @return {Boolean}
 */
exports.isError = function(obj) {
	return (obj && obj.stack) ? true : false;;
};

/**
 * Check if the value is object
 * @param {Object} value
 * @return {Boolean}
 */
exports.isObject = function(value) {
	try {
		return (value && Object.getPrototypeOf(value) === Object.prototype) ? true : false;
	} catch (e) {
		return false;
	}
};

/**
 * Get ContentType from file extension.
 * @param {String} ext File extension.
 * @return {String}
 */
exports.getContentType = function(ext) {
	if (ext[0] === '.')
		ext = ext.substring(1);
	return CONTENTTYPES[ext.toLowerCase()] || 'application/octet-stream';
};

/**
 * Get extension from filename
 * @param {String} filename
 * @return {String}
 */
exports.getExtension = function(filename) {
	var index = filename.lastIndexOf('.');
	return index !== -1 && filename.indexOf('/', index - 1) === -1 ? filename.substring(index + 1) : '';
};

/**
 * Get base name from path
 * @param {String} path
 * @return {String}
 */
exports.getName = function(path) {
	var l = path.length - 1;
	var c = path[l];
	if (c === '/' || c === '\\')
		path = path.substring(0, l);
	var index = path.lastIndexOf('/');
	if (index !== -1)
		return path.substring(index + 1);
	index = path.lastIndexOf('\\');
	if (index !== -1)
		return path.substring(index + 1);
	return path;
};

/**
 * Add a new content type to content types
 * @param {String} ext File extension.
 * @param {String} type Content type (example: application/json).
 */
exports.setContentType = function(ext, type) {
	if (ext[0] === '.')
		ext = ext.substring(1);

	if (ext.length > 8) {
		var tmp = regexpSTATIC.toString().replace(/\,\d+\}/, ',' + ext.length + '}').substring(1);
		regexpSTATIC = new RegExp(tmp.substring(0, tmp.length - 1));
	}

	CONTENTTYPES[ext.toLowerCase()] = type;
	return true;
};

/**
 * Create eTag hash from text
 * @param {String} text
 * @param {String} version
 * @return {String}
 */
exports.etag = function(text, version) {
	var sum = 0;
	var length = text.length;
	for (var i = 0; i < length; i++)
		sum += text.charCodeAt(i);
	return sum.toString() + (version ? ':' + version : '');
};

exports.path = function(path, delimiter) {

	if (!path)
		path = '';

	delimiter = delimiter || '/';
	if (path[path.length - 1] === delimiter)
		return path;

	return path + delimiter;
};

exports.join = function() {
	var path = [''];

	for (var i = 0; i < arguments.length; i++) {
		var current = arguments[i];
		if (!current)
			continue;
		if (current[0] === '/')
			current = current.substring(1);
		var l = current.length - 1;
		if (current[l] === '/')
			current = current.substring(0, l);
		path.push(current);
	}

	path = path.join('/');
	return !isWindows ? path : path.indexOf(':') > -1 ? path.substring(1) : path;
};

/**
 * Prepares Windows path to UNIX like format
 * @internal
 * @param {String} path
 * @return {String}
 */
exports.$normalize = function(path) {
	return isWindows ? path.replace(regexpPATH, '/') : path;
};

exports.random = function(max, min) {
	max = (max || 100000);
	min = (min || 0);
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

function rnd() {
	return Math.floor(Math.random() * 65536).toString(36);
}

exports.GUID = function(max) {
	max = max || 40;
	var str = '';
	for (var i = 0; i < (max / 3) + 1; i++)
		str += rnd();
	return str.substring(0, max);
};

function validate_builder_default(name, value, entity) {

	var type = typeof(value);

	// Enum + KeyValue (8+9)
	if (entity.type > 7)
		return value !== undefined;

	switch (entity.subtype) {
		case 'uid':
			var number = parseInt(value.substring(10, value.length - 4), 10);
			return isNaN(number) ? false : value[value.length - 1] === (number % 2 ? '1' : '0');
		case 'zip':
			return value.isZIP();
		case 'email':
			return value.isEmail();
		case 'json':
			return value.isJSON();
		case 'url':
			return value.isURL();
		case 'phone':
			return value.isPhone();
	}

	if (type === 'number')
		return value > 0;

	if (type === 'string' || value instanceof Array)
		return value.length > 0;

	if (type === 'boolean')
		return value === true;

	if (value == null)
		return false;

	if (value instanceof Date)
		return value.toString()[0] !== 'I'; // Invalid Date

	return true;
}

exports.validate_builder = function(model, error, schema, collection, path, index, fields, pluspath) {

	var entity = collection[schema];
	var prepare = entity.onValidate || framework.onValidate || NOOP;
	var current = path === undefined ? '' : path + '.';
	var properties = entity.properties;

	if (!pluspath)
		pluspath = '';

	if (model == null)
		model = {};

	for (var i = 0; i < properties.length; i++) {

		var name = properties[i].toString();
		if (fields && fields.indexOf(name) === -1)
			continue;

		var value = model[name];
		var type = typeof(value);
		var TYPE = collection[schema].schema[name];

		if (value === undefined) {
			error.add(pluspath + name, '@', current + name);
			continue;
		} else if (type === 'function')
			value = model[name]();

		if (type !== 'object') {
			if (Builders.isJoin(collection, name))
				type = 'object';
		}

		if (type === 'object' && !exports.isDate(value)) {
			entity = collection[schema];

			if (entity) {
				entity = entity.schema[name] || null;

				if (entity === Date || entity === String || entity === Number || entity === Boolean) {
					// Empty
				} else if (entity && typeof(entity) === 'string') {

					var isArray = entity[0] === '[';

					if (!isArray) {
						exports.validate_builder(value, error, schema, collection, current + name, index, undefined, pluspath);
						continue;
					}

					entity = entity.substring(1, entity.length - 1).trim();

					if (!(value instanceof Array)) {
						error.add(pluspath + name, (pluspath ? '@' + name : '@'), current + name, index);
						continue;
					}

					// The schema not exists
					if (collection[entity] === undefined) {

						var result2 = prepare(name, value, current + name, model, schema, TYPE);
						if (result2 === undefined) {
							result2 = validate_builder_default(name, value, TYPE);
							if (result2)
								continue;
						}

						type = typeof(result2);

						if (type === 'string') {
							error.add(pluspath + name, result2, current + name, index);
							continue;
						}

						if (type === 'boolean' && !result2) {
							error.add(pluspath + name, (pluspath ? '@' + name : '@'), current + name, index);
							continue;
						}

						if (result2.isValid === false)
							error.add(pluspath + name, result2.error, current + name, index);

						continue;
					}

					var result3 = prepare(name, value, current + name, model, schema, TYPE);
					if (result3 === undefined) {
						result3 = validate_builder_default(name, value, TYPE);
						if (result3)
							continue;
					}

					if (result3 !== undefined) {

						type = typeof(result3);

						if (type === 'string') {
							error.add(pluspath + name, result3, current + name, index);
							continue;
						}

						if (type === 'boolean' && !result3) {
							error.add(pluspath + name, (pluspath ? '@' + name : '@'), current + name, index);
							continue;
						}

						if (result3.isValid === false) {
							error.add(pluspath + name, result3.error, current + name, index);
							continue;
						}
					}

					var sublength = value.length;
					for (var j = 0; j < sublength; j++)
						exports.validate_builder(value[j], error, entity, collection, current + name, j, undefined, pluspath);
					continue;
				}
			}
		}

		var result = prepare(name, value, current + name, model, schema, TYPE);
		if (result === undefined) {
			result = validate_builder_default(name, value, TYPE);
			if (result)
				continue;
		}

		type = typeof(result);

		if (type === 'string') {
			error.add(pluspath + name, result, current + name, index);
			continue;
		}

		if (type === 'boolean') {
			if (!result)
				error.add(pluspath + name, (pluspath ? '@' + name : '@'), current + name, index);
			continue;
		}

		if (result.isValid === false)
			error.add(pluspath + name, result.error, current + name, index);
	}

	return error;
};

/**
 * Combine paths
 * @return {String}
 */
exports.combine = function() {

	var p = framework.directory;

	for (var i = 0, length = arguments.length; i < length; i++) {
		var v = arguments[i];
		if (!v)
			continue;
		if (v[0] === '/')
			v = v.substring(1);

		if (v[0] === '~')
			p = v.substring(1);
		else
			p += (p[p.length - 1] !== '/' ? '/' : '') + v;
	}
	return exports.$normalize(p);
};

/**
 * Remove diacritics
 * @param {String} str
 * @return {String}
 */
exports.removeDiacritics = function(str) {
	return str.replace(regexpDiacritics, c => DIACRITICSMAP[c] || c);
};

/**
 * Simple XML parser
 * @param {String} xml
 * @return {Object}
 */
exports.parseXML = function(xml) {

	var beg = -1;
	var end = 0;
	var tmp = 0;
	var current = [];
	var obj = {};
	var from = -1;

	while (true) {
		beg = xml.indexOf('<![CDATA[', beg);
		if (beg === -1)
			break;
		end = xml.indexOf(']]>', beg + 9);
		xml = xml.substring(0, beg) + xml.substring(beg + 9, end).trim().encode() + xml.substring(end + 3);
		beg += 9;
	}

	beg = -1;
	end = 0;

	while (true) {

		beg = xml.indexOf('<', beg + 1);
		if (beg === -1)
			break;

		end = xml.indexOf('>', beg + 1);
		if (end === -1)
			break;

		var el = xml.substring(beg, end + 1);
		var c = el[1];

		if (c === '?' || c === '/') {

			var o = current.pop();

			if (from === -1 || o !== el.substring(2, el.length - 1))
				continue;

			var path = (current.length ? current.join('.') + '.' : '') + o;
			var value = xml.substring(from, beg).decode();

			if (obj[path] === undefined)
				obj[path] = value;
			else if (obj[path] instanceof Array)
				obj[path].push(value);
			else
				obj[path] = [obj[path], value];

			from = -1;
			continue;
		}

		tmp = el.indexOf(' ');
		var hasAttributes = true;

		if (tmp === -1) {
			tmp = el.length - 1;
			hasAttributes = false;
		}

		from = beg + el.length;

		var isSingle = el[el.length - 2] === '/';
		var name = el.substring(1, tmp);

		if (!isSingle)
			current.push(name);

		if (!hasAttributes)
			continue;

		var match = el.match(regexpXML);
		if (!match)
			continue;

		var attr = {};
		var length = match.length;

		for (var i = 0; i < length; i++) {
			var index = match[i].indexOf('"');
			attr[match[i].substring(0, index - 1)] = match[i].substring(index + 1, match[i].length - 1).decode();
		}

		obj[current.join('.') + (isSingle ? '.' + name : '') + '[]'] = attr;
	}

	return obj;
};

exports.parseJSON = function(value) {
	try {
		return JSON.parse(value);
	} catch(e) {
		return null;
	}
};

exports.parseQuery = function(value) {
	return framework.onParseQuery(value);
};

/**
 * Get WebSocket frame
 * @author Jozef Gula <gula.jozef@gmail.com>
 * @param {Number} code
 * @param {Buffer or String} message
 * @param {Hexa} type
 * @return {Buffer}
 */
exports.getWebSocketFrame = function(code, message, type) {
	var messageBuffer = getWebSocketFrameMessageBytes(code, message);
	var messageLength = messageBuffer.length;
	var lengthBuffer = getWebSocketFrameLengthBytes(messageLength);
	var frameBuffer = new Buffer(1 + lengthBuffer.length + messageLength);
	frameBuffer[0] = 0x80 | type;
	lengthBuffer.copy(frameBuffer, 1, 0, lengthBuffer.length);
	messageBuffer.copy(frameBuffer, lengthBuffer.length + 1, 0, messageLength);
	return frameBuffer;
};

/**
 * Get bytes of WebSocket frame message
 * @author Jozef Gula <gula.jozef@gmail.com>
 * @param  {Number} code
 * @param  {Buffer or String} message
 * @return {Buffer}
 */
function getWebSocketFrameMessageBytes(code, message) {

	var index = code ? 2 : 0;
	var binary = message instanceof Int8Array;
	var length = message.length;

	var messageBuffer = new Buffer(length + index);

	for (var i = 0; i < length; i++) {
		if (binary)
			messageBuffer[i + index] = message[i];
		else
			messageBuffer[i + index] = message.charCodeAt(i);
	}

	if (!code)
		return messageBuffer;

	messageBuffer[0] = (code >> 8);
	messageBuffer[1] = (code);

	return messageBuffer;
}

/**
 * Get length of WebSocket frame
 * @author Jozef Gula <gula.jozef@gmail.com>
 * @param  {Number} length
 * @return {Number}
 */
function getWebSocketFrameLengthBytes(length) {
	var lengthBuffer = null;

	if (length <= 125) {
		lengthBuffer = new Buffer(1);
		lengthBuffer[0] = length;
		return lengthBuffer;
	}

	if (length <= 65535) {
		lengthBuffer = new Buffer(3);
		lengthBuffer[0] = 126;
		lengthBuffer[1] = (length >> 8) & 255;
		lengthBuffer[2] = (length) & 255;
		return lengthBuffer;
	}

	lengthBuffer = new Buffer(9);

	lengthBuffer[0] = 127;
	lengthBuffer[1] = 0x00;
	lengthBuffer[2] = 0x00;
	lengthBuffer[3] = 0x00;
	lengthBuffer[4] = 0x00;
	lengthBuffer[5] = (length >> 24) & 255;
	lengthBuffer[6] = (length >> 16) & 255;
	lengthBuffer[7] = (length >> 8) & 255;
	lengthBuffer[8] = (length) & 255;

	return lengthBuffer;
}

/**
 * GPS distance in KM
 * @param  {Number} lat1
 * @param  {Number} lon1
 * @param  {Number} lat2
 * @param  {Number} lon2
 * @return {Number}
 */
exports.distance = function(lat1, lon1, lat2, lon2) {
	var R = 6371;
	var dLat = (lat2 - lat1).toRad();
	var dLon = (lon2 - lon1).toRad();
	var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return (R * c).floor(3);
};

/**
 * Directory listing
 * @param {String} path Path.
 * @param {Function(files, directories)} callback Callback
 * @param {Function(filename),isDirectory or String or RegExp} filter Custom filter (optional).
 */
exports.ls = function(path, callback, filter) {
	var filelist = new FileList();
	filelist.onComplete = callback;

	if (typeof(filter) === 'string') {
		filter = filter.toLowerCase();
		filter.onFilter = function(filename, is) {
			return is ? true : filename.toLowerCase().indexOf(filter);
		};
	} else if (exports.isRegExp(filter)) {
		filter.onFilter = function(filename, is) {
			return is ? true : filter.test(filename);
		};
	} else
		filelist.onFilter = filter || null;

	filelist.walk(path);
};

/**
 * Advanced Directory listing
 * @param {String} path Path.
 * @param {Function(files, directories)} callback Callback
 * @param {Function(filename),isDirectory or String or RegExp} filter Custom filter (optional).
 */
exports.ls2 = function(path, callback, filter) {
	var filelist = new FileList();
	filelist.advanced = true;
	filelist.onComplete = callback;

	if (typeof(filter) === 'string') {
		filter = filter.toLowerCase();
		filter.onFilter = function(filename, is) {
			return is ? true : filename.toLowerCase().indexOf(filter);
		};
	} else if (exports.isRegExp(filter)) {
		filter.onFilter = function(filename, is) {
			return is ? true : filter.test(filename);
		};
	} else
		filelist.onFilter = filter || null;

	filelist.walk(path);
};

Date.prototype.add = function(type, value) {

	var self = this;

	if (type.constructor === Number)
		return new Date(self.getTime() + (type - type%1));

	if (value === undefined) {
		var arr = type.split(' ');
		type = arr[1];
		value = exports.parseInt(arr[0]);
	}

	var dt = new Date(self.getTime());

	switch(type) {
		case 's':
		case 'ss':
		case 'sec':
		case 'second':
		case 'seconds':
			dt.setSeconds(dt.getSeconds() + value);
			return dt;
		case 'm':
		case 'mm':
		case 'minute':
		case 'min':
		case 'minutes':
			dt.setMinutes(dt.getMinutes() + value);
			return dt;
		case 'h':
		case 'hh':
		case 'hour':
		case 'hours':
			dt.setHours(dt.getHours() + value);
			return dt;
		case 'd':
		case 'dd':
		case 'day':
		case 'days':
			dt.setDate(dt.getDate() + value);
			return dt;
		case 'w':
		case 'ww':
		case 'week':
		case 'weeks':
			dt.setDate(dt.getDate() + (value * 7));
			return dt;
		case 'M':
		case 'MM':
		case 'month':
		case 'months':
			dt.setMonth(dt.getMonth() + value);
			return dt;
		case 'y':
		case 'yyyy':
		case 'year':
		case 'years':
			dt.setFullYear(dt.getFullYear() + value);
			return dt;
	}
	return dt;
};

/**
 * Date difference
 * @param  {Date/Number/String} date Optional.
 * @param  {String} type Date type: minutes, seconds, hours, days, months, years
 * @return {Number}
 */
Date.prototype.diff = function(date, type) {

	if (arguments.length === 1) {
		type = date;
		date = Date.now();
	} else {
		var to = typeof(date);
		if (to === 'string')
			date = Date.parse(date);
		else if (exports.isDate(date))
			date = date.getTime();
	}

	var r = this.getTime() - date;

	switch (type) {
		case 's':
		case 'ss':
		case 'second':
		case 'seconds':
			return Math.ceil(r / 1000);
		case 'm':
		case 'mm':
		case 'minute':
		case 'minutes':
			return Math.ceil((r / 1000) / 60);
		case 'h':
		case 'hh':
		case 'hour':
		case 'hours':
			return Math.ceil(((r / 1000) / 60) / 60);
		case 'd':
		case 'dd':
		case 'day':
		case 'days':
			return Math.ceil((((r / 1000) / 60) / 60) / 24);
		case 'M':
		case 'MM':
		case 'month':
		case 'months':
			// avg: 28 days per month
			return Math.ceil((((r / 1000) / 60) / 60) / (24 * 28));

		case 'y':
		case 'yyyy':
		case 'year':
		case 'years':
			// avg: 28 days per month
			return Math.ceil((((r / 1000) / 60) / 60) / (24 * 28 * 12));
	}

	return NaN;
};

Date.prototype.extend = function(date) {
	var dt = new Date(this);
	var match = date.match(regexpDATE);

	if (!match)
		return dt;

	for (var i = 0, length = match.length; i < length; i++) {
		var m = match[i];
		var arr, tmp;

		if (m.indexOf(':') !== -1) {

			arr = m.split(':');
			tmp = +arr[0];
			!isNaN(tmp) && dt.setHours(tmp);

			if (arr[1]) {
				tmp = +arr[1];
				!isNaN(tmp) && dt.setMinutes(tmp);
			}

			if (arr[2]) {
				tmp = +arr[2];
				!isNaN(tmp) && dt.setSeconds(tmp);
			}

			continue;
		}

		if (m.indexOf('-') !== -1) {
			arr = m.split('-');

			tmp = +arr[0];
			dt.setFullYear(tmp);

			if (arr[1]) {
				tmp = +arr[1];
				!isNaN(tmp) && dt.setMonth(tmp - 1);
			}

			if (arr[2]) {
				tmp = +arr[2];
				!isNaN(tmp) && dt.setDate(tmp);
			}

			continue;
		}

		if (m.indexOf('.') !== -1) {
			arr = m.split('.');

			tmp = +arr[0];
			dt.setDate(tmp);

			if (arr[1]) {
				tmp = +arr[1];
				!isNaN(tmp) && dt.setMonth(tmp - 1);
			}

			if (arr[2]) {
				tmp = +arr[2];
				!isNaN(tmp) && dt.setFullYear(tmp);
			}

			continue;
		}
	}

	return dt;
};

/**
 * Compare dates
 * @param {Date} date
 * @return {Number} Results: -1 = current date is earlier than @date, 0 = current date is same as @date, 1 = current date is later than @date
 */
Date.prototype.compare = function(date) {

	var self = this;
	var r = self.getTime() - date.getTime();

	if (r === 0)
		return 0;

	if (r < 0)
		return -1;

	return 1;
};

/**
 * Compare two dates
 * @param {String or Date} d1
 * @param {String or Date} d2
 * @return {Number} Results: -1 = @d1 is earlier than @d2, 0 = @d1 is same as @d2, 1 = @d1 is later than @d2
 */
Date.compare = function(d1, d2) {

	if (typeof(d1) === 'string')
		d1 = d1.parseDate();

	if (typeof(d2) === 'string')
		d2 = d2.parseDate();

	return d1.compare(d2);
};

/**
 * Format datetime
 * @param {String} format
 * @return {String}
 */
Date.prototype.format = function(format, resource) {

	var self = this;
	var half = false;

	if (format && format[0] === '!') {
		half = true;
		format = format.substring(1);
	}

	if (!format)
		return self.getFullYear() + '-' + (self.getMonth() + 1).toString().padLeft(2, '0') + '-' + self.getDate().toString().padLeft(2, '0') + 'T' + self.getHours().toString().padLeft(2, '0') + ':' + self.getMinutes().toString().padLeft(2, '0') + ':' + self.getSeconds().toString().padLeft(2, '0') + '.' + self.getMilliseconds().toString().padLeft(3, '0') + 'Z';

	var h = self.getHours();

	if (half) {
		if (h >= 12)
			h -= 12;
	}

	return format.replace(regexpDATEFORMAT, function(key) {
		switch (key) {
			case 'yyyy':
				return self.getFullYear();
			case 'yy':
				return self.getFullYear().toString().substring(2);
			case 'MMM':
				var m = MONTHS[self.getMonth()];
				return (framework ? framework.resource(resource, m) || m : m).substring(0, 3);
			case 'MMMM':
				var m = MONTHS[self.getMonth()];
				return (framework ? framework.resource(resource, m) || m : m);
			case 'MM':
				return (self.getMonth() + 1).toString().padLeft(2, '0');
			case 'M':
				return (self.getMonth() + 1);
			case 'ddd':
				var m = DAYS[self.getDay()];
				return (framework ? framework.resource(resource, m) || m : m).substring(0, 3);
			case 'dddd':
				var m = DAYS[self.getDay()];
				return (framework ? framework.resource(resource, m) || m : m);
			case 'dd':
				return self.getDate().toString().padLeft(2, '0');
			case 'd':
				return self.getDate();
			case 'HH':
			case 'hh':
				return h.toString().padLeft(2, '0');
			case 'H':
			case 'h':
				return self.getHours();
			case 'mm':
				return self.getMinutes().toString().padLeft(2, '0');
			case 'm':
				return self.getMinutes();
			case 'ss':
				return self.getSeconds().toString().padLeft(2, '0');
			case 's':
				return self.getSeconds();
			case 'w':
			case 'ww':
				var tmp = new Date(+self);
				tmp.setHours(0, 0, 0);
				tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
				tmp = Math.ceil((((tmp - new Date(tmp.getFullYear(), 0, 1)) / 8.64e7) + 1) / 7);
				if (key === 'ww')
					return tmp.toString().padLeft(2, '0');
				return tmp;
			case 'a':
				var a = 'AM';
				if (self.getHours() >= 12)
					a = 'PM';
				return a;
		}
	});
};

Date.prototype.toUTC = function(ticks) {
	var dt = this.getTime() + this.getTimezoneOffset() * 60000;
	return ticks ? dt : new Date(dt);
};

// +v2.2.0 parses JSON dates as dates and this is the fallback for backward compatibility
Date.prototype.parseDate = function() {
	return this;
};

String.prototype.isJSONDate = function() {
	var l = this.length - 1;
	return l > 22 && l < 30 && this[l] === 'Z' && this[10] === 'T' && this[4] === '-' && this[13] === ':' && this[16] === ':';
};

if (!String.prototype.trim) {
	String.prototype.trim = function() {
		return this.replace(regexpTRIM, '');
	};
}

if (!String.prototype.replaceAt) {
	String.prototype.replaceAt = function(index, character) {
		return this.substr(0, index) + character + this.substr(index + character.length);
	};
}

/**
 * Checks if the string starts with the text
 * @see {@link http://docs.totaljs.com/String.prototype/#String.prototype.startsWith|Documentation}
 * @param {String} text Text to find.
 * @param {Boolean/Number} ignoreCase Ingore case sensitive or position in the string.
 * @return {Boolean}
 */
String.prototype.startsWith = function(text, ignoreCase) {
	var self = this;
	var length = text.length;
	var tmp;

	if (ignoreCase === true) {
		tmp = self.substring(0, length);
		return tmp.length === length && tmp.toLowerCase() === text.toLowerCase();
	}

	if (ignoreCase)
		tmp = self.substr(ignoreCase, length);
	else
		tmp = self.substring(0, length);

	return tmp.length === length && tmp === text;
};

/**
 * Checks if the string ends with the text
 * @see {@link http://docs.totaljs.com/String.prototype/#String.prototype.endsWith|Documentation}
 * @param {String} text Text to find.
 * @param {Boolean/Number} ignoreCase Ingore case sensitive or position in the string.
 * @return {Boolean}
 */
String.prototype.endsWith = function(text, ignoreCase) {
	var self = this;
	var length = text.length;
	var tmp;

	if (ignoreCase === true) {
		tmp = self.substring(self.length - length);
		return tmp.length === length && tmp.toLowerCase() === text.toLowerCase();
	}

	if (ignoreCase)
		tmp = self.substr((self.length - ignoreCase) - length, length);
	else
		tmp = self.substring(self.length - length);

	return tmp.length === length && tmp === text;
};

String.prototype.replacer = function(find, text) {
	var self = this;
	var beg = self.indexOf(find);
	if (beg === -1)
		return self;
	return self.substring(0, beg) + text + self.substring(beg + find.length);
};

/**
 * Hash string
 * @param {String} type Hash type.
 * @param {String} salt Optional, salt.
 * @return {String}
 */
String.prototype.hash = function(type, salt) {
	var str = this;
	if (salt)
		str += salt;
	switch ((type || '').toLowerCase()) {
		case 'md5':
			return str.md5();
		case 'sha1':
			return str.sha1();
		case 'sha256':
			return str.sha256();
		case 'sha512':
			return str.sha512();
		default:
			return string_hash(str);
	}
};

function string_hash(s) {
	var hash = 0, i, char;
	if (s.length === 0)
		return hash;
	var l = s.length;
	for (i = 0; i < l; i++) {
		char = s.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
}

String.prototype.count = function(text) {
	var index = 0;
	var count = 0;
	do {
		index = this.indexOf(text, index + text.length);
		if (index > 0)
			count++;
	} while (index > 0);
	return count;
};

/**
 * Parse XML
 * @return {Object}
 */
String.prototype.parseXML = function() {
	return framework.onParseXML(this);
};

String.prototype.parseJSON = function() {
	return exports.parseJSON(this);
};

String.prototype.parseQuery = function() {
	return exports.parseQuery(this);
};

/**
 * Parse date from string
 * @return {Date}
 */
String.prototype.parseDate = function() {
	var self = this.trim();

	var lc = self.charCodeAt(self.length - 1);

	// Classic date
	if (lc === 41)
		return new Date(self);

	// JSON format
	if (lc === 90)
		return new Date(Date.parse(self));

	var arr = self.indexOf(' ') === -1 ? self.split('T') : self.split(' ');
	var index = arr[0].indexOf(':');
	var length = arr[0].length;

	if (index !== -1) {
		var tmp = arr[1];
		arr[1] = arr[0];
		arr[0] = tmp;
	}

	if (arr[0] === undefined)
		arr[0] = '';

	var noTime = arr[1] === undefined ? true : arr[1].length === 0;

	for (var i = 0; i < length; i++) {
		var c = arr[0].charCodeAt(i);
		if (c > 47 && c < 58)
			continue;
		if (c === 45 || c === 46)
			continue;

		if (noTime)
			return new Date(self);
	}

	if (arr[1] === undefined)
		arr[1] = '00:00:00';

	var firstDay = arr[0].indexOf('-') === -1;

	var date = (arr[0] || '').split(firstDay ? '.' : '-');
	var time = (arr[1] || '').split(':');
	var parsed = [];

	if (date.length < 4 && time.length < 2)
		return new Date(self);

	index = (time[2] || '').indexOf('.');

	// milliseconds
	if (index !== -1) {
		time[3] = time[2].substring(index + 1);
		time[2] = time[2].substring(0, index);
	} else
		time[3] = '0';

	parsed.push(+date[firstDay ? 2 : 0]); // year
	parsed.push(+date[1]); // month
	parsed.push(+date[firstDay ? 0 : 2]); // day
	parsed.push(+time[0]); // hours
	parsed.push(+time[1]); // minutes
	parsed.push(+time[2]); // seconds
	parsed.push(+time[3]); // miliseconds

	var def = new Date();

	for (var i = 0, length = parsed.length; i < length; i++) {
		if (isNaN(parsed[i]))
			parsed[i] = 0;

		var value = parsed[i];
		if (value !== 0)
			continue;

		switch (i) {
			case 0:
				if (value <= 0)
					parsed[i] = def.getFullYear();
				break;
			case 1:
				if (value <= 0)
					parsed[i] = def.getMonth() + 1;
				break;
			case 2:
				if (value <= 0)
					parsed[i] = def.getDate();
				break;
		}
	}

	return new Date(parsed[0], parsed[1] - 1, parsed[2], parsed[3], parsed[4], parsed[5]);
};

/**
 * Parse expiration date
 * @return {Date}
 */
String.prototype.parseDateExpiration = function() {
	var self = this;

	var arr = self.split(' ');
	var dt = new Date();
	var length = arr.length;

	for (var i = 0; i < length; i += 2) {

		var num = arr[i].parseInt();
		if (num === 0)
			continue;

		var type = arr[i + 1] || '';
		if (type === '')
			continue;

		dt = dt.add(type, num);
	}

	return dt;
};

String.prototype.contains = function(value, mustAll) {
	var str = this;

	if (typeof(value) === 'string')
		return str.indexOf(value, typeof(mustAll) === 'number' ? mustAll : 0) !== -1;

	for (var i = 0, length = value.length; i < length; i++) {
		var exists = str.indexOf(value[i]) !== -1;
		if (mustAll) {
			if (!exists)
				return false;
		} else if (exists)
			return true;
	}

	return mustAll;
};

/**
 * Same functionality as as String.localeCompare() but this method works with latin.
 * @param {String} value
 * @return {Number}
 */
String.prototype.localeCompare2 = function(value) {
	return this.removeDiacritics().localeCompare(value.removeDiacritics())
};

/**
 * Parse configuration from a string
 * @param {Object} def
 * @return {Object}
 */
String.prototype.parseConfig = function(def) {
	var arr = this.split('\n');
	var length = arr.length;
	var obj = exports.extend({}, def);
	var subtype;
	var name;
	var index;
	var value;

	for (var i = 0; i < length; i++) {

		var str = arr[i];

		if (!str || str[0] === '#')
			continue;

		if (str.substring(0, 2) === '//')
			continue;

		index = str.indexOf(' :');
		if (index === -1) {
			index = str.indexOf('\t:');
			if (index === -1)
				continue;
		}

		name = str.substring(0, index).trim();
		value = str.substring(index + 2).trim();

		index = name.indexOf('(');
		if (index !== -1) {
			subtype = name.substring(index + 1, name.indexOf(')')).trim().toLowerCase();
			name = name.substring(0, index).trim();
		} else
			subtype = '';

		switch (subtype) {
			case 'string':
				obj[name] = value;
				break;
			case 'number':
			case 'float':
			case 'double':
			case 'currency':
				obj[name] = value.isNumber(true) ? value.parseFloat() : value.parseInt();
				break;
			case 'boolean':
			case 'bool':
				obj[name] = value.parseBoolean();
				break;
			case 'eval':
			case 'object':
			case 'array':
				obj[name] = new Function('return ' + value)();
				break;
			case 'json':
				obj[name] = value.parseJSON();
				break;
			case 'env':
			case 'environment':
				obj[name] = process.env[value];
				break;
			case 'date':
			case 'time':
			case 'datetime':
				obj[name] = value.parseDate();
				break;
			default:
				obj[name] = value;
				break;
		}
	}

	return obj;
};

String.prototype.format = function() {
	var arg = arguments;
	return this.replace(regexpSTRINGFORMAT, function(text) {
		var value = arg[+text.substring(1, text.length - 1)];
		return value == null ? '' : value;
	});
};

String.prototype.encode = function() {
	var output = '';
	for (var i = 0, length = this.length; i < length; i++) {
		var c = this[i];
		switch (c) {
			case '<':
				output += '&lt;';
				break;
			case '>':
				output += '&gt;';
				break;
			case '"':
				output += '&quot;';
				break;
			case '\'':
				output += '&apos;';
				break;
			case '&':
				output += '&amp;';
				break;
			default:
				output += c;
				break;
		}
	}
	return output;
};

String.prototype.decode = function() {
	return this.replace(regexpDECODE, function(s) {
		if (s.charAt(1) !== '#')
			return ALPHA_INDEX[s] || s;
		var code = s[2].toLowerCase() === 'x' ? parseInt(s.substr(3), 16) : parseInt(s.substr(2));
		return !code || code < -32768 || code > 65535 ? '' : String.fromCharCode(code);
	});
};

String.prototype.urlEncode = function() {
	return encodeURIComponent(this);
};

String.prototype.urlDecode = function() {
	return decodeURIComponent(this);
};

String.prototype.params = function(obj) {
	var formatted = this;

	if (obj == null)
		return formatted;

	return formatted.replace(regexpPARAM, function(prop) {

		var isEncode = false;
		var name = prop.substring(2, prop.length - 2).trim();

		var format = '';
		var index = name.indexOf('|');

		if (index !== -1) {
			format = name.substring(index + 1, name.length).trim();
			name = name.substring(0, index).trim();
		}

		if (name[0] === '!')
			name = name.substring(1);
		else
			isEncode = true;

		var val;

		if (name.indexOf('.') !== -1) {
			var arr = name.split('.');
			if (arr.length === 2) {
				if (obj[arr[0]])
					val = obj[arr[0]][arr[1]];
			}
			else if (arr.length === 3) {
				if (obj[arr[0]] && obj[arr[0]][arr[1]])
					val = obj[arr[0]][arr[1]][arr[2]];
			}
			else if (arr.length === 4)
				if (obj[arr[0]] && obj[arr[0]][arr[1]] && obj[arr[0]][arr[1]][arr[2]])
					val = obj[arr[0]][arr[1]][arr[2]][arr[3]];
			else if (arr.length === 5) {
				if (obj[arr[0]] && obj[arr[0]][arr[1]] && obj[arr[0]][arr[1]][arr[2]] && obj[arr[0]][arr[1]][arr[2]][arr[3]])
					val = obj[arr[0]][arr[1]][arr[2]][arr[3]][arr[4]];
			}
		} else
			val = name.length ? obj[name] : obj;

		if (typeof(val) === 'function')
			val = val(index);

		if (val === undefined)
			return prop;

		if (format.length) {
			var type = typeof(val);
			if (type === 'string') {
				var max = +format;
				if (!isNaN(max))
					val = val.max(max + 3, '...');

			} else if (type === 'number' || exports.isDate(val)) {
				if (format.isNumber())
					format = +format;
				val = val.format(format);
			}
		}

		val = val.toString();
		return isEncode ? exports.encode(val) : val;
	});
};

String.prototype.max = function(length, chars) {
	var str = this;
	if (typeof(chars) !== 'string')
		chars = '...';
	return str.length > length ? str.substring(0, length - chars.length) + chars : str;
};

String.prototype.isJSON = function() {
	var self = this;
	if (self.length <= 1)
		return false;

	var l = self.length - 1;
	var a;
	var b;
	var i = 0;

	while (true) {
		a = self[i++];
		if (a === ' ' || a === '\n' || a === '\r' || a === '\t')
			continue;
		break;
	}

	while (true) {
		b = self[l--];
		if (b === ' ' || b === '\n' || b === '\r' || b === '\t')
			continue;
		break;
	}

	return (a === '"' && b === '"') || (a === '[' && b === ']') || (a === '{' && b === '}');
};

String.prototype.isURL = function() {
	return this.length <= 7 ? false : framework.validators.url.test(this);
};

String.prototype.isZIP = function() {
	return framework.validators.zip.test(this);
};

String.prototype.isEmail = function() {
	return this.length <= 4 ? false : framework.validators.email.test(this);
};

String.prototype.isPhone = function() {
	return this.length < 6 ? false : framework.validators.phone.test(this);
};

String.prototype.isUID = function() {
	return this.length < 18 ? false : framework.validators.uid.test(this);
};

String.prototype.parseInt = function(def) {
	var str = this.trim();
	var num = +str;
	return isNaN(num) ? (def || 0) : num;
};

String.prototype.parseInt2 = function(def) {
	var num = this.match(regexpINTEGER);
	return num ? +num : def || 0;
};

String.prototype.parseFloat2 = function(def) {
	var num = this.match(regexpFLOAT);
	return num ? +num.toString().replace(/\,/g, '.') : def || 0;
};

String.prototype.parseBool = String.prototype.parseBoolean = function() {
	var self = this.toLowerCase();
	return self === 'true' || self === '1' || self === 'on';
};

String.prototype.parseFloat = function(def) {
	var str = this.trim();
	if (str.indexOf(',') !== -1)
		str = str.replace(',', '.');
	var num = +str;
	return isNaN(num) ? (def || 0) : num;
};

String.prototype.capitalize = function() {
	var builder = '';
	var c;
	for (var i = 0, length = this.length; i < length; i++) {
		var c = this[i - 1];
		if (!c || (c === ' ' || c === '\t' || c === '\n'))
			c = this[i].toUpperCase();
		else
			c = this[i];
		builder += c;
	}
	return builder;
};

String.prototype.toUnicode = function() {
	var result = '';
	var self = this;
	var length = self.length;
	for(var i = 0; i < length; ++i){
		if(self.charCodeAt(i) > 126 || self.charCodeAt(i) < 32)
			result += '\\u' + self.charCodeAt(i).hex(4);
		else
			result += self[i];
	}
	return result;
};

String.prototype.fromUnicode = function() {
	var str = this.replace(/\\u([\d\w]{4})/gi, (match, v) => String.fromCharCode(parseInt(v, 16)));
	return unescape(str);
};

String.prototype.sha1 = function(salt) {
	var hash = crypto.createHash('sha1');
	hash.update(this + (salt || ''), ENCODING);
	return hash.digest('hex');
};

String.prototype.sha256 = function(salt) {
	var hash = crypto.createHash('sha256');
	hash.update(this + (salt || ''), ENCODING);
	return hash.digest('hex');
};

String.prototype.sha512 = function(salt) {
	var hash = crypto.createHash('sha512');
	hash.update(this + (salt || ''), ENCODING);
	return hash.digest('hex');
};

String.prototype.md5 = function(salt) {
	var hash = crypto.createHash('md5');
	hash.update(this + (salt || ''), ENCODING);
	return hash.digest('hex');
};

String.prototype.toSearch = function() {
	var str = this.replace(regexpSEARCH, '').trim().toLowerCase().removeDiacritics();
	var buf = [];
	var prev = '';
	for (var i = 0, length = str.length; i < length; i++) {
		var c = str[i];
		if (c === 'y')
			c = 'i';
		if (c === prev)
			continue;
		prev = c;
		buf.push(c);
	}

	return buf.join('');
};

String.prototype.toKeywords = String.prototype.keywords = function(forSearch, alternative, max_count, max_length, min_length) {
	return exports.keywords(this, forSearch, alternative, max_count, max_length, min_length);
};

String.prototype.encrypt = function(key, isUnique) {
	var str = '0' + this;
	var data_count = str.length;
	var key_count = key.length;
	var random = isUnique ? exports.random(120) + 40 : 65;
	var count = data_count + (random % key_count);
	var values = [];
	var index = 0;

	values[0] = String.fromCharCode(random);
	var counter = this.length + key.length;

	for (var i = count - 1; i > 0; i--) {
		index = str.charCodeAt(i % data_count);
		values[i] = String.fromCharCode(index ^ (key.charCodeAt(i % key_count) ^ random));
	}

	var hash = new Buffer(counter + '=' + values.join(''), ENCODING).toString('base64').replace(regexpENCRYPT, text => text === '+' ? '_' : '-');
	index = hash.indexOf('=');
	return index > 0 ? hash.substring(0, index) : hash;
};

String.prototype.decrypt = function(key) {

	var values = this.replace(regexpDECRYPT, text => text === '-' ? '/' : '+');
	var mod = values.length % 4;

	if (mod) {
		for (var i = 0; i < mod; i++)
			values += '=';
	}

	values = new Buffer(values, 'base64').toString(ENCODING);

	var index = values.indexOf('=');
	if (index === -1)
		return null;

	var counter = +values.substring(0, index);
	if (isNaN(counter))
		return null;

	values = values.substring(index + 1);

	var count = values.length;
	var random = values.charCodeAt(0);

	var key_count = key.length;
	var data_count = count - (random % key_count);
	var decrypt_data = [];

	for (var i = data_count - 1; i > 0; i--) {
		index = values.charCodeAt(i) ^ (random ^ key.charCodeAt(i % key_count));
		decrypt_data[i] = String.fromCharCode(index);
	}

	var val = decrypt_data.join('');
	return counter !== val.length + key.length ? null : val;
};

String.prototype.base64ToFile = function(filename, callback) {
	var self = this;

	var index = self.indexOf(',');
	if (index === -1)
		index = 0;
	else
		index++;

	fs.writeFile(filename, self.substring(index), 'base64', callback || exports.noop);
	return this;
};

String.prototype.base64ToBuffer = function() {
	var self = this;

	var index = self.indexOf(',');
	if (index === -1)
		index = 0;
	else
		index++;

	return new Buffer(self.substring(index), 'base64');
};

String.prototype.base64ContentType = function() {
	var self = this;
	var index = self.indexOf(';');
	return index === -1 ? '' : self.substring(5, index);
};

String.prototype.removeDiacritics = function() {
	return exports.removeDiacritics(this);
};

String.prototype.indent = function(max, c) {
	var plus = '';
	if (c === undefined)
		c = ' '
	while (max--)
		plus += c;
	return plus + this;
};

String.prototype.isNumber = function(isDecimal) {

	var self = this;
	var length = self.length;

	if (!length)
		return false;

	isDecimal = isDecimal || false;

	for (var i = 0; i < length; i++) {
		var ascii = self.charCodeAt(i);

		if (isDecimal) {
			if (ascii === 44 || ascii === 46) {
				isDecimal = false;
				continue;
			}
		}

		if (ascii < 48 || ascii > 57)
			return false;
	}

	return true;
};

if (!String.prototype.padLeft) {
	String.prototype.padLeft = function(max, c) {
		var self = this;
		var len = max - self.length;
		if (len < 0)
			return self;
		if (c === undefined)
			c = ' ';
		while (len--)
			self = c + self;
		return self;
	};
}


if (!String.prototype.padRight) {
	String.prototype.padRight = function(max, c) {
		var self = this;
		var len = max - self.length;
		if (len < 0)
			return self;
		if (c === undefined)
			c = ' ';
		while (len--)
			self += c;
		return self;
	};
}

String.prototype.insert = function(index, value) {
	var str = this;
	var a = str.substring(0, index);
	var b = value.toString() + str.substring(index);
	return a + b;
};

/**
 * Create a link from String
 * @param  {Number} max A maximum length, default: 60 and optional.
 * @return {String}
 */
String.prototype.slug = String.prototype.toSlug = String.prototype.toLinker = String.prototype.linker = function(max) {
	max = max || 60;

	var self = this.trim().toLowerCase().removeDiacritics();
	var builder = '';
	var length = self.length;

	for (var i = 0; i < length; i++) {
		var c = self[i];
		var code = self.charCodeAt(i);

		if (builder.length >= max)
			break;

		if (code > 31 && code < 48) {
			if (builder[builder.length - 1] !== '-')
				builder += '-';
			continue;
		}

		if (code > 47 && code < 58) {
			builder += c;
			continue;
		}

		if (code > 94 && code < 123) {
			builder += c;
			continue;
		}
	}
	var l = builder.length - 1;
	return builder[l] === '-' ? builder.substring(0, l) : builder;
};

String.prototype.pluralize = function(zero, one, few, other) {
	return this.parseInt().pluralize(zero, one, few, other);
};

String.prototype.isBoolean = function() {
	var self = this.toLowerCase();
	return (self === 'true' || self === 'false') ? true : false;
};

/**
 * Check if the string contains only letters and numbers.
 * @return {Boolean}
 */
String.prototype.isAlphaNumeric = function() {
  return regexpALPHA.test(this);
};

String.prototype.soundex = function() {

	var arr = this.toLowerCase().split('');
	var first = arr.shift();
	var builder = first.toUpperCase();

	for (var i = 0, length = arr.length; i < length; i++) {
		var v = SOUNDEX[arr[i]];
		if (v === undefined)
			continue;
		if (i) {
			if (v !== arr[i - 1])
				builder += v;
		} else if (v !== SOUNDEX[first])
			builder += v;
	}

	return (builder + '000').substring(0, 4);
};

/**
* Remove all Html Tags from a string
* @return {string}
*/
String.prototype.removeTags = function() {
	return this.replace(regexpTags, '');
};

Number.prototype.floor = function(decimals) {
	return Math.floor(this * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

Number.prototype.padLeft = function(max, c) {
	return this.toString().padLeft(max, c || '0');
};

Number.prototype.padRight = function(max, c) {
	return this.toString().padRight(max, c || '0');
};

/**
 * Async decrements
 * @param {Function(index, next)} fn
 * @param {Function} callback
 * @return {Number}
 */
Number.prototype.async = function(fn, callback) {
	var number = this;
	if (number)
		fn(number--, () => setImmediate(() => number.async(fn, callback)));
	else
		callback && callback();
	return number;
};

/**
 * Format number
 * @param {Number} decimals Maximum decimal numbers
 * @param {String} separator Number separator, default ' '
 * @param {String} separatorDecimal Decimal separator, default '.' if number separator is ',' or ' '.
 * @return {String}
 */
Number.prototype.format = function(decimals, separator, separatorDecimal) {

	var self = this;

	if (typeof(decimals) === 'string')
		return self.format2(decimals);

	var num = self.toString();
	var dec = '';
	var output = '';
	var minus = num[0] === '-' ? '-' : '';
	if (minus)
		num = num.substring(1);

	var index = num.indexOf('.');

	if (typeof(decimals) === 'string') {
		var tmp = separator;
		separator = decimals;
		decimals = tmp;
	}

	if (separator === undefined)
		separator = ' ';

	if (index !== -1) {
		dec = num.substring(index + 1);
		num = num.substring(0, index);
	}

	index = -1;
	for (var i = num.length - 1; i >= 0; i--) {
		index++;
		if (index > 0 && index % 3 === 0)
			output = separator + output;
		output = num[i] + output;
	}

	if (decimals || dec.length) {
		if (dec.length > decimals)
			dec = dec.substring(0, decimals || 0);
		else
			dec = dec.padRight(decimals || 0, '0');
	}

	if (dec.length && separatorDecimal === undefined)
		separatorDecimal = separator === '.' ? ',' : '.';

	return minus + output + (dec.length ? separatorDecimal + dec : '');
};

Number.prototype.add = function(value, decimals) {

	if (value == null)
		return this;

	if (typeof(value) === 'number')
		return this + value;

	var first = value.charCodeAt(0);
	var is = false;

	if (first < 48 || first > 57) {
		is = true;
		value = value.substring(1);
	}

	var length = value.length;
	var isPercentage = false;
	var num;

	if (value[length - 1] === '%') {
		value = value.substring(0, length - 1);
		isPercentage = true;

		if (is) {
			var val = value.parseFloat();
			switch (first) {
				case 42:
					num = this * ((this / 100) * val);
					break;
				case 43:
					num = this + ((this / 100) * val);
					break;
				case 45:
					num = this - ((this / 100) * val);
					break;
				case 47:
					num = this / ((this / 100) * val);
					break;
			}
			return decimals !== undefined ? num.floor(decimals) : num;
		} else {
			num = (this / 100) * value.parseFloat();
			return decimals !== undefined ? num.floor(decimals) : num;
		}

	} else
		num = value.parseFloat();

	switch (first) {
		case 42:
			num = this * num;
			break;
		case 43:
			num = this + num;
			break;
		case 45:
			num = this - num;
			break;
		case 47:
			num = this / num;
			break;
		case 47:
			num = this / num;
			break;
		default:
			num = this;
			break;
	}

	if (decimals !== undefined)
		return num.floor(decimals);

	return num;
};

Number.prototype.format2 = function(format) {
	var index = 0;
	var num = this.toString();
	var beg = 0;
	var end = 0;
	var max = 0;
	var output = '';
	var length = 0;

	if (typeof(format) === 'string') {

		var d = false;
		length = format.length;

		for (var i = 0; i < length; i++) {
			var c = format[i];
			if (c === '#') {
				if (d)
					end++;
				else
					beg++;
			}

			if (c === '.')
				d = true;
		}

		var strBeg = num;
		var strEnd = '';

		index = num.indexOf('.');

		if (index !== -1) {
			strBeg = num.substring(0, index);
			strEnd = num.substring(index + 1);
		}

		if (strBeg.length > beg) {
			max = strBeg.length - beg;
			var tmp = '';
			for (var i = 0; i < max; i++)
				tmp += '#';

			format = tmp + format;
		}

		if (strBeg.length < beg)
			strBeg = strBeg.padLeft(beg, ' ');

		if (strEnd.length < end)
			strEnd = strEnd.padRight(end, '0');

		if (strEnd.length > end)
			strEnd = strEnd.substring(0, end);

		d = false;
		index = 0;

		var skip = true;
		length = format.length;

		for (var i = 0; i < length; i++) {

			var c = format[i];

			if (c !== '#') {

				if (skip)
					continue;

				if (c === '.') {
					d = true;
					index = 0;
				}

				output += c;
				continue;
			}

			var value = d ? strEnd[index] : strBeg[index];

			if (skip)
				skip = [',', ' '].indexOf(value) !== -1;

			if (!skip)
				output += value;

			index++;
		}

		return output;
	}

	output = '### ### ###';
	beg = num.indexOf('.');
	max = format || 0;

	if (max === 0 && beg !== -1)
		max = num.length - (beg + 1);

	if (max > 0) {
		output += '.';
		for (var i = 0; i < max; i++)
			output += '#';
	}

	return this.format(output);
};

Number.prototype.pluralize = function(zero, one, few, other) {

	var num = this;
	var value = '';

	if (num == 0)
		value = zero || '';
	else if (num == 1)
		value = one || '';
	else if (num > 1 && num < 5)
		value = few || '';
	else
		value = other;

	var beg = value.indexOf('#');
	if (beg === -1)
		return value;

	var end = value.lastIndexOf('#');
	var format = value.substring(beg, end + 1);
	return num.format(format) + value.replace(format, '');
};

Number.prototype.hex = function(length) {
	var str = this.toString(16).toUpperCase();
	while(str.length < length)
		str = '0' + str;
	return str;
};

Number.prototype.VAT = function(percentage, decimals, includedVAT) {
	var num = this;
	var type = typeof(decimals);

	if (type === 'boolean') {
		var tmp = includedVAT;
		includedVAT = decimals;
		decimals = tmp;
		type = typeof(decimals);
	}

	if (type === 'undefined')
		decimals = 2;

	if (includedVAT === undefined)
		includedVAT = true;

	if (percentage === 0 || num === 0)
		return num;

	return includedVAT ? (num / ((percentage / 100) + 1)).floor(decimals) : (num * ((percentage / 100) + 1)).floor(decimals);
};

Number.prototype.discount = function(percentage, decimals) {
	var num = this;
	if (decimals === undefined)
		decimals = 2;
	return (num - (num / 100) * percentage).floor(decimals);
};

Number.prototype.parseDate = function(plus) {
	return new Date(this + (plus || 0));
};

if (!Number.prototype.toRad) {
	Number.prototype.toRad = function () {
		return this * Math.PI / 180;
	};
}


Number.prototype.filesize = function(decimals, type) {

	if (typeof(decimals) === 'string') {
		var tmp = type;
		type = decimals;
		decimals = tmp;
	}

	var value;

	// this === bytes
	switch (type) {
		case 'bytes':
			value = this;
			break;
		case 'KB':
			value = this / 1024;
			break;
		case 'MB':
			value = filesizehelper(this, 2);
			break;
		case 'GB':
			value = filesizehelper(this, 3);
			break;
		case 'TB':
			value = filesizehelper(this, 4);
			break;
		default:

			type = 'bytes';
			value = this;

			if (value > 1023) {
				value = value / 1024;
				type = 'KB';
			}

			if (value > 1023) {
				value = value / 1024;
				type = 'MB';
			}

			if (value > 1023) {
				value = value / 1024;
				type = 'GB';
			}

			if (value > 1023) {
				value = value / 1024;
				type = 'TB';
			}

			break;
	}

	type = ' ' + type;
	return (decimals === undefined ? value.format(2).replace('.00', '') : value.format(decimals)) + type;
};

function filesizehelper(number, count) {
	while (count--) {
		number = number / 1024;
		if (number.toFixed(3) === '0.000')
			return 0;
	}
	return number;
}

/**
 * Take items from array
 * @param {Number} count
 * @return {Array}
 */
Array.prototype.take = function(count) {
	var arr = [];
	var self = this;
	var length = self.length;
	for (var i = 0; i < length; i++) {
		arr.push(self[i]);
		if (arr.length >= count)
			return arr;
	}
	return arr;
};

/**
 * Extend objects in Array
 * @param {Object} obj
 * @param {Boolean} rewrite Default: false.
 * @return {Array} Returns self
 */
Array.prototype.extend = function(obj, rewrite) {
	var isFn = typeof(obj) === 'function';
	for (var i = 0, length = this.length; i < length; i++) {

		if (isFn) {
			this[i] = obj(this[i], i);
			continue;
		}

		this[i] = exports.extend(this[i], obj, rewrite);
	}
	return this;
};

/**
 * First item in array
 * @param {Object} def Default value.
 * @return {Object}
 */
Array.prototype.first = function(def) {
	var item = this[0];
	return item === undefined ? def : item;
};

/**
 * Create object from Array
 * @param {String} name Optional, property name.
 * @return {Object}
 */
Array.prototype.toObject = function(name) {

	var self = this;
	var obj = {};

	for (var i = 0, length = self.length; i < length; i++) {
		var item = self[i];
		if (name)
			obj[item[name]] = item;
		else
			obj[item] = true;
	}

	return obj;
};

/**
 * Compare two arrays
 * @param {String} id An identificator.
 * @param {Array} b Second array.
 * @param {Function(itemA, itemB, indexA, indexB)} executor
 */
Array.prototype.compare = function(id, b, executor) {

	var a = this;
	var ak = {};
	var bk = {};
	var al = a.length;
	var bl = b.length;
	var tl = Math.max(al, bl);
	var processed = {};

	for (var i = 0; i < tl; i++) {
		var av = a[i];
		if (av)
			ak[av[id]] = i;
		var bv = b[i];
		if (bv)
			bk[bv[id]] = i;
	}

	var index = -1;

	for (var i = 0; i < tl; i++) {

		var av = a[i];
		var bv = b[i];
		var akk;
		var bkk;

		if (av) {
			akk = av[id];
			if (processed[akk])
				continue;
			processed[akk] = true;
			index = bk[akk];
			if (index === undefined)
				executor(av, undefined, i, -1);
			else
				executor(av, b[index], i, index);
		}

		if (bv) {
			bkk = bv[id];
			if (processed[bkk])
				continue;
			processed[bkk] = true;
			index = ak[bkk];
			if (index === undefined)
				executor(undefined, bv, -1, i);
			else
				executor(a[index], bv, index, i);
		}
	}
};

/**
 * Pair arrays
 * @param {Array} arr
 * @param {String} property
 * @param {Function(itemA, itemB)} fn Paired items (itemA == this, itemB == arr)
 * @param {Boolean} remove Optional, remove item from this array if the item doesn't exist int arr (default: false).
 * @return {Array}
 */
Array.prototype.pair = function(property, arr, fn, remove) {

	if (property instanceof Array) {
		var tmp = property;
		property = arr;
		arr = tmp;
	}

	if (!arr)
		arr = new Array(0);

	var length = arr.length;
	var index = 0;

	while (true) {
		var item = this[index++];
		if (!item)
			break;

		var is = false;

		for (var i = 0; i < length; i++) {
			if (item[property] !== arr[i][property])
				continue;
			fn(item, arr[i]);
			is = true;
			break;
		}

		if (is || !remove)
			continue;

		index--;
		this.splice(index, 1);
	}

	return this;
};

/**
 * Last item in array
 * @param {Object} def Default value.
 * @return {Object}
 */
Array.prototype.last = function(def) {
	var item = this[this.length - 1];
	return item === undefined ? def : item;
};

Array.prototype.quicksort = Array.prototype.orderBy = function(name, asc, maxlength) {

	var length = this.length;
	if (!length || length === 1)
		return this;

	if (typeof(name) === 'boolean') {
		asc = name;
		name = undefined;
	}

	if (maxlength === undefined)
		maxlength = 3;

	if (asc === undefined)
		asc = true;

	var self = this;
	var type = 0;
	var field = name ? self[0][name] : self[0];

	switch (typeof(field)) {
		case 'string':
			if (field.isJSONDate())
				type = 4;
			else
				type = 1;
			break;
		case 'number':
			type = 2;
			break;
		case 'boolean':
			type = 3;
			break;
		default:
			if (!exports.isDate(field))
				return self;
			type = 4;
			break;
	}

	quicksort(self, function(a, b) {

		var va = name ? a[name] : a;
		var vb = name ? b[name] : b;

		// String
		if (type === 1) {
			if (va && vb)
				return asc ? va.substring(0, maxlength).removeDiacritics().localeCompare(vb.substring(0, maxlength).removeDiacritics()) : vb.substring(0, maxlength).removeDiacritics().localeCompare(va.substring(0, maxlength).removeDiacritics());
			return 0;
		} else if (type === 2) {
			if (va > vb)
				return asc ? 1 : -1;
			else if (va < vb)
				return asc ? -1 : 1;
			return 0;
		} else if (type === 3) {
			if (va === true && vb === false)
				return asc ? 1 : -1;
			else if (va === false && vb === true)
				return asc ? -1 : 1;
			return 0;
		} else if (type === 4) {
			if (!va || !vb)
				return 0;
			if (!va.getTime)
				va = new Date(va);
			if (!vb.getTime)
				vb = new Date(vb);
			if (va.getTime() > vb.getTime())
				return asc ? 1 : -1;
			else if (va.getTime() < vb.getTime())
				return asc ? -1 : 1;
			return 0;
		}

		return 0;
	});

	return self;
};

Array.prototype.trim = function() {
	var self = this;
	var output = [];
	for (var i = 0, length = self.length; i < length; i++) {
		if (typeof(self[i]) === 'string')
			self[i] = self[i].trim();
		self[i] && output.push(self[i]);
	}
	return output;
};

/**
 * Skip items from array
 * @param {Number} count
 * @return {Array}
 */
Array.prototype.skip = function(count) {
	var arr = [];
	var self = this;
	var length = self.length;
	for (var i = 0; i < length; i++)
		i >= count && arr.push(self[i]);
	return arr;
};

/**
 * Find items in Array
 * @param {Function(item, index) or String/Object} cb
 * @param {Object} value Optional.
 * @return {Array}
 */
Array.prototype.where = function(cb, value) {

	var self = this;
	var selected = [];
	var isFN = typeof(cb) === 'function';
	var isV = value !== undefined;

	for (var i = 0, length = self.length; i < length; i++) {

		if (isFN) {
			cb.call(self, self[i], i) && selected.push(self[i]);
			continue;
		}

		if (isV) {
			self[i] && self[i][cb] === value && selected.push(self[i]);
			continue;
		}

		self[i] === cb && selected.push(self[i]);
	}

	return selected;
};

/**
 * Find item in Array
 * @param {Function(item, index) or String/Object} cb
 * @param {Object} value Optional.
 * @return {Array}
 */
Array.prototype.findItem = Array.prototype.find = function(cb, value) {
	var self = this;
	var index = self.findIndex(cb, value);
	if (index === -1)
		return null;
	return self[index];
};

Array.prototype.findIndex = function(cb, value) {

	var self = this;
	var isFN = typeof(cb) === 'function';
	var isV = value !== undefined;

	for (var i = 0, length = self.length; i < length; i++) {

		if (isFN) {
			if (cb.call(self, self[i], i))
				return i;
			continue;
		}

		if (isV) {
			if (self[i] && self[i][cb] === value)
				return i;
			continue;
		}

		if (self[i] === cb)
			return i;
	}

	return -1;
};

/**
 * Remove items from Array
 * @param {Function(item, index) or Object} cb
 * @param {Object} value Optional.
 * @return {Array}
 */
Array.prototype.remove = function(cb, value) {

	var self = this;
	var arr = [];
	var isFN = typeof(cb) === 'function';
	var isV = value !== undefined;

	for (var i = 0, length = self.length; i < length; i++) {

		if (isFN) {
			!cb.call(self, self[i], i) && arr.push(self[i]);
			continue;
		}

		if (isV) {
			self[i] && self[i][cb] !== value && arr.push(self[i]);
			continue;
		}

		self[i] !== cb && arr.push(self[i]);
	}
	return arr;
};

Array.prototype.wait = Array.prototype.waitFor = function(onItem, callback, thread) {

	var self = this;
	var init = false;

	// INIT
	if (!onItem.$index) {
		onItem.$pending = 0;
		onItem.$index = 0;
		init = true;
		if (typeof(callback) === 'number') {
			var tmp = thread;
			thread = callback;
			callback = tmp;
		}
	}

	if (thread === undefined)
		thread = 1;

	var item = thread === true ? self.shift() : self[onItem.$index];
	onItem.$index++;

	if (item === undefined) {
		if (onItem.$pending)
			return self;
		callback && callback();
		onItem.$index = 0;
		return self;
	}

	onItem.$pending++;
	onItem.call(self, item, function() {
		setImmediate(function() {
			onItem.$pending--;
			self.wait(onItem, callback, thread);
		});
	});

	if (!init || thread === true)
		return self;

	for (var i = 1; i < thread; i++)
		self.wait(onItem, callback, 0);

	return self;
};

/**
 * Creates a function async list
 * @param {Function} callback Optional
 * @return {Array}
 */
Array.prototype.async = function(thread, callback) {

	var self = this;
	var init = false;

	if (typeof(thread) === 'function') {
		callback = thread;
		thread = 1;
	} else if (thread === undefined)
		thread = 1;

	if (self.$pending === undefined) {
		self.$pending = 0;
		init = true;
	}

	var item = self.shift();
	if (item === undefined) {
		if (self.$pending)
			return self;
		self.$pending = undefined;
		callback && callback();
		return self;
	}

	for (var i = 0; i < thread; i++) {

		if (i)
			item = self.shift();

		self.$pending++;
		item(function() {
			setImmediate(function() {
				self.$pending--;
				self.async(1, callback);
			});
		});
	}

	return self;
};

Array.prototype.randomize = function() {
	OBSOLETE('Array.randomize()', 'Use Array.random().');
	return this.random();
};

Array.prototype.random = function() {

	var self = this;
	var random = (Math.floor(Math.random() * 100000000) * 10).toString();
	var index = 0;
	var old = 0;

	self.sort(function(a, b) {

		var c = random[index++];

		if (c === undefined) {
			c = random[0];
			index = 0;
		}

		if (old > c) {
			old = c;
			return -1;
		}

		if (old === c) {
			old = c;
			return 0;
		}

		old = c;
		return 1;
	});

	return self;
};

Array.prototype.limit = function(max, fn, callback, index) {

	if (index === undefined)
		index = 0;

	var current = [];
	var self = this;
	var length = index + max;

	for (var i = index; i < length; i++) {
		var item = self[i];

		if (item !== undefined) {
			current.push(item);
			continue;
		}

		if (!current.length) {
			callback && callback();
			return self;
		}

		fn(current, () => callback && callback(), index, index + max);
		return self;
	}

	if (!current.length) {
		callback && callback();
		return self;
	}

	fn(current, function() {
		if (length < self.length)
			self.limit(max, fn, callback, length);
		else
			callback && callback();
	}, index, index + max);

	return self;
};

/**
 * Get unique elements from Array
 * @return {[type]} [description]
 */
Array.prototype.unique = function(property) {

	var self = this;
	var result = [];
	var sublength = 0;

	for (var i = 0, length = self.length; i < length; i++) {
		var value = self[i];

		if (!property) {
			result.indexOf(value) === -1 && result.push(value);
			continue;
		}

		if (sublength === 0) {
			result.push(value);
			sublength++;
			continue;
		}

		var is = true;
		for (var j = 0; j < sublength; j++) {
			if (result[j][property] === value[property]) {
				is = false;
				break;
			}
		}

		if (is) {
			result.push(value);
			sublength++;
		}
	}

	return result;
};

function AsyncTask(owner, name, fn, cb, waiting) {
	this.isRunning = 0;
	this.owner = owner;
	this.name = name;
	this.fn = fn;
	this.cb = cb;
	this.waiting = waiting;
	this.interval = null;
	this.isCanceled = false;
}

AsyncTask.prototype.run = function() {
	var self = this;
	try
	{

		if (self.isCanceled) {
			self.complete();
			return self;
		}

		self.isRunning = 1;
		self.owner.tasksWaiting[self.name] = true;
		self.owner.emit('begin', self.name);

		var timeout = self.owner.tasksTimeout[self.name];
		if (timeout > 0)
			self.interval = setTimeout(function() { self.timeout(); }, timeout);

		self.fn(function() {
			setImmediate(() => self.complete());
		});

	} catch (ex) {
		self.owner.emit('error', self.name, ex);
		self.complete();
	}
	return self;
};

AsyncTask.prototype.timeout = function(timeout) {

	var self = this;

	if (timeout > 0) {
		clearTimeout(self.interval);
		setTimeout(function() { self.timeout(); }, timeout);
		return self;
	}

	if (timeout <= 0) {
		clearTimeout(self.interval);
		setTimeout(function() { self.timeout(); }, timeout);
		return self;
	}

	setImmediate(() => self.cancel(true));
	return self;
};

AsyncTask.prototype.cancel = function(isTimeout) {
	var self = this;

	self.isCanceled = true;

	if (isTimeout)
		self.owner.emit('timeout', self.name);
	else
		self.owner.emit('cancel', self.name);

	self.fn = null;
	self.cb = null;
	self.complete();
	return self;
};

AsyncTask.prototype.complete = function() {

	var item = this;
	var self = item.owner;

	item.isRunning = 2;

	delete self.tasksPending[item.name];
	delete self.tasksWaiting[item.name];

	if (!item.isCanceled) {
		try
		{
			self.emit('end', item.name);
			item.cb && item.cb();
		} catch (ex) {
			self.emit('error', ex, item.name);
		}
	}

	setImmediate(function() {
		self.reload();
		self.refresh();
	});

	return self;
};

function Async(owner) {

	this._max = 0;
	this._count = 0;
	this._isRunning = false;
	this._isEnd = false;

	this.owner = owner;
	this.onComplete = [];

	this.tasksPending = {};
	this.tasksWaiting = {};
	this.tasksAll = [];
	this.tasksTimeout = {};
	this.isCanceled = false;

	events.EventEmitter.call(this);
}

Async.prototype = {
	get count() {
		return this._count;
	},

	get percentage() {
		var p = 100 - Math.floor((this._count * 100) / this._max);
		return p ? p : 0;
	}
};

Async.prototype.__proto__ = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: Async,
		enumberable: false
	}
});

Async.prototype.reload = function() {
	var self = this;
	self.tasksAll = Object.keys(self.tasksPending);
	self.emit('percentage', self.percentage);
	return self;
};

Async.prototype.cancel = function(name) {

	var self = this;

	if (name === undefined) {
		self.isCanceled = true;
		for (var i = 0; i < self._count; i++)
			self.cancel(self.tasksAll[i]);
		return true;
	}

	var task = self.tasksPending[name];
	if (!task)
		return false;

	delete self.tasksPending[name];
	delete self.tasksWaiting[name];

	task.cancel();
	task = null;
	self.reload();
	self.refresh();

	return true;
};

Async.prototype.await = function(name, fn, cb) {

	var self = this;

	if (self.isCanceled)
		return false;

	if (typeof(name) === 'function') {
		cb = fn;
		fn = name;
		name = exports.GUID(6);
	}

	if (self.tasksPending[name])
		return false;

	self.tasksPending[name] = new AsyncTask(self, name, fn, cb, null);
	self._max++;
	self.reload();
	self.refresh();
	return true;
};

Async.prototype.wait = function(name, waitingFor, fn, cb) {

	var self = this;

	if (self.isCanceled)
		return false;

	if (typeof(waitingFor) === 'function') {
		cb = fn;
		fn = waitingFor;
		waitingFor = null;
	}

	if (self.tasksPending[name])
		return false;

	self.tasksPending[name] = new AsyncTask(self, name, fn, cb, waitingFor);
	self._max++;
	self.reload();
	self.refresh();
	return true;
};

Async.prototype.complete = function(fn) {
	return this.run(fn);
};

Async.prototype.run = function(fn) {
	var self = this;
	self._isRunning = true;
	fn && self.onComplete.push(fn);
	self.refresh();
	return self;
};

Async.prototype.isRunning = function(name) {

	var self = this;

	if (!name)
		return self._isRunning;

	var task = self.tasksPending[name];
	if (!task)
		return false;

	return task.isRunning === 1;
};

Async.prototype.isWaiting = function(name) {
	var self = this;

	var task = self.tasksPending[name];
	if (!task)
		return false;

	return task.isRunning === 0;
};

Async.prototype.isPending = function(name) {
	var self = this;
	var task = self.tasksPending[name];
	if (!task)
		return false;
	return true;
};

Async.prototype.timeout = function(name, timeout) {

	var self = this;

	if (!timeout) {
		self.tasksTimeout[name] = undefined;
		return self;
	}

	self.tasksTimeout[name] = timeout;
	return self;
};

Async.prototype.refresh = function(name) {

	var self = this;

	if (!self._isRunning || self._isEnd)
		return self;

	self._count = self.tasksAll.length;
	var index = 0;

	while (true) {
		var name = self.tasksAll[index++];
		if (!name)
			break;

		var task = self.tasksPending[name];
		if (!task)
			break;

		if (self.isCanceled || task.isCanceled) {
			delete self.tasksPending[name];
			delete self.tasksWaiting[name];
			self.tasksAll.splice(index, 1);
			self._count = self.tasksAll.length;
			index--;
			continue;
		}

		if (task.isRunning !== 0)
			continue;

		if (task.waiting && self.tasksPending[task.waiting])
			continue;

		task.run();
	}

	if (self._count === 0) {
		self._isRunning = false;
		self._isEnd = true;
		self.emit('complete');
		self.emit('percentage', 100);
		self._max = 0;
		var complete = self.onComplete;
		var length = complete.length;
		self.onComplete = [];
		for (var i = 0; i < length; i++) {
			try
			{
				complete[i]();
			} catch (ex) {
				self.emit('error', ex);
			}
		}
		setImmediate(() => self._isEnd = false);
	}

	return self;
};

function FileList() {
	this.pending = [];
	this.pendingDirectory = [];
	this.directory = [];
	this.file = [];
	this.onComplete = null;
	this.onFilter = null;
	this.advanced = false;
}

FileList.prototype.reset = function() {
	var self = this;
	self.file.length = 0;
	self.directory.length = 0;
	self.pendingDirectory.length = 0;
};

FileList.prototype.walk = function(directory) {

	var self = this;

	if (directory instanceof Array) {
		var length = directory.length;

		for (var i = 0; i < length; i++)
			self.pendingDirectory.push(directory[i]);

		self.next();
		return;
	}

	fs.readdir(directory, function(err, arr) {

		if (err)
			return self.next();

		var length = arr.length;
		for (var i = 0; i < length; i++)
			self.pending.push(path.join(directory, arr[i]));

		self.next();
	});
};

FileList.prototype.stat = function(path) {
	var self = this;

	fs.stat(path, function(err, stats) {

		if (err)
			return self.next();

		if (stats.isDirectory() && (!self.onFilter || self.onFilter(path, true))) {
			self.directory.push(path);
			self.pendingDirectory.push(path);
			self.next();
			return;
		}

		if (!self.onFilter || self.onFilter(path, false))
			self.file.push(self.advanced ? { filename: path, stats: stats } : path);

		self.next();
	});
};

FileList.prototype.next = function() {
	var self = this;

	if (self.pending.length) {
		var item = self.pending.shift();
		self.stat(item);
		return;
	}

	if (self.pendingDirectory.length) {
		var directory = self.pendingDirectory.shift();
		self.walk(directory);
		return;
	}

	self.onComplete(self.advanced ? self.file.filename : self.file, self.directory);
};

exports.Async = Async;

exports.sync = function(fn, owner) {
	return function() {

		var args = [].slice.call(arguments);
		var params;
		var callback;
		var executed = false;
		var self = owner || this;

		args.push(function() {
			params = arguments;
			if (!executed && callback) {
				executed = true;
				callback.apply(self, params);
			}
		});

		fn.apply(self, args);

		return function(cb) {
			callback = cb;
			if (!executed && params) {
				executed = true;
				callback.apply(self, params);
			}
		};
	};
};

exports.sync2 = function(fn, owner) {
	return (function() {

		var params;
		var callback;
		var executed = false;
		var self = owner || this;
		var args = [].slice.call(arguments);

		args.push(function() {
			params = arguments;
			if (!executed && callback) {
				executed = true;
				callback.apply(self, params);
			}
		});

		fn.apply(self, args);

		return function(cb) {
			callback = cb;
			if (!executed && params) {
				executed = true;
				callback.apply(self, params);
			}
		};
	})();
};

exports.async = function(fn, isApply) {
	var context = this;
	return function(complete) {

		var self = this;
		var argv;

		if (arguments.length) {

			if (isApply) {
				// index.js/Subscribe.prototype.doExecute
				argv = arguments[1];
			} else {
				argv = [];
				for (var i = 1; i < arguments.length; i++)
					argv.push(arguments[i]);
			}
		} else
			argv = new Array(0);

		var generator = fn.apply(context, argv);
		next(null);

		function next(err, result) {

			var g, type;

			try
			{
				var can = err ? false : true;
				switch (can) {
					case true:
						g = generator.next(result);
						break;
					case false:
						g = generator.throw(err);
						break;
				}

			} catch (e) {

				if (!complete)
					return;

				type = typeof(complete);

				if (type === 'object' && complete.isController) {
					if (e instanceof ErrorBuilder)
						complete.content(e);
					else
						complete.view500(e);
					return;
				}

				type === 'function' && setImmediate(() => complete(e));
				return;
			}

			if (g.done) {
				typeof(complete) === 'function' && complete(null, g.value);
				return;
			}

			var promise = g.value instanceof Promise;

			if (typeof(g.value) !== 'function' && !promise) {
				next.call(self, null, g.value);
				return;
			}

			try
			{
				if (promise) {
					g.value.then((value) => next.call(self, null, value));
					return;
				}

				g.value.call(self, function() {
					next.apply(self, arguments);
				});

			} catch (e) {
				setImmediate(() => next.call(self, e));
			}
		}

		return generator.value;
	};
};

// MIT
// Written by Jozef Gula
exports.getMessageLength = function(data, isLE) {

	var length = data[1] & 0x7f;

	if (length === 126)
		return data.length < 4 ? -1 : converBytesToInt64([data[3], data[2], 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0, isLE);

	if (length === 127)
		return data.Length < 10 ? -1 : converBytesToInt64([data[9], data[8], data[7], data[6], data[5], data[4], data[3], data[2]], 0, isLE);

	return length;
};

// MIT
// Written by Jozef Gula
function converBytesToInt64(data, startIndex, isLE) {
	return isLE ? (data[startIndex] | (data[startIndex + 1] << 0x08) | (data[startIndex + 2] << 0x10) | (data[startIndex + 3] << 0x18) | (data[startIndex + 4] << 0x20) | (data[startIndex + 5] << 0x28) | (data[startIndex + 6] << 0x30) | (data[startIndex + 7] << 0x38)) : ((data[startIndex + 7] << 0x20) | (data[startIndex + 6] << 0x28) | (data[startIndex + 5] << 0x30) | (data[startIndex + 4] << 0x38) | (data[startIndex + 3]) | (data[startIndex + 2] << 0x08) | (data[startIndex + 1] << 0x10) | (data[startIndex] << 0x18));
}

exports.queuecache = {};

function queue_next(name) {

	var item = exports.queuecache[name];
	if (!item)
		return;

	item.running--;
	if (item.running < 0)
		item.running = 0;

	if (!item.pending.length)
		return;

	var fn = item.pending.shift();
	if (!fn) {
		item.running = 0;
		return;
	}

	item.running++;
	(function(name){
		setImmediate(function() {
			fn(() => queue_next(name));
		});
	})(name);
}

/**
 * Queue list
 * @param {String} name
 * @param {Number} max Maximum stack.
 * @param {Function(next)} fn
 */
exports.queue = function(name, max, fn) {

	if (!fn)
		return false;

	if (!max) {
		fn(NOOP);
		return true;
	}

	if (!exports.queuecache[name])
		exports.queuecache[name] = { limit: max, running: 0, pending: [] };

	var item = exports.queuecache[name];
	if (item.running >= item.limit) {
		item.pending.push(fn);
		return false;
	}

	item.running++;
	(function(name){
		setImmediate(function() {
			fn(() => queue_next(name));
		});
	})(name);

	return true;
};

exports.minifyStyle = function(value) {
	return require('./internal').compile_css(value);
};

exports.minifyScript = function(value) {
	return require('./internal').compile_javascript(value);
};

exports.minifyHTML = function(value) {
	return require('./internal').compile_html(value);
};

exports.restart = function() {
	exports.queuecache = {};
	dnscache = {};
};

exports.parseTheme = function(value) {
	if (value[0] !== '=')
		return '';
	var index = value.indexOf('/', 2);
	if (index === -1)
		return '';
	value = value.substring(1, index);
	if (value === '?')
		return framework.config['default-theme'];
	return value;
};

exports.set = function(obj, path, value) {
	var cachekey = 'S+' + path;

	if (framework.temporary.other[cachekey])
		return framework.temporary.other[cachekey](obj, value);

	var arr = path.split('.');
	var builder = [];
	var p = '';

	for (var i = 0, length = arr.length; i < length; i++) {
		p += (p !== '' ? '.' : '') + arr[i];
		var type = arr[i] instanceof Array ? '[]' : '{}';

		if (i !== length - 1) {
			builder.push('if(typeof(w.' + p + ')!=="object"||w.' + p + '===null)w.' + p + '=' + type);
			continue;
		}

		if (type === '{}')
			break;

		p = p.substring(0, p.lastIndexOf('['));
		builder.push('if(!(w.' + p + ' instanceof Array))w.' + p + '=' + type);
		break;
	}

	var fn = (new Function('w', 'a', 'b', builder.join(';') + ';w.' + path.replace(/\'/, '\'') + '=a;return a'));
	if (global.framework)
		framework.temporary.other[cachekey] = fn;
	fn(obj, value, path);
};

exports.get = function(obj, path) {

	var cachekey = 'G=' + path;

	if (framework.temporary.other[cachekey])
		return framework.temporary.other[cachekey](obj);

	var arr = path.split('.');
	var builder = [];
	var p = '';

	for (var i = 0, length = arr.length - 1; i < length; i++) {
		var tmp = arr[i];
		var index = tmp.lastIndexOf('[');
		if (index !== -1)
			builder.push('if(!w.' + (p ? p + '.' : '') + tmp.substring(0, index) + ')return');
		p += (p !== '' ? '.' : '') + arr[i];
		builder.push('if(!w.' + p + ')return');
	}

	var fn = (new Function('w', builder.join(';') + ';return w.' + path.replace(/\'/, '\'')));
	if (global.framework)
		framework.temporary.other[cachekey] = fn;
	return fn(obj);
};

global.Async = global.async = exports.async;
global.sync = global.SYNCHRONIZE = exports.sync;
global.sync2 = exports.sync2;

// =============================================
// FAST QUICK SORT IMPLEMENTATION
// =============================================

function swap(ary, a, b) {
	var t = ary[a];
	ary[a] = ary[b];
	ary[b] = t;
}

function insertion_sort(ary, comparer) {
	for(var i=1,l=ary.length;i<l;i++) {
		var value = ary[i];
		for(var j=i - 1;j>=0;j--) {
			// if(ary[j] <= value)
			if(comparer(value, ary[j], true))
				break;
			ary[j+1] = ary[j];
		}
		ary[j+1] = value;
	}
	return ary;
}

function inplace_quicksort_partition(ary, start, end, pivotIndex, comparer) {
	var i = start, j = end;
	var pivot = ary[pivotIndex];
	while(true) {
		while(comparer(pivot, ary[i])) {i++};
		j--;
		while(comparer(ary[j], pivot)) {j--};
		if(!(i < j))
			return i;
		swap(ary,i,j);
		i++;
	}
}

function fast_quicksort(ary, comparer) {
	var stack = [];
	var entry = [0,ary.length,2 * Math.floor(Math.log(ary.length)/Math.log(2))];
	stack.push(entry);
	while(stack.length) {
		entry = stack.pop();
		var start = entry[0];
		var end = entry[1];
		var depth = entry[2];

		if (!depth) {
			ary = shell_sort_bound(ary, start, end, comparer);
			continue;
		}

		depth--;

		var pivot = Math.round((start + end) / 2);
		var pivotNewIndex = inplace_quicksort_partition(ary,start,end, pivot, comparer);

		if (end - pivotNewIndex > 16) {
			entry = [pivotNewIndex,end,depth];
			stack.push(entry);
		}

		if (pivotNewIndex - start > 16) {
			entry = [start,pivotNewIndex,depth];
			stack.push(entry);
		}
	}

	ary = insertion_sort(ary, comparer);
	return ary;
}

function shell_sort_bound(ary, start, end, comparer) {
	var inc = Math.round((start + end) / 2), i, j, t;
	while (inc >= start) {
		for (i = inc; i < end; i++) {
			t = ary[i];
			j = i;
			while (j >= inc && comparer(ary[j - inc], t)) {
				ary[j] = ary[j - inc];
				j -= inc;
			}
			ary[j] = t;
		}
		inc = Math.round(inc / 2.2);
	}

	return ary;
}

function comparer_asc(index, eq) {
	return eq ? (index === 1 || index === 0 ? true : false) : index === 1;
}

function comparer_desc(index, eq) {
	return eq ? (index === -1 || index === 0 ? true : false) : index === -1;
}

function quicksort(arr, comparer, desc) {
	return fast_quicksort(arr, function(a, b, eq) {
		return desc ? comparer_desc(comparer(a, b), eq) : comparer_asc(comparer(a, b), eq);
	});
}

function Chunker(name, max) {
	this.name = name;
	this.max = max || 50;
	this.index = 0;
	this.filename = 'chunker_{0}-'.format(name);
	this.stack = [];
	this.flushing = 0;
	if (global.framework)
		this.filename = global.framework.path.temp(this.filename);
}

Chunker.prototype.append = Chunker.prototype.write = function(obj) {
	var self = this;

	self.stack.push(obj);

	if (self.stack.length >= self.max) {
		self.flushing++;
		fs.writeFile(self.filename + (self.index++) + '.json', JSON.stringify(self.stack), () => self.flushing--);
		self.stack = [];
	}

	return self;
};

Chunker.prototype.end = function() {
	var self = this;

	if (self.stack.length) {
		self.flushing++;
		fs.writeFile(self.filename + (self.index++) + '.json', JSON.stringify(self.stack), () => self.flushing--);
		self.stack = [];
	}

	return self;
};

Chunker.prototype.each = function(onItem, onEnd, indexer) {

	var self = this;

	if (indexer === undefined)
		indexer = 0;

	if (indexer >= self.index)
		return onEnd && onEnd();

	self.read(indexer++, function(err, items) {
		onItem(items, () => self.each(onItem, onEnd, indexer), indexer - 1);
	});

	return self;
};

Chunker.prototype.read = function(index, callback) {
	var self = this;

	if (self.flushing) {
		self.flushing_timeout = setTimeout(() => self.read(index, callback), 300);
		return;
	}

	fs.readFile(self.filename + index + '.json', function(err, data) {
		if (err)
			callback(null, EMPTYARRAY);
		else
			callback(null, data.toString('utf8').parseJSON());
	});
	return self;
};

Chunker.prototype.clear = function() {
	var self = this;
	var files = [];
	for (var i = 0; i < self.index; i++)
		files.push(self.filename + i + '.json');
	files.wait((filename, next) => fs.unlink(filename, next));
	return self;
};

Chunker.prototype.destroy = function() {
	var self = this;
	self.clear();
	self.indexer = 0;
	self.flushing = 0;
	clearTimeout(self.flushing_timeout);
	self.stack = null;
	return self;
};

exports.chunker = function(name, max) {
	return new Chunker(name, max);
};

exports.ObjectToArray = function(obj) {
	if (obj == null)
		return EMPTYARRAY;
	var keys = Object.keys(obj);
	var output = [];
	for (var i = 0, length = keys.length; i < length; i++)
		output.push({ key: keys[i], value: obj[keys[i]]});
	return output;
};

!global.framework && require('./index');