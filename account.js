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
function hide(){buy.hidden=true;enter.hidden=true;atelier.hidden=true;}
function guest(message='Connecte-toi pour retrouver tes achats.'){hide();form.hidden=false;form.querySelector('button').disabled=false;logout.hidden=true;el('account-email-label').textContent='';say(message);diag('Session absente');}
async function access(){
 hide();form.hidden=true;logout.hidden=false;el('account-email-label').textContent=user.email||'';
 say('Vérification de tes accès…');
 const rows=await api('/rest/v1/entitlements?select=product&product=eq.studio-full&active=eq.true&user_id=eq.'+encodeURIComponent(user.id),{token:session.access_token});
 if(!Array.isArray(rows))throw new Error('invalid_access');
 if(rows.length){enter.hidden=false;atelier.hidden=false;say('Accès complet retrouvé. Aucun nouvel achat nécessaire.');}
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
