module.exports = async (app)=>{
	app.auth(msg=>{
		debug(msg.action,"from"+msg.moduleId)
	});
}