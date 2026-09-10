const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/admin');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
async function run(url, method='GET', headers={}) {
 const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(v){this.body=v||'';}};
 await handler({url,method,headers},res);return res;
}
const allowed={email:'atendimento@automindsolution.com.br',email_confirmed_at:'2026-09-10',identities:[{provider:'google'}],is_anonymous:false};
test('anonymous request cannot receive panel or bypass via query',async()=>{
 global.fetch=()=>{throw new Error('unexpected remote request');};
 const r=await run('/admin?iniciarLogado=true');assert.match(r.body,/Entrar com Google/);assert.doesNotMatch(r.body,/MRR|Pipeline e leads/);assert.match(r.headers['Cache-Control'],/no-store/);
});
test('forged session is rejected by Supabase verification',async()=>{
 global.fetch=async()=>new Response('{}',{status:401});
 const r=await run('/admin','GET',{cookie:'__Host-automind-session=forged'});assert.doesNotMatch(r.body,/MRR/);assert.match(r.body,/sessão expirou/);
});
test('valid Google user outside allowlist is denied',async()=>{
 global.fetch=async()=>Response.json({...allowed,email:'other@example.com'});
 const r=await run('/admin','GET',{cookie:'__Host-automind-session=valid'});assert.doesNotMatch(r.body,/MRR/);
});
test('password-only or unverified accounts are denied',async()=>{
 for(const user of [{...allowed,identities:[{provider:'email'}]},{...allowed,email_confirmed_at:null}]){
 global.fetch=async()=>Response.json(user);const r=await run('/admin','GET',{cookie:'__Host-automind-session=valid'});assert.doesNotMatch(r.body,/MRR/);}
});
test('verified authorized Google user receives private panel',async()=>{
 global.fetch=async()=>Response.json(allowed);const r=await run('/admin','GET',{cookie:'__Host-automind-session=valid'});assert.equal(r.statusCode,200);assert.match(r.body,/MRR/);
});
test('login and logout reject foreign origin and GET',async()=>{
 global.fetch=()=>{throw new Error('unexpected remote request');};
 assert.equal((await run('/api/admin?action=login')).statusCode,405);
 assert.equal((await run('/api/admin?action=logout','POST',{origin:'https://evil.test'})).statusCode,403);
});
test('disabled Google fails closed',async()=>{
 global.fetch=async()=>Response.json({external:{google:false}});
 const r=await run('/api/admin?action=login','POST',{origin:'https://www.automindsolution.com.br'});assert.equal(r.statusCode,503);assert.doesNotMatch(r.body,/MRR/);
});
test('login uses PKCE and secure HttpOnly cookie',async()=>{
 global.fetch=async()=>Response.json({external:{google:true}});
 const r=await run('/api/admin?action=login','POST',{origin:'https://www.automindsolution.com.br'});assert.equal(r.statusCode,303);const u=new URL(r.headers.Location);assert.equal(u.searchParams.get('provider'),'google');assert.equal(u.searchParams.get('code_challenge_method'),'s256');assert.match(r.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax/);
});
test('callback without verifier cannot exchange code',async()=>{
 global.fetch=()=>{throw new Error('unexpected request');};assert.equal((await run('/api/admin?action=callback&code=bogus')).statusCode,400);
});
test('successful callback verifies user before creating session',async()=>{
 let calls=0;global.fetch=async(url,opts)=>{calls++;if(url.includes('/token?')){assert.equal(JSON.parse(opts.body).code_verifier,'a'.repeat(64));return Response.json({access_token:'verified-token',expires_in:3600});}return Response.json(allowed);};
 const r=await run('/api/admin?action=callback&code=valid-code','GET',{cookie:'__Host-automind-pkce='+ 'a'.repeat(64)});assert.equal(calls,2);assert.equal(r.headers.Location,'/admin');assert.match(r.headers['Set-Cookie'][1],/__Host-automind-session=verified-token/);
});
