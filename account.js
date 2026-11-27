const diag=stage=>{const e=document.getElementById('auth-diagnostic');if(e)e.textContent=stage;};
diag('D1 — Module principal démarré');
async function load(){
diag('D2 — Chargement de la configuration');
const {config}=await import('./account-config.js');
diag('D3 — Chargement du contrôle des accès');
const {getAccess,checkoutUrl}=await import('./account-core.mjs');
diag('D4 — Chargement de Supabase');
const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.4');
diag('D5 — Bibliothèque chargée');
const el=id=>document.getElementById(id),say=t=>el('account-message').textContent=t;
const form=el('account-form'),logout=el('account-logout'),buy=el('account-buy');
let generation=0;
const atelier=el('atelier'),enter=el('account-enter');
let selectedUniverse=null;
document.querySelectorAll('[data-universe]').forEach(a=>a.addEventListener('click',()=>{selectedUniverse=a.dataset.universe;}));
enter.addEventListener('click',()=>{if(selectedUniverse){el('universe').value=selectedUniverse;el('universe').dispatchEvent(new Event('change'));}});
async function start(){
 if(!config.url||!config.anonKey){say('Connexion en cours de configuration.');form.querySelector('button').disabled=true;return;}
 const url=new URL(location.href);
 const hash=new URLSearchParams(url.hash.slice(1));
 const query=url.searchParams;
 const param=k=>hash.get(k)||query.get(k);
 const callbackError=param('error_code')||param('error');
 const accessToken=param('access_token'),refreshToken=param('refresh_token'),code=param('code');
 const returning=!!(callbackError||accessToken||refreshToken||code||query.has('auth_return'));
 let notice='';
 const bounded=(promise,ms=12000)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),ms);})]).finally(()=>clearTimeout(timer));};
 diag('D6 — Initialisation de Supabase');
 const client=createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'implicit'}});
 function authMessage(error){
 const c=error?.code||error;
 if(c==='otp_expired'||c==='access_denied')return 'Ce lien est expiré ou déjà utilisé. Demandez un nouveau lien.';
 if(c==='invalid_grant'||c==='bad_code_verifier')return 'Ce lien ne peut pas être validé dans ce navigateur. Demandez un nouveau lien.';
 if(c==='over_email_send_rate_limit'||c==='over_request_rate_limit')return 'Trop de demandes. Patientez avant de réessayer.';
 return 'La connexion n’a pas pu être confirmée. Demandez un nouveau lien.';
 }
 diag(returning?'D7 — Retour du lien détecté':'D7 — Aucun retour de lien détecté');
 if(returning){
 try{
 if(callbackError)notice=authMessage(callbackError);
 else if(accessToken&&refreshToken){diag('D8 — Validation de la session');const {error}=await bounded(client.auth.setSession({access_token:accessToken,refresh_token:refreshToken}));if(error)notice=authMessage(error);}
 else if(code){diag('D8 — Échange du code de connexion');const {error}=await bounded(client.auth.exchangeCodeForSession(code));if(error)notice=authMessage(error);}
 else notice='Aucune information de connexion reçue. Demandez un nouveau lien.';
 }catch{notice='Impossible de récupérer la session. Réessayez avec un nouveau lien.';}
 for(const k of ['access_token','refresh_token','provider_token','provider_refresh_token','expires_in','expires_at','token_type','type','code','error','error_code','error_description','auth_return'])url.searchParams.delete(k);
 url.hash='compte';history.replaceState(null,'',url.pathname+url.search+url.hash);
 }
 async function refresh(session){
 const n=++generation;form.hidden=!!session;logout.hidden=!session;buy.hidden=true;enter.hidden=true;atelier.hidden=true;el('account-email-label').textContent=session?.user?.email||'';
 say(session?'Vérification de tes accès…':(notice||'Connecte-toi pour retrouver tes achats.'));
 try{const access=await bounded(getAccess(client,session));if(n!==generation)return;
 if(access==='paid'){say('Accès complet retrouvé. Aucun nouvel achat nécessaire.');enter.hidden=false;atelier.hidden=false;}
 if(access==='unpaid'){say('Aucun achat actif retrouvé.');buy.hidden=false;buy.disabled=location.origin!=='https://studio-inspiration-test.pages.dev';buy.textContent=buy.disabled?'Achat bientôt disponible':'Acheter l’accès complet – 14,90 € (test)';}
 }catch{if(n===generation)say('Impossible de vérifier tes accès. Réessaie plus tard.');}
 }
 client.auth.onAuthStateChange((_,session)=>setTimeout(()=>refresh(session),0));
 form.querySelector('button').disabled=false;
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');notice='';b.disabled=true;try{const {error}=await client.auth.signInWithOtp({email:el('account-email').value.trim(),options:{emailRedirectTo:location.origin+location.pathname+'?auth_return=1',shouldCreateUser:true}});say(error?authMessage(error):'Consulte ta boîte e-mail pour te connecter.');}catch{say('Envoi indisponible.');}finally{b.disabled=false;}};
 logout.onclick=async()=>{try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await refresh(null);}catch{say('Déconnexion impossible.');}};
 buy.onclick=async()=>{buy.disabled=true;try{const {data,error}=await client.functions.invoke('checkout',{body:{}});if(error)throw error;location.assign(checkoutUrl(data.url));}catch{say('Paiement indisponible. Réessaie après vérification de tes accès.');}finally{buy.disabled=false;}};
 diag('D9 — Lecture de la session');
 const {data,error}=await bounded(client.auth.getSession());
 diag(data?.session?'D9b — Session trouvée, contrôle des accès':'D9b — Lecture terminée, aucune session');if(error){notice=authMessage(error);await refresh(null);}else await refresh(data.session);diag(error?'D10 — Erreur de lecture de session':data.session?'D10 — Session présente':'D10 — Session absente'+(notice?' : '+notice:''));if(returning||query.has('payment'))el('compte').scrollIntoView();if(query.get('payment')==='success'&&atelier.hidden&&data.session){say('Paiement en cours de confirmation…');for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,2000));await refresh(data.session);if(!atelier.hidden)break;}}
}
await start();
}
load().catch(()=>{const e=document.getElementById('auth-diagnostic');if(e)e.textContent+=' — Échec';document.getElementById('account-message').textContent='Service de connexion indisponible.';});
