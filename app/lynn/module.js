const path = require("path");
const url = require("url");
const fs = require("fs");
const EventEmitter = require('events');
const {encodeObject,decodeObject} = require(path.join(process.cwd(),"app","lynn","transformObject"));
let moduleApp;
// GLOBAL VARIABLES
global.moduleId = process.argv[3];
global.PREFIX_MODULE_CORE = process.argv[5];
global.moduleDir = path.join(process.cwd(),"app","modules",moduleId);

let HEADERS = {
	get origin(){
		return moduleId
	}
};
global.userDataPath = process.argv[4];
global.debug = require('debug')("lynn:module:"+moduleId);
global.debug.log = console.log.bind(console);
global.getLink = function getLink(link){
	var link = url.parse(link);
	if(!link.protocol){
		link.protocol = moduleId.replace(PREFIX_MODULE_CORE,"");
		link.slashes = false;
	}
	return url.format(link);
}
// END GLOBAL

const module = require(process.argv[2]);
var messages = {}
var actions = {}
var sequence = 0;
var sequences = {};
var authFn = null;
var unLockFn = [null,null];

class SharedObject extends Object{
	valueOf(){
		return undefined;
	}
	toJSON(){
		return undefined;
	}
	constructor(obj){
		super();
		Object.keys(obj || {}).forEach(x=>this[x]=obj[x]);
	}
}

onmessage = async function (ev) {
	var msg = ev.data || {};
	var id = msg.id || undefined;
	var isResponse = 'data' in msg || 'error' in msg;
	debug("\n-----------------\n",msg,'\n-----------------\n');
	if(!id){ // system message
		if("unlock" in msg && msg.unlock){ // lock fails
			if(unLockFn[0] && unLockFn[1]){
				if(msg.error)
					unLockFn[1](msg.error);
				else
					unLockFn[0]();
			}
			unLockFn[0] = null;
			unLockFn[1] = null;
		}else if("event" in msg){
			// moduleApp.emit
			msg.arguments = msg.arguments.map(argument=>decodeObject.call({sendMessage,path:msg.path,moduleId},argument));
			debug("event emitter",msg)
	    	moduleApp.emit.apply(moduleApp,[msg.event,...msg.arguments]);
		}
	}else if(!isResponse){ // need response
		if(typeof authFn == 'function'){ // exec filter function
			let isOk = await authFn(msg);
			if(typeof isOk == 'string')
				return postMessage({
					id : msg.id,
					error : {
						code : 'FORBIDDEN',
						message : isOk || "Action '"+ msg.action +"' forbidden"
					}
			    });
			else if(isOk === false) // silent exit
				return postMessage({
					id : msg.id,
					data : null
			    });
		}
		if(msg.action in actions){
			try{
				let ret;
				debug("\n>>> decode\narguments",msg.arguments)
				msg.arguments = msg.arguments.map(argument=>decodeObject.call({sendMessage,path:msg.path,moduleId},argument));
				debug("\n>>> decode\narguments",msg.arguments)
				if(msg.path == "" || msg.path == "/")
					ret = await actions[msg.action](...msg.arguments);
				else if(typeof actions[msg.path+"/"+msg.action] == 'function')
					ret = await actions[msg.path+"/"+msg.action](...msg.arguments);
				else
					ret = await actions[msg.path+"/"+msg.action];
				debug("\n>>> onmessage\narguments",msg.arguments,ret)
				postMessage({
					id : msg.id,
					data : encodeObject.call({actions,path:msg.path,moduleId},ret)
			    });
			}catch(e){
				postMessage({
					id : msg.id,
					error : {
						message : e.message,
						stack : e.stack || undefined
					}
			    });
			}
		}else{
			postMessage({
				id : msg.id,
				error : {
					code : 'NOTFOUND_IN_MODULE',
					message : "Action '"+ msg.action +"' non trouvée"
				}
		    });
		}
	}else{ // is response
		debug("response",msg,id in messages)
		if(id in messages){
			if(msg.error)
				messages[id][1](msg.error);
			else{
				try{
					msg.data = decodeObject.call({sendMessage,path:msg.path,moduleId},msg.data);
					debug("Decode",msg.data)
				}catch(e){
					console.log(e)
				}
				messages[id][0](msg.data);
			}
		}
	}
}
var sendMessage = function (action,path,arguments) {
	debug("\n>>> sendMessage\narguments",JSON.stringify(arguments))	
	arguments = arguments.map(argument=>encodeObject.call({actions,path,moduleId},argument));
	debug("\n>>> sendMessage\narguments",JSON.stringify(arguments))	
	return new Promise((okFn,errorFn)=>{
		var id = moduleId+"-"+sequence++;
		messages[id] = [data=>{
			okFn(data);
			debug("send ",data)
		},err=>{
			debug("error ",[action,path,arguments,err])
			let e = new Error(err.message || err);
			if(err.code)
				e.code = err.code;
			errorFn(e);
		}];
		postMessage({
			id,action,arguments,moduleId,path, headers : HEADERS
	    });
	})
}

var getAsyncCall = (action,path)=>{
	let fn = async function() {};
	Object.defineProperty(fn,'toString',{
		get(){
			return ()=>'async function(){ [external code] }';
		},
		configurable : false,
		enumerable : false
	});
	return new Proxy(fn, {
	  apply: function(target, thisArg, arguments) {
	    return sendMessage(action,"",arguments);
	  }
	});
}
class ModuleApp extends EventEmitter{
	constructor(){
		super()
	}
	get headers(){
		return HEADERS
	}
	get SharedObject(){
		return SharedObject
	}
	get debug(){
		return debug
	}
	registerAction(action,fn){
		actions[action] = fn;
		postMessage({
			registerAction : action
	    });
	    return true;
	}
	lock(view){
		let viewToLoad = url.parse(view);
		if(viewToLoad.protocol === null)
			 viewToLoad.protocol = moduleId.replace(PREFIX_MODULE_CORE,"");
	    return new Promise((okFn,errorFn)=>{
	  		postMessage({
				pause : true,
				view : url.format(viewToLoad)
		    });
		    unLockFn[0] = okFn;
		    unLockFn[1] = errorFn;
	    });
	}
	unlock(errorMessage){
		if(unLockFn[0] && unLockFn[1]){
			postMessage({
				pause : false,
				view : null,
				error : errorMessage
		    });
		    if(errorMessage)
				unLockFn[1](errorMessage);
			else
				unLockFn[0]();
		}
		unLockFn[0] = null;
		unLockFn[1] = null;
	    return;
	}
	auth(fn){
		if(typeof fn == 'function' && !authFn){
			authFn = fn;
		}
	}
};
moduleApp = new ModuleApp;
(async function(){
	if(fs.existsSync(moduleDir)){
		debug("Add protocol", moduleId)
		// add protocol
		await sendMessage("registerProtocol","",[{
		    scheme : moduleId.replace(PREFIX_MODULE_CORE,""),
		    callback : (request) => {
		      	debug(`Request in ${moduleId} module`,request.url);
		      	request.url = url.parse(request.url);
		      	request.url.protocol = "";
		      	request.url.search = "";
		      	request.url = url.format(request.url);
		      	debug("Request",request.url);
				let file = path.join(moduleDir,...request.url.split('/'));
				if(fs.existsSync(file)){
					return {
						mimeType: require('mime').getType(file),
						data: fs.readFileSync(file) 
					};
				}else
					throw new Error("file not found");
		      	// return {mimeType: 'text/html', data: Buffer.from("true")}
		    }
		  }])
	}
	await module(new Proxy(moduleApp,{
		get: function(target, property, receiver) {
			if(target[property])
				return target[property];
			return getAsyncCall(property,"");
	  	}
	}));
	postMessage({
		ready : true // emit ready Event
	})
})()