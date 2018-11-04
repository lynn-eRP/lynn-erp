if(process.env.DEBUG){
	try{
		window.__devtron = {require: require, process: process}
	  require('devtron').install();
	}catch(e){}
}