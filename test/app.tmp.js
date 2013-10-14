var urlParser = require('url');
var http = require('http');
var tls = require('tls');
var https = require('https');
var util = require('util');
var path = require('path');
var fs = require('fs');
var events = require('events');
var crypto = require('crypto');
var framework = require('../index');
var ENCODING = 'utf8';
var UNDEFINED = 'undefined';
var STRING = 'string';
var FUNCTION = 'function';
var NUMBER = 'number';
var OBJECT = 'object';
var BOOLEAN = 'boolean';

function AsyncTask(owner, name, fn, cb, waiting) {

	this.handlers = {
		oncomplete: this.complete.bind(this)
	};

	this.isRunning = 0;
	this.owner = owner;
	this.name = name;
	this.fn = fn;
	this.cb = cb;
	this.waiting = waiting;
}

AsyncTask.prototype.run = function() {
	var self = this;
	try
	{
		self.isRunning = 1;
		self.owner.tasksWaiting[self.name] = true;
		self.owner.emit('begin', self.name);
		self.fn(self.handlers.oncomplete);
	} catch (ex) {
		self.owner.emit('error', self.name, ex);
		self.complete();
	}
	return self;
};

AsyncTask.prototype.complete = function() {

	var item = this;
	var self = item.owner;

	item.isRunning = 2;

	delete self.tasksPending[item.name];
	delete self.tasksWaiting[item.name];

	self.reload();
	self.refresh();
	self.emit('end', item.name);

	if (item.cb)
		item.cb();

	return self;
};

function Async(owner) {

	this._count = 0;
	this._isRunning = false;
	this._isNew = false;

	this.owner = owner;
	this.onComplete = [];

	this.tasksPending = {};
	this.tasksWaiting = {};
	this.tasksAll = [];
}

Async.prototype = {
	get count() {
		return this._count;
	}
}

Async.prototype.__proto__ = new events.EventEmitter();

Async.prototype.reload = function() {
	var self = this;
	self.tasksAll = Object.keys(self.tasksPending);
	return self;
};

Async.prototype.await = function(name, fn, cb) {

	var self = this;

	if (typeof(name) === FUNCTION) {
		cb = fn;
		fn = name;
		name = utils.GUID(6);
	}

	if (typeof(self.tasksPending[name]) !== UNDEFINED)
		return false;

	self._count++;
	self.tasksPending[name] = new AsyncTask(self, name, fn, cb, null);
	self.reload();
	self.refresh();

	return true;
};

Async.prototype.wait = function(name, waitingFor, fn, cb) {

	var self = this;

	if (typeof(waitingFor) === FUNCTION) {
		cb = fn;
		fn = waitingFor;
		waitingFor = name;
		name = utils.GUID(6);
	}

	if (typeof(self.tasksPending[name]) !== UNDEFINED)
		return false;

	self._count++;
	self.tasksPending[name] = new AsyncTask(self, name, fn, cb, waitingFor);
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
	self.onComplete.push(fn);
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

Async.prototype.refresh = function(name) {

	var self = this;

	if (!self._isRunning)
		return self;

	var length = self.tasksAll.length;

	for (var i = 0; i < length; i++) {

		var task = self.tasksPending[self.tasksAll[i]];

		if (task.isRunning !== 0)
			continue;

		if (task.waiting !== null && typeof(self.tasksWaiting[task.waiting]) !== UNDEFINED)
			continue;

		task.run();
	}

	if (length === 0) {
		self._isRunning = false;
		self.emit('complete');
		length = self.onComplete.length;
		for (var i = 0; i < length; i++)
			self.onComplete[i]();
		self.onComplete = [];
	}

	return self;
};

var async = new Async();

async.await('1', function(next) {
	setTimeout(function() {
		console.log('1');
		next();
	}, 500)
});

async.wait('2', '1', function(next) {
	setTimeout(function() {
		console.log('2');
		next();
	}, 500)
});

async.on('begin', function(name) {
	console.log('BEGIN', name);
});

async.on('end', function(name) {
	console.log('END', name, this.isRunning());
});

async.run(function() {
	console.log('COMPLETED');
});


// message.attachment('/users/petersirka/desktop/wall.png');

//message.send('smtp.wsd-europe.com', { user: 'sirka@wsd-europe.com', password: 'PETO07dlska' });
//message.send('smtp.gmail.com', { port: 465, secure: true, user: 'petersirka@gmail.com', password: 'plisBB12' });
//message.send();

//var socket = new tls.connect(465, 'smtp.gmail.com');
//var isSended = false;

