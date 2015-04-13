require('../index').http('debug');

F.route('/',json_test,['get']);
F.route('/',json_test_b,['post','json']);

function json_test() {
    this.plain('GET');
}

function json_test_b() {
    this.plain('POST');
}