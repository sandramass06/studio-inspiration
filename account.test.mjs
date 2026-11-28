import test from 'node:test';import assert from 'node:assert/strict';import {getAccess,checkoutUrl} from './account-core.mjs';
const db=rows=>({from:table=>{assert.equal(table,'entitlements');const filters={};const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q},maybeSingle:async()=>({data:rows.find(r=>Object.entries(filters).every(([k,v])=>r[k]===v))||null,error:null})};return q;}});
const rows=[{user_id:'A',product:'studio-full',active:true},{user_id:'C',product:'studio-full',active:false}];
test('guest',async()=>assert.equal(await getAccess(null,null),'guest'));
test('purchase restored on two sessions',async()=>{for(const device of ['phone1','phone2'])assert.equal(await getAccess(db(rows),{user:{id:'A'},device}),'paid');});
test('different account cannot restore',async()=>assert.equal(await getAccess(db(rows),{user:{id:'B'}}),'unpaid'));
test('inactive entitlement',async()=>assert.equal(await getAccess(db(rows),{user:{id:'C'}}),'unpaid'));
test('database failure',async()=>{const c={from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({error:Error('offline')})};return q}};await assert.rejects(getAccess(c,{user:{id:'A'}}));});
test('checkout URL',()=>{assert.equal(checkoutUrl('https://checkout.stripe.com/c/pay'),'https://checkout.stripe.com/c/pay');for(const u of ['http://checkout.stripe.com','https://checkout.stripe.com.evil.test','https://evil.test','https://x@checkout.stripe.com'])assert.throws(()=>checkoutUrl(u));});
