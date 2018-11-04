module.exports = {
	runInContext(code,context={}){
		console.log("context VM",context,code)
		try{
			with(context){
				return eval(code);
			}
		}catch(e){
			console.error("context VM",e);
		}
	},
	createContext(obj){
		return obj;
	}
}