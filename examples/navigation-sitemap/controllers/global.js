var utils = require('partial.js/utils');
var builders = require('partial.js/builders');

exports.init = function() {
	this.route('/', viewHomepage);
	this.route('/1/', view1);
	this.route('/1/2/', view2);
	this.route('/1/2/3/', view3);
};

function viewHomepage() {
	var self = this;	
	self.view('homepage');
}

function view1() {
	var self = this;

	self.repository.sitemap.push({ url: '/1/', name: '1' });
	self.view('homepage');
}

function view2() {
	var self = this;
	self.repository.sitemap.push({ url: '/1/', name: '1' });
	self.repository.sitemap.push({ url: '/1/2/', name: '2' });
	self.view('homepage');
}

function view3() {
	var self = this;
	self.repository.sitemap.push({ url: '/1/', name: '1' });
	self.repository.sitemap.push({ url: '/1/2/', name: '2' });
	self.repository.sitemap.push({ url: '/1/2/3/', name: '3' });
	self.view('homepage');
}