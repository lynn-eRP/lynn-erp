function editable(i){
 let readOnly = facture.type == 'paye' || facture.type == 'expire';
 if(readOnly)
    i = 'disable';
 $('.editable').editable(i)
}
$("svg-menu").on("action::facture",async function(){
  app.goto(getLink("views/c-facture.html"),{_id : '{{_id}}'})
}).on("action::print-pdf",function(){
  editable('disable');
  showError('Generation du PDF ...','loading',false);
  setTimeout(()=>{
    ipc.send('print-to-pdf',{printBackground : true,marginsType:1,pageSize:"A4",landscape: false});
    ipc.once('print-to-pdf-done', (evt,error)=>{
      updateBtn();
      if(error)
        showError("PDF non genere","error", true)
      else
        showError("PDF genere","success", true);
      editable('enable');
    })
  },300)
});
$('#fait-le').editable({
  type: 'date',
  clear : false,
  title : "Selectionez la date",
  format: 'yyyy-mm-dd',    
  viewformat: 'dd/mm/yyyy',    
  datepicker: {
    weekStart: 1
  }
}).editable('setValue',moment({{startAt}}).toDate());