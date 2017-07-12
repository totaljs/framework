require('../index');

var w = 100;
var h = 150;
var bg_color = '#E0E0E0';
var text = 'KOKOT';
var fontSize = 20;
if(w<100) fontSize = 10;
if(w>=100 && w<150) fontSize = 15;

var emptyPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY2BgYGAAAAAFAAGKM+MAAAAAAElFTkSuQmCC';
var imgStream = Image.load(new Buffer(emptyPNG, 'base64'))
.quality(80)
.background(bg_color)
.command('-extent', (w || 150)+'x'+(h || 150))
.command('-fill','#707070',true)
.command('-font','arial')
.command('-pointsize', fontSize)
//.command('-draw','gravity Center text \'0,0 "'+(text || (w+'x'+h))+'"');

/*
 * POZRI TU:
 */
imgStream.islimit = true; // tu ked zakomentujem tento riadok, tak tam prida limit automaticky a takyto error:
// Exception has occurred: Error
// Error: Uncaught, unspecified "error" event. (gm convert: Option '-limit' requires an argument or argument is malformed.
// )
//     at ServerResponse.emit (events.js:163:17)
//     at ServerResponse.onerror (_stream_readable.js:579:12)
//     at emitOne (events.js:96:13)
//     at ServerResponse.emit (events.js:188:7)
//     at emitOne (events.js:96:13)
//     at Socket.emit (events.js:188:7)
//     at readableAddChunk (_stream_readable.js:176:18)
//     at Socket.Readable.push (_stream_readable.js:134:10)
//     at Pipe.onread (net.js:547:20)

imgStream.save('/Users/petersirka/desktop/kokotaris.png', console.log);