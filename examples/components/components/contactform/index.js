var module_name = '';

exports.install = function(framework, name, directory) {
	module_name = name;
};

exports.render = function(model) {
	var self = this;
	return self.view('.' + self.path.components(module_name + '/template'), model, true);
};