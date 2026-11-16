var rt=globalThis,ot=rt.ShadowRoot&&(rt.ShadyCSS===void 0||rt.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,xi=Symbol(),Ei=new WeakMap,at=class{constructor(e,t,n){if(this._$cssResult$=!0,n!==xi)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(ot&&e===void 0){let n=t!==void 0&&t.length===1;n&&(e=Ei.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),n&&Ei.set(t,e))}return e}toString(){return this.cssText}},Ni=r=>new at(typeof r=="string"?r:r+"",void 0,xi);var Pi=(r,e)=>{if(ot)r.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let t of e){let n=document.createElement("style"),i=rt.litNonce;i!==void 0&&n.setAttribute("nonce",i),n.textContent=t.cssText,r.appendChild(n)}},En=ot?r=>r:r=>r instanceof CSSStyleSheet?(e=>{let t="";for(let n of e.cssRules)t+=n.cssText;return Ni(t)})(r):r;var{is:qs,defineProperty:Vs,getOwnPropertyDescriptor:Fs,getOwnPropertyNames:Us,getOwnPropertySymbols:zs,getPrototypeOf:Hs}=Object,lt=globalThis,wi=lt.trustedTypes,Gs=wi?wi.emptyScript:"",Ks=lt.reactiveElementPolyfillSupport,Ie=(r,e)=>r,xn={toAttribute(r,e){switch(e){case Boolean:r=r?Gs:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,e){let t=r;switch(e){case Boolean:t=r!==null;break;case Number:t=r===null?null:Number(r);break;case Object:case Array:try{t=JSON.parse(r)}catch{t=null}}return t}},Ti=(r,e)=>!qs(r,e),Ci={attribute:!0,type:String,converter:xn,reflect:!1,useDefault:!1,hasChanged:Ti};Symbol.metadata??=Symbol("metadata"),lt.litPropertyMetadata??=new WeakMap;var ie=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=Ci){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let n=Symbol(),i=this.getPropertyDescriptor(e,n,t);i!==void 0&&Vs(this.prototype,e,i)}}static getPropertyDescriptor(e,t,n){let{get:i,set:s}=Fs(this.prototype,e)??{get(){return this[t]},set(a){this[t]=a}};return{get:i,set(a){let o=i?.call(this);s?.call(this,a),this.requestUpdate(e,o,n)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Ci}static _$Ei(){if(this.hasOwnProperty(Ie("elementProperties")))return;let e=Hs(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(Ie("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Ie("properties"))){let t=this.properties,n=[...Us(t),...zs(t)];for(let i of n)this.createProperty(i,t[i])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[n,i]of t)this.elementProperties.set(n,i)}this._$Eh=new Map;for(let[t,n]of this.elementProperties){let i=this._$Eu(t,n);i!==void 0&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let n=new Set(e.flat(1/0).reverse());for(let i of n)t.unshift(En(i))}else e!==void 0&&t.push(En(e));return t}static _$Eu(e,t){let n=t.attribute;return n===!1?void 0:typeof n=="string"?n:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let n of t.keys())this.hasOwnProperty(n)&&(e.set(n,this[n]),delete this[n]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Pi(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,n){this._$AK(e,n)}_$ET(e,t){let n=this.constructor.elementProperties.get(e),i=this.constructor._$Eu(e,n);if(i!==void 0&&n.reflect===!0){let s=(n.converter?.toAttribute!==void 0?n.converter:xn).toAttribute(t,n.type);this._$Em=e,s==null?this.removeAttribute(i):this.setAttribute(i,s),this._$Em=null}}_$AK(e,t){let n=this.constructor,i=n._$Eh.get(e);if(i!==void 0&&this._$Em!==i){let s=n.getPropertyOptions(i),a=typeof s.converter=="function"?{fromAttribute:s.converter}:s.converter?.fromAttribute!==void 0?s.converter:xn;this._$Em=i;let o=a.fromAttribute(t,s.type);this[i]=o??this._$Ej?.get(i)??o,this._$Em=null}}requestUpdate(e,t,n,i=!1,s){if(e!==void 0){let a=this.constructor;if(i===!1&&(s=this[e]),n??=a.getPropertyOptions(e),!((n.hasChanged??Ti)(s,t)||n.useDefault&&n.reflect&&s===this._$Ej?.get(e)&&!this.hasAttribute(a._$Eu(e,n))))return;this.C(e,t,n)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:n,reflect:i,wrapped:s},a){n&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,a??t??this[e]),s!==!0||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||n||(t=void 0),this._$AL.set(e,t)),i===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[i,s]of this._$Ep)this[i]=s;this._$Ep=void 0}let n=this.constructor.elementProperties;if(n.size>0)for(let[i,s]of n){let{wrapped:a}=s,o=this[i];a!==!0||this._$AL.has(i)||o===void 0||this.C(i,void 0,s,o)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(n=>n.hostUpdate?.()),this.update(t)):this._$EM()}catch(n){throw e=!1,this._$EM(),n}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};ie.elementStyles=[],ie.shadowRootOptions={mode:"open"},ie[Ie("elementProperties")]=new Map,ie[Ie("finalized")]=new Map,Ks?.({ReactiveElement:ie}),(lt.reactiveElementVersions??=[]).push("2.1.2");var An=globalThis,Mi=r=>r,ct=An.trustedTypes,Ai=ct?ct.createPolicy("lit-html",{createHTML:r=>r}):void 0,Di="$lit$",ae=`lit$${Math.random().toFixed(9).slice(2)}$`,Oi="?"+ae,Ws=`<${Oi}>`,be=document,De=()=>be.createComment(""),Oe=r=>r===null||typeof r!="object"&&typeof r!="function",Bn=Array.isArray,js=r=>Bn(r)||typeof r?.[Symbol.iterator]=="function",Nn=`[ 	
\f\r]`,Le=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Bi=/-->/g,Ri=/>/g,he=RegExp(`>|${Nn}(?:([^\\s"'>=/]+)(${Nn}*=${Nn}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),_i=/'/g,Ii=/"/g,qi=/^(?:script|style|textarea|title)$/i,Rn=r=>(e,...t)=>({_$litType$:r,strings:e,values:t}),u=Rn(1),Fe=Rn(2),Oa=Rn(3),fe=Symbol.for("lit-noChange"),x=Symbol.for("lit-nothing"),Li=new WeakMap,me=be.createTreeWalker(be,129);function Vi(r,e){if(!Bn(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return Ai!==void 0?Ai.createHTML(e):e}var Zs=(r,e)=>{let t=r.length-1,n=[],i,s=e===2?"<svg>":e===3?"<math>":"",a=Le;for(let o=0;o<t;o++){let l=r[o],c,d,p=-1,h=0;for(;h<l.length&&(a.lastIndex=h,d=a.exec(l),d!==null);)h=a.lastIndex,a===Le?d[1]==="!--"?a=Bi:d[1]!==void 0?a=Ri:d[2]!==void 0?(qi.test(d[2])&&(i=RegExp("</"+d[2],"g")),a=he):d[3]!==void 0&&(a=he):a===he?d[0]===">"?(a=i??Le,p=-1):d[1]===void 0?p=-2:(p=a.lastIndex-d[2].length,c=d[1],a=d[3]===void 0?he:d[3]==='"'?Ii:_i):a===Ii||a===_i?a=he:a===Bi||a===Ri?a=Le:(a=he,i=void 0);let m=a===he&&r[o+1].startsWith("/>")?" ":"";s+=a===Le?l+Ws:p>=0?(n.push(c),l.slice(0,p)+Di+l.slice(p)+ae+m):l+ae+(p===-2?o:m)}return[Vi(r,s+(r[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),n]},qe=class r{constructor({strings:e,_$litType$:t},n){let i;this.parts=[];let s=0,a=0,o=e.length-1,l=this.parts,[c,d]=Zs(e,t);if(this.el=r.createElement(c,n),me.currentNode=this.el.content,t===2||t===3){let p=this.el.content.firstChild;p.replaceWith(...p.childNodes)}for(;(i=me.nextNode())!==null&&l.length<o;){if(i.nodeType===1){if(i.hasAttributes())for(let p of i.getAttributeNames())if(p.endsWith(Di)){let h=d[a++],m=i.getAttribute(p).split(ae),y=/([.?@])?(.*)/.exec(h);l.push({type:1,index:s,name:y[2],strings:m,ctor:y[1]==="."?wn:y[1]==="?"?Cn:y[1]==="@"?Tn:xe}),i.removeAttribute(p)}else p.startsWith(ae)&&(l.push({type:6,index:s}),i.removeAttribute(p));if(qi.test(i.tagName)){let p=i.textContent.split(ae),h=p.length-1;if(h>0){i.textContent=ct?ct.emptyScript:"";for(let m=0;m<h;m++)i.append(p[m],De()),me.nextNode(),l.push({type:2,index:++s});i.append(p[h],De())}}}else if(i.nodeType===8)if(i.data===Oi)l.push({type:2,index:s});else{let p=-1;for(;(p=i.data.indexOf(ae,p+1))!==-1;)l.push({type:7,index:s}),p+=ae.length-1}s++}}static createElement(e,t){let n=be.createElement("template");return n.innerHTML=e,n}};function Ee(r,e,t=r,n){if(e===fe)return e;let i=n!==void 0?t._$Co?.[n]:t._$Cl,s=Oe(e)?void 0:e._$litDirective$;return i?.constructor!==s&&(i?._$AO?.(!1),s===void 0?i=void 0:(i=new s(r),i._$AT(r,t,n)),n!==void 0?(t._$Co??=[])[n]=i:t._$Cl=i),i!==void 0&&(e=Ee(r,i._$AS(r,e.values),i,n)),e}var Pn=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:n}=this._$AD,i=(e?.creationScope??be).importNode(t,!0);me.currentNode=i;let s=me.nextNode(),a=0,o=0,l=n[0];for(;l!==void 0;){if(a===l.index){let c;l.type===2?c=new Ve(s,s.nextSibling,this,e):l.type===1?c=new l.ctor(s,l.name,l.strings,this,e):l.type===6&&(c=new Mn(s,this,e)),this._$AV.push(c),l=n[++o]}a!==l?.index&&(s=me.nextNode(),a++)}return me.currentNode=be,i}p(e){let t=0;for(let n of this._$AV)n!==void 0&&(n.strings!==void 0?(n._$AI(e,n,t),t+=n.strings.length-2):n._$AI(e[t])),t++}},Ve=class r{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,n,i){this.type=2,this._$AH=x,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=n,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=Ee(this,e,t),Oe(e)?e===x||e==null||e===""?(this._$AH!==x&&this._$AR(),this._$AH=x):e!==this._$AH&&e!==fe&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):js(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==x&&Oe(this._$AH)?this._$AA.nextSibling.data=e:this.T(be.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:n}=e,i=typeof n=="number"?this._$AC(e):(n.el===void 0&&(n.el=qe.createElement(Vi(n.h,n.h[0]),this.options)),n);if(this._$AH?._$AD===i)this._$AH.p(t);else{let s=new Pn(i,this),a=s.u(this.options);s.p(t),this.T(a),this._$AH=s}}_$AC(e){let t=Li.get(e.strings);return t===void 0&&Li.set(e.strings,t=new qe(e)),t}k(e){Bn(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,n,i=0;for(let s of e)i===t.length?t.push(n=new r(this.O(De()),this.O(De()),this,this.options)):n=t[i],n._$AI(s),i++;i<t.length&&(this._$AR(n&&n._$AB.nextSibling,i),t.length=i)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let n=Mi(e).nextSibling;Mi(e).remove(),e=n}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},xe=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,n,i,s){this.type=1,this._$AH=x,this._$AN=void 0,this.element=e,this.name=t,this._$AM=i,this.options=s,n.length>2||n[0]!==""||n[1]!==""?(this._$AH=Array(n.length-1).fill(new String),this.strings=n):this._$AH=x}_$AI(e,t=this,n,i){let s=this.strings,a=!1;if(s===void 0)e=Ee(this,e,t,0),a=!Oe(e)||e!==this._$AH&&e!==fe,a&&(this._$AH=e);else{let o=e,l,c;for(e=s[0],l=0;l<s.length-1;l++)c=Ee(this,o[n+l],t,l),c===fe&&(c=this._$AH[l]),a||=!Oe(c)||c!==this._$AH[l],c===x?e=x:e!==x&&(e+=(c??"")+s[l+1]),this._$AH[l]=c}a&&!i&&this.j(e)}j(e){e===x?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},wn=class extends xe{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===x?void 0:e}},Cn=class extends xe{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==x)}},Tn=class extends xe{constructor(e,t,n,i,s){super(e,t,n,i,s),this.type=5}_$AI(e,t=this){if((e=Ee(this,e,t,0)??x)===fe)return;let n=this._$AH,i=e===x&&n!==x||e.capture!==n.capture||e.once!==n.once||e.passive!==n.passive,s=e!==x&&(n===x||i);i&&this.element.removeEventListener(this.name,this,n),s&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},Mn=class{constructor(e,t,n){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=n}get _$AU(){return this._$AM._$AU}_$AI(e){Ee(this,e)}};var Ys=An.litHtmlPolyfillSupport;Ys?.(qe,Ve),(An.litHtmlVersions??=[]).push("3.3.3");var Fi=(r,e,t)=>{let n=t?.renderBefore??e,i=n._$litPart$;if(i===void 0){let s=t?.renderBefore??null;n._$litPart$=i=new Ve(e.insertBefore(De(),s),s,void 0,t??{})}return i._$AI(r),i};var _n=globalThis,oe=class extends ie{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Fi(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return fe}};oe._$litElement$=!0,oe.finalized=!0,_n.litElementHydrateSupport?.({LitElement:oe});var Qs=_n.litElementPolyfillSupport;Qs?.({LitElement:oe});(_n.litElementVersions??=[]).push("4.2.2");var g=class extends oe{constructor(){super(),this.theme=""}createRenderRoot(){return this}emit(e,t){this.emitDetail(e,{value:t})}emitDetail(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}};g.createProperty("theme",{type:String,attribute:"data-nbplay-theme",reflect:!0,converter:{fromAttribute:r=>r??"",toAttribute:r=>r||null}});function k(r,e){customElements.get(r)||customElements.define(r,e)}function N(r,e,t){return Math.min(t,Math.max(e,r))}function ve(r,e){if(!(e>0))return r;let t=Math.max(0,Math.ceil(-Math.log10(e)));return Number((Math.round(r/e)*e).toFixed(t))}function V(r,e,t){return getComputedStyle(r).getPropertyValue(e).trim()||t}function z(r){let e=globalThis,t=e.AudioContext||e.webkitAudioContext;if(!t)return null;try{return new t(r)}catch{try{return new t}catch{return null}}}function le(r,e){r.tabIndex<0&&(r.tabIndex=0);function t(n){let i=n.target,s=i?.tagName;if(s==="INPUT"||s==="TEXTAREA"||s==="SELECT"||i?.isContentEditable||n.ctrlKey||n.metaKey||n.altKey)return;let a=n.key===" "?"Space":n.key.length===1?n.key.toLowerCase():n.key,o=n.shiftKey&&a.length>1?`Shift+${a}`:a,l=e[o]??(n.shiftKey?e[a]:void 0);l&&l()!==!1&&(n.preventDefault(),n.stopPropagation())}return r.addEventListener("keydown",t),()=>r.removeEventListener("keydown",t)}function W(r){if(!r||!r.byteLength)return null;if(r instanceof DataView){let e=r.byteLength/4,t=new Float32Array(e);for(let n=0;n<e;n++)t[n]=r.getFloat32(n*4,!0);return t}if(r.buffer instanceof ArrayBuffer){let e=r;return new Float32Array(e.buffer.slice(e.byteOffset,e.byteOffset+e.byteLength))}return r instanceof ArrayBuffer?new Float32Array(r):null}function Ui(r){return r<=0?-1/0:20*Math.log10(r)}function Xs(r){return Math.pow(10,r/20)}function In(r){if(r<=0)return"\u2212\u221E dB";let e=20*Math.log10(r);return e>=0?"+"+e.toFixed(1)+" dB":e.toFixed(1)+" dB"}function zi(r){return Math.abs(r)<.01?"C":r<0?"L"+Math.round(Math.abs(r)*100):"R"+Math.round(r*100)}function Hi(r){let e=r.replace(/\s*db\s*$/i,"").trim();if(e==="\u2212\u221E"||e==="-inf"||e==="-Infinity")return 0;let t=parseFloat(e);if(isNaN(t))return null;let n=Xs(t);return Math.max(0,Math.min(2,Math.round(n*1e3)/1e3))}var Js=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];function J(r,e=60){let t=Number(r);return Number.isFinite(t)?Math.max(0,Math.min(127,Math.round(t))):e}function q(r,e=100){let t=Number(r);return Number.isFinite(t)?Math.max(1,Math.min(127,Math.round(t))):e}function R(r){let e=J(r),t=Math.floor(e/12)-1;return Js[e%12]+t}function ut(r){let e=r.trim(),t=Number.parseInt(e,10);if(String(t)===e&&t>=0&&t<=127)return t;let n=e.match(/^([A-Ga-g])([#b]?)\s*(-?\d+)$/);if(!n)return null;let s={c:0,d:2,e:4,f:5,g:7,a:9,b:11}[n[1].toLowerCase()];if(s===void 0)return null;let a=s;n[2]==="#"&&(a+=1),n[2]==="b"&&(a-=1);let l=(Number.parseInt(n[3],10)+1)*12+a;return l>=0&&l<=127?l:null}function Ln(r,e,t=48){let n=Math.max(1,Math.min(128,Math.round(e||1))),i=r.slice(0,n).map(a=>J(a)),s=i.length>0?i[i.length-1]+1:t;for(;i.length<n;)i.push(J(s)),s+=1;return i}function dt(r,e,t=100){let n=Math.max(1,Math.min(128,Math.round(e||1))),i=r.slice(0,n).map(s=>q(s,t));for(;i.length<n;)i.push(q(t));return i}function er(r){return typeof r=="string"&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(r)}function tr(r,e,t){let n={type:"note",note:J(e),velocity:q(t)};if(!r||typeof r!="object")return n;let i=r,s=typeof i.label=="string"?i.label:void 0;if(i.type==="trait"&&er(i.trait)){let l=i.value;if(typeof l=="number"||typeof l=="boolean"||typeof l=="string")return{type:"trait",trait:i.trait,value:l,label:s}}if(i.type==="event")return{type:"event",label:s,value:i.value};let a={type:"note",note:J(i.note,e),velocity:q(i.velocity,t),label:s},o=Number(i.slice);return Number.isInteger(o)&&o>=0&&(a.slice=o),a}function Ne(r,e,t,n){let i=Array.isArray(r)?r:[],s=[],a=Math.max(1,Math.round(n||e.length||1));for(let o=0;o<a;o++)s.push(tr(i[o],e[o]??e[e.length-1]??60,t[o]??t[t.length-1]??100));return s}function pt(r){return r.label?r.label:r.type==="note"?R(r.note):r.type==="trait"?r.trait:"event"}function Dn(r,e,t=2,n=""){switch(e){case"int":return`${Math.round(r)}${n}`;case"db":return In(r);case"pan":return zi(r);case"hz":return r>=1e3?(r/1e3).toFixed(2)+" kHz":r.toFixed(1)+" Hz";case"bpm":return`${Math.round(r)} BPM`;case"seconds":return r<.01?(r*1e3).toFixed(1)+" ms":r<1?(r*1e3).toFixed(0)+" ms":r.toFixed(2)+" s";case"percent":return(r*100).toFixed(0)+"%";case"note":return R(r);default:return`${r.toFixed(t)}${n}`}}function On(r,e,t=2){switch(e){case"int":case"bpm":return String(Math.round(r));case"db":return In(r).replace(" dB","");case"pan":return String(Math.round(r*100)/100);case"percent":return(r*100).toFixed(0);case"note":return R(r);case"float":return r.toFixed(t);default:return String(r)}}function qn(r,e){let t=r.trim();if(!t)return null;switch(e){case"db":return Hi(t);case"note":return ut(t);case"int":case"bpm":{let n=parseInt(t,10);return Number.isNaN(n)?null:n}case"percent":{let n=parseFloat(t);return Number.isFinite(n)?n>1?n/100:n:null}case"hz":{let n=parseFloat(t);return Number.isFinite(n)?/k/i.test(t)?n*1e3:n:null}default:{let n=parseFloat(t);return Number.isFinite(n)?n:null}}}var Gi=r=>r.stopPropagation(),ht=class extends g{static properties={value:{type:Number},kind:{type:String},min:{type:Number},max:{type:Number},precision:{type:Number},unit:{type:String},editable:{type:Boolean},editing:{type:Boolean,reflect:!0}};constructor(){super(),this.value=0,this.kind="float",this.min=-1/0,this.max=1/0,this.precision=2,this.unit="",this.editable=!0,this.editing=!1}get text(){return Dn(this.value,this.kind,this.precision,this.unit)}render(){return this.editing?u`<input
        type="text"
        class="nbplay-value-input"
        .value=${On(this.value,this.kind,this.precision)}
        @keydown=${this.onKeydown}
        @blur=${this.commit}
        @input=${Gi}
        @change=${Gi}
      />`:u`<span
      class="nbplay-value-text"
      title=${this.editable?"Double-click to edit":x}
      @dblclick=${this.startEdit}
      >${this.text}</span
    >`}startEdit(){!this.editable||this.editing||(this.editing=!0,this.updateComplete.then(()=>{let e=this.querySelector("input");e?.focus(),e?.select()}))}onKeydown(e){e.key==="Enter"?(e.preventDefault(),this.commit()):e.key==="Escape"&&(this.editing=!1)}commit(){if(!this.editing)return;let e=this.querySelector("input");if(this.editing=!1,!e)return;let t=qn(e.value,this.kind);if(t===null)return;let n=N(t,this.min,this.max);n!==this.value&&(this.value=n,this.emit("change",n))}};k("nbplay-value",ht);var mt=class extends g{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},orientation:{type:String,reflect:!0},scale:{type:String},disabled:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};internal=null;constructor(){super(),this.value=0,this.min=0,this.max=1,this.step=.01,this.defaultValue=null,this.orientation="horizontal",this.scale="linear",this.disabled=!1,this.dragging=!1}willUpdate(e){e.has("value")&&this.dragging&&this.internal!==null&&this.value!==this.internal&&(this.value=this.internal)}toPos(e){if(this.scale!=="log")return e;let t=Math.log(this.min),n=Math.log(this.max);return(Math.log(Math.max(e,this.min))-t)/(n-t)}fromPos(e){if(this.scale!=="log")return e;let t=Math.log(this.min),n=Math.log(this.max);return Math.exp(t+e*(n-t))}render(){let e=this.scale==="log";return u`<input
      type="range"
      class="nbplay-slider-input"
      min=${e?0:this.min}
      max=${e?1:this.max}
      step=${e?.001:this.step}
      .value=${String(this.toPos(this.value))}
      ?disabled=${this.disabled}
      aria-valuemin=${this.min}
      aria-valuemax=${this.max}
      aria-valuenow=${this.value}
      @input=${this.onInput}
      @change=${this.onChange}
      @pointerdown=${this.startDrag}
      @pointerup=${this.endDrag}
      @lostpointercapture=${this.endDrag}
      @dblclick=${this.reset}
    />`}readValue(e){let t=parseFloat(e.target.value);return N(ve(this.fromPos(t),this.step),this.min,this.max)}onInput(e){e.stopPropagation(),this.value=this.readValue(e),this.dragging&&(this.internal=this.value),this.emit("input",this.value)}onChange(e){e.stopPropagation(),this.endDrag(),this.emit("change",this.value)}reset(){if(this.disabled||this.defaultValue===null)return;this.endDrag();let e=N(this.defaultValue,this.min,this.max);e!==this.value&&(this.value=e,this.emit("input",e)),this.emit("change",this.value)}startDrag(){this.disabled||(this.dragging=!0,this.internal=this.value)}endDrag(){this.dragging=!1,this.internal=null}};k("nbplay-slider",mt);var Ki=270,Ue=-135,Wi=150;function Vn(r,e){let t=(r-90)*Math.PI/180;return[50+e*Math.cos(t),50+e*Math.sin(t)]}function ji(r,e,t){let[n,i]=Vn(r,t),[s,a]=Vn(e,t),o=e-r>180?1:0;return`M ${n} ${i} A ${t} ${t} 0 ${o} 1 ${s} ${a}`}var bt=class extends g{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},disabled:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};startY=0;startValue=0;constructor(){super(),this.value=0,this.min=0,this.max=1,this.step=.01,this.defaultValue=null,this.disabled=!1,this.dragging=!1}connectedCallback(){super.connectedCallback(),this.hasAttribute("tabindex")||(this.tabIndex=0),this.setAttribute("role","slider"),this.addEventListener("pointerdown",this.onPointerDown),this.addEventListener("pointermove",this.onPointerMove),this.addEventListener("pointerup",this.onPointerUp),this.addEventListener("lostpointercapture",this.onPointerUp),this.addEventListener("wheel",this.onWheel,{passive:!1}),this.addEventListener("keydown",this.onKeydown),this.addEventListener("dblclick",this.onDblclick)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("pointerdown",this.onPointerDown),this.removeEventListener("pointermove",this.onPointerMove),this.removeEventListener("pointerup",this.onPointerUp),this.removeEventListener("lostpointercapture",this.onPointerUp),this.removeEventListener("wheel",this.onWheel),this.removeEventListener("keydown",this.onKeydown),this.removeEventListener("dblclick",this.onDblclick)}updated(){this.setAttribute("aria-valuemin",String(this.min)),this.setAttribute("aria-valuemax",String(this.max)),this.setAttribute("aria-valuenow",String(this.value)),this.setAttribute("aria-disabled",String(this.disabled))}fraction(){return this.max>this.min?N((this.value-this.min)/(this.max-this.min),0,1):0}render(){let e=Ue+this.fraction()*Ki,[t,n]=Vn(e,30);return u`<svg
      class="nbplay-dial-svg"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      ${Fe`<path class="nbplay-dial-track" d=${ji(Ue,Ue+Ki,40)} />`}
      ${Fe`<path class="nbplay-dial-arc" d=${ji(Ue,Math.max(e,Ue+.01),40)} />`}
      ${Fe`<circle class="nbplay-dial-cap" cx="50" cy="50" r="30" />`}
      ${Fe`<line class="nbplay-dial-indicator" x1="50" y1="50" x2=${t} y2=${n} />`}
    </svg>`}set(e,t){let n=N(ve(e,this.step),this.min,this.max);n!==this.value&&(this.value=n,this.emit("input",n)),t&&this.emit("change",this.value)}reset(){this.disabled||this.defaultValue===null||(this.dragging=!1,this.set(this.defaultValue,!0))}onDblclick=()=>this.reset();onPointerDown=e=>{this.disabled||e.button!==0||(e.preventDefault(),this.focus(),this.setPointerCapture(e.pointerId),this.dragging=!0,this.startY=e.clientY,this.startValue=this.value)};onPointerMove=e=>{if(!this.dragging)return;let t=e.shiftKey?Wi*4:Wi,n=(this.startY-e.clientY)/t*(this.max-this.min);this.set(this.startValue+n,!1)};onPointerUp=()=>{this.dragging&&(this.dragging=!1,this.emit("change",this.value))};onWheel=e=>{if(this.disabled)return;e.preventDefault();let t=e.deltaY!==0?e.deltaY:e.deltaX;t!==0&&this.set(this.value+(t<0?this.step:-this.step),!0)};onKeydown=e=>{if(this.disabled)return;let t=this.step*10,n={ArrowUp:this.step,ArrowRight:this.step,ArrowDown:-this.step,ArrowLeft:-this.step,PageUp:t,PageDown:-t},i;e.key in n?i=this.value+n[e.key]:e.key==="Home"?i=this.min:e.key==="End"&&(i=this.max),i!==void 0&&(e.preventDefault(),this.set(i,!0))}};k("nbplay-dial",bt);var ft=class extends g{static properties={level:{type:Number},rms:{type:Number},orientation:{type:String,reflect:!0},floorDb:{type:Number,attribute:"floor-db"},hotThreshold:{type:Number,attribute:"hot-threshold"},hot:{type:Boolean,reflect:!0}};constructor(){super(),this.level=0,this.rms=0,this.orientation="vertical",this.floorDb=-60,this.hotThreshold=.99,this.hot=!1}percent(e){if(!(e>0))return 0;let t=Ui(e);return N((t-this.floorDb)/(0-this.floorDb),0,1)*100}willUpdate(){this.hot=this.level>=this.hotThreshold}render(){return u`<div class="nbplay-meter-track">
      <div
        class="nbplay-meter-rms"
        style="--nbplay-meter-fill: ${this.percent(this.rms)}%"
      ></div>
      <div
        class="nbplay-meter-fill"
        style="--nbplay-meter-fill: ${this.percent(this.level)}%"
      ></div>
    </div>`}};k("nbplay-meter",ft);var vt=class extends g{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},orientation:{type:String,reflect:!0},editable:{type:String,reflect:!0},wheelStep:{type:Number,attribute:"wheel-step"},disabled:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};constructor(){super(),this.value=0,this.min=0,this.max=127,this.step=1,this.orientation="vertical",this.editable="",this.wheelStep=1,this.disabled=!1,this.dragging=!1}connectedCallback(){super.connectedCallback(),this.addEventListener("wheel",this.onWheel,{passive:!1}),this.addEventListener("pointerdown",this.onPointerDown),this.addEventListener("pointermove",this.onPointerMove),this.addEventListener("pointerup",this.onPointerUp),this.addEventListener("lostpointercapture",this.onPointerUp)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("wheel",this.onWheel),this.removeEventListener("pointerdown",this.onPointerDown),this.removeEventListener("pointermove",this.onPointerMove),this.removeEventListener("pointerup",this.onPointerUp),this.removeEventListener("lostpointercapture",this.onPointerUp)}can(e){return!this.disabled&&this.editable.split(/\s+/).includes(e)}get percent(){return this.max>this.min?N((this.value-this.min)/(this.max-this.min),0,1)*100:0}render(){return u`<div class="nbplay-bar-track">
      <div
        class="nbplay-bar-fill"
        style="--nbplay-bar-fill: ${this.percent}%"
      ></div>
    </div>`}set(e,t){let n=N(ve(e,this.step),this.min,this.max);n!==this.value&&(this.value=n,this.emit("input",n)),t&&this.emit("change",this.value)}fromPointer(e){let t=this.getBoundingClientRect(),n=this.orientation==="vertical"?1-(e.clientY-t.top)/t.height:(e.clientX-t.left)/t.width;return this.min+N(n,0,1)*(this.max-this.min)}onWheel=e=>{if(!this.can("wheel"))return;e.preventDefault();let t=e.deltaY!==0?e.deltaY:e.deltaX;t!==0&&this.set(this.value+(t<0?this.wheelStep:-this.wheelStep),!0)};onPointerDown=e=>{!this.can("drag")||e.button!==0||(e.preventDefault(),this.setPointerCapture(e.pointerId),this.dragging=!0,this.set(this.fromPointer(e),!1))};onPointerMove=e=>{this.dragging&&this.set(this.fromPointer(e),!1)};onPointerUp=()=>{this.dragging&&(this.dragging=!1,this.emit("change",this.value))}};k("nbplay-bar",vt);var yt=class extends g{static properties={data:{attribute:!1},variant:{type:String,reflect:!0},emptyText:{type:String,attribute:"empty-text"}};observer;constructor(){super(),this.data=null,this.variant="line",this.emptyText="No sample loaded"}render(){return u`<canvas class="nbplay-waveform-canvas"></canvas>`}firstUpdated(){this.observer=new ResizeObserver(()=>this.draw()),this.observer.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.observer?.disconnect()}updated(){this.draw()}draw(){let e=this.querySelector("canvas");if(!e)return;let t=this.clientWidth,n=this.clientHeight;if(t===0||n===0)return;let i=window.devicePixelRatio||1;e.width=Math.round(t*i),e.height=Math.round(n*i);let s=e.getContext("2d");if(!s)return;s.setTransform(i,0,0,i,0,0);let a=V(this,"--nbplay-chart-bg","#121214"),o=V(this,"--nbplay-chart-grid","#2f2f36"),l=V(this,"--nbplay-chart-line","#f28c38"),c=V(this,"--nbplay-fg-muted","#a8a59c");s.fillStyle=a,s.fillRect(0,0,t,n),s.strokeStyle=o,s.lineWidth=1,s.setLineDash([3,4]);for(let m of[.25,.5,.75])s.beginPath(),s.moveTo(0,m*n),s.lineTo(t,m*n),s.stroke();s.setLineDash([]);let d=W(this.data);if(!d||d.length===0){s.fillStyle=c,s.font="12px "+V(this,"--nbplay-font-mono","monospace"),s.textAlign="center",s.textBaseline="middle",s.fillText(this.emptyText,t/2,n/2);return}s.beginPath();let p=n/2,h=n*.45;for(let m=0;m<t;m++){let y=Math.floor(m/t*d.length),f=p-d[y]*h;m===0?s.moveTo(m,f):s.lineTo(m,f)}this.variant==="glow"&&(s.strokeStyle=l,s.globalAlpha=.25,s.lineWidth=6,s.stroke(),s.globalAlpha=1),s.strokeStyle=l,s.lineWidth=2,s.lineJoin="round",s.stroke()}};k("nbplay-waveform",yt);var Zi=.3,gt=class extends g{static properties={attack:{type:Number},decay:{type:Number},sustain:{type:Number},release:{type:Number}};observer;constructor(){super(),this.attack=.005,this.decay=.1,this.sustain=.8,this.release=.1}render(){return u`<canvas class="nbplay-envelope-canvas"></canvas>`}firstUpdated(){this.observer=new ResizeObserver(()=>this.draw()),this.observer.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.observer?.disconnect()}updated(){this.draw()}draw(){let e=this.querySelector("canvas");if(!e)return;let t=this.clientWidth,n=this.clientHeight;if(t===0||n===0)return;let i=window.devicePixelRatio||1;e.width=Math.round(t*i),e.height=Math.round(n*i);let s=e.getContext("2d");if(!s)return;s.setTransform(i,0,0,i,0,0);let a=V(this,"--nbplay-chart-bg","#121214"),o=V(this,"--nbplay-chart-line","#f28c38"),l=V(this,"--nbplay-fg-muted","#a8a59c");s.fillStyle=a,s.fillRect(0,0,t,n);let c=this.attack+this.decay+Zi+this.release||1,d=t/c,p=8,h=n-14,m=E=>h-E*(h-p),y=this.attack*d,f=y+this.decay*d,$=f+Zi*d;s.beginPath(),s.moveTo(0,h),s.lineTo(y,m(1)),s.lineTo(f,m(this.sustain)),s.lineTo($,m(this.sustain)),s.lineTo(t,h),s.strokeStyle=o,s.lineWidth=2,s.lineJoin="round",s.stroke(),s.lineTo(0,h),s.closePath(),s.fillStyle=o,s.globalAlpha=.15,s.fill(),s.globalAlpha=1,s.fillStyle=l,s.font="10px "+V(this,"--nbplay-font-mono","monospace"),s.textAlign="center",s.textBaseline="bottom";let b=[["A",y/2],["D",(y+f)/2],["S",(f+$)/2],["R",($+t)/2]];for(let[E,v]of b)s.fillText(E,Math.min(Math.max(v,6),t-6),n-2)}};k("nbplay-envelope",gt);var kt=class extends g{static properties={active:{type:Boolean,reflect:!0},variant:{type:String,reflect:!0},label:{type:String},title:{type:String},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.active=!1,this.variant="default",this.label="",this.title="",this.disabled=!1}render(){return u`<button
      type="button"
      class="nbplay-toggle-button"
      aria-pressed=${String(this.active)}
      title=${this.title||x}
      ?disabled=${this.disabled}
      @click=${this.toggle}
    >
      ${this.label}
    </button>`}toggle(){this.disabled||(this.active=!this.active,this.emit("change",this.active))}};k("nbplay-toggle",kt);var $t=class extends g{static properties={beat:{type:Number},beatsPerBar:{type:Number,attribute:"beats-per-bar"},format:{type:String,reflect:!0},pad:{type:Number}};constructor(){super(),this.beat=0,this.beatsPerBar=4,this.format="bar:beat",this.pad=3}get bar(){return Math.floor(Math.max(0,this.beat)/Math.max(.25,this.beatsPerBar))+1}get beatInBar(){return Math.floor(Math.max(0,this.beat)%Math.max(.25,this.beatsPerBar))+1}render(){let e=this.format==="bar:beat"?String(this.bar).padStart(this.pad,"0"):String(this.bar),t=this.format==="bar:beat"?":":".";return u`<span class="nbplay-position-bar">${e}</span
      ><span class="nbplay-position-sep">${t}</span
      ><span class="nbplay-position-beat">${this.beatInBar}</span>`}};k("nbplay-position",$t);var St=class extends g{static properties={options:{attribute:!1},value:{type:String,reflect:!0},label:{type:String},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.options=[],this.value="",this.label="",this.disabled=!1}render(){let e=this.options.map(t=>typeof t=="string"?{value:t}:t);return u`${this.label?u`<span class="nbplay-segmented-label">${this.label}</span>`:""}
      <div
        class="nbplay-segmented-group"
        role="radiogroup"
        aria-label=${this.label}
      >
        ${e.map(t=>u`<button
              type="button"
              class="nbplay-segmented-option ${t.value===this.value?"active":""}"
              role="radio"
              aria-checked=${String(t.value===this.value)}
              data-value=${t.value}
              title=${t.title??""}
              ?disabled=${this.disabled||t.disabled}
              @click=${()=>this.select(t.value)}
            >
              ${t.label??t.value}
            </button>`)}
      </div>`}select(e){this.disabled||e===this.value||(this.value=e,this.emit("change",e))}};k("nbplay-segmented",St);var Et=class extends g{static properties={title:{type:String},badge:{type:String},status:{type:String}};actions=null;constructor(){super(),this.title="nbplay",this.badge="",this.status=""}connectedCallback(){this.actions===null&&(this.actions=Array.from(this.childNodes)),super.connectedCallback()}render(){let e=this.actions??[];return u`<h3 class="nbplay-header-title">${this.title}</h3>
      ${this.badge?u`<span class="nbplay-header-badge">${this.badge}</span>`:x}
      ${this.status?u`<span class="nbplay-header-status">${this.status}</span>`:x}
      <div class="nbplay-header-actions">${e}</div>`}};k("nbplay-header",Et);function nr(){let r=navigator.userAgentData?.platform??navigator.platform;return/mac|iphone|ipad|ipod/i.test(r)?"\u2318 K":"Ctrl K"}var xt=class extends g{static properties={commands:{attribute:!1},placeholder:{type:String},query:{state:!0},active:{state:!0}};constructor(){super(),this.commands=[],this.placeholder="",this.query="",this.active=0}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onShortcut)}disconnectedCallback(){window.removeEventListener("keydown",this.onShortcut),super.disconnectedCallback()}show(){let e=this.dialog;!e||e.open||(this.query="",this.active=0,e.showModal())}get dialog(){return this.querySelector("dialog")}filtered(){let e=this.query.trim().toLowerCase();return this.commands.filter(t=>(t.label??t.id).toLowerCase().includes(e))}onShortcut=e=>{!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||e.key.toLowerCase()==="k"&&(e.preventDefault(),this.dialog?.open?this.dialog.close():this.show())};onKey(e){let t=this.filtered();if(e.key==="ArrowDown"||e.key==="ArrowUp"){if(e.preventDefault(),!t.length)return;let n=e.key==="ArrowDown"?1:-1;this.active=(this.active+n+t.length)%t.length}else e.key==="Enter"&&(e.preventDefault(),t[this.active]&&this.pick(t[this.active].id))}pick(e){this.dialog?.close(),this.emitDetail("nbplay-request",{name:e})}updated(){this.querySelector(".nbplay-palette-option.active")?.scrollIntoView({block:"nearest"})}render(){let e=this.filtered();return u`<dialog
      class="nbplay-palette-dialog"
      @click=${t=>{t.target===this.dialog&&this.dialog?.close()}}
    >
      <input
        class="nbplay-palette-input"
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-autocomplete="list"
        aria-label=${this.placeholder}
        placeholder=${this.placeholder}
        autocomplete="off"
        spellcheck="false"
        .value=${this.query}
        @input=${t=>{this.query=t.target.value,this.active=0}}
        @keydown=${this.onKey}
      />
      <ul class="nbplay-palette-list" role="listbox">
        ${e.map((t,n)=>u`<li
              class="nbplay-palette-option ${n===this.active?"active":""}"
              role="option"
              aria-selected=${String(n===this.active)}
              data-id=${t.id}
              @pointermove=${()=>{this.active=n}}
              @click=${()=>this.pick(t.id)}
            >
              ${t.label??t.id}
            </li>`)}
        ${e.length?"":u`<li class="nbplay-palette-empty">No match</li>`}
      </ul>
    </dialog>`}};k("nbplay-palette",xt);var Nt=class extends g{static properties={label:{type:String}};constructor(){super(),this.label=""}render(){return u`<button
      type="button"
      class="nbplay-palette-hint-button"
      aria-label="Open the command palette"
    >
      ${this.label}
      <kbd class="nbplay-palette-hint-keys">${nr()}</kbd>
    </button>`}};k("nbplay-palette-hint",Nt);var Pt=class extends g{static properties={url:{type:String},label:{type:String},accept:{type:String},error:{state:!0}};constructor(){super(),this.url="",this.label="",this.accept="",this.error=""}async onPick(e){let t=e.target,n=t.files?.[0];if(t.value="",!n)return;this.error="";let i=new CustomEvent("nbplay-request",{detail:{name:"upload",file:n},bubbles:!0,composed:!0,cancelable:!0});if(this.dispatchEvent(i))try{let s=await fetch(this.url,{method:"PUT",body:n});if(s.ok){location.reload();return}let a=await s.json().catch(()=>({}));this.error=a.error??`Upload failed (${s.status})`}catch(s){this.error=String(s)}}render(){return u`<label class="nbplay-upload-button">
        ${this.label}
        <input
          class="nbplay-upload-input"
          type="file"
          accept=${this.accept}
          @change=${this.onPick}
        />
      </label>
      ${this.error?u`<span class="nbplay-upload-error" role="alert"
              >${this.error}</span
            >`:x}`}};k("nbplay-upload",Pt);var wt=class extends g{static properties={label:{type:String},value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},scale:{type:String},kind:{type:String},control:{type:String,reflect:!0},precision:{type:Number},unit:{type:String},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.label="",this.value=0,this.min=0,this.max=1,this.step=.01,this.defaultValue=null,this.scale="linear",this.kind="float",this.control="slider",this.precision=2,this.unit="",this.editable=!0,this.disabled=!1}render(){let e=this.control==="dial"?u`<nbplay-dial
            .value=${this.value}
            .min=${this.min}
            .max=${this.max}
            .step=${this.step}
            .defaultValue=${this.defaultValue}
            .disabled=${this.disabled}
            @input=${this.onInput}
            @change=${this.onChange}
          ></nbplay-dial>`:u`<nbplay-slider
            .value=${this.value}
            .min=${this.min}
            .max=${this.max}
            .step=${this.step}
            .defaultValue=${this.defaultValue}
            .scale=${this.scale}
            .disabled=${this.disabled}
            @input=${this.onInput}
            @change=${this.onChange}
          ></nbplay-slider>`;return u`<span class="nbplay-param-label">${this.label}</span>
      ${e}
      <nbplay-value
        .value=${this.value}
        .kind=${this.kind}
        .min=${this.min}
        .max=${this.max}
        .precision=${this.precision}
        .unit=${this.unit}
        .editable=${this.editable&&!this.disabled}
        @change=${this.onChange}
      ></nbplay-value>`}onInput(e){e.stopPropagation(),this.value=e.detail.value,this.emit("input",this.value)}onChange(e){e.stopPropagation(),this.value=e.detail.value,this.emit("change",this.value)}};k("nbplay-param",wt);var Ct=class extends g{static properties={playing:{type:Boolean,reflect:!0},recording:{type:Boolean,reflect:!0},showRecord:{type:Boolean,attribute:"show-record"},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.playing=!1,this.recording=!1,this.showRecord=!0,this.disabled=!1}render(){return u`<button
        type="button"
        class="nbplay-transport-stop"
        title="Stop and rewind"
        ?disabled=${this.disabled}
        @click=${()=>this.emitDetail("nbplay-stop",{})}
      >
        ■
      </button>
      <nbplay-toggle
        class="nbplay-transport-play"
        variant="play"
        .label=${this.playing?"\u23F8":"\u25B6"}
        .title=${this.playing?"Pause":"Play"}
        .active=${this.playing}
        .disabled=${this.disabled}
        @change=${e=>this.forward(e,"nbplay-play")}
      ></nbplay-toggle>
      ${this.showRecord?u`<nbplay-toggle
              class="nbplay-transport-record"
              variant="record"
              label="●"
              title="Record"
              .active=${this.recording}
              .disabled=${this.disabled}
              @change=${e=>this.forward(e,"nbplay-record")}
            ></nbplay-toggle>`:x}`}forward(e,t){e.stopPropagation(),this.emitDetail(t,{value:e.detail.value})}};k("nbplay-transport-buttons",Ct);var Tt=class extends g{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},level:{type:Number},rms:{type:Number},label:{type:String},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.value=.8,this.min=0,this.max=2,this.step=.01,this.defaultValue=1,this.level=0,this.rms=0,this.label="",this.editable=!0,this.disabled=!1}render(){return u`${this.label?u`<span class="nbplay-fader-label">${this.label}</span>`:x}
      <div class="nbplay-fader-body">
        <nbplay-meter .level=${this.level} .rms=${this.rms}></nbplay-meter>
        <nbplay-slider
          orientation="vertical"
          .value=${this.value}
          .min=${this.min}
          .max=${this.max}
          .step=${this.step}
          .defaultValue=${this.defaultValue}
          .disabled=${this.disabled}
          @input=${this.onInput}
          @change=${this.onChange}
        ></nbplay-slider>
      </div>
      <nbplay-value
        kind="db"
        .value=${this.value}
        .min=${this.min}
        .max=${this.max}
        .editable=${this.editable&&!this.disabled}
        @change=${this.onChange}
      ></nbplay-value>`}onInput(e){e.stopPropagation(),this.value=e.detail.value,this.emit("input",this.value)}onChange(e){e.stopPropagation(),this.value=e.detail.value,this.emit("change",this.value)}};k("nbplay-fader",Tt);var Fn=[{key:"2",semitone:1,black:!0},{key:"3",semitone:3,black:!0},{key:"",semitone:-1,black:!1},{key:"5",semitone:6,black:!0},{key:"6",semitone:8,black:!0},{key:"7",semitone:10,black:!0},{key:"",semitone:-1,black:!1},{key:"9",semitone:13,black:!0},{key:"0",semitone:15,black:!0}],Un=[{key:"Q",semitone:0,black:!1},{key:"W",semitone:2,black:!1},{key:"E",semitone:4,black:!1},{key:"R",semitone:5,black:!1},{key:"T",semitone:7,black:!1},{key:"Y",semitone:9,black:!1},{key:"U",semitone:11,black:!1},{key:"I",semitone:12,black:!1},{key:"O",semitone:14,black:!1},{key:"P",semitone:16,black:!1}],zn=[{key:"A",semitone:1,black:!0},{key:"S",semitone:3,black:!0},{key:"",semitone:-1,black:!1},{key:"F",semitone:6,black:!0},{key:"G",semitone:8,black:!0},{key:"H",semitone:10,black:!0},{key:"",semitone:-1,black:!1},{key:"K",semitone:13,black:!0},{key:"L",semitone:15,black:!0}],Hn=[{key:"Z",semitone:0,black:!1},{key:"X",semitone:2,black:!1},{key:"C",semitone:4,black:!1},{key:"V",semitone:5,black:!1},{key:"B",semitone:7,black:!1},{key:"N",semitone:9,black:!1},{key:"M",semitone:11,black:!1},{key:",",semitone:12,black:!1},{key:".",semitone:14,black:!1}],Yi={};for(let[r,e]of[[[Fn,Un],"upper"],[[zn,Hn],"lower"]])for(let t of r)for(let n of t)n.key&&(Yi[n.key.toLowerCase()]={semitone:n.semitone,zone:e});function Gn(r,e,t){let n=Yi[r.toLowerCase()];return n?{note:((n.zone==="upper"?e:t)+1)*12+n.semitone,zone:n.zone}:null}var ir={1:0,3:1,6:3,8:4,10:5},sr=[0,2,4,5,7,9,11],Mt=class extends g{static properties={layout:{type:String,reflect:!0},upperOctave:{type:Number,attribute:"upper-octave"},lowerOctave:{type:Number,attribute:"lower-octave"},startOctave:{type:Number,attribute:"start-octave"},octaves:{type:Number},velocity:{type:Number},pressed:{attribute:!1},disabled:{type:Boolean,reflect:!0}};held=new Map;heldNotes=new Set;constructor(){super(),this.layout="rows",this.upperOctave=3,this.lowerOctave=4,this.startOctave=3,this.octaves=2,this.velocity=100,this.pressed=[],this.disabled=!1}isPressed(e){return this.heldNotes.has(e)||this.pressed.includes(e)}render(){return this.layout==="piano"?this.renderPiano():this.renderRows()}renderRows(){let e=(t,n,i,s)=>{let a=t==="upper"?this.upperOctave:this.lowerOctave;return u`<div class="nbplay-keys-zone" data-zone=${t}>
        <div class="nbplay-keys-zone-label">${n}</div>
        <div class="nbplay-keys-row nbplay-keys-row-sharp">
          ${i.map(o=>this.renderKey(o,a,t))}
        </div>
        <div class="nbplay-keys-row nbplay-keys-row-natural">
          ${s.map(o=>this.renderKey(o,a,t))}
        </div>
      </div>`};return u`${e("upper","UPPER",Fn,Un)}
    ${e("lower","LOWER",zn,Hn)}`}renderKey(e,t,n){if(!e.key)return u`<div class="nbplay-keys-gap"></div>`;let i=(t+1)*12+e.semitone;return u`<div
      class="nbplay-keys-key ${e.black?"nbplay-keys-black":"nbplay-keys-white"} ${this.isPressed(i)?"pressed":""}"
      data-key=${e.key.toLowerCase()}
      data-note=${i}
      @pointerdown=${s=>this.down(s,i,n)}
      @pointerup=${this.up}
      @pointercancel=${this.up}
      @lostpointercapture=${this.up}
    >
      <span class="nbplay-keys-key-label">${e.key}</span>
      <span class="nbplay-keys-key-note">${R(i)}</span>
    </div>`}renderPiano(){let e=[],t=[];for(let s=0;s<this.octaves;s++){let a=(this.startOctave+s+1)*12;for(let o of sr)e.push({note:a+o});for(let[o,l]of Object.entries(ir))t.push({note:a+Number(o),index:s*7+l})}let n=s=>s<60?"lower":"upper",i=(s,a,o)=>u`<div
        class="nbplay-keys-key ${a?"nbplay-keys-black":"nbplay-keys-white"} ${this.isPressed(s)?"pressed":""}"
        data-note=${s}
        style=${a?`--nbplay-key-index: ${o}`:x}
        @pointerdown=${l=>this.down(l,s,n(s))}
        @pointerup=${this.up}
        @pointercancel=${this.up}
        @lostpointercapture=${this.up}
      >
        ${s%12===0?u`<span class="nbplay-keys-key-note">${R(s)}</span>`:x}
      </div>`;return u`<div
      class="nbplay-keys-piano"
      style="--nbplay-key-count: ${e.length}"
    >
      ${e.map(s=>i(s.note,!1))}
      ${t.map(s=>i(s.note,!0,s.index))}
    </div>`}down(e,t,n){if(this.disabled||e.button!==0)return;e.preventDefault();let i=e.currentTarget;try{i.setPointerCapture(e.pointerId)}catch{}this.held.has(e.pointerId)&&this.release(e.pointerId),this.held.set(e.pointerId,{note:t,zone:n}),this.heldNotes.add(t),this.requestUpdate(),this.emitDetail("nbplay-note-on",{note:t,velocity:this.velocity,zone:n})}up=e=>{this.release(e.pointerId)};release(e){let t=this.held.get(e);t&&(this.held.delete(e),this.heldNotes.delete(t.note),this.requestUpdate(),this.emitDetail("nbplay-note-off",{note:t.note,zone:t.zone}))}releaseAll(){for(let e of this.held.keys())this.release(e)}};k("nbplay-key-rows",Mt);var rr=5,ar=300,At=class extends g{static properties={rows:{type:Number},cols:{type:Number},pads:{attribute:!1},active:{attribute:!1},velocitySensitive:{type:Boolean,attribute:"velocity-sensitive"},hold:{type:Boolean},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};held=new Set;pendingTap;press;constructor(){super(),this.rows=4,this.cols=4,this.pads=[],this.active=[],this.velocitySensitive=!0,this.hold=!1,this.editable=!0,this.disabled=!1}pad(e){return this.pads[e]??{note:60+e,velocity:100}}render(){let e=this.rows*this.cols;return u`<div
      class="nbplay-pad-grid-cells"
      style="grid-template-columns: repeat(${this.cols}, 1fr); grid-template-rows: repeat(${this.rows}, 1fr)"
    >
      ${Array.from({length:e},(t,n)=>this.renderCell(n))}
    </div>`}renderCell(e){let t=this.pad(e),n=this.held.has(e)||this.active.includes(e),i=`Pad ${e+1}: ${t.label??R(t.note)}  vel=${t.velocity}`;return u`<div
      class="nbplay-pad-cell ${n?"active":""}"
      data-index=${e}
      title=${i}
      @pointerdown=${s=>this.onPointerDown(s,e)}
      @pointermove=${this.onPointerMove}
      @pointerup=${this.onPointerUp}
      @pointercancel=${this.onPointerCancel}
      @lostpointercapture=${this.onPointerCancel}
      @wheel=${s=>this.onWheel(s,e)}
    >
      <nbplay-bar
        class="nbplay-pad-vel"
        .value=${t.velocity}
        .max=${127}
        .min=${0}
      ></nbplay-bar>
      ${t.label!==void 0?u`<span class="nbplay-pad-label">${t.label}</span>`:u`<nbplay-value
              class="nbplay-pad-label"
              kind="note"
              .value=${t.note}
              .min=${0}
              .max=${127}
              .editable=${this.editable}
              @dblclick=${()=>clearTimeout(this.pendingTap)}
              @change=${s=>this.onLabelChange(s,e)}
            ></nbplay-value>`}
    </div>`}tapVelocity(e,t,n){let i=this.pad(n).velocity;if(!this.velocitySensitive)return i;let s=t.getBoundingClientRect(),a=N((e.clientY-s.top)/s.height,0,1);return q(Math.round(20+a*(i-20)))}noteOn(e,t){this.held.add(e),this.requestUpdate(),this.emitDetail("nbplay-note-on",{index:e,note:this.pad(e).note,velocity:t})}noteOff(e){this.held.delete(e)&&(this.requestUpdate(),this.emitDetail("nbplay-note-off",{index:e,note:this.pad(e).note}))}onPointerDown(e,t){if(this.disabled||e.button!==0)return;let n=e.currentTarget,i=e.target.closest("nbplay-value")!==null;if(!i){e.preventDefault();try{n.setPointerCapture(e.pointerId)}catch{}}this.press={index:t,pointerId:e.pointerId,startY:e.clientY,onLabel:i,dragging:!1,cell:n},this.hold&&!i&&this.noteOn(t,this.tapVelocity(e,n,t))}onPointerMove=e=>{let t=this.press;if(!t||t.pointerId!==e.pointerId||!this.editable||this.hold||!t.dragging&&Math.abs(e.clientY-t.startY)<rr)return;t.dragging=!0;let n=t.cell.getBoundingClientRect(),i=q(Math.round((1-(e.clientY-n.top)/n.height)*127));this.setPad(t.index,"velocity",i,"input")};onPointerUp=e=>{let t=this.press;if(!t||t.pointerId!==e.pointerId)return;if(this.press=void 0,this.hold){this.noteOff(t.index);return}if(t.dragging){this.emitDetail("change",{index:t.index,field:"velocity",value:this.pad(t.index).velocity});return}let n=this.tapVelocity(e,t.cell,t.index),i=()=>{this.noteOn(t.index,n),requestAnimationFrame(()=>this.noteOff(t.index))};if(!t.onLabel){i();return}let s=t.cell.querySelector("nbplay-value");clearTimeout(this.pendingTap),this.pendingTap=setTimeout(()=>{this.pendingTap=void 0,s?.editing||i()},ar)};onPointerCancel=e=>{let t=this.press;!t||t.pointerId!==e.pointerId||(this.press=void 0,this.hold?this.noteOff(t.index):t.dragging&&this.emitDetail("change",{index:t.index,field:"velocity",value:this.pad(t.index).velocity}))};onWheel(e,t){if(!this.editable||this.disabled)return;e.preventDefault();let n=e.deltaY!==0?e.deltaY:e.deltaX;if(n===0)return;let i=this.pad(t);e.shiftKey?this.setPad(t,"velocity",q(i.velocity+(n<0?5:-5)),"change"):this.setPad(t,"note",J(i.note+(n<0?1:-1)),"change")}onLabelChange(e,t){e.stopPropagation();let n=e.detail?.value;this.setPad(t,"note",J(n),"change")}setPad(e,t,n,i){let s=this.pad(e);if(s[t]===n)return;let a=this.pads.slice();a[e]={...s,[t]:n},this.pads=a,this.emitDetail(i,{index:e,field:t,value:n})}};k("nbplay-pad-grid",At);var Bt=class extends g{static properties={voices:{attribute:!1},currentStep:{type:Number,attribute:"current-step"},cursor:{attribute:!1},pending:{attribute:!1},armed:{attribute:!1},showArm:{type:Boolean,attribute:"show-arm"},disabled:{type:Boolean,reflect:!0},editing:{state:!0}};constructor(){super(),this.voices=[],this.currentStep=-1,this.cursor=null,this.pending=null,this.armed=[],this.showArm=!1,this.disabled=!1,this.editing=null}updated(e){if(!e.has("editing")||!this.editing)return;let t=this.querySelector(".nbplay-step-grid-edit"),n=this.step(this.editing.voice,this.editing.step);!t||!n||(t.value=R(n.note),t.focus(),t.select())}get length(){return this.voices[0]?.length??0}render(){let e=this.length,t=Array.from({length:e},(n,i)=>i);return u`<div class="nbplay-step-grid-rows">
      <div class="nbplay-step-grid-row nbplay-step-grid-header">
        <div class="nbplay-step-grid-label">#</div>
        ${t.map(n=>u`<div
              class="nbplay-step-grid-head ${n===this.currentStep?"active-col":""}"
            >
              ${n+1}
            </div>`)}
      </div>
      ${this.voices.map((n,i)=>this.renderVoice(n,i,t))}
    </div>`}renderVoice(e,t,n){let i=this.armed.includes(t);return u`<div
        class="nbplay-step-grid-row nbplay-step-grid-steps"
        data-voice=${t}
      >
        <div class="nbplay-step-grid-label">
          <span>${t+1}</span>
          ${this.showArm?u`<nbplay-toggle
                  class="nbplay-step-grid-arm"
                  variant="arm"
                  label="⏺"
                  title="Arm voice ${t+1} for recording"
                  .active=${i}
                  @change=${s=>this.onArm(s,t)}
                ></nbplay-toggle>`:x}
        </div>
        ${n.map(s=>this.renderCell(e[s],t,s))}
      </div>
      <div
        class="nbplay-step-grid-row nbplay-step-grid-velocities"
        data-voice=${t}
      >
        <div class="nbplay-step-grid-label">
          ${this.voices.length>1?`VEL${t+1}`:"VEL"}
        </div>
        ${n.map(s=>u`<nbplay-bar
              class="nbplay-step-grid-vel ${e[s]?.active?"active":""} ${s===this.currentStep?"current":""}"
              editable="wheel"
              wheel-step="5"
              .value=${e[s]?.velocity??0}
              .min=${0}
              .max=${127}
              @input=${a=>a.stopPropagation()}
              @change=${a=>this.onVelocity(a,t,s)}
            ></nbplay-bar>`)}
      </div>`}renderCell(e,t,n){let i=e??{active:!1,note:60,velocity:100},s=this.pending?.voice===t&&this.pending?.step===n,a=this.cursor?.voice===t&&this.cursor?.step===n,o=["nbplay-step-grid-cell",i.active?"active":"",n===this.currentStep?"current":"",a?"cursor":"",s?"pending":""].join(" "),l=i.probability??1;return u`<div
      class=${o}
      data-voice=${t}
      data-step=${n}
      title="Voice ${t+1} Step ${n+1}: ${R(i.note)} vel=${i.velocity} prob=${Math.round(l*100)}%"
      @click=${()=>this.toggle(t,n)}
      @dblclick=${()=>this.pick(t,n)}
      @wheel=${c=>this.onWheel(c,t,n)}
    >
      ${this.editing?.voice===t&&this.editing?.step===n?this.renderEditor(t,n):s?"\u266A?":R(i.note)}
    </div>`}renderEditor(e,t){let n=i=>i.stopPropagation();return u`<input
      class="nbplay-step-grid-edit"
      type="text"
      aria-label="Note for voice ${e+1} step ${t+1}"
      autocomplete="off"
      spellcheck="false"
      @click=${n}
      @dblclick=${n}
      @wheel=${n}
      @input=${n}
      @change=${n}
      @keydown=${i=>{i.key==="Enter"?this.commitEdit(i.target):i.key==="Escape"&&(this.editing=null)}}
      @blur=${i=>this.commitEdit(i.target)}
    />`}commitEdit(e){let t=this.editing;if(!t)return;this.editing=null;let n=ut(e.value);n!==null&&(this.set(t.voice,t.step,"note",n),this.set(t.voice,t.step,"active",!0))}step(e,t){return this.voices[e]?.[t]}set(e,t,n,i){let s=this.step(e,t);if(!s||s[n]===i)return;let a=this.voices.slice(),o=a[e].slice();o[t]={...s,[n]:i},a[e]=o,this.voices=a,this.emitDetail("change",{voice:e,step:t,field:n,value:i})}toggle(e,t){if(this.disabled)return;let n=this.step(e,t);n&&this.set(e,t,"active",!n.active)}pick(e,t){this.disabled||(this.showArm?this.emitDetail("nbplay-step-pick",{voice:e,step:t}):this.editing={voice:e,step:t})}onWheel(e,t,n){if(this.disabled)return;e.preventDefault();let i=e.deltaY!==0?e.deltaY:e.deltaX,s=this.step(t,n);i===0||!s||this.set(t,n,"note",J(s.note+(i<0?1:-1)))}onVelocity(e,t,n){e.stopPropagation(),this.set(t,n,"velocity",e.detail?.value)}onArm(e,t){e.stopPropagation();let n=e.detail?.value;this.armed=n?[...this.armed,t]:this.armed.filter(i=>i!==t),this.emitDetail("nbplay-arm",{voice:t,armed:n})}};k("nbplay-step-grid",Bt);var Rt=class extends g{static properties={pattern:{attribute:!1},names:{attribute:!1},currentStep:{type:Number,attribute:"current-step"},selected:{type:Number},velocity:{type:Number},group:{type:Number}};constructor(){super(),this.pattern=[],this.names=[],this.currentStep=-1,this.selected=-1,this.velocity=100,this.group=4}render(){let e=this.pattern[0]?.length??0,t=Math.max(1,Math.round(Number(this.group)||4));return u`${this.pattern.map((n,i)=>u`<div
          class="nbplay-drum-grid-row ${i===this.selected?"selected":""}"
          data-pad=${i}
        >
          <button
            type="button"
            class="nbplay-drum-grid-name"
            title=${this.names[i]??`Pad ${i+1}`}
            @click=${()=>this.emitDetail("nbplay-select",{pad:i})}
          >
            ${this.names[i]??`Pad ${i+1}`}
          </button>
          ${Array.from({length:e},(s,a)=>{let o=n[a]??0,l=["nbplay-drum-grid-cell",o>0?"on":"",a===this.currentStep?"current":"",a%t===0?"beat":""].join(" ");return u`<div
              class=${l}
              data-step=${a}
              style=${o>0?`--nbplay-drum-velocity: ${o/127}`:""}
              title="${this.names[i]??`Pad ${i+1}`} step ${a+1}${o>0?`: ${o}`:""}"
              @click=${()=>this.set(i,a,o>0?0:this.velocity)}
              @wheel=${c=>this.onWheel(c,i,a,o)}
            ></div>`})}
        </div>`)}`}set(e,t,n){let i=this.pattern.map(s=>s.slice());!i[e]||i[e][t]===n||(i[e][t]=n,this.pattern=i,this.emitDetail("change",{pad:e,step:t,value:n}))}onWheel(e,t,n,i){if(i<=0)return;e.preventDefault();let s=e.deltaY!==0?e.deltaY:e.deltaX;s!==0&&this.set(t,n,N(i+(s<0?5:-5),1,127))}};k("nbplay-drum-grid",Rt);var ee=["gain","filter","eq","compressor","limiter","distortion","delay","reverb","chorus","phaser","tremolo"];function L(r,e,t,n,i,s){return{key:r,label:e,min:t,max:n,step:i,default:s,kind:"number"}}var or=["lowpass","highpass","bandpass","notch","lowshelf","highshelf","peaking"],ze={eq:[L("low","Low",-24,24,.5,0),L("low_freq","LoHz",20,1e3,1,120),L("mid","Mid",-24,24,.5,0),L("mid_freq","MidHz",100,1e4,1,1e3),L("mid_q","MidQ",.1,10,.01,1),L("high","High",-24,24,.5,0),L("high_freq","HiHz",1e3,2e4,1,8e3)],distortion:[L("drive","Drive",0,1,.01,.4),L("tone","Tone",200,2e4,1,8e3),L("wet","Wet",0,1,.01,1)],chorus:[L("rate","Rate",.05,10,.01,1.5),L("depth","Depth",0,.02,5e-4,.003),L("delay","Delay",.001,.05,.001,.02),L("wet","Wet",0,1,.01,.5)],phaser:[L("rate","Rate",.05,10,.01,.5),L("depth","Depth",0,1,.01,.7),L("frequency","Hz",100,5e3,1,800),L("feedback","Fdbk",0,.9,.01,.4),L("wet","Wet",0,1,.01,.5)],tremolo:[L("rate","Rate",.1,20,.01,5),L("depth","Depth",0,1,.01,.5)],gain:[{key:"gain",label:"Gain",min:0,max:4,step:.01,default:1,kind:"number"}],filter:[{key:"filter_type",label:"Type",options:or,kind:"select"},{key:"frequency",label:"Hz",min:20,max:2e4,step:1,default:1200,kind:"number"},{key:"q",label:"Q",min:1e-4,max:100,step:.01,default:1,kind:"number"}],delay:[{key:"time",label:"Time",min:0,max:5,step:.001,default:.25,kind:"number"},{key:"feedback",label:"Fdbk",min:0,max:.95,step:.01,default:.25,kind:"number"},{key:"wet",label:"Wet",min:0,max:1,step:.01,default:.35,kind:"number"}],reverb:[{key:"seconds",label:"Size",min:.01,max:10,step:.01,default:1.5,kind:"number"},{key:"decay",label:"Decay",min:.01,max:12,step:.01,default:2,kind:"number"},{key:"wet",label:"Wet",min:0,max:1,step:.01,default:.25,kind:"number"}],compressor:[{key:"threshold",label:"Thresh",min:-100,max:0,step:.5,default:-24,kind:"number"},{key:"knee",label:"Knee",min:0,max:40,step:.5,default:30,kind:"number"},{key:"ratio",label:"Ratio",min:1,max:20,step:.1,default:12,kind:"number"},{key:"attack",label:"Attack",min:0,max:1,step:.001,default:.003,kind:"number"},{key:"release",label:"Release",min:0,max:1,step:.001,default:.25,kind:"number"}],limiter:[{key:"threshold",label:"Thresh",min:-100,max:0,step:.5,default:-1,kind:"number"},{key:"release",label:"Release",min:0,max:1,step:.001,default:.05,kind:"number"}]};function _t(r){let e=ze[r.type];return e||Object.entries(r).filter(([t])=>t!=="type"&&t!=="enabled").map(([t,n])=>typeof n=="number"?{key:t,label:t,kind:"number"}:typeof n=="boolean"?{key:t,label:t,kind:"bool"}:typeof n=="string"?{key:t,label:t,kind:"text"}:null).filter(t=>t!==null)}function Kn(r){return r.enabled!==!1}function Wn(r){return r.type==="filter"?`${r.filter_type||"filter"} ${Math.round(Number(r.frequency)||0)}Hz`:r.type}var It=class extends g{static properties={effect:{attribute:!1},specs:{attribute:!1},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.effect={type:"gain"},this.specs=null,this.disabled=!1}render(){let e=this.specs??_t(this.effect);return e.length?u`${e.map(t=>this.renderRow(t))}`:u`<span class="nbplay-effect-editor-none">No parameters</span>`}renderRow(e){let t=this.effect[e.key],n=s=>s.stopPropagation();if(e.kind==="select")return u`<label class="nbplay-effect-editor-row">
        <span>${e.label}</span>
        <select
          data-key=${e.key}
          ?disabled=${this.disabled}
          @input=${n}
          @change=${s=>{s.stopPropagation(),this.commit(e.key,s.target.value)}}
        >
          ${(e.options??[]).map(s=>u`<option value=${s} ?selected=${s===t}>
                ${s}
              </option>`)}
        </select>
      </label>`;if(e.kind==="bool")return u`<label class="nbplay-effect-editor-row">
        <span>${e.label}</span>
        <input
          type="checkbox"
          data-key=${e.key}
          .checked=${!!t}
          ?disabled=${this.disabled}
          @input=${n}
          @change=${s=>{s.stopPropagation(),this.commit(e.key,s.target.checked)}}
        />
      </label>`;if(e.kind==="text")return u`<label class="nbplay-effect-editor-row">
        <span>${e.label}</span>
        <input
          type="text"
          data-key=${e.key}
          .value=${String(t??"")}
          ?disabled=${this.disabled}
          @input=${n}
          @change=${s=>{s.stopPropagation(),this.commit(e.key,s.target.value)}}
        />
      </label>`;let i=Number(t);return e.min!==void 0&&e.max!==void 0?u`<nbplay-param
        class="nbplay-effect-editor-param"
        control="dial"
        data-key=${e.key}
        .label=${e.label}
        .value=${Number.isFinite(i)?i:e.min}
        .min=${e.min}
        .max=${e.max}
        .step=${e.step??.01}
        .defaultValue=${e.default??null}
        .precision=${lr(e.step??.01)}
        .disabled=${this.disabled}
        @input=${n}
        @change=${s=>{s.stopPropagation(),this.commit(e.key,s.detail.value)}}
      ></nbplay-param>`:u`<label class="nbplay-effect-editor-row">
      <span>${e.label}</span>
      <input
        type="number"
        step="any"
        data-key=${e.key}
        .value=${String(Number.isFinite(i)?i:0)}
        ?disabled=${this.disabled}
        @input=${n}
        @change=${s=>{s.stopPropagation();let a=parseFloat(s.target.value);Number.isFinite(a)&&this.commit(e.key,a)}}
      />
    </label>`}commit(e,t){let n=(this.specs??_t(this.effect)).find(i=>i.key===e);n?.kind==="number"&&typeof t=="number"&&(t=N(t,n.min??-1/0,n.max??1/0)),this.effect={...this.effect,[e]:t},this.emitDetail("change",{key:e,value:t})}};function lr(r){return Math.max(0,Math.ceil(-Math.log10(r)))}k("nbplay-effect-editor",It);var Lt=class extends g{static properties={effects:{attribute:!1},types:{attribute:!1},editing:{type:Number},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.effects=[],this.types=ee,this.editing=-1,this.disabled=!1}render(){let e=t=>t.stopPropagation();return u`<div class="nbplay-effect-rack-add">
        <select
          class="nbplay-effect-rack-type"
          title="Effect type"
          ?disabled=${this.disabled}
          @input=${e}
          @change=${e}
        >
          ${this.types.map(t=>u`<option value=${t}>${t}</option>`)}
        </select>
        <button
          type="button"
          class="nbplay-effect-rack-add-btn"
          title="Add effect"
          ?disabled=${this.disabled}
          @click=${this.add}
        >
          +
        </button>
      </div>
      <div class="nbplay-effect-rack-list">
        ${this.effects.map((t,n)=>this.renderItem(t,n))}
      </div>`}renderItem(e,t){let n=Kn(e),i=this.editing===t;return u`<div class="nbplay-effect-rack-item" data-index=${t}>
      <div class="nbplay-effect-rack-chip-row">
        <button
          type="button"
          class="nbplay-effect-rack-chip ${n?"":"bypassed"}"
          title=${n?"Bypass effect":"Enable effect"}
          ?disabled=${this.disabled}
          @click=${()=>this.emitDetail("change",{index:t,field:"enabled",value:!n})}
        >
          ${Wn(e)}
        </button>
        <button
          type="button"
          class="nbplay-effect-rack-edit ${i?"active":""}"
          title="Edit effect"
          ?disabled=${this.disabled}
          @click=${()=>{this.editing=i?-1:t,this.emitDetail("nbplay-effect-editing",{index:this.editing})}}
        >
          ✎
        </button>
        <button
          type="button"
          class="nbplay-effect-rack-remove"
          title="Remove effect"
          ?disabled=${this.disabled}
          @click=${()=>this.emitDetail("nbplay-effect-remove",{index:t})}
        >
          ×
        </button>
      </div>
      ${i?u`<nbplay-effect-editor
              .effect=${e}
              .disabled=${this.disabled}
              @input=${s=>s.stopPropagation()}
              @change=${s=>{s.stopPropagation();let{key:a,value:o}=s.detail;this.emitDetail("change",{index:t,field:a,value:o})}}
            ></nbplay-effect-editor>`:x}
    </div>`}add(){let t=this.querySelector(".nbplay-effect-rack-type")?.value||this.types[0];t&&this.emitDetail("nbplay-effect-add",{type:t})}};k("nbplay-effect-rack",Lt);var Dt=class extends g{static properties={kind:{type:String,reflect:!0},name:{type:String},gain:{type:Number},pan:{type:Number},mute:{type:Boolean},solo:{type:Boolean},sends:{attribute:!1},sendNames:{attribute:!1},effects:{attribute:!1},effectTypes:{attribute:!1},level:{type:Number},rms:{type:Number},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.kind="channel",this.name="",this.gain=.8,this.pan=0,this.mute=!1,this.solo=!1,this.sends=[],this.sendNames=[],this.effects=[],this.effectTypes=ee,this.level=0,this.rms=0,this.editable=!0,this.disabled=!1}render(){let e=this.kind==="channel",t=n=>n.stopPropagation();return u`<div class="nbplay-strip-name" title=${this.name}>
        ${this.name}
      </div>
      <nbplay-fader
        .value=${this.gain}
        .level=${this.level}
        .rms=${this.rms}
        .editable=${this.editable}
        .disabled=${this.disabled}
        @input=${n=>this.forward(n,"input","gain")}
        @change=${n=>this.forward(n,"change","gain")}
      ></nbplay-fader>
      ${e?u`<div class="nbplay-strip-pan">
                <nbplay-value
                  kind="pan"
                  .value=${this.pan}
                  .min=${-1}
                  .max=${1}
                  .editable=${this.editable&&!this.disabled}
                  @input=${t}
                  @change=${n=>this.forward(n,"change","pan")}
                ></nbplay-value>
                <nbplay-slider
                  .value=${this.pan}
                  .min=${-1}
                  .max=${1}
                  .step=${.01}
                  .defaultValue=${0}
                  .disabled=${this.disabled}
                  @input=${n=>this.forward(n,"input","pan")}
                  @change=${n=>this.forward(n,"change","pan")}
                ></nbplay-slider>
              </div>
              <div class="nbplay-strip-buttons">
                <nbplay-toggle
                  variant="mute"
                  label="M"
                  title="Mute"
                  .active=${this.mute}
                  .disabled=${this.disabled}
                  @change=${n=>this.forward(n,"change","mute")}
                ></nbplay-toggle>
                <nbplay-toggle
                  variant="solo"
                  label="S"
                  title="Solo"
                  .active=${this.solo}
                  .disabled=${this.disabled}
                  @change=${n=>this.forward(n,"change","solo")}
                ></nbplay-toggle>
              </div>
              ${this.sendNames.length?u`<div class="nbplay-strip-sends">
                      ${this.sendNames.map((n,i)=>u`<label
                            class="nbplay-strip-send"
                            title="Send to ${n}"
                          >
                            <span>${n}</span>
                            <nbplay-slider
                              .value=${this.sends[i]??0}
                              .min=${0}
                              .max=${1}
                              .step=${.01}
                              .defaultValue=${0}
                              .disabled=${this.disabled}
                              @input=${s=>this.forwardSend(s,"input",i)}
                              @change=${s=>this.forwardSend(s,"change",i)}
                            ></nbplay-slider>
                          </label>`)}
                    </div>`:x}`:x}
      <nbplay-effect-rack
        .effects=${this.effects}
        .types=${this.effectTypes}
        .disabled=${this.disabled}
        @input=${t}
        @change=${n=>{n.stopPropagation();let{index:i,field:s,value:a}=n.detail;this.emitDetail("change",{field:"effect",index:i,key:s,value:a})}}
        @nbplay-effect-editing=${n=>{this.classList.toggle("editing",n.detail.index>=0)}}
      ></nbplay-effect-rack>
      ${this.kind==="master"?x:u`<button
              type="button"
              class="nbplay-strip-remove"
              title=${e?"Remove channel":"Remove return bus"}
              ?disabled=${this.disabled}
              @click=${()=>this.emitDetail("nbplay-remove",{})}
            >
              ×
            </button>`}`}forward(e,t,n){e.stopPropagation();let i=e.detail.value;this[n]=i,this.emitDetail(t,{field:n,value:i})}forwardSend(e,t,n){e.stopPropagation();let i=e.detail.value,s=[...this.sends];s[n]=i,this.sends=s,this.emitDetail(t,{field:"send",index:n,value:i})}};k("nbplay-strip",Dt);var Ot=class extends g{static properties={ports:{attribute:!1},value:{type:String},status:{type:String,reflect:!0},label:{type:String},emptyText:{type:String,attribute:"empty-text"},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.ports=[],this.value="",this.status="idle",this.label="",this.emptyText="Not connected",this.disabled=!1}render(){let e=n=>n.stopPropagation(),t={idle:"Idle",connected:"Connected",unsupported:"Web MIDI unavailable",error:"Error"}[this.status];return u`${this.label?u`<span class="nbplay-midi-port-label">${this.label}</span>`:""}
      <select
        class="nbplay-midi-port-select"
        title="MIDI port"
        ?disabled=${this.disabled||this.status==="unsupported"}
        @input=${e}
        @change=${n=>{n.stopPropagation(),this.value=n.target.value,this.emit("change",this.value)}}
      >
        <option value="" ?selected=${!this.value}>${this.emptyText}</option>
        ${this.ports.map(n=>u`<option
              value=${n.id}
              ?selected=${n.id===this.value}
              .textContent=${n.name}
            ></option>`)}
      </select>
      <button
        type="button"
        class="nbplay-midi-port-refresh"
        title="Refresh ports"
        ?disabled=${this.disabled}
        @click=${()=>this.emitDetail("nbplay-refresh",{})}
      >
        ↻
      </button>
      <span class="nbplay-midi-port-status">${t}</span>`}updated(){let e=this.querySelector(".nbplay-midi-port-select");e&&e.value!==this.value&&(e.value=this.value)}};k("nbplay-midi-port",Ot);function Vt(r){if(!r||r.length===0)return"";let e=r[0],t=e&240,n=(e&15)+1;if(t===144&&r.length>=3)return`NoteOn  ch=${n} note=${r[1]} vel=${r[2]}`;if(t===128&&r.length>=3)return`NoteOff ch=${n} note=${r[1]} vel=${r[2]}`;if(t===176&&r.length>=3)return`CC      ch=${n} ctrl=${r[1]} val=${r[2]}`;if(t===192&&r.length>=2)return`PgmChg  ch=${n} pgm=${r[1]}`;if(t===224&&r.length>=3){let i=r[1]|r[2]<<7;return`Bend    ch=${n} val=${i}`}return e===248?"Clock":e===250?"Start":e===252?"Stop":e===251?"Continue":`Raw [${Array.from(r).map(i=>i.toString(16).padStart(2,"0")).join(" ")}]`}var qt=class extends g{static properties={entries:{attribute:!1},max:{type:Number},label:{type:String},emptyText:{type:String,attribute:"empty-text"}};constructor(){super(),this.entries=[],this.max=8,this.label="",this.emptyText=""}push(e){this.entries=[e,...this.entries].slice(0,this.max)}render(){let e=this.entries.slice(0,this.max);return u`${this.label?u`<div class="nbplay-midi-log-label">${this.label}</div>`:""}
      <div class="nbplay-midi-log-entries">
        ${e.length?e.map(t=>u`<div
                    class="nbplay-midi-log-entry"
                    .textContent=${typeof t=="string"?t:Vt(t)}
                  ></div>`):u`<div class="nbplay-midi-log-empty">${this.emptyText}</div>`}
      </div>`}};k("nbplay-midi-log",qt);var Ft=class extends g{static properties={name:{type:String},active:{type:Boolean,reflect:!0},queued:{type:Boolean,reflect:!0},selected:{type:Boolean,reflect:!0},progress:{type:Number},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.name="",this.active=!1,this.queued=!1,this.selected=!1,this.progress=0,this.disabled=!1}render(){let e=this.name!=="";return u`<button
      type="button"
      class="nbplay-launcher-slot-button ${e?"filled":"empty"}"
      title=${e?"Launch clip":"Stop track"}
      ?disabled=${this.disabled}
      @click=${()=>this.emitDetail("nbplay-launch",{})}
    >
      <nbplay-bar
        class="nbplay-launcher-slot-progress"
        orientation="horizontal"
        .value=${this.active?this.progress:0}
        .min=${0}
        .max=${1}
        .step=${.001}
      ></nbplay-bar>
      <span class="nbplay-launcher-slot-name">
        ${e?this.name:u`<span class="nbplay-launcher-slot-empty-mark">■</span>`}
      </span>
      ${this.queued?u`<span class="nbplay-launcher-slot-next"
              >${e?"next":"stop"}</span
            >`:x}
    </button>`}};k("nbplay-launcher-slot",Ft);var He=-2,Ut=class extends g{static properties={tracks:{attribute:!1},scenes:{attribute:!1},slots:{attribute:!1},active:{attribute:!1},queued:{attribute:!1},progress:{attribute:!1},selected:{attribute:!1},playing:{type:Boolean,reflect:!0},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.tracks=[],this.scenes=[],this.slots=[],this.active=[],this.queued=[],this.progress=[],this.selected=null,this.playing=!1,this.disabled=!1}sceneState(e){let t=this.tracks.filter((i,s)=>this.slots.some(a=>a.track===s&&a.scene===e)).length,n=this.tracks.filter((i,s)=>this.active[s]===e).length;return{active:t>0&&n===t,partial:n>0&&n<t,queued:this.tracks.some((i,s)=>this.queued[s]===e)}}render(){return u`<div
        class="nbplay-launcher-grid-row nbplay-launcher-grid-scenes"
      >
        <div class="nbplay-launcher-grid-corner">
          ${this.playing?"\u25B6":"\u25A0"}
        </div>
        ${this.scenes.map((e,t)=>{let n=this.sceneState(t);return u`<button
            type="button"
            class="nbplay-launcher-grid-scene ${n.active?"active":""} ${n.partial?"partial":""} ${n.queued?"queued":""}"
            data-scene=${t}
            title="Launch scene"
            ?disabled=${this.disabled}
            @click=${()=>this.emitDetail("nbplay-launch-scene",{scene:t})}
          >
            ${e}
          </button>`})}
        <button
          type="button"
          class="nbplay-launcher-grid-stop-all"
          title="Stop all tracks"
          ?disabled=${this.disabled}
          @click=${()=>this.emitDetail("nbplay-stop-all",{})}
        >
          ■ All
        </button>
      </div>
      ${this.tracks.length?this.tracks.map((e,t)=>this.renderTrack(e,t)):u`<div class="nbplay-launcher-grid-empty">No tracks</div>`}`}renderTrack(e,t){let n=this.queued[t]??-1;return u`<div class="nbplay-launcher-grid-row" data-track=${t}>
      <div class="nbplay-launcher-grid-track">
        <span class="nbplay-launcher-grid-track-name">${e.name}</span>
        ${e.detail?u`<small>${e.detail}</small>`:""}
      </div>
      ${this.scenes.map((i,s)=>{let a=this.slots.find(o=>o.track===t&&o.scene===s);return u`<nbplay-launcher-slot
          data-track=${t}
          data-scene=${s}
          .name=${a?.name??""}
          .active=${this.active[t]===s}
          .queued=${n===s||n===He&&!a}
          .selected=${this.selected?.track===t&&this.selected?.scene===s}
          .progress=${this.progress[t]??0}
          .disabled=${this.disabled}
          @nbplay-launch=${o=>{o.stopPropagation(),this.emitDetail("nbplay-launch",{track:t,scene:s})}}
        ></nbplay-launcher-slot>`})}
      <button
        type="button"
        class="nbplay-launcher-grid-track-stop ${n===He?"queued":""}"
        title="Stop track"
        ?disabled=${this.disabled}
        @click=${()=>this.emitDetail("nbplay-stop-track",{track:t})}
      >
        ■
      </button>
    </div>`}};k("nbplay-launcher-grid",Ut);function ce(r,e){let t=Math.floor(r/e)+1,n=Math.floor(r%e)+1;return`${t}.${n}`}function Ht(r,e){return e>0?Math.round(r/e)*e:r}var zt=class extends g{static properties={length:{type:Number},beatsPerBar:{type:Number,attribute:"beats-per-bar"},beat:{type:Number},loopStart:{type:Number,attribute:"loop-start"},loopEnd:{type:Number,attribute:"loop-end"},loopEnabled:{type:Boolean,attribute:"loop-enabled",reflect:!0},width:{type:Number},disabled:{type:Boolean,reflect:!0}};seekFrame=null;constructor(){super(),this.length=16,this.beatsPerBar=4,this.beat=0,this.loopStart=0,this.loopEnd=0,this.loopEnabled=!1,this.width=0,this.disabled=!1}pct(e){return this.length>0?N(e/this.length*100,0,100):0}render(){let e=Math.max(1,Math.ceil(this.length/this.beatsPerBar)),t=this.loopEnabled&&this.loopEnd>this.loopStart;return u`<div
      class="nbplay-ruler-track"
      style=${this.width>0?`width: ${this.width}px;`:x}
      @pointerdown=${this.onSeekDown}
    >
      ${Array.from({length:e},(n,i)=>{let s=this.pct(i*this.beatsPerBar);return u`<span class="nbplay-ruler-bar" style="left: ${s}%;"
          >${i+1}</span
        >`})}
      ${t?u`<div
                class="nbplay-ruler-loop"
                style="left: ${this.pct(this.loopStart)}%; width: ${this.pct(this.loopEnd)-this.pct(this.loopStart)}%;"
              ></div>
              <div
                class="nbplay-ruler-loop-handle start"
                data-edge="start"
                style="left: ${this.pct(this.loopStart)}%;"
                @pointerdown=${this.onHandleDown}
              ></div>
              <div
                class="nbplay-ruler-loop-handle end"
                data-edge="end"
                style="left: ${this.pct(this.loopEnd)}%;"
                @pointerdown=${this.onHandleDown}
              ></div>`:x}
      <div
        class="nbplay-ruler-playhead"
        style="left: ${this.pct(this.beat)}%;"
      ></div>
    </div>`}beatAt(e){let n=this.querySelector(".nbplay-ruler-track").getBoundingClientRect();return(n.width<=0?0:N((e.clientX-n.left)/n.width,0,1))*this.length}onSeekDown=e=>{if(this.disabled||e.button!==0||e.target.closest(".nbplay-ruler-loop-handle"))return;e.preventDefault();let t=e.currentTarget;Ge(t,e.pointerId);let n=this.beatAt(e);this.emitDetail("nbplay-seek",{beat:n,final:!1});let i=a=>{n=this.beatAt(a),this.seekFrame===null&&(this.seekFrame=requestAnimationFrame(()=>{this.seekFrame=null,this.emitDetail("nbplay-seek",{beat:n,final:!1})}))},s=()=>{this.seekFrame!==null&&(cancelAnimationFrame(this.seekFrame),this.seekFrame=null),this.emitDetail("nbplay-seek",{beat:n,final:!0}),t.removeEventListener("pointermove",i),t.removeEventListener("pointerup",s),t.removeEventListener("pointercancel",s)};t.addEventListener("pointermove",i),t.addEventListener("pointerup",s),t.addEventListener("pointercancel",s)};onHandleDown=e=>{if(this.disabled||e.button!==0)return;e.preventDefault(),e.stopPropagation();let t=e.currentTarget;Ge(t,e.pointerId);let n=t.dataset.edge==="start"?"loopStart":"loopEnd",i=this.beatsPerBar,s=(l,c)=>{let d=N(Ht(this.beatAt(l),i),0,this.length),p=n==="loopStart"?Math.min(d,this.loopEnd-i):Math.max(d,this.loopStart+i);this[n]=p,this.emitDetail(c,{field:n,value:p})},a=l=>s(l,"input"),o=l=>{s(l,"change"),t.removeEventListener("pointermove",a),t.removeEventListener("pointerup",o),t.removeEventListener("pointercancel",o)};t.addEventListener("pointermove",a),t.addEventListener("pointerup",o),t.addEventListener("pointercancel",o)}};function Ge(r,e){try{r.setPointerCapture(e)}catch{}}k("nbplay-ruler",zt);var Gt=class extends g{static properties={clipId:{type:String,attribute:"clip-id",reflect:!0},name:{type:String},detail:{type:String},kind:{type:String,reflect:!0},pattern:{type:Boolean,reflect:!0},selected:{type:Boolean,reflect:!0},muted:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};constructor(){super(),this.clipId="",this.name="",this.detail="",this.kind="audio",this.pattern=!1,this.selected=!1,this.muted=!1,this.dragging=!1}render(){return u`<i class="nbplay-clip-handle start"></i>
      <span class="nbplay-clip-name">${this.name}</span>
      <small class="nbplay-clip-detail">${this.detail}</small>
      <i class="nbplay-clip-handle end"></i>`}};k("nbplay-clip",Gt);var cr=.25,Qi=.25,Xi=3,Kt=class extends g{static properties={name:{type:String},armed:{type:Boolean},monitor:{type:Boolean},muted:{type:Boolean},solo:{type:Boolean},input:{type:String},inputs:{attribute:!1},clips:{attribute:!1},length:{type:Number},beatsPerBar:{type:Number,attribute:"beats-per-bar"},beat:{type:Number},selected:{type:String},recording:{type:Boolean,reflect:!0},showHeader:{type:Boolean,attribute:"show-header"},width:{type:Number},disabled:{type:Boolean,reflect:!0}};seekFrame=null;constructor(){super(),this.name="",this.armed=!1,this.monitor=!1,this.muted=!1,this.solo=!1,this.input="microphone",this.inputs=[{value:"microphone",label:"Mic"},{value:"channel",label:"Channel"},{value:"midi",label:"MIDI"}],this.clips=[],this.length=16,this.beatsPerBar=4,this.beat=0,this.selected="",this.recording=!1,this.showHeader=!0,this.width=0,this.disabled=!1}pct(e){return this.length>0?N(e/this.length*100,0,100):0}render(){return u`${this.showHeader?this.renderHeader():x}
      <div
        class="nbplay-lane-clips"
        style="--nbplay-lane-beats: ${Math.max(1,this.length)};${this.width>0?` width: ${this.width}px;`:""}"
        @pointerdown=${this.onSeekDown}
      >
        <div
          class="nbplay-lane-playhead"
          style="left: ${this.pct(this.beat)}%;"
        ></div>
        ${this.clips.map(e=>this.renderClip(e))}
      </div>`}renderHeader(){let e=(t,n,i,s)=>u`<nbplay-toggle
        variant=${n}
        label=${i}
        title=${s}
        .active=${this[t]}
        .disabled=${this.disabled}
        @change=${a=>{a.stopPropagation();let o=a.detail.value;this[t]=o,this.emitDetail("change",{field:t,value:o})}}
      ></nbplay-toggle>`;return u`<div class="nbplay-lane-header">
      <div class="nbplay-lane-name" title=${this.name}>${this.name}</div>
      <div class="nbplay-lane-buttons">
        ${e("armed","arm","R","Arm track")}
        ${e("monitor","monitor","I","Input monitor")}
        ${e("muted","mute","M","Mute track")}
        ${e("solo","solo","S","Solo track")}
      </div>
      <select
        class="nbplay-lane-input"
        title="Record source"
        ?disabled=${this.disabled}
        @input=${t=>t.stopPropagation()}
        @change=${t=>{t.stopPropagation(),this.input=t.target.value,this.emitDetail("change",{field:"input",value:this.input})}}
      >
        ${this.inputs.map(t=>u`<option
              value=${t.value}
              ?selected=${t.value===this.input}
              ?disabled=${t.disabled}
            >
              ${t.label}
            </option>`)}
      </select>
    </div>`}renderClip(e){let t=this.pct(e.start),n=Math.max(1,Math.min(100-t,this.pct(e.duration)));return u`<nbplay-clip
      clip-id=${e.id}
      .name=${e.name}
      .detail=${e.detail??ce(e.start,this.beatsPerBar)}
      .kind=${e.kind??"audio"}
      .pattern=${!!e.pattern}
      .muted=${!!e.muted}
      .selected=${e.id===this.selected}
      style="left: ${t}%; width: ${n}%;"
      @pointerdown=${i=>this.onClipDown(i,e)}
    ></nbplay-clip>`}beatAt(e,t){let n=t.getBoundingClientRect();return(n.width<=0?0:N((e.clientX-n.left)/n.width,0,1))*this.length}onSeekDown=e=>{if(this.disabled||e.button!==0||e.target.closest("nbplay-clip"))return;e.preventDefault();let t=e.currentTarget;Ge(t,e.pointerId);let n=this.beatAt(e,t);this.emitDetail("nbplay-seek",{beat:n,final:!1});let i=a=>{n=this.beatAt(a,t),this.seekFrame===null&&(this.seekFrame=requestAnimationFrame(()=>{this.seekFrame=null,this.emitDetail("nbplay-seek",{beat:n,final:!1})}))},s=()=>{this.seekFrame!==null&&(cancelAnimationFrame(this.seekFrame),this.seekFrame=null),this.emitDetail("nbplay-seek",{beat:n,final:!0}),t.removeEventListener("pointermove",i),t.removeEventListener("pointerup",s),t.removeEventListener("pointercancel",s)};t.addEventListener("pointermove",i),t.addEventListener("pointerup",s),t.addEventListener("pointercancel",s)};onClipDown(e,t){if(this.disabled||e.button!==0)return;let n=e.currentTarget,s=n.parentElement.getBoundingClientRect().width;if(s<=0)return;let a=e.target,o=a?.closest(".nbplay-clip-handle.start")?"trim-start":a?.closest(".nbplay-clip-handle.end")?"trim-end":"move";e.preventDefault(),e.stopPropagation(),Ge(n,e.pointerId);let l=s/this.length,c=e.clientX,d=e.clientY,p=!1,h={start:t.start,duration:t.duration,offset:t.offset??0},m=b=>{let E=Ht((b.clientX-c)/l,cr),v=t.offset??0;if(o==="move")return{start:Math.max(0,t.start+E),duration:t.duration,offset:v};if(o==="trim-start"){let S=Math.max(-Math.min(v,t.start),Math.min(E,t.duration-Qi));return{start:t.start+S,duration:t.duration-S,offset:v+S}}return{start:t.start,duration:Math.max(Qi,t.duration+E),offset:v}},y=b=>({field:"clip",id:t.id,...h,clientY:b.clientY}),f=b=>{if(!p&&Math.abs(b.clientX-c)<Xi&&Math.abs(b.clientY-d)<Xi)return;p=!0,n.dragging=!0,h=m(b);let E=this.pct(h.start);n.style.left=`${E}%`,n.style.width=`${Math.max(1,Math.min(100-E,this.pct(h.duration)))}%`,this.emitDetail("input",y(b))},$=b=>{n.removeEventListener("pointermove",f),n.removeEventListener("pointerup",$),n.removeEventListener("pointercancel",$),n.dragging=!1,p?this.emitDetail("change",y(b)):this.emitDetail("nbplay-clip-select",{id:t.id})};n.addEventListener("pointermove",f),n.addEventListener("pointerup",$),n.addEventListener("pointercancel",$)}};k("nbplay-lane",Kt);var Ji=6;function jt(r){return`var(--nbplay-palette-${r%Ji+1})`}var Wt=class extends g{static properties={zones:{attribute:!1},selected:{type:Number},emptyText:{type:String,attribute:"empty-text"}};constructor(){super(),this.zones=[],this.selected=-1,this.emptyText="No zones"}render(){let e=Array.from({length:11},(t,n)=>n*12);return u`<div
      class="nbplay-zone-map-track ${this.zones.length?"":"empty"}"
    >
      ${e.map(t=>u`<span
            class="nbplay-zone-map-tick"
            style="left:${t/128*100}%"
            >${R(t)}</span
          >`)}
      ${this.zones.length?this.zones.map((t,n)=>this.renderSpan(t,n)):u`<span class="nbplay-zone-map-empty">${this.emptyText}</span>`}
    </div>`}renderSpan(e,t){let n=Math.min(e.low,e.high),i=Math.max(e.low,e.high),s=n/128*100,a=(i-n+1)/128*100,o=`${e.name??`Zone ${t+1}`}: ${R(n)}\u2013${R(i)}`;return u`<button
      type="button"
      class="nbplay-zone-map-span ${t===this.selected?"selected":""}"
      data-index=${t}
      title=${o}
      style="left:${s}%;width:${a}%;background:${e.color??jt(t)}"
      @click=${()=>this.emitDetail("nbplay-zone-select",{index:t})}
    ></button>`}};k("nbplay-zone-map",Wt);var Zt=class extends g{static properties={zones:{attribute:!1},selected:{type:Number},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.zones=[],this.selected=-1,this.disabled=!1}render(){return u`${this.zones.map((e,t)=>this.renderRow(e,t))}`}renderRow(e,t){let n=s=>s.stopPropagation(),i=(s,a)=>u`<label class="nbplay-zone-list-note">
        <span>${a}</span>
        <nbplay-value
          kind="note"
          .value=${e[s]}
          .min=${0}
          .max=${127}
          .editable=${!this.disabled}
          @input=${n}
          @change=${o=>{o.stopPropagation(),this.commit(t,s,o.detail.value)}}
        ></nbplay-value>
      </label>`;return u`<div
      class="nbplay-zone-list-row ${t===this.selected?"selected":""}"
      data-index=${t}
      @click=${()=>this.emitDetail("nbplay-zone-select",{index:t})}
    >
      <span
        class="nbplay-zone-list-swatch"
        style="background:${e.color??jt(t)}"
      ></span>
      <input
        type="text"
        class="nbplay-zone-list-name"
        title="Zone name"
        .value=${e.name}
        ?disabled=${this.disabled}
        @input=${n}
        @change=${s=>{s.stopPropagation(),this.commit(t,"name",s.target.value)}}
      />
      ${i("low","Low")} ${i("high","High")} ${i("root","Root")}
      <span class="nbplay-zone-list-info">${e.info??""}</span>
      <button
        type="button"
        class="nbplay-zone-list-remove"
        title="Remove zone"
        ?disabled=${this.disabled}
        @click=${s=>{s.stopPropagation(),this.emitDetail("nbplay-zone-remove",{index:t})}}
      >
        ×
      </button>
    </div>`}commit(e,t,n){let i=[...this.zones];i[e]={...i[e],[t]:n},this.zones=i,this.emitDetail("change",{index:e,field:t,value:n})}};k("nbplay-zone-list",Zt);function ur(){let r=globalThis;return(!r.__nbplay||typeof r.__nbplay!="object")&&(r.__nbplay={}),r.__nbplay}function P(r){return r?globalThis.__nbplay?.[r]:void 0}function ue(r){let e=ur();return e[r]||(e[r]={}),e[r]}function Pe(r,e){P(r)?.noteListeners?.forEach(n=>n(e))}function Yt(r,e,t){if(!r||!(e>=0))return;let n=ue(r);n.claims||(n.claims={}),n.claims[e]||(n.claims[e]={}),n.claims[e][t]=!0}function Qt(r,e,t){let n=P(r)?.claims?.[e];n&&delete n[t]}function Xt(r,e){let t=P(r)?.claims?.[e];return t?.launcher?"launcher":t?.timeline?"timeline":void 0}function es(r){if(r.audioCtx&&r.audioCtx.state!=="closed")return r.audioCtx;let e=z();return e&&(r.audioCtx=e),e}function dr(r){return r.clock||(r.clock=ts(r)),r.clock}function se(r,e){let t=Number(r),n=Number(e);return(t>0?t:4)*4/(n>0?n:4)}function Ke(r,e,t){let n=Number(r);return Number.isFinite(n)?Math.max(t,n):e}function ts(r={}){let e=!1,t=!1,n=120,i=!1,s=4,a={enabled:!1,startBeat:0,endBeat:16},o=0,l=0,c=null,d=new Set;function p(){return performance.now()/1e3}function h(v){return v?v.currentTime:p()}function m(v){return e?o+(v-l)*(n/60):o}function y(v){if(!a.enabled||a.endBeat<=a.startBeat||v<a.endBeat)return v;let S=a.endBeat-a.startBeat;return a.startBeat+(v-a.startBeat)%S}function f(v){let S={type:v,beat:E.beat()};d.forEach(T=>{try{T(S)}catch(A){console.warn("nbplay clock listener failed",A)}})}function $(){if(r.audioCtx&&r.audioCtx.state==="closed"&&delete r.audioCtx,!r.audioCtx){let S=z();S&&(r.audioCtx=S)}let v=r.audioCtx||null;if(v!==c){let S=y(m(h(c)));c=v,o=S,l=h(v)}return v}function b(){let v=$(),S=h(v);o=y(m(S)),l=S}let E={get playing(){return e},get recording(){return t},get bpm(){return n},get beatsPerBar(){return s},get loop(){return{...a}},context(){return $()},now(){return h($())},beat(){return E.beatAt(E.now())},beatAt(v){return y(m(v))},ctxTimeAt(v){return $(),l+(v-o)*(60/n)},secondsPerBeat(){return 60/n},play(){if(e)return;let v=$();v&&v.state==="suspended"&&v.resume?.(),l=h(v),e=!0,f("play")},stop(){if(!e)return;let v=E.beat();e=!1,o=v,f("stop")},seek(v){let S=$();o=Ke(v,0,0),l=h(S),f("seek")},setTempo(v){i=!0;let S=Ke(v,n,1);S!==n&&(b(),n=S,f("tempo"))},adoptTempo(v){return i||E.setTempo(v),n},setBeatsPerBar(v){let S=Ke(v,s,.25);S!==s&&(s=S,f("timesig"))},setLoop(v,S,T){let A={enabled:!!v,startBeat:Ke(S,0,0),endBeat:Ke(T,0,0)};A.enabled===a.enabled&&A.startBeat===a.startBeat&&A.endBeat===a.endBeat||(b(),a=A,f("loop"))},setRecording(v){let S=!!v;S!==t&&(t=S,f("record"))},subscribe(v){return d.add(v),()=>{d.delete(v)}}};return E}function pr(r,e,t){let n={},i=null,s=null,a=null;function o(){let c=String(r.get("session_id")||"");return c?dr(ue(c)):(i||(i=ts(n)),i)}function l(c){let d=o();return d===s||(a?.(),s=d,a=d.subscribe(e),c&&t?.(d)),d}return l(!1),r.on("change:session_id",()=>l(!0)),{clock:()=>l(!0),shared:()=>!!r.get("session_id"),dispose(){a?.(),a=null,s=null,n.audioCtx&&n.audioCtx.state!=="closed"&&n.audioCtx.close(),delete n.audioCtx}}}function H(r,e,t){let n=[],s=pr({get:a=>a==="session_id"?r.sessionId:void 0,set:()=>{},save_changes:()=>{},on:(a,o)=>{a==="change:session_id"&&n.push(o)}},e,t);return{clock:s.clock,shared:s.shared,dispose:s.dispose,rebind:()=>n.forEach(a=>a())}}var ns=30,is=300,hr=50,mr=250,Jt=class extends g{static properties={sessionId:{type:String,attribute:"session-id",reflect:!0},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},loopEnabled:{type:Boolean,attribute:"loop-enabled"},loopStartBar:{type:Number,attribute:"loop-start-bar"},loopEndBar:{type:Number,attribute:"loop-end-bar"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},isRecording:{type:Boolean,attribute:"is-recording",reflect:!0},currentBeat:{attribute:!1},barNumber:{attribute:!1},beatInBar:{attribute:!1},undoRequest:{attribute:!1},redoRequest:{attribute:!1}};binding=null;unbindShortcuts=null;tickTimer=null;lastSyncedBeat=0;lastSyncMs=0;constructor(){super(),this.sessionId="",this.bpm=120,this.timeSignatureNum=4,this.timeSignatureDen=4,this.loopEnabled=!1,this.loopStartBar=0,this.loopEndBar=4,this.isPlaying=!1,this.isRecording=!1,this.currentBeat=0,this.barNumber=0,this.beatInBar=0}clock(){if(!this.binding){this.binding=H(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.pushLoop(e),this.pullState(e),e.playing&&this.startTicking(e.beat())}return this.binding.clock()}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-transport"),this.clock(),this.unbindShortcuts=le(this,{Space:()=>this.togglePlay(),"Shift+Space":()=>this.stopAndRewind(),r:()=>this.toggleRecord(),l:()=>this.toggleLoop(),ArrowUp:()=>this.nudgeTempo(1),ArrowDown:()=>this.nudgeTempo(-1),"Shift+ArrowUp":()=>this.nudgeTempo(10),"Shift+ArrowDown":()=>this.nudgeTempo(-10)}),this.addEventListener("keydown",this.onUndoKey)}disconnectedCallback(){super.disconnectedCallback(),this.stopTicking(),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.removeEventListener("keydown",this.onUndoKey),this.binding?.dispose(),this.binding=null}beatsPerBar(){return se(this.timeSignatureNum,this.timeSignatureDen)}pushTempo(e){e.setTempo(Number(this.bpm))}joinTempo(e){let t=e.adoptTempo(Number(this.bpm));t!==Number(this.bpm)&&(this.bpm=t,this.set({bpm:t}))}pushLoop(e){let t=this.beatsPerBar();e.setBeatsPerBar(t),e.setLoop(!!this.loopEnabled,(Number(this.loopStartBar)||0)*t,(Number(this.loopEndBar)||0)*t)}writePosition(e){let t=this.beatsPerBar(),n=Number.isFinite(e)?Math.max(0,e):0;this.currentBeat=n,this.barNumber=Math.floor(n/t),this.beatInBar=Math.floor(n%t)}pullState(e){this.isPlaying=e.playing,this.isRecording=e.recording,this.writePosition(e.beat())}status(e){this.emitDetail("nbplay-status",{values:{isPlaying:this.isPlaying,isRecording:this.isRecording,currentBeat:this.currentBeat,barNumber:this.barNumber,beatInBar:this.beatInBar},save:e})}set(e){this.emitDetail("nbplay-set",{values:e})}tick=()=>{let e=this.clock().beat();this.writePosition(e);let t=performance.now(),n=!1;Math.floor(e)!==Math.floor(this.lastSyncedBeat)&&t-this.lastSyncMs>=mr&&(this.lastSyncedBeat=e,this.lastSyncMs=t,n=!0),this.status(n)};startTicking(e){this.stopTicking(),this.lastSyncedBeat=e,this.lastSyncMs=performance.now(),this.tickTimer=setInterval(this.tick,hr)}stopTicking(){this.tickTimer!==null&&(clearInterval(this.tickTimer),this.tickTimer=null)}onClockEvent=e=>{let t=this.clock();switch(e.type){case"play":this.isPlaying=!0,this.writePosition(e.beat),this.status(!0),this.startTicking(e.beat);break;case"stop":this.stopTicking(),this.isPlaying=!1,this.writePosition(e.beat),this.status(!0);break;case"seek":this.lastSyncedBeat=e.beat,this.writePosition(e.beat),this.status(!0);break;case"tempo":Number(this.bpm)!==t.bpm&&(this.bpm=t.bpm,this.set({bpm:t.bpm}));break;case"record":!!this.isRecording!==t.recording&&(this.isRecording=t.recording,this.status(!0));break;case"loop":{let n=this.beatsPerBar(),i=t.loop,s=Math.round(i.startBeat/n),a=Math.round(i.endBeat/n);(!!this.loopEnabled!==i.enabled||Number(this.loopStartBar)!==s||Number(this.loopEndBar)!==a)&&(this.loopEnabled=i.enabled,this.loopStartBar=s,this.loopEndBar=a,this.set({loopEnabled:i.enabled,loopStartBar:s,loopEndBar:a}));break}case"timesig":break}};onRebind=e=>{this.stopTicking(),this.joinTempo(e),this.pushLoop(e),this.pullState(e),this.status(!0),e.playing&&this.startTicking(e.beat())};updated(e){if(!this.binding)return;if(e.has("sessionId")&&e.get("sessionId")!==void 0){this.binding.rebind();return}let t=this.clock();e.has("bpm")&&Number(this.bpm)!==t.bpm&&this.pushTempo(t),(e.has("timeSignatureNum")||e.has("timeSignatureDen")||e.has("loopEnabled")||e.has("loopStartBar")||e.has("loopEndBar"))&&this.pushLoop(t),(e.has("isPlaying")||e.has("isRecording"))&&(!!this.isPlaying!==t.playing||!!this.isRecording!==t.recording)&&(this.isPlaying=t.playing,this.isRecording=t.recording,this.status(!0))}command(e){let t=this.clock();switch(e.action){case"play":t.playing||t.play();break;case"stop":t.playing&&t.stop();break;case"seek":{let n=Number(e.beat);Number.isFinite(n)&&t.seek(Math.max(0,n));break}case"record":{let n=!!e.on;t.setRecording(n),n&&!t.playing&&t.play();break}}this.pullState(t),this.status(!0)}togglePlay(){let e=this.clock();e.playing?e.stop():e.play()}toggleRecord(){let e=this.clock(),t=!e.recording;e.setRecording(t),t&&e.play()}stopAndRewind(){let e=this.clock();e.stop(),e.setRecording(!1),e.seek(0)}toggleLoop(){this.loopEnabled=!this.loopEnabled,this.set({loopEnabled:this.loopEnabled}),this.pushLoop(this.clock())}nudgeTempo(e){let t=N(Math.round(this.clock().bpm)+e,ns,is);this.clock().setTempo(t)}onUndoKey=e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey)return;let t=e.target;if(t?.tagName==="INPUT"||t?.tagName==="TEXTAREA"||t?.isContentEditable)return;let n=e.key.toLowerCase();if(n!=="z"&&n!=="y")return;e.preventDefault(),e.stopPropagation();let i=n==="y"||e.shiftKey?"redo":"undo";i==="redo"?this.redoRequest=(this.redoRequest||0)+1:this.undoRequest=(this.undoRequest||0)+1,this.emitDetail("nbplay-request",{name:i}),this.emitDetail("nbplay-flush",{})};render(){let e=this.beatsPerBar(),t=i=>i.stopPropagation(),n=i=>{i.stopPropagation(),this.clock().setTempo(i.detail.value)};return u`<nbplay-transport-buttons
        class="nbplay-transport-controls"
        .playing=${this.isPlaying}
        .recording=${this.isRecording}
        @nbplay-play=${i=>{i.stopPropagation(),this.togglePlay()}}
        @nbplay-stop=${i=>{i.stopPropagation(),this.stopAndRewind()}}
        @nbplay-record=${i=>{i.stopPropagation(),this.toggleRecord()}}
      ></nbplay-transport-buttons>
      <nbplay-param
        class="nbplay-transport-tempo"
        label="BPM"
        kind="bpm"
        .value=${this.bpm}
        .min=${ns}
        .max=${is}
        .step=${1}
        .defaultValue=${120}
        @input=${n}
        @change=${n}
      ></nbplay-param>
      <div class="nbplay-transport-timesig">
        <span class="nbplay-transport-timesig-val"
          >${this.timeSignatureNum}/${this.timeSignatureDen}</span
        >
      </div>
      <nbplay-position
        class="nbplay-transport-position"
        .beat=${this.barNumber*e+this.beatInBar}
        .beatsPerBar=${e}
      ></nbplay-position>
      <div class="nbplay-transport-loop">
        <nbplay-toggle
          class="nbplay-transport-loop-btn"
          variant="loop"
          label="↻"
          title="Toggle loop"
          .active=${this.loopEnabled}
          @input=${t}
          @change=${i=>{i.stopPropagation(),this.toggleLoop()}}
        ></nbplay-toggle>
        <span class="nbplay-transport-loop-range"
          >${this.loopStartBar+1} – ${this.loopEndBar}</span
        >
      </div>`}};k("nbplay-transport",Jt);function br(r){let e=r.channel_index||0;if(r.match)return r;let t=r.zone||"all";return t==="upper"||t==="lower"?{channel_index:e,match:"zone",zone:t}:{channel_index:e,match:"all"}}function ss(r,e,t){let n=[];for(let i of r){let s=br(i),a=!1;switch(s.match){case"all":a=!0;break;case"zone":a=s.zone===t;break;case"octave":{a=Math.floor(e/12)-1===s.octave;break}case"note":a=e===s.note;break;case"notes":a=s.notes.includes(e);break}a&&n.push(s.channel_index)}return n}function we(r,e,t,n,i){if(!r||e.length===0)return!1;let s=P(r);if(!s?.samplers)return!1;let a=!1;for(let o of ss(e,t,n)){let l=s.samplers[o];l&&(l.triggerNote(t,i),a=!0)}return a}function Ce(r,e,t,n){if(!r||e.length===0)return!1;let i=P(r);if(!i?.samplers)return!1;let s=!1;for(let a of ss(e,t,n)){let o=i.samplers[a];o&&(o.releaseNote(t),s=!0)}return s}var Y={type:"sine",amplitude:.8,osc2Type:"saw",osc2Level:0,osc2Semitones:0,osc2Detune:0,noiseLevel:0,filterType:"lowpass",cutoff:2e4,resonance:.7,filterEnv:0,filterAttack:.005,filterDecay:.2,filterSustain:0,filterRelease:.2,attack:.005,decay:.1,sustain:1,release:.05,lfoTarget:"off",lfoRate:5,lfoDepth:.5},Zn=.005;function en(r,e,t,n,i,s,a){let o=e+s+a;return r.setValueAtTime(t,e),r.linearRampToValueAtTime(n,e+s),r.linearRampToValueAtTime(i,o),(l,c)=>{let d=r;l>=o?(r.cancelScheduledValues(l),r.setValueAtTime(i,l)):typeof d.cancelAndHoldAtTime=="function"?d.cancelAndHoldAtTime(l):(r.cancelScheduledValues(l),r.setValueAtTime(i,l));let p=l+Math.max(.005,c);return r.linearRampToValueAtTime(t,p),p}}var rs=new WeakMap;function jn(r){let e=rs.get(r);if(!e){e=r.createBuffer(1,r.sampleRate*2,r.sampleRate);let t=e.getChannelData(0);for(let n=0;n<t.length;n++)t[n]=Math.random()*2-1;rs.set(r,e)}return e}function as(r){return r==="saw"?"sawtooth":r==="square"||r==="triangle"?r:"sine"}function fr(r){let e=Math.max(0,Math.min(1,r.lfoDepth));return r.lfoTarget==="pitch"?e*200:r.lfoTarget==="filter"?e*3600:r.lfoTarget==="amplitude"?e/2:0}function je(r,e,t,n,i,s){let a=t.type==="noise"?null:r.createOscillator(),o;if(a)o=a;else{let C=r.createBufferSource();C.buffer=jn(r),C.loop=!0,o=C}let l=r.createOscillator(),c=r.createBufferSource();c.buffer=jn(r),c.loop=!0;let d=r.createOscillator(),p=r.createGain(),h=r.createGain(),m=r.createGain(),y=r.createGain(),f=r.createBiquadFilter(),$=r.createGain(),b=r.createGain(),E=r.createGain();o.connect(p).connect(f),l.connect(h).connect(f),c.connect(m).connect(f),f.connect($).connect(b).connect(E).connect(e),d.connect(y);let v="",S=t,T=(C,O,ne,re)=>{let U=($i,Si)=>{re===null?$i.value=Si:$i.setTargetAtTime(Si,re,.01)};a&&(a.type=as(C.type),U(a.frequency,O)),l.type=as(C.osc2Type),U(l.frequency,O),U(l.detune,C.osc2Semitones*100+C.osc2Detune),U(h.gain,Math.max(0,C.osc2Level)),U(m.gain,Math.max(0,C.noiseLevel)),f.type=["lowpass","highpass","bandpass"].includes(C.filterType)?C.filterType:"lowpass",U(f.frequency,C.cutoff),U(f.Q,C.resonance),U(E.gain,Math.max(0,ne)),U(d.frequency,C.lfoRate);let Se=fr(C);U(y.gain,Se),U(b.gain,C.lfoTarget==="amplitude"?1-Se:1),C.lfoTarget!==v&&(y.disconnect(),C.lfoTarget==="pitch"?(a&&y.connect(a.detune),y.connect(l.detune)):C.lfoTarget==="filter"?y.connect(f.detune):C.lfoTarget==="amplitude"&&y.connect(b.gain),v=C.lfoTarget),S=C};T(t,n,i,null);let A=Math.max(Zn,t.attack),_=en($.gain,s,0,1,Math.max(0,Math.min(1,t.sustain)),A,Math.max(0,t.decay)),j=t.filterEnv*1200,Z=en(f.detune,s,0,j,j*Math.max(0,Math.min(1,t.filterSustain)),Math.max(0,t.filterAttack),Math.max(0,t.filterDecay)),F=[o,l,c,d];for(let C of F)C.start(s);let pe=!1,$e={onended:null,release(C){let O=Math.max(C,s);Z(O,S.filterRelease);let ne=_(O,S.release);for(let re of F)re.stop(ne);return ne},stop(){for(let C of F)try{C.stop(0)}catch{}te()},update(C,O,ne){T(C,O,ne,r.currentTime)}},te=()=>{if(!pe){pe=!0;for(let C of[...F,p,h,m,y,f,$,b,E])try{C.disconnect()}catch{}$e.onended?.()}};return o.onended=te,$e}function Ze(r,e,t,n,i,s,a,o=()=>{}){let l=Math.max(0,Math.min(1,t.amplitude))*(i/127),c=je(r,e,t,Xe(n),l,s);return c.onended=o,c.release(s+Math.max(.001,a)),()=>c.stop()}function Yn(r,e,t,n,i,s,a=()=>{}){let o=Math.max(0,Math.min(1,t.amplitude))*(i/127),l=je(r,e,t,Xe(n),o,s);return l.onended=a,{release:c=>{l.release(c)},stop:()=>l.stop()}}function tn(r,e,t,n){let i=r.createOscillator(),s=r.createOscillator(),a=r.createGain(),o=r.createGain();return i.frequency.value=t,s.frequency.value=t*n.ratio,a.gain.value=n.index*t*n.ratio,s.connect(a),a.connect(i.frequency),i.connect(o),o.connect(e),{carrier:i,modulator:s,depth:a,level:o}}function nn(r){for(let e of[r.modulator,r.depth,r.carrier,r.level])try{e.disconnect()}catch{}}function Ye(r,e,t,n,i,s,a,o=()=>{}){let l=Math.max(0,Math.min(1,t.amplitude))*(i/127),c=tn(r,e,Xe(n),t),d=Math.min(Math.max(0,t.attack),a),p=Math.min(s+d+Math.max(0,t.decay),s+a),h=s+a+Math.max(.005,t.release),m=c.level.gain;m.setValueAtTime(0,s),m.linearRampToValueAtTime(l,s+d),m.linearRampToValueAtTime(l*t.sustain,Math.max(p,s+d)),m.setValueAtTime(l*t.sustain,s+a),m.linearRampToValueAtTime(0,h);let y=!1,f=()=>{y||(y=!0,nn(c),o())};c.carrier.onended=f;for(let $ of[c.modulator,c.carrier])$.start(s),$.stop(h);return()=>{for(let $ of[c.modulator,c.carrier])try{$.stop(0)}catch{}f()}}function Qn(r,e,t,n,i,s,a=()=>{}){let o=Math.max(0,Math.min(1,t.amplitude))*(i/127),l=tn(r,e,Xe(n),t),c=en(l.level.gain,s,0,o,o*t.sustain,Math.max(t.attack,Zn),Math.max(0,t.decay)),d=!1,p=()=>{d||(d=!0,nn(l),a())};l.carrier.onended=p;let h=[l.modulator,l.carrier];h.forEach(y=>y.start(s));let m=y=>h.forEach(f=>{try{f.stop(y)}catch{}});return{release:y=>m(c(y,t.release)),stop:()=>{m(0),p()}}}var Xn=["kick","snare","hat","clap","tom"];function We(r,e,t,n=1){let i=r.createGain();return i.gain.setValueAtTime(0,e),i.gain.linearRampToValueAtTime(n,e+.002),i.gain.exponentialRampToValueAtTime(n*.001,t),i.gain.setValueAtTime(0,t),i}function Jn(r,e,t,n,i,s=()=>{}){let a=2**(Math.max(-48,Math.min(48,t.tune))/12),o=Math.max(.01,t.decay),l=Math.max(0,Math.min(1,t.tone)),c=i+o,d=r.createGain();d.gain.value=Math.max(0,Math.min(127,n))/127,d.connect(e);let p=[],h=[d],m=(v,S,T=.7)=>{let A=r.createBufferSource();A.buffer=jn(r),A.loop=!0;let _=r.createBiquadFilter();return _.type=v,_.frequency.value=Math.min(18e3,S),_.Q.value=T,A.connect(_),p.push(A),h.push(_),_},y=(v,S,T,A)=>{let _=r.createOscillator();return _.type=v,_.frequency.setValueAtTime(S,i),_.frequency.exponentialRampToValueAtTime(T,i+A),p.push(_),_},f=(v,S)=>{v.connect(S).connect(d),h.push(S)};if(t.sound==="kick"||t.sound==="tom"){let v=(t.sound==="kick"?50:110)*a,S=t.sound==="kick"?3.5:1.6;if(f(y("sine",v*S,v,.06),We(r,i,c)),l>0){let T=m(t.sound==="kick"?"highpass":"bandpass",t.sound==="kick"?2e3:800);f(T,We(r,i,i+.03,l*.6))}}else if(t.sound==="snare"){let v=185*a;f(y("triangle",v*1.3,v,.03),We(r,i,i+Math.min(o,.12),1-l*.6)),f(m("highpass",1200*a),We(r,i,c,l))}else if(t.sound==="hat")f(m("highpass",(5e3+7e3*l)*a),We(r,i,c));else if(t.sound==="clap"){let v=m("bandpass",(900+1600*l)*a,2),S=r.createGain();S.gain.setValueAtTime(0,i);for(let A=0;A<3;A++){let _=i+A*.012;S.gain.setValueAtTime(1,_),S.gain.exponentialRampToValueAtTime(.1,_+.01)}let T=i+.036;S.gain.setValueAtTime(1,T),S.gain.exponentialRampToValueAtTime(.001,Math.max(T+.01,c)),S.gain.setValueAtTime(0,Math.max(T+.01,c)),f(v,S)}let $=Math.max(c,i+.05)+.01,b=!1,E=()=>{if(!b){b=!0;for(let v of[...p,...h])try{v.disconnect()}catch{}s()}};for(let v of p)v.start(i),v.stop($);return p.length>0?p[0].onended=E:E(),()=>{for(let v of p)try{v.stop(0)}catch{}E()}}function Qe(r,e,t){let{envelope:n,peak:i,at:s,duration:a,region:o}=t,l=r.createBufferSource();l.buffer=t.buffer,l.playbackRate.value=t.playbackRate,l.loop=t.loop;let c=r.createGain();c.connect(e),l.connect(c);let d=en(c.gain,s,0,i,n.sustain*i,Math.max(n.attack,Zn),n.decay);o?l.start(s,o.offset,o.length):l.start(s);let p=null;return a!==void 0&&(p=s+Math.max(.001,a),l.stop(d(p,n.release)+.01)),{sourceNode:l,gainNode:c,releaseTime:p}}function Xe(r){return 440*Math.pow(2,(r-69)/12)}function Te(){let r="",e=-1,t=null,n=null,i=!1,s=new Map;function a(){let o=r?P(r):void 0;return o?.audioCtx&&e>=0&&o.channels?.[e]?(t!==o.audioCtx&&(i&&t&&t.state!=="closed"&&t.close(),t=o.audioCtx,i=!1),n=o.channels[e].gain):t||(t=z(),i=t!==null,n=null),t?.state==="suspended"&&t.resume(),t}return{setSession(o,l){r=o||"",e=Number.isFinite(l)?l:-1},noteOn(o,l,c){let d=a();if(!d)return;s.has(o)&&this.noteOff(o);let p=d.createOscillator(),h=d.createGain();p.type="sine",p.frequency.value=Xe(o);let m=d.currentTime,y=l/127*(c?1:.3);h.gain.setValueAtTime(0,m),h.gain.linearRampToValueAtTime(y,m+.005),c&&(h.gain.linearRampToValueAtTime(0,m+c),p.stop(m+c+.05)),p.connect(h),h.connect(n||d.destination),p.start(m),s.set(o,{osc:p,gain:h}),c&&setTimeout(()=>{s.get(o)?.osc===p&&s.delete(o)},(c+.1)*1e3)},noteOff(o){let l=s.get(o);if(!l||!t)return;let c=t.currentTime;l.gain.gain.cancelScheduledValues(c),l.gain.gain.setValueAtTime(l.gain.gain.value,c),l.gain.gain.linearRampToValueAtTime(0,c+.05);try{l.osc.stop(c+.06)}catch{}s.delete(o)},stopAll(){for(let o of s.values()){try{o.osc.stop()}catch{}o.gain.disconnect()}s.clear()},destroy(){this.stopAll(),i&&t&&t.state!=="closed"&&t.close(),t=null,n=null,i=!1}}}var vr=.3;function os(r,e){let t=Number(r);return Number.isFinite(t)?Math.max(1,Math.floor(t)):e}function yr(r,e){return r.length===e.length&&r.every((t,n)=>t===e[n])}var sn=class extends g{static properties={rows:{type:Number},cols:{type:Number},velocity:{type:Number},velocitySensitive:{type:Boolean,attribute:"velocity-sensitive"},padNotes:{attribute:!1},padVelocities:{attribute:!1},padActions:{attribute:!1},samplerRouting:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},activePads:{attribute:!1},lastNoteEvent:{attribute:!1},lastPadEvent:{attribute:!1}};voices=Te();held=new Set;heldNotes=new Map;constructor(){super(),this.rows=4,this.cols=4,this.velocity=100,this.velocitySensitive=!0,this.padNotes=Array.from({length:16},(e,t)=>36+t),this.padVelocities=[],this.padActions=[],this.samplerRouting=[],this.sessionId="",this.channelIndex=-1,this.activePads=[],this.lastNoteEvent={},this.lastPadEvent={}}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-pad"),this.voices.setSession(this.sessionId,this.channelIndex)}disconnectedCallback(){super.disconnectedCallback(),this.releaseAll(),this.voices.destroy()}dims(){return{rows:os(this.rows,4),cols:os(this.cols,4)}}notes(){return Array.isArray(this.padNotes)?this.padNotes:[]}effectiveVelocities(){let e=Array.isArray(this.padVelocities)?this.padVelocities:[],t=q(this.velocity);return e.map(n=>n??t)}actions(){let{rows:e,cols:t}=this.dims();return Ne(this.padActions,this.notes(),this.effectiveVelocities(),e*t)}pads(){let e=this.notes(),t=this.effectiveVelocities();return this.actions().map((n,i)=>{let s=t[i]??100;return n.type==="note"&&!n.label?{note:n.note,velocity:s}:{note:e[i]??60,velocity:s,label:pt(n)}})}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.voices.setSession(this.sessionId,this.channelIndex),e.has("velocity")&&e.get("velocity")!==void 0&&this.resetPadVelocities(q(this.velocity))}resetPadVelocities(e){let{rows:t,cols:n}=this.dims(),i=Array.isArray(this.padVelocities)?this.padVelocities:[],s=i.length||t*n,a=Array.from({length:s},()=>e),o=Ne(this.padActions,this.notes(),a,t*n).map(c=>c.type==="note"?{...c,velocity:e}:c),l=!yr(i,a)||JSON.stringify(o)!==JSON.stringify(this.padActions);this.padVelocities=a,this.padActions=o,l&&this.set({padVelocities:a,padActions:o})}set(e){this.emitDetail("nbplay-set",{values:e})}status(){this.activePads=Array.from(this.held),this.emitDetail("nbplay-status",{values:{activePads:this.activePads,lastNoteEvent:this.lastNoteEvent,lastPadEvent:this.lastPadEvent},save:!0})}triggerPad(e,t){let n=this.actions()[e]??{type:"note",note:this.notes()[e]??60};if(this.held.add(e),n.type==="note"){let i=n.note,s=q(t,n.velocity??100);this.heldNotes.set(e,i),we(this.sessionId,this.samplerRouting||[],i,"upper",s)||this.voices.noteOn(i,s,vr),this.lastNoteEvent={note:i,velocity:s,type:"on"},this.lastPadEvent={pad:e,event:"on",velocity:s,action:n}}else n.type==="trait"&&this.set({[n.trait]:n.value}),this.lastPadEvent={pad:e,event:"trigger",velocity:t,action:n};this.status()}releasePad(e){if(!this.held.delete(e))return;let t=this.heldNotes.get(e);this.heldNotes.delete(e);let n=this.actions()[e];t!==void 0&&(Ce(this.sessionId,this.samplerRouting||[],t,"upper")||this.voices.noteOff(t),this.lastNoteEvent={note:t,velocity:0,type:"off"}),n&&(this.lastPadEvent={pad:e,event:"off",velocity:0,action:n}),this.status()}releaseAll(){for(let e of Array.from(this.held))this.releasePad(e)}onPadChange(e){e.stopPropagation();let{index:t,field:n,value:i}=e.detail;if(n==="note"){let s=[...this.notes()];if(t>=s.length)return;s[t]=i,this.padNotes=s,this.set({padNotes:s})}else{let s=[...this.effectiveVelocities()];if(t>=s.length)return;s[t]=i,this.padVelocities=s,this.set({padVelocities:s})}}render(){let{rows:e,cols:t}=this.dims(),n=s=>s.stopPropagation(),i=s=>{s.stopPropagation();let a=q(s.detail.value);a!==this.velocity&&(this.velocity=a,this.set({velocity:a}))};return u`<nbplay-header badge="pads"></nbplay-header>
      <div class="nbplay-pad-controls">
        <nbplay-param
          class="nbplay-pad-velocity"
          label="Velocity"
          kind="int"
          .value=${this.velocity}
          .min=${1}
          .max=${127}
          .step=${1}
          .defaultValue=${100}
          @input=${i}
          @change=${i}
        ></nbplay-param>
        <label class="nbplay-pad-vel-sense-label">
          <input
            type="checkbox"
            class="nbplay-pad-vel-sense-chk"
            .checked=${this.velocitySensitive}
            @input=${n}
            @change=${s=>{s.stopPropagation(),this.velocitySensitive=s.target.checked,this.set({velocitySensitive:this.velocitySensitive})}}
          />
          Vel-Sensitive
        </label>
      </div>
      <nbplay-pad-grid
        .rows=${e}
        .cols=${t}
        .pads=${this.pads()}
        .active=${this.activePads}
        .velocitySensitive=${this.velocitySensitive}
        @nbplay-note-on=${s=>{s.stopPropagation();let{index:a,velocity:o}=s.detail;this.triggerPad(a,o)}}
        @nbplay-note-off=${s=>{s.stopPropagation(),this.releasePad(s.detail.index)}}
        @input=${this.onPadChange}
        @change=${this.onPadChange}
      ></nbplay-pad-grid>
      <div class="nbplay-pad-footer">
        <span class="nbplay-pad-info"
          >${this.held.size} active · ${e}×${t} · vel
          ${this.velocity}</span
        >
      </div>`}};k("nbplay-pads",sn);function Me(r,e){let t=Number(e.split(":",1)[0])||0;return`${Math.max(Date.now(),t+1)}:${r}`}function Ae(r,e){let t=Array.isArray(r)?r.map(String):[];return t.length===0?x:u`<select
    class="nbplay-preset-select"
    aria-label="Load a preset"
    @change=${n=>{n.stopPropagation();let i=n.target,s=i.value;i.value="",s&&e(s)}}
  >
    <option value="" selected>Preset…</option>
    ${t.map(n=>u`<option value=${n}>${n}</option>`)}
  </select>`}var ls=[{value:"sine",label:"Sine"},{value:"triangle",label:"Triangle"},{value:"square",label:"Square"},{value:"saw",label:"Saw"},{value:"noise",label:"Noise"}],gr=ls.filter(({value:r})=>r!=="noise"),kr=[{value:"lowpass",label:"Low pass"},{value:"highpass",label:"High pass"},{value:"bandpass",label:"Band pass"}],$r=[{value:"off",label:"Off"},{value:"pitch",label:"Pitch"},{value:"filter",label:"Filter"},{value:"amplitude",label:"Level"}],Sr=20,Er=8e3,ei=class{ctx=null;voice=null;start(e,t,n){this.stop();let i=z({sampleRate:n});return i?(this.ctx=i,i.state==="suspended"&&i.resume?.(),this.voice=je(i,i.destination,e,t,e.amplitude,i.currentTime),!0):!1}update(e,t){this.voice?.update(e,t,e.amplitude)}stop(){this.voice?.stop(),this.voice=null,this.ctx&&(this.ctx.close(),this.ctx=null)}},rn=class extends g{static properties={oscillatorType:{type:String,attribute:"oscillator-type"},frequency:{type:Number},amplitude:{type:Number},sampleRate:{type:Number,attribute:"sample-rate"},osc2Type:{type:String,attribute:"osc2-type"},osc2Level:{type:Number,attribute:"osc2-level"},osc2Semitones:{type:Number,attribute:"osc2-semitones"},osc2Detune:{type:Number,attribute:"osc2-detune"},noiseLevel:{type:Number,attribute:"noise-level"},filterType:{type:String,attribute:"filter-type"},cutoff:{type:Number},resonance:{type:Number},filterEnv:{type:Number,attribute:"filter-env"},filterAttack:{type:Number,attribute:"filter-attack"},filterDecay:{type:Number,attribute:"filter-decay"},filterSustain:{type:Number,attribute:"filter-sustain"},filterRelease:{type:Number,attribute:"filter-release"},attack:{type:Number},decay:{type:Number},sustain:{type:Number},release:{type:Number},lfoTarget:{type:String,attribute:"lfo-target"},lfoRate:{type:Number,attribute:"lfo-rate"},lfoDepth:{type:Number,attribute:"lfo-depth"},waveform:{attribute:!1},presetNames:{attribute:!1},presetRequest:{type:String,attribute:"preset-request"},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0}};tone=new ei;registration=null;liveNotes=new Set;constructor(){super();let{type:e,...t}=Y;Object.assign(this,t),this.oscillatorType=e,this.frequency=440,this.amplitude=.5,this.sampleRate=44100,this.waveform=null,this.presetNames=[],this.presetRequest="",this.sessionId="",this.channelIndex=-1,this.isPlaying=!1}patch(){let e=(n,i)=>{let s=Number(n);return Number.isFinite(s)?s:i},t={...Y};for(let n of Object.keys(Y)){if(n==="type")continue;let i=this[n];t[n]=typeof Y[n]=="number"?e(i,Y[n]):String(i??Y[n])}return t.type=this.oscillatorType||"sine",t}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-synth"),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.register()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.unregister(),this.tone.stop()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.register(),e.has("isPlaying")&&e.get("isPlaying")!==void 0?this.isPlaying?this.startTone():this.tone.stop():this.isPlaying&&(e.has("oscillatorType")?this.startTone():this.tone.update(this.patch(),Number(this.frequency)))}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.register()};unregister(){if(this.liveNotes.forEach(i=>i()),this.liveNotes.clear(),!this.registration)return;let{bus:e,idx:t,entry:n}=this.registration;e.instruments?.[t]===n&&delete e.instruments[t],this.registration=null}register(){let e=this.sessionId,t=Number(this.channelIndex);if(this.unregister(),!e||!(t>=0))return;let n=P(e);if(!n)return;let i=n.instruments||{};n.instruments=i;let s={scheduleNote:(a,o,l,c)=>{let d=n.audioCtx,p=n.channels?.[t]?.gain||n.masterGain;if(!d||!p)return;let h=Ze(d,p,this.patch(),a,o,l,c,()=>this.liveNotes.delete(h));return this.liveNotes.add(h),h},startNote:(a,o,l)=>{let c=n.audioCtx,d=n.channels?.[t]?.gain||n.masterGain;if(!c||!d)return;let p=Yn(c,d,this.patch(),a,o,l??c.currentTime,()=>this.liveNotes.delete(p.stop));return this.liveNotes.add(p.stop),h=>p.release(h??c.currentTime)}};i[t]=s,this.registration={bus:n,idx:t,entry:s}}startTone(){this.tone.start(this.patch(),Number(this.frequency),Number(this.sampleRate))||(this.isPlaying=!1,this.status())}stop(){this.isPlaying&&(this.isPlaying=!1,this.tone.stop(),this.status())}status(){this.emitDetail("nbplay-status",{values:{isPlaying:this.isPlaying},save:!0})}set(e){this.emitDetail("nbplay-set",{values:e})}choice(e,t,n,i){return u`<nbplay-segmented
      class=${e}
      label=${t}
      .options=${i}
      .value=${this[n]}
      @change=${s=>{s.stopPropagation();let a=s.detail.value;a!==this[n]&&(this[n]=a,this.set({[n]:a}))}}
    ></nbplay-segmented>`}param(e,t,n,i,s,a,o,l,c={}){let d=p=>{p.stopPropagation();let h=p.detail.value;h!==this[n]&&(this[n]=h,this.set({[n]:h}))};return u`<nbplay-param
      class=${e}
      .label=${t}
      .kind=${i}
      .control=${c.control??"slider"}
      .scale=${c.scale??"linear"}
      .unit=${c.unit??""}
      .value=${Number(this[n])}
      .min=${s}
      .max=${a}
      .step=${o}
      .defaultValue=${l}
      .precision=${c.precision??2}
      .disabled=${c.disabled??!1}
      @input=${d}
      @change=${d}
    ></nbplay-param>`}envelopeSection(e,t,n,i){let[s,a,o,l]=n;return u`<div class="nbplay-synth-envelope ${e}">
      <span class="nbplay-synth-section-title">${t}</span>
      <nbplay-envelope
        .attack=${Number(this[s])}
        .decay=${Number(this[a])}
        .sustain=${Number(this[o])}
        .release=${Number(this[l])}
      ></nbplay-envelope>
      <div class="nbplay-synth-env-controls">
        ${this.param(`${e}-attack`,"Attack",s,"seconds",0,2,.001,i[0],{control:"dial"})}
        ${this.param(`${e}-decay`,"Decay",a,"seconds",0,2,.001,i[1],{control:"dial"})}
        ${this.param(`${e}-sustain`,"Sustain",o,"percent",0,1,.01,i[2],{control:"dial"})}
        ${this.param(`${e}-release`,"Release",l,"seconds",0,5,.001,i[3],{control:"dial"})}
      </div>
    </div>`}requestPreset(e){this.presetRequest=Me(e,this.presetRequest),this.emitDetail("nbplay-status",{values:{presetRequest:this.presetRequest},save:!0})}render(){let e=this.oscillatorType==="noise",t=Y;return u`<nbplay-header badge="synth"
        >${Ae(this.presetNames,n=>{this.requestPreset(n)})}</nbplay-header
      >
      <nbplay-waveform
        class="nbplay-synth-waveform"
        variant="glow"
        .data=${W(this.waveform)}
      ></nbplay-waveform>
      ${this.choice("nbplay-osc","Oscillator","oscillatorType",ls)}
      <div class="nbplay-synth-params">
        ${this.param("nbplay-freq","Frequency","frequency","hz",Sr,Er,.1,440,{scale:"log",disabled:e})}
        ${this.param("nbplay-amp","Amplitude","amplitude","float",0,1,.01,.8)}
      </div>
      <div class="nbplay-synth-section nbplay-synth-osc2">
        <span class="nbplay-synth-section-title">Oscillator 2</span>
        ${this.choice("nbplay-osc2","Wave","osc2Type",gr)}
        <div class="nbplay-synth-params">
          ${this.param("nbplay-osc2-level","Level","osc2Level","percent",0,1,.01,t.osc2Level)}
          ${this.param("nbplay-osc2-semitones","Semitones","osc2Semitones","int",-24,24,1,t.osc2Semitones,{unit:" st"})}
          ${this.param("nbplay-osc2-detune","Detune","osc2Detune","int",-100,100,1,t.osc2Detune,{unit:" ct"})}
          ${this.param("nbplay-noise-level","Noise","noiseLevel","percent",0,1,.01,t.noiseLevel)}
        </div>
      </div>
      <div class="nbplay-synth-section nbplay-synth-filter">
        <span class="nbplay-synth-section-title">Filter</span>
        ${this.choice("nbplay-filter-type","Type","filterType",kr)}
        <div class="nbplay-synth-params">
          ${this.param("nbplay-cutoff","Cutoff","cutoff","hz",20,2e4,1,t.cutoff,{scale:"log"})}
          ${this.param("nbplay-resonance","Resonance","resonance","float",.1,20,.01,t.resonance)}
          ${this.param("nbplay-filter-env","Envelope","filterEnv","float",-6,6,.1,t.filterEnv,{unit:" oct",precision:1})}
        </div>
      </div>
      ${this.envelopeSection("nbplay-filter-envelope","Filter envelope",["filterAttack","filterDecay","filterSustain","filterRelease"],[t.filterAttack,t.filterDecay,t.filterSustain,t.filterRelease])}
      ${this.envelopeSection("nbplay-amp-envelope","Amplitude envelope",["attack","decay","sustain","release"],[t.attack,t.decay,t.sustain,t.release])}
      <div class="nbplay-synth-section nbplay-synth-lfo">
        <span class="nbplay-synth-section-title">LFO</span>
        ${this.choice("nbplay-lfo-target","Target","lfoTarget",$r)}
        <div class="nbplay-synth-params">
          ${this.param("nbplay-lfo-rate","Rate","lfoRate","hz",.05,20,.01,t.lfoRate,{scale:"log"})}
          ${this.param("nbplay-lfo-depth","Depth","lfoDepth","percent",0,1,.01,t.lfoDepth)}
        </div>
      </div>
      <div class="nbplay-synth-transport">
        <button
          type="button"
          class="nbplay-play-btn ${this.isPlaying?"playing":""}"
          @click=${()=>{this.isPlaying=!this.isPlaying,this.status()}}
        >
          ${this.isPlaying?"\u25A0  Stop":"\u25B6  Play"}
        </button>
        <span class="nbplay-info">${this.sampleRate} Hz</span>
      </div>`}};k("nbplay-synth",rn);var cs=[256,512,1024,2048,4096,8192,16384];function xr(r,e){let t=Math.log(e.maxFrequency/e.minFrequency);return Math.log(r/e.minFrequency)/t*e.width}function us(r,e,t){let n=e/2/r.length,i=t.maxFrequency/t.minFrequency,s=l=>t.minFrequency*i**(l/t.width),a=l=>r[Math.max(0,Math.min(r.length-1,l))],o=[];for(let l=0;l<t.width;l++){let c=s(l)/n,d=s(l+1)/n,p;if(Math.floor(d)>Math.floor(c)){p=-1/0;for(let m=Math.ceil(c);m<=Math.floor(d);m++)p=Math.max(p,a(m))}else{let m=Math.floor(c);p=a(m)+(a(m+1)-a(m))*(c-m)}let h=(p-t.minDb)/(t.maxDb-t.minDb);o.push(t.height*(1-Math.max(0,Math.min(1,h))))}return o}function ds(r,e,t){let n=e/2/r.length,i=-1;for(let s=1;s<r.length;s++){let a=s*n;a<t.minFrequency||a>t.maxFrequency||(i<0||r[s]>r[i])&&(i=s)}return i<0||!(r[i]>t.minDb)?null:{frequency:i*n,db:r[i]}}function Nr(r){return r>=1e3?`${(r/1e3).toFixed(r>=1e4?1:2)} kHz`:`${Math.round(r)} Hz`}var an=class extends g{static properties={fftSize:{type:Number,attribute:"fft-size"},smoothing:{type:Number},minDb:{type:Number,attribute:"min-db"},maxDb:{type:Number,attribute:"max-db"},minFrequency:{type:Number,attribute:"min-frequency"},maxFrequency:{type:Number,attribute:"max-frequency"},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},peak:{state:!0}};tapped=null;bins=new Float32Array(0);frame=0;observer;constructor(){super(),this.fftSize=2048,this.smoothing=.8,this.minDb=-100,this.maxDb=-20,this.minFrequency=20,this.maxFrequency=2e4,this.sessionId="",this.channelIndex=-1,this.peak=null}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-spectrum"),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.tap()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.observer?.disconnect(),this.observer=void 0,this.untap()}firstUpdated(){this.observer=new ResizeObserver(()=>this.draw()),this.observer.observe(this)}updated(e){e.has("sessionId")||e.has("channelIndex")?this.tap():(e.has("fftSize")||e.has("smoothing"))&&this.configure(),e.has("peak")||this.draw()}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.tap()};tap(){this.untap();let e=this.sessionId?P(this.sessionId):void 0,t=Number(this.channelIndex),n=t>=0?e?.channels?.[t]?.analyser:e?.masterAnalyser;if(!e?.audioCtx?.createAnalyser||!n)return;let i=e.audioCtx.createAnalyser();n.connect(i),this.tapped={source:n,analyser:i},this.configure(),this.frame=requestAnimationFrame(this.tick)}untap(){if(cancelAnimationFrame(this.frame),!!this.tapped){try{this.tapped.source.disconnect(this.tapped.analyser)}catch{}this.tapped=null,this.peak=null}}configure(){if(!this.tapped)return;let{analyser:e}=this.tapped;e.fftSize=cs.includes(this.fftSize)?this.fftSize:2048,e.smoothingTimeConstant=Math.max(0,Math.min(.99,Number(this.smoothing)||0)),this.bins=new Float32Array(e.frequencyBinCount)}tick=()=>{this.draw(),this.frame=requestAnimationFrame(this.tick)};scale(e,t){return{width:e,height:t,minDb:this.minDb,maxDb:this.maxDb,minFrequency:this.minFrequency,maxFrequency:this.maxFrequency}}draw(){let e=this.querySelector("canvas");if(!e)return;let t=e.clientWidth,n=e.clientHeight;if(t===0||n===0)return;let i=window.devicePixelRatio||1;e.width!==Math.round(t*i)&&(e.width=Math.round(t*i)),e.height!==Math.round(n*i)&&(e.height=Math.round(n*i));let s=e.getContext("2d");if(!s)return;s.setTransform(i,0,0,i,0,0);let a=this.scale(t,n);s.fillStyle=V(this,"--nbplay-chart-bg","#121214"),s.fillRect(0,0,t,n),s.strokeStyle=V(this,"--nbplay-chart-grid","#2f2f36"),s.fillStyle=V(this,"--nbplay-fg-muted","#a8a59c"),s.font="10px "+V(this,"--nbplay-font-mono","monospace"),s.lineWidth=1,s.setLineDash([3,4]),s.textBaseline="top";for(let h of[100,1e3,1e4]){if(h<=this.minFrequency||h>=this.maxFrequency)continue;let m=Math.round(xr(h,a))+.5;s.beginPath(),s.moveTo(m,0),s.lineTo(m,n),s.stroke(),s.fillText(h>=1e3?`${h/1e3}k`:`${h}`,m+3,2)}s.textBaseline="bottom";for(let h=Math.ceil(this.minDb/20)*20;h<this.maxDb;h+=20){if(h<=this.minDb)continue;let m=Math.round(n*(1-(h-this.minDb)/(this.maxDb-this.minDb)))+.5;s.beginPath(),s.moveTo(0,m),s.lineTo(t,m),s.stroke(),s.fillText(`${h} dB`,3,m-1)}if(s.setLineDash([]),!this.tapped||this.bins.length===0)return;let{analyser:o}=this.tapped;o.getFloatFrequencyData(this.bins);let l=o.context.sampleRate,c=us(this.bins,l,a),d=V(this,"--nbplay-chart-line","#f28c38");s.beginPath(),s.moveTo(0,n),c.forEach((h,m)=>s.lineTo(m,h)),s.lineTo(t,n),s.closePath(),s.globalAlpha=.25,s.fillStyle=d,s.fill(),s.globalAlpha=1,s.beginPath(),c.forEach((h,m)=>m===0?s.moveTo(m,h):s.lineTo(m,h)),s.strokeStyle=d,s.lineWidth=1.5,s.lineJoin="round",s.stroke();let p=ds(this.bins,l,a);(Math.round(p?.frequency??-1)!==Math.round(this.peak?.frequency??-1)||Math.round((p?.db??0)*10)!==Math.round((this.peak?.db??0)*10))&&(this.peak=p)}render(){let e=Number(this.channelIndex)>=0?`Channel ${Number(this.channelIndex)+1}`:"Master";return u`<nbplay-header badge="spectrum"></nbplay-header>
      <canvas class="nbplay-spectrum-canvas"></canvas>
      <div class="nbplay-spectrum-info">
        <span class="nbplay-spectrum-source">${e}</span>
        <span class="nbplay-spectrum-peak"
          >${this.peak?`${Nr(this.peak.frequency)}  ${this.peak.db.toFixed(1)} dB`:"\u2014"}</span
        >
        <label class="nbplay-spectrum-fft">
          FFT
          <select
            @change=${t=>{this.fftSize=Number(t.target.value),this.emitDetail("nbplay-set",{values:{fftSize:this.fftSize}})}}
          >
            ${cs.map(t=>u`<option value=${t} ?selected=${t===this.fftSize}>
                  ${t}
                </option>`)}
          </select>
        </label>
      </div>`}};k("nbplay-spectrum",an);var Pr=-1,wr=8,Cr=80;function ps(r,e){(r?P(r):void 0)?.noteListeners?.forEach(n=>n(e)),document.dispatchEvent(new CustomEvent("nbplay-note",{detail:e}))}var on=class extends g{static properties={upperOctave:{type:Number,attribute:"upper-octave"},lowerOctave:{type:Number,attribute:"lower-octave"},velocity:{type:Number},sustainUpper:{type:Boolean,attribute:"sustain-upper"},sustainLower:{type:Boolean,attribute:"sustain-lower"},sustainGlobal:{type:Boolean,attribute:"sustain-global"},samplerRouting:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},activeNotes:{attribute:!1},lastNoteEvent:{attribute:!1}};voices=Te();heldNotes=new Set;sustainedNotes=new Map;pressedKeys=new Map;velRepeatTimer=null;velRepeatCount=0;constructor(){super(),this.upperOctave=3,this.lowerOctave=4,this.velocity=100,this.sustainUpper=!1,this.sustainLower=!1,this.sustainGlobal=!1,this.samplerRouting=[],this.sessionId="",this.channelIndex=-1,this.activeNotes=[],this.lastNoteEvent={}}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-keyboard"),this.tabIndex=0,this.voices.setSession(this.sessionId,this.channelIndex),window.addEventListener("keydown",this.onKeyDown,!0),window.addEventListener("keyup",this.onKeyUp,!0),this.addEventListener("click",this.focusSelf),this.addEventListener("blur",this.onBlur)}disconnectedCallback(){super.disconnectedCallback(),this.stopVelRepeat(),window.removeEventListener("keydown",this.onKeyDown,!0),window.removeEventListener("keyup",this.onKeyUp,!0),this.removeEventListener("click",this.focusSelf),this.removeEventListener("blur",this.onBlur),this.voices.destroy()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.voices.setSession(this.sessionId,this.channelIndex)}focusSelf=()=>this.focus();set(e){this.emitDetail("nbplay-set",{values:e})}status(){this.activeNotes=Array.from(this.heldNotes),this.emitDetail("nbplay-status",{values:{activeNotes:this.activeNotes,lastNoteEvent:this.lastNoteEvent},save:!0})}noteOn(e,t){if(e<0||e>127)return;let n=this.velocity;this.heldNotes.add(e),we(this.sessionId,this.samplerRouting||[],e,t,n)||this.voices.noteOn(e,n),ps(this.sessionId,{note:e,velocity:n,type:"on"}),this.lastNoteEvent={note:e,velocity:n,type:"on"},this.status()}noteOff(e,t){if(this.heldNotes.delete(e),this.sustainGlobal||t==="upper"&&this.sustainUpper||t==="lower"&&this.sustainLower){this.sustainedNotes.set(e,t),this.requestUpdate();return}this.release(e,t)}release(e,t){Ce(this.sessionId,this.samplerRouting||[],e,t)||this.voices.noteOff(e),ps(this.sessionId,{note:e,velocity:0,type:"off"}),this.lastNoteEvent={note:e,velocity:0,type:"off"},this.sustainedNotes.delete(e),this.status()}releaseSustained(e){for(let[t,n]of Array.from(this.sustainedNotes))(e==="all"||n===e)&&!this.heldNotes.has(t)&&this.release(t,n)}releaseZoneKeys(e){for(let[t,n]of Array.from(this.pressedKeys))n.zone===e&&(this.pressedKeys.delete(t),this.noteOff(n.note,n.zone))}silence(){for(let e of this.pressedKeys.values())this.noteOff(e.note,e.zone);this.pressedKeys.clear();for(let[e,t]of Array.from(this.sustainedNotes))this.release(e,t);this.heldNotes.clear(),this.querySelector("nbplay-key-rows")?.releaseAll(),this.voices.stopAll(),this.status()}onBlur=()=>{for(let e of this.pressedKeys.values())this.noteOff(e.note,e.zone);this.pressedKeys.clear();for(let[e,t]of Array.from(this.sustainedNotes))this.release(e,t);this.heldNotes.clear(),this.status()};nudgeVelocity(e){let t=N(this.velocity+e,0,127);t!==this.velocity&&(this.velocity=t,this.set({velocity:t}))}startVelRepeat(e){this.velRepeatTimer||(this.velRepeatCount=0,this.velRepeatTimer=setInterval(()=>{this.velRepeatCount++,this.nudgeVelocity(e*(this.velRepeatCount>10?5:1))},Cr))}stopVelRepeat(){this.velRepeatTimer&&(clearInterval(this.velRepeatTimer),this.velRepeatTimer=null,this.velRepeatCount=0)}isActive(){let e=document.activeElement;if(!e)return!1;let t=e.tagName;if(t==="INPUT"||t==="TEXTAREA"||e.isContentEditable)return!1;if(e===this||this.contains(e))return!0;let n=e.closest(".nbplay-sequencer");return!!(n&&(n.querySelector(".nbplay-step-grid-cell.pending")||n.querySelector(".nbplay-seq-rec.recording")))}shiftOctave(e,t){this.releaseZoneKeys(e);let n=e==="upper"?"upperOctave":"lowerOctave",i=N(this[n]+t,Pr,wr);this[n]=i,this.set({[n]:i})}setSustain(e,t){this[e]=t,this.set({[e]:t})}onKeyDown=e=>{if(!this.isActive())return;let t=e.key,n=t.toLowerCase(),i=()=>{e.preventDefault(),e.stopPropagation()};if(t==="Escape"){let a=document.activeElement;a?.classList.contains("nbplay-sequencer")&&a.querySelector(".nbplay-seq-key-wait")&&(i(),a.dispatchEvent(new CustomEvent("nbplay-cancel-edit")));return}if(this.pressedKeys.has(n)){i();return}switch(t){case"[":i(),this.shiftOctave("upper",-1);return;case"]":i(),this.shiftOctave("upper",1);return;case";":i(),this.shiftOctave("lower",-1);return;case"'":i(),this.shiftOctave("lower",1);return;case"-":i(),this.nudgeVelocity(-1),this.startVelRepeat(-1);return;case"=":i(),this.nudgeVelocity(1),this.startVelRepeat(1);return;case"`":i(),this.setSustain("sustainUpper",!0);return;case"/":i(),this.setSustain("sustainLower",!0);return;case" ":i(),this.setSustain("sustainGlobal",!0);return}let s=Gn(n,this.upperOctave,this.lowerOctave);s&&(i(),this.pressedKeys.set(n,s),this.noteOn(s.note,s.zone))};onKeyUp=e=>{let t=e.key,n=t.toLowerCase(),i=this.pressedKeys.get(n);if(!this.isActive()){i&&(this.pressedKeys.delete(n),this.noteOff(i.note,i.zone));return}this.pressedKeys.delete(n);let s=()=>{e.preventDefault(),e.stopPropagation()};switch(t){case"-":case"=":s(),this.stopVelRepeat();return;case"`":s(),this.setSustain("sustainUpper",!1),this.releaseSustained("upper");return;case"/":s(),this.setSustain("sustainLower",!1),this.releaseSustained("lower");return;case" ":s(),this.setSustain("sustainGlobal",!1),this.releaseSustained("all");return}i&&(s(),this.noteOff(i.note,i.zone))};render(){let e=[...this.heldNotes,...this.sustainedNotes.keys()];return u`<nbplay-header badge="keyboard"></nbplay-header>
      <div class="nbplay-kb-info">
        <span class="nbplay-kb-oct-upper">Oct ${this.upperOctave}</span>
        <span class="nbplay-kb-vel">Vel: ${this.velocity}</span>
        <span class="nbplay-kb-oct-lower">Oct ${this.lowerOctave}</span>
      </div>
      <nbplay-bar
        class="nbplay-kb-vel-bar"
        orientation="horizontal"
        .value=${this.velocity}
        .min=${0}
        .max=${127}
      ></nbplay-bar>
      <div class="nbplay-kb-sustain-row">
        <span
          class="nbplay-kb-sustain-upper ${this.sustainUpper?"active":""}"
          title="Upper sustain (\`)"
          >SUS ↑</span
        >
        <span
          class="nbplay-kb-sustain-global ${this.sustainGlobal?"active":""}"
          title="Global sustain (Space)"
          >SUS</span
        >
        <span
          class="nbplay-kb-sustain-lower ${this.sustainLower?"active":""}"
          title="Lower sustain (/)"
          >SUS ↓</span
        >
      </div>
      <nbplay-key-rows
        layout="rows"
        .upperOctave=${this.upperOctave}
        .lowerOctave=${this.lowerOctave}
        .velocity=${this.velocity}
        .pressed=${e}
        @pointerdown=${this.focusSelf}
        @nbplay-note-on=${t=>{t.stopPropagation();let{note:n,zone:i}=t.detail;this.noteOn(n,i)}}
        @nbplay-note-off=${t=>{t.stopPropagation();let{note:n,zone:i}=t.detail;this.noteOff(n,i)}}
      ></nbplay-key-rows>
      <div class="nbplay-kb-controls">
        <span class="nbplay-kb-ctrl-label">[ ] oct↑</span>
        <span class="nbplay-kb-ctrl-label">; ' oct↓</span>
        <span class="nbplay-kb-ctrl-label">- = vel</span>
        <span class="nbplay-kb-ctrl-label">\` sus↑</span>
        <span class="nbplay-kb-ctrl-label">/ sus↓</span>
        <span class="nbplay-kb-ctrl-label">⎵ sus all</span>
      </div>`}};k("nbplay-keyboard",on);function hs(r,e=600){let t=new Float32Array(e);for(let n=0;n<e;n++){let i=n/e*3*2*Math.PI;t[n]=r.amplitude*Math.sin(i+r.index*Math.sin(i*r.ratio))}return t}var ti=class{ctx=null;voice=null;start(e,t){this.stop();let n=z();return n?(this.ctx=n,n.state==="suspended"&&n.resume?.(),this.voice=tn(n,n.destination,e,t),this.voice.level.gain.value=t.amplitude,this.voice.modulator.start(),this.voice.carrier.start(),!0):!1}update(e,t){if(!this.voice||!this.ctx)return;let n=this.ctx.currentTime,{carrier:i,modulator:s,depth:a,level:o}=this.voice;i.frequency.setTargetAtTime(e,n,.01),s.frequency.setTargetAtTime(e*t.ratio,n,.01),a.gain.setTargetAtTime(t.index*e*t.ratio,n,.01),o.gain.setTargetAtTime(t.amplitude,n,.01)}stop(){if(this.voice){for(let e of[this.voice.modulator,this.voice.carrier])try{e.stop()}catch{}nn(this.voice),this.voice=null}this.ctx&&(this.ctx.close(),this.ctx=null)}},ln=class extends g{static properties={frequency:{type:Number},amplitude:{type:Number},ratio:{type:Number},index:{type:Number},attack:{type:Number},decay:{type:Number},sustain:{type:Number},release:{type:Number},presetNames:{attribute:!1},presetRequest:{type:String,attribute:"preset-request"},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0}};tone=new ti;registration=null;liveNotes=new Set;constructor(){super(),this.frequency=440,this.amplitude=.5,this.ratio=2,this.index=2,this.attack=.005,this.decay=.2,this.sustain=.6,this.release=.2,this.presetNames=[],this.presetRequest="",this.sessionId="",this.channelIndex=-1,this.isPlaying=!1}patch(){return{amplitude:Number(this.amplitude)||0,ratio:Number(this.ratio)||0,index:Number(this.index)||0,attack:Number(this.attack)||0,decay:Number(this.decay)||0,sustain:Number(this.sustain)||0,release:Number(this.release)||0}}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-fm-synth"),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.register()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.unregister(),this.tone.stop()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.register(),e.has("isPlaying")&&e.get("isPlaying")!==void 0?this.isPlaying?this.startTone():this.tone.stop():this.isPlaying&&this.tone.update(this.frequency,this.patch())}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.register()};unregister(){if(this.liveNotes.forEach(i=>i()),this.liveNotes.clear(),!this.registration)return;let{bus:e,idx:t,entry:n}=this.registration;e.instruments?.[t]===n&&delete e.instruments[t],this.registration=null}register(){let e=this.sessionId,t=Number(this.channelIndex);if(this.unregister(),!e||!(t>=0))return;let n=P(e);if(!n)return;let i=n.instruments||{};n.instruments=i;let s={scheduleNote:(a,o,l,c)=>{let d=n.audioCtx,p=n.channels?.[t]?.gain||n.masterGain;if(!d||!p)return;let h=Ye(d,p,this.patch(),a,o,l,c,()=>this.liveNotes.delete(h));return this.liveNotes.add(h),h},startNote:(a,o,l)=>{let c=n.audioCtx,d=n.channels?.[t]?.gain||n.masterGain;if(!c||!d)return;let p=Qn(c,d,this.patch(),a,o,l??c.currentTime,()=>this.liveNotes.delete(p.stop));return this.liveNotes.add(p.stop),h=>p.release(h??c.currentTime)}};i[t]=s,this.registration={bus:n,idx:t,entry:s}}startTone(){this.tone.start(this.frequency,this.patch())||(this.isPlaying=!1,this.status())}stop(){this.isPlaying&&(this.isPlaying=!1,this.tone.stop(),this.status())}status(){this.emitDetail("nbplay-status",{values:{isPlaying:this.isPlaying},save:!0})}param(e,t,n,i,s,a,o,l,c="slider",d="linear"){let p=h=>{h.stopPropagation();let m=h.detail.value;m!==this[n]&&(this[n]=m,this.emitDetail("nbplay-set",{values:{[n]:m}}))};return u`<nbplay-param
      class=${e}
      .label=${t}
      .kind=${i}
      .control=${c}
      .scale=${d}
      .value=${Number(this[n])}
      .min=${s}
      .max=${a}
      .step=${o}
      .defaultValue=${l}
      .precision=${2}
      @input=${p}
      @change=${p}
    ></nbplay-param>`}requestPreset(e){this.presetRequest=Me(e,this.presetRequest),this.emitDetail("nbplay-status",{values:{presetRequest:this.presetRequest},save:!0})}render(){return u`<nbplay-header badge="fm synth"
        >${Ae(this.presetNames,e=>{this.requestPreset(e)})}</nbplay-header
      >
      <nbplay-waveform
        class="nbplay-fm-waveform"
        variant="glow"
        .data=${hs(this.patch())}
      ></nbplay-waveform>
      <div class="nbplay-fm-params">
        ${this.param("nbplay-fm-frequency","Frequency","frequency","hz",20,8e3,.1,440,"slider","log")}
        ${this.param("nbplay-fm-amplitude","Amplitude","amplitude","float",0,1,.01,.5)}
        ${this.param("nbplay-fm-ratio","Ratio","ratio","float",.25,16,.01,2)}
        ${this.param("nbplay-fm-index","Index","index","float",0,20,.01,2)}
      </div>
      <div class="nbplay-fm-envelope">
        <nbplay-envelope
          class="nbplay-fm-env-canvas"
          .attack=${Number(this.attack)}
          .decay=${Number(this.decay)}
          .sustain=${Number(this.sustain)}
          .release=${Number(this.release)}
        ></nbplay-envelope>
        <div class="nbplay-fm-env-controls">
          ${this.param("nbplay-fm-attack","Attack","attack","seconds",0,2,.001,.005,"dial")}
          ${this.param("nbplay-fm-decay","Decay","decay","seconds",0,2,.001,.2,"dial")}
          ${this.param("nbplay-fm-sustain","Sustain","sustain","percent",0,1,.01,.6,"dial")}
          ${this.param("nbplay-fm-release","Release","release","seconds",0,5,.001,.2,"dial")}
        </div>
      </div>
      <div class="nbplay-fm-transport">
        <button
          type="button"
          class="nbplay-play-btn ${this.isPlaying?"playing":""}"
          @click=${()=>{this.isPlaying=!this.isPlaying,this.status()}}
        >
          ${this.isPlaying?"\u25A0  Stop":"\u25B6  Play"}
        </button>
      </div>`}};k("nbplay-fm-synth",ln);function cn(r){return{id:r.id,name:r.name||"(unnamed)",state:r.state}}function de(){let r=null,e=null,t=null;return{async requestAccess(){if(r)return r;if(!navigator.requestMIDIAccess)return null;try{return r=await navigator.requestMIDIAccess({sysex:!1}),r}catch{return null}},inputs(){let n=[];return r?.inputs.forEach(i=>n.push(cn(i))),n},outputs(){let n=[];return r?.outputs.forEach(i=>n.push(cn(i))),n},connectInput(n,i){this.disconnectInput();let s=r?.inputs.get(n);return s?(t=a=>i(a.data,a.timeStamp||performance.now()),s.addEventListener("midimessage",t),e=s,cn(s)):null},disconnectInput(){e&&t&&e.removeEventListener("midimessage",t),e=null,t=null},activeInputId(){return e?e.id:null},listenAll(n,i){let s=r;if(!s)return()=>{};let a=new Map,o=()=>{s.inputs.forEach(l=>{if(a.has(l))return;let c=(d=>n(cn(l),d.data,d.timeStamp||performance.now()));l.addEventListener("midimessage",c),a.set(l,c)}),i?.(this.inputs())};return o(),s.addEventListener?.("statechange",o),()=>{s.removeEventListener?.("statechange",o),a.forEach((l,c)=>c.removeEventListener("midimessage",l)),a.clear()}},output(n){return r?.outputs.get(n)??null}}}var ms=248,Tr=250,Mr=251,Ar=252,Br=242,Je=24;function bs(r){return r<60?"lower":"upper"}function fs(r,e){(r?P(r):void 0)?.noteListeners?.forEach(n=>n(e)),document.dispatchEvent(new CustomEvent("nbplay-note",{detail:e}))}var un=class extends g{static properties={midiPort:{type:String,attribute:"midi-port"},syncClock:{type:Boolean,attribute:"sync-clock"},samplerRouting:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},availableMidiPorts:{attribute:!1},activeNotes:{attribute:!1},lastNoteEvent:{attribute:!1},controlChange:{attribute:!1},clockBpm:{type:Number,attribute:!1},ports:{attribute:!1}};midi=de();voices=Te();heldNotes=new Set;binding=null;monitor="No notes";ccSeq=0;tickTimes=[];tickCount=0;baseBeat=0;constructor(){super(),this.midiPort="",this.syncClock=!1,this.samplerRouting=[],this.sessionId="",this.channelIndex=-1,this.availableMidiPorts=[],this.activeNotes=[],this.lastNoteEvent={},this.controlChange={},this.clockBpm=0,this.ports=[]}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-midi-keyboard"),this.voices.setSession(this.sessionId,this.channelIndex),this.binding=H(this,()=>{},()=>{}),this.refreshPorts()}disconnectedCallback(){super.disconnectedCallback(),this.midi.disconnectInput(),this.voices.destroy(),this.binding?.dispose(),this.binding=null}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&(this.voices.setSession(this.sessionId,this.channelIndex),e.has("sessionId")&&this.binding?.rebind()),e.has("lastNoteEvent")&&e.get("lastNoteEvent")!==void 0&&(this.monitor=this.monitorText(),this.requestUpdate()),e.has("midiPort")&&e.get("midiPort")!==void 0&&this.connectByName(this.midiPort)}set(e){this.emitDetail("nbplay-set",{values:e})}status(e){this.emitDetail("nbplay-status",{values:e,save:!0})}monitorText(){let e=this.lastNoteEvent;return e?.type==="on"&&typeof e.note=="number"?`${R(e.note)}  vel ${e.velocity}`:e?.type==="off"&&typeof e.note=="number"?`${R(e.note)}  off`:"No notes"}async refreshPorts(){let e=await this.midi.requestAccess();this.ports=e?this.midi.inputs():[],e&&(this.availableMidiPorts=this.ports.map(t=>t.name),this.status({availableMidiPorts:this.availableMidiPorts}),this.midiPort&&!this.midi.activeInputId()&&this.connectByName(this.midiPort))}get activePortId(){return this.midi.activeInputId()??""}connectById(e){if(!e){this.midi.disconnectInput();return}this.midi.connectInput(e,(t,n)=>this.handleMidiData(t,n))}connectByName(e){let t=this.midi.activeInputId();if((this.ports.find(s=>s.id===t)?.name??"")===e)return;let i=this.ports.find(s=>s.name===e);this.connectById(i?.id??""),this.requestUpdate()}onPortChange(e){e.stopPropagation();let t=e.detail.value;this.connectById(t);let n=this.ports.find(i=>i.id===t);this.midiPort=t?n?.name??t:"",this.set({midiPort:this.midiPort})}noteOn(e,t){if(e<0||e>127)return;this.heldNotes.add(e);let n=bs(e);we(this.sessionId,this.samplerRouting||[],e,n,t)||this.voices.noteOn(e,t);let i={note:e,velocity:t,type:"on"};fs(this.sessionId,i),this.lastNoteEvent={...i},this.activeNotes=Array.from(this.heldNotes),this.monitor=this.monitorText(),this.status({lastNoteEvent:i,activeNotes:this.activeNotes})}noteOff(e){if(e<0||e>127)return;this.heldNotes.delete(e),Ce(this.sessionId,this.samplerRouting||[],e,bs(e))||this.voices.noteOff(e);let t={note:e,velocity:0,type:"off"};fs(this.sessionId,t),this.lastNoteEvent={...t},this.activeNotes=Array.from(this.heldNotes),this.monitor=this.monitorText(),this.status({lastNoteEvent:t,activeNotes:this.activeNotes})}control(e,t,n){this.ccSeq+=1,this.controlChange={controller:e,value:t,channel:n,seq:this.ccSeq},this.monitor=`CC ${e}  ${t}`,this.requestUpdate(),this.status({controlChange:this.controlChange})}silence(){this.midi.disconnectInput(),this.voices.stopAll(),this.heldNotes.clear(),this.activeNotes=[],this.status({activeNotes:[]})}handleClockTick(e){let t=this.binding.clock();if(this.tickTimes.push(e),this.tickTimes.length>Je+1&&this.tickTimes.shift(),this.tickCount+=1,this.tickTimes.length===Je+1){let n=(this.tickTimes[Je]-this.tickTimes[0])/1e3;if(n>0){let i=Math.round(60/n*10)/10;Math.abs(i-t.bpm)>.5&&t.setTempo(i),Math.abs(i-(Number(this.clockBpm)||0))>.05&&(this.clockBpm=i,this.status({clockBpm:i}))}}if(this.tickCount%Je===0&&t.playing&&!t.loop.enabled){let n=this.baseBeat+this.tickCount/Je;Math.abs(t.beat()-n)>.05&&t.seek(n)}}handleRealtime(e,t){if(!this.syncClock)return;let n=this.binding.clock();e===ms?this.handleClockTick(t):e===Tr?(this.tickTimes=[],this.tickCount=0,this.baseBeat=0,n.seek(0),n.play()):e===Mr?(this.tickTimes=[],this.tickCount=0,this.baseBeat=n.beat(),n.play()):e===Ar&&(this.tickTimes=[],n.stop())}handleSongPosition(e){if(!this.syncClock)return;let t=e/4;this.tickCount=0,this.baseBeat=t,this.binding.clock().seek(t)}handleMidiData(e,t=performance.now()){if(!e||e.length===0)return;if(e[0]>=ms){this.handleRealtime(e[0],t);return}if(e[0]===Br&&e.length>=3){this.handleSongPosition(e[1]&127|(e[2]&127)<<7);return}if(e.length<3)return;let n=e[0]&240,i=e[1],s=e[2];if(n===176){this.control(i,s,e[0]&15);return}if(n===144&&s>0){this.noteOn(i,s);return}(n===128||n===144&&s===0)&&this.noteOff(i)}render(){let e=n=>n.stopPropagation(),t=Number(this.clockBpm)||0;return u`<nbplay-header badge="midi keyboard"></nbplay-header>
      <div class="nbplay-midi-kb-row">
        <span class="nbplay-midi-kb-label">Port</span>
        <nbplay-midi-port
          .ports=${this.ports.map(n=>({id:n.id,name:n.name}))}
          .value=${this.activePortId}
          .status=${this.midiPort?"connected":"idle"}
          @input=${e}
          @change=${this.onPortChange}
          @nbplay-refresh=${n=>{n.stopPropagation(),this.refreshPorts()}}
        ></nbplay-midi-port>
      </div>
      <div class="nbplay-midi-kb-row">
        <span class="nbplay-midi-kb-label">Clock</span>
        <label class="nbplay-midi-kb-clock-label">
          <input
            type="checkbox"
            class="nbplay-midi-kb-clock-input"
            .checked=${this.syncClock}
            @input=${e}
            @change=${n=>{n.stopPropagation(),this.syncClock=n.target.checked,this.set({syncClock:this.syncClock})}}
          />
          Follow device clock
        </label>
        <span class="nbplay-midi-kb-clock"
          >${t>0?`${t.toFixed(1)} BPM`:"\u2014"}</span
        >
      </div>
      <div class="nbplay-midi-kb-monitor">
        <span class="nbplay-midi-kb-last">${this.monitor}</span>
        <span class="nbplay-midi-kb-active">${this.heldNotes.size} active</span>
      </div>`}};k("nbplay-midi-keyboard",un);function gs(r,e,t,n){return r.filter(i=>(!i.port||i.port===e)&&(i.midi_channel<0||i.midi_channel===t)&&n>=i.note_low&&n<=i.note_high)}function vs(r,e,t,n,i){return r.filter(s=>(!s.port||s.port===e)&&(s.midi_channel<0||s.midi_channel===t)&&s.kind===n&&s.number===i)}var Rr=[{value:"toggle",label:"Play/stop"},{value:"play",label:"Play"},{value:"stop",label:"Stop"},{value:"record",label:"Record"},{value:"launch",label:"Launch slot"},{value:"scene",label:"Launch scene"},{value:"stop_track",label:"Stop track"},{value:"stop_all",label:"Stop all"}],_r=["launch","stop_track"],Ir=["launch","scene"];function ys(r,e){return r.length===e.length&&r.every((t,n)=>t===e[n])}var Lr={port:"",midi_channel:-1,kind:"note",number:0,action:"toggle",track_index:-1,scene_index:-1},Dr={port:"",midi_channel:-1,note_low:0,note_high:127},dn=class extends g{static properties={routes:{attribute:!1},mappings:{attribute:!1},sessionTracks:{attribute:!1},sessionScenes:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},availableMidiPorts:{attribute:!1},lastEvent:{attribute:!1},controlChange:{attribute:!1},learning:{state:!0}};midi=de();stopListening=null;held=new Map;ccSeq=0;knownPorts=null;constructor(){super(),this.routes=[],this.mappings=[],this.sessionTracks=[],this.sessionScenes=[],this.learning=-1,this.sessionId="",this.availableMidiPorts=[],this.lastEvent={},this.controlChange={}}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-midi-router"),this.listen()}disconnectedCallback(){super.disconnectedCallback(),this.stopListening?.(),this.stopListening=null,this.releaseAll()}updated(e){e.has("availableMidiPorts")&&this.knownPorts&&!ys(this.availableMidiPorts||[],this.knownPorts)&&(this.availableMidiPorts=this.knownPorts,this.status({availableMidiPorts:this.knownPorts})),e.has("sessionId")&&e.get("sessionId")!==void 0&&this.releaseAll()}set(e){this.emitDetail("nbplay-set",{values:e})}status(e){this.emitDetail("nbplay-status",{values:e,save:!0})}async listen(){!await this.midi.requestAccess()||!this.isConnected||(this.stopListening?.(),this.stopListening=this.midi.listenAll((e,t)=>this.handleMidiData(e.name,t),e=>this.onPorts(e)))}onPorts(e){let t=e.map(n=>n.name);this.knownPorts=t,!ys(t,this.availableMidiPorts||[])&&(this.availableMidiPorts=t,this.status({availableMidiPorts:t}))}releaseAll(){this.held.forEach(e=>e.forEach(t=>t())),this.held.clear()}handleMidiData(e,t){if(!t||t.length<3)return;let n=t[0]&240,i=t[0]&15,[,s,a]=t;if(n===176||n===144&&a>0){let l=n===176?"cc":"note",c=l==="note"||a>=64;if(c&&this.learn(e,i,l,s))return;let d=vs(this.mappings||[],e,i,l,s);if(d.length){c&&d.forEach(p=>this.run(p)),this.report({port:e,type:l,[l==="cc"?"controller":"note"]:s,value:a,channel:i});return}}if(n===176){this.ccSeq+=1,this.controlChange={controller:s,value:a,channel:i,port:e,seq:this.ccSeq},this.report({port:e,type:"cc",controller:s,value:a,channel:i});return}let o=`${e}
${i}
${s}`;if(n===144&&a>0)this.noteOff(o),this.held.set(o,this.noteOn(e,i,s,a)),this.broadcast({note:s,velocity:a,type:"on"}),this.report({port:e,type:"on",note:s,value:a,channel:i});else if(n===128||n===144){if(this.noteOff(o),vs(this.mappings||[],e,i,"note",s).length)return;this.broadcast({note:s,velocity:0,type:"off"}),this.report({port:e,type:"off",note:s,value:0,channel:i})}}noteOn(e,t,n,i){let s=P(this.sessionId);if(!s?.instruments)return[];s.audioCtx?.state==="suspended"&&s.audioCtx.resume();let a=[];for(let o of gs(this.routes||[],e,t,n)){let l=s.instruments[o.channel_index]?.startNote?.(n,i);l&&a.push(l)}return a}learn(e,t,n,i){if(!(this.learning>=0)||!this.mappings?.[this.learning])return!1;let s=this.learning;return this.learning=-1,this.editMapping(s,{port:e,midi_channel:t,kind:n,number:i}),!0}run(e){let t=P(this.sessionId),n=t?.clock;switch(e.action){case"play":n?.play();break;case"stop":n?.stop();break;case"toggle":n?.playing?n.stop():n?.play();break;case"record":{if(!n)break;let i=!n.recording;n.setRecording(i),i&&n.play();break}case"launch":t?.launcher?.command({action:"launch",track_index:e.track_index,scene_index:e.scene_index});break;case"scene":t?.launcher?.command({action:"scene",scene_index:e.scene_index});break;case"stop_track":t?.launcher?.command({action:"stop",track_index:e.track_index});break;case"stop_all":t?.launcher?.command({action:"stop_all"});break}}noteOff(e){this.held.get(e)?.forEach(t=>t()),this.held.delete(e)}broadcast(e){Pe(this.sessionId,e),document.dispatchEvent(new CustomEvent("nbplay-note",{detail:e}))}report(e){this.lastEvent=e;let t={lastEvent:e};e.type==="cc"&&(t.controlChange=this.controlChange),this.status(t)}editRoute(e,t){let n=(this.routes||[]).map(a=>({...a}));if(!n[e])return;n[e]={...n[e],...t};let{note_low:i,note_high:s}=n[e];i>s&&Object.assign(n[e],{note_low:s,note_high:i}),this.routes=n,this.set({routes:n})}editMapping(e,t){let n=(this.mappings||[]).map(i=>({...i}));n[e]&&(n[e]={...n[e],...t},this.mappings=n,this.set({mappings:n}))}addMapping(){let e=[...this.mappings||[],{...Lr}];this.mappings=e,this.set({mappings:e}),this.learning=e.length-1}removeMapping(e){let t=(this.mappings||[]).filter((n,i)=>i!==e);this.learning===e?this.learning=-1:this.learning>e&&(this.learning-=1),this.mappings=t,this.set({mappings:t})}addRoute(){let e=(this.sessionTracks||[])[0],t=[...this.routes||[],{...Dr,channel_index:e?e.channel_index:-1}];this.routes=t,this.set({routes:t})}removeRoute(e){let t=(this.routes||[]).filter((n,i)=>i!==e);this.routes=t,this.set({routes:t})}monitorText(){let e=this.lastEvent;if(!e?.type)return"No messages";let t=`${e.port} ch ${Number(e.channel)+1}`;if(e.type==="cc")return`${t}  CC ${e.controller}  ${e.value}`;let n=R(Number(e.note));return e.type==="on"?`${t}  ${n}  vel ${e.value}`:`${t}  ${n}  off`}renderRoute(e,t){let n=l=>l.stopPropagation(),i=l=>parseInt(l.target.value,10),s=this.availableMidiPorts||[],a=e.port&&!s.includes(e.port)?[...s,e.port]:s,o=(l,c)=>u`<input
        type="number"
        class="nbplay-midi-router-${l.replace("_","-")}"
        aria-label=${c}
        title=${R(e[l])}
        min="0"
        max="127"
        .value=${String(e[l])}
        @input=${n}
        @change=${d=>{n(d);let p=i(d);Number.isFinite(p)&&this.editRoute(t,{[l]:Math.max(0,Math.min(127,p))})}}
      />`;return u`<div class="nbplay-midi-router-route" role="row">
      <select
        class="nbplay-midi-router-port"
        aria-label="Port"
        @input=${n}
        @change=${l=>{n(l),this.editRoute(t,{port:l.target.value})}}
      >
        <option value="" ?selected=${!e.port}>Any port</option>
        ${a.map(l=>u`<option value=${l} ?selected=${e.port===l}>
              ${l}
            </option>`)}
      </select>
      <select
        class="nbplay-midi-router-channel"
        aria-label="MIDI channel"
        @input=${n}
        @change=${l=>{n(l),this.editRoute(t,{midi_channel:i(l)})}}
      >
        <option value="-1" ?selected=${e.midi_channel<0}>Any ch</option>
        ${Array.from({length:16},(l,c)=>u`<option value=${c} ?selected=${e.midi_channel===c}>
              Ch ${c+1}
            </option>`)}
      </select>
      <span class="nbplay-midi-router-notes"
        >${o("note_low","Lowest note")}–${o("note_high","Highest note")}</span
      >
      <select
        class="nbplay-midi-router-track"
        aria-label="Track"
        @input=${n}
        @change=${l=>{n(l),this.editRoute(t,{channel_index:i(l)})}}
      >
        <option value="-1" ?selected=${e.channel_index<0}>—</option>
        ${(this.sessionTracks||[]).map(l=>u`<option
              value=${l.channel_index}
              ?selected=${e.channel_index===l.channel_index}
            >
              ${l.name}
            </option>`)}
      </select>
      <button
        type="button"
        class="nbplay-midi-router-remove"
        title="Remove route"
        aria-label="Remove route"
        @click=${()=>this.removeRoute(t)}
      >
        ×
      </button>
    </div>`}triggerText(e){let t=e.port||"Any port",n=e.midi_channel<0?"any ch":`ch ${e.midi_channel+1}`,i=e.kind==="cc"?`CC ${e.number}`:`note ${R(e.number)}`;return`${t} \xB7 ${n} \xB7 ${i}`}renderMapping(e,t){let n=l=>l.stopPropagation(),i=l=>parseInt(l.target.value,10),s=this.learning===t,a=_r.includes(e.action),o=Ir.includes(e.action);return u`<div class="nbplay-midi-router-mapping" role="row">
      <button
        type="button"
        class="nbplay-midi-router-learn ${s?"learning":""}"
        title=${`${this.triggerText(e)}: click, then press the key, pad or button to use`}
        @click=${()=>this.learning=s?-1:t}
      >
        ${s?"Press a key\u2026":this.triggerText(e)}
      </button>
      <select
        class="nbplay-midi-router-action"
        aria-label="Action"
        @input=${n}
        @change=${l=>{n(l),this.editMapping(t,{action:l.target.value})}}
      >
        ${Rr.map(l=>u`<option
              value=${l.value}
              ?selected=${e.action===l.value}
            >
              ${l.label}
            </option>`)}
      </select>
      <select
        class="nbplay-midi-router-slot-track"
        aria-label="Launcher track"
        ?disabled=${!a}
        @input=${n}
        @change=${l=>{n(l),this.editMapping(t,{track_index:i(l)})}}
      >
        <option value="-1" ?selected=${e.track_index<0}>—</option>
        ${(this.sessionTracks||[]).map((l,c)=>u`<option value=${c} ?selected=${e.track_index===c}>
              ${l.name}
            </option>`)}
      </select>
      <select
        class="nbplay-midi-router-slot-scene"
        aria-label="Scene"
        ?disabled=${!o}
        @input=${n}
        @change=${l=>{n(l),this.editMapping(t,{scene_index:i(l)})}}
      >
        <option value="-1" ?selected=${e.scene_index<0}>—</option>
        ${(this.sessionScenes||[]).map((l,c)=>u`<option
              value=${c}
              ?selected=${e.scene_index===c}
            >
              ${l}
            </option>`)}
      </select>
      <button
        type="button"
        class="nbplay-midi-router-remove"
        title="Remove control"
        aria-label="Remove control"
        @click=${()=>this.removeMapping(t)}
      >
        ×
      </button>
    </div>`}render(){let e=this.availableMidiPorts||[],t=this.mappings||[];return u`<nbplay-header badge="midi"></nbplay-header>
      <div class="nbplay-midi-router-ports">
        <span class="nbplay-midi-router-label">Inputs</span>
        ${e.length?e.map(n=>u`<span class="nbplay-midi-router-port-name"
                    >${n}</span
                  >`):u`<span class="nbplay-midi-router-none">No MIDI inputs</span>`}
      </div>
      <div class="nbplay-midi-router-routes" role="table">
        ${(this.routes||[]).length?u`<div class="nbplay-midi-router-head" role="row">
                <span role="columnheader">Port</span>
                <span role="columnheader">Channel</span>
                <span role="columnheader">Notes</span>
                <span role="columnheader">Track</span>
              </div>`:""}
        ${(this.routes||[]).map((n,i)=>this.renderRoute(n,i))}
      </div>
      <button
        type="button"
        class="nbplay-midi-router-add"
        @click=${()=>this.addRoute()}
      >
        Add route
      </button>
      <div class="nbplay-midi-router-mappings" role="table">
        ${t.length?u`<div class="nbplay-midi-router-mapping-head" role="row">
                <span role="columnheader">Control</span>
                <span role="columnheader">Action</span>
                <span role="columnheader">Track</span>
                <span role="columnheader">Scene</span>
              </div>`:""}
        ${t.map((n,i)=>this.renderMapping(n,i))}
      </div>
      <button
        type="button"
        class="nbplay-midi-router-add-control"
        @click=${()=>this.addMapping()}
      >
        Add control
      </button>
      <div class="nbplay-midi-router-monitor">${this.monitorText()}</div>`}};k("nbplay-midi-router",dn);var Or=[22050,44100,48e3,96e3],qr=[128,256,512,1024,2048],Vr=8,pn=class extends g{static properties={sampleRate:{type:Number,attribute:"sample-rate"},channels:{type:Number},bufferSize:{type:Number,attribute:"buffer-size"},audioDevice:{type:String,attribute:"audio-device"},midiPort:{type:String,attribute:"midi-port"},availableMidiPorts:{attribute:!1},midiEvent:{attribute:!1},ports:{attribute:!1}};midi=de();constructor(){super(),this.sampleRate=44100,this.channels=2,this.bufferSize=512,this.audioDevice="",this.midiPort="",this.availableMidiPorts=[],this.midiEvent=null,this.ports=[]}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-settings"),this.refreshPorts()}disconnectedCallback(){super.disconnectedCallback(),this.midi.disconnectInput()}updated(e){e.has("midiPort")&&e.get("midiPort")!==void 0&&this.connectByName(this.midiPort)}set(e){this.emitDetail("nbplay-set",{values:e})}status(e){this.emitDetail("nbplay-status",{values:e,save:!0})}async refreshPorts(){let e=await this.midi.requestAccess();this.ports=e?this.midi.inputs():[],e&&(this.availableMidiPorts=this.ports.map(t=>t.name),this.status({availableMidiPorts:this.availableMidiPorts}),this.midiPort&&!this.midi.activeInputId()&&this.connectByName(this.midiPort))}onMessage=(e,t)=>{let n=Vt(e),i=this.querySelector("nbplay-midi-log");n&&i&&i.push(n);let s=new Uint8Array(e.length+8);new DataView(s.buffer).setFloat64(0,t,!0),s.set(e,8),this.midiEvent=new DataView(s.buffer),this.status({midiEvent:this.midiEvent})};connectById(e){e?this.midi.connectInput(e,this.onMessage):this.midi.disconnectInput()}connectByName(e){let t=this.midi.activeInputId();if((this.ports.find(s=>s.id===t)?.name??"")===e)return;let i=this.ports.find(s=>s.name===e);this.connectById(i?.id??""),this.requestUpdate()}onPortChange(e){e.stopPropagation();let t=e.detail.value;this.connectById(t);let n=this.ports.find(i=>i.id===t);this.midiPort=t?n?.name??t:"",this.set({midiPort:this.midiPort})}select(e,t,n){return u`<select
      class="nbplay-select ${e}"
      .value=${String(this[t])}
      @input=${i=>i.stopPropagation()}
      @change=${i=>{i.stopPropagation();let s=parseInt(i.target.value,10);this[t]=s,this.set({[t]:s})}}
    >
      ${n.map(i=>u`<option
            value=${i.value}
            ?selected=${i.value===this[t]}
            .textContent=${i.label}
          ></option>`)}
    </select>`}render(){let e=this.midi.activeInputId()??"";return u`<nbplay-header badge="settings"></nbplay-header>
      <div class="nbplay-section">
        <div class="nbplay-section-title">
          <span class="nbplay-section-icon">♫</span> Audio Output
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Sample Rate</span>
          ${this.select("nbplay-sr-select","sampleRate",Or.map(t=>({value:t,label:`${t} Hz`})))}
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Channels</span>
          ${this.select("nbplay-ch-select","channels",[{value:1,label:"Mono"},{value:2,label:"Stereo"}])}
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Buffer Size</span>
          ${this.select("nbplay-buf-select","bufferSize",qr.map(t=>({value:t,label:String(t)})))}
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Device</span>
          <span class="nbplay-detail nbplay-audio-device"
            >${this.audioDevice||"Default"}</span
          >
        </div>
      </div>
      <div class="nbplay-section">
        <div class="nbplay-section-title">
          <span class="nbplay-section-icon">𝅘𝅥𝅮</span> MIDI Input
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Port</span>
          <nbplay-midi-port
            .ports=${this.ports.map(t=>({id:t.id,name:t.name}))}
            .value=${e}
            .status=${this.midiPort?"connected":"idle"}
            @input=${t=>t.stopPropagation()}
            @change=${this.onPortChange}
            @nbplay-refresh=${t=>{t.stopPropagation(),this.refreshPorts()}}
          ></nbplay-midi-port>
        </div>
        <nbplay-midi-log label="Activity" .max=${Vr}></nbplay-midi-log>
      </div>`}};k("nbplay-settings",pn);var Fr=248,Ur=250,ks=251,ni=252,zr=242,Hr=24,Gr=25,Kr=.1;function hn(r){let e=Math.max(0,Math.min(16383,Math.round(r*4)));return[zr,e&127,e>>7&127]}function ye(r,e){let t=Number(r);return Number.isFinite(t)?Math.max(0,Math.min(127,Math.round(t))):e}var mn=class extends g{static properties={midiPort:{type:String,attribute:"midi-port"},channel:{type:Number},forwardNotes:{type:Boolean,attribute:"forward-notes"},sendClock:{type:Boolean,attribute:"send-clock"},sessionId:{type:String,attribute:"session-id",reflect:!0},availableMidiPorts:{attribute:!1},ports:{attribute:!1},sent:{type:Number,attribute:!1}};midi=de();active=null;activeId="";bus=null;binding=null;tickTimer=null;nextTickTime=0;constructor(){super(),this.midiPort="",this.channel=0,this.forwardNotes=!0,this.sendClock=!1,this.sessionId="",this.availableMidiPorts=[],this.ports=[],this.sent=0}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-midi-output"),this.binding=H(this,this.onClockEvent,this.onRebind),this.bindSession(),this.refreshPorts()}disconnectedCallback(){super.disconnectedCallback(),this.teardown(),this.binding?.dispose(),this.binding=null}updated(e){e.has("sessionId")&&e.get("sessionId")!==void 0&&(this.bindSession(),this.binding?.rebind()),e.has("midiPort")&&e.get("midiPort")!==void 0&&this.connectByName(this.midiPort),(e.has("midiPort")||e.has("sendClock"))&&this.syncClockSending()}set(e){this.emitDetail("nbplay-set",{values:e})}status(e){this.emitDetail("nbplay-status",{values:e,save:!0})}channelNumber(){let e=Number(this.channel);return Number.isFinite(e)?Math.max(0,Math.min(15,Math.round(e))):0}async refreshPorts(){let e=await this.midi.requestAccess();this.ports=e?this.midi.outputs():[],e&&(this.availableMidiPorts=this.ports.map(t=>t.name),this.status({availableMidiPorts:this.availableMidiPorts}),this.midiPort&&!this.active&&this.connectByName(this.midiPort))}connectById(e){this.active=e?this.midi.output(e):null,this.activeId=this.active?e:""}connectByName(e){if((this.ports.find(i=>i.id===this.activeId)?.name??"")===e)return;let n=this.ports.find(i=>i.name===e);this.connectById(n?.id??""),this.requestUpdate()}onPortChange(e){e.stopPropagation(),this.allNotesOff();let t=e.detail.value;this.connectById(t);let n=this.ports.find(i=>i.id===t);this.midiPort=this.active?n?.name??t:"",this.set({midiPort:this.midiPort})}send(e,t){if(this.active)try{t===void 0?this.active.send(e):this.active.send(e,t),this.sent+=1}catch{}}allNotesOff(){this.send([176|this.channelNumber(),123,0])}timestampFor(e){let t=this.binding?.clock().context()||this.bus?.audioCtx;if(t)return performance.now()+Math.max(0,e-t.currentTime)*1e3}command(e){if(!e?.kind)return;let t=this.channelNumber();e.kind==="note_on"?this.send([144|t,ye(e.note,60),Math.max(1,ye(e.velocity,100))]):e.kind==="note_off"?this.send([128|t,ye(e.note,60),0]):e.kind==="control_change"?this.send([176|t,ye(e.controller,0),ye(e.value,0)]):e.kind==="raw"&&Array.isArray(e.data)&&this.send(e.data.map(n=>Math.max(0,Math.min(255,Math.round(Number(n)||0)))))}onNote=e=>{if(!this.forwardNotes)return;let t=this.channelNumber(),n=ye(e.note,60);if(e.type==="off"){this.send([128|t,n,0]);return}let i=Math.max(1,ye(e.velocity,100));if(e.at===void 0){this.send([144|t,n,i]);return}let s=this.timestampFor(e.at);if(this.send([144|t,n,i],s),e.duration!==void 0){let a=s===void 0?void 0:s+Math.max(0,e.duration)*1e3;this.send([128|t,n,0],a)}};onDocumentNote=e=>{this.onNote(e.detail)};unbindSession(){this.bus?.noteListeners&&(this.bus.noteListeners=this.bus.noteListeners.filter(e=>e!==this.onNote)),document.removeEventListener("nbplay-note",this.onDocumentNote),this.bus=null}bindSession(){this.unbindSession(),this.sessionId?(this.bus=ue(this.sessionId),this.bus.noteListeners||(this.bus.noteListeners=[]),this.bus.noteListeners.push(this.onNote)):document.addEventListener("nbplay-note",this.onDocumentNote)}sendsClock(){return!!this.sendClock&&!!this.midiPort}scheduleTicks=()=>{let e=this.binding.clock(),t=e.now(),n=e.secondsPerBeat()/Hr,i=e.context(),s=i?performance.now()-i.currentTime*1e3:void 0;for(this.nextTickTime<t-.5&&(this.nextTickTime=t);this.nextTickTime<t+Kr;)this.send([Fr],s===void 0?void 0:s+this.nextTickTime*1e3),this.nextTickTime+=n};startTicks(e){this.tickTimer||(this.nextTickTime=e.now(),this.tickTimer=setInterval(this.scheduleTicks,Gr),this.scheduleTicks())}stopTicks(){this.tickTimer&&clearInterval(this.tickTimer),this.tickTimer=null}onClockEvent=e=>{let t=this.binding.clock();switch(e.type){case"play":if(!this.sendsClock())break;e.beat<.001?this.send([Ur]):(this.send(hn(e.beat)),this.send([ks])),this.startTicks(t);break;case"stop":this.tickTimer&&this.send([ni]),this.stopTicks();break;case"seek":this.tickTimer&&this.send(hn(e.beat));break;case"tempo":case"loop":case"record":case"timesig":break}};onRebind=e=>{this.stopTicks(),this.sendsClock()&&e.playing&&this.startTicks(e)};syncClockSending(){let e=this.binding?.clock();e&&(this.sendsClock()&&e.playing&&!this.tickTimer?(this.send(hn(e.beat())),this.send([ks]),this.startTicks(e)):!this.sendsClock()&&this.tickTimer&&(this.send([ni]),this.stopTicks()))}teardown(){this.tickTimer&&this.send([ni]),this.stopTicks(),this.allNotesOff(),this.unbindSession(),this.active=null,this.activeId=""}render(){let e=n=>n.stopPropagation(),t=(n,i,s)=>u`<label class="nbplay-midi-out-forward">
        <input
          type="checkbox"
          class=${n}
          .checked=${this[i]}
          @input=${e}
          @change=${a=>{a.stopPropagation(),this[i]=a.target.checked,this.set({[i]:this[i]})}}
        />
        ${s}
      </label>`;return u`<nbplay-header badge="midi output"></nbplay-header>
      <div class="nbplay-midi-out-row">
        <span class="nbplay-midi-out-label">Port</span>
        <nbplay-midi-port
          .ports=${this.ports.map(n=>({id:n.id,name:n.name}))}
          .value=${this.activeId}
          .status=${this.midiPort?"connected":"idle"}
          @input=${e}
          @change=${this.onPortChange}
          @nbplay-refresh=${n=>{n.stopPropagation(),this.refreshPorts()}}
        ></nbplay-midi-port>
      </div>
      <div class="nbplay-midi-out-row">
        <span class="nbplay-midi-out-label">Channel</span>
        <select
          class="nbplay-midi-out-channel"
          .value=${String(this.channelNumber())}
          @input=${e}
          @change=${n=>{n.stopPropagation(),this.allNotesOff(),this.channel=Number(n.target.value),this.set({channel:this.channel})}}
        >
          ${Array.from({length:16},(n,i)=>u`<option
                value=${i}
                ?selected=${i===this.channelNumber()}
                .textContent=${String(i+1)}
              ></option>`)}
        </select>
        ${t("nbplay-midi-out-forward-input","forwardNotes","Forward session notes")}
        ${t("nbplay-midi-out-clock-input","sendClock","Send clock")}
      </div>
      <div class="nbplay-midi-out-row">
        <span class="nbplay-midi-out-label">Sent</span>
        <span class="nbplay-midi-out-count">${this.sent} sent</span>
      </div>`}};k("nbplay-midi-output",mn);var Wr=new Set(["automation_lanes","current_step","is_playing","voices_data"]);function et(r,e,t){return Math.max(e,Math.min(t,r))}function Q(r,e){let t=Number(r);return Number.isFinite(t)?t:e}function ii(r){return Math.max(.001,Q(r.get("step_duration"),.25))}function jr(r,e,t,n=[]){let i=r%2===1?e*.5*(et(t,0,100)/100):0,s=n.length>0?e*(et(Q(n[r%n.length],0),-50,50)/100):0;return et(i+s,e*-.5,e*.75)}function si(r){return 440*Math.pow(2,(r-69)/12)}function Zr(r,e=Math.random){if(!r.active)return!1;let t=et(Q(r.probability,100),0,100);return t<=0?!1:t>=100?!0:e()*100<t}function*Yr(r,e,t=Math.random){for(let n of r){let i=n[e];!i||!Zr(i,t)||(yield{note:Q(i.note,60),freq:si(Q(i.note,60)),velocity:et(Q(i.velocity,100),0,127)/127,durationTicks:Math.max(.001,Q(i.duration_ticks,1))})}}function Qr(r,e){let t=(r.points||[]).filter(i=>Number.isFinite(i.step)&&Number.isFinite(i.value)&&i.step>=0).sort((i,s)=>i.step-s.step);if(t.length===0)return null;let n=null;for(let i of t)if(i.step<=e)n=i;else break;return(n||t[t.length-1]).value}function Xr(r,e){let t=r.get("automation_lanes")||[];for(let n of t){let i=typeof n?.trait=="string"?n.trait:"";if(!i||Wr.has(i))continue;let s=Qr(n,e);s!==null&&Q(r.get(i),NaN)!==s&&r.set(i,s)}}function ri(r,e,t,n,i,s){let o=Math.min(.05,s*.2);try{let l=r.createOscillator(),c=r.createGain();return l.type="sine",l.frequency.value=t,c.gain.setValueAtTime(0,i),c.gain.linearRampToValueAtTime(n,i+.005),c.gain.linearRampToValueAtTime(0,i+s-o),l.connect(c),c.connect(e||r.destination),l.start(i),l.stop(i+s),l}catch{return null}}function $s(r,e){let t=String(r.get("session_id")||""),n=Q(r.get("channel_index"),-1),i=t&&n>=0&&P(t)?.channels?.[n]?.gain||null;return{ctx:e.context(),output:i}}function Jr(r){return r.get("voices_data")||[]}function ea(r,e){return Math.ceil(r/e-1e-6)*e}function ta(r,e,t,n=.1){let i=ii(r),s=e.secondsPerBeat(),a=e.beatAt(t),o=Math.floor(a/i+1e-6)*i,l=(a-o)*s<n?o:o+i;return{beat:l,time:t+(l-a)*s}}function na(r,e,t){let n=ii(e),i=t.secondsPerBeat(),s=r.beat+n,a=r.time+n*i,o=t.loop;if(o.enabled&&o.endBeat>o.startBeat&&s>=o.endBeat-1e-9){let l=r.time+(o.endBeat-r.beat)*i;s=ea(o.startBeat,n),a=l+(s-o.startBeat)*i}return{beat:s,time:a}}function ia(r,e,t,n){let i=Math.max(1,e),s=i*t;if(n){let a=(r%s+s)%s;return Math.round(a/t)%i}return r<-1e-9||r>=s-1e-9?-1:Math.floor(r/t+1e-6)}var sa=6;function Be(r={}){let e=null,t=null,n=null,i=null,s=null,a=.1,o=.025,l=r.random||Math.random,c=[];function d(f){let $=e?.currentTime??0;c.forEach(b=>{(f?b.at>$:b.until>$)&&b.cancel()}),c=f?c.filter(b=>b.at<=$):[]}function p(){i&&(clearInterval(i),i=null),d(!0),s=null,t=null,n=null}let h={start(f,$){let b=$s(f,$);b.ctx&&(e=b.ctx,t=$,n=f,s=null,e.state==="suspended"&&e.resume(),i||(i=setInterval(()=>{m(f)},o*1e3)),m(f))},realign(){d(!0),s=null,i&&n&&m(n)},stop(){i&&(clearInterval(i),i=null),d(!1),s=null,t=null,n=null},destroy(){h.stop(),e=null},isPlaying(){return i!==null}};function m(f){let $=t;if(!e||!$)return;let b=e.currentTime;for(c=c.filter(E=>E.until>b),(!s||s.time<b-.5)&&(s=ta(f,$,b));s.time<b+a;){if(!y(f,$,s))return;s=na(s,f,$)}}function y(f,$,b){if(!e)return!0;let E=Jr(f),v=E[0]||[];if(E.length===0||v.length===0)return!0;let S=ii(f),T=ia(b.beat,v.length,S,!!f.get("loop_enabled"));if(T<0)return p(),r.onEnd?.(),!1;f.set("current_step",T);let A=f.get("session_id")||"",_=Q(f.get("channel_index"),-1);if(Xt(A,_)!==r.owner)return!0;Xr(f,T);let j=S*$.secondsPerBeat(),Z=jr(T,j,Q(f.get("swing"),0),f.get("groove")||[]),F=Math.max(0,b.time+Z),pe=r.instrument?.()??(A&&_>=0?P(A)?.instruments?.[_]:void 0),$e=$s(f,$).output;for(let{note:te,freq:C,velocity:O,durationTicks:ne}of Yr(E,T,l)){let re=j*ne,U;if(pe)U=pe.scheduleNote(te,Math.round(O*127),F,re)||void 0;else{let Se=ri(e,$e,C,O,F,re);Se&&(U=()=>{try{Se.stop(0),Se.disconnect()}catch{}})}U&&c.push({cancel:U,at:F,until:F+re+sa}),Pe(A,{note:te,velocity:Math.round(O*127),type:"on",at:F,duration:j*ne})}return!0}return h}var Ss=[1,.5,.25,.125],ra=30,aa=300;function oa(){return{active:!1,note:60,velocity:100,duration_ticks:1,probability:100}}function Es(r,e,t,n){let i=Math.max(1,Math.round(r||1)),s=Math.max(.001,e||.25);return Math.max(1,Math.round(i*se(t,n)/s))}function la(r,e){let t=r.slice(0,e).map(n=>({...n}));for(;t.length<e;)t.push(oa());return t}function ca(r,e,t){let n=Math.max(1,r.length||t||1);return Array.from({length:n},(i,s)=>la(r[s]||[],e))}function xs(r){return r.replace(/_([a-z])/g,(e,t)=>t.toUpperCase())}var ua=["voicesData","stepDuration","swing","groove"],bn=class extends g{static properties={voicesData:{attribute:!1},numVoices:{type:Number,attribute:"num-voices"},length:{type:Number},measures:{type:Number},stepDuration:{type:Number,attribute:"step-duration"},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},bpm:{type:Number},loopEnabled:{type:Boolean,attribute:"loop-enabled"},keyboardConnected:{type:Boolean,attribute:"keyboard-connected"},followTransport:{type:Boolean,attribute:"follow-transport"},swing:{type:Number},groove:{attribute:!1},automationLanes:{attribute:!1},editToken:{type:String,attribute:"edit-token"},editAck:{type:String,attribute:"edit-ack"},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},currentStep:{type:Number,attribute:!1}};binding=null;scheduler=Be({onEnd:()=>this.onPatternEnd()});armed=new Set;cursor=null;pending=null;editSerial=0;unbindShortcuts=null;applyingGrid=!1;shim={get:e=>this[xs(e)],set:(e,t)=>{let n=xs(e);this[n]=t,this.status(!1,{[n]:t})},save_changes:()=>{},on:()=>{}};constructor(){super(),this.voicesData=[],this.numVoices=1,this.length=16,this.measures=1,this.stepDuration=.25,this.timeSignatureNum=4,this.timeSignatureDen=4,this.bpm=120,this.loopEnabled=!0,this.keyboardConnected=!1,this.followTransport=!0,this.swing=0,this.groove=[],this.automationLanes=[],this.editToken="",this.editAck="",this.sessionId="",this.channelIndex=-1,this.isPlaying=!1,this.currentStep=-1}clock(){if(!this.binding){this.binding=H(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.isPlaying=e.playing,this.currentStep=-1,e.playing&&this.startScheduler()}return this.binding.clock()}shared(){return!!this.sessionId}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-sequencer"),this.tabIndex=0,this.reconcileGridWithData(),this.clock(),this.unbindShortcuts=le(this,{Space:()=>this.togglePlay(),"Shift+Space":()=>this.stopAndRewind(),ArrowLeft:()=>this.moveCursor(0,-1),ArrowRight:()=>this.moveCursor(0,1),ArrowUp:()=>this.moveCursor(-1,0),ArrowDown:()=>this.moveCursor(1,0),Enter:()=>this.toggleCursorStep(),x:()=>this.toggleCursorStep(),Escape:()=>{this.cancelPendingEdit(),this.cursor=null,this.requestUpdate()}}),this.addEventListener("nbplay-cancel-edit",this.onCancelEdit)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-note",this.onDocumentNote),this.removeEventListener("nbplay-cancel-edit",this.onCancelEdit),this.cancelPendingEdit(),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.scheduler.destroy(),this.binding?.dispose(),this.binding=null}set(e){if(!this.editToken){this.emitDetail("nbplay-set",{values:e});return}for(let[t,n]of Object.entries(e))ua.includes(t)&&(this.editSerial+=1,this.editAck=`${this.editToken}#${this.editSerial}`,this.emitDetail("nbplay-set",{values:{editAck:this.editAck}})),this.emitDetail("nbplay-set",{values:{[t]:n}})}status(e,t){this.emitDetail("nbplay-status",{values:t,save:e})}startScheduler(){this.scheduler.isPlaying()||this.scheduler.start(this.shim,this.clock())}stopLocal(e){this.scheduler.stop(),this.isPlaying=!1,this.currentStep=-1,this.status(e,{isPlaying:!1,currentStep:-1})}onPatternEnd(){if(this.shared())this.stopLocal(!0);else{let e=this.clock();e.stop(),e.seek(0)}}onClockEvent=e=>{switch(e.type){case"play":if(this.followTransport===!1)break;this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0});break;case"stop":this.stopLocal(!0);break;case"seek":case"loop":this.scheduler.realign();break;case"tempo":{this.scheduler.realign();let t=this.clock().bpm;Number(this.bpm)!==t&&(this.bpm=t,this.set({bpm:t}));break}case"record":case"timesig":break}};joinTempo(e){let t=e.adoptTempo(Number(this.bpm));t!==Number(this.bpm)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.scheduler.stop(),this.joinTempo(e),this.currentStep=-1,e.playing&&this.followTransport!==!1&&this.startScheduler(),this.isPlaying=this.scheduler.isPlaying(),this.status(!1,{isPlaying:this.isPlaying,currentStep:-1})};updated(e){if(!this.binding)return;let t=e.has("sessionId")&&e.get("sessionId")!==void 0;t&&this.binding.rebind();let n=this.clock();e.has("bpm")&&!t&&Number(this.bpm)!==n.bpm&&n.setTempo(Number(this.bpm)),(e.has("measures")||e.has("stepDuration")||e.has("timeSignatureNum")||e.has("timeSignatureDen"))&&!this.applyingGrid&&[...e.keys()].some(i=>e.get(i)!==void 0)&&this.applyGrid({}),e.has("isPlaying")&&e.get("isPlaying")!==void 0&&this.onPlayStateChange(n),e.has("keyboardConnected")&&!this.keyboardConnected&&this.cancelPendingEdit()}onPlayStateChange(e){if(this.shared()){let t=this.scheduler.isPlaying();!!this.isPlaying!==t&&(this.isPlaying=t,this.status(!0,{isPlaying:t}));return}this.isPlaying?e.playing?this.startScheduler():e.play():(this.scheduler.stop(),e.stop())}voices(){return Array.isArray(this.voicesData)?this.voicesData:[]}actualLength(){return this.voices()[0]?.length||Number(this.length||0)||1}configuredLength(){return Es(Number(this.measures||1),Number(this.stepDuration||.25),Number(this.timeSignatureNum||4),Number(this.timeSignatureDen||4))}reconcileGridWithData(){let e=this.actualLength();if(e===this.configuredLength())return;let n=Math.max(1,Number(this.measures||1))*se(Number(this.timeSignatureNum||4),Number(this.timeSignatureDen||4)),i=Math.max(.001,n/Math.max(1,e)),s=Ss.find(a=>Math.abs(a-i)<1e-4);this.length=e,this.stepDuration=s??i,this.status(!1,{length:this.length,stepDuration:this.stepDuration})}applyGrid(e){if(!this.applyingGrid){this.applyingGrid=!0;try{let t=N(Math.round(e.measures??Number(this.measures||1)),1,64),n=Math.max(.001,e.stepDuration??Number(this.stepDuration||.25)),i=Es(t,n,Number(this.timeSignatureNum||4),Number(this.timeSignatureDen||4)),s=ca(this.voices(),i,Number(this.numVoices||1)),a=t!==this.measures||n!==this.stepDuration||i!==this.length||JSON.stringify(s)!==JSON.stringify(this.voicesData);this.measures=t,this.stepDuration=n,this.length=i,this.voicesData=s,a&&this.set({measures:t,stepDuration:n,length:i,voicesData:s})}finally{this.applyingGrid=!1}}}writeStep(e,t,n){let i=[...this.voices()],s=[...i[e]||[]];t>=s.length||(s[t]={...s[t],...n},i[e]=s,this.voicesData=i,this.set({voicesData:i}))}armedChanged(){this.armed.size>0?document.addEventListener("nbplay-note",this.onDocumentNote):document.removeEventListener("nbplay-note",this.onDocumentNote),this.requestUpdate()}onDocumentNote=e=>{let t=e.detail;if(!t||this.armed.size===0||t.type!=="on")return;let n=this.currentStep;if(n<0)return;let i=[...this.voices()];if(i.length===0)return;let s=!1;for(let a of this.armed){let o=[...i[a]||[]];a<i.length&&n<o.length&&(o[n]={...o[n],note:t.note,velocity:t.velocity,active:!0},i[a]=o,s=!0)}s&&(this.voicesData=i,this.set({voicesData:i}))};toggleArm(e,t){t??!this.armed.has(e)?this.armed.add(e):this.armed.delete(e),this.armedChanged()}toggleRecordAll(){this.armed.size>0?this.armed.clear():this.voices().forEach((e,t)=>this.armed.add(t)),this.armedChanged()}onPendingNote=e=>{let t=e.detail;if(t.type!=="on"||!this.pending)return;let{voice:n,step:i}=this.pending;this.cancelPendingEdit(),this.writeStep(n,i,{note:t.note,velocity:t.velocity,active:!0})};waitForNote(e,t){this.keyboardConnected&&(this.cancelPendingEdit(),this.pending={voice:e,step:t},this.focus(),document.addEventListener("nbplay-note",this.onPendingNote),this.requestUpdate())}cancelPendingEdit(){document.removeEventListener("nbplay-note",this.onPendingNote),this.pending&&(this.pending=null,this.requestUpdate())}onCancelEdit=()=>this.cancelPendingEdit();togglePlay(){let e=this.clock();this.isPlaying?this.shared()?this.stopLocal(!0):e.stop():e.playing?(this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0})):(e.play(),this.followTransport===!1&&(this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0})))}stopAndRewind(){let e=this.clock();e.playing?e.stop():this.stopLocal(!0),e.seek(0)}halt(){this.scheduler.stop(),this.shared()||this.clock().stop(),this.stopLocal(!1),this.armed.clear(),this.armedChanged()}moveCursor(e,t){let n=this.voices();if(n.length===0)return;let i=n[0].length,s=this.cursor?{voice:this.cursor.voice+e,step:this.cursor.step+t}:{voice:0,step:0};this.cursor={voice:N(s.voice,0,n.length-1),step:N(s.step,0,i-1)},this.requestUpdate()}toggleCursorStep(){if(!this.cursor){this.moveCursor(0,0);return}let{voice:e,step:t}=this.cursor,n=this.voices()[e]?.[t];n&&this.writeStep(e,t,{active:!n.active})}info(){let e=this.voices(),t=e[0]?.length||0,n=e.reduce((o,l)=>o+l.filter(c=>c.active).length,0),i=e.length>1?` \xB7 ${e.length} voices`:"",s=Math.max(1,Number(this.measures||1)),a=s===1?"1 measure":`${s} measures`;return`${n}/${t*e.length} steps active${i} \xB7 ${this.bpm} BPM \xB7 ${a} \xB7 ${this.actualLength()} steps`}render(){let e=i=>i.stopPropagation(),t=i=>{i.stopPropagation(),this.clock().setTempo(i.detail.value)},n=this.armed.size>0;return u`<nbplay-header badge="sequencer"></nbplay-header>
      <div class="nbplay-seq-transport">
        <button
          type="button"
          class="nbplay-seq-btn nbplay-seq-play ${this.isPlaying?"playing":""}"
          title="Play/Stop"
          @click=${()=>this.togglePlay()}
        >
          ${this.isPlaying?"\u23F8":"\u25B6"}
        </button>
        <button
          type="button"
          class="nbplay-seq-btn nbplay-seq-stop"
          title="Stop"
          @click=${()=>this.stopAndRewind()}
        >
          ■
        </button>
        <button
          type="button"
          class="nbplay-seq-btn nbplay-seq-rec ${n?"recording":""}"
          title="Record from keyboard"
          ?hidden=${!this.keyboardConnected}
          @click=${()=>this.toggleRecordAll()}
        >
          ⏺
        </button>
        <nbplay-param
          class="nbplay-seq-bpm"
          label="BPM"
          kind="bpm"
          .value=${this.bpm}
          .min=${ra}
          .max=${aa}
          .step=${1}
          .defaultValue=${120}
          @input=${t}
          @change=${t}
        ></nbplay-param>
        <label class="nbplay-seq-field">
          <span class="nbplay-seq-label">Step</span>
          <select
            class="nbplay-seq-dur-select"
            .value=${String(this.stepDuration)}
            @input=${e}
            @change=${i=>{i.stopPropagation(),this.applyGrid({stepDuration:parseFloat(i.target.value)})}}
          >
            ${Ss.map(i=>u`<option
                  value=${i}
                  ?selected=${i===this.stepDuration}
                  .textContent=${`1/${4/i}`}
                ></option>`)}
          </select>
        </label>
        <label class="nbplay-seq-field">
          <span class="nbplay-seq-label">Bars</span>
          <input
            type="number"
            class="nbplay-seq-measures-input"
            min="1"
            max="64"
            step="1"
            .value=${String(this.measures||1)}
            @change=${e}
            @input=${i=>{i.stopPropagation();let s=parseInt(i.target.value,10);Number.isNaN(s)||this.applyGrid({measures:s})}}
          />
          <span class="nbplay-seq-length-val"
            >${this.actualLength()} steps</span
          >
        </label>
        <label class="nbplay-seq-loop-label">
          <input
            type="checkbox"
            class="nbplay-seq-loop-chk"
            .checked=${this.loopEnabled}
            @input=${e}
            @change=${i=>{i.stopPropagation(),this.loopEnabled=i.target.checked,this.set({loopEnabled:this.loopEnabled})}}
          />
          Loop
        </label>
      </div>
      <nbplay-step-grid
        .voices=${this.voices()}
        .currentStep=${this.currentStep}
        .cursor=${this.cursor}
        .pending=${this.pending}
        .armed=${Array.from(this.armed)}
        .showArm=${this.keyboardConnected}
        @input=${e}
        @change=${i=>{i.stopPropagation();let{voice:s,step:a,field:o,value:l}=i.detail;this.writeStep(s,a,{[o]:l})}}
        @nbplay-arm=${i=>{i.stopPropagation();let{voice:s,armed:a}=i.detail;this.toggleArm(s,a)}}
        @nbplay-step-pick=${i=>{i.stopPropagation();let{voice:s,step:a}=i.detail;this.waitForNote(s,a)}}
      ></nbplay-step-grid>
      <div class="nbplay-seq-footer">
        <span class="nbplay-seq-info">${this.info()}</span>
      </div>`}};k("nbplay-sequencer",bn);function X(r,e){let t=Number(r);return Number.isFinite(t)?Math.max(0,Math.min(127,Math.round(t))):e}function Ns(r,e,t){return e>=r.note_low&&e<=r.note_high&&t>=r.velocity_low&&t<=r.velocity_high}function Ps(r,e=2048){if(r.length<=e)return r.slice();let t=new Float32Array(e),n=r.length/e;for(let i=0;i<e;i++)t[i]=r[Math.floor(i*n)];return t}function Re(r){let e=new ArrayBuffer(r.length*4),t=new DataView(e);for(let n=0;n<r.length;n++)t.setFloat32(n*4,r[n],!0);return t}function da(r){let e=new Float32Array(r.length),t=Math.max(1,r.numberOfChannels);for(let n=0;n<t;n++){let i=r.getChannelData(n);for(let s=0;s<e.length;s++)e[s]+=i[s]/t}return e}async function ge(r){let e=z();if(!e)return null;try{let t=await e.decodeAudioData(r);return{samples:da(t),sampleRate:t.sampleRate}}finally{e.state!=="closed"&&e.close()}}function ws(r=8){let e=Math.max(1,Math.round(r||8)),t=null,n=null,i=!0,s=[],a=null,o=null,l=44100,c=[];function d(){if(!t||!o||o.length===0)return!1;if(a)return!0;a=t.createBuffer(1,o.length,l);let m=a.getChannelData(0);for(let y=0;y<o.length;y++)m[y]=o[y];return!0}function p(m){let y=s.indexOf(m);y>=0&&s.splice(y,1);try{m.gainNode.disconnect()}catch{}}function h(m){return!t||m.samples.length===0?null:(m.buffer||(m.buffer=t.createBuffer(1,m.samples.length,m.sample_rate),m.buffer.getChannelData(0).set(m.samples)),m.buffer)}return{setMaxVoices(m){e=Math.max(1,Math.round(Number(m)||8))},setSession(m,y){if(m&&y>=0){let f=P(m);if(f?.audioCtx&&f.channels?.[y]){t!==f.audioCtx&&(i&&t&&(this.stopAll(),t.state!=="closed"&&t.close()),a=null,c.forEach($=>$.buffer=null)),t=f.audioCtx,n=f.channels[y].gain,i=!1;return}}},setWaveformData(m,y){if(!(!m||m.length===0)){o=new Float32Array(m.length);for(let f=0;f<m.length;f++)o[f]=m[f];l=y,a=null,t||(t=z({sampleRate:y}),t&&(i=!0))}},setZones(m){c=m.map(y=>({...y,buffer:null})),!t&&c.length>0&&(t=z(),t&&(i=!0))},zoneFor(m,y){return c.find(f=>Ns(f,m,y))},noteOn(m,y,f,$=127,b,E,v){let S=c.find(O=>Ns(O,m,q($,127))),T=S?h(S):null;if(!t||!T&&!d())return;t.state==="suspended"&&t.resume();let A=m-(S?S.root_note:y),_=Math.pow(2,A/12),j=!T&&b!==void 0&&b.end>b.start&&b.start>=0&&b.end<=o.length,Z=E??t.currentTime,{sourceNode:F,gainNode:pe,releaseTime:$e}=Qe(t,n||t.destination,{buffer:T||a,playbackRate:_,loop:!j&&!T,region:j&&b?{offset:b.start/l,length:(b.end-b.start)/l}:void 0,envelope:f,peak:q($,127)/127,at:Z,duration:v}),te={gainNode:pe,sourceNode:F,noteNum:m,startTime:Z,releaseTime:$e};F.onended=()=>p(te),s.push(te);let C=s.filter(O=>O.releaseTime===null);if(C.length>e){let O=C[0];O.releaseTime=Z;try{O.sourceNode.stop(Z)}catch{}}return te},noteOff(m,y){s.filter(f=>f.noteNum===m&&f.releaseTime===null).forEach(f=>this.releaseVoice(f,y))},releaseVoice(m,y,f){if(!t||m.releaseTime!==null)return;let $=f??t.currentTime;m.releaseTime=$;let b=m.gainNode.gain.value;m.gainNode.gain.setValueAtTime(b,$),m.gainNode.gain.linearRampToValueAtTime(0,$+y.release),m.sourceNode.stop($+y.release),setTimeout(()=>p(m),($-t.currentTime+y.release)*1e3+10)},cancelVoice(m){try{m.sourceNode.stop(0)}catch{}p(m)},getActiveVoiceCount(){return s.filter(m=>m.releaseTime===null).length},stopAll(){if(!t)return;let m=t.currentTime;[...s].forEach(y=>{try{y.sourceNode.stop(m)}catch{}p(y)}),s.length=0},destroy(){this.stopAll(),i&&t&&t.state!=="closed"&&t.close(),t=null,n=null,i=!0}}}var pa=[...Xn,"synth","fm","sample","track"].map(r=>({value:r,label:r==="fm"?"FM":r[0].toUpperCase()+r.slice(1)})),ai=[8,16,32],ha=[.5,.25,.125],ma=30,ba=300,Cs={amplitude:.5,ratio:2,index:2,attack:.005,decay:.2,sustain:.6,release:.2};function Ts(r){return r.replace(/_([a-z0-9])/g,(e,t)=>t.toUpperCase())}function Ms(r){let e={...Y};for(let[t,n]of Object.entries(r)){let i=t==="oscillator_type"?"type":Ts(t);i in e&&(e[i]=n)}return e}function fa(r){let e={...Cs};for(let t of Object.keys(Cs))t in r&&(e[t]=Number(r[t]));return e}var w=(r,e)=>{let t=Number(r);return Number.isFinite(t)?t:e},fn=class extends g{static properties={pads:{attribute:!1},samples:{attribute:!1},pattern:{attribute:!1},steps:{type:Number},stepDuration:{type:Number,attribute:"step-duration"},swing:{type:Number},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},velocity:{type:Number},presetNames:{attribute:!1},presetRequest:{type:String,attribute:"preset-request"},soundPresetNames:{attribute:!1},sessionTracks:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},currentStep:{type:Number,attribute:!1},selected:{state:!0},lit:{state:!0}};binding=null;instrument={scheduleNote:(e,t,n)=>this.playNote(e,t,n),startNote:(e,t,n)=>{this.playNote(e,t,n),(this.pads||[]).forEach((i,s)=>{i.note===e&&this.flash(s)})}};scheduler=Be({instrument:()=>this.instrument});registration=null;buffers=new Map;buffersCtx=null;forwarding=!1;ringing=[];shim={get:e=>e==="voices_data"?this.voices():e==="loop_enabled"?!0:e==="groove"||e==="automation_lanes"?[]:this[Ts(e)],set:(e,t)=>{e==="current_step"&&(this.currentStep=Number(t),this.status(!1,{currentStep:this.currentStep}))},save_changes:()=>{},on:()=>{}};constructor(){super(),this.pads=[],this.samples={},this.pattern=[],this.steps=16,this.stepDuration=.25,this.swing=0,this.bpm=120,this.timeSignatureNum=4,this.timeSignatureDen=4,this.velocity=100,this.presetNames=[],this.presetRequest="",this.soundPresetNames={},this.sessionTracks=[],this.sessionId="",this.channelIndex=-1,this.isPlaying=!1,this.currentStep=-1,this.selected=0,this.lit=[]}clock(){if(!this.binding){this.binding=H(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.isPlaying=e.playing,e.playing&&this.startScheduler()}return this.binding.clock()}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-drums"),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.clock(),this.register()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.unregister(),this.scheduler.destroy(),this.binding?.dispose(),this.binding=null}updated(e){if(e.has("samples")&&this.buffers.clear(),(e.has("sessionId")||e.has("channelIndex"))&&this.register(),!this.binding)return;let t=e.has("sessionId")&&e.get("sessionId")!==void 0;t&&this.binding.rebind();let n=this.clock();e.has("bpm")&&!t&&Number(this.bpm)!==n.bpm&&n.setTempo(Number(this.bpm)),e.has("isPlaying")&&e.get("isPlaying")!==void 0&&this.onPlayStateChange(n)}shared(){return!!this.sessionId}set(e){this.emitDetail("nbplay-set",{values:e})}status(e,t){this.emitDetail("nbplay-status",{values:t,save:e})}startScheduler(){this.scheduler.isPlaying()||this.scheduler.start(this.shim,this.clock())}stopLocal(e){this.scheduler.stop(),this.isPlaying=!1,this.currentStep=-1,this.status(e,{isPlaying:!1,currentStep:-1})}onClockEvent=e=>{switch(e.type){case"play":this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0});break;case"stop":this.stopLocal(!0);break;case"seek":case"loop":this.scheduler.realign();break;case"tempo":{this.scheduler.realign();let t=this.clock().bpm;Number(this.bpm)!==t&&(this.bpm=t,this.set({bpm:t}));break}}};joinTempo(e){let t=e.adoptTempo(Number(this.bpm));t!==Number(this.bpm)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.scheduler.stop(),this.joinTempo(e),this.currentStep=-1,e.playing&&this.startScheduler(),this.isPlaying=this.scheduler.isPlaying(),this.status(!1,{isPlaying:this.isPlaying,currentStep:-1})};onPlayStateChange(e){if(this.shared()){let t=this.scheduler.isPlaying();!!this.isPlaying!==t&&(this.isPlaying=t,this.status(!0,{isPlaying:t}));return}this.isPlaying?e.playing?this.startScheduler():e.play():(this.scheduler.stop(),e.stop())}togglePlay(){let e=this.clock();this.isPlaying?this.shared()?this.stopLocal(!0):e.stop():e.playing?(this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0})):e.play()}stopAndRewind(){let e=this.clock();e.playing?e.stop():this.stopLocal(!0),e.seek(0)}halt(){this.scheduler.stop(),this.shared()||this.clock().stop(),this.stopLocal(!1),this.ringing.forEach(e=>e.cancel())}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.register()};unregister(){if(this.ringing.forEach(i=>i.cancel()),!this.registration)return;let{bus:e,idx:t,entry:n}=this.registration;e.instruments?.[t]===n&&delete e.instruments[t],this.registration=null}register(){let e=this.sessionId,t=Number(this.channelIndex);if(this.unregister(),!e||!(t>=0))return;let n=P(e);n&&(n.instruments=n.instruments||{},n.instruments[t]=this.instrument,this.registration={bus:n,idx:t,entry:this.instrument})}voices(){let e=Math.max(1,Math.round(w(this.steps,16)));return(this.pads||[]).map((t,n)=>{let i=this.pattern?.[n]||[];return Array.from({length:e},(s,a)=>{let o=w(i[a],0);return{active:o>0,note:t.note,velocity:o}})})}audio(){let e=this.clock().context();if(!e)return null;e.state==="suspended"&&e.resume();let t=this.sessionId?P(this.sessionId):void 0,n=Number(this.channelIndex),i=(n>=0?t?.channels?.[n]?.gain:void 0)||t?.masterGain||e.destination;return{ctx:e,output:i}}sampleBuffer(e,t){e!==this.buffersCtx&&(this.buffers.clear(),this.buffersCtx=e);let n=this.buffers.get(t);if(n)return n;let i=this.samples?.[t],s=i?W(i.data):null;if(!i||!s?.length)return null;let a=e.createBuffer(1,s.length,w(i.sample_rate,44100));return a.getChannelData(0).set(s),this.buffers.set(t,a),a}playNote(e,t,n){let i=(this.pads||[]).flatMap((s,a)=>s.note===e?[this.hit(a,t,n)]:[]);return()=>i.forEach(s=>s())}hit(e,t,n){let i=this.pads?.[e],s=this.audio();if(!i||!s)return()=>{};let{ctx:a,output:o}=s,l=n??a.currentTime;if(i.sound==="track")return this.hitTrack(i,t,l);let c=w(i.choke,0);if(c>0)for(let f of this.ringing)f.choke!==c||f.at>=l||(f.gain.gain.cancelScheduledValues(l),f.gain.gain.setTargetAtTime(0,l,.005));let d=a.createGain();d.gain.value=w(i.gain,1);let p=a.createStereoPanner?.();p?(p.pan.value=w(i.pan,0),d.connect(p).connect(o)):d.connect(o);let h={choke:c,at:l,gain:d,cancel:()=>{}},m=()=>{this.ringing=this.ringing.filter(f=>f!==h);for(let f of[d,p])try{f?.disconnect()}catch{}},y=i.params||{};if(i.sound==="sample"){let f=this.sampleBuffer(a,String(y.sample??""));if(!f)return m(),()=>{};let{sourceNode:$}=Qe(a,d,{buffer:f,playbackRate:2**(w(y.tune,0)/12),loop:!1,envelope:{attack:0,decay:0,sustain:1,release:.01},peak:Math.max(0,Math.min(127,t))/127,at:l,duration:w(y.length,4)});$.onended=m,h.cancel=()=>{try{$.stop()}catch{}m()}}else if(i.sound==="synth"||i.sound==="fm"){let f=w(y.pitch,60),$=w(y.length,.25);h.cancel=i.sound==="synth"?Ze(a,d,Ms(y),f,t,l,$,m):Ye(a,d,fa(y),f,t,l,$,m)}else h.cancel=Jn(a,d,{sound:i.sound,tune:w(y.tune,0),decay:w(y.decay,.3),tone:w(y.tone,.5)},t,l,m);return this.ringing.push(h),h.cancel}hitTrack(e,t,n){let i=e.params||{},a=(this.sessionId?P(this.sessionId):void 0)?.instruments?.[w(i.track,-1)];if(!a||this.forwarding)return()=>{};let o=Math.max(1,Math.min(127,Math.round(t*w(e.gain,1))));this.forwarding=!0;try{return a.scheduleNote(w(i.pitch,60),o,n,w(i.length,.25))||(()=>{})}finally{this.forwarding=!1}}editPad(e,t,n={}){let i=(this.pads||[]).map(l=>({...l}));if(!i[e])return;i[e]={...i[e],...t},this.pads=i;let s={...this.samples,...n},a=new Set(i.filter(l=>l.sound==="sample").map(l=>l.params?.sample)),o=Object.fromEntries(Object.entries(s).filter(([l])=>a.has(l)));if(Object.keys(o).length===Object.keys(this.samples||{}).length&&!Object.keys(n).length){this.set({pads:i});return}this.samples=o,this.set({pads:i,samples:o})}async loadPadFile(e,t){let n=await ge(await t.arrayBuffer()),i=this.pads?.[e];if(!n||!i)return;let s=Math.random().toString(16).slice(2,10),a=i.sound==="sample"?i.params:{};this.editPad(e,{sound:"sample",params:{tune:a.tune??0,length:a.length??4,sample:s}},{[s]:{name:t.name,sample_rate:n.sampleRate,data:Re(n.samples)}})}editParams(e,t){let n=this.pads?.[e];n&&this.editPad(e,{params:{...n.params,...t}})}onPatternChange=e=>{e.stopPropagation();let{pad:t,step:n,value:i}=e.detail,s=Math.max(1,Math.round(w(this.steps,16))),a=(this.pads||[]).map((o,l)=>{let c=(this.pattern?.[l]||[]).slice(0,s);for(;c.length<s;)c.push(0);return c});a[t]&&(a[t][n]=i,this.pattern=a,this.set({pattern:a}))};flash(e){this.lit=[...this.lit.filter(t=>t!==e),e],setTimeout(()=>{this.lit=this.lit.filter(t=>t!==e)},120)}param(e,t,n,i,s,a,o,l,c,d={}){let p=h=>{h.stopPropagation();let m=h.detail.value;m!==n&&c(m)};return u`<nbplay-param
      class=${e}
      .label=${t}
      .kind=${i}
      .control=${d.control??"dial"}
      .scale=${d.scale??"linear"}
      .unit=${d.unit??""}
      .value=${n}
      .min=${s}
      .max=${a}
      .step=${o}
      .defaultValue=${l}
      .precision=${2}
      @input=${p}
      @change=${p}
    ></nbplay-param>`}renderTrackParams(e,t){let n=a=>o=>this.editParams(e,{[a]:o}),i=w(t.track,-1),s=(this.sessionTracks||[]).filter(a=>a.channel_index!==Number(this.channelIndex));return u`<label class="nbplay-drums-preset">
        <span>Track</span>
        <select
          class="nbplay-drums-track-select"
          @input=${a=>a.stopPropagation()}
          @change=${a=>{a.stopPropagation();let o=parseInt(a.target.value,10);this.editParams(e,{track:o})}}
        >
          <option value="-1" ?selected=${i<0}>—</option>
          ${s.map(a=>u`<option
                value=${a.channel_index}
                ?selected=${a.channel_index===i}
              >
                ${a.name}
              </option>`)}
        </select>
      </label>
      ${this.param("nbplay-drums-pitch","Pitch",w(t.pitch,60),"note",0,127,1,60,n("pitch"))}
      ${this.param("nbplay-drums-length","Length",w(t.length,.25),"seconds",.01,4,.01,.25,n("length"),{scale:"log"})}`}renderSampleParams(e,t){let n=this.samples?.[String(t.sample??"")],i=s=>a=>this.editParams(e,{[s]:a});return u`<div class="nbplay-drums-sample">
        <span class="nbplay-drums-sample-name"
          >${n?.name??"No sample"}</span
        >
        <label class="nbplay-drums-sample-load" title="Load an audio file"
          >Load…<input
            type="file"
            class="nbplay-drums-sample-file"
            aria-label="Sample file"
            accept="audio/*"
            @input=${s=>s.stopPropagation()}
            @change=${s=>{s.stopPropagation();let a=s.target,o=a.files?.[0];a.value="",o&&this.loadPadFile(e,o)}}
        /></label>
      </div>
      ${this.param("nbplay-drums-tune","Tune",w(t.tune,0),"float",-24,24,.1,0,i("tune"),{unit:" st"})}
      ${this.param("nbplay-drums-length","Length",w(t.length,4),"seconds",.01,4,.01,4,i("length"),{scale:"log"})}`}renderEditor(e){let t=this.pads?.[e];if(!t)return x;let n=t.params||{},i=l=>this.editPad(e,l),s=l=>c=>this.editParams(e,{[l]:c}),a=t.sound==="synth"||t.sound==="fm",o=this.soundPresetNames?.[t.sound]||[];return u`<div class="nbplay-drums-editor">
      <div class="nbplay-drums-editor-head">
        <input
          type="text"
          class="nbplay-drums-pad-name"
          aria-label="Pad name"
          .value=${t.name}
          @input=${l=>l.stopPropagation()}
          @change=${l=>{l.stopPropagation();let c=l.target.value.trim();c&&c!==t.name&&i({name:c})}}
        />
        ${this.param("nbplay-drums-note","Note",w(t.note,36),"note",0,127,1,36,l=>i({note:l}),{control:"slider"})}
      </div>
      <nbplay-segmented
        class="nbplay-drums-sound"
        label="Sound"
        .options=${pa}
        .value=${t.sound}
        @change=${l=>{l.stopPropagation();let c=l.detail.value;c!==t.sound&&i({sound:c,params:{}})}}
      ></nbplay-segmented>
      <div class="nbplay-drums-params">
        ${a?u`<label class="nbplay-drums-preset">
                  <span>Preset</span>
                  <select
                    class="nbplay-drums-preset-select"
                    @input=${l=>l.stopPropagation()}
                    @change=${l=>{l.stopPropagation();let c=l.target.value;c&&i({params:{preset:c,pitch:n.pitch,length:n.length}})}}
                  >
                    <option value="" ?selected=${!n.preset}>—</option>
                    ${o.map(l=>u`<option
                          value=${l}
                          ?selected=${n.preset===l}
                        >
                          ${l}
                        </option>`)}
                  </select>
                </label>
                ${this.param("nbplay-drums-pitch","Pitch",w(n.pitch,60),"note",0,127,1,60,s("pitch"))}
                ${this.param("nbplay-drums-length","Length",w(n.length,.25),"seconds",.01,4,.01,.25,s("length"),{scale:"log"})}`:t.sound==="sample"?this.renderSampleParams(e,n):t.sound==="track"?this.renderTrackParams(e,n):u`${this.param("nbplay-drums-tune","Tune",w(n.tune,0),"float",-24,24,.1,0,s("tune"),{unit:" st"})}
                  ${this.param("nbplay-drums-decay","Decay",w(n.decay,.3),"seconds",.01,4,.01,.3,s("decay"),{scale:"log"})}
                  ${this.param("nbplay-drums-tone","Tone",w(n.tone,.5),"percent",0,1,.01,.5,s("tone"))}`}
        ${this.param("nbplay-drums-gain","Gain",w(t.gain,1),"db",0,2,.01,1,l=>i({gain:l}))}
        ${t.sound==="track"?x:u`${this.param("nbplay-drums-pan","Pan",w(t.pan,0),"pan",-1,1,.01,0,l=>i({pan:l}))}
              ${this.param("nbplay-drums-choke","Choke",w(t.choke,0),"int",0,8,1,0,l=>i({choke:Math.round(l)}))}`}
      </div>
    </div>`}render(){let e=this.pads||[],t=4,n=Math.max(1,Math.ceil(e.length/t)),i=Math.min(this.selected,Math.max(0,e.length-1)),s=Array.from({length:n*t},(c,d)=>e[d]?{note:e[d].note,velocity:w(this.velocity,100),label:e[d].name}:{note:0,velocity:0,label:""}),a=Math.max(1,Math.round(w(this.steps,16))),o=ai.includes(a)?ai:[...ai,a].sort((c,d)=>c-d),l=Math.max(1,Math.round(1/w(this.stepDuration,.25)));return u`<nbplay-header badge="drums"
        >${Ae(this.presetNames,c=>{this.presetRequest=Me(c,this.presetRequest),this.status(!0,{presetRequest:this.presetRequest})})}</nbplay-header
      >
      <div class="nbplay-drums-transport">
        <button
          type="button"
          class="nbplay-drums-btn nbplay-drums-play ${this.isPlaying?"playing":""}"
          title="Play/Stop"
          @click=${()=>this.togglePlay()}
        >
          ${this.isPlaying?"\u23F8":"\u25B6"}
        </button>
        <button
          type="button"
          class="nbplay-drums-btn nbplay-drums-stop"
          title="Stop"
          @click=${()=>this.stopAndRewind()}
        >
          ■
        </button>
        ${this.param("nbplay-drums-bpm","BPM",w(this.bpm,120),"bpm",ma,ba,1,120,c=>this.clock().setTempo(c),{control:"slider"})}
        <label class="nbplay-drums-field">
          <span>Steps</span>
          <select
            class="nbplay-drums-steps"
            @input=${c=>c.stopPropagation()}
            @change=${c=>{c.stopPropagation(),this.steps=parseInt(c.target.value,10),this.set({steps:this.steps})}}
          >
            ${o.map(c=>u`<option value=${c} ?selected=${c===a}>
                  ${c}
                </option>`)}
          </select>
        </label>
        <label class="nbplay-drums-field">
          <span>Step</span>
          <select
            class="nbplay-drums-step-duration"
            @input=${c=>c.stopPropagation()}
            @change=${c=>{c.stopPropagation(),this.stepDuration=parseFloat(c.target.value),this.set({stepDuration:this.stepDuration})}}
          >
            ${ha.map(c=>u`<option
                  value=${c}
                  ?selected=${c===w(this.stepDuration,.25)}
                >
                  1/${4/c}
                </option>`)}
          </select>
        </label>
        ${this.param("nbplay-drums-swing","Swing",w(this.swing,0),"int",0,100,1,0,c=>{this.swing=c,this.set({swing:c})},{control:"slider",unit:"%"})}
      </div>
      <div class="nbplay-drums-main">
        <nbplay-pad-grid
          .rows=${n}
          .cols=${t}
          .pads=${s}
          .active=${this.lit}
          @nbplay-note-on=${c=>{c.stopPropagation();let{index:d,velocity:p}=c.detail;d>=e.length||(this.selected=d,this.hit(d,p),this.flash(d))}}
          @nbplay-note-off=${c=>c.stopPropagation()}
        ></nbplay-pad-grid>
        ${this.renderEditor(i)}
      </div>
      <nbplay-drum-grid
        .pattern=${this.voices().map(c=>c.map(d=>d.active?d.velocity:0))}
        .names=${e.map(c=>c.name)}
        .currentStep=${this.currentStep}
        .selected=${i}
        .velocity=${w(this.velocity,100)}
        .group=${l}
        @input=${c=>c.stopPropagation()}
        @change=${this.onPatternChange}
        @nbplay-select=${c=>{c.stopPropagation(),this.selected=c.detail.pad}}
      ></nbplay-drum-grid>`}};k("nbplay-drums",fn);var As=-2,_e=-1,va=25;function G(r,e){let t=Number(r);return Number.isFinite(t)?t:e}function Bs(r){return JSON.stringify([r.voices_data,r.step_duration,r.swing,r.groove])}var tt=new Map,nt=new Map,vn=class extends g{static properties={tracks:{attribute:!1},scenes:{attribute:!1},slots:{attribute:!1},quantize:{type:String},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},selectedSlot:{attribute:!1},engineKey:{type:String,attribute:"engine-key"},sessionId:{type:String,attribute:"session-id",reflect:!0},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},activeSlots:{attribute:!1},queuedSlots:{attribute:!1}};states=[];binding=null;queueTimer=null;unbindShortcuts=null;progress=[];engine=null;joined="";busEntry=null;constructor(){super(),this.tracks=[],this.scenes=[],this.slots=[],this.quantize="bar",this.bpm=120,this.timeSignatureNum=4,this.timeSignatureDen=4,this.selectedSlot={},this.engineKey="",this.sessionId="",this.isPlaying=!1,this.activeSlots=[],this.queuedSlots=[]}trackList(){return(this.tracks||[]).map((e,t)=>({name:String(e.name??`Track ${t+1}`),channel_index:G(e.channel_index,t)}))}sceneList(){return(this.scenes||[]).map(String)}slotList(){return(this.slots||[]).filter(e=>Array.isArray(e.voices_data)&&e.voices_data.length).map(e=>({track_index:G(e.track_index,0),scene_index:G(e.scene_index,0),name:String(e.name??"Clip"),voices_data:e.voices_data,step_duration:Math.max(.001,G(e.step_duration,.25)),swing:G(e.swing,0),groove:(e.groove||[]).map(t=>G(t,0))}))}findSlot(e,t){return this.slotList().find(n=>n.track_index===e&&n.scene_index===t)||null}beatsPerBar(){return se(this.timeSignatureNum,this.timeSignatureDen)}slotModel(e,t,n){return{get:i=>{switch(i){case"voices_data":return t.voices_data;case"step_duration":return t.step_duration;case"swing":return t.swing;case"groove":return t.groove;case"loop_enabled":return!0;case"automation_lanes":return[];case"session_id":return this.sessionId;case"channel_index":return e.channel_index;default:return}},set:(i,s)=>{i==="current_step"&&n(G(s,-1))},save_changes:()=>{},on:()=>{}}}clock(){if(!this.binding){this.binding=H(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.isPlaying=e.playing,this.activeSlots=this.trackList().map(()=>-1),this.queuedSlots=this.trackList().map(()=>As)}return this.binding.clock()}shared(){return!!this.sessionId}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-launcher"),this.tabIndex=0,this.clock(),this.ensureStates(),this.join(),this.registerBus();let e={Space:()=>{let t=this.clock();t.playing?t.stop():t.play()},Escape:()=>this.stopAll(),0:()=>this.stopAll()};for(let t=1;t<=9;t++)e[String(t)]=()=>{if(t-1>=this.sceneList().length)return!1;this.launchScene(t-1)};this.unbindShortcuts=le(this,e)}disconnectedCallback(){super.disconnectedCallback(),this.leave(),this.unregisterBus(),this.stopQueueTimer(),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.states.forEach(e=>{this.release(e),e.scheduler.destroy()}),this.states.length=0,this.binding?.dispose(),this.binding=null}registerBus(){if(this.unregisterBus(),!this.sessionId||!this.isConnected)return;let e=ue(this.sessionId),t={command:n=>this.command(n)};e.launcher=t,this.busEntry={bus:e,entry:t}}unregisterBus(){this.busEntry&&this.busEntry.bus.launcher===this.busEntry.entry&&delete this.busEntry.bus.launcher,this.busEntry=null}join(){this.leave();let e=this.isConnected?this.engineKey:"";if(!e)return;this.joined=e;let t=tt.get(e);if(!t){tt.set(e,this);return}this.engine=t,nt.has(e)||nt.set(e,new Set),nt.get(e)?.add(this),this.stopQueueTimer(),this.states.forEach(n=>{n.scheduler.stop(),this.release(n),n.queued=null,n.currentStep=-1})}leave(){let e=this.joined;if(!e)return;this.joined="";let t=nt.get(e);if(this.engine){t?.delete(this),this.engine=null;return}if(tt.get(e)!==this)return;tt.delete(e);let n=t?.values().next().value;n&&(t?.delete(n),tt.set(e,n),t?.forEach(i=>{i.engine=n}),n.takeOver())}takeOver(){this.engine=null,this.ensureStates(),this.states.forEach((e,t)=>{e.activeScene=G(this.activeSlots?.[t],-1)}),this.clock().playing&&this.resumeActive(),this.mirrorSlotState(!0)}updated(e){if(e.has("sessionId")&&this.registerBus(),!this.binding)return;e.has("engineKey")&&this.join();let t=e.has("sessionId")&&e.get("sessionId")!==void 0;if(t&&this.binding.rebind(),e.has("bpm")&&e.get("bpm")!==void 0&&!t&&this.clock().setTempo(G(this.bpm,120)),!this.engine&&(e.has("tracks")&&e.get("tracks")!==void 0&&(this.trackList().length<this.states.length&&this.clearStates(),this.ensureStates(),this.mirrorSlotState(!0)),e.has("slots")&&e.get("slots")!==void 0&&(this.states.forEach((n,i)=>{if(n.activeScene<0||!this.clock().playing)return;let s=this.findSlot(i,n.activeScene);if(!s){this.stopNow(i);return}Bs(s)!==n.activeData&&this.startSlot(i,n.activeScene)}),this.mirrorSlotState(!0)),e.has("isPlaying")&&e.get("isPlaying")!==void 0&&!this.shared())){let n=this.clock();this.isPlaying?n.playing||n.play():n.playing&&n.stop()}}set(e){this.emitDetail("nbplay-set",{values:e})}status(e,t){this.emitDetail("nbplay-status",{values:t,save:e})}ensureStates(){let e=this.trackList().length;for(;this.states.length<e;){let t=this.states.length;this.states.push({scheduler:Be({onEnd:()=>this.stopNow(t),owner:"launcher"}),activeScene:-1,activeData:"",queued:null,currentStep:-1,claim:null})}for(;this.states.length>e;){let t=this.states.pop();t&&this.release(t),t?.scheduler.destroy()}}hold(e,t){this.release(e),!(!this.sessionId||!(t>=0))&&(e.claim={sessionId:this.sessionId,channel:t},Yt(this.sessionId,t,"launcher"))}release(e){e.claim&&(Qt(e.claim.sessionId,e.claim.channel,"launcher"),e.claim=null)}clearStates(){this.states.forEach(e=>{e.scheduler.stop(),this.release(e),e.activeScene=-1,e.activeData="",e.queued=null,e.currentStep=-1})}mirrorSlotState(e){this.activeSlots=this.states.map(t=>t.activeScene),this.queuedSlots=this.states.map(t=>t.queued?t.queued.scene:As),this.syncProgress(),this.status(e,{activeSlots:this.activeSlots,queuedSlots:this.queuedSlots})}syncProgress(){this.progress=this.states.map((e,t)=>{if(e.activeScene<0||e.currentStep<0)return 0;let n=this.findSlot(t,e.activeScene)?.voices_data[0]?.length||0;return n>0?(e.currentStep+1)/n:0}),this.requestUpdate(),nt.get(this.joined)?.forEach(e=>e.requestUpdate())}onClockEvent=e=>{if(!this.engine)switch(e.type){case"play":this.isPlaying=!0,this.status(!0,{isPlaying:!0}),this.startQueueTimer();break;case"stop":this.stopQueueTimer(),this.clearStates(),this.isPlaying=!1,this.status(!0,{isPlaying:!1}),this.mirrorSlotState(!0);break;case"tempo":{let t=this.clock().bpm;G(this.bpm,120)!==t&&(this.bpm=t,this.set({bpm:t})),this.states.forEach(n=>n.scheduler.realign()),this.requantize();break}case"seek":case"loop":this.states.forEach(t=>t.scheduler.realign()),this.requantize();break;case"record":case"timesig":break}};joinTempo(e){let t=e.adoptTempo(G(this.bpm,120));t!==G(this.bpm,120)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.states.forEach(t=>t.scheduler.stop()),this.joinTempo(e),!this.engine&&(this.isPlaying=e.playing,this.status(!1,{isPlaying:e.playing}),e.playing?this.resumeActive():this.clearStates(),this.syncProgress())};startSlot(e,t){this.ensureStates();let n=this.states[e],i=this.trackList()[e],s=this.findSlot(e,t);return!n||!i||!s?!1:(n.scheduler.stop(),this.hold(n,i.channel_index),n.activeScene=t,n.activeData=Bs(s),n.currentStep=-1,this.clock().playing&&n.scheduler.start(this.slotModel(i,s,a=>{n.currentStep=a,this.syncProgress()}),this.clock()),!0)}stopNow(e){let t=this.states[e];t&&(t.scheduler.stop(),this.release(t),t.activeScene=-1,t.activeData="",t.currentStep=-1)}resumeActive(){this.ensureStates(),this.states.forEach((e,t)=>{e.activeScene>=0&&this.startSlot(t,e.activeScene)})}nextBoundary(e){let t=String(this.quantize||"bar");if(t==="none")return e;let n=t==="beat"?1:this.beatsPerBar(),i=Math.ceil(e/n-1e-6)*n;return Math.max(e,i)}boundaryTime(e,t,n){let i=e.loop,s=i.enabled&&i.endBeat>i.startBeat&&n>i.endBeat?i.endBeat:n;return e.now()+Math.max(0,s-t)*e.secondsPerBeat()}applyNow(e){e.scene>=0?this.startSlot(e.trackIndex,e.scene):this.stopNow(e.trackIndex),this.states[e.trackIndex].queued=null}applyLaunches(e){if(this.engine){this.engine.applyLaunches(e);return}this.ensureStates();let t=e.filter(o=>this.states[o.trackIndex]);if(!t.length)return;let n=this.clock();if(!n.playing){t.some(o=>o.scene>=0)&&n.play(),t.forEach(o=>this.applyNow(o)),this.mirrorSlotState(!0);return}let i=n.beat(),s=this.nextBoundary(i);if(s<=i+1e-9){t.forEach(o=>this.applyNow(o)),this.mirrorSlotState(!0);return}let a=this.boundaryTime(n,i,s);t.forEach(o=>{this.states[o.trackIndex].queued={scene:o.scene,viaScene:o.viaScene,atBeat:s,atTime:a}}),this.startQueueTimer(),this.mirrorSlotState(!0)}queue(e,t){this.applyLaunches([{trackIndex:e,scene:t,viaScene:t}])}requantize(){let e=this.clock();if(!e.playing||!this.states.some(s=>s.queued))return;let t=e.beat(),n=this.nextBoundary(t),i=this.boundaryTime(e,t,n);this.states.forEach(s=>{s.queued&&(s.queued={...s.queued,atBeat:n,atTime:i})})}processQueue=()=>{let t=this.clock().now(),n=!1;this.states.forEach((i,s)=>{let a=i.queued;a&&t+1e-6>=a.atTime&&(i.queued=null,a.scene>=0?this.startSlot(s,a.scene):this.stopNow(s),n=!0)}),n&&this.mirrorSlotState(!0),this.states.some(i=>i.queued)||this.stopQueueTimer()};startQueueTimer(){this.queueTimer||!this.states.some(e=>e.queued)||(this.queueTimer=setInterval(this.processQueue,va),this.processQueue())}stopQueueTimer(){this.queueTimer&&(clearInterval(this.queueTimer),this.queueTimer=null)}launchScene(e){this.applyLaunches(this.trackList().map((t,n)=>({trackIndex:n,scene:this.findSlot(n,e)?e:_e,viaScene:e})))}stopAll(){this.applyLaunches(this.trackList().map((e,t)=>({trackIndex:t,scene:_e,viaScene:_e})))}command(e){let t=G(e.track_index,-1),n=G(e.scene_index,-1);switch(e.action){case"launch":t>=0&&n>=0&&this.queue(t,n);break;case"stop":t>=0&&this.queue(t,_e);break;case"scene":n>=0&&this.launchScene(n);break;case"stop_all":this.stopAll();break}}onSlot(e,t){this.findSlot(e,t)?(this.selectedSlot={track_index:e,scene_index:t},this.set({selectedSlot:this.selectedSlot}),this.queue(e,t)):this.queue(e,_e)}render(){let e=this.engine??this,t=this.trackList(),n=typeof this.selectedSlot?.track_index=="number"&&typeof this.selectedSlot?.scene_index=="number"?{track:this.selectedSlot.track_index,scene:this.selectedSlot.scene_index}:null,i=s=>s.stopPropagation();return u`<nbplay-header badge="launcher">
        <label class="nbplay-launcher-field" title="Launch quantization">
          <span>Quantize</span>
          <select
            class="nbplay-launcher-quantize"
            .value=${this.quantize}
            @input=${i}
            @change=${s=>{s.stopPropagation(),this.quantize=s.target.value,this.set({quantize:this.quantize})}}
          >
            ${["bar","beat","none"].map(s=>u`<option
                  value=${s}
                  ?selected=${s===this.quantize}
                  .textContent=${s==="none"?"None":s[0].toUpperCase()+s.slice(1)}
                ></option>`)}
          </select>
        </label>
      </nbplay-header>
      <nbplay-launcher-grid
        .tracks=${t.map(s=>({name:s.name,detail:s.channel_index>=0?`Ch ${s.channel_index+1}`:"No channel"}))}
        .scenes=${this.sceneList()}
        .slots=${this.slotList().map(s=>({track:s.track_index,scene:s.scene_index,name:s.name}))}
        .active=${e.states.map(s=>s.activeScene)}
        .queued=${e.states.map(s=>s.queued?s.queued.scene>=0?s.queued.scene:He:-1)}
        .progress=${e.progress}
        .selected=${n}
        .playing=${e.isPlaying}
        @nbplay-launch=${s=>{s.stopPropagation();let{track:a,scene:o}=s.detail;this.onSlot(a,o)}}
        @nbplay-launch-scene=${s=>{s.stopPropagation(),this.launchScene(s.detail.scene)}}
        @nbplay-stop-track=${s=>{s.stopPropagation(),this.queue(s.detail.track,_e)}}
        @nbplay-stop-all=${s=>{s.stopPropagation(),this.stopAll()}}
      ></nbplay-launcher-grid>`}};k("nbplay-launcher",vn);function bi(r,e,t){return Math.max(e,Math.min(t,r))}function D(r,e,t,n,i){let s=r[e];if(s==null||s==="")return bi(t,n,i);let a=Number(s);return bi(Number.isFinite(a)?a:t,n,i)}function I(r,e){let t=ze[r.type]?.find(n=>n.key===e);return D(r,e,t?.default??0,t?.min??-1/0,t?.max??1/0)}function B(r,e){r&&(r.value=e)}function K(r){try{r?.disconnect()}catch{}}function ke(r){r.forEach(e=>{e.dispose?.(),K(e.input),e.output!==e.input&&K(e.output)}),r.length=0}function oi(r){if(!r||typeof r!="object")return!1;let e=r;return typeof e.connect=="function"&&typeof e.disconnect=="function"}function ya(r){if(!r)return null;if(typeof r=="object"&&("input"in r||"output"in r)){let e=r;if(oi(e.input)&&oi(e.output))return{input:e.input,output:e.output,dispose:typeof e.dispose=="function"?e.dispose:void 0,update:typeof e.update=="function"?e.update:void 0};throw new TypeError("effect plugin must return an AudioNode or { input, output } AudioNodes")}if(oi(r))return{input:r,output:r};throw new TypeError("effect plugin must return an AudioNode or { input, output } AudioNodes")}function it(r,e,t){let n=r.createGain(),i=r.createGain(),s=r.createGain(),a=r.createGain();s.gain.value=1-e,a.gain.value=e,n.connect(s),s.connect(i);let o=t(n,a);return a.connect(i),{input:n,output:i,setWet:l=>{s.gain.value=1-l,a.gain.value=l},dispose:()=>{[n,i,s,a,...o].forEach(K)}}}function li(r,e){let t=r.createOscillator(),n=r.createGain();return t.connect(n),e.forEach(i=>{i&&n.connect(i)}),t.start(),{rate:t.frequency,depth:n.gain,stop:()=>{try{t.stop()}catch{}K(t),K(n)}}}function ga(r){let t=r*100,n=new Float32Array(2048);for(let i=0;i<2048;i++){let s=i*2/2047-1;n[i]=(1+t)*s/(1+t*Math.abs(s))}return n}function ka(r,e,t){let n=Math.max(1,Math.floor(r.sampleRate*e)),i=r.createBuffer(2,n,r.sampleRate);for(let s=0;s<i.numberOfChannels;s++){let a=i.getChannelData(s);for(let o=0;o<n;o++){let l=o/n;a[o]=(Math.random()*2-1)*Math.pow(1-l,t)}}return i}function $a(r,e){switch(e.type){case"gain":{let t=r.createGain(),n=i=>(t.gain.value=D(i,"gain",1,0,4),!0);return n(e),{input:t,output:t,update:n}}case"filter":{let t=r.createBiquadFilter(),n=i=>(t.type=String(i.filter_type||"lowpass"),t.frequency.value=D(i,"frequency",1200,20,2e4),t.Q.value=D(i,"q",1,1e-4,100),!0);return n(e),{input:t,output:t,update:n}}case"compressor":{let t=r.createDynamicsCompressor(),n=i=>(B(t.threshold,D(i,"threshold",-24,-100,0)),B(t.knee,D(i,"knee",30,0,40)),B(t.ratio,D(i,"ratio",12,1,20)),B(t.attack,D(i,"attack",.003,0,1)),B(t.release,D(i,"release",.25,0,1)),!0);return n(e),{input:t,output:t,update:n}}case"limiter":{let t=r.createDynamicsCompressor();B(t.knee,0),B(t.ratio,20),B(t.attack,.001);let n=i=>(B(t.threshold,D(i,"threshold",-1,-100,0)),B(t.release,D(i,"release",.05,0,1)),!0);return n(e),{input:t,output:t,update:n}}case"delay":{let t=r.createDelay(5),n=r.createGain(),i=it(r,D(e,"wet",.35,0,1),(a,o)=>(a.connect(t),t.connect(n),n.connect(t),t.connect(o),[t,n])),s=a=>(t.delayTime.value=D(a,"time",.25,0,5),n.gain.value=D(a,"feedback",.25,0,.95),i.setWet(D(a,"wet",.35,0,1)),!0);return s(e),{...i,update:s}}case"reverb":{let t=r.createConvolver(),n=D(e,"seconds",1.5,.01,10),i=D(e,"decay",2,.01,12);t.buffer=ka(r,n,i);let s=it(r,D(e,"wet",.25,0,1),(o,l)=>(o.connect(t),t.connect(l),[t]));return{...s,update:o=>D(o,"seconds",1.5,.01,10)!==n||D(o,"decay",2,.01,12)!==i?!1:(s.setWet(D(o,"wet",.25,0,1)),!0)}}case"eq":{let t=r.createBiquadFilter(),n=r.createBiquadFilter(),i=r.createBiquadFilter();t.type="lowshelf",n.type="peaking",i.type="highshelf",t.connect(n),n.connect(i);let s=a=>(B(t.frequency,I(a,"low_freq")),B(t.gain,I(a,"low")),B(n.frequency,I(a,"mid_freq")),B(n.Q,I(a,"mid_q")),B(n.gain,I(a,"mid")),B(i.frequency,I(a,"high_freq")),B(i.gain,I(a,"high")),!0);return s(e),{input:t,output:i,update:s,dispose:()=>K(n)}}case"distortion":{let t=r.createWaveShaper();t.oversample="4x";let n=r.createBiquadFilter();n.type="lowpass";let i=it(r,I(e,"wet"),(o,l)=>(o.connect(t),t.connect(n),n.connect(l),[t,n])),s=-1,a=o=>{let l=I(o,"drive");return l!==s&&(s=l,t.curve=ga(s)),B(n.frequency,I(o,"tone")),i.setWet(I(o,"wet")),!0};return a(e),{...i,update:a}}case"chorus":{let t=r.createDelay(.1),n=li(r,[t.delayTime]),i=it(r,I(e,"wet"),(a,o)=>(a.connect(t),t.connect(o),[t])),s=a=>{let o=I(a,"delay");return B(t.delayTime,o),B(n.rate,I(a,"rate")),B(n.depth,Math.min(I(a,"depth"),o)),i.setWet(I(a,"wet")),!0};return s(e),{...i,update:s,dispose:()=>{n.stop(),i.dispose?.()}}}case"phaser":{let t=[0,1,2,3].map(()=>{let o=r.createBiquadFilter();return o.type="allpass",o}),n=r.createGain(),i=li(r,t.map(o=>o.frequency)),s=it(r,I(e,"wet"),(o,l)=>{let c=t[t.length-1];return o.connect(t[0]),t.slice(1).forEach((d,p)=>t[p].connect(d)),c.connect(l),c.connect(n),n.connect(t[0]),[...t,n]}),a=o=>{let l=I(o,"frequency");return t.forEach(c=>B(c.frequency,l)),B(i.rate,I(o,"rate")),B(i.depth,l*I(o,"depth")*.95),B(n.gain,I(o,"feedback")),s.setWet(I(o,"wet")),!0};return a(e),{...s,update:a,dispose:()=>{i.stop(),s.dispose?.()}}}case"tremolo":{let t=r.createGain(),n=li(r,[t.gain]),i=s=>{let a=I(s,"depth");return B(t.gain,1-a/2),B(n.depth,a/2),B(n.rate,I(s,"rate")),!0};return i(e),{input:t,output:t,update:i,dispose:n.stop}}default:return null}}var Sa=Object.fromEntries(ee.map(r=>[r,$a]));function yn(){let r=globalThis,e=r.__nbplayPlugins&&typeof r.__nbplayPlugins=="object"?r.__nbplayPlugins:{},t=Object.create(null);return Object.entries(e).forEach(([n,i])=>{typeof i=="function"&&(t[n]=i)}),Object.assign(t,Sa),t}function ci(r,e=[]){let t=yn();return e.map(n=>{try{let i=Object.prototype.hasOwnProperty.call(t,n.type)?t[n.type]:void 0;return ya(i?.(r,n))}catch(i){return console.warn("nbplay mixer effect plugin failed",n.type,i),null}}).filter(n=>n!==null)}function ui(r,e,t){let n=r;e.forEach(i=>{n.connect(i.input),n=i.output}),n.connect(t)}function Rs(r){if(r==="filter")return{type:r,filter_type:"lowpass",frequency:1200,q:1};if(r==="compressor")return{type:r,threshold:-24,knee:30,ratio:12,attack:.003,release:.25};if(r==="limiter")return{type:r,threshold:-1,release:.05};if(r==="delay")return{type:r,time:.25,feedback:.25,wet:.35};if(r==="reverb")return{type:r,seconds:1.5,decay:2,wet:.25};if(r==="gain")return{type:r,gain:1};let e=ze[r];return e?{type:r,...Object.fromEntries(e.map(t=>[t.key,t.default]))}:{type:r}}function _s(r){return r.enabled!==!1}function di(r=[]){return r.filter(_s).map(e=>({...e}))}function Is(r){let{enabled:e,...t}=r;return _s(r)?{...t,enabled:!1}:t}function pi(r,e){return e.length?e[e.length-1].output:r}function hi(r,e,t){if(r.length!==t.length||e.length!==t.length)return!1;for(let n=0;n<t.length;n++)if(e[n].type!==t[n].type)return!1;for(let n=0;n<t.length;n++){if(JSON.stringify(e[n])===JSON.stringify(t[n]))continue;let i=r[n].update;if(!i||!i(t[n]))return!1}return!0}function mi(r,e){if(!r)return{peak:0,rms:0};r.getFloatTimeDomainData(e);let t=0,n=0;for(let i=0;i<e.length;i++){let s=Math.abs(e[i]);s>t&&(t=s),n+=e[i]*e[i]}return{peak:t,rms:Math.sqrt(n/Math.max(1,e.length))}}function Ls(){let r=null,e=null,t=[],n=[],i=null,s=!1,a=[],o=[],l=new Float32Array(256);function c(p){ke(p.effects),p.input.disconnect(),p.gain.disconnect(),K(p.analyser)}function d(){if(!r?.createAnalyser)return null;let p=r.createAnalyser();return p.fftSize=256,p.smoothingTimeConstant=.6,p}return{init(p){if(r)return;let h=P(p);r=h?es(h):z(),r&&(e=r.createGain(),e.connect(r.destination),i=d())},syncChannels(p,h,m=[],y=[]){if(!r||!e)return;for(;a.length<p.length;){let b=r.createGain(),E=r.createStereoPanner();b.connect(E),E.connect(e),a.push({gain:b,pan:E,effects:[],descriptors:[],analyser:d(),sends:[]});let v=a[a.length-1];v.analyser&&E.connect(v.analyser)}for(;a.length>p.length;){let b=a.pop();ke(b.effects),b.gain.disconnect(),b.pan.disconnect(),b.sends.forEach(E=>E.disconnect()),K(b.analyser)}for(;o.length<y.length;){let b=r.createGain(),E=r.createGain();b.connect(E),E.connect(e);let v={input:b,gain:E,effects:[],descriptors:[],analyser:d()};v.analyser&&E.connect(v.analyser),o.push(v)}for(;o.length>y.length;)c(o.pop());o.forEach((b,E)=>{let v=di(y[E]?.effects);JSON.stringify(b.descriptors)!==JSON.stringify(v)&&(hi(b.effects,b.descriptors,v)||(K(b.input),ke(b.effects),b.effects=ci(r,v),ui(b.input,b.effects,b.gain)),b.descriptors=v),b.gain.gain.value=y[E].gain}),a.forEach((b,E)=>{let v=di(p[E]?.effects);if(b.descriptors.length===v.length&&JSON.stringify(b.descriptors)===JSON.stringify(v))return;if(hi(b.effects,b.descriptors,v)){b.descriptors=v;return}K(b.pan),ke(b.effects),b.effects=ci(r,v),b.descriptors=v,ui(b.pan,b.effects,e);let S=pi(b.pan,b.effects);b.analyser&&S.connect(b.analyser),b.sends.forEach(T=>S.connect(T))}),a.forEach((b,E)=>{for(;b.sends.length>o.length;)b.sends.pop().disconnect();for(;b.sends.length<o.length;){let S=r.createGain();S.gain.value=0,pi(b.pan,b.effects).connect(S),S.connect(o[b.sends.length].input),b.sends.push(S)}let v=p[E]?.sends||[];b.sends.forEach((S,T)=>{S.gain.value=bi(Number(v[T])||0,0,1)})});let f=di(m);(!s||JSON.stringify(n)!==JSON.stringify(f))&&(s&&hi(t,n,f)?n=f:(K(e),ke(t),t=ci(r,f),n=f,s=!0,ui(e,t,r.destination),i&&pi(e,t).connect(i)));let $=p.some(b=>b.solo);p.forEach((b,E)=>{let v=a[E],S=b.gain;(b.mute||$&&!b.solo)&&(S=0),v.gain.gain.value=S,v.pan.pan.value=b.pan}),e.gain.value=h},levels(){return r?{channels:a.map(p=>mi(p.analyser,l)),returns:o.map(p=>mi(p.analyser,l)),master:mi(i,l)}:null},register(p){if(!r||!e)return;let h=ue(p);h.audioCtx=r,h.masterGain=e,h.masterAnalyser=i,h.channels=a,h.returns=o,Object.defineProperty(h,"plugins",{configurable:!0,enumerable:!0,get:yn}),document.dispatchEvent(new CustomEvent("nbplay-bus-ready",{detail:{sessionId:p}}))},destroy(p){let h=P(p);if(h&&(delete h.audioCtx,delete h.masterGain,delete h.masterAnalyser,delete h.channels,delete h.returns,delete h.plugins,Object.keys(h).length===0)){let m=globalThis;delete m.__nbplay[p]}a.forEach(m=>{ke(m.effects),m.gain.disconnect(),m.pan.disconnect(),m.sends.forEach(y=>y.disconnect()),K(m.analyser)}),a.length=0,o.forEach(c),o.length=0,ke(t),n=[],s=!1,K(i),i=null,e&&e.disconnect(),r&&r.state!=="closed"&&r.close(),r=null,e=null,t=[]}}}var Ea=33,gn=class extends g{static properties={channels:{attribute:!1,noAccessor:!0},returns:{attribute:!1,noAccessor:!0},masterGain:{type:Number,attribute:"master-gain",noAccessor:!0},masterEffects:{attribute:!1,noAccessor:!0},sessionId:{type:String,attribute:"session-id",reflect:!0}};graph={channels:[],returns:[],masterGain:.85,masterEffects:[]};bus=Ls();busReady=!1;meterFrame=null;lastMeterMs=0;constructor(){super(),this.sessionId=""}get channels(){return this.graph.channels}set channels(e){this.setGraph("channels",e)}get returns(){return this.graph.returns}set returns(e){this.setGraph("returns",e)}get masterGain(){return this.graph.masterGain}set masterGain(e){this.setGraph("masterGain",e)}get masterEffects(){return this.graph.masterEffects}set masterEffects(e){this.setGraph("masterEffects",e)}setGraph(e,t){let n=this.graph[e];this.graph[e]=t,this.requestUpdate(e,n),this.busReady&&this.syncBus()}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-mixer"),this.tabIndex=0,this.attach()}disconnectedCallback(){super.disconnectedCallback(),this.detach(this.sessionId)}updated(e){if(!e.has("sessionId"))return;let t=e.get("sessionId");t&&t!==this.sessionId&&this.detach(t),this.attach()}attach(){this.busReady||!this.sessionId||!this.isConnected||(this.bus.init(this.sessionId),this.busReady=!0,this.syncBus(),this.bus.register(this.sessionId),typeof requestAnimationFrame=="function"&&(this.meterFrame=requestAnimationFrame(this.meterTick)))}detach(e){this.meterFrame!==null&&cancelAnimationFrame(this.meterFrame),this.meterFrame=null,this.busReady=!1,e&&this.bus.destroy(e)}syncBus(){this.bus.syncChannels(this.channels||[],Number(this.masterGain),this.masterEffects||[],this.returns||[])}set(e){this.emitDetail("nbplay-set",{values:e})}applyLevel(e,t){if(!e)return;e.dataset.peak=t.peak.toFixed(3);let n=e.querySelector("nbplay-meter");n&&(n.level=t.peak,n.rms=t.rms)}meterTick=e=>{if(this.meterFrame=requestAnimationFrame(this.meterTick),e-this.lastMeterMs<Ea||document.hidden)return;this.lastMeterMs=e;let t=this.bus.levels();if(!t)return;let n=this.querySelectorAll('nbplay-strip[kind="channel"]');t.channels.forEach((s,a)=>this.applyLevel(n[a]||null,s));let i=this.querySelectorAll('nbplay-strip[kind="return"]');t.returns.forEach((s,a)=>this.applyLevel(i[a]||null,s)),this.applyLevel(this.querySelector('nbplay-strip[kind="master"]'),t.master)};updateChannel(e,t,n){let i=[...this.channels||[]];e>=i.length||i[e][t]!==n&&(i[e]={...i[e],[t]:n},this.channels=i,this.set({channels:i}))}updateReturn(e,t,n){let i=[...this.returns||[]];e>=i.length||i[e][t]!==n&&(i[e]={...i[e],[t]:n},this.returns=i,this.set({returns:i}))}effectsFor(e,t){return e==="master"?this.masterEffects||[]:e==="return"?this.returns?.[t]?.effects||[]:this.channels?.[t]?.effects||[]}writeEffects(e,t,n){e==="master"?(this.masterEffects=n,this.set({masterEffects:n})):e==="return"?this.updateReturn(t,"effects",n):this.updateChannel(t,"effects",n)}onStripEdit(e,t,n){n.stopPropagation();let i=n.detail;if(i.field==="effect"){let s=i.index??-1,a=this.effectsFor(e,t);i.key==="enabled"?this.writeEffects(e,t,a.map((o,l)=>l===s?Is(o):o)):i.value!==void 0&&this.writeEffects(e,t,a.map((o,l)=>l===s?{...o,[i.key]:i.value}:o));return}if(e==="master"){i.field==="gain"&&i.value!==this.masterGain&&(this.masterGain=i.value,this.set({masterGain:this.masterGain}));return}if(e==="return"){i.field==="gain"&&this.updateReturn(t,"gain",i.value);return}if(i.field==="send"){let s=this.channels?.[t],a=i.index??-1;if(!s||a<0)return;let o=Array.from({length:(this.returns||[]).length},(l,c)=>N(Number(s.sends?.[c])||0,0,1));o[a]=N(Number(i.value)||0,0,1),this.updateChannel(t,"sends",o);return}this.updateChannel(t,i.field,i.value)}onEffectAdd(e,t,n){n.stopPropagation();let i=n.detail.type;this.writeEffects(e,t,[...this.effectsFor(e,t),Rs(i)])}onEffectRemove(e,t,n){n.stopPropagation();let i=n.detail.index;this.writeEffects(e,t,this.effectsFor(e,t).filter((s,a)=>a!==i))}addChannel(){let e=[...this.channels||[]];e.push({name:"Ch "+(e.length+1),gain:.8,pan:0,mute:!1,solo:!1,effects:[]}),this.channels=e,this.set({channels:e})}removeChannel(e){let t=[...this.channels||[]];t.splice(e,1),this.channels=t,this.set({channels:t})}addReturn(){let e=this.returns||[],t=[...e,{name:`Return ${e.length+1}`,gain:.8,effects:[]}],n=(this.channels||[]).map(i=>({...i,sends:[...Array.from({length:e.length},(s,a)=>N(Number(i.sends?.[a])||0,0,1)),0]}));this.returns=t,this.channels=n,this.set({returns:t,channels:n})}removeReturn(e){let t=(this.returns||[]).filter((i,s)=>s!==e),n=(this.channels||[]).map(i=>({...i,sends:(i.sends||[]).filter((s,a)=>a!==e)}));this.returns=t,this.channels=n,this.set({returns:t,channels:n})}render(){let e=this.channels||[],t=this.returns||[],n=t.map(a=>a.name),i=[...ee,...Object.keys(yn()).filter(a=>!ee.includes(a))],s=(a,o,l,c)=>u`<nbplay-strip
        class=${l}
        kind=${a}
        data-index=${o}
        .name=${c.name}
        .gain=${c.gain}
        .pan=${c.pan??0}
        .mute=${!!c.mute}
        .solo=${!!c.solo}
        .sends=${c.sends??[]}
        .sendNames=${a==="channel"?n:[]}
        .effects=${c.effects??[]}
        .effectTypes=${i}
        @input=${d=>this.onStripEdit(a,o,d)}
        @change=${d=>this.onStripEdit(a,o,d)}
        @nbplay-effect-add=${d=>this.onEffectAdd(a,o,d)}
        @nbplay-effect-remove=${d=>this.onEffectRemove(a,o,d)}
        @nbplay-remove=${d=>{d.stopPropagation(),a==="channel"?this.removeChannel(o):a==="return"&&this.removeReturn(o)}}
      ></nbplay-strip>`;return u`<nbplay-header badge="mixer">
        <button
          type="button"
          class="nbplay-mixer-add-btn"
          title="Add channel"
          @click=${()=>this.addChannel()}
        >
          + Channel
        </button>
        <button
          type="button"
          class="nbplay-mixer-add-return-btn"
          title="Add return bus"
          @click=${()=>this.addReturn()}
        >
          + Return
        </button>
      </nbplay-header>
      <div class="nbplay-mixer-console">
        ${e.map((a,o)=>s("channel",o,"nbplay-mixer-strip",{name:a.name,gain:a.gain,pan:a.pan,mute:a.mute,solo:a.solo,sends:t.map((l,c)=>N(Number(a.sends?.[c])||0,0,1)),effects:a.effects}))}
        ${t.map((a,o)=>s("return",o,"nbplay-mixer-strip nbplay-return-strip",{name:a.name,gain:a.gain,effects:a.effects}))}
        ${s("master",-1,"nbplay-mixer-strip nbplay-master-strip",{name:"Master",gain:Number(this.masterGain),effects:this.masterEffects})}
      </div>`}};k("nbplay-mixer",gn);var xa=50;function Ds(r,e){if(r===0)return"\u2014";let t=r/e;return t<1?(t*1e3).toFixed(0)+" ms":t.toFixed(2)+" s"}var kn=class extends g{static properties={sampleName:{type:String,attribute:"sample-name"},sampleRate:{type:Number,attribute:"sample-rate"},sampleLength:{type:Number,attribute:"sample-length"},rootNote:{type:Number,attribute:"root-note"},waveform:{attribute:!1},sampleData:{attribute:!1},attack:{type:Number},decay:{type:Number},sustain:{type:Number},release:{type:Number},maxVoices:{type:Number,attribute:"max-voices"},padCount:{type:Number,attribute:"pad-count"},padNotes:{attribute:!1},padVelocities:{attribute:!1},padActions:{attribute:!1},sampleSlices:{attribute:!1},velocity:{type:Number},velocitySensitive:{type:Boolean,attribute:"velocity-sensitive"},zones:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},activePads:{attribute:!1},lastNoteEvent:{attribute:!1},lastPadEvent:{attribute:!1},activeVoices:{type:Number,attribute:!1},zoneStatus:{type:String,attribute:!1},recording:{type:Boolean,attribute:!1}};engine=ws();held=new Set;heldNotes=new Map;voiceTimer=null;registration=null;recorder=null;recorderStream=null;recorderChunks=[];capturePad=-1;constructor(){super(),this.sampleName="",this.sampleRate=44100,this.sampleLength=0,this.rootNote=60,this.waveform=null,this.sampleData=null,this.attack=.01,this.decay=.1,this.sustain=.7,this.release=.3,this.maxVoices=8,this.padCount=8,this.padNotes=[],this.padVelocities=[],this.padActions=[],this.sampleSlices=[],this.velocity=100,this.velocitySensitive=!0,this.zones=[],this.sessionId="",this.channelIndex=-1,this.activePads=[],this.lastNoteEvent={},this.lastPadEvent={},this.activeVoices=0,this.zoneStatus="",this.recording=!1}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-sampler"),this.engine.setMaxVoices(this.maxVoices),this.engine.setSession(this.sessionId,this.channelIndex),this.loadSample(),this.engine.setZones(this.zoneList()),this.fitPads(),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.register(),this.voiceTimer=setInterval(()=>{let e=this.engine.getActiveVoiceCount();e!==this.activeVoices&&(this.activeVoices=e)},xa)}disconnectedCallback(){super.disconnectedCallback(),this.voiceTimer&&clearInterval(this.voiceTimer),this.voiceTimer=null,this.stopZoneRecording(),this.recorderStream?.getTracks().forEach(e=>e.stop()),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.unregister(),this.engine.destroy()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&[...e.keys()].some(t=>e.get(t)!==void 0)&&this.register(),e.has("maxVoices")&&this.engine.setMaxVoices(this.maxVoices),(e.has("sampleData")||e.has("waveform")||e.has("sampleRate"))&&[...e.keys()].some(t=>e.get(t)!==void 0)&&this.loadSample(),e.has("zones")&&e.get("zones")!==void 0&&this.engine.setZones(this.zoneList()),(e.has("padNotes")||e.has("padCount"))&&[...e.keys()].some(t=>e.get(t)!==void 0)&&this.fitPads()}set(e){this.emitDetail("nbplay-set",{values:e})}status(){this.activePads=Array.from(this.held),this.emitDetail("nbplay-status",{values:{activePads:this.activePads,lastNoteEvent:this.lastNoteEvent,lastPadEvent:this.lastPadEvent},save:!0})}loadSample(){let e=W(this.waveform),t=W(this.sampleData);(t||e)&&this.engine.setWaveformData(t||e,Number(this.sampleRate))}envelope(){return{attack:Number(this.attack),decay:Number(this.decay),sustain:Number(this.sustain),release:Number(this.release)}}async loadFile(e){let t=await ge(await e.arrayBuffer());if(!t)return;let n=Ps(t.samples);this.sampleName=e.name,this.sampleRate=t.sampleRate,this.sampleLength=t.samples.length,this.sampleData=Re(t.samples),this.waveform=Re(n),this.engine.setWaveformData(t.samples,t.sampleRate),this.set({sampleName:this.sampleName,sampleRate:this.sampleRate,sampleLength:this.sampleLength,sampleData:this.sampleData,waveform:this.waveform})}count(){return N(Number(this.padCount||8),1,32)}notes(){return Ln((this.padNotes||[]).slice(),this.count())}velocities(){return dt((this.padVelocities||[]).slice(),this.count(),Number(this.velocity))}actions(){return Ne(this.padActions,this.notes(),this.velocities(),this.count())}slices(){return(this.sampleSlices||[]).map((e,t)=>({index:Number(e.index??t),note:Number(e.note),start:Math.max(0,Math.floor(Number(e.start)||0)),end:Math.max(0,Math.floor(Number(e.end)||0)),label:typeof e.label=="string"?e.label:void 0})).filter(e=>Number.isFinite(e.note)&&e.end>e.start)}sliceFor(e){if(e.type!=="note")return;let t=this.slices();return e.slice!==void 0?t.find(n=>n.index===e.slice):t.find(n=>n.note===e.note)}fitPads(){let e=this.notes(),t=this.velocities(),n={};e.length!==(this.padNotes||[]).length&&(this.padNotes=e,n.padNotes=e),t.length!==(this.padVelocities||[]).length&&(this.padVelocities=t,n.padVelocities=t),Object.keys(n).length&&this.emitDetail("nbplay-status",{values:n,save:!1})}pads(){let e=this.velocities();return this.actions().map((t,n)=>{let i=e[n]??100,a=this.sliceFor(t)?.label??(t.type==="note"&&!t.label?void 0:pt(t));return a===void 0?{note:t.note,velocity:i}:{note:this.notes()[n]??60,velocity:i,label:a}})}triggerPad(e,t){let n=this.actions()[e];n&&(this.held.add(e),n.type==="note"?(this.heldNotes.set(e,n.note),this.engine.noteOn(n.note,Number(this.rootNote),this.envelope(),t,this.sliceFor(n)),this.lastNoteEvent={note:n.note,velocity:t,type:"on"},this.lastPadEvent={pad:e,event:"on",velocity:t,action:n}):(n.type==="trait"&&this.set({[n.trait]:n.value}),this.lastPadEvent={pad:e,event:"trigger",velocity:t,action:n}),this.status())}releasePad(e){if(!this.held.delete(e))return;let t=this.heldNotes.get(e),n=this.actions()[e];this.heldNotes.delete(e),t!==void 0&&(this.engine.noteOff(t,{release:Number(this.release)}),this.lastNoteEvent={note:t,velocity:0,type:"off"},n&&(this.lastPadEvent={pad:e,event:"off",velocity:0,action:n})),this.status()}onPadChange(e){e.stopPropagation();let{index:t,field:n,value:i}=e.detail;if(n==="note"){let s=this.notes();if(t>=s.length)return;s[t]=i;let a=this.actions().map((o,l)=>l===t&&o.type==="note"?{...o,note:i}:o);this.padNotes=s,this.padActions=a,this.set({padNotes:s,padActions:a})}else{let s=this.velocities();if(t>=s.length)return;s[t]=i,this.padVelocities=s,this.set({padVelocities:s})}}applyPadCount(e){if(Number.isNaN(e))return;let t=N(Math.round(e),1,32),n=Ln((this.padNotes||[]).slice(),t),i=dt((this.padVelocities||[]).slice(),t,Number(this.velocity)),s=Ne(this.padActions,n,i,t);this.padCount=t,this.padNotes=n,this.padVelocities=i,this.padActions=s,this.set({padCount:t,padNotes:n,padVelocities:i,padActions:s})}onVelocity(e){e.stopPropagation();let t=q(e.detail.value);t!==this.velocity&&(this.velocity=t,this.padVelocities=dt(this.velocities(),this.count(),t),this.set({velocity:t,padVelocities:this.padVelocities}))}zoneList(){return(this.zones||[]).map((e,t)=>({id:String(e.id??t),name:typeof e.name=="string"?e.name:`Zone ${t+1}`,note_low:X(e.note_low,0),note_high:X(e.note_high,127),velocity_low:X(e.velocity_low,0),velocity_high:X(e.velocity_high,127),root_note:X(e.root_note,60),sample_rate:Math.max(1,Number(e.sample_rate)||44100),samples:W(e.data)||new Float32Array(0)}))}writeZones(e){let t=e.map(n=>({id:n.id,name:n.name,note_low:n.note_low,note_high:n.note_high,velocity_low:n.velocity_low,velocity_high:n.velocity_high,root_note:n.root_note,sample_rate:n.sample_rate,length:n.samples.length,data:Re(n.samples)}));this.zones=t,this.engine.setZones(e),this.set({zones:t})}addZone(e,t,n,i){let s=this.zoneList();s.push({id:Math.random().toString(36).slice(2,10),name:n,note_low:i.low,note_high:i.high,velocity_low:0,velocity_high:127,root_note:i.root,sample_rate:t,samples:e}),this.writeZones(s)}captureRange(){let e=this.capturePad;if(e>=0){let t=this.notes()[e];if(t!==void 0)return{low:t,high:t,root:t}}return{low:0,high:127,root:60}}onZoneChange(e){e.stopPropagation();let{index:t,field:n,value:i}=e.detail,s=this.zoneList(),a=s[t];if(a){if(n==="name")a.name=String(i).trim()||a.name;else if(n==="low"||n==="high"){let o=n==="low"?"note_low":"note_high",l=X(i,a[o]);a[o]=l,a.note_low>a.note_high&&(n==="low"?a.note_high=l:a.note_low=l)}else a.root_note=X(i,a.root_note);this.writeZones(s)}}async addZoneFromFile(e){let t=await ge(await e.arrayBuffer());t&&(this.addZone(t.samples,t.sampleRate,e.name,this.captureRange()),this.zoneStatus=`Added ${e.name}`)}async command(e){if(e?.url){this.zoneStatus="Capturing\u2026";try{let t=await fetch(e.url),n=await ge(await t.arrayBuffer());if(!n)throw new Error("Web Audio is unavailable");let i=n.samples,s=Math.max(0,Math.floor((e.offset||0)*n.sampleRate)),a=e.duration&&e.duration>0?Math.max(1,Math.round(e.duration*n.sampleRate)):i.length-s;(s>0||s+a<i.length)&&(i=i.slice(s,Math.min(i.length,s+a)));let o=X(e.note_low,0),l=X(e.note_high,127);this.addZone(i,n.sampleRate,e.name||"Take",{low:Math.min(o,l),high:Math.max(o,l),root:X(e.root_note,o)}),this.zoneStatus=`Captured ${e.name||"take"}`}catch(t){this.zoneStatus=`Capture failed: ${t instanceof Error?t.message:String(t)}`}}}async startZoneRecording(){let e=navigator,t=globalThis.MediaRecorder;if(!t||!e.mediaDevices?.getUserMedia){this.zoneStatus="Microphone recording is unavailable";return}try{this.recorderStream=await e.mediaDevices.getUserMedia({audio:!0})}catch(a){this.zoneStatus=`Microphone unavailable: ${a instanceof Error?a.message:String(a)}`;return}let n=this.captureRange(),i=`Take ${this.zoneList().length+1}`;this.recorderChunks=[];let s=new t(this.recorderStream);this.recorder=s,s.addEventListener("dataavailable",a=>{a.data&&a.data.size&&this.recorderChunks.push(a.data)}),s.addEventListener("stop",async()=>{let a=new Blob(this.recorderChunks,{type:s.mimeType||"audio/webm"});if(this.recorderChunks=[],this.recorderStream?.getTracks().forEach(l=>l.stop()),this.recorderStream=null,this.recorder=null,this.recording=!1,!a.size){this.zoneStatus="No audio was captured";return}let o=await ge(await a.arrayBuffer());o&&(this.addZone(o.samples,o.sampleRate,i,n),this.zoneStatus=`Captured ${i}`)}),s.start(),this.recording=!0,this.zoneStatus=`Recording ${i}\u2026`}stopZoneRecording(){this.recorder&&this.recorder.state!=="inactive"&&this.recorder.stop()}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.register()};unregister(){if(!this.registration)return;let{bus:e,idx:t,sampler:n,instrument:i}=this.registration;e.samplers?.[t]===n&&delete e.samplers[t],e.instruments?.[t]===i&&delete e.instruments[t],this.registration=null}register(){let e=this.sessionId,t=Number(this.channelIndex);if(this.unregister(),!e||t<0)return;let n=P(e);if(!n)return;this.engine.setSession(e,t);let i=n.samplers||{};n.samplers=i,i[t]={triggerNote:(a,o)=>{this.engine.noteOn(a,Number(this.rootNote),this.envelope(),o)},releaseNote:a=>{this.engine.noteOff(a,{release:Number(this.release)})}};let s=n.instruments||{};n.instruments=s,s[t]={scheduleNote:(a,o,l,c)=>{let d=this.slices().find(h=>h.note===a),p=this.engine.noteOn(a,Number(this.rootNote),this.envelope(),o,d,l,c);if(p)return()=>this.engine.cancelVoice(p)},startNote:(a,o,l)=>{let c=this.slices().find(p=>p.note===a),d=this.engine.noteOn(a,Number(this.rootNote),this.envelope(),o,c,l);if(d)return p=>this.engine.releaseVoice(d,{release:Number(this.release)},p)}},this.registration={bus:n,idx:t,sampler:i[t],instrument:s[t]}}silence(){this.engine.stopAll()}param(e,t,n,i,s,a,o,l,c="slider"){let d=p=>{p.stopPropagation();let h=p.detail.value;h!==this[n]&&(this[n]=h,this.set({[n]:h}))};return u`<nbplay-param
      class=${e}
      .label=${t}
      .kind=${i}
      .control=${c}
      .value=${Number(this[n])}
      .min=${s}
      .max=${a}
      .step=${o}
      .defaultValue=${l}
      @input=${d}
      @change=${d}
    ></nbplay-param>`}render(){let e=i=>i.stopPropagation(),t=this.notes(),n=this.zoneList();return u`<nbplay-header badge="sampler">
        <input
          type="file"
          class="nbplay-samp-file"
          accept="audio/*"
          @change=${i=>{i.stopPropagation();let s=i.target.files?.[0];s&&this.loadFile(s)}}
        />
        <span class="nbplay-samp-name">${this.sampleName}</span>
      </nbplay-header>
      <nbplay-waveform
        class="nbplay-samp-waveform"
        .data=${W(this.waveform)||W(this.sampleData)}
        empty-text="No sample loaded"
        @dragover=${i=>{i.preventDefault(),i.currentTarget.classList.add("drag-over")}}
        @dragleave=${i=>i.currentTarget.classList.remove("drag-over")}
        @drop=${i=>{i.preventDefault(),i.currentTarget.classList.remove("drag-over");let s=i.dataTransfer?.files?.[0];s&&this.loadFile(s)}}
      ></nbplay-waveform>
      <div class="nbplay-samp-info">
        <span class="nbplay-samp-info-rate"
          >${Number(this.sampleRate)/1e3} kHz</span
        >
        <span class="nbplay-samp-info-root"
          >${R(Number(this.rootNote))}</span
        >
        <span class="nbplay-samp-info-len"
          >${Ds(Number(this.sampleLength),Number(this.sampleRate))}</span
        >
        <span class="nbplay-samp-info-voices">${this.maxVoices} voices</span>
        <span class="nbplay-samp-active-voices"
          >${this.activeVoices} active</span
        >
      </div>
      <div class="nbplay-samp-envelope">
        <nbplay-envelope
          class="nbplay-samp-env-canvas"
          .attack=${Number(this.attack)}
          .decay=${Number(this.decay)}
          .sustain=${Number(this.sustain)}
          .release=${Number(this.release)}
        ></nbplay-envelope>
        <div class="nbplay-samp-env-controls">
          ${this.param("nbplay-samp-attack","Attack","attack","seconds",0,2,.001,.005,"dial")}
          ${this.param("nbplay-samp-decay","Decay","decay","seconds",0,2,.001,.1,"dial")}
          ${this.param("nbplay-samp-sustain","Sustain","sustain","percent",0,1,.01,.8,"dial")}
          ${this.param("nbplay-samp-release","Release","release","seconds",0,5,.001,.1,"dial")}
        </div>
      </div>
      <div class="nbplay-samp-row">
        ${this.param("nbplay-samp-max-voices","Max Voices","maxVoices","int",1,32,1,8)}
      </div>
      <div class="nbplay-samp-pads-section">
        <div class="nbplay-samp-pads-controls">
          <label class="nbplay-samp-field">
            <span class="nbplay-samp-label">Trigger Pads</span>
            <input
              type="number"
              class="nbplay-samp-pad-count"
              min="1"
              max="32"
              step="1"
              .value=${String(this.count())}
              @change=${e}
              @input=${i=>{i.stopPropagation(),this.applyPadCount(parseInt(i.target.value,10))}}
            />
          </label>
          <nbplay-param
            class="nbplay-samp-velocity"
            label="Velocity"
            kind="int"
            .value=${Number(this.velocity)}
            .min=${1}
            .max=${127}
            .step=${1}
            .defaultValue=${100}
            @input=${this.onVelocity}
            @change=${this.onVelocity}
          ></nbplay-param>
          <label class="nbplay-samp-vel-sense-label">
            <input
              type="checkbox"
              class="nbplay-samp-vel-sense"
              .checked=${this.velocitySensitive}
              @input=${e}
              @change=${i=>{i.stopPropagation(),this.velocitySensitive=i.target.checked,this.set({velocitySensitive:this.velocitySensitive})}}
            />
            Vel-Sensitive
          </label>
        </div>
        <nbplay-pad-grid
          class="nbplay-samp-pads-grid"
          .rows=${Math.ceil(this.count()/4)}
          .cols=${Math.min(4,this.count())}
          .pads=${this.pads()}
          .active=${this.activePads}
          .velocitySensitive=${this.velocitySensitive}
          hold
          @nbplay-note-on=${i=>{i.stopPropagation();let{index:s,velocity:a}=i.detail;this.triggerPad(s,a)}}
          @nbplay-note-off=${i=>{i.stopPropagation(),this.releasePad(i.detail.index)}}
          @input=${this.onPadChange}
          @change=${this.onPadChange}
        ></nbplay-pad-grid>
      </div>
      <div class="nbplay-samp-zones-section">
        <div class="nbplay-samp-zones-controls">
          <span class="nbplay-samp-label">Zones</span>
          <select
            class="nbplay-samp-zone-pad"
            title="Pad a captured sample lands on"
            @input=${e}
            @change=${i=>{i.stopPropagation(),this.capturePad=Number(i.target.value)}}
          >
            <option value="-1" ?selected=${this.capturePad<0}>
              All notes
            </option>
            ${t.map((i,s)=>u`<option
                  value=${s}
                  ?selected=${s===this.capturePad}
                  .textContent=${`Pad ${s+1} (${R(i)})`}
                ></option>`)}
          </select>
          <label
            class="nbplay-samp-zone-file-label"
            title="Add a zone from an audio file"
          >
            File<input
              type="file"
              class="nbplay-samp-zone-file"
              accept="audio/*"
              @change=${i=>{i.stopPropagation();let s=i.target,a=s.files?.[0];a&&(this.addZoneFromFile(a),s.value="")}}
            />
          </label>
          <button
            type="button"
            class="nbplay-samp-zone-rec ${this.recording?"recording":""}"
            title="Record the microphone into the selected pad"
            @click=${()=>{this.recorder?this.stopZoneRecording():this.startZoneRecording()}}
          >
            ${this.recording?"Stop":"Rec"}
          </button>
          <span class="nbplay-samp-zone-status">${this.zoneStatus}</span>
        </div>
        <nbplay-zone-map
          .zones=${n.map(i=>({low:i.note_low,high:i.note_high,name:i.name}))}
        ></nbplay-zone-map>
        <nbplay-zone-list
          .zones=${n.map(i=>({name:i.name,low:i.note_low,high:i.note_high,root:i.root_note,info:Ds(i.samples.length,i.sample_rate)}))}
          @input=${e}
          @change=${this.onZoneChange}
          @nbplay-zone-remove=${i=>{i.stopPropagation();let s=this.zoneList();s.splice(i.detail.index,1),this.writeZones(s)}}
        ></nbplay-zone-list>
      </div>`}};k("nbplay-sampler",kn);var st=4096,Na=.25,Os=.1,fi=6,Pa=25,wa=50;function M(r,e){let t=Number(r);return Number.isFinite(t)?t:e}function vi(){let r=globalThis.crypto;return r?.randomUUID?`clip-${r.randomUUID()}`:`clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}function $n(r){return r.start+Math.max(.001,r.duration)}function Ca(r){return(r.events||[]).map(e=>({beat:Math.max(0,M(e.beat,0)),duration:Math.max(.001,M(e.duration,.25)),note:Math.max(0,Math.min(127,Math.round(M(e.note,60)))),velocity:Math.max(1,Math.min(127,Math.round(M(e.velocity,100))))})).sort((e,t)=>e.beat-t.beat||e.note-t.note)}function Ta(r){return r?r instanceof DataView?new Uint8Array(r.buffer,r.byteOffset,r.byteLength):r instanceof ArrayBuffer?new Uint8Array(r):ArrayBuffer.isView(r)?new Uint8Array(r.buffer,r.byteOffset,r.byteLength):null:null}function yi(r){if(r)try{r.disconnect()}catch{}}var Sn=class extends g{static properties={tracks:{attribute:!1},clips:{attribute:!1},length:{type:Number},selectedClipId:{type:String,attribute:"selected-clip-id"},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},countInBars:{type:Number,attribute:"count-in-bars"},autoExtendRecording:{type:Boolean,attribute:"auto-extend-recording"},recordingExtendBars:{type:Number,attribute:"recording-extend-bars"},pixelsPerBeat:{type:Number,attribute:"pixels-per-beat"},sessionId:{type:String,attribute:"session-id",reflect:!0},currentBeat:{type:Number,attribute:!1},exportClipId:{type:String,attribute:!1},importClipRequest:{attribute:!1},importClipData:{attribute:!1},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},isRecording:{type:Boolean,attribute:"is-recording",reflect:!0},recordingTrack:{type:Number,attribute:!1},recordingTracks:{attribute:!1},recordingCountdownBeats:{type:Number,attribute:!1},recordingError:{type:String,attribute:!1},recordedClip:{attribute:!1},exportedClip:{attribute:!1},exportedClipData:{attribute:!1},displayBeat:{type:Number,attribute:!1}};binding=null;unbindShortcuts=null;lanes=[];micStream=null;pendingClips=[];recordingStartMs=0;recordingStartBeat=0;recordingStopBeat=null;countInTimer=null;countInTick=null;recordingPending=!1;recordingGeneration=0;recordingStartedPlayback=!1;scheduledTimers=[];scheduledNotes=[];playheadTimer=null;midiTimer=null;midiCursorBeat=0;midiLastBeat=0;noteListenerActive=!1;suppressRestart=!1;disposed=!1;claims={sessionId:"",channels:[]};objectUrls=new Set;activeMedia=[];activeSources=[];constructor(){super(),this.tracks=[],this.clips=[],this.length=16,this.selectedClipId="",this.bpm=120,this.timeSignatureNum=4,this.timeSignatureDen=4,this.countInBars=0,this.autoExtendRecording=!0,this.recordingExtendBars=8,this.pixelsPerBeat=0,this.sessionId="",this.currentBeat=0,this.exportClipId="",this.importClipRequest={},this.importClipData=null,this.isPlaying=!1,this.isRecording=!1,this.recordingTrack=-1,this.recordingTracks=[],this.recordingCountdownBeats=0,this.recordingError="",this.recordedClip={},this.exportedClip={},this.exportedClipData=null,this.displayBeat=null}trackList(){return(this.tracks||[]).map((e,t)=>({name:String(e.name??`Track ${t+1}`),channel_index:M(e.channel_index,t),armed:!!e.armed,muted:!!e.muted,solo:!!e.solo,input:e.input==="channel"||e.input==="midi"?e.input:"microphone",monitor:!!e.monitor}))}clipList(){return(this.clips||[]).map((e,t)=>({...e,id:String(e.id||`clip-${t}`),kind:e.kind==="midi"||Array.isArray(e.events)?"midi":"audio",events:e.kind==="midi"||Array.isArray(e.events)?Ca(e):void 0,pattern:typeof e.pattern=="string"?e.pattern:void 0,name:String(e.name??`Clip ${t+1}`),track_index:Math.max(0,M(e.track_index,0)),start:Math.max(0,M(e.start,0)),duration:Math.max(.001,M(e.duration,4)),offset:Math.max(0,M(e.offset,0)),loop:!!e.loop,muted:!!e.muted}))}timelineLength(){return Math.max(1,Math.min(st,M(this.length,16)))}beatsPerBar(){return se(this.timeSignatureNum,this.timeSignatureDen)}clampBeat(e){return Math.max(0,Math.min(this.timelineLength(),e))}countInBeats(){return Math.max(0,M(this.countInBars,0))*this.beatsPerBar()}recordingExtendBeats(){return Math.max(1,M(this.recordingExtendBars,8))*this.beatsPerBar()}clock(){if(!this.binding){this.binding=H(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();if(this.joinTempo(e),!this.sessionId&&!e.playing){let t=this.clampBeat(M(this.currentBeat,0));Math.abs(t-e.beat())>1e-9&&e.seek(t)}this.isPlaying=e.playing,this.isRecording=!1,this.recordingTrack=-1,this.recordingTracks=[]}return this.binding.clock()}shared(){return!!this.sessionId}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-timeline"),this.disposed=!1,this.clock(),this.syncClaims(),this.unbindShortcuts=le(this,{Space:()=>this.togglePlay(),"Shift+Space":()=>{this.clock().stop(),this.seekToBeat(0)},r:()=>this.toggleRecord(),l:()=>this.toggleLoop(),d:()=>this.duplicateSelectedClip(),Delete:()=>this.removeSelectedClip(),Backspace:()=>this.removeSelectedClip()}),this.clock().playing&&this.startPlayback(),this.handleExportRequest(),this.handleImportRequest()}disconnectedCallback(){super.disconnectedCallback(),this.disposed=!0,this.clearCountIn(),this.recordingGeneration+=1,this.recordingPending=!1,this.lanes.forEach(e=>{e.recorder&&e.recorder.state!=="inactive"&&e.recorder.stop()}),this.releaseLanes(),this.clearScheduledPlayback(),this.syncClaims(),this.setNoteListener(!1),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.binding?.dispose(),this.binding=null,this.objectUrls.forEach(e=>URL.revokeObjectURL(e))}updated(e){if(!this.binding)return;let t=n=>e.has(n)&&e.get(n)!==void 0;t("sessionId")?this.binding.rebind():t("bpm")&&this.clock().setTempo(M(this.bpm,120)),t("isPlaying")&&this.onPlayStateWrite(),t("isRecording")&&this.onRecordStateWrite(),t("currentBeat")&&this.onPositionWrite(),t("exportClipId")&&this.handleExportRequest(),(t("importClipRequest")||t("importClipData"))&&this.handleImportRequest(),(e.has("clips")||e.has("tracks")||e.has("length"))&&this.syncLoopRange(),(e.has("clips")||e.has("tracks")||e.has("sessionId"))&&this.syncClaims()}syncClaims(){this.claims.channels.forEach(n=>Qt(this.claims.sessionId,n,"timeline"));let e=this.trackList(),t=new Set;this.isConnected&&this.sessionId&&this.clipList().forEach(n=>{let i=e[n.track_index];n.kind==="midi"&&i&&!n.muted&&(n.events||[]).length>0&&t.add(i.channel_index)}),t.forEach(n=>Yt(this.sessionId,n,"timeline")),this.claims={sessionId:this.sessionId,channels:[...t]}}set(e){this.emitDetail("nbplay-set",{values:e})}status(e,t){this.emitDetail("nbplay-status",{values:e,save:t})}get context(){return this.clock().context()}beatNow(){return this.clampBeat(this.clock().beat())}recordersActive(){return this.lanes.some(e=>e.recording)}recordingActive(){return this.recordersActive()||!!this.countInTimer||this.recordingPending}setRecordingFlag(e){this.clock().setRecording(e),this.isRecording=e,this.status({isRecording:e},!1)}onClockEvent=e=>{let t=this.clock();switch(e.type){case"play":this.isPlaying=!0,this.status({isPlaying:!0},!0),this.startPlayback();break;case"stop":this.clearScheduledPlayback(),this.isPlaying=!1,this.currentBeat=this.clampBeat(e.beat),this.status({isPlaying:!1,currentBeat:this.currentBeat},!0),this.recordingActive()&&this.stopRecording();break;case"seek":this.displayBeat=null,this.currentBeat=this.clampBeat(e.beat),this.status({currentBeat:this.currentBeat},!1),t.playing&&!this.suppressRestart&&this.startPlayback();break;case"tempo":Number(this.bpm)!==t.bpm&&(this.bpm=t.bpm,this.set({bpm:t.bpm})),t.playing&&this.startPlayback();break;case"record":t.recording?this.recordingActive()||this.startRecording():this.recordingActive()&&this.stopRecording();break;case"loop":this.syncLoopRange();break;case"timesig":break}};joinTempo(e){let t=e.adoptTempo(M(this.bpm,120));t!==M(this.bpm,120)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.clearScheduledPlayback(),this.joinTempo(e),this.isPlaying=e.playing,this.status({isPlaying:e.playing},!1),e.playing&&this.startPlayback()};onPlayStateWrite(){let e=this.clock();this.shared()?!!this.isPlaying!==e.playing&&(this.isPlaying=e.playing,this.status({isPlaying:e.playing},!0)):this.isPlaying?e.playing||e.play():e.playing&&e.stop()}onRecordStateWrite(){this.shared()?!!this.isRecording!==this.clock().recording&&(this.isRecording=this.clock().recording,this.status({isRecording:this.isRecording},!0)):this.isRecording?this.recordingActive()||this.startRecording():this.recordingActive()&&this.stopRecording()}onPositionWrite(){let e=this.clock();if(!this.shared()&&!e.playing){let t=this.clampBeat(M(this.currentBeat,0));Math.abs(t-e.beat())>1e-9&&e.seek(t)}}togglePlay(){let e=this.clock();e.playing?e.stop():e.play()}toggleRecord(){this.recordingActive()||this.isRecording?this.stopRecording():this.startRecording()}clearCountIn(){this.countInTimer&&(clearTimeout(this.countInTimer),this.countInTimer=null),this.countInTick&&(clearInterval(this.countInTick),this.countInTick=null),this.recordingCountdownBeats=0,this.status({recordingCountdownBeats:0},!1)}stopMicStream(){this.micStream?.getTracks().forEach(e=>e.stop()),this.micStream=null}releaseLanes(){this.lanes.forEach(e=>{yi(e.monitor),yi(e.tap)}),this.lanes=[],this.pendingClips=[],this.stopMicStream(),this.setNoteListener(!1)}onDocumentNote=e=>{let t=e.detail;if(!t)return;let n=Math.round(M(t.note,-1));if(n<0||n>127)return;let i=Math.max(0,this.clock().beat()-this.recordingStartBeat);this.lanes.forEach(s=>{s.kind!=="midi"||!s.recording||(t.type==="on"&&M(t.velocity,0)>0?s.openNotes.set(n,{beat:i,velocity:Math.max(1,Math.min(127,Math.round(M(t.velocity,100))))}):this.closeLaneNote(s,n,i))})};closeLaneNote(e,t,n){let i=e.openNotes.get(t);i&&(e.openNotes.delete(t),e.events.push({beat:i.beat,duration:Math.max(.05,n-i.beat),note:t,velocity:i.velocity}))}setNoteListener(e){e!==this.noteListenerActive&&(this.noteListenerActive=e,e?document.addEventListener("nbplay-note",this.onDocumentNote):document.removeEventListener("nbplay-note",this.onDocumentNote))}finalizeMidiLane(e,t){let n=Math.max(0,t-this.recordingStartBeat);if([...e.openNotes.keys()].forEach(i=>this.closeLaneNote(e,i,n)),e.recording=!1,e.done=!0,e.events.length>0){let i=this.clipList().length+this.pendingClips.length+1;this.pendingClips.push({id:vi(),kind:"midi",name:`Take ${i}`,track_index:e.trackIndex,start:this.recordingStartBeat,duration:this.recordingDurationBeats(),loop:!1,muted:!1,recorded:!0,offset:0,source:"recording",events:[...e.events].sort((s,a)=>s.beat-a.beat||s.note-a.note)})}this.lanes.every(i=>i.done)&&this.finishRecording()}clearScheduledPlayback(){this.scheduledTimers.forEach(t=>clearTimeout(t)),this.scheduledTimers=[];let e=this.clock().now();this.scheduledNotes.forEach(t=>{t.until>e&&t.cancel()}),this.scheduledNotes=[],this.activeMedia.forEach(t=>{try{t.pause(),t.currentTime=0}catch{}}),this.activeMedia.length=0,this.activeSources.forEach(t=>yi(t)),this.activeSources.length=0,this.playheadTimer&&(clearInterval(this.playheadTimer),this.playheadTimer=null),this.midiTimer&&(clearInterval(this.midiTimer),this.midiTimer=null),this.displayBeat=null}writeRecordingError(e){this.disposed||(this.clearCountIn(),this.releaseLanes(),this.recordingPending=!1,this.recordingGeneration+=1,this.recordingStartedPlayback=!1,this.recordingStopBeat=null,this.recordingError=e,this.setRecordingFlag(!1),this.recordingTrack=-1,this.recordingTracks=[],this.status({recordingError:e,isRecording:!1,recordingTrack:-1,recordingTracks:[]},!0))}findRecordingTracks(){let e=this.trackList(),t=e.map((i,s)=>i.armed?s:-1).filter(i=>i>=0);if(t.length>0)return t;let n=M(this.recordingTrack,-1);return n>=0&&n<e.length?[n]:e.length>0?[0]:[]}recordingDurationBeats(){if(this.recordingStopBeat!==null&&this.recordingStopBeat>this.recordingStartBeat)return Math.max(.25,this.recordingStopBeat-this.recordingStartBeat);let e=Math.max(.25,(performance.now()-this.recordingStartMs)/1e3),t=Math.max(1,M(this.bpm,120));return Math.max(.25,e*(t/60))}finalizeLane(e){let t=e.recorder?.mimeType||e.chunks[0]?.type||"audio/webm",n=new Blob(e.chunks,{type:t});if(e.chunks=[],e.recorder=null,e.recording=!1,e.done=!0,n.size&&typeof URL<"u"&&URL.createObjectURL){let i=URL.createObjectURL(n);this.objectUrls.add(i);let s=this.clipList().length+this.pendingClips.length+1;this.pendingClips.push({id:vi(),kind:"audio",name:`Take ${s}`,track_index:e.trackIndex,start:this.recordingStartBeat,duration:this.recordingDurationBeats(),loop:!1,muted:!1,recorded:!0,offset:0,audio_url:i,blob_type:n.type,blob_size:n.size,source:"recording",sample_rate:this.context?.sampleRate||44100})}this.lanes.every(i=>i.done)&&this.finishRecording()}finishRecording(){let e=this.pendingClips;if(this.pendingClips=[],this.releaseLanes(),this.recordingStartedPlayback=!1,this.recordingStopBeat=null,this.disposed)return;if(e.length===0){this.writeRecordingError("No audio was captured");return}let t=[...this.clipList(),...e],n=e[e.length-1];this.clips=t,this.recordedClip=n,this.selectedClipId=n.id,this.recordingError="",this.setRecordingFlag(!1),this.recordingTrack=-1,this.recordingTracks=[],this.recordingCountdownBeats=0,this.length=Math.max(M(this.length,16),...e.map(i=>$n(i))),this.status({recordedClip:n,recordingError:"",isRecording:!1,recordingTrack:-1,recordingTracks:[],recordingCountdownBeats:0},!1),this.set({clips:t,selectedClipId:n.id,length:this.length})}startInputMonitoring(e,t){if(!e.monitor)return null;let n=P(this.sessionId),i=n?.audioCtx||this.context;if(!i?.createMediaStreamSource)return null;try{let s=i.createMediaStreamSource(t),a=n?.channels?.[e.channel_index]?.gain||n?.masterGain||i.destination;return s.connect(a),i.resume?.(),s}catch{return null}}channelTap(e){let t=P(this.sessionId),n=t?.audioCtx,i=t?.channels?.[e.channel_index]?.gain;if(!n?.createMediaStreamDestination||!i)return null;try{let s=n.createMediaStreamDestination();return i.connect(s),{stream:s.stream,node:s}}catch{return null}}ensurePlaybackStarted(){let e=this.clock();e.playing||(this.recordingStartedPlayback=!0,e.play())}beginRecording(e,t,n){n!==this.recordingGeneration||this.lanes.length===0||this.recordersActive()||(this.recordingPending=!1,this.recordingStartMs=performance.now(),this.recordingStartBeat=this.clampBeat(t),this.recordingStopBeat=null,this.pendingClips=[],this.lanes.forEach(i=>{if(i.chunks=[],i.events=[],i.openNotes.clear(),i.done=!1,i.recording=!0,i.kind==="midi"||!i.stream||!e)return;let s=new e(i.stream);s.addEventListener("dataavailable",a=>{a.data?.size&&i.chunks.push(a.data)}),s.addEventListener("stop",()=>this.finalizeLane(i),{once:!0}),i.recorder=s}),this.lanes.forEach(i=>i.recorder?.start()),this.lanes.some(i=>i.kind==="midi")&&this.setNoteListener(!0),this.recordingError="",this.recordingTrack=this.lanes[0].trackIndex,this.recordingTracks=this.lanes.map(i=>i.trackIndex),this.recordingCountdownBeats=0,this.setRecordingFlag(!0),this.ensurePlaybackStarted(),this.status({recordingError:"",recordingTrack:this.recordingTrack,recordingTracks:this.recordingTracks,recordingCountdownBeats:0,isRecording:!0},!0))}scheduleCountIn(e,t,n,i){let a=Math.max(1,M(this.bpm,120))/60,o=performance.now(),l=Math.max(0,n/a*1e3);this.recordingCountdownBeats=n,this.countInTick=setInterval(()=>{let c=(performance.now()-o)/1e3*a,d=Math.max(0,n-c);this.recordingCountdownBeats=d,this.status({recordingCountdownBeats:d},!1),d<=0&&this.countInTick&&(clearInterval(this.countInTick),this.countInTick=null)},50),this.countInTimer=setTimeout(()=>{if(this.countInTimer=null,this.countInTick&&(clearInterval(this.countInTick),this.countInTick=null),this.recordingCountdownBeats=0,this.status({recordingCountdownBeats:0},!1),this.disposed){this.releaseLanes();return}i===this.recordingGeneration&&this.beginRecording(e,t,i)},l)}async startRecording(){if(this.recordingActive())return;let e=this.findRecordingTracks();if(e.length===0){this.writeRecordingError("Add a track before recording");return}let t=this.trackList(),n=e.some(l=>t[l].input==="microphone"),i=e.some(l=>t[l].input!=="midi"),s=navigator,a=globalThis.MediaRecorder;if(i&&!a||n&&!s.mediaDevices?.getUserMedia){this.writeRecordingError(n?"Microphone recording is unavailable in this browser":"Recording is unavailable in this browser");return}let o=++this.recordingGeneration;this.recordingPending=!0,this.recordingError="",this.recordingTrack=e[0],this.recordingTracks=e,this.recordingCountdownBeats=0,this.setRecordingFlag(!0),this.status({recordingError:"",recordingTrack:e[0],recordingTracks:e,recordingCountdownBeats:0,isRecording:!0},!0);try{let l=null;if(n){if(l=await s.mediaDevices.getUserMedia({audio:!0}),this.disposed||o!==this.recordingGeneration||!this.recordingPending||!this.isRecording){l.getTracks().forEach(f=>f.stop()),o===this.recordingGeneration&&(this.recordingPending=!1);return}this.micStream=l}let c=[],d=(f,$)=>({trackIndex:f,kind:$,stream:null,recorder:null,recording:!1,chunks:[],events:[],openNotes:new Map,tap:null,monitor:null,done:!1});for(let f of e){let $=t[f];if($.input==="midi")c.push(d(f,"midi"));else if($.input==="channel"){let b=this.channelTap($);if(!b)throw new Error(`Mixer channel ${$.channel_index+1} is not available for recording`);c.push({...d(f,"audio"),stream:b.stream,tap:b.node})}else c.push({...d(f,"audio"),stream:l,monitor:this.startInputMonitoring($,l)})}this.lanes=c;let p=this.beatNow(),h=this.countInBeats(),m=h>0?Math.max(0,p-h):p,y=h>0?p>0?p-m:h:0;this.recordingCountdownBeats=y,h>0&&p>0&&(this.clock().seek(m),this.ensurePlaybackStarted()),this.status({recordingCountdownBeats:y},!0),y>0?this.scheduleCountIn(a,p,y,o):this.beginRecording(a,p,o)}catch(l){if(o!==this.recordingGeneration)return;this.releaseLanes(),this.recordingPending=!1,this.recordingStartedPlayback=!1,this.writeRecordingError(l instanceof Error?l.message:"Could not start recording")}}stopRecording(){if(this.clearCountIn(),!this.recordersActive()){this.recordingGeneration+=1,this.recordingPending=!1,this.setRecordingFlag(!1),this.recordingTrack=-1,this.recordingTracks=[],this.recordingCountdownBeats=0;let t=this.recordingStartedPlayback;this.recordingStartedPlayback=!1,this.releaseLanes(),this.status({isRecording:!1,recordingTrack:-1,recordingTracks:[],recordingCountdownBeats:0},!0),t&&this.clock().stop();return}this.recordingStopBeat=Math.max(this.recordingStartBeat,this.beatNow()),this.setNoteListener(!1);let e=this.recordingStopBeat;this.lanes.forEach(t=>{if(t.kind==="midi"){t.recording&&this.finalizeMidiLane(t,e);return}let n=t.recorder;n&&(n.state!=="inactive"?n.stop():this.finalizeLane(t))})}triggerMidiNote(e,t,n,i){if(Xt(this.sessionId,e.channel_index)==="launcher")return;let s=this.clock(),a=P(this.sessionId),o=a?.samplers?.[e.channel_index],l=a?.instruments?.[e.channel_index],c=t.duration*i;if(Pe(this.sessionId,{note:t.note,velocity:t.velocity,type:"on",at:n,duration:c}),l){let h=l.scheduleNote(t.note,t.velocity,n,c);if(h){this.scheduledNotes.push({cancel:h,until:n+c+fi});let m=s.now();this.scheduledNotes=this.scheduledNotes.filter(y=>y.until>m)}return}if(o){let h=Math.max(0,(n-s.now())*1e3);this.scheduledTimers.push(setTimeout(()=>o.triggerNote(t.note,t.velocity),h)),this.scheduledTimers.push(setTimeout(()=>o.releaseNote(t.note),h+c*1e3)),this.scheduledNotes.push({cancel:()=>o.releaseNote(t.note),until:n+c+fi});return}let d=s.context();if(!d)return;let p=ri(d,a?.channels?.[e.channel_index]?.gain||a?.masterGain||null,si(t.note),t.velocity/127,n,c);p&&this.scheduledNotes.push({cancel:()=>{try{p.stop(0),p.disconnect()}catch{}},until:n+c+fi})}scheduleMidi(e,t){let n=this.clock(),i=n.beat(),s=n.loop,a=s.enabled&&s.endBeat>s.startBeat;i<this.midiLastBeat-1e-6&&(this.midiCursorBeat=a&&i<s.endBeat?Math.min(i,s.startBeat):i),this.midiLastBeat=i;let o=n.secondsPerBeat(),l=i+Os/o;a&&i<s.endBeat&&(l=Math.min(l,s.endBeat)),!(l<=this.midiCursorBeat)&&(e.forEach(c=>{let d=t[c.track_index];if(!d)return;let p=c.offset||0;(c.events||[]).forEach(h=>{let m=h.beat-p;if(m<0||m>=c.duration)return;let y=c.start+m;y<this.midiCursorBeat||y>=l||this.triggerMidiNote(d,h,n.now()+(y-i)*o,o)})}),this.midiCursorBeat=l)}startMidiPlayback(e){let t=this.trackList(),n=t.some(a=>a.solo),i=this.clipList().filter(a=>{let o=t[a.track_index];return a.kind==="midi"&&o&&!o.muted&&!(n&&!o.solo)&&!a.muted&&(a.events||[]).length>0});if(i.length===0)return;let s=Os/this.clock().secondsPerBeat();this.midiCursorBeat=Math.max(0,e-s),this.midiLastBeat=e,this.scheduleMidi(i,t),this.midiTimer=setInterval(()=>this.scheduleMidi(i,t),Pa)}connectMediaElement(e,t){let n=P(this.sessionId),i=n?.audioCtx||this.context;if(!(!i||!i.createMediaElementSource))try{let s=i.createMediaElementSource(e),a=n?.channels?.[t.channel_index]?.gain||n?.masterGain||i.destination;s.connect(a),this.activeSources.push(s)}catch{}}playClip(e,t){if(e.kind==="midi"||!e.audio_url||e.muted)return;let n=this.trackList()[e.track_index];if(!n||n.muted)return;let i=new Audio(e.audio_url);i.preload="auto",i.loop=!!e.loop,i.currentTime=Math.max(0,t),this.connectMediaElement(i,n),this.activeMedia.push(i),i.play().catch(()=>{})}maybeExtendTimelineForRecording(e){if(!this.isRecording||!this.autoExtendRecording)return!1;let t=this.beatsPerBar(),n=this.timelineLength();if(n>=st||e<n-t)return!1;let i=Math.max(t,this.recordingExtendBeats()),s=n;for(;e>=s-t&&s<st;)s=Math.min(st,s+i);return s<=n?!1:(this.length=s,this.set({length:s}),!0)}keepPlayheadVisible(e){let t=Math.max(0,M(this.pixelsPerBeat,0));if(t<=0)return;let n=this.querySelector(".nbplay-timeline-scroll"),i=this.querySelector(".nbplay-timeline-ruler-spacer");if(!n)return;let s=i?.offsetWidth||0,a=e*t,o=n.clientWidth-s;o<=0||(a<n.scrollLeft||a>n.scrollLeft+o)&&(n.scrollLeft=Math.max(0,a-o*.2))}startPlayback(){this.clearScheduledPlayback();let e=this.clock();e.context()?.resume?.();let t=this.timelineLength();if(e.beat()>=t){e.seek(0);return}let n=this.trackList(),i=n.some(l=>l.solo),s=this.clipList(),a=e.secondsPerBeat(),o=e.beat();this.displayBeat=o,this.startMidiPlayback(o),s.forEach(l=>{let c=n[l.track_index];if(l.kind==="midi"||!c||c.muted||i&&!c.solo||l.muted||$n(l)<=o&&!l.loop)return;let d=l.start-o,p=Math.max(0,d*a*1e3),m=((l.loop&&o>l.start?(o-l.start)%Math.max(.001,l.duration):Math.max(0,o-l.start))+(l.offset||0))*a;this.scheduledTimers.push(setTimeout(()=>this.playClip(l,m),p))}),this.playheadTimer=setInterval(()=>{let l=e.beat();this.maybeExtendTimelineForRecording(l);let c=this.timelineLength();if(l>=c){this.displayBeat=c,this.clearScheduledPlayback(),e.stop(),e.seek(c);return}this.displayBeat=l,this.keepPlayheadVisible(l)},wa)}seekToBeat(e,t=!0,n=!0){if(this.recordingActive())return;let i=this.clampBeat(e),s=this.clock();s.playing&&!n&&this.clearScheduledPlayback(),this.suppressRestart=!n;try{s.seek(i)}finally{this.suppressRestart=!1}t&&this.status({},!0)}toggleLoop(){let e=this.clock(),t=e.loop;if(t.enabled){e.setLoop(!1,t.startBeat,t.endBeat);return}let n=this.beatsPerBar(),i=this.timelineLength(),s=t.endBeat>t.startBeat&&t.startBeat<i,a=s?t.startBeat:0,o=s?Math.min(i,t.endBeat):Math.min(i,4*n);e.setLoop(!0,a,Math.max(a+n,o))}syncLoopRange(){this.requestUpdate()}updateTrack(e,t){let n=this.trackList();e<0||e>=n.length||(n[e]={...n[e],...t},this.tracks=n,this.set({tracks:n}))}selectClip(e){this.selectedClipId=e,this.set({selectedClipId:e})}writeClips(e,t){let n={clips:e};this.clips=e,t!==void 0&&(this.selectedClipId=t,n.selectedClipId=t);let i=e.reduce((s,a)=>Math.max(s,$n(a)),0);i>this.timelineLength()&&(this.length=Math.min(st,i),n.length=this.length),this.set(n)}removeSelectedClip(){let e=String(this.selectedClipId||"");e&&this.writeClips(this.clipList().filter(t=>t.id!==e),"")}duplicateSelectedClip(){let e=String(this.selectedClipId||""),t=this.clipList(),n=t.find(s=>s.id===e);if(!n)return;let i={...n,id:vi(),start:$n(n)};this.writeClips([...t,i],i.id)}laneIndexAt(e){let t=this.querySelectorAll("nbplay-lane");for(let n of t){let i=n.getBoundingClientRect();if(e>=i.top&&e<=i.bottom)return M(n.dataset.track,-1)}return-1}onClipEdit(e){e.stopPropagation();let t=e.detail;if(t.field!=="clip")return;let n=this.laneIndexAt(t.clientY);this.writeClips(this.clipList().map(i=>i.id===t.id?{...i,start:t.start,duration:t.duration,offset:t.offset,track_index:n>=0?n:i.track_index}:i),t.id)}handleExportRequest(){if(this.disposed)return;let e=String(this.exportClipId||"");if(!e)return;let t=this.clipList().find(i=>i.id===e),n=i=>{this.disposed||(this.recordingError=i,this.status({recordingError:i},!1),i&&(this.exportClipId="",this.set({exportClipId:""})))};if(!t?.audio_url){n("Clip has no audio to export");return}fetch(t.audio_url).then(i=>i.blob()).then(async i=>{let s=await i.arrayBuffer();this.disposed||(this.exportedClip={...t,blob_type:i.type||t.blob_type||"",blob_size:i.size},this.exportedClipData=new DataView(s),this.status({exportedClip:this.exportedClip,exportedClipData:this.exportedClipData},!1),n(""))}).catch(i=>{n(`Export failed: ${i instanceof Error?i.message:String(i)}`)})}handleImportRequest(){if(this.disposed)return;let e=this.importClipRequest||{};if(!e.id)return;let t=Ta(this.importClipData);if(!t||t.length===0||e.blob_size&&t.length!==e.blob_size)return;let n=new Blob([t.slice()],{type:e.blob_type||"audio/webm"}),i=URL.createObjectURL(n);this.objectUrls.add(i);let s=o=>{if(this.disposed)return;let l=this.clipList().map(c=>c.id===e.id?{...c,audio_url:i,blob_type:n.type,blob_size:n.size,duration:o??c.duration}:c);this.importClipRequest={},this.set({importClipRequest:{}}),this.writeClips(l)},a=this.context;if(e.measure_duration&&a?.decodeAudioData){let o=t.slice().buffer;Promise.resolve(a.decodeAudioData(o)).then(l=>{let c=M(l.duration,l.length/Math.max(1,l.sampleRate))||0,d=Math.max(1,M(this.bpm,120));s(c>0?Math.max(Na,c*(d/60)):null)}).catch(()=>s(null));return}s(null)}render(){let e=this.trackList(),t=this.clipList(),n=this.timelineLength(),i=this.beatsPerBar(),s=Math.max(1,Math.ceil(n/i)),a=Math.max(0,M(this.pixelsPerBeat,0)),o=a>0?n*a:0,l=this.clampBeat(this.displayBeat??M(this.currentBeat,0)),c=!!this.isPlaying,d=!!this.isRecording,p=Math.max(0,M(this.recordingCountdownBeats,0)),h=this.binding?this.clock().loop:{enabled:!1,startBeat:0,endBeat:0},m=String(this.selectedClipId||""),y=(this.recordingTracks||[]).map(b=>M(b,-1)),f=b=>b.stopPropagation(),$=(b,E,v,S,T,A,_,j)=>u`<label class="nbplay-timeline-field" title=${v}>
        <span>${E}</span>
        <input
          class=${b}
          type="number"
          min=${T}
          max=${A}
          step=${_}
          .value=${String(S)}
          @input=${f}
          @change=${Z=>{Z.stopPropagation();let F=Number(Z.target.value);j(N(Number.isFinite(F)?F:S,T,A))}}
        />
      </label>`;return u`<nbplay-header badge="timeline">
        <div class="nbplay-timeline-actions">
          ${$("nbplay-timeline-bars","Bars","Timeline length in bars",s,1,256,1,b=>{this.length=b*this.beatsPerBar(),this.set({length:this.length})})}
          ${$("nbplay-timeline-count-in","Count","Recording count-in in bars",Math.max(0,M(this.countInBars,0)),0,8,1,b=>{this.countInBars=b,this.set({countInBars:b})})}
          <label
            class="nbplay-timeline-field"
            title="Extend timeline while recording"
          >
            <span>Auto</span>
            <input
              class="nbplay-timeline-auto-extend"
              type="checkbox"
              .checked=${!!this.autoExtendRecording}
              @input=${f}
              @change=${b=>{b.stopPropagation(),this.autoExtendRecording=b.target.checked,this.set({autoExtendRecording:this.autoExtendRecording})}}
            />
          </label>
          ${$("nbplay-timeline-extend-bars","Ext","Bars to add while recording",Math.max(1,M(this.recordingExtendBars,8)),1,256,1,b=>{this.recordingExtendBars=b,this.set({recordingExtendBars:b})})}
          ${$("nbplay-timeline-zoom","Zoom","Zoom in pixels per beat (0 fits the width)",a,0,400,4,b=>{this.pixelsPerBeat=b,this.set({pixelsPerBeat:b})})}
          <button
            type="button"
            class="nbplay-timeline-loop-btn ${h.enabled?"active":""}"
            title="Toggle loop range"
            @click=${()=>this.toggleLoop()}
          >
            ↻
          </button>
          <button
            type="button"
            class="nbplay-timeline-reset"
            title="Reset playhead"
            @click=${()=>this.seekToBeat(0)}
          >
            ⏮
          </button>
          <button
            type="button"
            class="nbplay-timeline-play ${c?"active":""}"
            title=${c?"Stop timeline":"Play timeline"}
            @click=${()=>this.togglePlay()}
          >
            ${c?"\u25A0":"\u25B6"}
          </button>
          <button
            type="button"
            class="nbplay-timeline-record ${d?"active":""}"
            title=${d?"Stop recording":"Record armed tracks"}
            @click=${()=>this.toggleRecord()}
          >
            ${d&&p>0?Math.ceil(p):"\u25CF"}
          </button>
          <button
            type="button"
            class="nbplay-timeline-duplicate"
            title="Duplicate selected clip"
            @click=${()=>this.duplicateSelectedClip()}
          >
            ⧉
          </button>
          <button
            type="button"
            class="nbplay-timeline-delete"
            title="Delete selected clip"
            @click=${()=>this.removeSelectedClip()}
          >
            ✕
          </button>
        </div>
        <div class="nbplay-timeline-position">${ce(l,i)}</div>
      </nbplay-header>
      <div class="nbplay-timeline-scroll ${a>0?"zoomed":""}">
        <div class="nbplay-timeline-ruler">
          <div class="nbplay-timeline-ruler-spacer"></div>
          <nbplay-ruler
            .length=${n}
            .beatsPerBar=${i}
            .beat=${l}
            .loopStart=${h.startBeat}
            .loopEnd=${h.endBeat}
            .loopEnabled=${h.enabled}
            .width=${o}
            .disabled=${this.recordingActive()}
            @nbplay-seek=${b=>{b.stopPropagation();let{beat:E,final:v}=b.detail;this.seekToBeat(E,v,v)}}
            @input=${b=>this.onLoopEdit(b)}
            @change=${b=>this.onLoopEdit(b)}
          ></nbplay-ruler>
        </div>
        <div class="nbplay-timeline-body">
          ${e.length?e.map((b,E)=>this.renderLane(b,E,t,n,i,l,o,m,y.includes(E))):u`<div class="nbplay-timeline-empty">No tracks</div>`}
        </div>
      </div>
      <div class="nbplay-timeline-status">
        ${String(this.recordingError||"")}
      </div>`}onLoopEdit(e){e.stopPropagation();let{field:t,value:n}=e.detail,i=this.clock(),s=i.loop;t==="loopStart"?i.setLoop(!0,n,s.endBeat):t==="loopEnd"&&i.setLoop(!0,s.startBeat,n)}renderLane(e,t,n,i,s,a,o,l,c){let d=e.channel_index>=0?`Ch ${e.channel_index+1}`:"No channel",p=n.filter(h=>h.track_index===t).map(h=>({id:h.id,name:h.name,start:h.start,duration:h.duration,offset:h.offset,kind:h.kind,pattern:!!h.pattern,muted:h.muted,detail:h.pattern?`${ce(h.start,s)} \xB7 pattern`:h.kind==="midi"?`${ce(h.start,s)} \xB7 ${(h.events||[]).length} notes`:ce(h.start,s)}));return u`<nbplay-lane
      data-track=${t}
      .name=${e.name}
      .armed=${e.armed}
      .monitor=${e.monitor}
      .muted=${e.muted}
      .solo=${e.solo}
      .input=${e.input}
      .inputs=${[{value:"microphone",label:"Mic"},{value:"channel",label:d,disabled:e.channel_index<0},{value:"midi",label:"MIDI"}]}
      .clips=${p}
      .length=${i}
      .beatsPerBar=${s}
      .beat=${a}
      .selected=${l}
      .recording=${c}
      .width=${o}
      .disabled=${!1}
      @nbplay-seek=${h=>{h.stopPropagation();let{beat:m,final:y}=h.detail;this.seekToBeat(m,y,y)}}
      @nbplay-clip-select=${h=>{h.stopPropagation(),this.selectClip(h.detail.id)}}
      @input=${h=>h.stopPropagation()}
      @change=${h=>{let m=h.detail;if(m.field==="clip"){this.onClipEdit(h);return}h.stopPropagation(),this.updateTrack(t,{[m.field]:m.value})}}
    ></nbplay-lane>`}};k("nbplay-timeline",Sn);function Ma(r){return r.replace(/_([a-z])/g,(e,t)=>t.toUpperCase())}var Aa=["Null","Bool","Int","Float","Str","Bytes","List","Map"];function gi(r){if(r==="Null")return null;if(typeof r=="object"&&r!==null){let e=Object.keys(r);if(e.length===1&&Aa.includes(e[0])){let t=e[0],n=r[t];return t==="Null"?null:t==="List"?n.map(gi):t==="Map"?Object.fromEntries(Object.entries(n).map(([i,s])=>[i,gi(s)])):n}}return r}function Ba(r,e){switch(r){case"is_playing":return{action:e?"play":"stop"};case"is_recording":return{action:"record",on:!!e};case"current_beat":return{action:"seek",beat:Number(e)};default:return null}}var ki=class extends HTMLElement{stop=null;get namespace(){return this.getAttribute("namespace")??"status"}set namespace(e){this.setAttribute("namespace",e)}connectedCallback(){let e={namespace:this.namespace};this.dispatchEvent(new CustomEvent("spaday:wire-request",{detail:e,bubbles:!0,composed:!0}));let t=e.wire,n=this.parentElement;if(!t||!n)return;let i=t.client.onCommand(a=>{if(t.link.modelId!==void 0&&a.id!==t.link.modelId)return;let o=gi(a.value);if(typeof n.command=="function"){let l=Ba(a.field,o)??(o&&typeof o=="object"&&!Array.isArray(o)?o:null);l&&n.command(l)}else{let l=Ma(a.field);n[l]=o,n.dispatchEvent(new CustomEvent("nbplay-status",{detail:{values:{[l]:o},save:!0},bubbles:!0}))}t.client.ackCommand(a)}),s=a=>{a.target===n&&t.client.flushOwned()};n.addEventListener("nbplay-flush",s),this.stop=()=>{i(),n.removeEventListener("nbplay-flush",s)}}disconnectedCallback(){this.stop?.(),this.stop=null}};customElements.get("nbplay-wire")||customElements.define("nbplay-wire",ki);export{ki as NbplayWire,Ma as camel,Ba as statusCommand,gi as untag};
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
lit-html/lit-html.js:
lit-element/lit-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
//# sourceMappingURL=index.js.map
