var Oe=globalThis,qe=Oe.ShadowRoot&&(Oe.ShadyCSS===void 0||Oe.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Vi=Symbol(),Oi=new WeakMap,Ve=class{constructor(e,t,i){if(this._$cssResult$=!0,i!==Vi)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(qe&&e===void 0){let i=t!==void 0&&t.length===1;i&&(e=Oi.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&Oi.set(t,e))}return e}toString(){return this.cssText}},qi=r=>new Ve(typeof r=="string"?r:r+"",void 0,Vi);var Ui=(r,e)=>{if(qe)r.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let t of e){let i=document.createElement("style"),n=Oe.litNonce;n!==void 0&&i.setAttribute("nonce",n),i.textContent=t.cssText,r.appendChild(i)}},Zt=qe?r=>r:r=>r instanceof CSSStyleSheet?(e=>{let t="";for(let i of e.cssRules)t+=i.cssText;return qi(t)})(r):r;var{is:Kn,defineProperty:Gn,getOwnPropertyDescriptor:Zn,getOwnPropertyNames:Wn,getOwnPropertySymbols:jn,getPrototypeOf:Yn}=Object,Ue=globalThis,Fi=Ue.trustedTypes,Qn=Fi?Fi.emptyScript:"",Xn=Ue.reactiveElementPolyfillSupport,ke=(r,e)=>r,Wt={toAttribute(r,e){switch(e){case Boolean:r=r?Qn:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,e){let t=r;switch(e){case Boolean:t=r!==null;break;case Number:t=r===null?null:Number(r);break;case Object:case Array:try{t=JSON.parse(r)}catch{t=null}}return t}},Hi=(r,e)=>!Kn(r,e),zi={attribute:!0,type:String,converter:Wt,reflect:!1,useDefault:!1,hasChanged:Hi};Symbol.metadata??=Symbol("metadata"),Ue.litPropertyMetadata??=new WeakMap;var Y=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=zi){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let i=Symbol(),n=this.getPropertyDescriptor(e,i,t);n!==void 0&&Gn(this.prototype,e,n)}}static getPropertyDescriptor(e,t,i){let{get:n,set:s}=Zn(this.prototype,e)??{get(){return this[t]},set(a){this[t]=a}};return{get:n,set(a){let o=n?.call(this);s?.call(this,a),this.requestUpdate(e,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??zi}static _$Ei(){if(this.hasOwnProperty(ke("elementProperties")))return;let e=Yn(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(ke("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(ke("properties"))){let t=this.properties,i=[...Wn(t),...jn(t)];for(let n of i)this.createProperty(n,t[n])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[i,n]of t)this.elementProperties.set(i,n)}this._$Eh=new Map;for(let[t,i]of this.elementProperties){let n=this._$Eu(t,i);n!==void 0&&this._$Eh.set(n,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let i=new Set(e.flat(1/0).reverse());for(let n of i)t.unshift(Zt(n))}else e!==void 0&&t.push(Zt(e));return t}static _$Eu(e,t){let i=t.attribute;return i===!1?void 0:typeof i=="string"?i:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let i of t.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Ui(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,i){this._$AK(e,i)}_$ET(e,t){let i=this.constructor.elementProperties.get(e),n=this.constructor._$Eu(e,i);if(n!==void 0&&i.reflect===!0){let s=(i.converter?.toAttribute!==void 0?i.converter:Wt).toAttribute(t,i.type);this._$Em=e,s==null?this.removeAttribute(n):this.setAttribute(n,s),this._$Em=null}}_$AK(e,t){let i=this.constructor,n=i._$Eh.get(e);if(n!==void 0&&this._$Em!==n){let s=i.getPropertyOptions(n),a=typeof s.converter=="function"?{fromAttribute:s.converter}:s.converter?.fromAttribute!==void 0?s.converter:Wt;this._$Em=n;let o=a.fromAttribute(t,s.type);this[n]=o??this._$Ej?.get(n)??o,this._$Em=null}}requestUpdate(e,t,i,n=!1,s){if(e!==void 0){let a=this.constructor;if(n===!1&&(s=this[e]),i??=a.getPropertyOptions(e),!((i.hasChanged??Hi)(s,t)||i.useDefault&&i.reflect&&s===this._$Ej?.get(e)&&!this.hasAttribute(a._$Eu(e,i))))return;this.C(e,t,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:i,reflect:n,wrapped:s},a){i&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,a??t??this[e]),s!==!0||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||i||(t=void 0),this._$AL.set(e,t)),n===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[n,s]of this._$Ep)this[n]=s;this._$Ep=void 0}let i=this.constructor.elementProperties;if(i.size>0)for(let[n,s]of i){let{wrapped:a}=s,o=this[n];a!==!0||this._$AL.has(n)||o===void 0||this.C(n,void 0,s,o)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(t)):this._$EM()}catch(i){throw e=!1,this._$EM(),i}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};Y.elementStyles=[],Y.shadowRootOptions={mode:"open"},Y[ke("elementProperties")]=new Map,Y[ke("finalized")]=new Map,Xn?.({ReactiveElement:Y}),(Ue.reactiveElementVersions??=[]).push("2.1.2");var ti=globalThis,Ki=r=>r,Fe=ti.trustedTypes,Gi=Fe?Fe.createPolicy("lit-html",{createHTML:r=>r}):void 0,Xi="$lit$",Q=`lit$${Math.random().toFixed(9).slice(2)}$`,Ji="?"+Q,Jn=`<${Ji}>`,se=document,$e=()=>se.createComment(""),Se=r=>r===null||typeof r!="object"&&typeof r!="function",ii=Array.isArray,es=r=>ii(r)||typeof r?.[Symbol.iterator]=="function",jt=`[ 	
\f\r]`,Ee=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Zi=/-->/g,Wi=/>/g,ie=RegExp(`>|${jt}(?:([^\\s"'>=/]+)(${jt}*=${jt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),ji=/'/g,Yi=/"/g,en=/^(?:script|style|textarea|title)$/i,ni=r=>(e,...t)=>({_$litType$:r,strings:e,values:t}),c=ni(1),Ce=ni(2),Pr=ni(3),re=Symbol.for("lit-noChange"),x=Symbol.for("lit-nothing"),Qi=new WeakMap,ne=se.createTreeWalker(se,129);function tn(r,e){if(!ii(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return Gi!==void 0?Gi.createHTML(e):e}var ts=(r,e)=>{let t=r.length-1,i=[],n,s=e===2?"<svg>":e===3?"<math>":"",a=Ee;for(let o=0;o<t;o++){let l=r[o],u,b,m=-1,p=0;for(;p<l.length&&(a.lastIndex=p,b=a.exec(l),b!==null);)p=a.lastIndex,a===Ee?b[1]==="!--"?a=Zi:b[1]!==void 0?a=Wi:b[2]!==void 0?(en.test(b[2])&&(n=RegExp("</"+b[2],"g")),a=ie):b[3]!==void 0&&(a=ie):a===ie?b[0]===">"?(a=n??Ee,m=-1):b[1]===void 0?m=-2:(m=a.lastIndex-b[2].length,u=b[1],a=b[3]===void 0?ie:b[3]==='"'?Yi:ji):a===Yi||a===ji?a=ie:a===Zi||a===Wi?a=Ee:(a=ie,n=void 0);let h=a===ie&&r[o+1].startsWith("/>")?" ":"";s+=a===Ee?l+Jn:m>=0?(i.push(u),l.slice(0,m)+Xi+l.slice(m)+Q+h):l+Q+(m===-2?o:h)}return[tn(r,s+(r[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),i]},xe=class r{constructor({strings:e,_$litType$:t},i){let n;this.parts=[];let s=0,a=0,o=e.length-1,l=this.parts,[u,b]=ts(e,t);if(this.el=r.createElement(u,i),ne.currentNode=this.el.content,t===2||t===3){let m=this.el.content.firstChild;m.replaceWith(...m.childNodes)}for(;(n=ne.nextNode())!==null&&l.length<o;){if(n.nodeType===1){if(n.hasAttributes())for(let m of n.getAttributeNames())if(m.endsWith(Xi)){let p=b[a++],h=n.getAttribute(m).split(Q),k=/([.?@])?(.*)/.exec(p);l.push({type:1,index:s,name:k[2],strings:h,ctor:k[1]==="."?Qt:k[1]==="?"?Xt:k[1]==="@"?Jt:de}),n.removeAttribute(m)}else m.startsWith(Q)&&(l.push({type:6,index:s}),n.removeAttribute(m));if(en.test(n.tagName)){let m=n.textContent.split(Q),p=m.length-1;if(p>0){n.textContent=Fe?Fe.emptyScript:"";for(let h=0;h<p;h++)n.append(m[h],$e()),ne.nextNode(),l.push({type:2,index:++s});n.append(m[p],$e())}}}else if(n.nodeType===8)if(n.data===Ji)l.push({type:2,index:s});else{let m=-1;for(;(m=n.data.indexOf(Q,m+1))!==-1;)l.push({type:7,index:s}),m+=Q.length-1}s++}}static createElement(e,t){let i=se.createElement("template");return i.innerHTML=e,i}};function ue(r,e,t=r,i){if(e===re)return e;let n=i!==void 0?t._$Co?.[i]:t._$Cl,s=Se(e)?void 0:e._$litDirective$;return n?.constructor!==s&&(n?._$AO?.(!1),s===void 0?n=void 0:(n=new s(r),n._$AT(r,t,i)),i!==void 0?(t._$Co??=[])[i]=n:t._$Cl=n),n!==void 0&&(e=ue(r,n._$AS(r,e.values),n,i)),e}var Yt=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:i}=this._$AD,n=(e?.creationScope??se).importNode(t,!0);ne.currentNode=n;let s=ne.nextNode(),a=0,o=0,l=i[0];for(;l!==void 0;){if(a===l.index){let u;l.type===2?u=new we(s,s.nextSibling,this,e):l.type===1?u=new l.ctor(s,l.name,l.strings,this,e):l.type===6&&(u=new ei(s,this,e)),this._$AV.push(u),l=i[++o]}a!==l?.index&&(s=ne.nextNode(),a++)}return ne.currentNode=se,n}p(e){let t=0;for(let i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(e,i,t),t+=i.strings.length-2):i._$AI(e[t])),t++}},we=class r{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,i,n){this.type=2,this._$AH=x,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=i,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=ue(this,e,t),Se(e)?e===x||e==null||e===""?(this._$AH!==x&&this._$AR(),this._$AH=x):e!==this._$AH&&e!==re&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):es(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==x&&Se(this._$AH)?this._$AA.nextSibling.data=e:this.T(se.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:i}=e,n=typeof i=="number"?this._$AC(e):(i.el===void 0&&(i.el=xe.createElement(tn(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===n)this._$AH.p(t);else{let s=new Yt(n,this),a=s.u(this.options);s.p(t),this.T(a),this._$AH=s}}_$AC(e){let t=Qi.get(e.strings);return t===void 0&&Qi.set(e.strings,t=new xe(e)),t}k(e){ii(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,i,n=0;for(let s of e)n===t.length?t.push(i=new r(this.O($e()),this.O($e()),this,this.options)):i=t[n],i._$AI(s),n++;n<t.length&&(this._$AR(i&&i._$AB.nextSibling,n),t.length=n)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let i=Ki(e).nextSibling;Ki(e).remove(),e=i}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},de=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,i,n,s){this.type=1,this._$AH=x,this._$AN=void 0,this.element=e,this.name=t,this._$AM=n,this.options=s,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=x}_$AI(e,t=this,i,n){let s=this.strings,a=!1;if(s===void 0)e=ue(this,e,t,0),a=!Se(e)||e!==this._$AH&&e!==re,a&&(this._$AH=e);else{let o=e,l,u;for(e=s[0],l=0;l<s.length-1;l++)u=ue(this,o[i+l],t,l),u===re&&(u=this._$AH[l]),a||=!Se(u)||u!==this._$AH[l],u===x?e=x:e!==x&&(e+=(u??"")+s[l+1]),this._$AH[l]=u}a&&!n&&this.j(e)}j(e){e===x?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},Qt=class extends de{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===x?void 0:e}},Xt=class extends de{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==x)}},Jt=class extends de{constructor(e,t,i,n,s){super(e,t,i,n,s),this.type=5}_$AI(e,t=this){if((e=ue(this,e,t,0)??x)===re)return;let i=this._$AH,n=e===x&&i!==x||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,s=e!==x&&(i===x||n);n&&this.element.removeEventListener(this.name,this,i),s&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},ei=class{constructor(e,t,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){ue(this,e)}};var is=ti.litHtmlPolyfillSupport;is?.(xe,we),(ti.litHtmlVersions??=[]).push("3.3.3");var nn=(r,e,t)=>{let i=t?.renderBefore??e,n=i._$litPart$;if(n===void 0){let s=t?.renderBefore??null;i._$litPart$=n=new we(e.insertBefore($e(),s),s,void 0,t??{})}return n._$AI(r),n};var si=globalThis,X=class extends Y{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=nn(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return re}};X._$litElement$=!0,X.finalized=!0,si.litElementHydrateSupport?.({LitElement:X});var ns=si.litElementPolyfillSupport;ns?.({LitElement:X});(si.litElementVersions??=[]).push("4.2.2");var f=class extends X{constructor(){super(),this.theme=""}createRenderRoot(){return this}emit(e,t){this.emitDetail(e,{value:t})}emitDetail(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}};f.createProperty("theme",{type:String,attribute:"data-nbplay-theme",reflect:!0,converter:{fromAttribute:r=>r??"",toAttribute:r=>r||null}});function v(r,e){customElements.get(r)||customElements.define(r,e)}function w(r,e,t){return Math.min(t,Math.max(e,r))}function ae(r,e){if(!(e>0))return r;let t=Math.max(0,Math.ceil(-Math.log10(e)));return Number((Math.round(r/e)*e).toFixed(t))}function U(r,e,t){return getComputedStyle(r).getPropertyValue(e).trim()||t}function D(r){let e=globalThis,t=e.AudioContext||e.webkitAudioContext;if(!t)return null;try{return new t(r)}catch{try{return new t}catch{return null}}}function J(r,e){r.tabIndex<0&&(r.tabIndex=0);function t(i){let n=i.target,s=n?.tagName;if(s==="INPUT"||s==="TEXTAREA"||s==="SELECT"||n?.isContentEditable||i.ctrlKey||i.metaKey||i.altKey)return;let a=i.key===" "?"Space":i.key.length===1?i.key.toLowerCase():i.key,o=i.shiftKey&&a.length>1?`Shift+${a}`:a,l=e[o]??(i.shiftKey?e[a]:void 0);l&&l()!==!1&&(i.preventDefault(),i.stopPropagation())}return r.addEventListener("keydown",t),()=>r.removeEventListener("keydown",t)}function H(r){if(!r||!r.byteLength)return null;if(r instanceof DataView){let e=r.byteLength/4,t=new Float32Array(e);for(let i=0;i<e;i++)t[i]=r.getFloat32(i*4,!0);return t}if(r.buffer instanceof ArrayBuffer){let e=r;return new Float32Array(e.buffer.slice(e.byteOffset,e.byteOffset+e.byteLength))}return r instanceof ArrayBuffer?new Float32Array(r):null}function sn(r){return r<=0?-1/0:20*Math.log10(r)}function ss(r){return Math.pow(10,r/20)}function ri(r){if(r<=0)return"\u2212\u221E dB";let e=20*Math.log10(r);return e>=0?"+"+e.toFixed(1)+" dB":e.toFixed(1)+" dB"}function rn(r){return Math.abs(r)<.01?"C":r<0?"L"+Math.round(Math.abs(r)*100):"R"+Math.round(r*100)}function an(r){let e=r.replace(/\s*db\s*$/i,"").trim();if(e==="\u2212\u221E"||e==="-inf"||e==="-Infinity")return 0;let t=parseFloat(e);if(isNaN(t))return null;let i=ss(t);return Math.max(0,Math.min(2,Math.round(i*1e3)/1e3))}var rs=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];function K(r,e=60){let t=Number(r);return Number.isFinite(t)?Math.max(0,Math.min(127,Math.round(t))):e}function B(r,e=100){let t=Number(r);return Number.isFinite(t)?Math.max(1,Math.min(127,Math.round(t))):e}function P(r){let e=K(r),t=Math.floor(e/12)-1;return rs[e%12]+t}function ze(r){let e=r.trim(),t=Number.parseInt(e,10);if(String(t)===e&&t>=0&&t<=127)return t;let i=e.match(/^([A-Ga-g])([#b]?)\s*(-?\d+)$/);if(!i)return null;let s={c:0,d:2,e:4,f:5,g:7,a:9,b:11}[i[1].toLowerCase()];if(s===void 0)return null;let a=s;i[2]==="#"&&(a+=1),i[2]==="b"&&(a-=1);let l=(Number.parseInt(i[3],10)+1)*12+a;return l>=0&&l<=127?l:null}function ai(r,e,t=48){let i=Math.max(1,Math.min(128,Math.round(e||1))),n=r.slice(0,i).map(a=>K(a)),s=n.length>0?n[n.length-1]+1:t;for(;n.length<i;)n.push(K(s)),s+=1;return n}function He(r,e,t=100){let i=Math.max(1,Math.min(128,Math.round(e||1))),n=r.slice(0,i).map(s=>B(s,t));for(;n.length<i;)n.push(B(t));return n}function as(r){return typeof r=="string"&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(r)}function os(r,e,t){let i={type:"note",note:K(e),velocity:B(t)};if(!r||typeof r!="object")return i;let n=r,s=typeof n.label=="string"?n.label:void 0;if(n.type==="trait"&&as(n.trait)){let l=n.value;if(typeof l=="number"||typeof l=="boolean"||typeof l=="string")return{type:"trait",trait:n.trait,value:l,label:s}}if(n.type==="event")return{type:"event",label:s,value:n.value};let a={type:"note",note:K(n.note,e),velocity:B(n.velocity,t),label:s},o=Number(n.slice);return Number.isInteger(o)&&o>=0&&(a.slice=o),a}function pe(r,e,t,i){let n=Array.isArray(r)?r:[],s=[],a=Math.max(1,Math.round(i||e.length||1));for(let o=0;o<a;o++)s.push(os(n[o],e[o]??e[e.length-1]??60,t[o]??t[t.length-1]??100));return s}function Ke(r){return r.label?r.label:r.type==="note"?P(r.note):r.type==="trait"?r.trait:"event"}function oi(r,e,t=2,i=""){switch(e){case"int":return`${Math.round(r)}${i}`;case"db":return ri(r);case"pan":return rn(r);case"hz":return r>=1e3?(r/1e3).toFixed(2)+" kHz":r.toFixed(1)+" Hz";case"bpm":return`${Math.round(r)} BPM`;case"seconds":return r<.01?(r*1e3).toFixed(1)+" ms":r<1?(r*1e3).toFixed(0)+" ms":r.toFixed(2)+" s";case"percent":return(r*100).toFixed(0)+"%";case"note":return P(r);default:return`${r.toFixed(t)}${i}`}}function li(r,e,t=2){switch(e){case"int":case"bpm":return String(Math.round(r));case"db":return ri(r).replace(" dB","");case"pan":return String(Math.round(r*100)/100);case"percent":return(r*100).toFixed(0);case"note":return P(r);case"float":return r.toFixed(t);default:return String(r)}}function ci(r,e){let t=r.trim();if(!t)return null;switch(e){case"db":return an(t);case"note":return ze(t);case"int":case"bpm":{let i=parseInt(t,10);return Number.isNaN(i)?null:i}case"percent":{let i=parseFloat(t);return Number.isFinite(i)?i>1?i/100:i:null}case"hz":{let i=parseFloat(t);return Number.isFinite(i)?/k/i.test(t)?i*1e3:i:null}default:{let i=parseFloat(t);return Number.isFinite(i)?i:null}}}var on=r=>r.stopPropagation(),Ge=class extends f{static properties={value:{type:Number},kind:{type:String},min:{type:Number},max:{type:Number},precision:{type:Number},unit:{type:String},editable:{type:Boolean},editing:{type:Boolean,reflect:!0}};constructor(){super(),this.value=0,this.kind="float",this.min=-1/0,this.max=1/0,this.precision=2,this.unit="",this.editable=!0,this.editing=!1}get text(){return oi(this.value,this.kind,this.precision,this.unit)}render(){return this.editing?c`<input
        type="text"
        class="nbplay-value-input"
        .value=${li(this.value,this.kind,this.precision)}
        @keydown=${this.onKeydown}
        @blur=${this.commit}
        @input=${on}
        @change=${on}
      />`:c`<span
      class="nbplay-value-text"
      title=${this.editable?"Double-click to edit":x}
      @dblclick=${this.startEdit}
      >${this.text}</span
    >`}startEdit(){!this.editable||this.editing||(this.editing=!0,this.updateComplete.then(()=>{let e=this.querySelector("input");e?.focus(),e?.select()}))}onKeydown(e){e.key==="Enter"?(e.preventDefault(),this.commit()):e.key==="Escape"&&(this.editing=!1)}commit(){if(!this.editing)return;let e=this.querySelector("input");if(this.editing=!1,!e)return;let t=ci(e.value,this.kind);if(t===null)return;let i=w(t,this.min,this.max);i!==this.value&&(this.value=i,this.emit("change",i))}};v("nbplay-value",Ge);var Ze=class extends f{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},orientation:{type:String,reflect:!0},scale:{type:String},disabled:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};internal=null;constructor(){super(),this.value=0,this.min=0,this.max=1,this.step=.01,this.defaultValue=null,this.orientation="horizontal",this.scale="linear",this.disabled=!1,this.dragging=!1}willUpdate(e){e.has("value")&&this.dragging&&this.internal!==null&&this.value!==this.internal&&(this.value=this.internal)}toPos(e){if(this.scale!=="log")return e;let t=Math.log(this.min),i=Math.log(this.max);return(Math.log(Math.max(e,this.min))-t)/(i-t)}fromPos(e){if(this.scale!=="log")return e;let t=Math.log(this.min),i=Math.log(this.max);return Math.exp(t+e*(i-t))}render(){let e=this.scale==="log";return c`<input
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
    />`}readValue(e){let t=parseFloat(e.target.value);return w(ae(this.fromPos(t),this.step),this.min,this.max)}onInput(e){e.stopPropagation(),this.value=this.readValue(e),this.dragging&&(this.internal=this.value),this.emit("input",this.value)}onChange(e){e.stopPropagation(),this.endDrag(),this.emit("change",this.value)}reset(){if(this.disabled||this.defaultValue===null)return;this.endDrag();let e=w(this.defaultValue,this.min,this.max);e!==this.value&&(this.value=e,this.emit("input",e)),this.emit("change",this.value)}startDrag(){this.disabled||(this.dragging=!0,this.internal=this.value)}endDrag(){this.dragging=!1,this.internal=null}};v("nbplay-slider",Ze);var ln=270,Ne=-135,cn=150;function ui(r,e){let t=(r-90)*Math.PI/180;return[50+e*Math.cos(t),50+e*Math.sin(t)]}function un(r,e,t){let[i,n]=ui(r,t),[s,a]=ui(e,t),o=e-r>180?1:0;return`M ${i} ${n} A ${t} ${t} 0 ${o} 1 ${s} ${a}`}var We=class extends f{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},disabled:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};startY=0;startValue=0;constructor(){super(),this.value=0,this.min=0,this.max=1,this.step=.01,this.defaultValue=null,this.disabled=!1,this.dragging=!1}connectedCallback(){super.connectedCallback(),this.hasAttribute("tabindex")||(this.tabIndex=0),this.setAttribute("role","slider"),this.addEventListener("pointerdown",this.onPointerDown),this.addEventListener("pointermove",this.onPointerMove),this.addEventListener("pointerup",this.onPointerUp),this.addEventListener("lostpointercapture",this.onPointerUp),this.addEventListener("wheel",this.onWheel,{passive:!1}),this.addEventListener("keydown",this.onKeydown),this.addEventListener("dblclick",this.onDblclick)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("pointerdown",this.onPointerDown),this.removeEventListener("pointermove",this.onPointerMove),this.removeEventListener("pointerup",this.onPointerUp),this.removeEventListener("lostpointercapture",this.onPointerUp),this.removeEventListener("wheel",this.onWheel),this.removeEventListener("keydown",this.onKeydown),this.removeEventListener("dblclick",this.onDblclick)}updated(){this.setAttribute("aria-valuemin",String(this.min)),this.setAttribute("aria-valuemax",String(this.max)),this.setAttribute("aria-valuenow",String(this.value)),this.setAttribute("aria-disabled",String(this.disabled))}fraction(){return this.max>this.min?w((this.value-this.min)/(this.max-this.min),0,1):0}render(){let e=Ne+this.fraction()*ln,[t,i]=ui(e,30);return c`<svg
      class="nbplay-dial-svg"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      ${Ce`<path class="nbplay-dial-track" d=${un(Ne,Ne+ln,40)} />`}
      ${Ce`<path class="nbplay-dial-arc" d=${un(Ne,Math.max(e,Ne+.01),40)} />`}
      ${Ce`<circle class="nbplay-dial-cap" cx="50" cy="50" r="30" />`}
      ${Ce`<line class="nbplay-dial-indicator" x1="50" y1="50" x2=${t} y2=${i} />`}
    </svg>`}set(e,t){let i=w(ae(e,this.step),this.min,this.max);i!==this.value&&(this.value=i,this.emit("input",i)),t&&this.emit("change",this.value)}reset(){this.disabled||this.defaultValue===null||(this.dragging=!1,this.set(this.defaultValue,!0))}onDblclick=()=>this.reset();onPointerDown=e=>{this.disabled||e.button!==0||(e.preventDefault(),this.focus(),this.setPointerCapture(e.pointerId),this.dragging=!0,this.startY=e.clientY,this.startValue=this.value)};onPointerMove=e=>{if(!this.dragging)return;let t=e.shiftKey?cn*4:cn,i=(this.startY-e.clientY)/t*(this.max-this.min);this.set(this.startValue+i,!1)};onPointerUp=()=>{this.dragging&&(this.dragging=!1,this.emit("change",this.value))};onWheel=e=>{if(this.disabled)return;e.preventDefault();let t=e.deltaY!==0?e.deltaY:e.deltaX;t!==0&&this.set(this.value+(t<0?this.step:-this.step),!0)};onKeydown=e=>{if(this.disabled)return;let t=this.step*10,i={ArrowUp:this.step,ArrowRight:this.step,ArrowDown:-this.step,ArrowLeft:-this.step,PageUp:t,PageDown:-t},n;e.key in i?n=this.value+i[e.key]:e.key==="Home"?n=this.min:e.key==="End"&&(n=this.max),n!==void 0&&(e.preventDefault(),this.set(n,!0))}};v("nbplay-dial",We);var je=class extends f{static properties={level:{type:Number},rms:{type:Number},orientation:{type:String,reflect:!0},floorDb:{type:Number,attribute:"floor-db"},hotThreshold:{type:Number,attribute:"hot-threshold"},hot:{type:Boolean,reflect:!0}};constructor(){super(),this.level=0,this.rms=0,this.orientation="vertical",this.floorDb=-60,this.hotThreshold=.99,this.hot=!1}percent(e){if(!(e>0))return 0;let t=sn(e);return w((t-this.floorDb)/(0-this.floorDb),0,1)*100}willUpdate(){this.hot=this.level>=this.hotThreshold}render(){return c`<div class="nbplay-meter-track">
      <div
        class="nbplay-meter-rms"
        style="--nbplay-meter-fill: ${this.percent(this.rms)}%"
      ></div>
      <div
        class="nbplay-meter-fill"
        style="--nbplay-meter-fill: ${this.percent(this.level)}%"
      ></div>
    </div>`}};v("nbplay-meter",je);var Ye=class extends f{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},orientation:{type:String,reflect:!0},editable:{type:String,reflect:!0},wheelStep:{type:Number,attribute:"wheel-step"},disabled:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};constructor(){super(),this.value=0,this.min=0,this.max=127,this.step=1,this.orientation="vertical",this.editable="",this.wheelStep=1,this.disabled=!1,this.dragging=!1}connectedCallback(){super.connectedCallback(),this.addEventListener("wheel",this.onWheel,{passive:!1}),this.addEventListener("pointerdown",this.onPointerDown),this.addEventListener("pointermove",this.onPointerMove),this.addEventListener("pointerup",this.onPointerUp),this.addEventListener("lostpointercapture",this.onPointerUp)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("wheel",this.onWheel),this.removeEventListener("pointerdown",this.onPointerDown),this.removeEventListener("pointermove",this.onPointerMove),this.removeEventListener("pointerup",this.onPointerUp),this.removeEventListener("lostpointercapture",this.onPointerUp)}can(e){return!this.disabled&&this.editable.split(/\s+/).includes(e)}get percent(){return this.max>this.min?w((this.value-this.min)/(this.max-this.min),0,1)*100:0}render(){return c`<div class="nbplay-bar-track">
      <div
        class="nbplay-bar-fill"
        style="--nbplay-bar-fill: ${this.percent}%"
      ></div>
    </div>`}set(e,t){let i=w(ae(e,this.step),this.min,this.max);i!==this.value&&(this.value=i,this.emit("input",i)),t&&this.emit("change",this.value)}fromPointer(e){let t=this.getBoundingClientRect(),i=this.orientation==="vertical"?1-(e.clientY-t.top)/t.height:(e.clientX-t.left)/t.width;return this.min+w(i,0,1)*(this.max-this.min)}onWheel=e=>{if(!this.can("wheel"))return;e.preventDefault();let t=e.deltaY!==0?e.deltaY:e.deltaX;t!==0&&this.set(this.value+(t<0?this.wheelStep:-this.wheelStep),!0)};onPointerDown=e=>{!this.can("drag")||e.button!==0||(e.preventDefault(),this.setPointerCapture(e.pointerId),this.dragging=!0,this.set(this.fromPointer(e),!1))};onPointerMove=e=>{this.dragging&&this.set(this.fromPointer(e),!1)};onPointerUp=()=>{this.dragging&&(this.dragging=!1,this.emit("change",this.value))}};v("nbplay-bar",Ye);var Qe=class extends f{static properties={data:{attribute:!1},variant:{type:String,reflect:!0},emptyText:{type:String,attribute:"empty-text"}};observer;constructor(){super(),this.data=null,this.variant="line",this.emptyText="No sample loaded"}render(){return c`<canvas class="nbplay-waveform-canvas"></canvas>`}firstUpdated(){this.observer=new ResizeObserver(()=>this.draw()),this.observer.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.observer?.disconnect()}updated(){this.draw()}draw(){let e=this.querySelector("canvas");if(!e)return;let t=this.clientWidth,i=this.clientHeight;if(t===0||i===0)return;let n=window.devicePixelRatio||1;e.width=Math.round(t*n),e.height=Math.round(i*n);let s=e.getContext("2d");if(!s)return;s.setTransform(n,0,0,n,0,0);let a=U(this,"--nbplay-chart-bg","#121214"),o=U(this,"--nbplay-chart-grid","#2f2f36"),l=U(this,"--nbplay-chart-line","#f28c38"),u=U(this,"--nbplay-fg-muted","#a8a59c");s.fillStyle=a,s.fillRect(0,0,t,i),s.strokeStyle=o,s.lineWidth=1,s.setLineDash([3,4]);for(let h of[.25,.5,.75])s.beginPath(),s.moveTo(0,h*i),s.lineTo(t,h*i),s.stroke();s.setLineDash([]);let b=H(this.data);if(!b||b.length===0){s.fillStyle=u,s.font="12px "+U(this,"--nbplay-font-mono","monospace"),s.textAlign="center",s.textBaseline="middle",s.fillText(this.emptyText,t/2,i/2);return}s.beginPath();let m=i/2,p=i*.45;for(let h=0;h<t;h++){let k=Math.floor(h/t*b.length),y=m-b[k]*p;h===0?s.moveTo(h,y):s.lineTo(h,y)}this.variant==="glow"&&(s.strokeStyle=l,s.globalAlpha=.25,s.lineWidth=6,s.stroke(),s.globalAlpha=1),s.strokeStyle=l,s.lineWidth=2,s.lineJoin="round",s.stroke()}};v("nbplay-waveform",Qe);var dn=.3,Xe=class extends f{static properties={attack:{type:Number},decay:{type:Number},sustain:{type:Number},release:{type:Number}};observer;constructor(){super(),this.attack=.005,this.decay=.1,this.sustain=.8,this.release=.1}render(){return c`<canvas class="nbplay-envelope-canvas"></canvas>`}firstUpdated(){this.observer=new ResizeObserver(()=>this.draw()),this.observer.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.observer?.disconnect()}updated(){this.draw()}draw(){let e=this.querySelector("canvas");if(!e)return;let t=this.clientWidth,i=this.clientHeight;if(t===0||i===0)return;let n=window.devicePixelRatio||1;e.width=Math.round(t*n),e.height=Math.round(i*n);let s=e.getContext("2d");if(!s)return;s.setTransform(n,0,0,n,0,0);let a=U(this,"--nbplay-chart-bg","#121214"),o=U(this,"--nbplay-chart-line","#f28c38"),l=U(this,"--nbplay-fg-muted","#a8a59c");s.fillStyle=a,s.fillRect(0,0,t,i);let u=this.attack+this.decay+dn+this.release||1,b=t/u,m=8,p=i-14,h=E=>p-E*(p-m),k=this.attack*b,y=k+this.decay*b,$=y+dn*b;s.beginPath(),s.moveTo(0,p),s.lineTo(k,h(1)),s.lineTo(y,h(this.sustain)),s.lineTo($,h(this.sustain)),s.lineTo(t,p),s.strokeStyle=o,s.lineWidth=2,s.lineJoin="round",s.stroke(),s.lineTo(0,p),s.closePath(),s.fillStyle=o,s.globalAlpha=.15,s.fill(),s.globalAlpha=1,s.fillStyle=l,s.font="10px "+U(this,"--nbplay-font-mono","monospace"),s.textAlign="center",s.textBaseline="bottom";let d=[["A",k/2],["D",(k+y)/2],["S",(y+$)/2],["R",($+t)/2]];for(let[E,g]of d)s.fillText(E,Math.min(Math.max(g,6),t-6),i-2)}};v("nbplay-envelope",Xe);var Je=class extends f{static properties={active:{type:Boolean,reflect:!0},variant:{type:String,reflect:!0},label:{type:String},title:{type:String},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.active=!1,this.variant="default",this.label="",this.title="",this.disabled=!1}render(){return c`<button
      type="button"
      class="nbplay-toggle-button"
      aria-pressed=${String(this.active)}
      title=${this.title||x}
      ?disabled=${this.disabled}
      @click=${this.toggle}
    >
      ${this.label}
    </button>`}toggle(){this.disabled||(this.active=!this.active,this.emit("change",this.active))}};v("nbplay-toggle",Je);var et=class extends f{static properties={beat:{type:Number},beatsPerBar:{type:Number,attribute:"beats-per-bar"},format:{type:String,reflect:!0},pad:{type:Number}};constructor(){super(),this.beat=0,this.beatsPerBar=4,this.format="bar:beat",this.pad=3}get bar(){return Math.floor(Math.max(0,this.beat)/Math.max(1,this.beatsPerBar))+1}get beatInBar(){return Math.floor(Math.max(0,this.beat))%Math.max(1,this.beatsPerBar)+1}render(){let e=this.format==="bar:beat"?String(this.bar).padStart(this.pad,"0"):String(this.bar),t=this.format==="bar:beat"?":":".";return c`<span class="nbplay-position-bar">${e}</span
      ><span class="nbplay-position-sep">${t}</span
      ><span class="nbplay-position-beat">${this.beatInBar}</span>`}};v("nbplay-position",et);var tt=class extends f{static properties={options:{attribute:!1},value:{type:String,reflect:!0},label:{type:String},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.options=[],this.value="",this.label="",this.disabled=!1}render(){let e=this.options.map(t=>typeof t=="string"?{value:t}:t);return c`${this.label?c`<span class="nbplay-segmented-label">${this.label}</span>`:""}
      <div
        class="nbplay-segmented-group"
        role="radiogroup"
        aria-label=${this.label}
      >
        ${e.map(t=>c`<button
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
      </div>`}select(e){this.disabled||e===this.value||(this.value=e,this.emit("change",e))}};v("nbplay-segmented",tt);var it=class extends f{static properties={title:{type:String},badge:{type:String},status:{type:String}};actions=null;constructor(){super(),this.title="nbplay",this.badge="",this.status=""}connectedCallback(){this.actions===null&&(this.actions=Array.from(this.childNodes)),super.connectedCallback()}render(){let e=this.actions??[];return c`<h3 class="nbplay-header-title">${this.title}</h3>
      ${this.badge?c`<span class="nbplay-header-badge">${this.badge}</span>`:x}
      ${this.status?c`<span class="nbplay-header-status">${this.status}</span>`:x}
      <div class="nbplay-header-actions">${e}</div>`}};v("nbplay-header",it);function ls(){let r=navigator.userAgentData?.platform??navigator.platform;return/mac|iphone|ipad|ipod/i.test(r)?"\u2318 K":"Ctrl K"}var nt=class extends f{static properties={commands:{attribute:!1},placeholder:{type:String},query:{state:!0},active:{state:!0}};constructor(){super(),this.commands=[],this.placeholder="",this.query="",this.active=0}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onShortcut)}disconnectedCallback(){window.removeEventListener("keydown",this.onShortcut),super.disconnectedCallback()}show(){let e=this.dialog;!e||e.open||(this.query="",this.active=0,e.showModal())}get dialog(){return this.querySelector("dialog")}filtered(){let e=this.query.trim().toLowerCase();return this.commands.filter(t=>(t.label??t.id).toLowerCase().includes(e))}onShortcut=e=>{!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||e.key.toLowerCase()==="k"&&(e.preventDefault(),this.dialog?.open?this.dialog.close():this.show())};onKey(e){let t=this.filtered();if(e.key==="ArrowDown"||e.key==="ArrowUp"){if(e.preventDefault(),!t.length)return;let i=e.key==="ArrowDown"?1:-1;this.active=(this.active+i+t.length)%t.length}else e.key==="Enter"&&(e.preventDefault(),t[this.active]&&this.pick(t[this.active].id))}pick(e){this.dialog?.close(),this.emitDetail("nbplay-request",{name:e})}updated(){this.querySelector(".nbplay-palette-option.active")?.scrollIntoView({block:"nearest"})}render(){let e=this.filtered();return c`<dialog
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
        ${e.map((t,i)=>c`<li
              class="nbplay-palette-option ${i===this.active?"active":""}"
              role="option"
              aria-selected=${String(i===this.active)}
              data-id=${t.id}
              @pointermove=${()=>{this.active=i}}
              @click=${()=>this.pick(t.id)}
            >
              ${t.label??t.id}
            </li>`)}
        ${e.length?"":c`<li class="nbplay-palette-empty">No match</li>`}
      </ul>
    </dialog>`}};v("nbplay-palette",nt);var st=class extends f{static properties={label:{type:String}};constructor(){super(),this.label=""}render(){return c`<button
      type="button"
      class="nbplay-palette-hint-button"
      aria-label="Open the command palette"
    >
      ${this.label}
      <kbd class="nbplay-palette-hint-keys">${ls()}</kbd>
    </button>`}};v("nbplay-palette-hint",st);var rt=class extends f{static properties={url:{type:String},label:{type:String},accept:{type:String},error:{state:!0}};constructor(){super(),this.url="",this.label="",this.accept="",this.error=""}async onPick(e){let t=e.target,i=t.files?.[0];if(t.value="",!!i){this.error="";try{let n=await fetch(this.url,{method:"PUT",body:i});if(n.ok){location.reload();return}let s=await n.json().catch(()=>({}));this.error=s.error??`Upload failed (${n.status})`}catch(n){this.error=String(n)}}}render(){return c`<label class="nbplay-upload-button">
        ${this.label}
        <input
          class="nbplay-upload-input"
          type="file"
          accept=${this.accept}
          @change=${this.onPick}
        />
      </label>
      ${this.error?c`<span class="nbplay-upload-error" role="alert"
              >${this.error}</span
            >`:x}`}};v("nbplay-upload",rt);var at=class extends f{static properties={label:{type:String},value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},scale:{type:String},kind:{type:String},control:{type:String,reflect:!0},precision:{type:Number},unit:{type:String},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.label="",this.value=0,this.min=0,this.max=1,this.step=.01,this.defaultValue=null,this.scale="linear",this.kind="float",this.control="slider",this.precision=2,this.unit="",this.editable=!0,this.disabled=!1}render(){let e=this.control==="dial"?c`<nbplay-dial
            .value=${this.value}
            .min=${this.min}
            .max=${this.max}
            .step=${this.step}
            .defaultValue=${this.defaultValue}
            .disabled=${this.disabled}
            @input=${this.onInput}
            @change=${this.onChange}
          ></nbplay-dial>`:c`<nbplay-slider
            .value=${this.value}
            .min=${this.min}
            .max=${this.max}
            .step=${this.step}
            .defaultValue=${this.defaultValue}
            .scale=${this.scale}
            .disabled=${this.disabled}
            @input=${this.onInput}
            @change=${this.onChange}
          ></nbplay-slider>`;return c`<span class="nbplay-param-label">${this.label}</span>
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
      ></nbplay-value>`}onInput(e){e.stopPropagation(),this.value=e.detail.value,this.emit("input",this.value)}onChange(e){e.stopPropagation(),this.value=e.detail.value,this.emit("change",this.value)}};v("nbplay-param",at);var ot=class extends f{static properties={playing:{type:Boolean,reflect:!0},recording:{type:Boolean,reflect:!0},showRecord:{type:Boolean,attribute:"show-record"},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.playing=!1,this.recording=!1,this.showRecord=!0,this.disabled=!1}render(){return c`<button
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
      ${this.showRecord?c`<nbplay-toggle
              class="nbplay-transport-record"
              variant="record"
              label="●"
              title="Record"
              .active=${this.recording}
              .disabled=${this.disabled}
              @change=${e=>this.forward(e,"nbplay-record")}
            ></nbplay-toggle>`:x}`}forward(e,t){e.stopPropagation(),this.emitDetail(t,{value:e.detail.value})}};v("nbplay-transport-buttons",ot);var lt=class extends f{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},level:{type:Number},rms:{type:Number},label:{type:String},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.value=.8,this.min=0,this.max=2,this.step=.01,this.defaultValue=1,this.level=0,this.rms=0,this.label="",this.editable=!0,this.disabled=!1}render(){return c`${this.label?c`<span class="nbplay-fader-label">${this.label}</span>`:x}
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
      ></nbplay-value>`}onInput(e){e.stopPropagation(),this.value=e.detail.value,this.emit("input",this.value)}onChange(e){e.stopPropagation(),this.value=e.detail.value,this.emit("change",this.value)}};v("nbplay-fader",lt);var di=[{key:"2",semitone:1,black:!0},{key:"3",semitone:3,black:!0},{key:"",semitone:-1,black:!1},{key:"5",semitone:6,black:!0},{key:"6",semitone:8,black:!0},{key:"7",semitone:10,black:!0},{key:"",semitone:-1,black:!1},{key:"9",semitone:13,black:!0},{key:"0",semitone:15,black:!0}],pi=[{key:"Q",semitone:0,black:!1},{key:"W",semitone:2,black:!1},{key:"E",semitone:4,black:!1},{key:"R",semitone:5,black:!1},{key:"T",semitone:7,black:!1},{key:"Y",semitone:9,black:!1},{key:"U",semitone:11,black:!1},{key:"I",semitone:12,black:!1},{key:"O",semitone:14,black:!1},{key:"P",semitone:16,black:!1}],hi=[{key:"A",semitone:1,black:!0},{key:"S",semitone:3,black:!0},{key:"",semitone:-1,black:!1},{key:"F",semitone:6,black:!0},{key:"G",semitone:8,black:!0},{key:"H",semitone:10,black:!0},{key:"",semitone:-1,black:!1},{key:"K",semitone:13,black:!0},{key:"L",semitone:15,black:!0}],mi=[{key:"Z",semitone:0,black:!1},{key:"X",semitone:2,black:!1},{key:"C",semitone:4,black:!1},{key:"V",semitone:5,black:!1},{key:"B",semitone:7,black:!1},{key:"N",semitone:9,black:!1},{key:"M",semitone:11,black:!1},{key:",",semitone:12,black:!1},{key:".",semitone:14,black:!1}],pn={};for(let[r,e]of[[[di,pi],"upper"],[[hi,mi],"lower"]])for(let t of r)for(let i of t)i.key&&(pn[i.key.toLowerCase()]={semitone:i.semitone,zone:e});function bi(r,e,t){let i=pn[r.toLowerCase()];return i?{note:((i.zone==="upper"?e:t)+1)*12+i.semitone,zone:i.zone}:null}var cs={1:0,3:1,6:3,8:4,10:5},us=[0,2,4,5,7,9,11],ct=class extends f{static properties={layout:{type:String,reflect:!0},upperOctave:{type:Number,attribute:"upper-octave"},lowerOctave:{type:Number,attribute:"lower-octave"},startOctave:{type:Number,attribute:"start-octave"},octaves:{type:Number},velocity:{type:Number},pressed:{attribute:!1},disabled:{type:Boolean,reflect:!0}};held=new Map;heldNotes=new Set;constructor(){super(),this.layout="rows",this.upperOctave=3,this.lowerOctave=4,this.startOctave=3,this.octaves=2,this.velocity=100,this.pressed=[],this.disabled=!1}isPressed(e){return this.heldNotes.has(e)||this.pressed.includes(e)}render(){return this.layout==="piano"?this.renderPiano():this.renderRows()}renderRows(){let e=(t,i,n,s)=>{let a=t==="upper"?this.upperOctave:this.lowerOctave;return c`<div class="nbplay-keys-zone" data-zone=${t}>
        <div class="nbplay-keys-zone-label">${i}</div>
        <div class="nbplay-keys-row nbplay-keys-row-sharp">
          ${n.map(o=>this.renderKey(o,a,t))}
        </div>
        <div class="nbplay-keys-row nbplay-keys-row-natural">
          ${s.map(o=>this.renderKey(o,a,t))}
        </div>
      </div>`};return c`${e("upper","UPPER",di,pi)}
    ${e("lower","LOWER",hi,mi)}`}renderKey(e,t,i){if(!e.key)return c`<div class="nbplay-keys-gap"></div>`;let n=(t+1)*12+e.semitone;return c`<div
      class="nbplay-keys-key ${e.black?"nbplay-keys-black":"nbplay-keys-white"} ${this.isPressed(n)?"pressed":""}"
      data-key=${e.key.toLowerCase()}
      data-note=${n}
      @pointerdown=${s=>this.down(s,n,i)}
      @pointerup=${this.up}
      @pointercancel=${this.up}
      @lostpointercapture=${this.up}
    >
      <span class="nbplay-keys-key-label">${e.key}</span>
      <span class="nbplay-keys-key-note">${P(n)}</span>
    </div>`}renderPiano(){let e=[],t=[];for(let s=0;s<this.octaves;s++){let a=(this.startOctave+s+1)*12;for(let o of us)e.push({note:a+o});for(let[o,l]of Object.entries(cs))t.push({note:a+Number(o),index:s*7+l})}let i=s=>s<60?"lower":"upper",n=(s,a,o)=>c`<div
        class="nbplay-keys-key ${a?"nbplay-keys-black":"nbplay-keys-white"} ${this.isPressed(s)?"pressed":""}"
        data-note=${s}
        style=${a?`--nbplay-key-index: ${o}`:x}
        @pointerdown=${l=>this.down(l,s,i(s))}
        @pointerup=${this.up}
        @pointercancel=${this.up}
        @lostpointercapture=${this.up}
      >
        ${s%12===0?c`<span class="nbplay-keys-key-note">${P(s)}</span>`:x}
      </div>`;return c`<div
      class="nbplay-keys-piano"
      style="--nbplay-key-count: ${e.length}"
    >
      ${e.map(s=>n(s.note,!1))}
      ${t.map(s=>n(s.note,!0,s.index))}
    </div>`}down(e,t,i){if(this.disabled||e.button!==0)return;e.preventDefault();let n=e.currentTarget;try{n.setPointerCapture(e.pointerId)}catch{}this.held.has(e.pointerId)&&this.release(e.pointerId),this.held.set(e.pointerId,{note:t,zone:i}),this.heldNotes.add(t),this.requestUpdate(),this.emitDetail("nbplay-note-on",{note:t,velocity:this.velocity,zone:i})}up=e=>{this.release(e.pointerId)};release(e){let t=this.held.get(e);t&&(this.held.delete(e),this.heldNotes.delete(t.note),this.requestUpdate(),this.emitDetail("nbplay-note-off",{note:t.note,zone:t.zone}))}releaseAll(){for(let e of this.held.keys())this.release(e)}};v("nbplay-key-rows",ct);var ds=5,ps=300,ut=class extends f{static properties={rows:{type:Number},cols:{type:Number},pads:{attribute:!1},active:{attribute:!1},velocitySensitive:{type:Boolean,attribute:"velocity-sensitive"},hold:{type:Boolean},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};held=new Set;pendingTap;press;constructor(){super(),this.rows=4,this.cols=4,this.pads=[],this.active=[],this.velocitySensitive=!0,this.hold=!1,this.editable=!0,this.disabled=!1}pad(e){return this.pads[e]??{note:60+e,velocity:100}}render(){let e=this.rows*this.cols;return c`<div
      class="nbplay-pad-grid-cells"
      style="grid-template-columns: repeat(${this.cols}, 1fr); grid-template-rows: repeat(${this.rows}, 1fr)"
    >
      ${Array.from({length:e},(t,i)=>this.renderCell(i))}
    </div>`}renderCell(e){let t=this.pad(e),i=this.held.has(e)||this.active.includes(e),n=`Pad ${e+1}: ${t.label??P(t.note)}  vel=${t.velocity}`;return c`<div
      class="nbplay-pad-cell ${i?"active":""}"
      data-index=${e}
      title=${n}
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
      ${t.label!==void 0?c`<span class="nbplay-pad-label">${t.label}</span>`:c`<nbplay-value
              class="nbplay-pad-label"
              kind="note"
              .value=${t.note}
              .min=${0}
              .max=${127}
              .editable=${this.editable}
              @dblclick=${()=>clearTimeout(this.pendingTap)}
              @change=${s=>this.onLabelChange(s,e)}
            ></nbplay-value>`}
    </div>`}tapVelocity(e,t,i){let n=this.pad(i).velocity;if(!this.velocitySensitive)return n;let s=t.getBoundingClientRect(),a=w((e.clientY-s.top)/s.height,0,1);return B(Math.round(20+a*(n-20)))}noteOn(e,t){this.held.add(e),this.requestUpdate(),this.emitDetail("nbplay-note-on",{index:e,note:this.pad(e).note,velocity:t})}noteOff(e){this.held.delete(e)&&(this.requestUpdate(),this.emitDetail("nbplay-note-off",{index:e,note:this.pad(e).note}))}onPointerDown(e,t){if(this.disabled||e.button!==0)return;let i=e.currentTarget,n=e.target.closest("nbplay-value")!==null;if(!n){e.preventDefault();try{i.setPointerCapture(e.pointerId)}catch{}}this.press={index:t,pointerId:e.pointerId,startY:e.clientY,onLabel:n,dragging:!1,cell:i},this.hold&&!n&&this.noteOn(t,this.tapVelocity(e,i,t))}onPointerMove=e=>{let t=this.press;if(!t||t.pointerId!==e.pointerId||!this.editable||this.hold||!t.dragging&&Math.abs(e.clientY-t.startY)<ds)return;t.dragging=!0;let i=t.cell.getBoundingClientRect(),n=B(Math.round((1-(e.clientY-i.top)/i.height)*127));this.setPad(t.index,"velocity",n,"input")};onPointerUp=e=>{let t=this.press;if(!t||t.pointerId!==e.pointerId)return;if(this.press=void 0,this.hold){this.noteOff(t.index);return}if(t.dragging){this.emitDetail("change",{index:t.index,field:"velocity",value:this.pad(t.index).velocity});return}let i=this.tapVelocity(e,t.cell,t.index),n=()=>{this.noteOn(t.index,i),requestAnimationFrame(()=>this.noteOff(t.index))};if(!t.onLabel){n();return}let s=t.cell.querySelector("nbplay-value");clearTimeout(this.pendingTap),this.pendingTap=setTimeout(()=>{this.pendingTap=void 0,s?.editing||n()},ps)};onPointerCancel=e=>{let t=this.press;!t||t.pointerId!==e.pointerId||(this.press=void 0,this.hold?this.noteOff(t.index):t.dragging&&this.emitDetail("change",{index:t.index,field:"velocity",value:this.pad(t.index).velocity}))};onWheel(e,t){if(!this.editable||this.disabled)return;e.preventDefault();let i=e.deltaY!==0?e.deltaY:e.deltaX;if(i===0)return;let n=this.pad(t);e.shiftKey?this.setPad(t,"velocity",B(n.velocity+(i<0?5:-5)),"change"):this.setPad(t,"note",K(n.note+(i<0?1:-1)),"change")}onLabelChange(e,t){e.stopPropagation();let i=e.detail?.value;this.setPad(t,"note",K(i),"change")}setPad(e,t,i,n){let s=this.pad(e);if(s[t]===i)return;let a=this.pads.slice();a[e]={...s,[t]:i},this.pads=a,this.emitDetail(n,{index:e,field:t,value:i})}};v("nbplay-pad-grid",ut);var dt=class extends f{static properties={voices:{attribute:!1},currentStep:{type:Number,attribute:"current-step"},cursor:{attribute:!1},pending:{attribute:!1},armed:{attribute:!1},showArm:{type:Boolean,attribute:"show-arm"},disabled:{type:Boolean,reflect:!0},editing:{state:!0}};constructor(){super(),this.voices=[],this.currentStep=-1,this.cursor=null,this.pending=null,this.armed=[],this.showArm=!1,this.disabled=!1,this.editing=null}updated(e){if(!e.has("editing")||!this.editing)return;let t=this.querySelector(".nbplay-step-grid-edit"),i=this.step(this.editing.voice,this.editing.step);!t||!i||(t.value=P(i.note),t.focus(),t.select())}get length(){return this.voices[0]?.length??0}render(){let e=this.length,t=Array.from({length:e},(i,n)=>n);return c`<div class="nbplay-step-grid-rows">
      <div class="nbplay-step-grid-row nbplay-step-grid-header">
        <div class="nbplay-step-grid-label">#</div>
        ${t.map(i=>c`<div
              class="nbplay-step-grid-head ${i===this.currentStep?"active-col":""}"
            >
              ${i+1}
            </div>`)}
      </div>
      ${this.voices.map((i,n)=>this.renderVoice(i,n,t))}
    </div>`}renderVoice(e,t,i){let n=this.armed.includes(t);return c`<div
        class="nbplay-step-grid-row nbplay-step-grid-steps"
        data-voice=${t}
      >
        <div class="nbplay-step-grid-label">
          <span>${t+1}</span>
          ${this.showArm?c`<nbplay-toggle
                  class="nbplay-step-grid-arm"
                  variant="arm"
                  label="⏺"
                  title="Arm voice ${t+1} for recording"
                  .active=${n}
                  @change=${s=>this.onArm(s,t)}
                ></nbplay-toggle>`:x}
        </div>
        ${i.map(s=>this.renderCell(e[s],t,s))}
      </div>
      <div
        class="nbplay-step-grid-row nbplay-step-grid-velocities"
        data-voice=${t}
      >
        <div class="nbplay-step-grid-label">
          ${this.voices.length>1?`VEL${t+1}`:"VEL"}
        </div>
        ${i.map(s=>c`<nbplay-bar
              class="nbplay-step-grid-vel ${e[s]?.active?"active":""} ${s===this.currentStep?"current":""}"
              editable="wheel"
              wheel-step="5"
              .value=${e[s]?.velocity??0}
              .min=${0}
              .max=${127}
              @input=${a=>a.stopPropagation()}
              @change=${a=>this.onVelocity(a,t,s)}
            ></nbplay-bar>`)}
      </div>`}renderCell(e,t,i){let n=e??{active:!1,note:60,velocity:100},s=this.pending?.voice===t&&this.pending?.step===i,a=this.cursor?.voice===t&&this.cursor?.step===i,o=["nbplay-step-grid-cell",n.active?"active":"",i===this.currentStep?"current":"",a?"cursor":"",s?"pending":""].join(" "),l=n.probability??1;return c`<div
      class=${o}
      data-voice=${t}
      data-step=${i}
      title="Voice ${t+1} Step ${i+1}: ${P(n.note)} vel=${n.velocity} prob=${Math.round(l*100)}%"
      @click=${()=>this.toggle(t,i)}
      @dblclick=${()=>this.pick(t,i)}
      @wheel=${u=>this.onWheel(u,t,i)}
    >
      ${this.editing?.voice===t&&this.editing?.step===i?this.renderEditor(t,i):s?"\u266A?":P(n.note)}
    </div>`}renderEditor(e,t){let i=n=>n.stopPropagation();return c`<input
      class="nbplay-step-grid-edit"
      type="text"
      aria-label="Note for voice ${e+1} step ${t+1}"
      autocomplete="off"
      spellcheck="false"
      @click=${i}
      @dblclick=${i}
      @wheel=${i}
      @input=${i}
      @change=${i}
      @keydown=${n=>{n.key==="Enter"?this.commitEdit(n.target):n.key==="Escape"&&(this.editing=null)}}
      @blur=${n=>this.commitEdit(n.target)}
    />`}commitEdit(e){let t=this.editing;if(!t)return;this.editing=null;let i=ze(e.value);i!==null&&(this.set(t.voice,t.step,"note",i),this.set(t.voice,t.step,"active",!0))}step(e,t){return this.voices[e]?.[t]}set(e,t,i,n){let s=this.step(e,t);if(!s||s[i]===n)return;let a=this.voices.slice(),o=a[e].slice();o[t]={...s,[i]:n},a[e]=o,this.voices=a,this.emitDetail("change",{voice:e,step:t,field:i,value:n})}toggle(e,t){if(this.disabled)return;let i=this.step(e,t);i&&this.set(e,t,"active",!i.active)}pick(e,t){this.disabled||(this.showArm?this.emitDetail("nbplay-step-pick",{voice:e,step:t}):this.editing={voice:e,step:t})}onWheel(e,t,i){if(this.disabled)return;e.preventDefault();let n=e.deltaY!==0?e.deltaY:e.deltaX,s=this.step(t,i);n===0||!s||this.set(t,i,"note",K(s.note+(n<0?1:-1)))}onVelocity(e,t,i){e.stopPropagation(),this.set(t,i,"velocity",e.detail?.value)}onArm(e,t){e.stopPropagation();let i=e.detail?.value;this.armed=i?[...this.armed,t]:this.armed.filter(n=>n!==t),this.emitDetail("nbplay-arm",{voice:t,armed:i})}};v("nbplay-step-grid",dt);var G=["gain","filter","compressor","limiter","delay","reverb"],hs=["lowpass","highpass","bandpass","notch","lowshelf","highshelf","peaking"],hn={gain:[{key:"gain",label:"Gain",min:0,max:4,step:.01,default:1,kind:"number"}],filter:[{key:"filter_type",label:"Type",options:hs,kind:"select"},{key:"frequency",label:"Hz",min:20,max:2e4,step:1,default:1200,kind:"number"},{key:"q",label:"Q",min:1e-4,max:100,step:.01,default:1,kind:"number"}],delay:[{key:"time",label:"Time",min:0,max:5,step:.001,default:.25,kind:"number"},{key:"feedback",label:"Fdbk",min:0,max:.95,step:.01,default:.25,kind:"number"},{key:"wet",label:"Wet",min:0,max:1,step:.01,default:.35,kind:"number"}],reverb:[{key:"seconds",label:"Size",min:.01,max:10,step:.01,default:1.5,kind:"number"},{key:"decay",label:"Decay",min:.01,max:12,step:.01,default:2,kind:"number"},{key:"wet",label:"Wet",min:0,max:1,step:.01,default:.25,kind:"number"}],compressor:[{key:"threshold",label:"Thresh",min:-100,max:0,step:.5,default:-24,kind:"number"},{key:"knee",label:"Knee",min:0,max:40,step:.5,default:30,kind:"number"},{key:"ratio",label:"Ratio",min:1,max:20,step:.1,default:12,kind:"number"},{key:"attack",label:"Attack",min:0,max:1,step:.001,default:.003,kind:"number"},{key:"release",label:"Release",min:0,max:1,step:.001,default:.25,kind:"number"}],limiter:[{key:"threshold",label:"Thresh",min:-100,max:0,step:.5,default:-1,kind:"number"},{key:"release",label:"Release",min:0,max:1,step:.001,default:.05,kind:"number"}]};function pt(r){let e=hn[r.type];return e||Object.entries(r).filter(([t])=>t!=="type"&&t!=="enabled").map(([t,i])=>typeof i=="number"?{key:t,label:t,kind:"number"}:typeof i=="boolean"?{key:t,label:t,kind:"bool"}:typeof i=="string"?{key:t,label:t,kind:"text"}:null).filter(t=>t!==null)}function fi(r){return r.enabled!==!1}function vi(r){return r.type==="filter"?`${r.filter_type||"filter"} ${Math.round(Number(r.frequency)||0)}Hz`:r.type}var ht=class extends f{static properties={effect:{attribute:!1},specs:{attribute:!1},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.effect={type:"gain"},this.specs=null,this.disabled=!1}render(){let e=this.specs??pt(this.effect);return e.length?c`${e.map(t=>this.renderRow(t))}`:c`<span class="nbplay-effect-editor-none">No parameters</span>`}renderRow(e){let t=this.effect[e.key],i=s=>s.stopPropagation();if(e.kind==="select")return c`<label class="nbplay-effect-editor-row">
        <span>${e.label}</span>
        <select
          data-key=${e.key}
          ?disabled=${this.disabled}
          @input=${i}
          @change=${s=>{s.stopPropagation(),this.commit(e.key,s.target.value)}}
        >
          ${(e.options??[]).map(s=>c`<option value=${s} ?selected=${s===t}>
                ${s}
              </option>`)}
        </select>
      </label>`;if(e.kind==="bool")return c`<label class="nbplay-effect-editor-row">
        <span>${e.label}</span>
        <input
          type="checkbox"
          data-key=${e.key}
          .checked=${!!t}
          ?disabled=${this.disabled}
          @input=${i}
          @change=${s=>{s.stopPropagation(),this.commit(e.key,s.target.checked)}}
        />
      </label>`;if(e.kind==="text")return c`<label class="nbplay-effect-editor-row">
        <span>${e.label}</span>
        <input
          type="text"
          data-key=${e.key}
          .value=${String(t??"")}
          ?disabled=${this.disabled}
          @input=${i}
          @change=${s=>{s.stopPropagation(),this.commit(e.key,s.target.value)}}
        />
      </label>`;let n=Number(t);return e.min!==void 0&&e.max!==void 0?c`<nbplay-param
        class="nbplay-effect-editor-param"
        control="dial"
        data-key=${e.key}
        .label=${e.label}
        .value=${Number.isFinite(n)?n:e.min}
        .min=${e.min}
        .max=${e.max}
        .step=${e.step??.01}
        .defaultValue=${e.default??null}
        .precision=${ms(e.step??.01)}
        .disabled=${this.disabled}
        @input=${i}
        @change=${s=>{s.stopPropagation(),this.commit(e.key,s.detail.value)}}
      ></nbplay-param>`:c`<label class="nbplay-effect-editor-row">
      <span>${e.label}</span>
      <input
        type="number"
        step="any"
        data-key=${e.key}
        .value=${String(Number.isFinite(n)?n:0)}
        ?disabled=${this.disabled}
        @input=${i}
        @change=${s=>{s.stopPropagation();let a=parseFloat(s.target.value);Number.isFinite(a)&&this.commit(e.key,a)}}
      />
    </label>`}commit(e,t){let i=(this.specs??pt(this.effect)).find(n=>n.key===e);i?.kind==="number"&&typeof t=="number"&&(t=w(t,i.min??-1/0,i.max??1/0)),this.effect={...this.effect,[e]:t},this.emitDetail("change",{key:e,value:t})}};function ms(r){return Math.max(0,Math.ceil(-Math.log10(r)))}v("nbplay-effect-editor",ht);var mt=class extends f{static properties={effects:{attribute:!1},types:{attribute:!1},editing:{type:Number},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.effects=[],this.types=G,this.editing=-1,this.disabled=!1}render(){let e=t=>t.stopPropagation();return c`<div class="nbplay-effect-rack-add">
        <select
          class="nbplay-effect-rack-type"
          title="Effect type"
          ?disabled=${this.disabled}
          @input=${e}
          @change=${e}
        >
          ${this.types.map(t=>c`<option value=${t}>${t}</option>`)}
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
        ${this.effects.map((t,i)=>this.renderItem(t,i))}
      </div>`}renderItem(e,t){let i=fi(e),n=this.editing===t;return c`<div class="nbplay-effect-rack-item" data-index=${t}>
      <div class="nbplay-effect-rack-chip-row">
        <button
          type="button"
          class="nbplay-effect-rack-chip ${i?"":"bypassed"}"
          title=${i?"Bypass effect":"Enable effect"}
          ?disabled=${this.disabled}
          @click=${()=>this.emitDetail("change",{index:t,field:"enabled",value:!i})}
        >
          ${vi(e)}
        </button>
        <button
          type="button"
          class="nbplay-effect-rack-edit ${n?"active":""}"
          title="Edit effect"
          ?disabled=${this.disabled}
          @click=${()=>{this.editing=n?-1:t,this.emitDetail("nbplay-effect-editing",{index:this.editing})}}
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
      ${n?c`<nbplay-effect-editor
              .effect=${e}
              .disabled=${this.disabled}
              @input=${s=>s.stopPropagation()}
              @change=${s=>{s.stopPropagation();let{key:a,value:o}=s.detail;this.emitDetail("change",{index:t,field:a,value:o})}}
            ></nbplay-effect-editor>`:x}
    </div>`}add(){let t=this.querySelector(".nbplay-effect-rack-type")?.value||this.types[0];t&&this.emitDetail("nbplay-effect-add",{type:t})}};v("nbplay-effect-rack",mt);var bt=class extends f{static properties={kind:{type:String,reflect:!0},name:{type:String},gain:{type:Number},pan:{type:Number},mute:{type:Boolean},solo:{type:Boolean},sends:{attribute:!1},sendNames:{attribute:!1},effects:{attribute:!1},effectTypes:{attribute:!1},level:{type:Number},rms:{type:Number},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.kind="channel",this.name="",this.gain=.8,this.pan=0,this.mute=!1,this.solo=!1,this.sends=[],this.sendNames=[],this.effects=[],this.effectTypes=G,this.level=0,this.rms=0,this.editable=!0,this.disabled=!1}render(){let e=this.kind==="channel",t=i=>i.stopPropagation();return c`<div class="nbplay-strip-name" title=${this.name}>
        ${this.name}
      </div>
      <nbplay-fader
        .value=${this.gain}
        .level=${this.level}
        .rms=${this.rms}
        .editable=${this.editable}
        .disabled=${this.disabled}
        @input=${i=>this.forward(i,"input","gain")}
        @change=${i=>this.forward(i,"change","gain")}
      ></nbplay-fader>
      ${e?c`<div class="nbplay-strip-pan">
                <nbplay-value
                  kind="pan"
                  .value=${this.pan}
                  .min=${-1}
                  .max=${1}
                  .editable=${this.editable&&!this.disabled}
                  @input=${t}
                  @change=${i=>this.forward(i,"change","pan")}
                ></nbplay-value>
                <nbplay-slider
                  .value=${this.pan}
                  .min=${-1}
                  .max=${1}
                  .step=${.01}
                  .defaultValue=${0}
                  .disabled=${this.disabled}
                  @input=${i=>this.forward(i,"input","pan")}
                  @change=${i=>this.forward(i,"change","pan")}
                ></nbplay-slider>
              </div>
              <div class="nbplay-strip-buttons">
                <nbplay-toggle
                  variant="mute"
                  label="M"
                  title="Mute"
                  .active=${this.mute}
                  .disabled=${this.disabled}
                  @change=${i=>this.forward(i,"change","mute")}
                ></nbplay-toggle>
                <nbplay-toggle
                  variant="solo"
                  label="S"
                  title="Solo"
                  .active=${this.solo}
                  .disabled=${this.disabled}
                  @change=${i=>this.forward(i,"change","solo")}
                ></nbplay-toggle>
              </div>
              ${this.sendNames.length?c`<div class="nbplay-strip-sends">
                      ${this.sendNames.map((i,n)=>c`<label
                            class="nbplay-strip-send"
                            title="Send to ${i}"
                          >
                            <span>${i}</span>
                            <nbplay-slider
                              .value=${this.sends[n]??0}
                              .min=${0}
                              .max=${1}
                              .step=${.01}
                              .defaultValue=${0}
                              .disabled=${this.disabled}
                              @input=${s=>this.forwardSend(s,"input",n)}
                              @change=${s=>this.forwardSend(s,"change",n)}
                            ></nbplay-slider>
                          </label>`)}
                    </div>`:x}`:x}
      <nbplay-effect-rack
        .effects=${this.effects}
        .types=${this.effectTypes}
        .disabled=${this.disabled}
        @input=${t}
        @change=${i=>{i.stopPropagation();let{index:n,field:s,value:a}=i.detail;this.emitDetail("change",{field:"effect",index:n,key:s,value:a})}}
        @nbplay-effect-editing=${i=>{this.classList.toggle("editing",i.detail.index>=0)}}
      ></nbplay-effect-rack>
      ${this.kind==="master"?x:c`<button
              type="button"
              class="nbplay-strip-remove"
              title=${e?"Remove channel":"Remove return bus"}
              ?disabled=${this.disabled}
              @click=${()=>this.emitDetail("nbplay-remove",{})}
            >
              ×
            </button>`}`}forward(e,t,i){e.stopPropagation();let n=e.detail.value;this[i]=n,this.emitDetail(t,{field:i,value:n})}forwardSend(e,t,i){e.stopPropagation();let n=e.detail.value,s=[...this.sends];s[i]=n,this.sends=s,this.emitDetail(t,{field:"send",index:i,value:n})}};v("nbplay-strip",bt);var ft=class extends f{static properties={ports:{attribute:!1},value:{type:String},status:{type:String,reflect:!0},label:{type:String},emptyText:{type:String,attribute:"empty-text"},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.ports=[],this.value="",this.status="idle",this.label="",this.emptyText="Not connected",this.disabled=!1}render(){let e=i=>i.stopPropagation(),t={idle:"Idle",connected:"Connected",unsupported:"Web MIDI unavailable",error:"Error"}[this.status];return c`${this.label?c`<span class="nbplay-midi-port-label">${this.label}</span>`:""}
      <select
        class="nbplay-midi-port-select"
        title="MIDI port"
        ?disabled=${this.disabled||this.status==="unsupported"}
        @input=${e}
        @change=${i=>{i.stopPropagation(),this.value=i.target.value,this.emit("change",this.value)}}
      >
        <option value="" ?selected=${!this.value}>${this.emptyText}</option>
        ${this.ports.map(i=>c`<option
              value=${i.id}
              ?selected=${i.id===this.value}
              .textContent=${i.name}
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
      <span class="nbplay-midi-port-status">${t}</span>`}updated(){let e=this.querySelector(".nbplay-midi-port-select");e&&e.value!==this.value&&(e.value=this.value)}};v("nbplay-midi-port",ft);function yt(r){if(!r||r.length===0)return"";let e=r[0],t=e&240,i=(e&15)+1;if(t===144&&r.length>=3)return`NoteOn  ch=${i} note=${r[1]} vel=${r[2]}`;if(t===128&&r.length>=3)return`NoteOff ch=${i} note=${r[1]} vel=${r[2]}`;if(t===176&&r.length>=3)return`CC      ch=${i} ctrl=${r[1]} val=${r[2]}`;if(t===192&&r.length>=2)return`PgmChg  ch=${i} pgm=${r[1]}`;if(t===224&&r.length>=3){let n=r[1]|r[2]<<7;return`Bend    ch=${i} val=${n}`}return e===248?"Clock":e===250?"Start":e===252?"Stop":e===251?"Continue":`Raw [${Array.from(r).map(n=>n.toString(16).padStart(2,"0")).join(" ")}]`}var vt=class extends f{static properties={entries:{attribute:!1},max:{type:Number},label:{type:String},emptyText:{type:String,attribute:"empty-text"}};constructor(){super(),this.entries=[],this.max=8,this.label="",this.emptyText=""}push(e){this.entries=[e,...this.entries].slice(0,this.max)}render(){let e=this.entries.slice(0,this.max);return c`${this.label?c`<div class="nbplay-midi-log-label">${this.label}</div>`:""}
      <div class="nbplay-midi-log-entries">
        ${e.length?e.map(t=>c`<div
                    class="nbplay-midi-log-entry"
                    .textContent=${typeof t=="string"?t:yt(t)}
                  ></div>`):c`<div class="nbplay-midi-log-empty">${this.emptyText}</div>`}
      </div>`}};v("nbplay-midi-log",vt);var gt=class extends f{static properties={name:{type:String},active:{type:Boolean,reflect:!0},queued:{type:Boolean,reflect:!0},selected:{type:Boolean,reflect:!0},progress:{type:Number},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.name="",this.active=!1,this.queued=!1,this.selected=!1,this.progress=0,this.disabled=!1}render(){let e=this.name!=="";return c`<button
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
        ${e?this.name:c`<span class="nbplay-launcher-slot-empty-mark">■</span>`}
      </span>
      ${this.queued?c`<span class="nbplay-launcher-slot-next"
              >${e?"next":"stop"}</span
            >`:x}
    </button>`}};v("nbplay-launcher-slot",gt);var Pe=-2,kt=class extends f{static properties={tracks:{attribute:!1},scenes:{attribute:!1},slots:{attribute:!1},active:{attribute:!1},queued:{attribute:!1},progress:{attribute:!1},selected:{attribute:!1},playing:{type:Boolean,reflect:!0},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.tracks=[],this.scenes=[],this.slots=[],this.active=[],this.queued=[],this.progress=[],this.selected=null,this.playing=!1,this.disabled=!1}sceneState(e){let t=this.tracks.filter((n,s)=>this.slots.some(a=>a.track===s&&a.scene===e)).length,i=this.tracks.filter((n,s)=>this.active[s]===e).length;return{active:t>0&&i===t,partial:i>0&&i<t,queued:this.tracks.some((n,s)=>this.queued[s]===e)}}render(){return c`<div
        class="nbplay-launcher-grid-row nbplay-launcher-grid-scenes"
      >
        <div class="nbplay-launcher-grid-corner">
          ${this.playing?"\u25B6":"\u25A0"}
        </div>
        ${this.scenes.map((e,t)=>{let i=this.sceneState(t);return c`<button
            type="button"
            class="nbplay-launcher-grid-scene ${i.active?"active":""} ${i.partial?"partial":""} ${i.queued?"queued":""}"
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
      ${this.tracks.length?this.tracks.map((e,t)=>this.renderTrack(e,t)):c`<div class="nbplay-launcher-grid-empty">No tracks</div>`}`}renderTrack(e,t){let i=this.queued[t]??-1;return c`<div class="nbplay-launcher-grid-row" data-track=${t}>
      <div class="nbplay-launcher-grid-track">
        <span class="nbplay-launcher-grid-track-name">${e.name}</span>
        ${e.detail?c`<small>${e.detail}</small>`:""}
      </div>
      ${this.scenes.map((n,s)=>{let a=this.slots.find(o=>o.track===t&&o.scene===s);return c`<nbplay-launcher-slot
          data-track=${t}
          data-scene=${s}
          .name=${a?.name??""}
          .active=${this.active[t]===s}
          .queued=${i===s||i===Pe&&!a}
          .selected=${this.selected?.track===t&&this.selected?.scene===s}
          .progress=${this.progress[t]??0}
          .disabled=${this.disabled}
          @nbplay-launch=${o=>{o.stopPropagation(),this.emitDetail("nbplay-launch",{track:t,scene:s})}}
        ></nbplay-launcher-slot>`})}
      <button
        type="button"
        class="nbplay-launcher-grid-track-stop ${i===Pe?"queued":""}"
        title="Stop track"
        ?disabled=${this.disabled}
        @click=${()=>this.emitDetail("nbplay-stop-track",{track:t})}
      >
        ■
      </button>
    </div>`}};v("nbplay-launcher-grid",kt);function ee(r,e){let t=Math.floor(r/e)+1,i=Math.floor(r%e)+1;return`${t}.${i}`}function $t(r,e){return e>0?Math.round(r/e)*e:r}var Et=class extends f{static properties={length:{type:Number},beatsPerBar:{type:Number,attribute:"beats-per-bar"},beat:{type:Number},loopStart:{type:Number,attribute:"loop-start"},loopEnd:{type:Number,attribute:"loop-end"},loopEnabled:{type:Boolean,attribute:"loop-enabled",reflect:!0},width:{type:Number},disabled:{type:Boolean,reflect:!0}};seekFrame=null;constructor(){super(),this.length=16,this.beatsPerBar=4,this.beat=0,this.loopStart=0,this.loopEnd=0,this.loopEnabled=!1,this.width=0,this.disabled=!1}pct(e){return this.length>0?w(e/this.length*100,0,100):0}render(){let e=Math.max(1,Math.ceil(this.length/this.beatsPerBar)),t=this.loopEnabled&&this.loopEnd>this.loopStart;return c`<div
      class="nbplay-ruler-track"
      style=${this.width>0?`width: ${this.width}px;`:x}
      @pointerdown=${this.onSeekDown}
    >
      ${Array.from({length:e},(i,n)=>{let s=this.pct(n*this.beatsPerBar);return c`<span class="nbplay-ruler-bar" style="left: ${s}%;"
          >${n+1}</span
        >`})}
      ${t?c`<div
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
    </div>`}beatAt(e){let i=this.querySelector(".nbplay-ruler-track").getBoundingClientRect();return(i.width<=0?0:w((e.clientX-i.left)/i.width,0,1))*this.length}onSeekDown=e=>{if(this.disabled||e.button!==0||e.target.closest(".nbplay-ruler-loop-handle"))return;e.preventDefault();let t=e.currentTarget;Ae(t,e.pointerId);let i=this.beatAt(e);this.emitDetail("nbplay-seek",{beat:i,final:!1});let n=a=>{i=this.beatAt(a),this.seekFrame===null&&(this.seekFrame=requestAnimationFrame(()=>{this.seekFrame=null,this.emitDetail("nbplay-seek",{beat:i,final:!1})}))},s=()=>{this.seekFrame!==null&&(cancelAnimationFrame(this.seekFrame),this.seekFrame=null),this.emitDetail("nbplay-seek",{beat:i,final:!0}),t.removeEventListener("pointermove",n),t.removeEventListener("pointerup",s),t.removeEventListener("pointercancel",s)};t.addEventListener("pointermove",n),t.addEventListener("pointerup",s),t.addEventListener("pointercancel",s)};onHandleDown=e=>{if(this.disabled||e.button!==0)return;e.preventDefault(),e.stopPropagation();let t=e.currentTarget;Ae(t,e.pointerId);let i=t.dataset.edge==="start"?"loopStart":"loopEnd",n=this.beatsPerBar,s=(l,u)=>{let b=w($t(this.beatAt(l),n),0,this.length),m=i==="loopStart"?Math.min(b,this.loopEnd-n):Math.max(b,this.loopStart+n);this[i]=m,this.emitDetail(u,{field:i,value:m})},a=l=>s(l,"input"),o=l=>{s(l,"change"),t.removeEventListener("pointermove",a),t.removeEventListener("pointerup",o),t.removeEventListener("pointercancel",o)};t.addEventListener("pointermove",a),t.addEventListener("pointerup",o),t.addEventListener("pointercancel",o)}};function Ae(r,e){try{r.setPointerCapture(e)}catch{}}v("nbplay-ruler",Et);var St=class extends f{static properties={clipId:{type:String,attribute:"clip-id",reflect:!0},name:{type:String},detail:{type:String},kind:{type:String,reflect:!0},pattern:{type:Boolean,reflect:!0},selected:{type:Boolean,reflect:!0},muted:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};constructor(){super(),this.clipId="",this.name="",this.detail="",this.kind="audio",this.pattern=!1,this.selected=!1,this.muted=!1,this.dragging=!1}render(){return c`<i class="nbplay-clip-handle start"></i>
      <span class="nbplay-clip-name">${this.name}</span>
      <small class="nbplay-clip-detail">${this.detail}</small>
      <i class="nbplay-clip-handle end"></i>`}};v("nbplay-clip",St);var bs=.25,mn=.25,bn=3,xt=class extends f{static properties={name:{type:String},armed:{type:Boolean},monitor:{type:Boolean},muted:{type:Boolean},solo:{type:Boolean},input:{type:String},inputs:{attribute:!1},clips:{attribute:!1},length:{type:Number},beatsPerBar:{type:Number,attribute:"beats-per-bar"},beat:{type:Number},selected:{type:String},recording:{type:Boolean,reflect:!0},showHeader:{type:Boolean,attribute:"show-header"},width:{type:Number},disabled:{type:Boolean,reflect:!0}};seekFrame=null;constructor(){super(),this.name="",this.armed=!1,this.monitor=!1,this.muted=!1,this.solo=!1,this.input="microphone",this.inputs=[{value:"microphone",label:"Mic"},{value:"channel",label:"Channel"},{value:"midi",label:"MIDI"}],this.clips=[],this.length=16,this.beatsPerBar=4,this.beat=0,this.selected="",this.recording=!1,this.showHeader=!0,this.width=0,this.disabled=!1}pct(e){return this.length>0?w(e/this.length*100,0,100):0}render(){return c`${this.showHeader?this.renderHeader():x}
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
      </div>`}renderHeader(){let e=(t,i,n,s)=>c`<nbplay-toggle
        variant=${i}
        label=${n}
        title=${s}
        .active=${this[t]}
        .disabled=${this.disabled}
        @change=${a=>{a.stopPropagation();let o=a.detail.value;this[t]=o,this.emitDetail("change",{field:t,value:o})}}
      ></nbplay-toggle>`;return c`<div class="nbplay-lane-header">
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
        ${this.inputs.map(t=>c`<option
              value=${t.value}
              ?selected=${t.value===this.input}
              ?disabled=${t.disabled}
            >
              ${t.label}
            </option>`)}
      </select>
    </div>`}renderClip(e){let t=this.pct(e.start),i=Math.max(1,Math.min(100-t,this.pct(e.duration)));return c`<nbplay-clip
      clip-id=${e.id}
      .name=${e.name}
      .detail=${e.detail??ee(e.start,this.beatsPerBar)}
      .kind=${e.kind??"audio"}
      .pattern=${!!e.pattern}
      .muted=${!!e.muted}
      .selected=${e.id===this.selected}
      style="left: ${t}%; width: ${i}%;"
      @pointerdown=${n=>this.onClipDown(n,e)}
    ></nbplay-clip>`}beatAt(e,t){let i=t.getBoundingClientRect();return(i.width<=0?0:w((e.clientX-i.left)/i.width,0,1))*this.length}onSeekDown=e=>{if(this.disabled||e.button!==0||e.target.closest("nbplay-clip"))return;e.preventDefault();let t=e.currentTarget;Ae(t,e.pointerId);let i=this.beatAt(e,t);this.emitDetail("nbplay-seek",{beat:i,final:!1});let n=a=>{i=this.beatAt(a,t),this.seekFrame===null&&(this.seekFrame=requestAnimationFrame(()=>{this.seekFrame=null,this.emitDetail("nbplay-seek",{beat:i,final:!1})}))},s=()=>{this.seekFrame!==null&&(cancelAnimationFrame(this.seekFrame),this.seekFrame=null),this.emitDetail("nbplay-seek",{beat:i,final:!0}),t.removeEventListener("pointermove",n),t.removeEventListener("pointerup",s),t.removeEventListener("pointercancel",s)};t.addEventListener("pointermove",n),t.addEventListener("pointerup",s),t.addEventListener("pointercancel",s)};onClipDown(e,t){if(this.disabled||e.button!==0)return;let i=e.currentTarget,s=i.parentElement.getBoundingClientRect().width;if(s<=0)return;let a=e.target,o=a?.closest(".nbplay-clip-handle.start")?"trim-start":a?.closest(".nbplay-clip-handle.end")?"trim-end":"move";e.preventDefault(),e.stopPropagation(),Ae(i,e.pointerId);let l=s/this.length,u=e.clientX,b=e.clientY,m=!1,p={start:t.start,duration:t.duration,offset:t.offset??0},h=d=>{let E=$t((d.clientX-u)/l,bs),g=t.offset??0;if(o==="move")return{start:Math.max(0,t.start+E),duration:t.duration,offset:g};if(o==="trim-start"){let S=Math.max(-Math.min(g,t.start),Math.min(E,t.duration-mn));return{start:t.start+S,duration:t.duration-S,offset:g+S}}return{start:t.start,duration:Math.max(mn,t.duration+E),offset:g}},k=d=>({field:"clip",id:t.id,...p,clientY:d.clientY}),y=d=>{if(!m&&Math.abs(d.clientX-u)<bn&&Math.abs(d.clientY-b)<bn)return;m=!0,i.dragging=!0,p=h(d);let E=this.pct(p.start);i.style.left=`${E}%`,i.style.width=`${Math.max(1,Math.min(100-E,this.pct(p.duration)))}%`,this.emitDetail("input",k(d))},$=d=>{i.removeEventListener("pointermove",y),i.removeEventListener("pointerup",$),i.removeEventListener("pointercancel",$),i.dragging=!1,m?this.emitDetail("change",k(d)):this.emitDetail("nbplay-clip-select",{id:t.id})};i.addEventListener("pointermove",y),i.addEventListener("pointerup",$),i.addEventListener("pointercancel",$)}};v("nbplay-lane",xt);var fn=6;function Ct(r){return`var(--nbplay-palette-${r%fn+1})`}var wt=class extends f{static properties={zones:{attribute:!1},selected:{type:Number},emptyText:{type:String,attribute:"empty-text"}};constructor(){super(),this.zones=[],this.selected=-1,this.emptyText="No zones"}render(){let e=Array.from({length:11},(t,i)=>i*12);return c`<div
      class="nbplay-zone-map-track ${this.zones.length?"":"empty"}"
    >
      ${e.map(t=>c`<span
            class="nbplay-zone-map-tick"
            style="left:${t/128*100}%"
            >${P(t)}</span
          >`)}
      ${this.zones.length?this.zones.map((t,i)=>this.renderSpan(t,i)):c`<span class="nbplay-zone-map-empty">${this.emptyText}</span>`}
    </div>`}renderSpan(e,t){let i=Math.min(e.low,e.high),n=Math.max(e.low,e.high),s=i/128*100,a=(n-i+1)/128*100,o=`${e.name??`Zone ${t+1}`}: ${P(i)}\u2013${P(n)}`;return c`<button
      type="button"
      class="nbplay-zone-map-span ${t===this.selected?"selected":""}"
      data-index=${t}
      title=${o}
      style="left:${s}%;width:${a}%;background:${e.color??Ct(t)}"
      @click=${()=>this.emitDetail("nbplay-zone-select",{index:t})}
    ></button>`}};v("nbplay-zone-map",wt);var Nt=class extends f{static properties={zones:{attribute:!1},selected:{type:Number},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.zones=[],this.selected=-1,this.disabled=!1}render(){return c`${this.zones.map((e,t)=>this.renderRow(e,t))}`}renderRow(e,t){let i=s=>s.stopPropagation(),n=(s,a)=>c`<label class="nbplay-zone-list-note">
        <span>${a}</span>
        <nbplay-value
          kind="note"
          .value=${e[s]}
          .min=${0}
          .max=${127}
          .editable=${!this.disabled}
          @input=${i}
          @change=${o=>{o.stopPropagation(),this.commit(t,s,o.detail.value)}}
        ></nbplay-value>
      </label>`;return c`<div
      class="nbplay-zone-list-row ${t===this.selected?"selected":""}"
      data-index=${t}
      @click=${()=>this.emitDetail("nbplay-zone-select",{index:t})}
    >
      <span
        class="nbplay-zone-list-swatch"
        style="background:${e.color??Ct(t)}"
      ></span>
      <input
        type="text"
        class="nbplay-zone-list-name"
        title="Zone name"
        .value=${e.name}
        ?disabled=${this.disabled}
        @input=${i}
        @change=${s=>{s.stopPropagation(),this.commit(t,"name",s.target.value)}}
      />
      ${n("low","Low")} ${n("high","High")} ${n("root","Root")}
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
    </div>`}commit(e,t,i){let n=[...this.zones];n[e]={...n[e],[t]:i},this.zones=n,this.emitDetail("change",{index:e,field:t,value:i})}};v("nbplay-zone-list",Nt);function fs(){let r=globalThis;return(!r.__nbplay||typeof r.__nbplay!="object")&&(r.__nbplay={}),r.__nbplay}function N(r){return r?globalThis.__nbplay?.[r]:void 0}function Me(r){let e=fs();return e[r]||(e[r]={}),e[r]}function Pt(r,e){N(r)?.noteListeners?.forEach(i=>i(e))}function vn(r){if(r.audioCtx&&r.audioCtx.state!=="closed")return r.audioCtx;let e=D();return e&&(r.audioCtx=e),e}function vs(r){return r.clock||(r.clock=yn(r)),r.clock}function Te(r,e,t){let i=Number(r);return Number.isFinite(i)?Math.max(t,i):e}function yn(r={}){let e=!1,t=!1,i=120,n=!1,s=4,a={enabled:!1,startBeat:0,endBeat:16},o=0,l=0,u=null,b=new Set;function m(){return performance.now()/1e3}function p(g){return g?g.currentTime:m()}function h(g){return e?o+(g-l)*(i/60):o}function k(g){if(!a.enabled||a.endBeat<=a.startBeat||g<a.endBeat)return g;let S=a.endBeat-a.startBeat;return a.startBeat+(g-a.startBeat)%S}function y(g){let S={type:g,beat:E.beat()};b.forEach(A=>{try{A(S)}catch(_){console.warn("nbplay clock listener failed",_)}})}function $(){if(r.audioCtx&&r.audioCtx.state==="closed"&&delete r.audioCtx,!r.audioCtx){let S=D();S&&(r.audioCtx=S)}let g=r.audioCtx||null;if(g!==u){let S=k(h(p(u)));u=g,o=S,l=p(g)}return g}function d(){let g=$(),S=p(g);o=k(h(S)),l=S}let E={get playing(){return e},get recording(){return t},get bpm(){return i},get beatsPerBar(){return s},get loop(){return{...a}},context(){return $()},now(){return p($())},beat(){return E.beatAt(E.now())},beatAt(g){return k(h(g))},ctxTimeAt(g){return $(),l+(g-o)*(60/i)},secondsPerBeat(){return 60/i},play(){if(e)return;let g=$();g&&g.state==="suspended"&&g.resume?.(),l=p(g),e=!0,y("play")},stop(){if(!e)return;let g=E.beat();e=!1,o=g,y("stop")},seek(g){let S=$();o=Te(g,0,0),l=p(S),y("seek")},setTempo(g){n=!0;let S=Te(g,i,1);S!==i&&(d(),i=S,y("tempo"))},adoptTempo(g){return n||E.setTempo(g),i},setBeatsPerBar(g){let S=Math.max(1,Math.round(Te(g,s,1)));S!==s&&(s=S,y("timesig"))},setLoop(g,S,A){let _={enabled:!!g,startBeat:Te(S,0,0),endBeat:Te(A,0,0)};_.enabled===a.enabled&&_.startBeat===a.startBeat&&_.endBeat===a.endBeat||(d(),a=_,y("loop"))},setRecording(g){let S=!!g;S!==t&&(t=S,y("record"))},subscribe(g){return b.add(g),()=>{b.delete(g)}}};return E}function ys(r,e,t){let i={},n=null,s=null,a=null;function o(){let u=String(r.get("session_id")||"");return u?vs(Me(u)):(n||(n=yn(i)),n)}function l(u){let b=o();return b===s||(a?.(),s=b,a=b.subscribe(e),u&&t?.(b)),b}return l(!1),r.on("change:session_id",()=>l(!0)),{clock:()=>l(!0),shared:()=>!!r.get("session_id"),dispose(){a?.(),a=null,s=null,i.audioCtx&&i.audioCtx.state!=="closed"&&i.audioCtx.close(),delete i.audioCtx}}}function q(r,e,t){let i=[],s=ys({get:a=>a==="session_id"?r.sessionId:void 0,set:()=>{},save_changes:()=>{},on:(a,o)=>{a==="change:session_id"&&i.push(o)}},e,t);return{clock:s.clock,shared:s.shared,dispose:s.dispose,rebind:()=>i.forEach(a=>a())}}var gn=30,kn=300,gs=50,ks=250,At=class extends f{static properties={sessionId:{type:String,attribute:"session-id",reflect:!0},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},loopEnabled:{type:Boolean,attribute:"loop-enabled"},loopStartBar:{type:Number,attribute:"loop-start-bar"},loopEndBar:{type:Number,attribute:"loop-end-bar"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},isRecording:{type:Boolean,attribute:"is-recording",reflect:!0},currentBeat:{attribute:!1},barNumber:{attribute:!1},beatInBar:{attribute:!1},undoRequest:{attribute:!1},redoRequest:{attribute:!1}};binding=null;unbindShortcuts=null;tickTimer=null;lastSyncedBeat=0;lastSyncMs=0;constructor(){super(),this.sessionId="",this.bpm=120,this.timeSignatureNum=4,this.timeSignatureDen=4,this.loopEnabled=!1,this.loopStartBar=0,this.loopEndBar=4,this.isPlaying=!1,this.isRecording=!1,this.currentBeat=0,this.barNumber=0,this.beatInBar=0}clock(){if(!this.binding){this.binding=q(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.pushLoop(e),this.pullState(e),e.playing&&this.startTicking(e.beat())}return this.binding.clock()}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-transport"),this.clock(),this.unbindShortcuts=J(this,{Space:()=>this.togglePlay(),"Shift+Space":()=>this.stopAndRewind(),r:()=>this.toggleRecord(),l:()=>this.toggleLoop(),ArrowUp:()=>this.nudgeTempo(1),ArrowDown:()=>this.nudgeTempo(-1),"Shift+ArrowUp":()=>this.nudgeTempo(10),"Shift+ArrowDown":()=>this.nudgeTempo(-10)}),this.addEventListener("keydown",this.onUndoKey)}disconnectedCallback(){super.disconnectedCallback(),this.stopTicking(),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.removeEventListener("keydown",this.onUndoKey),this.binding?.dispose(),this.binding=null}beatsPerBar(){return Math.max(1,Number(this.timeSignatureNum)||4)}pushTempo(e){e.setTempo(Number(this.bpm))}joinTempo(e){let t=e.adoptTempo(Number(this.bpm));t!==Number(this.bpm)&&(this.bpm=t,this.set({bpm:t}))}pushLoop(e){let t=this.beatsPerBar();e.setBeatsPerBar(t),e.setLoop(!!this.loopEnabled,(Number(this.loopStartBar)||0)*t,(Number(this.loopEndBar)||0)*t)}writePosition(e){let t=this.beatsPerBar(),i=Number.isFinite(e)?Math.max(0,e):0;this.currentBeat=i,this.barNumber=Math.floor(i/t),this.beatInBar=Math.floor(i%t)}pullState(e){this.isPlaying=e.playing,this.isRecording=e.recording,this.writePosition(e.beat())}status(e){this.emitDetail("nbplay-status",{values:{isPlaying:this.isPlaying,isRecording:this.isRecording,currentBeat:this.currentBeat,barNumber:this.barNumber,beatInBar:this.beatInBar},save:e})}set(e){this.emitDetail("nbplay-set",{values:e})}tick=()=>{let e=this.clock().beat();this.writePosition(e);let t=performance.now(),i=!1;Math.floor(e)!==Math.floor(this.lastSyncedBeat)&&t-this.lastSyncMs>=ks&&(this.lastSyncedBeat=e,this.lastSyncMs=t,i=!0),this.status(i)};startTicking(e){this.stopTicking(),this.lastSyncedBeat=e,this.lastSyncMs=performance.now(),this.tickTimer=setInterval(this.tick,gs)}stopTicking(){this.tickTimer!==null&&(clearInterval(this.tickTimer),this.tickTimer=null)}onClockEvent=e=>{let t=this.clock();switch(e.type){case"play":this.isPlaying=!0,this.writePosition(e.beat),this.status(!0),this.startTicking(e.beat);break;case"stop":this.stopTicking(),this.isPlaying=!1,this.writePosition(e.beat),this.status(!0);break;case"seek":this.lastSyncedBeat=e.beat,this.writePosition(e.beat),this.status(!0);break;case"tempo":Number(this.bpm)!==t.bpm&&(this.bpm=t.bpm,this.set({bpm:t.bpm}));break;case"record":!!this.isRecording!==t.recording&&(this.isRecording=t.recording,this.status(!0));break;case"loop":{let i=this.beatsPerBar(),n=t.loop,s=Math.round(n.startBeat/i),a=Math.round(n.endBeat/i);(!!this.loopEnabled!==n.enabled||Number(this.loopStartBar)!==s||Number(this.loopEndBar)!==a)&&(this.loopEnabled=n.enabled,this.loopStartBar=s,this.loopEndBar=a,this.set({loopEnabled:n.enabled,loopStartBar:s,loopEndBar:a}));break}case"timesig":break}};onRebind=e=>{this.stopTicking(),this.joinTempo(e),this.pushLoop(e),this.pullState(e),this.status(!0),e.playing&&this.startTicking(e.beat())};updated(e){if(!this.binding)return;if(e.has("sessionId")&&e.get("sessionId")!==void 0){this.binding.rebind();return}let t=this.clock();e.has("bpm")&&Number(this.bpm)!==t.bpm&&this.pushTempo(t),(e.has("timeSignatureNum")||e.has("loopEnabled")||e.has("loopStartBar")||e.has("loopEndBar"))&&this.pushLoop(t),(e.has("isPlaying")||e.has("isRecording"))&&(!!this.isPlaying!==t.playing||!!this.isRecording!==t.recording)&&(this.isPlaying=t.playing,this.isRecording=t.recording,this.status(!0))}command(e){let t=this.clock();switch(e.action){case"play":t.playing||t.play();break;case"stop":t.playing&&t.stop();break;case"seek":{let i=Number(e.beat);Number.isFinite(i)&&t.seek(Math.max(0,i));break}case"record":{let i=!!e.on;t.setRecording(i),i&&!t.playing&&t.play();break}}this.pullState(t),this.status(!0)}togglePlay(){let e=this.clock();e.playing?e.stop():e.play()}toggleRecord(){let e=this.clock(),t=!e.recording;e.setRecording(t),t&&e.play()}stopAndRewind(){let e=this.clock();e.stop(),e.setRecording(!1),e.seek(0)}toggleLoop(){this.loopEnabled=!this.loopEnabled,this.set({loopEnabled:this.loopEnabled}),this.pushLoop(this.clock())}nudgeTempo(e){let t=w(Math.round(this.clock().bpm)+e,gn,kn);this.clock().setTempo(t)}onUndoKey=e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey)return;let t=e.target;if(t?.tagName==="INPUT"||t?.tagName==="TEXTAREA"||t?.isContentEditable)return;let i=e.key.toLowerCase();if(i!=="z"&&i!=="y")return;e.preventDefault(),e.stopPropagation();let n=i==="y"||e.shiftKey?"redo":"undo";n==="redo"?this.redoRequest=(this.redoRequest||0)+1:this.undoRequest=(this.undoRequest||0)+1,this.emitDetail("nbplay-request",{name:n})};render(){let e=this.beatsPerBar(),t=n=>n.stopPropagation(),i=n=>{n.stopPropagation(),this.clock().setTempo(n.detail.value)};return c`<nbplay-transport-buttons
        class="nbplay-transport-controls"
        .playing=${this.isPlaying}
        .recording=${this.isRecording}
        @nbplay-play=${n=>{n.stopPropagation(),this.togglePlay()}}
        @nbplay-stop=${n=>{n.stopPropagation(),this.stopAndRewind()}}
        @nbplay-record=${n=>{n.stopPropagation(),this.toggleRecord()}}
      ></nbplay-transport-buttons>
      <nbplay-param
        class="nbplay-transport-tempo"
        label="BPM"
        kind="bpm"
        .value=${this.bpm}
        .min=${gn}
        .max=${kn}
        .step=${1}
        .defaultValue=${120}
        @input=${i}
        @change=${i}
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
          @change=${n=>{n.stopPropagation(),this.toggleLoop()}}
        ></nbplay-toggle>
        <span class="nbplay-transport-loop-range"
          >${this.loopStartBar+1} – ${this.loopEndBar}</span
        >
      </div>`}};v("nbplay-transport",At);function Es(r){let e=r.channel_index||0;if(r.match)return r;let t=r.zone||"all";return t==="upper"||t==="lower"?{channel_index:e,match:"zone",zone:t}:{channel_index:e,match:"all"}}function En(r,e,t){let i=[];for(let n of r){let s=Es(n),a=!1;switch(s.match){case"all":a=!0;break;case"zone":a=s.zone===t;break;case"octave":{a=Math.floor(e/12)-1===s.octave;break}case"note":a=e===s.note;break;case"notes":a=s.notes.includes(e);break}a&&i.push(s.channel_index)}return i}function he(r,e,t,i,n){if(!r||e.length===0)return!1;let s=N(r);if(!s?.samplers)return!1;let a=!1;for(let o of En(e,t,i)){let l=s.samplers[o];l&&(l.triggerNote(t,n),a=!0)}return a}function me(r,e,t,i){if(!r||e.length===0)return!1;let n=N(r);if(!n?.samplers)return!1;let s=!1;for(let a of En(e,t,i)){let o=n.samplers[a];o&&(o.releaseNote(t),s=!0)}return s}function yi(r){return 440*Math.pow(2,(r-69)/12)}function be(){let r="",e=-1,t=null,i=null,n=!1,s=new Map;function a(){let o=r?N(r):void 0;return o?.audioCtx&&e>=0&&o.channels?.[e]?(t!==o.audioCtx&&(n&&t&&t.state!=="closed"&&t.close(),t=o.audioCtx,n=!1),i=o.channels[e].gain):t||(t=D(),n=t!==null,i=null),t?.state==="suspended"&&t.resume(),t}return{setSession(o,l){r=o||"",e=Number.isFinite(l)?l:-1},noteOn(o,l,u){let b=a();if(!b)return;s.has(o)&&this.noteOff(o);let m=b.createOscillator(),p=b.createGain();m.type="sine",m.frequency.value=yi(o);let h=b.currentTime,k=l/127*(u?1:.3);p.gain.setValueAtTime(0,h),p.gain.linearRampToValueAtTime(k,h+.005),u&&(p.gain.linearRampToValueAtTime(0,h+u),m.stop(h+u+.05)),m.connect(p),p.connect(i||b.destination),m.start(h),s.set(o,{osc:m,gain:p}),u&&setTimeout(()=>{s.get(o)?.osc===m&&s.delete(o)},(u+.1)*1e3)},noteOff(o){let l=s.get(o);if(!l||!t)return;let u=t.currentTime;l.gain.gain.cancelScheduledValues(u),l.gain.gain.setValueAtTime(l.gain.gain.value,u),l.gain.gain.linearRampToValueAtTime(0,u+.05);try{l.osc.stop(u+.06)}catch{}s.delete(o)},stopAll(){for(let o of s.values()){try{o.osc.stop()}catch{}o.gain.disconnect()}s.clear()},destroy(){this.stopAll(),n&&t&&t.state!=="closed"&&t.close(),t=null,i=null,n=!1}}}var $s=.3;function $n(r,e){let t=Number(r);return Number.isFinite(t)?Math.max(1,Math.floor(t)):e}function Ss(r,e){return r.length===e.length&&r.every((t,i)=>t===e[i])}var Tt=class extends f{static properties={rows:{type:Number},cols:{type:Number},velocity:{type:Number},velocitySensitive:{type:Boolean,attribute:"velocity-sensitive"},padNotes:{attribute:!1},padVelocities:{attribute:!1},padActions:{attribute:!1},samplerRouting:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},activePads:{attribute:!1},lastNoteEvent:{attribute:!1},lastPadEvent:{attribute:!1}};voices=be();held=new Set;heldNotes=new Map;constructor(){super(),this.rows=4,this.cols=4,this.velocity=100,this.velocitySensitive=!0,this.padNotes=Array.from({length:16},(e,t)=>36+t),this.padVelocities=[],this.padActions=[],this.samplerRouting=[],this.sessionId="",this.channelIndex=-1,this.activePads=[],this.lastNoteEvent={},this.lastPadEvent={}}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-pad"),this.voices.setSession(this.sessionId,this.channelIndex)}disconnectedCallback(){super.disconnectedCallback(),this.releaseAll(),this.voices.destroy()}dims(){return{rows:$n(this.rows,4),cols:$n(this.cols,4)}}notes(){return Array.isArray(this.padNotes)?this.padNotes:[]}effectiveVelocities(){let e=Array.isArray(this.padVelocities)?this.padVelocities:[],t=B(this.velocity);return e.map(i=>i??t)}actions(){let{rows:e,cols:t}=this.dims();return pe(this.padActions,this.notes(),this.effectiveVelocities(),e*t)}pads(){let e=this.notes(),t=this.effectiveVelocities();return this.actions().map((i,n)=>{let s=t[n]??100;return i.type==="note"&&!i.label?{note:i.note,velocity:s}:{note:e[n]??60,velocity:s,label:Ke(i)}})}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.voices.setSession(this.sessionId,this.channelIndex),e.has("velocity")&&e.get("velocity")!==void 0&&this.resetPadVelocities(B(this.velocity))}resetPadVelocities(e){let{rows:t,cols:i}=this.dims(),n=Array.isArray(this.padVelocities)?this.padVelocities:[],s=n.length||t*i,a=Array.from({length:s},()=>e),o=pe(this.padActions,this.notes(),a,t*i).map(u=>u.type==="note"?{...u,velocity:e}:u),l=!Ss(n,a)||JSON.stringify(o)!==JSON.stringify(this.padActions);this.padVelocities=a,this.padActions=o,l&&this.set({padVelocities:a,padActions:o})}set(e){this.emitDetail("nbplay-set",{values:e})}status(){this.activePads=Array.from(this.held),this.emitDetail("nbplay-status",{values:{activePads:this.activePads,lastNoteEvent:this.lastNoteEvent,lastPadEvent:this.lastPadEvent},save:!0})}triggerPad(e,t){let i=this.actions()[e]??{type:"note",note:this.notes()[e]??60};if(this.held.add(e),i.type==="note"){let n=i.note,s=B(t,i.velocity??100);this.heldNotes.set(e,n),he(this.sessionId,this.samplerRouting||[],n,"upper",s)||this.voices.noteOn(n,s,$s),this.lastNoteEvent={note:n,velocity:s,type:"on"},this.lastPadEvent={pad:e,event:"on",velocity:s,action:i}}else i.type==="trait"&&this.set({[i.trait]:i.value}),this.lastPadEvent={pad:e,event:"trigger",velocity:t,action:i};this.status()}releasePad(e){if(!this.held.delete(e))return;let t=this.heldNotes.get(e);this.heldNotes.delete(e);let i=this.actions()[e];t!==void 0&&(me(this.sessionId,this.samplerRouting||[],t,"upper")||this.voices.noteOff(t),this.lastNoteEvent={note:t,velocity:0,type:"off"}),i&&(this.lastPadEvent={pad:e,event:"off",velocity:0,action:i}),this.status()}releaseAll(){for(let e of Array.from(this.held))this.releasePad(e)}onPadChange(e){e.stopPropagation();let{index:t,field:i,value:n}=e.detail;if(i==="note"){let s=[...this.notes()];if(t>=s.length)return;s[t]=n,this.padNotes=s,this.set({padNotes:s})}else{let s=[...this.effectiveVelocities()];if(t>=s.length)return;s[t]=n,this.padVelocities=s,this.set({padVelocities:s})}}render(){let{rows:e,cols:t}=this.dims(),i=s=>s.stopPropagation(),n=s=>{s.stopPropagation();let a=B(s.detail.value);a!==this.velocity&&(this.velocity=a,this.set({velocity:a}))};return c`<nbplay-header badge="pads"></nbplay-header>
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
          @input=${n}
          @change=${n}
        ></nbplay-param>
        <label class="nbplay-pad-vel-sense-label">
          <input
            type="checkbox"
            class="nbplay-pad-vel-sense-chk"
            .checked=${this.velocitySensitive}
            @input=${i}
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
      </div>`}};v("nbplay-pads",Tt);var xs=[{value:"sine",label:"Sine"},{value:"square",label:"Square"},{value:"saw",label:"Saw"},{value:"noise",label:"Noise"}],ws=20,Cs=8e3;function Ns(r,e,t,i,n,s,a,o,l){let u=Math.max(0,Math.min(1,i))*(s/127),b=.005,m=Math.min(.05,o*.2),p=r.createGain();p.gain.setValueAtTime(0,a),p.gain.linearRampToValueAtTime(u,a+b),p.gain.linearRampToValueAtTime(0,a+Math.max(b,o-m)),p.connect(e);let h;if(t==="noise"){let k=Math.max(1,Math.round(r.sampleRate*o)),y=r.createBuffer(1,k,r.sampleRate),$=y.getChannelData(0);for(let E=0;E<k;E++)$[E]=Math.random()*2-1;let d=r.createBufferSource();d.buffer=y,h=d}else{let k=r.createOscillator();k.type=t==="square"||t==="saw"?t.replace("saw","sawtooth"):"sine",k.frequency.value=yi(n),h=k}return h.connect(p),h.onended=()=>{try{p.disconnect()}catch{}l()},h.start(a),h.stop(a+o),()=>{try{h.stop(0),p.disconnect()}catch{}l()}}var gi=class{ctx=null;source=null;gain=null;start(e,t,i,n){this.stop();let s=D({sampleRate:n});if(!s)return!1;this.ctx=s,s.state==="suspended"&&s.resume?.();let a=s.createGain();if(a.gain.value=i,a.connect(s.destination),this.gain=a,e==="noise"){let o=s.createBuffer(1,n*2,n),l=o.getChannelData(0);for(let b=0;b<l.length;b++)l[b]=Math.random()*2-1;let u=s.createBufferSource();u.buffer=o,u.loop=!0,u.connect(a),u.start(),this.source=u}else{let o=s.createOscillator();o.type=e==="saw"?"sawtooth":e,o.frequency.value=t,o.connect(a),o.start(),this.source=o}return!0}stop(){if(this.source){try{this.source.stop()}catch{}this.source.disconnect(),this.source=null}this.gain&&(this.gain.disconnect(),this.gain=null),this.ctx&&(this.ctx.close(),this.ctx=null)}setFrequency(e){let t=this.source;t?.frequency&&this.ctx&&t.frequency.setTargetAtTime(e,this.ctx.currentTime,.01)}setAmplitude(e){this.gain&&this.ctx&&this.gain.gain.setTargetAtTime(e,this.ctx.currentTime,.01)}},Mt=class extends f{static properties={oscillatorType:{type:String,attribute:"oscillator-type"},frequency:{type:Number},amplitude:{type:Number},sampleRate:{type:Number,attribute:"sample-rate"},waveform:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0}};tone=new gi;registration=null;liveNotes=new Set;constructor(){super(),this.oscillatorType="sine",this.frequency=440,this.amplitude=.5,this.sampleRate=44100,this.waveform=null,this.sessionId="",this.channelIndex=-1,this.isPlaying=!1}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-synth"),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.register()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.unregister(),this.tone.stop()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.register(),e.has("isPlaying")&&e.get("isPlaying")!==void 0&&(this.isPlaying?this.startTone():this.tone.stop())}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.register()};unregister(){if(this.liveNotes.forEach(n=>n()),this.liveNotes.clear(),!this.registration)return;let{bus:e,idx:t,entry:i}=this.registration;e.instruments?.[t]===i&&delete e.instruments[t],this.registration=null}register(){let e=this.sessionId,t=Number(this.channelIndex);if(this.unregister(),!e||!(t>=0))return;let i=N(e);if(!i)return;let n=i.instruments||{};i.instruments=n;let s={scheduleNote:(a,o,l,u)=>{let b=i.audioCtx,m=i.channels?.[t]?.gain||i.masterGain;if(!b||!m)return;let p=Ns(b,m,this.oscillatorType||"sine",Number(this.amplitude)||0,a,o,l,u,()=>this.liveNotes.delete(p));return this.liveNotes.add(p),p}};n[t]=s,this.registration={bus:i,idx:t,entry:s}}startTone(){this.tone.start(this.oscillatorType,this.frequency,this.amplitude,this.sampleRate)||(this.isPlaying=!1,this.status())}stop(){this.isPlaying&&(this.isPlaying=!1,this.tone.stop(),this.status())}status(){this.emitDetail("nbplay-status",{values:{isPlaying:this.isPlaying},save:!0})}set(e){this.emitDetail("nbplay-set",{values:e})}render(){let e=this.oscillatorType==="noise",t=n=>{n.stopPropagation();let s=n.detail.value;s!==this.frequency&&(this.frequency=s,this.tone.setFrequency(s),this.set({frequency:s}))},i=n=>{n.stopPropagation();let s=n.detail.value;s!==this.amplitude&&(this.amplitude=s,this.tone.setAmplitude(s),this.set({amplitude:s}))};return c`<nbplay-header badge="synth"></nbplay-header>
      <nbplay-waveform
        class="nbplay-synth-waveform"
        variant="glow"
        .data=${H(this.waveform)}
      ></nbplay-waveform>
      <nbplay-segmented
        class="nbplay-osc"
        label="Oscillator"
        .options=${xs}
        .value=${this.oscillatorType}
        @change=${n=>{n.stopPropagation(),this.oscillatorType=n.detail.value,this.set({oscillatorType:this.oscillatorType}),this.isPlaying&&this.startTone()}}
      ></nbplay-segmented>
      <div class="nbplay-synth-params">
        <nbplay-param
          class="nbplay-freq"
          label="Frequency"
          kind="hz"
          scale="log"
          .value=${this.frequency}
          .min=${ws}
          .max=${Cs}
          .step=${.1}
          .defaultValue=${440}
          .disabled=${e}
          @input=${t}
          @change=${t}
        ></nbplay-param>
        <nbplay-param
          class="nbplay-amp"
          label="Amplitude"
          kind="float"
          .value=${this.amplitude}
          .min=${0}
          .max=${1}
          .step=${.01}
          .defaultValue=${.8}
          .precision=${2}
          @input=${i}
          @change=${i}
        ></nbplay-param>
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
      </div>`}};v("nbplay-synth",Mt);var Ps=-1,As=8,Ts=80;function Sn(r,e){(r?N(r):void 0)?.noteListeners?.forEach(i=>i(e)),document.dispatchEvent(new CustomEvent("nbplay-note",{detail:e}))}var Bt=class extends f{static properties={upperOctave:{type:Number,attribute:"upper-octave"},lowerOctave:{type:Number,attribute:"lower-octave"},velocity:{type:Number},sustainUpper:{type:Boolean,attribute:"sustain-upper"},sustainLower:{type:Boolean,attribute:"sustain-lower"},sustainGlobal:{type:Boolean,attribute:"sustain-global"},samplerRouting:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},activeNotes:{attribute:!1},lastNoteEvent:{attribute:!1}};voices=be();heldNotes=new Set;sustainedNotes=new Map;pressedKeys=new Map;velRepeatTimer=null;velRepeatCount=0;constructor(){super(),this.upperOctave=3,this.lowerOctave=4,this.velocity=100,this.sustainUpper=!1,this.sustainLower=!1,this.sustainGlobal=!1,this.samplerRouting=[],this.sessionId="",this.channelIndex=-1,this.activeNotes=[],this.lastNoteEvent={}}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-keyboard"),this.tabIndex=0,this.voices.setSession(this.sessionId,this.channelIndex),window.addEventListener("keydown",this.onKeyDown,!0),window.addEventListener("keyup",this.onKeyUp,!0),this.addEventListener("click",this.focusSelf),this.addEventListener("blur",this.onBlur)}disconnectedCallback(){super.disconnectedCallback(),this.stopVelRepeat(),window.removeEventListener("keydown",this.onKeyDown,!0),window.removeEventListener("keyup",this.onKeyUp,!0),this.removeEventListener("click",this.focusSelf),this.removeEventListener("blur",this.onBlur),this.voices.destroy()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.voices.setSession(this.sessionId,this.channelIndex)}focusSelf=()=>this.focus();set(e){this.emitDetail("nbplay-set",{values:e})}status(){this.activeNotes=Array.from(this.heldNotes),this.emitDetail("nbplay-status",{values:{activeNotes:this.activeNotes,lastNoteEvent:this.lastNoteEvent},save:!0})}noteOn(e,t){if(e<0||e>127)return;let i=this.velocity;this.heldNotes.add(e),he(this.sessionId,this.samplerRouting||[],e,t,i)||this.voices.noteOn(e,i),Sn(this.sessionId,{note:e,velocity:i,type:"on"}),this.lastNoteEvent={note:e,velocity:i,type:"on"},this.status()}noteOff(e,t){if(this.heldNotes.delete(e),this.sustainGlobal||t==="upper"&&this.sustainUpper||t==="lower"&&this.sustainLower){this.sustainedNotes.set(e,t),this.requestUpdate();return}this.release(e,t)}release(e,t){me(this.sessionId,this.samplerRouting||[],e,t)||this.voices.noteOff(e),Sn(this.sessionId,{note:e,velocity:0,type:"off"}),this.lastNoteEvent={note:e,velocity:0,type:"off"},this.sustainedNotes.delete(e),this.status()}releaseSustained(e){for(let[t,i]of Array.from(this.sustainedNotes))(e==="all"||i===e)&&!this.heldNotes.has(t)&&this.release(t,i)}releaseZoneKeys(e){for(let[t,i]of Array.from(this.pressedKeys))i.zone===e&&(this.pressedKeys.delete(t),this.noteOff(i.note,i.zone))}silence(){for(let e of this.pressedKeys.values())this.noteOff(e.note,e.zone);this.pressedKeys.clear();for(let[e,t]of Array.from(this.sustainedNotes))this.release(e,t);this.heldNotes.clear(),this.querySelector("nbplay-key-rows")?.releaseAll(),this.voices.stopAll(),this.status()}onBlur=()=>{for(let e of this.pressedKeys.values())this.noteOff(e.note,e.zone);this.pressedKeys.clear();for(let[e,t]of Array.from(this.sustainedNotes))this.release(e,t);this.heldNotes.clear(),this.status()};nudgeVelocity(e){let t=w(this.velocity+e,0,127);t!==this.velocity&&(this.velocity=t,this.set({velocity:t}))}startVelRepeat(e){this.velRepeatTimer||(this.velRepeatCount=0,this.velRepeatTimer=setInterval(()=>{this.velRepeatCount++,this.nudgeVelocity(e*(this.velRepeatCount>10?5:1))},Ts))}stopVelRepeat(){this.velRepeatTimer&&(clearInterval(this.velRepeatTimer),this.velRepeatTimer=null,this.velRepeatCount=0)}isActive(){let e=document.activeElement;if(!e)return!1;let t=e.tagName;if(t==="INPUT"||t==="TEXTAREA"||e.isContentEditable)return!1;if(e===this||this.contains(e))return!0;let i=e.closest(".nbplay-sequencer");return!!(i&&(i.querySelector(".nbplay-step-grid-cell.pending")||i.querySelector(".nbplay-seq-rec.recording")))}shiftOctave(e,t){this.releaseZoneKeys(e);let i=e==="upper"?"upperOctave":"lowerOctave",n=w(this[i]+t,Ps,As);this[i]=n,this.set({[i]:n})}setSustain(e,t){this[e]=t,this.set({[e]:t})}onKeyDown=e=>{if(!this.isActive())return;let t=e.key,i=t.toLowerCase(),n=()=>{e.preventDefault(),e.stopPropagation()};if(t==="Escape"){let a=document.activeElement;a?.classList.contains("nbplay-sequencer")&&a.querySelector(".nbplay-seq-key-wait")&&(n(),a.dispatchEvent(new CustomEvent("nbplay-cancel-edit")));return}if(this.pressedKeys.has(i)){n();return}switch(t){case"[":n(),this.shiftOctave("upper",-1);return;case"]":n(),this.shiftOctave("upper",1);return;case";":n(),this.shiftOctave("lower",-1);return;case"'":n(),this.shiftOctave("lower",1);return;case"-":n(),this.nudgeVelocity(-1),this.startVelRepeat(-1);return;case"=":n(),this.nudgeVelocity(1),this.startVelRepeat(1);return;case"`":n(),this.setSustain("sustainUpper",!0);return;case"/":n(),this.setSustain("sustainLower",!0);return;case" ":n(),this.setSustain("sustainGlobal",!0);return}let s=bi(i,this.upperOctave,this.lowerOctave);s&&(n(),this.pressedKeys.set(i,s),this.noteOn(s.note,s.zone))};onKeyUp=e=>{let t=e.key,i=t.toLowerCase(),n=this.pressedKeys.get(i);if(!this.isActive()){n&&(this.pressedKeys.delete(i),this.noteOff(n.note,n.zone));return}this.pressedKeys.delete(i);let s=()=>{e.preventDefault(),e.stopPropagation()};switch(t){case"-":case"=":s(),this.stopVelRepeat();return;case"`":s(),this.setSustain("sustainUpper",!1),this.releaseSustained("upper");return;case"/":s(),this.setSustain("sustainLower",!1),this.releaseSustained("lower");return;case" ":s(),this.setSustain("sustainGlobal",!1),this.releaseSustained("all");return}n&&(s(),this.noteOff(n.note,n.zone))};render(){let e=[...this.heldNotes,...this.sustainedNotes.keys()];return c`<nbplay-header badge="keyboard"></nbplay-header>
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
        @nbplay-note-on=${t=>{t.stopPropagation();let{note:i,zone:n}=t.detail;this.noteOn(i,n)}}
        @nbplay-note-off=${t=>{t.stopPropagation();let{note:i,zone:n}=t.detail;this.noteOff(i,n)}}
      ></nbplay-key-rows>
      <div class="nbplay-kb-controls">
        <span class="nbplay-kb-ctrl-label">[ ] oct↑</span>
        <span class="nbplay-kb-ctrl-label">; ' oct↓</span>
        <span class="nbplay-kb-ctrl-label">- = vel</span>
        <span class="nbplay-kb-ctrl-label">\` sus↑</span>
        <span class="nbplay-kb-ctrl-label">/ sus↓</span>
        <span class="nbplay-kb-ctrl-label">⎵ sus all</span>
      </div>`}};v("nbplay-keyboard",Bt);function ki(r){return{id:r.id,name:r.name||"(unnamed)",state:r.state}}function fe(){let r=null,e=null,t=null;return{async requestAccess(){if(r)return r;if(!navigator.requestMIDIAccess)return null;try{return r=await navigator.requestMIDIAccess({sysex:!1}),r}catch{return null}},inputs(){let i=[];return r?.inputs.forEach(n=>i.push(ki(n))),i},outputs(){let i=[];return r?.outputs.forEach(n=>i.push(ki(n))),i},connectInput(i,n){this.disconnectInput();let s=r?.inputs.get(i);return s?(t=a=>n(a.data,a.timeStamp||performance.now()),s.addEventListener("midimessage",t),e=s,ki(s)):null},disconnectInput(){e&&t&&e.removeEventListener("midimessage",t),e=null,t=null},activeInputId(){return e?e.id:null},output(i){return r?.outputs.get(i)??null}}}var xn=248,Ms=250,Bs=251,Rs=252,_s=242,Be=24;function wn(r){return r<60?"lower":"upper"}function Cn(r,e){(r?N(r):void 0)?.noteListeners?.forEach(i=>i(e)),document.dispatchEvent(new CustomEvent("nbplay-note",{detail:e}))}var Rt=class extends f{static properties={midiPort:{type:String,attribute:"midi-port"},syncClock:{type:Boolean,attribute:"sync-clock"},samplerRouting:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},availableMidiPorts:{attribute:!1},activeNotes:{attribute:!1},lastNoteEvent:{attribute:!1},controlChange:{attribute:!1},clockBpm:{type:Number,attribute:!1},ports:{attribute:!1}};midi=fe();voices=be();heldNotes=new Set;binding=null;monitor="No notes";ccSeq=0;tickTimes=[];tickCount=0;baseBeat=0;constructor(){super(),this.midiPort="",this.syncClock=!1,this.samplerRouting=[],this.sessionId="",this.channelIndex=-1,this.availableMidiPorts=[],this.activeNotes=[],this.lastNoteEvent={},this.controlChange={},this.clockBpm=0,this.ports=[]}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-midi-keyboard"),this.voices.setSession(this.sessionId,this.channelIndex),this.binding=q(this,()=>{},()=>{}),this.refreshPorts()}disconnectedCallback(){super.disconnectedCallback(),this.midi.disconnectInput(),this.voices.destroy(),this.binding?.dispose(),this.binding=null}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&(this.voices.setSession(this.sessionId,this.channelIndex),e.has("sessionId")&&this.binding?.rebind()),e.has("lastNoteEvent")&&e.get("lastNoteEvent")!==void 0&&(this.monitor=this.monitorText(),this.requestUpdate()),e.has("midiPort")&&e.get("midiPort")!==void 0&&this.connectByName(this.midiPort)}set(e){this.emitDetail("nbplay-set",{values:e})}status(e){this.emitDetail("nbplay-status",{values:e,save:!0})}monitorText(){let e=this.lastNoteEvent;return e?.type==="on"&&typeof e.note=="number"?`${P(e.note)}  vel ${e.velocity}`:e?.type==="off"&&typeof e.note=="number"?`${P(e.note)}  off`:"No notes"}async refreshPorts(){let e=await this.midi.requestAccess();this.ports=e?this.midi.inputs():[],e&&(this.availableMidiPorts=this.ports.map(t=>t.name),this.status({availableMidiPorts:this.availableMidiPorts}),this.midiPort&&!this.midi.activeInputId()&&this.connectByName(this.midiPort))}get activePortId(){return this.midi.activeInputId()??""}connectById(e){if(!e){this.midi.disconnectInput();return}this.midi.connectInput(e,(t,i)=>this.handleMidiData(t,i))}connectByName(e){let t=this.midi.activeInputId();if((this.ports.find(s=>s.id===t)?.name??"")===e)return;let n=this.ports.find(s=>s.name===e);this.connectById(n?.id??""),this.requestUpdate()}onPortChange(e){e.stopPropagation();let t=e.detail.value;this.connectById(t);let i=this.ports.find(n=>n.id===t);this.midiPort=t?i?.name??t:"",this.set({midiPort:this.midiPort})}noteOn(e,t){if(e<0||e>127)return;this.heldNotes.add(e);let i=wn(e);he(this.sessionId,this.samplerRouting||[],e,i,t)||this.voices.noteOn(e,t);let n={note:e,velocity:t,type:"on"};Cn(this.sessionId,n),this.lastNoteEvent={...n},this.activeNotes=Array.from(this.heldNotes),this.monitor=this.monitorText(),this.status({lastNoteEvent:n,activeNotes:this.activeNotes})}noteOff(e){if(e<0||e>127)return;this.heldNotes.delete(e),me(this.sessionId,this.samplerRouting||[],e,wn(e))||this.voices.noteOff(e);let t={note:e,velocity:0,type:"off"};Cn(this.sessionId,t),this.lastNoteEvent={...t},this.activeNotes=Array.from(this.heldNotes),this.monitor=this.monitorText(),this.status({lastNoteEvent:t,activeNotes:this.activeNotes})}control(e,t,i){this.ccSeq+=1,this.controlChange={controller:e,value:t,channel:i,seq:this.ccSeq},this.monitor=`CC ${e}  ${t}`,this.requestUpdate(),this.status({controlChange:this.controlChange})}silence(){this.midi.disconnectInput(),this.voices.stopAll(),this.heldNotes.clear(),this.activeNotes=[],this.status({activeNotes:[]})}handleClockTick(e){let t=this.binding.clock();if(this.tickTimes.push(e),this.tickTimes.length>Be+1&&this.tickTimes.shift(),this.tickCount+=1,this.tickTimes.length===Be+1){let i=(this.tickTimes[Be]-this.tickTimes[0])/1e3;if(i>0){let n=Math.round(60/i*10)/10;Math.abs(n-t.bpm)>.5&&t.setTempo(n),Math.abs(n-(Number(this.clockBpm)||0))>.05&&(this.clockBpm=n,this.status({clockBpm:n}))}}if(this.tickCount%Be===0&&t.playing&&!t.loop.enabled){let i=this.baseBeat+this.tickCount/Be;Math.abs(t.beat()-i)>.05&&t.seek(i)}}handleRealtime(e,t){if(!this.syncClock)return;let i=this.binding.clock();e===xn?this.handleClockTick(t):e===Ms?(this.tickTimes=[],this.tickCount=0,this.baseBeat=0,i.seek(0),i.play()):e===Bs?(this.tickTimes=[],this.tickCount=0,this.baseBeat=i.beat(),i.play()):e===Rs&&(this.tickTimes=[],i.stop())}handleSongPosition(e){if(!this.syncClock)return;let t=e/4;this.tickCount=0,this.baseBeat=t,this.binding.clock().seek(t)}handleMidiData(e,t=performance.now()){if(!e||e.length===0)return;if(e[0]>=xn){this.handleRealtime(e[0],t);return}if(e[0]===_s&&e.length>=3){this.handleSongPosition(e[1]&127|(e[2]&127)<<7);return}if(e.length<3)return;let i=e[0]&240,n=e[1],s=e[2];if(i===176){this.control(n,s,e[0]&15);return}if(i===144&&s>0){this.noteOn(n,s);return}(i===128||i===144&&s===0)&&this.noteOff(n)}render(){let e=i=>i.stopPropagation(),t=Number(this.clockBpm)||0;return c`<nbplay-header badge="midi keyboard"></nbplay-header>
      <div class="nbplay-midi-kb-row">
        <span class="nbplay-midi-kb-label">Port</span>
        <nbplay-midi-port
          .ports=${this.ports.map(i=>({id:i.id,name:i.name}))}
          .value=${this.activePortId}
          .status=${this.midiPort?"connected":"idle"}
          @input=${e}
          @change=${this.onPortChange}
          @nbplay-refresh=${i=>{i.stopPropagation(),this.refreshPorts()}}
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
            @change=${i=>{i.stopPropagation(),this.syncClock=i.target.checked,this.set({syncClock:this.syncClock})}}
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
      </div>`}};v("nbplay-midi-keyboard",Rt);var Is=[22050,44100,48e3,96e3],Ls=[128,256,512,1024,2048],Ds=8,_t=class extends f{static properties={sampleRate:{type:Number,attribute:"sample-rate"},channels:{type:Number},bufferSize:{type:Number,attribute:"buffer-size"},audioDevice:{type:String,attribute:"audio-device"},midiPort:{type:String,attribute:"midi-port"},availableMidiPorts:{attribute:!1},midiEvent:{attribute:!1},ports:{attribute:!1}};midi=fe();constructor(){super(),this.sampleRate=44100,this.channels=2,this.bufferSize=512,this.audioDevice="",this.midiPort="",this.availableMidiPorts=[],this.midiEvent=null,this.ports=[]}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-settings"),this.refreshPorts()}disconnectedCallback(){super.disconnectedCallback(),this.midi.disconnectInput()}updated(e){e.has("midiPort")&&e.get("midiPort")!==void 0&&this.connectByName(this.midiPort)}set(e){this.emitDetail("nbplay-set",{values:e})}status(e){this.emitDetail("nbplay-status",{values:e,save:!0})}async refreshPorts(){let e=await this.midi.requestAccess();this.ports=e?this.midi.inputs():[],e&&(this.availableMidiPorts=this.ports.map(t=>t.name),this.status({availableMidiPorts:this.availableMidiPorts}),this.midiPort&&!this.midi.activeInputId()&&this.connectByName(this.midiPort))}onMessage=(e,t)=>{let i=yt(e),n=this.querySelector("nbplay-midi-log");i&&n&&n.push(i);let s=new Uint8Array(e.length+8);new DataView(s.buffer).setFloat64(0,t,!0),s.set(e,8),this.midiEvent=new DataView(s.buffer),this.status({midiEvent:this.midiEvent})};connectById(e){e?this.midi.connectInput(e,this.onMessage):this.midi.disconnectInput()}connectByName(e){let t=this.midi.activeInputId();if((this.ports.find(s=>s.id===t)?.name??"")===e)return;let n=this.ports.find(s=>s.name===e);this.connectById(n?.id??""),this.requestUpdate()}onPortChange(e){e.stopPropagation();let t=e.detail.value;this.connectById(t);let i=this.ports.find(n=>n.id===t);this.midiPort=t?i?.name??t:"",this.set({midiPort:this.midiPort})}select(e,t,i){return c`<select
      class="nbplay-select ${e}"
      .value=${String(this[t])}
      @input=${n=>n.stopPropagation()}
      @change=${n=>{n.stopPropagation();let s=parseInt(n.target.value,10);this[t]=s,this.set({[t]:s})}}
    >
      ${i.map(n=>c`<option
            value=${n.value}
            ?selected=${n.value===this[t]}
            .textContent=${n.label}
          ></option>`)}
    </select>`}render(){let e=this.midi.activeInputId()??"";return c`<nbplay-header badge="settings"></nbplay-header>
      <div class="nbplay-section">
        <div class="nbplay-section-title">
          <span class="nbplay-section-icon">♫</span> Audio Output
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Sample Rate</span>
          ${this.select("nbplay-sr-select","sampleRate",Is.map(t=>({value:t,label:`${t} Hz`})))}
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Channels</span>
          ${this.select("nbplay-ch-select","channels",[{value:1,label:"Mono"},{value:2,label:"Stereo"}])}
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Buffer Size</span>
          ${this.select("nbplay-buf-select","bufferSize",Ls.map(t=>({value:t,label:String(t)})))}
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
        <nbplay-midi-log label="Activity" .max=${Ds}></nbplay-midi-log>
      </div>`}};v("nbplay-settings",_t);var Os=248,Vs=250,Nn=251,Ei=252,qs=242,Us=24,Fs=25,zs=.1;function It(r){let e=Math.max(0,Math.min(16383,Math.round(r*4)));return[qs,e&127,e>>7&127]}function oe(r,e){let t=Number(r);return Number.isFinite(t)?Math.max(0,Math.min(127,Math.round(t))):e}var Lt=class extends f{static properties={midiPort:{type:String,attribute:"midi-port"},channel:{type:Number},forwardNotes:{type:Boolean,attribute:"forward-notes"},sendClock:{type:Boolean,attribute:"send-clock"},sessionId:{type:String,attribute:"session-id",reflect:!0},availableMidiPorts:{attribute:!1},ports:{attribute:!1},sent:{type:Number,attribute:!1}};midi=fe();active=null;activeId="";bus=null;binding=null;tickTimer=null;nextTickTime=0;constructor(){super(),this.midiPort="",this.channel=0,this.forwardNotes=!0,this.sendClock=!1,this.sessionId="",this.availableMidiPorts=[],this.ports=[],this.sent=0}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-midi-output"),this.binding=q(this,this.onClockEvent,this.onRebind),this.bindSession(),this.refreshPorts()}disconnectedCallback(){super.disconnectedCallback(),this.teardown(),this.binding?.dispose(),this.binding=null}updated(e){e.has("sessionId")&&e.get("sessionId")!==void 0&&(this.bindSession(),this.binding?.rebind()),e.has("midiPort")&&e.get("midiPort")!==void 0&&this.connectByName(this.midiPort),(e.has("midiPort")||e.has("sendClock"))&&this.syncClockSending()}set(e){this.emitDetail("nbplay-set",{values:e})}status(e){this.emitDetail("nbplay-status",{values:e,save:!0})}channelNumber(){let e=Number(this.channel);return Number.isFinite(e)?Math.max(0,Math.min(15,Math.round(e))):0}async refreshPorts(){let e=await this.midi.requestAccess();this.ports=e?this.midi.outputs():[],e&&(this.availableMidiPorts=this.ports.map(t=>t.name),this.status({availableMidiPorts:this.availableMidiPorts}),this.midiPort&&!this.active&&this.connectByName(this.midiPort))}connectById(e){this.active=e?this.midi.output(e):null,this.activeId=this.active?e:""}connectByName(e){if((this.ports.find(n=>n.id===this.activeId)?.name??"")===e)return;let i=this.ports.find(n=>n.name===e);this.connectById(i?.id??""),this.requestUpdate()}onPortChange(e){e.stopPropagation(),this.allNotesOff();let t=e.detail.value;this.connectById(t);let i=this.ports.find(n=>n.id===t);this.midiPort=this.active?i?.name??t:"",this.set({midiPort:this.midiPort})}send(e,t){if(this.active)try{t===void 0?this.active.send(e):this.active.send(e,t),this.sent+=1}catch{}}allNotesOff(){this.send([176|this.channelNumber(),123,0])}timestampFor(e){let t=this.binding?.clock().context()||this.bus?.audioCtx;if(t)return performance.now()+Math.max(0,e-t.currentTime)*1e3}command(e){if(!e?.kind)return;let t=this.channelNumber();e.kind==="note_on"?this.send([144|t,oe(e.note,60),Math.max(1,oe(e.velocity,100))]):e.kind==="note_off"?this.send([128|t,oe(e.note,60),0]):e.kind==="control_change"?this.send([176|t,oe(e.controller,0),oe(e.value,0)]):e.kind==="raw"&&Array.isArray(e.data)&&this.send(e.data.map(i=>Math.max(0,Math.min(255,Math.round(Number(i)||0)))))}onNote=e=>{if(!this.forwardNotes)return;let t=this.channelNumber(),i=oe(e.note,60);if(e.type==="off"){this.send([128|t,i,0]);return}let n=Math.max(1,oe(e.velocity,100));if(e.at===void 0){this.send([144|t,i,n]);return}let s=this.timestampFor(e.at);if(this.send([144|t,i,n],s),e.duration!==void 0){let a=s===void 0?void 0:s+Math.max(0,e.duration)*1e3;this.send([128|t,i,0],a)}};onDocumentNote=e=>{this.onNote(e.detail)};unbindSession(){this.bus?.noteListeners&&(this.bus.noteListeners=this.bus.noteListeners.filter(e=>e!==this.onNote)),document.removeEventListener("nbplay-note",this.onDocumentNote),this.bus=null}bindSession(){this.unbindSession(),this.sessionId?(this.bus=Me(this.sessionId),this.bus.noteListeners||(this.bus.noteListeners=[]),this.bus.noteListeners.push(this.onNote)):document.addEventListener("nbplay-note",this.onDocumentNote)}sendsClock(){return!!this.sendClock&&!!this.midiPort}scheduleTicks=()=>{let e=this.binding.clock(),t=e.now(),i=e.secondsPerBeat()/Us,n=e.context(),s=n?performance.now()-n.currentTime*1e3:void 0;for(this.nextTickTime<t-.5&&(this.nextTickTime=t);this.nextTickTime<t+zs;)this.send([Os],s===void 0?void 0:s+this.nextTickTime*1e3),this.nextTickTime+=i};startTicks(e){this.tickTimer||(this.nextTickTime=e.now(),this.tickTimer=setInterval(this.scheduleTicks,Fs),this.scheduleTicks())}stopTicks(){this.tickTimer&&clearInterval(this.tickTimer),this.tickTimer=null}onClockEvent=e=>{let t=this.binding.clock();switch(e.type){case"play":if(!this.sendsClock())break;e.beat<.001?this.send([Vs]):(this.send(It(e.beat)),this.send([Nn])),this.startTicks(t);break;case"stop":this.tickTimer&&this.send([Ei]),this.stopTicks();break;case"seek":this.tickTimer&&this.send(It(e.beat));break;case"tempo":case"loop":case"record":case"timesig":break}};onRebind=e=>{this.stopTicks(),this.sendsClock()&&e.playing&&this.startTicks(e)};syncClockSending(){let e=this.binding?.clock();e&&(this.sendsClock()&&e.playing&&!this.tickTimer?(this.send(It(e.beat())),this.send([Nn]),this.startTicks(e)):!this.sendsClock()&&this.tickTimer&&(this.send([Ei]),this.stopTicks()))}teardown(){this.tickTimer&&this.send([Ei]),this.stopTicks(),this.allNotesOff(),this.unbindSession(),this.active=null,this.activeId=""}render(){let e=i=>i.stopPropagation(),t=(i,n,s)=>c`<label class="nbplay-midi-out-forward">
        <input
          type="checkbox"
          class=${i}
          .checked=${this[n]}
          @input=${e}
          @change=${a=>{a.stopPropagation(),this[n]=a.target.checked,this.set({[n]:this[n]})}}
        />
        ${s}
      </label>`;return c`<nbplay-header badge="midi output"></nbplay-header>
      <div class="nbplay-midi-out-row">
        <span class="nbplay-midi-out-label">Port</span>
        <nbplay-midi-port
          .ports=${this.ports.map(i=>({id:i.id,name:i.name}))}
          .value=${this.activeId}
          .status=${this.midiPort?"connected":"idle"}
          @input=${e}
          @change=${this.onPortChange}
          @nbplay-refresh=${i=>{i.stopPropagation(),this.refreshPorts()}}
        ></nbplay-midi-port>
      </div>
      <div class="nbplay-midi-out-row">
        <span class="nbplay-midi-out-label">Channel</span>
        <select
          class="nbplay-midi-out-channel"
          .value=${String(this.channelNumber())}
          @input=${e}
          @change=${i=>{i.stopPropagation(),this.allNotesOff(),this.channel=Number(i.target.value),this.set({channel:this.channel})}}
        >
          ${Array.from({length:16},(i,n)=>c`<option
                value=${n}
                ?selected=${n===this.channelNumber()}
                .textContent=${String(n+1)}
              ></option>`)}
        </select>
        ${t("nbplay-midi-out-forward-input","forwardNotes","Forward session notes")}
        ${t("nbplay-midi-out-clock-input","sendClock","Send clock")}
      </div>
      <div class="nbplay-midi-out-row">
        <span class="nbplay-midi-out-label">Sent</span>
        <span class="nbplay-midi-out-count">${this.sent} sent</span>
      </div>`}};v("nbplay-midi-output",Lt);var Hs=new Set(["automation_lanes","current_step","is_playing","voices_data"]);function Re(r,e,t){return Math.max(e,Math.min(t,r))}function F(r,e){let t=Number(r);return Number.isFinite(t)?t:e}function $i(r){return Math.max(.001,F(r.get("step_duration"),.25))}function Ks(r,e,t,i=[]){let n=r%2===1?e*.5*(Re(t,0,100)/100):0,s=i.length>0?e*(Re(F(i[r%i.length],0),-50,50)/100):0;return Re(n+s,e*-.5,e*.75)}function Si(r){return 440*Math.pow(2,(r-69)/12)}function Gs(r,e=Math.random){if(!r.active)return!1;let t=Re(F(r.probability,100),0,100);return t<=0?!1:t>=100?!0:e()*100<t}function*Zs(r,e,t=Math.random){for(let i of r){let n=i[e];!n||!Gs(n,t)||(yield{note:F(n.note,60),freq:Si(F(n.note,60)),velocity:Re(F(n.velocity,100),0,127)/127,durationTicks:Math.max(.001,F(n.duration_ticks,1))})}}function Ws(r,e){let t=(r.points||[]).filter(n=>Number.isFinite(n.step)&&Number.isFinite(n.value)&&n.step>=0).sort((n,s)=>n.step-s.step);if(t.length===0)return null;let i=null;for(let n of t)if(n.step<=e)i=n;else break;return(i||t[t.length-1]).value}function js(r,e){let t=r.get("automation_lanes")||[];for(let i of t){let n=typeof i?.trait=="string"?i.trait:"";if(!n||Hs.has(n))continue;let s=Ws(i,e);s!==null&&F(r.get(n),NaN)!==s&&r.set(n,s)}}function xi(r,e,t,i,n,s){let o=Math.min(.05,s*.2);try{let l=r.createOscillator(),u=r.createGain();return l.type="sine",l.frequency.value=t,u.gain.setValueAtTime(0,n),u.gain.linearRampToValueAtTime(i,n+.005),u.gain.linearRampToValueAtTime(0,n+s-o),l.connect(u),u.connect(e||r.destination),l.start(n),l.stop(n+s),l}catch{return null}}function Pn(r,e){let t=String(r.get("session_id")||""),i=F(r.get("channel_index"),-1),n=t&&i>=0&&N(t)?.channels?.[i]?.gain||null;return{ctx:e.context(),output:n}}function Ys(r){return r.get("voices_data")||[]}function Qs(r,e){return Math.ceil(r/e-1e-6)*e}function Xs(r,e,t,i=.1){let n=$i(r),s=e.secondsPerBeat(),a=e.beatAt(t),o=Math.floor(a/n+1e-6)*n,l=(a-o)*s<i?o:o+n;return{beat:l,time:t+(l-a)*s}}function Js(r,e,t){let i=$i(e),n=t.secondsPerBeat(),s=r.beat+i,a=r.time+i*n,o=t.loop;if(o.enabled&&o.endBeat>o.startBeat&&s>=o.endBeat-1e-9){let l=r.time+(o.endBeat-r.beat)*n;s=Qs(o.startBeat,i),a=l+(s-o.startBeat)*n}return{beat:s,time:a}}function er(r,e,t,i){let n=Math.max(1,e),s=n*t;if(i){let a=(r%s+s)%s;return Math.round(a/t)%n}return r<-1e-9||r>=s-1e-9?-1:Math.floor(r/t+1e-6)}var tr=6;function Dt(r={}){let e=null,t=null,i=null,n=null,s=null,a=.1,o=.025,l=r.random||Math.random,u=[];function b(y){let $=e?.currentTime??0;u.forEach(d=>{(y?d.at>$:d.until>$)&&d.cancel()}),u=y?u.filter(d=>d.at<=$):[]}function m(){n&&(clearInterval(n),n=null),b(!0),s=null,t=null,i=null}let p={start(y,$){let d=Pn(y,$);d.ctx&&(e=d.ctx,t=$,i=y,s=null,e.state==="suspended"&&e.resume(),n||(n=setInterval(()=>{h(y)},o*1e3)),h(y))},realign(){b(!0),s=null,n&&i&&h(i)},stop(){n&&(clearInterval(n),n=null),b(!1),s=null,t=null,i=null},destroy(){p.stop(),e=null},isPlaying(){return n!==null}};function h(y){let $=t;if(!e||!$)return;let d=e.currentTime;for(u=u.filter(E=>E.until>d),(!s||s.time<d-.5)&&(s=Xs(y,$,d));s.time<d+a;){if(!k(y,$,s))return;s=Js(s,y,$)}}function k(y,$,d){if(!e)return!0;let E=Ys(y),g=E[0]||[];if(E.length===0||g.length===0)return!0;let S=$i(y),A=er(d.beat,g.length,S,!!y.get("loop_enabled"));if(A<0)return m(),r.onEnd?.(),!1;y.set("current_step",A),js(y,A);let _=S*$.secondsPerBeat(),ye=Ks(A,_,F(y.get("swing"),0),y.get("groove")||[]),R=Math.max(0,d.time+ye),j=y.get("session_id")||"",L=F(y.get("channel_index"),-1),O=j&&L>=0?N(j)?.instruments?.[L]:void 0,Le=Pn(y,$).output;for(let{note:ce,freq:De,velocity:te,durationTicks:ge}of Zs(E,A,l)){let M=_*ge,V;if(O)V=O.scheduleNote(ce,Math.round(te*127),R,M)||void 0;else{let Gt=xi(e,Le,De,te,R,M);Gt&&(V=()=>{try{Gt.stop(0),Gt.disconnect()}catch{}})}V&&u.push({cancel:V,at:R,until:R+M+tr}),Pt(j,{note:ce,velocity:Math.round(te*127),type:"on",at:R,duration:_*ge})}return!0}return p}var An=[1,.5,.25,.125],ir=30,nr=300;function sr(){return{active:!1,note:60,velocity:100,duration_ticks:1,probability:100}}function Bn(r,e){return Math.max(0,r*(4/Math.max(1,e)))}function Tn(r,e,t,i){let n=Math.max(1,Math.round(r||1)),s=Math.max(.001,e||.25);return Math.max(1,Math.round(n*Bn(t,i)/s))}function rr(r,e){let t=r.slice(0,e).map(i=>({...i}));for(;t.length<e;)t.push(sr());return t}function ar(r,e,t){let i=Math.max(1,r.length||t||1);return Array.from({length:i},(n,s)=>rr(r[s]||[],e))}function Mn(r){return r.replace(/_([a-z])/g,(e,t)=>t.toUpperCase())}var Ot=class extends f{static properties={voicesData:{attribute:!1},numVoices:{type:Number,attribute:"num-voices"},length:{type:Number},measures:{type:Number},stepDuration:{type:Number,attribute:"step-duration"},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},bpm:{type:Number},loopEnabled:{type:Boolean,attribute:"loop-enabled"},keyboardConnected:{type:Boolean,attribute:"keyboard-connected"},followTransport:{type:Boolean,attribute:"follow-transport"},swing:{type:Number},groove:{attribute:!1},automationLanes:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},currentStep:{type:Number,attribute:!1}};binding=null;scheduler=Dt({onEnd:()=>this.onPatternEnd()});armed=new Set;cursor=null;pending=null;unbindShortcuts=null;applyingGrid=!1;shim={get:e=>this[Mn(e)],set:(e,t)=>{let i=Mn(e);this[i]=t,this.status(!1,{[i]:t})},save_changes:()=>{},on:()=>{}};constructor(){super(),this.voicesData=[],this.numVoices=1,this.length=16,this.measures=1,this.stepDuration=.25,this.timeSignatureNum=4,this.timeSignatureDen=4,this.bpm=120,this.loopEnabled=!0,this.keyboardConnected=!1,this.followTransport=!0,this.swing=0,this.groove=[],this.automationLanes=[],this.sessionId="",this.channelIndex=-1,this.isPlaying=!1,this.currentStep=-1}clock(){if(!this.binding){this.binding=q(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.isPlaying=e.playing,this.currentStep=-1,e.playing&&this.startScheduler()}return this.binding.clock()}shared(){return!!this.sessionId}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-sequencer"),this.tabIndex=0,this.reconcileGridWithData(),this.clock(),this.unbindShortcuts=J(this,{Space:()=>this.togglePlay(),"Shift+Space":()=>this.stopAndRewind(),ArrowLeft:()=>this.moveCursor(0,-1),ArrowRight:()=>this.moveCursor(0,1),ArrowUp:()=>this.moveCursor(-1,0),ArrowDown:()=>this.moveCursor(1,0),Enter:()=>this.toggleCursorStep(),x:()=>this.toggleCursorStep(),Escape:()=>{this.cancelPendingEdit(),this.cursor=null,this.requestUpdate()}}),this.addEventListener("nbplay-cancel-edit",this.onCancelEdit)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-note",this.onDocumentNote),this.removeEventListener("nbplay-cancel-edit",this.onCancelEdit),this.cancelPendingEdit(),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.scheduler.destroy(),this.binding?.dispose(),this.binding=null}set(e){this.emitDetail("nbplay-set",{values:e})}status(e,t){this.emitDetail("nbplay-status",{values:t,save:e})}startScheduler(){this.scheduler.isPlaying()||this.scheduler.start(this.shim,this.clock())}stopLocal(e){this.scheduler.stop(),this.isPlaying=!1,this.currentStep=-1,this.status(e,{isPlaying:!1,currentStep:-1})}onPatternEnd(){if(this.shared())this.stopLocal(!0);else{let e=this.clock();e.stop(),e.seek(0)}}onClockEvent=e=>{switch(e.type){case"play":if(this.followTransport===!1)break;this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0});break;case"stop":this.stopLocal(!0);break;case"seek":case"loop":this.scheduler.realign();break;case"tempo":{this.scheduler.realign();let t=this.clock().bpm;Number(this.bpm)!==t&&(this.bpm=t,this.set({bpm:t}));break}case"record":case"timesig":break}};joinTempo(e){let t=e.adoptTempo(Number(this.bpm));t!==Number(this.bpm)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.scheduler.stop(),this.joinTempo(e),this.currentStep=-1,e.playing&&this.followTransport!==!1&&this.startScheduler(),this.isPlaying=this.scheduler.isPlaying(),this.status(!1,{isPlaying:this.isPlaying,currentStep:-1})};updated(e){if(!this.binding)return;let t=e.has("sessionId")&&e.get("sessionId")!==void 0;t&&this.binding.rebind();let i=this.clock();e.has("bpm")&&!t&&Number(this.bpm)!==i.bpm&&i.setTempo(Number(this.bpm)),(e.has("measures")||e.has("stepDuration")||e.has("timeSignatureNum")||e.has("timeSignatureDen"))&&!this.applyingGrid&&[...e.keys()].some(n=>e.get(n)!==void 0)&&this.applyGrid({}),e.has("isPlaying")&&e.get("isPlaying")!==void 0&&this.onPlayStateChange(i),e.has("keyboardConnected")&&!this.keyboardConnected&&this.cancelPendingEdit()}onPlayStateChange(e){if(this.shared()){let t=this.scheduler.isPlaying();!!this.isPlaying!==t&&(this.isPlaying=t,this.status(!0,{isPlaying:t}));return}this.isPlaying?e.playing?this.startScheduler():e.play():(this.scheduler.stop(),e.stop())}voices(){return Array.isArray(this.voicesData)?this.voicesData:[]}actualLength(){return this.voices()[0]?.length||Number(this.length||0)||1}configuredLength(){return Tn(Number(this.measures||1),Number(this.stepDuration||.25),Number(this.timeSignatureNum||4),Number(this.timeSignatureDen||4))}reconcileGridWithData(){let e=this.actualLength();if(e===this.configuredLength())return;let i=Math.max(1,Number(this.measures||1))*Bn(Number(this.timeSignatureNum||4),Number(this.timeSignatureDen||4)),n=Math.max(.001,i/Math.max(1,e)),s=An.find(a=>Math.abs(a-n)<1e-4);this.length=e,this.stepDuration=s??n,this.status(!1,{length:this.length,stepDuration:this.stepDuration})}applyGrid(e){if(!this.applyingGrid){this.applyingGrid=!0;try{let t=w(Math.round(e.measures??Number(this.measures||1)),1,64),i=Math.max(.001,e.stepDuration??Number(this.stepDuration||.25)),n=Tn(t,i,Number(this.timeSignatureNum||4),Number(this.timeSignatureDen||4)),s=ar(this.voices(),n,Number(this.numVoices||1)),a=t!==this.measures||i!==this.stepDuration||n!==this.length||JSON.stringify(s)!==JSON.stringify(this.voicesData);this.measures=t,this.stepDuration=i,this.length=n,this.voicesData=s,a&&this.set({measures:t,stepDuration:i,length:n,voicesData:s})}finally{this.applyingGrid=!1}}}writeStep(e,t,i){let n=[...this.voices()],s=[...n[e]||[]];t>=s.length||(s[t]={...s[t],...i},n[e]=s,this.voicesData=n,this.set({voicesData:n}))}armedChanged(){this.armed.size>0?document.addEventListener("nbplay-note",this.onDocumentNote):document.removeEventListener("nbplay-note",this.onDocumentNote),this.requestUpdate()}onDocumentNote=e=>{let t=e.detail;if(!t||this.armed.size===0||t.type!=="on")return;let i=this.currentStep;if(i<0)return;let n=[...this.voices()];if(n.length===0)return;let s=!1;for(let a of this.armed){let o=[...n[a]||[]];a<n.length&&i<o.length&&(o[i]={...o[i],note:t.note,velocity:t.velocity,active:!0},n[a]=o,s=!0)}s&&(this.voicesData=n,this.set({voicesData:n}))};toggleArm(e,t){t??!this.armed.has(e)?this.armed.add(e):this.armed.delete(e),this.armedChanged()}toggleRecordAll(){this.armed.size>0?this.armed.clear():this.voices().forEach((e,t)=>this.armed.add(t)),this.armedChanged()}onPendingNote=e=>{let t=e.detail;if(t.type!=="on"||!this.pending)return;let{voice:i,step:n}=this.pending;this.cancelPendingEdit(),this.writeStep(i,n,{note:t.note,velocity:t.velocity,active:!0})};waitForNote(e,t){this.keyboardConnected&&(this.cancelPendingEdit(),this.pending={voice:e,step:t},this.focus(),document.addEventListener("nbplay-note",this.onPendingNote),this.requestUpdate())}cancelPendingEdit(){document.removeEventListener("nbplay-note",this.onPendingNote),this.pending&&(this.pending=null,this.requestUpdate())}onCancelEdit=()=>this.cancelPendingEdit();togglePlay(){let e=this.clock();this.isPlaying?this.shared()?this.stopLocal(!0):e.stop():e.playing?(this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0})):(e.play(),this.followTransport===!1&&(this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0})))}stopAndRewind(){let e=this.clock();e.playing?e.stop():this.stopLocal(!0),e.seek(0)}halt(){this.scheduler.stop(),this.shared()||this.clock().stop(),this.stopLocal(!1),this.armed.clear(),this.armedChanged()}moveCursor(e,t){let i=this.voices();if(i.length===0)return;let n=i[0].length,s=this.cursor?{voice:this.cursor.voice+e,step:this.cursor.step+t}:{voice:0,step:0};this.cursor={voice:w(s.voice,0,i.length-1),step:w(s.step,0,n-1)},this.requestUpdate()}toggleCursorStep(){if(!this.cursor){this.moveCursor(0,0);return}let{voice:e,step:t}=this.cursor,i=this.voices()[e]?.[t];i&&this.writeStep(e,t,{active:!i.active})}info(){let e=this.voices(),t=e[0]?.length||0,i=e.reduce((o,l)=>o+l.filter(u=>u.active).length,0),n=e.length>1?` \xB7 ${e.length} voices`:"",s=Math.max(1,Number(this.measures||1)),a=s===1?"1 measure":`${s} measures`;return`${i}/${t*e.length} steps active${n} \xB7 ${this.bpm} BPM \xB7 ${a} \xB7 ${this.actualLength()} steps`}render(){let e=n=>n.stopPropagation(),t=n=>{n.stopPropagation(),this.clock().setTempo(n.detail.value)},i=this.armed.size>0;return c`<nbplay-header badge="sequencer"></nbplay-header>
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
          class="nbplay-seq-btn nbplay-seq-rec ${i?"recording":""}"
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
          .min=${ir}
          .max=${nr}
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
            @change=${n=>{n.stopPropagation(),this.applyGrid({stepDuration:parseFloat(n.target.value)})}}
          >
            ${An.map(n=>c`<option
                  value=${n}
                  ?selected=${n===this.stepDuration}
                  .textContent=${`1/${4/n}`}
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
            @input=${n=>{n.stopPropagation();let s=parseInt(n.target.value,10);Number.isNaN(s)||this.applyGrid({measures:s})}}
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
            @change=${n=>{n.stopPropagation(),this.loopEnabled=n.target.checked,this.set({loopEnabled:this.loopEnabled})}}
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
        @change=${n=>{n.stopPropagation();let{voice:s,step:a,field:o,value:l}=n.detail;this.writeStep(s,a,{[o]:l})}}
        @nbplay-arm=${n=>{n.stopPropagation();let{voice:s,armed:a}=n.detail;this.toggleArm(s,a)}}
        @nbplay-step-pick=${n=>{n.stopPropagation();let{voice:s,step:a}=n.detail;this.waitForNote(s,a)}}
      ></nbplay-step-grid>
      <div class="nbplay-seq-footer">
        <span class="nbplay-seq-info">${this.info()}</span>
      </div>`}};v("nbplay-sequencer",Ot);var Rn=-2,ve=-1,or=25;function I(r,e){let t=Number(r);return Number.isFinite(t)?t:e}function _n(r){return JSON.stringify([r.voices_data,r.step_duration,r.swing,r.groove])}var Vt=class extends f{static properties={tracks:{attribute:!1},scenes:{attribute:!1},slots:{attribute:!1},quantize:{type:String},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},selectedSlot:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},activeSlots:{attribute:!1},queuedSlots:{attribute:!1}};states=[];binding=null;queueTimer=null;unbindShortcuts=null;progress=[];constructor(){super(),this.tracks=[],this.scenes=[],this.slots=[],this.quantize="bar",this.bpm=120,this.timeSignatureNum=4,this.selectedSlot={},this.sessionId="",this.isPlaying=!1,this.activeSlots=[],this.queuedSlots=[]}trackList(){return(this.tracks||[]).map((e,t)=>({name:String(e.name??`Track ${t+1}`),channel_index:I(e.channel_index,t)}))}sceneList(){return(this.scenes||[]).map(String)}slotList(){return(this.slots||[]).filter(e=>Array.isArray(e.voices_data)&&e.voices_data.length).map(e=>({track_index:I(e.track_index,0),scene_index:I(e.scene_index,0),name:String(e.name??"Clip"),voices_data:e.voices_data,step_duration:Math.max(.001,I(e.step_duration,.25)),swing:I(e.swing,0),groove:(e.groove||[]).map(t=>I(t,0))}))}findSlot(e,t){return this.slotList().find(i=>i.track_index===e&&i.scene_index===t)||null}beatsPerBar(){return Math.max(1,I(this.timeSignatureNum,4))}slotModel(e,t,i){return{get:n=>{switch(n){case"voices_data":return t.voices_data;case"step_duration":return t.step_duration;case"swing":return t.swing;case"groove":return t.groove;case"loop_enabled":return!0;case"automation_lanes":return[];case"session_id":return this.sessionId;case"channel_index":return e.channel_index;default:return}},set:(n,s)=>{n==="current_step"&&i(I(s,-1))},save_changes:()=>{},on:()=>{}}}clock(){if(!this.binding){this.binding=q(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.isPlaying=e.playing,this.activeSlots=this.trackList().map(()=>-1),this.queuedSlots=this.trackList().map(()=>Rn)}return this.binding.clock()}shared(){return!!this.sessionId}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-launcher"),this.tabIndex=0,this.clock(),this.ensureStates();let e={Space:()=>{let t=this.clock();t.playing?t.stop():t.play()},Escape:()=>this.stopAll(),0:()=>this.stopAll()};for(let t=1;t<=9;t++)e[String(t)]=()=>{if(t-1>=this.sceneList().length)return!1;this.launchScene(t-1)};this.unbindShortcuts=J(this,e)}disconnectedCallback(){super.disconnectedCallback(),this.stopQueueTimer(),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.states.forEach(e=>e.scheduler.destroy()),this.states.length=0,this.binding?.dispose(),this.binding=null}updated(e){if(!this.binding)return;let t=e.has("sessionId")&&e.get("sessionId")!==void 0;if(t&&this.binding.rebind(),e.has("bpm")&&e.get("bpm")!==void 0&&!t&&this.clock().setTempo(I(this.bpm,120)),e.has("tracks")&&e.get("tracks")!==void 0&&(this.trackList().length<this.states.length&&this.clearStates(),this.ensureStates(),this.mirrorSlotState(!0)),e.has("slots")&&e.get("slots")!==void 0&&(this.states.forEach((i,n)=>{if(i.activeScene<0||!this.clock().playing)return;let s=this.findSlot(n,i.activeScene);if(!s){this.stopNow(n);return}_n(s)!==i.activeData&&this.startSlot(n,i.activeScene)}),this.mirrorSlotState(!0)),e.has("isPlaying")&&e.get("isPlaying")!==void 0&&!this.shared()){let i=this.clock();this.isPlaying?i.playing||i.play():i.playing&&i.stop()}}set(e){this.emitDetail("nbplay-set",{values:e})}status(e,t){this.emitDetail("nbplay-status",{values:t,save:e})}ensureStates(){let e=this.trackList().length;for(;this.states.length<e;){let t=this.states.length;this.states.push({scheduler:Dt({onEnd:()=>this.stopNow(t)}),activeScene:-1,activeData:"",queued:null,currentStep:-1})}for(;this.states.length>e;)this.states.pop()?.scheduler.destroy()}clearStates(){this.states.forEach(e=>{e.scheduler.stop(),e.activeScene=-1,e.activeData="",e.queued=null,e.currentStep=-1})}mirrorSlotState(e){this.activeSlots=this.states.map(t=>t.activeScene),this.queuedSlots=this.states.map(t=>t.queued?t.queued.scene:Rn),this.syncProgress(),this.status(e,{activeSlots:this.activeSlots,queuedSlots:this.queuedSlots})}syncProgress(){this.progress=this.states.map((e,t)=>{if(e.activeScene<0||e.currentStep<0)return 0;let i=this.findSlot(t,e.activeScene)?.voices_data[0]?.length||0;return i>0?(e.currentStep+1)/i:0}),this.requestUpdate()}onClockEvent=e=>{switch(e.type){case"play":this.isPlaying=!0,this.status(!0,{isPlaying:!0}),this.startQueueTimer();break;case"stop":this.stopQueueTimer(),this.clearStates(),this.isPlaying=!1,this.status(!0,{isPlaying:!1}),this.mirrorSlotState(!0);break;case"tempo":{let t=this.clock().bpm;I(this.bpm,120)!==t&&(this.bpm=t,this.set({bpm:t})),this.states.forEach(i=>i.scheduler.realign()),this.requantize();break}case"seek":case"loop":this.states.forEach(t=>t.scheduler.realign()),this.requantize();break;case"record":case"timesig":break}};joinTempo(e){let t=e.adoptTempo(I(this.bpm,120));t!==I(this.bpm,120)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.states.forEach(t=>t.scheduler.stop()),this.joinTempo(e),this.isPlaying=e.playing,this.status(!1,{isPlaying:e.playing}),e.playing?this.resumeActive():this.clearStates(),this.syncProgress()};startSlot(e,t){this.ensureStates();let i=this.states[e],n=this.trackList()[e],s=this.findSlot(e,t);return!i||!n||!s?!1:(i.scheduler.stop(),i.activeScene=t,i.activeData=_n(s),i.currentStep=-1,this.clock().playing&&i.scheduler.start(this.slotModel(n,s,a=>{i.currentStep=a,this.syncProgress()}),this.clock()),!0)}stopNow(e){let t=this.states[e];t&&(t.scheduler.stop(),t.activeScene=-1,t.activeData="",t.currentStep=-1)}resumeActive(){this.ensureStates(),this.states.forEach((e,t)=>{e.activeScene>=0&&this.startSlot(t,e.activeScene)})}nextBoundary(e){let t=String(this.quantize||"bar");if(t==="none")return e;let i=t==="beat"?1:this.beatsPerBar(),n=Math.ceil(e/i-1e-6)*i;return Math.max(e,n)}boundaryTime(e,t,i){let n=e.loop,s=n.enabled&&n.endBeat>n.startBeat&&i>n.endBeat?n.endBeat:i;return e.now()+Math.max(0,s-t)*e.secondsPerBeat()}applyNow(e){e.scene>=0?this.startSlot(e.trackIndex,e.scene):this.stopNow(e.trackIndex),this.states[e.trackIndex].queued=null}applyLaunches(e){this.ensureStates();let t=e.filter(o=>this.states[o.trackIndex]);if(!t.length)return;let i=this.clock();if(!i.playing){t.some(o=>o.scene>=0)&&i.play(),t.forEach(o=>this.applyNow(o)),this.mirrorSlotState(!0);return}let n=i.beat(),s=this.nextBoundary(n);if(s<=n+1e-9){t.forEach(o=>this.applyNow(o)),this.mirrorSlotState(!0);return}let a=this.boundaryTime(i,n,s);t.forEach(o=>{this.states[o.trackIndex].queued={scene:o.scene,viaScene:o.viaScene,atBeat:s,atTime:a}}),this.startQueueTimer(),this.mirrorSlotState(!0)}queue(e,t){this.applyLaunches([{trackIndex:e,scene:t,viaScene:t}])}requantize(){let e=this.clock();if(!e.playing||!this.states.some(s=>s.queued))return;let t=e.beat(),i=this.nextBoundary(t),n=this.boundaryTime(e,t,i);this.states.forEach(s=>{s.queued&&(s.queued={...s.queued,atBeat:i,atTime:n})})}processQueue=()=>{let t=this.clock().now(),i=!1;this.states.forEach((n,s)=>{let a=n.queued;a&&t+1e-6>=a.atTime&&(n.queued=null,a.scene>=0?this.startSlot(s,a.scene):this.stopNow(s),i=!0)}),i&&this.mirrorSlotState(!0),this.states.some(n=>n.queued)||this.stopQueueTimer()};startQueueTimer(){this.queueTimer||!this.states.some(e=>e.queued)||(this.queueTimer=setInterval(this.processQueue,or),this.processQueue())}stopQueueTimer(){this.queueTimer&&(clearInterval(this.queueTimer),this.queueTimer=null)}launchScene(e){this.applyLaunches(this.trackList().map((t,i)=>({trackIndex:i,scene:this.findSlot(i,e)?e:ve,viaScene:e})))}stopAll(){this.applyLaunches(this.trackList().map((e,t)=>({trackIndex:t,scene:ve,viaScene:ve})))}command(e){let t=I(e.track_index,-1),i=I(e.scene_index,-1);switch(e.action){case"launch":t>=0&&i>=0&&this.queue(t,i);break;case"stop":t>=0&&this.queue(t,ve);break;case"scene":i>=0&&this.launchScene(i);break;case"stop_all":this.stopAll();break}}onSlot(e,t){this.findSlot(e,t)?(this.selectedSlot={track_index:e,scene_index:t},this.set({selectedSlot:this.selectedSlot}),this.queue(e,t)):this.queue(e,ve)}render(){let e=this.trackList(),t=typeof this.selectedSlot?.track_index=="number"&&typeof this.selectedSlot?.scene_index=="number"?{track:this.selectedSlot.track_index,scene:this.selectedSlot.scene_index}:null,i=n=>n.stopPropagation();return c`<nbplay-header badge="launcher">
        <label class="nbplay-launcher-field" title="Launch quantization">
          <span>Quantize</span>
          <select
            class="nbplay-launcher-quantize"
            .value=${this.quantize}
            @input=${i}
            @change=${n=>{n.stopPropagation(),this.quantize=n.target.value,this.set({quantize:this.quantize})}}
          >
            ${["bar","beat","none"].map(n=>c`<option
                  value=${n}
                  ?selected=${n===this.quantize}
                  .textContent=${n==="none"?"None":n[0].toUpperCase()+n.slice(1)}
                ></option>`)}
          </select>
        </label>
      </nbplay-header>
      <nbplay-launcher-grid
        .tracks=${e.map(n=>({name:n.name,detail:n.channel_index>=0?`Ch ${n.channel_index+1}`:"No channel"}))}
        .scenes=${this.sceneList()}
        .slots=${this.slotList().map(n=>({track:n.track_index,scene:n.scene_index,name:n.name}))}
        .active=${this.states.map(n=>n.activeScene)}
        .queued=${this.states.map(n=>n.queued?n.queued.scene>=0?n.queued.scene:Pe:-1)}
        .progress=${this.progress}
        .selected=${t}
        .playing=${this.isPlaying}
        @nbplay-launch=${n=>{n.stopPropagation();let{track:s,scene:a}=n.detail;this.onSlot(s,a)}}
        @nbplay-launch-scene=${n=>{n.stopPropagation(),this.launchScene(n.detail.scene)}}
        @nbplay-stop-track=${n=>{n.stopPropagation(),this.queue(n.detail.track,ve)}}
        @nbplay-stop-all=${n=>{n.stopPropagation(),this.stopAll()}}
      ></nbplay-launcher-grid>`}};v("nbplay-launcher",Vt);function Bi(r,e,t){return Math.max(e,Math.min(t,r))}function T(r,e,t,i,n){let s=r[e];if(s==null||s==="")return Bi(t,i,n);let a=Number(s);return Bi(Number.isFinite(a)?a:t,i,n)}function Z(r,e){r&&(r.value=e)}function W(r){try{r?.disconnect()}catch{}}function le(r){r.forEach(e=>{e.dispose?.(),W(e.input),e.output!==e.input&&W(e.output)}),r.length=0}function wi(r){if(!r||typeof r!="object")return!1;let e=r;return typeof e.connect=="function"&&typeof e.disconnect=="function"}function lr(r){if(!r)return null;if(typeof r=="object"&&("input"in r||"output"in r)){let e=r;if(wi(e.input)&&wi(e.output))return{input:e.input,output:e.output,dispose:typeof e.dispose=="function"?e.dispose:void 0,update:typeof e.update=="function"?e.update:void 0};throw new TypeError("effect plugin must return an AudioNode or { input, output } AudioNodes")}if(wi(r))return{input:r,output:r};throw new TypeError("effect plugin must return an AudioNode or { input, output } AudioNodes")}function In(r,e,t){let i=r.createGain(),n=r.createGain(),s=r.createGain(),a=r.createGain();s.gain.value=1-e,a.gain.value=e,i.connect(s),s.connect(n);let o=t(i,a);return a.connect(n),{input:i,output:n,setWet:l=>{s.gain.value=1-l,a.gain.value=l},dispose:()=>{[i,n,s,a,...o].forEach(W)}}}function cr(r,e,t){let i=Math.max(1,Math.floor(r.sampleRate*e)),n=r.createBuffer(2,i,r.sampleRate);for(let s=0;s<n.numberOfChannels;s++){let a=n.getChannelData(s);for(let o=0;o<i;o++){let l=o/i;a[o]=(Math.random()*2-1)*Math.pow(1-l,t)}}return n}function ur(r,e){switch(e.type){case"gain":{let t=r.createGain(),i=n=>(t.gain.value=T(n,"gain",1,0,4),!0);return i(e),{input:t,output:t,update:i}}case"filter":{let t=r.createBiquadFilter(),i=n=>(t.type=String(n.filter_type||"lowpass"),t.frequency.value=T(n,"frequency",1200,20,2e4),t.Q.value=T(n,"q",1,1e-4,100),!0);return i(e),{input:t,output:t,update:i}}case"compressor":{let t=r.createDynamicsCompressor(),i=n=>(Z(t.threshold,T(n,"threshold",-24,-100,0)),Z(t.knee,T(n,"knee",30,0,40)),Z(t.ratio,T(n,"ratio",12,1,20)),Z(t.attack,T(n,"attack",.003,0,1)),Z(t.release,T(n,"release",.25,0,1)),!0);return i(e),{input:t,output:t,update:i}}case"limiter":{let t=r.createDynamicsCompressor();Z(t.knee,0),Z(t.ratio,20),Z(t.attack,.001);let i=n=>(Z(t.threshold,T(n,"threshold",-1,-100,0)),Z(t.release,T(n,"release",.05,0,1)),!0);return i(e),{input:t,output:t,update:i}}case"delay":{let t=r.createDelay(5),i=r.createGain(),n=In(r,T(e,"wet",.35,0,1),(a,o)=>(a.connect(t),t.connect(i),i.connect(t),t.connect(o),[t,i])),s=a=>(t.delayTime.value=T(a,"time",.25,0,5),i.gain.value=T(a,"feedback",.25,0,.95),n.setWet(T(a,"wet",.35,0,1)),!0);return s(e),{...n,update:s}}case"reverb":{let t=r.createConvolver(),i=T(e,"seconds",1.5,.01,10),n=T(e,"decay",2,.01,12);t.buffer=cr(r,i,n);let s=In(r,T(e,"wet",.25,0,1),(o,l)=>(o.connect(t),t.connect(l),[t]));return{...s,update:o=>T(o,"seconds",1.5,.01,10)!==i||T(o,"decay",2,.01,12)!==n?!1:(s.setWet(T(o,"wet",.25,0,1)),!0)}}default:return null}}var dr=Object.fromEntries(G.map(r=>[r,ur]));function qt(){let r=globalThis,e=r.__nbplayPlugins&&typeof r.__nbplayPlugins=="object"?r.__nbplayPlugins:{},t=Object.create(null);return Object.entries(e).forEach(([i,n])=>{typeof n=="function"&&(t[i]=n)}),Object.assign(t,dr),t}function Ci(r,e=[]){let t=qt();return e.map(i=>{try{let n=Object.prototype.hasOwnProperty.call(t,i.type)?t[i.type]:void 0;return lr(n?.(r,i))}catch(n){return console.warn("nbplay mixer effect plugin failed",i.type,n),null}}).filter(i=>i!==null)}function Ni(r,e,t){let i=r;e.forEach(n=>{i.connect(n.input),i=n.output}),i.connect(t)}function Ln(r){return r==="filter"?{type:r,filter_type:"lowpass",frequency:1200,q:1}:r==="compressor"?{type:r,threshold:-24,knee:30,ratio:12,attack:.003,release:.25}:r==="limiter"?{type:r,threshold:-1,release:.05}:r==="delay"?{type:r,time:.25,feedback:.25,wet:.35}:r==="reverb"?{type:r,seconds:1.5,decay:2,wet:.25}:r==="gain"?{type:r,gain:1}:{type:r}}function Dn(r){return r.enabled!==!1}function Pi(r=[]){return r.filter(Dn).map(e=>({...e}))}function On(r){let{enabled:e,...t}=r;return Dn(r)?{...t,enabled:!1}:t}function Ai(r,e){return e.length?e[e.length-1].output:r}function Ti(r,e,t){if(r.length!==t.length||e.length!==t.length)return!1;for(let i=0;i<t.length;i++)if(e[i].type!==t[i].type)return!1;for(let i=0;i<t.length;i++){if(JSON.stringify(e[i])===JSON.stringify(t[i]))continue;let n=r[i].update;if(!n||!n(t[i]))return!1}return!0}function Mi(r,e){if(!r)return{peak:0,rms:0};r.getFloatTimeDomainData(e);let t=0,i=0;for(let n=0;n<e.length;n++){let s=Math.abs(e[n]);s>t&&(t=s),i+=e[n]*e[n]}return{peak:t,rms:Math.sqrt(i/Math.max(1,e.length))}}function Vn(){let r=null,e=null,t=[],i=[],n=null,s=!1,a=[],o=[],l=new Float32Array(256);function u(m){le(m.effects),m.input.disconnect(),m.gain.disconnect(),W(m.analyser)}function b(){if(!r?.createAnalyser)return null;let m=r.createAnalyser();return m.fftSize=256,m.smoothingTimeConstant=.6,m}return{init(m){if(r)return;let p=N(m);r=p?vn(p):D(),r&&(e=r.createGain(),e.connect(r.destination),n=b())},syncChannels(m,p,h=[],k=[]){if(!r||!e)return;for(;a.length<m.length;){let d=r.createGain(),E=r.createStereoPanner();d.connect(E),E.connect(e),a.push({gain:d,pan:E,effects:[],descriptors:[],analyser:b(),sends:[]});let g=a[a.length-1];g.analyser&&E.connect(g.analyser)}for(;a.length>m.length;){let d=a.pop();le(d.effects),d.gain.disconnect(),d.pan.disconnect(),d.sends.forEach(E=>E.disconnect()),W(d.analyser)}for(;o.length<k.length;){let d=r.createGain(),E=r.createGain();d.connect(E),E.connect(e);let g={input:d,gain:E,effects:[],descriptors:[],analyser:b()};g.analyser&&E.connect(g.analyser),o.push(g)}for(;o.length>k.length;)u(o.pop());o.forEach((d,E)=>{let g=Pi(k[E]?.effects);JSON.stringify(d.descriptors)!==JSON.stringify(g)&&(Ti(d.effects,d.descriptors,g)||(W(d.input),le(d.effects),d.effects=Ci(r,g),Ni(d.input,d.effects,d.gain)),d.descriptors=g),d.gain.gain.value=k[E].gain}),a.forEach((d,E)=>{let g=Pi(m[E]?.effects);if(d.descriptors.length===g.length&&JSON.stringify(d.descriptors)===JSON.stringify(g))return;if(Ti(d.effects,d.descriptors,g)){d.descriptors=g;return}W(d.pan),le(d.effects),d.effects=Ci(r,g),d.descriptors=g,Ni(d.pan,d.effects,e);let S=Ai(d.pan,d.effects);d.analyser&&S.connect(d.analyser),d.sends.forEach(A=>S.connect(A))}),a.forEach((d,E)=>{for(;d.sends.length>o.length;)d.sends.pop().disconnect();for(;d.sends.length<o.length;){let S=r.createGain();S.gain.value=0,Ai(d.pan,d.effects).connect(S),S.connect(o[d.sends.length].input),d.sends.push(S)}let g=m[E]?.sends||[];d.sends.forEach((S,A)=>{S.gain.value=Bi(Number(g[A])||0,0,1)})});let y=Pi(h);(!s||JSON.stringify(i)!==JSON.stringify(y))&&(s&&Ti(t,i,y)?i=y:(W(e),le(t),t=Ci(r,y),i=y,s=!0,Ni(e,t,r.destination),n&&Ai(e,t).connect(n)));let $=m.some(d=>d.solo);m.forEach((d,E)=>{let g=a[E],S=d.gain;(d.mute||$&&!d.solo)&&(S=0),g.gain.gain.value=S,g.pan.pan.value=d.pan}),e.gain.value=p},levels(){return r?{channels:a.map(m=>Mi(m.analyser,l)),returns:o.map(m=>Mi(m.analyser,l)),master:Mi(n,l)}:null},register(m){if(!r||!e)return;let p=Me(m);p.audioCtx=r,p.masterGain=e,p.channels=a,p.returns=o,Object.defineProperty(p,"plugins",{configurable:!0,enumerable:!0,get:qt}),document.dispatchEvent(new CustomEvent("nbplay-bus-ready",{detail:{sessionId:m}}))},destroy(m){let p=N(m);if(p&&(delete p.audioCtx,delete p.masterGain,delete p.channels,delete p.returns,delete p.plugins,Object.keys(p).length===0)){let h=globalThis;delete h.__nbplay[m]}a.forEach(h=>{le(h.effects),h.gain.disconnect(),h.pan.disconnect(),h.sends.forEach(k=>k.disconnect()),W(h.analyser)}),a.length=0,o.forEach(u),o.length=0,le(t),i=[],s=!1,W(n),n=null,e&&e.disconnect(),r&&r.state!=="closed"&&r.close(),r=null,e=null,t=[]}}}var pr=33,Ut=class extends f{static properties={channels:{attribute:!1,noAccessor:!0},returns:{attribute:!1,noAccessor:!0},masterGain:{type:Number,attribute:"master-gain",noAccessor:!0},masterEffects:{attribute:!1,noAccessor:!0},sessionId:{type:String,attribute:"session-id",reflect:!0}};graph={channels:[],returns:[],masterGain:.85,masterEffects:[]};bus=Vn();busReady=!1;meterFrame=null;lastMeterMs=0;constructor(){super(),this.sessionId=""}get channels(){return this.graph.channels}set channels(e){this.setGraph("channels",e)}get returns(){return this.graph.returns}set returns(e){this.setGraph("returns",e)}get masterGain(){return this.graph.masterGain}set masterGain(e){this.setGraph("masterGain",e)}get masterEffects(){return this.graph.masterEffects}set masterEffects(e){this.setGraph("masterEffects",e)}setGraph(e,t){let i=this.graph[e];this.graph[e]=t,this.requestUpdate(e,i),this.busReady&&this.syncBus()}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-mixer"),this.tabIndex=0,this.attach()}disconnectedCallback(){super.disconnectedCallback(),this.detach(this.sessionId)}updated(e){if(!e.has("sessionId"))return;let t=e.get("sessionId");t&&t!==this.sessionId&&this.detach(t),this.attach()}attach(){this.busReady||!this.sessionId||!this.isConnected||(this.bus.init(this.sessionId),this.busReady=!0,this.syncBus(),this.bus.register(this.sessionId),typeof requestAnimationFrame=="function"&&(this.meterFrame=requestAnimationFrame(this.meterTick)))}detach(e){this.meterFrame!==null&&cancelAnimationFrame(this.meterFrame),this.meterFrame=null,this.busReady=!1,e&&this.bus.destroy(e)}syncBus(){this.bus.syncChannels(this.channels||[],Number(this.masterGain),this.masterEffects||[],this.returns||[])}set(e){this.emitDetail("nbplay-set",{values:e})}applyLevel(e,t){if(!e)return;e.dataset.peak=t.peak.toFixed(3);let i=e.querySelector("nbplay-meter");i&&(i.level=t.peak,i.rms=t.rms)}meterTick=e=>{if(this.meterFrame=requestAnimationFrame(this.meterTick),e-this.lastMeterMs<pr||document.hidden)return;this.lastMeterMs=e;let t=this.bus.levels();if(!t)return;let i=this.querySelectorAll('nbplay-strip[kind="channel"]');t.channels.forEach((s,a)=>this.applyLevel(i[a]||null,s));let n=this.querySelectorAll('nbplay-strip[kind="return"]');t.returns.forEach((s,a)=>this.applyLevel(n[a]||null,s)),this.applyLevel(this.querySelector('nbplay-strip[kind="master"]'),t.master)};updateChannel(e,t,i){let n=[...this.channels||[]];e>=n.length||n[e][t]!==i&&(n[e]={...n[e],[t]:i},this.channels=n,this.set({channels:n}))}updateReturn(e,t,i){let n=[...this.returns||[]];e>=n.length||n[e][t]!==i&&(n[e]={...n[e],[t]:i},this.returns=n,this.set({returns:n}))}effectsFor(e,t){return e==="master"?this.masterEffects||[]:e==="return"?this.returns?.[t]?.effects||[]:this.channels?.[t]?.effects||[]}writeEffects(e,t,i){e==="master"?(this.masterEffects=i,this.set({masterEffects:i})):e==="return"?this.updateReturn(t,"effects",i):this.updateChannel(t,"effects",i)}onStripEdit(e,t,i){i.stopPropagation();let n=i.detail;if(n.field==="effect"){let s=n.index??-1,a=this.effectsFor(e,t);n.key==="enabled"?this.writeEffects(e,t,a.map((o,l)=>l===s?On(o):o)):n.value!==void 0&&this.writeEffects(e,t,a.map((o,l)=>l===s?{...o,[n.key]:n.value}:o));return}if(e==="master"){n.field==="gain"&&n.value!==this.masterGain&&(this.masterGain=n.value,this.set({masterGain:this.masterGain}));return}if(e==="return"){n.field==="gain"&&this.updateReturn(t,"gain",n.value);return}if(n.field==="send"){let s=this.channels?.[t],a=n.index??-1;if(!s||a<0)return;let o=Array.from({length:(this.returns||[]).length},(l,u)=>w(Number(s.sends?.[u])||0,0,1));o[a]=w(Number(n.value)||0,0,1),this.updateChannel(t,"sends",o);return}this.updateChannel(t,n.field,n.value)}onEffectAdd(e,t,i){i.stopPropagation();let n=i.detail.type;this.writeEffects(e,t,[...this.effectsFor(e,t),Ln(n)])}onEffectRemove(e,t,i){i.stopPropagation();let n=i.detail.index;this.writeEffects(e,t,this.effectsFor(e,t).filter((s,a)=>a!==n))}addChannel(){let e=[...this.channels||[]];e.push({name:"Ch "+(e.length+1),gain:.8,pan:0,mute:!1,solo:!1,effects:[]}),this.channels=e,this.set({channels:e})}removeChannel(e){let t=[...this.channels||[]];t.splice(e,1),this.channels=t,this.set({channels:t})}addReturn(){let e=this.returns||[],t=[...e,{name:`Return ${e.length+1}`,gain:.8,effects:[]}],i=(this.channels||[]).map(n=>({...n,sends:[...Array.from({length:e.length},(s,a)=>w(Number(n.sends?.[a])||0,0,1)),0]}));this.returns=t,this.channels=i,this.set({returns:t,channels:i})}removeReturn(e){let t=(this.returns||[]).filter((n,s)=>s!==e),i=(this.channels||[]).map(n=>({...n,sends:(n.sends||[]).filter((s,a)=>a!==e)}));this.returns=t,this.channels=i,this.set({returns:t,channels:i})}render(){let e=this.channels||[],t=this.returns||[],i=t.map(a=>a.name),n=[...G,...Object.keys(qt()).filter(a=>!G.includes(a))],s=(a,o,l,u)=>c`<nbplay-strip
        class=${l}
        kind=${a}
        data-index=${o}
        .name=${u.name}
        .gain=${u.gain}
        .pan=${u.pan??0}
        .mute=${!!u.mute}
        .solo=${!!u.solo}
        .sends=${u.sends??[]}
        .sendNames=${a==="channel"?i:[]}
        .effects=${u.effects??[]}
        .effectTypes=${n}
        @input=${b=>this.onStripEdit(a,o,b)}
        @change=${b=>this.onStripEdit(a,o,b)}
        @nbplay-effect-add=${b=>this.onEffectAdd(a,o,b)}
        @nbplay-effect-remove=${b=>this.onEffectRemove(a,o,b)}
        @nbplay-remove=${b=>{b.stopPropagation(),a==="channel"?this.removeChannel(o):a==="return"&&this.removeReturn(o)}}
      ></nbplay-strip>`;return c`<nbplay-header badge="mixer">
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
        ${e.map((a,o)=>s("channel",o,"nbplay-mixer-strip",{name:a.name,gain:a.gain,pan:a.pan,mute:a.mute,solo:a.solo,sends:t.map((l,u)=>w(Number(a.sends?.[u])||0,0,1)),effects:a.effects}))}
        ${t.map((a,o)=>s("return",o,"nbplay-mixer-strip nbplay-return-strip",{name:a.name,gain:a.gain,effects:a.effects}))}
        ${s("master",-1,"nbplay-mixer-strip nbplay-master-strip",{name:"Master",gain:Number(this.masterGain),effects:this.masterEffects})}
      </div>`}};v("nbplay-mixer",Ut);function z(r,e){let t=Number(r);return Number.isFinite(t)?Math.max(0,Math.min(127,Math.round(t))):e}function qn(r,e,t){return e>=r.note_low&&e<=r.note_high&&t>=r.velocity_low&&t<=r.velocity_high}function Un(r,e=2048){if(r.length<=e)return r.slice();let t=new Float32Array(e),i=r.length/e;for(let n=0;n<e;n++)t[n]=r[Math.floor(n*i)];return t}function Ft(r){let e=new ArrayBuffer(r.length*4),t=new DataView(e);for(let i=0;i<r.length;i++)t.setFloat32(i*4,r[i],!0);return t}function hr(r){let e=new Float32Array(r.length),t=Math.max(1,r.numberOfChannels);for(let i=0;i<t;i++){let n=r.getChannelData(i);for(let s=0;s<e.length;s++)e[s]+=n[s]/t}return e}async function _e(r){let e=D();if(!e)return null;try{let t=await e.decodeAudioData(r);return{samples:hr(t),sampleRate:t.sampleRate}}finally{e.state!=="closed"&&e.close()}}function Fn(r=8){let e=Math.max(1,Math.round(r||8)),t=null,i=null,n=!0,s=[],a=null,o=null,l=44100,u=[];function b(){if(!t||!o||o.length===0)return!1;if(a)return!0;a=t.createBuffer(1,o.length,l);let h=a.getChannelData(0);for(let k=0;k<o.length;k++)h[k]=o[k];return!0}function m(h){let k=s.indexOf(h);k>=0&&s.splice(k,1);try{h.gainNode.disconnect()}catch{}}function p(h){return!t||h.samples.length===0?null:(h.buffer||(h.buffer=t.createBuffer(1,h.samples.length,h.sample_rate),h.buffer.getChannelData(0).set(h.samples)),h.buffer)}return{setMaxVoices(h){e=Math.max(1,Math.round(Number(h)||8))},setSession(h,k){if(h&&k>=0){let y=N(h);if(y?.audioCtx&&y.channels?.[k]){t!==y.audioCtx&&(n&&t&&(this.stopAll(),t.state!=="closed"&&t.close()),a=null,u.forEach($=>$.buffer=null)),t=y.audioCtx,i=y.channels[k].gain,n=!1;return}}},setWaveformData(h,k){if(!(!h||h.length===0)){o=new Float32Array(h.length);for(let y=0;y<h.length;y++)o[y]=h[y];l=k,a=null,t||(t=D({sampleRate:k}),t&&(n=!0))}},setZones(h){u=h.map(k=>({...k,buffer:null})),!t&&u.length>0&&(t=D(),t&&(n=!0))},zoneFor(h,k){return u.find(y=>qn(y,h,k))},noteOn(h,k,y,$=127,d,E,g){let S=u.find(M=>qn(M,h,B($,127))),A=S?p(S):null;if(!t||!A&&!b())return;t.state==="suspended"&&t.resume();let _=h-(S?S.root_note:k),ye=Math.pow(2,_/12),R=t.createBufferSource();R.buffer=A||a,R.playbackRate.value=ye;let j=!A&&d!==void 0&&d.end>d.start&&d.start>=0&&d.end<=o.length;R.loop=!j&&!A;let L=t.createGain();L.connect(i||t.destination),R.connect(L);let O=E??t.currentTime,Le=Math.max(y.attack,.005),ce=B($,127)/127;if(L.gain.setValueAtTime(0,O),L.gain.linearRampToValueAtTime(ce,O+Le),L.gain.linearRampToValueAtTime(y.sustain*ce,O+Le+y.decay),j&&d){let M=d.start/l,V=(d.end-d.start)/l;R.start(O,M,V)}else R.start(O);let De=null;if(g!==void 0){let M=O+Math.max(.001,g);De=M;let V=L.gain;typeof V.cancelAndHoldAtTime=="function"?V.cancelAndHoldAtTime(M):(V.cancelScheduledValues(M),V.setValueAtTime(y.sustain*ce,M)),V.linearRampToValueAtTime(0,M+y.release),R.stop(M+y.release+.01)}let te={gainNode:L,sourceNode:R,noteNum:h,startTime:O,releaseTime:De};R.onended=()=>m(te),s.push(te);let ge=s.filter(M=>M.releaseTime===null);if(ge.length>e){let M=ge[0];M.releaseTime=O;try{M.sourceNode.stop(O)}catch{}}return te},noteOff(h,k){if(!t)return;let y=t.currentTime;s.filter(d=>d.noteNum===h&&d.releaseTime===null).forEach(d=>{d.releaseTime=y;let E=d.gainNode.gain.value;d.gainNode.gain.setValueAtTime(E,y),d.gainNode.gain.linearRampToValueAtTime(0,y+k.release),d.sourceNode.stop(y+k.release),setTimeout(()=>m(d),k.release*1e3+10)})},cancelVoice(h){try{h.sourceNode.stop(0)}catch{}m(h)},getActiveVoiceCount(){return s.filter(h=>h.releaseTime===null).length},stopAll(){if(!t)return;let h=t.currentTime;[...s].forEach(k=>{try{k.sourceNode.stop(h)}catch{}m(k)}),s.length=0},destroy(){this.stopAll(),n&&t&&t.state!=="closed"&&t.close(),t=null,i=null,n=!0}}}var mr=50;function zn(r,e){if(r===0)return"\u2014";let t=r/e;return t<1?(t*1e3).toFixed(0)+" ms":t.toFixed(2)+" s"}var zt=class extends f{static properties={sampleName:{type:String,attribute:"sample-name"},sampleRate:{type:Number,attribute:"sample-rate"},sampleLength:{type:Number,attribute:"sample-length"},rootNote:{type:Number,attribute:"root-note"},waveform:{attribute:!1},sampleData:{attribute:!1},attack:{type:Number},decay:{type:Number},sustain:{type:Number},release:{type:Number},maxVoices:{type:Number,attribute:"max-voices"},padCount:{type:Number,attribute:"pad-count"},padNotes:{attribute:!1},padVelocities:{attribute:!1},padActions:{attribute:!1},sampleSlices:{attribute:!1},velocity:{type:Number},velocitySensitive:{type:Boolean,attribute:"velocity-sensitive"},zones:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},activePads:{attribute:!1},lastNoteEvent:{attribute:!1},lastPadEvent:{attribute:!1},activeVoices:{type:Number,attribute:!1},zoneStatus:{type:String,attribute:!1},recording:{type:Boolean,attribute:!1}};engine=Fn();held=new Set;heldNotes=new Map;voiceTimer=null;registration=null;recorder=null;recorderStream=null;recorderChunks=[];capturePad=-1;constructor(){super(),this.sampleName="",this.sampleRate=44100,this.sampleLength=0,this.rootNote=60,this.waveform=null,this.sampleData=null,this.attack=.01,this.decay=.1,this.sustain=.7,this.release=.3,this.maxVoices=8,this.padCount=8,this.padNotes=[],this.padVelocities=[],this.padActions=[],this.sampleSlices=[],this.velocity=100,this.velocitySensitive=!0,this.zones=[],this.sessionId="",this.channelIndex=-1,this.activePads=[],this.lastNoteEvent={},this.lastPadEvent={},this.activeVoices=0,this.zoneStatus="",this.recording=!1}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-sampler"),this.engine.setMaxVoices(this.maxVoices),this.engine.setSession(this.sessionId,this.channelIndex),this.loadSample(),this.engine.setZones(this.zoneList()),this.fitPads(),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.register(),this.voiceTimer=setInterval(()=>{let e=this.engine.getActiveVoiceCount();e!==this.activeVoices&&(this.activeVoices=e)},mr)}disconnectedCallback(){super.disconnectedCallback(),this.voiceTimer&&clearInterval(this.voiceTimer),this.voiceTimer=null,this.stopZoneRecording(),this.recorderStream?.getTracks().forEach(e=>e.stop()),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.unregister(),this.engine.destroy()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&[...e.keys()].some(t=>e.get(t)!==void 0)&&this.register(),e.has("maxVoices")&&this.engine.setMaxVoices(this.maxVoices),(e.has("sampleData")||e.has("waveform")||e.has("sampleRate"))&&[...e.keys()].some(t=>e.get(t)!==void 0)&&this.loadSample(),e.has("zones")&&e.get("zones")!==void 0&&this.engine.setZones(this.zoneList()),(e.has("padNotes")||e.has("padCount"))&&[...e.keys()].some(t=>e.get(t)!==void 0)&&this.fitPads()}set(e){this.emitDetail("nbplay-set",{values:e})}status(){this.activePads=Array.from(this.held),this.emitDetail("nbplay-status",{values:{activePads:this.activePads,lastNoteEvent:this.lastNoteEvent,lastPadEvent:this.lastPadEvent},save:!0})}loadSample(){let e=H(this.waveform),t=H(this.sampleData);(t||e)&&this.engine.setWaveformData(t||e,Number(this.sampleRate))}envelope(){return{attack:Number(this.attack),decay:Number(this.decay),sustain:Number(this.sustain),release:Number(this.release)}}async loadFile(e){let t=await _e(await e.arrayBuffer());if(!t)return;let i=Un(t.samples);this.sampleName=e.name,this.sampleRate=t.sampleRate,this.sampleLength=t.samples.length,this.sampleData=Ft(t.samples),this.waveform=Ft(i),this.engine.setWaveformData(t.samples,t.sampleRate),this.set({sampleName:this.sampleName,sampleRate:this.sampleRate,sampleLength:this.sampleLength,sampleData:this.sampleData,waveform:this.waveform})}count(){return w(Number(this.padCount||8),1,32)}notes(){return ai((this.padNotes||[]).slice(),this.count())}velocities(){return He((this.padVelocities||[]).slice(),this.count(),Number(this.velocity))}actions(){return pe(this.padActions,this.notes(),this.velocities(),this.count())}slices(){return(this.sampleSlices||[]).map((e,t)=>({index:Number(e.index??t),note:Number(e.note),start:Math.max(0,Math.floor(Number(e.start)||0)),end:Math.max(0,Math.floor(Number(e.end)||0)),label:typeof e.label=="string"?e.label:void 0})).filter(e=>Number.isFinite(e.note)&&e.end>e.start)}sliceFor(e){if(e.type!=="note")return;let t=this.slices();return e.slice!==void 0?t.find(i=>i.index===e.slice):t.find(i=>i.note===e.note)}fitPads(){let e=this.notes(),t=this.velocities(),i={};e.length!==(this.padNotes||[]).length&&(this.padNotes=e,i.padNotes=e),t.length!==(this.padVelocities||[]).length&&(this.padVelocities=t,i.padVelocities=t),Object.keys(i).length&&this.emitDetail("nbplay-status",{values:i,save:!1})}pads(){let e=this.velocities();return this.actions().map((t,i)=>{let n=e[i]??100,a=this.sliceFor(t)?.label??(t.type==="note"&&!t.label?void 0:Ke(t));return a===void 0?{note:t.note,velocity:n}:{note:this.notes()[i]??60,velocity:n,label:a}})}triggerPad(e,t){let i=this.actions()[e];i&&(this.held.add(e),i.type==="note"?(this.heldNotes.set(e,i.note),this.engine.noteOn(i.note,Number(this.rootNote),this.envelope(),t,this.sliceFor(i)),this.lastNoteEvent={note:i.note,velocity:t,type:"on"},this.lastPadEvent={pad:e,event:"on",velocity:t,action:i}):(i.type==="trait"&&this.set({[i.trait]:i.value}),this.lastPadEvent={pad:e,event:"trigger",velocity:t,action:i}),this.status())}releasePad(e){if(!this.held.delete(e))return;let t=this.heldNotes.get(e),i=this.actions()[e];this.heldNotes.delete(e),t!==void 0&&(this.engine.noteOff(t,{release:Number(this.release)}),this.lastNoteEvent={note:t,velocity:0,type:"off"},i&&(this.lastPadEvent={pad:e,event:"off",velocity:0,action:i})),this.status()}onPadChange(e){e.stopPropagation();let{index:t,field:i,value:n}=e.detail;if(i==="note"){let s=this.notes();if(t>=s.length)return;s[t]=n;let a=this.actions().map((o,l)=>l===t&&o.type==="note"?{...o,note:n}:o);this.padNotes=s,this.padActions=a,this.set({padNotes:s,padActions:a})}else{let s=this.velocities();if(t>=s.length)return;s[t]=n,this.padVelocities=s,this.set({padVelocities:s})}}applyPadCount(e){if(Number.isNaN(e))return;let t=w(Math.round(e),1,32),i=ai((this.padNotes||[]).slice(),t),n=He((this.padVelocities||[]).slice(),t,Number(this.velocity)),s=pe(this.padActions,i,n,t);this.padCount=t,this.padNotes=i,this.padVelocities=n,this.padActions=s,this.set({padCount:t,padNotes:i,padVelocities:n,padActions:s})}onVelocity(e){e.stopPropagation();let t=B(e.detail.value);t!==this.velocity&&(this.velocity=t,this.padVelocities=He(this.velocities(),this.count(),t),this.set({velocity:t,padVelocities:this.padVelocities}))}zoneList(){return(this.zones||[]).map((e,t)=>({id:String(e.id??t),name:typeof e.name=="string"?e.name:`Zone ${t+1}`,note_low:z(e.note_low,0),note_high:z(e.note_high,127),velocity_low:z(e.velocity_low,0),velocity_high:z(e.velocity_high,127),root_note:z(e.root_note,60),sample_rate:Math.max(1,Number(e.sample_rate)||44100),samples:H(e.data)||new Float32Array(0)}))}writeZones(e){let t=e.map(i=>({id:i.id,name:i.name,note_low:i.note_low,note_high:i.note_high,velocity_low:i.velocity_low,velocity_high:i.velocity_high,root_note:i.root_note,sample_rate:i.sample_rate,length:i.samples.length,data:Ft(i.samples)}));this.zones=t,this.engine.setZones(e),this.set({zones:t})}addZone(e,t,i,n){let s=this.zoneList();s.push({id:Math.random().toString(36).slice(2,10),name:i,note_low:n.low,note_high:n.high,velocity_low:0,velocity_high:127,root_note:n.root,sample_rate:t,samples:e}),this.writeZones(s)}captureRange(){let e=this.capturePad;if(e>=0){let t=this.notes()[e];if(t!==void 0)return{low:t,high:t,root:t}}return{low:0,high:127,root:60}}onZoneChange(e){e.stopPropagation();let{index:t,field:i,value:n}=e.detail,s=this.zoneList(),a=s[t];if(a){if(i==="name")a.name=String(n).trim()||a.name;else if(i==="low"||i==="high"){let o=i==="low"?"note_low":"note_high",l=z(n,a[o]);a[o]=l,a.note_low>a.note_high&&(i==="low"?a.note_high=l:a.note_low=l)}else a.root_note=z(n,a.root_note);this.writeZones(s)}}async addZoneFromFile(e){let t=await _e(await e.arrayBuffer());t&&(this.addZone(t.samples,t.sampleRate,e.name,this.captureRange()),this.zoneStatus=`Added ${e.name}`)}async command(e){if(e?.url){this.zoneStatus="Capturing\u2026";try{let t=await fetch(e.url),i=await _e(await t.arrayBuffer());if(!i)throw new Error("Web Audio is unavailable");let n=i.samples,s=Math.max(0,Math.floor((e.offset||0)*i.sampleRate)),a=e.duration&&e.duration>0?Math.max(1,Math.round(e.duration*i.sampleRate)):n.length-s;(s>0||s+a<n.length)&&(n=n.slice(s,Math.min(n.length,s+a)));let o=z(e.note_low,0),l=z(e.note_high,127);this.addZone(n,i.sampleRate,e.name||"Take",{low:Math.min(o,l),high:Math.max(o,l),root:z(e.root_note,o)}),this.zoneStatus=`Captured ${e.name||"take"}`}catch(t){this.zoneStatus=`Capture failed: ${t instanceof Error?t.message:String(t)}`}}}async startZoneRecording(){let e=navigator,t=globalThis.MediaRecorder;if(!t||!e.mediaDevices?.getUserMedia){this.zoneStatus="Microphone recording is unavailable";return}try{this.recorderStream=await e.mediaDevices.getUserMedia({audio:!0})}catch(a){this.zoneStatus=`Microphone unavailable: ${a instanceof Error?a.message:String(a)}`;return}let i=this.captureRange(),n=`Take ${this.zoneList().length+1}`;this.recorderChunks=[];let s=new t(this.recorderStream);this.recorder=s,s.addEventListener("dataavailable",a=>{a.data&&a.data.size&&this.recorderChunks.push(a.data)}),s.addEventListener("stop",async()=>{let a=new Blob(this.recorderChunks,{type:s.mimeType||"audio/webm"});if(this.recorderChunks=[],this.recorderStream?.getTracks().forEach(l=>l.stop()),this.recorderStream=null,this.recorder=null,this.recording=!1,!a.size){this.zoneStatus="No audio was captured";return}let o=await _e(await a.arrayBuffer());o&&(this.addZone(o.samples,o.sampleRate,n,i),this.zoneStatus=`Captured ${n}`)}),s.start(),this.recording=!0,this.zoneStatus=`Recording ${n}\u2026`}stopZoneRecording(){this.recorder&&this.recorder.state!=="inactive"&&this.recorder.stop()}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.register()};unregister(){if(!this.registration)return;let{bus:e,idx:t,sampler:i,instrument:n}=this.registration;e.samplers?.[t]===i&&delete e.samplers[t],e.instruments?.[t]===n&&delete e.instruments[t],this.registration=null}register(){let e=this.sessionId,t=Number(this.channelIndex);if(this.unregister(),!e||t<0)return;let i=N(e);if(!i)return;this.engine.setSession(e,t);let n=i.samplers||{};i.samplers=n,n[t]={triggerNote:(a,o)=>{this.engine.noteOn(a,Number(this.rootNote),this.envelope(),o)},releaseNote:a=>{this.engine.noteOff(a,{release:Number(this.release)})}};let s=i.instruments||{};i.instruments=s,s[t]={scheduleNote:(a,o,l,u)=>{let b=this.slices().find(p=>p.note===a),m=this.engine.noteOn(a,Number(this.rootNote),this.envelope(),o,b,l,u);if(m)return()=>this.engine.cancelVoice(m)}},this.registration={bus:i,idx:t,sampler:n[t],instrument:s[t]}}silence(){this.engine.stopAll()}param(e,t,i,n,s,a,o,l,u="slider"){let b=m=>{m.stopPropagation();let p=m.detail.value;p!==this[i]&&(this[i]=p,this.set({[i]:p}))};return c`<nbplay-param
      class=${e}
      .label=${t}
      .kind=${n}
      .control=${u}
      .value=${Number(this[i])}
      .min=${s}
      .max=${a}
      .step=${o}
      .defaultValue=${l}
      @input=${b}
      @change=${b}
    ></nbplay-param>`}render(){let e=n=>n.stopPropagation(),t=this.notes(),i=this.zoneList();return c`<nbplay-header badge="sampler">
        <input
          type="file"
          class="nbplay-samp-file"
          accept="audio/*"
          @change=${n=>{n.stopPropagation();let s=n.target.files?.[0];s&&this.loadFile(s)}}
        />
        <span class="nbplay-samp-name">${this.sampleName}</span>
      </nbplay-header>
      <nbplay-waveform
        class="nbplay-samp-waveform"
        .data=${H(this.waveform)||H(this.sampleData)}
        empty-text="No sample loaded"
        @dragover=${n=>{n.preventDefault(),n.currentTarget.classList.add("drag-over")}}
        @dragleave=${n=>n.currentTarget.classList.remove("drag-over")}
        @drop=${n=>{n.preventDefault(),n.currentTarget.classList.remove("drag-over");let s=n.dataTransfer?.files?.[0];s&&this.loadFile(s)}}
      ></nbplay-waveform>
      <div class="nbplay-samp-info">
        <span class="nbplay-samp-info-rate"
          >${Number(this.sampleRate)/1e3} kHz</span
        >
        <span class="nbplay-samp-info-root"
          >${P(Number(this.rootNote))}</span
        >
        <span class="nbplay-samp-info-len"
          >${zn(Number(this.sampleLength),Number(this.sampleRate))}</span
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
              @input=${n=>{n.stopPropagation(),this.applyPadCount(parseInt(n.target.value,10))}}
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
              @change=${n=>{n.stopPropagation(),this.velocitySensitive=n.target.checked,this.set({velocitySensitive:this.velocitySensitive})}}
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
          @nbplay-note-on=${n=>{n.stopPropagation();let{index:s,velocity:a}=n.detail;this.triggerPad(s,a)}}
          @nbplay-note-off=${n=>{n.stopPropagation(),this.releasePad(n.detail.index)}}
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
            @change=${n=>{n.stopPropagation(),this.capturePad=Number(n.target.value)}}
          >
            <option value="-1" ?selected=${this.capturePad<0}>
              All notes
            </option>
            ${t.map((n,s)=>c`<option
                  value=${s}
                  ?selected=${s===this.capturePad}
                  .textContent=${`Pad ${s+1} (${P(n)})`}
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
              @change=${n=>{n.stopPropagation();let s=n.target,a=s.files?.[0];a&&(this.addZoneFromFile(a),s.value="")}}
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
          .zones=${i.map(n=>({low:n.note_low,high:n.note_high,name:n.name}))}
        ></nbplay-zone-map>
        <nbplay-zone-list
          .zones=${i.map(n=>({name:n.name,low:n.note_low,high:n.note_high,root:n.root_note,info:zn(n.samples.length,n.sample_rate)}))}
          @input=${e}
          @change=${this.onZoneChange}
          @nbplay-zone-remove=${n=>{n.stopPropagation();let s=this.zoneList();s.splice(n.detail.index,1),this.writeZones(s)}}
        ></nbplay-zone-list>
      </div>`}};v("nbplay-sampler",zt);var Ie=4096,br=.25,Hn=.1,Ri=6,fr=25,vr=50;function C(r,e){let t=Number(r);return Number.isFinite(t)?t:e}function _i(){let r=globalThis.crypto;return r?.randomUUID?`clip-${r.randomUUID()}`:`clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}function Ht(r){return r.start+Math.max(.001,r.duration)}function yr(r){return(r.events||[]).map(e=>({beat:Math.max(0,C(e.beat,0)),duration:Math.max(.001,C(e.duration,.25)),note:Math.max(0,Math.min(127,Math.round(C(e.note,60)))),velocity:Math.max(1,Math.min(127,Math.round(C(e.velocity,100))))})).sort((e,t)=>e.beat-t.beat||e.note-t.note)}function gr(r){return r?r instanceof DataView?new Uint8Array(r.buffer,r.byteOffset,r.byteLength):r instanceof ArrayBuffer?new Uint8Array(r):ArrayBuffer.isView(r)?new Uint8Array(r.buffer,r.byteOffset,r.byteLength):null:null}function Ii(r){if(r)try{r.disconnect()}catch{}}var Kt=class extends f{static properties={tracks:{attribute:!1},clips:{attribute:!1},length:{type:Number},selectedClipId:{type:String,attribute:"selected-clip-id"},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},countInBars:{type:Number,attribute:"count-in-bars"},autoExtendRecording:{type:Boolean,attribute:"auto-extend-recording"},recordingExtendBars:{type:Number,attribute:"recording-extend-bars"},pixelsPerBeat:{type:Number,attribute:"pixels-per-beat"},sessionId:{type:String,attribute:"session-id",reflect:!0},currentBeat:{type:Number,attribute:!1},exportClipId:{type:String,attribute:!1},importClipRequest:{attribute:!1},importClipData:{attribute:!1},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},isRecording:{type:Boolean,attribute:"is-recording",reflect:!0},recordingTrack:{type:Number,attribute:!1},recordingTracks:{attribute:!1},recordingCountdownBeats:{type:Number,attribute:!1},recordingError:{type:String,attribute:!1},recordedClip:{attribute:!1},exportedClip:{attribute:!1},exportedClipData:{attribute:!1},displayBeat:{type:Number,attribute:!1}};binding=null;unbindShortcuts=null;lanes=[];micStream=null;pendingClips=[];recordingStartMs=0;recordingStartBeat=0;recordingStopBeat=null;countInTimer=null;countInTick=null;recordingPending=!1;recordingGeneration=0;recordingStartedPlayback=!1;scheduledTimers=[];scheduledNotes=[];playheadTimer=null;midiTimer=null;midiCursorBeat=0;midiLastBeat=0;noteListenerActive=!1;suppressRestart=!1;disposed=!1;objectUrls=new Set;activeMedia=[];activeSources=[];constructor(){super(),this.tracks=[],this.clips=[],this.length=16,this.selectedClipId="",this.bpm=120,this.timeSignatureNum=4,this.countInBars=0,this.autoExtendRecording=!0,this.recordingExtendBars=8,this.pixelsPerBeat=0,this.sessionId="",this.currentBeat=0,this.exportClipId="",this.importClipRequest={},this.importClipData=null,this.isPlaying=!1,this.isRecording=!1,this.recordingTrack=-1,this.recordingTracks=[],this.recordingCountdownBeats=0,this.recordingError="",this.recordedClip={},this.exportedClip={},this.exportedClipData=null,this.displayBeat=null}trackList(){return(this.tracks||[]).map((e,t)=>({name:String(e.name??`Track ${t+1}`),channel_index:C(e.channel_index,t),armed:!!e.armed,muted:!!e.muted,solo:!!e.solo,input:e.input==="channel"||e.input==="midi"?e.input:"microphone",monitor:!!e.monitor}))}clipList(){return(this.clips||[]).map((e,t)=>({...e,id:String(e.id||`clip-${t}`),kind:e.kind==="midi"||Array.isArray(e.events)?"midi":"audio",events:e.kind==="midi"||Array.isArray(e.events)?yr(e):void 0,pattern:typeof e.pattern=="string"?e.pattern:void 0,name:String(e.name??`Clip ${t+1}`),track_index:Math.max(0,C(e.track_index,0)),start:Math.max(0,C(e.start,0)),duration:Math.max(.001,C(e.duration,4)),offset:Math.max(0,C(e.offset,0)),loop:!!e.loop,muted:!!e.muted}))}timelineLength(){return Math.max(1,Math.min(Ie,C(this.length,16)))}beatsPerBar(){return Math.max(1,C(this.timeSignatureNum,4))}clampBeat(e){return Math.max(0,Math.min(this.timelineLength(),e))}countInBeats(){return Math.max(0,C(this.countInBars,0))*this.beatsPerBar()}recordingExtendBeats(){return Math.max(1,C(this.recordingExtendBars,8))*this.beatsPerBar()}clock(){if(!this.binding){this.binding=q(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();if(this.joinTempo(e),!this.sessionId&&!e.playing){let t=this.clampBeat(C(this.currentBeat,0));Math.abs(t-e.beat())>1e-9&&e.seek(t)}this.isPlaying=e.playing,this.isRecording=!1,this.recordingTrack=-1,this.recordingTracks=[]}return this.binding.clock()}shared(){return!!this.sessionId}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-timeline"),this.disposed=!1,this.clock(),this.unbindShortcuts=J(this,{Space:()=>this.togglePlay(),"Shift+Space":()=>{this.clock().stop(),this.seekToBeat(0)},r:()=>this.toggleRecord(),l:()=>this.toggleLoop(),d:()=>this.duplicateSelectedClip(),Delete:()=>this.removeSelectedClip(),Backspace:()=>this.removeSelectedClip()}),this.clock().playing&&this.startPlayback(),this.handleExportRequest(),this.handleImportRequest()}disconnectedCallback(){super.disconnectedCallback(),this.disposed=!0,this.clearCountIn(),this.recordingGeneration+=1,this.recordingPending=!1,this.lanes.forEach(e=>{e.recorder&&e.recorder.state!=="inactive"&&e.recorder.stop()}),this.releaseLanes(),this.clearScheduledPlayback(),this.setNoteListener(!1),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.binding?.dispose(),this.binding=null,this.objectUrls.forEach(e=>URL.revokeObjectURL(e))}updated(e){if(!this.binding)return;let t=i=>e.has(i)&&e.get(i)!==void 0;t("sessionId")?this.binding.rebind():t("bpm")&&this.clock().setTempo(C(this.bpm,120)),t("isPlaying")&&this.onPlayStateWrite(),t("isRecording")&&this.onRecordStateWrite(),t("currentBeat")&&this.onPositionWrite(),t("exportClipId")&&this.handleExportRequest(),(t("importClipRequest")||t("importClipData"))&&this.handleImportRequest(),(e.has("clips")||e.has("tracks")||e.has("length"))&&this.syncLoopRange()}set(e){this.emitDetail("nbplay-set",{values:e})}status(e,t){this.emitDetail("nbplay-status",{values:e,save:t})}get context(){return this.clock().context()}beatNow(){return this.clampBeat(this.clock().beat())}recordersActive(){return this.lanes.some(e=>e.recording)}recordingActive(){return this.recordersActive()||!!this.countInTimer||this.recordingPending}setRecordingFlag(e){this.clock().setRecording(e),this.isRecording=e,this.status({isRecording:e},!1)}onClockEvent=e=>{let t=this.clock();switch(e.type){case"play":this.isPlaying=!0,this.status({isPlaying:!0},!0),this.startPlayback();break;case"stop":this.clearScheduledPlayback(),this.isPlaying=!1,this.currentBeat=this.clampBeat(e.beat),this.status({isPlaying:!1,currentBeat:this.currentBeat},!0),this.recordingActive()&&this.stopRecording();break;case"seek":this.displayBeat=null,this.currentBeat=this.clampBeat(e.beat),this.status({currentBeat:this.currentBeat},!1),t.playing&&!this.suppressRestart&&this.startPlayback();break;case"tempo":Number(this.bpm)!==t.bpm&&(this.bpm=t.bpm,this.set({bpm:t.bpm})),t.playing&&this.startPlayback();break;case"record":t.recording?this.recordingActive()||this.startRecording():this.recordingActive()&&this.stopRecording();break;case"loop":this.syncLoopRange();break;case"timesig":break}};joinTempo(e){let t=e.adoptTempo(C(this.bpm,120));t!==C(this.bpm,120)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.clearScheduledPlayback(),this.joinTempo(e),this.isPlaying=e.playing,this.status({isPlaying:e.playing},!1),e.playing&&this.startPlayback()};onPlayStateWrite(){let e=this.clock();this.shared()?!!this.isPlaying!==e.playing&&(this.isPlaying=e.playing,this.status({isPlaying:e.playing},!0)):this.isPlaying?e.playing||e.play():e.playing&&e.stop()}onRecordStateWrite(){this.shared()?!!this.isRecording!==this.clock().recording&&(this.isRecording=this.clock().recording,this.status({isRecording:this.isRecording},!0)):this.isRecording?this.recordingActive()||this.startRecording():this.recordingActive()&&this.stopRecording()}onPositionWrite(){let e=this.clock();if(!this.shared()&&!e.playing){let t=this.clampBeat(C(this.currentBeat,0));Math.abs(t-e.beat())>1e-9&&e.seek(t)}}togglePlay(){let e=this.clock();e.playing?e.stop():e.play()}toggleRecord(){this.recordingActive()||this.isRecording?this.stopRecording():this.startRecording()}clearCountIn(){this.countInTimer&&(clearTimeout(this.countInTimer),this.countInTimer=null),this.countInTick&&(clearInterval(this.countInTick),this.countInTick=null),this.recordingCountdownBeats=0,this.status({recordingCountdownBeats:0},!1)}stopMicStream(){this.micStream?.getTracks().forEach(e=>e.stop()),this.micStream=null}releaseLanes(){this.lanes.forEach(e=>{Ii(e.monitor),Ii(e.tap)}),this.lanes=[],this.pendingClips=[],this.stopMicStream(),this.setNoteListener(!1)}onDocumentNote=e=>{let t=e.detail;if(!t)return;let i=Math.round(C(t.note,-1));if(i<0||i>127)return;let n=Math.max(0,this.clock().beat()-this.recordingStartBeat);this.lanes.forEach(s=>{s.kind!=="midi"||!s.recording||(t.type==="on"&&C(t.velocity,0)>0?s.openNotes.set(i,{beat:n,velocity:Math.max(1,Math.min(127,Math.round(C(t.velocity,100))))}):this.closeLaneNote(s,i,n))})};closeLaneNote(e,t,i){let n=e.openNotes.get(t);n&&(e.openNotes.delete(t),e.events.push({beat:n.beat,duration:Math.max(.05,i-n.beat),note:t,velocity:n.velocity}))}setNoteListener(e){e!==this.noteListenerActive&&(this.noteListenerActive=e,e?document.addEventListener("nbplay-note",this.onDocumentNote):document.removeEventListener("nbplay-note",this.onDocumentNote))}finalizeMidiLane(e,t){let i=Math.max(0,t-this.recordingStartBeat);if([...e.openNotes.keys()].forEach(n=>this.closeLaneNote(e,n,i)),e.recording=!1,e.done=!0,e.events.length>0){let n=this.clipList().length+this.pendingClips.length+1;this.pendingClips.push({id:_i(),kind:"midi",name:`Take ${n}`,track_index:e.trackIndex,start:this.recordingStartBeat,duration:this.recordingDurationBeats(),loop:!1,muted:!1,recorded:!0,offset:0,source:"recording",events:[...e.events].sort((s,a)=>s.beat-a.beat||s.note-a.note)})}this.lanes.every(n=>n.done)&&this.finishRecording()}clearScheduledPlayback(){this.scheduledTimers.forEach(t=>clearTimeout(t)),this.scheduledTimers=[];let e=this.clock().now();this.scheduledNotes.forEach(t=>{t.until>e&&t.cancel()}),this.scheduledNotes=[],this.activeMedia.forEach(t=>{try{t.pause(),t.currentTime=0}catch{}}),this.activeMedia.length=0,this.activeSources.forEach(t=>Ii(t)),this.activeSources.length=0,this.playheadTimer&&(clearInterval(this.playheadTimer),this.playheadTimer=null),this.midiTimer&&(clearInterval(this.midiTimer),this.midiTimer=null),this.displayBeat=null}writeRecordingError(e){this.disposed||(this.clearCountIn(),this.releaseLanes(),this.recordingPending=!1,this.recordingGeneration+=1,this.recordingStartedPlayback=!1,this.recordingStopBeat=null,this.recordingError=e,this.setRecordingFlag(!1),this.recordingTrack=-1,this.recordingTracks=[],this.status({recordingError:e,isRecording:!1,recordingTrack:-1,recordingTracks:[]},!0))}findRecordingTracks(){let e=this.trackList(),t=e.map((n,s)=>n.armed?s:-1).filter(n=>n>=0);if(t.length>0)return t;let i=C(this.recordingTrack,-1);return i>=0&&i<e.length?[i]:e.length>0?[0]:[]}recordingDurationBeats(){if(this.recordingStopBeat!==null&&this.recordingStopBeat>this.recordingStartBeat)return Math.max(.25,this.recordingStopBeat-this.recordingStartBeat);let e=Math.max(.25,(performance.now()-this.recordingStartMs)/1e3),t=Math.max(1,C(this.bpm,120));return Math.max(.25,e*(t/60))}finalizeLane(e){let t=e.recorder?.mimeType||e.chunks[0]?.type||"audio/webm",i=new Blob(e.chunks,{type:t});if(e.chunks=[],e.recorder=null,e.recording=!1,e.done=!0,i.size&&typeof URL<"u"&&URL.createObjectURL){let n=URL.createObjectURL(i);this.objectUrls.add(n);let s=this.clipList().length+this.pendingClips.length+1;this.pendingClips.push({id:_i(),kind:"audio",name:`Take ${s}`,track_index:e.trackIndex,start:this.recordingStartBeat,duration:this.recordingDurationBeats(),loop:!1,muted:!1,recorded:!0,offset:0,audio_url:n,blob_type:i.type,blob_size:i.size,source:"recording",sample_rate:this.context?.sampleRate||44100})}this.lanes.every(n=>n.done)&&this.finishRecording()}finishRecording(){let e=this.pendingClips;if(this.pendingClips=[],this.releaseLanes(),this.recordingStartedPlayback=!1,this.recordingStopBeat=null,this.disposed)return;if(e.length===0){this.writeRecordingError("No audio was captured");return}let t=[...this.clipList(),...e],i=e[e.length-1];this.clips=t,this.recordedClip=i,this.selectedClipId=i.id,this.recordingError="",this.setRecordingFlag(!1),this.recordingTrack=-1,this.recordingTracks=[],this.recordingCountdownBeats=0,this.length=Math.max(C(this.length,16),...e.map(n=>Ht(n))),this.status({recordedClip:i,recordingError:"",isRecording:!1,recordingTrack:-1,recordingTracks:[],recordingCountdownBeats:0},!1),this.set({clips:t,selectedClipId:i.id,length:this.length})}startInputMonitoring(e,t){if(!e.monitor)return null;let i=N(this.sessionId),n=i?.audioCtx||this.context;if(!n?.createMediaStreamSource)return null;try{let s=n.createMediaStreamSource(t),a=i?.channels?.[e.channel_index]?.gain||i?.masterGain||n.destination;return s.connect(a),n.resume?.(),s}catch{return null}}channelTap(e){let t=N(this.sessionId),i=t?.audioCtx,n=t?.channels?.[e.channel_index]?.gain;if(!i?.createMediaStreamDestination||!n)return null;try{let s=i.createMediaStreamDestination();return n.connect(s),{stream:s.stream,node:s}}catch{return null}}ensurePlaybackStarted(){let e=this.clock();e.playing||(this.recordingStartedPlayback=!0,e.play())}beginRecording(e,t,i){i!==this.recordingGeneration||this.lanes.length===0||this.recordersActive()||(this.recordingPending=!1,this.recordingStartMs=performance.now(),this.recordingStartBeat=this.clampBeat(t),this.recordingStopBeat=null,this.pendingClips=[],this.lanes.forEach(n=>{if(n.chunks=[],n.events=[],n.openNotes.clear(),n.done=!1,n.recording=!0,n.kind==="midi"||!n.stream||!e)return;let s=new e(n.stream);s.addEventListener("dataavailable",a=>{a.data?.size&&n.chunks.push(a.data)}),s.addEventListener("stop",()=>this.finalizeLane(n),{once:!0}),n.recorder=s}),this.lanes.forEach(n=>n.recorder?.start()),this.lanes.some(n=>n.kind==="midi")&&this.setNoteListener(!0),this.recordingError="",this.recordingTrack=this.lanes[0].trackIndex,this.recordingTracks=this.lanes.map(n=>n.trackIndex),this.recordingCountdownBeats=0,this.setRecordingFlag(!0),this.ensurePlaybackStarted(),this.status({recordingError:"",recordingTrack:this.recordingTrack,recordingTracks:this.recordingTracks,recordingCountdownBeats:0,isRecording:!0},!0))}scheduleCountIn(e,t,i,n){let a=Math.max(1,C(this.bpm,120))/60,o=performance.now(),l=Math.max(0,i/a*1e3);this.recordingCountdownBeats=i,this.countInTick=setInterval(()=>{let u=(performance.now()-o)/1e3*a,b=Math.max(0,i-u);this.recordingCountdownBeats=b,this.status({recordingCountdownBeats:b},!1),b<=0&&this.countInTick&&(clearInterval(this.countInTick),this.countInTick=null)},50),this.countInTimer=setTimeout(()=>{if(this.countInTimer=null,this.countInTick&&(clearInterval(this.countInTick),this.countInTick=null),this.recordingCountdownBeats=0,this.status({recordingCountdownBeats:0},!1),this.disposed){this.releaseLanes();return}n===this.recordingGeneration&&this.beginRecording(e,t,n)},l)}async startRecording(){if(this.recordingActive())return;let e=this.findRecordingTracks();if(e.length===0){this.writeRecordingError("Add a track before recording");return}let t=this.trackList(),i=e.some(l=>t[l].input==="microphone"),n=e.some(l=>t[l].input!=="midi"),s=navigator,a=globalThis.MediaRecorder;if(n&&!a||i&&!s.mediaDevices?.getUserMedia){this.writeRecordingError(i?"Microphone recording is unavailable in this browser":"Recording is unavailable in this browser");return}let o=++this.recordingGeneration;this.recordingPending=!0,this.recordingError="",this.recordingTrack=e[0],this.recordingTracks=e,this.recordingCountdownBeats=0,this.setRecordingFlag(!0),this.status({recordingError:"",recordingTrack:e[0],recordingTracks:e,recordingCountdownBeats:0,isRecording:!0},!0);try{let l=null;if(i){if(l=await s.mediaDevices.getUserMedia({audio:!0}),this.disposed||o!==this.recordingGeneration||!this.recordingPending||!this.isRecording){l.getTracks().forEach(y=>y.stop()),o===this.recordingGeneration&&(this.recordingPending=!1);return}this.micStream=l}let u=[],b=(y,$)=>({trackIndex:y,kind:$,stream:null,recorder:null,recording:!1,chunks:[],events:[],openNotes:new Map,tap:null,monitor:null,done:!1});for(let y of e){let $=t[y];if($.input==="midi")u.push(b(y,"midi"));else if($.input==="channel"){let d=this.channelTap($);if(!d)throw new Error(`Mixer channel ${$.channel_index+1} is not available for recording`);u.push({...b(y,"audio"),stream:d.stream,tap:d.node})}else u.push({...b(y,"audio"),stream:l,monitor:this.startInputMonitoring($,l)})}this.lanes=u;let m=this.beatNow(),p=this.countInBeats(),h=p>0?Math.max(0,m-p):m,k=p>0?m>0?m-h:p:0;this.recordingCountdownBeats=k,p>0&&m>0&&(this.clock().seek(h),this.ensurePlaybackStarted()),this.status({recordingCountdownBeats:k},!0),k>0?this.scheduleCountIn(a,m,k,o):this.beginRecording(a,m,o)}catch(l){if(o!==this.recordingGeneration)return;this.releaseLanes(),this.recordingPending=!1,this.recordingStartedPlayback=!1,this.writeRecordingError(l instanceof Error?l.message:"Could not start recording")}}stopRecording(){if(this.clearCountIn(),!this.recordersActive()){this.recordingGeneration+=1,this.recordingPending=!1,this.setRecordingFlag(!1),this.recordingTrack=-1,this.recordingTracks=[],this.recordingCountdownBeats=0;let t=this.recordingStartedPlayback;this.recordingStartedPlayback=!1,this.releaseLanes(),this.status({isRecording:!1,recordingTrack:-1,recordingTracks:[],recordingCountdownBeats:0},!0),t&&this.clock().stop();return}this.recordingStopBeat=Math.max(this.recordingStartBeat,this.beatNow()),this.setNoteListener(!1);let e=this.recordingStopBeat;this.lanes.forEach(t=>{if(t.kind==="midi"){t.recording&&this.finalizeMidiLane(t,e);return}let i=t.recorder;i&&(i.state!=="inactive"?i.stop():this.finalizeLane(t))})}triggerMidiNote(e,t,i,n){let s=this.clock(),a=N(this.sessionId),o=a?.samplers?.[e.channel_index],l=a?.instruments?.[e.channel_index],u=t.duration*n;if(Pt(this.sessionId,{note:t.note,velocity:t.velocity,type:"on",at:i,duration:u}),l){let p=l.scheduleNote(t.note,t.velocity,i,u);if(p){this.scheduledNotes.push({cancel:p,until:i+u+Ri});let h=s.now();this.scheduledNotes=this.scheduledNotes.filter(k=>k.until>h)}return}if(o){let p=Math.max(0,(i-s.now())*1e3);this.scheduledTimers.push(setTimeout(()=>o.triggerNote(t.note,t.velocity),p)),this.scheduledTimers.push(setTimeout(()=>o.releaseNote(t.note),p+u*1e3)),this.scheduledNotes.push({cancel:()=>o.releaseNote(t.note),until:i+u+Ri});return}let b=s.context();if(!b)return;let m=xi(b,a?.channels?.[e.channel_index]?.gain||a?.masterGain||null,Si(t.note),t.velocity/127,i,u);m&&this.scheduledNotes.push({cancel:()=>{try{m.stop(0),m.disconnect()}catch{}},until:i+u+Ri})}scheduleMidi(e,t){let i=this.clock(),n=i.beat(),s=i.loop,a=s.enabled&&s.endBeat>s.startBeat;n<this.midiLastBeat-1e-6&&(this.midiCursorBeat=a&&n<s.endBeat?Math.min(n,s.startBeat):n),this.midiLastBeat=n;let o=i.secondsPerBeat(),l=n+Hn/o;a&&n<s.endBeat&&(l=Math.min(l,s.endBeat)),!(l<=this.midiCursorBeat)&&(e.forEach(u=>{let b=t[u.track_index];if(!b)return;let m=u.offset||0;(u.events||[]).forEach(p=>{let h=p.beat-m;if(h<0||h>=u.duration)return;let k=u.start+h;k<this.midiCursorBeat||k>=l||this.triggerMidiNote(b,p,i.now()+(k-n)*o,o)})}),this.midiCursorBeat=l)}startMidiPlayback(e){let t=this.trackList(),i=t.some(a=>a.solo),n=this.clipList().filter(a=>{let o=t[a.track_index];return a.kind==="midi"&&o&&!o.muted&&!(i&&!o.solo)&&!a.muted&&(a.events||[]).length>0});if(n.length===0)return;let s=Hn/this.clock().secondsPerBeat();this.midiCursorBeat=Math.max(0,e-s),this.midiLastBeat=e,this.scheduleMidi(n,t),this.midiTimer=setInterval(()=>this.scheduleMidi(n,t),fr)}connectMediaElement(e,t){let i=N(this.sessionId),n=i?.audioCtx||this.context;if(!(!n||!n.createMediaElementSource))try{let s=n.createMediaElementSource(e),a=i?.channels?.[t.channel_index]?.gain||i?.masterGain||n.destination;s.connect(a),this.activeSources.push(s)}catch{}}playClip(e,t){if(e.kind==="midi"||!e.audio_url||e.muted)return;let i=this.trackList()[e.track_index];if(!i||i.muted)return;let n=new Audio(e.audio_url);n.preload="auto",n.loop=!!e.loop,n.currentTime=Math.max(0,t),this.connectMediaElement(n,i),this.activeMedia.push(n),n.play().catch(()=>{})}maybeExtendTimelineForRecording(e){if(!this.isRecording||!this.autoExtendRecording)return!1;let t=this.beatsPerBar(),i=this.timelineLength();if(i>=Ie||e<i-t)return!1;let n=Math.max(t,this.recordingExtendBeats()),s=i;for(;e>=s-t&&s<Ie;)s=Math.min(Ie,s+n);return s<=i?!1:(this.length=s,this.set({length:s}),!0)}keepPlayheadVisible(e){let t=Math.max(0,C(this.pixelsPerBeat,0));if(t<=0)return;let i=this.querySelector(".nbplay-timeline-scroll"),n=this.querySelector(".nbplay-timeline-ruler-spacer");if(!i)return;let s=n?.offsetWidth||0,a=e*t,o=i.clientWidth-s;o<=0||(a<i.scrollLeft||a>i.scrollLeft+o)&&(i.scrollLeft=Math.max(0,a-o*.2))}startPlayback(){this.clearScheduledPlayback();let e=this.clock();e.context()?.resume?.();let t=this.timelineLength();if(e.beat()>=t){e.seek(0);return}let i=this.trackList(),n=i.some(l=>l.solo),s=this.clipList(),a=e.secondsPerBeat(),o=e.beat();this.displayBeat=o,this.startMidiPlayback(o),s.forEach(l=>{let u=i[l.track_index];if(l.kind==="midi"||!u||u.muted||n&&!u.solo||l.muted||Ht(l)<=o&&!l.loop)return;let b=l.start-o,m=Math.max(0,b*a*1e3),h=((l.loop&&o>l.start?(o-l.start)%Math.max(.001,l.duration):Math.max(0,o-l.start))+(l.offset||0))*a;this.scheduledTimers.push(setTimeout(()=>this.playClip(l,h),m))}),this.playheadTimer=setInterval(()=>{let l=e.beat();this.maybeExtendTimelineForRecording(l);let u=this.timelineLength();if(l>=u){this.displayBeat=u,this.clearScheduledPlayback(),e.stop(),e.seek(u);return}this.displayBeat=l,this.keepPlayheadVisible(l)},vr)}seekToBeat(e,t=!0,i=!0){if(this.recordingActive())return;let n=this.clampBeat(e),s=this.clock();s.playing&&!i&&this.clearScheduledPlayback(),this.suppressRestart=!i;try{s.seek(n)}finally{this.suppressRestart=!1}t&&this.status({},!0)}toggleLoop(){let e=this.clock(),t=e.loop;if(t.enabled){e.setLoop(!1,t.startBeat,t.endBeat);return}let i=this.beatsPerBar(),n=this.timelineLength(),s=t.endBeat>t.startBeat&&t.startBeat<n,a=s?t.startBeat:0,o=s?Math.min(n,t.endBeat):Math.min(n,4*i);e.setLoop(!0,a,Math.max(a+i,o))}syncLoopRange(){this.requestUpdate()}updateTrack(e,t){let i=this.trackList();e<0||e>=i.length||(i[e]={...i[e],...t},this.tracks=i,this.set({tracks:i}))}selectClip(e){this.selectedClipId=e,this.set({selectedClipId:e})}writeClips(e,t){let i={clips:e};this.clips=e,t!==void 0&&(this.selectedClipId=t,i.selectedClipId=t);let n=e.reduce((s,a)=>Math.max(s,Ht(a)),0);n>this.timelineLength()&&(this.length=Math.min(Ie,n),i.length=this.length),this.set(i)}removeSelectedClip(){let e=String(this.selectedClipId||"");e&&this.writeClips(this.clipList().filter(t=>t.id!==e),"")}duplicateSelectedClip(){let e=String(this.selectedClipId||""),t=this.clipList(),i=t.find(s=>s.id===e);if(!i)return;let n={...i,id:_i(),start:Ht(i)};this.writeClips([...t,n],n.id)}laneIndexAt(e){let t=this.querySelectorAll("nbplay-lane");for(let i of t){let n=i.getBoundingClientRect();if(e>=n.top&&e<=n.bottom)return C(i.dataset.track,-1)}return-1}onClipEdit(e){e.stopPropagation();let t=e.detail;if(t.field!=="clip")return;let i=this.laneIndexAt(t.clientY);this.writeClips(this.clipList().map(n=>n.id===t.id?{...n,start:t.start,duration:t.duration,offset:t.offset,track_index:i>=0?i:n.track_index}:n),t.id)}handleExportRequest(){if(this.disposed)return;let e=String(this.exportClipId||"");if(!e)return;let t=this.clipList().find(n=>n.id===e),i=n=>{this.disposed||(this.recordingError=n,this.exportClipId="",this.status({recordingError:n},!1),this.set({exportClipId:""}))};if(!t?.audio_url){i("Clip has no audio to export");return}fetch(t.audio_url).then(n=>n.blob()).then(async n=>{let s=await n.arrayBuffer();this.disposed||(this.exportedClip={...t,blob_type:n.type||t.blob_type||"",blob_size:n.size},this.exportedClipData=new DataView(s),this.status({exportedClip:this.exportedClip,exportedClipData:this.exportedClipData},!1),i(""))}).catch(n=>{i(`Export failed: ${n instanceof Error?n.message:String(n)}`)})}handleImportRequest(){if(this.disposed)return;let e=this.importClipRequest||{};if(!e.id)return;let t=gr(this.importClipData);if(!t||t.length===0||e.blob_size&&t.length!==e.blob_size)return;let i=new Blob([t.slice()],{type:e.blob_type||"audio/webm"}),n=URL.createObjectURL(i);this.objectUrls.add(n);let s=o=>{if(this.disposed)return;let l=this.clipList().map(u=>u.id===e.id?{...u,audio_url:n,blob_type:i.type,blob_size:i.size,duration:o??u.duration}:u);this.importClipRequest={},this.set({importClipRequest:{}}),this.writeClips(l)},a=this.context;if(e.measure_duration&&a?.decodeAudioData){let o=t.slice().buffer;Promise.resolve(a.decodeAudioData(o)).then(l=>{let u=C(l.duration,l.length/Math.max(1,l.sampleRate))||0,b=Math.max(1,C(this.bpm,120));s(u>0?Math.max(br,u*(b/60)):null)}).catch(()=>s(null));return}s(null)}render(){let e=this.trackList(),t=this.clipList(),i=this.timelineLength(),n=this.beatsPerBar(),s=Math.max(1,Math.ceil(i/n)),a=Math.max(0,C(this.pixelsPerBeat,0)),o=a>0?i*a:0,l=this.clampBeat(this.displayBeat??C(this.currentBeat,0)),u=!!this.isPlaying,b=!!this.isRecording,m=Math.max(0,C(this.recordingCountdownBeats,0)),p=this.binding?this.clock().loop:{enabled:!1,startBeat:0,endBeat:0},h=String(this.selectedClipId||""),k=(this.recordingTracks||[]).map(d=>C(d,-1)),y=d=>d.stopPropagation(),$=(d,E,g,S,A,_,ye,R)=>c`<label class="nbplay-timeline-field" title=${g}>
        <span>${E}</span>
        <input
          class=${d}
          type="number"
          min=${A}
          max=${_}
          step=${ye}
          .value=${String(S)}
          @input=${y}
          @change=${j=>{j.stopPropagation();let L=Number(j.target.value);R(w(Number.isFinite(L)?L:S,A,_))}}
        />
      </label>`;return c`<nbplay-header badge="timeline">
        <div class="nbplay-timeline-actions">
          ${$("nbplay-timeline-bars","Bars","Timeline length in bars",s,1,256,1,d=>{this.length=d*this.beatsPerBar(),this.set({length:this.length})})}
          ${$("nbplay-timeline-count-in","Count","Recording count-in in bars",Math.max(0,C(this.countInBars,0)),0,8,1,d=>{this.countInBars=d,this.set({countInBars:d})})}
          <label
            class="nbplay-timeline-field"
            title="Extend timeline while recording"
          >
            <span>Auto</span>
            <input
              class="nbplay-timeline-auto-extend"
              type="checkbox"
              .checked=${!!this.autoExtendRecording}
              @input=${y}
              @change=${d=>{d.stopPropagation(),this.autoExtendRecording=d.target.checked,this.set({autoExtendRecording:this.autoExtendRecording})}}
            />
          </label>
          ${$("nbplay-timeline-extend-bars","Ext","Bars to add while recording",Math.max(1,C(this.recordingExtendBars,8)),1,256,1,d=>{this.recordingExtendBars=d,this.set({recordingExtendBars:d})})}
          ${$("nbplay-timeline-zoom","Zoom","Zoom in pixels per beat (0 fits the width)",a,0,400,4,d=>{this.pixelsPerBeat=d,this.set({pixelsPerBeat:d})})}
          <button
            type="button"
            class="nbplay-timeline-loop-btn ${p.enabled?"active":""}"
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
            class="nbplay-timeline-play ${u?"active":""}"
            title=${u?"Stop timeline":"Play timeline"}
            @click=${()=>this.togglePlay()}
          >
            ${u?"\u25A0":"\u25B6"}
          </button>
          <button
            type="button"
            class="nbplay-timeline-record ${b?"active":""}"
            title=${b?"Stop recording":"Record armed tracks"}
            @click=${()=>this.toggleRecord()}
          >
            ${b&&m>0?Math.ceil(m):"\u25CF"}
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
        <div class="nbplay-timeline-position">${ee(l,n)}</div>
      </nbplay-header>
      <div class="nbplay-timeline-scroll ${a>0?"zoomed":""}">
        <div class="nbplay-timeline-ruler">
          <div class="nbplay-timeline-ruler-spacer"></div>
          <nbplay-ruler
            .length=${i}
            .beatsPerBar=${n}
            .beat=${l}
            .loopStart=${p.startBeat}
            .loopEnd=${p.endBeat}
            .loopEnabled=${p.enabled}
            .width=${o}
            .disabled=${this.recordingActive()}
            @nbplay-seek=${d=>{d.stopPropagation();let{beat:E,final:g}=d.detail;this.seekToBeat(E,g,g)}}
            @input=${d=>this.onLoopEdit(d)}
            @change=${d=>this.onLoopEdit(d)}
          ></nbplay-ruler>
        </div>
        <div class="nbplay-timeline-body">
          ${e.length?e.map((d,E)=>this.renderLane(d,E,t,i,n,l,o,h,k.includes(E))):c`<div class="nbplay-timeline-empty">No tracks</div>`}
        </div>
      </div>
      <div class="nbplay-timeline-status">
        ${String(this.recordingError||"")}
      </div>`}onLoopEdit(e){e.stopPropagation();let{field:t,value:i}=e.detail,n=this.clock(),s=n.loop;t==="loopStart"?n.setLoop(!0,i,s.endBeat):t==="loopEnd"&&n.setLoop(!0,s.startBeat,i)}renderLane(e,t,i,n,s,a,o,l,u){let b=e.channel_index>=0?`Ch ${e.channel_index+1}`:"No channel",m=i.filter(p=>p.track_index===t).map(p=>({id:p.id,name:p.name,start:p.start,duration:p.duration,offset:p.offset,kind:p.kind,pattern:!!p.pattern,muted:p.muted,detail:p.pattern?`${ee(p.start,s)} \xB7 pattern`:p.kind==="midi"?`${ee(p.start,s)} \xB7 ${(p.events||[]).length} notes`:ee(p.start,s)}));return c`<nbplay-lane
      data-track=${t}
      .name=${e.name}
      .armed=${e.armed}
      .monitor=${e.monitor}
      .muted=${e.muted}
      .solo=${e.solo}
      .input=${e.input}
      .inputs=${[{value:"microphone",label:"Mic"},{value:"channel",label:b,disabled:e.channel_index<0},{value:"midi",label:"MIDI"}]}
      .clips=${m}
      .length=${n}
      .beatsPerBar=${s}
      .beat=${a}
      .selected=${l}
      .recording=${u}
      .width=${o}
      .disabled=${!1}
      @nbplay-seek=${p=>{p.stopPropagation();let{beat:h,final:k}=p.detail;this.seekToBeat(h,k,k)}}
      @nbplay-clip-select=${p=>{p.stopPropagation(),this.selectClip(p.detail.id)}}
      @input=${p=>p.stopPropagation()}
      @change=${p=>{let h=p.detail;if(h.field==="clip"){this.onClipEdit(p);return}p.stopPropagation(),this.updateTrack(t,{[h.field]:h.value})}}
    ></nbplay-lane>`}};v("nbplay-timeline",Kt);function kr(r){return r.replace(/_([a-z])/g,(e,t)=>t.toUpperCase())}var Er=["Null","Bool","Int","Float","Str","Bytes","List","Map"];function Li(r){if(r==="Null")return null;if(typeof r=="object"&&r!==null){let e=Object.keys(r);if(e.length===1&&Er.includes(e[0])){let t=e[0],i=r[t];return t==="Null"?null:t==="List"?i.map(Li):t==="Map"?Object.fromEntries(Object.entries(i).map(([n,s])=>[n,Li(s)])):i}}return r}function $r(r,e){switch(r){case"is_playing":return{action:e?"play":"stop"};case"is_recording":return{action:"record",on:!!e};case"current_beat":return{action:"seek",beat:Number(e)};default:return null}}var Di=class extends HTMLElement{stop=null;get namespace(){return this.getAttribute("namespace")??"status"}set namespace(e){this.setAttribute("namespace",e)}connectedCallback(){let e={namespace:this.namespace};this.dispatchEvent(new CustomEvent("spaday:wire-request",{detail:e,bubbles:!0,composed:!0}));let t=e.wire,i=this.parentElement;!t||!i||(this.stop=t.client.onCommand(n=>{if(t.link.modelId!==void 0&&n.id!==t.link.modelId)return;let s=Li(n.value);if(typeof i.command=="function"){let a=$r(n.field,s)??(s&&typeof s=="object"&&!Array.isArray(s)?s:null);a&&i.command(a)}else{let a=kr(n.field);i[a]=s,i.dispatchEvent(new CustomEvent("nbplay-status",{detail:{values:{[a]:s},save:!0},bubbles:!0}))}t.client.ackCommand(n)}))}disconnectedCallback(){this.stop?.(),this.stop=null}};customElements.get("nbplay-wire")||customElements.define("nbplay-wire",Di);export{Di as NbplayWire,kr as camel,$r as statusCommand,Li as untag};
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
