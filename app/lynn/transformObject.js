const debug = require('debug')("lynn:transformObject");
let debugCode = debug.extend('encode');
let debugDecode = debug.extend('decode');
typeOf = (obj)=>obj === null ? 'null' : ( typeof obj == 'object' && obj.constructor ? obj.constructor.name.toLowerCase() :  typeof obj); 
module.exports = {
	encodeObject : function(argument,index,refs=[]){
		var id = "encode-obj-"+Date.now()+"-"+Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
			id = this.path+"/"+ this.moduleId + "/" + id;
		let debug = debugCode.extend(this.moduleId);
		let ref = refs.indexOf(argument);
		if(false && argument && typeof argument == "object" && ref != -1){ // disable circular
			debug("argument",ref,refs);
			// circular
			return {
				"[[circular]]" : ref
			}
		}
		if(Buffer.isBuffer(argument))
			argument = argument.toJSON();
		// if(refs.length == 0)
		// 	debug("encode", JSON.stringify(argument,null,2));
		refs.push(argument);

		// debug("Trace",(new Error).stack.replace(/^Error[ ]*[\n]/mi,"").trim());
		if(argument === undefined || argument === null)
			return null;
		else if(typeOf(argument) == "function"){
			// debug({
		 //    	"[[instanceof]]" : 'function',
		 //    	action : id,
		 //    	path : this.path
		 //    });
			if(this.registerAction)
				this.registerAction(id,argument);
			else{
				this.actions[id] = argument;
				postMessage({
					registerAction : id
			    });
			}
		    return {
		    	"[[instanceof]]" : 'function',
		    	action : id,
		    	path : this.path
		    }
		} else if(Array.isArray(argument)){
			return argument.map((argument, i) => module.exports.encodeObject.call(this,argument,index + "-"+ i,refs));
		} else if(typeof argument == "object"){
			return Object.keys(argument).map(key => [module.exports.encodeObject.call(this,argument[key],index + "-"+ key,refs),key]).reduce((a,b)=>{
				a[b[1]] = b[0];
				return a;
			},{});
		}else{
			return argument;
		}
	},
	decodeObject : function(argument,refs=[]){
		let debug = debugDecode.extend(this.moduleId);

		if(argument && typeof argument == "object" && "[[circular]]" in argument){
			debug("argument",argument["[[circular]]"], refs[argument["[[circular]]"]],refs);
			return refs[argument["[[circular]]"]];
		}
		// if(refs.length == 0)
		// 	debug("decode", JSON.stringify(argument,null,2));
		refs.push(argument);
		if(argument === undefined || argument === null)
			return null;
		else if(typeof argument == "object" && "[[instanceof]]" in argument && argument["[[instanceof]]"] == "function"){
			let a = async (...argumentsList)=>{
				debug("call",argument,this)
				return this.sendMessage(argument.action,argument.path,[...argumentsList]);
			};
			Object.defineProperty(a,'toString',{
				get(){
					return ()=>'async function(){ [external code] }';
				},
				configurable : false,
				enumerable : false
			});
			return a;
		} else if(Array.isArray(argument)){
			return argument.map((argument, i) => module.exports.decodeObject.call(this,argument,refs));
		} else if(typeof argument == "object"){
			return Object.keys(argument).map(key => [module.exports.decodeObject.call(this,argument[key],refs),key]).reduce((a,b)=>{a[b[1]] = b[0];return a},{});
		}else{
			return argument;
		}
	}
}

// Oshimin Labs SUARL au Capital de 1.000.000Fcfa
// NIF 34009V - RCCM 2013B14559 - BGFI GA21 4000 3041 0041 0280 4201 138
// BP : 4387 Libreville Gabon - Tel : +241 06 46 28 45 – 04 43 44 41 – Email : info@oshimin.com