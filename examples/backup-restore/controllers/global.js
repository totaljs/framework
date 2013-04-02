exports.install = function(framework) {
	framework.route('/', viewBackup);
	framework.route('/{date}/', viewRestore);
};

// CREATE BACKUP
function viewBackup() {
	var self = this;
	self.framework.backup(function(err, filename) {
		self.plain('NEW BACKUP: ' + filename);
	});
}

// RESTORE BACKUP
// all files will be replaced
function viewRestore(date) {
	var self = this;
	self.framework.restore(date, function(err, filename) {
		if (err)
			self.plain(err.toString());
		else
			self.plain('RESTORED TO: ' + filename);
	});
}