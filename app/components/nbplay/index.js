var Je=globalThis,tt=Je.ShadowRoot&&(Je.ShadyCSS===void 0||Je.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,gn=Symbol(),vn=new WeakMap,et=class{constructor(e,t,i){if(this._$cssResult$=!0,i!==gn)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(tt&&e===void 0){let i=t!==void 0&&t.length===1;i&&(e=vn.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&vn.set(t,e))}return e}toString(){return this.cssText}},kn=r=>new et(typeof r=="string"?r:r+"",void 0,gn);var Sn=(r,e)=>{if(tt)r.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let t of e){let i=document.createElement("style"),n=Je.litNonce;n!==void 0&&i.setAttribute("nonce",n),i.textContent=t.cssText,r.appendChild(i)}},mi=tt?r=>r:r=>r instanceof CSSStyleSheet?(e=>{let t="";for(let i of e.cssRules)t+=i.cssText;return kn(t)})(r):r;var{is:Bs,defineProperty:Rs,getOwnPropertyDescriptor:Is,getOwnPropertyNames:_s,getOwnPropertySymbols:Ds,getPrototypeOf:Ls}=Object,it=globalThis,$n=it.trustedTypes,qs=$n?$n.emptyScript:"",Os=it.reactiveElementPolyfillSupport,Me=(r,e)=>r,bi={toAttribute(r,e){switch(e){case Boolean:r=r?qs:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,e){let t=r;switch(e){case Boolean:t=r!==null;break;case Number:t=r===null?null:Number(r);break;case Object:case Array:try{t=JSON.parse(r)}catch{t=null}}return t}},xn=(r,e)=>!Bs(r,e),En={attribute:!0,type:String,converter:bi,reflect:!1,useDefault:!1,hasChanged:xn};Symbol.metadata??=Symbol("metadata"),it.litPropertyMetadata??=new WeakMap;var ne=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=En){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let i=Symbol(),n=this.getPropertyDescriptor(e,i,t);n!==void 0&&Rs(this.prototype,e,n)}}static getPropertyDescriptor(e,t,i){let{get:n,set:s}=Is(this.prototype,e)??{get(){return this[t]},set(a){this[t]=a}};return{get:n,set(a){let o=n?.call(this);s?.call(this,a),this.requestUpdate(e,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??En}static _$Ei(){if(this.hasOwnProperty(Me("elementProperties")))return;let e=Ls(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(Me("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Me("properties"))){let t=this.properties,i=[..._s(t),...Ds(t)];for(let n of i)this.createProperty(n,t[n])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[i,n]of t)this.elementProperties.set(i,n)}this._$Eh=new Map;for(let[t,i]of this.elementProperties){let n=this._$Eu(t,i);n!==void 0&&this._$Eh.set(n,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let i=new Set(e.flat(1/0).reverse());for(let n of i)t.unshift(mi(n))}else e!==void 0&&t.push(mi(e));return t}static _$Eu(e,t){let i=t.attribute;return i===!1?void 0:typeof i=="string"?i:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let i of t.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Sn(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,i){this._$AK(e,i)}_$ET(e,t){let i=this.constructor.elementProperties.get(e),n=this.constructor._$Eu(e,i);if(n!==void 0&&i.reflect===!0){let s=(i.converter?.toAttribute!==void 0?i.converter:bi).toAttribute(t,i.type);this._$Em=e,s==null?this.removeAttribute(n):this.setAttribute(n,s),this._$Em=null}}_$AK(e,t){let i=this.constructor,n=i._$Eh.get(e);if(n!==void 0&&this._$Em!==n){let s=i.getPropertyOptions(n),a=typeof s.converter=="function"?{fromAttribute:s.converter}:s.converter?.fromAttribute!==void 0?s.converter:bi;this._$Em=n;let o=a.fromAttribute(t,s.type);this[n]=o??this._$Ej?.get(n)??o,this._$Em=null}}requestUpdate(e,t,i,n=!1,s){if(e!==void 0){let a=this.constructor;if(n===!1&&(s=this[e]),i??=a.getPropertyOptions(e),!((i.hasChanged??xn)(s,t)||i.useDefault&&i.reflect&&s===this._$Ej?.get(e)&&!this.hasAttribute(a._$Eu(e,i))))return;this.C(e,t,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:i,reflect:n,wrapped:s},a){i&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,a??t??this[e]),s!==!0||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||i||(t=void 0),this._$AL.set(e,t)),n===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[n,s]of this._$Ep)this[n]=s;this._$Ep=void 0}let i=this.constructor.elementProperties;if(i.size>0)for(let[n,s]of i){let{wrapped:a}=s,o=this[n];a!==!0||this._$AL.has(n)||o===void 0||this.C(n,void 0,s,o)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(t)):this._$EM()}catch(i){throw e=!1,this._$EM(),i}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};ne.elementStyles=[],ne.shadowRootOptions={mode:"open"},ne[Me("elementProperties")]=new Map,ne[Me("finalized")]=new Map,Os?.({ReactiveElement:ne}),(it.reactiveElementVersions??=[]).push("2.1.2");var $i=globalThis,Nn=r=>r,nt=$i.trustedTypes,Pn=nt?nt.createPolicy("lit-html",{createHTML:r=>r}):void 0,Bn="$lit$",ae=`lit$${Math.random().toFixed(9).slice(2)}$`,Rn="?"+ae,Vs=`<${Rn}>`,he=document,Re=()=>he.createComment(""),Ie=r=>r===null||typeof r!="object"&&typeof r!="function",Ei=Array.isArray,Fs=r=>Ei(r)||typeof r?.[Symbol.iterator]=="function",fi=`[ 	
\f\r]`,Be=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,wn=/-->/g,Cn=/>/g,de=RegExp(`>|${fi}(?:([^\\s"'>=/]+)(${fi}*=${fi}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),An=/'/g,Tn=/"/g,In=/^(?:script|style|textarea|title)$/i,xi=r=>(e,...t)=>({_$litType$:r,strings:e,values:t}),u=xi(1),Le=xi(2),Pa=xi(3),me=Symbol.for("lit-noChange"),x=Symbol.for("lit-nothing"),Mn=new WeakMap,pe=he.createTreeWalker(he,129);function _n(r,e){if(!Ei(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return Pn!==void 0?Pn.createHTML(e):e}var Us=(r,e)=>{let t=r.length-1,i=[],n,s=e===2?"<svg>":e===3?"<math>":"",a=Be;for(let o=0;o<t;o++){let l=r[o],c,h,p=-1,d=0;for(;d<l.length&&(a.lastIndex=d,h=a.exec(l),h!==null);)d=a.lastIndex,a===Be?h[1]==="!--"?a=wn:h[1]!==void 0?a=Cn:h[2]!==void 0?(In.test(h[2])&&(n=RegExp("</"+h[2],"g")),a=de):h[3]!==void 0&&(a=de):a===de?h[0]===">"?(a=n??Be,p=-1):h[1]===void 0?p=-2:(p=a.lastIndex-h[2].length,c=h[1],a=h[3]===void 0?de:h[3]==='"'?Tn:An):a===Tn||a===An?a=de:a===wn||a===Cn?a=Be:(a=de,n=void 0);let m=a===de&&r[o+1].startsWith("/>")?" ":"";s+=a===Be?l+Vs:p>=0?(i.push(c),l.slice(0,p)+Bn+l.slice(p)+ae+m):l+ae+(p===-2?o:m)}return[_n(r,s+(r[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),i]},_e=class r{constructor({strings:e,_$litType$:t},i){let n;this.parts=[];let s=0,a=0,o=e.length-1,l=this.parts,[c,h]=Us(e,t);if(this.el=r.createElement(c,i),pe.currentNode=this.el.content,t===2||t===3){let p=this.el.content.firstChild;p.replaceWith(...p.childNodes)}for(;(n=pe.nextNode())!==null&&l.length<o;){if(n.nodeType===1){if(n.hasAttributes())for(let p of n.getAttributeNames())if(p.endsWith(Bn)){let d=h[a++],m=n.getAttribute(p).split(ae),g=/([.?@])?(.*)/.exec(d);l.push({type:1,index:s,name:g[2],strings:m,ctor:g[1]==="."?vi:g[1]==="?"?gi:g[1]==="@"?ki:Se}),n.removeAttribute(p)}else p.startsWith(ae)&&(l.push({type:6,index:s}),n.removeAttribute(p));if(In.test(n.tagName)){let p=n.textContent.split(ae),d=p.length-1;if(d>0){n.textContent=nt?nt.emptyScript:"";for(let m=0;m<d;m++)n.append(p[m],Re()),pe.nextNode(),l.push({type:2,index:++s});n.append(p[d],Re())}}}else if(n.nodeType===8)if(n.data===Rn)l.push({type:2,index:s});else{let p=-1;for(;(p=n.data.indexOf(ae,p+1))!==-1;)l.push({type:7,index:s}),p+=ae.length-1}s++}}static createElement(e,t){let i=he.createElement("template");return i.innerHTML=e,i}};function ke(r,e,t=r,i){if(e===me)return e;let n=i!==void 0?t._$Co?.[i]:t._$Cl,s=Ie(e)?void 0:e._$litDirective$;return n?.constructor!==s&&(n?._$AO?.(!1),s===void 0?n=void 0:(n=new s(r),n._$AT(r,t,i)),i!==void 0?(t._$Co??=[])[i]=n:t._$Cl=n),n!==void 0&&(e=ke(r,n._$AS(r,e.values),n,i)),e}var yi=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:i}=this._$AD,n=(e?.creationScope??he).importNode(t,!0);pe.currentNode=n;let s=pe.nextNode(),a=0,o=0,l=i[0];for(;l!==void 0;){if(a===l.index){let c;l.type===2?c=new De(s,s.nextSibling,this,e):l.type===1?c=new l.ctor(s,l.name,l.strings,this,e):l.type===6&&(c=new Si(s,this,e)),this._$AV.push(c),l=i[++o]}a!==l?.index&&(s=pe.nextNode(),a++)}return pe.currentNode=he,n}p(e){let t=0;for(let i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(e,i,t),t+=i.strings.length-2):i._$AI(e[t])),t++}},De=class r{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,i,n){this.type=2,this._$AH=x,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=i,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=ke(this,e,t),Ie(e)?e===x||e==null||e===""?(this._$AH!==x&&this._$AR(),this._$AH=x):e!==this._$AH&&e!==me&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):Fs(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==x&&Ie(this._$AH)?this._$AA.nextSibling.data=e:this.T(he.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:i}=e,n=typeof i=="number"?this._$AC(e):(i.el===void 0&&(i.el=_e.createElement(_n(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===n)this._$AH.p(t);else{let s=new yi(n,this),a=s.u(this.options);s.p(t),this.T(a),this._$AH=s}}_$AC(e){let t=Mn.get(e.strings);return t===void 0&&Mn.set(e.strings,t=new _e(e)),t}k(e){Ei(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,i,n=0;for(let s of e)n===t.length?t.push(i=new r(this.O(Re()),this.O(Re()),this,this.options)):i=t[n],i._$AI(s),n++;n<t.length&&(this._$AR(i&&i._$AB.nextSibling,n),t.length=n)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let i=Nn(e).nextSibling;Nn(e).remove(),e=i}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},Se=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,i,n,s){this.type=1,this._$AH=x,this._$AN=void 0,this.element=e,this.name=t,this._$AM=n,this.options=s,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=x}_$AI(e,t=this,i,n){let s=this.strings,a=!1;if(s===void 0)e=ke(this,e,t,0),a=!Ie(e)||e!==this._$AH&&e!==me,a&&(this._$AH=e);else{let o=e,l,c;for(e=s[0],l=0;l<s.length-1;l++)c=ke(this,o[i+l],t,l),c===me&&(c=this._$AH[l]),a||=!Ie(c)||c!==this._$AH[l],c===x?e=x:e!==x&&(e+=(c??"")+s[l+1]),this._$AH[l]=c}a&&!n&&this.j(e)}j(e){e===x?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},vi=class extends Se{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===x?void 0:e}},gi=class extends Se{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==x)}},ki=class extends Se{constructor(e,t,i,n,s){super(e,t,i,n,s),this.type=5}_$AI(e,t=this){if((e=ke(this,e,t,0)??x)===me)return;let i=this._$AH,n=e===x&&i!==x||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,s=e!==x&&(i===x||n);n&&this.element.removeEventListener(this.name,this,i),s&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},Si=class{constructor(e,t,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){ke(this,e)}};var zs=$i.litHtmlPolyfillSupport;zs?.(_e,De),($i.litHtmlVersions??=[]).push("3.3.3");var Dn=(r,e,t)=>{let i=t?.renderBefore??e,n=i._$litPart$;if(n===void 0){let s=t?.renderBefore??null;i._$litPart$=n=new De(e.insertBefore(Re(),s),s,void 0,t??{})}return n._$AI(r),n};var Ni=globalThis,oe=class extends ne{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Dn(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return me}};oe._$litElement$=!0,oe.finalized=!0,Ni.litElementHydrateSupport?.({LitElement:oe});var Hs=Ni.litElementPolyfillSupport;Hs?.({LitElement:oe});(Ni.litElementVersions??=[]).push("4.2.2");var v=class extends oe{constructor(){super(),this.theme=""}createRenderRoot(){return this}emit(e,t){this.emitDetail(e,{value:t})}emitDetail(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}};v.createProperty("theme",{type:String,attribute:"data-nbplay-theme",reflect:!0,converter:{fromAttribute:r=>r??"",toAttribute:r=>r||null}});function k(r,e){customElements.get(r)||customElements.define(r,e)}function N(r,e,t){return Math.min(t,Math.max(e,r))}function be(r,e){if(!(e>0))return r;let t=Math.max(0,Math.ceil(-Math.log10(e)));return Number((Math.round(r/e)*e).toFixed(t))}function V(r,e,t){return getComputedStyle(r).getPropertyValue(e).trim()||t}function z(r){let e=globalThis,t=e.AudioContext||e.webkitAudioContext;if(!t)return null;try{return new t(r)}catch{try{return new t}catch{return null}}}function le(r,e){r.tabIndex<0&&(r.tabIndex=0);function t(i){let n=i.target,s=n?.tagName;if(s==="INPUT"||s==="TEXTAREA"||s==="SELECT"||n?.isContentEditable||i.ctrlKey||i.metaKey||i.altKey)return;let a=i.key===" "?"Space":i.key.length===1?i.key.toLowerCase():i.key,o=i.shiftKey&&a.length>1?`Shift+${a}`:a,l=e[o]??(i.shiftKey?e[a]:void 0);l&&l()!==!1&&(i.preventDefault(),i.stopPropagation())}return r.addEventListener("keydown",t),()=>r.removeEventListener("keydown",t)}function X(r){if(!r||!r.byteLength)return null;if(r instanceof DataView){let e=r.byteLength/4,t=new Float32Array(e);for(let i=0;i<e;i++)t[i]=r.getFloat32(i*4,!0);return t}if(r.buffer instanceof ArrayBuffer){let e=r;return new Float32Array(e.buffer.slice(e.byteOffset,e.byteOffset+e.byteLength))}return r instanceof ArrayBuffer?new Float32Array(r):null}function Ln(r){return r<=0?-1/0:20*Math.log10(r)}function Ks(r){return Math.pow(10,r/20)}function Pi(r){if(r<=0)return"\u2212\u221E dB";let e=20*Math.log10(r);return e>=0?"+"+e.toFixed(1)+" dB":e.toFixed(1)+" dB"}function qn(r){return Math.abs(r)<.01?"C":r<0?"L"+Math.round(Math.abs(r)*100):"R"+Math.round(r*100)}function On(r){let e=r.replace(/\s*db\s*$/i,"").trim();if(e==="\u2212\u221E"||e==="-inf"||e==="-Infinity")return 0;let t=parseFloat(e);if(isNaN(t))return null;let i=Ks(t);return Math.max(0,Math.min(2,Math.round(i*1e3)/1e3))}var Gs=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];function J(r,e=60){let t=Number(r);return Number.isFinite(t)?Math.max(0,Math.min(127,Math.round(t))):e}function O(r,e=100){let t=Number(r);return Number.isFinite(t)?Math.max(1,Math.min(127,Math.round(t))):e}function _(r){let e=J(r),t=Math.floor(e/12)-1;return Gs[e%12]+t}function st(r){let e=r.trim(),t=Number.parseInt(e,10);if(String(t)===e&&t>=0&&t<=127)return t;let i=e.match(/^([A-Ga-g])([#b]?)\s*(-?\d+)$/);if(!i)return null;let s={c:0,d:2,e:4,f:5,g:7,a:9,b:11}[i[1].toLowerCase()];if(s===void 0)return null;let a=s;i[2]==="#"&&(a+=1),i[2]==="b"&&(a-=1);let l=(Number.parseInt(i[3],10)+1)*12+a;return l>=0&&l<=127?l:null}function wi(r,e,t=48){let i=Math.max(1,Math.min(128,Math.round(e||1))),n=r.slice(0,i).map(a=>J(a)),s=n.length>0?n[n.length-1]+1:t;for(;n.length<i;)n.push(J(s)),s+=1;return n}function rt(r,e,t=100){let i=Math.max(1,Math.min(128,Math.round(e||1))),n=r.slice(0,i).map(s=>O(s,t));for(;n.length<i;)n.push(O(t));return n}function Ws(r){return typeof r=="string"&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(r)}function js(r,e,t){let i={type:"note",note:J(e),velocity:O(t)};if(!r||typeof r!="object")return i;let n=r,s=typeof n.label=="string"?n.label:void 0;if(n.type==="trait"&&Ws(n.trait)){let l=n.value;if(typeof l=="number"||typeof l=="boolean"||typeof l=="string")return{type:"trait",trait:n.trait,value:l,label:s}}if(n.type==="event")return{type:"event",label:s,value:n.value};let a={type:"note",note:J(n.note,e),velocity:O(n.velocity,t),label:s},o=Number(n.slice);return Number.isInteger(o)&&o>=0&&(a.slice=o),a}function $e(r,e,t,i){let n=Array.isArray(r)?r:[],s=[],a=Math.max(1,Math.round(i||e.length||1));for(let o=0;o<a;o++)s.push(js(n[o],e[o]??e[e.length-1]??60,t[o]??t[t.length-1]??100));return s}function at(r){return r.label?r.label:r.type==="note"?_(r.note):r.type==="trait"?r.trait:"event"}function Ci(r,e,t=2,i=""){switch(e){case"int":return`${Math.round(r)}${i}`;case"db":return Pi(r);case"pan":return qn(r);case"hz":return r>=1e3?(r/1e3).toFixed(2)+" kHz":r.toFixed(1)+" Hz";case"bpm":return`${Math.round(r)} BPM`;case"seconds":return r<.01?(r*1e3).toFixed(1)+" ms":r<1?(r*1e3).toFixed(0)+" ms":r.toFixed(2)+" s";case"percent":return(r*100).toFixed(0)+"%";case"note":return _(r);default:return`${r.toFixed(t)}${i}`}}function Ai(r,e,t=2){switch(e){case"int":case"bpm":return String(Math.round(r));case"db":return Pi(r).replace(" dB","");case"pan":return String(Math.round(r*100)/100);case"percent":return(r*100).toFixed(0);case"note":return _(r);case"float":return r.toFixed(t);default:return String(r)}}function Ti(r,e){let t=r.trim();if(!t)return null;switch(e){case"db":return On(t);case"note":return st(t);case"int":case"bpm":{let i=parseInt(t,10);return Number.isNaN(i)?null:i}case"percent":{let i=parseFloat(t);return Number.isFinite(i)?i>1?i/100:i:null}case"hz":{let i=parseFloat(t);return Number.isFinite(i)?/k/i.test(t)?i*1e3:i:null}default:{let i=parseFloat(t);return Number.isFinite(i)?i:null}}}var Vn=r=>r.stopPropagation(),ot=class extends v{static properties={value:{type:Number},kind:{type:String},min:{type:Number},max:{type:Number},precision:{type:Number},unit:{type:String},editable:{type:Boolean},editing:{type:Boolean,reflect:!0}};constructor(){super(),this.value=0,this.kind="float",this.min=-1/0,this.max=1/0,this.precision=2,this.unit="",this.editable=!0,this.editing=!1}get text(){return Ci(this.value,this.kind,this.precision,this.unit)}render(){return this.editing?u`<input
        type="text"
        class="nbplay-value-input"
        .value=${Ai(this.value,this.kind,this.precision)}
        @keydown=${this.onKeydown}
        @blur=${this.commit}
        @input=${Vn}
        @change=${Vn}
      />`:u`<span
      class="nbplay-value-text"
      title=${this.editable?"Double-click to edit":x}
      @dblclick=${this.startEdit}
      >${this.text}</span
    >`}startEdit(){!this.editable||this.editing||(this.editing=!0,this.updateComplete.then(()=>{let e=this.querySelector("input");e?.focus(),e?.select()}))}onKeydown(e){e.key==="Enter"?(e.preventDefault(),this.commit()):e.key==="Escape"&&(this.editing=!1)}commit(){if(!this.editing)return;let e=this.querySelector("input");if(this.editing=!1,!e)return;let t=Ti(e.value,this.kind);if(t===null)return;let i=N(t,this.min,this.max);i!==this.value&&(this.value=i,this.emit("change",i))}};k("nbplay-value",ot);var lt=class extends v{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},orientation:{type:String,reflect:!0},scale:{type:String},disabled:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};internal=null;constructor(){super(),this.value=0,this.min=0,this.max=1,this.step=.01,this.defaultValue=null,this.orientation="horizontal",this.scale="linear",this.disabled=!1,this.dragging=!1}willUpdate(e){e.has("value")&&this.dragging&&this.internal!==null&&this.value!==this.internal&&(this.value=this.internal)}toPos(e){if(this.scale!=="log")return e;let t=Math.log(this.min),i=Math.log(this.max);return(Math.log(Math.max(e,this.min))-t)/(i-t)}fromPos(e){if(this.scale!=="log")return e;let t=Math.log(this.min),i=Math.log(this.max);return Math.exp(t+e*(i-t))}render(){let e=this.scale==="log";return u`<input
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
    />`}readValue(e){let t=parseFloat(e.target.value);return N(be(this.fromPos(t),this.step),this.min,this.max)}onInput(e){e.stopPropagation(),this.value=this.readValue(e),this.dragging&&(this.internal=this.value),this.emit("input",this.value)}onChange(e){e.stopPropagation(),this.endDrag(),this.emit("change",this.value)}reset(){if(this.disabled||this.defaultValue===null)return;this.endDrag();let e=N(this.defaultValue,this.min,this.max);e!==this.value&&(this.value=e,this.emit("input",e)),this.emit("change",this.value)}startDrag(){this.disabled||(this.dragging=!0,this.internal=this.value)}endDrag(){this.dragging=!1,this.internal=null}};k("nbplay-slider",lt);var Fn=270,qe=-135,Un=150;function Mi(r,e){let t=(r-90)*Math.PI/180;return[50+e*Math.cos(t),50+e*Math.sin(t)]}function zn(r,e,t){let[i,n]=Mi(r,t),[s,a]=Mi(e,t),o=e-r>180?1:0;return`M ${i} ${n} A ${t} ${t} 0 ${o} 1 ${s} ${a}`}var ct=class extends v{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},disabled:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};startY=0;startValue=0;constructor(){super(),this.value=0,this.min=0,this.max=1,this.step=.01,this.defaultValue=null,this.disabled=!1,this.dragging=!1}connectedCallback(){super.connectedCallback(),this.hasAttribute("tabindex")||(this.tabIndex=0),this.setAttribute("role","slider"),this.addEventListener("pointerdown",this.onPointerDown),this.addEventListener("pointermove",this.onPointerMove),this.addEventListener("pointerup",this.onPointerUp),this.addEventListener("lostpointercapture",this.onPointerUp),this.addEventListener("wheel",this.onWheel,{passive:!1}),this.addEventListener("keydown",this.onKeydown),this.addEventListener("dblclick",this.onDblclick)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("pointerdown",this.onPointerDown),this.removeEventListener("pointermove",this.onPointerMove),this.removeEventListener("pointerup",this.onPointerUp),this.removeEventListener("lostpointercapture",this.onPointerUp),this.removeEventListener("wheel",this.onWheel),this.removeEventListener("keydown",this.onKeydown),this.removeEventListener("dblclick",this.onDblclick)}updated(){this.setAttribute("aria-valuemin",String(this.min)),this.setAttribute("aria-valuemax",String(this.max)),this.setAttribute("aria-valuenow",String(this.value)),this.setAttribute("aria-disabled",String(this.disabled))}fraction(){return this.max>this.min?N((this.value-this.min)/(this.max-this.min),0,1):0}render(){let e=qe+this.fraction()*Fn,[t,i]=Mi(e,30);return u`<svg
      class="nbplay-dial-svg"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      ${Le`<path class="nbplay-dial-track" d=${zn(qe,qe+Fn,40)} />`}
      ${Le`<path class="nbplay-dial-arc" d=${zn(qe,Math.max(e,qe+.01),40)} />`}
      ${Le`<circle class="nbplay-dial-cap" cx="50" cy="50" r="30" />`}
      ${Le`<line class="nbplay-dial-indicator" x1="50" y1="50" x2=${t} y2=${i} />`}
    </svg>`}set(e,t){let i=N(be(e,this.step),this.min,this.max);i!==this.value&&(this.value=i,this.emit("input",i)),t&&this.emit("change",this.value)}reset(){this.disabled||this.defaultValue===null||(this.dragging=!1,this.set(this.defaultValue,!0))}onDblclick=()=>this.reset();onPointerDown=e=>{this.disabled||e.button!==0||(e.preventDefault(),this.focus(),this.setPointerCapture(e.pointerId),this.dragging=!0,this.startY=e.clientY,this.startValue=this.value)};onPointerMove=e=>{if(!this.dragging)return;let t=e.shiftKey?Un*4:Un,i=(this.startY-e.clientY)/t*(this.max-this.min);this.set(this.startValue+i,!1)};onPointerUp=()=>{this.dragging&&(this.dragging=!1,this.emit("change",this.value))};onWheel=e=>{if(this.disabled)return;e.preventDefault();let t=e.deltaY!==0?e.deltaY:e.deltaX;t!==0&&this.set(this.value+(t<0?this.step:-this.step),!0)};onKeydown=e=>{if(this.disabled)return;let t=this.step*10,i={ArrowUp:this.step,ArrowRight:this.step,ArrowDown:-this.step,ArrowLeft:-this.step,PageUp:t,PageDown:-t},n;e.key in i?n=this.value+i[e.key]:e.key==="Home"?n=this.min:e.key==="End"&&(n=this.max),n!==void 0&&(e.preventDefault(),this.set(n,!0))}};k("nbplay-dial",ct);var ut=class extends v{static properties={level:{type:Number},rms:{type:Number},orientation:{type:String,reflect:!0},floorDb:{type:Number,attribute:"floor-db"},hotThreshold:{type:Number,attribute:"hot-threshold"},hot:{type:Boolean,reflect:!0}};constructor(){super(),this.level=0,this.rms=0,this.orientation="vertical",this.floorDb=-60,this.hotThreshold=.99,this.hot=!1}percent(e){if(!(e>0))return 0;let t=Ln(e);return N((t-this.floorDb)/(0-this.floorDb),0,1)*100}willUpdate(){this.hot=this.level>=this.hotThreshold}render(){return u`<div class="nbplay-meter-track">
      <div
        class="nbplay-meter-rms"
        style="--nbplay-meter-fill: ${this.percent(this.rms)}%"
      ></div>
      <div
        class="nbplay-meter-fill"
        style="--nbplay-meter-fill: ${this.percent(this.level)}%"
      ></div>
    </div>`}};k("nbplay-meter",ut);var dt=class extends v{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},orientation:{type:String,reflect:!0},editable:{type:String,reflect:!0},wheelStep:{type:Number,attribute:"wheel-step"},disabled:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};constructor(){super(),this.value=0,this.min=0,this.max=127,this.step=1,this.orientation="vertical",this.editable="",this.wheelStep=1,this.disabled=!1,this.dragging=!1}connectedCallback(){super.connectedCallback(),this.addEventListener("wheel",this.onWheel,{passive:!1}),this.addEventListener("pointerdown",this.onPointerDown),this.addEventListener("pointermove",this.onPointerMove),this.addEventListener("pointerup",this.onPointerUp),this.addEventListener("lostpointercapture",this.onPointerUp)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("wheel",this.onWheel),this.removeEventListener("pointerdown",this.onPointerDown),this.removeEventListener("pointermove",this.onPointerMove),this.removeEventListener("pointerup",this.onPointerUp),this.removeEventListener("lostpointercapture",this.onPointerUp)}can(e){return!this.disabled&&this.editable.split(/\s+/).includes(e)}get percent(){return this.max>this.min?N((this.value-this.min)/(this.max-this.min),0,1)*100:0}render(){return u`<div class="nbplay-bar-track">
      <div
        class="nbplay-bar-fill"
        style="--nbplay-bar-fill: ${this.percent}%"
      ></div>
    </div>`}set(e,t){let i=N(be(e,this.step),this.min,this.max);i!==this.value&&(this.value=i,this.emit("input",i)),t&&this.emit("change",this.value)}fromPointer(e){let t=this.getBoundingClientRect(),i=this.orientation==="vertical"?1-(e.clientY-t.top)/t.height:(e.clientX-t.left)/t.width;return this.min+N(i,0,1)*(this.max-this.min)}onWheel=e=>{if(!this.can("wheel"))return;e.preventDefault();let t=e.deltaY!==0?e.deltaY:e.deltaX;t!==0&&this.set(this.value+(t<0?this.wheelStep:-this.wheelStep),!0)};onPointerDown=e=>{!this.can("drag")||e.button!==0||(e.preventDefault(),this.setPointerCapture(e.pointerId),this.dragging=!0,this.set(this.fromPointer(e),!1))};onPointerMove=e=>{this.dragging&&this.set(this.fromPointer(e),!1)};onPointerUp=()=>{this.dragging&&(this.dragging=!1,this.emit("change",this.value))}};k("nbplay-bar",dt);var pt=class extends v{static properties={data:{attribute:!1},variant:{type:String,reflect:!0},emptyText:{type:String,attribute:"empty-text"}};observer;constructor(){super(),this.data=null,this.variant="line",this.emptyText="No sample loaded"}render(){return u`<canvas class="nbplay-waveform-canvas"></canvas>`}firstUpdated(){this.observer=new ResizeObserver(()=>this.draw()),this.observer.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.observer?.disconnect()}updated(){this.draw()}draw(){let e=this.querySelector("canvas");if(!e)return;let t=this.clientWidth,i=this.clientHeight;if(t===0||i===0)return;let n=window.devicePixelRatio||1;e.width=Math.round(t*n),e.height=Math.round(i*n);let s=e.getContext("2d");if(!s)return;s.setTransform(n,0,0,n,0,0);let a=V(this,"--nbplay-chart-bg","#121214"),o=V(this,"--nbplay-chart-grid","#2f2f36"),l=V(this,"--nbplay-chart-line","#f28c38"),c=V(this,"--nbplay-fg-muted","#a8a59c");s.fillStyle=a,s.fillRect(0,0,t,i),s.strokeStyle=o,s.lineWidth=1,s.setLineDash([3,4]);for(let m of[.25,.5,.75])s.beginPath(),s.moveTo(0,m*i),s.lineTo(t,m*i),s.stroke();s.setLineDash([]);let h=X(this.data);if(!h||h.length===0){s.fillStyle=c,s.font="12px "+V(this,"--nbplay-font-mono","monospace"),s.textAlign="center",s.textBaseline="middle",s.fillText(this.emptyText,t/2,i/2);return}s.beginPath();let p=i/2,d=i*.45;for(let m=0;m<t;m++){let g=Math.floor(m/t*h.length),f=p-h[g]*d;m===0?s.moveTo(m,f):s.lineTo(m,f)}this.variant==="glow"&&(s.strokeStyle=l,s.globalAlpha=.25,s.lineWidth=6,s.stroke(),s.globalAlpha=1),s.strokeStyle=l,s.lineWidth=2,s.lineJoin="round",s.stroke()}};k("nbplay-waveform",pt);var Hn=.3,ht=class extends v{static properties={attack:{type:Number},decay:{type:Number},sustain:{type:Number},release:{type:Number}};observer;constructor(){super(),this.attack=.005,this.decay=.1,this.sustain=.8,this.release=.1}render(){return u`<canvas class="nbplay-envelope-canvas"></canvas>`}firstUpdated(){this.observer=new ResizeObserver(()=>this.draw()),this.observer.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.observer?.disconnect()}updated(){this.draw()}draw(){let e=this.querySelector("canvas");if(!e)return;let t=this.clientWidth,i=this.clientHeight;if(t===0||i===0)return;let n=window.devicePixelRatio||1;e.width=Math.round(t*n),e.height=Math.round(i*n);let s=e.getContext("2d");if(!s)return;s.setTransform(n,0,0,n,0,0);let a=V(this,"--nbplay-chart-bg","#121214"),o=V(this,"--nbplay-chart-line","#f28c38"),l=V(this,"--nbplay-fg-muted","#a8a59c");s.fillStyle=a,s.fillRect(0,0,t,i);let c=this.attack+this.decay+Hn+this.release||1,h=t/c,p=8,d=i-14,m=E=>d-E*(d-p),g=this.attack*h,f=g+this.decay*h,$=f+Hn*h;s.beginPath(),s.moveTo(0,d),s.lineTo(g,m(1)),s.lineTo(f,m(this.sustain)),s.lineTo($,m(this.sustain)),s.lineTo(t,d),s.strokeStyle=o,s.lineWidth=2,s.lineJoin="round",s.stroke(),s.lineTo(0,d),s.closePath(),s.fillStyle=o,s.globalAlpha=.15,s.fill(),s.globalAlpha=1,s.fillStyle=l,s.font="10px "+V(this,"--nbplay-font-mono","monospace"),s.textAlign="center",s.textBaseline="bottom";let b=[["A",g/2],["D",(g+f)/2],["S",(f+$)/2],["R",($+t)/2]];for(let[E,y]of b)s.fillText(E,Math.min(Math.max(y,6),t-6),i-2)}};k("nbplay-envelope",ht);var mt=class extends v{static properties={active:{type:Boolean,reflect:!0},variant:{type:String,reflect:!0},label:{type:String},title:{type:String},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.active=!1,this.variant="default",this.label="",this.title="",this.disabled=!1}render(){return u`<button
      type="button"
      class="nbplay-toggle-button"
      aria-pressed=${String(this.active)}
      title=${this.title||x}
      ?disabled=${this.disabled}
      @click=${this.toggle}
    >
      ${this.label}
    </button>`}toggle(){this.disabled||(this.active=!this.active,this.emit("change",this.active))}};k("nbplay-toggle",mt);var bt=class extends v{static properties={beat:{type:Number},beatsPerBar:{type:Number,attribute:"beats-per-bar"},format:{type:String,reflect:!0},pad:{type:Number}};constructor(){super(),this.beat=0,this.beatsPerBar=4,this.format="bar:beat",this.pad=3}get bar(){return Math.floor(Math.max(0,this.beat)/Math.max(.25,this.beatsPerBar))+1}get beatInBar(){return Math.floor(Math.max(0,this.beat)%Math.max(.25,this.beatsPerBar))+1}render(){let e=this.format==="bar:beat"?String(this.bar).padStart(this.pad,"0"):String(this.bar),t=this.format==="bar:beat"?":":".";return u`<span class="nbplay-position-bar">${e}</span
      ><span class="nbplay-position-sep">${t}</span
      ><span class="nbplay-position-beat">${this.beatInBar}</span>`}};k("nbplay-position",bt);var ft=class extends v{static properties={options:{attribute:!1},value:{type:String,reflect:!0},label:{type:String},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.options=[],this.value="",this.label="",this.disabled=!1}render(){let e=this.options.map(t=>typeof t=="string"?{value:t}:t);return u`${this.label?u`<span class="nbplay-segmented-label">${this.label}</span>`:""}
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
      </div>`}select(e){this.disabled||e===this.value||(this.value=e,this.emit("change",e))}};k("nbplay-segmented",ft);var yt=class extends v{static properties={title:{type:String},badge:{type:String},status:{type:String}};actions=null;constructor(){super(),this.title="nbplay",this.badge="",this.status=""}connectedCallback(){this.actions===null&&(this.actions=Array.from(this.childNodes)),super.connectedCallback()}render(){let e=this.actions??[];return u`<h3 class="nbplay-header-title">${this.title}</h3>
      ${this.badge?u`<span class="nbplay-header-badge">${this.badge}</span>`:x}
      ${this.status?u`<span class="nbplay-header-status">${this.status}</span>`:x}
      <div class="nbplay-header-actions">${e}</div>`}};k("nbplay-header",yt);function Zs(){let r=navigator.userAgentData?.platform??navigator.platform;return/mac|iphone|ipad|ipod/i.test(r)?"\u2318 K":"Ctrl K"}var vt=class extends v{static properties={commands:{attribute:!1},placeholder:{type:String},query:{state:!0},active:{state:!0}};constructor(){super(),this.commands=[],this.placeholder="",this.query="",this.active=0}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onShortcut)}disconnectedCallback(){window.removeEventListener("keydown",this.onShortcut),super.disconnectedCallback()}show(){let e=this.dialog;!e||e.open||(this.query="",this.active=0,e.showModal())}get dialog(){return this.querySelector("dialog")}filtered(){let e=this.query.trim().toLowerCase();return this.commands.filter(t=>(t.label??t.id).toLowerCase().includes(e))}onShortcut=e=>{!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||e.key.toLowerCase()==="k"&&(e.preventDefault(),this.dialog?.open?this.dialog.close():this.show())};onKey(e){let t=this.filtered();if(e.key==="ArrowDown"||e.key==="ArrowUp"){if(e.preventDefault(),!t.length)return;let i=e.key==="ArrowDown"?1:-1;this.active=(this.active+i+t.length)%t.length}else e.key==="Enter"&&(e.preventDefault(),t[this.active]&&this.pick(t[this.active].id))}pick(e){this.dialog?.close(),this.emitDetail("nbplay-request",{name:e})}updated(){this.querySelector(".nbplay-palette-option.active")?.scrollIntoView({block:"nearest"})}render(){let e=this.filtered();return u`<dialog
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
        ${e.map((t,i)=>u`<li
              class="nbplay-palette-option ${i===this.active?"active":""}"
              role="option"
              aria-selected=${String(i===this.active)}
              data-id=${t.id}
              @pointermove=${()=>{this.active=i}}
              @click=${()=>this.pick(t.id)}
            >
              ${t.label??t.id}
            </li>`)}
        ${e.length?"":u`<li class="nbplay-palette-empty">No match</li>`}
      </ul>
    </dialog>`}};k("nbplay-palette",vt);var gt=class extends v{static properties={label:{type:String}};constructor(){super(),this.label=""}render(){return u`<button
      type="button"
      class="nbplay-palette-hint-button"
      aria-label="Open the command palette"
    >
      ${this.label}
      <kbd class="nbplay-palette-hint-keys">${Zs()}</kbd>
    </button>`}};k("nbplay-palette-hint",gt);var kt=class extends v{static properties={url:{type:String},label:{type:String},accept:{type:String},error:{state:!0}};constructor(){super(),this.url="",this.label="",this.accept="",this.error=""}async onPick(e){let t=e.target,i=t.files?.[0];if(t.value="",!i)return;this.error="";let n=new CustomEvent("nbplay-request",{detail:{name:"upload",file:i},bubbles:!0,composed:!0,cancelable:!0});if(this.dispatchEvent(n))try{let s=await fetch(this.url,{method:"PUT",body:i});if(s.ok){location.reload();return}let a=await s.json().catch(()=>({}));this.error=a.error??`Upload failed (${s.status})`}catch(s){this.error=String(s)}}render(){return u`<label class="nbplay-upload-button">
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
            >`:x}`}};k("nbplay-upload",kt);var St=class extends v{static properties={label:{type:String},value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},scale:{type:String},kind:{type:String},control:{type:String,reflect:!0},precision:{type:Number},unit:{type:String},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.label="",this.value=0,this.min=0,this.max=1,this.step=.01,this.defaultValue=null,this.scale="linear",this.kind="float",this.control="slider",this.precision=2,this.unit="",this.editable=!0,this.disabled=!1}render(){let e=this.control==="dial"?u`<nbplay-dial
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
      ></nbplay-value>`}onInput(e){e.stopPropagation(),this.value=e.detail.value,this.emit("input",this.value)}onChange(e){e.stopPropagation(),this.value=e.detail.value,this.emit("change",this.value)}};k("nbplay-param",St);var $t=class extends v{static properties={playing:{type:Boolean,reflect:!0},recording:{type:Boolean,reflect:!0},showRecord:{type:Boolean,attribute:"show-record"},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.playing=!1,this.recording=!1,this.showRecord=!0,this.disabled=!1}render(){return u`<button
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
            ></nbplay-toggle>`:x}`}forward(e,t){e.stopPropagation(),this.emitDetail(t,{value:e.detail.value})}};k("nbplay-transport-buttons",$t);var Et=class extends v{static properties={value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},defaultValue:{type:Number,attribute:"default-value"},level:{type:Number},rms:{type:Number},label:{type:String},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.value=.8,this.min=0,this.max=2,this.step=.01,this.defaultValue=1,this.level=0,this.rms=0,this.label="",this.editable=!0,this.disabled=!1}render(){return u`${this.label?u`<span class="nbplay-fader-label">${this.label}</span>`:x}
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
      ></nbplay-value>`}onInput(e){e.stopPropagation(),this.value=e.detail.value,this.emit("input",this.value)}onChange(e){e.stopPropagation(),this.value=e.detail.value,this.emit("change",this.value)}};k("nbplay-fader",Et);var Bi=[{key:"2",semitone:1,black:!0},{key:"3",semitone:3,black:!0},{key:"",semitone:-1,black:!1},{key:"5",semitone:6,black:!0},{key:"6",semitone:8,black:!0},{key:"7",semitone:10,black:!0},{key:"",semitone:-1,black:!1},{key:"9",semitone:13,black:!0},{key:"0",semitone:15,black:!0}],Ri=[{key:"Q",semitone:0,black:!1},{key:"W",semitone:2,black:!1},{key:"E",semitone:4,black:!1},{key:"R",semitone:5,black:!1},{key:"T",semitone:7,black:!1},{key:"Y",semitone:9,black:!1},{key:"U",semitone:11,black:!1},{key:"I",semitone:12,black:!1},{key:"O",semitone:14,black:!1},{key:"P",semitone:16,black:!1}],Ii=[{key:"A",semitone:1,black:!0},{key:"S",semitone:3,black:!0},{key:"",semitone:-1,black:!1},{key:"F",semitone:6,black:!0},{key:"G",semitone:8,black:!0},{key:"H",semitone:10,black:!0},{key:"",semitone:-1,black:!1},{key:"K",semitone:13,black:!0},{key:"L",semitone:15,black:!0}],_i=[{key:"Z",semitone:0,black:!1},{key:"X",semitone:2,black:!1},{key:"C",semitone:4,black:!1},{key:"V",semitone:5,black:!1},{key:"B",semitone:7,black:!1},{key:"N",semitone:9,black:!1},{key:"M",semitone:11,black:!1},{key:",",semitone:12,black:!1},{key:".",semitone:14,black:!1}],Kn={};for(let[r,e]of[[[Bi,Ri],"upper"],[[Ii,_i],"lower"]])for(let t of r)for(let i of t)i.key&&(Kn[i.key.toLowerCase()]={semitone:i.semitone,zone:e});function Di(r,e,t){let i=Kn[r.toLowerCase()];return i?{note:((i.zone==="upper"?e:t)+1)*12+i.semitone,zone:i.zone}:null}var Ys={1:0,3:1,6:3,8:4,10:5},Qs=[0,2,4,5,7,9,11],xt=class extends v{static properties={layout:{type:String,reflect:!0},upperOctave:{type:Number,attribute:"upper-octave"},lowerOctave:{type:Number,attribute:"lower-octave"},startOctave:{type:Number,attribute:"start-octave"},octaves:{type:Number},velocity:{type:Number},pressed:{attribute:!1},disabled:{type:Boolean,reflect:!0}};held=new Map;heldNotes=new Set;constructor(){super(),this.layout="rows",this.upperOctave=3,this.lowerOctave=4,this.startOctave=3,this.octaves=2,this.velocity=100,this.pressed=[],this.disabled=!1}isPressed(e){return this.heldNotes.has(e)||this.pressed.includes(e)}render(){return this.layout==="piano"?this.renderPiano():this.renderRows()}renderRows(){let e=(t,i,n,s)=>{let a=t==="upper"?this.upperOctave:this.lowerOctave;return u`<div class="nbplay-keys-zone" data-zone=${t}>
        <div class="nbplay-keys-zone-label">${i}</div>
        <div class="nbplay-keys-row nbplay-keys-row-sharp">
          ${n.map(o=>this.renderKey(o,a,t))}
        </div>
        <div class="nbplay-keys-row nbplay-keys-row-natural">
          ${s.map(o=>this.renderKey(o,a,t))}
        </div>
      </div>`};return u`${e("upper","UPPER",Bi,Ri)}
    ${e("lower","LOWER",Ii,_i)}`}renderKey(e,t,i){if(!e.key)return u`<div class="nbplay-keys-gap"></div>`;let n=(t+1)*12+e.semitone;return u`<div
      class="nbplay-keys-key ${e.black?"nbplay-keys-black":"nbplay-keys-white"} ${this.isPressed(n)?"pressed":""}"
      data-key=${e.key.toLowerCase()}
      data-note=${n}
      @pointerdown=${s=>this.down(s,n,i)}
      @pointerup=${this.up}
      @pointercancel=${this.up}
      @lostpointercapture=${this.up}
    >
      <span class="nbplay-keys-key-label">${e.key}</span>
      <span class="nbplay-keys-key-note">${_(n)}</span>
    </div>`}renderPiano(){let e=[],t=[];for(let s=0;s<this.octaves;s++){let a=(this.startOctave+s+1)*12;for(let o of Qs)e.push({note:a+o});for(let[o,l]of Object.entries(Ys))t.push({note:a+Number(o),index:s*7+l})}let i=s=>s<60?"lower":"upper",n=(s,a,o)=>u`<div
        class="nbplay-keys-key ${a?"nbplay-keys-black":"nbplay-keys-white"} ${this.isPressed(s)?"pressed":""}"
        data-note=${s}
        style=${a?`--nbplay-key-index: ${o}`:x}
        @pointerdown=${l=>this.down(l,s,i(s))}
        @pointerup=${this.up}
        @pointercancel=${this.up}
        @lostpointercapture=${this.up}
      >
        ${s%12===0?u`<span class="nbplay-keys-key-note">${_(s)}</span>`:x}
      </div>`;return u`<div
      class="nbplay-keys-piano"
      style="--nbplay-key-count: ${e.length}"
    >
      ${e.map(s=>n(s.note,!1))}
      ${t.map(s=>n(s.note,!0,s.index))}
    </div>`}down(e,t,i){if(this.disabled||e.button!==0)return;e.preventDefault();let n=e.currentTarget;try{n.setPointerCapture(e.pointerId)}catch{}this.held.has(e.pointerId)&&this.release(e.pointerId),this.held.set(e.pointerId,{note:t,zone:i}),this.heldNotes.add(t),this.requestUpdate(),this.emitDetail("nbplay-note-on",{note:t,velocity:this.velocity,zone:i})}up=e=>{this.release(e.pointerId)};release(e){let t=this.held.get(e);t&&(this.held.delete(e),this.heldNotes.delete(t.note),this.requestUpdate(),this.emitDetail("nbplay-note-off",{note:t.note,zone:t.zone}))}releaseAll(){for(let e of this.held.keys())this.release(e)}};k("nbplay-key-rows",xt);var Xs=5,Js=300,Nt=class extends v{static properties={rows:{type:Number},cols:{type:Number},pads:{attribute:!1},active:{attribute:!1},velocitySensitive:{type:Boolean,attribute:"velocity-sensitive"},hold:{type:Boolean},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};held=new Set;pendingTap;press;constructor(){super(),this.rows=4,this.cols=4,this.pads=[],this.active=[],this.velocitySensitive=!0,this.hold=!1,this.editable=!0,this.disabled=!1}pad(e){return this.pads[e]??{note:60+e,velocity:100}}render(){let e=this.rows*this.cols;return u`<div
      class="nbplay-pad-grid-cells"
      style="grid-template-columns: repeat(${this.cols}, 1fr); grid-template-rows: repeat(${this.rows}, 1fr)"
    >
      ${Array.from({length:e},(t,i)=>this.renderCell(i))}
    </div>`}renderCell(e){let t=this.pad(e),i=this.held.has(e)||this.active.includes(e),n=`Pad ${e+1}: ${t.label??_(t.note)}  vel=${t.velocity}`;return u`<div
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
    </div>`}tapVelocity(e,t,i){let n=this.pad(i).velocity;if(!this.velocitySensitive)return n;let s=t.getBoundingClientRect(),a=N((e.clientY-s.top)/s.height,0,1);return O(Math.round(20+a*(n-20)))}noteOn(e,t){this.held.add(e),this.requestUpdate(),this.emitDetail("nbplay-note-on",{index:e,note:this.pad(e).note,velocity:t})}noteOff(e){this.held.delete(e)&&(this.requestUpdate(),this.emitDetail("nbplay-note-off",{index:e,note:this.pad(e).note}))}onPointerDown(e,t){if(this.disabled||e.button!==0)return;let i=e.currentTarget,n=e.target.closest("nbplay-value")!==null;if(!n){e.preventDefault();try{i.setPointerCapture(e.pointerId)}catch{}}this.press={index:t,pointerId:e.pointerId,startY:e.clientY,onLabel:n,dragging:!1,cell:i},this.hold&&!n&&this.noteOn(t,this.tapVelocity(e,i,t))}onPointerMove=e=>{let t=this.press;if(!t||t.pointerId!==e.pointerId||!this.editable||this.hold||!t.dragging&&Math.abs(e.clientY-t.startY)<Xs)return;t.dragging=!0;let i=t.cell.getBoundingClientRect(),n=O(Math.round((1-(e.clientY-i.top)/i.height)*127));this.setPad(t.index,"velocity",n,"input")};onPointerUp=e=>{let t=this.press;if(!t||t.pointerId!==e.pointerId)return;if(this.press=void 0,this.hold){this.noteOff(t.index);return}if(t.dragging){this.emitDetail("change",{index:t.index,field:"velocity",value:this.pad(t.index).velocity});return}let i=this.tapVelocity(e,t.cell,t.index),n=()=>{this.noteOn(t.index,i),requestAnimationFrame(()=>this.noteOff(t.index))};if(!t.onLabel){n();return}let s=t.cell.querySelector("nbplay-value");clearTimeout(this.pendingTap),this.pendingTap=setTimeout(()=>{this.pendingTap=void 0,s?.editing||n()},Js)};onPointerCancel=e=>{let t=this.press;!t||t.pointerId!==e.pointerId||(this.press=void 0,this.hold?this.noteOff(t.index):t.dragging&&this.emitDetail("change",{index:t.index,field:"velocity",value:this.pad(t.index).velocity}))};onWheel(e,t){if(!this.editable||this.disabled)return;e.preventDefault();let i=e.deltaY!==0?e.deltaY:e.deltaX;if(i===0)return;let n=this.pad(t);e.shiftKey?this.setPad(t,"velocity",O(n.velocity+(i<0?5:-5)),"change"):this.setPad(t,"note",J(n.note+(i<0?1:-1)),"change")}onLabelChange(e,t){e.stopPropagation();let i=e.detail?.value;this.setPad(t,"note",J(i),"change")}setPad(e,t,i,n){let s=this.pad(e);if(s[t]===i)return;let a=this.pads.slice();a[e]={...s,[t]:i},this.pads=a,this.emitDetail(n,{index:e,field:t,value:i})}};k("nbplay-pad-grid",Nt);var Pt=class extends v{static properties={voices:{attribute:!1},currentStep:{type:Number,attribute:"current-step"},cursor:{attribute:!1},pending:{attribute:!1},armed:{attribute:!1},showArm:{type:Boolean,attribute:"show-arm"},disabled:{type:Boolean,reflect:!0},editing:{state:!0}};constructor(){super(),this.voices=[],this.currentStep=-1,this.cursor=null,this.pending=null,this.armed=[],this.showArm=!1,this.disabled=!1,this.editing=null}updated(e){if(!e.has("editing")||!this.editing)return;let t=this.querySelector(".nbplay-step-grid-edit"),i=this.step(this.editing.voice,this.editing.step);!t||!i||(t.value=_(i.note),t.focus(),t.select())}get length(){return this.voices[0]?.length??0}render(){let e=this.length,t=Array.from({length:e},(i,n)=>n);return u`<div class="nbplay-step-grid-rows">
      <div class="nbplay-step-grid-row nbplay-step-grid-header">
        <div class="nbplay-step-grid-label">#</div>
        ${t.map(i=>u`<div
              class="nbplay-step-grid-head ${i===this.currentStep?"active-col":""}"
            >
              ${i+1}
            </div>`)}
      </div>
      ${this.voices.map((i,n)=>this.renderVoice(i,n,t))}
    </div>`}renderVoice(e,t,i){let n=this.armed.includes(t);return u`<div
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
        ${i.map(s=>u`<nbplay-bar
              class="nbplay-step-grid-vel ${e[s]?.active?"active":""} ${s===this.currentStep?"current":""}"
              editable="wheel"
              wheel-step="5"
              .value=${e[s]?.velocity??0}
              .min=${0}
              .max=${127}
              @input=${a=>a.stopPropagation()}
              @change=${a=>this.onVelocity(a,t,s)}
            ></nbplay-bar>`)}
      </div>`}renderCell(e,t,i){let n=e??{active:!1,note:60,velocity:100},s=this.pending?.voice===t&&this.pending?.step===i,a=this.cursor?.voice===t&&this.cursor?.step===i,o=["nbplay-step-grid-cell",n.active?"active":"",i===this.currentStep?"current":"",a?"cursor":"",s?"pending":""].join(" "),l=n.probability??1;return u`<div
      class=${o}
      data-voice=${t}
      data-step=${i}
      title="Voice ${t+1} Step ${i+1}: ${_(n.note)} vel=${n.velocity} prob=${Math.round(l*100)}%"
      @click=${()=>this.toggle(t,i)}
      @dblclick=${()=>this.pick(t,i)}
      @wheel=${c=>this.onWheel(c,t,i)}
    >
      ${this.editing?.voice===t&&this.editing?.step===i?this.renderEditor(t,i):s?"\u266A?":_(n.note)}
    </div>`}renderEditor(e,t){let i=n=>n.stopPropagation();return u`<input
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
    />`}commitEdit(e){let t=this.editing;if(!t)return;this.editing=null;let i=st(e.value);i!==null&&(this.set(t.voice,t.step,"note",i),this.set(t.voice,t.step,"active",!0))}step(e,t){return this.voices[e]?.[t]}set(e,t,i,n){let s=this.step(e,t);if(!s||s[i]===n)return;let a=this.voices.slice(),o=a[e].slice();o[t]={...s,[i]:n},a[e]=o,this.voices=a,this.emitDetail("change",{voice:e,step:t,field:i,value:n})}toggle(e,t){if(this.disabled)return;let i=this.step(e,t);i&&this.set(e,t,"active",!i.active)}pick(e,t){this.disabled||(this.showArm?this.emitDetail("nbplay-step-pick",{voice:e,step:t}):this.editing={voice:e,step:t})}onWheel(e,t,i){if(this.disabled)return;e.preventDefault();let n=e.deltaY!==0?e.deltaY:e.deltaX,s=this.step(t,i);n===0||!s||this.set(t,i,"note",J(s.note+(n<0?1:-1)))}onVelocity(e,t,i){e.stopPropagation(),this.set(t,i,"velocity",e.detail?.value)}onArm(e,t){e.stopPropagation();let i=e.detail?.value;this.armed=i?[...this.armed,t]:this.armed.filter(n=>n!==t),this.emitDetail("nbplay-arm",{voice:t,armed:i})}};k("nbplay-step-grid",Pt);var wt=class extends v{static properties={pattern:{attribute:!1},names:{attribute:!1},currentStep:{type:Number,attribute:"current-step"},selected:{type:Number},velocity:{type:Number},group:{type:Number}};constructor(){super(),this.pattern=[],this.names=[],this.currentStep=-1,this.selected=-1,this.velocity=100,this.group=4}render(){let e=this.pattern[0]?.length??0,t=Math.max(1,Math.round(Number(this.group)||4));return u`${this.pattern.map((i,n)=>u`<div
          class="nbplay-drum-grid-row ${n===this.selected?"selected":""}"
          data-pad=${n}
        >
          <button
            type="button"
            class="nbplay-drum-grid-name"
            title=${this.names[n]??`Pad ${n+1}`}
            @click=${()=>this.emitDetail("nbplay-select",{pad:n})}
          >
            ${this.names[n]??`Pad ${n+1}`}
          </button>
          ${Array.from({length:e},(s,a)=>{let o=i[a]??0,l=["nbplay-drum-grid-cell",o>0?"on":"",a===this.currentStep?"current":"",a%t===0?"beat":""].join(" ");return u`<div
              class=${l}
              data-step=${a}
              style=${o>0?`--nbplay-drum-velocity: ${o/127}`:""}
              title="${this.names[n]??`Pad ${n+1}`} step ${a+1}${o>0?`: ${o}`:""}"
              @click=${()=>this.set(n,a,o>0?0:this.velocity)}
              @wheel=${c=>this.onWheel(c,n,a,o)}
            ></div>`})}
        </div>`)}`}set(e,t,i){let n=this.pattern.map(s=>s.slice());!n[e]||n[e][t]===i||(n[e][t]=i,this.pattern=n,this.emitDetail("change",{pad:e,step:t,value:i}))}onWheel(e,t,i,n){if(n<=0)return;e.preventDefault();let s=e.deltaY!==0?e.deltaY:e.deltaX;s!==0&&this.set(t,i,N(n+(s<0?5:-5),1,127))}};k("nbplay-drum-grid",wt);var ee=["gain","filter","eq","compressor","limiter","distortion","delay","reverb","chorus","phaser","tremolo"];function D(r,e,t,i,n,s){return{key:r,label:e,min:t,max:i,step:n,default:s,kind:"number"}}var er=["lowpass","highpass","bandpass","notch","lowshelf","highshelf","peaking"],Oe={eq:[D("low","Low",-24,24,.5,0),D("low_freq","LoHz",20,1e3,1,120),D("mid","Mid",-24,24,.5,0),D("mid_freq","MidHz",100,1e4,1,1e3),D("mid_q","MidQ",.1,10,.01,1),D("high","High",-24,24,.5,0),D("high_freq","HiHz",1e3,2e4,1,8e3)],distortion:[D("drive","Drive",0,1,.01,.4),D("tone","Tone",200,2e4,1,8e3),D("wet","Wet",0,1,.01,1)],chorus:[D("rate","Rate",.05,10,.01,1.5),D("depth","Depth",0,.02,5e-4,.003),D("delay","Delay",.001,.05,.001,.02),D("wet","Wet",0,1,.01,.5)],phaser:[D("rate","Rate",.05,10,.01,.5),D("depth","Depth",0,1,.01,.7),D("frequency","Hz",100,5e3,1,800),D("feedback","Fdbk",0,.9,.01,.4),D("wet","Wet",0,1,.01,.5)],tremolo:[D("rate","Rate",.1,20,.01,5),D("depth","Depth",0,1,.01,.5)],gain:[{key:"gain",label:"Gain",min:0,max:4,step:.01,default:1,kind:"number"}],filter:[{key:"filter_type",label:"Type",options:er,kind:"select"},{key:"frequency",label:"Hz",min:20,max:2e4,step:1,default:1200,kind:"number"},{key:"q",label:"Q",min:1e-4,max:100,step:.01,default:1,kind:"number"}],delay:[{key:"time",label:"Time",min:0,max:5,step:.001,default:.25,kind:"number"},{key:"feedback",label:"Fdbk",min:0,max:.95,step:.01,default:.25,kind:"number"},{key:"wet",label:"Wet",min:0,max:1,step:.01,default:.35,kind:"number"}],reverb:[{key:"seconds",label:"Size",min:.01,max:10,step:.01,default:1.5,kind:"number"},{key:"decay",label:"Decay",min:.01,max:12,step:.01,default:2,kind:"number"},{key:"wet",label:"Wet",min:0,max:1,step:.01,default:.25,kind:"number"}],compressor:[{key:"threshold",label:"Thresh",min:-100,max:0,step:.5,default:-24,kind:"number"},{key:"knee",label:"Knee",min:0,max:40,step:.5,default:30,kind:"number"},{key:"ratio",label:"Ratio",min:1,max:20,step:.1,default:12,kind:"number"},{key:"attack",label:"Attack",min:0,max:1,step:.001,default:.003,kind:"number"},{key:"release",label:"Release",min:0,max:1,step:.001,default:.25,kind:"number"}],limiter:[{key:"threshold",label:"Thresh",min:-100,max:0,step:.5,default:-1,kind:"number"},{key:"release",label:"Release",min:0,max:1,step:.001,default:.05,kind:"number"}]};function Ct(r){let e=Oe[r.type];return e||Object.entries(r).filter(([t])=>t!=="type"&&t!=="enabled").map(([t,i])=>typeof i=="number"?{key:t,label:t,kind:"number"}:typeof i=="boolean"?{key:t,label:t,kind:"bool"}:typeof i=="string"?{key:t,label:t,kind:"text"}:null).filter(t=>t!==null)}function Li(r){return r.enabled!==!1}function qi(r){return r.type==="filter"?`${r.filter_type||"filter"} ${Math.round(Number(r.frequency)||0)}Hz`:r.type}var At=class extends v{static properties={effect:{attribute:!1},specs:{attribute:!1},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.effect={type:"gain"},this.specs=null,this.disabled=!1}render(){let e=this.specs??Ct(this.effect);return e.length?u`${e.map(t=>this.renderRow(t))}`:u`<span class="nbplay-effect-editor-none">No parameters</span>`}renderRow(e){let t=this.effect[e.key],i=s=>s.stopPropagation();if(e.kind==="select")return u`<label class="nbplay-effect-editor-row">
        <span>${e.label}</span>
        <select
          data-key=${e.key}
          ?disabled=${this.disabled}
          @input=${i}
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
          @input=${i}
          @change=${s=>{s.stopPropagation(),this.commit(e.key,s.target.checked)}}
        />
      </label>`;if(e.kind==="text")return u`<label class="nbplay-effect-editor-row">
        <span>${e.label}</span>
        <input
          type="text"
          data-key=${e.key}
          .value=${String(t??"")}
          ?disabled=${this.disabled}
          @input=${i}
          @change=${s=>{s.stopPropagation(),this.commit(e.key,s.target.value)}}
        />
      </label>`;let n=Number(t);return e.min!==void 0&&e.max!==void 0?u`<nbplay-param
        class="nbplay-effect-editor-param"
        control="dial"
        data-key=${e.key}
        .label=${e.label}
        .value=${Number.isFinite(n)?n:e.min}
        .min=${e.min}
        .max=${e.max}
        .step=${e.step??.01}
        .defaultValue=${e.default??null}
        .precision=${tr(e.step??.01)}
        .disabled=${this.disabled}
        @input=${i}
        @change=${s=>{s.stopPropagation(),this.commit(e.key,s.detail.value)}}
      ></nbplay-param>`:u`<label class="nbplay-effect-editor-row">
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
    </label>`}commit(e,t){let i=(this.specs??Ct(this.effect)).find(n=>n.key===e);i?.kind==="number"&&typeof t=="number"&&(t=N(t,i.min??-1/0,i.max??1/0)),this.effect={...this.effect,[e]:t},this.emitDetail("change",{key:e,value:t})}};function tr(r){return Math.max(0,Math.ceil(-Math.log10(r)))}k("nbplay-effect-editor",At);var Tt=class extends v{static properties={effects:{attribute:!1},types:{attribute:!1},editing:{type:Number},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.effects=[],this.types=ee,this.editing=-1,this.disabled=!1}render(){let e=t=>t.stopPropagation();return u`<div class="nbplay-effect-rack-add">
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
        ${this.effects.map((t,i)=>this.renderItem(t,i))}
      </div>`}renderItem(e,t){let i=Li(e),n=this.editing===t;return u`<div class="nbplay-effect-rack-item" data-index=${t}>
      <div class="nbplay-effect-rack-chip-row">
        <button
          type="button"
          class="nbplay-effect-rack-chip ${i?"":"bypassed"}"
          title=${i?"Bypass effect":"Enable effect"}
          ?disabled=${this.disabled}
          @click=${()=>this.emitDetail("change",{index:t,field:"enabled",value:!i})}
        >
          ${qi(e)}
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
      ${n?u`<nbplay-effect-editor
              .effect=${e}
              .disabled=${this.disabled}
              @input=${s=>s.stopPropagation()}
              @change=${s=>{s.stopPropagation();let{key:a,value:o}=s.detail;this.emitDetail("change",{index:t,field:a,value:o})}}
            ></nbplay-effect-editor>`:x}
    </div>`}add(){let t=this.querySelector(".nbplay-effect-rack-type")?.value||this.types[0];t&&this.emitDetail("nbplay-effect-add",{type:t})}};k("nbplay-effect-rack",Tt);var Mt=class extends v{static properties={kind:{type:String,reflect:!0},name:{type:String},gain:{type:Number},pan:{type:Number},mute:{type:Boolean},solo:{type:Boolean},sends:{attribute:!1},sendNames:{attribute:!1},effects:{attribute:!1},effectTypes:{attribute:!1},level:{type:Number},rms:{type:Number},editable:{type:Boolean},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.kind="channel",this.name="",this.gain=.8,this.pan=0,this.mute=!1,this.solo=!1,this.sends=[],this.sendNames=[],this.effects=[],this.effectTypes=ee,this.level=0,this.rms=0,this.editable=!0,this.disabled=!1}render(){let e=this.kind==="channel",t=i=>i.stopPropagation();return u`<div class="nbplay-strip-name" title=${this.name}>
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
      ${e?u`<div class="nbplay-strip-pan">
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
              ${this.sendNames.length?u`<div class="nbplay-strip-sends">
                      ${this.sendNames.map((i,n)=>u`<label
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
      ${this.kind==="master"?x:u`<button
              type="button"
              class="nbplay-strip-remove"
              title=${e?"Remove channel":"Remove return bus"}
              ?disabled=${this.disabled}
              @click=${()=>this.emitDetail("nbplay-remove",{})}
            >
              ×
            </button>`}`}forward(e,t,i){e.stopPropagation();let n=e.detail.value;this[i]=n,this.emitDetail(t,{field:i,value:n})}forwardSend(e,t,i){e.stopPropagation();let n=e.detail.value,s=[...this.sends];s[i]=n,this.sends=s,this.emitDetail(t,{field:"send",index:i,value:n})}};k("nbplay-strip",Mt);var Bt=class extends v{static properties={ports:{attribute:!1},value:{type:String},status:{type:String,reflect:!0},label:{type:String},emptyText:{type:String,attribute:"empty-text"},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.ports=[],this.value="",this.status="idle",this.label="",this.emptyText="Not connected",this.disabled=!1}render(){let e=i=>i.stopPropagation(),t={idle:"Idle",connected:"Connected",unsupported:"Web MIDI unavailable",error:"Error"}[this.status];return u`${this.label?u`<span class="nbplay-midi-port-label">${this.label}</span>`:""}
      <select
        class="nbplay-midi-port-select"
        title="MIDI port"
        ?disabled=${this.disabled||this.status==="unsupported"}
        @input=${e}
        @change=${i=>{i.stopPropagation(),this.value=i.target.value,this.emit("change",this.value)}}
      >
        <option value="" ?selected=${!this.value}>${this.emptyText}</option>
        ${this.ports.map(i=>u`<option
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
      <span class="nbplay-midi-port-status">${t}</span>`}updated(){let e=this.querySelector(".nbplay-midi-port-select");e&&e.value!==this.value&&(e.value=this.value)}};k("nbplay-midi-port",Bt);function It(r){if(!r||r.length===0)return"";let e=r[0],t=e&240,i=(e&15)+1;if(t===144&&r.length>=3)return`NoteOn  ch=${i} note=${r[1]} vel=${r[2]}`;if(t===128&&r.length>=3)return`NoteOff ch=${i} note=${r[1]} vel=${r[2]}`;if(t===176&&r.length>=3)return`CC      ch=${i} ctrl=${r[1]} val=${r[2]}`;if(t===192&&r.length>=2)return`PgmChg  ch=${i} pgm=${r[1]}`;if(t===224&&r.length>=3){let n=r[1]|r[2]<<7;return`Bend    ch=${i} val=${n}`}return e===248?"Clock":e===250?"Start":e===252?"Stop":e===251?"Continue":`Raw [${Array.from(r).map(n=>n.toString(16).padStart(2,"0")).join(" ")}]`}var Rt=class extends v{static properties={entries:{attribute:!1},max:{type:Number},label:{type:String},emptyText:{type:String,attribute:"empty-text"}};constructor(){super(),this.entries=[],this.max=8,this.label="",this.emptyText=""}push(e){this.entries=[e,...this.entries].slice(0,this.max)}render(){let e=this.entries.slice(0,this.max);return u`${this.label?u`<div class="nbplay-midi-log-label">${this.label}</div>`:""}
      <div class="nbplay-midi-log-entries">
        ${e.length?e.map(t=>u`<div
                    class="nbplay-midi-log-entry"
                    .textContent=${typeof t=="string"?t:It(t)}
                  ></div>`):u`<div class="nbplay-midi-log-empty">${this.emptyText}</div>`}
      </div>`}};k("nbplay-midi-log",Rt);var _t=class extends v{static properties={name:{type:String},active:{type:Boolean,reflect:!0},queued:{type:Boolean,reflect:!0},selected:{type:Boolean,reflect:!0},progress:{type:Number},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.name="",this.active=!1,this.queued=!1,this.selected=!1,this.progress=0,this.disabled=!1}render(){let e=this.name!=="";return u`<button
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
    </button>`}};k("nbplay-launcher-slot",_t);var Ve=-2,Dt=class extends v{static properties={tracks:{attribute:!1},scenes:{attribute:!1},slots:{attribute:!1},active:{attribute:!1},queued:{attribute:!1},progress:{attribute:!1},selected:{attribute:!1},playing:{type:Boolean,reflect:!0},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.tracks=[],this.scenes=[],this.slots=[],this.active=[],this.queued=[],this.progress=[],this.selected=null,this.playing=!1,this.disabled=!1}sceneState(e){let t=this.tracks.filter((n,s)=>this.slots.some(a=>a.track===s&&a.scene===e)).length,i=this.tracks.filter((n,s)=>this.active[s]===e).length;return{active:t>0&&i===t,partial:i>0&&i<t,queued:this.tracks.some((n,s)=>this.queued[s]===e)}}render(){return u`<div
        class="nbplay-launcher-grid-row nbplay-launcher-grid-scenes"
      >
        <div class="nbplay-launcher-grid-corner">
          ${this.playing?"\u25B6":"\u25A0"}
        </div>
        ${this.scenes.map((e,t)=>{let i=this.sceneState(t);return u`<button
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
      ${this.tracks.length?this.tracks.map((e,t)=>this.renderTrack(e,t)):u`<div class="nbplay-launcher-grid-empty">No tracks</div>`}`}renderTrack(e,t){let i=this.queued[t]??-1;return u`<div class="nbplay-launcher-grid-row" data-track=${t}>
      <div class="nbplay-launcher-grid-track">
        <span class="nbplay-launcher-grid-track-name">${e.name}</span>
        ${e.detail?u`<small>${e.detail}</small>`:""}
      </div>
      ${this.scenes.map((n,s)=>{let a=this.slots.find(o=>o.track===t&&o.scene===s);return u`<nbplay-launcher-slot
          data-track=${t}
          data-scene=${s}
          .name=${a?.name??""}
          .active=${this.active[t]===s}
          .queued=${i===s||i===Ve&&!a}
          .selected=${this.selected?.track===t&&this.selected?.scene===s}
          .progress=${this.progress[t]??0}
          .disabled=${this.disabled}
          @nbplay-launch=${o=>{o.stopPropagation(),this.emitDetail("nbplay-launch",{track:t,scene:s})}}
        ></nbplay-launcher-slot>`})}
      <button
        type="button"
        class="nbplay-launcher-grid-track-stop ${i===Ve?"queued":""}"
        title="Stop track"
        ?disabled=${this.disabled}
        @click=${()=>this.emitDetail("nbplay-stop-track",{track:t})}
      >
        ■
      </button>
    </div>`}};k("nbplay-launcher-grid",Dt);function ce(r,e){let t=Math.floor(r/e)+1,i=Math.floor(r%e)+1;return`${t}.${i}`}function qt(r,e){return e>0?Math.round(r/e)*e:r}var Lt=class extends v{static properties={length:{type:Number},beatsPerBar:{type:Number,attribute:"beats-per-bar"},beat:{type:Number},loopStart:{type:Number,attribute:"loop-start"},loopEnd:{type:Number,attribute:"loop-end"},loopEnabled:{type:Boolean,attribute:"loop-enabled",reflect:!0},width:{type:Number},disabled:{type:Boolean,reflect:!0}};seekFrame=null;constructor(){super(),this.length=16,this.beatsPerBar=4,this.beat=0,this.loopStart=0,this.loopEnd=0,this.loopEnabled=!1,this.width=0,this.disabled=!1}pct(e){return this.length>0?N(e/this.length*100,0,100):0}render(){let e=Math.max(1,Math.ceil(this.length/this.beatsPerBar)),t=this.loopEnabled&&this.loopEnd>this.loopStart;return u`<div
      class="nbplay-ruler-track"
      style=${this.width>0?`width: ${this.width}px;`:x}
      @pointerdown=${this.onSeekDown}
    >
      ${Array.from({length:e},(i,n)=>{let s=this.pct(n*this.beatsPerBar);return u`<span class="nbplay-ruler-bar" style="left: ${s}%;"
          >${n+1}</span
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
    </div>`}beatAt(e){let i=this.querySelector(".nbplay-ruler-track").getBoundingClientRect();return(i.width<=0?0:N((e.clientX-i.left)/i.width,0,1))*this.length}onSeekDown=e=>{if(this.disabled||e.button!==0||e.target.closest(".nbplay-ruler-loop-handle"))return;e.preventDefault();let t=e.currentTarget;Fe(t,e.pointerId);let i=this.beatAt(e);this.emitDetail("nbplay-seek",{beat:i,final:!1});let n=a=>{i=this.beatAt(a),this.seekFrame===null&&(this.seekFrame=requestAnimationFrame(()=>{this.seekFrame=null,this.emitDetail("nbplay-seek",{beat:i,final:!1})}))},s=()=>{this.seekFrame!==null&&(cancelAnimationFrame(this.seekFrame),this.seekFrame=null),this.emitDetail("nbplay-seek",{beat:i,final:!0}),t.removeEventListener("pointermove",n),t.removeEventListener("pointerup",s),t.removeEventListener("pointercancel",s)};t.addEventListener("pointermove",n),t.addEventListener("pointerup",s),t.addEventListener("pointercancel",s)};onHandleDown=e=>{if(this.disabled||e.button!==0)return;e.preventDefault(),e.stopPropagation();let t=e.currentTarget;Fe(t,e.pointerId);let i=t.dataset.edge==="start"?"loopStart":"loopEnd",n=this.beatsPerBar,s=(l,c)=>{let h=N(qt(this.beatAt(l),n),0,this.length),p=i==="loopStart"?Math.min(h,this.loopEnd-n):Math.max(h,this.loopStart+n);this[i]=p,this.emitDetail(c,{field:i,value:p})},a=l=>s(l,"input"),o=l=>{s(l,"change"),t.removeEventListener("pointermove",a),t.removeEventListener("pointerup",o),t.removeEventListener("pointercancel",o)};t.addEventListener("pointermove",a),t.addEventListener("pointerup",o),t.addEventListener("pointercancel",o)}};function Fe(r,e){try{r.setPointerCapture(e)}catch{}}k("nbplay-ruler",Lt);var Ot=class extends v{static properties={clipId:{type:String,attribute:"clip-id",reflect:!0},name:{type:String},detail:{type:String},kind:{type:String,reflect:!0},pattern:{type:Boolean,reflect:!0},selected:{type:Boolean,reflect:!0},muted:{type:Boolean,reflect:!0},dragging:{type:Boolean,reflect:!0}};constructor(){super(),this.clipId="",this.name="",this.detail="",this.kind="audio",this.pattern=!1,this.selected=!1,this.muted=!1,this.dragging=!1}render(){return u`<i class="nbplay-clip-handle start"></i>
      <span class="nbplay-clip-name">${this.name}</span>
      <small class="nbplay-clip-detail">${this.detail}</small>
      <i class="nbplay-clip-handle end"></i>`}};k("nbplay-clip",Ot);var ir=.25,Gn=.25,Wn=3,Vt=class extends v{static properties={name:{type:String},armed:{type:Boolean},monitor:{type:Boolean},muted:{type:Boolean},solo:{type:Boolean},input:{type:String},inputs:{attribute:!1},clips:{attribute:!1},length:{type:Number},beatsPerBar:{type:Number,attribute:"beats-per-bar"},beat:{type:Number},selected:{type:String},recording:{type:Boolean,reflect:!0},showHeader:{type:Boolean,attribute:"show-header"},width:{type:Number},disabled:{type:Boolean,reflect:!0}};seekFrame=null;constructor(){super(),this.name="",this.armed=!1,this.monitor=!1,this.muted=!1,this.solo=!1,this.input="microphone",this.inputs=[{value:"microphone",label:"Mic"},{value:"channel",label:"Channel"},{value:"midi",label:"MIDI"}],this.clips=[],this.length=16,this.beatsPerBar=4,this.beat=0,this.selected="",this.recording=!1,this.showHeader=!0,this.width=0,this.disabled=!1}pct(e){return this.length>0?N(e/this.length*100,0,100):0}render(){return u`${this.showHeader?this.renderHeader():x}
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
      </div>`}renderHeader(){let e=(t,i,n,s)=>u`<nbplay-toggle
        variant=${i}
        label=${n}
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
    </div>`}renderClip(e){let t=this.pct(e.start),i=Math.max(1,Math.min(100-t,this.pct(e.duration)));return u`<nbplay-clip
      clip-id=${e.id}
      .name=${e.name}
      .detail=${e.detail??ce(e.start,this.beatsPerBar)}
      .kind=${e.kind??"audio"}
      .pattern=${!!e.pattern}
      .muted=${!!e.muted}
      .selected=${e.id===this.selected}
      style="left: ${t}%; width: ${i}%;"
      @pointerdown=${n=>this.onClipDown(n,e)}
    ></nbplay-clip>`}beatAt(e,t){let i=t.getBoundingClientRect();return(i.width<=0?0:N((e.clientX-i.left)/i.width,0,1))*this.length}onSeekDown=e=>{if(this.disabled||e.button!==0||e.target.closest("nbplay-clip"))return;e.preventDefault();let t=e.currentTarget;Fe(t,e.pointerId);let i=this.beatAt(e,t);this.emitDetail("nbplay-seek",{beat:i,final:!1});let n=a=>{i=this.beatAt(a,t),this.seekFrame===null&&(this.seekFrame=requestAnimationFrame(()=>{this.seekFrame=null,this.emitDetail("nbplay-seek",{beat:i,final:!1})}))},s=()=>{this.seekFrame!==null&&(cancelAnimationFrame(this.seekFrame),this.seekFrame=null),this.emitDetail("nbplay-seek",{beat:i,final:!0}),t.removeEventListener("pointermove",n),t.removeEventListener("pointerup",s),t.removeEventListener("pointercancel",s)};t.addEventListener("pointermove",n),t.addEventListener("pointerup",s),t.addEventListener("pointercancel",s)};onClipDown(e,t){if(this.disabled||e.button!==0)return;let i=e.currentTarget,s=i.parentElement.getBoundingClientRect().width;if(s<=0)return;let a=e.target,o=a?.closest(".nbplay-clip-handle.start")?"trim-start":a?.closest(".nbplay-clip-handle.end")?"trim-end":"move";e.preventDefault(),e.stopPropagation(),Fe(i,e.pointerId);let l=s/this.length,c=e.clientX,h=e.clientY,p=!1,d={start:t.start,duration:t.duration,offset:t.offset??0},m=b=>{let E=qt((b.clientX-c)/l,ir),y=t.offset??0;if(o==="move")return{start:Math.max(0,t.start+E),duration:t.duration,offset:y};if(o==="trim-start"){let S=Math.max(-Math.min(y,t.start),Math.min(E,t.duration-Gn));return{start:t.start+S,duration:t.duration-S,offset:y+S}}return{start:t.start,duration:Math.max(Gn,t.duration+E),offset:y}},g=b=>({field:"clip",id:t.id,...d,clientY:b.clientY}),f=b=>{if(!p&&Math.abs(b.clientX-c)<Wn&&Math.abs(b.clientY-h)<Wn)return;p=!0,i.dragging=!0,d=m(b);let E=this.pct(d.start);i.style.left=`${E}%`,i.style.width=`${Math.max(1,Math.min(100-E,this.pct(d.duration)))}%`,this.emitDetail("input",g(b))},$=b=>{i.removeEventListener("pointermove",f),i.removeEventListener("pointerup",$),i.removeEventListener("pointercancel",$),i.dragging=!1,p?this.emitDetail("change",g(b)):this.emitDetail("nbplay-clip-select",{id:t.id})};i.addEventListener("pointermove",f),i.addEventListener("pointerup",$),i.addEventListener("pointercancel",$)}};k("nbplay-lane",Vt);var jn=6;function Ut(r){return`var(--nbplay-palette-${r%jn+1})`}var Ft=class extends v{static properties={zones:{attribute:!1},selected:{type:Number},emptyText:{type:String,attribute:"empty-text"}};constructor(){super(),this.zones=[],this.selected=-1,this.emptyText="No zones"}render(){let e=Array.from({length:11},(t,i)=>i*12);return u`<div
      class="nbplay-zone-map-track ${this.zones.length?"":"empty"}"
    >
      ${e.map(t=>u`<span
            class="nbplay-zone-map-tick"
            style="left:${t/128*100}%"
            >${_(t)}</span
          >`)}
      ${this.zones.length?this.zones.map((t,i)=>this.renderSpan(t,i)):u`<span class="nbplay-zone-map-empty">${this.emptyText}</span>`}
    </div>`}renderSpan(e,t){let i=Math.min(e.low,e.high),n=Math.max(e.low,e.high),s=i/128*100,a=(n-i+1)/128*100,o=`${e.name??`Zone ${t+1}`}: ${_(i)}\u2013${_(n)}`;return u`<button
      type="button"
      class="nbplay-zone-map-span ${t===this.selected?"selected":""}"
      data-index=${t}
      title=${o}
      style="left:${s}%;width:${a}%;background:${e.color??Ut(t)}"
      @click=${()=>this.emitDetail("nbplay-zone-select",{index:t})}
    ></button>`}};k("nbplay-zone-map",Ft);var zt=class extends v{static properties={zones:{attribute:!1},selected:{type:Number},disabled:{type:Boolean,reflect:!0}};constructor(){super(),this.zones=[],this.selected=-1,this.disabled=!1}render(){return u`${this.zones.map((e,t)=>this.renderRow(e,t))}`}renderRow(e,t){let i=s=>s.stopPropagation(),n=(s,a)=>u`<label class="nbplay-zone-list-note">
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
      </label>`;return u`<div
      class="nbplay-zone-list-row ${t===this.selected?"selected":""}"
      data-index=${t}
      @click=${()=>this.emitDetail("nbplay-zone-select",{index:t})}
    >
      <span
        class="nbplay-zone-list-swatch"
        style="background:${e.color??Ut(t)}"
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
    </div>`}commit(e,t,i){let n=[...this.zones];n[e]={...n[e],[t]:i},this.zones=n,this.emitDetail("change",{index:e,field:t,value:i})}};k("nbplay-zone-list",zt);function nr(){let r=globalThis;return(!r.__nbplay||typeof r.__nbplay!="object")&&(r.__nbplay={}),r.__nbplay}function w(r){return r?globalThis.__nbplay?.[r]:void 0}function Ee(r){let e=nr();return e[r]||(e[r]={}),e[r]}function Ht(r,e){w(r)?.noteListeners?.forEach(i=>i(e))}function Kt(r,e,t){if(!r||!(e>=0))return;let i=Ee(r);i.claims||(i.claims={}),i.claims[e]||(i.claims[e]={}),i.claims[e][t]=!0}function Gt(r,e,t){let i=w(r)?.claims?.[e];i&&delete i[t]}function Wt(r,e){let t=w(r)?.claims?.[e];return t?.launcher?"launcher":t?.timeline?"timeline":void 0}function Zn(r){if(r.audioCtx&&r.audioCtx.state!=="closed")return r.audioCtx;let e=z();return e&&(r.audioCtx=e),e}function sr(r){return r.clock||(r.clock=Yn(r)),r.clock}function se(r,e){let t=Number(r),i=Number(e);return(t>0?t:4)*4/(i>0?i:4)}function Ue(r,e,t){let i=Number(r);return Number.isFinite(i)?Math.max(t,i):e}function Yn(r={}){let e=!1,t=!1,i=120,n=!1,s=4,a={enabled:!1,startBeat:0,endBeat:16},o=0,l=0,c=null,h=new Set;function p(){return performance.now()/1e3}function d(y){return y?y.currentTime:p()}function m(y){return e?o+(y-l)*(i/60):o}function g(y){if(!a.enabled||a.endBeat<=a.startBeat||y<a.endBeat)return y;let S=a.endBeat-a.startBeat;return a.startBeat+(y-a.startBeat)%S}function f(y){let S={type:y,beat:E.beat()};h.forEach(C=>{try{C(S)}catch(T){console.warn("nbplay clock listener failed",T)}})}function $(){if(r.audioCtx&&r.audioCtx.state==="closed"&&delete r.audioCtx,!r.audioCtx){let S=z();S&&(r.audioCtx=S)}let y=r.audioCtx||null;if(y!==c){let S=g(m(d(c)));c=y,o=S,l=d(y)}return y}function b(){let y=$(),S=d(y);o=g(m(S)),l=S}let E={get playing(){return e},get recording(){return t},get bpm(){return i},get beatsPerBar(){return s},get loop(){return{...a}},context(){return $()},now(){return d($())},beat(){return E.beatAt(E.now())},beatAt(y){return g(m(y))},ctxTimeAt(y){return $(),l+(y-o)*(60/i)},secondsPerBeat(){return 60/i},play(){if(e)return;let y=$();y&&y.state==="suspended"&&y.resume?.(),l=d(y),e=!0,f("play")},stop(){if(!e)return;let y=E.beat();e=!1,o=y,f("stop")},seek(y){let S=$();o=Ue(y,0,0),l=d(S),f("seek")},setTempo(y){n=!0;let S=Ue(y,i,1);S!==i&&(b(),i=S,f("tempo"))},adoptTempo(y){return n||E.setTempo(y),i},setBeatsPerBar(y){let S=Ue(y,s,.25);S!==s&&(s=S,f("timesig"))},setLoop(y,S,C){let T={enabled:!!y,startBeat:Ue(S,0,0),endBeat:Ue(C,0,0)};T.enabled===a.enabled&&T.startBeat===a.startBeat&&T.endBeat===a.endBeat||(b(),a=T,f("loop"))},setRecording(y){let S=!!y;S!==t&&(t=S,f("record"))},subscribe(y){return h.add(y),()=>{h.delete(y)}}};return E}function rr(r,e,t){let i={},n=null,s=null,a=null;function o(){let c=String(r.get("session_id")||"");return c?sr(Ee(c)):(n||(n=Yn(i)),n)}function l(c){let h=o();return h===s||(a?.(),s=h,a=h.subscribe(e),c&&t?.(h)),h}return l(!1),r.on("change:session_id",()=>l(!0)),{clock:()=>l(!0),shared:()=>!!r.get("session_id"),dispose(){a?.(),a=null,s=null,i.audioCtx&&i.audioCtx.state!=="closed"&&i.audioCtx.close(),delete i.audioCtx}}}function H(r,e,t){let i=[],s=rr({get:a=>a==="session_id"?r.sessionId:void 0,set:()=>{},save_changes:()=>{},on:(a,o)=>{a==="change:session_id"&&i.push(o)}},e,t);return{clock:s.clock,shared:s.shared,dispose:s.dispose,rebind:()=>i.forEach(a=>a())}}var Qn=30,Xn=300,ar=50,or=250,jt=class extends v{static properties={sessionId:{type:String,attribute:"session-id",reflect:!0},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},loopEnabled:{type:Boolean,attribute:"loop-enabled"},loopStartBar:{type:Number,attribute:"loop-start-bar"},loopEndBar:{type:Number,attribute:"loop-end-bar"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},isRecording:{type:Boolean,attribute:"is-recording",reflect:!0},currentBeat:{attribute:!1},barNumber:{attribute:!1},beatInBar:{attribute:!1},undoRequest:{attribute:!1},redoRequest:{attribute:!1}};binding=null;unbindShortcuts=null;tickTimer=null;lastSyncedBeat=0;lastSyncMs=0;constructor(){super(),this.sessionId="",this.bpm=120,this.timeSignatureNum=4,this.timeSignatureDen=4,this.loopEnabled=!1,this.loopStartBar=0,this.loopEndBar=4,this.isPlaying=!1,this.isRecording=!1,this.currentBeat=0,this.barNumber=0,this.beatInBar=0}clock(){if(!this.binding){this.binding=H(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.pushLoop(e),this.pullState(e),e.playing&&this.startTicking(e.beat())}return this.binding.clock()}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-transport"),this.clock(),this.unbindShortcuts=le(this,{Space:()=>this.togglePlay(),"Shift+Space":()=>this.stopAndRewind(),r:()=>this.toggleRecord(),l:()=>this.toggleLoop(),ArrowUp:()=>this.nudgeTempo(1),ArrowDown:()=>this.nudgeTempo(-1),"Shift+ArrowUp":()=>this.nudgeTempo(10),"Shift+ArrowDown":()=>this.nudgeTempo(-10)}),this.addEventListener("keydown",this.onUndoKey)}disconnectedCallback(){super.disconnectedCallback(),this.stopTicking(),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.removeEventListener("keydown",this.onUndoKey),this.binding?.dispose(),this.binding=null}beatsPerBar(){return se(this.timeSignatureNum,this.timeSignatureDen)}pushTempo(e){e.setTempo(Number(this.bpm))}joinTempo(e){let t=e.adoptTempo(Number(this.bpm));t!==Number(this.bpm)&&(this.bpm=t,this.set({bpm:t}))}pushLoop(e){let t=this.beatsPerBar();e.setBeatsPerBar(t),e.setLoop(!!this.loopEnabled,(Number(this.loopStartBar)||0)*t,(Number(this.loopEndBar)||0)*t)}writePosition(e){let t=this.beatsPerBar(),i=Number.isFinite(e)?Math.max(0,e):0;this.currentBeat=i,this.barNumber=Math.floor(i/t),this.beatInBar=Math.floor(i%t)}pullState(e){this.isPlaying=e.playing,this.isRecording=e.recording,this.writePosition(e.beat())}status(e){this.emitDetail("nbplay-status",{values:{isPlaying:this.isPlaying,isRecording:this.isRecording,currentBeat:this.currentBeat,barNumber:this.barNumber,beatInBar:this.beatInBar},save:e})}set(e){this.emitDetail("nbplay-set",{values:e})}tick=()=>{let e=this.clock().beat();this.writePosition(e);let t=performance.now(),i=!1;Math.floor(e)!==Math.floor(this.lastSyncedBeat)&&t-this.lastSyncMs>=or&&(this.lastSyncedBeat=e,this.lastSyncMs=t,i=!0),this.status(i)};startTicking(e){this.stopTicking(),this.lastSyncedBeat=e,this.lastSyncMs=performance.now(),this.tickTimer=setInterval(this.tick,ar)}stopTicking(){this.tickTimer!==null&&(clearInterval(this.tickTimer),this.tickTimer=null)}onClockEvent=e=>{let t=this.clock();switch(e.type){case"play":this.isPlaying=!0,this.writePosition(e.beat),this.status(!0),this.startTicking(e.beat);break;case"stop":this.stopTicking(),this.isPlaying=!1,this.writePosition(e.beat),this.status(!0);break;case"seek":this.lastSyncedBeat=e.beat,this.writePosition(e.beat),this.status(!0);break;case"tempo":Number(this.bpm)!==t.bpm&&(this.bpm=t.bpm,this.set({bpm:t.bpm}));break;case"record":!!this.isRecording!==t.recording&&(this.isRecording=t.recording,this.status(!0));break;case"loop":{let i=this.beatsPerBar(),n=t.loop,s=Math.round(n.startBeat/i),a=Math.round(n.endBeat/i);(!!this.loopEnabled!==n.enabled||Number(this.loopStartBar)!==s||Number(this.loopEndBar)!==a)&&(this.loopEnabled=n.enabled,this.loopStartBar=s,this.loopEndBar=a,this.set({loopEnabled:n.enabled,loopStartBar:s,loopEndBar:a}));break}case"timesig":break}};onRebind=e=>{this.stopTicking(),this.joinTempo(e),this.pushLoop(e),this.pullState(e),this.status(!0),e.playing&&this.startTicking(e.beat())};updated(e){if(!this.binding)return;if(e.has("sessionId")&&e.get("sessionId")!==void 0){this.binding.rebind();return}let t=this.clock();e.has("bpm")&&Number(this.bpm)!==t.bpm&&this.pushTempo(t),(e.has("timeSignatureNum")||e.has("timeSignatureDen")||e.has("loopEnabled")||e.has("loopStartBar")||e.has("loopEndBar"))&&this.pushLoop(t),(e.has("isPlaying")||e.has("isRecording"))&&(!!this.isPlaying!==t.playing||!!this.isRecording!==t.recording)&&(this.isPlaying=t.playing,this.isRecording=t.recording,this.status(!0))}command(e){let t=this.clock();switch(e.action){case"play":t.playing||t.play();break;case"stop":t.playing&&t.stop();break;case"seek":{let i=Number(e.beat);Number.isFinite(i)&&t.seek(Math.max(0,i));break}case"record":{let i=!!e.on;t.setRecording(i),i&&!t.playing&&t.play();break}}this.pullState(t),this.status(!0)}togglePlay(){let e=this.clock();e.playing?e.stop():e.play()}toggleRecord(){let e=this.clock(),t=!e.recording;e.setRecording(t),t&&e.play()}stopAndRewind(){let e=this.clock();e.stop(),e.setRecording(!1),e.seek(0)}toggleLoop(){this.loopEnabled=!this.loopEnabled,this.set({loopEnabled:this.loopEnabled}),this.pushLoop(this.clock())}nudgeTempo(e){let t=N(Math.round(this.clock().bpm)+e,Qn,Xn);this.clock().setTempo(t)}onUndoKey=e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey)return;let t=e.target;if(t?.tagName==="INPUT"||t?.tagName==="TEXTAREA"||t?.isContentEditable)return;let i=e.key.toLowerCase();if(i!=="z"&&i!=="y")return;e.preventDefault(),e.stopPropagation();let n=i==="y"||e.shiftKey?"redo":"undo";n==="redo"?this.redoRequest=(this.redoRequest||0)+1:this.undoRequest=(this.undoRequest||0)+1,this.emitDetail("nbplay-request",{name:n})};render(){let e=this.beatsPerBar(),t=n=>n.stopPropagation(),i=n=>{n.stopPropagation(),this.clock().setTempo(n.detail.value)};return u`<nbplay-transport-buttons
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
        .min=${Qn}
        .max=${Xn}
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
      </div>`}};k("nbplay-transport",jt);function lr(r){let e=r.channel_index||0;if(r.match)return r;let t=r.zone||"all";return t==="upper"||t==="lower"?{channel_index:e,match:"zone",zone:t}:{channel_index:e,match:"all"}}function Jn(r,e,t){let i=[];for(let n of r){let s=lr(n),a=!1;switch(s.match){case"all":a=!0;break;case"zone":a=s.zone===t;break;case"octave":{a=Math.floor(e/12)-1===s.octave;break}case"note":a=e===s.note;break;case"notes":a=s.notes.includes(e);break}a&&i.push(s.channel_index)}return i}function xe(r,e,t,i,n){if(!r||e.length===0)return!1;let s=w(r);if(!s?.samplers)return!1;let a=!1;for(let o of Jn(e,t,i)){let l=s.samplers[o];l&&(l.triggerNote(t,n),a=!0)}return a}function Ne(r,e,t,i){if(!r||e.length===0)return!1;let n=w(r);if(!n?.samplers)return!1;let s=!1;for(let a of Jn(e,t,i)){let o=n.samplers[a];o&&(o.releaseNote(t),s=!0)}return s}var Z={type:"sine",amplitude:.8,osc2Type:"saw",osc2Level:0,osc2Semitones:0,osc2Detune:0,noiseLevel:0,filterType:"lowpass",cutoff:2e4,resonance:.7,filterEnv:0,filterAttack:.005,filterDecay:.2,filterSustain:0,filterRelease:.2,attack:.005,decay:.1,sustain:1,release:.05,lfoTarget:"off",lfoRate:5,lfoDepth:.5},is=.005;function Oi(r,e,t,i,n,s,a){let o=e+s+a;return r.setValueAtTime(t,e),r.linearRampToValueAtTime(i,e+s),r.linearRampToValueAtTime(n,o),(l,c)=>{let h=r;l>=o?(r.cancelScheduledValues(l),r.setValueAtTime(n,l)):typeof h.cancelAndHoldAtTime=="function"?h.cancelAndHoldAtTime(l):(r.cancelScheduledValues(l),r.setValueAtTime(n,l));let p=l+Math.max(.005,c);return r.linearRampToValueAtTime(t,p),p}}var es=new WeakMap;function Vi(r){let e=es.get(r);if(!e){e=r.createBuffer(1,r.sampleRate*2,r.sampleRate);let t=e.getChannelData(0);for(let i=0;i<t.length;i++)t[i]=Math.random()*2-1;es.set(r,e)}return e}function ts(r){return r==="saw"?"sawtooth":r==="square"||r==="triangle"?r:"sine"}function cr(r){let e=Math.max(0,Math.min(1,r.lfoDepth));return r.lfoTarget==="pitch"?e*200:r.lfoTarget==="filter"?e*3600:r.lfoTarget==="amplitude"?e/2:0}function Zt(r,e,t,i,n,s){let a=t.type==="noise"?null:r.createOscillator(),o;if(a)o=a;else{let P=r.createBufferSource();P.buffer=Vi(r),P.loop=!0,o=P}let l=r.createOscillator(),c=r.createBufferSource();c.buffer=Vi(r),c.loop=!0;let h=r.createOscillator(),p=r.createGain(),d=r.createGain(),m=r.createGain(),g=r.createGain(),f=r.createBiquadFilter(),$=r.createGain(),b=r.createGain(),E=r.createGain();o.connect(p).connect(f),l.connect(d).connect(f),c.connect(m).connect(f),f.connect($).connect(b).connect(E).connect(e),h.connect(g);let y="",S=t,C=(P,q,ie,re)=>{let U=(fn,yn)=>{re===null?fn.value=yn:fn.setTargetAtTime(yn,re,.01)};a&&(a.type=ts(P.type),U(a.frequency,q)),l.type=ts(P.osc2Type),U(l.frequency,q),U(l.detune,P.osc2Semitones*100+P.osc2Detune),U(d.gain,Math.max(0,P.osc2Level)),U(m.gain,Math.max(0,P.noiseLevel)),f.type=["lowpass","highpass","bandpass"].includes(P.filterType)?P.filterType:"lowpass",U(f.frequency,P.cutoff),U(f.Q,P.resonance),U(E.gain,Math.max(0,ie)),U(h.frequency,P.lfoRate);let ge=cr(P);U(g.gain,ge),U(b.gain,P.lfoTarget==="amplitude"?1-ge:1),P.lfoTarget!==y&&(g.disconnect(),P.lfoTarget==="pitch"?(a&&g.connect(a.detune),g.connect(l.detune)):P.lfoTarget==="filter"?g.connect(f.detune):P.lfoTarget==="amplitude"&&g.connect(b.gain),y=P.lfoTarget),S=P};C(t,i,n,null);let T=Math.max(is,t.attack),R=Oi($.gain,s,0,1,Math.max(0,Math.min(1,t.sustain)),T,Math.max(0,t.decay)),W=t.filterEnv*1200,j=Oi(f.detune,s,0,W,W*Math.max(0,Math.min(1,t.filterSustain)),Math.max(0,t.filterAttack),Math.max(0,t.filterDecay)),F=[o,l,c,h];for(let P of F)P.start(s);let ue=!1,ve={onended:null,release(P){let q=Math.max(P,s);j(q,S.filterRelease);let ie=R(q,S.release);for(let re of F)re.stop(ie);return ie},stop(){for(let P of F)try{P.stop(0)}catch{}te()},update(P,q,ie){C(P,q,ie,r.currentTime)}},te=()=>{if(!ue){ue=!0;for(let P of[...F,p,d,m,g,f,$,b,E])try{P.disconnect()}catch{}ve.onended?.()}};return o.onended=te,ve}function He(r,e,t,i,n,s,a,o=()=>{}){let l=Math.max(0,Math.min(1,t.amplitude))*(n/127),c=Zt(r,e,t,Gi(i),l,s);return c.onended=o,c.release(s+Math.max(.001,a)),()=>c.stop()}function Fi(r,e,t,i){let n=r.createOscillator(),s=r.createOscillator(),a=r.createGain(),o=r.createGain();return n.frequency.value=t,s.frequency.value=t*i.ratio,a.gain.value=i.index*t*i.ratio,s.connect(a),a.connect(n.frequency),n.connect(o),o.connect(e),{carrier:n,modulator:s,depth:a,level:o}}function Ui(r){for(let e of[r.modulator,r.depth,r.carrier,r.level])try{e.disconnect()}catch{}}function Ke(r,e,t,i,n,s,a,o=()=>{}){let l=Math.max(0,Math.min(1,t.amplitude))*(n/127),c=Fi(r,e,Gi(i),t),h=Math.min(Math.max(0,t.attack),a),p=Math.min(s+h+Math.max(0,t.decay),s+a),d=s+a+Math.max(.005,t.release),m=c.level.gain;m.setValueAtTime(0,s),m.linearRampToValueAtTime(l,s+h),m.linearRampToValueAtTime(l*t.sustain,Math.max(p,s+h)),m.setValueAtTime(l*t.sustain,s+a),m.linearRampToValueAtTime(0,d);let g=!1,f=()=>{g||(g=!0,Ui(c),o())};c.carrier.onended=f;for(let $ of[c.modulator,c.carrier])$.start(s),$.stop(d);return()=>{for(let $ of[c.modulator,c.carrier])try{$.stop(0)}catch{}f()}}var zi=["kick","snare","hat","clap","tom"];function ze(r,e,t,i=1){let n=r.createGain();return n.gain.setValueAtTime(0,e),n.gain.linearRampToValueAtTime(i,e+.002),n.gain.exponentialRampToValueAtTime(i*.001,t),n.gain.setValueAtTime(0,t),n}function Hi(r,e,t,i,n,s=()=>{}){let a=2**(Math.max(-48,Math.min(48,t.tune))/12),o=Math.max(.01,t.decay),l=Math.max(0,Math.min(1,t.tone)),c=n+o,h=r.createGain();h.gain.value=Math.max(0,Math.min(127,i))/127,h.connect(e);let p=[],d=[h],m=(y,S,C=.7)=>{let T=r.createBufferSource();T.buffer=Vi(r),T.loop=!0;let R=r.createBiquadFilter();return R.type=y,R.frequency.value=Math.min(18e3,S),R.Q.value=C,T.connect(R),p.push(T),d.push(R),R},g=(y,S,C,T)=>{let R=r.createOscillator();return R.type=y,R.frequency.setValueAtTime(S,n),R.frequency.exponentialRampToValueAtTime(C,n+T),p.push(R),R},f=(y,S)=>{y.connect(S).connect(h),d.push(S)};if(t.sound==="kick"||t.sound==="tom"){let y=(t.sound==="kick"?50:110)*a,S=t.sound==="kick"?3.5:1.6;if(f(g("sine",y*S,y,.06),ze(r,n,c)),l>0){let C=m(t.sound==="kick"?"highpass":"bandpass",t.sound==="kick"?2e3:800);f(C,ze(r,n,n+.03,l*.6))}}else if(t.sound==="snare"){let y=185*a;f(g("triangle",y*1.3,y,.03),ze(r,n,n+Math.min(o,.12),1-l*.6)),f(m("highpass",1200*a),ze(r,n,c,l))}else if(t.sound==="hat")f(m("highpass",(5e3+7e3*l)*a),ze(r,n,c));else if(t.sound==="clap"){let y=m("bandpass",(900+1600*l)*a,2),S=r.createGain();S.gain.setValueAtTime(0,n);for(let T=0;T<3;T++){let R=n+T*.012;S.gain.setValueAtTime(1,R),S.gain.exponentialRampToValueAtTime(.1,R+.01)}let C=n+.036;S.gain.setValueAtTime(1,C),S.gain.exponentialRampToValueAtTime(.001,Math.max(C+.01,c)),S.gain.setValueAtTime(0,Math.max(C+.01,c)),f(y,S)}let $=Math.max(c,n+.05)+.01,b=!1,E=()=>{if(!b){b=!0;for(let y of[...p,...d])try{y.disconnect()}catch{}s()}};for(let y of p)y.start(n),y.stop($);return p.length>0?p[0].onended=E:E(),()=>{for(let y of p)try{y.stop(0)}catch{}E()}}function Ki(r,e,t){let{envelope:i,peak:n,at:s,duration:a,region:o}=t,l=r.createBufferSource();l.buffer=t.buffer,l.playbackRate.value=t.playbackRate,l.loop=t.loop;let c=r.createGain();c.connect(e),l.connect(c);let h=Oi(c.gain,s,0,n,i.sustain*n,Math.max(i.attack,is),i.decay);o?l.start(s,o.offset,o.length):l.start(s);let p=null;return a!==void 0&&(p=s+Math.max(.001,a),l.stop(h(p,i.release)+.01)),{sourceNode:l,gainNode:c,releaseTime:p}}function Gi(r){return 440*Math.pow(2,(r-69)/12)}function Pe(){let r="",e=-1,t=null,i=null,n=!1,s=new Map;function a(){let o=r?w(r):void 0;return o?.audioCtx&&e>=0&&o.channels?.[e]?(t!==o.audioCtx&&(n&&t&&t.state!=="closed"&&t.close(),t=o.audioCtx,n=!1),i=o.channels[e].gain):t||(t=z(),n=t!==null,i=null),t?.state==="suspended"&&t.resume(),t}return{setSession(o,l){r=o||"",e=Number.isFinite(l)?l:-1},noteOn(o,l,c){let h=a();if(!h)return;s.has(o)&&this.noteOff(o);let p=h.createOscillator(),d=h.createGain();p.type="sine",p.frequency.value=Gi(o);let m=h.currentTime,g=l/127*(c?1:.3);d.gain.setValueAtTime(0,m),d.gain.linearRampToValueAtTime(g,m+.005),c&&(d.gain.linearRampToValueAtTime(0,m+c),p.stop(m+c+.05)),p.connect(d),d.connect(i||h.destination),p.start(m),s.set(o,{osc:p,gain:d}),c&&setTimeout(()=>{s.get(o)?.osc===p&&s.delete(o)},(c+.1)*1e3)},noteOff(o){let l=s.get(o);if(!l||!t)return;let c=t.currentTime;l.gain.gain.cancelScheduledValues(c),l.gain.gain.setValueAtTime(l.gain.gain.value,c),l.gain.gain.linearRampToValueAtTime(0,c+.05);try{l.osc.stop(c+.06)}catch{}s.delete(o)},stopAll(){for(let o of s.values()){try{o.osc.stop()}catch{}o.gain.disconnect()}s.clear()},destroy(){this.stopAll(),n&&t&&t.state!=="closed"&&t.close(),t=null,i=null,n=!1}}}var ur=.3;function ns(r,e){let t=Number(r);return Number.isFinite(t)?Math.max(1,Math.floor(t)):e}function dr(r,e){return r.length===e.length&&r.every((t,i)=>t===e[i])}var Yt=class extends v{static properties={rows:{type:Number},cols:{type:Number},velocity:{type:Number},velocitySensitive:{type:Boolean,attribute:"velocity-sensitive"},padNotes:{attribute:!1},padVelocities:{attribute:!1},padActions:{attribute:!1},samplerRouting:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},activePads:{attribute:!1},lastNoteEvent:{attribute:!1},lastPadEvent:{attribute:!1}};voices=Pe();held=new Set;heldNotes=new Map;constructor(){super(),this.rows=4,this.cols=4,this.velocity=100,this.velocitySensitive=!0,this.padNotes=Array.from({length:16},(e,t)=>36+t),this.padVelocities=[],this.padActions=[],this.samplerRouting=[],this.sessionId="",this.channelIndex=-1,this.activePads=[],this.lastNoteEvent={},this.lastPadEvent={}}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-pad"),this.voices.setSession(this.sessionId,this.channelIndex)}disconnectedCallback(){super.disconnectedCallback(),this.releaseAll(),this.voices.destroy()}dims(){return{rows:ns(this.rows,4),cols:ns(this.cols,4)}}notes(){return Array.isArray(this.padNotes)?this.padNotes:[]}effectiveVelocities(){let e=Array.isArray(this.padVelocities)?this.padVelocities:[],t=O(this.velocity);return e.map(i=>i??t)}actions(){let{rows:e,cols:t}=this.dims();return $e(this.padActions,this.notes(),this.effectiveVelocities(),e*t)}pads(){let e=this.notes(),t=this.effectiveVelocities();return this.actions().map((i,n)=>{let s=t[n]??100;return i.type==="note"&&!i.label?{note:i.note,velocity:s}:{note:e[n]??60,velocity:s,label:at(i)}})}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.voices.setSession(this.sessionId,this.channelIndex),e.has("velocity")&&e.get("velocity")!==void 0&&this.resetPadVelocities(O(this.velocity))}resetPadVelocities(e){let{rows:t,cols:i}=this.dims(),n=Array.isArray(this.padVelocities)?this.padVelocities:[],s=n.length||t*i,a=Array.from({length:s},()=>e),o=$e(this.padActions,this.notes(),a,t*i).map(c=>c.type==="note"?{...c,velocity:e}:c),l=!dr(n,a)||JSON.stringify(o)!==JSON.stringify(this.padActions);this.padVelocities=a,this.padActions=o,l&&this.set({padVelocities:a,padActions:o})}set(e){this.emitDetail("nbplay-set",{values:e})}status(){this.activePads=Array.from(this.held),this.emitDetail("nbplay-status",{values:{activePads:this.activePads,lastNoteEvent:this.lastNoteEvent,lastPadEvent:this.lastPadEvent},save:!0})}triggerPad(e,t){let i=this.actions()[e]??{type:"note",note:this.notes()[e]??60};if(this.held.add(e),i.type==="note"){let n=i.note,s=O(t,i.velocity??100);this.heldNotes.set(e,n),xe(this.sessionId,this.samplerRouting||[],n,"upper",s)||this.voices.noteOn(n,s,ur),this.lastNoteEvent={note:n,velocity:s,type:"on"},this.lastPadEvent={pad:e,event:"on",velocity:s,action:i}}else i.type==="trait"&&this.set({[i.trait]:i.value}),this.lastPadEvent={pad:e,event:"trigger",velocity:t,action:i};this.status()}releasePad(e){if(!this.held.delete(e))return;let t=this.heldNotes.get(e);this.heldNotes.delete(e);let i=this.actions()[e];t!==void 0&&(Ne(this.sessionId,this.samplerRouting||[],t,"upper")||this.voices.noteOff(t),this.lastNoteEvent={note:t,velocity:0,type:"off"}),i&&(this.lastPadEvent={pad:e,event:"off",velocity:0,action:i}),this.status()}releaseAll(){for(let e of Array.from(this.held))this.releasePad(e)}onPadChange(e){e.stopPropagation();let{index:t,field:i,value:n}=e.detail;if(i==="note"){let s=[...this.notes()];if(t>=s.length)return;s[t]=n,this.padNotes=s,this.set({padNotes:s})}else{let s=[...this.effectiveVelocities()];if(t>=s.length)return;s[t]=n,this.padVelocities=s,this.set({padVelocities:s})}}render(){let{rows:e,cols:t}=this.dims(),i=s=>s.stopPropagation(),n=s=>{s.stopPropagation();let a=O(s.detail.value);a!==this.velocity&&(this.velocity=a,this.set({velocity:a}))};return u`<nbplay-header badge="pads"></nbplay-header>
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
      </div>`}};k("nbplay-pads",Yt);function we(r,e){let t=Array.isArray(r)?r.map(String):[];return t.length===0?x:u`<select
    class="nbplay-preset-select"
    aria-label="Load a preset"
    @change=${i=>{i.stopPropagation();let n=i.target,s=n.value;n.value="",s&&e(s)}}
  >
    <option value="" selected>Preset…</option>
    ${t.map(i=>u`<option value=${i}>${i}</option>`)}
  </select>`}var ss=[{value:"sine",label:"Sine"},{value:"triangle",label:"Triangle"},{value:"square",label:"Square"},{value:"saw",label:"Saw"},{value:"noise",label:"Noise"}],pr=ss.filter(({value:r})=>r!=="noise"),hr=[{value:"lowpass",label:"Low pass"},{value:"highpass",label:"High pass"},{value:"bandpass",label:"Band pass"}],mr=[{value:"off",label:"Off"},{value:"pitch",label:"Pitch"},{value:"filter",label:"Filter"},{value:"amplitude",label:"Level"}],br=20,fr=8e3,Wi=class{ctx=null;voice=null;start(e,t,i){this.stop();let n=z({sampleRate:i});return n?(this.ctx=n,n.state==="suspended"&&n.resume?.(),this.voice=Zt(n,n.destination,e,t,e.amplitude,n.currentTime),!0):!1}update(e,t){this.voice?.update(e,t,e.amplitude)}stop(){this.voice?.stop(),this.voice=null,this.ctx&&(this.ctx.close(),this.ctx=null)}},Qt=class extends v{static properties={oscillatorType:{type:String,attribute:"oscillator-type"},frequency:{type:Number},amplitude:{type:Number},sampleRate:{type:Number,attribute:"sample-rate"},osc2Type:{type:String,attribute:"osc2-type"},osc2Level:{type:Number,attribute:"osc2-level"},osc2Semitones:{type:Number,attribute:"osc2-semitones"},osc2Detune:{type:Number,attribute:"osc2-detune"},noiseLevel:{type:Number,attribute:"noise-level"},filterType:{type:String,attribute:"filter-type"},cutoff:{type:Number},resonance:{type:Number},filterEnv:{type:Number,attribute:"filter-env"},filterAttack:{type:Number,attribute:"filter-attack"},filterDecay:{type:Number,attribute:"filter-decay"},filterSustain:{type:Number,attribute:"filter-sustain"},filterRelease:{type:Number,attribute:"filter-release"},attack:{type:Number},decay:{type:Number},sustain:{type:Number},release:{type:Number},lfoTarget:{type:String,attribute:"lfo-target"},lfoRate:{type:Number,attribute:"lfo-rate"},lfoDepth:{type:Number,attribute:"lfo-depth"},waveform:{attribute:!1},presetNames:{attribute:!1},presetRequest:{type:String,attribute:"preset-request"},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0}};tone=new Wi;registration=null;liveNotes=new Set;constructor(){super();let{type:e,...t}=Z;Object.assign(this,t),this.oscillatorType=e,this.frequency=440,this.amplitude=.5,this.sampleRate=44100,this.waveform=null,this.presetNames=[],this.presetRequest="",this.sessionId="",this.channelIndex=-1,this.isPlaying=!1}patch(){let e=(i,n)=>{let s=Number(i);return Number.isFinite(s)?s:n},t={...Z};for(let i of Object.keys(Z)){if(i==="type")continue;let n=this[i];t[i]=typeof Z[i]=="number"?e(n,Z[i]):String(n??Z[i])}return t.type=this.oscillatorType||"sine",t}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-synth"),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.register()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.unregister(),this.tone.stop()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.register(),e.has("isPlaying")&&e.get("isPlaying")!==void 0?this.isPlaying?this.startTone():this.tone.stop():this.isPlaying&&(e.has("oscillatorType")?this.startTone():this.tone.update(this.patch(),Number(this.frequency)))}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.register()};unregister(){if(this.liveNotes.forEach(n=>n()),this.liveNotes.clear(),!this.registration)return;let{bus:e,idx:t,entry:i}=this.registration;e.instruments?.[t]===i&&delete e.instruments[t],this.registration=null}register(){let e=this.sessionId,t=Number(this.channelIndex);if(this.unregister(),!e||!(t>=0))return;let i=w(e);if(!i)return;let n=i.instruments||{};i.instruments=n;let s={scheduleNote:(a,o,l,c)=>{let h=i.audioCtx,p=i.channels?.[t]?.gain||i.masterGain;if(!h||!p)return;let d=He(h,p,this.patch(),a,o,l,c,()=>this.liveNotes.delete(d));return this.liveNotes.add(d),d}};n[t]=s,this.registration={bus:i,idx:t,entry:s}}startTone(){this.tone.start(this.patch(),Number(this.frequency),Number(this.sampleRate))||(this.isPlaying=!1,this.status())}stop(){this.isPlaying&&(this.isPlaying=!1,this.tone.stop(),this.status())}status(){this.emitDetail("nbplay-status",{values:{isPlaying:this.isPlaying},save:!0})}set(e){this.emitDetail("nbplay-set",{values:e})}choice(e,t,i,n){return u`<nbplay-segmented
      class=${e}
      label=${t}
      .options=${n}
      .value=${this[i]}
      @change=${s=>{s.stopPropagation();let a=s.detail.value;a!==this[i]&&(this[i]=a,this.set({[i]:a}))}}
    ></nbplay-segmented>`}param(e,t,i,n,s,a,o,l,c={}){let h=p=>{p.stopPropagation();let d=p.detail.value;d!==this[i]&&(this[i]=d,this.set({[i]:d}))};return u`<nbplay-param
      class=${e}
      .label=${t}
      .kind=${n}
      .control=${c.control??"slider"}
      .scale=${c.scale??"linear"}
      .unit=${c.unit??""}
      .value=${Number(this[i])}
      .min=${s}
      .max=${a}
      .step=${o}
      .defaultValue=${l}
      .precision=${c.precision??2}
      .disabled=${c.disabled??!1}
      @input=${h}
      @change=${h}
    ></nbplay-param>`}envelopeSection(e,t,i,n){let[s,a,o,l]=i;return u`<div class="nbplay-synth-envelope ${e}">
      <span class="nbplay-synth-section-title">${t}</span>
      <nbplay-envelope
        .attack=${Number(this[s])}
        .decay=${Number(this[a])}
        .sustain=${Number(this[o])}
        .release=${Number(this[l])}
      ></nbplay-envelope>
      <div class="nbplay-synth-env-controls">
        ${this.param(`${e}-attack`,"Attack",s,"seconds",0,2,.001,n[0],{control:"dial"})}
        ${this.param(`${e}-decay`,"Decay",a,"seconds",0,2,.001,n[1],{control:"dial"})}
        ${this.param(`${e}-sustain`,"Sustain",o,"percent",0,1,.01,n[2],{control:"dial"})}
        ${this.param(`${e}-release`,"Release",l,"seconds",0,5,.001,n[3],{control:"dial"})}
      </div>
    </div>`}requestPreset(e){this.presetRequest=`${Date.now()}:${e}`,this.emitDetail("nbplay-status",{values:{presetRequest:this.presetRequest},save:!0})}render(){let e=this.oscillatorType==="noise",t=Z;return u`<nbplay-header badge="synth"
        >${we(this.presetNames,i=>{this.requestPreset(i)})}</nbplay-header
      >
      <nbplay-waveform
        class="nbplay-synth-waveform"
        variant="glow"
        .data=${X(this.waveform)}
      ></nbplay-waveform>
      ${this.choice("nbplay-osc","Oscillator","oscillatorType",ss)}
      <div class="nbplay-synth-params">
        ${this.param("nbplay-freq","Frequency","frequency","hz",br,fr,.1,440,{scale:"log",disabled:e})}
        ${this.param("nbplay-amp","Amplitude","amplitude","float",0,1,.01,.8)}
      </div>
      <div class="nbplay-synth-section nbplay-synth-osc2">
        <span class="nbplay-synth-section-title">Oscillator 2</span>
        ${this.choice("nbplay-osc2","Wave","osc2Type",pr)}
        <div class="nbplay-synth-params">
          ${this.param("nbplay-osc2-level","Level","osc2Level","percent",0,1,.01,t.osc2Level)}
          ${this.param("nbplay-osc2-semitones","Semitones","osc2Semitones","int",-24,24,1,t.osc2Semitones,{unit:" st"})}
          ${this.param("nbplay-osc2-detune","Detune","osc2Detune","int",-100,100,1,t.osc2Detune,{unit:" ct"})}
          ${this.param("nbplay-noise-level","Noise","noiseLevel","percent",0,1,.01,t.noiseLevel)}
        </div>
      </div>
      <div class="nbplay-synth-section nbplay-synth-filter">
        <span class="nbplay-synth-section-title">Filter</span>
        ${this.choice("nbplay-filter-type","Type","filterType",hr)}
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
        ${this.choice("nbplay-lfo-target","Target","lfoTarget",mr)}
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
      </div>`}};k("nbplay-synth",Qt);var rs=[256,512,1024,2048,4096,8192,16384];function yr(r,e){let t=Math.log(e.maxFrequency/e.minFrequency);return Math.log(r/e.minFrequency)/t*e.width}function as(r,e,t){let i=e/2/r.length,n=t.maxFrequency/t.minFrequency,s=l=>t.minFrequency*n**(l/t.width),a=l=>r[Math.max(0,Math.min(r.length-1,l))],o=[];for(let l=0;l<t.width;l++){let c=s(l)/i,h=s(l+1)/i,p;if(Math.floor(h)>Math.floor(c)){p=-1/0;for(let m=Math.ceil(c);m<=Math.floor(h);m++)p=Math.max(p,a(m))}else{let m=Math.floor(c);p=a(m)+(a(m+1)-a(m))*(c-m)}let d=(p-t.minDb)/(t.maxDb-t.minDb);o.push(t.height*(1-Math.max(0,Math.min(1,d))))}return o}function os(r,e,t){let i=e/2/r.length,n=-1;for(let s=1;s<r.length;s++){let a=s*i;a<t.minFrequency||a>t.maxFrequency||(n<0||r[s]>r[n])&&(n=s)}return n<0||!(r[n]>t.minDb)?null:{frequency:n*i,db:r[n]}}function vr(r){return r>=1e3?`${(r/1e3).toFixed(r>=1e4?1:2)} kHz`:`${Math.round(r)} Hz`}var Xt=class extends v{static properties={fftSize:{type:Number,attribute:"fft-size"},smoothing:{type:Number},minDb:{type:Number,attribute:"min-db"},maxDb:{type:Number,attribute:"max-db"},minFrequency:{type:Number,attribute:"min-frequency"},maxFrequency:{type:Number,attribute:"max-frequency"},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},peak:{state:!0}};tapped=null;bins=new Float32Array(0);frame=0;observer;constructor(){super(),this.fftSize=2048,this.smoothing=.8,this.minDb=-100,this.maxDb=-20,this.minFrequency=20,this.maxFrequency=2e4,this.sessionId="",this.channelIndex=-1,this.peak=null}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-spectrum"),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.tap()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.observer?.disconnect(),this.observer=void 0,this.untap()}firstUpdated(){this.observer=new ResizeObserver(()=>this.draw()),this.observer.observe(this)}updated(e){e.has("sessionId")||e.has("channelIndex")?this.tap():(e.has("fftSize")||e.has("smoothing"))&&this.configure(),e.has("peak")||this.draw()}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.tap()};tap(){this.untap();let e=this.sessionId?w(this.sessionId):void 0,t=Number(this.channelIndex),i=t>=0?e?.channels?.[t]?.analyser:e?.masterAnalyser;if(!e?.audioCtx?.createAnalyser||!i)return;let n=e.audioCtx.createAnalyser();i.connect(n),this.tapped={source:i,analyser:n},this.configure(),this.frame=requestAnimationFrame(this.tick)}untap(){if(cancelAnimationFrame(this.frame),!!this.tapped){try{this.tapped.source.disconnect(this.tapped.analyser)}catch{}this.tapped=null,this.peak=null}}configure(){if(!this.tapped)return;let{analyser:e}=this.tapped;e.fftSize=rs.includes(this.fftSize)?this.fftSize:2048,e.smoothingTimeConstant=Math.max(0,Math.min(.99,Number(this.smoothing)||0)),this.bins=new Float32Array(e.frequencyBinCount)}tick=()=>{this.draw(),this.frame=requestAnimationFrame(this.tick)};scale(e,t){return{width:e,height:t,minDb:this.minDb,maxDb:this.maxDb,minFrequency:this.minFrequency,maxFrequency:this.maxFrequency}}draw(){let e=this.querySelector("canvas");if(!e)return;let t=e.clientWidth,i=e.clientHeight;if(t===0||i===0)return;let n=window.devicePixelRatio||1;e.width!==Math.round(t*n)&&(e.width=Math.round(t*n)),e.height!==Math.round(i*n)&&(e.height=Math.round(i*n));let s=e.getContext("2d");if(!s)return;s.setTransform(n,0,0,n,0,0);let a=this.scale(t,i);s.fillStyle=V(this,"--nbplay-chart-bg","#121214"),s.fillRect(0,0,t,i),s.strokeStyle=V(this,"--nbplay-chart-grid","#2f2f36"),s.fillStyle=V(this,"--nbplay-fg-muted","#a8a59c"),s.font="10px "+V(this,"--nbplay-font-mono","monospace"),s.lineWidth=1,s.setLineDash([3,4]),s.textBaseline="top";for(let d of[100,1e3,1e4]){if(d<=this.minFrequency||d>=this.maxFrequency)continue;let m=Math.round(yr(d,a))+.5;s.beginPath(),s.moveTo(m,0),s.lineTo(m,i),s.stroke(),s.fillText(d>=1e3?`${d/1e3}k`:`${d}`,m+3,2)}s.textBaseline="bottom";for(let d=Math.ceil(this.minDb/20)*20;d<this.maxDb;d+=20){if(d<=this.minDb)continue;let m=Math.round(i*(1-(d-this.minDb)/(this.maxDb-this.minDb)))+.5;s.beginPath(),s.moveTo(0,m),s.lineTo(t,m),s.stroke(),s.fillText(`${d} dB`,3,m-1)}if(s.setLineDash([]),!this.tapped||this.bins.length===0)return;let{analyser:o}=this.tapped;o.getFloatFrequencyData(this.bins);let l=o.context.sampleRate,c=as(this.bins,l,a),h=V(this,"--nbplay-chart-line","#f28c38");s.beginPath(),s.moveTo(0,i),c.forEach((d,m)=>s.lineTo(m,d)),s.lineTo(t,i),s.closePath(),s.globalAlpha=.25,s.fillStyle=h,s.fill(),s.globalAlpha=1,s.beginPath(),c.forEach((d,m)=>m===0?s.moveTo(m,d):s.lineTo(m,d)),s.strokeStyle=h,s.lineWidth=1.5,s.lineJoin="round",s.stroke();let p=os(this.bins,l,a);(Math.round(p?.frequency??-1)!==Math.round(this.peak?.frequency??-1)||Math.round((p?.db??0)*10)!==Math.round((this.peak?.db??0)*10))&&(this.peak=p)}render(){let e=Number(this.channelIndex)>=0?`Channel ${Number(this.channelIndex)+1}`:"Master";return u`<nbplay-header badge="spectrum"></nbplay-header>
      <canvas class="nbplay-spectrum-canvas"></canvas>
      <div class="nbplay-spectrum-info">
        <span class="nbplay-spectrum-source">${e}</span>
        <span class="nbplay-spectrum-peak"
          >${this.peak?`${vr(this.peak.frequency)}  ${this.peak.db.toFixed(1)} dB`:"\u2014"}</span
        >
        <label class="nbplay-spectrum-fft">
          FFT
          <select
            @change=${t=>{this.fftSize=Number(t.target.value),this.emitDetail("nbplay-set",{values:{fftSize:this.fftSize}})}}
          >
            ${rs.map(t=>u`<option value=${t} ?selected=${t===this.fftSize}>
                  ${t}
                </option>`)}
          </select>
        </label>
      </div>`}};k("nbplay-spectrum",Xt);var gr=-1,kr=8,Sr=80;function ls(r,e){(r?w(r):void 0)?.noteListeners?.forEach(i=>i(e)),document.dispatchEvent(new CustomEvent("nbplay-note",{detail:e}))}var Jt=class extends v{static properties={upperOctave:{type:Number,attribute:"upper-octave"},lowerOctave:{type:Number,attribute:"lower-octave"},velocity:{type:Number},sustainUpper:{type:Boolean,attribute:"sustain-upper"},sustainLower:{type:Boolean,attribute:"sustain-lower"},sustainGlobal:{type:Boolean,attribute:"sustain-global"},samplerRouting:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},activeNotes:{attribute:!1},lastNoteEvent:{attribute:!1}};voices=Pe();heldNotes=new Set;sustainedNotes=new Map;pressedKeys=new Map;velRepeatTimer=null;velRepeatCount=0;constructor(){super(),this.upperOctave=3,this.lowerOctave=4,this.velocity=100,this.sustainUpper=!1,this.sustainLower=!1,this.sustainGlobal=!1,this.samplerRouting=[],this.sessionId="",this.channelIndex=-1,this.activeNotes=[],this.lastNoteEvent={}}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-keyboard"),this.tabIndex=0,this.voices.setSession(this.sessionId,this.channelIndex),window.addEventListener("keydown",this.onKeyDown,!0),window.addEventListener("keyup",this.onKeyUp,!0),this.addEventListener("click",this.focusSelf),this.addEventListener("blur",this.onBlur)}disconnectedCallback(){super.disconnectedCallback(),this.stopVelRepeat(),window.removeEventListener("keydown",this.onKeyDown,!0),window.removeEventListener("keyup",this.onKeyUp,!0),this.removeEventListener("click",this.focusSelf),this.removeEventListener("blur",this.onBlur),this.voices.destroy()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.voices.setSession(this.sessionId,this.channelIndex)}focusSelf=()=>this.focus();set(e){this.emitDetail("nbplay-set",{values:e})}status(){this.activeNotes=Array.from(this.heldNotes),this.emitDetail("nbplay-status",{values:{activeNotes:this.activeNotes,lastNoteEvent:this.lastNoteEvent},save:!0})}noteOn(e,t){if(e<0||e>127)return;let i=this.velocity;this.heldNotes.add(e),xe(this.sessionId,this.samplerRouting||[],e,t,i)||this.voices.noteOn(e,i),ls(this.sessionId,{note:e,velocity:i,type:"on"}),this.lastNoteEvent={note:e,velocity:i,type:"on"},this.status()}noteOff(e,t){if(this.heldNotes.delete(e),this.sustainGlobal||t==="upper"&&this.sustainUpper||t==="lower"&&this.sustainLower){this.sustainedNotes.set(e,t),this.requestUpdate();return}this.release(e,t)}release(e,t){Ne(this.sessionId,this.samplerRouting||[],e,t)||this.voices.noteOff(e),ls(this.sessionId,{note:e,velocity:0,type:"off"}),this.lastNoteEvent={note:e,velocity:0,type:"off"},this.sustainedNotes.delete(e),this.status()}releaseSustained(e){for(let[t,i]of Array.from(this.sustainedNotes))(e==="all"||i===e)&&!this.heldNotes.has(t)&&this.release(t,i)}releaseZoneKeys(e){for(let[t,i]of Array.from(this.pressedKeys))i.zone===e&&(this.pressedKeys.delete(t),this.noteOff(i.note,i.zone))}silence(){for(let e of this.pressedKeys.values())this.noteOff(e.note,e.zone);this.pressedKeys.clear();for(let[e,t]of Array.from(this.sustainedNotes))this.release(e,t);this.heldNotes.clear(),this.querySelector("nbplay-key-rows")?.releaseAll(),this.voices.stopAll(),this.status()}onBlur=()=>{for(let e of this.pressedKeys.values())this.noteOff(e.note,e.zone);this.pressedKeys.clear();for(let[e,t]of Array.from(this.sustainedNotes))this.release(e,t);this.heldNotes.clear(),this.status()};nudgeVelocity(e){let t=N(this.velocity+e,0,127);t!==this.velocity&&(this.velocity=t,this.set({velocity:t}))}startVelRepeat(e){this.velRepeatTimer||(this.velRepeatCount=0,this.velRepeatTimer=setInterval(()=>{this.velRepeatCount++,this.nudgeVelocity(e*(this.velRepeatCount>10?5:1))},Sr))}stopVelRepeat(){this.velRepeatTimer&&(clearInterval(this.velRepeatTimer),this.velRepeatTimer=null,this.velRepeatCount=0)}isActive(){let e=document.activeElement;if(!e)return!1;let t=e.tagName;if(t==="INPUT"||t==="TEXTAREA"||e.isContentEditable)return!1;if(e===this||this.contains(e))return!0;let i=e.closest(".nbplay-sequencer");return!!(i&&(i.querySelector(".nbplay-step-grid-cell.pending")||i.querySelector(".nbplay-seq-rec.recording")))}shiftOctave(e,t){this.releaseZoneKeys(e);let i=e==="upper"?"upperOctave":"lowerOctave",n=N(this[i]+t,gr,kr);this[i]=n,this.set({[i]:n})}setSustain(e,t){this[e]=t,this.set({[e]:t})}onKeyDown=e=>{if(!this.isActive())return;let t=e.key,i=t.toLowerCase(),n=()=>{e.preventDefault(),e.stopPropagation()};if(t==="Escape"){let a=document.activeElement;a?.classList.contains("nbplay-sequencer")&&a.querySelector(".nbplay-seq-key-wait")&&(n(),a.dispatchEvent(new CustomEvent("nbplay-cancel-edit")));return}if(this.pressedKeys.has(i)){n();return}switch(t){case"[":n(),this.shiftOctave("upper",-1);return;case"]":n(),this.shiftOctave("upper",1);return;case";":n(),this.shiftOctave("lower",-1);return;case"'":n(),this.shiftOctave("lower",1);return;case"-":n(),this.nudgeVelocity(-1),this.startVelRepeat(-1);return;case"=":n(),this.nudgeVelocity(1),this.startVelRepeat(1);return;case"`":n(),this.setSustain("sustainUpper",!0);return;case"/":n(),this.setSustain("sustainLower",!0);return;case" ":n(),this.setSustain("sustainGlobal",!0);return}let s=Di(i,this.upperOctave,this.lowerOctave);s&&(n(),this.pressedKeys.set(i,s),this.noteOn(s.note,s.zone))};onKeyUp=e=>{let t=e.key,i=t.toLowerCase(),n=this.pressedKeys.get(i);if(!this.isActive()){n&&(this.pressedKeys.delete(i),this.noteOff(n.note,n.zone));return}this.pressedKeys.delete(i);let s=()=>{e.preventDefault(),e.stopPropagation()};switch(t){case"-":case"=":s(),this.stopVelRepeat();return;case"`":s(),this.setSustain("sustainUpper",!1),this.releaseSustained("upper");return;case"/":s(),this.setSustain("sustainLower",!1),this.releaseSustained("lower");return;case" ":s(),this.setSustain("sustainGlobal",!1),this.releaseSustained("all");return}n&&(s(),this.noteOff(n.note,n.zone))};render(){let e=[...this.heldNotes,...this.sustainedNotes.keys()];return u`<nbplay-header badge="keyboard"></nbplay-header>
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
      </div>`}};k("nbplay-keyboard",Jt);function cs(r,e=600){let t=new Float32Array(e);for(let i=0;i<e;i++){let n=i/e*3*2*Math.PI;t[i]=r.amplitude*Math.sin(n+r.index*Math.sin(n*r.ratio))}return t}var ji=class{ctx=null;voice=null;start(e,t){this.stop();let i=z();return i?(this.ctx=i,i.state==="suspended"&&i.resume?.(),this.voice=Fi(i,i.destination,e,t),this.voice.level.gain.value=t.amplitude,this.voice.modulator.start(),this.voice.carrier.start(),!0):!1}update(e,t){if(!this.voice||!this.ctx)return;let i=this.ctx.currentTime,{carrier:n,modulator:s,depth:a,level:o}=this.voice;n.frequency.setTargetAtTime(e,i,.01),s.frequency.setTargetAtTime(e*t.ratio,i,.01),a.gain.setTargetAtTime(t.index*e*t.ratio,i,.01),o.gain.setTargetAtTime(t.amplitude,i,.01)}stop(){if(this.voice){for(let e of[this.voice.modulator,this.voice.carrier])try{e.stop()}catch{}Ui(this.voice),this.voice=null}this.ctx&&(this.ctx.close(),this.ctx=null)}},ei=class extends v{static properties={frequency:{type:Number},amplitude:{type:Number},ratio:{type:Number},index:{type:Number},attack:{type:Number},decay:{type:Number},sustain:{type:Number},release:{type:Number},presetNames:{attribute:!1},presetRequest:{type:String,attribute:"preset-request"},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0}};tone=new ji;registration=null;liveNotes=new Set;constructor(){super(),this.frequency=440,this.amplitude=.5,this.ratio=2,this.index=2,this.attack=.005,this.decay=.2,this.sustain=.6,this.release=.2,this.presetNames=[],this.presetRequest="",this.sessionId="",this.channelIndex=-1,this.isPlaying=!1}patch(){return{amplitude:Number(this.amplitude)||0,ratio:Number(this.ratio)||0,index:Number(this.index)||0,attack:Number(this.attack)||0,decay:Number(this.decay)||0,sustain:Number(this.sustain)||0,release:Number(this.release)||0}}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-fm-synth"),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.register()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.unregister(),this.tone.stop()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&this.register(),e.has("isPlaying")&&e.get("isPlaying")!==void 0?this.isPlaying?this.startTone():this.tone.stop():this.isPlaying&&this.tone.update(this.frequency,this.patch())}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.register()};unregister(){if(this.liveNotes.forEach(n=>n()),this.liveNotes.clear(),!this.registration)return;let{bus:e,idx:t,entry:i}=this.registration;e.instruments?.[t]===i&&delete e.instruments[t],this.registration=null}register(){let e=this.sessionId,t=Number(this.channelIndex);if(this.unregister(),!e||!(t>=0))return;let i=w(e);if(!i)return;let n=i.instruments||{};i.instruments=n;let s={scheduleNote:(a,o,l,c)=>{let h=i.audioCtx,p=i.channels?.[t]?.gain||i.masterGain;if(!h||!p)return;let d=Ke(h,p,this.patch(),a,o,l,c,()=>this.liveNotes.delete(d));return this.liveNotes.add(d),d}};n[t]=s,this.registration={bus:i,idx:t,entry:s}}startTone(){this.tone.start(this.frequency,this.patch())||(this.isPlaying=!1,this.status())}stop(){this.isPlaying&&(this.isPlaying=!1,this.tone.stop(),this.status())}status(){this.emitDetail("nbplay-status",{values:{isPlaying:this.isPlaying},save:!0})}param(e,t,i,n,s,a,o,l,c="slider",h="linear"){let p=d=>{d.stopPropagation();let m=d.detail.value;m!==this[i]&&(this[i]=m,this.emitDetail("nbplay-set",{values:{[i]:m}}))};return u`<nbplay-param
      class=${e}
      .label=${t}
      .kind=${n}
      .control=${c}
      .scale=${h}
      .value=${Number(this[i])}
      .min=${s}
      .max=${a}
      .step=${o}
      .defaultValue=${l}
      .precision=${2}
      @input=${p}
      @change=${p}
    ></nbplay-param>`}requestPreset(e){this.presetRequest=`${Date.now()}:${e}`,this.emitDetail("nbplay-status",{values:{presetRequest:this.presetRequest},save:!0})}render(){return u`<nbplay-header badge="fm synth"
        >${we(this.presetNames,e=>{this.requestPreset(e)})}</nbplay-header
      >
      <nbplay-waveform
        class="nbplay-fm-waveform"
        variant="glow"
        .data=${cs(this.patch())}
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
      </div>`}};k("nbplay-fm-synth",ei);function Zi(r){return{id:r.id,name:r.name||"(unnamed)",state:r.state}}function Ce(){let r=null,e=null,t=null;return{async requestAccess(){if(r)return r;if(!navigator.requestMIDIAccess)return null;try{return r=await navigator.requestMIDIAccess({sysex:!1}),r}catch{return null}},inputs(){let i=[];return r?.inputs.forEach(n=>i.push(Zi(n))),i},outputs(){let i=[];return r?.outputs.forEach(n=>i.push(Zi(n))),i},connectInput(i,n){this.disconnectInput();let s=r?.inputs.get(i);return s?(t=a=>n(a.data,a.timeStamp||performance.now()),s.addEventListener("midimessage",t),e=s,Zi(s)):null},disconnectInput(){e&&t&&e.removeEventListener("midimessage",t),e=null,t=null},activeInputId(){return e?e.id:null},output(i){return r?.outputs.get(i)??null}}}var us=248,$r=250,Er=251,xr=252,Nr=242,Ge=24;function ds(r){return r<60?"lower":"upper"}function ps(r,e){(r?w(r):void 0)?.noteListeners?.forEach(i=>i(e)),document.dispatchEvent(new CustomEvent("nbplay-note",{detail:e}))}var ti=class extends v{static properties={midiPort:{type:String,attribute:"midi-port"},syncClock:{type:Boolean,attribute:"sync-clock"},samplerRouting:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},availableMidiPorts:{attribute:!1},activeNotes:{attribute:!1},lastNoteEvent:{attribute:!1},controlChange:{attribute:!1},clockBpm:{type:Number,attribute:!1},ports:{attribute:!1}};midi=Ce();voices=Pe();heldNotes=new Set;binding=null;monitor="No notes";ccSeq=0;tickTimes=[];tickCount=0;baseBeat=0;constructor(){super(),this.midiPort="",this.syncClock=!1,this.samplerRouting=[],this.sessionId="",this.channelIndex=-1,this.availableMidiPorts=[],this.activeNotes=[],this.lastNoteEvent={},this.controlChange={},this.clockBpm=0,this.ports=[]}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-midi-keyboard"),this.voices.setSession(this.sessionId,this.channelIndex),this.binding=H(this,()=>{},()=>{}),this.refreshPorts()}disconnectedCallback(){super.disconnectedCallback(),this.midi.disconnectInput(),this.voices.destroy(),this.binding?.dispose(),this.binding=null}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&(this.voices.setSession(this.sessionId,this.channelIndex),e.has("sessionId")&&this.binding?.rebind()),e.has("lastNoteEvent")&&e.get("lastNoteEvent")!==void 0&&(this.monitor=this.monitorText(),this.requestUpdate()),e.has("midiPort")&&e.get("midiPort")!==void 0&&this.connectByName(this.midiPort)}set(e){this.emitDetail("nbplay-set",{values:e})}status(e){this.emitDetail("nbplay-status",{values:e,save:!0})}monitorText(){let e=this.lastNoteEvent;return e?.type==="on"&&typeof e.note=="number"?`${_(e.note)}  vel ${e.velocity}`:e?.type==="off"&&typeof e.note=="number"?`${_(e.note)}  off`:"No notes"}async refreshPorts(){let e=await this.midi.requestAccess();this.ports=e?this.midi.inputs():[],e&&(this.availableMidiPorts=this.ports.map(t=>t.name),this.status({availableMidiPorts:this.availableMidiPorts}),this.midiPort&&!this.midi.activeInputId()&&this.connectByName(this.midiPort))}get activePortId(){return this.midi.activeInputId()??""}connectById(e){if(!e){this.midi.disconnectInput();return}this.midi.connectInput(e,(t,i)=>this.handleMidiData(t,i))}connectByName(e){let t=this.midi.activeInputId();if((this.ports.find(s=>s.id===t)?.name??"")===e)return;let n=this.ports.find(s=>s.name===e);this.connectById(n?.id??""),this.requestUpdate()}onPortChange(e){e.stopPropagation();let t=e.detail.value;this.connectById(t);let i=this.ports.find(n=>n.id===t);this.midiPort=t?i?.name??t:"",this.set({midiPort:this.midiPort})}noteOn(e,t){if(e<0||e>127)return;this.heldNotes.add(e);let i=ds(e);xe(this.sessionId,this.samplerRouting||[],e,i,t)||this.voices.noteOn(e,t);let n={note:e,velocity:t,type:"on"};ps(this.sessionId,n),this.lastNoteEvent={...n},this.activeNotes=Array.from(this.heldNotes),this.monitor=this.monitorText(),this.status({lastNoteEvent:n,activeNotes:this.activeNotes})}noteOff(e){if(e<0||e>127)return;this.heldNotes.delete(e),Ne(this.sessionId,this.samplerRouting||[],e,ds(e))||this.voices.noteOff(e);let t={note:e,velocity:0,type:"off"};ps(this.sessionId,t),this.lastNoteEvent={...t},this.activeNotes=Array.from(this.heldNotes),this.monitor=this.monitorText(),this.status({lastNoteEvent:t,activeNotes:this.activeNotes})}control(e,t,i){this.ccSeq+=1,this.controlChange={controller:e,value:t,channel:i,seq:this.ccSeq},this.monitor=`CC ${e}  ${t}`,this.requestUpdate(),this.status({controlChange:this.controlChange})}silence(){this.midi.disconnectInput(),this.voices.stopAll(),this.heldNotes.clear(),this.activeNotes=[],this.status({activeNotes:[]})}handleClockTick(e){let t=this.binding.clock();if(this.tickTimes.push(e),this.tickTimes.length>Ge+1&&this.tickTimes.shift(),this.tickCount+=1,this.tickTimes.length===Ge+1){let i=(this.tickTimes[Ge]-this.tickTimes[0])/1e3;if(i>0){let n=Math.round(60/i*10)/10;Math.abs(n-t.bpm)>.5&&t.setTempo(n),Math.abs(n-(Number(this.clockBpm)||0))>.05&&(this.clockBpm=n,this.status({clockBpm:n}))}}if(this.tickCount%Ge===0&&t.playing&&!t.loop.enabled){let i=this.baseBeat+this.tickCount/Ge;Math.abs(t.beat()-i)>.05&&t.seek(i)}}handleRealtime(e,t){if(!this.syncClock)return;let i=this.binding.clock();e===us?this.handleClockTick(t):e===$r?(this.tickTimes=[],this.tickCount=0,this.baseBeat=0,i.seek(0),i.play()):e===Er?(this.tickTimes=[],this.tickCount=0,this.baseBeat=i.beat(),i.play()):e===xr&&(this.tickTimes=[],i.stop())}handleSongPosition(e){if(!this.syncClock)return;let t=e/4;this.tickCount=0,this.baseBeat=t,this.binding.clock().seek(t)}handleMidiData(e,t=performance.now()){if(!e||e.length===0)return;if(e[0]>=us){this.handleRealtime(e[0],t);return}if(e[0]===Nr&&e.length>=3){this.handleSongPosition(e[1]&127|(e[2]&127)<<7);return}if(e.length<3)return;let i=e[0]&240,n=e[1],s=e[2];if(i===176){this.control(n,s,e[0]&15);return}if(i===144&&s>0){this.noteOn(n,s);return}(i===128||i===144&&s===0)&&this.noteOff(n)}render(){let e=i=>i.stopPropagation(),t=Number(this.clockBpm)||0;return u`<nbplay-header badge="midi keyboard"></nbplay-header>
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
      </div>`}};k("nbplay-midi-keyboard",ti);var Pr=[22050,44100,48e3,96e3],wr=[128,256,512,1024,2048],Cr=8,ii=class extends v{static properties={sampleRate:{type:Number,attribute:"sample-rate"},channels:{type:Number},bufferSize:{type:Number,attribute:"buffer-size"},audioDevice:{type:String,attribute:"audio-device"},midiPort:{type:String,attribute:"midi-port"},availableMidiPorts:{attribute:!1},midiEvent:{attribute:!1},ports:{attribute:!1}};midi=Ce();constructor(){super(),this.sampleRate=44100,this.channels=2,this.bufferSize=512,this.audioDevice="",this.midiPort="",this.availableMidiPorts=[],this.midiEvent=null,this.ports=[]}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-settings"),this.refreshPorts()}disconnectedCallback(){super.disconnectedCallback(),this.midi.disconnectInput()}updated(e){e.has("midiPort")&&e.get("midiPort")!==void 0&&this.connectByName(this.midiPort)}set(e){this.emitDetail("nbplay-set",{values:e})}status(e){this.emitDetail("nbplay-status",{values:e,save:!0})}async refreshPorts(){let e=await this.midi.requestAccess();this.ports=e?this.midi.inputs():[],e&&(this.availableMidiPorts=this.ports.map(t=>t.name),this.status({availableMidiPorts:this.availableMidiPorts}),this.midiPort&&!this.midi.activeInputId()&&this.connectByName(this.midiPort))}onMessage=(e,t)=>{let i=It(e),n=this.querySelector("nbplay-midi-log");i&&n&&n.push(i);let s=new Uint8Array(e.length+8);new DataView(s.buffer).setFloat64(0,t,!0),s.set(e,8),this.midiEvent=new DataView(s.buffer),this.status({midiEvent:this.midiEvent})};connectById(e){e?this.midi.connectInput(e,this.onMessage):this.midi.disconnectInput()}connectByName(e){let t=this.midi.activeInputId();if((this.ports.find(s=>s.id===t)?.name??"")===e)return;let n=this.ports.find(s=>s.name===e);this.connectById(n?.id??""),this.requestUpdate()}onPortChange(e){e.stopPropagation();let t=e.detail.value;this.connectById(t);let i=this.ports.find(n=>n.id===t);this.midiPort=t?i?.name??t:"",this.set({midiPort:this.midiPort})}select(e,t,i){return u`<select
      class="nbplay-select ${e}"
      .value=${String(this[t])}
      @input=${n=>n.stopPropagation()}
      @change=${n=>{n.stopPropagation();let s=parseInt(n.target.value,10);this[t]=s,this.set({[t]:s})}}
    >
      ${i.map(n=>u`<option
            value=${n.value}
            ?selected=${n.value===this[t]}
            .textContent=${n.label}
          ></option>`)}
    </select>`}render(){let e=this.midi.activeInputId()??"";return u`<nbplay-header badge="settings"></nbplay-header>
      <div class="nbplay-section">
        <div class="nbplay-section-title">
          <span class="nbplay-section-icon">♫</span> Audio Output
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Sample Rate</span>
          ${this.select("nbplay-sr-select","sampleRate",Pr.map(t=>({value:t,label:`${t} Hz`})))}
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Channels</span>
          ${this.select("nbplay-ch-select","channels",[{value:1,label:"Mono"},{value:2,label:"Stereo"}])}
        </div>
        <div class="nbplay-setting-row">
          <span class="nbplay-label">Buffer Size</span>
          ${this.select("nbplay-buf-select","bufferSize",wr.map(t=>({value:t,label:String(t)})))}
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
        <nbplay-midi-log label="Activity" .max=${Cr}></nbplay-midi-log>
      </div>`}};k("nbplay-settings",ii);var Ar=248,Tr=250,hs=251,Yi=252,Mr=242,Br=24,Rr=25,Ir=.1;function ni(r){let e=Math.max(0,Math.min(16383,Math.round(r*4)));return[Mr,e&127,e>>7&127]}function fe(r,e){let t=Number(r);return Number.isFinite(t)?Math.max(0,Math.min(127,Math.round(t))):e}var si=class extends v{static properties={midiPort:{type:String,attribute:"midi-port"},channel:{type:Number},forwardNotes:{type:Boolean,attribute:"forward-notes"},sendClock:{type:Boolean,attribute:"send-clock"},sessionId:{type:String,attribute:"session-id",reflect:!0},availableMidiPorts:{attribute:!1},ports:{attribute:!1},sent:{type:Number,attribute:!1}};midi=Ce();active=null;activeId="";bus=null;binding=null;tickTimer=null;nextTickTime=0;constructor(){super(),this.midiPort="",this.channel=0,this.forwardNotes=!0,this.sendClock=!1,this.sessionId="",this.availableMidiPorts=[],this.ports=[],this.sent=0}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-midi-output"),this.binding=H(this,this.onClockEvent,this.onRebind),this.bindSession(),this.refreshPorts()}disconnectedCallback(){super.disconnectedCallback(),this.teardown(),this.binding?.dispose(),this.binding=null}updated(e){e.has("sessionId")&&e.get("sessionId")!==void 0&&(this.bindSession(),this.binding?.rebind()),e.has("midiPort")&&e.get("midiPort")!==void 0&&this.connectByName(this.midiPort),(e.has("midiPort")||e.has("sendClock"))&&this.syncClockSending()}set(e){this.emitDetail("nbplay-set",{values:e})}status(e){this.emitDetail("nbplay-status",{values:e,save:!0})}channelNumber(){let e=Number(this.channel);return Number.isFinite(e)?Math.max(0,Math.min(15,Math.round(e))):0}async refreshPorts(){let e=await this.midi.requestAccess();this.ports=e?this.midi.outputs():[],e&&(this.availableMidiPorts=this.ports.map(t=>t.name),this.status({availableMidiPorts:this.availableMidiPorts}),this.midiPort&&!this.active&&this.connectByName(this.midiPort))}connectById(e){this.active=e?this.midi.output(e):null,this.activeId=this.active?e:""}connectByName(e){if((this.ports.find(n=>n.id===this.activeId)?.name??"")===e)return;let i=this.ports.find(n=>n.name===e);this.connectById(i?.id??""),this.requestUpdate()}onPortChange(e){e.stopPropagation(),this.allNotesOff();let t=e.detail.value;this.connectById(t);let i=this.ports.find(n=>n.id===t);this.midiPort=this.active?i?.name??t:"",this.set({midiPort:this.midiPort})}send(e,t){if(this.active)try{t===void 0?this.active.send(e):this.active.send(e,t),this.sent+=1}catch{}}allNotesOff(){this.send([176|this.channelNumber(),123,0])}timestampFor(e){let t=this.binding?.clock().context()||this.bus?.audioCtx;if(t)return performance.now()+Math.max(0,e-t.currentTime)*1e3}command(e){if(!e?.kind)return;let t=this.channelNumber();e.kind==="note_on"?this.send([144|t,fe(e.note,60),Math.max(1,fe(e.velocity,100))]):e.kind==="note_off"?this.send([128|t,fe(e.note,60),0]):e.kind==="control_change"?this.send([176|t,fe(e.controller,0),fe(e.value,0)]):e.kind==="raw"&&Array.isArray(e.data)&&this.send(e.data.map(i=>Math.max(0,Math.min(255,Math.round(Number(i)||0)))))}onNote=e=>{if(!this.forwardNotes)return;let t=this.channelNumber(),i=fe(e.note,60);if(e.type==="off"){this.send([128|t,i,0]);return}let n=Math.max(1,fe(e.velocity,100));if(e.at===void 0){this.send([144|t,i,n]);return}let s=this.timestampFor(e.at);if(this.send([144|t,i,n],s),e.duration!==void 0){let a=s===void 0?void 0:s+Math.max(0,e.duration)*1e3;this.send([128|t,i,0],a)}};onDocumentNote=e=>{this.onNote(e.detail)};unbindSession(){this.bus?.noteListeners&&(this.bus.noteListeners=this.bus.noteListeners.filter(e=>e!==this.onNote)),document.removeEventListener("nbplay-note",this.onDocumentNote),this.bus=null}bindSession(){this.unbindSession(),this.sessionId?(this.bus=Ee(this.sessionId),this.bus.noteListeners||(this.bus.noteListeners=[]),this.bus.noteListeners.push(this.onNote)):document.addEventListener("nbplay-note",this.onDocumentNote)}sendsClock(){return!!this.sendClock&&!!this.midiPort}scheduleTicks=()=>{let e=this.binding.clock(),t=e.now(),i=e.secondsPerBeat()/Br,n=e.context(),s=n?performance.now()-n.currentTime*1e3:void 0;for(this.nextTickTime<t-.5&&(this.nextTickTime=t);this.nextTickTime<t+Ir;)this.send([Ar],s===void 0?void 0:s+this.nextTickTime*1e3),this.nextTickTime+=i};startTicks(e){this.tickTimer||(this.nextTickTime=e.now(),this.tickTimer=setInterval(this.scheduleTicks,Rr),this.scheduleTicks())}stopTicks(){this.tickTimer&&clearInterval(this.tickTimer),this.tickTimer=null}onClockEvent=e=>{let t=this.binding.clock();switch(e.type){case"play":if(!this.sendsClock())break;e.beat<.001?this.send([Tr]):(this.send(ni(e.beat)),this.send([hs])),this.startTicks(t);break;case"stop":this.tickTimer&&this.send([Yi]),this.stopTicks();break;case"seek":this.tickTimer&&this.send(ni(e.beat));break;case"tempo":case"loop":case"record":case"timesig":break}};onRebind=e=>{this.stopTicks(),this.sendsClock()&&e.playing&&this.startTicks(e)};syncClockSending(){let e=this.binding?.clock();e&&(this.sendsClock()&&e.playing&&!this.tickTimer?(this.send(ni(e.beat())),this.send([hs]),this.startTicks(e)):!this.sendsClock()&&this.tickTimer&&(this.send([Yi]),this.stopTicks()))}teardown(){this.tickTimer&&this.send([Yi]),this.stopTicks(),this.allNotesOff(),this.unbindSession(),this.active=null,this.activeId=""}render(){let e=i=>i.stopPropagation(),t=(i,n,s)=>u`<label class="nbplay-midi-out-forward">
        <input
          type="checkbox"
          class=${i}
          .checked=${this[n]}
          @input=${e}
          @change=${a=>{a.stopPropagation(),this[n]=a.target.checked,this.set({[n]:this[n]})}}
        />
        ${s}
      </label>`;return u`<nbplay-header badge="midi output"></nbplay-header>
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
          ${Array.from({length:16},(i,n)=>u`<option
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
      </div>`}};k("nbplay-midi-output",si);var _r=new Set(["automation_lanes","current_step","is_playing","voices_data"]);function We(r,e,t){return Math.max(e,Math.min(t,r))}function Y(r,e){let t=Number(r);return Number.isFinite(t)?t:e}function Qi(r){return Math.max(.001,Y(r.get("step_duration"),.25))}function Dr(r,e,t,i=[]){let n=r%2===1?e*.5*(We(t,0,100)/100):0,s=i.length>0?e*(We(Y(i[r%i.length],0),-50,50)/100):0;return We(n+s,e*-.5,e*.75)}function Xi(r){return 440*Math.pow(2,(r-69)/12)}function Lr(r,e=Math.random){if(!r.active)return!1;let t=We(Y(r.probability,100),0,100);return t<=0?!1:t>=100?!0:e()*100<t}function*qr(r,e,t=Math.random){for(let i of r){let n=i[e];!n||!Lr(n,t)||(yield{note:Y(n.note,60),freq:Xi(Y(n.note,60)),velocity:We(Y(n.velocity,100),0,127)/127,durationTicks:Math.max(.001,Y(n.duration_ticks,1))})}}function Or(r,e){let t=(r.points||[]).filter(n=>Number.isFinite(n.step)&&Number.isFinite(n.value)&&n.step>=0).sort((n,s)=>n.step-s.step);if(t.length===0)return null;let i=null;for(let n of t)if(n.step<=e)i=n;else break;return(i||t[t.length-1]).value}function Vr(r,e){let t=r.get("automation_lanes")||[];for(let i of t){let n=typeof i?.trait=="string"?i.trait:"";if(!n||_r.has(n))continue;let s=Or(i,e);s!==null&&Y(r.get(n),NaN)!==s&&r.set(n,s)}}function Ji(r,e,t,i,n,s){let o=Math.min(.05,s*.2);try{let l=r.createOscillator(),c=r.createGain();return l.type="sine",l.frequency.value=t,c.gain.setValueAtTime(0,n),c.gain.linearRampToValueAtTime(i,n+.005),c.gain.linearRampToValueAtTime(0,n+s-o),l.connect(c),c.connect(e||r.destination),l.start(n),l.stop(n+s),l}catch{return null}}function ms(r,e){let t=String(r.get("session_id")||""),i=Y(r.get("channel_index"),-1),n=t&&i>=0&&w(t)?.channels?.[i]?.gain||null;return{ctx:e.context(),output:n}}function Fr(r){return r.get("voices_data")||[]}function Ur(r,e){return Math.ceil(r/e-1e-6)*e}function zr(r,e,t,i=.1){let n=Qi(r),s=e.secondsPerBeat(),a=e.beatAt(t),o=Math.floor(a/n+1e-6)*n,l=(a-o)*s<i?o:o+n;return{beat:l,time:t+(l-a)*s}}function Hr(r,e,t){let i=Qi(e),n=t.secondsPerBeat(),s=r.beat+i,a=r.time+i*n,o=t.loop;if(o.enabled&&o.endBeat>o.startBeat&&s>=o.endBeat-1e-9){let l=r.time+(o.endBeat-r.beat)*n;s=Ur(o.startBeat,i),a=l+(s-o.startBeat)*n}return{beat:s,time:a}}function Kr(r,e,t,i){let n=Math.max(1,e),s=n*t;if(i){let a=(r%s+s)%s;return Math.round(a/t)%n}return r<-1e-9||r>=s-1e-9?-1:Math.floor(r/t+1e-6)}var Gr=6;function Ae(r={}){let e=null,t=null,i=null,n=null,s=null,a=.1,o=.025,l=r.random||Math.random,c=[];function h(f){let $=e?.currentTime??0;c.forEach(b=>{(f?b.at>$:b.until>$)&&b.cancel()}),c=f?c.filter(b=>b.at<=$):[]}function p(){n&&(clearInterval(n),n=null),h(!0),s=null,t=null,i=null}let d={start(f,$){let b=ms(f,$);b.ctx&&(e=b.ctx,t=$,i=f,s=null,e.state==="suspended"&&e.resume(),n||(n=setInterval(()=>{m(f)},o*1e3)),m(f))},realign(){h(!0),s=null,n&&i&&m(i)},stop(){n&&(clearInterval(n),n=null),h(!1),s=null,t=null,i=null},destroy(){d.stop(),e=null},isPlaying(){return n!==null}};function m(f){let $=t;if(!e||!$)return;let b=e.currentTime;for(c=c.filter(E=>E.until>b),(!s||s.time<b-.5)&&(s=zr(f,$,b));s.time<b+a;){if(!g(f,$,s))return;s=Hr(s,f,$)}}function g(f,$,b){if(!e)return!0;let E=Fr(f),y=E[0]||[];if(E.length===0||y.length===0)return!0;let S=Qi(f),C=Kr(b.beat,y.length,S,!!f.get("loop_enabled"));if(C<0)return p(),r.onEnd?.(),!1;f.set("current_step",C);let T=f.get("session_id")||"",R=Y(f.get("channel_index"),-1);if(Wt(T,R)!==r.owner)return!0;Vr(f,C);let W=S*$.secondsPerBeat(),j=Dr(C,W,Y(f.get("swing"),0),f.get("groove")||[]),F=Math.max(0,b.time+j),ue=r.instrument?.()??(T&&R>=0?w(T)?.instruments?.[R]:void 0),ve=ms(f,$).output;for(let{note:te,freq:P,velocity:q,durationTicks:ie}of qr(E,C,l)){let re=W*ie,U;if(ue)U=ue.scheduleNote(te,Math.round(q*127),F,re)||void 0;else{let ge=Ji(e,ve,P,q,F,re);ge&&(U=()=>{try{ge.stop(0),ge.disconnect()}catch{}})}U&&c.push({cancel:U,at:F,until:F+re+Gr}),Ht(T,{note:te,velocity:Math.round(q*127),type:"on",at:F,duration:W*ie})}return!0}return d}var bs=[1,.5,.25,.125],Wr=30,jr=300;function Zr(){return{active:!1,note:60,velocity:100,duration_ticks:1,probability:100}}function fs(r,e,t,i){let n=Math.max(1,Math.round(r||1)),s=Math.max(.001,e||.25);return Math.max(1,Math.round(n*se(t,i)/s))}function Yr(r,e){let t=r.slice(0,e).map(i=>({...i}));for(;t.length<e;)t.push(Zr());return t}function Qr(r,e,t){let i=Math.max(1,r.length||t||1);return Array.from({length:i},(n,s)=>Yr(r[s]||[],e))}function ys(r){return r.replace(/_([a-z])/g,(e,t)=>t.toUpperCase())}var Xr=["voicesData","stepDuration","swing","groove"],ri=class extends v{static properties={voicesData:{attribute:!1},numVoices:{type:Number,attribute:"num-voices"},length:{type:Number},measures:{type:Number},stepDuration:{type:Number,attribute:"step-duration"},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},bpm:{type:Number},loopEnabled:{type:Boolean,attribute:"loop-enabled"},keyboardConnected:{type:Boolean,attribute:"keyboard-connected"},followTransport:{type:Boolean,attribute:"follow-transport"},swing:{type:Number},groove:{attribute:!1},automationLanes:{attribute:!1},editToken:{type:String,attribute:"edit-token"},editAck:{type:String,attribute:"edit-ack"},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},currentStep:{type:Number,attribute:!1}};binding=null;scheduler=Ae({onEnd:()=>this.onPatternEnd()});armed=new Set;cursor=null;pending=null;editSerial=0;unbindShortcuts=null;applyingGrid=!1;shim={get:e=>this[ys(e)],set:(e,t)=>{let i=ys(e);this[i]=t,this.status(!1,{[i]:t})},save_changes:()=>{},on:()=>{}};constructor(){super(),this.voicesData=[],this.numVoices=1,this.length=16,this.measures=1,this.stepDuration=.25,this.timeSignatureNum=4,this.timeSignatureDen=4,this.bpm=120,this.loopEnabled=!0,this.keyboardConnected=!1,this.followTransport=!0,this.swing=0,this.groove=[],this.automationLanes=[],this.editToken="",this.editAck="",this.sessionId="",this.channelIndex=-1,this.isPlaying=!1,this.currentStep=-1}clock(){if(!this.binding){this.binding=H(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.isPlaying=e.playing,this.currentStep=-1,e.playing&&this.startScheduler()}return this.binding.clock()}shared(){return!!this.sessionId}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-sequencer"),this.tabIndex=0,this.reconcileGridWithData(),this.clock(),this.unbindShortcuts=le(this,{Space:()=>this.togglePlay(),"Shift+Space":()=>this.stopAndRewind(),ArrowLeft:()=>this.moveCursor(0,-1),ArrowRight:()=>this.moveCursor(0,1),ArrowUp:()=>this.moveCursor(-1,0),ArrowDown:()=>this.moveCursor(1,0),Enter:()=>this.toggleCursorStep(),x:()=>this.toggleCursorStep(),Escape:()=>{this.cancelPendingEdit(),this.cursor=null,this.requestUpdate()}}),this.addEventListener("nbplay-cancel-edit",this.onCancelEdit)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-note",this.onDocumentNote),this.removeEventListener("nbplay-cancel-edit",this.onCancelEdit),this.cancelPendingEdit(),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.scheduler.destroy(),this.binding?.dispose(),this.binding=null}set(e){if(!this.editToken){this.emitDetail("nbplay-set",{values:e});return}for(let[t,i]of Object.entries(e))Xr.includes(t)&&(this.editSerial+=1,this.editAck=`${this.editToken}#${this.editSerial}`,this.emitDetail("nbplay-set",{values:{editAck:this.editAck}})),this.emitDetail("nbplay-set",{values:{[t]:i}})}status(e,t){this.emitDetail("nbplay-status",{values:t,save:e})}startScheduler(){this.scheduler.isPlaying()||this.scheduler.start(this.shim,this.clock())}stopLocal(e){this.scheduler.stop(),this.isPlaying=!1,this.currentStep=-1,this.status(e,{isPlaying:!1,currentStep:-1})}onPatternEnd(){if(this.shared())this.stopLocal(!0);else{let e=this.clock();e.stop(),e.seek(0)}}onClockEvent=e=>{switch(e.type){case"play":if(this.followTransport===!1)break;this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0});break;case"stop":this.stopLocal(!0);break;case"seek":case"loop":this.scheduler.realign();break;case"tempo":{this.scheduler.realign();let t=this.clock().bpm;Number(this.bpm)!==t&&(this.bpm=t,this.set({bpm:t}));break}case"record":case"timesig":break}};joinTempo(e){let t=e.adoptTempo(Number(this.bpm));t!==Number(this.bpm)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.scheduler.stop(),this.joinTempo(e),this.currentStep=-1,e.playing&&this.followTransport!==!1&&this.startScheduler(),this.isPlaying=this.scheduler.isPlaying(),this.status(!1,{isPlaying:this.isPlaying,currentStep:-1})};updated(e){if(!this.binding)return;let t=e.has("sessionId")&&e.get("sessionId")!==void 0;t&&this.binding.rebind();let i=this.clock();e.has("bpm")&&!t&&Number(this.bpm)!==i.bpm&&i.setTempo(Number(this.bpm)),(e.has("measures")||e.has("stepDuration")||e.has("timeSignatureNum")||e.has("timeSignatureDen"))&&!this.applyingGrid&&[...e.keys()].some(n=>e.get(n)!==void 0)&&this.applyGrid({}),e.has("isPlaying")&&e.get("isPlaying")!==void 0&&this.onPlayStateChange(i),e.has("keyboardConnected")&&!this.keyboardConnected&&this.cancelPendingEdit()}onPlayStateChange(e){if(this.shared()){let t=this.scheduler.isPlaying();!!this.isPlaying!==t&&(this.isPlaying=t,this.status(!0,{isPlaying:t}));return}this.isPlaying?e.playing?this.startScheduler():e.play():(this.scheduler.stop(),e.stop())}voices(){return Array.isArray(this.voicesData)?this.voicesData:[]}actualLength(){return this.voices()[0]?.length||Number(this.length||0)||1}configuredLength(){return fs(Number(this.measures||1),Number(this.stepDuration||.25),Number(this.timeSignatureNum||4),Number(this.timeSignatureDen||4))}reconcileGridWithData(){let e=this.actualLength();if(e===this.configuredLength())return;let i=Math.max(1,Number(this.measures||1))*se(Number(this.timeSignatureNum||4),Number(this.timeSignatureDen||4)),n=Math.max(.001,i/Math.max(1,e)),s=bs.find(a=>Math.abs(a-n)<1e-4);this.length=e,this.stepDuration=s??n,this.status(!1,{length:this.length,stepDuration:this.stepDuration})}applyGrid(e){if(!this.applyingGrid){this.applyingGrid=!0;try{let t=N(Math.round(e.measures??Number(this.measures||1)),1,64),i=Math.max(.001,e.stepDuration??Number(this.stepDuration||.25)),n=fs(t,i,Number(this.timeSignatureNum||4),Number(this.timeSignatureDen||4)),s=Qr(this.voices(),n,Number(this.numVoices||1)),a=t!==this.measures||i!==this.stepDuration||n!==this.length||JSON.stringify(s)!==JSON.stringify(this.voicesData);this.measures=t,this.stepDuration=i,this.length=n,this.voicesData=s,a&&this.set({measures:t,stepDuration:i,length:n,voicesData:s})}finally{this.applyingGrid=!1}}}writeStep(e,t,i){let n=[...this.voices()],s=[...n[e]||[]];t>=s.length||(s[t]={...s[t],...i},n[e]=s,this.voicesData=n,this.set({voicesData:n}))}armedChanged(){this.armed.size>0?document.addEventListener("nbplay-note",this.onDocumentNote):document.removeEventListener("nbplay-note",this.onDocumentNote),this.requestUpdate()}onDocumentNote=e=>{let t=e.detail;if(!t||this.armed.size===0||t.type!=="on")return;let i=this.currentStep;if(i<0)return;let n=[...this.voices()];if(n.length===0)return;let s=!1;for(let a of this.armed){let o=[...n[a]||[]];a<n.length&&i<o.length&&(o[i]={...o[i],note:t.note,velocity:t.velocity,active:!0},n[a]=o,s=!0)}s&&(this.voicesData=n,this.set({voicesData:n}))};toggleArm(e,t){t??!this.armed.has(e)?this.armed.add(e):this.armed.delete(e),this.armedChanged()}toggleRecordAll(){this.armed.size>0?this.armed.clear():this.voices().forEach((e,t)=>this.armed.add(t)),this.armedChanged()}onPendingNote=e=>{let t=e.detail;if(t.type!=="on"||!this.pending)return;let{voice:i,step:n}=this.pending;this.cancelPendingEdit(),this.writeStep(i,n,{note:t.note,velocity:t.velocity,active:!0})};waitForNote(e,t){this.keyboardConnected&&(this.cancelPendingEdit(),this.pending={voice:e,step:t},this.focus(),document.addEventListener("nbplay-note",this.onPendingNote),this.requestUpdate())}cancelPendingEdit(){document.removeEventListener("nbplay-note",this.onPendingNote),this.pending&&(this.pending=null,this.requestUpdate())}onCancelEdit=()=>this.cancelPendingEdit();togglePlay(){let e=this.clock();this.isPlaying?this.shared()?this.stopLocal(!0):e.stop():e.playing?(this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0})):(e.play(),this.followTransport===!1&&(this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0})))}stopAndRewind(){let e=this.clock();e.playing?e.stop():this.stopLocal(!0),e.seek(0)}halt(){this.scheduler.stop(),this.shared()||this.clock().stop(),this.stopLocal(!1),this.armed.clear(),this.armedChanged()}moveCursor(e,t){let i=this.voices();if(i.length===0)return;let n=i[0].length,s=this.cursor?{voice:this.cursor.voice+e,step:this.cursor.step+t}:{voice:0,step:0};this.cursor={voice:N(s.voice,0,i.length-1),step:N(s.step,0,n-1)},this.requestUpdate()}toggleCursorStep(){if(!this.cursor){this.moveCursor(0,0);return}let{voice:e,step:t}=this.cursor,i=this.voices()[e]?.[t];i&&this.writeStep(e,t,{active:!i.active})}info(){let e=this.voices(),t=e[0]?.length||0,i=e.reduce((o,l)=>o+l.filter(c=>c.active).length,0),n=e.length>1?` \xB7 ${e.length} voices`:"",s=Math.max(1,Number(this.measures||1)),a=s===1?"1 measure":`${s} measures`;return`${i}/${t*e.length} steps active${n} \xB7 ${this.bpm} BPM \xB7 ${a} \xB7 ${this.actualLength()} steps`}render(){let e=n=>n.stopPropagation(),t=n=>{n.stopPropagation(),this.clock().setTempo(n.detail.value)},i=this.armed.size>0;return u`<nbplay-header badge="sequencer"></nbplay-header>
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
          .min=${Wr}
          .max=${jr}
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
            ${bs.map(n=>u`<option
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
      </div>`}};k("nbplay-sequencer",ri);var Jr=[...zi,"synth","fm"].map(r=>({value:r,label:r==="fm"?"FM":r[0].toUpperCase()+r.slice(1)})),en=[8,16,32],ea=[.5,.25,.125],ta=30,ia=300,vs={amplitude:.5,ratio:2,index:2,attack:.005,decay:.2,sustain:.6,release:.2};function gs(r){return r.replace(/_([a-z0-9])/g,(e,t)=>t.toUpperCase())}function ks(r){let e={...Z};for(let[t,i]of Object.entries(r)){let n=t==="oscillator_type"?"type":gs(t);n in e&&(e[n]=i)}return e}function na(r){let e={...vs};for(let t of Object.keys(vs))t in r&&(e[t]=Number(r[t]));return e}var B=(r,e)=>{let t=Number(r);return Number.isFinite(t)?t:e},ai=class extends v{static properties={pads:{attribute:!1},pattern:{attribute:!1},steps:{type:Number},stepDuration:{type:Number,attribute:"step-duration"},swing:{type:Number},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},velocity:{type:Number},presetNames:{attribute:!1},presetRequest:{type:String,attribute:"preset-request"},soundPresetNames:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},currentStep:{type:Number,attribute:!1},selected:{state:!0},lit:{state:!0}};binding=null;instrument={scheduleNote:(e,t,i)=>this.playNote(e,t,i)};scheduler=Ae({instrument:()=>this.instrument});registration=null;ringing=[];shim={get:e=>e==="voices_data"?this.voices():e==="loop_enabled"?!0:e==="groove"||e==="automation_lanes"?[]:this[gs(e)],set:(e,t)=>{e==="current_step"&&(this.currentStep=Number(t),this.status(!1,{currentStep:this.currentStep}))},save_changes:()=>{},on:()=>{}};constructor(){super(),this.pads=[],this.pattern=[],this.steps=16,this.stepDuration=.25,this.swing=0,this.bpm=120,this.timeSignatureNum=4,this.timeSignatureDen=4,this.velocity=100,this.presetNames=[],this.presetRequest="",this.soundPresetNames={},this.sessionId="",this.channelIndex=-1,this.isPlaying=!1,this.currentStep=-1,this.selected=0,this.lit=[]}clock(){if(!this.binding){this.binding=H(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.isPlaying=e.playing,e.playing&&this.startScheduler()}return this.binding.clock()}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-drums"),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.clock(),this.register()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.unregister(),this.scheduler.destroy(),this.binding?.dispose(),this.binding=null}updated(e){if((e.has("sessionId")||e.has("channelIndex"))&&this.register(),!this.binding)return;let t=e.has("sessionId")&&e.get("sessionId")!==void 0;t&&this.binding.rebind();let i=this.clock();e.has("bpm")&&!t&&Number(this.bpm)!==i.bpm&&i.setTempo(Number(this.bpm)),e.has("isPlaying")&&e.get("isPlaying")!==void 0&&this.onPlayStateChange(i)}shared(){return!!this.sessionId}set(e){this.emitDetail("nbplay-set",{values:e})}status(e,t){this.emitDetail("nbplay-status",{values:t,save:e})}startScheduler(){this.scheduler.isPlaying()||this.scheduler.start(this.shim,this.clock())}stopLocal(e){this.scheduler.stop(),this.isPlaying=!1,this.currentStep=-1,this.status(e,{isPlaying:!1,currentStep:-1})}onClockEvent=e=>{switch(e.type){case"play":this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0});break;case"stop":this.stopLocal(!0);break;case"seek":case"loop":this.scheduler.realign();break;case"tempo":{this.scheduler.realign();let t=this.clock().bpm;Number(this.bpm)!==t&&(this.bpm=t,this.set({bpm:t}));break}}};joinTempo(e){let t=e.adoptTempo(Number(this.bpm));t!==Number(this.bpm)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.scheduler.stop(),this.joinTempo(e),this.currentStep=-1,e.playing&&this.startScheduler(),this.isPlaying=this.scheduler.isPlaying(),this.status(!1,{isPlaying:this.isPlaying,currentStep:-1})};onPlayStateChange(e){if(this.shared()){let t=this.scheduler.isPlaying();!!this.isPlaying!==t&&(this.isPlaying=t,this.status(!0,{isPlaying:t}));return}this.isPlaying?e.playing?this.startScheduler():e.play():(this.scheduler.stop(),e.stop())}togglePlay(){let e=this.clock();this.isPlaying?this.shared()?this.stopLocal(!0):e.stop():e.playing?(this.startScheduler(),this.isPlaying=!0,this.status(!0,{isPlaying:!0})):e.play()}stopAndRewind(){let e=this.clock();e.playing?e.stop():this.stopLocal(!0),e.seek(0)}halt(){this.scheduler.stop(),this.shared()||this.clock().stop(),this.stopLocal(!1),this.ringing.forEach(e=>e.cancel())}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.register()};unregister(){if(this.ringing.forEach(n=>n.cancel()),!this.registration)return;let{bus:e,idx:t,entry:i}=this.registration;e.instruments?.[t]===i&&delete e.instruments[t],this.registration=null}register(){let e=this.sessionId,t=Number(this.channelIndex);if(this.unregister(),!e||!(t>=0))return;let i=w(e);i&&(i.instruments=i.instruments||{},i.instruments[t]=this.instrument,this.registration={bus:i,idx:t,entry:this.instrument})}voices(){let e=Math.max(1,Math.round(B(this.steps,16)));return(this.pads||[]).map((t,i)=>{let n=this.pattern?.[i]||[];return Array.from({length:e},(s,a)=>{let o=B(n[a],0);return{active:o>0,note:t.note,velocity:o}})})}audio(){let e=this.clock().context();if(!e)return null;e.state==="suspended"&&e.resume();let t=this.sessionId?w(this.sessionId):void 0,i=Number(this.channelIndex),n=(i>=0?t?.channels?.[i]?.gain:void 0)||t?.masterGain||e.destination;return{ctx:e,output:n}}playNote(e,t,i){let n=(this.pads||[]).flatMap((s,a)=>s.note===e?[this.hit(a,t,i)]:[]);return()=>n.forEach(s=>s())}hit(e,t,i){let n=this.pads?.[e],s=this.audio();if(!n||!s)return()=>{};let{ctx:a,output:o}=s,l=i??a.currentTime,c=B(n.choke,0);if(c>0)for(let f of this.ringing)f.choke!==c||f.at>=l||(f.gain.gain.cancelScheduledValues(l),f.gain.gain.setTargetAtTime(0,l,.005));let h=a.createGain();h.gain.value=B(n.gain,1);let p=a.createStereoPanner?.();p?(p.pan.value=B(n.pan,0),h.connect(p).connect(o)):h.connect(o);let d={choke:c,at:l,gain:h,cancel:()=>{}},m=()=>{this.ringing=this.ringing.filter(f=>f!==d);for(let f of[h,p])try{f?.disconnect()}catch{}},g=n.params||{};if(n.sound==="synth"||n.sound==="fm"){let f=B(g.pitch,60),$=B(g.length,.25);d.cancel=n.sound==="synth"?He(a,h,ks(g),f,t,l,$,m):Ke(a,h,na(g),f,t,l,$,m)}else d.cancel=Hi(a,h,{sound:n.sound,tune:B(g.tune,0),decay:B(g.decay,.3),tone:B(g.tone,.5)},t,l,m);return this.ringing.push(d),d.cancel}editPad(e,t){let i=(this.pads||[]).map(n=>({...n}));i[e]&&(i[e]={...i[e],...t},this.pads=i,this.set({pads:i}))}editParams(e,t){let i=this.pads?.[e];i&&this.editPad(e,{params:{...i.params,...t}})}onPatternChange=e=>{e.stopPropagation();let{pad:t,step:i,value:n}=e.detail,s=Math.max(1,Math.round(B(this.steps,16))),a=(this.pads||[]).map((o,l)=>{let c=(this.pattern?.[l]||[]).slice(0,s);for(;c.length<s;)c.push(0);return c});a[t]&&(a[t][i]=n,this.pattern=a,this.set({pattern:a}))};flash(e){this.lit=[...this.lit.filter(t=>t!==e),e],setTimeout(()=>{this.lit=this.lit.filter(t=>t!==e)},120)}param(e,t,i,n,s,a,o,l,c,h={}){let p=d=>{d.stopPropagation();let m=d.detail.value;m!==i&&c(m)};return u`<nbplay-param
      class=${e}
      .label=${t}
      .kind=${n}
      .control=${h.control??"dial"}
      .scale=${h.scale??"linear"}
      .unit=${h.unit??""}
      .value=${i}
      .min=${s}
      .max=${a}
      .step=${o}
      .defaultValue=${l}
      .precision=${2}
      @input=${p}
      @change=${p}
    ></nbplay-param>`}renderEditor(e){let t=this.pads?.[e];if(!t)return x;let i=t.params||{},n=l=>this.editPad(e,l),s=l=>c=>this.editParams(e,{[l]:c}),a=t.sound==="synth"||t.sound==="fm",o=this.soundPresetNames?.[t.sound]||[];return u`<div class="nbplay-drums-editor">
      <div class="nbplay-drums-editor-head">
        <input
          type="text"
          class="nbplay-drums-pad-name"
          aria-label="Pad name"
          .value=${t.name}
          @input=${l=>l.stopPropagation()}
          @change=${l=>{l.stopPropagation();let c=l.target.value.trim();c&&c!==t.name&&n({name:c})}}
        />
        ${this.param("nbplay-drums-note","Note",B(t.note,36),"note",0,127,1,36,l=>n({note:l}),{control:"slider"})}
      </div>
      <nbplay-segmented
        class="nbplay-drums-sound"
        label="Sound"
        .options=${Jr}
        .value=${t.sound}
        @change=${l=>{l.stopPropagation();let c=l.detail.value;c!==t.sound&&n({sound:c,params:{}})}}
      ></nbplay-segmented>
      <div class="nbplay-drums-params">
        ${a?u`<label class="nbplay-drums-preset">
                  <span>Preset</span>
                  <select
                    class="nbplay-drums-preset-select"
                    @input=${l=>l.stopPropagation()}
                    @change=${l=>{l.stopPropagation();let c=l.target.value;c&&n({params:{preset:c,pitch:i.pitch,length:i.length}})}}
                  >
                    <option value="" ?selected=${!i.preset}>—</option>
                    ${o.map(l=>u`<option
                          value=${l}
                          ?selected=${i.preset===l}
                        >
                          ${l}
                        </option>`)}
                  </select>
                </label>
                ${this.param("nbplay-drums-pitch","Pitch",B(i.pitch,60),"note",0,127,1,60,s("pitch"))}
                ${this.param("nbplay-drums-length","Length",B(i.length,.25),"seconds",.01,4,.01,.25,s("length"),{scale:"log"})}`:u`${this.param("nbplay-drums-tune","Tune",B(i.tune,0),"float",-24,24,.1,0,s("tune"),{unit:" st"})}
              ${this.param("nbplay-drums-decay","Decay",B(i.decay,.3),"seconds",.01,4,.01,.3,s("decay"),{scale:"log"})}
              ${this.param("nbplay-drums-tone","Tone",B(i.tone,.5),"percent",0,1,.01,.5,s("tone"))}`}
        ${this.param("nbplay-drums-gain","Gain",B(t.gain,1),"db",0,2,.01,1,l=>n({gain:l}))}
        ${this.param("nbplay-drums-pan","Pan",B(t.pan,0),"pan",-1,1,.01,0,l=>n({pan:l}))}
        ${this.param("nbplay-drums-choke","Choke",B(t.choke,0),"int",0,8,1,0,l=>n({choke:Math.round(l)}))}
      </div>
    </div>`}render(){let e=this.pads||[],t=4,i=Math.max(1,Math.ceil(e.length/t)),n=Math.min(this.selected,Math.max(0,e.length-1)),s=Array.from({length:i*t},(c,h)=>e[h]?{note:e[h].note,velocity:B(this.velocity,100),label:e[h].name}:{note:0,velocity:0,label:""}),a=Math.max(1,Math.round(B(this.steps,16))),o=en.includes(a)?en:[...en,a].sort((c,h)=>c-h),l=Math.max(1,Math.round(1/B(this.stepDuration,.25)));return u`<nbplay-header badge="drums"
        >${we(this.presetNames,c=>{this.presetRequest=`${Date.now()}:${c}`,this.status(!0,{presetRequest:this.presetRequest})})}</nbplay-header
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
        ${this.param("nbplay-drums-bpm","BPM",B(this.bpm,120),"bpm",ta,ia,1,120,c=>this.clock().setTempo(c),{control:"slider"})}
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
            ${ea.map(c=>u`<option
                  value=${c}
                  ?selected=${c===B(this.stepDuration,.25)}
                >
                  1/${4/c}
                </option>`)}
          </select>
        </label>
        ${this.param("nbplay-drums-swing","Swing",B(this.swing,0),"int",0,100,1,0,c=>{this.swing=c,this.set({swing:c})},{control:"slider",unit:"%"})}
      </div>
      <div class="nbplay-drums-main">
        <nbplay-pad-grid
          .rows=${i}
          .cols=${t}
          .pads=${s}
          .active=${this.lit}
          @nbplay-note-on=${c=>{c.stopPropagation();let{index:h,velocity:p}=c.detail;h>=e.length||(this.selected=h,this.hit(h,p),this.flash(h))}}
          @nbplay-note-off=${c=>c.stopPropagation()}
        ></nbplay-pad-grid>
        ${this.renderEditor(n)}
      </div>
      <nbplay-drum-grid
        .pattern=${this.voices().map(c=>c.map(h=>h.active?h.velocity:0))}
        .names=${e.map(c=>c.name)}
        .currentStep=${this.currentStep}
        .selected=${n}
        .velocity=${B(this.velocity,100)}
        .group=${l}
        @input=${c=>c.stopPropagation()}
        @change=${this.onPatternChange}
        @nbplay-select=${c=>{c.stopPropagation(),this.selected=c.detail.pad}}
      ></nbplay-drum-grid>`}};k("nbplay-drums",ai);var Ss=-2,Te=-1,sa=25;function K(r,e){let t=Number(r);return Number.isFinite(t)?t:e}function $s(r){return JSON.stringify([r.voices_data,r.step_duration,r.swing,r.groove])}var je=new Map,Ze=new Map,oi=class extends v{static properties={tracks:{attribute:!1},scenes:{attribute:!1},slots:{attribute:!1},quantize:{type:String},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},selectedSlot:{attribute:!1},engineKey:{type:String,attribute:"engine-key"},sessionId:{type:String,attribute:"session-id",reflect:!0},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},activeSlots:{attribute:!1},queuedSlots:{attribute:!1}};states=[];binding=null;queueTimer=null;unbindShortcuts=null;progress=[];engine=null;joined="";constructor(){super(),this.tracks=[],this.scenes=[],this.slots=[],this.quantize="bar",this.bpm=120,this.timeSignatureNum=4,this.timeSignatureDen=4,this.selectedSlot={},this.engineKey="",this.sessionId="",this.isPlaying=!1,this.activeSlots=[],this.queuedSlots=[]}trackList(){return(this.tracks||[]).map((e,t)=>({name:String(e.name??`Track ${t+1}`),channel_index:K(e.channel_index,t)}))}sceneList(){return(this.scenes||[]).map(String)}slotList(){return(this.slots||[]).filter(e=>Array.isArray(e.voices_data)&&e.voices_data.length).map(e=>({track_index:K(e.track_index,0),scene_index:K(e.scene_index,0),name:String(e.name??"Clip"),voices_data:e.voices_data,step_duration:Math.max(.001,K(e.step_duration,.25)),swing:K(e.swing,0),groove:(e.groove||[]).map(t=>K(t,0))}))}findSlot(e,t){return this.slotList().find(i=>i.track_index===e&&i.scene_index===t)||null}beatsPerBar(){return se(this.timeSignatureNum,this.timeSignatureDen)}slotModel(e,t,i){return{get:n=>{switch(n){case"voices_data":return t.voices_data;case"step_duration":return t.step_duration;case"swing":return t.swing;case"groove":return t.groove;case"loop_enabled":return!0;case"automation_lanes":return[];case"session_id":return this.sessionId;case"channel_index":return e.channel_index;default:return}},set:(n,s)=>{n==="current_step"&&i(K(s,-1))},save_changes:()=>{},on:()=>{}}}clock(){if(!this.binding){this.binding=H(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();this.joinTempo(e),this.isPlaying=e.playing,this.activeSlots=this.trackList().map(()=>-1),this.queuedSlots=this.trackList().map(()=>Ss)}return this.binding.clock()}shared(){return!!this.sessionId}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-launcher"),this.tabIndex=0,this.clock(),this.ensureStates(),this.join();let e={Space:()=>{let t=this.clock();t.playing?t.stop():t.play()},Escape:()=>this.stopAll(),0:()=>this.stopAll()};for(let t=1;t<=9;t++)e[String(t)]=()=>{if(t-1>=this.sceneList().length)return!1;this.launchScene(t-1)};this.unbindShortcuts=le(this,e)}disconnectedCallback(){super.disconnectedCallback(),this.leave(),this.stopQueueTimer(),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.states.forEach(e=>{this.release(e),e.scheduler.destroy()}),this.states.length=0,this.binding?.dispose(),this.binding=null}join(){this.leave();let e=this.isConnected?this.engineKey:"";if(!e)return;this.joined=e;let t=je.get(e);if(!t){je.set(e,this);return}this.engine=t,Ze.has(e)||Ze.set(e,new Set),Ze.get(e)?.add(this),this.stopQueueTimer(),this.states.forEach(i=>{i.scheduler.stop(),this.release(i),i.queued=null,i.currentStep=-1})}leave(){let e=this.joined;if(!e)return;this.joined="";let t=Ze.get(e);if(this.engine){t?.delete(this),this.engine=null;return}if(je.get(e)!==this)return;je.delete(e);let i=t?.values().next().value;i&&(t?.delete(i),je.set(e,i),t?.forEach(n=>{n.engine=i}),i.takeOver())}takeOver(){this.engine=null,this.ensureStates(),this.states.forEach((e,t)=>{e.activeScene=K(this.activeSlots?.[t],-1)}),this.clock().playing&&this.resumeActive(),this.mirrorSlotState(!0)}updated(e){if(!this.binding)return;e.has("engineKey")&&this.join();let t=e.has("sessionId")&&e.get("sessionId")!==void 0;if(t&&this.binding.rebind(),e.has("bpm")&&e.get("bpm")!==void 0&&!t&&this.clock().setTempo(K(this.bpm,120)),!this.engine&&(e.has("tracks")&&e.get("tracks")!==void 0&&(this.trackList().length<this.states.length&&this.clearStates(),this.ensureStates(),this.mirrorSlotState(!0)),e.has("slots")&&e.get("slots")!==void 0&&(this.states.forEach((i,n)=>{if(i.activeScene<0||!this.clock().playing)return;let s=this.findSlot(n,i.activeScene);if(!s){this.stopNow(n);return}$s(s)!==i.activeData&&this.startSlot(n,i.activeScene)}),this.mirrorSlotState(!0)),e.has("isPlaying")&&e.get("isPlaying")!==void 0&&!this.shared())){let i=this.clock();this.isPlaying?i.playing||i.play():i.playing&&i.stop()}}set(e){this.emitDetail("nbplay-set",{values:e})}status(e,t){this.emitDetail("nbplay-status",{values:t,save:e})}ensureStates(){let e=this.trackList().length;for(;this.states.length<e;){let t=this.states.length;this.states.push({scheduler:Ae({onEnd:()=>this.stopNow(t),owner:"launcher"}),activeScene:-1,activeData:"",queued:null,currentStep:-1,claim:null})}for(;this.states.length>e;){let t=this.states.pop();t&&this.release(t),t?.scheduler.destroy()}}hold(e,t){this.release(e),!(!this.sessionId||!(t>=0))&&(e.claim={sessionId:this.sessionId,channel:t},Kt(this.sessionId,t,"launcher"))}release(e){e.claim&&(Gt(e.claim.sessionId,e.claim.channel,"launcher"),e.claim=null)}clearStates(){this.states.forEach(e=>{e.scheduler.stop(),this.release(e),e.activeScene=-1,e.activeData="",e.queued=null,e.currentStep=-1})}mirrorSlotState(e){this.activeSlots=this.states.map(t=>t.activeScene),this.queuedSlots=this.states.map(t=>t.queued?t.queued.scene:Ss),this.syncProgress(),this.status(e,{activeSlots:this.activeSlots,queuedSlots:this.queuedSlots})}syncProgress(){this.progress=this.states.map((e,t)=>{if(e.activeScene<0||e.currentStep<0)return 0;let i=this.findSlot(t,e.activeScene)?.voices_data[0]?.length||0;return i>0?(e.currentStep+1)/i:0}),this.requestUpdate(),Ze.get(this.joined)?.forEach(e=>e.requestUpdate())}onClockEvent=e=>{if(!this.engine)switch(e.type){case"play":this.isPlaying=!0,this.status(!0,{isPlaying:!0}),this.startQueueTimer();break;case"stop":this.stopQueueTimer(),this.clearStates(),this.isPlaying=!1,this.status(!0,{isPlaying:!1}),this.mirrorSlotState(!0);break;case"tempo":{let t=this.clock().bpm;K(this.bpm,120)!==t&&(this.bpm=t,this.set({bpm:t})),this.states.forEach(i=>i.scheduler.realign()),this.requantize();break}case"seek":case"loop":this.states.forEach(t=>t.scheduler.realign()),this.requantize();break;case"record":case"timesig":break}};joinTempo(e){let t=e.adoptTempo(K(this.bpm,120));t!==K(this.bpm,120)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.states.forEach(t=>t.scheduler.stop()),this.joinTempo(e),!this.engine&&(this.isPlaying=e.playing,this.status(!1,{isPlaying:e.playing}),e.playing?this.resumeActive():this.clearStates(),this.syncProgress())};startSlot(e,t){this.ensureStates();let i=this.states[e],n=this.trackList()[e],s=this.findSlot(e,t);return!i||!n||!s?!1:(i.scheduler.stop(),this.hold(i,n.channel_index),i.activeScene=t,i.activeData=$s(s),i.currentStep=-1,this.clock().playing&&i.scheduler.start(this.slotModel(n,s,a=>{i.currentStep=a,this.syncProgress()}),this.clock()),!0)}stopNow(e){let t=this.states[e];t&&(t.scheduler.stop(),this.release(t),t.activeScene=-1,t.activeData="",t.currentStep=-1)}resumeActive(){this.ensureStates(),this.states.forEach((e,t)=>{e.activeScene>=0&&this.startSlot(t,e.activeScene)})}nextBoundary(e){let t=String(this.quantize||"bar");if(t==="none")return e;let i=t==="beat"?1:this.beatsPerBar(),n=Math.ceil(e/i-1e-6)*i;return Math.max(e,n)}boundaryTime(e,t,i){let n=e.loop,s=n.enabled&&n.endBeat>n.startBeat&&i>n.endBeat?n.endBeat:i;return e.now()+Math.max(0,s-t)*e.secondsPerBeat()}applyNow(e){e.scene>=0?this.startSlot(e.trackIndex,e.scene):this.stopNow(e.trackIndex),this.states[e.trackIndex].queued=null}applyLaunches(e){if(this.engine){this.engine.applyLaunches(e);return}this.ensureStates();let t=e.filter(o=>this.states[o.trackIndex]);if(!t.length)return;let i=this.clock();if(!i.playing){t.some(o=>o.scene>=0)&&i.play(),t.forEach(o=>this.applyNow(o)),this.mirrorSlotState(!0);return}let n=i.beat(),s=this.nextBoundary(n);if(s<=n+1e-9){t.forEach(o=>this.applyNow(o)),this.mirrorSlotState(!0);return}let a=this.boundaryTime(i,n,s);t.forEach(o=>{this.states[o.trackIndex].queued={scene:o.scene,viaScene:o.viaScene,atBeat:s,atTime:a}}),this.startQueueTimer(),this.mirrorSlotState(!0)}queue(e,t){this.applyLaunches([{trackIndex:e,scene:t,viaScene:t}])}requantize(){let e=this.clock();if(!e.playing||!this.states.some(s=>s.queued))return;let t=e.beat(),i=this.nextBoundary(t),n=this.boundaryTime(e,t,i);this.states.forEach(s=>{s.queued&&(s.queued={...s.queued,atBeat:i,atTime:n})})}processQueue=()=>{let t=this.clock().now(),i=!1;this.states.forEach((n,s)=>{let a=n.queued;a&&t+1e-6>=a.atTime&&(n.queued=null,a.scene>=0?this.startSlot(s,a.scene):this.stopNow(s),i=!0)}),i&&this.mirrorSlotState(!0),this.states.some(n=>n.queued)||this.stopQueueTimer()};startQueueTimer(){this.queueTimer||!this.states.some(e=>e.queued)||(this.queueTimer=setInterval(this.processQueue,sa),this.processQueue())}stopQueueTimer(){this.queueTimer&&(clearInterval(this.queueTimer),this.queueTimer=null)}launchScene(e){this.applyLaunches(this.trackList().map((t,i)=>({trackIndex:i,scene:this.findSlot(i,e)?e:Te,viaScene:e})))}stopAll(){this.applyLaunches(this.trackList().map((e,t)=>({trackIndex:t,scene:Te,viaScene:Te})))}command(e){let t=K(e.track_index,-1),i=K(e.scene_index,-1);switch(e.action){case"launch":t>=0&&i>=0&&this.queue(t,i);break;case"stop":t>=0&&this.queue(t,Te);break;case"scene":i>=0&&this.launchScene(i);break;case"stop_all":this.stopAll();break}}onSlot(e,t){this.findSlot(e,t)?(this.selectedSlot={track_index:e,scene_index:t},this.set({selectedSlot:this.selectedSlot}),this.queue(e,t)):this.queue(e,Te)}render(){let e=this.engine??this,t=this.trackList(),i=typeof this.selectedSlot?.track_index=="number"&&typeof this.selectedSlot?.scene_index=="number"?{track:this.selectedSlot.track_index,scene:this.selectedSlot.scene_index}:null,n=s=>s.stopPropagation();return u`<nbplay-header badge="launcher">
        <label class="nbplay-launcher-field" title="Launch quantization">
          <span>Quantize</span>
          <select
            class="nbplay-launcher-quantize"
            .value=${this.quantize}
            @input=${n}
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
        .queued=${e.states.map(s=>s.queued?s.queued.scene>=0?s.queued.scene:Ve:-1)}
        .progress=${e.progress}
        .selected=${i}
        .playing=${e.isPlaying}
        @nbplay-launch=${s=>{s.stopPropagation();let{track:a,scene:o}=s.detail;this.onSlot(a,o)}}
        @nbplay-launch-scene=${s=>{s.stopPropagation(),this.launchScene(s.detail.scene)}}
        @nbplay-stop-track=${s=>{s.stopPropagation(),this.queue(s.detail.track,Te)}}
        @nbplay-stop-all=${s=>{s.stopPropagation(),this.stopAll()}}
      ></nbplay-launcher-grid>`}};k("nbplay-launcher",oi);function un(r,e,t){return Math.max(e,Math.min(t,r))}function L(r,e,t,i,n){let s=r[e];if(s==null||s==="")return un(t,i,n);let a=Number(s);return un(Number.isFinite(a)?a:t,i,n)}function I(r,e){let t=Oe[r.type]?.find(i=>i.key===e);return L(r,e,t?.default??0,t?.min??-1/0,t?.max??1/0)}function M(r,e){r&&(r.value=e)}function G(r){try{r?.disconnect()}catch{}}function ye(r){r.forEach(e=>{e.dispose?.(),G(e.input),e.output!==e.input&&G(e.output)}),r.length=0}function tn(r){if(!r||typeof r!="object")return!1;let e=r;return typeof e.connect=="function"&&typeof e.disconnect=="function"}function ra(r){if(!r)return null;if(typeof r=="object"&&("input"in r||"output"in r)){let e=r;if(tn(e.input)&&tn(e.output))return{input:e.input,output:e.output,dispose:typeof e.dispose=="function"?e.dispose:void 0,update:typeof e.update=="function"?e.update:void 0};throw new TypeError("effect plugin must return an AudioNode or { input, output } AudioNodes")}if(tn(r))return{input:r,output:r};throw new TypeError("effect plugin must return an AudioNode or { input, output } AudioNodes")}function Ye(r,e,t){let i=r.createGain(),n=r.createGain(),s=r.createGain(),a=r.createGain();s.gain.value=1-e,a.gain.value=e,i.connect(s),s.connect(n);let o=t(i,a);return a.connect(n),{input:i,output:n,setWet:l=>{s.gain.value=1-l,a.gain.value=l},dispose:()=>{[i,n,s,a,...o].forEach(G)}}}function nn(r,e){let t=r.createOscillator(),i=r.createGain();return t.connect(i),e.forEach(n=>{n&&i.connect(n)}),t.start(),{rate:t.frequency,depth:i.gain,stop:()=>{try{t.stop()}catch{}G(t),G(i)}}}function aa(r){let t=r*100,i=new Float32Array(2048);for(let n=0;n<2048;n++){let s=n*2/2047-1;i[n]=(1+t)*s/(1+t*Math.abs(s))}return i}function oa(r,e,t){let i=Math.max(1,Math.floor(r.sampleRate*e)),n=r.createBuffer(2,i,r.sampleRate);for(let s=0;s<n.numberOfChannels;s++){let a=n.getChannelData(s);for(let o=0;o<i;o++){let l=o/i;a[o]=(Math.random()*2-1)*Math.pow(1-l,t)}}return n}function la(r,e){switch(e.type){case"gain":{let t=r.createGain(),i=n=>(t.gain.value=L(n,"gain",1,0,4),!0);return i(e),{input:t,output:t,update:i}}case"filter":{let t=r.createBiquadFilter(),i=n=>(t.type=String(n.filter_type||"lowpass"),t.frequency.value=L(n,"frequency",1200,20,2e4),t.Q.value=L(n,"q",1,1e-4,100),!0);return i(e),{input:t,output:t,update:i}}case"compressor":{let t=r.createDynamicsCompressor(),i=n=>(M(t.threshold,L(n,"threshold",-24,-100,0)),M(t.knee,L(n,"knee",30,0,40)),M(t.ratio,L(n,"ratio",12,1,20)),M(t.attack,L(n,"attack",.003,0,1)),M(t.release,L(n,"release",.25,0,1)),!0);return i(e),{input:t,output:t,update:i}}case"limiter":{let t=r.createDynamicsCompressor();M(t.knee,0),M(t.ratio,20),M(t.attack,.001);let i=n=>(M(t.threshold,L(n,"threshold",-1,-100,0)),M(t.release,L(n,"release",.05,0,1)),!0);return i(e),{input:t,output:t,update:i}}case"delay":{let t=r.createDelay(5),i=r.createGain(),n=Ye(r,L(e,"wet",.35,0,1),(a,o)=>(a.connect(t),t.connect(i),i.connect(t),t.connect(o),[t,i])),s=a=>(t.delayTime.value=L(a,"time",.25,0,5),i.gain.value=L(a,"feedback",.25,0,.95),n.setWet(L(a,"wet",.35,0,1)),!0);return s(e),{...n,update:s}}case"reverb":{let t=r.createConvolver(),i=L(e,"seconds",1.5,.01,10),n=L(e,"decay",2,.01,12);t.buffer=oa(r,i,n);let s=Ye(r,L(e,"wet",.25,0,1),(o,l)=>(o.connect(t),t.connect(l),[t]));return{...s,update:o=>L(o,"seconds",1.5,.01,10)!==i||L(o,"decay",2,.01,12)!==n?!1:(s.setWet(L(o,"wet",.25,0,1)),!0)}}case"eq":{let t=r.createBiquadFilter(),i=r.createBiquadFilter(),n=r.createBiquadFilter();t.type="lowshelf",i.type="peaking",n.type="highshelf",t.connect(i),i.connect(n);let s=a=>(M(t.frequency,I(a,"low_freq")),M(t.gain,I(a,"low")),M(i.frequency,I(a,"mid_freq")),M(i.Q,I(a,"mid_q")),M(i.gain,I(a,"mid")),M(n.frequency,I(a,"high_freq")),M(n.gain,I(a,"high")),!0);return s(e),{input:t,output:n,update:s,dispose:()=>G(i)}}case"distortion":{let t=r.createWaveShaper();t.oversample="4x";let i=r.createBiquadFilter();i.type="lowpass";let n=Ye(r,I(e,"wet"),(o,l)=>(o.connect(t),t.connect(i),i.connect(l),[t,i])),s=-1,a=o=>{let l=I(o,"drive");return l!==s&&(s=l,t.curve=aa(s)),M(i.frequency,I(o,"tone")),n.setWet(I(o,"wet")),!0};return a(e),{...n,update:a}}case"chorus":{let t=r.createDelay(.1),i=nn(r,[t.delayTime]),n=Ye(r,I(e,"wet"),(a,o)=>(a.connect(t),t.connect(o),[t])),s=a=>{let o=I(a,"delay");return M(t.delayTime,o),M(i.rate,I(a,"rate")),M(i.depth,Math.min(I(a,"depth"),o)),n.setWet(I(a,"wet")),!0};return s(e),{...n,update:s,dispose:()=>{i.stop(),n.dispose?.()}}}case"phaser":{let t=[0,1,2,3].map(()=>{let o=r.createBiquadFilter();return o.type="allpass",o}),i=r.createGain(),n=nn(r,t.map(o=>o.frequency)),s=Ye(r,I(e,"wet"),(o,l)=>{let c=t[t.length-1];return o.connect(t[0]),t.slice(1).forEach((h,p)=>t[p].connect(h)),c.connect(l),c.connect(i),i.connect(t[0]),[...t,i]}),a=o=>{let l=I(o,"frequency");return t.forEach(c=>M(c.frequency,l)),M(n.rate,I(o,"rate")),M(n.depth,l*I(o,"depth")*.95),M(i.gain,I(o,"feedback")),s.setWet(I(o,"wet")),!0};return a(e),{...s,update:a,dispose:()=>{n.stop(),s.dispose?.()}}}case"tremolo":{let t=r.createGain(),i=nn(r,[t.gain]),n=s=>{let a=I(s,"depth");return M(t.gain,1-a/2),M(i.depth,a/2),M(i.rate,I(s,"rate")),!0};return n(e),{input:t,output:t,update:n,dispose:i.stop}}default:return null}}var ca=Object.fromEntries(ee.map(r=>[r,la]));function li(){let r=globalThis,e=r.__nbplayPlugins&&typeof r.__nbplayPlugins=="object"?r.__nbplayPlugins:{},t=Object.create(null);return Object.entries(e).forEach(([i,n])=>{typeof n=="function"&&(t[i]=n)}),Object.assign(t,ca),t}function sn(r,e=[]){let t=li();return e.map(i=>{try{let n=Object.prototype.hasOwnProperty.call(t,i.type)?t[i.type]:void 0;return ra(n?.(r,i))}catch(n){return console.warn("nbplay mixer effect plugin failed",i.type,n),null}}).filter(i=>i!==null)}function rn(r,e,t){let i=r;e.forEach(n=>{i.connect(n.input),i=n.output}),i.connect(t)}function Es(r){if(r==="filter")return{type:r,filter_type:"lowpass",frequency:1200,q:1};if(r==="compressor")return{type:r,threshold:-24,knee:30,ratio:12,attack:.003,release:.25};if(r==="limiter")return{type:r,threshold:-1,release:.05};if(r==="delay")return{type:r,time:.25,feedback:.25,wet:.35};if(r==="reverb")return{type:r,seconds:1.5,decay:2,wet:.25};if(r==="gain")return{type:r,gain:1};let e=Oe[r];return e?{type:r,...Object.fromEntries(e.map(t=>[t.key,t.default]))}:{type:r}}function xs(r){return r.enabled!==!1}function an(r=[]){return r.filter(xs).map(e=>({...e}))}function Ns(r){let{enabled:e,...t}=r;return xs(r)?{...t,enabled:!1}:t}function on(r,e){return e.length?e[e.length-1].output:r}function ln(r,e,t){if(r.length!==t.length||e.length!==t.length)return!1;for(let i=0;i<t.length;i++)if(e[i].type!==t[i].type)return!1;for(let i=0;i<t.length;i++){if(JSON.stringify(e[i])===JSON.stringify(t[i]))continue;let n=r[i].update;if(!n||!n(t[i]))return!1}return!0}function cn(r,e){if(!r)return{peak:0,rms:0};r.getFloatTimeDomainData(e);let t=0,i=0;for(let n=0;n<e.length;n++){let s=Math.abs(e[n]);s>t&&(t=s),i+=e[n]*e[n]}return{peak:t,rms:Math.sqrt(i/Math.max(1,e.length))}}function Ps(){let r=null,e=null,t=[],i=[],n=null,s=!1,a=[],o=[],l=new Float32Array(256);function c(p){ye(p.effects),p.input.disconnect(),p.gain.disconnect(),G(p.analyser)}function h(){if(!r?.createAnalyser)return null;let p=r.createAnalyser();return p.fftSize=256,p.smoothingTimeConstant=.6,p}return{init(p){if(r)return;let d=w(p);r=d?Zn(d):z(),r&&(e=r.createGain(),e.connect(r.destination),n=h())},syncChannels(p,d,m=[],g=[]){if(!r||!e)return;for(;a.length<p.length;){let b=r.createGain(),E=r.createStereoPanner();b.connect(E),E.connect(e),a.push({gain:b,pan:E,effects:[],descriptors:[],analyser:h(),sends:[]});let y=a[a.length-1];y.analyser&&E.connect(y.analyser)}for(;a.length>p.length;){let b=a.pop();ye(b.effects),b.gain.disconnect(),b.pan.disconnect(),b.sends.forEach(E=>E.disconnect()),G(b.analyser)}for(;o.length<g.length;){let b=r.createGain(),E=r.createGain();b.connect(E),E.connect(e);let y={input:b,gain:E,effects:[],descriptors:[],analyser:h()};y.analyser&&E.connect(y.analyser),o.push(y)}for(;o.length>g.length;)c(o.pop());o.forEach((b,E)=>{let y=an(g[E]?.effects);JSON.stringify(b.descriptors)!==JSON.stringify(y)&&(ln(b.effects,b.descriptors,y)||(G(b.input),ye(b.effects),b.effects=sn(r,y),rn(b.input,b.effects,b.gain)),b.descriptors=y),b.gain.gain.value=g[E].gain}),a.forEach((b,E)=>{let y=an(p[E]?.effects);if(b.descriptors.length===y.length&&JSON.stringify(b.descriptors)===JSON.stringify(y))return;if(ln(b.effects,b.descriptors,y)){b.descriptors=y;return}G(b.pan),ye(b.effects),b.effects=sn(r,y),b.descriptors=y,rn(b.pan,b.effects,e);let S=on(b.pan,b.effects);b.analyser&&S.connect(b.analyser),b.sends.forEach(C=>S.connect(C))}),a.forEach((b,E)=>{for(;b.sends.length>o.length;)b.sends.pop().disconnect();for(;b.sends.length<o.length;){let S=r.createGain();S.gain.value=0,on(b.pan,b.effects).connect(S),S.connect(o[b.sends.length].input),b.sends.push(S)}let y=p[E]?.sends||[];b.sends.forEach((S,C)=>{S.gain.value=un(Number(y[C])||0,0,1)})});let f=an(m);(!s||JSON.stringify(i)!==JSON.stringify(f))&&(s&&ln(t,i,f)?i=f:(G(e),ye(t),t=sn(r,f),i=f,s=!0,rn(e,t,r.destination),n&&on(e,t).connect(n)));let $=p.some(b=>b.solo);p.forEach((b,E)=>{let y=a[E],S=b.gain;(b.mute||$&&!b.solo)&&(S=0),y.gain.gain.value=S,y.pan.pan.value=b.pan}),e.gain.value=d},levels(){return r?{channels:a.map(p=>cn(p.analyser,l)),returns:o.map(p=>cn(p.analyser,l)),master:cn(n,l)}:null},register(p){if(!r||!e)return;let d=Ee(p);d.audioCtx=r,d.masterGain=e,d.masterAnalyser=n,d.channels=a,d.returns=o,Object.defineProperty(d,"plugins",{configurable:!0,enumerable:!0,get:li}),document.dispatchEvent(new CustomEvent("nbplay-bus-ready",{detail:{sessionId:p}}))},destroy(p){let d=w(p);if(d&&(delete d.audioCtx,delete d.masterGain,delete d.masterAnalyser,delete d.channels,delete d.returns,delete d.plugins,Object.keys(d).length===0)){let m=globalThis;delete m.__nbplay[p]}a.forEach(m=>{ye(m.effects),m.gain.disconnect(),m.pan.disconnect(),m.sends.forEach(g=>g.disconnect()),G(m.analyser)}),a.length=0,o.forEach(c),o.length=0,ye(t),i=[],s=!1,G(n),n=null,e&&e.disconnect(),r&&r.state!=="closed"&&r.close(),r=null,e=null,t=[]}}}var ua=33,ci=class extends v{static properties={channels:{attribute:!1,noAccessor:!0},returns:{attribute:!1,noAccessor:!0},masterGain:{type:Number,attribute:"master-gain",noAccessor:!0},masterEffects:{attribute:!1,noAccessor:!0},sessionId:{type:String,attribute:"session-id",reflect:!0}};graph={channels:[],returns:[],masterGain:.85,masterEffects:[]};bus=Ps();busReady=!1;meterFrame=null;lastMeterMs=0;constructor(){super(),this.sessionId=""}get channels(){return this.graph.channels}set channels(e){this.setGraph("channels",e)}get returns(){return this.graph.returns}set returns(e){this.setGraph("returns",e)}get masterGain(){return this.graph.masterGain}set masterGain(e){this.setGraph("masterGain",e)}get masterEffects(){return this.graph.masterEffects}set masterEffects(e){this.setGraph("masterEffects",e)}setGraph(e,t){let i=this.graph[e];this.graph[e]=t,this.requestUpdate(e,i),this.busReady&&this.syncBus()}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-mixer"),this.tabIndex=0,this.attach()}disconnectedCallback(){super.disconnectedCallback(),this.detach(this.sessionId)}updated(e){if(!e.has("sessionId"))return;let t=e.get("sessionId");t&&t!==this.sessionId&&this.detach(t),this.attach()}attach(){this.busReady||!this.sessionId||!this.isConnected||(this.bus.init(this.sessionId),this.busReady=!0,this.syncBus(),this.bus.register(this.sessionId),typeof requestAnimationFrame=="function"&&(this.meterFrame=requestAnimationFrame(this.meterTick)))}detach(e){this.meterFrame!==null&&cancelAnimationFrame(this.meterFrame),this.meterFrame=null,this.busReady=!1,e&&this.bus.destroy(e)}syncBus(){this.bus.syncChannels(this.channels||[],Number(this.masterGain),this.masterEffects||[],this.returns||[])}set(e){this.emitDetail("nbplay-set",{values:e})}applyLevel(e,t){if(!e)return;e.dataset.peak=t.peak.toFixed(3);let i=e.querySelector("nbplay-meter");i&&(i.level=t.peak,i.rms=t.rms)}meterTick=e=>{if(this.meterFrame=requestAnimationFrame(this.meterTick),e-this.lastMeterMs<ua||document.hidden)return;this.lastMeterMs=e;let t=this.bus.levels();if(!t)return;let i=this.querySelectorAll('nbplay-strip[kind="channel"]');t.channels.forEach((s,a)=>this.applyLevel(i[a]||null,s));let n=this.querySelectorAll('nbplay-strip[kind="return"]');t.returns.forEach((s,a)=>this.applyLevel(n[a]||null,s)),this.applyLevel(this.querySelector('nbplay-strip[kind="master"]'),t.master)};updateChannel(e,t,i){let n=[...this.channels||[]];e>=n.length||n[e][t]!==i&&(n[e]={...n[e],[t]:i},this.channels=n,this.set({channels:n}))}updateReturn(e,t,i){let n=[...this.returns||[]];e>=n.length||n[e][t]!==i&&(n[e]={...n[e],[t]:i},this.returns=n,this.set({returns:n}))}effectsFor(e,t){return e==="master"?this.masterEffects||[]:e==="return"?this.returns?.[t]?.effects||[]:this.channels?.[t]?.effects||[]}writeEffects(e,t,i){e==="master"?(this.masterEffects=i,this.set({masterEffects:i})):e==="return"?this.updateReturn(t,"effects",i):this.updateChannel(t,"effects",i)}onStripEdit(e,t,i){i.stopPropagation();let n=i.detail;if(n.field==="effect"){let s=n.index??-1,a=this.effectsFor(e,t);n.key==="enabled"?this.writeEffects(e,t,a.map((o,l)=>l===s?Ns(o):o)):n.value!==void 0&&this.writeEffects(e,t,a.map((o,l)=>l===s?{...o,[n.key]:n.value}:o));return}if(e==="master"){n.field==="gain"&&n.value!==this.masterGain&&(this.masterGain=n.value,this.set({masterGain:this.masterGain}));return}if(e==="return"){n.field==="gain"&&this.updateReturn(t,"gain",n.value);return}if(n.field==="send"){let s=this.channels?.[t],a=n.index??-1;if(!s||a<0)return;let o=Array.from({length:(this.returns||[]).length},(l,c)=>N(Number(s.sends?.[c])||0,0,1));o[a]=N(Number(n.value)||0,0,1),this.updateChannel(t,"sends",o);return}this.updateChannel(t,n.field,n.value)}onEffectAdd(e,t,i){i.stopPropagation();let n=i.detail.type;this.writeEffects(e,t,[...this.effectsFor(e,t),Es(n)])}onEffectRemove(e,t,i){i.stopPropagation();let n=i.detail.index;this.writeEffects(e,t,this.effectsFor(e,t).filter((s,a)=>a!==n))}addChannel(){let e=[...this.channels||[]];e.push({name:"Ch "+(e.length+1),gain:.8,pan:0,mute:!1,solo:!1,effects:[]}),this.channels=e,this.set({channels:e})}removeChannel(e){let t=[...this.channels||[]];t.splice(e,1),this.channels=t,this.set({channels:t})}addReturn(){let e=this.returns||[],t=[...e,{name:`Return ${e.length+1}`,gain:.8,effects:[]}],i=(this.channels||[]).map(n=>({...n,sends:[...Array.from({length:e.length},(s,a)=>N(Number(n.sends?.[a])||0,0,1)),0]}));this.returns=t,this.channels=i,this.set({returns:t,channels:i})}removeReturn(e){let t=(this.returns||[]).filter((n,s)=>s!==e),i=(this.channels||[]).map(n=>({...n,sends:(n.sends||[]).filter((s,a)=>a!==e)}));this.returns=t,this.channels=i,this.set({returns:t,channels:i})}render(){let e=this.channels||[],t=this.returns||[],i=t.map(a=>a.name),n=[...ee,...Object.keys(li()).filter(a=>!ee.includes(a))],s=(a,o,l,c)=>u`<nbplay-strip
        class=${l}
        kind=${a}
        data-index=${o}
        .name=${c.name}
        .gain=${c.gain}
        .pan=${c.pan??0}
        .mute=${!!c.mute}
        .solo=${!!c.solo}
        .sends=${c.sends??[]}
        .sendNames=${a==="channel"?i:[]}
        .effects=${c.effects??[]}
        .effectTypes=${n}
        @input=${h=>this.onStripEdit(a,o,h)}
        @change=${h=>this.onStripEdit(a,o,h)}
        @nbplay-effect-add=${h=>this.onEffectAdd(a,o,h)}
        @nbplay-effect-remove=${h=>this.onEffectRemove(a,o,h)}
        @nbplay-remove=${h=>{h.stopPropagation(),a==="channel"?this.removeChannel(o):a==="return"&&this.removeReturn(o)}}
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
      </div>`}};k("nbplay-mixer",ci);function Q(r,e){let t=Number(r);return Number.isFinite(t)?Math.max(0,Math.min(127,Math.round(t))):e}function ws(r,e,t){return e>=r.note_low&&e<=r.note_high&&t>=r.velocity_low&&t<=r.velocity_high}function Cs(r,e=2048){if(r.length<=e)return r.slice();let t=new Float32Array(e),i=r.length/e;for(let n=0;n<e;n++)t[n]=r[Math.floor(n*i)];return t}function ui(r){let e=new ArrayBuffer(r.length*4),t=new DataView(e);for(let i=0;i<r.length;i++)t.setFloat32(i*4,r[i],!0);return t}function da(r){let e=new Float32Array(r.length),t=Math.max(1,r.numberOfChannels);for(let i=0;i<t;i++){let n=r.getChannelData(i);for(let s=0;s<e.length;s++)e[s]+=n[s]/t}return e}async function Qe(r){let e=z();if(!e)return null;try{let t=await e.decodeAudioData(r);return{samples:da(t),sampleRate:t.sampleRate}}finally{e.state!=="closed"&&e.close()}}function As(r=8){let e=Math.max(1,Math.round(r||8)),t=null,i=null,n=!0,s=[],a=null,o=null,l=44100,c=[];function h(){if(!t||!o||o.length===0)return!1;if(a)return!0;a=t.createBuffer(1,o.length,l);let m=a.getChannelData(0);for(let g=0;g<o.length;g++)m[g]=o[g];return!0}function p(m){let g=s.indexOf(m);g>=0&&s.splice(g,1);try{m.gainNode.disconnect()}catch{}}function d(m){return!t||m.samples.length===0?null:(m.buffer||(m.buffer=t.createBuffer(1,m.samples.length,m.sample_rate),m.buffer.getChannelData(0).set(m.samples)),m.buffer)}return{setMaxVoices(m){e=Math.max(1,Math.round(Number(m)||8))},setSession(m,g){if(m&&g>=0){let f=w(m);if(f?.audioCtx&&f.channels?.[g]){t!==f.audioCtx&&(n&&t&&(this.stopAll(),t.state!=="closed"&&t.close()),a=null,c.forEach($=>$.buffer=null)),t=f.audioCtx,i=f.channels[g].gain,n=!1;return}}},setWaveformData(m,g){if(!(!m||m.length===0)){o=new Float32Array(m.length);for(let f=0;f<m.length;f++)o[f]=m[f];l=g,a=null,t||(t=z({sampleRate:g}),t&&(n=!0))}},setZones(m){c=m.map(g=>({...g,buffer:null})),!t&&c.length>0&&(t=z(),t&&(n=!0))},zoneFor(m,g){return c.find(f=>ws(f,m,g))},noteOn(m,g,f,$=127,b,E,y){let S=c.find(q=>ws(q,m,O($,127))),C=S?d(S):null;if(!t||!C&&!h())return;t.state==="suspended"&&t.resume();let T=m-(S?S.root_note:g),R=Math.pow(2,T/12),W=!C&&b!==void 0&&b.end>b.start&&b.start>=0&&b.end<=o.length,j=E??t.currentTime,{sourceNode:F,gainNode:ue,releaseTime:ve}=Ki(t,i||t.destination,{buffer:C||a,playbackRate:R,loop:!W&&!C,region:W&&b?{offset:b.start/l,length:(b.end-b.start)/l}:void 0,envelope:f,peak:O($,127)/127,at:j,duration:y}),te={gainNode:ue,sourceNode:F,noteNum:m,startTime:j,releaseTime:ve};F.onended=()=>p(te),s.push(te);let P=s.filter(q=>q.releaseTime===null);if(P.length>e){let q=P[0];q.releaseTime=j;try{q.sourceNode.stop(j)}catch{}}return te},noteOff(m,g){if(!t)return;let f=t.currentTime;s.filter(b=>b.noteNum===m&&b.releaseTime===null).forEach(b=>{b.releaseTime=f;let E=b.gainNode.gain.value;b.gainNode.gain.setValueAtTime(E,f),b.gainNode.gain.linearRampToValueAtTime(0,f+g.release),b.sourceNode.stop(f+g.release),setTimeout(()=>p(b),g.release*1e3+10)})},cancelVoice(m){try{m.sourceNode.stop(0)}catch{}p(m)},getActiveVoiceCount(){return s.filter(m=>m.releaseTime===null).length},stopAll(){if(!t)return;let m=t.currentTime;[...s].forEach(g=>{try{g.sourceNode.stop(m)}catch{}p(g)}),s.length=0},destroy(){this.stopAll(),n&&t&&t.state!=="closed"&&t.close(),t=null,i=null,n=!0}}}var pa=50;function Ts(r,e){if(r===0)return"\u2014";let t=r/e;return t<1?(t*1e3).toFixed(0)+" ms":t.toFixed(2)+" s"}var di=class extends v{static properties={sampleName:{type:String,attribute:"sample-name"},sampleRate:{type:Number,attribute:"sample-rate"},sampleLength:{type:Number,attribute:"sample-length"},rootNote:{type:Number,attribute:"root-note"},waveform:{attribute:!1},sampleData:{attribute:!1},attack:{type:Number},decay:{type:Number},sustain:{type:Number},release:{type:Number},maxVoices:{type:Number,attribute:"max-voices"},padCount:{type:Number,attribute:"pad-count"},padNotes:{attribute:!1},padVelocities:{attribute:!1},padActions:{attribute:!1},sampleSlices:{attribute:!1},velocity:{type:Number},velocitySensitive:{type:Boolean,attribute:"velocity-sensitive"},zones:{attribute:!1},sessionId:{type:String,attribute:"session-id",reflect:!0},channelIndex:{type:Number,attribute:"channel-index"},activePads:{attribute:!1},lastNoteEvent:{attribute:!1},lastPadEvent:{attribute:!1},activeVoices:{type:Number,attribute:!1},zoneStatus:{type:String,attribute:!1},recording:{type:Boolean,attribute:!1}};engine=As();held=new Set;heldNotes=new Map;voiceTimer=null;registration=null;recorder=null;recorderStream=null;recorderChunks=[];capturePad=-1;constructor(){super(),this.sampleName="",this.sampleRate=44100,this.sampleLength=0,this.rootNote=60,this.waveform=null,this.sampleData=null,this.attack=.01,this.decay=.1,this.sustain=.7,this.release=.3,this.maxVoices=8,this.padCount=8,this.padNotes=[],this.padVelocities=[],this.padActions=[],this.sampleSlices=[],this.velocity=100,this.velocitySensitive=!0,this.zones=[],this.sessionId="",this.channelIndex=-1,this.activePads=[],this.lastNoteEvent={},this.lastPadEvent={},this.activeVoices=0,this.zoneStatus="",this.recording=!1}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-sampler"),this.engine.setMaxVoices(this.maxVoices),this.engine.setSession(this.sessionId,this.channelIndex),this.loadSample(),this.engine.setZones(this.zoneList()),this.fitPads(),document.addEventListener("nbplay-bus-ready",this.onBusReady),this.register(),this.voiceTimer=setInterval(()=>{let e=this.engine.getActiveVoiceCount();e!==this.activeVoices&&(this.activeVoices=e)},pa)}disconnectedCallback(){super.disconnectedCallback(),this.voiceTimer&&clearInterval(this.voiceTimer),this.voiceTimer=null,this.stopZoneRecording(),this.recorderStream?.getTracks().forEach(e=>e.stop()),document.removeEventListener("nbplay-bus-ready",this.onBusReady),this.unregister(),this.engine.destroy()}updated(e){(e.has("sessionId")||e.has("channelIndex"))&&[...e.keys()].some(t=>e.get(t)!==void 0)&&this.register(),e.has("maxVoices")&&this.engine.setMaxVoices(this.maxVoices),(e.has("sampleData")||e.has("waveform")||e.has("sampleRate"))&&[...e.keys()].some(t=>e.get(t)!==void 0)&&this.loadSample(),e.has("zones")&&e.get("zones")!==void 0&&this.engine.setZones(this.zoneList()),(e.has("padNotes")||e.has("padCount"))&&[...e.keys()].some(t=>e.get(t)!==void 0)&&this.fitPads()}set(e){this.emitDetail("nbplay-set",{values:e})}status(){this.activePads=Array.from(this.held),this.emitDetail("nbplay-status",{values:{activePads:this.activePads,lastNoteEvent:this.lastNoteEvent,lastPadEvent:this.lastPadEvent},save:!0})}loadSample(){let e=X(this.waveform),t=X(this.sampleData);(t||e)&&this.engine.setWaveformData(t||e,Number(this.sampleRate))}envelope(){return{attack:Number(this.attack),decay:Number(this.decay),sustain:Number(this.sustain),release:Number(this.release)}}async loadFile(e){let t=await Qe(await e.arrayBuffer());if(!t)return;let i=Cs(t.samples);this.sampleName=e.name,this.sampleRate=t.sampleRate,this.sampleLength=t.samples.length,this.sampleData=ui(t.samples),this.waveform=ui(i),this.engine.setWaveformData(t.samples,t.sampleRate),this.set({sampleName:this.sampleName,sampleRate:this.sampleRate,sampleLength:this.sampleLength,sampleData:this.sampleData,waveform:this.waveform})}count(){return N(Number(this.padCount||8),1,32)}notes(){return wi((this.padNotes||[]).slice(),this.count())}velocities(){return rt((this.padVelocities||[]).slice(),this.count(),Number(this.velocity))}actions(){return $e(this.padActions,this.notes(),this.velocities(),this.count())}slices(){return(this.sampleSlices||[]).map((e,t)=>({index:Number(e.index??t),note:Number(e.note),start:Math.max(0,Math.floor(Number(e.start)||0)),end:Math.max(0,Math.floor(Number(e.end)||0)),label:typeof e.label=="string"?e.label:void 0})).filter(e=>Number.isFinite(e.note)&&e.end>e.start)}sliceFor(e){if(e.type!=="note")return;let t=this.slices();return e.slice!==void 0?t.find(i=>i.index===e.slice):t.find(i=>i.note===e.note)}fitPads(){let e=this.notes(),t=this.velocities(),i={};e.length!==(this.padNotes||[]).length&&(this.padNotes=e,i.padNotes=e),t.length!==(this.padVelocities||[]).length&&(this.padVelocities=t,i.padVelocities=t),Object.keys(i).length&&this.emitDetail("nbplay-status",{values:i,save:!1})}pads(){let e=this.velocities();return this.actions().map((t,i)=>{let n=e[i]??100,a=this.sliceFor(t)?.label??(t.type==="note"&&!t.label?void 0:at(t));return a===void 0?{note:t.note,velocity:n}:{note:this.notes()[i]??60,velocity:n,label:a}})}triggerPad(e,t){let i=this.actions()[e];i&&(this.held.add(e),i.type==="note"?(this.heldNotes.set(e,i.note),this.engine.noteOn(i.note,Number(this.rootNote),this.envelope(),t,this.sliceFor(i)),this.lastNoteEvent={note:i.note,velocity:t,type:"on"},this.lastPadEvent={pad:e,event:"on",velocity:t,action:i}):(i.type==="trait"&&this.set({[i.trait]:i.value}),this.lastPadEvent={pad:e,event:"trigger",velocity:t,action:i}),this.status())}releasePad(e){if(!this.held.delete(e))return;let t=this.heldNotes.get(e),i=this.actions()[e];this.heldNotes.delete(e),t!==void 0&&(this.engine.noteOff(t,{release:Number(this.release)}),this.lastNoteEvent={note:t,velocity:0,type:"off"},i&&(this.lastPadEvent={pad:e,event:"off",velocity:0,action:i})),this.status()}onPadChange(e){e.stopPropagation();let{index:t,field:i,value:n}=e.detail;if(i==="note"){let s=this.notes();if(t>=s.length)return;s[t]=n;let a=this.actions().map((o,l)=>l===t&&o.type==="note"?{...o,note:n}:o);this.padNotes=s,this.padActions=a,this.set({padNotes:s,padActions:a})}else{let s=this.velocities();if(t>=s.length)return;s[t]=n,this.padVelocities=s,this.set({padVelocities:s})}}applyPadCount(e){if(Number.isNaN(e))return;let t=N(Math.round(e),1,32),i=wi((this.padNotes||[]).slice(),t),n=rt((this.padVelocities||[]).slice(),t,Number(this.velocity)),s=$e(this.padActions,i,n,t);this.padCount=t,this.padNotes=i,this.padVelocities=n,this.padActions=s,this.set({padCount:t,padNotes:i,padVelocities:n,padActions:s})}onVelocity(e){e.stopPropagation();let t=O(e.detail.value);t!==this.velocity&&(this.velocity=t,this.padVelocities=rt(this.velocities(),this.count(),t),this.set({velocity:t,padVelocities:this.padVelocities}))}zoneList(){return(this.zones||[]).map((e,t)=>({id:String(e.id??t),name:typeof e.name=="string"?e.name:`Zone ${t+1}`,note_low:Q(e.note_low,0),note_high:Q(e.note_high,127),velocity_low:Q(e.velocity_low,0),velocity_high:Q(e.velocity_high,127),root_note:Q(e.root_note,60),sample_rate:Math.max(1,Number(e.sample_rate)||44100),samples:X(e.data)||new Float32Array(0)}))}writeZones(e){let t=e.map(i=>({id:i.id,name:i.name,note_low:i.note_low,note_high:i.note_high,velocity_low:i.velocity_low,velocity_high:i.velocity_high,root_note:i.root_note,sample_rate:i.sample_rate,length:i.samples.length,data:ui(i.samples)}));this.zones=t,this.engine.setZones(e),this.set({zones:t})}addZone(e,t,i,n){let s=this.zoneList();s.push({id:Math.random().toString(36).slice(2,10),name:i,note_low:n.low,note_high:n.high,velocity_low:0,velocity_high:127,root_note:n.root,sample_rate:t,samples:e}),this.writeZones(s)}captureRange(){let e=this.capturePad;if(e>=0){let t=this.notes()[e];if(t!==void 0)return{low:t,high:t,root:t}}return{low:0,high:127,root:60}}onZoneChange(e){e.stopPropagation();let{index:t,field:i,value:n}=e.detail,s=this.zoneList(),a=s[t];if(a){if(i==="name")a.name=String(n).trim()||a.name;else if(i==="low"||i==="high"){let o=i==="low"?"note_low":"note_high",l=Q(n,a[o]);a[o]=l,a.note_low>a.note_high&&(i==="low"?a.note_high=l:a.note_low=l)}else a.root_note=Q(n,a.root_note);this.writeZones(s)}}async addZoneFromFile(e){let t=await Qe(await e.arrayBuffer());t&&(this.addZone(t.samples,t.sampleRate,e.name,this.captureRange()),this.zoneStatus=`Added ${e.name}`)}async command(e){if(e?.url){this.zoneStatus="Capturing\u2026";try{let t=await fetch(e.url),i=await Qe(await t.arrayBuffer());if(!i)throw new Error("Web Audio is unavailable");let n=i.samples,s=Math.max(0,Math.floor((e.offset||0)*i.sampleRate)),a=e.duration&&e.duration>0?Math.max(1,Math.round(e.duration*i.sampleRate)):n.length-s;(s>0||s+a<n.length)&&(n=n.slice(s,Math.min(n.length,s+a)));let o=Q(e.note_low,0),l=Q(e.note_high,127);this.addZone(n,i.sampleRate,e.name||"Take",{low:Math.min(o,l),high:Math.max(o,l),root:Q(e.root_note,o)}),this.zoneStatus=`Captured ${e.name||"take"}`}catch(t){this.zoneStatus=`Capture failed: ${t instanceof Error?t.message:String(t)}`}}}async startZoneRecording(){let e=navigator,t=globalThis.MediaRecorder;if(!t||!e.mediaDevices?.getUserMedia){this.zoneStatus="Microphone recording is unavailable";return}try{this.recorderStream=await e.mediaDevices.getUserMedia({audio:!0})}catch(a){this.zoneStatus=`Microphone unavailable: ${a instanceof Error?a.message:String(a)}`;return}let i=this.captureRange(),n=`Take ${this.zoneList().length+1}`;this.recorderChunks=[];let s=new t(this.recorderStream);this.recorder=s,s.addEventListener("dataavailable",a=>{a.data&&a.data.size&&this.recorderChunks.push(a.data)}),s.addEventListener("stop",async()=>{let a=new Blob(this.recorderChunks,{type:s.mimeType||"audio/webm"});if(this.recorderChunks=[],this.recorderStream?.getTracks().forEach(l=>l.stop()),this.recorderStream=null,this.recorder=null,this.recording=!1,!a.size){this.zoneStatus="No audio was captured";return}let o=await Qe(await a.arrayBuffer());o&&(this.addZone(o.samples,o.sampleRate,n,i),this.zoneStatus=`Captured ${n}`)}),s.start(),this.recording=!0,this.zoneStatus=`Recording ${n}\u2026`}stopZoneRecording(){this.recorder&&this.recorder.state!=="inactive"&&this.recorder.stop()}onBusReady=e=>{e.detail?.sessionId===this.sessionId&&this.register()};unregister(){if(!this.registration)return;let{bus:e,idx:t,sampler:i,instrument:n}=this.registration;e.samplers?.[t]===i&&delete e.samplers[t],e.instruments?.[t]===n&&delete e.instruments[t],this.registration=null}register(){let e=this.sessionId,t=Number(this.channelIndex);if(this.unregister(),!e||t<0)return;let i=w(e);if(!i)return;this.engine.setSession(e,t);let n=i.samplers||{};i.samplers=n,n[t]={triggerNote:(a,o)=>{this.engine.noteOn(a,Number(this.rootNote),this.envelope(),o)},releaseNote:a=>{this.engine.noteOff(a,{release:Number(this.release)})}};let s=i.instruments||{};i.instruments=s,s[t]={scheduleNote:(a,o,l,c)=>{let h=this.slices().find(d=>d.note===a),p=this.engine.noteOn(a,Number(this.rootNote),this.envelope(),o,h,l,c);if(p)return()=>this.engine.cancelVoice(p)}},this.registration={bus:i,idx:t,sampler:n[t],instrument:s[t]}}silence(){this.engine.stopAll()}param(e,t,i,n,s,a,o,l,c="slider"){let h=p=>{p.stopPropagation();let d=p.detail.value;d!==this[i]&&(this[i]=d,this.set({[i]:d}))};return u`<nbplay-param
      class=${e}
      .label=${t}
      .kind=${n}
      .control=${c}
      .value=${Number(this[i])}
      .min=${s}
      .max=${a}
      .step=${o}
      .defaultValue=${l}
      @input=${h}
      @change=${h}
    ></nbplay-param>`}render(){let e=n=>n.stopPropagation(),t=this.notes(),i=this.zoneList();return u`<nbplay-header badge="sampler">
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
        .data=${X(this.waveform)||X(this.sampleData)}
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
          >${_(Number(this.rootNote))}</span
        >
        <span class="nbplay-samp-info-len"
          >${Ts(Number(this.sampleLength),Number(this.sampleRate))}</span
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
            ${t.map((n,s)=>u`<option
                  value=${s}
                  ?selected=${s===this.capturePad}
                  .textContent=${`Pad ${s+1} (${_(n)})`}
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
          .zones=${i.map(n=>({name:n.name,low:n.note_low,high:n.note_high,root:n.root_note,info:Ts(n.samples.length,n.sample_rate)}))}
          @input=${e}
          @change=${this.onZoneChange}
          @nbplay-zone-remove=${n=>{n.stopPropagation();let s=this.zoneList();s.splice(n.detail.index,1),this.writeZones(s)}}
        ></nbplay-zone-list>
      </div>`}};k("nbplay-sampler",di);var Xe=4096,ha=.25,Ms=.1,dn=6,ma=25,ba=50;function A(r,e){let t=Number(r);return Number.isFinite(t)?t:e}function pn(){let r=globalThis.crypto;return r?.randomUUID?`clip-${r.randomUUID()}`:`clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}function pi(r){return r.start+Math.max(.001,r.duration)}function fa(r){return(r.events||[]).map(e=>({beat:Math.max(0,A(e.beat,0)),duration:Math.max(.001,A(e.duration,.25)),note:Math.max(0,Math.min(127,Math.round(A(e.note,60)))),velocity:Math.max(1,Math.min(127,Math.round(A(e.velocity,100))))})).sort((e,t)=>e.beat-t.beat||e.note-t.note)}function ya(r){return r?r instanceof DataView?new Uint8Array(r.buffer,r.byteOffset,r.byteLength):r instanceof ArrayBuffer?new Uint8Array(r):ArrayBuffer.isView(r)?new Uint8Array(r.buffer,r.byteOffset,r.byteLength):null:null}function hn(r){if(r)try{r.disconnect()}catch{}}var hi=class extends v{static properties={tracks:{attribute:!1},clips:{attribute:!1},length:{type:Number},selectedClipId:{type:String,attribute:"selected-clip-id"},bpm:{type:Number},timeSignatureNum:{type:Number,attribute:"time-signature-num"},timeSignatureDen:{type:Number,attribute:"time-signature-den"},countInBars:{type:Number,attribute:"count-in-bars"},autoExtendRecording:{type:Boolean,attribute:"auto-extend-recording"},recordingExtendBars:{type:Number,attribute:"recording-extend-bars"},pixelsPerBeat:{type:Number,attribute:"pixels-per-beat"},sessionId:{type:String,attribute:"session-id",reflect:!0},currentBeat:{type:Number,attribute:!1},exportClipId:{type:String,attribute:!1},importClipRequest:{attribute:!1},importClipData:{attribute:!1},isPlaying:{type:Boolean,attribute:"is-playing",reflect:!0},isRecording:{type:Boolean,attribute:"is-recording",reflect:!0},recordingTrack:{type:Number,attribute:!1},recordingTracks:{attribute:!1},recordingCountdownBeats:{type:Number,attribute:!1},recordingError:{type:String,attribute:!1},recordedClip:{attribute:!1},exportedClip:{attribute:!1},exportedClipData:{attribute:!1},displayBeat:{type:Number,attribute:!1}};binding=null;unbindShortcuts=null;lanes=[];micStream=null;pendingClips=[];recordingStartMs=0;recordingStartBeat=0;recordingStopBeat=null;countInTimer=null;countInTick=null;recordingPending=!1;recordingGeneration=0;recordingStartedPlayback=!1;scheduledTimers=[];scheduledNotes=[];playheadTimer=null;midiTimer=null;midiCursorBeat=0;midiLastBeat=0;noteListenerActive=!1;suppressRestart=!1;disposed=!1;claims={sessionId:"",channels:[]};objectUrls=new Set;activeMedia=[];activeSources=[];constructor(){super(),this.tracks=[],this.clips=[],this.length=16,this.selectedClipId="",this.bpm=120,this.timeSignatureNum=4,this.timeSignatureDen=4,this.countInBars=0,this.autoExtendRecording=!0,this.recordingExtendBars=8,this.pixelsPerBeat=0,this.sessionId="",this.currentBeat=0,this.exportClipId="",this.importClipRequest={},this.importClipData=null,this.isPlaying=!1,this.isRecording=!1,this.recordingTrack=-1,this.recordingTracks=[],this.recordingCountdownBeats=0,this.recordingError="",this.recordedClip={},this.exportedClip={},this.exportedClipData=null,this.displayBeat=null}trackList(){return(this.tracks||[]).map((e,t)=>({name:String(e.name??`Track ${t+1}`),channel_index:A(e.channel_index,t),armed:!!e.armed,muted:!!e.muted,solo:!!e.solo,input:e.input==="channel"||e.input==="midi"?e.input:"microphone",monitor:!!e.monitor}))}clipList(){return(this.clips||[]).map((e,t)=>({...e,id:String(e.id||`clip-${t}`),kind:e.kind==="midi"||Array.isArray(e.events)?"midi":"audio",events:e.kind==="midi"||Array.isArray(e.events)?fa(e):void 0,pattern:typeof e.pattern=="string"?e.pattern:void 0,name:String(e.name??`Clip ${t+1}`),track_index:Math.max(0,A(e.track_index,0)),start:Math.max(0,A(e.start,0)),duration:Math.max(.001,A(e.duration,4)),offset:Math.max(0,A(e.offset,0)),loop:!!e.loop,muted:!!e.muted}))}timelineLength(){return Math.max(1,Math.min(Xe,A(this.length,16)))}beatsPerBar(){return se(this.timeSignatureNum,this.timeSignatureDen)}clampBeat(e){return Math.max(0,Math.min(this.timelineLength(),e))}countInBeats(){return Math.max(0,A(this.countInBars,0))*this.beatsPerBar()}recordingExtendBeats(){return Math.max(1,A(this.recordingExtendBars,8))*this.beatsPerBar()}clock(){if(!this.binding){this.binding=H(this,this.onClockEvent,this.onRebind);let e=this.binding.clock();if(this.joinTempo(e),!this.sessionId&&!e.playing){let t=this.clampBeat(A(this.currentBeat,0));Math.abs(t-e.beat())>1e-9&&e.seek(t)}this.isPlaying=e.playing,this.isRecording=!1,this.recordingTrack=-1,this.recordingTracks=[]}return this.binding.clock()}shared(){return!!this.sessionId}connectedCallback(){super.connectedCallback(),this.classList.add("nbplay-timeline"),this.disposed=!1,this.clock(),this.syncClaims(),this.unbindShortcuts=le(this,{Space:()=>this.togglePlay(),"Shift+Space":()=>{this.clock().stop(),this.seekToBeat(0)},r:()=>this.toggleRecord(),l:()=>this.toggleLoop(),d:()=>this.duplicateSelectedClip(),Delete:()=>this.removeSelectedClip(),Backspace:()=>this.removeSelectedClip()}),this.clock().playing&&this.startPlayback(),this.handleExportRequest(),this.handleImportRequest()}disconnectedCallback(){super.disconnectedCallback(),this.disposed=!0,this.clearCountIn(),this.recordingGeneration+=1,this.recordingPending=!1,this.lanes.forEach(e=>{e.recorder&&e.recorder.state!=="inactive"&&e.recorder.stop()}),this.releaseLanes(),this.clearScheduledPlayback(),this.syncClaims(),this.setNoteListener(!1),this.unbindShortcuts?.(),this.unbindShortcuts=null,this.binding?.dispose(),this.binding=null,this.objectUrls.forEach(e=>URL.revokeObjectURL(e))}updated(e){if(!this.binding)return;let t=i=>e.has(i)&&e.get(i)!==void 0;t("sessionId")?this.binding.rebind():t("bpm")&&this.clock().setTempo(A(this.bpm,120)),t("isPlaying")&&this.onPlayStateWrite(),t("isRecording")&&this.onRecordStateWrite(),t("currentBeat")&&this.onPositionWrite(),t("exportClipId")&&this.handleExportRequest(),(t("importClipRequest")||t("importClipData"))&&this.handleImportRequest(),(e.has("clips")||e.has("tracks")||e.has("length"))&&this.syncLoopRange(),(e.has("clips")||e.has("tracks")||e.has("sessionId"))&&this.syncClaims()}syncClaims(){this.claims.channels.forEach(i=>Gt(this.claims.sessionId,i,"timeline"));let e=this.trackList(),t=new Set;this.isConnected&&this.sessionId&&this.clipList().forEach(i=>{let n=e[i.track_index];i.kind==="midi"&&n&&!i.muted&&(i.events||[]).length>0&&t.add(n.channel_index)}),t.forEach(i=>Kt(this.sessionId,i,"timeline")),this.claims={sessionId:this.sessionId,channels:[...t]}}set(e){this.emitDetail("nbplay-set",{values:e})}status(e,t){this.emitDetail("nbplay-status",{values:e,save:t})}get context(){return this.clock().context()}beatNow(){return this.clampBeat(this.clock().beat())}recordersActive(){return this.lanes.some(e=>e.recording)}recordingActive(){return this.recordersActive()||!!this.countInTimer||this.recordingPending}setRecordingFlag(e){this.clock().setRecording(e),this.isRecording=e,this.status({isRecording:e},!1)}onClockEvent=e=>{let t=this.clock();switch(e.type){case"play":this.isPlaying=!0,this.status({isPlaying:!0},!0),this.startPlayback();break;case"stop":this.clearScheduledPlayback(),this.isPlaying=!1,this.currentBeat=this.clampBeat(e.beat),this.status({isPlaying:!1,currentBeat:this.currentBeat},!0),this.recordingActive()&&this.stopRecording();break;case"seek":this.displayBeat=null,this.currentBeat=this.clampBeat(e.beat),this.status({currentBeat:this.currentBeat},!1),t.playing&&!this.suppressRestart&&this.startPlayback();break;case"tempo":Number(this.bpm)!==t.bpm&&(this.bpm=t.bpm,this.set({bpm:t.bpm})),t.playing&&this.startPlayback();break;case"record":t.recording?this.recordingActive()||this.startRecording():this.recordingActive()&&this.stopRecording();break;case"loop":this.syncLoopRange();break;case"timesig":break}};joinTempo(e){let t=e.adoptTempo(A(this.bpm,120));t!==A(this.bpm,120)&&(this.bpm=t,this.set({bpm:t}))}onRebind=e=>{this.clearScheduledPlayback(),this.joinTempo(e),this.isPlaying=e.playing,this.status({isPlaying:e.playing},!1),e.playing&&this.startPlayback()};onPlayStateWrite(){let e=this.clock();this.shared()?!!this.isPlaying!==e.playing&&(this.isPlaying=e.playing,this.status({isPlaying:e.playing},!0)):this.isPlaying?e.playing||e.play():e.playing&&e.stop()}onRecordStateWrite(){this.shared()?!!this.isRecording!==this.clock().recording&&(this.isRecording=this.clock().recording,this.status({isRecording:this.isRecording},!0)):this.isRecording?this.recordingActive()||this.startRecording():this.recordingActive()&&this.stopRecording()}onPositionWrite(){let e=this.clock();if(!this.shared()&&!e.playing){let t=this.clampBeat(A(this.currentBeat,0));Math.abs(t-e.beat())>1e-9&&e.seek(t)}}togglePlay(){let e=this.clock();e.playing?e.stop():e.play()}toggleRecord(){this.recordingActive()||this.isRecording?this.stopRecording():this.startRecording()}clearCountIn(){this.countInTimer&&(clearTimeout(this.countInTimer),this.countInTimer=null),this.countInTick&&(clearInterval(this.countInTick),this.countInTick=null),this.recordingCountdownBeats=0,this.status({recordingCountdownBeats:0},!1)}stopMicStream(){this.micStream?.getTracks().forEach(e=>e.stop()),this.micStream=null}releaseLanes(){this.lanes.forEach(e=>{hn(e.monitor),hn(e.tap)}),this.lanes=[],this.pendingClips=[],this.stopMicStream(),this.setNoteListener(!1)}onDocumentNote=e=>{let t=e.detail;if(!t)return;let i=Math.round(A(t.note,-1));if(i<0||i>127)return;let n=Math.max(0,this.clock().beat()-this.recordingStartBeat);this.lanes.forEach(s=>{s.kind!=="midi"||!s.recording||(t.type==="on"&&A(t.velocity,0)>0?s.openNotes.set(i,{beat:n,velocity:Math.max(1,Math.min(127,Math.round(A(t.velocity,100))))}):this.closeLaneNote(s,i,n))})};closeLaneNote(e,t,i){let n=e.openNotes.get(t);n&&(e.openNotes.delete(t),e.events.push({beat:n.beat,duration:Math.max(.05,i-n.beat),note:t,velocity:n.velocity}))}setNoteListener(e){e!==this.noteListenerActive&&(this.noteListenerActive=e,e?document.addEventListener("nbplay-note",this.onDocumentNote):document.removeEventListener("nbplay-note",this.onDocumentNote))}finalizeMidiLane(e,t){let i=Math.max(0,t-this.recordingStartBeat);if([...e.openNotes.keys()].forEach(n=>this.closeLaneNote(e,n,i)),e.recording=!1,e.done=!0,e.events.length>0){let n=this.clipList().length+this.pendingClips.length+1;this.pendingClips.push({id:pn(),kind:"midi",name:`Take ${n}`,track_index:e.trackIndex,start:this.recordingStartBeat,duration:this.recordingDurationBeats(),loop:!1,muted:!1,recorded:!0,offset:0,source:"recording",events:[...e.events].sort((s,a)=>s.beat-a.beat||s.note-a.note)})}this.lanes.every(n=>n.done)&&this.finishRecording()}clearScheduledPlayback(){this.scheduledTimers.forEach(t=>clearTimeout(t)),this.scheduledTimers=[];let e=this.clock().now();this.scheduledNotes.forEach(t=>{t.until>e&&t.cancel()}),this.scheduledNotes=[],this.activeMedia.forEach(t=>{try{t.pause(),t.currentTime=0}catch{}}),this.activeMedia.length=0,this.activeSources.forEach(t=>hn(t)),this.activeSources.length=0,this.playheadTimer&&(clearInterval(this.playheadTimer),this.playheadTimer=null),this.midiTimer&&(clearInterval(this.midiTimer),this.midiTimer=null),this.displayBeat=null}writeRecordingError(e){this.disposed||(this.clearCountIn(),this.releaseLanes(),this.recordingPending=!1,this.recordingGeneration+=1,this.recordingStartedPlayback=!1,this.recordingStopBeat=null,this.recordingError=e,this.setRecordingFlag(!1),this.recordingTrack=-1,this.recordingTracks=[],this.status({recordingError:e,isRecording:!1,recordingTrack:-1,recordingTracks:[]},!0))}findRecordingTracks(){let e=this.trackList(),t=e.map((n,s)=>n.armed?s:-1).filter(n=>n>=0);if(t.length>0)return t;let i=A(this.recordingTrack,-1);return i>=0&&i<e.length?[i]:e.length>0?[0]:[]}recordingDurationBeats(){if(this.recordingStopBeat!==null&&this.recordingStopBeat>this.recordingStartBeat)return Math.max(.25,this.recordingStopBeat-this.recordingStartBeat);let e=Math.max(.25,(performance.now()-this.recordingStartMs)/1e3),t=Math.max(1,A(this.bpm,120));return Math.max(.25,e*(t/60))}finalizeLane(e){let t=e.recorder?.mimeType||e.chunks[0]?.type||"audio/webm",i=new Blob(e.chunks,{type:t});if(e.chunks=[],e.recorder=null,e.recording=!1,e.done=!0,i.size&&typeof URL<"u"&&URL.createObjectURL){let n=URL.createObjectURL(i);this.objectUrls.add(n);let s=this.clipList().length+this.pendingClips.length+1;this.pendingClips.push({id:pn(),kind:"audio",name:`Take ${s}`,track_index:e.trackIndex,start:this.recordingStartBeat,duration:this.recordingDurationBeats(),loop:!1,muted:!1,recorded:!0,offset:0,audio_url:n,blob_type:i.type,blob_size:i.size,source:"recording",sample_rate:this.context?.sampleRate||44100})}this.lanes.every(n=>n.done)&&this.finishRecording()}finishRecording(){let e=this.pendingClips;if(this.pendingClips=[],this.releaseLanes(),this.recordingStartedPlayback=!1,this.recordingStopBeat=null,this.disposed)return;if(e.length===0){this.writeRecordingError("No audio was captured");return}let t=[...this.clipList(),...e],i=e[e.length-1];this.clips=t,this.recordedClip=i,this.selectedClipId=i.id,this.recordingError="",this.setRecordingFlag(!1),this.recordingTrack=-1,this.recordingTracks=[],this.recordingCountdownBeats=0,this.length=Math.max(A(this.length,16),...e.map(n=>pi(n))),this.status({recordedClip:i,recordingError:"",isRecording:!1,recordingTrack:-1,recordingTracks:[],recordingCountdownBeats:0},!1),this.set({clips:t,selectedClipId:i.id,length:this.length})}startInputMonitoring(e,t){if(!e.monitor)return null;let i=w(this.sessionId),n=i?.audioCtx||this.context;if(!n?.createMediaStreamSource)return null;try{let s=n.createMediaStreamSource(t),a=i?.channels?.[e.channel_index]?.gain||i?.masterGain||n.destination;return s.connect(a),n.resume?.(),s}catch{return null}}channelTap(e){let t=w(this.sessionId),i=t?.audioCtx,n=t?.channels?.[e.channel_index]?.gain;if(!i?.createMediaStreamDestination||!n)return null;try{let s=i.createMediaStreamDestination();return n.connect(s),{stream:s.stream,node:s}}catch{return null}}ensurePlaybackStarted(){let e=this.clock();e.playing||(this.recordingStartedPlayback=!0,e.play())}beginRecording(e,t,i){i!==this.recordingGeneration||this.lanes.length===0||this.recordersActive()||(this.recordingPending=!1,this.recordingStartMs=performance.now(),this.recordingStartBeat=this.clampBeat(t),this.recordingStopBeat=null,this.pendingClips=[],this.lanes.forEach(n=>{if(n.chunks=[],n.events=[],n.openNotes.clear(),n.done=!1,n.recording=!0,n.kind==="midi"||!n.stream||!e)return;let s=new e(n.stream);s.addEventListener("dataavailable",a=>{a.data?.size&&n.chunks.push(a.data)}),s.addEventListener("stop",()=>this.finalizeLane(n),{once:!0}),n.recorder=s}),this.lanes.forEach(n=>n.recorder?.start()),this.lanes.some(n=>n.kind==="midi")&&this.setNoteListener(!0),this.recordingError="",this.recordingTrack=this.lanes[0].trackIndex,this.recordingTracks=this.lanes.map(n=>n.trackIndex),this.recordingCountdownBeats=0,this.setRecordingFlag(!0),this.ensurePlaybackStarted(),this.status({recordingError:"",recordingTrack:this.recordingTrack,recordingTracks:this.recordingTracks,recordingCountdownBeats:0,isRecording:!0},!0))}scheduleCountIn(e,t,i,n){let a=Math.max(1,A(this.bpm,120))/60,o=performance.now(),l=Math.max(0,i/a*1e3);this.recordingCountdownBeats=i,this.countInTick=setInterval(()=>{let c=(performance.now()-o)/1e3*a,h=Math.max(0,i-c);this.recordingCountdownBeats=h,this.status({recordingCountdownBeats:h},!1),h<=0&&this.countInTick&&(clearInterval(this.countInTick),this.countInTick=null)},50),this.countInTimer=setTimeout(()=>{if(this.countInTimer=null,this.countInTick&&(clearInterval(this.countInTick),this.countInTick=null),this.recordingCountdownBeats=0,this.status({recordingCountdownBeats:0},!1),this.disposed){this.releaseLanes();return}n===this.recordingGeneration&&this.beginRecording(e,t,n)},l)}async startRecording(){if(this.recordingActive())return;let e=this.findRecordingTracks();if(e.length===0){this.writeRecordingError("Add a track before recording");return}let t=this.trackList(),i=e.some(l=>t[l].input==="microphone"),n=e.some(l=>t[l].input!=="midi"),s=navigator,a=globalThis.MediaRecorder;if(n&&!a||i&&!s.mediaDevices?.getUserMedia){this.writeRecordingError(i?"Microphone recording is unavailable in this browser":"Recording is unavailable in this browser");return}let o=++this.recordingGeneration;this.recordingPending=!0,this.recordingError="",this.recordingTrack=e[0],this.recordingTracks=e,this.recordingCountdownBeats=0,this.setRecordingFlag(!0),this.status({recordingError:"",recordingTrack:e[0],recordingTracks:e,recordingCountdownBeats:0,isRecording:!0},!0);try{let l=null;if(i){if(l=await s.mediaDevices.getUserMedia({audio:!0}),this.disposed||o!==this.recordingGeneration||!this.recordingPending||!this.isRecording){l.getTracks().forEach(f=>f.stop()),o===this.recordingGeneration&&(this.recordingPending=!1);return}this.micStream=l}let c=[],h=(f,$)=>({trackIndex:f,kind:$,stream:null,recorder:null,recording:!1,chunks:[],events:[],openNotes:new Map,tap:null,monitor:null,done:!1});for(let f of e){let $=t[f];if($.input==="midi")c.push(h(f,"midi"));else if($.input==="channel"){let b=this.channelTap($);if(!b)throw new Error(`Mixer channel ${$.channel_index+1} is not available for recording`);c.push({...h(f,"audio"),stream:b.stream,tap:b.node})}else c.push({...h(f,"audio"),stream:l,monitor:this.startInputMonitoring($,l)})}this.lanes=c;let p=this.beatNow(),d=this.countInBeats(),m=d>0?Math.max(0,p-d):p,g=d>0?p>0?p-m:d:0;this.recordingCountdownBeats=g,d>0&&p>0&&(this.clock().seek(m),this.ensurePlaybackStarted()),this.status({recordingCountdownBeats:g},!0),g>0?this.scheduleCountIn(a,p,g,o):this.beginRecording(a,p,o)}catch(l){if(o!==this.recordingGeneration)return;this.releaseLanes(),this.recordingPending=!1,this.recordingStartedPlayback=!1,this.writeRecordingError(l instanceof Error?l.message:"Could not start recording")}}stopRecording(){if(this.clearCountIn(),!this.recordersActive()){this.recordingGeneration+=1,this.recordingPending=!1,this.setRecordingFlag(!1),this.recordingTrack=-1,this.recordingTracks=[],this.recordingCountdownBeats=0;let t=this.recordingStartedPlayback;this.recordingStartedPlayback=!1,this.releaseLanes(),this.status({isRecording:!1,recordingTrack:-1,recordingTracks:[],recordingCountdownBeats:0},!0),t&&this.clock().stop();return}this.recordingStopBeat=Math.max(this.recordingStartBeat,this.beatNow()),this.setNoteListener(!1);let e=this.recordingStopBeat;this.lanes.forEach(t=>{if(t.kind==="midi"){t.recording&&this.finalizeMidiLane(t,e);return}let i=t.recorder;i&&(i.state!=="inactive"?i.stop():this.finalizeLane(t))})}triggerMidiNote(e,t,i,n){if(Wt(this.sessionId,e.channel_index)==="launcher")return;let s=this.clock(),a=w(this.sessionId),o=a?.samplers?.[e.channel_index],l=a?.instruments?.[e.channel_index],c=t.duration*n;if(Ht(this.sessionId,{note:t.note,velocity:t.velocity,type:"on",at:i,duration:c}),l){let d=l.scheduleNote(t.note,t.velocity,i,c);if(d){this.scheduledNotes.push({cancel:d,until:i+c+dn});let m=s.now();this.scheduledNotes=this.scheduledNotes.filter(g=>g.until>m)}return}if(o){let d=Math.max(0,(i-s.now())*1e3);this.scheduledTimers.push(setTimeout(()=>o.triggerNote(t.note,t.velocity),d)),this.scheduledTimers.push(setTimeout(()=>o.releaseNote(t.note),d+c*1e3)),this.scheduledNotes.push({cancel:()=>o.releaseNote(t.note),until:i+c+dn});return}let h=s.context();if(!h)return;let p=Ji(h,a?.channels?.[e.channel_index]?.gain||a?.masterGain||null,Xi(t.note),t.velocity/127,i,c);p&&this.scheduledNotes.push({cancel:()=>{try{p.stop(0),p.disconnect()}catch{}},until:i+c+dn})}scheduleMidi(e,t){let i=this.clock(),n=i.beat(),s=i.loop,a=s.enabled&&s.endBeat>s.startBeat;n<this.midiLastBeat-1e-6&&(this.midiCursorBeat=a&&n<s.endBeat?Math.min(n,s.startBeat):n),this.midiLastBeat=n;let o=i.secondsPerBeat(),l=n+Ms/o;a&&n<s.endBeat&&(l=Math.min(l,s.endBeat)),!(l<=this.midiCursorBeat)&&(e.forEach(c=>{let h=t[c.track_index];if(!h)return;let p=c.offset||0;(c.events||[]).forEach(d=>{let m=d.beat-p;if(m<0||m>=c.duration)return;let g=c.start+m;g<this.midiCursorBeat||g>=l||this.triggerMidiNote(h,d,i.now()+(g-n)*o,o)})}),this.midiCursorBeat=l)}startMidiPlayback(e){let t=this.trackList(),i=t.some(a=>a.solo),n=this.clipList().filter(a=>{let o=t[a.track_index];return a.kind==="midi"&&o&&!o.muted&&!(i&&!o.solo)&&!a.muted&&(a.events||[]).length>0});if(n.length===0)return;let s=Ms/this.clock().secondsPerBeat();this.midiCursorBeat=Math.max(0,e-s),this.midiLastBeat=e,this.scheduleMidi(n,t),this.midiTimer=setInterval(()=>this.scheduleMidi(n,t),ma)}connectMediaElement(e,t){let i=w(this.sessionId),n=i?.audioCtx||this.context;if(!(!n||!n.createMediaElementSource))try{let s=n.createMediaElementSource(e),a=i?.channels?.[t.channel_index]?.gain||i?.masterGain||n.destination;s.connect(a),this.activeSources.push(s)}catch{}}playClip(e,t){if(e.kind==="midi"||!e.audio_url||e.muted)return;let i=this.trackList()[e.track_index];if(!i||i.muted)return;let n=new Audio(e.audio_url);n.preload="auto",n.loop=!!e.loop,n.currentTime=Math.max(0,t),this.connectMediaElement(n,i),this.activeMedia.push(n),n.play().catch(()=>{})}maybeExtendTimelineForRecording(e){if(!this.isRecording||!this.autoExtendRecording)return!1;let t=this.beatsPerBar(),i=this.timelineLength();if(i>=Xe||e<i-t)return!1;let n=Math.max(t,this.recordingExtendBeats()),s=i;for(;e>=s-t&&s<Xe;)s=Math.min(Xe,s+n);return s<=i?!1:(this.length=s,this.set({length:s}),!0)}keepPlayheadVisible(e){let t=Math.max(0,A(this.pixelsPerBeat,0));if(t<=0)return;let i=this.querySelector(".nbplay-timeline-scroll"),n=this.querySelector(".nbplay-timeline-ruler-spacer");if(!i)return;let s=n?.offsetWidth||0,a=e*t,o=i.clientWidth-s;o<=0||(a<i.scrollLeft||a>i.scrollLeft+o)&&(i.scrollLeft=Math.max(0,a-o*.2))}startPlayback(){this.clearScheduledPlayback();let e=this.clock();e.context()?.resume?.();let t=this.timelineLength();if(e.beat()>=t){e.seek(0);return}let i=this.trackList(),n=i.some(l=>l.solo),s=this.clipList(),a=e.secondsPerBeat(),o=e.beat();this.displayBeat=o,this.startMidiPlayback(o),s.forEach(l=>{let c=i[l.track_index];if(l.kind==="midi"||!c||c.muted||n&&!c.solo||l.muted||pi(l)<=o&&!l.loop)return;let h=l.start-o,p=Math.max(0,h*a*1e3),m=((l.loop&&o>l.start?(o-l.start)%Math.max(.001,l.duration):Math.max(0,o-l.start))+(l.offset||0))*a;this.scheduledTimers.push(setTimeout(()=>this.playClip(l,m),p))}),this.playheadTimer=setInterval(()=>{let l=e.beat();this.maybeExtendTimelineForRecording(l);let c=this.timelineLength();if(l>=c){this.displayBeat=c,this.clearScheduledPlayback(),e.stop(),e.seek(c);return}this.displayBeat=l,this.keepPlayheadVisible(l)},ba)}seekToBeat(e,t=!0,i=!0){if(this.recordingActive())return;let n=this.clampBeat(e),s=this.clock();s.playing&&!i&&this.clearScheduledPlayback(),this.suppressRestart=!i;try{s.seek(n)}finally{this.suppressRestart=!1}t&&this.status({},!0)}toggleLoop(){let e=this.clock(),t=e.loop;if(t.enabled){e.setLoop(!1,t.startBeat,t.endBeat);return}let i=this.beatsPerBar(),n=this.timelineLength(),s=t.endBeat>t.startBeat&&t.startBeat<n,a=s?t.startBeat:0,o=s?Math.min(n,t.endBeat):Math.min(n,4*i);e.setLoop(!0,a,Math.max(a+i,o))}syncLoopRange(){this.requestUpdate()}updateTrack(e,t){let i=this.trackList();e<0||e>=i.length||(i[e]={...i[e],...t},this.tracks=i,this.set({tracks:i}))}selectClip(e){this.selectedClipId=e,this.set({selectedClipId:e})}writeClips(e,t){let i={clips:e};this.clips=e,t!==void 0&&(this.selectedClipId=t,i.selectedClipId=t);let n=e.reduce((s,a)=>Math.max(s,pi(a)),0);n>this.timelineLength()&&(this.length=Math.min(Xe,n),i.length=this.length),this.set(i)}removeSelectedClip(){let e=String(this.selectedClipId||"");e&&this.writeClips(this.clipList().filter(t=>t.id!==e),"")}duplicateSelectedClip(){let e=String(this.selectedClipId||""),t=this.clipList(),i=t.find(s=>s.id===e);if(!i)return;let n={...i,id:pn(),start:pi(i)};this.writeClips([...t,n],n.id)}laneIndexAt(e){let t=this.querySelectorAll("nbplay-lane");for(let i of t){let n=i.getBoundingClientRect();if(e>=n.top&&e<=n.bottom)return A(i.dataset.track,-1)}return-1}onClipEdit(e){e.stopPropagation();let t=e.detail;if(t.field!=="clip")return;let i=this.laneIndexAt(t.clientY);this.writeClips(this.clipList().map(n=>n.id===t.id?{...n,start:t.start,duration:t.duration,offset:t.offset,track_index:i>=0?i:n.track_index}:n),t.id)}handleExportRequest(){if(this.disposed)return;let e=String(this.exportClipId||"");if(!e)return;let t=this.clipList().find(n=>n.id===e),i=n=>{this.disposed||(this.recordingError=n,this.status({recordingError:n},!1),n&&(this.exportClipId="",this.set({exportClipId:""})))};if(!t?.audio_url){i("Clip has no audio to export");return}fetch(t.audio_url).then(n=>n.blob()).then(async n=>{let s=await n.arrayBuffer();this.disposed||(this.exportedClip={...t,blob_type:n.type||t.blob_type||"",blob_size:n.size},this.exportedClipData=new DataView(s),this.status({exportedClip:this.exportedClip,exportedClipData:this.exportedClipData},!1),i(""))}).catch(n=>{i(`Export failed: ${n instanceof Error?n.message:String(n)}`)})}handleImportRequest(){if(this.disposed)return;let e=this.importClipRequest||{};if(!e.id)return;let t=ya(this.importClipData);if(!t||t.length===0||e.blob_size&&t.length!==e.blob_size)return;let i=new Blob([t.slice()],{type:e.blob_type||"audio/webm"}),n=URL.createObjectURL(i);this.objectUrls.add(n);let s=o=>{if(this.disposed)return;let l=this.clipList().map(c=>c.id===e.id?{...c,audio_url:n,blob_type:i.type,blob_size:i.size,duration:o??c.duration}:c);this.importClipRequest={},this.set({importClipRequest:{}}),this.writeClips(l)},a=this.context;if(e.measure_duration&&a?.decodeAudioData){let o=t.slice().buffer;Promise.resolve(a.decodeAudioData(o)).then(l=>{let c=A(l.duration,l.length/Math.max(1,l.sampleRate))||0,h=Math.max(1,A(this.bpm,120));s(c>0?Math.max(ha,c*(h/60)):null)}).catch(()=>s(null));return}s(null)}render(){let e=this.trackList(),t=this.clipList(),i=this.timelineLength(),n=this.beatsPerBar(),s=Math.max(1,Math.ceil(i/n)),a=Math.max(0,A(this.pixelsPerBeat,0)),o=a>0?i*a:0,l=this.clampBeat(this.displayBeat??A(this.currentBeat,0)),c=!!this.isPlaying,h=!!this.isRecording,p=Math.max(0,A(this.recordingCountdownBeats,0)),d=this.binding?this.clock().loop:{enabled:!1,startBeat:0,endBeat:0},m=String(this.selectedClipId||""),g=(this.recordingTracks||[]).map(b=>A(b,-1)),f=b=>b.stopPropagation(),$=(b,E,y,S,C,T,R,W)=>u`<label class="nbplay-timeline-field" title=${y}>
        <span>${E}</span>
        <input
          class=${b}
          type="number"
          min=${C}
          max=${T}
          step=${R}
          .value=${String(S)}
          @input=${f}
          @change=${j=>{j.stopPropagation();let F=Number(j.target.value);W(N(Number.isFinite(F)?F:S,C,T))}}
        />
      </label>`;return u`<nbplay-header badge="timeline">
        <div class="nbplay-timeline-actions">
          ${$("nbplay-timeline-bars","Bars","Timeline length in bars",s,1,256,1,b=>{this.length=b*this.beatsPerBar(),this.set({length:this.length})})}
          ${$("nbplay-timeline-count-in","Count","Recording count-in in bars",Math.max(0,A(this.countInBars,0)),0,8,1,b=>{this.countInBars=b,this.set({countInBars:b})})}
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
          ${$("nbplay-timeline-extend-bars","Ext","Bars to add while recording",Math.max(1,A(this.recordingExtendBars,8)),1,256,1,b=>{this.recordingExtendBars=b,this.set({recordingExtendBars:b})})}
          ${$("nbplay-timeline-zoom","Zoom","Zoom in pixels per beat (0 fits the width)",a,0,400,4,b=>{this.pixelsPerBeat=b,this.set({pixelsPerBeat:b})})}
          <button
            type="button"
            class="nbplay-timeline-loop-btn ${d.enabled?"active":""}"
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
            class="nbplay-timeline-record ${h?"active":""}"
            title=${h?"Stop recording":"Record armed tracks"}
            @click=${()=>this.toggleRecord()}
          >
            ${h&&p>0?Math.ceil(p):"\u25CF"}
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
        <div class="nbplay-timeline-position">${ce(l,n)}</div>
      </nbplay-header>
      <div class="nbplay-timeline-scroll ${a>0?"zoomed":""}">
        <div class="nbplay-timeline-ruler">
          <div class="nbplay-timeline-ruler-spacer"></div>
          <nbplay-ruler
            .length=${i}
            .beatsPerBar=${n}
            .beat=${l}
            .loopStart=${d.startBeat}
            .loopEnd=${d.endBeat}
            .loopEnabled=${d.enabled}
            .width=${o}
            .disabled=${this.recordingActive()}
            @nbplay-seek=${b=>{b.stopPropagation();let{beat:E,final:y}=b.detail;this.seekToBeat(E,y,y)}}
            @input=${b=>this.onLoopEdit(b)}
            @change=${b=>this.onLoopEdit(b)}
          ></nbplay-ruler>
        </div>
        <div class="nbplay-timeline-body">
          ${e.length?e.map((b,E)=>this.renderLane(b,E,t,i,n,l,o,m,g.includes(E))):u`<div class="nbplay-timeline-empty">No tracks</div>`}
        </div>
      </div>
      <div class="nbplay-timeline-status">
        ${String(this.recordingError||"")}
      </div>`}onLoopEdit(e){e.stopPropagation();let{field:t,value:i}=e.detail,n=this.clock(),s=n.loop;t==="loopStart"?n.setLoop(!0,i,s.endBeat):t==="loopEnd"&&n.setLoop(!0,s.startBeat,i)}renderLane(e,t,i,n,s,a,o,l,c){let h=e.channel_index>=0?`Ch ${e.channel_index+1}`:"No channel",p=i.filter(d=>d.track_index===t).map(d=>({id:d.id,name:d.name,start:d.start,duration:d.duration,offset:d.offset,kind:d.kind,pattern:!!d.pattern,muted:d.muted,detail:d.pattern?`${ce(d.start,s)} \xB7 pattern`:d.kind==="midi"?`${ce(d.start,s)} \xB7 ${(d.events||[]).length} notes`:ce(d.start,s)}));return u`<nbplay-lane
      data-track=${t}
      .name=${e.name}
      .armed=${e.armed}
      .monitor=${e.monitor}
      .muted=${e.muted}
      .solo=${e.solo}
      .input=${e.input}
      .inputs=${[{value:"microphone",label:"Mic"},{value:"channel",label:h,disabled:e.channel_index<0},{value:"midi",label:"MIDI"}]}
      .clips=${p}
      .length=${n}
      .beatsPerBar=${s}
      .beat=${a}
      .selected=${l}
      .recording=${c}
      .width=${o}
      .disabled=${!1}
      @nbplay-seek=${d=>{d.stopPropagation();let{beat:m,final:g}=d.detail;this.seekToBeat(m,g,g)}}
      @nbplay-clip-select=${d=>{d.stopPropagation(),this.selectClip(d.detail.id)}}
      @input=${d=>d.stopPropagation()}
      @change=${d=>{let m=d.detail;if(m.field==="clip"){this.onClipEdit(d);return}d.stopPropagation(),this.updateTrack(t,{[m.field]:m.value})}}
    ></nbplay-lane>`}};k("nbplay-timeline",hi);function va(r){return r.replace(/_([a-z])/g,(e,t)=>t.toUpperCase())}var ga=["Null","Bool","Int","Float","Str","Bytes","List","Map"];function mn(r){if(r==="Null")return null;if(typeof r=="object"&&r!==null){let e=Object.keys(r);if(e.length===1&&ga.includes(e[0])){let t=e[0],i=r[t];return t==="Null"?null:t==="List"?i.map(mn):t==="Map"?Object.fromEntries(Object.entries(i).map(([n,s])=>[n,mn(s)])):i}}return r}function ka(r,e){switch(r){case"is_playing":return{action:e?"play":"stop"};case"is_recording":return{action:"record",on:!!e};case"current_beat":return{action:"seek",beat:Number(e)};default:return null}}var bn=class extends HTMLElement{stop=null;get namespace(){return this.getAttribute("namespace")??"status"}set namespace(e){this.setAttribute("namespace",e)}connectedCallback(){let e={namespace:this.namespace};this.dispatchEvent(new CustomEvent("spaday:wire-request",{detail:e,bubbles:!0,composed:!0}));let t=e.wire,i=this.parentElement;!t||!i||(this.stop=t.client.onCommand(n=>{if(t.link.modelId!==void 0&&n.id!==t.link.modelId)return;let s=mn(n.value);if(typeof i.command=="function"){let a=ka(n.field,s)??(s&&typeof s=="object"&&!Array.isArray(s)?s:null);a&&i.command(a)}else{let a=va(n.field);i[a]=s,i.dispatchEvent(new CustomEvent("nbplay-status",{detail:{values:{[a]:s},save:!0},bubbles:!0}))}t.client.ackCommand(n)}))}disconnectedCallback(){this.stop?.(),this.stop=null}};customElements.get("nbplay-wire")||customElements.define("nbplay-wire",bn);export{bn as NbplayWire,va as camel,ka as statusCommand,mn as untag};
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
