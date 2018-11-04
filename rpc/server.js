const http = require('http');
const path = require('path');
const WebSocket = require('ws');
 
const server = http.createServer();
const wss1 = new WebSocket.Server({ noServer: true });
const wss2 = new WebSocket.Server({ noServer: true });
 
wss1.on('connection', function connection(ws) {
  // ...
});
 
wss2.on('connection', function connection(ws) {
  // ...
});
 
server.on('upgrade', function upgrade(request, socket, head) {
  const pathname = url.parse(request.url).pathname;
 
  if (pathname === '/ipc') { // ipc chanel
    wss1.handleUpgrade(request, socket, head, function done(ws) {
      wss1.emit('connection', ws, request);
    });
  } else if (pathname === '/info') { // info / system chanel
    wss2.handleUpgrade(request, socket, head, function done(ws) {
      wss2.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
 
var args = JSON.decode(process.argv[2]);
server.listen(args.port,args.host || undefined,()=>{
  console.log("Server start")
}));