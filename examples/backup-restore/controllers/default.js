exports.install = function(framework) {
	framework.route('/', view_backup);
	framework.route('/{date}/', view_restore);
};

// CREATE BACKUP
function view_backup() {
	var self = this;
	self.framework.backup(function(err, filename) {
		self.plain('NEW BACKUP: ' + filename);
	});
}

// RESTORE BACKUP
// all files will be replaced
function view_restore(date) {
	var self = this;
	self.framework.restore(date, function(err, filename) {
		if (err)
			self.plain(err.toString());
		else
			self.plain('RESTORED TO: ' + filename);
	});
}