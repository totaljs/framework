var utils = require('../utils');
var headers = {};

headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
headers['Authorization'] = 'Basic S3ozSWl2QmxmSURWclFOQzFncVJtdk42cjpSeU9MeFRQWmMzaGVNVDZUMEZVNlRHdngxVmt6aEJ3VmRjaE13RU5QeUwyVzRBVDZnSA==';
headers['User-Agent'] = 'confiapp';
/*
utils.request('https://api.twitter.com/oauth2/token', 'POST', 'grant_type=client_credentials', function(err, data) {

	var response = JSON.parse(data);
	headers['Authorization'] = 'Bearer ' + response['access_token'];

	utils.request('https://api.twitter.com/search/tweets/?q=' + encodeURIComponent('#total.js'), 'GET', '', function(err, data) {

		console.log(data);

	}, headers);


}, headers);

*/

var str = 'nclude_entities=true&oauth_consumer_key=xvz1evFS4wEEPTGEFPHBog&oauth_nonce=kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg&oauth_signature_method=HMAC-SHA1&oauth_timestamp=1318622958&oauth_token=370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb&oauth_version=1.0&status=Hello%20Ladies%20%2B%20Gentlemen%2C%20a%20signed%20OAuth%20request%21';
var a = '12345678901234567890123456789012';

console.log(new Buffer(a).toString('base64'));

// MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=
// kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg