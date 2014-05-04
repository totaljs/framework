var crypto = require('crypto');
var qs = require('querystring');
var utils = require('../utils');

function TwitterOAuth(apiKey, apiSecret, accessToken, accessSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.accessToken = accessToken;
    this.accessSecret = accessSecret;
}

TwitterOAuth.prototype.create = function(obj) {
    var keys = Object.keys(obj);
    var length = keys.length;
    var builder = [];

    keys.sort();

    for (var i = 0; i < length; i++) {
        var key = keys[i];
        builder.push(key + '="' + escape(obj[key]) + '"');
    }

    return builder.join(', ');
};

TwitterOAuth.prototype.signature = function(method, url, params) {

    var self = this;
    var keys = Object.keys(params);
    var builder = [];
    var key = encodeURIComponent(self.apiSecret) + '&' + encodeURIComponent(self.accessSecret);

    keys.sort();

    var length = keys.length;
    for (var i = 0; i < length; i++)
        builder.push(keys[i] + '%3D' + encodeURIComponent(params[keys[i]]));

    var signature = method + '&' + encodeURIComponent(url) + '&' + builder.join('%26');
    return crypto.createHmac('sha1', key).update(signature).digest('base64');
};

TwitterOAuth.prototype.request = function(method, url, params, callback, redirect) {

    var headers = {};
    var oauth = {};
    var self = this;
    var data = '';

    oauth['oauth_consumer_key'] = self.apiKey;

    if (redirect)
        oauth['oauth_callback'] = redirect;

    oauth['oauth_token'] = self.accessToken;
    oauth['oauth_signature_method'] = 'HMAC-SHA1';
    oauth['oauth_timestamp'] = Math.floor(new Date().getTime() / 1000).toString();
    oauth['oauth_nonce'] = utils.GUID(32);
    oauth['oauth_version'] = '1.0';

    if (!params)
        params = {};
    else
        data = qs.stringify(params);

    var keys = Object.keys(params);
    var length = keys.length;

    for (var i = 0; i < length; i++)
        params[keys[i]] = encodeURIComponent(params[keys[i]]);

    params['oauth_consumer_key'] = oauth['oauth_consumer_key'];
    params['oauth_nonce'] = oauth['oauth_nonce'];
    params['oauth_signature_method'] = oauth['oauth_signature_method'];
    params['oauth_timestamp'] = oauth['oauth_timestamp'];
    params['oauth_version'] = oauth['oauth_version'];
    params['oauth_token'] = oauth['oauth_token'];

    oauth['oauth_signature'] = self.signature(method, url, params);
    headers['Authorization'] = 'OAuth ' + self.create(oauth);

    utils.request(url, method, data, function(err, data) {
        callback(err, JSON.parse(data));
    }, headers);
};

var twitter = new TwitterOAuth('Kz3IivBlfIDVrQNC1gqRmvN6r', 'RyOLxTPZc3heMT6T0FU6TGvx1VkzhBwVdchMwENPyL2W4AT6gH', '15876887-ndkuDgi6pqUpVXhqqAPeiTLpWelDKhzm6Q7pZ44l0', '8Fc9pdsnjaWQiXEBVyBaR6B5s2Cl9xGM6yG9jLCnPMHW9');

/*
twitter.request('GET', 'https://api.twitter.com/1.1/search/tweets.json', { q: '#nodejs', count: 4 }, function(err, data) {
    console.log(data);
});
*/

twitter.request('POST', 'https://api.twitter.com/1.1/statuses/update.json', { status: 'Test tweet.', trim_user: 'true', include_entities: 'true' }, function(err, data) {
    console.log(data);
});