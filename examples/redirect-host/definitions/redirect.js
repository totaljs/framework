
console.log('Set up redirecting of host ...');

// Params:
// oldHost
// newHost
// copyPath?
// permament redirect?
framework.redirect('http://127.0.0.1:8004', 'http://localhost:8004', true, false);