const path = require("path");
const vm = require("vm");
const url = require("url");
const Store = require("./store");
const fs = require("fs");
const util = require('util');
const debug = require('debug')("lynn:core");
const Worker = require('tiny-worker');
const crypto = require('crypto');
const EventEmitter = require('events');
const readDir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const {protocol,dialog} = require('electron').remote;
const currentWindow = require('electron').remote.getCurrentWindow();
const {encodeObject,decodeObject} = require("./transformObject");
const typeOf = (obj)=>obj === null ? 'null' : ( typeof obj == 'object' && obj.constructor ? obj.constructor.name.toLowerCase() :  typeof obj); 
localStorage.debug =process.env.DEBUG;
let TMP = require('electron').remote.app.getPath("temp"); 
let PREFIX_MODULE_CORE = "~";
let ACTIONS = {};
let ACTIONS_LOCAL = {};
let ACTIONS_CACHE = {};
let MODAL_STACK = [];
window.MODAL_STACK = MODAL_STACK;
let VM_STACK = {};
let MODULE_LOADDED = [];
let MODULE_LIST = {};
let PAGE_TYPE = ["menu","page","modal"];
let BADGE_COLORS = ["primary","secondary","success","info","warning","danger","light","dark"];
var sequences = {};
function convertToMontant(string){
	string = string.toString().replace(/[^0-9\.-]/g,"");
	string = parseFloat(string);
	return parseFloat(string.toFixed(2));
}
function convertToMoney(montant, sep=" ",decSep=".", dec = 0, devise = "XAF"){
	montant = parseFloat(montant).toFixed(dec);
	let a = montant.toString().split(".")[0];
		a = a.split("")
	let b="";
	while( a.length ){
		b=a.splice(a.length<=3 ? 0 : a.length - 3,3).join("")+sep+b;
	};
	a = montant.toString().split(".")[1];
	a = (a || "").split("");
	let c="";
	while( a.length ){
		c=c+sep+a.splice(0,3).join("");
	};
	return (b.trim()+(c?(decSep+c.trim()) : "")+" "+devise).trim();
}
function canAccess(href){
	let droitsFails = true;
	let cleanUrl = url.parse(href);
	cleanUrl.search = "";
	cleanUrl.query = "";
	cleanUrl = url.format(cleanUrl);
	return cleanUrl in app.roles ? canDo(app.roles[cleanUrl]) : false;
}
function canDo(droits,...droitsExtras){
	droits = Array.isArray(droits) ? droits : [droits];
	droits = droits.concat(droitsExtras);
	if(app.locales.user.root)
		return true;
	return droits.indexOf("*") != -1 || droits.filter(value => -1 !== app.locales.user.droits.indexOf(value)).length > 0;
}

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

async function convertToDOMContent (view, moduleId, data={},titleEl,isModal){
	var query = url.parse(view,true);
	data = {
		...query.query,
		...data
	};
	query.query = {};
	var search = query.search;
	query.search = "";
	let renderFun = async (view)=>{
		var query = url.parse(view,true);
		let localData = {
			...query.query,
			...data
		};
		query.query = {};
		var search = query.search;
		query.search = "";
		try{
			return await app.env.renderPromise(url.format(query),titleEl ? {url : url.parse(view,true), setTitle(title){
					setTitle(title,titleEl,isModal)
				},getLink(link){
					var link = url.parse(link);
					if(!link.protocol){
						link.protocol = moduleId.replace(PREFIX_MODULE_CORE,"").replace(/:$/,'');
						link.slashes = false;
					}
					return url.format(link);
				}, isModal : !!isModal,
				...localData
			} : data);
		}catch(e){
			debug("render Error", e)
			throw e;
		}
	}
	string = await renderFun(url.format(query))
	var globalContext = {
		get generateUUID(){
			return generateUUID
		},
		get swal(){
			return swal;
		},
		get showError(){
			return showError
		},
		get hideError(){
			return hideError
		},
		get localStorage(){
			return localStorage;
		},
		get loaderHTML(){
			return LOADER_HTML;
		},
		get console(){
			let debugs = {
				log : debug.extend(moduleId.replace(/:$/,'')).extend("log"),
				warn : debug.extend(moduleId.replace(/:$/,'')).extend("warn"),
				error : debug.extend(moduleId.replace(/:$/,'')).extend("error"),
				info : debug.extend(moduleId.replace(/:$/,'')).extend("info"),
			};
			//Object.keys(debugs).forEach(x=>debugs[x].log = console[x].bind(console))
			return debugs;
		},
		get convertToMoney(){
			return convertToMoney
		},
		get convertToMontant(){
			return convertToMontant
		},
		get exitApp(){
			return electron.remote.app.exit
		},
		get ipc(){
			return electron.ipcRenderer
		},
		get sha256(){
			return (phrase, secret="")=>crypto.createHmac('sha256', secret)
               .update(phrase)
               .digest('hex');
		},
		get getLink(){
			return link=>{
				var link = url.parse(link);
				if(!link.protocol){
					link.protocol = moduleId.replace(PREFIX_MODULE_CORE,"").replace(/:$/,'');
					link.slashes = false;
				}
				return url.format(link);
			}
		}
	};
	VM_STACK[moduleId] = VM_STACK[moduleId] || vm.createContext(globalContext,{
		name : "VM context of "+moduleId,
		origin : moduleId
	});
	let localContext = {
		get documentRel(){
			return  window.documentRel;
		},
		get url(){
			return url.format(query)
		},
		get sendResult(){
			return (data)=>{
				if(isModal){
					isModal.done(data);
					$(isModal).modal('hide');
				}
			}
		},
		close(){
			if(isModal){
				isModal.done(null);
				$(isModal).modal('hide');
			}
		},
		error : async (title,msg="")=>{
			if(isModal){
				return showError(msg || title || "Erreur",'error',true);
			}
			try{
				return await swal({
				  type : 'error',
				  title: title || "Erreur",
				  html : msg || undefined,
				  showConfirmButton: false,
				  timer: 3000
				});
			}catch(e){}
		},
		success : async (title,msg)=>{
			if(isModal){
				return showError(msg || title || "Success",'success',true);
			}
			try{
				return await swal({
				  type : 'success',
				  html : msg || undefined,
				  title: title ||"Success",
				  showConfirmButton: false,
				  timer: 3000
				});
			}catch(e){}

		}
	}
	let ret = document.createElement("div");
	ret.innerHTML = string;
	debug("trace", new Error())
	var code = [];
	let scripts = ret.querySelectorAll("script");
	for(let script of scripts){
		try{
			if(script.hasAttribute("src")){
				script.innerHTML = await renderFun(script.getAttribute("src"));
				script.removeAttribute("src");	
			}
			try{
				/* FAKE ISOLATION */
				let fn = new Function('localContext',`
					let process = undefined ;
					let window = undefined;
					let global = undefined;
					let module = undefined;
					let exports = undefined;
					let require = undefined;
					with(localContext){
						return async function(app,\$, document){
							document = document || documentRel;
							${script.innerHTML}
						}
					}
				`);
				code.push(fn({
					  ...globalContext
					, ...localContext
				}));
				/** VM ISOLATION WORK BUT BUG WHEN WE USE setTimeout **/
				// code.push(vm.runInContext(`
				// (localContext)=>{ with(localContext){
				// 		console.log('localContext');
				// 		return async (app,$)=>{
				// 			${script.innerHTML}
				// 		}
				// } }`,VM_STACK[moduleId],{
				// 	filename : view+"#"+index,
				// 	lineOffset : -1,
				// 	displayErrors : true,
				// 	breakOnSigint : true
				// })(localContext));
			}catch(e){
				debug(e);
			}
			script.remove();
		}catch(e){
			console.error("Error script",e)
		}
	};
	var styles = ret.querySelectorAll("style");
	for(var style of styles){
		try{
			let css = style.innerHTML;
			if(style.hasAttribute("dark")){
				style.setAttribute('scoped',"");
				css = "body.color-scheme-dark{\n"+css+"\n}"
			} else if(style.hasAttribute("print")){
				css = "@media print { @page { size: 210mm 297mm; margin : 0mm; }\n"+css+"\n}"
			}else{
				style.setAttribute('scoped',"");
			}
			style.innerHTML = (await less.render(css, {})).css
		}catch(e){
			console.error("Error render less",e)
		}
	};
	var styles = ret.querySelectorAll("link");
	for(var link of styles){
		try{
			if(!link.hasAttribute("href")) continue;
			if(link.getAttribute("rel") == 'stylesheet'){
				let css = await renderFun(link.getAttribute("href"));
				let style = document.createElement("style");
				style.setAttribute('type','text/css');
				if(link.hasAttribute("dark")){
					style.setAttribute('scoped',"");
					css = "body.color-scheme-dark{\n"+css+"\n}"
				} else if(link.hasAttribute("print")){
					css = "@media print { @page { size: 210mm 297mm; }\n"+css+"\n}"
				}else{
					style.setAttribute('scoped',"");
				}
				style.innerHTML = (await less.render(css, {

				})).css;
				link.replaceWith(style)
			}
		}catch(e){
			console.error("Error render less",e)
		}
	};
	return [ret.children, code];
}
async function configureDatabase(name = "local"){
	name = name
		.replace(/[^a-z]+/ig,"_")
		.toLowerCase();
	debug("NEW DB",name)
	var db = new PouchDB(name);
	let id = ()=>Date.now().toString(32)+"-"+"xxxxx-xxxxx-xxxxxx".replace(/x/g,x=>Math.floor(Math.random()*36).toString(36));
	let dbFunctions  = {
		GenId: async ()=>
			id(),
		Put: async (obj) => 
			Array.isArray(obj) ? await db.bulkDocs(obj) : await db.put({_id : id(),...obj}),
		Get: async (id) => 
			await db.get(id),
		Remove: async (id) => 
			await db.remove(await db.get(id)),
		Find :  async (query)=>
			await db.find(query),
		Query : async (mapReduce,options={}) =>
			await db.query(mapReduce,options),
		AllDocs : async (options={}) =>
			await db.allDocs(options),
		Changes : async (fn)=>
			await db.changes({
			  since: 'now',
			  live: true,
			  include_docs: true
			}).on('change', function(changes) {
			  fn(changes)
			})
	};
	if(localStorage[`databasePrefix_$name`] || localStorage.databasePrefix ){
		var urlDatabase = localStorage[`databasePrefix_$name`] || localStorage.databasePrefix;
		// urlDatabase = url.parse(urlDatabase);
		let sync = db.sync((urlDatabase)+'/'+name, {
		  live: true,
		  retry: true
		}).on('change', function (info) {
		  debug('change', `SYNC ${name} => ${localStorage.databasePrefix}/${name}`,`handle change`);
		}).on('paused', function (err) {
		  debug('paused', `SYNC ${name} => ${localStorage.databasePrefix}/${name}`,`replication paused (e.g. replication up to date, user went offline)`);
		}).on('active', function () {
		  debug('active', `SYNC ${name} => ${localStorage.databasePrefix}/${name}`,`replicate resumed (e.g. new changes replicating, user went back online)`);
		}).on('denied', function (err) {
		  debug('denied', `SYNC ${name} => ${localStorage.databasePrefix}/${name}`,`a document failed to replicate (e.g. due to permissions)`);
		}).on('complete', function (info) {
		  debug('complete', `SYNC ${name} => ${localStorage.databasePrefix}/${name}`,`handle complete`);
		}).on('error', function (err) {
		  debug('error', `SYNC ${name} => ${localStorage.databasePrefix}/${name}`,`handle error`);
		});
		// dbFunctions.Sync = ()=>
		// 	sync; // whenever you want to cancel
		// dbFunctions.SyncCancel = ()=>
		// 	sync.cancel(); // whenever you want to cancel
		// dbFunctions.SyncCancel = ()=>
		// 	sync.cancel(); // whenever you want to cancel
	}
	name = name.replace(/_./g,x=>x.toUpperCase())
		.replace(/_/g,'')
		.replace(/^./,x=>x.toUpperCase());
	db.createIndex({
		index: {
		  fields: ['_id']
		}
	}).catch(x=>{});
	
	Object.keys(dbFunctions).map(fun=>{
		addAction(`db${name}${fun}`,dbFunctions[fun]);
		app[`db${name}${fun}`] = dbFunctions[fun];
	});
	// add mock url
	$.mockjax({
	  url: `select2:\/\/${name.toLowerCase()}/get`,
	  dataType: "json",
	  response: async function(settings,done) {
	  	console.log("ICI",settings)
	  	let {data={},dataType="json"} =  settings;
	  	let {$id="_id",$text=false,id=false} = data;
	  	if(!id){
	  		this.status = 403;
			this.responseText = "id non definit";
			return done();
	  	}
	  	if(!$text){
	  		this.status = 403;
			this.responseText = "Champ de text non definit";
			return done();
	  	}
	  	try{
		  	let doc = await db.get(id);
		  	this.responseText = {
  				id : doc[$id],
  				text : app.env.renderString($text,doc)
  			};
  			done();
		}catch(e){
	  		this.status = 500;
			this.responseText = e.message || e;
			done();
	  	}
	  }
	});
	$.mockjax({
	  url: `select2:\/\/${name.toLowerCase()}`,
	  dataType: "json",
	  response: async function(settings,done) {
	  	console.log("ICI",settings)
	  	let prefix = /^(\$|\>|\<)(.+)/;
	  	let {data={},dataType="json"} =  settings;
	  	let {$id="_id",$text=false,$limit=5,$page=1} = data;
	  	let sort = [];
	  	if(!$text){
	  		this.status = 403;
			this.responseText = "Champ de text non definit";
			return done();
	  	}
	  	let expect = ["$or","$and"];
	  	Object.keys(data).forEach(name=>{
	  		if(expect.indexOf(name) != -1) return;
	  		let match = name.match(prefix);
	  		if(match){
	  			if(match[1] == ">"){
	  				sort.push({[match[2]]:"desc"})
	  				data[match[2]] = data[name];
	  			}else if(match[1] == "<"){
	  				sort.push({[match[2]]:"asc"})
	  				data[match[2]] = data[name];
	  			}
	  			data[name] = undefined;
	  			delete data[name];
	  		}
	  	});
	  	if(Object.keys(data).length == 0){
	  		let count = (await db.find({
		  		selector : data,
		  		fields : ["_id"]
		  	})).docs.length;
  		  	this.responseText = {
  		  		"results":[],
		  		total : count,
		  		page : $page,
		  		pagination: {
				    more: count > 0
				}
			};
  		  	return done();
	  	}
		try{
			let count = (await db.find({
		  		selector : data,
		  		fields : ["_id"]
		  	})).docs.length;
		  	let more = ($limit * ($page - 1) + $limit) < count
		  	await db.find({
		  		selector : data,
		  		limit : $limit,
		  		skip : $limit * ($page - 1),
		  		// sort : sort
		  	}).then(doc=>{
		  		this.responseText = {
		  			results : doc.docs.map(doc=>{
			  			return {
			  				id : doc[$id],
			  				text : app.env.renderString($text,doc)
			  			}
			  		}),
			  		total : count,
			  		totalPage : Math.ceil(count / $page),
			  		page : $page,
			  		pagination: {
					    more: more
					}
		  		}
	  		  	done();
		  	})
		}catch(e){
	  		this.status = 500;
			this.responseText = e.message || e;
			done();
	  	}
	    setTimeout(done,500)
	  }
	});
}
function removeAction (name) {
	if(name in ACTIONS){
		ACTIONS[name]= undefined;
		delete ACTIONS[name];
	}
}
function addAction (name,fn) {
	if(typeof fn !== 'function'){
		if(fn && typeof fn == 'object' && name in fn)
			fn = fn[name].bind(fn);
		if(typeof fn !== 'function')
			return false;
	}
	ACTIONS[name]=(id,arguments,path,msg={})=>{
		try{
			arguments = arguments.map(argument => decodeObject.call({sendMessage, path,moduleId:'master'}, argument));
			debug("\n>>> addAction\narguments ",arguments)

			var ret = fn(...arguments);
		}catch(e){
			console.error(e)
			var ret = e;
		}
		debug("sent from msg",msg);
		sendResult({id,path,arguments,...msg},ret);
	};
	return true;
}
async function sendResult(msg,ret){
    if(ret instanceof Error)
		ACTIONS_CACHE[msg.id].postMessage({
			id : msg.id,
			error : ret
	    });
	else{
		debug("sent from msg",msg);
		ACTIONS_CACHE[msg.id].postMessage({
			id : msg.id,
			data : encodeObject.call({
				registerAction:addAction,
				path:msg.path,
				moduleId:'master'
			},await ret)
	    });
	}
	process.nextTick(()=>{
		ACTIONS_CACHE[msg.id] = undefined;
		delete ACTIONS_CACHE[msg.id];
	})
};
async function lock(msg,moduleId){
	let view = $(`<div rel="lockView" style="
	    z-index: 100000011;
	    position: fixed;
	    top: 54px;
	    left: 0;
	    right: 0;
	    bottom: 0;
	">`);
	try{
		let [el,code] = await convertToDOMContent(msg.view,moduleId); 
		view.append(el);
		$('body').prepend(view);
		if(code)
			code.forEach(code=>{
				try{
					let selector = (selector,context)=>$(selector, context||$('[rel="lockView"]'));
					selector.get = $.get;
					code(app, selector,document.querySelector('[rel="lockView"]'));
				}catch(e){
					debug('ERROR',e);
				}
			});
	}catch(e){
		debug('ERROR',e)
		this.unlock(e);
	}
}
function loadModule (moduleId){
	let dir = path.join(__dirname,'..','modules');
	moduleId = moduleId.replace(PREFIX_MODULE_CORE,"");
	return new Promise(async (okFn,errorFn)=>{
		if(MODULE_LOADDED.indexOf(moduleId) !== -1) return okFn();
		MODULE_LOADDED.push(moduleId);
		if(!fs.existsSync(path.join(dir,moduleId)) && fs.existsSync(path.join(dir,PREFIX_MODULE_CORE+moduleId))){
			moduleId = PREFIX_MODULE_CORE+moduleId;
		}
		this.unlock = this.unlock || ((e)=>{
			$('[rel="lockView"]').remove();
			try{
				e = e.message || e || undefined;
			}catch(err){
				e = undefined;
			}
			canNext = true;
			try{
				worker.postMessage({
					unlock : true,
					error : e
				});
			}catch(e){}
			if(isDone) next();
		});
		if(!fs.existsSync(path.join(dir,moduleId,'index.js'))){
			return await lock.call(this,{
				view : "views/error.html?msg="+encodeURIComponent(`Module "${moduleId.replace(PREFIX_MODULE_CORE,"")}" not found`)
			},moduleId);
		}
		debug("load module",moduleId, new Date);
 		var canNext= true, isDone = false,next = ()=>{
 			if(canNext)
	 			okFn();
 		}
		
 		var worker = new Worker(path.join(__dirname,'module.js'), [
 			path.join(dir,moduleId,'index.js'), // file to execute
 			moduleId, // id of module
 			electron.remote.app.getPath('userData'), // folder to store
 			PREFIX_MODULE_CORE // prefix module
 		]);

		worker.onmessage =  async (ev)=> {
			var msg = ev.data;
			debug("new message",msg);
			if( "pause" in msg ){
				canNext = !msg.pause;
				if(canNext){
					$('div[rel=lockView]').remove();
					if(isDone)
						next();
				}else{
					await lock.call(this,msg,moduleId);
				}
			} else if( "ready" in msg ){
				debug("module",moduleId,"loadded", new Date);
				isDone = true;
				MODULE_LIST[moduleId] = worker;
				next();
			}else if("registerAction" in msg && !(msg.registerAction in ACTIONS)){ // add action global
				// transmit the message to the worker
				ACTIONS[msg.registerAction] = function (id,arguments, path="") {
					worker.postMessage({
						action : msg.registerAction,
						arguments, path : "",
						id
					});
				};
			}else if("registerAction" in msg && msg.registerAction in ACTIONS){
				worker.postMessage({
					id : msg.id,
					error : {
						code : 'ALREADY DEFINED',
						message : "Action '"+msg.registerAction+"' is Already defined"
					}
				})
			} else if("action" in msg){ // execute action
				let action = (msg.path ? (msg.path+"/") : "")+ msg.action;
				debug(action)
				if(action in ACTIONS){
					ACTIONS_CACHE[msg.id] = worker;
					ACTIONS[action](msg.id,msg.arguments,msg.path,msg);
				}else{
					worker.postMessage({
						id : msg.id,
						error : {
							code : 'NOTFOUND',
							message : "Action '"+msg.action+"' with path '"+msg.path+"' non trouvée"
						}
					})
				}
			} else if("error" in msg || "data" in msg){ // transmit response
				ACTIONS_CACHE[msg.id].postMessage(msg);
				process.nextTick(()=>{
					ACTIONS_CACHE[msg.id] = undefined;
					delete ACTIONS_CACHE[msg.id];
				})
			}else{
				worker.postMessage({
					id : msg.id,
					error : {
						code : 'UNKNOW',
						message : "Unknow Error"
					}
				})
			}
		}
	});
}
function sendMessage(action,path,arguments) {
	debug("\n>>> sendMessage[master]\narguments",arguments)
	arguments = arguments.map(argument => encodeObject.call({registerAction : addAction,path,moduleId:'master'},argument));
	debug("\n>>> sendMessage[master]\narguments",arguments)

	return new Promise((okFn,errorFn)=>{
		var id = "app-action-"+Date.now()+"-"+Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
		
		ACTIONS_CACHE[id] = {
			postMessage(msg){
				if("error" in msg){
					debug("WARN",msg)
					let err = new Error(msg.error.message || msg.error);
					if('code' in msg.error)
						err.code = msg.error.code;
					if('stack' in msg.error)
						err.stack = msg.error.stack;
					errorFn(err);
				}else if("data" in msg){
					try{
						msg.data = decodeObject.call({sendMessage,path:msg.path,moduleId:'master'},msg.data);
					}catch(e){
						debug(e)
					}
					okFn(msg.data);
				}else if("SharedObject" in msg){
					okFn(msg.SharedObject.reduce((a,b)=>{
						a[b] = async function(){
							return sendMessage(b,msg.path,[...arguments]);
						};
						Object.defineProperty(a[b],'toString',{
							get(){
								return ()=>'async function(){ [external code] }';
							},
							configurable : false,
							enumerable : false
						});
						return a;
					},{}));
				}else{
					errorFn({
						code : "UNKNOW",
						message : "Unknow Error"
					})
				}
			}
		};
		if(`${path}/${action}` in ACTIONS)
			ACTIONS[`${path}/${action}`](
				id,arguments,path
		    );
		else if((path == "" || path == "/") && action in ACTIONS)
			ACTIONS[action](
				id,arguments,path
		    );
		else{
			ACTIONS_CACHE[id].postMessage({
				id,
				error : {
					code : 'NOTFOUND',
					message : "Action '"+action+"' with path '"+path+"' non trouvée"
				}
			});
			process.nextTick(()=>{
				ACTIONS_CACHE[id] = undefined;
				delete ACTIONS_CACHE[id];
			})
		}
	})
}
function loadExt(files, after,error) { 
  var _this=this; 
  _this.files = files;
  _this.js = [];
  _this.head = document.getElementsByTagName("head")[0];
  _this.after = after || function(){};
  _this.loadStyle = function(file) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = file;
    _this.head.appendChild(link);
  };
  _this.loadScript = function(i) {

    var loadNextScript = function() { 
      if (++i < _this.js.length) _this.loadScript(i);  
      else _this.after();  
    };
  	if(loadExt._CACHE.indexOf(_this.js[i]) != -1) return loadNextScript();
  	loadExt._CACHE.push(_this.js[i]);
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = _this.js[i];
    script.onload = function() { loadNextScript() };
    script.onerror = function() { error() };
    _this.head.appendChild(script);
  }  
  for (var i=0;i<_this.files.length;i++) {  
    if (/\.js$|\.js\?/.test(_this.files[i])) _this.js.push(_this.files[i])
    if (/\.css$|\.css\?/.test(_this.files[i])) _this.loadStyle(_this.files[i])
  }
  if (_this.js.length>0) _this.loadScript(0);  
  else _this.after();
};
loadExt._CACHE = [];
const initAPI = async function (menuEl,contentEl){
		window.onblur = ()=>{
			//$(`.tooltip`).remove();
			//$('.editable').editable('disable');
		};
		const store = new Store({
		  // We'll call our data file 'user-preferences'
		  configName: 'user-preferences',
		  defaults: {
		  	TAXE1 : 0,
		  	TAXE2 : 0,
		  	ENTREPRISE : "Lynn ERP",
		  	LOGO : "img/logo.png",
		  	BP : "4387 Libreville Gabon",
			TEL : "+241 06 46 28 45 - 04 43 44 41",
			EMAIL : "info@oshimin.com",
			NIF : "34009V",
			RCCM : "2013B14559",
			BANK : "BGFI GA21 4000 3041 0041 0280 4201 138"
		  }
		});
		this.store = store;
		await this.import(...(["nunjucks.js","DatabindExtension.js","pouchdb-7.0.0.min.js","pouchdb.find.js"].map(x=>"file://"+path.join( __dirname,x))));
		class NunjucksWebLoader extends nunjucks.Loader {
			constructor(baseURL, opts) {
				super()
			    this.baseURL = baseURL || '.';
			    opts = opts || {}; // By default, the cache is turned off because there's no way
			    // to "watch" templates over HTTP, so they are re-downloaded
			    // and compiled each time. (Remember, PRECOMPILE YOUR
			    // TEMPLATES in production!)

			    this.useCache = !!opts.useCache; // We default `async` to false so that the simple synchronous
			    // API can be used when you aren't doing anything async in
			    // your templates (which is most of the time). This performs a
			    // sync ajax request, but that's ok because it should *only*
			    // happen in development. PRECOMPILE YOUR TEMPLATES.

				this.async = !!opts.async;
			  }

			  resolve(from, to) {
			    throw new Error('relative templates not support in the browser yet');
			  }

			  getSource(name, cb) {
			    var useCache = this.useCache;
			    var result;
			    debug("WEB LOADER",this.baseURL + '/' + name)
			    var fileUrl = url.parse(name);
			    if(fileUrl.protocol)
			    	fileUrl  = name;
			    else
			    	fileUrl  = this.baseURL + '/' + name;
			    this.fetch(fileUrl, function (err, src) {
			      if (err) {
			        if (cb) {
			          cb(err.content);
			        } else if (err.status === 404) {
			          result = null;
			        } else {
			          throw err.content;
			        }
			      } else {
			        result = {
			          src: src,
			          path: name,
			          noCache: !useCache
			        };

			        if (cb) {
			          cb(null, result);
			        }
			      }
			    }); // if this WebLoader isn't running asynchronously, the
			    // fetch above would actually run sync and we'll have a
			    // result here

			    return result;
			  }

			  fetch(url, cb) {

			    // Only in the browser please
			    if (typeof window === 'undefined') {
			      throw new Error('WebLoader can only by used in a browser');
			    }

			    var ajax = new XMLHttpRequest();
			    var loading = true;

			    ajax.onreadystatechange = function () {
			      if (ajax.readyState === 4 && loading) {
			        loading = false;

			        if (ajax.status === 0 || ajax.status === 200) {
			          cb(null, ajax.responseText);
			        } else {
			          cb({
			            status: ajax.status,
			            content: ajax.responseText
			          });
			        }
			      }
			    };

			    url += (url.indexOf('?') === -1 ? '?' : '&') + 's=' + new Date().getTime();
			    ajax.open('GET', url, this.async);
			    ajax.send();
			}
		}
		this.env = new nunjucks.Environment(new NunjucksWebLoader('./views',{async: true, useCache : false}), { autoescape: true });
		this.env.renderPromise  = (function(fn,src, ctx){ return new Promise((okFn,errFn)=>{ fn(src, ctx,(err,data)=>err ? errFn(err) : okFn(data)) }) }).bind(this,this.env.render.bind(this.env))
		let IncludeWithExtension = require("./IncludeWithExtension.js")(nunjucks,convertToDOMContent);
        this.env.addExtension('IncludeWithExtension', new IncludeWithExtension(this.env));
        this.env.addExtension('BindExtension', new DatabindExtension());
        this.env.addGlobal('app', {
        	get locales(){
        		return app.locales
        	},
        	get store(){
        		return app.store
        	},
        	get droits(){
        		return Object.keys(app.droits).map(droits=>({
        			name : droits,
        			label : app.droits[droits].title,
        			description : app.droits[droits].description,
        			icon : app.droits[droits].icon,
        			items : Object.keys(app.droits[droits].items).map(droit=>({
        				name : droits+"/"+droit,
        				label : app.droits[droits].items[droit].title,
        				icon : app.droits[droits].items[droit].icon
        			}))
        		}))
        	}
        })
        this.env.addGlobal("extends",function(object, useStore=false){
        	// debug("env",this);
        	object = app.extendsData[object] || {};
        	for (let key in object)
        		if(key in this.ctx)
        			object[key].value = useStore ? app.store.get(key) : this.ctx[key];
        	return object;
        })
        this.env.addGlobal("safeMenu", ()=>{
        	let appMenu = {};
        	for(let menu in app.menu){
				let items = {};
				let key = menu;
				menu = app.menu[menu];
				for(let subMenu in menu.items){
					let menuItems = {};
					let key = subMenu;
					subMenu = menu.items[subMenu];
					if(subMenu.type == 'menu'){
			            for(let item in subMenu.items){
			                let key = item;
			                item = subMenu.items[item];
			                if(canAccess(item.view))
			                    menuItems[key] = item;
			            }
						if(Object.keys(menuItems).length)
							items[key] = {...subMenu, items : menuItems};
			    	}else if(subMenu.view && canAccess(subMenu.view))
						items[key] = subMenu;
				}
			    if(Object.keys(items).length)
			        appMenu[key] = {...menu, items : items};
			}
			return appMenu;
        })
        this.env.addFilter('explode',(string,sep)=>string.split(sep).map(x=>x.replace(sep,"")).filter(x=>x).map(x=>x.trim()))
        this.env.addGlobal('canAccess',canAccess)
        this.env.addGlobal('canDo',canDo);
		this.env.addGlobal('generateUUID',generateUUID);
		this.env.addFilter('generateUUID',generateUUID);
		this.env.addGlobal('moment',moment);
		this.env.addGlobal('convertToMoney',convertToMoney);
		this.env.addFilter('convertToMoney',convertToMoney);
		this.env.addGlobal('convertToMontant',convertToMontant);
		this.env.addFilter('convertToMontant',convertToMontant);
		this.env.addGlobal('is',(obj,type)=>typeOf(obj) === type || typeof obj === type);
		this.env.addFilter('is',(obj,type)=>typeOf(obj) === type || typeof obj === type);
		this.env.addGlobal('typeof',typeOf);
		this.env.addFilter('typeof',typeOf);
		this.env.addFilter('has',(obj,property)=>{
			if(Array.isArray(obj))
				return obj.indexOf(property) !== -1;
			else if(typeof obj == 'object')
				return obj !== null && obj != undefined ? obj.hasOwnProperty(property) : false
		});
		this.env.addFilter('push',(obj,data)=>{
			if(Array.isArray(obj))
				obj.push(data);
			else if(typeof obj == 'object' && typeof data == 'object')
				Object.keys(data).forEach(i=>obj[i] = data[i]);
			return obj;
		});
		addAction("getUserPreference", store.get.bind(store));
		addAction("setUserPreference", store.set.bind(store));
		addAction("hasUserPreference", store.has.bind(store));
		addAction("getUserPreferences", store.keys.bind(store));
		addAction("createMenu",this);
		addAction("getMenu",this);
		addAction("security", this);
		addAction("extends", this);
		addAction("createDroits",this);
		addAction("getDroits",this);
		addAction("createWidget",this);
		addAction("getWidget",this);
		addAction("registerProtocol",this);
		addAction("trigger",this);
		addAction("addLocales",this);
		addAction("import",(...modules)=>new Promise(async (okFn,errorFn)=>{
			for(let dirIndex in modules){
				await loadModule.call(this,modules[dirIndex]);
			};
			okFn();
		}));
		addAction("createDatabase",configureDatabase);
		await configureDatabase();
		let moduleDir = path.join(__dirname,'..','modules');
		let modules = (await readDir(moduleDir)).sort((a,b)=>{
			if(/^~/.test(a)) return -1;
			if(/^~/.test(b)) return 1;
			return a < b ? -1 : (a > b ? 1 : 0)
		});
		let MODULE = 0;
		for(let dirIndex in modules){
			await loadModule.call(this,modules[dirIndex]);
		};
		this.once("modulesLoaded",async ()=>{
			var app = this;
			app.unlock = undefined;
			const el = ( domstring ) => {
			    const html = new DOMParser().parseFromString( domstring , 'text/html');
			    return html.body.firstChild;
			};
			document
				.querySelector(menuEl)
				.parentNode
				.replaceChild(
					el(
						await this.env.renderPromise(
							"menu.html",
							{
								menu : this.menu,
								options : this.menuOptions
							}
						)
					)
					,document.querySelector(menuEl)
				);
			$('.menu-activated-on-click').on('click', 'li.has-sub-menu > a', function(ev){
				if(this.parentNode.classList.contains("active"))
					app.menuOptions.actif =  this.parentNode.getAttribute("item-id");
			});
			$('body').on('click', 'a', async function(e){
				e.preventDefault();
				var rel =  this.getAttribute("rel") || "page";
				var href =  this.getAttribute("href") || "#";
				var data = $(this).data();
				if(/^#/.test(href) || href == "" || /^javascript:/.test(href))return false;
				if(rel == "modal"){
					app.loadModal(href,data)
				}else{
					try{
						await app.loadView(href, document.querySelector('.content-box'),document.querySelector('.title-box'),data);
					}catch(e){
						await app.loadView("error.html?exit=0&msg="+encodeURIComponent(`View "${href}" not found`), document.querySelector('.content-box'),document.querySelector('.title-box'),data);
					}
					$('.content-box').css('visibility','visible');
				}
				return false;
			});
			$('.content-box').html('').css('visibility','hidden');
			for (let widgetId in this.widgets) {
				if(!this.widgets[widgetId].view || !canAccess(this.widgets[widgetId].view)) continue;
				console.debug(`app.widgets[${widgetId}]`,this.widgets[widgetId]);
				$('.widget-box').append(
					$(`<div class="row" id="widget-${widgetId}">
		                <div class="col-sm-${this.widgets[widgetId].size || 12}">
		                  <div class="element-wrapper">
		                    <div class="element-actions"></div>
		                    <h6 class="element-header">${this.widgets[widgetId].title || ""}</h6>
		                    <div class="element-content" id="element-${widgetId}"></div>
		                  </div>
		                </div>
		            </div>`)	
				);
				await this.loadView(this.widgets[widgetId].view, document.querySelector(`#widget-${widgetId} .element-content`),undefined,{})
			};
			this.security("settings.html",["*"]);
			this.on("update-settings",()=>{
				$("img.entreprise-logo").attr("src",this.store.get("LOGO") || "img/logo.png");
			});
			$("img.entreprise-logo").attr("src",this.store.get("LOGO") || "img/logo.png");
			this.emit('ready');
			debug("ready")
			removeAction("import");
			removeAction("getWidget");
			removeAction("createWidget");
			addAction("goto",this);
		})
		
		this.emit("modulesLoaded");
	}
const aggregation = (baseClass, ...mixins) => {
    let base = class _Combined extends baseClass {
        constructor (...args) {
            super(...args)
            mixins.forEach((mixin) => {
                mixin.prototype.initializer.call(this)
            })
        }
    }
    let copyProps = (target, source) => {
        Object.getOwnPropertyNames(source)
            .concat(Object.getOwnPropertySymbols(source))
            .forEach((prop) => {
            if (prop.match(/^(?:constructor|prototype|arguments|caller|name|bind|call|apply|toString|length)$/))
                return
            Object.defineProperty(target, prop, Object.getOwnPropertyDescriptor(source, prop))
        })
    }
    mixins.forEach((mixin) => {
        copyProps(base.prototype, mixin.prototype)
        copyProps(base, mixin)
    })
    return base
};
const addItem = (item,itemId,title,type="page",view="#",icon="os-icon os-icon-zap")=>{
	debug("add item",itemId,title,type,view,icon)
	var itemToAdd = item.items[itemId] || getItem(icon, title,{},view,type);
	if(title)
		itemToAdd.title = title;
	itemToAdd.items = undefined;
	itemToAdd.actions = undefined;
	item.items[itemId] = itemToAdd;

	return new SharedObject({
		setBadge(badge,color="danger"){
			color = BADGE_COLORS.indexOf(color.toString().toLowerCase()) != -1 ? color.toString().toLowerCase() : 'danger';
			i.badge = (badge || "").toString();
			i.badgeColor = (color || "danger").toString();
		},
		setTitle(title){
			i.title = title;
		},
		setView(view){
			i.view = view;
		}
	})
};
const getItem=(icon, title,itemsObj,view,type= 'page')=>{
	let item = {
		title,
		view,type,icon,badge : "",
		items : {},
		actions : new SharedObject({
			setView(view){
				item.view = view;
				item.type = item.type == "menu" ? "page" : item.type;
			},
			setTitle(title){
				item.title = title;
			},
			setIcon(icon){
				item.icon = icon || "os-icon os-icon-zap";
			},
			
			setBadge(badge,color="danger"){
				color = BADGE_COLORS.indexOf(color.toString().toLowerCase()) != -1 ? color.toString().toLowerCase() : 'danger';
				item.badge = (badge || "").toString();
				item.badgeColor = (color || "danger").toString();

			},
			setType(type){
				type = PAGE_TYPE.indexOf(type.toString().toLowerCase()) != -1 ? type.toString().toLowerCase() : 'menu';
				item.type = type;
			},
			getItem(id){
				if(item.items[id])
					return new SharedObject({
						setBadge(badge,color="danger"){
							color = BADGE_COLORS.indexOf(color.toString().toLowerCase()) != -1 ? color.toString().toLowerCase() : 'danger';
							if(item.items[id]){
								item.items[id].badge = (badge || "").toString();
								item.items[id].badgeColor = (color || "danger").toString();
							}
						},
						setTitle(title){
							if(item.items[id])
								item.items[id].title = title;
						},
						setView(view){
							if(item.items[id])
								item.items[id].view = view;
						}
					})
			},
			removeItem(id){
				if(item.items[id])
					item.items[id] = undefined;
			},
			addItemPage(itemId,title,view="#",icon="os-icon os-icon-zap"){
				return addItem(item,itemId,title,'page',view,icon);
			},
			addItemModal(itemId,title,view="#",icon="os-icon os-icon-zap"){
				return addItem(item,itemId,title,'modal',view,icon);
			},
			setTitleItem(id,title){
				if(id in item.items)
					item.items[id].title = title;
			},
			setViewItem(id,view){
				if(id in item.items)
					item.items[id].view = view;
			},
			setBadgeItem(id,badge,color="danger"){
				if(id in item.items){
					color = BADGE_COLORS.indexOf(color.toString().toLowerCase()) != -1 ? color.toString().toLowerCase() : 'danger';
					item.items[id].badge = (badge || "").toString();
					item.items[id].badgeColor = (color || "danger").toString();
				}
			},
			setTypeItem(id,type){
				type = PAGE_TYPE.indexOf(type.toString().toLowerCase()) != -1 ? type.toString().toLowerCase() : 'menu';
				if(id in item.items)
					item.items[id].type = type;
			}
		})
	};
	return item;
}
class API extends EventEmitter {
	import (){
		return new Promise((ok,err)=>{
			new loadExt([...arguments],ok,err);
		})
	}
	extends (){
		aggregation.call(this,[...arguments])
	}
	trigger (evt, ...args){
		let msg = {
			event : evt,
			arguments : encodeObject.call({
				registerAction:addAction,
				path:"",
				moduleId:'master'
			},args)
	    };
		Object.keys(MODULE_LIST).forEach(moduleId=>MODULE_LIST[moduleId].postMessage(msg));
	    this.emit.apply(this,[evt,...args]);
	}
	registerProtocol(options, exitIfFails){
		options.type = (options.type || 'buffer').toString().toLowerCase();
		debug(options);
		let protocols = {
			"buffer" : (err,response)=>{
				if(err) return undefined;
				if(typeof response == 'object' && "data" in response && "mimeType" in response){
  					try{
	  					response.data = Buffer.from(response.data);
	  				}catch(e){
	  					try{
		  					response.data = Buffer.from(Object.values(response.data));
		  				}catch(e){}	
	  				}
  					return response;
		    	}else{
		    		try{
	  					return Buffer.from(response);
	  				}catch(e){
		  				return Buffer.from(Object.values(response));
	  				}
		    	}
			},
			"file" : (err,response)=>{
				if(err) return undefined;
				if(typeof response == 'object' && "path" in response){
  					return response;
		    	}else if(typeof response == "string"){
  					return {path : response};
		    	}
			},
			"http" : (err,response)=>{
				if(err) return undefined;
				if(typeof response == 'object' && "url" in response && "method" in response)
					return response;
			}
		};
		let proto = Object.keys(protocols).indexOf(options.type) == -1 ? 'buffer' : options.type;
	  	return new Promise(async (okFn,errorFn)=>{
	  		protocol.isProtocolHandled(await options.scheme,async (ok,e)=>{
				debug("<=|",ok,e,"|=>")
	  			if(!ok) {
	  				protocol  			
			  			[`register${proto.replace(/^./,(x)=>x.toUpperCase())}Protocol`](
			  				await options.scheme,
			  				async function (request, callback) {
			  					debug("registerProtocol",Object.keys(request));
			  					let response;
			  					try{
				  					response  = await options.callback(request);
				  					response = protocols[proto](null,response);
				  				}catch(e){
				  					debug("Error registerProtocol Handler",e)
				  					response = protocols[proto](e);
				  				}
						    	callback(response);
							}, async (error) => {
					    		if (error) {
					    			debug('ERROR','Failed to register protocol',error);
					    			errorFn(error);
					    		} else{
					    			debug("protocol",options.scheme,"added")
					    			okFn(true)
					    		}
							}
						)
	  			} else{
	  				setTimeout(async ()=>{
		  				protocol
				  			.unregisterProtocol(await options.scheme,async (error)=>{
				  				debug("<=|",error && !exitIfFails,"|=>")
			    				if(!exitIfFails){
				    				debug("retry",error,e);
			    					okFn(await this.registerProtocol(options, true));
			    				}else{
					    			debug('ERROR','Failed to unregister protocol',error);	
				    				errorFn(error);
				    			}
				  			})
	  				},1000)
	  			}
	  		})
	  	})
	}
	async goto(href,data={}){
		$('.content-box').html('').css('visibility','visible');
		await app.loadView(href, document.querySelector('.content-box'),document.querySelector('.title-box'),data);
		return ;
	}
	loadModal(href,data,parent){
		return (new Promise(async (okFn,errorFn)=> {
		try{
			var modal = $($("#modal-box").html());
			MODAL_STACK.push(modal);
			modal.one('hidden.bs.modal', function (e) {
				MODAL_STACK.pop();
				modal.prev('.modal-backdrop.fade.show').remove();
				modal.modal('dispose');
				modal = undefined;
				okFn(null); // if not resultats send
			})
			let app = this;
			modal.get(0).done = okFn;
			modal.get(0).fail = errorFn;
			await app.loadView(href, $('.modal-body',modal).get(0), $('.modal-title',modal).get(0),data,modal.get(0));
			$('a',modal).click(async function(e){
				e.preventDefault();
				var rel =  this.getAttribute("rel") || "page";
				var href =  this.getAttribute("href") || "#";
				var data = $(this).data();
				if(rel == "modal")
					app.loadModal(href,data,modal);
				else {
					await app.loadView(href, document.querySelector('.content-box'),document.querySelector('.title-box'),data);
					$('.content-box').css('visibility','visible');
					modal.one('hidden.bs.modal', function (e) {
					  let i;
					  while(i = MODAL_STACK.pop()){
					  	if(!i) break;
						i.modal("hide");
					  };
					})
					modal.modal("hide");
				}
				return false; 
			})
			modal.modal();
		}catch(e){console.error("+++",e)}
		})).catch(x=>{
			console.error(x);
			return x;
		}).then(x=>{
			console.log(x);
			return x;
		})
	}
	async loadView(href,el,titleEl, data={},isModal=false){
		
		if(!canAccess(href)){
			showError('Droits insuffisant !','error',true);
			console.log('Droits insuffisant !',href)
			return;
		}
		window.documentRel = el;
		window.documentRelTitle = titleEl;
		$('[data-toggle="tooltip"]', el).tooltip('hide');
		showError('Chargement ...','loading',false);
		$(".tooltip").remove();
		$('.editable').editable('disable');
		while($("#end-document").next().length)$("#end-document").next().remove() // remove all insert node

		if(el.unload){
			try{
				el.unload()
			}catch(e){}
			el.unload =  undefined;
		}
		el.innerHTML = LOADER_HTML;
		href = url.parse(href);
		let moduleId = href.protocol || 'master';
		console.log('setTitle',setTitle)
		setTitle("",titleEl)
		let [content,code] = await convertToDOMContent(url.format(href),moduleId,data || {}, titleEl,isModal);
		$(el)
			.html("")
			.append(content);
		if(code)
			code.forEach(code=>{
				try{
					let selector = (selector,context)=>$(selector, context||el);
					selector.get = $.get;
					console.log("range call ",el)
					code(app, selector, el);
				}catch(e){
					debug('ERROR',e);
				}
			});
		setTimeout(()=>hideError(),500);
		return el; 
	}
	createMenu(id,title){
		let app = this;
		let menu = app.menu[id] || {
			title : title,
			items : {},
			actions : new SharedObject({
				getItem(id){
					if(menu.items[id])
						return menu.items[id].actions;
				},
				remove(){
					if(app.menu[id])
						app.menu[id] = undefined;
				},
				removeItem(id){
					if(menu.items[id])
						menu.items[id] = undefined;
				},
				addSubmenu(itemId, title,icon="os-icon os-icon-zap"){
					var item = menu.items[itemId] || getItem(icon, title,{},null,"menu");
					if(title)
						item.title = title;
					menu.items[itemId] = item;
					return item.actions;
				},
				setTitle(title){
					menu.title = title;
					return title;
				},
				addLinkPage(itemId,title,view="#",icon="os-icon os-icon-zap"){
					debug('linkPage',title);
					var item = menu.items[itemId] || getItem(icon, title,{},view,"page");
					if(title)
						item.title = title;
					menu.items[itemId] = item;
					return item.actions;
				},
				addLinkModal(itemId,title,view="#",icon="os-icon os-icon-zap"){
					debug('linkModal',title);
					var item = menu.items[itemId] || getItem(icon, title,{},view,"modal");
					if(title)
						item.title = title;
					menu.items[itemId] = item;
					return item.actions;
				}
			})
		};
		if(title)
			menu.title = title;
		this.menu[id] = menu;
		return menu.actions;
	}
	getMenu(id){
		return id in this.menu ? this.menu[id].actions : null; 
	}
	addLocales(name, data){
		if(name && typeof data != 'function')
			this.locales[name] = data;
	}
	createDroits(id,title, description="",icon="os-icon os-icon-zap"){
		let app = this;
		let droits = app.droits[id] || {
			title : title,
			items : {},
			description : description,
			actions : new SharedObject({
				getDroit(id){
					if(droits.items[id])
						return droits.items[id].actions;
				},
				remove(){
					if(app.droits[id])
						app.droits[id] = undefined;
				},
				removeDroit(id){
					if(droits.items[id])
						droits.items[id] = undefined;
				},
				addDroit(itemId, title,icon="os-icon os-icon-zap"){
					var item = droits.items[itemId] || {
						title : title,
						icon  : icon,
						actions : new SharedObject({
							setTitle(title){
								item.title = title;
							},
							setIcon(icon){
								item.icon = icon || "os-icon os-icon-zap";
							}
						})
					};
					if(title)
						item.title = title;
					if(icon)
						item.icon = icon;
					droits.items[itemId] = item;
					return item.actions;
				},
				setTitle(title){
					droits.title = title;
				},
				setDescription(description){
					droits.description = description;
				}, 
				setIcon(icon){
					droits.icon = icon || "os-icon os-icon-zap";
				}
			})
		};
		if(title)
			droits.title = title;
		if(description)
			droits.description = description;
		if(icon)
			droits.icon = icon;
		this.droits[id] = droits;
		return droits.actions;
	}
	getDroits(id){
		return id in this.droits ? this.droits[id].actions : null; 
	}
	createWidget(id,title,view=null, size=null){
		let app = this;
		let widget = app.widgets[id] || {
			title : title || "",
			view : view || null,
			size : size || 12,
			actions : new SharedObject({
				remove(){
					if(app.widgets[id])
						app.widgets[id] = undefined;
				},
				setView(view){
					widget.view = view || null;
				},
				setTitle(title){
					widget.title = title || "";
				},
				setSize(size=12){
					widget.size = size || 12;
				}
			})
		};
		if(title)
			widget.title = title;
		if(view)
			widget.view = view;
		if(size)
			widget.size = size;
		app.widgets[id] = widget;
		return widget.actions;
	}
	getWidget(id){
		return id in this.widgets ? this.widgets[id].actions : null; 
	}
	security(url,roles){
		if(url in this.roles) return;
		this.roles[url] = [];
		if(Array.isArray(roles))
			roles.forEach(roles=>(typeof roles === "string")? this.roles[url].push(roles):"");
		else if(typeof roles === "string")
			this.roles[url].push(roles);
	}
	extends(object,properties){
		if(typeof properties == 'object' && typeof object == "string"){
			this.extendsData[object] =  this.extendsData[object] || {};
			Object.keys(properties).forEach(property=>this.extendsData[object][property] = properties[property])
		}
	}
	get canAccess(){
		return canAccess;
	}
	get canDo(){
		return canDo;
	}
	constructor(){
		super()
		this.menu = {};
		this.droits = {};
		this.widgets = {};
		this.extendsData = {};
		this.locales = {};
		this.roles = {};//url => roles
		this.menuOptions = {actif:""};
		initAPI.call(this,...arguments)
		return new Proxy(this,{
			get: (target, property, receiver)=>{
				if(property in this)
					return this[property];
				else if(!(property in ACTIONS))
					return undefined;
				let fn = async function() {};
				Object.defineProperty(fn,'toString',{
					get(){
						return ()=>'async function(){ [external code] }';
					},
					configurable : false,
					enumerable : false
				});
				return new Proxy(fn, {
				  apply: function(target, thisArg, argumentsList) {
				    return sendMessage(property,"",argumentsList);
				  }
				});
		  	}
		});
	}
};

module.exports = API;