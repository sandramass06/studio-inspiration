import Stripe from 'npm:stripe@17.7.0';
import {createClient} from 'npm:@supabase/supabase-js@2.49.4';
const stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('',{status:405});
 let event:Stripe.Event;
 try{event=await stripe.webhooks.constructEventAsync(await req.text(),req.headers.get('stripe-signature')||'',Deno.env.get('STRIPE_WEBHOOK_SECRET')!,undefined,Stripe.createSubtleCryptoProvider());}catch{return new Response('',{status:400});}
 if(event.livemode)return new Response('ignored');
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return new Response('ok');
 const s=event.data.object as Stripe.Checkout.Session;
 if(s.payment_status!=='paid'||s.mode!=='payment'||s.metadata?.product!=='studio-full'||!s.metadata.user_id||s.client_reference_id!==s.metadata.user_id)return new Response('ignored');
 try{const items=await stripe.checkout.sessions.listLineItems(s.id);
 if(items.data.length!==1||items.data[0].price?.id!==Deno.env.get('STRIPE_PRICE_ID')||items.data[0].quantity!==1)return new Response('ignored');
 const {error}=await db.from('entitlements').upsert({user_id:s.metadata.user_id,product:'studio-full',active:true},{onConflict:'user_id,product'});
 if(error)throw error;return new Response('ok');}catch{return new Response('retry',{status:500});}
});
