let querystring = require("querystring");
let droits = {
  "create" : "Creer un client",
  "update" : "Mettre a jour un client",
  "delete" : "Supprimer un client"
};

module.exports = async (app)=>{
  	await app.import("auth");
  	await app.createDatabase("comptabilite");
	app.auth(msg=>{
		debug(msg.action,"from"+msg.moduleId)
	});
	let d = await app.createDroits("client", "Gestion des clients"  );
	Object.keys(droits).forEach(droit=>{
		d.addDroit(droit, droits[droit]);
	})
	{	/* Menu comptabilite */
		let menu =  await app.createMenu("comptabilite","Gestion de l'entreprise");

		let clients = await menu.addSubmenu("client","Clients");
		await clients.addItemPage("add","Nouveau Client",getLink("views/c-client.html"));
		await clients.addItemPage("list","Liste des Client",getLink("views/gest-client.html"));
		// add widget
		app.createWidget("clients","Clients",getLink("views/w-client.html"));

		app.security(getLink("views/c-client.html"),[
		    "client/update",
		    "client/create"
		])
		app.security(getLink("views/gest-client.html"),[
		    "client/update",
		    "client/delete",
		    "client/create",
		    "client/dash",
		])

		app.security(getLink("views/w-client.html"),[
		    "*"
		])
	};
	app.on("search",async (e,fn)=>{
		let block = await fn("client","icon-people","Clients",'list');
		let clients = 0;
		(await app.dbComptabiliteFind({
	        selector : {
          		_id : { $regex : "^client/" },
    			$or : [
	    			{raison : { $regex : e }},
	    			{email : { $regex : e }},
	    			{telephone : { $regex : e }},
	    			{adresse : { $regex : e }}
	    		]
	        }
      	})).docs.forEach( doc=>{
      		block.addItem("icon-user",doc.raison.replace(e,`<span>${e}</span>`),getLink("views/c-client.html?"+querystring.stringify(doc)));
      		clients++;
		});
		if(!clients)
			block.noResults(); 
	})
}