// ===================================================
// IMPORTANT: only for development
// total.js - web application framework for node.js
// http://www.totaljs.com
// ===================================================

var fs = require('fs');
var options = {};

// options.ip = '127.0.0.1';
// options.port = parseInt(process.argv[2]);
// options.config = { name: 'total.js' };
// options.https = { key: fs.readFileSync('keys/agent2-key.pem'), cert: fs.readFileSync('keys/agent2-cert.pem')};

var isDebugging = process.argv.indexOf('debugging') !== -1;
var directory = process.cwd();
var path = require('path');
var first = process.argv.indexOf('restart') === -1;

function debug() {
    var framework = require('total.js');
    var port = parseInt(process.argv[2]);

    if (options.https)
        return framework.https('debug', options);

    framework.http('debug', options);

    if (first)
        framework.emit('debug-start');
    else
        framework.emit('debug-restart');
}

function app() {
    var fork = require('child_process').fork;
    var utils = require('total.js/utils');
    var directories = [directory + '/controllers', directory + '/definitions', directory + '/modules', directory + '/resources', directory + '/components', directory + '/models', directory + '/source'];
    var files = {};
    var force = false;
    var changes = [];
    var app = null;
    var status = 0;
    var async = new utils.Async();
    var pid = '';
    var pidInterval = null;
    var prefix = '------------> ';
    var isLoaded = false;

    function onFilter(path, isDirectory) {
        return isDirectory ? true : path.indexOf('.js') !== -1 || path.indexOf('.resource') !== -1;
    };

    function onComplete() {

        var self = this;

        fs.readdir(directory, function(err, arr) {

            var length = arr.length;

            for (var i = 0; i < length; i++) {
                var name = arr[i];
                if (name === 'config' || name === 'config-debug' || name === 'config-release' || name === 'versions' || name.indexOf('.js') !== -1 || name.indexOf('.resource') !== -1)
                    self.file.push(name);
            }

            length = self.file.length;

            for (var i = 0; i < length; i++) {
                var name = self.file[i];
                if (!files[name])
                    files[name] = isLoaded ? 0 : null;
            }

            refresh();
        });
    };

    function refresh() {

         var filenames = Object.keys(files);
         var length = filenames.length;

         for (var i = 0; i < length; i++) {

            var filename = filenames[i];
            (function(filename) {

                async.await(function(next) {

                    fs.stat(filename, function(err, stat) {

                        if (!err) {
                            var ticks = stat.mtime.getTime();

                            if (files[filename] !== null && files[filename] !== ticks) {
                                changes.push(prefix + filename.replace(directory, '') +  (files[filename] === 0 ? ' (added)' : ' (modified)'));
                                force = true;
                            }

                            files[filename] = ticks;
                        }
                        else {
                            delete files[filename];
                            changes.push(prefix + filename.replace(directory, '') + ' (removed)');
                            force = true;
                        }

                        next();
                    });
                });

            })(filename);
         }

         async.complete(function() {

            isLoaded = true;
            setTimeout(refresh_directory, 2000);

            if (status !== 1)
                return;

            if (!force)
                return;

            restart();

            var length = changes.length;

            for (var i = 0; i < length; i++)
                console.log(changes[i]);

            changes = [];
            force = false;
         });

    }

    function refresh_directory() {
        utils.ls(directories, onComplete, onFilter);
    }

    function restart() {

        if (app !== null) {
            try
            {
                process.kill(app.pid);
            } catch (err) {}
            app = null;
        }

        var arr = process.argv;
        arr.pop();

        if (first)
            first = false;
        else
            arr.push('restart');

        arr.push('debugging');

        app = fork(path.join(directory, 'debug.js'), arr);

        app.on('message', function(msg) {

            if (msg.substring(0, 5) === 'name:') {
                process.title = 'debug: ' + msg.substring(6);
                return;
            }

            if (msg === 'eaddrinuse')
                process.exit(1);

        });

        app.on('exit', function() {
            if (status !== 255)
                return;
            app = null;
        });

        if (status === 0)
            app.send('debugging');

        status = 1;
    }

    process.on('SIGTERM', end);
    process.on('SIGINT', end);
    process.on('exit', end);

    function end() {

        if (arguments.callee.isEnd)
            return;

        arguments.callee.isEnd = true;

        fs.unlink(pid, noop);

        if (app === null) {
            process.exit(0);
            return;
        }

        process.kill(app.pid);
        app = null;
        process.exit(0);
    }

    function noop() {}

    if (process.pid > 0) {
        console.log(prefix + 'PID: ' + process.pid);
        pid = path.join(directory, 'debug.pid');
        fs.writeFileSync(pid, process.pid);

        pidInterval = setInterval(function() {
            fs.exists(pid, function(exist) {

                if (exist)
                    return;

                fs.unlink(pid, noop);

                if (app !== null)
                    process.kill(app.pid);

                process.exit(0);
            });

        }, 2000);
    }

    restart();
    refresh_directory();
}

function run() {

    if (isDebugging) {
        debug();
        return;
    }

    var filename = path.join(directory, 'debug.pid');

    if (!fs.existsSync(filename)) {
        app();
        return;
    }

    fs.unlinkSync(filename);

    setTimeout(function() {
        app();
    }, 3000);
}

run();