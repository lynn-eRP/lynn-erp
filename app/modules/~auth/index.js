let droits = {
  "create" : "Creer Utilisateur",
  "update" : "Mettre a jour les utilisateurs",
  "delete" : "Supprimer les utilisateurs",
  "active" : "(Des)Active les utilisateurs",
  "reset-pwd" : "Reinitialiser mot de passe"
};
let droitsRole = {
  "update"     : "modifier les roles",
  "add" : "Ajouter des roles",
  "del" : "Supprimer les roles",
}
module.exports = async (app)=>{
  await app.import("core");
  debug("import done")
  await app.createDatabase("users");
  let getUsers = async (limit = 2)=>(await app.dbUsersFind({
      selector : {
        _id : {$regex : "^user/"},
        inactive : {$ne : true}
      },
      fields: ['_id'],
      limit : limit
    } )).docs;
  debug("get Count users");
  let countUser = (await getUsers()).length;
  debug("get Count users",countUser);
  if(countUser === 0){
    debug("Create the first user");
    // setTimeout(app.unlock,  5000);
    await app.lock("views/register.html");
    countUser = (await getUsers()).length;
  }
  if(countUser > 1){
    await app.lock("views/login.html");
  }else{
    debug("Get the first user");
    let user = (await app.dbUsersFind({
      selector : {
        _id : {$regex : "^user/"},
        inactive : {$ne : true}
      },
      limit : 1
    } )).docs[0];
    debug("Set the user", user);
    user.droits = [];
    if(user.roles[0] == "super-admin")
      user.roles = ["super-admin"];
    else if(user.roles.length){
      for(var role in user.roles)
        try {
          let index = role;
          role = user.roles[index];
          let r = (await app.dbUsersGet(role));
          user.roles[index] = r.role;
          user.droits = user.droits.concat(r.droits);
        }catch(e){}
      user.droits = user.droits.filter(function (value, index, self) { 
        return self.indexOf(value) === index;
      });
      user.roles = [(await app.dbUsersGet(user.roles[0])).role];
    }else
      user.roles = [""];
    app.addLocales('user', user);
  }

  let menu =  await app.createMenu("administration","Administration");
  { /* menu gestion des users */
    let gestUserMenu = await menu.addSubmenu("users","Utilisateurs");
    await gestUserMenu.addItemPage("new","Creer Utilisateur",getLink("views/c-user.html"));
    await gestUserMenu.addItemPage("users","Liste des utilisateurs",getLink("views/gest-user.html"));
  };
  { /* menu gestion des roles */
    let gestUserMenu = await menu.addSubmenu("roles","Roles");
    await gestUserMenu.addItemPage("new","Nouveau Role",getLink("views/c-role.html"));
    await gestUserMenu.addItemPage("roles","Liste des roles",getLink("views/roles-user.html"));
  };
  let d = await app.createDroits("users", "Gestion des utilisateurs" );
  Object.keys(droits).forEach(droit=>{
    d.addDroit(droit, droits[droit]);
  })
  let dRole = await app.createDroits("roles", "Gestion des roles" );
  Object.keys(droitsRole).forEach(droit=>{
    dRole.addDroit(droit, droitsRole[droit]);
  })
  
  app.security(getLink("views/roles-user.html"),[
    "roles/update",
    "roles/add",
    "roles/del"
  ])
  app.security(getLink("views/c-role.html"),[
    "roles/update",
    "roles/add",
  ])
  app.security(getLink("views/gest-user.html"),[
    "users/create",
    "users/update",
    "users/delete",
    "users/active"
  ])
  app.security(getLink("views/c-user.html"),[
    "users/create",
    "users/update"
  ])
  // console.log("has user ...",countUser)
}