const WebSocket = require('ws');

module.exports = {
  createClient : (url)=>new Promise((okFn,errorFn)=>{
    let ws = new WebSocket(url);
	let open = false;
	ws.on('open', function open() {
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