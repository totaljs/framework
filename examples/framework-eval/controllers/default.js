exports.install = function(framework) {

	framework.route('/', view_homepage);
	framework.route('/eval/', post_eval, ['post']);

};

function view_homepage() {
	var self = this;
	self.view('homepage', { text: 'console.log(\'from client side ...\');' });
}

function post_eval() {
	var self = this;
	self.framework.eval(self.post.text);
	self.json({ r: true });
}