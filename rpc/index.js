const path = require('path');
const WebSocket = require('ws');

module.exports = {
  createServer : (port=2222,host=undefined)=>new Promise(okFn=>{
    // server.listen(port,host,okFn);
    const { fork } = require('child_process');
    fork(path.join(__dirname,'server.js'),[JSON.stringify([port,host||undefined])]);
  }),
  createClient : (url)=>new Promise((okFn,errorFn)=>{
    let ws = new WebSocket(url);
	let open = false;
	ws.on('open', function open() {
		open = true;
	  okFn();
	});

	ws.on('close', function open() {
		open = true;
	  okFn();
	});
	ws.on('error', function error(error) {
		if(!open)errorFn(error);
	});
	ws.on('message', function incoming(data) {
	  console.log(data);
	});
  })
}