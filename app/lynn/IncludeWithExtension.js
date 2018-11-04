const path = require('path'),
      url = require('url'),
      RELATIVE_PATH_REGEXP = /^\.{1,2}\//;
function generateUUID() { // Public Domain/MIT
    var d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
        d += performance.now(); //use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
module.exports = (nunjucks,convertToDOMContent)=> function IncludeWithExtension(nunjucksEnv, tagName = 'includeWith') {
    this.tags = [tagName || 'remote'];
    this._nunjucksEnv = nunjucksEnv;
    this._cwd = null;

    this.parse = function(parser, nodes, lexer) {
      var tagName = this.tags[0];
      var tag = parser.peekToken();
      var args = new nodes.NodeList(tag.lineno, tag.colno);
      if (!parser.skipSymbol(tagName)) {
        parser.fail('parseInclude: expected ' + tagName);
      }
      args.addChild(parser.parseExpression());

      if (parser.skipSymbol('with')) {
        args.addChild(parser.parseExpression());
      }else{
        args.addChild(new nodes.Literal(tag.lineno,tag.colno, false));
      }
      if(parser.skipSymbol('ignore')){
        if (parser.skipSymbol('missing')) {
          args.addChild(new nodes.Literal(tag.lineno,tag.colno, 'missing'));
        }else{
          if (parser.skipSymbol('empty')) {
            args.addChild(new nodes.Literal(tag.lineno,tag.colno, 'empty'));
          }else{
            args.addChild(new nodes.Literal(tag.lineno,tag.colno, 'missing'));
          }
        }
      }else{
        args.addChild(new nodes.Literal(tag.lineno,tag.colno, false));
      }

      parser.advanceAfterBlockEnd(tag.value);

      return new nodes.CallExtension(this, 'run',args);
    };
    let run = async (uuid,context,templatePath,ignoreMissing,withValue,useContext)=>{
      let rel = window.documentRel;
      let render = ((fn,src, ctx)=> new Promise((okFn,errFn)=>{
        fn(src, ctx,(err,data)=>{err ? errFn(err) : okFn(data)})
      })).bind(context.env,context.env.render.bind(context.env));
      let renderResult = "", code="";
      for(let partialPath of templatePath)
          try{
            let fullPartialPath = RELATIVE_PATH_REGEXP.test(partialPath) ?
              path.resolve(this._cwd, partialPath) :
              partialPath;

            // console.log("load start",fullPartialPath,withValue, ignoreMissing);
            if(true && convertToDOMContent){
              let moduleId = url.parse(fullPartialPath);
              moduleId = moduleId.protocol || 'master';
              [renderResult,code] = await convertToDOMContent(fullPartialPath,moduleId,useContext ?  context.ctx : withValue);
              if(renderResult instanceof HTMLCollection && renderResult.length == 0)
                renderResult = "";
              // console.log("renderResult" ,fullPartialPath, renderResult);
            }else{
              renderResult = await render(fullPartialPath, useContext ?  context.ctx : withValue);
            }
            if((renderResult === "" || renderResult === null) && ignoreMissing === "empty"){
              // console.log("load Fail [empty]",renderResult)
              continue;
            }
            // console.log("load Done",fullPartialPath,JSON.stringify(renderResult));
            break;
          }catch(e){
            // console.log("load Fail",partialPath, "ignore missing ?",ignoreMissing === "missing",e)
            if(ignoreMissing === "missing") continue;
            throw e;
          }
        if(renderResult){

          setTimeout(function(){
            arguments.callee.call = arguments.callee.call || 0;
            arguments.callee.call++;
            if(arguments.callee.call > 99) return; // try 100 times 
            if($("#"+uuid).length)
              $("#"+uuid).replaceWith(renderResult);
            else
              setTimeout(arguments.callee,100)
          },50);
        }else
          document.getElementById(uuid).remove();
        if(code)
          code.forEach(code=>{
            try{
              code(app, (selector,context)=>$(selector, context||rel));
            }catch(e){
              console.error(e);
            }
          });
    }
    this.run = function(context, templatePath, withValue, ignoreMissing) {
        var useContext = false;
        var uuid = generateUUID();
        // console.log("load start",withValue);
        if(typeof withValue === 'object' && Array.isArray(withValue))
          withValue = false;
        if(typeof withValue !== 'object')
          useContext = true;

        templatePath = Array.isArray(templatePath) ? templatePath : [templatePath];
        let renderResult = `<center id='${uuid}' ><div class="lds-ripple"><div></div><div></div></div></center>`;
        setTimeout(()=>run(uuid,context,templatePath,ignoreMissing,withValue,useContext),50);
        return new nunjucks.runtime.SafeString(renderResult);
    };
};