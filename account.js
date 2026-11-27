import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {config} from './account-config.js';
import {getAccess,checkoutUrl} from './account-core.mjs';
const el=id=>document.getElementById(id),say=t=>el('account-message').textContent=t;
const form=el('account-form'),logout=el('account-logout'),buy=el('account-buy');
let generation=0;
async function start(){
 if(!config.url||!config.anonKey){say('Connexion en cours de configuration.');form.querySelector('button').disabled=true;return;}
 const client=createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 async function refresh(session){
 const n=++generation;form.hidden=!!session;logout.hidden=!session;buy.hidden=true;el('account-email-label').textContent=session?.user?.email||'';
 say(session?'Vérification de tes accès…':'Connecte-toi pour retrouver tes achats.');
 try{const access=await getAccess(client,session);if(n!==generation)return;
 if(access==='paid')say('Accès complet retrouvé. Aucun nouvel achat nécessaire.');
 if(access==='unpaid'){say('Aucun achat actif retrouvé.');buy.hidden=false;}
 }catch{if(n===generation)say('Impossible de vérifier tes accès. Réessaie plus tard.');}
 }
 client.auth.onAuthStateChange((_,session)=>setTimeout(()=>refresh(session),0));
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{const {error}=await client.auth.signInWithOtp({email:el('account-email').value.trim(),options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});say(error?'Envoi impossible. Réessaie.':'Consulte ta boîte e-mail pour te connecter.');}catch{say('Envoi indisponible.');}finally{b.disabled=false;}};
 logout.onclick=async()=>{try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await refresh(null);}catch{say('Déconnexion impossible.');}};
 buy.onclick=async()=>{buy.disabled=true;try{const {data,error}=await client.functions.invoke('checkout');if(error)throw error;location.assign(checkoutUrl(data.url));}catch{say('Paiement indisponible. Réessaie après vérification de tes accès.');}finally{buy.disabled=false;}};
 const {data,error}=await client.auth.getSession();if(error)throw error;await refresh(data.session);
}
start().catch(()=>say('Service de connexion indisponible.'));
