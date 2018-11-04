{% import "forms.html" as form %}
{{ setTitle(("Facture No" if _id)+(_id if _id else "").replace("facture/","")) }}
  var index = 0; 
  var total = 0;
  let table = $(".invoice-table table");
  let addLine = $(".invoice-table table tbody .add-line");
  {% if _id %}
  let facture = await app.dbComptabiliteGet('{{ _id }}');
  if(!Array.isArray(facture.terms))
    facture.terms = [facture.terms];
  {% else %}
  let facture = {
    _id : "facture/"+(parseInt(moment().format("YYMMDD")).toString(36) + "-" + generateUUID("xxxyxx")).toUpperCase(),
    type : "{{ 'devis' if devis == 1 else ('avoir' if devis == 2 else 'facture') }}",
    endAt : moment().add(1,'month').toDate().getTime(),
    startAt : moment().toDate().getTime(),
    terms : new Array(5).fill(""),
    termsAlignement : 'left',
    items : [],
    client : {{( client |dump | safe) if client else 'undefined'}},
    libelle : "Libelle de la facture",
    taxe1 : TAXE1,
    taxe2 : TAXE2,
    taxeNom1 : app.store.get("TAXE1_NOM"),
    taxeNom2 : app.store.get("TAXE2_NOM")
  }
  {% endif %}
  function editable(i){
     let readOnly = facture.type == 'paye' || facture.type == 'expire';
     if(readOnly)
        i = 'disable';
     $('.editable').editable(i)
  }
  function setFactureData(){
    if('ctime' in facture){
      facture.mtime = Date.now();
      facture.updatedBy = app.locales.user._id;
    }else{
      facture.ctime = Date.now();
      facture.createdBy = app.locales.user._id;
    }
    facture.taxe1 = facture.taxe1 || TAXE1;
    facture.taxe2 = facture.taxe2 || TAXE2;
    facture.taxeNom1 = facture.taxeNom1 || app.store.get("TAXE1_NOM");
    facture.taxeNom2 = facture.taxeNom2 || app.store.get("TAXE2_NOM");
  }
  function updateBtn(doc,add=false){
    let readOnly = facture.type == 'paye' || facture.type == 'expire';
    let enablePrint  = 'client' in facture && 'ctime' in facture && facture.items.length > 0;
    let enableSave   = 'client' in facture && facture.libelle && facture.items.length > 0  && !readOnly;
    let enableRemove = 'ctime' in facture && !readOnly;
    let enableGotoDashClient = 'client' in facture && facture.client;
    let menu         = document.querySelector("svg-menu");
    // $("#print-pdf,#print").prop('disabled',disabledPrint);
    if(readOnly){
      editable('disable');
      addLine.hide();
    }else{
      editable('enable');
      addLine.show();
    }
    menu.disable('print',!enablePrint);
    menu.disable('print-pdf',!enablePrint);
    menu.disable('delete-facture',!enableRemove);
    menu.disable('save-facture',!enableSave );
    menu.disable('set-facture',!(enableSave  && facture.type === "devis"));
    menu.disable('set-payer',!(enableSave && facture.type === "facture") );
    menu.disable('print-bon',!(enablePrint && (facture.type === "paye" || facture.type == "facture")) );
    menu.disable('update-taxe',readOnly || ( facture.taxe1 == TAXE1 && facture.taxe2 == TAXE2));
    $("#goto-client-view").prop('disabled',!enableGotoDashClient);
    if(doc){
      doc.reduction = convertToMontant(doc.reduction);
      doc.montant = convertToMontant(doc.montant);
      doc.quantite = convertToMontant(doc.quantite);
      if(doc.reduction >= 1)
        doc.reduction = doc.reduction / 100;
      doc.reduction = doc.reduction < 0.1 ? 0 : doc.reduction;
      let totalLine = doc.quantite * (doc.montant - doc.montant*doc.reduction);
      if(add)
        total += totalLine;
      else
        total -= totalLine;
    }
    let taxe1 = facture.taxe1 || TAXE1;
    let taxe2 = facture.taxe2 || TAXE2;
    $('tbody .sous-total.sous-total-taxes > .montant').text(convertToMoney(total));// sous total
    if(taxe1 != 0){
      taxe1 = convertToMontant(total*taxe1/100);// taxe1
      $('tbody .taxe1.sous-total-taxes .taxe-nom').text(facture.taxeNom1 || app.store.get("TAXE1_NOM"));// taxe1
      $('tbody .taxe1.sous-total-taxes .montant').text(( app.store.get("TAXE1_SUB") && taxe1 ? "-" :"" )+convertToMoney(Math.abs(taxe1)));// taxe1
    }else{
      $('tbody .taxe1.sous-total-taxes .taxe-nom, tbody .taxe1.sous-total-taxes .montant').text("");
    }
    if(taxe2 != 0){
      taxe2 = convertToMontant(total*taxe2/100);// taxe2
      $('tbody .taxe2.sous-total-taxes .taxe-nom').text(facture.taxeNom2 || app.store.get("TAXE2_NOM"));// taxe2
      $('tbody .taxe2.sous-total-taxes .montant').text(convertToMoney(Math.abs(taxe2)));// taxe2
    }else{
      $('tbody .taxe2.sous-total-taxes .taxe-nom, tbody .taxe2.sous-total-taxes .montant').text("");
    }
    $('tfoot .total').text(convertToMoney(total + taxe1 + taxe2));// net a payer
    
  }
  updateBtn(); // init buttons

  function addNewLine(row,doc,init=false){
    editable('enable');
    if(!doc || typeof doc != "object") return;
    if(index > 10){
      console.log("add new page");
      return;
    }
    let action = new String(this || doc.type) + "";
    doc.type = action;
    doc.reduction = convertToMontant(doc.reduction);
    doc.montant = convertToMontant(doc.montant);
    doc.quantite = convertToMontant(doc.quantite);
    if(doc.reduction >= 1)
      doc.reduction = doc.reduction / 100;
    doc.reduction = doc.reduction < 0.1 ? 0 : doc.reduction;
    let totalLine = doc.quantite * (doc.montant - doc.montant*doc.reduction);
    doc.reduction = parseFloat((100 * doc.reduction).toFixed(2));
    let line = $(`
      <tr class="item-line" index="${index}">
        <td class="text-center index-line">
          ${++index}
        </td>
        <td class="text-left">
          ${doc.libelle}
        </td>
        <td class="text-right">
          ${convertToMoney(doc.montant)}
        </td>
        <td class="text-center">
          ${convertToMoney(doc.quantite," ","",0,"")}
        </td>
        <td class="text-center">
          ${ doc.reduction.toFixed((100*doc.reduction % 100)!= 0 ? 2 : 0)}%
        </td>
        <td class="text-right total-line">
          ${convertToMoney(totalLine)}        
          <span class="item-tools d-print-none">
            {{ form.button(generateUUID(), '<i class="fa fa-pencil"></i>',size='small',rounded=true,outline=false, type='primary',attributes = {
              'item-action': 'edit',
              'data-title' : "Modifier",
              'data-toggle': 'tooltip'
            }) }}
            {{ form.button(generateUUID(), '<i class="fa fa-remove"></i>',size='small',rounded=true,outline=false, type='danger',attributes = {
              'item-action': 'remove',
              'data-title' : "Supprimmer",
              'data-toggle': 'tooltip'
            }) }}
          <span>
        </td>
      </tr>
    `); 
    if(!row){
      line.insertBefore(addLine);
      row = line;
      if(!init)
        facture.items.push(doc);
    }else{
      index--;
      $('.index-line',line).text($('.index-line',row).text());
      $(line).attr('index',$(row).attr('index'));
      console.log("montant",$('.total-line',row).text(),convertToMontant($('.total-line',row).text())) 
      total -= convertToMontant($('.total-line',row).text());
      row.html(line.html());
      facture.items[convertToMontant($('.index-line',line).text())-1] = doc;
    }
    row.removeData().data(doc)// save doc
    row.attr("rel-action",action); // action handler
    $('[data-toggle="tooltip"]',row).click(function(){
      $(this).tooltip('hide');
      $(".tooltip").remove();
    }).tooltip();
    updateBtn(doc, true);
  }
  document.unload = function(){
    $(".editable-container.editable-popup").remove()
  }
  $('[data-toggle="tooltip"]').click(function(){
    $(this).tooltip('hide');
    $(".tooltip").remove();
  }).tooltip();

  $('.invoice-desc .desc-value').text(facture._id.replace(/^facture\//,""));
  // $('.invoice-desc .desc-label').on('save', function(e, params) {
  //   facture.type =params.newValue;
  // }).editable({
  //   type:  'select',
  //   source: [
  //         // {value: 'avoir', text: 'Avoir #'},
  //         {value: 'facture', text: 'Facture #'},
  //         {value: 'devis', text: 'Devis #'}
  //      ],
  //   select2: {
  //      multiple: false
  //   },
  //    title: 'Type de document'
  // }).editable('setValue',facture.type);
  if(facture.type == 'expire')
      $('.invoice-desc .desc-label').html("Document #");
  else if(facture.type == 'paye')
      $('.invoice-desc .desc-label').html("Facture #");
  else if(facture.type == 'devis')
      $('.invoice-desc .desc-label').html("Devis #");
  else if(facture.type == 'facture')
      $('.invoice-desc .desc-label').html("Facture #");
  $('#libelle').editable({
     type:  'text',
     name:  'username',
     emptytext : "Libelle de la facture"
  }).on('save', function(e, params) {
    facture.libelle =params.newValue;
    updateBtn();
  }).editable('setValue',facture.libelle);
  $("#terms-align").change(()=>{
    let val = $("#terms-align").val();
    $(".terms-content p").css("text-align", val); 
  }).val(facture.termsAlignement);
  $(".terms-content p").css("text-align", facture.termsAlignement);
  $('#mySelect2').select2({
      placeholder: 'Selectionez un client',
      allowClear: false,
      minimumInputLength: 2,
      // ajax: {
      //   url: 'select2://comptabilite',
      //   data: function (params) {
      //     let length = params.term.length;
      //     let queryParams = params.term.split('').reduce((a,b)=>a.indexOf(b) == -1 ? (a.push(b),a) : a,[]).filter(x=>/[a-z0-9-\+ _\.@%*]/i.test(x)).join('')
      //     var query = {
      //         '$text': "{\{raison}}",
      //         $or:[{raison : {
      //           '$regex' : `[${queryParams.toUpperCase()}]+`
      //         }},{raison : {
      //           '$regex' : `[${queryParams.toLowerCase()}]+`
      //         }},{raison : {
      //           '$regex' : `${params.term.split('').filter(x=>/[a-z0-9-\+ _\.@%*]/i.test(x)).join('')}`
      //         }}],
      //         "_id" : {'$regex' : "^client/"},
      //         '$limit' : 5,
      //         '$page' : params.page || 1
      //     };

      //     // Query parameters will be ?search=[term]&page=[page]
      //     return query;
      //   }
      // }
      data : (await app.dbComptabiliteFind({
        selector : {
          _id : {$regex : "^client/"}
        }
      })).docs.map(x=>({
        id : x._id,
        text : x.raison 
      }))
  }).on('change',async function(){
    if(!$(this).val()){
      $(".client-name").text("");
      $(".client-address").html("");
      facture.client = undefined;
      delete facture.client;
      updateBtn();
      return;
    }
    $(".client-address").html(loaderHTML);
    let doc = await app.dbComptabiliteGet($(this).val());
    console.log("change",$(this).val(),doc)
    $(".client-name").text(doc.raison);
    $(".client-address").html([
      doc.adresse,
      doc.telephone,
      doc.email
    ].filter(x=>x).join('<br>'));
    facture.client = doc._id;
    updateBtn();
  })
  try{
    let doc = await app.dbComptabiliteGet(facture.client);
    if(doc!==null) {
      let select2 = $('#mySelect2').select2();
      // create the option and append to Select2
      var option = new Option(doc.raison, doc._id, false, false);
      select2.append(option);
      select2.val(doc._id);
      select2.trigger('change');
      // manually trigger the `select2:select` event
      select2.trigger({
          type: 'select2:select',
          params: {
              data: {
                id : doc.id,
                text : doc.raison
              }
          }
      });
    }
  }catch(e){}// ignore error
  
  for(let i=1; i<6; i++)
    $('.terms-content p:nth-child('+i+')').editable({
      type: "text",
      emptytext : ""
    }).on('save', (function(e, params) {
      facture.terms[this] =params.newValue;
      updateBtn();
    }).bind(i-1)).editable('setValue',facture.terms[i-1])
  // dates d'expirations
  $('#expire-le').editable({
    type: 'date',
    clear : false,
    title : "Selectionez la date",
    format: 'yyyy-mm-dd',    
    viewformat: 'dd/mm/yyyy',    
    datepicker: {
      weekStart: 1
    }
  }).on('save', function(e, params) {
    facture.endAt =params.newValue.getTime();
      updateBtn();
  }).editable('setValue',moment(facture.endAt).toDate());
  $('#fait-le').editable({
    type: 'date',
    clear : false,
    title : "Selectionez la date",
    format: 'yyyy-mm-dd',    
    viewformat: 'dd/mm/yyyy',    
    datepicker: {
      weekStart: 1
    }
  }).on('save', function(e, params) {
    facture.startAt =params.newValue.getTime();
      updateBtn();
  }).editable('setValue',moment(facture.startAt).toDate());
  facture.items.forEach(doc=>addNewLine.call(doc.type,null,doc,true));
  $("#goto-client-view").click(async function(){
    if(facture.client)
      app.goto(getLink("views/dash-client.html"),await app.dbComptabiliteGet(facture.client));
  });
  $("#nouv-client").click(async function(){
    let doc = await app.loadModal("clients:views/c-client.html");
    editable('enable');
    console.log("add",doc)
    if(doc==null) return;
    let select2 = $('#mySelect2').select2();
    // create the option and append to Select2
    var option = new Option(doc.raison, doc._id, false, false);
    select2.append(option);
    select2.val(doc._id);
    select2.trigger('change');
    // manually trigger the `select2:select` event
    select2.trigger({
        type: 'select2:select',
        params: {
            data: {
              id : doc.id,
              text : doc.raison
            }
        }
    });
  })
  // action on svg menu
  $("svg-menu").on("action::update-taxe",async function(){
    showError('Enregistrement de la facture...','loading',false);
    setFactureData();
    facture.taxe1 = TAXE1;
    facture.taxe2 = TAXE2;
    facture.taxeNom1 = app.store.get("TAXE1_NOM");
    facture.taxeNom2 = app.store.get("TAXE2_NOM");
    let doc = await app.dbComptabilitePut(facture);
    facture._rev = doc.rev;
    showError('Facture Mise a jour','success',true);
    updateBtn();
  }).on("action::print-bon",async function(){
    showError('Enregistrement de la facture...','loading',false);
    setFactureData()
    let doc = await app.dbComptabilitePut(facture);
    facture._rev = doc.rev;
    showError('Facture enregistree','success',true);
    app.goto(getLink("views/bon-facture.html"),facture)
  }).on("action::print",function(){
    editable('disable');
    $("body").addClass("print-page");
    showError('Impression du document ...','loading',false);
    setTimeout(()=>{
      ipc.send('print-to-page',{printBackground : true,marginsType:1,pageSize:"A4",landscape: false});
      ipc.once('print-to-page-done', (evt,success)=>{
        editable('enable');
        if(!success)
          showError("Error lors de la tentative d'impression","error", true);
        else
          showError("Impression envoyee","success", true);
        // hideError();
        $("body").removeClass("print-page");
        updateBtn();
      })
    },300)
  }).on("action::print-pdf",function(){
    editable('disable');
    showError('Generation du PDF ...','loading',false);
    setTimeout(()=>{
      ipc.send('print-to-pdf',{printBackground : true,marginsType:1,pageSize:"A4",landscape: false});
      ipc.once('print-to-pdf-done', (evt,error)=>{
        editable('enable');
        updateBtn();
        if(error)
          showError("PDF non genere","error", true)
        else
          showError("PDF genere","success", true);
      })
    },300)
  }).on("action::save-facture",async function(){
    console.log(facture);
    showError('Enregistrement de la facture...','loading',false);
    setFactureData();
    let doc = await app.dbComptabilitePut(facture);
    facture._rev = doc.rev;
    showError('Facture enregistree','success',true);
    updateBtn();
  }).on("action::set-payer", async function(){
    console.log(facture);
    showError('Changement d\'etat de la facture...','loading',false);
    setFactureData();
    facture.type = "paye";
    let doc = await app.dbComptabilitePut(facture);
    facture._rev = doc.rev;
    updateBtn();
    showError('Facture enregistree','success',true);
  }).on("action::set-facture",async function(){
    console.log(facture);
    showError('Changement d\'etat de la facture...','loading',false);
    setFactureData();
    facture.type = "paye";
    let doc = await app.dbComptabilitePut(facture);
    facture._rev = doc.rev;
    showError('Facture enregistree','success',true);
    app.goto(getLink('views/c-facture.html'),{_id:facture._id})
  });

  table.on('click','td button[link-action]', function(e){
    if(index > 10) return showError("Nombre maximale de ligne atteinte!","error", true);
      console.log("Add link action 4")
      e.preventDefault();
      e.stopPropagation();
      let action = $(this).attr('link-action');
      console.log("trigger",'click::'+action)
      table.trigger('click::'+action,[null,addNewLine.bind(action,null)]) // trigger new document
      // table.trigger('click::'+action, doc) // trigger edit document
  }).on('click','td button[item-action]', function(e){
    if(index > 10) return showError("Nombre maximale de ligne atteinte!","error", true);
      console.log("Add link action 4")
      e.preventDefault();
      e.stopPropagation();
      let action = $(this).attr('item-action');
      console.log("trigger",'click::item::'+action,SPAN = this)
      table.trigger('click::item::'+action,[$(SPAN).closest('tr').data(),$(SPAN).closest('tr')]);
  }).on("click::item::edit", function(env,doc,row){
    let action = row.attr("rel-action");
    table.trigger('click::'+action,[doc,addNewLine.bind(action,row)]) // trigger new document
  }).on("click::item::remove", function(env,doc,row){
    let action = row.attr("index");
    row.remove();
    facture.items.splice(action,1);
    $(".invoice-table table tbody .item-line").each((i,el)=>{
      el.setAttribute("index",i);
      el.querySelector(".index-line").innerText = i +1;
      index = i;
    });
    updateBtn(doc);
    //table.trigger('click::'+action,[doc,addNewLine.bind(action,row)]) // trigger new document
  }).on("click::new-line",async function(evt,doc,done){
    console.log(arguments,getLink("views/c-item.html"));
    if(doc){
      done(await app.loadModal(getLink("views/c-item.html"),doc));
    }else
      done(await app.loadModal(getLink("views/c-item.html")));
  });


console.log("Facture", facture)