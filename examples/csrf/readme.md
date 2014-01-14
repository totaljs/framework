# How to prevent CSRF?

[Cross-site request forgery on Wikipedia](http://en.wikipedia.org/wiki/Cross-site_request_forgery): Cross-site request forgery, also known as a one-click attack or session riding and abbreviated as CSRF (sometimes pronounced sea-surf) or XSRF, is a type of malicious exploit of a website whereby unauthorized commands are transmitted from a user that the website trusts. Unlike cross-site scripting (XSS), which exploits the trust a user has for a particular site, CSRF exploits the trust that a site has in a user's browser.

## Solution

All forms on webpage send via XHR ([CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing)).

### Why?

- better handling of errors
- minimal requests to the server
- it's safe

EXAMPLE: https://github.com/petersirka/total.js/tree/master/examples/contact-form