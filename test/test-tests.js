var cube = x => x * x * x;

function   *a() {

}

var b = a;

console.log(b.toString().indexOf('function*'));