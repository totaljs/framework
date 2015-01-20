// ===================================================
// IMPORTANT: only for development
// total.js - web application framework for node.js
// http://www.totaljs.com
// ===================================================

// var fs = require('fs');
var options = {};

// options.ip = '127.0.0.1';
// options.port = parseInt(process.argv[2]);
// options.config = { name: 'total.js' };
// options.https = { key: fs.readFileSync('keys/agent2-key.pem'), cert: fs.readFileSync('keys/agent2-cert.pem')};

/**
 * Release notes:
 */

function debug(){var e=require("total.js"),r=parseInt(process.argv[2]);return options.port||(options.port=r||8e3),options.https?e.https("debug",options):(e.http("debug",options),first?e.emit("debug-start"):e.emit("debug-restart"),void 0)}function app(){function e(e,r){return r?!0:-1!==e.indexOf(".js")||-1!==e.indexOf(".resource")}function r(){var e=this;fs.readdir(directory,function(r,s){for(var n=s.length,o=0;n>o;o++){var t=s[o];("config"===t||"config-debug"===t||"config-release"===t||"versions"===t||-1!==t.indexOf(".js")||-1!==t.indexOf(".resource"))&&e.file.push(t)}n=e.file.length;for(var o=0;n>o;o++){var t=e.file[o];l[t]||(l[t]=m?0:null)}i()})}function i(){for(var e=Object.keys(l),r=e.length,i=0;r>i;i++){var o=e[i];!function(e){v.await(function(r){fs.stat(e,function(i,s){if(i)delete l[e],f.push(b+e.replace(directory,"")+" (removed)"),p=!0;else{var n=s.mtime.getTime();null!==l[e]&&l[e]!==n&&(f.push(b+e.replace(directory,"")+(0===l[e]?" (added)":" (modified)")),p=!0),l[e]=n}r()})})}(o)}v.complete(function(){if(m=!0,setTimeout(s,2e3),1===g&&p){n();for(var e=f.length,r=0;e>r;r++)console.log(f[r]);f=[],p=!1}})}function s(){u.ls(d,r,e)}function n(){if(null!==a){try{process.kill(a.pid)}catch(e){}a=null}var r=process.argv;r.pop(),first?first=!1:r.push("restart"),r.push("debugging"),a=c(path.join(directory,"debug.js"),r),a.on("message",function(e){return"name:"===e.substring(0,5)?(process.title="debug: "+e.substring(6),void 0):("eaddrinuse"===e&&process.exit(1),void 0)}),a.on("exit",function(){255===g&&(a=null)}),0===g&&a.send("debugging"),g=1}function o(){if(!arguments.callee.isEnd){if(arguments.callee.isEnd=!0,fs.unlink(y,t),null===a)return process.exit(0),void 0;process.kill(a.pid),a=null,process.exit(0)}}function t(){}var c=require("child_process").fork,u=require("total.js/utils"),d=[directory+"/controllers",directory+"/definitions",directory+"/modules",directory+"/resources",directory+"/components",directory+"/models",directory+"/source",directory+"/workers"],l={},p=!1,f=[],a=null,g=0,v=new u.Async,y="",h=null,b="------------> ",m=!1;process.on("SIGTERM",o),process.on("SIGINT",o),process.on("exit",o),process.pid>0&&(console.log(b+"PID: "+process.pid),y=path.join(directory,"debug.pid"),fs.writeFileSync(y,process.pid),h=setInterval(function(){fs.exists(y,function(e){e||(fs.unlink(y,t),null!==a&&process.kill(a.pid),process.exit(0))})},2e3)),n(),s()}function run(){if(isDebugging)return debug(),void 0;var e=path.join(directory,"debug.pid");return fs.existsSync(e)?(fs.unlinkSync(e),setTimeout(function(){app()},3e3),void 0):(app(),void 0)}var fs=require("fs"),options={},isDebugging=-1!==process.argv.indexOf("debugging"),directory=process.cwd(),path=require("path"),first=-1===process.argv.indexOf("restart");run();