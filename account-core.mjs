export async function getAccess(client,session){
 if(!session?.user?.id)return 'guest';
 const {data,error}=await client.from('entitlements').select('product').eq('user_id',session.user.id).eq('product','studio-full').eq('active',true).maybeSingle();
 if(error)throw error;
 return data?'paid':'unpaid';
}
export function checkoutUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='checkout.stripe.com'||u.port||u.username||u.password)throw Error('Invalid checkout URL');return u.href;}
