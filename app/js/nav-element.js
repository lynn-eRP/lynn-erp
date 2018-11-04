class HTMLNavItemElement extends HTMLElement {
    constructor() {
        // Always call super first in constructor
        super();
        var shadow = this.attachShadow({mode: 'closed'});
        var icon = this.getAttribute("icon") || "cog";
        var title = this.getAttribute("label") || "";
        var action = this.getAttribute("action") || false;
        var disabled = this.hasAttribute('disabled') ? "disabled" : "";
        let isVertical = this.hasAttribute('is-vertical');
        shadow.innerHTML = `
            <style type="text/css">
                @import url("icon_fonts_assets/font-awesome/css/font-awesome.min.css");
                :root{
                  --intern-size : 80px;
                  --intern-btn-color : #ffc107 ;
                  --intern-icon-color : #ffffff;
                }
                button{
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    margin: 0;
                    padding: 0;
                    border: navajowhite;
                    position: relative;
                    top: -3px;
                    background: var(--menu-btn-color, --intern-btn-color);
                    color: var(--menu-icon-color, --intern-icon-color );
                    pointer-events: auto;
                    outline : 0 !important;
                    -webkit-tap-highlight-color: transparent !important;

                }
                button:hover{
                    color: var(--menu-btn-color, --intern-btn-color);
                    background: var(--menu-icon-color, --intern-icon-color );
                }
                button[disabled]{
                    opacity : 0.5;
                    pointer-events: unset;
                }
                button[disabled]:hover{
                    background: var(--menu-btn-color, --inte=rn-btn-color);
                    color: var(--menu-icon-color, --intern-icon-color );
                }
                button + span, button[disabled] + span, button[disabled]:hover + span{
                  display : none;
                }
                button:hover + span{
                  display : block;
                  color: var(--menu-icon-color, --intern-icon-color );
                  background-color: var(--menu-btn-color, --intern-btn-color);
                  white-space: nowrap;
                  position: absolute;
                  font-size: 11px;
                  line-height: 23px;
                  padding: 0 9px;
                  border-radius: 10px;
                  
                }
            </style>
            <button id="${action}" ${disabled} ><i class="fa fa-${icon}"></i></button>
            <span>${title}</span>
        `;
        console.log("shadow.querySelector",shadow.dispatchEvent);
        let doc = shadow.querySelector("button");
        let span = shadow.querySelector("span");
        doc.addEventListener("mouseenter", x=>{
          console.log("span hover",span,span.offsetWidth, Math.floor(span.offsetWidth / -4)+"px");
          if(!isVertical){
            span.style.left = Math.floor(span.offsetWidth / -4)+"px";
            span.style.top = "61px";
          }else{
            span.style.left = "51px";
            span.style.top = "10px";
          }
        },false)
        doc.addEventListener("click", function dispatchCustomEvent(evt) {
            evt.preventDefault();
            evt = new Event("click", {
                bubbles:true, 
                cancelable:true,
                composed : true
            });
            // evt.target = this;
            evt.action = action;
            shadow.dispatchEvent(evt);
        }, false);
        Object.defineProperty(this,'isVertical',{
          set (v){
            console.log("isVertical", action, isVertical, !!v);
            isVertical = !!v;
          },
          get(){
            return isVertical
          }
        });
        this.vertical = (vertical=true)=>{
          this.isVertical = !!vertical;
        }
        this.disable = (disabled=true)=>{
            if(doc.hasAttribute('disabled') && !disabled)
              doc.removeAttribute('disabled');
            else if(!doc.hasAttribute('disabled') && disabled)
              doc.setAttribute('disabled',"");
            
        }

    }
}
// Create a class for the element
class HTMLNavElement extends HTMLElement {
  constructor() {
    // Always call super first in constructor
    super();
     var orientation = this.getAttribute("orientation") || "horizontal";
     orientation = ["vertical", "horizontal",'h','v'].indexOf(orientation) == -1 ? 'h' : orientation;
     var isVertical = /^v/.test(orientation);
     var wrapper = document.createElement('nav');
     wrapper.classList.add("menu");
     wrapper.innerHTML = `
        <input type="checkbox" href="#" checked class="menu-open" name="menu-open" id="menu-open"/>
        <label class="menu-open-button" for="menu-open">
            <span class="hamburger hamburger-1"></span>
            <span class="hamburger hamburger-2"></span>
            <span class="hamburger hamburger-3"></span>
        </label>`;
    // Create a shadow root
    var shadow = this.attachShadow({mode: 'closed'});
    shadow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1">
        <defs>
          <filter id="shadowed-goo">
              <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
              <feGaussianBlur in="goo" stdDeviation="3" result="shadow" />
              <feColorMatrix in="shadow" mode="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 -0.2" result="shadow" />
              <feOffset in="shadow" dx="1" dy="1" result="shadow" />
              <feComposite in2="shadow" in="goo" result="goo" />
              <feComposite in2="goo" in="SourceGraphic" result="mix" />
          </filter>
          <filter id="goo">
              <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
              <feComposite in2="goo" in="SourceGraphic" result="mix" />
          </filter>
        </defs>
    </svg>`;
    // Create get childs
    let childCount = 0;
    this.childNodes.forEach(node=> {
        let name = node.nodeName.toLowerCase();
        if(name=="menu-item"){
            childCount++;
            if(!node.classList.contains("menu-item"))
              node.classList.add("menu-item");
            if(isVertical)
              node.setAttribute("is-vertical","");
            node.addEventListener("click",function(evt){
                evt.preventDefault();
                // let action = evt.action;
                if(evt.action){
                  let evt2 = new Event("click", {
                      bubbles:true, 
                      cancelable:true,
                      composed : true
                  });
                  evt2.action = evt.action;
                  console.log("dispatch", "action::"+evt.action)
                  evt = new Event("action::"+evt.action, {
                      bubbles:true, 
                      cancelable:true,
                      composed : true
                  });
                  shadow.dispatchEvent(evt);
                  shadow.dispatchEvent(evt2);
                }
            }, false);
            // console.log(name,node.vertical,node.disable)
            // node.vertical(isVertical);
            wrapper.appendChild(node);
        }else{
            // console.log("not menu-item",name,node.vertical)
          // node.remove();
        }
    });
    // Create some CSS to apply to the shadow dom
    var style = document.createElement('style');

    style.textContent = `
        /* icon class */ 
        @import url("icon_fonts_assets/font-awesome/css/font-awesome.min.css");
        /* MENU SVG */
        :root{
          --intern-size : 80px;
          --intern-btn-color : #ffc107 ;
          --intern-icon-color : #ffffff;
        };
        .menu {
          -webkit-filter: url("#shadowed-goo");
                  filter: url("#shadowed-goo");
        }
        .menu {
          position: absolute;
          top: 0;
          left: 0;
          margin-left: calc( -1 * var(--menu-size, --intern-size) );
          padding-top: calc( var(--menu-size, --intern-size) * 0.25 );
          padding-left: calc( var(--menu-size, --intern-size) );
          ${ !isVertical ? "width" : "height"}: calc( var(--menu-size, --intern-size) * ${childCount+2}.125 );
          ${  isVertical ? "width" : "height"}: calc( var(--menu-size, --intern-size) * 1.875 );
          box-sizing: border-box;
          font-size: calc( var(--menu-size, --intern-size) * 0.25 );
          text-align: left;
          pointer-events: none;
          -webkit-filter: url("#shadowed-goo");
                  filter: url("#shadowed-goo");
        }
        menu-item {
            display: inline-block;
        }
        menu-item, .menu-open-button {
          background: var( --menu-btn-color, --intern-btn-color );
          border-radius: 100%;
          border: none;
          width: calc( var(--menu-size, --intern-size) );
          height: calc( var(--menu-size, --intern-size) );
          margin-left: calc( -1 * var(--menu-size, --intern-size) * 0.5 );
          position: absolute;
          top: calc( var(--menu-size, --intern-size) * 0.25 );
          color: var( --menu-icon-color, --intern-icon-color  );
          text-align: center;
          line-height: calc( var(--menu-size, --intern-size) );
          -webkit-transform: translate3d(0, 0, 0);
                  transform: translate3d(0, 0, 0);
          transition: -webkit-transform ease-out 200ms;
          transition: transform ease-out 200ms;
          transition: transform ease-out 200ms, -webkit-transform ease-out 200ms;
          pointer-events: auto;
        }

        .menu-open {
          display: none;
        }

        .hamburger {
          width: calc( var(--menu-size, --intern-size) * 0.3125 );
          height: calc( var(--menu-size, --intern-size) * 0.0375 );
          background: var( --menu-icon-color, --intern-icon-color  );
          display: block;
          position: absolute;
          top: 50%;
          left: 50%;
          margin-left: calc( -1 * var(--menu-size, --intern-size) * 0.15625 );
          margin-top: calc( -1 * var(--menu-size, --intern-size) * 0.01875 );
          transition: -webkit-transform 200ms;
          transition: transform 200ms;
          transition: transform 200ms, -webkit-transform 200ms;
        }

        .hamburger-1 {
          -webkit-transform: translate3d(0, calc( -1 * var(--menu-size, --intern-size) * 0.1 ), 0);
                  transform: translate3d(0, calc( -1 * var(--menu-size, --intern-size) * 0.1 ), 0);
        }
        .hamburger-2 {
          -webkit-transform: translate3d(0, 0, 0);
                  transform: translate3d(0, 0, 0);
        }
        .hamburger-3 {
          -webkit-transform: translate3d(0, calc( var(--menu-size, --intern-size) * 0.1 ), 0);
                  transform: translate3d(0, calc( var(--menu-size, --intern-size) * 0.1 ), 0);
        }
        .menu-open:checked + .menu-open-button .hamburger-1 {
          -webkit-transform: translate3d(0, 0, 0) rotate(45deg);
                  transform: translate3d(0, 0, 0) rotate(45deg);
        }
        .menu-open:checked + .menu-open-button .hamburger-2 {
          -webkit-transform: translate3d(0, 0, 0) scale(0.1, 1);
                  transform: translate3d(0, 0, 0) scale(0.1, 1);
        }
        .menu-open:checked + .menu-open-button .hamburger-3 {
          -webkit-transform: translate3d(0, 0, 0) rotate(-45deg);
                  transform: translate3d(0, 0, 0) rotate(-45deg);
        }

        menu-item:hover {
          background: var( --menu-icon-color, --intern-icon-color  );
          color: var( --menu-btn-color, --intern-btn-color );
        }
        menu-item[disabled] i {
          opacity: 0.5;
        }
        menu-item[disabled]:hover {
          background: var( --menu-btn-color, --intern-btn-color );
          color: var( --menu-icon-color, --intern-icon-color  );
        }
        ${(()=>{
            let ret = "";
            for (var i = childCount-1; i >= 0; i--) {
                console.log("menu-item",childCount,i,ret);
                ret += '\n        menu-item:nth-child('+(3+i)+'),';
            };
            console.log("menu-item",childCount,ret);
            return ret;
        })()}
        .menu-item-just-for-last-class:empty {
          transition-duration: 180ms;
        }
        .menu-open-button {
          z-index: 2;
          transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transition-duration: 400ms;
          -webkit-transform: scale(1.1, 1.1) translate3d(0, 0, 0);
                  transform: scale(1.1, 1.1) translate3d(0, 0, 0);
          cursor: pointer;
        }
        .menu-open-button:hover {
          -webkit-transform: scale(1.2, 1.2) translate3d(0, 0, 0);
                  transform: scale(1.2, 1.2) translate3d(0, 0, 0);
        }
        .menu-open:checked + .menu-open-button {
          transition-timing-function: linear;
          transition-duration: 200ms;
          -webkit-transform: scale(0.8, 0.8) translate3d(0, 0, 0);
                  transform: scale(0.8, 0.8) translate3d(0, 0, 0);
        }
        .menu-open:checked ~ menu-item {
          transition-timing-function: cubic-bezier(0.165, 0.84, 0.44, 1);
          font-size: calc( var(--menu-size, --intern-size) * 0.5 )
        }
        ${(()=>{
            let ret = "";
            for (var i = childCount-1; i >= 0; i--) {
                console.log("menu-item",childCount,i,ret);
                if(isVertical)
                  ret += `
        .menu-open:checked ~ menu-item:nth-child(${3+i}) {
          transition-duration: 410ms;
          -webkit-transform: translate3d(0, calc(var(--menu-size, --intern-size) * ${1+i} ), 0);
                  transform: translate3d(0, calc(var(--menu-size, --intern-size) * ${1+i} ), 0);
        }`;
                else
                  ret += `
        .menu-open:checked ~ menu-item:nth-child(${3+i}) {
          transition-duration: 410ms;
          -webkit-transform: translate3d(calc( var(--menu-size, --intern-size) * ${1+i} ), 0, 0);
                  transform: translate3d(calc( var(--menu-size, --intern-size) * ${1+i} ), 0, 0);
        }`;
            };
            console.log("menu-item",childCount,ret);
            return ret;
        })()}


        @media print{
          .menu{
            display :  none;
          }
        }
        `;

    // attach the created elements to the shadow dom

    shadow.appendChild(style);
    shadow.appendChild(wrapper);
    // wrapper.appendChild(info);
    this.style.pointerEvents = "none";
    this.querySelector = shadow.querySelector.bind(shadow)
    this.querySelectorAll = shadow.querySelectorAll.bind(shadow);
    this.disable = (action,disabled)=>{
        let doc = this.querySelector(`[action="${action}"]`)
        if(doc) doc.disable(disabled);
    }
  }
}

// Define the new element
customElements.define('menu-item', HTMLNavItemElement);
customElements.define('svg-menu', HTMLNavElement);