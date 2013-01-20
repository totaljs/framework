var utils = require('partial.js/utils');
var builders = require('partial.js/builders');

exports.init = function() {
	this.route('/', viewHomepage);
};

function viewHomepage() {
	var self = this;	
	
	self.repository.title = 'Paging';

	var products = 1000;
	var page = 10;
	var perpage = 20;

	var paging = new builders.PageBuilder(products, page, perpage);
	var pages = [];
	var pagesBetween = [];

	paging.render(function(index) {
		pages.push({ url: '/?p=' + index, name: index, selected: index === page ? ' class="selected"' : '' });
	});

	paging.render(function(index) {
		pagesBetween.push({ url: '/?p=' + index, name: index, selected: index === page ? ' class="selected"' : '' });
	}, 10);

	var model = {
		page: page,
		pages: pages,
		pagesBetween: pagesBetween,
		count: paging.count,
		items: paging.items
	};

	self.view('homepage', model);
}