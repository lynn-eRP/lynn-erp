let droits = {
  "create" : "Creer une facture",
  "create-devis" : "Creer un devis",
  "update" : "Mettre a jour une facture",
  "delete" : "Supprimer une facture",
  "widget" : "Voir les widget"
};

module.exports = async (app)=>{
  	await app.import("auth");
  	await app.import("clients");
  	await app.createDatabase("comptabilite");
	app.auth(msg=>{
		debug(msg.action,"from"+msg.moduleId)
	});
	let d = await app.createDroits("facture", "Gestion des facture" );
	Object.keys(droits).forEach(droit=>{
		d.addDroit(droit, droits[droit]);
	})

	{	/* Menu comptabilite */
		let menu =  await app.createMenu("comptabilite","Gestion de l'entreprise");
		let facturation = await menu.addSubmenu("factures","Facturation");
		await facturation.addItemPage("dashboard","Vue Global",getLink("views/dash.html"));
		await facturation.addItemPage("c-devis","Creer Devis",getLink("views/c-facture.html?devis=1"));
		await facturation.addItemPage("c-facture","Creer facture",getLink("views/c-facture.html"));
		await facturation.addItemPage("facture","Liste des factures",getLink("views/gest-facture.html"));
		await facturation.addItemPage("devis","Liste des devis",getLink("views/gest-facture.html"));
		await facturation.addItemPage("bons","Liste des bon de livraison",getLink("views/gest-facture.html"));
	};

	{ /* Droits des clients */
		let d = await app.getDroits("client");
		d.addDroit("dash", "Afficher les fiche client");
	}
	/* extends client data */
	app.extends("client",{
		airtel : {
			type  : 'tel',
			label : 'Telephone AirteMoney',
			placeholder : 'Numero de telephone' ,
			size : 6
		},
		bank : {
			type  : 'tel',
			label : 'Compte Bancaire',
			placeholder : 'Compte Bancaire' ,
			size : 6
		}
	})
	/* Add action on client list  */
	app.extends("client.actions",{
        dash : {
        	type : 'secondary', 
        	icon : 'fa fa-eye', 
        	title : 'Voir Factures', 
        	handler : function(doc,actions){
        		app.goto(getLink("views/dash-client.html"),doc);
        	}
        }
	})
	/*  set security of url */
	app.security(getLink("views/dash-client.html"),[
	    "client/dash",
	    "facture/create",
	    "facture/create-devis",
	    "facture/update"
	]);
	app.security(getLink("views/dash.html"),[
	    "client/dash",
	    "facture/create",
	    "facture/create-devis",
	    "facture/update"
	])
	app.security(getLink("views/c-facture.html"),[
	    "facture/create",
	    "facture/update"
	])
	app.security(getLink("views/w-facture.html"),[
	    "*"
	])
	app.security(getLink("views/bon-facture.html"),[
	    "facture/create",
	    "facture/update"
	])
	app.security(getLink("views/c-item.html"),[
	    "facture/create",
	    "facture/update"
	])
	// set facture expire
	let updateExp = async ()=>{
		let docs = (await app.dbComptabiliteFind({
	        selector : {
	          _id : { $regex : "^facture/" },
	          endAt : { $lte : Date.now() },
	          $or : [{type:'facture'}, {type:'devis'}]
	        }
      	})).docs.map( doc=>{
			doc.type = 'expire';
			return doc;
		});
		if(docs.length)
			await app.dbComptabilitePut(docs);
		setTimeout(updateExp,3600e3)
	};
	updateExp();

	app.on("search",async (e,fn)=>{
		let block = await fn("factures","icon-feather-file-text","Factures",'file');
		let blockDevis = await fn("devis","fa fa-file-o","Devis",'file');
		let devis = 0, facture = 0;
		(await app.dbComptabiliteFind({
	        selector : {
          		_id : { $regex : "^facture/" },
    			$or : [
	    			{libelle : { $regex : e }},
	    			{_id: {$regex : `^facture/.*${e}.*`}}
	    		],
    			type: { $regex : '^(facture|devis)$'}
	        }
      	})).docs.forEach( doc=>{
      		if(doc.type == 'devis')
      			blockDevis.addItem("fa fa-file-o",doc.libelle.replace(e,`<span>${e}</span>`),getLink("views/c-facture.html?_id="+doc._id)), devis++;
      		else
      			block.addItem("icon-feather-file-text",doc.libelle.replace(e,`<span>${e}</span>`),getLink("views/c-facture.html?_id="+doc._id)), facture++;
		});
		if(!devis)
			blockDevis.noResults(); 
		if(!facture)
			block.noResults(); 
	})
	// add widget
	app.createWidget("invoice","Facutres",getLink("views/w-facture.html"));
}