import Stripe from 'npm:stripe@17.7.0';
import {createClient} from 'npm:@supabase/supabase-js@2.49.4';
const stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const origin='https://studio-inspiration-test.pages.dev';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
Deno.serve(async req=>{
 if(req.headers.get('origin')!==origin)return reply({},403);
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({},405);
 try{
 const auth=req.headers.get('Authorization');if(!auth?.startsWith('Bearer '))return reply({},401);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
 const {data:{user},error}=await db.auth.getUser(auth.slice(7));if(error||!user?.email_confirmed_at)return reply({},401);
 const existing=await db.from('entitlements').select('active').eq('user_id',user.id).eq('product','studio-full').maybeSingle();
 if(existing.error)return reply({},503);if(existing.data?.active)return reply({error:'already_owned'},409);
 if(!Deno.env.get('STRIPE_SECRET_KEY')?.startsWith('sk_test_'))return reply({},503);
 const session=await stripe.checkout.sessions.create({mode:'payment',line_items:[{price:Deno.env.get('STRIPE_PRICE_ID')!,quantity:1}],customer_email:user.email,client_reference_id:user.id,metadata:{user_id:user.id,product:'studio-full'},success_url:origin+'/?payment=success',cancel_url:origin+'/?payment=cancel'});
 return reply({url:session.url});
 }catch{return reply({},503);}
});
