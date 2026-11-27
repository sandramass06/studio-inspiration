import {config} from './account-config.js';
import {checkoutUrl} from './account-core.mjs';
const el=id=>document.getElementById(id), say=t=>el('account-message').textContent=t, diag=t=>el('auth-diagnostic').textContent=t;
const form=el('account-form'), logout=el('account-logout'), buy=el('account-buy'), enter=el('account-enter'), atelier=el('atelier');
const key='studio-inspiration-rest-session-v1';
let session=null, user=null, busy=false, selectedUniverse=null;
const test=location.origin==='https://studio-inspiration-test.pages.dev';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,{method='GET',body,token}={}){
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),10000);
 try{
 const response=await fetch(config.url+path,{method,headers:{apikey:config.anonKey,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok){const e=new Error('request_failed');e.status=response.status;throw e;}return data;
 }finally{clearTimeout(timer);}
}
function store(s){if(!s?.access_token||!s?.refresh_token)throw new Error('invalid_session');localStorage.setItem(key,JSON.stringify(s));session=s;}
function clear(){localStorage.removeItem(key);session=null;user=null;}
function read(){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
async function locked(fn){
 if(!navigator.locks)return fn();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{return await navigator.locks.request(key,{signal:controller.signal},()=>{clearTimeout(timer);return fn();});}finally{clearTimeout(timer);}
}
async function validate(){
 return locked(async()=>{
 session=read();if(!session)return null;
 try{return await api('/auth/v1/user',{token:session.access_token});}
 catch(e){if(e.status!==401&&e.status!==403)throw e;}
 try{store(await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}}));return await api('/auth/v1/user',{token:session.access_token});}
 catch(e){if([400,401,403].includes(e.status)){clear();return null;}throw e;}
 });
}
function hide(){el("inspirations-open").hidden=true;el("inspirations").hidden=true;el("inspirations-list").replaceChildren();buy.hidden=true;enter.hidden=true;atelier.hidden=true;}
function guest(message='Connecte-toi pour retrouver tes achats.'){hide();form.hidden=false;form.querySelector('button').disabled=false;logout.hidden=true;el('account-email-label').textContent='';say(message);diag('Session absente');}
async function access(){
 hide();form.hidden=true;logout.hidden=false;el('account-email-label').textContent=user.email||'';
 say('Vérification de tes accès…');
 const rows=await api('/rest/v1/entitlements?select=product&product=eq.studio-full&active=eq.true&user_id=eq.'+encodeURIComponent(user.id),{token:session.access_token});
 if(!Array.isArray(rows))throw new Error('invalid_access');
 if(rows.length){el("inspirations-open").hidden=false;enter.hidden=false;atelier.hidden=false;say('Accès complet retrouvé. Aucun nouvel achat nécessaire.');}
 else{buy.hidden=false;buy.disabled=!test;buy.textContent=test?'Acheter l’accès complet – 14,90 € (test)':'Achat bientôt disponible';say('Aucun achat actif retrouvé.');}
 diag('Session vérifiée');
}
function failure(){hide();say('Connexion temporairement indisponible. Réessayez.');diag('Service indisponible');form.hidden=false;form.querySelector('button').disabled=false;}
function openUniverse(value){
 if(atelier.hidden||enter.hidden)return false;
 const select=el('universe');
 if(value&&Array.from(select.options).some(o=>o.value===value)){select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}
 location.hash='atelier';atelier.scrollIntoView({block:'start'});return true;
}
document.querySelectorAll('[data-universe]').forEach(a=>a.addEventListener('click',e=>{selectedUniverse=a.dataset.universe;if(openUniverse(selectedUniverse))e.preventDefault();}));
enter.onclick=e=>{if(openUniverse(selectedUniverse))e.preventDefault();};
form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;const b=form.querySelector('button');b.disabled=true;
 try{await api('/auth/v1/otp?redirect_to='+encodeURIComponent(location.origin+location.pathname+'?auth_return=1'),{method:'POST',body:{email:el('account-email').value.trim(),create_user:true}});say('Consulte ta boîte e-mail pour te connecter.');}
 catch(e){say(e.status===429?'Trop de demandes. Patientez avant de réessayer.':'Envoi indisponible. Réessayez.');}finally{busy=false;b.disabled=false;}};
logout.onclick=async()=>{if(busy)return;busy=true;try{await locked(async()=>{const s=read();if(s)await api('/auth/v1/logout?scope=local',{method:'POST',token:s.access_token});clear();});guest();}catch{say('Déconnexion impossible. Réessayez.');}finally{busy=false;}};
buy.onclick=async()=>{if(busy||!test)return;busy=true;buy.disabled=true;try{user=await validate();if(!user){guest();return;}const data=await api('/functions/v1/checkout',{method:'POST',body:{},token:session.access_token});location.assign(checkoutUrl(data.url));}catch{say('Paiement indisponible. Réessayez.');}finally{busy=false;buy.disabled=false;}};
async function start(){
 hide();form.querySelector('button').disabled=true;diag('Vérification de la connexion');
 const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1)),p=k=>hash.get(k)||url.searchParams.get(k);
 const token=p('access_token'),refresh=p('refresh_token'),returning=!!(token||refresh||p('error')||p('error_code')||url.searchParams.has('auth_return'));
 if(returning){for(const k of ['access_token','refresh_token','provider_token','provider_refresh_token','expires_in','expires_at','token_type','type','code','error','error_code','error_description','auth_return'])url.searchParams.delete(k);url.hash='compte';history.replaceState(null,'',url.pathname+url.search+url.hash);}
 if(returning&&token&&refresh){await locked(async()=>{await api('/auth/v1/user',{token});store({access_token:token,refresh_token:refresh});});}
 user=await validate();
 if(!user){guest(returning?'Demandez un nouveau lien si votre connexion n’a pas abouti.':undefined);return;}
 await access();
 if(url.searchParams.get('payment')==='success'&&atelier.hidden){for(let i=0;i<8&&atelier.hidden;i++){await sleep(2000);await access();}}
 if(returning||url.searchParams.has('payment'))el('compte').scrollIntoView();
}
window.addEventListener('storage',e=>{if(e.key===key&&!busy){validate().then(u=>{user=u;return u?access():guest();}).catch(failure);}});
start().catch(failure);

window.studioAnalyze=async(h,universe,rotationTenues)=>{const u=await validate();if(!u)throw Error('auth');return api('/functions/v1/studio-analysis',{method:'POST',body:{h,universe,rotationTenues},token:session.access_token});};

const library=el('inspirations'), list=el('inspirations-list'), message=el('inspirations-status'), filter=el('inspirations-filter');
const libraryButton='display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 14px;border:1px solid #756653;border-radius:12px;font:inherit;cursor:pointer;';
function libraryIcon(type){const paths={eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>'};return '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths[type]+'</svg>';}
let libraryRequest=0;
async function librarySession(){const u=await validate();if(!u)throw Error('auth');return {u,token:session.access_token};}
window.studioSaveInspiration=async(universe,title,image)=>{const {u,token}=await librarySession();await api('/rest/v1/studio_inspirations',{method:'POST',token,body:{user_id:u.id,universe,title,image}});if(!library.hidden)await loadLibrary();};
async function loadLibrary(){const n=++libraryRequest;list.replaceChildren();message.textContent='Chargement…';try{const {u,token}=await librarySession();const rows=await api('/rest/v1/studio_inspirations?select=id,universe,title,created_at&order=created_at.desc&limit=100'+(filter.value?'&universe=eq.'+encodeURIComponent(filter.value):''),{token});if(n!==libraryRequest||library.hidden||read()?.access_token!==token)return;message.textContent=rows.length?'':'Aucune inspiration enregistrée.';for(const row of rows){const card=document.createElement('div');card.className='harmony';const title=document.createElement('strong');title.textContent=row.title+' — '+({mode:'Mode',deco:'Décoration',beaute:'Maquillage',bijoux:'Bijoux'}[row.universe]);card.append(title);const date=document.createElement('p');date.textContent='Enregistrée le '+new Date(row.created_at).toLocaleDateString('fr-FR');date.style.cssText='font-size:13px;color:#756653;margin:6px 0 14px;';card.append(date);const view=document.createElement('button');view.innerHTML=libraryIcon('eye')+' Consulter';view.style.cssText=libraryButton+'background:#756653;color:white;';view.onclick=async()=>{try{const {token}=await librarySession();const data=await api('/rest/v1/studio_inspirations?select=image&id=eq.'+encodeURIComponent(row.id),{token});if(library.hidden||!data[0]||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data[0].image))return;const img=document.createElement('img');img.src=data[0].image;img.style.cssText='display:block;width:100%;height:auto;border-radius:12px;margin-top:16px;';const a=document.createElement('a');a.className='cta';a.href=img.src;a.download='Studio-Inspiration.jpg';a.innerHTML=libraryIcon('download')+' Télécharger l’image';a.style.cssText=libraryButton+'background:transparent;color:#51463b;text-decoration:none;margin-top:12px;';card.append(img,a);view.disabled=true;}catch{message.textContent='Consultation impossible.';}};const del=document.createElement('button');del.innerHTML=libraryIcon('trash')+' Supprimer';del.style.cssText=libraryButton+'background:transparent;color:#80534c;border-color:#cbb5ac;';del.onclick=async()=>{if(!confirm('Supprimer cette inspiration ?'))return;try{const {token}=await librarySession();await api('/rest/v1/studio_inspirations?id=eq.'+encodeURIComponent(row.id),{method:'DELETE',token});await loadLibrary();}catch{message.textContent='Suppression impossible.';}};const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;';actions.append(view,del);card.append(actions);list.append(card);}}catch{if(n===libraryRequest)message.textContent='Chargement impossible. Réessaie.';}}
el('inspirations-open').onclick=()=>{library.hidden=false;library.scrollIntoView({block:'start'});loadLibrary();};filter.onchange=loadLibrary;
